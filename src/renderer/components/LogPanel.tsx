import { useEffect, useRef, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Filter,
  GripHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLogStore, selectFilteredLogs, selectLogCounts } from '../store/logStore';
import type { LogLevel, LogSource } from '@shared/types';

const LEVEL_ICONS: Record<LogLevel, React.ReactNode> = {
  debug: <Bug className="w-3.5 h-3.5 text-gray-400" />,
  info: <Info className="w-3.5 h-3.5 text-blue-400" />,
  warn: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />,
  error: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'text-gray-400',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const SOURCE_COLORS: Record<LogSource, string> = {
  app: 'bg-purple-500/20 text-purple-300',
  ipc: 'bg-cyan-500/20 text-cyan-300',
  gitlab: 'bg-orange-500/20 text-orange-300',
  codex: 'bg-emerald-500/20 text-emerald-300',
  repository: 'bg-pink-500/20 text-pink-300',
  config: 'bg-slate-500/20 text-slate-300',
};

const LEVEL_OPTIONS: Array<LogLevel | 'all'> = ['all', 'debug', 'info', 'warn', 'error'];
const SOURCE_OPTIONS: Array<LogSource | 'all'> = ['all', 'app', 'ipc', 'gitlab', 'codex', 'repository', 'config'];

export function LogPanel() {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const isExpanded = useLogStore((state) => state.isExpanded);
  const panelHeight = useLogStore((state) => state.panelHeight);
  const filterLevel = useLogStore((state) => state.filterLevel);
  const filterSource = useLogStore((state) => state.filterSource);
  const toggleExpanded = useLogStore((state) => state.toggleExpanded);
  const clearLogs = useLogStore((state) => state.clearLogs);
  const setPanelHeight = useLogStore((state) => state.setPanelHeight);
  const setFilterLevel = useLogStore((state) => state.setFilterLevel);
  const setFilterSource = useLogStore((state) => state.setFilterSource);

  const filteredLogs = useLogStore(selectFilteredLogs);
  const { total, errors, warnings } = useLogStore(selectLogCounts);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs.length, isExpanded]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startY.current = e.clientY;
    startHeight.current = panelHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [panelHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const deltaY = startY.current - e.clientY;
      const newHeight = startHeight.current + deltaY;
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setPanelHeight]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col"
      style={{ height: isExpanded ? panelHeight : 40 }}
    >
      {/* Resize handle - visible when expanded */}
      {isExpanded && (
        <div
          onMouseDown={handleMouseDown}
          className="h-1 cursor-ns-resize hover:bg-blue-500/50 transition-colors flex items-center justify-center group"
        >
          <GripHorizontal className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Header - Always visible */}
      <div
        className="h-10 px-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Logs
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {total} entries
          </span>
          {errors > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" />
              {errors}
            </span>
          )}
          {warnings > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-500">
              <AlertTriangle className="w-3 h-3" />
              {warnings}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Toolbar */}
          <div className="px-3 py-1.5 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
            <Filter className="w-3.5 h-3.5 text-gray-500" />

            {/* Level filter */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as LogLevel | 'all')}
              onClick={(e) => e.stopPropagation()}
              className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300"
            >
              {LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level === 'all' ? 'All levels' : level}
                </option>
              ))}
            </select>

            {/* Source filter */}
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as LogSource | 'all')}
              onClick={(e) => e.stopPropagation()}
              className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300"
            >
              {SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>
                  {source === 'all' ? 'All sources' : source}
                </option>
              ))}
            </select>

            <div className="flex-1" />

            {/* Clear button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearLogs();
              }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>

          {/* Log entries */}
          <div className="flex-1 overflow-auto font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                No logs to display
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      'py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800',
                      log.level === 'error' && 'bg-red-50 dark:bg-red-900/10',
                      log.level === 'warn' && 'bg-yellow-50 dark:bg-yellow-900/10'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {/* Level icon */}
                      <span className="flex-shrink-0 mt-0.5">
                        {LEVEL_ICONS[log.level]}
                      </span>

                      {/* Timestamp */}
                      <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                        {formatTime(log.timestamp)}
                      </span>

                      {/* Source badge */}
                      <span
                        className={cn(
                          'flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase font-medium',
                          SOURCE_COLORS[log.source]
                        )}
                      >
                        {log.source}
                      </span>

                      {/* Message */}
                      <span className={cn('flex-1', LEVEL_COLORS[log.level])}>
                        {log.message}
                      </span>
                    </div>

                    {/* Data (if present) - on separate line */}
                    {log.data && (
                      <div className="ml-6 mt-0.5 text-gray-400 dark:text-gray-500 break-all">
                        {JSON.stringify(log.data)}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
