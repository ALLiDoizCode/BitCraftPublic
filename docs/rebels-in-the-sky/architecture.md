# Architecture

## 1. Event-Driven Architecture

### AppEvent Enum

All events flow through a single `mpsc::channel(64)` as variants of `AppEvent`:

```rust
pub enum AppEvent {
    SlowTick(Tick),                           // 10Hz game simulation
    FastTick(Tick),                            // 40Hz animation/space adventure
    TerminalEvent(TerminalEvent),              // keyboard, mouse, resize, quit
    NetworkEvent(SwarmEvent<gossipsub::Event>),// P2P swarm events
    #[cfg(feature = "audio")]
    AudioEvent(MusicPlayerEvent),              // stream ok/error
}
```

### Multi-Source Aggregation

Three independent tokio tasks produce events into the same channel:

1. **CrosstermEventHandler** (100Hz polling) -- drains all pending crossterm events per tick, collapses consecutive scroll events to prevent queue backup, filters for `KeyEventKind::Press` only.

2. **TickEventHandler** -- runs two `tokio::time::interval` timers:
   - `slow_ticker` at 10Hz (100ms), `MissedTickBehavior::Delay` -- drives world simulation, UI update, save, network sync.
   - `fast_ticker` at 40Hz (25ms), `MissedTickBehavior::Burst` -- drives space adventure animation frames.

3. **NetworkHandler** -- polls the libp2p `Swarm` and forwards `SwarmEvent` variants.

4. **AudioEventLoop** (optional) -- forwards stream status events.

### Main Event Loop

`App::run()` is an `async` function that calls `self.event_receiver.recv().await` in a loop:

```rust
while self.state != AppState::Quitting {
    if let Some(app_event) = self.event_receiver.recv().await {
        match app_event {
            AppEvent::SlowTick(tick) => { /* world tick + draw */ }
            AppEvent::FastTick(tick) => { /* conditional draw */ }
            AppEvent::TerminalEvent(ev) => { /* input dispatch + conditional draw */ }
            AppEvent::NetworkEvent(ev) => { /* network handling */ }
            AppEvent::AudioEvent(ev) => { /* audio status */ }
        }
    }
}
```

Each branch decides whether to call `self.draw(tui)` based on whether state changed. For `FastTick`, drawing only happens during space adventures (`self.world.space_adventure.is_some()`). For key events during space adventures, drawing is suppressed to maintain consistent FPS from the fast tick.

---

## 2. Callback-Based UI Interaction

### The UiCallback Pattern

UI interactions produce `UiCallback` enum values (not closures). The enum has ~80 variants covering every user action:

```rust
pub enum UiCallback {
    None,
    GoToTeam { team_id: TeamId },
    GoToPlayer { player_id: PlayerId },
    ChallengeTeam { team_id: TeamId },
    TravelToPlanet { planet_id: PlanetId },
    SetUiTab { ui_tab: UiTab },
    NextPanelIndex,
    PreviousPanelIndex,
    StartSpaceAdventure,
    HirePlayer { player_id: PlayerId },
    TradeResource { resource: Resource, amount: i32, unit_cost: u32 },
    // ... ~70 more variants
}
```

### Separation of Render and Mutation

`UiCallback::call(&self, app: &mut App) -> AppResult<Option<String>>` converts each variant into an `AppCallback` closure that has mutable access to `App`. This is the **only** path for UI-triggered mutations:

```
Render (immutable World) -> UiCallback value -> call() -> AppCallback closure -> mutate App
```

Callbacks that return `Some(String)` trigger a popup message. Callbacks that return `Err` trigger an error popup.

### CallbackRegistry

The `CallbackRegistry` accumulates mouse and keyboard callbacks during rendering:

```rust
pub struct CallbackRegistry {
    mouse_callbacks: HashMap<MouseEventKind, HashMap<Option<Rect>, UiCallback>>,
    keyboard_callbacks: HashMap<KeyCode, UiCallback>,
    hovering: (u16, u16),
    active_layer: usize,
}
```

- **Mouse callbacks** map `(event_kind, optional_rect)` to callbacks. A `None` rect means global (e.g., scroll).
- **Keyboard callbacks** map `KeyCode` to callbacks (used by hotkeys).
- **Hover tracking** stores the current mouse position for hit-testing.
- **Layers** enable popups to capture input above the main UI (layer 0 = main, layer 1 = popup).

The registry is rebuilt every frame during `render()`, then stored back into `UiScreen.inner_registry` for the next input event.

---

## 3. State Machine Patterns

### AppState

Top-level application lifecycle:

```rust
pub enum AppState {
    Running,     // Normal game loop
    Simulating,  // Fast-forwarding time after loading a save
    Quitting,    // Exit sequence
}
```

### UiState

Controls which screen is active:

```rust
pub enum UiState {
    Splash,          // Title screen (new game / continue / quit)
    NewTeam,         // Team creation wizard
    Main,            // Tabbed panel view (the main game)
    SpaceAdventure,  // Full-screen space shooter minigame
}
```

### UiTab

Within `UiState::Main`, tabs select the active panel:

```rust
pub enum UiTab {
    MyTeam,      // Team management, shipyard, market
    Crews,       // Browse all teams
    Pirates,     // Browse all players
    Galaxy,      // Galaxy map with planet zoom
    Games,       // Watch/review basketball games
    Tournaments, // Tournament brackets
    SpaceCove,   // Base management (conditional on having a cove)
    Swarm,       // P2P chat, logs, rankings (conditional on network)
}
```

Tabs are dynamically added/removed: `SpaceCove` appears when the player builds one; `Swarm` is excluded when network is disabled.

### SpaceAdventure States

The space adventure is a real-time entity system (`SpaceAdventure`) with its own game loop driven by `FastTick`. It has an implicit state machine via the presence/absence of a player entity and the `should_stop` flag.

---

## 4. Model-View Separation

### World as Model

`World` is a flat struct of `HashMap` collections:

```rust
pub struct World {
    pub teams: TeamMap,          // HashMap<TeamId, Team>
    pub players: PlayerMap,      // HashMap<PlayerId, Player>
    pub planets: PlanetMap,      // HashMap<PlanetId, Planet>
    pub games: GameMap,          // HashMap<GameId, Game>
    pub tournaments: TournamentMap,
    pub space_adventure: Option<SpaceAdventure>,
    // tick counters, dirty flags, etc.
}
```

World is `Serialize + Deserialize` and saved to disk as gzipped JSON. The `#[serde(skip)]` attribute excludes transient fields: dirty flags, recently finished games, space adventure state.

### UiScreen as View

`UiScreen` holds all panel instances and display-only state:

```rust
pub struct UiScreen {
    pub state: UiState,
    ui_tabs: Vec<UiTab>,
    tab_index: usize,
    debug_view: bool,
    pub splash_screen: SplashScreen,
    pub new_team_screen: NewTeamScreen,
    pub space_screen: SpaceScreen,
    pub player_panel: PlayerListPanel,
    pub team_panel: TeamListPanel,
    pub game_panel: GamePanel,
    pub galaxy_panel: GalaxyPanel,
    pub my_team_panel: MyTeamPanel,
    pub tournament_panel: TournamentPanel,
    pub space_cove_panel: SpaceCovePanel,
    pub swarm_panel: SwarmPanel,
    popup_messages: Vec<PopupMessage>,
    popup_input: TextArea<'static>,
    inner_registry: CallbackRegistry,
}
```

Each panel implements the `Screen` trait and is updated via `update(&World)` which reads World immutably.

### Callbacks as Mutations

All state changes flow through `UiCallback::call(&self, &mut App)`. This gives callbacks mutable access to both `app.world` and `app.ui`, enabling cross-cutting operations (e.g., navigate to a panel AND set its index AND update its data).

---

## 5. Tick-Based Scheduling

### Multiple Tick Frequencies

| Source                    | Frequency | Interval | Purpose                                                  |
| ------------------------- | --------- | -------- | -------------------------------------------------------- |
| `slow_ticker`             | 10 Hz     | 100ms    | World simulation, UI update, save triggers, network sync |
| `fast_ticker`             | 40 Hz     | 25ms     | Space adventure entity updates, animation frames         |
| `crossterm_event_handler` | 100 Hz    | 10ms     | Input polling (not a tick, but a poll interval)          |
| `MAX_DRAW_FPS`            | 40 Hz     | 25ms     | Frame rate cap in `Tui::draw()`                          |

### World Tick Intervals

The World maintains four separate tick counters for different simulation granularities:

```rust
pub last_tick_min_interval: Tick,     // TickInterval::MIN
pub last_tick_short_interval: Tick,   // TickInterval::SHORT
pub last_tick_medium_interval: Tick,  // TickInterval::MEDIUM
pub last_tick_long_interval: Tick,    // TickInterval::LONG
```

`handle_slow_tick_events()` advances these counters and processes game logic at each interval (training, travel, exploration, game simulation, free agent refresh, etc.).

### Simulation on Load

When loading a save file, `simulate_loaded_world()` fast-forwards time by repeatedly calling `handle_slow_tick_events()` in a tight loop, advancing `last_tick_short_interval` by one `TickInterval::SHORT` per iteration. It renders progress visually every 250ms.

---

## 6. Dirty Flag Optimization

Three boolean flags on `World` gate expensive operations:

```rust
pub dirty: bool,         // Triggers save to disk
pub dirty_network: bool, // Triggers network broadcast of own team
pub dirty_ui: bool,      // Triggers UI panel updates
```

### How They Are Used

- **`dirty`**: Set by any callback that changes persistent state (team roster, resources, position). Checked in `handle_world_slow_tick_events()` -- if true, saves the world to disk and resets the flag.

- **`dirty_network`**: Set when team state changes that peers need to see. Triggers `send_own_team()`, tournament resend, trade resend, challenge resend. Also triggers `dial_seed()` if no peers are connected.

- **`dirty_ui`**: Set when World state changes that affect the display. Checked in `UiScreen::update()` to decide whether to recalculate dynamic tab visibility (SpaceCove tab). Reset after `ui.update()` completes.

### UI Update Strategy

During the main `UiState::Main`, `UiScreen::update()` calls `update(&World)` on **all** panels every slow tick, not just the active one. This ensures cross-panel navigation links (e.g., "Go to team" from the player panel) always have current data. The comment in the source acknowledges this as a trade-off:

```rust
// Update panels. Can we get away updating only the active one?
// Links between panels means they need to be updated.
// We call update explicitly whenever one of these links is clicked.
```

---

## 7. Layered Rendering Pipeline

### Image Composition Layer

The game renders rich visuals by compositing RGBA images:

1. **Base layer**: `UNIVERSE_BACKGROUND` (star field tiled from 3 star layer PNGs)
2. **Entity layer**: Planet GIFs, player sprites, spaceship sprites composited via `copy_non_transparent_from()` with alpha blending
3. **Light/mask layer**: `LightMaskStyle` variants (horizontal, vertical, radial, exponential) generate alpha masks applied to images
4. **Color mapping**: `ColorMap` replaces pure R/G/B pixels with team colors, with optional shadow mask for lighting

### Terminal Conversion Layer

`img_to_lines()` in `src/ui/utils.rs` converts an `RgbaImage` to `Vec<Line>`:

```rust
// For each pair of vertical pixels:
// - Both transparent: space character
// - Top opaque, bottom transparent: "▀" with fg=top color
// - Top transparent, bottom opaque: "▄" with fg=bottom color
// - Both opaque: "▀" with fg=top, bg=bottom
```

This achieves 2x vertical resolution by using Unicode half-block characters, making each terminal cell represent two pixels.

### Rendering Pipeline Per Frame

1. `UiScreen::render()` creates a `UiFrame` wrapper around ratatui's `Frame`
2. `UiFrame::new()` calculates a centered `screen_area` (target: 160x48) within the terminal
3. Layout splits into body (min 6 rows), footer (1 row), hover text (1 row)
4. The active screen's `render()` is called with the body area
5. Interactive widgets register callbacks in the `CallbackRegistry` during rendering
6. Popup messages render on a higher layer (layer 1) with their own input handling
7. The footer renders navigation hints, audio controls, and debug info (FPS, world size)
8. After `render()` completes, `inner_registry` is stored for use by the next input event
9. `Tui::draw()` enforces `MAX_DRAW_FPS` (40 FPS) via elapsed-time check before calling `terminal.draw()`
