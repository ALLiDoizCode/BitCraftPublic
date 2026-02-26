# 12. Phased Implementation Plan

## Phase 1: Game Access Layer (Weeks 1–2)

**Goal:** An agent can move a character by paying ILP tokens.

| Task | Description |
|------|-------------|
| Docker image | Build BitCraft server from source, publish to local SpacetimeDB |
| SpacetimeDB client wrapper | Connect, subscribe, receive table updates |
| CrosstownClient wrapper | Initialize, publish game action events (kind 30078) |
| BLS game action handler | New callback in Crosstown: kind 30078 → parse reducer + args → call SpacetimeDB |
| Action cost registry | JSON config loader |
| Integration test | `player_move` reducer called via ILP payment, character moves |

**Exit Criteria:** HTTP request with valid ILP receipt calls `player_move`; SpacetimeDB subscription confirms character position changed.

## Phase 2: Cognition Plugin Framework (Weeks 3–4)

**Goal:** An agent with reference plugins can observe the world and make decisions.

| Task | Description |
|------|-------------|
| Plugin interface definitions | `CognitionPlugin<T>` base + all 5 layer interfaces |
| Layer 1: StaticDataLoader | Load `*_desc` tables at startup, build lookup maps |
| Layer 2: Narrator | Subscribe callbacks → `SemanticEvent[]` |
| Layer 4: AffordanceEngine | Nearby entity detection + cost annotation |
| Layer 5: GoalsSimple | Priority queue planner (no LLM) |
| Agent core loop | Integrate all layers, tick-based execution |
| Decision logger | JSONL output of every tick |

**Exit Criteria:** Agent autonomously explores world using priority-queue planner for 10 minutes; decision log captures all ticks.

## Phase 3: Experiment Harness (Weeks 5–6)

**Goal:** A researcher can run comparative experiments with different configurations.

| Task | Description |
|------|-------------|
| Experiment config loader | YAML → typed config |
| Multi-agent launcher | Spawn N agents with different plugin configs |
| Layer 3: MemoryBasic | In-memory + JSON file persistence with serialize/deserialize |
| Layer 5: GoalsLLM | LLM-powered decision-making (OpenAI + Anthropic adapters) |
| Snapshot/restore | SpacetimeDB state + agent plugin states |
| Analysis tools | Decision log → metrics (area explored, budget efficiency, etc.) |
| CLI | `npx @bitcraft-ai/harness run experiment.yaml` |

**Exit Criteria:** Two agents with different LLM backends run for 1 hour; comparative analysis report generated.

## Phase 4: Polish & Advanced Features (Weeks 7–8)

| Task | Description |
|------|-------------|
| Layer 3: MemoryVector | Vector DB integration for semantic search |
| Example agents | Explorer, gatherer, trader with tuned configs |
| Documentation | Setup guide, plugin authoring guide, experiment guide |
| Performance tuning | Tick interval optimization, subscription filtering |
| Multi-agent interaction | Agent-to-agent trading, chat, combat |

---
