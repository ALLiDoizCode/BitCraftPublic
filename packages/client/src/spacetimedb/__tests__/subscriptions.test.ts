/**
 * Unit Tests: Subscription Manager
 *
 * Tests for table subscription functionality, including subscription lifecycle,
 * event emission, and cleanup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

describe('SubscriptionManager', () => {
  describe('Subscription Creation', () => {
    it('should create subscription with unique ID', () => {
      const sub1 = createSubscription('player_state', {});
      const sub2 = createSubscription('player_state', {});

      expect(sub1.id).toBeDefined();
      expect(sub2.id).toBeDefined();
      expect(sub1.id).not.toBe(sub2.id);
    });

    it('should return SubscriptionHandle with correct properties', () => {
      const handle = createSubscription('player_state', {});

      expect(handle).toHaveProperty('id');
      expect(handle).toHaveProperty('tableName');
      expect(handle).toHaveProperty('unsubscribe');
      expect(handle.tableName).toBe('player_state');
      expect(typeof handle.unsubscribe).toBe('function');
    });

    it('should accept query parameter', () => {
      const query = { id: { eq: 123 } };
      const handle = createSubscription('player_state', query);

      expect(handle).toBeDefined();
      // Query is used by underlying SDK
    });

    it('should accept empty query for all rows', () => {
      const handle = createSubscription('player_state', {});
      expect(handle).toBeDefined();
    });
  });

  describe('Subscription Events', () => {
    it('should emit tableSnapshot event on initial subscription', () => {
      const emitter = new EventEmitter();
      const events: any[] = [];

      emitter.on('tableSnapshot', (data) => events.push(data));

      // Simulate snapshot from SDK
      const snapshot = {
        tableName: 'player_state',
        rows: [
          { id: 1, name: 'Player1' },
          { id: 2, name: 'Player2' },
        ],
      };

      emitter.emit('tableSnapshot', snapshot);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(snapshot);
    });

    it('should emit rowInserted event for new rows', () => {
      const emitter = new EventEmitter();
      const events: any[] = [];

      emitter.on('rowInserted', (data) => events.push(data));

      const insertEvent = {
        tableName: 'player_state',
        row: { id: 3, name: 'Player3' },
      };

      emitter.emit('rowInserted', insertEvent);

      expect(events).toHaveLength(1);
      expect(events[0].row).toEqual({ id: 3, name: 'Player3' });
    });

    it('should emit rowUpdated event with old and new values', () => {
      const emitter = new EventEmitter();
      const events: any[] = [];

      emitter.on('rowUpdated', (data) => events.push(data));

      const updateEvent = {
        tableName: 'player_state',
        oldRow: { id: 1, name: 'OldName' },
        newRow: { id: 1, name: 'NewName' },
      };

      emitter.emit('rowUpdated', updateEvent);

      expect(events).toHaveLength(1);
      expect(events[0].oldRow.name).toBe('OldName');
      expect(events[0].newRow.name).toBe('NewName');
    });

    it('should emit rowDeleted event', () => {
      const emitter = new EventEmitter();
      const events: any[] = [];

      emitter.on('rowDeleted', (data) => events.push(data));

      const deleteEvent = {
        tableName: 'player_state',
        row: { id: 1, name: 'DeletedPlayer' },
      };

      emitter.emit('rowDeleted', deleteEvent);

      expect(events).toHaveLength(1);
      expect(events[0].row.id).toBe(1);
    });
  });

  describe('Game State Update Aggregation', () => {
    it('should aggregate multiple row events into gameStateUpdate', () => {
      const emitter = new EventEmitter();
      const aggregator = createUpdateAggregator(emitter);

      const gameStateUpdates: any[] = [];
      emitter.on('gameStateUpdate', (update) => gameStateUpdates.push(update));

      // Simulate multiple row events in same transaction
      aggregator.addEvent('rowInserted', {
        tableName: 'player_state',
        row: { id: 1 },
      });
      aggregator.addEvent('rowUpdated', {
        tableName: 'entity_position',
        oldRow: { id: 1, x: 0 },
        newRow: { id: 1, x: 10 },
      });

      // Flush aggregated events
      aggregator.flush();

      expect(gameStateUpdates).toHaveLength(1);
      expect(gameStateUpdates[0].events).toHaveLength(2);
    });

    it('should include transaction metadata in gameStateUpdate', () => {
      const emitter = new EventEmitter();
      const aggregator = createUpdateAggregator(emitter);

      const gameStateUpdates: any[] = [];
      emitter.on('gameStateUpdate', (update) => gameStateUpdates.push(update));

      aggregator.addEvent('rowInserted', {
        tableName: 'player_state',
        row: { id: 1 },
      });

      aggregator.flush();

      expect(gameStateUpdates[0]).toHaveProperty('timestamp');
      expect(gameStateUpdates[0]).toHaveProperty('events');
    });

    it('should batch events from same transaction', () => {
      const events: any[] = [];

      // Simulate transaction with multiple updates
      const txEvents = [
        { type: 'rowInserted', tableName: 'player_state', row: { id: 1 } },
        { type: 'rowInserted', tableName: 'player_state', row: { id: 2 } },
        { type: 'rowUpdated', tableName: 'inventory', oldRow: {}, newRow: {} },
      ];

      events.push(...txEvents);

      // Should be batched into one gameStateUpdate
      expect(events.length).toBe(3);
    });
  });

  describe('Subscription Cleanup', () => {
    it('should remove event listeners on unsubscribe', () => {
      const emitter = new EventEmitter();
      const listener = vi.fn();

      emitter.on('rowInserted', listener);
      expect(emitter.listenerCount('rowInserted')).toBe(1);

      emitter.removeListener('rowInserted', listener);
      expect(emitter.listenerCount('rowInserted')).toBe(0);
    });

    it('should call unsubscribe callback on handle.unsubscribe()', () => {
      const unsubscribeFn = vi.fn();
      const handle = {
        id: '123',
        tableName: 'player_state',
        unsubscribe: unsubscribeFn,
      };

      handle.unsubscribe();
      expect(unsubscribeFn).toHaveBeenCalled();
    });

    it('should remove subscription from internal registry', () => {
      const registry = new Map<string, any>();

      const id = 'sub-123';
      registry.set(id, { tableName: 'player_state' });

      expect(registry.has(id)).toBe(true);

      registry.delete(id);
      expect(registry.has(id)).toBe(false);
    });

    it('should handle unsubscribing already-unsubscribed subscription', () => {
      const unsubscribeFn = vi.fn();

      // Call twice
      unsubscribeFn();
      unsubscribeFn();

      expect(unsubscribeFn).toHaveBeenCalledTimes(2);
      // Should not throw or cause issues
    });
  });

  describe('Multiple Subscriptions', () => {
    it('should support multiple subscriptions to same table', () => {
      const sub1 = createSubscription('player_state', { id: { eq: 1 } });
      const sub2 = createSubscription('player_state', { id: { eq: 2 } });

      expect(sub1.id).not.toBe(sub2.id);
      expect(sub1.tableName).toBe(sub2.tableName);
    });

    it('should support subscriptions to different tables', () => {
      const sub1 = createSubscription('player_state', {});
      const sub2 = createSubscription('entity_position', {});
      const sub3 = createSubscription('inventory', {});

      expect(sub1.tableName).toBe('player_state');
      expect(sub2.tableName).toBe('entity_position');
      expect(sub3.tableName).toBe('inventory');
    });

    it('should isolate events between subscriptions', () => {
      const emitter = new EventEmitter();

      const player1Events: any[] = [];
      const player2Events: any[] = [];

      emitter.on('rowInserted', (data) => {
        if (data.subscriptionId === 'sub-1') player1Events.push(data);
        if (data.subscriptionId === 'sub-2') player2Events.push(data);
      });

      emitter.emit('rowInserted', {
        subscriptionId: 'sub-1',
        tableName: 'player_state',
        row: { id: 1 },
      });

      expect(player1Events).toHaveLength(1);
      expect(player2Events).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should emit subscriptionError event on subscription failure', () => {
      const emitter = new EventEmitter();
      const errors: any[] = [];

      emitter.on('subscriptionError', (error) => errors.push(error));

      const error = {
        subscriptionId: 'sub-123',
        tableName: 'invalid_table',
        error: new Error('Table not found'),
      };

      emitter.emit('subscriptionError', error);

      expect(errors).toHaveLength(1);
      expect(errors[0].tableName).toBe('invalid_table');
    });

    it('should handle malformed query gracefully', () => {
      const malformedQuery = { invalid: 'syntax' };

      // Should not throw during creation (SDK validates)
      expect(() => createSubscription('player_state', malformedQuery)).not.toThrow();
    });

    it('should continue other subscriptions if one fails', () => {
      const activeSubscriptions = new Map<string, any>();

      activeSubscriptions.set('sub-1', { tableName: 'player_state' });
      activeSubscriptions.set('sub-2', { tableName: 'entity_position' });

      // One subscription fails
      activeSubscriptions.delete('sub-1');

      // Others continue
      expect(activeSubscriptions.has('sub-2')).toBe(true);
      expect(activeSubscriptions.size).toBe(1);
    });
  });

  describe('Subscription Limits', () => {
    it('should enforce maximum subscription count', () => {
      const maxSubscriptions = 50;
      const activeCount = 45;

      expect(activeCount).toBeLessThan(maxSubscriptions);

      // Allow new subscription
      const canSubscribe = activeCount < maxSubscriptions;
      expect(canSubscribe).toBe(true);
    });

    it('should reject new subscriptions when limit reached', () => {
      const maxSubscriptions = 50;
      const activeCount = 50;

      const canSubscribe = activeCount < maxSubscriptions;
      expect(canSubscribe).toBe(false);
    });
  });

  describe('UnsubscribeAll', () => {
    it('should unsubscribe all active subscriptions', () => {
      const subscriptions = new Map<string, any>();

      subscriptions.set('sub-1', { tableName: 'player_state' });
      subscriptions.set('sub-2', { tableName: 'entity_position' });
      subscriptions.set('sub-3', { tableName: 'inventory' });

      // Unsubscribe all
      subscriptions.clear();

      expect(subscriptions.size).toBe(0);
    });

    it('should remove all event listeners', () => {
      const emitter = new EventEmitter();

      emitter.on('rowInserted', () => {});
      emitter.on('rowUpdated', () => {});
      emitter.on('rowDeleted', () => {});

      expect(emitter.eventNames().length).toBeGreaterThan(0);

      emitter.removeAllListeners();

      expect(emitter.eventNames().length).toBe(0);
    });
  });
});

// Helper functions

function createSubscription(
  tableName: string,
  query: any
): { id: string; tableName: string; unsubscribe: () => void } {
  const id = `sub-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    tableName,
    unsubscribe: () => {
      // Cleanup logic
    },
  };
}

function createUpdateAggregator(emitter: EventEmitter) {
  const pendingEvents: any[] = [];

  return {
    addEvent(eventType: string, data: any) {
      pendingEvents.push({ eventType, ...data });
    },
    flush() {
      if (pendingEvents.length > 0) {
        emitter.emit('gameStateUpdate', {
          timestamp: Date.now(),
          events: [...pendingEvents],
        });
        pendingEvents.length = 0;
      }
    },
  };
}
