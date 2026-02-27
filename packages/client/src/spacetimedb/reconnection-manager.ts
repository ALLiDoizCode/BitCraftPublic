/**
 * Reconnection Manager
 * Story 1.6: Auto-Reconnection & State Recovery
 *
 * Manages automatic reconnection with exponential backoff and subscription recovery.
 */

import { EventEmitter } from 'events';
import type {
  ConnectionState,
  ConnectionChangeEvent,
  SubscriptionsRecoveredEvent,
  ReconnectionMetrics,
  ReconnectionOptions,
  SubscriptionMetadata,
} from './reconnection-types';

/**
 * Default reconnection options
 */
const DEFAULT_OPTIONS: Required<ReconnectionOptions> = {
  autoReconnect: true,
  maxReconnectAttempts: 10,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds (NFR10)
  jitterPercent: 10,
};

/**
 * Short delay before starting reconnection to allow event handlers to process
 */
const RECONNECTION_START_DELAY_MS = 100;

/**
 * Timeout for subscription recovery operations (5 seconds)
 */
const SUBSCRIPTION_RECOVERY_TIMEOUT_MS = 5000;

/**
 * Reconnection Manager
 *
 * Handles automatic reconnection with exponential backoff, subscription recovery,
 * and connection state monitoring.
 *
 * @example
 * ```typescript
 * const manager = new ReconnectionManager(connection, {
 *   autoReconnect: true,
 *   maxReconnectAttempts: 10,
 * });
 *
 * manager.on('connectionChange', ({ status, reason }) => {
 *   console.log('Connection status:', status, reason);
 * });
 *
 * manager.on('subscriptionsRecovered', ({ totalSubscriptions, recoveryTimeMs }) => {
 *   console.log(`Recovered ${totalSubscriptions} subscriptions in ${recoveryTimeMs}ms`);
 * });
 * ```
 */
export class ReconnectionManager extends EventEmitter {
  private connection: {
    connect(): Promise<void>;
    on(event: string, listener: (event: unknown) => void): void;
    subscriptions?: Map<string, Record<string, unknown>>;
  };
  private subscriptionManager: {
    subscribe(tableName: string, query: Record<string, unknown>): Promise<unknown>;
    getActiveSubscriptions(): Array<{ id: string; tableName: string }>;
  } | null = null;
  private options: Required<ReconnectionOptions>;
  private _state: ConnectionState = 'disconnected';
  private attemptNumber = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManualDisconnect = false;
  private isReconnecting = false;
  private subscriptionSnapshots: SubscriptionMetadata[] = [];

  // Metrics
  private metrics: ReconnectionMetrics = {
    attemptCount: 0,
    successfulReconnects: 0,
    failedReconnects: 0,
    avgReconnectTime: 0,
    lastReconnectDuration: 0,
    lastReconnectTimestamp: null,
  };
  private reconnectStartTime: number | null = null;
  private totalReconnectTime = 0;

  constructor(
    connection: {
      connect(): Promise<void>;
      on(event: string, listener: (event: unknown) => void): void;
      subscriptions?: Map<string, Record<string, unknown>>;
    },
    options?: ReconnectionOptions,
    subscriptionManager?: {
      subscribe(tableName: string, query: Record<string, unknown>): Promise<unknown>;
      getActiveSubscriptions(): Array<{ id: string; tableName: string }>;
    }
  ) {
    super();
    this.connection = connection;
    this.subscriptionManager = subscriptionManager || null;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Listen to connection events
    this.setupConnectionListeners();
  }

  /**
   * Get current connection state
   */
  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Get reconnection metrics
   */
  getMetrics(): ReconnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get reconnection metrics (alias for getMetrics)
   * @deprecated Use getMetrics() instead
   */
  getReconnectionMetrics(): ReconnectionMetrics {
    return this.getMetrics();
  }

  /**
   * Setup connection event listeners
   */
  private setupConnectionListeners(): void {
    // Listen for disconnect events
    this.connection.on('connectionChange', (event: unknown) => {
      // Validate event structure
      if (!event || typeof event !== 'object') {
        return;
      }

      const typedEvent = event as { state?: string; error?: Error };

      if (
        typedEvent.state === 'disconnected' &&
        !this.isManualDisconnect &&
        this.options.autoReconnect
      ) {
        this.handleUnexpectedDisconnect(typedEvent.error);
      }
    });
  }

  /**
   * Handle unexpected disconnection
   */
  private handleUnexpectedDisconnect(error?: Error): void {
    // Store subscription state for recovery
    this.captureSubscriptionState();

    // Emit disconnected event
    const reason = error?.message || 'Connection lost';
    this._state = 'disconnected';
    this.emit('connectionChange', {
      status: 'disconnected',
      reason,
    } as ConnectionChangeEvent);

    // Start reconnection immediately (backoff is handled in reconnect loop)
    if (this.options.autoReconnect && !this.isReconnecting) {
      setTimeout(() => {
        this.startReconnection();
      }, RECONNECTION_START_DELAY_MS);
    }
  }

  /**
   * Capture current subscription state for recovery
   */
  private captureSubscriptionState(): void {
    // Capture subscriptions from SubscriptionManager if available
    this.subscriptionSnapshots = [];
    if (this.subscriptionManager) {
      const activeSubscriptions = this.subscriptionManager.getActiveSubscriptions();
      // Store the subscription metadata for later recovery
      // We capture tableName and query for each subscription
      const uniqueTables = new Set<string>();
      for (const sub of activeSubscriptions) {
        if (!uniqueTables.has(sub.tableName)) {
          uniqueTables.add(sub.tableName);
          this.subscriptionSnapshots.push({
            id: sub.id,
            tableName: sub.tableName,
            // Use query from subscription handle, default to empty object if not available
            query: (sub as unknown as { query?: Record<string, unknown> }).query || {},
          });
        }
      }
    }
  }

  /**
   * Start reconnection process
   */
  private async startReconnection(): Promise<void> {
    if (this.isReconnecting) {
      return; // Already reconnecting
    }

    this.isReconnecting = true;
    this.attemptNumber = 0;
    this.reconnectStartTime = Date.now();

    await this.reconnect();
  }

  /**
   * Reconnection loop with exponential backoff
   */
  private async reconnect(): Promise<void> {
    while (this.isReconnecting) {
      this.attemptNumber++;
      this.metrics.attemptCount = this.attemptNumber;

      // Check retry limit
      if (
        this.options.maxReconnectAttempts > 0 &&
        this.attemptNumber > this.options.maxReconnectAttempts
      ) {
        this.handleReconnectFailure(
          new Error(`Failed to reconnect after ${this.attemptNumber - 1} attempts`)
        );
        return;
      }

      // Calculate backoff delay
      const delay = this.calculateBackoffDelay(this.attemptNumber - 1);

      // Emit reconnecting event
      this._state = 'reconnecting';
      this.emit('connectionChange', {
        status: 'reconnecting',
        attemptNumber: this.attemptNumber,
        nextAttemptDelay: delay,
      } as ConnectionChangeEvent);

      // Wait for backoff delay (except first attempt)
      if (this.attemptNumber > 1) {
        await this.sleep(delay);
      }

      // Check if still reconnecting after sleep (could have been cancelled)
      if (!this.isReconnecting) {
        return;
      }

      // Attempt reconnection
      try {
        await Promise.race([
          this.connection.connect(),
          this.timeout(10000), // 10 second timeout per attempt
        ]);

        // Success - handle reconnection success
        await this.handleReconnectSuccess();
        return;
      } catch (error) {
        // Emit error event instead of console.error
        this.emit('reconnectionError', {
          attemptNumber: this.attemptNumber,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  }

  /**
   * Handle successful reconnection
   * Ensures idempotency to prevent duplicate calls
   */
  private async handleReconnectSuccess(): Promise<void> {
    // Guard against duplicate calls
    if (!this.isReconnecting) {
      return;
    }

    this.isReconnecting = false;

    // Clear any pending reconnection timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Emit connected event
    this._state = 'connected';
    this.emit('connectionChange', {
      status: 'connected',
    } as ConnectionChangeEvent);

    // Recover subscriptions
    await this.recoverSubscriptions();

    // Update metrics
    const duration = this.reconnectStartTime ? Date.now() - this.reconnectStartTime : 0;
    this.metrics.successfulReconnects++;
    this.metrics.lastReconnectDuration = duration;
    this.metrics.lastReconnectTimestamp = new Date();
    this.totalReconnectTime += duration;
    this.metrics.avgReconnectTime = this.totalReconnectTime / this.metrics.successfulReconnects;

    // Emit NFR23 violation as event instead of console.warn
    if (duration > 10000) {
      this.emit('nfr23Violation', {
        duration,
        threshold: 10000,
        message: `Reconnection took ${duration}ms, exceeding NFR23 requirement of 10s`,
      });
    }

    // Reset attempt counter and clear old subscription snapshots
    this.attemptNumber = 0;
    this.reconnectStartTime = null;
    this.subscriptionSnapshots = [];
  }

  /**
   * Handle reconnection failure
   */
  private handleReconnectFailure(error: Error): void {
    this.isReconnecting = false;

    // Clear any pending reconnection timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Update metrics
    this.metrics.failedReconnects++;

    // Emit failed event
    this._state = 'failed';
    this.emit('connectionChange', {
      status: 'failed',
      reason: error.message,
      error,
    } as ConnectionChangeEvent);

    // Reset state
    this.attemptNumber = 0;
    this.reconnectStartTime = null;
  }

  /**
   * Recover subscriptions after reconnection
   * Includes timeout to prevent hanging (NFR23 compliance)
   *
   * Implements actual re-subscription using SubscriptionManager.
   * Subscriptions are restored in parallel for performance (NFR23).
   */
  private async recoverSubscriptions(): Promise<void> {
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    // Early exit if no subscriptions or no subscription manager
    if (this.subscriptionSnapshots.length === 0 || !this.subscriptionManager) {
      this.emit('subscriptionsRecovered', {
        totalSubscriptions: 0,
        successfulSubscriptions: 0,
        failedSubscriptions: 0,
        recoveryTimeMs: 0,
      } as SubscriptionsRecoveredEvent);
      return;
    }

    try {
      // Add timeout for subscription recovery
      await Promise.race([
        (async () => {
          // Restore subscriptions in parallel for performance (NFR23)
          const subscribePromises = this.subscriptionSnapshots.map(async (sub) => {
            try {
              // Actually re-subscribe using SubscriptionManager
              await this.subscriptionManager!.subscribe(sub.tableName, sub.query);
              successCount++;
              // Emit subscriptionRestore event for each successful subscription
              this.emit('subscriptionRestore', sub);
            } catch (error) {
              failCount++;
              // Emit error event instead of console.error
              this.emit('subscriptionRestoreError', {
                tableName: sub.tableName,
                error: error instanceof Error ? error : new Error(String(error)),
              });
            }
          });

          // Wait for all subscriptions to complete
          await Promise.all(subscribePromises);
        })(),
        new Promise<void>((_, reject) => {
          setTimeout(
            () => reject(new Error('Subscription recovery timeout')),
            SUBSCRIPTION_RECOVERY_TIMEOUT_MS
          );
        }),
      ]);
    } catch {
      // Recovery timed out - emit event
      this.emit('subscriptionRecoveryTimeout', {
        duration: Date.now() - startTime,
        timeout: SUBSCRIPTION_RECOVERY_TIMEOUT_MS,
      });
    }

    const recoveryTime = Date.now() - startTime;

    // Emit subscriptions recovered event
    this.emit('subscriptionsRecovered', {
      totalSubscriptions: this.subscriptionSnapshots.length,
      successfulSubscriptions: successCount,
      failedSubscriptions: failCount,
      recoveryTimeMs: recoveryTime,
    } as SubscriptionsRecoveredEvent);
  }

  /**
   * Calculate exponential backoff delay with jitter
   * Exposed for testing
   */
  calculateBackoffDelay(attemptNumber: number): number {
    // Exponential formula: delay = min(initialDelay * (2 ^ attemptNumber), maxDelay)
    const exponentialDelay = Math.min(
      this.options.initialDelay * Math.pow(2, attemptNumber),
      this.options.maxDelay
    );

    // Add jitter: ±jitterPercent randomization
    const jitterFactor = 1 + (Math.random() * 2 - 1) * (this.options.jitterPercent / 100);
    const delayWithJitter = Math.floor(exponentialDelay * jitterFactor);

    return delayWithJitter;
  }

  /**
   * Mark as manual disconnect (skip auto-reconnection)
   * Cancels any ongoing reconnection attempts
   */
  markManualDisconnect(): void {
    this.isManualDisconnect = true;
    this.cancelReconnection();
  }

  /**
   * Set manual disconnect flag
   * @param value - Whether this is a manual disconnect
   * @deprecated Use markManualDisconnect() instead
   */
  setManualDisconnect(value: boolean): void {
    this.isManualDisconnect = value;
    if (value) {
      this.cancelReconnection();
    }
  }

  /**
   * Cancel ongoing reconnection
   */
  cancelReconnection(): void {
    this.isReconnecting = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.attemptNumber = 0;
    this.reconnectStartTime = null;
  }

  /**
   * Retry connection after failure
   */
  async retryConnection(): Promise<void> {
    // Reset manual disconnect flag
    this.isManualDisconnect = false;

    // Reset metrics
    this.attemptNumber = 0;

    // Start reconnection
    await this.startReconnection();
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.reconnectTimer = setTimeout(resolve, ms);
    });
  }

  /**
   * Timeout utility
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Connection timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.cancelReconnection();
    this.removeAllListeners();
  }
}
