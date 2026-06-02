# Agent Instructions

## Workflow

- Keep `main` as the protected integration branch. Do not implement feature, fix, cleanup, or UX work directly on `main`.
- Start each task in an isolated git worktree with a topic branch. Use the `eunsoogi/` branch prefix unless the user requests another naming scheme.
- Make conventional commits on the topic branch, push the branch, and open a pull request for review/merge.
- Merge completed work through pull requests. Push directly to `origin/main` only for explicit repository-wide process updates that must be visible before parallel work starts.
- When coordinating multiple agents, give each agent its own worktree and branch, and include the task scope in the branch name.
- Keep handoff notes general. Do not hardcode transient commit hashes, process IDs, or local build artifact paths.

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
