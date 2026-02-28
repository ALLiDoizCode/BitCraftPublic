/**
 * Nostr Event Test Factory
 * Story 2.4: BLS Handler Integration Contract & Testing
 *
 * Factory functions for generating test Nostr events with valid/invalid signatures.
 */

import type { NostrEvent } from '../../nostr/types';
import { generateKeypair } from '../../nostr/keypair';
import { signEvent } from '../../publish/event-signing';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Create a valid NIP-01 Nostr event with optional overrides
 */
export async function createNostrEvent(
  overrides: Partial<Omit<NostrEvent, 'id' | 'sig'>> = {}
): Promise<NostrEvent> {
  const keypair = await generateKeypair();
  const pubkeyHex = bytesToHex(keypair.publicKey);

  const eventTemplate = {
    pubkey: pubkeyHex,
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: 'Test event content',
    ...overrides,
  };

  // Sign the event
  const signedEvent = signEvent(eventTemplate, keypair.privateKey);

  return signedEvent;
}

/**
 * Create a kind 30078 game action event with ILP packet content
 */
export async function createKind30078Event(
  overrides: {
    reducer?: string;
    args?: any[];
    content?: string;
  } = {}
): Promise<NostrEvent> {
  const { reducer = 'test_action', args = [], content } = overrides;

  const keypair = await generateKeypair();
  const pubkeyHex = bytesToHex(keypair.publicKey);
  const eventContent = content || JSON.stringify({ reducer, args });

  const eventTemplate = {
    pubkey: pubkeyHex,
    kind: 30078,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: eventContent,
  };

  // Sign with generated keypair
  const signedEvent = signEvent(eventTemplate, keypair.privateKey);

  return signedEvent;
}

/**
 * Create an intentionally invalid event for error testing
 */
export async function createInvalidEvent(
  type: 'bad-sig' | 'bad-json' | 'missing-fields'
): Promise<NostrEvent> {
  const keypair = await generateKeypair();
  const pubkeyHex = bytesToHex(keypair.publicKey);

  const eventTemplate = {
    pubkey: pubkeyHex,
    kind: 30078,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify({ reducer: 'test_action', args: [] }),
  };

  const signedEvent = signEvent(eventTemplate, keypair.privateKey);

  switch (type) {
    case 'bad-sig':
      // Corrupt the signature
      return {
        ...signedEvent,
        sig: signedEvent.sig.replace(/^./, 'z'), // Change first character
      };

    case 'bad-json':
      // Malformed JSON content
      return {
        ...signedEvent,
        content: '{invalid json content',
      };

    case 'missing-fields':
      // Missing required fields in content
      return {
        ...signedEvent,
        content: JSON.stringify({ args: [] }), // Missing 'reducer' field
      };

    default:
      throw new Error(`Unknown invalid event type: ${type}`);
  }
}
