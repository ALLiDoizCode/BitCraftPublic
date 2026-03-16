# Story 5.3: Game Loop Mapping & Precondition Documentation -- Test Architecture Traceability Report

**Generated:** 2026-03-16
**Story:** 5.3 -- Game Loop Mapping & Precondition Documentation
**Status:** COMPLETE
**Test Result:** 154/154 PASS (0 failures, 0 skipped)
**Overall Traceability:** 5/5 ACs fully covered (100%)

---

## Story Nature

Story 5.3 is a **research/documentation story** -- its primary deliverable is an update to the BitCraft Game Reference document (`_bmad-output/planning-artifacts/bitcraft-game-reference.md`) with a new "Game Loops" section. There is no application source code. The 154 verification tests validate document structure, content completeness, and consistency with Stories 5.1 and 5.2.

---

## Acceptance Criteria Summary

| AC# | Title | FR/NFR | Test Coverage | Status |
| --- | ----- | ------ | ------------- | ------ |
| AC1 | Core game loop documentation (9 loops) | FR17, FR19, FR47 | 27 tests (primary) + 28 tests (per-loop) + 9 (state transitions) + 1 (completeness) = 65 | COVERED |
| AC2 | Movement loop documentation | FR17 | 11 tests | COVERED |
| AC3 | Gathering loop documentation | FR17 | 12 tests + 2 (progressive action) = 14 | COVERED |
| AC4 | Crafting loop documentation | FR17 | 15 tests + 2 (progressive action) = 17 | COVERED |
| AC5 | Precondition categorization and Mermaid diagrams | FR19, FR47 | 10 (categorization) + 9 (diagrams) + 12 (classification) + 3 (quick ref) + 1 (BLOCKER-1) = 35 | COVERED |

**Note:** Many tests contribute to multiple ACs. The "per-loop" describe blocks (Player Lifecycle, Building, Combat, Trading, Chat, Empire) validate aspects of both AC1 (all 9 loops documented) and AC5 (Mermaid diagrams, Phase 2 classification). The counts above reflect primary AC assignment. Total unique tests: 154.

---

## Detailed Traceability Matrix

### AC1: Core game loop documentation (FR17, FR19, FR47)

> Given the reducer catalog (Story 5.1) and state model (Story 5.2)
> When game loops are analyzed
> Then the following core loops are documented: player lifecycle (spawn/respawn), movement, resource gathering, crafting, building placement, combat, trading, chat, and empire management
> And each loop defines: the sequence of reducer calls, preconditions for each step, expected state transitions, and observable outcomes

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should contain a Game Loops section in the game reference document | "Game Loops" section heading exists |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should have substantial Game Loops content (not a stub) | Content length >= 5000 characters |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document the "player lifecycle" game loop | Player lifecycle loop documented as section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document the "movement" game loop | Movement loop documented as section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document the "gathering" game loop | Gathering loop documented as section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document the "crafting" game loop | Crafting loop documented as section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document the "building" game loop | Building loop documented as section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document the "combat" game loop | Combat loop documented as section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document the "trading" game loop | Trading loop documented as section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document the "chat" game loop | Chat loop documented as section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document the "empire" game loop | Empire loop documented as section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document all 9 required game loops | All 9 loops present (aggregate check) |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document reducer call sequences for each loop | >= 15 sequence indicators (arrows, numbered steps) |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "sign_in" reducer | sign_in present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "sign_out" reducer | sign_out present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "player_move" reducer | player_move present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "extract_start" reducer | extract_start present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "extract" reducer | extract present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "craft_initiate_start" reducer | craft_initiate_start present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "craft_initiate" reducer | craft_initiate present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "craft_continue_start" reducer | craft_continue_start present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "craft_continue" reducer | craft_continue present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "craft_collect" reducer | craft_collect present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "player_respawn" reducer | player_respawn present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should reference the "player_queue_join" reducer | player_queue_join present in game loops section |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document expected state transitions for each loop | >= 18 state transition indicators across all loops |
| `story-5-3-game-loop-verification.test.ts` | AC1 > should document observable outcomes for game loops | Observable/subscription update language present |
| `story-5-3-game-loop-verification.test.ts` | Player lifecycle (Task 2) > should document the player_queue_join reducer | player_queue_join in lifecycle section |
| `story-5-3-game-loop-verification.test.ts` | Player lifecycle (Task 2) > should document the sign_in reducer | sign_in in lifecycle section |
| `story-5-3-game-loop-verification.test.ts` | Player lifecycle (Task 2) > should document the sign_out reducer | sign_out in lifecycle section |
| `story-5-3-game-loop-verification.test.ts` | Player lifecycle (Task 2) > should document the player_respawn reducer | player_respawn in lifecycle section |
| `story-5-3-game-loop-verification.test.ts` | Player lifecycle (Task 2) > should document signed_in_player_state creation | signed_in_player_state table referenced |
| `story-5-3-game-loop-verification.test.ts` | Player lifecycle (Task 2) > should document player_state.signed_in toggle | player_state.signed_in state transition |
| `story-5-3-game-loop-verification.test.ts` | Player lifecycle (Task 2) > should document the death/respawn sub-loop | Death/respawn sub-loop documented |
| `story-5-3-game-loop-verification.test.ts` | Player lifecycle (Task 2) > should have a Mermaid sequence diagram for player lifecycle | sequenceDiagram in lifecycle section |
| `story-5-3-game-loop-verification.test.ts` | Building (Task 6) > should document the project_site_place reducer | project_site_place in building section |
| `story-5-3-game-loop-verification.test.ts` | Building (Task 6) > should document the project_site_add_materials reducer | project_site_add_materials in building section |
| `story-5-3-game-loop-verification.test.ts` | Building (Task 6) > should document claim membership/permissions precondition | Claim/permission preconditions documented |
| `story-5-3-game-loop-verification.test.ts` | Building (Task 6) > should be classified as Phase 2 | Phase 2 classification present |
| `story-5-3-game-loop-verification.test.ts` | Building (Task 6) > should have a Mermaid sequence diagram for building | sequenceDiagram in building section |
| `story-5-3-game-loop-verification.test.ts` | Combat (Task 7) > should document the attack_start or attack reducer | attack_start/attack in combat section |
| `story-5-3-game-loop-verification.test.ts` | Combat (Task 7) > should document target_update reducer | target_update in combat section |
| `story-5-3-game-loop-verification.test.ts` | Combat (Task 7) > should be classified as Phase 2 | Phase 2 classification present |
| `story-5-3-game-loop-verification.test.ts` | Combat (Task 7) > should have a Mermaid sequence diagram for combat | sequenceDiagram in combat section |
| `story-5-3-game-loop-verification.test.ts` | Trading (Task 8) > should document the P2P trade sequence | P2P trade_initiate_session documented |
| `story-5-3-game-loop-verification.test.ts` | Trading (Task 8) > should document the market order sequence | Market orders documented |
| `story-5-3-game-loop-verification.test.ts` | Trading (Task 8) > should be classified as Phase 2 | Phase 2 classification present |
| `story-5-3-game-loop-verification.test.ts` | Trading (Task 8) > should have a Mermaid sequence diagram for trading | sequenceDiagram in trading section |
| `story-5-3-game-loop-verification.test.ts` | Chat (Task 9) > should document the chat_post_message reducer | chat_post_message in chat section |
| `story-5-3-game-loop-verification.test.ts` | Chat (Task 9) > should document chat_message_state creation | chat_message_state table referenced |
| `story-5-3-game-loop-verification.test.ts` | Chat (Task 9) > should document signed-in precondition | Signed-in precondition documented |
| `story-5-3-game-loop-verification.test.ts` | Chat (Task 9) > should have a Mermaid sequence diagram for chat | sequenceDiagram in chat section |
| `story-5-3-game-loop-verification.test.ts` | Empire (Task 9) > should document empire management reducers | Empire reducer names present |
| `story-5-3-game-loop-verification.test.ts` | Empire (Task 9) > should be classified as Phase 2 | Phase 2 classification present |
| `story-5-3-game-loop-verification.test.ts` | Empire (Task 9) > should have a Mermaid sequence diagram for empire | sequenceDiagram in empire section |
| `story-5-3-game-loop-verification.test.ts` | State transition table refs > should reference "mobile_entity_state" | Table name present in game loops |
| `story-5-3-game-loop-verification.test.ts` | State transition table refs > should reference "inventory_state" | Table name present in game loops |
| `story-5-3-game-loop-verification.test.ts` | State transition table refs > should reference "progressive_action_state" | Table name present in game loops |
| `story-5-3-game-loop-verification.test.ts` | State transition table refs > should reference "signed_in_player_state" | Table name present in game loops |
| `story-5-3-game-loop-verification.test.ts` | State transition table refs > should reference "health_state" | Table name present in game loops |
| `story-5-3-game-loop-verification.test.ts` | State transition table refs > should reference "stamina_state" | Table name present in game loops |
| `story-5-3-game-loop-verification.test.ts` | State transition table refs > should reference "resource_health_state" | Table name present in game loops |
| `story-5-3-game-loop-verification.test.ts` | State transition table refs > should reference "player_state" | Table name present in game loops |
| `story-5-3-game-loop-verification.test.ts` | State transition table refs > should document at least 2 state transitions per loop for all 9 loops | >= 2 unique _state tables or transition rows per loop |
| `story-5-3-game-loop-verification.test.ts` | Completeness metrics > should have >= 9 game loops documented | All 9 loops found in section |

**Coverage assessment:** COMPLETE. All elements of AC1 are verified: 9 game loops documented (each with dedicated `it.each` test), reducer call sequences validated (12 core reducers checked individually + aggregate sequence indicator count), state transitions verified (8 key tables checked + per-loop minimum 2 transitions), and observable outcomes checked. The per-loop describe blocks (Player Lifecycle through Empire) provide deep validation of individual loop content including reducer names, state transitions, and Mermaid diagrams.

---

### AC2: Movement loop documentation (FR17)

> Given the movement game loop
> When documented
> Then the sequence includes: current position query -> `player_move` reducer call -> position state update observed via subscription
> And preconditions are listed: valid target hex, player alive, no movement cooldown
> And the expected state transition is defined: `mobile_entity_state.location_x/location_z` changes from (x1,z1) to (x2,z2)

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should document the movement sequence including position query | Position query step documented (mobile_entity_state reference) |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should reference the player_move reducer call | player_move reducer in movement section |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should document position state update via subscription | Subscription-based observation documented |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should document the valid target hex precondition | Valid target hex/coordinates precondition |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should document the player alive precondition | Alive/not incapacitated precondition |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should document no movement cooldown precondition | Cooldown/stamina/running precondition |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should document location_x/location_z state transition | location_x and location_z column names |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should reference mobile_entity_state table for state transitions | mobile_entity_state table name (not player_state.position) |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should document the PlayerMoveRequest structure | PlayerMoveRequest or destination/origin fields |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should document destination_x/destination_z fields | Destination column references |
| `story-5-3-game-loop-verification.test.ts` | AC2 > should have a Mermaid sequence diagram for movement | sequenceDiagram in movement section |

**Coverage assessment:** COMPLETE. All three components of AC2 are verified: (1) sequence documented -- position query, player_move, subscription update; (2) all three preconditions -- valid target, alive, cooldown; (3) state transition -- mobile_entity_state.location_x/location_z. The story file correctly uses `mobile_entity_state.location_x/location_z` with (x1,z1) coordinates per Story 5.2, improving on the epics.md wording which says `player_state.position` with (x1,y1).

---

### AC3: Gathering loop documentation (FR17)

> Given the resource gathering loop
> When documented
> Then the sequence includes: move to resource node -> `extract_start` -> `extract` -> inventory updated
> And preconditions include: player near resource, resource node exists and has remaining health
> And state transitions include: `resource_health_state.health` decremented, inventory item added or quantity incremented in `inventory_state`

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document the gathering sequence starting with movement to resource | Move to resource as first step |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document the extract_start reducer call | extract_start progressive action start |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document the extract reducer call | extract completion (distinct from extract_start) |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document inventory update as an outcome | inventory_state update / item added |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document the player-near-resource spatial precondition | Near resource / proximity / distance |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document the resource health precondition | resource_health_state or resource health |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document resource_health_state.health decrement as state transition | Health decrement state transition |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document inventory_state update as state transition | inventory_state table reference |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document the PlayerExtractRequest structure | PlayerExtractRequest or recipe_id + target_entity_id |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document the progressive action timer between extract_start and extract | Timer/wait/duration between phases |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should document extraction_recipe_desc reference | extraction_recipe_desc table reference |
| `story-5-3-game-loop-verification.test.ts` | AC3 > should have a Mermaid sequence diagram for gathering | sequenceDiagram in gathering section |
| `story-5-3-game-loop-verification.test.ts` | Progressive action > should document timing between _start and completion for gathering | Timer/timing in gathering section |
| `story-5-3-game-loop-verification.test.ts` | Progressive action > should document that movement/death cancels progressive actions | Cancellation/invalidation documented |

**Coverage assessment:** COMPLETE. All three components of AC3 are verified: (1) sequence -- move to resource, extract_start, extract, inventory updated; (2) preconditions -- near resource (spatial), resource health exists (state); (3) state transitions -- resource_health_state.health decremented, inventory_state updated. Additional tests cover the progressive action timing and request structure beyond the AC minimum.

---

### AC4: Crafting loop documentation (FR17)

> Given the crafting loop
> When documented
> Then the sequence includes: verify materials in inventory -> `craft_initiate_start` -> `craft_initiate` -> `craft_continue_start` -> `craft_continue` (repeat) -> `craft_collect` -> product in inventory, materials consumed
> And preconditions include: recipe exists in `crafting_recipe_desc`, all required materials present in `inventory_state`, player near building with matching `building_function`
> And state transitions include: `progressive_action_state` created/updated, material quantities decremented in `inventory_state`, crafted item added

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document verify materials in inventory as first step | Material verification step |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document craft_initiate_start reducer call | craft_initiate_start present |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document craft_initiate reducer call | craft_initiate (distinct from _start) |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document craft_continue_start reducer call | craft_continue_start present |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document craft_continue reducer call (repeatable) | craft_continue with repeat indication |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document craft_collect reducer call | craft_collect present |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document product in inventory as final outcome | Product/crafted item in inventory |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document materials consumed as state transition | Material consumption from inventory_state |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document crafting_recipe_desc precondition | crafting_recipe_desc table reference |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document player near building with matching building_function precondition | Building proximity / building_function |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document all required materials in inventory_state precondition | Materials in inventory_state |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document progressive_action_state creation/update as state transition | progressive_action_state referenced |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document the PlayerCraftInitiateRequest structure | PlayerCraftInitiateRequest or request fields |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should document the passive crafting sub-loop | Passive/background crafting documented |
| `story-5-3-game-loop-verification.test.ts` | AC4 > should have a Mermaid sequence diagram for crafting | sequenceDiagram in crafting section |
| `story-5-3-game-loop-verification.test.ts` | Progressive action > should document timing between _start and completion for crafting | Timer/timing in crafting section |
| `story-5-3-game-loop-verification.test.ts` | Progressive action > should document the two-phase _start + complete pattern | Progressive action / two-phase pattern |

**Coverage assessment:** COMPLETE. All three components of AC4 are verified: (1) full sequence -- verify materials, craft_initiate_start, craft_initiate, craft_continue_start, craft_continue (repeat), craft_collect, product in inventory, materials consumed; (2) all three preconditions -- crafting_recipe_desc, materials in inventory_state, building_function proximity; (3) state transitions -- progressive_action_state created/updated, materials decremented, crafted item added. The passive crafting sub-loop is also covered.

---

### AC5: Precondition categorization and Mermaid diagrams (FR19, FR47)

> Given each game loop
> When preconditions are documented
> Then they distinguish between: state preconditions, spatial preconditions, temporal preconditions, and identity preconditions
> And each loop includes a Mermaid sequence diagram showing: actor, reducer calls, state queries, and expected state transitions
> And the document identifies which loops are available for MVP validation (Stories 5.4-5.8) vs. which require Phase 2 game systems

| Test File | Test Name | What It Verifies |
| --------- | --------- | ---------------- |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should use the "state" precondition category | "state" category used |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should use the "spatial" precondition category | "spatial" category used |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should use the "temporal" precondition category | "temporal" category used |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should use the "identity" precondition category | "identity" category used |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should use all 4 precondition categories | All 4 present (aggregate) |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should document state preconditions with specific examples | alive/stamina/health examples |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should document spatial preconditions with specific examples | near/proximity/distance examples |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should document temporal preconditions with specific examples | cooldown/timer/elapsed examples |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should document identity preconditions with specific examples | signed in/claim member/actor_id examples |
| `story-5-3-game-loop-verification.test.ts` | AC5 Categorization > should have at least 3 documented preconditions per loop for all 9 loops | >= 3 preconditions per loop (9 loops checked) |
| `story-5-3-game-loop-verification.test.ts` | AC5 Mermaid > should contain Mermaid sequence diagram code blocks | ```mermaid...sequenceDiagram...``` blocks exist |
| `story-5-3-game-loop-verification.test.ts` | AC5 Mermaid > should have at least 9 Mermaid sequence diagrams (one per loop) | >= 9 sequenceDiagram occurrences |
| `story-5-3-game-loop-verification.test.ts` | AC5 Mermaid > should include Client participant in Mermaid diagrams | Client participant defined |
| `story-5-3-game-loop-verification.test.ts` | AC5 Mermaid > should include SpacetimeDB participant in Mermaid diagrams | SpacetimeDB participant defined |
| `story-5-3-game-loop-verification.test.ts` | AC5 Mermaid > should include Tables participant in Mermaid diagrams | Tables participant defined |
| `story-5-3-game-loop-verification.test.ts` | AC5 Mermaid > should show reducer calls in Mermaid diagrams with arrow syntax | ->> or --> arrow syntax |
| `story-5-3-game-loop-verification.test.ts` | AC5 Mermaid > should show alt blocks for precondition failure paths | alt/else blocks in diagrams |
| `story-5-3-game-loop-verification.test.ts` | AC5 Mermaid > should show Err() responses in failure paths | Err() error responses |
| `story-5-3-game-loop-verification.test.ts` | AC5 Mermaid > should show subscription updates in Mermaid diagrams | Subscription update arrows |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should contain a MVP vs. Phase 2 classification table | Classification section exists |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify "player lifecycle" as MVP | Player lifecycle near MVP/5.4-5.8 |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify "movement" as MVP | Movement near MVP/5.4-5.8 |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify "gathering" as MVP | Gathering near MVP/5.4-5.8 |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify "crafting" as MVP | Crafting near MVP/5.4-5.8 |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify "chat" as MVP | Chat near MVP/5.4-5.8 |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify "building" as Phase 2 | Building near Phase 2 |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify "combat" as Phase 2 | Combat near Phase 2 |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify "trading" as Phase 2 | Trading near Phase 2 |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify "empire" as Phase 2 | Empire near Phase 2 |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should classify all 9 game loops (100% classified) | 9/9 loops classified (aggregate) |
| `story-5-3-game-loop-verification.test.ts` | AC5 Classification > should include classification reason for each loop | Reason column or reason language |
| `story-5-3-game-loop-verification.test.ts` | Precondition Quick Reference > should include a precondition quick reference section | Quick reference section heading |
| `story-5-3-game-loop-verification.test.ts` | Precondition Quick Reference > should map preconditions to error messages | Error messages (Not signed in, stamina, etc.) |
| `story-5-3-game-loop-verification.test.ts` | Precondition Quick Reference > should document at least 5 common precondition-to-error mappings | >= 5 distinct error patterns |
| `story-5-3-game-loop-verification.test.ts` | BLOCKER-1 > should document whether each loop can be tested via direct WebSocket | WebSocket/bypass/BLOCKER-1 testing guidance |

**Coverage assessment:** COMPLETE. All three components of AC5 are verified: (1) precondition categorization -- all 4 categories (state, spatial, temporal, identity) with specific examples, >= 3 preconditions per loop for all 9 loops; (2) Mermaid sequence diagrams -- >= 9 diagrams with Client/SpacetimeDB/Tables participants, arrow syntax, alt blocks for failures, Err() responses, subscription updates; (3) MVP vs. Phase 2 classification -- all 9 loops classified (5 MVP, 4 Phase 2), classification table present, reasons documented. The Precondition Quick Reference and BLOCKER-1 testing guidance provide additional AC5 coverage.

---

## Test File Summary

| Test File | Tests | Primary ACs | Description |
| --------- | ----- | ----------- | ----------- |
| `story-5-3-game-loop-verification.test.ts` | 154 | AC1-AC5 | Document verification: 9 game loops, preconditions, state transitions, Mermaid diagrams, MVP/Phase 2 classification, content preservation |
| **Total** | **154** | **AC1-AC5** | **All verification tests, no Docker required** |

---

## Source File to Test File Mapping

| Source/Output File | Test File(s) | Coverage Notes |
| ----------- | ------------ | -------------- |
| `_bmad-output/planning-artifacts/bitcraft-game-reference.md` | `story-5-3-game-loop-verification.test.ts` | Primary deliverable: new "Game Loops" section (~850 lines added) |
| `_bmad-output/implementation-artifacts/5-3-game-loop-mapping-and-precondition-documentation.md` | N/A | Story spec file -- not tested directly, but ACs are the source of all test assertions |

**Note:** This is a documentation/research story with no application source code. The test file validates the content of the output document, not source code behavior.

---

## FR/NFR Traceability

| Requirement | ACs Covered | Tests | Verified |
| ----------- | ----------- | ----- | -------- |
| FR17 (Execute actions via client.publish()) | AC1, AC2, AC3, AC4 | 65 tests (AC1) + 11 (AC2) + 14 (AC3) + 17 (AC4) = 107 | YES |
| FR19 (BLS handler validates and calls reducer) | AC1, AC5 | 65 (AC1, shared) + 35 (AC5) = 100 | YES |
| FR47 (BLS game action handler mapping) | AC1, AC5 | 65 (AC1, shared) + 35 (AC5) = 100 | YES |

**Notes:**

- FR17 coverage is through the game loop reducer sequences that document exact `client.publish()` invocation sequences (AC1 core loops, AC2 movement, AC3 gathering, AC4 crafting).
- FR19 coverage is through the precondition documentation that describes what the BLS/SpacetimeDB validates before executing reducers (AC5 categorization) and the Mermaid diagrams showing reducer call flows (AC5 diagrams).
- FR47 coverage is through the game loop to game system mapping and MVP vs. Phase 2 classification (AC5 classification), which maps reducer sequences to handler routing categories.

---

## Uncovered ACs

None. All 5 acceptance criteria (AC1-AC5) have full test coverage.

---

## Cross-Cutting Concerns Tested

| Concern | Tests | Notes |
| ------- | ----- | ----- |
| Stories 5.1/5.2 content preservation | 7 tests | Reducer Catalog, Identity Propagation, State Model, Entity Mapping, FK Relationships, Subscriptions sections preserved; document size check |
| Document structure and formatting | 5 tests | snake_case for reducers/tables, consistent naming with Stories 5.1 and 5.2, valid Mermaid syntax |
| Progressive action pattern | 4 tests | Two-phase pattern documented, timing for gathering and crafting, cancellation conditions |
| BLOCKER-1 testing approach | 1 test | WebSocket bypass / direct connection documented |
| State transition table references | 9 tests | 8 key entity tables present, >= 2 transitions per loop for all 9 loops |

---

## Risk Assessment

- **Document verification tests, not behavioral tests:** These 154 tests validate document structure and content presence using regex-based content matching. They verify that documentation exists and is well-structured but cannot validate the _accuracy_ of the precondition logic against the actual BitCraft server source code. Accuracy will be validated de facto when Stories 5.4-5.8 exercise the documented game loops against the live Docker stack.
- **No Docker dependency:** None of the 154 tests require Docker. This is appropriate for a documentation story.
- **Regex fidelity:** Tests use flexible regex patterns to accommodate minor formatting variations. The `escapeRegExp()` helper prevents ReDoS when constructing dynamic patterns from hardcoded constants. All 10 dynamic regex instances have `nosemgrep` annotations.
- **Auto-skip pattern:** Tests auto-skip when the Game Loops section does not exist, ensuring CI remains green before implementation. This is consistent with the Story 5.1 (66 tests) and 5.2 (104 tests) patterns.

---

## Epics.md AC Discrepancy Note

The epics.md canonical acceptance criteria for Story 5.3 AC2 states: _"the expected state transition is defined: `player_state.position` changes from (x1,y1) to (x2,y2)"_. The implemented story file and test suite correctly use `mobile_entity_state.location_x/location_z` with (x1,z1) coordinates, which is MORE ACCURATE per Story 5.2's entity-to-concept mapping that identified `mobile_entity_state` (not `player_state`) as the position table, and `location_z` (not `y`) as the vertical axis. This discrepancy was documented in the Story 5.3 adversarial review findings (item 11). The test suite validates the corrected nomenclature.

Similarly, epics.md AC3 uses generic language ("initiate gathering -> gathering completes") while the story file and tests use the specific reducer names (`extract_start` -> `extract`) identified in Story 5.1's reducer catalog. The tests verify the more precise terminology.

---

## Conclusion

Story 5.3 has **100% AC coverage** (5/5 ACs fully covered) with **154 passing tests** in a single test file. The implementation correctly documents all 9 game loops (player lifecycle, movement, gathering, crafting, building, combat, trading, chat, empire) with reducer call sequences, preconditions categorized into 4 types (state, spatial, temporal, identity), expected state transitions referencing specific table and column names, Mermaid sequence diagrams (>= 9), MVP vs. Phase 2 classification (100% of loops classified), and a Precondition Quick Reference mapping common preconditions to error messages. Stories 5.1 and 5.2 content is preserved (7 preservation tests pass). No gaps were found.
