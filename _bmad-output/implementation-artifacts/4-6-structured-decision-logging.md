# Story 4.6: Structured Decision Logging

Status: done

<!--
Validation Status: VALIDATED
Review Type: Adversarial Review via /bmad-review-adversarial-general (2026-03-15)
Reviewer: Claude Opus 4.6
BMAD Standards Compliance: VERIFIED (2026-03-15)
- Story structure: Complete (all required sections present, including Change Log and Code Review Record templates)
- Acceptance criteria: 6 ACs with Given/When/Then format, FR/NFR traceability
- Task breakdown: 11 tasks with detailed subtasks, AC mapping on each task
- FR traceability: FR39 -> AC1, AC4, AC5, AC6; NFR16 -> AC3; NFR25 -> AC2
- Dependencies: Documented (3 epics + 5 stories required complete, 2 external noted, 3 stories blocked)
- Technical design: Comprehensive with architecture decisions, data flow, security review
- Security review: OWASP Top 10 coverage complete (A01-A06, A09)
Issues Found & Fixed: 8 (see Change Log below)
Ready for Implementation: YES
-->

## Story

As a researcher,
I want agents to produce structured JSONL decision logs capturing the full decision cycle with eval-compatible metrics,
So that I can analyze agent behavior, run benchmarks, reproduce decisions, and compare across experiment runs.

## Dependencies

**Required Complete (all done):**

- **Epic 1** (Project Foundation) -- monorepo structure, SpacetimeDB connection, static data loader
- **Epic 2** (Action Execution & Payment Pipeline) -- action cost registry (Story 2.2), publish pipeline
- **Epic 3** (BitCraft BLS Game Action Handler) -- BLS handler consuming `{ reducer, args }` payloads
- **Story 4.1** (Skill File Format & Parser) -- `Skill` types, `SkillMetadata` (skill name, description, reducer)
- **Story 4.2** (Agent.md Configuration & Skill Selection) -- `AgentConfig`, `ResolvedAgentConfig` (agent name, active skills)
- **Story 4.3** (Configuration Validation Against SpacetimeDB) -- `ModuleInfo` (table/reducer metadata)
- **Story 4.4** (Budget Tracking & Limits) -- `BudgetTracker`, `BudgetMetrics` (cost tracking, budget status)
- **Story 4.5** (Event Interpretation as Semantic Narratives) -- `SemanticNarrative`, `CorrelatedNarrative`, `EventInterpreter` (semantic events for log entries)

**External Dependencies:**

- Node.js `node:fs/promises` for file I/O (appendFile, stat, rename) -- standard library, no npm dependencies
- No Docker required for any tests (file I/O is mocked with vitest)

**Blocks:**

- Story 4.7 (Swappable Agent Configuration) -- config versions logged alongside decision logs for reproducibility
- Story 8.2 (Agent Observation Mode in TUI) -- observation panel sources data from decision logs
- Story 11.4 (Comparative Decision Log Analysis) -- aggregation tooling consumes JSONL decision log files

## Acceptance Criteria

1. **Decision log entry structure (AC1)** (FR39)
   - **Given** an agent executing its decision cycle
   - **When** a decision is made (observe -> interpret -> decide -> act)
   - **Then** a JSONL log entry is appended with: timestamp, observation summary, semantic events received, skill triggered (name + description match context), action chosen (`{ reducer, args }`), action cost (from action cost registry), action result, and outcome

2. **Append-only JSONL format (AC2)** (NFR25)
   - **Given** decision logging is active
   - **When** log entries are written
   - **Then** they are appended to the configured JSONL file (append-only)
   - **And** each line is valid JSON parseable independently

3. **Log rotation (AC3)** (NFR16)
   - **Given** a decision log file
   - **When** it exceeds 100MB
   - **Then** log rotation or archival is triggered automatically

4. **Failure logging (AC4)** (FR39)
   - **Given** an agent action that fails
   - **When** the failure is logged
   - **Then** the log entry includes the error code, boundary, and error message
   - **And** the world state at the time of failure is captured

5. **Reproducibility (AC5)** (FR39)
   - **Given** decision log entries
   - **When** analyzed after an experiment
   - **Then** each entry contains enough context to reproduce the decision: the input state, the skill invoked, the parameters chosen, and the outcome observed

6. **Eval-compatible metrics (AC6)** (FR39)
   - **Given** decision log entries for benchmark analysis
   - **When** aggregate metrics are computed
   - **Then** the following are derivable per skill: invocation count, trigger accuracy (correct skill for context), execution latency, and cost accumulation
   - **And** the log schema is compatible with eval pass/fail tracking for skill behavioral testing

## Tasks / Subtasks

### Task 1: Define decision log types (AC: 1, 4, 5, 6)

- [x] Create `packages/client/src/agent/decision-log-types.ts`:
  - Export `DecisionLogEntry` interface:
    - `timestamp: string` -- ISO 8601 timestamp (e.g., `"2026-03-15T12:00:00.000Z"`)
    - `observation: string` -- summary of observed game state
    - `semanticEvents: SemanticNarrative[]` -- from Event Interpreter (Story 4.5)
    - `skillTriggered: { name: string; description: string; matchContext: string } | null` -- the skill selected for this decision (null if no skill matched)
    - `action: { reducer: string; args: unknown[] } | null` -- the action payload sent to `client.publish()` (null if skipped)
    - `cost: number | null` -- action cost from action cost registry (null if action was skipped)
    - `result: 'success' | 'failure' | 'skipped'` -- outcome status
    - `outcome: string` -- human-readable outcome description
    - `error?: { code: string; boundary: string; message: string }` -- error details (AC4, present only on failure)
    - `worldState?: Record<string, unknown>` -- captured game state on failure (AC4)
    - `agentConfig: { agentMdVersion: string; activeSkills: string[] }` -- config snapshot for reproducibility (AC5)
    - `metrics: { decisionLatencyMs: number; actionLatencyMs?: number }` -- timing metrics for eval (AC6)
  - Export `DecisionLoggerConfig` interface:
    - `filePath: string` -- path to the JSONL log file
    - `maxFileSizeBytes: number` -- rotation threshold (default: 100 * 1024 * 1024 = 100MB) (AC3)
    - `rotationEnabled: boolean` -- whether to rotate logs (default: true)
  - Export `DecisionLogResult` type: `'success' | 'failure' | 'skipped'`
  - Export `DecisionContext` interface (input to `logDecision()`):
    - `observation: string`
    - `semanticEvents: SemanticNarrative[]`
    - `skillTriggered: DecisionLogEntry['skillTriggered']`
    - `action: DecisionLogEntry['action']`
    - `cost: number | null`
    - `result: DecisionLogResult`
    - `outcome: string`
    - `error?: DecisionLogEntry['error']`
    - `worldState?: Record<string, unknown>`
    - `agentConfig: DecisionLogEntry['agentConfig']`
    - `decisionLatencyMs: number`
    - `actionLatencyMs?: number`

### Task 2: Implement the DecisionLogger class (AC: 1, 2, 3, 4, 5)

- [x] Create `packages/client/src/agent/decision-logger.ts`:
  - Export `DecisionLogger` class:
    - Constructor: `(config: DecisionLoggerConfig)`
    - Stores config with defaults: `maxFileSizeBytes = 100 * 1024 * 1024`, `rotationEnabled = true`
    - `async logDecision(context: DecisionContext): Promise<void>`:
      - Chains onto `_writeQueue` to serialize concurrent writes
      - Inside the chained write:
        - Builds `DecisionLogEntry` from `DecisionContext`:
          - Sets `timestamp` to `new Date().toISOString()`
          - Copies all fields from context
          - Constructs `metrics: { decisionLatencyMs, actionLatencyMs }` from context
        - Serializes entry as single-line JSON (`JSON.stringify(entry)`)
        - Checks file size before writing (if `rotationEnabled`)
        - If file exceeds `maxFileSizeBytes`, calls `rotateLog()` before appending
        - Appends serialized entry + `'\n'` to `filePath` via `fs.appendFile()`
      - Entire write operation wrapped in try-catch: file I/O errors are caught and silently swallowed (agent must not crash due to logging failure)
      - Each call is independent -- no buffering, no batching
    - `async rotateLog(): Promise<void>`:
      - Generates rotated file name: replaces `.jsonl` with `-{ISO timestamp}.jsonl` (e.g., `decisions-2026-03-15T12-00-00.jsonl`)
      - Renames current file to rotated name via `fs.rename()`
      - New entries will be written to a fresh file at the original `filePath`
      - Old file is preserved (not deleted)
    - `async getFileSize(): Promise<number>`:
      - Returns current file size via `fs.stat()`
      - Returns `0` if file does not exist (catches `ENOENT` error)
    - Private `_writeQueue: Promise<void>` (initialized to `Promise.resolve()`):
      - Serializes concurrent writes by chaining promises
      - Each `logDecision()` call chains onto the previous write via `this._writeQueue = this._writeQueue.then(() => this._doWrite(context))`
      - Ensures append ordering matches call ordering
      - Error handling: each write catches its own errors (never breaks the chain)
  - Export `createDecisionLogger(config: Partial<DecisionLoggerConfig> & { filePath: string }): DecisionLogger`:
    - Factory function that applies defaults:
      - `maxFileSizeBytes`: `100 * 1024 * 1024` (100MB)
      - `rotationEnabled`: `true`
    - Returns new `DecisionLogger(resolvedConfig)`

### Task 3: Implement decision log metrics utilities (AC: 6)

- [x] Create `packages/client/src/agent/decision-log-metrics.ts`:
  - Export `SkillMetrics` interface:
    - `skillName: string`
    - `invocationCount: number` -- total times this skill was triggered
    - `successCount: number` -- times result === 'success'
    - `failureCount: number` -- times result === 'failure'
    - `skippedCount: number` -- times result === 'skipped'
    - `triggerAccuracy: number` -- `successCount / invocationCount` (0-1 range, normalized to 0 if invocationCount is 0 to avoid NaN)
    - `totalCost: number` -- sum of all action costs for this skill
    - `avgDecisionLatencyMs: number` -- average `metrics.decisionLatencyMs`
    - `avgActionLatencyMs: number` -- average `metrics.actionLatencyMs` (excludes entries without actionLatencyMs)
  - Export `AggregateMetrics` interface:
    - `totalDecisions: number` -- total log entries analyzed
    - `totalCost: number` -- sum of all costs
    - `overallSuccessRate: number` -- successCount / totalDecisions
    - `perSkill: Map<string, SkillMetrics>` -- per-skill breakdown
    - `evalResults: EvalResult[]` -- eval pass/fail tracking
  - Export `EvalResult` interface:
    - `skillName: string`
    - `evalName: string` -- from skill eval definition
    - `passed: boolean`
    - `details: string` -- explanation
  - Export `computeMetrics(entries: DecisionLogEntry[]): AggregateMetrics`:
    - Iterates through log entries
    - Groups by `skillTriggered.name` (entries with `skillTriggered === null` are grouped under `'(no skill)'`)
    - Computes per-skill: invocation count, success/failure/skipped counts, trigger accuracy, total cost, avg latencies
    - Computes overall: total decisions, total cost, overall success rate
    - Returns `AggregateMetrics` with per-skill breakdown
    - `evalResults` is always returned as an empty array `[]` -- eval pass/fail tracking is populated by external eval tooling (Story 11.4), not by `computeMetrics()`. The field exists in the schema for compatibility.
    - Empty input -> returns zeroed-out metrics with empty perSkill map and empty evalResults array
  - Export `parseJsonlFile(content: string): DecisionLogEntry[]`:
    - Splits content by newlines
    - Filters out empty lines
    - Parses each line as JSON
    - Returns array of `DecisionLogEntry` objects
    - Throws `Error` with line number context on parse failure

### Task 4: Write decision logger unit tests (AC: 1, 2)

Following test design in `_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.6.

- [x] Create `packages/client/src/agent/__tests__/decision-logger.test.ts` (~15 tests):
  - `logDecision()` creates valid JSONL entry with all required fields
  - `logDecision()` sets ISO 8601 timestamp
  - `logDecision()` includes observation summary
  - `logDecision()` includes semantic events array
  - `logDecision()` includes skillTriggered with name, description, matchContext
  - `logDecision()` includes action with reducer and args
  - `logDecision()` includes cost from action cost registry
  - `logDecision()` includes result ('success' | 'failure' | 'skipped')
  - `logDecision()` includes outcome string
  - `logDecision()` includes agentConfig with version and active skills
  - `logDecision()` includes metrics with decisionLatencyMs
  - `logDecision()` with null skillTriggered (no skill matched)
  - `logDecision()` with null action (decision skipped)
  - `logDecision()` with null cost (action skipped)
  - `logDecision()` serializes each entry as single-line JSON (no newlines within entry)
  - Multiple `logDecision()` calls append multiple lines to same file

### Task 5: Write decision log schema tests (AC: 2, 5)

- [x] Create `packages/client/src/agent/__tests__/decision-log-schema.test.ts` (~10 tests):
  - Each log line is independently parseable as JSON
  - Required fields are present: timestamp, observation, semanticEvents, skillTriggered, action, cost, result, outcome, agentConfig, metrics
  - timestamp is ISO 8601 format
  - result is one of 'success', 'failure', 'skipped'
  - agentConfig.activeSkills is string array
  - metrics.decisionLatencyMs is non-negative number
  - Optional fields (error, worldState, metrics.actionLatencyMs) omitted when not applicable
  - Entry with error includes code, boundary, message
  - Entry with worldState includes Record<string, unknown>
  - Multiple sequential entries form valid JSONL (each line valid JSON)

### Task 6: Write log rotation tests (AC: 3)

- [x] Create `packages/client/src/agent/__tests__/decision-log-rotation.test.ts` (~8 tests):
  - File under 100MB -> no rotation triggered
  - File exceeds 100MB -> rotation triggered before next append
  - Rotated file named with ISO timestamp suffix (e.g., `decisions-2026-03-15T12-00-00-000Z.jsonl`)
  - After rotation, new entries written to original file path (fresh file)
  - Old rotated file preserved (not deleted)
  - Rotation disabled in config -> no rotation even when file exceeds 100MB
  - Custom maxFileSizeBytes config respected
  - File does not exist -> getFileSize() returns 0 (no error)

### Task 7: Write failure logging tests (AC: 4)

- [x] Create `packages/client/src/agent/__tests__/decision-log-failure.test.ts` (~7 tests):
  - Failed action logged with error.code
  - Failed action logged with error.boundary
  - Failed action logged with error.message
  - Failed action includes worldState capture
  - Failed action result is 'failure'
  - Failed action entry is valid JSONL (parseable JSON)
  - BudgetExceededError logged with BUDGET_EXCEEDED code and boundary 'client'

### Task 8: Write eval metrics tests (AC: 6)

- [x] Create `packages/client/src/agent/__tests__/decision-log-metrics.test.ts` (~10 tests):
  - `computeMetrics()` with single success entry -> invocationCount=1, successCount=1, triggerAccuracy=1.0
  - `computeMetrics()` with mixed results -> correct per-skill counts
  - `computeMetrics()` with multiple skills -> separate SkillMetrics per skill
  - `computeMetrics()` derives invocation count per skill
  - `computeMetrics()` derives trigger accuracy per skill (success / total)
  - `computeMetrics()` derives average decision latency per skill
  - `computeMetrics()` derives average action latency (excludes undefined entries)
  - `computeMetrics()` derives total cost per skill
  - `computeMetrics()` with null skillTriggered -> grouped under '(no skill)'
  - `computeMetrics()` with empty entries array -> zeroed-out aggregate metrics
  - `parseJsonlFile()` parses valid JSONL content into entries
  - `parseJsonlFile()` throws on invalid JSON with line number

### Task 9: Export public API and update barrel files (AC: 1-6)

- [x] Update `packages/client/src/agent/index.ts`:
  - Add Story 4.6 section comment
  - Re-export types: `DecisionLogEntry`, `DecisionLoggerConfig`, `DecisionLogResult`, `DecisionContext`
  - Re-export types: `SkillMetrics`, `AggregateMetrics`, `EvalResult`
  - Re-export classes: `DecisionLogger`
  - Re-export factories: `createDecisionLogger`
  - Re-export functions: `computeMetrics`, `parseJsonlFile`
- [x] Update `packages/client/src/index.ts`:
  - Add Story 4.6 export block re-exporting all new types, classes, factories, and functions from `'./agent'`
- [x] Verify build: `pnpm --filter @sigil/client build` -- produces dist/ with all new exports
- [x] Verify regression: `pnpm test` -- all existing tests still pass

### Task 10: OWASP security review (AC: 1-6)

- [x] Verify OWASP Top 10 compliance:
  - **A01: Broken Access Control (LOW):** Decision log files are written to a researcher-configured path. No path traversal validation needed in MVP (researcher controls the config). Future: validate filePath to prevent writing outside designated directories.
  - **A02: Cryptographic Failures (LOW):** No crypto in this story. Pubkeys in semantic events are already truncated by Story 4.5. No private keys, tokens, or credentials should appear in decision logs. Verify that `worldState` capture does not leak sensitive data.
  - **A03: Injection (LOW):** Log entries are JSON-serialized via `JSON.stringify()`, which handles escaping. No `eval()`, `Function()`, or dynamic code execution. File paths are researcher-configured (not user-input from external sources).
  - **A04: Insecure Design (N/A):** Append-only design prevents log tampering. Log rotation preserves history.
  - **A05: Security Misconfiguration (N/A):** No configurable security settings.
  - **A06: Vulnerable Components (N/A):** No new npm dependencies. Uses only `node:fs/promises` standard library.
  - **A09: Security Logging (MEDIUM):** Decision logs ARE the security audit trail for agent behavior. Ensure all decision cycles are logged (no silent skipping). Ensure error details include enough context for forensic analysis.

### Task 11: Validate against checklist (AC: 1-6)

- [x] Run validation against `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- [x] Verify all ACs have test coverage
- [x] Verify all tasks map to at least one AC
- [x] Verify DOD checklist passes

## Dev Notes

### Architecture Context

This is the **sixth story in Epic 4** -- it implements the **DecisionLogger**, the structured logging layer of the agent pipeline. The DecisionLogger captures the full decision cycle (perceive -> interpret -> decide -> act) as JSONL log entries for research analysis, benchmarking, and reproducibility.

**Position in the agent core loop (from architecture doc `6-agent-core-loop.md`):**

```
1. PERCEIVE -- collect raw updates (SubscriptionManager events)
2. INTERPRET -- raw data -> semantic events (Story 4.5 - EventInterpreter)
3. REMEMBER -- store important events (Phase 2, Epic 9)
4. DETECT -- available actions (Phase 2, Epic 9)
5. DECIDE -- choose action (this story LOGS the decision)
6. ACT -- execute via client.publish()
7. LOG -- record everything (THIS STORY - DecisionLogger)
```

**Key design principle:** The DecisionLogger is a standalone module. It does NOT participate in the decision-making process. It receives a complete `DecisionContext` after each decision cycle and appends a structured JSONL entry. This keeps the logger testable (pure input -> file output) and composable (any agent runtime can use it).

The agent core loop (step 7) calls `logger.logDecision(context)` after each cycle. The `DecisionContext` is assembled by the agent runtime from:
- `observation` -- summary of game state (assembled by runtime)
- `semanticEvents` -- from `EventInterpreter.interpret()` (Story 4.5)
- `skillTriggered` -- the skill chosen by the LLM/decision engine
- `action` -- `{ reducer, args }` payload sent to `client.publish()`
- `cost` -- from `ActionCostRegistry.getCost()` (Story 2.2)
- `result` -- success/failure/skipped
- `outcome` -- human-readable outcome description
- `error` -- error details on failure (from BLS response codes, budget errors, etc.)
- `worldState` -- snapshot on failure
- `agentConfig` -- { agentMdVersion, activeSkills } for reproducibility
- `decisionLatencyMs` / `actionLatencyMs` -- timing metrics

### Data Flow

```
Agent Runtime (future Epic 6/7/9)
  -> assembles DecisionContext from:
     - EventInterpreter output (Story 4.5: SemanticNarrative[])
     - Skill selection result (Story 4.1/4.2)
     - client.publish() result
     - ActionCostRegistry.getCost() (Story 2.2)
     - BudgetTracker.getMetrics() (Story 4.4)
  -> calls DecisionLogger.logDecision(context)
    -> builds DecisionLogEntry (adds timestamp, structures metrics)
    -> checks file size (rotates if > 100MB)
    -> JSON.stringify(entry) + '\n'
    -> fs.appendFile(filePath, line)
      -> JSONL file on disk
        -> consumed by:
           - Researcher analysis (offline JSONL parsing)
           - Agent Observation Mode (Story 8.2)
           - Comparative Decision Log Analysis (Story 11.4)
           - computeMetrics() utility (this story)
```

### DecisionLogEntry Schema (from test design Section 4.5)

**Note on file naming:** The test design document (Section 4.5) references `decision-log-schema.ts` as the file location. This story uses `decision-log-types.ts` instead, following the established Epic 4 convention where all type-definition files use the `*-types.ts` suffix (e.g., `budget-types.ts`, `agent-config-types.ts`, `config-validation-types.ts`, `event-interpreter-types.ts`). The `*-types.ts` naming is correct.

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

This schema is defined in the test design document (`_bmad-output/planning-artifacts/test-design-epic-4.md` Section 4.5) and MUST be implemented exactly as specified. It is the contract consumed by downstream tooling (Story 8.2, Story 11.4).

**Timestamp type note:** `DecisionLogEntry.timestamp` is a `string` (ISO 8601 format, e.g., `"2026-03-15T12:00:00.000Z"`), while `SemanticNarrative.timestamp` (from Story 4.5) is a `number` (epoch ms from `Date.now()`). These are intentionally different types -- the decision log uses human-readable ISO strings for JSONL readability, while semantic events use numeric timestamps for efficient correlation window comparisons. Do NOT convert `SemanticNarrative` timestamps when including them in `semanticEvents` -- they serialize correctly via `JSON.stringify()`.

### File I/O Pattern

The DecisionLogger uses `node:fs/promises` for all file operations:

```typescript
import { appendFile, stat, rename } from 'node:fs/promises';

// Append entry
await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8');

// Check file size
const { size } = await stat(filePath);

// Rotate log
await rename(filePath, rotatedPath);
```

**Write serialization:** Multiple concurrent `logDecision()` calls are serialized via promise chaining (a `_writeQueue` promise). Each call chains onto the previous write, ensuring append ordering matches call ordering. This is critical because `fs.appendFile()` is not atomic for concurrent calls -- Node.js may interleave writes from the same process.

**ENOENT handling:** `getFileSize()` catches `ENOENT` (file not found) and returns `0`. This allows the logger to start writing to a new file without requiring the file to exist beforehand.

### Log Rotation (AC3, NFR16)

When the log file exceeds `maxFileSizeBytes` (default 100MB):

1. `rotateLog()` generates a timestamp-based rotated filename: `decisions-2026-03-15T12-00-00-000Z.jsonl`
2. Current file is renamed to the rotated name via `fs.rename()`
3. Subsequent writes go to the original `filePath` (creates a fresh file)
4. Old rotated file is preserved (never deleted)

The timestamp in the rotated filename uses ISO 8601 with colons replaced by hyphens (filesystem-safe): `new Date().toISOString().replace(/:/g, '-')`.

**Size check timing:** File size is checked before each write. If the file exceeds the threshold, rotation happens before the new entry is appended. This means the rotated file may be slightly larger than `maxFileSizeBytes` (by one entry) if the last write before the check was large. This is acceptable -- the 100MB threshold is a guideline, not a hard limit.

### Eval-Compatible Metrics (AC6)

The `computeMetrics()` utility function processes an array of `DecisionLogEntry` objects and produces `AggregateMetrics`:

```typescript
const content = await readFile('decisions.jsonl', 'utf-8');
const entries = parseJsonlFile(content);
const metrics = computeMetrics(entries);

// Per-skill analysis
for (const [name, skill] of metrics.perSkill) {
  console.log(`${name}: ${skill.invocationCount} invocations, ${skill.triggerAccuracy * 100}% accuracy`);
}
```

Key metric definitions:
- **invocationCount:** Number of log entries where `skillTriggered.name === skillName`
- **triggerAccuracy:** `successCount / invocationCount` (0-1 range, NaN if invocationCount=0, normalized to 0)
- **avgDecisionLatencyMs:** Average of `metrics.decisionLatencyMs` across entries for this skill
- **avgActionLatencyMs:** Average of `metrics.actionLatencyMs` (excludes entries where `actionLatencyMs` is undefined)
- **totalCost:** Sum of `cost` values (null costs treated as 0)

### Relationship to Existing Modules

| Module | Relationship | Direction |
| --- | --- | --- |
| `EventInterpreter` (Story 4.5) | Provides `SemanticNarrative[]` for the `semanticEvents` field | Input to logger |
| `ActionCostRegistry` (Story 2.2) | Provides action costs for the `cost` field | Input to logger |
| `BudgetTracker` (Story 4.4) | Budget rejections logged as failures with `BUDGET_EXCEEDED` error | Input to logger |
| `SkillRegistry` (Story 4.1) | Skill names and descriptions in `skillTriggered` field | Input to logger |
| `AgentConfig` (Story 4.2) | Agent config snapshot in `agentConfig` field | Input to logger |
| `SigilClient` (Story 1.4) | `client.publish()` results feed `action`, `result`, `outcome` | Input to logger |

### Project Structure Notes

All new code goes in `packages/client/src/agent/` (extending Stories 4.1-4.5):

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
  decision-log-types.ts             # NEW: DecisionLogEntry, DecisionLoggerConfig, DecisionContext, etc.
  decision-logger.ts                # NEW: DecisionLogger class, createDecisionLogger factory
  decision-log-metrics.ts           # NEW: computeMetrics, parseJsonlFile, SkillMetrics, AggregateMetrics
  index.ts                          # Updated: re-exports for new modules
  __tests__/
    decision-logger.test.ts         # NEW: ~15 tests
    decision-log-schema.test.ts     # NEW: ~10 tests
    decision-log-rotation.test.ts   # NEW: ~8 tests
    decision-log-failure.test.ts    # NEW: ~7 tests
    decision-log-metrics.test.ts    # NEW: ~10 tests
```

### Error Patterns

The DecisionLogger follows a defensive logging pattern -- logging itself MUST NOT throw errors that crash the agent. All file I/O errors are caught and handled:

- `appendFile()` failure: Catch and silently swallow (do NOT rethrow, do NOT emit events -- the logger is NOT an EventEmitter). The agent must continue running even if logging fails. Optionally log a warning to `console.warn()` for developer debugging.
- `stat()` failure (ENOENT): Return 0 file size (new file will be created on next append).
- `rename()` failure during rotation: Catch and log a warning. Continue writing to the current file.

The only validation error is in the constructor: `DecisionLoggerConfig.filePath` must be a non-empty string. Throws `Error('DecisionLogger filePath cannot be empty')`.

### Previous Story Intelligence (from Story 4.5)

Key patterns and decisions from Story 4.5 that MUST be followed:

1. **File naming:** kebab-case (e.g., `decision-logger.ts`, not `decisionLogger.ts`)
2. **Import extensions:** `.js` suffix for all local imports (ESM compatibility with tsup)
3. **No `any` types:** Use `unknown` or specific types (project convention since Epic 1)
4. **Barrel exports:** `index.ts` per module for public API surface
5. **Co-located tests:** `__tests__/` directory adjacent to source, vitest framework
6. **vitest globals:true:** Tests use vitest globals (`describe`, `it`, `expect` without import)
7. **Commit format:** `feat(4-6): ...` for implementation
8. **JSDoc module comments:** Each source file must have a JSDoc `@module` comment header
9. **No Docker required:** All tests are unit tests with mocked file I/O
10. **EventEmitter pattern:** NOT used in this story. The DecisionLogger does NOT extend EventEmitter. It is a simple append-only writer. (If error notification is needed later, it can be added, but MVP just catches and swallows errors.)

### Security Considerations (OWASP Top 10)

**A01: Broken Access Control (LOW)**
- Decision log file path is researcher-configured. No path traversal validation in MVP (researcher controls config). The filePath is not derived from untrusted input.

**A02: Cryptographic Failures (LOW)**
- No crypto in this story. Pubkeys in semantic events are already truncated by Story 4.5 EventInterpreter. No private keys, tokens, or credentials should appear in log entries. The `worldState` field captures game state (table data) which does not contain secrets.

**A03: Injection (LOW)**
- All log data is serialized via `JSON.stringify()` which handles escaping. No `eval()`, `Function()`, template literals with untrusted data, or string-based code execution. File paths are researcher-controlled.

**A04: Insecure Design (N/A)**
- Append-only JSONL design prevents log tampering (new entries never modify existing ones). Log rotation preserves history (old files are renamed, not deleted).

**A05: Security Misconfiguration (N/A)**
- No configurable security settings. Default behavior (append-only, rotation at 100MB) is safe.

**A06: Vulnerable Components (N/A)**
- No new npm dependencies. Uses only `node:fs/promises` from Node.js standard library.

**A09: Security Logging (MEDIUM)**
- Decision logs ARE the security/audit trail for agent behavior. Every decision cycle must be logged (no silent skipping). Error entries must include enough context for forensic analysis (error code, boundary, message, world state). The log format is designed for immutable append-only storage.

### FR/NFR Traceability

| Requirement | Coverage | Notes |
| --- | --- | --- |
| FR39 (Structured decision logs - JSONL) | AC1, AC4, AC5, AC6 | Full decision cycle: entry structure, failure logging, reproducibility, eval metrics |
| NFR16 (Log rotation at 100MB) | AC3 | Automatic rotation when file exceeds 100MB |
| NFR25 (Append-only, stateless config) | AC2 | JSONL append-only format, config re-read on restart |

### Test Design Reference

The comprehensive test design is documented in:
`_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.6

Target: ~50 tests (all unit, no integration). No Docker required.

**Test file mapping to test design document (Section 2.6):**
- `decision-logger.test.ts` (15) -- maps to "decision-logger.test.ts" (15): Log entry creation, JSONL format, append-only semantics, field completeness
- `decision-log-schema.test.ts` (10) -- maps to "decision-log-schema.test.ts" (10): Schema validation, each line valid JSON, required fields, optional fields
- `decision-log-rotation.test.ts` (8) -- maps to "decision-log-rotation.test.ts" (8): File size check, rotation trigger at 100MB, archival naming, post-rotation append
- `decision-log-failure.test.ts` (7) -- maps to "decision-log-failure.test.ts" (7): Error logging with code/boundary/message, world state capture
- `decision-log-metrics.test.ts` (10) -- maps to "decision-log-metrics.test.ts" (10): Per-skill metrics derivation (invocation count, trigger accuracy, latency, cost, eval compat)

### Mocking Strategy

All file I/O is mocked using vitest mocks:

```typescript
// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
  rename: vi.fn().mockResolvedValue(undefined),
}));
```

For rotation tests, mock `stat` to return sizes above the threshold:

```typescript
vi.mocked(stat).mockResolvedValue({ size: 105 * 1024 * 1024 } as any);
```

This approach:
- Avoids writing to the real filesystem
- Enables testing rotation logic without creating 100MB files
- Allows verifying exact `appendFile` calls (path, content, encoding)
- Allows verifying `rename` calls for rotation

### Git Intelligence

Recent commit pattern: `feat(X-Y): story complete` where X is epic number, Y is story number.
For this story: `feat(4-6): story complete`

Epic 4 branch: `epic-4` (current branch).

Most recent commits:
- `e3a7ff0 feat(4-5): story complete`
- `c769ea5 feat(4-4): story complete`
- `731cb5f feat(4-3): story complete`
- `8d460cb feat(4-2): story complete`
- `a82e0e3 feat(4-1): story complete`
- `de7cc35 chore(epic-4): epic start -- baseline green, retro actions resolved`

### References

- Epic 4 definition: `_bmad-output/planning-artifacts/epics.md` (Story 4.6 details, lines 1033-1066)
- Story 4.5 (predecessor): `_bmad-output/implementation-artifacts/4-5-event-interpretation-as-semantic-narratives.md`
- Story 4.7 (successor, blocked by this): Config versions logged alongside decision logs for reproducibility
- Test design: `_bmad-output/planning-artifacts/test-design-epic-4.md` (Section 2.6, Section 4.5 schema)
- Architecture Agent Core Loop: `_bmad-output/planning-artifacts/architecture/6-agent-core-loop.md` (step 7: LOG)
- Architecture Experiment Harness: `_bmad-output/planning-artifacts/architecture/9-experiment-harness.md` (decision log consumption)
- Action cost registry: `packages/client/src/publish/action-cost-registry.ts` (ActionCostRegistry.getCost())
- Budget tracker: `packages/client/src/agent/budget-tracker.ts` (BudgetTracker, BudgetExceededError)
- Event interpreter: `packages/client/src/agent/event-interpreter.ts` (EventInterpreter, SemanticNarrative)
- Event interpreter types: `packages/client/src/agent/event-interpreter-types.ts` (SemanticNarrative interface)
- Agent config types: `packages/client/src/agent/agent-config-types.ts` (AgentConfig, ResolvedAgentConfig)
- Agent module barrel: `packages/client/src/agent/index.ts`
- Client package index: `packages/client/src/index.ts`
- Project context: `_bmad-output/project-context.md`
- PRD requirements: FR39, NFR16, NFR25

### Verification Steps

1. `pnpm --filter @sigil/client build` -- produces dist/ with all new decision logger exports
2. `pnpm --filter @sigil/client test:unit` -- all new unit tests pass (~50 new + existing)
3. `pnpm test` -- all existing tests still pass (regression check)
4. `DecisionLogger.logDecision()` produces valid JSONL entries with all required fields
5. Entries are appended to configured file path (verified via mock appendFile calls)
6. Log rotation triggered when file exceeds 100MB (verified via mock stat + rename)
7. Failed actions logged with error code, boundary, message, and world state
8. `computeMetrics()` correctly derives per-skill metrics from log entries
9. Build: `pnpm --filter @sigil/client build` produces ESM + CJS + DTS

## Implementation Constraints

1. No new npm dependencies -- uses only `node:fs/promises` from Node.js standard library
2. No `any` types -- use `unknown` or specific types (project convention)
3. All new files follow kebab-case naming convention
4. All new tests use vitest framework (co-located `__tests__/` directory)
5. Import extensions: use `.js` suffix for all local imports (ESM compatibility)
6. Barrel exports: update `src/agent/index.ts` + `src/index.ts` for public API
7. JSONL format: one JSON object per line, each line independently parseable
8. Append-only: log entries are never modified after writing
9. Log rotation: file renamed (not deleted) when exceeding 100MB threshold
10. No Docker required for any tests (file I/O is mocked)
11. No modification to `client.ts` -- decision logger is a standalone module
12. No modification to `event-interpreter.ts` -- logger consumes its output, does not integrate
13. JSDoc `@module` comment header on each new source file
14. No EventEmitter -- logger is a simple file writer (catch-and-swallow errors)
15. Write serialization: concurrent calls are chained via promise queue to prevent interleaving
16. Pubkeys must remain truncated (from Story 4.5) -- do NOT expose full pubkeys in logs
17. `worldState` must NOT contain private keys, tokens, or credentials (OWASP A02)

## CRITICAL Anti-Patterns (MUST AVOID)

- Do NOT buffer or batch log entries -- each `logDecision()` call writes immediately (append-only semantics require immediate persistence for crash safety)
- Do NOT throw errors from `logDecision()` -- catch file I/O errors and handle gracefully (the agent must not crash because logging failed)
- Do NOT use synchronous file I/O (`fs.writeFileSync`, `fs.appendFileSync`) -- always use async `node:fs/promises`
- Do NOT delete rotated log files -- rotation renames the current file, old files are preserved
- Do NOT modify existing log entries -- JSONL is append-only, entries are immutable after writing
- Do NOT store private keys, tokens, or credentials in log entries -- verify `worldState` is clean
- Do NOT extend EventEmitter -- the logger is a simple file writer
- Do NOT create a new package -- all code goes in `packages/client/src/agent/`
- Do NOT use `any` type -- use `unknown` for row data and world state, `DecisionLogEntry` for typed fields
- Do NOT add npm dependencies -- use only `node:fs/promises` standard library
- Do NOT modify `client.ts`, `event-interpreter.ts`, or `budget-tracker.ts` -- the logger is composed externally
- Do NOT implement memory or importance scoring -- that is Phase 2 (Epic 9)
- Do NOT implement comparative analysis tooling -- that is Story 11.4
- Do NOT implement agent observation mode -- that is Story 8.2
- Do NOT write to stdout/stderr for logging -- this story writes to JSONL files (the BLS logger pattern from `packages/bitcraft-bls/src/logger.ts` is for server-side structured console logging, NOT for decision logging)
- Do NOT use `JSON.stringify` with replacer or spaces -- single-line compact JSON for JSONL compatibility

## Definition of Done

- [x] `DecisionLogEntry`, `DecisionLoggerConfig`, `DecisionContext`, `DecisionLogResult` types defined
- [x] `SkillMetrics`, `AggregateMetrics`, `EvalResult` types defined
- [x] `DecisionLogger` class with `logDecision()`, `rotateLog()`, `getFileSize()`
- [x] `createDecisionLogger()` factory with config defaults
- [x] `computeMetrics()` derives per-skill metrics from log entries
- [x] `parseJsonlFile()` parses JSONL content into typed entries
- [x] JSONL format: one JSON object per line, each line independently parseable (AC2)
- [x] All required fields present in log entries: timestamp, observation, semanticEvents, skillTriggered, action, cost, result, outcome, agentConfig, metrics (AC1)
- [x] Failed actions include error code, boundary, message, and world state (AC4)
- [x] Log rotation at 100MB threshold (AC3, NFR16)
- [x] Entries contain enough context for decision reproduction (AC5)
- [x] Per-skill metrics derivable: invocation count, trigger accuracy, latency, cost (AC6)
- [x] Eval pass/fail tracking compatible schema (AC6)
- [x] Unit tests pass: `pnpm --filter @sigil/client test:unit` (~50 Story 4.6 unit tests + existing)
- [x] Build passes: `pnpm --filter @sigil/client build` (ESM + CJS + DTS)
- [x] Full regression: `pnpm test` -- all existing tests still pass
- [x] No `any` types in new code
- [x] No Docker required for any tests
- [x] Security: OWASP Top 10 review completed (A01, A02, A03, A04, A05, A06, A09)
- [x] No private keys, tokens, or credentials in decision log entries

## Change Log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-03-15 | Initial story creation | Epic 4 Story 4.6 spec |
| 2026-03-15 | Adversarial review: 8 issues fixed | Fixed error handling contradiction (appendFile failure: "emit error event" -> "silently swallow" to match no-EventEmitter constraint), added _writeQueue initialization detail (Promise.resolve()), added explicit try-catch in logDecision() spec, clarified evalResults is always empty array from computeMetrics() (populated by external eval tooling), added triggerAccuracy NaN-to-0 normalization note in SkillMetrics type, documented file naming discrepancy with test design (decision-log-schema.ts -> decision-log-types.ts following *-types.ts convention), added timestamp type clarification (string ISO 8601 vs SemanticNarrative number), added BMAD validation status comment block |
| 2026-03-15 | Implementation complete | All 11 tasks implemented: 3 source files created, 5 test files (pre-existing, 68 tests all pass), barrel exports updated, build verified, regression tests pass (1049 client + 222 BLS + 2 placeholder = 1273 total passing) |
| 2026-03-15 | Test review: 4 issues fixed | Fixed inaccurate test count header in decision-log-metrics.test.ts (16->18), added missing assertion for actionLatencyMs omission in decision-log-schema.test.ts, added 2 new tests in decision-log-rotation.test.ts (stat non-ENOENT error handling, rename failure during rotation), corrected test counts in story completion notes (56->70) |
| 2026-03-15 | Code review: 2 issues fixed | Added defensive .catch() to logDecision() await to guarantee no-throw contract (med), removed unused SkillMetrics import from decision-log-metrics.test.ts (low) |

## Code Review Record

| Review Pass | Date | Reviewer | Issues Found | Issues Fixed | Notes |
| --- | --- | --- | --- | --- | --- |
| Adversarial Review | 2026-03-15 | Claude Opus 4.6 | 8 (0 crit, 0 high, 3 med, 5 low) | 8 | Error handling pattern contradiction, _writeQueue init, logDecision try-catch, evalResults clarification, triggerAccuracy NaN normalization, file naming discrepancy documentation, timestamp type clarification, BMAD validation block |
| Test Architecture Review | 2026-03-15 | Claude Opus 4.6 | 4 (0 crit, 0 high, 2 med, 2 low) | 4 | Inaccurate test count header (low), incomplete optional field assertion (med), missing rotation error handling tests (med), inaccurate story completion test counts (low) |
| Code Review (bmm-code-review) | 2026-03-15 | Claude Opus 4.6 | 2 (0 crit, 0 high, 1 med, 1 low) | 2 | logDecision() await lacked defensive .catch() violating no-throw contract (med), unused SkillMetrics type import in test file (low). Full regression green: 1051 client + 222 BLS tests pass, build ESM+CJS+DTS verified. |
| Code Review Pass 2 (bmm-code-review) | 2026-03-15 | Claude Opus 4.6 | 3 (0 crit, 0 high, 0 med, 3 low) | 0 | All 3 low-severity issues accepted as-is: (1) `as any` casts in test files for stat mock return values -- standard vitest pattern, (2) `delete (context as any).actionLatencyMs` in test -- test-only pattern, (3) rotateLog() silently does nothing if filePath doesn't end in .jsonl -- documented behavior. No files changed. |
| Code Review Pass 3 (bmm-code-review) | 2026-03-15 | Claude Opus 4.6 | 0 (0 crit, 0 high, 0 med, 0 low) | 0 | Clean pass with full OWASP security review. No issues found. No files changed. |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug issues encountered. All 68 tests passed on first run. Post-review: 70 tests (2 added by test review).

### Completion Notes List

- **Task 1 (decision-log-types.ts):** Created all type definitions: `DecisionLogEntry`, `DecisionLoggerConfig`, `DecisionLogResult`, `DecisionContext`, `SkillMetrics`, `AggregateMetrics`, `EvalResult`. All fields match the schema spec from test design Section 4.5. Timestamp is ISO 8601 string (not number). SemanticNarrative imported from event-interpreter-types.js.
- **Task 2 (decision-logger.ts):** Implemented `DecisionLogger` class with `logDecision()`, `rotateLog()`, `getFileSize()`, and `_writeQueue` promise chain. Constructor validates non-empty filePath. File I/O errors caught and silently swallowed. `createDecisionLogger()` factory applies defaults (100MB max, rotation enabled). Rotation generates filesystem-safe ISO timestamp suffix (colons and dots replaced with hyphens).
- **Task 3 (decision-log-metrics.ts):** Implemented `computeMetrics()` with per-skill accumulator pattern: invocation count, success/failure/skipped counts, trigger accuracy (NaN-safe), total cost (null treated as 0), avg decision/action latency (excludes undefined). `parseJsonlFile()` throws with line number on parse error. `evalResults` always empty array (populated by Story 11.4).
- **Tasks 4-8 (test files):** All 5 test files were pre-existing and well-written. 68 tests total: 21 (logger) + 14 (schema) + 8 (rotation) + 7 (failure) + 18 (metrics). All pass on first run. Post-review: 70 tests (added 2 rotation edge case tests, fixed 1 incomplete assertion).
- **Task 9 (barrel exports):** Updated `packages/client/src/agent/index.ts` with Story 4.6 section: re-exports all 7 types, `DecisionLogger` class, `createDecisionLogger` factory, `computeMetrics`, `parseJsonlFile`. Updated `packages/client/src/index.ts` with corresponding re-export block from `'./agent'`.
- **Task 10 (OWASP review):** Verified: no new npm dependencies (only `node:fs/promises`), no `any` types, no private keys/credentials in log entries, JSON.stringify handles escaping (A03), append-only design prevents tampering (A04), error entries include code/boundary/message for forensic analysis (A09).
- **Task 11 (validation):** Build passes (`pnpm --filter @sigil/client build` produces ESM + CJS + DTS), 1037 client tests pass, 1261 total workspace tests pass (full regression green).

### File List

| Action | File Path |
| --- | --- |
| Created | `packages/client/src/agent/decision-log-types.ts` |
| Created | `packages/client/src/agent/decision-logger.ts` |
| Created | `packages/client/src/agent/decision-log-metrics.ts` |
| Modified | `packages/client/src/agent/index.ts` |
| Modified | `packages/client/src/index.ts` |
| Pre-existing | `packages/client/src/agent/__tests__/decision-logger.test.ts` |
| Pre-existing | `packages/client/src/agent/__tests__/decision-log-schema.test.ts` |
| Pre-existing | `packages/client/src/agent/__tests__/decision-log-rotation.test.ts` |
| Pre-existing | `packages/client/src/agent/__tests__/decision-log-failure.test.ts` |
| Pre-existing | `packages/client/src/agent/__tests__/decision-log-metrics.test.ts` |
