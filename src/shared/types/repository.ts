// -----------------------------------------------------------------------------
// Local Repository Checkout Types
// -----------------------------------------------------------------------------

/** Stage of repository checkout operation */
export type RepositoryStage = 'cloning' | 'reading' | 'building-context' | 'complete' | 'error';

/** Progress updates for repository operations */
export interface RepositoryProgress {
  stage: RepositoryStage;
  progress: number; // 0-100
  message: string;
}

/** File with full content for expanded context */
export interface FileWithContent {
  /** Relative path to the file */
  path: string;
  /** Full file content */
  content: string;
  /** Whether this file is part of the MR changes */
  isChanged: boolean;
  /** Priority score for context selection (0-100, higher = more important) */
  priority?: number;
  /** Estimated token count for this file's content */
  estimatedTokens?: number;
  /** Import depth from changed files (0 = direct import, 1 = transitive, etc.) */
  importDepth?: number;
}

/** Project structure summary */
export interface ProjectStructure {
  /** Relevant directories */
  directories: string[];
  /** Total file count */
  fileCount: number;
  /** Brief tree structure (limited depth) */
  tree: string;
}

/** Expanded context from local checkout for review analysis */
export interface ExpandedContext {
  /** Changed files with full content (not just diffs) */
  changedFiles: FileWithContent[];
  /** Related files (imports, dependencies) */
  relatedFiles: FileWithContent[];
  /** Project structure overview */
  projectStructure: ProjectStructure;
  /** Path to the cloned repository (for cleanup) */
  repoPath: string;
  /** Statistics about token budget usage (optional, for debugging/transparency) */
  budgetStats?: ExpandedContextStats;
}

/** Statistics about context budget usage for transparency and debugging */
export interface ExpandedContextStats {
  /** Total tokens used across all context */
  totalTokensUsed: number;
  /** Total budget available */
  totalBudget: number;
  /** Percentage of budget used (0-100) */
  budgetUsedPercent: number;
  /** Number of files included in context */
  filesIncluded: number;
  /** Number of files excluded due to budget constraints */
  filesExcluded: number;
  /** Paths of excluded files (for debugging) */
  excludedFiles: string[];
  /** Token breakdown by category */
  breakdown: {
    /** Tokens used by diff content */
    diffs: number;
    /** Tokens used by changed file content */
    changedFiles: number;
    /** Tokens used by related file content */
    relatedFiles: number;
    /** Tokens used by project structure */
    projectStructure: number;
  };
}

/** Options for local checkout review */
export interface LocalCheckoutOptions {
  /** Enable local checkout for expanded context */
  enabled: boolean;
  /** Maximum depth for reading related files (default: 2) */
  maxRelatedDepth?: number;
  /** Maximum file size to read in bytes (default: 100KB) */
  maxFileSize?: number;
  /** Token budget for context (default: 80000, undefined = no limit) */
  tokenBudget?: number;
}
