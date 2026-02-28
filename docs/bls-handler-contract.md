# BLS Handler Integration Contract

**Version:** 1.0
**Date:** 2026-02-28
**Status:** Active
**Related:** [Crosstown BLS Implementation Spec](./crosstown-bls-implementation-spec.md)

---

## Overview

This document defines the integration contract between the Sigil SDK client library (`@sigil/client`) and the Crosstown BLS (Business Logic Service) game action handler. The BLS handler is responsible for:

1. Receiving ILP packets containing Nostr events (kind 30078) from the Crosstown node's ILP connector
2. Validating Nostr event signatures (secp256k1)
3. Parsing event content (reducer name and arguments)
4. Forwarding authenticated game actions to SpacetimeDB with identity propagation
5. Returning success or error responses

**Key Integration Points:**

- **Input:** Crosstown ILP connector → BLS handler `POST /handle-packet` endpoint
- **Output:** SpacetimeDB HTTP API `/database/bitcraft/call/{reducer}`
- **Identity:** Nostr public key (event.pubkey) → prepended as first reducer argument
- **Responses:** Success/error responses → Crosstown connector → client

---

## Event Format

### Kind 30078 Nostr Event Structure

The Sigil client constructs kind 30078 Nostr events (NIP-78: Application-specific Data) containing game action ILP packets. The BLS handler receives these events embedded in ILP packets.

**Full Event Structure:**

```typescript
interface NostrEvent {
  /** Event ID (SHA256 hash of canonical event serialization) - 64-char hex */
  id: string;

  /** Author's public key (secp256k1) - 64-char hex */
  pubkey: string;

  /** Unix timestamp (seconds since epoch) */
  created_at: number;

  /** Event kind (30078 for game actions) */
  kind: 30078;

  /** Event tags (metadata) */
  tags: string[][];

  /** Event content (JSON-serialized game action) */
  content: string;

  /** Schnorr signature (secp256k1) - 128-char hex */
  sig: string;
}
```

**Example Event:**

```json
{
  "id": "a1b2c3d4e5f6...",
  "pubkey": "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
  "created_at": 1709164800,
  "kind": 30078,
  "tags": [
    ["d", "player_move_1709164800123"],
    ["fee", "1"]
  ],
  "content": "{\"reducer\":\"player_move\",\"args\":[{\"x\":100,\"z\":200},{\"x\":110,\"z\":200},false]}",
  "sig": "304502210...0021ba3f"
}
```

### Event Content Format

The `content` field contains a JSON-serialized object with the following structure:

```typescript
interface EventContent {
  /** SpacetimeDB reducer name (alphanumeric + underscore, 1-64 chars) */
  reducer: string;

  /** Reducer arguments (JSON-serializable array or object) */
  args: unknown;
}
```

**Content Examples:**

```json
// Player movement
{"reducer":"player_move","args":[{"x":100,"z":200},{"x":110,"z":200},false]}

// Craft item
{"reducer":"craft_item","args":[123, 1]}

// Chat message
{"reducer":"send_chat","args":["Hello, world!"]}
```

### Event Tags

The BLS handler uses the following tags:

| Tag | Description | Example | Required |
|-----|-------------|---------|----------|
| `d` | NIP-33 identifier (reducer + timestamp) | `["d", "player_move_1709164800123"]` | Yes |
| `fee` | ILP fee amount (integer string) | `["fee", "1"]` | Yes |

---

## Signature Validation (NIP-01)

The BLS handler MUST validate Nostr event signatures before processing any game action. Signature validation follows the NIP-01 specification.

### Event ID Computation

The event ID is computed as the SHA256 hash of the canonical event serialization:

```typescript
// Canonical serialization (no whitespace)
const serialized = JSON.stringify([
  0,                  // Reserved for future use
  event.pubkey,       // Public key (hex string)
  event.created_at,   // Unix timestamp (number)
  event.kind,         // Event kind (number)
  event.tags,         // Tags array
  event.content       // Content string
]);

// Event ID
const eventId = sha256(serialized);
```

**Validation:**

1. Compute expected event ID from event fields
2. Compare computed ID with `event.id`
3. Reject if IDs don't match

### Signature Verification

The signature is verified using secp256k1 Schnorr signature verification:

```typescript
// Verify signature
const isValid = secp256k1.schnorr.verify(
  event.sig,      // Signature (128-char hex)
  event.id,       // Event ID (64-char hex, computed above)
  event.pubkey    // Public key (64-char hex)
);

if (!isValid) {
  return {
    errorCode: 'INVALID_SIGNATURE',
    eventId: event.id,
    message: `Signature verification failed for event ${event.id}`,
    retryable: false
  };
}
```

**Validation Requirements:**

- Event ID MUST match computed SHA256 hash
- Signature MUST verify using secp256k1 Schnorr verification
- Public key MUST be valid 32-byte secp256k1 public key (64-char hex)
- Reject ALL events with invalid signatures BEFORE any reducer execution

---

## Content Parsing

After signature validation, the BLS handler parses the event content to extract the reducer name and arguments.

### Parsing Steps

1. Parse `event.content` as JSON
2. Validate `reducer` field is present and is a string
3. Validate `args` field is present (can be any JSON type)
4. Return parsed content or error

**Example:**

```typescript
interface ParsedContent {
  reducer: string;
  args: unknown;
}

function parseEventContent(content: string): ParsedContent | BLSErrorResponse {
  try {
    const parsed = JSON.parse(content);

    if (!parsed.reducer || typeof parsed.reducer !== 'string') {
      return {
        errorCode: 'INVALID_CONTENT',
        eventId: event.id,
        message: 'Missing or invalid reducer field in event content',
        retryable: false
      };
    }

    return {
      reducer: parsed.reducer,
      args: parsed.args
    };
  } catch (error) {
    return {
      errorCode: 'INVALID_CONTENT',
      eventId: event.id,
      message: `Failed to parse event content as JSON: ${error.message}`,
      retryable: false
    };
  }
}
```

### Content Validation

| Field | Type | Validation | Error on Failure |
|-------|------|------------|------------------|
| `reducer` | string | Non-empty, 1-64 chars, alphanumeric + underscore | `INVALID_CONTENT` |
| `args` | unknown | JSON-serializable (any type) | `INVALID_CONTENT` |

---

## SpacetimeDB HTTP API Contract

After validation and parsing, the BLS handler forwards the game action to SpacetimeDB via HTTP POST request.

### HTTP Request Format

**Endpoint:**

```
POST {SPACETIMEDB_URL}/database/{database}/call/{reducer}
```

**Headers:**

```http
Authorization: Bearer {SPACETIMEDB_TOKEN}
Content-Type: application/json
```

**Body:**

The request body is a JSON array containing the Nostr public key prepended to the reducer arguments:

```json
["{nostr_pubkey}", ...args]
```

**Example:**

For the event:
```json
{
  "pubkey": "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
  "content": "{\"reducer\":\"player_move\",\"args\":[{\"x\":100,\"z\":200},{\"x\":110,\"z\":200},false]}"
}
```

The BLS handler makes this HTTP request:

```http
POST http://localhost:3000/database/bitcraft/call/player_move
Authorization: Bearer {admin_token}
Content-Type: application/json

[
  "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
  {"x":100,"z":200},
  {"x":110,"z":200},
  false
]
```

### Identity Propagation (Option B)

The BLS handler propagates the Nostr public key to SpacetimeDB by **prepending it as the first argument** to all reducer calls. This approach was chosen because:

1. SpacetimeDB 1.6.x does not support custom HTTP header-based identity propagation
2. No modification to SpacetimeDB server is required
3. Simple and explicit identity attribution

**SpacetimeDB Reducer Pattern:**

All reducers MUST accept `nostr_pubkey: String` as the first parameter:

```rust
#[reducer]
fn player_move(
    ctx: &ReducerContext,
    nostr_pubkey: String,  // BLS prepends this
    origin: Point,
    dest: Point,
    running: bool
) {
    // Use nostr_pubkey for identity attribution
    let player_identity = nostr_pubkey;
    // ... game logic
}
```

**IMPORTANT:** This is a **breaking change** to BitCraft reducers. All reducers invoked via BLS MUST be modified to accept the `nostr_pubkey` parameter.

### HTTP Response Handling

| Status Code | Meaning | BLS Action |
|-------------|---------|------------|
| `200 OK` | Reducer executed successfully | Return success response |
| `404 Not Found` | Unknown reducer name | Return `UNKNOWN_REDUCER` error |
| `400 Bad Request` | Invalid reducer arguments | Return `REDUCER_FAILED` error |
| `500 Internal Server Error` | SpacetimeDB runtime error | Return `REDUCER_FAILED` error |
| Timeout (>30s) | Request timed out | Return `REDUCER_FAILED` error with timeout message |

---

## Error Response Format

All BLS errors follow this standard format:

```typescript
interface BLSErrorResponse {
  /** Event ID that failed (for client correlation) */
  eventId: string;

  /** Error code identifying the failure type */
  errorCode: BLSErrorCode;

  /** Human-readable error message with details */
  message: string;

  /** Whether the error is retryable */
  retryable: boolean;
}
```

### Error Codes

| Error Code | Description | Retryable | Example |
|------------|-------------|-----------|---------|
| `INVALID_SIGNATURE` | Signature verification failed | No | Invalid sig, wrong pubkey, corrupted event |
| `UNKNOWN_REDUCER` | Reducer not found in SpacetimeDB | No | Typo in reducer name, reducer doesn't exist |
| `REDUCER_FAILED` | Reducer execution failed | Yes | Invalid args, precondition failure, timeout |
| `INVALID_CONTENT` | Event content parsing failed | No | Malformed JSON, missing fields |

### Error Response Examples

**Invalid Signature:**

```json
{
  "eventId": "a1b2c3d4e5f6...",
  "errorCode": "INVALID_SIGNATURE",
  "message": "Signature verification failed for event a1b2c3d4e5f6: schnorr.verify returned false",
  "retryable": false
}
```

**Unknown Reducer:**

```json
{
  "eventId": "a1b2c3d4e5f6...",
  "errorCode": "UNKNOWN_REDUCER",
  "message": "Reducer 'nonexistent_reducer' not found in SpacetimeDB (404 Not Found)",
  "retryable": false
}
```

**Reducer Failed:**

```json
{
  "eventId": "a1b2c3d4e5f6...",
  "errorCode": "REDUCER_FAILED",
  "message": "Reducer 'player_move' failed: Invalid destination coordinates (400 Bad Request)",
  "retryable": true
}
```

**Invalid Content:**

```json
{
  "eventId": "a1b2c3d4e5f6...",
  "errorCode": "INVALID_CONTENT",
  "message": "Failed to parse event content as JSON: Unexpected token } at position 42",
  "retryable": false
}
```

---

## Success Response Format

When the reducer executes successfully, the BLS handler returns:

```typescript
interface BLSSuccessResponse {
  /** Event ID that succeeded */
  eventId: string;

  /** Success flag (always true) */
  success: true;
}
```

**Example:**

```json
{
  "eventId": "a1b2c3d4e5f6...",
  "success": true
}
```

---

## Response Propagation

The BLS handler returns responses to the Crosstown ILP connector, which propagates them to the client via the Nostr relay.

### Response Flow

```
BLS Handler → Crosstown Connector → Nostr Relay → Sigil Client
```

**Nostr OK Message (NIP-01):**

The Crosstown relay forwards BLS responses as Nostr OK messages:

```json
// Success
["OK", "<event_id>", true, ""]

// Error
["OK", "<event_id>", false, "<errorCode>: <message>"]
```

**Example Error Propagation:**

```json
["OK", "a1b2c3d4e5f6...", false, "INVALID_SIGNATURE: Signature verification failed for event a1b2c3d4e5f6"]
```

---

## Configuration

The BLS handler requires the following environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SPACETIMEDB_URL` | SpacetimeDB HTTP endpoint | `http://localhost:3000` | Yes |
| `SPACETIMEDB_DATABASE` | Database name | `bitcraft` | Yes |
| `SPACETIMEDB_TOKEN` | Authentication token | (none) | Yes |

**Example Configuration:**

```bash
export SPACETIMEDB_URL="http://localhost:3000"
export SPACETIMEDB_DATABASE="bitcraft"
export SPACETIMEDB_TOKEN="admin_token_here"
```

**Security Note:** For MVP, the BLS handler uses an admin token (full SpacetimeDB permissions). This is overly permissive. Production deployments SHOULD create a service account with reducer-only permissions.

---

## Performance Requirements

The BLS handler MUST meet the following performance requirements:

| Metric | Requirement | Notes |
|--------|-------------|-------|
| Event processing latency | <500ms (p99) | From ILP packet receipt to SpacetimeDB call |
| Signature validation | <10ms (p99) | secp256k1 verification time |
| SpacetimeDB call timeout | 30s | HTTP request timeout |
| Round-trip latency | <2s (p99) | Client publish → confirmation (NFR3) |

**Note:** Round-trip latency includes client → relay → connector → BLS → SpacetimeDB → response propagation.

---

## Logging Requirements

The BLS handler MUST log all events with sufficient detail for debugging:

### Success Log Entry

```
[INFO] BLS: Action succeeded
  eventId: a1b2c3d4e5f6...
  pubkey: 32e1827635450ebb...
  reducer: player_move
  args: [{"x":100,"z":200},{"x":110,"z":200},false]
  duration: 42ms
```

### Error Log Entry

```
[ERROR] BLS: Action failed
  eventId: a1b2c3d4e5f6...
  pubkey: 32e1827635450ebb...
  reducer: nonexistent_reducer
  errorCode: UNKNOWN_REDUCER
  message: Reducer 'nonexistent_reducer' not found in SpacetimeDB (404 Not Found)
  duration: 15ms
```

**Log Fields:**

- Event ID (for correlation)
- Public key (for identity tracking)
- Reducer name (for debugging)
- Error code and message (for failures)
- Duration (for performance monitoring)

**Security Note:** Do NOT log event signatures, private keys, or auth tokens.

---

## Zero Silent Failures (NFR27)

The BLS handler MUST ensure **zero silent failures**:

1. **All errors are explicit:** Every failure path returns a structured error response
2. **All errors are logged:** Every error is logged with sufficient detail for debugging
3. **All errors are propagated:** Every error is returned to the client via relay
4. **No swallowed exceptions:** All exceptions are caught and converted to error responses

**Example:**

```typescript
// ❌ WRONG: Silent failure
try {
  await executeReducer(reducer, args);
} catch (error) {
  console.error(error); // Logged but not returned to client!
}

// ✅ CORRECT: Explicit error
try {
  await executeReducer(reducer, args);
} catch (error) {
  const errorResponse = {
    eventId: event.id,
    errorCode: 'REDUCER_FAILED',
    message: `Reducer execution failed: ${error.message}`,
    retryable: true
  };
  console.error(errorResponse); // Log
  return errorResponse; // Return to client
}
```

---

## Testing Contract Compliance

The Sigil SDK includes integration tests that validate the BLS handler contract. These tests are marked `@skip` until the Crosstown BLS handler is deployed.

**Test Coverage:**

- ✅ AC1: BLS receives kind 30078 events via ILP routing
- ✅ AC2: Event content parsing and validation
- ✅ AC3: Nostr signature validation
- ✅ AC4: SpacetimeDB reducer invocation with identity
- ✅ AC5: Unknown reducer handling
- ✅ AC6: Zero silent failures
- ✅ AC7: Error response propagation

**Test Location:** `packages/client/src/integration-tests/bls-handler.integration.test.ts`

**Running Tests:**

```bash
# Enable integration tests when BLS handler is deployed
export RUN_INTEGRATION_TESTS=true
export BLS_HANDLER_DEPLOYED=true

# Run integration tests
pnpm --filter @sigil/client test:integration
```

---

## Implementation Checklist

BLS handler implementers MUST ensure the following:

- [ ] Receive ILP packets via `POST /handle-packet` endpoint
- [ ] Extract Nostr event (kind 30078) from ILP packet data
- [ ] Validate event ID matches computed SHA256 hash (NIP-01)
- [ ] Validate signature using secp256k1 Schnorr verification (NIP-01)
- [ ] Reject ALL invalid signatures BEFORE reducer execution
- [ ] Parse event content as JSON with `reducer` and `args` fields
- [ ] Prepend Nostr public key as first argument to reducer call
- [ ] Make HTTP POST request to SpacetimeDB `/database/{database}/call/{reducer}`
- [ ] Include `Authorization: Bearer {token}` header
- [ ] Handle HTTP response codes (200, 404, 400, 500, timeout)
- [ ] Return structured error responses for all failure modes
- [ ] Log all events with event ID, pubkey, reducer, error details
- [ ] Propagate responses to Crosstown connector
- [ ] Ensure zero silent failures (all errors explicit and logged)
- [ ] Meet performance requirements (<2s round-trip latency)

---

## References

- **Crosstown BLS Implementation Spec:** [docs/crosstown-bls-implementation-spec.md](./crosstown-bls-implementation-spec.md)
- **Story 2.4:** BLS Handler Integration Contract & Testing
- **Story 2.3:** ILP Packet Construction & Signing
- **NIP-01:** Basic Protocol Flow - https://github.com/nostr-protocol/nips/blob/master/01.md
- **NIP-33:** Parameterized Replaceable Events - https://github.com/nostr-protocol/nips/blob/master/33.md
- **NIP-78:** Application-specific Data - https://github.com/nostr-protocol/nips/blob/master/78.md
- **SpacetimeDB HTTP API:** https://spacetimedb.com/docs

---

## Change Log

**2026-02-28:** Initial version created for Story 2.4
- Documented event format (kind 30078 structure)
- Documented signature validation (NIP-01 compliance)
- Documented content parsing requirements
- Documented SpacetimeDB HTTP API contract with identity propagation (Option B)
- Documented error response format and error codes
- Documented success response format
- Documented configuration requirements
- Documented performance and logging requirements
- Documented zero silent failures requirement (NFR27)
- Documented testing contract compliance
- Provided implementation checklist
