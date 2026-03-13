/**
 * BLS Node Creation
 *
 * Wraps @crosstown/sdk createNode() with BitCraft-specific configuration.
 * Handles identity derivation from secret key or auto-generated mnemonic.
 *
 * SECURITY: Secret keys are NEVER logged. Only derived pubkeys appear in logs.
 */

import {
  createNode,
  fromSecretKey,
  fromMnemonic,
  generateMnemonic,
  type CrosstownNode,
  type Identity,
  type EmbeddedConnector,
} from '@crosstown/sdk';
import { hexToBytes } from '@noble/hashes/utils';
import type { BLSConfig } from './config.js';

/**
 * Result of creating a BLS node.
 */
export interface BLSNodeResult {
  /** The Crosstown node instance */
  node: CrosstownNode;
  /** The node's identity (pubkey, evmAddress) */
  identity: Identity;
  /** The resolved configuration */
  config: BLSConfig;
}

/**
 * Create a BLS node using @crosstown/sdk with embedded connector mode.
 *
 * If `config.secretKey` is provided (hex string), it is parsed to Uint8Array.
 * Otherwise, a new BIP-39 mnemonic is generated and used for NIP-06 derivation.
 *
 * @param config - BLS configuration
 * @returns BLS node result with node, identity, and config
 */
export function createBLSNode(config: BLSConfig): BLSNodeResult {
  let secretKeyBytes: Uint8Array;
  let identity: Identity;

  if (config.secretKey) {
    // Parse hex secret key to Uint8Array
    secretKeyBytes = hexToBytes(config.secretKey);
    identity = fromSecretKey(secretKeyBytes);
    // Log identity source (NEVER log the key itself)
    console.log('[BLS] Identity derived from configured secret key');
  } else {
    // Generate a new mnemonic and derive key
    const mnemonic = generateMnemonic();
    const derived = fromMnemonic(mnemonic);
    secretKeyBytes = derived.secretKey;
    identity = { pubkey: derived.pubkey, evmAddress: derived.evmAddress };
    // Log identity source (NEVER log mnemonic or key)
    console.log('[BLS] Identity derived from auto-generated mnemonic');
  }

  // Create embedded connector (stub: simple pass-through)
  const connector: EmbeddedConnector = {
    async start() {
      // Embedded connector initialization
    },
    async stop() {
      // Embedded connector cleanup
    },
  };

  // Create the Crosstown node with embedded connector mode
  const node = createNode({
    secretKey: secretKeyBytes,
    connector,
    ilpAddress: config.ilpAddress,
    kindPricing: config.kindPricing,
  });

  // Log node creation (NEVER log secretKey or token).
  // Identity details (pubkey, EVM address) are logged ONCE in index.ts after
  // successful start — not duplicated here.
  console.log(
    `[BLS] Node created for SpacetimeDB ${config.spacetimedbUrl}/database/${config.spacetimedbDatabase}`
  );

  return { node, identity, config };
}
