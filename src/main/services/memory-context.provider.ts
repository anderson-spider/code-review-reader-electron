import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FileChange, MemorySettings, MergeRequest } from '../../shared/types';
import { logger } from './logger.service';

const execFileAsync = promisify(execFile);
const MAX_MEMORY_TOKENS = 4_000;
const MAX_MEMORY_CHARS = MAX_MEMORY_TOKENS * 4;
const SEARCH_TIMEOUT_MS = 8_000;

export interface MemoryContextInput {
  readonly mr: MergeRequest;
  readonly changes: readonly FileChange[];
  readonly settings: MemorySettings;
  readonly containerTag?: string | null;
}

export interface MemoryContextProvider {
  retrieve(input: MemoryContextInput): Promise<string | null>;
}

export type SmfsSearchRunner = (
  binary: string,
  args: readonly string[],
) => Promise<string>;

const defaultSearchRunner: SmfsSearchRunner = async (binary, args) => {
  const { stdout } = await execFileAsync(binary, [...args], {
    encoding: 'utf8',
    timeout: SEARCH_TIMEOUT_MS,
    maxBuffer: MAX_MEMORY_CHARS + 1,
    windowsHide: true,
    shell: false,
  });
  return stdout;
};

function normalizeProjectUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const projectPath = url.pathname.split('/-/merge_requests/')[0]
      ?.replace(/\.git$/, '')
      .replace(/\/$/, '');
    return projectPath ? `${url.origin}${projectPath}` : null;
  } catch {
    return null;
  }
}

function buildSearchQuery(mr: MergeRequest, changes: readonly FileChange[]): string {
  const description = (mr.description ?? '').slice(0, 2_000);
  const paths = changes.map((change) => change.new_path).slice(0, 200).join('\n');
  return `Merge request: ${mr.title}\nDescription: ${description}\nChanged files:\n${paths}`;
}

export class SmfsMemoryContextProvider implements MemoryContextProvider {
  constructor(private readonly runSearch: SmfsSearchRunner = defaultSearchRunner) {}

  async retrieve(input: MemoryContextInput): Promise<string | null> {
    if (input.containerTag === null) return null;
    const projectUrl = normalizeProjectUrl(input.mr.web_url);
    const mapping = projectUrl
      ? input.settings.projects.find((candidate) => (
          candidate.enabled && normalizeProjectUrl(candidate.projectUrl) === projectUrl
        ))
      : undefined;
    const containerTag = input.containerTag?.trim() || mapping?.containerTag;
    if (!containerTag) return null;

    try {
      const output = (await this.runSearch(
        input.settings.smfsBinaryPath,
        ['grep', '--tag', containerTag, buildSearchQuery(input.mr, input.changes)],
      )).trim();
      if (!output) return null;
      if (output.length > MAX_MEMORY_CHARS) {
        this.warn('output_limit_exceeded');
        return null;
      }
      return output;
    } catch {
      this.warn('search_unavailable');
      return null;
    }
  }

  private warn(reason: string): void {
    logger.warn('codex', 'Project memory unavailable; continuing without memory', { reason });
  }
}
