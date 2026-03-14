---
name: harvest_resource
description: Begin harvesting a resource node at the player's current location.
reducer: harvest_start
params:
  - name: resource_id
    type: u64
    description: The unique identifier of the resource node to harvest
subscriptions:
  - table: player_state
    description: Current player position and action state (must be idle)
  - table: resource_node
    description: Resource node locations, types, and remaining quantities
  - table: item_desc
    description: Static data describing item types and properties
tags:
  - gathering
  - resource
  - economy
evals:
  - prompt: "Harvest the nearest tree"
    expected:
      reducer: harvest_start
      args: null
    criteria: "Identifies nearest tree resource node from subscribed state and passes its resource_id"
  - prompt: "Gather some wood"
    expected:
      reducer: harvest_start
      args: null
    criteria: "Translates material name to resource type filter, finds nearest matching node"
  - prompt: "Build a house"
    expected: skill_not_triggered
    criteria: "Building intent should trigger crafting/building skills, not harvesting"
  - prompt: "Move to the forest"
    expected: skill_not_triggered
    criteria: "Movement intent should trigger player_move, not harvesting"
---

# Harvest Resource

Begin harvesting a resource node at the player's current hex location.

## When to Use

Use this skill when the agent needs to:
- Gather raw materials (wood, stone, ore, fiber, etc.)
- Collect resources for crafting recipes
- Stock up on materials before a building project

## When NOT to Use

Do NOT use this skill when:
- The player is not adjacent to a resource node
- The player is already performing an action (moving, crafting, fighting)
- The agent wants to craft an item (use `craft_item` instead)
- The agent wants to build a structure (use `project_site_place` instead)

## Parameters

- `resource_id` (u64): The unique ID of the resource node to harvest. This must be looked up from the `resource_node` table subscription data.

## Workflow

1. Subscribe to `resource_node` table to discover nearby resources
2. Filter nodes by type if looking for specific material
3. Ensure player is at or adjacent to the resource node's hex
4. If not adjacent, use `player_move` to navigate there first
5. Call `harvest_start` with the resource node's ID
6. Monitor `player_state` for harvest completion

## Usage Notes

- Harvesting takes time. The player will be busy until the harvest completes.
- Some resources require specific tool levels to harvest.
- Resource nodes have finite quantities and may deplete after harvesting.
- The `item_desc` static data table maps item IDs to human-readable names and properties.
- Cost: 5 units per harvest action.
