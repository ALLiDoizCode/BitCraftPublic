# Crosstown BLS Game Action Handler - Implementation Specification

**Version:** 1.0
**Date:** 2026-02-28
**Status:** Ready for Implementation
**Target:** Crosstown Nostr Relay (BLS Handler Component)

---

## Executive Summary

This document provides detailed implementation specifications for the **BLS Game Action Handler** component in the Crosstown Nostr relay. The BLS handler processes kind 30078 Nostr events containing game actions, validates cryptographic signatures, and forwards authenticated actions to SpacetimeDB for execution.

**Key Responsibilities:**
1. Receive kind 30078 Nostr events from Crosstown relay
2. Validate Nostr event signatures (secp256k1)
3. Parse event content (reducer name and arguments)
4. Forward actions to SpacetimeDB HTTP API with identity propagation
5. Handle errors and return responses to relay

**Integration Points:**
- **Input:** Crosstown Nostr relay (kind 30078 events)
- **Output:** SpacetimeDB HTTP API (`/database/bitcraft/call/{reducer}`)
- **Identity:** Nostr public key (event.pubkey) → SpacetimeDB reducer first parameter

---

## Architecture Overview

### Event Flow

```
┌─────────────┐      Kind 30078 Event      ┌─────────────────┐
│   Sigil     │ ──────────────────────────> │   Crosstown     │
│   Client    │                             │   Nostr Relay   │
└─────────────┘                             └────────┬────────┘
                                                     │
                                                     │ ILP Routing
                                                     ▼
                                            ┌─────────────────┐
                                            │   BLS Handler   │
                                            │  (THIS COMPONENT)│
                                            └────────┬────────┘
                                                     │
                        ┌────────────────────────────┼────────────────────────────┐
                        │                            │                            │
                        ▼                            ▼                            ▼
               Signature Validation          Parse Content              Check Reducer Exists
               (secp256k1, NIP-01)          (JSON: reducer, args)       (Known reducer name)
                        │                            │                            │
                        └────────────────────────────┼────────────────────────────┘
                                                     │
                                                     │ All validations pass
                                                     ▼
                                            ┌─────────────────┐
                                            │   SpacetimeDB   │
                                            │   HTTP API      │
                                            │  (BitCraft DB)  │
                                            └─────────────────┘
                                                     │
                                                     │ Reducer Response
                                                     ▼
                                            ┌─────────────────┐
                                            │   Return to     │
                                            │   Relay (OK/ERR)│
                                            └─────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Crosstown Relay** | Routes kind 30078 events to BLS handler, forwards responses to sender |
| **BLS Handler** | Validates signatures, parses content, calls SpacetimeDB reducers |
| **SpacetimeDB HTTP API** | Executes reducers, updates game state, returns success/failure |

---

## Data Structures

### Kind 30078 Event Format (Input)

```typescript
interface NostrEvent {
  id: string;          // Event ID (SHA256 hash of canonical serialization)
  pubkey: string;      // Nostr public key (hex, 64 chars)
  created_at: number;  // Unix timestamp (seconds)
  kind: 30078;         // Game action event kind
  tags: string[][];    // Tags (may be empty for game actions)
  content: string;     // JSON-serialized game action (see below)
  sig: string;         // secp256k1 signature (hex, 128 chars)
}
```

### Event Content Format

```json
{
  "reducer": "player_move",
  "args": [
    { "x": 100, "z": 200 },
    { "x": 110, "z": 200 },
    false
  ]
}
```

**Field Specifications:**
- `reducer` (string, required): SpacetimeDB reducer name (e.g., "player_move", "craft_item")
- `args` (array, required): Arguments to pass to the reducer (may be empty array `[]`)

### SpacetimeDB Reducer Call Format (Output)

**Endpoint:** `POST /database/{database_name}/call/{reducer}`

**Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Body:**
```json
[
  "npub1abc123...",
  { "x": 100, "z": 200 },
  { "x": 110, "z": 200 },
  false
]
```

**Important:** The Nostr public key (npub-encoded) is **prepended** as the first element of the args array. All subsequent elements are the original args from the event content.

**Example Transformation:**
- **Input event content:** `{ "reducer": "player_move", "args": [origin, dest, run] }`
- **Output HTTP body:** `["npub1xyz...", origin, dest, run]`

### SpacetimeDB Response Format

**Success (200 OK):**
```json
{
  "success": true
}
```

**Failure (4xx/5xx):**
```json
{
  "error": "Reducer execution failed: Invalid move coordinates"
}
```

### BLS Error Response Format

When the BLS handler rejects an event, it returns an error to the Crosstown relay:

```json
{
  "eventId": "abc123...",
  "errorCode": "INVALID_SIGNATURE",
  "message": "Event signature verification failed",
  "retryable": false
}
```

**Error Codes:**
- `INVALID_SIGNATURE`: Signature verification failed (secp256k1 validation)
- `UNKNOWN_REDUCER`: Reducer name not recognized
- `REDUCER_FAILED`: SpacetimeDB reducer returned an error
- `INVALID_CONTENT`: Event content is not valid JSON or missing required fields

---

## Implementation Requirements

### 1. Event Reception (from Crosstown Relay)

**Requirement:** The BLS handler MUST register an event listener with the Crosstown relay to receive kind 30078 events.

**Implementation Notes:**
- Event listener registration mechanism depends on Crosstown relay architecture (e.g., pub/sub, event emitter, message queue)
- Handler MUST filter for `kind === 30078` (game action events only)
- Handler SHOULD log all received events at DEBUG level with event ID and pubkey

**Pseudocode:**
```javascript
relay.on('event', async (event) => {
  if (event.kind !== 30078) return;

  logger.debug('Received game action event', {
    eventId: event.id,
    pubkey: event.pubkey,
    reducer: parseReducerName(event.content)
  });

  await handleGameAction(event);
});
```

---

### 2. Signature Validation (NIP-01)

**Requirement:** The BLS handler MUST validate the Nostr event signature before processing any action.

**Validation Steps:**
1. Verify `event.id` is correctly computed:
   ```
   event_id = SHA256(canonical_serialization(event))
   ```
   Canonical serialization format (NIP-01):
   ```json
   [
     0,
     <pubkey>,
     <created_at>,
     <kind>,
     <tags>,
     <content>
   ]
   ```

2. Verify `event.sig` matches `event.id` using `event.pubkey`:
   ```
   secp256k1_verify(signature=event.sig, message=event.id, pubkey=event.pubkey)
   ```

**Implementation Notes:**
- Use a secp256k1 library (e.g., `@noble/secp256k1` for Node.js, `secp256k1` for Rust)
- Signature and pubkey are hex-encoded strings (128 chars and 64 chars respectively)
- If validation fails, return `INVALID_SIGNATURE` error immediately (do NOT proceed to reducer call)

**Pseudocode:**
```javascript
import { schnorr } from '@noble/secp256k1';

async function validateSignature(event) {
  // 1. Compute canonical event ID
  const canonical = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);
  const computedId = sha256(canonical);

  if (computedId !== event.id) {
    throw new Error('Event ID mismatch');
  }

  // 2. Verify signature
  const isValid = await schnorr.verify(event.sig, event.id, event.pubkey);

  if (!isValid) {
    throw new Error('Invalid signature');
  }
}
```

---

### 3. Content Parsing

**Requirement:** The BLS handler MUST parse the event content JSON to extract the reducer name and arguments.

**Validation Rules:**
- Content MUST be valid JSON
- Content MUST have a `reducer` field (string)
- Content MUST have an `args` field (array)
- If validation fails, return `INVALID_CONTENT` error

**Pseudocode:**
```javascript
function parseContent(event) {
  let content;
  try {
    content = JSON.parse(event.content);
  } catch (err) {
    throw new Error('INVALID_CONTENT: Content is not valid JSON');
  }

  if (typeof content.reducer !== 'string') {
    throw new Error('INVALID_CONTENT: Missing or invalid "reducer" field');
  }

  if (!Array.isArray(content.args)) {
    throw new Error('INVALID_CONTENT: Missing or invalid "args" field');
  }

  return {
    reducer: content.reducer,
    args: content.args
  };
}
```

---

### 4. Reducer Existence Check

**Requirement:** The BLS handler MUST verify the reducer exists before calling SpacetimeDB.

**Rationale:** Avoid unnecessary HTTP calls to SpacetimeDB for non-existent reducers.

**Implementation Approach:**

**Option A: Static Allowlist (Recommended for MVP)**
- Maintain a hardcoded list of known reducers
- Check reducer name against the list before calling SpacetimeDB
- Return `UNKNOWN_REDUCER` error if not in allowlist

```javascript
const KNOWN_REDUCERS = new Set([
  'player_move',
  'craft_item',
  'harvest_resource',
  // ... add all BitCraft reducers
]);

function validateReducer(reducerName) {
  if (!KNOWN_REDUCERS.has(reducerName)) {
    throw new Error(`UNKNOWN_REDUCER: ${reducerName}`);
  }
}
```

**Option B: SpacetimeDB Metadata Query (Future Enhancement)**
- Query SpacetimeDB `/database/bitcraft/schema` endpoint to fetch reducer list
- Cache the schema and refresh periodically
- More dynamic but requires additional HTTP call overhead

---

### 5. Identity Propagation

**Requirement:** The BLS handler MUST prepend the Nostr public key to the reducer args array.

**Format:**
- Input pubkey: hex string (64 chars)
- Output format: npub-encoded Bech32 string (starting with "npub1")

**Implementation:**
```javascript
import { nip19 } from 'nostr-tools';

function prepareReducerArgs(event, originalArgs) {
  // Convert hex pubkey to npub format
  const npubKey = nip19.npubEncode(event.pubkey);

  // Prepend to args array
  return [npubKey, ...originalArgs];
}

// Example:
// event.pubkey = "abc123..." (hex)
// originalArgs = [{ x: 100, z: 200 }, { x: 110, z: 200 }, false]
// returns: ["npub1abc...", { x: 100, z: 200 }, { x: 110, z: 200 }, false]
```

---

### 6. SpacetimeDB HTTP Call

**Requirement:** The BLS handler MUST call the SpacetimeDB HTTP API to execute the reducer.

**Configuration (Environment Variables):**
```bash
SPACETIMEDB_URL=http://localhost:3000
SPACETIMEDB_DATABASE=bitcraft
SPACETIMEDB_TOKEN=<admin_token>
```

**HTTP Request:**
```javascript
async function callReducer(reducerName, args) {
  const url = `${process.env.SPACETIMEDB_URL}/database/${process.env.SPACETIMEDB_DATABASE}/call/${reducerName}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SPACETIMEDB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`REDUCER_FAILED: ${error}`);
  }

  return await response.json();
}
```

**Error Handling:**
- `200 OK`: Reducer succeeded
- `4xx`: Client error (invalid args, reducer rejected action) → `REDUCER_FAILED`
- `5xx`: Server error (SpacetimeDB crash) → `REDUCER_FAILED`
- Network timeout: Retry once, then `REDUCER_FAILED`

---

### 7. Error Handling and Logging

**Requirement:** The BLS handler MUST log all errors and return structured error responses.

**Logging Levels:**
- **DEBUG:** All received events (event ID, pubkey, reducer name)
- **INFO:** Successful reducer executions (event ID, reducer, execution time)
- **WARN:** Retryable errors (network timeout, SpacetimeDB 5xx)
- **ERROR:** Non-retryable errors (invalid signature, unknown reducer, reducer failure)

**Error Response:**
```javascript
function createErrorResponse(event, errorCode, message, retryable = false) {
  return {
    eventId: event.id,
    errorCode: errorCode,
    message: message,
    retryable: retryable
  };
}

// Examples:
createErrorResponse(event, 'INVALID_SIGNATURE', 'Signature verification failed', false);
createErrorResponse(event, 'REDUCER_FAILED', 'Invalid move coordinates', false);
createErrorResponse(event, 'UNKNOWN_REDUCER', 'Reducer "invalid_action" not found', false);
```

**Relay Integration:**
The BLS handler returns the error response to the Crosstown relay, which forwards it to the sender as a Nostr NOTICE message (NIP-01) or OK message with error status.

---

### 8. Performance Requirements

**Latency:**
- Target: < 500ms end-to-end (event received → reducer response returned)
- Budget breakdown:
  - Signature validation: < 50ms
  - Content parsing: < 10ms
  - SpacetimeDB HTTP call: < 400ms
  - Error handling: < 40ms

**Throughput:**
- MVP: Handle 10 actions/second per BLS instance
- Phase 2: Handle 100 actions/second (horizontal scaling)

**Monitoring:**
- Log execution time for each reducer call
- Emit warning if any step exceeds latency budget
- Metrics: success rate, error rate by error code, p50/p95/p99 latency

---

## Implementation Tasks

### Task 1: Event Listener Setup
- [ ] Register event listener with Crosstown relay for kind 30078 events
- [ ] Add debug logging for all received events
- [ ] Add metrics: total events received counter

### Task 2: Signature Validation
- [ ] Implement NIP-01 canonical serialization
- [ ] Implement secp256k1 signature verification
- [ ] Add unit tests:
  - Valid signature → passes
  - Invalid signature → rejects with `INVALID_SIGNATURE`
  - Tampered event ID → rejects
- [ ] Add metrics: signature validation success/failure counters

### Task 3: Content Parsing
- [ ] Implement JSON content parsing
- [ ] Validate required fields (reducer, args)
- [ ] Add unit tests:
  - Valid content → parses successfully
  - Invalid JSON → rejects with `INVALID_CONTENT`
  - Missing fields → rejects with `INVALID_CONTENT`
- [ ] Add metrics: content parsing success/failure counters

### Task 4: Reducer Existence Check
- [ ] Create static allowlist of known reducers (Option A for MVP)
- [ ] Implement reducer validation logic
- [ ] Add unit tests:
  - Known reducer → passes
  - Unknown reducer → rejects with `UNKNOWN_REDUCER`
- [ ] Document how to update the allowlist when new reducers are added

### Task 5: Identity Propagation
- [ ] Implement hex → npub conversion (using nip19.npubEncode)
- [ ] Implement args array prepending logic
- [ ] Add unit tests:
  - Verify npub format is correct
  - Verify args array is prepended (not appended)
  - Verify original args are preserved

### Task 6: SpacetimeDB HTTP Integration
- [ ] Implement HTTP POST to SpacetimeDB reducer endpoint
- [ ] Add environment variable configuration (SPACETIMEDB_URL, DATABASE, TOKEN)
- [ ] Implement error handling for 4xx/5xx responses
- [ ] Add retry logic for network timeouts (1 retry max)
- [ ] Add unit tests:
  - Successful reducer call (200 OK) → returns success
  - Reducer failure (4xx) → rejects with `REDUCER_FAILED`
  - Network timeout → retries once, then fails
- [ ] Add metrics: reducer call success/failure/retry counters, latency histogram

### Task 7: Error Response Formatting
- [ ] Implement error response creation function
- [ ] Map internal errors to error codes (INVALID_SIGNATURE, UNKNOWN_REDUCER, etc.)
- [ ] Integrate with Crosstown relay (return errors to sender)
- [ ] Add unit tests for each error code

### Task 8: Logging and Monitoring
- [ ] Add structured logging (JSON format recommended)
- [ ] Log all events at DEBUG level (event ID, pubkey, reducer)
- [ ] Log all errors at ERROR level (event ID, error code, message)
- [ ] Log all successful reducer calls at INFO level (event ID, reducer, execution time)
- [ ] Add metrics dashboard (if Crosstown has monitoring infrastructure)

### Task 9: Integration Testing
- [ ] Set up test environment (Crosstown + BLS + SpacetimeDB)
- [ ] Test end-to-end flow:
  - Valid event → reducer executes, success returned
  - Invalid signature → rejected with `INVALID_SIGNATURE`
  - Unknown reducer → rejected with `UNKNOWN_REDUCER`
  - Reducer failure → rejected with `REDUCER_FAILED`
- [ ] Test performance under load (10 actions/second sustained)

### Task 10: Documentation
- [ ] Document BLS handler configuration (environment variables)
- [ ] Document error codes and troubleshooting steps
- [ ] Document how to add new reducers to allowlist
- [ ] Document monitoring and alerting setup

---

## Configuration

### Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `SPACETIMEDB_URL` | SpacetimeDB HTTP endpoint | `http://localhost:3000` | Yes |
| `SPACETIMEDB_DATABASE` | Database name | `bitcraft` | Yes |
| `SPACETIMEDB_TOKEN` | Admin token for SpacetimeDB API | `admin_token_abc123` | Yes |
| `BLS_LOG_LEVEL` | Logging level | `debug`, `info`, `warn`, `error` | No (default: `info`) |
| `BLS_KNOWN_REDUCERS` | Comma-separated list of allowed reducers | `player_move,craft_item` | No (uses static allowlist if not set) |

### Sample Configuration File

```yaml
# crosstown-bls.config.yaml
spacetimedb:
  url: http://localhost:3000
  database: bitcraft
  token: ${SPACETIMEDB_ADMIN_TOKEN}

bls:
  logLevel: info
  knownReducers:
    - player_move
    - craft_item
    - harvest_resource
    - build_structure

  performance:
    maxLatencyMs: 500
    maxRetries: 1
```

---

## Testing Strategy

### Unit Tests (95%+ Coverage)

**Signature Validation Tests:**
- ✅ Valid NIP-01 event → signature validates
- ✅ Invalid signature → rejects
- ✅ Tampered event ID → rejects
- ✅ Missing signature field → rejects

**Content Parsing Tests:**
- ✅ Valid JSON with reducer and args → parses
- ✅ Invalid JSON → rejects with INVALID_CONTENT
- ✅ Missing reducer field → rejects
- ✅ Missing args field → rejects
- ✅ Non-array args field → rejects

**Reducer Validation Tests:**
- ✅ Known reducer → passes
- ✅ Unknown reducer → rejects with UNKNOWN_REDUCER
- ✅ Case sensitivity (e.g., "Player_Move" vs "player_move")

**Identity Propagation Tests:**
- ✅ Hex pubkey → npub conversion is correct
- ✅ Args array prepending (not appending)
- ✅ Original args preserved and unmodified

**SpacetimeDB Call Tests (Mocked):**
- ✅ 200 OK response → success
- ✅ 400 Bad Request → REDUCER_FAILED
- ✅ 500 Internal Server Error → REDUCER_FAILED
- ✅ Network timeout → retries once, then fails

### Integration Tests

**End-to-End Flow:**
- ✅ Sigil client publishes event → BLS processes → SpacetimeDB executes → client receives confirmation
- ✅ Invalid signature → client receives INVALID_SIGNATURE error
- ✅ Unknown reducer → client receives UNKNOWN_REDUCER error
- ✅ Reducer fails validation → client receives REDUCER_FAILED error

**Performance Tests:**
- ✅ Single event latency < 500ms (p95)
- ✅ Sustained 10 actions/second for 60 seconds (no errors)
- ✅ Signature validation < 50ms (p95)
- ✅ SpacetimeDB HTTP call < 400ms (p95)

---

## Success Criteria

The BLS handler implementation is considered **DONE** when:

- [ ] All unit tests pass (95%+ coverage)
- [ ] All integration tests pass (end-to-end flow validated)
- [ ] Performance targets met:
  - [ ] p95 latency < 500ms
  - [ ] Sustained 10 actions/second throughput
- [ ] Error handling complete:
  - [ ] All error codes implemented (INVALID_SIGNATURE, UNKNOWN_REDUCER, REDUCER_FAILED, INVALID_CONTENT)
  - [ ] Errors logged with sufficient detail
  - [ ] Errors returned to relay/client
- [ ] Documentation complete:
  - [ ] Configuration guide (environment variables)
  - [ ] Error code reference
  - [ ] Troubleshooting guide
- [ ] Sigil SDK integration tests pass:
  - [ ] Sigil client → Crosstown relay → BLS handler → SpacetimeDB (round-trip)
  - [ ] Error propagation (client receives error messages)

---

## Open Questions

**Q1: SpacetimeDB Admin Token Security**
- **Issue:** Using admin token gives BLS handler overly broad permissions
- **MVP Approach:** Use admin token for MVP (acceptable risk)
- **Future Enhancement:** Create service account with limited permissions (only reducer execution)
- **Action:** Document admin token as security risk in deployment guide

**Q2: Reducer Allowlist Maintenance**
- **Issue:** Static allowlist requires code changes when new reducers are added
- **MVP Approach:** Static allowlist in code (Task 4, Option A)
- **Future Enhancement:** Query SpacetimeDB schema endpoint dynamically (Option B)
- **Action:** Document how to update allowlist when adding new reducers

**Q3: Retry Logic for Network Failures**
- **Issue:** Should BLS handler retry on SpacetimeDB network timeout?
- **MVP Approach:** Retry once (max 1 retry)
- **Rationale:** Client can retry if needed; excessive retries risk duplicate actions
- **Action:** Log retries at WARN level for monitoring

---

## Contact & Coordination

**Sigil SDK Team:**
- Primary Contact: [Your Name/Email]
- Repository: `https://github.com/[org]/sigil-sdk`
- Integration Test Location: `packages/client/src/integration-tests/bls-handler.integration.test.ts`

**Crosstown Team:**
- Primary Contact: [Crosstown Team Contact]
- Repository: `https://github.com/[org]/crosstown`
- BLS Handler Location: `[TBD - to be determined by Crosstown team]`

**Handoff Process:**
1. Crosstown team reviews this specification document
2. Crosstown team implements BLS handler per specification
3. Crosstown team notifies Sigil SDK team when BLS handler is deployed
4. Sigil SDK team runs integration tests against live BLS handler
5. Both teams validate end-to-end flow
6. Story 2.4 marked complete when all integration tests pass

---

## Appendix A: Example Event Payloads

### Example 1: Player Move Action

**Nostr Event (Kind 30078):**
```json
{
  "id": "a1b2c3d4e5f6...",
  "pubkey": "abc123def456...",
  "created_at": 1709136000,
  "kind": 30078,
  "tags": [],
  "content": "{\"reducer\":\"player_move\",\"args\":[{\"x\":100,\"z\":200},{\"x\":110,\"z\":200},false]}",
  "sig": "signature_hex_string..."
}
```

**SpacetimeDB HTTP Call:**
```
POST /database/bitcraft/call/player_move
Authorization: Bearer admin_token_abc123
Content-Type: application/json

["npub1abc123...", {"x":100,"z":200}, {"x":110,"z":200}, false]
```

### Example 2: Craft Item Action

**Nostr Event (Kind 30078):**
```json
{
  "id": "f1e2d3c4b5a6...",
  "pubkey": "xyz789uvw012...",
  "created_at": 1709136100,
  "kind": 30078,
  "tags": [],
  "content": "{\"reducer\":\"craft_item\",\"args\":[{\"itemId\":42,\"quantity\":5}]}",
  "sig": "signature_hex_string..."
}
```

**SpacetimeDB HTTP Call:**
```
POST /database/bitcraft/call/craft_item
Authorization: Bearer admin_token_abc123
Content-Type: application/json

["npub1xyz789...", {"itemId":42,"quantity":5}]
```

---

## Appendix B: Error Code Reference

| Error Code | Description | Retryable | Client Action |
|------------|-------------|-----------|---------------|
| `INVALID_SIGNATURE` | Event signature verification failed (secp256k1) | No | Re-sign the event, check Nostr keypair |
| `UNKNOWN_REDUCER` | Reducer name not recognized by BLS handler | No | Check reducer name spelling, verify reducer exists in SpacetimeDB schema |
| `REDUCER_FAILED` | SpacetimeDB reducer returned an error (4xx/5xx) | No | Check reducer arguments, verify game state allows this action |
| `INVALID_CONTENT` | Event content is not valid JSON or missing required fields | No | Fix JSON formatting, ensure `reducer` and `args` fields present |

---

## Appendix C: Performance Benchmarks

**Target Hardware:**
- CPU: 4 cores @ 2.5GHz
- RAM: 8GB
- Network: < 50ms latency to SpacetimeDB

**Expected Performance:**
- Single event latency: 200-400ms (p50), < 500ms (p95)
- Throughput: 10-20 actions/second per BLS instance
- Signature validation: 20-40ms (p50), < 50ms (p95)
- SpacetimeDB HTTP call: 100-300ms (p50), < 400ms (p95)

**Scaling Strategy:**
- Horizontal: Deploy multiple BLS handler instances behind load balancer
- Vertical: Increase CPU cores if signature validation is bottleneck

---

**END OF SPECIFICATION**

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-28 | 1.0 | Sigil SDK Team | Initial specification created |

