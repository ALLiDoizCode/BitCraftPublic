/**
 * Decision Log Metrics Tests (AC: 6)
 * Story 4.6: Structured Decision Logging
 *
 * Tests for computeMetrics() and parseJsonlFile() utilities:
 * per-skill metrics derivation (invocation count, trigger accuracy,
 * latency, cost), aggregate metrics, and JSONL parsing.
 *
 * Test count: 18
 */

import { describe, it, expect } from 'vitest';
import { computeMetrics, parseJsonlFile } from '../decision-log-metrics.js';
import type { DecisionLogEntry, AggregateMetrics, EvalResult } from '../decision-log-types.js';

/**
 * Creates a DecisionLogEntry for metrics testing.
 */
function createLogEntry(overrides?: Partial<DecisionLogEntry>): DecisionLogEntry {
  return {
    timestamp: '2026-03-15T12:00:00.000Z',
    observation: 'Test observation',
    semanticEvents: [],
    skillTriggered: {
      name: 'harvest_wood',
      description: 'Harvest wood from nearby trees',
      matchContext: 'Player near oak tree',
    },
    action: {
      reducer: 'harvest_resource',
      args: ['oak1', 'wood'],
    },
    cost: 5,
    result: 'success',
    outcome: 'Successfully harvested wood',
    agentConfig: {
      agentMdVersion: 'v1.0',
      activeSkills: ['harvest_wood'],
    },
    metrics: {
      decisionLatencyMs: 100,
      actionLatencyMs: 50,
    },
    ...overrides,
  };
}

describe('Decision Log Metrics (Story 4.6)', () => {
  describe('AC6 - computeMetrics()', () => {
    it('computeMetrics() with single success entry -> invocationCount=1, successCount=1, triggerAccuracy=1.0', () => {
      // Given a single success entry
      const entries = [createLogEntry({ result: 'success' })];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then per-skill metrics reflect one success
      const skill = metrics.perSkill.get('harvest_wood')!;
      expect(skill.invocationCount).toBe(1);
      expect(skill.successCount).toBe(1);
      expect(skill.triggerAccuracy).toBe(1.0);
    });

    it('computeMetrics() with mixed results -> correct per-skill counts', () => {
      // Given entries with mixed results for the same skill
      const entries = [
        createLogEntry({ result: 'success' }),
        createLogEntry({ result: 'failure' }),
        createLogEntry({ result: 'skipped' }),
        createLogEntry({ result: 'success' }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then counts are correct
      const skill = metrics.perSkill.get('harvest_wood')!;
      expect(skill.invocationCount).toBe(4);
      expect(skill.successCount).toBe(2);
      expect(skill.failureCount).toBe(1);
      expect(skill.skippedCount).toBe(1);
      expect(skill.triggerAccuracy).toBe(0.5); // 2/4
    });

    it('computeMetrics() with multiple skills -> separate SkillMetrics per skill', () => {
      // Given entries for different skills
      const entries = [
        createLogEntry({
          skillTriggered: {
            name: 'harvest_wood',
            description: 'Harvest',
            matchContext: 'Near tree',
          },
          result: 'success',
        }),
        createLogEntry({
          skillTriggered: {
            name: 'build_shelter',
            description: 'Build',
            matchContext: 'Open area',
          },
          result: 'success',
        }),
        createLogEntry({
          skillTriggered: {
            name: 'harvest_wood',
            description: 'Harvest',
            matchContext: 'Near tree',
          },
          result: 'failure',
        }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then separate skill metrics exist
      expect(metrics.perSkill.size).toBe(2);
      expect(metrics.perSkill.has('harvest_wood')).toBe(true);
      expect(metrics.perSkill.has('build_shelter')).toBe(true);
      expect(metrics.perSkill.get('harvest_wood')!.invocationCount).toBe(2);
      expect(metrics.perSkill.get('build_shelter')!.invocationCount).toBe(1);
    });

    it('computeMetrics() derives invocation count per skill', () => {
      // Given 3 entries for the same skill
      const entries = [
        createLogEntry({ result: 'success' }),
        createLogEntry({ result: 'success' }),
        createLogEntry({ result: 'failure' }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then invocation count is 3
      expect(metrics.perSkill.get('harvest_wood')!.invocationCount).toBe(3);
    });

    it('computeMetrics() derives trigger accuracy per skill (success / total)', () => {
      // Given 4 entries: 3 success, 1 failure
      const entries = [
        createLogEntry({ result: 'success' }),
        createLogEntry({ result: 'success' }),
        createLogEntry({ result: 'success' }),
        createLogEntry({ result: 'failure' }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then trigger accuracy is 0.75
      expect(metrics.perSkill.get('harvest_wood')!.triggerAccuracy).toBe(0.75);
    });

    it('computeMetrics() derives average decision latency per skill', () => {
      // Given entries with varying decision latency
      const entries = [
        createLogEntry({ metrics: { decisionLatencyMs: 100, actionLatencyMs: 50 } }),
        createLogEntry({ metrics: { decisionLatencyMs: 200, actionLatencyMs: 60 } }),
        createLogEntry({ metrics: { decisionLatencyMs: 300, actionLatencyMs: 70 } }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then average decision latency is 200ms
      expect(metrics.perSkill.get('harvest_wood')!.avgDecisionLatencyMs).toBe(200);
    });

    it('computeMetrics() derives average action latency (excludes undefined entries)', () => {
      // Given entries where some lack actionLatencyMs
      const entries = [
        createLogEntry({ metrics: { decisionLatencyMs: 100, actionLatencyMs: 50 } }),
        createLogEntry({ metrics: { decisionLatencyMs: 100 } }), // no actionLatencyMs
        createLogEntry({ metrics: { decisionLatencyMs: 100, actionLatencyMs: 150 } }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then average action latency only includes the two entries with values: (50+150)/2 = 100
      expect(metrics.perSkill.get('harvest_wood')!.avgActionLatencyMs).toBe(100);
    });

    it('computeMetrics() derives total cost per skill', () => {
      // Given entries with costs
      const entries = [
        createLogEntry({ cost: 5 }),
        createLogEntry({ cost: 10 }),
        createLogEntry({ cost: null }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then total cost is 15 (null treated as 0)
      expect(metrics.perSkill.get('harvest_wood')!.totalCost).toBe(15);
    });

    it('computeMetrics() with null skillTriggered -> grouped under (no skill)', () => {
      // Given entries with null skillTriggered
      const entries = [
        createLogEntry({ skillTriggered: null, result: 'skipped' }),
        createLogEntry({ skillTriggered: null, result: 'skipped' }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then grouped under '(no skill)'
      expect(metrics.perSkill.has('(no skill)')).toBe(true);
      expect(metrics.perSkill.get('(no skill)')!.invocationCount).toBe(2);
    });

    it('computeMetrics() with empty entries array -> zeroed-out aggregate metrics', () => {
      // Given no entries
      const entries: DecisionLogEntry[] = [];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then zeroed-out metrics
      expect(metrics.totalDecisions).toBe(0);
      expect(metrics.totalCost).toBe(0);
      expect(metrics.overallSuccessRate).toBe(0);
      expect(metrics.perSkill.size).toBe(0);
      expect(metrics.evalResults).toEqual([]);
    });
  });

  describe('AC6 - parseJsonlFile()', () => {
    it('parseJsonlFile() parses valid JSONL content into entries', () => {
      // Given valid JSONL content
      const entry1 = createLogEntry({ observation: 'Entry 1' });
      const entry2 = createLogEntry({ observation: 'Entry 2' });
      const content = JSON.stringify(entry1) + '\n' + JSON.stringify(entry2) + '\n';

      // When parsed
      const entries = parseJsonlFile(content);

      // Then returns array of entries
      expect(entries).toHaveLength(2);
      expect(entries[0].observation).toBe('Entry 1');
      expect(entries[1].observation).toBe('Entry 2');
    });

    it('parseJsonlFile() throws on invalid JSON with line number', () => {
      // Given JSONL content with an invalid line
      const entry1 = createLogEntry({ observation: 'Valid' });
      const content = JSON.stringify(entry1) + '\n' + '{ invalid json }\n';

      // When parsed -> throws with line number context
      expect(() => parseJsonlFile(content)).toThrow(/line 2/i);
    });

    it('parseJsonlFile() filters out empty lines', () => {
      // Given JSONL content with empty lines interspersed
      const entry1 = createLogEntry({ observation: 'Entry 1' });
      const entry2 = createLogEntry({ observation: 'Entry 2' });
      const content = '\n' + JSON.stringify(entry1) + '\n\n' + JSON.stringify(entry2) + '\n\n';

      // When parsed
      const entries = parseJsonlFile(content);

      // Then empty lines are skipped and only valid entries returned
      expect(entries).toHaveLength(2);
      expect(entries[0].observation).toBe('Entry 1');
      expect(entries[1].observation).toBe('Entry 2');
    });

    it('parseJsonlFile() returns empty array for empty string input', () => {
      // Given empty content
      const entries = parseJsonlFile('');

      // Then returns empty array
      expect(entries).toHaveLength(0);
    });
  });

  describe('AC6 - Aggregate metrics (overall)', () => {
    it('computeMetrics() derives overallSuccessRate from entries', () => {
      // Given entries with mixed results
      const entries = [
        createLogEntry({ result: 'success' }),
        createLogEntry({ result: 'success' }),
        createLogEntry({ result: 'failure' }),
        createLogEntry({ result: 'skipped' }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then overallSuccessRate is 2/4 = 0.5
      expect(metrics.overallSuccessRate).toBe(0.5);
    });

    it('computeMetrics() derives totalCost at aggregate level', () => {
      // Given entries with costs across multiple skills
      const entries = [
        createLogEntry({
          skillTriggered: {
            name: 'harvest_wood',
            description: 'Harvest',
            matchContext: 'Near tree',
          },
          cost: 5,
        }),
        createLogEntry({
          skillTriggered: {
            name: 'build_shelter',
            description: 'Build',
            matchContext: 'Open area',
          },
          cost: 10,
        }),
        createLogEntry({
          skillTriggered: {
            name: 'harvest_wood',
            description: 'Harvest',
            matchContext: 'Near tree',
          },
          cost: null,
        }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then totalCost at aggregate level is sum of all costs (null treated as 0)
      expect(metrics.totalCost).toBe(15);
      expect(metrics.totalDecisions).toBe(3);
    });

    it('computeMetrics() evalResults is always empty array (populated by external tooling)', () => {
      // Given entries
      const entries = [
        createLogEntry({ result: 'success' }),
        createLogEntry({ result: 'failure' }),
      ];

      // When metrics are computed
      const metrics = computeMetrics(entries);

      // Then evalResults is an empty array (Story 11.4 populates this externally)
      expect(metrics.evalResults).toEqual([]);
      expect(Array.isArray(metrics.evalResults)).toBe(true);
    });

    it('EvalResult type is compatible with eval pass/fail tracking schema', () => {
      // Given an EvalResult (used by external eval tooling per Story 11.4)
      const evalResult: EvalResult = {
        skillName: 'harvest_wood',
        evalName: 'correct-tree-selection',
        passed: true,
        details: 'Agent correctly selected nearest oak tree for harvesting',
      };

      // Then the type is well-formed and all fields are accessible
      expect(evalResult.skillName).toBe('harvest_wood');
      expect(evalResult.evalName).toBe('correct-tree-selection');
      expect(evalResult.passed).toBe(true);
      expect(evalResult.details).toContain('correctly selected');

      // And it can be included in AggregateMetrics
      const metrics: AggregateMetrics = {
        totalDecisions: 1,
        totalCost: 5,
        overallSuccessRate: 1.0,
        perSkill: new Map(),
        evalResults: [evalResult],
      };
      expect(metrics.evalResults).toHaveLength(1);
      expect(metrics.evalResults[0].passed).toBe(true);
    });
  });
});
