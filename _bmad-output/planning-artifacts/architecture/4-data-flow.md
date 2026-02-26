# 4. Data Flow

## 4.1 Write Path (Paid Actions)

```
Agent decides action
  → Build Nostr event (kind 30078, content = {reducer, args})
  → Sign event with agent's Nostr keypair
  → CrosstownClient.publishEvent(signedEvent)
    → TOON encode → ILP packet → Connector → BLS
      → BLS validates ILP payment
      → BLS decodes TOON → Nostr event
      → BLS calls SpacetimeDB reducer (new: game action handler)
      → BLS returns fulfillment
  → Agent receives confirmation
```

**Event Kind:** `30078` (Parameterized Replaceable — Application-specific Data, per NIP-78)

```json
{
  "kind": 30078,
  "content": "{\"reducer\":\"player_move\",\"args\":{\"origin\":{\"x\":100,\"z\":200},\"destination\":{\"x\":110,\"z\":200},\"running\":false}}",
  "tags": [
    ["d", "bitcraft-action"],
    ["game", "bitcraft"],
    ["reducer", "player_move"],
    ["cost", "10"]
  ]
}
```

**Why kind 30078?** NIP-78 defines application-specific data events. This avoids collision with existing Nostr event kinds and follows the spec for structured application data. The BLS `PricingService` already supports kind-based pricing, so we register kind 30078 with game-action-specific pricing.

## 4.2 Read Path (Free Observations)

```
Agent subscribes via SpacetimeDB TS SDK
  → SQL subscription: "SELECT * FROM player WHERE ..."
  → Real-time callbacks on table changes
  → Agent's EventInterpreter transforms raw data → semantic narrative
  → Agent's AffordanceEngine detects available actions
  → Agent's GoalPlanner decides next action
```

**No cost.** SpacetimeDB subscriptions are direct WebSocket connections to the game server. Crosstown is not involved in the read path.

## 4.3 Sequence Diagram

```
┌─────┐     ┌──────────┐     ┌───────────┐     ┌─────┐     ┌───────────┐
│Agent│     │Crosstown  │     │Crosstown  │     │ BLS │     │ BitCraft  │
│ SDK │     │  Client   │     │ Connector │     │     │     │  Server   │
└──┬──┘     └────┬─────┘     └─────┬─────┘     └──┬──┘     └─────┬─────┘
   │              │                 │               │              │
   │ publishEvent │                 │               │              │
   │─────────────>│                 │               │              │
   │              │  sendIlpPacket  │               │              │
   │              │────────────────>│               │              │
   │              │                 │ handlePacket  │              │
   │              │                 │──────────────>│              │
   │              │                 │               │ call reducer │
   │              │                 │               │─────────────>│
   │              │                 │               │   result     │
   │              │                 │               │<─────────────│
   │              │                 │  fulfillment  │              │
   │              │                 │<──────────────│              │
   │              │   fulfillment   │               │              │
   │              │<────────────────│               │              │
   │  result      │                 │               │              │
   │<─────────────│                 │               │              │
   │              │                 │               │              │
   │ subscribe(SQL query)           │               │              │
   │──────────────────────────────────────────────────────────────>│
   │              │                 │               │   updates    │
   │<──────────────────────────────────────────────────────────────│
```

---
