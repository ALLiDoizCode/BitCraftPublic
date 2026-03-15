/**
 * Event Interpreter Types
 * Story 4.5: Event Interpretation as Semantic Narratives
 *
 * Type definitions for the event interpretation pipeline that transforms
 * raw SpacetimeDB table update events into human-readable semantic narratives.
 * The EventInterpreter is a pure transformation layer with no side effects.
 *
 * @module agent/event-interpreter-types
 */

/**
 * Normalized representation of a SpacetimeDB table update event.
 *
 * Consolidates RowInsertedEvent, RowUpdatedEvent, and RowDeletedEvent
 * from SubscriptionManager (Story 1.4) into a single interface.
 */
export interface TableUpdateEvent {
  /** SpacetimeDB table name */
  table: string;
  /** Update operation type */
  type: 'insert' | 'update' | 'delete';
  /** Event timestamp (Date.now() when event was received) */
  timestamp: number;
  /** Previous row state (for updates and deletes) */
  oldRow?: Record<string, unknown>;
  /** New row state (for inserts and updates) */
  newRow?: Record<string, unknown>;
}

/**
 * Categorization of event types for filtering and display.
 */
export type EventCategory =
  | 'movement'
  | 'inventory'
  | 'resource'
  | 'combat'
  | 'social'
  | 'building'
  | 'environment'
  | 'unknown';

/**
 * A single interpreted event with human-readable narrative.
 *
 * Produced by TableInterpreter.interpret() for each raw event.
 * Contains both the narrative text and structured metadata.
 */
export interface SemanticNarrative {
  /** When the event occurred */
  timestamp: number;
  /** Categorized event type */
  category: EventCategory;
  /** Human-readable description (e.g., "Player Alice moved from hex (100,200) to hex (110,200)") */
  narrative: string;
  /** Primary entity affected (player pubkey, resource node ID, etc.) */
  entityId?: string;
  /** Resolved display name (from static data) or truncated pubkey */
  entityName?: string;
  /** Source table for the event */
  tableName: string;
  /** Original operation */
  operationType: 'insert' | 'update' | 'delete';
  /** Key state changes for updates */
  stateChanges?: Record<string, { old: unknown; new: unknown }>;
  /** Original raw event preserved */
  rawEvent: TableUpdateEvent;
}

/**
 * A group of correlated events interpreted as a single action.
 *
 * Produced by EventInterpreter.interpretAndCorrelate() when multiple
 * events within the correlation window share the same entityId.
 */
export interface CorrelatedNarrative {
  /** Timestamp of the correlated group (earliest event) */
  timestamp: number;
  /** Dominant category */
  category: EventCategory;
  /** Combined narrative (e.g., "Player Alice harvested Wood from Oak Tree") */
  narrative: string;
  /** Individual events in the correlation group */
  events: SemanticNarrative[];
  /** Unique ID for the correlation group */
  correlationId: string;
}

/**
 * Interface for table-specific event interpreters.
 *
 * Each interpreter handles events for a specific SpacetimeDB table
 * and produces human-readable narratives appropriate for that table's data.
 */
export interface TableInterpreter {
  /** Which table this interpreter handles */
  tableName: string;
  /** Default event category */
  category: EventCategory;
  /** Produce narrative from raw event */
  interpret(event: TableUpdateEvent, nameResolver: NameResolver): SemanticNarrative;
}

/**
 * Function to resolve entity IDs to display names via static data.
 *
 * @param table - The event table name (e.g., 'player_state')
 * @param id - The entity ID to resolve (unknown because extracted from row data)
 * @returns Display name if available, or undefined for fallback
 */
export type NameResolver = (table: string, id: unknown) => string | undefined;

/**
 * Configuration for the EventInterpreter.
 */
export interface EventInterpreterConfig {
  /** Time window for correlating related events (default: 100ms) */
  correlationWindowMs: number;
  /** Optional name resolver function (defaults to truncated pubkey/ID fallback) */
  nameResolver?: NameResolver;
}
