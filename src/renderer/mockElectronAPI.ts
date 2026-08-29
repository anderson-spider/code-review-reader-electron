/**
 * Mock Electron API for browser-only development and E2E testing
 * This mock is loaded when window.electronAPI is not available (i.e., not in Electron)
 */
import type { ElectronAPI } from './types/electron';
import type { MergeRequest, FileChange, CodeReview, ParsedMRUrl, GitLabComment, GitLabProject, ReviewProgress, RepositoryProgress, ExpandedContext, PromptConfig, PromptProfile, ReviewComment, RefineCommentResult, ParallelAnalysisOptions, MemorySettings, MemoryContainerListResult } from '../shared/types';
import { DEFAULT_MEMORY_SETTINGS, DEFAULT_PROMPT_CONFIG } from '../shared/types';

// Sample mock data for testing
const mockMR: MergeRequest = {
  id: 1,
  iid: 123,
  title: 'Test MR',
  description: 'This is a test merge request',
  author: { id: 1, name: 'Test User', username: 'testuser' },
  source_branch: 'feature/test',
  target_branch: 'main',
  state: 'opened',
  web_url: 'https://gitlab.com/test/project/-/merge_requests/123',
  sha: 'abc123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockReview: CodeReview = {
  summary: 'This is a mock code review summary.',
  comments: [],
  overallAssessment: 'Mock assessment - no issues found.',
};

export const mockElectronAPI: ElectronAPI = {
  gitlab: {
    init: async (_baseURL: string): Promise<boolean> => {
      console.log('[Mock] GitLab init called with:', _baseURL);
      return true;
    },
    reinit: async (_baseURL: string): Promise<boolean> => {
      console.log('[Mock] GitLab reinit called with:', _baseURL);
      return true;
    },
    parseURL: async (url: string): Promise<ParsedMRUrl> => {
      console.log('[Mock] GitLab parseURL called with:', url);
      // Parse a simple GitLab URL format
      const match = url.match(/gitlab\.com\/(.+)\/-\/merge_requests\/(\d+)/);
      if (match) {
        return {
          projectPath: match[1],
          mrIID: parseInt(match[2], 10),
        };
      }
      throw new Error('Invalid GitLab MR URL');
    },
    fetchMR: async (_projectPath: string, mrIID: number): Promise<MergeRequest> => {
      console.log('[Mock] GitLab fetchMR called');
      return { ...mockMR, iid: mrIID };
    },
    fetchChanges: async (_projectPath: string, _mrIID: number): Promise<FileChange[]> => {
      console.log('[Mock] GitLab fetchChanges called');
      return [];
    },
    fetchProject: async (projectPath: string): Promise<GitLabProject> => {
      console.log('[Mock] GitLab fetchProject called:', projectPath);
      return {
        id: 1,
        name: 'mock-project',
        path: projectPath.split('/').pop() || 'project',
        path_with_namespace: projectPath,
        ssh_url_to_repo: `git@gitlab.com:${projectPath}.git`,
        http_url_to_repo: `https://gitlab.com/${projectPath}.git`,
        default_branch: 'main',
      };
    },
    postComment: async (_projectPath: string, _mrIID: number, _body: string): Promise<void> => {
      console.log('[Mock] GitLab postComment called');
    },
    postLineComment: async (
      _projectPath: string,
      _mrIID: number,
      _filePath: string,
      _lineNumber: number,
      _body: string,
      _fileChange?: FileChange
    ): Promise<void> => {
      console.log('[Mock] GitLab postLineComment called');
    },
    deleteMyComments: async (_projectPath: string, _mrIID: number): Promise<number> => {
      console.log('[Mock] GitLab deleteMyComments called');
      return 0;
    },
    fetchExistingComments: async (_projectPath: string, _mrIID: number): Promise<GitLabComment[]> => {
      console.log('[Mock] GitLab fetchExistingComments called');
      return [];
    },
    approveMR: async (_projectPath: string, _mrIID: number): Promise<void> => {
      console.log('[Mock] GitLab approveMR called');
    },
    fetchFile: async (_projectPath: string, filePath: string, _ref: string): Promise<string | null> => {
      console.log('[Mock] GitLab fetchFile called:', filePath);
      return null;
    },
  },

  review: {
    generateReview: async (
      _mr: MergeRequest,
      _changes: FileChange[],
      _includeTests?: boolean,
      _expandedContext?: ExpandedContext | null,
      _memoryContainerTag?: string | null,
    ): Promise<CodeReview> => {
      console.log('[Mock] Review generateReview called', { hasExpandedContext: !!_expandedContext });
      return mockReview;
    },
    generateParallelReview: async (
      _mr: MergeRequest,
      _changes: FileChange[],
      _includeTests?: boolean,
      _options?: ParallelAnalysisOptions,
      _expandedContext?: ExpandedContext | null,
      _memoryContainerTag?: string | null,
    ): Promise<CodeReview> => {
      console.log('[Mock] Review generateParallelReview called', { hasExpandedContext: !!_expandedContext });
      return mockReview;
    },
    refineComment: async (
      comment: ReviewComment,
      instructions: string
    ): Promise<RefineCommentResult> => {
      console.log('[Mock] Review refineComment called with:', instructions);
      return {
        refinedComment: `[Refined] ${comment.comment}`,
        refinedCodeSnippet: comment.codeSnippet,
      };
    },
  },

  repository: {
    clone: async (sshUrl: string, branch: string): Promise<string> => {
      console.log('[Mock] Repository clone called:', sshUrl, branch);
      return '/tmp/mock-repo-path';
    },
    readContext: async (
      _repoPath: string,
      changes: FileChange[],
      options?: { tokenBudget?: number; maxRelatedDepth?: number }
    ): Promise<ExpandedContext> => {
      console.log('[Mock] Repository readContext called', { options });
      const mockContent = '// Mock file content';
      const estimatedTokens = Math.ceil(mockContent.length / 4);
      return {
        changedFiles: changes.map((c) => ({
          path: c.new_path,
          content: mockContent,
          isChanged: true,
          priority: 100,
          estimatedTokens,
          importDepth: -1,
        })),
        relatedFiles: [],
        projectStructure: {
          directories: ['src', 'test'],
          fileCount: changes.length,
          tree: 'src/\n  index.ts\ntest/\n  index.test.ts',
        },
        repoPath: _repoPath,
        budgetStats: options?.tokenBudget
          ? {
              totalTokensUsed: estimatedTokens * changes.length,
              totalBudget: options.tokenBudget,
              budgetUsedPercent: Math.round(
                ((estimatedTokens * changes.length) / options.tokenBudget) * 100
              ),
              filesIncluded: changes.length,
              filesExcluded: 0,
              excludedFiles: [],
              breakdown: {
                diffs: 0,
                changedFiles: estimatedTokens * changes.length,
                relatedFiles: 0,
                projectStructure: 50,
              },
            }
          : undefined,
      };
    },
    cleanup: async (_repoPath: string): Promise<void> => {
      console.log('[Mock] Repository cleanup called');
    },
  },

  config: {
    saveToken: async (_token: string): Promise<void> => {
      console.log('[Mock] Config saveToken called');
      localStorage.setItem('mock_gitlab_token', _token);
    },
    getToken: async (): Promise<string | null> => {
      console.log('[Mock] Config getToken called');
      return localStorage.getItem('mock_gitlab_token');
    },
    hasToken: async (): Promise<boolean> => {
      console.log('[Mock] Config hasToken called');
      return localStorage.getItem('mock_gitlab_token') !== null;
    },
    deleteToken: async (): Promise<void> => {
      console.log('[Mock] Config deleteToken called');
      localStorage.removeItem('mock_gitlab_token');
    },
    getProxySettings: async () => {
      console.log('[Mock] Config getProxySettings called');
      const stored = localStorage.getItem('mock_proxy_settings');
      if (stored) return JSON.parse(stored);
      return { enabled: false, type: 'none', host: '', port: 1080 };
    },
    setProxySettings: async (settings) => {
      console.log('[Mock] Config setProxySettings called', settings);
      localStorage.setItem('mock_proxy_settings', JSON.stringify(settings));
    },
    resetProxySettings: async () => {
      console.log('[Mock] Config resetProxySettings called');
      localStorage.removeItem('mock_proxy_settings');
    },
    // Prompt profile operations
    getPromptConfig: async (): Promise<PromptConfig> => {
      console.log('[Mock] Config getPromptConfig called');
      const stored = localStorage.getItem('mock_prompt_config');
      if (stored) return JSON.parse(stored);
      return DEFAULT_PROMPT_CONFIG;
    },
    setPromptConfig: async (config: PromptConfig): Promise<void> => {
      console.log('[Mock] Config setPromptConfig called', config);
      localStorage.setItem('mock_prompt_config', JSON.stringify(config));
    },
    getActivePromptProfile: async (): Promise<PromptProfile> => {
      console.log('[Mock] Config getActivePromptProfile called');
      const stored = localStorage.getItem('mock_prompt_config');
      if (stored) {
        const config: PromptConfig = JSON.parse(stored);
        const activeProfile = config.profiles.find(p => p.id === config.activeProfileId);
        if (activeProfile) return activeProfile;
      }
      return DEFAULT_PROMPT_CONFIG.profiles[0];
    },
    savePromptProfile: async (profile: PromptProfile): Promise<void> => {
      console.log('[Mock] Config savePromptProfile called', profile);
      const stored = localStorage.getItem('mock_prompt_config');
      const config: PromptConfig = stored ? JSON.parse(stored) : { ...DEFAULT_PROMPT_CONFIG };
      const existingIndex = config.profiles.findIndex(p => p.id === profile.id);
      if (existingIndex >= 0) {
        config.profiles[existingIndex] = profile;
      } else {
        config.profiles.push(profile);
      }
      localStorage.setItem('mock_prompt_config', JSON.stringify(config));
    },
    deletePromptProfile: async (profileId: string): Promise<void> => {
      console.log('[Mock] Config deletePromptProfile called', profileId);
      const stored = localStorage.getItem('mock_prompt_config');
      if (stored) {
        const config: PromptConfig = JSON.parse(stored);
        config.profiles = config.profiles.filter(p => p.id !== profileId);
        if (config.activeProfileId === profileId) {
          config.activeProfileId = 'default';
        }
        localStorage.setItem('mock_prompt_config', JSON.stringify(config));
      }
    },
    setActivePromptProfile: async (profileId: string): Promise<void> => {
      console.log('[Mock] Config setActivePromptProfile called', profileId);
      const stored = localStorage.getItem('mock_prompt_config');
      const config: PromptConfig = stored ? JSON.parse(stored) : { ...DEFAULT_PROMPT_CONFIG };
      config.activeProfileId = profileId;
      localStorage.setItem('mock_prompt_config', JSON.stringify(config));
    },
    resetPromptConfig: async (): Promise<void> => {
      console.log('[Mock] Config resetPromptConfig called');
      localStorage.removeItem('mock_prompt_config');
    },
    getMemorySettings: async (): Promise<MemorySettings> => {
      const stored = localStorage.getItem('mock_memory_settings');
      return stored ? JSON.parse(stored) : DEFAULT_MEMORY_SETTINGS;
    },
    setMemorySettings: async (settings: MemorySettings): Promise<void> => {
      localStorage.setItem('mock_memory_settings', JSON.stringify(settings));
    },
  },

  memory: {
    listContainers: async (): Promise<MemoryContainerListResult> => ({
      status: 'ready',
      containers: [],
    }),
  },

  app: {
    getVersion: async (): Promise<string> => {
      return '1.0.0-mock';
    },
    getPlatform: async (): Promise<string> => {
      return 'browser';
    },
    openExternal: async (url: string): Promise<void> => {
      console.log('[Mock] Opening external URL:', url);
      window.open(url, '_blank');
    },
  },

  onReviewProgress: (_callback: (progress: ReviewProgress) => void): (() => void) => {
    console.log('[Mock] onReviewProgress listener registered');
    // Return cleanup function
    return () => {
      console.log('[Mock] onReviewProgress listener removed');
    };
  },

  onRepositoryProgress: (_callback: (progress: RepositoryProgress) => void): (() => void) => {
    console.log('[Mock] onRepositoryProgress listener registered');
    // Return cleanup function
    return () => {
      console.log('[Mock] onRepositoryProgress listener removed');
    };
  },

  onLogEntry: (_callback: (entry: import('../shared/types').LogEntry) => void): (() => void) => {
    console.log('[Mock] onLogEntry listener registered');
    // Return cleanup function
    return () => {
      console.log('[Mock] onLogEntry listener removed');
    };
  },
};

/**
 * Initialize the mock API if running outside of Electron
 */
export function initMockElectronAPI(): void {
  if (typeof window !== 'undefined' && !window.electronAPI) {
    console.log('[Mock] Initializing mock Electron API for browser environment');
    window.electronAPI = mockElectronAPI;
  }
}
