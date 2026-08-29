/**
 * Token Estimation Utilities
 *
 * Provides token counting and budget management for context optimization.
 * Used to prevent context overflow in large MRs with expanded context.
 */

/**
 * Estimate token count for a given text.
 * Uses ~4 characters per token as a conservative estimate for code.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // ~4 chars per token is conservative for code (actual varies by language)
  return Math.ceil(text.length / 4);
}

/**
 * Token budget allocations for different context categories.
 * Total should leave room for system prompt (~10K) and response (~30K).
 */
export const TOKEN_BUDGETS = {
  /** Maximum total context tokens (leaving room for response) */
  TOTAL_CONTEXT: 80_000,
  /** Budget for diff content (highest priority) */
  DIFFS: 30_000,
  /** Budget for full content of changed files */
  CHANGED_FILES: 30_000,
  /** Budget for related/imported files */
  RELATED_FILES: 15_000,
  /** Budget for project structure tree */
  PROJECT_STRUCTURE: 5_000,
} as const;

/**
 * File priority levels for context selection.
 * Higher priority files are included first when budget is limited.
 */
export const FILE_PRIORITY = {
  /** Files that are part of the MR changes */
  CHANGED: 100,
  /** Direct imports of changed files (1st level) */
  DIRECT_IMPORT: 70,
  /** Transitive imports (2nd level) */
  TRANSITIVE_IMPORT: 40,
  /** Configuration files (.json, .yaml, .toml) */
  CONFIG: 30,
  /** Other related files */
  OTHER: 20,
} as const;

/**
 * Check if a file is a configuration file based on extension.
 */
export function isConfigFile(filePath: string): boolean {
  const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini', '.config', '.env'];
  const lowerPath = filePath.toLowerCase();
  return configExtensions.some((ext) => lowerPath.endsWith(ext));
}

/**
 * Calculate the priority score for a file based on its characteristics.
 *
 * @param filePath - Path to the file
 * @param isChanged - Whether the file is part of MR changes
 * @param importDepth - Import depth (0 = direct import, 1 = transitive, etc.)
 * @returns Priority score (0-100)
 */
export function calculateFilePriority(
  filePath: string,
  isChanged: boolean,
  importDepth: number = -1
): number {
  // Changed files always have highest priority
  if (isChanged) {
    return FILE_PRIORITY.CHANGED;
  }

  // Direct imports (depth 0 or 1)
  if (importDepth === 0 || importDepth === 1) {
    return FILE_PRIORITY.DIRECT_IMPORT;
  }

  // Transitive imports (depth 2+)
  if (importDepth >= 2) {
    return FILE_PRIORITY.TRANSITIVE_IMPORT;
  }

  // Config files get medium priority
  if (isConfigFile(filePath)) {
    return FILE_PRIORITY.CONFIG;
  }

  // Everything else
  return FILE_PRIORITY.OTHER;
}

/**
 * Statistics about context budget usage.
 */
export interface ContextBudgetStats {
  /** Total tokens used */
  totalTokensUsed: number;
  /** Total budget available */
  totalBudget: number;
  /** Percentage of budget used */
  budgetUsedPercent: number;
  /** Number of files included */
  filesIncluded: number;
  /** Number of files excluded due to budget */
  filesExcluded: number;
  /** Paths of excluded files (for debugging) */
  excludedFiles: string[];
  /** Breakdown by category */
  breakdown: {
    diffs: number;
    changedFiles: number;
    relatedFiles: number;
    projectStructure: number;
  };
}

/**
 * Create empty budget stats for initialization.
 */
export function createEmptyBudgetStats(totalBudget: number = TOKEN_BUDGETS.TOTAL_CONTEXT): ContextBudgetStats {
  return {
    totalTokensUsed: 0,
    totalBudget,
    budgetUsedPercent: 0,
    filesIncluded: 0,
    filesExcluded: 0,
    excludedFiles: [],
    breakdown: {
      diffs: 0,
      changedFiles: 0,
      relatedFiles: 0,
      projectStructure: 0,
    },
  };
}
