/**
 * BLS Handler Error Types
 * Story 2.4: BLS Handler Integration Contract & Testing
 *
 * Defines error codes and response types for BLS handler integration.
 * These types match the contract specified in docs/bls-handler-contract.md
 */

/**
 * BLS Error Codes
 *
 * All possible error codes that can be returned by the BLS handler.
 */
export enum BLSErrorCode {
  /**
   * Invalid Nostr signature (secp256k1 verification failed)
   * Not retryable - signature is invalid and won't become valid
   */
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',

  /**
   * Unknown reducer name (reducer not found in SpacetimeDB)
   * Not retryable - reducer doesn't exist
   */
  UNKNOWN_REDUCER = 'UNKNOWN_REDUCER',

  /**
   * Reducer execution failed (SpacetimeDB returned error)
   * Retryable - may be transient issue or fixable with different args
   */
  REDUCER_FAILED = 'REDUCER_FAILED',

  /**
   * Invalid event content (malformed JSON or missing required fields)
   * Not retryable - content is invalid and won't become valid
   */
  INVALID_CONTENT = 'INVALID_CONTENT',
}

/**
 * BLS Error Response
 *
 * Standard error response returned by BLS handler for all failure modes.
 */
export interface BLSErrorResponse {
  /**
   * Event ID that failed (Nostr event.id)
   */
  eventId: string;

  /**
   * Error code identifying the failure type
   */
  errorCode: BLSErrorCode;

  /**
   * Human-readable error message with details
   */
  message: string;

  /**
   * Whether the error is retryable
   * - true: Client can retry the action (e.g., REDUCER_FAILED due to transient error)
   * - false: Error is permanent, don't retry (e.g., INVALID_SIGNATURE, UNKNOWN_REDUCER)
   */
  retryable: boolean;
}

/**
 * BLS Success Response
 *
 * Standard success response returned by BLS handler when action succeeds.
 */
export interface BLSSuccessResponse {
  /**
   * Event ID that succeeded (Nostr event.id)
   */
  eventId: string;

  /**
   * Success flag (always true for success responses)
   */
  success: true;
}

/**
 * BLS Response (Union Type)
 *
 * All possible responses from BLS handler.
 */
export type BLSResponse = BLSSuccessResponse | BLSErrorResponse;

/**
 * Type guard to check if response is an error
 */
export function isBLSError(response: BLSResponse): response is BLSErrorResponse {
  return 'errorCode' in response;
}

/**
 * Type guard to check if response is successful
 */
export function isBLSSuccess(response: BLSResponse): response is BLSSuccessResponse {
  return 'success' in response && response.success === true;
}
