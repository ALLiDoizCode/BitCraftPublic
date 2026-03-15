/**
 * Table-Specific Event Interpreters
 * Story 4.5: Event Interpretation as Semantic Narratives
 *
 * Provides table-specific interpretation logic for known BitCraft tables
 * (player_state, entity_position, inventory, resource_spawn) and a generic
 * fallback interpreter for unmapped tables. Each interpreter transforms
 * raw SpacetimeDB table update events into human-readable semantic narratives.
 *
 * @module agent/table-interpreters
 */

import type {
  TableUpdateEvent,
  SemanticNarrative,
  TableInterpreter,
  NameResolver,
} from './event-interpreter-types.js';

/**
 * Common ID field names used for extracting row IDs.
 * Same pattern as TableAccessor.extractRowId() from tables.ts.
 */
const ID_FIELD_NAMES = ['id', 'entity_id', 'player_id'] as const;

/**
 * Truncates an ID to first 8 characters + "..." for display.
 * Used as fallback when no display name is available.
 */
function truncateId(id: unknown): string {
  if (id === null || id === undefined) {
    return '[unknown]';
  }
  const str = String(id);
  if (str.length <= 8) {
    return str;
  }
  return `${str.slice(0, 8)}...`;
}

/**
 * Extracts a row ID from common field names in a row object.
 * Returns undefined if no standard ID field is found.
 */
function extractRowId(row: Record<string, unknown> | undefined): unknown {
  if (!row) return undefined;
  for (const fieldName of ID_FIELD_NAMES) {
    const value = row[fieldName];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

/**
 * Computes state changes between old and new row objects.
 * Only includes fields that actually changed.
 *
 * Uses strict equality (`!==`) for comparison, which is correct for
 * primitive values (numbers, strings, booleans) from SpacetimeDB row data.
 * Nested objects with different references but identical structure will be
 * reported as changed; this is acceptable for MVP since row data is primarily primitives.
 */
function computeStateChanges(
  oldRow: Record<string, unknown> | undefined,
  newRow: Record<string, unknown> | undefined
): Record<string, { old: unknown; new: unknown }> | undefined {
  if (!oldRow || !newRow) return undefined;
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  const allKeys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);
  for (const key of allKeys) {
    const oldVal = oldRow[key];
    const newVal = newRow[key];
    if (oldVal !== newVal) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}

/**
 * Safely reads a value from a row field and converts it to a string.
 * Returns the string "[unknown]" if the field is missing, null, or undefined.
 */
function safeNum(row: Record<string, unknown> | undefined, field: string): string {
  if (!row) return '[unknown]';
  const val = row[field];
  if (val === null || val === undefined) return '[unknown]';
  return String(val);
}

/**
 * Resolves a player name from a row using the name resolver.
 * Falls back to truncated ID.
 */
function resolvePlayerName(
  row: Record<string, unknown> | undefined,
  nameResolver: NameResolver
): { entityId: string | undefined; entityName: string } {
  const playerId = row?.['player_id'] ?? row?.['entity_id'];
  const entityId = playerId !== undefined && playerId !== null ? String(playerId) : undefined;
  if (entityId !== undefined) {
    // Always use 'player_state' for player name resolution --
    // this maps to 'player_desc' in TABLE_TO_DESC_MAP regardless of the source event table.
    const resolved = nameResolver('player_state', playerId);
    return { entityId, entityName: resolved ?? truncateId(playerId) };
  }
  return { entityId: undefined, entityName: '[unknown]' };
}

/**
 * Creates a player position interpreter for `player_state` or `entity_position` tables.
 *
 * Narratives:
 * - Insert: "Player [name] appeared at hex ([x],[y])"
 * - Update: "Player [name] moved from hex ([oldX],[oldY]) to hex ([newX],[newY])"
 * - Delete: "Player [name] left the area"
 */
export function createPlayerPositionInterpreter(
  tableName: string = 'player_state'
): TableInterpreter {
  return {
    tableName,
    category: 'movement',
    interpret(event: TableUpdateEvent, nameResolver: NameResolver): SemanticNarrative {
      const activeRow = event.newRow ?? event.oldRow;
      const { entityId, entityName } = resolvePlayerName(activeRow, nameResolver);

      let narrative: string;
      switch (event.type) {
        case 'insert':
          narrative = `Player ${entityName} appeared at hex (${safeNum(event.newRow, 'x')},${safeNum(event.newRow, 'y')})`;
          break;
        case 'update':
          narrative = `Player ${entityName} moved from hex (${safeNum(event.oldRow, 'x')},${safeNum(event.oldRow, 'y')}) to hex (${safeNum(event.newRow, 'x')},${safeNum(event.newRow, 'y')})`;
          break;
        case 'delete':
          narrative = `Player ${entityName} left the area`;
          break;
      }

      return {
        timestamp: event.timestamp,
        category: 'movement',
        narrative,
        entityId,
        entityName,
        tableName: event.table,
        operationType: event.type,
        stateChanges: computeStateChanges(event.oldRow, event.newRow),
        rawEvent: event,
      };
    },
  };
}

/**
 * Creates an inventory interpreter for the `inventory` table.
 *
 * Narratives:
 * - Insert: "Player [name] received [item_name] x[quantity]"
 * - Update: "Player [name] [item_name] quantity changed from [old] to [new]"
 * - Delete: "Player [name] lost [item_name] x[quantity]"
 */
export function createInventoryInterpreter(): TableInterpreter {
  return {
    tableName: 'inventory',
    category: 'inventory',
    interpret(event: TableUpdateEvent, nameResolver: NameResolver): SemanticNarrative {
      const activeRow = event.newRow ?? event.oldRow;
      const { entityId, entityName } = resolvePlayerName(activeRow, nameResolver);

      // Resolve item name via nameResolver (maps to item_desc)
      const itemId = activeRow?.['item_id'];
      const itemName =
        itemId !== undefined && itemId !== null
          ? (nameResolver('inventory', itemId) ?? truncateId(itemId))
          : '[unknown item]';

      let narrative: string;
      switch (event.type) {
        case 'insert': {
          const qty = activeRow?.['quantity'] ?? 1;
          narrative = `Player ${entityName} received ${itemName} x${qty}`;
          break;
        }
        case 'update': {
          const oldQty = event.oldRow?.['quantity'] ?? '[unknown]';
          const newQty = event.newRow?.['quantity'] ?? '[unknown]';
          narrative = `Player ${entityName} ${itemName} quantity changed from ${oldQty} to ${newQty}`;
          break;
        }
        case 'delete': {
          const qty = activeRow?.['quantity'] ?? 1;
          narrative = `Player ${entityName} lost ${itemName} x${qty}`;
          break;
        }
      }

      return {
        timestamp: event.timestamp,
        category: 'inventory',
        narrative,
        entityId,
        entityName,
        tableName: event.table,
        operationType: event.type,
        stateChanges: computeStateChanges(event.oldRow, event.newRow),
        rawEvent: event,
      };
    },
  };
}

/**
 * Creates a resource interpreter for `resource_spawn` table.
 *
 * Narratives:
 * - Insert: "Resource node [type] appeared at hex ([x],[y])"
 * - Update: "Resource node [type] updated"
 * - Delete: "Resource node [id] depleted"
 *
 * The entityId is extracted from owner_id or player_id (the player who
 * caused the resource event) for cross-table correlation purposes.
 */
export function createResourceInterpreter(): TableInterpreter {
  return {
    tableName: 'resource_spawn',
    category: 'resource',
    interpret(event: TableUpdateEvent, nameResolver: NameResolver): SemanticNarrative {
      const activeRow = event.newRow ?? event.oldRow;

      // For resource events, entityId is the player (owner_id) for correlation
      const ownerId = activeRow?.['owner_id'] ?? activeRow?.['player_id'];
      const entityId = ownerId !== undefined && ownerId !== null ? String(ownerId) : undefined;
      // Resolve owner/player display name via nameResolver (consistent with other interpreters).
      // Always use 'player_state' for player name lookups (maps to 'player_desc').
      const entityName =
        entityId !== undefined
          ? (nameResolver('player_state', ownerId) ?? truncateId(ownerId))
          : undefined;

      // Resolve resource type name
      const resourceType = activeRow?.['resource_type'];
      const typeName =
        resourceType !== undefined && resourceType !== null
          ? (nameResolver('resource_spawn', resourceType) ?? truncateId(resourceType))
          : '[unknown type]';

      const nodeId = activeRow?.['id'] ?? '[unknown]';

      let narrative: string;
      switch (event.type) {
        case 'insert':
          narrative = `Resource node ${typeName} appeared at hex (${safeNum(event.newRow, 'x')},${safeNum(event.newRow, 'y')})`;
          break;
        case 'update':
          narrative = `Resource node ${typeName} updated`;
          break;
        case 'delete':
          narrative = `Resource node ${nodeId} depleted`;
          break;
      }

      return {
        timestamp: event.timestamp,
        category: 'resource',
        narrative,
        entityId,
        entityName,
        tableName: event.table,
        operationType: event.type,
        stateChanges: computeStateChanges(event.oldRow, event.newRow),
        rawEvent: event,
      };
    },
  };
}

/**
 * Creates a generic fallback interpreter for unmapped tables.
 *
 * Produces: "Table [name] row [id] [inserted/updated/deleted]"
 * Extracts row ID from common field names (id, entity_id, player_id).
 * Uses "[unknown]" if no ID field is found.
 *
 * @param tableName - The table name for the generic interpreter
 */
export function createGenericInterpreter(tableName: string): TableInterpreter {
  return {
    tableName,
    category: 'unknown',
    interpret(event: TableUpdateEvent, _nameResolver: NameResolver): SemanticNarrative {
      const activeRow = event.newRow ?? event.oldRow;
      const rowId = extractRowId(activeRow);
      const idStr = rowId !== undefined ? String(rowId) : '[unknown]';

      const opVerb =
        event.type === 'insert' ? 'inserted' : event.type === 'update' ? 'updated' : 'deleted';

      const narrative = `Table ${event.table} row ${idStr} ${opVerb}`;

      return {
        timestamp: event.timestamp,
        category: 'unknown',
        narrative,
        entityId: rowId !== undefined ? String(rowId) : undefined,
        tableName: event.table,
        operationType: event.type,
        stateChanges: computeStateChanges(event.oldRow, event.newRow),
        rawEvent: event,
      };
    },
  };
}

/**
 * Pre-populated map of table name -> interpreter for known tables.
 * Extensible: researchers can add custom interpreters via EventInterpreter.registerInterpreter().
 *
 * WARNING: Do not mutate this map directly. EventInterpreter copies it in the constructor.
 * Use EventInterpreter.registerInterpreter() to add custom interpreters per-instance.
 */
export const DEFAULT_TABLE_INTERPRETERS: ReadonlyMap<string, TableInterpreter> = new Map([
  ['player_state', createPlayerPositionInterpreter('player_state')],
  ['entity_position', createPlayerPositionInterpreter('entity_position')],
  ['inventory', createInventoryInterpreter()],
  ['resource_spawn', createResourceInterpreter()],
]);
