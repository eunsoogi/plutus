---
name: git-workflow
description: Use when planning or performing Plutus git work: worktrees, branches, commits, pushes, GitHub issues or PRs, squash merges, main sync, agent coordination, or branch workflow questions.
---

# Git Workflow

Use this skill before Plutus git, branch, commit, push, pull request, merge, or multi-agent coordination work.

## Authority

`AGENTS.md` is the policy source. This skill is a concise execution guide; if it conflicts with `AGENTS.md`, follow `AGENTS.md`.

Use local `git` for checkout, worktree, diff, staging, commit, rebase, and pull operations. Use GitHub and `gh` for issue, pull request, check, and merge state.

## Start Work

1. Start non-trivial tasks in local goal-mode and keep a short plan updated as evidence changes.
2. Identify the issue, PRD, or spec intent before editing feature, UX, cleanup, or bug behavior. Update that source of truth first if scope changes.
3. Keep `main` as protected integration. Do not implement feature, fix, cleanup, or UX work directly on `main`.
4. Create an isolated worktree and topic branch for each task. Use the `eunsoogi/` branch prefix unless the user requests another scheme.
5. Keep each branch to one issue-sized outcome. Split unrelated fixes, broad cleanup, and follow-up hardening into separate issues and PRs.

## Multi-Agent Work

Give each agent a unique worktree, branch, issue or sub-scope, and owned file/module list. Assume other agents may be changing nearby files. Do not revert or overwrite another agent's edits; coordinate first when ownership overlaps.

Worker handoffs should report changed files, verification commands and results, PR URL when opened, blockers, and whether the branch needs a refresh from `main`.

## OMO And Skills

Apply relevant OMO skill guidance before code changes: `omo:programming` for TypeScript or TSX, `omo:debugging` for runtime failures, `omo:frontend-ui-ux` for rendered UI work, and `omo:remove-ai-slops` for cleanup passes. Mention applied OMO guidance in worker handoffs and PR summaries.

## Local Change Discipline

Inspect before editing or committing:

```sh
git status --short
git diff
```

Stage only the intended files. Do not discard user changes unless the user explicitly asks for that exact operation. If unrelated stale work appears, mention it instead of cleaning it up.

## Commits And Pushes

Use Conventional Commit style:

```text
<type>(<scope>): <summary>
```

Project-local skill changes under `.agents/skills/**` change agent behavior, so prefer a non-`docs` type such as `feat`, `fix`, `refactor`, or `chore`.

Push topic branches normally:

```sh
git push origin HEAD
```

Do not force-push unless a maintainer explicitly requests it. If push is rejected, inspect the remote state and integrate required changes with a new commit.

## Verification

Run verification that covers the touched surface before claiming completion, pushing, or opening/updating a PR.

For docs/process/skill-only changes, use focused checks such as:

```sh
git diff --check
test -f .agents/skills/git-workflow/SKILL.md
sed -n '1,20p' .agents/skills/git-workflow/SKILL.md
```

For broader Plutus code changes, use the relevant command set from `package.json`; common gates are:

```sh
pnpm typecheck && pnpm test:unit && pnpm test:e2e:ui
pnpm --filter @plutus/tauri tauri build
```

Build the Tauri app when packaged macOS behavior changes. If verification cannot run, document exactly why and keep the PR draft until the risk is accepted.

## Pull Requests

Open PRs with GitHub or `gh`. Keep PRs draft until local verification has run or the missing verification is documented.

PR bodies should include:

- Linked issue, when one exists.
- Concise behavior summary.
- Changed files or areas.
- Verification commands with results.
- Known follow-ups or `None`.

Do not merge until required checks pass or a human maintainer explicitly accepts residual risk.

## Merge And Sync

Merge completed work through pull requests. Use squash merge by default so `main` receives one reviewable commit per issue-sized outcome.

After a PR is merged, update the main worktree:

```sh
git pull --ff-only origin main
```

Then rebase or recreate dependent topic branches from refreshed `main`, and retire merged branches/worktrees once no dependent work needs them.
