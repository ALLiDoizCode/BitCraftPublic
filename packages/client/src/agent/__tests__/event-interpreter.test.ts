/**
 * Event Interpreter Unit Tests (AC: 1, 2, 3, 4)
 * Story 4.5: Event Interpretation as Semantic Narratives
 *
 * Tests for EventInterpreter class: interpret() with mapped tables
 * (player position, inventory, resource), category assignment,
 * timestamp preservation, rawEvent reference, operationType, stateChanges,
 * and graceful handling of null/undefined/empty row data.
 *
 * Test count: 28
 */

import { describe, it, expect } from 'vitest';
import { EventInterpreter } from '../event-interpreter.js';
import { DEFAULT_TABLE_INTERPRETERS } from '../table-interpreters.js';
import type { TableUpdateEvent, SemanticNarrative } from '../event-interpreter-types.js';

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

describe('EventInterpreter (Story 4.5)', () => {
  describe('AC1 - Table update interpretation', () => {
    it('interpret() with player position insert -> narrative contains "appeared at hex"', () => {
      // Given a player position insert event
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative contains "appeared at hex"
      expect(narrative.narrative).toContain('appeared at hex');
      expect(narrative.narrative).toContain('100');
      expect(narrative.narrative).toContain('200');
    });

    it('interpret() with player position update -> narrative contains "moved from hex ... to hex"', () => {
      // Given a player position update event
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative contains movement description
      expect(narrative.narrative).toContain('moved from hex');
      expect(narrative.narrative).toContain('to hex');
    });

    it('interpret() with player position delete -> narrative contains "left the area"', () => {
      // Given a player position delete event
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'delete',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: undefined,
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative contains "left the area"
      expect(narrative.narrative).toContain('left the area');
    });

    it('interpret() with inventory insert -> narrative contains "received"', () => {
      // Given an inventory insert event
      const event = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 5 },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative contains "received"
      expect(narrative.narrative).toContain('received');
    });

    it('interpret() with inventory update -> narrative contains "quantity changed"', () => {
      // Given an inventory update event
      const event = createTableUpdateEvent({
        table: 'inventory',
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 5 },
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 10 },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative contains "quantity changed"
      expect(narrative.narrative).toContain('quantity changed');
    });

    it('interpret() with inventory delete -> narrative contains "lost"', () => {
      // Given an inventory delete event
      const event = createTableUpdateEvent({
        table: 'inventory',
        type: 'delete',
        oldRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 5 },
        newRow: undefined,
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative contains "lost"
      expect(narrative.narrative).toContain('lost');
    });

    it('interpret() with resource insert -> narrative about resource appearance', () => {
      // Given a resource spawn insert event
      const event = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'insert',
        oldRow: undefined,
        newRow: { id: 'res-001', resource_type: 3, x: 50, y: 75 },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative describes resource appearance
      expect(narrative.narrative).toContain('Resource');
      expect(narrative.category).toBe('resource');
    });

    it('interpret() with resource delete -> narrative contains "depleted"', () => {
      // Given a resource spawn delete event
      const event = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'delete',
        oldRow: { id: 'res-001', resource_type: 3, x: 50, y: 75 },
        newRow: undefined,
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative contains "depleted"
      expect(narrative.narrative).toContain('depleted');
    });
  });

  describe('AC1 - Narrative metadata', () => {
    it('interpret() sets correct category for each mapped table', () => {
      // Given events for different mapped tables
      const interpreter = new EventInterpreter();

      const playerEvent = createTableUpdateEvent({ table: 'player_state' });
      const inventoryEvent = createTableUpdateEvent({
        table: 'inventory',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc', item_id: 1, quantity: 1 },
      });
      const resourceEvent = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'insert',
        oldRow: undefined,
        newRow: { id: 'r1', resource_type: 1, x: 0, y: 0 },
      });

      // When each is interpreted
      const playerNarrative = interpreter.interpret(playerEvent);
      const inventoryNarrative = interpreter.interpret(inventoryEvent);
      const resourceNarrative = interpreter.interpret(resourceEvent);

      // Then each has the correct category
      expect(playerNarrative.category).toBe('movement');
      expect(inventoryNarrative.category).toBe('inventory');
      expect(resourceNarrative.category).toBe('resource');
    });

    it('interpret() includes timestamp in returned narrative', () => {
      // Given an event with a specific timestamp
      const event = createTableUpdateEvent({ timestamp: 1710500000000 });

      // When interpreted
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative includes the event timestamp
      expect(narrative.timestamp).toBe(1710500000000);
    });

    it('interpret() preserves rawEvent reference in narrative', () => {
      // Given a table update event
      const event = createTableUpdateEvent();

      // When interpreted
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the rawEvent is preserved as a reference
      expect(narrative.rawEvent).toBe(event);
    });

    it('interpret() includes operationType matching the event type', () => {
      // Given events of each type
      const interpreter = new EventInterpreter();

      const insertEvent = createTableUpdateEvent({
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc', x: 0, y: 0 },
      });
      const updateEvent = createTableUpdateEvent({ type: 'update' });
      const deleteEvent = createTableUpdateEvent({
        type: 'delete',
        newRow: undefined,
        oldRow: { player_id: 'abc', x: 0, y: 0 },
      });

      // When each is interpreted
      // Then operationType matches the event type
      expect(interpreter.interpret(insertEvent).operationType).toBe('insert');
      expect(interpreter.interpret(updateEvent).operationType).toBe('update');
      expect(interpreter.interpret(deleteEvent).operationType).toBe('delete');
    });

    it('interpret() includes stateChanges for update events', () => {
      // Given an update event with position changes
      const event = createTableUpdateEvent({
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 110, y: 200 },
      });

      // When interpreted
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then stateChanges captures the changed fields
      expect(narrative.stateChanges).toBeDefined();
      expect(narrative.stateChanges!['x']).toEqual({ old: 100, new: 110 });
    });
  });

  describe('Edge cases', () => {
    it('interpret() with null/undefined fields in row -> graceful handling, no crash', () => {
      // Given an event with null/undefined values in the row
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: null, x: undefined, y: 200 },
      });

      // When interpreted
      const interpreter = new EventInterpreter();

      // Then no error is thrown and a narrative is produced
      expect(() => interpreter.interpret(event)).not.toThrow();
      const narrative = interpreter.interpret(event);
      expect(narrative.narrative).toBeTruthy();
    });

    it('interpret() with empty row object -> produces narrative without errors', () => {
      // Given an event with an empty row
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        newRow: {},
      });

      // When interpreted
      const interpreter = new EventInterpreter();

      // Then no error is thrown and a narrative is produced
      expect(() => interpreter.interpret(event)).not.toThrow();
      const narrative = interpreter.interpret(event);
      expect(narrative.narrative).toBeTruthy();
    });
  });

  describe('AC1 - entity_position table (alternate player position table)', () => {
    it('interpret() with entity_position insert -> narrative contains "appeared at hex"', () => {
      // Given a player position insert event on entity_position table
      const event = createTableUpdateEvent({
        table: 'entity_position',
        type: 'insert',
        oldRow: undefined,
        newRow: { entity_id: 'def67890feedface', x: 50, y: 75 },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative contains "appeared at hex" and uses movement category
      expect(narrative.narrative).toContain('appeared at hex');
      expect(narrative.category).toBe('movement');
      expect(narrative.tableName).toBe('entity_position');
    });

    it('interpret() with entity_position update -> narrative contains "moved from hex ... to hex"', () => {
      // Given a player position update event on entity_position table
      const event = createTableUpdateEvent({
        table: 'entity_position',
        type: 'update',
        oldRow: { entity_id: 'def67890feedface', x: 50, y: 75 },
        newRow: { entity_id: 'def67890feedface', x: 60, y: 75 },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative contains movement description
      expect(narrative.narrative).toContain('moved from hex');
      expect(narrative.narrative).toContain('to hex');
      expect(narrative.category).toBe('movement');
    });
  });

  describe('AC1 - Resource update narrative', () => {
    it('interpret() with resource_spawn update -> narrative contains "updated"', () => {
      // Given a resource spawn update event
      const event = createTableUpdateEvent({
        table: 'resource_spawn',
        type: 'update',
        oldRow: { id: 'res-001', resource_type: 3, x: 50, y: 75, health: 100 },
        newRow: { id: 'res-001', resource_type: 3, x: 50, y: 75, health: 50 },
      });

      // When the interpreter processes it
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then the narrative describes the resource update
      expect(narrative.narrative).toContain('updated');
      expect(narrative.category).toBe('resource');
    });
  });

  describe('AC1 - Metadata: stateChanges for non-player tables', () => {
    it('interpret() includes stateChanges for inventory update events', () => {
      // Given an inventory update event with quantity changes
      const event = createTableUpdateEvent({
        table: 'inventory',
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 5 },
        newRow: { player_id: 'abc12345deadbeef', item_id: 42, quantity: 10 },
      });

      // When interpreted
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then stateChanges captures the quantity change
      expect(narrative.stateChanges).toBeDefined();
      expect(narrative.stateChanges!['quantity']).toEqual({ old: 5, new: 10 });
    });
  });

  describe('DEFAULT_TABLE_INTERPRETERS and registeredTables', () => {
    it('DEFAULT_TABLE_INTERPRETERS contains all 4 known tables', () => {
      // Then the default interpreters map covers all known tables
      expect(DEFAULT_TABLE_INTERPRETERS.has('player_state')).toBe(true);
      expect(DEFAULT_TABLE_INTERPRETERS.has('entity_position')).toBe(true);
      expect(DEFAULT_TABLE_INTERPRETERS.has('inventory')).toBe(true);
      expect(DEFAULT_TABLE_INTERPRETERS.has('resource_spawn')).toBe(true);
      expect(DEFAULT_TABLE_INTERPRETERS.size).toBe(4);
    });

    it('registeredTables getter returns all table names with registered interpreters', () => {
      // Given a new EventInterpreter (initialized with defaults)
      const interpreter = new EventInterpreter();

      // When we query registeredTables
      const tables = interpreter.registeredTables;

      // Then it includes all 4 default tables
      expect(tables).toContain('player_state');
      expect(tables).toContain('entity_position');
      expect(tables).toContain('inventory');
      expect(tables).toContain('resource_spawn');
      expect(tables.length).toBe(4);
    });

    it('registeredTables reflects custom interpreter registration', () => {
      // Given an interpreter with a custom table registered
      const interpreter = new EventInterpreter();
      interpreter.registerInterpreter({
        tableName: 'crafting_queue',
        category: 'building',
        interpret(event, _nameResolver) {
          return {
            timestamp: event.timestamp,
            category: 'building',
            narrative: 'crafting',
            tableName: event.table,
            operationType: event.type,
            rawEvent: event,
          };
        },
      });

      // Then registeredTables includes the new table
      expect(interpreter.registeredTables).toContain('crafting_queue');
      expect(interpreter.registeredTables.length).toBe(5);
    });
  });

  describe('interpretBatch()', () => {
    it('interprets multiple events and returns one narrative per event', () => {
      // Given multiple events of different types
      const events = [
        createTableUpdateEvent({
          table: 'player_state',
          type: 'insert',
          oldRow: undefined,
          newRow: { player_id: 'abc12345deadbeef', x: 10, y: 20 },
        }),
        createTableUpdateEvent({
          table: 'inventory',
          type: 'insert',
          oldRow: undefined,
          newRow: { player_id: 'abc12345deadbeef', item_id: 1, quantity: 3 },
        }),
        createTableUpdateEvent({
          table: 'unknown_table',
          type: 'delete',
          newRow: undefined,
          oldRow: { id: 'x' },
        }),
      ];

      // When interpretBatch is called
      const interpreter = new EventInterpreter();
      const results = interpreter.interpretBatch(events);

      // Then one narrative is produced per event
      expect(results.length).toBe(3);
      expect(results[0].category).toBe('movement');
      expect(results[1].category).toBe('inventory');
      expect(results[2].category).toBe('unknown');
    });

    it('interpretBatch with empty array returns empty array', () => {
      // Given an empty event array
      const interpreter = new EventInterpreter();

      // When interpretBatch is called with no events
      const results = interpreter.interpretBatch([]);

      // Then an empty array is returned
      expect(results).toEqual([]);
    });
  });

  describe('setNameResolver()', () => {
    it('setNameResolver changes name resolution behavior for subsequent calls', () => {
      // Given an interpreter with no custom name resolver
      const interpreter = new EventInterpreter();
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', x: 10, y: 20 },
      });

      // When a narrative is produced without custom resolver
      const beforeNarrative = interpreter.interpret(event);
      // Default resolver returns undefined, so truncated ID is used
      expect(beforeNarrative.entityName).toBe('abc12345...');

      // And then a custom name resolver is set
      interpreter.setNameResolver((_table, _id) => 'CustomName');

      // Then subsequent interpretations use the new resolver
      const afterNarrative = interpreter.interpret(event);
      expect(afterNarrative.entityName).toBe('CustomName');
      expect(afterNarrative.narrative).toContain('CustomName');
    });
  });

  describe('stateChanges edge cases', () => {
    it('interpret() returns undefined stateChanges when oldRow and newRow have identical values', () => {
      // Given an update event where no fields actually changed
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'update',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
      });

      // When interpreted
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then stateChanges is undefined (no actual changes)
      expect(narrative.stateChanges).toBeUndefined();
    });

    it('interpret() returns undefined stateChanges for insert events (no oldRow)', () => {
      // Given an insert event with no oldRow
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'insert',
        oldRow: undefined,
        newRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
      });

      // When interpreted
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then stateChanges is undefined (no previous state to compare)
      expect(narrative.stateChanges).toBeUndefined();
    });

    it('interpret() returns undefined stateChanges for delete events (no newRow)', () => {
      // Given a delete event with no newRow
      const event = createTableUpdateEvent({
        table: 'player_state',
        type: 'delete',
        oldRow: { player_id: 'abc12345deadbeef', x: 100, y: 200 },
        newRow: undefined,
      });

      // When interpreted
      const interpreter = new EventInterpreter();
      const narrative = interpreter.interpret(event);

      // Then stateChanges is undefined (no new state to compare)
      expect(narrative.stateChanges).toBeUndefined();
    });
  });
});
