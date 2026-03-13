/**
 * Sigil Client - Core SDK Entry Point
 *
 * Provides the main client interface for interacting with Sigil:
 * - Nostr identity management (client.identity)
 * - SpacetimeDB integration (client.spacetimedb)
 * - Nostr event publishing (future: client.nostr)
 * - ILP packet publishing via @crosstown/client (client.publish())
 */

import { EventEmitter } from 'events';
import {
  finalizeEvent,
  verifyEvent,
  type EventTemplate,
  type Event as NostrToolsEvent,
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
import type { NostrRelayOptions, NostrEvent } from './nostr/types';
import { ActionCostRegistryLoader, type ActionCostRegistry } from './publish/action-cost-registry';
import { WalletClient } from './wallet/wallet-client';
import { SigilError } from './nostr/nostr-client';
import {
  constructILPPacket,
  type ILPPacketOptions,
  type ILPPacketResult,
} from './publish/ilp-packet';
import { CrosstownAdapter } from './crosstown/crosstown-adapter';

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
  sign(event: EventTemplate): Promise<NostrToolsEvent>;
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
   * Crosstown connector HTTP URL (Story 2.2-2.5)
   *
   * Used for ILP packet routing via @crosstown/client.
   * Defaults to 'http://localhost:4041'.
   *
   * SECURITY: In production (NODE_ENV=production), must use https:// protocol.
   * Development mode allows http://localhost for local testing.
   *
   * @example 'http://localhost:4041' (development)
   * @example 'https://crosstown.example.com' (production)
   */
  crosstownConnectorUrl?: string;
  /**
   * Publish timeout in milliseconds (Story 2.3-2.5)
   *
   * Maximum time to wait for publish CONFIRMATION on Nostr relay.
   * This is separate from CrosstownClient's internal transport timeout.
   * Defaults to 2000ms (2 seconds).
   *
   * @example 2000 (default)
   * @example 5000 (5 seconds for slower networks)
   */
  publishTimeout?: number;
  /**
   * BTP WebSocket endpoint for CrosstownClient (Story 2.5)
   *
   * Optional BTP endpoint for CrosstownClient's ILP routing.
   * Falls back to BTP_ENDPOINT env var, then default localhost endpoint.
   *
   * SECURITY: In production (NODE_ENV=production), wss:// is required.
   * In development, ws://localhost is permitted for local Docker stack.
   *
   * @example 'wss://btp.example.com:3000' (production)
   * @example 'wss://custom-btp:3001' (custom production)
   */
  btpEndpoint?: string;
}

/**
 * Pending publish tracking
 *
 * Tracks in-flight publish operations waiting for confirmation.
 */
interface PendingPublish {
  /** Resolver for the publish promise */
  resolve: (result: ILPPacketResult) => void;
  /** Rejecter for the publish promise */
  reject: (error: Error) => void;
  /** Timeout timer ID */
  timeoutId: NodeJS.Timeout;
  /** Original reducer name */
  reducer: string;
  /** Original args */
  args: unknown;
  /** Fee paid */
  fee: number;
}

/**
 * Publish API namespace
 *
 * Provides action cost queries, affordability checks, and publish() method (Story 2.2-2.5).
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

  /**
   * Publish a game action via ILP packet
   *
   * Constructs a content-only ILP packet template and delegates signing,
   * TOON encoding, and transport to @crosstown/client via CrosstownAdapter.
   * Waits for confirmation event from Nostr relay before resolving.
   *
   * Flow (Story 2.5):
   * 1. Validate client state (identity, CrosstownAdapter, cost registry)
   * 2. Look up action cost from registry
   * 3. Check wallet balance (fail fast if insufficient)
   * 4. Construct content-only ILP packet template (kind 30078)
   * 5. Submit to CrosstownAdapter.publishEvent() -- signs, TOON-encodes, ILP-routes
   * 6. Wait for confirmation event via Nostr subscription
   * 7. Return confirmation details
   *
   * @param options - Reducer name and arguments
   * @returns Promise resolving to confirmation details
   * @throws SigilError with various codes
   */
  publish(options: ILPPacketOptions): Promise<ILPPacketResult>;
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
  private crosstownAdapter: CrosstownAdapter | null = null;
  private pendingPublishes: Map<string, PendingPublish> = new Map();
  private confirmationSubscriptionId: string | null = null;
  private publishTimeout: number;
  private pendingPublishCleanupInterval: NodeJS.Timeout | null = null;
  private btpEndpoint?: string;

  constructor(config?: SigilClientConfig) {
    super();

    // Store Crosstown connector URL (default: http://localhost:4041)
    this.crosstownConnectorUrl = config?.crosstownConnectorUrl || 'http://localhost:4041';

    // Store publish timeout (default: 2000ms)
    this.publishTimeout = config?.publishTimeout ?? 2000;

    // Store BTP endpoint for deferred CrosstownAdapter creation
    this.btpEndpoint = config?.btpEndpoint;

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
      // Also check if this matches a pending publish
      this.handleActionConfirmation(confirmation);
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

    // CrosstownAdapter is NOT created here -- needs secretKey from identity
    // It will be lazily created in connect() after identity is loaded

    // Initialize wallet client (Story 2.2)
    // Note: Wallet client requires identity to be loaded first for public key
    // We'll initialize it lazily in the wallet getter

    // Initialize publish API (Story 2.2-2.5)
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

      publish: async (options: ILPPacketOptions): Promise<ILPPacketResult> => {
        return this.publishAction(options);
      },
    };

    // Start periodic cleanup of stale pending publishes (ISSUE-3 fix)
    // Run every 60 seconds to clean up entries older than 2x publishTimeout
    this.pendingPublishCleanupInterval = setInterval(() => {
      this.cleanupStalePendingPublishes();
    }, 60000); // 60 seconds
  }

  /**
   * Access wallet client (Story 2.2)
   *
   * Provides wallet balance queries via Crosstown connector HTTP API.
   *
   * @throws Error if identity not loaded (call loadIdentity first)
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
   * Access publish API (Story 2.2-2.5)
   *
   * Provides action cost queries, affordability checks, and publish().
   */
  get publish(): PublishAPI {
    return this._publish;
  }

  /**
   * Access SpacetimeDB surface
   */
  get spacetimedb(): SpacetimeDBSurface {
    return this._spacetimedb;
  }

  /**
   * Access Nostr client
   */
  get nostr(): NostrClient {
    return this._nostr;
  }

  /**
   * Access static data loader (convenience accessor)
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
   * Connect to SpacetimeDB server, Nostr relay, and Crosstown connector
   *
   * Establishes connections to all services in parallel.
   * CrosstownAdapter is lazily created here if identity is loaded and URL is configured.
   */
  async connect(): Promise<void> {
    // Create CrosstownAdapter if identity loaded and URL configured
    if (this.keypair && this.crosstownConnectorUrl) {
      try {
        this.crosstownAdapter = new CrosstownAdapter({
          secretKey: this.keypair.privateKey,
          connectorUrl: this.crosstownConnectorUrl,
          btpEndpoint: this.btpEndpoint,
        });
      } catch (error) {
        // Emit error but don't fail connection if adapter creation fails
        this.emit('crosstownAdapterError', error);
      }
    }

    // Connect to SpacetimeDB, Nostr relay, and optionally Crosstown in parallel
    await Promise.all([
      this._spacetimedb.connection.connect(),
      this._nostr.connect(),
      this.crosstownAdapter?.start(),
    ]);

    // Auto-load static data if configured
    if (this.autoLoadStaticData) {
      try {
        await this._spacetimedb.staticData.load();
      } catch (error) {
        // Emit error event instead of console.error for proper error handling
        this.emit('staticDataLoadError', error);
        // Don't fail connection if static data loading fails
      }
    }
  }

  /**
   * Disconnect from SpacetimeDB server, Nostr relay, and Crosstown connector
   *
   * Cleanly closes all connections and unsubscribes from all tables/subscriptions.
   */
  async disconnect(): Promise<void> {
    // Mark as manual disconnect (skip auto-reconnection)
    if (this.reconnectionManager) {
      this.reconnectionManager.markManualDisconnect();
    }

    // Stop pending publish cleanup interval (ISSUE-3 fix)
    if (this.pendingPublishCleanupInterval) {
      clearInterval(this.pendingPublishCleanupInterval);
      this.pendingPublishCleanupInterval = null;
    }

    // Stop CrosstownAdapter before clearing pending publishes
    if (this.crosstownAdapter) {
      try {
        await this.crosstownAdapter.stop();
      } catch {
        // Ignore adapter stop errors during disconnect
      }
      this.crosstownAdapter = null;
    }

    // Reject all pending publishes with CLIENT_DISCONNECTED error
    for (const [eventId, pending] of this.pendingPublishes.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(
        new SigilError(
          `Client disconnected while waiting for confirmation of event ${eventId}`,
          'CLIENT_DISCONNECTED',
          'publish',
          { eventId }
        )
      );
    }
    this.pendingPublishes.clear();

    // Unsubscribe from confirmation subscription
    if (this.confirmationSubscriptionId) {
      this.confirmationSubscriptionId = null;
    }

    // Unsubscribe from all tables
    this._spacetimedb.subscriptions.unsubscribeAll();

    // Clear table caches (internal method from createSpacetimeDBSurface)
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
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async subscribe(tableName: string, query: any): Promise<any> {
    return this._spacetimedb.subscriptions.subscribe(tableName, query);
  }

  /**
   * Load user identity from encrypted file
   *
   * Must be called before accessing the identity property.
   */
  async loadIdentity(passphrase: string, filePath?: string): Promise<void> {
    this.keypair = await loadKeypair(passphrase, filePath);
  }

  /**
   * Handle action confirmation event from Nostr relay
   *
   * Matches confirmation to pending publish and resolves promise.
   */
  private handleActionConfirmation(confirmation: {
    eventId: string;
    reducer: string;
    args: unknown;
    fee: number;
    pubkey: string;
    timestamp: number;
  }): void {
    const pending = this.pendingPublishes.get(confirmation.eventId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingPublishes.delete(confirmation.eventId);

    pending.resolve({
      eventId: confirmation.eventId,
      reducer: confirmation.reducer,
      args: confirmation.args,
      fee: confirmation.fee,
      pubkey: confirmation.pubkey,
      timestamp: confirmation.timestamp,
    });
  }

  /**
   * Cleanup a pending publish
   */
  private cleanupPendingPublish(eventId: string): void {
    const pending = this.pendingPublishes.get(eventId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingPublishes.delete(eventId);
    }
  }

  /**
   * Cleanup stale pending publishes (ISSUE-3 fix)
   */
  private cleanupStalePendingPublishes(): void {
    if (this.pendingPublishes.size > 1000) {
      const firstEntry = this.pendingPublishes.entries().next();
      if (!firstEntry.done) {
        const [oldEventId, oldPending] = firstEntry.value;
        clearTimeout(oldPending.timeoutId);
        oldPending.reject(
          new SigilError(
            `Pending publish map size limit exceeded. Event ${oldEventId} was cleaned up.`,
            'CLIENT_ERROR',
            'publish',
            { eventId: oldEventId, mapSize: this.pendingPublishes.size }
          )
        );
        this.pendingPublishes.delete(oldEventId);
      }
    }
  }

  /**
   * Ensure confirmation subscription is active
   */
  private ensureConfirmationSubscription(): void {
    if (this.confirmationSubscriptionId) {
      return;
    }

    if (!this.keypair) {
      throw new SigilError(
        'Identity not loaded. Call loadIdentity() first.',
        'IDENTITY_NOT_LOADED',
        'publish'
      );
    }

    const publicKeyHex = bytesToHex(this.keypair.publicKey);

    const subscription = this._nostr.subscribe(
      [{ kinds: [30078], authors: [publicKeyHex] }],
      (event: NostrEvent) => {
        try {
          JSON.parse(event.content) as { reducer?: string; args?: unknown };
        } catch {
          // Ignore malformed events
        }
      }
    );

    this.confirmationSubscriptionId = subscription.id;
  }

  /**
   * Publish a game action via ILP packet
   *
   * Story 2.5: Uses CrosstownAdapter instead of direct CrosstownConnector.
   * Constructs content-only template, delegates signing/transport to @crosstown/client.
   */
  private async publishAction(options: ILPPacketOptions): Promise<ILPPacketResult> {
    // 1. Validate client state
    if (!this.keypair) {
      throw new SigilError(
        'Identity not loaded. Call loadIdentity() first.',
        'IDENTITY_NOT_LOADED',
        'publish'
      );
    }

    if (!this.crosstownAdapter) {
      throw new SigilError(
        'Crosstown adapter not configured. Provide crosstownConnectorUrl in SigilClientConfig and call connect().',
        'CROSSTOWN_NOT_CONFIGURED',
        'publish'
      );
    }

    if (!this.actionCostRegistry) {
      throw new SigilError(
        'Action cost registry not loaded. Provide actionCostRegistryPath in SigilClientConfig.',
        'REGISTRY_NOT_LOADED',
        'publish'
      );
    }

    // 2. Look up action cost
    const cost = this._publish.getCost(options.reducer);

    // 3. Check wallet balance (fail fast)
    const balance = await this.wallet.getBalance();
    if (balance < cost) {
      throw new SigilError(
        `Insufficient balance for action '${options.reducer}'. Required: ${cost}, Available: ${balance}`,
        'INSUFFICIENT_BALANCE',
        'crosstown',
        { action: options.reducer, required: cost, available: balance, timestamp: Date.now() }
      );
    }

    // 4. Construct content-only ILP packet template (no pubkey, no signing)
    const eventTemplate = constructILPPacket(options, cost);

    // 5. Ensure confirmation subscription is active
    this.ensureConfirmationSubscription();

    // 6. Submit to CrosstownAdapter -- signs, TOON-encodes, ILP-routes
    const publishResult: ILPPacketResult = await this.crosstownAdapter.publishEvent(eventTemplate);

    // 7. Create promise for confirmation wait (using eventId from adapter result)
    const confirmationPromise = new Promise<ILPPacketResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.cleanupPendingPublish(publishResult.eventId);
        reject(
          new SigilError(
            `Confirmation timeout for event ${publishResult.eventId} after ${this.publishTimeout}ms`,
            'CONFIRMATION_TIMEOUT',
            'crosstown',
            { eventId: publishResult.eventId, timeout: this.publishTimeout }
          )
        );
      }, this.publishTimeout);

      this.pendingPublishes.set(publishResult.eventId, {
        resolve,
        reject,
        timeoutId,
        reducer: options.reducer,
        args: options.args,
        fee: cost,
      });
    });

    // 8. Wait for confirmation
    return confirmationPromise;
  }

  /**
   * Access user's Nostr identity
   *
   * Provides public key and signing capability.
   * The private key is NEVER exposed.
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
        // This is SEPARATE from the publish pipeline -- identity.sign() is for arbitrary events
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
