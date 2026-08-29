import type { ReviewComment } from '../../shared/types';

interface ReviewSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  postedCount: number;
  skippedCount: number;
  failedCount: number;
  comments: ReviewComment[];
  mrUrl: string;
}

/**
 * Modal displaying detailed post-review summary per APP_RULES.md RN-OUT-002
 * Shows:
 * - Posted, skipped, and failed counts
 * - Breakdown by severity
 * - Link to MR (clickable)
 * - Color-coded header based on status
 */
export function ReviewSummaryModal({
  isOpen,
  onClose,
  postedCount,
  skippedCount,
  failedCount,
  comments,
  mrUrl,
}: ReviewSummaryModalProps) {
  if (!isOpen) return null;

  // Calculate severity breakdown
  const severityCounts = comments.reduce(
    (acc, comment) => {
      if (comment.severity !== 'info') {
        acc[comment.severity] = (acc[comment.severity] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const criticalCount = severityCounts.critical || 0;
  const warningCount = severityCounts.warning || 0;
  const suggestionCount = severityCounts.suggestion || 0;

  // Determine header color based on status
  const getHeaderStyle = () => {
    if (failedCount > 0) {
      return 'bg-red-600 dark:bg-red-700';
    }
    if (skippedCount > 0) {
      return 'bg-yellow-600 dark:bg-yellow-700';
    }
    return 'bg-green-600 dark:bg-green-700';
  };

  const getHeaderIcon = () => {
    if (failedCount > 0) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    }
    if (skippedCount > 0) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  };

  const handleOpenMR = () => {
    window.electronAPI.app.openExternal(mrUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className={`${getHeaderStyle()} text-white p-6`}>
          <div className="flex items-center gap-3">
            {getHeaderIcon()}
            <h2 className="text-xl font-bold">Review Summary</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Posting Statistics */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <span className="text-green-600 dark:text-green-400">✅</span>
              <span>Comments posted: <strong>{postedCount}</strong></span>
            </div>

            {skippedCount > 0 && (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span className="text-yellow-600 dark:text-yellow-400">⏭️</span>
                <span>Skipped (duplicates): <strong>{skippedCount}</strong></span>
              </div>
            )}

            {failedCount > 0 && (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span className="text-red-600 dark:text-red-400">❌</span>
                <span>Failed: <strong>{failedCount}</strong></span>
              </div>
            )}
          </div>

          {/* Severity Breakdown */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-500 dark:text-gray-400">📊</span>
              <h3 className="font-semibold text-gray-900 dark:text-white">Issues Breakdown</h3>
            </div>
            <div className="space-y-2">
              {criticalCount > 0 && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className="text-red-600 dark:text-red-400">🚨</span>
                  <span>Critical: <strong>{criticalCount}</strong></span>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
                  <span>Warnings: <strong>{warningCount}</strong></span>
                </div>
              )}
              {suggestionCount > 0 && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className="text-green-600 dark:text-green-400">💡</span>
                  <span>Suggestions: <strong>{suggestionCount}</strong></span>
                </div>
              )}
              {criticalCount === 0 && warningCount === 0 && suggestionCount === 0 && (
                <div className="text-gray-500 dark:text-gray-400 text-sm italic">
                  No issues to report
                </div>
              )}
            </div>
          </div>

          {/* MR Link */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              onClick={handleOpenMR}
              className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline w-full"
            >
              <span>🔗</span>
              <span className="truncate">Open Merge Request</span>
              <svg className="w-4 h-4 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
