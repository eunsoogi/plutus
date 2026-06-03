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

- Start non-trivial work in local goal-mode: define the concrete objective, keep a short plan, and update that plan as evidence changes.
- For feature, UX, cleanup, or bug work, write or identify the PRD/SPEC/issue intent before editing code. Update that source of truth before implementation when behavior or user-facing scope changes.
- Prefer tests-first development for behavior changes and bug fixes. Add or identify the failing regression coverage, then change implementation; document why existing coverage is sufficient when no new test is added.
- Keep each branch tied to one issue-sized outcome. Split unrelated fixes, broad cleanup, and follow-up hardening into separate issues and PRs.

## Mandatory OMO Orchestration

- Use OMO orchestration for non-trivial Plutus work. The main thread must enter local goal-mode before edits, keep an active plan, and update that plan when evidence changes.
- Split independent work with the active client's thread-creation or task-thread mechanism before implementation begins. Do not serialize separable work in one thread when multiple owned scopes can run safely in parallel.
- Treat the main thread as the coordinator for multi-thread work. It owns decomposition, worktree/branch assignment, evidence review, conflict resolution, and final handoff; implementation should be delegated to worker threads whenever the scope can be isolated.
- Give each task thread a unique worktree, `eunsoogi/` branch, issue or explicit sub-scope, and owned file/module list. Threads must assume nearby files may be changing in other branches.
- Use multi-agent delegation inside the thread plan when it improves coverage, but keep the task-thread boundary as the source of truth for branch, ownership, and PR scope.
- Split pull requests by task thread or issue-sized scope by default. Do not bundle unrelated thread outputs into one PR unless a human maintainer explicitly requests a combined PR.
- Reconcile downstream branches only after upstream process or shared-contract PRs merge and `main` has been refreshed with `git pull --ff-only origin main`.

## Startup Map

Use this map to choose the first files to inspect for a task. Keep startup reads scoped to the issue; open deeper files only when the task touches that area.

| Path                                                | Why it matters                                                                                      | Open when                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `README.md`                                         | Gives the first-pass project story, architecture summary, setup commands, and documentation route.  | At the start of any task when you need project context or handoff language.                            |
| `package.json`                                      | Shows the pnpm/Turbo scripts, Node floor, and verification command names.                           | Before running installs, tests, builds, or workspace-wide commands.                                    |
| `prd/README.md`                                     | Indexes requirement-level product intent and MVP boundaries.                                        | When a task changes user-facing behavior, roadmap scope, agent roles, or risk posture.                 |
| `spec/README.md`                                    | Indexes implementation specs, package boundaries, local-tool surfaces, and completion gates.        | When a task changes architecture, data contracts, runtime flows, local commands, or package ownership. |
| `packages/domain/src` and `packages/data/src`       | Hold canonical domain defaults, provider catalogs, and data contracts.                              | Before changing trading-provider identity, defaults, labels, or persistence-facing shapes.             |
| `packages/ui/src/provider-settings-*.ts*`           | Holds the provider setup experience and related UI copy, ordering, health, credentials, and panels. | For provider settings UX, credential-entry behavior, localization, and layout work.                    |
| `apps/web-preview/src` and `apps/web-preview/tests` | Browser-preview route, local runtime harness, CSS, and Playwright UI coverage used by Codex.        | For rendered UI work, responsive checks, route behavior, and provider settings e2e coverage.           |
| `apps/tauri`                                        | Tauri shell and packaged-app integration surface.                                                   | When browser-preview behavior must also be validated in the macOS app bundle.                          |
| `tests/e2e` and `playwright.config.ts`              | Cross-workspace Playwright setup and projects.                                                      | Before adding, moving, or debugging e2e coverage.                                                      |

## OMO and Skills

- Use the relevant OMO skill guidance before editing code: `omo:programming` for TypeScript or TSX, `omo:debugging` for runtime failures, `omo:frontend-ui-ux` for rendered UI work, and `omo:remove-ai-slops` for cleanup passes.
- Use the project-local `.agents/skills/git-workflow` skill, when present, before Git, branch, worktree, commit, push, pull request, merge, or post-merge sync work.
- When applying OMO guidance, mention the relevant skill in worker handoff notes and final PR summaries, including any verification or review constraints it introduced.
- Keep strict TypeScript behavior and local project patterns. Avoid broad rewrites, public API changes, or dependency additions unless the issue specifically requires them.

## Thread and Multi-Agent Coordination

- Assign each task thread and agent a unique worktree, branch, issue or explicit sub-scope, and owned file/module list. Threads and agents must assume other branches may be changing nearby files.
- For multi-thread efforts, keep each thread tied to its own issue/PR or explicit sub-scope, then have the coordinator reconcile results before downstream branches finalize.
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
