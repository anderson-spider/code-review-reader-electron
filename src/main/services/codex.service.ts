import type {
  AnalysisSource,
  CodeReview,
  ExpandedContext,
  FileChange,
  MergeRequest,
  ParallelAnalysisOptions,
  RefineCommentResult,
  ReviewComment,
  ReviewProgress,
} from '@shared/types';
import type { ConfigService } from './config.service';
import {
  CodexAppServerClient,
  type CreateAppServerClientOptions,
} from './codex-app-server.client';
import {
  filterReviewChanges,
  parseRefinementOutput,
  parseReviewOutput,
  REFINEMENT_OUTPUT_JSON_SCHEMA,
  REVIEW_OUTPUT_JSON_SCHEMA,
} from './codex-review-contracts';
import { buildRefinementPrompt, buildReviewPrompt } from './codex-review-prompts';
import { logger } from './logger.service';
import {
  SmfsMemoryContextProvider,
  type MemoryContextProvider,
} from './memory-context.provider';

const DEFAULT_SPECIALISTS: readonly Exclude<AnalysisSource, 'general'>[] = [
  'security',
  'performance',
  'architecture',
  'testing',
  'best-practices',
];
const MAX_REFINE_INSTRUCTIONS_LENGTH = 2_000;

export interface CodexAppServerSession {
  startThread(): Promise<string>;
  runTurn(params: {
    readonly threadId: string;
    readonly input: string;
    readonly outputSchema: Readonly<Record<string, unknown>>;
  }): Promise<string>;
  close(): Promise<void>;
}

export type CodexClientFactory = (
  options?: CreateAppServerClientOptions,
) => Promise<CodexAppServerSession>;

type CodexConfig = Pick<ConfigService, 'getActivePromptProfile' | 'getMemorySettings'>;

function emptyReview(): CodeReview {
  return {
    summary: 'No reviewable files found in this MR.',
    comments: [],
    overallAssessment: 'All files were filtered out (tests, generated, binaries, etc.).',
  };
}

export type ProgressCallback = (progress: ReviewProgress) => void;

export class CodexService {
  constructor(
    private readonly configService: CodexConfig,
    private readonly createClient: CodexClientFactory = (options) => CodexAppServerClient.create(options),
    private readonly memoryContextProvider: MemoryContextProvider = new SmfsMemoryContextProvider(),
  ) {}

  async generateReview(
    mr: MergeRequest,
    changes: FileChange[],
    includeTests = false,
    onProgress?: ProgressCallback,
    expandedContext?: ExpandedContext | null,
    memoryContainerTag?: string | null,
  ): Promise<CodeReview> {
    const filteredChanges = this.prepareChanges(changes, includeTests, onProgress);
    if (filteredChanges.length === 0) {
      this.report(onProgress, 'complete', [], changes.length, changes.length, 100, 'Nenhum arquivo para analisar');
      return emptyReview();
    }

    const files = filteredChanges.map((change) => change.new_path);
    this.report(onProgress, 'analyzing', files, changes.length, changes.length - files.length, 15, 'Analisando código com Codex App Server...');
    const memoryContext = await this.retrieveMemory(mr, filteredChanges, memoryContainerTag);
    const review = await this.executeReview(mr, filteredChanges, 'general', expandedContext, undefined, memoryContext);
    this.report(onProgress, 'complete', files, changes.length, changes.length - files.length, 100, 'Análise concluída!');
    return review;
  }

  async generateParallelReview(
    mr: MergeRequest,
    changes: FileChange[],
    includeTests = false,
    onProgress?: ProgressCallback,
    options?: ParallelAnalysisOptions,
    expandedContext?: ExpandedContext | null,
    memoryContainerTag?: string | null,
  ): Promise<CodeReview> {
    const filteredChanges = this.prepareChanges(changes, includeTests, onProgress);
    if (filteredChanges.length === 0) {
      this.report(onProgress, 'complete', [], changes.length, changes.length, 100, 'Nenhum arquivo para analisar');
      return emptyReview();
    }

    const specialists = options?.specialists ?? DEFAULT_SPECIALISTS;
    const files = filteredChanges.map((change) => change.new_path);
    const filteredCount = changes.length - files.length;
    this.report(onProgress, 'preparing', files, changes.length, filteredCount, 10, `Preparando análise paralela com ${specialists.length} especialistas...`);
    this.report(onProgress, 'analyzing', files, changes.length, filteredCount, 15, 'Analisando com especialistas Codex em paralelo...');
    const memoryContext = await this.retrieveMemory(mr, filteredChanges, memoryContainerTag);
    const results = await this.withClient(options?.timeoutPerSpecialist, (client) => Promise.allSettled(
      specialists.map((source) => this.executeReviewWithClient(
        client,
        mr,
        filteredChanges,
        source,
        expandedContext,
        memoryContext,
      )),
    ));
    const reviews = results
      .filter((result): result is PromiseFulfilledResult<CodeReview> => result.status === 'fulfilled')
      .map((result) => result.value);
    if (reviews.length === 0) throw new Error('All Codex specialists failed');

    this.report(onProgress, 'parsing', files, changes.length, filteredCount, 90, 'Consolidando resultados...');
    const comments = this.deduplicateComments(reviews.flatMap((review) => review.comments));
    this.report(onProgress, 'complete', files, changes.length, changes.length - files.length, 100, `Análise paralela concluída! ${comments.length} comentários encontrados.`);
    return {
      summary: `Parallel review of "${mr.title}" completed by ${reviews.length}/${specialists.length} Codex specialists.`,
      comments,
      overallAssessment: reviews.map((review) => review.overallAssessment).join('\n\n'),
    };
  }

  async refineComment(comment: ReviewComment, instructions: string): Promise<RefineCommentResult> {
    const normalizedInstructions = instructions.trim();
    if (normalizedInstructions.length === 0 || normalizedInstructions.length > MAX_REFINE_INSTRUCTIONS_LENGTH) {
      throw new Error(`Refinement instructions must contain between 1 and ${MAX_REFINE_INSTRUCTIONS_LENGTH} characters`);
    }
    const output = await this.withClient(undefined, async (client) => {
      const threadId = await client.startThread();
      return client.runTurn({
        threadId,
        input: buildRefinementPrompt({ comment, instructions: normalizedInstructions }),
        outputSchema: REFINEMENT_OUTPUT_JSON_SCHEMA,
      });
    });
    return parseRefinementOutput(output);
  }

  private prepareChanges(
    changes: readonly FileChange[],
    includeTests: boolean,
    onProgress?: ProgressCallback,
  ): readonly FileChange[] {
    this.report(onProgress, 'filtering', [], changes.length, 0, 5, 'Filtrando arquivos...');
    return filterReviewChanges(changes, includeTests);
  }

  private async executeReview(
    mr: MergeRequest,
    changes: readonly FileChange[],
    source: AnalysisSource,
    expandedContext?: ExpandedContext | null,
    timeoutMs?: number,
    memoryContext?: string | null,
  ): Promise<CodeReview> {
    return this.withClient(timeoutMs, (client) => this.executeReviewWithClient(
      client,
      mr,
      changes,
      source,
      expandedContext,
      memoryContext,
    ));
  }

  private async executeReviewWithClient(
    client: CodexAppServerSession,
    mr: MergeRequest,
    changes: readonly FileChange[],
    source: AnalysisSource,
    expandedContext?: ExpandedContext | null,
    memoryContext?: string | null,
  ): Promise<CodeReview> {
    const profileInstructions = this.configService.getActivePromptProfile().customInstructions;
    const specialistInstructions = source === 'general'
      ? profileInstructions
      : `${profileInstructions}\n\nAct as the ${source} specialist and report only findings in that area.`;
    try {
      const threadId = await client.startThread();
      const output = await client.runTurn({
        threadId,
        input: buildReviewPrompt({ mr, changes, expandedContext, instructions: specialistInstructions, memoryContext }),
        outputSchema: REVIEW_OUTPUT_JSON_SCHEMA,
      });
      return parseReviewOutput(output, source);
    } catch (error) {
      logger.error('codex', `${source} review failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private retrieveMemory(
    mr: MergeRequest,
    changes: readonly FileChange[],
    containerTag?: string | null,
  ): Promise<string | null> {
    return this.memoryContextProvider.retrieve({
      mr,
      changes,
      settings: this.configService.getMemorySettings(),
      containerTag,
    });
  }

  private deduplicateComments(comments: readonly ReviewComment[]): ReviewComment[] {
    const seen = new Set<string>();
    return comments.filter((comment) => {
      const key = `${comment.filePath}:${comment.lineNumber ?? 'null'}:${comment.comment.trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async withClient<T>(timeoutMs: number | undefined, operation: (client: CodexAppServerSession) => Promise<T>): Promise<T> {
    const client = await this.createClient(timeoutMs === undefined ? undefined : { timeoutMs });
    try {
      return await operation(client);
    } finally {
      await client.close();
    }
  }

  private report(
    callback: ProgressCallback | undefined,
    stage: 'filtering' | 'preparing' | 'analyzing' | 'parsing' | 'complete',
    files: string[],
    totalFiles: number,
    filteredCount: number,
    progress: number,
    currentMessage: string,
  ): void {
    callback?.({ stage, files, totalFiles, filteredCount, progress, currentMessage });
  }
}
