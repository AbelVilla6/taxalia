# Apply Progress: render-blog-articles-from-backend

## Scope
PR 1 backend contract slice: backend schema/model, Markdown/TOC/SEO API contract, repository/routes/admin backend wiring, and backend tests/verification.
PR 2 frontend SSR rendering slice: blog types aligned to the backend contract, SEO head overrides, hreflang alternates, JSON-LD, and table of contents.

## Completed
- [x] 1.1 Backend content schema/db now include `translationGroupId`, SEO fields, TOC storage, and `translation_groups` backfill.
- [x] 1.2 Markdown rendering now emits heading IDs plus TOC entries while preserving sanitized HTML.
- [x] 1.3 Added unit coverage for Markdown rendering and DB migration helpers.
- [x] 2.1 Public content repository/routes now filter unpublished groups and return alternates, SEO, TOC, and JSON-LD-ready payloads.
- [x] 2.2 Admin routes and backend admin UI now require translation-group linkage and synchronize publish state at the group level.
- [x] 2.3 Integration coverage now verifies language scoping, SEO payloads, alternates, TOC, and group publish behavior.
- [x] 4.1 Backend verification completed with `npm --prefix backend test` and `npm --prefix backend run typecheck`.
- [x] 3.1 `frontend/src/lib/blog.ts` types now match the backend contract (`translationGroupId`, `published`, alternates, SEO, TOC, JSON-LD); listing pages consume backend summaries.
- [x] 3.2 Detail pages and `Base.astro` render per-language canonical, slug-aware hreflang alternates, Open Graph tags, keywords, and Article JSON-LD via a `head` slot; URLs are built from the frontend site origin, not backend-provided absolutes.
- [x] 3.3 Added `BlogTableOfContents.astro` with styles in `blog-post.css`; removed stale static blog arrays from `i18n.ts`.
- [x] 4.2 `npm run build` plus SSR smoke checks on `/blog`, `/es/blog`, and both localized detail routes verified canonical/hreflang/JSON-LD/TOC output and the 404 path.

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `backend/tests/unit/db.test.ts` | Unit | ✅ 2/2 | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| 1.2 | `backend/tests/unit/markdown.test.ts` | Unit | ✅ 2/2 | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| 1.3 | `backend/tests/unit/db.test.ts` | Unit | ✅ 2/2 | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| 2.1 | `backend/tests/integration/content.test.ts` | Integration | ✅ 5/5 | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 2.2 | `backend/tests/integration/admin.test.ts` | Integration | ✅ 6/6 | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| 2.3 | `backend/tests/integration/content.test.ts` / `backend/tests/integration/admin.test.ts` | Integration | ✅ 5/5 + 6/6 | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |

## Verification
- `npm --prefix backend test` ✅
- `npm --prefix backend run typecheck` ✅

## Remaining
- None. Change is ready for verify/archive.

## Notes
- `FRONTEND_SITE_URL` now feeds canonical/alternate URL generation for the backend article payload.
- Group publish state is synchronized through the backend write paths; public reads hide unpublished groups.
