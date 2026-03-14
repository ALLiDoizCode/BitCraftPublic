# SKILL.md File Format Schema

**Status:** Design Spike (PREP-E4-3)
**Date:** 2026-03-14
**For:** Epic 4, Story 4.1 (Skill File Format & Parser)

---

## Overview

SKILL.md files define game actions that agents can perform. Each file combines YAML frontmatter (machine-readable metadata) with a markdown body (human-readable instructions). The format follows the Standard Claude Agent Skills convention with YAML frontmatter.

**Key design principle:** Skill files produce `{ reducer, args }` payloads consumed by `client.publish()`. ILP costs are NOT declared in skill files -- costs are managed by the action cost registry (`default-action-costs.json`) and enforced by the BLS handler's fee schedule.

---

## File Naming Convention

Files use the pattern `{skill-name}.skill.md`:
- `player-move.skill.md`
- `harvest-resource.skill.md`
- `craft-item.skill.md`

The `.skill.md` extension distinguishes skill files from other markdown in the repository.

---

## YAML Frontmatter Schema

```yaml
---
# REQUIRED FIELDS
name: string              # Unique skill identifier (matches reducer name or is descriptive)
description: string       # One-line description for LLM skill selection
reducer: string           # Target SpacetimeDB reducer name (1-64 chars, alphanumeric + underscore)

# REQUIRED: Parameter definitions
params:                   # Array of reducer parameters (excluding identity, which is auto-prepended)
  - name: string          # Parameter name
    type: string          # SpacetimeDB type: i32, u32, u64, String, bool, f32, f64, etc.
    description: string   # Human-readable description of the parameter
    default?: any         # Optional default value (parsed as the declared type)

# REQUIRED: Table subscriptions needed for this skill
subscriptions:            # Array of SpacetimeDB tables the agent must subscribe to
  - table: string         # Table name in SpacetimeDB module
    description: string   # Why this subscription is needed

# OPTIONAL FIELDS
tags?: string[]           # Categorization tags (e.g., "movement", "combat", "economy")

evals?: array             # Optional behavioral test cases
  - prompt: string        # Natural language input to the agent
    expected:             # Expected output
      reducer: string     #   - Target reducer name
      args: any[] | null  #   - Expected args (null = args depend on game state)
    criteria: string      # Human-readable success/failure criteria
  # Special case: negative eval
  - prompt: string
    expected: skill_not_triggered  # This skill should NOT be triggered
    criteria: string
---
```

### Field Details

#### `name` (required)
- Unique identifier for the skill
- Used for referencing in Agent.md configuration
- Convention: lowercase with underscores (matches reducer names where applicable)
- Example: `player_move`, `harvest_resource`, `craft_item`

#### `description` (required)
- Single sentence describing when to use this skill
- Critical for LLM skill selection -- must be specific enough to avoid ambiguity
- Story 4.2 AC validates descriptions for "triggering precision"
- Example: "Move the player character to a target hex coordinate on the game map."

#### `reducer` (required)
- The SpacetimeDB reducer to call
- Must match a reducer name in the connected SpacetimeDB module (validated in Story 4.3)
- Format: 1-64 chars, alphanumeric + underscore (matches handler validation)
- The identity parameter is NOT listed here -- the BLS handler auto-prepends it

#### `params` (required)
- Array of parameter definitions
- These are the arguments AFTER the identity parameter (which is auto-prepended)
- Each param has: name, type, description, and optional default
- Supported types: `i32`, `u32`, `u64`, `i64`, `f32`, `f64`, `bool`, `String`, `Identity`
- Story 4.3 validates parameter types against the SpacetimeDB module

#### `subscriptions` (required)
- Tables the agent must subscribe to for this skill to function
- Each entry has: table name and description of why it's needed
- Story 4.3 validates table names against the SpacetimeDB module
- Used by the agent runtime to ensure required data is available before skill execution

#### `tags` (optional)
- Categorization for filtering and grouping skills
- Not used for runtime behavior, but helpful for Agent.md configuration and debugging

#### `evals` (optional)
- Behavioral test cases for the skill
- Each eval has a natural language prompt, expected output, and success criteria
- `expected.args: null` means args depend on runtime game state (not statically verifiable)
- `expected: skill_not_triggered` defines negative test cases (skill should NOT fire)
- Story 4.1 AC2 specifies the eval parsing requirements

---

## Markdown Body

The markdown body follows the frontmatter and provides human-readable context for the LLM:

### Recommended Sections

1. **Heading** (H1): Skill name in human-readable form
2. **When to Use**: Positive triggering guidance
3. **When NOT to Use**: Negative triggering guidance (critical for precision)
4. **Parameters**: Human-readable parameter descriptions with examples
5. **Workflow**: Step-by-step execution guidance
6. **Usage Notes**: Cost information, timing, prerequisites, edge cases

### Progressive Disclosure (Story 4.1 AC6)

- **Eagerly loaded:** name, reducer, params, subscriptions (from frontmatter)
- **Loaded on demand:** Full markdown body, evals, tags

This means the skill registry can index 50+ skills quickly by reading only frontmatter, deferring full body parsing until a skill is actually triggered.

---

## Validation Rules (Story 4.3)

The following validations are performed at load time:

1. **Required fields present:** name, description, reducer, params, subscriptions
2. **Reducer name format:** 1-64 chars, alphanumeric + underscore
3. **Param types valid:** Must be recognized SpacetimeDB types
4. **No ILP cost fields:** Skill files must NOT declare costs

The following validations are performed against the connected SpacetimeDB module:

1. **Reducer exists:** `reducer` name matches a public reducer in the module
2. **Tables exist:** Each subscription table name matches a table in the module
3. **Param types compatible:** Parameter types match the reducer's expected argument types

---

## Prototype Files

Three example files are provided alongside this schema:

1. `player-move.skill.md` -- Movement (simple, 2 params, frequent action)
2. `harvest-resource.skill.md` -- Resource gathering (1 param, workflow dependency on move)
3. `craft-item.skill.md` -- Crafting (2 params, requires multiple subscriptions, has default)

These examples demonstrate:
- Required and optional frontmatter fields
- Positive and negative eval cases
- Progressive disclosure structure
- "When to Use" / "When NOT to Use" pattern for LLM triggering precision
- Workflow documentation for multi-step agent reasoning
