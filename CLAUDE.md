# Sigil SDK - Claude Agent Guide

**Last Updated:** 2026-03-13
**Status:** Epics 1-2 Complete, Epic 3 Next (MVP Development Phase)
**Agent Model:** Claude instance + MCP tools + Skills (NOT custom cognition stack)

---

## Quick Start for Claude Agents

You are a Claude instance working on the **Sigil SDK** platform. Sigil enables AI agents and terminal clients to interact with SpacetimeDB-based game worlds (currently targeting BitCraft v1 as the reference implementation).

**IMPORTANT:** Your full project context is automatically loaded from `_bmad-output/project-context.md`. This guide provides high-level pointers and setup instructions only. Do NOT duplicate information that already exists in project-context.md.

---

## What You Need to Know

### 1. Project Context is Auto-Loaded

The comprehensive project context document (`_bmad-output/project-context.md`) is automatically loaded by BMAD workflows. It contains:

- Complete architecture overview and repository structure
- Epic and story breakdown with progress tracking
- Technology stack and dependencies
- Test coverage metrics and quality standards
- Known issues and technical debt
- Code review checklist (OWASP, TypeScript safety, Rust safety)
- Naming conventions, API patterns, and team agreements
- Documentation index (planning artifacts, story reports, ADRs)

**You MUST read project-context.md before starting any work.**

### 2. Your Role as a Claude Agent

You are NOT building a custom cognition stack. The architecture decision was made to use:

- **Claude instances** (you) with domain knowledge
- **MCP tools** for game perception and action execution
- **Skill files** (standard Claude Agent Skills format with YAML frontmatter)
- **CLAUDE.md** (this file) for project-specific guidance

The Five-Layer Cognition Architecture documented in the architecture was SUPERSEDED by this simpler agent model.

### 3. Current Project Status

**Epic 1: COMPLETE** (6/6 stories) -- Project foundation, identity, Docker, SpacetimeDB, static data, reconnection.

**Epic 2: COMPLETE** (5/5 stories) -- Nostr relay client, action cost registry, wallet client, ILP packets, BLS contract spec, `@crosstown/client` integration.

**Total Tests:** 651 passing (641 TS unit + 7 Rust + 3 root integration), 103 integration tests skipped (require Docker).

**Epic 3: NEXT** -- BitCraft BLS Game Action Handler (4 stories). Implements the BLS handler per the integration contract spec'd in Story 2.4.

**See:** `_bmad-output/project-context.md` for full epic breakdown, story details, and deliverables.

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

# Health check
curl http://localhost:3000/database/bitcraft/info
curl http://localhost:4041/health

# Run integration tests
pnpm test:integration

# Stop services
docker compose -f docker/docker-compose.yml down
```

**See:** `docker/README.md` for detailed Docker setup, troubleshooting, and advanced usage.

---

## Development Commands

### Running Tests

```bash
# From repository root:
pnpm test:unit                              # Unit tests (fast, no Docker)
pnpm test:integration                       # Integration tests (requires Docker)
pnpm test                                   # All tests
pnpm test:coverage                          # Generate coverage report
pnpm --filter @sigil/client test:unit       # Client-only unit tests
pnpm --filter @sigil/client test:watch      # TDD watch mode
pnpm smoke:bls                              # BLS handler smoke test (requires Docker + BLS handler)
```

### Building

```bash
pnpm build                                  # Build all TS packages
cd crates/tui && cargo build                # Build Rust TUI
cd crates/tui && cargo clippy               # Lint Rust
```

### Docker Stack Management

```bash
docker compose -f docker/docker-compose.yml up -d       # Start
docker compose -f docker/docker-compose.yml ps           # Status
docker compose -f docker/docker-compose.yml logs -f bitcraft-server  # Logs
docker compose -f docker/docker-compose.yml restart      # Restart
docker compose -f docker/docker-compose.yml down -v && rm -rf docker/volumes/* && docker compose -f docker/docker-compose.yml up -d  # Full reset
```

### BMAD Workflow Commands

```bash
# Generate fresh project context
/bmad-bmm-generate-project-context yolo

# Check implementation readiness for next epic
/bmad-bmm-check-implementation-readiness

# Other BMAD commands are available via /help
```

---

## Common Pitfalls

- **Don't duplicate project-context.md** -- It's auto-loaded, no need to repeat its content
- **Don't skip TDD** -- Write tests BEFORE implementation for features with >3 acceptance criteria (AGREEMENT-1)
- **Don't commit without security review** -- OWASP Top 10 check required on every story (AGREEMENT-2)
- **BitCraft reducer modifications are scoped** -- Reducers will be modified to accept `nostr_pubkey: String` as first parameter for identity propagation (decided in Story 2.4, BLOCKER-1). All other BitCraft server code runs unmodified.
- **Pair on unfamiliar tech** -- Nostr, ILP, BLS require pair programming or pair review (AGREEMENT-3)
- **Track technical debt** -- Deferred work must be captured and linked in story docs (AGREEMENT-4)

---

## Getting Help

1. **Read project-context.md first** -- Most answers are there
2. **Check story reports** -- `_bmad-output/implementation-artifacts/` has comprehensive documentation for all completed stories
3. **Review architecture docs** -- `_bmad-output/planning-artifacts/architecture/` has 22 architecture documents
4. **Check Docker README** -- `docker/README.md` covers Docker issues
5. **Use BMAD workflows** -- `/bmad-bmm-generate-project-context yolo` regenerates context

---

## Next Steps: Epic 3 Preparation

**Epic 3: BitCraft BLS Game Action Handler** (4 stories)

- 3.1: BLS Package Setup & Crosstown SDK Node
- 3.2: Game Action Handler (kind 30078)
- 3.3: Pricing Configuration & Fee Schedule
- 3.4: Identity Propagation & End-to-End Verification

**Key Context:**

- Integration contract is fully spec'd in Story 2.4 (`docs/bls-handler-contract.md`, `docs/crosstown-bls-implementation-spec.md`)
- This is the first server-side component (high risk -- new infrastructure)
- Requires modifying BitCraft reducers to accept `identity: String` as first parameter
- Wallet balance checks and ILP fee deduction are EVM onchain (out of Sigil scope)

**See:** `_bmad-output/project-context.md` for full Epic 3 details and risk assessment.
