import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { GitLabClient } from './gitlab-client';
import { postReviewComments, fetchExistingComments } from './posting-pipeline';
import { findOldLineNumber } from './diff-utils';
import type {
  DiffVersion,
  FileChange,
  MergeRequest,
  MRChangesResponse,
  GitLabDiscussion,
  GitLabNote,
  CommentPosition,
} from './types';

const server = new McpServer({
  name: 'gitlab-mr-commenter',
  version: '0.1.0',
});

function getToken(): string {
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error('GITLAB_TOKEN environment variable is required');
  }
  return token;
}

function createClient(gitlabUrl: string): GitLabClient {
  return new GitLabClient(gitlabUrl, getToken());
}

function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true as const };
}

const ReviewCommentSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  lineNumber: z.number().nullable(),
  severity: z.enum(['critical', 'warning', 'suggestion', 'info']),
  comment: z.string(),
  codeSnippet: z.string().optional(),
});

const MrIdentifierSchema = {
  gitlabUrl: z.string().describe('GitLab API base URL (e.g. https://gitlab.com/api/v4)'),
  projectPath: z.string().describe('Project path (e.g. group/project)'),
  mrIID: z.number().describe('Merge request internal ID'),
};

// T5: post_review_comments — batch pipeline
server.tool(
  'post_review_comments',
  'Post a batch of review comments to a GitLab MR with inline positioning and duplicate detection',
  {
    ...MrIdentifierSchema,
    comments: z.array(ReviewCommentSchema).describe('Review comments to post'),
    skipInfo: z.boolean().default(true).describe('Skip info-severity comments'),
    rateLimitMs: z.number().default(500).describe('Delay between posts in ms'),
    commentIds: z.array(z.string()).optional().describe('Post only comments with these IDs. Use after user selects which comments to post.'),
  },
  async ({ gitlabUrl, projectPath, mrIID, comments, skipInfo, rateLimitMs, commentIds }) => {
    try {
      const client = createClient(gitlabUrl);
      const result = await postReviewComments(client, projectPath, mrIID, comments, skipInfo, rateLimitMs, commentIds);
      return toolResult(result);
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  }
);

// T6: post_single_comment — inline or general
server.tool(
  'post_single_comment',
  'Post a single review comment to a GitLab MR (inline or general)',
  {
    ...MrIdentifierSchema,
    filePath: z.string().describe('File path relative to repo root'),
    lineNumber: z.number().nullable().describe('Line number for inline comment, null for general'),
    body: z.string().describe('Comment body (markdown)'),
    codeSnippet: z.string().optional().describe('Code snippet to include in fenced block'),
  },
  async ({ gitlabUrl, projectPath, mrIID, filePath, lineNumber, body, codeSnippet }) => {
    try {
      const client = createClient(gitlabUrl);
      const encodedPath = encodeURIComponent(projectPath);

      let fullBody = body;
      if (codeSnippet) {
        fullBody += `\n\n\`\`\`\n${codeSnippet}\n\`\`\``;
      }

      if (lineNumber) {
        const versions = await client.get<DiffVersion[]>(
          `/projects/${encodedPath}/merge_requests/${mrIID}/versions`
        );
        const latestVersion = versions[0];

        if (latestVersion) {
          const changesResp = await client.get<MRChangesResponse>(
            `/projects/${encodedPath}/merge_requests/${mrIID}/changes`
          );
          const fileChange = changesResp.changes.find((c: FileChange) => c.new_path === filePath);

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

          try {
            await client.post(
              `/projects/${encodedPath}/merge_requests/${mrIID}/discussions`,
              { body: fullBody, position }
            );
            return toolResult({ posted: true, type: 'inline', filePath, lineNumber });
          } catch {
            // V5: fallback to general comment
          }
        }
      }

      const prefix = lineNumber ? `\`${filePath}:${lineNumber}\`` : `**${filePath}**`;
      await client.post(
        `/projects/${encodedPath}/merge_requests/${mrIID}/notes`,
        { body: `${prefix}\n\n${fullBody}` }
      );
      return toolResult({ posted: true, type: 'general', filePath, lineNumber });
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  }
);

// T7: delete_my_comments
server.tool(
  'delete_my_comments',
  'Delete all comments authored by the authenticated user on a GitLab MR',
  {
    ...MrIdentifierSchema,
  },
  async ({ gitlabUrl, projectPath, mrIID }) => {
    try {
      const client = createClient(gitlabUrl);
      const encodedPath = encodeURIComponent(projectPath);
      let deletedCount = 0;

      // Delete regular notes
      try {
        const notesPath = `/projects/${encodedPath}/merge_requests/${mrIID}/notes`;
        const notes = await client.get<GitLabNote[]>(notesPath);
        for (const note of notes) {
          try {
            await client.delete(`${notesPath}/${note.id}`);
            deletedCount++;
            await client.sleep(200);
          } catch { /* skip individual failures */ }
        }
      } catch { /* no notes */ }

      // Delete discussion notes
      try {
        const discussionsPath = `/projects/${encodedPath}/merge_requests/${mrIID}/discussions`;
        const discussions = await client.get<GitLabDiscussion[]>(discussionsPath);
        for (const discussion of discussions) {
          for (const note of discussion.notes) {
            try {
              await client.delete(`${discussionsPath}/${discussion.id}/notes/${note.id}`);
              deletedCount++;
              await client.sleep(200);
            } catch { /* skip individual failures */ }
          }
        }
      } catch { /* no discussions */ }

      return toolResult({ deleted: deletedCount });
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  }
);

// T8: check_duplicates
server.tool(
  'check_duplicates',
  'Check which review comments already exist on a GitLab MR (read-only)',
  {
    ...MrIdentifierSchema,
    comments: z.array(ReviewCommentSchema).describe('Comments to check for duplicates'),
  },
  async ({ gitlabUrl, projectPath, mrIID, comments }) => {
    try {
      const client = createClient(gitlabUrl);
      const encodedPath = encodeURIComponent(projectPath);
      const existing = await fetchExistingComments(client, encodedPath, mrIID);

      const duplicates: string[] = [];
      const unique: string[] = [];

      for (const comment of comments) {
        const snippet = comment.comment.substring(0, 50);
        const isDup = existing.some(
          (e) =>
            e.position?.new_path === comment.filePath &&
            e.position?.new_line === comment.lineNumber &&
            e.body.includes(snippet)
        );
        if (isDup) {
          duplicates.push(comment.id);
        } else {
          unique.push(comment.id);
        }
      }

      return toolResult({ duplicates, unique, totalExisting: existing.length });
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  }
);

// T9: fetch_mr_info
server.tool(
  'fetch_mr_info',
  'Fetch GitLab MR metadata, file changes, and diff versions (read-only helper)',
  {
    ...MrIdentifierSchema,
  },
  async ({ gitlabUrl, projectPath, mrIID }) => {
    try {
      const client = createClient(gitlabUrl);
      const encodedPath = encodeURIComponent(projectPath);

      const [mr, changesResp, versions] = await Promise.all([
        client.get<MergeRequest>(`/projects/${encodedPath}/merge_requests/${mrIID}`),
        client.get<MRChangesResponse>(`/projects/${encodedPath}/merge_requests/${mrIID}/changes`),
        client.get<DiffVersion[]>(`/projects/${encodedPath}/merge_requests/${mrIID}/versions`),
      ]);

      return toolResult({
        mr: { id: mr.id, iid: mr.iid, title: mr.title, source_branch: mr.source_branch, target_branch: mr.target_branch, web_url: mr.web_url, state: mr.state },
        changesCount: changesResp.changes.length,
        files: changesResp.changes.map((c: FileChange) => ({ path: c.new_path, new_file: c.new_file, deleted_file: c.deleted_file, renamed_file: c.renamed_file })),
        versions: versions.slice(0, 3),
      });
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`MCP server error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
