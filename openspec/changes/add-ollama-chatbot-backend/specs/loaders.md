# Spec: Loaders (agents, skills, conducta)

## Cross-cutting (defined here, referenced from all 6 specs)

1. `request-id-propagation` (chat-endpoint)
2. `error-envelope-uniform` (chat-endpoint)
3. `locale-required-bilingual` (chat-endpoint; system-prompt)
4. `cors-allowlist-anon` (chat-endpoint)
5. `partial-failure-surfaced` (chat-endpoint; dispatch)
6. `per-agent-30s-timeout` (dispatch)
7. `model-pinned-gemma4-e4b` (ollama-integration)
8. `conducta-all-five-loaded` — loaders boot assertion: exactly 5 conducta files present. (loaders own; system-prompt uses)
9. `observability-hooks` (observability; chat-endpoint)
10. `no-cross-agent-calls-v1` (dispatch)

## Purpose

Reads persona, capability, and conduct-policy Markdown files from the filesystem, parses their YAML frontmatter, validates required fields, and returns typed `AgentDef[]`, `SkillDef[]`, `ConductDef[]`. Loads once at boot and on `POST /admin/reload` (dev only). The screaming layout keeps the data files under each domain's folder, alongside the loader code that reads them.

## Artifact format

One file per artifact. Diff-friendly Markdown with YAML frontmatter:

```markdown
---
id: advisory
name: Advisory Services Assistant
description: Helps users understand advisory services and the engagement model.
system_prompt: |
  You are the Advisory Services assistant for Taxalia. ...
tools: [lookup-engagement-model, capture-lead]
tags: [advisory, sales]
---
# Advisory Services — long form

Optional free-form body. Used in v2 via tool-call lookup. In v1 the body is
loaded into the agent's long-form reference but NOT injected into the
per-request system prompt.
```

The **frontmatter** is the machine-readable contract. The **Markdown body** is human guidance, v1-loaded but not auto-injected into the system prompt.

## Directory layout (data + loader colocated)

```
backend/src/
  agents/
    advisory.md
    valuation.md
    financial.md
    loader.ts            # loadAgents(dir): Promise<AgentDef[]>
  skills/
    lookup-engagement-model.md
    calculate-valuation.md
    capture-lead.md
    loader.ts
  conducta/
    never-pretend.md
    cite-sources.md
    bilingual-response.md
    privacy-no-pii.md
    handoff-to-human.md
    loader.ts
```

## Requirements

| # | Strength | Requirement |
|---|---|---|
| R1 | MUST | `loadAgents(dir)` returns `AgentDef[]` parsed from `dir/*.md` whose frontmatter is valid YAML and includes `id`, `name`, `description`, `system_prompt`. |
| R2 | MUST | `loadSkills(dir)` returns `SkillDef[]` parsed from `dir/*.md` whose frontmatter includes `id`, `name`, `description`. |
| R3 | MUST | `loadConducta(dir)` returns `ConductDef[]` parsed from `dir/*.md` whose frontmatter includes `id`, `description`, `rule`, `priority` (integer). |
| R4 | MUST | At boot, if the count of loaded conduct policies is not exactly 5, the process MUST exit non-zero with a message naming the expected count and the actual count. |
| R5 | MUST | At boot, if any frontmatter is missing a required field or has an unparseable YAML block, exit non-zero with the offending file path. |
| R6 | MUST | Duplicate artifact ids across files cause a boot failure that names both file paths. |
| R7 | MUST | `POST /admin/reload` (dev only) re-runs all three loaders synchronously and atomically swaps the in-memory arrays. Failed re-loads leave the previous arrays in place. |
| R8 | MUST | Loaders are pure functions of the directory; no I/O outside `fs.readdir`/`fs.readFile`. No network calls, no environment reads inside the loader. |
| R9 | MUST NOT | Hot-reload via `chokidar` / `fs.watch` in v1. v1 boot + `/admin/reload` only. |
| R10 | SHOULD | Loader modules expose `loadX(dir, opts?: { logger?: Logger })` for test-time injection. |

### Edge cases (explicit)

- **Conducta file missing at startup**: the 5-file contract fails; process exits non-zero with `Expected 5 conduct policies, found N. Add files to backend/src/conducta/.`
- **Malformed frontmatter** (e.g., unparseable YAML, missing `id`): exit non-zero with `Conducta policy at <path> is missing required field 'id'.` and a one-line fix hint.
- **Empty directory**: treated as zero loaded; triggers R4's boot failure for conducta.
- **Subdirectories under `agents/`** (e.g., `agents/retired/`): not recursed into; only `dir/*.md` at the top level.
- **File with non-`.md` extension** (e.g., `.mdx`, `.markdown`): not loaded in v1; logged as `skipped: <path>` at DEBUG level.

## Scenarios

**R1 valid agent file**: GIVEN `agents/advisory.md` with valid frontmatter. WHEN `loadAgents('agents')` is called. THEN result contains one `AgentDef` with `id === 'advisory'` and `systemPrompt` matching the file's `system_prompt` block.

**R4 conducta count mismatch**: GIVEN `conducta/` contains 3 files. WHEN the server boots. THEN the process exits non-zero with a message naming the expected 5 and actual 3.

**R5 missing required field**: GIVEN `agents/foo.md` has no `system_prompt` key. WHEN `loadAgents` is called. THEN it throws an error whose message includes the file path and the missing field name.

**R6 duplicate ids**: GIVEN two files in `skills/` both declaring `id: lookup-foo`. WHEN `loadSkills` is called. THEN it throws with both file paths in the error message.

**R7 reload atomicity**: GIVEN the server is running with 3 skills loaded. WHEN a malformed skill file is added and `POST /admin/reload` is called. THEN the response is 500 with a parse error; the in-memory skill array still holds the original 3.

**R8 pure loader**: GIVEN a unit test injects a temp dir. WHEN `loadAgents` runs. THEN the test can mock `fs` and observe no other I/O.

## Known model limitations

- N/A — loaders do not call the model. This spec is pure I/O + parsing.
- **Real risk**: parse errors at boot will block server start. `setup.sh` MUST run loader smoke-tests as part of setup; a one-liner `node -e "import('./src/agents/loader.js').then(m => m.loadAgents('src/agents'))"` exits 0 only when all loaders succeed.
