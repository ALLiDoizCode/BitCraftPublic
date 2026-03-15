/**
 * Event Interpreter
 * Story 4.5: Event Interpretation as Semantic Narratives
 *
 * Core EventInterpreter class that transforms raw SpacetimeDB table update events
 * into human-readable semantic narratives. This is a pure transformation layer
 * with no side effects -- it consumes events and produces narratives.
 *
 * The interpreter is NOT an EventEmitter. It takes input and returns output.
 * It does NOT subscribe to SpacetimeDB events directly. The agent runtime
 * passes raw events to it for interpretation.
 *
 * @module agent/event-interpreter
 */

import type {
  TableUpdateEvent,
  SemanticNarrative,
  CorrelatedNarrative,
  TableInterpreter,
  NameResolver,
  EventInterpreterConfig,
  EventCategory,
} from './event-interpreter-types.js';
import { DEFAULT_TABLE_INTERPRETERS, createGenericInterpreter } from './table-interpreters.js';

/**
 * Default name resolver that truncates IDs for display.
 * Returns the first 8 characters + "..." for string IDs,
 * or the string representation for other types.
 */
function defaultNameResolver(_table: string, _id: unknown): string | undefined {
  // Default resolver returns undefined -- let the interpreter use truncated ID
  return undefined;
}

/**
 * EventInterpreter transforms raw SpacetimeDB table update events into
 * human-readable semantic narratives.
 *
 * Features:
 * - Table-specific interpreters for known game tables (player_state, inventory, resource_spawn)
 * - Generic fallback for unmapped tables (AC4)
 * - Multi-update correlation within configurable time window (AC3)
 * - Display name resolution via static data (AC2)
 * - Extensible: register custom interpreters for new tables
 *
 * @example
 * ```typescript
 * const interpreter = new EventInterpreter();
 * const narrative = interpreter.interpret({
 *   table: 'player_state',
 *   type: 'update',
 *   timestamp: Date.now(),
 *   oldRow: { player_id: 'abc123...', x: 100, y: 200 },
 *   newRow: { player_id: 'abc123...', x: 110, y: 200 },
 * });
 * console.log(narrative.narrative);
 * // "Player abc12345... moved from hex (100,200) to hex (110,200)"
 * ```
 */
export class EventInterpreter {
  private readonly interpreters: Map<string, TableInterpreter>;
  private readonly correlationWindowMs: number;
  private _nameResolver: NameResolver;
  /** Per-instance counter for generating unique correlation IDs */
  private correlationCounter = 0;
  /** Cache of generic interpreters for unmapped tables to avoid repeated allocations */
  private readonly genericInterpreterCache: Map<string, TableInterpreter> = new Map();

  constructor(config?: Partial<EventInterpreterConfig>) {
    this.correlationWindowMs = config?.correlationWindowMs ?? 100;
    this._nameResolver = config?.nameResolver ?? defaultNameResolver;

    // Initialize with default interpreters (copies to avoid shared mutation)
    this.interpreters = new Map(DEFAULT_TABLE_INTERPRETERS);
  }

  /**
   * Interprets a single table update event into a semantic narrative.
   *
   * Looks up the registered interpreter for the event's table.
   * Falls back to a generic interpreter for unmapped tables (AC4).
   *
   * @param event - The raw table update event
   * @returns A semantic narrative describing the event
   */
  interpret(event: TableUpdateEvent): SemanticNarrative {
    let interpreter = this.interpreters.get(event.table);
    if (!interpreter) {
      // Use cached generic interpreter or create and cache a new one
      interpreter = this.genericInterpreterCache.get(event.table);
      if (!interpreter) {
        interpreter = createGenericInterpreter(event.table);
        this.genericInterpreterCache.set(event.table, interpreter);
      }
    }
    return interpreter.interpret(event, this._nameResolver);
  }

  /**
   * Interprets a batch of table update events.
   *
   * @param events - Array of raw table update events
   * @returns Array of semantic narratives (one per event)
   */
  interpretBatch(events: TableUpdateEvent[]): SemanticNarrative[] {
    return events.map((event) => this.interpret(event));
  }

  /**
   * Interprets events and correlates related updates within the time window.
   *
   * Groups events that:
   * 1. Fall within the correlationWindowMs time window
   * 2. Share the same non-undefined entityId
   *
   * Events with entityId === undefined are NEVER correlated.
   * Single events (no matching group) remain as SemanticNarrative.
   * Groups of 2+ events produce a CorrelatedNarrative.
   *
   * @param events - Array of raw table update events
   * @returns Mixed array of SemanticNarrative and CorrelatedNarrative
   */
  interpretAndCorrelate(events: TableUpdateEvent[]): (SemanticNarrative | CorrelatedNarrative)[] {
    if (events.length === 0) return [];

    // First, interpret all events
    const narratives = this.interpretBatch(events);

    // Sort by timestamp for correlation
    const sorted = narratives
      .map((n, i) => ({ narrative: n, index: i }))
      .sort((a, b) => a.narrative.timestamp - b.narrative.timestamp);

    // Group by entityId within time window
    const groups: SemanticNarrative[][] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < sorted.length; i++) {
      if (assigned.has(i)) continue;

      const current = sorted[i];
      // Events with undefined entityId are never grouped
      if (current.narrative.entityId === undefined) {
        groups.push([current.narrative]);
        assigned.add(i);
        continue;
      }

      const group: SemanticNarrative[] = [current.narrative];
      assigned.add(i);

      for (let j = i + 1; j < sorted.length; j++) {
        if (assigned.has(j)) continue;

        const candidate = sorted[j];
        // Check time window
        if (
          candidate.narrative.timestamp - current.narrative.timestamp >
          this.correlationWindowMs
        ) {
          break; // Beyond window, no more candidates (sorted by timestamp)
        }

        // Check entityId match (both must be defined and equal)
        if (
          candidate.narrative.entityId !== undefined &&
          candidate.narrative.entityId === current.narrative.entityId
        ) {
          group.push(candidate.narrative);
          assigned.add(j);
        }
      }

      groups.push(group);
    }

    // Convert groups to results
    const results: (SemanticNarrative | CorrelatedNarrative)[] = [];
    for (const group of groups) {
      if (group.length === 1) {
        results.push(group[0]);
      } else {
        results.push(this.createCorrelatedNarrative(group));
      }
    }

    return results;
  }

  /**
   * Registers a table-specific interpreter.
   * Adds or replaces the interpreter for the given table name.
   *
   * @param interpreter - The interpreter to register
   * @throws Error if interpreter.tableName is empty
   */
  registerInterpreter(interpreter: TableInterpreter): void {
    if (!interpreter.tableName) {
      throw new Error('TableInterpreter tableName cannot be empty');
    }
    this.interpreters.set(interpreter.tableName, interpreter);
  }

  /**
   * Unregisters the interpreter for a given table.
   * After unregistration, events for this table will use the generic fallback.
   *
   * @param tableName - The table to unregister
   * @returns true if an interpreter was removed, false if none existed
   */
  unregisterInterpreter(tableName: string): boolean {
    return this.interpreters.delete(tableName);
  }

  /**
   * Sets the name resolver function for display name lookups.
   *
   * @param resolver - The name resolver function
   */
  setNameResolver(resolver: NameResolver): void {
    this._nameResolver = resolver;
  }

  /**
   * Returns list of table names with registered interpreters.
   */
  get registeredTables(): string[] {
    return [...this.interpreters.keys()];
  }

  /**
   * Creates a CorrelatedNarrative from a group of related SemanticNarratives.
   */
  private createCorrelatedNarrative(events: SemanticNarrative[]): CorrelatedNarrative {
    // Sort events by timestamp
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

    // Use earliest timestamp
    const timestamp = sorted[0].timestamp;

    // Determine dominant category (most common, or first if tie)
    const categoryCounts = new Map<EventCategory, number>();
    for (const event of sorted) {
      categoryCounts.set(event.category, (categoryCounts.get(event.category) ?? 0) + 1);
    }
    let dominantCategory: EventCategory = sorted[0].category;
    let maxCount = 0;
    for (const [category, count] of categoryCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = category;
      }
    }

    // Build combined narrative
    const narrativeParts = sorted.map((e) => e.narrative);
    const combinedNarrative = narrativeParts.join('; ');

    // Generate unique correlation ID
    this.correlationCounter += 1;
    const correlationId = `corr-${timestamp}-${this.correlationCounter}`;

    return {
      timestamp,
      category: dominantCategory,
      narrative: combinedNarrative,
      events: sorted,
      correlationId,
    };
  }
}

/**
 * Table name mapping from event tables to their static data `_desc` counterparts.
 * StaticDataLoader.get() requires table names ending in `_desc`.
 */
const TABLE_TO_DESC_MAP: Record<string, string> = {
  player_state: 'player_desc',
  entity_position: 'player_desc',
  inventory: 'item_desc',
  resource_spawn: 'resource_spawn_desc',
};

/**
 * Factory function that creates an EventInterpreter wired to the StaticDataLoader.
 *
 * Creates a NameResolver that:
 * 1. Validates `id` is `string | number` before calling `staticDataLoader.get()`
 * 2. Wraps `staticDataLoader.get()` in try-catch (catches Error for unloaded state
 *    and TypeError for missing/invalid tables)
 * 3. Maps event table names to their corresponding `_desc` lookup tables
 * 4. Tries known fields: `displayName`, `name`, `label`, `title` from the returned row
 * 5. Returns the first non-empty string found
 * 6. Falls back to truncated ID on any error or missing data
 *
 * @param staticDataLoader - An object with a `get(table, id)` method compatible with StaticDataLoader
 * @returns An EventInterpreter with the static data name resolver
 */
export function createEventInterpreterWithStaticData(staticDataLoader: {
  get: (table: string, id: string | number) => Record<string, unknown> | undefined;
}): EventInterpreter {
  const nameResolver: NameResolver = (table: string, id: unknown): string | undefined => {
    // Guard: id must be string or number for StaticDataLoader.get()
    if (typeof id !== 'string' && typeof id !== 'number') {
      return undefined;
    }

    // Map event table name to _desc counterpart
    const descTable = TABLE_TO_DESC_MAP[table];
    if (!descTable) {
      // No known mapping -- return truncated ID as fallback
      return `${String(id).slice(0, 8)}...`;
    }

    try {
      const row = staticDataLoader.get(descTable, id);
      if (!row) {
        return `${String(id).slice(0, 8)}...`;
      }

      // Try known display name fields
      const nameFields = ['displayName', 'name', 'label', 'title'] as const;
      for (const field of nameFields) {
        const value = row[field];
        if (typeof value === 'string' && value.length > 0) {
          return value;
        }
      }

      // No display name found in the row
      return `${String(id).slice(0, 8)}...`;
    } catch {
      // StaticDataLoader.get() throws Error if not loaded, TypeError if table invalid
      // Graceful degradation: return truncated ID
      return `${String(id).slice(0, 8)}...`;
    }
  };

  return new EventInterpreter({ nameResolver });
}
