import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { GitLabService } from '../gitlab.service';
import {
  mockOpenMR,
  mockModifiedFile,
  mockDiffVersions,
  mockNotes,
  mockDiscussions,
} from '../../../test/fixtures';
import {
  lineNumberMappingDiff,
} from '../../../test/fixtures/diffs';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('GitLabService', () => {
  let service: GitLabService;
  const baseURL = 'https://gitlab.com/api/v4';
  const token = 'glpat-test-token-12345';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock axios methods directly (service now uses axios.get/post/delete instead of client)
    mockedAxios.get.mockResolvedValue({ data: {} });
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.delete.mockResolvedValue({ data: {} });
    mockedAxios.isAxiosError.mockReturnValue(false);

    service = new GitLabService(baseURL, token);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // URL Parsing Tests
  // =========================================================================
  describe('parseMRUrl', () => {
    it('should parse standard GitLab URL format', () => {
      const url = 'https://gitlab.com/namespace/project/-/merge_requests/123';
      const result = service.parseMRUrl(url);

      expect(result).toEqual({
        projectPath: 'namespace/project',
        mrIID: 123,
      });
    });

    it('should parse nested group URL format', () => {
      const url = 'https://gitlab.com/group/subgroup/project/-/merge_requests/456';
      const result = service.parseMRUrl(url);

      expect(result).toEqual({
        projectPath: 'group/subgroup/project',
        mrIID: 456,
      });
    });

    it('should parse deeply nested group URL format', () => {
      const url = 'https://gitlab.com/a/b/c/d/project/-/merge_requests/789';
      const result = service.parseMRUrl(url);

      expect(result).toEqual({
        projectPath: 'a/b/c/d/project',
        mrIID: 789,
      });
    });

    it('should parse alternative projects URL format', () => {
      const url = 'https://gitlab.example.com/projects/namespace/project/merge_requests/321';
      const result = service.parseMRUrl(url);

      expect(result).toEqual({
        projectPath: 'namespace/project',
        mrIID: 321,
      });
    });

    it('should parse legacy URL format without /-/', () => {
      const url = 'https://gitlab.com/namespace/project/merge_requests/111';
      const result = service.parseMRUrl(url);

      expect(result).toEqual({
        projectPath: 'namespace/project',
        mrIID: 111,
      });
    });

    it('should parse URL with custom GitLab domain', () => {
      const url = 'https://git.company.com/team/repo/-/merge_requests/42';
      const result = service.parseMRUrl(url);

      expect(result).toEqual({
        projectPath: 'team/repo',
        mrIID: 42,
      });
    });

    it('should parse HTTP URL', () => {
      const url = 'http://gitlab.local/ns/proj/-/merge_requests/1';
      const result = service.parseMRUrl(url);

      expect(result).toEqual({
        projectPath: 'ns/proj',
        mrIID: 1,
      });
    });

    it('should return null for invalid URL', () => {
      const url = 'https://github.com/user/repo/pull/123';
      const result = service.parseMRUrl(url);

      expect(result).toBeNull();
    });

    it('should return null for URL without MR number', () => {
      const url = 'https://gitlab.com/namespace/project/-/merge_requests';
      const result = service.parseMRUrl(url);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = service.parseMRUrl('');
      expect(result).toBeNull();
    });

    it('should return null for malformed URL', () => {
      const result = service.parseMRUrl('not a url');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // API Method Tests
  // =========================================================================
  describe('fetchMergeRequest', () => {
    it('should fetch MR details successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockOpenMR });

      const result = await service.fetchMergeRequest('namespace/project', 123);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseURL}/projects/namespace%2Fproject/merge_requests/123`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'PRIVATE-TOKEN': token,
          }),
        })
      );
      expect(result).toEqual(mockOpenMR);
    });

    it('should encode project path with special characters', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockOpenMR });

      await service.fetchMergeRequest('group/sub-group/my project', 123);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseURL}/projects/group%2Fsub-group%2Fmy%20project/merge_requests/123`,
        expect.any(Object)
      );
    });

    it('should throw formatted error for 401 unauthorized', async () => {
      const axiosError = {
        response: { status: 401 },
        message: 'Request failed',
      };
      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(service.fetchMergeRequest('ns/proj', 1)).rejects.toThrow(
        /token is invalid|permissions/i
      );
    });

    it('should throw formatted error for 404 not found', async () => {
      const axiosError = {
        response: { status: 404 },
        message: 'Not found',
      };
      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(service.fetchMergeRequest('ns/proj', 999)).rejects.toThrow(
        'Merge request not found'
      );
    });

    it('should throw formatted error for 429 rate limit', async () => {
      const axiosError = {
        response: {
          status: 429,
          headers: { 'retry-after': '120' },
        },
        message: 'Too many requests',
      };
      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(service.fetchMergeRequest('ns/proj', 1)).rejects.toThrow(
        /Rate limited.*120/
      );
    });

    it('should throw formatted error for timeout', async () => {
      const axiosError = {
        code: 'ECONNABORTED',
        message: 'timeout',
      };
      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(service.fetchMergeRequest('ns/proj', 1)).rejects.toThrow(
        /timed out/i
      );
    });
  });

  describe('fetchMRChanges', () => {
    it('should fetch MR changes successfully', async () => {
      const mockChanges = { changes: [mockModifiedFile] };
      mockedAxios.get.mockResolvedValue({ data: mockChanges });

      const result = await service.fetchMRChanges('namespace/project', 123);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseURL}/projects/namespace%2Fproject/merge_requests/123/changes`,
        expect.any(Object)
      );
      expect(result).toEqual([mockModifiedFile]);
    });
  });

  describe('postComment', () => {
    it('should post a comment successfully', async () => {
      mockedAxios.post.mockResolvedValue({});

      await service.postComment('ns/proj', 123, 'Great work!');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/projects/ns%2Fproj/merge_requests/123/notes`,
        { body: 'Great work!' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'PRIVATE-TOKEN': token,
          }),
        })
      );
    });
  });

  describe('fetchExistingComments', () => {
    it('should fetch and flatten discussion comments', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockDiscussions });

      const result = await service.fetchExistingComments('ns/proj', 123);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseURL}/projects/ns%2Fproj/merge_requests/123/discussions`,
        expect.any(Object)
      );
      // Should flatten notes from all discussions
      expect(result.length).toBe(3); // 1 from disc-1, 2 from disc-2
    });

    it('should return empty array on error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Failed'));

      const result = await service.fetchExistingComments('ns/proj', 123);

      expect(result).toEqual([]);
    });
  });

  describe('fetchDiffVersions', () => {
    it('should fetch diff versions successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockDiffVersions });

      const result = await service.fetchDiffVersions('ns/proj', 123);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseURL}/projects/ns%2Fproj/merge_requests/123/versions`,
        expect.any(Object)
      );
      expect(result).toEqual(mockDiffVersions);
    });

    it('should return empty array on error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Failed'));

      const result = await service.fetchDiffVersions('ns/proj', 123);

      expect(result).toEqual([]);
    });
  });

  describe('postLineComment', () => {
    it('should post line comment with position', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockDiffVersions });
      mockedAxios.post.mockResolvedValue({});

      await service.postLineComment('ns/proj', 123, 'src/file.ts', 42, 'Issue here');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/projects/ns%2Fproj/merge_requests/123/discussions`,
        {
          body: 'Issue here',
          position: expect.objectContaining({
            position_type: 'text',
            new_path: 'src/file.ts',
            new_line: 42,
          }),
        },
        expect.any(Object)
      );
    });

    it('should fallback to regular comment when no versions available', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      mockedAxios.post.mockResolvedValue({});

      await service.postLineComment('ns/proj', 123, 'src/file.ts', 42, 'Issue here');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/projects/ns%2Fproj/merge_requests/123/notes`,
        { body: '`src/file.ts:42`\n\nIssue here' },
        expect.any(Object)
      );
    });

    it('should fallback to regular comment when position posting fails', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockDiffVersions });
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Position failed'))
        .mockResolvedValueOnce({});

      await service.postLineComment('ns/proj', 123, 'src/file.ts', 42, 'Issue here');

      // Should have called post twice - first for discussion (failed), then for note
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        `${baseURL}/projects/ns%2Fproj/merge_requests/123/notes`,
        { body: '`src/file.ts:42`\n\nIssue here' },
        expect.any(Object)
      );
    });

    it('should include old_path for modified files', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockDiffVersions });
      mockedAxios.post.mockResolvedValue({});

      const fileChange = { ...mockModifiedFile, new_file: false };
      await service.postLineComment('ns/proj', 123, 'src/file.ts', 42, 'Issue', fileChange);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          position: expect.objectContaining({
            old_path: fileChange.old_path,
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('deleteMyComments', () => {
    it('should delete notes and discussion notes', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockNotes })
        .mockResolvedValueOnce({ data: mockDiscussions });
      mockedAxios.delete.mockResolvedValue({});

      const count = await service.deleteMyComments('ns/proj', 123);

      // 3 notes + 3 discussion notes = 6 total
      expect(count).toBe(6);
    });

    it('should continue deleting even if some fail', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockNotes.slice(0, 2) })
        .mockResolvedValueOnce({ data: [] });
      mockedAxios.delete
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Delete failed'));

      const count = await service.deleteMyComments('ns/proj', 123);

      // First delete succeeded, second failed
      expect(count).toBe(1);
    });
  });

  describe('approveMR', () => {
    it('should approve MR successfully', async () => {
      mockedAxios.post.mockResolvedValue({});

      await service.approveMR('ns/proj', 123);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseURL}/projects/ns%2Fproj/merge_requests/123/approve`,
        undefined,
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // Private Method Tests (via public interface behavior)
  // =========================================================================
  describe('findOldLineNumber (internal)', () => {
    // Test via postLineComment with fileChange that has diff
    it('should find old line number for context line', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockDiffVersions });
      mockedAxios.post.mockResolvedValue({});

      const fileChange = {
        ...mockModifiedFile,
        new_file: false,
        diff: lineNumberMappingDiff, // Uses our test diff
      };

      // Line 10 in new = line 11 in old (kept1)
      await service.postLineComment('ns/proj', 123, 'file.ts', 10, 'Comment', fileChange);

      // The old_line should be calculated from diff
      const callArgs = mockedAxios.post.mock.calls[0];
      expect(callArgs[1].position).toHaveProperty('old_line');
    });
  });

  describe('handleError (internal)', () => {
    it('should handle generic axios errors', async () => {
      const axiosError = {
        response: { status: 500 },
        message: 'Internal server error',
      };
      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(service.fetchMergeRequest('ns/proj', 1)).rejects.toThrow(
        /Network error/
      );
    });

    it('should handle non-axios errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Random error'));
      mockedAxios.isAxiosError.mockReturnValue(false);

      await expect(service.fetchMergeRequest('ns/proj', 1)).rejects.toThrow(
        'Random error'
      );
    });

    it('should handle unknown error types', async () => {
      mockedAxios.get.mockRejectedValue('string error');
      mockedAxios.isAxiosError.mockReturnValue(false);

      await expect(service.fetchMergeRequest('ns/proj', 1)).rejects.toThrow(
        'Unknown error occurred'
      );
    });
  });
});
