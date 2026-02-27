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
import { NostrClient } from './nostr/nostr-client';
import type { NostrRelayOptions } from './nostr/types';
import { ActionCostRegistryLoader, type ActionCostRegistry } from './publish/action-cost-registry';
import { WalletClient } from './wallet/wallet-client';
import { SigilError } from './nostr/nostr-client';

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
  /** Reconnection options (SpacetimeDB) */
  reconnection?: ReconnectionOptions;
  /** Nostr relay options (Story 2.1) */
  nostrRelay?: NostrRelayOptions;
  /**
   * Path to action cost registry JSON file (Story 2.2)
   *
   * Absolute or relative to process.cwd(). If not provided, cost queries will throw.
   *
   * @example './packages/client/config/default-action-costs.json'
   */
  actionCostRegistryPath?: string;
  /**
   * Crosstown connector HTTP URL (Story 2.2)
   *
   * Used for wallet balance queries. Defaults to 'http://localhost:4041'.
   *
   * @example 'http://localhost:4041'
   */
  crosstownConnectorUrl?: string;
}

/**
 * Publish API namespace
 *
 * Provides action cost queries and affordability checks (Story 2.2).
 */
export interface PublishAPI {
  /**
   * Get ILP cost for a game action
   *
   * @param actionName - Reducer name (e.g., "player_move")
   * @returns Action cost (non-negative number)
   * @throws SigilError with code REGISTRY_NOT_LOADED if registry not configured
   *
   * @example
   * ```typescript
   * const cost = client.publish.getCost('player_move'); // Returns 1
   * ```
   */
  getCost(actionName: string): number;

  /**
   * Check if current wallet balance can afford an action
   *
   * @param actionName - Reducer name (e.g., "player_move")
   * @returns Promise resolving to true if balance >= cost, false otherwise
   * @throws SigilError if cost registry not loaded or balance query fails
   *
   * @example
   * ```typescript
   * const canAfford = await client.publish.canAfford('player_move');
   * if (canAfford) {
   *   console.log('Can afford action!');
   * }
   * ```
   */
  canAfford(actionName: string): Promise<boolean>;
}

/**
 * Main Sigil Client class
 *
 * Coordinates all SDK functionality: identity, SpacetimeDB, Nostr, and ILP.
 */
export class SigilClient extends EventEmitter {
  private keypair: NostrKeypair | null = null;
  private _spacetimedb: SpacetimeDBSurface;
  private _nostr: NostrClient;
  private autoLoadStaticData: boolean;
  private reconnectionManager: ReconnectionManager | null = null;
  private actionCostRegistry: ActionCostRegistry | null = null;
  private _wallet: WalletClient | null = null;
  private _publish: PublishAPI;
  private crosstownConnectorUrl: string;

  constructor(config?: SigilClientConfig) {
    super();

    // Store Crosstown connector URL (default: http://localhost:4041)
    this.crosstownConnectorUrl = config?.crosstownConnectorUrl || 'http://localhost:4041';

    // Initialize SpacetimeDB surface
    this._spacetimedb = createSpacetimeDBSurface(config?.spacetimedb, this);

    // Configure auto-loading of static data (default: true)
    this.autoLoadStaticData = config?.autoLoadStaticData ?? true;

    // Initialize reconnection manager with SubscriptionManager
    this.reconnectionManager = new ReconnectionManager(
      this._spacetimedb.connection,
      config?.reconnection,
      this._spacetimedb.subscriptions
    );

    // Forward reconnection events
    this.reconnectionManager.on('connectionChange', (event) => {
      this.emit('reconnectionChange', event);
    });

    this.reconnectionManager.on('subscriptionsRecovered', (event) => {
      this.emit('subscriptionsRecovered', event);
    });

    // Initialize Nostr client (Story 2.1)
    this._nostr = new NostrClient(config?.nostrRelay);

    // Forward Nostr events to SigilClient
    this._nostr.on('connectionChange', (event) => {
      this.emit('nostrConnectionChange', event);
    });

    this._nostr.on('actionConfirmed', (confirmation) => {
      this.emit('actionConfirmed', confirmation);
    });

    this._nostr.on('notice', (message) => {
      this.emit('nostrNotice', message);
    });

    this._nostr.on('error', (error) => {
      this.emit('nostrError', error);
    });

    this._nostr.on('eose', (subscriptionId) => {
      this.emit('nostrEose', subscriptionId);
    });

    // Load action cost registry if path provided (Story 2.2)
    if (config?.actionCostRegistryPath) {
      const loader = new ActionCostRegistryLoader();
      // Loader throws on error, preventing partial client initialization
      this.actionCostRegistry = loader.load(config.actionCostRegistryPath);
    }

    // Initialize wallet client (Story 2.2)
    // Note: Wallet client requires identity to be loaded first for public key
    // We'll initialize it lazily in the wallet getter

    // Initialize publish API (Story 2.2)
    this._publish = {
      getCost: (actionName: string): number => {
        if (!this.actionCostRegistry) {
          throw new SigilError(
            'Action cost registry not loaded. Provide actionCostRegistryPath in SigilClientConfig.',
            'REGISTRY_NOT_LOADED',
            'action-cost-registry'
          );
        }

        // Check if action exists in registry
        if (actionName in this.actionCostRegistry.actions) {
          return this.actionCostRegistry.actions[actionName].cost;
        }

        // Action not found, return defaultCost with warning
        console.warn(
          `Action "${actionName}" not found in cost registry. Using defaultCost: ${this.actionCostRegistry.defaultCost}`
        );
        return this.actionCostRegistry.defaultCost;
      },

      canAfford: async (actionName: string): Promise<boolean> => {
        // getCost will throw if registry not loaded
        const cost = this._publish.getCost(actionName);

        // getBalance will throw if network error or invalid response
        const balance = await this.wallet.getBalance();

        return balance >= cost;
      },
    };
  }

  /**
   * Access wallet client (Story 2.2)
   *
   * Provides wallet balance queries via Crosstown connector HTTP API.
   *
   * @throws Error if identity not loaded (call loadIdentity first)
   *
   * @example
   * ```typescript
   * const client = new SigilClient({
   *   crosstownConnectorUrl: 'http://localhost:4041'
   * });
   * await client.loadIdentity('passphrase');
   *
   * const balance = await client.wallet.getBalance(); // Returns 10000
   * ```
   */
  get wallet(): WalletClient {
    if (!this._wallet) {
      // Initialize wallet client lazily (requires identity)
      if (!this.keypair) {
        throw new Error('Identity not loaded. Call loadIdentity() first.');
      }

      const publicKeyHex = bytesToHex(this.keypair.publicKey);
      this._wallet = new WalletClient(this.crosstownConnectorUrl, publicKeyHex);
    }

    return this._wallet;
  }

  /**
   * Access publish API (Story 2.2)
   *
   * Provides action cost queries and affordability checks.
   *
   * @example
   * ```typescript
   * const cost = client.publish.getCost('player_move'); // Returns 1
   * const canAfford = await client.publish.canAfford('player_move'); // Returns true/false
   * ```
   */
  get publish(): PublishAPI {
    return this._publish;
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
   * Access Nostr client
   *
   * Provides Nostr relay connection, subscriptions, and event publishing (Story 2.1+).
   *
   * @example
   * ```typescript
   * const client = new SigilClient({
   *   nostrRelay: { url: 'ws://localhost:4040' }
   * });
   *
   * await client.connect();
   *
   * // Subscribe to action confirmations
   * const sub = client.nostr.subscribe([{ kinds: [30078] }], (event) => {
   *   console.log('Action confirmed:', event);
   * });
   *
   * // Later...
   * sub.unsubscribe();
   * ```
   */
  get nostr(): NostrClient {
    return this._nostr;
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
   * Connect to SpacetimeDB server and Nostr relay
   *
   * Establishes WebSocket connections to both services.
   * If autoLoadStaticData is true (default), static data loads automatically.
   *
   * @example
   * ```typescript
   * const client = new SigilClient({
   *   spacetimedb: { host: 'localhost', port: 3000, database: 'bitcraft' },
   *   nostrRelay: { url: 'ws://localhost:4040' }
   * });
   * await client.connect();
   * // Both SpacetimeDB and Nostr relay are now connected
   * ```
   */
  async connect(): Promise<void> {
    // Connect to both SpacetimeDB and Nostr relay in parallel
    await Promise.all([this._spacetimedb.connection.connect(), this._nostr.connect()]);

    // Auto-load static data if configured
    if (this.autoLoadStaticData) {
      try {
        await this._spacetimedb.staticData.load();
      } catch (error) {
        // Emit error event instead of console.error for proper error handling
        this.emit('staticDataLoadError', error);
        // Don't fail connection if static data loading fails
        // User can manually retry with client.staticData.load()
      }
    }
  }

  /**
   * Disconnect from SpacetimeDB server and Nostr relay
   *
   * Cleanly closes both connections and unsubscribes from all tables/subscriptions.
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
    // Type assertion is safe because we know createSpacetimeDBSurface adds this method
    const surface = this._spacetimedb as SpacetimeDBSurface & {
      _clearTableCache?: () => void;
    };
    if (surface._clearTableCache) {
      surface._clearTableCache();
    }

    // Disconnect from both services in parallel
    await Promise.all([this._spacetimedb.connection.disconnect(), this._nostr.disconnect()]);
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
