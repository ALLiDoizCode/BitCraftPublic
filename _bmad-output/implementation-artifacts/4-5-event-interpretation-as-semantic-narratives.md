# Story 4.5: Event Interpretation as Semantic Narratives

Status: done

<!--
Validation Status: VALIDATED
Review Type: Adversarial Review via /bmad-review-adversarial-general (2026-03-15)
Reviewer: Claude Opus 4.6
BMAD Standards Compliance: VERIFIED (2026-03-15)
- Story structure: Complete (all required sections present, including Change Log and Code Review Record templates)
- Acceptance criteria: 4 ACs with Given/When/Then format, FR traceability
- Task breakdown: 8 tasks with detailed subtasks, AC mapping on each task
- FR traceability: FR9 -> AC1-AC4, FR39 partial -> AC1
- Dependencies: Documented (3 epics + 4 stories required complete, 0 external, 2 stories blocked)
- Technical design: Comprehensive with architecture decisions, data flow, security review
- Security review: OWASP Top 10 coverage complete (A01-A06, A09)
Issues Found & Fixed: 12 (see Change Log and review record below)
Ready for Implementation: YES
-->

## Story

As a researcher,
I want raw SpacetimeDB table update events interpreted as human-readable semantic narratives,
So that agents and researchers can understand what happened in the game world meaningfully.

## Dependencies

**Required Complete (all done):**

- **Epic 1** (Project Foundation) -- monorepo structure, SpacetimeDB connection, static data loader (Story 1.5)
- **Epic 2** (Action Execution & Payment Pipeline) -- Crosstown relay subscriptions (Story 2.1)
- **Epic 3** (BitCraft BLS Game Action Handler) -- BLS handler consuming `{ reducer, args }` payloads (Story 3.2)
- **Story 4.1** (Skill File Format & Parser) -- `Skill` types, `SkillSubscription` (table subscription declarations)
- **Story 4.2** (Agent.md Configuration & Skill Selection) -- `AgentConfig`, `ResolvedAgentConfig`
- **Story 4.3** (Configuration Validation Against SpacetimeDB) -- `ModuleInfo`, `ModuleReducerInfo` (table metadata)
- **Story 4.4** (Budget Tracking & Limits) -- `BudgetTracker`, `BudgetExceededError` (budget events to interpret)

**External Dependencies:**

- None. This is pure client-side transformation logic with no external service dependencies.
- Static data lookup uses the existing `StaticDataLoader` (Story 1.5) which is already loaded in the client.
- SpacetimeDB subscription events (`RowInsertedEvent`, `RowUpdatedEvent`, `RowDeletedEvent`) are already emitted by `SubscriptionManager` (Story 1.4).
- No new npm dependencies required.
- No Docker required for any tests.

**Blocks:**

- Story 4.6 (Structured Decision Logging) -- decision log entries include `semanticEvents` field from the event interpreter
- Story 8.2 (Agent Observation Mode in TUI) -- observation panel shows semantic events from this interpreter

## Acceptance Criteria

1. **Table update interpretation (AC1)** (FR9)
   - **Given** a raw SpacetimeDB table update event (row insert, update, or delete)
   - **When** the event interpreter processes it
   - **Then** a semantic narrative is produced describing what happened in game terms
   - **And** the narrative includes: event type, affected entity, key state changes, and timestamp

2. **Player display name resolution (AC2)** (FR9)
   - **Given** a player position table update
   - **When** interpreted
   - **Then** the narrative reads like: "Player [pubkey] moved from hex (x1,y1) to hex (x2,y2)"
   - **And** includes the player's display name if available from static data

3. **Multi-update correlation (AC3)** (FR9)
   - **Given** multiple rapid table updates from a single reducer call
   - **When** interpreted
   - **Then** related updates are correlated into a single coherent narrative where possible
   - **And** the original raw events remain accessible alongside the narrative

4. **Unmapped table fallback (AC4)** (FR9)
   - **Given** an unknown or unmapped table update
   - **When** interpreted
   - **Then** a generic narrative is produced: "Table [name] row [id] [inserted/updated/deleted]"
   - **And** no error is thrown -- graceful degradation for unmapped events

## Tasks / Subtasks

### Task 1: Define event interpreter types (AC: 1, 2, 3, 4)

- [x] Create `packages/client/src/agent/event-interpreter-types.ts`:
  - Export `TableUpdateEvent` interface:
    - `table: string` -- SpacetimeDB table name
    - `type: 'insert' | 'update' | 'delete'` -- update operation type
    - `timestamp: number` -- event timestamp (Date.now())
    - `oldRow?: Record<string, unknown>` -- previous row state (for updates and deletes)
    - `newRow?: Record<string, unknown>` -- new row state (for inserts and updates)
  - Export `EventCategory` type: `'movement' | 'inventory' | 'resource' | 'combat' | 'social' | 'building' | 'environment' | 'unknown'`
  - Export `SemanticNarrative` interface:
    - `timestamp: number` -- when the event occurred
    - `category: EventCategory` -- categorized event type
    - `narrative: string` -- human-readable description (e.g., "Player Alice moved from hex (100,200) to hex (110,200)")
    - `entityId?: string` -- primary entity affected (player pubkey, resource node ID, etc.)
    - `entityName?: string` -- resolved display name (from static data) or truncated pubkey
    - `tableName: string` -- source table for the event
    - `operationType: 'insert' | 'update' | 'delete'` -- original operation
    - `stateChanges?: Record<string, { old: unknown; new: unknown }>` -- key state changes for updates
    - `rawEvent: TableUpdateEvent` -- original raw event preserved
  - Export `CorrelatedNarrative` interface:
    - `timestamp: number` -- timestamp of the correlated group
    - `category: EventCategory` -- dominant category
    - `narrative: string` -- combined narrative (e.g., "Player Alice harvested Wood from Oak Tree")
    - `events: SemanticNarrative[]` -- individual events in the correlation group
    - `correlationId: string` -- unique ID for the correlation group
  - Export `TableInterpreter` interface:
    - `tableName: string` -- which table this interpreter handles
    - `category: EventCategory` -- default event category
    - `interpret(event: TableUpdateEvent, nameResolver: NameResolver): SemanticNarrative` -- produce narrative from raw event
  - Export `NameResolver` type: `(table: string, id: unknown) => string | undefined` -- function to resolve entity IDs to display names via static data
  - Export `EventInterpreterConfig` interface:
    - `correlationWindowMs: number` -- time window for correlating related events (default: 100ms)
    - `nameResolver?: NameResolver` -- optional name resolver function (defaults to truncated pubkey/ID fallback)

### Task 2: Implement table-specific interpreters (AC: 1, 2)

- [x] Create `packages/client/src/agent/table-interpreters.ts`:
  - Export `createPlayerPositionInterpreter(): TableInterpreter`:
    - Handles `player_state` or `entity_position` table updates
    - Category: `'movement'`
    - Insert: "Player [name] appeared at hex ([x],[y])"
    - Update: "Player [name] moved from hex ([oldX],[oldY]) to hex ([newX],[newY])"
    - Delete: "Player [name] left the area"
    - Resolves player display name via `nameResolver` using pubkey or player_id
    - Falls back to truncated pubkey (first 8 chars + "...") if no display name
  - Export `createInventoryInterpreter(): TableInterpreter`:
    - Handles `inventory` table updates
    - Category: `'inventory'`
    - Insert: "Player [name] received [item_name] x[quantity]"
    - Update: "Player [name] [item_name] quantity changed from [old] to [new]"
    - Delete: "Player [name] lost [item_name] x[quantity]"
    - Resolves item names from `item_desc` static data table
  - Export `createResourceInterpreter(): TableInterpreter`:
    - Handles `resource_spawn` or other resource-related runtime table updates (NOT `resource_spawn_desc` which is a static data table loaded once and not subscribed for updates)
    - Category: `'resource'`
    - Insert: "Resource node [type] appeared at hex ([x],[y])"
    - Update: "Resource node [type] updated"
    - Delete: "Resource node [id] depleted"
    - Resolves resource type names via `nameResolver` using the `resource_spawn_desc` static data table
  - Export `createGenericInterpreter(tableName: string): TableInterpreter`:
    - Default fallback for unmapped tables
    - Category: `'unknown'`
    - Produces: "Table [name] row [id] [inserted/updated/deleted]"
    - Extracts row ID from common field names (id, entity_id, player_id) -- same pattern as `TableAccessor.extractRowId()`
  - Export `DEFAULT_TABLE_INTERPRETERS: Map<string, TableInterpreter>`:
    - Pre-populated map of table name -> interpreter for known tables
    - Initial set: player_state, entity_position, inventory, resource_spawn
    - Extensible: researchers can add custom interpreters

### Task 3: Implement the EventInterpreter class (AC: 1, 2, 3, 4)

- [x] Create `packages/client/src/agent/event-interpreter.ts`:
  - Export `EventInterpreter` class:
    - Constructor: `(config?: Partial<EventInterpreterConfig>)`
    - Stores config with defaults: `correlationWindowMs = 100`
    - Maintains internal `Map<string, TableInterpreter>` of registered interpreters
    - Initializes with `DEFAULT_TABLE_INTERPRETERS` from Task 2
    - `interpret(event: TableUpdateEvent): SemanticNarrative`:
      - Looks up registered interpreter for `event.table`
      - If found, delegates to `interpreter.interpret(event, this.nameResolver)`
      - If not found, uses `createGenericInterpreter(event.table)` as fallback (AC4)
      - Returns the `SemanticNarrative` with raw event preserved
    - `interpretBatch(events: TableUpdateEvent[]): SemanticNarrative[]`:
      - Interprets all events and returns array of narratives
    - `interpretAndCorrelate(events: TableUpdateEvent[]): (SemanticNarrative | CorrelatedNarrative)[]`:
      - Interprets all events
      - Groups events within `correlationWindowMs` that share the same non-undefined `entityId`
      - Events with `entityId === undefined` are NEVER grouped (remain as individual `SemanticNarrative`)
      - For correlated groups (2+ events), produces a `CorrelatedNarrative` with combined narrative
      - Single events remain as `SemanticNarrative`
      - Raw events accessible via `CorrelatedNarrative.events`
    - `registerInterpreter(interpreter: TableInterpreter): void`:
      - Adds or replaces an interpreter for a specific table
      - Validates `interpreter.tableName` is non-empty
    - `unregisterInterpreter(tableName: string): boolean`:
      - Removes interpreter for given table (reverts to generic fallback)
      - Returns `true` if an interpreter was removed, `false` if table had no registered interpreter (no-op, no error)
    - `setNameResolver(resolver: NameResolver): void`:
      - Sets the name resolver function for display name lookups
    - `get registeredTables(): string[]`:
      - Returns list of table names with registered interpreters
    - Private `nameResolver: NameResolver`:
      - Default implementation: returns truncated ID string
      - Can be overridden via `setNameResolver()` or constructor config
  - Export `createEventInterpreterWithStaticData(staticDataLoader: { get: (table: string, id: string | number) => Record<string, unknown> | undefined }): EventInterpreter`:
    - Factory function that creates an EventInterpreter wired to the StaticDataLoader
    - Creates a `NameResolver` that:
      1. Validates `id` is `string | number` before calling `staticDataLoader.get()` (return `undefined` otherwise)
      2. Wraps `staticDataLoader.get()` in try-catch (the real `StaticDataLoader.get()` throws `Error` if data not loaded and `TypeError` if table doesn't exist in cache -- the resolver MUST catch these and return `undefined`)
      3. Maps event table names to their corresponding `_desc` lookup tables (e.g., `player_state` -> `player_desc`, `inventory` -> `item_desc`) since `StaticDataLoader.get()` validates that table names end with `_desc` and throws `TypeError` otherwise
      4. Tries known fields: `displayName`, `name`, `label`, `title` from the returned row
      5. Returns the first non-empty string found
      6. Falls back to truncated ID (`String(id).slice(0, 8) + "..."`) if no name available or on any error

### Task 4: Write event interpreter unit tests (AC: 1-4)

Following the test design in `_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.5.

- [x] Create `packages/client/src/agent/__tests__/event-interpreter.test.ts` (~15 tests):
  - `interpret()` with player position insert -> narrative contains "appeared at hex"
  - `interpret()` with player position update -> narrative contains "moved from hex ... to hex"
  - `interpret()` with player position delete -> narrative contains "left the area"
  - `interpret()` with inventory insert -> narrative contains "received [item]"
  - `interpret()` with inventory update -> narrative contains "quantity changed"
  - `interpret()` with inventory delete -> narrative contains "lost [item]"
  - `interpret()` with resource insert -> narrative about resource appearance
  - `interpret()` with resource delete -> narrative contains "depleted"
  - `interpret()` sets correct `category` for each mapped table
  - `interpret()` includes `timestamp` in returned narrative
  - `interpret()` preserves `rawEvent` reference in narrative
  - `interpret()` includes `operationType` matching the event type
  - `interpret()` includes `stateChanges` for update events
  - `interpret()` with null/undefined fields in row -> graceful handling, no crash
  - `interpret()` with empty row object -> produces narrative without errors

- [x] Create `packages/client/src/agent/__tests__/narrative-format.test.ts` (~8 tests):
  - Narrative string contains event type description (insert/update/delete)
  - Narrative string contains affected entity reference (ID or name)
  - Narrative string contains key state changes for updates
  - Narrative string contains timestamp information
  - Player movement narrative format matches expected: "Player [name] moved from hex (x1,y1) to hex (x2,y2)"
  - Inventory narrative format matches expected: "Player [name] received [item] x[qty]"
  - Generic narrative format matches expected: "Table [name] row [id] [inserted/updated/deleted]"
  - Narrative is human-readable (no raw JSON, no object references)

- [x] Create `packages/client/src/agent/__tests__/event-correlation.test.ts` (~9 tests):
  - Two events within correlation window with same entityId -> single `CorrelatedNarrative`
  - Two events outside correlation window -> two separate `SemanticNarrative`s
  - Two events with different entityIds -> two separate narratives (no correlation)
  - Harvest action (resource delete + inventory insert) -> correlated narrative "harvested"
  - `CorrelatedNarrative.events` contains both original `SemanticNarrative`s
  - `CorrelatedNarrative.correlationId` is unique per group
  - Two events with `entityId === undefined` within window -> NOT correlated (remain separate)
  - Single event -> returned as `SemanticNarrative` (not wrapped in correlation)
  - Empty event batch -> empty result array

- [x] Create `packages/client/src/agent/__tests__/event-fallback.test.ts` (~5 tests):
  - Unknown table name -> generic narrative produced ("Table [name] row [id] [op]")
  - Unknown table -> no error thrown (graceful degradation)
  - Unknown table -> `category` is `'unknown'`
  - Unknown table with no ID field in row -> generic narrative with "[unknown]" as ID
  - After `unregisterInterpreter()` -> falls back to generic for previously mapped table

- [x] Create `packages/client/src/agent/__tests__/event-static-data.test.ts` (~7 tests):
  - Player pubkey with display name in static data -> narrative uses display name
  - Player pubkey without display name in static data -> narrative uses truncated pubkey
  - Item ID with name in `item_desc` -> narrative uses item name
  - `createEventInterpreterWithStaticData()` correctly wires up name resolver
  - `createEventInterpreterWithStaticData()` resolver catches StaticDataLoader errors gracefully (e.g., data not loaded) -> returns truncated ID, no crash
  - `createEventInterpreterWithStaticData()` resolver maps event table name to `_desc` table (e.g., `player_state` -> `player_desc`)
  - `createEventInterpreterWithStaticData()` resolver handles non-string/number id -> returns `undefined`, no crash

### Task 5: Write integration-style tests (AC: 1, 3)

- [x] Create `packages/client/src/agent/__tests__/event-interpreter-integration.test.ts` (~5 tests):
  - Simulate complete interpretation pipeline:
    - Create `EventInterpreter` with mock name resolver
    - Interpret a batch of mixed table updates (player move + inventory change + unknown table)
    - Verify each produces correct narrative type and format
  - Simulate harvest correlation:
    - Resource delete event + inventory insert event within 100ms
    - Verify correlated narrative produced
    - Verify raw events accessible
  - Custom interpreter registration:
    - Register custom interpreter for a new table
    - Verify it takes precedence over generic fallback
  - Name resolver integration:
    - Create interpreter with mock static data resolver
    - Verify display names appear in narratives when available
    - Verify truncated pubkeys used as fallback

### Task 6: Export public API and update barrel files (AC: 1-4)

- [x] Update `packages/client/src/agent/index.ts`:
  - Add re-exports for all new types: `TableUpdateEvent`, `EventCategory`, `SemanticNarrative`, `CorrelatedNarrative`, `TableInterpreter`, `NameResolver`, `EventInterpreterConfig`
  - Add re-exports for classes: `EventInterpreter`
  - Add re-exports for factories: `createEventInterpreterWithStaticData`, `createPlayerPositionInterpreter`, `createInventoryInterpreter`, `createResourceInterpreter`, `createGenericInterpreter`
  - Add re-exports for constants: `DEFAULT_TABLE_INTERPRETERS`
- [x] Update `packages/client/src/index.ts`:
  - Add Story 4.5 export block for event interpreter types, classes, and factories
- [x] Verify build: `pnpm --filter @sigil/client build` -- produces dist/ with all new exports
- [x] Verify regression: `pnpm test` -- all existing tests still pass

### Task 7: OWASP security review (AC: 1-4)

- [x] Verify OWASP Top 10 compliance:
  - **A01: Broken Access Control (N/A):** Event interpreter is read-only transformation logic, no access control.
  - **A02: Cryptographic Failures (N/A):** No crypto in this story.
  - **A03: Injection (LOW):** Table names from SpacetimeDB events are validated by `SubscriptionManager` upstream. Row data is treated as opaque `Record<string, unknown>` -- never evaluated as code. No `eval`, `Function()`, or string-based execution. Property access on row objects uses bracket notation with known keys only.
  - **A04: Insecure Design (LOW):** Graceful degradation for unknown tables (AC4). No silent failures -- always produces a narrative.
  - **A05: Security Misconfiguration (N/A):** No configurable security settings.
  - **A06: Vulnerable Components (N/A):** No new npm dependencies.
  - **A09: Security Logging (LOW):** Event interpreter is a logging input (feeds into Story 4.6 decision logger). No sensitive data in narratives (pubkeys are truncated in display names).

### Task 8: Validate against checklist (AC: 1-4)

- [x] Run validation against `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- [x] Verify all ACs have test coverage
- [x] Verify all tasks map to at least one AC
- [x] Verify DOD checklist passes

## Dev Notes

### Architecture Context

This is the **fifth story in Epic 4** -- it implements the **EventInterpreter**, the semantic interpretation layer of the agent pipeline. (Note: The Five-Layer Cognition Architecture in `architecture/5-five-layer-cognition-architecture.md` was SUPERSEDED by the simpler Claude agent model -- see CLAUDE.md. However, the EventInterpreter concept from Layer 2 survives as a standalone transformation module.) The EventInterpreter transforms raw SpacetimeDB table update events (row inserts, updates, deletes) into human-readable semantic narratives. This is a pure transformation layer with no side effects -- it consumes `RowInsertedEvent`, `RowUpdatedEvent`, and `RowDeletedEvent` from the `SubscriptionManager` and produces `SemanticNarrative` objects.

**Position in the agent core loop (from architecture doc `6-agent-core-loop.md`):**

```
1. PERCEIVE — collect raw updates (SubscriptionManager events)
2. INTERPRET — raw data -> semantic events (THIS STORY - EventInterpreter)
3. REMEMBER — store important events (Phase 2, Epic 9)
4. DETECT — available actions (Phase 2, Epic 9)
5. DECIDE — choose action (Story 4.6 logs the decision)
6. ACT — execute via client.publish()
7. LOG — record everything (Story 4.6)
```

**Key design principle:** The EventInterpreter is a standalone transformation module. It does NOT subscribe to SpacetimeDB events directly. Instead, the agent runtime passes raw events to it for interpretation. This keeps the interpreter testable (pure input -> output) and composable (any consumer can use it).

**Integration with architecture interfaces (`architecture/5-five-layer-cognition-architecture.md`):**

The architecture defines a `SemanticEvent` interface (with `importance: number`, `entities: EntityRef[]`, `category` enum). Our `SemanticNarrative` is the concrete MVP implementation, deliberately simplified:
- Architecture has `importance: number` (1-10) -- deferred to Phase 2 (Epic 9 Memory System). `SemanticNarrative` does NOT include an importance field.
- Architecture has `entities: EntityRef[]` (array of typed entity references) -- simplified to flat `entityId?: string` + `entityName?: string` (single entity per narrative). This is an intentional MVP scoping decision; multi-entity references can be added in Phase 2.
- Architecture has `category` enum with values `'combat' | 'movement' | 'resource' | 'social' | 'building' | 'environment'` -- we use `EventCategory` type with same values plus `'inventory'` and `'unknown'`

### Data Flow

```
SubscriptionManager events (Story 1.4)
  -> RowInsertedEvent | RowUpdatedEvent | RowDeletedEvent
    -> EventInterpreter.interpret() converts to TableUpdateEvent
      -> TableInterpreter.interpret() produces SemanticNarrative
        -> Optional: interpretAndCorrelate() groups related events
          -> SemanticNarrative | CorrelatedNarrative consumed by:
             - Decision Logger (Story 4.6)
             - Agent Observation Mode (Story 8.2)
             - MCP Resources (Epic 6)
```

### SpacetimeDB Event Format (Input)

The EventInterpreter consumes events emitted by `SubscriptionManager` (from `packages/client/src/spacetimedb/subscriptions.ts`):

```typescript
// From subscriptions.ts
interface RowInsertedEvent {
  tableName: string;
  row: any;
}

interface RowUpdatedEvent {
  tableName: string;
  oldRow: any;
  newRow: any;
}

interface RowDeletedEvent {
  tableName: string;
  row: any;
}
```

The `TableUpdateEvent` type normalizes these into a single interface:

```typescript
interface TableUpdateEvent {
  table: string;          // from event.tableName
  type: 'insert' | 'update' | 'delete';
  timestamp: number;      // Date.now() when event was received
  oldRow?: Record<string, unknown>;  // RowUpdatedEvent.oldRow or RowDeletedEvent.row
  newRow?: Record<string, unknown>;  // RowInsertedEvent.row or RowUpdatedEvent.newRow
}
```

### Static Data Lookup for Display Names (AC2)

The `StaticDataLoader` (from Story 1.5) provides display name resolution:

```typescript
// StaticDataLoader API (packages/client/src/spacetimedb/static-data-loader.ts)
// Signature: get<T>(tableName: string, id: string | number): T | undefined
// IMPORTANT: tableName MUST end with '_desc' -- throws TypeError otherwise
// IMPORTANT: throws Error if StaticDataLoader.loadingState !== 'loaded'
// IMPORTANT: throws TypeError if table doesn't exist in cache
staticDataLoader.get('item_desc', itemId);     // Returns { name: "Iron Ore", ... } or undefined
staticDataLoader.get('player_desc', playerId); // Returns { displayName: "Alice", ... } or undefined
```

The `NameResolver` type abstracts this:
```typescript
type NameResolver = (table: string, id: unknown) => string | undefined;
```

The `NameResolver` uses `unknown` for `id` because interpreters extract IDs from row data as `unknown`. The `createEventInterpreterWithStaticData()` factory MUST guard `id` is `string | number` before calling `staticDataLoader.get()`.

**Table name mapping requirement:** Event table names (e.g., `player_state`, `inventory`) do NOT end in `_desc` and cannot be passed directly to `StaticDataLoader.get()`. The factory must maintain a mapping from event table names to their corresponding static data lookup tables:
- `player_state` -> `player_desc` (for player display names)
- `inventory` -> `item_desc` (for item names)
- `resource_spawn` -> `resource_spawn_desc` (for resource type names)

`createEventInterpreterWithStaticData()` creates a resolver that:
1. Maps the event `table` name to its `_desc` counterpart for lookup
2. Validates `id` is `string | number` (returns `undefined` if not)
3. Wraps `staticDataLoader.get()` in try-catch (catches `Error` for unloaded state and `TypeError` for missing tables -- returns `undefined` on any error)
4. Looks for display name in known fields: `displayName`, `name`, `label`, `title`
5. Returns the first non-empty string found
6. Falls back to truncated ID (`String(id).slice(0, 8) + "..."`) if no name available or on any error

### Multi-Update Correlation (AC3)

Some reducer calls produce multiple table updates simultaneously (e.g., harvesting produces both a resource depletion and an inventory addition). The correlation engine:

1. Collects all events within a `correlationWindowMs` (default: 100ms) time window
2. Groups events that share the same non-undefined `entityId` (player pubkey or entity ID)
3. **Events with `entityId === undefined` are NEVER correlated** -- they remain as individual `SemanticNarrative` objects (prevents false grouping of unrelated events)
4. For correlated groups (2+ events with same entityId), produces a combined `CorrelatedNarrative`
5. Individual `SemanticNarrative` objects remain accessible via `CorrelatedNarrative.events`

**Cross-table correlation:** For correlation to work across tables (e.g., resource delete + inventory insert during harvesting), both interpreters must extract the same `entityId` value. The convention is: all interpreters should extract the **player pubkey or player_id** as `entityId` when the event involves a player action. Resource interpreters should use the player ID (from row fields like `owner_id`, `player_id`) rather than the resource node ID.

**Design trade-off:** Correlation is time-based, not causally linked. SpacetimeDB does not provide transaction IDs that link related table updates from a single reducer call. The time window is a best-effort heuristic. The 100ms default is based on the assumption that related updates from a single reducer call arrive within the same event loop tick or very close to it.

**Risk (R4-004):** Complex multi-table updates may not correlate correctly if they arrive outside the time window or involve different entities. This is mitigated by graceful degradation -- uncorrelated events still produce individual narratives.

### Extensibility Pattern

The interpreter is designed to be extensible. Game-specific knowledge is encapsulated in `TableInterpreter` implementations:

```typescript
// Register a custom interpreter for a game-specific table
interpreter.registerInterpreter({
  tableName: 'crafting_queue',
  category: 'building',
  interpret(event, nameResolver) {
    // Custom interpretation logic
    return { narrative: '...', ... };
  },
});
```

This pattern allows:
- Epic 5 (BitCraft Game Analysis) to add BitCraft-specific interpreters after analyzing the server
- Researchers to add custom interpreters for tables they're interested in
- Epic 12 (World Extensibility) to define interpreters for new game worlds

### Project Structure Notes

All new code goes in `packages/client/src/agent/` (extending Stories 4.1-4.4):

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
  event-interpreter-types.ts        # NEW: TableUpdateEvent, SemanticNarrative, CorrelatedNarrative, etc.
  table-interpreters.ts             # NEW: Table-specific interpreters + DEFAULT_TABLE_INTERPRETERS
  event-interpreter.ts              # NEW: EventInterpreter class, createEventInterpreterWithStaticData
  index.ts                          # Updated: re-exports for new modules
  __tests__/
    event-interpreter.test.ts       # NEW: ~15 tests
    narrative-format.test.ts        # NEW: ~8 tests
    event-correlation.test.ts       # NEW: ~9 tests
    event-fallback.test.ts          # NEW: ~5 tests
    event-static-data.test.ts       # NEW: ~7 tests
    event-interpreter-integration.test.ts  # NEW: ~5 tests
```

### Error Patterns

This story follows a different error pattern from Stories 4.1-4.4. The EventInterpreter does NOT throw errors during interpretation (AC4 requires graceful degradation). Instead:

- Unknown tables produce generic narratives (no errors)
- Malformed row data produces best-effort narratives with "[unknown]" placeholders
- Null/undefined values in rows are handled gracefully (optional chaining, fallback strings)

The only validation error is in `registerInterpreter()` which rejects empty table names:
- Throws `Error('TableInterpreter tableName cannot be empty')` -- simple validation, not a typed error class

### Previous Story Intelligence (from Story 4.4)

Key patterns and decisions from Story 4.4 that MUST be followed:

1. **File naming:** kebab-case (e.g., `event-interpreter.ts`, not `eventInterpreter.ts`)
2. **Import extensions:** `.js` suffix for all local imports (ESM compatibility with tsup)
3. **No `any` types:** Use `unknown` or specific types (project convention since Epic 1)
4. **Barrel exports:** `index.ts` per module for public API surface
5. **Co-located tests:** `__tests__/` directory adjacent to source, vitest framework
6. **vitest globals:true:** Tests use vitest globals (`describe`, `it`, `expect` without import)
7. **Commit format:** `feat(4-5): ...` for implementation
8. **JSDoc module comments:** Each source file must have a JSDoc `@module` comment header
9. **No Docker required:** All tests are unit tests with mock data
10. **EventEmitter pattern:** NOT used in this story (EventInterpreter is a stateless transformer, not an event source). This is a deliberate design choice -- the interpreter takes input and returns output, it does not emit events itself.

### Security Considerations (OWASP Top 10)

**A01: Broken Access Control (N/A)**
- Event interpreter is read-only transformation logic. No access control needed.

**A02: Cryptographic Failures (N/A)**
- No crypto in this story.

**A03: Injection (LOW relevance)**
- Row data from SpacetimeDB is treated as opaque `Record<string, unknown>`.
- Property access uses bracket notation with known key names only (`row['x']`, `row['y']`).
- No `eval()`, `Function()`, template literals with user data, or string-based code execution.
- Table names validated upstream by `SubscriptionManager` (alphanumeric + underscores only).
- Narrative strings are constructed with template literals using sanitized field values (no HTML, no script injection context).

**A04: Insecure Design (LOW relevance)**
- Graceful degradation for unmapped tables (AC4). Always produces output, never throws.
- Truncated pubkeys in narratives prevent full pubkey exposure in logs.

**A05: Security Misconfiguration (N/A)**
- No configurable security settings. Default behavior is safe.

**A06: Vulnerable Components (N/A)**
- No new npm dependencies.

**A09: Security Logging (LOW relevance)**
- Event interpreter IS a logging input (feeds Story 4.6 decision logger).
- Pubkeys are truncated in display names to reduce exposure in logs.

### FR/NFR Traceability

| Requirement | Coverage | Notes |
| --- | --- | --- |
| FR9 (Event interpretation as semantic narratives) | AC1, AC2, AC3, AC4 | Full interpretation lifecycle: single events, display names, correlation, fallback |
| FR39 (Structured decision logs - partial) | AC1 (partial) | Semantic narratives feed into decision log `semanticEvents` field (Story 4.6 consumes) |
| NFR7 (Parsing/validation < 1s) | N/A direct | Event interpretation is per-event (< 10ms design target), not batch parsing |

### Test Design Reference

The comprehensive test design is documented in:
`_bmad-output/planning-artifacts/test-design-epic-4.md` Section 2.5

Target: ~72 tests (all unit, no integration). No Docker required.

**Test file mapping to test design document (Section 2.5):**
- `event-interpreter.test.ts` (28) -- maps to "event-interpreter.test.ts" (15) + 13 added (entity_position table, resource update, stateChanges edge cases, DEFAULT_TABLE_INTERPRETERS, registeredTables, interpretBatch, setNameResolver)
- `narrative-format.test.ts` (8) -- maps to "narrative-format.test.ts" (8)
- `event-correlation.test.ts` (14) -- maps to "event-correlation.test.ts" (8) + 6 added (undefined entityId edge case, custom correlationWindowMs, earliest timestamp, dominant category, combined narrative content)
- `event-fallback.test.ts` (6) -- maps to "event-fallback.test.ts" (5) + 1 added (unregisterInterpreter returns false for nonexistent)
- `event-static-data.test.ts` (11) -- maps to "event-static-data.test.ts" (4) + 7 added (StaticDataLoader error handling, table name mapping, non-string/number id, TypeError handling, unmapped table, inventory player name resolution, resource owner name resolution)
- `event-interpreter-integration.test.ts` (5) -- NEW: integration-style unit tests not in original test design

### Git Intelligence

Recent commit pattern: `feat(X-Y): story complete` where X is epic number, Y is story number.
For this story: `feat(4-5): story complete`

Epic 4 branch: `epic-4` (current branch).

Most recent commits:
- `c769ea5 feat(4-4): story complete`
- `731cb5f feat(4-3): story complete`
- `8d460cb feat(4-2): story complete`
- `a82e0e3 feat(4-1): story complete`
- `de7cc35 chore(epic-4): epic start -- baseline green, retro actions resolved`

### References

- Epic 4 definition: `_bmad-output/planning-artifacts/epics.md` (Story 4.5 details)
- Story 4.4 (predecessor): `_bmad-output/implementation-artifacts/4-4-budget-tracking-and-limits.md`
- Story 4.6 (successor, blocked by this): Decision logging consumes `SemanticNarrative` from this story
- Test design: `_bmad-output/planning-artifacts/test-design-epic-4.md` (Section 2.5)
- Architecture Layer 2: `_bmad-output/planning-artifacts/architecture/5-five-layer-cognition-architecture.md` (EventInterpreter interface)
- Architecture Data Flow: `_bmad-output/planning-artifacts/architecture/4-data-flow.md` (Read Path)
- Architecture Agent Core Loop: `_bmad-output/planning-artifacts/architecture/6-agent-core-loop.md` (step 2: INTERPRET)
- SpacetimeDB subscriptions: `packages/client/src/spacetimedb/subscriptions.ts` (RowInsertedEvent, RowUpdatedEvent, RowDeletedEvent)
- Static data loader: `packages/client/src/spacetimedb/static-data-loader.ts` (StaticDataLoader.get())
- Table accessor: `packages/client/src/spacetimedb/tables.ts` (ID extraction pattern, common ID fields)
- Agent module barrel: `packages/client/src/agent/index.ts`
- Client package index: `packages/client/src/index.ts`
- Project context: `_bmad-output/project-context.md`

### Verification Steps

1. `pnpm --filter @sigil/client build` -- produces dist/ with all new event interpreter exports
2. `pnpm --filter @sigil/client test:unit` -- all new unit tests pass (~49 new + existing)
3. `pnpm test` -- all existing tests still pass (regression check)
4. `EventInterpreter.interpret()` produces correct narratives for mapped tables
5. Display names resolved from static data when available
6. Truncated pubkeys used as fallback when no display name
7. `interpretAndCorrelate()` correctly groups related events
8. Unknown tables produce generic narratives without errors
9. Build: `pnpm --filter @sigil/client build` produces ESM + CJS + DTS

## Implementation Constraints

1. No new npm dependencies -- pure transformation logic using standard TypeScript
2. No `any` types -- use `unknown` or specific types (project convention)
3. All new files follow kebab-case naming convention
4. All new tests use vitest framework (co-located `__tests__/` directory)
5. Import extensions: use `.js` suffix for all local imports (ESM compatibility)
6. Barrel exports: update `src/agent/index.ts` + `src/index.ts` for public API
7. No errors thrown during interpretation (graceful degradation -- AC4)
8. Pubkeys truncated in narratives (first 8 chars + "...")
9. Correlation window default: 100ms (configurable)
10. No Docker required for any tests (pure transformation logic)
11. No modification to `client.ts` -- event interpreter is a standalone module
12. No modification to `subscriptions.ts` -- interpreter consumes events, does not subscribe
13. JSDoc `@module` comment header on each new source file
14. No EventEmitter -- interpreter is a stateless transformer (input -> output)
15. Row data accessed via bracket notation with known keys (no dynamic property enumeration)

## CRITICAL Anti-Patterns (MUST AVOID)

- Do NOT subscribe to SpacetimeDB events from within the interpreter -- the interpreter is a pure transformation layer. The agent runtime subscribes and passes events to the interpreter.
- Do NOT throw errors for unmapped tables -- always produce a generic narrative (AC4)
- Do NOT extend EventEmitter -- the interpreter is stateless, it takes input and returns output
- Do NOT access private SpacetimeDB internals -- use only the public `StaticDataLoader.get()` API
- Do NOT modify row data -- treat all input as immutable
- Do NOT store state between `interpret()` calls -- each call is independent (except the `interpretAndCorrelate()` batch method which groups within a single call)
- Do NOT implement decision logging in this story -- that is Story 4.6
- Do NOT implement memory/importance scoring -- that is Phase 2 (Epic 9)
- Do NOT create a new package -- all code goes in `packages/client/src/agent/`
- Do NOT use `any` type -- use `unknown` for row data, then validate and extract
- Do NOT expose full pubkeys in narratives -- always truncate (first 8 chars + "...")
- Do NOT add npm dependencies -- this is pure transformation logic
- Do NOT modify `client.ts` or `subscriptions.ts` -- the interpreter is composed externally
- Do NOT hardcode BitCraft-specific table schemas -- use dynamic property access with known key names to stay adaptable to schema changes
- Do NOT call `StaticDataLoader.get()` with event table names directly (e.g., `player_state`) -- they don't end in `_desc` and will throw `TypeError`. Always map event table names to their `_desc` counterparts first.
- Do NOT let `StaticDataLoader.get()` errors propagate -- the `NameResolver` wrapping it MUST catch all errors and return `undefined` (graceful degradation)

## Definition of Done

- [x] `TableUpdateEvent`, `SemanticNarrative`, `CorrelatedNarrative`, `EventCategory`, `TableInterpreter`, `NameResolver`, `EventInterpreterConfig` types defined
- [x] `EventInterpreter` class with `interpret()`, `interpretBatch()`, `interpretAndCorrelate()`, `registerInterpreter()`, `setNameResolver()`
- [x] Table-specific interpreters: player position, inventory, resource (3 interpreters + generic fallback)
- [x] `createEventInterpreterWithStaticData()` factory wires interpreter to `StaticDataLoader`
- [x] `DEFAULT_TABLE_INTERPRETERS` map provides default set of interpreters
- [x] Mapped tables produce descriptive narratives with entity names and state changes
- [x] Unmapped tables produce generic narratives without errors (AC4)
- [x] Display names resolved from static data when available, truncated pubkey/ID as fallback (AC2)
- [x] Multi-update correlation groups related events within time window (AC3)
- [x] Raw events preserved in all narrative objects (AC3)
- [x] Unit tests pass: `pnpm --filter @sigil/client test:unit` (~72 Story 4.5 unit tests + existing)
- [x] Build passes: `pnpm --filter @sigil/client build` (ESM + CJS + DTS)
- [x] Full regression: `pnpm test` -- all existing tests still pass
- [x] No `any` types in new code
- [x] No Docker required for any tests
- [x] Security: OWASP Top 10 review completed (A01, A02, A03, A04, A05, A06, A09)
- [x] No errors thrown during interpretation (graceful degradation verified)

## Change Log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-03-15 | Initial story creation | Epic 4 Story 4.5 spec |
| 2026-03-15 | Adversarial review: 12 issues fixed | Fixed StaticDataLoader API mismatch (get() requires `_desc` suffix, throws on unloaded/missing tables), fixed resource_spawn_desc -> resource_spawn (static vs runtime table), fixed Five-Layer Architecture stale reference, added undefined entityId correlation guard, added cross-table correlation entityId convention, added NameResolver error handling requirements, added table name mapping for _desc lookups, expanded test coverage (+4 tests), clarified architecture simplification decisions, added unregisterInterpreter return type |
| 2026-03-15 | Implementation complete | All 8 tasks completed, 70 tests passing, build produces ESM+CJS+DTS, full regression green (1203 total tests) |
| 2026-03-15 | Code review: 3 issues fixed | Fixed module-level correlationCounter (MEDIUM: moved to instance-level), fixed inaccurate test count headers (LOW: 27->28), fixed story report test count (LOW: 49->70 actual) |
| 2026-03-15 | Code review #2: 4 issues fixed | MEDIUM: Resource interpreter now uses nameResolver for owner/player entity name (consistency). LOW: Test files relabeled from PRE-EXISTING to CREATED. LOW: Generic interpreter cache added. LOW: DEFAULT_TABLE_INTERPRETERS type changed to ReadonlyMap. |
| 2026-03-15 | Code review #3: 4 issues fixed | MEDIUM: `resolvePlayerName` now always uses `'player_state'` for player name lookups instead of `event.table` (was mapping to wrong `_desc` table for inventory/resource events). MEDIUM: Resource interpreter owner name resolution changed to use `'player_state'` for player lookups. LOW: `safeNum` JSDoc corrected (was claiming "not a number" but accepts any non-null value). LOW: `computeStateChanges` JSDoc documents strict equality limitation for nested objects. +2 new tests for cross-table player name resolution. |

## Code Review Record

| Review Pass | Date | Reviewer | Issues Found | Issues Fixed | Notes |
| --- | --- | --- | --- | --- | --- |
| Adversarial Review | 2026-03-15 | Claude Opus 4.6 | 12 | 12 | StaticDataLoader API surface, resource table naming, correlation edge cases, architecture reference staleness |
| Code Review #1 | 2026-03-15 | Claude Opus 4.6 | 3 (0 crit, 0 high, 1 med, 2 low) | 3 | **Outcome: PASS.** MEDIUM: Module-level mutable correlationCounter moved to instance field. LOW: Inaccurate test count in event-interpreter.test.ts header (27->28). LOW: Inaccurate test counts throughout story report (49->70). All issues fixed, no follow-up actions. |
| Code Review #2 | 2026-03-15 | Claude Opus 4.6 | 4 (0 crit, 0 high, 1 med, 3 low) | 4 | **Outcome: PASS.** MEDIUM: Resource interpreter `entityName` now uses `nameResolver()` for owner/player display names (consistent with other interpreters). LOW: Test file labels corrected from PRE-EXISTING to CREATED. LOW: Generic interpreter cache added to `EventInterpreter.interpret()`. LOW: `DEFAULT_TABLE_INTERPRETERS` changed to `ReadonlyMap` to prevent shared mutation. All issues fixed, no follow-up actions. |
| Code Review #3 | 2026-03-15 | Claude Opus 4.6 | 4 (0 crit, 0 high, 2 med, 2 low) | 4 | **Outcome: PASS.** MEDIUM: `resolvePlayerName()` now always uses `'player_state'` for player name lookups (was incorrectly using `event.table` which mapped inventory->item_desc and resource_spawn->resource_spawn_desc). MEDIUM: Resource interpreter owner name resolution also fixed to use `'player_state'`. LOW: `safeNum` JSDoc corrected. LOW: `computeStateChanges` JSDoc documents strict equality limitation. +2 new tests verifying cross-table player name resolution. All issues fixed, full regression green (1205 tests). |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

N/A -- clean implementation with no debugging required.

### Completion Notes List

- **Task 1 (Types):** Created `event-interpreter-types.ts` with all 7 type/interface exports: `TableUpdateEvent`, `EventCategory`, `SemanticNarrative`, `CorrelatedNarrative`, `TableInterpreter`, `NameResolver`, `EventInterpreterConfig`. All types follow the story spec precisely, using `unknown` for row data (no `any` types).
- **Task 2 (Table Interpreters):** Created `table-interpreters.ts` with 4 interpreter factories (`createPlayerPositionInterpreter`, `createInventoryInterpreter`, `createResourceInterpreter`, `createGenericInterpreter`) and the `DEFAULT_TABLE_INTERPRETERS` map covering 4 tables (player_state, entity_position, inventory, resource_spawn). Resource interpreter uses `owner_id`/`player_id` as entityId for cross-table correlation. Shared utility functions handle ID extraction, truncation, and state change computation.
- **Task 3 (EventInterpreter class):** Created `event-interpreter.ts` with the `EventInterpreter` class providing `interpret()`, `interpretBatch()`, `interpretAndCorrelate()`, `registerInterpreter()`, `unregisterInterpreter()`, `setNameResolver()`, and `registeredTables` getter. Also includes `createEventInterpreterWithStaticData()` factory with table-to-desc mapping, id type validation, try-catch error handling, and display name field resolution.
- **Task 4 (Unit tests):** All 6 test files were pre-authored and already present. 72 tests total across event-interpreter.test.ts (28), narrative-format.test.ts (8), event-correlation.test.ts (14), event-fallback.test.ts (6), event-static-data.test.ts (11), event-interpreter-integration.test.ts (5). All 72 pass.
- **Task 5 (Integration tests):** Included in event-interpreter-integration.test.ts (5 tests) -- all pass without Docker.
- **Task 6 (Barrel exports):** Updated `agent/index.ts` (added Story 4.5 section with all types, factories, constants, and class exports) and `client/src/index.ts` (added Story 4.5 export block re-exporting from agent barrel).
- **Task 7 (OWASP):** Verified -- no `eval`/`Function`, no HTML/script injection context, row data treated as opaque `Record<string, unknown>`, pubkeys truncated in narratives, no new dependencies, no access control needed (read-only transformation).
- **Task 8 (Validation):** Build produces ESM+CJS+DTS. 981 client tests pass (72 new + 909 existing). Full regression: 1205 tests pass across all packages.

### File List

- `packages/client/src/agent/event-interpreter-types.ts` -- CREATED (Task 1: type definitions)
- `packages/client/src/agent/table-interpreters.ts` -- CREATED (Task 2: table-specific interpreters)
- `packages/client/src/agent/event-interpreter.ts` -- CREATED (Task 3: EventInterpreter class + factory)
- `packages/client/src/agent/index.ts` -- MODIFIED (Task 6: added Story 4.5 exports)
- `packages/client/src/index.ts` -- MODIFIED (Task 6: added Story 4.5 re-exports)
- `packages/client/src/agent/__tests__/event-interpreter.test.ts` -- CREATED (Task 4: 28 tests, TDD)
- `packages/client/src/agent/__tests__/narrative-format.test.ts` -- CREATED (Task 4: 8 tests, TDD)
- `packages/client/src/agent/__tests__/event-correlation.test.ts` -- CREATED (Task 4: 14 tests, TDD)
- `packages/client/src/agent/__tests__/event-fallback.test.ts` -- CREATED (Task 4: 6 tests, TDD)
- `packages/client/src/agent/__tests__/event-static-data.test.ts` -- CREATED (Task 4: 11 tests, TDD)
- `packages/client/src/agent/__tests__/event-interpreter-integration.test.ts` -- CREATED (Task 5: 5 tests, integration-style)
