/**
 * Decision Log Rotation Tests (AC: 3)
 * Story 4.6: Structured Decision Logging
 *
 * Tests for log rotation: size threshold checks, rotation triggering,
 * file naming, post-rotation behavior, and configuration options.
 * All file I/O is mocked via vitest.
 *
 * Test count: 10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecisionLogger } from '../decision-logger.js';
import type { DecisionContext, DecisionLoggerConfig } from '../decision-log-types.js';

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
  rename: vi.fn().mockResolvedValue(undefined),
}));

import { appendFile, stat, rename } from 'node:fs/promises';

/**
 * Creates a valid DecisionContext for testing.
 */
function createTestContext(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    observation: 'Rotation test event',
    semanticEvents: [],
    skillTriggered: {
      name: 'test_skill',
      description: 'Test skill for rotation',
      matchContext: 'Test context',
    },
    action: { reducer: 'test_reducer', args: [] },
    cost: 1,
    result: 'success',
    outcome: 'Test outcome',
    agentConfig: {
      agentMdVersion: 'v1.0',
      activeSkills: ['test_skill'],
    },
    decisionLatencyMs: 10,
    ...overrides,
  };
}

function createTestConfig(overrides?: Partial<DecisionLoggerConfig>): DecisionLoggerConfig {
  return {
    filePath: '/tmp/rotation-test.jsonl',
    maxFileSizeBytes: 100 * 1024 * 1024,
    rotationEnabled: true,
    ...overrides,
  };
}

describe('Decision Log Rotation (Story 4.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stat).mockResolvedValue({ size: 0 } as any);
  });

  describe('AC3 - Log rotation at 100MB', () => {
    it('file under 100MB -> no rotation triggered', async () => {
      // Given a file under 100MB
      vi.mocked(stat).mockResolvedValue({ size: 50 * 1024 * 1024 } as any);
      const logger = new DecisionLogger(createTestConfig());

      // When a decision is logged
      await logger.logDecision(createTestContext());

      // Then rename is NOT called (no rotation)
      expect(rename).not.toHaveBeenCalled();
      // And appendFile IS called (entry written)
      expect(appendFile).toHaveBeenCalledOnce();
    });

    it('file exceeds 100MB -> rotation triggered before next append', async () => {
      // Given a file over 100MB
      vi.mocked(stat).mockResolvedValue({ size: 105 * 1024 * 1024 } as any);
      const logger = new DecisionLogger(createTestConfig());

      // When a decision is logged
      await logger.logDecision(createTestContext());

      // Then rename IS called (rotation happened)
      expect(rename).toHaveBeenCalledOnce();
      // And appendFile IS called after rotation (entry written to fresh file)
      expect(appendFile).toHaveBeenCalledOnce();
    });

    it('rotated file named with ISO timestamp suffix', async () => {
      // Given a file over 100MB
      vi.mocked(stat).mockResolvedValue({ size: 105 * 1024 * 1024 } as any);
      const logger = new DecisionLogger(createTestConfig({ filePath: '/tmp/decisions.jsonl' }));

      // When a decision is logged (triggering rotation)
      await logger.logDecision(createTestContext());

      // Then the rotated file name contains an ISO timestamp with hyphens instead of colons
      const renameCall = vi.mocked(rename).mock.calls[0];
      expect(renameCall[0]).toBe('/tmp/decisions.jsonl');
      const rotatedName = renameCall[1] as string;
      // Should match pattern like: /tmp/decisions-2026-03-15T12-00-00-000Z.jsonl
      expect(rotatedName).toMatch(
        /\/tmp\/decisions-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.jsonl$/
      );
    });

    it('after rotation, new entries written to original file path (fresh file)', async () => {
      // Given a file over 100MB
      vi.mocked(stat).mockResolvedValue({ size: 105 * 1024 * 1024 } as any);
      const logger = new DecisionLogger(createTestConfig({ filePath: '/tmp/decisions.jsonl' }));

      // When a decision is logged (triggering rotation)
      await logger.logDecision(createTestContext());

      // Then appendFile writes to the ORIGINAL file path (not the rotated one)
      const appendCall = vi.mocked(appendFile).mock.calls[0];
      expect(appendCall[0]).toBe('/tmp/decisions.jsonl');
    });

    it('old rotated file preserved (not deleted)', async () => {
      // Given a file over 100MB
      vi.mocked(stat).mockResolvedValue({ size: 105 * 1024 * 1024 } as any);
      const logger = new DecisionLogger(createTestConfig());

      // When rotation occurs
      await logger.logDecision(createTestContext());

      // Then only rename was called (no unlink/delete operations)
      expect(rename).toHaveBeenCalledOnce();
      // The old file is renamed, not deleted -- rename preserves it
    });

    it('rotation disabled in config -> no rotation even when file exceeds 100MB', async () => {
      // Given rotation is disabled and file exceeds threshold
      vi.mocked(stat).mockResolvedValue({ size: 200 * 1024 * 1024 } as any);
      const logger = new DecisionLogger(createTestConfig({ rotationEnabled: false }));

      // When a decision is logged
      await logger.logDecision(createTestContext());

      // Then rename is NOT called (rotation disabled)
      expect(rename).not.toHaveBeenCalled();
      // And appendFile IS called (entry written to existing file)
      expect(appendFile).toHaveBeenCalledOnce();
    });

    it('custom maxFileSizeBytes config respected', async () => {
      // Given a custom threshold of 10MB and file at 11MB
      vi.mocked(stat).mockResolvedValue({ size: 11 * 1024 * 1024 } as any);
      const logger = new DecisionLogger(createTestConfig({ maxFileSizeBytes: 10 * 1024 * 1024 }));

      // When a decision is logged
      await logger.logDecision(createTestContext());

      // Then rotation IS triggered (exceeds custom 10MB threshold)
      expect(rename).toHaveBeenCalledOnce();
    });

    it('file does not exist -> getFileSize() returns 0 (no error)', async () => {
      // Given stat throws ENOENT (file does not exist)
      const enoentError = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
      vi.mocked(stat).mockRejectedValue(enoentError);
      const logger = new DecisionLogger(createTestConfig());

      // When getFileSize is called indirectly via logDecision
      // Then it does NOT throw and the entry is written
      await expect(logger.logDecision(createTestContext())).resolves.toBeUndefined();
      expect(appendFile).toHaveBeenCalledOnce();
      // No rotation should be triggered for non-existent file
      expect(rename).not.toHaveBeenCalled();
    });

    it('stat fails with non-ENOENT error -> getFileSize() returns 0 defensively', async () => {
      // Given stat throws a non-ENOENT error (e.g., permission denied)
      const permError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      vi.mocked(stat).mockRejectedValue(permError);
      const logger = new DecisionLogger(createTestConfig());

      // When a decision is logged
      // Then it does NOT throw and the entry is written (defensive 0 return means no rotation)
      await expect(logger.logDecision(createTestContext())).resolves.toBeUndefined();
      expect(appendFile).toHaveBeenCalledOnce();
      expect(rename).not.toHaveBeenCalled();
    });

    it('rename fails during rotation -> logger continues writing to current file', async () => {
      // Given a file over 100MB and rename will fail
      vi.mocked(stat).mockResolvedValue({ size: 105 * 1024 * 1024 } as any);
      vi.mocked(rename).mockRejectedValueOnce(new Error('EACCES: permission denied'));
      const logger = new DecisionLogger(createTestConfig());

      // When a decision is logged (rotation attempted but rename fails)
      await expect(logger.logDecision(createTestContext())).resolves.toBeUndefined();

      // Then rename was attempted
      expect(rename).toHaveBeenCalledOnce();
      // And the entry is still written to the original file (logger continues)
      expect(appendFile).toHaveBeenCalledOnce();
    });
  });
});
