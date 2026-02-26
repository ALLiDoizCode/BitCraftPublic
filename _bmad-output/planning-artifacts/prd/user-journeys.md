# User Journeys

## Journey 1: Dr. Priya Sharma — AI Researcher, First Experiment

**Situation:** Priya is a computational social scientist studying emergent cooperation in resource-constrained environments. She's frustrated with existing multi-agent benchmarks — too simple (grid worlds) or too artificial (no real economic stakes).

**Opening Scene:** Priya finds the [SDK] on GitHub. She reads the README: "Define your agent in markdown. No code required." She's skeptical — her last "no-code" tool required 200 lines of YAML and a PhD in DevOps.

**Rising Action:** She clones the repo, runs `docker compose up` to start a local game server and Crosstown node, and generates a Nostr keypair. She opens the example `Agent.md`: names her agent "Gatherer-01," sets its personality to "cautious resource optimizer," and selects gathering and trading skills. Each skill file maps a game action to a reducer, lists its ILP cost, and describes what table subscriptions it needs to observe outcomes. She picks 8 skills.

She runs `npm start` with her Agent.md. The SDK connects to SpacetimeDB (table subscriptions), subscribes to Crosstown's relay (event confirmations), and begins sending ILP packets for game actions. Her terminal shows: "Gatherer-01 has entered the world. Observing nearby resources..." Within minutes, the agent is harvesting stone, checking prices, and deciding whether to trade or stockpile.

**Climax:** Priya launches a second agent ("Trader-02") with a different Agent.md — this one prioritizes social interaction and arbitrage. Both agents compete for resources, react to each other's price signals, and adapt strategies. The decision log (JSONL) captures every observation, deliberation, and action with costs. She exports the logs into her analysis notebook. Clean, structured, ready for her cooperation metrics.

**Resolution:** She swaps the GoalsSimple planner for GoalsLLM with Claude, reruns the experiment, and compares decision patterns. Her lab publishes a paper on "Emergent Resource Cooperation Under Real Economic Constraints." She never wrote a line of TypeScript.

**Requirements revealed:** Declarative skill parser, Agent.md configuration, decision logger (JSONL), SpacetimeDB read client, Crosstown read/write clients, Docker dev environment, multi-agent launcher, LLM backend swapping.

## Journey 2: Marcus Chen — Terminal Player, First Session

**Situation:** Marcus is a senior DevOps engineer who lives in the terminal. He misses the depth of MMOs but can't stand leaving his tmux setup.

**Opening Scene:** Marcus installs the [TUI] client via `cargo install [tui-crate]`. He generates a Nostr keypair and launches with his server and key. A ratatui interface fills his terminal — hex-grid map on the left, chat and status panels on the right, inventory below. Other players move on the map. A real MMO, in his terminal.

**Rising Action:** Keyboard shortcuts move his character across the hex grid. The map renders terrain, resources, and players in Unicode/color. He finds a forest, harvests wood (a fraction of a cent via ILP), opens the crafting panel, crafts a basic tool. Chat messages scroll by. He joins an empire, accepts a quest, heads to a contested hex.

Every action is responsive — event-driven architecture (multi-source event loop, tick scheduling at 30+ FPS) keeps the UI smooth. SpacetimeDB table subscriptions push world updates in real-time. He's playing over SSH from his server rack and it works perfectly.

**Climax:** Marcus encounters another player at a resource node. They negotiate in chat, agree to split the hex, set up a trade route. He's managing inventory, monitoring empire politics, crafting equipment, and chatting — all from keyboard shortcuts. Three hours in, he hasn't touched a GUI.

**Resolution:** Marcus plays nightly from his terminal. tmux layout: [TUI] in one pane, monitoring dashboards in another. The game fits his workflow. He tells his engineering friends. They SSH into a shared server and play together.

**Requirements revealed:** Rust ratatui TUI client (hex map, chat, inventory, crafting, status panels), TypeScript TUI backend (`@sigil/tui-backend` wrapping `@sigil/client`), keyboard-driven input, real-time SpacetimeDB subscriptions via TypeScript backend, Nostr keypair identity, ILP wallet integration, 30+ FPS rendering, SSH-compatible, event-driven architecture, JSON-RPC IPC between Rust frontend and TypeScript backend.

## Journey 3: Anika Patel — Game Developer, New SpacetimeDB World

**Situation:** Anika published "StarForge," a SpacetimeDB space trading game with 40 reducers. She wants AI agents and terminal players in her world without building an agent framework or TUI from scratch.

**Opening Scene:** Anika discovers the [SDK] — world-agnostic, targets SpacetimeDB's public surface. To make StarForge accessible, she writes skill definition files for her reducers and maps table subscriptions for world observation.

**Rising Action:** She creates `starforge/skills/` and writes skill files: `mine_asteroid.md`, `create_trade.md`, `build_station.md`. Each specifies reducer name, parameters, ILP cost, required table subscriptions, and natural-language description. She writes a starter `Agent.md` template for a "cautious miner" persona. She registers her game's Crosstown BLS handler and publishes the skill definitions.

**Climax:** A researcher finds StarForge's skill definitions. Without any SDK code changes, they point their agent at Anika's server, load StarForge skills, and launch. The agent mines asteroids and trades commodities. A terminal player loads StarForge's UI configuration and plays from their terminal. Zero SDK code written by Anika.

**Resolution:** StarForge gains AI researchers using it as a testbed. ILP fees flow through her Crosstown node, funding continued development.

**Requirements revealed:** World-agnostic skill file format, skill authoring guide, Crosstown BLS handler registration, community skill marketplace (growth), game-specific TUI configuration.

## Journey 4: Jonathan — Infrastructure Operator, Running the Platform

**Situation:** Jonathan runs the game server deployment and Crosstown node infrastructure. Every game action routes through his nodes as ILP packets.

**Opening Scene:** Jonathan deploys: game server in Docker, Crosstown node configured with ILP fee schedules. The BLS handler validates ILP packets, extracts Nostr public keys, propagates identity to SpacetimeDB reducers, and collects fees.

**Rising Action:** Agents come online. Research labs run 10 concurrent agents. Players join nightly. Each action — harvest, trade, movement, chat — is an ILP packet. He monitors packets per second, fee revenue, BLS validation latency, identity propagation success rate. He adjusts fee schedules by action type.

**Climax:** A research team launches a 50-agent experiment. Traffic spikes. Crosstown nodes handle the load — SpacetimeDB handles game state and Crosstown handles payment routing independently. Fee revenue from one experiment covers monthly infrastructure costs.

**Resolution:** The SDK is open source. The infrastructure — Crosstown nodes, fee collection, identity propagation — is the moat. More worlds come online, more ILP traffic, revenue grows with adoption.

**Requirements revealed:** Docker deployment, Crosstown node configuration, ILP fee schedule management, BLS identity propagation handler, monitoring/observability, scalability, fee revenue tracking.

## Journey Requirements Summary

| Capability Area                               | Journeys        |
| --------------------------------------------- | --------------- |
| Declarative skill files + Agent.md parser     | Priya, Anika    |
| SpacetimeDB read client (table subscriptions) | All             |
| Crosstown relay subscriptions (read path)     | All             |
| Crosstown/ILP write client                    | All             |
| Nostr keypair identity (no passwords)         | All             |
| BLS identity propagation to SpacetimeDB       | All             |
| Decision logger (JSONL)                       | Priya           |
| Multi-agent launcher                          | Priya           |
| LLM backend swapping                          | Priya           |
| ratatui TUI client (hex map, panels, input)   | Marcus          |
| 30+ FPS event-driven rendering                | Marcus          |
| SSH-compatible terminal play                  | Marcus          |
| World-agnostic skill file format              | Anika           |
| Crosstown BLS handler registration            | Anika, Jonathan |
| Docker deployment (game server)               | Jonathan, Priya |
| ILP fee schedule configuration                | Jonathan        |
| Monitoring/observability                      | Jonathan        |
| Scalability under multi-agent load            | Jonathan        |
