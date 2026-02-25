# SpacetimeDB C# Module Reference

## Table of Contents
- [Project Setup](#project-setup)
- [Tables](#tables)
- [Reducers](#reducers)
- [Lifecycle Reducers](#lifecycle-reducers)
- [Rejecting Client Connections](#rejecting-client-connections)
- [Auth Claims (JWT)](#auth-claims-jwt)
- [Custom Types](#custom-types)
- [Schedule Tables](#schedule-tables)
- [Views](#views)
- [Logging](#logging)
- [Indexes](#indexes)
- [Procedures](#procedures)
- [Row Level Security (Experimental)](#row-level-security-experimental)
- [API Signatures](#api-signatures)
- [Key Constraints](#key-constraints)

## Project Setup

```bash
spacetime init --lang csharp --project-path server server
cd server
```

**Module structure:**
```csharp
using SpacetimeDB;

public static partial class Module
{
    // Tables, reducers, views go here
}
```

**Prerequisites:** Install the WASI workload (required once):
```bash
dotnet workload install wasi-experimental
```

**Project file:** Must be named `StdbModule.csproj`, targeting `net8.0` with `wasi-wasm` runtime identifier.

**Important:** All table structs require the `partial` modifier.

## Tables

```csharp
// Public table
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

// Private table (default)
[SpacetimeDB.Table]
public partial struct InternalState
{
    [SpacetimeDB.PrimaryKey]
    public string Key;
    public string Value;
}

// 2.0 syntax with Accessor
[SpacetimeDB.Table(Accessor = "Person", Public = true)]
public partial struct Person { ... }

// Multi-column index
[SpacetimeDB.Table]
[SpacetimeDB.Index.BTree(Accessor = "idx", Columns = ["PlayerId", "Level"])]
public partial struct Score
{
    public ulong PlayerId;
    public uint Level;
    public int Value;
}
```

**Table operations:**
```csharp
// Insert (auto_inc fields use 0 as sentinel)
ctx.Db.Player.Insert(new Player { Id = 0, Username = "Alice", Score = 0 });

// Find by primary key / unique index
var player = ctx.Db.Player.Id.Find(42);             // Player?
var player = ctx.Db.Player.Username.Find("Alice");   // Player?

// Filter by btree index
var topPlayers = ctx.Db.Player.Score.Filter(1000);   // IEnumerable<Player>

// Iterate all
foreach (var p in ctx.Db.Player.Iter()) { /* ... */ }

// Count
var count = ctx.Db.Player.Count;

// Update (requires unique/primary key)
var player = ctx.Db.Player.Id.Find(42) ?? throw new Exception("Not found");
player.Score += 10;
ctx.Db.Player.Id.Update(player);

// Delete
ctx.Db.Player.Id.Delete(42);          // By primary key
ctx.Db.Player.Score.Delete(0);        // By index (returns count)
```

## Reducers

```csharp
[SpacetimeDB.Reducer]
public static void CreatePlayer(ReducerContext ctx, string username)
{
    if (string.IsNullOrEmpty(username))
        throw new Exception("Username required");
    ctx.Db.Player.Insert(new Player { Id = 0, Username = username, Score = 0 });
}

[SpacetimeDB.Reducer]
public static void UpdateScore(ReducerContext ctx, ulong id, int points)
{
    var player = ctx.Db.Player.Id.Find(id) ?? throw new Exception("Not found");
    player.Score += points;
    ctx.Db.Player.Id.Update(player);
}
```

### Lifecycle Reducers

```csharp
[Reducer(ReducerKind.Init)]
public static void Init(ReducerContext ctx) { /* first publish */ }

[Reducer(ReducerKind.ClientConnected)]
public static void OnConnect(ReducerContext ctx)
{
    var identity = ctx.Sender;
}

[Reducer(ReducerKind.ClientDisconnected)]
public static void OnDisconnect(ReducerContext ctx) { }
```

### Rejecting Client Connections

```csharp
// Throw in ClientConnected to reject:
[Reducer(ReducerKind.ClientConnected)]
public static void ClientConnected(ReducerContext ctx)
{
    throw new Exception("Connection rejected.");
}
```

## Auth Claims (JWT)

Access JWT claims in lifecycle reducers:

```csharp
[Reducer(ReducerKind.ClientConnected)]
public static void ClientConnected(ReducerContext ctx)
{
    var claims = ctx.SenderAuth.Jwt ?? throw new Exception("No JWT");
    Log.Info($"sub: {claims.Subject}, iss: {claims.Issuer}");

    // Access custom claims via RawPayload
    using var doc = JsonDocument.Parse(claims.RawPayload);
    var root = doc.RootElement;
}
```

## Custom Types

```csharp
// Simple enum
[SpacetimeDB.Type]
public enum Status { Active, Inactive }

// Struct type (for table columns)
[SpacetimeDB.Type]
public partial struct Vec2
{
    public float X;
    public float Y;
}

// Tagged enum (sum type)
[SpacetimeDB.Type]
public partial record ProductId : SpacetimeDB.TaggedEnum<(string Text, uint Number)> { }

// Usage:
ProductId a = new ProductId.Text("apple");
ProductId b = new ProductId.Number(57);

// Pattern matching:
if (id is ProductId.Text(var s)) { Log.Info($"Text: {s}"); }
else if (id is ProductId.Number(var n)) { Log.Info($"Number: {n}"); }

// Complex tagged enum
[SpacetimeDB.Type]
public partial struct CircleData { public int Radius; }

[SpacetimeDB.Type]
public partial struct RectData { public int Width; public int Height; }

[SpacetimeDB.Type]
public partial record ShapeData : SpacetimeDB.TaggedEnum<(CircleData Circle, RectData Rect)> { }
```

## Schedule Tables

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

## Views

Views must be declared public with explicit `Name` parameter. Accept `ViewContext` or `AnonymousViewContext`. Return `T?`, `List<T>`, `T[]`, or `IQuery<T>`.

```csharp
// Single row
[SpacetimeDB.View(Public = true)]
public static Player? MyPlayer(ViewContext ctx)
{
    return ctx.Db.Player.Identity.Find(ctx.Sender);
}

// Multiple rows
[SpacetimeDB.View(Public = true)]
public static IEnumerable<Player> TopPlayers(ViewContext ctx)
{
    return ctx.Db.Player.Score.Filter(1000);
}

// Query builder
[SpacetimeDB.View(Public = true)]
public static IQuery<Player> BottomPlayers(ViewContext ctx)
{
    return ctx.From.Player.Where(p => p.Score.Lt(1000));
}
```

## Logging

```csharp
Log.Trace("Detailed trace message");
Log.Info("Informational message");
Log.Warn("Warning message");
Log.Error("Error message");
Log.Exception("Exception occurred", ex);
```

## Indexes

```csharp
// Multi-column index filtering with tuples
foreach (var item in ctx.Db.zoo_animal.SpeciesAgeName.Filter("baboon")) { }           // First column exact
foreach (var item in ctx.Db.zoo_animal.SpeciesAgeName.Filter(("baboon", 1))) { }      // First two exact
foreach (var item in ctx.Db.zoo_animal.SpeciesAgeName.Filter(("baboon", (1, 5)))) { } // First exact, second range
```

## Procedures

**Note:** C# module-side procedure support is not yet available. Only Rust and TypeScript modules support procedures. C# clients can call procedures defined in other module languages.

## Row Level Security (Experimental)

Restrict which rows each client can see:

```csharp
#pragma warning disable STDB_UNSTABLE

[SpacetimeDB.ClientVisibilityFilter]
public static readonly Filter ACCOUNT_FILTER = new Filter.Sql(
    "SELECT * FROM account WHERE account.identity = :sender"
);

// Multiple rules use OR logic; module owners bypass RLS
```

## API Signatures

**ReducerContext:**
```csharp
public sealed record ReducerContext : DbContext<Local>, Internal.IReducerContext
{
    DbView Db { get; }
    Identity Sender { get; }
    ConnectionId? ConnectionId { get; }
    Random Rng { get; }
    Timestamp Timestamp { get; }
    Identity Identity { get; }  // Module's own identity
}
```

**UniqueIndex methods:**
```csharp
Row? Find(Column key);
Row Update(Row row);
bool Delete(Column key);
```

**IndexBase methods:**
```csharp
IEnumerable<Row> Filter(Column bound);
IEnumerable<Row> Filter(Bound<Column> bound);
ulong Delete(Column bound);
```

**Timestamp:**
```csharp
public record struct Timestamp(long MicrosecondsSinceUnixEpoch)
{
    public static implicit operator DateTimeOffset(Timestamp t);
    public static implicit operator Timestamp(DateTimeOffset offset);
    public readonly TimeDuration TimeDurationSince(Timestamp earlier);
    public static Timestamp operator +(Timestamp point, TimeDuration interval);
}
```

## Key Constraints

- Reducers execute in transactions; exceptions roll back all changes
- `System.IO` and `System.Net` calls in reducers cause runtime errors (use Procedures instead)
- Modifying row copies locally doesn't affect the database; use `UniqueIndex.Update()` to persist
- Tables require `partial` modifier
- `[AutoInc]` supports only integer types; use 0 as sentinel to trigger generation
- BTree indexes support: integers, booleans, strings, Identity, ConnectionId, annotated enums
- DateTimeOffset/TimeSpan conversions lose 100ns precision (microsecond granularity)
