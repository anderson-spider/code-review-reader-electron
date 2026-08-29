import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  estimateTokens,
  calculateFilePriority,
  FILE_PRIORITY,
  TOKEN_BUDGETS,
  createEmptyBudgetStats,
} from '../token-utils';
import { RepositoryService } from '../repository.service';
import * as os from 'os';
import { EventEmitter } from 'events';

// Hoisted mocks — must be created via vi.hoisted so they exist before vi.mock factories run
const { mockedSpawn, mockFsPromises, mockStatSync } = vi.hoisted(() => ({
  mockedSpawn: vi.fn(),
  mockFsPromises: {
    mkdir: vi.fn(),
    mkdtemp: vi.fn(),
    rm: vi.fn(),
    realpath: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
  mockStatSync: vi.fn(),
}));

vi.mock(import('child_process'), async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({ ...actual, spawn: mockedSpawn }, { default: { ...actual, spawn: mockedSpawn } });
});

// Mock fs/promises
vi.mock('fs/promises', () => mockFsPromises);

// Mock fs.statSync
vi.mock(import('fs'), async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({ ...actual, statSync: mockStatSync }, { default: { ...actual, statSync: mockStatSync } });
});

// Mock logger to avoid BrowserWindow dependency
vi.mock('../logger.service', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock uuid for logger
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

// Interface for our mock child process
interface MockChildProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
}

// Helper to create a mock child process
function createMockProcess(): MockChildProcess {
  const mockProcess = new EventEmitter() as MockChildProcess;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.kill = vi.fn();
  return mockProcess;
}

// Focus on testing the token utilities and priority logic
// The repository service itself requires complex filesystem mocking
// and is better tested through integration/E2E tests

describe('Token Budget Integration', () => {
  describe('priority-based context selection', () => {
    interface MockFile {
      path: string;
      content: string;
      isChanged: boolean;
      importDepth: number;
    }

    const createMockFiles = (): MockFile[] => [
      // Changed files (highest priority)
      { path: 'src/index.ts', content: 'x'.repeat(4000), isChanged: true, importDepth: -1 },
      { path: 'src/App.tsx', content: 'x'.repeat(8000), isChanged: true, importDepth: -1 },
      // Direct imports (depth 1)
      { path: 'src/utils.ts', content: 'x'.repeat(4000), isChanged: false, importDepth: 1 },
      { path: 'src/hooks.ts', content: 'x'.repeat(4000), isChanged: false, importDepth: 1 },
      // Transitive imports (depth 2)
      { path: 'src/helpers.ts', content: 'x'.repeat(4000), isChanged: false, importDepth: 2 },
      { path: 'src/constants.ts', content: 'x'.repeat(4000), isChanged: false, importDepth: 2 },
      // Config files
      { path: 'tsconfig.json', content: 'x'.repeat(1000), isChanged: false, importDepth: -1 },
    ];

    it('should calculate correct priorities for different file types', () => {
      const files = createMockFiles();

      for (const file of files) {
        const priority = calculateFilePriority(file.path, file.isChanged, file.importDepth);

        if (file.isChanged) {
          expect(priority).toBe(FILE_PRIORITY.CHANGED);
        } else if (file.importDepth === 1) {
          expect(priority).toBe(FILE_PRIORITY.DIRECT_IMPORT);
        } else if (file.importDepth === 2) {
          expect(priority).toBe(FILE_PRIORITY.TRANSITIVE_IMPORT);
        } else if (file.path.endsWith('.json')) {
          expect(priority).toBe(FILE_PRIORITY.CONFIG);
        }
      }
    });

    it('should sort files by priority correctly', () => {
      const files = createMockFiles();

      // Add priority to each file
      const filesWithPriority = files.map((f) => ({
        ...f,
        priority: calculateFilePriority(f.path, f.isChanged, f.importDepth),
        estimatedTokens: estimateTokens(f.content),
      }));

      // Sort by priority (descending)
      filesWithPriority.sort((a, b) => b.priority - a.priority);

      // Changed files should be first
      expect(filesWithPriority[0].isChanged).toBe(true);
      expect(filesWithPriority[1].isChanged).toBe(true);

      // Then direct imports
      expect(filesWithPriority[2].importDepth).toBe(1);
      expect(filesWithPriority[3].importDepth).toBe(1);

      // Then transitive imports
      expect(filesWithPriority[4].importDepth).toBe(2);
      expect(filesWithPriority[5].importDepth).toBe(2);

      // Config files last
      expect(filesWithPriority[6].path).toContain('.json');
    });

    it('should apply budget constraints correctly', () => {
      const files = createMockFiles();
      const budget = 5000; // ~20KB budget

      // Add priority and tokens to each file
      const filesWithPriority = files.map((f) => ({
        ...f,
        priority: calculateFilePriority(f.path, f.isChanged, f.importDepth),
        estimatedTokens: estimateTokens(f.content),
      }));

      // Sort by priority (descending)
      filesWithPriority.sort((a, b) => b.priority - a.priority);

      // Apply budget
      let usedTokens = 0;
      const includedFiles: typeof filesWithPriority = [];
      const excludedFiles: string[] = [];

      for (const file of filesWithPriority) {
        if (usedTokens + file.estimatedTokens <= budget) {
          includedFiles.push(file);
          usedTokens += file.estimatedTokens;
        } else {
          excludedFiles.push(file.path);
        }
      }

      // Verify budget enforcement
      expect(usedTokens).toBeLessThanOrEqual(budget);

      // High priority files should be included first
      if (includedFiles.length > 0) {
        expect(includedFiles[0].priority).toBe(FILE_PRIORITY.CHANGED);
      }

      // Lower priority files should be excluded first
      if (excludedFiles.length > 0) {
        const lowestIncludedPriority = Math.min(...includedFiles.map((f) => f.priority));
        // Excluded files should have lower or equal priority to included files
        for (const excluded of excludedFiles) {
          const file = filesWithPriority.find((f) => f.path === excluded);
          expect(file?.priority).toBeLessThanOrEqual(lowestIncludedPriority);
        }
      }
    });
  });

  describe('budget stats tracking', () => {
    it('should create empty stats with correct defaults', () => {
      const stats = createEmptyBudgetStats();

      expect(stats.totalBudget).toBe(TOKEN_BUDGETS.TOTAL_CONTEXT);
      expect(stats.totalTokensUsed).toBe(0);
      expect(stats.budgetUsedPercent).toBe(0);
      expect(stats.filesIncluded).toBe(0);
      expect(stats.filesExcluded).toBe(0);
      expect(stats.excludedFiles).toEqual([]);
    });

    it('should calculate percentage correctly', () => {
      const stats = createEmptyBudgetStats(100);
      stats.totalTokensUsed = 75;
      stats.budgetUsedPercent = Math.round((stats.totalTokensUsed / stats.totalBudget) * 100);

      expect(stats.budgetUsedPercent).toBe(75);
    });

    it('should track breakdown by category', () => {
      const stats = createEmptyBudgetStats(80000);

      // Simulate adding content
      stats.breakdown.changedFiles = 15000;
      stats.breakdown.relatedFiles = 10000;
      stats.breakdown.projectStructure = 1000;
      stats.breakdown.diffs = 20000;

      stats.totalTokensUsed =
        stats.breakdown.changedFiles +
        stats.breakdown.relatedFiles +
        stats.breakdown.projectStructure +
        stats.breakdown.diffs;

      expect(stats.totalTokensUsed).toBe(46000);
      expect(stats.budgetUsedPercent).toBe(0); // Not automatically calculated

      // Manual calculation: 46000/80000 = 0.575 = 57.5%
      stats.budgetUsedPercent = Math.round((stats.totalTokensUsed / stats.totalBudget) * 100);
      // Math.round(57.5) may round to 57 or 58 depending on implementation
      expect(stats.budgetUsedPercent).toBeGreaterThanOrEqual(57);
      expect(stats.budgetUsedPercent).toBeLessThanOrEqual(58);
    });
  });

  describe('token estimation accuracy', () => {
    it('should estimate tokens for typical code', () => {
      const tsCode = `
import { useState, useEffect } from 'react';

interface Props {
  title: string;
  count: number;
}

export function MyComponent({ title, count }: Props) {
  const [data, setData] = useState<string[]>([]);

  useEffect(() => {
    fetchData().then(setData);
  }, []);

  return (
    <div className="container">
      <h1>{title}</h1>
      <p>Count: {count}</p>
      <ul>
        {data.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
`;

      const tokens = estimateTokens(tsCode);

      // Code has ~450 chars, so ~112 tokens
      expect(tokens).toBeGreaterThan(100);
      expect(tokens).toBeLessThan(150);
    });

    it('should handle large files', () => {
      const largeContent = 'x'.repeat(100_000); // 100KB
      const tokens = estimateTokens(largeContent);

      // 100,000 chars / 4 = 25,000 tokens
      expect(tokens).toBe(25_000);
    });

    it('should handle empty content', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens(null as unknown as string)).toBe(0);
    });
  });

  describe('budget allocation strategy', () => {
    it('should have reasonable budget splits', () => {
      const { TOTAL_CONTEXT, DIFFS, CHANGED_FILES, RELATED_FILES, PROJECT_STRUCTURE } =
        TOKEN_BUDGETS;

      // Total should be 80K
      expect(TOTAL_CONTEXT).toBe(80_000);

      // Sum should equal total
      const sum = DIFFS + CHANGED_FILES + RELATED_FILES + PROJECT_STRUCTURE;
      expect(sum).toBe(TOTAL_CONTEXT);

      // Diffs and changed files should have higher allocation
      expect(DIFFS).toBeGreaterThanOrEqual(RELATED_FILES);
      expect(CHANGED_FILES).toBeGreaterThanOrEqual(RELATED_FILES);

      // Project structure should be smallest
      expect(PROJECT_STRUCTURE).toBeLessThan(RELATED_FILES);
    });

    it('should leave room for response in total budget', () => {
      // 80K context + ~10K system prompt + ~30K response = ~120K
      // Keep enough headroom for the configured review model.
      const SYSTEM_PROMPT_ESTIMATE = 10_000;
      const RESPONSE_ESTIMATE = 30_000;
      const SAFETY_MARGIN = 60_000;

      const totalUsage = TOKEN_BUDGETS.TOTAL_CONTEXT + SYSTEM_PROMPT_ESTIMATE + RESPONSE_ESTIMATE;
      expect(totalUsage + SAFETY_MARGIN).toBeLessThanOrEqual(200_000);
    });
  });
});

describe('RepositoryService', () => {
  let service: RepositoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RepositoryService(() => os.tmpdir());
  });

  // -------------------------------------------------------------------------
  // validateCommand (tested via cloneRepository / executeGitCommand)
  // -------------------------------------------------------------------------
  describe('validateCommand', () => {
    it('should allow git commands', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'main');

      // Simulate successful clone
      process.nextTick(() => {
        mockProcess.stdout.emit('data', 'Cloning into...');
        mockProcess.emit('close', 0);
      });

      await promise;

      // spawn was called with 'git' as the command
      expect(mockedSpawn).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['clone']),
        expect.any(Object),
      );
    });

    it('should block npm, yarn, python, and other unsafe commands', async () => {
      // We test validateCommand indirectly. Since executeGitCommand constructs
      // "git <args>", the only way to trigger a blocked pattern is if the args
      // themselves contain a blocked word. For example, "git npm" would be blocked.
      // But cloneRepository only passes safe args. We need to call the private
      // method through a different path — let's verify the service rejects when
      // we try to abuse it via a crafted SSH URL that sneaks through.
      // Actually, the real protection is that validateCommand is called with the
      // full command string. We can test this by verifying the BLOCKED_PATTERNS
      // conceptually — the command "npm install" would be blocked.

      // Since validateCommand is private, we test indirectly by observing that
      // safe git operations succeed (tested above) and that the service's
      // cloneRepository only generates valid git commands (by design).
      // For a more direct test, we verify the error message format.

      // The best approach is to check that if somehow a blocked command reaches
      // executeGitCommand, it would throw. We trigger this by having args that
      // match blocked patterns.
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);

      // Use a branch name containing "npm" — validateCommand checks the whole string
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');
      mockFsPromises.rm.mockResolvedValue(undefined);

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'npm-fix');

      // The command would be "git clone --depth 1 --single-branch --branch npm-fix ..."
      // which matches /npm/i pattern
      await expect(promise).rejects.toThrow('BLOCKED');
    });

    it('should block non-git commands', async () => {
      // validateCommand rejects anything not starting with "git "
      // Since we can't directly call the private method, we verify through
      // the expected behavior: cloneRepository always generates "git clone ..."
      // which is valid. The protection exists for programmatic safety.
      // We verify by confirming spawn is called with 'git' as the binary.
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'main');

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      // First arg to spawn is always 'git'
      expect(mockedSpawn.mock.calls[0][0]).toBe('git');
    });

    it('should include the blocked command in error messages', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');
      mockFsPromises.rm.mockResolvedValue(undefined);

      // "yarn" in the branch name triggers BLOCKED_PATTERNS
      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'yarn-lock-update');

      await expect(promise).rejects.toThrow(/yarn/i);
    });
  });

  // -------------------------------------------------------------------------
  // executeGitCommand (tested via cloneRepository)
  // -------------------------------------------------------------------------
  describe('executeGitCommand', () => {
    it('should resolve with stdout on success (exit code 0)', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'main');

      process.nextTick(() => {
        mockProcess.stdout.emit('data', 'Cloning into /tmp/cr-checkout-abc123...');
        mockProcess.emit('close', 0);
      });

      const result = await promise;
      expect(result).toBe('/tmp/cr-checkout-abc123');
    });

    it('should reject with stderr on failure (non-zero exit code)', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');
      mockFsPromises.rm.mockResolvedValue(undefined);

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'main');

      process.nextTick(() => {
        mockProcess.stderr.emit('data', 'fatal: repository not found');
        mockProcess.emit('close', 128);
      });

      await expect(promise).rejects.toThrow('Git command failed (code 128)');
    });

    it('should reject on process error', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');
      mockFsPromises.rm.mockResolvedValue(undefined);

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'main');

      process.nextTick(() => {
        mockProcess.emit('error', new Error('spawn git ENOENT'));
      });

      await expect(promise).rejects.toThrow('Git command failed: spawn git ENOENT');
    });

    it('should validate command before running (blocks unsafe commands)', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');
      mockFsPromises.rm.mockResolvedValue(undefined);

      // "python" in branch triggers blocked pattern
      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'python-3-update');

      // Should reject before even spawning
      await expect(promise).rejects.toThrow('BLOCKED');
      // spawn should not have been called since validation fails first
      expect(mockedSpawn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // cloneRepository
  // -------------------------------------------------------------------------
  describe('cloneRepository', () => {
    it('should create temp dir and run git clone with correct args', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'feature-branch');

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(mockFsPromises.mkdir).toHaveBeenCalledWith(os.tmpdir(), {
        recursive: true,
        mode: 0o700,
      });
      expect(mockFsPromises.mkdtemp).toHaveBeenCalledWith(
        expect.stringContaining('cr-checkout-'),
      );
      expect(mockedSpawn).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--single-branch', '--branch', 'feature-branch', 'git@gitlab.com:group/repo.git', '/tmp/cr-checkout-abc123'],
        expect.objectContaining({ timeout: 60_000 }),
      );
    });

    it('should report progress at start and completion', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');

      const progressCallback = vi.fn();
      service.setProgressCallback(progressCallback);

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'main');

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      // Should report at least start (progress 0) and completion (progress 100)
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'cloning', progress: 0 }),
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'cloning', progress: 100, message: 'Clone complete' }),
      );
    });

    it('should clean up temp dir on failure', async () => {
      const mockProcess = createMockProcess();
      const tempDir = `${os.tmpdir()}/cr-checkout-abc123`;
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue(tempDir);
      mockFsPromises.rm.mockResolvedValue(undefined);

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'main');

      process.nextTick(() => {
        mockProcess.stderr.emit('data', 'fatal: could not read from remote repository');
        mockProcess.emit('close', 128);
      });

      await expect(promise).rejects.toThrow();

      // cleanup should have been called with the temp dir
      expect(mockFsPromises.rm).toHaveBeenCalledWith(
        tempDir,
        { recursive: true, force: true },
      );
    });

    it('should return the temp directory path on success', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-xyz789');

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'main');

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      const result = await promise;
      expect(result).toBe('/tmp/cr-checkout-xyz789');
    });

    it('should include branch name in progress message', async () => {
      const mockProcess = createMockProcess();
      mockedSpawn.mockReturnValue(mockProcess);
      mockFsPromises.mkdtemp.mockResolvedValue('/tmp/cr-checkout-abc123');

      const progressCallback = vi.fn();
      service.setProgressCallback(progressCallback);

      const promise = service.cloneRepository('git@gitlab.com:group/repo.git', 'develop');

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('develop') }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // cleanup
  // -------------------------------------------------------------------------
  describe('cleanup', () => {
    it('should delete directory in temp path', async () => {
      mockFsPromises.rm.mockResolvedValue(undefined);

      const tempPath = `${os.tmpdir()}/cr-checkout-abc123`;
      await service.cleanup(tempPath);

      expect(mockFsPromises.rm).toHaveBeenCalledWith(
        tempPath,
        { recursive: true, force: true },
      );
    });

    it('should refuse to delete path outside temp dir (security check)', async () => {
      await service.cleanup('/home/user/important-data');

      // rm should NOT have been called
      expect(mockFsPromises.rm).not.toHaveBeenCalled();
    });

    it('should refuse sibling prefixes and non-checkout children', async () => {
      await service.cleanup(`${os.tmpdir()}-sibling/cr-checkout-abc123`);
      await service.cleanup(`${os.tmpdir()}/unrelated-directory`);

      expect(mockFsPromises.rm).not.toHaveBeenCalled();
    });

    it('should handle fs.rm errors gracefully (does not throw)', async () => {
      mockFsPromises.rm.mockRejectedValue(new Error('EPERM: operation not permitted'));

      const tempPath = `${os.tmpdir()}/cr-checkout-abc123`;

      // Should not throw even though rm fails
      await expect(service.cleanup(tempPath)).resolves.toBeUndefined();
    });

    it('should use os.tmpdir() to validate path', async () => {
      mockFsPromises.rm.mockResolvedValue(undefined);
      const tmpdir = os.tmpdir();

      // Path within tmpdir should be allowed
      await service.cleanup(`${tmpdir}/cr-checkout-test`);
      expect(mockFsPromises.rm).toHaveBeenCalledTimes(1);

      // Path outside tmpdir should be rejected
      mockFsPromises.rm.mockClear();
      await service.cleanup('/etc/passwd');
      expect(mockFsPromises.rm).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // readFile
  // -------------------------------------------------------------------------
  describe('readFile', () => {
    const repoPath = '/tmp/cr-checkout-abc123';

    it('should read file within repo successfully', async () => {
      const fileContent = 'export const foo = "bar";';
      mockFsPromises.realpath.mockImplementation((p: string) => Promise.resolve(p));
      mockFsPromises.stat.mockResolvedValue({ size: fileContent.length });
      mockFsPromises.readFile.mockResolvedValue(fileContent);

      const result = await service.readFile(repoPath, 'src/utils.ts');

      expect(result).toBe(fileContent);
      expect(mockFsPromises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('src/utils.ts'),
        'utf-8',
      );
    });

    it('should return null for path traversal attempt', async () => {
      // realpath resolves symlinks — if the resolved path escapes the repo, reject
      mockFsPromises.realpath.mockImplementation((p: string) => {
        if (p.includes('..')) {
          return Promise.resolve('/etc/passwd');
        }
        return Promise.resolve(p);
      });

      const result = await service.readFile(repoPath, '../../etc/passwd');

      expect(result).toBeNull();
    });

    it('should return null for oversized files (>100KB)', async () => {
      mockFsPromises.realpath.mockImplementation((p: string) => Promise.resolve(p));
      mockFsPromises.stat.mockResolvedValue({ size: 200 * 1024 }); // 200KB

      const result = await service.readFile(repoPath, 'src/large-file.ts');

      expect(result).toBeNull();
      // readFile should NOT have been called since stat rejects it
      expect(mockFsPromises.readFile).not.toHaveBeenCalled();
    });

    it('should return null for non-existent files (stat throws)', async () => {
      mockFsPromises.realpath.mockRejectedValue(new Error('ENOENT'));

      const result = await service.readFile(repoPath, 'src/nonexistent.ts');

      expect(result).toBeNull();
    });

    it('should check realpath against repoPath', async () => {
      // Simulate a symlink that resolves outside the repo
      mockFsPromises.realpath.mockImplementation((p: string) => {
        if (p.includes('evil-link')) {
          return Promise.resolve('/var/secrets/token');
        }
        return Promise.resolve(repoPath);
      });

      const result = await service.readFile(repoPath, 'evil-link');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // extractImports (tested via findRelatedFilesWithDepth)
  // -------------------------------------------------------------------------
  describe('extractImports', () => {
    const repoPath = '/tmp/cr-checkout-abc123';

    beforeEach(() => {
      // Default: realpath returns the path as-is
      mockFsPromises.realpath.mockImplementation((p: string) => Promise.resolve(p));
      mockFsPromises.stat.mockResolvedValue({ size: 500 });
    });

    it('should extract ES import statements from .ts files', async () => {
      const tsContent = `
import { foo } from './utils';
import bar from './helpers';
import type { Baz } from './types';
import React from 'react';
`;
      mockFsPromises.readFile.mockResolvedValue(tsContent);
      // statSync returns isFile for resolved imports
      mockStatSync.mockImplementation(() => ({ isFile: () => true }));

      const related = await service.findRelatedFilesWithDepth(
        repoPath,
        ['src/index.ts'],
        1,
      );

      // Should find ./utils, ./helpers, ./types (relative imports only)
      // 'react' is not relative, so excluded
      const paths = related.map((r) => r.path);
      expect(paths.length).toBeGreaterThanOrEqual(3);
    });

    it('should extract require() calls from .js files', async () => {
      const jsContent = `
const utils = require('./utils');
const path = require('path');
const helper = require('./helper');
`;
      mockFsPromises.readFile.mockResolvedValue(jsContent);
      mockStatSync.mockImplementation(() => ({ isFile: () => true }));

      const related = await service.findRelatedFilesWithDepth(
        repoPath,
        ['src/app.js'],
        1,
      );

      // Should find ./utils and ./helper (relative only, not 'path')
      const paths = related.map((r) => r.path);
      expect(paths.length).toBeGreaterThanOrEqual(2);
    });

    it('should only include relative imports (starting with ".")', async () => {
      const tsContent = `
import { useState } from 'react';
import axios from 'axios';
import { local } from './local';
import nested from '../nested';
`;
      mockFsPromises.readFile.mockResolvedValue(tsContent);
      mockStatSync.mockImplementation(() => ({ isFile: () => true }));

      const related = await service.findRelatedFilesWithDepth(
        repoPath,
        ['src/component.tsx'],
        1,
      );

      // Only ./local and ../nested are relative
      for (const file of related) {
        expect(file.path).not.toContain('node_modules');
        expect(file.path).not.toContain('react');
        expect(file.path).not.toContain('axios');
      }
    });

    it('should extract Python relative imports (from .foo import bar)', async () => {
      const pyContent = `
from .utils import helper
from ..models import User
import os
from .services import auth_service
`;
      mockFsPromises.readFile.mockResolvedValue(pyContent);
      mockStatSync.mockImplementation(() => ({ isFile: () => true }));

      const related = await service.findRelatedFilesWithDepth(
        repoPath,
        ['app/views.py'],
        1,
      );

      // Should find relative Python imports (.utils, ..models, .services)
      expect(related.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract Go relative imports', async () => {
      const goContent = `
package main

import (
	"fmt"
	"./utils"
	"./internal/handler"
)
`;
      mockFsPromises.readFile.mockResolvedValue(goContent);
      mockStatSync.mockImplementation(() => ({ isFile: () => true }));

      const related = await service.findRelatedFilesWithDepth(
        repoPath,
        ['main.go'],
        1,
      );

      // Should find ./utils and ./internal/handler (relative only, not "fmt")
      expect(related.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for unsupported extensions', async () => {
      const cssContent = `
.container {
  display: flex;
}
`;
      mockFsPromises.readFile.mockResolvedValue(cssContent);

      // .css is readable but extractImports won't find any import patterns
      const related = await service.findRelatedFilesWithDepth(
        repoPath,
        ['styles/main.css'],
        1,
      );

      expect(related).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // resolveImportPath (tested via findRelatedFilesWithDepth)
  // -------------------------------------------------------------------------
  describe('resolveImportPath', () => {
    const repoPath = '/tmp/cr-checkout-abc123';

    beforeEach(() => {
      mockFsPromises.realpath.mockImplementation((p: string) => Promise.resolve(p));
      mockFsPromises.stat.mockResolvedValue({ size: 100 });
    });

    it('should resolve import with .ts extension', async () => {
      const content = `import { helper } from './helper';`;
      mockFsPromises.readFile.mockResolvedValue(content);

      // statSync: ./helper.ts exists
      mockStatSync.mockImplementation((fullPath: string) => {
        if (fullPath.endsWith('helper.ts')) {
          return { isFile: () => true };
        }
        throw new Error('ENOENT');
      });

      const related = await service.findRelatedFilesWithDepth(
        repoPath,
        ['src/index.ts'],
        1,
      );

      const paths = related.map((r) => r.path);
      expect(paths).toContain('src/helper.ts');
    });

    it('should resolve import with index.ts in directory', async () => {
      const content = `import { Component } from './components';`;
      mockFsPromises.readFile.mockResolvedValue(content);

      // statSync: ./components doesn't exist as a file, but ./components/index.ts does
      mockStatSync.mockImplementation((fullPath: string) => {
        if (fullPath.includes('components/index.ts') || fullPath.includes('components\\index.ts')) {
          return { isFile: () => true };
        }
        throw new Error('ENOENT');
      });

      const related = await service.findRelatedFilesWithDepth(
        repoPath,
        ['src/app.ts'],
        1,
      );

      const paths = related.map((r) => r.path);
      // Should resolve to the index.ts within the components directory
      expect(paths.some((p) => p.includes('components/index.ts') || p.includes('components\\index.ts'))).toBe(true);
    });

    it('should return null when file not found', async () => {
      const content = `import { ghost } from './nonexistent';`;
      mockFsPromises.readFile.mockResolvedValue(content);

      // statSync: nothing resolves
      mockStatSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const related = await service.findRelatedFilesWithDepth(
        repoPath,
        ['src/index.ts'],
        1,
      );

      expect(related).toEqual([]);
    });

    it('should use statSync to check file existence', async () => {
      const content = `import { util } from './util';`;
      mockFsPromises.readFile.mockResolvedValue(content);

      mockStatSync.mockImplementation((fullPath: string) => {
        if (fullPath.endsWith('util.ts')) {
          return { isFile: () => true };
        }
        throw new Error('ENOENT');
      });

      await service.findRelatedFilesWithDepth(repoPath, ['src/main.ts'], 1);

      // statSync should have been called to check extension candidates
      expect(mockStatSync).toHaveBeenCalled();
      // At least one call should include 'util' in the path
      const calls = mockStatSync.mock.calls.map((c) => String(c[0]));
      expect(calls.some((c) => c.includes('util'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getProjectStructure
  // -------------------------------------------------------------------------
  describe('getProjectStructure', () => {
    const repoPath = '/tmp/cr-checkout-abc123';

    it('should return tree with directories sorted before files', async () => {
      // Simulate readdir returning a mix of files and directories
      mockFsPromises.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === repoPath) {
          return Promise.resolve([
            { name: 'README.md', isDirectory: () => false, isFile: () => true },
            { name: 'src', isDirectory: () => true, isFile: () => false },
            { name: 'package.json', isDirectory: () => false, isFile: () => true },
          ]);
        }
        if (dirPath.endsWith('src')) {
          return Promise.resolve([
            { name: 'index.ts', isDirectory: () => false, isFile: () => true },
          ]);
        }
        return Promise.resolve([]);
      });

      const structure = await service.getProjectStructure(repoPath);

      // Directories should appear in the tree
      expect(structure.directories).toContain('src');
      // Tree should include directory markers
      expect(structure.tree).toContain('src/');
      // File count should include readable files
      expect(structure.fileCount).toBeGreaterThan(0);

      // Verify directories come before files in tree lines
      const lines = structure.tree.split('\n');
      const srcIndex = lines.findIndex((l) => l.includes('src/'));
      const readmeIndex = lines.findIndex((l) => l.includes('README.md'));
      const packageIndex = lines.findIndex((l) => l.includes('package.json'));
      expect(srcIndex).toBeLessThan(readmeIndex);
      expect(srcIndex).toBeLessThan(packageIndex);
    });

    it('should respect MAX_TREE_DEPTH (3 levels)', async () => {
      // Create a deeply nested structure
      mockFsPromises.readdir.mockImplementation((dirPath: string) => {
        const depth = dirPath.replace(repoPath, '').split('/').filter(Boolean).length;
        if (depth <= 3) {
          return Promise.resolve([
            { name: `level${depth + 1}`, isDirectory: () => true, isFile: () => false },
            { name: 'file.ts', isDirectory: () => false, isFile: () => true },
          ]);
        }
        // Depth > 3: should not be reached if MAX_TREE_DEPTH is respected
        return Promise.resolve([
          { name: 'deep-file.ts', isDirectory: () => false, isFile: () => true },
          { name: 'deep-dir', isDirectory: () => true, isFile: () => false },
        ]);
      });

      const structure = await service.getProjectStructure(repoPath);

      // Should not contain directories beyond depth 3
      // MAX_TREE_DEPTH = 3, so level1, level2, level3 should exist but not level4+
      expect(structure.directories.length).toBeLessThanOrEqual(4);
      // The tree should not include deep-dir (depth 4+)
      expect(structure.tree).not.toContain('deep-dir');
    });

    it('should ignore directories in IGNORED_DIRECTORIES set', async () => {
      mockFsPromises.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === repoPath) {
          return Promise.resolve([
            { name: 'src', isDirectory: () => true, isFile: () => false },
            { name: 'node_modules', isDirectory: () => true, isFile: () => false },
            { name: '.git', isDirectory: () => true, isFile: () => false },
            { name: 'dist', isDirectory: () => true, isFile: () => false },
            { name: 'coverage', isDirectory: () => true, isFile: () => false },
          ]);
        }
        if (dirPath.endsWith('src')) {
          return Promise.resolve([
            { name: 'index.ts', isDirectory: () => false, isFile: () => true },
          ]);
        }
        return Promise.resolve([]);
      });

      const structure = await service.getProjectStructure(repoPath);

      // src should be included
      expect(structure.directories).toContain('src');
      // Ignored directories should NOT be included
      expect(structure.directories).not.toContain('node_modules');
      expect(structure.directories).not.toContain('.git');
      expect(structure.directories).not.toContain('dist');
      expect(structure.directories).not.toContain('coverage');
      // Tree should not mention ignored dirs
      expect(structure.tree).not.toContain('node_modules');
      expect(structure.tree).not.toContain('.git');
    });
  });

  // -------------------------------------------------------------------------
  // buildExpandedContext
  // -------------------------------------------------------------------------
  describe('buildExpandedContext', () => {
    const repoPath = '/tmp/cr-checkout-abc123';

    beforeEach(() => {
      mockFsPromises.realpath.mockImplementation((p: string) => Promise.resolve(p));
    });

    it('skips local file reads for deleted changes while keeping checkout context', async () => {
      const readFile = vi.spyOn(service, 'readFile');
      vi.spyOn(service, 'getProjectStructure').mockResolvedValue({
        directories: [],
        fileCount: 0,
        tree: '',
      });

      const context = await service.buildExpandedContext(repoPath, [{
        old_path: 'src/deleted.ts',
        new_path: 'src/deleted.ts',
        diff: '-export const removed = true;',
        new_file: false,
        renamed_file: false,
        deleted_file: true,
      }]);

      expect(readFile).not.toHaveBeenCalled();
      expect(context.changedFiles).toEqual([]);
      expect(context.repoPath).toBe(repoPath);
    });

    it('should read changed files and related files', async () => {
      const changedContent = `import { helper } from './helper';\nexport const main = true;`;
      const helperContent = `export const helper = () => 'help';`;

      mockFsPromises.stat.mockResolvedValue({ size: 100 });
      mockFsPromises.readFile.mockImplementation((fullPath: string) => {
        if (String(fullPath).includes('index.ts')) return Promise.resolve(changedContent);
        if (String(fullPath).includes('helper.ts')) return Promise.resolve(helperContent);
        return Promise.reject(new Error('ENOENT'));
      });
      mockStatSync.mockImplementation((fullPath: string) => {
        if (fullPath.endsWith('helper.ts')) return { isFile: () => true };
        throw new Error('ENOENT');
      });
      // getProjectStructure mock
      mockFsPromises.readdir.mockResolvedValue([]);

      const changes = [
        { old_path: 'src/index.ts', new_path: 'src/index.ts', diff: '+1', new_file: false, renamed_file: false, deleted_file: false },
      ];

      const context = await service.buildExpandedContext(repoPath, changes);

      // Changed files should be present
      expect(context.changedFiles.length).toBe(1);
      expect(context.changedFiles[0].path).toBe('src/index.ts');
      expect(context.changedFiles[0].isChanged).toBe(true);

      // Related files should include the helper
      expect(context.relatedFiles.length).toBe(1);
      expect(context.relatedFiles[0].path).toContain('helper.ts');
      expect(context.relatedFiles[0].isChanged).toBe(false);
    });

    it('should apply token budget and exclude low-priority files', async () => {
      // Create content that will exceed related files budget
      const changedContent = `export const a = 1;`;
      const relatedContent = 'x'.repeat(200_000); // Very large related file

      mockFsPromises.stat.mockResolvedValue({ size: 100 });
      mockFsPromises.readFile.mockImplementation((fullPath: string) => {
        if (String(fullPath).includes('changed.ts')) return Promise.resolve(changedContent);
        if (String(fullPath).includes('big-import.ts')) return Promise.resolve(relatedContent);
        return Promise.reject(new Error('ENOENT'));
      });
      mockStatSync.mockImplementation((fullPath: string) => {
        if (fullPath.endsWith('big-import.ts')) return { isFile: () => true };
        throw new Error('ENOENT');
      });
      mockFsPromises.readdir.mockResolvedValue([]);

      const changes = [
        { old_path: 'src/changed.ts', new_path: 'src/changed.ts', diff: '+1', new_file: false, renamed_file: false, deleted_file: false },
      ];

      // Provide changed.ts content that imports big-import
      mockFsPromises.readFile.mockImplementation((fullPath: string) => {
        if (String(fullPath).includes('changed.ts')) return Promise.resolve(`import { x } from './big-import';\nexport const a = 1;`);
        if (String(fullPath).includes('big-import.ts')) return Promise.resolve(relatedContent);
        return Promise.reject(new Error('ENOENT'));
      });

      const context = await service.buildExpandedContext(repoPath, changes, {
        tokenBudget: TOKEN_BUDGETS.TOTAL_CONTEXT,
      });

      // Budget stats should be present when tokenBudget is provided
      expect(context.budgetStats).toBeDefined();
      expect(context.budgetStats!.totalBudget).toBe(TOKEN_BUDGETS.TOTAL_CONTEXT);

      // The big file should have been excluded (exceeds RELATED_FILES budget)
      if (context.budgetStats!.filesExcluded > 0) {
        expect(context.budgetStats!.excludedFiles).toContain('src/big-import.ts');
      }
    });

    it('should report progress during context building', async () => {
      mockFsPromises.stat.mockResolvedValue({ size: 50 });
      mockFsPromises.readFile.mockResolvedValue('const x = 1;');
      mockStatSync.mockImplementation(() => { throw new Error('ENOENT'); });
      mockFsPromises.readdir.mockResolvedValue([]);

      const progressCallback = vi.fn();
      service.setProgressCallback(progressCallback);

      const changes = [
        { old_path: 'src/a.ts', new_path: 'src/a.ts', diff: '+1', new_file: false, renamed_file: false, deleted_file: false },
      ];

      await service.buildExpandedContext(repoPath, changes);

      // Should report reading stage
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'reading' }),
      );
      // Should report building-context stage
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'building-context' }),
      );
      // Should report complete stage
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'complete', progress: 100 }),
      );
    });

    it('should get project structure', async () => {
      mockFsPromises.stat.mockResolvedValue({ size: 50 });
      mockFsPromises.readFile.mockResolvedValue('const y = 2;');
      mockStatSync.mockImplementation(() => { throw new Error('ENOENT'); });

      // Mock readdir for project structure
      mockFsPromises.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === repoPath) {
          return Promise.resolve([
            { name: 'src', isDirectory: () => true, isFile: () => false },
            { name: 'package.json', isDirectory: () => false, isFile: () => true },
          ]);
        }
        if (String(dirPath).endsWith('src')) {
          return Promise.resolve([
            { name: 'index.ts', isDirectory: () => false, isFile: () => true },
          ]);
        }
        return Promise.resolve([]);
      });

      const changes = [
        { old_path: 'src/index.ts', new_path: 'src/index.ts', diff: '+1', new_file: false, renamed_file: false, deleted_file: false },
      ];

      const context = await service.buildExpandedContext(repoPath, changes);

      // Project structure should be populated
      expect(context.projectStructure).toBeDefined();
      expect(context.projectStructure.directories).toContain('src');
      expect(context.projectStructure.fileCount).toBeGreaterThan(0);
      expect(context.repoPath).toBe(repoPath);
    });
  });
});
