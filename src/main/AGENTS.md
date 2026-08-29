# MAIN PROCESS

Scope: Electron lifecycle, preload bridge, IPC routing, and main-process security.
Keep this file focused on boundaries; root rules cover general project practice.

## Lifecycle and window security

- `src/main/index.ts` owns app startup, `BrowserWindow` creation, loading, and shutdown.
- Register IPC handlers before `app.whenReady()`; keep window creation inside readiness.
- Preserve `nodeIntegration: false`, `contextIsolation: true`, and intentional `sandbox: false`.
- Dev loads the localhost Vite origin; production loads the packaged renderer file.
- `web-contents-created` must reject untrusted navigation; preserve the local allowlist.
- `setWindowOpenHandler` denies new windows and delegates approved external links to `shell.openExternal`.
- macOS `activate` recreates a window only when none exists; clear `mainWindow` on close.
- Never weaken isolation, expose Node globals, or log tokens and authorization headers.

## Preload boundary

- `src/main/preload.ts` is the sole renderer-facing API surface.
- Expose typed, purpose-built methods through `contextBridge`; never expose raw `ipcRenderer`.
- Every invoke method and event subscription needs a matching `ElectronAPI` declaration.
- Event listeners must return cleanup functions and strip the raw event before calling renderer code.
- Renderer code imports `window.electronAPI`; it must not import `src/main` modules.

## IPC routing

- `src/main/ipc/handlers.ts` is the privileged router; handlers delegate domain work to services.
- Review handlers delegate directly to `CodexService`; provider selection is not part of the IPC contract.
- Progress callbacks derive the target window with `BrowserWindow.fromWebContents(event.sender)`.
- Send review/repository progress only to that window; tolerate a missing or closed window.
- Validate handler inputs at the boundary, then let services enforce domain invariants.
- Preserve descriptive errors, sanitized logs, and the existing renderer-facing result contracts.

## IPC contract maintenance

- A channel change updates `src/shared/types/constants/ipc.ts`, handlers, preload, renderer declarations,
  `src/renderer/mockElectronAPI.ts`, and relevant tests together.
- The `IPC_CHANNELS` catalog is currently incomplete: do not treat it as an exhaustive registry.
- Known gaps: `gitlab:parseURL` vs catalog `gitlab:parseUrl`; missing `gitlab:reinit` and `gitlab:fetchFile`.
- Config invoke channels, `app:openExternal`, and several literal repository/GitLab channels are also absent.
- Keychain constants are stale while implementation uses `config:*`; progress channels are event-only.
- Prefer a shared constant over a new literal, and audit both invoke and event directions when adding one.

## Validation and child rules

- Validate external URLs before `shell.openExternal`: allow only intended schemes/hosts; reject opaque or local paths.
- Validate MR URLs, identifiers, paths, text lengths, and repository paths before invoking services.
- `refineComment` is the model: reject malformed comments, empty instructions, and oversized input.
- Changes under `src/main/services/**` also follow `src/main/services/AGENTS.md`.
- Services own network/CLI/filesystem domain behavior; IPC owns boundary validation, logging, and event delivery.
- Repository service rules prohibit arbitrary commands or scripts from cloned repositories.

## Checks

- For IPC changes, run `npm run typecheck`, focused Vitest coverage, and `npm run build:main`.
- Verify preload declarations, handler registration, browser mock behavior, and progress cleanup together.
