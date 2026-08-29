# Architecture

Electron desktop application that reads GitLab Merge Requests and generates code reviews through Codex App Server.

Coding agents should also read [Agent Architecture Guide](./AGENT-ARCHITECTURE.md) for C4 diagrams, runtime sequences, trust boundaries, and change-routing rules.

## Stack

- **Electron 35** — desktop main and renderer runtime.
- **React 18 + TypeScript 5** — renderer UI.
- **Vite 7** — renderer bundler and development server.
- **Zustand** — renderer state through `appStore` and `logStore`.
- **TailwindCSS + shadcn/ui** — styling and base components.
- **Vitest + Testing Library** — unit and component tests.
- **Playwright** — browser-based E2E scenarios.
- **electron-builder** — DMG, ZIP, NSIS, portable, AppImage, and deb packaging.
- **semantic-release** — automated versioning, changelog, tag, and GitHub Release metadata.

## Layers

```
┌────────────────────────────────────────────────┐
│ Renderer (Chromium + React)                    │
│ src/renderer/                                  │
│ - App.tsx                                      │
│ - views/SettingsView.tsx                       │
│ - components/*                                 │
│ - store/{appStore,logStore}.ts                 │
└─────────────────┬──────────────────────────────┘
                  │ window.electronAPI.* (contextBridge)
                  ▼
┌────────────────────────────────────────────────┐
│ Preload (isolated context)                     │
│ src/main/preload.ts                            │
│ - narrow, typed renderer API                   │
└─────────────────┬──────────────────────────────┘
                  │ ipcRenderer.invoke / on
                  ▼
┌────────────────────────────────────────────────┐
│ Main process (Node.js)                         │
│ src/main/index.ts        (lifecycle)            │
│ src/main/ipc/handlers.ts (privileged router)    │
│ src/main/services/*      (domain services)      │
└─────────────────┬──────────────────────────────┘
                  │
                  ▼
 GitLab REST API | codex app-server | git CLI | supermemory CLI | smfs CLI
```

## Main process

### `src/main/index.ts`

`BrowserWindow` defaults to 1200×800 with a 900×600 minimum:

```ts
nodeIntegration: false,
contextIsolation: true,
sandbox: false, // intentional: preload requires Node/Electron APIs
```

- Development loads `http://localhost:5173` and opens DevTools.
- Production loads `dist/renderer/index.html`.
- `web-contents-created` blocks navigation outside the local development origin or packaged file.
- `setWindowOpenHandler` denies new windows and delegates external links to `shell.openExternal`.
- macOS recreates a window on `activate` only when no window remains.

### `src/main/preload.ts`

The preload is the sole privileged API exposed to the renderer. It groups methods under `gitlab`, `review`, `repository`, `memory`, `config`, and `app`, and exposes cleanup-returning listeners for review progress, repository progress, and logs.

The renderer receives purpose-built functions through `contextBridge`; it never receives raw `ipcRenderer`.

### `src/main/ipc/handlers.ts`

Handlers own privileged routing and delegate review behavior directly to `CodexService`.

Channel groups:

- `gitlab:*` — initialization, URL parsing, MR data, changes, projects, comments, approval, and file retrieval.
- `review:*` — review generation, parallel review, and comment refinement.
- `repository:*` — temporary clone, expanded-context reading, and cleanup.
- `memory:*` — bounded discovery of Supermemory spaces through the authenticated CLI.
- `config:*` — token, proxy, and prompt profile settings.
- `app:*` — version, platform, and external links.
- `review:progress`, `repository:progress`, and `log:entry` — main-to-renderer events.

`IPC_CHANNELS` in `src/shared/types/constants/ipc.ts` contains shared constants but is not currently exhaustive; several runtime channels remain string literals. Contract changes must therefore inspect constants, handlers, preload, renderer declaration, browser mock, test setup, and tests together.

## Main services

See [Services](./SERVICES.md) for the complete reference.

| Service | Responsibility |
|---------|----------------|
| `GitLabService` | GitLab REST calls for MRs, diffs, comments, approval, files, and proxy support. |
| `CodexService` | Codex App Server review orchestration over JSONL/stdio. |
| `ConfigService` | `electron-store` persistence for token, URL, proxy, prompts, and `MemorySettings`. |
| `SmfsMemoryContextProvider` | Optional project-scoped semantic memory retrieval with sanitized fail-open behavior. |
| `SupermemoryContainerService` | Shell-free discovery and validation of remote project memory spaces. |
| `RepositoryService` | Controlled shallow clone, related-file discovery, context budgeting, and cleanup. |
| `LoggerService` | Main-process logs and `log:entry` events. |
| `token-utils` | Token estimation, file prioritization, and budget allocation. |

## Renderer

### `src/renderer/App.tsx`

`App` owns the end-to-end renderer workflow:

- Initial configuration check and GitLab initialization.
- Main/settings view switching through `appStore.currentView`.
- MR URL parsing, MR validation, change retrieval, and large-MR confirmation.
- Supermemory space discovery, project-scoped selection, and persisted overrides.
- Always-attempted local checkout and fail-open expanded context.
- Codex review invocation through the `window.electronAPI.review` renderer contract.
- Review/repository progress and log subscriptions with cleanup.
- Temporary repository cleanup in `finally`.

Keyboard shortcuts use `Cmd` on macOS and `Ctrl` elsewhere: `,` opens Settings, `K` or `?` opens the shortcuts modal, `D` toggles dark mode, `Enter` submits from an input, and `R` retries after an error.

### Stores

`appStore.ts` uses Zustand with `localStorage` persistence:

- Persisted: `gitlabBaseURL`, `lastMRURL`, `darkMode`, and `appearance`.
- Runtime-only: current MR, changes, parsed URL, review, loading, errors, progress, and current view.

`logStore.ts` is runtime-only and caps logs at 500 entries. It owns panel state and level/source filters.

### Settings

`SettingsView.tsx` renders GitLab, proxy, Codex, appearance, and about sections. `CodexSection.tsx` shows App Server/login guidance and prompt-profile controls.

### Browser mock

`src/renderer/main.tsx` initializes `mockElectronAPI` before mounting React. In Electron, preload already provides the API and the mock does nothing. In a browser or Playwright, the mock emulates the bridge and stores configuration in `localStorage`.

Playwright therefore validates browser UI behavior, not real Electron IPC, GitLab, CLI credentials, or native cleanup.

## Shared contracts

`src/shared/types/` contains the contracts consumed across main, preload, renderer, mocks, fixtures, and tests:

- `constants/` — IPC, severity, defaults, progress, and prompt constants.
- `gitlab.ts` — GitLab API models.
- `review.ts` — `CodeReview`, `ReviewComment`, and review results.
- `repository.ts` — `ExpandedContext`, repository progress, and file-change contracts.
- `settings.ts`, `proxy.ts`, `prompt.ts`, `severity.ts`, `progress.ts`, `errors.ts`, and `utility.ts`.
- `index.ts` — public barrel imported through `@shared/types`.

## Review flow

```
1. User enters an MR URL and review options
2. Parse URL and fetch MR metadata
3. Validate state, conflicts, and size
4. Fetch changes
5. Optionally clone and build expanded context
6. Generate the review through Codex App Server
7. Always clean up the temporary checkout
8. Display results and allow refine/post/delete/approve actions
```

`critical` and `warning` comments block approval; `suggestion` and `info` do not.

## Security

- Preserve `contextIsolation: true` and `nodeIntegration: false`.
- Expose only a narrow API through `contextBridge`; never expose raw `ipcRenderer`.
- Treat GitLab tokens and proxy credentials as sensitive.
- `electron-store` with `encryptionKey` is reversible application-level obfuscation, not OS-keychain security.
- Sanitize sensitive data before logging.
- External URLs currently reach `shell.openExternal` without complete scheme/host validation. Treat this as a known boundary-hardening gap; do not describe arbitrary external URLs as validated.
- Temporary checkouts may run controlled Git commands and file reads only; never execute cloned repository scripts.

See [Services](./SERVICES.md), [Runbook](./RUNBOOK.md), and [Contributing](./CONTRIBUTING.md).
