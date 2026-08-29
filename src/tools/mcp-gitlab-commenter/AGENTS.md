# GitLab Commenter MCP

## Scope

- Standalone MCP server for GitLab MR comments; transport is stdio (`server.ts`).
- Build target is separate from Electron: `npm run build:mcp` compiles `tsconfig.mcp.json` to `dist/tools/`.
- Runtime entry is `dist/tools/mcp-gitlab-commenter/server.js`.
- Keep project paths URL-encoded in GitLab API routes and return expected failures as MCP tool errors.

## Authentication and security

- `GITLAB_TOKEN` is required in the server environment; it is CR/LF-stripped and trimmed before the `PRIVATE-TOKEN` header is created.
- Never print or serialize `GITLAB_TOKEN`, `PRIVATE-TOKEN`, authorization headers, or real credentials in tests.
- Treat GitLab URLs, project paths, comment bodies, and snippets as untrusted input.

## Tools

- `post_review_comments`: batches review comments, skips `info` by default (`skipInfo=true`), and waits 500 ms between successful posts by default (`rateLimitMs=500`).
- `commentIds` narrows the batch: `undefined` means all comments; an empty array means none; otherwise only matching IDs are considered.
- `post_single_comment`: posts one inline or general comment, appending an optional fenced code snippet.
- `delete_my_comments`: currently attempts to delete every regular note and every discussion note returned for the MR; it does **not** filter by author despite its name/description. Treat it as destructive and require explicit caller intent.
- `check_duplicates`: read-only; returns duplicate and unique IDs using the same matching heuristic as batch posting.
- `fetch_mr_info`: read-only metadata helper returning MR fields, changed-file summaries, and the first three diff versions.

## Posting behavior

- Inline positions use the latest diff version (`versions[0]`) and its `base_commit_sha`, `start_commit_sha`, and `head_commit_sha`, plus `new_path`/`new_line`.
- For an existing file, the pipeline also supplies `old_path` and maps `old_line` from the unified diff when possible.
- If no latest version exists, there is no valid inline position: post a general MR note instead.
- If GitLab rejects an inline discussion, retry the same comment as a general note; a failed fallback is recorded in the batch result.
- Duplicate detection requires matching `position.new_path`, matching `position.new_line`, and the existing body containing the first 50 characters of the candidate comment.
- Batch results report `posted`, `skipped`, `failed`, `duplicates`, and per-comment `errors`; rate limiting applies after successful posts.

## Validation

```bash
npm run build:mcp
npm test -- --run src/tools/mcp-gitlab-commenter/__tests__
```
