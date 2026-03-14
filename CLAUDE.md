# Sigil SDK - Claude Agent Guide

**Last Updated:** 2026-03-14
**Status:** Epics 1-3 Complete, Epic 4 Next (MVP Development Phase)
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

**Epics 1-3: COMPLETE** (15/15 stories delivered)

**Total Tests:** 984 passing (879 TS unit + 7 Rust + 98 root integration), 212 skipped (require Docker).

**Epic 4: NEXT** -- Declarative Agent Configuration (7 stories). Client-side configuration, skill file parsing, budget tracking, event interpretation, decision logging.

**See:** `_bmad-output/project-context.md` for full epic breakdown, story details, deliverables, and known issues/technical debt.

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

Integration tests and local development require the Docker stack (3 services: bitcraft-server, crosstown-node, bitcraft-bls):

```bash
# Start all services
docker compose -f docker/docker-compose.yml up -d

# Health check
curl http://localhost:3000/database/bitcraft/info
curl http://localhost:4041/health
curl http://localhost:3001/health

# Run integration tests
pnpm test:integration

# Stop services
docker compose -f docker/docker-compose.yml down
```

**Note:** The `bitcraft-bls` service requires `SPACETIMEDB_ADMIN_TOKEN` to be set in your environment or `.env` file.

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
pnpm --filter @sigil/bitcraft-bls test      # BLS handler tests
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
docker compose -f docker/docker-compose.yml logs -f bitcraft-bls  # BLS handler logs
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

- **Don't duplicate project-context.md** -- It's auto-loaded, no need to repeat its content here or in code comments
- **Don't skip TDD** -- Write tests BEFORE implementation for features with >3 acceptance criteria
- **Don't commit without security review** -- OWASP Top 10 check required on every story
- **Execute retro action items** -- All action items from retrospectives must be completed within the next epic (AGREEMENT-9)
- **No placeholder tests without tracking** -- Integration test placeholders must be tracked with test name, purpose, dependencies, and effort estimate (AGREEMENT-10)
- **Dead code gets 1-epic grace period** -- Exported code with zero production consumers must be integrated or removed after one epic (AGREEMENT-11)

**See:** `_bmad-output/project-context.md` for the full list of team agreements (AGREEMENT-1 through AGREEMENT-11) and the code review checklist.

---

## Getting Help

1. **Read project-context.md first** -- Most answers are there
2. **Check story reports** -- `_bmad-output/implementation-artifacts/` and `_bmad-output/auto-bmad-artifacts/` have comprehensive documentation for all completed stories
3. **Review architecture docs** -- `_bmad-output/planning-artifacts/architecture/` has 22 architecture documents
4. **Check Docker README** -- `docker/README.md` covers Docker issues
5. **Use BMAD workflows** -- `/bmad-bmm-generate-project-context yolo` regenerates context

---

## Next Steps: Epic 4 Preparation

**Epic 4: Declarative Agent Configuration** (7 stories)

- 4.1: Skill File Format & Parser
- 4.2: Agent.md Configuration & Skill Selection
- 4.3: Configuration Validation Against SpacetimeDB
- 4.4: Budget Tracking & Limits
- 4.5: Event Interpretation as Semantic Narratives
- 4.6: Structured Decision Logging
- 4.7: Swappable Agent Configuration

**Key Context:**

- Client-side configuration and parsing logic (lower risk than Epic 3's server-side work)
- Skill files produce `{ reducer, args }` payloads consumed by BLS handler (Story 3.2)
- Pricing model compatible: action cost registry (Story 2.2) + fee schedule (Story 3.3)
- Preparation tasks from Epic 3 retro must be completed first: PREP-E4-1 through PREP-E4-5

**Critical Prep Before Starting:**

- PREP-E4-1: Complete deferred Epic 2/3 action items (4 of 8 Epic 2 retro commitments unaddressed)
- PREP-E4-2: Clean up dead code from Epic 3 (verifyIdentityChain, logVerificationEvent)
- PREP-E4-3: Research SKILL.md file format

**See:** `_bmad-output/project-context.md` for full Epic 4 details, prep items, and risk assessment.
