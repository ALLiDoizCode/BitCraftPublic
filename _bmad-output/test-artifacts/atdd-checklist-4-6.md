---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-15'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-6-structured-decision-logging.md'
  - 'packages/client/vitest.config.ts'
  - 'packages/client/src/agent/index.ts'
  - 'packages/client/src/agent/event-interpreter-types.ts'
  - 'packages/client/src/agent/budget-types.ts'
  - 'packages/client/src/index.ts'
  - 'packages/client/src/agent/__tests__/event-interpreter.test.ts'
  - 'packages/client/src/agent/__tests__/budget-tracker.test.ts'
---

# ATDD Checklist - Epic 4, Story 6: Structured Decision Logging

**Date:** 2026-03-15
**Author:** Jonathan
**Primary Test Level:** Unit (vitest)

---

## Story Summary

Implements a structured JSONL decision logger that captures the full agent decision cycle (observe -> interpret -> decide -> act) as append-only log entries for research analysis, benchmarking, and reproducibility.

**As a** researcher,
**I want** agents to produce structured JSONL decision logs capturing the full decision cycle with eval-compatible metrics,
**So that** I can analyze agent behavior, run benchmarks, reproduce decisions, and compare across experiment runs.

---

## Acceptance Criteria

1. **AC1 - Decision log entry structure** (FR39): JSONL entry appended with timestamp, observation summary, semantic events, skill triggered, action chosen, action cost, result, and outcome
2. **AC2 - Append-only JSONL format** (NFR25): Each line is valid JSON, append-only to configured file
3. **AC3 - Log rotation** (NFR16): Rotation triggered when file exceeds 100MB
4. **AC4 - Failure logging** (FR39): Failed actions include error code, boundary, message, and world state
5. **AC5 - Reproducibility** (FR39): Each entry contains enough context to reproduce the decision
6. **AC6 - Eval-compatible metrics** (FR39): Per-skill invocation count, trigger accuracy, latency, cost derivable from log entries

---

## Failing Tests Created (RED Phase)

### Unit Tests (56 tests across 5 files)

**File:** `packages/client/src/agent/__tests__/decision-logger.test.ts` (19 tests)

- **Test:** logDecision() creates valid JSONL entry with all required fields
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - All required fields present in log entry
- **Test:** logDecision() sets ISO 8601 timestamp
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Timestamp format
- **Test:** logDecision() includes observation summary
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Observation field
- **Test:** logDecision() includes semantic events array
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - SemanticNarrative[] from Story 4.5
- **Test:** logDecision() includes skillTriggered with name, description, matchContext
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Skill selection context
- **Test:** logDecision() includes action with reducer and args
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Action payload
- **Test:** logDecision() includes cost from action cost registry
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Action cost
- **Test:** logDecision() includes result (success | failure | skipped)
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Outcome status
- **Test:** logDecision() includes outcome string
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Human-readable outcome
- **Test:** logDecision() includes agentConfig with version and active skills
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1, AC5 - Config snapshot for reproducibility
- **Test:** logDecision() includes metrics with decisionLatencyMs
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1, AC6 - Timing metrics
- **Test:** logDecision() with null skillTriggered (no skill matched)
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Null skill handling
- **Test:** logDecision() with null action (decision skipped)
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Null action handling
- **Test:** logDecision() with null cost (action skipped)
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Null cost handling
- **Test:** logDecision() serializes each entry as single-line JSON
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC2 - JSONL format
- **Test:** multiple logDecision() calls append multiple lines to same file
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC2 - Append-only semantics
- **Test:** logDecision() silently swallows file I/O errors
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC2 - Error resilience
- **Test:** createDecisionLogger() applies default config values
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Factory defaults
- **Test:** DecisionLogger constructor rejects empty filePath
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC1 - Validation

**File:** `packages/client/src/agent/__tests__/decision-log-schema.test.ts` (10 tests)

- **Test:** each log line is independently parseable as JSON
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC2 - JSONL format
- **Test:** required fields are present (all 10 required fields)
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC2 - Schema completeness
- **Test:** timestamp is ISO 8601 format
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC2 - Timestamp validation
- **Test:** result is one of success, failure, skipped
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC2 - Result enum
- **Test:** agentConfig.activeSkills is string array
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC5 - Reproducibility
- **Test:** metrics.decisionLatencyMs is non-negative number
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC6 - Metric type
- **Test:** optional fields omitted when not applicable
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC2 - Optional field handling
- **Test:** entry with error includes code, boundary, message
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC4 - Error schema
- **Test:** entry with worldState includes Record<string, unknown>
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC4, AC5 - World state capture
- **Test:** multiple sequential entries form valid JSONL
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC2 - Multi-entry JSONL

**File:** `packages/client/src/agent/__tests__/decision-log-rotation.test.ts` (8 tests)

- **Test:** file under 100MB -> no rotation triggered
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC3 - Below threshold
- **Test:** file exceeds 100MB -> rotation triggered before next append
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC3 - Rotation trigger
- **Test:** rotated file named with ISO timestamp suffix
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC3 - Naming convention
- **Test:** after rotation, new entries written to original file path
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC3 - Fresh file
- **Test:** old rotated file preserved (not deleted)
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC3 - Preservation
- **Test:** rotation disabled in config -> no rotation
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC3 - Config respect
- **Test:** custom maxFileSizeBytes config respected
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC3 - Custom threshold
- **Test:** file does not exist -> getFileSize() returns 0
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC3 - ENOENT handling

**File:** `packages/client/src/agent/__tests__/decision-log-failure.test.ts` (7 tests)

- **Test:** failed action logged with error.code
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC4 - Error code
- **Test:** failed action logged with error.boundary
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC4 - Error boundary
- **Test:** failed action logged with error.message
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC4 - Error message
- **Test:** failed action includes worldState capture
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC4 - World state
- **Test:** failed action result is 'failure'
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC4 - Result status
- **Test:** failed action entry is valid JSONL
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC4, AC2 - JSONL format
- **Test:** BudgetExceededError logged with BUDGET_EXCEEDED code and boundary client
  - **Status:** RED - Cannot find module '../decision-logger.js'
  - **Verifies:** AC4 - Budget error pattern

**File:** `packages/client/src/agent/__tests__/decision-log-metrics.test.ts` (12 tests)

- **Test:** computeMetrics() with single success entry
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Basic metrics
- **Test:** computeMetrics() with mixed results -> correct per-skill counts
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Mixed results
- **Test:** computeMetrics() with multiple skills -> separate SkillMetrics
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Per-skill breakdown
- **Test:** computeMetrics() derives invocation count per skill
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Invocation count
- **Test:** computeMetrics() derives trigger accuracy per skill
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Trigger accuracy
- **Test:** computeMetrics() derives average decision latency per skill
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Avg decision latency
- **Test:** computeMetrics() derives average action latency (excludes undefined)
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Avg action latency
- **Test:** computeMetrics() derives total cost per skill
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Total cost
- **Test:** computeMetrics() with null skillTriggered -> grouped under '(no skill)'
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Null skill grouping
- **Test:** computeMetrics() with empty entries array -> zeroed-out metrics
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Empty input
- **Test:** parseJsonlFile() parses valid JSONL content into entries
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - JSONL parsing
- **Test:** parseJsonlFile() throws on invalid JSON with line number
  - **Status:** RED - Cannot find module '../decision-log-metrics.js'
  - **Verifies:** AC6 - Parse error handling

---

## Data Factories Created

### DecisionContext Factory

**File:** Inline in each test file (following existing project pattern)

**Exports (per test file):**

- `createTestContext(overrides?)` - Create a valid DecisionContext with optional field overrides
- `createTestConfig(overrides?)` - Create a valid DecisionLoggerConfig with optional overrides
- `createFailureContext(overrides?)` - Create a failure DecisionContext (decision-log-failure.test.ts)
- `createLogEntry(overrides?)` - Create a DecisionLogEntry for metrics testing (decision-log-metrics.test.ts)

**Example Usage:**

```typescript
const context = createTestContext({ observation: 'Custom observation', cost: 42 });
const failContext = createFailureContext({ error: { code: 'CUSTOM_ERROR', boundary: 'bls', message: 'Failed' } });
```

---

## Fixtures Created

No separate fixture files needed. Test factories are inline in each test file, following the existing project pattern (e.g., `createTableUpdateEvent()` in event-interpreter.test.ts, `createTestConfig()` in budget-tracker.test.ts).

---

## Mock Requirements

### node:fs/promises Mock

**Module:** `node:fs/promises` (standard library)

**Mocked Functions:**

- `appendFile(path, content, encoding)` - Mocked to resolve with undefined
- `stat(path)` - Mocked to return `{ size: 0 }` (configurable per test)
- `rename(oldPath, newPath)` - Mocked to resolve with undefined

**Notes:** All 4 test files that test DecisionLogger mock `node:fs/promises` at the module level using `vi.mock()`. The metrics test file does not need fs mocking (pure computation).

---

## Required data-testid Attributes

N/A - This is a backend TypeScript library with no UI components.

---

## Implementation Checklist

### Test: decision-logger.test.ts (19 tests)

**File:** `packages/client/src/agent/__tests__/decision-logger.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/client/src/agent/decision-log-types.ts` with `DecisionLogEntry`, `DecisionLoggerConfig`, `DecisionLogResult`, `DecisionContext` interfaces
- [ ] Create `packages/client/src/agent/decision-logger.ts` with `DecisionLogger` class
- [ ] Implement `logDecision(context: DecisionContext): Promise<void>` -- builds entry, serializes as JSON, appends to file
- [ ] Implement promise-chaining write queue (`_writeQueue`) for concurrent write serialization
- [ ] Implement `createDecisionLogger()` factory function with defaults
- [ ] Implement constructor validation: throw on empty filePath
- [ ] Handle null skillTriggered, action, cost in entry construction
- [ ] Implement try-catch around file I/O (silently swallow errors)
- [ ] Run test: `pnpm --filter @sigil/client test:unit -- --run packages/client/src/agent/__tests__/decision-logger.test.ts`
- [ ] All 19 tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: decision-log-schema.test.ts (10 tests)

**File:** `packages/client/src/agent/__tests__/decision-log-schema.test.ts`

**Tasks to make these tests pass:**

- [ ] Ensure `DecisionLogEntry` has all 10 required fields
- [ ] Ensure `timestamp` is set via `new Date().toISOString()`
- [ ] Ensure `result` type is constrained to `'success' | 'failure' | 'skipped'`
- [ ] Ensure optional fields (`error`, `worldState`, `actionLatencyMs`) are omitted when undefined
- [ ] Ensure entry construction preserves error details and worldState on failure
- [ ] Run test: `pnpm --filter @sigil/client test:unit -- --run packages/client/src/agent/__tests__/decision-log-schema.test.ts`
- [ ] All 10 tests pass (green phase)

**Estimated Effort:** 1 hour (mostly covered by decision-logger.ts implementation)

---

### Test: decision-log-rotation.test.ts (8 tests)

**File:** `packages/client/src/agent/__tests__/decision-log-rotation.test.ts`

**Tasks to make these tests pass:**

- [ ] Implement `getFileSize(): Promise<number>` -- `fs.stat()` with ENOENT -> 0
- [ ] Implement `rotateLog(): Promise<void>` -- `fs.rename()` with timestamp suffix
- [ ] Implement size check before each write in `logDecision()`
- [ ] Generate rotated filename: replace `.jsonl` with `-{ISO timestamp}.jsonl` (colons -> hyphens)
- [ ] Respect `rotationEnabled` config flag (skip size check when false)
- [ ] Respect custom `maxFileSizeBytes` threshold
- [ ] Run test: `pnpm --filter @sigil/client test:unit -- --run packages/client/src/agent/__tests__/decision-log-rotation.test.ts`
- [ ] All 8 tests pass (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: decision-log-failure.test.ts (7 tests)

**File:** `packages/client/src/agent/__tests__/decision-log-failure.test.ts`

**Tasks to make these tests pass:**

- [ ] Ensure `logDecision()` preserves `error` field when present in context
- [ ] Ensure `error` contains `code`, `boundary`, `message` from DecisionContext
- [ ] Ensure `worldState` is captured on failure entries
- [ ] Ensure `result: 'failure'` is set correctly
- [ ] Ensure failure entries are valid single-line JSONL
- [ ] Test BudgetExceededError pattern with code='BUDGET_EXCEEDED', boundary='client'
- [ ] Run test: `pnpm --filter @sigil/client test:unit -- --run packages/client/src/agent/__tests__/decision-log-failure.test.ts`
- [ ] All 7 tests pass (green phase)

**Estimated Effort:** 0.5 hours (mostly covered by decision-logger.ts core)

---

### Test: decision-log-metrics.test.ts (12 tests)

**File:** `packages/client/src/agent/__tests__/decision-log-metrics.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/client/src/agent/decision-log-metrics.ts`
- [ ] Implement `SkillMetrics`, `AggregateMetrics`, `EvalResult` interfaces (in decision-log-types.ts)
- [ ] Implement `computeMetrics(entries: DecisionLogEntry[]): AggregateMetrics`
  - [ ] Group entries by `skillTriggered.name` (null -> `'(no skill)'`)
  - [ ] Compute per-skill: invocationCount, successCount, failureCount, skippedCount, triggerAccuracy, totalCost, avgDecisionLatencyMs, avgActionLatencyMs
  - [ ] Compute overall: totalDecisions, totalCost, overallSuccessRate
  - [ ] Return empty evalResults array (populated by external tooling)
  - [ ] Handle empty input (zeroed-out metrics)
- [ ] Implement `parseJsonlFile(content: string): DecisionLogEntry[]`
  - [ ] Split by newlines, filter empty, parse each as JSON
  - [ ] Throw Error with line number on parse failure
- [ ] Run test: `pnpm --filter @sigil/client test:unit -- --run packages/client/src/agent/__tests__/decision-log-metrics.test.ts`
- [ ] All 12 tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Post-Implementation Tasks

- [ ] Update `packages/client/src/agent/index.ts` with Story 4.6 exports
- [ ] Update `packages/client/src/index.ts` with Story 4.6 re-exports
- [ ] Run full test suite: `pnpm test:unit` (regression check)
- [ ] Build: `pnpm --filter @sigil/client build` (ESM + CJS + DTS)
- [ ] OWASP security review (A01, A02, A03, A04, A05, A06, A09)

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all failing tests for this story
pnpm --filter @sigil/client test:unit -- --run packages/client/src/agent/__tests__/decision-logger.test.ts packages/client/src/agent/__tests__/decision-log-schema.test.ts packages/client/src/agent/__tests__/decision-log-rotation.test.ts packages/client/src/agent/__tests__/decision-log-failure.test.ts packages/client/src/agent/__tests__/decision-log-metrics.test.ts

# Run specific test file
pnpm --filter @sigil/client test:unit -- --run packages/client/src/agent/__tests__/decision-logger.test.ts

# Run tests in watch mode (TDD)
pnpm --filter @sigil/client test:watch -- packages/client/src/agent/__tests__/decision-logger.test.ts

# Run all client unit tests (regression check)
pnpm --filter @sigil/client test:unit

# Run tests with coverage
pnpm --filter @sigil/client test:coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 56 tests written and failing (import errors)
- Factory functions created inline with auto-override patterns
- Mock requirements documented (node:fs/promises)
- Implementation checklist created mapping each test file to tasks

**Verification:**

- All 5 test files fail with `Cannot find module` errors
- Failure is due to missing implementation, not test bugs
- 981 existing tests still pass (no regression)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with types** -- Create `decision-log-types.ts` (Task 1)
2. **Implement core logger** -- Create `decision-logger.ts` (Task 2)
3. **Run logger tests** -- Verify decision-logger.test.ts + decision-log-schema.test.ts pass
4. **Implement rotation** -- Complete rotation logic in decision-logger.ts (Task 2)
5. **Run rotation tests** -- Verify decision-log-rotation.test.ts passes
6. **Run failure tests** -- Verify decision-log-failure.test.ts passes (covered by core logger)
7. **Implement metrics** -- Create `decision-log-metrics.ts` (Task 3)
8. **Run metrics tests** -- Verify decision-log-metrics.test.ts passes
9. **Update barrel exports** -- Update index.ts files (Task 9)
10. **Full regression** -- `pnpm test:unit` + `pnpm --filter @sigil/client build`

**Key Principles:**

- One test file at a time
- Minimal implementation to make tests pass
- Run tests frequently

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 56 tests pass
2. Review code quality (readability, naming, JSDoc)
3. Verify no `any` types in new code
4. Verify `.js` import extensions for ESM
5. Run full build: `pnpm --filter @sigil/client build`

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm --filter @sigil/client test:unit -- --run decision-logger.test.ts decision-log-schema.test.ts decision-log-rotation.test.ts decision-log-failure.test.ts decision-log-metrics.test.ts`

**Results:**

```
Test Files  5 failed | 58 passed | 8 skipped (71)
     Tests  981 passed | 102 skipped (1083)
```

**Summary:**

- Total new test files: 5
- Failing: 5 (expected -- module not found)
- Existing tests: 981 passing (no regression)
- Status: RED phase verified

**Expected Failure Messages:**

- `decision-logger.test.ts` -- Cannot find module '../decision-logger.js'
- `decision-log-schema.test.ts` -- Cannot find module '../decision-logger.js'
- `decision-log-rotation.test.ts` -- Cannot find module '../decision-logger.js'
- `decision-log-failure.test.ts` -- Cannot find module '../decision-logger.js'
- `decision-log-metrics.test.ts` -- Cannot find module '../decision-log-metrics.js'

---

## Validation Checklist

- [x] Story approved with clear acceptance criteria (6 ACs in Given/When/Then)
- [x] Test framework configured (vitest.config.ts, globals: true, environment: node)
- [x] All 6 acceptance criteria mapped to test scenarios
- [x] Test level selected: Unit (backend library, no E2E/API/Component)
- [x] All tests designed to fail before implementation (verified by test run)
- [x] Given-When-Then comments in all test bodies
- [x] Factory functions with overrides created (following project pattern)
- [x] Mock requirements documented (node:fs/promises)
- [x] Implementation checklist maps tests to concrete tasks
- [x] Red-Green-Refactor workflow documented
- [x] Test execution commands provided
- [x] No duplicate coverage across test files
- [x] No test interdependencies (all tests isolated)
- [x] No flaky patterns (mocked I/O, deterministic)
- [x] No regression: 981 existing tests still pass

---

## Knowledge Base References Applied

- **test-quality.md** -- Given-When-Then structure, one assertion per test, deterministic, isolated
- **data-factories.md** -- Factory functions with override pattern (createTestContext, createTestConfig, createLogEntry)
- **test-levels-framework.md** -- Test level selection: Unit for backend library, no E2E/API/Component

---

## Notes

- All tests import from `.js` extensions for ESM compatibility (matching project convention)
- No `test.skip()` used -- tests fail organically at import level because implementation files do not exist (idiomatic TDD RED for missing modules)
- The `SemanticNarrative` type from Story 4.5 is used inline in test factories (matching the actual interface from event-interpreter-types.ts)
- `BudgetExceededError` from Story 4.4 is referenced in failure test patterns but not imported (the error details are passed as plain objects in DecisionContext.error)
- Total estimated implementation effort: ~8 hours

---

## Next Steps

1. **Begin implementation** using implementation checklist as guide
2. **Start with types** (`decision-log-types.ts`) -- unblocks all test files
3. **Work one test file at a time** (recommended order: types -> logger -> schema -> rotation -> failure -> metrics)
4. **Run failing tests** frequently during implementation
5. **When all 53 tests pass**, update barrel exports and run regression
6. **Commit** with `feat(4-6): story complete`

---

**Generated by BMad TEA Agent** - 2026-03-15
