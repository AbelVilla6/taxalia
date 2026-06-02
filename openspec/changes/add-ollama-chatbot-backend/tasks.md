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

- [ ] 1.1 Remove stray `src/{components,layouts,pages,assets` (`find -maxdepth 1 -name '{*' -exec rm -rf {} +`).
- [ ] 1.2 Rename root `package.json#name` `lb-co-global-advisors` → `taxalia` (brand copy deferred).
- [ ] 1.3 Add `scripts/setup.mjs` (ollama check, `ollama pull gemma4:e4b`, `npm ci` in `backend/`) + `setup.sh` + `npm run setup`.
- [ ] 1.4 Extend `.gitignore` with `backend/{dist,node_modules,coverage,.env}`; add `docs/adr/0001-backend-sibling-shape.md` pinning sibling shape + Vite path for `src/scripts/chat-client.ts`.
- [ ] 1.5 Verify: `grep -r lb-co-global-advisors src/ backend/ package.json` → 0; second `npm run setup` exits 0.

## Phase 2 (PR2): Backend skeleton + Vitest + SSE

- [ ] 2.1 `backend/package.json` `name:"@taxalia/chatbot-backend"`, scripts `dev`/`start`/`test`, Node ≥25; `tsconfig.json` extends `../../tsconfig.json` (strict).
- [ ] 2.2 **Wire Vitest + `npm test`** in `backend/package.json` (FIRST backend task; flips `strict_tdd` on); `vitest.config.ts` with `test.unit` / `test.integration` projects.
- [ ] 2.3 Install `hono`, `zod`, `pino`, `ollama`, `vitest`, `@types/node` in `backend/`.
- [ ] 2.4 `backend/src/config.ts` Zod env: `OLLAMA_HOST`, `PORT`, `OLLAMA_AGENT_TIMEOUT_MS`, `CORS_ALLOWED_ORIGINS`, `LOG_LEVEL`, `DISPATCH_CONCURRENCY_CAP`.
- [ ] 2.5 `backend/src/observability/{logger,requestId,metrics}.ts`: Pino, X-Request-Id middleware, counters + `GET /metrics` JSON.
- [ ] 2.6 `backend/src/chat/schemas.ts` Zod: `Lang`, `Message`, `ChatRequest`, `DeltaEvent`, `AgentResult`, `DoneEnvelope`, `ErrorEnvelope`; `sse.ts` `streamSSE` helpers (outer abort = `c.req.raw.signal`).
- [ ] 2.7 `backend/src/chat/routes.ts`: `GET /health` 200 `{"ok":true,"model":"gemma4:e4b"}` <100ms; `POST /chat` 400 on bad lang/empty/bad body, else 501.
- [ ] 2.8 `backend/src/server.ts` Hono entrypoint + CORS allowlist (default `localhost:4321`, `4322`).
- [ ] 2.9 `tests/integration/health.test.ts`: `GET /health` 200 <100ms; mock Ollama never invoked.
- [ ] 2.10 `tests/integration/chat.errors.test.ts`: bad lang → 400 `UNSUPPORTED_LANG`; empty → 400 `EMPTY_MESSAGE`; bad body → 400 `BAD_REQUEST`.

## Phase 3 (PR3): Loaders + systemPrompt (Medium risk)

- [ ] 3.1 `backend/src/{agents,skills,conducta}/loader.ts` Zod schemas (`AgentDefSchema`, `SkillDefSchema`, `ConductDefSchema`).
- [ ] 3.2 Personas `backend/src/agents/{advisory,valuation,financial}.md` (bilingual `system_prompt`).
- [ ] 3.3 Skills `backend/src/skills/{lookup-engagement-model,calculate-valuation,capture-lead}.md`.
- [ ] 3.4 Conducta `backend/src/conducta/{never-pretend,cite-sources,bilingual-response,privacy-no-pii,handoff-to-human}.md` (priority ints).
- [ ] 3.5 `loadAgents`/`loadSkills`/`loadConducta` enforce R4 (count=5 fail), R5 (missing field → file path), R6 (duplicate id → both paths).
- [ ] 3.6 `backend/src/ollama/models.ts`: `MODEL = 'gemma4:e4b'` + `tokenEstimate(text)` (`Math.ceil(len/4)`).
- [ ] 3.7 `backend/src/dispatch/systemPrompt.ts` `assembleSystemPrompt()`: base-identity → conducta sorted asc `\\n\\n---\\n\\n` → agent SP → skill bullets; throws `SystemPromptTooLargeError` >1500 tokens.
- [ ] 3.8 Add `POST /admin/reload` (dev only, atomic swap).
- [ ] 3.9 `tests/unit/loaders.test.ts`: happy + missing field names file + duplicate id + conducta count != 5.
- [ ] 3.10 `tests/unit/systemPrompt.test.ts`: purity 1000× byte-equal + conduct ordering + bilingual headers.
- [ ] 3.11 `tests/unit/tokenEstimate.test.ts`: ≤15% error vs Ollama `promptEvalCount` on 20-sample bilingual.
- [ ] 3.12 `tests/unit/systemPrompt.budget.test.ts`: 1700-token fixture throws `SystemPromptTooLargeError`.
- [ ] 3.13 `tests/integration/reload.test.ts`: malformed file → 500; in-memory unchanged (R7).

## Phase 4 (PR4): Orchestrator + parallel + synth + SSE

- [ ] 4.1 `backend/src/ollama/client.ts` `OllamaClient({host, timeoutMs})` + `checkModel()` (R7: 404 → exit 1 naming `npm run setup`).
- [ ] 4.2 `backend/src/ollama/stream.ts` `chatStream()`: `AsyncIterable<string>`; R8 empty-delta filter; R10 abort closes iterator ≤500ms.
- [ ] 4.3 `backend/src/dispatch/orchestrator.ts` `route()`: meta-prompt + `format:'json'`; 10s; R2 parse-fail → empty + counter; R3 drop unknown ids + WARN.
- [ ] 4.4 `backend/src/dispatch/semaphore.ts` per-process FIFO; default cap 2; env `DISPATCH_CONCURRENCY_CAP` (Q1).
- [ ] 4.5 `backend/src/dispatch/parallel.ts` `runAgents()`: `Promise.allSettled`; per-agent `AbortController` linked to outer; 30s → `{error:{code:'TIMEOUT'}, durationMs:30000}`. **Interface: returns `DispatchResult = AgentResult[]` (consumed by 4.6).**
- [ ] 4.6 `backend/src/dispatch/synthesizer.ts` `synthesize()`: skip if `selected.length<2` OR all errored; streams `AsyncIterable<string>` + final string. **Input: `AgentResult[]` from 4.5 only — boundary isolated from session/streams.**
- [ ] 4.7 `backend/src/dispatch/types.ts`: `OrchestratorDecision`, `AgentResult`, `DispatchResult`, `Lang`.
- [ ] 4.8 Wire `POST /chat`: Zod → cached loaders → `route()` → `runAgents()` → `synthesize()` → `streamSSE` deltas → terminal `done` (agents[] always; warning en/es by orchestrator; requestId).
- [ ] 4.9 Cold-start grace: 60s first request via `coldStart:boolean` (flips false on first success).
- [ ] 4.10 `tests/unit/orchestrator.test.ts` (mock): ≥16/20 parse; parse-fail → empty + counter.
- [ ] 4.11 `tests/unit/parallel.test.ts`: 2 agents, one times out → `[{ok,text},{error:TIMEOUT,durationMs:30000}]`.
- [ ] 4.12 `tests/unit/synthesizer.test.ts`: skipped when `selected.length<2`; skipped when all errored.
- [ ] 4.13 `tests/integration/chat.happy.test.ts`: valid → SSE headers + ≥1 `data:{delta}` + terminal `data:{done,agents,requestId}`.
- [ ] 4.14 `tests/integration/chat.unreachable.test.ts`: Ollama down → 503 `OLLAMA_UNREACHABLE`, no SSE.
- [ ] 4.15 `tests/integration/abort.test.ts`: open, first event, abort → all per-agent `AbortController` fire ≤200ms.
- [ ] 4.16 `tests/integration/cold-start.fixture.test.ts`: first `/chat` first SSE event ≤60s (`concurrent:false`).
- [ ] 4.17 `tests/integration/orchestrator.fixture.test.ts`: live `gemma4:e4b` 20 fixtures; assert ≥16 parseable.

## Phase 5 (PR5): Frontend island replaces ChatWidget

- [ ] 5.1 Extend `src/i18n.ts` `ui[lang].chat` with 8 new keys (`placeholder`, `send`, `sendAria`, `typing`, `error`, `personaName`, `humanHandoff`, `partialWarning`); keep 6; `action` retained for rollback.
- [ ] 5.2 Replace `src/components/ChatWidget.astro`: keep Props, `id="chat-widget"`, `id="chat-close"`, `.chat-*`; static `<a>` → message list + `<form>` input + footer handoff; literal `"Lexi"` → `{copy.personaName}`.
- [ ] 5.3 Create `src/scripts/chat-client.ts` `init({mount, config})`: native `fetch` + `ReadableStream` + `AbortController` + `crypto.randomUUID`; per-turn `X-Request-Id`; SSE delta append; close → abort; 30s safety net; `done.warning` badge.
- [ ] 5.4 Append `.chat-messages` (with `max-height: 60vh; overflow-y: auto`), `.chat-input`, `.chat-msg--user`, `.chat-msg--assistant`, `.chat-typing` to `src/assets/css/lb-co.css`; shell untouched.
- [ ] 5.5 Replace close handler in `src/layouts/Base.astro` (lines 78–83) with bootstrap importing `chat-client.ts`; inject `<script type="application/json" id="chat-config">` with `apiBase` + `lang`.
- [ ] 5.6 Verify: `npm run build` passes; zero new frontend deps; no `astro.config.mjs` change; `<ChatWidget lang>` mounts unchanged at `index.astro` line 29; client logs `requestId` + page-side latency only; Vitest snapshot confirms 5 new CSS classes + `max-height: 60vh`.
