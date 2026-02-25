---
name: spacetimedb
description: Develop applications with SpacetimeDB - a serverless database where server logic (modules) runs inside the database as WebAssembly. Covers module development in Rust, C#, and TypeScript (tables, reducers, views, scheduled tasks, custom types), client SDK integration (TypeScript, C#, Rust, Unreal), CLI usage, deployment, and SQL queries. Use when the user mentions SpacetimeDB, wants to create SpacetimeDB modules/tables/reducers, connect clients to SpacetimeDB, deploy SpacetimeDB databases, or work with any SpacetimeDB SDK or API.
---

# SpacetimeDB

## Overview

SpacetimeDB is a serverless database where server logic (modules) runs inside the database itself as WebAssembly (Rust/C#/C++) or V8 (TypeScript). Modules define tables, reducers (transactional server functions), views, procedures, and scheduled tasks. Clients connect via WebSocket, subscribe to data, and call reducers. Changes propagate to subscribed clients in real time. All data is held in memory for low latency, persisted to disk via commit logs.

**Architecture:** Client SDK <-> WebSocket <-> SpacetimeDB (Database + Module Logic)

**Core principles:** Everything is a Table (all state lives in tables), Everything is Persistent (automatic durability), Everything is Real-Time (clients act as replicas), Everything is Transactional (atomic reducers), Everything is Programmable (real code in the database).

## Workflow Decision Tree

Determine the task type and consult the appropriate reference:

**Writing server module code?**
- Rust module -> See [references/rust-modules.md](references/rust-modules.md)
- C# module -> See [references/csharp-modules.md](references/csharp-modules.md)
- TypeScript module -> Use patterns from [references/cheat-sheet.md](references/cheat-sheet.md) TypeScript sections
- Quick lookup across languages -> See [references/cheat-sheet.md](references/cheat-sheet.md)

**Writing client code?**
- Any SDK (TypeScript, C#, Rust, Unreal) -> See [references/client-sdks.md](references/client-sdks.md)

**CLI, deployment, SQL, or HTTP API?**
- See [references/cli-and-deployment.md](references/cli-and-deployment.md)

**Scaffolding a new project?**
- Recommended: `spacetime dev --template <template>` (basic-rs, basic-cs, basic-ts, react-ts) -- auto-rebuilds, republishes, and generates bindings
- Or run `scripts/scaffold-project.sh <name> <server-lang> [client-lang]`
- Or use `spacetime init --lang <lang> --project-path <path> <name>` for module only

## Core Concepts

### Tables
Tables store data. Define with language-specific attributes. Key decorators:
- **primary_key** - Unique row identity; enables update/delete semantics
- **unique** - Unique constraint; enables `.find()` lookups
- **auto_inc** - Auto-incrementing integer (insert with 0 to auto-assign)
- **index(btree)** - BTree index for fast lookups and range queries
- **public** - Visible to clients (private by default)

### Reducers
Transactional server functions. All changes roll back on error. No network I/O allowed. Called by clients or scheduled.

### Procedures (Beta)
Like reducers but can make HTTP requests to external services. Require manual transaction management via `ctx.with_tx()`. Available in Rust and TypeScript (C# coming soon).

### Views
Read-only computed queries over tables, accessible to clients.

### Event Tables (2.0)
Transient tables that emit events to subscribed clients without persistent storage. Excluded from `subscribe_to_all_tables()` -- must be explicitly subscribed.

### Subscriptions
Clients subscribe to table data using SQL-like queries. Subscriptions maintain a local cache that auto-updates. Max 2-table JOINs; join columns must be indexed.

### Schedule Tables
Tables that trigger reducers at specific times or intervals via `ScheduleAt` column.

### Identity & Authentication
Each client gets an `Identity` (persists across connections) and `ConnectionId` (per session). Auth tokens are OpenID Connect-compliant JWTs. Store tokens locally for reconnection.

## Quick Start Pattern

### 1. Create Server Module (Rust example)

```rust
use spacetimedb::{Identity, ReducerContext, SpacetimeType, Table, Timestamp};

#[spacetimedb::table(name = user, public)]
pub struct User {
    #[primary_key]
    pub identity: Identity,
    pub name: Option<String>,
    pub online: bool,
}

#[spacetimedb::table(name = message, public)]
pub struct Message {
    pub sender: Identity,
    pub text: String,
    pub sent: Timestamp,
}

#[spacetimedb::reducer(client_connected)]
fn on_connect(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender()) {
        let mut user = user;
        user.online = true;
        ctx.db.user().identity().update(user);
    } else {
        ctx.db.user().insert(User {
            identity: ctx.sender(),
            name: None,
            online: true,
        });
    }
}

#[spacetimedb::reducer]
fn set_name(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let mut user = ctx.db.user().identity().find(ctx.sender())
        .ok_or("User not found")?;
    user.name = Some(name);
    ctx.db.user().identity().update(user);
    Ok(())
}

#[spacetimedb::reducer]
fn send_message(ctx: &ReducerContext, text: String) {
    ctx.db.message().insert(Message {
        sender: ctx.sender(),
        text,
        sent: ctx.timestamp,
    });
}
```

### 2. Publish

```bash
spacetime start           # Start local server
spacetime publish my-app  # Publish module
# Or use: spacetime dev --template basic-rs  (auto-rebuilds + republishes)
```

### 3. Generate Client Bindings

```bash
spacetime generate --lang typescript --out-dir client/src/module_bindings --project-path server
```

### 4. Connect Client

```typescript
const conn = DbConnection.builder()
  .withUri('http://localhost:3000')
  .withModuleName('my-app')
  .onConnect((conn, identity, token) => {
    localStorage.setItem('token', token);
    conn.subscriptionBuilder()
      .onApplied(() => console.log('Ready'))
      .subscribe(['SELECT * FROM user', 'SELECT * FROM message']);
  })
  .build();

// Call reducers
conn.reducers.sendMessage('Hello!');
```

## Module Languages

| Language | Maturity | Best For |
|----------|----------|----------|
| Rust | Stable | Performance-critical, systems programming (WASM) |
| C# | Stable | Unity games, .NET ecosystem (WASM) |
| TypeScript | Stable | Web developers, rapid prototyping (V8, not WASM) |
| C++ | Beta | Unreal Engine (pinned to v1.12.0 for SpacetimeDB 2.0) |

## Supported Client SDKs

| SDK | Package | Notes |
|-----|---------|-------|
| TypeScript | `spacetimedb` (npm) | Browser/Node.js; auto event loop; React hooks via `spacetimedb/react` |
| C# | `SpacetimeDB.ClientSDK` (NuGet) | .NET; requires `FrameTick()` calls |
| C# (Unity) | Git URL `com.clockworklabs.spacetimedbsdk` | Unity Package Manager; requires `FrameTick()` |
| Rust | `spacetimedb-sdk` (crate) | Auto event loop via `run_threaded()` or `run_async()` |
| Unreal | Plugin | C++; requires `FrameTick()` in Tick |

## Resources

### references/
- **[cheat-sheet.md](references/cheat-sheet.md)** - Quick reference with code examples for all languages (tables, reducers, types, CLI commands)
- **[rust-modules.md](references/rust-modules.md)** - Detailed Rust server module development guide
- **[csharp-modules.md](references/csharp-modules.md)** - Detailed C# server module development guide
- **[client-sdks.md](references/client-sdks.md)** - Client SDK patterns for TypeScript, C#, Rust, and Unreal
- **[cli-and-deployment.md](references/cli-and-deployment.md)** - CLI commands, deployment, self-hosting, HTTP API, SQL reference

### scripts/
- **[scaffold-project.sh](scripts/scaffold-project.sh)** - Create a full-stack SpacetimeDB project with server module and client
