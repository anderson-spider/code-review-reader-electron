# Agent Architecture Guide

This guide is the operational architecture map for coding agents changing the application. It complements [Architecture](./ARCHITECTURE.md), [Services](./SERVICES.md), the root `AGENTS.md`, and the scoped `AGENTS.md` files.

## Authoritative entrypoints

| Concern | Authority | Preserve |
|---|---|---|
| Renderer workflow | `src/renderer/App.tsx` | MR validation, memory selection, always-attempted checkout, progress reset, checkout cleanup in `finally` |
| Privilege bridge | `src/main/preload.ts` | Narrow typed API; never expose raw `ipcRenderer` |
| IPC routing | `src/main/ipc/handlers.ts` | Boundary validation, window-scoped progress, service delegation |
| Shared IPC contract | `src/shared/types/constants/ipc.ts`, `src/shared/types/` | Synchronize all seven IPC surfaces |
| Review orchestration | `src/main/services/codex.service.ts` | One request-scoped client; one memory lookup per review |
| Project memory | `src/main/services/memory-container.service.ts`, `memory-context.provider.ts` | Shell-free discovery/query, explicit `--tag`, bounded fail-open output |
| App Server transport | `src/main/services/codex-app-server.client.ts` | JSONL correlation, temporary cwd, `--disable hooks`, read-only sandbox |
| App Server process | `src/main/services/codex-app-server.process.ts` | `shell: false`, piped stdio, idempotent temp cleanup |
| Local repository context | `src/main/services/repository.service.ts` | Controlled Git only, path containment, token budgets, guarded cleanup |
| Persisted configuration | `src/main/services/config.service.ts` | Validated serialized settings; secrets remain sensitive |

## C4 level 1 — system context

```mermaid
flowchart LR
  reviewer["Reviewer\nUses the desktop app"]
  app["Code Review Reader\nElectron desktop system"]
  gitlab["GitLab\nMR metadata, diffs, comments, approval"]
  codex["Codex CLI / App Server\nStructured code review"]
  sm["Supermemory\nProject memory namespace"]
  repository["Git repository\nSource checkout"]

  reviewer -->|MR URL, settings, review actions| app
  app -->|HTTPS REST| gitlab
  app -->|JSONL over stdio| codex
  app -->|authenticated CLIs: list spaces and grep explicit tag| sm
  app -->|controlled shallow Git clone| repository
  app -->|review results and progress| reviewer
```

Agent reading: the Electron application owns orchestration. Codex never talks directly to GitLab, the checkout, or SMFS. Memory is prefetched by the main process and becomes untrusted prompt data.

## C4 level 2 — containers and processes

```mermaid
flowchart TB
  subgraph desktop["Code Review Reader desktop application"]
    renderer["Renderer process\nReact + Zustand\nUnprivileged UI"]
    preload["Preload bridge\ncontextBridge + typed ElectronAPI"]
    main["Electron main process\nIPC handlers + domain services"]
    config[("electron-store\nconfig.json")]
    checkout[("~/code-review-app/cr-checkout-*\noptional expanded context")]
    appcwd[("Temporary App Server cwd\nrequest scoped")]
  end

  gitlab["GitLab REST API"]
  supermemoryCli["supermemory CLI process"]
  smfs["SMFS CLI process"]
  supermemory["Supermemory API"]
  codex["codex app-server process"]

  renderer -->|window.electronAPI| preload
  preload -->|IPC invoke / events| main
  main -->|read and validated writes| config
  main -->|HTTPS| gitlab
  main -->|controlled Git and file reads| checkout
  main -->|execFile tags list, shell false| supermemoryCli
  supermemoryCli -->|space discovery| supermemory
  main -->|execFile, shell false| smfs
  smfs -->|semantic search only| supermemory
  main -->|spawn, shell false, JSONL stdio| codex
  codex --- appcwd
```

Deployment facts agents must not blur:

- Browser/Playwright uses `mockElectronAPI`; it does not prove real IPC, native cleanup, credentials, SMFS, or Codex.
- `electron-store` encryption is reversible obfuscation, not keychain security.
- The App Server cwd remains in the OS temporary area; repository checkouts use isolated children under `~/code-review-app`.
- The app uses existing CLI sessions; it does not mount, authenticate, store API keys, or write through SMFS.

## C4 level 3 — main-process components

```mermaid
flowchart LR
  handlers["registerIpcHandlers\nPrivileged router"]
  gitlab["GitLabService\nREST and proxy"]
  repo["RepositoryService\nClone and expanded context"]
  config["ConfigService\nTokens, proxy, prompts, MemorySettings"]
  discovery["SupermemoryContainerService\nValidated space discovery"]
  codexService["CodexService\nReview orchestration"]
  memory["SmfsMemoryContextProvider\nProject-scoped retrieval"]
  prompts["codex-review-prompts\nPrompt assembly"]
  contracts["codex-review-contracts\nFilters, schemas, parsing"]
  client["CodexAppServerClient\nProtocol and correlation"]
  process["AppServer process adapter\nSpawn and temp cwd"]
  logger["LoggerService\nSanitized logs and events"]

  handlers --> gitlab
  handlers --> repo
  handlers --> config
  handlers --> discovery
  handlers --> codexService
  codexService --> config
  codexService --> contracts
  codexService --> memory
  codexService --> prompts
  codexService --> client
  client --> process
  memory --> logger
  codexService --> logger
```

Component ownership rules:

- IPC handlers validate payloads where boundary checks exist today; services must still treat every input as untrusted and enforce domain invariants. Do not assume all legacy handlers have structural validation.
- `CodexService` retrieves memory before creating review threads and reuses the snapshot across specialists.
- `SmfsMemoryContextProvider` does not know Electron or renderer state.
- Prompt code labels memory as `PROJECT MEMORY — UNTRUSTED REFERENCE` and escapes Markdown fence backticks.
- Transport code owns lifecycle cleanup; review code closes every client in `finally`.

## Sequence — standard review

```mermaid
sequenceDiagram
  actor User as Reviewer
  participant UI as Renderer App
  participant IPC as Preload + IPC handlers
  participant GL as GitLabService
  participant Repo as RepositoryService
  participant Discover as SupermemoryContainerService
  participant Super as supermemory CLI
  participant CS as CodexService
  participant Cfg as ConfigService
  participant Mem as SmfsMemoryContextProvider
  participant SMFS as smfs CLI
  participant Client as CodexAppServerClient
  participant Server as codex app-server

  UI->>IPC: memory.listContainers()
  IPC->>Discover: list(configured binary)
  Discover->>Super: execFile tags list --json, shell false
  Super-->>Discover: JSON or process failure
  Discover-->>IPC: Validated spaces or fail-open status
  IPC-->>UI: Typed container result
  User->>UI: Enter MR URL and select/accept memory tag
  UI->>IPC: Persist canonical project mapping
  User->>UI: Submit MR URL and options
  UI->>IPC: gitlab.parseURL / fetchMR / fetchChanges
  IPC->>GL: Parse and fetch MR data
  GL-->>UI: MR metadata and diffs
  alt Local checkout succeeds
    UI->>IPC: repository.clone / readContext
    IPC->>Repo: Controlled shallow clone and reads
    Repo-->>UI: ExpandedContext
  else Checkout fails
    Repo--xUI: Sanitized failure
    UI->>UI: Continue without ExpandedContext
  end
  UI->>IPC: review.generateReview(MR, changes, context, selected tag)
  IPC->>CS: generateReview(...)
  CS->>CS: Filter reviewable changes
  CS->>Cfg: getMemorySettings()
  Cfg-->>CS: Binary and project mappings
  CS->>Mem: retrieve(MR, filtered changes, settings)
  alt Enabled canonical project mapping
    Mem->>SMFS: execFile smfs grep --tag, shell false
    alt Valid output within limit
      SMFS-->>Mem: Semantic memory text
      Mem-->>CS: Memory snapshot
    else Missing auth, timeout, error or oversized
      SMFS--xMem: Failure
      Mem-->>CS: null + sanitized warning
    else Empty output
      SMFS-->>Mem: Empty result
      Mem-->>CS: null without warning
    end
  else No enabled mapping
    Mem-->>CS: null
  end
  CS->>Client: create request-scoped client
  Client->>Server: spawn app-server --disable hooks
  Client->>Server: initialize → initialized → thread/start
  CS->>Client: turn/start with strict schema and assembled prompt
  Client->>Server: approval never + read-only sandbox
  Server-->>Client: Structured review result
  Client-->>CS: Correlated turn output
  CS->>CS: Strict parse and source attribution
  CS->>Client: close in finally
  Client->>Server: terminate and remove temporary cwd
  CS-->>IPC: CodeReview
  IPC-->>UI: CodeReview + progress events
  opt Checkout was created
    UI->>IPC: repository.cleanup in finally
    IPC->>Repo: Guarded temp removal
  end
  UI-->>User: Display review and actions
```

## Sequence — parallel specialists

This path is implemented in the preload, IPC handler, and `CodexService`, but the current production `App.tsx` submit flow calls only `generateReview`. Treat parallel review as an available service contract, not as the default UI path.

```mermaid
sequenceDiagram
  participant IPC as IPC handler
  participant CS as CodexService
  participant Mem as MemoryContextProvider
  participant Client as One App Server client
  participant S as codex app-server

  IPC->>CS: generateParallelReview(...)
  CS->>CS: Filter changes and choose specialists
  CS->>Mem: retrieve once
  Mem-->>CS: One shared snapshot or null
  CS->>Client: create once
  Client->>S: initialize once
  par Security specialist
    CS->>Client: thread/start + turn/start(security)
  and Performance specialist
    CS->>Client: thread/start + turn/start(performance)
  and Architecture/testing/other specialists
    CS->>Client: independent thread/start + turn/start
  end
  S-->>Client: Interleaved events correlated by thread and turn
  Client-->>CS: Promise.allSettled results
  CS->>CS: Keep successes and deduplicate comments
  alt At least one specialist succeeded
    CS-->>IPC: Consolidated CodeReview
  else Every specialist failed
    CS--xIPC: All Codex specialists failed
  end
  CS->>Client: close once in finally
```

Never move memory retrieval inside the specialist loop. Never share a client across separate top-level reviews.

## Post-review write actions

```mermaid
flowchart LR
  user["Explicit user action"] --> ui["ReviewDisplayView"]
  ui --> bridge["Typed ElectronAPI"]
  bridge --> ipc["GitLab IPC handlers"]
  ipc --> service["GitLabService"]
  service --> comment["Post general or line comment"]
  service --> delete["Delete the user's comments"]
  service --> approve["Approve MR"]
```

Generating a review does not authorize these GitLab writes. They remain separate, explicit UI actions.

## Sequence — project memory selection

```mermaid
sequenceDiagram
  actor User
  participant UI as Main screen picker
  participant Bridge as preload ElectronAPI
  participant IPC as memory/config IPC handlers
  participant Discovery as SupermemoryContainerService
  participant Config as ConfigService
  participant Store as electron-store

  UI->>Bridge: memory.listContainers()
  Bridge->>IPC: MEMORY_LIST_CONTAINERS
  IPC->>Config: getMemorySettings()
  IPC->>Discovery: list(supermemoryBinaryPath)
  Discovery-->>IPC: ready/status + validated spaces
  IPC-->>Bridge: typed container result
  Bridge-->>UI: typed container result
  User->>UI: Enter MR URL
  UI->>UI: Prefer saved mapping or one unique slug-prefix match
  User->>UI: Accept selection or override
  UI->>Bridge: setMemorySettings(mapping by canonical URL)
  Bridge->>IPC: CONFIG_SET_MEMORY_SETTINGS
  IPC->>Config: setMemorySettings(settings)
  Config->>Config: Trim fields and reject duplicate project URLs
  Config->>Store: Persist serialized settings
  Store-->>Config: Success
  Config-->>IPC: Success
  IPC-->>Bridge: Success
  Bridge-->>UI: Success
```

An IPC settings change must update all seven surfaces: constants, handlers, preload, renderer declaration, browser mock, test setup, and handler/renderer tests.

## Failure model — memory is fail-open, review is schema-strict

```mermaid
stateDiagram-v2
  [*] --> ResolveProject
  ResolveProject --> NoMemory: no enabled canonical mapping
  ResolveProject --> QuerySMFS: mapping found
  QuerySMFS --> NoMemory: missing CLI or spawn failure
  QuerySMFS --> NoMemory: auth, timeout, empty or oversized output
  QuerySMFS --> InjectUntrusted: valid bounded output
  NoMemory --> StartReview
  InjectUntrusted --> StartReview
  StartReview --> ReviewSuccess: schema-valid Codex output
  StartReview --> ReviewFailure: transport failure or invalid structured output
  ReviewSuccess --> Cleanup
  ReviewFailure --> Cleanup
  Cleanup --> [*]
```

The asymmetry is intentional: memory availability must not block a review, while malformed model output must not be accepted as a valid review.

## Trust boundaries and data classification

```mermaid
flowchart LR
  subgraph untrusted["Untrusted inputs"]
    mr["MR title, description and diff"]
    repo["Cloned repository files"]
    memory["Retrieved project memory"]
    model["App Server output"]
  end

  subgraph privileged["Privileged Electron main process"]
    validate["Boundary and path validation"]
    budgets["File, query and token limits"]
    schemas["Strict Zod schemas"]
    logs["Sanitized logging"]
  end

  subgraph isolated["Isolated child processes"]
    smfs["smfs grep\nexplicit tag, shell false"]
    codex["codex app-server\ntemp cwd, hooks disabled, read-only"]
    git["git CLI\ncontrolled commands only"]
  end

  mr --> validate
  repo --> validate
  memory --> budgets
  model --> schemas
  validate --> isolated
  isolated --> logs
```

## Agent change routing

| If changing… | Inspect and update… | Required focused proof |
|---|---|---|
| Review input/output | shared review types, contracts, prompts, service, fixtures, renderer consumers | schema tests + service tests + typecheck |
| IPC method/payload | all seven IPC surfaces | handler tests + renderer tests + main/renderer builds |
| SMFS matching/query | settings types, ConfigService, provider, prompt, services docs | provider/config/service tests; prove fail-open and query count |
| App Server protocol | client, protocol, state, errors, process adapter | ordering, correlation, timeout and cleanup tests |
| Checkout context | RepositoryService, renderer `finally`, repository types | path containment, budget and cleanup tests |
| Settings UI | section/editor, preload API, mock, accessibility tests | labels, save/error feedback and browser mock behavior |

## Separate executable boundary

`src/tools/mcp-gitlab-commenter/` is an independently compiled stdio MCP tool. It is not part of the renderer → preload → main review path and has its own scoped `AGENTS.md`, TypeScript target, posting pipeline, and tests. Do not route desktop review orchestration through it or merge its contracts into the Electron preload API.

## Non-negotiable invariants

- Keep the runtime Codex-only; do not reintroduce Copilot or Claude providers.
- Never expose raw `ipcRenderer` or import main-process implementations into renderer code.
- Never run package managers, hooks, builds, interpreters, or repository scripts from a clone.
- Never pass memory mounts or the repository checkout as the App Server cwd.
- Never let the App Server invoke SMFS directly; memory remains prefetched prompt context.
- Never pass API keys on SMFS command arguments or log queries, memory content, credentials, or raw stderr.
- Keep `--disable hooks`, `approvalPolicy: 'never'`, the read-only sandbox, request-scoped temporary cwd, and `finally` cleanup.
- Keep repository-specific lock behavior outside this application.
