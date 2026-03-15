/**
 * Event Fallback Unit Tests (AC: 4)
 * Story 4.5: Event Interpretation as Semantic Narratives
 *
 * Tests for graceful degradation with unmapped tables:
 * generic narrative production, no error thrown, unknown category,
 * missing ID field handling, and unregisterInterpreter fallback.
 *
 * Test count: 6
 */

import { describe, it, expect } from 'vitest';
import { EventInterpreter } from '../event-interpreter.js';
import type { TableUpdateEvent } from '../event-interpreter-types.js';

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

describe('Event Fallback (Story 4.5)', () => {
  describe('AC4 - Unmapped table fallback', () => {
    it('unknown table name -> generic narrative produced ("Table [name] row [id] [op]")', () => {
      // Given an event for a table with no registered interpreter
      const event = createTableUpdateEvent({
        table: 'completely_unknown_table',
        type: 'insert',
        oldRow: undefined,
        newRow: { id: 'row-99', data: 'test' },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then a generic narrative is produced
      expect(narrative.narrative).toContain('Table completely_unknown_table');
      expect(narrative.narrative).toContain('row-99');
      expect(narrative.narrative).toContain('inserted');
    });

    it('unknown table -> no error thrown (graceful degradation)', () => {
      // Given an event for an unmapped table
      const event = createTableUpdateEvent({
        table: 'mystery_table_xyz',
        type: 'delete',
        newRow: undefined,
        oldRow: { id: 'row-1' },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();

      // Then no error is thrown
      expect(() => interpreter.interpret(event)).not.toThrow();
    });

    it('unknown table -> category is "unknown"', () => {
      // Given an event for an unmapped table
      const event = createTableUpdateEvent({
        table: 'some_new_table',
        type: 'update',
        oldRow: { id: 'x', val: 1 },
        newRow: { id: 'x', val: 2 },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the category is 'unknown'
      expect(narrative.category).toBe('unknown');
    });

    it('unknown table with no ID field in row -> generic narrative with "[unknown]" as ID', () => {
      // Given an event with no recognizable ID field
      const event = createTableUpdateEvent({
        table: 'no_id_table',
        type: 'insert',
        oldRow: undefined,
        newRow: { value: 'test', count: 42 }, // No id, entity_id, or player_id
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative uses "[unknown]" as the ID placeholder
      expect(narrative.narrative).toContain('[unknown]');
    });

    it('after unregisterInterpreter() -> falls back to generic for previously mapped table', () => {
      // Given an interpreter with player_state registered
      const interpreter = new EventInterpreter();
      expect(interpreter.registeredTables).toContain('player_state');

      // When the player_state interpreter is unregistered
      const removed = interpreter.unregisterInterpreter('player_state');
      expect(removed).toBe(true);

      // And an event for player_state is interpreted
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        newRow: { id: 'p1', x: 10, y: 20 },
      });
      const narrative = interpreter.interpret(event);

      // Then the generic fallback is used
      expect(narrative.category).toBe('unknown');
      expect(narrative.narrative).toContain('Table player_state');
    });

    it('unregisterInterpreter() returns false for non-existent table (no-op, no error)', () => {
      // Given an interpreter with default tables
      const interpreter = new EventInterpreter();

      // When unregistering a table that was never registered
      const removed = interpreter.unregisterInterpreter('nonexistent_table_xyz');

      // Then it returns false and does not throw
      expect(removed).toBe(false);
    });
  });
});
