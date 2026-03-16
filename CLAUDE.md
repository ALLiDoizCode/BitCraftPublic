# Sigil SDK - Claude Agent Guide

**Last Updated:** 2026-03-15
**Status:** Epics 1-4 Complete, Epic 5 Next (MVP Development Phase)
**Agent Model:** Claude instance + MCP tools + Skills (NOT custom cognition stack)

---

## Quick Start for Claude Agents

You are a Claude instance working on the **Sigil SDK** platform. Sigil enables AI agents and terminal clients to interact with SpacetimeDB-based game worlds (currently targeting BitCraft v1 as the reference implementation).

**IMPORTANT:** Your full project context is automatically loaded from `_bmad-output/project-context.md`. This guide provides high-level pointers and setup instructions only. Do NOT duplicate information that already exists in project-context.md.

**You MUST read project-context.md before starting any work.** It contains the complete architecture overview, repository structure, epic/story breakdown, test metrics, known issues, code review checklist, naming conventions, team agreements (AGREEMENT-1 through AGREEMENT-13), and documentation index.

---

## Your Role as a Claude Agent

You are NOT building a custom cognition stack. The architecture decision was made to use:

- **Claude instances** (you) with domain knowledge
- **MCP tools** for game perception and action execution
- **Skill files** (standard Claude Agent Skills format with YAML frontmatter)
- **CLAUDE.md** (this file) for project-specific guidance

The Five-Layer Cognition Architecture documented in the architecture was SUPERSEDED by this simpler agent model.

---

## Current Project Status

**Epics 1-4: COMPLETE** (22/22 stories delivered)

**Total Tests:** 1426 passing (1320 TS workspace + 98 root integration + 8 Rust), 242 skipped (require Docker).

**Epic 5: NEXT** -- BitCraft Game Analysis & Playability Validation (8 stories). Server source analysis, game state modeling, game loop mapping, and end-to-end pipeline validation with Docker stack.

**See:** `_bmad-output/project-context.md` for full epic breakdown, story details, deliverables, and known issues/technical debt.

---

## Setup Instructions

### Prerequisites Check

```bash
# Check Node.js version (must be >= 20.0.0)
node --version

# Check pnpm version (must be >= 9.0.0)
pnpm --version

# Check Rust toolchain (must be >= 1.70, for TUI work)
rustc --version

# Check Docker Desktop is running (required for Epic 5)
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

## Essential Commands (Quick Reference)

```bash
# Tests
pnpm test:unit                              # Unit tests (fast, no Docker)
pnpm test:integration                       # Integration tests (requires Docker)
pnpm test                                   # All tests
pnpm --filter @sigil/client test:watch      # TDD watch mode

# Build
pnpm build                                  # Build all TS packages
cd crates/tui && cargo build                # Build Rust TUI

# Docker (full reset)
docker compose -f docker/docker-compose.yml down -v && rm -rf docker/volumes/* && docker compose -f docker/docker-compose.yml up -d

# BMAD
/bmad-bmm-generate-project-context yolo     # Regenerate project context
/bmad-bmm-check-implementation-readiness    # Check readiness for next epic
```

**See:** `_bmad-output/project-context.md` for the complete command reference including per-package test commands, coverage, Docker management, and CI/CD details.

---

## Common Pitfalls

- **Don't duplicate project-context.md** -- It's auto-loaded, no need to repeat its content here or in code comments
- **Don't skip TDD** -- Write tests BEFORE implementation for features with >3 acceptance criteria
- **Don't commit without security review** -- OWASP Top 10 check required on every story

**See:** `_bmad-output/project-context.md` for the full list of team agreements (AGREEMENT-1 through AGREEMENT-13) and the code review checklist.

---

## Getting Help

1. **Read project-context.md first** -- Most answers are there
2. **Check story reports** -- `_bmad-output/implementation-artifacts/` and `_bmad-output/auto-bmad-artifacts/` have comprehensive documentation for all completed stories
3. **Review architecture docs** -- `_bmad-output/planning-artifacts/architecture/` has 22 architecture documents
4. **Check Docker README** -- `docker/README.md` covers Docker issues
5. **Use BMAD workflows** -- `/bmad-bmm-generate-project-context yolo` regenerates context

---

## Next Steps: Epic 5 Preparation

**Epic 5: BitCraft Game Analysis & Playability Validation** (8 stories)

- 5.1: Server Source Analysis & Reducer Catalog
- 5.2: Game State Model & Table Relationships
- 5.3: Game Loop Mapping & Precondition Documentation
- 5.4: Basic Action Round-Trip Validation
- 5.5: Player Lifecycle & Movement Validation
- 5.6: Resource Gathering & Inventory Validation
- 5.7: Multi-Step Crafting Loop Validation
- 5.8: Error Scenarios & Graceful Degradation

**Key Context:**

- Fundamentally different from Epics 1-4: Stories 5.1-5.3 are research/documentation, Stories 5.4-5.8 are validation with Docker stack
- First epic requiring sustained Docker integration testing
- Produces: BitCraft Game Reference doc (`_bmad-output/planning-artifacts/bitcraft-game-reference.md`), reusable integration test fixtures

**Critical Prep Before Starting:**

- PREP-E5-1: Update project context -- DONE
- PREP-E5-2: Verify Docker stack health -- Not started
- PREP-E5-3: Assess BitCraft server source availability -- Not started

**See:** `_bmad-output/project-context.md` for full Epic 5 details, prep items, and risk assessment.
