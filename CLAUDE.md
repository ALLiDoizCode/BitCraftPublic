# Sigil SDK - Claude Agent Guide

**Last Updated:** 2026-03-17
**Status:** Epics 1-5 Complete, Epic 6 Next (MVP Development Phase)
**Agent Model:** Claude instance + MCP tools + Skills (NOT custom cognition stack)

---

## Quick Start for Claude Agents

You are a Claude instance working on the **Sigil SDK** platform. Sigil enables AI agents and terminal clients to interact with SpacetimeDB-based game worlds (currently targeting BitCraft v1 as the reference implementation).

**IMPORTANT:** Your full project context is automatically loaded from `_bmad-output/project-context.md`. This guide provides high-level pointers and setup instructions only. Do NOT duplicate information that already exists in project-context.md.

**You MUST read project-context.md before starting any work.** It contains the complete architecture overview, repository structure, epic/story breakdown, test metrics, known issues, code review checklist, naming conventions, team agreements (AGREEMENT-1 through AGREEMENT-15), and documentation index.

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

**Epics 1-5: COMPLETE** (30/30 stories delivered) | **Epic 6: NEXT** (MCP Server for AI Agents, 4 stories)

**See:** `_bmad-output/project-context.md` for test metrics, epic breakdown, story details, deliverables, known issues, and technical debt.

---

## Setup & Commands

```bash
pnpm install && pnpm build && pnpm test:unit   # Quick start (no Docker)
```

**Full setup, Docker stack, and all commands:** See `_bmad-output/project-context.md` (sections: "Getting Started", "Docker Stack Management", "Test Execution") and `docker/README.md`.

**BMAD workflows (unique to this file -- not in project-context.md):**

```bash
/bmad-bmm-generate-project-context yolo     # Regenerate project context
/bmad-bmm-check-implementation-readiness    # Check readiness for next epic
```

---

## Common Pitfalls

- **Don't duplicate project-context.md** -- It's auto-loaded; never repeat its content here or in code comments
- **Don't skip TDD** -- AGREEMENT-1: tests BEFORE implementation for features with >3 acceptance criteria
- **Don't commit without security review** -- AGREEMENT-2: OWASP Top 10 check required on every story
- **Don't hard-code game world state** -- AGREEMENT-15: use discovery-driven testing pattern
- **Don't skip document verification tests** -- AGREEMENT-14: reference docs need automated structure tests
- **Don't add dependencies without audit** -- AGREEMENT-13: `pnpm audit --audit-level=high` must pass

**See:** `_bmad-output/project-context.md` for the full list of team agreements (1-15) and the code review checklist.

---

## Getting Help

1. **Read project-context.md first** -- Most answers are there (epic breakdown, test metrics, known issues, agreements, code review checklist, documentation index)
2. **Check story reports** -- `_bmad-output/implementation-artifacts/` and `_bmad-output/auto-bmad-artifacts/`
3. **Check BitCraft Game Reference** -- `_bmad-output/planning-artifacts/bitcraft-game-reference.md`
4. **Check Docker README** -- `docker/README.md`
5. **Use BMAD workflows** -- `/bmad-bmm-generate-project-context yolo` regenerates context

---

## Next Steps

**Epic 6: MCP Server for AI Agents** (4 stories) -- See `_bmad-output/project-context.md` for story list, context, prep items (PREP-E6-1 through PREP-E6-5), and risk assessment.
