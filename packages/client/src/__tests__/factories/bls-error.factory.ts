/**
 * BLS Error Response Test Factory
 * Story 2.4: BLS Handler Integration Contract & Testing
 *
 * Factory functions for generating BLS error and success responses.
 */

import { BLSErrorCode, BLSErrorResponse, BLSSuccessResponse } from '../../bls/types';

/**
 * Create a BLS error response with optional overrides
 */
export function createBLSErrorResponse(
  overrides: Partial<BLSErrorResponse> = {}
): BLSErrorResponse {
  const defaultError: BLSErrorResponse = {
    eventId: 'test-event-id-' + Date.now(),
    errorCode: BLSErrorCode.UNKNOWN_REDUCER,
    message: 'Test error message',
    retryable: false,
  };

  return {
    ...defaultError,
    ...overrides,
  };
}

/**
 * Create a BLS success response with optional overrides
 */
export function createBLSSuccessResponse(
  overrides: Partial<BLSSuccessResponse> = {}
): BLSSuccessResponse {
  const defaultSuccess: BLSSuccessResponse = {
    eventId: 'test-event-id-' + Date.now(),
    success: true,
  };

  return {
    ...defaultSuccess,
    ...overrides,
  };
}

/**
 * Create specific error responses for common scenarios
 */
export const BLSErrorFactories = {
  /**
   * Invalid signature error
   */
  invalidSignature(eventId: string): BLSErrorResponse {
    return createBLSErrorResponse({
      eventId,
      errorCode: BLSErrorCode.INVALID_SIGNATURE,
      message: `Signature verification failed for event ${eventId}`,
      retryable: false,
    });
  },

  /**
   * Unknown reducer error
   */
  unknownReducer(eventId: string, reducerName: string): BLSErrorResponse {
    return createBLSErrorResponse({
      eventId,
      errorCode: BLSErrorCode.UNKNOWN_REDUCER,
      message: `Reducer '${reducerName}' not found`,
      retryable: false,
    });
  },

  /**
   * Invalid content error
   */
  invalidContent(eventId: string, reason: string = 'Malformed JSON'): BLSErrorResponse {
    return createBLSErrorResponse({
      eventId,
      errorCode: BLSErrorCode.INVALID_CONTENT,
      message: `Failed to parse event content: ${reason}`,
      retryable: false,
    });
  },

  /**
   * Reducer failed error
   */
  reducerFailed(eventId: string, reason: string): BLSErrorResponse {
    return createBLSErrorResponse({
      eventId,
      errorCode: BLSErrorCode.REDUCER_FAILED,
      message: `SpacetimeDB reducer execution failed: ${reason}`,
      retryable: true, // Reducer failures may be transient
    });
  },
};
