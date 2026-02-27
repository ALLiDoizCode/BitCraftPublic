/**
 * TypeScript interfaces for reconnection events and state
 * Story 1.6: Auto-Reconnection & State Recovery (Task 7)
 */

/**
 * Connection state for reconnection manager
 */
export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'failed';

/**
 * Connection change event emitted during state transitions
 */
export interface ConnectionChangeEvent {
  /** Current connection state */
  status: ConnectionState;
  /** Disconnect or failure reason */
  reason?: string;
  /** Current attempt number (for reconnecting status) */
  attemptNumber?: number;
  /** Next attempt delay in milliseconds (for reconnecting status) */
  nextAttemptDelay?: number;
  /** Error details (for failed status) */
  error?: Error;
}

/**
 * Subscriptions recovered event emitted after successful reconnection
 */
export interface SubscriptionsRecoveredEvent {
  /** Total number of subscriptions to recover */
  totalSubscriptions: number;
  /** Number of successfully recovered subscriptions */
  successfulSubscriptions: number;
  /** Number of failed subscriptions */
  failedSubscriptions: number;
  /** Total recovery time in milliseconds */
  recoveryTimeMs: number;
}

/**
 * Reconnection metrics for monitoring
 */
export interface ReconnectionMetrics {
  /** Current or last attempt number */
  attemptCount: number;
  /** Lifetime successful reconnections */
  successfulReconnects: number;
  /** Lifetime failed reconnections */
  failedReconnects: number;
  /** Average time for successful reconnections (ms) */
  avgReconnectTime: number;
  /** Duration of last reconnection (ms) */
  lastReconnectDuration: number;
  /** When last reconnection completed */
  lastReconnectTimestamp: Date | null;
}

/**
 * Reconnection configuration options
 */
export interface ReconnectionOptions {
  /** Enable/disable auto-reconnection (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 10, 0 = infinite) */
  maxReconnectAttempts?: number;
  /** Initial delay before first retry in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Jitter percentage for randomization (default: 10) */
  jitterPercent?: number;
}

/**
 * Internal subscription metadata for recovery
 * @internal
 */
export interface SubscriptionMetadata {
  /** Subscription ID */
  id: string;
  /** Table name */
  tableName: string;
  /** Query filter */
  query: Record<string, unknown>;
}

/**
 * Reconnection error event emitted when a reconnection attempt fails
 */
export interface ReconnectionErrorEvent {
  /** Attempt number that failed */
  attemptNumber: number;
  /** Error that occurred */
  error: Error;
}

/**
 * Subscription restore error event emitted when a subscription fails to restore
 */
export interface SubscriptionRestoreErrorEvent {
  /** Table name that failed to restore */
  tableName: string;
  /** Error that occurred */
  error: Error;
}

/**
 * Subscription recovery timeout event emitted when recovery takes too long
 */
export interface SubscriptionRecoveryTimeoutEvent {
  /** Time spent attempting recovery (ms) */
  duration: number;
  /** Configured timeout threshold (ms) */
  timeout: number;
}

/**
 * NFR23 violation event emitted when reconnection exceeds 10 seconds
 */
export interface NFR23ViolationEvent {
  /** Actual reconnection duration (ms) */
  duration: number;
  /** NFR23 threshold (10000ms) */
  threshold: number;
  /** Violation message */
  message: string;
}
