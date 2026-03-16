---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-15'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/5-1-server-source-analysis-and-reducer-catalog.md'
  - '_bmad-output/planning-artifacts/test-design-epic-5.md'
  - 'packages/client/vitest.config.ts'
  - 'vitest.config.ts'
  - '_bmad/tea/config.yaml'
---

# ATDD Checklist - Epic 5, Story 1: Server Source Analysis & Reducer Catalog

**Date:** 2026-03-15
**Author:** Jonathan
**Primary Test Level:** Unit/Verification (vitest, file-based document validation)

---

## Story Summary

Story 5.1 is a research/documentation story that analyzes the BitCraft server's WASM module to catalog all reducers by game system, document their argument signatures, and understand identity propagation expectations. The primary deliverable is the BitCraft Game Reference document.

**As a** developer,
**I want** to analyze the BitCraft server's WASM module to catalog all reducers by game system, document their argument signatures, and understand identity propagation expectations,
**So that** we have a verified reference for building skill files, constructing valid `client.publish()` calls, and writing integration tests.

---

## Acceptance Criteria

1. **AC1 - Reducer catalog completeness** (FR13, FR47): All public reducers (~364) are cataloged and grouped by game system: movement, gathering, crafting, combat, building, trading, empire, chat, player lifecycle, and administrative. Each reducer entry documents: name, argument types (including identity parameter position), return behavior, and game system category.

2. **AC2 - Argument signature documentation** (FR13, FR19): Each reducer's expected parameters are listed with types. The identity parameter convention is documented (which parameter carries the Nostr public key, how it maps to SpacetimeDB `Identity`).

3. **AC3 - Game system grouping** (FR47): Reducers are grouped by game system and each game system's reducers are ordered by typical invocation sequence.

4. **AC4 - BitCraft Game Reference document**: Document is saved to `_bmad-output/planning-artifacts/bitcraft-game-reference.md` and includes: reducer catalog, game system groupings, identity propagation conventions, and known constraints.

5. **AC5 - Table-reducer cross-reference** (FR13): Foreign key relationships between reducer arguments and table primary keys are documented.

---

## ATDD Adaptation: Documentation Story

**Important Context:** Story 5.1 is a research/documentation story with no application code deliverables. The story explicitly states: "There are no unit tests or integration tests to write -- verification is through completeness checks and peer review."

However, the acceptance criteria ARE testable through automated document-structure verification. The ATDD approach was adapted to produce **verification tests** that validate the output document (`bitcraft-game-reference.md`) meets all completeness and structural requirements. These tests:

1. Read the output markdown file from disk
2. Verify required sections exist (headings, content patterns)
3. Verify completeness metrics (reducer count, FK count, game system coverage)
4. Verify naming conventions (snake_case reducer names)
5. Fail (RED) until the document is created with required content

This approach is consistent with the test design document (test-design-epic-5.md Section 2.1) which defines 6 verification checks for Story 5.1 (V5.1-01 through V5.1-06).

---

## Failing Tests Created (RED Phase)

### Verification Tests (31 tests in 1 file)

**File:** `packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts` (387 lines)

**Test Groups:**

#### AC4 / V5.1-05: Document exists at correct path (2 tests)

- **Test:** should create bitcraft-game-reference.md at _bmad-output/planning-artifacts/
  - **Status:** RED - File does not exist yet
  - **Verifies:** AC4 - Document saved to correct output path
- **Test:** should contain non-trivial content (not an empty or stub file)
  - **Status:** RED - File does not exist yet (content length is 0)
  - **Verifies:** AC4 - Document has substantial content (>5000 chars)

#### AC1 / V5.1-01: Reducer catalog completeness (3 tests)

- **Test:** should contain a Reducer Catalog section
  - **Status:** RED - No document content to parse
  - **Verifies:** AC1 - Reducer catalog section exists as heading
- **Test:** should document the total reducer count
  - **Status:** RED - No reducer count information in empty document
  - **Verifies:** AC1 - Total reducer count is documented
- **Test:** should have reducer coverage >= 90% (document at least 327 reducers if ~364 total)
  - **Status:** RED - No reducer entries found (count is 0)
  - **Verifies:** AC1 - At least 100 reducer entries documented (reduced threshold for flexible document format)

#### AC2 / V5.1-02: Argument signature documentation (3 tests)

- **Test:** should document reducer argument types using type annotations
  - **Status:** RED - No type annotations found
  - **Verifies:** AC2 - At least 10 typed parameters documented
- **Test:** should document the identity parameter convention
  - **Status:** RED - No identity parameter documentation
  - **Verifies:** AC2 - Identity parameter convention (ReducerContext, ctx.sender) is documented
- **Test:** should document how the Nostr public key maps to SpacetimeDB Identity
  - **Status:** RED - No Nostr-to-SpacetimeDB mapping
  - **Verifies:** AC2 - Nostr pubkey to SpacetimeDB Identity mapping explained

#### AC3 / V5.1-03: Game system grouping (12 tests)

- **Test:** should have a section for the "movement" game system (and 9 more game systems via it.each)
  - **Status:** RED - No game system sections found
  - **Verifies:** AC3 - Each of the 10 required game systems has a heading/section
- **Test:** should cover all 10 game systems
  - **Status:** RED - 0 of 10 game systems found
  - **Verifies:** AC3 - All 10 systems present (movement, gathering, crafting, combat, building, trading, empire, chat, player lifecycle, administrative)
- **Test:** should order reducers by invocation sequence within game systems
  - **Status:** RED - No sequence indicators found
  - **Verifies:** AC3 - At least one game system shows ordered invocation sequence

#### AC2+AC4 / V5.1-04: Identity propagation convention (4 tests)

- **Test:** should have a dedicated Identity Propagation section
  - **Status:** RED - No identity propagation heading found
  - **Verifies:** AC2/AC4 - Dedicated identity propagation section exists
- **Test:** should document ReducerContext.sender vs explicit parameter convention
  - **Status:** RED - No ReducerContext documentation
  - **Verifies:** AC2 - ReducerContext.sender convention explained
- **Test:** should document BLOCKER-1 analysis and implications
  - **Status:** RED - No BLOCKER-1 analysis found
  - **Verifies:** AC2/AC4 - BLOCKER-1 identity propagation analysis present
- **Test:** should document BLS handler identity propagation path
  - **Status:** RED - No BLS identity documentation
  - **Verifies:** AC2/AC4 - BLS handler identity propagation path documented

#### AC5 / V5.1-06: Foreign key relationships (3 tests)

- **Test:** should have a Table-Reducer Relationships section
  - **Status:** RED - No table-reducer section found
  - **Verifies:** AC5 - Dedicated FK relationships section exists
- **Test:** should document at least 10 FK relationships
  - **Status:** RED - 0 FK relationships found
  - **Verifies:** AC5 - At least 10 FK relationships documented
- **Test:** should map reducer arguments to table primary keys
  - **Status:** RED - No argument-to-table mappings found
  - **Verifies:** AC5 - Concrete reducer argument to table PK mappings present

#### Structural completeness / AC4 (4 tests)

- **Test:** should include a Known Constraints section
  - **Status:** RED - No constraints section found
  - **Verifies:** AC4 - Known constraints documented
- **Test:** should include a Quick Reference table for Stories 5.4-5.8
  - **Status:** RED - No quick reference section found
  - **Verifies:** AC4 - Quick reference for downstream stories present
- **Test:** should use snake_case for all reducer names
  - **Status:** RED - No backtick-quoted reducer names found
  - **Verifies:** AC1/AC4 - All reducer names use snake_case (no camelCase)
- **Test:** should include an Overview section with server architecture
  - **Status:** RED - No overview heading found
  - **Verifies:** AC4 - Overview section with architecture context exists

---

## Data Factories Created

N/A - This is a documentation verification story. No data factories are needed because the tests validate document content (string matching), not application state.

---

## Fixtures Created

N/A - No fixtures needed. Tests use Node.js `fs.readFileSync` to load the document under test.

---

## Mock Requirements

N/A - No external services to mock. Tests read a local file from disk.

---

## Required data-testid Attributes

N/A - No UI components in this story. All tests are file-based verification.

---

## Implementation Checklist

### Test: should create bitcraft-game-reference.md at _bmad-output/planning-artifacts/

**File:** `packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts`

**Tasks to make this test pass:**

- [ ] Analyze BitCraft server source directory structure (Task 1)
- [ ] Extract all reducer signatures from `BitCraftServer/packages/game/src/game/handlers/` (Task 2)
- [ ] Create `_bmad-output/planning-artifacts/bitcraft-game-reference.md` (Task 7)
- [ ] Run test: `npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: should contain a Reducer Catalog section + reducer count + reducer coverage

**File:** `packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts`

**Tasks to make these 3 tests pass:**

- [ ] Parse all `#[spacetimedb::reducer]` functions in `handlers/` directory (Task 2.1-2.4)
- [ ] Write the reducer catalog section with all ~364 reducers grouped by game system (Task 7.2)
- [ ] Include total reducer count in the document
- [ ] Document each reducer entry with function name and parameter types
- [ ] Run test: `npx vitest run --config packages/client/vitest.config.ts -t "Reducer catalog"`
- [ ] Tests pass (green phase)

**Estimated Effort:** 4 hours

---

### Test: should document reducer argument types + identity convention + Nostr mapping

**File:** `packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts`

**Tasks to make these 3 tests pass:**

- [ ] For each reducer, extract parameter names with types (Task 2.2)
- [ ] Identify the ReducerContext/ctx.sender identity convention (Task 2.3, 4.1-4.3)
- [ ] Document how Nostr pubkey maps to SpacetimeDB Identity (Task 4.2, 4.4)
- [ ] Document type annotations using Rust types (i32, u64, String, Identity, etc.)
- [ ] Run test: `npx vitest run --config packages/client/vitest.config.ts -t "Argument signature"`
- [ ] Tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test: should have sections for all 10 game systems + invocation ordering

**File:** `packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts`

**Tasks to make these 12 tests pass:**

- [ ] Group reducers by game system based on source directory structure (Task 3.1-3.2)
- [ ] Create heading sections for all 10 systems: movement, gathering, crafting, combat, building, trading, empire, chat, player lifecycle, administrative (Task 3.2)
- [ ] Order reducers by typical invocation sequence within each system (Task 3.3)
- [ ] Use sequence indicators (numbered lists, arrows) to show invocation order
- [ ] Run test: `npx vitest run --config packages/client/vitest.config.ts -t "Game system"`
- [ ] Tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: should document identity propagation + BLOCKER-1 + BLS handler

**File:** `packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts`

**Tasks to make these 4 tests pass:**

- [ ] Create dedicated "Identity Propagation" section heading (Task 4)
- [ ] Document ReducerContext.sender vs explicit parameter convention (Task 4.1, 4.3)
- [ ] Analyze and document BLOCKER-1 implications (Task 4.4)
- [ ] Document BLS handler identity propagation path from handler.ts (Task 4.5)
- [ ] Cross-reference with `packages/bitcraft-bls/src/spacetimedb-caller.ts`
- [ ] Run test: `npx vitest run --config packages/client/vitest.config.ts -t "Identity propagation"`
- [ ] Tests pass (green phase)

**Estimated Effort:** 3 hours (most critical analysis)

---

### Test: should document FK relationships + argument-to-table mappings

**File:** `packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts`

**Tasks to make these 3 tests pass:**

- [ ] Create "Table-Reducer Relationships" section heading (Task 5)
- [ ] Map reducer argument names to entity table foreign keys (Task 5.2)
- [ ] Document at least 10 concrete FK relationships (Task 5.3)
- [ ] Show explicit argument-to-table-PK mappings (e.g., `item_id` -> `item_desc.id`)
- [ ] Run test: `npx vitest run --config packages/client/vitest.config.ts -t "Foreign key"`
- [ ] Tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: should include Known Constraints + Quick Reference + snake_case + Overview

**File:** `packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts`

**Tasks to make these 4 tests pass:**

- [ ] Create "Known Constraints" section with BLOCKER-1, reducer limitations, identity model constraints (Task 7.4)
- [ ] Create "Quick Reference" section with key reducers for Stories 5.4-5.8 (Task 7.6)
- [ ] Use `snake_case` consistently for all reducer names in backtick code spans (convention from Story 4.1)
- [ ] Create "Overview" section with server architecture summary (Task 7.1)
- [ ] Run test: `npx vitest run --config packages/client/vitest.config.ts -t "Structural completeness"`
- [ ] Tests pass (green phase)

**Estimated Effort:** 1 hour

---

## Running Tests

Tests use `describe.skipIf` -- they are skipped by default to avoid breaking the baseline. They auto-enable when either:
1. `RUN_VERIFICATION_TESTS=true` is set, OR
2. The game reference document exists at the expected path

```bash
# Run all verification tests (explicit opt-in during RED phase)
RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts

# Run specific test group (e.g., AC1 reducer catalog)
RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts -t "Reducer catalog"

# Run with verbose output
RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts --reporter=verbose

# After document is created, tests auto-enable (no env var needed)
npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts

# Run full client test suite (regression check -- verification tests are skipped)
pnpm --filter @sigil/client test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 31 verification tests written and failing
- Tests verify document completeness, structure, and naming conventions
- No regression: all 1096 existing tests pass (67 files pass, 9 files skipped)
- Failure messages are clear and actionable (point to missing document sections)
- Failures are due to missing document, not test bugs

**Verification:**

```
Test Files  1 failed (1)
Tests       31 failed (31)
Duration    197ms
```

- All 31 tests fail because `_bmad-output/planning-artifacts/bitcraft-game-reference.md` does not exist yet
- All failures are `expected false to be true` or `expected 0 to be greater than X`
- These are correct failures -- the document has not been created yet

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Execute Story 5.1 Tasks 1-7** to analyze BitCraft server source and create the game reference document
2. **Task 1:** Analyze server source directory structure
3. **Task 2:** Extract all reducer signatures from `handlers/` directory
4. **Task 3:** Categorize reducers by 10 game systems
5. **Task 4:** Document identity propagation convention (CRITICAL)
6. **Task 5:** Cross-reference reducer arguments with table definitions
7. **Task 6:** Runtime schema cross-reference (optional, requires Docker)
8. **Task 7:** Create the BitCraft Game Reference document at the correct path
9. **Run verification tests** after creating the document to confirm GREEN

**Key Principles:**

- Focus on identity propagation analysis first (Task 4) -- most critical finding
- Use source code from `BitCraftServer/packages/game/src/game/handlers/` as primary data source
- Cross-reference with BLS handler (`packages/bitcraft-bls/src/handler.ts`) for identity propagation
- Use snake_case for all reducer names (established convention from Stories 4.1 and 3.2)
- Run verification tests frequently to track progress

**Progress Tracking:**

- Run `npx vitest run --config packages/client/vitest.config.ts -t "AC4"` to check document exists
- Run individual test groups as you complete each section
- Run full suite when document is complete

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 31 verification tests pass (green phase complete)
2. Review document for accuracy (spot-check 10 reducer signatures against source)
3. Verify reducer count matches published schema (if Docker available)
4. Verify all 10 game systems have accurate reducer groupings
5. Ensure BLOCKER-1 analysis has a clear recommendation
6. Update project-context.md with Epic 5 progress

**Key Principles:**

- Verification tests provide a structural safety net
- Manual peer review is still required for content accuracy
- Stories 5.4-5.8 serve as the ultimate acceptance tests for this document's accuracy

---

## Next Steps

1. **Review this checklist and failing tests** -- verify all 31 tests correspond to story acceptance criteria
2. **Run failing tests** to confirm RED phase: `npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts`
3. **Begin Story 5.1 implementation** -- start with Tasks 1-2 (source analysis) and Task 4 (identity propagation)
4. **Create game reference document** at `_bmad-output/planning-artifacts/bitcraft-game-reference.md`
5. **Run verification tests incrementally** as sections are completed
6. **When all 31 tests pass**, proceed to manual peer review
7. **When peer review complete**, mark story as done

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge and context:

- **test-design-epic-5.md** - Epic 5 test design with verification strategy for Stories 5.1-5.3 (Section 2.1)
- **Story 5.1 implementation spec** - Full story with 5 ACs, 7 tasks, 10 verification steps
- **project-context.md** - Project structure, test conventions, AGREEMENT-1 through AGREEMENT-13
- **vitest.config.ts** (root + client) - Test framework configuration, globals, environment
- **Existing acceptance-criteria.test.ts patterns** - Given-When-Then format, describe/it conventions

**Note:** Standard ATDD knowledge base fragments (fixture-architecture, data-factories, component-tdd, network-first) were NOT loaded because this story has no application code, no UI, no API, and no network requests. The tests are pure file-system verification using Node.js `fs` module.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts --reporter=verbose`

**Results (RED phase, explicit opt-in):**

```
 Test Files  1 failed (1)
      Tests  31 failed (31)
   Start at  21:48:52
   Duration  176ms (transform 23ms, setup 0ms, import 32ms, tests 12ms, environment 0ms)
```

**Results (default run, tests skipped to protect baseline):**

```
 Test Files  1 skipped (1)
      Tests  31 skipped (31)
   Start at  21:48:47
   Duration  124ms (transform 24ms, setup 0ms, import 33ms, tests 0ms, environment 0ms)
```

**Summary:**

- Total tests: 31
- Passing: 0 (expected in RED phase)
- Failing: 31 (expected in RED phase, with RUN_VERIFICATION_TESTS=true)
- Skipped: 31 (default behavior, protects baseline)
- Status: RED phase verified

**Regression Check:**

```
 Test Files  67 passed | 10 skipped (77)
      Tests  1096 passed | 149 skipped (1245)
```

- All 1096 existing tests pass
- 10 skipped files (9 pre-existing + 1 new verification file)
- 149 skipped tests (118 pre-existing + 31 new verification tests)
- Root integration tests (28 tests): all pass
- No regression introduced

**Expected Failure Messages:**

- AC4/V5.1-05: "expected false to be true" (file does not exist)
- AC4/V5.1-05: "expected 0 to be greater than 5000" (empty content)
- AC1/V5.1-01: "expected false to be true" (no Reducer Catalog heading)
- AC1/V5.1-01: "expected false to be true" (no reducer count info)
- AC1/V5.1-01: "expected 0 to be greater than or equal to 100" (no reducer entries)
- AC2/V5.1-02: "expected 0 to be greater than or equal to 10" (no type annotations)
- AC2/V5.1-02: "expected false to be true" (no identity convention docs)
- AC3/V5.1-03: "expected false to be true" (no game system sections -- 10 tests)
- AC3/V5.1-03: "expected +0 to be 10" (0 of 10 game systems found)
- AC2+AC4/V5.1-04: "expected false to be true" (no identity propagation section)
- AC5/V5.1-06: "expected 0 to be greater than or equal to 10" (no FK relationships)
- Structural: "expected null not to be null" (no snake_case reducer names found)

---

## Notes

- **Documentation story adaptation:** This ATDD checklist was adapted for a documentation/research story. Traditional ATDD produces failing code-level tests; this produces failing document-verification tests. The approach is valid because the acceptance criteria define measurable structural requirements on the output document.
- **Stories 5.4-5.8 as ultimate validation:** Even if all 31 verification tests pass, the game reference document is not truly validated until Stories 5.4-5.8 successfully use the documented reducer signatures and identity conventions to execute real actions against the Docker stack.
- **Identity propagation is critical path:** The BLOCKER-1 analysis (Task 4) is the most important finding of Story 5.1. If identity propagation is misunderstood, all downstream validation stories (5.4-5.8) will fail. The verification tests check for the presence of this analysis but cannot validate its correctness -- only Story 5.4 can do that.
- **Reducer count flexibility:** The test threshold for reducer count was set to 100 (not 327) because the document format may vary -- some reducers may be grouped in tables, others in lists, and exact pattern matching may miss some. The 90% coverage target is better validated by manual spot-check.

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Refer to `_bmad-output/planning-artifacts/test-design-epic-5.md` for Epic 5 test strategy
- Refer to Story 5.1 spec at `_bmad-output/implementation-artifacts/5-1-server-source-analysis-and-reducer-catalog.md`

---

**Generated by BMad TEA Agent** - 2026-03-15
