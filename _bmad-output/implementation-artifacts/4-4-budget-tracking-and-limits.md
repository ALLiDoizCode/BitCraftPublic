# Story 4.4: Budget Tracking & Limits

Status: done

<!--
Validation Status: VALIDATED
Review Type: Adversarial Review via /bmad-review-adversarial-general (2026-03-14)
Reviewer: Claude Opus 4.6
BMAD Standards Compliance: VERIFIED (2026-03-14)
- Story structure: Complete (all required sections present, including Change Log and Code Review Record templates)
- Acceptance criteria: 5 ACs with Given/When/Then format, FR/NFR traceability
- Task breakdown: 9 tasks with detailed subtasks, AC mapping on each task
- NFR traceability: 0 NFRs directly mapped to ACs (NFR16 referenced but N/A for this story)
- FR traceability: 2 FRs mapped to ACs (FR15 -> AC1-AC5, FR39 -> AC4/AC5 partial)
- Dependencies: Documented (3 epics + 2 stories required complete, 0 external, 2 stories blocked)
- Technical design: Comprehensive with architecture decisions, concurrency model, EventEmitter integration
- Security review: OWASP Top 10 coverage complete (A01-A06, A09)
Issues Found & Fixed: 8 (see review notes below)
Ready for Implementation: YES
-->

## Story

As a researcher,
I want to set budget limits per agent and have the system enforce them at the client level,
So that my agents don't overspend during experiments.

## Dependencies

**Required Complete (all done):**

- **Epic 1** (Project Foundation) -- monorepo structure, SpacetimeDB connection
- **Epic 2** (Action Execution & Payment Pipeline) -- `client.publish()` pipeline, action cost registry (Story 2.2), wallet client (Story 2.2)
- **Epic 3** (BitCraft BLS Game Action Handler) -- BLS handler consuming `{ reducer, args }` payloads (Story 3.2), fee schedule (Story 3.3)
- **Story 4.1** (Skill File Format & Parser) -- `parseSkillFile()`, `Skill` types
- **Story 4.2** (Agent.md Configuration & Skill Selection) -- `loadAgentConfig()`, `ResolvedAgentConfig`, `AgentBudgetConfig` (budget config type with `limit`, `unit`, `period`, `raw` fields)

**External Dependencies:**

- None. This is pure client-side logic with no external service dependencies.
- Action cost lookups use the existing `ActionCostRegistry` (Story 2.2) which is already loaded in the client.
- No new npm dependencies required.
- No Docker required for any tests.

**Blocks:**

- Story 4.6 (Structured Decision Logging) -- decision log entries should capture budget rejection events
- Story 4.7 (Swappable Agent Configuration) -- config reload must reset or re-initialize the budget tracker

## Acceptance Criteria

1. **Budget initialization from Agent.md (AC1)** (FR15)
   - **Given** an Agent.md with a budget limit specified (e.g., `## Budget: 0.05 USD/hour`)
   - **When** the agent is initialized
   - **Then** the budget tracker is configured with the specified limit
   - **And** the current spend is initialized to zero

2. **Pre-publish budget enforcement (AC2)** (FR15)
   - **Given** an active agent with a budget limit
   - **When** `client.publish()` is called for a game action
   - **Then** the action cost is looked up from the action cost registry (populated by `@crosstown/client`)
   - **And** the cost is checked against the remaining budget before the event is published
   - **And** if the action would exceed the budget, it is rejected with a `BUDGET_EXCEEDED` error before any Crosstown interaction occurs

3. **Threshold warning events (AC3)** (FR15)
   - **Given** an agent executing actions over time
   - **When** the cumulative spend approaches the budget limit
   - **Then** a warning event is emitted at configurable thresholds (e.g., 80%, 90%)

4. **Budget exhaustion enforcement (AC4)** (FR15)
   - **Given** an agent that has reached its budget limit
   - **When** any further `client.publish()` is attempted
   - **Then** all actions are rejected until the budget is reset or increased
   - **And** a `budgetExhausted` event is emitted for consumption by the decision logger (Story 4.6)

5. **Budget metrics (AC5)** (FR15, FR39 partial)
   - **Given** budget tracking across actions
   - **When** the agent session is reviewed
   - **Then** total spend, per-action costs, and budget utilization are available as queryable metrics

## Tasks / Subtasks

### Task 1: Define budget tracker types (AC: 1, 3, 5)

- [x] Create `packages/client/src/agent/budget-types.ts`:
  - Export `BudgetTrackerConfig` interface:
    - `limit: number` -- total budget limit in the configured unit
    - `unit: string` -- currency unit (e.g., 'ILP', 'USD')
    - `period: string` -- time period (e.g., 'session', 'hour')
    - `warningThresholds: number[]` -- utilization percentages to emit warnings (default: `[0.8, 0.9]`)
  - Export `BudgetStatus` type: `'active' | 'warning' | 'exhausted'`
  - Export `BudgetMetrics` interface:
    - `totalLimit: number` -- configured budget limit
    - `totalSpend: number` -- cumulative spend so far
    - `remaining: number` -- `totalLimit - totalSpend`
    - `utilizationPercent: number` -- `(totalSpend / totalLimit) * 100`
    - `status: BudgetStatus` -- current budget state
    - `actionCount: number` -- total number of actions tracked
    - `perActionCosts: Record<string, { totalCost: number; count: number }>` -- per-reducer breakdown
    - `warningThresholds: number[]` -- configured warning thresholds
    - `thresholdsTriggered: number[]` -- which thresholds have fired
    - `unit: string` -- currency unit
    - `period: string` -- time period
  - Export `BudgetWarningEvent` interface:
    - `threshold: number` -- threshold that was crossed (e.g., 0.8)
    - `utilizationPercent: number` -- current utilization
    - `totalSpend: number` -- cumulative spend
    - `remaining: number` -- remaining budget
    - `limit: number` -- total limit
  - Export `BudgetExceededError` class extending `Error`:
    - Constructor: `(message: string, reducer: string, actionCost: number, remaining: number, limit: number)`
    - Sets `this.name = 'BudgetExceededError'` (follows `AgentConfigError`, `SkillParseError` pattern)
    - `readonly code: 'BUDGET_EXCEEDED'`
    - `readonly reducer: string`
    - `readonly actionCost: number`
    - `readonly remaining: number`
    - `readonly limit: number`

### Task 2: Create budget tracker core (AC: 1, 2, 3, 4, 5)

- [x] Create `packages/client/src/agent/budget-tracker.ts`:
  - Export `BudgetTracker` class extending `EventEmitter`:
    - Constructor: `(config: BudgetTrackerConfig)`
    - Stores `config`, initializes `totalSpend = 0`, `actionCount = 0`, empty `perActionCosts` map, empty `thresholdsTriggered` set
    - `private checkBudget(reducer: string, cost: number): void` -- throws `BudgetExceededError` if `totalSpend + cost > limit`. Private to prevent callers from using check-then-record separately (anti-pattern).
    - `private recordSpend(reducer: string, cost: number): void` -- increments `totalSpend`, updates `perActionCosts[reducer]`, increments `actionCount`, checks and emits threshold warnings. Private to prevent callers from recording without checking.
    - `checkAndRecord(reducer: string, cost: number): void` -- the ONLY public mutation method. Combines check + record in a single synchronous call to prevent race conditions (R4-003). Throws `BudgetExceededError` if would exceed, otherwise records.
    - `getMetrics(): BudgetMetrics` -- returns current budget metrics snapshot
    - `getStatus(): BudgetStatus` -- returns `'exhausted'` if `totalSpend >= limit`, `'warning'` if any threshold triggered, `'active'` otherwise
    - `reset(): void` -- resets `totalSpend`, `actionCount`, `perActionCosts`, and `thresholdsTriggered` to initial state
    - `adjustLimit(newLimit: number): void` -- updates budget limit (for runtime budget increase). Validates `newLimit` is non-negative and finite (same rules as constructor).
    - `get remaining(): number` -- returns `Math.max(0, limit - totalSpend)`
    - Events emitted:
      - `'budgetWarning'` with `BudgetWarningEvent` payload -- when a threshold is crossed for the first time
      - `'budgetExhausted'` with `BudgetMetrics` payload -- when budget reaches zero remaining
  - **Concurrency model (R4-003 mitigation):**
    - Node.js is single-threaded. All budget checks are synchronous.
    - `checkAndRecord()` performs check-and-decrement in a single synchronous call.
    - No async gaps between check and decrement where concurrent calls could interleave.
    - The `publishAction()` method in `client.ts` must call `checkAndRecord()` BEFORE any `await` (before wallet balance check, before CrosstownAdapter interaction).
    - This ensures that even if multiple `client.publish()` calls are issued in rapid succession, the budget check is atomic within the Node.js event loop tick.
  - Export `createBudgetTrackerFromConfig(budgetConfig: AgentBudgetConfig): BudgetTracker` -- factory function that converts `AgentBudgetConfig` (from Story 4.2) to `BudgetTrackerConfig` and creates a `BudgetTracker`
    - Maps `budgetConfig.limit` -> `config.limit`
    - Maps `budgetConfig.unit` -> `config.unit`
    - Maps `budgetConfig.period` -> `config.period`
    - `budgetConfig.raw` is intentionally NOT mapped -- it is for display/debug in Agent.md context, not needed by the tracker
    - Default warning thresholds: `[0.8, 0.9]`

### Task 3: Create budget publish guard (AC: 2, 4)

- [x] Create `packages/client/src/agent/budget-publish-guard.ts`:
  - Export `BudgetPublishGuard` class:
    - Constructor: `(budgetTracker: BudgetTracker, costLookup: (reducer: string) => number)`
    - `guard(reducer: string): void` -- looks up action cost, calls `budgetTracker.checkAndRecord(reducer, cost)`. Throws `BudgetExceededError` if budget would be exceeded.
    - `canAfford(reducer: string): boolean` -- returns `true` if action cost fits within remaining budget (non-mutating check)
  - **Design rationale:** The guard separates the budget enforcement concern from the publish pipeline. The `costLookup` function is a reference to `client.publish.getCost()` (from the action cost registry, Story 2.2). This avoids the budget tracker needing direct access to the client or registry.
  - **Integration point:** The guard's `guard()` method is called at the START of `publishAction()` in `client.ts`, BEFORE any async operations (wallet balance check, CrosstownAdapter interaction). This guarantees budget enforcement before any Crosstown interaction (AC2).

### Task 4: Write budget tracker unit tests (AC: 1-5)

Following the test design in `_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.4.

- [x] Create `packages/client/src/agent/__tests__/budget-tracker.test.ts` (~28 tests):
  - Initialization with `BudgetTrackerConfig` -> `totalSpend = 0`, `remaining = limit`
  - `checkAndRecord()` with cost < remaining -> spend recorded, remaining decremented
  - `checkAndRecord()` with cost > remaining -> throws `BudgetExceededError`
  - `checkAndRecord()` with cost == remaining -> spend recorded, budget exactly exhausted
  - `checkAndRecord()` with cost that exhausts budget -> emits `'budgetExhausted'` event
  - `getMetrics()` returns correct totals after multiple actions
  - `getMetrics().perActionCosts` tracks per-reducer breakdown correctly
  - `getMetrics().utilizationPercent` calculated correctly
  - `getStatus()` returns `'active'` when under all thresholds
  - `getStatus()` returns `'warning'` when threshold exceeded but budget not exhausted
  - `getStatus()` returns `'exhausted'` when `totalSpend >= limit`
  - `reset()` clears all tracked spend and resets to initial state
  - `adjustLimit()` updates the budget limit
  - `remaining` getter returns `Math.max(0, limit - totalSpend)`
  - `createBudgetTrackerFromConfig()` factory creates correct tracker from `AgentBudgetConfig`

- [x] Create `packages/client/src/agent/__tests__/budget-publish-guard.test.ts` (~12 tests):
  - `guard()` with affordable action -> no error, spend recorded
  - `guard()` with unaffordable action -> throws `BudgetExceededError` with correct fields
  - `guard()` error includes: reducer name, action cost, remaining budget, limit
  - `guard()` error `code` field is `'BUDGET_EXCEEDED'`
  - `guard()` called before any async operation (synchronous check)
  - `canAfford()` returns `true` when remaining >= cost
  - `canAfford()` returns `false` when remaining < cost
  - `canAfford()` does NOT record spend (non-mutating)
  - Sequential `guard()` calls decrement budget correctly
  - Budget at exactly zero -> `guard()` throws for any cost > 0
  - Budget at zero with zero-cost action -> `guard()` succeeds (zero-cost actions allowed)
  - Unknown reducer uses default cost from registry -> guard uses whatever costLookup returns

- [x] Create `packages/client/src/agent/__tests__/budget-warnings.test.ts` (~8 tests):
  - Budget at 79% utilization -> no warning event
  - Budget at 80% utilization -> `'budgetWarning'` event emitted with threshold 0.8
  - Budget at 90% utilization -> `'budgetWarning'` event emitted with threshold 0.9
  - Warning emitted only ONCE per threshold (second action crossing same threshold -> no re-emit)
  - Both 80% and 90% thresholds can be triggered in sequence
  - Custom thresholds (e.g., `[0.5, 0.75, 0.95]`) -> events emitted at those percentages
  - `BudgetWarningEvent` payload includes: threshold, utilizationPercent, totalSpend, remaining, limit
  - No warning events when no thresholds configured (empty array)

- [x] Create `packages/client/src/agent/__tests__/budget-concurrency.test.ts` (~5 tests):
  - Two rapid `checkAndRecord()` calls with total > budget -> second throws `BudgetExceededError`
  - Five sequential `checkAndRecord()` calls -> cumulative spend tracked accurately
  - `checkAndRecord()` is synchronous: no async gap between check and record
  - Budget exactly at limit after one action -> next `checkAndRecord()` throws immediately
  - Concurrent `Promise.all` publish attempts (simulated) -> only budget-allowed number succeed

- [x] Create `packages/client/src/agent/__tests__/budget-metrics.test.ts` (~5 tests):
  - `getMetrics()` after zero actions -> totalSpend=0, actionCount=0, empty perActionCosts
  - `getMetrics()` after 3 different reducer actions -> correct per-reducer breakdown
  - `getMetrics()` after 5 actions of same reducer -> count=5, totalCost=sum
  - `getMetrics().utilizationPercent` is 0 after reset, correct after actions
  - `getMetrics()` returns snapshot (not a live reference) -- mutating returned object does not affect tracker

### Task 5: Write integration-style unit tests for publish pipeline (AC: 2, 4)

- [x] Create `packages/client/src/agent/__tests__/budget-integration.test.ts` (~7 tests):
  - Simulates the budget guard integration with a mock publish pipeline:
    - Create `BudgetTracker` with limit=100, create `BudgetPublishGuard` with mock cost lookup
    - Simulate 5 successful actions (cost 10 each) -> totalSpend=50, remaining=50
    - Simulate action that would exceed budget -> `BudgetExceededError` thrown
    - Verify error thrown BEFORE any mock publish function is called (proving pre-Crosstown enforcement)
    - After budget exhaustion, all subsequent `guard()` calls throw `BudgetExceededError`
  - `reset()` after exhaustion -> budget available again, `guard()` succeeds

### Task 6: Export public API and update barrel files (AC: 1-5)

- [x] Update `packages/client/src/agent/index.ts`:
  - Add re-exports for all new types: `BudgetTrackerConfig`, `BudgetStatus`, `BudgetMetrics`, `BudgetWarningEvent`, `BudgetExceededError`
  - Add re-exports for classes: `BudgetTracker`, `BudgetPublishGuard`
  - Add re-exports for factory: `createBudgetTrackerFromConfig`
- [x] Update `packages/client/src/index.ts`:
  - Add exports for all new public types and functions from the agent module
- [x] Verify build: `pnpm --filter @sigil/client build` -- produces dist/ with all new exports
- [x] Verify regression: `pnpm test` -- all existing tests still pass

### Task 7: Document integration pattern for client.ts (AC: 2)

- [x] Document (in Dev Notes, NOT implement) the integration pattern for `client.ts`:
  - The `BudgetPublishGuard.guard()` call should be inserted at the START of `SigilClient.publishAction()`, BEFORE step 2 (wallet balance check) and BEFORE step 3 (CrosstownAdapter interaction)
  - The budget tracker is created when agent config is loaded (future: Story 4.7 or MCP integration)
  - The `SigilClient` does NOT own the `BudgetTracker` -- the agent runtime (MCP server, direct import) creates and wires it
  - **Reason for not modifying client.ts in this story:** The budget tracker is an AGENT-level concern, not a core client concern. The `SigilClient` class serves all consumers (MCP server, TUI backend, direct import). Only agent consumers need budget enforcement. The integration point is documented here; the actual wiring happens when agent runtime is built (Epic 6 for MCP, or direct use in research scripts).

### Task 8: OWASP security review (AC: 1-5)

- [x] Verify OWASP Top 10 compliance:
  - **A01: Broken Access Control (LOW):** Budget tracker is local to agent runtime, no remote access. Adjusting limits is an explicit API call (researcher-controlled).
  - **A02: Cryptographic Failures (N/A):** No crypto in this story.
  - **A03: Injection (LOW):** Reducer names from cost lookup are validated by ActionCostRegistry (Story 2.2). No dynamic code execution. Budget limit values validated as non-negative finite numbers.
  - **A04: Insecure Design (LOW):** All budget checks fail-closed (exceed -> reject). No silent failures.
  - **A05: Security Misconfiguration (LOW):** Default warning thresholds (80%, 90%) are sensible defaults. Missing budget config means unlimited (no enforcement).
  - **A06: Vulnerable Components (N/A):** No new dependencies.
  - **A09: Security Logging (LOW):** Budget warnings and exhaustion events are emitted as events for agent-level logging (Story 4.6 will consume these).

### Task 9: Validate against checklist (AC: 1-5)

- [x] Run validation against `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- [x] Verify all ACs have test coverage
- [x] Verify all tasks map to at least one AC
- [x] Verify DOD checklist passes

## Dev Notes

### Architecture Context

This is the **fourth story in Epic 4** -- it introduces budget enforcement as a client-level guardrail for agent experiments. The budget tracker is a standalone module that works independently of the SpacetimeDB connection (unlike Story 4.3). It integrates with the existing action cost registry (Story 2.2) for cost lookups and the publish pipeline (Story 2.5) for pre-publish enforcement.

**Key design principle:** Budget enforcement is an AGENT-level concern, not a core client concern. The `BudgetTracker` and `BudgetPublishGuard` are independent classes that can be wired into any consumer of `client.publish()`. The `SigilClient` class itself is NOT modified in this story -- the budget guard is composed externally by agent runtime code.

**Data flow:** `AgentBudgetConfig` (from Story 4.2, parsed from Agent.md) -> `createBudgetTrackerFromConfig()` -> `BudgetTracker` -> `BudgetPublishGuard` (wraps cost lookup + tracker) -> guard() called before `client.publish()`

### Concurrency Model (R4-003 Mitigation)

**The critical concurrency concern (R4-003) is mitigated by Node.js's single-threaded execution model:**

1. `BudgetTracker.checkAndRecord()` is a fully **synchronous** method.
2. It performs check-and-decrement in a single call with no async gaps.
3. In Node.js, synchronous code runs to completion within a single event loop tick.
4. Even if multiple `client.publish()` calls are issued concurrently (e.g., via `Promise.all`), each `checkAndRecord()` call completes atomically before the next one starts.
5. The guard is called BEFORE any `await` in the publish pipeline, ensuring no interleaving between check and record.

**This is NOT a database-level transaction concern.** The budget tracker is an in-memory counter that operates within a single Node.js process. There is no distributed state to synchronize.

**Test verification:** `budget-concurrency.test.ts` (5 tests) explicitly verifies that rapid sequential calls and simulated concurrent `Promise.all` scenarios respect budget limits correctly.

### Integration with Action Cost Registry (Story 2.2)

The `BudgetPublishGuard` accepts a `costLookup: (reducer: string) => number` function rather than directly importing the action cost registry. This:

1. **Decouples** the budget module from the registry implementation
2. **Enables testing** with mock cost functions
3. **Supports any cost source** (registry, dynamic pricing, custom logic)

In practice, the cost lookup is `client.publish.getCost()` which reads from the `ActionCostRegistry` loaded in `SigilClient`.

### Budget Units and Period

The `AgentBudgetConfig` (from Story 4.2) parses budget strings like `100 ILP/session` or `0.05 USD/hour`. The budget tracker stores these values but does NOT enforce time-based periods in this story. Reasons:

1. **Session-based tracking** (the common case) is simply "track until reset."
2. **Time-based tracking** (e.g., per-hour budgets) requires a timer and periodic reset, which adds complexity better handled in a future story or the agent runtime.
3. The `period` field is stored in `BudgetMetrics` for reporting and future use.

If a researcher configures `100 ILP/hour`, the tracker enforces the 100 ILP limit. The "per hour" reset must be managed by the agent runtime (e.g., calling `tracker.reset()` on a timer).

### No Modification to client.ts

This story does NOT modify `client.ts`. The budget guard is a standalone module that is composed externally. This design decision follows from:

1. `SigilClient` serves all consumers (MCP server, TUI backend, direct import). Not all consumers need budget enforcement.
2. Budget is an agent-level concern defined in Agent.md. The core client should not be aware of agent configuration.
3. The integration point is well-defined: call `guard()` before `client.publish()`. This can be done by any wrapper, middleware, or agent runtime.

**For MCP server integration (Epic 6):** The MCP server will create a `BudgetTracker` from the agent config and call `guard()` before each tool invocation that triggers `client.publish()`.

**For direct import usage:** Research scripts can create a `BudgetTracker` and wrap their publish calls:
```typescript
const tracker = createBudgetTrackerFromConfig(agentConfig.budget);
const guard = new BudgetPublishGuard(tracker, client.publish.getCost);

// Before each publish:
guard.guard('player_move');  // Throws BudgetExceededError if over budget
await client.publish.publish({ reducer: 'player_move', args: [100, 200] });
```

### New Module Location

All new code goes in `packages/client/src/agent/` (extending Stories 4.1-4.3):

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
  budget-types.ts                   # NEW: BudgetTrackerConfig, BudgetMetrics, BudgetExceededError
  budget-tracker.ts                 # NEW: BudgetTracker, createBudgetTrackerFromConfig
  budget-publish-guard.ts           # NEW: BudgetPublishGuard
  index.ts                          # Updated: re-exports for new modules
  __tests__/
    budget-tracker.test.ts          # NEW: 15 tests
    budget-publish-guard.test.ts    # NEW: 12 tests
    budget-warnings.test.ts         # NEW: 8 tests
    budget-concurrency.test.ts      # NEW: 5 tests
    budget-metrics.test.ts          # NEW: 5 tests
    budget-integration.test.ts      # NEW: 5 tests
```

### Project Structure Notes

- Follows monorepo conventions: kebab-case file names, co-located tests in `__tests__/`, vitest
- New files extend the existing `src/agent/` directory (Stories 4.1-4.3 foundation)
- Barrel `src/agent/index.ts` gets new re-exports for all new types and functions
- Main `src/index.ts` gets new export lines for budget module
- No changes to `packages/bitcraft-bls/` -- this is client-side only
- No changes to Stories 4.1, 4.2, or 4.3 source files (only additions + barrel export updates)
- No Docker required for any tests

### Error Patterns

Follow the same pattern as `SkillParseError` (Story 4.1), `AgentConfigError` (Story 4.2), and `ConfigValidationError` (Story 4.3):
- Error class extends `Error` with typed `code: string` and context fields
- Error codes are string literal types for programmatic handling
- Error messages are actionable: they tell the user what is wrong and how to fix it
- Consistent with `SigilError` (core client), `ContentParseError` (Story 3.2), and `FeeScheduleError` (Story 3.3)

**`BudgetExceededError` specifics:**
- `code` is always `'BUDGET_EXCEEDED'` (string literal, not union type -- there's only one error code for this class)
- Includes `reducer`, `actionCost`, `remaining`, and `limit` fields for debugging
- Example message: `"Budget exceeded for action 'player_move': cost 10 exceeds remaining budget 5 (limit: 100 ILP/session)"`

### EventEmitter Pattern

`BudgetTracker` extends Node.js `EventEmitter` (same pattern as `SigilClient`, `NostrClient`, `ReconnectionManager`). Events:

- `'budgetWarning'` -- emitted when utilization crosses a configured threshold for the first time
- `'budgetExhausted'` -- emitted when budget reaches zero remaining

Consumers (agent runtime, decision logger) subscribe to these events for logging and alerting. This follows the existing event-driven architecture pattern used throughout `@sigil/client`.

### Previous Story Intelligence (from Story 4.3)

Key patterns and decisions from Story 4.3 that MUST be followed:

1. **File naming:** kebab-case (e.g., `budget-tracker.ts`, not `budgetTracker.ts`)
2. **Import extensions:** `.js` suffix for all local imports (ESM compatibility with tsup)
3. **No `any` types:** Use `unknown` or specific types (project convention since Epic 1)
4. **Error classes:** Extend `Error` with typed `code` field (pattern from Stories 3.2, 3.3, 4.1, 4.2, 4.3)
5. **Barrel exports:** `index.ts` per module for public API surface
6. **Co-located tests:** `__tests__/` directory adjacent to source, vitest framework
7. **vitest globals:true:** Tests use vitest globals (`describe`, `it`, `expect` without import)
8. **Commit format:** `feat(4-4): ...` for implementation
9. **JSDoc module comments:** Each source file must have a JSDoc `@module` comment header (established in Stories 4.1, 4.2, 4.3)
10. **Validation on construction:** Validate config values in constructor (non-negative limit, finite number)

### Security Considerations (OWASP Top 10)

**A01: Broken Access Control (LOW relevance)**
- Budget tracker is in-memory, local to the agent runtime
- `adjustLimit()` and `reset()` are explicit API calls (researcher-controlled)
- No remote access to budget state

**A02: Cryptographic Failures (N/A)**
- No crypto in this story

**A03: Injection (LOW relevance)**
- Reducer names from cost lookup are validated by ActionCostRegistry (Story 2.2)
- No dynamic code execution
- Budget limit values must be validated: non-negative, finite numbers
- Reject `NaN`, `Infinity`, `-Infinity`, negative values in constructor

**A04: Insecure Design (LOW relevance)**
- Fail-closed: budget exceeded -> reject. No silent failures.
- All code paths return explicit success or error
- `checkAndRecord()` is atomic (synchronous) preventing bypass via concurrency

**A05: Security Misconfiguration (LOW relevance)**
- Default warning thresholds (80%, 90%) are sensible defaults
- Missing budget config means unlimited (documented behavior, not a vulnerability)

**A06: Vulnerable Components (N/A)**
- No new npm dependencies. Uses only Node.js built-in `EventEmitter`.

**A09: Security Logging (LOW relevance)**
- Budget warnings and exhaustion events emitted for consumption by decision logger (Story 4.6)
- No secrets in budget data

### FR/NFR Traceability

| Requirement | Coverage | Notes |
| --- | --- | --- |
| FR15 (Budget limits per agent) | AC1, AC2, AC3, AC4, AC5 | Full budget lifecycle: initialization, enforcement, warnings, exhaustion, metrics |
| FR39 (Structured decision logging) | AC4 (partial), AC5 (partial) | Budget events will be consumed by Story 4.6 decision logger. Budget metrics feed into decision log entries. |
| NFR16 (Log size management) | N/A direct | Budget metrics are in-memory only; no file I/O in this story |

### Test Design Reference

The comprehensive test design is documented in:
`_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.4

Target: ~65 tests (all unit, no integration). No Docker required.

**Test file mapping to test design document (Section 2.4):**
- `budget-tracker.test.ts` (28) -- maps to "budget-tracker.test.ts" (15 originally, expanded during implementation)
- `budget-publish-guard.test.ts` (12) -- maps to "budget-publish-guard.test.ts" (12)
- `budget-warnings.test.ts` (8) -- maps to "budget-warnings.test.ts" (8)
- `budget-concurrency.test.ts` (5) -- maps to "budget-concurrency.test.ts" (5)
- `budget-metrics.test.ts` (5) -- maps to "budget-metrics.test.ts" (5)
- `budget-integration.test.ts` (7) -- NEW: integration-style unit tests not in original test design, added for publish pipeline enforcement verification

### Git Intelligence

Recent commit pattern: `feat(X-Y): story complete` where X is epic number, Y is story number.
For this story: `feat(4-4): story complete`

Epic 4 branch: `epic-4` (current branch).

Most recent commits:
- `731cb5f feat(4-3): story complete`
- `8d460cb feat(4-2): story complete`
- `a82e0e3 feat(4-1): story complete`
- `de7cc35 chore(epic-4): epic start -- baseline green, retro actions resolved`

### References

- Epic 4 definition: `_bmad-output/planning-artifacts/epics.md` (Story 4.4 details: lines 973-1003)
- Story 4.3 (predecessor): `_bmad-output/implementation-artifacts/4-3-configuration-validation-against-spacetimedb.md`
- Story 4.2 (agent config types): `_bmad-output/implementation-artifacts/4-2-agent-md-configuration-and-skill-selection.md`
- Story 4.1 (skill types): `_bmad-output/implementation-artifacts/4-1-skill-file-format-and-parser.md`
- Test design: `_bmad-output/planning-artifacts/test-design-epic-4.md` (Section 2.4)
- Action cost registry: `packages/client/src/publish/action-cost-registry.ts` (Story 2.2)
- Action cost registry architecture: `_bmad-output/planning-artifacts/architecture/8-action-cost-registry.md`
- Wallet client: `packages/client/src/wallet/wallet-client.ts` (Story 2.2)
- ILP packet types: `packages/client/src/publish/ilp-packet.ts` (Story 2.3/2.5)
- Client publish pipeline: `packages/client/src/client.ts` (Story 2.5)
- Agent config types (AgentBudgetConfig): `packages/client/src/agent/agent-config-types.ts`
- Agent module barrel: `packages/client/src/agent/index.ts`
- Client package index: `packages/client/src/index.ts`
- Risk assessment (R4-003): `_bmad-output/planning-artifacts/test-design-epic-4.md` (Section 1.1)
- Project context: `_bmad-output/project-context.md`

### Verification Steps

1. `pnpm --filter @sigil/client build` -- produces dist/ with all new budget exports
2. `pnpm --filter @sigil/client test:unit` -- all new unit tests pass (~50 new + existing)
3. `pnpm test` -- all existing tests still pass (regression check)
4. Budget tracker initialized from `AgentBudgetConfig` with correct limit
5. `checkAndRecord()` atomically checks and records spend
6. `BudgetExceededError` thrown with correct fields when budget exceeded
7. Warning events emitted at 80% and 90% thresholds (once each)
8. `getMetrics()` returns accurate per-action breakdown
9. `reset()` clears all state
10. Build: `pnpm --filter @sigil/client build` produces ESM + CJS + DTS

## Implementation Constraints

1. No new npm dependencies -- use Node.js built-in `EventEmitter` only
2. No `any` types -- use `unknown` or specific types (project convention)
3. All new files follow kebab-case naming convention
4. All new tests use vitest framework (co-located `__tests__/` directory)
5. Import extensions: use `.js` suffix for all local imports (ESM compatibility)
6. Barrel exports: update `src/agent/index.ts` + `src/index.ts` for public API
7. Budget limit must be non-negative and finite (validate in constructor)
8. Warning thresholds must be between 0 and 1 (exclusive) (validate in constructor)
9. `checkAndRecord()` must be synchronous (R4-003 concurrency mitigation)
10. Error class pattern: extend `Error` with `code: string` (consistent with Stories 4.1-4.3)
11. No Docker required for any tests (pure client-side logic)
12. No modification to `client.ts` -- budget guard is a standalone module
13. JSDoc `@module` comment header on each new source file
14. `BudgetExceededError.code` is the string literal `'BUDGET_EXCEEDED'`
15. Event names: `'budgetWarning'` and `'budgetExhausted'` (camelCase, consistent with existing events)

## CRITICAL Anti-Patterns (MUST AVOID)

- Do NOT modify `client.ts` in this story -- budget enforcement is composed externally by agent runtime
- Do NOT make `checkAndRecord()` async -- it MUST be synchronous to prevent R4-003 budget bypass
- Do NOT make `checkBudget()` or `recordSpend()` public -- they MUST be private to enforce that callers always use `checkAndRecord()` for atomicity
- Do NOT enforce time-based budget periods (per-hour, per-day) -- store the period for reporting but leave periodic reset to the agent runtime
- Do NOT implement decision logging in this story -- that is Story 4.6
- Do NOT implement config swap/reload in this story -- that is Story 4.7
- Do NOT create a new package -- all code goes in `packages/client/src/agent/`
- Do NOT use `any` type -- use `unknown` for dynamic values, then validate and cast
- Do NOT accept negative or NaN budget limits -- validate and reject in constructor
- Do NOT accept warning thresholds outside (0, 1) range -- validate and reject in constructor
- Do NOT re-emit warnings for already-triggered thresholds -- track which thresholds have fired
- Do NOT store budget state in files -- all state is in-memory only (Session-scoped, reset on restart)
- Do NOT import from `@crosstown/client` or `@crosstown/sdk` -- budget tracking is purely client-side

## Definition of Done

- [x] `BudgetTrackerConfig`, `BudgetMetrics`, `BudgetWarningEvent`, `BudgetExceededError` types defined
- [x] `BudgetTracker` class with `checkAndRecord()`, `getMetrics()`, `getStatus()`, `reset()`, `adjustLimit()`
- [x] `BudgetPublishGuard` class with `guard()` and `canAfford()` methods
- [x] `createBudgetTrackerFromConfig()` factory creates tracker from `AgentBudgetConfig`
- [x] `checkAndRecord()` is synchronous (R4-003 concurrency mitigation verified)
- [x] `BudgetExceededError` thrown with correct fields: code, reducer, actionCost, remaining, limit
- [x] Warning events emitted at configurable thresholds (default: 80%, 90%)
- [x] `budgetExhausted` event emitted when budget reaches zero
- [x] `getMetrics()` returns per-action cost breakdown with utilization percentage
- [x] Unit tests pass: `pnpm --filter @sigil/client test:unit` (~65 Story 4.4 unit tests + existing)
- [x] Build passes: `pnpm --filter @sigil/client build` (ESM + CJS + DTS)
- [x] Full regression: `pnpm test` -- all existing tests still pass
- [x] No `any` types in new code
- [x] No Docker required for any tests
- [x] Security: OWASP Top 10 review completed (A01, A02, A03, A04, A05, A06, A09)
- [x] Input validation: non-negative finite limits, valid thresholds (0 < t < 1)

## Change Log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-03-14 | Initial story creation | Epic 4 Story 4.4 spec |
| 2026-03-14 | Adversarial review fixes (8 issues) | BMAD standards compliance |
| 2026-03-14 | Implementation complete: 3 source files, 6 test files, barrel exports updated | Story 4.4 development session |
| 2026-03-14 | Code review #1: 6 issues found (0 critical, 0 high, 2 medium, 4 low), all fixed | Post-implementation code review |
| 2026-03-14 | Code review #2: 0 issues found (0 critical, 0 high, 0 medium, 0 low) -- clean pass | Post-fix verification review |
| 2026-03-14 | Code review #3: 3 issues found (0 critical, 0 high, 1 medium, 2 low), all fixed | Post-implementation adversarial code review with OWASP security scan |

## Code Review Record

| Review Pass | Date | Reviewer | Issues Found | Issues Fixed | Notes |
| --- | --- | --- | --- | --- | --- |
| Adversarial Review | 2026-03-14 | Claude Opus 4.6 | 8 | 8 | See review findings below |
| Code Review #1 | 2026-03-14 | Claude Opus 4.6 | 6 (0C/0H/2M/4L) | 6 | 0 critical, 0 high, 2 medium, 4 low -- all fixed automatically |
| Code Review #2 | 2026-03-14 | Claude Opus 4.6 | 0 (0C/0H/0M/0L) | 0 | Clean pass -- no issues found. Code is clean and well-implemented. |
| Code Review #3 | 2026-03-14 | Claude Opus 4.6 | 3 (0C/0H/1M/2L) | 3 | OWASP + adversarial review. 1 medium (constructor validation), 2 low (canAfford cost validation). 5 new tests added. |

### Review Findings (2026-03-14)

1. **Fixed validation metadata block NFR traceability overstatement.** The metadata block claimed "1 NFR mapped to ACs (NFR16 via metrics/budget scope)" but the FR/NFR Traceability table correctly says "NFR16 -> N/A direct". NFR16 is not applicable to this story (budget metrics are in-memory, no file I/O). Corrected to "0 NFRs directly mapped to ACs".

2. **Added FR15 traceability tags to AC2, AC3, AC4.** The FR/NFR Traceability table correctly maps FR15 to AC1-AC5 (full budget lifecycle), but only AC1 had the `(FR15)` tag in the acceptance criteria text. AC2, AC3, and AC4 now include `(FR15)` for consistency.

3. **Fixed AC4 contradiction with anti-pattern rule.** AC4 originally stated "the rejection is logged in the decision log" but the CRITICAL Anti-Patterns section says "Do NOT implement decision logging in this story -- that is Story 4.6." Changed AC4 to say "a `budgetExhausted` event is emitted for consumption by the decision logger (Story 4.6)" which correctly describes the EventEmitter integration without implementing logging.

4. **Made `checkBudget()` and `recordSpend()` private in Task 2 specification.** These were listed as public methods, but the CRITICAL Anti-Patterns section warns against using them separately. Making them private enforces the anti-pattern at the API level rather than relying on developer discipline. Updated the anti-pattern text to match.

5. **Added `AgentBudgetConfig` field details to Story 4.2 dependency.** The dependency listed `AgentBudgetConfig` without specifying which fields the budget tracker consumes. Added field list (`limit`, `unit`, `period`, `raw`) for the dev agent to understand the input contract.

6. **Documented intentional non-mapping of `AgentBudgetConfig.raw` field.** The `createBudgetTrackerFromConfig` factory maps `limit`, `unit`, `period` but not `raw`. Added explicit note that `raw` is intentionally skipped (it is for display/debug context in Agent.md, not needed by the budget tracker).

7. **Added `this.name = 'BudgetExceededError'` to error class specification.** Following the established pattern from `AgentConfigError` (Story 4.2) and `SkillParseError` (Story 4.1), which both set `this.name` in the constructor. Without this, `error.name` defaults to `'Error'` in JavaScript, making error type identification in logs harder.

8. **Added `adjustLimit()` input validation requirement.** The `adjustLimit(newLimit)` method was specified without noting that it must validate `newLimit` using the same rules as the constructor (non-negative, finite). Without this, a caller could bypass constructor validation by calling `adjustLimit(NaN)` or `adjustLimit(-1)` at runtime.

### Code Review #1 Findings (2026-03-14)

**MEDIUM Issues (2):**

9. **[MEDIUM] Missing cost validation in `checkAndRecord()`.** The `cost` parameter had no validation -- negative values would bypass budget enforcement by effectively increasing remaining budget. Added validation: `!Number.isFinite(cost) || cost < 0` throws `Error('Invalid action cost...')`. Added 4 new tests covering negative, NaN, Infinity, -Infinity costs.

10. **[MEDIUM] Story test count discrepancies.** Story claimed ~50 tests total, budget-tracker.test.ts claimed 15, budget-integration.test.ts claimed 5. Actual counts: 28, 7, and 65 total. Fixed all test count references in Task 4, Task 5, Test Design Reference, DOD, Completion Notes, and File List.

**LOW Issues (4):**

11. **[LOW] Division by zero in `recordSpend()` when limit is 0.** `this.totalSpend / this.config.limit` produced NaN when limit=0 (zero-cost action on zero-budget tracker). While NaN comparisons are false (no warning fires by accident), this was inconsistent with `getMetrics()` which guarded against this. Fixed to match: `this._limit > 0 ? this.totalSpend / this._limit : 0`.

12. **[LOW] `adjustLimit()` used type cast to bypass readonly.** `(this.config as { limit: number }).limit = newLimit` bypassed the `readonly config` declaration. Refactored to use a separate `private _limit: number` field, eliminating the cast entirely. All internal references now use `this._limit` instead of `this.config.limit`.

13. **[LOW] `getStatus()` returned stale 'warning' after `adjustLimit()` reduced utilization below thresholds.** The old implementation checked `thresholdsTriggered.size > 0` (historical state). After `adjustLimit` raised the limit, status would still report 'warning' even when utilization was well below all thresholds. Refactored `getStatus()` to compute status from live utilization, not from historical threshold triggers. Updated test to verify `getStatus()` returns `'active'` after limit increase reduces utilization below thresholds.

14. **[LOW] budget-tracker.test.ts adjustLimit recovery test was insufficiently specific.** The test for "recovers from exhaustion when limit is increased" only verified `not.toBe('exhausted')` but didn't verify the correct status. Updated to `toBe('active')` after adjustLimit(200) brings utilization to 25% (below all thresholds). Updated the corresponding integration test similarly.

### Code Review #3 Findings (2026-03-14)

**MEDIUM Issues (1):**

15. **[MEDIUM] `BudgetPublishGuard` constructor does not validate arguments.** Neither `budgetTracker` nor `costLookup` were validated for `null`/`undefined`. Passing `null` as `budgetTracker` would produce a confusing runtime error ("Cannot read property 'checkAndRecord' of null") at `guard()` time rather than at construction time. Other constructors in the codebase (`BudgetTracker`) validate their inputs. Added null/undefined checks with descriptive error messages. Added 3 new tests.

**LOW Issues (2):**

16. **[LOW] `canAfford()` did not validate cost from `costLookup` -- inconsistent with `guard()`.** If `costLookup` returned a negative number, `canAfford()` returned `true` (since `remaining >= negative` is always true), but the subsequent `guard()` call would throw `Error('Invalid action cost')`. This created a misleading pre-check. Added cost validation in `canAfford()`: returns `false` for non-finite or negative costs. Added 2 new tests.

17. **[LOW/ACCEPTED] `canAfford()` does not catch `costLookup` exceptions.** If `costLookup` throws (e.g., unknown reducer not in registry), `canAfford()` propagates the error. This is consistent with `guard()`'s behavior and is the correct design choice (the caller should handle lookup failures). Documented as accepted, no code change needed.

**OWASP Security Scan Results:**

- **A01 Broken Access Control:** PASS. Budget tracker is in-memory, local to agent runtime. No remote access.
- **A02 Cryptographic Failures:** N/A. No crypto in this story.
- **A03 Injection:** PASS. No `eval`, `Function()`, string-based timers, or prototype pollution vectors. Reducer names validated by upstream registry. Budget limits validated as non-negative finite numbers. Cost validation in `checkAndRecord()` prevents negative-cost budget bypass.
- **A04 Insecure Design:** PASS. Fail-closed enforcement (exceed -> reject). `checkAndRecord()` is atomic (synchronous). `canAfford()` now returns false for invalid costs.
- **A05 Security Misconfiguration:** PASS. Sensible defaults (80%, 90% thresholds). Constructor validation rejects invalid config. `adjustLimit()` validates input.
- **A06 Vulnerable Components:** PASS. No new npm dependencies. Uses only Node.js built-in `EventEmitter`.
- **A07 Authentication Failures:** N/A. No authentication in this module.
- **A08 Data Integrity Failures:** PASS. Budget state is in-memory only, no serialization/deserialization.
- **A09 Security Logging:** PASS. Budget warnings and exhaustion events emitted via EventEmitter.
- **A10 SSRF:** N/A. No network requests.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

N/A -- no debug issues encountered during implementation.

### Completion Notes List

- **Task 1 (Budget tracker types):** Implemented `BudgetTrackerConfig`, `BudgetStatus`, `BudgetMetrics`, `BudgetWarningEvent` interfaces and `BudgetExceededError` class in `budget-types.ts`. Error class follows established pattern with `code: 'BUDGET_EXCEEDED'`, `name: 'BudgetExceededError'`, and readonly fields for `reducer`, `actionCost`, `remaining`, `limit`.
- **Task 2 (Budget tracker core):** Implemented `BudgetTracker` class extending `EventEmitter` in `budget-tracker.ts`. Private `checkBudget()` and `recordSpend()` methods enforce atomicity via the single public `checkAndRecord()` method. Constructor validates config (non-negative finite limits, thresholds in (0,1)). `getMetrics()` returns deep-copied snapshot. `createBudgetTrackerFromConfig()` factory maps `AgentBudgetConfig` to `BudgetTrackerConfig` with default [0.8, 0.9] thresholds.
- **Task 3 (Budget publish guard):** Implemented `BudgetPublishGuard` class in `budget-publish-guard.ts` with `guard()` (synchronous, throws `BudgetExceededError`) and `canAfford()` (non-mutating check). Accepts `costLookup` function for decoupling from action cost registry.
- **Task 4 (Budget tracker unit tests):** 28 tests in `budget-tracker.test.ts` covering initialization, validation, spend tracking, budget enforcement, cost validation, metrics, status, reset, adjustLimit, remaining getter, and factory function.
- **Task 4 (Budget publish guard tests):** 17 tests in `budget-publish-guard.test.ts` covering constructor validation, guard enforcement, error fields, synchronous behavior, sequential calls, zero-budget edge cases, unknown reducers, canAfford non-mutating checks, and canAfford cost validation edge cases.
- **Task 4 (Budget warnings tests):** 8 tests in `budget-warnings.test.ts` covering threshold crossing, one-time emission, sequential threshold triggering, custom thresholds, payload structure, and empty threshold array.
- **Task 4 (Budget concurrency tests):** 5 tests in `budget-concurrency.test.ts` verifying R4-003 mitigation: rapid calls, sequential cumulative tracking, synchronous return type, immediate rejection after exhaustion, and Promise.all simulation.
- **Task 4 (Budget metrics tests):** 5 tests in `budget-metrics.test.ts` covering initial state, per-reducer breakdown, same-reducer aggregation, reset behavior, and snapshot isolation.
- **Task 5 (Integration-style tests):** 7 tests in `budget-integration.test.ts` simulating publish pipeline with mock cost lookup: successful actions, budget exceeded, pre-Crosstown enforcement, post-exhaustion rejection, budgetExhausted event emission, adjustLimit recovery, and reset recovery.
- **Task 6 (Barrel exports):** `agent/index.ts` updated with re-exports for all new types, classes, and factory. `src/index.ts` updated with Story 4.4 export block.
- **Task 7 (Integration pattern documentation):** Integration pattern documented in Dev Notes section of this story file. `SigilClient` is not modified -- budget guard is composed externally by agent runtime.
- **Task 8 (OWASP security review):** Verified A01-A06, A09 compliance. No remote access to budget state, no crypto, no injection vectors, fail-closed enforcement, sensible defaults, no new dependencies, budget events emitted for audit logging.
- **Task 9 (Checklist validation):** All 5 ACs have test coverage (70 tests total). All 9 tasks map to at least one AC. DOD checklist passes. Build produces ESM + CJS + DTS. Full regression green.

### File List

**Created:**
- `packages/client/src/agent/budget-types.ts` -- BudgetTrackerConfig, BudgetStatus, BudgetMetrics, BudgetWarningEvent, BudgetExceededError
- `packages/client/src/agent/budget-tracker.ts` -- BudgetTracker class, createBudgetTrackerFromConfig factory
- `packages/client/src/agent/budget-publish-guard.ts` -- BudgetPublishGuard class
- `packages/client/src/agent/__tests__/budget-tracker.test.ts` -- 28 tests
- `packages/client/src/agent/__tests__/budget-publish-guard.test.ts` -- 17 tests
- `packages/client/src/agent/__tests__/budget-warnings.test.ts` -- 8 tests
- `packages/client/src/agent/__tests__/budget-concurrency.test.ts` -- 5 tests
- `packages/client/src/agent/__tests__/budget-metrics.test.ts` -- 5 tests
- `packages/client/src/agent/__tests__/budget-integration.test.ts` -- 7 tests

**Modified:**
- `packages/client/src/agent/index.ts` -- Added re-exports for budget types, classes, and factory
- `packages/client/src/index.ts` -- Added Story 4.4 export block for budget module
