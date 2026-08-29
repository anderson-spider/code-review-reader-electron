import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import { CodexAppServerTransportError } from './codex-app-server.errors';
import {
  parseAppServerMessage,
  ThreadStartResultSchema,
  TurnStartResultSchema,
  type AppServerMessage,
} from './codex-app-server.protocol';
import {
  defaultAppServerClientDependencies,
  type AppServerClientDependencies,
  type AppServerProcess,
  type CreateAppServerClientOptions,
} from './codex-app-server.process';
import type { PendingRequest, TurnState } from './codex-app-server.state';

export type {
  AppServerClientDependencies,
  AppServerProcess,
  CreateAppServerClientOptions,
} from './codex-app-server.process';
export { CodexAppServerTransportError } from './codex-app-server.errors';

export class CodexAppServerClient {
  static async create(options: CreateAppServerClientOptions = {}): Promise<CodexAppServerClient> {
    const dependencies = options.dependencies ?? defaultAppServerClientDependencies;
    const workingDirectory = await dependencies.createTempDirectory();
    let process: AppServerProcess;
    try {
      process = dependencies.spawnProcess(
        options.codexBinary ?? 'codex',
        ['app-server', '--disable', 'hooks', '--listen', 'stdio://'],
        workingDirectory,
      );
    } catch (error) {
      await dependencies.removeTempDirectory(workingDirectory);
      throw new CodexAppServerTransportError('spawn_error', { cause: error });
    }
    const client = new CodexAppServerClient(
      process,
      dependencies,
      workingDirectory,
      options.timeoutMs ?? 120_000,
    );
    try {
      await client.initialize();
      return client;
    } catch (error) {
      await client.close();
      throw error;
    }
  }

  private nextRequestId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly turns = new Map<string, TurnState>();
  private readonly lines: ReadlineInterface;
  private closePromise: Promise<void> | null = null;
  private closed = false;

  private constructor(
    private readonly process: AppServerProcess,
    private readonly dependencies: AppServerClientDependencies,
    readonly workingDirectory: string,
    private readonly timeoutMs: number,
  ) {
    this.lines = createInterface({ input: process.stdout });
    this.lines.on('line', (line) => this.handleLine(line));
    process.stderr.on('data', () => undefined);
    process.once('error', (error) => this.fail(new CodexAppServerTransportError('spawn_error', { cause: error })));
    process.once('exit', (code, signal) => {
      if (!this.closed) {
        this.fail(new CodexAppServerTransportError('early_exit', { details: { code, signal } }));
      }
    });
  }

  private async initialize(): Promise<void> {
    await this.request('initialize', {
      clientInfo: {
        name: 'code_review_reader',
        title: 'Code Review Reader',
        version: '1.3.0',
      },
      capabilities: null,
    });
    this.send({ method: 'initialized', params: {} });
  }

  async startThread(): Promise<string> {
    const result = ThreadStartResultSchema.safeParse(await this.request('thread/start', {
      cwd: this.workingDirectory,
      approvalPolicy: 'never',
      sandboxPolicy: { type: 'readOnly' },
    }));
    if (!result.success) {
      throw new CodexAppServerTransportError('protocol_mismatch', { cause: result.error });
    }
    return result.data.thread.id;
  }

  async runTurn(params: {
    readonly threadId: string;
    readonly input: string;
    readonly outputSchema: Readonly<Record<string, unknown>>;
  }): Promise<string> {
    const result = TurnStartResultSchema.safeParse(await this.request('turn/start', {
      threadId: params.threadId,
      input: [{ type: 'text', text: params.input }],
      cwd: this.workingDirectory,
      approvalPolicy: 'never',
      sandboxPolicy: { type: 'readOnly' },
      outputSchema: params.outputSchema,
    }));
    if (!result.success) {
      throw new CodexAppServerTransportError('protocol_mismatch', { cause: result.error });
    }
    return this.waitForTurn(params.threadId, result.data.turn.id);
  }

  close(): Promise<void> {
    this.closePromise ??= this.performClose();
    return this.closePromise;
  }

  private async performClose(): Promise<void> {
    this.closed = true;
    const error = new CodexAppServerTransportError('closed');
    this.rejectAll(error);
    this.lines.close();
    this.process.kill('SIGTERM');
    await this.dependencies.removeTempDirectory(this.workingDirectory);
  }

  private request(method: string, params: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>> {
    if (this.closed) return Promise.reject(new CodexAppServerTransportError('closed'));
    const id = this.nextRequestId;
    this.nextRequestId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const error = new CodexAppServerTransportError('timeout');
        reject(error);
        void this.close();
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }

  private send(message: Readonly<Record<string, unknown>>): void {
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    try {
      this.handleMessage(parseAppServerMessage(line));
    } catch (error) {
      this.fail(new CodexAppServerTransportError('malformed_jsonl', { cause: error }));
    }
  }

  private handleMessage(message: AppServerMessage): void {
    switch (message.kind) {
      case 'response':
        this.resolveRequest(message.id, message.result);
        return;
      case 'error_response':
        this.rejectRequest(message.id, new CodexAppServerTransportError('server_error', {
          details: { code: message.code, message: message.message },
        }));
        return;
      case 'agent_message_delta':
        this.getTurn(message.threadId, message.turnId).deltas.push(message.delta);
        return;
      case 'item_completed': {
        const turn = this.getTurn(message.threadId, message.turnId);
        if (message.item.type === 'agentMessage' && message.item.text !== undefined) {
          turn.completedText = message.item.text;
        }
        return;
      }
      case 'turn_completed':
        this.completeTurn(message);
        return;
      case 'ignored_notification':
        return;
    }
  }

  private resolveRequest(id: string | number, result: Readonly<Record<string, unknown>>): void {
    if (typeof id !== 'number') return this.fail(new CodexAppServerTransportError('protocol_mismatch'));
    const pending = this.pending.get(id);
    if (!pending) return this.fail(new CodexAppServerTransportError('unknown_request'));
    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.resolve(result);
  }

  private rejectRequest(id: string | number, error: Error): void {
    if (typeof id !== 'number') return this.fail(new CodexAppServerTransportError('protocol_mismatch'));
    const pending = this.pending.get(id);
    if (!pending) return this.fail(new CodexAppServerTransportError('unknown_request'));
    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.reject(error);
  }

  private getTurn(threadId: string, turnId: string): TurnState {
    const key = `${threadId}:${turnId}`;
    const existing = this.turns.get(key);
    if (existing) return existing;
    const created: TurnState = { threadId, turnId, deltas: [] };
    this.turns.set(key, created);
    return created;
  }

  private waitForTurn(threadId: string, turnId: string): Promise<string> {
    const turn = this.getTurn(threadId, turnId);
    if (turn.threadId !== threadId) return Promise.reject(new CodexAppServerTransportError('correlation_error'));
    if (turn.outcome?.kind === 'failed') return Promise.reject(turn.outcome.error);
    if (turn.outcome?.kind === 'completed') return this.readTurnText(turn);
    return new Promise((resolve, reject) => {
      turn.waiter = { resolve, reject };
      turn.timer = setTimeout(() => {
        const error = new CodexAppServerTransportError('timeout');
        reject(error);
        void this.close();
      }, this.timeoutMs);
    });
  }

  private completeTurn(message: Extract<AppServerMessage, { readonly kind: 'turn_completed' }>): void {
    const turn = this.getTurn(message.threadId, message.turn.id);
    if (turn.timer) clearTimeout(turn.timer);
    if (message.turn.status === 'completed') {
      turn.outcome = { kind: 'completed' };
      this.readTurnText(turn).then(turn.waiter?.resolve, turn.waiter?.reject);
    } else {
      const error = new CodexAppServerTransportError(`turn_${message.turn.status}`);
      turn.outcome = { kind: 'failed', error };
      turn.waiter?.reject(error);
    }
  }

  private readTurnText(turn: TurnState): Promise<string> {
    const text = turn.completedText ?? turn.deltas.join('');
    return text.length > 0
      ? Promise.resolve(text)
      : Promise.reject(new CodexAppServerTransportError('empty_agent_message'));
  }

  private fail(error: Error): void {
    this.rejectAll(error);
    void this.close();
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    for (const turn of this.turns.values()) {
      if (turn.timer) clearTimeout(turn.timer);
      turn.waiter?.reject(error);
    }
  }
}
