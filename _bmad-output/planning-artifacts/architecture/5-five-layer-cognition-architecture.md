# 5. Five-Layer Cognition Architecture

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

## 5.1 Plugin Interface Contract

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

## 5.2 Layer Interfaces

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
