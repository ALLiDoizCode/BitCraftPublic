# Story 4.2: Agent.md Configuration & Skill Selection

Status: done

<!--
Validation Status: VALIDATED
Review Type: Adversarial Review via /bmad-review-adversarial-general (2026-03-14)
Reviewer: Claude Opus 4.6
BMAD Standards Compliance: VERIFIED (2026-03-14)
- Story structure: Complete (all required sections present, including Change Log and Code Review Record templates)
- Acceptance criteria: 6 ACs with Given/When/Then format, FR/NFR traceability
- Task breakdown: 8 tasks with detailed subtasks, AC mapping on each task
- NFR traceability: 2 NFRs mapped to ACs (NFR21, NFR25)
- FR traceability: 2 FRs mapped to ACs (FR11, FR12)
- Dependencies: Documented (3 epics + 1 story required complete, 1 external, 3 stories blocked)
- Technical design: Comprehensive with architecture decisions, file format schema, parsing strategy, error patterns
- Security review: OWASP Top 10 coverage complete (A01, A02, A03, A04, A05, A06, A09)
Issues Found & Fixed: 10 (see review notes below)
Ready for Implementation: YES
-->

## Story

As a researcher,
I want to define agent behavior entirely through an Agent.md configuration file,
So that I can create and modify agents without writing any application code.

## Dependencies

**Required Complete (all done):**

- **Epic 1** (Project Foundation) -- monorepo structure, Nostr identity, SpacetimeDB connection, static data
- **Epic 2** (Action Execution & Payment Pipeline) -- `client.publish()` pipeline, action cost registry (Story 2.2)
- **Epic 3** (BitCraft BLS Game Action Handler) -- BLS handler consuming `{ reducer, args }` payloads (Story 3.2), fee schedule (Story 3.3)
- **Story 4.1** (Skill File Format & Parser) -- `parseSkillFile()`, `parseSkillMetadata()`, `SkillRegistry`, `loadSkillDirectory()`, `Skill`/`SkillMetadata` types

**External Dependencies:**

- `gray-matter` npm package (already installed in `@sigil/client` from Story 4.1)
- No Docker required -- pure file parsing and config resolution, no server-side dependencies

**Blocks:**

- Story 4.3 (Configuration Validation Against SpacetimeDB) -- depends on parsed agent config + resolved skills for validation input
- Story 4.4 (Budget Tracking & Limits) -- depends on budget config extracted from Agent.md
- Story 4.7 (Swappable Agent Configuration) -- depends on agent config loader for reload semantics

## Acceptance Criteria

1. **Agent.md section extraction (AC1)** (FR11)
   - **Given** an Agent.md file with configuration sections
   - **When** the agent config parser loads the file
   - **Then** the following are extracted: agent name, personality description, selected skill references, budget limit, logging preferences
   - **And** missing optional sections (personality, budget, logging) do not cause errors

2. **Skill reference resolution (AC2)** (FR12)
   - **Given** an Agent.md that references skill files by name
   - **When** the agent configuration is loaded
   - **Then** the referenced skills are resolved from the skills directory
   - **And** only the selected skills are active for that agent

3. **Missing skill fail-fast (AC3)**
   - **Given** an Agent.md referencing a non-existent skill file
   - **When** the configuration is loaded
   - **Then** a clear error identifies the missing skill file by name
   - **And** the agent does not start with a partial skill set
   - **And** if multiple skills are missing, all are listed in the error message

4. **CLAUDE.md / AGENTS.md generation (AC4)** (NFR21)
   - **Given** a valid Agent.md and resolved skills
   - **When** the agent is initialized
   - **Then** a CLAUDE.md is generated for Claude agents with the personality, constraints, goals, and MCP tool references
   - **And** an AGENTS.md equivalent is available for non-Claude agents (Vercel AI, OpenCode)
   - **And** generated files include skill descriptions for LLM reference

5. **Triggering precision validation (AC5)**
   - **Given** skill descriptions in resolved SKILL.md files
   - **When** the agent configuration is validated
   - **Then** skill descriptions are analyzed for triggering precision -- descriptions must be specific enough for the LLM to distinguish when to invoke each skill vs. when not to
   - **And** ambiguous or overlapping skill descriptions produce a warning in the validation report

6. **Stateless configuration (AC6)** (NFR25)
   - **Given** an Agent.md configuration
   - **When** the agent restarts
   - **Then** Agent.md is re-read from disk (stateless configuration)
   - **And** any changes to Agent.md take effect on the next startup

## Tasks / Subtasks

### Task 1: Define Agent configuration types (AC: 1, 2, 6)

- [x] Create `packages/client/src/agent/agent-config-types.ts`:
  - Export `AgentBudgetConfig` interface: `{ limit: number; unit: string; period: string; raw: string }`
    - `limit`: numeric value (e.g., 100)
    - `unit`: currency unit (e.g., `'ILP'`, `'USD'`)
    - `period`: time period (e.g., `'session'`, `'hour'`)
    - `raw`: original string from Agent.md (e.g., `'100 ILP/session'`)
  - Export `AgentLoggingConfig` interface: `{ path: string; level: 'debug' | 'info' | 'warn' | 'error' }`
  - Export `AgentConfig` interface:
    - `name: string` -- REQUIRED: agent name from `# Agent: <name>` heading
    - `personality?: string` -- OPTIONAL: personality description from `## Personality` section
    - `skillNames: string[]` -- REQUIRED: skill references from `## Skills` section
    - `budget?: AgentBudgetConfig` -- OPTIONAL: budget from `## Budget` section
    - `logging?: AgentLoggingConfig` -- OPTIONAL: logging config from `## Logging` section
  - Export `ResolvedAgentConfig` interface (extends AgentConfig):
    - All fields from `AgentConfig`
    - `skills: Skill[]` -- resolved `Skill` objects (from `SkillRegistry`)
    - `skillRegistry: SkillRegistry` -- populated with only the selected skills
  - Export `AgentConfigError` class extending `Error`:
    - `code: AgentConfigErrorCode`
    - `filePath: string`
    - `fields?: string[]`
  - Export `AgentConfigErrorCode` type: `'MISSING_AGENT_NAME' | 'MISSING_SKILLS_SECTION' | 'INVALID_BUDGET_FORMAT' | 'INVALID_LOGGING_CONFIG' | 'SKILL_NOT_FOUND' | 'PARSE_ERROR' | 'DUPLICATE_SKILL_REFERENCE'`

### Task 2: Create Agent.md parser (AC: 1)

- [x] Create `packages/client/src/agent/agent-config-parser.ts`:
  - Export `parseAgentConfig(filePath: string, content: string): AgentConfig`
  - **Parsing strategy:** Agent.md uses standard markdown structure (not YAML frontmatter). Parse by section headings:
    - `# Agent: <name>` -- H1 heading extracts agent name (REQUIRED)
    - `## Personality` -- freeform markdown text
    - `## Skills` -- bullet list of skill names (`- skill_name`)
    - `## Budget` -- single line format: `<amount> <unit>/<period>` (e.g., `100 ILP/session`, `0.05 USD/hour`)
    - `## Logging` -- key-value pairs: `- path: ./logs/agent.jsonl`, `- level: debug`
  - **Section extraction:**
    - Split content on H2 headings (`## `)
    - Each section: heading text -> section body
    - Unknown sections are ignored (forward-compatible)
  - **Name extraction:**
    - Parse H1 heading: `# Agent: <name>` -- extract name after `Agent: `
    - If no H1 with `Agent:` prefix, throw `AgentConfigError` with code `MISSING_AGENT_NAME`
  - **Skills extraction:**
    - Parse `## Skills` section for bullet list items
    - Each line starting with `- ` is a skill reference
    - Trim whitespace, extract skill name
    - Empty skills section or missing section: throw `AgentConfigError` with code `MISSING_SKILLS_SECTION`
    - Duplicate skill references: throw `AgentConfigError` with code `DUPLICATE_SKILL_REFERENCE`
  - **Budget extraction:**
    - Parse `## Budget` section content
    - Trim section body: strip leading/trailing whitespace and blank lines, extract first non-empty line
    - Regex: `/^(\d+(?:\.\d+)?)\s+(\w+)\/(\w+)$/` applied to the trimmed line to extract amount, unit, period
    - Invalid format (non-matching line): throw `AgentConfigError` with code `INVALID_BUDGET_FORMAT`
    - Missing section: `budget` field is `undefined` (optional)
  - **Logging extraction:**
    - Parse `## Logging` section for key-value lines (`- key: value`)
    - Required keys when section present: `path`
    - Optional keys: `level` (default: `'info'`)
    - Invalid level value: throw `AgentConfigError` with code `INVALID_LOGGING_CONFIG`
    - Missing section: `logging` field is `undefined` (optional)
  - **Security:**
    - File content size limit: reject >1MB (Agent.md should be small; OWASP A03 DoS)
    - No path traversal from parsed logging path (validated at config resolution time, not parse time)
    - Agent name validation: non-empty string after trimming

### Task 3: Create skill resolution and agent config loader (AC: 2, 3, 6)

- [x] Create `packages/client/src/agent/agent-config-loader.ts`:
  - Export `loadAgentConfig(agentMdPath: string, skillsDirPath: string): Promise<ResolvedAgentConfig>`
    - Reads Agent.md from disk (`fs/promises.readFile`)
    - Parses via `parseAgentConfig()`
    - Loads skill directory via `loadSkillDirectory()` (from Story 4.1)
    - Resolves skill references:
      - For each `skillNames[i]`, look up in loaded skills by name
      - If any skill is not found, collect all missing names
      - If missing skills exist, throw `AgentConfigError` with code `SKILL_NOT_FOUND`, listing all missing names in `fields`
    - Creates a filtered `SkillRegistry` with only the referenced skills
    - Returns `ResolvedAgentConfig` with both parsed config and resolved skills
  - Export `reloadAgentConfig(agentMdPath: string, skillsDirPath: string): Promise<ResolvedAgentConfig>`
    - Same as `loadAgentConfig()` -- re-reads from disk (stateless, AC6)
    - Agent.md is never cached; every call reads fresh from disk
    - This is a semantic alias to make intent clear in calling code
  - **Error handling:**
    - Agent.md file not found: throw `AgentConfigError` with code `PARSE_ERROR`
    - Skills directory not found: propagates `SkillParseError` from loader
    - Skill parse errors for REFERENCED files: throw `AgentConfigError` with code `SKILL_NOT_FOUND` (treat a referenced skill that failed to parse the same as a missing skill)
    - Skill parse errors for NON-REFERENCED files: ignored (only referenced skills matter for resolution)
  - **Path validation:**
    - Agent.md path: validate exists, is a file
    - Skills directory path: delegated to `loadSkillDirectory()` (already validates in Story 4.1)

### Task 4: Create CLAUDE.md / AGENTS.md generator (AC: 4)

- [x] Create `packages/client/src/agent/agent-file-generator.ts`:
  - Export `generateClaudeMd(config: ResolvedAgentConfig): string`
    - Generates CLAUDE.md content for Claude agents
    - Structure:
      ```
      # Agent: {name}

      ## Identity
      {personality section from Agent.md, or default}

      ## Constraints
      - Budget: {budget.raw} (if configured)
      - Available skills: {skill count}

      ## Goals
      {extracted from personality or generic defaults}

      ## Available Skills
      {for each resolved skill: name, description, reducer, params summary}

      ## MCP Tools
      {maps each skill to an MCP tool reference in snake_case format}
      ```
    - Each skill entry includes: name, description (from SKILL.md), reducer, parameter summary
    - MCP tool references use `snake_case` naming (project convention)
  - Export `generateAgentsMd(config: ResolvedAgentConfig): string`
    - Generates AGENTS.md content for non-Claude agents (Vercel AI, OpenCode)
    - Same information as CLAUDE.md but in runtime-agnostic format
    - Structure follows generic agent configuration pattern
  - Export `AgentFileOutput` interface: `{ claudeMd: string; agentsMd: string }`
  - Export `generateAgentFiles(config: ResolvedAgentConfig): AgentFileOutput`
    - Convenience function returning both generated files

### Task 5: Create triggering precision validator (AC: 5)

- [x] Create `packages/client/src/agent/triggering-precision.ts`:
  - Export `TriggeringPrecisionWarning` interface: `{ skillA: string; skillB: string; similarity: number; reason: string }`
  - Export `TriggeringPrecisionReport` interface: `{ warnings: TriggeringPrecisionWarning[]; passed: boolean }`
  - Export `validateTriggeringPrecision(skills: Skill[]): TriggeringPrecisionReport`
    - Compares every pair of skill descriptions for ambiguity
    - **Similarity detection strategies:**
      1. **Exact match:** identical descriptions -> warning
      2. **Substring containment:** one description contains the other -> warning
      3. **Token overlap:** shared significant words exceeding threshold -> warning
    - **Token overlap algorithm:**
      - Tokenize descriptions: lowercase, split on whitespace/punctuation, remove stop words (the, a, an, to, for, of, in, on, at, by, with, is, are, was, were, be, been, that, this, it, and, or, but)
      - Compute Jaccard similarity: `|intersection| / |union|`
      - Threshold: similarity >= 0.7 produces a warning
    - Single skill: no overlap possible, report passes with empty warnings
    - Zero skills: report passes with empty warnings
    - Each warning includes: both skill names, similarity score, reason string
  - **Design decision:** This is a heuristic analysis to catch obvious overlap. It does NOT use LLM-based semantic analysis (that would require an API call). The token overlap approach is deterministic and testable.

### Task 6: Write unit tests (AC: 1-6)

Following the test design in `_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.2.

- [x] Create `packages/client/src/agent/__tests__/agent-config-parser.test.ts` (18 tests):
  - Parse full Agent.md fixture -> extract name, personality, skills, budget, logging
  - Parse minimal Agent.md (name + skills only) -> partial config valid, optional fields undefined
  - Parse Agent.md with only `# Agent:` heading and `## Skills` -> valid minimal config
  - Missing H1 heading -> `AgentConfigError` with `MISSING_AGENT_NAME`
  - Missing `## Skills` section -> `AgentConfigError` with `MISSING_SKILLS_SECTION`
  - Empty `## Skills` section (no bullet items) -> `AgentConfigError` with `MISSING_SKILLS_SECTION`
  - Budget format `100 ILP/session` -> parsed correctly (limit=100, unit=ILP, period=session)
  - Budget format `0.05 USD/hour` -> parsed correctly (limit=0.05, unit=USD, period=hour)
  - Invalid budget format `lots of money` -> `AgentConfigError` with `INVALID_BUDGET_FORMAT`
  - Logging with path and level -> parsed correctly
  - Logging with path only (no level) -> defaults to `info`
  - Invalid logging level -> `AgentConfigError` with `INVALID_LOGGING_CONFIG`
  - Unknown sections (e.g., `## Notes`) -> ignored, no error
  - File >1MB -> rejected with `PARSE_ERROR`
  - Duplicate skill references -> `AgentConfigError` with `DUPLICATE_SKILL_REFERENCE`
  - Empty agent name (whitespace only after "Agent:") -> `AgentConfigError` with `MISSING_AGENT_NAME`
  - Logging section without required path key -> `AgentConfigError` with `INVALID_LOGGING_CONFIG`

- [x] Create `packages/client/src/agent/__tests__/skill-resolution.test.ts` (12 tests):
  - Agent.md references 3 skills present in directory -> all resolved, `ResolvedAgentConfig` returned
  - Agent.md references skill not in directory -> `AgentConfigError` with `SKILL_NOT_FOUND`, skill name in `fields`
  - Multiple missing skills -> all listed in error `fields` array
  - Agent does NOT start with partial skill set (fail-fast)
  - Only referenced skills are active in returned `SkillRegistry` (non-referenced skills excluded)
  - `SkillRegistry.size` matches number of referenced skills
  - Skills directory with parse errors for non-referenced files -> resolved config succeeds (non-referenced errors ignored)
  - Skills directory with parse error for a referenced skill -> resolution fails with `SKILL_NOT_FOUND` (parse-failed skill treated as missing)
  - `reloadAgentConfig()` re-reads from disk (fresh parse)
  - Agent.md file not found -> `AgentConfigError` with `PARSE_ERROR`
  - Skills directory not found -> propagated error
  - Empty skill references (filtered) -> `MISSING_SKILLS_SECTION` error

- [x] Create `packages/client/src/agent/__tests__/claude-md-generator.test.ts` (15 tests: 8 original + 7 gap-filling):
  - Valid config -> CLAUDE.md contains agent name in H1
  - Valid config -> CLAUDE.md contains personality section
  - Valid config -> CLAUDE.md contains skill descriptions for each resolved skill
  - Valid config -> CLAUDE.md contains budget info when configured
  - Valid config with no budget -> CLAUDE.md omits budget constraints
  - Valid config -> AGENTS.md generated with same information
  - Generated CLAUDE.md includes MCP tool references in snake_case
  - `generateAgentFiles()` returns both CLAUDE.md and AGENTS.md
  - Valid config -> CLAUDE.md contains Identity, Constraints, Goals, Available Skills, and MCP Tools sections
  - Valid config without personality -> CLAUDE.md uses default identity text
  - Valid config -> CLAUDE.md Available Skills section includes reducer and parameter details
  - Valid config -> CLAUDE.md MCP Tools section lists tools with descriptions
  - Valid config -> AGENTS.md includes skill descriptions for LLM reference
  - Valid config -> AGENTS.md includes personality and budget when configured
  - Valid config -> AGENTS.md contains Tool Mapping section

- [x] Create `packages/client/src/agent/__tests__/triggering-precision.test.ts` (10 tests):
  - Two skills with identical descriptions -> warning with similarity 1.0
  - Two skills with clearly distinct descriptions -> no warning, report passes
  - One description is substring of another -> warning
  - High token overlap (>= 0.7 Jaccard) -> warning
  - Low token overlap (< 0.7 Jaccard) -> no warning
  - Single skill -> no overlap, report passes
  - Zero skills -> report passes, empty warnings
  - Warning includes both skill names and similarity score
  - Three skills, one pair overlapping -> exactly one warning for that pair
  - Stop words excluded from token comparison (descriptions differing only in stop words -> high similarity)

- [x] Create `packages/client/src/agent/__tests__/config-stateless.test.ts` (5 tests):
  _(Uses real temp files via `mkdtempSync`/`writeFileSync` to simulate file changes between calls)_
  - `loadAgentConfig()` reads file from disk each time (no cache)
  - Modify Agent.md between calls -> second call returns updated config
  - Modify skill file between calls -> second call returns updated skill
  - `reloadAgentConfig()` is functionally identical to `loadAgentConfig()` (same result for same inputs)
  - Config does not persist state between load calls

### Task 7: Create test fixtures (AC: 1-4)

- [x] Create Agent.md test fixture files in `packages/client/src/agent/__tests__/fixtures/agents/`:
  - `forager-bot.agent.md` -- full Agent.md with all sections (name, personality, skills, budget, logging)
  - `minimal.agent.md` -- minimal Agent.md (name + skills only)
  - Negative test fixtures as inline strings in test code:
    - `missing-name` content (no H1 heading)
    - `missing-skills` content (no `## Skills` section)
    - `bad-budget` content (invalid budget format)
    - `bad-skill-ref` content (references non-existent skill)
    - `oversized` content (>1MB)

### Task 8: Export public API and update barrel files (AC: 2, 4, 5)

- [x] Update `packages/client/src/agent/index.ts`:
  - Add re-exports for all new types: `AgentConfig`, `ResolvedAgentConfig`, `AgentBudgetConfig`, `AgentLoggingConfig`, `AgentConfigError`, `AgentConfigErrorCode`
  - Add re-exports for functions: `parseAgentConfig`, `loadAgentConfig`, `reloadAgentConfig`
  - Add re-exports for generator: `generateClaudeMd`, `generateAgentsMd`, `generateAgentFiles`, `AgentFileOutput`
  - Add re-exports for precision: `validateTriggeringPrecision`, `TriggeringPrecisionWarning`, `TriggeringPrecisionReport`
- [x] Update `packages/client/src/index.ts`:
  - Add exports for all new public types and functions from the agent module
- [x] Verify build: `pnpm --filter @sigil/client build` -- produces dist/ with all new exports
- [x] Verify regression: `pnpm test` -- all existing tests still pass

## Dev Notes

### Architecture Context

This is the **second story in Epic 4** -- it builds directly on the skill parser from Story 4.1. Agent.md is the user-facing configuration file that ties together skill selection, personality, budget, and logging preferences. The generated CLAUDE.md and AGENTS.md are consumed by AI agent runtimes.

**Key design principle:** Agent.md is a standard markdown file (NOT YAML frontmatter). It uses H1/H2 heading structure that is human-readable and easily editable. This contrasts with SKILL.md files which use YAML frontmatter for machine-parseable metadata.

**Data flow:** Agent.md file -> `parseAgentConfig()` -> `AgentConfig` -> `loadAgentConfig()` combines with skill directory -> `ResolvedAgentConfig` -> consumed by CLAUDE.md generator (this story), validation engine (Story 4.3), budget tracker (Story 4.4), and agent runtime

**Stateless design (NFR25):** Agent.md is re-read from disk on every startup/restart. No caching, no persistent state. Changes take effect immediately on next agent initialization.

### Agent.md File Format

**Standard structure:**

```markdown
# Agent: Forager Bot

## Personality
A careful resource-gathering agent that prioritizes efficiency and safety.

## Skills
- player_move
- harvest_resource
- craft_item

## Budget
100 ILP/session

## Logging
- path: ./logs/forager-decisions.jsonl
- level: debug
```

**Required sections:**
- `# Agent: <name>` -- H1 heading with agent name
- `## Skills` -- bullet list of skill names (must reference existing SKILL.md files by `name` field)

**Optional sections:**
- `## Personality` -- freeform text for agent identity/behavior guidance
- `## Budget` -- format: `<amount> <unit>/<period>`
- `## Logging` -- key-value pairs for decision log configuration

**Forward compatibility:** Unknown sections (e.g., `## Notes`, `## Custom`) are silently ignored. This allows researchers to add custom documentation alongside the configuration.

### Parsing Strategy

Agent.md uses standard markdown, parsed via heading-based section splitting:

1. Split content on regex `/^(#{1,2})\s+(.+)$/m`
2. H1 heading (`# Agent: <name>`) extracts agent name
3. Each H2 heading (`## Skills`, `## Budget`, etc.) starts a section
4. Section body = everything between this heading and the next heading
5. Each section parser handles its own format (bullet lists, key-value, freeform text)

**Why NOT use gray-matter (YAML frontmatter)?** Agent.md is a human-authored document meant to be easily editable by researchers. Markdown with headings is more intuitive than YAML frontmatter for this use case. Skill files use frontmatter because they need machine-parseable metadata with strict typing.

### Skill Reference Resolution

**Flow:**
1. Parse Agent.md -> extract `skillNames` array
2. Load skill directory -> get all available skills (`loadSkillDirectory()`)
3. For each referenced skill name, look up in loaded skills by `name` field
4. If any referenced skill is missing -> fail-fast with all missing names listed
5. Build filtered `SkillRegistry` with only the referenced skills

**Fail-fast guarantee (AC3):** The agent NEVER starts with a partial skill set. If any referenced skill is missing, the entire configuration load fails. This prevents runtime failures where an agent tries to use a skill that was never loaded.

### Triggering Precision Analysis

**Purpose:** Detect overlapping skill descriptions that could confuse the LLM during skill selection. If two skills have very similar descriptions, the LLM may trigger the wrong one.

**Algorithm:** Deterministic token-overlap (Jaccard similarity) -- not LLM-based. This gives consistent, testable results without requiring API calls.

**Threshold:** Jaccard similarity >= 0.7 triggers a warning. This is a heuristic that catches obvious overlap while allowing skills with some shared vocabulary.

**Stop words removed:** "the", "a", "an", "to", "for", "of", "in", "on", "at", "by", "with", "is", "are", "was", "were", "be", "been", "that", "this", "it", "and", "or", "but"

### New Module Location

All new code goes in `packages/client/src/agent/` (extending Story 4.1):

```
packages/client/src/agent/
  types.ts                    # (Story 4.1 -- unchanged)
  skill-parser.ts             # (Story 4.1 -- unchanged)
  skill-loader.ts             # (Story 4.1 -- unchanged)
  skill-registry.ts           # (Story 4.1 -- unchanged)
  agent-config-types.ts       # NEW: AgentConfig, ResolvedAgentConfig, AgentConfigError
  agent-config-parser.ts      # NEW: parseAgentConfig()
  agent-config-loader.ts      # NEW: loadAgentConfig(), reloadAgentConfig()
  agent-file-generator.ts     # NEW: generateClaudeMd(), generateAgentsMd()
  triggering-precision.ts     # NEW: validateTriggeringPrecision()
  index.ts                    # Updated: re-exports for new modules
  __tests__/
    skill-parser.test.ts      # (Story 4.1 -- unchanged)
    skill-validation.test.ts  # (Story 4.1 -- unchanged)
    skill-eval-parser.test.ts # (Story 4.1 -- unchanged)
    skill-loader.test.ts      # (Story 4.1 -- unchanged)
    skill-registry.test.ts    # (Story 4.1 -- unchanged)
    skill-progressive.test.ts # (Story 4.1 -- unchanged)
    agent-config-parser.test.ts      # NEW: 17 tests
    skill-resolution.test.ts         # NEW: 12 tests
    claude-md-generator.test.ts      # NEW: 8 tests
    triggering-precision.test.ts     # NEW: 10 tests
    config-stateless.test.ts         # NEW: 5 tests
    fixtures/
      skills/                        # (Story 4.1 -- existing)
        player-move.skill.md
        harvest-resource.skill.md
        craft-item.skill.md
      agents/                        # NEW: Agent.md fixtures
        forager-bot.agent.md
        minimal.agent.md
```

### Project Structure Notes

- Follows monorepo conventions: kebab-case file names, co-located tests in `__tests__/`, vitest
- New files extend the existing `src/agent/` directory (Story 4.1 foundation)
- Barrel `src/agent/index.ts` gets new re-exports for all new types and functions
- Main `src/index.ts` gets new export lines for agent config module
- No changes to `packages/bitcraft-bls/` -- this is client-side only
- No changes to Story 4.1 source files (only additions + barrel export updates)
- Agent.md fixture files use `.agent.md` extension for test discoverability

### Error Patterns

Follow the same pattern as `SkillParseError` from Story 4.1:
- Error class extends `Error` with typed `code: string` and `filePath: string`
- Error codes are string union types for programmatic handling
- Error messages include the file path and specific field information
- Consistent with `ContentParseError` (Story 3.2) and `FeeScheduleError` (Story 3.3)

### Previous Story Intelligence (from Story 4.1)

Key patterns and decisions from Story 4.1 that MUST be followed:

1. **File naming:** kebab-case (e.g., `agent-config-parser.ts`, not `agentConfigParser.ts`)
2. **Import extensions:** `.js` suffix for all local imports (ESM compatibility with tsup)
3. **No `any` types:** Use `unknown` or specific types (project convention since Epic 1)
4. **Error classes:** Extend `Error` with typed `code` field and `filePath` field (pattern from Stories 3.2, 3.3, 4.1)
5. **Barrel exports:** `index.ts` per module for public API surface
6. **Co-located tests:** `__tests__/` directory adjacent to source, vitest framework
7. **Test factories:** Create factory functions for test data (pattern from `packages/client/src/__tests__/factories/`)
8. **Commit format:** `feat(4-2): ...` for implementation
9. **gray-matter already installed:** Do NOT reinstall; it is already a dependency of `@sigil/client`
10. **File size validation:** Check content size before parsing (OWASP A03 pattern from Story 4.1)
11. **vitest globals:true:** Tests use vitest globals (`describe`, `it`, `expect` without import) -- avoid naming conflicts with gray-matter's `test()` function
12. **macOS symlink handling:** Use `realpath()` for directory comparisons (Story 4.1 debug learning)

### Security Considerations (OWASP Top 10)

**A03: Injection (MEDIUM relevance)**
- Agent.md content: parsed as plain markdown (no code execution risk)
- Budget format: validated via regex, no eval or dynamic code
- Logging path: stored as string, validated for path traversal at resolution time (not at parse time in this story)
- Skill names: validated against loaded skills (no arbitrary code paths)
- File content size limit: reject Agent.md >1MB (DoS prevention)

**A04: Insecure Design (LOW relevance)**
- All code paths return explicit success or error; no silent failures
- Fail-fast on missing skills prevents partial configuration states

**A05: Security Misconfiguration (LOW relevance)**
- Generated CLAUDE.md/AGENTS.md contains only skill metadata, no secrets
- Logging path is a user-specified path -- consumer code must validate it

**Other OWASP categories:**
- A01 (Access Control): N/A -- no auth boundaries in agent config
- A02 (Cryptographic Failures): N/A -- no crypto in this story
- A06 (Vulnerable Components): No new dependencies (gray-matter already installed and audited in Story 4.1)
- A09 (Security Logging): Config parse errors include file path for debugging

### FR/NFR Traceability

| Requirement | Coverage | Notes |
| --- | --- | --- |
| FR11 (Agent.md zero-code config) | AC1, AC6 | Full Agent.md parsing with stateless re-read |
| FR12 (Skill selection via Agent.md) | AC2, AC3 | Skill reference resolution from directory, fail-fast on missing |
| NFR21 (Uniform format for all frontends) | AC4 | CLAUDE.md + AGENTS.md generated from same `ResolvedAgentConfig` |
| NFR25 (Stateless config, re-read on startup) | AC6 | Agent.md re-read from disk, no caching |

### Test Design Reference

The comprehensive test design is documented in:
`_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.2

Target: ~60 unit tests across 5 test files. No integration tests required for this story (pure file parsing and config resolution).

**Test file mapping to test design document (Section 2.2):**
- `agent-config-parser.test.ts` (18) -- maps to test design "agent-config-parser.test.ts" (15) + 2 added by test review + 1 CRLF test added by code review #3
- `skill-resolution.test.ts` (12) -- maps to test design "skill-resolution.test.ts" (12)
- `claude-md-generator.test.ts` (8) -- maps to test design "claude-md-generator.test.ts" (8)
- `triggering-precision.test.ts` (10) -- maps to test design "triggering-precision.test.ts" (10)
- `config-stateless.test.ts` (5) -- maps to test design "config-stateless.test.ts" (5)

### Git Intelligence

Recent commit pattern: `feat(X-Y): story complete` where X is epic number, Y is story number.
For this story: `feat(4-2): story complete`

Epic 4 branch: `epic-4` (current branch).

Most recent commits:
- `a82e0e3 feat(4-1): story complete`
- `de7cc35 chore(epic-4): epic start -- baseline green, retro actions resolved`

### References

- Epic 4 definition: `_bmad-output/planning-artifacts/epics.md` (Story 4.2 details: lines 910-946)
- Story 4.1 (predecessor): `_bmad-output/implementation-artifacts/4-1-skill-file-format-and-parser.md`
- Test design: `_bmad-output/planning-artifacts/test-design-epic-4.md` (Section 2.2)
- Agent.md test fixtures: `_bmad-output/planning-artifacts/test-design-epic-4.md` (Section 8.2)
- SKILL.md schema: `_bmad-output/planning-artifacts/skill-file-examples/SCHEMA.md`
- Prototype skill files: `packages/client/src/agent/__tests__/fixtures/skills/*.skill.md`
- Agent core loop architecture: `_bmad-output/planning-artifacts/architecture/6-agent-core-loop.md`
- Agent config architecture: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#agent-configuration-architecture`
- Project structure boundaries: `_bmad-output/planning-artifacts/architecture/project-structure-boundaries.md`
- Implementation patterns: `_bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md`
- Project context: `_bmad-output/project-context.md`
- Client package index: `packages/client/src/index.ts`
- Agent module barrel: `packages/client/src/agent/index.ts`
- Existing agent types: `packages/client/src/agent/types.ts`
- Existing skill registry: `packages/client/src/agent/skill-registry.ts`
- Existing skill loader: `packages/client/src/agent/skill-loader.ts`

### Verification Steps

1. `pnpm --filter @sigil/client build` -- produces dist/ with all new agent config exports
2. `pnpm --filter @sigil/client test:unit` -- all new tests pass (~50 new + ~728 existing)
3. `pnpm test` -- all existing tests still pass (regression check)
4. Full Agent.md fixture parses correctly (golden-path validation)
5. Minimal Agent.md fixture parses correctly (optional sections omitted)
6. Missing skills produce clear, actionable errors listing all missing names
7. CLAUDE.md generated with correct structure and skill descriptions
8. Triggering precision detects overlapping descriptions
9. Config re-read from disk on each call (stateless validation)

## Implementation Constraints

1. No new npm dependencies -- `gray-matter` already installed from Story 4.1 (but not used for Agent.md; Agent.md is plain markdown)
2. No `any` types -- use `unknown` or specific types (project convention)
3. All new files follow kebab-case naming convention
4. All new tests use vitest framework (co-located `__tests__/` directory)
5. Import extensions: use `.js` suffix for all local imports (ESM compatibility)
6. Barrel exports: update `src/agent/index.ts` + `src/index.ts` for public API
7. File content size limit: reject Agent.md >1MB (OWASP A03 DoS prevention)
8. Agent.md is NOT YAML frontmatter -- parsed as standard markdown with heading sections
9. Error class pattern: extend `Error` with `code: string` + `filePath: string` (consistent with Story 4.1)
10. Stateless: no caching of Agent.md between loads (NFR25)
11. No Docker required -- pure file parsing
12. Fail-fast on missing skills -- no partial skill sets allowed

## CRITICAL Anti-Patterns (MUST AVOID)

- Do NOT use gray-matter/YAML frontmatter for Agent.md -- it is standard markdown parsed by heading sections
- Do NOT cache Agent.md content between loads -- it must be re-read from disk each time (NFR25 stateless)
- Do NOT allow partial skill sets -- if any referenced skill is missing, the entire load fails (AC3)
- Do NOT add runtime validation against SpacetimeDB in this story -- that is Story 4.3
- Do NOT implement budget tracking logic in this story -- that is Story 4.4; this story only PARSES the budget config
- Do NOT implement decision logging in this story -- that is Story 4.6; this story only PARSES the logging config
- Do NOT create a new package -- all code goes in `packages/client/src/agent/`
- Do NOT use `fs.readFileSync` -- all file I/O must be async (`fs/promises`)
- Do NOT use `any` type -- use `unknown` for dynamic values, then validate and cast
- Do NOT modify Story 4.1 source files -- only add new files and update barrel exports
- Do NOT include ILP cost fields in `AgentConfig` -- costs come from `ActionCostRegistry` (Story 2.2), not Agent.md configuration
- Do NOT implement LLM-based semantic analysis for triggering precision -- use deterministic token overlap (Jaccard similarity)
- Do NOT write CLAUDE.md/AGENTS.md files to disk in this story -- only generate content as strings; file writing is the consumer's responsibility
- Do NOT validate the logging path for security (path traversal) at parse time -- the logging path is stored as-is; consumers validate it when opening the file (Story 4.6)

## Definition of Done

- [x] `AgentConfig`, `ResolvedAgentConfig`, and related types defined
- [x] `parseAgentConfig()` correctly parses full and minimal Agent.md files
- [x] `loadAgentConfig()` resolves skill references from skill directory
- [x] Missing skills produce fail-fast error listing all missing names
- [x] `generateClaudeMd()` produces valid CLAUDE.md with personality, skills, and MCP refs
- [x] `generateAgentsMd()` produces equivalent AGENTS.md for non-Claude agents
- [x] `validateTriggeringPrecision()` detects overlapping skill descriptions
- [x] Stateless: Agent.md re-read from disk on each call (no caching)
- [x] Public API exported from `packages/client/src/index.ts`
- [x] Unit tests pass: `pnpm --filter @sigil/client test:unit` (60 Story 4.2 tests + 731 existing = 791 passing)
- [x] Build passes: `pnpm --filter @sigil/client build` (ESM + CJS + DTS)
- [x] Full regression: `pnpm test` (1015 tests passing, 183 skipped)
- [x] No `any` types in new code
- [x] Security: file size limit (1MB), no code execution from parsed content
- [x] OWASP Top 10 review completed (A03 injection, A04 insecure design)

## Change Log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-03-14 | Initial story creation | Epic 4 Story 4.2 spec |
| 2026-03-14 | Adversarial review fixes (10 issues) | BMAD standards compliance |
| 2026-03-14 | Implementation complete (GREEN phase) | All 50 tests passing, build succeeds, full regression green |
| 2026-03-14 | Test review fixes (3 issues) | Anti-pattern fix, 2 new edge case tests, test count 50->59 |
| 2026-03-14 | Code review fixes (6 issues: 0 critical, 1 high, 3 medium, 2 low) | File List accuracy, test count doc, config-stateless description |
| 2026-03-14 | Code review #2 fixes (4 issues: 0 critical, 0 high, 2 medium, 2 low) | DoD test count, dead code removal, MCP tool name hardening |
| 2026-03-14 | Code review #3 fixes (5 issues: 0 critical, 0 high, 3 medium, 2 low) | CRLF handling, File List accuracy, defensive guard |

## Code Review Record

| Review Pass | Date | Reviewer | Issues Found | Issues Fixed | Notes |
| --- | --- | --- | --- | --- | --- |
| Adversarial Review | 2026-03-14 | Claude Opus 4.6 | 10 | 10 | See review findings below |
| Test Architecture Review | 2026-03-14 | Claude Opus 4.6 | 3 | 3 | Anti-pattern fix + 2 edge case tests |
| Code Review | 2026-03-14 | Claude Opus 4.6 | 6 | 6 | 0 critical, 1 high, 3 medium, 2 low -- all documentation fixes |
| Code Review #2 | 2026-03-14 | Claude Opus 4.6 | 4 | 4 | 0 critical, 0 high, 2 medium, 2 low -- code + documentation fixes |
| Code Review #3 | 2026-03-14 | Claude Opus 4.6 | 5 | 5 | 0 critical, 0 high, 3 medium, 2 low -- CRLF fix, File List accuracy, defensive guard |

### Review Findings (2026-03-14)

1. Added structured validation metadata HTML comment block (BMAD standard from Story 4.1)
2. Added NFR21 tag to AC4 (CLAUDE.md/AGENTS.md generation for uniform consumption maps to NFR21)
3. Clarified Task 2 budget parsing: added explicit trimming step before regex application (section body may contain blank lines)
4. Fixed Task 3 error handling for non-referenced skill parse errors: errors for non-referenced skills are now explicitly ignored, not propagated (aligns with test case "Skills directory with parse errors for non-referenced files -> resolved config succeeds")
5. Reordered FR/NFR Traceability table: NFR21 before NFR25 for logical grouping
6. Updated skill resolution test descriptions to match corrected error handling (parse-failed referenced skill treated as missing)
7. Added mock strategy note to `config-stateless.test.ts` description (vi.mock for fs/promises)
8. Added Change Log entry for adversarial review fixes (BMAD standard)
9. Added Code Review Record entry with review findings section (BMAD standard from Story 4.1)
10. Updated Dev Agent Record template to match Story 4.1 format (agent model placeholder)

### Code Review Findings (2026-03-14)

1. **[HIGH] File List claims Story 4.1 files "unchanged" but git shows formatting changes** -- 9 Story 4.1 files (types.ts, skill-parser.ts, skill-loader.ts, and 6 test files) were reformatted by Prettier during Story 4.2 implementation. Updated File List to document these as "reformatted (whitespace-only)" instead of claiming "unchanged". No functional changes, only line-wrapping style differences.
2. **[MEDIUM] Task 6 test count mismatch for claude-md-generator.test.ts** -- Task description claimed 8 tests, actual file has 15 (8 original + 7 gap-filling added during test review). Updated Task 6 description to reflect actual count of 15.
3. **[MEDIUM] File List missing 9 Story 4.1 files changed in git** -- Added 9 reformatted Story 4.1 files to the File List under a separate section marked as formatting-only changes.
4. **[MEDIUM] Task 6 inconsistent test count for claude-md-generator but total was correct** -- The overall "59 tests" claim was correct, but the per-file breakdown was misleading with 8 vs actual 15. Fixed individual count.
5. **[LOW] config-stateless.test.ts Task 6 description says vi.mock but implementation uses real temp files** -- Updated the mock strategy note from `vi.mock('node:fs/promises')` to `Uses real temp files via mkdtempSync/writeFileSync`, matching the actual implementation which is a better approach for testing stateless behavior.
6. **[LOW] File List previously said "unskipped 8 tests" for claude-md-generator** -- Updated to "unskipped 15 tests" to match actual file contents.

### Code Review #2 Findings (2026-03-14)

1. **[MEDIUM] DoD total test count outdated (1005 vs actual 1014)** -- The DoD line "Full regression: pnpm test (1005 tests passing)" was not updated after the test review pass added 9 tests (2 edge case + 7 gap-filling). Updated to 1014.
2. **[MEDIUM] Dead code in `jaccardSimilarity` function** -- `triggering-precision.ts` line 105 had a redundant `unionSize === 0` check that could never be reached because the earlier `setA.size === 0 && setB.size === 0` check already handles the only case where `unionSize` is 0. Removed dead code path.
3. **[LOW] `toMcpToolName` could produce consecutive underscores** -- The function `toMcpToolName` in `agent-file-generator.ts` replaced non-alphanumeric characters with underscores but didn't collapse consecutive underscores or trim leading/trailing underscores. While skill names are already validated as snake_case (making this a theoretical-only issue), added `.replace(/_+/g, '_').replace(/^_|_$/g, '')` for defensive robustness.
4. **[LOW] Verified claims: Story claims 59 tests, 790 client tests, build passes** -- All verified correct. 17+12+15+10+5=59 Story 4.2 tests. 790 client unit tests passing. Build produces ESM+CJS+DTS. All 6 ACs implemented and tested. All 8 tasks marked [x] are actually done.

### Code Review #3 Findings (2026-03-14)

1. **[MEDIUM] CRLF line ending handling in agent-config-parser.ts** -- The H1 and H2 heading regexes (`/^#\s+Agent:\s*(.+)$/` and `/^##\s+(.+)$/`) failed when content used Windows-style `\r\n` line endings. When splitting on `\n`, trailing `\r` characters caused the `$` anchor to fail. Added `content.replace(/\r\n/g, '\n')` normalization at the start of `parseAgentConfig()`. Added a new test case for CRLF handling.
2. **[MEDIUM] File List claims `packages/client/src/agent/index.ts` is "unchanged" but git shows modifications** -- The barrel file was reorganized (comments changed from generic to "Story 4.1" labels) and 29 new export lines were added for Story 4.2 types/functions. Updated File List to say "modified".
3. **[MEDIUM] File List claims `packages/client/src/index.ts` is "unchanged" but git shows 25 new lines** -- Story 4.2 exports (AgentConfig types, parseAgentConfig, loadAgentConfig, generator functions, triggering precision) were added. Updated File List to say "modified".
4. **[LOW] File List claims `packages/client/src/agent/agent-config-types.ts` is "unchanged (RED phase stub was complete)" but git shows new file creation** -- A newly created file cannot be "unchanged" -- it was created during the RED phase. Updated File List to say "created (RED phase)".
5. **[LOW] Non-null assertion (`!`) in agent-config-loader.ts line 74** -- `allSkills.get(skillName)!` was safe because the preceding `has()` check loop verified all names exist, but the non-null assertion could mask bugs introduced by future refactoring. Replaced with a proper undefined check and defensive `AgentConfigError` throw that should never be reached.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Triggering precision test fix: Test case "high token overlap" had test fixture descriptions with Jaccard similarity 0.6 (below 0.7 threshold). Adjusted fixture descriptions to achieve 0.83 similarity by increasing shared tokens.

### Completion Notes List

- **Task 1 (Types):** `AgentBudgetConfig`, `AgentLoggingConfig`, `AgentConfig`, `ResolvedAgentConfig`, `AgentConfigError`, `AgentConfigErrorCode` already defined in RED phase stub `agent-config-types.ts`. No changes needed.
- **Task 2 (Parser):** Implemented `parseAgentConfig()` in `agent-config-parser.ts` with heading-based section splitting. Extracts name from H1 `# Agent: <name>`, splits on H2 headings, parses Skills (bullet list), Budget (regex), Logging (key-value pairs), Personality (freeform text). Enforces 1MB size limit (OWASP A03). Unknown sections silently ignored.
- **Task 3 (Loader):** Implemented `loadAgentConfig()` and `reloadAgentConfig()` in `agent-config-loader.ts`. Reads Agent.md from disk via `fs/promises.readFile`, parses via `parseAgentConfig()`, loads skills via `loadSkillDirectory()`, resolves references with fail-fast on missing skills, builds filtered `SkillRegistry`. Stateless -- no caching (NFR25).
- **Task 4 (Generator):** Implemented `generateClaudeMd()`, `generateAgentsMd()`, and `generateAgentFiles()` in `agent-file-generator.ts`. CLAUDE.md includes Identity, Constraints, Goals, Available Skills, and MCP Tools sections. AGENTS.md uses Agent Info, Skills, and Tool Mapping sections. MCP tool names in snake_case per project convention.
- **Task 5 (Triggering Precision):** Implemented `validateTriggeringPrecision()` in `triggering-precision.ts`. Uses three detection strategies: exact match, substring containment, Jaccard similarity (threshold >= 0.7). Stop words removed before tokenization. Deterministic and testable (no LLM calls).
- **Task 6 (Tests):** Unskipped all 50 tests across 5 test files. Fixed 1 test fixture (high token overlap description pair had Jaccard 0.6, adjusted to 0.83). All 50 tests passing.
- **Task 7 (Fixtures):** Agent.md fixture files (`forager-bot.agent.md`, `minimal.agent.md`) already created in RED phase. No changes needed.
- **Task 8 (Exports):** Barrel exports in `agent/index.ts` and `src/index.ts` already updated in RED phase. Build produces dist/ with all new exports. Verified with `pnpm --filter @sigil/client build`.

### File List

**New/Modified (Story 4.2 implementation):**
- `packages/client/src/agent/agent-config-types.ts` -- created (RED phase, all types defined)
- `packages/client/src/agent/agent-config-parser.ts` -- modified (implemented parseAgentConfig, added CRLF normalization)
- `packages/client/src/agent/agent-config-loader.ts` -- modified (implemented loadAgentConfig, reloadAgentConfig, defensive guard)
- `packages/client/src/agent/agent-file-generator.ts` -- modified (implemented generateClaudeMd, generateAgentsMd, generateAgentFiles)
- `packages/client/src/agent/triggering-precision.ts` -- modified (implemented validateTriggeringPrecision)
- `packages/client/src/agent/index.ts` -- modified (reorganized comments, added Story 4.2 re-exports)
- `packages/client/src/index.ts` -- modified (added Story 4.2 public API exports)
- `packages/client/src/agent/__tests__/agent-config-parser.test.ts` -- modified (unskipped 17 tests, added 1 CRLF test = 18 total)
- `packages/client/src/agent/__tests__/skill-resolution.test.ts` -- modified (unskipped 12 tests)
- `packages/client/src/agent/__tests__/claude-md-generator.test.ts` -- modified (unskipped 15 tests: 8 original + 7 gap-filling)
- `packages/client/src/agent/__tests__/triggering-precision.test.ts` -- modified (unskipped 10 tests, fixed 1 test fixture)
- `packages/client/src/agent/__tests__/config-stateless.test.ts` -- modified (unskipped 5 tests)
- `packages/client/src/agent/__tests__/fixtures/agents/forager-bot.agent.md` -- unchanged (RED phase fixture)
- `packages/client/src/agent/__tests__/fixtures/agents/minimal.agent.md` -- unchanged (RED phase fixture)

**Story 4.1 files (formatting-only changes from Prettier auto-format, no functional changes):**
- `packages/client/src/agent/types.ts` -- reformatted (whitespace-only)
- `packages/client/src/agent/skill-parser.ts` -- reformatted (whitespace-only)
- `packages/client/src/agent/skill-loader.ts` -- reformatted (whitespace-only)
- `packages/client/src/agent/__tests__/skill-parser.test.ts` -- reformatted (whitespace-only)
- `packages/client/src/agent/__tests__/skill-validation.test.ts` -- reformatted (whitespace-only)
- `packages/client/src/agent/__tests__/skill-eval-parser.test.ts` -- reformatted (whitespace-only)
- `packages/client/src/agent/__tests__/skill-loader.test.ts` -- reformatted (whitespace-only)
- `packages/client/src/agent/__tests__/skill-registry.test.ts` -- reformatted (whitespace-only)
- `packages/client/src/agent/__tests__/skill-progressive.test.ts` -- reformatted (whitespace-only)
- `_bmad-output/implementation-artifacts/4-2-agent-md-configuration-and-skill-selection.md` -- modified (Dev Agent Record, DoD, Change Log)
