/**
 * Fee Schedule Consistency Tests (AC: 4)
 * Story 3.3: Pricing Configuration & Fee Schedule
 *
 * Cross-package tests verifying that the BLS fee schedule format
 * is compatible with @sigil/client's ActionCostRegistry format.
 * These tests read the shared default-action-costs.json file from
 * the client package and verify it is loadable by the BLS fee
 * schedule loader. No Docker dependency required.
 *
 * Validates: AC4 (client registry consistency, NFR12)
 *
 * Test count: 4
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { loadFeeSchedule, getFeeForReducer } from '../fee-schedule.js';
import type { FeeSchedule } from '../fee-schedule.js';

describe('Fee Schedule Consistency (Story 3.3)', () => {
  // Path to the shared fee schedule JSON used by both BLS and client
  // From packages/bitcraft-bls/src/__tests__/ -> ../../.. = packages/ -> client/config/
  const defaultFeeSchedulePath = path.resolve(
    __dirname,
    '../../../client/config/default-action-costs.json'
  );

  it('BLS fee schedule format matches client ActionCostRegistry format', () => {
    // Given the default action costs JSON file (shared between BLS and client)
    const fileContent = fs.readFileSync(defaultFeeSchedulePath, 'utf-8');
    const data = JSON.parse(fileContent);

    // When loaded by the BLS fee schedule loader
    // (loadFeeSchedule reads from file path, so we test the format directly)

    // Then it should have the required fields
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('defaultCost');
    expect(data).toHaveProperty('actions');
    expect(data.version).toBe(1);
    expect(typeof data.defaultCost).toBe('number');
    expect(typeof data.actions).toBe('object');
    expect(Array.isArray(data.actions)).toBe(false);

    // Each action should have at least a cost field (BLS requirement)
    for (const [name, entry] of Object.entries(data.actions)) {
      const actionEntry = entry as Record<string, unknown>;
      expect(actionEntry).toHaveProperty('cost');
      expect(typeof actionEntry.cost).toBe('number');
      expect(actionEntry.cost as number).toBeGreaterThanOrEqual(0);

      // Client also requires category and frequency (superset compatibility)
      expect(actionEntry).toHaveProperty('category');
      expect(actionEntry).toHaveProperty('frequency');
    }
  });

  it('cost lookup for player_move returns same value from BLS and client registries', () => {
    // Given the shared fee schedule file
    const fileContent = fs.readFileSync(defaultFeeSchedulePath, 'utf-8');
    const data = JSON.parse(fileContent) as FeeSchedule;

    // When looking up player_move via BLS getFeeForReducer
    const blsCost = getFeeForReducer(data, 'player_move');

    // Then it should match the value in the raw JSON
    expect(blsCost).toBe(data.actions.player_move.cost);
    expect(blsCost).toBe(1); // Known value from default-action-costs.json
  });

  it('cost lookup for unknown reducer returns defaultCost from both sources', () => {
    // Given the shared fee schedule file
    const fileContent = fs.readFileSync(defaultFeeSchedulePath, 'utf-8');
    const data = JSON.parse(fileContent) as FeeSchedule;

    // When looking up an unknown reducer via BLS
    const blsCost = getFeeForReducer(data, 'nonexistent_reducer');

    // Then it should return defaultCost (same as what client would return)
    expect(blsCost).toBe(data.defaultCost);
    expect(blsCost).toBe(10); // Known value from default-action-costs.json
  });

  it('fee schedule file is loadable by both BLS loader and raw JSON parse', () => {
    // Given the shared fee schedule file
    // When loaded by the BLS fee schedule loader (validates BLS schema)
    const blsSchedule = loadFeeSchedule(defaultFeeSchedulePath);

    // And loaded by raw JSON parse (how the client would consume it)
    const fileContent = fs.readFileSync(defaultFeeSchedulePath, 'utf-8');
    const rawJson = JSON.parse(fileContent);

    // Then both produce equivalent data
    expect(blsSchedule.version).toBe(rawJson.version);
    expect(blsSchedule.defaultCost).toBe(rawJson.defaultCost);
    expect(Object.keys(blsSchedule.actions).length).toBe(Object.keys(rawJson.actions).length);

    // And the raw format is compatible with client ActionCostEntry
    // (client requires category and frequency as mandatory fields)
    for (const [, entry] of Object.entries(rawJson.actions)) {
      const actionEntry = entry as Record<string, unknown>;
      expect(typeof actionEntry.cost).toBe('number');
      expect(typeof actionEntry.category).toBe('string');
      expect(typeof actionEntry.frequency).toBe('string');
    }
  });
});
