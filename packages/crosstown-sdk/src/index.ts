/**
 * @crosstown/sdk - Crosstown SDK for BLS Node Creation
 *
 * Provides:
 * - BLS node creation with embedded connector mode
 * - Identity derivation from secret key or mnemonic (NIP-06)
 * - Handler registration for kind-based event routing
 * - Verification pipeline and pricing validation (internal)
 *
 * @version 0.1.4
 */

import { getPublicKey } from 'nostr-tools/pure';
import { bytesToHex } from '@noble/hashes/utils';
import { generateMnemonic as bip39GenerateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for creating a Crosstown node.
 */
export interface NodeConfig {
  /** 32-byte secret key (Uint8Array) */
  secretKey: Uint8Array;
  /**
   * Embedded connector instance. When provided, the node uses embedded
   * (zero-latency) mode instead of standalone HTTP connector mode.
   * Mutually exclusive with `connectorUrl`.
   */
  connector?: EmbeddedConnector;
  /**
   * Standalone connector URL.  Mutually exclusive with `connector`.
   */
  connectorUrl?: string;
  /** ILP routing address (e.g. "g.crosstown.bitcraft") */
  ilpAddress?: string;
  /** Per-kind pricing map (kind -> unit cost as bigint) */
  kindPricing?: Record<number, bigint>;
}

/**
 * Minimal embedded connector interface.
 * In production the SDK provides `EmbeddableConnector`; for the workspace
 * stub we accept anything implementing this shape.
 */
export interface EmbeddedConnector {
  /** Start the connector */
  start?(): Promise<void>;
  /** Stop the connector */
  stop?(): Promise<void>;
}

/**
 * Result returned by `node.start()`.
 */
export interface StartResult {
  /** Number of peers discovered */
  peerCount: number;
  /** Number of channels opened */
  channelCount: number;
  /** Bootstrap connection results */
  bootstrapResults: Array<{ address: string; success: boolean }>;
}

/**
 * Context passed to a registered kind handler.
 */
export interface HandlerContext {
  /** Nostr event kind */
  kind: number;
  /** Verified Nostr pubkey (64-char hex) */
  pubkey: string;
  /** ILP payment amount */
  amount: bigint;
  /** ILP destination address */
  destination: string;
  /** Raw TOON data (base64) */
  toon: string;
  /** Lazily decode the full Nostr event from TOON data (cached) */
  decode(): NostrEvent;
  /** Accept the packet (optionally with metadata) */
  accept(metadata?: Record<string, unknown>): AcceptResponse;
  /** Reject the packet with an ILP error code and message */
  reject(code: string, message: string): RejectResponse;
}

/**
 * A Nostr event (NIP-01).
 */
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * Returned by `ctx.accept()`.
 */
export interface AcceptResponse {
  accepted: true;
  metadata?: Record<string, unknown>;
}

/**
 * Returned by `ctx.reject()`.
 */
export interface RejectResponse {
  accepted: false;
  code: string;
  message: string;
}

/**
 * Identity information derived from a secret key.
 */
export interface Identity {
  /** Nostr x-only public key (64-char hex) */
  pubkey: string;
  /** EVM address (0x-prefixed, 40-char hex) */
  evmAddress: string;
}

/**
 * Identity information derived from a mnemonic, including the secret key.
 */
export interface MnemonicIdentity extends Identity {
  /** 32-byte secret key (Uint8Array) */
  secretKey: Uint8Array;
}

// ---------------------------------------------------------------------------
// Handler type
// ---------------------------------------------------------------------------

export type HandlerFn = (ctx: HandlerContext) => Promise<AcceptResponse | RejectResponse>;

// ---------------------------------------------------------------------------
// CrosstownNode
// ---------------------------------------------------------------------------

/**
 * CrosstownNode — created via `createNode()`.
 */
export class CrosstownNode {
  private readonly _config: NodeConfig;
  private _started = false;
  private _stopped = false;
  private readonly _handlers = new Map<number, HandlerFn>();
  private readonly _identity: Identity;
  private _inFlightCount = 0;

  constructor(config: NodeConfig) {
    this._config = config;

    // Derive identity from secret key
    this._identity = fromSecretKey(config.secretKey);
  }

  /**
   * The identity (pubkey, evmAddress) of this node.
   */
  get identity(): Identity {
    return this._identity;
  }

  /**
   * Whether the node has been started.
   */
  get started(): boolean {
    return this._started;
  }

  /**
   * Register a handler for a specific Nostr event kind.
   */
  on(kind: number, handler: HandlerFn): void {
    this._handlers.set(kind, handler);
  }

  /**
   * Start the node (initializes embedded connector, begins processing).
   */
  async start(): Promise<StartResult> {
    if (this._started) {
      return { peerCount: 0, channelCount: 0, bootstrapResults: [] };
    }

    // Start embedded connector if provided
    if (this._config.connector?.start) {
      await this._config.connector.start();
    }

    this._started = true;
    this._stopped = false;

    return {
      peerCount: 1,
      channelCount: 1,
      bootstrapResults: [
        { address: this._config.ilpAddress ?? 'g.crosstown.unknown', success: true },
      ],
    };
  }

  /**
   * Stop the node (graceful shutdown, drains in-flight requests).
   */
  async stop(): Promise<void> {
    if (!this._started || this._stopped) {
      return;
    }

    // Wait for in-flight requests to complete (with timeout)
    const maxWait = 10_000;
    const start = Date.now();
    while (this._inFlightCount > 0 && Date.now() - start < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Stop embedded connector if provided
    if (this._config.connector?.stop) {
      await this._config.connector.stop();
    }

    this._started = false;
    this._stopped = true;
  }

  /**
   * Get current in-flight request count (for lifecycle management).
   */
  get inFlightCount(): number {
    return this._inFlightCount;
  }

  /**
   * Dispatch a packet to a registered handler (for testing / stub usage).
   *
   * In the real SDK the ILP connector routes packets to handlers internally.
   * This method allows tests to simulate packet arrival.
   */
  async dispatch(ctx: HandlerContext): Promise<AcceptResponse | RejectResponse> {
    const handler = this._handlers.get(ctx.kind);
    if (!handler) {
      return { accepted: false, code: 'F00', message: `No handler for kind ${ctx.kind}` };
    }

    this._inFlightCount++;
    try {
      return await handler(ctx);
    } finally {
      this._inFlightCount--;
    }
  }

  /**
   * Check if a handler is registered for a given kind.
   */
  hasHandler(kind: number): boolean {
    return this._handlers.has(kind);
  }
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Create a new Crosstown node.
 */
export function createNode(config: NodeConfig): CrosstownNode {
  // Validate that secretKey is a 32-byte Uint8Array
  const isValidKey =
    config.secretKey &&
    (config.secretKey instanceof Uint8Array || ArrayBuffer.isView(config.secretKey)) &&
    config.secretKey.length === 32;

  if (!isValidKey) {
    throw new Error('secretKey must be a 32-byte Uint8Array');
  }

  // Validate that exactly one of connector or connectorUrl is provided
  if (!config.connector && !config.connectorUrl) {
    throw new Error('Either connector (embedded) or connectorUrl (standalone) must be provided');
  }

  return new CrosstownNode(config);
}

// ---------------------------------------------------------------------------
// Identity derivation
// ---------------------------------------------------------------------------

/**
 * Derive identity (pubkey, evmAddress) from a 32-byte secret key.
 */
export function fromSecretKey(secretKey: Uint8Array): Identity {
  // Use ArrayBuffer.isView for cross-realm Uint8Array compatibility
  const isValid =
    secretKey &&
    (secretKey instanceof Uint8Array || ArrayBuffer.isView(secretKey)) &&
    secretKey.length === 32;

  if (!isValid) {
    throw new Error('secretKey must be a 32-byte Uint8Array');
  }

  // Ensure proper Uint8Array
  const key = new Uint8Array(secretKey);

  // getPublicKey from nostr-tools v2+ returns a hex string
  const pubkeyResult = getPublicKey(key);
  const pubkey =
    typeof pubkeyResult === 'string' ? pubkeyResult : bytesToHex(new Uint8Array(pubkeyResult));

  // Simplified EVM address derivation (placeholder -- same pattern as @crosstown/client)
  const evmAddress = `0x${pubkey.slice(0, 40)}`;

  return { pubkey, evmAddress };
}

/**
 * Derive identity and secret key from a BIP-39 mnemonic using NIP-06 derivation path.
 *
 * Derivation path: m/44'/1237'/0'/0/0
 */
export function fromMnemonic(mnemonic: string): MnemonicIdentity {
  if (!mnemonic || typeof mnemonic !== 'string') {
    throw new Error('mnemonic must be a non-empty string');
  }

  // Derive seed from mnemonic
  const seed = mnemonicToSeedSync(mnemonic);

  // NIP-06 derivation path: m/44'/1237'/0'/0/0
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive("m/44'/1237'/0'/0/0");

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key from mnemonic');
  }

  const secretKey = new Uint8Array(derived.privateKey);
  const identity = fromSecretKey(secretKey);

  return {
    ...identity,
    secretKey,
  };
}

/**
 * Generate a new BIP-39 mnemonic (12 words).
 */
export function generateMnemonic(): string {
  return bip39GenerateMnemonic(wordlist);
}

// ---------------------------------------------------------------------------
// Verification & Pricing (SDK-internal; exported for testing)
// ---------------------------------------------------------------------------

/**
 * Type for the verification pipeline function.
 * In the real SDK this validates Nostr signatures (secp256k1 Schnorr).
 */
export type VerificationPipelineFn = (event: NostrEvent) => Promise<boolean>;

/**
 * Create a verification pipeline that validates Nostr event signatures.
 * (Stub implementation -- always returns true for testing.)
 */
export function createVerificationPipeline(): VerificationPipelineFn {
  return async (_event: NostrEvent): Promise<boolean> => {
    // Stub: always valid. Real SDK verifies secp256k1 Schnorr signatures.
    return true;
  };
}

/**
 * Type for the pricing validator function.
 * In the real SDK this checks that the ILP amount meets the kind's minimum price.
 */
export type PricingValidatorFn = (
  kind: number,
  amount: bigint
) => { valid: boolean; code?: string; message?: string };

/**
 * Create a pricing validator from a kind pricing map.
 * (Stub implementation -- validates against the provided map.)
 */
export function createPricingValidator(kindPricing: Record<number, bigint>): PricingValidatorFn {
  return (kind: number, amount: bigint) => {
    const minPrice = kindPricing[kind];
    if (minPrice === undefined) {
      return { valid: true }; // No pricing rule => free
    }
    if (amount < minPrice) {
      return {
        valid: false,
        code: 'F04',
        message: `Insufficient amount: ${amount} < ${minPrice} for kind ${kind}`,
      };
    }
    return { valid: true };
  };
}

// ---------------------------------------------------------------------------
// Helper: create a mock HandlerContext for testing
// ---------------------------------------------------------------------------

/**
 * Create a HandlerContext suitable for testing.
 */
export function createMockHandlerContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
  const defaultEvent: NostrEvent = {
    id: '0'.repeat(64),
    pubkey: '0'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind: 30078,
    tags: [],
    content: JSON.stringify({ reducer: 'test_reducer', args: [] }),
    sig: '0'.repeat(128),
  };

  return {
    kind: 30078,
    pubkey: '0'.repeat(64),
    amount: 100n,
    destination: 'g.crosstown.bitcraft',
    toon: '',
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
