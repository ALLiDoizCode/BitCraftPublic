/**
 * Content Parser Tests (AC: 1, 3)
 * Story 3.2: Game Action Handler (kind 30078)
 *
 * Tests for parseEventContent() function that extracts reducer and args
 * from Nostr event content JSON.
 *
 * Validates: AC1 (event decoding and content parsing), AC3 (invalid content handling)
 * Security: OWASP A03 (injection prevention via reducer name validation)
 *
 * Test count: 17 (12 original + 4 gap-fill for null/object reducer, string/number args + 1 empty args)
 */

import { describe, it, expect } from 'vitest';
import { parseEventContent, ContentParseError } from '../content-parser.js';

describe('Content Parser (Story 3.2)', () => {
  describe('Valid content parsing', () => {
    it('parses valid JSON with reducer and args', () => {
      // Given a valid JSON content string with reducer and args
      const content = JSON.stringify({ reducer: 'player_move', args: [100, 200, true] });

      // When parseEventContent is called
      const result = parseEventContent(content);

      // Then it should return the parsed reducer and args
      expect(result.reducer).toBe('player_move');
      expect(result.args).toEqual([100, 200, true]);
    });

    it('parses content with empty args array', () => {
      // Given valid JSON content with an empty args array
      const content = JSON.stringify({ reducer: 'get_status', args: [] });

      // When parseEventContent is called
      const result = parseEventContent(content);

      // Then it should return the reducer and empty args
      expect(result.reducer).toBe('get_status');
      expect(result.args).toEqual([]);
    });
  });

  describe('Invalid JSON handling', () => {
    it('throws ContentParseError for malformed JSON', () => {
      // Given a non-JSON content string
      const content = 'this is not json{{{';

      // When parseEventContent is called
      // Then it should throw ContentParseError
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
    });
  });

  describe('Missing fields', () => {
    it('throws ContentParseError when reducer field is missing', () => {
      // Given JSON content without a reducer field
      const content = JSON.stringify({ args: [1, 2, 3] });

      // When parseEventContent is called
      // Then it should throw ContentParseError
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/missing reducer or args/);
    });

    it('throws ContentParseError when reducer is non-string (number)', () => {
      // Given JSON content with a non-string reducer (number)
      const content = JSON.stringify({ reducer: 42, args: [] });

      // When parseEventContent is called
      // Then it should throw ContentParseError
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/reducer must be a string/);
    });

    it('throws ContentParseError when reducer is empty string', () => {
      // Given JSON content with an empty string reducer
      const content = JSON.stringify({ reducer: '', args: [] });

      // When parseEventContent is called
      // Then it should throw ContentParseError
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/reducer must not be empty/);
    });

    it('throws ContentParseError when args field is missing', () => {
      // Given JSON content without an args field
      const content = JSON.stringify({ reducer: 'player_move' });

      // When parseEventContent is called
      // Then it should throw ContentParseError
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/missing reducer or args/);
    });

    it('throws ContentParseError when args is not an array (object)', () => {
      // Given JSON content with a non-array args field
      const content = JSON.stringify({ reducer: 'player_move', args: { x: 1 } });

      // When parseEventContent is called
      // Then it should throw ContentParseError
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/args must be an array/);
    });

    it('throws ContentParseError when reducer is null', () => {
      // Given JSON content with a null reducer
      const content = JSON.stringify({ reducer: null, args: [] });

      // When parseEventContent is called
      // Then it should throw ContentParseError (non-string type)
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/reducer must be a string/);
    });

    it('throws ContentParseError when reducer is an object', () => {
      // Given JSON content with an object reducer
      const content = JSON.stringify({ reducer: { name: 'player_move' }, args: [] });

      // When parseEventContent is called
      // Then it should throw ContentParseError (non-string type)
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/reducer must be a string/);
    });

    it('throws ContentParseError when args is a string', () => {
      // Given JSON content with a string args field
      const content = JSON.stringify({ reducer: 'player_move', args: 'not-an-array' });

      // When parseEventContent is called
      // Then it should throw ContentParseError
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/args must be an array/);
    });

    it('throws ContentParseError when args is a number', () => {
      // Given JSON content with a numeric args field
      const content = JSON.stringify({ reducer: 'player_move', args: 42 });

      // When parseEventContent is called
      // Then it should throw ContentParseError
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/args must be an array/);
    });
  });

  describe('Injection prevention (OWASP A03)', () => {
    it('throws ContentParseError for reducer with path traversal chars: ../etc/passwd', () => {
      // Given a reducer name containing path traversal characters
      const content = JSON.stringify({ reducer: '../etc/passwd', args: [] });

      // When parseEventContent is called
      // Then it should throw ContentParseError (invalid characters)
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/invalid characters/);
    });

    it('throws ContentParseError for reducer with SQL injection: test; DROP TABLE', () => {
      // Given a reducer name containing SQL injection characters
      const content = JSON.stringify({ reducer: 'test; DROP TABLE', args: [] });

      // When parseEventContent is called
      // Then it should throw ContentParseError (invalid characters)
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/invalid characters/);
    });

    it('throws ContentParseError for reducer with command injection: test && rm -rf /', () => {
      // Given a reducer name containing command injection characters
      const content = JSON.stringify({ reducer: 'test && rm -rf /', args: [] });

      // When parseEventContent is called
      // Then it should throw ContentParseError (invalid characters)
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/invalid characters/);
    });
  });

  describe('Size and length limits', () => {
    it('throws ContentParseError for reducer name exceeding 64 chars', () => {
      // Given a reducer name that is 65 characters long
      const longReducer = 'a'.repeat(65);
      const content = JSON.stringify({ reducer: longReducer, args: [] });

      // When parseEventContent is called
      // Then it should throw ContentParseError
      expect(() => parseEventContent(content)).toThrow(ContentParseError);
      expect(() => parseEventContent(content)).toThrow(/invalid characters/);
    });

    it('throws ContentParseError for content exceeding 1MB', () => {
      // Given content that exceeds 1MB in size
      const oversizedContent = 'x'.repeat(1024 * 1024 + 1);

      // When parseEventContent is called
      // Then it should throw ContentParseError (oversized payload protection)
      expect(() => parseEventContent(oversizedContent)).toThrow(ContentParseError);
      expect(() => parseEventContent(oversizedContent)).toThrow(/exceeds maximum size/);
    });
  });
});
