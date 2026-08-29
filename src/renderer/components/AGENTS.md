# COMPONENTS

## SCOPE

React presentation and interaction components for reviews, settings, feedback, dialogs, logs, and visual primitives. Renderer-wide rules live in `../AGENTS.md`; repository rules live in the root file.

## QUICK MAP

| Area | Files | Responsibility |
|------|-------|----------------|
| Review | `ReviewDisplayView.tsx`, `CommentCard.tsx`, `ReviewSummaryModal.tsx` | Display, refine, post, and summarize comments. |
| Input/state | `ReviewOptionsPanel.tsx`, `CommentRefinementInput.tsx` | Review options and refinement instructions. |
| Settings | `settings/`, `../views/SettingsView.tsx` | GitLab, proxy, Codex, appearance, and about surfaces. |
| Feedback | `LoadingView.tsx`, `ErrorView.tsx`, `EmptyState.tsx` | Async, error, and empty states. |
| Visual infrastructure | `ui/`, `LogPanel.tsx`, `KeyboardShortcutsModal.tsx` | Primitives, logs, and shortcuts. |

## `ReviewDisplayView` HOTSPOT

- Initialize selectable comments from severities other than `info`; preserve selection while toggling items and grouping by file path.
- Posting fetches existing comments, excludes unselected/info/duplicate entries, and distinguishes inline from general comments.
- Preserve confirmation before posting, deleting, or approving; summarize success, failure, and skipped counts.
- Refinement calls `window.electronAPI.review.refineComment`, updates `CodeReview` through `onReviewUpdate`, and clears transient state on completion or cancellation.
- Every async action controls loading and shows visible success/error feedback; `console.error` is not user feedback.
- Update `ReviewDisplayView.test.tsx` whenever this flow or its observable IPC calls change.

## RESPONSIVE AND ACCESSIBLE SETTINGS

- `SettingsLayout` stacks vertically on narrow screens and uses `md:flex-row` on wider screens. Preserve `min-w-0`, content scrolling, and horizontal mobile navigation.
- `SettingsSidebar` uses a labeled `nav`, `aria-current="page"`, native buttons, and Lucide icons. Keep category names visible on mobile.
- Prefer native labels, fieldsets, legends, radios, and selects; preserve visible focus and comfortable targets.
- The **Codex** category contains App Server guidance and prompt-profile controls in `CodexSection.tsx`.
- Configuration reads/writes go through `window.electronAPI.config`; report failures through `onMessage` and revert optimistic state when applicable.

## LOCAL PATTERNS

- Components are functional and typed. Keep new units focused and import domain contracts from `@shared/types`.
- Effects that register listeners return their unsubscribe function; clear timers and transient state during unmount.
- Reuse Tailwind spacing, borders, colors, dark mode, hover/focus states, and breakpoints. Prefer existing primitives and `cn()` before custom CSS.
- Reuse the current visual language: navigation uses Lucide, while severity and analysis-source icons come from shared emoji constants.
- Never expose raw `ipcRenderer`, Node APIs, tokens, or authorization headers in JSX.
- Browser/E2E uses `src/renderer/mockElectronAPI.ts`; unit tests use `src/test/setup.ts` and shared fixtures.
- Electron API changes keep preload, TypeScript declaration, browser mock, test setup, and tests synchronized.

## VALIDATION

```bash
npm test -- --run src/renderer/components/__tests__ src/renderer/components/settings/sections/__tests__
npm run typecheck
npm run build:renderer
npm run test:e2e -- e2e/settings.spec.ts e2e/review-flow.spec.ts
```

For visual-only changes, verify keyboard behavior, focus, dark mode, and a narrow viewport. For IPC actions, capture focused unit coverage before expanding validation.
