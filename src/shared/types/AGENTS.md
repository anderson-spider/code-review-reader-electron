# SHARED TYPES

## SCOPE

Contracts shared by Electron main, preload, renderer, browser mock, fixtures, and tests.
Keep this file focused on shared-contract rules; repository-wide architecture and security
guidance lives in the root `AGENTS.md` and the docs it names.

## DOMAIN MAP

- API/domain payloads: `gitlab.ts`, `review.ts`, `repository.ts`.
- Configuration/UI contracts: `settings.ts`, `proxy.ts`, `prompt.ts`.
- State and metadata: `progress.ts`, `severity.ts`, `utility.ts`, `errors.ts`.
- Cross-process constants: `constants/` (`ipc.ts`, defaults, prompt, progress, severity).
- `index.ts` is the public barrel. Export public types/constants there and import consumers
  through `@shared/types` (or the established relative equivalent), not implementation paths.

## HIGH-FANOUT CONTRACTS

- `CodeReview` and `ReviewComment` in `review.ts` are high-fanout contracts. They are used
  by Codex services, IPC handlers and preload, renderer state/components,
  browser fixtures, and tests. Preserve field meaning and optionality when changing them;
  update every consumer and shared fixture in the same change.
- Keep review contracts transport-neutral. Do not add Codex App Server process, prompt,
  or transport details to shared review payloads. Implementation contracts stay in `main`.

## CONVENTIONS

- Put a contract in its owning domain file; keep `index.ts` as a re-export barrel, not an
  implementation module.
- Use `import type` for type-only dependencies and `unknown` plus narrowing instead of `any`.
- Keep external/API response shapes distinct from normalized internal models.
- Prefer discriminated unions; shared constants use `as const`; IPC values follow
  `domain:action` naming when a channel is added or corrected.
- Shared code must not import Electron, React, filesystem, network, or service modules.

## IPC CHANGE LEDGER (EXACTLY SEVEN SURFACES)

For any IPC method or payload change, verify all seven surfaces:

1. `src/shared/types/constants/ipc.ts` — canonical constant, when one exists.
2. `src/main/ipc/handlers.ts` — registration, arguments, validation, and result.
3. `src/main/preload.ts` — contextBridge method and invoke channel.
4. `src/renderer/types/electron.d.ts` — renderer-facing declaration.
5. `src/renderer/mockElectronAPI.ts` — browser/mock behavior.
6. `src/test/setup.ts` — shared test API wiring.
7. Handler and renderer tests — regression coverage for the changed contract.

`IPC_CHANNELS` is not exhaustive in the current checkout: several channels remain literal
strings in handlers/preload. In particular, `IPC_CHANNELS.GITLAB_PARSE_URL` is
`gitlab:parseUrl`, while the live handler and preload invoke `gitlab:parseURL`. Treat this
as a known mismatch to resolve deliberately; do not assume the constant alone wires a route,
and do not describe the current map as exhaustive.

## VALIDATION

After shared-contract or IPC changes, run `npm run typecheck`, `npm run build:main`, and
`npm run build:renderer`; run the focused handler/renderer tests and the full `npm test -- --run`
when behavior or fan-out warrants it. A changed contract is complete only when all seven
IPC surfaces are checked and the relevant tests pass.
