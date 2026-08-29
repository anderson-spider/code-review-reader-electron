# MAIN SERVICES

## SCOPE

Node-side domain services for GitLab access, Codex-backed review generation, persisted configuration, temporary repository context, logging, and token budgeting. Keep IPC routing and renderer behavior in their owning directories.

## REVIEW SERVICE

- `codex.service.ts` owns review, parallel review, and comment refinement.
- Prompt profiles come from `ConfigService`; there is no runtime provider selection.

## CODEX APP SERVER

- `codex-app-server.client.ts` owns one request-scoped JSONL/stdio session. Its handshake is ordered: `initialize` response, `initialized` notification, then `thread/start`, then `turn/start`.
- Every thread/turn uses the temporary working directory, `approvalPolicy: 'never'`, and a read-only sandbox. The process must be spawned with `shell: false` and `codex app-server --disable hooks --listen stdio://` so global lifecycle hooks cannot read or persist review data; never execute repository input as a command.
- Parse JSONL envelopes, protocol events, thread/turn results, and review/refinement output with Zod. Output schemas are strict: reject invalid JSON, missing fields, wrong types, and unexpected fields rather than coercing or guessing.
- Correlate responses and turn events by request, thread, and turn IDs. Parallel specialists use distinct thread IDs on one request-scoped client; simultaneous top-level reviews use distinct clients.
- Always close clients in `finally`; cleanup is idempotent and removes the temporary directory even after spawn, protocol, timeout, or turn failure.

## REPOSITORY AND SECRETS

- `repository.service.ts` may run only controlled Git operations in validated temporary checkouts. Keep shallow clones, path-containment checks, file-size/token budgets, and cleanup guards; never run package managers, builds, hooks, or cloned-repository scripts.
- Never log GitLab tokens, Codex credentials, prompt secrets, authorization headers, or full environment dumps. `ConfigService` encryption is reversible obfuscation, so persisted tokens remain sensitive.
- Services throw descriptive, sanitized errors; boundary logging and renderer delivery belong to IPC handlers. Progress callbacks use shared progress contracts.

## TESTING

- Keep service tests under `__tests__/` and reuse `src/test/fixtures/`. Cover Codex review behavior, strict output validation, JSONL ordering/correlation, concurrent requests, timeouts, failure cleanup, repository safety, and configuration defaults.
- The real Codex smoke test is opt-in only: `CODEX_LIVE_TEST=1 npm test -- --run src/main/services/__tests__/codex-live.smoke.test.ts`. It requires an authenticated Codex CLI; do not make normal tests depend on network or credentials.
- For the normal regression check, run `npm test -- --run src/main/services/__tests__`, then `npm run build:main` and `npm run typecheck`.
