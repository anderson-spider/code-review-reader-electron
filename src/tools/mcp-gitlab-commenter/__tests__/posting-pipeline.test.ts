import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postReviewComments, fetchExistingComments } from '../posting-pipeline';
import { GitLabClient } from '../gitlab-client';
import type { ReviewComment } from '../types';

vi.mock('../gitlab-client');

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: 'c1',
    filePath: 'src/index.ts',
    lineNumber: 10,
    severity: 'warning',
    comment: 'This is a test comment with enough text for duplicate check',
    ...overrides,
  };
}

function createMockClient() {
  const client = new GitLabClient('https://gitlab.com/api/v4', 'fake-token');
  client.get = vi.fn();
  client.post = vi.fn();
  client.delete = vi.fn();
  client.sleep = vi.fn().mockResolvedValue(undefined);
  return client;
}

describe('postReviewComments', () => {
  let client: GitLabClient;

  beforeEach(() => {
    client = createMockClient();
    // Default mocks: no existing comments, one version, one change
    (client.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('/discussions')) return Promise.resolve([]);
      if (path.includes('/versions')) return Promise.resolve([{
        base_commit_sha: 'base123',
        head_commit_sha: 'head456',
        start_commit_sha: 'start789',
      }]);
      if (path.includes('/changes')) return Promise.resolve({
        changes: [{
          old_path: 'src/index.ts',
          new_path: 'src/index.ts',
          diff: '@@ -8,5 +8,5 @@\n context\n context\n-old\n+new\n context\n',
          new_file: false,
          renamed_file: false,
          deleted_file: false,
        }],
      });
      return Promise.resolve(null);
    });
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  // V7: skip info comments
  it('should skip info-severity comments when skipInfo is true', async () => {
    const comments = [makeComment({ severity: 'info' })];
    const result = await postReviewComments(client, 'group/project', 1, comments, true, 0);

    expect(result.skipped).toBe(1);
    expect(result.posted).toBe(0);
    expect(client.post).not.toHaveBeenCalled();
  });

  it('should post info comments when skipInfo is false', async () => {
    const comments = [makeComment({ severity: 'info' })];
    const result = await postReviewComments(client, 'group/project', 1, comments, false, 0);

    expect(result.posted).toBe(1);
  });

  // V1: duplicate detection
  it('should skip duplicate comments', async () => {
    const comment = makeComment();
    (client.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('/discussions')) return Promise.resolve([{
        id: 'd1',
        notes: [{
          id: 1,
          body: comment.comment,
          position: { new_path: 'src/index.ts', new_line: 10, old_path: null, old_line: null },
        }],
      }]);
      if (path.includes('/versions')) return Promise.resolve([{ base_commit_sha: 'b', head_commit_sha: 'h', start_commit_sha: 's' }]);
      if (path.includes('/changes')) return Promise.resolve({ changes: [] });
      return Promise.resolve(null);
    });

    const result = await postReviewComments(client, 'group/project', 1, [comment], true, 0);

    expect(result.duplicates).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.posted).toBe(0);
  });

  // V2: inline comment with position
  it('should post inline comment with correct position', async () => {
    const comments = [makeComment()];
    const result = await postReviewComments(client, 'group/project', 1, comments, true, 0);

    expect(result.posted).toBe(1);
    expect(client.post).toHaveBeenCalledWith(
      expect.stringContaining('/discussions'),
      expect.objectContaining({
        position: expect.objectContaining({
          position_type: 'text',
          base_sha: 'base123',
          head_sha: 'head456',
          start_sha: 'start789',
          new_path: 'src/index.ts',
          new_line: 10,
        }),
      })
    );
  });

  // V3: old_path and old_line for modified files
  it('should include old_path for modified files', async () => {
    const comments = [makeComment({ lineNumber: 8 })];
    const result = await postReviewComments(client, 'group/project', 1, comments, true, 0);

    expect(result.posted).toBe(1);
    const postCall = (client.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(postCall[1].position.old_path).toBe('src/index.ts');
  });

  // V5: fallback to general comment
  it('should fallback to general comment when no line number', async () => {
    const comments = [makeComment({ lineNumber: null })];
    const result = await postReviewComments(client, 'group/project', 1, comments, true, 0);

    expect(result.posted).toBe(1);
    expect(client.post).toHaveBeenCalledWith(
      expect.stringContaining('/notes'),
      expect.objectContaining({ body: expect.stringContaining('**src/index.ts**') })
    );
  });

  // V8: rate limiting
  it('should sleep between posts', async () => {
    const comments = [makeComment({ id: 'c1' }), makeComment({ id: 'c2', lineNumber: 20 })];
    await postReviewComments(client, 'group/project', 1, comments, true, 500);

    expect(client.sleep).toHaveBeenCalledWith(500);
    expect((client.sleep as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  // V10: code snippet formatting
  it('should format code snippet in fenced block', async () => {
    const comments = [makeComment({ codeSnippet: 'const x = 1;' })];
    await postReviewComments(client, 'group/project', 1, comments, true, 0);

    const postCall = (client.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(postCall[1].body).toContain('```\nconst x = 1;\n```');
  });

  // commentIds filtering
  it('should only post comments matching commentIds when provided', async () => {
    const comments = [
      makeComment({ id: 'c1', lineNumber: 10 }),
      makeComment({ id: 'c2', lineNumber: 20 }),
      makeComment({ id: 'c3', lineNumber: 30 }),
    ];
    const result = await postReviewComments(client, 'group/project', 1, comments, true, 0, ['c1', 'c3']);

    expect(result.posted).toBe(2);
    expect(client.post).toHaveBeenCalledTimes(2);
  });

  it('should post all comments when commentIds is undefined', async () => {
    const comments = [
      makeComment({ id: 'c1', lineNumber: 10 }),
      makeComment({ id: 'c2', lineNumber: 20 }),
    ];
    const result = await postReviewComments(client, 'group/project', 1, comments, true, 0);

    expect(result.posted).toBe(2);
  });

  it('should post nothing when commentIds is empty array', async () => {
    const comments = [makeComment({ id: 'c1' })];
    const result = await postReviewComments(client, 'group/project', 1, comments, true, 0, []);

    expect(result.posted).toBe(0);
    expect(client.post).not.toHaveBeenCalled();
  });
});

describe('fetchExistingComments', () => {
  it('should flatten discussion notes', async () => {
    const client = createMockClient();
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'd1', notes: [{ id: 1, body: 'a', position: null }, { id: 2, body: 'b', position: null }] },
      { id: 'd2', notes: [{ id: 3, body: 'c', position: null }] },
    ]);

    const comments = await fetchExistingComments(client, 'group%2Fproject', 1);
    expect(comments).toHaveLength(3);
  });

  it('should return empty array on error', async () => {
    const client = createMockClient();
    (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const comments = await fetchExistingComments(client, 'group%2Fproject', 1);
    expect(comments).toEqual([]);
  });
});
