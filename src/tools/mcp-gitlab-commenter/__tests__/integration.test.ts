import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postReviewComments } from '../posting-pipeline';
import { GitLabClient } from '../gitlab-client';
import type { ReviewComment } from '../types';

vi.mock('../gitlab-client');

function makeComments(count: number): ReviewComment[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    filePath: `src/file${i}.ts`,
    lineNumber: i + 1,
    severity: i % 4 === 3 ? 'info' as const : 'warning' as const,
    comment: `Comment ${i} with enough text to test duplicate detection properly`,
    codeSnippet: i % 2 === 0 ? `const x${i} = ${i};` : undefined,
  }));
}

function createMockClient() {
  const client = new GitLabClient('https://gitlab.com/api/v4', 'fake');
  client.get = vi.fn();
  client.post = vi.fn();
  client.delete = vi.fn();
  client.sleep = vi.fn().mockResolvedValue(undefined);
  return client;
}

describe('Integration: full pipeline', () => {
  let client: GitLabClient;

  beforeEach(() => {
    client = createMockClient();
    (client.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('/discussions')) return Promise.resolve([]);
      if (path.includes('/versions')) return Promise.resolve([{
        base_commit_sha: 'abc',
        head_commit_sha: 'def',
        start_commit_sha: 'ghi',
      }]);
      if (path.includes('/changes')) return Promise.resolve({
        changes: Array.from({ length: 10 }, (_, i) => ({
          old_path: `src/file${i}.ts`,
          new_path: `src/file${i}.ts`,
          diff: `@@ -1,3 +1,3 @@\n context\n-old\n+new\n context\n`,
          new_file: false,
          renamed_file: false,
          deleted_file: false,
        })),
      });
      return Promise.resolve(null);
    });
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  // V8: rate limiting across batch
  it('should apply rate limiting between all posts', async () => {
    const comments = makeComments(5);
    // 1 info skipped, 4 posted
    await postReviewComments(client, 'g/p', 1, comments, true, 100);

    const sleepCalls = (client.sleep as ReturnType<typeof vi.fn>).mock.calls;
    expect(sleepCalls.length).toBe(4);
    sleepCalls.forEach((call) => expect(call[0]).toBe(100));
  });

  // V5: fallback when inline fails
  it('should fallback to general comment when inline post fails', async () => {
    const comments = [makeComments(1)[0]];
    let callCount = 0;
    (client.post as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      callCount++;
      if (path.includes('/discussions') && callCount === 1) {
        return Promise.reject(new Error('400 position invalid'));
      }
      return Promise.resolve({});
    });

    const result = await postReviewComments(client, 'g/p', 1, comments, true, 0);

    expect(result.posted).toBe(1);
    // First call: /discussions (fails), second: /notes (fallback)
    expect(client.post).toHaveBeenCalledTimes(2);
    const secondCall = (client.post as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(secondCall[0]).toContain('/notes');
  });

  // V11: structured error on total failure
  it('should report errors in result without crashing', async () => {
    const comments = [makeComments(1)[0]];
    (client.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('500 Internal'));

    const result = await postReviewComments(client, 'g/p', 1, comments, true, 0);

    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('500 Internal');
  });

  // Mixed batch: info skipped, duplicates detected, inline + general
  it('should handle mixed batch correctly', async () => {
    const comments: ReviewComment[] = [
      { id: 'c1', filePath: 'a.ts', lineNumber: 1, severity: 'critical', comment: 'Critical issue found in the code' },
      { id: 'c2', filePath: 'b.ts', lineNumber: null, severity: 'warning', comment: 'General warning about code quality' },
      { id: 'c3', filePath: 'c.ts', lineNumber: 5, severity: 'info', comment: 'Info note for documentation' },
      { id: 'c4', filePath: 'd.ts', lineNumber: 10, severity: 'suggestion', comment: 'Consider refactoring this method' },
    ];

    // c1 is already posted (duplicate)
    (client.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('/discussions')) return Promise.resolve([{
        id: 'd1',
        notes: [{
          id: 1,
          body: 'Critical issue found in the code',
          position: { new_path: 'a.ts', new_line: 1, old_path: null, old_line: null },
        }],
      }]);
      if (path.includes('/versions')) return Promise.resolve([{ base_commit_sha: 'a', head_commit_sha: 'b', start_commit_sha: 'c' }]);
      if (path.includes('/changes')) return Promise.resolve({
        changes: [
          { old_path: 'a.ts', new_path: 'a.ts', diff: '', new_file: true, renamed_file: false, deleted_file: false },
          { old_path: 'd.ts', new_path: 'd.ts', diff: '@@ -1,3 +1,3 @@\n c\n-o\n+n\n c\n', new_file: false, renamed_file: false, deleted_file: false },
        ],
      });
      return Promise.resolve(null);
    });

    const result = await postReviewComments(client, 'g/p', 1, comments, true, 0);

    expect(result.duplicates).toBe(1); // c1
    expect(result.skipped).toBe(2);    // c1 (dup) + c3 (info)
    expect(result.posted).toBe(2);     // c2 (general) + c4 (inline)
    expect(result.failed).toBe(0);
  });

  // commentIds: filter subset from batch
  it('should post only selected commentIds from a batch', async () => {
    const comments = makeComments(6); // c0..c5, c3 is info
    // Select only c0, c2, c4
    const result = await postReviewComments(client, 'g/p', 1, comments, true, 0, ['c0', 'c2', 'c4']);

    expect(result.posted).toBe(3);
    expect(client.post).toHaveBeenCalledTimes(3);
  });

  // Pipeline with no versions (all fallback to general)
  it('should post all as general comments when no versions available', async () => {
    (client.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('/discussions')) return Promise.resolve([]);
      if (path.includes('/versions')) return Promise.resolve([]);
      if (path.includes('/changes')) return Promise.resolve({ changes: [] });
      return Promise.resolve(null);
    });

    const comments = [
      { id: 'c1', filePath: 'a.ts', lineNumber: 5, severity: 'warning' as const, comment: 'Should fallback to general' },
    ];

    const result = await postReviewComments(client, 'g/p', 1, comments, true, 0);

    expect(result.posted).toBe(1);
    const postCall = (client.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(postCall[0]).toContain('/notes');
    expect(postCall[1].body).toContain('`a.ts:5`');
  });
});
