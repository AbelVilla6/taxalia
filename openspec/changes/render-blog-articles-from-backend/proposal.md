# Proposal: Render Blog Articles from Backend

## Intent
Render backend-managed blog articles through Astro SSR/BFF so article pages remain SEO-friendly, localized, and editorially controlled.

## Scope
### In Scope
- Keep article listing/detail rendering server-side for crawlable HTML.
- Select Spanish or English article records by the active route language.
- Link translated records at creation time through a shared translation group.
- Apply publish/unpublish to the whole translation group.
- Support article table of contents plus SEO metadata and keywords.
- Remove or update stale static blog arrays in `frontend/src/i18n.ts`.

### Out of Scope
- Client-side article fetching for public SEO pages.
- Full CMS/admin UI beyond the article contract needed by this change.

## Capabilities
### New Capabilities
- `blog-article-rendering`: SSR-render backend blog articles with localization, SEO metadata, and publication rules.

### Modified Capabilities
- `blog-api`: Return localized article records, translation group links, group publish state, SEO fields, tags, and table-of-contents-ready content.

## Approach
Keep the existing Astro SSR/BFF fetch flow. Treat each language version as a separate article record (`language: "es" | "en"`) linked by a shared `translationGroupId`. Public pages only render published groups. Article pages emit canonical, alternate/hreflang, Open Graph, Article JSON-LD, meta title/description, tags, focus keyword, secondary keywords, and a generated or backend-provided table of contents.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/lib/blog.ts` | Modified | Update API calls to handle language filtering. |
| `frontend/src/components/Blog.astro` | Modified | Ensure blog index fetches data from the backend. |
| `frontend/src/pages/blog.astro` and `frontend/src/pages/es/blog.astro` | Modified | Fetch English and Spanish blog listings from the backend. |
| `frontend/src/pages/blog/[slug].astro` and `frontend/src/pages/es/blog/[slug].astro` | Modified | Fetch individual article pages from the backend. |
| `frontend/src/i18n.ts` | Removed or Updated | Remove static blog post arrays to avoid confusion. |
| Backend blog API contract | Modified | Add translation group, group publish state, language filtering, and SEO fields. |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stale static data misleading maintainers | Low | Ensure all references to static data are removed. |
| Backend API misconfigured leading to empty states | Medium | Verify backend URL is correctly set in `BACKEND_API_BASE`. |
| Missing translation link breaks hreflang | Medium | Require `translationGroupId` when creating translated records. |
| Unpublished content leaks publicly | High | Filter by group publish state in listing and detail fetches. |

## Rollback Plan
Revert frontend blog fetch/rendering changes and restore the previous static data references if needed. Backend contract additions can remain unused until re-enabled.

## Dependencies
- Ensure backend API is correctly exposed and returns expected data.
- Backend must provide or persist linked translation groups and group-level publication state.

## Success Criteria
- [ ] Frontend successfully fetches blog articles from the backend.
- [ ] Backend API handles language filtering and returns correct data.
- [ ] Spanish and English article versions are linked and expose hreflang alternates.
- [ ] Unpublished translation groups do not appear in public list or detail pages.
- [ ] Article pages include SSR content, table of contents, canonical metadata, keywords, and Article JSON-LD.
- [ ] Static blog post arrays in `frontend/src/i18n.ts` are removed or updated to reflect current state.
