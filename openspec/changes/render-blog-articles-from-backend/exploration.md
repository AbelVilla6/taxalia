## Exploration: render blog articles from backend

### Current State
The frontend already renders blog content by fetching the backend during SSR, not from hardcoded page data. `frontend/src/lib/blog.ts` calls `GET /api/posts?lang=...` and `GET /api/posts/:slug?lang=...` using `BACKEND_API_BASE`, and both `frontend/src/components/Blog.astro` and the blog detail pages await those helpers in `prerender = false` routes.

The backend already exposes a public read-only blog API in `backend/src/content/routes.ts`, backed by SQLite/repository logic in `backend/src/content/repository.ts`. The main gap is that `frontend/src/i18n.ts` still contains stale static blog post arrays that are no longer used by `Blog.astro`, which can confuse maintenance.

### Affected Areas
- `frontend/src/lib/blog.ts` — server-side API client for blog list/detail fetches; likely the main integration point.
- `frontend/src/components/Blog.astro` — renders the blog index section from fetched posts.
- `frontend/src/pages/blog.astro` — renders the English blog listing page via backend fetch.
- `frontend/src/pages/es/blog.astro` — renders the Spanish blog listing page via backend fetch.
- `frontend/src/pages/blog/[slug].astro` and `frontend/src/pages/es/blog/[slug].astro` — render individual article pages from backend fetch.
- `frontend/src/i18n.ts` — still contains unused static blog post entries; may need cleanup to avoid drift.
- `backend/src/content/routes.ts` — current public API contract for list/detail endpoints.
- `backend/tests/integration/content.test.ts` — defines the expected API behavior (language filtering, 404s, invalid language handling).

### Approaches
1. **Keep SSR fetch via Astro BFF** — preserve the current server-side fetch flow and clean up stale static blog copy.
   - Pros: already aligned with the current architecture; SEO-friendly; no client hydration needed; smallest change.
   - Cons: content depends on backend availability at request time; not a browser-side fetch.
   - Effort: Low

2. **Move blog rendering to browser-side fetch** — load posts on the client with loading/error states.
   - Pros: matches a literal “front fetches backend” interpretation; can refresh content without SSR.
   - Cons: more UI state, worse initial SEO/performance, unnecessary complexity for a public blog.
   - Effort: Medium

### Recommendation
Use the existing SSR fetch path and remove/replace any stale static blog data in `frontend/src/i18n.ts`. The codebase already has the backend API and server-only frontend client wired correctly, so the practical work is mainly cleanup and verification unless the user explicitly wants client-side fetching in the browser.

### Risks
- The stale `ui[lang].blog.posts` arrays can mislead future maintainers into thinking blog content is still static.
- `BACKEND_API_BASE` defaults to `http://localhost:4324`; deployment must supply the correct backend origin or the list/detail pages will render empty/not-found states.
- If the backend is unreachable, SSR currently fails soft and renders empty states, which may look like “no posts published” instead of an outage.

### Ready for Proposal
Yes — but the orchestrator should confirm one point first: do they want the existing SSR BFF fetch kept, or do they specifically require browser-side client fetch with loading states?
