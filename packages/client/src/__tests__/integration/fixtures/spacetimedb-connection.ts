/**
 * SpacetimeDB Direct WebSocket Connection Helpers
 * Story 5.4: Basic Action Round-Trip Validation (AC1, AC4, AC6)
 *
 * Provides direct WebSocket connection to SpacetimeDB server,
 * bypassing the BLS handler per BLOCKER-1 workaround.
 *
 * Uses @clockworklabs/spacetimedb-sdk (^1.3.3) directly.
 *
 * IMPORTANT: Do NOT use client.publish() for these tests.
 * Call reducers directly via SpacetimeDB WebSocket SDK.
 *
 * @integration
 */

/** SpacetimeDB connection configuration */
export interface SpacetimeDBTestConnectionOptions {
  /** WebSocket URL (default: ws://localhost:3000) */
  uri?: string;
  /** Database/module name (default: bitcraft) */
  moduleName?: string;
  /** Connection timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
}

/** Default connection options */
const DEFAULT_OPTIONS: Required<SpacetimeDBTestConnectionOptions> = {
  uri: process.env.SPACETIMEDB_URL || 'ws://localhost:3000',
  moduleName: process.env.SPACETIMEDB_DATABASE || 'bitcraft',
  timeoutMs: 10000,
};

/** Result from establishing a SpacetimeDB connection */
export interface SpacetimeDBTestConnection {
  /** The raw DbConnection instance from SpacetimeDB SDK */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: any;
  /** The SpacetimeDB Identity assigned to this connection */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  identity: any;
  /** The auth token for this connection (can be used for reconnection) */
  token: string;
  /** Disconnect and clean up this connection */
  disconnect: () => void;
}

/**
 * Connect to SpacetimeDB directly via WebSocket
 *
 * Creates a fresh connection with an auto-generated identity.
 * The SpacetimeDB SDK assigns a unique Identity to each new connection,
 * which becomes the player identity via ctx.sender in reducers.
 *
 * BLOCKER-1 Workaround: This bypasses BLS handler entirely.
 * The SpacetimeDB connection identity IS the player identity.
 *
 * @param options - Connection configuration
 * @returns Promise resolving to SpacetimeDBTestConnection
 * @throws Error if connection fails or times out
 */
export async function connectToSpacetimeDB(
  options?: SpacetimeDBTestConnectionOptions
): Promise<SpacetimeDBTestConnection> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Dynamic import of SpacetimeDB SDK
  // The SDK is a dependency of @sigil/client (^1.3.3)
  // Note: SDK exports DbConnectionBuilder (not DbConnection). We create a builder
  // with a null remote module, which gives us raw DbConnectionImpl access.
  const { DbConnectionBuilder } = await import('@clockworklabs/spacetimedb-sdk');

  return new Promise((resolve, reject) => {
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`SpacetimeDB connection timeout after ${opts.timeoutMs}ms`));
      }
    }, opts.timeoutMs);

    try {
      // Create builder with null remote module and identity passthrough.
      // The builder pattern: new DbConnectionBuilder(remoteModule, identityConstructor)
      // With null remote module, we get the raw DbConnectionImpl which provides
      // .db, .reducers, .subscribe() for direct interaction with SpacetimeDB.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder = new DbConnectionBuilder(null as any, (impl: any) => impl);

      const connection = builder
        .withUri(opts.uri)
        .withModuleName(opts.moduleName)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onConnect((conn: any, identity: any, token: string) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve({
              connection: conn,
              identity,
              token,
              disconnect: () => {
                try {
                  if (conn && typeof conn.disconnect === 'function') {
                    conn.disconnect();
                  }
                } catch {
                  // Ignore disconnect errors during cleanup
                }
              },
            });
          }
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onConnectError((_ctx: any, error: Error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            reject(new Error(`SpacetimeDB connection failed: ${error.message}`));
          }
        })
        .build();

      // The build() call initiates the WebSocket connection. The `connection` local
      // variable is intentionally unused -- the actual connection object (`conn`) is
      // captured in the `onConnect` closure and returned to the caller via the resolved
      // SpacetimeDBTestConnection. The `void` suppresses the unused variable linter warning.
      void connection;
    } catch (error) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(
          new Error(
            `SpacetimeDB connection setup failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }
  });
}

/**
 * Disconnect from SpacetimeDB and clean up resources
 *
 * Safe to call multiple times. Ignores errors during cleanup.
 *
 * @param testConnection - Connection to disconnect
 */
export function disconnectFromSpacetimeDB(testConnection: SpacetimeDBTestConnection | null): void {
  if (testConnection) {
    testConnection.disconnect();
  }
}
