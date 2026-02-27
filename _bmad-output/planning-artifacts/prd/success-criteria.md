# Success Criteria

## User Success

**AI Researcher:** Defines an agent entirely through `Agent.md` and skill files — zero TypeScript or Rust code. Deploys it against a BitCraft world. Watches it make autonomous economic decisions. Exports a structured decision log. Swaps the LLM backend and reruns the same experiment. Total time from "I have an idea" to "agent is playing": under 30 minutes.

**Terminal Player:** Launches the ratatui TUI client, connects to a game server, and plays the full game from a terminal — movement, combat, crafting, building, trading, chat, empire management. No graphical client needed. Responsive at 30+ FPS. Playable over SSH.

**Game Developer:** Publishes a new SpacetimeDB game. Writes skill definitions for its public reducers and table subscriptions. AI agents and TUI players can inhabit the new world without any SDK code changes.

## Business Success

**Revenue model:** ILP micropayment fees collected on every game action routed through Crosstown nodes. Every reducer call from every agent and TUI player generates fee revenue. The SDK is open source; the infrastructure is the moat.

**3-month target:** At least 10 concurrent AI agents running sustained experiments against BitCraft, generating measurable ILP traffic through Crosstown infrastructure.

**12-month target:** Multiple SpacetimeDB worlds supported. Community-contributed skill definitions and `Agent.md` templates. Fee revenue covers infrastructure costs with margin.

**Growth flywheel:** Open-source SDK drives adoption → more agents and players → more ILP traffic → more fee revenue → reinvest in SDK quality → more adoption.

## Technical Success

- `@sigil/client` connects to SpacetimeDB for reads and routes writes as ILP packets through Crosstown — no direct reducer calls. Both the MCP server and TUI backend consume this single client.
- `@sigil/client` subscribes to Crosstown's built-in Nostr relay for event confirmations (read path) and uses Crosstown's ILP connector for game actions (write path)
- Nostr public key is the sole identity mechanism — no usernames or passwords
- BLS propagates the authoring Nostr public key to SpacetimeDB on every reducer call
- SpacetimeDB game logic credits the correct player entity based on Nostr public key
- Identity ownership is cryptographically verifiable end-to-end (signed ILP packet → BLS verification → reducer attribution)
- Declarative skill files correctly map to 100% of BitCraft's public reducers and key table subscriptions
- TUI client renders the full BitCraft hex-grid world in real-time at 30+ FPS in a standard terminal
- Experiment harness supports snapshot/restore and comparative analysis across LLM backends
- All game actions route through Crosstown nodes with ILP fee collection

## Measurable Outcomes

| Metric                         | MVP Target                                   | Growth Target                |
| ------------------------------ | -------------------------------------------- | ---------------------------- |
| Agent setup time (no code)     | < 30 min                                     | < 5 min                      |
| Reducers accessible via skills | Top 20 (movement, combat, crafting, trading) | 100% of public reducers      |
| TUI game coverage              | Movement, map, chat, inventory               | Full BitCraft feature parity |
| Concurrent agents supported    | 2                                            | 50+                          |
| ILP fee collection             | Functional                                   | Profitable                   |
| SpacetimeDB worlds supported   | 1 (BitCraft)                                 | 3+                           |
