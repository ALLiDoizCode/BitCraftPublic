# Domain-Specific Requirements

## Scientific Research Domain

- **Reproducibility:** Experiment harness supports snapshot/restore of world state, deterministic agent configurations (same Agent.md + same world state = comparable runs), versioned skill definitions. Decision logs capture enough context to reproduce any individual decision.
- **Validation methodology:** Structured JSONL decision logs with timestamps, world state snapshots, costs incurred, and outcomes observed. Comparative analysis tooling for A/B experiments across LLM backends, agent configurations, or skill sets.
- **Accuracy:** Agent perception (table subscriptions) faithfully represents actual world state — no stale reads, no missed events. Event ordering guarantees matter for research validity.
- **Computational resources:** LLM API costs (per-token), ILP transaction costs (per-action), and concurrent agent scaling all compound. Cost tracking and budget controls are research necessities.

## Cryptographic Identity & Payment Domain

- **Key management:** Nostr keypair generation, secure storage, and recovery paths. No username/password fallback — key loss means identity loss.
- **Payment security:** ILP packets signed by the authoring Nostr key. BLS validates signature before executing any reducer call. Fee schedules transparent and verifiable.
- **Identity propagation:** BLS cryptographically proves the authoring Nostr public key to SpacetimeDB on every reducer call. SpacetimeDB attributes actions to the correct player entity based on Nostr public key, not BLS sender identity. Novel integration — no off-the-shelf solution exists.
- **Wallet management:** Users fund ILP wallets, track balances, and see cost-per-action before execution. Both AI agents and TUI players need balance awareness.

## Real-Time Systems Domain

- **SpacetimeDB subscriptions:** Table subscription latency directly affects agent perception quality and TUI responsiveness. Reconnection and state recovery after disconnects handled gracefully.
- **TUI rendering:** 30+ FPS in a standard terminal with hex-grid map, multiple panels, and real-time updates. Event-driven architecture (not polling). Must work over SSH with variable latency.
- **Event ordering:** Concurrent reducer calls deliver consistent table updates. SpacetimeDB provides this at the database level; the SDK must not introduce ordering bugs.

## Licensing & Naming

- **BitCraft Server:** Apache 2.0 licensed fork, run unmodified. Our product — SDK, TUI client, platform brand — must have its own independent name.
- **SDK licensing:** Open-source (license TBD — MIT, Apache 2.0, or AGPL for infrastructure moat). License choice affects community adoption vs. competitive protection.
- **Third-party dependencies:** SpacetimeDB SDK, Nostr client libraries, ILP/Crosstown libraries, ratatui — all must have compatible licenses.
