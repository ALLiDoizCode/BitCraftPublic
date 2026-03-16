---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-16'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/5-3-game-loop-mapping-and-precondition-documentation.md'
  - 'packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts'
  - 'packages/client/src/__tests__/story-5-2-state-model-verification.test.ts'
  - '_bmad-output/planning-artifacts/bitcraft-game-reference.md'
  - 'packages/client/vitest.config.ts'
---

# ATDD Checklist - Epic 5, Story 3: Game Loop Mapping & Precondition Documentation

**Date:** 2026-03-16
**Author:** Jonathan
**Primary Test Level:** Unit/Verification (vitest, file-based document validation)

---

## Story Summary

Story 5.3 is a research/documentation story that documents the complete game loops available in BitCraft -- the sequences of actions that constitute meaningful gameplay -- with preconditions and expected state transitions. The primary deliverable is an update to the BitCraft Game Reference document with a new "Game Loops" section.

**As a** developer
**I want** to document complete game loops with preconditions and expected state transitions
**So that** we can design validation tests and skill files that follow real gameplay patterns

---

## Acceptance Criteria

1. **AC1: Core game loop documentation** (FR17, FR19, FR47) -- 9 game loops documented with reducer call sequences, preconditions, state transitions, and observable outcomes
2. **AC2: Movement loop documentation** (FR17) -- Movement sequence with `player_move`, position query, subscription update, valid target hex/alive/cooldown preconditions, `mobile_entity_state.location_x/location_z` state transitions
3. **AC3: Gathering loop documentation** (FR17) -- Gathering sequence with `extract_start`/`extract`, near-resource/health preconditions, `resource_health_state`/`inventory_state` transitions
4. **AC4: Crafting loop documentation** (FR17) -- Crafting sequence with full `craft_*` chain, recipe/materials/building preconditions, `progressive_action_state`/`inventory_state` transitions
5. **AC5: Precondition categorization and Mermaid diagrams** (FR19, FR47) -- All 4 precondition categories (state, spatial, temporal, identity), >= 9 Mermaid sequence diagrams, MVP vs. Phase 2 classification

---

## Failing Tests Created (RED Phase)

### Unit/Verification Tests (154 tests)

**File:** `packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts` (~1700 lines)

Tests auto-skip when Game Loops section does not exist in the game reference document (CI-safe). Tests go RED when `RUN_VERIFICATION_TESTS=true` is set explicitly.

**RED phase verified:**
- 128 tests failing (expected -- Game Loops section not yet implemented)
- 26 tests passing (Stories 5.1/5.2 content preservation checks -- content already exists)
- 0 test bugs (all failures due to missing implementation)

#### AC1: Core game loop documentation (14 tests)
- **Test:** should contain a Game Loops section in the game reference document
  - **Status:** RED - No "Game Loops" section heading found
  - **Verifies:** Game Loops section exists in game reference document
- **Test:** should have substantial Game Loops content (not a stub)
  - **Status:** RED - Game Loops section empty
  - **Verifies:** Content length >= 5000 characters
- **Test:** should document the "player lifecycle" game loop (+ 8 more loop tests via it.each)
  - **Status:** RED - No loop documentation found
  - **Verifies:** All 9 required game loops are documented as sections
- **Test:** should document all 9 required game loops
  - **Status:** RED - 0 of 9 loops found
  - **Verifies:** 100% game loop coverage
- **Test:** should document reducer call sequences for each loop
  - **Status:** RED - No sequence indicators found
  - **Verifies:** >= 15 sequence indicators (arrows, numbered steps) across all loops
- **Test:** should reference core loop reducers (12 tests via it.each)
  - **Status:** RED - Core reducers not found in game loops section
  - **Verifies:** sign_in, sign_out, player_move, extract_start, extract, craft_initiate_start, etc.
- **Test:** should document expected state transitions for each loop
  - **Status:** RED - No state transition descriptions found
  - **Verifies:** >= 18 state transition indicators across all loops
- **Test:** should document observable outcomes for game loops
  - **Status:** RED - No observable outcome language found
  - **Verifies:** Observable/subscription update language present

#### AC2: Movement loop documentation (10 tests)
- **Test:** should document movement sequence including position query
  - **Status:** RED - No position query documentation
  - **Verifies:** Position query step documented
- **Test:** should reference the player_move reducer call
  - **Status:** RED - player_move not in movement section
  - **Verifies:** player_move reducer documented
- **Test:** should document position state update via subscription
  - **Status:** RED - No subscription update documentation
  - **Verifies:** Subscription-based observation documented
- **Test:** should document valid target hex / alive / cooldown preconditions
  - **Status:** RED - No preconditions documented
  - **Verifies:** All 3 movement preconditions present
- **Test:** should document location_x/location_z state transition
  - **Status:** RED - No column-level transition documentation
  - **Verifies:** Specific column names from mobile_entity_state
- **Test:** should document PlayerMoveRequest structure
  - **Status:** RED - No request structure documentation
  - **Verifies:** Request type or key fields documented

#### AC3: Gathering loop documentation (12 tests)
- **Test:** should document gathering sequence (move, extract_start, extract, inventory)
  - **Status:** RED - No gathering sequence documentation
  - **Verifies:** Complete gathering sequence documented
- **Test:** should document extract_start and extract reducers
  - **Status:** RED - Reducers not found
  - **Verifies:** Both progressive action phases documented
- **Test:** should document spatial/state preconditions
  - **Status:** RED - No preconditions
  - **Verifies:** Near resource, resource health, recipe, tool, stamina
- **Test:** should document resource_health_state and inventory_state transitions
  - **Status:** RED - No transitions
  - **Verifies:** Both state tables referenced with specific changes
- **Test:** should document PlayerExtractRequest structure
  - **Status:** RED - No request structure
  - **Verifies:** recipe_id, target_entity_id fields
- **Test:** should document progressive action timer
  - **Status:** RED - No timing documentation
  - **Verifies:** Timer/wait between _start and completion

#### AC4: Crafting loop documentation (14 tests)
- **Test:** should document full crafting sequence (6 reducer calls)
  - **Status:** RED - No crafting sequence
  - **Verifies:** craft_initiate_start, craft_initiate, craft_continue_start, craft_continue, craft_collect
- **Test:** should document recipe/materials/building preconditions
  - **Status:** RED - No preconditions
  - **Verifies:** crafting_recipe_desc, inventory_state materials, building_function proximity
- **Test:** should document progressive_action_state and inventory_state transitions
  - **Status:** RED - No transitions
  - **Verifies:** State creation/update, material consumption, product addition
- **Test:** should document passive crafting sub-loop
  - **Status:** RED - No passive crafting
  - **Verifies:** passive_craft or background crafting documented

#### AC5: Precondition categorization (8 tests)
- **Test:** should use all 4 precondition categories (state, spatial, temporal, identity)
  - **Status:** RED - No precondition categories found
  - **Verifies:** All 4 categories present in game loops section
- **Test:** should have >= 3 preconditions per MVP loop
  - **Status:** RED - No preconditions per loop
  - **Verifies:** Movement, Gathering, Crafting each have >= 3 preconditions

#### AC5: Mermaid sequence diagrams (9 tests)
- **Test:** should have >= 9 Mermaid sequence diagrams
  - **Status:** RED - 0 sequenceDiagram blocks found
  - **Verifies:** One diagram per game loop
- **Test:** should include Client, SpacetimeDB, Tables participants
  - **Status:** RED - No participants
  - **Verifies:** Standard participant naming
- **Test:** should show alt blocks for precondition failures
  - **Status:** RED - No alt blocks
  - **Verifies:** Error paths documented in diagrams

#### AC5: MVP vs. Phase 2 classification (12 tests)
- **Test:** should classify MVP loops (player lifecycle, movement, gathering, crafting, chat)
  - **Status:** RED - No classifications
  - **Verifies:** 5 MVP loops associated with Stories 5.4-5.8
- **Test:** should classify Phase 2 loops (building, combat, trading, empire)
  - **Status:** RED - No classifications
  - **Verifies:** 4 Phase 2 loops classified
- **Test:** should classify all 9 game loops (100% classified)
  - **Status:** RED - 0 of 9 classified
  - **Verifies:** Every loop has a classification

#### Player Lifecycle (Task 2) (8 tests)
- Tests for player_queue_join, sign_in, sign_out, player_respawn reducers
- Tests for signed_in_player_state creation, player_state.signed_in toggle
- Tests for death/respawn sub-loop
- Tests for Mermaid diagram

#### Phase 2 Loops (Building, Combat, Trading, Chat, Empire) (20 tests)
- Building: project_site_place, project_site_add_materials, claim permissions, Phase 2 classification
- Combat: attack_start/attack, target_update, Phase 2 classification
- Trading: P2P trade, market orders, Phase 2 classification
- Chat: chat_post_message, chat_message_state, signed-in precondition
- Empire: empire reducers, Phase 2 classification

#### Precondition Quick Reference (3 tests)
- Tests for quick reference section existence
- Tests for precondition-to-error mappings (>= 5)

#### State transition table references (6 tests)
- 8 key entity tables referenced via it.each
- >= 2 state transitions per MVP loop

#### Stories 5.1/5.2 content preservation (7 tests)
- **Status:** PASSING (26 of 26) - Content already exists
- Reducer Catalog, Identity Propagation, State Model, Entity Mapping, FK Relationships, Subscriptions preserved
- Document size substantially larger than baseline

#### Document structure and formatting (5 tests)
- snake_case for reducers and tables
- Consistent naming with Stories 5.1 and 5.2
- Valid Mermaid syntax

#### Progressive action pattern (4 tests)
- Two-phase pattern documentation
- Timing for gathering and crafting
- Cancellation conditions

#### BLOCKER-1 impact (1 test)
- WebSocket vs BLS testing approach

#### Completeness metrics (4 tests)
- >= 9 game loops, >= 9 diagrams, all 4 categories, 100% classification

---

## Data Factories Created

N/A -- This is a document verification test suite. No data factories are needed. Test data consists of hardcoded string constants (game loop names, reducer names, table names, precondition categories) derived from the story's acceptance criteria.

---

## Fixtures Created

N/A -- Document verification tests use simple file I/O fixtures (shared helper functions for `readGameReference()`, `extractHeadings()`, `countOccurrences()`, `extractSection()`, `escapeRegExp()`). These are inline helper functions in the test file, following the established pattern from Stories 5.1 and 5.2.

---

## Mock Requirements

N/A -- No external services to mock. Tests read a local markdown file and validate its content structure.

---

## Required data-testid Attributes

N/A -- No UI components involved. This is a document verification test suite.

---

## Implementation Checklist

### Test: All AC1 tests (core game loops)

**File:** `packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts`

**Tasks to make these tests pass:**

- [x] Add "## Game Loops" section to `_bmad-output/planning-artifacts/bitcraft-game-reference.md`
- [x] Document all 9 game loops as subsections (player lifecycle, movement, gathering, crafting, building, combat, trading, chat, empire)
- [x] Include reducer call sequences (numbered steps or arrow notation) for each loop
- [x] Include state transition documentation for each loop
- [x] Include observable outcomes for each loop
- [x] Reference all 12 core loop reducers in their appropriate loops
- [x] Run test: `npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts`

### Test: All AC2 tests (movement loop)

**Tasks to make these tests pass:**

- [x] Document movement sequence: position query -> player_move -> subscription update
- [x] Document PlayerMoveRequest structure with fields
- [x] Document preconditions: valid target, alive, cooldown/stamina
- [x] Document state transitions: mobile_entity_state.location_x/location_z, destination_x/destination_z
- [x] Run test: `RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts -t "AC2"`

### Test: All AC3 tests (gathering loop)

**Tasks to make these tests pass:**

- [x] Document gathering sequence: move -> extract_start -> wait -> extract -> inventory update
- [x] Document PlayerExtractRequest structure (recipe_id, target_entity_id)
- [x] Document preconditions: near resource, resource_health > 0, extraction_recipe_desc, tool, stamina
- [x] Document state transitions: resource_health_state.health decrement, inventory_state update
- [x] Document progressive action timer between extract_start and extract
- [x] Run test: `RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts -t "AC3"`

### Test: All AC4 tests (crafting loop)

**Tasks to make these tests pass:**

- [x] Document crafting sequence: materials check -> craft_initiate_start -> craft_initiate -> craft_continue_start -> craft_continue (repeat) -> craft_collect
- [x] Document PlayerCraftInitiateRequest, PlayerCraftContinueRequest, PlayerCraftCollectRequest structures
- [x] Document preconditions: crafting_recipe_desc, materials in inventory_state, building_function proximity
- [x] Document state transitions: progressive_action_state lifecycle, material consumption, product addition
- [x] Document passive crafting sub-loop
- [x] Run test: `RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts -t "AC4"`

### Test: All AC5 tests (preconditions, diagrams, classification)

**Tasks to make these tests pass:**

- [x] Use all 4 precondition categories (state, spatial, temporal, identity) with specific examples
- [x] Create >= 9 Mermaid sequenceDiagram blocks with Client, SpacetimeDB, Tables participants
- [x] Include alt blocks for precondition failures with Err() responses
- [x] Create MVP vs. Phase 2 classification table with all 9 loops classified
- [x] Include classification reasons
- [x] Run test: `RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts -t "AC5"`

### Test: Precondition Quick Reference

**Tasks to make these tests pass:**

- [x] Add "Precondition Quick Reference" subsection to Game Loops
- [x] Map >= 5 common preconditions to their error messages (Not signed in, stamina, too far, etc.)
- [x] Run test: `RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts -t "Precondition Quick Reference"`

### Test: Stories 5.1/5.2 content preservation

**Tasks to make these tests pass:**

- [x] Do NOT remove or modify existing Story 5.1 or 5.2 sections when adding Game Loops
- [x] Tests already passing (26 of 26)

### Test: Document structure and completeness metrics

**Tasks to make these tests pass:**

- [x] Use snake_case for all reducer and table names
- [x] Use consistent naming with Stories 5.1 (reducer catalog) and 5.2 (entity mapping)
- [x] Verify Mermaid diagrams use valid sequenceDiagram syntax
- [x] Document BLOCKER-1 impact (WebSocket bypass recommendation)
- [x] Document progressive action two-phase pattern with timing
- [x] Ensure document is substantially larger than 5.1+5.2 baseline (>= 60K chars)
- [x] Run test: `RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts`

---

## Running Tests

```bash
# Run all failing tests for this story (auto-skip mode -- will skip if Game Loops section absent)
npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts

# Run all tests explicitly in RED phase (forces tests to run even without implementation)
RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts

# Run specific test suite (e.g., AC2 movement tests)
RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts -t "AC2"

# Run tests in watch mode during implementation
RUN_VERIFICATION_TESTS=true npx vitest --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts --watch

# Run all client tests to verify no regressions
npx vitest run --config packages/client/vitest.config.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 154 tests written and auto-skipping (CI-safe)
- 128 tests fail when explicitly enabled (RED phase verified)
- 26 tests pass (Stories 5.1/5.2 preservation checks)
- All failure messages are clear and actionable
- Tests fail due to missing Game Loops section, not test bugs

**Verification:**

```
RUN_VERIFICATION_TESTS=true -- 128 failing, 26 passing, 0 errors
Auto-skip mode -- 154 skipped, 0 failing, 0 errors
```

---

### GREEN Phase (Complete)

**DEV Agent Completed:**

1. Analyzed BitCraft server source code in `BitCraftServer/packages/game/src/game/handlers/` for reducer precondition logic (15+ files examined)
2. Added "## Game Loops" section to `_bmad-output/planning-artifacts/bitcraft-game-reference.md` (~852 lines)
3. Documented all 9 game loops with reducer sequences, preconditions, state transitions
4. Created 9 Mermaid sequence diagrams (one per loop)
5. Added MVP vs. Phase 2 classification table (5 MVP, 4 Phase 2)
6. Added Precondition Quick Reference (~30 preconditions mapped to error messages)
7. All 154 tests pass (128 turned GREEN from RED, 26 always-passing preservation tests)

**Verification:**

```
RUN_VERIFICATION_TESTS=true -- 154 passing, 0 failing, 0 errors
Stories 5.1+5.2 regression -- 170 passing, 0 failing
```

---

### REFACTOR Phase (After All Tests Pass)

1. Verify all 154 tests pass (0 skipped, 0 failing)
2. Cross-check reducer names against Story 5.1 catalog
3. Cross-check table names against Story 5.2 entity mapping
4. Verify Mermaid diagrams render correctly in GitHub Markdown
5. Review precondition documentation for actionability (can a developer write test fixtures from it?)

---

## Next Steps

Story 5.3 is **COMPLETE**. All 154 verification tests pass, all 170 Story 5.1+5.2 regression tests pass.

1. **Proceed to Story 5.4** (Basic Action Round-Trip Validation) -- transitions from documentation to Docker integration testing
2. **Stories 5.5-5.7** will validate the game loop sequences documented here against the live BitCraft server
3. **Story 5.8** will use the Precondition Quick Reference for error scenario testing

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** -- Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **data-factories.md** -- N/A for document verification (no factories needed)
- **component-tdd.md** -- N/A for document verification (no components)
- **network-first.md** -- N/A for document verification (no network)
- **test-levels-framework.md** -- Test level selection: Unit/Verification for documentation story

**Established patterns reused:**

- Story 5.1 test file pattern (66 tests, `describe.skipIf`, helper functions, regex-based content validation)
- Story 5.2 test file pattern (104 tests, section-based checking with `extractSection()`, content preservation tests)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts`

**Summary:**

- Total tests: 154
- Passing: 26 (Stories 5.1/5.2 content preservation -- expected)
- Failing: 128 (expected -- Game Loops section not yet implemented)
- Status: RED phase verified

### Auto-Skip Mode Verification

**Command:** `npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts`

**Summary:**

- Total tests: 154
- Skipped: 154 (Game Loops section does not exist yet)
- Failing: 0 (CI-safe)
- Status: Auto-skip verified

### GREEN Phase Test Run (Implementation Complete)

**Command:** `npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts`

**Summary:**

- Total tests: 154
- Passing: 154 (all GREEN)
- Failing: 0
- Duration: ~186ms
- Status: GREEN phase complete

### Stories 5.1+5.2 Regression Check (Post-Implementation)

**Command:** `npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts packages/client/src/__tests__/story-5-2-state-model-verification.test.ts`

**Summary:**

- Total tests: 170
- Passing: 170 (no regressions)
- Failing: 0
- Duration: ~185ms

### Full Client Suite Regression Check

**Command:** `npx vitest run --config packages/client/vitest.config.ts`

**Summary:**

- Test Files: 95 passed, 17 skipped, 1 failed (pre-existing timeout in story-1-1)
- Tests: 1739 passed, 198 skipped, 3 failed (pre-existing)
- No regressions introduced by Story 5.3

---

## Notes

- Story 5.3 follows the exact same ATDD pattern as Stories 5.1 (66 tests) and 5.2 (104 tests)
- 154 tests is consistent with the increasing complexity of each story in Epic 5
- The auto-skip pattern (`describe.skipIf`) ensures CI remains green until implementation begins
- Tests are designed to progressively turn green as each game loop section is added
- The `extractSection()` helper allows testing individual loop sections independently
- BLOCKER-1 (identity propagation mismatch) is tested for documentation coverage, not resolution
- Progressive action pattern timing is a key testing focus -- Stories 5.5-5.7 depend on this documentation

---

**Generated by BMad TEA Agent** - 2026-03-16
