# 10. Project Structure

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
