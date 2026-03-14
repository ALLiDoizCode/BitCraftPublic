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
  - '_bmad-output/implementation-artifacts/4-1-skill-file-format-and-parser.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/test-design-epic-4.md'
  - '_bmad-output/planning-artifacts/skill-file-examples/SCHEMA.md'
  - '_bmad-output/planning-artifacts/skill-file-examples/player-move.skill.md'
  - '_bmad-output/planning-artifacts/skill-file-examples/harvest-resource.skill.md'
  - '_bmad-output/planning-artifacts/skill-file-examples/craft-item.skill.md'
  - 'packages/bitcraft-bls/src/content-parser.ts'
  - 'packages/client/src/index.ts'
  - 'packages/client/package.json'
---

# ATDD Checklist - Epic 4, Story 4.1: Skill File Format & Parser

**Date:** 2026-03-14
**Author:** TEA Agent (ATDD workflow)
**Agent Model:** Claude Opus 4.6 (claude-opus-4-6)
**Primary Test Level:** Unit (backend, vitest)
**Total Tests Generated:** 60 (13 + 8 + 10 + 14 + 8 + 7)
**RED Phase Status:** All unit tests skipped with `it.skip()` -- stub modules created for types, parser, loader, registry

---

## Story Summary

Story 4.1 is the **foundation story for Epic 4** -- everything else depends on skill files being parseable. It establishes the SKILL.md file format parser with YAML frontmatter extraction, behavioral eval parsing, directory loading with error isolation, and a skill action registry. The format follows the Standard Claude Agent Skills convention with YAML frontmatter.

**As a** researcher,
**I want** to define game actions as SKILL.md files with reducer mappings, parameters, and usage guidance,
**So that** I can declaratively specify what actions an agent can perform.

---

## Acceptance Criteria

1. **AC1 - YAML frontmatter field extraction** (FR13): Parse SKILL.md files extracting name, description, reducer, params, subscriptions, tags, and body. ILP cost NOT declared in skill files.

2. **AC2 - Behavioral eval parsing** (FR13): Parse `evals` section with positive evals (`{ reducer, args }`) and negative evals (`skill_not_triggered`).

3. **AC3 - Directory loading with error isolation** (NFR7): Load all `.skill.md` files from a directory, register in action registry, complete within 1s for 50 skills.

4. **AC4 - Malformed file error handling**: Clear errors identifying file and missing/invalid fields. Valid skills from same directory still loaded.

5. **AC5 - Uniform consumption format** (NFR21): Single `Skill`/`SkillMetadata` interface consumed uniformly by MCP server, TUI backend, direct import.

6. **AC6 - Progressive disclosure**: Metadata loaded eagerly via `parseSkillMetadata()`, full body and evals loaded on demand via `parseSkillFile()`.

---

## Preflight Summary

**Stack detected:** backend (Node.js + TypeScript + vitest)
**Test framework:** vitest (configured in packages/client/vitest.config.ts)
**Existing patterns:** 30 test files in packages/client/src/, 2 test factories (bls-error, nostr-event)
**Knowledge loaded:** data-factories, test-quality, test-levels-framework, test-priorities-matrix
**E2E/Playwright:** Not applicable (backend-only story, no UI impact)
**New dependency:** gray-matter (YAML frontmatter parser, uses js-yaml DEFAULT_SCHEMA)

---

## Test Strategy - AC to Test Level Mapping

| AC       | Test Level | Test File                    | Test Count | Priority |
| -------- | ---------- | ---------------------------- | ---------- | -------- |
| AC1, AC4 | Unit       | skill-parser.test.ts         | 13         | P0       |
| AC1, AC4 | Unit       | skill-validation.test.ts     | 8          | P0       |
| AC2      | Unit       | skill-eval-parser.test.ts    | 10         | P0       |
| AC3, AC4, AC6 | Unit  | skill-loader.test.ts         | 14         | P0       |
| AC3, AC5 | Unit       | skill-registry.test.ts       | 8          | P0       |
| AC6      | Unit       | skill-progressive.test.ts    | 7          | P0       |

---

## Test Files Created

### 1. `packages/client/src/agent/__tests__/skill-parser.test.ts` (13 tests)

**Covers:** AC1, AC4
**Tests:**

- `parses player-move.skill.md prototype -> extracts all fields correctly`
- `parses harvest-resource.skill.md -> extracts all fields including tags`
- `parses craft-item.skill.md -> extracts default value for quantity param`
- `ILP cost is NOT present in parsed output (verify absence)`
- `parses skill file with no tags -> tags is undefined`
- `throws MISSING_FRONTMATTER for file without --- delimiters`
- `throws MISSING_REQUIRED_FIELD for empty frontmatter (---\n---)`
- `throws SkillParseError identifying file and missing name field`
- `throws SkillParseError identifying file and missing reducer field`
- `rejects file >10MB with PARSE_ERROR (OWASP A03 DoS prevention)`
- `rejects YAML with custom tags (!!js/function) -- js-yaml DEFAULT_SCHEMA blocks code execution`
- `parses skill file with empty params array -> valid`
- `throws INVALID_YAML for malformed YAML content`

### 2. `packages/client/src/agent/__tests__/skill-validation.test.ts` (8 tests)

**Covers:** AC1, AC4
**Tests:**

- `accepts valid reducer name: 1-64 chars, alphanumeric + underscore`
- `rejects reducer with spaces -> INVALID_REDUCER_NAME`
- `rejects reducer name >64 chars -> INVALID_REDUCER_NAME`
- `rejects invalid param type (int instead of i32) -> INVALID_PARAM_TYPE`
- `rejects missing params array -> MISSING_REQUIRED_FIELD`
- `rejects missing subscriptions array -> MISSING_REQUIRED_FIELD`
- `rejects param entry missing name -> error`
- `rejects subscription entry missing table -> error`

### 3. `packages/client/src/agent/__tests__/skill-eval-parser.test.ts` (10 tests)

**Covers:** AC2
**Tests:**

- `parses positive eval: { prompt, expected: { reducer, args }, criteria } extracted correctly`
- `parses negative eval: { prompt, expected: skill_not_triggered, criteria }`
- `parses eval with args: null (runtime-dependent) -> parsed with null args`
- `parses mixed positive and negative evals in same file -> all extracted`
- `missing evals section -> empty array (optional field)`
- `parses craft-item evals with mixed positive (null args) and negative evals`
- `eval missing prompt -> error`
- `eval missing criteria -> error`
- `eval with expected as string skill_not_triggered (YAML unquoted) parses correctly`
- `eval with expected object containing both reducer and args fields parses correctly`

### 4. `packages/client/src/agent/__tests__/skill-loader.test.ts` (14 tests)

**Covers:** AC3, AC4, AC6
**Tests:**

- `loads directory with 3 prototype files -> 3 skills registered`
- `loads directory with 1 valid + 1 malformed -> 1 skill loaded, 1 error reported`
- `empty directory -> empty result, no error`
- `non-.skill.md files are ignored`
- `performance: loads 50 skills in <1 second (NFR7)`
- `directory with path traversal attempt -> rejected`
- `non-existent directory -> clear error`
- `directory with all malformed files -> empty skills, all errors reported`
- `loads multiple valid files with distinct names -> all registered`
- `loadSkillDirectoryMetadata() returns metadata-only (no body, no evals)`
- `loadSkillDirectoryMetadata() has same error isolation as full load`
- `loadSkillDirectoryMetadata() with empty directory -> empty result`
- `loadSkillDirectoryMetadata() includes tags in metadata`
- `loadSkillDirectoryMetadata() is faster than full load for many files`

### 5. `packages/client/src/agent/__tests__/skill-registry.test.ts` (8 tests)

**Covers:** AC3, AC5
**Tests:**

- `register and retrieve skill by name`
- `duplicate name registration -> SkillParseError with DUPLICATE_SKILL_NAME`
- `get non-existent skill -> undefined`
- `getAll() returns all registered skills`
- `getAllMetadata() returns metadata only (no body, no evals)`
- `has() returns true for registered skill, false for unregistered`
- `size getter accurate after add/clear`
- `createSkillRegistryFromDirectory() integrates loader + registry`

### 6. `packages/client/src/agent/__tests__/skill-progressive.test.ts` (7 tests)

**Covers:** AC6
**Tests:**

- `parseSkillMetadata() returns name, description, reducer, params, subscriptions, tags`
- `parseSkillMetadata() does NOT include markdown body`
- `parseSkillMetadata() does NOT include evals`
- `full parseSkillFile() returns everything including body and evals`
- `metadata from parseSkillMetadata() matches metadata subset of parseSkillFile()`
- `registry getMetadata() returns metadata without body`
- `metadata-only parse is measurably faster than full parse`

---

## Stub Modules Created

### `packages/client/src/agent/types.ts`

**Purpose:** Full type definitions (not stubs) -- types are final.
**Contents:**

- `SkillParamType` type (9 SpacetimeDB types)
- `SkillParam` interface (name, type, description, default?)
- `SkillSubscription` interface (table, description)
- `SkillExpected` interface (reducer, args)
- `SkillEval` interface (prompt, expected, criteria)
- `SkillMetadata` interface (name, description, reducer, params, subscriptions, tags?)
- `Skill` interface (extends SkillMetadata + body, evals)
- `SkillParseErrorCode` type (7 error codes)
- `SkillParseError` class (extends Error, code, filePath, fields?)

### `packages/client/src/agent/skill-parser.ts`

**Purpose:** TDD RED phase stub -- function signatures that throw NOT_IMPLEMENTED.
**Contents:**

- `parseSkillFile()` function -- throws `NOT_IMPLEMENTED`
- `parseSkillMetadata()` function -- throws `NOT_IMPLEMENTED`

### `packages/client/src/agent/skill-loader.ts`

**Purpose:** TDD RED phase stub -- function signatures and interfaces.
**Contents:**

- `SkillLoadResult` interface (skills: Map, errors: SkillParseError[])
- `SkillMetadataLoadResult` interface (skills: Map, errors: SkillParseError[])
- `loadSkillDirectory()` function -- throws `NOT_IMPLEMENTED`
- `loadSkillDirectoryMetadata()` function -- throws `NOT_IMPLEMENTED`

### `packages/client/src/agent/skill-registry.ts`

**Purpose:** TDD RED phase stub -- class with method signatures.
**Contents:**

- `SkillRegistry` class with all methods throwing `NOT_IMPLEMENTED`
- `createSkillRegistryFromDirectory()` factory -- throws `NOT_IMPLEMENTED`

### `packages/client/src/agent/index.ts`

**Purpose:** Barrel re-exports for the agent module.
**Contents:**

- Re-exports all types, parser functions, loader functions, registry class

---

## Test Fixtures

### Prototype Files (copied to test fixtures)

- `packages/client/src/agent/__tests__/fixtures/skills/player-move.skill.md`
- `packages/client/src/agent/__tests__/fixtures/skills/harvest-resource.skill.md`
- `packages/client/src/agent/__tests__/fixtures/skills/craft-item.skill.md`

### Synthetic Fixtures (inline in test code)

- Malformed YAML content (various)
- Missing required fields (name, reducer, params, subscriptions)
- Invalid reducer name (spaces, >64 chars)
- Invalid param type (`int` instead of `i32`)
- No evals section (valid file without evals)
- Oversized content (>10MB)
- YAML with custom tags (!!js/function)
- Empty frontmatter (---\n---)
- Param entry missing name
- Subscription entry missing table
- Eval missing prompt
- Eval missing criteria

---

## Implementation Checklist for DEV Team

### RED Phase (TEA -- COMPLETE)

- [x] All 60 unit acceptance tests generated with `it.skip()`
- [x] Stub modules created with interfaces and throw-not-implemented functions
- [x] Type definitions finalized (not stubs -- types.ts is production-ready)
- [x] Test fixtures copied from prototype skill files
- [x] Barrel exports and package index updated
- [x] Full regression suite passes (all existing 879 tests pass, 60 new tests properly skipped)
- [x] Lint passes (no errors)
- [x] Build passes (ESM + CJS + DTS)
- [x] No test interdependencies (all tests independent)

### GREEN Phase (DEV -- TODO)

For each item below, remove the `it.skip()` from related tests, implement the feature, and verify tests pass.

1. **Task 1: Implement parseSkillFile() and parseSkillMetadata()**
   - Remove `it.skip()` from skill-parser.test.ts (13 tests)
   - Remove `it.skip()` from skill-validation.test.ts (8 tests)
   - Remove `it.skip()` from skill-eval-parser.test.ts (10 tests)
   - Remove `it.skip()` from skill-progressive.test.ts (7 tests)
   - Implement `packages/client/src/agent/skill-parser.ts`:
     - Use `gray-matter` to split YAML frontmatter from markdown body
     - Validate required fields: name, description, reducer, params, subscriptions
     - Validate reducer name regex: `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`
     - Validate param types against `SkillParamType`
     - Parse evals with positive/negative eval support
     - File size check: reject >10MB before parsing
     - `parseSkillMetadata()`: return frontmatter fields only (no body, no evals)
   - Tests: `npx vitest run src/agent/__tests__/skill-parser.test.ts src/agent/__tests__/skill-validation.test.ts src/agent/__tests__/skill-eval-parser.test.ts src/agent/__tests__/skill-progressive.test.ts`

2. **Task 2: Implement loadSkillDirectory() and loadSkillDirectoryMetadata()**
   - Remove `it.skip()` from skill-loader.test.ts (14 tests)
   - Implement `packages/client/src/agent/skill-loader.ts`:
     - Read all `*.skill.md` files from directory
     - Parse each file independently with error isolation
     - Path traversal validation: reject `..` sequences
     - Parallel loading with `Promise.all`
     - Metadata-only variant skips body and evals
   - Tests: `npx vitest run src/agent/__tests__/skill-loader.test.ts`

3. **Task 3: Implement SkillRegistry and createSkillRegistryFromDirectory()**
   - Remove `it.skip()` from skill-registry.test.ts (8 tests)
   - Implement `packages/client/src/agent/skill-registry.ts`:
     - `register()`: add skill by name, throw on duplicate
     - `get()`, `getMetadata()`, `getAll()`, `getAllMetadata()`, `has()`, `size`, `clear()`
     - `createSkillRegistryFromDirectory()`: combine loader + registry
   - Tests: `npx vitest run src/agent/__tests__/skill-registry.test.ts`

### REFACTOR Phase (DEV -- after GREEN)

- Remove TDD RED phase comments from stub modules
- Remove `_` prefix from parameter names in implementation files
- Review error messages for consistency with existing patterns
- Verify no `any` types in new code
- Security review: OWASP A03 (injection), A05 (security misconfiguration)
- Update story doc: Dev Agent Record section

---

## Running Tests

```bash
# Run all new agent tests
cd packages/client && npx vitest run src/agent/__tests__/

# Run a specific test file
cd packages/client && npx vitest run src/agent/__tests__/skill-parser.test.ts

# Run tests in watch mode (TDD)
cd packages/client && npx vitest src/agent/__tests__/skill-parser.test.ts

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
- [x] 60 unit tests created at unit level (all `it.skip()` for TDD RED phase)
- [x] No integration tests needed (pure file parsing, no Docker dependency)
- [x] Given-When-Then format used consistently across all tests
- [x] RED phase verified by local test run (60 tests skipped, 879 existing pass)
- [x] Test factories created for test data (createTestSkill, createSkillContent, validSkillContent)
- [x] No hardcoded test data (factories with overrides and inline fixtures used throughout)
- [x] No test interdependencies (all tests independent, can run in any order)
- [x] No flaky patterns (deterministic tests, mocked console, temp directories cleaned up)
- [x] Security tests included (OWASP A03: oversized file, custom YAML tags, path traversal, reducer regex)
- [x] Performance tests included (NFR7: 50 skills in <1s)
- [x] Implementation checklist created with red-green-refactor guidance
- [x] Execution commands provided and verified
- [x] Lint passes (0 errors after underscore-prefixed stub params)
- [x] Build passes (ESM + CJS + DTS all produce correctly)
- [x] Prototype skill files copied to test fixtures directory
