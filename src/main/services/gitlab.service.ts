import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type {
  MergeRequest,
  FileChange,
  MRChangesResponse,
  ParsedMRUrl,
  DiffVersion,
  GitLabNote,
  GitLabDiscussion,
  GitLabComment,
  ProxySettings,
  GitLabFileResponse,
  GitLabProject,
} from '../../shared/types';
import { logger } from './logger.service';

export class GitLabService {
  private baseURL: string;
  private token: string;
  private proxyAgent: SocksProxyAgent | HttpsProxyAgent<string> | null = null;

  constructor(baseURL: string, token: string, proxySettings?: ProxySettings) {
    this.baseURL = baseURL.replace(/\/$/, '');
    // Sanitize token to prevent "Invalid header received from client" errors
    // Tokens pasted by users often contain newlines or whitespace
    this.token = token.replace(/[\r\n]/g, '').trim();

    // Configure proxy if provided and enabled
    if (proxySettings) {
      this.configureProxy(proxySettings);
    }

    // Debug: Log token info (length and first/last chars only for security)
    logger.debug('gitlab', 'Token sanitized', {
      originalLength: token.length,
      sanitizedLength: this.token.length,
      hasNewlines: token.includes('\n') || token.includes('\r'),
      firstChars: this.token.substring(0, 4) + '...',
      lastChars: '...' + this.token.substring(this.token.length - 4),
    });
  }

  /**
   * Configure proxy settings
   */
  configureProxy(settings: ProxySettings): void {
    if (!settings.enabled || settings.type === 'none' || !settings.host) {
      this.proxyAgent = null;
      logger.debug('gitlab', 'Proxy disabled');
      return;
    }

    const proxyUrl = `${settings.type}://${settings.host}:${settings.port}`;

    if (settings.type === 'socks5') {
      this.proxyAgent = new SocksProxyAgent(proxyUrl);
      logger.info('gitlab', 'Using SOCKS5 proxy', { proxyUrl });
    } else if (settings.type === 'http') {
      this.proxyAgent = new HttpsProxyAgent(proxyUrl);
      logger.info('gitlab', 'Using HTTP proxy', { proxyUrl });
    }
  }

  /**
   * Get axios config with proxy settings if configured
   */
  private getAxiosConfig(): Partial<AxiosRequestConfig> {
    if (this.proxyAgent) {
      return {
        proxy: false, // Disable default proxy, use our agent
        httpAgent: this.proxyAgent,
        httpsAgent: this.proxyAgent,
      };
    }
    return {};
  }

  /**
   * Make a GET request with a full URL (prevents axios from decoding encoded paths)
   */
  private async getWithFullUrl<T>(path: string): Promise<T> {
    const fullUrl = `${this.baseURL}${path}`;
    logger.debug('gitlab', 'GET request', { url: fullUrl });
    try {
      const response = await axios.get<T>(fullUrl, {
        headers: {
          'PRIVATE-TOKEN': this.token,
          Accept: 'application/json',
        },
        timeout: 30000,
        ...this.getAxiosConfig(),
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('gitlab', 'Request failed', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
        });
      }
      throw error;
    }
  }

  /**
   * Make a POST request with a full URL
   */
  private async postWithFullUrl<T>(path: string, body?: unknown): Promise<T> {
    const fullUrl = `${this.baseURL}${path}`;
    logger.debug('gitlab', 'POST request', { url: fullUrl });
    const { data } = await axios.post<T>(fullUrl, body, {
      headers: {
        'PRIVATE-TOKEN': this.token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      ...this.getAxiosConfig(),
    });
    return data;
  }

  /**
   * Make a DELETE request with a full URL
   */
  private async deleteWithFullUrl(path: string): Promise<void> {
    const fullUrl = `${this.baseURL}${path}`;
    logger.debug('gitlab', 'DELETE request', { url: fullUrl });
    await axios.delete(fullUrl, {
      headers: {
        'PRIVATE-TOKEN': this.token,
        Accept: 'application/json',
      },
      timeout: 30000,
      ...this.getAxiosConfig(),
    });
  }

  /**
   * Parse a GitLab MR URL to extract project path and MR IID
   */
  parseMRUrl(url: string): ParsedMRUrl | null {
    const patterns = [
      // Standard GitLab URL: https://gitlab.com/namespace/project/-/merge_requests/123
      /https?:\/\/[^/]+\/(.+?)\/-\/merge_requests\/(\d+)/,
      // Alternative format: https://gitlab.com/projects/namespace/project/merge_requests/123
      /https?:\/\/[^/]+\/projects\/(.+?)\/merge_requests\/(\d+)/,
      // Legacy format: https://gitlab.com/namespace/project/merge_requests/123
      /https?:\/\/[^/]+\/(.+?)\/merge_requests\/(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          projectPath: match[1],
          mrIID: parseInt(match[2], 10),
        };
      }
    }

    return null;
  }

  /**
   * Fetch merge request details
   */
  async fetchMergeRequest(projectPath: string, mrIID: number): Promise<MergeRequest> {
    const encodedPath = encodeURIComponent(projectPath);
    const path = `/projects/${encodedPath}/merge_requests/${mrIID}`;

    try {
      return await this.getWithFullUrl<MergeRequest>(path);
    } catch (error) {
      throw this.handleError(error);
    }
  }


  /**
   * Fetches project information including SSH URL for cloning
   * @param projectPath - The project path (e.g., "group/project")
   */
  async fetchProjectInfo(projectPath: string): Promise<GitLabProject> {
    const encodedPath = encodeURIComponent(projectPath);
    const path = `/projects/${encodedPath}`;

    try {
      return await this.getWithFullUrl<GitLabProject>(path);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch MR file changes (diffs)
   */
  async fetchMRChanges(projectPath: string, mrIID: number): Promise<FileChange[]> {
    const encodedPath = encodeURIComponent(projectPath);
    const path = `/projects/${encodedPath}/merge_requests/${mrIID}/changes`;

    try {
      const data = await this.getWithFullUrl<MRChangesResponse>(path);
      return data.changes;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Post a general comment on the MR
   */
  async postComment(projectPath: string, mrIID: number, body: string): Promise<void> {
    const encodedPath = encodeURIComponent(projectPath);
    const path = `/projects/${encodedPath}/merge_requests/${mrIID}/notes`;

    try {
      await this.postWithFullUrl(path, { body });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch existing comments/discussions on the MR
   */
  async fetchExistingComments(projectPath: string, mrIID: number): Promise<GitLabComment[]> {
    const encodedPath = encodeURIComponent(projectPath);
    const path = `/projects/${encodedPath}/merge_requests/${mrIID}/discussions`;

    try {
      const data = await this.getWithFullUrl<GitLabDiscussion[]>(path);
      // Flatten all notes from all discussions
      return data.flatMap((discussion) => discussion.notes);
    } catch (error) {
      // Return empty array on error (no comments yet)
      logger.warn('gitlab', 'Failed to fetch existing comments', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Fetch diff versions to get SHA information for line comments
   */
  async fetchDiffVersions(projectPath: string, mrIID: number): Promise<DiffVersion[]> {
    const encodedPath = encodeURIComponent(projectPath);
    const path = `/projects/${encodedPath}/merge_requests/${mrIID}/versions`;

    try {
      return await this.getWithFullUrl<DiffVersion[]>(path);
    } catch (error) {
      logger.warn('gitlab', 'Failed to fetch diff versions', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Post a line-specific comment on the MR diff
   */
  async postLineComment(
    projectPath: string,
    mrIID: number,
    filePath: string,
    lineNumber: number,
    body: string,
    fileChange?: FileChange
  ): Promise<void> {
    const encodedPath = encodeURIComponent(projectPath);

    // Fetch diff versions to get proper SHAs
    const versions = await this.fetchDiffVersions(projectPath, mrIID);
    const latestVersion = versions[0];

    if (!latestVersion) {
      // Fallback to regular comment if no versions available
      const formattedBody = `\`${filePath}:${lineNumber}\`\n\n${body}`;
      await this.postComment(projectPath, mrIID, formattedBody);
      return;
    }

    // Build position object
    const position: Record<string, unknown> = {
      position_type: 'text',
      base_sha: latestVersion.base_commit_sha,
      start_sha: latestVersion.start_commit_sha,
      head_sha: latestVersion.head_commit_sha,
      new_path: filePath,
      new_line: lineNumber,
    };

    // For modified files, include old_path and try to find old_line
    if (fileChange && !fileChange.new_file) {
      position.old_path = fileChange.old_path;
      const oldLine = this.findOldLineNumber(fileChange.diff, lineNumber);
      if (oldLine !== null) {
        position.old_line = oldLine;
      }
    }

    const path = `/projects/${encodedPath}/merge_requests/${mrIID}/discussions`;

    try {
      await this.postWithFullUrl(path, { body, position });
      logger.info('gitlab', `Posted discussion on ${filePath}:${lineNumber}`);
    } catch (error) {
      // Fallback to regular comment if positioning fails
      logger.warn('gitlab', 'Line comment failed, posting as regular comment', { error: error instanceof Error ? error.message : String(error) });
      const formattedBody = `\`${filePath}:${lineNumber}\`\n\n${body}`;
      await this.postComment(projectPath, mrIID, formattedBody);
    }
  }

  /**
   * Delete all comments authored by the current user
   */
  async deleteMyComments(projectPath: string, mrIID: number): Promise<number> {
    const encodedPath = encodeURIComponent(projectPath);
    let deletedCount = 0;

    // Delete regular notes
    try {
      const notesPath = `/projects/${encodedPath}/merge_requests/${mrIID}/notes`;
      const notes = await this.getWithFullUrl<GitLabNote[]>(notesPath);

      for (const note of notes) {
        try {
          await this.deleteWithFullUrl(`${notesPath}/${note.id}`);
          deletedCount++;
          logger.debug('gitlab', `Deleted note ${note.id}`);
          await this.sleep(200);
        } catch (error) {
          logger.warn('gitlab', `Failed to delete note ${note.id}`, { error: error instanceof Error ? error.message : String(error) });
        }
      }
    } catch (error) {
      logger.warn('gitlab', 'Failed to fetch notes', { error: error instanceof Error ? error.message : String(error) });
    }

    // Delete discussion notes
    try {
      const discussionsPath = `/projects/${encodedPath}/merge_requests/${mrIID}/discussions`;
      const discussions = await this.getWithFullUrl<GitLabDiscussion[]>(discussionsPath);

      for (const discussion of discussions) {
        for (const note of discussion.notes) {
          try {
            const deletePath = `${discussionsPath}/${discussion.id}/notes/${note.id}`;
            await this.deleteWithFullUrl(deletePath);
            deletedCount++;
            logger.debug('gitlab', `Deleted discussion note ${note.id}`);
            await this.sleep(200);
          } catch (error) {
            logger.warn('gitlab', `Failed to delete discussion note ${note.id}`, { error: error instanceof Error ? error.message : String(error) });
          }
        }
      }
    } catch (error) {
      logger.warn('gitlab', 'Failed to fetch discussions', { error: error instanceof Error ? error.message : String(error) });
    }

    return deletedCount;
  }

  /**
   * Approve a merge request
   */
  async approveMR(projectPath: string, mrIID: number): Promise<void> {
    const encodedPath = encodeURIComponent(projectPath);
    const path = `/projects/${encodedPath}/merge_requests/${mrIID}/approve`;

    try {
      await this.postWithFullUrl(path);
      logger.info('gitlab', `Approved MR ${mrIID}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch a file's content from the repository
   * Returns null if the file doesn't exist (404), throws for other errors
   */
  async fetchFileContent(projectPath: string, filePath: string, ref: string): Promise<string | null> {
    const encodedPath = encodeURIComponent(projectPath);
    const encodedFilePath = encodeURIComponent(filePath);
    const path = `/projects/${encodedPath}/repository/files/${encodedFilePath}?ref=${encodeURIComponent(ref)}`;

    try {
      const response = await this.getWithFullUrl<GitLabFileResponse>(path);
      // Decode base64 content
      const content = Buffer.from(response.content, 'base64').toString('utf-8');
      logger.info('gitlab', `Fetched ${filePath} (${response.size} bytes) from ${ref}`);
      return content;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.debug('gitlab', `File ${filePath} not found in ${ref}`);
        return null;
      }
      throw this.handleError(error);
    }
  }

  /**
   * Find the old line number from a diff for a given new line
   */
  private findOldLineNumber(diff: string, newLine: number): number | null {
    let currentOldLine = 0;
    let currentNewLine = 0;

    const lines = diff.split('\n');

    for (const line of lines) {
      // Parse diff hunk headers like @@ -10,5 +10,7 @@
      const hunkMatch = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentOldLine = parseInt(hunkMatch[1], 10);
        currentNewLine = parseInt(hunkMatch[2], 10);
        continue;
      }

      // Skip diff metadata lines
      if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff --git')) {
        continue;
      }

      // Process actual diff lines
      if (line.startsWith('+')) {
        // Line added in new version
        if (currentNewLine === newLine) {
          return null; // New line, no old equivalent
        }
        currentNewLine++;
      } else if (line.startsWith('-')) {
        // Line removed from old version
        currentOldLine++;
      } else if (line.length > 0) {
        // Unchanged line (context)
        if (currentNewLine === newLine) {
          return currentOldLine;
        }
        currentOldLine++;
        currentNewLine++;
      }
    }

    return null;
  }

  /**
   * Handle axios errors and convert to appropriate error types
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      switch (status) {
        case 401:
          return new Error(
            'GitLab token is invalid, expired, or missing required permissions. Please check your token has "read_api" and "read_repository" scopes.'
          );
        case 404:
          return new Error('Merge request not found');
        case 429: {
          const retryAfter = axiosError.response?.headers['retry-after'] || '60';
          return new Error(`Rate limited. Retry after ${retryAfter} seconds`);
        }
        default:
          if (axiosError.code === 'ECONNABORTED') {
            return new Error('Request timed out. Please check your network connection.');
          }
          return new Error(`Network error: ${axiosError.message}`);
      }
    }

    return error instanceof Error ? error : new Error('Unknown error occurred');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
