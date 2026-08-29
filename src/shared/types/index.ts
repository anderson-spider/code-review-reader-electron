// ============================================================================
// Shared Types - Code Review Reader Electron
// Barrel Export - Maintains backward compatibility with existing imports
// ============================================================================

// -----------------------------------------------------------------------------
// Type Exports
// -----------------------------------------------------------------------------

// Severity types
export type {
  Severity,
  LogLevel,
  LogSource,
  AnalysisSource,
} from './severity';

// Proxy types
export type {
  ProxyType,
  ProxySettings,
} from './proxy';

// Prompt types
export type {
  PromptProfile,
  PromptConfig,
} from './prompt';

// Utility types
export type {
  LoadingState,
  AsyncState,
} from './utility';
export { createAsyncState } from './utility';

// Error types
export type {
  GitLabErrorType,
  GitLabError,
} from './errors';

// GitLab types
export type {
  Author,
  MergeRequest,
  FileChange,
  MRChangesResponse,
  GitLabFileResponse,
  DiffVersion,
  GitLabNote,
  CommentPosition,
  GitLabComment,
  GitLabDiscussion,
  GitLabProject,
  ParsedMRUrl,
} from './gitlab';

// Progress types
export type {
  ReviewStage,
  ReviewProgress,
  LogEntry,
} from './progress';

// Settings types
export type {
  AppSettings,
  PostResult,
  SettingsCategory,
  AppView,
  ThemePreference,
  FontSize,
  AppearanceSettings,
  SaveMessage,
  SettingsSectionProps,
  MemorySettings,
  ProjectMemoryMapping,
  MemoryContainer,
  MemoryContainerListResult,
  MemoryContainerListStatus,
} from './settings';

// Review types
export type {
  ReviewComment,
  CodeReview,
  ParallelAnalysisOptions,
  RefinementState,
  RefineCommentRequest,
  RefineCommentResult,
  ReviewExportData,
} from './review';

// Repository types
export type {
  RepositoryStage,
  RepositoryProgress,
  FileWithContent,
  ProjectStructure,
  ExpandedContext,
  LocalCheckoutOptions,
} from './repository';

// -----------------------------------------------------------------------------
// Constant Exports
// -----------------------------------------------------------------------------

export {
  // Severity constants
  ANALYSIS_SOURCE_CONFIG,
  SEVERITY_CONFIG,
  // Prompt constants
  DEFAULT_CUSTOM_INSTRUCTIONS,
  CODE_SNIPPET_INSTRUCTIONS,
  FIXED_JSON_FORMAT,
  DEFAULT_PROMPT_PROFILE,
  DEFAULT_PROMPT_CONFIG,
  // Default values
  DEFAULT_PROXY_SETTINGS,
  DEFAULT_PARALLEL_ANALYSIS_OPTIONS,
  DEFAULT_LOCAL_CHECKOUT_OPTIONS,
  DEFAULT_APPEARANCE_SETTINGS,
  INITIAL_REFINEMENT_STATE,
  // IPC channels
  IPC_CHANNELS,
  // Progress phrases
  THINKING_PHRASES,
} from './constants';

export { DEFAULT_MEMORY_SETTINGS } from './settings';
