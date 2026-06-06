---
name: git-workflow
description: Plutus Git, GitHub issue, branch, worktree, push, pull request, verification, OMO coordination, and merge workflow. Use when planning or performing Plutus git work, creating issues or PRs, preparing commits, handling push rejection, resolving conflicts, or coordinating task-thread branches in this repository.
---

# Git Workflow

Use this skill before Plutus Git, GitHub issue, branch, worktree, push, pull request, verification, conflict-resolution, merge, task-thread split, or multi-agent coordination work.

## Authority

`AGENTS.md` is the policy source. Product intent should come from the matching GitHub issue, PRD, SPEC, or direct user request. This skill is the executable workflow. If this skill conflicts with `AGENTS.md`, follow `AGENTS.md`.

Use GitHub and `gh` for issue, pull request, review, check, branch-protection, and merge state when connector tools are not already handling that surface.

Use local `git` for local worktree inspection, checkout, worktree creation, diff, staging, committing, rebasing, pulling, and ordinary push when this workflow calls for it.

## Start Work

1. Read `AGENTS.md` and this skill. Read the relevant `prd/`, `spec/`, issue body, or direct user instructions for the touched surface.
2. Create or confirm a GitHub issue before starting implementation. If the user provided an issue, treat that issue as the source of truth.
3. For non-trivial work, start local goal-mode and keep the plan updated as evidence changes.
4. Keep `main` as protected integration. Do not implement feature, fix, cleanup, or UX work directly on `main`.
5. Create a branch only after the issue, PRD, SPEC, or explicit sub-scope exists. Use an isolated worktree and the `eunsoogi/` branch prefix unless the user requests another naming scheme.
6. Use an issue title that summarizes the user-visible problem or needed work. Do not use Conventional Commit prefixes such as `feat(...)` for issue titles.
7. Write a structured issue body in English or Korean to match the existing issue context. Do not create placeholder, one-line, or notes-only issue bodies.
8. Keep the branch scope aligned with the issue. Do not touch files outside the requested scope.

Issue body should include:

- `## Problem`: the user-visible problem, requested workflow change, or defect being tracked.
- `## Scope`: the files, behavior, or workflow areas expected to change.
- `## Acceptance Criteria`: concrete conditions that make the issue done.
- `## Verification`: expected local checks or evidence needed before closing the work.

For defect work, include currently known evidence and unknowns in the relevant sections instead of guessing at root cause.

## Thread-First OMO Work

Start non-trivial Plutus work in local goal-mode. The main thread acts as coordinator: it owns decomposition, worktree and branch assignment, evidence review, conflict resolution, and final handoff.

Give each task thread and agent a unique task-thread worktree, branch, issue or explicit sub-scope, and owned file/module list. Assume other branches may be changing nearby files. Do not revert or overwrite another thread or agent's edits; coordinate first when ownership overlaps.

Use multi-agent delegation when it improves coverage, but keep the task-thread boundary as the source of truth for branch ownership, verification, evidence, and PR scope.

Worker handoffs should report changed files, verification commands and results, PR URL when opened, blockers, and whether the branch needs a refresh from `main`.

Do not commit `.omo/**` evidence, plan, or notepad files by default. Reference evidence paths and results in the PR body unless a maintainer explicitly requests those local artifacts in git.

## OMO And Skills

Apply relevant OMO skill guidance before code changes: `omo:programming` for TypeScript or TSX, `omo:debugging` for runtime failures, `omo:frontend-ui-ux` for rendered UI work, and `omo:remove-ai-slops` for cleanup passes. Mention applied OMO guidance in worker handoffs and PR summaries.

## Local Change Discipline

Inspect before editing or committing:

```sh
git status --short
git diff
```

Use focused staging:

```sh
git add -p
```

Stage only the intended files. Do not discard user changes unless the user explicitly asks for that exact operation. If unrelated stale work appears, mention it instead of cleaning it up.

## Commit Messages

Use Conventional Commit style for commits unless a narrower instruction overrides it:

```text
<type>(<scope>): <summary>
```

Common types:

| Type       | Use for                          |
| ---------- | -------------------------------- |
| `feat`     | User-visible feature or workflow |
| `fix`      | Bug fix                          |
| `docs`     | Documentation only               |
| `refactor` | Behavior-preserving restructure  |
| `test`     | Test additions or updates        |
| `chore`    | Maintenance                      |
| `ci`       | CI or workflow changes           |
| `revert`   | Reverting an earlier change      |

Project-local skill changes under `.agents/skills/**` change agent behavior, so prefer a non-`docs` type such as `feat`, `fix`, `refactor`, or `chore`.

Avoid vague messages such as `update`, `fix`, `WIP`, or `misc`.

If a maintained plan file exists for the issue and the user has not provided an exact commit message, include a final commit footer:

```text
Plan: .omo/plans/<slug>.md
```

## Push Rules

Only use ordinary push for remote branches.

Allowed:

```sh
git push origin HEAD
```

Forbidden:

```sh
git push --force
git push --force-with-lease
```

If push is rejected because the remote branch changed, inspect the remote changes first. Bring required adjustments in with a new commit. Do not rewrite the remote branch history.

## Verification Before Push Or PR

Run verification that covers every touched surface before claiming completion, pushing, or opening/updating a PR.

For docs/process/skill-only changes, use focused checks such as:

```sh
git diff --check
test -f .agents/skills/git-workflow/SKILL.md
sed -n '1,20p' .agents/skills/git-workflow/SKILL.md
```

For `.gitignore` changes, use `git check-ignore` scenarios for both the new ignored paths and nearby paths that must remain visible.

For broader Plutus code changes, use the relevant command set from `package.json`; common gates are:

```sh
pnpm typecheck && pnpm test:unit && pnpm test:e2e:ui
pnpm --filter @plutus/tauri tauri build
```

Build the Tauri app when packaged macOS behavior changes. If verification cannot run, document exactly why and keep the PR draft until the risk is accepted.

## Pull Requests

Open PRs with GitHub or `gh`. Keep PRs draft until local verification has run or the missing verification is documented.

Create or confirm a GitHub issue before opening a pull request. Do not open a pull request until the matching issue exists unless a human maintainer explicitly scopes an issue-free exception in the current thread.

Split PRs by task thread or issue-sized scope by default. Do not bundle unrelated thread outputs into one PR unless a human maintainer explicitly requests a combined PR.

PR title and body must be written clearly in English or Korean to match the issue context. PR titles use Conventional Commit style:

```text
feat(scope): summary
fix(scope): summary
chore(scope): summary
```

PR body must be structured with Markdown headings. Do not create placeholder, one-line, or notes-only PR bodies.

PR body must include:

- `## Summary`: what changed.
- `## Rationale`: why it changed.
- `## Changed Areas`: changed files or areas.
- `## Verification`: verification commands run and results.
- `## Evidence`: local evidence paths and key pass/fail results when ULW or manual QA evidence exists.
- `## Not Run`: any verification that could not be run and why, or `None`.
- `## Follow-ups`: known follow-ups, or `None`.

When a matching issue exists, put the issue closing reference only on the final line:

```text
Fixes #<issue-number>
```

Do not put closing references in the middle of the PR body. If the work is scoped only by a direct user request and no matching issue exists, omit the closing reference instead of inventing an issue number.

## Codex Review Gate

Treat Codex review as a real merge gate when it is expected for the repository or the user explicitly asks for it. Opening a PR is not completion, and merging is not completion if actionable Codex feedback has not been checked and handled.

After opening or updating a PR, inspect Codex review state on the latest head. Do not rely only on GitHub review objects; `chatgpt-codex-connector` can also deliver actual review results as a top-level PR issue comment.

```sh
gh pr view <pr> --json headRefOid,reviews,latestReviews,comments,reviewDecision,statusCheckRollup
gh api repos/<owner>/<repo>/pulls/<pr>/comments --paginate
gh api repos/<owner>/<repo>/issues/<pr>/comments --paginate
```

If the expected automatic Codex review does not appear after a reasonable wait, request it explicitly with a PR comment:

```sh
gh pr comment <pr> --body "@codex review"
```

An `eyes` reaction on the `@codex review` comment means Codex has noticed the request and is processing it. It is not approval and does not mean review is complete.

Codex review completion signals include:

- Inline review comments or review suggestions from `chatgpt-codex-connector`; these are complete review output, but actionable comments block merge until fixed or explicitly accepted by the human maintainer.
- A top-level PR comment from `chatgpt-codex-connector` that contains actual review results, suggestions, or no-issue/no-suggestion wording; this is also Codex review output, even when no GitHub review object appears.
- A Codex comment such as "Didn't find any major issues" or equivalent no-suggestion wording; this means the reviewed head has no major actionable suggestions.
- A Codex thumbs-up/no-suggestion result (`+1` / `thumbs-up` reaction), when no inline suggestions are produced; this is acceptable only after confirming it applies to the latest PR head.

Setup or environment comments, such as "create an environment for this repo", are connector responses but not review content and not review completion. Treat them as an infrastructure blocker unless the human maintainer explicitly accepts proceeding without a full Codex review.

If any new commits are pushed after Codex review, the old review no longer proves the current head. Wait for or request a fresh Codex review before merging.

## Merge Rules

Before merging, inspect the latest Codex review on the PR head.

Do not merge until required checks pass, the expected Codex review has completed, and every actionable Codex review comment is addressed or explicitly accepted by a human maintainer in the current thread.

When Codex review is expected, wait for it before merging. Treat a Codex review with actionable inline comments as blocking. Do not merge while actionable Codex review feedback remains unresolved or unaccepted by a human maintainer. Fix the feedback in the PR branch, push the follow-up commit, and request or wait for a fresh Codex review before merging. Passing means the latest reviewed head has no unresolved actionable Codex feedback; a thumbs-up/no-suggestion Codex result is acceptable.

Use `gh pr merge --squash --delete-branch --auto` only when repository branch rules, required checks, or a merge queue define the requirements that GitHub should wait for. Pair merges with `--match-head-commit <sha>` using the reviewed PR head SHA when possible so a stale or newly-pushed head cannot be merged by accident.

`gh pr merge` does not have a standalone flag that means "Codex review passed." `--auto` only waits for requirements configured in GitHub, and `--admin` bypasses requirements; do not use `--admin` to skip Codex review, required checks, or review-thread cleanup.

Merge completed work through pull requests. Use squash merge by default so `main` receives one reviewable commit per issue-sized outcome.

Do not locally merge feature branches into the protected base branch as a substitute for the PR workflow.

After a PR is merged, update the main worktree:

```sh
git pull --ff-only origin main
```

Then rebase or recreate dependent topic branches from refreshed `main`, and retire merged branches/worktrees once no dependent work needs them.

## Conflict Resolution

Before resolving conflicts, inspect the state:

```sh
git status
git diff
```

Resolve conflict markers carefully. Git marks the current side, separator, and incoming side with lines beginning with repeated `<`, `=`, and `>` characters. Remove those marker lines after choosing the correct content.

Preserve both sides' intended behavior when possible. If the correct resolution depends on domain intent, stop and ask before editing.

After resolving, stage only the resolved files and run the verification relevant to the conflict surface.

## Quick Checklist

- Issue exists or the direct user request defines an explicit issue-sized sub-scope.
- Matching issue exists before PR creation, unless a maintainer explicitly scoped an issue-free exception.
- Branch is not `main`, uses the requested prefix, and lives in the correct worktree.
- Branch scope matches the issue or sub-scope.
- Local `.omo/**` evidence remains uncommitted unless explicitly requested.
- No force push or force-with-lease is used.
- Verification covers touched surfaces, including manual QA evidence when required.
- PR is draft until local verification and reviewer gates are complete.
- PR body has structured sections and ends with exactly one `Fixes #<issue-number>` line only when a matching issue exists.
- Expected Codex review completed on the latest PR head, and no unresolved actionable Codex feedback remains.
- Merge is squash merge through the PR workflow.
