// -----------------------------------------------------------------------------
// Review Progress Types
// -----------------------------------------------------------------------------

import type { LogLevel, LogSource } from './severity';

export type ReviewStage = 'filtering' | 'preparing' | 'analyzing' | 'parsing' | 'complete' | 'error';

export interface ReviewProgress {
  stage: ReviewStage;
  files: string[];           // Files to be analyzed (after filtering)
  totalFiles: number;        // Original file count before filtering
  filteredCount: number;     // Number of files filtered out
  progress: number;          // 0-100 percentage (simulated during 'analyzing')
  currentMessage: string;    // Current status message
  error?: string;            // Error message if stage is 'error'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  data?: Record<string, unknown>;
}
