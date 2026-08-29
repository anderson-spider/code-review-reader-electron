# Runbook

Local operation, validation, packaging, and release reference.

## Prerequisites

- **Node.js 24.16.0**, managed through `mise`.
- **npm 10+**.
- **Git**.
- **Codex CLI**: `codex login`.
- **Playwright Chromium** for E2E: `npx playwright install chromium`.

## Initial setup

```bash
mise install           # installs Node 24.16.0
mise run setup         # removes dist → npm install → build:main → dev
```

`mise run setup` completes onboarding and starts development mode. It does not remove `node_modules`.

### Automatic bootstrap when entering the directory

With `mise activate` enabled, the `.mise.toml` enter hook runs:

```toml
[hooks]
enter = """
mise install --quiet
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install
fi
"""
```

Behavior:

- Installs the pinned Node version when missing.
- Runs `npm install` only when `node_modules` is absent or `package-lock.json` is newer than npm's installation marker.
- Runs without prompting. Disable it by not activating `mise` in the shell.

## Environment variables

Defined in `.mise.toml`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `test` | Default environment; `mise run start` overrides it with `production`. |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `0` | Local-network certificate workaround for npm, Vite, and electron-builder. |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | `1` | Defers browser installation until explicitly requested. |
| `FORCE_COLOR` | `1` | Keeps colored command output. |

> `NODE_TLS_REJECT_UNAUTHORIZED=0` disables TLS certificate verification for processes launched through these tasks. Treat it as a local development-network workaround, not a general default.

## Daily commands

### `mise` tasks

| Task | Purpose |
|------|---------|
| `mise run setup` | Remove `dist`, install dependencies, build main, and start development. |
| `mise run dev` | Stop prior port-5173/Electron processes, then run Vite + Electron. |
| `mise run debug` | Development mode with `--inspect=9229` on the main process. |
| `mise run start` | Build main + renderer and open unpackaged production mode. |
| `mise run test` | Vitest watch mode. |
| `mise run lint` | ESLint with `--fix`; modifies source files. |
| `mise run build` | Main + renderer build followed by electron-builder packaging. |
| `mise run ci` | Sequential local analogue of GitHub CI. |

### Local CI pipeline

`mise run ci` is sequential and fail-fast:

| Step | Command | Purpose |
|------|---------|---------|
| `[1/7]` | `typecheck` | `tsc --noEmit`. |
| `[2/7]` | `lint` | ESLint `--fix` over `src/`. |
| `[3/7]` | `test:coverage` | Vitest with V8 text, JSON, HTML, and LCOV reports. |
| `[4/7]` | `build:main` + `build:renderer` | Compile main/shared and bundle renderer. |
| `[5/7]` | `playwright install chromium` | Install Chromium when missing. |
| `[6/7]` | `test:e2e` | Playwright against the Vite browser application. |
| `[7/7]` | verify `dist` | Confirm `dist/main` and `dist/renderer` exist. |

The GitHub workflow uses separate jobs and dependency edges, while `mise run ci` runs an equivalent set of local checks sequentially. Neither path runs electron-builder packaging.

> The first Playwright installation downloads Chromium and chrome-headless-shell. Later runs reuse installed binaries.
>
> For TDD, use `mise run test`; the complete CI task is not a replacement for the edit/test loop.

### npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite renderer only. |
| `npm run dev:electron` | Vite + Electron. |
| `npm run build:main` | Compile main/shared into `dist/main`. |
| `npm run build:renderer` | Bundle renderer into `dist/renderer`. |
| `npm run build:mcp` | Compile the standalone MCP server into `dist/tools`. |
| `npm run typecheck` | TypeScript check without emission. |
| `npm run test` | Vitest watch mode. |
| `npm run test:coverage` | One Vitest run with V8 coverage reports. |
| `npm run test:e2e` | Headless Playwright. |
| `npm run test:e2e:ui` | Interactive Playwright UI. |
| `npm run release:dry` | Semantic-release dry run; does not publish. |

## First application run

1. Open **Settings** with `Cmd/Ctrl+,`.
2. Under **GitLab**, enter the API base URL and a Personal Access Token with the `api` scope.
3. Under **Codex**, review the App Server guidance and configure prompt profiles.
   Optional project memory requires authenticated `supermemory` and `smfs` CLI sessions. Settings only configure their binary paths; the app never stores API keys or authenticates either CLI.
4. Configure SOCKS5 or HTTP proxy settings when required.
5. Return to the main screen and enter an MR URL. Choose a project memory space from the combobox or keep **Sem memória de projeto**. A unique tag matching the repository slug is selected automatically and overrides are saved per canonical project URL.
6. Select **Review**. Local checkout is always attempted under `~/code-review-app/cr-checkout-*` and fails open, while **Include Tests** remains configurable. Each review checkout is removed in `finally`.

## Logs

- **Renderer**: use the LogPanel controls to inspect and filter entries by level and source.
- **Main process**: inspect stdout from the terminal running `mise run dev` or `mise run start`.

Log sources include `app`, `ipc`, `gitlab`, `codex`, `repository`, and `config`.

## Public release gate

Run these checks before pushing a branch or tag to a public remote:

1. Scan every reachable Git ref with redacted output:

   ```bash
   gitleaks git . --log-opts='--all --full-history' --redact=100
   ```

2. Keep a private denylist outside the repository and scan tracked content against it:

   ```bash
   git grep --text --line-number --ignore-case --file=/path/to/private-denylist.txt
   ```

3. Confirm the repository contains only the intended public author identity:

   ```bash
   git log --all --format='%aN <%aE>%n%cN <%cE>' | sort -u
   ```

4. Run `mise run ci` and review `git status`, `git diff --check`, and `git remote -v`.
5. Push the branch without tags first, verify the public repository, and create releases only through the manually dispatched Release workflow.

The Secret Scan workflow repeats the Gitleaks check for pushes and pull requests. Workflow dependencies are pinned to full commit SHAs; update them through a reviewed change.

## Reset application state

These commands permanently remove application configuration, including the GitLab token, proxy, and prompts:

```bash
# macOS
rm -rf ~/Library/Application\ Support/code-review-reader/

# Linux
rm -rf ~/.config/code-review-reader/

# Windows
rmdir /s /q %APPDATA%\code-review-reader
```

Renderer `localStorage` is separate. Clear it from DevTools under **Application > Storage > Clear**.

## Troubleshooting

| Problem | Resolution |
|---------|------------|
| TypeScript build errors | Run `npm run typecheck`; if dependencies are stale, reinstall them before retrying. |
| Wrong Node version | Run `mise install && mise use node@24.16.0`. |
| Playwright browser missing | Run `npx playwright install chromium`. |
| Flaky E2E test | Retry visibly with `npm run test:e2e -- --timeout=60000 --headed`. |
| GitLab 401 | Replace the expired token or grant the `api` scope. |
| GitLab 404 while authenticated | Verify the API base URL and project path. |
| Codex unavailable | Run `codex login status` and a direct CLI smoke command. |
| Proxy 407 or connection refused | Verify host, port, type, and credentials; test the proxy independently. |
| TLS certificate errors during npm commands | Confirm the command is running through the project `mise` environment. |
| Port 5173 occupied | `mise run dev` attempts to stop the existing process before launching Vite. |
| Main-process hot reload does not occur | Restart `mise run dev`; Vite hot reload covers the renderer only. |

The real Codex smoke test is skipped unless `CODEX_LIVE_TEST=1`.

## Release

`.github/workflows/release.yml` runs semantic-release on pushes to `main` or manual dispatch:

1. Analyze Conventional Commits.
2. Determine the next version.
3. Update `package.json` and `CHANGELOG.md`.
4. Create the configured release commit, tag, and GitHub Release metadata.

The workflow does **not** run electron-builder or upload installer artifacts.

### Local dry run

```bash
npm run release:dry
```

This reports the prospective version and release notes without publishing.

Do not bump versions manually; use semantic commits and let semantic-release determine the release.

## Packaging

`mise run build` invokes electron-builder:

- **macOS** — DMG and ZIP for x64/arm64 with hardened runtime and entitlements.
- **Windows** — NSIS and portable x64 builds.
- **Linux** — AppImage and deb x64 builds.

Output is written to `release/`. Packaging is currently a manual/local operation; no checked-in workflow invokes it.

## GitHub CI

```
quality (typecheck + lint)
  ├── test (Vitest coverage)
  └── e2e (Playwright install + main/renderer build + browser E2E)
        └── build (independent main/renderer rebuild and dist verification)
```

The workflow runs on pushes and pull requests targeting `main` or `develop`.

## Quick diagnostics

```bash
npm run typecheck
npx vitest run path/to/file.test.ts
npm run build:main
npm run build:renderer
npm run test:e2e -- --headed
mise run ci
```
