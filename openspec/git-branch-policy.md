# Git Branch Policy

## Status

Adopted: 2026-06-10.

This policy is the durable OpenSpec export for Taxalia branch management and parallel writer isolation.

## Branch Roles

- `develop` is the primary integration branch and the default pull request target.
- `main` is reserved for deployment.
- Agents must not commit directly to `main`, `master`, or `develop`.
- Every change must happen on a dedicated feature, fix, chore, or docs branch.

## Agent Rules

- Agents may create and push dedicated work branches.
- Pull requests should target `develop` by default.
- A deployment-oriented change targeting `main` requires explicit user instruction.
- Before commit, push, or PR, agents must verify status, diff, and intended branch.

## Parallel Writer Worktrees

- When 2 or more write-capable agents are launched in parallel against the same project or repository, each writer must use a separate Git worktree.
- No parallel writer agents may share the same worktree.
- Each worktree must have its own branch and isolated current working directory.
- The orchestrator must pass each writer the exact worktree path and forbid writes outside that path.
- Read-only reviewers do not require worktrees, but should use fresh context.

## Subproject Push Order

When the root repository records submodule or subproject pointers:

1. Commit and push each subproject branch first.
2. Update the root repository pointers after the subproject commits exist remotely.
3. Commit and push the root/superproject branch last.

This prevents the root branch from pointing at commits that reviewers or CI cannot fetch.

## Enforcement Notes

- `develop` is the default integration base for future work.
- `main` remains deployment-only.
- Worktree isolation is mandatory for parallel write-capable agents on the same repo.
- If worktree creation is unavailable or fails, do not launch parallel writer agents against the same working tree.
