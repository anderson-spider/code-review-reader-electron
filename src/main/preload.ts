import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
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
} from '../shared/types';

// Type definitions for the exposed API
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
    generateReview: (mr: MergeRequest, changes: FileChange[], includeTests?: boolean, expandedContext?: ExpandedContext | null, memoryContainerTag?: string | null) => Promise<CodeReview>;
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

// Expose protected methods via contextBridge
const electronAPI: ElectronAPI = {
  gitlab: {
    init: (baseURL: string) => ipcRenderer.invoke('gitlab:init', baseURL),
    reinit: (baseURL: string) => ipcRenderer.invoke('gitlab:reinit', baseURL),
    parseURL: (url: string) => ipcRenderer.invoke('gitlab:parseURL', url),
    fetchMR: (projectPath: string, mrIID: number) =>
      ipcRenderer.invoke('gitlab:fetchMR', projectPath, mrIID),
    fetchChanges: (projectPath: string, mrIID: number) =>
      ipcRenderer.invoke('gitlab:fetchChanges', projectPath, mrIID),
    fetchProject: (projectPath: string) =>
      ipcRenderer.invoke('gitlab:fetchProject', projectPath),
    postComment: (projectPath: string, mrIID: number, body: string) =>
      ipcRenderer.invoke('gitlab:postComment', projectPath, mrIID, body),
    postLineComment: (
      projectPath: string,
      mrIID: number,
      filePath: string,
      lineNumber: number,
      body: string,
      fileChange?: FileChange
    ) =>
      ipcRenderer.invoke(
        'gitlab:postLineComment',
        projectPath,
        mrIID,
        filePath,
        lineNumber,
        body,
        fileChange
      ),
    deleteMyComments: (projectPath: string, mrIID: number) =>
      ipcRenderer.invoke('gitlab:deleteMyComments', projectPath, mrIID),
    fetchExistingComments: (projectPath: string, mrIID: number) =>
      ipcRenderer.invoke('gitlab:fetchExistingComments', projectPath, mrIID),
    approveMR: (projectPath: string, mrIID: number) =>
      ipcRenderer.invoke('gitlab:approveMR', projectPath, mrIID),
    fetchFile: (projectPath: string, filePath: string, ref: string) =>
      ipcRenderer.invoke('gitlab:fetchFile', projectPath, filePath, ref),
  },

  review: {
    generateReview: (
      mr: MergeRequest,
      changes: FileChange[],
      includeTests = false,
      expandedContext?: ExpandedContext | null,
      memoryContainerTag?: string | null,
    ) => ipcRenderer.invoke(IPC_CHANNELS.REVIEW_GENERATE, mr, changes, includeTests, expandedContext, memoryContainerTag),
    generateParallelReview: (
      mr: MergeRequest,
      changes: FileChange[],
      includeTests = false,
      options?: ParallelAnalysisOptions,
      expandedContext?: ExpandedContext | null,
      memoryContainerTag?: string | null,
    ) => ipcRenderer.invoke(IPC_CHANNELS.REVIEW_GENERATE_PARALLEL, mr, changes, includeTests, options, expandedContext, memoryContainerTag),
    refineComment: (comment: ReviewComment, instructions: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_REFINE_COMMENT, comment, instructions),
  },

  repository: {
    clone: (sshUrl: string, branch: string) =>
      ipcRenderer.invoke('repository:clone', sshUrl, branch),
    readContext: (
      repoPath: string,
      changes: FileChange[],
      options?: { tokenBudget?: number; maxRelatedDepth?: number }
    ) => ipcRenderer.invoke('repository:readContext', repoPath, changes, options),
    cleanup: (repoPath: string) =>
      ipcRenderer.invoke('repository:cleanup', repoPath),
  },

  config: {
    saveToken: (token: string) => ipcRenderer.invoke('config:saveToken', token),
    getToken: () => ipcRenderer.invoke('config:getToken'),
    hasToken: () => ipcRenderer.invoke('config:hasToken'),
    deleteToken: () => ipcRenderer.invoke('config:deleteToken'),
    getProxySettings: () => ipcRenderer.invoke('config:getProxySettings'),
    setProxySettings: (settings: ProxySettings) => ipcRenderer.invoke('config:setProxySettings', settings),
    resetProxySettings: () => ipcRenderer.invoke('config:resetProxySettings'),
    // Prompt profile operations
    getPromptConfig: () => ipcRenderer.invoke('config:getPromptConfig'),
    setPromptConfig: (config: PromptConfig) => ipcRenderer.invoke('config:setPromptConfig', config),
    getActivePromptProfile: () => ipcRenderer.invoke('config:getActivePromptProfile'),
    savePromptProfile: (profile: PromptProfile) => ipcRenderer.invoke('config:savePromptProfile', profile),
    deletePromptProfile: (profileId: string) => ipcRenderer.invoke('config:deletePromptProfile', profileId),
    setActivePromptProfile: (profileId: string) => ipcRenderer.invoke('config:setActivePromptProfile', profileId),
    resetPromptConfig: () => ipcRenderer.invoke('config:resetPromptConfig'),
    getMemorySettings: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_MEMORY_SETTINGS),
    setMemorySettings: (settings: MemorySettings) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_MEMORY_SETTINGS, settings),
  },

  memory: {
    listContainers: () => ipcRenderer.invoke(IPC_CHANNELS.MEMORY_LIST_CONTAINERS),
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  },

  // Review progress events listener
  onReviewProgress: (callback: (progress: ReviewProgress) => void) => {
    const handler = (_event: IpcRendererEvent, progress: ReviewProgress) => {
      callback(progress);
    };
    ipcRenderer.on('review:progress', handler);
    // Return cleanup function to remove the listener
    return () => {
      ipcRenderer.removeListener('review:progress', handler);
    };
  },

  // Repository progress events listener
  onRepositoryProgress: (callback: (progress: RepositoryProgress) => void) => {
    const handler = (_event: IpcRendererEvent, progress: RepositoryProgress) => {
      callback(progress);
    };
    ipcRenderer.on('repository:progress', handler);
    // Return cleanup function to remove the listener
    return () => {
      ipcRenderer.removeListener('repository:progress', handler);
    };
  },

  // Log events listener
  onLogEntry: (callback: (entry: LogEntry) => void) => {
    const handler = (_event: IpcRendererEvent, entry: LogEntry) => {
      callback(entry);
    };
    ipcRenderer.on('log:entry', handler);
    // Return cleanup function to remove the listener
    return () => {
      ipcRenderer.removeListener('log:entry', handler);
    };
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for the renderer process
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
