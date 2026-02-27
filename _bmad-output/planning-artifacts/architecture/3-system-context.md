# 3. System Context

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

## 3.1 Boundary Definitions

| Component           | Owner                                       | Modifiable?                   | Purpose                                 |
| ------------------- | ------------------------------------------- | ----------------------------- | --------------------------------------- |
| **Agent SDK**       | Us (new repo)                               | Yes                           | Cognition framework, experiment harness |
| **BitCraft Server** | Clockwork Labs (Apache 2.0 fork)            | No — run unmodified in Docker | Game logic, state, reducers             |
| **Crosstown Node**  | Existing project (`~/Documents/crosstown/`) | No — consume as dependency    | ILP payment gateway, Nostr relay        |
| **SpacetimeDB**     | Clockwork Labs (open source)                | No — use SDK                  | Real-time database, subscriptions       |

---
