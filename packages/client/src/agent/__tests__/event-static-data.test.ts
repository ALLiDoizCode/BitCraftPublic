/**
 * Event Static Data Resolution Unit Tests (AC: 2)
 * Story 4.5: Event Interpretation as Semantic Narratives
 *
 * Tests for display name resolution via StaticDataLoader:
 * player display names from static data, truncated pubkey fallback,
 * item name resolution from item_desc, createEventInterpreterWithStaticData()
 * factory wiring, error handling, table name mapping, and non-string/number id.
 *
 * Test count: 11
 */

import { describe, it, expect, vi } from 'vitest';
import { EventInterpreter, createEventInterpreterWithStaticData } from '../event-interpreter.js';
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

/**
 * Creates a mock StaticDataLoader with configurable get() behavior.
 */
function createMockStaticDataLoader(
  data: Record<string, Record<string, Record<string, unknown>>> = {}
) {
  return {
    get: vi.fn((table: string, id: string | number): Record<string, unknown> | undefined => {
      const tableData = data[table];
      if (!tableData) return undefined;
      return tableData[String(id)];
    }),
  };
}

describe('Event Static Data Resolution (Story 4.5)', () => {
  describe('AC2 - Player display name resolution', () => {
    it('player pubkey with display name in static data -> narrative uses display name', () => {
      // Given a static data loader with a player_desc entry for the player
      const mockLoader = createMockStaticDataLoader({
        player_desc: {
          abc12345deadbeef: { displayName: 'Alice' },
        },
      });

      // When an EventInterpreter is created with static data and interprets a player event
      const interpreter = createEventInterpreterWithStaticData(mockLoader);
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });
      const narrative = interpreter.interpret(event);

      // Then the narrative uses the display name "Alice"
      expect(narrative.narrative).toContain('Alice');
      expect(narrative.entityName).toBe('Alice');
    });

    it('player pubkey without display name in static data -> narrative uses truncated pubkey', () => {
      // Given a static data loader with no entry for the player
      const mockLoader = createMockStaticDataLoader({
        player_desc: {},
      });

      // When an EventInterpreter is created with static data and interprets a player event
      const interpreter = createEventInterpreterWithStaticData(mockLoader);
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });
      const narrative = interpreter.interpret(event);

      // Then the narrative uses truncated pubkey (first 8 chars + "...")
      expect(narrative.narrative).toContain('abc12345...');
    });

    it('item ID with name in item_desc -> narrative uses item name', () => {
      // Given a static data loader with an item_desc entry
      const mockLoader = createMockStaticDataLoader({
        item_desc: {
          '42': { name: 'Iron Ore' },
        },
      });

      // When an EventInterpreter is created with static data and interprets an inventory event
      const interpreter = createEventInterpreterWithStaticData(mockLoader);
      const event = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 5 },
      });
      const narrative = interpreter.interpret(event);

      // Then the narrative uses the item name "Iron Ore"
      expect(narrative.narrative).toContain('Iron Ore');
    });

    it('inventory event resolves player name from player_desc (not item_desc)', () => {
      // Given a static data loader with both player_desc and item_desc entries
      const mockLoader = createMockStaticDataLoader({
        player_desc: {
          abc12345deadbeef: { displayName: 'Bob' },
        },
        item_desc: {
          '42': { name: 'Iron Ore' },
        },
      });

      // When an inventory event is interpreted via the static data factory
      const interpreter = createEventInterpreterWithStaticData(mockLoader);
      const event = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 5 },
      });
      const narrative = interpreter.interpret(event);

      // Then the narrative resolves player name from player_desc (not item_desc)
      expect(narrative.entityName).toBe('Bob');
      expect(narrative.narrative).toContain('Bob');
      // And item name from item_desc
      expect(narrative.narrative).toContain('Iron Ore');
    });

    it('resource event resolves owner name from player_desc (not resource_spawn_desc)', () => {
      // Given a static data loader with player_desc and resource_spawn_desc entries
      const mockLoader = createMockStaticDataLoader({
        player_desc: {
          abc12345deadbeef: { displayName: 'Carol' },
        },
        resource_spawn_desc: {
          '3': { name: 'Oak Tree' },
        },
      });

      // When a resource delete event is interpreted via the static data factory
      const interpreter = createEventInterpreterWithStaticData(mockLoader);
      const event = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        oldRow: { id: 'res-001', owner_id: 'abc12345deadbeef', resource_type: 3 },
        newRow: undefined,
      });
      const narrative = interpreter.interpret(event);

      // Then the narrative resolves owner name from player_desc
      expect(narrative.entityName).toBe('Carol');
    });
  });

  describe('createEventInterpreterWithStaticData() factory', () => {
    it('correctly wires up name resolver to the interpreter', () => {
      // Given a mock static data loader with known data
      const mockLoader = createMockStaticDataLoader({
        player_desc: {
          abc12345deadbeef: { displayName: 'TestPlayer' },
        },
      });

      // When the factory creates an interpreter
      const interpreter = createEventInterpreterWithStaticData(mockLoader);

      // Then the interpreter resolves names from static data
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', x: 10, y: 20 },
      });
      const narrative = interpreter.interpret(event);
      expect(narrative.entityName).toBe('TestPlayer');
    });

    it('resolver catches StaticDataLoader errors gracefully -> returns truncated ID, no crash', () => {
      // Given a static data loader that throws errors
      const mockLoader = {
        get: vi.fn(() => {
          throw new Error('Data not loaded yet');
        }),
      };

      // When the factory creates an interpreter
      const interpreter = createEventInterpreterWithStaticData(mockLoader);

      // Then interpreting an event does not crash
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });
      expect(() => interpreter.interpret(event)).not.toThrow();

      // And the narrative falls back to truncated ID
      const narrative = interpreter.interpret(event);
      expect(narrative.narrative).toContain('abc12345...');
    });

    it('resolver maps event table name to _desc table (e.g., player_state -> player_desc)', () => {
      // Given a mock static data loader
      const mockLoader = createMockStaticDataLoader({
        player_desc: {
          abc12345deadbeef: { displayName: 'MappedPlayer' },
        },
      });

      // When the factory creates an interpreter and interprets a player_state event
      const interpreter = createEventInterpreterWithStaticData(mockLoader);
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', x: 10, y: 20 },
      });
      interpreter.interpret(event);

      // Then the resolver called staticDataLoader.get() with 'player_desc' (not 'player_state')
      expect(mockLoader.get).toHaveBeenCalledWith('player_desc', 'abc12345deadbeef');
    });

    it('resolver handles non-string/number id -> returns undefined, no crash', () => {
      // Given a mock static data loader
      const mockLoader = createMockStaticDataLoader({});

      // When the factory creates an interpreter and interprets an event with a non-string/number id
      const interpreter = createEventInterpreterWithStaticData(mockLoader);
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        // player_id is an object (unusual edge case)
        newRow: { player_id: { nested: 'object' }, x: 10, y: 20 },
      });

      // Then no crash occurs
      expect(() => interpreter.interpret(event)).not.toThrow();

      // And the static data loader was NOT called (id validation failed)
      expect(mockLoader.get).not.toHaveBeenCalled();
    });

    it('resolver catches TypeError from StaticDataLoader gracefully', () => {
      // Given a static data loader that throws TypeError (e.g., table doesn't exist in cache)
      const mockLoader = {
        get: vi.fn(() => {
          throw new TypeError("Table 'player_desc' does not exist in cache");
        }),
      };

      // When the factory creates an interpreter and interprets a player event
      const interpreter = createEventInterpreterWithStaticData(mockLoader);
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', x: 10, y: 20 },
      });

      // Then no error is thrown
      expect(() => interpreter.interpret(event)).not.toThrow();

      // And the narrative falls back to truncated ID
      const narrative = interpreter.interpret(event);
      expect(narrative.narrative).toContain('abc12345...');
    });

    it('resolver returns truncated ID for event tables not in TABLE_TO_DESC_MAP', () => {
      // Given a static data loader
      const mockLoader = createMockStaticDataLoader({});

      // When the factory creates an interpreter
      const interpreter = createEventInterpreterWithStaticData(mockLoader);

      // And we set a name resolver that would use the factory's resolver for an unmapped table
      // The factory's resolver maps table names to _desc counterparts;
      // for unmapped tables, it returns truncated ID directly without calling staticDataLoader.get()
      const event = createTableUpdateEvent({
        table: 'crafting_queue', // Not in TABLE_TO_DESC_MAP
        type: 'insert',
        oldRow: undefined,
        newRow: { id: 'craft-001', player_id: 'abc12345deadbeef' },
      });
      const narrative = interpreter.interpret(event);

      // Then the generic interpreter is used (no registered interpreter for crafting_queue)
      // and the name resolver would handle player_id resolution for the unknown table
      expect(narrative.category).toBe('unknown');
      expect(narrative.narrative).toContain('Table crafting_queue');
    });
  });
});
