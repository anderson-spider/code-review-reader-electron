import type { DiffVersion, GitLabNote, GitLabDiscussion, GitLabComment } from '../../shared/types';
import { mockAuthor } from './mr-data';

export const mockDiffVersion: DiffVersion = {
  base_commit_sha: 'base123abc',
  head_commit_sha: 'head456def',
  start_commit_sha: 'start789ghi',
};

export const mockDiffVersions: DiffVersion[] = [
  mockDiffVersion,
  {
    base_commit_sha: 'oldbase123',
    head_commit_sha: 'oldhead456',
    start_commit_sha: 'oldstart789',
  },
];

export const createMockNote = (overrides: Partial<GitLabNote> = {}): GitLabNote => ({
  id: 1001,
  body: 'This is a review comment',
  author: mockAuthor,
  created_at: '2024-01-15T10:30:00Z',
  ...overrides,
});

export const mockNotes: GitLabNote[] = [
  createMockNote({ id: 1001, body: 'First comment' }),
  createMockNote({ id: 1002, body: 'Second comment' }),
  createMockNote({ id: 1003, body: 'Third comment' }),
];

export const createMockGitLabComment = (overrides: Partial<GitLabComment> = {}): GitLabComment => ({
  id: 2001,
  body: 'Line-specific comment',
  position: {
    new_path: 'src/example.ts',
    new_line: 42,
    old_path: 'src/example.ts',
    old_line: 40,
    position_type: 'text',
  },
  author: mockAuthor,
  ...overrides,
});

export const mockGitLabCommentNoPosition = createMockGitLabComment({
  id: 2002,
  position: null,
});

export const createMockDiscussion = (overrides: Partial<GitLabDiscussion> = {}): GitLabDiscussion => ({
  id: 'discussion-abc123',
  notes: [createMockGitLabComment()],
  ...overrides,
});

export const mockDiscussions: GitLabDiscussion[] = [
  createMockDiscussion({
    id: 'disc-1',
    notes: [
      createMockGitLabComment({ id: 2001, body: 'Comment in discussion 1' }),
    ],
  }),
  createMockDiscussion({
    id: 'disc-2',
    notes: [
      createMockGitLabComment({ id: 2002, body: 'First comment in discussion 2' }),
      createMockGitLabComment({ id: 2003, body: 'Reply in discussion 2' }),
    ],
  }),
];

// Error responses
export const mockUnauthorizedResponse = {
  status: 401,
  data: { message: '401 Unauthorized' },
};

export const mockNotFoundResponse = {
  status: 404,
  data: { message: '404 Not Found' },
};

export const mockRateLimitResponse = {
  status: 429,
  headers: { 'retry-after': '60' },
  data: { message: 'Rate limit exceeded' },
};

export const mockNetworkError = {
  code: 'ECONNABORTED',
  message: 'timeout of 30000ms exceeded',
};
