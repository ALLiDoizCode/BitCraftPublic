---
name: craft_item
description: Craft an item using a recipe, consuming required materials from inventory.
reducer: craft_item
params:
  - name: recipe_id
    type: u64
    description: The unique identifier of the crafting recipe to execute
  - name: quantity
    type: u32
    description: Number of items to craft (default 1)
    default: 1
subscriptions:
  - table: player_state
    description: Current player status (must be idle and near crafting station if required)
  - table: inventory
    description: Player inventory to verify material availability
  - table: recipe_desc
    description: Static data listing all crafting recipes with ingredients and outputs
  - table: item_desc
    description: Static data describing items, used for name-to-ID resolution
tags:
  - crafting
  - economy
  - production
evals:
  - prompt: "Craft a wooden sword"
    expected:
      reducer: craft_item
      args: null
    criteria: "Looks up 'wooden sword' in recipe_desc, resolves recipe_id, verifies materials in inventory"
  - prompt: "Make 5 stone bricks"
    expected:
      reducer: craft_item
      args: null
    criteria: "Resolves recipe_id for stone brick, sets quantity to 5, verifies sufficient materials"
  - prompt: "Gather some wood"
    expected: skill_not_triggered
    criteria: "Gathering intent should trigger harvest_resource, not crafting"
  - prompt: "What can I craft?"
    expected: skill_not_triggered
    criteria: "Information query should NOT trigger crafting action; respond with recipe list instead"
---

# Craft Item

Execute a crafting recipe to produce items from raw materials in your inventory.

## When to Use

Use this skill when the agent needs to:
- Transform raw materials into processed goods (e.g., logs into planks)
- Create tools, weapons, or armor
- Produce building materials
- Fulfill a crafting goal or recipe requirement

## When NOT to Use

Do NOT use this skill when:
- The player lacks the required materials (check inventory first)
- The player needs to gather materials first (use `harvest_resource`)
- The player wants to build a structure (use `project_site_place`)
- The player wants to trade items (use `trade_with_player`)
- The player is asking what recipes are available (respond with information, don't craft)

## Parameters

- `recipe_id` (u64): The unique ID of the recipe to execute. Look this up from the `recipe_desc` static data table.
- `quantity` (u32, default: 1): How many items to craft in this batch. Each unit consumes one set of recipe ingredients.

## Workflow

1. Determine what item the agent wants to craft
2. Look up the recipe in `recipe_desc` by output item name
3. Verify all required ingredients are in `inventory` (quantity * recipe requirements)
4. If materials are missing, consider using `harvest_resource` to gather them first
5. Call `craft_item` with the recipe_id and desired quantity
6. Monitor `inventory` for the new item appearing

## Usage Notes

- Some recipes require the player to be near a crafting station.
- Crafting takes time proportional to the recipe complexity.
- If quantity exceeds available materials, the reducer will reject the call.
- Cost: 15 units per crafting action.
- The agent should prefer batch crafting (higher quantity) over repeated single crafts to minimize action costs.
