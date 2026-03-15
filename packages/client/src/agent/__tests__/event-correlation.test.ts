/**
 * Event Correlation Unit Tests (AC: 3)
 * Story 4.5: Event Interpretation as Semantic Narratives
 *
 * Tests for EventInterpreter.interpretAndCorrelate():
 * correlation window grouping, entityId-based correlation,
 * CorrelatedNarrative structure, harvest action correlation,
 * undefined entityId non-correlation, and edge cases.
 *
 * Test count: 14
 */

import { describe, it, expect } from 'vitest';
import { EventInterpreter } from '../event-interpreter.js';
import type {
  TableUpdateEvent,
  SemanticNarrative,
  CorrelatedNarrative,
} from '../event-interpreter-types.js';

/**
 * Creates a TableUpdateEvent for testing.
 */
function createTableUpdateEvent(overrides?: Partial<TableUpdateEvent>): TableUpdateEvent {
  return {
    table: 'player_state',
    type: 'update',
    timestamp: 1710500000000,
    oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
    newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
    ...overrides,
  };
}

/**
 * Type guard: checks if a narrative result is a CorrelatedNarrative.
 */
function isCorrelatedNarrative(
  n: SemanticNarrative | CorrelatedNarrative
): n is CorrelatedNarrative {
  return 'events' in n && 'correlationId' in n;
}

describe('Event Correlation (Story 4.5)', () => {
  describe('AC3 - Multi-update correlation', () => {
    it('two events within correlation window with same entityId -> single CorrelatedNarrative', () => {
      // Given two events within 100ms window sharing the same entityId (player_id)
      const event1 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000000,
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
        newRow: undefined,
      });
      const event2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000050, // 50ms later, within window
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
      });

      // When interpretAndCorrelate is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event1, event2]);

      // Then they are grouped into a single CorrelatedNarrative
      const correlated = results.filter(isCorrelatedNarrative);
      expect(correlated.length).toBe(1);
      expect(correlated[0].events.length).toBe(2);
    });

    it('two events outside correlation window -> two separate SemanticNarratives', () => {
      // Given two events 200ms apart (beyond default 100ms window)
      const event1 = createTableUpdateEvent({
        timestamp: 1710500000000,
      });
      const event2 = createTableUpdateEvent({
        timestamp: 1710500000200, // 200ms later, outside window
      });

      // When interpretAndCorrelate is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event1, event2]);

      // Then they remain as separate narratives (not correlated)
      expect(results.length).toBe(2);
      expect(results.every((r) => !isCorrelatedNarrative(r))).toBe(true);
    });

    it('two events with different entityIds -> two separate narratives (no correlation)', () => {
      // Given two events within window but different players
      const event1 = createTableUpdateEvent({
        timestamp: 1710500000000,
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });
      const event2 = createTableUpdateEvent({
        timestamp: 1710500000050,
        oldRow: { player_id: 'def67890feedface', x: 300, y: 400 },
        newRow: { player_id: 'def67890feedface', x: 310, y: 400 },
      });

      // When interpretAndCorrelate is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event1, event2]);

      // Then they remain separate (different entityIds)
      expect(results.length).toBe(2);
      expect(results.every((r) => !isCorrelatedNarrative(r))).toBe(true);
    });

    it('harvest action (resource delete + inventory insert) -> correlated narrative', () => {
      // Given a resource delete and inventory insert within correlation window (simulating harvest)
      const event1 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000000,
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
        newRow: undefined,
      });
      const event2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000010,
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
      });

      // When interpretAndCorrelate is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event1, event2]);

      // Then they produce a correlated narrative
      const correlated = results.filter(isCorrelatedNarrative);
      expect(correlated.length).toBe(1);
      expect(correlated[0].narrative).toBeTruthy();
      expect(correlated[0].events.length).toBe(2);
    });

    it('CorrelatedNarrative.events contains both original SemanticNarratives', () => {
      // Given two correlated events
      const event1 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000000,
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
        newRow: undefined,
      });
      const event2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000010,
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
      });

      // When interpretAndCorrelate is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event1, event2]);
      const correlated = results.find(isCorrelatedNarrative);

      // Then CorrelatedNarrative.events contains both original SemanticNarratives
      expect(correlated).toBeDefined();
      expect(correlated!.events.length).toBe(2);
      expect(correlated!.events[0].rawEvent).toBe(event1);
      expect(correlated!.events[1].rawEvent).toBe(event2);
    });

    it('CorrelatedNarrative.correlationId is unique per group', () => {
      // Given two separate groups of correlated events
      const groupA1 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000000,
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef' },
        newRow: undefined,
      });
      const groupA2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000010,
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
      });
      const groupB1 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000500, // 500ms later, separate window
        oldRow: { id: 'res-002', owner_id: 'def67890feedface' },
        newRow: undefined,
      });
      const groupB2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000510,
        oldRow: undefined,
        newRow: { player_id: 'def67890feedface', item_id: 43, quantity: 2 },
      });

      // When interpretAndCorrelate is called with all events
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([groupA1, groupA2, groupB1, groupB2]);

      // Then both correlated groups have unique correlationIds
      const correlated = results.filter(isCorrelatedNarrative);
      expect(correlated.length).toBe(2);
      expect(correlated[0].correlationId).not.toBe(correlated[1].correlationId);
    });

    it('two events with entityId === undefined within window -> NOT correlated (remain separate)', () => {
      // Given two events within window but both with undefined entityId
      // (e.g., unknown table events where no player_id/entity_id can be extracted)
      const event1 = createTableUpdateEvent({
        table: 'unknown_table_a',
        type: 'insert',
        timestamp: 1710500000000,
        oldRow: undefined,
        newRow: { value: 'something' }, // No id field -> entityId = undefined
      });
      const event2 = createTableUpdateEvent({
        table: 'unknown_table_b',
        type: 'insert',
        timestamp: 1710500000010,
        oldRow: undefined,
        newRow: { data: 'other' }, // No id field -> entityId = undefined
      });

      // When interpretAndCorrelate is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event1, event2]);

      // Then they are NOT correlated (undefined entityIds never group)
      expect(results.length).toBe(2);
      expect(results.every((r) => !isCorrelatedNarrative(r))).toBe(true);
    });

    it('single event -> returned as SemanticNarrative (not wrapped in correlation)', () => {
      // Given a single event
      const event = createTableUpdateEvent();

      // When interpretAndCorrelate is called with one event
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event]);

      // Then it is returned as a plain SemanticNarrative
      expect(results.length).toBe(1);
      expect(isCorrelatedNarrative(results[0])).toBe(false);
    });

    it('empty event batch -> empty result array', () => {
      // Given no events
      const interpreter = new EventInterpreter();

      // When interpretAndCorrelate is called with an empty array
      const results = interpreter.interpretAndCorrelate([]);

      // Then the result is an empty array
      expect(results).toEqual([]);
    });

    it('custom correlationWindowMs -> events within custom window are correlated', () => {
      // Given an interpreter with a wider correlation window (500ms)
      const interpreter = new EventInterpreter({ correlationWindowMs: 500 });

      // And two events 300ms apart (within 500ms but outside default 100ms)
      const event1 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000000,
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
        newRow: undefined,
      });
      const event2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000300, // 300ms later, within 500ms window
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
      });

      // When interpretAndCorrelate is called
      const results = interpreter.interpretAndCorrelate([event1, event2]);

      // Then they are correlated (within 500ms window)
      const correlated = results.filter(isCorrelatedNarrative);
      expect(correlated.length).toBe(1);
      expect(correlated[0].events.length).toBe(2);
    });

    it('custom correlationWindowMs -> events outside custom window are NOT correlated', () => {
      // Given an interpreter with a narrow correlation window (50ms)
      const interpreter = new EventInterpreter({ correlationWindowMs: 50 });

      // And two events 80ms apart (outside 50ms window but within default 100ms)
      const event1 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000000,
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
        newRow: undefined,
      });
      const event2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000080, // 80ms later, outside 50ms window
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
      });

      // When interpretAndCorrelate is called
      const results = interpreter.interpretAndCorrelate([event1, event2]);

      // Then they are NOT correlated (outside 50ms window)
      expect(results.length).toBe(2);
      expect(results.every((r) => !isCorrelatedNarrative(r))).toBe(true);
    });

    it('CorrelatedNarrative.timestamp uses the earliest event timestamp', () => {
      // Given two correlated events where the second has an earlier timestamp
      const event1 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000050, // Later
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
        newRow: undefined,
      });
      const event2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000010, // Earlier
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
      });

      // When interpretAndCorrelate is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event1, event2]);
      const correlated = results.find(isCorrelatedNarrative);

      // Then the CorrelatedNarrative uses the earliest timestamp
      expect(correlated).toBeDefined();
      expect(correlated!.timestamp).toBe(1710500000010);
    });

    it('CorrelatedNarrative.category is the dominant (most common) category in the group', () => {
      // Given three correlated events: 2 inventory + 1 resource
      const event1 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000000,
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
      });
      const event2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000010,
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 43, quantity: 2 },
      });
      const event3 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000020,
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
        newRow: undefined,
      });

      // When interpretAndCorrelate is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event1, event2, event3]);
      const correlated = results.find(isCorrelatedNarrative);

      // Then the dominant category is 'inventory' (2 out of 3)
      expect(correlated).toBeDefined();
      expect(correlated!.category).toBe('inventory');
    });

    it('CorrelatedNarrative.narrative is a meaningful combined string of individual narratives', () => {
      // Given two correlated events (harvest scenario)
      const event1 = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        timestamp: 1710500000000,
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
        newRow: undefined,
      });
      const event2 = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        timestamp: 1710500000010,
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
      });

      // When interpretAndCorrelate is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretAndCorrelate([event1, event2]);
      const correlated = results.find(isCorrelatedNarrative);

      // Then the combined narrative is a non-empty string containing both event descriptions
      expect(correlated).toBeDefined();
      expect(correlated!.narrative.length).toBeGreaterThan(10);
      // Combined narrative should include content from both individual narratives
      expect(correlated!.narrative).toContain('depleted');
      expect(correlated!.narrative).toContain('received');
    });
  });
});
