# PROJECT KNOWLEDGE BASE

**Generated:** 2026-08-29

## OVERVIEW

Electron desktop app for GitLab MR review. Electron 35, React 18, TypeScript 5, Vite 7, Zustand, TailwindCSS, Vitest/Testing Library, Playwright. Reviews run exclusively through Codex App Server; no Copilot or Claude provider exists in the active tree.

Read `docs/ARCHITECTURE.md`, `docs/AGENT-ARCHITECTURE.md`, `docs/SERVICES.md`, and `docs/RUNBOOK.md` before inferring runtime behavior. `docs/AGENT-ARCHITECTURE.md` is the diagrammed operational map for coding agents.

## STRUCTURE

```
src/
├── main/                         # Electron lifecycle, preload, IPC, Node services
│   ├── ipc/                      # privileged channel registration
│   └── services/                 # GitLab, Codex, config, checkout, logging
├── renderer/                     # React app, views, components, stores, browser mock
├── shared/types/                 # main/renderer contracts and IPC constants
├── test/fixtures/                # reusable Vitest data
└── tools/mcp-gitlab-commenter/   # separate stdio MCP build
e2e/                              # Playwright browser flows
docs/                             # architecture, services, runbook, contribution notes
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Window lifecycle/security | `src/main/index.ts` | preload, navigation policy, dev/prod loading |
| Renderer privilege boundary | `src/main/preload.ts` | typed `contextBridge`; no raw `ipcRenderer` |
| IPC review routing | `src/main/ipc/handlers.ts` | `review:*` delegates directly to `CodexService` |
| Codex integration | `src/main/services/codex.service.ts` | App Server orchestration over JSONL/stdio |
| Agent architecture map | `docs/AGENT-ARCHITECTURE.md` | C4, sequences, trust boundaries, ownership, and change routing |
| App workflow | `src/renderer/App.tsx` | MR validation, checkout context, review cleanup |
| Review UI/actions | `src/renderer/components/ReviewDisplayView.tsx` | refine, post, delete, approve, export |
| Renderer state | `src/renderer/store/appStore.ts` | persisted appearance/URL; runtime review state |
| Cross-process contract | `src/shared/types/` | update all IPC consumers together |
| Browser test boundary | `src/renderer/mockElectronAPI.ts` | E2E/browser substitute for preload |
| Standalone commenter | `src/tools/mcp-gitlab-commenter/` | independent `tsconfig.mcp.json` target |
| Test data | `src/test/fixtures/` | reuse MR, diff, GitLab, and review fixtures |

## CODE MAP

CodeGraph-backed entry/symbol map, checked against the sources at `ff9437c`:

| Symbol | Type | Location | Graph role |
|--------|------|----------|------------|
| `registerIpcHandlers` | function | `src/main/ipc/handlers.ts` | main-process IPC registration root |
| `CodexService` | class | `src/main/services/codex.service.ts` | Codex App Server implementation |
| `CodexAppServerClient` | class | `src/main/services/codex-app-server.client.ts` | JSON-RPC/JSONL transport and turn correlation |
| `ElectronAPI` | interface | `src/main/preload.ts`; `src/renderer/types/electron.d.ts` | typed main/renderer API pair |
| `IPC_CHANNELS` | constant | `src/shared/types/constants/ipc.ts` | shared channel constants; catalog is currently incomplete |
| `App` | function | `src/renderer/App.tsx` | renderer workflow and view switching |
| `useAppStore` | constant | `src/renderer/store/appStore.ts` | persisted settings plus review state |
| `repositoryService` | singleton | `src/main/services/repository.service.ts` | temporary checkout/context lifecycle |

## CONVENTIONS

- Project documentation, code, names, commits, and pull requests are written in English.
- Renderer code reaches privileged behavior only through `window.electronAPI`; imports from `src/main` are forbidden.
- Shared types live in their owning domain file; type-only consumers use `import type`.
- IPC values use `domain:action`; channel changes synchronize constants, handlers, preload, declaration, mock, and tests.
- Unit tests are colocated under `__tests__/`; reusable fixtures live in `src/test/fixtures/`.
- Components are functional/PascalCase; services and utilities use camelCase and established file suffixes.

## ANTI-PATTERNS

- Never expose `ipcRenderer`; preserve `contextIsolation: true`, `nodeIntegration: false`, and intentional `sandbox: false`.
- Never log tokens, passwords, `GITLAB_TOKEN`, `PRIVATE-TOKEN`, `Authorization`, or environment dumps.
- Never execute scripts, hooks, package managers, or builds from cloned repositories; checkout analysis permits controlled Git commands only.
- Do not place shared contracts inside main/renderer implementations or duplicate preload types in the renderer.
- Do not add Copilot or Claude to the active review/config/IPC model; the runtime is Codex-only.
- Do not read or commit `node_modules/`, `dist/`, `out/`, or `release/`; avoid generated artifacts and unrelated refactors.
- `electron-store` with `encryptionKey` is reversible obfuscation, not system-keychain security.

## COMMANDS

```bash
mise run dev                 # Vite + Electron with hot reload
npm run typecheck            # TypeScript check without emission
npm test -- --run            # one Vitest run
npm run build:main           # compile main/shared
npm run build:renderer       # bundle the Vite renderer
npm run build:mcp            # compile the standalone MCP server
npm run test:e2e             # headless Playwright
mise run ci                  # local quality, coverage, builds, E2E, and dist verification
```

## GOTCHAS

- `mise` pins Node `24.16.0`, sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for local proxy compatibility, and auto-installs pending dependencies through its enter hook.
- `mise run lint` and `npm run lint` execute ESLint with `--fix` and modify files.
- Codex requires an installed CLI and authenticated session.
- `CodexService` handles every `review:*` request; progress reaches the renderer through IPC events.
- Browser/E2E uses `mockElectronAPI`; real Electron uses `preload.ts`.
- Main/shared compile to `dist/main`, renderer to `dist/renderer`, and MCP to `dist/tools`.
