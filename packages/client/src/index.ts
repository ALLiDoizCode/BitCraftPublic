export const SIGIL_VERSION = '0.1.0';

// Nostr identity management
export {
  generateKeypair,
  importPrivateKey,
  importFromSeedPhrase,
  exportKeypair,
  type NostrKeypair,
  type ExportedKeypair,
} from './nostr/keypair';

export { saveKeypair, loadKeypair } from './nostr/storage';

// Nostr relay client (Story 2.1)
export { NostrClient, SigilError } from './nostr/nostr-client';
export type {
  NostrEvent,
  Filter,
  Subscription,
  ILPPacket,
  ActionConfirmation,
  NostrRelayOptions,
  NostrConnectionState,
  NostrConnectionChangeEvent,
} from './nostr/types';

// SpacetimeDB integration
export {
  type SpacetimeDBSurface,
  type SpacetimeDBConnectionOptions,
  type ConnectionState,
  type ConnectionChangeEvent,
  type TableQuery,
  type SubscriptionHandle,
  type TableAccessors,
  type LatencyStats,
} from './spacetimedb';

// Sigil Client
export { SigilClient, type ClientIdentity, type SigilClientConfig } from './client';
