# Epic 4: Test Design - Declarative Agent Configuration

**Epic:** Epic 4 - Declarative Agent Configuration
**Test Design Type:** Risk-Based Test Plan
**Epic-Level Analysis Mode:** ENABLED
**Created:** 2026-03-14
**Test Architect:** Claude Opus 4.6 (claude-opus-4-6)

---

## Executive Summary

This test design defines the comprehensive testing strategy for Epic 4: Declarative Agent Configuration. Epic 4 enables researchers to define agent behavior entirely through markdown configuration files -- Agent.md for personality, skill selection, and budget limits; SKILL.md files for game action declarations -- with zero application code required. The epic adds client-side parsing, validation, tracking, and logging subsystems to `@sigil/client`.

**Epic 4 Objectives:**

- Parse SKILL.md files with YAML frontmatter and markdown body into an action registry (Story 4.1)
- Parse Agent.md configuration files with skill selection, budget, and personality (Story 4.2)
- Validate configurations against the live SpacetimeDB module (Story 4.3)
- Enforce budget limits at the client level before publishing actions (Story 4.4)
- Interpret raw SpacetimeDB table updates as human-readable semantic narratives (Story 4.5)
- Produce structured JSONL decision logs with eval-compatible metrics (Story 4.6)
- Support swappable configurations across agent restarts (Story 4.7)

**Why This Epic Is Lower Risk Than Epic 3:**

1. **Client-side only** -- No server-side components, no Docker networking, no new containers
2. **No external SDK dependencies** -- Uses only YAML parsers and file I/O (well-understood patterns)
3. **Builds on proven infrastructure** -- Extends `@sigil/client` which has 655 passing tests
4. **File parsing is deterministic** -- SKILL.md and Agent.md parsing produces predictable outputs from known inputs
5. **Budget tracking is pure arithmetic** -- No distributed state, no concurrency with external systems
6. **Prototype skill files exist** -- Three prototypes in `skill-file-examples/` de-risk the parser design

**Key Risk Areas (despite lower overall risk):**

1. **SpacetimeDB validation (Story 4.3)** requires live connection -- integration test dependency
2. **Event interpretation (Story 4.5)** needs game state knowledge -- unmapped tables degrade gracefully but reduce value
3. **Decision log schema (Story 4.6)** must be eval-compatible -- schema design affects downstream tooling
4. **Skill triggering precision (Story 4.2)** involves LLM judgment -- hard to test deterministically

**Test Strategy:**

- **Risk-Based Prioritization:** Focus on parsing correctness, validation completeness, budget enforcement
- **TDD Approach:** Write tests before implementation (AGREEMENT-1: all stories have 4+ acceptance criteria)
- **Security-First:** OWASP Top 10 review on every story (AGREEMENT-2)
- **Prototype-Driven:** Use 3 existing skill file prototypes as golden-path test fixtures
- **No Placeholder Tests:** AGREEMENT-10 -- every integration test must have real assertions or be tracked

**Target Metrics:**

- **Test Coverage:** >=95% line coverage for all new Epic 4 code
- **P0 Acceptance Criteria:** 100% coverage (gate requirement)
- **Integration Tests:** Conditional on SpacetimeDB connection (Story 4.3 only)
- **Performance:** <1s parsing for 50 skills (NFR7)
- **Security:** OWASP Top 10 compliant, zero high-severity issues
- **Regression:** All 984 existing tests continue to pass

---

## Table of Contents

1. [Epic-Level Risk Assessment](#1-epic-level-risk-assessment)
2. [Test Strategy Per Story](#2-test-strategy-per-story)
3. [Cross-Story Integration Tests](#3-cross-story-integration-tests)
4. [Test Infrastructure Needs](#4-test-infrastructure-needs)
5. [Risk-Based Prioritization](#5-risk-based-prioritization)
6. [Security Test Plan](#6-security-test-plan)
7. [Performance Test Plan](#7-performance-test-plan)
8. [Test Data & Fixtures](#8-test-data--fixtures)
9. [Quality Gates](#9-quality-gates)

---

## 1. Epic-Level Risk Assessment

### 1.1 Risk Register

| Risk ID    | Risk Description                                                                                   | Likelihood | Impact       | Risk Score | Mitigation Strategy                                                                                       | Test Strategy                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------- | ---------- | ------------ | ---------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **R4-001** | YAML frontmatter parser fails on edge cases (multiline strings, special chars, nested arrays)      | Medium     | High         | **HIGH**   | Use battle-tested YAML library (gray-matter or yaml); test with diverse fixtures                          | Comprehensive parser unit tests including edge cases, malformed YAML, Unicode, nested structures |
| **R4-002** | SpacetimeDB validation requires live connection; offline development broken                        | Medium     | High         | **HIGH**   | Validation runs as separate step, not at load time; offline mode skips validation with warning            | Unit tests mock SpacetimeDB module info; integration tests validate against real server          |
| **R4-003** | Budget tracking race condition: concurrent `client.publish()` calls bypass budget limit            | Low        | **CRITICAL** | **HIGH**   | Synchronous budget check-and-decrement before any async Crosstown interaction                             | Concurrent publish tests; budget boundary tests; atomicity verification                          |
| **R4-004** | Event interpreter produces incorrect narratives for complex multi-table updates                    | Medium     | Medium       | **MEDIUM** | Graceful degradation for unmapped tables; generic narrative as fallback                                   | Unit tests for each mapped table type; generic fallback tests; correlation tests                 |
| **R4-005** | Decision log JSONL schema breaks eval tooling downstream                                          | Medium     | Medium       | **MEDIUM** | Define schema early with validation; JSON Schema or Zod for type safety                                  | Schema validation tests; round-trip parsing tests; large file handling tests                     |
| **R4-006** | Skill description ambiguity: overlapping descriptions cause LLM to trigger wrong skill            | Medium     | Medium       | **MEDIUM** | Story 4.2 AC5 validation detects overlapping descriptions and produces warnings                           | Overlap detection tests; precision analysis tests; negative eval parsing                        |
| **R4-007** | Progressive disclosure breaks: eager metadata load disagrees with full body load                   | Low        | Medium       | **LOW**    | Same parser for both modes; metadata-only parse is subset of full parse                                   | Test metadata-only parse matches full-parse metadata; consistency tests                         |
| **R4-008** | File system path traversal in skill directory or Agent.md path                                     | Low        | **CRITICAL** | **MEDIUM** | Validate paths are within allowed directory; reject `..` traversal; OWASP A03                             | Path traversal injection tests; symlink tests; directory escape tests                           |
| **R4-009** | Decision log file grows unbounded, exceeds 100MB without rotation                                 | Low        | Medium       | **LOW**    | File size check before append; configurable rotation threshold (NFR16)                                    | Log rotation trigger tests; size monitoring tests; append-after-rotation tests                   |
| **R4-010** | Agent.md references non-existent skill: partial initialization risk                               | Medium     | Medium       | **MEDIUM** | Fail-fast: agent does not start with missing skills (Story 4.2 AC3)                                      | Missing skill reference tests; partial load rejection tests                                     |

### 1.2 Risk Scoring Matrix

**Impact Levels:**

- **CRITICAL:** System unusable, security breach, budget overspend, data loss
- **High:** Major feature broken, significant user impact
- **Medium:** Feature degradation, workaround available
- **Low:** Minor inconvenience, cosmetic issue

**Likelihood Levels:**

- **High:** >50% chance -- new patterns, limited docs, LLM-dependent behavior
- **Medium:** 20-50% chance -- integration complexity, file system edge cases
- **Low:** <20% chance -- well-understood patterns, deterministic logic

**Risk Score Calculation:**

- **CRITICAL:** Critical Impact + High Likelihood
- **HIGH:** Critical Impact + Medium/Low Likelihood OR High Impact + High/Medium Likelihood
- **MEDIUM:** High Impact + Low Likelihood OR Medium Impact
- **LOW:** Low Impact

### 1.3 Key Risk Insight

**R4-003 (budget bypass) is the most consequential risk.** If concurrent `client.publish()` calls can bypass the budget check, researchers could overspend during experiments with no guardrails. The mitigation is straightforward (synchronous check-and-decrement) but must be proven correct under concurrency.

**R4-001 (YAML parsing) and R4-002 (SpacetimeDB validation) are the most likely risks.** YAML is notoriously tricky with edge cases, and requiring a live SpacetimeDB connection for validation creates a development friction point. Both have clear mitigations.

**Compared to Epic 3:** The dominant risk in Epic 3 was R3-001 (external SDK API uncertainty, CRITICAL). Epic 4 has no comparable unknown -- all components are in our control. The highest-risk story (4.3: SpacetimeDB validation) is still simpler than any Epic 3 story because it reads module metadata rather than processing live ILP packets.

---

## 2. Test Strategy Per Story

### 2.1 Story 4.1: Skill File Format & Parser

**Acceptance Criteria:** 6 ACs (all P0)
**Risk Mitigation:** R4-001 (YAML parsing), R4-007 (progressive disclosure), R4-008 (path traversal)
**TDD Required:** YES (6 ACs)
**Integration Tests:** NOT required (pure parsing, no external dependencies)
**Pair Programming:** NOT required (well-understood tech)

**Risk Assessment:** Medium risk. The YAML frontmatter parsing is the foundation for the entire epic. If skill files cannot be parsed correctly, nothing else works. The 3 prototype files in `skill-file-examples/` de-risk the happy path, but edge cases (malformed YAML, missing fields, Unicode, large files) need thorough coverage.

#### Unit Tests (~55 tests)

| Test Suite                      | Test Count | Focus Area                                                                               |
| ------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `skill-parser.test.ts`          | 18         | YAML frontmatter extraction, field parsing, type coercion, required vs optional fields   |
| `skill-eval-parser.test.ts`     | 10         | Eval section parsing, positive evals, negative evals (`skill_not_triggered`), edge cases |
| `skill-loader.test.ts`          | 12         | Directory loading, multiple files, error isolation, NFR7 performance (<1s for 50 skills) |
| `skill-validation.test.ts`      | 8          | Required field validation, reducer name format, param type validation, error messages     |
| `skill-progressive.test.ts`     | 7          | Metadata-only loading, full loading, consistency between eager and lazy parse             |

#### Key Test Cases

**AC1 - YAML Frontmatter Extraction:**

- Parse `player-move.skill.md` prototype -> extract name, description, reducer, params, subscriptions
- Parse `harvest-resource.skill.md` -> extract all fields including tags
- Parse `craft-item.skill.md` -> extract default value for quantity param
- ILP cost is NOT present in parsed output (verify absence)
- Reducer name validated: 1-64 chars, alphanumeric + underscore
- Invalid YAML frontmatter (no closing `---`) -> clear parse error
- Non-YAML content before frontmatter -> error
- Empty frontmatter (`---\n---`) -> error (missing required fields)

**AC2 - Eval Section Parsing:**

- Positive eval: `{ prompt, expected: { reducer, args }, criteria }` extracted correctly
- Negative eval: `{ prompt, expected: "skill_not_triggered", criteria }` parsed as negative test
- Eval with `args: null` (runtime-dependent) -> parsed with null args
- Mixed positive and negative evals in same file -> all extracted
- Missing evals section -> empty array (optional field)

**AC3 - Directory Loading:**

- Load directory with 3 prototype files -> 3 skills registered
- Load directory with 1 valid + 1 malformed -> 1 skill loaded, 1 error reported
- Empty directory -> empty registry, no error
- Non-`.skill.md` files ignored
- Performance: load 50 skills in <1 second (NFR7)

**AC4 - Malformed File Error Handling:**

- Missing `name` field -> error: "Skill file `path`: missing required field 'name'"
- Missing `reducer` field -> error identifies file and field
- Missing `params` -> error identifies file and field
- Missing `subscriptions` -> error identifies file and field
- Invalid `reducer` format (contains spaces) -> error with format guidance
- Invalid param type (`int` instead of `i32`) -> error identifying invalid type

**AC5 - Uniform Consumption (NFR21):**

- Parsed skill exposes interface consumable by MCP server, TUI backend, and direct import
- Interface includes: name, description, reducer, params, subscriptions, tags, evals
- No frontend-specific fields in the skill format

**AC6 - Progressive Disclosure:**

- Metadata-only load: returns name, reducer, params, subscriptions (from frontmatter only)
- Full load: returns everything including markdown body and evals
- Metadata-only parse is faster than full parse (measurable)
- Metadata from metadata-only parse matches metadata from full parse (consistency)

#### Mocks Required

None. This story is pure file parsing -- no external dependencies to mock.

#### Test Fixtures

Use the 3 prototype files directly:

```
_bmad-output/planning-artifacts/skill-file-examples/player-move.skill.md
_bmad-output/planning-artifacts/skill-file-examples/harvest-resource.skill.md
_bmad-output/planning-artifacts/skill-file-examples/craft-item.skill.md
```

Plus synthetic fixtures for edge cases (created in test code, not on disk):

- `malformed-yaml.skill.md` (invalid YAML)
- `missing-fields.skill.md` (partial frontmatter)
- `unicode-names.skill.md` (Unicode characters in name/description)
- `large-body.skill.md` (>100KB markdown body)
- `no-evals.skill.md` (valid file without evals section)

#### Estimated Test Count: 55 tests (all unit)

---

### 2.2 Story 4.2: Agent.md Configuration & Skill Selection

**Acceptance Criteria:** 6 ACs (all P0)
**Risk Mitigation:** R4-006 (skill description ambiguity), R4-010 (missing skill reference)
**TDD Required:** YES (6 ACs)
**Integration Tests:** NOT required (file parsing and config resolution)
**Pair Programming:** NOT required

**Risk Assessment:** Medium risk. The core parsing is similar to Story 4.1, but skill resolution (Agent.md references SKILL.md files by name) adds a dependency chain. The triggering precision analysis (AC5) is the most novel aspect -- detecting overlapping skill descriptions is a string similarity problem that may have edge cases.

#### Unit Tests (~50 tests)

| Test Suite                       | Test Count | Focus Area                                                                            |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `agent-config-parser.test.ts`    | 15         | Agent.md parsing: name, personality, skills, budget, logging preferences              |
| `skill-resolution.test.ts`       | 12         | Skill reference resolution from directory, missing skills, partial resolution failure |
| `claude-md-generator.test.ts`    | 8          | CLAUDE.md generation for Claude agents, AGENTS.md for non-Claude                     |
| `triggering-precision.test.ts`   | 10         | Overlapping description detection, ambiguity warnings, distinct skills pass           |
| `config-stateless.test.ts`       | 5          | Stateless re-read on restart, config change detection                                 |

#### Key Test Cases

**AC1 - Agent.md Parsing:**

- Parse Agent.md with all sections -> extract name, personality, skills, budget, logging
- Parse Agent.md with minimal sections (just name + skills) -> partial config valid
- Parse Agent.md with invalid format -> clear error
- Budget format parsing: `0.05 USD/hour`, `100 ILP/session`, etc.

**AC2 - Skill Reference Resolution:**

- Agent.md references `player_move`, `harvest_resource` -> both resolved from skills directory
- Agent.md references skill not in directory -> resolution fails, agent does not start
- Only referenced skills are active (other skills in directory are ignored)

**AC3 - Missing Skill File:**

- Agent.md references `nonexistent_skill` -> error: "Missing skill file: 'nonexistent_skill'"
- Agent does NOT start with partial skill set
- Multiple missing skills -> all listed in error message

**AC4 - CLAUDE.md Generation:**

- Valid Agent.md + resolved skills -> CLAUDE.md generated with personality, constraints, goals, MCP tool references
- AGENTS.md equivalent generated for non-Claude agents
- Generated CLAUDE.md includes skill descriptions for LLM reference

**AC5 - Triggering Precision Validation:**

- Two skills with identical descriptions -> warning: "Ambiguous descriptions for skills X and Y"
- Two skills with clearly distinct descriptions -> no warning
- Overlapping descriptions (one is substring of another) -> warning
- Single skill -> no overlap possible, no warning

**AC6 - Stateless Configuration:**

- Agent.md re-read from disk on restart
- Modified Agent.md -> new config takes effect on restart
- Unmodified Agent.md -> same config as before

#### Mocks Required

```typescript
// Mock file system for skill directory listing
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue(['player-move.skill.md', 'harvest-resource.skill.md']),
  readFile: vi.fn().mockResolvedValue('---\nname: player_move\n...'),
  stat: vi.fn().mockResolvedValue({ isFile: () => true }),
}));
```

#### Estimated Test Count: 50 tests (all unit)

---

### 2.3 Story 4.3: Configuration Validation Against SpacetimeDB

**Acceptance Criteria:** 4 ACs (all P0)
**Risk Mitigation:** R4-002 (live connection dependency)
**TDD Required:** YES (4 ACs)
**Integration Tests:** REQUIRED (real SpacetimeDB connection for reducer/table validation)

**Risk Assessment:** Highest risk story in Epic 4. This is the only story requiring a live SpacetimeDB connection, introducing a dependency on the Docker stack. Unit tests mock the SpacetimeDB module metadata; integration tests validate against the real BitCraft server.

#### Unit Tests (~30 tests)

| Test Suite                       | Test Count | Focus Area                                                                               |
| -------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `reducer-validator.test.ts`      | 12         | Reducer name existence check, parameter type compatibility, mock module metadata          |
| `table-validator.test.ts`        | 8          | Table name existence check, subscription validation, mock module tables                   |
| `validation-report.test.ts`      | 6          | Report generation, pass/fail aggregation, actionable error messages, NFR7 performance     |
| `validation-offline.test.ts`     | 4          | Offline mode behavior (skip validation with warning), graceful degradation                |

#### Integration Tests (~15 tests)

| Test Suite                                  | Test Count | Focus Area                                                                        |
| ------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `spacetimedb-validation.integration.test.ts`| 10         | Validate prototypes against live BitCraft module, real reducer/table existence     |
| `validation-error.integration.test.ts`      | 5          | Non-existent reducer, non-existent table, type mismatch against real module        |

#### Key Test Cases

**AC1 - Reducer Existence Validation:**

- Skill references `player_move` reducer -> validated against module, passes
- Skill references `nonexistent_reducer` -> actionable error message
- Reducer parameter types checked for compatibility (i32 vs u32 mismatch)
- All 3 prototype skill reducers validated

**AC2 - Non-Existent Reducer Error:**

- Error format: "Skill file `harvest_resource.md` references reducer `harvest_resource` but SpacetimeDB module does not expose this reducer"
- Error is actionable (tells user what to fix)

**AC3 - Table Subscription Validation:**

- Skill requires `player_state` table -> validated, passes
- Skill requires `nonexistent_table` -> error identifies skill file and table name
- All subscription tables from prototypes validated

**AC4 - Full Validation Report:**

- Agent.md + all skills + SpacetimeDB module -> validation report
- Report lists: passed checks, failed checks, warnings
- Validation completes within 1 second for 50 skills (NFR7)
- Report is structured (parseable, not just string output)

#### Mocks Required

```typescript
// Mock SpacetimeDB module metadata for unit tests
const mockModuleInfo = {
  reducers: [
    { name: 'player_move', params: [{ name: 'identity', type: 'String' }, { name: 'target_x', type: 'i32' }, { name: 'target_y', type: 'i32' }] },
    { name: 'harvest_start', params: [{ name: 'identity', type: 'String' }, { name: 'resource_id', type: 'u64' }] },
    { name: 'craft_item', params: [{ name: 'identity', type: 'String' }, { name: 'recipe_id', type: 'u64' }, { name: 'quantity', type: 'u32' }] },
  ],
  tables: ['player_state', 'terrain', 'resource_node', 'inventory', 'item_desc', 'recipe_desc'],
};
```

#### Estimated Test Count: 45 tests (30 unit + 15 integration)

---

### 2.4 Story 4.4: Budget Tracking & Limits

**Acceptance Criteria:** 5 ACs (all P0)
**Risk Mitigation:** R4-003 (budget bypass via concurrency)
**TDD Required:** YES (5 ACs)
**Integration Tests:** NOT required (pure client-side logic, action cost registry already tested)

**Risk Assessment:** Medium risk. The core logic is simple arithmetic, but the concurrency concern (R4-003) requires careful testing. The budget tracker must check-and-decrement atomically before any `client.publish()` interaction with `@crosstown/client`.

#### Unit Tests (~45 tests)

| Test Suite                    | Test Count | Focus Area                                                                            |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `budget-tracker.test.ts`      | 15         | Initialization from Agent.md, spend tracking, limit enforcement, reset                |
| `budget-publish-guard.test.ts`| 12         | Pre-publish budget check, rejection before Crosstown, error codes, boundary           |
| `budget-warnings.test.ts`     | 8          | Threshold warnings (80%, 90%), configurable thresholds, event emission                |
| `budget-concurrency.test.ts`  | 5          | Concurrent publish calls, atomicity, no overspend under race conditions               |
| `budget-metrics.test.ts`      | 5          | Total spend, per-action costs, budget utilization, queryable metrics                  |

#### Key Test Cases

**AC1 - Budget Initialization:**

- Agent.md `## Budget: 0.05 USD/hour` -> budget tracker configured with limit
- Current spend initialized to zero
- Missing budget section -> no budget tracking (unlimited)
- Invalid budget format -> error at config load time

**AC2 - Pre-Publish Budget Check:**

- Action cost 10, budget remaining 100 -> publish proceeds
- Action cost 10, budget remaining 5 -> `BUDGET_EXCEEDED` error BEFORE any Crosstown interaction
- Action cost lookup uses existing action cost registry (Story 2.2)
- Budget deducted on successful publish, refunded on failure (or deducted on attempt -- design decision)

**AC3 - Threshold Warnings:**

- Budget at 80% utilization -> warning event emitted
- Budget at 90% utilization -> warning event emitted
- Thresholds configurable in Agent.md
- Warning emitted once per threshold crossing (not on every action)

**AC4 - Budget Exhaustion:**

- Budget remaining = 0 -> all `client.publish()` calls rejected
- Rejection logged in decision log
- Budget can be reset or increased (API method)

**AC5 - Budget Metrics:**

- `budgetTracker.getMetrics()` returns: total spend, per-action breakdown, utilization percentage
- Metrics accurate after multiple actions of different types

#### Mocks Required

```typescript
// Mock action cost registry (from Story 2.2)
const mockCostRegistry = {
  getCost: vi.fn((reducer: string) => {
    const costs: Record<string, number> = { player_move: 50, harvest_start: 100, craft_item: 200 };
    return costs[reducer] ?? 100;
  }),
};

// Mock client.publish for integration point testing
const mockPublish = vi.fn().mockResolvedValue({ eventId: 'test', reducer: 'player_move' });
```

#### Estimated Test Count: 45 tests (all unit)

---

### 2.5 Story 4.5: Event Interpretation as Semantic Narratives

**Acceptance Criteria:** 4 ACs (all P0)
**Risk Mitigation:** R4-004 (incorrect narratives for complex updates)
**TDD Required:** YES (4 ACs)
**Integration Tests:** NOT required (pure transformation logic; input is table update events)

**Risk Assessment:** Medium risk. The core pattern (table update -> narrative string) is straightforward, but the value depends on how many table types are mapped. The graceful degradation for unmapped tables (AC4) is the safety net. Multi-table correlation (AC3) is the most complex aspect.

#### Unit Tests (~40 tests)

| Test Suite                       | Test Count | Focus Area                                                                        |
| -------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `event-interpreter.test.ts`      | 15         | Single-table interpretation: insert, update, delete for mapped tables             |
| `narrative-format.test.ts`       | 8          | Narrative structure: event type, affected entity, key state changes, timestamp    |
| `event-correlation.test.ts`      | 8          | Multi-update correlation, single coherent narrative from related updates          |
| `event-fallback.test.ts`         | 5          | Unmapped tables, generic narrative, no thrown errors, graceful degradation         |
| `event-static-data.test.ts`      | 4          | Player display name resolution from static data, missing static data fallback    |

#### Key Test Cases

**AC1 - Table Update Interpretation:**

- Player position update -> "Player [pubkey] moved from hex (x1,y1) to hex (x2,y2)"
- Inventory item insert -> "Player [pubkey] received [item_name] x[quantity]"
- Resource node delete -> "Resource node [id] depleted"
- Player state update -> narrative includes key state changes and timestamp

**AC2 - Player Display Name Resolution:**

- Player pubkey with display name in static data -> narrative uses display name
- Player pubkey without display name -> narrative uses truncated pubkey
- Static data not loaded yet -> fallback to truncated pubkey

**AC3 - Multi-Update Correlation:**

- Harvest action (resource -1, inventory +1) -> "Player [name] harvested [item] from [resource]"
- Craft action (material -N, product +1) -> "Player [name] crafted [product] using [materials]"
- Raw events remain accessible alongside narrative

**AC4 - Unmapped Table Fallback:**

- Unknown table update -> "Table [name] row [id] [inserted/updated/deleted]"
- No error thrown
- Graceful degradation (still produces output, just less descriptive)

#### Mocks Required

```typescript
// Mock SpacetimeDB table update events
interface TableUpdate {
  table: string;
  type: 'insert' | 'update' | 'delete';
  rowId: string;
  oldRow?: Record<string, unknown>;
  newRow?: Record<string, unknown>;
}

// Mock static data loader for display name resolution
const mockStaticData = {
  get: vi.fn((table: string, id: unknown) => {
    if (table === 'player_desc' && id === 'abc123') return { displayName: 'Alice' };
    return undefined;
  }),
};
```

#### Estimated Test Count: 40 tests (all unit)

---

### 2.6 Story 4.6: Structured Decision Logging

**Acceptance Criteria:** 6 ACs (all P0)
**Risk Mitigation:** R4-005 (schema breaks eval tooling), R4-009 (unbounded log growth)
**TDD Required:** YES (6 ACs)
**Integration Tests:** NOT required (file I/O with known format)

**Risk Assessment:** Medium risk. The JSONL format and append-only semantics are straightforward. The schema definition (AC1) is the most consequential decision -- it affects all downstream tooling. Log rotation (AC3) is a standard pattern but must be tested. The eval-compatible metrics (AC6) require schema design that supports aggregation.

#### Unit Tests (~50 tests)

| Test Suite                       | Test Count | Focus Area                                                                               |
| -------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `decision-logger.test.ts`        | 15         | Log entry creation, JSONL format, append-only semantics, field completeness              |
| `decision-log-schema.test.ts`    | 10         | Schema validation, each line valid JSON, required fields, optional fields                |
| `decision-log-rotation.test.ts`  | 8          | File size check, rotation trigger at 100MB, archival naming, post-rotation append        |
| `decision-log-failure.test.ts`   | 7          | Error logging with error code/boundary/message, world state capture on failure           |
| `decision-log-metrics.test.ts`   | 10         | Per-skill metrics derivation: invocation count, trigger accuracy, latency, cost, eval compat |

#### Key Test Cases

**AC1 - Decision Log Entry Structure:**

- Decision cycle logged with: timestamp, observation summary, semantic events, skill triggered, action `{ reducer, args }`, cost, result, outcome
- Entry is valid JSONL (one JSON object per line)
- All fields present (no missing required fields)

**AC2 - Append-Only JSONL:**

- Log entries appended to configured file path
- Each line independently parseable as JSON
- File can be tailed in real-time (no buffering issues)
- Multiple entries written sequentially maintain valid JSONL

**AC3 - Log Rotation:**

- File exceeds 100MB -> rotation triggered
- Rotated file named with timestamp (e.g., `decisions-2026-03-14T12-00-00.jsonl`)
- New entries written to fresh file after rotation
- Old file preserved (not deleted)

**AC4 - Failure Logging:**

- Failed action logged with: error code, boundary, error message
- World state at time of failure captured in log entry
- Failed entry is still valid JSONL

**AC5 - Reproducibility:**

- Each entry contains: input state, skill invoked, parameters chosen, outcome observed
- Entry has enough context to reproduce the decision (deterministic replay)

**AC6 - Eval-Compatible Metrics:**

- Per-skill: invocation count derivable from log
- Per-skill: trigger accuracy (correct skill for context) derivable
- Per-skill: execution latency derivable
- Per-skill: cost accumulation derivable
- Schema compatible with eval pass/fail tracking

#### Mocks Required

```typescript
// Mock file system for log writing
vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
  rename: vi.fn().mockResolvedValue(undefined),
}));

// Mock file system for rotation testing
vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 105 * 1024 * 1024 }), // 105MB
  rename: vi.fn().mockResolvedValue(undefined),
}));
```

#### Estimated Test Count: 50 tests (all unit)

---

### 2.7 Story 4.7: Swappable Agent Configuration

**Acceptance Criteria:** 4 ACs (all P0)
**Risk Mitigation:** R4-010 (partial initialization from missing skills)
**TDD Required:** YES (4 ACs)
**Integration Tests:** NOT required (builds on Stories 4.1 + 4.2 with restart semantics)

**Risk Assessment:** Low risk. This story validates that the parsing and loading from Stories 4.1 and 4.2 support hot-swap semantics. The core behavior is: re-read files on restart, old config replaced. No complex state management.

#### Unit Tests (~30 tests)

| Test Suite                      | Test Count | Focus Area                                                                        |
| ------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `config-swap.test.ts`           | 10         | Skill set replacement on restart, old skills removed, new skills active            |
| `multi-agent-config.test.ts`    | 8          | Two agents with different Agent.md files, independent behavior                     |
| `skill-update.test.ts`          | 7          | Updated SKILL.md loaded on restart, new params/description used                    |
| `config-versioning.test.ts`     | 5          | Agent.md + skill file versions logged alongside decision logs, reproducibility     |

#### Key Test Cases

**AC1 - Skill Set Swap:**

- Agent starts with skills A, B -> restart with Agent.md referencing C, D -> only C, D active
- Old skills A, B no longer available after restart

**AC2 - Multi-Agent Independence:**

- Agent 1 with Agent.md-1 (skills A, B) + Agent 2 with Agent.md-2 (skills C, D)
- Each agent behaves independently, skill sets do not cross-contaminate

**AC3 - Skill File Update:**

- SKILL.md updated (parameters adjusted, description refined, evals added)
- Agent restart -> updated skill definition loaded
- New parameter values and description used

**AC4 - Configuration Versioning:**

- Decision logs include Agent.md and skill file versions
- Different experiment runs with different configs are distinguishable
- Version information sufficient for reproducibility

#### Mocks Required

Reuse mocks from Stories 4.1 and 4.2 (file system mocks, skill parser mocks).

#### Estimated Test Count: 30 tests (all unit)

---

## 3. Cross-Story Integration Tests

These tests span multiple stories and validate end-to-end flows that no single story can test in isolation.

### 3.1 Full Agent Configuration Pipeline (Stories 4.1 + 4.2 + 4.3)

**Test Suite:** `packages/client/src/__tests__/agent-config-pipeline.test.ts`
**Estimated Count:** 12 tests
**Requires:** SpacetimeDB connection for validation (conditional on Docker)

| Test ID     | Scenario                                                                     | Stories       | Expected Result                                                  |
| ----------- | ---------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| **CONF-01** | Load Agent.md + resolve skills + validate against SpacetimeDB -> all pass    | 4.1, 4.2, 4.3 | Full validation report with zero failures                        |
| **CONF-02** | Load Agent.md with invalid skill reference -> fail before validation         | 4.1, 4.2      | Error at skill resolution stage, no SpacetimeDB call             |
| **CONF-03** | Load Agent.md with valid skills but invalid reducer -> validation fails      | 4.1, 4.2, 4.3 | Validation report identifies bad reducer in specific skill file  |
| **CONF-04** | Load 50 skills from directory + validate all -> completes in <1s             | 4.1, 4.3      | NFR7 performance requirement met                                 |
| **CONF-05** | Progressive disclosure: metadata load -> validate -> full load on trigger    | 4.1           | Metadata available fast, body loaded on demand                   |

### 3.2 Budget + Decision Logging Pipeline (Stories 4.4 + 4.5 + 4.6)

**Test Suite:** `packages/client/src/__tests__/budget-logging-pipeline.test.ts`
**Estimated Count:** 10 tests

| Test ID     | Scenario                                                                      | Stories       | Expected Result                                                 |
| ----------- | ----------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------- |
| **BUDLOG-01** | Action succeeds -> budget decremented + decision logged with cost           | 4.4, 4.6      | Budget and log in sync                                          |
| **BUDLOG-02** | Action fails (budget exceeded) -> rejection logged in decision log          | 4.4, 4.6      | Log entry includes BUDGET_EXCEEDED error                        |
| **BUDLOG-03** | Event received -> interpreted as narrative -> included in next decision log  | 4.5, 4.6      | Semantic narrative appears in decision log observation field     |
| **BUDLOG-04** | Budget warning at 80% -> warning event + logged                             | 4.4, 4.6      | Warning appears in both event stream and log                    |
| **BUDLOG-05** | Multiple actions -> per-skill metrics derivable from log                     | 4.4, 4.5, 4.6 | Aggregated metrics match actual actions                         |

### 3.3 Full Swap Pipeline (Stories 4.1 + 4.2 + 4.7)

**Test Suite:** `packages/client/src/__tests__/config-swap-pipeline.test.ts`
**Estimated Count:** 8 tests

| Test ID     | Scenario                                                                    | Stories         | Expected Result                                                 |
| ----------- | --------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| **SWAP-01** | Load config A -> restart with config B -> verify only B skills active       | 4.1, 4.2, 4.7  | Clean swap, no skill leakage                                    |
| **SWAP-02** | Load config -> update SKILL.md -> restart -> new skill params used          | 4.1, 4.7        | Updated params reflected                                        |
| **SWAP-03** | Config swap logged in decision log with version info                        | 4.6, 4.7        | Config version in log enables reproducibility                   |
| **SWAP-04** | Agent.md removes budget section -> restart -> unlimited budget              | 4.2, 4.4, 4.7  | Budget tracking disabled after swap                             |

### 3.4 End-to-End Agent Lifecycle (All Stories)

**Test Suite:** `packages/client/src/__tests__/agent-lifecycle-e2e.test.ts`
**Estimated Count:** 6 tests
**Requires:** SpacetimeDB connection for validation (conditional on Docker)

| Test ID     | Scenario                                                                                               | Stories             | Expected Result                                          |
| ----------- | ------------------------------------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------- |
| **E2E-01**  | Load Agent.md -> resolve skills -> validate -> set budget -> receive event -> log decision              | 4.1-4.6             | Full agent lifecycle works end-to-end                    |
| **E2E-02**  | Agent with budget runs actions until budget exhausted -> decision log captures full history             | 4.1, 4.2, 4.4, 4.6 | Budget enforcement + complete decision trail             |
| **E2E-03**  | Swap config -> restart -> new skills validated -> new budget -> new decisions logged                    | 4.1-4.7             | Complete config swap lifecycle                           |
| **E2E-04**  | Agent processes event stream -> narratives produced -> narratives appear in decision log                | 4.5, 4.6            | Event interpretation feeds decision logging              |
| **E2E-05**  | 50-skill agent config loaded and validated in <1s                                                      | 4.1, 4.2, 4.3      | NFR7 performance at scale                                |
| **E2E-06**  | Decision log grows past 100MB -> rotation occurs -> new entries in fresh file                           | 4.6                 | Log rotation under sustained usage                       |

---

## 4. Test Infrastructure Needs

### 4.1 No New Docker Services

Unlike Epics 2 and 3, Epic 4 does NOT introduce new Docker containers. All new code lives in `@sigil/client`. Integration tests for Story 4.3 use the existing Docker stack (BitCraft server) for SpacetimeDB module metadata queries.

### 4.2 YAML Parsing Library

Epic 4 needs a YAML parser for SKILL.md frontmatter. Options:

1. **`gray-matter`** -- Popular frontmatter parser, handles `---` delimited YAML + markdown body
2. **`yaml`** -- Full YAML 1.2 parser, more control but requires manual frontmatter splitting

**Recommendation:** `gray-matter` is the better fit because it handles the frontmatter + body split natively.

### 4.3 Test Fixture Files

**Location:** `packages/client/src/__tests__/fixtures/skills/`

Copy the 3 prototype skill files from `_bmad-output/planning-artifacts/skill-file-examples/` into the test fixtures directory, plus additional synthetic fixtures:

```
packages/client/src/__tests__/fixtures/skills/
  player-move.skill.md          # Copy from prototype
  harvest-resource.skill.md     # Copy from prototype
  craft-item.skill.md           # Copy from prototype
  malformed-yaml.skill.md       # Invalid YAML for negative testing
  missing-fields.skill.md       # Missing required fields
  no-evals.skill.md             # Valid without evals section
  unicode-skill.skill.md        # Unicode in name/description
  large-body.skill.md           # >100KB markdown body
```

**Agent.md Fixtures:**

```
packages/client/src/__tests__/fixtures/agents/
  basic-agent.md                # Minimal valid Agent.md
  full-agent.md                 # All sections populated
  budget-agent.md               # Agent with budget limits
  no-budget-agent.md            # Agent without budget
  invalid-agent.md              # Malformed Agent.md
  overlapping-skills-agent.md   # References skills with ambiguous descriptions
```

### 4.4 Mock SpacetimeDB Module Info

For Story 4.3 unit tests, a mock of the SpacetimeDB module metadata is needed:

**Location:** `packages/client/src/__tests__/mocks/spacetimedb-module-mock.ts`

```typescript
// Provides mock implementations of:
// - getModuleReducers() -> [{ name, params: [{ name, type }] }]
// - getModuleTables() -> string[]
// - Based on known BitCraft module shape from Epic 1 (Story 1.4, 1.5)
```

### 4.5 Decision Log Schema

**Location:** `packages/client/src/agent/decision-log-schema.ts`

```typescript
interface DecisionLogEntry {
  timestamp: string;              // ISO 8601
  observation: string;            // Summary of observed game state
  semanticEvents: SemanticNarrative[];  // From Event Interpreter (Story 4.5)
  skillTriggered: {
    name: string;
    description: string;
    matchContext: string;          // Why this skill was selected
  } | null;
  action: {
    reducer: string;
    args: unknown[];
  } | null;
  cost: number | null;            // From action cost registry
  result: 'success' | 'failure' | 'skipped';
  outcome: string;                // Human-readable outcome
  error?: {
    code: string;
    boundary: string;
    message: string;
  };
  worldState?: Record<string, unknown>;  // Captured on failure
  agentConfig: {
    agentMdVersion: string;       // Hash or timestamp
    activeSkills: string[];       // Skill names
  };
  metrics: {
    decisionLatencyMs: number;    // Time from observation to action
    actionLatencyMs?: number;     // Time for publish round-trip
  };
}
```

### 4.6 Shared Test Utilities

**Reuse from Epics 1-3:**

- `ActionCostRegistry` from `packages/client/src/publish/action-cost-registry.ts`
- `SigilClient` from `packages/client/src/client.ts`
- Test factories from `packages/client/src/__tests__/factories/`

**New for Epic 4:**

- `createMockSkillFile(overrides?)` -- builds SKILL.md content string
- `createMockAgentMd(overrides?)` -- builds Agent.md content string
- `createMockTableUpdate(table, type, row?)` -- builds SpacetimeDB table update event
- `createMockDecisionContext(overrides?)` -- builds decision cycle input
- `assertValidJsonl(filePath)` -- validates JSONL file format
- `generateSkillFiles(count)` -- generates N synthetic skill files for performance tests

### 4.7 Conditional Test Execution

Integration tests for Story 4.3 follow the existing Docker-conditional pattern:

```typescript
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!runIntegrationTests)('SpacetimeDB Validation Integration Tests', () => {
  // Requires Docker stack with BitCraft server
});
```

**AGREEMENT-10 compliance:** Any integration test that cannot run without Docker must have real assertions (not `expect(true).toBe(true)`) and be tracked if using placeholder pattern.

---

## 5. Risk-Based Prioritization

### 5.1 Test Priority Allocation

| Priority                 | % of Effort | Focus Area                                                                              | Risk IDs                       |
| ------------------------ | ----------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| **P0 (Critical Path)**   | 50%         | Skill parser correctness, Agent.md parsing, budget enforcement, decision log schema     | R4-001, R4-003, R4-005         |
| **P1 (High Priority)**   | 30%         | SpacetimeDB validation, event interpretation, triggering precision, config swap         | R4-002, R4-004, R4-006, R4-010 |
| **P2 (Medium Priority)** | 15%         | Progressive disclosure, log rotation, path traversal security, performance testing      | R4-007, R4-008, R4-009         |
| **P3 (Low Priority)**    | 5%          | Edge cases, Unicode handling, large file handling, cosmetic error messages               | --                             |

### 5.2 Recommended Test Writing Order

Based on risk, dependency chain, and the story dependency graph (4.1 -> 4.2 -> 4.3 -> 4.7, with 4.4 and 4.5 independent, 4.6 after 4.4+4.5):

**Phase 1: Skill Parser Foundation (Story 4.1 -- write first, everything depends on it)**

1. `skill-parser.test.ts` -- Can we parse YAML frontmatter? (R4-001)
2. `skill-validation.test.ts` -- Are required fields enforced?
3. `skill-eval-parser.test.ts` -- Are evals parsed correctly?
4. `skill-loader.test.ts` -- Can we load a directory of skills?
5. `skill-progressive.test.ts` -- Does progressive disclosure work? (R4-007)

**Phase 2: Agent Configuration (Story 4.2 -- depends on 4.1)**

6. `agent-config-parser.test.ts` -- Can we parse Agent.md?
7. `skill-resolution.test.ts` -- Are skill references resolved? (R4-010)
8. `triggering-precision.test.ts` -- Are ambiguous descriptions detected? (R4-006)
9. `claude-md-generator.test.ts` -- Is CLAUDE.md generated correctly?

**Phase 3: Budget Tracking (Story 4.4 -- independent of 4.2/4.3)**

10. `budget-tracker.test.ts` -- Does budget initialization work?
11. `budget-publish-guard.test.ts` -- Is budget enforced before publish? (R4-003)
12. `budget-concurrency.test.ts` -- Is budget safe under concurrency? (R4-003)
13. `budget-warnings.test.ts` -- Are threshold warnings emitted?

**Phase 4: Event Interpretation (Story 4.5 -- independent)**

14. `event-interpreter.test.ts` -- Are table updates interpreted correctly? (R4-004)
15. `event-correlation.test.ts` -- Are multi-updates correlated?
16. `event-fallback.test.ts` -- Does graceful degradation work?

**Phase 5: Decision Logging (Story 4.6 -- after 4.4 + 4.5)**

17. `decision-logger.test.ts` -- Are decision entries structured correctly? (R4-005)
18. `decision-log-schema.test.ts` -- Is the schema valid?
19. `decision-log-rotation.test.ts` -- Does rotation work? (R4-009)
20. `decision-log-metrics.test.ts` -- Are eval metrics derivable?

**Phase 6: SpacetimeDB Validation (Story 4.3 -- after 4.1 + 4.2)**

21. `reducer-validator.test.ts` -- Are reducers validated against module? (R4-002)
22. `table-validator.test.ts` -- Are tables validated?
23. `validation-report.test.ts` -- Is the report structured?
24. `spacetimedb-validation.integration.test.ts` -- Real validation

**Phase 7: Config Swap (Story 4.7 -- after 4.1 + 4.2 + 4.3)**

25. `config-swap.test.ts` -- Does skill set swap on restart?
26. `multi-agent-config.test.ts` -- Are agents independent?
27. `config-versioning.test.ts` -- Are versions logged?

**Phase 8: Cross-Story Integration + Security**

28. Cross-story pipeline tests (Section 3)
29. Security tests (Section 6)
30. Performance tests (Section 7)

### 5.3 Which Tests Are Most Critical

The following tests, if they fail, indicate a fundamental problem that blocks the epic:

| Rank | Test                                                             | Why It's Critical                                                              |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | Skill file YAML frontmatter parsed correctly                    | If parsing fails, no skills can be loaded -- entire epic is blocked            |
| 2    | Agent.md skill references resolved from directory               | If resolution fails, agents cannot be configured -- core value proposition gone |
| 3    | Budget check rejects before Crosstown interaction               | If budget is not enforced, researchers lose spending control (R4-003)           |
| 4    | Decision log entry is valid JSONL                               | If logs are malformed, all experiment analysis is broken (R4-005)              |
| 5    | SpacetimeDB validation catches non-existent reducers            | If validation misses bad reducers, runtime failures replace config-time errors  |

---

## 6. Security Test Plan

### 6.1 OWASP Top 10 Compliance (AGREEMENT-2)

| OWASP Category                               | Epic 4 Relevance                                                    | Test Strategy                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **A01:2021 - Broken Access Control**         | LOW -- no auth boundaries in config parsing                         | Verify Agent.md budget cannot be bypassed by direct API calls                          |
| **A02:2021 - Cryptographic Failures**        | LOW -- no crypto in Epic 4 (identity handled by Epics 1-3)         | N/A (verify no new crypto code introduced)                                             |
| **A03:2021 - Injection**                     | **HIGH** -- file paths, YAML parsing, reducer names in validation  | Path traversal tests, YAML injection tests, reducer name sanitization                  |
| **A04:2021 - Insecure Design**               | MEDIUM -- error handling, graceful degradation                      | Every code path returns explicit success or error; no silent failures                  |
| **A05:2021 - Security Misconfiguration**     | MEDIUM -- file permissions, log file location                       | Log file path validation, skill directory bounds checking                              |
| **A06:2021 - Vulnerable Components**         | LOW -- YAML parser is the only new dependency                       | Audit YAML parser for known vulnerabilities                                            |
| **A07:2021 - Identification/Authentication** | LOW -- no auth in Epic 4 (identity from Epics 1-3)                 | N/A                                                                                    |
| **A09:2021 - Security Logging**              | MEDIUM -- decision logs contain game state, no secrets              | Verify no private keys, tokens, or credentials in decision logs                        |

### 6.2 Security Test Cases (~20 tests)

| Test ID    | Test Scenario                                                            | Expected Result                                           |
| ---------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| **SEC-01** | Skill directory path with `../` traversal                                | Rejected: path traversal blocked                          |
| **SEC-02** | Agent.md path with `../` traversal                                       | Rejected: path traversal blocked                          |
| **SEC-03** | Skill file with `name: ../../etc/passwd`                                 | Rejected: name validation fails                           |
| **SEC-04** | Reducer name with injection: `player_move; DROP TABLE`                   | Rejected: reducer name format validation (alphanumeric + _) |
| **SEC-05** | YAML bomb (alias expansion attack: `*anchor` repeated 1000x)            | Rejected: YAML parse depth/size limit                     |
| **SEC-06** | Skill file >10MB (DoS via oversized input)                               | Rejected: file size limit enforced                        |
| **SEC-07** | Decision log path outside allowed directory                              | Rejected: path validation                                 |
| **SEC-08** | Decision log entry does not contain private keys                         | Verified: no nsec, no hex private key patterns in log     |
| **SEC-09** | Decision log entry does not contain SPACETIMEDB_ADMIN_TOKEN              | Verified: no token patterns in log                        |
| **SEC-10** | Agent.md with budget limit cannot be bypassed by direct `publish()` call | Verified: budget guard is always invoked                  |
| **SEC-11** | Symlink in skill directory pointing outside allowed path                 | Rejected: symlink resolution checked                      |
| **SEC-12** | YAML with `!!python/object/apply:os.system` (arbitrary code execution)  | Rejected: safe YAML loading (no code execution tags)      |

---

## 7. Performance Test Plan

### 7.1 Performance Requirements

| Metric                                     | Requirement    | Source |
| ------------------------------------------ | -------------- | ------ |
| Skill file parsing (50 skills)             | <1s            | NFR7   |
| Agent.md + skill validation (50 skills)    | <1s            | NFR7   |
| Single skill metadata-only parse           | <10ms          | Design |
| Single decision log entry write            | <5ms           | Design |
| Event interpretation (single update)       | <10ms          | Design |
| Budget check (pre-publish)                 | <1ms           | Design |

### 7.2 Performance Test Scenarios (~8 tests)

| Test ID     | Scenario                                        | Target       | Metric                  |
| ----------- | ----------------------------------------------- | ------------ | ----------------------- |
| **PERF-01** | Parse 1 skill file (metadata only)              | <10ms        | Parse latency           |
| **PERF-02** | Parse 1 skill file (full with body)             | <20ms        | Parse latency           |
| **PERF-03** | Parse 50 skill files from directory             | <1s          | Total load time (NFR7)  |
| **PERF-04** | Validate 50 skills against SpacetimeDB          | <1s          | Validation time (NFR7)  |
| **PERF-05** | Budget check before publish                     | <1ms         | Check latency           |
| **PERF-06** | Interpret single table update event             | <10ms        | Interpretation latency  |
| **PERF-07** | Write single decision log entry                 | <5ms         | Write latency           |
| **PERF-08** | Write 10,000 decision log entries sequentially  | <30s         | Sustained throughput    |

---

## 8. Test Data & Fixtures

### 8.1 Skill File Fixtures

**Golden-path fixtures (from prototypes):**

Use the 3 prototype skill files directly in tests. These represent the "known good" format:

- `player-move.skill.md` -- Simple movement, 2 params, 3 evals (2 positive, 1 negative)
- `harvest-resource.skill.md` -- Resource gathering, 1 param, 4 evals (2 positive, 2 negative)
- `craft-item.skill.md` -- Crafting, 2 params (1 with default), 4 evals (2 positive, 2 negative)

**Negative test fixtures (synthetic):**

```yaml
# malformed-yaml.skill.md
---
name: broken
description: "unclosed quote
reducer: test
---
```

```yaml
# missing-fields.skill.md
---
name: incomplete
# Missing: description, reducer, params, subscriptions
---
```

```yaml
# invalid-reducer-name.skill.md
---
name: bad_reducer
description: Skill with invalid reducer name
reducer: "player move!!" # Contains space and special chars
params: []
subscriptions: []
---
```

### 8.2 Agent.md Fixtures

**Valid Agent.md:**

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

**Minimal Agent.md:**

```markdown
# Agent: Minimal

## Skills
- player_move
```

**Agent.md with missing skills:**

```markdown
# Agent: Bad References

## Skills
- player_move
- nonexistent_skill
- another_missing_skill
```

### 8.3 Decision Log Fixtures

**Valid JSONL entry:**

```json
{"timestamp":"2026-03-14T12:00:00.000Z","observation":"Player at (100,200), 3 resource nodes nearby","semanticEvents":[{"narrative":"Player Alice moved from (95,198) to (100,200)","table":"player_state","type":"update"}],"skillTriggered":{"name":"harvest_resource","description":"Begin harvesting a resource node","matchContext":"Agent near resource node, gathering intent detected"},"action":{"reducer":"harvest_start","args":[42]},"cost":100,"result":"success","outcome":"Harvest initiated on resource node 42","agentConfig":{"agentMdVersion":"abc123","activeSkills":["player_move","harvest_resource"]},"metrics":{"decisionLatencyMs":150,"actionLatencyMs":1200}}
```

**Failed action entry:**

```json
{"timestamp":"2026-03-14T12:01:00.000Z","observation":"Player at (100,200), budget nearly exhausted","semanticEvents":[],"skillTriggered":{"name":"craft_item","description":"Craft an item using a recipe","matchContext":"Player wants to craft wooden sword"},"action":{"reducer":"craft_item","args":[15,1]},"cost":200,"result":"failure","outcome":"Budget exceeded","error":{"code":"BUDGET_EXCEEDED","boundary":"agent","message":"Action cost 200 exceeds remaining budget 150"},"worldState":{"playerPosition":[100,200],"budget":{"spent":850,"limit":1000,"remaining":150}},"agentConfig":{"agentMdVersion":"abc123","activeSkills":["player_move","harvest_resource","craft_item"]},"metrics":{"decisionLatencyMs":50}}
```

### 8.4 SpacetimeDB Module Metadata Fixtures

**Mock reducer list (for validation tests):**

```typescript
export const MOCK_REDUCERS = [
  { name: 'player_move', params: [{ name: 'identity', type: 'String' }, { name: 'target_x', type: 'i32' }, { name: 'target_y', type: 'i32' }] },
  { name: 'harvest_start', params: [{ name: 'identity', type: 'String' }, { name: 'resource_id', type: 'u64' }] },
  { name: 'craft_item', params: [{ name: 'identity', type: 'String' }, { name: 'recipe_id', type: 'u64' }, { name: 'quantity', type: 'u32' }] },
  { name: 'chat_post_message', params: [{ name: 'identity', type: 'String' }, { name: 'message', type: 'String' }] },
  { name: 'player_teleport_home', params: [{ name: 'identity', type: 'String' }] },
];

export const MOCK_TABLES = [
  'player_state', 'terrain', 'resource_node', 'inventory',
  'item_desc', 'recipe_desc', 'player_desc',
];
```

### 8.5 Table Update Event Fixtures

```typescript
export const TABLE_UPDATE_FIXTURES = {
  playerMove: {
    table: 'player_state',
    type: 'update' as const,
    rowId: 'player_abc123',
    oldRow: { id: 'abc123', position_x: 95, position_y: 198, display_name: 'Alice' },
    newRow: { id: 'abc123', position_x: 100, position_y: 200, display_name: 'Alice' },
  },
  inventoryAdd: {
    table: 'inventory',
    type: 'insert' as const,
    rowId: 'inv_001',
    newRow: { player_id: 'abc123', item_id: 42, quantity: 1 },
  },
  resourceDepleted: {
    table: 'resource_node',
    type: 'delete' as const,
    rowId: 'res_007',
    oldRow: { id: 7, type: 'tree', quantity: 0 },
  },
  unknownTable: {
    table: 'some_internal_table',
    type: 'update' as const,
    rowId: 'unknown_001',
    oldRow: { value: 1 },
    newRow: { value: 2 },
  },
};
```

---

## 9. Quality Gates

### 9.1 Story-Level Gates

| Gate                         | Requirement                            | Validation                         |
| ---------------------------- | -------------------------------------- | ---------------------------------- |
| TDD Compliance (AGREEMENT-1) | Tests written before implementation    | Review test file commit timestamps |
| P0 AC Coverage               | 100% of P0 criteria have passing tests | Automated traceability             |
| OWASP Review (AGREEMENT-2)   | OWASP Top 10 review completed          | Security checklist                 |
| No Placeholders (AGREEMENT-10) | No `expect(true).toBe(true)` tests   | Test review                        |
| Pair Review (AGREEMENT-3)    | Pair review if unfamiliar tech         | Review record (likely not needed)  |

### 9.2 Epic-Level Gates

| Gate          | Requirement                                         | Threshold               |
| ------------- | --------------------------------------------------- | ----------------------- |
| Test Coverage | >=95% line coverage for all new Epic 4 code         | Hard requirement        |
| Regression    | All 984 existing tests pass                         | 100% pass rate          |
| P0 ACs        | All 35 P0 acceptance criteria have tests            | 100%                    |
| Integration   | SpacetimeDB validation tests pass with Docker       | 100% (conditional)      |
| Performance   | NFR7 (<1s for 50 skills) validated                  | Performance test passes |
| Security      | Zero high-severity security issues                  | OWASP compliant         |

### 9.3 Epic Completion Criteria

Epic 4 is COMPLETE when:

1. All 7 stories delivered (4.1 through 4.7)
2. All 35 acceptance criteria met (100%)
3. All ~351 tests passing (100% pass rate)
4. Test coverage >=95% for all new `packages/client/src/agent/` code
5. Integration tests pass for Story 4.3 (SpacetimeDB validation with Docker)
6. Performance tests validate NFR7 (<1s for 50 skills)
7. Security review complete (OWASP Top 10, zero high-severity)
8. Existing 984 tests continue to pass (regression)
9. No placeholder integration tests (AGREEMENT-10)
10. Decision log schema documented and validated
11. 3 prototype skill files parse correctly as golden-path validation

---

## Test Count Summary

| Story                       | Unit Tests | Integration Tests | Total    |
| --------------------------- | ---------- | ----------------- | -------- |
| 4.1: Skill File Parser      | 55         | 0                 | 55       |
| 4.2: Agent.md Configuration | 50         | 0                 | 50       |
| 4.3: SpacetimeDB Validation | 30         | 15                | 45       |
| 4.4: Budget Tracking        | 45         | 0                 | 45       |
| 4.5: Event Interpretation   | 40         | 0                 | 40       |
| 4.6: Decision Logging       | 50         | 0                 | 50       |
| 4.7: Swappable Config       | 30         | 0                 | 30       |
| **Cross-Story Integration** | --         | 36                | 36       |
| **Security Tests**          | 20         | --                | 20       |
| **Performance Tests**       | 8          | --                | 8        |
| **Total**                   | **328**    | **51**            | **~379** |

**Realistic estimate after implementation refinement: ~351 tests** (accounting for test consolidation and overlap in cross-story tests).

**Test Pyramid Distribution:**

- Unit: 86% (~328 tests) -- fast feedback, deterministic, no external dependencies
- Integration: 14% (~51 tests) -- SpacetimeDB validation + cross-story pipelines

The higher unit test percentage (vs. Epic 3's 58/42 split) reflects the nature of Epic 4: client-side parsing and transformation logic that is deterministic and testable without external systems. Only Story 4.3 (SpacetimeDB validation) requires integration tests with Docker.

---

## Appendix A: Dependency on Existing Test Infrastructure

Epic 4 tests reuse the following from Epics 1-3:

| Component                     | Source                                                        | Used By           |
| ----------------------------- | ------------------------------------------------------------- | ----------------- |
| Action Cost Registry          | `packages/client/src/publish/action-cost-registry.ts`         | Story 4.4 (budget) |
| SpacetimeDB Connection        | `packages/client/src/spacetimedb/connection.ts`               | Story 4.3 (validation) |
| Static Data Loader            | `packages/client/src/spacetimedb/static-data-loader.ts`       | Story 4.5 (display names) |
| Client Publish Pipeline       | `packages/client/src/client.ts` (`client.publish`)            | Story 4.4 (budget guard) |
| Test Factories                | `packages/client/src/__tests__/factories/`                    | Multiple stories   |
| Docker conditional skip       | `process.env.RUN_INTEGRATION_TESTS`                           | Story 4.3          |

## Appendix B: Mapping Epic 4 to Functional Requirements

| FR   | Description                                      | Story | Test Coverage                                              |
| ---- | ------------------------------------------------ | ----- | ---------------------------------------------------------- |
| FR9  | Event interpretation as semantic narratives       | 4.5   | `event-interpreter.test.ts` (15 tests)                     |
| FR11 | Agent.md configuration (zero code)               | 4.2   | `agent-config-parser.test.ts` (15 tests)                   |
| FR12 | Skill selection via Agent.md                     | 4.2   | `skill-resolution.test.ts` (12 tests)                      |
| FR13 | Skill file format (reducer, params, subscriptions)| 4.1   | `skill-parser.test.ts` (18 tests)                          |
| FR14 | Validation against SpacetimeDB module            | 4.3   | `reducer-validator.test.ts` + `table-validator.test.ts` (20 tests) |
| FR15 | Budget limits per agent                          | 4.4   | `budget-tracker.test.ts` + `budget-publish-guard.test.ts` (27 tests) |
| FR27 | Swappable agent behavior via config changes      | 4.7   | `config-swap.test.ts` (10 tests)                           |
| FR39 | Structured decision logging (JSONL)              | 4.6   | `decision-logger.test.ts` + `decision-log-schema.test.ts` (25 tests) |

## Appendix C: NFR Validation Matrix

| NFR    | Requirement                                | Story | Test Strategy                                                |
| ------ | ------------------------------------------ | ----- | ------------------------------------------------------------ |
| NFR7   | Skill parsing + validation <1s for 50 skills | 4.1, 4.3 | Performance tests PERF-03, PERF-04                        |
| NFR16  | Log rotation at 100MB                       | 4.6   | `decision-log-rotation.test.ts` (8 tests)                   |
| NFR21  | Skill format consumed uniformly by all frontends | 4.1 | `skill-parser.test.ts` interface validation                 |
| NFR25  | Agent config stateless, re-read on restart  | 4.2, 4.7 | `config-stateless.test.ts`, `config-swap.test.ts`         |
