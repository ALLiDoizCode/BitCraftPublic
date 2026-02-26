# Data Models

Core data structures in the Rebels in the Sky codebase.

---

## 1. World State Structure

### World Struct

The central game state container. Serializable to disk.

```rust
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct World {
    // -- Dirty flags (transient, not serialized) --
    #[serde(skip)] pub dirty: bool,          // Triggers save to disk
    #[serde(skip)] pub dirty_network: bool,  // Triggers network broadcast
    #[serde(skip)] pub dirty_ui: bool,       // Triggers UI refresh

    pub serialized_size: u64,                 // Last known save file size
    pub seed: u64,                            // World generation seed

    // -- Tick counters (simulation time tracking) --
    pub last_tick_min_interval: Tick,
    pub last_tick_short_interval: Tick,
    pub last_tick_medium_interval: Tick,
    pub last_tick_long_interval: Tick,

    // -- Entity collections --
    pub own_team_id: TeamId,
    pub teams: TeamMap,                       // HashMap<TeamId, Team>
    pub players: PlayerMap,                   // HashMap<PlayerId, Player>
    pub planets: PlanetMap,                   // HashMap<PlanetId, Planet>
    pub games: GameMap,                       // HashMap<GameId, Game> (active games)
    pub past_games: GameSummaryMap,           // HashMap<GameId, GameSummary> (historical)
    pub kartoffeln: KartoffelMap,             // HashMap<KartoffelId, Kartoffel>
    pub tournaments: TournamentMap,
    pub past_tournaments: TournamentSummaryMap,
    pub network_keypair: Option<Vec<u8>>,     // Persistent P2P identity

    // -- Transient state --
    #[serde(skip)] pub space_adventure: Option<SpaceAdventure>,
    #[serde(skip)] pub recently_finished_games: GameMap,
    #[serde(skip)] pub recently_finished_tournaments: TournamentMap,
}
```

### ID Types

All entity IDs are UUID v4:

```rust
pub type PlayerId = uuid::Uuid;
pub type TeamId = uuid::Uuid;
pub type PlanetId = uuid::Uuid;
pub type GameId = uuid::Uuid;
pub type KartoffelId = uuid::Uuid;
```

### Tick System

`Tick` is a `u64` representing milliseconds since Unix epoch:

```rust
pub type Tick = u64;

// Constants from core/constants.rs:
pub const SECONDS: Tick = 1_000;
pub const MINUTES: Tick = 60 * SECONDS;
pub const HOURS: Tick = 60 * MINUTES;
pub const DAYS: Tick = 24 * HOURS;
```

The World uses four tick intervals for different simulation frequencies. `handle_slow_tick_events()` advances time by checking if enough real time has passed since each `last_tick_*` counter.

### Dirty Flags

| Flag | Set by | Checked by | Action when true |
|---|---|---|---|
| `dirty` | Callbacks that change persistent state | `handle_world_slow_tick_events()` | `save_world()`, then reset |
| `dirty_network` | Callbacks that change team-visible state | `handle_world_slow_tick_events()` | `send_own_team()`, resend trades/challenges/tournaments |
| `dirty_ui` | Callbacks, tick events | `UiScreen::update()` | Recalculate dynamic tab visibility, then reset |

---

## 2. Team and Player

### Team Struct

```rust
pub struct Team {
    pub id: TeamId,
    pub name: String,
    pub version: u32,                         // Incremented on significant changes
    pub peer_id: Option<PeerId>,              // Network identity (None for local teams)
    pub jersey: Jersey,
    pub spaceship: Spaceship,
    pub player_ids: Vec<PlayerId>,            // Ordered by position
    pub home_planet_id: PlanetId,
    pub current_location: TeamLocation,
    pub resources: ResourceMap,
    pub reputation: Skill,                    // 0.0 - 20.0 scale
    pub game_tactic: Tactic,
    pub training_focus: Option<TrainingFocus>,
    pub current_game: Option<GameId>,
    pub creation_time: Tick,
    pub total_travelled: u64,                 // Distance in game units
    pub asteroid_ids: Vec<PlanetId>,
    pub space_cove: Option<SpaceCove>,
    pub number_of_space_adventures: u32,

    // Network interaction state
    pub received_challenges: HashMap<TeamId, Challenge>,
    pub sent_challenges: HashMap<TeamId, Challenge>,
    pub received_trades: HashMap<(PlayerId, PlayerId), Trade>,
    pub sent_trades: HashMap<(PlayerId, PlayerId), Trade>,
    pub is_organizing_tournament: Option<TournamentId>,
    pub tournament_registration_state: TournamentRegistrationState,
    pub autonomous_strategy: AutonomousStrategy,

    // Rating
    pub local_game_rating: GameRating,
    pub network_game_rating: GameRating,
    pub honours: HashSet<Honour>,

    // Historical
    pub historical_stats: TeamHistoricalStats,
}
```

### TeamLocation Enum

```rust
pub enum TeamLocation {
    OnPlanet { planet_id: PlanetId },
    Travelling {
        from: PlanetId,
        to: PlanetId,
        started: Tick,
        duration: Tick,
        distance: u64,
    },
    Exploring {
        around: PlanetId,
        started: Tick,
        duration: Tick,
    },
    OnSpaceAdventure { around: PlanetId },
}
```

### Player Struct

```rust
pub struct Player {
    pub id: PlayerId,
    pub peer_id: Option<PeerId>,
    pub team: Option<TeamId>,
    pub info: PlayerInfo,                     // name, age, height, weight, population
    pub current_location: PlayerLocation,
    pub special_trait: Option<Trait>,

    // 20 skill fields grouped into 5 categories:
    // Athletics (4 skills)
    pub athletics: Skill,
    // Offense (4 skills): close_range, medium_range, long_range, passing
    pub offense: Skill,
    // Defense (4 skills): steal, block, perimeter, interior
    pub defense: Skill,
    // Technical (4 skills): ball_handling, post_moves, rebounding, hustle
    pub technical: Skill,
    // Mental (4 skills): vision, aggression, charisma, focus
    pub mental: Skill,

    pub previous_skills: [f32; 20],           // For showing improvement arrows
    pub reputation: Skill,
    pub jersey: Jersey,
    pub historical_stats: PlayerHistoricalStats,
}
```

### Trait Enum (Player Special Traits)

```rust
pub enum Trait {
    Killer,        // Increased offense in clutch
    Showpirate,    // Flashy plays, morale effects
    Relentless,    // Reduced tiredness
    Spugna,        // Rum bonuses, portal discovery
    Crumiro,       // Economic bonuses
}
```

---

## 3. Skill System

### Structure

20 individual skills, each a `f32` value in range `[0.0, 20.0]`:

```rust
pub const MIN_SKILL: f32 = 0.0;
pub const MAX_SKILL: f32 = 20.0;

pub const SKILL_NAMES: [&str; 20] = [
    // Athletics (index 0-3)
    "Speed", "Stamina", "Strength", "Jumping",
    // Offense (4-7)
    "Close range", "Medium range", "Long range", "Passing",
    // Defense (8-11)
    "Steal", "Block", "Perimeter", "Interior",
    // Technical (12-15)
    "Handling", "Post moves", "Rebounding", "Hustle",
    // Mental (16-19)
    "Vision", "Aggression", "Charisma", "Focus",
];
```

### Rating System

The `Rated` trait provides star ratings and display:

```rust
pub trait Rated {
    fn rating(&self) -> f32;     // 0.0 - 20.0 -> star scale
    fn value(&self) -> u8;       // Integer display value
    fn stars(&self) -> String;   // Unicode star display
    fn bound(&self) -> f32;      // Clamped to valid range
}
```

### Position Rating

Each basketball position (PG, SG, SF, PF, C) has weighted skill requirements:

```rust
pub type GamePosition = u8;
pub const MAX_GAME_POSITION: GamePosition = 5;
// 0=PG, 1=SG, 2=SF, 3=PF, 4=C
```

`player_rating()` computes a weighted average of the player's skills for a given position.

---

## 4. Resource System

### Resource Enum

```rust
pub enum Resource {
    GOLD,     // Rare, high value. Storage cost: 5 per unit.
    SCRAPS,   // Common building material. Storage cost: 1 per unit.
    RUM,      // Consumable (drink for morale). Storage cost: 2 per unit.
    FUEL,     // Spaceship fuel. Stored in tank (separate capacity).
    SATOSHI,  // Currency. Zero storage cost (infinite capacity).
}
```

### ResourceMap

```rust
pub type ResourceMap = HashMap<Resource, u32>;
```

The `StorableResourceMap` trait provides:

```rust
pub trait StorableResourceMap {
    fn value(&self, resource: &Resource) -> u32;
    fn used_storage_capacity(&self) -> u32;     // Sum of (amount * storing_space) excl. FUEL
    fn used_fuel_capacity(&self) -> u32;         // Just FUEL amount
    fn add(&mut self, resource: Resource, amount: u32, max_capacity: u32) -> AppResult<()>;
    fn saturating_add(&mut self, resource: Resource, amount: u32, max_capacity: u32);
    fn sub(&mut self, resource: Resource, amount: u32) -> AppResult<()>;
    fn saturating_sub(&mut self, resource: Resource, amount: u32);
}
```

Storage and fuel have separate capacities. SATOSHI has no storage limit. `add()` fails if capacity exceeded; `saturating_add()` adds up to capacity.

---

## 5. Planet

```rust
pub struct Planet {
    pub id: PlanetId,
    pub name: String,
    pub planet_type: PlanetType,              // Star, Dwarf, Earth, etc.
    pub filename: String,                      // Asset file for GIF
    pub position: (f64, f64, f64),            // Cartesian coordinates
    pub axis: (f64, f64),                      // Orbital parameters
    pub satellite: PlanetSatellite,
    pub team_ids: Vec<TeamId>,                 // Teams currently on planet
    pub populations: HashMap<Population, u32>, // Species distribution
    pub resources: ResourceMap,                // Planet's natural resources
    pub asteroid_probability: f64,
    pub peer_id: Option<PeerId>,              // Network-owned planet
    pub version: u32,
    pub upgrades: HashSet<AsteroidUpgradeTarget>,
    pub pending_upgrade: Option<Upgrade<AsteroidUpgradeTarget>>,
}
```

Planets are loaded from embedded JSON data (`PLANET_DATA`). Coordinates define positions in a 3D galaxy space. `AU` and `LIGHT_YEAR` constants define distance units.

---

## 6. Game / Basketball Simulation Types

### Game Struct

```rust
pub struct Game {
    pub id: GameId,
    pub home_team_in_game: TeamInGame,
    pub away_team_in_game: TeamInGame,
    pub action_results: Vec<ActionResult>,    // Play-by-play log
    pub timer: GameTimer,
    pub possession: Possession,
    pub starting_at: Tick,
    pub ended_at: Option<Tick>,
}
```

### TeamInGame

A snapshot of a team at game start:

```rust
pub struct TeamInGame {
    pub team_id: TeamId,
    pub name: String,
    pub players: PlayerMap,                   // Copy of player state at game start
    pub stats: GameStatsMap,                  // Per-player game stats
    pub initial_positions: Vec<PlayerId>,
    pub tactic: Tactic,
}
```

### GameSummary

Lightweight record persisted after game completion:

```rust
pub struct GameSummary {
    pub id: GameId,
    pub home_team_id: TeamId,
    pub away_team_id: TeamId,
    pub home_team_name: String,
    pub away_team_name: String,
    pub home_score: u16,
    pub away_score: u16,
    pub played_at: Tick,
}
```

### Tactic Enum

```rust
pub enum Tactic {
    Balanced,
    FastBreak,
    PostUp,
    IsolationHeavy,
    PickAndRoll,
    // etc.
}
```

### Tournament

```rust
pub struct Tournament {
    pub id: TournamentId,
    pub name: String,
    pub organizer_id: TeamId,
    pub tournament_type: TournamentType,
    pub state: TournamentState,
    pub max_participants: usize,
    pub registered_teams: HashMap<TeamId, (Team, PlayerMap)>,
    pub bracket: Vec<Vec<(TeamId, TeamId)>>,
    pub results: Vec<Vec<GameSummary>>,
    pub registrations_closing_at: Tick,
}
```

---

## 7. Space Adventure Entity System

### SpaceAdventure

The real-time minigame state:

```rust
pub struct SpaceAdventure {
    entities: Vec<Option<Entity>>,            // Sparse entity array
    player_id: Option<usize>,                 // Index of player entity
    camera_position: I16Vec2,
    should_stop: bool,
    // spawn timers, difficulty scaling, etc.
}
```

### Entity System Traits

```rust
pub trait Body: Collider {
    fn previous_position(&self) -> I16Vec2;
    fn position(&self) -> I16Vec2;
    fn velocity(&self) -> I16Vec2;
    fn update_body(&mut self, deltatime: f32) -> Vec<SpaceCallback>;
}

pub trait Sprite {
    fn image(&self) -> &RgbaImage;
    fn apply_visual_effects(&self, image: &RgbaImage) -> RgbaImage;
}

pub trait Collider {
    fn collision_damage(&self) -> f32;
    fn collider_type(&self) -> ColliderType;
    fn hit_box(&self) -> &HitBox;
}

pub trait GameEntity: Sprite + Body + Collider {
    fn set_id(&mut self, id: usize);
    fn id(&self) -> usize;
    fn layer(&self) -> usize;
    fn update(&mut self, deltatime: f32) -> Vec<SpaceCallback>;
}
```

### Entity Types

| Entity | Purpose |
|---|---|
| `SpaceshipEntity` | Player-controlled ship. Movement, shooting, shield, autofire, resource storage. |
| `Asteroid` | Destructible obstacle. Drops fragments on destruction. |
| `Fragment` | Resource pickup (GOLD, SCRAPS, RUM, FUEL). Collectible on contact. |
| `Collector` | Tractor beam target. |
| `Projectile` | Bullet with origin tracking and shield filtering. |
| `Shield` | Damage absorption entity attached to player. |
| `Particle` | Visual-only (explosions, trails). |

### SpaceCallback

Inter-entity communication:

```rust
pub enum SpaceCallback {
    DamageEntity { id: usize, damage: f32 },
    CollectFragment { id: usize, resource: Resource, amount: u32 },
    SpawnProjectile { ... },
    DestroyEntity { id: usize },
    SpawnExplosion { ... },
    // etc.
}
```

### ControllableSpaceship Trait

Interface between UI input and spaceship entity:

```rust
pub trait ControllableSpaceship {
    fn is_player(&self) -> bool;
    fn fuel(&self) -> u32;
    fn resources(&self) -> &ResourceMap;
    fn max_speed(&self) -> u32;
    fn current_charge(&self) -> u32;
    fn current_durability(&self) -> u32;
    fn max_durability(&self) -> u32;
    fn handle_player_input(&mut self, input: PlayerInput);
}
```

`PlayerInput` enum maps from key codes:

```rust
pub enum PlayerInput {
    MoveLeft, MoveRight, MoveUp, MoveDown,
    ToggleAutofire, Shoot, ReleaseScraps, ToggleShield,
}
```

---

## 8. Serialization Strategy

### Format: JSON + Gzip

World state is serialized as JSON, then gzip-compressed:

```rust
pub fn serialize<T: Serialize>(value: &T) -> AppResult<Vec<u8>> {
    let bytes = serde_json::to_vec(value)?;
    let compressed = compress(&bytes, COMPRESSION_LEVEL)?;  // level 5
    Ok(compressed)
}

pub fn deserialize<T: for<'a> Deserialize<'a>>(bytes: &[u8]) -> AppResult<T> {
    let decompressed = decompress(bytes)?;
    Ok(serde_json::from_slice(&decompressed)?)
}
```

### Serde Annotations

The World struct uses conditional serialization to minimize file size:

```rust
#[serde(skip)]                          // Transient fields (dirty flags, space_adventure)
#[serde(skip_serializing_if = "is_default")]  // Omit default-valued fields
#[serde(default)]                       // Allow missing fields when loading
```

### Save Triggers

Saving happens in `handle_world_slow_tick_events()` when `dirty == true`:

```rust
if self.world.dirty {
    self.world.dirty = false;
    save_world(&self.world, self.args.store_prefix(), false, false)?;
    self.world.serialized_size = get_world_size(self.args.store_prefix())?;
}
```

Games and tournaments are saved individually to separate files:
- `games/game_{id}.json.gz`
- `tournaments/tournament_{id}.json.gz`

### Legacy Migration

The store layer handles migration from older formats:
1. First tries `.json.gz` (current format)
2. Falls back to `.json.compressed` (legacy zlib), migrates on load
3. Falls back to `.json` (uncompressed), migrates on load

### Asset Embedding

All image/data assets are embedded at compile time:

```rust
pub static ASSETS_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/assets/");
```

Files are accessed via `ASSETS_DIR.get_file("path/to/file")`.

---

## 9. Type Aliases Summary

```rust
pub type Tick = u64;                          // Milliseconds since epoch
pub type AppResult<T> = Result<T, anyhow::Error>;
pub type AppCallback = Box<dyn Fn(&mut App) -> AppResult<Option<String>>>;

pub type PlayerMap = HashMap<PlayerId, Player>;
pub type TeamMap = HashMap<TeamId, Team>;
pub type PlanetMap = HashMap<PlanetId, Planet>;
pub type GameMap = HashMap<GameId, Game>;
pub type GameSummaryMap = HashMap<GameId, GameSummary>;
pub type KartoffelMap = HashMap<KartoffelId, Kartoffel>;
pub type TournamentMap = HashMap<TournamentId, Tournament>;
pub type TournamentSummaryMap = HashMap<TournamentId, TournamentSummary>;
pub type ResourceMap = HashMap<Resource, u32>;
```

The `HashMapWithResult<V>` trait provides `.get_or_err(id)` and `.get_mut_or_err(id)` that return `AppResult` instead of `Option`, eliminating boilerplate for entity lookup error handling.
