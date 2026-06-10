# Design: Render Blog Articles from Backend

## Technical Approach

Keep the existing Astro SSR/BFF flow: `frontend/src/pages/blog*.astro` render on demand, call `frontend/src/lib/blog.ts`, and receive SEO-ready article data from the backend `content` domain. The backend stays inside the existing Screaming Architecture package boundary:

```text
backend/src/content/
├── db.ts
├── markdown.ts
├── repository.ts
├── routes.ts
└── schema.ts
```

`backend/src/server.ts` continues to mount `/api` only; chat loaders under `backend/src/{skills,agents,conducta}` are unchanged.

## Architecture Decisions

### Decision: Preserve SSR/BFF rendering

| Choice | Alternative | Rationale |
|---|---|---|
| Keep Astro detail/list pages server-rendered and fetch backend data during SSR. | Client fetch after hydrate. | Matches current `prerender = false` routes, keeps crawlable HTML, and satisfies the rendering spec without adding browser state. |

### Decision: Separate group publication from per-row language data

| Choice | Alternative | Rationale |
|---|---|---|
| Keep SQLite `translation_key` as the stored identifier, expose it as `translationGroupId` at the API boundary, and add a `translation_groups` table with shared publish state. | Rename the column everywhere or keep only per-row `draft`. | Avoids destructive data churn, fixes the current mismatch between translated slugs and shared visibility, and lets one publish toggle control both locales. |

### Decision: Generate TOC at write time, render SEO at read time

| Choice | Alternative | Rationale |
|---|---|---|
| Extend `markdown.ts` to return sanitized HTML plus heading anchors/TOC, store TOC JSON with the post, and have the public payload include canonical/alternate URLs plus SEO fields. | Parse HTML in Astro on every request. | Follows the existing “render Markdown once on write” pattern in `repository.ts`, keeps reads cheap, and gives the frontend explicit data for head tags and TOC markup. |

## Data Flow

```text
Crawler/Browser
   -> Astro /blog/[slug] or /es/blog/[slug]
   -> frontend/src/lib/blog.ts
   -> GET /api/posts/:slug?lang=en|es
   -> PostRepository + translation_groups + stored TOC/SEO fields
   -> Astro page renders Base + head overrides + TOC + contentHtml
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/config.ts` | Modify | Add `FRONTEND_SITE_URL` for absolute canonical/alternate URLs. |
| `backend/src/content/db.ts` | Modify | Add `translation_groups` plus SEO/TOC columns and startup backfill. |
| `backend/src/content/schema.ts` | Modify | Rename public contract fields to `translationGroupId` and add SEO/TOC payload types. |
| `backend/src/content/markdown.ts` | Modify | Emit heading IDs and TOC entries alongside sanitized HTML. |
| `backend/src/content/repository.ts` | Modify | Filter by group publish state; serialize alternates, SEO data, and TOC. |
| `backend/src/content/routes.ts` | Modify | Return enriched list/detail responses with existing lang validation. |
| `backend/src/admin/routes.ts` | Modify | Treat publish/unpublish as group operations and require group linkage on create/update. |
| `backend/src/admin/public/app.js` | Modify | Send `translationGroupId` + shared publish state from the editor. |
| `backend/tests/integration/content.test.ts` | Modify | Cover group hiding, translated alternates, SEO fields, and TOC payloads. |
| `frontend/src/lib/blog.ts` | Modify | Update DTOs to consume SEO, alternates, and TOC data. |
| `frontend/src/layouts/Base.astro` | Modify | Add override props/`head` slot so article pages can replace default canonical/hreflang tags. |
| `frontend/src/components/BlogTableOfContents.astro` | Create | Render TOC only when the backend supplies entries. |
| `frontend/src/pages/blog/[slug].astro` | Modify | Render English article SEO tags, translated alternates, TOC, and JSON-LD. |
| `frontend/src/pages/es/blog/[slug].astro` | Modify | Same as above for Spanish. |
| `frontend/src/assets/css/blog-post.css` | Modify | Style the TOC block within the existing article layout. |
| `frontend/src/i18n.ts` | Modify | Remove stale static `blog.posts` arrays; keep only copy strings. |

## Interfaces / Contracts

```ts
interface PostDetail {
  slug: string;
  lang: 'en' | 'es';
  translationGroupId: string;
  published: boolean;
  alternates: Partial<Record<'en' | 'es', { slug: string; url: string }>>;
  seo: { metaTitle?: string; metaDescription?: string; canonicalUrl: string; focusKeyword?: string | null; secondaryKeywords: string[]; openGraphImage?: string | null };
  toc: Array<{ id: string; text: string; depth: 2 | 3 | 4 }>;
  contentHtml: string;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Heading-anchor/TOC extraction and SEO URL helpers | Add Vitest unit coverage in `backend/tests/unit/`. |
| Integration | `/api/posts` and `/api/posts/:slug` lang validation, group publish filtering, alternates, SEO fields, and 404 behavior | Extend `backend/tests/integration/content.test.ts`. |
| E2E | SSR article HTML contains metadata/TOC | No runner yet; verify with `npx astro check`, `npm run build`, and manual route smoke tests. |

## Migration / Rollout

Add an idempotent startup migration in `db.ts`: create `translation_groups`, add SEO/TOC columns, backfill group ids from existing `translation_key`, and derive initial group publication conservatively (any draft row => unpublished group). No feature flag required.

## Open Questions

- [ ] None.
