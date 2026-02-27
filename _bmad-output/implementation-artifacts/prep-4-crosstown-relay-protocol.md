# PREP-4: Crosstown Relay Protocol Reference

**Status:** Complete
**Date:** 2026-02-27
**Epic:** Epic 2 Preparation
**Story:** Story 2.1 - Crosstown Relay Connection & Event Subscriptions

---

## Executive Summary

Crosstown is a **stub implementation** of an ILP-enabled Nostr relay specifically built for the Sigil SDK development environment. It combines:

1. **NIP-01 compliant Nostr relay** - Standard WebSocket-based event publishing/subscription
2. **BLS (Blockchain-Like Signing) proxy** - Game action handler for kind 30078 events
3. **ILP integration** - Payment validation and routing (to be fully implemented in Epic 2)

**Current Status (Epic 1 Complete):**
- Crosstown runs in **stub mode** (logs ILP packets, does NOT forward to SpacetimeDB)
- Built from local Rust source at `docker/crosstown/crosstown-src/`
- Docker container: `sigil-crosstown-node`
- Ports: 4040 (Nostr WebSocket), 4041 (HTTP API)

**Future Epic 2 Implementation:**
- Full BLS identity propagation to SpacetimeDB
- ILP payment validation and wallet management
- Reducer dispatch with Nostr public key attribution

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Connection Protocol](#connection-protocol)
3. [Nostr Relay Protocol (NIP-01)](#nostr-relay-protocol-nip-01)
4. [Crosstown Extensions](#crosstown-extensions)
5. [Event Types](#event-types)
6. [Subscription Protocol](#subscription-protocol)
7. [ILP Integration](#ilp-integration)
8. [BLS Game Action Handler](#bls-game-action-handler)
9. [Security & Rate Limiting](#security--rate-limiting)
10. [Implementation Notes for Story 2.1](#implementation-notes-for-story-21)
11. [Testing Strategies](#testing-strategies)
12. [References](#references)

---

## Architecture Overview

### What is Crosstown?

Crosstown is **NOT** a publicly available package or service. It is a **local development stub** implemented specifically for Sigil SDK integration testing.

**Key Components:**

```
┌─────────────────────────────────────────────┐
│           Crosstown Node                    │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │   Nostr Relay (NIP-01)             │    │
│  │   - WebSocket: ws://localhost:4040 │    │
│  │   - Event storage (in-memory)      │    │
│  │   - Rate limiting (100/60s)        │    │
│  └────────────────────────────────────┘    │
│                     │                       │
│  ┌────────────────────────────────────┐    │
│  │   BLS Proxy (Game Actions)         │    │
│  │   - Listens for kind 30078 events  │    │
│  │   - Parses ILP packets             │    │
│  │   - STUB: Logs to stdout           │    │
│  │   - FUTURE: Forward to SpacetimeDB │    │
│  └────────────────────────────────────┘    │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │   HTTP API                         │    │
│  │   - Health: http://localhost:4041  │    │
│  │   - Metrics: /metrics              │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
         │
         ├── Depends on: BitCraft Server (SpacetimeDB)
         └── Docker network: sigil-dev
```

### Integration with Sigil SDK

```
┌──────────────┐     WebSocket      ┌─────────────┐     WebSocket     ┌──────────────┐
│  SigilClient │ ─────────────────> │  Crosstown  │ ────────────────> │   BitCraft   │
│   (@sigil/   │                    │    Relay    │                   │    Server    │
│    client)   │                    │             │                   │ (SpacetimeDB)│
└──────────────┘                    └─────────────┘                   └──────────────┘
      │                                     │
      │ Read Path (Story 1.4)               │ Write Path (Story 2.3)
      │ - SpacetimeDB subscriptions         │ - Nostr relay publish
      │ - Direct WebSocket to BitCraft      │ - ILP packet routing
      └─────────────────────────────────────┘ - BLS identity propagation
```

**Design Principles:**

- **BitCraft runs unmodified** - No changes to SpacetimeDB server
- **Crosstown is dependency-free** - No `@crosstown/client` npm package (architecture docs reference this as planned, but NOT implemented)
- **NIP-01 compliance** - Standard Nostr relay protocol for interoperability
- **Stub mode for development** - Logs actions without SpacetimeDB integration until Epic 2

---

## Connection Protocol

### WebSocket Endpoint

```
Nostr Relay: ws://localhost:4040
```

**No authentication required** in development mode.

**Production considerations:**
- Authentication via NIP-42 (AUTH message) - NOT implemented in stub
- TLS/WSS for encrypted transport - NOT implemented in stub
- Rate limiting per connection (100 events/60s)

### Connection Handshake

Standard WebSocket handshake (RFC 6455):

```
Client → Server:
GET / HTTP/1.1
Host: localhost:4040
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==
Sec-WebSocket-Version: 13

Server → Client:
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: HSmrc0sMlYUkAGmm5OPpG2HaGWk=
```

No custom Nostr-specific handshake. Once upgraded, all communication is JSON over WebSocket.

### Keep-Alive / Ping-Pong

Crosstown **does NOT** send WebSocket ping frames. Clients SHOULD implement their own keep-alive if needed (e.g., periodic empty REQ or heartbeat).

**Reconnection behavior:**

- Connection drops are detected via WebSocket close event
- Client MUST implement exponential backoff reconnection (same as Story 1.6 SpacetimeDB reconnection)
- Subscriptions are NOT persisted server-side - client MUST re-subscribe after reconnection

---

## Nostr Relay Protocol (NIP-01)

Crosstown implements the **NIP-01 baseline** with some limitations (see Deviations section).

### Client-to-Relay Messages

All messages are JSON arrays sent as WebSocket text frames.

#### EVENT Message

Publish a signed Nostr event to the relay.

```json
["EVENT", {event_object}]
```

**Example:**

```json
["EVENT", {
  "id": "4376c65d2f232afbe9b882a35baa4f6fe8667c4e684749af565f981833ed6a65",
  "pubkey": "6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93",
  "created_at": 1673347337,
  "kind": 1,
  "tags": [],
  "content": "Walled gardens became prisons, and nostr is the first step towards tearing down the prison walls.",
  "sig": "908a15e46fb4d8675bab026fc230a0e3542bfade63da02d542fb78b2a8513fcd0092619a2c8c1221e581946e0191f2af505dfdf8657a414dbca329186f009262"
}]
```

**Relay Response:**

```json
["OK", "4376c65d2f232afbe9b882a35baa4f6fe8667c4e684749af565f981833ed6a65", true, ""]
```

Or on failure:

```json
["OK", "event_id", false, "error: reason"]
```

**Error Prefixes (NIP-01 standard):**

- `duplicate:` - Event already exists
- `pow:` - Insufficient proof-of-work (NOT implemented in Crosstown)
- `blocked:` - Pubkey or content is banned (NOT implemented in Crosstown)
- `rate-limited:` - Rate limit exceeded (Crosstown: 100 events/60s per connection)
- `invalid:` - Malformed event (missing required fields, invalid signature)
- `restricted:` - Event kind not accepted (Crosstown accepts all kinds in stub mode)
- `error:` - Other relay-specific errors

#### REQ Message

Subscribe to events matching filters.

```json
["REQ", subscription_id, filter1, filter2, ...]
```

**Parameters:**

- `subscription_id` - Arbitrary string (max 64 chars), unique per WebSocket connection
- `filter1`, `filter2`, ... - One or more filter objects (see Filter Structure)

**Example:**

```json
["REQ", "sub-1", {"kinds": [1], "authors": ["pubkey_hex"], "limit": 10}]
```

**Relay Responses:**

1. Zero or more `["EVENT", "sub-1", {event}]` messages (stored events)
2. One `["EOSE", "sub-1"]` message (end of stored events)
3. Future `["EVENT", "sub-1", {event}]` messages (real-time updates)

**Subscription lifecycle:**

- Subscriptions persist until `CLOSE` is sent or WebSocket disconnects
- Sending a new `REQ` with the same `subscription_id` **replaces** the previous subscription
- Server does NOT persist subscriptions across reconnections

#### CLOSE Message

Stop a subscription.

```json
["CLOSE", subscription_id]
```

No response from relay. Events for that subscription_id will no longer be sent.

### Relay-to-Client Messages

#### EVENT Message

Deliver an event matching a subscription.

```json
["EVENT", subscription_id, {event_object}]
```

Sent for:
- Stored events matching REQ filters (before EOSE)
- New events matching active subscriptions (after EOSE)

#### EOSE Message

End of stored events.

```json
["EOSE", subscription_id]
```

Indicates the relay has sent all stored events for this subscription. Future EVENTs will be real-time updates.

**Crosstown behavior:**

- EOSE is sent **immediately** after REQ (stub mode does NOT query stored events)
- In-memory event store exists but is NOT queried for REQ filters
- All stored events can be retrieved via direct access (future enhancement)

#### OK Message

Acknowledge EVENT submission.

```json
["OK", event_id, true/false, "message"]
```

- `true` - Event accepted and stored
- `false` - Event rejected (see error message for reason)

#### NOTICE Message

Human-readable relay message.

```json
["NOTICE", "message text"]
```

**Crosstown uses NOTICE for:**

- Rate limit warnings: `"Rate limit exceeded. Max 100 events per 60 seconds."`
- Future: Invalid event format errors

#### CLOSED Message (NOT implemented in Crosstown stub)

Server-side subscription termination.

```json
["CLOSED", subscription_id, "reason"]
```

NIP-01 allows relays to terminate subscriptions. Crosstown does NOT implement this (subscriptions only close on client CLOSE or disconnect).

### Event Structure

All Nostr events follow this structure:

```typescript
interface NostrEvent {
  id: string;          // 32-byte lowercase hex (SHA256 of serialized event)
  pubkey: string;      // 32-byte lowercase hex (author's public key)
  created_at: number;  // Unix timestamp in seconds
  kind: number;        // Event type (0-65535)
  tags: string[][];    // Array of string arrays
  content: string;     // Arbitrary string payload
  sig: string;         // 64-byte signature (Schnorr secp256k1)
}
```

**ID Computation:**

```javascript
// Canonical JSON serialization (no whitespace, UTF-8)
const serialized = JSON.stringify([
  0,               // Reserved for future use
  pubkey,
  created_at,
  kind,
  tags,
  content
]);

const id = sha256(utf8_encode(serialized));
```

**Signature:**

- Schnorr signature over secp256k1 curve (same as Bitcoin Taproot)
- Signs the event ID (not the full serialized data)
- Library: `nostr-tools` (npm) or `secp256k1` (Rust)

### Filter Structure

Filters use AND logic within a single filter, OR logic across multiple filters.

```typescript
interface Filter {
  ids?: string[];       // Exact event IDs (64-char hex)
  authors?: string[];   // Exact pubkeys (64-char hex)
  kinds?: number[];     // Event kinds
  since?: number;       // Unix timestamp (inclusive)
  until?: number;       // Unix timestamp (inclusive)
  limit?: number;       // Max results (default: implementation-defined)
  '#e'?: string[];      // Events tagged with these event IDs
  '#p'?: string[];      // Events tagged with these pubkeys
  '#d'?: string[];      // Events with 'd' tag (for addressable events)
  // ... any #[letter] tag filter
}
```

**Crosstown filter support:**

- ✅ `kinds` - Fully supported
- ⚠️ `authors`, `ids`, `#e`, `#p`, `#d` - NOT implemented (stub returns EOSE immediately)
- ⚠️ `since`, `until`, `limit` - NOT implemented (stub returns EOSE immediately)

**Story 2.1 requirements:**

- Client MUST support NIP-01 filters
- Crosstown stub MAY return empty result sets (EOSE only)
- Full filter implementation is deferred to Epic 3-4 (if needed)

### Event Kinds

**Standard Nostr kinds (for reference):**

- `0` - User metadata (replaceable)
- `1` - Text note
- `3` - Contact list (replaceable)
- `4` - Encrypted direct message
- `7` - Reaction
- `30023` - Long-form content (addressable)

**Crosstown-specific kinds:**

- `30078` - Application-specific data (NIP-78) - **Used for ILP game actions**

**Kind categories:**

- **Regular** (1000-9999): Stored permanently
- **Replaceable** (10000-19999): Only latest per pubkey/kind
- **Ephemeral** (20000-29999): NOT stored
- **Addressable** (30000-39999): Latest per pubkey/kind/d-tag

Crosstown **accepts all kinds** in stub mode (`accepted_event_kinds = "all"` in config).

---

## Crosstown Extensions

Crosstown extends NIP-01 with **minimal deviations** to support ILP game actions.

### Deviations from NIP-01

| Feature | NIP-01 Standard | Crosstown Stub | Notes |
|---------|-----------------|----------------|-------|
| Filter queries | Full filter support | EOSE only (no stored event queries) | Story 2.1 MAY defer full queries |
| Event storage | Persistent | In-memory (HashMap) | Lost on restart |
| Subscription persistence | Connection-scoped | Connection-scoped | Standard behavior |
| Rate limiting | Optional | 100 events/60s per connection | Required for security |
| Authentication | Optional (NIP-42) | None | Development mode only |
| Event kind filtering | Relay-defined | Accept all | `accepted_event_kinds = "all"` |
| Subscription limits | Relay-defined | No limit | Future: max 10 subscriptions/connection |

### Custom Features

**BLS Game Action Handler:**

- Listens for `kind: 30078` events
- Parses `content` as JSON: `{ reducer: string, args: any[], fee: number }`
- **Stub mode:** Logs to stdout `[BLS STUB] Received kind 30078 from {pubkey}: reducer={name}, args_count={n}, fee={fee}`
- **Full mode (Epic 2):** Validates ILP payment, extracts Nostr pubkey, calls SpacetimeDB reducer

**HTTP API Endpoints:**

```
GET http://localhost:4041/health
Response: 200 OK
{
  "status": "healthy",
  "version": "0.1.0",
  "relay_mode": "stub"
}

GET http://localhost:4041/metrics
Response: 200 OK (Prometheus format)
# Crosstown metrics (stub)
crosstown_events_total 0
```

**Security headers (OWASP compliance):**

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

---

## Event Types

### Kind 30078: Application-Specific Data (NIP-78)

**Purpose:** Store arbitrary application data on Nostr relays.

**Sigil SDK use case:** ILP game action packets.

**Event structure:**

```json
{
  "kind": 30078,
  "content": "{\"reducer\":\"player_move\",\"args\":{\"origin\":{\"x\":100,\"z\":200},\"destination\":{\"x\":110,\"z\":200},\"running\":false},\"fee\":1}",
  "tags": [
    ["d", "bitcraft-action"],
    ["game", "bitcraft"],
    ["reducer", "player_move"],
    ["cost", "1"]
  ],
  "pubkey": "...",
  "created_at": 1673347337,
  "id": "...",
  "sig": "..."
}
```

**Required fields:**

- `kind: 30078`
- `content` - JSON string containing:
  - `reducer` - SpacetimeDB reducer name (e.g., `"player_move"`)
  - `args` - Reducer arguments (any valid JSON)
  - `fee` - ILP cost (number)
- `tags`:
  - `["d", "bitcraft-action"]` - Addressable event identifier (NIP-78 requirement)
  - `["game", "bitcraft"]` - Game identifier (Sigil-specific)
  - `["reducer", "{name}"]` - Reducer name (for filtering)
  - `["cost", "{fee}"]` - ILP cost (for transparency)

**Content parsing:**

```typescript
interface ILPPacket {
  reducer: string;
  args: any; // JSON-serializable
  fee: number;
}

const packet: ILPPacket = JSON.parse(event.content);
```

**Validation:**

- ✅ Event signature (standard Nostr verification)
- ✅ Content is valid JSON
- ✅ Content has `reducer`, `args`, `fee` fields
- ⚠️ ILP payment validation (NOT implemented in stub)
- ⚠️ Reducer name exists in SpacetimeDB (NOT validated in stub)

**BLS stub behavior:**

```rust
// From docker/crosstown/crosstown-src/src/main.rs:312-344
fn handle_bls_stub(event: &NostrEvent) {
    // Parse ILP packet from event content
    match serde_json::from_str::<ILPPacket>(&event.content) {
        Ok(packet) => {
            tracing::info!(
                "[BLS STUB] Received kind 30078 from {}: reducer={}, args_count={}, fee={}",
                sanitized_pubkey,
                sanitized_reducer,
                packet.args.len(),
                packet.fee
            );
        }
        Err(e) => {
            tracing::warn!(
                "[BLS STUB] Failed to parse ILP packet from kind 30078 event: {}",
                e
            );
        }
    }
}
```

**Example log output:**

```
[BLS STUB] Received kind 30078 from 6e468422...: reducer=player_move, args_count=1, fee=1
```

### Other Event Kinds (Future)

**Kind 1 - Text notes:**

- Future: Chat messages in-game
- Not required for Epic 2

**Kind 0 - User metadata:**

- Future: Player profiles
- Not required for Epic 2

**Kind 7 - Reactions:**

- Future: Social interactions
- Not required for Epic 2

---

## Subscription Protocol

### Subscribing to Events

**Example: Subscribe to all kind 30078 events**

```typescript
// Client sends REQ
ws.send(JSON.stringify([
  "REQ",
  "game-actions",
  { kinds: [30078] }
]));

// Relay responds (stub mode)
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);

  if (data[0] === "EOSE") {
    console.log("End of stored events");
    // No stored events returned in stub mode
  }

  if (data[0] === "EVENT") {
    const [_, subId, event] = data;
    console.log("Received event:", event);
    // Real-time events start arriving here
  }
};
```

**Example: Subscribe to specific reducer**

```typescript
ws.send(JSON.stringify([
  "REQ",
  "player-moves",
  { kinds: [30078], "#reducer": ["player_move"] }
]));
```

**Note:** Tag filtering (`#reducer`) is NOT implemented in Crosstown stub. This will return EOSE immediately with no events. Full implementation in Epic 3-4.

### Subscription Lifecycle

```
Client                         Relay
  │                              │
  ├─ ["REQ", "sub-1", {...}] ──> │
  │                              ├─ Query stored events (stub: skip)
  │                              ├─ Send matching events (stub: none)
  │                              ├─ ["EOSE", "sub-1"] ──────────────> │
  │                              │
  │                              ├─ New event arrives
  │                              ├─ ["EVENT", "sub-1", {...}] ──────> │
  │                              │
  ├─ ["CLOSE", "sub-1"] ───────> │
  │                              ├─ Stop sending events for sub-1
```

### Multiple Subscriptions

Clients can maintain multiple subscriptions per connection:

```typescript
ws.send(JSON.stringify(["REQ", "sub-1", { kinds: [1] }]));
ws.send(JSON.stringify(["REQ", "sub-2", { kinds: [30078] }]));
ws.send(JSON.stringify(["REQ", "sub-3", { authors: ["pubkey"] }]));

// Relay sends events tagged with subscription_id
ws.onmessage = (msg) => {
  const [type, subId, event] = JSON.parse(msg.data);

  if (type === "EVENT") {
    switch (subId) {
      case "sub-1": handleTextNote(event); break;
      case "sub-2": handleGameAction(event); break;
      case "sub-3": handleUserEvent(event); break;
    }
  }
};
```

**Crosstown limits:**

- No hard limit on subscriptions per connection (stub mode)
- Future: max 10 subscriptions per connection (anti-DoS)

### Replacing Subscriptions

Sending a new `REQ` with the same `subscription_id` replaces the old subscription:

```typescript
// Initial subscription
ws.send(JSON.stringify(["REQ", "main", { kinds: [1] }]));

// Replace with new filters (no need to CLOSE first)
ws.send(JSON.stringify(["REQ", "main", { kinds: [30078] }]));
```

Old subscription is implicitly closed.

---

## ILP Integration

### What is ILP?

**Interledger Protocol (ILP)** - A payment protocol for routing payments across different ledgers.

**ILPv4 packet types:**

1. **Prepare** - Payment request from sender
2. **Fulfill** - Payment accepted by receiver
3. **Reject** - Payment rejected

**Sigil SDK use case:**

- ILP packets wrap game actions (reducers)
- Crosstown routes ILP packets to BLS
- BLS validates payment and executes reducer

### ILP Packet Structure (Sigil-Specific)

**Content of kind 30078 events:**

```json
{
  "reducer": "player_move",
  "args": {
    "origin": { "x": 100, "z": 200 },
    "destination": { "x": 110, "z": 200 },
    "running": false
  },
  "fee": 1
}
```

**NOT standard ILP format** - This is a Sigil-specific JSON schema. True ILP packets are binary-encoded. Crosstown stub uses JSON for simplicity.

### Payment Flow (Future Epic 2)

```
1. Client constructs ILP packet (JSON)
2. Client signs Nostr event (kind 30078, content = JSON.stringify(packet))
3. Client publishes EVENT to Crosstown relay
4. Crosstown BLS receives event
5. BLS validates payment (checks wallet balance, deducts fee)
6. BLS extracts Nostr pubkey and reducer/args
7. BLS calls SpacetimeDB reducer with identity propagation
8. BLS returns ILP Fulfill or Reject
9. Crosstown publishes confirmation event to relay
10. Client receives confirmation via subscription
```

**Stub mode behavior:**

- Steps 5-9 are NOT implemented
- BLS logs the packet and returns success (no actual SpacetimeDB call)

### Wallet Management (Future Epic 2)

**Story 2.2 requirements:**

- `client.publish.getCost(actionName)` - Query ILP cost from action cost registry
- Wallet balance query - Retrieve current ILP balance from Crosstown
- Balance tracking - Deduct fees on successful actions

**Stub mode:**

- No wallet, no balance tracking
- All actions succeed (no payment validation)

---

## BLS Game Action Handler

### Architecture

```
Crosstown Relay
  │
  ├─ Event: kind 30078
  │    │
  │    └─> BLS Handler
  │          │
  │          ├─ Parse content as ILPPacket
  │          ├─ Extract: reducer, args, fee
  │          ├─ Extract: event.pubkey (Nostr public key)
  │          │
  │          ├─ STUB MODE (Story 1.3)
  │          │   └─> Log to stdout
  │          │
  │          └─ FULL MODE (Story 2.5)
  │              ├─> Validate ILP payment
  │              ├─> Call SpacetimeDB reducer:
  │              │     spacetime call bitcraft {reducer} \
  │              │       --identity {pubkey} {args...}
  │              └─> Return result to relay
```

### Configuration

File: `docker/crosstown/config.toml`

```toml
[bls_proxy]
bitcraft_database = "bitcraft"
identity_propagation = "stub"  # or "full"
```

**Modes:**

- `stub` - Log only (current)
- `full` - SpacetimeDB integration (Epic 2)

### Stub Mode Implementation

**Source:** `docker/crosstown/crosstown-src/src/main.rs`

```rust
// Lines 269-271: Event handler
if event.kind == 30078 && identity_mode == "stub" {
    handle_bls_stub(&event);
}

// Lines 312-344: BLS stub handler
fn handle_bls_stub(event: &NostrEvent) {
    let sanitized_pubkey = if event.pubkey.len() > 8 {
        format!("{}...", &event.pubkey[..8])
    } else {
        event.pubkey.clone()
    };

    match serde_json::from_str::<ILPPacket>(&event.content) {
        Ok(packet) => {
            let sanitized_reducer = packet.reducer
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_')
                .collect::<String>();

            tracing::info!(
                "[BLS STUB] Received kind 30078 from {}: reducer={}, args_count={}, fee={}",
                sanitized_pubkey,
                sanitized_reducer,
                packet.args.len(),
                packet.fee
            );
        }
        Err(e) => {
            tracing::warn!(
                "[BLS STUB] Failed to parse ILP packet from kind 30078 event: {}",
                e
            );
        }
    }
}
```

**Security features:**

- Pubkey truncation for logging (prevents log injection)
- Reducer name sanitization (alphanumeric + underscore only)
- JSON parsing error handling

### Full Mode Implementation (Epic 2)

**Requirements for Story 2.5:**

1. Parse ILP packet from event.content
2. Validate ILP payment (check wallet balance, deduct fee)
3. Extract Nostr pubkey from event.pubkey
4. Call SpacetimeDB reducer:
   ```bash
   spacetime call bitcraft {reducer} --identity {pubkey} {args...}
   ```
5. Capture result (success/failure)
6. Publish confirmation event to relay (kind TBD)
7. Return ILP Fulfill or Reject

**Identity propagation:**

- SpacetimeDB `--identity {pubkey}` flag sets the authenticated caller
- Reducers can access `ctx.sender` to get Nostr pubkey
- End-to-end cryptographic identity chain:
  1. Client signs event with Nostr private key
  2. Crosstown validates signature (pubkey matches sig)
  3. BLS extracts pubkey and forwards to SpacetimeDB
  4. Reducer sees pubkey as `ctx.sender`

---

## Security & Rate Limiting

### Rate Limiting

**Per-connection limits:**

- **100 events per 60 seconds**
- Sliding window (not fixed buckets)
- Applies to EVENT messages only (not REQ/CLOSE)

**Implementation:**

```rust
// Lines 68-95: RateLimiter
struct RateLimiter {
    events: Vec<Instant>,
    max_events: usize,
    window: Duration,
}

impl RateLimiter {
    fn new(max_events: usize, window_secs: u64) -> Self {
        Self {
            events: Vec::new(),
            max_events,
            window: Duration::from_secs(window_secs),
        }
    }

    fn check_and_record(&mut self) -> bool {
        let now = Instant::now();
        // Remove events outside the window
        self.events.retain(|&t| now.duration_since(t) < self.window);

        if self.events.len() >= self.max_events {
            return false; // Rate limit exceeded
        }

        self.events.push(now);
        true
    }
}
```

**Enforcement:**

```rust
// Line 256-261: Rate limit check
if !rate_limiter.check_and_record() {
    tracing::warn!("Rate limit exceeded for connection");
    let error_response = serde_json::json!(["NOTICE", "Rate limit exceeded. Max 100 events per 60 seconds."]);
    let _ = tx.send(warp::ws::Message::text(error_response.to_string())).await;
    continue; // Drop event
}
```

**Client behavior:**

- Clients SHOULD respect rate limits
- Exceeded events are dropped (not stored)
- NOTICE message sent to client (not guaranteed delivery)

### Input Validation

**Event validation:**

- ✅ Event is valid JSON
- ✅ Event has required fields: `id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig`
- ⚠️ Signature verification - NOT implemented in stub (accepts all events)
- ⚠️ ID correctness - NOT implemented in stub

**Content validation (kind 30078):**

- ✅ Content is valid JSON
- ✅ Content has `reducer`, `args`, `fee` fields
- ⚠️ Reducer name exists in SpacetimeDB - NOT validated
- ⚠️ Args match reducer signature - NOT validated

### Security Headers

**HTTP API endpoints:**

```rust
// Lines 167-169: Health endpoint security headers
let response = warp::reply::with_header(response, "X-Content-Type-Options", "nosniff");
let response = warp::reply::with_header(response, "X-Frame-Options", "DENY");
let response = warp::reply::with_header(response, "X-XSS-Protection", "1; mode=block");
```

**WebSocket security:**

- No custom security headers (WebSocket protocol doesn't support HTTP headers after handshake)
- CORS enabled for `http://localhost:3000` (development only)

### Authentication (NOT Implemented)

**NIP-42 AUTH message:**

Standard Nostr relays can require authentication via NIP-42. Crosstown stub does NOT implement this.

**Future implementation:**

```typescript
// Client receives AUTH challenge
ws.onmessage = (msg) => {
  const [type, challenge] = JSON.parse(msg.data);

  if (type === "AUTH") {
    const authEvent = {
      kind: 22242,
      content: "",
      tags: [["challenge", challenge], ["relay", "ws://localhost:4040"]],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: myPubkey,
    };

    authEvent.id = computeId(authEvent);
    authEvent.sig = sign(authEvent.id, myPrivateKey);

    ws.send(JSON.stringify(["AUTH", authEvent]));
  }
};
```

Not required for Epic 2.

---

## Implementation Notes for Story 2.1

### Client Library Design

**Story 2.1 requirements:**

1. Connect to Crosstown Nostr relay via WebSocket
2. Subscribe to events with NIP-01 filters
3. Emit `actionConfirmed` event on confirmation events
4. Reconnect with exponential backoff on disconnection
5. Re-subscribe after reconnection

**Recommended API:**

```typescript
interface SigilClientOptions {
  nostrRelay?: string; // Default: ws://localhost:4040
  // ... existing options
}

class SigilClient {
  public nostr: NostrClient; // Story 2.1 surface

  async connect(): Promise<void> {
    await this.spacetimedb.connect(); // Story 1.4
    await this.nostr.connect();       // Story 2.1
  }
}

class NostrClient {
  private ws: WebSocket;
  private subscriptions: Map<string, Subscription>;

  async connect(): Promise<void>;
  subscribe(filters: Filter[], handler: (event: NostrEvent) => void): Subscription;
  publish(event: NostrEvent): Promise<void>;
}

interface Subscription {
  id: string;
  filters: Filter[];
  unsubscribe(): void;
}
```

**Example usage:**

```typescript
const client = new SigilClient({
  nostrRelay: 'ws://localhost:4040',
});

await client.connect();

// Subscribe to action confirmations
const sub = client.nostr.subscribe(
  [{ kinds: [30078] }],
  (event) => {
    const packet = JSON.parse(event.content);
    console.log('Action confirmed:', packet.reducer);
  }
);

// Emit high-level event
client.on('actionConfirmed', (details) => {
  console.log('Action confirmed (high-level):', details);
});
```

### Reconnection Strategy

**Reuse Story 1.6 exponential backoff:**

```typescript
class NostrClient {
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 seconds

  private async reconnect(): Promise<void> {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;

    await sleep(delay);

    try {
      await this.connect();
      this.reconnectAttempts = 0; // Reset on success

      // Re-subscribe to all active subscriptions
      for (const sub of this.subscriptions.values()) {
        await this.sendREQ(sub.id, sub.filters);
      }
    } catch (err) {
      // Retry
      await this.reconnect();
    }
  }
}
```

### Error Handling

**WebSocket errors:**

```typescript
ws.onerror = (err) => {
  this.emit('error', new SigilError({
    code: 'WEBSOCKET_ERROR',
    message: 'Nostr relay WebSocket error',
    boundary: 'nostr-relay',
    cause: err,
  }));
};

ws.onclose = (event) => {
  this.emit('connectionChange', { status: 'disconnected' });
  this.reconnect();
};
```

**Event parsing errors:**

```typescript
ws.onmessage = (msg) => {
  try {
    const data = JSON.parse(msg.data);
    this.handleMessage(data);
  } catch (err) {
    this.emit('error', new SigilError({
      code: 'INVALID_MESSAGE',
      message: 'Invalid JSON from Nostr relay',
      boundary: 'nostr-relay',
      cause: err,
    }));
  }
};
```

### Testing Considerations

**Unit tests:**

- Mock WebSocket for `NostrClient`
- Test REQ/CLOSE message formatting
- Test subscription lifecycle
- Test reconnection backoff

**Integration tests (requires Docker):**

- Connect to real Crosstown relay (ws://localhost:4040)
- Publish kind 30078 event
- Verify BLS stub log output
- Test REQ/EOSE flow
- Test rate limiting (send 101 events in 60s)

**Test example:**

```typescript
describe('NostrClient', () => {
  it('should connect to Crosstown relay', async () => {
    const client = new NostrClient('ws://localhost:4040');
    await client.connect();
    expect(client.isConnected()).toBe(true);
  });

  it('should receive EOSE after REQ', async () => {
    const client = new NostrClient('ws://localhost:4040');
    await client.connect();

    const eoseReceived = new Promise((resolve) => {
      client.on('eose', resolve);
    });

    client.subscribe([{ kinds: [1] }], () => {});

    await expect(eoseReceived).resolves.toBeUndefined();
  });
});
```

---

## Testing Strategies

### Manual Testing

**Test 1: Connect to relay**

```bash
# Install websocat
cargo install websocat

# Connect to Crosstown
websocat ws://localhost:4040

# Send REQ (paste and press Enter)
["REQ", "test-1", {"kinds": [1]}]

# Expect EOSE response
["EOSE", "test-1"]
```

**Test 2: Publish event**

```bash
# Generate a signed event (use nostr-tools or nostr-rs-relay)
# Example event (INVALID signature, for structure demo only)
["EVENT", {"id":"abc...","pubkey":"def...","created_at":1673347337,"kind":1,"tags":[],"content":"Hello Crosstown","sig":"123..."}]

# Expect OK response
["OK", "abc...", true, ""]
```

**Test 3: Publish kind 30078**

```bash
# Example ILP packet event (INVALID signature, for structure demo only)
["EVENT", {
  "kind": 30078,
  "content": "{\"reducer\":\"player_move\",\"args\":{\"x\":100,\"z\":200},\"fee\":1}",
  "tags": [["d", "bitcraft-action"], ["game", "bitcraft"], ["reducer", "player_move"]],
  "pubkey": "6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93",
  "created_at": 1673347337,
  "id": "...",
  "sig": "..."
}]

# Check Crosstown logs for BLS stub output
docker compose -f docker/docker-compose.yml logs crosstown-node | grep "BLS STUB"

# Expected log:
# [BLS STUB] Received kind 30078 from 6e468422...: reducer=player_move, args_count=1, fee=1
```

### Automated Testing

**Smoke test (Story 1.3):**

```bash
./docker/tests/smoke-test.sh

# Test 5: Crosstown Nostr relay WebSocket
# Test 12: Crosstown BLS stub logging
```

**Integration test (Story 2.1):**

```typescript
// packages/client/src/__tests__/integration/nostr-relay.test.ts

import { SigilClient } from '../../index';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

describe('Story 2.1: Crosstown Relay Connection', () => {
  let client: SigilClient;

  beforeAll(async () => {
    // Ensure Docker stack is running
    // (checked by CI script)
  });

  beforeEach(() => {
    client = new SigilClient({
      nostrRelay: 'ws://localhost:4040',
    });
  });

  afterEach(async () => {
    await client.disconnect();
  });

  it('AC1: WebSocket connection to Crosstown relay', async () => {
    await client.connect();
    expect(client.nostr.isConnected()).toBe(true);
  });

  it('AC2: Subscribe to events with NIP-01 filters', async () => {
    await client.connect();

    const events: NostrEvent[] = [];
    const sub = client.nostr.subscribe(
      [{ kinds: [30078] }],
      (event) => events.push(event)
    );

    expect(sub.id).toBeTruthy();

    sub.unsubscribe();
  });

  it('AC3: Receive EOSE after REQ', async () => {
    await client.connect();

    const eoseReceived = new Promise((resolve) => {
      client.nostr.once('eose', resolve);
    });

    client.nostr.subscribe([{ kinds: [1] }], () => {});

    await expect(eoseReceived).resolves.toBeUndefined();
  });

  it('AC5: Reconnection with exponential backoff', async () => {
    await client.connect();

    const disconnected = new Promise((resolve) => {
      client.once('connectionChange', (event) => {
        if (event.status === 'disconnected') resolve();
      });
    });

    const reconnected = new Promise((resolve) => {
      client.once('connectionChange', (event) => {
        if (event.status === 'connected') resolve();
      });
    });

    // Force disconnect
    client.nostr.ws.close();

    await disconnected;
    await reconnected;

    expect(client.nostr.isConnected()).toBe(true);
  });
});
```

### Performance Testing

**Story 2.1 NFR requirements:**

- NFR3: Round-trip time <2s under normal load
- NFR19: NIP-01 compliance (standard relay compatibility)

**Load test:**

```typescript
// Test rate limiting (100 events/60s)
it('should enforce rate limiting', async () => {
  await client.connect();

  const events = Array(101).fill(null).map((_, i) => ({
    kind: 1,
    content: `Test event ${i}`,
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
  }));

  let rejectedCount = 0;

  for (const event of events) {
    try {
      await client.nostr.publish(event);
    } catch (err) {
      if (err.message.includes('Rate limit')) {
        rejectedCount++;
      }
    }
  }

  // At least 1 event should be rejected
  expect(rejectedCount).toBeGreaterThan(0);
});
```

---

## References

### External Specifications

- [NIP-01: Basic Protocol Flow](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-78: Application-Specific Data](https://github.com/nostr-protocol/nips/blob/master/78.md)
- [Interledger Protocol V4](https://interledger.org/developers/rfcs/interledger-protocol/)
- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)

### Sigil SDK Documentation

- **Architecture:** `_bmad-output/planning-artifacts/architecture/7-crosstown-integration.md`
- **Data Flow:** `_bmad-output/planning-artifacts/architecture/4-data-flow.md`
- **Epic 2 Stories:** `_bmad-output/planning-artifacts/epics.md#epic-2`
- **Docker Setup:** `docker/README.md`

### Source Code

- **Crosstown Stub:** `docker/crosstown/crosstown-src/src/main.rs`
- **Crosstown Config:** `docker/crosstown/config.toml`
- **Docker Compose:** `docker/docker-compose.yml`
- **Smoke Tests:** `docker/tests/smoke-test.sh`

### Nostr Libraries

**TypeScript:**
- [`nostr-tools`](https://github.com/nbd-wtf/nostr-tools) - Event signing, validation, utilities

**Rust:**
- [`nostr-rust`](https://github.com/rust-nostr/nostr) - Comprehensive Nostr implementation

### Tools

- `websocat` - WebSocket CLI client (cargo install websocat)
- `jq` - JSON processor (brew install jq)
- `spacetime` CLI - SpacetimeDB CLI (curl -fsSL https://install.spacetimedb.com | sh)

---

## Appendix: Complete Message Examples

### REQ → EOSE → EVENT Flow

```
Client → Relay:
["REQ", "sub-1", {"kinds": [30078], "limit": 10}]

Relay → Client:
["EOSE", "sub-1"]

(Later, when new event arrives)

Relay → Client:
["EVENT", "sub-1", {
  "id": "4376c65d2f232afbe9b882a35baa4f6fe8667c4e684749af565f981833ed6a65",
  "pubkey": "6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93",
  "created_at": 1673347337,
  "kind": 30078,
  "tags": [
    ["d", "bitcraft-action"],
    ["game", "bitcraft"],
    ["reducer", "player_move"],
    ["cost", "1"]
  ],
  "content": "{\"reducer\":\"player_move\",\"args\":{\"origin\":{\"x\":100,\"z\":200},\"destination\":{\"x\":110,\"z\":200},\"running\":false},\"fee\":1}",
  "sig": "908a15e46fb4d8675bab026fc230a0e3542bfade63da02d542fb78b2a8513fcd0092619a2c8c1221e581946e0191f2af505dfdf8657a414dbca329186f009262"
}]
```

### EVENT → OK Flow

```
Client → Relay:
["EVENT", {
  "id": "abc123...",
  "pubkey": "def456...",
  "created_at": 1673347337,
  "kind": 1,
  "tags": [],
  "content": "Hello Crosstown",
  "sig": "789abc..."
}]

Relay → Client (success):
["OK", "abc123...", true, ""]

Relay → Client (rate limit):
["NOTICE", "Rate limit exceeded. Max 100 events per 60 seconds."]
["OK", "abc123...", false, "rate-limited: exceeded connection limit"]

Relay → Client (invalid):
["OK", "abc123...", false, "invalid: missing required field 'pubkey'"]
```

---

**End of Document**

**Status:** Ready for Story 2.1 implementation

**Next Steps:**

1. Implement `NostrClient` class in `@sigil/client`
2. Add WebSocket connection to Crosstown relay
3. Implement REQ/CLOSE message handling
4. Add subscription lifecycle management
5. Add reconnection with exponential backoff
6. Write integration tests (requires Docker)
7. Validate against Story 2.1 acceptance criteria

**Questions/Unknowns:**

- Action confirmation event structure (kind TBD) - Will be defined in Story 2.3
- ILP wallet API design - Will be defined in Story 2.2
- Full BLS implementation details - Will be defined in Story 2.5

**Document Version:** 1.0
**Author:** Claude Sonnet 4.5 (PREP-4 research task)
**Date:** 2026-02-27
