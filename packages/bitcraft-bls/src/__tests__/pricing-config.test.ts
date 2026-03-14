/**
 * Pricing Configuration Tests (AC: 1, 2)
 * Story 3.3: Pricing Configuration & Fee Schedule
 *
 * Tests for fee schedule integration into BLSConfig, including
 * kindPricing derivation from fee schedule and createPricingValidator behavior.
 *
 * Validates: AC1 (kindPricing in createNode), AC2 (fee schedule loading via config)
 *
 * Test count: 11
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { loadConfig } from '../config.js';
import { createPricingValidator } from '@crosstown/sdk';
import { createBLSConfigEnv } from './factories/bls-config.factory.js';

// Mock fs.readFileSync for fee schedule file loading
vi.mock('node:fs');

describe('Pricing Configuration (Story 3.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('kindPricing in createNode (AC1)', () => {
    it('kindPricing includes kind 30078 with configured price', () => {
      // Given a valid fee schedule with actions
      const feeJson = JSON.stringify({
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
          empire_form: { cost: 100 },
        },
      });
      vi.mocked(fs.readFileSync).mockReturnValue(feeJson);

      const env = createBLSConfigEnv({
        BLS_FEE_SCHEDULE_PATH: '/config/fee-schedule.json',
      });

      // When loadConfig is called
      const config = loadConfig(env);

      // Then kindPricing should include kind 30078
      expect(config.kindPricing).toBeDefined();
      expect(config.kindPricing[30078]).toBeDefined();
      expect(typeof config.kindPricing[30078]).toBe('bigint');
    });

    it('uses default kindPricing { 30078: 100n } when no fee schedule path provided', () => {
      // Given no BLS_FEE_SCHEDULE_PATH in environment
      const env = createBLSConfigEnv();
      // Remove fee schedule path (ensure it is not set)
      delete (env as Record<string, string | undefined>).BLS_FEE_SCHEDULE_PATH;

      // When loadConfig is called
      const config = loadConfig(env);

      // Then kindPricing should be the hardcoded default
      expect(config.kindPricing).toEqual({ 30078: 100n });
    });
  });

  describe('Fee schedule loading via config (AC1, AC2)', () => {
    it('loads fee schedule from BLS_FEE_SCHEDULE_PATH when set', () => {
      // Given a valid fee schedule file path in environment
      const feeJson = JSON.stringify({
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
        },
      });
      vi.mocked(fs.readFileSync).mockReturnValue(feeJson);

      const env = createBLSConfigEnv({
        BLS_FEE_SCHEDULE_PATH: '/config/fee-schedule.json',
      });

      // When loadConfig is called
      const config = loadConfig(env);

      // Then the fee schedule should be loaded onto the config
      expect(config.feeSchedule).toBeDefined();
      expect(config.feeSchedule?.version).toBe(1);
      expect(config.feeSchedule?.defaultCost).toBe(10);
      expect(config.feeSchedule?.actions.player_move.cost).toBe(1);
    });

    it('throws error for invalid fee schedule path (startup failure)', () => {
      // Given an invalid fee schedule path
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      const env = createBLSConfigEnv({
        BLS_FEE_SCHEDULE_PATH: '/nonexistent/fee-schedule.json',
      });

      // When/Then loadConfig should throw (fail-safe startup)
      expect(() => loadConfig(env)).toThrow();
    });
  });

  describe('kindPricing derivation from fee schedule (AC1)', () => {
    it('kindPricing[30078] derived as minimum of defaultCost and all action costs', () => {
      // Given a fee schedule with cheapest action at cost 1 and defaultCost 10
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

      const env = createBLSConfigEnv({
        BLS_FEE_SCHEDULE_PATH: '/config/fee-schedule.json',
      });

      // When loadConfig is called
      const config = loadConfig(env);

      // Then kindPricing[30078] should be the minimum: 1n (from player_move)
      expect(config.kindPricing[30078]).toBe(1n);
    });

    it('fee schedule with cheapest action cost 1 and defaultCost 10 produces kindPricing { 30078: 1n }', () => {
      // Given the specific example from the story spec
      const feeJson = JSON.stringify({
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1 },
        },
      });
      vi.mocked(fs.readFileSync).mockReturnValue(feeJson);

      const env = createBLSConfigEnv({
        BLS_FEE_SCHEDULE_PATH: '/config/fee-schedule.json',
      });

      // When loadConfig is called
      const config = loadConfig(env);

      // Then kindPricing should be { 30078: 1n } (minimum of 1 and 10)
      expect(config.kindPricing).toEqual({ 30078: 1n });
    });
  });

  describe('createPricingValidator behavior (AC1, AC3)', () => {
    it('createPricingValidator rejects amount below configured price (F04)', () => {
      // Given kindPricing with 30078 at 100n
      const validator = createPricingValidator({ 30078: 100n });

      // When validating amount below price
      const result = validator(30078, 50n);

      // Then it should reject with F04
      expect(result.valid).toBe(false);
      expect(result.code).toBe('F04');
    });

    it('createPricingValidator accepts amount at or above configured price', () => {
      // Given kindPricing with 30078 at 100n
      const validator = createPricingValidator({ 30078: 100n });

      // When validating amount at price
      const resultAt = validator(30078, 100n);
      expect(resultAt.valid).toBe(true);

      // When validating amount above price
      const resultAbove = validator(30078, 200n);
      expect(resultAbove.valid).toBe(true);
    });

    it('createPricingValidator allows unpriced kinds (no rule = free)', () => {
      // Given kindPricing with only kind 30078
      const validator = createPricingValidator({ 30078: 100n });

      // When validating a kind not in the pricing map
      const result = validator(30079, 0n);

      // Then it should be valid (no pricing rule = free)
      expect(result.valid).toBe(true);
    });
  });

  describe('Config defaults (AC1, AC2)', () => {
    it('config includes fee schedule object when loaded', () => {
      // Given a valid fee schedule path
      const feeJson = JSON.stringify({
        version: 1,
        defaultCost: 10,
        actions: { player_move: { cost: 1 } },
      });
      vi.mocked(fs.readFileSync).mockReturnValue(feeJson);

      const env = createBLSConfigEnv({
        BLS_FEE_SCHEDULE_PATH: '/config/fee-schedule.json',
      });

      // When loadConfig is called
      const config = loadConfig(env);

      // Then feeSchedule should be populated
      expect(config.feeSchedule).toBeDefined();
      expect(config.feeSchedulePath).toBe('/config/fee-schedule.json');
    });

    it('config defaults when no fee schedule provided', () => {
      // Given no fee schedule path
      const env = createBLSConfigEnv();
      delete (env as Record<string, string | undefined>).BLS_FEE_SCHEDULE_PATH;

      // When loadConfig is called
      const config = loadConfig(env);

      // Then feeSchedule should be undefined and kindPricing should be default
      expect(config.feeSchedule).toBeUndefined();
      expect(config.feeSchedulePath).toBeUndefined();
      expect(config.kindPricing).toEqual({ 30078: 100n });
    });
  });
});
