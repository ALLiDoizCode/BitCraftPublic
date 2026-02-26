# Functional Requirements

## Identity & Key Management

- **FR1:** Users can generate a new Nostr keypair for use as their sole identity across all SDK interactions
- **FR2:** Users can import an existing Nostr keypair from a file or seed phrase
- **FR3:** Users can export their Nostr keypair for backup and recovery
- **FR4:** The system attributes every game action to the authoring Nostr public key via BLS identity propagation to SpacetimeDB
- **FR5:** Users can verify their identity ownership is cryptographically intact end-to-end (signed ILP packet → BLS verification → reducer attribution)

## World Perception

- **FR6:** All consumers of `@sigil/client` (MCP server, TUI backend) can subscribe to SpacetimeDB table updates in real-time via WebSocket
- **FR7:** All consumers of `@sigil/client` can subscribe to Crosstown relay events (via its built-in Nostr relay) for action confirmations and system notifications
- **FR8:** Agents can load static data tables (`*_desc` tables) and build queryable lookup maps (StaticDataLoader)
- **FR9:** Agents can receive raw table update events and interpret them as semantic narratives (EventInterpreter)
- **FR10:** The system automatically reconnects and recovers subscription state after disconnections

## Agent Configuration & Skills

- **FR11:** Researchers can define agent behavior entirely through an `Agent.md` configuration file with zero application code
- **FR12:** Researchers can select which skills an agent uses by referencing skill files in Agent.md
- **FR13:** Skill files can declare the target reducer, parameters, ILP cost, required table subscriptions, and natural-language usage guidance
- **FR14:** The system validates Agent.md and skill files against the connected SpacetimeDB module's available reducers and tables
- **FR15:** Researchers can set budget limits per agent in Agent.md to cap ILP spending
- **FR16:** Researchers can configure which LLM backend an agent uses in Agent.md (Phase 2)

## Action Execution & Payments

- **FR17:** All consumers of `@sigil/client` can execute game actions by sending signed ILP packets through the Crosstown connector (via `client.publish()`)
- **FR18:** The system constructs ILP packets containing the game action, signs them with the user's Nostr key, and routes them through the Crosstown node
- **FR19:** The BLS handler receives ILP packets, validates signatures, extracts the Nostr public key and game action, and calls the corresponding SpacetimeDB reducer with identity propagation
- **FR20:** The system collects ILP fees on every routed game action
- **FR21:** Users can query their current ILP wallet balance
- **FR22:** Users can view the cost of any action before executing it via the action cost registry

## Agent Cognition

- **FR23:** Agents can make autonomous decisions using MCP tools for game perception and action execution
- **FR24:** Agents can make autonomous decisions using LLM-powered reasoning with configurable providers (Phase 2)
- **FR25:** Agents can maintain persistent memory across sessions (Phase 2)
- **FR26:** Agents can detect available actions and estimate cost/reward for each (AffordanceEngine — Phase 2)
- **FR27:** Researchers can swap agent behavior by editing Agent.md and skill files without code changes

## Terminal Game Client (TUI)

- **FR28:** Players can view the game world as a rendered hex-grid map with terrain, resources, and other players in their terminal
- **FR29:** Players can move their character across the hex grid using keyboard controls
- **FR30:** Players can send and receive chat messages with other players
- **FR31:** Players can view and manage their inventory
- **FR32:** Players can view their character status (health, position, skills, empire membership)
- **FR33:** Players can engage in combat with game entities and other players (Phase 2)
- **FR34:** Players can craft items using recipes and gathered resources (Phase 2)
- **FR35:** Players can construct and manage buildings on claimed territory (Phase 2)
- **FR36:** Players can create and respond to trade offers with other players (Phase 2)
- **FR37:** Players can participate in empire management (join, create, govern, diplomacy) (Phase 2)
- **FR38:** The TUI renders at 30+ FPS and works over SSH connections

## Experiment & Analysis

- **FR39:** Agents produce structured decision logs (JSONL) capturing observations, deliberations, actions, costs, and outcomes with timestamps
- **FR40:** Researchers can run multiple agents concurrently against the same world (Phase 2)
- **FR41:** Researchers can configure and launch experiments from YAML configuration files (Phase 2)
- **FR42:** Researchers can snapshot and restore world state for reproducible experiments (Phase 2)
- **FR43:** Researchers can compare decision logs across experiment runs with different agent configurations or LLM backends (Phase 2)

## Infrastructure & Deployment

- **FR44:** Operators can deploy a local development environment (game server + Crosstown node) via Docker compose
- **FR45:** Operators can configure ILP fee schedules for different action types
- **FR46:** Operators can monitor system health: ILP packets per second, fee revenue, BLS validation latency, SpacetimeDB load, identity propagation success rate
- **FR47:** The BLS game action handler maps incoming ILP packets to the correct SpacetimeDB reducers with identity propagation

## World Extensibility

- **FR48:** Game developers can make a new SpacetimeDB world agent-accessible by writing skill files for its public reducers and table subscriptions — no SDK code changes required (Phase 2)
- **FR49:** Game developers can register a Crosstown BLS handler for their SpacetimeDB module's reducers (Phase 2)
- **FR50:** The system can auto-generate skeleton skill files from a SpacetimeDB module's published schema (Phase 3)
