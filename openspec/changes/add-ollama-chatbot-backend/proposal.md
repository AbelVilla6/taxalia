# Proposal: Add Ollama Chatbot Backend (Lexi, multi-agent, gemma4:e4b)

## Intent

Taxalia's existing chat widget (`src/components/ChatWidget.astro`) is a static anchor
that navigates to `/contact`. This change replaces it with a real conversational
surface running a small in-house multi-agent system against a local Ollama
model (`gemma4:e4b`). Agents, skills, and conduct policies live on disk as
YAML-frontmatter Markdown files. A custom dispatcher runs selected agents in
parallel and a synthesizer merges their replies into one SSE stream back to
the browser. The backend is decoupled by an HTTP contract: Hono owns the
chat surface, the widget consumes it via native `fetch` + `ReadableStream`.
No Astro integration, no frontend build change, no npm dependency added to
the existing project.

## What changes

- **New** `backend/` sibling package (Hono, strict TS, Vitest, screaming layout).
- **Replace** `src/components/ChatWidget.astro` — same Props, real message list + input.
- **New** `src/scripts/chat-client.ts` — SSE consumer + DOM bindings.
- **Replace** chat close handler in `src/layouts/Base.astro` (lines 78–83) with a bootstrap that imports `chat-client.ts`.
- **Extend** `src/i18n.ts` `ui[lang].chat` with `placeholder`, `send`, `typing`, `error`, `personaName`, `humanHandoff`. Existing 6 keys stay.
- **Extend** `src/assets/css/lb-co.css` (lines 390–469 region) with `.chat-messages`, `.chat-input`, `.chat-msg--user`, `.chat-msg--assistant`, `.chat-typing`. Existing widget shell styles untouched.
- **Add** `setup.sh` + `scripts/setup.mjs` + root `npm run setup` (idempotent: `ollama --version` check, `ollama pull gemma4:e4b`, `npm ci` in `backend/`).
- **Remove** stray directory `src/{components,layouts,pages,assets` (PR1).
- **Rename** root `package.json#name` from `lb-co-global-advisors` to `taxalia` (PR1; npm-name fix only — brand text in `i18n.ts` is a separate i18n sweep, out of scope here).
- **Extend** root `.gitignore` with `backend/{dist,node_modules,coverage,.env}`.

## What does NOT change

- The Astro static build pipeline — no integrations, no new `astro.config.mjs`.
- The manual i18n strategy (`/es/` subroutes + `src/i18n.ts`); no `@astrojs/i18n`.
- The Lexi persona: avatar `public/assets/images/agent-lexi.webp`, name "Lexi", `chat-lexi*` CSS classes are reused unchanged.
- The frontend `package.json` `dependencies` block — zero new npm packages.
- Brand strings in `src/i18n.ts` ("LB & CO Global Advisors" copy) — separate follow-up.

## Out of scope

- Production auth, multi-tenancy, rate limiting, billing.
- Vector store / RAG, fine-tuning, model swapping UI.
- A UI for editing `agents/*.md` / `skills/*.md` / `conducta/*.md` (filesystem-only for v1).
- Hot-reload of persona/policy files (v1: process restart, plus `POST /admin/reload` for dev).
- Cross-agent tool calls (v1: orchestrator is the only thing that returns `agentsToRun`).
- Site-wide chat mount (home-only for v1; one-line follow-up to extend).
- Frontend test runner (project still has `testing.runner: none`; adding one is its own change).

## Resolved decisions (from sdd-explore open questions)

| # | Question | Decision | Reason |
|---|---|---|---|
| 1 | Monorepo shape | Sibling `backend/`, no npm workspaces | One service; defer workspace tooling until a 2nd backend appears. |
| 2 | `backend/package.json#name` | `@taxalia/chatbot-backend` (scoped) | Brand-aligned, future-proof, distinct from the frontend's future rename. |
| 3 | v1 agents | `advisory`, `valuation`, `financial` — match `src/i18n.ts#services.items` taxonomy | **Deviation** from the orchestrator's `booking/pricing/advisory` placeholder. The services page has no "booking" or "pricing" item. Using the real taxonomy lets personas and `services.items` titles share copy. |
| 4 | v1 conducta | `never-pretend`, `cite-sources`, `bilingual-response`, `privacy-no-pii`, `handoff-to-human` | Five policies; covers the v1 risk surface (hallucination, citation, locale, PII, escalation). |
| 5 | Chat visibility | Home-only (en + es) for v1 | Matches current widget behavior; smaller blast radius. Site-wide is a one-line `Base.astro` change in a follow-up. |
| 6 | Auth | Anonymous + CORS allowlist | Backend runs locally on Ollama; no public exposure. Allowlist: `http://localhost:4321` (Astro dev), `http://localhost:4322` (preview), plus `CORS_ALLOWED_ORIGINS` (csv) for prod. Methods `GET, POST, OPTIONS`. Headers `Content-Type`, `Accept`, `X-Request-Id`. |
| 7 | Setup script | Yes — `setup.sh` + `npm run setup` (delegates to `scripts/setup.mjs` for cross-platform) | Idempotent: checks Ollama, pulls `gemma4:e4b`, runs `npm ci` in `backend/`. `setup.sh` is a thin Unix wrapper; the Node entry handles Windows. |

**Reason for deviation (Q3):** `src/i18n.ts#services.items` lists *Advisory
Services*, *Valuation Support*, *Financial Guidance* with hrefs
`/services/{advisory,valuation,financial}`. The orchestrator's
`booking/pricing/advisory` default was a placeholder pending this read.
Adopting the real taxonomy keeps persona IDs aligned with service hrefs
and makes any new `services.items` entry a candidate agent.

**Tactical deviation (PR sketch):** Vitest lands in PR2, not PR1. PR1 has
no consumer for a test runner; adding it at the root would install a
devDependency nothing imports. PR2 is the first PR with backend code,
and that's where Vitest belongs.

## High-level approach

User types in the chat widget. The widget's client module posts to
`POST /chat` on the Hono backend with `{ messages, lang, sessionId }`. The
backend loads `agents/`, `skills/`, `conducta/` once at boot (and on
`POST /admin/reload` in dev). For each request, an orchestrator call —
a JSON-formatted `gemma4:e4b` invocation with a hard-coded meta-prompt —
returns which agents should respond. Each selected agent streams tokens
via `ollama-js` in parallel; the dispatcher collects the final messages,
hands them to a synthesizer prompt, and streams the synthesizer's reply
back to the browser as Server-Sent Events. The widget appends deltas into
one message bubble per turn. On close, the widget aborts the fetch
controller; Hono's `onAbort()` fires; the per-agent Ollama streams drop.

The screaming layout (`backend/src/{chat,agents,skills,conducta,dispatch,ollama,observability}`)
keeps the product in the directory names. Conducta files are the broadest
policy and anchor the system prompt; agent prompts are narrower; skill
metadata is the narrowest layer; user history is the most specific. The
order matters empirically for prompt-injection defense.

The frontend change is narrow: replace one Astro component, add one
script, extend i18n keys, append CSS rules. The Astro build remains
static; the chat is a client-side island with no integration.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `gemma4:e4b` (4B active) may not reliably produce parseable JSON for agent selection | High | Orchestrator's contract is fixture-tested in PR4 with a mock Ollama client; integration test runs the live model and asserts JSON parses. |
| Parallel agent streams + skills metadata may exceed 4B model context | Medium | Only one-line skill metadata in the system prompt (no full bodies). Full bodies load on v2 tool call. Budget is tracked in sdd-design. |
| Frontend `chat-client.ts` couples to Hono SSE shape mid-stream | Medium | SSE contract is documented in PR2 (skeleton) so the client and the route agree on the wire format from day one. |
| Close-button abort path is easy to get wrong (race on click vs. last SSE frame) | Medium | Hono `onAbort()` + `AbortController`; integration test asserts `#chat-close` aborts an in-flight stream within 200ms. |
| Project name drift surfaces mid-PR (something imports the old npm name) | Low | PR1 includes a repo-wide `grep -r lb-co-global-advisors` after the rename; fail loudly if any remain. |
| `setup.sh` race on a fresh checkout (Ollama not yet installed) | Low | Delegated to `scripts/setup.mjs` (cross-platform Node); prints actionable error if Ollama is missing. |
| `backend/` placement changes opinion mid-implementation (workspaces appear) | Low | PR1 includes a one-paragraph ADR pinning the sibling shape; the migration trigger ("a second backend service appears") is documented. |
| Multi-agent synthesis can drift from the user's intent (over-helpful) | Medium | `cite-sources` and `never-pretend` conduct policies plus partial-with-warning failure mode. |
| Stray `src/{components,...` directory has nested content (`css,assets`) that needs careful removal | Low | Discovery saved to Engram; PR1 uses `find . -maxdepth 1 -name '{*' -exec rm -rf {} +` rather than a literal `rm -rf`. |

## Success criteria

- [ ] First-token latency for a 2-agent dispatch ≤ 8s on a 2024 MacBook M3 with `gemma4:e4b` (cold start excluded; measured after warmup).
- [ ] Full reply (≤ 200 tokens) for a 2-agent dispatch ≤ 30s wall clock.
- [ ] Replacing any `agents/*.md`, `skills/*.md`, or `conducta/*.md` file and hitting `POST /admin/reload` (or restarting) applies the new content with zero code changes.
- [ ] `setup.sh` is idempotent: a second run on a fully-set-up machine exits 0 and does no work.
- [ ] All five conducta policies are loaded into the system prompt of every agent run; the loaded count is asserted in a unit test.
- [ ] The chat widget streams a token-by-token reply; aborting via `#chat-close` cancels the in-flight request within 200ms.
- [ ] The Astro build (`npm run build`) still passes after PR5; no new frontend dependencies; no `astro.config.mjs` changes.
- [ ] `npm test` in `backend/` runs Vitest with at least: 1 loader test, 1 systemPrompt test, 1 orchestrator test, 1 parallel/dispatch test, 1 chat integration test.

## Rollout — chained PRs (5 PRs, each ≤ 400 LOC review budget)

| PR | Title | Scope | Approx LOC |
|---|---|---|---|
| 1 | `chore: project hygiene + setup script` | Remove stray `src/{components,...`; rename root `package.json#name` to `taxalia`; add `setup.sh`, `scripts/setup.mjs`, `npm run setup`; extend `.gitignore`; pin `backend/` sibling shape in an ADR. | ~80 |
| 2 | `feat(backend): Hono skeleton + Vitest + SSE contract` | New `backend/` package; Hono + Zod + Pino + Vitest; `GET /health` + `POST /chat` stub returns 501; `config.ts` Zod env loader; CORS allowlist; SSE wire format documented; first integration test. | ~300 |
| 3 | `feat(backend): loaders + system-prompt assembly` | YAML-frontmatter Markdown loaders for agents/skills/conducta; first 3 personas + 5 conduct policies + 3 skills; `systemPrompt.ts` assembles in the locked order; fixture-driven loader tests. | ~300 |
| 4 | `feat(backend): orchestrator + parallel dispatch + synthesizer` | `ollama-js` client; orchestrator JSON router; parallel runner with 30s per-agent timeout; partial-with-warning failure; synthesizer step; full `POST /chat` SSE stream; chat integration test. | ~350 |
| 5 | `feat(frontend): replace ChatWidget + wire SSE` | Replace `ChatWidget.astro`; add `src/scripts/chat-client.ts`; extend `i18n.ts` chat keys; extend `lb-co.css`; replace close handler in `Base.astro`. | ~250 |

## Rollback

- **Frontend-only (PR5)**: revert the merged PR; the static `/contact` link widget is restored in a single commit. No backend needed.
- **Backend-only (PR2–PR4)**: stop the Hono process; the widget falls back to the static redirect (the old markup is preserved in a feature branch on PR5).
- **Full (PR1–PR5)**: revert PR5 first, then delete `backend/`, restore `package.json#name`, remove `setup.sh`. Estimated revert time: < 30 min.

## Dependencies

- Ollama (installed locally; pulled at setup time).
- `gemma4:e4b` model (~3 GB one-time download).
- Node 25.2.0 (already on host).
- npm 10+ (already on host).
