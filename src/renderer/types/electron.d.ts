// Type definitions for the Electron API exposed via preload script
import type {
  MergeRequest,
  FileChange,
  CodeReview,
  ParsedMRUrl,
  GitLabComment,
  GitLabProject,
  ProxySettings,
  ReviewProgress,
  RepositoryProgress,
  ExpandedContext,
  PromptProfile,
  PromptConfig,
  ReviewComment,
  RefineCommentResult,
  ParallelAnalysisOptions,
  LogEntry,
  MemorySettings,
  MemoryContainerListResult,
} from '../../shared/types';

export interface ElectronAPI {
  // GitLab operations
  gitlab: {
    init: (baseURL: string) => Promise<boolean>;
    reinit: (baseURL: string) => Promise<boolean>;
    parseURL: (url: string) => Promise<ParsedMRUrl>;
    fetchMR: (projectPath: string, mrIID: number) => Promise<MergeRequest>;
    fetchChanges: (projectPath: string, mrIID: number) => Promise<FileChange[]>;
    fetchProject: (projectPath: string) => Promise<GitLabProject>;
    postComment: (projectPath: string, mrIID: number, body: string) => Promise<void>;
    postLineComment: (
      projectPath: string,
      mrIID: number,
      filePath: string,
      lineNumber: number,
      body: string,
      fileChange?: FileChange
    ) => Promise<void>;
    deleteMyComments: (projectPath: string, mrIID: number) => Promise<number>;
    fetchExistingComments: (projectPath: string, mrIID: number) => Promise<GitLabComment[]>;
    approveMR: (projectPath: string, mrIID: number) => Promise<void>;
    fetchFile: (projectPath: string, filePath: string, ref: string) => Promise<string | null>;
  };

  // Review operations
  review: {
    generateReview: (
      mr: MergeRequest,
      changes: FileChange[],
      includeTests?: boolean,
      expandedContext?: ExpandedContext | null,
      memoryContainerTag?: string | null,
    ) => Promise<CodeReview>;
    generateParallelReview: (
      mr: MergeRequest,
      changes: FileChange[],
      includeTests?: boolean,
      options?: ParallelAnalysisOptions,
      expandedContext?: ExpandedContext | null,
      memoryContainerTag?: string | null,
    ) => Promise<CodeReview>;
    refineComment: (comment: ReviewComment, instructions: string) => Promise<RefineCommentResult>;
  };

  // Repository operations (local checkout)
  repository: {
    clone: (sshUrl: string, branch: string) => Promise<string>;
    readContext: (
      repoPath: string,
      changes: FileChange[],
      options?: { tokenBudget?: number; maxRelatedDepth?: number }
    ) => Promise<ExpandedContext>;
    cleanup: (repoPath: string) => Promise<void>;
  };

  // Config operations (token storage + proxy + prompts)
  config: {
    saveToken: (token: string) => Promise<void>;
    getToken: () => Promise<string | null>;
    hasToken: () => Promise<boolean>;
    deleteToken: () => Promise<void>;
    getProxySettings: () => Promise<ProxySettings>;
    setProxySettings: (settings: ProxySettings) => Promise<void>;
    resetProxySettings: () => Promise<void>;
    // Prompt profile operations
    getPromptConfig: () => Promise<PromptConfig>;
    setPromptConfig: (config: PromptConfig) => Promise<void>;
    getActivePromptProfile: () => Promise<PromptProfile>;
    savePromptProfile: (profile: PromptProfile) => Promise<void>;
    deletePromptProfile: (profileId: string) => Promise<void>;
    setActivePromptProfile: (profileId: string) => Promise<void>;
    resetPromptConfig: () => Promise<void>;
    getMemorySettings: () => Promise<MemorySettings>;
    setMemorySettings: (settings: MemorySettings) => Promise<void>;
  };

  memory: {
    listContainers: () => Promise<MemoryContainerListResult>;
  };

  // App operations
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    openExternal: (url: string) => Promise<void>;
  };

  // Review progress events
  onReviewProgress: (callback: (progress: ReviewProgress) => void) => () => void;

  // Repository progress events
  onRepositoryProgress: (callback: (progress: RepositoryProgress) => void) => () => void;

  // Log events
  onLogEntry: (callback: (entry: LogEntry) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
