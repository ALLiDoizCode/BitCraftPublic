# 2. Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Observable** | Every agent perception, decision, and action must be loggable and replayable |
| **Reproducible** | Snapshot game + agent state; rerun experiments from the same starting conditions |
| **Pluggable** | Swap LLM backends, cognition strategies, and memory implementations independently |
| **Unmodified BitCraft** | Zero changes to the BitCraft server — it runs vanilla in Docker |
| **ILP is Crosstown's Problem** | The Agent SDK publishes Nostr events via `@crosstown/client`; payment validation is out of scope |
| **TypeScript First** | Native compatibility with SpacetimeDB TS SDK and Crosstown; researchers can hack on it quickly |

---
