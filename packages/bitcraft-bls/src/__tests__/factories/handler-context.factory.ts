/**
 * HandlerContext Test Factory
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Factory functions for generating mock HandlerContext objects
 * from @crosstown/sdk for handler testing.
 */

import type { HandlerContext, AcceptResponse, RejectResponse, NostrEvent } from '@crosstown/sdk';

/**
 * Create a mock HandlerContext with sensible defaults
 */
export function createHandlerContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
  const defaultPubkey = 'ab'.repeat(32); // 64-char hex

  const defaultEvent: NostrEvent = {
    id: '0'.repeat(64),
    pubkey: defaultPubkey,
    kind: 30078,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify({ reducer: 'test_action', args: [] }),
    sig: '0'.repeat(128),
  };

  return {
    kind: 30078,
    pubkey: defaultPubkey,
    amount: 100n,
    destination: 'g.crosstown.bitcraft',
    toon: Buffer.from('test-toon-data').toString('base64'),
    decode: () => defaultEvent,
    accept: (metadata?: Record<string, unknown>): AcceptResponse => ({
      accepted: true,
      metadata,
    }),
    reject: (code: string, message: string): RejectResponse => ({
      accepted: false,
      code,
      message,
    }),
    ...overrides,
  };
}
