/**
 * Repository Service - Local checkout for contextual code analysis
 *
 * SECURITY CONSTRAINTS:
 * - ONLY git clone/checkout/fetch commands allowed
 * - NO build/compile/install commands ever executed
 * - Shallow clone (--depth 1) for minimal footprint
 * - Auto cleanup of temp directories
 * - Timeout protection on all operations
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import { statSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  FileChange,
  ExpandedContext,
  FileWithContent,
  ProjectStructure,
  RepositoryProgress,
} from '../../shared/types';
import { logger } from './logger.service';
import {
  estimateTokens,
  calculateFilePriority,
  TOKEN_BUDGETS,
  createEmptyBudgetStats,
} from './token-utils';

// Maximum time for clone operation (60 seconds)
const CLONE_TIMEOUT_MS = 60_000;

// Maximum file size to read (100KB)
const MAX_FILE_SIZE = 100 * 1024;

// Maximum depth for directory traversal
const MAX_TREE_DEPTH = 3;

// File extensions to read for context
const READABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.swift', '.m', '.mm',
  '.vue', '.svelte',
  '.json', '.yaml', '.yml', '.toml',
  '.md', '.txt',
  '.sql',
  '.sh', '.bash',
  '.css', '.scss', '.less',
  '.html', '.xml',
]);

// Directories to ignore when building context
const IGNORED_DIRECTORIES = new Set([
  'node_modules', '.git', 'dist', 'build', 'out',
  '.next', '.nuxt', '.svelte-kit',
  'target', 'bin', 'obj',
  '__pycache__', '.pytest_cache', 'venv', '.venv',
  'vendor', 'packages',
  '.idea', '.vscode',
  'coverage', '.nyc_output',
]);

/** Related file with import depth information */
interface RelatedFileInfo {
  path: string;
  depth: number;
}

/** Options for building expanded context */
interface BuildContextOptions {
  /** Token budget (undefined = no limit) */
  tokenBudget?: number;
  /** Maximum depth for related files */
  maxRelatedDepth?: number;
}

// BLOCKED command patterns - NEVER execute these
const BLOCKED_PATTERNS = [
  /npm|yarn|pnpm|bun/i,       // Package managers
  /make|cmake|meson|ninja/i,   // Build tools
  /python|pip|pipenv|poetry/i, // Python
  /cargo|rustc/i,              // Rust
  /go\s+(build|run|install)/i, // Go
  /gradle|mvn|ant/i,           // Java
  /dotnet|msbuild/i,           // .NET
  /swift\s+build/i,            // Swift
  /bundle|gem/i,               // Ruby
  /composer/i,                 // PHP
];

export class RepositoryService {
  private progressCallback?: (progress: RepositoryProgress) => void;

  constructor(
    private readonly resolveCheckoutRoot: () => string = () => path.join(os.homedir(), 'code-review-app'),
  ) {}

  /**
   * Set callback for progress updates
   */
  setProgressCallback(callback: (progress: RepositoryProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Report progress to callback if set
   */
  private reportProgress(progress: RepositoryProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Validate command is safe to execute (only git operations allowed)
   */
  private validateCommand(command: string): void {
    // Check against blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        throw new Error(`BLOCKED: Unsafe command pattern detected: ${command}`);
      }
    }

    // Only allow git commands
    if (!command.startsWith('git ')) {
      throw new Error(`BLOCKED: Only git commands are allowed, got: ${command}`);
    }
  }

  /**
   * Execute a git command with timeout
   */
  private async executeGitCommand(
    args: string[],
    cwd?: string,
    timeoutMs: number = CLONE_TIMEOUT_MS
  ): Promise<string> {
    const command = `git ${args.join(' ')}`;
    this.validateCommand(command);

    return new Promise((resolve, reject) => {
      const child = spawn('git', args, {
        cwd,
        timeout: timeoutMs,
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`Git command failed: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed (code ${code}): ${stderr}`));
        }
      });

      // Timeout handling
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Git command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Clone repository to a temporary directory
   * Uses shallow clone (--depth 1) for minimal footprint
   */
  async cloneRepository(sshUrl: string, branch: string): Promise<string> {
    this.reportProgress({
      stage: 'cloning',
      progress: 0,
      message: `Cloning branch ${branch}...`,
    });

    // Keep every checkout inside the application-owned root.
    const checkoutRoot = path.resolve(this.resolveCheckoutRoot());
    await fs.mkdir(checkoutRoot, { recursive: true, mode: 0o700 });
    const tempDir = await fs.mkdtemp(path.join(checkoutRoot, 'cr-checkout-'));

    logger.info('repository', 'Starting clone', { sshUrl, branch, tempDir });

    try {
      // Shallow clone with single branch
      await this.executeGitCommand([
        'clone',
        '--depth', '1',
        '--single-branch',
        '--branch', branch,
        sshUrl,
        tempDir,
      ]);

      this.reportProgress({
        stage: 'cloning',
        progress: 100,
        message: 'Clone complete',
      });

      logger.info('repository', 'Clone successful', { tempDir, branch });

      return tempDir;
    } catch (error) {
      // Cleanup on failure
      await this.cleanup(tempDir);
      throw error;
    }
  }

  /**
   * Cleanup temporary repository directory
   */
  async cleanup(repoPath: string): Promise<void> {
    try {
      const checkoutRoot = path.resolve(this.resolveCheckoutRoot());
      const candidate = path.resolve(repoPath);
      const isOwnedCheckout = path.dirname(candidate) === checkoutRoot
        && path.basename(candidate).startsWith('cr-checkout-')
        && path.basename(candidate).length > 'cr-checkout-'.length;
      if (!isOwnedCheckout) {
        logger.warn('repository', `Refusing to delete path outside checkout root: ${repoPath}`);
        return;
      }

      await fs.rm(candidate, { recursive: true, force: true });
      logger.info('repository', 'Cleanup successful', { repoPath: candidate });
    } catch (error) {
      logger.error('repository', `Failed to cleanup ${repoPath}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Read a single file from the repository
   */
  async readFile(repoPath: string, filePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(repoPath, filePath);

      // Safety: ensure path is within repo
      const realPath = await fs.realpath(fullPath);
      const realRepoPath = await fs.realpath(repoPath);
      if (!realPath.startsWith(realRepoPath)) {
        logger.warn('repository', `Path traversal attempt detected: ${filePath}`);
        return null;
      }

      // Check file size
      const stats = await fs.stat(fullPath);
      if (stats.size > MAX_FILE_SIZE) {
        logger.warn('repository', `File too large to read: ${filePath} (${stats.size} bytes)`);
        return null;
      }

      logger.debug('repository', 'File read successfully', { filePath, size: stats.size });
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      logger.debug('repository', 'Failed to read file', { filePath, error: error instanceof Error ? error.message : 'Unknown' });
      return null;
    }
  }

  /**
   * Check if file extension is readable
   */
  private isReadableFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return READABLE_EXTENSIONS.has(ext);
  }

  /**
   * Check if directory should be ignored
   */
  private shouldIgnoreDirectory(dirName: string): boolean {
    return IGNORED_DIRECTORIES.has(dirName);
  }

  /**
   * Find files related to the changed files (imports, dependencies)
   * Returns files with their import depth for priority calculation
   */
  async findRelatedFilesWithDepth(
    repoPath: string,
    changedFiles: string[],
    maxDepth: number = 2
  ): Promise<RelatedFileInfo[]> {
    const relatedFiles = new Map<string, number>(); // path -> minimum depth
    const processed = new Set<string>();

    logger.debug('repository', 'Finding related files', { changedFilesCount: changedFiles.length, changedFiles });

    const processFile = async (filePath: string, depth: number): Promise<void> => {
      if (depth > maxDepth || processed.has(filePath)) {
        return;
      }
      processed.add(filePath);

      const content = await this.readFile(repoPath, filePath);
      if (!content) return;

      // Extract imports based on file extension
      const imports = this.extractImports(content, filePath);

      if (imports.length > 0) {
        logger.debug('repository', 'Imports found', { filePath, imports });
      }

      for (const importPath of imports) {
        const resolvedPath = this.resolveImportPath(filePath, importPath, repoPath);
        if (resolvedPath && !changedFiles.includes(resolvedPath)) {
          // Track minimum depth for this file
          const existingDepth = relatedFiles.get(resolvedPath);
          if (existingDepth === undefined || depth + 1 < existingDepth) {
            relatedFiles.set(resolvedPath, depth + 1);
          }
          await processFile(resolvedPath, depth + 1);
        }
      }
    };

    // Process each changed file (depth 0 = direct import from changed file)
    for (const file of changedFiles) {
      await processFile(file, 0);
    }

    const result = Array.from(relatedFiles.entries()).map(([filePath, depth]) => ({
      path: filePath,
      depth,
    }));

    logger.info('repository', 'Related files found', {
      count: result.length,
      files: result.map((f) => `${f.path} (depth ${f.depth})`),
    });

    return result;
  }

  /**
   * Find files related to the changed files (imports, dependencies)
   * @deprecated Use findRelatedFilesWithDepth for priority-aware context building
   */
  async findRelatedFiles(
    repoPath: string,
    changedFiles: string[],
    maxDepth: number = 2
  ): Promise<string[]> {
    const relatedWithDepth = await this.findRelatedFilesWithDepth(repoPath, changedFiles, maxDepth);
    return relatedWithDepth.map((f) => f.path);
  }

  /**
   * Extract import paths from file content
   */
  private extractImports(content: string, filePath: string): string[] {
    const ext = path.extname(filePath).toLowerCase();
    const imports: string[] = [];

    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      // TypeScript/JavaScript imports
      const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

      let match;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1].startsWith('.')) {
          imports.push(match[1]);
        }
      }
      while ((match = requireRegex.exec(content)) !== null) {
        if (match[1].startsWith('.')) {
          imports.push(match[1]);
        }
      }
    } else if (['.py'].includes(ext)) {
      // Python imports
      const fromImportRegex = /from\s+(\.[.\w]+)\s+import/g;

      let match;
      while ((match = fromImportRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    } else if (['.go'].includes(ext)) {
      // Go imports (relative paths within module)
      const importRegex = /import\s+(?:\(\s*([\s\S]*?)\s*\)|"([^"]+)")/g;

      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importBlock = match[1] || match[2];
        if (importBlock) {
          const pathRegex = /"([^"]+)"/g;
          let pathMatch;
          while ((pathMatch = pathRegex.exec(importBlock)) !== null) {
            if (pathMatch[1].startsWith('.')) {
              imports.push(pathMatch[1]);
            }
          }
        }
      }
    }

    return imports;
  }

  /**
   * Resolve an import path to a file path
   */
  private resolveImportPath(
    fromFile: string,
    importPath: string,
    repoPath: string
  ): string | null {
    const dir = path.dirname(fromFile);
    let resolved = path.join(dir, importPath);

    // Normalize the path
    resolved = path.normalize(resolved);

    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', ''];
    const indexFiles = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

    for (const ext of extensions) {
      const fullPath = resolved + ext;
      try {
        const stats = statSync(path.join(repoPath, fullPath));
        if (stats.isFile()) {
          logger.debug('repository', 'Import resolved', { fromFile, importPath, resolvedPath: fullPath });
          return fullPath;
        }
      } catch {
        // File doesn't exist, try next
      }
    }

    // Try as directory with index file
    for (const indexFile of indexFiles) {
      const fullPath = path.join(resolved, indexFile);
      try {
        const stats = statSync(path.join(repoPath, fullPath));
        if (stats.isFile()) {
          logger.debug('repository', 'Import resolved', { fromFile, importPath, resolvedPath: fullPath });
          return fullPath;
        }
      } catch {
        // File doesn't exist, try next
      }
    }

    logger.debug('repository', 'Import not resolved', { fromFile, importPath, triedPath: resolved });
    return null;
  }

  /**
   * Build project structure overview
   */
  async getProjectStructure(repoPath: string): Promise<ProjectStructure> {
    const directories: string[] = [];
    let fileCount = 0;
    const treeLines: string[] = [];

    const buildTree = async (
      currentPath: string,
      prefix: string,
      depth: number
    ): Promise<void> => {
      if (depth > MAX_TREE_DEPTH) return;

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const sortedEntries = entries.sort((a, b) => {
          // Directories first, then files
          if (a.isDirectory() !== b.isDirectory()) {
            return a.isDirectory() ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < sortedEntries.length; i++) {
          const entry = sortedEntries[i];
          const isLast = i === sortedEntries.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');

          if (entry.isDirectory()) {
            if (this.shouldIgnoreDirectory(entry.name)) continue;

            const relativePath = path.relative(repoPath, path.join(currentPath, entry.name));
            directories.push(relativePath);
            treeLines.push(`${prefix}${connector}${entry.name}/`);

            await buildTree(path.join(currentPath, entry.name), nextPrefix, depth + 1);
          } else {
            if (this.isReadableFile(entry.name)) {
              fileCount++;
              if (depth < 2) {
                treeLines.push(`${prefix}${connector}${entry.name}`);
              }
            }
          }
        }
      } catch (error) {
        logger.error('repository', `Error reading directory ${currentPath}`, { error: error instanceof Error ? error.message : String(error) });
      }
    };

    await buildTree(repoPath, '', 0);

    return {
      directories,
      fileCount,
      tree: treeLines.join('\n'),
    };
  }

  /**
   * Build expanded context from local checkout with optional token budget
   */
  async buildExpandedContext(
    repoPath: string,
    changes: FileChange[],
    options?: BuildContextOptions
  ): Promise<ExpandedContext> {
    const tokenBudget = options?.tokenBudget;
    const maxRelatedDepth = options?.maxRelatedDepth ?? 2;
    const budgetStats = createEmptyBudgetStats(tokenBudget ?? TOKEN_BUDGETS.TOTAL_CONTEXT);

    this.reportProgress({
      stage: 'reading',
      progress: 0,
      message: 'Reading changed files...',
    });

    // Get list of changed file paths
    const changedPaths = changes.filter((change) => !change.deleted_file).map((change) => change.new_path);

    // Read changed files with full content and calculate priority/tokens
    const changedFiles: FileWithContent[] = [];
    let changedFilesTokens = 0;

    for (let i = 0; i < changedPaths.length; i++) {
      const filePath = changedPaths[i];
      const content = await this.readFile(repoPath, filePath);

      if (content) {
        const tokens = estimateTokens(content);
        const priority = calculateFilePriority(filePath, true, -1);

        changedFiles.push({
          path: filePath,
          content,
          isChanged: true,
          priority,
          estimatedTokens: tokens,
          importDepth: -1, // N/A for changed files
        });
        changedFilesTokens += tokens;
      }

      this.reportProgress({
        stage: 'reading',
        progress: Math.round(((i + 1) / changedPaths.length) * 50),
        message: `Reading ${filePath}...`,
      });
    }

    budgetStats.breakdown.changedFiles = changedFilesTokens;
    budgetStats.filesIncluded = changedFiles.length;

    this.reportProgress({
      stage: 'building-context',
      progress: 50,
      message: 'Finding related files...',
    });

    // Find related files with depth information
    const relatedWithDepth = await this.findRelatedFilesWithDepth(repoPath, changedPaths, maxRelatedDepth);

    // Read related files and calculate priority/tokens
    const allRelatedFiles: FileWithContent[] = [];

    for (let i = 0; i < relatedWithDepth.length; i++) {
      const { path: filePath, depth } = relatedWithDepth[i];
      const content = await this.readFile(repoPath, filePath);

      if (content) {
        const tokens = estimateTokens(content);
        const priority = calculateFilePriority(filePath, false, depth);

        allRelatedFiles.push({
          path: filePath,
          content,
          isChanged: false,
          priority,
          estimatedTokens: tokens,
          importDepth: depth,
        });
      }

      this.reportProgress({
        stage: 'building-context',
        progress: 50 + Math.round(((i + 1) / Math.max(relatedWithDepth.length, 1)) * 30),
        message: `Reading related file ${filePath}...`,
      });
    }

    // Sort related files by priority (highest first)
    allRelatedFiles.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Apply token budget to related files
    const relatedFiles: FileWithContent[] = [];
    let relatedFilesTokens = 0;
    const relatedBudget = tokenBudget ? TOKEN_BUDGETS.RELATED_FILES : Infinity;

    for (const file of allRelatedFiles) {
      const fileTokens = file.estimatedTokens ?? 0;

      if (tokenBudget && relatedFilesTokens + fileTokens > relatedBudget) {
        // File exceeds budget, exclude it
        budgetStats.filesExcluded++;
        budgetStats.excludedFiles.push(file.path);
        logger.debug('repository', 'Excluding file due to budget', {
          file: file.path,
          tokens: fileTokens,
          budgetUsed: relatedFilesTokens,
          budgetLimit: relatedBudget,
        });
        continue;
      }

      relatedFiles.push(file);
      relatedFilesTokens += fileTokens;
      budgetStats.filesIncluded++;
    }

    budgetStats.breakdown.relatedFiles = relatedFilesTokens;

    this.reportProgress({
      stage: 'building-context',
      progress: 85,
      message: 'Building project structure...',
    });

    // Get project structure
    const projectStructure = await this.getProjectStructure(repoPath);
    const structureTokens = estimateTokens(projectStructure.tree);
    budgetStats.breakdown.projectStructure = structureTokens;

    // Calculate final stats
    budgetStats.totalTokensUsed =
      budgetStats.breakdown.changedFiles +
      budgetStats.breakdown.relatedFiles +
      budgetStats.breakdown.projectStructure;
    budgetStats.budgetUsedPercent = Math.round(
      (budgetStats.totalTokensUsed / budgetStats.totalBudget) * 100
    );

    logger.info('repository', 'Context built with budget', {
      totalTokens: budgetStats.totalTokensUsed,
      budget: budgetStats.totalBudget,
      percentUsed: budgetStats.budgetUsedPercent,
      filesIncluded: budgetStats.filesIncluded,
      filesExcluded: budgetStats.filesExcluded,
      breakdown: budgetStats.breakdown,
    });

    this.reportProgress({
      stage: 'complete',
      progress: 100,
      message: tokenBudget
        ? `Context ready (${budgetStats.budgetUsedPercent}% of budget used)`
        : 'Context ready',
    });

    return {
      changedFiles,
      relatedFiles,
      projectStructure,
      repoPath,
      budgetStats: tokenBudget ? budgetStats : undefined,
    };
  }
}
