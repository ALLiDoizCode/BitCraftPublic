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
  - '_bmad-output/implementation-artifacts/4-3-configuration-validation-against-spacetimedb.md'
  - '_bmad-output/test-artifacts/atdd-checklist-4-2.md'
  - 'packages/client/src/agent/types.ts'
  - 'packages/client/src/agent/agent-config-types.ts'
  - 'packages/client/src/agent/index.ts'
  - 'packages/client/src/index.ts'
  - 'packages/client/vitest.config.ts'
---

# ATDD Checklist - Epic 4, Story 4.3: Configuration Validation Against SpacetimeDB

**Date:** 2026-03-14
**Author:** TEA Agent (ATDD workflow)
**Agent Model:** Claude Opus 4.6 (claude-opus-4-6)
**Primary Test Level:** Unit (backend, vitest) + Integration (Docker-conditional)
**Total Tests Generated:** 55 (40 unit + 15 integration)
**Phase Status:** GREEN -- all unit tests passing, integration tests Docker-conditional

---

## Story Summary

Story 4.3 connects the client-side configuration parsing (Stories 4.1, 4.2) to the live SpacetimeDB module to validate that skill files reference actual reducers and tables. This is the ONLY story in Epic 4 that requires a live SpacetimeDB connection; all other stories are pure client-side logic.

**As a** researcher,
**I want** the system to validate my agent config and skill files against the connected SpacetimeDB module,
**So that** I catch configuration errors before runtime failures.

---

## Acceptance Criteria

1. **AC1 - Reducer existence validation** (FR14): Each skill's target reducer is confirmed to exist in the module's available reducers. Reducer parameter types checked for compatibility.

2. **AC2 - Non-existent reducer error**: Actionable error: "Skill 'harvest_resource' references reducer 'harvest_resource' but SpacetimeDB module does not expose this reducer". Error identifies skill by name.

3. **AC3 - Table subscription validation** (FR14): Each required table is confirmed to exist in the SpacetimeDB module's table list.

4. **AC4 - Full validation report** (NFR7): Validation report produced listing all passed checks and any failures. Validation completes within 1 second for up to 50 skills.

---

## Preflight Summary

**Stack detected:** backend (Node.js + TypeScript + vitest)
**Test framework:** vitest (configured in packages/client/vitest.config.ts, globals: true)
**Existing patterns:** Stories 4.1-4.2 tests in packages/client/src/agent/__tests__/ (126 tests, 10 files)
**Knowledge loaded:** data-factories, test-quality, test-levels-framework
**E2E/Playwright:** Not applicable (backend-only story, no UI)
**New dependencies:** None (uses Node.js built-in fetch for HTTP requests)

---

## Test Strategy - AC to Test Level Mapping

| AC | Test Level | Test File | Test Count | Priority |
|----|-----------|-----------|------------|----------|
| AC1, AC2 | Unit | reducer-validator.test.ts | 12 | P0 |
| AC3 | Unit | table-validator.test.ts | 8 | P0 |
| AC1, AC3 | Unit | module-info-fetcher.test.ts | 8 | P0 |
| AC4 | Unit | validation-report.test.ts | 8 | P0 |
| AC1-4 | Unit | validation-offline.test.ts | 4 | P0 |
| AC1, AC3, AC4 | Integration | spacetimedb-validation.integration.test.ts | 10 | P1 |
| AC1, AC2, AC3 | Integration | validation-error.integration.test.ts | 5 | P1 |

---

## Test Files Created

### 1. `packages/client/src/agent/__tests__/reducer-validator.test.ts` (12 tests)

**Covers:** AC1, AC2
**Tests:**

- `skill references player_move reducer present in module -> passes`
- `reducer params match skill params (offset by 1 for identity) -> passes`
- `skill with zero params, reducer with only identity param -> passes`
- `skill with params matching module after identity offset -> detailed param-by-param validation`
- `all 3 prototype skill reducers validated against mock module -> all pass`
- `skill references nonexistent_reducer -> fails with actionable message matching AC2 format`
- `reducer params type mismatch (e.g., skill says i32, module says u32) -> fails with param_compatibility check`
- `reducer has fewer params than skill expects -> fails`
- `reducer has more params than skill expects -> fails (extra params not provided)`
- `multiple skills: one valid, one invalid reducer -> two results, one pass, one fail`
- `empty skills array -> empty results array`
- `module with zero reducers -> all skills fail`

### 2. `packages/client/src/agent/__tests__/table-validator.test.ts` (8 tests)

**Covers:** AC3
**Tests:**

- `skill requires player_state table present in module -> passes`
- `skill requires nonexistent_table -> fails with actionable message`
- `skill requires multiple tables, all present -> all pass`
- `skill requires multiple tables, one missing -> one fail, rest pass`
- `skill with zero subscriptions -> no table checks (valid)`
- `multiple skills with overlapping table requirements -> each checked independently`
- `empty skills array -> empty results array`
- `module with zero tables -> all table checks fail`

### 3. `packages/client/src/agent/__tests__/module-info-fetcher.test.ts` (8 tests)

**Covers:** AC1, AC3 (SSRF, timeout, error handling)
**Tests:**

- `getModuleInfo() with mocked successful fetch -> returns parsed ModuleInfo`
- `getModuleInfo() with mocked 500 response -> throws MODULE_FETCH_FAILED`
- `getModuleInfo() with mocked network error -> throws MODULE_FETCH_FAILED`
- `getModuleInfo() with mocked timeout (AbortError) -> throws VALIDATION_TIMEOUT`
- `getModuleInfo() with mocked malformed JSON response -> throws MODULE_FETCH_FAILED`
- `SSRF protection: URL with ftp:// scheme -> throws MODULE_FETCH_FAILED`
- `response size limit: mocked response > 10MB -> throws MODULE_FETCH_FAILED`
- `createOfflineModuleInfo() creates valid ModuleInfo with given reducer names and table names`

### 4. `packages/client/src/agent/__tests__/validation-report.test.ts` (8 tests)

**Covers:** AC4, NFR7
**Tests:**

- `all checks pass -> report passed: true, all results listed`
- `one check fails -> report passed: false, failure identified`
- `report includes timestamp in ISO 8601 format`
- `report includes durationMs >= 0`
- `report includes correct skillCount`
- `formatValidationReport() produces human-readable output with pass/fail counts`
- `formatValidationReport() on empty report (no checks) -> valid output`
- `50 skills validated in < 1 second using offline validation with mock ModuleInfo (NFR7)`

### 5. `packages/client/src/agent/__tests__/validation-offline.test.ts` (4 tests)

**Covers:** AC1-4 (offline mode)
**Tests:**

- `validateAgentConfigOffline() with all-valid moduleInfo -> report passes`
- `validateAgentConfigOffline() with invalid reducer -> report fails`
- `validateAgentConfigOffline() with invalid table -> report fails`
- `offline validation does NOT call getModuleInfo() (no network)`

### 6. `packages/client/src/agent/__tests__/spacetimedb-validation.integration.test.ts` (10 tests)

**Covers:** AC1, AC3, AC4
**Conditional:** `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)`
**Tests:**

- `module info fetch succeeds and returns non-empty reducer and table lists`
- `player_move reducer exists in live BitCraft module`
- `harvest_start reducer exists in live module`
- `craft_item reducer exists in live module`
- `player_state table exists in live module`
- `terrain table exists in live module`
- `inventory table exists in live module`
- `module info includes expected reducer parameter signatures`
- `full validation pipeline: load 3 prototype skills, validate against live module`
- `performance: validation of 3 skills completes in < 1 second`

### 7. `packages/client/src/agent/__tests__/validation-error.integration.test.ts` (5 tests)

**Covers:** AC1, AC2, AC3
**Conditional:** `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)`
**Tests:**

- `non-existent reducer does_not_exist -> validation fails with actionable error`
- `non-existent table does_not_exist_table -> validation fails`
- `skill with wrong param count vs live module -> param compatibility failure`
- `skill with wrong param types vs live module -> param type mismatch`
- `module info fetch to wrong URL -> MODULE_FETCH_FAILED error`

---

## Test Mocks Created

### `packages/client/src/agent/__tests__/mocks/module-info-mock.ts`

**Purpose:** Mock factories for ModuleInfo and ModuleInfoProvider.
**Contents:**

- `createMockModuleInfo(overrides?)` -- BitCraft-like reducers (player_move, harvest_start, craft_item with full params) and tables (player_state, terrain, resource_node, inventory, item_desc, recipe_desc)
- `createMockModuleInfoProvider(moduleInfo?)` -- resolving ModuleInfoProvider
- `createFailingModuleInfoProvider(error)` -- throwing ModuleInfoProvider

---

## Source Files Created

### `packages/client/src/agent/config-validation-types.ts`

- `ModuleReducerParam` interface
- `ModuleReducerInfo` interface
- `ModuleInfo` interface
- `ValidationCheckType` type
- `ValidationCheckResult` interface
- `ValidationReport` interface
- `ConfigValidationErrorCode` type
- `ConfigValidationError` class (extends Error)
- `ModuleInfoProvider` interface

### `packages/client/src/agent/module-info-fetcher.ts`

- `ModuleInfoFetcherConfig` interface
- `SpacetimeDBModuleInfoFetcher` class (implements ModuleInfoProvider)
- `createOfflineModuleInfo()` factory function

### `packages/client/src/agent/reducer-validator.ts`

- `validateReducers()` function with identity parameter offset handling

### `packages/client/src/agent/table-validator.ts`

- `validateTables()` function

### `packages/client/src/agent/config-validator.ts`

- `validateAgentConfig()` async function (online mode)
- `validateAgentConfigOffline()` sync function (offline mode)
- `formatValidationReport()` function

---

## FR/NFR Traceability

| Requirement | ACs | Tests | Status |
|-------------|-----|-------|--------|
| FR14 (Validation against SpacetimeDB module) | AC1, AC2, AC3, AC4 | 40 unit + 15 integration | COVERED |
| NFR7 (Skill parsing + validation <1s for 50 skills) | AC4 | validation-report.test.ts (50-skill perf test) | COVERED |

---

## Validation Checklist

- [x] Story acceptance criteria analyzed and mapped to test levels
- [x] 40 unit tests created at unit level (all passing)
- [x] 15 integration tests created (Docker-conditional, `RUN_INTEGRATION_TESTS`)
- [x] Given-When-Then format used consistently across all tests
- [x] GREEN phase verified by local test run (40 new unit tests pass, 831 total client tests pass)
- [x] Test factories created (createSkill, createResolvedConfig, createMockModuleInfo, createMockModuleInfoProvider, createFailingModuleInfoProvider)
- [x] No hardcoded test data (factories with overrides used throughout)
- [x] No test interdependencies (all tests independent)
- [x] No flaky patterns (deterministic tests, mocked fetch, offline validation)
- [x] Security tests included (OWASP A03: SSRF protection, response size limit, timeout)
- [x] Implementation checklist created
- [x] Execution commands provided
- [x] Lint clean (no errors)
- [x] Build passes (ESM + CJS + DTS)
- [x] Barrel exports updated (agent/index.ts + client/src/index.ts)
- [x] Existing Stories 4.1-4.2 tests unaffected (all still pass)
- [x] Identity parameter offset tested (AC1 param compatibility)
- [x] Performance requirement tested (NFR7: 50 skills < 1 second)

---

## Running Tests

```bash
# Run all new Story 4.3 unit tests
npx vitest run --config packages/client/vitest.config.ts packages/client/src/agent/__tests__/reducer-validator.test.ts packages/client/src/agent/__tests__/table-validator.test.ts packages/client/src/agent/__tests__/module-info-fetcher.test.ts packages/client/src/agent/__tests__/validation-report.test.ts packages/client/src/agent/__tests__/validation-offline.test.ts

# Run all agent tests (Stories 4.1 + 4.2 + 4.3)
npx vitest run --config packages/client/vitest.config.ts packages/client/src/agent/__tests__/

# Run client unit tests (excludes integration)
pnpm --filter @sigil/client test:unit

# Run integration tests (requires Docker)
RUN_INTEGRATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/agent/__tests__/spacetimedb-validation.integration.test.ts packages/client/src/agent/__tests__/validation-error.integration.test.ts

# Full regression
pnpm test

# Build check
pnpm --filter @sigil/client build
```

---

**Generated by BMad TEA Agent** - 2026-03-14
