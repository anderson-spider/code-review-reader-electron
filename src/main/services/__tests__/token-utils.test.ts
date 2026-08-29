import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  TOKEN_BUDGETS,
  FILE_PRIORITY,
  isConfigFile,
  calculateFilePriority,
  createEmptyBudgetStats,
} from '../token-utils';

describe('token-utils', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(estimateTokens(null as unknown as string)).toBe(0);
      expect(estimateTokens(undefined as unknown as string)).toBe(0);
    });

    it('should estimate ~4 chars per token', () => {
      // 100 chars should be ~25 tokens
      const text = 'a'.repeat(100);
      expect(estimateTokens(text)).toBe(25);
    });

    it('should round up fractional tokens', () => {
      // 10 chars = 2.5 tokens, should round to 3
      const text = 'a'.repeat(10);
      expect(estimateTokens(text)).toBe(3);
    });

    it('should handle typical code snippet', () => {
      const code = `function hello(name: string): string {
  return \`Hello, \${name}!\`;
}`;
      // ~68 chars = ~17 tokens
      expect(estimateTokens(code)).toBe(Math.ceil(code.length / 4));
    });

    it('should handle large content', () => {
      const largeContent = 'x'.repeat(100_000);
      expect(estimateTokens(largeContent)).toBe(25_000);
    });
  });

  describe('TOKEN_BUDGETS', () => {
    it('should have correct total context budget', () => {
      expect(TOKEN_BUDGETS.TOTAL_CONTEXT).toBe(80_000);
    });

    it('should have budgets that sum to less than total', () => {
      const sum =
        TOKEN_BUDGETS.DIFFS +
        TOKEN_BUDGETS.CHANGED_FILES +
        TOKEN_BUDGETS.RELATED_FILES +
        TOKEN_BUDGETS.PROJECT_STRUCTURE;
      expect(sum).toBe(80_000);
      expect(sum).toBeLessThanOrEqual(TOKEN_BUDGETS.TOTAL_CONTEXT);
    });

    it('should prioritize diffs and changed files', () => {
      expect(TOKEN_BUDGETS.DIFFS).toBeGreaterThanOrEqual(TOKEN_BUDGETS.RELATED_FILES);
      expect(TOKEN_BUDGETS.CHANGED_FILES).toBeGreaterThanOrEqual(TOKEN_BUDGETS.RELATED_FILES);
    });
  });

  describe('FILE_PRIORITY', () => {
    it('should have changed files as highest priority', () => {
      expect(FILE_PRIORITY.CHANGED).toBe(100);
    });

    it('should have descending priority order', () => {
      expect(FILE_PRIORITY.CHANGED).toBeGreaterThan(FILE_PRIORITY.DIRECT_IMPORT);
      expect(FILE_PRIORITY.DIRECT_IMPORT).toBeGreaterThan(FILE_PRIORITY.TRANSITIVE_IMPORT);
      expect(FILE_PRIORITY.TRANSITIVE_IMPORT).toBeGreaterThan(FILE_PRIORITY.CONFIG);
      expect(FILE_PRIORITY.CONFIG).toBeGreaterThan(FILE_PRIORITY.OTHER);
    });
  });

  describe('isConfigFile', () => {
    it('should identify JSON files', () => {
      expect(isConfigFile('package.json')).toBe(true);
      expect(isConfigFile('tsconfig.json')).toBe(true);
    });

    it('should identify YAML files', () => {
      expect(isConfigFile('config.yaml')).toBe(true);
      expect(isConfigFile('config.yml')).toBe(true);
    });

    it('should identify TOML files', () => {
      expect(isConfigFile('Cargo.toml')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isConfigFile('CONFIG.JSON')).toBe(true);
      expect(isConfigFile('Settings.YAML')).toBe(true);
    });

    it('should not match source files', () => {
      expect(isConfigFile('index.ts')).toBe(false);
      expect(isConfigFile('App.tsx')).toBe(false);
      expect(isConfigFile('main.py')).toBe(false);
    });

    it('should handle paths with directories', () => {
      expect(isConfigFile('src/config/settings.json')).toBe(true);
      expect(isConfigFile('.github/workflows/ci.yaml')).toBe(true);
    });
  });

  describe('calculateFilePriority', () => {
    it('should return CHANGED priority for changed files', () => {
      expect(calculateFilePriority('src/index.ts', true, -1)).toBe(FILE_PRIORITY.CHANGED);
      expect(calculateFilePriority('config.json', true, 0)).toBe(FILE_PRIORITY.CHANGED);
    });

    it('should return DIRECT_IMPORT for depth 0 or 1', () => {
      expect(calculateFilePriority('src/utils.ts', false, 0)).toBe(FILE_PRIORITY.DIRECT_IMPORT);
      expect(calculateFilePriority('src/helpers.ts', false, 1)).toBe(FILE_PRIORITY.DIRECT_IMPORT);
    });

    it('should return TRANSITIVE_IMPORT for depth 2+', () => {
      expect(calculateFilePriority('src/deep.ts', false, 2)).toBe(FILE_PRIORITY.TRANSITIVE_IMPORT);
      expect(calculateFilePriority('src/deeper.ts', false, 3)).toBe(FILE_PRIORITY.TRANSITIVE_IMPORT);
    });

    it('should return CONFIG for config files without import depth', () => {
      expect(calculateFilePriority('tsconfig.json', false, -1)).toBe(FILE_PRIORITY.CONFIG);
      expect(calculateFilePriority('config.yaml', false, -1)).toBe(FILE_PRIORITY.CONFIG);
    });

    it('should return OTHER for unrelated files', () => {
      expect(calculateFilePriority('random.ts', false, -1)).toBe(FILE_PRIORITY.OTHER);
      expect(calculateFilePriority('docs/readme.md', false, -1)).toBe(FILE_PRIORITY.OTHER);
    });

    it('should prioritize changed status over everything else', () => {
      // Even config files get CHANGED priority if they're changed
      expect(calculateFilePriority('package.json', true, -1)).toBe(FILE_PRIORITY.CHANGED);
    });
  });

  describe('createEmptyBudgetStats', () => {
    it('should create stats with default budget', () => {
      const stats = createEmptyBudgetStats();
      expect(stats.totalBudget).toBe(TOKEN_BUDGETS.TOTAL_CONTEXT);
      expect(stats.totalTokensUsed).toBe(0);
      expect(stats.budgetUsedPercent).toBe(0);
      expect(stats.filesIncluded).toBe(0);
      expect(stats.filesExcluded).toBe(0);
      expect(stats.excludedFiles).toEqual([]);
    });

    it('should create stats with custom budget', () => {
      const stats = createEmptyBudgetStats(50_000);
      expect(stats.totalBudget).toBe(50_000);
    });

    it('should have zero breakdown values', () => {
      const stats = createEmptyBudgetStats();
      expect(stats.breakdown.diffs).toBe(0);
      expect(stats.breakdown.changedFiles).toBe(0);
      expect(stats.breakdown.relatedFiles).toBe(0);
      expect(stats.breakdown.projectStructure).toBe(0);
    });
  });
});
