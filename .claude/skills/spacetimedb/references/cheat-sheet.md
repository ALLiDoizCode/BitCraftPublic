# SpacetimeDB Cheat Sheet

## Table of Contents

- [Project Setup](#project-setup)
- [Tables](#tables)
- [Reducers](#reducers)
- [Lifecycle Reducers](#lifecycle-reducers)
- [Schedule Tables](#schedule-tables)
- [Views](#views)
- [Custom Types](#custom-types)
- [Context Properties](#context-properties)
- [Logging](#logging)
- [Common Types](#common-types)
- [CLI Commands](#cli-commands)

## Project Setup

```bash
# Initialize a new module
spacetime init --lang rust --project-path my-project my-project
spacetime init --lang csharp --project-path my-project my-project
spacetime init --lang typescript --project-path my-project my-project

# Login, build, publish
spacetime login
spacetime build
spacetime publish <DATABASE_NAME>

# Local development
spacetime start          # Start local server
spacetime dev            # Interactive dev mode (auto-rebuild on save)
```

## Tables

### Rust

```rust
#[spacetimedb::table(name = player, public)]
pub struct Player {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub username: String,
    #[index(btree)]
    pub score: i32,
}

// Multi-column index
#[spacetimedb::table(name = score, public)]
#[index(btree, name = idx, player_id, level)]
pub struct Score {
    pub player_id: u64,
    pub level: u32,
}
```

### C#

```csharp
[SpacetimeDB.Table(Public = true)]
public partial struct Player
{
    [SpacetimeDB.PrimaryKey]
    [SpacetimeDB.AutoInc]
    public ulong Id;
    [SpacetimeDB.Unique]
    public string Username;
    [SpacetimeDB.Index.BTree]
    public int Score;
}

// Multi-column index
[SpacetimeDB.Table]
[SpacetimeDB.Index.BTree(Accessor = "idx", Columns = ["PlayerId", "Level"])]
public partial struct Score
{
    public ulong PlayerId;
    public uint Level;
}
```

### TypeScript

```typescript
import { table, t, spacetimedb } from 'spacetimedb/server';

const Players = table(
  { name: 'player', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    username: t.string().unique(),
    score: t.i32().index('btree'),
  }
);
```

## Reducers

### Rust

```rust
use spacetimedb::ReducerContext;

#[spacetimedb::reducer]
fn create_player(ctx: &ReducerContext, username: String) {
    ctx.db.player().insert(Player { id: 0, username, score: 0 });
}

#[spacetimedb::reducer]
fn update_score(ctx: &ReducerContext, id: u64, points: i32) {
    let mut player = ctx.db.player().id().find(id)
        .expect("Player not found");
    player.score += points;
    ctx.db.player().id().update(player);
}

// Query patterns
let player = ctx.db.player().id().find(123);           // Find by primary key
let players = ctx.db.player().username().filter("Alice"); // Filter by index
let all = ctx.db.player().iter();                       // Iterate all
ctx.db.player().id().delete(123);                       // Delete by primary key
```

### C#

```csharp
[SpacetimeDB.Reducer]
public static void CreatePlayer(ReducerContext ctx, string username)
{
    ctx.Db.Player.Insert(new Player { Id = 0, Username = username, Score = 0 });
}

[SpacetimeDB.Reducer]
public static void UpdateScore(ReducerContext ctx, ulong id, int points)
{
    var player = ctx.Db.Player.Id.Find(id)
        ?? throw new Exception("Player not found");
    player.Score += points;
    ctx.Db.Player.Id.Update(player);
}

// Query patterns
var player = ctx.Db.Player.Id.Find(123);             // Find by primary key
var players = ctx.Db.Player.Username.Filter("Alice"); // Filter by index
var all = ctx.Db.Player.Iter();                      // Iterate all
ctx.Db.Player.Id.Delete(123);                        // Delete by primary key
```

### TypeScript

```typescript
import { spacetimedb, t } from 'spacetimedb/server';

spacetimedb.reducer('create_player', { username: t.string() }, (ctx, { username }) => {
  ctx.db.player.insert({ id: 0n, username, score: 0 });
});
```

## Lifecycle Reducers

### Rust

```rust
#[spacetimedb::reducer(init)]
fn init(ctx: &ReducerContext) { /* runs on first publish */ }

#[spacetimedb::reducer(client_connected)]
fn on_connect(ctx: &ReducerContext) {
    // ctx.sender() is the connecting client's Identity
}

#[spacetimedb::reducer(client_disconnected)]
fn on_disconnect(ctx: &ReducerContext) { }
```

### C#

```csharp
[Reducer(ReducerKind.Init)]
public static void Init(ReducerContext ctx) { }

[Reducer(ReducerKind.ClientConnected)]
public static void OnConnect(ReducerContext ctx) { }

[Reducer(ReducerKind.ClientDisconnected)]
public static void OnDisconnect(ReducerContext ctx) { }
```

## Schedule Tables

### Rust

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
}

// Schedule for a specific time
ctx.db.reminder().insert(Reminder {
    id: 0,
    message: "Hello".into(),
    scheduled_at: ScheduleAt::Time(ctx.timestamp + Duration::from_secs(60)),
});

// Schedule on interval
ctx.db.reminder().insert(Reminder {
    id: 0,
    message: "Tick".into(),
    scheduled_at: ScheduleAt::Interval(Duration::from_secs(5)),
});
```

### C#

```csharp
[SpacetimeDB.Table(Scheduled = "SendReminder", ScheduledAt = "ScheduledAt")]
public partial struct Reminder
{
    [SpacetimeDB.PrimaryKey]
    [SpacetimeDB.AutoInc]
    public ulong Id;
    public string Message;
    public ScheduleAt ScheduledAt;
}

[SpacetimeDB.Reducer]
public static void SendReminder(ReducerContext ctx, Reminder reminder)
{
    Log.Info($"Reminder: {reminder.Message}");
}
```

### TypeScript

```typescript
import { table, t, spacetimedb } from 'spacetimedb/server';

const Reminders = table(
  { name: 'reminders', scheduled: 'send_reminder' },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
    message: t.string(),
  }
);

spacetimedb.reducer('send_reminder', { arg: Reminders.rowType }, (_ctx, { arg }) => {
  console.log(`Reminder: ${arg.message}`);
});
```

## Views

### Rust

```rust
use spacetimedb::{view, Query, ViewContext};

#[view(accessor = my_player, public)]
fn my_player(ctx: &ViewContext) -> Option<Player> {
    ctx.db.player().identity().find(ctx.sender())
}

#[view(accessor = top_players, public)]
fn top_players(ctx: &ViewContext) -> Vec<Player> {
    ctx.db.player().score().filter(1000).collect()
}
```

### C#

```csharp
[SpacetimeDB.View(Public = true)]
public static Player? MyPlayer(ViewContext ctx)
{
    return ctx.Db.Player.Identity.Find(ctx.Sender);
}

[SpacetimeDB.View(Public = true)]
public static IEnumerable<Player> TopPlayers(ViewContext ctx)
{
    return ctx.Db.Player.Score.Filter(1000);
}
```

### TypeScript

```typescript
import { spacetimedb, t } from 'spacetimedb/server';

spacetimedb.view(
  { name: 'my_player', public: true },
  t.option(Players.row()),
  (ctx) => ctx.db.players.identity.find(ctx.sender) ?? null
);
```

## Custom Types

### Rust

```rust
// Simple enum
#[derive(SpacetimeType)]
pub enum Status { Active, Inactive }

// Struct type (usable as column)
#[derive(SpacetimeType, Clone, Debug)]
pub struct Vec2 { pub x: f32, pub y: f32 }

// Tagged enum (sum type)
#[derive(SpacetimeType)]
pub enum Shape {
    Circle { radius: f32 },
    Rect { width: f32, height: f32 },
}
```

### C#

```csharp
[SpacetimeDB.Type]
public enum Status { Active, Inactive }

[SpacetimeDB.Type]
public partial struct Vec2 { public float X; public float Y; }

// Tagged enum
[SpacetimeDB.Type]
public partial record ShapeData : SpacetimeDB.TaggedEnum<(CircleData Circle, RectData Rect)> { }
```

## Context Properties

| Property        | Rust                  | C#                 | TypeScript         |
| --------------- | --------------------- | ------------------ | ------------------ |
| Database access | `ctx.db`              | `ctx.Db`           | `ctx.db`           |
| Caller identity | `ctx.sender()`        | `ctx.Sender`       | `ctx.sender`       |
| Connection ID   | `ctx.connection_id()` | `ctx.ConnectionId` | `ctx.connectionId` |
| Timestamp       | `ctx.timestamp`       | `ctx.Timestamp`    | `ctx.timestamp`    |
| Module identity | `ctx.identity()`      | `ctx.Identity`     | `ctx.identity`     |
| RNG             | `ctx.rng()`           | `ctx.Rng`          | N/A                |

## Logging

| Level     | Rust                 | C#                  | TypeScript             |
| --------- | -------------------- | ------------------- | ---------------------- |
| Error     | `log::error!("msg")` | `Log.Error("msg")`  | `console.error("msg")` |
| Warn      | `log::warn!("msg")`  | `Log.Warn("msg")`   | `console.warn("msg")`  |
| Info      | `log::info!("msg")`  | `Log.Info("msg")`   | `console.log("msg")`   |
| Debug     | `log::debug!("msg")` | `Log.Debug("msg")`  | `console.debug("msg")` |
| Trace     | `log::trace!("msg")` | `Log.Trace("msg")`  | `console.trace("msg")` |
| Exception | N/A                  | `Log.Exception(ex)` | N/A                    |

## Common Types

| Concept   | Rust                                       | C#                                                               | TypeScript           |
| --------- | ------------------------------------------ | ---------------------------------------------------------------- | -------------------- |
| Boolean   | `bool`                                     | `bool`                                                           | `t.bool()`           |
| String    | `String`                                   | `string`                                                         | `t.string()`         |
| Integers  | `i8`..`i128`, `u8`..`u128`, `i256`, `u256` | `sbyte`..`long`, `byte`..`ulong`, `I128`, `U128`, `I256`, `U256` | `t.i8()`..`t.u256()` |
| Floats    | `f32`, `f64`                               | `float`, `double`                                                | `t.f32()`, `t.f64()` |
| Optional  | `Option<T>`                                | `T?`                                                             | `t.option(T)`        |
| List      | `Vec<T>`                                   | `List<T>`                                                        | `t.array(T)`         |
| Identity  | `Identity`                                 | `Identity`                                                       | `t.identity()`       |
| Timestamp | `Timestamp`                                | `Timestamp`                                                      | `t.timestamp()`      |
| Duration  | `Duration`                                 | `TimeDuration`                                                   | `t.timeDuration()`   |
| Schedule  | `ScheduleAt`                               | `ScheduleAt`                                                     | `t.scheduleAt()`     |

## CLI Commands

```bash
# Development
spacetime start                              # Start local server
spacetime dev                                # Auto-rebuild/republish dev mode
spacetime dev --template basic-rs            # Create project from template
spacetime login                              # Authenticate

# Module management
spacetime build                              # Build module
spacetime publish <NAME>                     # Publish module
spacetime publish --delete-data <NAME>       # Reset database on publish
spacetime delete <NAME>                      # Delete database
spacetime list                               # List published databases
spacetime rename <OLD> <NEW>                 # Rename a database

# Database operations
spacetime logs <NAME>                        # View logs
spacetime logs --follow <NAME>               # Stream logs
spacetime sql <NAME> "SELECT * FROM t"       # Run SQL query
spacetime sql <NAME> --interactive           # Interactive SQL shell
spacetime describe <NAME>                    # Show schema
spacetime call <NAME> reducer arg1 arg2      # Call reducer

# Code generation
spacetime generate --lang rust --out-dir ./src/module_bindings --project-path ./server
spacetime generate --lang csharp --out-dir ./module_bindings --project-path ./server
spacetime generate --lang typescript --out-dir ./src/module_bindings --project-path ./server
spacetime generate --lang unrealcpp --uproject-dir . --project-path ./server --module-name MyModule
```
