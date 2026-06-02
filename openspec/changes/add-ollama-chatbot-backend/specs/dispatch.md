# Spec: Dispatch (orchestrator, parallel runner, synthesizer)

## Cross-cutting (defined here, referenced from all 6 specs)

1. `request-id-propagation` — orchestrator logs route decisions under the request id. (dispatch)
2. `error-envelope-uniform` (chat-endpoint)
3. `locale-required-bilingual` (chat-endpoint; system-prompt)
4. `cors-allowlist-anon` (chat-endpoint)
5. `partial-failure-surfaced` — orchestrator populates `done.agents[]`; never empty on a 200. (dispatch owns)
6. `per-agent-30s-timeout` — owned and enforced here. (dispatch)
7. `model-pinned-gemma4:e4b` (ollama-integration)
8. `conducta-all-five-loaded` (system-prompt; loaders)
9. `observability-hooks` — orchestrator increments counters. (dispatch)
10. `no-cross-agent-calls-v1` — orchestrator is the sole decider; the schema for `agentsToRun` is enforced here. (dispatch)

## Purpose

The orchestration engine. Three steps: (1) a meta-prompted Ollama call returns the list of agents to run, (2) each selected agent streams tokens in parallel with isolated histories, (3) a synthesizer prompt merges the parallel outputs into the final reply streamed to the client. Owns the failure-mode contract (partial-with-warning) and the 30s per-agent timeout.

## Orchestrator contract (input → output)

- **Input**: `userMessage: string`, `agents: AgentDef[]` (full definitions).
- **Meta system prompt** (hard-coded, lang-dependent): instructs the model to return a JSON object `{"agentsToRun": string[], "reasoning": string}`.
- **Ollama call**: `chat({ model: 'gemma4:e4b', format: 'json', messages: [{role:'system', content: metaSP}, {role:'user', content: userMessage + "\n\nAvailable agents:\n" + agentSummaries}] })`.
- **Output**: parsed `{ agentsToRun, reasoning }`. `agentsToRun` MUST be a subset of the loaded agent ids; unknown ids are dropped with a log warning.

## Parallel runner

- Uses `Promise.allSettled` over a per-agent task list. Each task has its own `AbortController` linked to the request's outer `AbortSignal`.
- Per-agent history is `structuredClone(originalSessionHistory)`. The original is not mutated.
- Per-agent system prompt is the result of `assembleSystemPrompt(...)` (see system-prompt spec).
- Per-agent Ollama call: `chat({ model, stream: true, ... })` collected into a final string per agent.
- Per-agent timeout: 30s. On timeout, the task resolves with `{ id, status: 'error', error: { code: 'TIMEOUT' }, durationMs: 30000 }`.

## Synthesizer

- Called only when at least one agent returned `status: 'ok'` AND `agentsToRun.length >= 2`. (Single-agent runs skip the synthesizer and stream the agent's text directly.)
- **Synthesizer input**: `messages: [{role:'user', content: userMessage}, ...agentFinalMessages]`. It does NOT see per-token streams, only the final strings.
- **Synthesizer system prompt** (hard-coded, lang-dependent): "You are Lexi's synthesis layer. Merge the following agent replies into one coherent answer. If any agent reported a partial failure, include a brief acknowledgment."
- Streams its output token-by-token to the client via SSE.

## Failure handling

- If `agentsToRun` is empty (orchestrator picked nothing — small talk), the SSE terminates with `done: true, agents: []` and no synthesizer call. The client renders nothing new (or an "I'm not sure I can help with that" bubble from a hard-coded en/es fallback).
- If every selected agent errors, the SSE terminates with `done: true, warning: 'All agents failed.', agents: [...errors]`. No synthesizer call. Status 200 (the request was processed; the model just couldn't help).
- If 1+ agents error and ≥ 1 succeeds, the synthesizer runs with only the successful outputs. The orchestrator MUST set `done.warning` to a localized string (en/es) when any agent errored, regardless of what the synthesizer emits.

## Requirements

| # | Strength | Requirement |
|---|---|---|
| R1 | MUST | `route(userMessage, agents, lang)` returns `{ agentsToRun: string[], reasoning: string }` parsed from a JSON-formatted Ollama call within 10s. |
| R2 | MUST | If the orchestrator's response is not parseable JSON within 10s, treat it as `agentsToRun: []` and log `WARN orchestrator:parse-failed`. |
| R3 | MUST | Unknown agent ids in `agentsToRun` are dropped before fan-out; a WARN is logged with the dropped ids. |
| R4 | MUST | `runAgents(selectedAgents, history, signal)` returns `AgentResult[]` via `Promise.allSettled`. Each result has `id`, `status: 'ok' \| 'error'`, and either `text` (ok) or `error: { code, message? }` (error). |
| R5 | MUST | Each per-agent task is bounded by a 30s timeout (configurable via `OLLAMA_AGENT_TIMEOUT_MS`). On timeout, result is `{status:'error', error:{code:'TIMEOUT'}, durationMs: 30000}`. |
| R6 | MUST | `synthesize(userMessage, agentResults, lang)` streams the synthesizer's reply as `AsyncIterable<string>` and returns the full final string. |
| R7 | MUST | If `selectedAgents.length < 2` OR every selected agent errored, the synthesizer is not invoked; the SSE `done.agents[]` reflects the raw per-agent outcomes. |
| R8 | MUST | The outer request's `AbortSignal` is wired to every per-agent `AbortController`; abort propagates within 200ms. |
| R9 | MUST | Counter `dispatch_orchestrator_calls_total` increments on every route call; counter `dispatch_partial_failures_total` increments when any agent in a dispatch errors; counter `dispatch_total_failures_total` increments when every agent errors. |
| R10 | MUST | Counter `dispatch_agents_selected_total{agent_id}` is a labelled counter incrementing per selected agent. |

### Edge cases (explicit)

- **Message matches no agent**: `agentsToRun: []` → SSE terminates with `done: true, agents: []`, no synthesizer. The client may show a fallback bubble from a hard-coded string.
- **Message matches 3+ agents**: orchestrator returns all 3+; dispatch runs them all in parallel. v1 has no upper cap. sdd-design should budget for a soft cap (e.g., warn at 5).
- **One agent times out (30s)**: marked `error: TIMEOUT`; others continue; the synthesizer sees the gap and the orchestrator sets `done.warning`.
- **One agent returns a parse error** (non-string final): the agent's collector yields `{status:'error', error:{code:'PARSE'}}`; others continue.
- **Synthesizer itself errors mid-stream**: SSE `done: true` includes `error: { code: 'SYNTHESIS_FAILED' }` and the raw per-agent outputs in `agents[]` for debugging. No further retry in v1.
- **Locale change mid-conversation** (handled by chat-endpoint + system-prompt): the next dispatch re-assembles system prompt from scratch; no carry-over.

## Scenarios

**R1 orchestrator happy**: GIVEN 3 agents loaded and user says "I need an advisory quote". WHEN `route` is called. THEN within 10s it returns `{"agentsToRun": ["advisory"], "reasoning": "..."}` parsed as JSON.

**R2 orchestrator parse fail**: GIVEN the model returns `Sure, I'll go with advisory!` (no JSON). WHEN `route` is called. THEN it resolves to `{agentsToRun: [], reasoning: ''}` and logs `orchestrator:parse-failed`. The request still completes (200) with no agent run.

**R4 mixed success/failure**: GIVEN `agentsToRun: ['advisory', 'valuation']`. WHEN `runAgents` runs and `valuation` times out. THEN result is `[{id:'advisory', status:'ok', text:'...'}, {id:'valuation', status:'error', error:{code:'TIMEOUT'}, durationMs: 30000}]`. Synthesizer runs with only advisory's text.

**R7 single-agent skip**: GIVEN `agentsToRun: ['financial']`. WHEN dispatch runs. THEN the synthesizer is NOT invoked; the financial agent's stream is forwarded directly to the client. `done.agents = [{id:'financial', status:'ok', text:'...'}]`.

**R8 abort propagation**: GIVEN an in-flight dispatch with 2 agents streaming. WHEN the outer request is aborted. THEN within 200ms both per-agent `AbortController`s fire; both Ollama streams drop; the SSE response closes.

**R10 metrics**: GIVEN 10 requests each selecting `advisory`. WHEN observed. THEN `dispatch_agents_selected_total{agent_id="advisory"} === 10`. When 1 of those requests had a partial failure, `dispatch_partial_failures_total === 1`.

## Known model limitations

- **Orchestrator JSON unreliability**: `gemma4:e4b` (4B) may not consistently return parseable JSON. R2's fallback (empty array) is the safety net. Integration test in PR4 runs the live model against 20 fixture messages; pass criterion is ≥ 16/20 parseable.
- **Synthesizer ignoring warnings**: under partial failure, the synthesizer may still produce a clean answer that doesn't mention the gap. R7+R8's `done.warning` set by the orchestrator (not the synthesizer) is the safety net.
- **Parallel over-subscription**: 3+ agents in parallel multiply the model load. If two dispatches hit the same Ollama instance simultaneously, latency stacks. v1 has no queue; a future change may add a per-process concurrency cap (design notes that 2 simultaneous dispatches × 3 agents is the realistic ceiling on a 16GB M3).
