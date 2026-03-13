# Story 3.2: Game Action Handler (kind 30078)

Status: done

<!--
Validation Status: VALIDATED
Review Type: Adversarial Review via /bmad-review-adversarial-general (2026-03-13)
Reviewer: Claude Opus 4.6
BMAD Standards Compliance: VERIFIED (2026-03-13)
- Story structure: Complete (all required sections present)
- Acceptance criteria: 5 ACs with Given/When/Then format, FR/NFR traceability
- Task breakdown: 6 tasks with detailed subtasks, AC mapping on each task
- NFR traceability: 2 NFRs mapped to ACs (NFR8, NFR27)
- FR traceability: 2 FRs mapped to ACs (FR19, FR47)
- Dependencies: Documented (2 epics + 1 story required complete, 2 external, 2 blocked stories)
- Technical design: Comprehensive with architecture decisions, API references, error code mapping
- Security review: OWASP Top 10 coverage complete (A02, A03, A04, A05, A07, A09)
Issues Found & Fixed: 11 (see review notes below)
Ready for Implementation: YES
-->

## Story

As a user,
I want the BLS to receive kind 30078 game action events, parse the reducer and args from the event content, and call the correct SpacetimeDB reducer with my Nostr public key as identity,
So that my game actions are executed with verified authorship.

## Dependencies

**Required Complete (all done):**

- **Epic 1** (Project Foundation) -- monorepo structure, Nostr identity, Docker stack, SpacetimeDB
- **Epic 2** (Action Execution & Payment Pipeline) -- client publish pipeline, BLS integration contract (Story 2.4), @crosstown/client integration (Story 2.5)
- **Story 3.1** (BLS Package Setup & Crosstown SDK Node) -- BLS node infrastructure, @crosstown/sdk stub, Docker integration, health check, lifecycle management

**External Dependencies:**

- `@crosstown/sdk@^0.1.4` workspace stub (created in Story 3.1)
- SpacetimeDB HTTP API (`POST /database/{db}/call/{reducer}`) -- running in Docker

**Blocks:**

- Story 3.3 (Pricing Configuration) depends on the handler being operational for pricing enforcement testing
- Story 3.4 (Identity Propagation) depends on the handler correctly prepending pubkey to reducer args

## Acceptance Criteria

1. **Event decoding and content parsing (AC1)** (FR47, NFR8)
   - **Given** a kind 30078 Nostr event arrives via ILP routing
   - **When** the BLS handler processes it
   - **Then** the handler calls `ctx.decode()` to get the full `NostrEvent`
   - **And** parses `event.content` as JSON to extract `{ reducer, args }`
   - **And** the SDK has already validated the Nostr signature via `createVerificationPipeline`

2. **SpacetimeDB reducer call with identity propagation (AC2)** (FR19)
   - **Given** a valid game action event with parseable content
   - **When** the handler calls SpacetimeDB
   - **Then** the reducer is called via SpacetimeDB HTTP API (`POST /database/bitcraft/call/{reducer}`)
   - **And** the Nostr public key (`ctx.pubkey`) is prepended as the first argument: `[pubkey, ...args]` (64-char hex, NOT npub format)
   - **And** the handler returns `ctx.accept({ eventId: event.id })` on success

3. **Invalid content handling (AC3)** (FR19)
   - **Given** an event with invalid or missing content JSON
   - **When** the handler attempts to parse it
   - **Then** the handler returns `ctx.reject('F06', 'Invalid event content: missing reducer or args')`
   - **And** no SpacetimeDB call is made

4. **SpacetimeDB error handling (AC4)** (FR47)
   - **Given** an event referencing a non-existent reducer
   - **When** the SpacetimeDB HTTP API returns a 404 or error
   - **Then** the handler returns `ctx.reject('T00', 'Unknown reducer: {name}')`
   - **And** the error is logged with event ID, pubkey, and reducer name

5. **Zero silent failures (AC5)** (NFR27)
   - **Given** any handler execution
   - **When** it succeeds or fails
   - **Then** zero silent failures -- every outcome is explicit
   - **And** all errors include: event ID, pubkey (truncated), reducer name, error reason

## Tasks / Subtasks

### Task 1: Create content parser module (AC: 1, 3)

- [x] Create `packages/bitcraft-bls/src/content-parser.ts`:
  - Export `parseEventContent(content: string): ParsedContent` function
  - `ParsedContent` interface: `{ reducer: string, args: unknown[] }`
  - Parse `event.content` as JSON
  - Validate `reducer` is a non-empty string (1-64 chars, alphanumeric + underscore: `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`)
  - Validate `args` is an array
  - Throw `ContentParseError` with descriptive message on failure
  - Export `ContentParseError` class extending `Error` with `code: string` field
- [x] Content validation rejects:
  - Non-JSON content
  - Missing `reducer` field
  - Non-string `reducer` field
  - Empty `reducer` string
  - Reducer name with invalid characters (path traversal, SQL injection, command injection -- OWASP A03)
  - Reducer name exceeding 64 chars
  - Missing `args` field
  - Non-array `args` field
  - Content exceeding 1MB (oversized payload protection)

### Task 2: Create SpacetimeDB HTTP caller module (AC: 2, 4)

- [x] Create `packages/bitcraft-bls/src/spacetimedb-caller.ts`:
  - Export `callReducer(config: SpacetimeDBCallerConfig, reducer: string, args: unknown[]): Promise<ReducerResult>` function
  - `SpacetimeDBCallerConfig` interface: `{ url: string, database: string, token: string, timeoutMs?: number }`
  - `ReducerResult` interface: `{ success: boolean, error?: string, statusCode: number }`
  - HTTP POST to `{url}/database/{database}/call/{reducer}`
  - Headers: `Authorization: Bearer {token}`, `Content-Type: application/json`
  - Body: JSON-serialized `args` parameter (caller is responsible for prepending pubkey before calling this function)
  - 30-second timeout via `AbortController` + `setTimeout` (MUST `clearTimeout` on successful fetch to prevent timer leak)
  - Response handling:
    - 200: success
    - 404: `UNKNOWN_REDUCER` error
    - 400: `REDUCER_FAILED` error (bad args)
    - 500: `REDUCER_FAILED` error (internal)
    - Timeout: `REDUCER_FAILED` error with timeout message
  - SECURITY: NEVER log the `token` value (OWASP A02)
  - Export `ReducerCallError` class extending `Error` with `code: string` and `statusCode: number` fields

### Task 3: Create game action handler module (AC: 1, 2, 3, 4, 5)

- [x] Create `packages/bitcraft-bls/src/handler.ts`:
  - Export `createGameActionHandler(config: BLSConfig): HandlerFn` factory function
  - Returns an async handler function matching `@crosstown/sdk`'s `HandlerFn` type signature
  - Handler implementation:
    1. Call `ctx.decode()` to get full `NostrEvent`
    2. Parse content via `parseEventContent(event.content)`
    3. On parse failure: `ctx.reject('F06', 'Invalid event content: ...')`
    4. Prepend `ctx.pubkey` as first element: `[ctx.pubkey, ...args]`
    5. Call `callReducer(config, reducer, prependedArgs)`
    6. On success: `ctx.accept({ eventId: event.id })`
    7. On 404: `ctx.reject('T00', 'Unknown reducer: {name}')`
    8. On 400/500: `ctx.reject('T00', 'Reducer {name} failed: {error}')`
    9. On timeout: `ctx.reject('T00', 'Reducer {name} timed out')`
    10. On unexpected error: `ctx.reject('T00', 'Internal error: {message}')`
  - Logging:
    - On success: `[BLS] Action succeeded | eventId: {id} | pubkey: {truncated} | reducer: {name} | duration: {ms}ms`
    - On error: `[BLS] Action failed | eventId: {id} | pubkey: {truncated} | reducer: {name} | error: {code}: {message} | duration: {ms}ms`
  - Pubkey truncation: first 8 + last 4 chars (e.g., `32e18276...e245`)
  - Duration tracking: `Date.now()` at start and end of handler execution

### Task 4: Register handler in BLS node startup (AC: 1, 2)

- [x] Modify `packages/bitcraft-bls/src/index.ts`:
  - Import `createGameActionHandler` from `./handler.js`
  - After `createBLSNode(config)`, before `node.start()`:
    - Create handler: `const handler = createGameActionHandler(config)`
    - Register handler: `node.on(30078, handler)`
  - Log handler registration: `[BLS] Handler registered for kind 30078 (game actions)`
- [x] Modify `packages/bitcraft-bls/src/node.ts`:
  - No changes needed (handler registration via `node.on()` is already supported by CrosstownNode from Story 3.1)
- [x] Update `packages/bitcraft-bls/src/index.ts` exports:
  - Add: `export { createGameActionHandler } from './handler.js'`
  - Add: `export { parseEventContent, ContentParseError, type ParsedContent } from './content-parser.js'`
  - Add: `export { callReducer, ReducerCallError, type SpacetimeDBCallerConfig, type ReducerResult } from './spacetimedb-caller.js'`

### Task 5: Write unit tests (AC: 1-5)

Following the test design in `_bmad-output/planning-artifacts/test-design-epic-3.md` Section 2.2.

- [x] Create `packages/bitcraft-bls/src/__tests__/content-parser.test.ts` (~12 tests):
  - Valid JSON with `{ reducer, args }` -- parses successfully
  - Malformed JSON -- throws ContentParseError
  - Missing `reducer` field -- throws ContentParseError
  - Non-string `reducer` field (number, null, object) -- throws ContentParseError
  - Empty string `reducer` -- throws ContentParseError
  - Reducer name with invalid chars: `../etc/passwd` (path traversal, OWASP A03)
  - Reducer name with invalid chars: `test; DROP TABLE` (SQL injection, OWASP A03)
  - Reducer name with invalid chars: `test && rm -rf /` (command injection, OWASP A03)
  - Reducer name exceeding 64 chars -- throws ContentParseError
  - Missing `args` field -- throws ContentParseError
  - Non-array `args` (string, number, object) -- throws ContentParseError
  - Content exceeding 1MB -- throws ContentParseError

- [x] Create `packages/bitcraft-bls/src/__tests__/spacetimedb-caller.test.ts` (~12 tests):
  - Successful 200 OK response -- returns `{ success: true }`
  - 404 Not Found -- throws ReducerCallError with code `UNKNOWN_REDUCER`
  - 400 Bad Request -- throws ReducerCallError with code `REDUCER_FAILED`
  - 500 Internal Server Error -- throws ReducerCallError with code `REDUCER_FAILED`
  - Timeout (>30s) -- throws ReducerCallError with code `REDUCER_FAILED` and timeout message
  - Network error (fetch rejects) -- throws ReducerCallError
  - Correct URL construction: `{url}/database/{database}/call/{reducer}`
  - Authorization header present: `Bearer {token}`
  - Content-Type header: `application/json`
  - Request body: JSON-serialized args array
  - Token NEVER appears in error messages or logs (OWASP A02)
  - AbortController cancels on timeout

- [x] Create `packages/bitcraft-bls/src/__tests__/handler-dispatch.test.ts` (~10 tests):
  - Handler calls `ctx.decode()` to get NostrEvent
  - Handler parses event.content and extracts reducer/args
  - Handler prepends `ctx.pubkey` to args: `[pubkey, ...args]`
  - Valid action returns `ctx.accept({ eventId: event.id })`
  - Invalid content returns `ctx.reject('F06', ...)`
  - SpacetimeDB 404 returns `ctx.reject('T00', 'Unknown reducer: ...')`
  - SpacetimeDB 400 returns `ctx.reject('T00', 'Reducer ... failed: ...')`
  - SpacetimeDB 500 returns `ctx.reject('T00', 'Reducer ... failed: ...')`
  - SpacetimeDB timeout returns `ctx.reject('T00', 'Reducer ... timed out')`
  - Unexpected error returns `ctx.reject('T00', 'Internal error: ...')`

- [x] Create `packages/bitcraft-bls/src/__tests__/identity-prepend.test.ts` (~6 tests):
  - Pubkey prepended as first element (not appended)
  - Original args array preserved unchanged
  - Pubkey format: 64-char hex string
  - Empty args array: result is `[pubkey]`
  - Multi-element args: `[pubkey, arg1, arg2, arg3]`
  - Nested object args preserved: `[pubkey, { x: 100, z: 200 }, ...]`

- [x] Create `packages/bitcraft-bls/src/__tests__/error-mapping.test.ts` (~5 tests):
  - Invalid JSON content maps to `F06` ILP error code
  - Missing reducer/args maps to `F06` ILP error code
  - SpacetimeDB 404 maps to `T00` ILP error code
  - SpacetimeDB 400/500 maps to `T00` ILP error code
  - All errors include event ID, truncated pubkey, reducer name, error reason

### Task 6: Write integration tests (AC: 1-5)

- [x] Create `packages/bitcraft-bls/src/__tests__/handler-e2e-integration.test.ts` (~12 tests, skipped without Docker):
  - Full handler flow: mock packet -> decode -> parse -> SpacetimeDB call -> accept
  - Handler registered on node kind 30078
  - Valid game action processed end-to-end
  - Identity correctly propagated to SpacetimeDB reducer
  - Multiple sequential actions from same identity
  - Multiple concurrent actions processed without data loss
  - Handler logs include eventId, pubkey, reducer, duration
  - `ctx.accept()` returns AcceptResponse with eventId in metadata
  - SpacetimeDB reducer receives args with pubkey prepended
  - Handler dispatched via `node.dispatch()` (CrosstownNode stub method)
  - Handler works with various reducer names (player_move, craft_item, send_chat)
  - Handler works with various arg types (objects, arrays, primitives, mixed)

- [x] Create `packages/bitcraft-bls/src/__tests__/handler-error-integration.test.ts` (~8 tests, skipped without Docker):
  - Invalid JSON content rejected with F06
  - Missing reducer field rejected with F06
  - Missing args field rejected with F06
  - Unknown reducer name returns T00 from SpacetimeDB
  - SpacetimeDB returns 400 (bad args) -> T00 reject
  - SpacetimeDB returns 500 (internal error) -> T00 reject
  - No silent failures: every dispatch results in accept or reject
  - Error logs contain event ID, pubkey (truncated), reducer name, error reason

- [x] Use `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS || !process.env.BLS_AVAILABLE)` pattern

## Dev Notes

### Architecture Context

This is the **core handler implementation** for the BLS node. Story 3.1 established the node infrastructure (package, SDK stub, Docker, health, lifecycle). This story adds the actual game action processing logic: receive events, parse content, call SpacetimeDB with identity propagation, and handle all error cases.

**The SDK handles (already implemented in @crosstown/sdk stub from Story 3.1):**

- ILP packet reception and routing
- TOON decoding (shallow parse for kind/pubkey/amount, full decode via `ctx.decode()`)
- Nostr signature verification (`createVerificationPipeline`: secp256k1 Schnorr)
- Pricing enforcement (`createPricingValidator`: reject F04 for underpaid packets)
- Handler dispatch (route to kind-specific handler via `node.on(kind, handler)`)

**Our handler (this story) handles:**

- Parse event content (`{ reducer, args }`) from the decoded NostrEvent
- Validate content format and reducer name
- Prepend `ctx.pubkey` to args for identity propagation
- Call SpacetimeDB HTTP API with authenticated request
- Return `ctx.accept()` on success or `ctx.reject()` with appropriate ILP error code on failure
- Log all outcomes with sufficient detail for debugging

### @crosstown/sdk HandlerContext API Reference

```typescript
// Handler signature (from @crosstown/sdk)
type HandlerFn = (ctx: HandlerContext) => Promise<AcceptResponse | RejectResponse>;

// Handler registration (from Story 3.1 CrosstownNode)
node.on(30078, handler);

// Context properties available in handler:
ctx.kind       // number: 30078 (game actions)
ctx.pubkey     // string: verified Nostr pubkey (64-char hex) -- SDK-verified
ctx.amount     // bigint: ILP payment amount
ctx.destination // string: ILP destination address
ctx.toon       // string: raw TOON data (base64)
ctx.decode()   // () => NostrEvent: lazy TOON decode (cached)
ctx.accept(metadata?) // () => AcceptResponse: accept the packet
ctx.reject(code, message) // () => RejectResponse: reject with ILP error code
```

[Source: packages/crosstown-sdk/src/index.ts]

### SpacetimeDB HTTP API Contract

```
POST {SPACETIMEDB_URL}/database/{database}/call/{reducer}
Authorization: Bearer {SPACETIMEDB_TOKEN}
Content-Type: application/json

Body: ["{nostr_pubkey_hex}", ...original_args]

Response:
  200 OK: Reducer executed successfully
  404 Not Found: Unknown reducer name
  400 Bad Request: Invalid reducer arguments
  500 Internal Server Error: Reducer runtime error
  Timeout (30s): Request timed out
```

[Source: docs/bls-handler-contract.md]

### ILP Error Code Mapping

| Condition                          | ILP Code | Message Pattern                                  | Retryable |
| ---------------------------------- | -------- | ------------------------------------------------ | --------- |
| SDK: invalid signature             | `F06`    | (handled by SDK, not our handler)                | No        |
| SDK: insufficient payment          | `F04`    | (handled by SDK, not our handler)                | No        |
| Handler: invalid JSON content      | `F06`    | `Invalid event content: ...`                     | No        |
| Handler: missing reducer/args      | `F06`    | `Invalid event content: missing reducer or args` | No        |
| SpacetimeDB: 404 (unknown reducer) | `T00`    | `Unknown reducer: {name}`                        | No        |
| SpacetimeDB: 400 (bad args)        | `T00`    | `Reducer {name} failed: {error}`                 | No        |
| SpacetimeDB: 500 (internal error)  | `T00`    | `Reducer {name} failed: {error}`                 | Yes       |
| SpacetimeDB: timeout               | `T00`    | `Reducer {name} timed out`                       | Yes       |
| Handler: unexpected error          | `T00`    | `Internal error: {message}`                      | Yes       |

[Source: _bmad-output/planning-artifacts/test-design-epic-3.md, Section 2.2]

### Identity Propagation (Option B)

The handler prepends `ctx.pubkey` (64-char hex, already verified by SDK) as the first argument to all reducer calls:

```typescript
// Input: event.content = { "reducer": "player_move", "args": [origin, dest, running] }
// ctx.pubkey = "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"

// Output HTTP body to SpacetimeDB:
['32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245', origin, dest, running];
```

All BitCraft reducers MUST accept `nostr_pubkey: String` as the first parameter. This is a breaking change to BitCraft reducers; implementing the reducer modifications is part of Story 3.4.

[Source: docs/bls-handler-contract.md, docs/crosstown-bls-implementation-spec.md]

### Logging Requirements

**Success log (INFO):**

```
[BLS] Action succeeded | eventId: a1b2c3d4... | pubkey: 32e18276...e245 | reducer: player_move | duration: 42ms
```

**Error log (ERROR):**

```
[BLS] Action failed | eventId: a1b2c3d4... | pubkey: 32e18276...e245 | reducer: player_move | error: T00: Reducer player_move failed: Invalid coordinates | duration: 15ms
```

Pubkey truncation: first 8 + last 4 hex chars (e.g., `32e18276...e245`). NEVER log: secretKey, SPACETIMEDB_TOKEN, full event signatures.

[Source: docs/bls-handler-contract.md]

### Performance Requirements

| Metric                   | Requirement  | Budget                               |
| ------------------------ | ------------ | ------------------------------------ |
| Content parsing          | <10ms        | Fast JSON parse + regex validation   |
| SpacetimeDB HTTP call    | <400ms (p95) | Network latency to local Docker      |
| Total handler processing | <500ms (p99) | Content parse + HTTP call + response |
| SpacetimeDB call timeout | 30s          | AbortController timeout              |

[Source: docs/bls-handler-contract.md, docs/crosstown-bls-implementation-spec.md]

### File Structure

```
packages/bitcraft-bls/
├── src/
│   ├── index.ts              # Entry point (MODIFY: add handler registration + exports)
│   ├── node.ts               # createBLSNode() (NO CHANGES)
│   ├── config.ts             # loadConfig() (NO CHANGES)
│   ├── health.ts             # Health check (NO CHANGES)
│   ├── lifecycle.ts          # Shutdown handlers (NO CHANGES)
│   ├── handler.ts            # NEW: createGameActionHandler() factory
│   ├── content-parser.ts     # NEW: parseEventContent(), ContentParseError
│   ├── spacetimedb-caller.ts # NEW: callReducer(), ReducerCallError
│   └── __tests__/
│       ├── content-parser.test.ts              # NEW: ~12 tests
│       ├── spacetimedb-caller.test.ts          # NEW: ~12 tests
│       ├── handler-dispatch.test.ts            # NEW: ~10 tests
│       ├── identity-prepend.test.ts            # NEW: ~6 tests
│       ├── error-mapping.test.ts               # NEW: ~5 tests
│       ├── handler-e2e-integration.test.ts     # NEW: ~12 tests (Docker-dependent)
│       └── handler-error-integration.test.ts   # NEW: ~8 tests (Docker-dependent)
```

### Project Structure Notes

- All new files in `packages/bitcraft-bls/src/` -- no modifications to other packages
- Follows monorepo conventions: kebab-case file names, co-located tests, vitest
- New modules (`handler.ts`, `content-parser.ts`, `spacetimedb-caller.ts`) are exported from `index.ts`
- Uses existing `@crosstown/sdk` workspace stub (Story 3.1) for types and mock context
- Uses Node.js built-in `fetch` (Node 20+) for SpacetimeDB HTTP calls -- NO additional HTTP dependencies

### Previous Story Intelligence (from Story 3.1)

Key patterns and decisions from Story 3.1 that MUST be followed:

1. **@crosstown/sdk stub pattern:** The SDK stub at `packages/crosstown-sdk/src/index.ts` provides real TypeScript types. `HandlerContext`, `HandlerFn`, `AcceptResponse`, `RejectResponse`, `NostrEvent`, and `CrosstownNode.dispatch()` are all functional. Two mock context factories are available: `createMockHandlerContext()` from `@crosstown/sdk` (SDK-level) and `createHandlerContext()` from `packages/bitcraft-bls/src/__tests__/factories/handler-context.factory.ts` (BLS-level). Prefer the BLS factory for Story 3.2 tests since it is co-located and follows BLS test conventions.

2. **Handler registration pattern:** `node.on(kind, handler)` registers a handler function. `node.dispatch(ctx)` simulates packet arrival for testing. The dispatch method tracks in-flight count for lifecycle management.

3. **Test factories:** Story 3.1 created `packages/bitcraft-bls/src/__tests__/factories/` with `bls-config.factory.ts`, `identity.factory.ts`, `handler-context.factory.ts`. Reuse these for Story 3.2 tests.

4. **Integration test skip pattern:** `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS || !process.env.BLS_AVAILABLE)` -- all integration tests follow this pattern.

5. **No `any` types:** Project convention -- use `unknown` or specific types. This applies to the `args` field which must be typed as `unknown[]`.

6. **No Express dependency:** The BLS service uses Node.js built-in `http` for health (Story 3.1) and built-in `fetch` for SpacetimeDB calls (this story). No Express or other HTTP framework.

7. **Error logging pattern:** Story 3.1 used `console.log('[BLS] ...')` for info and `console.error('[BLS] ...')` for errors. Follow the same prefix pattern.

8. **Config reuse:** `BLSConfig` from `config.ts` already contains `spacetimedbUrl`, `spacetimedbDatabase`, and `spacetimedbToken` -- pass these to `SpacetimeDBCallerConfig` rather than duplicating config.

9. **CJS/ESM dual build:** All imports use `.js` extension for ESM compatibility (e.g., `import { loadConfig } from './config.js'`). tsup handles CJS output.

### Git Intelligence

Recent commits show the project uses conventional commit format:

- `feat(3-1): story complete`
- `chore(epic-3): epic start -- baseline green, retro actions resolved`
- `feat(2-5): story complete`

For Story 3.2, use: `feat(3-2): ...` format.

### References

- Epic 3 definition: `_bmad-output/planning-artifacts/epics.md` (Epic 3: line 728, Story 3.2: lines 766-800)
- Story 3.1 (BLS node infrastructure): `_bmad-output/implementation-artifacts/3-1-bls-package-setup-and-crosstown-sdk-node.md`
- BLS handler contract: `docs/bls-handler-contract.md`
- Crosstown BLS implementation spec: `docs/crosstown-bls-implementation-spec.md`
- Crosstown SDK architecture: `_bmad-output/planning-artifacts/architecture/7-crosstown-integration.md` (Section 7.2)
- Epic 3 test design: `_bmad-output/planning-artifacts/test-design-epic-3.md` (Section 2.2)
- @crosstown/sdk stub: `packages/crosstown-sdk/src/index.ts`
- BLS node module: `packages/bitcraft-bls/src/node.ts`
- BLS config module: `packages/bitcraft-bls/src/config.ts`
- BLS index (entry point): `packages/bitcraft-bls/src/index.ts`
- Test factories: `packages/bitcraft-bls/src/__tests__/factories/`
  - `bls-config.factory.ts` -- BLSConfig test data
  - `identity.factory.ts` -- Identity test data
  - `handler-context.factory.ts` -- HandlerContext mock (preferred for Story 3.2 tests)
- Test fixtures: `packages/bitcraft-bls/src/__tests__/fixtures/`
  - `mock-node.fixture.ts` -- Mock CrosstownNode for unit tests
- FR19: BLS handler validates and calls reducer
- FR47: BLS game action handler mapping
- NFR8: All ILP packets signed with user's Nostr private key
- NFR27: Zero silent failures

### Verification Steps

1. `pnpm install` -- no new dependencies needed (uses built-in `fetch`)
2. `pnpm --filter @sigil/bitcraft-bls build` -- produces dist/ with ESM/CJS/DTS including new modules
3. `pnpm --filter @sigil/bitcraft-bls test:unit` -- all unit tests pass (~45 new + 68 existing = ~113 tests)
4. `pnpm test` -- all existing tests still pass (regression check: 809 existing + ~45 new = ~854)
5. `grep -r "spacetimedbToken\|SPACETIMEDB_TOKEN" packages/bitcraft-bls/src/ | grep -v test | grep -v ".d.ts"` -- verify token only used in fetch Authorization header, never logged
6. Handler registered: `node.hasHandler(30078)` returns `true` after startup
7. Valid game action dispatched via `node.dispatch(ctx)` returns `AcceptResponse`
8. Invalid content dispatched returns `RejectResponse` with code `F06`

## Implementation Constraints

1. Use Node.js built-in `fetch` for SpacetimeDB HTTP calls (Node 20+ provides global `fetch`)
2. No `any` types -- use `unknown` or specific types (project convention)
3. All new files follow kebab-case naming convention
4. All new tests use vitest framework (co-located `*.test.ts`)
5. Integration tests use `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)` pattern
6. Handler MUST call `ctx.decode()` to get the NostrEvent -- do NOT access `ctx.toon` directly
7. SPACETIMEDB_TOKEN MUST NEVER be logged or included in error messages
8. Reducer name validation MUST use strict regex to prevent injection (OWASP A03)
9. AbortController timeout of 30s on SpacetimeDB fetch calls
10. Every handler execution MUST result in either `ctx.accept()` or `ctx.reject()` (NFR27)
11. Import extensions: use `.js` suffix for all local imports (ESM)
12. Reuse `createMockHandlerContext()` from `@crosstown/sdk` stub or `createHandlerContext()` from `packages/bitcraft-bls/src/__tests__/factories/handler-context.factory.ts` for testing

## CRITICAL Anti-Patterns (MUST AVOID)

- Do NOT re-verify Nostr signatures in the handler -- SDK handles this via `createVerificationPipeline`
- Do NOT construct URLs via string interpolation without validating the reducer name first
- Do NOT log SPACETIMEDB_TOKEN in any code path (error messages, debug logs, HTTP responses)
- Do NOT use `any` type for reducer args -- use `unknown[]`
- Do NOT add Express, axios, got, or other HTTP dependencies -- use Node.js built-in `fetch`
- Do NOT modify existing Story 3.1 files (config.ts, health.ts, lifecycle.ts, node.ts) except index.ts
- Do NOT implement pricing logic in this story -- pricing comes in Story 3.3
- Do NOT implement reducer allowlist validation in this story -- let SpacetimeDB return 404 for unknown reducers
- Do NOT swallow exceptions -- every error must result in `ctx.reject()` with appropriate ILP code
- Do NOT use `setTimeout` without `clearTimeout` -- use AbortController for fetch timeout
- Do NOT fire-and-forget async calls -- all promises must be awaited

## Security Considerations (OWASP Top 10)

**A02: Cryptographic Failures**

- SPACETIMEDB_TOKEN MUST NEVER appear in error messages, logs, or responses
- Signature verification is handled by SDK (`createVerificationPipeline`) -- handler trusts `ctx.pubkey`

**A03: Injection**

- Reducer name validation: `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/` -- rejects path traversal, SQL injection, command injection
- Content size limit: reject payloads >1MB
- Args are passed as JSON to SpacetimeDB HTTP API -- no string interpolation into URLs (reducer name IS interpolated into URL path, hence the strict validation)

**A04: Insecure Design**

- Zero silent failures (NFR27): every handler execution results in `ctx.accept()` or `ctx.reject()`
- All errors are logged AND returned

**A05: Security Misconfiguration**

- HTTP timeout (30s) prevents hanging connections
- AbortController ensures timeout cancellation of fetch

**A07: Identification/Authentication**

- `ctx.pubkey` is already verified by SDK's `createVerificationPipeline`
- Handler trusts SDK for signature verification -- does NOT re-verify

**A09: Security Logging**

- All actions logged with eventId, pubkey (truncated), reducer name, and result
- Errors include error code and message
- NEVER log: secretKey, SPACETIMEDB_TOKEN, event signatures

## FR/NFR Traceability

| Requirement                                                 | Coverage | Notes                                                                                                                                |
| ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| FR19 (BLS handler validates and calls reducer)              | AC2, AC3 | Handler parses content, validates reducer name, calls SpacetimeDB HTTP API with identity prepended; rejects invalid content with F06 |
| FR47 (BLS game action handler mapping)                      | AC1, AC4 | Handler registered on kind 30078, decodes event via `ctx.decode()`, parses content JSON; maps SpacetimeDB errors to ILP error codes  |
| NFR8 (All ILP packets signed with user's Nostr private key) | AC1      | SDK verifies Nostr signature via `createVerificationPipeline` before handler is invoked                                              |
| NFR27 (Zero silent failures)                                | AC5      | Every handler execution results in `ctx.accept()` or `ctx.reject()`, all errors logged with full context                             |

## Definition of Done

- [x] Content parser module created with strict reducer name validation (OWASP A03)
- [x] SpacetimeDB HTTP caller module created with proper error handling and timeout
- [x] Game action handler factory created, dispatching to content parser and SpacetimeDB caller
- [x] Handler registered on kind 30078 in BLS node startup (`index.ts`)
- [x] New modules exported from `index.ts` for library consumers
- [x] All unit tests pass: `pnpm --filter @sigil/bitcraft-bls test:unit` (124 passing, 35 skipped)
- [x] Build passes: `pnpm --filter @sigil/bitcraft-bls build` (ESM + CJS + DTS)
- [x] Full regression suite passes: `pnpm test` (all packages green)
- [x] Integration tests created (skipped without Docker)
- [x] Security review: SPACETIMEDB_TOKEN never logged, reducer name validated against injection
- [x] No `any` types in new code
- [x] Handler registered: `node.hasHandler(30078)` returns `true` after startup
- [x] Valid game action dispatched returns `AcceptResponse`
- [x] Invalid content dispatched returns `RejectResponse` with code `F06`

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug issues encountered during implementation.

### Completion Notes List

- **Task 1 (Content Parser):** Created `content-parser.ts` with `parseEventContent()`, `ContentParseError` class, and `ParsedContent` interface. Implements strict reducer name validation via `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/` regex (OWASP A03 injection prevention), content size limit of 1MB, and validation of all fields (reducer as non-empty string, args as array).
- **Task 2 (SpacetimeDB Caller):** Created `spacetimedb-caller.ts` with `callReducer()`, `ReducerCallError` class, `SpacetimeDBCallerConfig` and `ReducerResult` interfaces. Uses Node.js built-in `fetch` with `AbortController` timeout (30s default), proper `clearTimeout` on success to prevent timer leaks. Maps HTTP 404 to `UNKNOWN_REDUCER`, 400/500 to `REDUCER_FAILED`. Token never logged (OWASP A02).
- **Task 3 (Game Action Handler):** Created `handler.ts` with `createGameActionHandler()` factory function. Orchestrates: `ctx.decode()` -> `parseEventContent()` -> pubkey prepend -> `callReducer()` -> `ctx.accept()`/`ctx.reject()`. Maps `ContentParseError` to F06, `ReducerCallError` to T00. Logs all outcomes with eventId, truncated pubkey (first 8 + last 4 chars), reducer name, and duration.
- **Task 4 (Handler Registration):** Modified `index.ts` to import and register handler via `node.on(30078, handler)` before `node.start()`. Added exports for all new modules: `createGameActionHandler`, `parseEventContent`, `ContentParseError`, `ParsedContent`, `callReducer`, `ReducerCallError`, `SpacetimeDBCallerConfig`, `ReducerResult`.
- **Task 5 (Unit Tests):** Implemented 6 test files with 52 unit tests total: `content-parser.test.ts` (17 tests), `spacetimedb-caller.test.ts` (12 tests), `handler-dispatch.test.ts` (10 tests), `identity-prepend.test.ts` (6 tests), `error-mapping.test.ts` (5 tests), `ac-coverage-gaps-3-2.test.ts` (7 tests). Tests use `vi.mock()` for SpacetimeDB caller isolation and existing BLS test factories.
- **Task 6 (Integration Tests):** Implemented 2 test files with 20 tests total (skipped without Docker): `handler-e2e-integration.test.ts` (12 tests), `handler-error-integration.test.ts` (8 tests). Uses `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS || !process.env.BLS_AVAILABLE)` pattern.

### File List

**Created:**

- `packages/bitcraft-bls/src/content-parser.ts` -- Content parser module with ParsedContent, ContentParseError
- `packages/bitcraft-bls/src/spacetimedb-caller.ts` -- SpacetimeDB HTTP caller with callReducer(), ReducerCallError
- `packages/bitcraft-bls/src/handler.ts` -- Game action handler factory with createGameActionHandler()

**Modified:**

- `packages/bitcraft-bls/src/index.ts` -- Added handler registration, new module exports

**Tests Created/Updated:**

- `packages/bitcraft-bls/src/__tests__/content-parser.test.ts` -- 17 unit tests (was TDD stub, now implemented; expanded from 12 to 17 with gap-fill tests for null/object reducer, string/number args, empty args)
- `packages/bitcraft-bls/src/__tests__/spacetimedb-caller.test.ts` -- 12 unit tests (was TDD stub, now implemented)
- `packages/bitcraft-bls/src/__tests__/handler-dispatch.test.ts` -- 10 unit tests (was TDD stub, now implemented)
- `packages/bitcraft-bls/src/__tests__/identity-prepend.test.ts` -- 6 unit tests (was TDD stub, now implemented)
- `packages/bitcraft-bls/src/__tests__/error-mapping.test.ts` -- 5 unit tests (was TDD stub, now implemented)
- `packages/bitcraft-bls/src/__tests__/ac-coverage-gaps-3-2.test.ts` -- 7 unit tests (AC coverage gap-fill: no SpacetimeDB call on invalid content, success log format, T00 error logging, pubkey truncation, handler registration)
- `packages/bitcraft-bls/src/__tests__/handler-e2e-integration.test.ts` -- 12 integration tests (was TDD stub, now implemented, skipped without Docker)
- `packages/bitcraft-bls/src/__tests__/handler-error-integration.test.ts` -- 8 integration tests (was TDD stub, now implemented, skipped without Docker)

### Change Log

| Date       | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-13 | Story 3.2 implementation complete. Created 3 source modules (content-parser, spacetimedb-caller, handler), modified index.ts for handler registration and exports. Implemented 52 unit tests across 6 test files and 20 integration tests across 2 test files. All 124 BLS package unit tests pass (35 integration skipped without Docker). Full regression suite green. No new dependencies added. Security review: SPACETIMEDB_TOKEN never logged, reducer name validated with strict regex, no `any` types. |
| 2026-03-13 | Code review fixes: (1) Fixed content parser size limit comment and error message -- clarified units are characters not bytes. (2) Updated index.ts outdated future-tense comment to past tense. (3) Fixed handler.ts UNKNOWN_REDUCER error to preserve original error message context from ReducerCallError. (4) Updated File List to include ac-coverage-gaps-3-2.test.ts. (5) Corrected stale test counts in DoD and completion notes.                                                                       |
| 2026-03-13 | Code review pass #2 fixes: (1) handler.ts timeout detection hardened with statusCode === 0 guard. (2) spacetimedb-caller.ts error body truncated to 256 chars to prevent verbose leakage. (3) handler.ts ContentParseError double-prefix bug fixed -- use err.message directly.                                                                                                                                                                                                                                |
| 2026-03-13 | Code review pass #3 fixes: (1) handler.ts REDUCER_FAILED branch double-prefix bug fixed -- use err.message directly since callReducer() already formats the message. (2) content-parser.ts rejected reducer name truncated to 64 chars in error message to prevent verbose log entries from long attacker-controlled input.                                                                                                                                                                                    |

---

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

| ID  | Severity | Description                                                                         | Resolution                                                                     |
| --- | -------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| M1  | Medium   | Story File List missing `ac-coverage-gaps-3-2.test.ts`                              | FIXED -- Added to File List in story doc                                       |
| M2  | Medium   | Story test count claims are stale (DoD and completion notes)                        | FIXED -- Corrected test counts to match actual                                 |
| M3  | Medium   | Content size check error message says "bytes" but uses `string.length` (characters) | FIXED -- Clarified units are characters not bytes in comment and error message |
| L1  | Low      | `handler.ts` UNKNOWN_REDUCER error discards original message from ReducerCallError  | FIXED -- Preserved original error message context                              |
| L2  | Low      | `index.ts` outdated future-tense comment                                            | FIXED -- Updated to past tense                                                 |
| L3  | Low      | Task 4 `node.ts` documentation -- verified accuracy                                 | No fix needed -- documentation is accurate                                     |
| L4  | Low      | `sprint-status.yaml` status not updated to "done"                                   | FIXED -- Updated status to done                                                |

**Review Follow-ups:** None -- all issues resolved in this pass.

### Review Pass #2

| Field              | Value                                               |
| ------------------ | --------------------------------------------------- |
| **Date**           | 2026-03-13                                          |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6)                   |
| **Review Type**    | Adversarial code review (bmad-bmm-code-review yolo) |
| **Outcome**        | PASS (all issues resolved)                          |

**Issue Counts by Severity:**

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 1     |
| Low       | 2     |
| **Total** | **3** |

**Issues Found & Fixed:**

| ID  | Severity | Description                                                                                                                                                                                                                           | Resolution                                                                                                                                                    |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Medium   | `handler.ts` fragile timeout detection uses `err.message.includes('timed out')` which could false-match SpacetimeDB error bodies containing "timed out"                                                                               | FIXED -- Added `err.statusCode === 0` guard so timeout detection only matches actual AbortController timeouts (statusCode 0), not SpacetimeDB response errors |
| L1  | Low      | `spacetimedb-caller.ts` includes full SpacetimeDB error response body in error messages without truncation, risking leakage of sensitive server internals (stack traces, paths)                                                       | FIXED -- Truncated error body to max 256 characters                                                                                                           |
| L2  | Low      | `handler.ts` ContentParseError rejection message double-prefixed: `"Invalid event content: Invalid event content: malformed JSON"` because handler wraps with `Invalid event content:` but error messages already include that prefix | FIXED -- Use `err.message` directly since ContentParseError messages already include descriptive prefix                                                       |

**Review Follow-ups:** None -- all issues resolved in this pass.

### Review Pass #3

| Field              | Value                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| **Date**           | 2026-03-13                                                                    |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6)                                             |
| **Review Type**    | Adversarial code review with OWASP security audit (bmad-bmm-code-review yolo) |
| **Outcome**        | PASS (all issues resolved)                                                    |

**Issue Counts by Severity:**

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 1     |
| Low       | 1     |
| **Total** | **2** |

**Issues Found & Fixed:**

| ID  | Severity | Description                                                                                                                                                                                                                                          | Resolution                                                                                                                      |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Medium   | `handler.ts` REDUCER_FAILED branch double-prefixes error: `Reducer player_move failed: Reducer player_move failed: Bad arguments` because handler wraps with `Reducer {name} failed:` but `callReducer()` error message already includes that prefix | FIXED -- Use `err.message` directly since ReducerCallError already formats the message with `Reducer {name} failed: ...` prefix |
| L1  | Low      | `content-parser.ts` echoes rejected reducer name in error message without length restriction; attacker-controlled input up to ~1MB could produce verbose log entries                                                                                 | FIXED -- Truncated echoed reducer name to max 64 chars in error message                                                         |

**OWASP Top 10 Security Audit:**

| OWASP Category                     | Status | Notes                                                                                                                                                                                                     |
| ---------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01: Broken Access Control         | N/A    | BLS handler relies on SDK for Nostr signature verification; no direct access control decisions                                                                                                            |
| A02: Cryptographic Failures        | PASS   | SPACETIMEDB_TOKEN never logged, never in error messages; verified via grep and test coverage                                                                                                              |
| A03: Injection                     | PASS   | Reducer name validated with `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/` before URL interpolation; content size limited to 1MB; error body truncated to 256 chars; rejected reducer name truncated in error messages |
| A04: Insecure Design               | PASS   | Zero silent failures (NFR27) -- every handler execution results in ctx.accept() or ctx.reject(); all errors logged with full context                                                                      |
| A05: Security Misconfiguration     | PASS   | 30s AbortController timeout; clearTimeout on success prevents timer leak; health server binds to 127.0.0.1 by default                                                                                     |
| A06: Vulnerable Components         | N/A    | No new dependencies added; uses Node.js built-in fetch                                                                                                                                                    |
| A07: Identification/Authentication | PASS   | ctx.pubkey verified by SDK's createVerificationPipeline; handler trusts SDK verification                                                                                                                  |
| A08: Software/Data Integrity       | N/A    | No deserialization beyond JSON.parse with validated schema                                                                                                                                                |
| A09: Security Logging              | PASS   | All actions logged with eventId, truncated pubkey, reducer name, duration; NEVER logs secretKey, token, or signatures                                                                                     |
| A10: SSRF                          | PASS   | SpacetimeDB URL validated in config.ts (isValidHttpUrl); reducer name validated against strict regex before URL construction                                                                              |

**Review Follow-ups:** None -- all issues resolved in this pass.
