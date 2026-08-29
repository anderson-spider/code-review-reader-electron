import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain, app, shell } from 'electron';
import { registerIpcHandlers } from '../handlers';
import {
  mockOpenMR,
  mockParsedUrl,
  mockModifiedFile,
  createMockReview,
  createMockComment,
  mockDiscussions,
} from '../../../test/fixtures';

// Mock instances that will be shared (hoisted to be available in vi.mock)
const { mockConfigInstance, mockCodexInstance, mockGitLabInstance, mockRepositoryService, mockMemoryContainerInstance, mockProxySettings } = vi.hoisted(() => ({
  mockConfigInstance: {
    getGitLabToken: vi.fn(),
    saveGitLabToken: vi.fn(),
    hasGitLabToken: vi.fn(),
    deleteGitLabToken: vi.fn(),
    getProxySettings: vi.fn(),
    setProxySettings: vi.fn(),
    resetProxySettings: vi.fn(),
    getPromptConfig: vi.fn(),
    setPromptConfig: vi.fn(),
    getActivePromptProfile: vi.fn().mockReturnValue({ id: 'default', name: 'Padrão', customInstructions: '', isDefault: true }),
    savePromptProfile: vi.fn(),
    deletePromptProfile: vi.fn(),
    setActivePromptProfile: vi.fn(),
    resetPromptConfig: vi.fn(),
    getMemorySettings: vi.fn(),
    setMemorySettings: vi.fn(),
  },
  mockCodexInstance: {
    generateReview: vi.fn(),
    generateParallelReview: vi.fn(),
    refineComment: vi.fn(),
  },
  mockGitLabInstance: {
    parseMRUrl: vi.fn(),
    fetchMergeRequest: vi.fn(),
    fetchMRChanges: vi.fn(),
    postComment: vi.fn(),
    postLineComment: vi.fn(),
    deleteMyComments: vi.fn(),
    fetchExistingComments: vi.fn(),
    approveMR: vi.fn(),
    configureProxy: vi.fn(),
    fetchProjectInfo: vi.fn(),
    fetchFileContent: vi.fn(),
  },
  mockRepositoryService: {
    setProgressCallback: vi.fn(),
    cloneRepository: vi.fn(),
    buildExpandedContext: vi.fn(),
    cleanup: vi.fn(),
  },
  mockMemoryContainerInstance: {
    list: vi.fn(),
  },
  mockProxySettings: {
    enabled: false,
    type: 'none' as const,
    host: '',
    port: 1080,
  },
}));

// Mock Electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
  },
  shell: {
    openExternal: vi.fn(() => Promise.resolve()),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(() => ({
      webContents: {
        send: vi.fn(),
      },
    })),
  },
}));

// Mock services with class constructors
vi.mock('../../services/config.service', () => ({
  ConfigService: class {
    getGitLabToken = mockConfigInstance.getGitLabToken;
    saveGitLabToken = mockConfigInstance.saveGitLabToken;
    hasGitLabToken = mockConfigInstance.hasGitLabToken;
    deleteGitLabToken = mockConfigInstance.deleteGitLabToken;
    getProxySettings = mockConfigInstance.getProxySettings;
    setProxySettings = mockConfigInstance.setProxySettings;
    resetProxySettings = mockConfigInstance.resetProxySettings;
    getPromptConfig = mockConfigInstance.getPromptConfig;
    setPromptConfig = mockConfigInstance.setPromptConfig;
    getActivePromptProfile = mockConfigInstance.getActivePromptProfile;
    savePromptProfile = mockConfigInstance.savePromptProfile;
    deletePromptProfile = mockConfigInstance.deletePromptProfile;
    setActivePromptProfile = mockConfigInstance.setActivePromptProfile;
    resetPromptConfig = mockConfigInstance.resetPromptConfig;
    getMemorySettings = mockConfigInstance.getMemorySettings;
    setMemorySettings = mockConfigInstance.setMemorySettings;
  },
}));

vi.mock('../../services/codex.service', () => ({
  CodexService: class {
    generateReview = mockCodexInstance.generateReview;
    generateParallelReview = mockCodexInstance.generateParallelReview;
    refineComment = mockCodexInstance.refineComment;
  },
}));

vi.mock('../../services/memory-container.service', () => ({
  SupermemoryContainerService: class {
    list = mockMemoryContainerInstance.list;
  },
}));

vi.mock('../../services/gitlab.service', () => ({
  GitLabService: class {
    parseMRUrl = mockGitLabInstance.parseMRUrl;
    fetchMergeRequest = mockGitLabInstance.fetchMergeRequest;
    fetchMRChanges = mockGitLabInstance.fetchMRChanges;
    postComment = mockGitLabInstance.postComment;
    postLineComment = mockGitLabInstance.postLineComment;
    deleteMyComments = mockGitLabInstance.deleteMyComments;
    fetchExistingComments = mockGitLabInstance.fetchExistingComments;
    approveMR = mockGitLabInstance.approveMR;
    configureProxy = mockGitLabInstance.configureProxy;
    fetchProjectInfo = mockGitLabInstance.fetchProjectInfo;
    fetchFileContent = mockGitLabInstance.fetchFileContent;
  },
}));

vi.mock('../../services/repository.service', () => ({
  RepositoryService: class {
    setProgressCallback = mockRepositoryService.setProgressCallback;
    cloneRepository = mockRepositoryService.cloneRepository;
    buildExpandedContext = mockRepositoryService.buildExpandedContext;
    cleanup = mockRepositoryService.cleanup;
  },
}));

const mockedIpcMain = vi.mocked(ipcMain);
const mockedApp = vi.mocked(app);
const mockedShell = vi.mocked(shell);

describe('IPC Handlers', () => {
  // Store registered handlers for testing
  let handlers: Map<string, (...args: unknown[]) => unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    handlers = new Map();

    // Set default proxy settings mock
    mockConfigInstance.getProxySettings.mockReturnValue(mockProxySettings);

    // Capture handler registrations
    mockedIpcMain.handle.mockImplementation((channel, handler) => {
      handlers.set(channel, (...args: unknown[]) => Reflect.apply(handler, undefined, args));
    });

    // Register handlers
    registerIpcHandlers();

    // Reset GitLab service to null state by calling reinit with no token
    mockConfigInstance.getGitLabToken.mockReturnValue(null);
    const reinitHandler = handlers.get('gitlab:reinit');
    if (reinitHandler) {
      await reinitHandler({ sender: {} }, 'https://gitlab.com/api/v4');
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to get and call a handler
  const callHandler = async (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`Handler not registered for channel: ${channel}`);
    }
    // First arg is event, remaining are actual args
    return handler({ sender: {} }, ...args);
  };

  // =========================================================================
  // Registration Tests
  // =========================================================================
  describe('Handler Registration', () => {
    it('should register all GitLab handlers', () => {
      const gitlabChannels = [
        'gitlab:init',
        'gitlab:parseURL',
        'gitlab:fetchMR',
        'gitlab:fetchChanges',
        'gitlab:postComment',
        'gitlab:postLineComment',
        'gitlab:deleteMyComments',
        'gitlab:fetchExistingComments',
        'gitlab:approveMR',
        'gitlab:reinit',
      ];

      for (const channel of gitlabChannels) {
        expect(handlers.has(channel)).toBe(true);
      }
    });

    it('should register review handlers without legacy channels', () => {
      expect(handlers.has('review:generateReview')).toBe(true);
      expect(handlers.has('review:generateParallelReview')).toBe(true);
      expect(handlers.has('review:refineComment')).toBe(true);
      expect(handlers.has('claude:generateReview')).toBe(false);
    });

    it('should register config handlers', () => {
      const configChannels = [
        'config:saveToken',
        'config:getToken',
        'config:hasToken',
        'config:deleteToken',
      ];

      for (const channel of configChannels) {
        expect(handlers.has(channel)).toBe(true);
      }
    });

    it('should register app handlers', () => {
      const appChannels = ['app:getVersion', 'app:getPlatform', 'app:openExternal'];

      for (const channel of appChannels) {
        expect(handlers.has(channel)).toBe(true);
      }
    });
  });

  // =========================================================================
  // GitLab Handler Tests
  // =========================================================================
  describe('gitlab:init', () => {
    it('should initialize GitLab service when token exists', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('glpat-token');

      const result = await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      expect(result).toBe(true);
    });

    it('should return false when no token exists', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue(null);

      const result = await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockConfigInstance.getGitLabToken.mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      expect(result).toBe(false);
    });
  });

  describe('gitlab:parseURL', () => {
    it('should throw when GitLab service not initialized', async () => {
      // Don't initialize service first
      await expect(callHandler('gitlab:parseURL', 'https://gitlab.com/ns/proj/-/merge_requests/123'))
        .rejects.toThrow('GitLab service not initialized');
    });

    it('should delegate to GitLab service', async () => {
      // Initialize service first
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      mockGitLabInstance.parseMRUrl.mockReturnValue(mockParsedUrl);

      await callHandler('gitlab:parseURL', 'https://gitlab.com/ns/proj/-/merge_requests/123');

      expect(mockGitLabInstance.parseMRUrl).toHaveBeenCalled();
    });

    it('should throw for invalid URL', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      mockGitLabInstance.parseMRUrl.mockReturnValue(null);

      await expect(callHandler('gitlab:parseURL', 'invalid-url'))
        .rejects.toThrow('Invalid GitLab MR URL');
    });
  });

  describe('gitlab:fetchMR', () => {
    it('should throw when service not initialized', async () => {
      await expect(callHandler('gitlab:fetchMR', 'ns/proj', 123))
        .rejects.toThrow('GitLab service not initialized');
    });

    it('should delegate to GitLab service', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      mockGitLabInstance.fetchMergeRequest.mockResolvedValue(mockOpenMR);

      await callHandler('gitlab:fetchMR', 'ns/proj', 123);

      expect(mockGitLabInstance.fetchMergeRequest).toHaveBeenCalled();
    });
  });

  describe('gitlab:fetchChanges', () => {
    it('should throw when service not initialized', async () => {
      await expect(callHandler('gitlab:fetchChanges', 'ns/proj', 123))
        .rejects.toThrow('GitLab service not initialized');
    });

    it('should delegate to GitLab service', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      mockGitLabInstance.fetchMRChanges.mockResolvedValue([mockModifiedFile]);

      await callHandler('gitlab:fetchChanges', 'ns/proj', 123);

      expect(mockGitLabInstance.fetchMRChanges).toHaveBeenCalled();
    });
  });

  describe('gitlab:postComment', () => {
    it('should throw when service not initialized', async () => {
      await expect(callHandler('gitlab:postComment', 'ns/proj', 123, 'comment'))
        .rejects.toThrow('GitLab service not initialized');
    });

    it('should delegate to GitLab service', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      mockGitLabInstance.postComment.mockResolvedValue(undefined);

      await callHandler('gitlab:postComment', 'ns/proj', 123, 'Great work!');

      expect(mockGitLabInstance.postComment).toHaveBeenCalled();
    });
  });

  describe('gitlab:postLineComment', () => {
    it('should throw when service not initialized', async () => {
      await expect(callHandler('gitlab:postLineComment', 'ns/proj', 123, 'file.ts', 42, 'comment'))
        .rejects.toThrow('GitLab service not initialized');
    });

    it('should delegate to GitLab service with all arguments', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      mockGitLabInstance.postLineComment.mockResolvedValue(undefined);

      await callHandler('gitlab:postLineComment', 'ns/proj', 123, 'file.ts', 42, 'Issue here', mockModifiedFile);

      expect(mockGitLabInstance.postLineComment).toHaveBeenCalled();
    });
  });

  describe('gitlab:deleteMyComments', () => {
    it('should throw when service not initialized', async () => {
      await expect(callHandler('gitlab:deleteMyComments', 'ns/proj', 123))
        .rejects.toThrow('GitLab service not initialized');
    });

    it('should return deleted count', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      mockGitLabInstance.deleteMyComments.mockResolvedValue(5);

      const result = await callHandler('gitlab:deleteMyComments', 'ns/proj', 123);

      expect(result).toBe(5);
    });
  });

  describe('gitlab:fetchExistingComments', () => {
    it('should throw when service not initialized', async () => {
      await expect(callHandler('gitlab:fetchExistingComments', 'ns/proj', 123))
        .rejects.toThrow('GitLab service not initialized');
    });

    it('should return comments', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      const mockComments = mockDiscussions.flatMap((d) => d.notes);
      mockGitLabInstance.fetchExistingComments.mockResolvedValue(mockComments);

      const result = await callHandler('gitlab:fetchExistingComments', 'ns/proj', 123);

      expect(result).toEqual(mockComments);
    });
  });

  describe('gitlab:approveMR', () => {
    it('should throw when service not initialized', async () => {
      await expect(callHandler('gitlab:approveMR', 'ns/proj', 123))
        .rejects.toThrow('GitLab service not initialized');
    });

    it('should delegate to GitLab service', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      mockGitLabInstance.approveMR.mockResolvedValue(undefined);

      await callHandler('gitlab:approveMR', 'ns/proj', 123);

      expect(mockGitLabInstance.approveMR).toHaveBeenCalled();
    });
  });

  describe('gitlab:reinit', () => {
    it('should reinitialize service with new token', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('new-token');

      const result = await callHandler('gitlab:reinit', 'https://gitlab.com/api/v4');

      expect(result).toBe(true);
    });

    it('should return false and set service to null when no token', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue(null);

      const result = await callHandler('gitlab:reinit', 'https://gitlab.com/api/v4');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockConfigInstance.getGitLabToken.mockImplementation(() => {
        throw new Error('Error');
      });

      const result = await callHandler('gitlab:reinit', 'https://gitlab.com/api/v4');

      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Review Handler Tests
  // =========================================================================
  describe('review:generateReview', () => {
    it('should delegate to Codex service', async () => {
      const mockReview = createMockReview();
      mockCodexInstance.generateReview.mockResolvedValue(mockReview);

      await callHandler('review:generateReview', mockOpenMR, [mockModifiedFile], false);

      expect(mockCodexInstance.generateReview).toHaveBeenCalled();
    });

    it('should pass includeTests flag', async () => {
      const mockReview = createMockReview();
      mockCodexInstance.generateReview.mockResolvedValue(mockReview);

      await callHandler('review:generateReview', mockOpenMR, [mockModifiedFile], true);

      expect(mockCodexInstance.generateReview).toHaveBeenCalled();
    });

    it('should forward expanded context and selected memory tag', async () => {
      const expandedContext = { changedFiles: [] };
      mockCodexInstance.generateReview.mockResolvedValue(createMockReview());

      await callHandler(
        'review:generateReview',
        mockOpenMR,
        [mockModifiedFile],
        false,
        expandedContext,
        'repo_selected__123',
      );

      const call = mockCodexInstance.generateReview.mock.calls[0];
      expect(call[4]).toEqual(expandedContext);
      expect(call[5]).toBe('repo_selected__123');
    });
  });

  // =========================================================================
  // Config Handler Tests
  // =========================================================================
  describe('config:saveToken', () => {
    it('should delegate to ConfigService', async () => {
      await callHandler('config:saveToken', 'glpat-new-token');

      expect(mockConfigInstance.saveGitLabToken).toHaveBeenCalled();
    });
  });

  describe('config:getToken', () => {
    it('should return token from ConfigService', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('glpat-token');

      const result = await callHandler('config:getToken');

      expect(result).toBe('glpat-token');
    });

    it('should return null when no token', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue(null);

      const result = await callHandler('config:getToken');

      expect(result).toBeNull();
    });
  });

  describe('config:hasToken', () => {
    it('should return true when token exists', async () => {
      mockConfigInstance.hasGitLabToken.mockReturnValue(true);

      const result = await callHandler('config:hasToken');

      expect(result).toBe(true);
    });

    it('should return false when no token', async () => {
      mockConfigInstance.hasGitLabToken.mockReturnValue(false);

      const result = await callHandler('config:hasToken');

      expect(result).toBe(false);
    });
  });

  describe('config:deleteToken', () => {
    it('should delegate to ConfigService', async () => {
      await callHandler('config:deleteToken');

      expect(mockConfigInstance.deleteGitLabToken).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // App Handler Tests
  // =========================================================================
  describe('app:getVersion', () => {
    it('should return app version', async () => {
      mockedApp.getVersion.mockReturnValue('1.2.3');

      const result = await callHandler('app:getVersion');

      expect(result).toBe('1.2.3');
    });
  });

  describe('app:getPlatform', () => {
    it('should return process platform', async () => {
      const result = await callHandler('app:getPlatform');

      expect(result).toBe(process.platform);
    });
  });

  describe('app:openExternal', () => {
    it('should open external URL', async () => {
      mockedShell.openExternal.mockResolvedValue();

      await callHandler('app:openExternal', 'https://gitlab.com');

      expect(mockedShell.openExternal).toHaveBeenCalledWith('https://gitlab.com');
    });
  });

  // =========================================================================
  // review:generateParallelReview Tests
  // =========================================================================
  describe('review:generateParallelReview', () => {
    it('should call generateParallelReview on Codex service', async () => {
      const mockReview = createMockReview();
      mockCodexInstance.generateParallelReview.mockResolvedValue(mockReview);

      const result = await callHandler(
        'review:generateParallelReview',
        mockOpenMR,
        [mockModifiedFile],
        false
      );

      expect(mockCodexInstance.generateParallelReview).toHaveBeenCalled();
      expect(result).toEqual(mockReview);
    });

    it('should pass options, expandedContext and selected memory tag', async () => {
      const mockReview = createMockReview();
      mockCodexInstance.generateParallelReview.mockResolvedValue(mockReview);

      const options = { experts: ['security', 'performance'] };
      const expandedContext = { files: [], tokenCount: 0 };

      await callHandler(
        'review:generateParallelReview',
        mockOpenMR,
        [mockModifiedFile],
        true,
        options,
        expandedContext,
        'repo_selected__123',
      );

      const call = mockCodexInstance.generateParallelReview.mock.calls[0];
      expect(call[0]).toEqual(mockOpenMR);
      expect(call[1]).toEqual([mockModifiedFile]);
      expect(call[2]).toBe(true);
      expect(typeof call[3]).toBe('function'); // onProgress callback
      expect(call[4]).toEqual(options);
      expect(call[5]).toEqual(expandedContext);
      expect(call[6]).toBe('repo_selected__123');
    });

    it('should return the review result', async () => {
      const mockReview = createMockReview({ summary: 'Parallel review summary' });
      mockCodexInstance.generateParallelReview.mockResolvedValue(mockReview);

      const result = await callHandler(
        'review:generateParallelReview',
        mockOpenMR,
        [mockModifiedFile],
        false
      );

      expect(result).toEqual(mockReview);
    });
  });

  // =========================================================================
  // review:refineComment Tests
  // =========================================================================
  describe('review:refineComment', () => {
    it('should throw for invalid comment (no id)', async () => {
      const invalidComment = { filePath: 'test.ts', lineNumber: 1, severity: 'warning', comment: 'test' };

      await expect(
        callHandler('review:refineComment', invalidComment, 'make it better')
      ).rejects.toThrow('Invalid comment: must have a valid id');
    });

    it('should throw for empty instructions', async () => {
      const comment = createMockComment();

      await expect(
        callHandler('review:refineComment', comment, '')
      ).rejects.toThrow('Invalid instructions: must be a non-empty string');
    });

    it('should throw for whitespace-only instructions', async () => {
      const comment = createMockComment();

      await expect(
        callHandler('review:refineComment', comment, '   ')
      ).rejects.toThrow('Instructions cannot be empty');
    });

    it('should throw for instructions > 2000 chars', async () => {
      const comment = createMockComment();
      const longInstructions = 'a'.repeat(2001);

      await expect(
        callHandler('review:refineComment', comment, longInstructions)
      ).rejects.toThrow('Instructions exceed maximum length of 2000 characters');
    });

    it('should delegate to Codex service with valid inputs', async () => {
      const comment = createMockComment();
      const refined = { comment: 'Refined comment text', wasModified: true };
      mockCodexInstance.refineComment.mockResolvedValue(refined);

      const result = await callHandler('review:refineComment', comment, 'make it more concise');

      expect(mockCodexInstance.refineComment).toHaveBeenCalledWith(comment, 'make it more concise');
      expect(result).toEqual(refined);
    });
  });

  // =========================================================================
  // Proxy Handler Tests
  // =========================================================================
  describe('config:getProxySettings', () => {
    it('should return proxy settings', async () => {
      mockConfigInstance.getProxySettings.mockReturnValue(mockProxySettings);

      const result = await callHandler('config:getProxySettings');

      expect(result).toEqual(mockProxySettings);
      expect(mockConfigInstance.getProxySettings).toHaveBeenCalled();
    });
  });

  describe('config:setProxySettings', () => {
    it('should store settings and reconfigure gitlab if initialized', async () => {
      // Initialize GitLab service first
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      const newSettings = { enabled: true, type: 'http' as const, host: 'proxy.example.com', port: 8080 };

      await callHandler('config:setProxySettings', newSettings);

      expect(mockConfigInstance.setProxySettings).toHaveBeenCalledWith(newSettings);
      expect(mockGitLabInstance.configureProxy).toHaveBeenCalledWith(newSettings);
    });

    it('should NOT reconfigure when gitlab not initialized', async () => {
      // gitlab service is null (not initialized)
      mockGitLabInstance.configureProxy.mockClear();

      const newSettings = { enabled: true, type: 'http' as const, host: 'proxy.example.com', port: 8080 };

      await callHandler('config:setProxySettings', newSettings);

      expect(mockConfigInstance.setProxySettings).toHaveBeenCalledWith(newSettings);
      expect(mockGitLabInstance.configureProxy).not.toHaveBeenCalled();
    });
  });

  describe('config:resetProxySettings', () => {
    it('should reset and reconfigure gitlab if initialized', async () => {
      // Initialize GitLab service first
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      mockConfigInstance.getProxySettings.mockReturnValue(mockProxySettings);

      await callHandler('config:resetProxySettings');

      expect(mockConfigInstance.resetProxySettings).toHaveBeenCalled();
      expect(mockGitLabInstance.configureProxy).toHaveBeenCalledWith(mockProxySettings);
    });
  });

  // =========================================================================
  // Prompt Profile Handler Tests
  // =========================================================================
  describe('config:getPromptConfig', () => {
    it('should return prompt config', async () => {
      const mockConfig = { activeProfileId: 'default', profiles: [] };
      mockConfigInstance.getPromptConfig.mockReturnValue(mockConfig);

      const result = await callHandler('config:getPromptConfig');

      expect(result).toEqual(mockConfig);
      expect(mockConfigInstance.getPromptConfig).toHaveBeenCalled();
    });
  });

  describe('config:setPromptConfig', () => {
    it('should delegate to ConfigService', async () => {
      const config = { activeProfileId: 'custom', profiles: [] };

      await callHandler('config:setPromptConfig', config);

      expect(mockConfigInstance.setPromptConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('config:getActivePromptProfile', () => {
    it('should return active prompt profile', async () => {
      const profile = { id: 'default', name: 'Padrão', customInstructions: '', isDefault: true };
      mockConfigInstance.getActivePromptProfile.mockReturnValue(profile);

      const result = await callHandler('config:getActivePromptProfile');

      expect(result).toEqual(profile);
      expect(mockConfigInstance.getActivePromptProfile).toHaveBeenCalled();
    });
  });

  describe('config:savePromptProfile', () => {
    it('should delegate to ConfigService', async () => {
      const profile = { id: 'custom-1', name: 'Security', customInstructions: 'Focus on security', isDefault: false };

      await callHandler('config:savePromptProfile', profile);

      expect(mockConfigInstance.savePromptProfile).toHaveBeenCalledWith(profile);
    });
  });

  describe('config:deletePromptProfile', () => {
    it('should delegate to ConfigService', async () => {
      await callHandler('config:deletePromptProfile', 'custom-1');

      expect(mockConfigInstance.deletePromptProfile).toHaveBeenCalledWith('custom-1');
    });
  });

  describe('config:setActivePromptProfile', () => {
    it('should delegate to ConfigService', async () => {
      await callHandler('config:setActivePromptProfile', 'custom-1');

      expect(mockConfigInstance.setActivePromptProfile).toHaveBeenCalledWith('custom-1');
    });
  });

  describe('config:resetPromptConfig', () => {
    it('should delegate to ConfigService', async () => {
      await callHandler('config:resetPromptConfig');

      expect(mockConfigInstance.resetPromptConfig).toHaveBeenCalled();
    });
  });

  describe('memory settings handlers', () => {
    const memorySettings = {
      smfsBinaryPath: 'smfs',
      supermemoryBinaryPath: 'supermemory',
      projects: [],
    };

    it('gets memory settings from ConfigService', async () => {
      mockConfigInstance.getMemorySettings.mockReturnValue(memorySettings);
      await expect(callHandler('config:getMemorySettings')).resolves.toEqual(memorySettings);
    });

    it('persists valid memory settings', async () => {
      await callHandler('config:setMemorySettings', memorySettings);
      expect(mockConfigInstance.setMemorySettings).toHaveBeenCalledWith(memorySettings);
    });

    it('rejects malformed memory settings before persistence', async () => {
      await expect(callHandler('config:setMemorySettings', null)).rejects.toThrow('Invalid memory settings');
      expect(mockConfigInstance.setMemorySettings).not.toHaveBeenCalled();
    });

    it('lists remote containers with the configured Supermemory CLI', async () => {
      mockConfigInstance.getMemorySettings.mockReturnValue(memorySettings);
      mockMemoryContainerInstance.list.mockResolvedValue({ status: 'ready', containers: [] });

      await expect(callHandler('memory:listContainers')).resolves.toEqual({ status: 'ready', containers: [] });
      expect(mockMemoryContainerInstance.list).toHaveBeenCalledWith('supermemory');
    });
  });

  // =========================================================================
  // Repository Handler Tests
  // =========================================================================
  describe('gitlab:fetchProject', () => {
    it('should throw when GitLab service not initialized', async () => {
      await expect(callHandler('gitlab:fetchProject', 'ns/proj'))
        .rejects.toThrow('GitLab service not initialized');
    });

    it('should delegate to GitLab service when initialized', async () => {
      mockConfigInstance.getGitLabToken.mockReturnValue('token');
      await callHandler('gitlab:init', 'https://gitlab.com/api/v4');

      const mockProject = { id: 1, ssh_url_to_repo: 'git@gitlab.com:ns/proj.git' };
      mockGitLabInstance.fetchProjectInfo.mockResolvedValue(mockProject);

      const result = await callHandler('gitlab:fetchProject', 'ns/proj');

      expect(mockGitLabInstance.fetchProjectInfo).toHaveBeenCalledWith('ns/proj');
      expect(result).toEqual(mockProject);
    });
  });

  describe('repository:clone', () => {
    it('should call cloneRepository with sshUrl and branch', async () => {
      const mockRepoPath = '/tmp/repo-123';
      mockRepositoryService.cloneRepository.mockResolvedValue(mockRepoPath);

      const result = await callHandler('repository:clone', 'git@gitlab.com:ns/proj.git', 'feature-branch');

      expect(mockRepositoryService.setProgressCallback).toHaveBeenCalled();
      expect(mockRepositoryService.cloneRepository).toHaveBeenCalledWith('git@gitlab.com:ns/proj.git', 'feature-branch');
      expect(result).toBe(mockRepoPath);
    });
  });

  describe('repository:readContext', () => {
    it('should call buildExpandedContext with repoPath, changes, and options', async () => {
      const mockContext = { files: [{ path: 'src/main.ts', content: 'code' }], tokenCount: 500 };
      mockRepositoryService.buildExpandedContext.mockResolvedValue(mockContext);

      const options = { tokenBudget: 10000, maxRelatedDepth: 2 };

      const result = await callHandler('repository:readContext', '/tmp/repo-123', [mockModifiedFile], options);

      expect(mockRepositoryService.setProgressCallback).toHaveBeenCalled();
      expect(mockRepositoryService.buildExpandedContext).toHaveBeenCalledWith('/tmp/repo-123', [mockModifiedFile], options);
      expect(result).toEqual(mockContext);
    });
  });

  describe('repository:cleanup', () => {
    it('should call cleanup with repoPath', async () => {
      mockRepositoryService.cleanup.mockResolvedValue(undefined);

      await callHandler('repository:cleanup', '/tmp/repo-123');

      expect(mockRepositoryService.cleanup).toHaveBeenCalledWith('/tmp/repo-123');
    });
  });

  // =========================================================================
  // Handler Registration Completeness
  // =========================================================================
  describe('Handler Registration — additional channels', () => {
    it('should register proxy, prompt, review, and repository handlers', () => {
      const additionalChannels = [
        'config:getProxySettings',
        'config:setProxySettings',
        'config:resetProxySettings',
        'config:getPromptConfig',
        'config:setPromptConfig',
        'config:getActivePromptProfile',
        'config:savePromptProfile',
        'config:deletePromptProfile',
        'config:setActivePromptProfile',
        'config:resetPromptConfig',
        'config:getMemorySettings',
        'config:setMemorySettings',
        'memory:listContainers',
        'review:generateParallelReview',
        'review:refineComment',
        'gitlab:fetchProject',
        'gitlab:fetchFile',
        'repository:clone',
        'repository:readContext',
        'repository:cleanup',
      ];

      for (const channel of additionalChannels) {
        expect(handlers.has(channel), `Missing handler for channel: ${channel}`).toBe(true);
      }
    });
  });
});
