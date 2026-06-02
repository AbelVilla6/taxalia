# Spec: Ollama Integration

## Cross-cutting (defined here, referenced from all 6 specs)

1. `request-id-propagation` (chat-endpoint)
2. `error-envelope-uniform` (chat-endpoint)
3. `locale-required-bilingual` (chat-endpoint; system-prompt)
4. `cors-allowlist-anon` (chat-endpoint)
5. `partial-failure-surfaced` (chat-endpoint; dispatch)
6. `per-agent-30s-timeout` — enforced at the Ollama wrapper level via per-call `AbortSignal`. (dispatch policy; ollama-integration wires)
7. `model-pinned-gemma4:e4b` — single source of truth lives here. (ollama-integration)
8. `conducta-all-five-loaded` (system-prompt; loaders)
9. `observability-hooks` — wrapper logs every call's duration and token count. (ollama-integration)
10. `no-cross-agent-calls-v1` (dispatch)

## Purpose

Thin, typed wrapper around `ollama-js` (v0.6.3+). Owns the `gemma4:e4b` model constant, the host configuration, the `AsyncIterable<string>` adapter that turns Ollama's stream parts into token strings, and the abort semantics that wire into Hono's `onAbort()`.

## Requirements

| # | Strength | Requirement |
|---|---|---|
| R1 | MUST | A single `MODEL` constant equals the string `'gemma4:e4b'`. No other model string is accepted anywhere in the codebase (enforced by a lint rule in `backend/eslint.config.mjs` — out of scope for this spec to define). |
| R2 | MUST | `new OllamaClient({ host, timeoutMs })` reads `OLLAMA_HOST` (default `http://127.0.0.1:11434`) and `OLLAMA_AGENT_TIMEOUT_MS` (default 30000) from env. |
| R3 | MUST | `chatOnce({ system, messages, format? })` returns a single `{ content: string }` (non-streaming). Used by the orchestrator. |
| R4 | MUST | `chatStream({ system, messages, signal })` returns `AsyncIterable<string>` that yields each non-empty token delta from the model. The signal MUST be wired to the underlying Ollama call's abort path. |
| R5 | MUST | On Ollama connection refused, `chatOnce` throws an error tagged `code: 'OLLAMA_UNREACHABLE'`. The chat route catches this and returns 503. |
| R6 | MUST | On Ollama returning HTTP 404 for the model, `chatOnce` throws `code: 'MODEL_MISSING'`. Caught at boot (R7) and per-request (503). |
| R7 | MUST | At boot, `checkModel()` calls `POST /api/show` for `gemma4:e4b`. If 404, the process exits non-zero with a message that names `npm run setup`. |
| R8 | MUST | Empty delta parts (Ollama sometimes yields `{"response": ""}`) are filtered out — `chatStream` does not yield them. |
| R9 | MUST | `chatStream` resolves the final iterator value with `{ done: true }` after the model's `done: true` part, then closes. |
| R10 | MUST | When the provided `signal` aborts, the in-flight `chatStream` iterator terminates within 500ms and the underlying Ollama connection is closed. |
| R11 | SHOULD | Wrapper logs `{ model, requestId, durationMs, promptEvalCount, evalCount }` for every call when a logger is injected. |
| R12 | MUST NOT | v1 sends images. `chatOnce` / `chatStream` MUST reject any `images` argument. |

### Edge cases (explicit)

- **Ollama unreachable at boot**: the first `checkModel()` call fails; the server logs `OLLAMA_UNREACHABLE` and exits non-zero. The `setup.sh` script is the install path.
- **Ollama reachable, model not pulled**: `checkModel()` returns 404; the server logs `MODEL_MISSING` and exits non-zero with `Run 'npm run setup' to pull gemma4:e4b.`
- **Ollama returns mid-stream an error part** (e.g., `{"error": "context length exceeded"}`): the iterator throws; dispatch catches and marks the agent as `error: { code: 'OLLAMA_ERROR', message: 'context length exceeded' }`.
- **Stream yields an empty delta part**: filtered (R8).
- **Abort mid-stream**: signal triggers Ollama's per-call abort; the iterator's `return()` runs; no further yields.
- **First request after `ollama serve` start**: the first model load can take 5–10s; R2's 30s default timeout is sufficient. The chat route applies a 60s grace on the first request (covered in chat-endpoint spec).

## Scenarios

**R3 chatOnce**: GIVEN a 1-message user prompt and a system prompt. WHEN `chatOnce` is called. THEN it returns `{ content: '...' }` from a non-streaming Ollama call. The underlying call uses `stream: false`.

**R4 chatStream happy**: GIVEN a 2-message conversation. WHEN `chatStream` is iterated. THEN it yields `'Hello'`, `', '`, `'world'` (in that order, possibly concatenated into fewer events depending on chunking), and closes after the model's `done: true` part.

**R5 unreachable**: GIVEN Ollama is down (`:11434` refuses). WHEN `chatOnce` is called. THEN it rejects with an Error whose `.code === 'OLLAMA_UNREACHABLE'` and whose `.cause` is the underlying ECONNREFUSED.

**R7 missing model at boot**: GIVEN Ollama is running but `gemma4:e4b` is not pulled. WHEN the server starts. THEN within 5s the process logs `MODEL_MISSING: gemma4:e4b not found. Run 'npm run setup'.` and exits with code 1.

**R8 empty deltas**: GIVEN a stream that yields parts `['', 'Hi', '', ' there', '']`. WHEN iterated. THEN the consumer sees only `['Hi', ' there']`.

**R10 abort**: GIVEN `chatStream` is mid-iteration. WHEN `signal.abort()` is called. THEN within 500ms the iterator's `return()` runs; the underlying fetch is aborted; `for await` exits cleanly with no error.

## Known model limitations

- **4B model context window**: `gemma4:e4b` has a finite context. The system-prompt assembly caps at 1500 tokens (see system-prompt spec R5) precisely to keep the per-agent call within the model's reliable window. A model-side 413 (context length exceeded) is handled as `OLLAMA_ERROR` and surfaces as a per-agent failure.
- **Multi-token chunks**: small models on slow hardware can emit 2–4 tokens at once. R4 yields whatever Ollama yields; the client renders it correctly.
- **Token count in logs (R11)**: `promptEvalCount` and `evalCount` are returned by Ollama on the final part. They are best-effort; absent in some Ollama versions. Wrapper logs them as `undefined` rather than failing.
- **Connection reuse**: `ollama-js` may or may not reuse HTTP connections across calls. v1 does not measure this. If latency matters in the future, `httpAgent` tuning is a follow-up.
