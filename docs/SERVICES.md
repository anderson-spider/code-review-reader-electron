# Services

Reference for the Electron main-process services under `src/main/services/`.

## `GitLabService` — `gitlab.service.ts`

GitLab REST client created by `gitlab:init` from the configured API base URL, token, and proxy settings.

Primary operations:

- `parseMRUrl(url)` — extracts `projectPath` and `mrIID` from an MR URL.
- `fetchMergeRequest(projectPath, mrIID)` — MR metadata.
- `fetchMRChanges(projectPath, mrIID)` — changed files and diffs.
- `fetchProjectInfo(projectPath)` — project metadata and SSH URL.
- `fetchFileContent(projectPath, path, ref)` — file content at a Git ref.
- `postComment(...)` and `postLineComment(...)` — general and inline feedback.
- `fetchExistingComments(...)` and `deleteMyComments(...)` — existing-comment management.
- `approveMR(...)` — approval through the authenticated user.

The service normalizes the base URL, URL-encodes project paths, supports HTTP/SOCKS proxy agents, and throws descriptive API errors. Callers must still treat every token, URL, path, and response as untrusted input.

## `CodexService` — `codex.service.ts`

Implements review generation and refinement through `codex app-server`.

- Starts a request-scoped App Server client.
- Uses one thread for a general review or one thread per parallel specialist.
- Shares one client within a parallel review but isolates concurrent top-level reviews.
- Requires strict structured output and validates it through Zod-derived JSON Schemas.
- Retains successful specialist results when another specialist fails; fails only when all specialists fail.
- Closes the client in `finally`.

Requirements:

- Installed Codex CLI.
- Authenticated session confirmed by `codex login status`.

### App Server modules

| File | Responsibility |
|------|----------------|
| `codex-app-server.client.ts` | JSONL transport, request/turn correlation, timeout, and cleanup. |
| `codex-app-server.process.ts` | Safe process spawning with `shell: false` and piped stdio. |
| `codex-app-server.protocol.ts` | Zod schemas and protocol-envelope parsing. |
| `codex-app-server.state.ts` | Pending requests and interleaved turn state. |
| `codex-app-server.errors.ts` | Sanitized transport error categories. |
| `codex-review-contracts.ts` | File filters, diff numbering, output schemas, and parsing. |
| `codex-review-prompts.ts` | Review and refinement prompt construction. |
| `memory-context.provider.ts` | Optional, fail-open SMFS retrieval scoped by project mapping. |
| `memory-container.service.ts` | Authenticated Supermemory CLI discovery with bounded, validated output. |

The protocol order is `initialize` → `initialized` → `thread/start` → `turn/start`. The embedded process starts with `--disable hooks`, so user-level lifecycle integrations such as Supermemory do not read from or write to memory during application reviews. This invocation-scoped override does not change the user's global Codex configuration. Threads use `approvalPolicy: 'never'` and a read-only sandbox.

The main screen discovers spaces with one shell-free `supermemory tags list --json` subprocess and persists the selected `containerTag` against the canonical project URL. Before a review, `MemoryContextProvider` may run one shell-free `smfs grep --tag <containerTag> <query>` call. Parallel specialists share the same snapshot. Results are bounded to 4,000 estimated tokens and injected as `PROJECT MEMORY — UNTRUSTED REFERENCE`; missing configuration, CLI, authentication, timeouts, and invalid output are sanitized warnings and never block the review. The app does not mount containers, manage CLI credentials, store API keys, or expose SMFS to Codex.

## `ConfigService` — `config.service.ts`

Persists configuration through `electron-store` in the application's `config.json`.

> The static `encryptionKey` provides reversible obfuscation only. It is not OS-keychain protection.

Typical locations:

- macOS: `~/Library/Application Support/code-review-reader/config.json`
- Linux: `~/.config/code-review-reader/config.json`
- Windows: `%APPDATA%/code-review-reader/config.json`

| Key | Type | Default |
|-----|------|---------|
| `gitlabToken` | `string` | `''` |
| `gitlabBaseURL` | `string` | `https://gitlab.com/api/v4` |
| `proxyEnabled` | `boolean` | `false` |
| `proxyType` | `'none' \| 'socks5' \| 'http'` | `'none'` |
| `proxyHost` | `string` | `''` |
| `proxyPort` | `number` | `1080` |
| `promptProfiles` | serialized `PromptProfile[]` | default profile |
| `activePromptProfileId` | `string` | `'default'` |
| `memorySettings` | serialized `MemorySettings` | `{ smfsBinaryPath: 'smfs', supermemoryBinaryPath: 'supermemory', projects: [] }` |

The API covers token, base URL, proxy, prompt profiles, and complete reset operations. Token setters strip CR/LF and surrounding whitespace.

## `RepositoryService` — `repository.service.ts`

Builds optional expanded review context from a shallow checkout under `~/code-review-app`.

- `cloneRepository(sshUrl, branch)` — creates `~/code-review-app/cr-checkout-*` and runs a controlled shallow branch clone.
- `buildExpandedContext(repoPath, changes, options)` — reads changed and related files within path, size, depth, and token-budget limits.
- `cleanup(repoPath)` — removes only direct `cr-checkout-*` children owned by the fixed checkout root.

Security invariants:

- Only controlled Git commands may execute.
- Repository paths must remain inside the temporary checkout.
- Never execute package managers, build tools, hooks, interpreters, or arbitrary scripts from the cloned repository.
- Deleted files stay reviewable from the GitLab diff but are skipped during local file reads.
- Cleanup must reject siblings, unrelated children, and every path outside `~/code-review-app`.

## `LoggerService` — `logger.service.ts`

Singleton exported as `logger`:

```ts
logger.info(source, message, data?)
logger.warn(source, message, data?)
logger.error(source, message, data?)
logger.debug(source, message, data?)
```

Each call writes to the main-process terminal and emits `log:entry` when a main window is available. The renderer stores at most 500 entries in `logStore`.

Never log tokens, passwords, authorization headers, prompt secrets, or complete environment dumps.

## `token-utils.ts`

Pure helpers used by expanded-context construction:

- `estimateTokens(text)` — approximate character-based token count.
- `prioritizeFiles(files, changedSet)` — changed files before directly related and lower-priority files.
- `allocateBudget(files, maxTokens)` — selects content within the available budget.

## Validation

```bash
npm test -- --run src/main/services/__tests__
npm run typecheck
npm run build:main

# Optional real Codex smoke test; requires an authenticated CLI
CODEX_LIVE_TEST=1 npm test -- --run src/main/services/__tests__/codex-live.smoke.test.ts
```
