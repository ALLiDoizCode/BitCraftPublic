# Story 2.4: BLS Handler Integration Contract & Testing

Status: ready

<!--
Validation Status: VALIDATED & UNBLOCKED
Review Type: Adversarial Review via /bmad-review-adversarial-general
Reviewer: Claude Sonnet 4.5 (2026-02-27)
Architectural Decisions: RESOLVED (2026-02-28)
- BLOCKER-1 RESOLVED: Accept modifying BitCraft reducers to add identity parameter
- BLOCKER-2 RESOLVED: Wallet balance checks removed (EVM onchain wallets, out of scope)
- BLOCKER-3 RESOLVED: Crosstown implementation specs created
BMAD Standards: COMPLIANT
Ready for Implementation: YES
-->

## Story

As a Sigil SDK developer,
I want to document the BLS handler integration contract and add validation tests to the Sigil Client,
So that the Crosstown BLS handler (implemented separately) can be verified to correctly process ILP-routed game actions with identity propagation.

**Note:** This story does NOT implement the BLS handler (that lives in the Crosstown repository). This story defines the integration contract, documents requirements, adds validation tests in the Sigil SDK, and provides implementation specifications for the Crosstown team.

## Architectural Decisions (2026-02-28)

**Decision 1: Modify BitCraft Reducers (BLOCKER-1 RESOLVED)**
- BitCraft reducers WILL be modified to accept `identity: String` as the first parameter
- This enables identity propagation from Nostr events through to SpacetimeDB game state
- The "run unmodified" principle is superseded by the practical need for authenticated actions
- No technical debt - this is the accepted architectural approach

**Decision 2: Remove Wallet Balance Checks (BLOCKER-2 RESOLVED)**
- Wallet balance checks and ILP fee deduction are OUT OF SCOPE for this story
- Wallets are EVM onchain wallets, not SpacetimeDB state
- Wallet balance management is handled externally to SpacetimeDB
- Related acceptance criteria (AC7, AC9) removed

**Decision 3: Crosstown Implementation Specs (BLOCKER-3 RESOLVED)**
- Detailed implementation specification created: `docs/crosstown-bls-implementation-spec.md`
- Crosstown team will implement BLS handler using these specifications
- Integration tests in Sigil SDK validate the contract once Crosstown implementation is complete

## Acceptance Criteria

1. **BLS receives kind 30078 events via ILP routing (NFR19)**
   - **Given** a Crosstown BLS instance configured with a game action handler
   - **When** a kind 30078 Nostr event arrives via ILP routing from the Crosstown relay
   - **Then** the BLS validates the ILP payment (existing BLS logic)
   - **And** the event is forwarded to the game action handler for processing

2. **Event content parsing and validation (FR19)**
   - **Given** a valid ILP payment and kind 30078 event
   - **When** the BLS processes the game action
   - **Then** it parses the event content to extract `reducer` name and `args`
   - **And** validates the content is valid JSON with required fields (reducer: string, args: any)
   - **And** returns a clear error if content parsing fails

3. **Nostr signature validation (NFR8, NFR13)**
   - **Given** an incoming ILP packet with a kind 30078 event
   - **When** the BLS attempts signature validation
   - **Then** it verifies the event.sig against event.id using event.pubkey via secp256k1
   - **And** validates the event.id is correctly computed (SHA256 of canonical event serialization per NIP-01)
   - **And** rejects the packet before any reducer execution if signature is invalid or missing
   - **And** returns an explicit error to the sender identifying the signature validation failure

4. **SpacetimeDB reducer invocation with identity (FR4, FR19, FR47)**
   - **Given** a valid signature and parseable event content
   - **When** the BLS dispatches the game action to SpacetimeDB
   - **Then** it extracts the authoring Nostr public key from event.pubkey (hex string)
   - **And** calls the corresponding SpacetimeDB reducer via HTTP POST `/database/bitcraft/call/{reducer}`
   - **And** propagates the Nostr public key by prepending it to the reducer args array: `[nostr_pubkey, ...event.args]`
   - **And** passes the modified args array as the HTTP request body (JSON array)
   - **And** receives a success response from SpacetimeDB (200 OK)
   - **NOTE:** BitCraft reducers will be modified to accept `identity: String` as first parameter

5. **Unknown reducer handling**
   - **Given** an incoming event referencing a non-existent reducer
   - **When** the BLS attempts to dispatch
   - **Then** the action fails with a clear error identifying the unknown reducer name
   - **And** no SpacetimeDB HTTP call is made
   - **And** an error response is returned to the sender

6. **Zero silent failures (NFR27)**
   - **Given** any BLS reducer call processing step (parsing, validation, dispatch)
   - **When** identity propagation or reducer execution is attempted
   - **Then** it either succeeds with verified Nostr public key attribution or fails with an explicit error
   - **And** all errors are logged with sufficient detail for debugging (event ID, pubkey, reducer name, error reason)
   - **And** no silent failures occur (every error returns to sender or is logged)

7. **Error response propagation**
   - **Given** a failed game action (signature invalid, unknown reducer, or reducer error)
   - **When** the BLS completes error handling
   - **Then** an error response is returned to the Crosstown relay
   - **And** the relay forwards the error to the sender via Nostr NOTICE or OK message (per NIP-01)
   - **And** the error includes: event ID, error code, human-readable message

## Tasks / Subtasks

**IMPORTANT NOTE:** This story involves implementing the BLS game action handler, which is NOT part of the Sigil SDK codebase. The BLS handler lives in the Crosstown project (separate repository). The tasks below document the BLS implementation requirements and integration contract, but implementation MUST occur in the Crosstown repository.

**Sigil SDK Scope (Story 2.4):**
- Document BLS handler integration contract (event format, HTTP API, error responses)
- Add integration tests in Sigil Client that verify end-to-end action execution through BLS
- Update Sigil Client documentation with BLS handler requirements

**Crosstown BLS Scope (separate repository, separate story):**
- Implement BLS game action handler per contract below
- Add signature validation via secp256k1
- Add SpacetimeDB HTTP reducer call logic
- Add wallet balance checks and fee deduction
- Add comprehensive error handling

### Task 1: Document BLS Handler Integration Contract (AC1-AC9)

- [ ] Create `docs/bls-handler-contract.md` in Sigil SDK repository
  - [ ] Reference existing Kind 30078 event format from Story 2.3 implementation (`packages/client/src/publish/ilp-packet.ts`)
  - [ ] Document ILP packet structure: `{ reducer: string, args: any, fee: number }` (implemented in Story 2.3)
  - [ ] Document expected Nostr event fields: `{ id, pubkey, created_at, kind: 30078, tags, content, sig }` (per NIP-01)
  - [ ] Document signature validation requirements (NIP-01 canonical serialization, secp256k1 verification)
  - [ ] Document SpacetimeDB HTTP API contract:
    - Endpoint: `POST /database/{database_name}/call/{reducer}`
    - Headers: `Authorization: Bearer {token}`, `Content-Type: application/json`
    - Body: JSON array of reducer args with prepended pubkey: `[nostr_pubkey, ...event.args]` (e.g., `["abc123...", { "x": 100, "z": 200 }, { "x": 110, "z": 200 }, false]` for `player_move`)
    - **IMPORTANT:** Reducers must accept `nostr_pubkey: String` as first parameter (see BLOCKER-1)
    - Response: `200 OK { "success": true }` or `4xx/5xx` error
  - [ ] Document error response format: `{ "eventId": string, "errorCode": string, "message": string, "retryable": boolean }`
  - [ ] Document expected error codes: `INVALID_SIGNATURE`, `UNKNOWN_REDUCER`, `REDUCER_FAILED`, `INVALID_CONTENT`
  - [ ] Reference the Crosstown implementation specification: `/docs/crosstown-bls-implementation-spec.md`

### Task 2: Add BLS Handler Configuration Documentation (AC1)

- [ ] Update `docker/README.md` with BLS handler configuration instructions
  - [ ] Document environment variables for BLS handler:
    - `SPACETIMEDB_URL`: SpacetimeDB HTTP endpoint (default: `http://localhost:3000`)
    - `SPACETIMEDB_DATABASE`: Database name (default: `bitcraft`)
    - `SPACETIMEDB_TOKEN`: Authentication token for SpacetimeDB API (use admin token for MVP)
  - [ ] Document how to enable/disable BLS game action handler in Crosstown config
  - [ ] Document expected log output for BLS handler (connection, event processing, errors)
  - [ ] Document expected `docker-compose.yml` changes for BLS handler (implemented in Crosstown repository):
    - BLS handler should be configured to listen for kind 30078 events from Crosstown relay
    - BLS handler should have environment variables for SpacetimeDB connection
    - BLS handler should log all event processing (debug level) for integration test verification
  - [ ] Reference the detailed Crosstown implementation specification at `/docs/crosstown-bls-implementation-spec.md`

### Task 3: Add Integration Tests for BLS Handler (AC1-AC7)

**NOTE:** Integration tests in Sigil SDK validate the BLS handler contract. The Crosstown team will implement the BLS handler using the specification at `/docs/crosstown-bls-implementation-spec.md`. Mark tests as `@skip` until Crosstown BLS handler is deployed. Alternative: implement mock BLS responses for contract validation without external dependency.

- [ ] Create `packages/client/src/integration-tests/bls-handler.integration.test.ts`
  - [ ] **Test AC1:** Verify kind 30078 event is accepted by BLS
    - Setup: Start Docker stack with Crosstown + BLS + SpacetimeDB
    - Action: Call `client.publish({ reducer: 'test_reducer', args: [] })`
    - Assert: Event is published to relay, BLS receives event, no errors
  - [ ] **Test AC2:** Verify event content parsing
    - Setup: Publish event with valid JSON content `{ reducer: "test_reducer", args: [1, 2, 3], fee: 100 }`
    - Assert: BLS parses content successfully, extracts reducer and args
  - [ ] **Test AC2:** Verify event content parsing error handling
    - Setup: Manually construct event with invalid JSON content (malformed JSON)
    - Action: Publish to relay
    - Assert: BLS rejects event with `INVALID_CONTENT` error, error propagated to sender
  - [ ] **Test AC3:** Verify signature validation success
    - Setup: Publish event with valid Nostr signature (signed via `client.identity.sign()`)
    - Assert: BLS validates signature, event is processed
  - [ ] **Test AC3:** Verify signature validation failure
    - Setup: Manually construct event with invalid signature (wrong sig field)
    - Action: Publish to relay
    - Assert: BLS rejects event with `INVALID_SIGNATURE` error before reducer call, error propagated to sender
  - [ ] **Test AC4:** Verify SpacetimeDB reducer call with identity
    - Setup: Publish event for known reducer (e.g., `player_move` if available, or mock reducer)
    - Assert: SpacetimeDB HTTP endpoint receives POST with correct headers (`X-Nostr-Pubkey`), correct body (args array), reducer executes
  - [ ] **Test AC5:** Verify unknown reducer handling
    - Setup: Publish event with non-existent reducer name `unknown_reducer`
    - Assert: BLS rejects with `UNKNOWN_REDUCER` error, no SpacetimeDB call made, error propagated
  - [ ] **Test AC6:** Verify all errors are logged and returned
    - Setup: Trigger various error conditions (invalid sig, unknown reducer, parse error)
    - Assert: Each error is logged with event ID, pubkey, reducer name, error reason
    - Assert: Each error returns to sender with error code and message
  - [ ] **Test AC7:** Verify error response propagation
    - Setup: Trigger reducer failure (e.g., invalid args causing reducer to fail)
    - Assert: Error response includes event ID, `REDUCER_FAILED` code, human-readable message
  - [ ] **Test NFR3:** Verify round-trip performance under normal load
    - Setup: Single client, simulated <50ms network latency, no concurrent load
    - Action: Call `client.publish()` and measure time until confirmation event received
    - Assert: Round-trip completes within 2 seconds (2000ms)
    - Assert: Log warning if exceeds 1 second (performance degradation indicator)

### Task 4: Update Client API Documentation (AC4)

- [ ] Update `packages/client/README.md` (when created) with BLS handler section
  - [ ] Document that `client.publish()` requires BLS handler to be running
  - [ ] Document BLS handler contract reference (link to `docs/bls-handler-contract.md`)
  - [ ] Document error handling for BLS responses (via `client.on('publishError', handler)`)
  - [ ] Add example of handling publish errors:
    ```typescript
    client.on('publishError', (error) => {
      console.error(`Action failed: ${error.message} (code: ${error.code})`);
    });

    try {
      await client.publish({ reducer: 'player_move', args: [origin, dest] });
    } catch (error) {
      // Handle publish error (e.g., invalid signature, unknown reducer, reducer failure)
    }
    ```

### Task 5: Add BLS Handler Contract Validation (AC1-AC7) - OPTIONAL

**NOTE:** This task adds automated contract validation tooling beyond the integration tests in Task 3. It's useful for CI but not required by ACs. Consider deferring to Story 2.5 or Epic 3 if time-constrained.

- [ ] Create `packages/client/src/validation/bls-contract-validator.ts`
  - [ ] Export `validateBLSContract()` function that checks BLS handler is running and compliant
  - [ ] Validate BLS accepts kind 30078 events (send test event, verify acceptance or rejection)
  - [ ] Validate BLS rejects invalid signatures (send event with wrong sig, verify rejection)
  - [ ] Validate BLS rejects malformed content (send event with invalid JSON, verify rejection)
  - [ ] Validate BLS returns expected error codes (INVALID_SIGNATURE, UNKNOWN_REDUCER, INVALID_CONTENT)
  - [ ] Add CLI command `pnpm validate:bls` to run contract validation
  - [ ] Add contract validation to CI pipeline (runs after Docker stack starts)

### Task 6: Add Error Code Enum and Types (AC7)

- [ ] Create `packages/client/src/bls/types.ts`
  - [ ] Export `BLSErrorCode` enum:
    ```typescript
    export enum BLSErrorCode {
      INVALID_SIGNATURE = 'INVALID_SIGNATURE',
      UNKNOWN_REDUCER = 'UNKNOWN_REDUCER',
      REDUCER_FAILED = 'REDUCER_FAILED',
      INVALID_CONTENT = 'INVALID_CONTENT',
    }
    ```
  - [ ] Export `BLSErrorResponse` interface:
    ```typescript
    export interface BLSErrorResponse {
      eventId: string;
      errorCode: BLSErrorCode;
      message: string;
      retryable: boolean;  // true for REDUCER_FAILED, false for INVALID_SIGNATURE/UNKNOWN_REDUCER/INVALID_CONTENT
    }
    ```
  - [ ] Export `BLSSuccessResponse` interface:
    ```typescript
    export interface BLSSuccessResponse {
      eventId: string;
      success: true;
    }
    ```
  - [ ] Update `client.publish()` to handle BLSErrorResponse (parse from Nostr OK message or NOTICE)

### Task 7: Add BLS Handler Smoke Test (AC1-AC7)

- [ ] Create `scripts/bls-handler-smoke-test.ts`
  - [ ] Script creates SigilClient, loads identity, connects to relay
  - [ ] Publishes test action: `{ reducer: 'test_action', args: [] }`
  - [ ] Waits for action confirmation event (kind 30078 via relay subscription)
  - [ ] Validates confirmation includes correct event ID, reducer name, pubkey
  - [ ] Exits with code 0 on success, code 1 on failure
  - [ ] Add npm script: `pnpm smoke:bls` to run smoke test
  - [ ] Add smoke test to CI pipeline (runs after Docker stack is healthy)

### Task 8: Provide Crosstown Implementation Specification

- [x] Create comprehensive implementation specification for Crosstown BLS handler team
  - [x] Document event flow architecture and component responsibilities
  - [x] Define all data structures (event format, HTTP API, error responses)
  - [x] Specify implementation requirements (signature validation, content parsing, identity propagation)
  - [x] Provide pseudocode examples for each requirement
  - [x] Define testing strategy (unit tests, integration tests, performance benchmarks)
  - [x] Document configuration (environment variables, sample config files)
  - [x] Create success criteria and handoff process
- [x] File created: `/docs/crosstown-bls-implementation-spec.md`

## NFR Traceability

| NFR | Requirement | AC Coverage |
|-----|-------------|-------------|
| NFR8 | Cryptographic verification using Nostr signatures (secp256k1) and NIP-01 event IDs | AC3 |
| NFR13 | No action attributed without valid signature from private key | AC3, AC6 |
| NFR19 | NIP-01 compliant Nostr relay integration (via Crosstown built-in relay) | AC1, AC2 |
| NFR27 | Zero silent failures (explicit errors returned for all failure modes) | AC6, AC8 |

## FR Traceability

| FR | Requirement | AC Coverage |
|-----|-------------|-------------|
| FR4 | Every game action attributed to authoring Nostr public key via BLS identity propagation | AC4 |
| FR19 | Agents can publish game actions via Nostr relay events (kind 30078) and receive confirmations | AC1, AC2, AC4 |
| FR47 | BLS validates ILP payments and forwards actions to SpacetimeDB with identity propagation | AC1, AC3, AC4 |

**Note:** FR20 (ILP fee collection) is out of scope for this story. Wallet balance checks and fee deduction are removed as wallets are EVM onchain wallets, not SpacetimeDB state.

## Dependencies

**Required (Must Complete Before Story 2.4):**
- Story 1.2 (Nostr Identity Management) - DONE
- Story 1.4 (SpacetimeDB Connection) - DONE
- Story 2.1 (Crosstown Relay Connection) - DONE
- Story 2.2 (Action Cost Registry & Wallet Balance) - DONE
- Story 2.3 (ILP Packet Construction & Signing) - DONE

**External Dependency (Crosstown Team):**
- **BLS Game Action Handler Implementation** (Crosstown repository)
  - Implementation specification: `/docs/crosstown-bls-implementation-spec.md`
  - Scope: Implement BLS handler per specification (signature validation, SpacetimeDB HTTP calls, error handling)
  - Integration tests in Sigil SDK (Task 3) can be marked `@skip` until BLS handler is deployed
  - Handoff: Crosstown team implements BLS handler, Sigil SDK team validates with integration tests

**Blocks (Cannot Start Until Story 2.4 Complete):**
- Story 2.5 (Identity Propagation & Verification) - depends on BLS reducer calls working

## Story Sizing

**Complexity:** Medium
- Contract documentation and integration tests (Sigil SDK side) is straightforward
- BLS handler implementation (Crosstown side) is more complex (signature validation, HTTP calls, error handling)
- Integration testing requires coordinating Docker stack with BLS + relay + SpacetimeDB
- Wallet balance checks removed (out of scope) reduces complexity

**Effort Estimate (Sigil SDK Only):** 10 hours
- Task 1: BLS contract documentation - 2 hours
- Task 2: Docker configuration documentation - 1 hour
- Task 3: Integration tests - 4 hours (reduced from 6 hours - wallet tests removed)
- Task 4: Client API documentation - 1 hour
- Task 5: Contract validation (OPTIONAL) - 0 hours (deferred)
- Task 6: Error types - 1 hour (includes retryable field)
- Task 7: Crosstown implementation specification - 1 hour (creating `/docs/crosstown-bls-implementation-spec.md`)

**NOTE:** Crosstown BLS handler implementation effort is external to this story. The comprehensive implementation specification (`/docs/crosstown-bls-implementation-spec.md`) provides the Crosstown team with all necessary details.

**Risk Areas:**
1. **Crosstown BLS handler implementation** - Requires coordination with Crosstown team
   - Mitigation: Comprehensive implementation specification provided (`/docs/crosstown-bls-implementation-spec.md`)
2. **Signature validation complexity** - secp256k1 verification, NIP-01 event ID computation
   - Mitigation: Implementation spec references well-tested libraries (`@noble/secp256k1` for Node.js)
3. **SpacetimeDB HTTP API authentication** - Requires valid auth token
   - Mitigation: Document token configuration, use admin token for MVP
4. **Integration test coordination** - Tests depend on Crosstown BLS handler being deployed
   - Mitigation: Tests can be marked `@skip` until BLS handler is available

## Technical Design Notes

### BLS Handler Architecture (from PREP-5 Spike)

The BLS handler receives kind 30078 events from the Crosstown relay and processes them as follows:

1. **Event Reception** (via Crosstown relay event router)
   - Crosstown relay checks `event.kind === 30078`
   - If true, forwards event to BLS game action handler
   - BLS handler receives full Nostr event object

2. **Signature Validation** (secp256k1)
   - Validate `event.id` is correctly computed:
     ```typescript
     const eventId = sha256(JSON.stringify([
       0,                    // Reserved for future use
       event.pubkey,         // Hex public key
       event.created_at,     // Unix timestamp
       event.kind,           // 30078
       event.tags,           // Array of tag arrays
       event.content,        // JSON string
     ]));
     ```
   - Verify `event.sig` is valid signature of `event.id` using `event.pubkey` (secp256k1 ECDSA)
   - Reject if signature invalid or missing (return `INVALID_SIGNATURE` error)

3. **Content Parsing**
   - Parse `event.content` as JSON: `{ reducer: string, args: any, fee: number }`
   - Validate required fields present (reducer, args)
   - Reject if parse fails or fields missing (return `INVALID_CONTENT` error)

4. **Wallet Balance Check** (Story 2.2 integration)
   - Query wallet balance for `event.pubkey` (from Story 2.2 wallet state)
   - Check `balance >= fee`
   - Reject if insufficient balance (return `INSUFFICIENT_BALANCE` error)

5. **SpacetimeDB Reducer Call** (HTTP API)
   - Build HTTP request:
     - Method: `POST`
     - URL: `${SPACETIMEDB_URL}/database/${SPACETIMEDB_DATABASE}/call/${reducer}`
     - Headers:
       - `Authorization: Bearer ${SPACETIMEDB_TOKEN}`
       - `X-Nostr-Pubkey: ${event.pubkey}` (identity propagation)
       - `Content-Type: application/json`
     - Body: `JSON.stringify(args)` (array of reducer arguments)
   - Send request, await response
   - If 404: return `UNKNOWN_REDUCER` error
   - If 4xx/5xx: return `REDUCER_FAILED` error with response message
   - If 200 OK: proceed to fee deduction

6. **Fee Deduction** (atomic with reducer success)
   - Deduct `fee` from wallet balance for `event.pubkey`
   - Commit wallet state
   - Return success response to relay

7. **Error Response** (all failure paths)
   - Build error response: `{ eventId: event.id, errorCode: string, message: string }`
   - Return to Crosstown relay
   - Relay forwards error to sender via Nostr OK message: `["OK", event.id, false, message]`

### Identity Propagation via HTTP Header

The BLS handler propagates identity to SpacetimeDB via the `X-Nostr-Pubkey` HTTP header. SpacetimeDB must be configured to:
1. Read `X-Nostr-Pubkey` header from HTTP requests
2. Set `ctx.sender` (reducer context) to the Nostr public key from the header
3. Validate header is present (reject if missing)

**SpacetimeDB Reducer Context:**
```rust
#[reducer]
fn player_move(ctx: &ReducerContext, origin: Point, dest: Point, running: bool) {
  let player_identity = ctx.sender; // Nostr pubkey from X-Nostr-Pubkey header
  // Execute game logic with identity
}
```

**Note:** SpacetimeDB v1.6.x does NOT natively support custom identity propagation via HTTP headers. This requires either:
- **Option A:** Modify SpacetimeDB server to read `X-Nostr-Pubkey` header and set `ctx.sender` (BLOCKED by upstream dependency)
- **Option B:** Pass Nostr pubkey as first argument to every reducer (simpler, no server modification needed)

**DECISION (from PREP-5):** Use **Option B** for MVP. BLS handler prepends `event.pubkey` to args array before calling reducer:
```typescript
// BLS handler transformation
const reducerArgs = [event.pubkey, ...parsedContent.args];
const response = await fetch(`${SPACETIMEDB_URL}/database/${database}/call/${reducer}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(reducerArgs),
});
```

**SpacetimeDB Reducer Pattern (Option B):**
```rust
#[reducer]
fn player_move(ctx: &ReducerContext, nostr_pubkey: String, origin: Point, dest: Point, running: bool) {
  // nostr_pubkey is first argument, guaranteed by BLS
  let player_identity = nostr_pubkey;
  // Execute game logic with identity
}
```

**Tradeoff:** Option B requires modifying reducer signatures to accept `nostr_pubkey` as first arg. This is a **breaking change** to BitCraft reducers (violates "run unmodified" principle). However, it's the only viable option until SpacetimeDB v2.0 supports custom context injection.

**REVISED DECISION (for Story 2.4):** Document **both patterns** in BLS contract. Integration tests use **Option B** (prepend pubkey to args) for MVP. If SpacetimeDB upstream adds header-based identity in future, BLS handler can switch to Option A without client changes (transparent upgrade).

### Error Handling Contract

All BLS errors follow this format:
```typescript
interface BLSErrorResponse {
  eventId: string;          // Event ID that failed
  errorCode: BLSErrorCode;  // INVALID_SIGNATURE | UNKNOWN_REDUCER | INSUFFICIENT_BALANCE | REDUCER_FAILED | INVALID_CONTENT
  message: string;          // Human-readable error message
}
```

Errors are returned to Crosstown relay, which forwards them to sender via Nostr OK message:
```json
["OK", "<event_id>", false, "<errorCode>: <message>"]
```

Example:
```json
["OK", "abc123...", false, "INVALID_SIGNATURE: Signature verification failed for event abc123"]
```

### Testing Strategy

**Unit Tests (Crosstown BLS):**
- Test signature validation (valid sig, invalid sig, missing sig)
- Test content parsing (valid JSON, invalid JSON, missing fields)
- Test wallet balance checks (sufficient, insufficient, edge cases)
- Test SpacetimeDB HTTP call construction (headers, body, URL)
- Test error response construction (all error codes)

**Integration Tests (Sigil SDK):**
- Test end-to-end action execution (client.publish → BLS → SpacetimeDB)
- Test error propagation (invalid sig → client receives error)
- Test wallet deduction (fee charged on success)
- Test unknown reducer handling (error returned to client)

**Smoke Test:**
- Quick validation that BLS handler is running and functional
- Runs in CI after Docker stack starts
- Catches basic integration issues before running full test suite

## Security Considerations (OWASP Top 10)

**A01: Broken Access Control**
- Mitigation: Signature validation ensures only owner of private key can publish actions for that public key
- BLS rejects all actions without valid signature (AC3)

**A02: Cryptographic Failures**
- Mitigation: Use secp256k1 for signature validation (industry standard for Nostr)
- Validate event.id computation per NIP-01 spec (canonical serialization)
- No custom crypto implementation (use well-tested libraries)

**A03: Injection**
- Mitigation: Validate reducer name (alphanumeric only, no path traversal)
- Validate args are valid JSON (reject malformed content)
- SpacetimeDB reducer args are type-checked by SpacetimeDB (no SQL injection risk)

**A04: Insecure Design**
- Mitigation: Zero silent failures (AC6) - every error is explicit and logged
- Atomic fee deduction (AC7) - fee charged only if reducer succeeds

**A05: Security Misconfiguration**
- Mitigation: Document all BLS environment variables (Task 2)
- Require explicit configuration for SpacetimeDB token (no defaults)
- **RISK (MVP):** Using admin token for BLS handler (Open Question Q2) - overly permissive, grants full SpacetimeDB access
  - **Mitigation (MVP):** Document risk, plan service account migration in Epic 6
  - **Mitigation (Production):** Create service account with reducer-only permissions before production deployment

**A06: Vulnerable and Outdated Components**
- Mitigation: Use latest secp256k1 library version
- Add dependency audit to CI (`pnpm audit`, `cargo audit`)

**A07: Identification and Authentication Failures**
- Mitigation: Nostr signature = authentication (AC3)
- No password or session-based auth (stateless, signature-based only)

**A08: Software and Data Integrity Failures**
- Mitigation: Validate event.id matches computed hash (prevents event tampering)
- Signature validation prevents event forgery

**A09: Security Logging and Monitoring Failures**
- Mitigation: Log all BLS events (AC6) - event ID, pubkey, reducer, success/failure
- Log errors with full context (error code, message, event details)

**A10: Server-Side Request Forgery (SSRF)**
- Mitigation: SpacetimeDB URL is configured (not user-controlled)
- No dynamic URL construction from event content

## Open Questions

**Q1: How does BLS handler access wallet balance state from Story 2.2?**
- Answer: Wallet state lives in-memory in `@sigil/client`. BLS needs separate wallet state.
- Options:
  - A) BLS maintains own wallet state (duplicate of client state) - Simple but inconsistent
  - B) BLS queries SpacetimeDB for wallet balance (if wallet state is in a table) - Requires wallet table in SpacetimeDB
  - C) BLS queries Sigil Client via API (e.g., HTTP endpoint) - Requires client to run API server
- **DECISION (for Story 2.4):** Use **Option B**. Add `wallets` table to SpacetimeDB schema with columns `(nostr_pubkey, balance)`. BLS queries this table before reducer call. Story 2.2 should seed initial wallet balances in this table.

**Q2: What is the SpacetimeDB authentication token for BLS reducer calls?**
- Answer: SpacetimeDB v1.6.x uses token-based auth for HTTP API. BLS needs a token with reducer execution permissions.
- Options:
  - A) Admin token (full permissions) - Simple but overly permissive
  - B) Service account token (reducer-only permissions) - More secure
- **DECISION (for Story 2.4):** Use **Option A** for MVP (admin token). Document in Task 2. Future: add service account support.

**Q3: How does BLS handle SpacetimeDB downtime or network errors?**
- Answer: Retry logic needed for transient failures (network timeout, 503 Service Unavailable).
- Options:
  - A) Retry with exponential backoff (same pattern as Story 1.6 reconnection) - Robust
  - B) Fail immediately, client retries - Simpler
- **DECISION (for Story 2.4):** Use **Option B** for MVP. BLS returns `REDUCER_FAILED` error immediately. Client can retry via `client.publish()` again. Future: add BLS-side retry logic.

**Q4: What happens if reducer execution is slow (>30s timeout)?**
- Answer: HTTP timeout needed to prevent hanging BLS handler.
- **DECISION (for Story 2.4):** BLS uses 30s HTTP timeout for SpacetimeDB calls. If timeout exceeded, return `REDUCER_FAILED` error with "timeout" message. Document in Task 1.

## Definition of Done

**Blockers Resolved:**
- [ ] BLOCKER-1: Identity propagation architecture decision documented (DEBT-4 added, proceed with Option B)
- [ ] BLOCKER-2: Story 2.2.1 (Wallet State Migration) completed and `wallets` table exists in SpacetimeDB
- [ ] BLOCKER-3: Crosstown story CT-2.4 created and tracked as external dependency

**Sigil SDK Deliverables:**
- [ ] All acceptance criteria (AC1-AC9) have passing tests
- [ ] BLS handler integration contract documented (`docs/bls-handler-contract.md`)
- [ ] Integration tests added for all ACs (marked `@skip` until Crosstown CT-2.4 completes)
- [ ] Docker configuration documented (`docker/README.md`)
- [ ] Client API documentation updated with BLS handler section
- [ ] Error types and enums added (`packages/client/src/bls/types.ts`)
- [ ] Smoke test added (`pnpm smoke:bls`, marked `@skip` until CT-2.4 completes)
- [ ] Security review complete (OWASP Top 10 checklist passed, admin token risk documented)
- [ ] Code review complete (no `any` types, error handling present)

**Integration Validation (requires external dependencies):**
- [ ] Crosstown CT-2.4 (BLS Handler Implementation) completed
- [ ] Integration tests unmarked from `@skip` and passing
- [ ] Smoke test unmarked from `@skip` and passing
- [ ] Performance test (NFR3) validates <2s round-trip under normal load
- [ ] Test traceability documented (AC → Test mapping in story report)
- [ ] Documentation updated (CLAUDE.md, docker/README.md, client README)

## References

- [PREP-5: BLS Handler Architecture Spike](_bmad-output/implementation-artifacts/prep-5-bls-handler-spike.md) - Detailed architecture research
- [Story 2.1: Crosstown Relay Connection](_bmad-output/implementation-artifacts/2-1-crosstown-relay-connection-and-event-subscriptions.md) - Nostr relay integration
- [Story 2.2: Action Cost Registry & Wallet Balance](_bmad-output/implementation-artifacts/2-2-action-cost-registry-and-wallet-balance.md) - Wallet state and fee calculation
- [Story 2.3: ILP Packet Construction & Signing](_bmad-output/implementation-artifacts/2-3-ilp-packet-construction-and-signing.md) - Kind 30078 event creation
- [NIP-01: Basic Protocol Flow](https://github.com/nostr-protocol/nips/blob/master/01.md) - Nostr event format and signature validation
- [SpacetimeDB HTTP API](https://spacetimedb.com/docs) - Reducer call endpoint documentation

---

## Adversarial Review Findings Report

**Review Date:** 2026-02-27
**Reviewer:** Claude Sonnet 4.5 (BMAD Adversarial Review Agent)
**Review Type:** Pre-Implementation Story Validation
**Total Issues Found:** 30

### Critical Issues (BLOCKING - 3 issues)

1. **Violation of "Run BitCraft Unmodified" Design Principle**
   - Technical Design Notes propose "Option B" (prepend `nostr_pubkey` to all reducer args)
   - Requires modifying BitCraft reducer signatures to accept `nostr_pubkey` as first parameter
   - **VIOLATION:** Core architecture principle states "BitCraft server runs unmodified"
   - **FIXED:** Documented as BLOCKER-1 with decision required, added DEBT-4 recommendation

2. **Incomplete Wallet State Architecture**
   - Story 2.2 implemented wallet state as in-memory in `@sigil/client`, AC7 requires BLS to query balance
   - Open Question Q1 proposes SpacetimeDB `wallets` table, but this doesn't exist
   - **CONFLICT:** BLS handler (Crosstown) cannot access in-memory client state
   - **FIXED:** Documented as BLOCKER-2, added Story 2.2.1 prerequisite to Dependencies section

3. **Undefined Crosstown Implementation Ownership**
   - Story claims BLS handler is "separate repository, separate story" but provides no tracking
   - No reference to Crosstown story ID, no coordination mechanism
   - **FIXED:** Documented as BLOCKER-3, added Crosstown CT-2.4 to Dependencies with effort estimate

### Major Issues (5 issues)

4. **Unclear Story Ownership** - FIXED: Changed story title to "BLS Handler Integration Contract & Testing"
5. **NFR3 Performance Requirement Untestable** - FIXED: Added performance test to Task 3
6. **AC4 HTTP Header Propagation Contradicted by Implementation** - FIXED: Updated AC4 to reflect Option B (prepend to args)
7. **Incomplete Error Code Coverage** - FIXED: Added AC9 for fee rollback, updated Task 3 tests
8. **Missing AC for Fee Rollback on Reducer Failure** - FIXED: Added AC9 with rollback scenario

### Medium Issues (5 issues)

9. **Task 1 Duplicate Work** - FIXED: Updated Task 1 to reference Story 2.3 implementation
10. **Inconsistent Timeout Values** - DOCUMENTED: Client-side (2s) vs BLS-side (30s) timeouts clarified in design notes
11. **Missing Security Review for Admin Token** - FIXED: Added security risk documentation in A05 section
12. **Vague "Normal Load" Definition** - PARTIALLY FIXED: Story doesn't have AC2 from 2.3, but NFR3 test added with specific load definition
13. **Missing Traceability for FR47** - ACCEPTED: FR47 validates ILP payments (BLS logic), not testable in Sigil SDK

### Minor Issues (11 issues)

14. **Inconsistent Story Status** - FIXED: Changed status from `backlog` to `planned`
15. **Task Effort Estimates Don't Account for Crosstown Work** - FIXED: Updated story sizing to 28-34 hours total
16. **Redundant Validation Comment** - ACCEPTED: Both locations serve different purposes (header vs summary)
17. **Task 7 is Not a Task** - FIXED: Merged Task 7 into Task 2, renumbered Task 8 to Task 7
18. **Smoke Test Depends on Unimplemented Confirmation Events** - ACCEPTED: Confirmation events from BLS not in scope (CT-2.4)
19. **Missing Link to PREP-5 Spike** - FIXED: Changed relative paths to absolute in References section
20. **Undefined "Crosstown Connector URL"** - ACCEPTED: Story references relay (Story 2.1), not connector
21. **No Acceptance Criterion for Zero Silent Failures** - ACCEPTED: AC6 covers zero silent failures adequately
22. **Task 5 Contract Validation Creates New API** - FIXED: Marked Task 5 as OPTIONAL
23. **Missing Definition for "Sufficient Detail for Debugging"** - ACCEPTED: AC6 examples are sufficient guidance
24. **Inconsistent Validation Header** - FIXED: Updated validation header to reflect adversarial review status

### Optimization Opportunities (6 issues)

25. **Task 3 Should Use Test Fixtures** - DEFERRED: Test fixtures can be shared in implementation
26. **BLS Error Response Could Include Retry Guidance** - FIXED: Added `retryable: boolean` field to BLSErrorResponse
27. **Action Cost Registry Could Be Pre-Loaded in BLS** - DEFERRED: Optimization for Epic 6
28. **Story Could Leverage Story 1.6 Reconnection Pattern** - DEFERRED: BLS retry logic deferred per Open Question Q3
29. **Task Order Suboptimal** - ACCEPTED: Task 6 before Task 3 is minor inconvenience, not blocking
30. **AC7 Wallet Query Not Explicit** - FIXED: Added "BLS queries SpacetimeDB `wallets` table" to AC7

### Summary of Changes Made

- **Story Status:** Changed from `backlog` to `planned` (BLOCKED)
- **Story Title:** Changed from "BLS Game Action Handler" to "BLS Handler Integration Contract & Testing"
- **Story Description:** Clarified scope (contract documentation, NOT BLS implementation)
- **Critical Blockers Section:** Added with 3 blockers and action items
- **Acceptance Criteria:** Added AC9 for fee rollback, updated AC4 and AC7 for accuracy
- **Tasks:** Merged Task 7 into Task 2, marked Task 5 optional, updated all task headers to AC1-AC9
- **Dependencies:** Added Story 2.2.1 prerequisite, added Crosstown CT-2.4 external dependency with effort estimate
- **Story Sizing:** Updated from 16 hours to 14 hours (Sigil SDK) and 28-34 hours (total)
- **Security Considerations:** Added admin token risk documentation
- **Definition of Done:** Added blocker resolution checklist, integration validation section
- **References:** Changed relative paths to absolute paths
- **Error Types:** Added `retryable` field to BLSErrorResponse
- **Story Review Summary:** Comprehensive update with adversarial findings, blocking actions, mitigation strategy

---

## Story Review & Validation Summary

**Review Status:** Adversarial review completed 2026-02-27, architectural decisions resolved 2026-02-28, **READY**

**Story Quality Metrics:**
- Acceptance Criteria: 7 (reduced from 9, removed AC7 and AC9 wallet balance checks)
- FR Coverage: 3 (FR4, FR19, FR47 - FR20 out of scope)
- NFR Coverage: 4 (NFR8, NFR13, NFR19, NFR27)
- Tasks: 8 (added Task 8 for Crosstown implementation specification)
- Estimated Effort: 10 hours (Sigil SDK only)
- Dependencies: 5 required (all complete), 1 external (Crosstown BLS handler implementation - spec provided)

**Adversarial Review Findings:**
- **30 issues identified** across critical (3), major (5), medium (5), minor (11), and optimization (6) categories
- **3 CRITICAL BLOCKERS** prevent implementation from starting:
  1. Identity propagation violates "run BitCraft unmodified" design principle
  2. Wallet state architecture conflict between Story 2.2 and BLS requirements
  3. Undefined Crosstown implementation ownership and coordination
- **All 30 issues documented and addressed** in this review iteration

**Key Design Decisions (Updated):**
1. **CHANGED:** Story scope limited to contract documentation and validation (NOT BLS implementation)
2. **CHANGED:** Identity propagation uses Option B (prepend pubkey to args) - **design principle violation documented as DEBT-4**
3. **CHANGED:** Wallet state MUST migrate to SpacetimeDB `wallets` table (Story 2.2.1 prerequisite added)
4. **CHANGED:** Crosstown story CT-2.4 must be created and tracked before proceeding
5. BLS uses admin token for MVP (service account support deferred, security risk documented)
6. No BLS-side retry logic for MVP (client retries via `client.publish()`)
7. **NEW:** Integration tests marked `@skip` until external dependencies complete

**Risks Identified (Updated):**
1. **CRITICAL:** Design principle violation (Option B modifies reducer signatures)
2. **CRITICAL:** Missing prerequisite Story 2.2.1 (wallet state migration)
3. **CRITICAL:** No coordination mechanism with Crosstown team
4. **HIGH:** Admin token security risk (overly permissive for MVP)
5. SpacetimeDB authentication token management
6. Atomic fee deduction complexity
7. Signature validation library compatibility

**Mitigation Strategy (Updated):**
- Document DEBT-4 for design principle violation, plan migration in Epic 6
- Create Story 2.2.1 with 2-4 hour estimate for wallet table migration
- Create Crosstown story CT-2.4 with 12-16 hour estimate, link as external dependency
- Clear contract documentation (Task 1) to guide Crosstown implementation
- Reference implementation guidance from PREP-5
- Integration tests marked `@skip` until dependencies resolve
- Security review flags admin token risk, plans service account migration

**Architectural Decisions (2026-02-28):**
1. ✅ **BLOCKER-1 RESOLVED:** Accept modifying BitCraft reducers to add identity parameter (first arg)
2. ✅ **BLOCKER-2 RESOLVED:** Remove wallet balance checks from scope (EVM onchain wallets, not SpacetimeDB)
3. ✅ **BLOCKER-3 RESOLVED:** Created comprehensive Crosstown implementation specification (`/docs/crosstown-bls-implementation-spec.md`)

**Next Steps:**
1. Implement Tasks 1-8 in Sigil SDK (10 hours estimated)
2. Coordinate with Crosstown team to implement BLS handler using provided specification
3. Integration tests can be marked `@skip` until Crosstown BLS handler is deployed
4. Validate integration once Crosstown BLS handler is complete
5. Mark story as `done` when all acceptance criteria pass

---
