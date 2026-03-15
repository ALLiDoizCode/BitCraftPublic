---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-15'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-7-swappable-agent-configuration.md'
  - 'packages/client/vitest.config.ts'
  - 'packages/client/src/agent/index.ts'
  - 'packages/client/src/agent/agent-config-loader.ts'
  - 'packages/client/src/agent/agent-config-types.ts'
  - 'packages/client/src/agent/skill-parser.ts'
  - 'packages/client/src/agent/skill-loader.ts'
  - 'packages/client/src/agent/types.ts'
  - 'packages/client/src/agent/decision-log-types.ts'
  - 'packages/client/src/agent/__tests__/config-stateless.test.ts'
  - 'packages/client/src/index.ts'
---

# ATDD Checklist - Epic 4, Story 7: Swappable Agent Configuration

**Date:** 2026-03-15
**Author:** Jonathan
**Primary Test Level:** Unit (vitest)

---

## Story Summary

Validates that the parsing and loading infrastructure from Stories 4.1 and 4.2 supports hot-swap semantics (restart-and-reload pattern) and adds configuration versioning via SHA-256 content hashing for experiment reproducibility.

**As a** researcher,
**I want** to swap agent skills, behavior, and configuration by editing markdown files,
**So that** I can run different agent strategies without code changes.

---

## Acceptance Criteria

1. **AC1 - Skill set swap on restart** (FR27): Modifying Agent.md to reference different skill files, then calling `reloadAgentConfig()`, results in only the new skills being active. Old skills are removed from the SkillRegistry.
2. **AC2 - Multi-agent independence** (FR27): Two Agent.md files with different personalities and skill selections produce independent agent configurations with separate SkillRegistry instances and no shared mutable state.
3. **AC3 - Skill file update on restart** (FR27): Updating a SKILL.md file (parameters, description, evals, reducer, body) and calling `reloadAgentConfig()` results in the updated skill definition being loaded from disk.
4. **AC4 - Configuration versioning for reproducibility** (FR27, FR39): Each run's Agent.md and skill file versions are captured via SHA-256 content hashing. Version information is formatted for decision log entries (`agentMdVersion: "sha256:<12-char-hex>"`, `activeSkills: string[]`).

---

## Failing Tests Created (RED Phase)

### Unit Tests (38 tests across 4 files)

**File:** `packages/client/src/agent/__tests__/config-swap.test.ts` (10 tests)

- **Test:** reload with different Agent.md skill references -> only new skills active
  - **Status:** GREEN - Tests existing loadAgentConfig/reloadAgentConfig infrastructure
  - **Verifies:** AC1 - Skill set replacement on restart
- **Test:** old skills A, B no longer in SkillRegistry after swap to C, D
  - **Status:** GREEN - Tests existing SkillRegistry isolation
  - **Verifies:** AC1 - Old skills removed from registry
- **Test:** new skills C, D are in SkillRegistry after swap
  - **Status:** GREEN - Tests registry population after reload
  - **Verifies:** AC1 - New skills available in registry
- **Test:** reload produces a new ResolvedAgentConfig instance (not mutated original)
  - **Status:** GREEN - Tests object immutability
  - **Verifies:** AC1 - Config objects are independent instances
- **Test:** reloadAgentConfig() reads fresh from disk
  - **Status:** GREEN - Tests stateless reload (NFR25)
  - **Verifies:** AC1 - Fresh disk read on every call
- **Test:** Agent.md personality change reflected after reload
  - **Status:** GREEN - Tests personality swap
  - **Verifies:** AC1 - Non-skill config changes reflected
- **Test:** Agent.md budget change reflected after reload
  - **Status:** GREEN - Tests budget swap
  - **Verifies:** AC1 - Budget value changes reflected
- **Test:** Agent.md removes budget section -> reload -> budget is undefined
  - **Status:** GREEN - Tests budget removal
  - **Verifies:** AC1 - Removed sections become undefined
- **Test:** Agent.md adds new skill -> reload -> new skill available
  - **Status:** GREEN - Tests incremental skill addition
  - **Verifies:** AC1 - New skill appears in registry
- **Test:** Agent.md removes a skill -> reload -> removed skill no longer available
  - **Status:** GREEN - Tests skill removal
  - **Verifies:** AC1 - Removed skill gone from registry

**File:** `packages/client/src/agent/__tests__/multi-agent-config.test.ts` (8 tests)

- **Test:** Agent 1 with skills A, B and Agent 2 with skills C, D -> independent configs
  - **Status:** GREEN - Tests independent config loading
  - **Verifies:** AC2 - Multi-agent skill independence
- **Test:** Agent 1 SkillRegistry does not contain Agent 2 skills
  - **Status:** GREEN - Tests registry isolation
  - **Verifies:** AC2 - No cross-agent skill leakage
- **Test:** Agent 2 SkillRegistry does not contain Agent 1 skills
  - **Status:** GREEN - Tests reverse registry isolation
  - **Verifies:** AC2 - Bidirectional isolation
- **Test:** modifying Agent 1 config does not affect Agent 2 loaded config
  - **Status:** GREEN - Tests config mutation independence
  - **Verifies:** AC2 - No shared mutable state
- **Test:** two agents with same skill name but different Agent.md files -> separate registries
  - **Status:** GREEN - Tests same-name skill isolation
  - **Verifies:** AC2 - Shared skill name, separate instances
- **Test:** two agents loaded concurrently (Promise.all) -> both resolve independently
  - **Status:** GREEN - Tests concurrent loading
  - **Verifies:** AC2 - No race conditions in parallel loading
- **Test:** agent names are different in each config
  - **Status:** GREEN - Tests name independence
  - **Verifies:** AC2 - Agent identity isolation
- **Test:** personality descriptions are independent per agent
  - **Status:** GREEN - Tests personality isolation
  - **Verifies:** AC2 - Personality config independence

**File:** `packages/client/src/agent/__tests__/skill-update.test.ts` (7 tests)

- **Test:** SKILL.md updated with new description -> reload -> new description used
  - **Status:** GREEN - Tests description update
  - **Verifies:** AC3 - Description changes reflected
- **Test:** SKILL.md updated with new parameters -> reload -> new params reflected
  - **Status:** GREEN - Tests parameter update
  - **Verifies:** AC3 - Parameter changes reflected
- **Test:** SKILL.md updated with added evals -> reload -> evals present
  - **Status:** GREEN - Tests eval addition
  - **Verifies:** AC3 - New evals loaded
- **Test:** SKILL.md updated with changed reducer -> reload -> new reducer in skill
  - **Status:** GREEN - Tests reducer name update
  - **Verifies:** AC3 - Reducer changes reflected
- **Test:** SKILL.md body content updated -> reload -> new body content
  - **Status:** GREEN - Tests body content update
  - **Verifies:** AC3 - Markdown body changes reflected
- **Test:** multiple skill files updated simultaneously -> reload -> all updates reflected
  - **Status:** GREEN - Tests multi-file updates
  - **Verifies:** AC3 - Concurrent skill updates handled
- **Test:** SKILL.md made invalid after initial load -> reload -> error thrown
  - **Status:** GREEN - Tests error handling on corruption
  - **Verifies:** AC3 - Invalid skill file causes error (old config NOT retained)

**File:** `packages/client/src/agent/__tests__/config-versioning.test.ts` (13 tests)

- **Test:** computeContentHash() returns 12-character hex string
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Hash format (12 hex chars)
- **Test:** computeContentHash() returns same hash for same content (deterministic)
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Hash determinism (uses real SHA-256, NOT mocked)
- **Test:** computeContentHash() returns different hash for different content
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Hash uniqueness (uses real SHA-256, NOT mocked)
- **Test:** computeSkillVersion() returns SkillVersion with name, contentHash, reducer
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Skill version structure
- **Test:** computeConfigVersion() produces ConfigVersion with agent hash and skill hashes
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Full config version computation
- **Test:** computeConfigVersion() includes ISO 8601 timestamp
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Timestamp in version
- **Test:** computeConfigVersion() uses "unknown" fallback when skill content not in map
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Defensive fallback for missing content
- **Test:** createConfigSnapshot() produces snapshot with agentMdVersion prefixed with "sha256:"
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Version string format
- **Test:** createConfigSnapshot() includes correct active skill names
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Active skill list in snapshot
- **Test:** formatVersionForDecisionLog() returns { agentMdVersion, activeSkills } matching DecisionLogEntry.agentConfig
  - **Status:** RED - Cannot find module '../config-version.js'
  - **Verifies:** AC4 - Decision log format compatibility
- **Test:** readSkillContents() returns Map keyed by skill name with raw file content
  - **Status:** RED - Cannot find module '../versioned-config-loader.js'
  - **Verifies:** AC4 - Skill content reading for hashing
- **Test:** loadVersionedAgentConfig() includes configSnapshot in returned config
  - **Status:** RED - Cannot find module '../versioned-config-loader.js'
  - **Verifies:** AC4 - Versioned loader integration
- **Test:** config version changes when Agent.md content changes
  - **Status:** RED - Cannot find module '../versioned-config-loader.js'
  - **Verifies:** AC4 - Version detects Agent.md modifications
- config version changes when any SKILL.md content changes
  - **Status:** RED - Cannot find module '../versioned-config-loader.js'
  - **Verifies:** AC4 - Version detects skill file modifications

---

## Data Factories Created

No data factories needed. Tests use inline helper functions (`createTempAgentDir`, `validSkillContent`, `skillContent`, `createTestSkill`, `createTestConfig`) that generate test data directly. This matches the existing test pattern from `config-stateless.test.ts` (Story 4.2).

---

## Fixtures Created

No Playwright fixtures needed. This is a backend/unit test project using vitest. Test setup uses temp directories created with `mkdtempSync()` and cleaned up with `rmSync()` in `try/finally` blocks.

---

## Mock Requirements

### config-versioning.test.ts (AC4)

No mocks for hash stability tests -- `computeContentHash` tests use real `node:crypto` SHA-256.

For `readSkillContents` and `loadVersionedAgentConfig` tests: Uses real temp files (matching the pattern from existing tests), no vi.mock needed.

---

## Required data-testid Attributes

N/A -- This is a backend/library project with no UI components. No data-testid attributes needed.

---

## Implementation Checklist

### Test: config-versioning.test.ts (13 tests) - AC4

**File:** `packages/client/src/agent/__tests__/config-versioning.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/client/src/agent/config-version-types.ts` with `ConfigVersion`, `SkillVersion`, `ConfigSnapshot` interfaces
- [ ] Create `packages/client/src/agent/config-version.ts` with:
  - [ ] `computeContentHash(content: string): string` -- SHA-256 truncated to 12 hex chars
  - [ ] `computeSkillVersion(skill: Skill, content: string): SkillVersion`
  - [ ] `computeConfigVersion(agentMdContent, agentMdPath, skillContents, skills): ConfigVersion`
  - [ ] `createConfigSnapshot(config: ResolvedAgentConfig, version: ConfigVersion): ConfigSnapshot`
  - [ ] `formatVersionForDecisionLog(snapshot: ConfigSnapshot): { agentMdVersion, activeSkills }`
- [ ] Create `packages/client/src/agent/versioned-config-loader.ts` with:
  - [ ] `VersionedAgentConfig` interface extending `ResolvedAgentConfig`
  - [ ] `readSkillContents(skillsDirPath: string): Promise<Map<string, string>>`
  - [ ] `loadVersionedAgentConfig(agentMdPath, skillsDirPath): Promise<VersionedAgentConfig>`
  - [ ] `reloadVersionedAgentConfig(agentMdPath, skillsDirPath): Promise<VersionedAgentConfig>`
- [ ] Update `packages/client/src/agent/index.ts` with Story 4.7 exports
- [ ] Update `packages/client/src/index.ts` with Story 4.7 re-exports
- [ ] Run tests: `pnpm --filter @sigil/client test:unit`
- [ ] Verify build: `pnpm --filter @sigil/client build`
- [ ] Full regression: `pnpm test`

**Estimated Effort:** 2-3 hours

---

### Tests: config-swap.test.ts (10 tests) - AC1

**File:** `packages/client/src/agent/__tests__/config-swap.test.ts`

**Status:** All 10 tests already PASS (GREEN). These validate existing `loadAgentConfig`/`reloadAgentConfig` infrastructure from Story 4.2.

**No implementation tasks needed.** These tests confirm the existing stateless reload mechanism supports config swapping.

---

### Tests: multi-agent-config.test.ts (8 tests) - AC2

**File:** `packages/client/src/agent/__tests__/multi-agent-config.test.ts`

**Status:** All 8 tests already PASS (GREEN). These validate existing infrastructure produces independent agent configurations.

**No implementation tasks needed.** These tests confirm multi-agent independence is inherent in the existing design.

---

### Tests: skill-update.test.ts (7 tests) - AC3

**File:** `packages/client/src/agent/__tests__/skill-update.test.ts`

**Status:** All 7 tests already PASS (GREEN). These validate that skill file updates are reflected on reload.

**No implementation tasks needed.** These tests confirm stateless disk reads (NFR25) automatically pick up skill file changes.

---

## Running Tests

```bash
# Run all Story 4.7 tests (after implementation)
pnpm --filter @sigil/client test:unit

# Run only the config-versioning tests (RED phase -> GREEN after implementation)
cd packages/client && npx vitest run src/agent/__tests__/config-versioning.test.ts

# Run AC1/AC2/AC3 tests (already GREEN)
cd packages/client && npx vitest run --exclude '**/config-versioning.test.ts' src/agent/__tests__/config-swap.test.ts src/agent/__tests__/multi-agent-config.test.ts src/agent/__tests__/skill-update.test.ts

# Run all client tests in watch mode
cd packages/client && npx vitest src/agent/__tests__/config-versioning.test.ts

# Run with coverage
pnpm --filter @sigil/client test:coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Current)

**TEA Agent Responsibilities:**

- All 38 tests written across 4 test files
- AC1 (10 tests): GREEN -- validates existing infrastructure
- AC2 (8 tests): GREEN -- validates existing infrastructure
- AC3 (7 tests): GREEN -- validates existing infrastructure
- AC4 (13 tests): RED -- requires new modules (config-version.ts, config-version-types.ts, versioned-config-loader.ts)
- Implementation checklist created

**Verification:**

- AC4 tests fail with "Cannot find module '../config-version.js'" (expected)
- AC4 tests fail with "Cannot find module '../versioned-config-loader.js'" (expected)
- Failures are due to missing implementation modules, not test bugs
- AC1/AC2/AC3 tests pass using existing Story 4.2 infrastructure

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Create `config-version-types.ts` with type definitions
2. Create `config-version.ts` with hash computation functions
3. Create `versioned-config-loader.ts` with versioned loader
4. Run `config-versioning.test.ts` to verify all 13 tests pass
5. Update barrel exports (`index.ts`)
6. Run full regression to verify no breakage

**Key Principles:**

- One module at a time (types first, then computation, then loader)
- Minimal implementation (follow the story spec exactly)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 38 tests pass (green phase complete)
2. Review code for quality (readability, maintainability)
3. Ensure JSDoc @module headers on all new files
4. Verify .js import extensions (ESM compatibility)
5. Verify no `any` types in new code
6. Run `pnpm --filter @sigil/client build` to verify compilation

---

## Next Steps

1. **Review this checklist** to understand what needs implementation
2. **Run AC4 failing tests** to confirm RED phase: `cd packages/client && npx vitest run src/agent/__tests__/config-versioning.test.ts`
3. **Begin implementation** following the task list in the story spec (Tasks 1-3, then Task 8 for exports)
4. **Work through AC4 tests** one module at a time (types -> computation -> loader)
5. **When all tests pass**, run full regression: `pnpm test`
6. **Commit**: `feat(4-7): story complete`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following sources:

- **config-stateless.test.ts** (Story 4.2) -- Test patterns for real temp files, agent config loading, and cleanup
- **decision-logger.test.ts** (Story 4.6) -- Test patterns for mocked file I/O, factory functions
- **agent-config-loader.ts** (Story 4.2) -- loadAgentConfig, reloadAgentConfig implementation
- **agent-config-types.ts** (Story 4.2) -- AgentConfig, ResolvedAgentConfig, AgentConfigError
- **skill-parser.ts** (Story 4.1) -- parseSkillFile, parseSkillMetadata
- **skill-loader.ts** (Story 4.1) -- loadSkillDirectory, Dirent-based readdir patterns
- **types.ts** (Story 4.1) -- Skill, SkillMetadata, SkillParseError
- **decision-log-types.ts** (Story 4.6) -- DecisionLogEntry.agentConfig interface
- **test-design-epic-4.md** (Section 2.7) -- Test design specification for Story 4.7

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd packages/client && npx vitest run src/agent/__tests__/config-versioning.test.ts`

**Results:**

```
FAIL src/agent/__tests__/config-versioning.test.ts
Error: Cannot find module '../config-version.js' imported from
/Users/jonathangreen/Documents/BitCraftPublic/packages/client/src/agent/__tests__/config-versioning.test.ts
```

**Summary:**

- Total tests in config-versioning.test.ts: 13
- Passing: 0 (expected -- modules do not exist)
- Failing: 13 (expected -- "Cannot find module")
- Status: RED phase verified for AC4

### AC1/AC2/AC3 Tests (Already GREEN)

**Command:** `cd packages/client && npx vitest run --exclude '**/config-versioning.test.ts' src/agent/__tests__/config-swap.test.ts src/agent/__tests__/multi-agent-config.test.ts src/agent/__tests__/skill-update.test.ts`

**Results:**

```
Test Files  3 passed (3)
     Tests  25 passed (25)
```

**Summary:**

- config-swap.test.ts: 10/10 passed
- multi-agent-config.test.ts: 8/8 passed
- skill-update.test.ts: 7/7 passed
- Status: GREEN -- existing infrastructure already supports AC1, AC2, AC3

---

## Notes

- **AC1/AC2/AC3 require no new implementation** -- existing `loadAgentConfig`/`reloadAgentConfig` from Story 4.2 already provides stateless reload, multi-agent independence, and skill file update detection. The tests written here formalize and validate these behaviors.
- **AC4 is the only acceptance criterion requiring new code** -- `config-version-types.ts`, `config-version.ts`, and `versioned-config-loader.ts` are the three new source files needed.
- **Hash tests use real SHA-256** -- `computeContentHash` tests do NOT mock `node:crypto`. They verify deterministic hashing with real cryptographic operations.
- **No Docker required** -- all tests use temp directories and vitest's built-in test runner.
- **Test pattern matches Story 4.2** -- Uses real temp files with `mkdtempSync`/`rmSync` in `try/finally` blocks, matching `config-stateless.test.ts`.

---

**Generated by BMad TEA Agent** - 2026-03-15
