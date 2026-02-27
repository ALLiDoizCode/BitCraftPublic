# Source Tree Analysis

Annotated directory tree of all 119 Rust source files in `src/`.

---

## Top-Level Files

```
src/
  main.rs                    Entry point. Parses CLI args, creates App, creates Tui backend
                             (local/SSH/dummy), calls app.run(tui).
  lib.rs                     Crate root. Declares all modules, exports app_version() and
                             AudioPlayerState enum.
  app.rs                     Core event loop. Defines AppState, AppEvent, App struct.
                             Contains run(), draw(), handle_*_events(), simulate_loaded_world(),
                             quit(). The central orchestrator.
  tui.rs                     Terminal management. Defines WriterProxy trait, DummyWriter,
                             TerminalEvent, TuiType enum (Local/Ssh/Dummy), Tui<W> struct.
                             Handles init/exit, raw mode, alternate screen, panic hooks,
                             FPS limiting (40 FPS cap).
  crossterm_event_handler.rs Input polling at 100Hz. Spawns tokio task. Drains pending events,
                             collapses scroll events, filters KeyEventKind::Press, forwards
                             as AppEvent::TerminalEvent.
  tick_event_handler.rs      Tick generation. Spawns tokio task with two intervals:
                             slow (10Hz) and fast (40Hz). Sends AppEvent::SlowTick/FastTick.
  store.rs                   Persistence layer. Serialize/deserialize with serde_json + gzip.
                             save_world(), load_world(), save_game(), save_tournament().
                             Legacy zlib migration. ASSETS_DIR (include_dir! embed).
                             Store path via `directories` crate.
  types.rs                   Type aliases and utility traits. Tick = u64 (milliseconds).
                             PlayerId/TeamId/PlanetId/GameId = uuid::Uuid.
                             AppResult<T>, AppCallback, all HashMap type aliases.
                             StorableResourceMap trait, SortablePlayerMap, SystemTimeTick.
  args.rs                    CLI argument parsing with clap. AppArgs struct with flags for
                             network, audio, random seed, reset, SSH, relayer, etc.
  relayer.rs                 Relayer node mode (feature-gated). Separate headless event loop
                             for relay-only operation.
```

## core/ -- Game Domain Model (14 files)

```
src/core/
  mod.rs                     Re-exports all core types. Central barrel module.
  world.rs                   World struct -- the entire game state. HashMaps of teams, players,
                             planets, games, tournaments. Tick counters. Dirty flags.
                             initialize(), handle_slow_tick_events(), handle_fast_tick_events(),
                             generate_random_team(), generate_local_game(), travel logic,
                             exploration, free pirate refresh, autonomous challenges.
  team.rs                    Team struct. Name, jersey, spaceship, player_ids, resources,
                             location (OnPlanet/Travelling/Exploring/OnSpaceAdventure),
                             reputation, game rating, training focus, challenges, trades,
                             autonomous strategy. Validation methods (can_challenge, can_travel).
  player.rs                  Player struct. Info (name, age, height, weight, population),
                             20 skill fields, special traits (Killer/Showpirate/Relentless/
                             Spugna/Crumiro), morale, tiredness, reputation, jersey image,
                             historical stats. Procedural generation from RNG.
  planet.rs                  Planet struct. Name, position (cartesian + polar), populations
                             by species, satellite orbits, team_ids present, resources,
                             asteroid probability, upgrades. PlanetType enum.
  skill.rs                   Skill system. 20 named skills in 4 groups (Athletics, Offense,
                             Defense, Technical, Mental). Rated trait, GameSkill enum,
                             star rating display. MIN_SKILL/MAX_SKILL constants.
  position.rs                Basketball positions. GamePosition (0-4): PG, SG, SF, PF, C.
                             Position-specific skill weight functions for rating calculation.
  resources.rs               Resource enum: GOLD, SCRAPS, RUM, FUEL, SATOSHI.
                             to_storing_space() for capacity math. SATOSHI has zero storage cost.
  role.rs                    CrewRole enum: Captain, Doctor, Pilot, Mozzo. Affects crew bonuses.
  jersey.rs                  Jersey struct (style + color map). JerseyStyle enum with 20+ styles.
  spaceship.rs               Spaceship struct. Components (hull, engine, storage, shooter,
                             shield, charge_unit), name, prefabs. Speed/fuel/durability
                             calculations.
  spaceship_components.rs    Component enums (Hull, Engine, Storage, Shooter, Shield, ChargeUnit)
                             with tiers. SpaceshipComponent trait for stats.
  spaceship_upgrades.rs      SpaceshipUpgradeTarget enum. Upgrade<T> generic struct with
                             duration and cost. UpgradeableElement trait.
  asteroid_upgrades.rs       AsteroidUpgradeTarget enum (Antenna, Greenhouse, etc.).
  space_cove.rs              SpaceCove struct. SpaceCoveState (UnderConstruction/Ready).
  kartoffel.rs               Kartoffel (collectible creatures). Rarity, traits.
  honours.rs                 Honour enum (achievements: Defiant, Galactic, Maximalist, etc.)
  game_rating.rs             Elo-style rating system for teams. GameRating struct.
  constants.rs               Game balance constants. Time intervals (SECONDS, MINUTES, HOURS,
                             DAYS), AU, LIGHT_YEAR, max players, tiredness rates, costs.
  types.rs                   TeamLocation enum (OnPlanet/Travelling/Exploring/OnSpaceAdventure),
                             PlayerLocation, TeamBonus enum, TrainingFocus.
  utils.rs                   Static data loading. PLANET_DATA, TEAM_DATA from embedded JSON.
                             is_default() serde helper.
```

## ui/ -- User Interface (29 files)

```
src/ui/
  mod.rs                     Module declarations and re-exports. Exports UI_SCREEN_SIZE,
                             PopupMessage, UiCallback, UiScreen, UiState.
  constants.rs               UI_SCREEN_SIZE = (160, 48). LEFT_PANEL_WIDTH, IMG_FRAME_WIDTH,
                             BARS_LENGTH. UiStyle struct with const Style definitions
                             (SELECTED, ERROR, OK, NETWORK, HIGHLIGHT, etc.). UiText constants.
  ui_screen.rs               UiScreen struct -- the top-level view controller. UiState and
                             UiTab enums. Holds all panel instances. Dispatches update(),
                             render(), handle_key_events(), handle_mouse_events().
                             Tab navigation, popup stack management.
  ui_callback.rs             UiCallback enum (~80 variants). call() method dispatches to
                             AppCallback closures. CallbackRegistry for mouse/keyboard
                             hit-testing during render.
  ui_frame.rs                UiFrame wrapper around ratatui::Frame. Adds screen_area()
                             centering, callback_registry integration, hover text area,
                             render_interactive_widget() and render_stateful_interactive_widget()
                             methods.
  ui_key.rs                  Key binding constants. Modules: space:: (WASD, arrows),
                             radio:: (audio controls), game::, player::. Global keys:
                             ESC, NEXT_TAB (Tab), PREVIOUS_TAB (BackTab), etc.
  traits.rs                  Screen trait (update + render + handle_key_events + footer_spans).
                             SplitPanel trait (index navigation for list-based panels).
                             InteractiveWidget trait (layer + before_rendering + hover_text).
                             InteractiveStatefulWidget trait. UiStyled trait for colored values.
                             PrintableGif trait.
  button.rs                  Button<'a> custom widget. InteractiveWidget impl. Supports:
                             hotkeys (underscored char), hover styling, disabled state,
                             selected state, optional block/hover_block, layer for popups.
                             Registers click callback on hover, keyboard callback for hotkey.
  clickable_list.rs          ClickableList<'a> custom widget. StatefulWidget with
                             ClickableListState. InteractiveStatefulWidget impl. Handles
                             scroll registration, click-to-select, hover highlighting.
                             Automatic scroll-to-selected.
  clickable_table.rs         ClickableTable<'a> custom widget. Row-based table with
                             ClickableCell, ClickableRow. InteractiveStatefulWidget impl.
                             Column widths, header, highlight.
  hover_text_span.rs         HoverTextSpan -- a Span that shows descriptive text in the
                             hover area when moused over. InteractiveWidget impl.
  hover_text_line.rs         HoverTextLine -- a Line of HoverTextSpans. Composite
                             InteractiveWidget.
  big_numbers.rs             ASCII art digit rendering for game scoreboard display.
  gif_map.rs                 GifMap -- cache for rendered image frames. Caches planet GIFs
                             (zoomed in/out), player sprites, spaceship sprites (on planet,
                             in shipyard, shooting, with shield). Generates frames by
                             compositing RGBA images with color maps and light masks.
                             Static lazy GIF constants: SPINNING_BALL_GIF, LEFT/RIGHT_SHOT_GIF,
                             PORTAL_GIFS.
  popup_message.rs           PopupMessage enum. Variants: Ok, Error, PromptQuit, Tutorial,
                             AsteroidNameDialog, PortalFound, ConfirmSpaceAdventure,
                             BuildSpaceCove, etc. render() draws centered popup with
                             border. consumes_input() handles popup-specific key events.
  widgets.rs                 Shared widget functions. default_block(), thick_block(),
                             selectable_list(). Button factories: go_to_planet_button(),
                             challenge_button(), explore_button(), space_adventure_button(),
                             trade_resource_button(), drink_button(). Composite renderers:
                             render_spaceship_description(), render_player_description(),
                             render_spaceship_upgrade(). Bar widgets: storage, crew, energy,
                             durability, fuel, charge.
  utils.rs                   img_to_lines() -- RGBA image to Vec<Line> via half-block chars.
                             input_from_key_event() for tui-textarea integration.
                             format_satoshi(), format_au(). TextArea input helpers.

  -- Panel/Screen modules --

  splash_screen.rs           Title screen. Logo, new game / continue buttons, version display.
  new_team_screen.rs         Team creation wizard. CreationState: Players -> Ship -> Name.
                             Player selection, color picker, ship selection.
  space_screen.rs            Space adventure full-screen renderer. Converts SpaceAdventure
                             entity system to terminal output. Key input routing.
  my_team_panel.rs           "My Team" tab. Sub-views: Info, Roster, Market, Shipyard,
                             Asteroids, Strategy. Team management operations.
  team_panel.rs              "Crews" tab. Browse all teams. TeamView sub-views:
                             OpenToChallenge, Ranking. Challenge button integration.
  player_panel.rs            "Pirates" tab. Browse all players. PlayerView sub-views:
                             AllPirates, FreePirates, OwnTeam, Trades. Lock/compare players.
  game_panel.rs              "Games" tab. Live game view with basketball court rendering,
                             scoreboard (big numbers), play-by-play, player stats table.
                             PitchView toggle.
  galaxy_panel.rs            "Galaxy" tab. ZoomLevel::In (planet detail with teams/players)
                             and ZoomLevel::Out (star map). Planet GIF rendering. Travel
                             and explore buttons.
  tournament_panel.rs        "Tournaments" tab. TournamentView: Active, Completed.
                             Registration, bracket display.
  tournament_brackets_lines.rs  Bracket rendering utilities for tournament display.
  space_cove_panel.rs        "Space Cove" tab. Asteroid base management, upgrades,
                             resource overview.
  swarm_panel.rs             "Swarm" tab. SwarmView: Chat, Logs, TeamRanking,
                             PlayerRanking. P2P chat integration, log display.
```

## game_engine/ -- Basketball Simulation (17 files)

```
src/game_engine/
  mod.rs                     Module exports. Tournament re-export.
  game.rs                    Game struct. Turn-based basketball simulation. GamePhase,
                             action history, scoring. GameSummary for persistence.
  types.rs                   TeamInGame, GameStats, Possession enum, GamePhase.
  action.rs                  Action execution. Offense/defense resolution.
  shot.rs                    Shot attempt resolution. 2pt/3pt success calculation.
  rebound.rs                 Rebound logic after missed shots.
  fastbreak.rs               Fast break transition play.
  isolation.rs               Isolation play type.
  pick_and_roll.rs           Pick and roll play type.
  post.rs                    Post-up play type.
  off_the_screen.rs          Off-the-screen play type.
  jump_ball.rs               Jump ball at game start / overtime.
  start_of_quarter.rs        Quarter start setup.
  end_of_quarter.rs          Quarter end processing.
  substitution.rs            Player substitution logic.
  brawl.rs                   Brawl mini-events (pirate flavor).
  tactic.rs                  Tactic enum (offense/defense styles).
  timer.rs                   Game clock management.
  constants.rs               Game engine balance constants.
  tournament.rs              Tournament struct. TournamentType, bracket generation,
                             round advancement, finals.
```

## image/ -- Image Processing (6 files)

```
src/image/
  mod.rs                     Module declarations.
  utils.rs                   Core image utilities. open_image(), open_gif(), ExtraImageUtils
                             trait (copy_non_transparent_from, apply_color_map,
                             apply_light_mask). LightMaskStyle enum (Horizontal, Vertical,
                             Radial, Exponential) for lighting effects. UNIVERSE_BACKGROUND
                             and STAR_LAYERS static images.
  color_map.rs               ColorMap struct (red, green, blue channel mapping). ColorPreset
                             enum. AsteroidColorMap.
  player.rs                  Player sprite generation. Composite jersey + body + head from
                             component images with color mapping. PLAYER_IMAGE_WIDTH.
  spaceship.rs               Spaceship sprite generation. SpaceshipImageId. Composite hull +
                             engine + components. On-planet, in-shipyard, shooting, shield
                             variants. SPACESHIP_IMAGE_WIDTH.
  game.rs                    Basketball court rendering. Pitch image generation for game view.
  components.rs              Sprite component loading (jersey parts, body parts, etc.).
```

## space_adventure/ -- Space Shooter Minigame (16 files)

```
src/space_adventure/
  mod.rs                     Module declarations and re-exports.
  space.rs                   SpaceAdventure struct. Entity management (add/remove), tick(),
                             collision detection dispatch, camera tracking. The real-time
                             game loop driven by FastTick.
  traits.rs                  Body, Sprite, Collider, GameEntity traits. PlayerInput enum.
                             ControllableSpaceship trait. ColliderType enum.
  entity.rs                  Entity enum wrapping all entity types. Delegates trait methods.
  spaceship.rs               SpaceshipEntity. Player-controlled ship with movement, shooting,
                             shield toggle, autofire, resource collection.
  asteroid.rs                Asteroid entity. Destructible obstacles.
  fragment.rs                Resource fragment entity. Collectible drops.
  collector.rs               Collector entity (tractor beam targets).
  projectile.rs              Projectile entity. Bullet physics.
  shield.rs                  Shield entity. Damage absorption overlay.
  particle.rs                Particle entity. Visual effects (explosions, trails).
  collisions.rs              HitBox struct. AABB collision detection. Swept collision.
  space_callback.rs          SpaceCallback enum. Entity-to-entity interaction events
                             (damage, collect, spawn, destroy).
  visual_effects.rs          VisualEffect enum. Flash, shake, color overlay effects.
  constants.rs               Space adventure balance constants.
  networking.rs              Network entity (enemy ships in multiplayer -- currently unused).
  utils.rs                   Direction enum, vector utilities.
```

## network/ -- P2P Networking (6 files)

```
src/network/
  mod.rs                     Module declarations.
  handler.rs                 NetworkHandler struct. libp2p Swarm setup (gossipsub, noise,
                             yamux). Event polling, message send/receive. Topic management.
  network_callback.rs        NetworkCallback enum. Handles incoming peer messages:
                             team sync, challenge, trade, tournament, chat, rankings.
  types.rs                   Network message types. NetworkTeam, NetworkGame,
                             TournamentRequestState, ChatHistoryEntry, rankings.
  challenge.rs               Challenge struct. Network challenge protocol.
  trade.rs                   Trade struct. Network trade protocol.
  constants.rs               Network constants.
```

## audio/ -- Music Streaming (2 files, feature-gated)

```
src/audio/
  mod.rs                     Module declaration.
  music_player.rs            MusicPlayer struct. Internet radio streaming via rodio +
                             stream-download. Station list from embedded JSON. Play/pause,
                             next/previous station. MusicPlayerEvent for error reporting.
```

## ssh/ -- SSH Server (4 files, feature-gated)

```
src/ssh/
  mod.rs                     Module declarations. SSHWriterProxy.
  server.rs                  SSH server implementation using russh.
  client.rs                  SSH client handler.
  channel.rs                 SSH channel management. Buffered writer for SSH transport.
  utils.rs                   SSH key generation and management.
```

---

## File Count Summary

| Directory              | Files   | Purpose                                      |
| ---------------------- | ------- | -------------------------------------------- |
| `src/` (top-level)     | 10      | App core, event handling, persistence, types |
| `src/core/`            | 14      | Game domain model                            |
| `src/ui/`              | 29      | UI framework, widgets, panels                |
| `src/game_engine/`     | 17      | Basketball simulation                        |
| `src/image/`           | 6       | Image processing and sprite generation       |
| `src/space_adventure/` | 16      | Space shooter minigame                       |
| `src/network/`         | 6       | P2P networking                               |
| `src/audio/`           | 2       | Music streaming                              |
| `src/ssh/`             | 4       | SSH server                                   |
| **Total**              | **104** |                                              |

Note: The README mentions 119 files; the difference may include non-Rust files (JSON data, assets) or test files not captured by this listing of `.rs` files only.
