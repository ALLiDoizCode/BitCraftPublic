# 7. Crosstown Integration

Sigil uses two Crosstown packages — one client-side, one server-side:

- **`@crosstown/client`** (v0.4.2+) — used by `@sigil/client` for ILP publishing, TOON encoding, and payment channels. This is the **write path** from the agent's perspective.
- **`@crosstown/sdk`** (v0.1.4+) — used by `packages/bitcraft-bls` to build a Crosstown node that receives ILP-routed events, validates signatures, enforces pricing, and dispatches to game action handlers. This is the **server-side BLS**.

Both packages are published on npm. Neither is modified by Sigil — we consume them as dependencies.

**Source:** [github.com/ALLiDoizCode/crosstown](https://github.com/ALLiDoizCode/crosstown) — `packages/client` and `packages/sdk`

## 7.1 CrosstownClient Usage (`@crosstown/client`)

`@sigil/client` uses `@crosstown/client` as a dependency for the write path. The MCP server and TUI backend do **not** depend on `@crosstown/client` directly — they consume it through `@sigil/client`'s `publish()` API, which abstracts all ILP payment, TOON encoding, and channel management.

```typescript
import { CrosstownClient } from '@crosstown/client';
import { encodeEventToToon, decodeEventFromToon } from '@crosstown/relay';

// Each agent gets its own Nostr identity and Crosstown client
// secretKey auto-generates if omitted, or pass existing key
const client = new CrosstownClient({
  connectorUrl: process.env.CONNECTOR_URL || 'http://localhost:8080',
  secretKey, // 32-byte Uint8Array — derives both Nostr pubkey and EVM address
  ilpInfo: {
    pubkey,
    ilpAddress: `g.crosstown.agent.${pubkey.slice(0, 8)}`,
    btpEndpoint: process.env.BTP_ENDPOINT || 'ws://localhost:3000',
  },
  toonEncoder: encodeEventToToon,
  toonDecoder: decodeEventFromToon,
});

await client.start();
// CrosstownStartResult: { peersDiscovered, mode: 'http' | 'embedded' }

// Publish a signed Nostr event via ILP payment
const result = await client.publishEvent(signedEvent);
// PublishEventResult: { success, eventId, fulfillment?, error? }

// Identity accessors (work before start())
client.getPublicKey(); // x-only Schnorr pubkey (64 hex chars)
client.getEvmAddress(); // EIP-55 checksummed 0x address

await client.stop();
```

**Key `CrosstownClient` API surface:**

| Method                                                       | Purpose                                      |
| ------------------------------------------------------------ | -------------------------------------------- |
| `start()` → `CrosstownStartResult`                           | Connect to connector, discover peers         |
| `stop()`                                                     | Graceful shutdown                            |
| `publishEvent(event, options?)` → `PublishEventResult`       | Sign + TOON encode + ILP route a Nostr event |
| `sendPayment(params)` → `IlpSendResult`                      | Raw ILP payment (no Nostr event)             |
| `signBalanceProof(channelId, amount)` → `SignedBalanceProof` | EIP-712 payment channel claim                |
| `getPublicKey()` / `getEvmAddress()`                         | Identity accessors                           |
| `getPeersCount()` / `getDiscoveredPeers()`                   | Network status                               |

### Dependency Chain

```
@sigil/client
  └── @crosstown/client@^0.4.2   (ILP publishing, TOON encoding, payment channels)
       ├── @crosstown/connector   (ILP connector HTTP/BTP client)
       ├── @crosstown/core        (peer discovery, bootstrap)
       ├── nostr-tools            (event signing, key management)
       └── viem                   (EVM payment channel support)

packages/bitcraft-bls
  └── @crosstown/sdk@^0.1.4     (Crosstown node builder, handler dispatch)
       ├── @crosstown/core        (peer discovery, bootstrap)
       ├── @noble/curves          (secp256k1 Schnorr signature verification)
       ├── @noble/hashes          (SHA256 event ID computation)
       ├── @scure/bip32 + bip39   (HD key derivation, mnemonic generation)
       └── nostr-tools            (Nostr event types)

@sigil/mcp-server
  └── @sigil/client              (uses client.publish() — no direct Crosstown dep)

@sigil/tui-backend
  └── @sigil/client              (uses client.publish() — no direct Crosstown dep)
```

### Payment Channel Abstraction

`@crosstown/client` supports EVM-based payment channels for off-chain settlement via `ChannelManager`, `EvmSigner` (EIP-712 balance proofs), and `OnChainChannelClient` (on-chain TokenNetwork interaction via `viem`). **For MVP, payment channel details are fully abstracted inside `@sigil/client`.** Agents and TUI users call `client.publish(action)` — the client handles channel creation, balance proofs, and nonce management internally. No payment channel APIs are exposed to MCP tools or TUI commands.

## 7.2 BLS Game Action Handler (`@crosstown/sdk`)

The BitCraft BLS is a **Crosstown node** built with `@crosstown/sdk`. It lives in `packages/bitcraft-bls` and runs in Docker alongside the BitCraft server. The SDK provides the full ILP packet processing pipeline — signature verification, pricing enforcement, TOON decoding, and handler dispatch. Our code only implements the game-specific handler logic.

### SDK Architecture

`@crosstown/sdk` provides `createNode()` which composes a complete ILP service node:

```
ILP Packet arrives
  → Shallow TOON parse (extract kind, pubkey, routing metadata)
  → createVerificationPipeline: Schnorr signature verification (reject F06 if invalid)
  → createPricingValidator: payment amount ≥ kind price (reject F04 if underpaid)
  → HandlerRegistry.dispatch: route to kind-specific handler
    → Handler receives HandlerContext with decode(), accept(), reject()
```

**The SDK handles all cryptographic and payment validation automatically.** Our handler only needs to parse event content and call SpacetimeDB.

### BLS Node Setup

```typescript
import { createNode, fromSecretKey } from '@crosstown/sdk';

const identity = fromSecretKey(secretKey);

const node = createNode({
  secretKey,
  connector, // Embedded connector (zero-latency)
  ilpAddress: 'g.crosstown.bitcraft',
  kindPricing: {
    30078: 100n, // Game actions: 100 units per event
  },
});

// Register game action handler for kind 30078
node.on(30078, async (ctx) => {
  const event = ctx.decode(); // Lazy TOON decode (cached)
  const { reducer, args } = JSON.parse(event.content);

  // Prepend Nostr pubkey for identity propagation (Option B)
  const reducerArgs = [ctx.pubkey, ...args];

  const response = await fetch(`${SPACETIMEDB_URL}/database/bitcraft/call/${reducer}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SPACETIMEDB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reducerArgs),
  });

  if (!response.ok) {
    return ctx.reject('T00', `Reducer ${reducer} failed: ${response.statusText}`);
  }

  return ctx.accept({ eventId: event.id });
});

await node.start();
// StartResult: { peerCount, channelCount, bootstrapResults }
```

### Handler Context API

The `HandlerContext` provided to each handler:

| Property / Method           | Type                  | Purpose                                                |
| --------------------------- | --------------------- | ------------------------------------------------------ |
| `ctx.kind`                  | `number`              | Event kind (30078 for game actions)                    |
| `ctx.pubkey`                | `string`              | Nostr pubkey (verified by SDK's verification pipeline) |
| `ctx.amount`                | `bigint`              | ILP payment amount                                     |
| `ctx.destination`           | `string`              | ILP destination address                                |
| `ctx.toon`                  | `string`              | Raw TOON data (base64)                                 |
| `ctx.decode()`              | `() → NostrEvent`     | Lazy-decode full Nostr event from TOON (cached)        |
| `ctx.accept(metadata?)`     | `() → AcceptResponse` | Accept the packet (return fulfillment)                 |
| `ctx.reject(code, message)` | `() → RejectResponse` | Reject with ILP error code (F04, F06, T00, etc.)       |

### Deployment Modes

`@crosstown/sdk` supports two modes. The BLS uses **embedded** mode for zero-latency:

| Mode           | Config                           | Latency         | Use Case                                     |
| -------------- | -------------------------------- | --------------- | -------------------------------------------- |
| **Embedded**   | `connector: embeddableConnector` | ~0ms            | BLS co-located with connector (Docker stack) |
| **Standalone** | `connectorUrl + handlerPort`     | HTTP round-trip | Remote BLS connecting to external connector  |

### Identity & Pricing

- **Identity:** `fromSecretKey(secretKey)` or `fromMnemonic(mnemonic)` (NIP-06 derivation path: `m/44'/1237'/0'/0/{accountIndex}`)
- **Pricing:** `kindPricing: { 30078: 100n }` — the SDK's `createPricingValidator` automatically rejects underpaid packets with ILP code `F04`
- **Self-write bypass:** Events from the node's own pubkey skip pricing (SDK default)

### ILP Error Codes

| Code  | Meaning                   | When Used                                   |
| ----- | ------------------------- | ------------------------------------------- |
| `F04` | Insufficient payment      | Payment below `kindPricing` threshold       |
| `F06` | Invalid signature/payload | Schnorr verification failed, malformed TOON |
| `F00` | No handler                | No handler registered for event kind        |
| `T00` | Internal error            | Handler threw, SpacetimeDB call failed      |

### Scope Clarification

- `packages/bitcraft-bls` is a **first-party Sigil package** (pnpm workspace member) that uses `@crosstown/sdk` as a dependency
- The SDK itself is an **external dependency** (published on npm, maintained by the Crosstown project)
- The BLS handler logic (parse content, call SpacetimeDB, propagate identity) is Sigil code
- The pipeline infrastructure (TOON parsing, signature verification, pricing, ILP routing) is SDK code

---
