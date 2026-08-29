// -----------------------------------------------------------------------------
// Severity Types
// -----------------------------------------------------------------------------

export type Severity = 'info' | 'suggestion' | 'warning' | 'critical';

// Log types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSource = 'app' | 'ipc' | 'gitlab' | 'codex' | 'repository' | 'config';

// Analysis source types for parallel specialist analysis
export type AnalysisSource =
  | 'security'
  | 'performance'
  | 'architecture'
  | 'testing'
  | 'best-practices'
  | 'general';
