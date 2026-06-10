# Tasks: Render Blog Articles from Backend

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650-800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 backend content contract → PR 2 frontend SSR rendering |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|------|
| 1 | Backend content contract + publish grouping | PR 1 | Keep backend tests with the behavior they verify |
| 2 | Frontend SSR blog rendering + SEO/TOC | PR 2 | Depends on PR 1; keep Astro/CSS/i18n together |

## Phase 1: Backend content model

- [x] 1.1 Add `translationGroupId`, SEO, and TOC fields to `backend/src/content/schema.ts` and `backend/src/content/db.ts`, including `translation_groups` backfill.
- [x] 1.2 Extend `backend/src/content/markdown.ts` to emit heading IDs and TOC entries while preserving sanitized HTML.
- [x] 1.3 Add unit coverage for Markdown/DB migration helpers under `backend/tests/unit/`.

## Phase 2: Backend API and admin wiring

- [x] 2.1 Refactor `backend/src/content/repository.ts` and `backend/src/content/routes.ts` to filter unpublished groups and return alternates, SEO, and TOC.
- [x] 2.2 Update `backend/src/admin/routes.ts` and `backend/src/admin/public/app.js` to require group linkage and save/publish at translation-group level.
- [x] 2.3 Extend `backend/tests/integration/content.test.ts` and `backend/tests/integration/admin.test.ts` for language scoping, alternates, and group publish behavior.

## Phase 3: Frontend SSR rendering

- [x] 3.1 Update `frontend/src/lib/blog.ts`, `frontend/src/components/Blog.astro`, and blog listing pages to consume backend summaries.
- [x] 3.2 Update `frontend/src/pages/blog/[slug].astro`, `frontend/src/pages/es/blog/[slug].astro`, and `frontend/src/layouts/Base.astro` for SEO head overrides and backend article payloads.
- [x] 3.3 Add `frontend/src/components/BlogTableOfContents.astro`, style it in `frontend/src/assets/css/blog-post.css`, and remove stale static blog arrays from `frontend/src/i18n.ts`.

## Phase 4: Verification

- [x] 4.1 Run `npm --prefix backend test` and `npm --prefix backend run typecheck` after backend slices.
- [x] 4.2 Run `npm run build` and smoke-check `/blog`, `/es/blog`, `/blog/[slug]`, and `/es/blog/[slug]` for SSR-only rendering and correct canonical/hreflang tags.
