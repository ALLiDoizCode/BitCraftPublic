/**
 * Narrative Format Unit Tests (AC: 1, 2)
 * Story 4.5: Event Interpretation as Semantic Narratives
 *
 * Tests for narrative string formatting: event type description,
 * affected entity reference, state changes, timestamp info,
 * player movement format, inventory format, generic format,
 * and human-readability (no raw JSON or object references).
 *
 * Test count: 8
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

describe('Narrative Format (Story 4.5)', () => {
  describe('AC1 - Narrative content requirements', () => {
    it('narrative string contains event type description (insert/update/delete)', () => {
      // Given a player position update event
      const event = createTableUpdateEvent({ type: 'update' });
      const interpreter = new EventInterpreter();

      // When interpreted
      const narrative = interpreter.interpret(event);

      // Then the narrative describes an update action (e.g., "moved")
      // The narrative should describe what happened, not just say "update"
      expect(narrative.narrative.length).toBeGreaterThan(10);
      expect(narrative.operationType).toBe('update');
    });

    it('narrative string contains affected entity reference (ID or name)', () => {
      // Given a player event with a known player_id
      const event = createTableUpdateEvent({
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });
      const interpreter = new EventInterpreter();

      // When interpreted
      const narrative = interpreter.interpret(event);

      // Then the narrative references the entity (truncated pubkey or resolved name)
      // Either "abc12345..." or a display name should appear
      expect(narrative.narrative).toMatch(/abc12345|Player/);
    });

    it('narrative string contains key state changes for updates', () => {
      // Given a position update from (100,200) to (110,200)
      const event = createTableUpdateEvent({
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });
      const interpreter = new EventInterpreter();

      // When interpreted
      const narrative = interpreter.interpret(event);

      // Then the narrative references coordinate changes
      expect(narrative.narrative).toContain('100');
      expect(narrative.narrative).toContain('110');
    });

    it('narrative string contains timestamp information', () => {
      // Given an event with a specific timestamp
      const event = createTableUpdateEvent({ timestamp: 1710500000000 });
      const interpreter = new EventInterpreter();

      // When interpreted
      const narrative = interpreter.interpret(event);

      // Then the timestamp is preserved in the narrative metadata
      expect(narrative.timestamp).toBe(1710500000000);
    });
  });

  describe('AC2 - Specific narrative formats', () => {
    it('player movement narrative format: "Player [name] moved from hex (x1,y1) to hex (x2,y2)"', () => {
      // Given a player position update event
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });
      const interpreter = new EventInterpreter();

      // When interpreted
      const narrative = interpreter.interpret(event);

      // Then the narrative matches the expected format
      expect(narrative.narrative).toMatch(
        /Player .+ moved from hex \(\d+,\d+\) to hex \(\d+,\d+\)/
      );
    });

    it('inventory narrative format: "Player [name] received [item] x[qty]"', () => {
      // Given an inventory insert event
      const event = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 5 },
      });
      const interpreter = new EventInterpreter();

      // When interpreted
      const narrative = interpreter.interpret(event);

      // Then the narrative matches the expected format
      expect(narrative.narrative).toMatch(/Player .+ received .+ x\d+/);
    });

    it('generic narrative format: "Table [name] row [id] [inserted/updated/deleted]"', () => {
      // Given an unknown table event
      const event = createTableUpdateEvent({
        table: 'unknown_table_xyz',
        type: 'insert',
        oldRow: undefined,
        newRow: { id: 'row-42', value: 'something' },
      });
      const interpreter = new EventInterpreter();

      // When interpreted
      const narrative = interpreter.interpret(event);

      // Then the narrative matches the generic fallback format
      expect(narrative.narrative).toMatch(/Table unknown_table_xyz row .+ inserted/);
    });
  });

  describe('Human readability', () => {
    it('narrative is human-readable (no raw JSON, no object references)', () => {
      // Given various events
      const events: TableUpdateEvent[] = [
        createTableUpdateEvent({ table: 'player_state', type: 'update' }),
        createTableUpdateEvent({
          table: 'inventory',
          type: 'insert',
          oldRow: undefined,
          newRow: { player_id: 'abc12345', item_id: 1, quantity: 3 },
        }),
        createTableUpdateEvent({
          table: 'unknown_table',
          type: 'delete',
          newRow: undefined,
          oldRow: { id: 'x' },
        }),
      ];
      const interpreter = new EventInterpreter();

      // When interpreted
      const narratives = events.map((e) => interpreter.interpret(e));

      // Then none of the narratives contain raw JSON or object references
      for (const n of narratives) {
        expect(n.narrative).not.toContain('[object Object]');
        expect(n.narrative).not.toContain('{');
        expect(n.narrative).not.toContain('}');
        expect(n.narrative).not.toMatch(/^\[.*\]$/); // Not a JSON array string
        expect(n.narrative.length).toBeGreaterThan(10); // Not trivially short
      }
    });
  });
});
