# Contributing

## Before starting

1. Read [Architecture](./ARCHITECTURE.md) for the main, preload, renderer, and shared boundaries.
2. Read the [Runbook](./RUNBOOK.md) for local setup and validation.
3. Install `mise` and run `mise run setup` once.
4. Read the root `AGENTS.md` and the closest scoped child file before modifying a domain.

## Branches and merges

- Base branch: `main`.
- Feature branches: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, or `docs/<slug>`.
- Do not commit directly to `main`; open a pull request and wait for CI.
- Squash-and-merge is the preferred strategy for a linear history.

## Conventional Commits

Keep the header at 72 characters or fewer:

```
type(scope): description

[optional body]

[optional footer — BREAKING CHANGE:]
```

Accepted types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`, and `ci`.

Semantic-release maps:

- `fix:` → patch
- `feat:` → minor
- `BREAKING CHANGE:` → major

Sign commits with `git commit -S`. If signing fails, repair the signing agent instead of bypassing it.

Examples:

```
feat(settings): add per-profile token limits
fix(gitlab): sanitize CRLF in stored tokens
docs: align architecture with review IPC channels
```

## Code style

### TypeScript

- Target ES2022 with `strict: true`.
- Prefer `unknown` plus type guards over `any`.
- Prefix intentionally unused variables with `_`.
- Put shared contracts in the correct domain file under `src/shared/types/` and import them through `@shared/types`.
- Put cross-process constants under `src/shared/types/constants/`.

### Naming

| Kind | Convention | Example |
|------|------------|---------|
| React component | PascalCase | `CommentCard.tsx` |
| Service or utility | camelCase with `.service.ts` or `.ts` | `gitlab.service.ts`, `token-utils.ts` |
| Interface or type | PascalCase | `MergeRequest`, `CodexAppServerSession` |
| Module constant | UPPER_SNAKE_CASE | `IPC_CHANNELS`, `DEFAULT_PROMPT_CONFIG` |
| IPC channel value | `domain:action` | `review:generateReview` |

### React

- Use functional components.
- Use Zustand for shared application state and local hooks for component state.
- Do not introduce a new context when an existing store or explicit props already model the state.
- Renderer code must access privileged behavior through `window.electronAPI`, never by importing `src/main`.

### Styling

- Use TailwindCSS and the existing primitives under `components/ui/`.
- Merge classes through `cn()` from `src/lib/utils.ts`.
- Preserve dark mode, focus states, responsive breakpoints, and narrow-viewport behavior.
- Extend the existing design vocabulary before adding custom CSS.

## Tests

The project uses Vitest + Testing Library for unit/component tests and Playwright for browser E2E scenarios.

### Placement

- Colocate tests under `__tests__/` beside the implementation.
- Name files `<module>.test.ts` or `<module>.test.tsx`.
- Put reusable data under `src/test/fixtures/`.
- Keep global JSDOM and `window.electronAPI` test wiring in `src/test/setup.ts`.
- Keep browser/E2E bridge behavior in `src/renderer/mockElectronAPI.ts`.

### Test style

```ts
describe('ModuleName', () => {
  it('should produce the expected behavior when the condition occurs', () => {
    // arrange
    // act
    // assert
  });
});
```

- **Bug fix:** add a regression test that fails before the fix.
- **Feature:** cover the happy path and each critical edge case.
- **Behavior-preserving refactor:** run the existing suite; add tests when the refactor exposes an unprotected invariant.
- The documented service/store coverage target is 80%+, but `vitest.config.ts` does not currently enforce a numeric threshold.
- The real Codex smoke test is opt-in through `CODEX_LIVE_TEST=1`.

## Before opening a pull request

```bash
npm run typecheck
npm test -- --run
npm run build:main
npm run build:renderer
npm run build:mcp
```

`mise run ci` adds auto-fixing lint, coverage, Playwright installation, E2E, and dist verification. Because lint runs with `--fix`, inspect the working tree afterward.

The local pipeline and GitHub Actions cover the same broad quality surfaces but have different execution structures. A local pass does not guarantee an identical CI environment.

Known baseline at `ff9437c`: the complete Vitest run has one pre-existing RepositoryService cleanup assertion failure; do not attribute it to unrelated documentation or review-runtime changes.

## Pull request description

```markdown
## Summary
<what changed in one to three lines>

## Why
<bug, feature request, or technical-debt motivation>

## How to test
- [ ] Step 1
- [ ] Step 2

## Type
- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] docs
- [ ] chore
```

Always include manual verification steps, even when automated tests cover the behavior.

## Internal review priorities

1. **Security** — token leakage, IPC validation, external navigation, and cloned-repository execution.
2. **Architecture** — main/preload/renderer/shared boundaries and Codex review routing.
3. **Types** — no loose `any`; shared contracts remain under `@shared/types`.
4. **Tests** — bug fixes include regression coverage.
5. **Performance** — avoid unnecessary renderer work and broad Zustand subscriptions.

Do not spend review comments on formatter output, trivial naming, compliments, or low-impact stylistic preferences.

## Do not

- Commit `dist/`, `release/`, `node_modules/`, `.original.md`, tokens, or application `config.json`.
- Perform unrelated drive-by refactors inside a focused change.
- Bypass hooks with `--no-verify`.
- Force-push shared branches.
- Expose raw `ipcRenderer`, weaken Electron isolation, or execute scripts from temporary checkouts.

## Where to look

- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Main services: [SERVICES.md](./SERVICES.md)
- Setup and operations: [RUNBOOK.md](./RUNBOOK.md)
- Agent instructions: root and scoped `AGENTS.md` files
