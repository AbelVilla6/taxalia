# Tasks: Add Ollama Chatbot Backend (Lexi, multi-agent, gemma4:e4b)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,280: 80 → 300 → 300 → 350 → 250 |
| 400-line budget risk | Low per PR (Medium for PR3) |
| Chained PRs recommended | Yes (C3 force-chained) |
| Suggested split | PR1→PR2→PR3→PR4→PR5 (stacked-to-main) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

## Phase 1 (PR1): Hygiene + setup

- [x] 1.1 Remove or verify absence of stray `src/{components,layouts,pages,assets` (`find -maxdepth 1 -name '{*' -exec rm -rf {} +`).
- [x] 1.2 Rename root `package.json#name` `lb-co-global-advisors` → `taxalia` (brand copy deferred).
- [x] 1.3 Add `scripts/setup.mjs` (ollama check + `ollama pull gemma4:e4b` + `npm ci` in `backend/`) + `setup.sh` + `npm run setup`.
- [x] 1.4 `.gitignore` adds `backend/{dist,node_modules,coverage,.env}`; add `docs/adr/0001-backend-sibling-shape.md`.
- [x] 1.5 Verify PR1: `npm run setup` exits 0/idempotent; `npm run build` passes; no stale `lb-co-global-advisors` refs in source/package files.

## Phase 2 (PR2): Backend skeleton + Vitest + SSE

- [x] 2.1 `backend/package.json` `name:"@taxalia/chatbot-backend"`, scripts `dev`/`start`/`test`, Node ≥25; `tsconfig.json` extends `../tsconfig.json` (strict).
- [x] 2.2 **Wire Vitest + `npm test`** in `backend/package.json` (FIRST backend task; flips `strict_tdd` on); `vitest.config.ts` with `unit` / `integration` projects.
- [x] 2.3 Install `hono`, `zod`, `pino`, `ollama`, `vitest`, `@types/node` in `backend/`.
- [x] 2.4 `backend/src/config.ts` Zod env: `OLLAMA_HOST`, `PORT`, `OLLAMA_AGENT_TIMEOUT_MS`, `CORS_ALLOWED_ORIGINS`, `LOG_LEVEL`, `DISPATCH_CONCURRENCY_CAP`.
- [x] 2.5 `backend/src/observability/{logger,requestId,metrics}.ts`: Pino, X-Request-Id, counters, `GET /metrics` JSON.
- [x] 2.6 `backend/src/chat/schemas.ts` Zod: `Lang`, `Message`, `ChatRequest`, `DeltaEvent`, `AgentResult`, `DoneEnvelope`, `ErrorEnvelope`; `sse.ts` `streamSSE` helpers (outer abort = `c.req.raw.signal`).
- [x] 2.7 `backend/src/chat/routes.ts`: `GET /health` 200 `{"ok":true,"model":"gemma4:e4b"}` <100ms; `POST /chat` 400 on bad lang/empty/bad body, else 501.
- [x] 2.8 `backend/src/server.ts` Hono + CORS allowlist (`localhost:4321`, `4322`).
- [x] 2.9 `tests/integration/`: `health.test.ts` (200 <100ms; mock Ollama never invoked); `chat.errors.test.ts` (bad lang → `UNSUPPORTED_LANG`; empty → `EMPTY_MESSAGE`; bad body → `BAD_REQUEST`).

## Phase 3 (PR3): Loaders + systemPrompt (Medium risk)

- [x] 3.1 `backend/src/{agents,skills,conducta}/loader.ts` Zod schemas (`AgentDefSchema`, `SkillDefSchema`, `ConductDefSchema`).
- [x] 3.2 Personas `backend/src/agents/{advisory,valuation,financial}.md` (bilingual `system_prompt`).
- [x] 3.3 Skills `backend/src/skills/{lookup-engagement-model,calculate-valuation,capture-lead}.md`.
- [x] 3.4 Conducta `backend/src/conducta/{never-pretend,cite-sources,bilingual-response,privacy-no-pii,handoff-to-human}.md` (priority ints).
- [x] 3.5 `loadAgents`/`loadSkills`/`loadConducta` enforce R4/R5/R6 (count=5, file path, duplicate id).
- [x] 3.6 `backend/src/ollama/models.ts`: `MODEL = 'gemma4:e4b'` + calibrated `tokenEstimate(text)` (`Math.ceil(len/4 + 10)`).
- [x] 3.7 `backend/src/dispatch/systemPrompt.ts` `assembleSystemPrompt()`: base-identity → conducta sorted asc `\n\n---\n\n` → agent SP → skill bullets; throws `SystemPromptTooLargeError` >1500 tokens.
- [x] 3.8 Add `POST /admin/reload` (dev only, atomic swap).
- [x] 3.9 Unit tests: `loaders.test.ts` (happy + missing field names file + duplicate id + count != 5); `systemPrompt.test.ts` (purity 1000× byte-equal + conduct ordering + bilingual headers); `tokenEstimate.test.ts` (≤15% error); `systemPrompt.budget.test.ts` (1700-token throws).
- [x] 3.10 `tests/integration/reload.test.ts`: malformed file → 500; in-memory unchanged (R7).

## Phase 4 (PR4): Orchestrator + parallel + synth + SSE

- [ ] 4.1 `backend/src/ollama/client.ts` `OllamaClient({host, timeoutMs})` + `checkModel()` (R7: 404 → exit 1 naming `npm run setup`).
- [ ] 4.2 `backend/src/ollama/stream.ts` `chatStream()` (R8 empty-delta filter, R10 abort ≤500ms).
- [ ] 4.3 `backend/src/dispatch/orchestrator.ts` `route()` (meta-prompt + `format:'json'`; 10s; R2 parse-fail → empty + counter; R3 drop unknown ids + WARN).
- [ ] 4.4 `backend/src/dispatch/semaphore.ts` FIFO; cap 2; env `DISPATCH_CONCURRENCY_CAP` (Q1).
- [ ] 4.5 `backend/src/dispatch/parallel.ts` `runAgents()` (`Promise.allSettled`; per-agent `AbortController`; 30s → TIMEOUT). **Interface: returns `DispatchResult = AgentResult[]` (consumed by 4.6).**
- [ ] 4.6 `backend/src/dispatch/synthesizer.ts` `synthesize()` (skip if `selected.length<2` OR all errored). **Input: `AgentResult[]` from 4.5 only — boundary isolated from session/streams.**
- [ ] 4.7 `backend/src/dispatch/types.ts`: `OrchestratorDecision`, `AgentResult`, `DispatchResult`, `Lang`.
- [ ] 4.8 Wire `POST /chat`: Zod → loaders → `route()` → `runAgents()` → `synthesize()` → `streamSSE` deltas → terminal `done` (agents[] always; warning en/es; requestId); cold-start 60s.
- [ ] 4.9 Unit tests: `orchestrator.test.ts` (mock: ≥16/20 parse); `parallel.test.ts` (2 agents, one times out); `synthesizer.test.ts` (skipped when `<2` and when all errored).
- [ ] 4.10 Integration tests: `chat.happy.test.ts` (valid → SSE + deltas + `done`); `chat.unreachable.test.ts` (Ollama down → 503 `OLLAMA_UNREACHABLE`); `abort.test.ts` (per-agent controllers fire ≤200ms); `cold-start.fixture.test.ts` (first SSE event ≤60s); `orchestrator.fixture.test.ts` (live `gemma4:e4b` 20 fixtures, ≥16 parseable).

## Phase 5 (PR5): Frontend island replaces ChatWidget

- [ ] 5.1 Extend `src/i18n.ts` `ui[lang].chat` with 8 new keys; keep 6; `action` retained for rollback.
- [ ] 5.2 Replace `src/components/ChatWidget.astro` (keep Props + IDs + `.chat-*`; `<a>` → message list + `<form>` + handoff; literal `"Lexi"` → `{copy.personaName}`).
- [ ] 5.3 Create `src/scripts/chat-client.ts` `init({mount, config})` (native `fetch`/`ReadableStream`/`AbortController`/`crypto.randomUUID`; per-turn `X-Request-Id`; SSE delta append; close → abort; 30s safety net; `done.warning` badge).
- [ ] 5.4 Append `.chat-messages` (with `max-height: 60vh; overflow-y: auto`), `.chat-input`, `.chat-msg--user`, `.chat-msg--assistant`, `.chat-typing` to `src/assets/css/lb-co.css`.
- [ ] 5.5 Replace close handler in `src/layouts/Base.astro` (lines 78–83) with bootstrap importing `chat-client.ts`; inject `<script type="application/json" id="chat-config">` with `apiBase` + `lang`.
- [ ] 5.6 Verify: `npm run build` passes; zero new frontend deps; no `astro.config.mjs` change; `<ChatWidget lang>` mounts unchanged; client logs `requestId` + latency only; Vitest snapshot confirms 5 new CSS classes.
