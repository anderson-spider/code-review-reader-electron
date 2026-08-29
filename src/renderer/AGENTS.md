# RENDERER

## OVERVIEW

- React 18 UI for GitLab MR review; privileged work crosses `window.electronAPI` only.
- Keep shared contracts in `src/shared/types/`; keep main-process imports out of renderer code.
- Component-specific guidance lives in `src/renderer/components/AGENTS.md`.

## ENTRYPOINT AND RUNTIME BOUNDARY

- `main.tsx` imports styles, calls `initMockElectronAPI()`, then mounts `<App />` in `StrictMode`.
- In browser/Vite, the mock fills `window.electronAPI` when preload is absent; its persistence is browser `localStorage`.
- In Electron, `src/main/preload.ts` owns the typed context-bridge surface; never expose or consume raw `ipcRenderer`.
- Any API addition or signature change requires synchronized shared types, preload, `electron.d.ts`, mock, and tests.

## `App.tsx` WORKFLOW

- On mount, check `config.hasToken()`; initialize GitLab with the persisted base URL only when configured.
- Submit flow: clear prior review/error/log state → parse URL → fetch MR → validate state/conflicts/size → fetch changes → always attempt fail-open checkout/context → generate review.
- Large MRs pause in the confirmation state; cancellation must stop loading and discard the pending MR.
- Always clear loading/progress state on success and failure; local checkout cleanup belongs in `finally` whenever a temp path exists.
- Subscribe to review progress, repository progress, and log events through APIs returning cleanup functions; return every cleanup from its effect.
- Remove window/media-query listeners on unmount; preserve keyboard shortcuts (`Cmd/Ctrl+D`, `K`/`?`, `,`, `Enter`, `R`).

## SETTINGS AND CODEX

- `SettingsView` owns category navigation, Escape-to-main, and transient success/error messages; sections communicate through `onMessage`.
- `CodexSection` shows App Server/login guidance and owns prompt-profile configuration.
- Keep settings controls labeled, keyboard reachable, and messages exposed with `role=status`/`alert` plus appropriate `aria-live`.

## STORE STATE

- `appStore` persists only `gitlabBaseURL`, `lastMRURL`, `darkMode`, and `appearance` through Zustand/localStorage.
- `currentView` deliberately resets to `main`; MR, changes, parsed URL, review, loading, progress, and errors are runtime-only.
- `logStore` is runtime-only, caps logs at 500, and owns expansion, height, and filters; do not persist logs or tokens.
- Reset actions must not erase persisted preferences unless the feature explicitly requests a settings reset.

## BROWSER E2E AND UX INVARIANTS

- Playwright targets the Vite browser at `http://localhost:5173`, not a packaged Electron window or real IPC/services.
- E2E can verify mock-backed UI, persistence, errors, keyboard navigation, Codex settings, and narrow layouts; it cannot prove preload, credentials, GitLab, Codex, or native cleanup.
- Use real Electron smoke checks for preload/API wiring and Codex execution; keep browser tests deterministic and mock-safe.
- Preserve semantic headings, labels, roles, focus states, visible async errors, and live save feedback.
- Preserve dark/light styling, titlebar-safe spacing, keyboard shortcuts, and no horizontal overflow at narrow viewports.

## VALIDATION

```bash
npm test -- --run src/renderer
npm run typecheck
npm run build:renderer
npm run test:e2e -- e2e/settings.spec.ts e2e/review-flow.spec.ts
```
