import { GitLabClient } from './gitlab-client';
import { findOldLineNumber } from './diff-utils';
import type {
  ReviewComment,
  FileChange,
  DiffVersion,
  GitLabDiscussion,
  GitLabComment,
  CommentPosition,
  MRChangesResponse,
  PostResult,
} from './types';

function formatComment(comment: ReviewComment): string {
  let formatted = comment.comment;
  if (comment.codeSnippet) {
    formatted += `\n\n\`\`\`\n${comment.codeSnippet}\n\`\`\``;
  }
  return formatted;
}

function isDuplicate(comment: ReviewComment, existing: GitLabComment[]): boolean {
  const snippet = comment.comment.substring(0, 50);
  return existing.some(
    (e) =>
      e.position?.new_path === comment.filePath &&
      e.position?.new_line === comment.lineNumber &&
      e.body.includes(snippet)
  );
}

export async function fetchExistingComments(
  client: GitLabClient,
  encodedPath: string,
  mrIID: number
): Promise<GitLabComment[]> {
  try {
    const discussions = await client.get<GitLabDiscussion[]>(
      `/projects/${encodedPath}/merge_requests/${mrIID}/discussions`
    );
    return discussions.flatMap((d) => d.notes);
  } catch {
    return [];
  }
}

async function fetchDiffVersions(
  client: GitLabClient,
  encodedPath: string,
  mrIID: number
): Promise<DiffVersion[]> {
  try {
    return await client.get<DiffVersion[]>(
      `/projects/${encodedPath}/merge_requests/${mrIID}/versions`
    );
  } catch {
    return [];
  }
}

async function fetchChanges(
  client: GitLabClient,
  encodedPath: string,
  mrIID: number
): Promise<FileChange[]> {
  try {
    const response = await client.get<MRChangesResponse>(
      `/projects/${encodedPath}/merge_requests/${mrIID}/changes`
    );
    return response.changes;
  } catch {
    return [];
  }
}

async function postInlineComment(
  client: GitLabClient,
  encodedPath: string,
  mrIID: number,
  filePath: string,
  lineNumber: number,
  body: string,
  fileChange: FileChange | undefined,
  latestVersion: DiffVersion
): Promise<void> {
  const position: CommentPosition = {
    position_type: 'text',
    base_sha: latestVersion.base_commit_sha,
    start_sha: latestVersion.start_commit_sha,
    head_sha: latestVersion.head_commit_sha,
    new_path: filePath,
    new_line: lineNumber,
  };

  if (fileChange && !fileChange.new_file) {
    position.old_path = fileChange.old_path;
    const oldLine = findOldLineNumber(fileChange.diff, lineNumber);
    if (oldLine !== null) {
      position.old_line = oldLine;
    }
  }

  await client.post(
    `/projects/${encodedPath}/merge_requests/${mrIID}/discussions`,
    { body, position }
  );
}

async function postGeneralComment(
  client: GitLabClient,
  encodedPath: string,
  mrIID: number,
  filePath: string,
  lineNumber: number | null,
  body: string
): Promise<void> {
  const prefix = lineNumber ? `\`${filePath}:${lineNumber}\`` : `**${filePath}**`;
  await client.post(
    `/projects/${encodedPath}/merge_requests/${mrIID}/notes`,
    { body: `${prefix}\n\n${body}` }
  );
}

export async function postReviewComments(
  client: GitLabClient,
  projectPath: string,
  mrIID: number,
  comments: ReviewComment[],
  skipInfo: boolean,
  rateLimitMs: number,
  commentIds?: string[]
): Promise<PostResult> {
  const encodedPath = encodeURIComponent(projectPath);
  const result: PostResult = { posted: 0, skipped: 0, failed: 0, duplicates: 0, errors: [] };

  const targetComments = commentIds
    ? comments.filter((c) => commentIds.includes(c.id))
    : comments;

  const [existing, versions, changes] = await Promise.all([
    fetchExistingComments(client, encodedPath, mrIID),
    fetchDiffVersions(client, encodedPath, mrIID),
    fetchChanges(client, encodedPath, mrIID),
  ]);

  const latestVersion = versions[0];
  const changesMap = new Map(changes.map((c) => [c.new_path, c]));

  for (const comment of targetComments) {
    if (skipInfo && comment.severity === 'info') {
      result.skipped++;
      continue;
    }

    const body = formatComment(comment);

    if (isDuplicate(comment, existing)) {
      result.duplicates++;
      result.skipped++;
      continue;
    }

    try {
      if (comment.lineNumber && latestVersion) {
        try {
          const fileChange = changesMap.get(comment.filePath);
          await postInlineComment(
            client, encodedPath, mrIID,
            comment.filePath, comment.lineNumber, body,
            fileChange, latestVersion
          );
        } catch {
          await postGeneralComment(
            client, encodedPath, mrIID,
            comment.filePath, comment.lineNumber, body
          );
        }
      } else {
        await postGeneralComment(
          client, encodedPath, mrIID,
          comment.filePath, comment.lineNumber, body
        );
      }
      result.posted++;

      if (rateLimitMs > 0) {
        await client.sleep(rateLimitMs);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(
        `${comment.filePath}:${comment.lineNumber}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}
