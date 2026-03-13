# 13. Technology Choices

| Component              | Choice              | Package | Rationale                                                         |
| ---------------------- | ------------------- | ------- | ----------------------------------------------------------------- |
| **Language**           | TypeScript          | — | SpacetimeDB TS SDK + Crosstown compatibility; researcher-friendly |
| **Package Manager**    | pnpm workspaces     | — | Matches Crosstown; efficient monorepo support                     |
| **Build**              | tsup                | — | Fast, zero-config TypeScript bundler (matches Crosstown)          |
| **Test**               | vitest              | — | Fast, TypeScript-native (matches Crosstown)                       |
| **SpacetimeDB Client** | `@spacetimedb/sdk`  | `@sigil/client` | Official TypeScript SDK                                           |
| **Crosstown Client**   | `@crosstown/client@^0.4.2` | `@sigil/client` | ILP micropayments, TOON encoding, payment channels, multi-hop routing ([npm](https://www.npmjs.com/package/@crosstown/client), [source](https://github.com/ALLiDoizCode/crosstown/tree/main/packages/client)) |
| **Crosstown SDK**      | `@crosstown/sdk@^0.1.4` | `packages/bitcraft-bls` | Crosstown node builder for BLS — handler dispatch, signature verification (`createVerificationPipeline`), pricing enforcement (`createPricingValidator`), embedded connector mode ([npm](https://www.npmjs.com/package/@crosstown/sdk), [source](https://github.com/ALLiDoizCode/crosstown/tree/main/packages/sdk)) |
| **Crosstown Relay**    | `@crosstown/relay`  | `@sigil/client` | TOON binary encoding/decoding (`encodeEventToToon`/`decodeEventFromToon`) |
| **Nostr**              | `nostr-tools`       | `@sigil/client` | Event signing, key management (already a Crosstown dep)           |
| **Crypto (BLS)**       | `@noble/curves`, `@noble/hashes` | via `@crosstown/sdk` | secp256k1 Schnorr signature verification, SHA256 event ID computation |
| **LLM**                | Provider-agnostic   | — | OpenAI SDK + Anthropic SDK as optional peer deps                  |
| **Vector DB**          | ChromaDB (default)  | — | Local-first, easy setup for researchers                           |
| **Logging**            | JSONL files         | — | Simple, streamable, analyzable with standard tools                |
| **Config**             | YAML                | — | Human-readable experiment configuration                           |

---
