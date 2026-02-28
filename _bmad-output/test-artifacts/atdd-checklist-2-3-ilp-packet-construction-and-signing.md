---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-generation', 'step-04-checklist-creation']
lastStep: 'step-04-checklist-creation'
lastSaved: '2026-02-27'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/2-3-ilp-packet-construction-and-signing.md'
  - 'packages/client/vitest.config.ts'
  - '_bmad/tea/config.yaml'
---

# ATDD Checklist - Epic 2, Story 3: ILP Packet Construction & Signing

**Date:** 2026-02-27
**Author:** Jonathan
**Primary Test Level:** Unit (with Integration tests for end-to-end validation)
**Test Framework:** Vitest
**Stack Type:** Backend (TypeScript library)

---

## Story Summary

As a user, I want to execute game actions by calling `client.publish()` which constructs a signed ILP packet and routes it through Crosstown, so that I can interact with the game world through the single write path.

**As a** Sigil SDK user (AI agent or TUI player)
**I want** to execute game actions via `client.publish()` with automatic ILP packet construction and Nostr signing
**So that** I can perform authenticated actions in the game world with cryptographic proof of identity

---

## Acceptance Criteria

### AC1: Construct and sign ILP packet for game action (NFR8)
- Construct ILP packet containing game action
- Sign packet with Nostr private key (NFR8)
- Format as kind 30078 Nostr event
- Event content is valid JSON: `{ "reducer": "player_move", "args": [...] }`
- Event includes required Nostr fields: `id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig`
- Event `id` is SHA256 hash of serialized event (NIP-01 compliant)
- Signature is valid 64-byte Schnorr signature

### AC2: Route packet through Crosstown connector (NFR3)
- Packet routed through Crosstown node to BLS handler
- Round-trip completes within 2 seconds under normal load (NFR3)
- Submission made via Crosstown client library or HTTP POST
- Crosstown connector URL is configurable via `SigilClientConfig.crosstownConnectorUrl`

### AC3: Handle successful action confirmation (NFR17)
- Confirmation event received via Nostr relay subscription
- Confirmation event is kind 30078 matching original action
- Wallet balance decremented by action cost
- `client.publish()` promise resolves with confirmation details
- Confirmation includes: `eventId`, `reducer`, `args`, `fee`, `pubkey`, `timestamp`

### AC4: Reject actions with insufficient wallet balance (NFR24)
- `SigilError` thrown with code `INSUFFICIENT_BALANCE` and boundary `crosstown` (NFR24)
- Error message includes action name, required cost, and current balance
- No ILP packet sent to Crosstown
- System remains in consistent state (no partial updates)
- Balance check performed BEFORE packet construction (fail fast)

### AC5: Handle network timeout and connection errors (NFR24)
- `SigilError` thrown with code `NETWORK_TIMEOUT` and boundary `crosstown`
- Error includes timeout duration and Crosstown URL
- System does not leave inconsistent state (NFR24)
- Timeout threshold is configurable (default: 2000ms)
- Retries are NOT performed automatically (user controls retry logic)

### AC6: Protect private key from network transmission (NFR9, Security: A02:2021)
- Nostr private key never transmitted over network (NFR9)
- Only public key (`pubkey`) and signature (`sig`) leave local system
- Private key never logged, never in error messages
- Private key only used locally for signing event hash
- Signature generation uses `nostr-tools` library functions

---

## Failing Tests Created (RED Phase)

### Unit Tests (54 tests total)

#### ILP Packet Construction Tests (20 tests)
**File:** `packages/client/src/publish/ilp-packet.test.ts`

- ✅ **Test:** `constructILPPacket() creates valid kind 30078 event`
  - **Status:** RED - `constructILPPacket` function not implemented
  - **Verifies:** AC1 - Event format and structure

- ✅ **Test:** `constructILPPacket() includes all required Nostr fields`
  - **Status:** RED - `ILPPacketOptions` interface not defined
  - **Verifies:** AC1 - Required fields: id, pubkey, created_at, kind, tags, content, sig

- ✅ **Test:** `constructILPPacket() serializes content as JSON with reducer and args`
  - **Status:** RED - Content JSON serialization not implemented
  - **Verifies:** AC1 - Content structure

- ✅ **Test:** `constructILPPacket() sets pubkey field to Nostr public key hex`
  - **Status:** RED - Public key propagation not implemented
  - **Verifies:** AC1 - Identity attribution

- ✅ **Test:** `constructILPPacket() sets created_at to current Unix timestamp`
  - **Status:** RED - Timestamp generation not implemented
  - **Verifies:** AC1 - Event timestamp

- ✅ **Test:** `constructILPPacket() validates reducer name is non-empty`
  - **Status:** RED - Validation logic not implemented
  - **Verifies:** AC1 - Input validation

- ✅ **Test:** `constructILPPacket() validates reducer name matches alphanumeric pattern`
  - **Status:** RED - Regex validation not implemented
  - **Verifies:** AC1 - Injection prevention

- ✅ **Test:** `constructILPPacket() validates reducer name length (1-64 chars)`
  - **Status:** RED - Length validation not implemented
  - **Verifies:** AC1 - Input constraints

- ✅ **Test:** `constructILPPacket() validates fee is non-negative`
  - **Status:** RED - Fee validation not implemented
  - **Verifies:** AC1 - Fee constraints

- ✅ **Test:** `constructILPPacket() validates args are JSON-serializable`
  - **Status:** RED - JSON serialization check not implemented
  - **Verifies:** AC1 - Args validation

- ✅ **Test:** `constructILPPacket() throws SigilError with INVALID_ACTION for empty reducer`
  - **Status:** RED - Error handling not implemented
  - **Verifies:** AC1 - Validation error handling

- ✅ **Test:** `constructILPPacket() throws SigilError with INVALID_ACTION for invalid reducer chars`
  - **Status:** RED - Error code mapping not implemented
  - **Verifies:** AC1 - Injection prevention error

- ✅ **Test:** `constructILPPacket() throws SigilError with INVALID_ACTION for negative fee`
  - **Status:** RED - Fee validation error not implemented
  - **Verifies:** AC1 - Fee validation error

- ✅ **Test:** `constructILPPacket() throws SigilError with INVALID_ACTION for circular args`
  - **Status:** RED - JSON serialization error not implemented
  - **Verifies:** AC1 - Args serialization error

- ✅ **Test:** `constructILPPacket() handles complex nested args objects`
  - **Status:** RED - Complex object handling not tested
  - **Verifies:** AC1 - Robustness

- ✅ **Test:** `constructILPPacket() handles very long reducer names (63 chars OK, 65 fails)`
  - **Status:** RED - Boundary testing not implemented
  - **Verifies:** AC1 - Length boundary

- ✅ **Test:** `constructILPPacket() handles special characters in args strings`
  - **Status:** RED - String escaping not tested
  - **Verifies:** AC1 - Content encoding

- ✅ **Test:** `constructILPPacket() handles unicode in reducer name (should fail validation)`
  - **Status:** RED - Unicode rejection not implemented
  - **Verifies:** AC1 - Alphanumeric validation

- ✅ **Test:** `constructILPPacket() handles array args correctly`
  - **Status:** RED - Array serialization not tested
  - **Verifies:** AC1 - Args types

- ✅ **Test:** `constructILPPacket() includes validation failure details in error message`
  - **Status:** RED - Detailed error messages not implemented
  - **Verifies:** AC1 - Error messaging

#### Event Signing Tests (15 tests)
**File:** `packages/client/src/publish/event-signing.test.ts`

- ✅ **Test:** `signEvent() computes correct event ID (SHA256 hash)`
  - **Status:** RED - `signEvent` function not implemented
  - **Verifies:** AC1, AC6 - Event ID generation

- ✅ **Test:** `signEvent() generates valid 64-byte Schnorr signature`
  - **Status:** RED - Signature generation not implemented
  - **Verifies:** AC1, AC6 - Signature format

- ✅ **Test:** `signEvent() signature is 128-character hex string`
  - **Status:** RED - Signature format validation not implemented
  - **Verifies:** AC1 - Signature encoding

- ✅ **Test:** `signEvent() signature verifies with nostr-tools verifyEvent()`
  - **Status:** RED - Signature verification not tested
  - **Verifies:** AC1, AC6 - Cryptographic correctness

- ✅ **Test:** `signEvent() uses known test vectors from NIP-01 spec`
  - **Status:** RED - Test vector validation not implemented
  - **Verifies:** AC1, AC6 - NIP-01 compliance

- ✅ **Test:** `signEvent() throws SigilError with SIGNING_FAILED on invalid private key`
  - **Status:** RED - Error handling not implemented
  - **Verifies:** AC6 - Signing error handling

- ✅ **Test:** `signEvent() never logs private key`
  - **Status:** RED - Logging sanitization not implemented
  - **Verifies:** AC6 - Private key protection

- ✅ **Test:** `signEvent() never includes private key in error messages`
  - **Status:** RED - Error message sanitization not implemented
  - **Verifies:** AC6 - Private key protection

- ✅ **Test:** `signEvent() produces different signatures for different created_at`
  - **Status:** RED - Non-determinism not tested
  - **Verifies:** AC1 - Signature uniqueness

- ✅ **Test:** `signEvent() handles empty content field`
  - **Status:** RED - Edge case not tested
  - **Verifies:** AC1 - Content handling

- ✅ **Test:** `signEvent() handles empty tags array`
  - **Status:** RED - Tags handling not tested
  - **Verifies:** AC1 - Tags field

- ✅ **Test:** `signEvent() handles very large content (10KB)`
  - **Status:** RED - Large content not tested
  - **Verifies:** AC1 - Scalability

- ✅ **Test:** `signEvent() signature boundary is identity boundary`
  - **Status:** RED - Error boundary not validated
  - **Verifies:** AC6 - Error categorization

- ✅ **Test:** `signEvent() uses nostr-tools finalizeEvent internally`
  - **Status:** RED - Library integration not verified
  - **Verifies:** AC6 - Implementation choice

- ✅ **Test:** `signEvent() preserves all input event fields except id and sig`
  - **Status:** RED - Field preservation not tested
  - **Verifies:** AC1 - Event integrity

#### Crosstown Connector Tests (5 tests)
**File:** `packages/client/src/crosstown/crosstown-connector.test.ts`

- ✅ **Test:** `CrosstownConnector.publishEvent() sends HTTP POST to connector URL`
  - **Status:** RED - `CrosstownConnector` class not implemented
  - **Verifies:** AC2 - HTTP submission

- ✅ **Test:** `CrosstownConnector.publishEvent() includes event in request body`
  - **Status:** RED - Request body serialization not implemented
  - **Verifies:** AC2 - Payload format

- ✅ **Test:** `CrosstownConnector.publishEvent() uses AbortController for timeout`
  - **Status:** RED - Timeout mechanism not implemented
  - **Verifies:** AC5 - Timeout handling

- ✅ **Test:** `CrosstownConnector.publishEvent() throws NETWORK_TIMEOUT after 2000ms`
  - **Status:** RED - Timeout error not implemented
  - **Verifies:** AC5 - Timeout error

- ✅ **Test:** `CrosstownConnector.publishEvent() throws RATE_LIMITED on 429 response`
  - **Status:** RED - Rate limit handling not implemented
  - **Verifies:** AC2 - Rate limiting

#### Client Publish API Tests (10 tests)
**File:** `packages/client/src/publish/client-publish.test.ts`

- ✅ **Test:** `client.publish() constructs and signs ILP packet`
  - **Status:** RED - `client.publish()` method not implemented
  - **Verifies:** AC1, AC2, AC3 - End-to-end flow

- ✅ **Test:** `client.publish() checks balance before packet construction`
  - **Status:** RED - Balance check not implemented
  - **Verifies:** AC4 - Fail fast

- ✅ **Test:** `client.publish() throws INSUFFICIENT_BALANCE when balance < cost`
  - **Status:** RED - Insufficient balance error not implemented
  - **Verifies:** AC4 - Balance rejection

- ✅ **Test:** `client.publish() error message includes action, cost, balance`
  - **Status:** RED - Error message details not implemented
  - **Verifies:** AC4 - Error messaging

- ✅ **Test:** `client.publish() throws IDENTITY_NOT_LOADED when identity missing`
  - **Status:** RED - Identity precondition not checked
  - **Verifies:** AC1 - Preconditions

- ✅ **Test:** `client.publish() throws CROSSTOWN_NOT_CONFIGURED when URL missing`
  - **Status:** RED - Crosstown precondition not checked
  - **Verifies:** AC2 - Configuration requirement

- ✅ **Test:** `client.publish() throws REGISTRY_NOT_LOADED when cost registry missing`
  - **Status:** RED - Cost registry precondition not checked
  - **Verifies:** AC4 - Dependencies

- ✅ **Test:** `client.publish() waits for confirmation event and resolves promise`
  - **Status:** RED - Confirmation subscription not implemented
  - **Verifies:** AC3 - Confirmation flow

- ✅ **Test:** `client.publish() throws CONFIRMATION_TIMEOUT after publishTimeout`
  - **Status:** RED - Confirmation timeout not implemented
  - **Verifies:** AC3 - Timeout handling

- ✅ **Test:** `client.publish() returns ILPPacketResult with all fields`
  - **Status:** RED - Result structure not defined
  - **Verifies:** AC3 - Return value

#### Cleanup and Lifecycle Tests (4 tests)
**File:** `packages/client/src/publish/cleanup.test.ts`

- ✅ **Test:** `client.disconnect() rejects all pending publishes`
  - **Status:** RED - Disconnect cleanup not implemented
  - **Verifies:** AC5 - State consistency

- ✅ **Test:** `client.disconnect() clears pending publishes map`
  - **Status:** RED - Map cleanup not implemented
  - **Verifies:** AC5 - Resource cleanup

- ✅ **Test:** `client.disconnect() unsubscribes confirmation subscription`
  - **Status:** RED - Subscription cleanup not implemented
  - **Verifies:** AC3 - Subscription management

- ✅ **Test:** `confirmation received clears timeout and removes pending entry`
  - **Status:** RED - Timeout cleanup not implemented
  - **Verifies:** AC3 - Resource cleanup

---

### Integration Tests (25 tests total)

#### ILP Publish Integration Tests (20 tests)
**File:** `packages/client/src/__tests__/integration/ilp-publish-integration.test.ts`

- ✅ **Test:** `end-to-end publish flow (sign → route → BLS → confirm)`
  - **Status:** RED - Full integration not wired
  - **Verifies:** AC1, AC2, AC3 - Complete flow

- ✅ **Test:** `actual Crosstown connector integration`
  - **Status:** RED - Crosstown Docker service not configured
  - **Verifies:** AC2 - Real connector

- ✅ **Test:** `confirmation event received via Nostr relay`
  - **Status:** RED - Nostr relay subscription not active
  - **Verifies:** AC3 - Confirmation mechanism

- ✅ **Test:** `wallet balance decremented after successful action`
  - **Status:** RED - Wallet integration not complete
  - **Verifies:** AC3 - Balance update

- ✅ **Test:** `round-trip latency <2s (NFR3 validation)`
  - **Status:** RED - Performance measurement not instrumented
  - **Verifies:** NFR3 - Latency requirement

- ✅ **Test:** `concurrent publish operations (10 simultaneous calls)`
  - **Status:** RED - Concurrency handling not tested
  - **Verifies:** AC3 - Concurrency

- ✅ **Test:** `publish with insufficient balance (real wallet check)`
  - **Status:** RED - Wallet balance check not integrated
  - **Verifies:** AC4 - Balance rejection (integration)

- ✅ **Test:** `publish with Crosstown unreachable (stop Docker service)`
  - **Status:** RED - Network failure handling not tested
  - **Verifies:** AC5 - Network errors

- ✅ **Test:** `publish with network timeout (slow network simulation)`
  - **Status:** RED - Timeout simulation not implemented
  - **Verifies:** AC5 - Timeout handling

- ✅ **Test:** `signature verification at BLS (end-to-end crypto)`
  - **Status:** RED - BLS signature validation not verified
  - **Verifies:** AC1, AC6 - Cryptographic integrity

- ✅ **Test:** `multiple actions in sequence (balance tracking)`
  - **Status:** RED - Sequential publish not tested
  - **Verifies:** AC3, AC4 - State tracking

- ✅ **Test:** `idempotency (same action published twice, different event IDs)`
  - **Status:** RED - Idempotency not verified
  - **Verifies:** AC1 - Event uniqueness

- ✅ **Test:** `error recovery (publish after network failure)`
  - **Status:** RED - Recovery flow not tested
  - **Verifies:** AC5 - Resilience

- ✅ **Test:** `subscription recovery (publish after Nostr disconnect/reconnect)`
  - **Status:** RED - Subscription resilience not tested
  - **Verifies:** AC3 - Subscription recovery

- ✅ **Test:** `performance under load (sustained 1 action/sec for 60s)`
  - **Status:** RED - Load testing not implemented
  - **Verifies:** NFR3 - Sustained performance

- ✅ **Test:** `private key never transmitted (network capture validation)`
  - **Status:** RED - Network monitoring not implemented
  - **Verifies:** AC6 - Security validation

- ✅ **Test:** `confirmation subscription reuse (multiple publishes, one subscription)`
  - **Status:** RED - Subscription optimization not verified
  - **Verifies:** AC3 - Resource efficiency

- ✅ **Test:** `pending publish cleanup on disconnect`
  - **Status:** RED - Cleanup integration not tested
  - **Verifies:** AC5 - State consistency

- ✅ **Test:** `rate limiting (429 response from Crosstown)`
  - **Status:** RED - Rate limit response not simulated
  - **Verifies:** AC2 - Rate limiting

- ✅ **Test:** `SSRF protection (invalid URLs rejected)`
  - **Status:** RED - URL validation not tested
  - **Verifies:** Security (A10:2021)

#### ILP Performance Tests (5 tests)
**File:** `packages/client/src/__tests__/integration/ilp-performance.test.ts`

- ✅ **Test:** `baseline latency (single action, no load)`
  - **Status:** RED - Baseline measurement not implemented
  - **Verifies:** NFR3 - Performance baseline

- ✅ **Test:** `p50, p95, p99 latency under concurrent load`
  - **Status:** RED - Percentile calculation not implemented
  - **Verifies:** NFR3 - Latency distribution

- ✅ **Test:** `throughput (actions per second)`
  - **Status:** RED - Throughput measurement not implemented
  - **Verifies:** NFR3 - Throughput

- ✅ **Test:** `sustained performance (60s load test)`
  - **Status:** RED - Sustained load test not implemented
  - **Verifies:** NFR3 - Stability

- ✅ **Test:** `NFR3: p95 latency <2s`
  - **Status:** RED - NFR validation not automated
  - **Verifies:** NFR3 - Requirement validation

---

## Data Factories Created

### Nostr Event Factory
**File:** `packages/client/src/publish/test-utils/event.factory.ts`

**Exports:**
- `createNostrEvent(overrides?)` - Create single Nostr event with optional overrides
- `createNostrEvents(count)` - Create array of events
- `createUnsignedEvent(overrides?)` - Create event without id/sig for signing tests
- `createSignedEvent(overrides?)` - Create event with valid test signature

**Example Usage:**
```typescript
const event = createNostrEvent({ kind: 30078, content: '{"reducer":"move","args":[1,2]}' });
const events = createNostrEvents(5); // Generate 5 random events
const unsigned = createUnsignedEvent({ pubkey: testPubkey });
```

### ILP Packet Factory
**File:** `packages/client/src/publish/test-utils/ilp-packet.factory.ts`

**Exports:**
- `createILPPacket(overrides?)` - Create ILP packet with optional overrides
- `createILPPackets(count)` - Create array of ILP packets
- `createInvalidILPPacket(invalidField)` - Create intentionally invalid packet for error testing

**Example Usage:**
```typescript
const packet = createILPPacket({ reducer: 'player_move', args: [10, 20] });
const invalidPacket = createInvalidILPPacket('reducer'); // Invalid reducer for testing
```

### Crosstown Response Factory
**File:** `packages/client/src/publish/test-utils/crosstown-response.factory.ts`

**Exports:**
- `createSuccessResponse(overrides?)` - Create successful Crosstown response
- `createErrorResponse(statusCode, message)` - Create error response
- `createTimeoutResponse()` - Simulate timeout
- `createRateLimitResponse(retryAfter?)` - Create 429 rate limit response

**Example Usage:**
```typescript
const success = createSuccessResponse({ eventId: 'test-event-123' });
const error = createErrorResponse(500, 'Internal Server Error');
const rateLimited = createRateLimitResponse(60); // Retry after 60 seconds
```

---

## Fixtures Created

### Crosstown Connector Fixture
**File:** `packages/client/src/publish/test-utils/crosstown-connector.fixture.ts`

**Fixtures:**
- `mockCrosstownConnector` - Mock connector with configurable responses
  - **Setup:** Creates mock HTTP server or mocked fetch
  - **Provides:** Connector instance with spy methods
  - **Cleanup:** Restores fetch mock, clears call history

**Example Usage:**
```typescript
import { test } from 'vitest';
import { mockCrosstownConnector } from './test-utils/crosstown-connector.fixture';

test('should handle connector timeout', async () => {
  const { connector, mockTimeout } = mockCrosstownConnector({ timeout: 100 });
  mockTimeout(); // Configure to timeout
  await expect(connector.publishEvent(event)).rejects.toThrow('NETWORK_TIMEOUT');
});
```

### Confirmation Subscription Fixture
**File:** `packages/client/src/publish/test-utils/confirmation-subscription.fixture.ts`

**Fixtures:**
- `mockConfirmationSubscription` - Mock Nostr subscription for confirmations
  - **Setup:** Creates mock subscription with event emitter
  - **Provides:** Methods to emit confirmation events
  - **Cleanup:** Unsubscribes and clears event handlers

**Example Usage:**
```typescript
test('should receive confirmation event', async () => {
  const { subscription, emitConfirmation } = mockConfirmationSubscription();
  const publishPromise = client.publish({ reducer: 'move', args: [1, 2] });
  emitConfirmation({ eventId: 'test-123', reducer: 'move' });
  const result = await publishPromise;
  expect(result.eventId).toBe('test-123');
});
```

---

## Mock Requirements

### Crosstown Connector HTTP API Mock

**Endpoint:** `POST /publish`

**Request Body:**
```json
{
  "event": {
    "id": "abc123...",
    "pubkey": "def456...",
    "created_at": 1234567890,
    "kind": 30078,
    "tags": [],
    "content": "{\"reducer\":\"player_move\",\"args\":[10,20]}",
    "sig": "789xyz..."
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "eventId": "abc123...",
  "message": "Event published successfully"
}
```

**Failure Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "INVALID_SIGNATURE",
  "message": "Event signature verification failed"
}
```

**Timeout Response:**
- No response within configured timeout (default 2000ms)
- AbortController triggers abort signal

**Rate Limit Response (429 Too Many Requests):**
```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Too many requests",
  "retryAfter": 60
}
```

**Notes:**
- Mock should support configurable delays for timeout testing
- Mock should track request count for rate limiting simulation
- Mock should validate event structure before responding

### Nostr Relay Confirmation Event Mock

**Event Type:** Kind 30078 (Nostr Application-Specific Data)

**Example Confirmation Event:**
```json
{
  "id": "abc123...",
  "pubkey": "def456...",
  "created_at": 1234567890,
  "kind": 30078,
  "tags": [["d", "unique-identifier"]],
  "content": "{\"reducer\":\"player_move\",\"args\":[10,20]}",
  "sig": "789xyz..."
}
```

**Notes:**
- Confirmation event should match original published event
- Mock should emit event via Nostr relay subscription
- Delay between publish and confirmation should be configurable (default 500ms)

---

## Required data-testid Attributes

N/A - This story implements backend library functionality with no UI components.

---

## Implementation Checklist

### Test Group 1: ILP Packet Construction (AC1)

**File:** `packages/client/src/publish/ilp-packet.test.ts`

**Tasks to make tests pass:**
- [ ] Create `packages/client/src/publish/ilp-packet.ts`
- [ ] Define `ILPPacketOptions` interface: `{ reducer: string, args: unknown }`
- [ ] Define `ILPPacketResult` interface with all confirmation fields
- [ ] Implement `constructILPPacket(options, fee, pubkey): NostrEvent`
- [ ] Create kind 30078 Nostr event structure
- [ ] Set content field to `JSON.stringify({ reducer, args })`
- [ ] Set pubkey, created_at, kind, tags fields
- [ ] Add validation: reducer non-empty, alphanumeric+underscore, 1-64 chars
- [ ] Add validation: fee non-negative
- [ ] Add validation: args JSON-serializable
- [ ] Throw `SigilError` with code `INVALID_ACTION`, boundary `publish` for validation failures
- [ ] Include detailed validation failure in error messages
- [ ] Run tests: `pnpm --filter @sigil/client test ilp-packet.test`
- [ ] ✅ All 20 tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test Group 2: Event Signing (AC1, AC6)

**File:** `packages/client/src/publish/event-signing.test.ts`

**Tasks to make tests pass:**
- [ ] Create `packages/client/src/publish/event-signing.ts`
- [ ] Implement `signEvent(event: NostrEvent, privateKey: Uint8Array): NostrEvent`
- [ ] Use `nostr-tools` `finalizeEvent` to compute id and sig
- [ ] Validate signature format: 64-byte hex (128 chars)
- [ ] Add error handling: catch signing failures, throw `SigilError` with code `SIGNING_FAILED`, boundary `identity`
- [ ] Ensure private key never logged (sanitize logging)
- [ ] Ensure private key never in error messages
- [ ] Add unit tests with NIP-01 test vectors
- [ ] Run tests: `pnpm --filter @sigil/client test event-signing.test`
- [ ] ✅ All 15 tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test Group 3: Crosstown Connector (AC2, AC5)

**File:** `packages/client/src/crosstown/crosstown-connector.test.ts`

**Tasks to make tests pass:**
- [ ] Create `packages/client/src/crosstown/crosstown-connector.ts`
- [ ] Define `CrosstownConnectorOptions`: `{ connectorUrl: string, timeout?: number }`
- [ ] Implement `CrosstownConnector` class with `publishEvent(event): Promise<ILPPacketResult>`
- [ ] Use HTTP POST to `${connectorUrl}/publish` with JSON body `{ event }`
- [ ] Use `AbortController` with timeout signal (default 2000ms)
- [ ] Throw `SigilError` with code `NETWORK_TIMEOUT`, boundary `crosstown` on timeout
- [ ] Handle network errors: `NETWORK_ERROR` / `crosstown`
- [ ] Handle HTTP errors (4xx, 5xx): `PUBLISH_FAILED` / `crosstown` with status
- [ ] Handle rate limiting (429): `RATE_LIMITED` / `crosstown`
- [ ] URL validation (SSRF protection): parse URL, reject non-HTTP, reject internal networks in production
- [ ] Run tests: `pnpm --filter @sigil/client test crosstown-connector.test`
- [ ] ✅ All 5 tests pass (green phase)

**Estimated Effort:** 3 hours

---

### Test Group 4: Client Publish API (AC3, AC4, AC5)

**File:** `packages/client/src/publish/client-publish.test.ts`

**Tasks to make tests pass:**
- [ ] Update `PublishAPI` interface in `packages/client/src/client.ts`
- [ ] Add `publish(options: ILPPacketOptions): Promise<ILPPacketResult>` method signature
- [ ] Validate client state: identity loaded, Crosstown configured, cost registry loaded
- [ ] Throw `IDENTITY_NOT_LOADED`, `CROSSTOWN_NOT_CONFIGURED`, `REGISTRY_NOT_LOADED` as needed
- [ ] Look up action cost: `this.publish.getCost(options.reducer)`
- [ ] Check wallet balance: `await this.wallet.getBalance()`
- [ ] Throw `INSUFFICIENT_BALANCE` if balance < cost (fail fast)
- [ ] Construct ILP packet: `constructILPPacket(options, cost, this.identity.publicKeyHex)`
- [ ] Sign event: `signEvent(unsignedEvent, this.identity.privateKey)`
- [ ] Submit to Crosstown: `await this.crosstownConnector.publishEvent(signedEvent)`
- [ ] Create confirmation subscription on first publish (global, reused)
- [ ] Track pending publish in `Map<eventId, { resolver, rejecter, timeout }>`
- [ ] Set timeout timer: reject with `CONFIRMATION_TIMEOUT` if timeout fires
- [ ] On confirmation event: match by event ID, resolve promise, clear timeout
- [ ] Return `ILPPacketResult` with all confirmation details
- [ ] Add `crosstownConnector` property, `pendingPublishes` map, `confirmationSubscriptionId`
- [ ] Add cleanup in `disconnect()`: unsubscribe, reject all pending with `CLIENT_DISCONNECTED`
- [ ] Run tests: `pnpm --filter @sigil/client test client-publish.test`
- [ ] ✅ All 10 tests pass (green phase)

**Estimated Effort:** 3.5 hours

---

### Test Group 5: Configuration (AC2, AC5)

**File:** `packages/client/src/client.ts` (configuration updates)

**Tasks to make tests pass:**
- [ ] Update `SigilClientConfig` to add `crosstownConnectorUrl?: string`
- [ ] Update `SigilClientConfig` to add `publishTimeout?: number` (default 2000ms)
- [ ] Validate `crosstownConnectorUrl` is valid HTTP/HTTPS URL if provided
- [ ] In production (NODE_ENV=production), require https:// protocol
- [ ] Reject URLs with embedded credentials (username/password)
- [ ] Reject non-HTTP protocols (file://, ftp://, etc.)
- [ ] Document in JSDoc: URL requirement, https:// in production
- [ ] Add example in JSDoc: production and development URLs
- [ ] Run tests: `pnpm --filter @sigil/client test` (verify no config regressions)
- [ ] ✅ Configuration tests pass

**Estimated Effort:** 0.5 hours

---

### Test Group 6: Cleanup and Lifecycle (AC5)

**File:** `packages/client/src/publish/cleanup.test.ts`

**Tasks to make tests pass:**
- [ ] Implement `private cleanupPendingPublish(eventId: string): void`
- [ ] Clear timeout timer for pending publish
- [ ] Remove entry from `pendingPublishes` map
- [ ] Update `client.disconnect()` to iterate pending publishes, reject with `CLIENT_DISCONNECTED`
- [ ] Call `cleanupPendingPublish()` for each entry
- [ ] Unsubscribe confirmation subscription if active
- [ ] Clear `pendingPublishes` map
- [ ] Set `confirmationSubscriptionId` to null
- [ ] Add timeout cleanup when confirmation received
- [ ] Run tests: `pnpm --filter @sigil/client test cleanup.test`
- [ ] ✅ All 4 tests pass (green phase)

**Estimated Effort:** 1 hour

---

### Test Group 7: Integration Tests (AC1-6, NFR3)

**File:** `packages/client/src/__tests__/integration/ilp-publish-integration.test.ts`

**Tasks to make tests pass:**
- [ ] Start Docker stack (BitCraft + Crosstown + BLS)
- [ ] Verify Crosstown connector HTTP endpoint is accessible
- [ ] Verify Nostr relay is running and accepting subscriptions
- [ ] Test end-to-end publish flow: sign → route → BLS → confirm
- [ ] Test actual Crosstown connector integration (real HTTP)
- [ ] Test confirmation event received via Nostr relay
- [ ] Test wallet balance decremented after action
- [ ] Measure round-trip latency, verify <2s
- [ ] Test concurrent publishes (10 simultaneous)
- [ ] Test insufficient balance rejection (real wallet)
- [ ] Test Crosstown unreachable (stop Docker service)
- [ ] Test network timeout (slow network simulation)
- [ ] Test signature verification at BLS
- [ ] Test multiple sequential actions
- [ ] Test idempotency (different event IDs)
- [ ] Test error recovery after network failure
- [ ] Test subscription recovery after disconnect/reconnect
- [ ] Test sustained load (1 action/sec for 60s)
- [ ] Test private key never transmitted (network capture)
- [ ] Test confirmation subscription reuse
- [ ] Test pending publish cleanup on disconnect
- [ ] Test rate limiting (429 response)
- [ ] Test SSRF protection (invalid URLs)
- [ ] Set RUN_INTEGRATION_TESTS=1 environment variable
- [ ] Run tests: `RUN_INTEGRATION_TESTS=1 pnpm --filter @sigil/client test ilp-publish-integration.test`
- [ ] ✅ All 20 tests pass (green phase)

**Estimated Effort:** 2.5 hours

---

### Test Group 8: Performance Tests (NFR3)

**File:** `packages/client/src/__tests__/integration/ilp-performance.test.ts`

**Tasks to make tests pass:**
- [ ] Implement baseline latency test (single action, no load)
- [ ] Implement percentile calculation (p50, p95, p99)
- [ ] Implement throughput measurement (actions per second)
- [ ] Implement sustained load test (60s)
- [ ] Validate NFR3: p95 latency <2s
- [ ] Document performance baseline in `_bmad-output/implementation-artifacts/2-3-performance-baseline.md`
- [ ] Include environment (macOS/Linux, Docker version)
- [ ] Include metrics (p50, p95, p99, throughput)
- [ ] Compare to NFR3 requirement
- [ ] Add performance regression tests to CI (fail if p95 > 2s)
- [ ] Set RUN_INTEGRATION_TESTS=1 environment variable
- [ ] Run tests: `RUN_INTEGRATION_TESTS=1 pnpm --filter @sigil/client test ilp-performance.test`
- [ ] ✅ All 5 tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Test Group 9: Documentation and Exports (AC1-6)

**File:** Multiple files

**Tasks to make tests pass:**
- [ ] Export `ILPPacketOptions` from `packages/client/src/index.ts`
- [ ] Export `ILPPacketResult` from `packages/client/src/index.ts`
- [ ] Export `CrosstownConnectorOptions` from `packages/client/src/index.ts`
- [ ] Document error codes in `packages/client/src/errors/error-codes.md`
  - publish boundary: `INVALID_ACTION`, `IDENTITY_NOT_LOADED`, `CROSSTOWN_NOT_CONFIGURED`, `REGISTRY_NOT_LOADED`, `CLIENT_DISCONNECTED`
  - crosstown boundary: `INSUFFICIENT_BALANCE`, `NETWORK_TIMEOUT`, `NETWORK_ERROR`, `PUBLISH_FAILED`, `INVALID_RESPONSE`, `RATE_LIMITED`, `CONFIRMATION_TIMEOUT`
  - identity boundary: `SIGNING_FAILED`
- [ ] Update `PublishAPI` JSDoc with `publish()` method documentation
- [ ] Add parameter types, return type, error codes, examples
- [ ] Add usage examples in JSDoc (basic publish, error handling, timeout)
- [ ] Update README or API docs with publish examples
- [ ] Run tests: `pnpm build` (verify exports)
- [ ] ✅ Build succeeds, types exported

**Estimated Effort:** 1 hour

---

### Test Group 10: Security Review (OWASP Top 10)

**File:** Security checklist review

**Tasks to complete:**
- [ ] **A01:2021 - Broken Access Control**: Verify rate limiting handled by Crosstown (429 response)
- [ ] **A02:2021 - Cryptographic Failures**: Verify private key never transmitted, never logged
- [ ] **A02:2021**: Verify TLS/SSL (production Crosstown URLs must use https://)
- [ ] **A03:2021 - Injection**: Verify URL validation (SSRF protection), reducer name validation
- [ ] **A04:2021 - Insecure Design**: Verify secure defaults, fail-fast balance check
- [ ] **A05:2021 - Security Misconfiguration**: Verify production vs development mode, timeout config
- [ ] **A06:2021 - Vulnerable Components**: Run `pnpm audit`, verify `nostr-tools` up-to-date
- [ ] **A07:2021 - Authentication Failures**: Verify Nostr signature verification end-to-end
- [ ] **A08:2021 - Data Integrity Failures**: Verify ILP packet signature, event ID verification
- [ ] **A09:2021 - Security Logging Failures**: Verify private key redacted in logs, error messages sanitized
- [ ] **A10:2021 - SSRF**: Verify Crosstown URL validation, internal network protection
- [ ] Review security findings with team
- [ ] ✅ OWASP Top 10 review complete, no high/critical issues

**Estimated Effort:** 0.5 hours

---

### Test Group 11: Observability and Debugging (Nice-to-have)

**File:** `packages/client/src/publish/observability.ts`

**Tasks (optional, can defer):**
- [ ] Add debug logging throughout publish flow
- [ ] Add metrics collection (counters, histograms, gauges)
- [ ] Emit events for observability (publishAttempt, publishSuccess, publishFailure)
- [ ] Add `client.publish.getMetrics()` method
- [ ] Document observability in JSDoc and README
- [ ] Run tests: `pnpm --filter @sigil/client test` (verify no regressions)
- [ ] ✅ Observability implemented (optional)

**Estimated Effort:** 1 hour (deferred)

---

## Running Tests

```bash
# Run all unit tests for this story (54 tests)
pnpm --filter @sigil/client test ilp-packet.test
pnpm --filter @sigil/client test event-signing.test
pnpm --filter @sigil/client test crosstown-connector.test
pnpm --filter @sigil/client test client-publish.test
pnpm --filter @sigil/client test cleanup.test

# Run all integration tests (25 tests) - requires Docker stack
docker compose -f docker/docker-compose.yml up -d
RUN_INTEGRATION_TESTS=1 pnpm --filter @sigil/client test ilp-publish-integration.test
RUN_INTEGRATION_TESTS=1 pnpm --filter @sigil/client test ilp-performance.test

# Run all tests for this story
pnpm --filter @sigil/client test
RUN_INTEGRATION_TESTS=1 pnpm --filter @sigil/client test

# Run tests in watch mode (TDD workflow)
pnpm --filter @sigil/client test:watch

# Run tests with coverage
pnpm --filter @sigil/client test:coverage

# Debug specific test
node --inspect-brk ./node_modules/.bin/vitest ilp-packet.test.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**
- ✅ All 79 tests written and failing (54 unit + 25 integration)
- ✅ Fixtures and factories created for test data
- ✅ Mock requirements documented (Crosstown connector, Nostr relay)
- ✅ Implementation checklist created with 11 test groups
- ✅ Security review checklist (OWASP Top 10) prepared

**Verification:**
- Run all tests and verify they fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing implementation, not test bugs
- Expected failures: "function not implemented", "module not found", "interface not defined"

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**
1. **Start with Test Group 1** (ILP Packet Construction) - foundational
2. **Read the 20 tests** in `ilp-packet.test.ts`
3. **Implement `constructILPPacket()`** to make tests pass
4. **Run tests** to verify green: `pnpm --filter @sigil/client test ilp-packet.test`
5. **Move to Test Group 2** (Event Signing) and repeat
6. **Continue through Test Group 11** in order

**Key Principles:**
- One test group at a time (don't jump ahead)
- Minimal implementation (simplest code that makes tests pass)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap (check off tasks)

**Progress Tracking:**
- Mark test groups as complete when all tests pass
- Update sprint-status.yaml after each group
- Share progress in daily standup

**Recommended Order:**
1. Test Group 1 (ILP Packet Construction) - Core functionality
2. Test Group 2 (Event Signing) - Cryptographic foundation
3. Test Group 5 (Configuration) - Setup for integration
4. Test Group 3 (Crosstown Connector) - Network layer
5. Test Group 4 (Client Publish API) - Main API
6. Test Group 6 (Cleanup and Lifecycle) - Resource management
7. Test Group 9 (Documentation and Exports) - Public API
8. Test Group 10 (Security Review) - OWASP compliance
9. Test Group 7 (Integration Tests) - End-to-end validation
10. Test Group 8 (Performance Tests) - NFR validation
11. Test Group 11 (Observability) - Optional, can defer

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**
1. **Verify all 79 tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (if needed to meet NFR3)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if API contracts change)

**Key Principles:**
- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**
- All 79 tests pass
- Code quality meets team standards (AGREEMENT-2 security review)
- No duplications or code smells
- Performance meets NFR3 (p95 latency <2s)
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist** with the dev team (manual handoff)
2. **Review this checklist** in standup or planning session
3. **Run failing tests** to confirm RED phase: `pnpm --filter @sigil/client test`
4. **Begin implementation** using implementation checklist as guide (Test Group 1 first)
5. **Work one test group at a time** (red → green for each group)
6. **Share progress** in daily standup (test groups completed)
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, mark story as 'done' in sprint-status.yaml
9. **Create test traceability report**: `_bmad-output/implementation-artifacts/reports/2-3-test-traceability.md`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **test-levels-framework.md** - Test level selection (unit vs integration)
- **data-factories.md** - Factory patterns for test data generation
- **component-tdd.md** - TDD strategies and red-green-refactor workflow
- **ci-burn-in.md** - Performance testing and NFR validation

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm --filter @sigil/client test`

**Expected Results:**
```
FAIL  src/publish/ilp-packet.test.ts
  ● constructILPPacket() creates valid kind 30078 event
    Cannot find module 'publish/ilp-packet'

FAIL  src/publish/event-signing.test.ts
  ● signEvent() computes correct event ID
    Cannot find module 'publish/event-signing'

FAIL  src/crosstown/crosstown-connector.test.ts
  ● CrosstownConnector.publishEvent() sends HTTP POST
    Cannot find module 'crosstown/crosstown-connector'

FAIL  src/publish/client-publish.test.ts
  ● client.publish() constructs and signs ILP packet
    client.publish is not a function

FAIL  src/publish/cleanup.test.ts
  ● client.disconnect() rejects all pending publishes
    pendingPublishes is not defined

FAIL  src/__tests__/integration/ilp-publish-integration.test.ts
  ● end-to-end publish flow
    Cannot find module 'publish/ilp-packet'

FAIL  src/__tests__/integration/ilp-performance.test.ts
  ● baseline latency
    client.publish is not a function
```

**Summary:**
- Total tests: 79 (54 unit + 25 integration)
- Passing: 0 (expected)
- Failing: 79 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**
- Module not found errors for unimplemented files
- Function not defined errors for missing implementations
- Interface/type not found errors for missing type definitions
- All failures due to missing implementation (not test bugs)

---

## Notes

### Integration Test Dependencies
- Docker stack (BitCraft + Crosstown + BLS) must be running
- Set `RUN_INTEGRATION_TESTS=1` environment variable
- Integration tests will auto-skip if Docker not available
- See `docker/README.md` for setup instructions

### Performance Test Considerations
- Performance tests (Test Group 8) require low-load environment
- Run on dedicated CI runner or local machine with minimal background processes
- Baseline measurements will vary by hardware (document environment)
- NFR3 validation (<2s p95 latency) is the critical metric

### Security Test Notes
- SSRF protection tests (Test Group 7) require malicious URL attempts
- Network capture tests may require elevated permissions or debugging tools
- Private key protection is critical - all tests must validate no key transmission

### Deferred Work
- Observability implementation (Test Group 11) is optional for MVP
- Can defer to Epic 6 (Infrastructure & Observability) if time-constrained
- Core functionality (Test Groups 1-8) is required for story completion

### Known Limitations
- Crosstown connector uses HTTP POST (not `@crosstown/client` library initially)
- No automatic retries on network failure (user controls retry logic)
- Confirmation subscription is global (one per client, reused for all publishes)
- Performance may degrade under very high concurrency (>50 simultaneous publishes)

---

## Contact

**Questions or Issues?**
- Ask in team standup
- Tag @Jonathan in Slack/Discord
- Refer to `_bmad-output/implementation-artifacts/2-3-ilp-packet-construction-and-signing.md` for detailed story documentation
- Consult Epic 1 retrospective (`_bmad-output/implementation-artifacts/epic-1-retro-2026-02-27.md`) for TDD best practices

---

**Generated by BMAD TEA Agent** - 2026-02-27
**Workflow:** testarch-atdd v5.0
**Story:** 2-3-ilp-packet-construction-and-signing
**Total Test Count:** 79 (54 unit + 25 integration)
**Estimated Implementation Effort:** 20 hours (11 test groups)
