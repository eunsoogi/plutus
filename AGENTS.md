# Agent Instructions

## Workflow

- Keep `main` as the protected integration branch. Do not implement feature, fix, cleanup, or UX work directly on `main`.
- Start each task in an isolated git worktree with a topic branch. Use the `eunsoogi/` branch prefix unless the user requests another naming scheme.
- Make conventional commits on the topic branch, push the branch, and open a pull request for review/merge. Reference the matching issue in the PR body when one exists.
- Merge completed work through pull requests. Use squash merge by default so `main` keeps one reviewable commit per issue.
- After a PR is merged, update local integration state with `git pull --ff-only origin main` in the main worktree, then rebase or recreate dependent topic branches from the refreshed `main`.
- Push directly to `origin/main` only for explicit repository-wide process updates that must be visible before parallel work starts.
- When coordinating multiple agents, give each agent its own worktree and branch, and include the task scope in the branch name.
- Keep handoff notes general. Do not hardcode transient commit hashes, process IDs, or local build artifact paths.

## Planning and Goals

- Start non-trivial work in goal mode: define the concrete objective, keep a short plan, and update that plan as evidence changes.
- For feature, UX, cleanup, or bug work, write or identify the PRD/SPEC/issue intent before editing code. If the scope is missing, create or update a GitHub issue before implementation.
- Prefer tests-first development for behavior changes and bug fixes. Add a failing regression test or document why existing coverage is already sufficient before changing implementation.
- Keep each branch tied to one issue-sized outcome. Split unrelated fixes, broad cleanup, and follow-up hardening into separate issues and PRs.

## OMO and Skills

- Use the relevant OMO skill guidance before editing code: `omo:programming` for TypeScript or TSX, `omo:debugging` for runtime failures, `omo:frontend-ui-ux` for rendered UI work, and `omo:remove-ai-slops` for cleanup passes.
- When applying OMO guidance, mention the relevant skill in worker handoff notes and final PR summaries, including any verification or review constraints it introduced.
- Keep strict TypeScript behavior and local project patterns. Avoid broad rewrites, public API changes, or dependency additions unless the issue specifically requires them.

## Multi-Agent Coordination

- Assign each agent a unique worktree, branch, issue, and owned file/module list. Agents must assume other branches may be changing nearby files.
- Do not revert or overwrite another agent's edits. If two branches need the same file, coordinate ownership first and prefer serializing the work.
- Workers should report changed files, tests run, PR URL, blockers, and whether they need a refresh from `main`.
- Coordinators should pause downstream PR finalization when repository process rules change, merge the process update first, then have workers refresh from `main`.

## Pull Requests and Review

- PR bodies should include the linked issue, concise behavior summary, changed files or areas, verification commands with results, and known follow-ups.
- Keep PRs as draft until local verification has run or the reason it cannot run is documented.
- Do not merge a PR until required checks are passing or a human maintainer explicitly accepts the residual risk.
- After squash merge, delete or retire the topic branch/worktree once no dependent work needs it.

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
