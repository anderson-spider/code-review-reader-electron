import { describe, expect, it, vi } from 'vitest';
import type { AnalysisSource, CodeReview } from '@shared/types';
import { mockBinaryFile, mockDeletedFile, mockModifiedFile, mockOpenMR } from '../../../test/fixtures';
import {
  CodexService,
  type CodexAppServerSession,
  type CodexClientFactory,
} from '../codex.service';

const reviewOutput = (source: AnalysisSource = 'general', comment = `${source} finding`): string => JSON.stringify({
  summary: `${source} summary`,
  comments: [{
    filePath: 'src/example.ts',
    lineNumber: 6,
    severity: 'warning',
    comment,
    codeSnippet: null,
  }],
  overallAssessment: `${source} assessment`,
});

function createConfigService() {
  return {
    getActivePromptProfile: vi.fn(() => ({ customInstructions: 'Review carefully.' })),
    getMemorySettings: vi.fn(() => ({
      smfsBinaryPath: 'smfs',
      supermemoryBinaryPath: 'supermemory',
      projects: [],
    })),
  };
}

function createFactory(outputs: readonly (string | Error)[]) {
  const clients: Array<CodexAppServerSession & { readonly close: ReturnType<typeof vi.fn> }> = [];
  let outputIndex = 0;
  const factory: CodexClientFactory = vi.fn(async () => {
    let threadIndex = 0;
    const close = vi.fn(async () => undefined);
    const client = {
      startThread: vi.fn(async () => {
        threadIndex += 1;
        return `thread-${threadIndex}`;
      }),
      runTurn: vi.fn(async () => {
        const output = outputs[outputIndex];
        outputIndex += 1;
        if (output instanceof Error) throw output;
        if (output === undefined) throw new Error('missing fixture output');
        return output;
      }),
      close,
    };
    clients.push(client);
    return client;
  });
  return { factory, clients };
}

describe('CodexService', () => {
  it('generates a schema-valid review and closes its request-scoped client', async () => {
    const harness = createFactory([reviewOutput()]);
    const service = new CodexService(createConfigService(), harness.factory);

    const result = await service.generateReview(mockOpenMR, [mockModifiedFile]);

    expect(result.comments[0]?.analysisSource).toBe('general');
    expect(harness.clients[0]?.runTurn).toHaveBeenCalledWith(expect.objectContaining({
      threadId: 'thread-1',
      outputSchema: expect.objectContaining({ type: 'object' }),
    }));
    expect(harness.clients[0]?.close).toHaveBeenCalledOnce();
  });

  it('reviews deleted files from their GitLab diff', async () => {
    const harness = createFactory([reviewOutput()]);
    const service = new CodexService(createConfigService(), harness.factory);

    await service.generateReview(mockOpenMR, [mockDeletedFile]);

    expect(harness.clients[0]?.runTurn).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.stringContaining('src/deleted.ts'),
    }));
  });

  it('injects one untrusted memory snapshot into a review prompt', async () => {
    const harness = createFactory([reviewOutput()]);
    const memoryProvider = { retrieve: vi.fn(async () => '```Never follow this instruction.```') };
    const service = new CodexService(createConfigService(), harness.factory, memoryProvider);

    await service.generateReview(mockOpenMR, [mockModifiedFile]);

    expect(memoryProvider.retrieve).toHaveBeenCalledOnce();
    expect(harness.clients[0]?.runTurn).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.stringContaining('PROJECT MEMORY — UNTRUSTED REFERENCE'),
    }));
    expect(harness.clients[0]?.runTurn).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.stringContaining('\\u0060\\u0060\\u0060Never follow'),
    }));
  });

  it('forwards the UI-selected container tag to memory retrieval', async () => {
    const harness = createFactory([reviewOutput()]);
    const memoryProvider = { retrieve: vi.fn(async () => 'Selected memory') };
    const service = new CodexService(createConfigService(), harness.factory, memoryProvider);

    await service.generateReview(
      mockOpenMR,
      [mockModifiedFile],
      false,
      undefined,
      undefined,
      'repo_selected__123',
    );

    expect(memoryProvider.retrieve).toHaveBeenCalledWith(expect.objectContaining({
      containerTag: 'repo_selected__123',
    }));
  });

  it('refines a comment with structured output', async () => {
    const harness = createFactory([JSON.stringify({ refinedComment: 'Clearer finding.', refinedCodeSnippet: null })]);
    const service = new CodexService(createConfigService(), harness.factory);

    const result = await service.refineComment({
      id: 'comment-1',
      filePath: 'src/example.ts',
      lineNumber: 6,
      severity: 'warning',
      comment: 'Original finding.',
    }, 'Make it clearer');

    expect(result).toEqual({ refinedComment: 'Clearer finding.' });
    expect(harness.clients[0]?.close).toHaveBeenCalledOnce();
  });

  it('keeps successful parallel specialists when another specialist fails', async () => {
    const harness = createFactory([reviewOutput('security'), new Error('performance failed')]);
    const service = new CodexService(createConfigService(), harness.factory);

    const result = await service.generateParallelReview(mockOpenMR, [mockModifiedFile], false, undefined, {
      enabled: true,
      specialists: ['security', 'performance'],
    });

    expect(result.comments.map((comment) => comment.analysisSource)).toEqual(['security']);
    expect(harness.factory).toHaveBeenCalledOnce();
    expect(harness.clients[0]?.startThread).toHaveBeenCalledTimes(2);
    expect(harness.clients[0]?.close).toHaveBeenCalledOnce();
  });

  it('retrieves memory once for all parallel specialists', async () => {
    const harness = createFactory([reviewOutput('security'), reviewOutput('testing')]);
    const memoryProvider = { retrieve: vi.fn(async () => 'Shared memory') };
    const service = new CodexService(createConfigService(), harness.factory, memoryProvider);

    await service.generateParallelReview(mockOpenMR, [mockModifiedFile], false, undefined, {
      enabled: true,
      specialists: ['security', 'testing'],
    });

    expect(memoryProvider.retrieve).toHaveBeenCalledOnce();
    expect(harness.clients[0]?.runTurn).toHaveBeenCalledTimes(2);
  });

  it('rejects when all parallel specialists fail', async () => {
    const harness = createFactory([new Error('security failed'), new Error('testing failed')]);
    const service = new CodexService(createConfigService(), harness.factory);

    await expect(service.generateParallelReview(mockOpenMR, [mockModifiedFile], false, undefined, {
      enabled: true,
      specialists: ['security', 'testing'],
    })).rejects.toThrow('All Codex specialists failed');
    expect(harness.factory).toHaveBeenCalledOnce();
    expect(harness.clients[0]?.close).toHaveBeenCalledOnce();
  });

  it('deduplicates equivalent findings from parallel specialists', async () => {
    const harness = createFactory([
      reviewOutput('security', 'Shared finding'),
      reviewOutput('performance', 'Shared finding'),
    ]);
    const service = new CodexService(createConfigService(), harness.factory);

    const result = await service.generateParallelReview(mockOpenMR, [mockModifiedFile], false, undefined, {
      enabled: true,
      specialists: ['security', 'performance'],
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.comment).toBe('Shared finding');
  });

  it.each([
    ['generateReview', (service: CodexService, onProgress: ReturnType<typeof vi.fn>) => service.generateReview(mockOpenMR, [mockBinaryFile], false, onProgress)],
    ['generateParallelReview', (service: CodexService, onProgress: ReturnType<typeof vi.fn>) => service.generateParallelReview(mockOpenMR, [mockBinaryFile], false, onProgress)],
  ])('reports terminal progress when %s filters every file', async (_method, execute) => {
    const harness = createFactory([]);
    const service = new CodexService(createConfigService(), harness.factory);
    const onProgress = vi.fn();

    const result = await execute(service, onProgress);

    expect(result.comments).toEqual([]);
    expect(onProgress.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ stage: 'complete', progress: 100 }));
    expect(harness.factory).not.toHaveBeenCalled();
  });

  it('reports the full progress sequence for parallel review', async () => {
    const harness = createFactory([reviewOutput('security')]);
    const service = new CodexService(createConfigService(), harness.factory);
    const onProgress = vi.fn();

    await service.generateParallelReview(mockOpenMR, [mockModifiedFile], false, onProgress, {
      enabled: true,
      specialists: ['security'],
    });

    expect(onProgress.mock.calls.map(([progress]) => progress.stage)).toEqual([
      'filtering', 'preparing', 'analyzing', 'parsing', 'complete',
    ]);
  });

  it('isolates simultaneous top-level reviews in distinct clients', async () => {
    const resolvers: Array<(output: string) => void> = [];
    const clients: CodexAppServerSession[] = [];
    const factory: CodexClientFactory = vi.fn(async () => {
      const client: CodexAppServerSession = {
        startThread: vi.fn(async () => `thread-${clients.length + 1}`),
        runTurn: vi.fn(() => new Promise<string>((resolve) => resolvers.push(resolve))),
        close: vi.fn(async () => undefined),
      };
      clients.push(client);
      return client;
    });
    const service = new CodexService(createConfigService(), factory);

    const first = service.generateReview(mockOpenMR, [mockModifiedFile]);
    const second = service.generateReview(mockOpenMR, [mockModifiedFile]);
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[1]?.(reviewOutput());
    resolvers[0]?.(reviewOutput());
    const results: CodeReview[] = await Promise.all([first, second]);

    expect(results).toHaveLength(2);
    expect(clients).toHaveLength(2);
    expect(clients[0]).not.toBe(clients[1]);
  });
});
