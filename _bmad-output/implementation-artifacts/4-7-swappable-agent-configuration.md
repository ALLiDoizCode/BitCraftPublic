# Story 4.7: Swappable Agent Configuration

Status: done

<!--
Validation Status: VALIDATED
Review Type: Adversarial Review via /bmad-review-adversarial-general (2026-03-15)
Reviewer: Claude Opus 4.6
BMAD Standards Compliance: VERIFIED (2026-03-15)
- Story structure: Complete (all required sections present, including Change Log and Code Review Record templates)
- Acceptance criteria: 4 ACs with Given/When/Then format, FR/NFR traceability
- Task breakdown: 10 tasks with detailed subtasks, AC mapping on each task
- FR traceability: FR27 -> AC1, AC2, AC3; FR39 -> AC4; NFR7 -> implicit; NFR25 -> AC1, AC3
- Dependencies: Documented (3 epics + 6 stories required complete, 2 external noted, 2 stories blocked)
- Technical design: Comprehensive with architecture decisions, data flow, security review
- Security review: OWASP Top 10 coverage complete (A01-A06, A09)
Issues Found & Fixed: 7 (see Change Log below)
Ready for Implementation: YES
-->

## Story

As a researcher,
I want to swap agent skills, behavior, and configuration by editing markdown files,
So that I can run different agent strategies without code changes.

## Dependencies

**Required Complete (all done):**

- **Epic 1** (Project Foundation) -- monorepo structure, SpacetimeDB connection, static data loader
- **Epic 2** (Action Execution & Payment Pipeline) -- action cost registry (Story 2.2), publish pipeline
- **Epic 3** (BitCraft BLS Game Action Handler) -- BLS handler consuming `{ reducer, args }` payloads
- **Story 4.1** (Skill File Format & Parser) -- `Skill` types, `SkillMetadata`, `SkillRegistry`, `parseSkillFile`, `loadSkillDirectory`
- **Story 4.2** (Agent.md Configuration & Skill Selection) -- `AgentConfig`, `ResolvedAgentConfig`, `loadAgentConfig`, `reloadAgentConfig`, `generateAgentFiles`
- **Story 4.3** (Configuration Validation Against SpacetimeDB) -- `validateAgentConfig`, `validateAgentConfigOffline`, `ModuleInfo`
- **Story 4.4** (Budget Tracking & Limits) -- `BudgetTracker`, `BudgetMetrics`, `createBudgetTrackerFromConfig`, `BudgetPublishGuard`
- **Story 4.5** (Event Interpretation as Semantic Narratives) -- `SemanticNarrative`, `EventInterpreter`
- **Story 4.6** (Structured Decision Logging) -- `DecisionLogger`, `DecisionLogEntry`, `DecisionContext` (agentConfig field for version tracking)

**External Dependencies:**

- Node.js `node:fs/promises` for file I/O (readFile, readdir, stat) -- standard library, no npm dependencies
- Node.js `node:path` for path joining (join) -- standard library, no npm dependencies
- Node.js `node:crypto` for content hashing (createHash) -- standard library, no npm dependencies
- No Docker required for any tests (file I/O is mocked with vitest)

**Blocks:**

- Story 8.2 (Agent Observation Mode in TUI) -- observation mode may display active config version
- Story 11.4 (Comparative Decision Log Analysis) -- config versions in logs enable cross-run comparison

## Acceptance Criteria

1. **Skill set swap on restart (AC1)** (FR27)
   - **Given** a running agent with a set of active skills
   - **When** I modify Agent.md to reference different skill files
   - **Then** on next agent restart (call to `reloadAgentConfig()`), the new skill set takes effect
   - **And** the old skills are no longer available to the agent (filtered `SkillRegistry` contains only new skills)

2. **Multi-agent independence (AC2)** (FR27)
   - **Given** two Agent.md files with different personalities and skill selections
   - **When** I start agents with each configuration (separate `loadAgentConfig()` calls)
   - **Then** each agent behaves according to its own Agent.md independently
   - **And** skill registries are separate instances with no shared mutable state

3. **Skill file update on restart (AC3)** (FR27)
   - **Given** a SKILL.md file that is updated (parameters adjusted, description refined, evals added)
   - **When** the agent restarts (call to `reloadAgentConfig()`)
   - **Then** the updated skill definition is loaded from disk
   - **And** the agent uses the new parameter values and description

4. **Configuration versioning for reproducibility (AC4)** (FR27, FR39)
   - **Given** the agent configuration system
   - **When** different configurations are used across experiment runs
   - **Then** each run's Agent.md and skill file versions are captured and available for logging alongside decision logs
   - **And** version information is sufficient to distinguish different experiment configurations

## Tasks / Subtasks

### Task 1: Define configuration versioning types (AC: 4)

- [x] Create `packages/client/src/agent/config-version-types.ts`:
  - Export `ConfigVersion` interface:
    - `agentMdHash: string` -- SHA-256 hash of the Agent.md file content (first 12 hex chars for brevity)
    - `agentMdPath: string` -- path to the Agent.md file
    - `skillVersions: SkillVersion[]` -- version info for each active skill
    - `timestamp: string` -- ISO 8601 timestamp when version was computed
  - Export `SkillVersion` interface:
    - `name: string` -- skill name
    - `contentHash: string` -- SHA-256 hash of the SKILL.md file content (first 12 hex chars)
    - `reducer: string` -- target reducer name (for quick identification)
  - Export `ConfigSnapshot` interface:
    - `agentName: string` -- from AgentConfig.name
    - `version: ConfigVersion` -- the computed version
    - `activeSkills: string[]` -- list of active skill names (for DecisionLogEntry.agentConfig.activeSkills)
    - `agentMdVersion: string` -- formatted version string for DecisionLogEntry.agentConfig.agentMdVersion (e.g., `"sha256:abc123def456"`)

### Task 2: Implement configuration version computation (AC: 4)

- [x] Create `packages/client/src/agent/config-version.ts`:
  - Import `createHash` from `node:crypto`
  - Export `computeContentHash(content: string): string`:
    - Returns first 12 characters of SHA-256 hex digest of the content
    - Uses `createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 12)`
  - Export `computeSkillVersion(skill: Skill, content: string): SkillVersion`:
    - Returns `{ name: skill.name, contentHash: computeContentHash(content), reducer: skill.reducer }`
  - Export `computeConfigVersion(agentMdContent: string, agentMdPath: string, skillContents: Map<string, string>, skills: Skill[]): ConfigVersion`:
    - Computes `agentMdHash` from Agent.md content via `computeContentHash(agentMdContent)`
    - Computes `skillVersions` by iterating `skills` array: for each skill, looks up `skillContents.get(skill.name)`. If found, hashes the content. If NOT found (skill content unavailable), uses `"unknown"` as the contentHash (defensive fallback).
    - Sets `timestamp` to `new Date().toISOString()`
    - Returns `ConfigVersion`
  - Export `createConfigSnapshot(config: ResolvedAgentConfig, version: ConfigVersion): ConfigSnapshot`:
    - Returns `{ agentName: config.name, version, activeSkills: config.skillNames, agentMdVersion: 'sha256:' + version.agentMdHash }`
  - Export `formatVersionForDecisionLog(snapshot: ConfigSnapshot): { agentMdVersion: string; activeSkills: string[] }`:
    - Returns the `agentConfig` field structure expected by `DecisionLogEntry`
    - `agentMdVersion` = `snapshot.agentMdVersion`
    - `activeSkills` = `snapshot.activeSkills`

### Task 3: Implement versioned agent config loader (AC: 1, 3, 4)

- [x] Create `packages/client/src/agent/versioned-config-loader.ts`:
  - Import `readFile`, `readdir` from `node:fs/promises`
  - Import `join` from `node:path`
  - Import `loadAgentConfig` from `agent-config-loader.js`
  - Import `computeConfigVersion`, `createConfigSnapshot` from `config-version.js`
  - Import `parseSkillMetadata` from `skill-parser.js` (for extracting name from raw content)
  - Export `VersionedAgentConfig` interface:
    - Extends `ResolvedAgentConfig`
    - `configSnapshot: ConfigSnapshot` -- computed version information
  - Export `async function readSkillContents(skillsDirPath: string): Promise<Map<string, string>>`:
    - Lists all `*.skill.md` files in `skillsDirPath` via `readdir()`
    - Reads each file's content via `readFile()`
    - Extracts skill name from YAML frontmatter via `parseSkillMetadata(filePath, content).name`
    - Returns `Map<string, string>` keyed by skill name, valued with raw file content
    - On individual file read errors: logs warning, skips file (defensive, do not crash)
    - **IMPORTANT:** The `Skill` type has NO `filePath` field. This helper re-reads the directory to build the name-to-content mapping needed for per-skill content hashing.
  - Export `async function loadVersionedAgentConfig(agentMdPath: string, skillsDirPath: string): Promise<VersionedAgentConfig>`:
    - Reads Agent.md content from disk via `readFile(agentMdPath, 'utf-8')`
    - Calls `loadAgentConfig(agentMdPath, skillsDirPath)` to get the `ResolvedAgentConfig`
    - Calls `readSkillContents(skillsDirPath)` to get raw file contents keyed by skill name
    - Calls `computeConfigVersion(agentMdContent, agentMdPath, skillContents, resolvedConfig.skills)` to compute version
    - Calls `createConfigSnapshot(resolvedConfig, version)` to build the snapshot
    - Returns `{ ...resolvedConfig, configSnapshot }`
  - Export `async function reloadVersionedAgentConfig(agentMdPath: string, skillsDirPath: string): Promise<VersionedAgentConfig>`:
    - Semantic alias for `loadVersionedAgentConfig()` (same as `reloadAgentConfig` is alias for `loadAgentConfig`)
    - Reads fresh from disk every time (NFR25 stateless)
  - Implementation notes:
    - The skill file content is read a second time (once by `loadSkillDirectory` inside `loadAgentConfig` for parsing, once by `readSkillContents` for hashing). This is acceptable for MVP -- skill files are small (typically < 10KB) and loaded infrequently (only on restart/reload). Do NOT attempt to optimize this -- it would require modifying `loadSkillDirectory` which violates the "wrap, do not patch" constraint.
    - `readSkillContents` uses `parseSkillMetadata` to extract the skill `name` field from frontmatter. This is the ONLY way to map filenames to skill names, since skill names come from YAML frontmatter (not filenames). The `Skill` type has no `filePath` field.
    - If a skill file fails to parse in `readSkillContents` but was parsed successfully by `loadAgentConfig`, its hash will be `"unknown"` (fallback). This is a benign inconsistency -- the skill still works, only the hash is degraded.
    - No caching of hashes -- every call recomputes from disk (NFR25 stateless)

### Task 4: Write config swap unit tests (AC: 1)

Following test design in `_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.7.

- [x] Create `packages/client/src/agent/__tests__/config-swap.test.ts` (~10 tests):
  - Agent starts with skills A, B -> reload with Agent.md referencing C, D -> only C, D active
  - Old skills A, B no longer in the SkillRegistry after swap
  - New skills C, D are in the SkillRegistry after swap
  - Reload produces a new `ResolvedAgentConfig` instance (not mutated original)
  - `reloadAgentConfig()` reads fresh from disk (mocked fs)
  - Agent.md personality change reflected after reload
  - Agent.md budget change reflected after reload
  - Agent.md removes budget section -> reload -> budget is undefined
  - Agent.md adds new skill -> reload -> new skill available
  - Agent.md removes a skill -> reload -> removed skill no longer available

### Task 5: Write multi-agent config tests (AC: 2)

- [x] Create `packages/client/src/agent/__tests__/multi-agent-config.test.ts` (~8 tests):
  - Agent 1 with Agent.md-1 (skills A, B) + Agent 2 with Agent.md-2 (skills C, D) -> independent
  - Agent 1 SkillRegistry does not contain Agent 2's skills
  - Agent 2 SkillRegistry does not contain Agent 1's skills
  - Modifying Agent 1's config does not affect Agent 2's loaded config
  - Two agents with same skill name but different Agent.md files -> separate registries
  - Two agents loaded concurrently (Promise.all) -> both resolve independently
  - Agent names are different in each config
  - Personality descriptions are independent per agent

### Task 6: Write skill update tests (AC: 3)

- [x] Create `packages/client/src/agent/__tests__/skill-update.test.ts` (~7 tests):
  - SKILL.md updated with new description -> reload -> new description used
  - SKILL.md updated with new parameters -> reload -> new params reflected
  - SKILL.md updated with added evals -> reload -> evals present
  - SKILL.md updated with changed reducer -> reload -> new reducer in skill
  - SKILL.md body content updated -> reload -> new body content
  - Multiple skill files updated simultaneously -> reload -> all updates reflected
  - SKILL.md made invalid after initial load -> reload -> error thrown (old config NOT retained)

### Task 7: Write config versioning tests (AC: 4)

- [x] Create `packages/client/src/agent/__tests__/config-versioning.test.ts` (~20 tests):
  - `computeContentHash()` returns 12-character hex string (do NOT mock crypto -- use real SHA-256)
  - `computeContentHash()` returns same hash for same content (do NOT mock crypto)
  - `computeContentHash()` returns different hash for different content (do NOT mock crypto)
  - `computeConfigVersion()` produces ConfigVersion with agent hash and skill hashes
  - `computeConfigVersion()` includes ISO 8601 timestamp
  - `computeConfigVersion()` uses `"unknown"` fallback when skill content not in map
  - `createConfigSnapshot()` produces snapshot with agentMdVersion prefixed with "sha256:"
  - `createConfigSnapshot()` includes correct active skill names
  - `formatVersionForDecisionLog()` returns { agentMdVersion, activeSkills } matching DecisionLogEntry.agentConfig
  - `readSkillContents()` returns Map keyed by skill name with raw file content
  - `loadVersionedAgentConfig()` includes configSnapshot in returned config
  - Config version changes when Agent.md content changes
  - Config version changes when any SKILL.md content changes

### Task 8: Export public API and update barrel files (AC: 1-4)

- [x] Update `packages/client/src/agent/index.ts`:
  - Add Story 4.7 section comment
  - Re-export types: `ConfigVersion`, `SkillVersion`, `ConfigSnapshot`
  - Re-export type: `VersionedAgentConfig`
  - Re-export functions: `computeContentHash`, `computeSkillVersion`, `computeConfigVersion`, `createConfigSnapshot`, `formatVersionForDecisionLog`
  - Re-export functions: `readSkillContents`, `loadVersionedAgentConfig`, `reloadVersionedAgentConfig`
- [x] Update `packages/client/src/index.ts`:
  - Add Story 4.7 export block re-exporting all new types and functions from `'./agent'`
- [x] Verify build: `pnpm --filter @sigil/client build` -- produces dist/ with all new exports
- [x] Verify regression: `pnpm test` -- all existing tests still pass

### Task 9: OWASP security review (AC: 1-4)

- [x] Verify OWASP Top 10 compliance:
  - **A01: Broken Access Control (LOW):** File paths are researcher-configured. No path traversal validation in MVP (researcher controls paths). Neither agentMdPath nor skillsDirPath come from untrusted input.
  - **A02: Cryptographic Failures (LOW):** SHA-256 is used for content hashing (fingerprinting), NOT for security-critical operations (no signing, no encryption). Hash truncation to 12 chars is acceptable for version identification (collision resistance not security-critical here).
  - **A03: Injection (LOW):** All file content is read via `readFile()` and processed through existing parsers (Story 4.1, 4.2). No new parsing logic introduced. Hash computation uses `node:crypto` standard library.
  - **A04: Insecure Design (N/A):** Stateless design (re-read from disk on every call) prevents stale config attacks.
  - **A05: Security Misconfiguration (N/A):** No configurable security settings.
  - **A06: Vulnerable Components (N/A):** No new npm dependencies. Uses only `node:crypto` and `node:fs/promises` standard library.
  - **A09: Security Logging (LOW):** Config version information in decision logs does NOT contain file content -- only hashes and skill names. No sensitive data leaked through version tracking.

### Task 10: Validate against checklist (AC: 1-4)

- [x] Run validation against `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- [x] Verify all ACs have test coverage
- [x] Verify all tasks map to at least one AC
- [x] Verify DOD checklist passes

## Dev Notes

### Architecture Context

This is the **seventh and final story in Epic 4** -- it validates that the parsing and loading infrastructure from Stories 4.1 and 4.2 supports hot-swap semantics and adds configuration versioning for experiment reproducibility. The core behavior is: re-read files on restart, old config replaced entirely.

**Risk Assessment:** LOW risk. This story builds entirely on existing infrastructure. The `reloadAgentConfig()` function (Story 4.2) already exists as a semantic alias for `loadAgentConfig()` -- both read fresh from disk every time (NFR25). The main new work is configuration versioning (AC4).

**Position in the agent pipeline:**

```
1. LOAD CONFIG -- loadAgentConfig() / reloadAgentConfig() (Story 4.2)
   OR loadVersionedAgentConfig() / reloadVersionedAgentConfig() (THIS STORY)
2. VALIDATE -- validateAgentConfig() (Story 4.3)
3. BUDGET INIT -- createBudgetTrackerFromConfig() (Story 4.4)
4. PERCEIVE -- EventInterpreter (Story 4.5)
5. LOG -- DecisionLogger with agentConfig version (Story 4.6)
6. SWAP -- reload config, all steps above re-execute (THIS STORY)
```

### Key Design Principle: Stateless Config, No Hot-Reload

The agent configuration system is **stateless** (NFR25): every `loadAgentConfig()` / `reloadAgentConfig()` call reads fresh from disk. There is no in-memory cache, no file watchers, and no hot-reload mechanism. "Swapping" configuration means:

1. The agent runtime stops its current loop
2. Calls `reloadVersionedAgentConfig()` (or `reloadAgentConfig()`)
3. Gets a completely fresh `ResolvedAgentConfig` (or `VersionedAgentConfig`) with new skills
4. Discards the old config entirely
5. Re-initializes budget tracker, re-validates if needed, resumes loop

This is NOT a runtime hot-swap -- it is a restart-and-reload pattern. The agent runtime (built in future Epics 6/9) is responsible for the restart orchestration. This story provides the building blocks.

### Configuration Versioning (AC4)

The `DecisionLogEntry.agentConfig` field (from Story 4.6) already includes `agentMdVersion: string` and `activeSkills: string[]`. This story implements the version computation:

```typescript
// Version computation
const hash = computeContentHash(agentMdContent); // "abc123def456" (12-char hex)
const version = computeConfigVersion(agentMdContent, path, skillContents, skills);
const snapshot = createConfigSnapshot(resolvedConfig, version);

// For decision log entry
const agentConfig = formatVersionForDecisionLog(snapshot);
// { agentMdVersion: "sha256:abc123def456", activeSkills: ["player_move", "harvest_resource"] }
```

**Why SHA-256 truncated to 12 chars?**

- Full SHA-256 (64 chars) is unnecessarily long for version identification
- 12 hex chars = 48 bits of entropy, sufficient for distinguishing experiment configurations
- Collision probability is negligible for the expected number of configs (< 1000)
- Prefix format `sha256:` makes the hash algorithm explicit and self-documenting
- This is for identification, not security -- truncation is acceptable

### Data Flow

```
Agent Runtime (future Epic 6/9)
  -> calls loadVersionedAgentConfig(agentMdPath, skillsDirPath)
    -> readFile(agentMdPath) -> agentMdContent for hashing
    -> loadAgentConfig(agentMdPath, skillsDirPath) -> ResolvedAgentConfig
    -> readSkillContents(skillsDirPath) -> Map<skillName, rawContent> for hashing
       (re-reads directory, parses frontmatter name via parseSkillMetadata)
    -> computeConfigVersion(agentMdContent, path, skillContents, skills) -> ConfigVersion
    -> createConfigSnapshot(resolvedConfig, version) -> ConfigSnapshot
    -> returns VersionedAgentConfig { ...resolvedConfig, configSnapshot }

  -> Agent uses configSnapshot to populate DecisionContext.agentConfig:
    agentConfig: {
      agentMdVersion: snapshot.agentMdVersion,  // "sha256:abc123def456"
      activeSkills: snapshot.activeSkills,       // ["player_move", "harvest_resource"]
    }

  -> On restart/swap:
    -> calls reloadVersionedAgentConfig(agentMdPath, skillsDirPath)
    -> gets completely fresh VersionedAgentConfig
    -> old config discarded
    -> new skills active, new version hash
```

### Multi-Agent Independence (AC2)

Each `loadAgentConfig()` call creates independent objects:

- Fresh `SkillRegistry` instance (no shared state)
- Fresh `ResolvedAgentConfig` object
- Fresh `Skill[]` array from directory scan

There is no global state, no singleton registry, no shared mutable data. Two agents loaded from different Agent.md files will have completely independent configurations. This is validated by the multi-agent-config tests.

### Relationship to Existing Modules

| Module | Relationship | Direction |
| --- | --- | --- |
| `loadAgentConfig` (Story 4.2) | Provides core config loading; this story wraps it with versioning | Consumed |
| `reloadAgentConfig` (Story 4.2) | Semantic alias; this story provides versioned equivalent | Consumed |
| `loadSkillDirectory` (Story 4.1) | Loads skills from disk; used by loadAgentConfig internally | Consumed |
| `SkillRegistry` (Story 4.1) | Independent instances per agent; validated for isolation | Consumed |
| `DecisionLogEntry.agentConfig` (Story 4.6) | Version info populates this field for reproducibility | Output |
| `BudgetTracker` (Story 4.4) | Re-initialized from new config after swap | Consumer |
| `validateAgentConfig` (Story 4.3) | Re-run after swap if needed | Consumer |

### Project Structure Notes

All new code goes in `packages/client/src/agent/` (extending Stories 4.1-4.6):

```
packages/client/src/agent/
  types.ts                          # (Story 4.1 -- unchanged)
  skill-parser.ts                   # (Story 4.1 -- unchanged)
  skill-loader.ts                   # (Story 4.1 -- unchanged)
  skill-registry.ts                 # (Story 4.1 -- unchanged)
  agent-config-types.ts             # (Story 4.2 -- unchanged)
  agent-config-parser.ts            # (Story 4.2 -- unchanged)
  agent-config-loader.ts            # (Story 4.2 -- unchanged)
  agent-file-generator.ts           # (Story 4.2 -- unchanged)
  triggering-precision.ts           # (Story 4.2 -- unchanged)
  config-validation-types.ts        # (Story 4.3 -- unchanged)
  module-info-fetcher.ts            # (Story 4.3 -- unchanged)
  reducer-validator.ts              # (Story 4.3 -- unchanged)
  table-validator.ts                # (Story 4.3 -- unchanged)
  config-validator.ts               # (Story 4.3 -- unchanged)
  budget-types.ts                   # (Story 4.4 -- unchanged)
  budget-tracker.ts                 # (Story 4.4 -- unchanged)
  budget-publish-guard.ts           # (Story 4.4 -- unchanged)
  event-interpreter-types.ts        # (Story 4.5 -- unchanged)
  table-interpreters.ts             # (Story 4.5 -- unchanged)
  event-interpreter.ts              # (Story 4.5 -- unchanged)
  decision-log-types.ts             # (Story 4.6 -- unchanged)
  decision-logger.ts                # (Story 4.6 -- unchanged)
  decision-log-metrics.ts           # (Story 4.6 -- unchanged)
  config-version-types.ts           # NEW: ConfigVersion, SkillVersion, ConfigSnapshot
  config-version.ts                 # NEW: computeContentHash, computeSkillVersion, computeConfigVersion, createConfigSnapshot, formatVersionForDecisionLog
  versioned-config-loader.ts        # NEW: VersionedAgentConfig, readSkillContents, loadVersionedAgentConfig, reloadVersionedAgentConfig
  index.ts                          # Updated: re-exports for new modules
  __tests__/
    config-swap.test.ts             # NEW: ~10 tests
    multi-agent-config.test.ts      # NEW: ~8 tests
    skill-update.test.ts            # NEW: ~7 tests
    config-versioning.test.ts       # NEW: ~10 tests
```

### Error Patterns

This story does not introduce new error types. It reuses:

- `AgentConfigError` (from Story 4.2) for config loading failures
- `SkillParseError` (from Story 4.1) for skill parsing failures

File I/O errors during hash computation (unlikely: file was already read successfully by the parser) are caught and result in a fallback hash of `"unknown"`. This ensures version computation never crashes the agent.

### Previous Story Intelligence (from Story 4.6)

Key patterns and decisions from Story 4.6 that MUST be followed:

1. **File naming:** kebab-case (e.g., `config-version.ts`, not `configVersion.ts`)
2. **Import extensions:** `.js` suffix for all local imports (ESM compatibility with tsup)
3. **No `any` types:** Use `unknown` or specific types (project convention since Epic 1)
4. **Barrel exports:** `index.ts` per module for public API surface
5. **Co-located tests:** `__tests__/` directory adjacent to source, vitest framework
6. **vitest globals:true:** Tests use vitest globals (`describe`, `it`, `expect` without import)
7. **Commit format:** `feat(4-7): ...` for implementation
8. **JSDoc module comments:** Each source file must have a JSDoc `@module` comment header
9. **No Docker required:** All tests are unit tests with mocked file I/O
10. **Defensive error handling:** File I/O errors caught gracefully, never crash the agent

### Security Considerations (OWASP Top 10)

See Task 9 for full OWASP review. Summary: all LOW or N/A risk. No new attack surfaces -- file paths are researcher-controlled, SHA-256 is for fingerprinting not security, no new npm dependencies, version objects contain only hashes and skill names (no file content, keys, or tokens).

### FR/NFR Traceability

| Requirement | Coverage | Notes |
| --- | --- | --- |
| FR27 (Swappable agent behavior via config changes) | AC1, AC2, AC3 | Skill set swap, multi-agent independence, skill file updates |
| FR39 (Structured decision logs - JSONL) | AC4 | Config version info in decision log entries for reproducibility |
| NFR7 (Skill parsing + validation within 1 second for 50 skills) | Implicit | Versioned loader adds only hash computation overhead (~ms for 50 small files) |
| NFR25 (Stateless config, re-read from disk on restart) | AC1, AC3 | Every reload reads fresh from disk, no caching |

### Test Design Reference

The comprehensive test design is documented in:
`_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.7

Target: ~45 tests (all unit, no integration). No Docker required.
Test design document estimates ~30 tests. This story expands `config-versioning.test.ts` from 5 to 20 tests to add hash stability tests, `loadVersionedAgentConfig` integration tests, `readSkillContents` tests, `reloadVersionedAgentConfig` tests, and cross-AC swap+version tests that were not in the original design but are needed for adequate coverage of the versioning implementation.

**Test file mapping to test design document (Section 2.7):**
- `config-swap.test.ts` (10) -- maps to "config-swap.test.ts" (10): Skill set replacement on restart, old skills removed, new skills active
- `multi-agent-config.test.ts` (8) -- maps to "multi-agent-config.test.ts" (8): Two agents with different configs, independent behavior
- `skill-update.test.ts` (7) -- maps to "skill-update.test.ts" (7): Updated SKILL.md loaded on restart, new params/description used
- `config-versioning.test.ts` (20) -- maps to "config-versioning.test.ts" (5, expanded to 20): Config version computation, hash stability, decision log format, `readSkillContents` mapping, versioned loader integration, reload stateless, cross-AC swap+version, experiment distinguishability

### Mocking Strategy

All file I/O is mocked using vitest mocks:

```typescript
// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  realpath: vi.fn((p: string) => Promise.resolve(p)),
}));
```

**IMPORTANT:** Do NOT mock `node:crypto` in hash stability tests (`computeContentHash` same-content/different-content tests). Those tests MUST use real SHA-256 to verify deterministic hashing behavior. Only mock crypto when testing higher-level functions where hash values don't matter (e.g., `loadVersionedAgentConfig` integration tests where you control file content and just verify the snapshot is present).

**Note on `readdir` mocking:** The existing `loadSkillDirectory` (Story 4.1) calls `readdir(dirPath, { withFileTypes: true })` which returns `Dirent[]` objects. The `readSkillContents` helper should also use `readdir` but can use either plain filenames or `Dirent` objects -- choose one approach and be consistent with the mock setup. If using `loadSkillDirectory`'s pattern (recommended), mock `readdir` to return `Dirent`-like objects with `isFile()` and `name` properties.

For config swap tests, provide different file content on sequential reads:

```typescript
// First load: skills A, B
vi.mocked(readFile).mockResolvedValueOnce(agentMdWithSkillsAB);
// Second load (after swap): skills C, D
vi.mocked(readFile).mockResolvedValueOnce(agentMdWithSkillsCD);
```

For multi-agent tests, use different paths to distinguish agents:

```typescript
const agent1 = await loadVersionedAgentConfig('/agents/agent1.md', '/skills/');
const agent2 = await loadVersionedAgentConfig('/agents/agent2.md', '/skills/');
```

### Git Intelligence

Recent commit pattern: `feat(X-Y): story complete` where X is epic number, Y is story number.
For this story: `feat(4-7): story complete`

Epic 4 branch: `epic-4` (current branch).

Most recent commits:
- `ca1bdb6 feat(4-6): story complete`
- `e3a7ff0 feat(4-5): story complete`
- `c769ea5 feat(4-4): story complete`
- `731cb5f feat(4-3): story complete`
- `8d460cb feat(4-2): story complete`
- `a82e0e3 feat(4-1): story complete`

### References

- Epic 4 definition: `_bmad-output/planning-artifacts/epics.md` (Story 4.7 details, lines 1068-1093)
- Story 4.6 (predecessor): `_bmad-output/implementation-artifacts/4-6-structured-decision-logging.md`
- Story 4.2 (core dependency): `_bmad-output/implementation-artifacts/4-2-agentmd-configuration-and-skill-selection.md`
- Story 4.1 (core dependency): `_bmad-output/implementation-artifacts/4-1-skill-file-format-and-parser.md`
- Test design: `_bmad-output/planning-artifacts/test-design-epic-4.md` (Section 2.7, Section 3.3 swap pipeline)
- Architecture Agent Core Loop: `_bmad-output/planning-artifacts/architecture/6-agent-core-loop.md`
- Architecture Experiment Harness: `_bmad-output/planning-artifacts/architecture/9-experiment-harness.md`
- Agent config loader: `packages/client/src/agent/agent-config-loader.ts` (loadAgentConfig, reloadAgentConfig)
- Agent config types: `packages/client/src/agent/agent-config-types.ts` (AgentConfig, ResolvedAgentConfig)
- Skill registry: `packages/client/src/agent/skill-registry.ts` (SkillRegistry)
- Decision log types: `packages/client/src/agent/decision-log-types.ts` (DecisionLogEntry.agentConfig)
- Agent module barrel: `packages/client/src/agent/index.ts`
- Client package index: `packages/client/src/index.ts`
- Project context: `_bmad-output/project-context.md`
- PRD requirements: FR27, FR39, NFR7, NFR25

### Verification Steps

1. `pnpm --filter @sigil/client build` -- produces dist/ with all new config versioning exports
2. `pnpm --filter @sigil/client test:unit` -- all new unit tests pass (~35 new + existing)
3. `pnpm test` -- all existing tests still pass (regression check)
4. `loadVersionedAgentConfig()` returns VersionedAgentConfig with configSnapshot
5. `reloadVersionedAgentConfig()` reads fresh from disk (verified via mock readFile calls)
6. Config hash changes when file content changes (verified in config-versioning tests)
7. Multi-agent configs are independent (verified in multi-agent-config tests)
8. Skill updates reflected after reload (verified in skill-update tests)
9. Build: `pnpm --filter @sigil/client build` produces ESM + CJS + DTS

## Implementation Constraints

1. No new npm dependencies -- uses only `node:crypto` and `node:fs/promises` from Node.js standard library
2. No `any` types -- use `unknown` or specific types (project convention)
3. All new files follow kebab-case naming convention
4. All new tests use vitest framework (co-located `__tests__/` directory)
5. Import extensions: use `.js` suffix for all local imports (ESM compatibility)
6. Barrel exports: update `src/agent/index.ts` + `src/index.ts` for public API
7. Stateless: every load/reload reads fresh from disk, no caching (NFR25)
8. No Docker required for any tests (file I/O is mocked)
9. No modification to existing Story 4.1-4.6 source files -- new modules only (except barrel exports)
10. No hot-reload mechanism -- restart-and-reload pattern only
11. JSDoc `@module` comment header on each new source file
12. SHA-256 hash truncated to 12 hex chars for version identification
13. Config version format: `"sha256:<12-char-hex>"` for self-documenting version strings
14. No global state -- each agent config is an independent instance
15. Error handling: hash computation failures produce `"unknown"` fallback (never crash the agent)

## CRITICAL Anti-Patterns (MUST AVOID)

- Do NOT implement hot-reload or file watching -- this is a restart-and-reload pattern
- Do NOT cache file content or computed hashes -- NFR25 requires stateless re-read from disk
- Do NOT share mutable state between agent configs -- each `loadAgentConfig()` creates independent objects
- Do NOT modify `agent-config-loader.ts` or `agent-config-parser.ts` -- wrap, do not patch
- Do NOT modify `skill-parser.ts` or `skill-registry.ts` -- consume their outputs, do not change them
- Do NOT modify `decision-logger.ts` or `decision-log-types.ts` -- the agentConfig field format is already defined
- Do NOT use full SHA-256 (64 chars) for version strings -- 12 chars is sufficient and more readable
- Do NOT store raw file content in the ConfigSnapshot or version objects -- only hashes
- Do NOT add npm dependencies -- use only Node.js standard library (`node:crypto`, `node:fs/promises`)
- Do NOT create a new package -- all code goes in `packages/client/src/agent/`
- Do NOT use `any` type -- use `unknown` for generic data, specific types for typed fields
- Do NOT implement experiment run comparison -- that is Story 11.4
- Do NOT implement agent observation mode -- that is Story 8.2
- Do NOT implement LLM-powered agent loop -- that is Epic 9
- Do NOT use synchronous file I/O -- always use async `node:fs/promises`

## Definition of Done

- [x] `ConfigVersion`, `SkillVersion`, `ConfigSnapshot` types defined
- [x] `VersionedAgentConfig` interface extends `ResolvedAgentConfig` with `configSnapshot`
- [x] `computeContentHash()` produces 12-char hex SHA-256 digest
- [x] `computeConfigVersion()` computes version from Agent.md and skill file contents
- [x] `createConfigSnapshot()` builds snapshot with formatted version string
- [x] `formatVersionForDecisionLog()` produces `DecisionLogEntry.agentConfig`-compatible output
- [x] `readSkillContents()` builds skill-name-to-content map from directory scan
- [x] `loadVersionedAgentConfig()` wraps `loadAgentConfig` with version computation
- [x] `reloadVersionedAgentConfig()` reads fresh from disk (NFR25 stateless)
- [x] Config swap on reload: old skills replaced, new skills active (AC1)
- [x] Multi-agent independence: separate registries, no shared state (AC2)
- [x] Skill updates reflected after reload (AC3)
- [x] Config version changes when file content changes (AC4)
- [x] Version format: `"sha256:<12-char-hex>"` for decision log compatibility (AC4)
- [x] Unit tests pass: `pnpm --filter @sigil/client test:unit` (45 Story 4.7 unit tests + existing)
- [x] Build passes: `pnpm --filter @sigil/client build` (ESM + CJS + DTS)
- [x] Full regression: `pnpm test` -- all existing tests still pass
- [x] No `any` types in new code
- [x] No Docker required for any tests
- [x] Security: OWASP Top 10 review completed (A01, A02, A03, A04, A05, A06, A09)
- [x] No private keys, tokens, or file content in version objects
- [x] No new npm dependencies (only `node:crypto` and `node:fs/promises`)

## Change Log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-03-15 | Initial story creation | Epic 4 Story 4.7 spec |
| 2026-03-15 | Adversarial review: 7 issues found and fixed | BMAD quality review via /bmad-review-adversarial-general |
| 2026-03-15 | Added `readSkillContents` helper to Task 3 with explicit name-to-content mapping | Critical gap: Skill type has no filePath field, versioned loader needs to map skill names to raw file content for per-skill hashing |
| 2026-03-15 | Added `readdir`, `realpath` to External Dependencies and Task 3 imports | Missing imports for directory scanning in versioned config loader |
| 2026-03-15 | Added `"unknown"` fallback for missing skill content in `computeConfigVersion` | Defensive handling when skill content unavailable in skillContents map |
| 2026-03-15 | Fixed crypto mocking guidance: do NOT mock for hash stability tests | Dev agent would produce meaningless tests if crypto was mocked for stability checks |
| 2026-03-15 | Deduplicated OWASP section (Dev Notes now references Task 9) | Redundant content wasting tokens |
| 2026-03-15 | Added `readdir` Dirent mocking guidance | Existing skill-loader.ts uses `readdir` with `withFileTypes: true`, mock must match |
| 2026-03-15 | Expanded config-versioning tests: added `readSkillContents`, fallback hash, removed duplicate test | Aligned test coverage with implementation changes |
| 2026-03-15 | Implementation complete: 3 source files created, 2 barrel files updated, 45/45 tests passing | Story 4.7 development session by Claude Opus 4.6 |
| 2026-03-15 | Code review: corrected test count from 39 to 45 in Change Log, added code review record | /bmad-bmm-code-review pass by Claude Opus 4.6 |
| 2026-03-15 | Code review (pass 2): corrected Task 7 test count (~10 -> ~20), Test Design Reference (10 -> 20), target total (~35 -> ~45) | /bmad-bmm-code-review pass 2 by Claude Opus 4.6 -- 4 low-severity documentation inconsistencies fixed |
| 2026-03-15 | Code review (pass 3): fixed JSDoc "logs a warning" -> "silently skips", added security note to readSkillContents, synced sprint-status.yaml to done | /bmad-bmm-code-review pass 3 by Claude Opus 4.6 -- 0 critical, 0 high, 0 medium, 2 low |

## Code Review Record

| Review Pass | Date | Reviewer | Issues Found | Issues Fixed | Notes |
| --- | --- | --- | --- | --- | --- |
| Adversarial Review | 2026-03-15 | Claude Opus 4.6 | 7 | 7 | BMAD standards validation, skill content mapping gap, crypto mock guidance, OWASP dedup |
| Code Review | 2026-03-15 | Claude Opus 4.6 | 1 | 1 | Full implementation review: 0 critical, 0 high, 0 medium, 1 low (Change Log test count 39 corrected to 45) |
| Code Review (pass 2) | 2026-03-15 | Claude Opus 4.6 | 4 | 4 | Full implementation + doc review: 0 critical, 0 high, 0 medium, 4 low (Task 7 test count, Test Design Reference count, target total, test mapping description) |
| Code Review (pass 3) | 2026-03-15 | Claude Opus 4.6 | 2 | 2 | Full adversarial review + OWASP security scan: 0 critical, 0 high, 0 medium, 2 low (JSDoc accuracy in readSkillContents, sprint-status sync) |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None -- all tests passed on first run, no debugging required.

### Completion Notes List

- **Task 1 (config-version-types.ts):** Defined `ConfigVersion`, `SkillVersion`, and `ConfigSnapshot` interfaces with JSDoc comments. All fields match the story spec exactly.
- **Task 2 (config-version.ts):** Implemented `computeContentHash` (SHA-256 truncated to 12 hex chars), `computeSkillVersion`, `computeConfigVersion` (with "unknown" fallback for missing skill content), `createConfigSnapshot`, and `formatVersionForDecisionLog`. Uses only `node:crypto` standard library.
- **Task 3 (versioned-config-loader.ts):** Implemented `VersionedAgentConfig` interface, `readSkillContents` (reads directory, parses frontmatter for skill name, maps name->content), `loadVersionedAgentConfig` (wraps loadAgentConfig with version computation), and `reloadVersionedAgentConfig` (semantic alias). Defensive error handling: directory read failures return empty map, individual file parse failures skip the file.
- **Tasks 4-7 (tests):** Tests were pre-written in TDD RED phase. All 45 tests pass: config-swap.test.ts (10), multi-agent-config.test.ts (8), skill-update.test.ts (7), config-versioning.test.ts (20). Tests use real temp files (not vi.mock) matching the config-stateless.test.ts pattern from Story 4.2. Hash stability tests use real SHA-256 (no crypto mocking).
- **Task 8 (barrel exports):** Updated `packages/client/src/agent/index.ts` with Story 4.7 section exporting all new types and functions. Updated `packages/client/src/index.ts` with Story 4.7 export block. Build produces ESM + CJS + DTS successfully.
- **Task 9 (OWASP):** All LOW or N/A risk. No new npm dependencies. SHA-256 used for fingerprinting not security. File paths are researcher-controlled. Version objects contain only hashes and skill names (no file content, keys, or tokens).
- **Task 10 (validation):** All ACs have test coverage. All tasks map to at least one AC. Build passes, regression passes (1090 client unit tests + 222 BLS tests + 2 placeholder tests).

### File List

- `packages/client/src/agent/config-version-types.ts` -- CREATED: ConfigVersion, SkillVersion, ConfigSnapshot type definitions
- `packages/client/src/agent/config-version.ts` -- CREATED: computeContentHash, computeSkillVersion, computeConfigVersion, createConfigSnapshot, formatVersionForDecisionLog
- `packages/client/src/agent/versioned-config-loader.ts` -- CREATED: VersionedAgentConfig, readSkillContents, loadVersionedAgentConfig, reloadVersionedAgentConfig
- `packages/client/src/agent/index.ts` -- MODIFIED: Added Story 4.7 barrel exports
- `packages/client/src/index.ts` -- MODIFIED: Added Story 4.7 public API exports
- `packages/client/src/agent/__tests__/config-swap.test.ts` -- PRE-EXISTING (TDD RED): 10 tests for AC1
- `packages/client/src/agent/__tests__/multi-agent-config.test.ts` -- PRE-EXISTING (TDD RED): 8 tests for AC2
- `packages/client/src/agent/__tests__/skill-update.test.ts` -- PRE-EXISTING (TDD RED): 7 tests for AC3
- `packages/client/src/agent/__tests__/config-versioning.test.ts` -- PRE-EXISTING (TDD RED): 20 tests for AC4
