# Spec: System Prompt Assembly

## Cross-cutting (defined here, referenced from all 6 specs)

1. `request-id-propagation` (chat-endpoint)
2. `error-envelope-uniform` (chat-endpoint)
3. `locale-required-bilingual` — assembly selects base identity + system-prompt language from `lang`. (system-prompt owns)
4. `cors-allowlist-anon` (chat-endpoint)
5. `partial-failure-surfaced` (chat-endpoint; dispatch)
6. `per-agent-30s-timeout` (dispatch)
7. `model-pinned-gemma4:e4b` — assumption baked into the budget below. (ollama-integration)
8. `conducta-all-five-loaded` — assembly's primary consumer of conducta. (system-prompt enforces order; loaders enforce count)
9. `observability-hooks` (observability; chat-endpoint)
10. `no-cross-agent-calls-v1` (dispatch)

## Purpose

Composes the system prompt string sent to `gemma4:e4b` for every per-agent invocation, in a fixed order that empirically reduces prompt-injection drift. Owns the size budget, the locale switch, and the conduct-policy ordering by `priority` ascending.

## Assembly order (locked)

The prompt is concatenated top-to-bottom in this order. Top = highest priority, comes last in many prompt-injection defenses.

1. **Base identity** (hard-coded string, lang-dependent): `"You are Lexi, the AI assistant for Taxalia. ..."` in `en` or `"Eres Lexi, la asistente de IA de Taxalia. ..."` in `es`.
2. **Conducta** (broadest scope): all `ConductDef.rule` strings joined with `\n\n---\n\n`, sorted by `priority` ascending. Lower priority numbers = more general policies = anchor first.
3. **Agent system prompt** (narrower scope): the selected agent's `systemPrompt`.
4. **Skills metadata** (narrowest): one bullet line per loaded skill: `"- <skill.id>: <skill.description>"`. Skill bodies are NOT injected in v1.
5. **User message history** (most specific): appended by the Ollama chat call, not by this module.

## Requirements

| # | Strength | Requirement |
|---|---|---|
| R1 | MUST | `assembleSystemPrompt({ lang, conducta, agent, skills })` returns a single string in the order above. |
| R2 | MUST | Base identity section is selected from a hard-coded bilingual map keyed by `lang`. Unsupported `lang` is impossible at this layer (chat-endpoint rejects before dispatch). |
| R3 | MUST | Conducta section joins rules with `\n\n---\n\n` and sorts by `priority` ascending before joining. |
| R4 | MUST | Skills metadata section is exactly one bullet line per skill, format `- <id>: <description>`. No bodies. |
| R5 | MUST | The total assembled system prompt (steps 1–4) MUST be ≤ 1500 tokens by a conservative 4-chars-per-token estimate. Exceeding the budget at boot logs a WARN and refuses to start the request (returns 503 `SYSTEM_PROMPT_TOO_LARGE`). |
| R6 | MUST | `assembleSystemPrompt` is a pure function: same input → same output. No I/O, no time-of-day, no random. |
| R7 | MUST | The function exposes a `tokenCount(prompt: string): number` helper using the same 4-chars/token estimator; a unit test asserts the helper agrees with a real tokenizer within ±15% on a representative sample. |
| R8 | SHOULD | Conducta section header in en: `## Conduct policies`; in es: `## Políticas de conducta`. |
| R9 | MUST | Locale change mid-conversation (client sends a new request with a different `lang`) re-assembles the system prompt from scratch. There is no carry-over of the previous prompt across requests. |

### Edge cases (explicit)

- **Conducta count < 5**: caught upstream by loaders (R4 in loaders). This module asserts ≥ 5 to fail fast.
- **Agent has empty `systemPrompt`**: the agent section is omitted (not replaced with placeholder). The boot-time agent loader rejects empty `system_prompt` (R5 in loaders), so this is defensive.
- **Skills list is empty**: skills section is the literal string `(no skills available)`. In v1 this is unreachable because the boot contract requires 3 skills, but defensive.
- **Locale change mid-conversation**: the FE rebuilds the message list; the BE re-assembles the system prompt from scratch for the next request. No historical prompt is cached server-side.

## Scenarios

**R1 happy en**: GIVEN `lang: 'en'`, conducta with 5 rules, agent `advisory`, 3 skills. WHEN assembled. THEN the prompt starts with the English base identity, contains the conduct policies joined by `---`, then the agent's `systemPrompt`, then 3 bullet lines.

**R3 conduct ordering**: GIVEN conducta files with priorities `[3, 1, 5, 2, 4]`. WHEN assembled. THEN they appear in the order `[1, 2, 3, 4, 5]` in the prompt.

**R5 budget violation**: GIVEN 3 skills with extremely long descriptions that push the total to 1700 tokens. WHEN the first request is processed. THEN the response is 503 `SYSTEM_PROMPT_TOO_LARGE` and the server logs the offending token count. A boot-time WARN is also emitted.

**R6 purity**: GIVEN a unit test that calls `assembleSystemPrompt` 1000 times with the same input. WHEN it compares outputs. THEN all 1000 are byte-identical.

**R9 locale change**: GIVEN client sends turn 1 with `lang: 'en'`, then turn 2 with `lang: 'es'`. WHEN the BE processes each. THEN turn 1's prompt is entirely in en; turn 2's is entirely in es. No mixed-language contamination.

## Known model limitations

- **4B model context**: 1500-token budget is conservative. `gemma4:e4b` is a 4B-active model; an over-long system prompt fragments attention. Mitigation: R5's hard cap.
- **Bilingual drift under length pressure**: with a 1500-token prompt, the model may slip into English when asked for Spanish (or vice versa). Mitigation: `bilingual-response` conduct policy explicitly instructs lang lock; the synthesizer enforces it. A small eval fixture in PR3 asserts 5-of-5 en-only and es-only responses are monolingual.
- **Conducta ordering sensitivity**: small models are more sensitive to instruction order than larger ones. Priority field is the knob; v1 ships with hand-tuned priorities and reorders would be a manual decision.
