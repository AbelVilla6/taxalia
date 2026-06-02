# ADR 0001: Backend sibling shape

## Status

Accepted

## Date

2026-06-02

## Context

Taxalia currently has one Astro website and one planned chatbot backend. The
backend will live as a sibling `backend/` directory instead of introducing npm
workspaces in PR1.

The root package remains responsible for the Astro site. The setup script can
prepare both the root project and the backend project without requiring a
monorepo package graph yet.

## Decision

Keep the root Astro application and the chatbot backend as sibling projects:

- root: Astro frontend and public site assets
- `backend/`: chatbot backend, loaders, dispatch, Ollama integration, and tests

Do not introduce npm workspaces in PR1. The setup script remains the integration
point for preparing the root project and, once present, running `npm ci` inside
`backend/`.

## Consequences

This keeps PR1 small and easy to review while the backend shape is still simple.
It also avoids workspace-level changes before there is more than one backend or
shared package to coordinate.

If Taxalia gains a second backend service, or if frontend and backend need a
shared package, migrate to npm workspaces.

## Migration trigger

Migrate to npm workspaces when either condition is true:

- backend/service count is greater than 1
- a shared package is needed by both frontend and backend
