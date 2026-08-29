import type { ReviewComment, Severity, AnalysisSource } from '../../shared/types';
import { ANALYSIS_SOURCE_CONFIG } from '../../shared/types';
import { CommentRefinementInput } from './CommentRefinementInput';

interface CommentCardProps {
  comment: ReviewComment;
  selected?: boolean;
  onToggle?: (id: string) => void;
  lineUrl?: string;
  // Refinement props
  onRefine?: (id: string) => void;
  isRefining?: boolean;
  isRefineLoading?: boolean;
  onRefineCancel?: () => void;
  onRefineSubmit?: (instructions: string) => void;
  // Severity edit prop
  onSeverityChange?: (id: string, severity: Severity) => void;
}

// Analysis source badge component
function AnalysisSourceBadge({ source }: { source: AnalysisSource }) {
  const config = ANALYSIS_SOURCE_CONFIG[source];
  const colorClasses: Record<string, string> = {
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${colorClasses[config.color] || colorClasses.gray}`}
      title={`Found by ${config.label} specialist`}
    >
      <span className="text-[10px]">{config.icon}</span>
      <span className="font-medium">{config.label}</span>
    </span>
  );
}

const severityConfig: Record<Severity, { icon: string; bgClass: string; borderClass: string }> = {
  info: {
    icon: '📝',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    borderClass: 'border-blue-200 dark:border-blue-800',
  },
  suggestion: {
    icon: '💡',
    bgClass: 'bg-green-50 dark:bg-green-900/20',
    borderClass: 'border-green-200 dark:border-green-800',
  },
  warning: {
    icon: '⚠️',
    bgClass: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderClass: 'border-yellow-200 dark:border-yellow-800',
  },
  critical: {
    icon: '🚨',
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    borderClass: 'border-red-200 dark:border-red-800',
  },
};

const severityOptions: Severity[] = ['critical', 'warning', 'suggestion', 'info'];

export function CommentCard({
  comment,
  selected,
  onToggle,
  lineUrl,
  onRefine,
  isRefining = false,
  isRefineLoading = false,
  onRefineCancel,
  onRefineSubmit,
  onSeverityChange,
}: CommentCardProps) {
  const config = severityConfig[comment.severity];
  const showCheckbox = onToggle !== undefined;
  const showRefineButton = onRefine !== undefined && !isRefining;

  const handleRefineClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRefine?.(comment.id);
  };

  const handleSeverityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    onSeverityChange?.(comment.id, e.target.value as Severity);
  };

  const handleLineClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lineUrl) {
      try {
        await window.electronAPI.app.openExternal(lineUrl);
      } catch (error) {
        console.error('Failed to open external link:', error);
      }
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 ${config.bgClass} ${config.borderClass} ${
        showCheckbox ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      } ${selected === false ? 'opacity-50' : ''}`}
      onClick={() => showCheckbox && onToggle?.(comment.id)}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox for selection */}
        {showCheckbox && (
          <input
            type="checkbox"
            checked={selected ?? true}
            onChange={() => onToggle?.(comment.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        )}

        {/* Severity Icon */}
        <span className="text-lg flex-shrink-0" role="img" aria-label={comment.severity}>
          {config.icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Line Number + Severity Label */}
          <div className="flex items-center gap-2 mb-1">
            {comment.lineNumber && (
              lineUrl ? (
                <button
                  onClick={handleLineClick}
                  className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1"
                  title="Open in GitLab"
                >
                  Line {comment.lineNumber}
                </button>
              ) : (
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  Line {comment.lineNumber}
                </span>
              )
            )}
            {onSeverityChange ? (
              <select
                value={comment.severity}
                onChange={handleSeverityChange}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-medium px-1.5 py-0.5 rounded cursor-pointer border-0 focus:ring-2 focus:ring-offset-1 ${
                  comment.severity === 'critical' ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200 focus:ring-red-500' :
                  comment.severity === 'warning' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 focus:ring-yellow-500' :
                  comment.severity === 'suggestion' ? 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200 focus:ring-green-500' :
                  'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200 focus:ring-blue-500'
                }`}
              >
                {severityOptions.map((sev) => (
                  <option key={sev} value={sev}>
                    {sev.toUpperCase()}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                comment.severity === 'critical' ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200' :
                comment.severity === 'warning' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                comment.severity === 'suggestion' ? 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200' :
                'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              }`}>
                {comment.severity.toUpperCase()}
              </span>
            )}
            {/* Analysis Source Badge */}
            {comment.analysisSource && comment.analysisSource !== 'general' && (
              <AnalysisSourceBadge source={comment.analysisSource} />
            )}
          </div>

          {/* Comment Text */}
          <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
            {comment.comment}
          </p>

          {/* Code Snippet */}
          {comment.codeSnippet && (
            <div className="mt-2 rounded bg-gray-800 dark:bg-gray-900 p-2 overflow-x-auto">
              <code className="text-xs font-mono text-green-400 whitespace-pre">
                {comment.codeSnippet}
              </code>
            </div>
          )}

          {/* Refine Button */}
          {showRefineButton && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleRefineClick}
                className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600
                           text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700
                           hover:bg-gray-50 dark:hover:bg-gray-600
                           transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Refine
              </button>
            </div>
          )}

          {/* Refinement Input */}
          {isRefining && onRefineCancel && onRefineSubmit && (
            <CommentRefinementInput
              onRefine={onRefineSubmit}
              onCancel={onRefineCancel}
              isLoading={isRefineLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
