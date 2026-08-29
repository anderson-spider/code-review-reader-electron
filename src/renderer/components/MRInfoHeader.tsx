import type { MergeRequest, FileChange } from '../../shared/types';

interface MRInfoHeaderProps {
  mr: MergeRequest;
  changes?: FileChange[];
}

/**
 * Calculate additions and deletions from file changes by parsing diff
 */
function calculateDiffStats(changes: FileChange[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const change of changes) {
    const lines = change.diff.split('\n');
    for (const line of lines) {
      // Lines starting with + (but not +++) are additions
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      }
      // Lines starting with - (but not ---) are deletions
      else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
  }

  return { additions, deletions };
}

/**
 * MR Info Header component
 * Displays merge request metadata in a compact, informative format
 * Following APP_RULES.md RN-OUT-001 specification
 */
export function MRInfoHeader({ mr, changes = [] }: MRInfoHeaderProps) {
  const { additions, deletions } = calculateDiffStats(changes);
  const changesCount = mr.changes_count ?? changes.length;

  const handleOpenMR = async () => {
    try {
      await window.electronAPI.app.openExternal(mr.web_url);
    } catch (error) {
      console.error('Failed to open MR URL:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Title with MR number - clickable */}
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xl">📊</span>
        <div className="flex-1 min-w-0">
          <button
            onClick={handleOpenMR}
            className="text-left hover:underline focus:outline-none focus:underline"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              MR !{mr.iid}: {mr.title}
            </h2>
          </button>
        </div>
      </div>

      {/* Metadata tree structure */}
      <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300 font-mono">
        {/* Author */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 dark:text-gray-600">├─</span>
          <span>👤 Author: {mr.author.name}</span>
        </div>

        {/* Branches */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 dark:text-gray-600">├─</span>
          <span className="flex items-center gap-2">
            🎯
            <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-blue-800 dark:text-blue-300">
              {mr.source_branch}
            </span>
            <span>→</span>
            <span className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-green-800 dark:text-green-300">
              {mr.target_branch}
            </span>
          </span>
        </div>

        {/* Files count */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 dark:text-gray-600">├─</span>
          <span>
            📁 {changesCount} {changesCount === 1 ? 'file' : 'files'}
          </span>
        </div>

        {/* Line changes */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 dark:text-gray-600">└─</span>
          <span className="flex items-center gap-2">
            📈
            <span className="text-green-600 dark:text-green-400">+{additions}</span>
            <span>/</span>
            <span className="text-red-600 dark:text-red-400">-{deletions}</span>
            <span className="text-gray-500 dark:text-gray-400">lines</span>
          </span>
        </div>
      </div>

      {/* Status indicators if needed */}
      {mr.has_conflicts && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-300">
          <span>⚠️</span>
          <span>This MR has conflicts and needs to be rebased</span>
        </div>
      )}
    </div>
  );
}
