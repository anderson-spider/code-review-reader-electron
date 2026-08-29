import { ipcMain, app, shell, BrowserWindow } from 'electron';
import { GitLabService } from '../services/gitlab.service';
import { CodexService } from '../services/codex.service';
import { ConfigService } from '../services/config.service';
import { RepositoryService } from '../services/repository.service';
import { logger } from '../services/logger.service';
import { SupermemoryContainerService } from '../services/memory-container.service';
import { IPC_CHANNELS } from '../../shared/types';
import type {
  MergeRequest,
  FileChange,
  ProxySettings,
  ReviewProgress,
  PromptProfile,
  PromptConfig,
  ReviewComment,
  ParallelAnalysisOptions,
  RepositoryProgress,
  ExpandedContext,
  MemorySettings,
} from '../../shared/types';

let gitlabService: GitLabService | null = null;
const configService = new ConfigService();
const codexService = new CodexService(configService);
const memoryContainerService = new SupermemoryContainerService();
const repositoryService = new RepositoryService();

export function registerIpcHandlers(): void {
  // =========================================================================
  // GitLab Handlers
  // =========================================================================

  ipcMain.handle('gitlab:init', async (_event, baseURL: string) => {
    logger.info('ipc', 'gitlab:init called', { baseURL });
    try {
      const token = configService.getGitLabToken();
      if (token) {
        const proxySettings = configService.getProxySettings();
        gitlabService = new GitLabService(baseURL, token, proxySettings);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('ipc', 'gitlab:init error', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  });

  ipcMain.handle('gitlab:parseURL', async (_event, url: string) => {
    logger.info('ipc', 'gitlab:parseURL called', { url });
    if (!gitlabService) {
      throw new Error('GitLab service not initialized');
    }
    const parsed = gitlabService.parseMRUrl(url);
    if (!parsed) {
      throw new Error('Invalid GitLab MR URL. Expected format: https://gitlab.com/namespace/project/-/merge_requests/123');
    }
    return parsed;
  });

  ipcMain.handle('gitlab:fetchMR', async (_event, projectPath: string, mrIID: number) => {
    logger.info('ipc', 'gitlab:fetchMR called', { projectPath, mrIID });
    if (!gitlabService) {
      throw new Error('GitLab service not initialized');
    }
    return gitlabService.fetchMergeRequest(projectPath, mrIID);
  });

  ipcMain.handle('gitlab:fetchChanges', async (_event, projectPath: string, mrIID: number) => {
    logger.info('ipc', 'gitlab:fetchChanges called', { projectPath, mrIID });
    if (!gitlabService) {
      throw new Error('GitLab service not initialized');
    }
    return gitlabService.fetchMRChanges(projectPath, mrIID);
  });

  ipcMain.handle(
    'gitlab:postComment',
    async (_event, projectPath: string, mrIID: number, body: string) => {
      logger.info('ipc', 'gitlab:postComment called');
      if (!gitlabService) {
        throw new Error('GitLab service not initialized');
      }
      return gitlabService.postComment(projectPath, mrIID, body);
    }
  );

  ipcMain.handle(
    'gitlab:postLineComment',
    async (
      _event,
      projectPath: string,
      mrIID: number,
      filePath: string,
      lineNumber: number,
      body: string,
      fileChange?: FileChange
    ) => {
      logger.info('ipc', 'gitlab:postLineComment called', { filePath, lineNumber });
      if (!gitlabService) {
        throw new Error('GitLab service not initialized');
      }
      return gitlabService.postLineComment(projectPath, mrIID, filePath, lineNumber, body, fileChange);
    }
  );

  ipcMain.handle('gitlab:deleteMyComments', async (_event, projectPath: string, mrIID: number) => {
    logger.info('ipc', 'gitlab:deleteMyComments called');
    if (!gitlabService) {
      throw new Error('GitLab service not initialized');
    }
    return gitlabService.deleteMyComments(projectPath, mrIID);
  });

  ipcMain.handle(
    'gitlab:fetchExistingComments',
    async (_event, projectPath: string, mrIID: number) => {
      logger.info('ipc', 'gitlab:fetchExistingComments called');
      if (!gitlabService) {
        throw new Error('GitLab service not initialized');
      }
      return gitlabService.fetchExistingComments(projectPath, mrIID);
    }
  );

  ipcMain.handle('gitlab:approveMR', async (_event, projectPath: string, mrIID: number) => {
    logger.info('ipc', 'gitlab:approveMR called');
    if (!gitlabService) {
      throw new Error('GitLab service not initialized');
    }
    return gitlabService.approveMR(projectPath, mrIID);
  });

  ipcMain.handle(
    'gitlab:fetchFile',
    async (_event, projectPath: string, filePath: string, ref: string) => {
      logger.info('ipc', 'gitlab:fetchFile called', { filePath, ref });
      if (!gitlabService) {
        throw new Error('GitLab service not initialized');
      }
      return gitlabService.fetchFileContent(projectPath, filePath, ref);
    }
  );

  // =========================================================================
  // Review Handlers
  // =========================================================================

  ipcMain.handle(
    IPC_CHANNELS.REVIEW_GENERATE,
    async (
      event,
      mr: MergeRequest,
      changes: FileChange[],
      includeTests = false,
      expandedContext?: ExpandedContext | null,
      memoryContainerTag?: string | null,
    ) => {
      logger.info('ipc', 'review:generateReview called', { mrTitle: mr.title, includeTests, hasExpandedContext: !!expandedContext });

      // Get the window to send progress events
      const window = BrowserWindow.fromWebContents(event.sender);

      // Progress callback to emit events to renderer
      const onProgress = (progress: ReviewProgress) => {
        logger.debug('ipc', `review:progress - ${progress.stage} ${progress.progress}%`);
        window?.webContents.send('review:progress', progress);
      };

      return codexService.generateReview(mr, changes, includeTests, onProgress, expandedContext, memoryContainerTag);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.REVIEW_GENERATE_PARALLEL,
    async (
      event,
      mr: MergeRequest,
      changes: FileChange[],
      includeTests = false,
      options?: ParallelAnalysisOptions,
      expandedContext?: ExpandedContext | null,
      memoryContainerTag?: string | null,
    ) => {
      logger.info('ipc', 'review:generateParallelReview called', { mrTitle: mr.title, includeTests, options, hasExpandedContext: !!expandedContext });

      // Get the window to send progress events
      const window = BrowserWindow.fromWebContents(event.sender);

      // Progress callback to emit events to renderer
      const onProgress = (progress: ReviewProgress) => {
        logger.debug('ipc', `review:progress - ${progress.stage} ${progress.progress}%`);
        window?.webContents.send('review:progress', progress);
      };

      return codexService.generateParallelReview(mr, changes, includeTests, onProgress, options, expandedContext, memoryContainerTag);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.REVIEW_REFINE_COMMENT,
    async (_event, comment: ReviewComment, instructions: string) => {
      logger.info('ipc', 'review:refineComment called', { commentId: comment.id });

      // Input validation
      if (!comment || typeof comment.id !== 'string') {
        throw new Error('Invalid comment: must have a valid id');
      }

      if (!instructions || typeof instructions !== 'string') {
        throw new Error('Invalid instructions: must be a non-empty string');
      }

      if (instructions.trim().length === 0) {
        throw new Error('Instructions cannot be empty');
      }

      if (instructions.length > 2000) {
        throw new Error('Instructions exceed maximum length of 2000 characters');
      }

      return codexService.refineComment(comment, instructions);
    }
  );

  // =========================================================================
  // Config Handlers (replaces Keychain)
  // =========================================================================

  ipcMain.handle('config:saveToken', async (_event, token: string) => {
    logger.info('ipc', 'config:saveToken called');
    configService.saveGitLabToken(token);
  });

  ipcMain.handle('config:getToken', async () => {
    logger.debug('ipc', 'config:getToken called');
    return configService.getGitLabToken();
  });

  ipcMain.handle('config:hasToken', async () => {
    logger.debug('ipc', 'config:hasToken called');
    return configService.hasGitLabToken();
  });

  ipcMain.handle('config:deleteToken', async () => {
    logger.info('ipc', 'config:deleteToken called');
    configService.deleteGitLabToken();
  });

  // =========================================================================
  // App Handlers
  // =========================================================================

  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', async () => {
    return process.platform;
  });

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    logger.info('ipc', 'app:openExternal called', { url });
    await shell.openExternal(url);
  });

  // =========================================================================
  // GitLab Re-initialization Handler (for token updates)
  // =========================================================================

  ipcMain.handle('gitlab:reinit', async (_event, baseURL: string) => {
    logger.info('ipc', 'gitlab:reinit called', { baseURL });
    try {
      const token = configService.getGitLabToken();
      if (token) {
        const proxySettings = configService.getProxySettings();
        gitlabService = new GitLabService(baseURL, token, proxySettings);
        return true;
      }
      gitlabService = null;
      return false;
    } catch (error) {
      logger.error('ipc', 'gitlab:reinit error', { error: error instanceof Error ? error.message : String(error) });
      gitlabService = null;
      return false;
    }
  });

  // =========================================================================
  // Proxy Handlers
  // =========================================================================

  ipcMain.handle('config:getProxySettings', async () => {
    logger.debug('ipc', 'config:getProxySettings called');
    return configService.getProxySettings();
  });

  ipcMain.handle('config:setProxySettings', async (_event, settings: ProxySettings) => {
    logger.info('ipc', 'config:setProxySettings called', { settings });
    configService.setProxySettings(settings);
    // Reconfigure proxy on existing GitLabService if it exists
    if (gitlabService) {
      gitlabService.configureProxy(settings);
    }
  });

  ipcMain.handle('config:resetProxySettings', async () => {
    logger.info('ipc', 'config:resetProxySettings called');
    configService.resetProxySettings();
    // Reconfigure proxy on existing GitLabService if it exists
    if (gitlabService) {
      gitlabService.configureProxy(configService.getProxySettings());
    }
  });

  // =========================================================================
  // Prompt Profile Handlers
  // =========================================================================

  ipcMain.handle('config:getPromptConfig', async () => {
    logger.debug('ipc', 'config:getPromptConfig called');
    return configService.getPromptConfig();
  });

  ipcMain.handle('config:setPromptConfig', async (_event, config: PromptConfig) => {
    logger.info('ipc', 'config:setPromptConfig called');
    configService.setPromptConfig(config);
  });

  ipcMain.handle('config:getActivePromptProfile', async () => {
    logger.debug('ipc', 'config:getActivePromptProfile called');
    return configService.getActivePromptProfile();
  });

  ipcMain.handle('config:savePromptProfile', async (_event, profile: PromptProfile) => {
    logger.info('ipc', 'config:savePromptProfile called', { profileName: profile.name });
    configService.savePromptProfile(profile);
  });

  ipcMain.handle('config:deletePromptProfile', async (_event, profileId: string) => {
    logger.info('ipc', 'config:deletePromptProfile called', { profileId });
    configService.deletePromptProfile(profileId);
  });

  ipcMain.handle('config:setActivePromptProfile', async (_event, profileId: string) => {
    logger.info('ipc', 'config:setActivePromptProfile called', { profileId });
    configService.setActivePromptProfile(profileId);
  });

  ipcMain.handle('config:resetPromptConfig', async () => {
    logger.info('ipc', 'config:resetPromptConfig called');
    configService.resetPromptConfig();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_MEMORY_SETTINGS, async () => {
    logger.debug('ipc', 'config:getMemorySettings called');
    return configService.getMemorySettings();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_MEMORY_SETTINGS, async (_event, settings: MemorySettings) => {
    if (!settings || !Array.isArray(settings.projects)) throw new Error('Invalid memory settings');
    logger.info('ipc', 'config:setMemorySettings called', { projectCount: settings.projects.length });
    configService.setMemorySettings(settings);
  });

  ipcMain.handle(IPC_CHANNELS.MEMORY_LIST_CONTAINERS, async () => {
    logger.debug('ipc', 'memory:listContainers called');
    const settings = configService.getMemorySettings();
    return memoryContainerService.list(settings.supermemoryBinaryPath);
  });

  // =========================================================================
  // Repository Handlers (Local Checkout)
  // =========================================================================

  ipcMain.handle('gitlab:fetchProject', async (_event, projectPath: string) => {
    logger.info('ipc', 'gitlab:fetchProject called', { projectPath });
    if (!gitlabService) {
      throw new Error('GitLab service not initialized');
    }
    return gitlabService.fetchProjectInfo(projectPath);
  });

  ipcMain.handle(
    'repository:clone',
    async (event, sshUrl: string, branch: string) => {
      logger.info('repository', 'repository:clone called', { branch });

      // Get the window to send progress events
      const window = BrowserWindow.fromWebContents(event.sender);

      // Progress callback to emit events to renderer
      repositoryService.setProgressCallback((progress: RepositoryProgress) => {
        logger.debug('repository', `repository:progress - ${progress.stage} ${progress.progress}%`);
        window?.webContents.send('repository:progress', progress);
      });

      return repositoryService.cloneRepository(sshUrl, branch);
    }
  );

  ipcMain.handle(
    'repository:readContext',
    async (
      event,
      repoPath: string,
      changes: FileChange[],
      options?: { tokenBudget?: number; maxRelatedDepth?: number }
    ) => {
      logger.info('repository', 'repository:readContext called', {
        filesCount: changes.length,
        tokenBudget: options?.tokenBudget,
        maxRelatedDepth: options?.maxRelatedDepth,
      });

      // Get the window to send progress events
      const window = BrowserWindow.fromWebContents(event.sender);

      // Progress callback to emit events to renderer
      repositoryService.setProgressCallback((progress: RepositoryProgress) => {
        logger.debug('repository', `repository:progress - ${progress.stage} ${progress.progress}%`);
        window?.webContents.send('repository:progress', progress);
      });

      return repositoryService.buildExpandedContext(repoPath, changes, options);
    }
  );

  ipcMain.handle('repository:cleanup', async (_event, repoPath: string) => {
    logger.info('repository', 'repository:cleanup called', { repoPath: repoPath || '(empty)' });
    return repositoryService.cleanup(repoPath);
  });

  logger.info('ipc', 'All handlers registered');
}
