# 16. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SpacetimeDB TS SDK doesn't support all subscription patterns | Medium | High | Prototype subscription layer in Phase 1; fallback to raw WebSocket |
| BitCraft reducer args are complex / undocumented | Medium | Medium | Start with simple reducers (`player_move`, `chat_post_message`); reverse-engineer from Rust source |
| BLS → SpacetimeDB integration requires Crosstown changes | High | Low | This is a small, well-scoped callback handler following the existing `onNIP34Event` pattern |
| Agent LLM costs exceed research budgets | Medium | Medium | Provide `goals-simple` (no LLM) as default; LLM is optional plugin |
| BitCraft game state too large for agent context windows | Medium | High | Subscription filtering + Layer 2 summarization reduces data volume |

---

*This document is a living artifact. Update as decisions are made and implementation reveals new constraints.*

---
