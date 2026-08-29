import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { MemoryContainer, MemoryContainerListResult } from '../../shared/types';
import { logger } from './logger.service';

const execFileAsync = promisify(execFile);
const LIST_TIMEOUT_MS = 8_000;
const MAX_LIST_BYTES = 256 * 1024;
const MAX_TEXT_LENGTH = 512;

export type ContainerListRunner = (
  binary: string,
  args: readonly string[],
) => Promise<{ stdout: string; stderr?: string }>;

const defaultRunner: ContainerListRunner = async (binary, args) => {
  const result = await execFileAsync(binary, [...args], {
    encoding: 'utf8',
    timeout: LIST_TIMEOUT_MS,
    maxBuffer: MAX_LIST_BYTES,
    windowsHide: true,
    shell: false,
  });
  return { stdout: result.stdout, stderr: result.stderr };
};

function parseContainer(value: unknown): MemoryContainer | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.containerTag !== 'string'
    || !candidate.containerTag.trim()
    || candidate.containerTag.length > MAX_TEXT_LENGTH) return null;
  if (candidate.name != null
    && (typeof candidate.name !== 'string' || candidate.name.length > MAX_TEXT_LENGTH)) return null;
  if (!isCount(candidate.documentCount) || !isCount(candidate.memoryCount)) return null;
  if (candidate.lastActivityAt != null && typeof candidate.lastActivityAt !== 'string') return null;
  return {
    containerTag: candidate.containerTag,
    name: (candidate.name as string | null | undefined)?.trim() || candidate.containerTag,
    documentCount: candidate.documentCount,
    memoryCount: candidate.memoryCount,
    lastActivityAt: candidate.lastActivityAt as string | null | undefined,
  };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export class SupermemoryContainerService {
  constructor(private readonly runList: ContainerListRunner = defaultRunner) {}

  async list(binary: string): Promise<MemoryContainerListResult> {
    try {
      const { stdout } = await this.runList(binary, ['tags', 'list', '--json']);
      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        return this.failure('invalid_output');
      }
      if (!Array.isArray(parsed)) return this.failure('invalid_output');
      const containers = parsed.map(parseContainer);
      if (containers.some((container) => container === null)) return this.failure('invalid_output');
      const tags = new Set((containers as MemoryContainer[]).map((container) => container.containerTag));
      if (tags.size !== containers.length) return this.failure('invalid_output');
      return {
        status: 'ready',
        containers: (containers as MemoryContainer[]).sort((left, right) => (
          left.name.localeCompare(right.name) || left.containerTag.localeCompare(right.containerTag)
        )),
      };
    } catch (error) {
      const details = error && typeof error === 'object'
        ? `${String((error as { message?: unknown }).message ?? '')} ${String((error as { stderr?: unknown }).stderr ?? '')}`.toLowerCase()
        : '';
      const authenticationFailure = [
        'not authenticated',
        'not logged in',
        'authentication required',
        'unauthorized',
        '401',
      ].some((marker) => details.includes(marker));
      return this.failure(authenticationFailure
        ? 'not_authenticated'
        : 'unavailable');
    }
  }

  private failure(status: Exclude<MemoryContainerListResult['status'], 'ready'>): MemoryContainerListResult {
    logger.warn('codex', 'Supermemory container discovery unavailable', { status });
    return { containers: [], status };
  }
}
