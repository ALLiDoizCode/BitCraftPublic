---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
documentsIncluded:
  prd: prd/ (sharded, 11 files)
  architecture: architecture/ (sharded, 23 files)
  epics: epics.md (whole)
  ux: ux-design-specification.md (whole)
---

# Implementation Readiness Assessment Report

**Date:** 2026-02-26
**Project:** BitCraftPublic

## 1. Document Inventory

| Document | Format | Location | Files |
|---|---|---|---|
| PRD | Sharded | `prd/` | 11 files (index + 10 sections) |
| Architecture | Sharded | `architecture/` | 23 files (index + 22 sections) |
| Epics & Stories | Whole | `epics.md` | 1 file (94KB) |
| UX Design | Whole | `ux-design-specification.md` | 1 file (48KB) |

**Notes:**
- Archive folder contains pre-shard whole versions of PRD and Architecture (no conflicts)
- All 4 required document types present

## 2. PRD Analysis

### Functional Requirements

**Identity & Key Management (FR1-FR5)**
- FR1: Users can generate a new Nostr keypair for use as their sole identity across all SDK interactions
- FR2: Users can import an existing Nostr keypair from a file or seed phrase
- FR3: Users can export their Nostr keypair for backup and recovery
- FR4: The system attributes every game action to the authoring Nostr public key via BLS identity propagation to SpacetimeDB
- FR5: Users can verify their identity ownership is cryptographically intact end-to-end (signed ILP packet → BLS verification → reducer attribution)

**World Perception (FR6-FR10)**
- FR6: All consumers of `@sigil/client` can subscribe to SpacetimeDB table updates in real-time via WebSocket
- FR7: All consumers of `@sigil/client` can subscribe to Crosstown relay events (via its built-in Nostr relay) for action confirmations and system notifications
- FR8: Agents can load static data tables (`*_desc` tables) and build queryable lookup maps (Layer 1: StaticDataLoader)
- FR9: Agents can receive raw table update events and interpret them as semantic narratives (Layer 2: EventInterpreter)
- FR10: The system automatically reconnects and recovers subscription state after disconnections

**Agent Configuration & Skills (FR11-FR16)**
- FR11: Researchers can define agent behavior entirely through an `Agent.md` configuration file with zero application code
- FR12: Researchers can select which skills an agent uses by referencing skill files in Agent.md
- FR13: Skill files can declare the target reducer, parameters, ILP cost, required table subscriptions, and natural-language usage guidance
- FR14: The system validates Agent.md and skill files against the connected SpacetimeDB module's available reducers and tables
- FR15: Researchers can set budget limits per agent in Agent.md to cap ILP spending
- FR16: Researchers can configure which LLM backend an agent uses in Agent.md (Phase 2)

**Action Execution & Payments (FR17-FR22)**
- FR17: All consumers of `@sigil/client` can execute game actions by sending signed ILP packets through the Crosstown connector (via `client.publish()`)
- FR18: The system constructs ILP packets containing the game action, signs them with the user's Nostr key, and routes them through the Crosstown node
- FR19: The BLS handler receives ILP packets, validates signatures, extracts the Nostr public key and game action, and calls the corresponding SpacetimeDB reducer with identity propagation
- FR20: The system collects ILP fees on every routed game action
- FR21: Users can query their current ILP wallet balance
- FR22: Users can view the cost of any action before executing it via the action cost registry

**Agent Cognition (FR23-FR27)**
- FR23: Agents can make autonomous decisions using a rule-based priority queue planner (Layer 5: GoalsSimple)
- FR24: Agents can make autonomous decisions using LLM-powered reasoning with configurable providers (Layer 5: GoalsLLM — Phase 2)
- FR25: Agents can maintain persistent memory across sessions (Layer 3: MemorySystem — Phase 2)
- FR26: Agents can detect available actions and estimate cost/reward for each (Layer 4: AffordanceEngine — Phase 2)
- FR27: Researchers can swap individual cognition layers independently without affecting other layers

**Terminal Game Client — TUI (FR28-FR38)**
- FR28: Players can view the game world as a rendered hex-grid map with terrain, resources, and other players in their terminal
- FR29: Players can move their character across the hex grid using keyboard controls
- FR30: Players can send and receive chat messages with other players
- FR31: Players can view and manage their inventory
- FR32: Players can view their character status (health, position, skills, empire membership)
- FR33: Players can engage in combat with game entities and other players (Phase 2)
- FR34: Players can craft items using recipes and gathered resources (Phase 2)
- FR35: Players can construct and manage buildings on claimed territory (Phase 2)
- FR36: Players can create and respond to trade offers with other players (Phase 2)
- FR37: Players can participate in empire management (join, create, govern, diplomacy) (Phase 2)
- FR38: The TUI renders at 30+ FPS and works over SSH connections

**Experiment & Analysis (FR39-FR43)**
- FR39: Agents produce structured decision logs (JSONL) capturing observations, deliberations, actions, costs, and outcomes with timestamps
- FR40: Researchers can run multiple agents concurrently against the same world (Phase 2)
- FR41: Researchers can configure and launch experiments from YAML configuration files (Phase 2)
- FR42: Researchers can snapshot and restore world state for reproducible experiments (Phase 2)
- FR43: Researchers can compare decision logs across experiment runs with different agent configurations or LLM backends (Phase 2)

**Infrastructure & Deployment (FR44-FR47)**
- FR44: Operators can deploy a local development environment (game server + Crosstown node) via Docker compose
- FR45: Operators can configure ILP fee schedules for different action types
- FR46: Operators can monitor system health: ILP packets per second, fee revenue, BLS validation latency, SpacetimeDB load, identity propagation success rate
- FR47: The BLS game action handler maps incoming ILP packets to the correct SpacetimeDB reducers with identity propagation

**World Extensibility (FR48-FR50)**
- FR48: Game developers can make a new SpacetimeDB world agent-accessible by writing skill files for its public reducers and table subscriptions — no SDK code changes required (Phase 2)
- FR49: Game developers can register a Crosstown BLS handler for their SpacetimeDB module's reducers (Phase 2)
- FR50: The system can auto-generate skeleton skill files from a SpacetimeDB module's published schema (Phase 3)

**Total FRs: 50**

### Non-Functional Requirements

**Performance (NFR1-NFR7)**
- NFR1: TUI client renders at 30+ FPS in a standard 80x24 terminal with hex map, status panels, and chat visible simultaneously
- NFR2: TUI client remains responsive (< 50ms input-to-render latency) over SSH connections with up to 200ms network latency
- NFR3: ILP packet round-trip (SDK sends → Crosstown routes → BLS executes reducer → confirmation received) completes within 2 seconds under normal load
- NFR4: Agent decision cycle (observe → interpret → decide → act) completes within 5 seconds for GoalsSimple, within 30 seconds for GoalsLLM
- NFR5: SpacetimeDB table subscription updates reflected in agent state and TUI display within 500ms of database commit
- NFR6: Static data loading (all `*_desc` tables) completes within 10 seconds on first connection
- NFR7: Skill file parsing and Agent.md validation completes within 1 second for up to 50 skills

**Security (NFR8-NFR13)**
- NFR8: All ILP packets signed with the user's Nostr private key; unsigned or incorrectly signed packets rejected by BLS before reducer execution
- NFR9: Nostr private keys never transmitted over the network; only public keys and signatures leave the local system
- NFR10: BLS validates identity on every reducer call — no reducer executes without verified Nostr public key attribution
- NFR11: Nostr private keys stored encrypted at rest on the local filesystem with user-provided passphrase protection
- NFR12: ILP fee schedules publicly verifiable; users can audit the fee for any action before executing it
- NFR13: No game action attributed to a Nostr public key without a valid cryptographic signature from the corresponding private key

**Scalability (NFR14-NFR17)**
- NFR14: A single Crosstown node supports at least 10 concurrent agents and 5 concurrent TUI players at MVP, scaling to 50+ agents at Phase 2
- NFR15: SpacetimeDB subscriptions remain performant with up to 50 concurrent connected clients on a single game server instance
- NFR16: Decision log file size remains manageable: JSONL rotation or archival when logs exceed 100MB per agent
- NFR17: ILP fee collection maintains accurate accounting under concurrent multi-agent load with no lost or double-counted transactions

**Integration (NFR18-NFR22)**
- NFR18: `@sigil/client` uses SpacetimeDB 2.0 TypeScript client SDK (backwards-compatible with 1.6.x server modules). The Rust TUI has no direct SpacetimeDB dependency — it connects via the TypeScript backend.
- NFR19: `@sigil/client` connects to any standard Nostr relay implementing NIP-01; Crosstown's built-in relay is the default
- NFR20: LLM integration (Phase 2) supports any provider exposing an OpenAI-compatible chat completions API
- NFR21: Skill file format is consumed by `@sigil/client` and exposed to all frontends (MCP server, TUI backend) uniformly
- NFR22: Docker compose dev environment runs on Linux and macOS with no platform-specific configuration

**Reliability (NFR23-NFR27)**
- NFR23: SpacetimeDB subscription automatically reconnects within 10 seconds after connection loss, with full state recovery
- NFR24: Failed ILP packets (network timeout, insufficient balance) return clear error codes and do not leave the system in an inconsistent state
- NFR25: Agent state persists across SDK restarts: decision logs are append-only, agent configuration is stateless (re-read from Agent.md on startup)
- NFR26: TUI client handles SpacetimeDB disconnection gracefully: displays connection status, buffers user input, resumes on reconnection
- NFR27: BLS identity propagation has zero silent failures: every reducer call either succeeds with verified identity or fails with an explicit error

**Total NFRs: 27**

### Additional Requirements

**Domain-Specific Constraints:**
- Reproducibility: experiment harness supports snapshot/restore, deterministic configs, versioned skill definitions
- Key management: key loss = identity loss (no password fallback); seed phrase backup required
- Payment security: ILP packets signed by Nostr key, BLS validates before execution
- Wallet management: users fund ILP wallets, track balances, see cost-per-action
- SpacetimeDB subscriptions: reconnection and state recovery after disconnects
- Event ordering: SDK must not introduce ordering bugs on top of SpacetimeDB guarantees
- Licensing: BitCraft (Apache 2.0, unmodified); SDK license TBD; dependency license audit required

**Phase Classification:**
- MVP (Phase 1): FR1-FR15, FR17-FR23, FR27-FR32, FR38-FR39, FR44-FR47 (34 FRs)
- Phase 2: FR16, FR24-FR26, FR33-FR37, FR40-FR43, FR48-FR49 (15 FRs)
- Phase 3: FR50 (1 FR)

### PRD Completeness Assessment

The PRD is well-structured and comprehensive:
- 50 Functional Requirements cleanly numbered and categorized across 9 domains
- 27 Non-Functional Requirements with specific measurable thresholds
- Clear phase assignments (MVP/Phase 2/Phase 3) for every FR
- 4 detailed user journeys covering all personas
- Risk mitigation strategy with likelihood/impact assessments
- Domain-specific requirements addressing research, crypto, and real-time concerns
- Developer tool requirements with language matrix, API surface, and code examples

## 3. Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement (summary) | Epic Coverage | Status |
|---|---|---|---|
| FR1 | Generate Nostr keypair | Epic 1, Story 1.2 | ✓ Covered |
| FR2 | Import existing Nostr keypair | Epic 1, Story 1.2 | ✓ Covered |
| FR3 | Export Nostr keypair for backup | Epic 1, Story 1.2 | ✓ Covered |
| FR4 | BLS identity propagation to SpacetimeDB | Epic 2, Story 2.3 | ✓ Covered |
| FR5 | End-to-end identity verification | Epic 2, Story 2.5 | ✓ Covered |
| FR6 | SpacetimeDB table subscriptions via WebSocket | Epic 1, Story 1.4 | ✓ Covered |
| FR7 | Crosstown relay event subscriptions | Epic 2, Story 2.1 | ✓ Covered |
| FR8 | Static data table loading (*_desc tables) | Epic 1, Story 1.5 | ✓ Covered |
| FR9 | Event interpretation as semantic narratives | Epic 3, Story 3.3 | ✓ Covered |
| FR10 | Auto-reconnection and state recovery | Epic 1, Story 1.6 | ✓ Covered |
| FR11 | Agent.md configuration (zero code) | Epic 3, Story 3.1 | ✓ Covered |
| FR12 | Skill selection via Agent.md | Epic 3, Story 3.1 | ✓ Covered |
| FR13 | Skill file format (reducer, params, cost, subscriptions) | Epic 3, Story 3.2 | ✓ Covered |
| FR14 | Validation against SpacetimeDB module | Epic 3, Story 3.4 | ✓ Covered |
| FR15 | Budget limits per agent | Epic 3, Story 3.5 | ✓ Covered |
| FR16 | LLM backend selection in Agent.md (Phase 2) | Epic 7 | ✓ Covered |
| FR17 | Execute actions via client.publish() | Epic 2, Story 2.2 | ✓ Covered |
| FR18 | ILP packet construction and signing | Epic 2, Story 2.2 | ✓ Covered |
| FR19 | BLS handler validates and calls reducer | Epic 2, Story 2.3 | ✓ Covered |
| FR20 | ILP fee collection | Epic 2, Story 2.4 | ✓ Covered |
| FR21 | Wallet balance query | Epic 2, Story 2.4 | ✓ Covered |
| FR22 | Action cost registry | Epic 2, Story 2.6 | ✓ Covered |
| FR23 | Autonomous decisions via MCP tools | Epic 4 | ✓ Covered |
| FR24 | LLM-powered goal planning (Phase 2) | Epic 7 | ✓ Covered |
| FR25 | Persistent memory across sessions (Phase 2) | Epic 7 | ✓ Covered |
| FR26 | Affordance detection with cost/reward (Phase 2) | Epic 7 | ✓ Covered |
| FR27 | Swappable cognition via config/skill changes | Epic 3, Story 3.4 | ✓ Covered |
| FR28 | Hex-grid map rendering in terminal | Epic 5, Story 5.3 | ✓ Covered |
| FR29 | Character movement via keyboard | Epic 5, Story 5.4 | ✓ Covered |
| FR30 | Chat messaging | Epic 5, Story 5.5 | ✓ Covered |
| FR31 | Inventory management | Epic 5, Story 5.5 | ✓ Covered |
| FR32 | Character status display | Epic 5, Story 5.5 | ✓ Covered |
| FR33 | Combat system (Phase 2) | Epic 8 | ✓ Covered |
| FR34 | Crafting system (Phase 2) | Epic 8 | ✓ Covered |
| FR35 | Building/territory management (Phase 2) | Epic 8 | ✓ Covered |
| FR36 | Trading marketplace (Phase 2) | Epic 8 | ✓ Covered |
| FR37 | Empire management (Phase 2) | Epic 8 | ✓ Covered |
| FR38 | TUI renders at 30+ FPS | Epic 5, Story 5.2 | ✓ Covered |
| FR39 | Structured decision logging (JSONL) | Epic 3, Story 3.6 | ✓ Covered |
| FR40 | Multi-agent concurrent execution (Phase 2) | Epic 9 | ✓ Covered |
| FR41 | YAML experiment configuration (Phase 2) | Epic 9 | ✓ Covered |
| FR42 | World state snapshot/restore (Phase 2) | Epic 9 | ✓ Covered |
| FR43 | Comparative decision log analysis (Phase 2) | Epic 9 | ✓ Covered |
| FR44 | Docker compose local dev environment | Epic 1, Story 1.3 | ✓ Covered |
| FR45 | ILP fee schedule configuration | Epic 2, Story 2.4 | ✓ Covered |
| FR46 | System health monitoring | Epic 6 | ✓ Covered |
| FR47 | BLS game action handler mapping | Epic 2, Story 2.3 | ✓ Covered |
| FR48 | Skill files for new SpacetimeDB worlds (Phase 2) | Epic 10 | ✓ Covered |
| FR49 | BLS handler registration for third-party games (Phase 2) | Epic 10 | ✓ Covered |
| FR50 | Auto-generate skill files from schema (Phase 3) | Epic 11 | ✓ Covered |

### Missing Requirements

No missing FR coverage identified. All 50 PRD Functional Requirements are mapped to epics.

### Coverage Statistics

- Total PRD FRs: 50
- FRs covered in epics: 50
- Coverage percentage: **100%**
- MVP FRs (Epics 1-6): 34
- Phase 2 FRs (Epics 7-10): 15
- Phase 3 FRs (Epic 11): 1

## 4. UX Alignment Assessment

### UX Document Status

**Found:** `ux-design-specification.md` (48KB, 823 lines, dated 2026-02-25)

Comprehensive UX specification covering:
- Executive summary with 3 personas (Marcus researcher, Sarah power player, Alex indie builder)
- Core experience design (game action loop)
- Visual design foundation (rebels-in-the-sky inheritance)
- Design system (semantic style tokens, custom widgets)
- 7-tab screen architecture (Player, Nearby, World, Map, Actions, Economy, System)
- User journey flows with mermaid diagrams
- Component strategy and implementation roadmap
- Navigation, feedback, and consistency patterns
- Accessibility strategy and terminal testing plan

### UX ↔ PRD Alignment

**Strong alignment on:**
- All TUI FRs (FR28-FR32, FR38) mapped to specific screen designs
- Identity management (FR1-FR3) reflected in first-launch journey
- Wallet/payment visibility (FR21, FR22) designed into WalletMeter + CostPreview widgets
- Action execution (FR17) reflected in game action loop design
- Auto-reconnection (FR10) designed into connection status UX
- MCP agent flows (FR23) covered in agent setup journey

**Alignment issue identified:**

| Issue | PRD Says | UX Says | Impact |
|---|---|---|---|
| Terminal size requirement | NFR1: "30+ FPS in a standard **80x24** terminal" | "Fixed **160x48** character viewport... show error if < 160x48" | Contradiction — 80x24 is a standard minimum, 160x48 is 4x larger. UX spec explicitly rejects smaller terminals. |
| SSH play | FR38 + Journey 2: "works over SSH connections", Marcus "playing over SSH from his server rack" | Platform Strategy: "no offline mode, **no remote SSH use case**" | Contradiction — PRD expects SSH play, UX explicitly excludes it. |

**Persona naming discrepancy (minor):**
- PRD: Dr. Priya Sharma (researcher), Marcus Chen (terminal player), Anika Patel (game dev), Jonathan (operator)
- UX: Marcus (researcher), Sarah (power player), Alex (indie builder)
- Different names for similar personas. Not a blocking issue, but may cause confusion.

### UX ↔ Architecture Alignment

**Strong alignment on:**
- JSON-RPC 2.0 over stdio for TUI ↔ backend IPC
- Screen trait + SplitPanel pattern from rebels-in-the-sky
- EventEmitter pattern with typed events
- `client.publish()` → ILP → Crosstown → BLS → SpacetimeDB write path
- snake_case MCP tools, camelCase JSON fields
- Nostr keypair as sole identity

**No architecture gaps identified** — the architecture document supports all UX requirements.

### Recommendations

1. **Resolve terminal size contradiction:** Either update NFR1 to specify 160x48 as minimum (matching UX), or redesign the UX for 80x24 compatibility. The 160x48 requirement is reasonable for an MMORPG TUI with hex grid + panels, but contradicts the NFR as written.
2. **Resolve SSH play contradiction:** Either update UX to support SSH (matching PRD user journey) or remove SSH from PRD. Given the terminal-native value proposition, SSH support seems valuable.
3. **Harmonize persona names:** Minor cleanup — use consistent names across PRD and UX docs.

## 5. Epic Quality Review

### A. User Value Focus Check

| Epic | Title Assessment | User Value | Verdict |
|---|---|---|---|
| Epic 1 | "Project Foundation & Game World Connection" | "Users can establish their cryptographic identity and connect to the live BitCraft game world" | ✓ User value present (borderline title) |
| Epic 2 | "Action Execution & Payment Pipeline" | "Users can execute game actions via ILP micropayments" | ✓ Clear user value |
| Epic 3 | "Declarative Agent Configuration" | "Researchers can define agent behavior entirely through markdown config files" | ✓ Clear user value |
| Epic 4 | "MCP Server for AI Agents" | "AI agents can play the game autonomously through the standard MCP protocol" | ✓ Clear user value |
| Epic 5 | "Terminal Game Client" | "Human players can experience a full MMORPG from their terminal" | ✓ Clear user value |
| Epic 6 | "Infrastructure & Observability" | "Operators can monitor system health and researchers can observe agent behavior" | ⚠️ Borderline — thin epic (1 FR), but serves real operator/researcher needs |
| Epic 7 | "Advanced Agent Intelligence" | "Researchers can run LLM-powered agents with persistent memory" | ✓ Clear user value |
| Epic 8 | "TUI Advanced Gameplay" | "Players can engage in the full depth of BitCraft" | ✓ Clear user value |
| Epic 9 | "Experiment Harness & Multi-Agent Research" | "Researchers can run comparative experiments" | ✓ Clear user value |
| Epic 10 | "World Extensibility" | "Game developers can make any SpacetimeDB world agent-accessible" | ✓ Clear user value |
| Epic 11 | "Platform Expansion" | "The platform auto-generates skill files from any SpacetimeDB module" | ✓ Clear user value |

### B. Epic Independence Validation

| Epic | Dependencies | Forward Dependencies? | Verdict |
|---|---|---|---|
| Epic 1 | None — standalone foundation | No | ✓ |
| Epic 2 | Epic 1 (identity, SpacetimeDB connection) | No | ✓ |
| Epic 3 | Epic 1 (SpacetimeDB for validation), Epic 2 (client.publish, cost registry) | No | ✓ |
| Epic 4 | Epic 1, 2, 3 (client, write path, skill system) | No | ✓ |
| Epic 5 | Epic 1, 2 (client, write path) | No | ✓ |
| Epic 6 | Epic 1-5 (needs full stack to monitor) | No | ✓ |
| Epics 7-11 | Phase 2/3, build on MVP epics | No | ✓ |

No forward dependencies found. Each epic builds only on earlier epics.

### C. Story Quality Assessment

**Story Structure:** All 50 stories follow proper "As a [persona], I want... So that..." format with Given/When/Then acceptance criteria. Error conditions are covered in most stories.

**Story Sizing:** All stories are appropriately scoped — none are epic-sized, none are trivially small. Each delivers a complete, independently verifiable unit of work.

**Within-Epic Dependencies:** Stories within each epic follow logical ordering — each story can use the output of prior stories in the same epic. No forward references within epics.

### D. Quality Findings

#### 🟠 Major Issues

**1. Epic 5 TUI stories may violate NFR21 (uniform skill file consumption)**

NFR21 states: "Skill file format is consumed by `@sigil/client` and exposed to all frontends (MCP server, TUI backend) uniformly." However, Epic 5 TUI stories reference specific reducers directly (e.g., `player_move`, `chat_post_message`, `craft_*`) rather than consuming actions through the skill file system established in Epic 3.

- Story 5.6 references `player_move` reducer directly
- Story 5.7 references `chat_post_message` reducer directly
- Story 5.8 references inventory actions directly

This creates an implicit undeclared dependency on Epic 3's skill system and means the TUI may bypass the uniform action surface.

**Recommendation:** Epic 5 stories should explicitly state that TUI actions are sourced from skill files via the TUI backend, not hardcoded reducer calls. The TUI backend should expose actions derived from loaded skills, consistent with how the MCP server exposes them. Add an AC to Story 5.1 confirming the TUI backend uses the skill system to determine available actions.

**2. PRD FRs reference superseded Five-Layer Cognition Architecture**

The epics document's Additional Requirements section explicitly states: "Five-Layer Cognition Architecture is SUPERSEDED — Agent = Claude instance with CLAUDE.md/AGENTS.md + Skills + MCP tools (NOT custom cognition stack)."

However, the PRD FRs still reference cognition layers:
- FR8: "Layer 1: StaticDataLoader"
- FR9: "Layer 2: EventInterpreter"
- FR23: "Layer 5: GoalsSimple" (rule-based priority queue planner)
- FR24: "Layer 5: GoalsLLM"
- FR25: "Layer 3: MemorySystem"
- FR26: "Layer 4: AffordanceEngine"
- FR27: "swap individual cognition layers independently"

The epics adapted correctly — perception components (static data, event interpretation) remain as shared `@sigil/client` features, while the cognition/decision layer is now Claude MCP agent pattern rather than a custom GoalsSimple/GoalsLLM stack. But the PRD FR text is stale.

**Recommendation:** Update PRD FRs to remove five-layer cognition references. FR23 should describe "Agents can make autonomous decisions via MCP tools" rather than "rule-based priority queue planner (GoalsSimple)." FR27 should describe "Researchers can swap agent behavior by editing Agent.md and skill files" rather than "swap individual cognition layers."

#### 🟡 Minor Concerns

**3. Story 1.1 is a technical infrastructure story**

"As a developer, I want a properly structured polyglot monorepo with TypeScript and Rust workspaces..." — this is setup, not user-facing value. Acceptable for a greenfield project bootstrapping story but noted as a deviation from strict user-value epic standards.

**4. Epic 6 is thin (1 FR, 2 stories)**

Epic 6 covers only FR46 (system health monitoring) plus agent observation mode. It's borderline "Infrastructure" which is typically a red flag. However, the stories deliver genuine value to operators and researchers, so it's acceptable.

**5. Acceptance criteria are comprehensive but some ACs reference NFRs without specifying how they'll be verified**

Several ACs reference performance NFRs (e.g., "30+ FPS (NFR1)", "within 500ms (NFR5)", "within 2 seconds (NFR3)") but don't specify how these will be measured during story acceptance. These should have explicit test mechanisms.

### E. Best Practices Compliance Checklist

| Criterion | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Epic 5 | Epic 6 |
|---|---|---|---|---|---|---|
| Delivers user value | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠️ |
| Functions independently | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stories appropriately sized | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| No forward dependencies | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Clear acceptance criteria | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FR traceability | ✓ | ✓ | ✓ | ✓ | ⚠️ | ✓ |

**Overall Epic Quality:** Strong. 2 major issues (both addressable), 3 minor concerns. No critical violations found. The epics are well-structured, user-focused, and properly sequenced.

## 6. Summary and Recommendations

### Overall Readiness Status

**READY** — with minor corrections recommended before implementation begins.

The project planning artifacts are comprehensive, well-aligned, and implementation-ready. All 50 Functional Requirements have 100% epic coverage, the architecture is complete and validated, and the UX specification is detailed and grounded in proven patterns. The identified issues are addressable without re-planning.

### Issue Summary

| Severity | Count | Category |
|---|---|---|
| Critical | 0 | — |
| Major | 2 | Epic quality (NFR21 skill uniformity), PRD stale cognition references |
| Minor | 5 | UX contradictions (terminal size, SSH), technical Story 1.1, thin Epic 6, NFR verification gaps |

### Critical Issues Requiring Immediate Action

None. No blocking issues found.

### Issues Recommended to Address Before Implementation

**1. Resolve terminal size contradiction (PRD vs UX)**
- PRD NFR1 says "standard 80x24 terminal"
- UX spec says "fixed 160x48 viewport, error if smaller"
- **Action:** Update NFR1 to "160x48" to match UX spec. The 160x48 requirement is reasonable for an MMORPG TUI with hex grid + 7 tabs + status bar.

**2. Resolve SSH play contradiction (PRD vs UX)**
- PRD FR38 + user journey says "works over SSH connections"
- UX Platform Strategy says "no remote SSH use case"
- **Action:** Remove the "no remote SSH use case" line from UX spec. SSH play is a core value proposition for the terminal player persona and should remain a target.

**3. Update PRD FRs to remove stale five-layer cognition references**
- FRs 8, 9, 23-27 reference Layer 1-5 terminology that was superseded by the Claude agent architecture decision
- **Action:** Update FR text to describe actual implementations: "StaticDataLoader" instead of "Layer 1", "MCP tool-based autonomous decisions" instead of "GoalsSimple", etc. The epics already adapted correctly — only the PRD text is stale.

**4. Add skill file consumption to Epic 5 TUI stories**
- TUI stories reference specific reducers directly rather than consuming actions from the skill file system (NFR21 violation)
- **Action:** Add an AC to Story 5.1 (TUI Backend) confirming the backend exposes actions derived from loaded skill files. Update Stories 5.6-5.8 to reference skill-sourced actions rather than hardcoded reducer names.

### Issues Acceptable to Defer

**5. Story 1.1 technical infrastructure story** — Acceptable for greenfield project bootstrapping. No action needed.

**6. Epic 6 thin coverage** — Acceptable. Operator monitoring and agent observation are genuine user needs. No action needed.

**7. NFR verification mechanisms** — Some ACs reference performance NFRs (30+ FPS, 500ms, 2s) without specifying test methods. Can be addressed during story implementation.

**8. Persona name harmonization (PRD vs UX)** — Cosmetic inconsistency. Can be addressed when updating PRD for item #3.

### Recommended Next Steps

1. **Fix contradictions #1 and #2** — Update NFR1 terminal size and remove UX SSH exclusion (5 min each)
2. **Update PRD cognition references #3** — Remove stale five-layer terminology from FR text (15 min)
3. **Update Epic 5 skill consumption #4** — Add skill file ACs to TUI stories (10 min)
4. **Begin implementation** — Start with Epic 1, Story 1.1 (Monorepo Scaffolding)

### Scorecard

| Area | Score | Notes |
|---|---|---|
| PRD Completeness | 9/10 | Comprehensive. Stale cognition layer references are the only issue. |
| FR Coverage | 10/10 | 100% — all 50 FRs mapped to epics with traceability. |
| Architecture Alignment | 10/10 | Architecture doc is thorough and supports all PRD/UX requirements. |
| UX Alignment | 8/10 | Detailed and grounded, but two contradictions with PRD need resolution. |
| Epic Quality | 9/10 | Well-structured, user-focused, properly sequenced. Minor NFR21 gap. |
| **Overall** | **9/10** | **Ready for implementation with minor corrections.** |

### Final Note

This assessment identified 7 issues across 3 categories (PRD/UX alignment, epic quality, minor concerns). None are blocking. The planning artifacts represent a thorough, professional body of work — 50 FRs, 27 NFRs, 11 epics, 50 stories, all with full traceability. Address the 4 recommended corrections before beginning Epic 1 implementation to ensure a clean foundation.

**Assessor:** Implementation Readiness Workflow (BMAD)
**Date:** 2026-02-26
**Project:** Sigil (BitCraftPublic)
