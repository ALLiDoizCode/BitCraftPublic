/**
 * Sigil Client - Core SDK Entry Point
 *
 * Provides the main client interface for interacting with Sigil:
 * - Nostr identity management (client.identity)
 * - SpacetimeDB integration (future: client.spacetimedb)
 * - Nostr event publishing (future: client.nostr)
 * - ILP packet publishing (future: client.publish())
 */

import {
  finalizeEvent,
  verifyEvent,
  type EventTemplate,
  type Event as NostrEvent,
} from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { bytesToHex } from '@noble/hashes/utils';
import type { NostrKeypair } from './nostr/keypair';
import { loadKeypair } from './nostr/storage';

/**
 * Client identity interface
 *
 * Provides access to the user's Nostr public key and signing capability.
 * The private key is NEVER exposed through this interface.
 */
export interface ClientIdentity {
  /**
   * User's Nostr public key in multiple formats
   */
  publicKey: {
    hex: string; // 64-character hex string
    npub: string; // bech32-encoded npub format
  };

  /**
   * Sign a Nostr event with the user's private key
   *
   * @param event - Event template (kind, created_at, tags, content)
   * @returns Promise resolving to signed event with id, sig, and pubkey fields
   */
  sign(event: EventTemplate): Promise<NostrEvent>;
}

/**
 * Sigil Client configuration
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SigilClientConfig {
  // Future: SpacetimeDB connection options
  // Future: Nostr relay list
}

/**
 * Main Sigil Client class
 *
 * Coordinates all SDK functionality: identity, SpacetimeDB, Nostr, and ILP.
 */
export class SigilClient {
  private keypair: NostrKeypair | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config?: SigilClientConfig) {
    // Future: Initialize SpacetimeDB connection
    // Future: Initialize Nostr relay pool
  }

  /**
   * Load user identity from encrypted file
   *
   * Must be called before accessing the identity property.
   *
   * @param passphrase - Passphrase to decrypt the identity file
   * @param filePath - Optional custom path to identity file (defaults to ~/.sigil/identity)
   *
   * @example
   * ```typescript
   * const client = new SigilClient();
   * await client.loadIdentity('my-passphrase');
   * console.log('Logged in as:', client.identity.publicKey.npub);
   * ```
   */
  async loadIdentity(passphrase: string, filePath?: string): Promise<void> {
    this.keypair = await loadKeypair(passphrase, filePath);
  }

  /**
   * Access user's Nostr identity
   *
   * Provides public key and signing capability.
   * The private key is NEVER exposed.
   *
   * @throws Error if identity not loaded (call loadIdentity first)
   *
   * @example
   * ```typescript
   * const client = new SigilClient();
   * await client.loadIdentity('my-passphrase');
   *
   * // Access public key
   * console.log('npub:', client.identity.publicKey.npub);
   *
   * // Sign an event
   * const signed = await client.identity.sign({
   *   kind: 1,
   *   created_at: Math.floor(Date.now() / 1000),
   *   tags: [],
   *   content: 'Hello, Nostr!',
   * });
   * ```
   */
  get identity(): ClientIdentity {
    if (!this.keypair) {
      throw new Error('Identity not loaded. Call loadIdentity() first.');
    }

    const publicKeyHex = bytesToHex(this.keypair.publicKey);
    const publicKeyNpub = nip19.npubEncode(publicKeyHex);

    return {
      publicKey: {
        hex: publicKeyHex,
        npub: publicKeyNpub,
      },
      sign: async (event: EventTemplate): Promise<NostrEvent> => {
        if (!this.keypair) {
          throw new Error('Identity not loaded');
        }

        // Sign event using nostr-tools finalizeEvent
        // This automatically adds id, pubkey, and sig fields
        const signedEvent = finalizeEvent(event, this.keypair.privateKey);

        // Verify signature (sanity check)
        const isValid = verifyEvent(signedEvent);
        if (!isValid) {
          throw new Error('Failed to create valid signature');
        }

        return signedEvent;
      },
    };
  }
}
