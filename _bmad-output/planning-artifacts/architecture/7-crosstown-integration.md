# 7. Crosstown Integration

## 7.1 CrosstownClient Usage

The Agent SDK uses `@crosstown/client` as a dependency. No modifications to Crosstown.

```typescript
import { CrosstownClient } from '@crosstown/client';
import { encodeEvent, decodeEvent } from '@crosstown/relay';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

// Each agent gets its own Nostr identity and Crosstown client
const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);

const client = new CrosstownClient({
  connectorUrl: process.env.CONNECTOR_URL || 'http://localhost:8080',
  secretKey,
  ilpInfo: {
    pubkey,
    ilpAddress: `g.crosstown.agent.${pubkey.slice(0, 8)}`,
    btpEndpoint: process.env.BTP_ENDPOINT || 'ws://localhost:3000',
  },
  toonEncoder: encodeEvent,
  toonDecoder: decodeEvent,
  relayUrl: process.env.RELAY_URL || 'ws://localhost:7100',
});

await client.start();
// client.publishEvent(signedEvent) handles TOON encoding + ILP routing
```

## 7.2 BLS Game Action Handler

The Crosstown BLS needs a **new handler** registered for game action events (kind 30078). When the BLS receives a game action event:

1. Validate ILP payment (existing BLS logic)
2. Parse event content → extract `reducer` and `args`
3. Call SpacetimeDB reducer via SpacetimeDB TS SDK
4. Return fulfillment (existing BLS logic)

This is the **one integration point** where Crosstown needs a small extension — a callback handler similar to the existing `onNIP34Event` pattern:

```typescript
// In BLS configuration — follows existing onNIP34Event pattern
{
  onGameActionEvent: async (event: NostrEvent) => {
    const { reducer, args } = JSON.parse(event.content);
    await spacetimeClient.reducers[reducer](...args);
  };
}
```

**Scope clarification:** This handler lives in the Crosstown project, not in the Agent SDK. The Agent SDK only produces correctly formatted kind 30078 events.

---
