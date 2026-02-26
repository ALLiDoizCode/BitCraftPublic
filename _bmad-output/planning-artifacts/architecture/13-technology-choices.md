# 13. Technology Choices

| Component              | Choice              | Rationale                                                         |
| ---------------------- | ------------------- | ----------------------------------------------------------------- |
| **Language**           | TypeScript          | SpacetimeDB TS SDK + Crosstown compatibility; researcher-friendly |
| **Package Manager**    | pnpm workspaces     | Matches Crosstown; efficient monorepo support                     |
| **Build**              | tsup                | Fast, zero-config TypeScript bundler (matches Crosstown)          |
| **Test**               | vitest              | Fast, TypeScript-native (matches Crosstown)                       |
| **SpacetimeDB Client** | `@spacetimedb/sdk`  | Official TypeScript SDK                                           |
| **Crosstown Client**   | `@crosstown/client` | Existing ILP payment + Nostr event publishing                     |
| **Nostr**              | `nostr-tools`       | Event signing, key management (already a Crosstown dep)           |
| **LLM**                | Provider-agnostic   | OpenAI SDK + Anthropic SDK as optional peer deps                  |
| **Vector DB**          | ChromaDB (default)  | Local-first, easy setup for researchers                           |
| **Logging**            | JSONL files         | Simple, streamable, analyzable with standard tools                |
| **Config**             | YAML                | Human-readable experiment configuration                           |

---
