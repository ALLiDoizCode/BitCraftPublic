---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-15'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-5-event-interpretation-as-semantic-narratives.md'
  - 'packages/client/vitest.config.ts'
  - 'packages/client/src/agent/index.ts'
  - 'packages/client/src/agent/__tests__/budget-tracker.test.ts'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
---

# ATDD Checklist - Epic 4, Story 5: Event Interpretation as Semantic Narratives

**Date:** 2026-03-15
**Author:** Jonathan
**Primary Test Level:** Unit

---

## Story Summary

Raw SpacetimeDB table update events (row inserts, updates, deletes) need to be transformed into human-readable semantic narratives so that agents and researchers can understand what happened in the game world meaningfully.

**As a** researcher
**I want** raw SpacetimeDB table update events interpreted as human-readable semantic narratives
**So that** agents and researchers can understand what happened in the game world meaningfully

---

## Acceptance Criteria

1. **AC1 - Table update interpretation:** Given a raw SpacetimeDB table update event (row insert, update, or delete), when the event interpreter processes it, then a semantic narrative is produced describing what happened in game terms, and the narrative includes: event type, affected entity, key state changes, and timestamp.

2. **AC2 - Player display name resolution:** Given a player position table update, when interpreted, then the narrative reads like "Player [pubkey] moved from hex (x1,y1) to hex (x2,y2)" and includes the player's display name if available from static data.

3. **AC3 - Multi-update correlation:** Given multiple rapid table updates from a single reducer call, when interpreted, then related updates are correlated into a single coherent narrative where possible, and the original raw events remain accessible alongside the narrative.

4. **AC4 - Unmapped table fallback:** Given an unknown or unmapped table update, when interpreted, then a generic narrative is produced: "Table [name] row [id] [inserted/updated/deleted]" and no error is thrown -- graceful degradation for unmapped events.

---

## Preflight Results

- **Stack detected:** backend (TypeScript + Rust monorepo)
- **Test framework:** vitest (globals: true, environment: node)
- **Test directory:** `packages/client/src/agent/__tests__/`
- **Existing test patterns reviewed:** 24 existing test files in agent/__tests__/
- **Framework config:** `packages/client/vitest.config.ts`
- **Knowledge fragments loaded:** data-factories, test-quality, test-levels-framework, test-healing-patterns
- **Docker required:** No (pure transformation logic)

---

## Generation Mode

**Mode:** AI Generation
**Reason:** Backend project with clear acceptance criteria. All tests are pure unit tests on transformation logic -- no browser recording needed.

---

## Test Strategy

### AC-to-Test Level Mapping

| AC | Test Level | Scenarios | Priority | Rationale |
| --- | --- | --- | --- | --- |
| AC1 (Table update interpretation) | Unit | 15 core interpreter tests + 8 narrative format tests | P0 | Core transformation logic, pure functions |
| AC2 (Player display name resolution) | Unit | 7 static data resolution tests | P0 | Name resolution with fallback -- key user-facing output |
| AC3 (Multi-update correlation) | Unit | 9 correlation tests | P1 | Time-based grouping with edge cases |
| AC4 (Unmapped table fallback) | Unit | 5 fallback tests | P0 | Graceful degradation -- must never throw |
| AC1+AC3 (Pipeline integration) | Unit (integration-style) | 5 integration tests | P1 | End-to-end pipeline verification with mock data |

### Test Level Selection Rationale

**All tests are Unit level** because:
- EventInterpreter is a pure transformation module (input -> output, no side effects)
- No external dependencies (no DB, no API, no file system, no network)
- No Docker required
- StaticDataLoader interactions are mocked (factory function provides a mock `get()`)
- Correlation logic is time-window based but uses provided timestamps (deterministic)

**No Integration or E2E tests** because:
- No service interactions to test
- No database queries
- No HTTP endpoints
- No browser UI

### Test File Distribution

| Test File | Test Count | ACs Covered | Priority |
| --- | --- | --- | --- |
| `event-interpreter.test.ts` | ~15 | AC1, AC2 | P0 |
| `narrative-format.test.ts` | ~8 | AC1, AC2 | P0 |
| `event-correlation.test.ts` | ~9 | AC3 | P1 |
| `event-fallback.test.ts` | ~5 | AC4 | P0 |
| `event-static-data.test.ts` | ~7 | AC2 | P0 |
| `event-interpreter-integration.test.ts` | ~5 | AC1, AC3 | P1 |
| **Total** | **~49** | **AC1-AC4** | |

### Red Phase Requirements

All tests will fail before implementation because:
- The source files (`event-interpreter-types.ts`, `table-interpreters.ts`, `event-interpreter.ts`) do not exist yet
- Tests will import from these non-existent modules, causing import failures
- Each test verifies specific behavior (narrative content, correlation grouping, fallback format) that requires implementation code
- No mocking of the system under test -- tests target real interfaces

---

## Failing Tests Created (RED Phase)

### Unit Tests (49 tests across 6 files)

**File:** `packages/client/src/agent/__tests__/event-interpreter.test.ts` (~215 lines)

- **Test:** interpret() with player position insert -> narrative contains "appeared at hex"
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Player position insert produces location-based narrative

- **Test:** interpret() with player position update -> narrative contains "moved from hex ... to hex"
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1/AC2 - Player movement produces coordinate-change narrative

- **Test:** interpret() with player position delete -> narrative contains "left the area"
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Player departure produces departure narrative

- **Test:** interpret() with inventory insert -> narrative contains "received"
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Inventory gain produces acquisition narrative

- **Test:** interpret() with inventory update -> narrative contains "quantity changed"
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Inventory change produces quantity-change narrative

- **Test:** interpret() with inventory delete -> narrative contains "lost"
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Inventory loss produces loss narrative

- **Test:** interpret() with resource insert -> narrative about resource appearance
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Resource spawn produces appearance narrative

- **Test:** interpret() with resource delete -> narrative contains "depleted"
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Resource removal produces depletion narrative

- **Test:** interpret() sets correct category for each mapped table
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Categories: movement, inventory, resource

- **Test:** interpret() includes timestamp in returned narrative
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Timestamp preservation

- **Test:** interpret() preserves rawEvent reference in narrative
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1/AC3 - Raw event accessible from narrative

- **Test:** interpret() includes operationType matching the event type
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - operationType matches insert/update/delete

- **Test:** interpret() includes stateChanges for update events
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - State changes captured for updates

- **Test:** interpret() with null/undefined fields in row -> graceful handling
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Edge case: malformed row data

- **Test:** interpret() with empty row object -> produces narrative without errors
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Edge case: empty row

---

**File:** `packages/client/src/agent/__tests__/narrative-format.test.ts` (~135 lines)

- **Test:** narrative string contains event type description
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Event type in narrative string

- **Test:** narrative string contains affected entity reference
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Entity reference in narrative

- **Test:** narrative string contains key state changes for updates
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - State changes in narrative

- **Test:** narrative string contains timestamp information
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Timestamp in narrative metadata

- **Test:** player movement narrative format matches expected
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC2 - Format: "Player [name] moved from hex (x1,y1) to hex (x2,y2)"

- **Test:** inventory narrative format matches expected
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Format: "Player [name] received [item] x[qty]"

- **Test:** generic narrative format matches expected
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC4 - Format: "Table [name] row [id] [inserted/updated/deleted]"

- **Test:** narrative is human-readable (no raw JSON, no object references)
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Human readability

---

**File:** `packages/client/src/agent/__tests__/event-correlation.test.ts` (~200 lines)

- **Test:** two events within window with same entityId -> single CorrelatedNarrative
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - Time-window correlation

- **Test:** two events outside window -> two separate SemanticNarratives
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - No correlation outside window

- **Test:** two events with different entityIds -> separate narratives
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - EntityId-based correlation only

- **Test:** harvest action (resource delete + inventory insert) -> correlated
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - Cross-table correlation

- **Test:** CorrelatedNarrative.events contains both original SemanticNarratives
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - Raw events accessible

- **Test:** CorrelatedNarrative.correlationId is unique per group
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - Unique correlation IDs

- **Test:** two events with entityId === undefined within window -> NOT correlated
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - Undefined entityId edge case

- **Test:** single event -> returned as SemanticNarrative
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - Single event not wrapped

- **Test:** empty event batch -> empty result array
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - Empty input edge case

---

**File:** `packages/client/src/agent/__tests__/event-fallback.test.ts` (~85 lines)

- **Test:** unknown table -> generic narrative produced
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC4 - Generic fallback format

- **Test:** unknown table -> no error thrown
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC4 - Graceful degradation

- **Test:** unknown table -> category is "unknown"
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC4 - Unknown category assignment

- **Test:** unknown table with no ID field -> "[unknown]" as ID
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC4 - Missing ID field handling

- **Test:** after unregisterInterpreter() -> falls back to generic
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC4 - Unregistration reverts to fallback

---

**File:** `packages/client/src/agent/__tests__/event-static-data.test.ts` (~150 lines)

- **Test:** player pubkey with display name -> narrative uses display name
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC2 - Display name from static data

- **Test:** player pubkey without display name -> truncated pubkey
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC2 - Truncated pubkey fallback

- **Test:** item ID with name in item_desc -> narrative uses item name
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC2 - Item name from static data

- **Test:** createEventInterpreterWithStaticData() correctly wires up resolver
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC2 - Factory function wiring

- **Test:** resolver catches StaticDataLoader errors gracefully
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC2 - Error handling in resolver

- **Test:** resolver maps event table name to _desc table
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC2 - Table name mapping (player_state -> player_desc)

- **Test:** resolver handles non-string/number id -> no crash
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC2 - Id type validation

---

**File:** `packages/client/src/agent/__tests__/event-interpreter-integration.test.ts` (~165 lines)

- **Test:** interprets batch of mixed table updates
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Mixed table pipeline

- **Test:** harvest correlation: resource delete + inventory insert
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC3 - Correlation pipeline

- **Test:** custom interpreter registration takes precedence
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Extensibility pattern

- **Test:** name resolver integration: display names and fallback
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC2 - End-to-end name resolution

- **Test:** registerInterpreter rejects empty tableName
  - **Status:** RED - Cannot find module '../event-interpreter.js'
  - **Verifies:** AC1 - Validation

---

## Data Factories Created

No data factory files created. Test helper functions are defined inline within each test file using the `createTableUpdateEvent()` factory pattern (consistent with existing project conventions from Stories 4.1-4.4). This follows the project's convention of co-locating test helpers with test files rather than extracting to separate factory modules.

### Test Helper: createTableUpdateEvent

**Defined in:** each test file (inline)

**Exports:**

- `createTableUpdateEvent(overrides?)` - Create a TableUpdateEvent with sensible defaults and optional overrides

**Example Usage:**

```typescript
const event = createTableUpdateEvent({ table: 'inventory', type: 'insert', oldRow: undefined, newRow: { player_id: 'abc', item_id: 42, quantity: 5 } });
```

### Test Helper: createMockStaticDataLoader

**Defined in:** `event-static-data.test.ts` (inline)

**Exports:**

- `createMockStaticDataLoader(data?)` - Create a mock StaticDataLoader with configurable get() behavior

---

## Fixtures Created

No separate fixture files created. This story uses pure unit tests with inline test helpers, consistent with the project's vitest-based testing approach (no Playwright fixtures needed).

---

## Mock Requirements

### StaticDataLoader Mock

**Used in:** `event-static-data.test.ts`, `event-interpreter-integration.test.ts`

**Mock Pattern:** Inline `vi.fn()` mock of `staticDataLoader.get(table, id)`

**Success Response:**

```typescript
{
  get: vi.fn((table, id) => {
    // Returns record from lookup data or undefined
    return data[table]?.[String(id)];
  })
}
```

**Failure Response:**

```typescript
{
  get: vi.fn(() => {
    throw new Error('Data not loaded yet');
  })
}
```

**Notes:** The mock simulates both the happy path (data available) and error cases (StaticDataLoader throws Error or TypeError). The createEventInterpreterWithStaticData() factory must catch all errors.

---

## Required data-testid Attributes

Not applicable. This is a pure backend transformation module with no UI components.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd packages/client && npx vitest run src/agent/__tests__/event-interpreter.test.ts`

**Results:**

```
FAIL src/agent/__tests__/event-interpreter.test.ts
Error: Cannot find module '../event-interpreter.js' imported from
/Users/jonathangreen/Documents/BitCraftPublic/packages/client/src/agent/__tests__/event-interpreter.test.ts

Test Files  1 failed (1)
Tests       no tests
```

**Summary:**

- Total test files: 6
- Passing: 0 (expected)
- Failing: 6 (expected -- all fail on import because source modules do not exist)
- Status: RED phase verified

**Expected Failure Messages:**

All 6 test files fail with: `Cannot find module '../event-interpreter.js'` (or `'../event-interpreter-types.js'`)
This is the expected RED phase behavior -- source modules have not been implemented yet.

---

## Implementation Checklist

### Task 1: Define event interpreter types (event-interpreter-types.ts)

**File:** `packages/client/src/agent/event-interpreter-types.ts`

**Tasks to make tests pass:**

- [ ] Create file with JSDoc `@module` header
- [ ] Export `TableUpdateEvent` interface (table, type, timestamp, oldRow?, newRow?)
- [ ] Export `EventCategory` type ('movement' | 'inventory' | 'resource' | 'combat' | 'social' | 'building' | 'environment' | 'unknown')
- [ ] Export `SemanticNarrative` interface (timestamp, category, narrative, entityId?, entityName?, tableName, operationType, stateChanges?, rawEvent)
- [ ] Export `CorrelatedNarrative` interface (timestamp, category, narrative, events, correlationId)
- [ ] Export `TableInterpreter` interface (tableName, category, interpret())
- [ ] Export `NameResolver` type ((table, id) => string | undefined)
- [ ] Export `EventInterpreterConfig` interface (correlationWindowMs, nameResolver?)
- [ ] Run test: `npx vitest run src/agent/__tests__/event-interpreter.test.ts`

**Estimated Effort:** 0.5 hours

---

### Task 2: Implement table-specific interpreters (table-interpreters.ts)

**File:** `packages/client/src/agent/table-interpreters.ts`

**Tasks to make tests pass:**

- [ ] Create file with JSDoc `@module` header
- [ ] Export `createPlayerPositionInterpreter()` -- handles player_state/entity_position, category 'movement'
- [ ] Export `createInventoryInterpreter()` -- handles inventory, category 'inventory'
- [ ] Export `createResourceInterpreter()` -- handles resource_spawn, category 'resource'
- [ ] Export `createGenericInterpreter(tableName)` -- fallback for unmapped tables, category 'unknown'
- [ ] Export `DEFAULT_TABLE_INTERPRETERS: Map<string, TableInterpreter>` -- pre-populated map
- [ ] Implement narrative string formatting per AC2 requirements
- [ ] Handle null/undefined row fields gracefully (optional chaining, fallback strings)
- [ ] Extract row ID from common fields (id, entity_id, player_id)
- [ ] Run tests: `npx vitest run src/agent/__tests__/event-interpreter.test.ts src/agent/__tests__/narrative-format.test.ts src/agent/__tests__/event-fallback.test.ts`

**Estimated Effort:** 1.5 hours

---

### Task 3: Implement EventInterpreter class (event-interpreter.ts)

**File:** `packages/client/src/agent/event-interpreter.ts`

**Tasks to make tests pass:**

- [ ] Create file with JSDoc `@module` header
- [ ] Export `EventInterpreter` class with constructor(config?)
- [ ] Implement `interpret(event)` -- delegates to registered interpreter or generic fallback
- [ ] Implement `interpretBatch(events)` -- interprets array of events
- [ ] Implement `interpretAndCorrelate(events)` -- interprets + groups by entityId within time window
- [ ] Implement `registerInterpreter(interpreter)` -- validates non-empty tableName
- [ ] Implement `unregisterInterpreter(tableName)` -- returns boolean
- [ ] Implement `setNameResolver(resolver)` -- overrides name resolver
- [ ] Implement `get registeredTables()` -- returns string[]
- [ ] Implement correlation logic: group by entityId within correlationWindowMs, undefined entityId never grouped
- [ ] Generate unique correlationId for each group
- [ ] Compute stateChanges by diffing oldRow and newRow
- [ ] Export `createEventInterpreterWithStaticData(staticDataLoader)` factory
- [ ] Factory creates NameResolver that: maps table to _desc, validates id type, wraps get() in try-catch, searches known name fields
- [ ] Run tests: `npx vitest run src/agent/__tests__/event-*.test.ts src/agent/__tests__/narrative-format.test.ts`
- [ ] All 49 tests pass (green phase)

**Estimated Effort:** 2.5 hours

---

### Task 4: Update barrel exports (index.ts files)

**Files:** `packages/client/src/agent/index.ts`, `packages/client/src/index.ts`

**Tasks to make tests pass:**

- [ ] Add re-exports for all new types to `agent/index.ts`
- [ ] Add re-exports for all new classes and factories to `agent/index.ts`
- [ ] Add Story 4.5 export block to `src/index.ts`
- [ ] Verify build: `pnpm --filter @sigil/client build`
- [ ] Verify regression: `pnpm test`

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story (all 6 test files)
cd packages/client && npx vitest run src/agent/__tests__/event-interpreter.test.ts src/agent/__tests__/narrative-format.test.ts src/agent/__tests__/event-correlation.test.ts src/agent/__tests__/event-fallback.test.ts src/agent/__tests__/event-static-data.test.ts src/agent/__tests__/event-interpreter-integration.test.ts

# Run specific test file
cd packages/client && npx vitest run src/agent/__tests__/event-interpreter.test.ts

# Run tests in watch mode (TDD)
cd packages/client && npx vitest src/agent/__tests__/event-interpreter.test.ts

# Run with verbose reporter
cd packages/client && npx vitest run src/agent/__tests__/event-*.test.ts --reporter=verbose

# Run tests with coverage
cd packages/client && npx vitest run src/agent/__tests__/event-*.test.ts src/agent/__tests__/narrative-format.test.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All tests written and failing (49 tests across 6 files)
- Test helpers/factories created (inline createTableUpdateEvent, createMockStaticDataLoader)
- Mock requirements documented (StaticDataLoader mock)
- Implementation checklist created (4 implementation tasks)

**Verification:**

- All tests fail with `Cannot find module '../event-interpreter.js'`
- Failure is due to missing implementation, not test bugs
- Tests assert expected behavior (narrative content, categories, correlation grouping)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Create `event-interpreter-types.ts`** -- define all interfaces and types
2. **Create `table-interpreters.ts`** -- implement table-specific interpreters
3. **Create `event-interpreter.ts`** -- implement EventInterpreter class and factory
4. **Run tests** after each file to verify incremental progress
5. **Update barrel exports** in `index.ts` files
6. **Full regression** with `pnpm test`

**Key Principles:**

- One module at a time (types first, then interpreters, then main class)
- Minimal implementation (match the test assertions exactly)
- Run tests frequently (immediate feedback)
- No `any` types -- use `unknown` or specific types
- All imports use `.js` suffix (ESM compatibility)

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 49 tests pass (green phase complete)
2. Review for code quality (readability, maintainability)
3. Extract shared constants if needed
4. Ensure JSDoc `@module` headers on all new files
5. Verify build: `pnpm --filter @sigil/client build`
6. Full regression: `pnpm test`

---

## Next Steps

1. **Begin implementation** using implementation checklist as guide
2. **Work one task at a time** (types -> interpreters -> main class -> exports)
3. **Run failing tests** to confirm RED phase: see Running Tests above
4. **When all tests pass**, refactor code for quality
5. **When refactoring complete**, commit with `feat(4-5): story complete`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Factory pattern with overrides for test data generation (applied to createTableUpdateEvent and createMockStaticDataLoader helpers)
- **test-quality.md** - Test design principles: deterministic, isolated, explicit assertions, no hard waits (applied to all 49 tests)
- **test-levels-framework.md** - Test level selection: pure transformation logic -> unit tests only (no integration/E2E needed)
- **test-healing-patterns.md** - Common failure patterns: reviewed for prevention (no timing issues, no selector issues -- backend only)

---

## Notes

- All 49 tests are pure unit tests -- no Docker, no network, no file system dependencies
- The EventInterpreter is a stateless transformer (not an EventEmitter). Tests verify input -> output only.
- Correlation tests use deterministic timestamps (not Date.now()). Tests control timestamps explicitly.
- The `createEventInterpreterWithStaticData()` factory is the integration point with the StaticDataLoader. The mock patterns in the tests closely mirror the real StaticDataLoader API (get() with table + id, throws Error/TypeError on failure).
- The project convention of inline test helpers (rather than separate factory files) is preserved from Stories 4.1-4.4.

---

## Contact

**Questions or Issues?**

- Refer to story document: `_bmad-output/implementation-artifacts/4-5-event-interpretation-as-semantic-narratives.md`
- Refer to test design: `_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.5
- Refer to architecture: `_bmad-output/planning-artifacts/architecture/5-five-layer-cognition-architecture.md`
- Consult `_bmad/tea/testarch/knowledge/` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-03-15
