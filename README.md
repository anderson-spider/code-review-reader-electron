# Code Review Reader

[![CI](https://github.com/anderson-spider/code-review-reader-electron/actions/workflows/ci.yml/badge.svg)](https://github.com/anderson-spider/code-review-reader-electron/actions/workflows/ci.yml)
[![Release](https://github.com/anderson-spider/code-review-reader-electron/actions/workflows/release.yml/badge.svg)](https://github.com/anderson-spider/code-review-reader-electron/actions/workflows/release.yml)

Electron desktop application that reads GitLab Merge Requests and generates automated reviews through **Codex App Server**.

## Features

- 📋 **GitLab MR visualization** — metadata, diffs, approval status, and conflicts.
- 🤖 **AI reviews** — local Codex App Server with structured output.
- 🧠 **Parallel specialist analysis** — security, performance, architecture, testing, and best-practices perspectives.
- 🔁 **Comment refinement** — adjust each AI suggestion with natural-language instructions.
- 📦 **Optional expanded context** — clone the repository locally to analyze complete files instead of diffs alone.
- ✅ **Direct GitLab actions** — general or inline comments and MR approval.
- 🎨 **Prompt profiles** — multiple review styles that can be switched per MR.
- 🌐 **Network proxy support** — SOCKS5 and HTTP.
- 🌗 **Dark mode** and keyboard shortcuts.

## Stack

Electron 35 · React 18 · TypeScript 5 · Vite 7 · Zustand · TailwindCSS · Vitest · Playwright

---

## Run locally

Use this flow to run the compiled application without the development server.

### 1. Install `mise`

`mise` manages the required Node.js version and the project commands.

```bash
# macOS
brew install mise

# Linux / WSL
curl https://mise.run | sh

# Other platforms: https://mise.jdx.dev/getting-started.html
```

Enable it in your shell once:

```bash
# zsh
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc

# bash
echo 'eval "$(mise activate bash)"' >> ~/.bashrc
```

Reload the shell or open a new terminal tab.

### 2. Install Codex CLI

```bash
codex login
codex login status
```

### 3. Create a GitLab token

Create a Personal Access Token with the `api` scope under GitLab **Settings > Access Tokens**. Store it safely; the application asks for it in Settings.

### 4. Clone and run the application

```bash
git clone <repo-url>
cd code-review-reader-electron
mise install            # installs the Node 24.16.0 version pinned in .mise.toml
mise run start          # builds main + renderer and opens Electron
```

`mise run start` compiles the main and renderer processes and opens Electron without Vite or DevTools.

> With `mise activate` enabled, entering the project automatically installs missing tools and runs `npm install` when `package-lock.json` is newer than the installed dependencies. See the [runbook](./docs/RUNBOOK.md#automatic-bootstrap-when-entering-the-directory).

### 5. Configure the application

1. Open **Settings** (`Cmd/Ctrl+,`).
2. Under **GitLab**, enter the API base URL and token.
3. Under **Codex**, review the App Server guidance and configure prompt profiles.
4. Configure **Proxy** when required by the network.
5. Return to the main screen, enter an MR URL, and select **Review**.

---

## Development

### Initial setup

```bash
mise run setup          # remove dist → npm install → build:main → mise run dev
```

The setup task completes onboarding and starts the development server.

### Daily commands

| Command | Purpose |
|---------|---------|
| `mise run dev` | Vite + Electron with hot reload. |
| `mise run debug` | Development mode with the main-process inspector on port 9229. |
| `mise run test` | Vitest watch mode. |
| `mise run lint` | ESLint with `--fix`; modifies files. |
| `mise run build` | Full build and electron-builder packaging. |
| `mise run ci` | Sequential local quality, test, build, and E2E pipeline. |

See the [runbook](./docs/RUNBOOK.md) for the complete command reference.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+,` | Open Settings. |
| `Cmd/Ctrl+K` or `Cmd/Ctrl+?` | Open the keyboard-shortcuts modal. |
| `Cmd/Ctrl+D` | Toggle dark mode. |
| `Cmd/Ctrl+Enter` | Start a review while the URL input is focused. |
| `Cmd/Ctrl+R` | Retry after an error when the URL input is not focused. |

### Project structure

```
src/
├── main/                       # Electron main process, preload, IPC, and services
├── renderer/                   # React application
├── shared/types/               # Main/renderer contracts and constants
├── test/                       # Vitest setup and shared fixtures
└── tools/mcp-gitlab-commenter/ # Standalone GitLab commenter MCP server
docs/                           # Technical documentation
e2e/                            # Playwright browser scenarios
```

See [Architecture](./docs/ARCHITECTURE.md) for details.

---

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — layers, IPC, and review flow.
- [Services](./docs/SERVICES.md) — main-process service reference.
- [Runbook](./docs/RUNBOOK.md) — setup, commands, troubleshooting, and release.
- [Contributing](./docs/CONTRIBUTING.md) — conventions, tests, and pull requests.
- [Agent guidance](./AGENTS.md) — repository-level instructions with scoped child files.

## Security

- `contextIsolation: true` and `nodeIntegration: false`.
- The preload exposes a narrow `contextBridge` API; raw `ipcRenderer` is never exposed.
- The GitLab token is stored through `electron-store` with an `encryptionKey`. This is reversible obfuscation, not OS-keychain protection.
- In-app navigation is restricted; external links are delegated to the user's browser.
- Temporary repository analysis permits controlled Git and file operations only. It never executes cloned project scripts.

## Distribution

`electron-builder` packages:

- **macOS** — `.dmg` and `.zip` for x64 and arm64, with hardened runtime.
- **Windows** — NSIS installer and portable x64 build.
- **Linux** — `AppImage` and `.deb` for x64.

```bash
mise run build      # writes installers to release/
```

## License

MIT.

## Author

Anderson Spider.
