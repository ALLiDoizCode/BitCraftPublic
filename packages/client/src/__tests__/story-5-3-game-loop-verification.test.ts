/**
 * Story 5.3: Game Loop Mapping & Precondition Documentation
 * Acceptance Test-Driven Development (ATDD) - Verification Tests
 *
 * Story 5.3 is a research/documentation story. Its primary deliverable is an
 * update to the BitCraft Game Reference document at:
 *   _bmad-output/planning-artifacts/bitcraft-game-reference.md
 *
 * These verification tests validate that the output document meets all 5
 * acceptance criteria (AC1-AC5), the 10 verification steps, and the
 * completeness metrics (>= 9 game loops, >= 9 Mermaid diagrams, all 4
 * precondition categories, 100% MVP/Phase 2 classification) defined in
 * the story.
 *
 * Test levels: Unit/Verification (vitest, file-based validation)
 * No Docker required for these tests.
 *
 * Run these tests explicitly with:
 *   RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-3-game-loop-verification.test.ts
 *
 * Or implicitly when the game reference document contains the Game Loops section (auto-detected).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const GAME_REFERENCE_PATH = path.join(
  PROJECT_ROOT,
  '_bmad-output/planning-artifacts/bitcraft-game-reference.md'
);

// Run verification tests when:
// 1. Explicitly requested via RUN_VERIFICATION_TESTS=true, OR
// 2. The game reference document contains the Game Loops section (Story 5.3 implemented)
//
// Note: Like Story 5.2, we check for the Game Loops section because the file
// already exists from Stories 5.1 and 5.2. This prevents RED phase failures
// from blocking CI before Story 5.3 is implemented.
function hasGameLoopsSection(): boolean {
  try {
    const content = fs.readFileSync(GAME_REFERENCE_PATH, 'utf-8');
    return /^#{1,3}\s+.*game\s+loop/im.test(content);
  } catch {
    return false;
  }
}
const runVerification = process.env.RUN_VERIFICATION_TESTS === 'true' || hasGameLoopsSection();

// The 9 required game loops from AC1
const REQUIRED_GAME_LOOPS = [
  'player lifecycle',
  'movement',
  'gathering',
  'crafting',
  'building',
  'combat',
  'trading',
  'chat',
  'empire',
] as const;

// MVP game loops (Stories 5.4-5.8)
const MVP_GAME_LOOPS = ['player lifecycle', 'movement', 'gathering', 'crafting', 'chat'] as const;

// Phase 2 game loops
const PHASE_2_GAME_LOOPS = ['building', 'combat', 'trading', 'empire'] as const;

// Precondition categories from AC5
const PRECONDITION_CATEGORIES = ['state', 'spatial', 'temporal', 'identity'] as const;

// Core reducers that must appear in game loop sequences
const CORE_LOOP_REDUCERS = [
  'sign_in',
  'sign_out',
  'player_move',
  'extract_start',
  'extract',
  'craft_initiate_start',
  'craft_initiate',
  'craft_continue_start',
  'craft_continue',
  'craft_collect',
  'player_respawn',
  'player_queue_join',
] as const;

// Key entity tables referenced in state transitions
const STATE_TRANSITION_TABLES = [
  'mobile_entity_state',
  'inventory_state',
  'progressive_action_state',
  'signed_in_player_state',
  'health_state',
  'stamina_state',
  'resource_health_state',
  'player_state',
] as const;

/**
 * Helper: Escape a string for safe use in RegExp construction.
 * Prevents ReDoS when building dynamic regex patterns, even from trusted input.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper: Read the game reference document content.
 * Returns empty string if file does not exist.
 */
function readGameReference(): string {
  try {
    return fs.readFileSync(GAME_REFERENCE_PATH, 'utf-8');
  } catch (_error: unknown) {
    return '';
  }
}

/**
 * Helper: Extract all markdown headings (levels 1-4: # through ####) from the document.
 */
function extractHeadings(content: string): string[] {
  const headingPattern = /^#{1,4}\s+(.+)$/gm;
  const headings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(content)) !== null) {
    headings.push(match[1].trim().toLowerCase());
  }
  return headings;
}

/**
 * Helper: Count occurrences of a pattern in document content.
 */
function countOccurrences(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Helper: Extract a section from the document between two headings.
 * Returns the content between the start heading and the next heading at the same or higher level.
 */
function extractSection(content: string, sectionHeading: string): string {
  const escapedHeading = escapeRegExp(sectionHeading);
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- sectionHeading from hardcoded string literals, escaped via escapeRegExp()
  const startPattern = new RegExp(`^(#{1,4})\\s+${escapedHeading}`, 'im');
  const startMatch = startPattern.exec(content);
  if (!startMatch) return '';

  const startLevel = startMatch[1].length;
  const startIndex = startMatch.index + startMatch[0].length;

  // Find the next heading at the same or higher level
  const remainingContent = content.substring(startIndex);
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- startLevel is a number (1-4) derived from regex capture group length, not user input
  const endPattern = new RegExp(`^#{1,${startLevel}}\\s+`, 'm');
  const endMatch = endPattern.exec(remainingContent);

  if (endMatch) {
    return remainingContent.substring(0, endMatch.index);
  }
  return remainingContent;
}

describe.skipIf(!runVerification)(
  'Story 5.3: Game Loop Mapping & Precondition Documentation Verification',
  () => {
    let content: string;
    let headings: string[];
    let gameLoopsSection: string;

    beforeAll(() => {
      content = readGameReference();
      headings = extractHeadings(content);
      gameLoopsSection = extractSection(content, 'Game Loops') || '';
    });

    // ==========================================================================
    // AC1: Core game loop documentation (9 loops)
    // ==========================================================================
    describe('AC1: Core game loop documentation', () => {
      it('should contain a Game Loops section in the game reference document', () => {
        // Given: Story 5.3 implementation is complete
        // When: We look for a Game Loops section heading
        // Then: A dedicated section for game loops exists
        const hasGameLoops = headings.some(
          (h) => h.includes('game loop') || h.includes('game-loop')
        );
        expect(hasGameLoops).toBe(true);
      });

      it('should have substantial Game Loops content (not a stub)', () => {
        // Given: The Game Loops section exists
        // When: We measure its length
        // Then: It has substantial content (at least 5000 characters)
        expect(gameLoopsSection.length).toBeGreaterThan(5000);
      });

      it.each(REQUIRED_GAME_LOOPS)('should document the "%s" game loop', (loop) => {
        // Given: The Game Loops section exists
        // When: We search for this specific game loop
        // Then: The loop is documented as a heading or labeled section
        const loopLower = loop.toLowerCase();
        const loopEscaped = escapeRegExp(loopLower).replace(/\s+/g, '\\s+');
        // Values from hardcoded REQUIRED_GAME_LOOPS const array, escaped via escapeRegExp()
        const hasLoop =
          gameLoopsSection.toLowerCase().includes(loopLower) &&
          (new RegExp(`#{1,4}\\s+.*${loopEscaped}`, 'i').test(gameLoopsSection) || // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
            new RegExp(`\\*\\*${loopEscaped}`, 'i').test(gameLoopsSection)); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
        expect(hasLoop).toBe(true);
      });

      it('should document all 9 required game loops', () => {
        // Given: The Game Loops section exists
        // When: We check all 9 required loops
        // Then: All 9 are present in the section
        const foundLoops = REQUIRED_GAME_LOOPS.filter((loop) =>
          gameLoopsSection.toLowerCase().includes(loop.toLowerCase())
        );
        expect(foundLoops.length).toBe(REQUIRED_GAME_LOOPS.length);
      });

      it('should document reducer call sequences for each loop', () => {
        // Given: Each game loop defines the sequence of reducer calls
        // When: We search for sequence indicators in the game loops section
        // Then: Multiple reducer sequences are documented
        const sequencePatterns = [
          /`[a-z_]+`\s*(?:->|→)\s*`[a-z_]+`/g,
          /\d+\.\s+`[a-z_]+`/gm,
          /step\s*\d+.*`[a-z_]+`/gi,
        ];

        let totalSequenceIndicators = 0;
        for (const pattern of sequencePatterns) {
          totalSequenceIndicators += countOccurrences(gameLoopsSection, pattern);
        }

        // At least 15 sequence indicators across all loops
        expect(totalSequenceIndicators).toBeGreaterThanOrEqual(15);
      });

      it.each(CORE_LOOP_REDUCERS)(
        'should reference the "%s" reducer in game loop sequences',
        (reducer) => {
          // Given: Game loops document reducer call sequences
          // When: We search for this core reducer
          // Then: The reducer is mentioned in the game loops section
          expect(gameLoopsSection).toContain(reducer);
        }
      );

      it('should document expected state transitions for each loop', () => {
        // Given: Each game loop documents expected state transitions
        // When: We count state transition indicators
        // Then: At least 9 state transition descriptions exist (at least 1 per loop)
        const transitionPatterns = [
          /state.*transition/gi,
          /table.*change/gi,
          /updated|created|deleted|decremented|incremented|added|removed/gi,
        ];

        let transitionIndicators = 0;
        for (const pattern of transitionPatterns) {
          transitionIndicators += countOccurrences(gameLoopsSection, pattern);
        }

        // At least 18 state transition descriptions (>= 2 per loop)
        expect(transitionIndicators).toBeGreaterThanOrEqual(18);
      });

      it('should document observable outcomes for game loops', () => {
        // Given: Each loop defines observable outcomes
        // When: We search for outcome/observation language
        // Then: Observable outcomes are documented
        const hasObservableOutcomes =
          /observable/i.test(gameLoopsSection) ||
          /observe/i.test(gameLoopsSection) ||
          /subscription.*update/i.test(gameLoopsSection) ||
          /visible.*change/i.test(gameLoopsSection);
        expect(hasObservableOutcomes).toBe(true);
      });
    });

    // ==========================================================================
    // AC2: Movement loop documentation
    // ==========================================================================
    describe('AC2: Movement loop documentation', () => {
      let movementSection: string;

      beforeAll(() => {
        movementSection =
          extractSection(gameLoopsSection, 'Movement') ||
          extractSection(content, 'Movement Loop') ||
          extractSection(content, 'Movement') ||
          '';
      });

      it('should document the movement sequence including position query', () => {
        // Given: The movement game loop is documented
        // When: We check the sequence
        // Then: It includes current position query
        const hasPositionQuery =
          /position.*query/i.test(movementSection) ||
          /query.*position/i.test(movementSection) ||
          /mobile_entity_state/i.test(movementSection) ||
          /current.*position/i.test(movementSection);
        expect(hasPositionQuery).toBe(true);
      });

      it('should reference the player_move reducer call', () => {
        // Given: The movement loop documents the reducer sequence
        // When: We search for the player_move reducer
        // Then: player_move is documented as part of the sequence
        expect(movementSection).toContain('player_move');
      });

      it('should document position state update via subscription', () => {
        // Given: The movement loop documents state updates
        // When: We check for subscription-based observation
        // Then: Position update via subscription is documented
        const hasSubscriptionUpdate =
          /subscription/i.test(movementSection) ||
          /mobile_entity_state.*update/i.test(movementSection) ||
          /observe.*position/i.test(movementSection);
        expect(hasSubscriptionUpdate).toBe(true);
      });

      it('should document the valid target hex precondition', () => {
        // Given: Movement has preconditions
        // When: We check for the valid target precondition
        // Then: Valid target hex or valid coordinates is documented
        const hasValidTarget =
          /valid.*target/i.test(movementSection) ||
          /valid.*hex/i.test(movementSection) ||
          /valid.*coordinate/i.test(movementSection) ||
          /target.*valid/i.test(movementSection);
        expect(hasValidTarget).toBe(true);
      });

      it('should document the player alive precondition', () => {
        // Given: Movement has preconditions
        // When: We check for the alive precondition
        // Then: Player alive / not incapacitated is documented
        const hasAliveCheck =
          /alive/i.test(movementSection) ||
          /incapacitated/i.test(movementSection) ||
          /not.*dead/i.test(movementSection);
        expect(hasAliveCheck).toBe(true);
      });

      it('should document no movement cooldown precondition', () => {
        // Given: Movement has preconditions
        // When: We check for cooldown precondition
        // Then: Movement cooldown or timing constraint is documented
        const hasCooldown =
          /cooldown/i.test(movementSection) ||
          /timer/i.test(movementSection) ||
          /stamina/i.test(movementSection) ||
          /running/i.test(movementSection);
        expect(hasCooldown).toBe(true);
      });

      it('should document location_x/location_z state transition', () => {
        // Given: Movement documents state transitions
        // When: We check for the specific column changes
        // Then: location_x and location_z changes are documented
        const hasLocationTransition =
          /location_x/i.test(movementSection) && /location_z/i.test(movementSection);
        expect(hasLocationTransition).toBe(true);
      });

      it('should reference mobile_entity_state table for state transitions', () => {
        // Given: Movement documents state transitions
        // When: We check for the correct table reference
        // Then: mobile_entity_state is referenced (not player_state.position)
        expect(movementSection).toContain('mobile_entity_state');
      });

      it('should document the PlayerMoveRequest structure', () => {
        // Given: The movement loop documents reducer call details
        // When: We check for the request structure
        // Then: PlayerMoveRequest or its fields are documented
        const hasMoveRequest =
          /PlayerMoveRequest/i.test(movementSection) ||
          (/destination/i.test(movementSection) && /origin/i.test(movementSection));
        expect(hasMoveRequest).toBe(true);
      });

      it('should document destination_x/destination_z fields', () => {
        // Given: Movement state transition includes destination fields
        // When: We check for destination column references
        // Then: destination_x and destination_z are documented
        const hasDestination =
          /destination_x/i.test(movementSection) ||
          /destination_z/i.test(movementSection) ||
          /destination/i.test(movementSection);
        expect(hasDestination).toBe(true);
      });

      it('should have a Mermaid sequence diagram for movement', () => {
        // Given: AC5 requires each loop to include a Mermaid sequence diagram
        // When: We check for a sequenceDiagram in the movement section
        // Then: A Mermaid diagram exists
        const hasDiagram = /sequenceDiagram/i.test(movementSection);
        expect(hasDiagram).toBe(true);
      });
    });

    // ==========================================================================
    // AC3: Gathering loop documentation
    // ==========================================================================
    describe('AC3: Gathering loop documentation', () => {
      let gatheringSection: string;

      beforeAll(() => {
        gatheringSection =
          extractSection(gameLoopsSection, 'Gathering') ||
          extractSection(content, 'Gathering Loop') ||
          extractSection(content, 'Resource Gathering') ||
          '';
      });

      it('should document the gathering sequence starting with movement to resource', () => {
        // Given: The gathering loop is documented
        // When: We check the sequence
        // Then: Moving to the resource is part of the sequence
        const hasMoveToResource =
          /move.*resource/i.test(gatheringSection) ||
          /player_move/i.test(gatheringSection) ||
          /near.*resource/i.test(gatheringSection);
        expect(hasMoveToResource).toBe(true);
      });

      it('should document the extract_start reducer call', () => {
        // Given: The gathering loop documents the progressive action pattern
        // When: We search for extract_start
        // Then: extract_start is documented in the sequence
        expect(gatheringSection).toContain('extract_start');
      });

      it('should document the extract reducer call', () => {
        // Given: The gathering loop documents the progressive action completion
        // When: We search for extract
        // Then: extract is documented in the sequence
        // Use a pattern that matches `extract` but not `extract_start`
        const hasExtract =
          /\bextract\b(?!_start)/i.test(gatheringSection) ||
          /`extract`/i.test(gatheringSection) ||
          /extract\(/i.test(gatheringSection);
        expect(hasExtract).toBe(true);
      });

      it('should document inventory update as an outcome', () => {
        // Given: The gathering loop results in inventory changes
        // When: We check for inventory update documentation
        // Then: Inventory update/change is documented
        const hasInventoryUpdate =
          /inventory.*update/i.test(gatheringSection) ||
          /inventory_state/i.test(gatheringSection) ||
          /item.*added/i.test(gatheringSection) ||
          /quantity.*increment/i.test(gatheringSection);
        expect(hasInventoryUpdate).toBe(true);
      });

      it('should document the player-near-resource spatial precondition', () => {
        // Given: Gathering has spatial preconditions
        // When: We check for proximity precondition
        // Then: Player near resource entity is documented
        const hasNearResource =
          /near.*resource/i.test(gatheringSection) ||
          /proximity.*resource/i.test(gatheringSection) ||
          /distance.*resource/i.test(gatheringSection) ||
          /close.*resource/i.test(gatheringSection);
        expect(hasNearResource).toBe(true);
      });

      it('should document the resource health precondition', () => {
        // Given: Gathering has state preconditions
        // When: We check for resource health precondition
        // Then: Resource health > 0 is documented
        const hasResourceHealth =
          /resource_health_state/i.test(gatheringSection) ||
          /resource.*health/i.test(gatheringSection) ||
          /health.*resource/i.test(gatheringSection) ||
          /remaining.*health/i.test(gatheringSection);
        expect(hasResourceHealth).toBe(true);
      });

      it('should document resource_health_state.health decrement as state transition', () => {
        // Given: Gathering documents state transitions
        // When: We check for health decrement
        // Then: resource_health_state.health decrement is documented
        const hasHealthDecrement =
          /resource_health_state.*health.*decrement/i.test(gatheringSection) ||
          /resource_health_state/i.test(gatheringSection) ||
          /health.*decrement/i.test(gatheringSection);
        expect(hasHealthDecrement).toBe(true);
      });

      it('should document inventory_state update as state transition', () => {
        // Given: Gathering documents state transitions
        // When: We check for inventory state change
        // Then: inventory_state is referenced for item addition
        expect(gatheringSection).toContain('inventory_state');
      });

      it('should document the PlayerExtractRequest structure', () => {
        // Given: Gathering documents reducer call details
        // When: We check for the request structure
        // Then: PlayerExtractRequest or its fields are documented
        const hasExtractRequest =
          /PlayerExtractRequest/i.test(gatheringSection) ||
          (/recipe_id/i.test(gatheringSection) && /target_entity_id/i.test(gatheringSection));
        expect(hasExtractRequest).toBe(true);
      });

      it('should document the progressive action timer between extract_start and extract', () => {
        // Given: Gathering uses the progressive action pattern
        // When: We check for timing documentation
        // Then: The wait/timer between _start and completion is documented
        const hasTimer =
          /progressive.*action/i.test(gatheringSection) ||
          /timer/i.test(gatheringSection) ||
          /wait/i.test(gatheringSection) ||
          /duration/i.test(gatheringSection) ||
          /timing/i.test(gatheringSection);
        expect(hasTimer).toBe(true);
      });

      it('should document extraction_recipe_desc reference', () => {
        // Given: Gathering requires a valid extraction recipe
        // When: We check for recipe reference
        // Then: extraction_recipe_desc is mentioned
        expect(gatheringSection).toContain('extraction_recipe_desc');
      });

      it('should have a Mermaid sequence diagram for gathering', () => {
        // Given: AC5 requires each loop to include a Mermaid sequence diagram
        // When: We check for a sequenceDiagram in the gathering section
        // Then: A Mermaid diagram exists
        const hasDiagram = /sequenceDiagram/i.test(gatheringSection);
        expect(hasDiagram).toBe(true);
      });
    });

    // ==========================================================================
    // AC4: Crafting loop documentation
    // ==========================================================================
    describe('AC4: Crafting loop documentation', () => {
      let craftingSection: string;

      beforeAll(() => {
        craftingSection =
          extractSection(gameLoopsSection, 'Crafting') ||
          extractSection(content, 'Crafting Loop') ||
          extractSection(content, 'Crafting') ||
          '';
      });

      it('should document verify materials in inventory as first step', () => {
        // Given: Crafting starts with material verification
        // When: We check the sequence
        // Then: Material verification is documented
        const hasMaterialCheck =
          /verify.*material/i.test(craftingSection) ||
          /material.*check/i.test(craftingSection) ||
          /material.*inventory/i.test(craftingSection) ||
          /required.*material/i.test(craftingSection);
        expect(hasMaterialCheck).toBe(true);
      });

      it('should document craft_initiate_start reducer call', () => {
        // Given: Crafting uses the progressive action pattern
        // When: We search for craft_initiate_start
        // Then: craft_initiate_start is documented
        expect(craftingSection).toContain('craft_initiate_start');
      });

      it('should document craft_initiate reducer call', () => {
        // Given: Crafting uses the progressive action pattern
        // When: We search for craft_initiate
        // Then: craft_initiate is documented (completion of initiation phase)
        const hasCraftInitiate =
          /`craft_initiate`/i.test(craftingSection) ||
          /\bcraft_initiate\b(?!_start)/i.test(craftingSection);
        expect(hasCraftInitiate).toBe(true);
      });

      it('should document craft_continue_start reducer call', () => {
        // Given: Crafting has a continue phase
        // When: We search for craft_continue_start
        // Then: craft_continue_start is documented
        expect(craftingSection).toContain('craft_continue_start');
      });

      it('should document craft_continue reducer call (repeatable)', () => {
        // Given: Crafting has a repeatable continue phase
        // When: We search for craft_continue
        // Then: craft_continue is documented with repeat indication
        const hasCraftContinue =
          /craft_continue/i.test(craftingSection) &&
          (/repeat/i.test(craftingSection) || /multi.*step/i.test(craftingSection));
        expect(hasCraftContinue).toBe(true);
      });

      it('should document craft_collect reducer call', () => {
        // Given: Crafting ends with collection
        // When: We search for craft_collect
        // Then: craft_collect is documented
        expect(craftingSection).toContain('craft_collect');
      });

      it('should document product in inventory as final outcome', () => {
        // Given: Crafting results in a product
        // When: We check for product/output documentation
        // Then: Product added to inventory is documented
        const hasProduct =
          /product.*inventory/i.test(craftingSection) ||
          /crafted.*item/i.test(craftingSection) ||
          /item.*added/i.test(craftingSection) ||
          /output.*inventory/i.test(craftingSection);
        expect(hasProduct).toBe(true);
      });

      it('should document materials consumed as state transition', () => {
        // Given: Crafting consumes materials
        // When: We check for material consumption documentation
        // Then: Material consumption from inventory_state is documented
        const hasMaterialsConsumed =
          /material.*consumed/i.test(craftingSection) ||
          /consumed.*material/i.test(craftingSection) ||
          /material.*decrement/i.test(craftingSection) ||
          /inventory_state.*material/i.test(craftingSection);
        expect(hasMaterialsConsumed).toBe(true);
      });

      it('should document crafting_recipe_desc precondition', () => {
        // Given: Crafting requires a valid recipe
        // When: We check for recipe precondition
        // Then: crafting_recipe_desc is referenced
        expect(craftingSection).toContain('crafting_recipe_desc');
      });

      it('should document player near building with matching building_function precondition', () => {
        // Given: Crafting has spatial preconditions
        // When: We check for building proximity precondition
        // Then: Player near building with building_function is documented
        const hasBuildingProximity =
          /near.*building/i.test(craftingSection) ||
          /building.*proximity/i.test(craftingSection) ||
          /building_function/i.test(craftingSection);
        expect(hasBuildingProximity).toBe(true);
      });

      it('should document all required materials in inventory_state precondition', () => {
        // Given: Crafting has state preconditions
        // When: We check for material requirement
        // Then: Materials in inventory_state is documented
        const hasMaterialPrecondition =
          /material.*present/i.test(craftingSection) ||
          /material.*inventory/i.test(craftingSection) ||
          /inventory_state/i.test(craftingSection);
        expect(hasMaterialPrecondition).toBe(true);
      });

      it('should document progressive_action_state creation/update as state transition', () => {
        // Given: Crafting creates progressive_action_state entries
        // When: We check for progressive action state documentation
        // Then: progressive_action_state is referenced
        expect(craftingSection).toContain('progressive_action_state');
      });

      it('should document the PlayerCraftInitiateRequest structure', () => {
        // Given: Crafting documents reducer call details
        // When: We check for the request structure
        // Then: PlayerCraftInitiateRequest or its key fields are documented
        const hasInitiateRequest =
          /PlayerCraftInitiateRequest/i.test(craftingSection) ||
          /craft.*request/i.test(craftingSection) ||
          (/recipe_id/i.test(craftingSection) && /building/i.test(craftingSection));
        expect(hasInitiateRequest).toBe(true);
      });

      it('should document the passive crafting sub-loop', () => {
        // Given: Crafting has a passive variant
        // When: We check for passive crafting documentation
        // Then: Passive crafting is documented
        const hasPassiveCrafting =
          /passive.*craft/i.test(craftingSection) ||
          /passive_craft/i.test(craftingSection) ||
          /background.*craft/i.test(craftingSection);
        expect(hasPassiveCrafting).toBe(true);
      });

      it('should have a Mermaid sequence diagram for crafting', () => {
        // Given: AC5 requires each loop to include a Mermaid sequence diagram
        // When: We check for a sequenceDiagram in the crafting section
        // Then: A Mermaid diagram exists
        const hasDiagram = /sequenceDiagram/i.test(craftingSection);
        expect(hasDiagram).toBe(true);
      });
    });

    // ==========================================================================
    // AC5: Precondition categorization and Mermaid diagrams
    // ==========================================================================
    describe('AC5: Precondition categorization', () => {
      it.each(PRECONDITION_CATEGORIES)('should use the "%s" precondition category', (category) => {
        // Given: Each game loop documents preconditions
        // When: We search for this precondition category
        // Then: The category is used in the game loops section
        const categoryLower = category.toLowerCase();
        const hasCategoryInContext =
          gameLoopsSection.toLowerCase().includes(categoryLower) ||
          gameLoopsSection.toLowerCase().includes(`${categoryLower} precondition`);
        expect(hasCategoryInContext).toBe(true);
      });

      it('should use all 4 precondition categories', () => {
        // Given: The story requires all 4 categories
        // When: We check all categories
        // Then: All 4 are present
        const foundCategories = PRECONDITION_CATEGORIES.filter((cat) =>
          gameLoopsSection.toLowerCase().includes(cat.toLowerCase())
        );
        expect(foundCategories.length).toBe(PRECONDITION_CATEGORIES.length);
      });

      it('should document state preconditions with specific examples', () => {
        // Given: State preconditions are required
        // When: We check for specific state precondition examples
        // Then: Examples like "player alive", "has items", "has stamina" are present
        const hasStateExamples =
          /alive/i.test(gameLoopsSection) ||
          /stamina/i.test(gameLoopsSection) ||
          /health/i.test(gameLoopsSection) ||
          /items?\s+in/i.test(gameLoopsSection);
        expect(hasStateExamples).toBe(true);
      });

      it('should document spatial preconditions with specific examples', () => {
        // Given: Spatial preconditions are required
        // When: We check for specific spatial precondition examples
        // Then: Examples like "near resource", "near building" are present
        const hasSpatialExamples =
          /near/i.test(gameLoopsSection) ||
          /proximity/i.test(gameLoopsSection) ||
          /distance/i.test(gameLoopsSection) ||
          /close\s+to/i.test(gameLoopsSection);
        expect(hasSpatialExamples).toBe(true);
      });

      it('should document temporal preconditions with specific examples', () => {
        // Given: Temporal preconditions are required
        // When: We check for specific temporal precondition examples
        // Then: Examples like "cooldown elapsed", "timer complete" are present
        const hasTemporalExamples =
          /cooldown/i.test(gameLoopsSection) ||
          /timer/i.test(gameLoopsSection) ||
          /progressive.*action.*timing/i.test(gameLoopsSection) ||
          /wait/i.test(gameLoopsSection) ||
          /elapsed/i.test(gameLoopsSection);
        expect(hasTemporalExamples).toBe(true);
      });

      it('should document identity preconditions with specific examples', () => {
        // Given: Identity preconditions are required
        // When: We check for specific identity precondition examples
        // Then: Examples like "signed in", "claim member", "own building" are present
        const hasIdentityExamples =
          /signed.*in/i.test(gameLoopsSection) ||
          /sign_in/i.test(gameLoopsSection) ||
          /claim.*member/i.test(gameLoopsSection) ||
          /actor_id/i.test(gameLoopsSection);
        expect(hasIdentityExamples).toBe(true);
      });

      it('should have at least 3 documented preconditions per loop for all 9 loops', () => {
        // Given: Completeness metrics require >= 3 preconditions per loop
        // When: We check all 9 game loops for precondition count
        // Then: Each loop has at least 3 preconditions documented
        const allLoopNames = [
          'Player Lifecycle',
          'Movement',
          'Gathering',
          'Crafting',
          'Building',
          'Combat',
          'Trading',
          'Chat',
          'Empire',
        ];

        for (const loopName of allLoopNames) {
          const section =
            extractSection(gameLoopsSection, loopName) ||
            extractSection(content, `${loopName} Loop`) ||
            '';

          // Count precondition-related table rows (| step | precondition | category | error |)
          // and prose precondition mentions
          const preconditionTableRows = countOccurrences(
            section,
            /\|\s*`[a-z_]+`[^|]*\|[^|]+\|\s*(State|Spatial|Temporal|Identity)\s*\|/gi
          );
          const preconditionProseIndicators = countOccurrences(
            section,
            /precondition|must\s+be|must\s+have|required|should\s+be|needs?\s+to|valid/gi
          );

          // Each loop should have at least 3 precondition indicators (table rows or prose)
          const totalPreconditions = Math.max(preconditionTableRows, preconditionProseIndicators);
          expect(totalPreconditions).toBeGreaterThanOrEqual(3);
        }
      });
    });

    // ==========================================================================
    // AC5: Mermaid sequence diagrams
    // ==========================================================================
    describe('AC5: Mermaid sequence diagrams', () => {
      it('should contain Mermaid sequence diagram code blocks', () => {
        // Given: Each game loop includes a Mermaid sequence diagram
        // When: We search for Mermaid sequenceDiagram syntax
        // Then: At least one sequenceDiagram code block exists in the game loops section
        const hasMermaidSequence = /```mermaid[\s\S]*?sequenceDiagram[\s\S]*?```/i.test(
          gameLoopsSection
        );
        expect(hasMermaidSequence).toBe(true);
      });

      it('should have at least 9 Mermaid sequence diagrams (one per loop)', () => {
        // Given: AC5 requires each loop to include a Mermaid sequence diagram
        // When: We count sequenceDiagram occurrences
        // Then: At least 9 diagrams exist
        const diagramCount = countOccurrences(gameLoopsSection, /sequenceDiagram/g);
        expect(diagramCount).toBeGreaterThanOrEqual(9);
      });

      it('should include Client participant in Mermaid diagrams', () => {
        // Given: Mermaid diagrams show actor, reducer calls, state queries
        // When: We search for Client participant
        // Then: Client is a participant in at least one diagram
        const hasClient =
          /participant.*Client/i.test(gameLoopsSection) ||
          /participant.*C\s+as\s+Client/i.test(gameLoopsSection);
        expect(hasClient).toBe(true);
      });

      it('should include SpacetimeDB participant in Mermaid diagrams', () => {
        // Given: Mermaid diagrams show reducer calls to SpacetimeDB
        // When: We search for SpacetimeDB participant
        // Then: SpacetimeDB is a participant in at least one diagram
        const hasSpacetimeDB =
          /participant.*SpacetimeDB/i.test(gameLoopsSection) ||
          /participant.*S\s+as\s+SpacetimeDB/i.test(gameLoopsSection);
        expect(hasSpacetimeDB).toBe(true);
      });

      it('should include Tables participant in Mermaid diagrams', () => {
        // Given: Mermaid diagrams show state queries and writes
        // When: We search for Tables participant
        // Then: Tables is a participant in at least one diagram
        const hasTables =
          /participant.*Tables/i.test(gameLoopsSection) ||
          /participant.*T\s+as\s+Tables/i.test(gameLoopsSection);
        expect(hasTables).toBe(true);
      });

      it('should show reducer calls in Mermaid diagrams with arrow syntax', () => {
        // Given: Mermaid diagrams show reducer calls
        // When: We check for arrow syntax (C->>S or similar)
        // Then: Arrow syntax is present
        const hasArrows = /->>/i.test(gameLoopsSection) || /-->/i.test(gameLoopsSection);
        expect(hasArrows).toBe(true);
      });

      it('should show alt blocks for precondition failure paths', () => {
        // Given: Mermaid diagrams show failure paths
        // When: We check for alt blocks
        // Then: alt blocks for precondition failures are present
        const hasAlt = /\balt\b/i.test(gameLoopsSection) && /\belse\b/i.test(gameLoopsSection);
        expect(hasAlt).toBe(true);
      });

      it('should show Err() responses in failure paths', () => {
        // Given: Mermaid diagrams show error responses
        // When: We check for Err() in diagrams
        // Then: Error responses are documented
        const hasErrResponse =
          /Err\(/i.test(gameLoopsSection) ||
          /error.*response/i.test(gameLoopsSection) ||
          /fail.*message/i.test(gameLoopsSection);
        expect(hasErrResponse).toBe(true);
      });

      it('should show subscription updates in Mermaid diagrams', () => {
        // Given: Mermaid diagrams show state transitions
        // When: We check for subscription update arrows
        // Then: Subscription updates from Tables back to Client are shown
        const hasSubscriptionUpdate =
          /subscription.*update/i.test(gameLoopsSection) ||
          /T-->>C/i.test(gameLoopsSection) ||
          /Tables?.*-->>/i.test(gameLoopsSection);
        expect(hasSubscriptionUpdate).toBe(true);
      });
    });

    // ==========================================================================
    // AC5: MVP vs. Phase 2 classification
    // ==========================================================================
    describe('AC5: MVP vs. Phase 2 classification', () => {
      it('should contain a MVP vs. Phase 2 classification table', () => {
        // Given: AC5 requires classification of loops
        // When: We search for a classification table
        // Then: A classification section exists
        const hasClassification =
          /MVP.*Phase\s*2/i.test(gameLoopsSection) ||
          /phase\s*2.*MVP/i.test(gameLoopsSection) ||
          /classification/i.test(gameLoopsSection);
        expect(hasClassification).toBe(true);
      });

      it.each(MVP_GAME_LOOPS)('should classify "%s" as MVP (Stories 5.4-5.8)', (loop) => {
        // Given: The classification table exists
        // When: We check this MVP loop's classification
        // Then: It is classified as MVP or associated with Stories 5.4-5.8
        const loopLower = loop.toLowerCase();
        const loopEscaped = escapeRegExp(loopLower).replace(/\s+/g, '\\s+');
        // Check for the loop appearing near MVP or 5.4-5.8 references (values from hardcoded MVP_GAME_LOOPS const array, escaped via escapeRegExp())
        const inMVPContext =
          new RegExp(`${loopEscaped}[\\s\\S]{0,200}(?:MVP|5\\.[4-8])`, 'i').test(
            gameLoopsSection
          ) || // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
          new RegExp(`(?:MVP|5\\.[4-8])[\\s\\S]{0,200}${loopEscaped}`, 'i').test(gameLoopsSection); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
        expect(inMVPContext).toBe(true);
      });

      it.each(PHASE_2_GAME_LOOPS)('should classify "%s" as Phase 2', (loop) => {
        // Given: The classification table exists
        // When: We check this Phase 2 loop's classification
        // Then: It is classified as Phase 2
        const loopLower = loop.toLowerCase();
        const loopEscaped = escapeRegExp(loopLower).replace(/\s+/g, '\\s+');
        // Check for the loop appearing near "Phase 2" references (values from hardcoded PHASE_2_GAME_LOOPS const array, escaped via escapeRegExp())
        const inPhase2Context =
          new RegExp(`${loopEscaped}[\\s\\S]{0,200}phase\\s*2`, 'i').test(gameLoopsSection) || // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
          new RegExp(`phase\\s*2[\\s\\S]{0,200}${loopEscaped}`, 'i').test(gameLoopsSection); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
        expect(inPhase2Context).toBe(true);
      });

      it('should classify all 9 game loops (100% classified)', () => {
        // Given: The classification table exists
        // When: We check all loops
        // Then: All 9 are mentioned in a classification context
        const allLoops = [...MVP_GAME_LOOPS, ...PHASE_2_GAME_LOOPS];
        const classifiedLoops = allLoops.filter((loop) => {
          const loopLower = loop.toLowerCase();
          // Check if loop appears near MVP or Phase 2
          const loopEscaped = escapeRegExp(loopLower).replace(/\s+/g, '\\s+');
          // Values from hardcoded arrays, escaped via escapeRegExp()
          return (
            new RegExp(`${loopEscaped}[\\s\\S]{0,300}(?:MVP|phase\\s*2|5\\.[4-8])`, 'i').test(
              gameLoopsSection
            ) || // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
            new RegExp(`(?:MVP|phase\\s*2|5\\.[4-8])[\\s\\S]{0,300}${loopEscaped}`, 'i').test(
              gameLoopsSection
            ) // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
          );
        });
        expect(classifiedLoops.length).toBe(allLoops.length);
      });

      it('should include classification reason for each loop', () => {
        // Given: The classification table exists
        // When: We check for reasons
        // Then: At least some classification entries have reasons
        const hasReasons =
          /reason/i.test(gameLoopsSection) ||
          /fundamental|core|complex|multi.*player|simple/i.test(gameLoopsSection);
        expect(hasReasons).toBe(true);
      });
    });

    // ==========================================================================
    // Player Lifecycle Loop (Task 2)
    // ==========================================================================
    describe('Player lifecycle loop documentation (Task 2)', () => {
      let lifecycleSection: string;

      beforeAll(() => {
        lifecycleSection =
          extractSection(gameLoopsSection, 'Player Lifecycle') ||
          extractSection(content, 'Player Lifecycle Loop') ||
          extractSection(content, 'Player Lifecycle') ||
          '';
      });

      it('should document the player_queue_join reducer', () => {
        // Given: Player lifecycle starts with queue join
        // When: We check for player_queue_join
        // Then: player_queue_join is documented
        expect(lifecycleSection).toContain('player_queue_join');
      });

      it('should document the sign_in reducer', () => {
        // Given: Player lifecycle includes sign-in
        // When: We check for sign_in
        // Then: sign_in is documented
        expect(lifecycleSection).toContain('sign_in');
      });

      it('should document the sign_out reducer', () => {
        // Given: Player lifecycle includes sign-out
        // When: We check for sign_out
        // Then: sign_out is documented
        expect(lifecycleSection).toContain('sign_out');
      });

      it('should document the player_respawn reducer', () => {
        // Given: Player lifecycle includes death/respawn
        // When: We check for player_respawn
        // Then: player_respawn is documented
        expect(lifecycleSection).toContain('player_respawn');
      });

      it('should document signed_in_player_state creation', () => {
        // Given: Sign-in creates signed_in_player_state
        // When: We check for this state table
        // Then: signed_in_player_state is documented
        expect(lifecycleSection).toContain('signed_in_player_state');
      });

      it('should document player_state.signed_in toggle', () => {
        // Given: Sign-in/sign-out toggles player_state.signed_in
        // When: We check for this state transition
        // Then: signed_in field is documented
        const hasSignedInToggle =
          /player_state.*signed_in/i.test(lifecycleSection) ||
          /signed_in.*player_state/i.test(lifecycleSection) ||
          /signed_in.*toggled/i.test(lifecycleSection);
        expect(hasSignedInToggle).toBe(true);
      });

      it('should document the death/respawn sub-loop', () => {
        // Given: Player lifecycle includes death/respawn
        // When: We check for death/respawn documentation
        // Then: Death/respawn sub-loop is documented
        const hasDeathRespawn =
          /death.*respawn/i.test(lifecycleSection) ||
          /respawn.*death/i.test(lifecycleSection) ||
          /incapacitated.*respawn/i.test(lifecycleSection) ||
          /health.*reaches?\s*0/i.test(lifecycleSection);
        expect(hasDeathRespawn).toBe(true);
      });

      it('should have a Mermaid sequence diagram for player lifecycle', () => {
        // Given: Each loop needs a Mermaid diagram
        // When: We check for a sequenceDiagram in the lifecycle section
        // Then: A Mermaid diagram exists
        const hasDiagram = /sequenceDiagram/i.test(lifecycleSection);
        expect(hasDiagram).toBe(true);
      });
    });

    // ==========================================================================
    // Building Loop (Task 6)
    // ==========================================================================
    describe('Building loop documentation (Task 6)', () => {
      let buildingSection: string;

      beforeAll(() => {
        buildingSection =
          extractSection(gameLoopsSection, 'Building') ||
          extractSection(content, 'Building Loop') ||
          extractSection(content, 'Building Placement') ||
          '';
      });

      it('should document the project_site_place reducer', () => {
        // Given: Building starts with site placement
        // When: We check for project_site_place
        // Then: project_site_place is documented
        expect(buildingSection).toContain('project_site_place');
      });

      it('should document the project_site_add_materials reducer', () => {
        // Given: Building requires adding materials
        // When: We check for project_site_add_materials
        // Then: project_site_add_materials is documented
        expect(buildingSection).toContain('project_site_add_materials');
      });

      it('should document claim membership/permissions precondition', () => {
        // Given: Building has identity/permission preconditions
        // When: We check for permission documentation
        // Then: Claim membership or permissions are documented
        const hasPermissions =
          /claim.*member/i.test(buildingSection) ||
          /permission/i.test(buildingSection) ||
          /claimed.*land/i.test(buildingSection);
        expect(hasPermissions).toBe(true);
      });

      it('should be classified as Phase 2', () => {
        // Given: Building is a Phase 2 loop
        // When: We check for Phase 2 classification
        // Then: Building is classified as Phase 2
        const isPhase2 =
          /phase\s*2/i.test(buildingSection) ||
          (gameLoopsSection.toLowerCase().includes('building') &&
            /building[^|]*phase\s*2/i.test(gameLoopsSection));
        expect(isPhase2).toBe(true);
      });

      it('should have a Mermaid sequence diagram for building', () => {
        // Given: Each loop needs a Mermaid diagram
        // When: We check for a sequenceDiagram in the building section
        // Then: A Mermaid diagram exists
        const hasDiagram = /sequenceDiagram/i.test(buildingSection);
        expect(hasDiagram).toBe(true);
      });
    });

    // ==========================================================================
    // Combat Loop (Task 7)
    // ==========================================================================
    describe('Combat loop documentation (Task 7)', () => {
      let combatSection: string;

      beforeAll(() => {
        combatSection =
          extractSection(gameLoopsSection, 'Combat') ||
          extractSection(content, 'Combat Loop') ||
          '';
      });

      it('should document the attack_start or attack reducer', () => {
        // Given: Combat involves attack reducers
        // When: We check for attack reducer
        // Then: attack or attack_start is documented
        const hasAttack =
          combatSection.includes('attack_start') || combatSection.includes('attack');
        expect(hasAttack).toBe(true);
      });

      it('should document target_update reducer', () => {
        // Given: Combat requires targeting
        // When: We check for target_update
        // Then: target_update is documented
        const hasTarget = combatSection.includes('target_update') || /target/i.test(combatSection);
        expect(hasTarget).toBe(true);
      });

      it('should be classified as Phase 2', () => {
        // Given: Combat is a Phase 2 loop
        // When: We check for Phase 2 classification
        // Then: Combat is classified as Phase 2
        const isPhase2 =
          /phase\s*2/i.test(combatSection) ||
          (gameLoopsSection.toLowerCase().includes('combat') &&
            /combat[^|]*phase\s*2/i.test(gameLoopsSection));
        expect(isPhase2).toBe(true);
      });

      it('should have a Mermaid sequence diagram for combat', () => {
        // Given: Each loop needs a Mermaid diagram
        // When: We check for a sequenceDiagram in the combat section
        // Then: A Mermaid diagram exists
        const hasDiagram = /sequenceDiagram/i.test(combatSection);
        expect(hasDiagram).toBe(true);
      });
    });

    // ==========================================================================
    // Trading Loop (Task 8)
    // ==========================================================================
    describe('Trading loop documentation (Task 8)', () => {
      let tradingSection: string;

      beforeAll(() => {
        tradingSection =
          extractSection(gameLoopsSection, 'Trading') ||
          extractSection(content, 'Trading Loop') ||
          '';
      });

      it('should document the P2P trade sequence', () => {
        // Given: Trading includes P2P trading
        // When: We check for P2P trade documentation
        // Then: P2P or direct trade is documented
        const hasP2P =
          /P2P/i.test(tradingSection) ||
          /trade_initiate_session/i.test(tradingSection) ||
          /direct.*trade/i.test(tradingSection);
        expect(hasP2P).toBe(true);
      });

      it('should document the market order sequence', () => {
        // Given: Trading includes market orders
        // When: We check for market order documentation
        // Then: Market orders are documented
        const hasMarket =
          /market.*order/i.test(tradingSection) ||
          /sell_order/i.test(tradingSection) ||
          /buy_order/i.test(tradingSection) ||
          /order_post/i.test(tradingSection);
        expect(hasMarket).toBe(true);
      });

      it('should be classified as Phase 2', () => {
        // Given: Trading is a Phase 2 loop
        // When: We check for Phase 2 classification
        // Then: Trading is classified as Phase 2
        const isPhase2 =
          /phase\s*2/i.test(tradingSection) ||
          (gameLoopsSection.toLowerCase().includes('trading') &&
            /trading[^|]*phase\s*2/i.test(gameLoopsSection));
        expect(isPhase2).toBe(true);
      });

      it('should have a Mermaid sequence diagram for trading', () => {
        // Given: Each loop needs a Mermaid diagram
        // When: We check for a sequenceDiagram in the trading section
        // Then: A Mermaid diagram exists
        const hasDiagram = /sequenceDiagram/i.test(tradingSection);
        expect(hasDiagram).toBe(true);
      });
    });

    // ==========================================================================
    // Chat Loop (Task 9)
    // ==========================================================================
    describe('Chat loop documentation (Task 9)', () => {
      let chatSection: string;

      beforeAll(() => {
        chatSection =
          extractSection(gameLoopsSection, 'Chat') || extractSection(content, 'Chat Loop') || '';
      });

      it('should document the chat_post_message reducer', () => {
        // Given: Chat involves posting messages
        // When: We check for chat_post_message
        // Then: chat_post_message is documented
        expect(chatSection).toContain('chat_post_message');
      });

      it('should document chat_message_state creation', () => {
        // Given: Chat creates message state entries
        // When: We check for chat_message_state
        // Then: chat_message_state is documented
        expect(chatSection).toContain('chat_message_state');
      });

      it('should document signed-in precondition', () => {
        // Given: Chat requires being signed in
        // When: We check for signed-in precondition
        // Then: Sign-in requirement is documented
        const hasSignedIn =
          /signed.*in/i.test(chatSection) ||
          /sign_in/i.test(chatSection) ||
          /player.*signed/i.test(chatSection);
        expect(hasSignedIn).toBe(true);
      });

      it('should have a Mermaid sequence diagram for chat', () => {
        // Given: Each loop needs a Mermaid diagram
        // When: We check for a sequenceDiagram in the chat section
        // Then: A Mermaid diagram exists
        const hasDiagram = /sequenceDiagram/i.test(chatSection);
        expect(hasDiagram).toBe(true);
      });
    });

    // ==========================================================================
    // Empire Loop (Task 9)
    // ==========================================================================
    describe('Empire loop documentation (Task 9)', () => {
      let empireSection: string;

      beforeAll(() => {
        empireSection =
          extractSection(gameLoopsSection, 'Empire') ||
          extractSection(content, 'Empire Loop') ||
          extractSection(content, 'Empire Management') ||
          '';
      });

      it('should document empire management reducers', () => {
        // Given: Empire has management reducers
        // When: We check for empire reducers
        // Then: Empire reducers are documented (at least one specific reducer name)
        const hasEmpireReducers =
          /empire_claim_join/i.test(empireSection) ||
          /empire_queue/i.test(empireSection) ||
          /empire_resupply/i.test(empireSection) ||
          /empire_deploy/i.test(empireSection);
        expect(hasEmpireReducers).toBe(true);
      });

      it('should be classified as Phase 2', () => {
        // Given: Empire is a Phase 2 loop
        // When: We check for Phase 2 classification
        // Then: Empire is classified as Phase 2
        const isPhase2 =
          /phase\s*2/i.test(empireSection) ||
          (gameLoopsSection.toLowerCase().includes('empire') &&
            /empire[^|]*phase\s*2/i.test(gameLoopsSection));
        expect(isPhase2).toBe(true);
      });

      it('should have a Mermaid sequence diagram for empire', () => {
        // Given: Each loop needs a Mermaid diagram
        // When: We check for a sequenceDiagram in the empire section
        // Then: A Mermaid diagram exists
        const hasDiagram = /sequenceDiagram/i.test(empireSection);
        expect(hasDiagram).toBe(true);
      });
    });

    // ==========================================================================
    // Precondition Quick Reference
    // ==========================================================================
    describe('Precondition Quick Reference', () => {
      it('should include a precondition quick reference section', () => {
        // Given: AC5 and Task 10.7 require a precondition quick reference
        // When: We search for the section
        // Then: A precondition quick reference exists
        const hasQuickRef =
          /precondition.*quick.*reference/i.test(gameLoopsSection) ||
          /quick.*reference.*precondition/i.test(gameLoopsSection) ||
          headings.some((h) => h.includes('precondition') && h.includes('quick reference'));
        expect(hasQuickRef).toBe(true);
      });

      it('should map preconditions to error messages', () => {
        // Given: The quick reference maps preconditions to error messages
        // When: We check for error message documentation
        // Then: Common error messages are documented
        const hasErrorMessages =
          /Not signed in/i.test(gameLoopsSection) ||
          /Not enough stamina/i.test(gameLoopsSection) ||
          /too far/i.test(gameLoopsSection) ||
          /Err\(".*"\)/i.test(gameLoopsSection) ||
          /error.*message/i.test(gameLoopsSection);
        expect(hasErrorMessages).toBe(true);
      });

      it('should document at least 5 common precondition-to-error mappings', () => {
        // Given: The quick reference has mappings
        // When: We count documented error patterns
        // Then: At least 5 precondition-to-error mappings exist
        const errorPatterns = [
          /Not signed in/i,
          /stamina/i,
          /too far/i,
          /Invalid/i,
          /incapacitated/i,
          /dead/i,
          /not.*alive/i,
          /permission/i,
          /not.*member/i,
        ];

        const foundErrors = errorPatterns.filter((pattern) => pattern.test(gameLoopsSection));
        expect(foundErrors.length).toBeGreaterThanOrEqual(5);
      });
    });

    // ==========================================================================
    // State transition table references
    // ==========================================================================
    describe('State transition table references', () => {
      it.each(STATE_TRANSITION_TABLES)(
        'should reference the "%s" table in game loop state transitions',
        (table) => {
          // Given: Game loops document state transitions
          // When: We search for this entity table
          // Then: The table is referenced in the game loops section
          expect(gameLoopsSection).toContain(table);
        }
      );

      it('should document at least 2 state transitions per loop for all 9 loops', () => {
        // Given: Completeness metrics require >= 2 state transitions per loop
        // When: We check all 9 game loops for state transition documentation
        // Then: Each loop documents at least 2 state transitions (via table names or table row entries)
        const allLoopNames = [
          'Player Lifecycle',
          'Movement',
          'Gathering',
          'Crafting',
          'Building',
          'Combat',
          'Trading',
          'Chat',
          'Empire',
        ];

        for (const loopName of allLoopNames) {
          const section =
            extractSection(gameLoopsSection, loopName) ||
            extractSection(content, `${loopName} Loop`) ||
            '';

          // Count unique state table references (tables ending in _state)
          const stateTableRefs = section.match(/[a-z_]+_state/gi);
          const uniqueStateTables = stateTableRefs
            ? new Set(stateTableRefs.map((t) => t.toLowerCase()))
            : new Set<string>();

          // Also count State Transitions table data rows as an alternative metric
          // (some Phase 2 loops use descriptive names rather than exact _state table names)
          const stateTransitionSection = extractSection(section, 'State Transitions');
          const transitionTableRows = stateTransitionSection.match(/^\|[^|]+\|[^|]+\|[^|]+\|/gm);
          const dataRows = transitionTableRows
            ? transitionTableRows.filter(
                (row) =>
                  !row.includes('---') && !row.includes('Tables Written') && !row.includes('Step')
              )
            : [];

          // Each loop should have at least 2 state transitions:
          // either 2+ unique _state table references OR 2+ state transition table rows
          const transitionCount = Math.max(uniqueStateTables.size, dataRows.length);
          expect(transitionCount).toBeGreaterThanOrEqual(2);
        }
      });
    });

    // ==========================================================================
    // Cross-reference with Stories 5.1 and 5.2 content preservation
    // ==========================================================================
    describe('Stories 5.1/5.2 content preservation', () => {
      it('should preserve Story 5.1 content (Reducer Catalog section)', () => {
        // Given: Story 5.1 created the Reducer Catalog section
        // When: We check that it still exists after Story 5.3 updates
        // Then: The Reducer Catalog section is preserved
        const hasReducerCatalog = headings.some(
          (h) => h.includes('reducer catalog') || (h.includes('reducer') && h.includes('catalog'))
        );
        expect(hasReducerCatalog).toBe(true);
      });

      it('should preserve Story 5.1 content (Identity Propagation section)', () => {
        // Given: Story 5.1 created the Identity Propagation section
        // When: We check that it still exists after Story 5.3 updates
        // Then: The Identity Propagation section is preserved
        const hasIdentitySection = headings.some(
          (h) => h.includes('identity') && h.includes('propagation')
        );
        expect(hasIdentitySection).toBe(true);
      });

      it('should preserve Story 5.2 content (State Model section)', () => {
        // Given: Story 5.2 created the State Model section
        // When: We check that it still exists after Story 5.3 updates
        // Then: The State Model section is preserved
        const hasStateModel = headings.some(
          (h) => h.includes('state model') || h.includes('state-model')
        );
        expect(hasStateModel).toBe(true);
      });

      it('should preserve Story 5.2 content (Entity-to-Concept Mapping section)', () => {
        // Given: Story 5.2 created the Entity-to-Concept Mapping section
        // When: We check that it still exists after Story 5.3 updates
        // Then: The Entity-to-Concept Mapping section is preserved
        const hasEntityMapping = headings.some(
          (h) =>
            (h.includes('entity') && h.includes('mapping')) ||
            (h.includes('entity') && h.includes('concept'))
        );
        expect(hasEntityMapping).toBe(true);
      });

      it('should preserve Story 5.2 content (Foreign Key Relationships section)', () => {
        // Given: Story 5.2 created the Foreign Key Relationships section
        // When: We check that it still exists after Story 5.3 updates
        // Then: The FK Relationships section is preserved
        const hasFKSection = headings.some(
          (h) => (h.includes('foreign') && h.includes('key')) || h.includes('relationship')
        );
        expect(hasFKSection).toBe(true);
      });

      it('should preserve Story 5.2 content (Subscription Requirements section)', () => {
        // Given: Story 5.2 created the Subscription Requirements section
        // When: We check that it still exists after Story 5.3 updates
        // Then: The Subscription Requirements section is preserved
        const hasSubscriptionSection = headings.some((h) => h.includes('subscription'));
        expect(hasSubscriptionSection).toBe(true);
      });

      it('should be substantially larger than Story 5.2 baseline', () => {
        // Given: Stories 5.1 + 5.2 created the initial document (currently ~1543 lines)
        // When: Story 5.3 adds the Game Loops section with 9+ loops, diagrams, etc.
        // Then: The document should be substantially larger
        // Expect at least 60K chars (5.1+5.2 is ~50K; Game Loops adds ~15-25K)
        expect(content.length).toBeGreaterThan(60000);
      });
    });

    // ==========================================================================
    // Document structure and formatting
    // ==========================================================================
    describe('Document structure and formatting', () => {
      it('should use snake_case for all reducer names in game loops', () => {
        // Given: BitCraft uses snake_case for reducer names
        // When: We check reducer name format in the Game Loops section
        // Then: No camelCase reducer names appear
        const reducerNames = gameLoopsSection.match(/`([a-z][a-z0-9_]*)\s*\(/g);
        if (reducerNames && reducerNames.length > 0) {
          const camelCaseReducers = reducerNames.filter((name) => /[A-Z]/.test(name));
          expect(camelCaseReducers).toHaveLength(0);
        }
      });

      it('should use snake_case for all table names in game loops', () => {
        // Given: BitCraft uses snake_case for table names
        // When: We check table name format in the Game Loops section
        // Then: No camelCase table names appear for _state tables
        const tableNames = gameLoopsSection.match(/`([a-z][a-zA-Z0-9_]*_state)`/g);
        if (tableNames && tableNames.length > 0) {
          const camelCaseNames = tableNames.filter((name) => /[A-Z]/.test(name.replace(/`/g, '')));
          expect(camelCaseNames).toHaveLength(0);
        }
      });

      it('should use consistent reducer names with Story 5.1 catalog', () => {
        // Given: Story 5.1 established the reducer naming
        // When: We check for key reducer names
        // Then: They match the names used in Story 5.1
        const story51Reducers = [
          'player_move',
          'extract_start',
          'extract',
          'craft_initiate_start',
          'sign_in',
          'sign_out',
        ];
        const allPresent = story51Reducers.every((reducer) => gameLoopsSection.includes(reducer));
        expect(allPresent).toBe(true);
      });

      it('should use consistent table names with Story 5.2 mapping', () => {
        // Given: Story 5.2 established the table naming
        // When: We check for key table names
        // Then: They match the names used in Story 5.2
        const story52Tables = [
          'player_state',
          'mobile_entity_state',
          'inventory_state',
          'progressive_action_state',
          'health_state',
        ];
        const allPresent = story52Tables.every((table) => gameLoopsSection.includes(table));
        expect(allPresent).toBe(true);
      });

      it('should use correct Mermaid sequenceDiagram syntax', () => {
        // Given: Mermaid diagrams must render in GitHub Markdown
        // When: We check diagram syntax
        // Then: Standard sequenceDiagram syntax is used
        const mermaidBlocks = gameLoopsSection.match(/```mermaid([\s\S]*?)```/gi);
        if (mermaidBlocks) {
          for (const block of mermaidBlocks) {
            if (block.includes('sequenceDiagram')) {
              // Should have participant definitions
              expect(/participant/i.test(block)).toBe(true);
              // Should have arrow syntax
              expect(/->>|-->>|-->|->>/i.test(block)).toBe(true);
            }
          }
        }
      });
    });

    // ==========================================================================
    // Progressive action pattern documentation in game loops
    // ==========================================================================
    describe('Progressive action pattern in game loops', () => {
      it('should document the two-phase _start + complete pattern in game loops', () => {
        // Given: Many game actions use the progressive action pattern
        // When: We check the game loops section
        // Then: The two-phase pattern is explained
        const hasProgressivePattern =
          /progressive.*action/i.test(gameLoopsSection) ||
          /two.*phase/i.test(gameLoopsSection) ||
          /_start.*complet/i.test(gameLoopsSection);
        expect(hasProgressivePattern).toBe(true);
      });

      it('should document timing between _start and completion for gathering', () => {
        // Given: Gathering uses the progressive action pattern
        // When: We check the gathering section
        // Then: Timing between extract_start and extract is documented
        const gatheringSection =
          extractSection(gameLoopsSection, 'Gathering') ||
          extractSection(content, 'Gathering Loop') ||
          '';
        const hasTiming = /timer|timing|wait|duration|delay|progressive_action_state/i.test(
          gatheringSection
        );
        expect(hasTiming).toBe(true);
      });

      it('should document timing between _start and completion for crafting', () => {
        // Given: Crafting uses the progressive action pattern
        // When: We check the crafting section
        // Then: Timing between craft_*_start and craft_* is documented
        const craftingSection =
          extractSection(gameLoopsSection, 'Crafting') ||
          extractSection(content, 'Crafting Loop') ||
          '';
        const hasTiming = /timer|timing|wait|duration|delay|progressive_action_state/i.test(
          craftingSection
        );
        expect(hasTiming).toBe(true);
      });

      it('should document that movement/death cancels progressive actions', () => {
        // Given: Progressive actions can be cancelled
        // When: We check for cancellation documentation
        // Then: Cancellation conditions are documented
        const hasCancellation =
          /cancel/i.test(gameLoopsSection) ||
          /invalidat/i.test(gameLoopsSection) ||
          /interrupt/i.test(gameLoopsSection);
        expect(hasCancellation).toBe(true);
      });
    });

    // ==========================================================================
    // BLOCKER-1 impact on game loops
    // ==========================================================================
    describe('BLOCKER-1 impact on game loops', () => {
      it('should document whether each loop can be tested via direct WebSocket', () => {
        // Given: BLOCKER-1 affects BLS handler usage
        // When: We check for WebSocket vs BLS documentation
        // Then: Testing approach is documented (WebSocket bypass recommended)
        const hasWebSocketDoc =
          /WebSocket/i.test(gameLoopsSection) ||
          /direct.*connect/i.test(gameLoopsSection) ||
          /bypass.*BLS/i.test(gameLoopsSection) ||
          /BLOCKER-1/i.test(gameLoopsSection);
        expect(hasWebSocketDoc).toBe(true);
      });
    });

    // ==========================================================================
    // Completeness metrics (non-duplicate aggregation checks)
    // Note: Diagram count, precondition categories, and classification coverage
    // are validated in the AC5 sections above. This section validates the
    // aggregate game loop count which is not covered elsewhere.
    // ==========================================================================
    describe('Completeness metrics', () => {
      it('should have >= 9 game loops documented', () => {
        // Given: The story requires >= 9 game loops
        // When: We count loop subsections
        // Then: At least 9 loops are documented
        const loopHeadings = REQUIRED_GAME_LOOPS.filter((loop) =>
          gameLoopsSection.toLowerCase().includes(loop.toLowerCase())
        );
        expect(loopHeadings.length).toBeGreaterThanOrEqual(9);
      });
    });
  }
);
