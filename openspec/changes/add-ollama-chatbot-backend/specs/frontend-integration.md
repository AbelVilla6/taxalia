# Spec: Frontend Integration

## Cross-cutting (defined here, referenced from all 6 specs)

1. `request-id-propagation` — chat-client generates a UUID v4 per turn and sends it as `X-Request-Id`. (frontend-integration)
2. `error-envelope-uniform` — client surfaces `error.message` from the envelope. (frontend-integration)
3. `locale-required-bilingual` — client reads `lang` from `#chat-config` and passes it to every request. (frontend-integration)
4. `cors-allowlist-anon` — client only runs on allowlisted origins; enforced by the server, but the client never tries to talk to a different host. (frontend-integration + chat-endpoint)
5. `partial-failure-surfaced` — client renders `done.warning` as a small badge. (frontend-integration)
6. `per-agent-30s-timeout` — client surfaces a timeout toast if the request takes >30s. (frontend-integration observes; dispatch enforces)
7. `model-pinned-gemma4:e4b` (ollama-integration)
8. `conducta-all-five-loaded` (system-prompt; loaders)
9. `observability-hooks` — client logs page-side latency to `console.info` with the request id. (frontend-integration)
10. `no-cross-agent-calls-v1` (dispatch)

## Purpose

Replaces the static chat widget with a real client-side island: a message list, an input, a typing indicator, a human-handoff link, and a small bootstrap that opens an SSE stream against the backend. Adds a `src/scripts/chat-client.ts` module, extends `src/i18n.ts` with 6 new chat keys per locale, extends `src/assets/css/lb-co.css` with message/input styles, and replaces the close handler in `src/layouts/Base.astro`.

## i18n key additions (under `ui[lang].chat`)

| Key | en | es |
|---|---|---|
| `placeholder` | `"Type your message..."` | `"Escribe tu mensaje..."` |
| `send` | `"Send"` | `"Enviar"` |
| `sendAria` | `"Send message"` | `"Enviar mensaje"` |
| `typing` | `"Lexi is typing..."` | `"Lexi está escribiendo..."` |
| `error` | `"Sorry, something went wrong. Please try again."` | `"Lo siento, algo salió mal. Inténtalo de nuevo."` |
| `personaName` | `"Lexi"` | `"Lexi"` |
| `humanHandoff` | `"Talk to a person"` | `"Hablar con una persona"` |
| `partialWarning` | `"Some answers may be incomplete."` | `"Algunas respuestas pueden estar incompletas."` |

The existing 6 keys (`ariaLabel`, `imageAlt`, `status`, `close`, `bubble`, `action`) are kept. `action` is no longer rendered (the `<a>` to `/contact` is replaced) but is retained for one release in case of rollback.

## Mount points (v1: home only)

- `src/pages/index.astro` (line 29) — already mounts `<ChatWidget lang="en" />`. **Unchanged**.
- `src/pages/es/index.astro` (line 29) — already mounts `<ChatWidget lang="es" />`. **Unchanged**.
- All other pages (`about`, `blog`, `services`, `contact`, `/es/*` mirrors) — **no widget in v1**. Site-wide is a follow-up.

## Requirements

| # | Strength | Requirement |
|---|---|---|
| R1 | MUST | `src/scripts/chat-client.ts` exports `init({ mount: '#chat-widget-mount', config: '#chat-config' })` and is imported as a module from `Base.astro`. |
| R2 | MUST | The chat widget DOM keeps `id="chat-widget"`, `id="chat-close"`, and all `.chat-*` CSS classes that the existing shell styles depend on. The old markup's static `<a>` to `/contact` is replaced by a message list + input + a footer link. |
| R3 | MUST | `init()` reads `apiBase` and `lang` from a `<script type="application/json" id="chat-config">` block injected by the widget. Missing config block → `init` throws visibly to the console. |
| R4 | MUST | Each `POST /chat` carries header `X-Request-Id: <uuid-v4>` (generated per turn). |
| R5 | MUST | The client uses native `fetch` + `ReadableStream` to consume the SSE. No `EventSource` (which lacks the `X-Request-Id` header). |
| R6 | MUST | Click on `#chat-close` calls the active fetch's `controller.abort()` and then removes the `#chat-widget` element. Abort is observable on the server within 200ms. |
| R7 | MUST | The input is a `<form>` with a `<button type="submit">`; pressing Enter submits; empty input disables the button. |
| R8 | MUST | The client renders incoming `data: {"delta": "..."}` by appending to the current assistant message bubble. Empty deltas are ignored. |
| R9 | MUST | On `data: {"done": true, "warning": "..."}`, the client renders a small badge with the warning text under the assistant message. |
| R10 | MUST | On any HTTP error (4xx/5xx), the client shows the `ui[lang].chat.error` toast and stops the typing indicator. The request is NOT auto-retried. |
| R11 | MUST | On `fetch` network error (no HTTP response), the client shows the same error toast. |
| R12 | MUST | The widget's CSS additions (`chat-messages`, `chat-input`, `chat-msg--user`, `chat-msg--assistant`, `chat-typing`) are appended to `src/assets/css/lb-co.css`; no rewrite of the existing shell styles. |
| R13 | MUST | The persona header keeps `<img src="/assets/images/agent-lexi.webp">` and the `Lexi` name. The literal `"Lexi"` in `ChatWidget.astro` is replaced by `{copy.personaName}` so future persona swaps are i18n-driven. |
| R14 | MUST NOT | The frontend adds any new npm package. The chat client uses native `fetch` / `ReadableStream` / `AbortController` / `crypto.randomUUID`. |
| R15 | MUST NOT | The Astro build is modified. No `astro.config.mjs` change, no new integration. |
| R16 | SHOULD | On a request that takes >30s, the client renders the error toast even if no error event has arrived. (A safety net; server's 30s timeout is the source of truth.) |

### Edge cases (explicit)

- **Empty message submit**: send button is disabled while input is empty/whitespace; Enter in an empty input is a no-op.
- **Close mid-stream**: `controller.abort()` fires; Hono `onAbort` drops Ollama streams within 200ms; the client removes `#chat-widget`; any in-flight `data:` event in the browser buffer is discarded.
- **Locale change mid-conversation**: not supported in v1 via a UI switch. The widget reads `lang` once from `#chat-config` at init. (A language toggle is a separate change; the home page exposes its own header language switcher which navigates to the `/es/` mirror, resetting the widget.)
- **Backend down**: fetch rejects with a network error; the client shows `ui[lang].chat.error` toast; the typing indicator stops; the user can type a new message to retry.
- **SSE reconnect after a network blip**: the client does NOT reconnect. The user must click send again. The previous message is preserved in the input; the half-rendered assistant message is removed.
- **Chat-config script loads after `chat-client.ts`**: the bootstrap waits up to 1000ms for `#chat-config` to exist; if absent after that, `init` logs an error to `console.error` and the widget remains non-functional (the old markup fallback — the static link — is NOT restored; the widget is just inert).

## Scenarios

**R4 request id**: GIVEN the user sends "Hello". WHEN the client POSTs. THEN the request includes `X-Request-Id: <uuid>`. WHEN the response returns. THEN the same id appears in the response header (informational; the client does not assert on it but logs it).

**R6 close mid-stream**: GIVEN an in-flight turn with at least one streamed token. WHEN the user clicks `#chat-close`. THEN within 200ms the server's `onAbort` fires; within 50ms the client removes the `#chat-widget` element from the DOM.

**R7 empty input**: GIVEN the input is empty. WHEN the user clicks the send button or presses Enter. THEN no request is sent; no error toast.

**R9 partial warning**: GIVEN the SSE done event carries `warning: "Some answers may be incomplete."`. WHEN rendered. THEN a small warning badge appears directly under the assistant's message bubble with that text.

**R10 HTTP 503**: GIVEN the backend returns 503 `OLLAMA_UNREACHABLE`. WHEN the response is received. THEN the client shows `ui[lang].chat.error` toast; the typing indicator stops; the user's last input is preserved in the input box.

**R11 network error**: GIVEN the backend is not running. WHEN the user submits. THEN `fetch` rejects; the same error toast is shown; the input is preserved.

**R16 timeout safety net**: GIVEN a request has been in flight for 30s with no done event. WHEN 30s elapses from the request's start. THEN the client shows the error toast and removes the typing indicator, regardless of whether the server is still working.

## Known model limitations

- **Synthesizer text coherence on the client side**: the client just renders deltas as they arrive. The user sees a typing animation that may stall mid-sentence if Ollama is slow; this is the visual signature of the partial-failure mode and is acceptable.
- **Spanish token chunks under load**: `gemma4:e4b` may emit Spanish with occasional English code-switching under prompt pressure. This is a model limitation, not a client limitation; the `bilingual-response` conducta policy is the only mitigation in v1.
- **Long messages overflow**: if the synthesizer emits a very long reply, the message bubble must scroll. The CSS append specifies `max-height: 60vh; overflow-y: auto;` on `.chat-messages`. This is documented in the CSS; sdd-verify asserts via a snapshot test that the class is present and the rules exist.
