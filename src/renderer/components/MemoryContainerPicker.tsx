import { RefreshCw } from 'lucide-react';
import type { MemoryContainer, MemoryContainerListStatus } from '../../shared/types';

export interface MemoryProjectIdentity {
  projectUrl: string;
  slug: string;
  tagPrefix: string;
}

export function resolveMemoryProject(value: string): MemoryProjectIdentity | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const projectPathMatch = url.pathname.match(/^\/(.+?)\/-\/merge_requests\/\d+\/?$/)
      ?? url.pathname.match(/^\/projects\/(.+?)\/merge_requests\/\d+\/?$/)
      ?? url.pathname.match(/^\/(.+?)\/merge_requests\/\d+\/?$/);
    if (!projectPathMatch?.[1]) return null;
    const projectPath = `/${projectPathMatch[1]}`.replace(/\.git$/, '').replace(/\/$/, '');
    const slug = projectPath.split('/').filter(Boolean).at(-1);
    if (!slug) return null;
    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!normalizedSlug) return null;
    return {
      projectUrl: `${url.origin}${projectPath}`,
      slug,
      tagPrefix: `repo_${normalizedSlug}__`,
    };
  } catch {
    return null;
  }
}

interface MemoryContainerPickerProps {
  project: MemoryProjectIdentity | null;
  containers: readonly MemoryContainer[];
  status: MemoryContainerListStatus;
  value: string;
  disabled?: boolean;
  refreshing?: boolean;
  onChange: (containerTag: string) => void;
  onRefresh: () => void;
}

const statusText: Record<Exclude<MemoryContainerListStatus, 'ready'>, string> = {
  not_authenticated: 'Execute supermemory login e atualize a lista.',
  unavailable: 'Supermemory CLI indisponível. O review continuará sem memória.',
  invalid_output: 'A lista de containers retornou um formato inválido.',
};

export function MemoryContainerPicker({
  project,
  containers,
  status,
  value,
  disabled = false,
  refreshing = false,
  onChange,
  onRefresh,
}: MemoryContainerPickerProps) {
  const matching = project
    ? containers.filter((container) => container.containerTag.startsWith(project.tagPrefix))
    : [];
  const matchingTags = new Set(matching.map((container) => container.containerTag));
  const others = containers.filter((container) => !matchingTags.has(container.containerTag));

  return (
    <div
      className="flex min-w-0 flex-1 items-end gap-2"
      aria-busy={refreshing}
    >
      <label className="min-w-0 flex-1 text-xs text-gray-500 dark:text-gray-400">
        Project memory
        <select
          aria-label="Project memory container"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || !project || refreshing}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="">Sem memória de projeto</option>
          {matching.length > 0 && (
            <optgroup label={`Recommended for ${project?.slug}`}>
              {matching.map((container) => (
                <option key={container.containerTag} value={container.containerTag}>
                  {container.name} · {container.memoryCount} memories
                </option>
              ))}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label="Other spaces">
              {others.map((container) => (
                <option key={container.containerTag} value={container.containerTag}>
                  {container.name} · {container.memoryCount} memories
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <span className="mt-1 block" aria-live="polite">
          {!project && 'Enter a valid GitLab MR URL.'}
          {project && status !== 'ready' && statusText[status]}
        </span>
      </label>
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled || refreshing}
        aria-label="Refresh Supermemory containers"
        title="Refresh Supermemory containers"
        className="rounded-lg border border-gray-300 p-2 text-gray-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
