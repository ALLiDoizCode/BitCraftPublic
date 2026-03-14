---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-14'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-2-agent-md-configuration-and-skill-selection.md'
  - '_bmad-output/test-artifacts/atdd-checklist-4-1.md'
  - 'packages/client/src/agent/types.ts'
  - 'packages/client/src/agent/skill-parser.ts'
  - 'packages/client/src/agent/skill-loader.ts'
  - 'packages/client/src/agent/skill-registry.ts'
  - 'packages/client/src/agent/index.ts'
  - 'packages/client/src/index.ts'
  - 'packages/client/vitest.config.ts'
---

# ATDD Checklist - Epic 4, Story 4.2: Agent.md Configuration & Skill Selection

**Date:** 2026-03-14
**Author:** TEA Agent (ATDD workflow)
**Agent Model:** Claude Opus 4.6 (claude-opus-4-6)
**Primary Test Level:** Unit (backend, vitest)
**Total Tests Generated:** 50 (15 + 12 + 8 + 10 + 5)
**RED Phase Status:** All unit tests skipped with `it.skip()` -- stub modules created for parser, loader, generator, triggering precision

---

## Story Summary

Story 4.2 builds on the skill parser foundation from Story 4.1 to add **Agent.md configuration parsing and skill selection**. Agent.md is a human-readable markdown file (NOT YAML frontmatter) that defines agent behavior: name, personality, selected skills, budget limits, and logging preferences. The story also produces CLAUDE.md/AGENTS.md generators for AI agent runtimes and a triggering precision validator to detect overlapping skill descriptions.

**As a** researcher,
**I want** to define agent behavior entirely through an Agent.md configuration file,
**So that** I can create and modify agents without writing any application code.

---

## Acceptance Criteria

1. **AC1 - Agent.md section extraction** (FR11): Parse Agent.md extracting agent name, personality, selected skill references, budget limit, logging preferences. Missing optional sections do not cause errors.

2. **AC2 - Skill reference resolution** (FR12): Referenced skills resolved from skills directory. Only selected skills are active for that agent.

3. **AC3 - Missing skill fail-fast**: Non-existent skill reference produces clear error identifying the missing skill. Agent does not start with partial skill set. Multiple missing skills all listed in error.

4. **AC4 - CLAUDE.md / AGENTS.md generation** (NFR21): CLAUDE.md generated for Claude agents, AGENTS.md for non-Claude agents. Both include personality, constraints, goals, and skill descriptions.

5. **AC5 - Triggering precision validation**: Skill descriptions analyzed for ambiguity. Overlapping descriptions produce warnings.

6. **AC6 - Stateless configuration** (NFR25): Agent.md re-read from disk on restart. Changes take effect on next startup.

---

## Preflight Summary

**Stack detected:** backend (Node.js + TypeScript + vitest)
**Test framework:** vitest (configured in packages/client/vitest.config.ts, globals: true)
**Existing patterns:** Story 4.1 tests in packages/client/src/agent/__tests__/ (76 tests, 6 files)
**Knowledge loaded:** data-factories, test-quality, test-levels-framework
**E2E/Playwright:** Not applicable (backend-only story, no UI)
**New dependencies:** None (gray-matter already installed from Story 4.1, but NOT used for Agent.md)

---

## Test Strategy - AC to Test Level Mapping

| AC | Test Level | Test File | Test Count | Priority |
|----|-----------|-----------|------------|----------|
| AC1 | Unit | agent-config-parser.test.ts | 15 | P0 |
| AC2, AC3, AC6 | Unit | skill-resolution.test.ts | 12 | P0 |
| AC4 | Unit | claude-md-generator.test.ts | 8 | P0 |
| AC5 | Unit | triggering-precision.test.ts | 10 | P0 |
| AC6 | Unit | config-stateless.test.ts | 5 | P0 |

---

## Test Files Created

### 1. `packages/client/src/agent/__tests__/agent-config-parser.test.ts` (15 tests)

**Covers:** AC1
**Tests:**

- `parses full Agent.md fixture -> extracts name, personality, skills, budget, logging`
- `parses minimal Agent.md (name + skills only) -> partial config valid, optional fields undefined`
- `parses Agent.md with only # Agent: heading and ## Skills -> valid minimal config`
- `unknown sections (e.g., ## Notes) -> ignored, no error`
- `missing H1 heading -> AgentConfigError with MISSING_AGENT_NAME`
- `missing ## Skills section -> AgentConfigError with MISSING_SKILLS_SECTION`
- `empty ## Skills section (no bullet items) -> AgentConfigError with MISSING_SKILLS_SECTION`
- `duplicate skill references -> AgentConfigError with DUPLICATE_SKILL_REFERENCE`
- `budget format 100 ILP/session -> parsed correctly (limit=100, unit=ILP, period=session)`
- `budget format 0.05 USD/hour -> parsed correctly (limit=0.05, unit=USD, period=hour)`
- `invalid budget format "lots of money" -> AgentConfigError with INVALID_BUDGET_FORMAT`
- `logging with path and level -> parsed correctly`
- `logging with path only (no level) -> defaults to info`
- `invalid logging level -> AgentConfigError with INVALID_LOGGING_CONFIG`
- `file >1MB -> rejected with PARSE_ERROR`

### 2. `packages/client/src/agent/__tests__/skill-resolution.test.ts` (12 tests)

**Covers:** AC2, AC3, AC6
**Tests:**

- `Agent.md references 3 skills present in directory -> all resolved, ResolvedAgentConfig returned`
- `only referenced skills are active in returned SkillRegistry (non-referenced skills excluded)`
- `SkillRegistry.size matches number of referenced skills`
- `Agent.md references skill not in directory -> AgentConfigError with SKILL_NOT_FOUND, skill name in fields`
- `multiple missing skills -> all listed in error fields array`
- `agent does NOT start with partial skill set (fail-fast)`
- `skills directory with parse errors for non-referenced files -> resolved config succeeds`
- `skills directory with parse error for a referenced skill -> resolution fails with SKILL_NOT_FOUND`
- `reloadAgentConfig() re-reads from disk (fresh parse)`
- `Agent.md file not found -> AgentConfigError with PARSE_ERROR`
- `skills directory not found -> propagated error`
- `empty skill references (filtered) -> MISSING_SKILLS_SECTION error`

### 3. `packages/client/src/agent/__tests__/claude-md-generator.test.ts` (8 tests)

**Covers:** AC4
**Tests:**

- `valid config -> CLAUDE.md contains agent name in H1`
- `valid config -> CLAUDE.md contains personality section`
- `valid config -> CLAUDE.md contains skill descriptions for each resolved skill`
- `valid config -> CLAUDE.md contains budget info when configured`
- `valid config with no budget -> CLAUDE.md omits budget constraints`
- `generated CLAUDE.md includes MCP tool references in snake_case`
- `valid config -> AGENTS.md generated with same information`
- `generateAgentFiles() returns both CLAUDE.md and AGENTS.md`

### 4. `packages/client/src/agent/__tests__/triggering-precision.test.ts` (10 tests)

**Covers:** AC5
**Tests:**

- `two skills with identical descriptions -> warning with similarity 1.0`
- `two skills with clearly distinct descriptions -> no warning, report passes`
- `one description is substring of another -> warning`
- `high token overlap (>= 0.7 Jaccard) -> warning`
- `low token overlap (< 0.7 Jaccard) -> no warning`
- `single skill -> no overlap, report passes`
- `zero skills -> report passes, empty warnings`
- `warning includes both skill names and similarity score`
- `three skills, one pair overlapping -> exactly one warning for that pair`
- `stop words excluded from token comparison (descriptions differing only in stop words -> high similarity)`

### 5. `packages/client/src/agent/__tests__/config-stateless.test.ts` (5 tests)

**Covers:** AC6
**Tests:**

- `loadAgentConfig() reads file from disk each time (no cache)`
- `modify Agent.md between calls -> second call returns updated config`
- `modify skill file between calls -> second call returns updated skill`
- `reloadAgentConfig() is functionally identical to loadAgentConfig() (same result for same inputs)`
- `config does not persist state between load calls`

---

## Stub Modules Created

### `packages/client/src/agent/agent-config-types.ts`

**Purpose:** Full type definitions (not stubs) -- types are final.
**Contents:**

- `AgentBudgetConfig` interface (limit, unit, period, raw)
- `AgentLoggingConfig` interface (path, level)
- `AgentConfig` interface (name, personality?, skillNames, budget?, logging?)
- `ResolvedAgentConfig` interface (extends AgentConfig + skills, skillRegistry)
- `AgentConfigErrorCode` type (7 error codes)
- `AgentConfigError` class (extends Error, code, filePath, fields?)

### `packages/client/src/agent/agent-config-parser.ts`

**Purpose:** TDD RED phase stub -- function signature that throws NOT_IMPLEMENTED.
**Contents:**

- `parseAgentConfig()` function -- throws `NOT_IMPLEMENTED`

### `packages/client/src/agent/agent-config-loader.ts`

**Purpose:** TDD RED phase stub -- function signatures that throw NOT_IMPLEMENTED.
**Contents:**

- `loadAgentConfig()` function -- throws `NOT_IMPLEMENTED`
- `reloadAgentConfig()` function -- throws `NOT_IMPLEMENTED`

### `packages/client/src/agent/agent-file-generator.ts`

**Purpose:** TDD RED phase stub -- function signatures that throw NOT_IMPLEMENTED.
**Contents:**

- `AgentFileOutput` interface (claudeMd, agentsMd)
- `generateClaudeMd()` function -- throws `NOT_IMPLEMENTED`
- `generateAgentsMd()` function -- throws `NOT_IMPLEMENTED`
- `generateAgentFiles()` function -- throws `NOT_IMPLEMENTED`

### `packages/client/src/agent/triggering-precision.ts`

**Purpose:** TDD RED phase stub -- function signature that throws NOT_IMPLEMENTED.
**Contents:**

- `TriggeringPrecisionWarning` interface (skillA, skillB, similarity, reason)
- `TriggeringPrecisionReport` interface (warnings, passed)
- `validateTriggeringPrecision()` function -- throws `NOT_IMPLEMENTED`

---

## Test Fixtures

### Agent.md Fixture Files

- `packages/client/src/agent/__tests__/fixtures/agents/forager-bot.agent.md` -- full Agent.md with all sections (name, personality, 3 skills, budget, logging)
- `packages/client/src/agent/__tests__/fixtures/agents/minimal.agent.md` -- minimal Agent.md (name + 1 skill only)

### Synthetic Fixtures (inline in test code)

- Missing `# Agent:` heading (no H1)
- Missing `## Skills` section
- Empty `## Skills` section (no bullet items)
- Duplicate skill references
- Invalid budget format (`lots of money`)
- Budget with decimal: `0.05 USD/hour`
- Logging without level (defaults to `info`)
- Invalid logging level (`verbose`)
- Oversized content (>1MB)
- Unknown sections (## Notes, ## Custom)
- Various skill directory configurations (missing, broken, partial)

### Reused Fixtures (from Story 4.1)

- `packages/client/src/agent/__tests__/fixtures/skills/player-move.skill.md`
- `packages/client/src/agent/__tests__/fixtures/skills/harvest-resource.skill.md`
- `packages/client/src/agent/__tests__/fixtures/skills/craft-item.skill.md`

---

## Implementation Checklist for DEV Team

### RED Phase (TEA -- COMPLETE)

- [x] All 50 unit acceptance tests generated with `it.skip()`
- [x] Stub modules created with interfaces and throw-not-implemented functions
- [x] Type definitions finalized (not stubs -- agent-config-types.ts is production-ready)
- [x] Test fixtures created for Agent.md files
- [x] Barrel exports updated (agent/index.ts + client/src/index.ts)
- [x] Full regression suite passes (731 existing tests pass, 50 new tests properly skipped)
- [x] Lint passes (0 errors)
- [x] Build passes (ESM + CJS + DTS)
- [x] No test interdependencies (all tests independent)

### GREEN Phase (DEV -- TODO)

For each item below, remove the `it.skip()` from related tests, implement the feature, and verify tests pass.

1. **Task 1: Implement parseAgentConfig()**
   - Remove `it.skip()` from agent-config-parser.test.ts (15 tests)
   - Implement `packages/client/src/agent/agent-config-parser.ts`:
     - Split content on H1/H2 headings
     - Extract agent name from `# Agent: <name>`
     - Parse `## Skills` bullet list
     - Parse `## Budget` format: `<amount> <unit>/<period>`
     - Parse `## Logging` key-value pairs
     - Parse `## Personality` freeform text
     - Ignore unknown sections
     - File size check: reject >1MB (OWASP A03)
     - Validate: duplicate skill references
   - Tests: `cd packages/client && npx vitest run src/agent/__tests__/agent-config-parser.test.ts`
   - Estimated Effort: 2 hours

2. **Task 2: Implement loadAgentConfig() and reloadAgentConfig()**
   - Remove `it.skip()` from skill-resolution.test.ts (12 tests)
   - Remove `it.skip()` from config-stateless.test.ts (5 tests)
   - Implement `packages/client/src/agent/agent-config-loader.ts`:
     - Read Agent.md from disk via `fs/promises.readFile`
     - Parse via `parseAgentConfig()`
     - Load skills via `loadSkillDirectory()` (Story 4.1)
     - Resolve skill references by name
     - Collect all missing skills and throw fail-fast error
     - Build filtered `SkillRegistry` with only referenced skills
     - `reloadAgentConfig()` = same as `loadAgentConfig()` (semantic alias)
   - Tests: `cd packages/client && npx vitest run src/agent/__tests__/skill-resolution.test.ts src/agent/__tests__/config-stateless.test.ts`
   - Estimated Effort: 2 hours

3. **Task 3: Implement generateClaudeMd() and generateAgentsMd()**
   - Remove `it.skip()` from claude-md-generator.test.ts (8 tests)
   - Implement `packages/client/src/agent/agent-file-generator.ts`:
     - Generate CLAUDE.md with: `# Agent: <name>`, `## Identity`, `## Constraints`, `## Goals`, `## Available Skills`, `## MCP Tools`
     - Generate AGENTS.md with same info in runtime-agnostic format
     - Include skill descriptions, reducer names, param summaries
     - MCP tool references in `snake_case`
   - Tests: `cd packages/client && npx vitest run src/agent/__tests__/claude-md-generator.test.ts`
   - Estimated Effort: 1.5 hours

4. **Task 4: Implement validateTriggeringPrecision()**
   - Remove `it.skip()` from triggering-precision.test.ts (10 tests)
   - Implement `packages/client/src/agent/triggering-precision.ts`:
     - Exact match detection (identical descriptions)
     - Substring containment detection
     - Token overlap: Jaccard similarity with stop word removal
     - Threshold: >= 0.7 produces warning
     - Return `TriggeringPrecisionReport` with warnings and pass/fail
   - Tests: `cd packages/client && npx vitest run src/agent/__tests__/triggering-precision.test.ts`
   - Estimated Effort: 1.5 hours

### REFACTOR Phase (DEV -- after GREEN)

- Remove TDD RED phase comments from stub modules
- Remove `_` prefix from parameter names in implementation files
- Review error messages for consistency with Story 4.1 patterns
- Verify no `any` types in new code
- Security review: OWASP A03 (injection), A04 (insecure design)
- Update story doc: Dev Agent Record section

---

## Running Tests

```bash
# Run all new Story 4.2 agent tests
cd packages/client && npx vitest run src/agent/__tests__/agent-config-parser.test.ts src/agent/__tests__/skill-resolution.test.ts src/agent/__tests__/claude-md-generator.test.ts src/agent/__tests__/triggering-precision.test.ts src/agent/__tests__/config-stateless.test.ts

# Run a specific test file
cd packages/client && npx vitest run src/agent/__tests__/agent-config-parser.test.ts

# Run all agent tests (Story 4.1 + 4.2)
cd packages/client && npx vitest run src/agent/__tests__/

# Run tests in watch mode (TDD)
cd packages/client && npx vitest src/agent/__tests__/agent-config-parser.test.ts

# Run client unit tests (excludes integration tests)
pnpm --filter @sigil/client test:unit

# Run full regression
pnpm test

# Lint check
pnpm lint

# Build check
pnpm --filter @sigil/client build
```

---

## Validation Checklist

- [x] Story acceptance criteria analyzed and mapped to test levels
- [x] 50 unit tests created at unit level (all `it.skip()` for TDD RED phase)
- [x] No integration tests needed (pure file parsing, no Docker dependency)
- [x] Given-When-Then format used consistently across all tests
- [x] RED phase verified by local test run (50 tests skipped, 731 existing pass)
- [x] Test factories created for test data (createTestSkill, createResolvedConfig, createSkillWithDescription, validSkillContent, createTempAgentDir)
- [x] No hardcoded test data (factories with overrides and inline fixtures used throughout)
- [x] No test interdependencies (all tests independent, temp directories cleaned up)
- [x] No flaky patterns (deterministic tests, temp directories, real filesystem)
- [x] Security tests included (OWASP A03: oversized file rejection at 1MB limit)
- [x] Implementation checklist created with red-green-refactor guidance
- [x] Execution commands provided and verified
- [x] Lint passes (0 errors)
- [x] Build passes (ESM + CJS + DTS all produce correctly)
- [x] Agent.md fixture files created for test scenarios
- [x] Existing Story 4.1 tests unaffected (76 tests still pass)
- [x] Barrel exports updated (agent/index.ts + client/src/index.ts)

---

## Notes

- Agent.md uses **standard markdown** with heading-based section parsing (NOT YAML frontmatter). This is a deliberate design decision distinct from SKILL.md files.
- The `gray-matter` package is already installed but is NOT used for Agent.md parsing. Agent.md parsing is custom heading-based splitting.
- Triggering precision uses deterministic Jaccard similarity (NOT LLM-based analysis) for testability.
- All test files use real filesystem operations (temp directories) rather than mocking `fs/promises`, matching the pattern from Story 4.1's loader tests.
- The `ResolvedAgentConfig.skillRegistry` contains ONLY the referenced skills (filtered), not all available skills from the directory.
- Budget parsing uses regex: `/^(\d+(?:\.\d+)?)\s+(\w+)\/(\w+)$/` -- validates format strictly.
- Logging level defaults to `'info'` when not specified. Valid levels: `debug`, `info`, `warn`, `error`.

---

**Generated by BMad TEA Agent** - 2026-03-14
