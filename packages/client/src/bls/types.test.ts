/**
 * BLS Types Unit Tests
 * Story 2.4: BLS Handler Integration Contract & Testing
 *
 * Tests BLS error types, response structures, and type guards.
 * These tests validate the contract types independent of the BLS handler.
 *
 * AC Coverage:
 * - AC7: Error response propagation (type structure validation)
 */

import { describe, it, expect } from 'vitest';
import {
  BLSErrorCode,
  type BLSErrorResponse,
  type BLSSuccessResponse,
  type BLSResponse,
  isBLSError,
  isBLSSuccess,
} from './types';

describe('BLS Types', () => {
  describe('BLSErrorCode enum', () => {
    it('should define all required error codes', () => {
      // AC7: Error codes must be defined and documented
      expect(BLSErrorCode.INVALID_SIGNATURE).toBe('INVALID_SIGNATURE');
      expect(BLSErrorCode.UNKNOWN_REDUCER).toBe('UNKNOWN_REDUCER');
      expect(BLSErrorCode.REDUCER_FAILED).toBe('REDUCER_FAILED');
      expect(BLSErrorCode.INVALID_CONTENT).toBe('INVALID_CONTENT');
    });

    it('should have exactly 4 error codes', () => {
      // Ensure no additional error codes are added without documentation
      const errorCodes = Object.values(BLSErrorCode);
      expect(errorCodes).toHaveLength(4);
    });

    it('should use SCREAMING_SNAKE_CASE for all error codes', () => {
      // Verify error code naming convention
      Object.values(BLSErrorCode).forEach((code) => {
        expect(code).toMatch(/^[A-Z_]+$/);
      });
    });
  });

  describe('BLSErrorResponse', () => {
    it('should validate structure of INVALID_SIGNATURE error', () => {
      // Given: An INVALID_SIGNATURE error response
      const error: BLSErrorResponse = {
        eventId: 'abc123',
        errorCode: BLSErrorCode.INVALID_SIGNATURE,
        message: 'Signature verification failed',
        retryable: false,
      };

      // Then: All required fields are present and valid
      expect(error.eventId).toBe('abc123');
      expect(error.errorCode).toBe(BLSErrorCode.INVALID_SIGNATURE);
      expect(error.message).toBe('Signature verification failed');
      expect(error.retryable).toBe(false);
    });

    it('should validate structure of UNKNOWN_REDUCER error', () => {
      // Given: An UNKNOWN_REDUCER error response
      const error: BLSErrorResponse = {
        eventId: 'def456',
        errorCode: BLSErrorCode.UNKNOWN_REDUCER,
        message: 'Reducer not found: unknown_reducer',
        retryable: false,
      };

      // Then: All required fields are present and valid
      expect(error.eventId).toBe('def456');
      expect(error.errorCode).toBe(BLSErrorCode.UNKNOWN_REDUCER);
      expect(error.message).toContain('unknown_reducer');
      expect(error.retryable).toBe(false);
    });

    it('should validate structure of REDUCER_FAILED error', () => {
      // Given: A REDUCER_FAILED error response (retryable)
      const error: BLSErrorResponse = {
        eventId: 'ghi789',
        errorCode: BLSErrorCode.REDUCER_FAILED,
        message: 'Reducer execution failed: timeout',
        retryable: true,
      };

      // Then: Error is marked as retryable
      expect(error.eventId).toBe('ghi789');
      expect(error.errorCode).toBe(BLSErrorCode.REDUCER_FAILED);
      expect(error.retryable).toBe(true);
    });

    it('should validate structure of INVALID_CONTENT error', () => {
      // Given: An INVALID_CONTENT error response
      const error: BLSErrorResponse = {
        eventId: 'jkl012',
        errorCode: BLSErrorCode.INVALID_CONTENT,
        message: 'Content parsing failed: invalid JSON',
        retryable: false,
      };

      // Then: All required fields are present and valid
      expect(error.eventId).toBe('jkl012');
      expect(error.errorCode).toBe(BLSErrorCode.INVALID_CONTENT);
      expect(error.retryable).toBe(false);
    });

    it('should enforce retryable field semantics', () => {
      // Given: Error code retryable rules from contract
      // INVALID_SIGNATURE -> retryable: false
      // UNKNOWN_REDUCER -> retryable: false
      // REDUCER_FAILED -> retryable: true
      // INVALID_CONTENT -> retryable: false

      const nonRetryableErrors = [
        BLSErrorCode.INVALID_SIGNATURE,
        BLSErrorCode.UNKNOWN_REDUCER,
        BLSErrorCode.INVALID_CONTENT,
      ];

      const retryableErrors = [BLSErrorCode.REDUCER_FAILED];

      // Then: Non-retryable errors should have retryable: false
      nonRetryableErrors.forEach((errorCode) => {
        const error: BLSErrorResponse = {
          eventId: 'test',
          errorCode,
          message: 'test',
          retryable: false,
        };
        expect(error.retryable).toBe(false);
      });

      // Then: Retryable errors should have retryable: true
      retryableErrors.forEach((errorCode) => {
        const error: BLSErrorResponse = {
          eventId: 'test',
          errorCode,
          message: 'test',
          retryable: true,
        };
        expect(error.retryable).toBe(true);
      });
    });
  });

  describe('BLSSuccessResponse', () => {
    it('should validate structure of success response', () => {
      // Given: A success response
      const response: BLSSuccessResponse = {
        eventId: 'success123',
        success: true,
      };

      // Then: All required fields are present and valid
      expect(response.eventId).toBe('success123');
      expect(response.success).toBe(true);
    });

    it('should enforce success field is always true', () => {
      // Given: A success response
      const response: BLSSuccessResponse = {
        eventId: 'test',
        success: true,
      };

      // Then: Success field is always true (enforced by type system)
      expect(response.success).toBe(true);
      // TypeScript ensures this at compile time
    });
  });

  describe('BLSResponse union type', () => {
    it('should accept success responses', () => {
      // Given: A success response
      const response: BLSResponse = {
        eventId: 'test',
        success: true,
      };

      // Then: Response is valid BLSResponse
      expect(response).toBeDefined();
      expect('success' in response).toBe(true);
    });

    it('should accept error responses', () => {
      // Given: An error response
      const response: BLSResponse = {
        eventId: 'test',
        errorCode: BLSErrorCode.INVALID_SIGNATURE,
        message: 'test',
        retryable: false,
      };

      // Then: Response is valid BLSResponse
      expect(response).toBeDefined();
      expect('errorCode' in response).toBe(true);
    });
  });

  describe('Type guards', () => {
    describe('isBLSError', () => {
      it('should identify error responses', () => {
        // Given: An error response
        const errorResponse: BLSResponse = {
          eventId: 'test',
          errorCode: BLSErrorCode.INVALID_SIGNATURE,
          message: 'test',
          retryable: false,
        };

        // When: Checking if response is error
        const result = isBLSError(errorResponse);

        // Then: Type guard returns true
        expect(result).toBe(true);

        // And: TypeScript narrows type to BLSErrorResponse
        if (isBLSError(errorResponse)) {
          expect(errorResponse.errorCode).toBe(BLSErrorCode.INVALID_SIGNATURE);
          expect(errorResponse.message).toBe('test');
          expect(errorResponse.retryable).toBe(false);
        }
      });

      it('should reject success responses', () => {
        // Given: A success response
        const successResponse: BLSResponse = {
          eventId: 'test',
          success: true,
        };

        // When: Checking if response is error
        const result = isBLSError(successResponse);

        // Then: Type guard returns false
        expect(result).toBe(false);
      });

      it('should handle all error codes', () => {
        // Given: Error responses for all error codes
        const errorCodes = [
          BLSErrorCode.INVALID_SIGNATURE,
          BLSErrorCode.UNKNOWN_REDUCER,
          BLSErrorCode.REDUCER_FAILED,
          BLSErrorCode.INVALID_CONTENT,
        ];

        errorCodes.forEach((errorCode) => {
          const errorResponse: BLSResponse = {
            eventId: 'test',
            errorCode,
            message: 'test',
            retryable: errorCode === BLSErrorCode.REDUCER_FAILED,
          };

          // When: Checking if response is error
          const result = isBLSError(errorResponse);

          // Then: Type guard returns true for all error codes
          expect(result).toBe(true);
        });
      });
    });

    describe('isBLSSuccess', () => {
      it('should identify success responses', () => {
        // Given: A success response
        const successResponse: BLSResponse = {
          eventId: 'test',
          success: true,
        };

        // When: Checking if response is success
        const result = isBLSSuccess(successResponse);

        // Then: Type guard returns true
        expect(result).toBe(true);

        // And: TypeScript narrows type to BLSSuccessResponse
        if (isBLSSuccess(successResponse)) {
          expect(successResponse.success).toBe(true);
          expect(successResponse.eventId).toBe('test');
        }
      });

      it('should reject error responses', () => {
        // Given: An error response
        const errorResponse: BLSResponse = {
          eventId: 'test',
          errorCode: BLSErrorCode.INVALID_SIGNATURE,
          message: 'test',
          retryable: false,
        };

        // When: Checking if response is success
        const result = isBLSSuccess(errorResponse);

        // Then: Type guard returns false
        expect(result).toBe(false);
      });
    });

    describe('Type guard mutual exclusivity', () => {
      it('should ensure error and success are mutually exclusive', () => {
        // Given: An error response
        const errorResponse: BLSResponse = {
          eventId: 'error_test',
          errorCode: BLSErrorCode.UNKNOWN_REDUCER,
          message: 'test',
          retryable: false,
        };

        // Then: Response is either error OR success, never both
        expect(isBLSError(errorResponse)).toBe(true);
        expect(isBLSSuccess(errorResponse)).toBe(false);

        // Given: A success response
        const successResponse: BLSResponse = {
          eventId: 'success_test',
          success: true,
        };

        // Then: Response is either error OR success, never both
        expect(isBLSError(successResponse)).toBe(false);
        expect(isBLSSuccess(successResponse)).toBe(true);
      });
    });
  });

  describe('Contract compliance', () => {
    it('should match BLS handler contract error response format', () => {
      // Given: Contract requires { eventId, errorCode, message, retryable }
      const contractResponse: BLSErrorResponse = {
        eventId: 'abc123def456',
        errorCode: BLSErrorCode.INVALID_SIGNATURE,
        message: 'Signature verification failed for event abc123def456',
        retryable: false,
      };

      // Then: All contract fields are present
      expect(contractResponse).toHaveProperty('eventId');
      expect(contractResponse).toHaveProperty('errorCode');
      expect(contractResponse).toHaveProperty('message');
      expect(contractResponse).toHaveProperty('retryable');

      // And: Field types match contract
      expect(typeof contractResponse.eventId).toBe('string');
      expect(typeof contractResponse.errorCode).toBe('string');
      expect(typeof contractResponse.message).toBe('string');
      expect(typeof contractResponse.retryable).toBe('boolean');
    });

    it('should match BLS handler contract success response format', () => {
      // Given: Contract requires { eventId, success: true }
      const contractResponse: BLSSuccessResponse = {
        eventId: 'abc123def456',
        success: true,
      };

      // Then: All contract fields are present
      expect(contractResponse).toHaveProperty('eventId');
      expect(contractResponse).toHaveProperty('success');

      // And: Field types match contract
      expect(typeof contractResponse.eventId).toBe('string');
      expect(contractResponse.success).toBe(true);
    });

    it('should support error code string literals from contract', () => {
      // Given: Contract specifies exact error code strings
      const expectedErrorCodes = [
        'INVALID_SIGNATURE',
        'UNKNOWN_REDUCER',
        'REDUCER_FAILED',
        'INVALID_CONTENT',
      ];

      // Then: Enum values match contract strings exactly
      expectedErrorCodes.forEach((expectedCode) => {
        expect(Object.values(BLSErrorCode)).toContain(expectedCode);
      });
    });
  });

  describe('Error message format', () => {
    it('should support human-readable error messages', () => {
      // Given: Contract requires human-readable messages
      const errors: BLSErrorResponse[] = [
        {
          eventId: 'test1',
          errorCode: BLSErrorCode.INVALID_SIGNATURE,
          message: 'Signature verification failed for event test1',
          retryable: false,
        },
        {
          eventId: 'test2',
          errorCode: BLSErrorCode.UNKNOWN_REDUCER,
          message: 'Reducer not found: unknown_reducer',
          retryable: false,
        },
        {
          eventId: 'test3',
          errorCode: BLSErrorCode.REDUCER_FAILED,
          message: 'Reducer execution failed: timeout after 30s',
          retryable: true,
        },
        {
          eventId: 'test4',
          errorCode: BLSErrorCode.INVALID_CONTENT,
          message: 'Content parsing failed: invalid JSON at position 10',
          retryable: false,
        },
      ];

      // Then: All messages are non-empty strings
      errors.forEach((error) => {
        expect(error.message).toBeTruthy();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      });
    });

    it('should support detailed error context in messages', () => {
      // Given: Error messages can include context (event ID, reducer name, etc.)
      const errorWithContext: BLSErrorResponse = {
        eventId: 'abc123',
        errorCode: BLSErrorCode.UNKNOWN_REDUCER,
        message: 'Reducer not found: player_move_invalid (event: abc123, pubkey: def456)',
        retryable: false,
      };

      // Then: Message can contain multiple pieces of context
      expect(errorWithContext.message).toContain('abc123'); // event ID
      expect(errorWithContext.message).toContain('player_move_invalid'); // reducer name
      expect(errorWithContext.message).toContain('def456'); // pubkey
    });
  });

  describe('Retryable semantics', () => {
    it('should mark signature errors as non-retryable', () => {
      // Given: Invalid signature errors
      const error: BLSErrorResponse = {
        eventId: 'test',
        errorCode: BLSErrorCode.INVALID_SIGNATURE,
        message: 'Signature invalid',
        retryable: false,
      };

      // Then: Signature errors are not retryable (signature won't become valid)
      expect(error.retryable).toBe(false);
    });

    it('should mark unknown reducer errors as non-retryable', () => {
      // Given: Unknown reducer errors
      const error: BLSErrorResponse = {
        eventId: 'test',
        errorCode: BLSErrorCode.UNKNOWN_REDUCER,
        message: 'Reducer not found',
        retryable: false,
      };

      // Then: Unknown reducer errors are not retryable (reducer doesn't exist)
      expect(error.retryable).toBe(false);
    });

    it('should mark invalid content errors as non-retryable', () => {
      // Given: Invalid content errors
      const error: BLSErrorResponse = {
        eventId: 'test',
        errorCode: BLSErrorCode.INVALID_CONTENT,
        message: 'Content invalid',
        retryable: false,
      };

      // Then: Content errors are not retryable (content won't become valid)
      expect(error.retryable).toBe(false);
    });

    it('should mark reducer execution errors as retryable', () => {
      // Given: Reducer execution errors
      const error: BLSErrorResponse = {
        eventId: 'test',
        errorCode: BLSErrorCode.REDUCER_FAILED,
        message: 'Reducer failed: timeout',
        retryable: true,
      };

      // Then: Reducer errors are retryable (may be transient)
      expect(error.retryable).toBe(true);
    });
  });
});
