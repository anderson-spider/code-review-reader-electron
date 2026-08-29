import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  CodexAppServerClient,
  CodexAppServerTransportError,
  type AppServerClientDependencies,
  type AppServerProcess,
} from '../codex-app-server.client';

const ClientMessageSchema = z.object({
  id: z.number().int().optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()),
});

class FakeAppServerProcess extends EventEmitter implements AppServerProcess {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly kill = vi.fn((_signal?: NodeJS.Signals | number) => true);

  send(message: Readonly<Record<string, unknown>>): void {
    this.stdout.write(`${JSON.stringify(message)}\n`);
  }
}

type Harness = {
  readonly process: FakeAppServerProcess;
  readonly dependencies: AppServerClientDependencies;
  readonly messages: Readonly<Record<string, unknown>>[];
  readonly removeTempDirectory: ReturnType<typeof vi.fn>;
};

function createHarness(
  onMessage: (message: z.infer<typeof ClientMessageSchema>, process: FakeAppServerProcess) => void,
): Harness {
  const process = new FakeAppServerProcess();
  const messages: Readonly<Record<string, unknown>>[] = [];
  const removeTempDirectory = vi.fn(async () => undefined);
  let buffer = '';
  process.stdin.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines.filter(Boolean)) {
      const message = ClientMessageSchema.parse(JSON.parse(line));
      messages.push(message);
      onMessage(message, process);
    }
  });
  return {
    process,
    messages,
    removeTempDirectory,
    dependencies: {
      spawnProcess: vi.fn(() => process),
      createTempDirectory: vi.fn(async () => '/tmp/codex-app-server-test'),
      removeTempDirectory,
    },
  };
}

function respondToHandshake(message: z.infer<typeof ClientMessageSchema>, process: FakeAppServerProcess): boolean {
  if (message.method === 'initialize' && message.id !== undefined) {
    process.send({ id: message.id, result: { userAgent: 'test' } });
    return true;
  }
  return message.method === 'initialized';
}

afterEach(() => {
  vi.useRealTimers();
});

describe('CodexAppServerClient', () => {
  it('disables lifecycle hooks when spawning the app server', async () => {
    const harness = createHarness((message, process) => {
      respondToHandshake(message, process);
    });

    const client = await CodexAppServerClient.create({ dependencies: harness.dependencies });
    await client.close();

    expect(harness.dependencies.spawnProcess).toHaveBeenCalledWith(
      'codex',
      ['app-server', '--disable', 'hooks', '--listen', 'stdio://'],
      '/tmp/codex-app-server-test',
    );
  });

  it('runs the supported lifecycle and returns the completed agent message', async () => {
    // Given
    const harness = createHarness((message, process) => {
      if (respondToHandshake(message, process)) return;
      if (message.method === 'thread/start' && message.id !== undefined) {
        process.send({ id: message.id, result: { thread: { id: 'thread-1' } } });
      }
      if (message.method === 'turn/start' && message.id !== undefined) {
        process.send({ id: message.id, result: { turn: { id: 'turn-1' } } });
        queueMicrotask(() => {
          process.send({ method: 'item/completed', params: { threadId: 'thread-1', turnId: 'turn-1', item: { id: 'item-1', type: 'agentMessage', text: '{"ok":true}' } } });
          process.send({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', items: [] } } });
        });
      }
    });

    // When
    const client = await CodexAppServerClient.create({ dependencies: harness.dependencies });
    const threadId = await client.startThread();
    const result = await client.runTurn({ threadId, input: 'review', outputSchema: { type: 'object' } });
    await client.close();

    // Then
    expect(result).toBe('{"ok":true}');
    expect(harness.messages.map((message) => message.method)).toEqual([
      'initialize', 'initialized', 'thread/start', 'turn/start',
    ]);
    expect(harness.process.kill).toHaveBeenCalledOnce();
    expect(harness.removeTempDirectory).toHaveBeenCalledOnce();
  });

  it('correlates interleaved concurrent turns', async () => {
    // Given
    const turns: Array<{ readonly id: number; readonly threadId: string }> = [];
    const harness = createHarness((message, process) => {
      if (respondToHandshake(message, process)) return;
      if (message.method === 'thread/start' && message.id !== undefined) {
        process.send({ id: message.id, result: { thread: { id: `thread-${message.id}` } } });
      }
      if (message.method === 'turn/start' && message.id !== undefined) {
        const params = z.object({ threadId: z.string() }).parse(message.params);
        turns.push({ id: message.id, threadId: params.threadId });
        process.send({ id: message.id, result: { turn: { id: 'turn-shared' } } });
        if (turns.length === 2) {
          for (const turn of turns.toReversed()) {
            process.send({ method: 'item/agentMessage/delta', params: { threadId: turn.threadId, turnId: 'turn-shared', itemId: `item-${turn.id}`, delta: turn.threadId } });
          }
          for (const turn of turns) {
            process.send({ method: 'turn/completed', params: { threadId: turn.threadId, turn: { id: 'turn-shared', status: 'completed', items: [] } } });
          }
        }
      }
    });
    const client = await CodexAppServerClient.create({ dependencies: harness.dependencies });
    const [firstThread, secondThread] = await Promise.all([client.startThread(), client.startThread()]);

    // When
    const [first, second] = await Promise.all([
      client.runTurn({ threadId: firstThread, input: 'first', outputSchema: {} }),
      client.runTurn({ threadId: secondThread, input: 'second', outputSchema: {} }),
    ]);
    await client.close();

    // Then
    expect(first).toBe(firstThread);
    expect(second).toBe(secondThread);
  });

  it.each([
    ['malformed JSONL', (process: FakeAppServerProcess) => process.stdout.write('{bad\n')],
    ['early exit', (process: FakeAppServerProcess) => process.emit('exit', 1, null)],
  ])('rejects and cleans up on %s', async (_caseName, fail) => {
    // Given
    const harness = createHarness((message, process) => {
      if (respondToHandshake(message, process)) return;
      if (message.method === 'thread/start') queueMicrotask(() => fail(process));
    });
    const client = await CodexAppServerClient.create({ dependencies: harness.dependencies });

    // When / Then
    await expect(client.startThread()).rejects.toBeInstanceOf(CodexAppServerTransportError);
    await client.close();
    expect(harness.process.kill).toHaveBeenCalledOnce();
    expect(harness.removeTempDirectory).toHaveBeenCalledOnce();
  });

  it('rejects a correlated protocol error', async () => {
    // Given
    const harness = createHarness((message, process) => {
      if (respondToHandshake(message, process)) return;
      if (message.id !== undefined) {
        process.send({ id: message.id, error: { code: -32001, message: 'overloaded' } });
      }
    });
    const client = await CodexAppServerClient.create({ dependencies: harness.dependencies });

    // When / Then
    await expect(client.startThread()).rejects.toThrow('overloaded');
    await client.close();
  });

  it('removes the temporary directory when spawning throws synchronously', async () => {
    const harness = createHarness(() => undefined);
    const dependencies: AppServerClientDependencies = {
      ...harness.dependencies,
      spawnProcess: () => {
        throw new Error('spawn failed');
      },
    };

    await expect(CodexAppServerClient.create({ dependencies })).rejects.toMatchObject({
      category: 'spawn_error',
    });
    expect(harness.removeTempDirectory).toHaveBeenCalledOnce();
  });

  it('times out pending requests and closes idempotently', async () => {
    // Given
    vi.useFakeTimers();
    const harness = createHarness((message, process) => {
      respondToHandshake(message, process);
    });
    const client = await CodexAppServerClient.create({ timeoutMs: 10, dependencies: harness.dependencies });

    // When
    const pending = client.startThread();
    const rejection = expect(pending).rejects.toBeInstanceOf(CodexAppServerTransportError);
    await vi.advanceTimersByTimeAsync(11);

    // Then
    await rejection;
    await client.close();
    await client.close();
    expect(harness.process.kill).toHaveBeenCalledOnce();
    expect(harness.removeTempDirectory).toHaveBeenCalledOnce();
  });
});
