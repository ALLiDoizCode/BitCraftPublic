/**
 * Fee Schedule Loader Tests (AC: 2, 4)
 * Story 3.3: Pricing Configuration & Fee Schedule
 *
 * Tests for loadFeeSchedule(), getFeeForReducer(), and FeeScheduleError.
 * Validates JSON parsing, schema validation, path traversal protection,
 * and file size limits.
 *
 * Validates: AC2 (fee schedule loading), AC4 (client registry consistency)
 *
 * Test count: 15
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';

// Module under test (not yet created -- TDD red phase)
import { loadFeeSchedule, getFeeForReducer, FeeScheduleError } from '../fee-schedule.js';
import type { FeeSchedule } from '../fee-schedule.js';

// Mock fs.readFileSync to avoid real file system access in unit tests
vi.mock('node:fs');

describe('Fee Schedule Loader (Story 3.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadFeeSchedule() - Valid inputs (AC2)', () => {
    it('parses valid fee schedule JSON successfully', () => {
      // Given a valid fee schedule JSON file
      const validJson = JSON.stringify({
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1, category: 'movement', frequency: 'high' },
          craft_item: { cost: 15, category: 'crafting', frequency: 'medium' },
        },
      });
      vi.mocked(fs.readFileSync).mockReturnValue(validJson);

      // When loadFeeSchedule is called
      const schedule = loadFeeSchedule('/config/fee-schedule.json');

      // Then it should parse successfully
      expect(schedule).toBeDefined();
      expect(schedule.version).toBe(1);
      expect(schedule.defaultCost).toBe(10);
      expect(schedule.actions).toBeDefined();
      expect(schedule.actions.player_move.cost).toBe(1);
      expect(schedule.actions.craft_item.cost).toBe(15);
    });

    it('loads fee schedule with per-reducer costs -- each reducer has different cost', () => {
      // Given a fee schedule with diverse per-reducer costs
      const feeJson = JSON.stringify({
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
          craft_item: { cost: 15 },
          empire_form: { cost: 100 },
        },
      });
      vi.mocked(fs.readFileSync).mockReturnValue(feeJson);

      // When loadFeeSchedule is called
      const schedule = loadFeeSchedule('/config/fee-schedule.json');

      // Then each reducer should have its specific cost
      expect(schedule.actions.player_move.cost).toBe(1);
      expect(schedule.actions.craft_item.cost).toBe(15);
      expect(schedule.actions.empire_form.cost).toBe(100);
    });
  });

  describe('getFeeForReducer() (AC2, AC4)', () => {
    it('returns action cost for known reducer', () => {
      // Given a fee schedule with player_move at cost 1
      const schedule: FeeSchedule = {
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
          craft_item: { cost: 15 },
        },
      };

      // When looking up player_move
      const cost = getFeeForReducer(schedule, 'player_move');

      // Then the specific cost should be returned
      expect(cost).toBe(1);
    });

    it('returns defaultCost for unknown reducer', () => {
      // Given a fee schedule with defaultCost 10
      const schedule: FeeSchedule = {
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
        },
      };

      // When looking up an unknown reducer
      const cost = getFeeForReducer(schedule, 'unknown_action');

      // Then the defaultCost should be returned
      expect(cost).toBe(10);
    });
  });

  describe('loadFeeSchedule() - Validation errors (AC2)', () => {
    it('throws FeeScheduleError for missing version field', () => {
      // Given JSON without a version field
      const invalidJson = JSON.stringify({ defaultCost: 10, actions: {} });
      vi.mocked(fs.readFileSync).mockReturnValue(invalidJson);

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/invalid.json')).toThrow(FeeScheduleError);
    });

    it('throws FeeScheduleError for invalid version (not 1)', () => {
      // Given JSON with version 2
      const invalidJson = JSON.stringify({ version: 2, defaultCost: 10, actions: {} });
      vi.mocked(fs.readFileSync).mockReturnValue(invalidJson);

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/invalid.json')).toThrow(FeeScheduleError);
    });

    it('throws FeeScheduleError for missing defaultCost', () => {
      // Given JSON without defaultCost
      const invalidJson = JSON.stringify({ version: 1, actions: {} });
      vi.mocked(fs.readFileSync).mockReturnValue(invalidJson);

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/invalid.json')).toThrow(FeeScheduleError);
    });

    it('throws FeeScheduleError for negative defaultCost', () => {
      // Given JSON with negative defaultCost
      const invalidJson = JSON.stringify({ version: 1, defaultCost: -5, actions: {} });
      vi.mocked(fs.readFileSync).mockReturnValue(invalidJson);

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/invalid.json')).toThrow(FeeScheduleError);
    });

    it('throws FeeScheduleError for missing actions field', () => {
      // Given JSON without actions field
      const invalidJson = JSON.stringify({ version: 1, defaultCost: 10 });
      vi.mocked(fs.readFileSync).mockReturnValue(invalidJson);

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/invalid.json')).toThrow(FeeScheduleError);
    });

    it('throws FeeScheduleError for non-object actions field (array)', () => {
      // Given JSON where actions is an array instead of object
      const invalidJson = JSON.stringify({ version: 1, defaultCost: 10, actions: [] });
      vi.mocked(fs.readFileSync).mockReturnValue(invalidJson);

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/invalid.json')).toThrow(FeeScheduleError);
    });

    it('throws FeeScheduleError for action entry with negative cost', () => {
      // Given JSON with a negative action cost
      const invalidJson = JSON.stringify({
        version: 1,
        defaultCost: 10,
        actions: { player_move: { cost: -1 } },
      });
      vi.mocked(fs.readFileSync).mockReturnValue(invalidJson);

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/invalid.json')).toThrow(FeeScheduleError);
    });
  });

  describe('loadFeeSchedule() - Additional validation (AC2)', () => {
    it('throws FeeScheduleError for invalid JSON content', () => {
      // Given a file with completely invalid JSON
      vi.mocked(fs.readFileSync).mockReturnValue('this is not json {{{');

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/invalid.json')).toThrow(FeeScheduleError);
    });

    it('throws FeeScheduleError for action entry missing cost field', () => {
      // Given JSON with an action entry that has no cost field
      const invalidJson = JSON.stringify({
        version: 1,
        defaultCost: 10,
        actions: { player_move: { category: 'movement' } },
      });
      vi.mocked(fs.readFileSync).mockReturnValue(invalidJson);

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/invalid.json')).toThrow(FeeScheduleError);
    });
  });

  describe('loadFeeSchedule() - Security (OWASP A03)', () => {
    it('throws FeeScheduleError for file content exceeding 1MB', () => {
      // Given file content exceeding 1MB
      const largeContent = 'x'.repeat(1024 * 1024 + 1);
      vi.mocked(fs.readFileSync).mockReturnValue(largeContent);

      // When/Then loadFeeSchedule should throw FeeScheduleError
      expect(() => loadFeeSchedule('/config/large.json')).toThrow(FeeScheduleError);
      expect(() => loadFeeSchedule('/config/large.json')).toThrow(/exceed/i);
    });

    it('throws FeeScheduleError for path containing ".." segments (path traversal)', () => {
      // Given a file path with path traversal segments (OWASP A03)
      // When/Then loadFeeSchedule should throw FeeScheduleError before reading the file
      expect(() => loadFeeSchedule('/config/../etc/passwd')).toThrow(FeeScheduleError);
      expect(() => loadFeeSchedule('../secret/fee.json')).toThrow(FeeScheduleError);

      // And readFileSync should NOT have been called (path rejected before I/O)
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });
});
