import type { MergeRequest, Author, ParsedMRUrl } from '../../shared/types';

export const mockAuthor: Author = {
  id: 1,
  name: 'John Doe',
  username: 'johndoe',
  avatar_url: 'https://gitlab.com/uploads/-/system/user/avatar/1/avatar.png',
};

export const createMockMR = (overrides: Partial<MergeRequest> = {}): MergeRequest => ({
  id: 12345,
  iid: 123,
  title: 'Add new feature',
  description: 'This MR adds a new feature to the application',
  source_branch: 'feature/new-feature',
  target_branch: 'main',
  author: mockAuthor,
  web_url: 'https://gitlab.com/namespace/project/-/merge_requests/123',
  sha: 'abc123def456',
  state: 'opened',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
  has_conflicts: false,
  merge_status: 'can_be_merged',
  changes_count: 5,
  ...overrides,
});

export const mockOpenMR = createMockMR();

export const mockMergedMR = createMockMR({
  state: 'merged',
});

export const mockClosedMR = createMockMR({
  state: 'closed',
});

export const mockConflictMR = createMockMR({
  has_conflicts: true,
  merge_status: 'cannot_be_merged',
});

export const mockLargeMR = createMockMR({
  changes_count: 100,
});

export const mockParsedUrl: ParsedMRUrl = {
  projectPath: 'namespace/project',
  mrIID: 123,
};

export const mockParsedUrlNested: ParsedMRUrl = {
  projectPath: 'group/subgroup/project',
  mrIID: 456,
};
