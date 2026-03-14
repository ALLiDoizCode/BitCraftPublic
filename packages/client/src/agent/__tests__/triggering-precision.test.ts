/**
 * Triggering Precision Validator Tests (AC: 5)
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Tests for validateTriggeringPrecision() that detects overlapping
 * skill descriptions using Jaccard similarity.
 *
 * Validates: AC5 (triggering precision validation)
 *
 * Test count: 10
 */

import { describe, it, expect } from 'vitest';
import { validateTriggeringPrecision } from '../triggering-precision.js';
import type { Skill } from '../types.js';

/**
 * Factory to create a test Skill with a specific description
 */
function createSkillWithDescription(name: string, description: string): Skill {
  return {
    name,
    description,
    reducer: name,
    params: [],
    subscriptions: [],
    body: `# ${name}\n\nBody for ${name}.`,
    evals: [],
  };
}

describe('Triggering Precision Validator (Story 4.2)', () => {
  describe('AC5 - Triggering precision validation', () => {
    it('two skills with identical descriptions -> warning with similarity 1.0', () => {
      // Given two skills with the exact same description
      const skills = [
        createSkillWithDescription(
          'skill_a',
          'Move the player character to a target location on the map.'
        ),
        createSkillWithDescription(
          'skill_b',
          'Move the player character to a target location on the map.'
        ),
      ];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then the report should have a warning with similarity 1.0
      expect(report.passed).toBe(false);
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0].similarity).toBe(1.0);
      expect(report.warnings[0].skillA).toBe('skill_a');
      expect(report.warnings[0].skillB).toBe('skill_b');
    });

    it('two skills with clearly distinct descriptions -> no warning, report passes', () => {
      // Given two skills with very different descriptions
      const skills = [
        createSkillWithDescription(
          'player_move',
          'Move the player character to a target hex coordinate on the game map.'
        ),
        createSkillWithDescription(
          'craft_item',
          'Craft an item using a recipe, consuming required materials from inventory.'
        ),
      ];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then the report should pass with no warnings
      expect(report.passed).toBe(true);
      expect(report.warnings).toHaveLength(0);
    });

    it('one description is substring of another -> warning', () => {
      // Given two skills where one description is contained in the other
      const skills = [
        createSkillWithDescription('short_skill', 'Move to a location'),
        createSkillWithDescription(
          'long_skill',
          'Move to a location on the hex grid using pathfinding'
        ),
      ];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then the report should have a warning (substring containment)
      expect(report.passed).toBe(false);
      expect(report.warnings).toHaveLength(1);
    });

    it('high token overlap (>= 0.7 Jaccard) -> warning', () => {
      // Given two skills with high token overlap (many shared significant words)
      const skills = [
        createSkillWithDescription(
          'harvest_wood',
          'Harvest wood resources from nearby resource nodes using gathering tools quickly'
        ),
        createSkillWithDescription(
          'harvest_stone',
          'Harvest stone resources from nearby resource nodes using gathering tools quickly'
        ),
      ];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then the report should have a warning (high token overlap)
      expect(report.passed).toBe(false);
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0].similarity).toBeGreaterThanOrEqual(0.7);
    });

    it('low token overlap (< 0.7 Jaccard) -> no warning', () => {
      // Given two skills with low token overlap
      const skills = [
        createSkillWithDescription(
          'move_skill',
          'Navigate character across terrain hexes using pathfinding algorithms'
        ),
        createSkillWithDescription(
          'trade_skill',
          'Exchange items with another player through marketplace interface'
        ),
      ];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then the report should pass (low overlap)
      expect(report.passed).toBe(true);
      expect(report.warnings).toHaveLength(0);
    });

    it('single skill -> no overlap, report passes', () => {
      // Given only one skill (no pair to compare)
      const skills = [
        createSkillWithDescription('only_skill', 'The one and only skill in the system'),
      ];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then the report should pass (no overlap possible)
      expect(report.passed).toBe(true);
      expect(report.warnings).toHaveLength(0);
    });

    it('zero skills -> report passes, empty warnings', () => {
      // Given no skills
      const skills: Skill[] = [];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then the report should pass
      expect(report.passed).toBe(true);
      expect(report.warnings).toHaveLength(0);
    });

    it('warning includes both skill names and similarity score', () => {
      // Given two skills with identical descriptions
      const skills = [
        createSkillWithDescription('alpha', 'Perform an action on the target entity'),
        createSkillWithDescription('beta', 'Perform an action on the target entity'),
      ];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then the warning should include both names and a valid similarity score
      expect(report.warnings).toHaveLength(1);
      const warning = report.warnings[0];
      expect(warning.skillA).toBe('alpha');
      expect(warning.skillB).toBe('beta');
      expect(warning.similarity).toBeGreaterThanOrEqual(0);
      expect(warning.similarity).toBeLessThanOrEqual(1);
      expect(typeof warning.reason).toBe('string');
      expect(warning.reason.length).toBeGreaterThan(0);
    });

    it('three skills, one pair overlapping -> exactly one warning for that pair', () => {
      // Given 3 skills where only 2 have overlapping descriptions
      const skills = [
        createSkillWithDescription(
          'move_player',
          'Move the player character to a target hex coordinate on the game map.'
        ),
        createSkillWithDescription(
          'walk_player',
          'Move the player character to a target hex coordinate on the game map.'
        ),
        createSkillWithDescription(
          'craft_item',
          'Craft an item using a recipe, consuming required materials from inventory.'
        ),
      ];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then exactly one warning should be generated for the overlapping pair
      expect(report.passed).toBe(false);
      expect(report.warnings).toHaveLength(1);
      expect(
        (report.warnings[0].skillA === 'move_player' &&
          report.warnings[0].skillB === 'walk_player') ||
          (report.warnings[0].skillA === 'walk_player' &&
            report.warnings[0].skillB === 'move_player')
      ).toBe(true);
    });

    it('stop words excluded from token comparison (descriptions differing only in stop words -> high similarity)', () => {
      // Given two skills whose descriptions differ only in stop words
      // After removing stop words: both become essentially the same tokens
      const skills = [
        createSkillWithDescription('skill_a', 'harvest the resource from a nearby node'),
        createSkillWithDescription('skill_b', 'harvest resource from nearby node'),
      ];

      // When validateTriggeringPrecision is called
      const report = validateTriggeringPrecision(skills);

      // Then the report should detect high similarity (stop words removed, tokens are identical)
      expect(report.passed).toBe(false);
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0].similarity).toBeGreaterThanOrEqual(0.7);
    });
  });
});
