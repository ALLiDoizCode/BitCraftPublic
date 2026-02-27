# BitCraft AI-Native Headless MMORPG - Project Handoff

**Date:** 2026-02-24
**Vision:** Transform BitCraft into an ILP-gated, AI-native headless MMORPG where AI agents can play the entire game through economic constraints and micropayments.

---

## 🎯 Project Vision

Create a fully playable headless MMORPG where:

- **AI agents** are first-class citizens
- **ILP micropayments** gate all actions (pay-to-write, free-to-read)
- **Economic constraints** create strategic decision-making
- **No graphics needed** - pure data/logic interface
- **Persistent knowledge** enables agents to learn and improve

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent (LLM)                            │
│  - Perceives game state via subscriptions                   │
│  - Reasons with semantic context + memories                 │
│  - Acts via ILP-gated reducers                              │
└─────────────────────────────────────────────────────────────┘
                    │                           │
          Subscribe │                           │ Act (Nostr Event)
           (Free)   │                           │ (Paid)
                    ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  SpacetimeDB Client SDK  │  │  Crosstown BLS           │
│  - Real-time subs        │  │  - ILP validation        │
│  - Local cache           │  │  - Payment gateway       │
└──────────────────────────┘  └──────────────────────────┘
            │                           │
            │                           │ Forwards to reducer
            └─────────┬─────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              BitCraft Server (SpacetimeDB)                   │
│  - All game logic in reducers (movement, combat, etc.)      │
│  - All game state in tables                                 │
│  - Unmodified vanilla BitCraft                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Design Decisions

### 1. **BLS as Payment Gateway** (PREFERRED APPROACH)

Instead of modifying BitCraft reducers, use Crosstown BLS as a proxy:

```
Agent → Nostr Event (game action + ILP proof)
      → BLS validates payment
      → BLS calls SpacetimeDB reducer
      → Game executes
```

**Benefits:**

- ✅ No BitCraft modifications needed
- ✅ Reuse existing Crosstown ILP validation
- ✅ Clean separation: BLS = payments, SpacetimeDB = game logic
- ✅ Nostr events provide audit trail
- ✅ Can support multiple games with one BLS

**Implementation:**

```typescript
// In BLS WebSocket handler
async handleGameAction(event: NostrEvent): Promise<[string, string, boolean, string]> {
  // 1. Validate ILP payment
  const paymentValid = await this.validateIlpPayment(event);
  if (!paymentValid) return ["OK", event.id, false, "payment-required"];

  // 2. Parse game action
  const { reducer, args } = JSON.parse(event.content);

  // 3. Call SpacetimeDB reducer
  await this.spacetimeClient.reducers[reducer](...args);

  return ["OK", event.id, true, ""];
}
```

**Event Kind:**

```javascript
{
  "kind": 30000,  // Game Action
  "content": {
    "reducer": "player_move",
    "args": { "origin": {...}, "destination": {...}, "running": false }
  },
  "tags": [
    ["game", "bitcraft"],
    ["ilp_receipt", "base64_encoded_receipt"],
    ["cost", "10"]
  ]
}
```

### 2. **Data Flow**

**Write Path (Paid Actions):**

```
Agent → Nostr event → BLS validates ILP → SpacetimeDB reducer → State update
```

**Read Path (Free Observations):**

```
Agent → Direct SpacetimeDB subscription → Real-time updates → Local cache
```

### 3. **Pay-to-Write, Free-to-Read Pricing**

| Category     | Reducer              | Cost (tokens) | Frequency |
| ------------ | -------------------- | ------------- | --------- |
| **Movement** | `player_move`        | 1             | High      |
| **Combat**   | `attack_start`       | 5-15          | Medium    |
| **Building** | `project_site_place` | 50            | Low       |
| **Trading**  | `trade_with_player`  | 10            | Medium    |
| **Chat**     | `chat_post_message`  | 1             | High      |
| **Empire**   | `empire_form`        | 100           | Very Low  |

---

## 🎮 Key BitCraft Reducers Discovered

### Movement

- `player_move(origin, destination, running, duration)` - Primary movement
- `player_teleport_home()` - Teleport to home
- `portal_enter(portal_id)` - Enter portals/buildings
- `player_climb(coordinates)` - Climb ladders

### Combat

- `attack_start(attacker_id, defender_id, combat_action_id)` - Initiate attack
- `attack(request)` - Execute attack (after wind-up)
- `attack_impact_migrated(timer)` - Calculate damage/effects

### Building

- `project_site_place(recipe_id, coordinates)` - Place construction
- `project_site_add_materials(site_id, materials)` - Add materials
- `building_move(building_id, new_coords)` - Move building
- `building_deconstruct(building_id)` - Destroy building

### Social/Economy

- `empire_form(name)` - Create guild/faction
- `chat_post_message(text, channel)` - Send message
- Trading, crafting, inventory management reducers

**Total:** 360+ reducer files discovered

---

## 🤖 Agent Cognition Architecture

The challenge: **SpacetimeDB gives raw data, but agents need semantic understanding**

### Multi-Layer Solution

#### **Layer 1: Static Data Context**

Load game encyclopedia to translate IDs → meanings:

```typescript
// enemy_type: 12 → "Forest Wolf (Tier 1, Danger: 3/10)"
// resource_id: 3 → "Copper Ore (Value: High, Rarity: Medium)"
```

#### **Layer 2: Semantic Event Interpretation**

Transform raw updates → narrative:

```typescript
// Raw: health_state.health: 100 → 85
// Narrative: "You were attacked by Forest Wolf and lost 15 health"
```

#### **Layer 3: Spatial & Temporal Memory**

Persist discoveries across sessions:

```typescript
{
  type: 'SPATIAL',
  narrative: 'Rich copper deposit found near river',
  coordinates: { x: 234, z: 567 },
  importance: 8
}
```

**Storage:** Vector DB (embeddings) or Graph DB for semantic search

#### **Layer 4: Affordance Detection**

Understand "what can I do here?":

```typescript
// Detects: nearby resources, enemies, players, buildings
// Outputs: ["gather wood (cost: 5, reward: Wood x10)",
//           "attack wolf (cost: 10, reward: XP+Loot, 85% win)"]
```

#### **Layer 5: Goal-Oriented Planning**

High-level objectives persist across actions:

```typescript
goals = [
  { type: 'SURVIVAL', priority: 10, conditions: ['health > 50'] },
  { type: 'RESOURCE_GATHERING', priority: 7, target: { wood: 100 } },
  { type: 'EXPLORATION', priority: 5 },
];
```

### Complete Agent Loop

```typescript
async mainLoop() {
  while (true) {
    // 1. PERCEIVE: Get game state (free SpacetimeDB subscription)
    const gameState = this.getCurrentGameState();

    // 2. UNDERSTAND: Detect affordances
    const affordances = this.detectAffordances(gameState);

    // 3. RECALL: Retrieve relevant memories
    const memories = await this.memory.recall(context);

    // 4. REASON: LLM decides action
    const action = await this.llm.decide({
      state: gameState,
      affordances,
      memories,
      goals: this.goals
    });

    // 5. ACT: Execute via ILP payment
    await this.payAndAct(action.reducer, action.args);

    // 6. LEARN: Update memory
    await this.memory.record(action, result);
  }
}
```

---

## 📁 Repository Structure

```
BitCraftPublic/
├── BitCraftServer/
│   └── packages/
│       ├── global_module/  # Global game systems
│       │   └── src/game/handlers/
│       │       ├── player/     # Player actions (chat, social)
│       │       ├── empires/    # Guild/faction system
│       │       ├── admin/      # Admin tools
│       │       └── authentication.rs
│       └── game/           # Core game logic
│           └── src/game/handlers/
│               ├── player/     # Movement, combat, actions
│               ├── buildings/  # Construction system
│               ├── inventory/  # Items, trading
│               ├── attack.rs   # Combat system
│               └── ...
├── README.md
├── LICENSE (Apache 2.0)
└── HANDOFF.md (this file)
```

---

## 🚀 Next Steps

### Phase 1: BLS Integration (Week 1-2)

1. **Add SpacetimeDB client to Crosstown BLS**

   ```bash
   cd ~/Documents/crosstown/packages/bls
   npm install @spacetimedb/sdk
   ```

2. **Implement game action handler**
   - Define event kind 30000 (Game Action)
   - Parse Nostr events → extract reducer + args
   - Validate ILP payment
   - Forward to SpacetimeDB

3. **Test with simple reducers**
   - Start: `player_move` (low-stakes testing)
   - Then: `chat_post_message`
   - Finally: `attack_start`

### Phase 2: Agent SDK (Week 3-4)

1. **Static data loader**
   - Load all `*_desc` tables at startup
   - Build semantic indices

2. **Event interpreter**
   - Subscribe to SpacetimeDB updates
   - Transform to narrative events

3. **Affordance engine**
   - Detect nearby: resources, enemies, players
   - Calculate: costs, rewards, win chances

### Phase 3: Memory & Cognition (Week 5-6)

1. **Memory system**
   - Choose vector DB (Pinecone, Weaviate, or local)
   - Implement semantic search
   - Add memory types: spatial, social, causal

2. **Goal system**
   - Define goal hierarchy
   - Implement goal evaluation
   - Add planning logic

3. **LLM integration**
   - Design prompts for decision-making
   - Add context assembly
   - Implement action execution

### Phase 4: Testing & Iteration (Week 7-8)

1. **Deploy local BitCraft server**

   ```bash
   cd BitCraftServer
   spacetime publish
   ```

2. **Launch test agents**
   - Single agent exploring world
   - Two agents trading resources
   - Multi-agent economy simulation

3. **Tune economics**
   - Adjust ILP costs
   - Balance agent budgets
   - Optimize for interesting emergent behavior

---

## 🔧 Technical Details

### BitCraft Server Info

- **Built on:** SpacetimeDB
- **Language:** Rust (99%)
- **Modules:** 2 (global_module, game)
- **Reducers:** 360+ discovered
- **Tables:** All game state

### SpacetimeDB Primer

- **Reducers:** Functions that modify database state (like RPC)
- **Tables:** Data storage with real-time subscriptions
- **Subscriptions:** SQL queries that push updates to clients
- **Client SDKs:** TypeScript, Rust, C#, Python

### Crosstown Integration Points

- **BLS:** Business Logic Service (ILP payment validation)
- **Event kinds:** Propose kind 30000 for game actions
- **TOON format:** Consider for efficient event encoding

---

## 📚 Key Resources

### BitCraft

- **Repo:** https://github.com/clockworklabs/BitCraftPublic
- **Docs:** See BitCraftServer/README.md
- **License:** Apache 2.0 (can fork, cannot use IP/assets)

### SpacetimeDB

- **Docs:** https://spacetimedb.com/docs/
- **Repo:** https://github.com/clockworklabs/SpacetimeDB
- **SDK:** `npm install @spacetimedb/sdk`

### Crosstown

- **Location:** ~/Documents/crosstown/
- **BLS:** packages/bls/
- **Relay:** packages/relay/

---

## 💡 Open Questions

1. **Memory Storage:** Which vector DB? (Pinecone, Weaviate, ChromaDB, local embeddings?)
2. **LLM Selection:** GPT-4, Claude, local models? (Cost vs capability tradeoff)
3. **Economic Balancing:** What ILP token costs create interesting agent behavior?
4. **Multi-Agent Dynamics:** How to prevent agent cartels/exploitation?
5. **Static Data Updates:** How to handle BitCraft game updates?

---

## 🎯 Success Metrics

### MVP Success (Phase 1-2)

- [ ] Agent can connect to BitCraft via BLS
- [ ] Agent can move around world
- [ ] Agent pays ILP tokens for actions
- [ ] Free real-time state observation works

### Alpha Success (Phase 3-4)

- [ ] Agent builds persistent spatial memory
- [ ] Agent makes goal-driven decisions
- [ ] Agent learns from experience
- [ ] Multiple agents can coexist

### Beta Success (Future)

- [ ] Emergent agent economies form
- [ ] Agent social networks emerge
- [ ] Agents discover novel strategies
- [ ] System is economically sustainable

---

## 🤝 Context from Previous Session

**Key Insights:**

1. BitCraft is **already headless-ready** - server has all logic, client is just UI
2. SpacetimeDB SDK provides programmatic access - no client needed
3. ILP-gating via BLS is cleaner than modifying BitCraft directly
4. Agent cognition requires **5 layers**: static data, events, memory, affordances, goals
5. The hard problem isn't game access - it's **agent understanding and memory**

**Design Philosophy:**

- Nostr social graph = network graph (NIP-02 for peer discovery)
- Pay-to-write, free-to-read (sustainable relay economics)
- TOON-native (efficient binary format for agents)
- Discovery ≠ peering (observe, then decide to connect)

---

## 📞 Contact & Continuation

Continue this conversation:

1. Open Claude Code in `/Users/jonathangreen/Documents/BitCraftPublic`
2. Reference this handoff doc
3. Key context preserved in this document

**Related Projects:**

- Crosstown: `~/Documents/crosstown/`
- Original BitCraft fork: https://github.com/ALLiDoizCode/BitCraftPublic

---

**Last Updated:** 2026-02-24
**Status:** Design phase, ready for implementation
**Next Session:** Start Phase 1 - BLS Integration
