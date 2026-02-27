# ADR-002: Nostr Keypair as Sole Identity Mechanism

**Status:** Accepted
**Date:** 2026-02-25 (Implemented in Story 1.2)
**Deciders:** Jonathan (Project Lead), Alice (Product Owner), Charlie (Senior Dev)

---

## Context

The Sigil SDK requires an identity mechanism for users (both AI agents and human players) to interact with the game world. Traditional game clients use username/password authentication or OAuth providers (Google, Discord, etc.). However, Sigil has unique requirements:

1. **AI agents** need cryptographic identity without human interaction
2. **End-to-end provenance** - Game actions must be cryptographically attributable to an identity
3. **Portable identity** - Same identity across all Sigil-enabled games
4. **No centralized auth** - Avoid user databases, password resets, OAuth complexity

The question was: What identity mechanism best serves these requirements?

---

## Problem Statement

We need an identity mechanism that:
1. **Works for both AI agents and humans** (no CAPTCHA, no OAuth flows)
2. **Provides cryptographic signatures** (end-to-end provenance)
3. **Avoids authentication complexity** (no user databases, no password hashing)
4. **Is portable across games** (not tied to a single server)
5. **Supports key backup and recovery** (users can restore identity)

---

## Options Considered

### Option 1: Traditional Username/Password

**Pros:**
- Familiar to users
- Well-understood security model

**Cons:**
- Requires user database (passwords, hashes, salts)
- Password reset flows (email, SMS)
- AI agents can't complete CAPTCHA challenges
- No cryptographic provenance (server signs actions, not user)
- Tied to single server (not portable)

---

### Option 2: OAuth Providers (Google, Discord, GitHub)

**Pros:**
- Users already have accounts
- No password management on our side

**Cons:**
- AI agents can't complete OAuth flows
- Requires server-side OAuth implementation
- Dependency on external providers (rate limits, outages)
- No cryptographic provenance (OAuth tokens are bearer tokens, not signatures)
- Not portable (identity tied to OAuth provider)

---

### Option 3: Ethereum Wallet (secp256k1 keypair)

**Pros:**
- Cryptographic identity (public/private key pair)
- Works for AI agents (no OAuth flow)
- Portable (same wallet across all dApps)

**Cons:**
- Ethereum-specific (not game-agnostic)
- Gas fees for on-chain actions (expensive)
- Requires blockchain infrastructure (not suitable for MVP)

---

### Option 4: Nostr Keypair (secp256k1 keypair)

**Pros:**
- **Cryptographic identity** - secp256k1 public/private key pair
- **Works for AI agents** - No OAuth, no CAPTCHA, no email verification
- **Portable** - Same keypair across all Nostr-enabled apps
- **No user database** - Public key is the identifier, no password hashing
- **End-to-end provenance** - User signs events, not server
- **Key backup** - BIP-39 mnemonic seed phrases (human-readable recovery)
- **Open protocol** - Nostr is an open protocol, not owned by a company

**Cons:**
- Unfamiliar to most users (Nostr is niche)
- Key management complexity (users must secure private keys)
- No "forgot password" flow (lost keys = lost identity)

---

## Decision

**We chose Option 4: Nostr keypair (secp256k1) as the SOLE identity mechanism for Sigil SDK.**

No username/password, no OAuth, no Ethereum wallets. Only Nostr keypairs.

---

## Rationale

1. **Eliminates Authentication Complexity**
   - No user database (public key is the identifier)
   - No password hashing, salting, or storage
   - No "forgot password" flows
   - No email verification or CAPTCHA challenges

2. **Works for AI Agents**
   - AI agents can generate keypairs programmatically
   - No human interaction required (no OAuth flow, no CAPTCHA)
   - Same identity mechanism for agents and humans

3. **End-to-End Cryptographic Provenance**
   - User signs actions with private key
   - Game server verifies signatures with public key
   - No man-in-the-middle trust issues (server can't forge user actions)
   - Aligns with ILP (Interledger Protocol) packet signing (Epic 2)

4. **Portable Identity**
   - Same Nostr keypair works across all Sigil-enabled games
   - Future SpacetimeDB games can recognize the same identity
   - No lock-in to a single server or provider

5. **Key Backup & Recovery**
   - BIP-39 mnemonic seed phrases (12-24 words)
   - Human-readable, easy to write down
   - Restore keypair from seed phrase

6. **Open Protocol**
   - Nostr is an open protocol (not owned by a company)
   - No vendor lock-in (Nostr relays are interchangeable)
   - Aligns with Sigil's open-source philosophy

---

## Consequences

### Positive
- ✅ **Simplicity**: No authentication complexity (no user databases, no OAuth)
- ✅ **AI-friendly**: Agents can generate keypairs without human interaction
- ✅ **Cryptographic provenance**: End-to-end signed actions (NFR10)
- ✅ **Portability**: Same identity across all Sigil-enabled games
- ✅ **Backup**: BIP-39 seed phrases for key recovery

### Negative
- ⚠️ **Unfamiliar to users**: Nostr is niche (most users have never heard of it)
- ⚠️ **Key management complexity**: Users must secure private keys
- ⚠️ **No "forgot password"**: Lost keys = lost identity (irreversible)
- ⚠️ **Onboarding friction**: Users must generate keypairs before playing

### Mitigation Strategies
1. **Key generation UX**: Provide one-click keypair generation (Story 1.2)
2. **Seed phrase backup**: Prompt users to save 12-word seed phrase
3. **Education**: Explain Nostr keypairs in onboarding flow
4. **Testing infrastructure**: Provide test keypairs for development (Docker stack)
5. **Future enhancement**: Hardware wallet support (YubiKey, Ledger) for advanced users

---

## Implementation Details

**Story 1.2: Nostr Identity Management** (2026-02-25)

- ✅ `Keypair.generate()` - Generate new secp256k1 keypair
- ✅ `Keypair.fromSeed()` - Restore from BIP-39 seed phrase
- ✅ `keypair.export()` - Export as JSON file (nsec + npub)
- ✅ `client.loadIdentity()` - Load keypair from JSON file
- ✅ `client.identity.sign()` - Sign Nostr events with private key
- ✅ `client.identity.publicKey` - Access public key (npub format)
- ✅ Private key NEVER exposed via API (security by design)

**File Format:**
```json
{
  "nsec": "nsec1abc...", // Private key (Nostr secret key)
  "npub": "npub1xyz..."  // Public key (Nostr public key)
}
```

---

## NFR Compliance

**NFR9: Private Key Protection**
- Private key NEVER leaves the client (not logged, not sent to server)
- Private key NEVER exposed via `client.identity` API
- Only signing operations are exposed (`client.identity.sign()`)

**NFR10: End-to-End Signed Packets**
- ILP packets signed with Nostr private key (Epic 2 Story 2.3)
- Game server verifies signatures with Nostr public key (Epic 2 Story 2.5)

---

## Integration with Epic 2: Action Execution & Payment Pipeline

Epic 2 extends Nostr identity to the full action execution flow:

1. **Client signs ILP packet** with Nostr private key (Story 2.3)
2. **Crosstown relay** forwards ILP packet to BLS handler (Story 2.1)
3. **BLS handler** verifies Nostr signature (Story 2.4)
4. **BLS handler** extracts Nostr public key from packet (Story 2.5)
5. **SpacetimeDB reducer** receives Nostr public key as argument (Story 2.5)
6. **Game logic** attributes action to Nostr public key (end-to-end provenance)

**Key Insight:** Nostr keypair is the ONLY identity mechanism. No additional authentication layers. The same public key used for signing ILP packets is the identity in-game.

---

## Related Decisions

- **ADR-003**: Polyglot Monorepo (TypeScript for identity management)
- **Epic 2 Story 2.3**: ILP Packet Construction & Signing (uses Nostr keypair)
- **Epic 2 Story 2.5**: Identity Propagation & Verification (Nostr public key in reducers)

---

## References

- **Nostr Protocol Specification (NIP-01)**: https://github.com/nostr-protocol/nips/blob/master/01.md
- **BIP-39 Seed Phrases**: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- **Story 1.2 Report**: `_bmad-output/implementation-artifacts/1-2-nostr-identity-management.md`
- **`nostr-tools` Library**: https://github.com/nbd-wtf/nostr-tools

---

**Status:** ✅ ACCEPTED - Implemented in Epic 1 Story 1.2 (45 tests, 100% pass rate)
**Last Updated:** 2026-02-27 by Charlie (Senior Dev)
