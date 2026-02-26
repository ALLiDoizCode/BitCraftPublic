# Rebels in the Sky -- Architecture Reference

**Purpose**: This documentation captures the architecture and patterns from *Rebels in the Sky* (v1.5.10), a ~44k-line Rust terminal game, as **UI/TUI inspiration for building a SpacetimeDB-connected ratatui game client for BitCraft**.

The project is a fully-featured ratatui application with P2P networking, image rendering, GIF animation, mouse interaction, a space-shooter minigame, and a basketball simulation engine. The networking layer (libp2p gossipsub) is less relevant to our goals; the rendering, event handling, state management, and widget patterns are directly transferable.

---

## Repository

- **Author**: Alessandro Ricottone
- **License**: GPL-3.0-or-later
- **Repo**: <https://github.com/ricott1/rebels-in-the-sky>
- **Crate name**: `rebels` (on crates.io)
- **Rust edition**: 2021
- **Lines of Rust**: ~44,000 across 119 files

---

## Documentation Index

| Document | Contents |
|---|---|
| [architecture.md](architecture.md) | Event-driven architecture, callback-based UI, state machines, tick scheduling, dirty flags, rendering pipeline |
| [source-tree-analysis.md](source-tree-analysis.md) | Annotated directory tree of all 119 `.rs` files with per-file descriptions |
| [ratatui-patterns.md](ratatui-patterns.md) | Deep dive on ratatui usage: Tui struct, Screen/SplitPanel traits, custom widgets, UiFrame, rendering pipeline, color system, image-to-text, input handling, all panels |
| [data-models.md](data-models.md) | Core data structures: World, Team, Player, Skill, Resource, Game, SpaceAdventure, serialization |

---

## Key Dependencies

| Crate | Version | Role |
|---|---|---|
| `ratatui` | 0.29 | TUI framework (crossterm backend) |
| `tokio` | 1.49 | Async runtime (rt, time, macros, sync) |
| `crossterm` | (via ratatui) | Terminal raw mode, mouse capture, events |
| `image` / `imageproc` | 0.25 / 0.26 | RGBA image manipulation for sprite rendering |
| `gif` | 0.14 | GIF decoding for animated sprites |
| `libp2p` | 0.56 | P2P networking (gossipsub, noise, yamux) |
| `serde` / `serde_json` | 1.0 | World serialization |
| `flate2` | 1.1 | Gzip compression for save files |
| `glam` | 0.31 | 2D vector math (space adventure physics) |
| `tui-textarea` | 0.7 | Text input widget (chat, naming) |
| `clap` | 4.5 | CLI argument parsing |
| `uuid` | 1.20 | Entity IDs (v4) |
| `rand` / `rand_chacha` | 0.9 | Deterministic RNG (ChaCha8) |
| `strum` | 0.27 | Enum iteration and display |
| `include_dir` | 0.7 | Embed assets directory at compile time |

### Feature Flags

| Feature | Dependencies | Purpose |
|---|---|---|
| `audio` (default) | `rodio`, `stream-download`, `url` | Internet radio streaming |
| `ssh` | `russh` | SSH server mode (remote play) |
| `relayer` | (none) | P2P relay node mode |

---

## Architecture Summary (one paragraph)

The application follows a **single-threaded async event loop** pattern. Three independent tokio tasks produce events -- terminal input at 100Hz, slow ticks at 10Hz, fast ticks at 40Hz -- and send them through a single `mpsc::channel<AppEvent>` to the main `App::run()` loop. The main loop dispatches each event: tick events advance the `World` simulation and trigger redraws; terminal events are routed through the `UiScreen` state machine to produce `UiCallback` values; callbacks are closures (`Box<dyn Fn(&mut App) -> Result<Option<String>>>`) that mutate `App` state. The `World` model and `UiScreen` view are strictly separated: screens hold only display state and read the World immutably during `update()` and `render()`, while all mutations flow through callbacks. Dirty flags (`dirty`, `dirty_ui`, `dirty_network`) on `World` gate expensive operations (save, redraw, network sync). Rendering converts RGBA images to Unicode half-block characters and composites them with ratatui's `Span`/`Line` primitives, achieving rich visual output in a standard terminal.

---

## Transferability to BitCraft Client

| Rebels Pattern | BitCraft Application |
|---|---|
| `mpsc::channel<AppEvent>` aggregating ticks + input + network | Same pattern, with SpacetimeDB subscription events replacing P2P |
| `UiCallback` enum -> `AppCallback` closures | Identical pattern for separating UI render from state mutation |
| `Screen` trait with `update(&World)` + `render(&mut UiFrame, &World)` | Each BitCraft panel implements the same trait against SpacetimeDB state |
| `CallbackRegistry` for mouse hit-testing | Directly reusable for interactive TUI elements |
| `img_to_lines()` half-block rendering | Map tile / sprite rendering in terminal |
| `GifMap` cached animated sprites | Animated entity sprites in the game world |
| Dirty flag optimization | Gate re-renders on subscription diff callbacks |
| `Tui` struct with `WriterProxy` trait | Support local, SSH, and headless backends |
| Tick-based scheduling at multiple frequencies | Separate game tick from render tick from network poll |
