/**
 * Sigil Client - Core SDK Entry Point
 *
 * Provides the main client interface for interacting with Sigil:
 * - Nostr identity management (client.identity)
 * - SpacetimeDB integration (client.spacetimedb)
 * - Nostr event publishing (future: client.nostr)
 * - ILP packet publishing (future: client.publish())
 */

import { EventEmitter } from 'events';
import {
  finalizeEvent,
  verifyEvent,
  type EventTemplate,
  type Event as NostrEvent,
} from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { bytesToHex } from '@noble/hashes/utils';
import type { NostrKeypair } from './nostr/keypair';
import { loadKeypair } from './nostr/storage';
import {
  createSpacetimeDBSurface,
  type SpacetimeDBSurface,
  type SpacetimeDBConnectionOptions,
} from './spacetimedb';
import { ReconnectionManager } from './spacetimedb/reconnection-manager';
import type {
  ConnectionState as ReconnectionConnectionState,
  ReconnectionMetrics,
  ReconnectionOptions,
} from './spacetimedb/reconnection-types';

/**
 * Client identity interface
 *
 * Provides access to the user's Nostr public key and signing capability.
 * The private key is NEVER exposed through this interface.
 */
export interface ClientIdentity {
  /**
   * User's Nostr public key in multiple formats
   */
  publicKey: {
    hex: string; // 64-character hex string
    npub: string; // bech32-encoded npub format
  };

  /**
   * Sign a Nostr event with the user's private key
   *
   * @param event - Event template (kind, created_at, tags, content)
   * @returns Promise resolving to signed event with id, sig, and pubkey fields
   */
  sign(event: EventTemplate): Promise<NostrEvent>;
}

/**
 * Sigil Client configuration
 */
export interface SigilClientConfig {
  /** SpacetimeDB connection options */
  spacetimedb?: SpacetimeDBConnectionOptions;
  /** Auto-load static data on connect (default: true) */
  autoLoadStaticData?: boolean;
  /** Reconnection options */
  reconnection?: ReconnectionOptions;
  // Future: Nostr relay list
}

/**
 * Main Sigil Client class
 *
 * Coordinates all SDK functionality: identity, SpacetimeDB, Nostr, and ILP.
 */
export class SigilClient extends EventEmitter {
  private keypair: NostrKeypair | null = null;
  private _spacetimedb: SpacetimeDBSurface;
  private autoLoadStaticData: boolean;
  private reconnectionManager: ReconnectionManager | null = null;

  constructor(config?: SigilClientConfig) {
    super();

    // Initialize SpacetimeDB surface
    this._spacetimedb = createSpacetimeDBSurface(config?.spacetimedb, this);

    // Configure auto-loading of static data (default: true)
    this.autoLoadStaticData = config?.autoLoadStaticData ?? true;

    // Initialize reconnection manager
    this.reconnectionManager = new ReconnectionManager(
      this._spacetimedb.connection,
      config?.reconnection
    );

    // Forward reconnection events
    this.reconnectionManager.on('connectionChange', (event) => {
      this.emit('reconnectionChange', event);
    });

    this.reconnectionManager.on('subscriptionsRecovered', (event) => {
      this.emit('subscriptionsRecovered', event);
    });

    // Future: Initialize Nostr relay pool
  }

  /**
   * Access SpacetimeDB surface
   *
   * Provides connection, subscriptions, table accessors, static data, and latency monitoring.
   *
   * @example
   * ```typescript
   * const client = new SigilClient({
   *   spacetimedb: { host: 'localhost', port: 3000, database: 'bitcraft' }
   * });
   *
   * await client.connect();
   * const handle = await client.spacetimedb.subscribe('player_state', {});
   * const players = client.spacetimedb.tables.player_state.getAll();
   *
   * // Access static data
   * const item = client.spacetimedb.staticData.get('item_desc', 1);
   * ```
   */
  get spacetimedb(): SpacetimeDBSurface {
    return this._spacetimedb;
  }

  /**
   * Access static data loader (convenience accessor)
   *
   * Provides quick access to static data queries.
   * Same as `client.spacetimedb.staticData`.
   *
   * @example
   * ```typescript
   * const item = client.staticData.get('item_desc', 1);
   * const allItems = client.staticData.getAll('item_desc');
   * ```
   */
  get staticData() {
    return this._spacetimedb.staticData;
  }

  /**
   * Check if static data is loaded
   */
  get isStaticDataLoaded(): boolean {
    return this._spacetimedb.staticData.loadingState === 'loaded';
  }

  /**
   * Connect to SpacetimeDB server
   *
   * Establishes WebSocket connection to SpacetimeDB.
   * If autoLoadStaticData is true (default), static data loads automatically.
   *
   * @example
   * ```typescript
   * const client = new SigilClient({
   *   spacetimedb: { host: 'localhost', port: 3000, database: 'bitcraft' }
   * });
   * await client.connect();
   * // Static data is now loaded automatically
   * ```
   */
  async connect(): Promise<void> {
    await this._spacetimedb.connection.connect();

    // Auto-load static data if configured
    if (this.autoLoadStaticData) {
      try {
        await this._spacetimedb.staticData.load();
      } catch (error) {
        console.error('Failed to auto-load static data:', error);
        // Don't fail connection if static data loading fails
        // User can manually retry with client.staticData.load()
      }
    }
  }

  /**
   * Disconnect from SpacetimeDB server
   *
   * Cleanly closes connection and unsubscribes from all tables.
   *
   * @example
   * ```typescript
   * await client.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
    // Mark as manual disconnect (skip auto-reconnection)
    if (this.reconnectionManager) {
      this.reconnectionManager.markManualDisconnect();
    }

    // Unsubscribe from all tables
    this._spacetimedb.subscriptions.unsubscribeAll();

    // Clear table caches (internal method from createSpacetimeDBSurface)
    const surface = this._spacetimedb as SpacetimeDBSurface & { _clearTableCache?: () => void };
    if (surface._clearTableCache) {
      surface._clearTableCache();
    }

    // Disconnect
    await this._spacetimedb.connection.disconnect();
  }

  /**
   * Get current reconnection state
   */
  getReconnectionState(): ReconnectionConnectionState {
    return this.reconnectionManager?.state || 'disconnected';
  }

  /**
   * Get reconnection metrics
   */
  getReconnectionMetrics(): ReconnectionMetrics | null {
    return this.reconnectionManager?.getMetrics() || null;
  }

  /**
   * Cancel ongoing reconnection attempts
   */
  cancelReconnection(): void {
    this.reconnectionManager?.cancelReconnection();
  }

  /**
   * Retry connection after failure
   */
  async retryConnection(): Promise<void> {
    if (this.reconnectionManager) {
      await this.reconnectionManager.retryConnection();
    }
  }

  /**
   * Subscribe to table updates (convenience method)
   *
   * @param tableName - Name of table to subscribe to
   * @param query - Query filter (empty object {} for all rows)
   * @returns Promise resolving to subscription handle
   *
   * @example
   * ```typescript
   * const handle = await client.spacetimedb.subscribe('player_state', {});
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async subscribe(tableName: string, query: any): Promise<any> {
    return this._spacetimedb.subscriptions.subscribe(tableName, query);
  }

  /**
   * Load user identity from encrypted file
   *
   * Must be called before accessing the identity property.
   *
   * @param passphrase - Passphrase to decrypt the identity file
   * @param filePath - Optional custom path to identity file (defaults to ~/.sigil/identity)
   *
   * @example
   * ```typescript
   * const client = new SigilClient();
   * await client.loadIdentity('my-passphrase');
   * console.log('Logged in as:', client.identity.publicKey.npub);
   * ```
   */
  async loadIdentity(passphrase: string, filePath?: string): Promise<void> {
    this.keypair = await loadKeypair(passphrase, filePath);
  }

  /**
   * Access user's Nostr identity
   *
   * Provides public key and signing capability.
   * The private key is NEVER exposed.
   *
   * @throws Error if identity not loaded (call loadIdentity first)
   *
   * @example
   * ```typescript
   * const client = new SigilClient();
   * await client.loadIdentity('my-passphrase');
   *
   * // Access public key
   * console.log('npub:', client.identity.publicKey.npub);
   *
   * // Sign an event
   * const signed = await client.identity.sign({
   *   kind: 1,
   *   created_at: Math.floor(Date.now() / 1000),
   *   tags: [],
   *   content: 'Hello, Nostr!',
   * });
   * ```
   */
  get identity(): ClientIdentity {
    if (!this.keypair) {
      throw new Error('Identity not loaded. Call loadIdentity() first.');
    }

    const publicKeyHex = bytesToHex(this.keypair.publicKey);
    const publicKeyNpub = nip19.npubEncode(publicKeyHex);

    return {
      publicKey: {
        hex: publicKeyHex,
        npub: publicKeyNpub,
      },
      sign: async (event: EventTemplate): Promise<NostrEvent> => {
        if (!this.keypair) {
          throw new Error('Identity not loaded');
        }

        // Sign event using nostr-tools finalizeEvent
        // This automatically adds id, pubkey, and sig fields
        const signedEvent = finalizeEvent(event, this.keypair.privateKey);

        // Verify signature (sanity check)
        const isValid = verifyEvent(signedEvent);
        if (!isValid) {
          throw new Error('Failed to create valid signature');
        }

        return signedEvent;
      },
    };
  }
}
