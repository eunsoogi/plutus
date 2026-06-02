# Agent Instructions

## Workflow

- Keep `main` as the protected integration branch. Do not implement feature, fix, cleanup, or UX work directly on `main`.
- Start each task in an isolated git worktree with a topic branch. Use the `eunsoogi/` branch prefix unless the user requests another naming scheme.
- Anchor implementation work to a GitHub issue before editing. If no issue exists for the task, create one with scope, acceptance criteria, and verification notes.
- Make conventional commits on the topic branch, push the branch, and open an issue-linked pull request for review/merge.
- Merge completed work through pull requests. Prefer squash merges so each issue lands as one coherent integration commit. Push directly to `origin/main` only for explicit repository-wide process updates that must be visible before parallel work starts.
- After a PR is merged, refresh the local integration state with `git fetch origin` and `git pull --ff-only origin main` in the main worktree, then rebase or recreate remaining topic branches from the updated `origin/main`.
- When coordinating multiple agents, give each agent its own worktree and branch, and include the task scope in the branch name.
- Keep handoff notes general. Do not hardcode transient commit hashes, process IDs, or local build artifact paths.

## Agent Discipline

- Treat each issue as a bounded goal. Keep a short execution plan, update it as work moves from investigation to implementation to verification, and stop only when the goal is complete or a concrete blocker is recorded.
- Use the relevant OMO guidance before implementation. For TypeScript/TSX work, apply the programming guidance; for runtime failures or confusing test behavior, apply debugging guidance; for cleanup work, apply remove-ai-slops guidance.
- For feature, fix, UX, or cleanup work, write or update focused regression coverage before changing behavior when coverage is weak. Keep tests close to the affected package or workflow.
- Read the current code before editing and preserve local patterns. Do not broaden the task into adjacent modules unless the issue cannot be completed without that dependency; if scope must expand, record why in the PR.
- Keep agent ownership boundaries strict during parallel work. Do not edit files assigned to another active branch unless coordination has happened first.

## Specs and Tests

- For non-trivial behavior changes, keep the PRD/SPEC expectation explicit in the issue or PR: user-visible goal, affected surface, acceptance criteria, and out-of-scope items.
- Prefer focused unit or component tests for logic changes and Playwright coverage for user-facing provider setup flows. Add visual/viewport checks when the change affects Tauri-sized layout.
- Before opening a PR, run the narrowest meaningful verification first, then broader commands when feasible. Include exact failures in the PR if any command is blocked or exposes a pre-existing issue.

## Trading Providers

- Trading provider setup should support Kiwoom plus the CCXT exchange catalog maintained in the domain package.
- Default provider health should be `not_configured`; do not show any venue as connected unless the user configured it.
- Keep major exchange labels localized in Korean locale, and keep Kiwoom visible as a first-class trading provider.

## Credentials

- Provider setup UI must show real credential input fields, not a credential-reference-only form.
- Never persist raw API keys/secrets in local UI state or config after save. Store only secure references such as `secure://plutus/providers/{providerId}/main`.

## UI

- Provider settings layout should avoid body-level scrolling at the default Tauri window size and should use search/select instead of pinned top exchange shortcuts.

## Verification

- Useful verification commands:
  - `pnpm typecheck && pnpm test:unit && pnpm test:e2e:ui`
  - `pnpm --filter @plutus/tauri tauri build`
- If `pnpm add` fails because registry metadata lacks `time`, the repo uses a 14-day minimum release-age policy. Use command-scoped overrides only when necessary and pin the exact dependency version.
