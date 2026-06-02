# Spec: Chat Endpoint

## Cross-cutting (defined here, referenced from all 6 specs)

The same numbered list is repeated at the top of every spec. Implementation owner is noted in parentheses.

1. `request-id-propagation` — header → route → log → SSE `done`. (chat-endpoint)
2. `error-envelope-uniform` — uniform JSON shape on HTTP + SSE `done`. (chat-endpoint)
3. `locale-required-bilingual` — `lang: 'en'|'es'` validated on input; output lang comes from conducta. (chat-endpoint validates; system-prompt assembles)
4. `cors-allowlist-anon` — anonymous; CORS gates cross-origin. (chat-endpoint)
5. `partial-failure-surfaced` — SSE `done.agents[]` always present. (chat-endpoint shape; dispatch data)
6. `per-agent-30s-timeout` — every parallel Ollama call bounded by 30s. (dispatch policy; chat-endpoint surfaces)
7. `model-pinned-gemma4-e4b` — single model constant; no per-request override in v1. (ollama-integration)
8. `conducta-all-five-loaded` — asserted at boot; missing → exit non-zero. (system-prompt + loaders)
9. `observability-hooks` — request log + counter increment per route. (observability; chat-endpoint calls)
10. `no-cross-agent-calls-v1` — orchestrator is sole decider. (dispatch)

## Purpose

The HTTP surface that the frontend calls. Owns `GET /health`, `POST /chat`, CORS, the SSE wire format, the request-id flow, the error envelope, and the close/abort path. Stateless across requests; no server-side session storage in v1.

## Requirements

| # | Strength | Requirement |
|---|---|---|
| R1 | MUST | `GET /health` returns `200 {"ok":true,"model":"gemma4:e4b"}` in ≤ 100ms without calling Ollama. |
| R2 | MUST | `POST /chat` accepts JSON `{ messages: Message[], lang: 'en'\|'es', sessionId: string }` validated by Zod. |
| R3 | MUST | Reject `POST /chat` with HTTP 400 + error envelope when `lang` is missing or not in `{'en','es'}`. |
| R4 | MUST | Reject `POST /chat` with HTTP 400 + error envelope when the last user message is empty or whitespace-only. |
| R5 | MUST | Respond to `POST /chat` as `Content-Type: text/event-stream`; include `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`. |
| R6 | MUST | Emit one `data: {"delta": string}` event per non-empty token chunk from the synthesizer; skip empty deltas. |
| R7 | MUST | Emit exactly one terminal `data: {"done": true, "agents": AgentResult[], "warning"?: string, "requestId": string}` per request. |
| R8 | MUST | On client `AbortController.abort()`, drop all in-flight Ollama streams and close the response within 200ms. |
| R9 | MUST | On Ollama unreachable (ECONNREFUSED on `:11434` at any point), return 503 with `code: 'OLLAMA_UNREACHABLE'`. |
| R10 | MUST | On boot, if `POST /api/show` for `gemma4:e4b` returns 404, exit non-zero with a message naming `npm run setup`. |
| R11 | MUST | CORS allowlist: defaults `http://localhost:4321`, `http://localhost:4322`; env `CORS_ALLOWED_ORIGINS` (csv) for prod. Methods `GET, POST, OPTIONS`. Headers `Content-Type, Accept, X-Request-Id`. |
| R12 | MUST | Echo incoming `X-Request-Id` in the response header and include it in the SSE `done` event. Generate UUID v4 when absent. |
| R13 | MUST | Uniform error envelope for HTTP errors: `{"error": {"code": string, "message": string, "requestId": string}}`. |
| R14 | SHOULD | Include each agent's duration in ms in the `done.agents[]` entry (`durationMs: number`). |
| R15 | MUST NOT | Reconnect or resume an aborted SSE stream. The client restarts the request from scratch on reconnect (no `Last-Event-ID` resumption in v1). |

### Edge cases (explicit)

- **CORS typo / unknown origin**: no CORS headers, status 403, empty body. Logged `{requestId, origin, action: 'cors-rejected'}`.
- **SSE client reconnect after a network blip**: client restarts with the full message history. The server holds no session state.
- **Backend up, Ollama down at request time**: 503 `OLLAMA_UNREACHABLE`; no SSE opened; no partial frame emitted.
- **First request after `ollama serve` cold start**: 60s budget instead of 30s (one-shot grace, tracked via a per-process `coldStart: boolean`).

## Scenarios

**R1 health**: GIVEN backend is up. WHEN client GETs `/health`. THEN 200 with `{"ok":true,"model":"gemma4:e4b"}` in <100ms; mock Ollama client never invoked.

**R3 bad lang**: GIVEN body `lang: 'fr'`. WHEN POST `/chat`. THEN 400 `{"error":{"code":"UNSUPPORTED_LANG",...}}`.

**R4 empty message**: GIVEN last user message is `""`. WHEN POST `/chat`. THEN 400 `code: 'EMPTY_MESSAGE'`; no synthesizer call.

**R5,R6,R7 happy SSE**: GIVEN valid request. WHEN processed. THEN headers carry `content-type: text/event-stream`; body emits `data: {"delta":"..."}` per chunk; terminates with `data: {"done":true,"agents":[...],"requestId":"..."}`.

**R8 abort mid-stream**: GIVEN an in-flight stream with at least one emitted delta. WHEN client calls `controller.abort()`. THEN Hono `onAbort` fires ≤200ms; parallel Ollama streams drop; no further `data:` events.

**R9 Ollama down**: GIVEN `:11434` refuses connections. WHEN POST `/chat`. THEN 503 `OLLAMA_UNREACHABLE`; no SSE opened.

**R11 CORS unknown**: GIVEN `Origin: http://evil.example.com`. WHEN OPTIONS or POST. THEN no `Access-Control-Allow-Origin` header; status 403.

**R12 request id**: GIVEN header `X-Request-Id: abc-123`. WHEN processed. THEN response header echoes `abc-123`; SSE `done.requestId = "abc-123"`; log line carries `requestId=abc-123`. WHEN header absent, THEN server-generated UUID v4 appears in all three.

## Known model limitations

- **Cold start**: `gemma4:e4b` load into VRAM can take 5–10s on first hit. R8's 200ms abort budget applies only AFTER warmup; the first request gets a 60s ceiling.
- **Chunk granularity**: `gemma4:e4b` may emit multi-token chunks. R6's "one event per token" is interpreted as "one event per Ollama chunk".
- **Synthesizer under partial failure**: the model may paper over gaps. The done event's `warning` field MUST be set by the orchestrator (not synthesized) when any agent errored.
