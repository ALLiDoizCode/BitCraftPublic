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

// Sigil Client
export { SigilClient, type ClientIdentity, type SigilClientConfig } from './client';
