# @sigil/client

Core client library for Sigil - SpacetimeDB and Nostr integration for BitCraft game world.

## Features

- **Nostr Identity Management**: Cryptographic identity with BIP-39 seed phrases
- **SpacetimeDB Integration**: Real-time game world subscriptions via WebSocket
- **Static Data Loading**: Fast O(1) lookups for game definitions (items, recipes, terrain)
- **Type-Safe Table Access**: Generated TypeScript types for all game tables
- **Latency Monitoring**: NFR5 compliance with <500ms update latency tracking
- **Event-Driven API**: React to game state changes in real-time

## Installation

```bash
npm install @sigil/client
```

## Quick Start

### SpacetimeDB Connection

```typescript
import { SigilClient } from '@sigil/client';

// Create client with connection options
const client = new SigilClient({
  spacetimedb: {
    host: 'localhost',
    port: 3000,
    database: 'bitcraft',
    protocol: 'ws', // or 'wss' for production
  },
});

// Listen for connection events
client.on('connectionChange', ({ state, error }) => {
  console.log('Connection state:', state);
  if (error) console.error(error);
});

// Connect to SpacetimeDB
await client.connect();
```

### Static Data Loading

Static data tables (all `*_desc` tables) are loaded automatically on `connect()` by default:

```typescript
// Static data loads automatically on connect
await client.connect();

// Access static data
const item = client.staticData.get('item_desc', 1);
console.log('Item:', item);

// Get all items
const allItems = client.staticData.getAll('item_desc');
console.log(`Total items: ${allItems.length}`);

// Query with filter
const legendaryItems = client.staticData.query('item_desc', (item) => item.rarity === 'legendary');

// Check if loaded
console.log('Static data loaded:', client.isStaticDataLoaded);

// Get loading metrics
const metrics = client.staticData.getMetrics();
console.log('Load time:', metrics?.loadTime, 'ms');
```

#### Manual Static Data Loading

Disable auto-loading and load manually:

```typescript
const client = new SigilClient({
  spacetimedb: { host: 'localhost', port: 3000, database: 'bitcraft' },
  autoLoadStaticData: false, // Disable auto-loading
});

await client.connect();

// Load manually
await client.staticData.load();
```

#### Static Data Events

```typescript
// Loading progress
client.on('loadingProgress', ({ loaded, total, tableName }) => {
  console.log(`Loading ${tableName} (${loaded}/${total})`);
});

// Loading complete
client.on('staticDataLoaded', ({ cached, metrics }) => {
  console.log('Static data loaded!');
  console.log('Load time:', metrics?.loadTime, 'ms');
});

// Loading metrics
client.on('loadingMetrics', ({ totalTime, tableCount, avgTimePerTable }) => {
  console.log(`Loaded ${tableCount} tables in ${totalTime}ms`);
});
```

#### Cache Persistence

Static data cache persists across reconnections (static tables don't change at runtime):

```typescript
// First connection: loads all static data
await client.connect();
// ... static data loaded ...

// Disconnect and reconnect
await client.disconnect();
await client.connect();
// Cache persists - no reload!

// Force reload if needed
await client.staticData.forceReload();
```

### Table Subscriptions

```typescript
// Subscribe to a table
const handle = await client.spacetimedb.subscribe('player_state', {});

// Listen for initial snapshot
client.spacetimedb.subscriptions.on('tableSnapshot', ({ tableName, rows }) => {
  console.log(`Received ${rows.length} rows from ${tableName}`);
});

// Listen for real-time updates
client.spacetimedb.subscriptions.on('rowInserted', ({ tableName, row }) => {
  console.log(`New row in ${tableName}:`, row);
});

client.spacetimedb.subscriptions.on('rowUpdated', ({ tableName, newRow }) => {
  console.log(`Updated row in ${tableName}:`, newRow);
});

client.spacetimedb.subscriptions.on('rowDeleted', ({ tableName, row }) => {
  console.log(`Deleted row from ${tableName}:`, row);
});

// Unsubscribe when done
handle.unsubscribe();
```

### Table Accessors

```typescript
// Access cached table data
const players = client.spacetimedb.tables.player_state.getAll();
console.log(`Total players: ${players.length}`);

// Get specific row by ID
const player = client.spacetimedb.tables.player_state.get(playerId);

// Query with predicate
const activePlayers = client.spacetimedb.tables.player_state.query(
  (player) => player.isActive === true
);
```

### Game State Events

```typescript
// Listen for aggregated game state updates
client.on('gameStateUpdate', (updates) => {
  console.log(`Received ${updates.length} game state changes`);
  updates.forEach((update) => {
    console.log(`${update.type}:`, update.data);
  });
});
```

### Latency Monitoring

```typescript
// Monitor update latency (NFR5 requirement: <500ms)
client.spacetimedb.latency.on('updateLatency', ({ latency }) => {
  if (latency > 500) {
    console.warn(`High latency: ${latency}ms`);
  }
});

// Get latency statistics
const stats = client.spacetimedb.latency.getStats();
console.log('Latency stats:', stats);
// { avg: 45.2, p50: 42, p95: 78, p99: 120, count: 1000 }
```

### Publishing Game Actions (BLS Handler)

Game actions are published to the Crosstown BLS (Business Logic Service) handler, which validates signatures and forwards authenticated actions to SpacetimeDB.

**Prerequisites:**

- Crosstown BLS handler must be running and configured
- SpacetimeDB must be accessible from BLS handler
- `SPACETIMEDB_TOKEN` must be configured in BLS handler environment

**Publishing an action:**

```typescript
// Load identity (required for signing)
await client.loadIdentity('~/.sigil/identity');

// Publish action
try {
  await client.publish({
    reducer: 'player_move',
    args: [
      { x: 100, z: 200 }, // origin
      { x: 110, z: 200 }, // destination
      false, // running
    ],
  });
  console.log('Action published successfully');
} catch (error) {
  console.error('Action failed:', error);
}
```

**Handling errors:**

The BLS handler returns structured error responses for all failure modes:

```typescript
// Listen for publish errors
client.on('publishError', (error) => {
  console.error(`Action failed: ${error.message}`);
  console.error(`Error code: ${error.errorCode}`);
  console.error(`Retryable: ${error.retryable}`);

  // Handle different error types
  switch (error.errorCode) {
    case 'INVALID_SIGNATURE':
      // Signature verification failed - re-sign event
      console.error('Invalid signature - check identity is loaded');
      break;
    case 'UNKNOWN_REDUCER':
      // Reducer not found in SpacetimeDB
      console.error('Reducer does not exist:', error.message);
      break;
    case 'REDUCER_FAILED':
      // Reducer execution failed - may be retryable
      if (error.retryable) {
        console.log('Retrying action...');
        // Retry logic here
      }
      break;
    case 'INVALID_CONTENT':
      // Event content parsing failed
      console.error('Invalid event content:', error.message);
      break;
  }
});

// Publish with error handling
try {
  await client.publish({ reducer: 'test_action', args: [] });
} catch (error) {
  // Handle publish error (e.g., invalid signature, unknown reducer, reducer failure)
  if (error.errorCode === 'REDUCER_FAILED' && error.retryable) {
    // Retry after delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await client.publish({ reducer: 'test_action', args: [] });
  }
}
```

**Error codes:**

| Error Code | Description | Retryable |
|------------|-------------|-----------|
| `INVALID_SIGNATURE` | Signature verification failed | No |
| `UNKNOWN_REDUCER` | Reducer not found in SpacetimeDB | No |
| `REDUCER_FAILED` | Reducer execution failed | Yes |
| `INVALID_CONTENT` | Event content parsing failed | No |

**BLS Handler Contract:**

See [docs/bls-handler-contract.md](../../docs/bls-handler-contract.md) for the complete integration contract, including:

- Event format (kind 30078 structure)
- Signature validation requirements (NIP-01)
- Content parsing requirements
- SpacetimeDB HTTP API contract
- Error response format and error codes
- Performance and logging requirements

**BLS Handler Configuration:**

See [docker/README.md](../../docker/README.md#crosstown-bls-integration) for BLS handler setup and configuration, including:

- Environment variables (`SPACETIMEDB_URL`, `SPACETIMEDB_DATABASE`, `SPACETIMEDB_TOKEN`)
- Docker Compose configuration
- Expected log output
- Troubleshooting

### Disconnection

```typescript
// Clean disconnect (unsubscribes from all tables)
await client.disconnect();
```

## Configuration

### Connection Options

```typescript
interface SpacetimeDBConnectionOptions {
  /** Server hostname (default: 'localhost') */
  host?: string;
  /** Server port (default: 3000) */
  port?: number;
  /** Database name (default: 'bitcraft') */
  database?: string;
  /** WebSocket protocol: 'ws' for dev, 'wss' for production (default: 'ws') */
  protocol?: 'ws' | 'wss';
  /** Connection timeout in milliseconds (default: 10000) */
  timeout?: number;
}
```

### Default Configuration

```typescript
{
  host: 'localhost',
  port: 3000,
  database: 'bitcraft',
  protocol: 'ws',
  timeout: 10000
}
```

## Events

### Connection Events

- `connectionChange`: Connection state changed
  - States: `'disconnected' | 'connecting' | 'connected' | 'failed'`
  - Payload: `{ state: ConnectionState, error?: Error }`

### Game State Events

- `gameStateUpdate`: Aggregated game state updates
  - Payload: `Array<{ type: string, data: any, timestamp: number }>`

### Subscription Events

Via `client.spacetimedb.subscriptions`:

- `tableSnapshot`: Initial table data
  - Payload: `{ tableName: string, rows: any[] }`
- `rowInserted`: New row added
  - Payload: `{ tableName: string, row: any }`
- `rowUpdated`: Row modified
  - Payload: `{ tableName: string, oldRow: any, newRow: any }`
- `rowDeleted`: Row removed
  - Payload: `{ tableName: string, row: any }`

### Latency Events

Via `client.spacetimedb.latency`:

- `updateLatency`: Update latency measured
  - Payload: `{ latency: number, timestamp: number, tableName?: string }`

### Static Data Events

- `loadingProgress`: Static data loading progress
  - Payload: `{ loaded: number, total: number, tableName: string }`
- `staticDataLoaded`: Static data loading complete
  - Payload: `{ cached: boolean, metrics?: StaticDataMetrics }`
- `loadingMetrics`: Static data loading metrics
  - Payload: `{ totalTime: number, tableCount: number, avgTimePerTable: number, failedTables: string[] }`

## Type Generation

Types are generated from the BitCraft SpacetimeDB module schema. Currently using minimal stub types in `src/spacetimedb/generated/index.ts`.

Full type generation will be implemented in a future story.

## SDK Version (CRITICAL)

This package uses **SpacetimeDB SDK 1.3.3** (NOT 2.0+) to maintain compatibility with BitCraft module version 1.6.x.

SDK 2.0+ uses WebSocket protocol v2 which is **incompatible** with SpacetimeDB 1.6.x servers (protocol v1).

Do not upgrade to SDK 2.0+ until the BitCraft module is upgraded to SpacetimeDB 2.0.

## Non-Functional Requirements

### NFR5: Performance

Real-time updates must arrive within 500ms of database commit. The latency monitor tracks this and logs warnings if the threshold is exceeded.

### NFR6: Static Data Loading Performance

Static data loading (all `*_desc` tables) must complete within 10 seconds on first connection. The static data loader tracks this and logs warnings if the threshold is exceeded.

### NFR18: Compatibility

SpacetimeDB SDK 1.3.3 is required for backwards compatibility with BitCraft module 1.6.x.

## Examples

### Subscribe to Game State

See `examples/subscribe-to-game-state.ts`:

```bash
tsx packages/client/examples/subscribe-to-game-state.ts
```

### Load Static Data

See `examples/load-static-data.ts`:

```bash
tsx packages/client/examples/load-static-data.ts
```

## Testing

```bash
# Run unit tests
pnpm test:unit

# Run integration tests (requires Docker stack)
pnpm test:integration

# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage
```

### Integration Tests

Integration tests require the Docker stack from Story 1.3:

```bash
cd docker
docker compose up
```

Verify the stack is running:

```bash
curl http://localhost:3000/database/bitcraft/info
```

## Troubleshooting

### Connection Failures

**Problem**: `Connection timeout after 10000ms`

**Solution**:

- Verify Docker stack is running: `docker compose ps`
- Check server is accessible: `curl http://localhost:3000/database/bitcraft/info`
- Increase timeout in connection options if needed

### WebSocket Errors

**Problem**: `WebSocket connection failed`

**Solution**:

- For local dev, use `protocol: 'ws'` (not 'wss')
- For production, use `protocol: 'wss'` with valid SSL certificate
- Check firewall allows WebSocket connections

### High Latency

**Problem**: Update latency exceeds 500ms (NFR5)

**Solution**:

- Check network conditions
- Verify SpacetimeDB server performance
- Monitor latency stats: `client.spacetimedb.latency.getStats()`

### Type Errors

**Problem**: TypeScript errors with table types

**Solution**:

- Current implementation uses minimal stub types
- Full type generation will be implemented in future story
- Use `any` type assertions if needed: `as any`

## Architecture

The client follows a layered architecture:

1. **Connection Layer** (`src/spacetimedb/connection.ts`): WebSocket connection management
2. **Subscription Layer** (`src/spacetimedb/subscriptions.ts`): Table subscription API
3. **Table Layer** (`src/spacetimedb/tables.ts`): In-memory cache with type-safe accessors
4. **Latency Layer** (`src/spacetimedb/latency.ts`): NFR5 monitoring
5. **Surface Layer** (`src/spacetimedb/index.ts`): Unified API

All layers emit events for reactive programming.

## License

Apache 2.0

## Contributing

See main repository for contribution guidelines.
