# Story 3.3: Pricing Configuration & Fee Schedule

Status: done

<!--
Validation Status: VALIDATED
Review Type: Adversarial Review via /bmad-review-adversarial-general (2026-03-13)
Reviewer: Claude Opus 4.6
BMAD Standards Compliance: VERIFIED (2026-03-13)
- Story structure: Complete (all required sections present)
- Acceptance criteria: 5 ACs with Given/When/Then format, FR/NFR traceability
- Task breakdown: 6 tasks with detailed subtasks, AC mapping on each task
- NFR traceability: 2 NFRs mapped to ACs (NFR12, NFR17)
- FR traceability: 2 FRs mapped to ACs (FR20, FR45)
- Dependencies: Documented (2 epics + 2 stories required complete, 1 external, 1 blocked story)
- Technical design: Comprehensive with architecture decisions, API references, format specifications
- Security review: OWASP Top 10 coverage complete (A02, A03, A04, A05, A09)
Issues Found & Fixed: 6 (see review notes below)
Ready for Implementation: YES
-->

## Story

As an operator,
I want to configure per-action-type pricing for the BLS so the system collects ILP fees on every game action,
So that the platform generates revenue from game activity.

## Dependencies

**Required Complete (all done):**

- **Epic 1** (Project Foundation) -- monorepo structure, Nostr identity, Docker stack, SpacetimeDB
- **Epic 2** (Action Execution & Payment Pipeline) -- client publish pipeline, BLS integration contract (Story 2.4), @crosstown/client integration (Story 2.5), action cost registry format (Story 2.2)
- **Story 3.1** (BLS Package Setup & Crosstown SDK Node) -- BLS node infrastructure, `createNode()` with `kindPricing`, @crosstown/sdk stub, Docker integration
- **Story 3.2** (Game Action Handler) -- handler operational for kind 30078, content parsing, SpacetimeDB caller

**External Dependencies:**

- `@crosstown/sdk@^0.1.4` workspace stub (created in Story 3.1) -- provides `createPricingValidator`, `createNode()` with `kindPricing` parameter

**Blocks:**

- Story 3.4 (Identity Propagation & End-to-End Verification) depends on pricing enforcement being operational for full pipeline testing

## Acceptance Criteria

1. **Kind pricing configuration in createNode() (AC1)** (FR20)
   - **Given** the BLS node configuration
   - **When** `createNode()` is called
   - **Then** `kindPricing` is configured with a price for kind 30078 events
   - **And** the SDK's `createPricingValidator` automatically rejects packets with insufficient payment

2. **Per-action-type fee schedule loading (AC2)** (FR45)
   - **Given** a JSON fee schedule configuration file
   - **When** the BLS loads it at startup
   - **Then** per-action-type pricing is mapped: different reducers can have different costs
   - **And** the fee schedule is exposed via the action cost registry format (compatible with `@sigil/client` Story 2.2)

3. **SDK pricing enforcement (AC3)** (FR20)
   - **Given** a game action event arrives
   - **When** the SDK validates the ILP payment amount
   - **Then** the payment must meet or exceed the configured price for the event kind
   - **And** if the payment is insufficient, the SDK rejects with code `F04` before the handler is invoked
   - **And** the self-write bypass allows the node's own pubkey to skip pricing (SDK default behavior)

4. **Client registry consistency (AC4)** (NFR12)
   - **Given** the fee schedule
   - **When** a user queries the cost of an action via the `@sigil/client` action cost registry
   - **Then** the displayed cost matches the BLS fee schedule
   - **And** the fee is publicly verifiable

5. **Concurrent fee accounting (AC5)** (NFR17)
   - **Given** concurrent multi-agent load
   - **When** multiple ILP fees are collected simultaneously
   - **Then** fee accounting remains accurate -- the SDK handles payment validation atomically per packet

## Tasks / Subtasks

### Task 1: Create fee schedule loader module (AC: 2, 4)

- [x] Create `packages/bitcraft-bls/src/fee-schedule.ts`:
  - Export `FeeSchedule` interface: `{ version: number, defaultCost: number, actions: Record<string, FeeScheduleEntry> }`
  - `FeeScheduleEntry` interface: `{ cost: number, category?: string, frequency?: string }`
  - Export `loadFeeSchedule(filePath: string): FeeSchedule` function
  - Load JSON from file path, parse, validate
  - File format is intentionally compatible with `@sigil/client`'s `ActionCostRegistry` (Story 2.2): same `version`, `defaultCost`, and `actions` structure
  - Export `FeeScheduleError` class extending `Error` with `code: string` field
- [x] Validation rules:
  - JSON must parse successfully
  - `version` must be present and equal to `1` (integer)
  - `defaultCost` must be present, non-negative, finite number
  - `actions` must be present and be an object (not array)
  - Each action entry must have a `cost` field (non-negative, finite number)
  - `category` and `frequency` are optional (BLS only needs `cost` -- other fields are metadata for the client registry)
  - Reject files larger than 1MB (content length check, OWASP A03)
  - Path traversal prevention: reject paths containing `..` segments (OWASP A03)
- [x] Export `getFeeForReducer(schedule: FeeSchedule, reducerName: string): number` function:
  - Look up reducer in `schedule.actions`
  - Return `entry.cost` if found, otherwise return `schedule.defaultCost`
  - Reducer name validated via same regex as content parser: `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`

### Task 2: Integrate fee schedule into BLS config (AC: 1, 2)

- [x] Add `feeSchedulePath` to `BLSConfig` interface in `config.ts`:
  - Type: `string | undefined`
  - Environment variable: `BLS_FEE_SCHEDULE_PATH`
  - Optional: if not set, use default hardcoded kindPricing `{ 30078: 100n }`
- [x] Modify `loadConfig()` in `config.ts`:
  - Read `BLS_FEE_SCHEDULE_PATH` from environment
  - If path is provided, load and validate the fee schedule file
  - Derive `kindPricing` from fee schedule: set `kindPricing[30078]` to the **minimum** cost across all actions and `defaultCost` (converted to bigint). This serves as an efficient SDK-level pre-filter -- the SDK gate rejects packets that are underpaid for ANY action, while per-reducer pricing in the handler enforces exact costs. Example: if `defaultCost: 10` and cheapest action is `player_move: { cost: 1 }`, then `kindPricing = { 30078: 1n }`. This ensures cheap actions are not blocked by the SDK gate.
  - If NO fee schedule path is provided, keep existing hardcoded default `kindPricing: { 30078: 100n }` (backward compatible)
  - Store fee schedule on config for per-reducer lookups at handler time
- [x] Add `feeSchedule` to `BLSConfig`:
  - Type: `FeeSchedule | undefined`
  - Populated when `BLS_FEE_SCHEDULE_PATH` is set
  - Used by handler for per-reducer cost lookups
- [x] Update `packages/bitcraft-bls/src/index.ts` exports:
  - Add: `export { loadFeeSchedule, getFeeForReducer, FeeScheduleError, type FeeSchedule, type FeeScheduleEntry } from './fee-schedule.js'`
  - This follows the pattern established in Story 3.2 Task 4 (explicit export list)

### Task 3: Implement per-reducer pricing enforcement in handler (AC: 2, 3)

- [x] Modify `handler.ts` to support per-reducer pricing:
  - After parsing event content (reducer name extracted), look up the reducer's cost from the fee schedule
  - Compare `ctx.amount` (bigint) against the reducer's configured cost (converted to bigint)
  - If `ctx.amount < reducerCost`: return `ctx.reject('F04', 'Insufficient payment for {reducer}: {amount} < {cost}')`
  - If fee schedule is not loaded, fall back to SDK-level kindPricing (already enforced by SDK)
  - Self-write bypass: if `ctx.pubkey === node identity pubkey`, skip per-reducer pricing (consistent with SDK behavior)
- [x] Pass node identity pubkey to handler factory:
  - Modify `createGameActionHandler(config, identityPubkey?)` to accept optional identity pubkey
  - When identity pubkey matches `ctx.pubkey`, skip per-reducer pricing check
  - Update `index.ts` call site: change `createGameActionHandler(config)` to `createGameActionHandler(config, identity.pubkey)` (identity is available from `createBLSNode()` return value)
- [x] Logging for pricing decisions:
  - On F04 rejection: `[BLS] Payment insufficient | eventId: {id} | pubkey: {truncated} | reducer: {name} | paid: {amount} | required: {cost}`
  - On self-write bypass: `[BLS] Self-write bypass | eventId: {id} | reducer: {name}` (debug level)

### Task 4: Create fee schedule HTTP endpoint (AC: 4)

- [x] Add `GET /fee-schedule` endpoint to health server in `health.ts`:
  - Returns the loaded fee schedule as JSON (publicly verifiable, NFR12)
  - If no fee schedule loaded, return `{ defaultCost: 100, actions: {} }` (from kindPricing)
  - Content-Type: `application/json`
  - This endpoint allows clients to verify that their action cost registry matches the BLS pricing
- [x] Endpoint is read-only, no authentication required (fee transparency)
- [x] SECURITY: endpoint returns ONLY fee data, never tokens or keys (OWASP A02)

### Task 5: Write unit tests (AC: 1-5)

Following the test design in `_bmad-output/planning-artifacts/test-design-epic-3.md` Section 2.3.

- [x] Create `packages/bitcraft-bls/src/__tests__/fee-schedule.test.ts` (~12 tests):
  - Valid fee schedule JSON -- parses successfully
  - Fee schedule with per-reducer costs -- each reducer has different cost
  - `getFeeForReducer()` returns action cost for known reducer
  - `getFeeForReducer()` returns defaultCost for unknown reducer
  - Missing version field -- throws FeeScheduleError
  - Invalid version (not 1) -- throws FeeScheduleError
  - Missing defaultCost -- throws FeeScheduleError
  - Negative defaultCost -- throws FeeScheduleError
  - Missing actions field -- throws FeeScheduleError
  - Non-object actions field (array) -- throws FeeScheduleError
  - Action entry with negative cost -- throws FeeScheduleError
  - File content exceeding 1MB -- throws FeeScheduleError

- [x] Create `packages/bitcraft-bls/src/__tests__/pricing-config.test.ts` (~11 tests):
  - `kindPricing` passed to `createNode()` with kind 30078 price
  - Default kindPricing `{ 30078: 100n }` used when no fee schedule path provided
  - Fee schedule path loaded when BLS_FEE_SCHEDULE_PATH is set
  - Invalid fee schedule path causes startup failure with clear error
  - `kindPricing[30078]` derived from fee schedule as minimum of `defaultCost` and all action costs (converted to bigint)
  - Fee schedule with cheapest action `cost: 1` and `defaultCost: 10` produces `kindPricing: { 30078: 1n }`
  - `createPricingValidator()` rejects amount below configured price (F04)
  - `createPricingValidator()` accepts amount at or above configured price
  - `createPricingValidator()` allows unpriced kinds (no rule = free)
  - Config includes fee schedule object when loaded
  - Config defaults when no fee schedule provided

- [x] Create `packages/bitcraft-bls/src/__tests__/pricing-enforcement.test.ts` (~8 tests):
  - Per-reducer pricing: handler rejects when payment < reducer cost (F04)
  - Per-reducer pricing: handler accepts when payment >= reducer cost
  - Default cost used for reducer not in fee schedule
  - Self-write bypass: node's own pubkey skips per-reducer pricing
  - Self-write bypass: other pubkeys do NOT skip pricing
  - Handler without fee schedule: falls back to SDK-level kindPricing only
  - Rejection message includes reducer name, paid amount, required amount
  - Rejection logged with full context (eventId, pubkey, reducer, amounts)

- [x] Create `packages/bitcraft-bls/src/__tests__/self-write-bypass.test.ts` (~5 tests):
  - SDK `createPricingValidator` allows free access for node's own pubkey (SDK default)
  - Per-reducer pricing bypassed for node's own pubkey
  - Non-node pubkeys are subject to both SDK and per-reducer pricing
  - Self-write bypass works with zero-amount packets
  - Self-write bypass logged at debug level

- [x] Create `packages/bitcraft-bls/src/__tests__/fee-schedule-endpoint.test.ts` (~5 tests):
  - `GET /fee-schedule` returns JSON fee schedule
  - Response includes all reducer costs
  - Response includes default cost
  - Endpoint returns default when no fee schedule loaded
  - Endpoint NEVER includes tokens or keys in response

### Task 6: Write integration tests (AC: 1-5)

- [x] Create `packages/bitcraft-bls/src/__tests__/pricing-integration.test.ts` (~6 tests, skipped without Docker):
  - Full handler flow with sufficient payment -- handler invoked, action succeeds
  - Handler with insufficient payment for specific reducer -- F04 rejection before handler
  - SDK-level pricing: packet below kindPricing minimum -- F04 before handler
  - Per-reducer pricing: cheap action (player_move, cost 1) passes with small payment
  - Per-reducer pricing: expensive action (empire_form, cost 100) fails with small payment
  - Self-write bypass: node's own pubkey processes action with zero payment

- [x] Create `packages/bitcraft-bls/src/__tests__/fee-schedule-consistency.test.ts` (~4 tests, skipped without Docker):
  - BLS fee schedule format matches client ActionCostRegistry format
  - Cost lookup for `player_move` returns same value from BLS and client registries
  - Cost lookup for unknown reducer returns defaultCost from both sources
  - `GET /fee-schedule` endpoint returns data compatible with client registry loader

- [x] Use `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS || !process.env.BLS_AVAILABLE)` pattern

## Dev Notes

### Architecture Context

This story adds **pricing configuration** to the BLS node. Story 3.1 established node infrastructure (package, SDK stub, Docker, health, lifecycle). Story 3.2 added the game action handler (content parsing, SpacetimeDB calls, identity propagation). This story layers pricing on top -- configuring `kindPricing` for the SDK-level enforcement and adding per-reducer fee schedule support.

**Two levels of pricing enforcement:**

1. **SDK-level (kindPricing):** Configured in `createNode()`. The SDK's `createPricingValidator` automatically rejects packets where `ctx.amount < kindPricing[kind]` with code `F04` BEFORE the handler is invoked. This is a coarse-grained gate: when a fee schedule is loaded, `kindPricing[30078]` is set to the **minimum** cost across all configured actions and `defaultCost`, serving as an efficient pre-filter. Without a fee schedule, the hardcoded default `{ 30078: 100n }` is used.

2. **Handler-level (per-reducer fee schedule):** Fine-grained pricing. Different reducers cost different amounts. After the SDK's kindPricing gate passes, the handler checks `ctx.amount` against the specific reducer's cost from the fee schedule. This enables economic balancing: `player_move` (cost 1) is cheap, `empire_form` (cost 100) is expensive.

**Client-side compatibility:**

The BLS fee schedule shares a **superset-compatible** JSON format with `@sigil/client`'s `ActionCostRegistry` (Story 2.2). Both use `{ version, defaultCost, actions: { reducer: { cost, ... } } }`. The key asymmetry: the client's `validateRegistry()` requires `category` (enum: movement, combat, etc.) and `frequency` (enum: very_low, low, etc.) as **mandatory** fields on each action entry, while the BLS only reads `cost` and treats `category` and `frequency` as **optional metadata**. This means:

- A file valid for the client is always valid for the BLS (strict superset)
- A file valid for the BLS may NOT be valid for the client (if `category`/`frequency` are missing)
- For single-source-of-truth usage, the canonical fee schedule file MUST include `category` and `frequency` so BOTH the client and BLS can load it

This ensures `client.publish.getCost('player_move')` returns the same value the BLS will enforce.

**Self-write bypass:**

The SDK provides a default behavior where the node's own pubkey can submit events without paying. This is useful for node administration and testing. Our per-reducer pricing check must also respect this bypass.

### @crosstown/sdk Pricing API Reference

```typescript
// SDK pricing configuration (from createNode options)
interface NodeConfig {
  kindPricing?: Record<number, bigint>;  // e.g., { 30078: 100n }
  // ... other config
}

// SDK pricing validator (internal, used by SDK)
function createPricingValidator(kindPricing: Record<number, bigint>): PricingValidatorFn;

// PricingValidatorFn checks amount against min price for a kind
type PricingValidatorFn = (kind: number, amount: bigint) => {
  valid: boolean;
  code?: string;   // 'F04' for insufficient payment
  message?: string;
};

// HandlerContext amount field
ctx.amount  // bigint: ILP payment amount (set by sender)
ctx.pubkey  // string: verified Nostr pubkey (64-char hex)
```

[Source: packages/crosstown-sdk/src/index.ts]

### Fee Schedule JSON Format (Compatible with Client Registry)

```json
{
  "version": 1,
  "defaultCost": 10,
  "actions": {
    "player_move": { "cost": 1, "category": "movement", "frequency": "high" },
    "craft_item": { "cost": 15, "category": "crafting", "frequency": "medium" },
    "empire_form": { "cost": 100, "category": "governance", "frequency": "very_low" }
  }
}
```

The BLS only reads `cost` from each entry. The `category` and `frequency` fields are metadata consumed by `@sigil/client`'s `ActionCostRegistryLoader` but not by the BLS. This means the BLS can load the exact same JSON file as the client -- single source of truth.

[Source: packages/client/config/default-action-costs.json]

### Pricing Flow

```
ILP Packet arrives
    │
    ▼
SDK kindPricing gate (F04 if ctx.amount < kindPricing[30078])
    │
    ▼ (passes SDK gate)
Handler invoked
    │
    ▼
Parse event content → extract reducer name
    │
    ▼
Per-reducer pricing check:
  - Look up reducer cost from fee schedule
  - If ctx.pubkey === node identity pubkey → bypass (self-write)
  - If ctx.amount < reducerCost → reject F04
  - Else → continue to SpacetimeDB call
    │
    ▼
Call SpacetimeDB (existing handler flow from Story 3.2)
```

### ILP Error Code for Pricing

| Condition | ILP Code | Message Pattern | Retryable |
|---|---|---|---|
| SDK: insufficient for kind | `F04` | (handled by SDK, not our handler) | No |
| Handler: insufficient for reducer | `F04` | `Insufficient payment for {reducer}: {amount} < {cost}` | No |
| Handler: self-write bypass | (no error) | Action proceeds without payment | N/A |

[Source: _bmad-output/planning-artifacts/test-design-epic-3.md, Section 2.3]

### File Structure

```
packages/bitcraft-bls/
├── src/
│   ├── index.ts              # Entry point (MODIFY: add fee schedule exports)
│   ├── config.ts             # loadConfig() (MODIFY: add feeSchedulePath, feeSchedule)
│   ├── node.ts               # createBLSNode() (NO CHANGES)
│   ├── health.ts             # Health check (MODIFY: add /fee-schedule endpoint)
│   ├── lifecycle.ts          # Shutdown handlers (NO CHANGES)
│   ├── handler.ts            # createGameActionHandler() (MODIFY: add per-reducer pricing)
│   ├── content-parser.ts     # parseEventContent() (NO CHANGES)
│   ├── spacetimedb-caller.ts # callReducer() (NO CHANGES)
│   ├── fee-schedule.ts       # NEW: loadFeeSchedule(), getFeeForReducer(), FeeScheduleError
│   └── __tests__/
│       ├── fee-schedule.test.ts                # NEW: ~12 tests
│       ├── pricing-config.test.ts              # NEW: ~11 tests
│       ├── pricing-enforcement.test.ts         # NEW: ~8 tests
│       ├── self-write-bypass.test.ts           # NEW: ~5 tests
│       ├── fee-schedule-endpoint.test.ts       # NEW: ~5 tests
│       ├── pricing-integration.test.ts         # NEW: ~6 tests (Docker-dependent)
│       └── fee-schedule-consistency.test.ts    # NEW: ~4 tests (Docker-dependent)
```

### Project Structure Notes

- Primary new file: `fee-schedule.ts` in `packages/bitcraft-bls/src/`
- Modifications to: `config.ts` (add fee schedule config), `handler.ts` (per-reducer pricing), `health.ts` (fee schedule endpoint), `index.ts` (exports)
- NO changes to: `node.ts`, `lifecycle.ts`, `content-parser.ts`, `spacetimedb-caller.ts`
- Follows monorepo conventions: kebab-case file names, co-located tests, vitest
- Uses existing `@crosstown/sdk` workspace stub (Story 3.1) for `createPricingValidator` types
- Uses Node.js built-in `fs.readFileSync` for fee schedule loading -- NO additional dependencies

### Previous Story Intelligence (from Stories 3.1 and 3.2)

Key patterns and decisions from Stories 3.1 and 3.2 that MUST be followed:

1. **Config loading pattern:** `loadConfig()` in `config.ts` reads environment variables with validation and defaults. The function already hardcodes `kindPricing: { 30078: 100n }`. Story 3.3 makes this configurable via fee schedule file.

2. **Handler factory pattern:** `createGameActionHandler(config)` returns a `HandlerFn`. Story 3.3 extends the factory to accept optional identity pubkey for self-write bypass.

3. **Error class pattern:** Story 3.2 established `ContentParseError` and `ReducerCallError` with `code: string` fields. Follow this pattern for `FeeScheduleError`.

4. **Health server pattern:** Story 3.1 created the health server in `health.ts` using Node.js built-in `http`. Story 3.3 adds a `/fee-schedule` endpoint to the same server.

5. **Test factories:** Reuse `createBLSConfig()` from `packages/bitcraft-bls/src/__tests__/factories/bls-config.factory.ts` and `createHandlerContext()` from `packages/bitcraft-bls/src/__tests__/factories/handler-context.factory.ts`.

6. **Integration test skip pattern:** `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS || !process.env.BLS_AVAILABLE)` -- all integration tests follow this pattern.

7. **No `any` types:** Project convention -- use `unknown` or specific types.

8. **No additional HTTP dependencies:** Uses Node.js built-in `http` for health server, built-in `fs` for file loading. No Express, no axios.

9. **CJS/ESM dual build:** All imports use `.js` extension for ESM compatibility (e.g., `import { loadConfig } from './config.js'`). tsup handles CJS output.

10. **Error logging prefix:** `[BLS]` prefix for all log messages. `console.log` for info, `console.error` for errors.

11. **Client registry compatibility:** The `@sigil/client` action cost registry format (Story 2.2) uses `ActionCostRegistry` interface with `{ version: 1, defaultCost: number, actions: Record<string, { cost: number, category: CategoryEnum, frequency: FrequencyEnum }> }` where `category` and `frequency` are **mandatory** with enum validation. The BLS fee schedule uses a relaxed format where only `cost` is mandatory per action entry; `category` and `frequency` are optional metadata ignored by the BLS. Canonical fee schedule files should include all fields for cross-system compatibility.

### Git Intelligence

Recent commits show the project uses conventional commit format:

- `feat(3-2): story complete`
- `feat(3-1): story complete`
- `chore(epic-3): epic start -- baseline green, retro actions resolved`

For Story 3.3, use: `feat(3-3): ...` format.

### References

- Epic 3 definition: `_bmad-output/planning-artifacts/epics.md` (Epic 3: line 728, Story 3.3: lines 801-833)
- Story 3.1 (BLS node infrastructure): `_bmad-output/implementation-artifacts/3-1-bls-package-setup-and-crosstown-sdk-node.md`
- Story 3.2 (Game action handler): `_bmad-output/implementation-artifacts/3-2-game-action-handler-kind-30078.md`
- BLS handler contract: `docs/bls-handler-contract.md`
- Crosstown BLS implementation spec: `docs/crosstown-bls-implementation-spec.md`
- Crosstown SDK architecture: `_bmad-output/planning-artifacts/architecture/7-crosstown-integration.md` (Section 7.2)
- Epic 3 test design: `_bmad-output/planning-artifacts/test-design-epic-3.md` (Section 2.3)
- Client action cost registry: `packages/client/src/publish/action-cost-registry.ts` (Story 2.2)
- Default action costs JSON: `packages/client/config/default-action-costs.json`
- @crosstown/sdk stub: `packages/crosstown-sdk/src/index.ts` (`createPricingValidator`, `NodeConfig.kindPricing`)
- BLS config module: `packages/bitcraft-bls/src/config.ts` (current `kindPricing: { 30078: 100n }`)
- BLS handler module: `packages/bitcraft-bls/src/handler.ts` (current handler factory)
- BLS health module: `packages/bitcraft-bls/src/health.ts` (health server)
- BLS node module: `packages/bitcraft-bls/src/node.ts` (`kindPricing` passed to `createNode`)
- BLS index (entry point): `packages/bitcraft-bls/src/index.ts`
- Test factories: `packages/bitcraft-bls/src/__tests__/factories/`
  - `bls-config.factory.ts` -- BLSConfig test data
  - `identity.factory.ts` -- Identity test data
  - `handler-context.factory.ts` -- HandlerContext mock (preferred for Story 3.3 tests)
- FR20: ILP fee collection
- FR45: ILP fee schedule configuration
- NFR12: ILP fee schedules publicly verifiable
- NFR17: ILP fee collection maintains accurate accounting under concurrent multi-agent load

### Verification Steps

1. `pnpm install` -- no new dependencies needed (uses built-in `fs` and `http`)
2. `pnpm --filter @sigil/bitcraft-bls build` -- produces dist/ with ESM/CJS/DTS including fee-schedule module
3. `pnpm --filter @sigil/bitcraft-bls test:unit` -- all unit tests pass (~40 new unit + ~124 existing = ~164 unit tests; ~10 new integration tests skipped without Docker)
4. `pnpm test` -- all existing tests still pass (regression check)
5. Fee schedule loads from JSON file: `loadFeeSchedule('./config/default-action-costs.json')` succeeds
6. `getFeeForReducer(schedule, 'player_move')` returns `1`
7. `getFeeForReducer(schedule, 'unknown_action')` returns `10` (defaultCost)
8. `GET /fee-schedule` returns fee schedule JSON on health server
9. Handler rejects underpaid packet with F04
10. Handler accepts sufficiently paid packet
11. Self-write bypass allows node's own pubkey without payment

## Implementation Constraints

1. Use Node.js built-in `fs` for file loading and built-in `http` for endpoint (Node 20+ provides both)
2. No `any` types -- use `unknown` or specific types (project convention)
3. All new files follow kebab-case naming convention
4. All new tests use vitest framework (co-located `*.test.ts`)
5. Integration tests use `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)` pattern
6. Fee schedule JSON format MUST be superset-compatible with `@sigil/client` `ActionCostRegistry` format (BLS reads `cost` only; `category` and `frequency` are optional on BLS side but mandatory on client side -- canonical files should include all fields)
7. BLS_FEE_SCHEDULE_PATH is optional -- omitting it preserves backward compatibility with hardcoded kindPricing
8. Fee schedule file path MUST be validated against path traversal (OWASP A03)
9. Fee schedule file size MUST be limited to 1MB (OWASP A03)
10. `/fee-schedule` endpoint MUST NEVER include tokens or keys in response (OWASP A02)
11. Import extensions: use `.js` suffix for all local imports (ESM)
12. Reuse existing test factories for BLSConfig and HandlerContext
13. Per-reducer pricing rejection uses `F04` ILP code (same as SDK-level insufficient payment)
14. Self-write bypass MUST be consistent with SDK default behavior

## CRITICAL Anti-Patterns (MUST AVOID)

- Do NOT add new npm dependencies for JSON parsing or HTTP -- use Node.js built-ins
- Do NOT implement payment collection or wallet deduction -- that is out of scope (EVM onchain wallets)
- Do NOT modify the SDK's `createPricingValidator` behavior -- it works correctly as-is
- Do NOT hardcode reducer costs in handler.ts -- they MUST come from the fee schedule configuration
- Do NOT expose SPACETIMEDB_TOKEN in the `/fee-schedule` endpoint or any pricing-related logs
- Do NOT break backward compatibility -- when `BLS_FEE_SCHEDULE_PATH` is not set, the BLS must work exactly as before Story 3.3
- Do NOT validate `category` or `frequency` fields strictly on the BLS side -- those are client-side metadata
- Do NOT implement pricing reload at runtime in this story -- fee schedule is loaded once at startup
- Do NOT swallow exceptions in fee schedule loading -- startup failure is the correct behavior for invalid config
- Do NOT use `setTimeout` or async operations in the fee schedule endpoint -- it is synchronous read-only

## Security Considerations (OWASP Top 10)

**A02: Cryptographic Failures**

- `/fee-schedule` endpoint MUST NEVER include SPACETIMEDB_TOKEN, secret keys, or identity information
- Fee schedule file contents are not secrets, but the path to the file should not reveal server directory structure

**A03: Injection**

- Fee schedule file path validated against path traversal (`..` segment rejection)
- File size limited to 1MB to prevent resource exhaustion
- Reducer name in fee schedule validated with same regex as content parser: `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`
- JSON parsing uses `JSON.parse` with no eval or dynamic code execution

**A04: Insecure Design**

- Fee schedule loading failure causes startup failure with clear error (fail-safe)
- Invalid fee schedule data rejects with descriptive error messages
- Per-reducer pricing rejection includes paid amount vs required amount for debugging

**A05: Security Misconfiguration**

- BLS_FEE_SCHEDULE_PATH is optional -- safe default (hardcoded kindPricing) when not configured
- `/fee-schedule` endpoint is read-only and returns only fee data
- No authentication required on fee endpoint (fees are public information, NFR12)

**A09: Security Logging**

- Pricing rejections logged with eventId, truncated pubkey, reducer name, paid amount, required amount
- Self-write bypass logged at debug level (not error)
- NEVER log: secretKey, SPACETIMEDB_TOKEN, event signatures

## FR/NFR Traceability

| Requirement | Coverage | Notes |
|---|---|---|
| FR20 (ILP fee collection) | AC1, AC3 | kindPricing configured in createNode(), SDK rejects underpaid packets with F04; per-reducer pricing adds fine-grained enforcement |
| FR45 (ILP fee schedule configuration) | AC2, AC4 | JSON fee schedule loaded at startup with per-reducer costs; format compatible with client registry; exposed via /fee-schedule endpoint |
| NFR12 (Fee schedules publicly verifiable) | AC4 | /fee-schedule endpoint exposes fee data; format matches client action cost registry |
| NFR17 (Accurate fee accounting under concurrent load) | AC5 | SDK handles payment validation atomically per packet; per-reducer pricing check is stateless (no shared mutable state) |

## Definition of Done

- [x] Fee schedule loader module created with JSON validation and path traversal protection
- [x] `getFeeForReducer()` returns correct cost for known and unknown reducers
- [x] BLSConfig extended with `feeSchedulePath` and `feeSchedule` fields
- [x] `loadConfig()` loads fee schedule from `BLS_FEE_SCHEDULE_PATH` when provided
- [x] Handler enforces per-reducer pricing with F04 rejection for underpaid packets
- [x] Self-write bypass allows node's own pubkey to skip per-reducer pricing
- [x] `/fee-schedule` endpoint returns fee schedule JSON (no tokens, no keys)
- [x] Fee schedule format compatible with `@sigil/client` `ActionCostRegistry`
- [x] All unit tests pass: `pnpm --filter @sigil/bitcraft-bls test:unit`
- [x] Build passes: `pnpm --filter @sigil/bitcraft-bls build` (ESM + CJS + DTS)
- [x] Full regression suite passes: `pnpm test` (all packages green)
- [x] Integration tests created (skipped without Docker)
- [x] Security review: no tokens in fee endpoint, file path validated, file size limited
- [x] No `any` types in new code
- [x] Backward compatible: BLS works without `BLS_FEE_SCHEDULE_PATH`

## Dev Agent Record

**Agent Model Used:** Claude Opus 4.6

**Implementation Plan:**
- Task 1: Implemented `fee-schedule.ts` with `loadFeeSchedule()`, `getFeeForReducer()`, `FeeScheduleError`, and `validateFeeSchedule()` internal helper. Uses Node.js built-in `fs.readFileSync`. Includes path traversal prevention, 1MB file size limit, JSON schema validation.
- Task 2: Extended `BLSConfig` with `feeSchedulePath` and `feeSchedule` fields. Modified `loadConfig()` to read `BLS_FEE_SCHEDULE_PATH`, load/validate fee schedule, and derive `kindPricing[30078]` as minimum cost across all actions and defaultCost.
- Task 3: Extended `createGameActionHandler()` with optional `identityPubkey` parameter. Added per-reducer pricing check after content parsing: self-write bypass for node pubkey, F04 rejection for underpaid packets. Imported `getFeeForReducer` from fee-schedule module.
- Task 4: Added `GET /fee-schedule` endpoint to health server. Added `feeSchedule` to `HealthServerState`. Returns fee schedule JSON or default `{ version: 1, defaultCost: 100, actions: {} }`.
- Task 5: Enabled 44 unit tests across 5 test files (fee-schedule: 15, pricing-config: 11, pricing-enforcement: 8, self-write-bypass: 5, fee-schedule-endpoint: 5), plus 17 AC coverage gap tests (14 original + 3 added in review #2). All pass.
- Task 6: Enabled 5 integration tests in pricing-integration.test.ts (skipped without Docker). fee-schedule-consistency.test.ts (4 tests) was re-classified as unit tests in review #2 (no Docker needed).

**Debug Log:**
- No issues encountered during implementation. All tests passed on first run.
- Tests were pre-written in ATDD red phase with `.skip` -- implementation filled in stubs and enabled tests.

**Completion Notes List:**
1. `fee-schedule.ts`: Full implementation replacing TDD stubs. `loadFeeSchedule()` validates JSON schema (version=1, non-negative finite defaultCost, object actions, non-negative finite action costs), rejects `..` path segments, limits file to 1MB. `getFeeForReducer()` returns action cost or defaultCost, validates reducer name against `REDUCER_NAME_REGEX`.
2. `config.ts`: Added `feeSchedulePath` and `feeSchedule` to `BLSConfig`. `loadConfig()` reads `BLS_FEE_SCHEDULE_PATH`, calls `loadFeeSchedule()`, derives `kindPricing[30078]` as `BigInt(Math.min(defaultCost, ...allActionCosts))`. Backward compatible when env var absent.
3. `handler.ts`: `createGameActionHandler(config, identityPubkey?)` now checks per-reducer pricing after content parsing. Self-write bypass when `ctx.pubkey === identityPubkey`. F04 rejection with message `Insufficient payment for {reducer}: {amount} < {cost}`. Logging: `[BLS] Payment insufficient` for rejections, `[BLS] Self-write bypass` for node pubkey.
4. `health.ts`: Added `feeSchedule?: FeeSchedule` to `HealthServerState`. New `GET /fee-schedule` route returns `{ version, defaultCost, actions }` or `{ version: 1, defaultCost: 100, actions: {} }` when no schedule loaded.
5. `index.ts`: Added fee schedule exports (`loadFeeSchedule`, `getFeeForReducer`, `FeeScheduleError`, types). Updated `main()`: passes `identity.pubkey` to `createGameActionHandler()`, sets `feeSchedule` on `healthState`.
6. All 8 test files enabled (65 unit + 5 integration = 70 Story 3.3 tests). BLS package total: 189 unit tests passed. Full regression: all packages green (832 tests).

## Code Review Record

### Review Pass #1

| Field              | Value                             |
| ------------------ | --------------------------------- |
| **Date**           | 2026-03-13                        |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Review Type**    | Post-implementation code review   |
| **Outcome**        | PASS (all issues resolved)        |

**Issue Counts by Severity:**

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 3     |
| Low       | 4     |
| **Total** | **7** |

**Issues Found & Fixed:**

| ID  | Severity | Description                                                                                     | Resolution                                                                                             |
| --- | -------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| M1  | Medium   | File List missing 2 entries (`ac-coverage-gaps-3-3.test.ts`, `nfr-assessment-3-3.md`)           | FIXED -- Added both files to File List in story doc                                                    |
| M2  | Medium   | `/fee-schedule` default response missing `version` field for consistency                        | FIXED -- Default response now returns `{ version: 1, defaultCost: 100, actions: {} }`                  |
| M3  | Medium   | File size check using `string.length` (character count) instead of `Buffer.byteLength` (bytes)  | FIXED -- Changed to `Buffer.byteLength(content)` for accurate byte-length check                        |
| L1  | Low      | Fee-schedule-endpoint test not expecting `version` in default response                          | FIXED -- Updated test to expect `version: 1` in default response (code/test fix)                       |
| L2  | Low      | Dev Agent Record test counts were stale                                                         | FIXED -- Corrected to 58 unit, 9 integration, 182 total BLS tests (documentation fix)                  |
| L3  | Low      | MAX_FILE_SIZE comment said "bytes" but implementation used character count                       | FIXED -- Corrected comment to match implementation after M3 fix (documentation fix)                     |
| L4  | Low      | Minor documentation accuracy review finding                                                     | No code change needed -- verified as accurate design choice (documentation fix)                         |

**Review Follow-ups:** None -- all issues resolved in this pass.

### Review Pass #2

| Field              | Value                             |
| ------------------ | --------------------------------- |
| **Date**           | 2026-03-13                        |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Review Type**    | Adversarial code review (yolo)    |
| **Outcome**        | PASS (all issues resolved)        |

**Issue Counts by Severity:**

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 1     |
| Low       | 3     |
| **Total** | **4** |

**Issues Found & Fixed:**

| ID  | Severity | Description                                                                                                          | Resolution                                                                                                                                     |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Medium   | `MAX_FILE_SIZE` comment says "characters" but code now uses `Buffer.byteLength()` (bytes) after Review #1 fix M3     | FIXED -- Comment updated to "Maximum file size in bytes (1MB). Compared against Buffer.byteLength()."                                          |
| L1  | Low      | Self-write bypass described as "debug level" in story Task 3 but uses `console.log` (info); project has no `console.debug` convention | ACCEPTED -- Project convention uses `console.log` for info. No `console.debug` exists anywhere in codebase. Test validates `console.log`.      |
| L2  | Low      | `validateFeeSchedule()` did not validate action keys (reducer names) against `REDUCER_NAME_REGEX`, allowing dead config entries | FIXED -- Added action name validation in `validateFeeSchedule()`. Added 3 tests for invalid/valid action names in `ac-coverage-gaps-3-3.test.ts`. |
| L3  | Low      | `fee-schedule-consistency.test.ts` unnecessarily skipped (requires Docker env vars) but tests only read local JSON files; also had wrong `__dirname` path | FIXED -- Removed Docker skip condition; fixed path from `../../../../client/` to `../../../client/`. Tests now run as unit tests (4 tests un-skipped). |

**Review Follow-ups:** None -- all issues resolved in this pass.

### Review Pass #3

| Field              | Value                             |
| ------------------ | --------------------------------- |
| **Date**           | 2026-03-13                        |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Review Type**    | Adversarial code review (yolo) + OWASP security audit |
| **Outcome**        | PASS (all issues resolved)        |

**Issue Counts by Severity:**

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 1     |
| Low       | 3     |
| **Total** | **4** |

**Issues Found & Fixed:**

| ID  | Severity | Description                                                                                                          | Resolution                                                                                                                                     |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Medium   | File List missing `atdd-checklist-3-3.md` -- file appears in git diff but not in story File List                     | FIXED -- Added `_bmad-output/test-artifacts/atdd-checklist-3-3.md` to File List Created section                                                |
| L1  | Low      | Dev Agent Record per-story test counts stale: says "58 unit + 9 integration" but actual is 65 unit + 5 integration   | FIXED -- Updated Completion Notes and Task 5/6 descriptions to reflect accurate counts (65 unit + 5 integration = 70 Story 3.3 tests)          |
| L2  | Low      | pricing-integration.test.ts has 5 tests but Task 6 spec says "~6 tests"; SDK-level test removed with comment         | ACCEPTED -- The "~6" was approximate; removal is documented in code comment (lines 100-102). Actual count already correct in test count fixes.  |
| L3  | Low      | `getFeeForReducer` silently returns defaultCost for invalid reducer names instead of throwing                         | ACCEPTED -- Defensive design choice. Content parser validates upstream. Double-validation would add complexity without benefit.                  |

**OWASP Top 10 Security Audit Results:**

| OWASP Category | Status | Notes |
| --- | --- | --- |
| A01: Broken Access Control | PASS | Fee endpoint is read-only, no auth required (fees are public). Self-write bypass uses strict equality. |
| A02: Cryptographic Failures | PASS | No tokens, keys, or secrets in `/fee-schedule` response. Verified via grep and test assertions. |
| A03: Injection | PASS | Path traversal prevention (`..` rejection), 1MB file size limit, `REDUCER_NAME_REGEX` on action keys and names, `JSON.parse` only (no eval/dynamic code). |
| A04: Insecure Design | PASS | Fail-safe startup on invalid config, descriptive error messages, two-level pricing enforcement. |
| A05: Security Misconfiguration | PASS | Optional `BLS_FEE_SCHEDULE_PATH` with safe default. Health server binds to 127.0.0.1 by default. |
| A06: Vulnerable Components | PASS | No new dependencies added. Uses Node.js built-in `fs` and `http`. |
| A07: Auth Failures | N/A | No authentication in this story (fee endpoint is intentionally public). |
| A08: Software/Data Integrity | PASS | Fee schedule loaded once at startup (no runtime reload). JSON schema validated. |
| A09: Security Logging | PASS | Pricing rejections logged with context. Self-write bypass logged. Never logs tokens or keys. |
| A10: SSRF | N/A | No outbound URL requests in fee schedule module. |

**Review Follow-ups:** None -- all issues resolved in this pass.

## File List

**Created:**
- `packages/bitcraft-bls/src/__tests__/ac-coverage-gaps-3-3.test.ts` -- 17 AC coverage gap tests (path traversal, non-finite costs, concurrent pricing, case-sensitive self-write bypass, action name validation)
- `_bmad-output/test-artifacts/nfr-assessment-3-3.md` -- NFR assessment for Story 3.3
- `_bmad-output/test-artifacts/atdd-checklist-3-3.md` -- ATDD checklist for Story 3.3

**Modified:**
- `packages/bitcraft-bls/src/fee-schedule.ts` -- Full implementation; review fixes: accurate byte-length check via Buffer.byteLength, corrected MAX_FILE_SIZE comment, added action name validation against REDUCER_NAME_REGEX
- `packages/bitcraft-bls/src/config.ts` -- Added feeSchedulePath, feeSchedule, loadFeeSchedule integration
- `packages/bitcraft-bls/src/handler.ts` -- Added per-reducer pricing, self-write bypass, identityPubkey param
- `packages/bitcraft-bls/src/health.ts` -- Added /fee-schedule endpoint, feeSchedule in HealthServerState; review fix: default response includes `version: 1`
- `packages/bitcraft-bls/src/index.ts` -- Added fee schedule exports, updated main() call sites
- `packages/bitcraft-bls/src/__tests__/fee-schedule.test.ts` -- Enabled 15 tests (removed .skip)
- `packages/bitcraft-bls/src/__tests__/pricing-config.test.ts` -- Enabled 11 tests (removed .skip)
- `packages/bitcraft-bls/src/__tests__/pricing-enforcement.test.ts` -- Enabled 8 tests (removed .skip)
- `packages/bitcraft-bls/src/__tests__/self-write-bypass.test.ts` -- Enabled 5 tests (removed .skip)
- `packages/bitcraft-bls/src/__tests__/fee-schedule-endpoint.test.ts` -- Enabled 5 tests; review fix: test now expects `version: 1` in default response
- `packages/bitcraft-bls/src/__tests__/pricing-integration.test.ts` -- Enabled 5 integration tests (removed .skip)
- `packages/bitcraft-bls/src/__tests__/fee-schedule-consistency.test.ts` -- 4 cross-package tests; review fix: removed unnecessary Docker skip condition, fixed __dirname path resolution
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Updated story-3.3 status to done
- `_bmad-output/implementation-artifacts/3-3-pricing-configuration-and-fee-schedule.md` -- This story file

**Deleted:**
- (none)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-13 | Story 3.3 implementation complete: fee schedule loader, BLS config integration, per-reducer pricing enforcement, self-write bypass, /fee-schedule endpoint, 58 unit tests + 9 integration tests. | Claude Opus 4.6 |
| 2026-03-13 | Code review #1 (adversarial): 0 critical, 0 high, 3 medium, 4 low issues found. Fixed: (1) /fee-schedule default response now includes `version: 1` for consistency; (2) file size check uses Buffer.byteLength for accurate byte counting; (3) corrected MAX_FILE_SIZE comment from "bytes" to "characters"; (4) fee-schedule-endpoint test updated to expect version in default response; (5) File List updated to include 2 missing files (ac-coverage-gaps-3-3.test.ts, nfr-assessment-3-3.md); (6) Dev Agent Record test counts corrected (58 unit, 9 integration, 182 total BLS tests). All tests pass. Status set to done. | Claude Opus 4.6 (reviewer) |
| 2026-03-13 | Code review #2 (adversarial, yolo): 0 critical, 0 high, 1 medium, 3 low issues found. Fixed: (1) MAX_FILE_SIZE comment corrected from "characters" to "bytes" (was stale after review #1 M3 fix); (2) added action name validation against REDUCER_NAME_REGEX in validateFeeSchedule() with 3 new tests; (3) fee-schedule-consistency tests un-skipped from Docker requirement, fixed broken __dirname path. Total BLS unit tests: 189. All tests pass. | Claude Opus 4.6 (reviewer) |
| 2026-03-13 | Code review #3 (adversarial, yolo + OWASP security audit): 0 critical, 0 high, 1 medium, 3 low issues found. Fixed: (1) File List missing atdd-checklist-3-3.md; (2) stale per-story test counts in Dev Agent Record corrected to 65 unit + 5 integration = 70 Story 3.3 tests. OWASP Top 10 audit: all 8 applicable categories PASS. Total BLS: 189 unit tests, 832 full suite. All tests pass. | Claude Opus 4.6 (reviewer) |
