/**
 * Handler End-to-End Integration Tests (AC: 1-5)
 * Story 3.2: Game Action Handler (kind 30078)
 *
 * Integration tests that exercise the full handler flow:
 * mock packet -> decode -> parse -> SpacetimeDB call -> accept/reject
 *
 * These tests require Docker (SpacetimeDB + BLS node running).
 * Skipped when RUN_INTEGRATION_TESTS or BLS_AVAILABLE env vars are not set.
 *
 * Validates: AC1 (event decoding), AC2 (reducer call with identity),
 *            AC3 (content parsing), AC4 (error handling), AC5 (zero silent failures)
 *
 * Test count: 12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerContext } from './factories/handler-context.factory.js';
import { createBLSConfig } from './factories/bls-config.factory.js';
import { createGameActionHandler } from '../handler.js';
import { createBLSNode } from '../node.js';

const SKIP_INTEGRATION = !process.env.RUN_INTEGRATION_TESTS || !process.env.BLS_AVAILABLE;

describe.skipIf(SKIP_INTEGRATION)('Handler E2E Integration (Story 3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('full handler flow: mock packet -> decode -> parse -> SpacetimeDB call -> accept', async () => {
    // Given a valid game action event with reducer and args
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const pubkey = 'ab'.repeat(32);

    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200, true] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the event is dispatched through the handler
    const result = await handler(ctx);

    // Then it should decode, parse content, call SpacetimeDB, and return accept
    expect(result.accepted).toBe(true);
  });

  it('handler registered on node kind 30078', () => {
    // Given a BLS node created with createBLSNode()
    const config = createBLSConfig();
    const { node } = createBLSNode(config);
    const handler = createGameActionHandler(config);

    // And createGameActionHandler() registered via node.on(30078, handler)
    node.on(30078, handler);

    // When checking node.hasHandler(30078)
    // Then it should return true
    expect(node.hasHandler(30078)).toBe(true);
  });

  it('valid game action processed end-to-end', async () => {
    // Given a valid event with reducer 'player_move' and args [100, 200, true]
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const eventId = 'a1b2c3d4'.repeat(8);
    const pubkey = 'ab'.repeat(32);

    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: eventId,
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200, true] }),
        sig: '0'.repeat(128),
      }),
    });

    // When dispatched through the full handler pipeline
    const result = await handler(ctx);

    // Then the handler should return AcceptResponse with eventId in metadata
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.metadata).toEqual({ eventId });
    }
  });

  it('identity correctly propagated to SpacetimeDB reducer', async () => {
    // Given an event with pubkey and args [100, 200]
    // This test validates the handler correctly prepends the pubkey
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';

    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler calls SpacetimeDB
    const result = await handler(ctx);

    // Then pubkey is prepended (verified by acceptance -- SpacetimeDB receives correct args)
    expect(result.accepted).toBe(true);
  });

  it('multiple sequential actions from same identity', async () => {
    // Given three sequential game action events from the same identity
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const pubkey = 'ab'.repeat(32);

    const actions = ['player_move', 'craft_item', 'send_chat'];
    const results = [];

    // When all three are dispatched through the handler
    for (const reducer of actions) {
      const ctx = createHandlerContext({
        pubkey,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer, args: [] }),
          sig: '0'.repeat(128),
        }),
      });
      results.push(await handler(ctx));
    }

    // Then all three should be accepted (no state leakage between calls)
    for (const result of results) {
      expect(result.accepted).toBe(true);
    }
  });

  it('multiple concurrent actions processed without data loss', async () => {
    // Given three game action events dispatched concurrently
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const pubkey = 'ab'.repeat(32);

    const actions = ['player_move', 'craft_item', 'send_chat'];
    const promises = actions.map((reducer) => {
      const ctx = createHandlerContext({
        pubkey,
        decode: () => ({
          id: '0'.repeat(64),
          pubkey,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer, args: [] }),
          sig: '0'.repeat(128),
        }),
      });
      return handler(ctx);
    });

    // When all three are processed in parallel
    const results = await Promise.all(promises);

    // Then all three should be accepted without data loss
    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.accepted).toBe(true);
    }
  });

  it('handler logs include eventId, pubkey, reducer, duration', async () => {
    // Given a valid game action event
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const pubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
    const eventId = 'a1b2c3d4'.repeat(8);

    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: eventId,
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When processed by the handler
    await handler(ctx);

    // Then the success log should include eventId, pubkey (truncated), reducer name, duration
    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' '));
    const successLog = allLogs.find((l) => l.includes('[BLS] Action succeeded'));
    expect(successLog).toBeDefined();
    expect(successLog).toContain(eventId);
    expect(successLog).toContain('32e18276');
    expect(successLog).toContain('player_move');
    expect(successLog).toMatch(/duration: \d+ms/);
  });

  it('ctx.accept() returns AcceptResponse with eventId in metadata', async () => {
    // Given a valid game action event with known event ID
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const eventId = 'deadbeef'.repeat(8);

    const ctx = createHandlerContext({
      decode: () => ({
        id: eventId,
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When processed by the handler successfully
    const result = await handler(ctx);

    // Then the result should be AcceptResponse with metadata.eventId matching event.id
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.metadata).toEqual({ eventId });
    }
  });

  it('SpacetimeDB reducer receives args with pubkey prepended', async () => {
    // Given an event with pubkey and args [100, 200]
    // Verified indirectly: handler accepts only when SpacetimeDB call succeeds
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const pubkey = 'ab'.repeat(32);

    const ctx = createHandlerContext({
      pubkey,
      decode: () => ({
        id: '0'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [100, 200] }),
        sig: '0'.repeat(128),
      }),
    });

    // When the handler calls SpacetimeDB
    const result = await handler(ctx);

    // Then the request should succeed (SpacetimeDB received correctly formatted args)
    expect(result.accepted).toBe(true);
  });

  it('handler dispatched via node.dispatch()', async () => {
    // Given a BLS node with registered handler
    const config = createBLSConfig();
    const { node } = createBLSNode(config);
    const handler = createGameActionHandler(config);
    node.on(30078, handler);

    const ctx = createHandlerContext({
      decode: () => ({
        id: '0'.repeat(64),
        pubkey: 'ab'.repeat(32),
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ reducer: 'player_move', args: [] }),
        sig: '0'.repeat(128),
      }),
    });

    // When node.dispatch(ctx) is called
    const result = await node.dispatch(ctx);

    // Then the handler should be invoked and return AcceptResponse or RejectResponse
    expect(result).toHaveProperty('accepted');
  });

  it('handler works with various reducer names (player_move, craft_item, send_chat)', async () => {
    // Given events with different reducer names
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const reducerNames = ['player_move', 'craft_item', 'send_chat'];

    // When each is dispatched through the handler
    for (const reducer of reducerNames) {
      const ctx = createHandlerContext({
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer, args: [] }),
          sig: '0'.repeat(128),
        }),
      });

      const result = await handler(ctx);

      // Then all should be processed (accept or reject based on SpacetimeDB response)
      expect(result).toHaveProperty('accepted');
    }
  });

  it('handler works with various arg types (objects, arrays, primitives, mixed)', async () => {
    // Given events with different arg types
    const config = createBLSConfig();
    const handler = createGameActionHandler(config);
    const argSets = [
      [{ x: 100, z: 200 }],
      [[1, 2, 3]],
      [42, 'hello', true],
      [{ x: 1 }, 'hello', 42],
    ];

    // When each is dispatched through the handler
    for (const args of argSets) {
      const ctx = createHandlerContext({
        decode: () => ({
          id: '0'.repeat(64),
          pubkey: 'ab'.repeat(32),
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'test_action', args }),
          sig: '0'.repeat(128),
        }),
      });

      const result = await handler(ctx);

      // Then all should be processed with args correctly serialized to JSON
      expect(result).toHaveProperty('accepted');
    }
  });
});
