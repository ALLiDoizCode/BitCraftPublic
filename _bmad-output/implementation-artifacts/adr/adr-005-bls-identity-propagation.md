# ADR-005: BLS Identity Propagation -- Modify BitCraft Reducers

**Status:** Accepted
**Date:** 2026-03-17 (Resolves BLOCKER-1, open since Story 2.4)
**Deciders:** Jonathan (Project Lead), Alice (Product Owner), Charlie (Senior Dev)

---

## Context

BLOCKER-1 has been the longest-standing unresolved issue in the Sigil SDK project, open since Story 2.4 (Epic 2) and confirmed during Story 5.1 (Epic 5). The issue concerns how player identity is propagated through the write pipeline:

```
Agent/Player -> client.publish() -> @crosstown/client -> BLS handler -> SpacetimeDB reducer
```

The BLS (BitCraft Login Server) handler receives game action events via the Crosstown relay. When dispatching to SpacetimeDB reducers, the handler prepends the caller's Nostr pubkey (64-char hex) as the first argument to the reducer call (`handler.ts` line 106-107):

```typescript
// 5. Prepend ctx.pubkey as first argument (identity propagation)
const argsWithIdentity: unknown[] = [ctx.pubkey, ...args];
```

However, BitCraft reducers do not accept an explicit identity parameter. They resolve the caller's identity via `ctx.sender` through `game_state::actor_id()`, which returns the SpacetimeDB connection identity -- not the Nostr pubkey. Since the BLS handler uses a single service account connection to SpacetimeDB, all reducer calls appear to come from the same identity regardless of which player initiated the action.

This incompatibility caused all 129 Epic 5 integration tests to bypass BLS entirely, connecting directly to SpacetimeDB via WebSocket. While this workaround enabled full gameplay validation (player lifecycle, movement, resource gathering, crafting, error scenarios), the production publish pipeline (`client.publish()`) remains unvalidated end-to-end.

The issue is on the critical path for Epic 6 (MCP Server for AI Agents), where MCP tools will expose `client.publish()` to AI agents. Without resolution, MCP tools would need the same direct WebSocket bypass -- acceptable for local development but not for production agents.

---

## Problem Statement

We need an identity propagation mechanism that:

1. **Correctly identifies the calling player** in BitCraft reducers when actions are routed through BLS
2. **Works with SpacetimeDB 1.6.x** (no custom context injection available)
3. **Is compatible with the existing BLS prepend strategy** (already implemented and tested)
4. **Does not require SpacetimeDB server modifications** (we control only the game module, not the database engine)
5. **Unblocks the full publish pipeline** for Epic 6 MCP tools and beyond

---

## Options Considered

### Option A: HTTP Header-Based Identity Injection

**Approach:** Pass the Nostr pubkey via a custom HTTP header (e.g., `X-Sigil-Identity`) and have SpacetimeDB make it available to reducers through a context extension.

**Pros:**

- Clean separation (identity stays out of reducer arguments)
- No reducer signature changes needed
- Standard HTTP pattern

**Cons:**

- **Blocked by SpacetimeDB v1.6.x** -- the database engine does not support custom context injection or custom HTTP headers on reducer calls
- Would require upstream SpacetimeDB changes (out of our control)
- No known timeline for this capability in SpacetimeDB

**Verdict:** Not viable with current infrastructure.

---

### Option B: Modify BitCraft Reducers for Explicit Identity (CHOSEN)

**Approach:** Add `caller_identity: String` (Nostr pubkey hex) as the first parameter to all player-facing reducers. Modify `game_state::actor_id()` to resolve the player from this explicit parameter instead of `ctx.sender`.

**Pros:**

- **Straightforward implementation** -- well-understood Rust changes to reducer signatures
- **No SpacetimeDB server changes** -- works within the existing 1.6.x module API
- **BLS handler already implements the prepend** -- `handler.ts` line 107 already prepends `ctx.pubkey` as the first argument; reducers just need to accept it
- **13 identity propagation tests already exist** in Epic 3 (`identity-prepend.test.ts`)
- **Clear scope** -- ~200+ player-facing reducers of 669 total need the parameter (admin/migration reducers do not)

**Cons:**

- BitCraft server becomes a modified fork (no longer "run unmodified")
- ~200+ reducer signatures must be updated (mechanical but labor-intensive)
- `game_state::actor_id()` needs modification to resolve from the parameter
- Tight coupling between BLS handler and reducer signature convention

---

### Option C: Per-Player SpacetimeDB Tokens

**Approach:** Create a unique SpacetimeDB connection/token for each player identity. The BLS handler maintains a connection pool, routing each player's reducer calls through their dedicated connection so that `ctx.sender` resolves correctly.

**Pros:**

- No reducer modifications needed
- `ctx.sender` works as designed
- Clean identity model

**Cons:**

- **Operational complexity** -- connection pool management, token lifecycle, memory overhead
- **Scaling concerns** -- one WebSocket connection per active player through BLS
- **Token management** -- must create, cache, and expire tokens per Nostr identity
- **Architectural mismatch** -- BLS is a stateless handler; connection pools make it stateful

**Verdict:** Adds significant operational complexity for a problem that can be solved more simply.

---

### Option D: Proxy Identity Mapping Layer

**Approach:** Add an intermediary service that maps Nostr pubkeys to SpacetimeDB identities, managing a registry of identity translations.

**Pros:**

- Decouples identity systems
- No reducer modifications

**Cons:**

- **Adds a new service** to the Docker stack (more infrastructure to maintain)
- **Still requires identity injection** into reducers (same fundamental problem)
- **Mapping complexity** -- maintaining a bidirectional registry between Nostr pubkeys and SpacetimeDB identities
- **Latency** -- additional network hop for every reducer call

**Verdict:** Adds complexity to the BLS handler without solving the fundamental `ctx.sender` problem.

---

## Decision

**We chose Option B: Modify BitCraft reducer signatures to accept `caller_identity: String` (Nostr pubkey hex) as the first parameter.**

Reducers will use this explicit identity parameter instead of `ctx.sender` for player resolution. The `game_state::actor_id()` function will be modified to accept and resolve the Nostr pubkey from the parameter.

This decision formally supersedes the "Run BitCraft Unmodified" design principle, which was already documented as superseded in Story 2.4 and the Epic 2 retrospective.

---

## Rationale

1. **BLS Handler Already Implements the Prepend**
   - `handler.ts` line 106-107 already prepends `ctx.pubkey` as the first argument to all reducer calls
   - 13 identity propagation tests in Epic 3 validate this behavior (`identity-prepend.test.ts`, `handler-dispatch.test.ts`, `handler-e2e-integration.test.ts`)
   - The client side is done; only the server side needs to accept the parameter

2. **No SpacetimeDB Server Changes Required**
   - We control the BitCraft game module (Rust reducers) but not the SpacetimeDB database engine
   - Option B works within the existing SpacetimeDB 1.6.x module API
   - Options A and D both require capabilities not available in the current infrastructure

3. **"Run Unmodified" Was Already Superseded**
   - The design principle was documented as superseded in Story 2.4 report and Epic 2 retrospective
   - BitCraft is an Apache 2.0 fork -- modifications are legally permitted
   - The principle served its purpose during initial architecture (minimizing risk) but became a blocker as the project matured

4. **Unblocks Critical Path**
   - Epic 6 (MCP Server) MCP tools use `client.publish()` which routes through BLS
   - 80 BLS placeholder tests from Epic 3 can be converted to real integration tests
   - 129 Epic 5 integration tests can be updated to test through the full BLS pipeline
   - DEBT-E5-5 (wallet stub mode) can be resolved once the pipeline works end-to-end

5. **Effort Is Mechanical, Not Architectural**
   - Adding a `caller_identity: String` first parameter to ~200+ reducers is repetitive but low-risk
   - `game_state::actor_id()` modification is a single function change with clear semantics
   - Test-first approach: validate with a few key reducers before bulk migration

---

## Consequences

### Positive

- The full publish pipeline (`client.publish()` -> Crosstown -> BLS -> SpacetimeDB) becomes functional end-to-end
- Epic 6 MCP tools can use the production write path without direct WebSocket bypass
- 80 BLS placeholder tests from Epic 3 (`pipeline-integration.test.ts`, `handler-e2e-integration.test.ts`) can be converted to real integration tests
- 129 Epic 5 integration tests can optionally be updated to validate through BLS
- BLOCKER-1 (open since Story 2.4) is resolved after 4 epics
- Clean architectural alignment: BLS handler prepends identity, reducers consume identity

### Negative

- BitCraft server is now an Apache 2.0 fork with modifications (legal risk remains low under Apache 2.0 license terms)
- ~200+ player-facing reducers (of 669 total) need `caller_identity: String` as first parameter
- `game_state::actor_id()` needs modification to resolve identity from the explicit parameter instead of `ctx.sender`
- The "Run BitCraft Unmodified" design principle is formally retired
- Ongoing maintenance burden: future BitCraft upstream changes must be manually merged with the identity parameter modifications
- Tight coupling between BLS prepend convention and reducer signature convention (if one changes, the other must follow)

### Mitigation Strategies

1. **Test-first approach**: Validate with 3-5 key reducers (player creation, movement, resource gathering) before bulk migration
2. **Automated migration**: Script the mechanical reducer signature changes where possible
3. **Admin/migration reducers excluded**: Only player-facing reducers (~200+) need the parameter; admin and migration reducers continue using `ctx.sender`
4. **Integration test validation**: Use existing Epic 5 integration tests to verify each modified reducer works through the full pipeline
5. **Document fork differences**: Maintain a changelog of all BitCraft modifications for future upstream merge assessment

---

## Implementation Scope

### Server-Side Changes (BitCraft Rust Module)

1. **`game_state::actor_id()` modification** -- Accept `caller_identity: String` parameter, resolve player from Nostr pubkey instead of `ctx.sender`
2. **Player-facing reducer signatures** (~200+ of 669) -- Add `caller_identity: String` as first parameter
3. **Admin/migration reducers** -- No changes (continue using `ctx.sender`)
4. **Validation** -- Each modified reducer must pass through the full BLS pipeline in integration tests

### Client-Side Changes (Already Complete)

1. **BLS handler** -- Already prepends `ctx.pubkey` as first argument (`handler.ts` line 107)
2. **Identity prepend tests** -- 13 tests already validate the prepend behavior (Epic 3)
3. **No changes needed** to `@sigil/client`, `@crosstown/client`, or `@sigil/mcp-server`

### Test Infrastructure Updates

1. **Convert 80 BLS placeholder tests** from Epic 3 to real integration tests
2. **Optionally update 129 Epic 5 integration tests** to validate through BLS (or maintain both direct and BLS test paths)
3. **New integration tests** for the modified `game_state::actor_id()` function

---

## Related Decisions

- **ADR-001**: SpacetimeDB 2.0 SDK on 1.6.x Servers (SDK version unaffected by this change)
- **ADR-002**: Nostr Keypair as Sole Identity Mechanism (Nostr pubkey is the identity being propagated)
- **ADR-004**: Docker-Based Development Environment (BLS handler is the third Docker service)
- **Story 2.4**: BLS Game Action Handler (where BLOCKER-1 was first identified)
- **Story 5.1**: Server Source Analysis (where BLOCKER-1 was confirmed via reducer source analysis)
- **Epic 5 Retrospective**: Documents BLOCKER-1 as the longest-standing unresolved issue

---

## References

- **BLOCKER-1 Documentation**: `_bmad-output/project-context.md` (DEBT-E5-1 / BLOCKER-1 section)
- **BLS Handler Implementation**: `packages/bitcraft-bls/src/handler.ts` (line 106-107, identity prepend)
- **Identity Prepend Tests**: `packages/bitcraft-bls/src/__tests__/identity-prepend.test.ts`
- **Epic 5 Retrospective**: `_bmad-output/auto-bmad-artifacts/epic-5-retro-2026-03-17.md`
- **Story 2.4 Report**: `_bmad-output/auto-bmad-artifacts/story-2-4-report.md`
- **BitCraft Game Reference**: `_bmad-output/planning-artifacts/bitcraft-game-reference.md`
- **Epic 5 End Report**: `_bmad-output/auto-bmad-artifacts/epic-5-end-report.md`

---

**Status:** ACCEPTED - Resolves BLOCKER-1 (open since Story 2.4, Epic 2)
**Last Updated:** 2026-03-17 by Charlie (Senior Dev)
