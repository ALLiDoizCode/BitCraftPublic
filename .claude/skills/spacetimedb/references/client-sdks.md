# SpacetimeDB Client SDK Reference

## Table of Contents
- [Overview](#overview)
- [Code Generation](#code-generation)
- [TypeScript Client](#typescript-client)
- [C# Client](#c-client)
- [Rust Client](#rust-client)
- [Unreal Client](#unreal-client)
- [Common Patterns](#common-patterns)

## Overview

SpacetimeDB client SDKs provide:
- Auto-generated type-safe bindings from your module schema
- Real-time subscriptions that maintain a local cache
- Reducer invocation with callbacks
- Identity/token management for authentication

Available SDKs: **TypeScript**, **C#**, **Rust**, **Unreal (C++)**

## Code Generation

Generate client bindings from your server module:

```bash
# TypeScript
spacetime generate --lang typescript --out-dir src/module_bindings --project-path ./server

# C#
spacetime generate --lang csharp --out-dir module_bindings --project-path ./server

# Rust
spacetime generate --lang rust --out-dir client/src/module_bindings --project-path ./server

# Unreal
spacetime generate --lang unrealcpp --uproject-dir . --project-path ./server --module-name MyModule
```

Regenerate bindings after any module schema or reducer signature changes.

## TypeScript Client

### Setup
```bash
npm install spacetimedb
# Note: @clockworklabs/spacetimedb-sdk is deprecated as of SpacetimeDB 1.4.0
```

### Connection (React)
```typescript
import { Identity } from 'spacetimedb';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection, ErrorContext } from './module_bindings';

// Build connection
const connectionBuilder = DbConnection.builder()
  .withUri('ws://localhost:3000')
  .withModuleName('my-module')
  .withToken(localStorage.getItem('stdb_token') || undefined)
  .onConnect((conn, identity, token) => {
    localStorage.setItem('stdb_token', token);
    conn.subscriptionBuilder()
      .onApplied(() => console.log('Subscribed'))
      .subscribe(['SELECT * FROM player']);
  })
  .onConnectError((_ctx: ErrorContext, err: Error) => {
    console.error('Connection error:', err);
  });

// Wrap app in provider
createRoot(document.getElementById('root')!).render(
  <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
    <App />
  </SpacetimeDBProvider>
);
```

### React Hooks (useTable, useSpacetimeDB)
```typescript
import { useSpacetimeDB, useTable, where, eq } from 'spacetimedb/react';

// Get connection and identity
const conn = useSpacetimeDB<DbConnection>();
const { identity, isActive: connected } = conn;

// Subscribe to table data with filtering
const { rows: onlinePlayers } = useTable('player', where(eq('online', true)), {
  onInsert: (player) => console.log(`${player.name} joined`),
  onDelete: (player) => console.log(`${player.name} left`),
  onUpdate: (oldPlayer, newPlayer) => console.log(`Updated: ${newPlayer.name}`),
});

// All rows from a table
const { rows: messages } = useTable('message');
```

### Reducer Calls
```typescript
conn.reducers.createPlayer("Alice");
conn.reducers.sendMessage("Hello world");
```

## C# Client

### Setup
```bash
dotnet add package SpacetimeDB.ClientSDK
```
**Unity:** Install via Package Manager using Git URL: `https://github.com/clockworklabs/com.clockworklabs.spacetimedbsdk.git`

### Connection
```csharp
using SpacetimeDB;
using SpacetimeDB.Types;

const string HOST = "http://localhost:3000";
const string DB_NAME = "my-module";

DbConnection ConnectToDB()
{
    return DbConnection.Builder()
        .WithUri(HOST)
        .WithModuleName(DB_NAME)
        .WithToken(AuthToken.Token)
        .OnConnect(OnConnected)
        .OnConnectError(OnConnectError)
        .OnDisconnect(OnDisconnected)
        .Build();
}

void OnConnected(DbConnection conn, Identity identity, string authToken)
{
    AuthToken.SaveToken(authToken);  // Persist for reconnection
    conn.SubscriptionBuilder()
        .OnApplied(OnSubscriptionApplied)
        .SubscribeToAllTables();
}
```

### Table Events
```csharp
conn.Db.User.OnInsert += (EventContext ctx, User user) => {
    if (user.Online) Console.WriteLine($"{user.Name} connected");
};
conn.Db.User.OnUpdate += (EventContext ctx, User oldValue, User newValue) => {
    if (oldValue.Name != newValue.Name)
        Console.WriteLine($"Renamed: {oldValue.Name} -> {newValue.Name}");
};
conn.Db.Message.OnInsert += (EventContext ctx, Message msg) => {
    Console.WriteLine($"{msg.Text}");
};
```

### Reducer Calls & Events
```csharp
conn.Reducers.SendMessage("Hello");
conn.Reducers.SetName("Alice");

// Observe reducer results
conn.Reducers.OnSetName += (ctx, name) =>
{
    if (ctx.Event.Status is Status.Failed(var error))
        Console.WriteLine($"Failed: {error}");
};
```

### Threading (C# / Unity)
```csharp
// C# and Unity require manual message processing
void ProcessThread(DbConnection conn, CancellationToken ct)
{
    while (!ct.IsCancellationRequested)
    {
        conn.FrameTick();  // REQUIRED: Process incoming messages
        Thread.Sleep(100);
    }
}
```
**Warning:** Do not run `FrameTick()` on a background thread -- this can cause data races. Process messages on the main thread.

## Rust Client

### Setup
```toml
# Cargo.toml
[dependencies]
spacetimedb-sdk = "1.0"
```

### Connection
```rust
use spacetimedb_sdk::{credentials, DbContext, Error, Event, Identity, Status, Table, TableWithPrimaryKey};

mod module_bindings;
use module_bindings::*;

const HOST: &str = "http://localhost:3000";
const DB_NAME: &str = "my-module";

fn connect_to_db() -> DbConnection {
    DbConnection::builder()
        .on_connect(on_connected)
        .on_connect_error(on_connect_error)
        .on_disconnect(on_disconnected)
        .with_token(creds_store().load().expect("Error loading credentials"))
        .with_module_name(DB_NAME)
        .with_uri(HOST)
        .build()
        .expect("Failed to connect")
}

fn creds_store() -> credentials::File {
    credentials::File::new("my-module")  // Stores in ~/.spacetimedb_client_credentials/
}

fn on_connected(_ctx: &DbConnection, _identity: Identity, token: &str) {
    creds_store().save(token).ok();
}
```

### Callbacks & Subscriptions
```rust
fn register_callbacks(ctx: &DbConnection) {
    ctx.db.user().on_insert(on_user_inserted);
    ctx.db.user().on_update(on_user_updated);
    ctx.db.message().on_insert(on_message_inserted);
    ctx.reducers.on_set_name(on_name_set);
    ctx.reducers.on_send_message(on_message_sent);
}

fn subscribe_to_tables(ctx: &DbConnection) {
    ctx.subscription_builder()
        .on_applied(on_sub_applied)
        .on_error(on_sub_error)
        .subscribe(["SELECT * FROM user", "SELECT * FROM message"]);
}

// Run event processing
fn main() {
    let ctx = connect_to_db();
    register_callbacks(&ctx);
    subscribe_to_tables(&ctx);

    // Three execution strategies:
    ctx.run_threaded();   // Background thread (most common)
    ctx.run_async();      // Async runtime integration
    ctx.frame_tick();     // Manual per-frame processing (game loops)

    user_input_loop(&ctx);
}
```

### Reducer Calls
```rust
ctx.reducers.set_name("Alice".to_string()).unwrap();
ctx.reducers.send_message("Hello".to_string()).unwrap();
```

## Unreal Client

### Connection
```cpp
Conn = UDbConnection::Builder()
    ->WithUri(TEXT("127.0.0.1:3000"))
    ->WithModuleName(TEXT("my-module"))
    ->WithToken(Token)
    ->OnConnect(ConnectDelegate)
    ->OnDisconnect(DisconnectDelegate)
    ->Build();
```

### Table Events
```cpp
Conn->Db->User->OnInsert.AddDynamic(this, &AMyActor::OnUserInsert);
Conn->Db->User->OnUpdate.AddDynamic(this, &AMyActor::OnUserUpdate);
```

### Subscriptions
```cpp
USubscriptionHandle* Handle = Connection->SubscriptionBuilder()
    ->OnApplied(Callback)
    ->SubscribeToAllTables();
```

## Common Patterns

### Subscription SQL
```
SELECT * FROM player                           -- All rows from table
SELECT * FROM player WHERE online = true       -- Filtered
SELECT p.* FROM player p JOIN team t ON ...     -- Joined (max 2 tables)
```
**Note:** Event tables are excluded from `subscribeToAllTables()` / `SubscribeToAllTables()` and must be explicitly subscribed.

### Identity Management
- Each client gets an `Identity` (persists across connections) and `ConnectionId` (unique per session)
- Store auth tokens locally for reconnection as the same identity
- `Identity` is a 256-bit value; display with `.toHexString()` / `.to_hex()`

### Subscribe-Before-Unsubscribe Pattern
When updating subscriptions, subscribe to new data BEFORE unsubscribing from old. SpacetimeDB deduplicates overlapping queries with zero-copy, so there's no overhead.

### Subscription Management
SubscriptionHandle provides: `isActive()` / `IsActive`, `isEnded()` / `IsEnded`, `unsubscribe()` / `Unsubscribe()`, `unsubscribeThen(callback)` / `UnsubscribeThen(callback)`.

### Event Flow
1. Connect to database with builder pattern
2. Register table/reducer callbacks
3. Subscribe to tables with SQL queries
4. `onApplied` fires when initial data loads (display backlog here)
5. Subsequent `onInsert`/`onUpdate`/`onDelete` fire on real-time changes
6. Call reducers to modify server state
