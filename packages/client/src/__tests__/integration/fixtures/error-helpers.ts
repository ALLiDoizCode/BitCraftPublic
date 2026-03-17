/**
 * Error Assertion Fixture Helpers
 * Story 5.8: Error Scenarios & Graceful Degradation (AC1, AC2, AC6)
 *
 * Provides reusable helpers for asserting error conditions in integration tests:
 * - assertReducerError(): wraps executeReducer() expecting an error
 * - assertStateUnchanged(): snapshots table state and verifies no changes
 * - assertNoNewRows(): verifies no new rows inserted during a time window
 * - assertPreconditionError(): validates a reducer returns a specific precondition error
 * - ErrorCatalogEntry interface and recordErrorCatalogEntry(): structured error documentation
 *
 * Designed for reuse by future epics (especially Epic 6 MCP server error handling)
 * and Epic 9-13 SDK validation stories.
 *
 * BLOCKER-1 Workaround: All error assertions work with direct SpacetimeDB WebSocket
 * connection errors (reducer error strings), NOT SigilError instances.
 *
 * @integration
 */

import type { SpacetimeDBTestConnection } from './spacetimedb-connection';
import { executeReducer } from './test-client';
import { queryTableState, waitForTableInsert } from './subscription-helpers';

/**
 * Generic row type for SpacetimeDB table data accessed without generated bindings.
 * Follows the pattern established in player-lifecycle.ts and all Story 5.5-5.7 fixtures.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpacetimeDBRow = Record<string, any>;

/**
 * Structured result from assertReducerError()
 *
 * Contains the error message and reducer name for use in error catalog entries.
 */
export interface ReducerErrorResult {
  /** The error message returned by SpacetimeDB or executeReducer validation */
  errorMessage: string;
  /** The reducer name that produced the error */
  reducerName: string;
}

/**
 * A single entry in the error catalog, documenting a tested error scenario.
 *
 * Used by recordErrorCatalogEntry() to collect structured error documentation
 * during test execution. Compiled into the BitCraft Game Reference error catalog
 * appendix (Task 8).
 */
export interface ErrorCatalogEntry {
  /** The reducer that was called (e.g., 'craft_initiate_start') */
  reducerName: string;
  /** The error code or identifier (e.g., 'REDUCER_NOT_FOUND', 'PRECONDITION_VIOLATED') */
  errorCode: string;
  /** Where the error originates (e.g., 'spacetimedb', 'client-validation', 'budget-guard') */
  errorBoundary: string;
  /** The error message pattern or format (e.g., 'Invalid recipe') */
  messageFormat: string;
  /** Description of system state after the error (e.g., 'No state changes') */
  systemStateAfter: string;
  /** Which precondition was violated, if applicable (e.g., 'Player must be signed in') */
  preconditionViolated: string;
}

/** Collected error catalog entries during test execution */
const errorCatalog: ErrorCatalogEntry[] = [];

/**
 * Assert that a reducer call produces an error.
 *
 * Wraps executeReducer() and expects it to reject with an error.
 * Returns structured error info for use in error catalog entries.
 *
 * Usage:
 * ```typescript
 * const result = await assertReducerError(
 *   testConnection,
 *   'nonexistent_reducer_xyz',
 *   // no args needed for unknown reducer test
 * );
 * expect(result.errorMessage).toContain('nonexistent_reducer_xyz');
 * ```
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param reducerName - Name of the reducer to call (may be invalid)
 * @param args - Arguments to pass to the reducer
 * @returns Promise resolving to ReducerErrorResult with error details
 * @throws Error if the reducer call SUCCEEDS (expected to fail)
 */
export async function assertReducerError(
  testConnection: SpacetimeDBTestConnection,
  reducerName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
): Promise<ReducerErrorResult> {
  try {
    await executeReducer(testConnection, reducerName, ...args);
    throw new Error(
      `assertReducerError: expected reducer '${reducerName}' to fail, but it succeeded. ` +
        'The reducer call did not produce an error as expected.'
    );
  } catch (error) {
    // If we got our own "expected to fail" error, re-throw it
    if (
      error instanceof Error &&
      error.message.startsWith('assertReducerError: expected reducer')
    ) {
      throw error;
    }

    // Extract the error message from the caught error
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      errorMessage,
      reducerName,
    };
  }
}

/**
 * Assert that table state is unchanged after an action.
 *
 * Takes a snapshot of specified table states, executes an action callback,
 * then verifies the table states are identical after the action.
 *
 * Uses JSON.stringify for deep comparison of row data. Handles BigInt
 * serialization by converting to string representation.
 *
 * Usage:
 * ```typescript
 * await assertStateUnchanged(
 *   testConnection,
 *   ['player_state', 'signed_in_player_state'],
 *   async () => {
 *     await assertReducerError(testConnection, 'nonexistent_reducer');
 *   }
 * );
 * ```
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param tableNames - Table names to snapshot and compare
 * @param action - Async callback that performs the action expected to leave state unchanged
 * @param entityIdFilter - Optional entity_id to filter rows (limits comparison scope)
 * @throws Error if any table state changed after the action
 */
export async function assertStateUnchanged(
  testConnection: SpacetimeDBTestConnection,
  tableNames: string[],
  action: () => Promise<void>,
  entityIdFilter?: bigint | number
): Promise<void> {
  // Take snapshots before action
  const snapshots: Map<string, string> = new Map();

  for (const tableName of tableNames) {
    try {
      let rows = queryTableState<SpacetimeDBRow>(testConnection, tableName);

      // Apply entity_id filter if provided
      if (entityIdFilter != null) {
        rows = rows.filter(
          (row) =>
            row.entity_id === entityIdFilter || String(row.entity_id) === String(entityIdFilter)
        );
      }

      // Serialize with BigInt support for comparison
      snapshots.set(tableName, serializeForComparison(rows));
    } catch {
      // Table may not exist in subscription -- skip it
      snapshots.set(tableName, '[]');
    }
  }

  // Execute the action
  await action();

  // Brief settle delay to allow any unexpected state changes to propagate
  /** Delay to allow subscription state changes to propagate before comparison (ms) */
  const STATE_SETTLE_DELAY_MS = 500;
  await new Promise((resolve) => setTimeout(resolve, STATE_SETTLE_DELAY_MS));

  // Compare snapshots after action
  for (const tableName of tableNames) {
    try {
      let rows = queryTableState<SpacetimeDBRow>(testConnection, tableName);

      if (entityIdFilter != null) {
        rows = rows.filter(
          (row) =>
            row.entity_id === entityIdFilter || String(row.entity_id) === String(entityIdFilter)
        );
      }

      const afterSnapshot = serializeForComparison(rows);
      const beforeSnapshot = snapshots.get(tableName) ?? '[]';

      if (beforeSnapshot !== afterSnapshot) {
        throw new Error(
          `assertStateUnchanged: table '${tableName}' changed after action.\n` +
            `Before: ${beforeSnapshot.substring(0, 200)}...\n` +
            `After:  ${afterSnapshot.substring(0, 200)}...`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('assertStateUnchanged:')) {
        throw error;
      }
      // Table query failures after action are OK -- state might be unchanged
    }
  }
}

/**
 * Serialize an array of rows for comparison, handling BigInt values.
 *
 * @param rows - Array of table row objects
 * @returns JSON string with BigInt values converted to string representation
 */
function serializeForComparison(rows: SpacetimeDBRow[]): string {
  return JSON.stringify(rows, (_key, value) => {
    if (typeof value === 'bigint') {
      return `__bigint__${value.toString()}`;
    }
    return value;
  });
}

/**
 * Assert that no new rows are inserted into a table during a time window.
 *
 * Uses waitForTableInsert with a short timeout and expects the timeout
 * to trigger (indicating no insert occurred). If an insert IS detected,
 * this assertion fails.
 *
 * Usage:
 * ```typescript
 * await assertNoNewRows(testConnection, 'chat_message_state');
 * ```
 *
 * @param testConnection - Active SpacetimeDB test connection
 * @param tableName - Table to monitor for unexpected inserts
 * @param timeoutMs - How long to wait for an insert before declaring success (default: 1000ms)
 * @throws Error if a new row IS inserted (unexpected insertion)
 */
export async function assertNoNewRows(
  testConnection: SpacetimeDBTestConnection,
  tableName: string,
  timeoutMs: number = 1000
): Promise<void> {
  try {
    const { row } = await waitForTableInsert(testConnection, tableName, () => true, timeoutMs);
    // If we get here, a row was inserted -- that's unexpected
    throw new Error(
      `assertNoNewRows: unexpected row inserted into '${tableName}': ` +
        JSON.stringify(row, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ).substring(0, 200)
    );
  } catch (error) {
    // We EXPECT the timeout error -- that means no rows were inserted
    if (error instanceof Error && error.message.includes('timed out')) {
      // Success -- no new rows inserted
      return;
    }
    // Re-throw unexpected errors (including our own "unexpected row" error)
    throw error;
  }
}

/**
 * Record an error catalog entry for compilation into the Game Reference.
 *
 * Collects structured error documentation during test execution.
 * Call getErrorCatalog() to retrieve all recorded entries after test suite completion.
 *
 * Usage:
 * ```typescript
 * recordErrorCatalogEntry({
 *   reducerName: 'nonexistent_reducer_xyz',
 *   errorCode: 'REDUCER_NOT_FOUND',
 *   errorBoundary: 'spacetimedb',
 *   messageFormat: "Reducer 'nonexistent_reducer_xyz' failed: ...",
 *   systemStateAfter: 'No state changes',
 *   preconditionViolated: 'N/A (reducer does not exist)',
 * });
 * ```
 *
 * @param entry - The error catalog entry to record
 */
export function recordErrorCatalogEntry(entry: ErrorCatalogEntry): void {
  errorCatalog.push(entry);
}

/**
 * Retrieve all recorded error catalog entries.
 *
 * Returns a copy of the error catalog array collected during test execution.
 * Used by Task 8 to compile the error catalog appendix for the Game Reference.
 *
 * @returns Array of all recorded ErrorCatalogEntry instances (defensive copy)
 */
export function getErrorCatalog(): ErrorCatalogEntry[] {
  return [...errorCatalog];
}

/**
 * Clear all recorded error catalog entries.
 *
 * Used in test setup to reset the catalog between test suites.
 */
export function clearErrorCatalog(): void {
  errorCatalog.length = 0;
}

/**
 * Assert that a reducer returns a specific precondition error message.
 *
 * Combines assertReducerError() + assertStateUnchanged() into a single call
 * for testing BitCraft game precondition violations. This is the primary
 * reusable fixture for future integration tests (Epic 6+, Epics 9-13).
 *
 * Usage:
 * ```typescript
 * await assertPreconditionError({
 *   testConnection,
 *   reducerName: 'chat_post_message',
 *   args: [{ text: '', channel_id: 2, target_id: 0n, language_code: 'en' }],
 *   expectedErrorSubstring: "Can't send empty chat message",
 *   stateTables: ['chat_message_state'],
 * });
 * ```
 *
 * @param params - Parameters for the precondition error assertion
 * @returns Promise resolving to the ReducerErrorResult
 * @throws Error if the reducer does not produce an error, or if state changes occur
 */
export async function assertPreconditionError(params: {
  /** Active SpacetimeDB test connection */
  testConnection: SpacetimeDBTestConnection;
  /** Name of the reducer to call */
  reducerName: string;
  /** Arguments to pass to the reducer */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  /** Substring expected in the error message */
  expectedErrorSubstring: string;
  /** Tables to verify remain unchanged after the error (default: []) */
  stateTables?: string[];
  /** Optional entity_id to filter state comparison scope */
  entityIdFilter?: bigint | number;
}): Promise<ReducerErrorResult> {
  const {
    testConnection,
    reducerName,
    args,
    expectedErrorSubstring,
    stateTables = [],
    entityIdFilter,
  } = params;

  let result: ReducerErrorResult | null = null;

  // Use assertStateUnchanged to wrap the reducer error assertion
  if (stateTables.length > 0) {
    await assertStateUnchanged(
      testConnection,
      stateTables,
      async () => {
        result = await assertReducerError(testConnection, reducerName, ...args);
      },
      entityIdFilter
    );
  } else {
    result = await assertReducerError(testConnection, reducerName, ...args);
  }

  if (!result) {
    throw new Error(
      `assertPreconditionError: no error result captured for reducer '${reducerName}'`
    );
  }

  // Verify the error message contains the expected substring
  const errorLower = result.errorMessage.toLowerCase();
  const expectedLower = expectedErrorSubstring.toLowerCase();
  if (!errorLower.includes(expectedLower)) {
    throw new Error(
      `assertPreconditionError: expected error message to contain '${expectedErrorSubstring}' ` +
        `but got: '${result.errorMessage}'`
    );
  }

  return result;
}
