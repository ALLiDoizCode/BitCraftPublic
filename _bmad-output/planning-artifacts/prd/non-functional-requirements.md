# Non-Functional Requirements

## Performance

- **NFR1:** TUI client renders at 30+ FPS in a 160x48 terminal viewport with hex map, status panels, and chat visible simultaneously
- **NFR2:** TUI client remains responsive (< 50ms input-to-render latency) over SSH connections with up to 200ms network latency
- **NFR3:** ILP packet round-trip (SDK sends → Crosstown routes → BLS executes reducer → confirmation received) completes within 2 seconds under normal load
- **NFR4:** Agent decision cycle (observe → interpret → decide → act) completes within 5 seconds for MCP-based agents, within 30 seconds for LLM-powered agents
- **NFR5:** SpacetimeDB table subscription updates reflected in agent state and TUI display within 500ms of database commit
- **NFR6:** Static data loading (all `*_desc` tables) completes within 10 seconds on first connection
- **NFR7:** Skill file parsing and Agent.md validation completes within 1 second for up to 50 skills

## Security

- **NFR8:** All ILP packets signed with the user's Nostr private key; unsigned or incorrectly signed packets rejected by BLS before reducer execution
- **NFR9:** Nostr private keys never transmitted over the network; only public keys and signatures leave the local system
- **NFR10:** BLS validates identity on every reducer call — no reducer executes without verified Nostr public key attribution
- **NFR11:** Nostr private keys stored encrypted at rest on the local filesystem with user-provided passphrase protection
- **NFR12:** ILP fee schedules publicly verifiable; users can audit the fee for any action before executing it
- **NFR13:** No game action attributed to a Nostr public key without a valid cryptographic signature from the corresponding private key

## Scalability

- **NFR14:** A single Crosstown node supports at least 10 concurrent agents and 5 concurrent TUI players at MVP, scaling to 50+ agents at Phase 2
- **NFR15:** SpacetimeDB subscriptions remain performant with up to 50 concurrent connected clients on a single game server instance
- **NFR16:** Decision log file size remains manageable: JSONL rotation or archival when logs exceed 100MB per agent
- **NFR17:** ILP fee collection maintains accurate accounting under concurrent multi-agent load with no lost or double-counted transactions

## Integration

- **NFR18:** `@sigil/client` uses SpacetimeDB 2.0 TypeScript client SDK (backwards-compatible with 1.6.x server modules). The Rust TUI has no direct SpacetimeDB dependency — it connects via the TypeScript backend.
- **NFR19:** `@sigil/client` connects to any standard Nostr relay implementing NIP-01; Crosstown's built-in relay is the default
- **NFR20:** LLM integration (Phase 2) supports any provider exposing an OpenAI-compatible chat completions API
- **NFR21:** Skill file format is consumed by `@sigil/client` and exposed to all frontends (MCP server, TUI backend) uniformly
- **NFR22:** Docker compose dev environment runs on Linux and macOS with no platform-specific configuration

## Reliability

- **NFR23:** SpacetimeDB subscription automatically reconnects within 10 seconds after connection loss, with full state recovery
- **NFR24:** Failed ILP packets (network timeout, insufficient balance) return clear error codes and do not leave the system in an inconsistent state
- **NFR25:** Agent state persists across SDK restarts: decision logs are append-only, agent configuration is stateless (re-read from Agent.md on startup)
- **NFR26:** TUI client handles SpacetimeDB disconnection gracefully: displays connection status, buffers user input, resumes on reconnection
- **NFR27:** BLS identity propagation has zero silent failures: every reducer call either succeeds with verified identity or fails with an explicit error
