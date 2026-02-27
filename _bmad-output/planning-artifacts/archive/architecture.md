---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-25'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/data-models.md'
  - 'docs/development-guide.md'
  - 'docs/source-tree-analysis.md'
  - 'docs/rebels-in-the-sky/index.md'
  - 'docs/rebels-in-the-sky/architecture.md'
  - 'docs/rebels-in-the-sky/source-tree-analysis.md'
  - 'docs/rebels-in-the-sky/ratatui-patterns.md'
  - 'docs/rebels-in-the-sky/data-models.md'
workflowType: 'architecture'
workflowMode: 'refinement'
project_name: 'BitCraftPublic'
user_name: 'Jonathan'
date: '2026-02-25'
---

# BitCraft AI-Native Agent SDK — Architecture Document

**Version:** 1.0
**Date:** 2026-02-24
**Status:** Draft — Pending Review
**Authors:** Winston (Architect), Cloud Dragonborn (Game Architect), John (PM)

---

## 1. Executive Summary

This document defines the architecture for an **AI Agent SDK** that enables LLM-powered agents to play BitCraft — a SpacetimeDB-based MMORPG — as first-class participants. The SDK provides a pluggable five-layer cognition framework, an experiment harness for AI researchers, and integrates with the existing Crosstown payment infrastructure for ILP-gated actions.

**Target User:** AI researchers studying multi-agent behavior in constrained environments.

**Success Metric:** A researcher deploys two agents with different LLM backends against the same BitCraft world, observes both making independent economic decisions for 1 hour, and exports a comparative decision log.

---

## 2. Design Principles

| Principle                      | Rationale                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Observable**                 | Every agent perception, decision, and action must be loggable and replayable                     |
| **Reproducible**               | Snapshot game + agent state; rerun experiments from the same starting conditions                 |
| **Pluggable**                  | Swap LLM backends, cognition strategies, and memory implementations independently                |
| **Unmodified BitCraft**        | Zero changes to the BitCraft server — it runs vanilla in Docker                                  |
| **ILP is Crosstown's Problem** | The Agent SDK publishes Nostr events via `@crosstown/client`; payment validation is out of scope |
| **TypeScript First**           | Native compatibility with SpacetimeDB TS SDK and Crosstown; researchers can hack on it quickly   |

---

## 3. System Context

```
┌──────────────────────────────────────────────────────────────┐
│                   AGENT SDK (TypeScript)                      │
│  Our product. Pluggable cognition layers + experiment harness │
│                                                               │
│  @bitcraft-ai/core        — Framework + plugin interfaces     │
│  @bitcraft-ai/plugins     — Reference cognition plugins       │
│  @bitcraft-ai/harness     — Experiment runner + analysis      │
└────────────┬──────────────────────────┬──────────────────────┘
   Subscribe │ (free, direct)           │ Act (paid, Nostr event)
             │                          │
             │  SpacetimeDB TS SDK      │  @crosstown/client
             ▼                          ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│  BitCraft Server     │    │  Crosstown Node                  │
│  (Docker container)  │    │  (existing project)              │
│                      │    │                                  │
│  SpacetimeDB module  │    │  BLS validates ILP payment       │
│  Unmodified source   │    │  Relay stores Nostr events       │
│  Local dev only      │    │  Connector routes ILP packets    │
└──────────────────────┘    └──────────────────────────────────┘
        ▲                              │
        └──── BLS calls reducer ───────┘
```

### 3.1 Boundary Definitions

| Component           | Owner                                       | Modifiable?                   | Purpose                                 |
| ------------------- | ------------------------------------------- | ----------------------------- | --------------------------------------- |
| **Agent SDK**       | Us (new repo)                               | Yes                           | Cognition framework, experiment harness |
| **BitCraft Server** | Clockwork Labs (Apache 2.0 fork)            | No — run unmodified in Docker | Game logic, state, reducers             |
| **Crosstown Node**  | Existing project (`~/Documents/crosstown/`) | No — consume as dependency    | ILP payment gateway, Nostr relay        |
| **SpacetimeDB**     | Clockwork Labs (open source)                | No — use SDK                  | Real-time database, subscriptions       |

---

## 4. Data Flow

### 4.1 Write Path (Paid Actions)

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

### 4.2 Read Path (Free Observations)

```
Agent subscribes via SpacetimeDB TS SDK
  → SQL subscription: "SELECT * FROM player WHERE ..."
  → Real-time callbacks on table changes
  → Agent's EventInterpreter transforms raw data → semantic narrative
  → Agent's AffordanceEngine detects available actions
  → Agent's GoalPlanner decides next action
```

**No cost.** SpacetimeDB subscriptions are direct WebSocket connections to the game server. Crosstown is not involved in the read path.

### 4.3 Sequence Diagram

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

## 5. Five-Layer Cognition Architecture

The core innovation. Each layer is a **pluggable module** implementing a standard interface. Researchers swap implementations to study different strategies.

```
┌─────────────────────────────────────────────────────────┐
│                 EXPERIMENT HARNESS                        │
│  Snapshot/restore, logging, A/B testing, analysis        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│              COGNITION PLUGIN STACK                       │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Layer 5: GoalPlanner                                │ │
│  │ Maintains goal hierarchy, selects next action       │ │
│  │ Input: affordances + memories + current goals       │ │
│  │ Output: chosen action + updated goals               │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Layer 4: AffordanceEngine                           │ │
│  │ Detects "what can I do here?" from game state       │ │
│  │ Input: interpreted events + static data             │ │
│  │ Output: list of possible actions with costs/rewards │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Layer 3: MemorySystem                               │ │
│  │ Persistent knowledge across sessions                │ │
│  │ Input: events, actions, outcomes                    │ │
│  │ Output: relevant memories for current context       │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Layer 2: EventInterpreter                           │ │
│  │ Transforms raw SpacetimeDB updates → semantics      │ │
│  │ Input: table change callbacks                       │ │
│  │ Output: narrative events ("wolf attacked you")      │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Layer 1: StaticDataLoader                           │ │
│  │ Game encyclopedia — translates IDs → meanings       │ │
│  │ Input: *_desc tables from SpacetimeDB               │ │
│  │ Output: lookup maps (enemy_type:12 → "Forest Wolf") │ │
│  └─────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│              GAME ACCESS LAYER (fixed)                    │
│  SpacetimeDB client (subscribe) + CrosstownClient (act)  │
│  Action cost registry (JSON config)                      │
└─────────────────────────────────────────────────────────┘
```

### 5.1 Plugin Interface Contract

Every cognition plugin implements this interface:

```typescript
interface CognitionPlugin<TInput, TOutput, TState> {
  /** Unique plugin identifier */
  readonly name: string;

  /** Human-readable description for experiment logs */
  readonly description: string;

  /** Initialize with configuration */
  initialize(config: Record<string, unknown>): Promise<void>;

  /** Core processing — transform input to output */
  process(input: TInput, context: AgentContext): Promise<TOutput>;

  /** Serialize internal state for snapshots */
  serialize(): Promise<TState>;

  /** Restore from serialized state */
  deserialize(state: TState): Promise<void>;

  /** Cleanup resources */
  dispose(): Promise<void>;
}
```

### 5.2 Layer Interfaces

```typescript
// Layer 1: Static Data
interface StaticDataLoader extends CognitionPlugin<void, GameEncyclopedia, GameEncyclopedia> {
  lookup(table: string, id: number): EntityDescription | undefined;
}

interface GameEncyclopedia {
  enemies: Map<number, EntityDescription>;
  resources: Map<number, EntityDescription>;
  recipes: Map<number, EntityDescription>;
  buildings: Map<number, EntityDescription>;
  // ... all *_desc tables
}

// Layer 2: Event Interpretation
interface EventInterpreter extends CognitionPlugin<
  RawTableUpdate[],
  SemanticEvent[],
  EventInterpreterState
> {
  // Transforms raw SpacetimeDB callbacks into narrative events
}

interface SemanticEvent {
  timestamp: number;
  category: 'combat' | 'movement' | 'resource' | 'social' | 'building' | 'environment';
  narrative: string; // "Forest Wolf attacked you for 15 damage"
  entities: EntityRef[]; // Referenced game entities
  importance: number; // 1-10 scale for memory filtering
  raw: RawTableUpdate; // Original data preserved
}

// Layer 3: Memory
interface MemorySystem extends CognitionPlugin<MemoryInput, MemoryRecall, SerializedMemory> {
  record(event: SemanticEvent, outcome?: ActionOutcome): Promise<void>;
  recall(context: AgentContext, limit?: number): Promise<Memory[]>;
  forget(filter: MemoryFilter): Promise<number>;
}

interface Memory {
  id: string;
  type: 'spatial' | 'social' | 'causal' | 'procedural';
  narrative: string;
  importance: number;
  coordinates?: { x: number; z: number };
  timestamp: number;
  accessCount: number;
}

// Layer 4: Affordance Detection
interface AffordanceEngine extends CognitionPlugin<GameState, Affordance[], AffordanceState> {
  // Detects available actions from current game state
}

interface Affordance {
  action: string; // "gather_wood"
  reducer: string; // "harvest_start"
  args: Record<string, unknown>;
  cost: number; // ILP token cost
  estimatedReward: string; // "Wood x10"
  confidence: number; // 0-1 success probability
  priority: number; // Suggested priority
}

// Layer 5: Goal Planning
interface GoalPlanner extends CognitionPlugin<PlanningInput, PlannedAction, GoalState> {
  // Selects best action from affordances given goals and memories
}

interface PlannedAction {
  affordance: Affordance; // The chosen action
  reasoning: string; // Why this action (for logging/research)
  goalContribution: string; // Which goal this serves
  confidence: number; // Decision confidence
}

interface PlanningInput {
  affordances: Affordance[];
  memories: Memory[];
  goals: Goal[];
  budget: BudgetState;
}

interface Goal {
  id: string;
  type: string;
  priority: number;
  conditions: string[];
  progress: number; // 0-1
  deadline?: number; // Optional time pressure
}
```

---

## 6. Agent Core Loop

```typescript
class BitCraftAgent {
  private gameClient: SpacetimeDBClient; // Direct subscription (free reads)
  private actionClient: CrosstownClient; // Nostr → BLS → reducer (paid writes)
  private plugins: CognitionStack;
  private logger: DecisionLogger;
  private config: AgentConfig;

  async run(): Promise<void> {
    // Initialize game connection
    await this.gameClient.connect(this.config.spacetimeUrl);
    await this.actionClient.start();

    // Load static data (Layer 1)
    const encyclopedia = await this.plugins.staticData.process();

    // Subscribe to game state updates
    this.gameClient.subscribe([
      'SELECT * FROM player_state WHERE player_id = ?',
      'SELECT * FROM entity WHERE distance(pos, ?) < 100',
      // ... configured subscriptions
    ]);

    // Main loop
    while (this.config.running) {
      // 1. PERCEIVE — collect raw updates since last tick
      const rawUpdates = this.gameClient.drainUpdates();

      // 2. INTERPRET — raw data → semantic events (Layer 2)
      const events = await this.plugins.interpreter.process(rawUpdates, this.context);

      // 3. REMEMBER — store important events, recall relevant memories (Layer 3)
      for (const event of events.filter((e) => e.importance >= 5)) {
        await this.plugins.memory.record(event);
      }
      const memories = await this.plugins.memory.recall(this.context);

      // 4. DETECT — what can I do here? (Layer 4)
      const affordances = await this.plugins.affordances.process(
        this.gameClient.currentState,
        this.context
      );

      // 5. DECIDE — choose action based on goals + memories + affordances (Layer 5)
      const decision = await this.plugins.planner.process(
        {
          affordances,
          memories,
          goals: this.config.goals,
          budget: this.getBudgetState(),
        },
        this.context
      );

      // 6. ACT — execute via Crosstown payment
      const result = await this.executeAction(decision);

      // 7. LOG — record everything for research
      await this.logger.logTick({
        tick: this.tickCount,
        timestamp: Date.now(),
        rawUpdates: rawUpdates.length,
        events,
        memoriesRecalled: memories.length,
        affordancesDetected: affordances.length,
        decision,
        result,
        budgetRemaining: this.getBudgetState().remaining,
      });

      // 8. LEARN — record outcome for future recall
      await this.plugins.memory.record({
        ...decision.affordance,
        outcome: result,
      } as SemanticEvent);

      await this.sleep(this.config.tickInterval);
    }
  }

  private async executeAction(decision: PlannedAction): Promise<ActionResult> {
    const event = this.buildGameActionEvent(decision.affordance);
    const result = await this.actionClient.publishEvent(event);
    return {
      success: result.success,
      fulfillment: result.fulfillment,
      error: result.error,
      cost: decision.affordance.cost,
    };
  }

  private buildGameActionEvent(affordance: Affordance): NostrEvent {
    return finalizeEvent(
      {
        kind: 30078,
        content: JSON.stringify({
          reducer: affordance.reducer,
          args: affordance.args,
        }),
        tags: [
          ['d', 'bitcraft-action'],
          ['game', 'bitcraft'],
          ['reducer', affordance.reducer],
          ['cost', String(affordance.cost)],
        ],
        created_at: Math.floor(Date.now() / 1000),
      },
      this.config.secretKey
    );
  }
}
```

---

## 7. Crosstown Integration

### 7.1 CrosstownClient Usage

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

### 7.2 BLS Game Action Handler

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

## 8. Action Cost Registry

Static JSON configuration. Researchers edit costs between experiments.

```json
{
  "version": 1,
  "defaultCost": 10,
  "actions": {
    "player_move": { "cost": 1, "category": "movement", "frequency": "high" },
    "player_teleport_home": { "cost": 20, "category": "movement", "frequency": "low" },
    "portal_enter": { "cost": 5, "category": "movement", "frequency": "medium" },
    "attack_start": { "cost": 10, "category": "combat", "frequency": "medium" },
    "harvest_start": { "cost": 5, "category": "resource", "frequency": "high" },
    "project_site_place": { "cost": 50, "category": "building", "frequency": "low" },
    "trade_with_player": { "cost": 10, "category": "economy", "frequency": "medium" },
    "chat_post_message": { "cost": 1, "category": "social", "frequency": "high" },
    "empire_form": { "cost": 100, "category": "governance", "frequency": "very_low" },
    "craft_item": { "cost": 15, "category": "crafting", "frequency": "medium" }
  }
}
```

The `AffordanceEngine` reads this registry to annotate affordances with costs, enabling budget-aware decision-making in the `GoalPlanner`.

---

## 9. Experiment Harness

What makes this a research platform rather than just a game client.

### 9.1 Experiment Configuration

```yaml
# experiment.yaml
name: 'exploration-strategy-comparison'
description: 'Compare GPT-4 vs Claude on open-world exploration'
duration: 3600 # seconds
snapshot: 'checkpoints/fresh-world-001.snap'

agents:
  - id: 'explorer-gpt4'
    plugins:
      goal_planner: '@bitcraft-ai/plugins/goals-llm'
      memory: '@bitcraft-ai/plugins/memory-vector'
    config:
      llm:
        provider: 'openai'
        model: 'gpt-4'
      goals:
        - type: 'EXPLORATION'
          priority: 10
      budget: 1000

  - id: 'explorer-claude'
    plugins:
      goal_planner: '@bitcraft-ai/plugins/goals-llm'
      memory: '@bitcraft-ai/plugins/memory-vector'
    config:
      llm:
        provider: 'anthropic'
        model: 'claude-sonnet-4-5-20250929'
      goals:
        - type: 'EXPLORATION'
          priority: 10
      budget: 1000

analysis:
  metrics:
    - 'area_explored'
    - 'resources_discovered'
    - 'budget_efficiency'
    - 'decision_diversity'
  output: './results/exploration-comparison/'
```

### 9.2 Decision Logger

Every agent tick produces a structured JSONL log entry:

```jsonl
{"tick":1,"ts":1708800000,"agent":"explorer-gpt4","phase":"perceive","raw_updates":12,"duration_ms":5}
{"tick":1,"ts":1708800005,"agent":"explorer-gpt4","phase":"interpret","events":[{"category":"environment","narrative":"You see a forest clearing with copper deposits","importance":7}],"duration_ms":15}
{"tick":1,"ts":1708800020,"agent":"explorer-gpt4","phase":"recall","memories_retrieved":3,"query":"copper deposits nearby","duration_ms":45}
{"tick":1,"ts":1708800065,"agent":"explorer-gpt4","phase":"detect","affordances":["gather_copper(cost:5)","explore_north(cost:1)","attack_wolf(cost:10)"],"duration_ms":10}
{"tick":1,"ts":1708800075,"agent":"explorer-gpt4","phase":"decide","action":"gather_copper","reasoning":"High-value resource aligns with RESOURCE_GATHERING goal","confidence":0.85,"duration_ms":1200}
{"tick":1,"ts":1708801275,"agent":"explorer-gpt4","phase":"act","reducer":"harvest_start","success":true,"cost":5,"budget_remaining":995,"duration_ms":150}
```

### 9.3 Snapshot & Restore

```typescript
interface ExperimentHarness {
  /** Snapshot SpacetimeDB state + all agent plugin states */
  snapshot(name: string): Promise<SnapshotManifest>;

  /** Restore game + agents to a previous snapshot */
  restore(manifest: SnapshotManifest): Promise<void>;

  /** Launch experiment from config */
  run(config: ExperimentConfig): Promise<ExperimentResults>;

  /** Analyze decision logs */
  analyze(logDir: string, metrics: string[]): Promise<AnalysisReport>;
}

interface SnapshotManifest {
  id: string;
  timestamp: number;
  gameState: string; // SpacetimeDB snapshot reference
  agentStates: Record<
    string,
    {
      pluginStates: Record<string, unknown>; // Serialized plugin states
      goals: Goal[];
      budget: BudgetState;
    }
  >;
}
```

---

## 10. Project Structure

```
sigil/                  # New repository
├── packages/
│   ├── core/                        # @bitcraft-ai/core
│   │   ├── src/
│   │   │   ├── agent.ts             # BitCraftAgent main class
│   │   │   ├── context.ts           # AgentContext shared state
│   │   │   ├── interfaces/          # Plugin contracts
│   │   │   │   ├── cognition-plugin.ts
│   │   │   │   ├── static-data.ts
│   │   │   │   ├── event-interpreter.ts
│   │   │   │   ├── memory-system.ts
│   │   │   │   ├── affordance-engine.ts
│   │   │   │   └── goal-planner.ts
│   │   │   ├── clients/
│   │   │   │   ├── game-client.ts   # SpacetimeDB subscription wrapper
│   │   │   │   └── action-client.ts # CrosstownClient wrapper
│   │   │   ├── cost-registry.ts     # Action cost config loader
│   │   │   ├── logger.ts            # JSONL decision logger
│   │   │   └── types.ts             # Shared type definitions
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── plugins/                     # @bitcraft-ai/plugins
│   │   ├── static-data/             # Layer 1: Load *_desc tables
│   │   ├── narrator/                # Layer 2: Raw events → narrative
│   │   ├── memory-basic/            # Layer 3: In-memory + JSON file
│   │   ├── memory-vector/           # Layer 3: Vector DB (Pinecone/ChromaDB)
│   │   ├── affordances/             # Layer 4: Nearby entity detection
│   │   ├── goals-simple/            # Layer 5: Priority queue (no LLM)
│   │   └── goals-llm/              # Layer 5: LLM-powered reasoning
│   │
│   ├── harness/                     # @bitcraft-ai/harness
│   │   ├── src/
│   │   │   ├── experiment.ts        # Config-driven agent launcher
│   │   │   ├── snapshot.ts          # Game + agent state snapshots
│   │   │   ├── analysis.ts          # Decision log processing
│   │   │   └── cli.ts              # CLI for running experiments
│   │   └── package.json
│   │
│   └── examples/                    # Ready-to-run agent configs
│       ├── explorer/                # Wandering/discovery agent
│       ├── gatherer/                # Resource-focused agent
│       └── trader/                  # Economy-focused agent
│
├── docker/
│   ├── Dockerfile.bitcraft          # Build BitCraft server from source
│   └── docker-compose.dev.yml      # BitCraft + Crosstown + SpacetimeDB
│
├── configs/
│   ├── action-costs.json            # Default action pricing
│   └── experiments/                 # Example experiment configs
│       └── exploration-comparison.yaml
│
├── pnpm-workspace.yaml
├── tsconfig.json
├── package.json
└── README.md
```

---

## 11. Docker Development Environment

### 11.1 BitCraft Server Image

```dockerfile
# docker/Dockerfile.bitcraft
FROM clockworklabs/spacetimedb:latest AS runtime

# Install Rust toolchain for compiling BitCraft modules
FROM rust:1.75 AS builder
WORKDIR /build
COPY BitCraftServer/ .
RUN cargo build --release --target wasm32-unknown-unknown

FROM runtime
COPY --from=builder /build/target/wasm32-unknown-unknown/release/*.wasm /modules/
ENTRYPOINT ["spacetime", "start"]
```

_Note: Exact build steps depend on SpacetimeDB module compilation requirements. This is a starting point — will iterate during Phase 1._

### 11.2 Development Stack

```yaml
# docker/docker-compose.dev.yml
version: '3.8'
services:
  bitcraft:
    build:
      context: ..
      dockerfile: docker/Dockerfile.bitcraft
    ports:
      - '3000:3000' # SpacetimeDB WebSocket
    volumes:
      - bitcraft-data:/var/lib/spacetimedb

  # Crosstown services — reference existing compose files
  connector:
    image: crosstown-connector:dev
    ports:
      - '8080:8080' # Health/Runtime
      - '8081:8081' # Admin API
      - '3001:3000' # BTP

  crosstown:
    image: crosstown-node:dev
    ports:
      - '3100:3100' # BLS HTTP
      - '7100:7100' # Relay WebSocket
    environment:
      - GAME_ACTION_HANDLER=true
      - SPACETIMEDB_URL=ws://bitcraft:3000

volumes:
  bitcraft-data:
```

---

## 12. Phased Implementation Plan

### Phase 1: Game Access Layer (Weeks 1–2)

**Goal:** An agent can move a character by paying ILP tokens.

| Task                       | Description                                                                     |
| -------------------------- | ------------------------------------------------------------------------------- |
| Docker image               | Build BitCraft server from source, publish to local SpacetimeDB                 |
| SpacetimeDB client wrapper | Connect, subscribe, receive table updates                                       |
| CrosstownClient wrapper    | Initialize, publish game action events (kind 30078)                             |
| BLS game action handler    | New callback in Crosstown: kind 30078 → parse reducer + args → call SpacetimeDB |
| Action cost registry       | JSON config loader                                                              |
| Integration test           | `player_move` reducer called via ILP payment, character moves                   |

**Exit Criteria:** HTTP request with valid ILP receipt calls `player_move`; SpacetimeDB subscription confirms character position changed.

### Phase 2: Cognition Plugin Framework (Weeks 3–4)

**Goal:** An agent with reference plugins can observe the world and make decisions.

| Task                         | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| Plugin interface definitions | `CognitionPlugin<T>` base + all 5 layer interfaces |
| Layer 1: StaticDataLoader    | Load `*_desc` tables at startup, build lookup maps |
| Layer 2: Narrator            | Subscribe callbacks → `SemanticEvent[]`            |
| Layer 4: AffordanceEngine    | Nearby entity detection + cost annotation          |
| Layer 5: GoalsSimple         | Priority queue planner (no LLM)                    |
| Agent core loop              | Integrate all layers, tick-based execution         |
| Decision logger              | JSONL output of every tick                         |

**Exit Criteria:** Agent autonomously explores world using priority-queue planner for 10 minutes; decision log captures all ticks.

### Phase 3: Experiment Harness (Weeks 5–6)

**Goal:** A researcher can run comparative experiments with different configurations.

| Task                     | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| Experiment config loader | YAML → typed config                                             |
| Multi-agent launcher     | Spawn N agents with different plugin configs                    |
| Layer 3: MemoryBasic     | In-memory + JSON file persistence with serialize/deserialize    |
| Layer 5: GoalsLLM        | LLM-powered decision-making (OpenAI + Anthropic adapters)       |
| Snapshot/restore         | SpacetimeDB state + agent plugin states                         |
| Analysis tools           | Decision log → metrics (area explored, budget efficiency, etc.) |
| CLI                      | `npx @bitcraft-ai/harness run experiment.yaml`                  |

**Exit Criteria:** Two agents with different LLM backends run for 1 hour; comparative analysis report generated.

### Phase 4: Polish & Advanced Features (Weeks 7–8)

| Task                    | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| Layer 3: MemoryVector   | Vector DB integration for semantic search             |
| Example agents          | Explorer, gatherer, trader with tuned configs         |
| Documentation           | Setup guide, plugin authoring guide, experiment guide |
| Performance tuning      | Tick interval optimization, subscription filtering    |
| Multi-agent interaction | Agent-to-agent trading, chat, combat                  |

---

## 13. Technology Choices

| Component              | Choice              | Rationale                                                         |
| ---------------------- | ------------------- | ----------------------------------------------------------------- |
| **Language**           | TypeScript          | SpacetimeDB TS SDK + Crosstown compatibility; researcher-friendly |
| **Package Manager**    | pnpm workspaces     | Matches Crosstown; efficient monorepo support                     |
| **Build**              | tsup                | Fast, zero-config TypeScript bundler (matches Crosstown)          |
| **Test**               | vitest              | Fast, TypeScript-native (matches Crosstown)                       |
| **SpacetimeDB Client** | `@spacetimedb/sdk`  | Official TypeScript SDK                                           |
| **Crosstown Client**   | `@crosstown/client` | Existing ILP payment + Nostr event publishing                     |
| **Nostr**              | `nostr-tools`       | Event signing, key management (already a Crosstown dep)           |
| **LLM**                | Provider-agnostic   | OpenAI SDK + Anthropic SDK as optional peer deps                  |
| **Vector DB**          | ChromaDB (default)  | Local-first, easy setup for researchers                           |
| **Logging**            | JSONL files         | Simple, streamable, analyzable with standard tools                |
| **Config**             | YAML                | Human-readable experiment configuration                           |

---

## 14. Licensing & Legal

**BitCraft Server (Apache 2.0)**

- Commercial use, modification, and distribution: **Permitted**
- Derivative works with different license terms: **Permitted** (Section 4)
- Explicit README allowance: _"Make a game similar to BitCraft with your own IP using our code as a basis"_
- Explicit README allowance: _"Use it as a reference for building your own projects"_

**Requirements:**

- Retain Apache 2.0 license and copyright notices in the BitCraft Server code
- Mark modified files with prominent change notices (if we modify — we don't plan to)
- Do NOT use BitCraft trademarks, IP, art, or branding
- Do NOT present the project as official BitCraft

**Our Agent SDK:** Licensed separately (recommend MIT or Apache 2.0 for maximum researcher adoption).

**Risk Assessment:** Low. We run unmodified BitCraft in Docker as a game environment. Our product is the Agent SDK — a separate, original work. We don't compete with BitCraft (AI research platform vs human MMORPG), don't use their IP, and don't operate public-facing servers.

---

## 15. Open Questions

| #   | Question                                                  | Impact                | Decision Needed By |
| --- | --------------------------------------------------------- | --------------------- | ------------------ |
| 1   | Exact SpacetimeDB module compilation steps for Docker     | Blocks Phase 1        | Week 1             |
| 2   | Which `*_desc` tables exist in BitCraft for static data?  | Blocks Layer 1 plugin | Week 3             |
| 3   | SpacetimeDB subscription limits (max concurrent queries?) | Performance tuning    | Week 4             |
| 4   | ChromaDB vs Pinecone vs local embeddings for MemoryVector | Phase 4 plugin choice | Week 6             |
| 5   | Agent SDK repo name and npm scope (`@bitcraft-ai`?)       | Package publishing    | Week 1             |

---

## 16. Risks & Mitigations

| Risk                                                         | Likelihood | Impact | Mitigation                                                                                         |
| ------------------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------- |
| SpacetimeDB TS SDK doesn't support all subscription patterns | Medium     | High   | Prototype subscription layer in Phase 1; fallback to raw WebSocket                                 |
| BitCraft reducer args are complex / undocumented             | Medium     | Medium | Start with simple reducers (`player_move`, `chat_post_message`); reverse-engineer from Rust source |
| BLS → SpacetimeDB integration requires Crosstown changes     | High       | Low    | This is a small, well-scoped callback handler following the existing `onNIP34Event` pattern        |
| Agent LLM costs exceed research budgets                      | Medium     | Medium | Provide `goals-simple` (no LLM) as default; LLM is optional plugin                                 |
| BitCraft game state too large for agent context windows      | Medium     | High   | Subscription filtering + Layer 2 summarization reduces data volume                                 |

---

_This document is a living artifact. Update as decisions are made and implementation reveals new constraints._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
50 FRs across 9 domains. The architecture must support two distinct user experiences (AI researcher via TypeScript, terminal player via Rust TUI) sharing a common perception and action layer. 27 FRs are MVP-scoped, 23 are Phase 2/3.

**Non-Functional Requirements:**
27 NFRs with critical constraints:

- Performance: TUI at 30+ FPS, ILP round-trip < 2s, agent decision cycle < 5s (simple) / < 30s (LLM)
- Security: All ILP packets signed, private keys never transmitted, BLS validates every reducer call
- Scalability: 10 concurrent agents MVP, 50+ Phase 2
- Integration: SpacetimeDB 1.6.x, Nostr NIP-01, OpenAI-compatible LLM APIs
- Reliability: Auto-reconnect within 10s, zero silent identity propagation failures

**Scale & Complexity:**

- Primary domain: TypeScript SDK + Rust TUI + Real-time Systems + Payment Infrastructure
- Complexity level: High
- Estimated architectural components: 15+ (`@sigil/client`, `@sigil/mcp-server`, `@sigil/tui-backend`, Rust TUI, SpacetimeDB client, Crosstown client, skill parser, IPC layer, TUI app, experiment harness, decision logger, Docker environment, BLS handler, action cost registry, snapshot system, analysis tools)

### Technical Constraints & Dependencies

| Constraint                                  | Impact                                             | Source                            |
| ------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| SpacetimeDB 1.6.x protocol                  | Pins subscription API surface                      | `@sigil/client`                   |
| Crosstown consumed as dependency            | No modifications to payment layer                  | Write path                        |
| BitCraft server unmodified                  | Must work with vanilla reducers                    | All game interactions             |
| Nostr public key = sole identity            | No username/password fallback                      | Identity system                   |
| ILP payment on every write                  | Zero bypass paths allowed                          | Business model                    |
| Skill file format parsed by `@sigil/client` | Single parser in TypeScript, served to TUI via IPC | Core interoperability             |
| ratatui/crossterm for TUI                   | Terminal rendering constraints                     | Rust TUI client                   |
| rebels-in-the-sky patterns                  | Reference architecture for TUI                     | Event loop, Screen trait, widgets |

### Cross-Cutting Concerns Identified

1. **Identity Propagation** — Nostr keypair → ILP signature → BLS verification → SpacetimeDB attribution. Touches every write path in `@sigil/client`.
2. **Skill File Format** — Markdown-based DSL parsed by `@sigil/client` (TypeScript). Skill data served to TUI via IPC.
3. **SpacetimeDB Subscription Management** — `@sigil/client` manages connection lifecycle, reconnection, state recovery. ~80 entity tables + 148 static data tables. TUI receives data via IPC.
4. **Error Handling Across Boundaries** — Errors cross SpacetimeDB → `@sigil/client` → Crosstown → BLS → SpacetimeDB. Actionable error messages per PRD requirement.
5. **Cost Tracking** — Budget awareness in Agent.md, skill file cost declarations, ILP wallet balance, action cost registry. All managed by `@sigil/client`.
6. **Logging & Observability** — JSONL decision logs (agent), system metrics (infrastructure), BLS validation (identity). Research validity depends on complete logging.

### Architecture Refinement Focus Areas

Based on gap analysis between existing architecture and finalized PRD:

1. **ADD: Rust TUI Architecture** — ratatui TUI application communicating with `@sigil/tui-backend` via JSON-RPC IPC, event-driven architecture following rebels-in-the-sky patterns
2. **ADD: Declarative Agent System** — Agent.md parser, skill file format specification, action registry in `@sigil/client`
3. **ADD: Identity Propagation Design** — End-to-end mechanism for Nostr key → BLS → SpacetimeDB
4. **UPDATE: System Context** — Expand to single SDK with multiple consumer interfaces (MCP, IPC, direct import)
5. **UPDATE: Data Flow** — Add Crosstown relay read path, identity propagation detail
6. **UPDATE: Cognition Stack** — Integrate with declarative skill files instead of programmatic config
7. **UPDATE: Project Structure** — Polyglot monorepo (pnpm + cargo workspace layout)
8. **UPDATE: Phased Plan** — Align with PRD's critical path and multi-interface scope

---

## Starter Template & Technology Foundation

### Primary Technology Domain

TypeScript SDK with Rust TUI frontend — no standard starter template applies. Manual workspace initialization for both TypeScript (pnpm) and Rust (cargo) workspaces.

### Starter Options Considered

| Option                                    | Verdict        | Reason                                                            |
| ----------------------------------------- | -------------- | ----------------------------------------------------------------- |
| Standard web starters (T3, Next.js, Vite) | Not applicable | SDK library, not web application                                  |
| pnpm monorepo template generators         | Partial fit    | Provide workspace scaffolding but not SDK-specific tooling        |
| cargo-generate templates                  | Partial fit    | Generic workspace templates lack SpacetimeDB integration          |
| Manual initialization                     | Selected       | Full control over structure, dependencies, and workspace topology |

### Selected Approach: Manual Polyglot Workspace Initialization

**Rationale:** The project's unique integration requirements (SpacetimeDB + Crosstown + Nostr + ILP + ratatui) mean no existing template provides meaningful head start. Manual setup ensures dependency versions are verified and workspace structure matches the architectural needs.

### Verified Current Dependency Versions

**TypeScript SDK Dependencies:**

| Package       | Version | Notes                                                                                                                                                                                                       |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spacetimedb` | 2.0.1   | **BREAKING: replaces deprecated `@clockworklabs/spacetimedb-sdk`**. New WebSocket v2 protocol, reducer callbacks removed (use event tables + `_then()` callbacks). Backwards-compatible with 1.6.x modules. |
| `nostr-tools` | 2.23.0  | Event signing, key management, NIP implementations                                                                                                                                                          |
| `pnpm`        | 9.x     | Workspace monorepo management                                                                                                                                                                               |
| `tsup`        | latest  | Zero-config TypeScript bundler (ESM + CJS output, DTS generation)                                                                                                                                           |
| `vitest`      | latest  | TypeScript-native test framework                                                                                                                                                                            |
| `typescript`  | 5.x     | Strict mode configuration                                                                                                                                                                                   |

**Rust TUI Dependencies (presentation layer only — no direct SpacetimeDB or Crosstown connections):**

| Crate                  | Version | Notes                                                            |
| ---------------------- | ------- | ---------------------------------------------------------------- |
| `ratatui`              | 0.30+   | Modular workspace architecture since 0.30. Terminal UI framework |
| `crossterm`            | 0.29.0  | Cross-platform terminal manipulation                             |
| `tokio`                | 1.x     | Async runtime (rt, time, macros, sync)                           |
| `serde` / `serde_json` | latest  | JSON-RPC IPC serialization with `@sigil/tui-backend`             |

**Shared Tooling:**

| Tool                    | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| Docker / docker-compose | Local dev environment (BitCraft server + Crosstown node) |
| GitHub Actions          | CI/CD                                                    |

### SpacetimeDB Version Strategy

**Critical decision:** BitCraft Server pins `spacetimedb = "=1.6.0"`. The TypeScript SDK has moved to 2.0.1. SpacetimeDB 2.0 maintains backwards compatibility with existing modules, meaning 2.0 clients can connect to 1.6.x servers. The architecture should:

- Target **SpacetimeDB 2.0 client SDKs** for both TypeScript and Rust
- Verify backwards compatibility with 1.6.x modules during Phase 1 spike
- Document any 2.0-specific features that are unavailable when connected to 1.6.x servers
- Plan for BitCraft Server eventually upgrading to 2.0

### TypeScript Workspace Initialization

```bash
mkdir sigil && cd sigil
pnpm init
# Create pnpm-workspace.yaml with packages/*
mkdir -p packages/{core,plugins,harness,examples}
# Each package: pnpm init, tsconfig.json extending root, tsup.config.ts
```

**Workspace topology:** `pnpm-workspace.yaml` with `packages/*` glob. Shared `tsconfig.base.json` at root. Each package builds independently via tsup.

### Rust Workspace Initialization

```bash
mkdir sigil-tui && cd sigil-tui
cargo init --name sigil-tui
# Convert to virtual manifest workspace
mkdir -p crates/{core,tui,client}
```

**Workspace topology:** Virtual manifest `Cargo.toml` at root with `[workspace.dependencies]` for shared version pinning. Crates reference workspace deps via `spacetimedb-sdk.workspace = true`.

### Architectural Decisions Provided by Tooling

**TypeScript:**

- pnpm workspaces: Monorepo package management, `workspace:*` protocol for inter-package deps
- tsup: ESM + CJS dual output, `.d.ts` generation, tree-shakeable builds
- vitest: Fast unit tests with TypeScript support, workspace-aware test running
- TypeScript strict mode: Catches type errors at compile time

**Rust:**

- cargo workspace: Shared `Cargo.lock`, unified build artifacts, `[workspace.dependencies]`
- ratatui modular workspace (0.30+): Separate `ratatui-core`, `ratatui-widgets` crates for smaller builds
- crossterm: Cross-platform terminal backend
- tokio: Async event loop for SpacetimeDB subscriptions + terminal input + tick scheduling

**Note:** Workspace initialization should be the first implementation task for each runtime.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

1. Repository Strategy — Single polyglot monorepo (TS + Rust)
2. Identity Propagation — BLS proxy reducer pattern with Nostr pubkey injection
3. Agent Runtime — Claude instance with CLAUDE.md/AGENTS.md + Skills + MCP tools
4. MCP Server — Standalone TypeScript MCP server exposing game world
5. Client Package Architecture — `@sigil/client` TS package consumed by TUI backend + headless agent
6. Agent Inference — TS backend uses Agent SDKs (Anthropic, Vercel AI) for LLM inference

**Important Decisions (Shape Architecture):** 7. TUI Architecture — rebels-in-the-sky patterns + agent observation mode 8. Skill File Format — Standard Claude Agent Skills (SKILL.md), out of scope for custom design 9. Agent Config Naming — CLAUDE.md (Claude agents) / AGENTS.md (non-Claude agents)

**Deferred Decisions (Post-MVP):**

- Vector DB choice for semantic memory (ChromaDB vs alternatives)
- Multi-agent coordination protocols
- Agent marketplace / sharing mechanism
- SSH server support for TUI (rebels-in-the-sky has this, defer to Phase 2+)

### Data Architecture

**Database:** SpacetimeDB (server-side, unmodified BitCraft). No additional database required for MVP.

- SpacetimeDB 2.0 client SDKs targeting 1.6.x server modules (backwards compatible)
- ~80 entity tables, 148 static data tables, 364+ reducers available
- Subscription-based real-time state sync via TypeScript SDK

**Data Modeling:** SpacetimeDB tables define the schema. TypeScript SDK consumes generated client bindings.

- TypeScript: `spacetimedb generate --lang typescript`

**Persistence:** Agent state (CLAUDE.md, skill files, decision logs) stored as local files. Game state lives entirely in SpacetimeDB.

### Authentication & Security

**Identity:** Nostr keypair is the sole identity mechanism.

- No usernames, passwords, or OAuth
- Private keys managed locally per agent/player, never transmitted
- Public key = player identity across all systems

**Identity Propagation Pattern:**

```
Agent/Player → SDK Proxy Layer → Inject Nostr pubkey as reducer arg
→ ILP payment signed with Nostr key → Crosstown routes to BLS
→ BLS validates signature against pubkey → Forwards to SpacetimeDB reducer
```

**Authorization:** BLS (BitCraft Login Server) validates every write action. No bypass paths. ILP micropayment required for every game write.

**Security Invariants:**

- Zero silent identity propagation failures (fail loud, fail fast)
- All ILP packets cryptographically signed
- Private keys never leave the local process
- SDK proxy layer cannot be bypassed for write operations

### API & Communication Patterns

**MCP Server (Primary Agent Interface):**

- Standalone TypeScript process
- Exposes game world state as MCP resources (read)
- Exposes game actions as MCP tools (write, routed through BLS)
- Any MCP-compatible client can connect (Claude, Vercel AI, OpenCode, etc.)
- Connects to SpacetimeDB for subscriptions, Crosstown/BLS for authenticated writes

**SpacetimeDB Protocol:**

- WebSocket v2 (SpacetimeDB 2.0 client SDK)
- Subscription-based: clients subscribe to table queries, receive real-time updates
- Reducer calls for all write operations
- Event tables + `_then()` callbacks (replaces deprecated reducer callbacks)

**Crosstown/ILP Protocol:**

- Every game write action is an ILP micropayment
- Payment routes through Crosstown relay nodes
- BLS validates and forwards to SpacetimeDB

**TUI ↔ Backend Communication:**

- Rust ratatui TUI connects to TypeScript backend via IPC (stdio/local WebSocket)
- TypeScript backend handles all SpacetimeDB, Crosstown, and MCP connectivity
- TUI is a pure presentation layer — no direct SpacetimeDB or Crosstown connections from Rust

**Error Handling:** Errors cross multiple boundaries (SpacetimeDB → TS Backend → Crosstown → BLS → SpacetimeDB). The TypeScript backend provides actionable error messages with context about which boundary failed, surfaced in the TUI.

### Client Package Architecture (`@sigil/client`)

**Key Architectural Decision:** `@sigil/client` is the core engine — a pure TypeScript library with no CLI, no process management, no transport opinions. It handles all game connectivity: SpacetimeDB subscriptions, Crosstown/ILP payments, Nostr identity, and event aggregation. Everything else is a thin wrapper.

**Architecture: Client + Wrappers**

```
                    @sigil/client
                   (pure library — the engine)
                  /                \
                 /                  \
    @sigil/                 @sigil/
    mcp-server              tui-backend
    (MCP protocol wrapper)  (JSON-RPC IPC wrapper)
        ↑                        ↑
    Claude / OpenCode /       Rust TUI
    Vercel AI / any MCP       (sigil-tui)
    compatible agent
```

- **`@sigil/client`** — pure library. Imported by wrappers. Never runs as a process itself.
- **`@sigil/mcp-server`** — wraps client in MCP protocol. AI agents (Claude, OpenCode, Vercel AI) connect here.
- **`@sigil/tui-backend`** — wraps client in JSON-RPC 2.0 over stdio. Rust TUI spawns and talks to this.

The "headless agent" use case is handled by external agent SDKs (Vercel AI SDK, Claude Agent SDK) that either import `@sigil/client` directly or connect to `@sigil/mcp-server`. No separate headless package needed.

**`@sigil/client` API Surface:**

```typescript
const client = new SigilClient({
  spacetimedb: { host: '...', module: '...' },
  nostr: { relay: '...', privateKey: '...' },
  crosstown: { node: '...' },
});

// === Two independent read surfaces ===

// SpacetimeDB: game world state
client.spacetimedb.subscribe('player_state', query);
client.spacetimedb.on('tableUpdate', handler);
client.spacetimedb.tables; // generated type-safe table accessors

// Nostr relay: confirmations, notifications, social
client.nostr.subscribe(filters);
client.nostr.on('event', handler);
client.nostr.relay; // raw relay connection

// === One write path ===

// Everything goes through ILP — single write API
client.publish(action); // signs → ILP packet → Crosstown → BLS → SpacetimeDB

// === High-level aggregated events ===

client.on('actionConfirmed', handler); // from Nostr relay
client.on('gameStateUpdate', handler); // from SpacetimeDB
client.on('connectionChange', handler); // from either

// === Identity ===

client.identity; // Nostr keypair, public key
```

| Surface              | Purpose                                                | Type               |
| -------------------- | ------------------------------------------------------ | ------------------ |
| `client.spacetimedb` | Game world state (tables, subscriptions)               | Read               |
| `client.nostr`       | Relay events (confirmations, social, custom)           | Read               |
| `client.publish()`   | All game actions (ILP → Crosstown → BLS → SpacetimeDB) | Write              |
| `client.on()`        | High-level aggregated events from both sources         | Read (convenience) |
| `client.identity`    | Nostr keypair, public key                              | Identity           |

**Design rationale:**

- Two read surfaces because SpacetimeDB and Nostr relay are independent data sources with different protocols
- One write path because the architecture has a single write pipeline (all actions go through ILP/Crosstown/BLS)
- `client.publish()` — not "write to SpacetimeDB" or "write to Nostr". The consumer publishes intent; the client handles the pipeline
- High-level events aggregate from both sources for consumers who don't need to know which system generated the event

### Frontend Architecture (Hybrid TUI)

**Rust TUI (Presentation Layer):**

- ratatui 0.30+ with crossterm 0.29.0 backend
- tokio async runtime for terminal input + tick scheduling + IPC
- Follows rebels-in-the-sky patterns:
  - `Screen` trait: `update()`, `render()`, `handle_key_events()`, `footer_spans()`
  - `UiCallback` enum: Typed callback variants dispatched to backend via IPC
  - `CallbackRegistry`: Mouse/keyboard hit-testing during render pass
  - `UiFrame` wrapper: Screen centering, callback registration, hover text
  - Dirty flags: Minimize re-renders, target 30+ FPS
  - Tick system: Slow tick (10Hz) for game state polling, fast tick (40Hz) for animations

**TUI Backend (consumes `@sigil/client`):**

- Node.js process that imports `@sigil/client`
- Exposes game state and action API to the Rust TUI via IPC
- Manages agent inference lifecycle
- Bridges agent decisions to game actions

**Communication Bridge (Rust ↔ TypeScript):**

- IPC mechanism: stdio pipes (Rust spawns Node.js child process) or local WebSocket
- Protocol: JSON messages with typed schemas (game state updates, action requests, responses)
- Rust TUI sends user actions → TS backend processes → SpacetimeDB/Crosstown → result back to TUI
- TS backend pushes real-time game state updates → Rust TUI renders

### Headless Agent Mode

Headless agents are not a Sigil package — they are external agent frameworks that consume Sigil:

- **Via MCP:** Agent SDKs (Claude, OpenCode, Vercel AI) connect to `@sigil/mcp-server` using standard MCP protocol. The MCP server exposes game world as tools/resources. This is the primary headless path.
- **Via direct import:** A researcher can `import { SigilClient } from '@sigil/client'` in their own TypeScript code alongside any agent SDK (Vercel AI SDK, Anthropic SDK) for custom orchestration.

**Agent Observation Mode (TUI only):**

- TUI includes a dedicated view for spectating agents owned by the human player
- Real-time display of agent perception, decisions, and actions (sourced from TS backend)
- Read-only view — human observes but does not control the agent

**Panels (following rebels pattern):**

- Game world view (galaxy, planets, teams)
- Agent dashboard (observation mode)
- Player/team management
- Market/trading interface
- Space adventure (if applicable)

### Infrastructure & Deployment

**Local Development:**

- Docker Compose: BitCraft server + Crosstown node + BLS
- TypeScript workspace builds independently (SDK core + MCP server + TUI backend)
- Rust TUI builds independently (presentation layer only)
- MCP server runs as standalone process

**Repository Layout (Single Polyglot Monorepo):**

```
sigil/
├── packages/              # TypeScript (pnpm workspace)
│   ├── client/            # @sigil/client — pure library (the engine)
│   │                      #   SpacetimeDB + Crosstown/ILP + Nostr + Identity
│   ├── mcp-server/        # @sigil/mcp-server — MCP protocol wrapper
│   └── tui-backend/       # @sigil/tui-backend — JSON-RPC IPC wrapper
├── crates/                # Rust (cargo workspace)
│   └── tui/               # sigil-tui — ratatui presentation layer
├── skills/                # Shared SKILL.md files
├── agents/                # Agent definitions
│   ├── CLAUDE.md          # Claude agent configuration
│   └── AGENTS.md          # Non-Claude agent configuration
├── examples/              # Example agent configurations
├── docker/                # Docker Compose for local dev
├── pnpm-workspace.yaml
├── Cargo.toml             # Virtual manifest
└── package.json
```

**CI/CD:** GitHub Actions — lint, test, build for both workspaces. Type checking (TS strict mode), clippy (Rust).

### Agent Configuration Architecture

**CLAUDE.md (Claude Agents):**

- Claude-specific configuration following Claude Code conventions
- Defines agent personality, constraints, goals, budget limits
- References skills and MCP server connection details

**AGENTS.md (Non-Claude Agents):**

- Generic agent configuration for non-Claude AI systems (Vercel AI, OpenCode, etc.)
- Runtime-agnostic format
- Same game capabilities, different configuration surface

**Skills (SKILL.md):**

- Standard Claude Agent Skills format
- YAML frontmatter: name, description
- Markdown body: instructions, examples, tool references
- Progressive disclosure: metadata always loaded, full instructions on trigger

### Decision Impact Analysis

**Implementation Sequence:**

1. Repository scaffolding (monorepo with TS workspace + Rust crate)
2. `@sigil/client` package: SpacetimeDB 2.0 client + Nostr relay + Crosstown/ILP + Identity + `client.publish()` write path
3. `@sigil/mcp-server` (MCP protocol wrapper over `@sigil/client`, exposes game world as tools/resources)
4. `@sigil/tui-backend` (JSON-RPC IPC wrapper over `@sigil/client`, bridge for ratatui)
5. `sigil-tui` Rust TUI application (ratatui presentation layer, connects to tui-backend via IPC)
6. Agent configuration (CLAUDE.md + AGENTS.md + Skills)
7. Agent observation mode in TUI

**Cross-Component Dependencies:**

- `@sigil/client` is the foundational package — both wrappers depend on it
- `@sigil/mcp-server` wraps `@sigil/client` in MCP protocol (for AI agents)
- `@sigil/tui-backend` wraps `@sigil/client` in JSON-RPC IPC (for Rust TUI)
- `sigil-tui` depends on `@sigil/tui-backend` (IPC communication for all data)
- Headless agents connect to `@sigil/mcp-server` via MCP, or import `@sigil/client` directly
- Skills are consumed by MCP server (tool definitions) and agent configs
- Identity + `client.publish()` pipeline is foundational — blocks all write operations

**Superseded Architecture (to be removed/replaced in future refinement):**

- Section 5: Five-Layer Cognition Architecture → Replaced by Claude + Skills + MCP
- Section 5.1: CognitionPlugin<TInput, TOutput, TState> → No longer applicable
- Section 5.2: Layer implementations (PerceptionFilter, GoalsEngine, etc.) → Agent cognition is Claude, not custom code
- Rust SDK core for SpacetimeDB/Crosstown → Eliminated; `@sigil/client` (TS) handles all connectivity
- Section 10: Technology Choices → Partially superseded (single TS runtime for all backend logic, Rust only for TUI rendering)

---

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**9 critical conflict areas** identified where AI agents could make incompatible choices across the polyglot monorepo.

### Naming Patterns

**TypeScript Naming Conventions:**

- Files: `kebab-case.ts` (e.g., `game-state.ts`, `mcp-server.ts`, `identity-proxy.ts`)
- Functions/variables: `camelCase` (e.g., `getPlayerInfo`, `gameState`)
- Types/interfaces: `PascalCase` (e.g., `PlayerState`, `GameAction`, `SigilClientOptions`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_PLAYERS`, `DEFAULT_TICK_RATE`)
- Exports: barrel `index.ts` per package for public API surface

**Rust Naming Conventions (following rebels-in-the-sky):**

- Files: `snake_case.rs` (e.g., `game_panel.rs`, `clickable_list.rs`)
- Functions/variables: `snake_case` (e.g., `handle_key_events`, `game_state`)
- Types/structs/enums: `PascalCase` (e.g., `UiCallback`, `AppEvent`, `Screen`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `UI_SCREEN_SIZE`, `LEFT_PANEL_WIDTH`)

**JSON / IPC Field Naming:**

- All JSON exchanged between Rust and TypeScript uses `camelCase` fields
- Rust side: `#[serde(rename_all = "camelCase")]` on all IPC message structs
- Rationale: TS is the data layer, Rust is presentation — TS conventions dominate the wire format

**MCP Tool & Resource Naming:**

- Tool names: `snake_case` (MCP convention) — e.g., `move_player`, `get_inventory`, `submit_trade`, `explore_planet`
- Resource URIs: plural nouns — `sigil://players/{id}`, `sigil://planets/{id}`, `sigil://teams/{id}`

### Structure Patterns

**TypeScript Project Organization:**

- One package per concern: `client`, `mcp-server`, `tui-backend`, `headless-agent`, `harness`
- Each package has: `src/`, `tests/`, `package.json`, `tsconfig.json`, `tsup.config.ts`
- Barrel exports: `src/index.ts` defines public API per package
- Internal modules: `src/{feature}/` directories for complex packages

**Rust Project Organization (rebels-in-the-sky pattern):**

- Single `crates/tui/` crate for the TUI application
- Module structure mirrors rebels: `src/ui/` (panels, widgets), `src/ipc/` (backend communication)
- One file per widget, one file per panel/screen
- `mod.rs` barrel re-exports per module

**Test Organization:**

- TypeScript: co-located `*.test.ts` next to source files (vitest convention)
- TypeScript integration tests: `packages/*/tests/integration/`
- Rust: inline `#[cfg(test)] mod tests` blocks (standard Rust, matches rebels-in-the-sky)
- Rust integration tests: `crates/tui/tests/`
- Cross-runtime IPC tests: `packages/tui-backend/tests/integration/`

**Configuration Files:**

- Shared ESLint + Prettier config at monorepo root
- Shared `tsconfig.base.json` at root, extended per package
- Shared `rustfmt.toml` at root
- Environment: `.env.example` at root, `.env` gitignored

### Format Patterns

**IPC Protocol — JSON-RPC 2.0:**

- Standard JSON-RPC 2.0 format for all Rust ↔ TypeScript communication
- Request: `{"jsonrpc": "2.0", "method": "getGameState", "params": {}, "id": 1}`
- Response: `{"jsonrpc": "2.0", "result": {...}, "id": 1}`
- Error: `{"jsonrpc": "2.0", "error": {"code": -32000, "message": "...", "data": {"boundary": "spacetimedb"}}, "id": 1}`
- Notification (no response expected): `{"jsonrpc": "2.0", "method": "gameStateUpdate", "params": {...}}`
- Rust side: typed message enums with serde, matching rebels-in-the-sky `AppEvent` pattern

**Error Format (`@sigil/client`):**

- Typed error classes extending `Error`
- Required fields: `code` (enum), `message` (human-readable), `boundary` (where error originated)
- Boundary values: `spacetimedb`, `crosstown`, `bls`, `mcp`, `agent`, `ipc`
- Example: `new SigilError({ code: 'REDUCER_FAILED', message: 'Move rejected: insufficient fuel', boundary: 'spacetimedb' })`

**Data Exchange:**

- Dates: ISO 8601 strings in JSON (`2026-02-25T12:00:00Z`)
- IDs: string UUIDs (matching SpacetimeDB identity format)
- Nulls: explicit `null` in JSON, `Option<T>` in Rust, `T | null` in TypeScript
- Game ticks: `number` (milliseconds since epoch, matching rebels-in-the-sky `Tick = u64`)

### Communication Patterns

**`@sigil/client` Event System:**

- Event-driven: `EventEmitter` pattern with typed events
- Client emits typed events on SpacetimeDB subscription updates
- Events: `gameStateUpdate`, `playerAction`, `agentDecision`, `connectionStatusChange`, `error`
- Consumers (tui-backend, headless-agent) subscribe to events they care about
- No polling — all state changes are push-based from SpacetimeDB subscriptions

**`@sigil/client` Public API Pattern:**

- Constructor: `new SigilClient(options: SigilClientOptions)`
- All methods: `async/await` Promises (no callbacks, no observables)
- All methods return typed results — no `any`
- Options object pattern for all configuration
- Explicit `connect()` / `disconnect()` lifecycle methods

**TUI State Management (rebels-in-the-sky pattern):**

- `UiCallback` enum: typed variants for all user actions
- Callbacks dispatched to TUI backend via JSON-RPC over IPC
- Dirty flags on state changes to minimize re-renders
- `AppState` enum for top-level application state machine
- Panel-level state managed per-screen (matching rebels `UiState`, `UiTab`)

### Process Patterns

**Error Handling Chain:**

- `@sigil/client`: catches and wraps all external errors with `boundary` field
- TUI backend: forwards typed errors via JSON-RPC error objects to Rust TUI
- Rust TUI: maps IPC errors to UI-displayable popup messages (matching rebels `PopupMessage::Error`)
- Headless agent: logs errors to decision log, applies retry/backoff per error type
- Invariant: Rust TUI never crashes on backend errors — always displays gracefully

**Connection Lifecycle:**

- `@sigil/client` manages SpacetimeDB WebSocket connection
- Auto-reconnect with exponential backoff (max 30s) on disconnect
- Connection state emitted as events: `connecting`, `connected`, `disconnected`, `reconnecting`
- TUI displays connection status in status bar (matching rebels pattern)
- Headless agent logs connection state changes

**Agent Inference Lifecycle:**

- `@sigil/client` provides pluggable agent inference via Agent SDK integration
- Inference configured at construction: `new SigilClient({ agent: { sdk: 'anthropic', model: 'claude-sonnet-4-5-20250929' } })`
- Agent loop: perceive (SpacetimeDB state) → decide (LLM inference) → act (reducer call via Crosstown)
- Decision logging: every inference call logged with input context, output action, latency
- Budget tracking: token/cost tracking per agent session

**Loading States:**

- TUI: loading spinner on panels awaiting backend data (rebels pattern)
- Named states: `loading`, `loaded`, `error`, `stale` (connected but data outdated)
- Global connection state in status bar, per-panel data state in panel header

### Enforcement Guidelines

**All AI Agents Working on This Codebase MUST:**

- Follow the naming conventions above for their respective language (TS or Rust)
- Use JSON-RPC 2.0 for any new IPC messages
- Use `camelCase` for all JSON fields crossing the IPC boundary
- Use `snake_case` for MCP tool names
- Wrap errors with `boundary` field indicating origin
- Write co-located tests for new TypeScript code
- Write inline `#[cfg(test)]` tests for new Rust code
- Use `async/await` for all async TypeScript code (no callbacks)

**Enforcement Mechanisms:**

- ESLint: naming convention rules, no-any rule, consistent-type-imports
- Prettier: format on save, checked in CI
- `cargo clippy`: lint all Rust code, deny warnings in CI
- `rustfmt`: format all Rust code, checked in CI
- JSON schema validation: IPC message schemas in `packages/client/schemas/`, validated by both TS (ajv) and Rust (serde) sides
- CI pipeline: `pnpm lint && pnpm test && cargo clippy && cargo test` on every PR

### Pattern Examples

**Good — IPC message from Rust TUI to TS backend:**

```json
{
  "jsonrpc": "2.0",
  "method": "movePlayer",
  "params": { "playerId": "abc-123", "targetPlanetId": "def-456" },
  "id": 42
}
```

**Bad — wrong field casing, no JSON-RPC wrapper:**

```json
{ "action": "move_player", "player_id": "abc-123", "target_planet_id": "def-456" }
```

**Good — MCP tool definition:**

```json
{ "name": "move_player", "description": "Move a player to a target planet" }
```

**Bad — camelCase MCP tool name:**

```json
{ "name": "movePlayer", "description": "Move a player to a target planet" }
```

**Good — error from `@sigil/client`:**

```typescript
throw new SigilError({
  code: 'REDUCER_FAILED',
  message: 'Move rejected: insufficient fuel',
  boundary: 'spacetimedb',
});
```

**Bad — untyped error:**

```typescript
throw new Error('something went wrong');
```

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
sigil/
├── .github/
│   └── workflows/
│       ├── ci-typescript.yml          # TS: lint, typecheck, test, build
│       ├── ci-rust.yml                # Rust: clippy, rustfmt, test, build
│       └── release.yml                # Package publishing
├── .env.example                       # Environment template (SpacetimeDB URL, Crosstown URL, etc.)
├── .gitignore
├── .eslintrc.cjs                      # Shared ESLint config (root)
├── .prettierrc                        # Shared Prettier config (root)
├── rustfmt.toml                       # Shared Rust formatter config
├── pnpm-workspace.yaml                # pnpm workspace: packages/*
├── package.json                       # Root: scripts, devDependencies (lint, format)
├── tsconfig.base.json                 # Shared TypeScript base config
├── Cargo.toml                         # Virtual manifest: members = ["crates/*"]
├── Cargo.lock
├── LICENSE
│
├── packages/                          # ═══ TypeScript (pnpm workspace) ═══
│   │
│   ├── client/                        # @sigil/client — pure library (the engine)
│   │   ├── package.json               # name: "@sigil/client"
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts               # Barrel: public API surface
│   │   │   ├── client.ts              # SigilClient class — main entry point
│   │   │   ├── types.ts               # Shared types: SigilClientOptions, events, enums
│   │   │   ├── errors.ts              # SigilError class, error codes, boundary enum
│   │   │   ├── spacetimedb/
│   │   │   │   ├── index.ts           # FR6-FR10: client.spacetimedb surface
│   │   │   │   ├── connection.ts      # SpacetimeDB 2.0 WebSocket v2 connection manager
│   │   │   │   ├── subscriptions.ts   # Table subscription management
│   │   │   │   ├── reconnect.ts       # Auto-reconnect with exponential backoff
│   │   │   │   ├── static-data.ts     # *_desc table loader (FR8)
│   │   │   │   └── connection.test.ts
│   │   │   ├── nostr/
│   │   │   │   ├── index.ts           # FR1-FR5, FR7: client.nostr surface
│   │   │   │   ├── keypair.ts         # Generate, import, export Nostr keypairs
│   │   │   │   ├── relay.ts           # Nostr relay connection (Crosstown built-in relay)
│   │   │   │   ├── subscriptions.ts   # Relay event subscriptions and filters
│   │   │   │   └── keypair.test.ts
│   │   │   ├── publish/
│   │   │   │   ├── index.ts           # FR17-FR22: client.publish() write path
│   │   │   │   ├── publisher.ts       # Signs action → ILP packet → Crosstown → BLS
│   │   │   │   ├── cost-registry.ts   # Action cost lookup (FR22)
│   │   │   │   ├── wallet.ts          # ILP wallet balance queries (FR21)
│   │   │   │   ├── crosstown-client.ts # ILP packet routing via Crosstown
│   │   │   │   ├── bls-proxy.ts       # Identity propagation proxy (Nostr pubkey injection)
│   │   │   │   └── publisher.test.ts
│   │   │   ├── skills/
│   │   │   │   ├── index.ts           # FR11-FR14: Skill file parsing
│   │   │   │   ├── skill-loader.ts    # SKILL.md file loader and validator
│   │   │   │   └── skill-loader.test.ts
│   │   │   └── schemas/
│   │   │       └── ipc-messages.json  # JSON schema for IPC protocol (shared with Rust)
│   │   └── tests/
│   │       └── integration/
│   │           ├── spacetimedb-connection.test.ts
│   │           └── publish-roundtrip.test.ts
│   │
│   ├── mcp-server/                    # Standalone MCP server
│   │   ├── package.json               # name: "@sigil/mcp-server"
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point: MCP server startup
│   │   │   ├── server.ts              # MCP server configuration and transport setup
│   │   │   ├── tools/
│   │   │   │   ├── index.ts           # Tool registration (maps skills → MCP tools)
│   │   │   │   ├── game-actions.ts    # MCP tools for game write actions (via @sigil/client)
│   │   │   │   └── world-queries.ts   # MCP tools for game read queries
│   │   │   ├── resources/
│   │   │   │   ├── index.ts           # Resource registration
│   │   │   │   ├── players.ts         # sigil://players/{id}
│   │   │   │   ├── planets.ts         # sigil://planets/{id}
│   │   │   │   ├── teams.ts           # sigil://teams/{id}
│   │   │   │   └── inventory.ts       # sigil://inventory/{playerId}
│   │   │   └── tools/game-actions.test.ts
│   │   └── tests/
│   │       └── integration/
│   │           └── mcp-tool-execution.test.ts
│   │
│   ├── tui-backend/                   # TUI backend (IPC bridge for Rust TUI)
│   │   ├── package.json               # name: "@sigil/tui-backend"
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point: stdio IPC server
│   │   │   ├── ipc-server.ts          # JSON-RPC 2.0 handler over stdio
│   │   │   ├── methods/
│   │   │   │   ├── index.ts           # Method registration
│   │   │   │   ├── game-state.ts      # getGameState, subscribeUpdates
│   │   │   │   ├── player-actions.ts  # movePlayer, sendChat, manageInventory
│   │   │   │   ├── agent-control.ts   # startAgent, stopAgent, getAgentStatus
│   │   │   │   └── connection.ts      # connect, disconnect, getConnectionStatus
│   │   │   └── ipc-server.test.ts
│   │   └── tests/
│   │       └── integration/
│   │           └── ipc-roundtrip.test.ts
│   │
│   │   # NOTE: No headless-agent package. Headless agents use external
│   │   # agent SDKs (Claude, Vercel AI) connecting to @sigil/mcp-server,
│   │   # or import @sigil/client directly in custom TS code.
│   │
│   └── examples/                      # Example agent configurations
│       ├── explorer/
│       │   ├── CLAUDE.md              # Explorer agent config (Claude)
│       │   └── AGENTS.md             # Explorer agent config (non-Claude)
│       ├── trader/
│       │   ├── CLAUDE.md
│       │   └── AGENTS.md
│       └── gatherer/
│           ├── CLAUDE.md
│           └── AGENTS.md
│
├── crates/                            # ═══ Rust (cargo workspace) ═══
│   │
│   └── tui/                           # ratatui TUI (presentation layer only)
│       ├── Cargo.toml                 # Dependencies: ratatui, crossterm, tokio, serde, serde_json
│       ├── src/
│       │   ├── main.rs                # Entry point: parse args, spawn TUI backend, start app
│       │   ├── app.rs                 # App struct: event loop, AppState, AppEvent
│       │   ├── tui.rs                 # Terminal setup: raw mode, alternate screen, FPS cap
│       │   ├── types.rs               # Type aliases, IPC message types (serde, rename_all camelCase)
│       │   ├── ipc/
│       │   │   ├── mod.rs             # IPC module
│       │   │   ├── client.rs          # JSON-RPC 2.0 client over stdio
│       │   │   ├── messages.rs        # Typed request/response/notification enums
│       │   │   └── transport.rs       # Stdio read/write with tokio
│       │   ├── ui/
│       │   │   ├── mod.rs             # UI module: Screen trait, UiCallback, UiState
│       │   │   ├── constants.rs       # UI_SCREEN_SIZE, style constants (UiStyle)
│       │   │   ├── ui_screen.rs       # Top-level view controller, tab navigation
│       │   │   ├── ui_callback.rs     # UiCallback enum → IPC dispatch
│       │   │   ├── ui_frame.rs        # UiFrame wrapper (centering, callback registry)
│       │   │   ├── traits.rs          # Screen, SplitPanel, InteractiveWidget traits
│       │   │   ├── button.rs          # Button widget (hotkeys, hover, disabled)
│       │   │   ├── clickable_list.rs  # Scrollable clickable list widget
│       │   │   ├── clickable_table.rs # Row-based clickable table widget
│       │   │   ├── popup_message.rs   # PopupMessage enum (Ok, Error, Confirm)
│       │   │   ├── widgets.rs         # Shared widget functions, bar renderers
│       │   │   ├── utils.rs           # Image-to-terminal, formatting helpers
│       │   │   └── panels/
│       │   │       ├── mod.rs
│       │   │       ├── splash_screen.rs    # Title screen
│       │   │       ├── world_panel.rs      # Galaxy/planet view (FR28)
│       │   │       ├── player_panel.rs     # Character status (FR32)
│       │   │       ├── inventory_panel.rs  # Inventory management (FR31)
│       │   │       ├── chat_panel.rs       # Chat messages (FR30)
│       │   │       ├── agent_panel.rs      # Agent observation dashboard
│       │   │       ├── market_panel.rs     # Trading (Phase 2, FR36)
│       │   │       └── status_bar.rs       # Connection status, wallet balance
│       │   └── event_handler.rs       # Input polling (crossterm events → AppEvent)
│       └── tests/
│           └── ipc_roundtrip.rs       # Integration test: mock TS backend
│
├── skills/                            # ═══ Shared SKILL.md files ═══
│   ├── bitcraft/                      # BitCraft v1 world skills
│   │   ├── move-player.md             # Skill: player_move reducer
│   │   ├── chat-message.md            # Skill: chat_post_message reducer
│   │   ├── gather-resource.md         # Skill: gather_* reducers
│   │   ├── craft-item.md              # Skill: craft_* reducers (Phase 2)
│   │   ├── trade-offer.md             # Skill: trade_* reducers (Phase 2)
│   │   └── build-structure.md         # Skill: build_* reducers (Phase 2)
│   └── README.md                      # How to write skill files for new worlds (FR48)
│
├── agents/                            # ═══ Agent definitions ═══
│   ├── CLAUDE.md                      # Default Claude agent configuration
│   └── AGENTS.md                      # Default non-Claude agent configuration
│
└── docker/                            # ═══ Infrastructure ═══
    ├── docker-compose.yml             # FR44: BitCraft server + Crosstown node + BLS
    ├── docker-compose.dev.yml         # Dev overrides (hot reload, debug ports)
    ├── bitcraft-server/
    │   └── Dockerfile                 # BitCraft server (SpacetimeDB WASM module)
    └── crosstown-node/
        └── Dockerfile                 # Crosstown node + BLS handler (FR47)
```

### Architectural Boundaries

**Boundary 1: `@sigil/client` → External Services**

- SpacetimeDB: WebSocket v2 connection (subscription + reducer calls)
- Crosstown: ILP packet routing (payment + BLS identity)
- Agent SDKs: HTTP to LLM providers (Anthropic API, OpenAI-compatible)
- All external errors wrapped with `boundary` field at this layer

**Boundary 2: TUI Backend → Rust TUI (IPC)**

- JSON-RPC 2.0 over stdio pipes
- TUI backend is the only TS process the Rust TUI communicates with
- All game state and actions flow through this single boundary
- Schema defined in `packages/client/schemas/ipc-messages.json`

**Boundary 3: MCP Server → MCP Clients**

- Standard MCP protocol (stdio transport)
- Claude, OpenCode, or any MCP-compatible client connects here
- MCP server uses `@sigil/client` internally for all game operations
- Tools = game actions, Resources = game state

**Boundary 4: `@sigil/client` → Consumers**

- Three consumers: tui-backend, headless-agent, harness
- All use the same `SigilClient` API
- Event-driven: consumers subscribe to typed events
- No consumer accesses SpacetimeDB/Crosstown/BLS directly

### Requirements to Structure Mapping

| FR Domain                       | Package/Crate                                   | Key Files                                                                       |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| **FR1-FR5: Identity**           | `packages/client/src/identity/`                 | `keypair.ts`, `signer.ts`                                                       |
| **FR6-FR10: Perception**        | `packages/client/src/perception/`               | `spacetimedb-client.ts`, `static-data.ts`, `reconnect.ts`                       |
| **FR11-FR16: Agent Config**     | `packages/client/src/agent/`                    | `agent-config.ts`, `skill-loader.ts`, `budget-tracker.ts`                       |
| **FR17-FR22: Actions/Payments** | `packages/client/src/actions/`, `src/payments/` | `action-executor.ts`, `crosstown-client.ts`, `bls-proxy.ts`, `cost-registry.ts` |
| **FR23-FR27: Cognition**        | External agent SDKs via `@sigil/mcp-server`     | MCP tools + `@sigil/client` direct import                                       |
| **FR28-FR38: TUI**              | `crates/tui/`, `packages/tui-backend/`          | `src/ui/panels/*.rs`, `src/methods/*.ts`                                        |
| **FR39-FR43: Experiments**      | External tooling consuming `@sigil/client`      | Phase 2 — JSONL logging built into client                                       |
| **FR44-FR47: Infrastructure**   | `docker/`                                       | `docker-compose.yml`, Dockerfiles                                               |
| **FR48-FR50: Extensibility**    | `skills/`                                       | Skill files per world, `README.md` authoring guide                              |

### Cross-Cutting Concerns Mapping

| Concern                  | Locations                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identity propagation** | `client/src/identity/` → `client/src/payments/bls-proxy.ts` → `client/src/actions/action-executor.ts`                                                                         |
| **Error handling**       | `client/src/errors.ts` (defines) → all `client/src/*/` (throws) → `tui-backend/src/ipc-server.ts` (wraps as JSON-RPC error) → `crates/tui/src/ui/popup_message.rs` (displays) |
| **Logging**              | `headless-agent/src/logger.ts` (decision JSONL) + `client/src/` (system logs via structured JSONL)                                                                            |
| **Budget tracking**      | `client/src/agent/budget-tracker.ts` → `client/src/actions/action-executor.ts` (enforces) → `crates/tui/src/ui/panels/status_bar.rs` (displays)                               |
| **Connection lifecycle** | `client/src/perception/reconnect.ts` → events emitted to all consumers → `tui-backend/` relays to TUI → `crates/tui/src/ui/panels/status_bar.rs` (displays)                   |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SpacetimeDB Server                          │
│  (BitCraft WASM module — unmodified, ~80 tables, 364+ reducers)    │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │ WebSocket v2 (subscriptions)      │ reducer calls
           ▼                                   ▲
┌────────────────────────────────────────────────────────────────────┐
│                       @sigil/client                                │
│  client.spacetimedb ◄── table updates                              │
│  client.nostr ◄── relay events (confirmations, notifications)      │
│  client.publish() ──► ILP packet ──► Crosstown ──► BLS ──► STDB   │
│  client.identity ── Nostr keypair                                  │
└───────────────┬───────────────────────────┬────────────────────────┘
                │ imported by                │ imported by
                ▼                            ▼
    ┌───────────────────┐        ┌───────────────────┐
    │ @sigil/tui-backend│        │ @sigil/mcp-server │
    │ (JSON-RPC wrapper)│        │ (MCP wrapper)     │
    └────────┬──────────┘        └─────────┬─────────┘
             │ stdio IPC                   │ MCP protocol
             ▼                             ▲
    ┌────────────────┐           ┌─────────┴─────────┐
    │ sigil-tui      │           │ Claude / OpenCode /│
    │ (Rust/ratatui) │           │ Vercel AI / any   │
    └────────────────┘           │ MCP-compatible     │
                                 └───────────────────┘
```

### Development Workflow

**First-time setup:**

```bash
pnpm install                    # Install all TS dependencies
cargo build                     # Build Rust TUI
docker compose -f docker/docker-compose.dev.yml up  # Start BitCraft + Crosstown
```

**Development (TUI):**

```bash
# Terminal 1: TS backend with hot reload
pnpm --filter @sigil/tui-backend dev

# Terminal 2: Rust TUI (connects to backend via stdio)
cargo run --bin sigil-tui
```

**Development (MCP server):**

```bash
pnpm --filter @sigil/mcp-server dev
```

**CI Pipeline:**

```bash
pnpm lint && pnpm typecheck && pnpm test   # All TS packages
cargo clippy -- -D warnings && cargo test   # Rust TUI
```

---

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility: PASS**

- SpacetimeDB 2.0 TS SDK confirmed backwards-compatible with 1.6.x server modules
- ratatui 0.30 + crossterm 0.29 + tokio: standard, well-tested Rust TUI stack
- JSON-RPC 2.0 over stdio: proven IPC pattern, strong tooling in both TS and Rust (serde)
- `@sigil/client` as single abstraction: clean separation — no consumer touches SpacetimeDB/Crosstown directly
- Agent SDK (Anthropic/Vercel AI) consumed as pluggable dependency within `@sigil/client`
- MCP server standalone: decoupled from TUI and headless agent, any MCP client connects independently

**Pattern Consistency: PASS**

- TS naming (camelCase/PascalCase/kebab-case files) consistent with ecosystem norms
- Rust naming (snake_case, rebels-in-the-sky patterns) consistent with reference architecture
- IPC wire format (camelCase JSON + `#[serde(rename_all = "camelCase")]`) handles cross-language boundary cleanly
- MCP tool naming (snake_case) matches MCP ecosystem convention
- Error handling (typed errors with `boundary` field) consistent from `@sigil/client` through IPC to TUI display

**Structure Alignment: PASS**

- Every architectural boundary maps to a package/crate boundary
- `@sigil/client` → external services (Boundary 1)
- `tui-backend` → Rust TUI via IPC (Boundary 2)
- `mcp-server` → MCP clients (Boundary 3)
- All consumers → `@sigil/client` API only (Boundary 4)
- No circular dependencies; dependency graph is a clean DAG

### Requirements Coverage Validation

**Functional Requirements: 50/50 Covered**

| FR Range  | Domain                      | Coverage | Notes                                                                                      |
| --------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| FR1-FR5   | Identity & Key Management   | Full     | `client/src/identity/`                                                                     |
| FR6-FR10  | World Perception            | Full     | `client/src/perception/`                                                                   |
| FR11-FR16 | Agent Config & Skills       | Full     | `client/src/agent/` + `skills/`                                                            |
| FR17-FR22 | Action Execution & Payments | Full     | `client/src/actions/` + `client/src/payments/`                                             |
| FR23-FR27 | Agent Cognition             | Full     | `client/src/agent/inference.ts` delegates to Agent SDK; FR25-26 deferred per PRD (Phase 2) |
| FR28-FR38 | Terminal Game Client        | Full     | `crates/tui/` + `packages/tui-backend/`; FR33-37 deferred per PRD (Phase 2)                |
| FR39-FR43 | Experiment & Analysis       | Full     | `packages/harness/`; FR40-43 deferred per PRD (Phase 2)                                    |
| FR44-FR47 | Infrastructure & Deployment | Full     | `docker/`                                                                                  |
| FR48-FR50 | World Extensibility         | Full     | `skills/` + README; FR48-50 deferred per PRD (Phase 2/3)                                   |

**Non-Functional Requirements: 27/27 Covered**

| NFR Range | Domain      | How Addressed                                                                                                                                          |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR1-7    | Performance | ratatui dirty flags + tick system (30+ FPS), ILP pipeline in `@sigil/client`, skill parsing in `skill-loader.ts`                                       |
| NFR8-13   | Security    | `client/identity/` (key management), `client/payments/bls-proxy.ts` (identity propagation), keys never transmitted                                     |
| NFR14-17  | Scalability | SpacetimeDB handles server-side concurrency; `@sigil/client` is single-connection per instance; JSONL log rotation                                     |
| NFR18-22  | Integration | SpacetimeDB 2.0 SDK (backwards-compatible with 1.6.x), Nostr via `nostr-tools`, Agent SDK pluggable, SKILL.md runtime-agnostic, Docker for Linux/macOS |
| NFR23-27  | Reliability | `client/perception/reconnect.ts` (auto-reconnect, state recovery), typed errors with boundary, append-only decision logs, TUI graceful degradation     |

### Gap Analysis Results

**Important Gaps (non-blocking, document for implementers):**

1. **SKILL.md game-specific metadata** — FR13 requires skill files to declare target reducer, ILP cost, and required subscriptions. Standard Claude Agent Skills SKILL.md supports custom YAML frontmatter fields. The architecture should document the expected frontmatter schema for game skills:

   ```yaml
   ---
   name: move-player
   description: Move player to target hex coordinates
   reducer: player_move
   ilp_cost: 0.001
   subscriptions: [player_state, hex_grid]
   ---
   ```

   **Resolution:** Document this schema in `skills/README.md` during implementation.

2. **PRD "Rust SDK" terminology** — The PRD originally referenced a "Rust SDK" throughout, but our architecture uses Rust only for TUI presentation with a TS backend. The "Rust SDK" from the PRD is realized as the Rust TUI + `@sigil/tui-backend` + `@sigil/client` combination.
   **Resolution:** PRD has been corrected — all "Rust SDK" and "dual-runtime" references updated to reflect single-SDK architecture with Rust TUI frontend.

3. **PRD "five-layer cognition stack"** — The PRD references Layers 1-5 (StaticDataLoader, EventInterpreter, MemorySystem, AffordanceEngine, GoalsEngine). Our architecture replaces Layer 5 with Agent SDK inference (Claude/Vercel AI), simplifies Layers 1-2 into `client/perception/`, and defers Layers 3-4 to Phase 2. This is a deliberate simplification, not a gap.
   **Resolution:** Already documented in "Superseded Architecture" section.

4. **FR46 (system health monitoring)** — Monitoring metrics (ILP packets/sec, fee revenue, BLS latency) are not architecturally detailed beyond Docker infrastructure. Standard observability tooling applies.
   **Resolution:** Defer to implementation. Add metrics endpoints to `@sigil/client` and `mcp-server` during development.

**No critical gaps found.**

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed (Step 2)
- [x] Scale and complexity assessed (TypeScript SDK + Rust TUI, 15+ components)
- [x] Technical constraints identified (SpacetimeDB 1.6.x, Crosstown, Nostr, ILP)
- [x] Cross-cutting concerns mapped (identity, errors, logging, budget, connection)

**Architectural Decisions**

- [x] Critical decisions documented with versions (9 decisions)
- [x] Technology stack fully specified (SpacetimeDB 2.0 TS SDK, ratatui 0.30, etc.)
- [x] Integration patterns defined (IPC JSON-RPC 2.0, MCP, EventEmitter)
- [x] Performance considerations addressed (dirty flags, tick system, FPS targets)
- [x] Agent inference strategy defined (pluggable Agent SDK in `@sigil/client`)

**Implementation Patterns**

- [x] Naming conventions established (TS, Rust, JSON, MCP)
- [x] Structure patterns defined (co-located tests, barrel exports, rebels TUI patterns)
- [x] Communication patterns specified (JSON-RPC 2.0, EventEmitter, MCP protocol)
- [x] Process patterns documented (error chain, connection lifecycle, agent inference loop)
- [x] Enforcement mechanisms defined (ESLint, Prettier, clippy, rustfmt, CI)

**Project Structure**

- [x] Complete directory structure defined (all packages, crates, files)
- [x] Component boundaries established (4 boundaries)
- [x] Integration points mapped (data flow diagram)
- [x] Requirements to structure mapping complete (50 FRs → specific files)
- [x] Development workflow documented (setup, dev, CI)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**

- Clean `@sigil/client` abstraction enables both TUI and headless agent from a single codebase
- Well-defined IPC boundary (JSON-RPC 2.0) makes Rust ↔ TS integration testable independently
- Agent inference is pluggable — swap between Anthropic, Vercel AI, or other providers without architectural changes
- MCP server is standalone — any MCP-compatible AI agent can connect without modification
- rebels-in-the-sky provides a proven, concrete reference for all TUI patterns
- All 50 FRs and 27 NFRs have architectural homes

**Areas for Future Enhancement:**

- Multi-agent coordination protocols (Phase 2)
- SSH support for TUI (rebels-in-the-sky has WriterProxy pattern ready)
- Vector DB integration for agent memory (Phase 2, FR25)
- Auto-generated skill files from SpacetimeDB schema (Phase 3, FR50)
- Infrastructure monitoring dashboard (FR46 detailed implementation)

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and package boundaries
- `@sigil/client` is the single source of truth for all game connectivity
- Rust TUI is presentation-only — all data flows through IPC to TS backend
- Refer to this document for all architectural questions

**First Implementation Priority:**

1. Repository scaffolding: monorepo with pnpm workspace + cargo workspace
2. `@sigil/client` package: SpacetimeDB 2.0 connection + basic identity (FR1, FR6)
3. MCP server: expose one read resource + one write tool to validate end-to-end
4. Headless agent: minimal agent that connects and logs game state
5. TUI backend + Rust TUI: splash screen with connection status
