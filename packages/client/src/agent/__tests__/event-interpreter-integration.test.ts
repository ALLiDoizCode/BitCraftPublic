/**
 * Event Interpreter Integration-Style Unit Tests (AC: 1, 3)
 * Story 4.5: Event Interpretation as Semantic Narratives
 *
 * Simulates complete interpretation pipelines:
 * mixed table batch interpretation, harvest correlation,
 * custom interpreter registration, and name resolver integration.
 * All tests are pure unit tests with mock data (no Docker required).
 *
 * Test count: 5
 */

import { describe, it, expect, vi } from 'vitest';
import { EventInterpreter, createEventInterpreterWithStaticData } from '../event-interpreter.js';
import type {
  TableUpdateEvent,
  SemanticNarrative,
  CorrelatedNarrative,
  TableInterpreter,
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

describe('Event Interpreter Integration (Story 4.5)', () => {
  describe('Complete interpretation pipeline', () => {
    it('interprets a batch of mixed table updates (player move + inventory change + unknown table)', () => {
      // Given an interpreter with mock name resolver
      const interpreter = new EventInterpreter();
      interpreter.setNameResolver((_table, id) =>
        typeof id === 'string' ? `Player-${id.slice(0, 4)}` : undefined
      );

      // And a batch of mixed events
      const events: TableUpdateEvent[] = [
        // Player move
        createTableUpdateEvent({
          table: 'player_state',
          type: 'update',
          timestamp: 1710500000000,
          oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
          newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
        }),
        // Inventory addition
        createTableUpdateEvent({
          table: 'inventory',
          type: 'insert',
          timestamp: 1710500000100,
          oldRow: undefined,
          newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 5 },
        }),
        // Unknown table
        createTableUpdateEvent({
          table: 'quest_progress',
          type: 'update',
          timestamp: 1710500000200,
          oldRow: { id: 'quest-1', stage: 1 },
          newRow: { id: 'quest-1', stage: 2 },
        }),
      ];

      // When the batch is interpreted
      const results = interpreter.interpretBatch(events);

      // Then each produces the correct narrative type
      expect(results.length).toBe(3);
      expect(results[0].category).toBe('movement');
      expect(results[0].narrative).toContain('moved');
      expect(results[1].category).toBe('inventory');
      expect(results[1].narrative).toContain('received');
      expect(results[2].category).toBe('unknown');
      expect(results[2].narrative).toContain('Table quest_progress');
    });

    it('simulates harvest correlation: resource delete + inventory insert within 100ms', () => {
      // Given an interpreter
      const interpreter = new EventInterpreter();

      // And a harvest scenario (resource deleted, item gained)
      const events: TableUpdateEvent[] = [
        createTableUpdateEvent({
          table: 'resource_spawn',
          type: 'delete',
          timestamp: 1710500000000,
          oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
          newRow: undefined,
        }),
        createTableUpdateEvent({
          table: 'inventory',
          type: 'insert',
          timestamp: 1710500000020, // 20ms later
          oldRow: undefined,
          newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 1 },
        }),
      ];

      // When interpretAndCorrelate is called
      const results = interpreter.interpretAndCorrelate(events);

      // Then a CorrelatedNarrative is produced
      const correlated = results.filter(isCorrelatedNarrative);
      expect(correlated.length).toBe(1);
      expect(correlated[0].events.length).toBe(2);

      // And raw events are accessible
      expect(correlated[0].events[0].rawEvent).toBe(events[0]);
      expect(correlated[0].events[1].rawEvent).toBe(events[1]);
    });

    it('custom interpreter registration takes precedence over generic fallback', () => {
      // Given an interpreter
      const interpreter = new EventInterpreter();

      // And a custom interpreter for a new table
      const customInterpreter: TableInterpreter = {
        tableName: 'crafting_queue',
        category: 'building',
        interpret(event, _nameResolver) {
          return {
            timestamp: event.timestamp,
            category: 'building',
            narrative: `Custom: crafting in progress`,
            tableName: event.table,
            operationType: event.type,
            rawEvent: event,
          };
        },
      };
      interpreter.registerInterpreter(customInterpreter);

      // When an event for the custom table is interpreted
      const event = createTableUpdateEvent({
        table: 'crafting_queue',
        type: 'update',
        oldRow: { id: 'c1', progress: 50 },
        newRow: { id: 'c1', progress: 100 },
      });
      const narrative = interpreter.interpret(event);

      // Then the custom interpreter is used (not generic fallback)
      expect(narrative.category).toBe('building');
      expect(narrative.narrative).toContain('Custom: crafting in progress');
    });

    it('name resolver integration: display names when available, truncated pubkeys as fallback', () => {
      // Given a mock static data loader with partial data
      const mockLoader = {
        get: vi.fn((table: string, id: string | number) => {
          if (table === 'player_desc' && String(id) === 'abc12345deadbeef') {
            return { displayName: 'Alice' };
          }
          return undefined; // Unknown player
        }),
      };

      // When an interpreter is created with static data
      const interpreter = createEventInterpreterWithStaticData(mockLoader);

      // And events for known and unknown players are interpreted
      const knownPlayerEvent = createTableUpdateEvent({
        table: 'player_state',
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });
      const unknownPlayerEvent = createTableUpdateEvent({
        table: 'player_state',
        type: 'update',
        oldRow: { player_id: 'ffffffff99999999', x: 300, y: 400 },
        newRow: { player_id: 'ffffffff99999999', x: 310, y: 400 },
      });

      const knownNarrative = interpreter.interpret(knownPlayerEvent);
      const unknownNarrative = interpreter.interpret(unknownPlayerEvent);

      // Then known player uses display name
      expect(knownNarrative.narrative).toContain('Alice');
      expect(knownNarrative.entityName).toBe('Alice');

      // And unknown player uses truncated pubkey
      expect(unknownNarrative.narrative).toContain('ffffffff...');
    });

    it('registerInterpreter rejects empty tableName', () => {
      // Given an interpreter
      const interpreter = new EventInterpreter();

      // When registering an interpreter with empty tableName
      const badInterpreter: TableInterpreter = {
        tableName: '',
        category: 'unknown',
        interpret(event, _nameResolver) {
          return {
            timestamp: event.timestamp,
            category: 'unknown',
            narrative: 'bad',
            tableName: event.table,
            operationType: event.type,
            rawEvent: event,
          };
        },
      };

      // Then it throws an error
      expect(() => interpreter.registerInterpreter(badInterpreter)).toThrow(
        'TableInterpreter tableName cannot be empty'
      );
    });
  });
});
