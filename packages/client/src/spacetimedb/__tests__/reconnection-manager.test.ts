/**
 * Unit tests for ReconnectionManager
 * Story 1.6: Auto-Reconnection & State Recovery
 *
 * RED PHASE: These tests are intentionally failing to drive implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ReconnectionManager } from '../reconnection-manager';
import {
  ConnectionState,
  ConnectionChangeEvent,
  SubscriptionsRecoveredEvent,
} from '../reconnection-types';

describe('ReconnectionManager - Unit Tests', () => {
  let mockConnection: any;
  let manager: ReconnectionManager;

  beforeEach(() => {
    // Mock SpacetimeDB connection with real EventEmitter
    const emitter = new EventEmitter();
    mockConnection = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      close: vi.fn(),
      emit: emitter.emit.bind(emitter),
      on: emitter.on.bind(emitter),
      off: emitter.off.bind(emitter),
      subscriptions: new Map(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AC1: Connection loss detection and reconnection initiation', () => {
    it('should detect unexpected connection loss and emit disconnected event', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        maxReconnectAttempts: 10,
      });

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      // Simulate unexpected disconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].status).toBe('disconnected');
      expect(events[0].reason).toContain('Network error');
    });

    it('should include disconnect reason in event payload', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      // Simulate disconnect with specific reason
      const testError = new Error('Connection timeout');
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: testError,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const disconnectEvent = events.find((e) => e.status === 'disconnected');
      expect(disconnectEvent).toBeDefined();
      expect(disconnectEvent?.reason).toBe('Connection timeout');
    });

    it('should NOT trigger reconnection on manual disconnect', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      // Manual disconnect
      manager.setManualDisconnect(true);
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('User disconnected'),
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Should only have disconnected event, no reconnecting events
      const reconnectingEvents = events.filter((e) => e.status === 'reconnecting');
      expect(reconnectingEvents.length).toBe(0);
    });

    it('should start reconnection within 1 second of disconnect', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        initialDelay: 500,
      });

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      const startTime = Date.now();
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      // Wait for first reconnection attempt
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const reconnectingEvent = events.find((e) => e.status === 'reconnecting');
      expect(reconnectingEvent).toBeDefined();

      const timeDiff = Date.now() - startTime;
      expect(timeDiff).toBeGreaterThanOrEqual(1000); // Should wait ~1 second before first attempt
      expect(timeDiff).toBeLessThan(1500); // But not too long
    });
  });

  describe('AC2: Exponential backoff with cap', () => {
    it('should calculate exponential backoff correctly (1s, 2s, 4s, 8s, 16s, 30s)', () => {
      manager = new ReconnectionManager(mockConnection, {
        initialDelay: 1000,
        maxDelay: 30000,
      });

      const delays = [
        manager.calculateBackoffDelay(0),
        manager.calculateBackoffDelay(1),
        manager.calculateBackoffDelay(2),
        manager.calculateBackoffDelay(3),
        manager.calculateBackoffDelay(4),
        manager.calculateBackoffDelay(5),
        manager.calculateBackoffDelay(6),
      ];

      // Should be approximately: 1s, 2s, 4s, 8s, 16s, 30s (capped), 30s (capped)
      // With ±10% jitter, values can range quite a bit
      expect(delays[0]).toBeGreaterThanOrEqual(900);
      expect(delays[0]).toBeLessThanOrEqual(1100);
      expect(delays[1]).toBeGreaterThanOrEqual(1800);
      expect(delays[1]).toBeLessThanOrEqual(2200);
      expect(delays[2]).toBeGreaterThanOrEqual(3600);
      expect(delays[2]).toBeLessThanOrEqual(4400);
      expect(delays[3]).toBeGreaterThanOrEqual(7200);
      expect(delays[3]).toBeLessThanOrEqual(8800);
      expect(delays[4]).toBeGreaterThanOrEqual(14400);
      expect(delays[4]).toBeLessThanOrEqual(17600);
      expect(delays[5]).toBeGreaterThanOrEqual(27000); // Capped at 30s ± 10%
      expect(delays[5]).toBeLessThanOrEqual(33000);
      expect(delays[6]).toBeGreaterThanOrEqual(27000); // Capped
      expect(delays[6]).toBeLessThanOrEqual(33000);
    });

    it('should apply jitter (±10%) to backoff delays', () => {
      manager = new ReconnectionManager(mockConnection, {
        initialDelay: 1000,
        jitterPercent: 10,
      });

      // Generate 100 delays and verify they vary
      const delays = Array.from({ length: 100 }, () => manager.calculateBackoffDelay(0));

      // All should be within 900-1100ms range (1000 ± 10%)
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(900);
        expect(delay).toBeLessThanOrEqual(1100);
      });

      // Verify actual variance (should not all be the same)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(10); // Should have variety
    });

    it('should cap backoff delay at 30 seconds (NFR10)', () => {
      manager = new ReconnectionManager(mockConnection, {
        initialDelay: 1000,
        maxDelay: 30000,
      });

      // Attempt 100 should still cap at 30s
      const delay = manager.calculateBackoffDelay(100);
      expect(delay).toBeLessThanOrEqual(30000 * 1.1); // Account for jitter
    });

    it('should emit reconnecting status before each attempt with attempt number', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        maxReconnectAttempts: 3,
        initialDelay: 100, // Fast for testing
      });

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      // Simulate disconnect and reconnection failures
      mockConnection.connect.mockRejectedValue(new Error('Connection refused'));
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      // Wait for all attempts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const reconnectingEvents = events.filter((e) => e.status === 'reconnecting');
      expect(reconnectingEvents.length).toBeGreaterThanOrEqual(3);

      // Verify attempt numbers
      expect(reconnectingEvents[0].attemptNumber).toBe(1);
      expect(reconnectingEvents[1].attemptNumber).toBe(2);
      expect(reconnectingEvents[2].attemptNumber).toBe(3);
    });
  });

  describe('AC3: Successful reconnection and subscription recovery', () => {
    it('should successfully reconnect and emit connected status', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        initialDelay: 100,
      });

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      // Simulate disconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      // Simulate successful reconnection
      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const connectedEvent = events.find((e) => e.status === 'connected');
      expect(connectedEvent).toBeDefined();
    });

    it('should restore all subscriptions with original filters after reconnection', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      // Setup subscriptions before disconnect
      const subscriptions = [
        { tableName: 'player', filters: { id: 1 } },
        { tableName: 'inventory', filters: { playerId: 1 } },
      ];

      subscriptions.forEach((sub) => {
        mockConnection.subscriptions.set(sub.tableName, sub.filters);
      });

      // Track subscription restorations
      const restoreSubscription = vi.fn();
      manager.on('subscriptionRestore', restoreSubscription);

      // Simulate disconnect and reconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify all subscriptions were restored
      expect(restoreSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'player', query: { id: 1 } })
      );
      expect(restoreSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'inventory', query: { playerId: 1 } })
      );
    });

    it('should emit subscriptionsRecovered event with metadata', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      const events: SubscriptionsRecoveredEvent[] = [];
      manager.on('subscriptionsRecovered', (event: SubscriptionsRecoveredEvent) => {
        events.push(event);
      });

      // Setup subscriptions
      mockConnection.subscriptions.set('player', {});
      mockConnection.subscriptions.set('inventory', {});

      // Simulate disconnect and reconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 300));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].totalSubscriptions).toBe(2);
      expect(events[0].successfulSubscriptions).toBe(2);
      expect(events[0].failedSubscriptions).toBe(0);
      expect(events[0].recoveryTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should emit subscriptionsRecovered with correct timing', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        initialDelay: 100,
      });

      const events: SubscriptionsRecoveredEvent[] = [];
      manager.on('subscriptionsRecovered', (event: SubscriptionsRecoveredEvent) => {
        events.push(event);
      });

      // Setup multiple subscriptions
      mockConnection.subscriptions.set('player', {});
      mockConnection.subscriptions.set('inventory', {});
      mockConnection.subscriptions.set('item_desc', {});

      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].totalSubscriptions).toBe(3);
      expect(events[0].recoveryTimeMs).toBeGreaterThanOrEqual(0);
      expect(events[0].recoveryTimeMs).toBeLessThan(1000); // Should be fast in tests
    });

    it('should complete reconnection + subscription recovery within 10 seconds (NFR23)', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      // Setup multiple subscriptions
      for (let i = 0; i < 10; i++) {
        mockConnection.subscriptions.set(`table${i}`, {});
      }

      const startTime = Date.now();
      let endTime = 0;

      manager.on('subscriptionsRecovered', () => {
        endTime = Date.now();
      });

      // Simulate disconnect and reconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // NFR23: < 10 seconds
    }, 15000);
  });

  describe('AC4: State snapshot recovery', () => {
    it('should capture subscription metadata before disconnect', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      // Setup subscriptions
      mockConnection.subscriptions.set('player', { id: 1 });
      mockConnection.subscriptions.set('inventory', { playerId: 1 });

      const subscriptionRestores: any[] = [];
      manager.on('subscriptionRestore', (sub: any) => {
        subscriptionRestores.push(sub);
      });

      // Simulate disconnect and reconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify subscriptions were captured with metadata
      expect(subscriptionRestores.length).toBe(2);
      expect(subscriptionRestores[0].tableName).toBe('player');
      expect(subscriptionRestores[0].query).toEqual({ id: 1 });
      expect(subscriptionRestores[1].tableName).toBe('inventory');
      expect(subscriptionRestores[1].query).toEqual({ playerId: 1 });
    });

    it('should emit subscriptionRestore events during recovery', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      // Setup subscriptions before disconnect
      mockConnection.subscriptions.set('player', {});
      mockConnection.subscriptions.set('inventory', {});
      mockConnection.subscriptions.set('item_desc', {});

      const restoreEvents: any[] = [];
      manager.on('subscriptionRestore', (event: any) => {
        restoreEvents.push(event);
      });

      // Disconnect and reconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify all subscriptions were restored
      expect(restoreEvents.length).toBe(3);
      expect(restoreEvents.map((e) => e.tableName)).toContain('player');
      expect(restoreEvents.map((e) => e.tableName)).toContain('inventory');
      expect(restoreEvents.map((e) => e.tableName)).toContain('item_desc');
    });

    it('should preserve static data cache across reconnection', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      let staticDataReloadCount = 0;
      manager.on('staticDataLoad', () => {
        staticDataReloadCount++;
      });

      // Simulate disconnect and reconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Static data should NOT reload
      expect(staticDataReloadCount).toBe(0);
    });
  });

  describe('AC5: Reconnection failure handling', () => {
    it('should stop reconnection after retry limit exhausted', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        maxReconnectAttempts: 3,
        initialDelay: 100,
      });

      mockConnection.connect.mockRejectedValue(new Error('Connection refused'));

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      // Simulate disconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      // Wait for all attempts
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const reconnectingEvents = events.filter((e) => e.status === 'reconnecting');
      expect(reconnectingEvents.length).toBeLessThanOrEqual(3);

      const failedEvent = events.find((e) => e.status === 'failed');
      expect(failedEvent).toBeDefined();
    }, 5000);

    it('should emit failed status with comprehensive error details', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        maxReconnectAttempts: 2,
        initialDelay: 100,
      });

      mockConnection.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const failedEvent = events.find((e) => e.status === 'failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.reason).toContain('Failed to reconnect after 2 attempts');
      expect(failedEvent?.error).toBeDefined();
      // The error from handleReconnectFailure is the wrapper error, not the connection error
      expect(failedEvent?.reason).toContain('Failed to reconnect');
    }, 5000);

    it('should include total attempts in error details', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        maxReconnectAttempts: 3,
        initialDelay: 100,
      });

      mockConnection.connect.mockRejectedValue(new Error('Connection failed'));

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const failedEvent = events.find((e) => e.status === 'failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.reason).toMatch(/Failed to reconnect after \d+ attempts/);

      // Extract attempt count from error message
      const match = failedEvent?.reason?.match(/after (\d+) attempts/);
      expect(match).toBeDefined();
      expect(parseInt(match![1])).toBe(3);
    }, 5000);

    it('should allow manual retry via retryConnection() after failure', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        maxReconnectAttempts: 1,
        initialDelay: 100,
      });

      mockConnection.connect.mockRejectedValueOnce(new Error('Connection refused'));

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      // Simulate disconnect and failure
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const failedEvent = events.find((e) => e.status === 'failed');
      expect(failedEvent).toBeDefined();

      // Now allow connection to succeed
      mockConnection.connect.mockResolvedValue(undefined);

      // Manual retry
      await manager.retryConnection();

      await new Promise((resolve) => setTimeout(resolve, 300));

      const connectedEvent = events.find((e) => e.status === 'connected');
      expect(connectedEvent).toBeDefined();
    }, 5000);

    it('should reset attempt counter on manual retry', async () => {
      manager = new ReconnectionManager(mockConnection, {
        maxReconnectAttempts: 2,
        initialDelay: 100,
      });

      mockConnection.connect.mockRejectedValue(new Error('Connection refused'));

      // Fail first attempt cycle
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Manual retry should reset counter
      mockConnection.connect.mockResolvedValue(undefined);
      await manager.retryConnection();

      const metrics = manager.getReconnectionMetrics();
      expect(metrics?.attemptCount).toBeLessThanOrEqual(2); // Should have reset
    }, 5000);
  });

  describe('Additional Coverage: Edge Cases and Metrics', () => {
    it('should cancel reconnection and clean up timers via cancelReconnection()', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        maxReconnectAttempts: 10,
        initialDelay: 100,
      });

      mockConnection.connect.mockRejectedValue(new Error('Connection refused'));

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      // Start reconnection
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      // Wait for first reconnection attempt
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Cancel reconnection
      manager.cancelReconnection();

      // Wait to ensure no more attempts
      const eventCountBeforeWait = events.filter((e) => e.status === 'reconnecting').length;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const eventCountAfterWait = events.filter((e) => e.status === 'reconnecting').length;

      // No new reconnection attempts should have occurred
      expect(eventCountAfterWait).toBe(eventCountBeforeWait);

      // Verify cleanup
      expect((manager as any).isReconnecting).toBe(false);
      expect((manager as any).reconnectTimer).toBeNull();
    });

    it('should track reconnection metrics correctly', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        initialDelay: 100,
      });

      // Simulate successful reconnection
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = manager.getReconnectionMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.successfulReconnects).toBe(1);
      expect(metrics.failedReconnects).toBe(0);
      expect(metrics.lastReconnectDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.lastReconnectTimestamp).toBeInstanceOf(Date);
    });

    it('should handle multiple successive reconnections', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        initialDelay: 100,
      });

      // First disconnect and reconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error 1'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second disconnect and reconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error 2'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      const metrics = manager.getReconnectionMetrics();
      expect(metrics.successfulReconnects).toBe(2);
      expect(metrics.avgReconnectTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero subscriptions gracefully', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      const events: SubscriptionsRecoveredEvent[] = [];
      manager.on('subscriptionsRecovered', (event: SubscriptionsRecoveredEvent) => {
        events.push(event);
      });

      // Disconnect and reconnect with no subscriptions
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].totalSubscriptions).toBe(0);
      expect(events[0].successfulSubscriptions).toBe(0);
      expect(events[0].failedSubscriptions).toBe(0);
    });

    it('should emit warning when reconnection exceeds 10 seconds (NFR23)', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: false, // Manual control
        initialDelay: 100,
      });

      const nfr23Events: any[] = [];
      manager.on('nfr23Violation', (event: any) => {
        nfr23Events.push(event);
      });

      // Manually set state and start reconnection timer
      (manager as any)._state = 'reconnecting';
      (manager as any).isReconnecting = true;
      (manager as any).reconnectStartTime = Date.now() - 11000;

      // Trigger successful reconnection manually
      await (manager as any).handleReconnectSuccess();

      expect(nfr23Events.length).toBeGreaterThan(0);
      expect(nfr23Events[0].duration).toBeGreaterThanOrEqual(11000);
      expect(nfr23Events[0].threshold).toBe(10000);
      expect(nfr23Events[0].message).toContain('exceeding NFR23 requirement');
    });

    it('should prevent concurrent reconnection attempts', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        initialDelay: 200,
      });

      let connectCallCount = 0;
      mockConnection.connect.mockImplementation(async () => {
        connectCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      // Trigger first disconnect
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error 1'),
      });

      // Wait for reconnection to start
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Check that reconnection has started
      const isReconnectingAfterFirst = (manager as any).isReconnecting;
      expect(isReconnectingAfterFirst).toBe(true);

      // Trigger second disconnect while still reconnecting
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error 2'),
      });

      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify only one reconnection cycle was started
      // (The second disconnect should be ignored because isReconnecting is true)
      expect(connectCallCount).toBeLessThanOrEqual(2); // At most 2 attempts from single cycle
    });

    it('should dispose and clean up resources', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      // Start a reconnection
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Dispose
      manager.dispose();

      // Verify cleanup
      expect((manager as any).isReconnecting).toBe(false);
      expect((manager as any).reconnectTimer).toBeNull();
      expect(manager.listenerCount('connectionChange')).toBe(0);
    });

    it('should handle connection timeout during reconnection attempt', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        maxReconnectAttempts: 2,
        initialDelay: 100,
      });

      // Mock connection that times out
      mockConnection.connect.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 15000))
      );

      const events: ConnectionChangeEvent[] = [];
      manager.on('connectionChange', (event: ConnectionChangeEvent) => {
        events.push(event);
      });

      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      // Wait for timeout and retry
      await new Promise((resolve) => setTimeout(resolve, 12000));

      const reconnectingEvents = events.filter((e) => e.status === 'reconnecting');
      expect(reconnectingEvents.length).toBeGreaterThanOrEqual(1);
    }, 15000);

    it('should accept custom configuration options', () => {
      // Test with custom values
      const manager1 = new ReconnectionManager(mockConnection, {
        initialDelay: 500,
        maxDelay: 60000,
        maxReconnectAttempts: 5,
        jitterPercent: 20,
      });

      const delay = manager1.calculateBackoffDelay(0);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThan(1000); // 500ms ± 20% jitter

      // Test with zero max attempts (infinite retries)
      const manager2 = new ReconnectionManager(mockConnection, {
        maxReconnectAttempts: 0,
      });

      expect(manager2).toBeDefined();
      expect(manager2.state).toBe('disconnected');
      // This configuration is valid - 0 means infinite retries
    });

    it('should handle missing event handlers gracefully', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
      });

      // Don't attach any event handlers - should not crash

      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Network error'),
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      mockConnection.connect.mockResolvedValue(undefined);
      mockConnection.emit('connectionChange', { state: 'connected' });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should complete without errors
      expect(manager.state).toBe('connected');
    });

    it('should handle rapid state changes without race conditions', async () => {
      manager = new ReconnectionManager(mockConnection, {
        autoReconnect: true,
        initialDelay: 100,
      });

      // Emit multiple state changes rapidly
      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Error 1'),
      });

      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Error 2'),
      });

      mockConnection.emit('connectionChange', { state: 'connected' });

      mockConnection.emit('connectionChange', {
        state: 'disconnected',
        error: new Error('Error 3'),
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should handle rapid changes without crashing
      const state = manager.state;
      expect(['disconnected', 'reconnecting', 'connected']).toContain(state);
    });
  });
});
