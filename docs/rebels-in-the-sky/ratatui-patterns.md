# Ratatui Patterns Deep Dive

This document focuses specifically on how Rebels in the Sky uses ratatui, since this is the primary reason we are studying the project.

---

## 1. Tui Struct and Terminal Initialization

### Backend Abstraction

The `Tui<W>` struct wraps `Terminal<CrosstermBackend<W>>` where `W: WriterProxy`:

```rust
pub trait WriterProxy: io::Write + std::fmt::Debug {
    fn send(&mut self) -> impl Future<Output = io::Result<usize>> + Send {
        async { Ok(0) }
    }
}
```

Three backend configurations exist:

| Type    | Writer           | Viewport      | Use                         |
| ------- | ---------------- | ------------- | --------------------------- |
| `Local` | `io::Stdout`     | Full terminal | Normal desktop play         |
| `Ssh`   | `SSHWriterProxy` | Fixed 160x48  | Remote SSH sessions         |
| `Dummy` | `DummyWriter`    | Fixed 160x48  | Headless testing/simulation |

`DummyWriter` absorbs all writes silently. `SSHWriterProxy` buffers writes and flushes them over an SSH channel via the async `send()` method.

### Initialization Sequence

```rust
fn init(&mut self) -> AppResult<()> {
    // Only local backend enables raw mode (SSH handles it differently)
    if self.tui_type == TuiType::Local {
        terminal::enable_raw_mode()?;
    }
    crossterm::execute!(
        self.terminal.backend_mut(),
        EnterAlternateScreen,
        EnableMouseCapture,
        SetTitle("Rebels in the sky"),
        Clear(ClearType::All),
        Hide  // Hide cursor
    )?;
    // Custom panic hook resets terminal on crash (local only)
    if self.tui_type == TuiType::Local {
        let panic_hook = panic::take_hook();
        panic::set_hook(Box::new(move |panic| {
            Self::reset().expect("failed to reset the terminal");
            panic_hook(panic);
        }));
    }
    Ok(())
}
```

Key points for BitCraft:

- Always install a panic hook that resets the terminal.
- SSH backend uses `TerminalOptions` with `Viewport::Fixed` for consistent sizing.
- The `WriterProxy` trait abstraction makes it easy to add new backends (e.g., a web terminal).

### FPS Limiting

```rust
const MAX_DRAW_FPS: u8 = 40;

pub async fn draw(&mut self, ui: &mut UiScreen, world: &World, ...) -> AppResult<()> {
    if self.tui_type == TuiType::Dummy { return Ok(()); }
    if self.last_draw.elapsed() >= self.min_duration_between_draws {
        self.terminal.draw(|frame| { ui.render(frame, world, ...); })?;
        self.last_draw = Instant::now();
    }
    Ok(())
}
```

The draw call is gated by elapsed time, not by a separate timer. This means the actual FPS varies based on event frequency but never exceeds 40.

---

## 2. Screen Trait and SplitPanel Trait

### Screen Trait

Every viewable screen implements this trait:

```rust
pub trait Screen {
    fn update(&mut self, world: &World) -> AppResult<()>;
    fn render(
        &mut self,
        frame: &mut UiFrame,
        world: &World,
        area: Rect,
        debug_view: bool,
    ) -> AppResult<()>;
    fn handle_key_events(
        &mut self,
        key_event: KeyEvent,
        world: &World,
    ) -> Option<UiCallback> { None }
    fn footer_spans(&self) -> Vec<String> { vec![] }
}
```

- `update()` is called every slow tick (10Hz). Reads World immutably, updates panel-local display state (lists, indices, cached values).
- `render()` draws the screen into a `UiFrame` at the given `area`. Returns `AppResult` to report render errors gracefully (logged, not panicked).
- `handle_key_events()` processes keys not captured by the global handler or `CallbackRegistry`. Returns `Option<UiCallback>`.
- `footer_spans()` provides panel-specific footer text (key hints).

### SplitPanel Trait

For panels with a selectable list on the left and detail on the right:

```rust
pub trait SplitPanel {
    fn index(&self) -> Option<usize> { None }
    fn max_index(&self) -> usize { 0 }
    fn set_index(&mut self, index: usize) {}
    fn previous_index(&mut self) { /* wrapping decrement */ }
    fn next_index(&mut self) { /* wrapping increment */ }
}
```

This is used by `UiCallback::NextPanelIndex` and `PreviousPanelIndex` to provide uniform scroll-wheel and arrow-key navigation across all list panels.

### Dispatching in UiScreen

`UiScreen` routes to the active screen based on `(UiState, UiTab)`:

```rust
fn get_active_screen(&self) -> &dyn Screen {
    match self.state {
        UiState::Splash => &self.splash_screen,
        UiState::NewTeam => &self.new_team_screen,
        UiState::Main => match self.ui_tabs[self.tab_index] {
            UiTab::MyTeam => &self.my_team_panel,
            UiTab::Crews => &self.team_panel,
            // ... all tabs
        },
        UiState::SpaceAdventure => &self.space_screen,
    }
}
```

---

## 3. Custom Widgets

### Button

`Button<'a>` implements both `Widget` and `InteractiveWidget`:

```rust
pub struct Button<'a> {
    text: Text<'a>,
    hotkey: Option<KeyCode>,       // Keyboard shortcut
    on_click: UiCallback,          // Click handler
    disabled: bool,
    selected: bool,
    is_hovered: bool,              // Set during before_rendering()
    disabled_text: Option<Text<'a>>,
    style: Style,
    hover_style: Style,
    block: Option<Block<'a>>,      // Normal border
    hover_block: Option<Block<'a>>,// Border on hover
    hover_text: Option<Text<'a>>,  // Shown in hover area
    layer: usize,                  // For popup layering
}
```

Three constructor patterns:

- `Button::new(text, callback)` -- boxed button (default_block on both normal and hover)
- `Button::no_box(text, callback)` -- borderless, hover highlight only
- `Button::box_on_hover(text, callback)` -- borderless normally, boxed on hover

The `InteractiveWidget` implementation:

1. `before_rendering()`: Sets `is_hovered` based on mouse position and layer. Registers mouse click callback at the button's `Rect`. Registers keyboard callback for hotkey.
2. `hover_text()`: Returns the hover description (plus disabled reason if applicable).

Hotkey rendering: if a hotkey letter appears in the button text, it is rendered with `underlined()` style.

### ClickableList

`ClickableList<'a>` implements `StatefulWidget` and `InteractiveStatefulWidget`:

```rust
pub struct ClickableList<'a> {
    block: Option<Block<'a>>,
    items: Vec<ClickableListItem<'a>>,
    style: Style,
    direction: ListDirection,
    select_style: Style,           // UiStyle::SELECTED (dark background)
    hover_style: Style,            // UiStyle::HIGHLIGHT (teal foreground)
    highlight_symbol: Option<&'a str>,
    selection_offset: usize,       // For multi-column panels
    disabled_scrolling: bool,
}
```

The `before_rendering()` implementation:

1. Checks if the list area is hovered and on the active layer.
2. Registers scroll callbacks (`ScrollUp` -> `PreviousPanelIndex`, `ScrollDown` -> `NextPanelIndex`) as global (no rect).
3. Iterates visible items, finds which row the mouse hovers over.
4. Registers click callback for `SetPanelIndex { index }` on the hovered row.

Auto-scroll: `get_items_bounds()` calculates the visible range ensuring the selected item is always visible.

### ClickableTable

`ClickableTable<'a>` is a more complex table widget with:

- `ClickableRow` containing `ClickableCell` elements
- Column width constraints
- Header row
- Same hover/select pattern as ClickableList

### HoverTextSpan and HoverTextLine

Lightweight interactive widgets that display tooltip text in the hover area:

```rust
pub struct HoverTextSpan<'a> {
    span: Span<'a>,
    hover_text: String,
}
```

When the mouse hovers over the span's area, `hover_text` appears in the bottom bar. Used extensively for skill descriptions, resource info, and game stats.

---

## 4. UiFrame System

### UiFrame Wrapper

`UiFrame<'a, 'b>` wraps ratatui's `Frame<'b>` and adds:

```rust
pub struct UiFrame<'a, 'b> {
    inner: &'a mut Frame<'b>,
    hover_text_area: Rect,          // Bottom row for hover descriptions
    callback_registry: CallbackRegistry,
}
```

### Screen Area Centering

The game targets 160x48 characters. `screen_area()` centers this within the actual terminal:

```rust
pub fn screen_area(&self) -> Rect {
    let frame_width = self.inner.area().width;
    let frame_height = self.inner.area().height;
    let (target_width, target_height) = UI_SCREEN_SIZE; // (160, 48)
    Rect::new(
        frame_width.saturating_sub(target_width) / 2,
        frame_height.saturating_sub(target_height) / 2,
        target_width.min(frame_width),
        target_height.min(frame_height),
    )
}
```

### Interactive Rendering Methods

```rust
pub fn render_interactive_widget<W: InteractiveWidget>(&mut self, mut widget: W, area: Rect) {
    let is_hovered = self.is_hovered(area, widget.layer());
    widget.before_rendering(area, &mut self.callback_registry);
    if is_hovered {
        self.render_widget(Clear, self.hover_text_area);
        let hover_text = Paragraph::new(widget.hover_text()).centered();
        self.render_widget(hover_text, self.hover_text_area);
    }
    self.render_widget(widget, area);
}
```

The flow for every interactive widget:

1. Check if hovered (mouse position in rect AND correct layer)
2. Call `before_rendering()` to register callbacks
3. If hovered, clear and write hover text to the bottom bar
4. Render the widget normally

### Layer System

Layers prevent background widgets from receiving mouse events when a popup is open:

```rust
if !self.popup_messages.is_empty() {
    ui_frame.set_active_layer(1);
} else {
    ui_frame.set_active_layer(0);
}
```

Popups render their buttons with `set_layer(1)`. Background buttons stay at layer 0. The `CallbackRegistry::is_hovering()` check requires both position match AND layer match.

---

## 5. Rendering Pipeline

### Layout Structure

The main screen layout:

```
+--------------------------------------------+
|                 Body (min 6)               |
|  +--------+------------------------------+ |
|  | Tabs   | (3 rows, horizontal split)   | |
|  +--------+------------------------------+ |
|  | Active Panel (rest of body)           | |
|  |                                        | |
|  +----------------------------------------+ |
+--------------------------------------------+
| Footer (1 row)                              |
+--------------------------------------------+
| Hover Text (1 row)                          |
+--------------------------------------------+
```

### Per-Frame Flow

1. **Create UiFrame**: Wraps ratatui Frame, sets up screen area and hover text area.
2. **Transfer hover state**: `ui_frame.set_hovering(self.inner_registry.hovering())` -- mouse position from last input event.
3. **Set layer**: 0 for main, 1 if popups exist.
4. **Layout split**: body / footer / hover text.
5. **Render active screen**: Dispatches to the current `Screen` impl's `render()`.
6. **Render tab bar** (Main state only): Horizontal layout of `Button` widgets, selected tab uses thick border.
7. **Render footer**: Key hints, audio controls, debug info (FPS, world size, frame size).
8. **Render popup** (if any): On layer 1, centered in screen area.
9. **Store registry**: `self.inner_registry = ui_frame.callback_registry().clone()` -- preserves callbacks for next input event.

### Update Cycle

`UiScreen::update()` is called every slow tick (10Hz):

- In `UiState::Splash`: Updates splash screen only.
- In `UiState::NewTeam`: Updates creation wizard only.
- In `UiState::Main`: Updates ALL panels (my_team, teams, players, games, tournaments, galaxy, space_cove, swarm). This ensures data is fresh for cross-panel navigation.
- In `UiState::SpaceAdventure`: Updates space screen only.

---

## 6. Color System and UiStyle

### UiStyle Constants

All styles are `const` values on the `UiStyle` struct:

```rust
pub struct UiStyle;
impl UiStyle {
    pub const DEFAULT: Style = Style { fg: None, bg: None, ... };
    pub const SELECTED: Style = Self::DEFAULT.bg(Color::Rgb(70, 70, 86));
    pub const SELECTED_BUTTON: Style = Self::DEFAULT.fg(Color::Rgb(118, 213, 192));
    pub const UNSELECTABLE: Style = Self::DEFAULT.fg(Color::DarkGray);
    pub const ERROR: Style = Self::DEFAULT.fg(Color::Red);
    pub const OWN_TEAM: Style = Self::DEFAULT.fg(Color::Rgb(185, 225, 125));
    pub const HEADER: Style = Self::DEFAULT.fg(Color::LightBlue);
    pub const NETWORK: Style = Self::DEFAULT.fg(Color::Rgb(204, 144, 184));
    pub const HIGHLIGHT: Style = Self::DEFAULT.fg(Color::Rgb(118, 213, 192));
    pub const OK: Style = Self::DEFAULT.fg(Color::Green);
    pub const WARNING: Style = Self::DEFAULT.fg(Color::Yellow);
    pub const SHIELD: Style = Self::DEFAULT.fg(Color::LightMagenta);
}
```

### Semantic Color Mapping via UiStyled Trait

The `UiStyled` trait provides context-dependent styling:

```rust
impl UiStyled for f32 {
    fn style(&self) -> Style {
        match self.rating() {
            0.0 => Style::default().fg(Color::DarkGray),
            x if x <= 2.0 => Style::default().fg(Color::Red),
            x if x <= 6.0 => Style::default().fg(Color::Yellow),
            x if x <= 10.0 => Style::default().fg(Color::White),
            x if x <= 16.0 => Style::default().fg(Color::Green),
            _ => Style::default().fg(Color::Rgb(155, 95, 205)),  // Purple for exceptional
        }
    }
}
```

Resource colors are RGB-specific:

- GOLD: `(240, 230, 140)` -- warm yellow
- SCRAPS: `(192, 192, 192)` -- silver
- RUM: `(114, 47, 55)` -- dark red
- FUEL: `(64, 224, 208)` -- teal
- SATOSHI: `(255, 255, 255)` -- white

---

## 7. GIF/Animation Support

### GifMap Cache

`GifMap` is the central animation cache. It stores pre-rendered `GifLines` (Vec of Vec of Line) keyed by entity ID:

```rust
pub struct GifMap {
    planet_gifs_zoom_in: HashMap<PlanetId, GifLines>,
    planet_gifs_zoom_out: HashMap<PlanetId, GifLines>,
    player_gifs: HashMap<PlayerId, GifLines>,
    spaceship_gifs: HashMap<SpaceshipImageId, GifLines>,
    // ...
}
```

Frame selection uses a tick counter: `lines[tick % lines.len()]`.

### Static GIF Constants

Some animations are loaded once at startup:

```rust
pub static SPINNING_BALL_GIF: LazyLock<GifLines> = LazyLock::new(|| { ... });
pub static LEFT_SHOT_GIF: LazyLock<GifLines> = ...;
pub static RIGHT_SHOT_GIF: LazyLock<GifLines> = ...;
pub static PORTAL_GIFS: LazyLock<Vec<GifLines>> = ...;
```

### GIF Generation Pipeline

For dynamic sprites (e.g., planet with rotating rings):

1. Load GIF frames from embedded assets via `open_gif()`
2. For each frame:
   a. Clone `UNIVERSE_BACKGROUND`
   b. Composite the GIF frame onto it via `copy_non_transparent_from()`
   c. Apply color maps (`apply_color_map()`)
   d. Apply light masks (`apply_light_mask()`)
   e. Crop to desired viewport
3. Convert each frame with `img_to_lines()`
4. Cache the `GifLines` for reuse

Frames per revolution for planet rotation: `FRAMES_PER_REVOLUTION = 360`.

---

## 8. Image-to-Text Conversion

### The Half-Block Technique

`img_to_lines()` converts an `RgbaImage` to terminal-renderable lines:

```rust
pub fn img_to_lines(img: &RgbaImage) -> Vec<Line> {
    for y in (0..height.saturating_sub(1)).step_by(2) {  // Process 2 rows at a time
        for x in 0..width {
            let top_pixel = img.get_pixel(x, y);
            let btm_pixel = img.get_pixel(x, y + 1);

            if top_pixel[3] == 0 && btm_pixel[3] == 0 {
                line.push(Span::raw(" "));                    // Both transparent
            } else if top_pixel[3] > 0 && btm_pixel[3] == 0 {
                line.push(Span::styled("▀", fg(top_color)));  // Top only
            } else if top_pixel[3] == 0 && btm_pixel[3] > 0 {
                line.push(Span::styled("▄", fg(btm_color)));  // Bottom only
            } else {
                line.push(Span::styled("▀",
                    fg(top_color).bg(btm_color)));             // Both: fg=top, bg=bottom
            }
        }
    }
}
```

Each terminal cell represents **2 vertical pixels** using the half-block character `▀` (upper half block). The foreground color encodes the top pixel; the background color encodes the bottom pixel. This achieves double vertical resolution compared to naive character rendering.

### Alpha Handling

Only full transparency (alpha == 0) is treated as transparent. Partial alpha is handled during image composition (blending in `copy_non_transparent_from()`) before the terminal conversion step.

### Image Composition Utilities

The `ExtraImageUtils` trait on `RgbaImage` provides:

- `copy_non_transparent_from()` -- Alpha-blended blit of one image onto another
- `copy_non_transparent_from_clipped()` -- Clipped variant for sub-regions
- `apply_color_map()` -- Replaces pure R/G/B pixels with team colors
- `apply_color_map_with_shadow_mask()` -- Color mapping + shadow/highlight from a mask image
- `apply_light_mask()` -- Procedural lighting via `LightMaskStyle`

`LightMaskStyle` generates alpha masks procedurally:

- `Horizontal` -- left-to-right gradient
- `Vertical` -- top-to-bottom gradient
- `Radial` -- center-to-edge gradient
- `Exponential` -- sharp falloff from center (used for pointer highlighting)

---

## 9. Input Handling

### Event Flow

```
CrosstermEventHandler (100Hz tokio task)
  -> polls crossterm::event::poll() with ZERO duration (non-blocking drain)
  -> collapses consecutive scroll events
  -> sends AppEvent::TerminalEvent(TerminalEvent::Key/Mouse/Resize/Quit)
     via mpsc channel

App::run() event loop
  -> receives AppEvent
  -> TerminalEvent::Key -> App::should_draw_key_events()
     -> Ctrl-C: immediate quit
     -> other: UiScreen::handle_key_events()
       -> ESC: push PromptQuit popup
       -> Tab/BackTab: switch tabs
       -> SpaceAdventure keys: SpaceScreen::handle_key_events()
       -> Popup active: popup consumes input
       -> Active screen: Screen::handle_key_events()
       -> Fallback: inner_registry.handle_keyboard_event()
     -> returns Option<UiCallback>
     -> callback.call(app)

  -> TerminalEvent::Mouse -> App::should_draw_mouse_events()
     -> UiScreen::handle_mouse_events()
       -> updates hover position in inner_registry
       -> inner_registry.handle_mouse_event()
         -> checks mouse_callbacks map for matching (event_kind, rect)
       -> returns Option<UiCallback>
     -> callback.call(app)

  -> TerminalEvent::Resize -> tui.resize() + draw
```

### Scroll Event Collapsing

The crossterm handler batches all pending events per 10ms poll cycle and collapses consecutive scrolls:

```rust
let mut last_scroll = None;
for ev in events {
    match ev {
        CrosstermEvent::Mouse(mouse) if is_scroll(mouse.kind) => {
            last_scroll = Some(mouse);  // Replace pending scroll
        }
        _ => {
            if let Some(scroll) = last_scroll.take() {
                // Flush pending scroll before non-scroll event
                event_sender.send(AppEvent::TerminalEvent(TerminalEvent::Mouse(scroll))).await;
            }
            // Process non-scroll event normally
        }
    }
}
if let Some(scroll) = last_scroll.take() {
    event_sender.send(...).await;  // Flush final scroll
}
```

This prevents scroll events from overwhelming the event queue during fast scrolling.

### Key Routing Priority

1. `Ctrl-C` -- always quits (handled in `App::should_draw_key_events`)
2. `ESC` -- push quit prompt (handled in `UiScreen::handle_key_events`)
3. `Tab`/`BackTab` -- tab navigation (handled in `UiScreen`)
4. Space adventure keys -- routed directly to `SpaceScreen` (takes priority over popups for gameplay responsiveness)
5. Popup input -- popup's `consumes_input()` handles Enter/Esc/text
6. Active screen's `handle_key_events()`
7. `CallbackRegistry` hotkey lookup (fallback)

---

## 10. All UI Panels

### Full-Screen Screens

| Screen          | File                 | Purpose                                                                                                                                                                                                                                                                        |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SplashScreen`  | `splash_screen.rs`   | Title screen. Logo display, New/Continue/Quit buttons. Audio state display. Save file detection for Continue button.                                                                                                                                                           |
| `NewTeamScreen` | `new_team_screen.rs` | Team creation wizard. Three-step state machine: `Players` -> `Ship` -> `Name`. Player draft selection, jersey color picker (3-channel with presets), spaceship prefab selection, team name text input.                                                                         |
| `SpaceScreen`   | `space_screen.rs`    | Real-time space adventure. Reads `SpaceAdventure` entity system, renders all entities as sprites via image-to-text. Key bindings: WASD movement, Space shoot, Q back to base, Z shield, X autofire, C release scraps. HUD overlay with durability, fuel, charge, storage bars. |

### Tabbed Panels (UiState::Main)

| Panel             | File                  | Trait               | Sub-Views                                           | Key Features                                                                                                                                                             |
| ----------------- | --------------------- | ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MyTeamPanel`     | `my_team_panel.rs`    | Screen + SplitPanel | Info, Roster, Market, Shipyard, Asteroids, Strategy | Team info with spaceship image. Roster with drag-to-reorder. Resource market with buy/sell buttons. Spaceship upgrade comparison. Asteroid management. Strategy toggles. |
| `TeamListPanel`   | `team_panel.rs`       | Screen + SplitPanel | OpenToChallenge, Ranking                            | Scrollable team list. Team detail with spaceship description. Challenge button (local/network). Elo rankings.                                                            |
| `PlayerListPanel` | `player_panel.rs`     | Screen + SplitPanel | AllPirates, FreePirates, OwnTeam, Trades            | Player list with skill display. Player detail with animated sprite. Skills/Stats toggle view. Lock/compare two players. Hire/release/trade actions.                      |
| `GamePanel`       | `game_panel.rs`       | Screen + SplitPanel | (live game / completed games)                       | Basketball court rendering with animated sprites. Big-number scoreboard. Play-by-play log. Player stats table. Pitch view toggle (top-down / side).                      |
| `TournamentPanel` | `tournament_panel.rs` | Screen + SplitPanel | Active, Completed                                   | Tournament list. Bracket display. Registration. Round results.                                                                                                           |
| `GalaxyPanel`     | `galaxy_panel.rs`     | Screen + SplitPanel | ZoomIn, ZoomOut                                     | Planet list. Zoomed-in: planet GIF, teams present, travel/explore buttons. Zoomed-out: star map with planet positions, distance info.                                    |
| `SpaceCovePanel`  | `space_cove_panel.rs` | Screen + SplitPanel | (base view)                                         | Asteroid base overview. Building upgrades. Resource production. Conditional on having a constructed space cove.                                                          |
| `SwarmPanel`      | `swarm_panel.rs`      | Screen + SplitPanel | Chat, Logs, TeamRanking, PlayerRanking              | P2P chat with TextArea input. Event logs. Leaderboards. Unread message counter on tab.                                                                                   |

### Popup System

`PopupMessage` is an enum with ~10 variants:

```rust
pub enum PopupMessage {
    Ok { message: String, is_skippable: bool, timestamp: Tick },
    Error { message: String, timestamp: Tick },
    PromptQuit { during_space_adventure: bool, timestamp: Tick },
    Tutorial { index: usize, timestamp: Tick },
    AsteroidNameDialog { timestamp: Tick, asteroid_type: ... },
    PortalFound { player_name: String, portal_target: String, timestamp: Tick },
    ConfirmSpaceAdventure { has_shooter: bool, average_tiredness: f32, timestamp: Tick },
    BuildSpaceCove { asteroid_name: String, asteroid_id: PlanetId, timestamp: Tick },
}
```

Popups form a stack (max 8). Rendering always shows `popup_messages[0]`. `close_popup()` removes index 0. Skippable popups are auto-evicted when the stack is full.

Each popup variant implements its own `render()` and `consumes_input()` logic. Some popups include text input (e.g., naming an asteroid), some have Yes/No buttons, some are informational with just an OK button.
