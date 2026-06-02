# ADR 0002: Frontend grouped into ./frontend/ subdir

## Status

Accepted

## Date

2026-06-03

## Context

The Astro frontend (package.json, package-lock.json, astro.config.mjs,
tsconfig.json, src/, public/, .env.example, TODO.md) currently lives
directly in the repository root. The chatbot backend already lives in
its own sibling `backend/` directory (ADR 0001).

The root therefore mixes two unrelated concerns:

- Application code of the frontend (Astro project)
- Meta-repo tooling (docs/, openspec/, scripts/, setup.sh, .gitignore)

This violates the rule the team has been applying by hand: "anything
that does not depend directly on one side goes to the root; anything
that depends on one side goes inside that side." Today the root
contains BOTH the frontend's project files AND the meta-repo files,
which makes that rule impossible to follow without a frontend folder.

There is also a real coupling cost: `backend/tsconfig.json` currently
extends `../tsconfig.json`, which forces the backend to depend on a
file that belongs to the frontend. If the frontend is grouped, the
backend's tsconfig must become autonomous — a healthy side-effect of
the move.

## Decision

Group the Astro frontend into a sibling `frontend/` subdirectory,
keeping the multirepo shape decided in ADR 0001 (no npm workspaces,
no shared packages, two autonomous projects inside one meta-repo).

The new shape is:

```
taxalia/                       ← meta-repo (no package.json in root)
├── .git/
├── .gitignore                 ← updated for frontend/ + backend/ paths
├── README.md                  ← meta-readme (points to both sides)
├── docs/adr/                  ← cross-cutting decisions (cross-references 0001)
├── openspec/                  ← product-level SDD
├── scripts/setup.mjs          ← bootstraps both frontend/ and backend/
├── setup.sh
├── frontend/                  ← NEW: Astro project
│   ├── package.json           ← name: "taxalia"
│   ├── package-lock.json
│   ├── astro.config.mjs
│   ├── tsconfig.json          ← extends astro/tsconfigs/strict
│   ├── .env.example
│   ├── public/
│   ├── src/
│   ├── TODO.md                ← frontend-only tasks
│   └── README.md              ← technical detail of the Astro site
└── backend/                   ← intact
    ├── package.json           ← name: "@taxalia/chatbot-backend"
    ├── tsconfig.json          ← NOW autonomous (no longer extends ../)
    ├── src/
    ├── tests/
    └── ...
```

`backend/tsconfig.json` MUST stop extending `../tsconfig.json` and
declare its own `compilerOptions` (strict, target, module, etc.). This
removes a hidden coupling the previous layout had between the two
projects and makes the multirepo shape honest.

`scripts/setup.mjs` MUST run `npm ci` in BOTH `frontend/` and
`backend/`. It stays in the root because it is tooling that depends
on both sides.

## Consequences

- The Astro frontend is a fully self-contained project. `cd frontend
  && npm install && npm run dev` works without any root-level
  assumptions.
- The backend no longer implicitly depends on a frontend file. Its
  tsconfig declares its own strict settings.
- The root is a true meta-repo: it has no `package.json` of its own
  and no application code. It only contains cross-cutting tooling and
  documentation.
- Reviewers reading `git log --follow` see the frontend file history
  preserved; reviewers NOT using `--follow` will see many "new" files
  in this PR. The move is a one-time cost; subsequent PRs are
  diff-only inside the affected subdir.
- ADR 0001 (backend sibling shape) remains valid and is now
  complemented by this one. The "no workspaces" stance is reinforced
  rather than weakened.

## Migration trigger (unchanged from 0001)

Migrate to npm workspaces when EITHER of these becomes true:

- A second backend service appears.
- A shared package is needed by both frontend and backend.

Until then, the multirepo shape (sibling `frontend/` + sibling
`backend/`, no workspaces) is the right call.
