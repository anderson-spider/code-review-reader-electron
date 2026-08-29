import type {
  AnalysisSource,
  CodeReview,
  FileChange,
  RefineCommentResult,
} from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const IGNORED_PATTERNS = {
  tests: [
    /.*Test\.kt$/,
    /.*Test\.java$/,
    /.*\.(?:spec|test)\.(?:ts|tsx|js)$/,
    /\/test\//,
    /\/__tests__\//,
  ],
  always: [
    /\/generated\//,
    /\.generated\./,
    /\/(?:build|dist|node_modules)\//,
    /\.lock$/,
    /(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/,
    /\.min\.(?:js|css)$/,
    /\/migrations\//,
  ],
} as const;

const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z', '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.ttf', '.woff', '.woff2', '.eot', '.exe', '.dll', '.so', '.dylib',
  '.class', '.jar', '.war', '.db', '.sqlite', '.pyc', '.pyo',
] as const;

const ReviewCommentOutputSchema = z.object({
  filePath: z.string().min(1),
  lineNumber: z.number().int().positive().nullable(),
  severity: z.enum(['info', 'suggestion', 'warning', 'critical']),
  comment: z.string().min(1),
  codeSnippet: z.string().min(1).nullable(),
}).strict();

export const ReviewOutputSchema = z.object({
  summary: z.string().min(1),
  comments: z.array(ReviewCommentOutputSchema),
  overallAssessment: z.string().min(1),
}).strict();

export const RefinementOutputSchema = z.object({
  refinedComment: z.string().min(1),
  refinedCodeSnippet: z.string().min(1).nullable(),
}).strict();

export class CodexOutputError extends Error {
  readonly name = 'CodexOutputError';

  constructor(readonly category: 'invalid_json' | 'invalid_shape', options?: ErrorOptions) {
    super(`Invalid Codex structured output: ${category}`, options);
  }
}

export const REVIEW_OUTPUT_JSON_SCHEMA = z.toJSONSchema(ReviewOutputSchema);
export const REFINEMENT_OUTPUT_JSON_SCHEMA = z.toJSONSchema(RefinementOutputSchema);

function shouldIgnoreFile(filePath: string, includeTests: boolean): boolean {
  const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  if (BINARY_EXTENSIONS.some((binaryExtension) => binaryExtension === extension)) {
    return true;
  }
  if (IGNORED_PATTERNS.always.some((pattern) => pattern.test(filePath))) {
    return true;
  }
  return !includeTests && IGNORED_PATTERNS.tests.some((pattern) => pattern.test(filePath));
}

export function filterReviewChanges(changes: readonly FileChange[], includeTests: boolean): readonly FileChange[] {
  return changes.filter((change) => !shouldIgnoreFile(change.new_path, includeTests));
}

export function numberDiffLines(diff: string): string {
  const result: string[] = [];
  let currentNewLine = 0;
  let inHunk = false;

  for (const line of diff.split('\n')) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch?.[1]) {
      currentNewLine = Number.parseInt(hunkMatch[1], 10);
      inHunk = true;
      result.push(line);
    } else if (!inHunk) {
      result.push(line);
    } else if (line.startsWith('-')) {
      result.push(`[DEL]${line.substring(1)}`);
    } else {
      result.push(`${currentNewLine}: ${line.startsWith('+') ? line.substring(1) : line}`);
      currentNewLine += 1;
    }
  }
  return result.join('\n');
}

function parseJson(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new CodexOutputError('invalid_json', { cause: error });
  }
}

export function parseReviewOutput(output: string, source: AnalysisSource): CodeReview {
  const parsed = ReviewOutputSchema.safeParse(parseJson(output));
  if (!parsed.success) {
    throw new CodexOutputError('invalid_shape', { cause: parsed.error });
  }

  return {
    summary: parsed.data.summary,
    comments: parsed.data.comments.map((comment) => ({
      id: uuidv4(),
      filePath: comment.filePath,
      lineNumber: comment.lineNumber,
      severity: comment.severity,
      comment: comment.comment,
      analysisSource: source,
      ...(comment.codeSnippet === null ? {} : { codeSnippet: comment.codeSnippet }),
    })),
    overallAssessment: parsed.data.overallAssessment,
  };
}

export function parseRefinementOutput(output: string): RefineCommentResult {
  const parsed = RefinementOutputSchema.safeParse(parseJson(output));
  if (!parsed.success) {
    throw new CodexOutputError('invalid_shape', { cause: parsed.error });
  }
  return {
    refinedComment: parsed.data.refinedComment,
    ...(parsed.data.refinedCodeSnippet === null
      ? {}
      : { refinedCodeSnippet: parsed.data.refinedCodeSnippet }),
  };
}
