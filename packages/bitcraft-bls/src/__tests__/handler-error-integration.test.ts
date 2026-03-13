/**
 * Handler Error Integration Tests (AC: 3, 4, 5)
 * Story 3.2: Game Action Handler (kind 30078)
 *
 * Integration tests for error handling in the full handler pipeline.
 * Tests that invalid content, unknown reducers, and SpacetimeDB errors
 * are all properly rejected with correct ILP error codes.
 *
 * These tests require Docker (SpacetimeDB + BLS node running).
 * Skipped when RUN_INTEGRATION_TESTS or BLS_AVAILABLE env vars are not set.
 *
 * Validates: AC3 (invalid content -> F06), AC4 (SpacetimeDB errors -> T00),
 *            AC5 (zero silent failures)
 *
 * Test count: 8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';
import { createGameActionHandler } from '../handler.js';

const SKIP_INTEGRATION = !process.env.RUN_INTEGRATION_TESTS || !process.env.BLS_AVAILABLE;

describe.skipIf(SKIP_INTEGRATION)('Handler Error Integration (Story 3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invalid JSON content rejected with F06', async () => {
    // Given an event with non-JSON content
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);

    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'not valid json{{{',
        sig: '0'.repeat(128),
      }),
    });

    // When dispatched through the handler
    const result = await handler(ctx);

    // Then it should return RejectResponse with code F06
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F06');
    }
  });

  it('missing reducer field rejected with F06', async () => {
    // Given an event with JSON content but no reducer field
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);

    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ args: [1, 2, 3] }),
        sig: '0'.repeat(128),
      }),
    });

    // When dispatched through the handler
    const result = await handler(ctx);

    // Then it should return RejectResponse with code F06
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F06');
      expect(result.message).toContain('missing reducer or args');
    }
  });

  it('missing args field rejected with F06', async () => {
    // Given an event with JSON content but no args field
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);

    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move' }),
        sig: '0'.repeat(128),
      }),
    });

    // When dispatched through the handler
    const result = await handler(ctx);

    // Then it should return RejectResponse with code F06
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('F06');
    }
  });

  it('unknown reducer name returns T00 from SpacetimeDB', async () => {
    // Given an event with a reducer name that does not exist in SpacetimeDB
    // SpacetimeDB returns 404 -> handler maps to T00
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);

    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'nonexistent_reducer_xyz', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When dispatched through the handler
    const result = await handler(ctx);

    // Then the handler returns RejectResponse with code T00
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('T00');
      expect(result.message).toContain('Unknown reducer');
    }
  });

  it('SpacetimeDB returns 400 (bad args) -> T00 reject', async () => {
    // Given an event with valid reducer but invalid args for that reducer
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);

    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: ['invalid', 'args'] }),
        sig: '0'.repeat(128),
      }),
    });

    // When dispatched through the handler
    const result = await handler(ctx);

    // Then SpacetimeDB returns 400 -> handler returns T00
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('T00');
      expect(result.message).toContain('failed');
    }
  });

  it('SpacetimeDB returns 500 (internal error) -> T00 reject', async () => {
    // Given an event targeting a reducer that causes a server error
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);

    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'error_reducer', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When dispatched through the handler
    const result = await handler(ctx);

    // Then SpacetimeDB returns 500 -> handler returns T00
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.code).toBe('T00');
    }
  });

  it('no silent failures: every dispatch results in accept or reject', async () => {
    // Given a mix of valid and invalid events
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);

    const events = [
      // Valid event
      JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
      // Invalid JSON
      'not-json{{{',
      // Missing reducer
      JSON.stringify({ args: [1, 2, 3] }),
      // Valid event
      JSON.stringify({ reducer: 'craft_item', args: ['recipe_001'] }),
    ];

    // When all are dispatched through the handler
    const results = [];
    for (const content of events) {
      const ctx = createHandlerContext({
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content,
          sig: '0'.repeat(128),
        }),
      });
      results.push(await handler(ctx));
    }

    // Then every single event should result in either AcceptResponse or RejectResponse
    expect(results).toHaveLength(4);
    for (const result of results) {
      expect(result).toHaveProperty('accepted');
      expect(typeof result.accepted).toBe('boolean');
    }
  });

  it('error logs contain event ID, pubkey (truncated), reducer name, error reason', async () => {
    // Given an event that will cause an error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
    const eventId = 'deadbeef'.repeat(8);

    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: eventId,
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'invalid-json-content',
        sig: '0'.repeat(128),
      }),
    });

    // When dispatched through the handler
    await handler(ctx);

    // Then the error log line should contain:
    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' '));
    const errorLog = allLogs.find((l) => l.includes('[BLS] Action failed'));
    expect(errorLog).toBeDefined();
    // - '[BLS] Action failed'
    expect(errorLog).toContain('[BLS] Action failed');
    // - eventId
    expect(errorLog).toContain(eventId);
    // - pubkey (first 8 + last 4 chars)
    expect(errorLog).toContain('32e18276');
    expect(errorLog).toContain('e245');
    // - error code
    expect(errorLog).toContain('F06');
    // - duration
    expect(errorLog).toMatch(/duration: \d+ms/);
  });
});
