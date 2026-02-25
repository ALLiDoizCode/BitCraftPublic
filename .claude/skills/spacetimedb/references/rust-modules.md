# SpacetimeDB Rust Module Reference

## Table of Contents
- [Project Setup](#project-setup)
- [Tables](#tables)
- [Constraints and Indexes](#constraints-and-indexes)
- [Reducers](#reducers)
- [Custom Types](#custom-types)
- [Schedule Tables](#schedule-tables)
- [Event Tables](#event-tables)
- [Views](#views)
- [Procedures (Beta)](#procedures-beta)
- [Lifecycle Reducers](#lifecycle-reducers)
- [Incremental Migrations](#incremental-migrations)
- [SpacetimeDB 2.0 Breaking Changes](#spacetimedb-20-breaking-changes)
- [Important Warnings](#important-warnings)
- [Performance Best Practices](#performance-best-practices)

## Project Setup

```bash
spacetime init --lang rust --project-path server server
cd server
```

**Build with `spacetime build` (not `cargo build`):**
```bash
spacetime build
```

**Cargo.toml dependencies:**
```toml
[dependencies]
spacetimedb = "1.0"
log = "0.4"

[lib]
crate-type = ["cdylib"]
```

**lib.rs imports (must import `Table` trait for table operations):**
```rust
use spacetimedb::{table, reducer, Table, Identity, ReducerContext, ScheduleAt, SpacetimeType, Timestamp, Duration};
```

## Tables

Define tables with the `#[spacetimedb::table]` attribute:

```rust
// Public table - visible to clients
#[spacetimedb::table(name = player, public)]
pub struct Player {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub username: String,
    pub identity: Identity,
    #[index(btree)]
    pub score: i32,
}

// Private table - only accessible by module owner
#[spacetimedb::table(name = internal_state)]
pub struct InternalState {
    #[primary_key]
    pub key: String,
    pub value: String,
}

// Multiple accessors for the same struct
#[spacetimedb::table(name = active_player, public)]
#[spacetimedb::table(name = logged_out_player)]
pub struct Player {
    #[primary_key]
    identity: Identity,
    #[unique]
    #[auto_inc]
    player_id: i32,
    name: String,
}
```

**Table operations in reducers:**
```rust
// Insert
ctx.db.player().insert(Player { id: 0, username: "Alice".into(), identity: ctx.sender(), score: 0 });

// Find by primary key (unique index)
let player = ctx.db.player().id().find(42);           // Option<Player>

// Find by unique index
let player = ctx.db.player().username().find("Alice"); // Option<Player>

// Filter by btree index
let top = ctx.db.player().score().filter(1000);        // Iterator

// Iterate all rows
for player in ctx.db.player().iter() { /* ... */ }

// Count rows
let count = ctx.db.player().count();

// Update (must have primary key or unique constraint)
let mut player = ctx.db.player().id().find(42).unwrap();
player.score += 10;
ctx.db.player().id().update(player);

// Delete by primary key
ctx.db.player().id().delete(42);

// Delete by btree index (returns count of deleted rows)
let deleted = ctx.db.player().score().delete(0);
```

## Constraints and Indexes

| Attribute | Purpose |
|-----------|---------|
| `#[primary_key]` | Unique row identity; defines update/delete semantics |
| `#[unique]` | Unique constraint; enables `.find()` and `.update()` |
| `#[auto_inc]` | Auto-incrementing integer; insert with 0 to auto-assign |
| `#[index(btree)]` | BTree index for range queries and fast lookups |
| `#[default(value)]` | Default value for schema migration; populates existing rows |

Cannot combine `#[default]` with `#[primary_key]`, `#[unique]`, or `#[auto_inc]`. Only const-evaluable expressions.

Sequences are allocated even if a transaction rolls back, creating potential gaps in auto-incremented values.

**Multi-column index:**
```rust
#[spacetimedb::table(name = score)]
#[index(btree, name = idx_player_level, player_id, level)]
pub struct Score {
    pub player_id: u64,
    pub level: u32,
    pub value: i32,
}
```

**BTree index supports:** integers, booleans, strings, Identity, ConnectionId, and annotated enums.

## Reducers

```rust
// Basic reducer
#[spacetimedb::reducer]
fn create_player(ctx: &ReducerContext, username: String) -> Result<(), String> {
    if username.is_empty() {
        return Err("Username cannot be empty".into());
    }
    ctx.db.player().insert(Player { id: 0, username, identity: ctx.sender(), score: 0 });
    Ok(())
}

// Access caller identity
#[spacetimedb::reducer]
fn my_action(ctx: &ReducerContext) {
    let caller = ctx.sender();       // Identity of the caller
    let conn = ctx.connection_id();  // Option<ConnectionId>
    let now = ctx.timestamp;         // Timestamp
    let module = ctx.identity();     // Module's own Identity
}
```

**Key rules:**
- Reducers execute within a database transaction
- All changes roll back if the reducer returns an error or panics
- Reducers don't observe concurrent modifications from other reducers
- No network I/O allowed inside reducers (use Procedures for HTTP)

## Custom Types

```rust
// Enum (simple C-style)
#[derive(SpacetimeType)]
pub enum Status {
    Active,
    Inactive,
}

// Struct (usable as table column)
#[derive(SpacetimeType, Clone, Debug)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

// Tagged enum (sum type with data)
#[derive(SpacetimeType)]
pub enum GameEvent {
    PlayerJoined { name: String },
    PlayerLeft { reason: String },
    ScoreChanged { player_id: u64, delta: i32 },
}
```

## Schedule Tables

```rust
#[spacetimedb::table(name = reminder, public, scheduled(send_reminder))]
pub struct Reminder {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub message: String,
    pub scheduled_at: ScheduleAt,
}

#[spacetimedb::reducer]
fn send_reminder(ctx: &ReducerContext, reminder: Reminder) {
    log::info!("Reminder: {}", reminder.message);
    // Row is automatically deleted after execution
}

// Schedule at a specific time (60 seconds from now)
#[spacetimedb::reducer]
fn schedule_once(ctx: &ReducerContext, msg: String) {
    ctx.db.reminder().insert(Reminder {
        id: 0,
        message: msg,
        scheduled_at: ScheduleAt::Time(ctx.timestamp + Duration::from_secs(60)),
    });
}

// Schedule recurring (every 5 seconds)
#[spacetimedb::reducer]
fn schedule_recurring(ctx: &ReducerContext, msg: String) {
    ctx.db.reminder().insert(Reminder {
        id: 0,
        message: msg,
        scheduled_at: ScheduleAt::Interval(Duration::from_secs(5)),
    });
}
```

## Views

Read-only computed queries accessible to clients:

```rust
use spacetimedb::{view, Query, ViewContext};

// Single row
#[view(accessor = my_player, public)]
fn my_player(ctx: &ViewContext) -> Option<Player> {
    ctx.db.player().identity().find(ctx.sender())
}

// Multiple rows
#[view(accessor = top_players, public)]
fn top_players(ctx: &ViewContext) -> Vec<Player> {
    ctx.db.player().score().filter(1000).collect()
}

// Query builder
#[view(accessor = bottom_players, public)]
fn bottom_players(ctx: &ViewContext) -> impl Query<Player> {
    ctx.from.player().r#where(|p| p.score.lt(1000))
}
```

## Procedures (Beta)

Procedures can make HTTP requests but require manual transaction management:

```rust
#[spacetimedb::procedure]
fn fetch_weather(ctx: &ProcedureContext, city: String) -> Result<String, String> {
    let url = format!("https://api.weather.com/{}", city);
    let response = ctx.http.get(&url)
        .map_err(|e| format!("HTTP error: {e}"))?;

    // Manual transaction for database writes
    ctx.with_tx(|tx_ctx| {
        tx_ctx.db.weather_cache().insert(WeatherCache {
            city: city.clone(),
            data: response.clone(),
            fetched_at: tx_ctx.timestamp,
        });
    })?;

    Ok(response)
}
```

**Key differences from reducers:**
- Use `ProcedureContext` instead of `ReducerContext`
- Can make HTTP requests via `ctx.http`
- Must explicitly wrap database operations in `ctx.with_tx()`
- No automatic transaction wrapping

## Lifecycle Reducers

```rust
// Runs on first module publish (errors prevent publishing)
#[spacetimedb::reducer(init)]
fn init(ctx: &ReducerContext) {
    ctx.db.config().insert(Config { key: "version".into(), value: "1.0".into() });
}

// Runs when a client connects
#[spacetimedb::reducer(client_connected)]
fn on_connect(ctx: &ReducerContext) {
    let identity = ctx.sender();
    // Mark user as online, create user record, etc.
}

// Runs when a client disconnects
#[spacetimedb::reducer(client_disconnected)]
fn on_disconnect(ctx: &ReducerContext) {
    // Mark user as offline, cleanup, etc.
}
```

## Incremental Migrations

When evolving schema, create versioned tables and migrate lazily:

```rust
// Original table
#[spacetimedb::table(name = character, public)]
pub struct Character {
    #[primary_key]
    player_id: Identity,
    nickname: String,
    level: u32,
}

// New version with additional field
#[spacetimedb::table(name = character_v2, public)]
pub struct CharacterV2 {
    #[primary_key]
    player_id: Identity,
    nickname: String,
    level: u32,
    alliance: Alliance,
}

// Lazy migration helper
fn find_character(ctx: &ReducerContext) -> CharacterV2 {
    if let Some(c) = ctx.db.character_v2().player_id().find(ctx.sender()) {
        return c;
    }
    // Migrate from old table
    let old = ctx.db.character().player_id().find(ctx.sender()).unwrap();
    let new = CharacterV2 {
        player_id: old.player_id,
        nickname: old.nickname,
        level: old.level,
        alliance: Alliance::None,
    };
    ctx.db.character_v2().insert(new.clone());
    ctx.db.character().player_id().delete(old.player_id);
    new
}
```

**Schema migration rules:**
- **Allowed:** Add tables, add indexes, add `#[auto_inc]`, change private to public, add reducers, remove `#[unique]`
- **Breaking but allowed:** Change/remove reducers, public to private, remove `#[primary_key]`, remove indexes
- **Forbidden without manual migration:** Remove tables, change columns, alter scheduling, add `#[unique]`/`#[primary_key]`

## Event Tables

Event tables (SpacetimeDB 2.0) emit events to subscribed clients without persistent storage:

```rust
#[spacetimedb::table(accessor = damage_event, public, event)]
pub struct DamageEvent {
    pub target: Identity,
    pub amount: u32,
}

#[spacetimedb::reducer]
fn deal_damage(ctx: &ReducerContext, target: Identity, amount: u32) {
    // update game state...
    ctx.db.damage_event().insert(DamageEvent { target, amount });
}
```

Event tables are excluded from `subscribe_to_all_tables()` and must be explicitly subscribed to by clients.

## SpacetimeDB 2.0 Breaking Changes

| Change | Before (1.0) | After (2.0) |
|--------|-------------|-------------|
| Table attribute | `name = my_table` | `accessor = my_table` |
| Sender access | `ctx.sender` (field) | `ctx.sender()` (method) |
| Update methods | Available on unique indexes | Primary key columns only |
| Scheduled reducers | Public, manual auth check | Private by default |
| Confirmed reads | Opt-in | Enabled by default |
| Client builder | `withModuleName()` | `withDatabaseName()` |
| Private bindings | Generated by default | Requires `--include-private` flag |

**Case conversion policy** (to disable automatic table name conversion):
```rust
use spacetimedb::CaseConversionPolicy;

#[spacetimedb::settings]
const CASE_CONVERSION_POLICY: CaseConversionPolicy = CaseConversionPolicy::None;
```

## Important Warnings

**Global/static variables are UNDEFINED BEHAVIOR:** Module-level state does not persist across reducer calls. Use tables to store state.

```rust
// WRONG - undefined behavior
static mut COUNTER: u64 = 0;

// CORRECT - use a table
#[spacetimedb::table(accessor = counter)]
pub struct Counter {
    #[primary_key]
    pub id: u32,
    pub value: u64,
}
```

**Use `ctx.rng()` for randomness:** External RNG breaks consensus across nodes. Always use the context-provided deterministic RNG.

**Import the `Table` trait:** Table operations (`insert`, `iter`, `count`) require `use spacetimedb::Table;` in scope.

**Table accessor naming:** Recommended convention is `lower_snake_case` for accessor names.

**Name override in 2.0:** Set both accessor and name: `#[spacetimedb::table(accessor = my_table, name = "MyTable", public)]`

## Performance Best Practices

1. **Use indexed lookups** over full table scans
2. **Keep tables focused** - decompose large tables by access pattern
3. **Choose smallest integer types** matching your data range
4. **Use private tables** for internal state (avoids client sync overhead)
5. **Batch operations** in single reducers rather than multiple reducer calls
6. **Monitor table growth** - implement cleanup reducers for temporary data
