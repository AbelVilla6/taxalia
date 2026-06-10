# Apply Progress: render-blog-articles-from-backend

## Scope
PR 1 backend contract slice only: backend schema/model, Markdown/TOC/SEO API contract, repository/routes/admin backend wiring, and backend tests/verification.

## Completed
- [x] 1.1 Backend content schema/db now include `translationGroupId`, SEO fields, TOC storage, and `translation_groups` backfill.
- [x] 1.2 Markdown rendering now emits heading IDs plus TOC entries while preserving sanitized HTML.
- [x] 1.3 Added unit coverage for Markdown rendering and DB migration helpers.
- [x] 2.1 Public content repository/routes now filter unpublished groups and return alternates, SEO, TOC, and JSON-LD-ready payloads.
- [x] 2.2 Admin routes and backend admin UI now require translation-group linkage and synchronize publish state at the group level.
- [x] 2.3 Integration coverage now verifies language scoping, SEO payloads, alternates, TOC, and group publish behavior.
- [x] 4.1 Backend verification completed with `npm --prefix backend test` and `npm --prefix backend run typecheck`.

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
- PR 2 frontend SSR rendering slice.
- `4.2` root build / SSR smoke checks are intentionally deferred to the frontend slice.

## Notes
- `FRONTEND_SITE_URL` now feeds canonical/alternate URL generation for the backend article payload.
- Group publish state is synchronized through the backend write paths; public reads hide unpublished groups.
