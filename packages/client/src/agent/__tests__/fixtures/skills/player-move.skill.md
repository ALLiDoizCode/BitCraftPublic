---
name: player_move
description: Move the player character to a target hex coordinate on the game map.
reducer: player_move
params:
  - name: target_x
    type: i32
    description: Target X coordinate on the hex grid
  - name: target_y
    type: i32
    description: Target Y coordinate on the hex grid
subscriptions:
  - table: player_state
    description: Current player position and status
  - table: terrain
    description: Terrain data for pathfinding and obstacle detection
tags:
  - movement
  - core
evals:
  - prompt: "Move to coordinates (150, 200)"
    expected:
      reducer: player_move
      args: [150, 200]
    criteria: "Correctly extracts numeric coordinates from natural language"
  - prompt: "Go north"
    expected:
      reducer: player_move
      args: null
    criteria: "Translates cardinal direction to coordinate delta relative to current position"
  - prompt: "Attack the nearest enemy"
    expected: skill_not_triggered
    criteria: "Does NOT trigger movement skill for combat intent"
---

# Player Move

Move your character to a specific hex grid coordinate in the game world.

## When to Use

Use this skill when the agent needs to:
- Navigate to a specific location on the map
- Move toward a resource, building, or other player
- Reposition for strategic purposes (combat, gathering)

## When NOT to Use

Do NOT use this skill when:
- The target is at the agent's current position (no-op)
- The agent should teleport instead of walk (use `player_teleport_home`)
- The intent is combat (use `attack_start` instead)

## Parameters

The reducer expects two integer coordinates representing the target hex on the game grid:

- `target_x` (i32): The X coordinate of the destination hex
- `target_y` (i32): The Y coordinate of the destination hex

Both coordinates must be within the valid world bounds. Out-of-bounds coordinates will be rejected by the SpacetimeDB reducer.

## Usage Notes

- Movement is the most frequent action. Cost is minimal (1 unit per move).
- The player cannot move while performing other actions (gathering, crafting, combat).
- Movement may fail if the target hex is blocked by terrain or buildings.
- Subscribe to `player_state` to know the current position before computing target coordinates.
- Subscribe to `terrain` to verify the target hex is walkable.
