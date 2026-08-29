import { useMemo } from 'react';
import type { ReviewComment } from '../../shared/types';
import { SEVERITY_CONFIG } from '../../shared/types';

interface ApprovabilityBadgeProps {
  comments: ReviewComment[];
  onApprove?: () => void;
}

interface SeverityCounts {
  critical: number;
  warning: number;
  suggestion: number;
  info: number;
}

export function ApprovabilityBadge({ comments, onApprove }: ApprovabilityBadgeProps) {
  // Calculate severity counts
  const counts = useMemo<SeverityCounts>(() => {
    return comments.reduce(
      (acc, comment) => {
        acc[comment.severity]++;
        return acc;
      },
      { critical: 0, warning: 0, suggestion: 0, info: 0 } as SeverityCounts
    );
  }, [comments]);

  // Per RN-APV-001: approvable = (count_critical == 0) AND (count_warning == 0)
  const isApprovable = counts.critical === 0 && counts.warning === 0;

  // Build summary parts (only show non-zero counts)
  const summaryParts: string[] = [];

  if (counts.critical > 0) {
    summaryParts.push(`${SEVERITY_CONFIG.critical.icon} ${counts.critical} Critical`);
  }
  if (counts.warning > 0) {
    summaryParts.push(`${SEVERITY_CONFIG.warning.icon} ${counts.warning} Warning`);
  }
  if (counts.suggestion > 0) {
    summaryParts.push(`${SEVERITY_CONFIG.suggestion.icon} ${counts.suggestion} Suggestion${counts.suggestion !== 1 ? 's' : ''}`);
  }
  if (counts.info > 0) {
    summaryParts.push(`${SEVERITY_CONFIG.info.icon} ${counts.info} Info`);
  }

  const summaryText = summaryParts.length > 0 ? summaryParts.join(' | ') : 'No issues found';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {/* Approvability Badge */}
            {isApprovable ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-semibold">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Approvable</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-semibold">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Not Approvable</span>
              </div>
            )}

            <h3 className="font-semibold text-gray-900 dark:text-white">Approvability Verdict</h3>
          </div>

          {/* Summary counts */}
          <p className="text-sm text-gray-700 dark:text-gray-300">{summaryText}</p>

          {/* Blocking reason if not approvable */}
          {!isApprovable && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {counts.critical > 0 && counts.warning > 0
                ? 'Contains critical issues and warnings that must be addressed'
                : counts.critical > 0
                  ? 'Contains critical issues that must be addressed'
                  : 'Contains warnings that must be addressed'}
            </p>
          )}
        </div>

        {/* Approve button - only show if approvable and callback provided */}
        {isApprovable && onApprove && (
          <button
            onClick={onApprove}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Approve MR
          </button>
        )}
      </div>
    </div>
  );
}
