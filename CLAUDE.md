# Sigil SDK - Claude Agent Guide

**Last Updated:** 2026-02-27
**Status:** Epic 1 Complete (MVP Development Phase)
**Agent Model:** Claude instance + MCP tools + Skills (NOT custom cognition stack)

---

## Quick Start for Claude Agents

You are a Claude instance working on the **Sigil SDK** platform. Sigil enables AI agents and terminal clients to interact with SpacetimeDB-based game worlds (currently targeting BitCraft v1 as the reference implementation).

**IMPORTANT:** Your full project context is automatically loaded from `_bmad-output/project-context.md`. This guide provides high-level pointers and setup instructions only. Do NOT duplicate information that already exists in project-context.md.

---

## What You Need to Know

### 1. Project Context is Auto-Loaded

The comprehensive project context document (`_bmad-output/project-context.md`) is automatically loaded by BMAD workflows. It contains:

- Complete architecture overview
- Epic and story breakdown
- Technology stack details
- Repository structure
- Test coverage metrics
- Known issues and technical debt
- Development workflow instructions
- Documentation index

**You MUST read project-context.md before starting any work.**

### 2. Your Role as a Claude Agent

You are NOT building a custom cognition stack. The architecture decision was made to use:

- **Claude instances** (you) with domain knowledge
- **MCP tools** for game perception and action execution
- **Skill files** (standard Claude Agent Skills format with YAML frontmatter)
- **CLAUDE.md** (this file) for project-specific guidance

The Five-Layer Cognition Architecture documented in the architecture was SUPERSEDED by this simpler agent model.

### 3. Current Project Status

**Epic 1: COMPLETE** (6/6 stories, 937 tests passing)

- Monorepo scaffolding (TypeScript + Rust)
- Nostr keypair identity management
- Docker development environment (BitCraft + Crosstown)
- SpacetimeDB connection and subscriptions
- Static data table loading (40/148 tables)
- Auto-reconnection with state recovery

**Epic 2: PREPARATION PHASE** (5 prep tasks before kickoff)

- ✅ Complete subscription recovery (PREP-1)
- ✅ Validate Linux compatibility (PREP-2) - CI now runs on Ubuntu + macOS
- Must research Crosstown protocols (PREP-4)
- Must spike BLS handler architecture (PREP-5)

**See:** `_bmad-output/implementation-artifacts/epic-1-retro-2026-02-27.md` for full retrospective and prep task details.

---

## Setup Instructions

### Prerequisites Check

Before starting development, verify:

```bash
# Check Node.js version (must be >= 20.0.0)
node --version

# Check pnpm version (must be >= 9.0.0)
pnpm --version

# Check Rust toolchain (must be >= 1.70, for TUI work)
rustc --version

# Check Docker Desktop is running
docker info
```

### Initial Setup

```bash
# From repository root
cd /Users/jonathangreen/Documents/BitCraftPublic

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run unit tests (no Docker required)
pnpm test:unit
```

### Docker Stack Setup

Integration tests and local development require the Docker stack:

```bash
# Start BitCraft server + Crosstown node
docker compose -f docker/docker-compose.yml up -d

# Verify services are healthy
docker compose -f docker/docker-compose.yml ps

# View BitCraft server logs
docker compose -f docker/docker-compose.yml logs -f bitcraft-server

# Health check
curl http://localhost:3000/database/bitcraft/info
curl http://localhost:4041/health

# Run integration tests (127 tests)
pnpm test:integration

# Stop services
docker compose -f docker/docker-compose.yml down
```

**See:** `docker/README.md` for detailed Docker setup, troubleshooting, and advanced usage.

---

## Development Workflow

### Working on TypeScript Packages

```bash
# Client library (@sigil/client)
cd packages/client
pnpm test:watch        # TDD watch mode
pnpm build             # Build dist/

# MCP server (@sigil/mcp-server) - Future Epic 4
cd packages/mcp-server
# (placeholder only)

# TUI backend (@sigil/tui-backend) - Future Epic 5
cd packages/tui-backend
# (placeholder only)
```

### Working on Rust Code

```bash
# TUI (sigil-tui)
cd crates/tui
cargo build            # Build binary
cargo test             # Run tests
cargo clippy           # Lint
```

### Running Tests

```bash
# From repository root:
pnpm test:unit         # 810 unit tests (fast, no Docker)
pnpm test:integration  # 127 integration tests (requires Docker)
pnpm test              # All tests
pnpm test:coverage     # Generate coverage report
```

### BMAD Workflow Commands

You have access to BMAD (Build-Measure-Analyze-Deploy) workflow skills:

```bash
# Generate fresh project context
/bmad-bmm-generate-project-context yolo

# Check implementation readiness for next epic
/bmad-bmm-check-implementation-readiness

# Other BMAD commands are available via /help
```

---

## Key Conventions

### Naming Conventions

**TypeScript:**

- Files: `kebab-case.ts`
- Functions/variables: `camelCase`
- Types/interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

**Rust:**

- Files: `snake_case.rs`
- Functions/variables: `snake_case`
- Types/structs: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

**Cross-Language:**

- JSON fields (IPC): `camelCase`
- MCP tool names: `snake_case`
- Rust serde: `#[serde(rename_all = "camelCase")]`

### API Patterns

**Client API Design:**

```typescript
// Identity (Story 1.2)
await client.loadIdentity('/path/to/keypair.json');
const publicKey = client.identity.publicKey.npub; // npub1abc...
const signedEvent = await client.identity.sign(eventTemplate);

// SpacetimeDB Read Access (Story 1.4)
client.spacetimedb.tables.players.onInsert((player) => { ... });
const allPlayers = client.spacetimedb.tables.players.getAll();

// Static Data (Story 1.5)
const staticData = await client.spacetimedb.staticData.load();
const item = staticData.itemDesc.get(itemId);

// Write Path (Future Epic 2)
await client.publish({ reducer: 'move_player', args: [x, y] });
```

### Testing Patterns

**Test-Driven Development (TDD):**

- **AGREEMENT-1:** Write tests BEFORE implementation for features with >3 acceptance criteria
- Co-located tests: `*.test.ts` for TypeScript, `#[cfg(test)]` for Rust
- Test names: Descriptive (what is tested, expected outcome)
- Traceability: AC → Test mapping documented in story reports

**See:** Epic 1 retrospective (AGREEMENT-1) for TDD adoption rationale.

---

## Common Tasks

### Adding a New Reducer Call (Epic 2+)

1. Define the reducer signature in skill file (YAML frontmatter + markdown)
2. Add ILP cost to action cost registry
3. Update `client.publish()` to support the reducer
4. Write tests BEFORE implementation
5. Document in story report with traceability

### Adding a New Table Subscription (Epic 2+)

1. Add table to static data loader if it's a `*_desc` table
2. Update `client.spacetimedb.tables` with typed access
3. Wire up `onInsert`/`onUpdate`/`onDelete` callbacks
4. Write integration test (requires Docker)
5. Document subscription recovery behavior

### Debugging Docker Stack Issues

```bash
# Check service health
docker compose -f docker/docker-compose.yml ps

# View logs
docker compose -f docker/docker-compose.yml logs bitcraft-server
docker compose -f docker/docker-compose.yml logs crosstown-node

# Restart services
docker compose -f docker/docker-compose.yml restart

# Full reset (WARNING: deletes persistent data)
docker compose -f docker/docker-compose.yml down -v
rm -rf docker/volumes/*
docker compose -f docker/docker-compose.yml up -d
```

**See:** `docker/README.md` for comprehensive troubleshooting.

---

## Security & Code Review

### Security Checklist (AGREEMENT-2)

Every story MUST pass OWASP Top 10 review before "done":

- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all external data (WebSocket, IPC, file paths)
- [ ] Path traversal prevention (Docker volumes, file I/O)
- [ ] Rate limiting on public endpoints (Nostr relay, MCP tools)
- [ ] Dependency vulnerabilities checked (`pnpm audit`, `cargo audit`)

### Code Review Standards

- No `any` types in TypeScript (use `unknown` or specific types)
- No `unsafe` blocks in Rust (unless justified and documented)
- Error handling required (try/catch, Result<T, E>)
- Test traceability documented (AC → Test mapping)

**See:** `_bmad-output/project-context.md` → "Code Review Checklist" for full checklist.

---

## Documentation References

### Planning Artifacts

- **Epics:** `_bmad-output/planning-artifacts/epics.md` (11 epics, 50 stories)
- **Architecture:** `_bmad-output/planning-artifacts/architecture/index.md` (14 architecture docs)
- **PRD:** `_bmad-output/planning-artifacts/prd/index.md` (archived, superseded by architecture)

### Implementation Artifacts (Epic 1)

- **Sprint Status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Retrospective:** `_bmad-output/implementation-artifacts/epic-1-retro-2026-02-27.md`
- **Story Reports:** `_bmad-output/implementation-artifacts/1-{1-6}-*.md` (6 completed stories)
- **Test Traceability:** `_bmad-output/implementation-artifacts/reports/` (AC → Test mapping)

### Setup Guides

- **Docker:** `docker/README.md`
- **Client Library:** `packages/client/README.md` (future)
- **Project Context:** `_bmad-output/project-context.md` (auto-loaded by BMAD)

---

## Team Agreements (Epic 1 Retrospective)

**AGREEMENT-1: Test-First for Complex Features**
For features with >3 acceptance criteria, write tests before implementation.

**AGREEMENT-2: Security Review on Every Story**
Every story must pass OWASP Top 10 review before marking "done". No exceptions.

**AGREEMENT-3: Pair on Unfamiliar Technologies**
When working with new tech (Nostr, ILP, BLS), pair programming or pair review is mandatory.

**AGREEMENT-4: Technical Debt Tracking**
Any deferred work must be captured as GitHub issues and linked in story documentation.

**AGREEMENT-5: Integration Test Documentation**
Integration tests requiring Docker must have clear setup instructions and graceful failure messages.

**See:** `_bmad-output/implementation-artifacts/epic-1-retro-2026-02-27.md` for full team agreements.

---

## Known Limitations & Technical Debt

### Critical (Blocks Epic 2)

**DEBT-1: Complete Story 1.6 Subscription Recovery**
Subscription re-subscribe logic after reconnection is stubbed. Must complete before Epic 2 (PREP-1).

### Medium Priority

**DEBT-2: Load Remaining 108 Static Data Tables**
Only 40/148 static data tables loaded. May block Epic 3-4 agent skills.

**DEBT-3: Add Linux Integration Test Coverage**
Epic 1 tested on macOS only. Linux validation required before Epic 2 (PREP-2).

**See:** `_bmad-output/project-context.md` → "Known Issues & Technical Debt" for full list and mitigation plans.

---

## Getting Help

### When Stuck

1. **Read project-context.md first** - Most answers are there
2. **Check story reports** - Completed work has comprehensive documentation
3. **Review architecture docs** - 14 architecture documents in `_bmad-output/planning-artifacts/architecture/`
4. **Check Docker README** - Docker issues covered in `docker/README.md`
5. **Use BMAD workflows** - `/bmad-bmm-generate-project-context yolo` regenerates context

### Common Pitfalls

- **Don't duplicate project-context.md** - It's auto-loaded, no need to repeat
- **Don't skip TDD** - Epic 1 proved TDD reduces defects (AGREEMENT-1)
- **Don't commit without security review** - OWASP Top 10 check required (AGREEMENT-2)
- **Don't assume Linux works** - macOS-only testing so far (DEBT-3)
- **Don't modify BitCraft server** - Runs unmodified (design principle)

---

## Next Steps for Epic 2

Before starting Epic 2 implementation, complete these prep tasks:

1. **PREP-1:** Complete Story 1.6 Task 5 (subscription recovery) - 8 hours
2. **PREP-2:** Validate Linux compatibility - 4 hours
3. **PREP-4:** Research Crosstown Nostr relay protocol - 4 hours
4. **PREP-5:** Spike BLS handler architecture - 6 hours
5. **ACTION-1:** Establish integration test strategy - 2 hours

**Total Prep Effort:** 24 hours (3 days at 8 hours/day)

**See:** Epic 1 retrospective for prep task details and acceptance criteria.

---

## Questions?

This guide intentionally keeps details minimal to avoid duplicating project-context.md. For comprehensive information:

- **Project Context:** `_bmad-output/project-context.md` (auto-loaded)
- **Architecture:** `_bmad-output/planning-artifacts/architecture/index.md`
- **Epics:** `_bmad-output/planning-artifacts/epics.md`
- **Docker Setup:** `docker/README.md`
- **Retrospective:** `_bmad-output/implementation-artifacts/epic-1-retro-2026-02-27.md`

**Happy coding!**
