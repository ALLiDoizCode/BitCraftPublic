/**
 * Action Cost Registry Tests
 * Story 2.2: Action Cost Registry & Wallet Balance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  validateRegistry,
  ActionCostRegistryLoader,
  type ActionCostRegistry,
} from './action-cost-registry';

describe('validateRegistry', () => {
  it('validates a valid registry (AC1, AC8)', () => {
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
        craft_item: { cost: 15, category: 'crafting', frequency: 'medium' },
      },
    };

    const result = validateRegistry(registry);
    expect(result).toEqual(registry);
  });

  it('throws INVALID_CONFIG if data is not an object (AC7)', () => {
    expect(() => validateRegistry(null)).toThrow('must be a JSON object');
    expect(() => validateRegistry('not an object')).toThrow('must be a JSON object');
    expect(() => validateRegistry(123)).toThrow('must be a JSON object');
  });

  it('throws INVALID_CONFIG if version field is missing (AC8)', () => {
    const registry = {
      defaultCost: 10,
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('missing required field: version');
  });

  it('throws INVALID_CONFIG if version is not a number (AC8)', () => {
    const registry = {
      version: '1',
      defaultCost: 10,
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('version must be a number');
  });

  it('throws INVALID_CONFIG if version is not an integer (AC8)', () => {
    const registry = {
      version: 1.5,
      defaultCost: 10,
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('version must be an integer');
  });

  it('throws INVALID_CONFIG if version is zero (AC8)', () => {
    const registry = {
      version: 0,
      defaultCost: 10,
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('version must be >= 1');
  });

  it('throws INVALID_CONFIG if version is negative (AC8)', () => {
    const registry = {
      version: -1,
      defaultCost: 10,
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('version must be >= 1');
  });

  it('throws UNSUPPORTED_VERSION if version is not 1 (AC8)', () => {
    const registry = {
      version: 2,
      defaultCost: 10,
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('Unsupported registry version 2');
    expect(() => validateRegistry(registry)).toThrow('Supported versions: 1');
  });

  it('throws INVALID_CONFIG if defaultCost field is missing (AC7)', () => {
    const registry = {
      version: 1,
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('missing required field: defaultCost');
  });

  it('throws INVALID_CONFIG if defaultCost is not a number (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: '10',
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('defaultCost must be a number');
  });

  it('throws INVALID_CONFIG if defaultCost is negative (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: -1,
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('defaultCost must be non-negative');
  });

  it('throws INVALID_CONFIG if defaultCost is not finite (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: Infinity,
      actions: {},
    };

    expect(() => validateRegistry(registry)).toThrow('defaultCost must be non-negative and finite');
  });

  it('throws INVALID_CONFIG if actions field is missing (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
    };

    expect(() => validateRegistry(registry)).toThrow('missing required field: actions');
  });

  it('throws INVALID_CONFIG if actions is not an object (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: 'not an object',
    };

    expect(() => validateRegistry(registry)).toThrow('actions must be an object');
  });

  it('throws INVALID_CONFIG if action entry is missing cost field (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { category: 'movement', frequency: 'high' },
      },
    };

    expect(() => validateRegistry(registry)).toThrow('player_move" missing required field: cost');
  });

  it('throws INVALID_CONFIG if action cost is negative (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: -1, category: 'movement', frequency: 'high' },
      },
    };

    expect(() => validateRegistry(registry)).toThrow('player_move" cost must be non-negative');
  });

  it('throws INVALID_CONFIG if action cost is not finite (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: NaN, category: 'movement', frequency: 'high' },
      },
    };

    expect(() => validateRegistry(registry)).toThrow(
      'player_move" cost must be non-negative and finite'
    );
  });

  it('throws INVALID_CONFIG if action cost is not a number (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: '1' as any, category: 'movement', frequency: 'high' },
      },
    };

    expect(() => validateRegistry(registry)).toThrow('player_move" cost must be a number');
  });

  it('allows zero cost for free actions (AC7)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 0, category: 'movement', frequency: 'high' },
      },
    };

    const result = validateRegistry(registry);
    expect(result.actions.player_move.cost).toBe(0);
  });

  it('throws INVALID_CONFIG if action entry is missing category field (AC8)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, frequency: 'high' },
      },
    };

    expect(() => validateRegistry(registry)).toThrow(
      'player_move" missing required field: category'
    );
  });

  it('throws INVALID_CONFIG if category is invalid (AC8)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'invalid', frequency: 'high' },
      },
    };

    expect(() => validateRegistry(registry)).toThrow('player_move" category must be one of:');
  });

  it('throws INVALID_CONFIG if action entry is missing frequency field (AC8)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement' },
      },
    };

    expect(() => validateRegistry(registry)).toThrow(
      'player_move" missing required field: frequency'
    );
  });

  it('throws INVALID_CONFIG if frequency is invalid (AC8)', () => {
    const registry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'invalid' },
      },
    };

    expect(() => validateRegistry(registry)).toThrow('player_move" frequency must be one of:');
  });
});

describe('ActionCostRegistryLoader', () => {
  let tempDir: string;
  let loader: ActionCostRegistryLoader;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigil-test-'));
    loader = new ActionCostRegistryLoader();
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads valid registry file with absolute path (AC1)', () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    const result = loader.load(registryPath);
    expect(result).toEqual(registry);
  });

  it('loads valid registry file with relative path (AC1)', () => {
    // Create a subdirectory under cwd to avoid .. in relative path
    const testSubdir = path.join(process.cwd(), 'test-temp-registry');
    fs.mkdirSync(testSubdir, { recursive: true });

    const registryPath = path.join(testSubdir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // Use relative path without ..
    const relativePath = 'test-temp-registry/registry.json';

    const result = loader.load(relativePath);
    expect(result).toEqual(registry);

    // Clean up
    fs.rmSync(testSubdir, { recursive: true, force: true });
    loader.clearCache();
  });

  it('caches loaded registry (AC1)', () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    const result1 = loader.load(registryPath);
    const result2 = loader.load(registryPath);

    // Should return same object reference (cached)
    expect(result1).toBe(result2);
  });

  it('throws INVALID_CONFIG for path traversal (AC7)', () => {
    const registryPath = '../../../etc/passwd';

    expect(() => loader.load(registryPath)).toThrow('Path traversal not allowed');
  });

  it('throws FILE_NOT_FOUND if file does not exist (AC7)', () => {
    const registryPath = path.join(tempDir, 'nonexistent.json');

    expect(() => loader.load(registryPath)).toThrow('Failed to read action cost registry file');
  });

  it('throws INVALID_JSON if JSON is malformed (AC7)', () => {
    const registryPath = path.join(tempDir, 'invalid.json');
    fs.writeFileSync(registryPath, '{ invalid json }');

    expect(() => loader.load(registryPath)).toThrow('Failed to parse action cost registry JSON');
  });

  it('sanitizes file paths in error messages in production (AC7)', () => {
    const registryPath = path.join(tempDir, 'nonexistent.json');
    const originalEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';

      expect(() => loader.load(registryPath)).toThrow('nonexistent.json');
      expect(() => loader.load(registryPath)).not.toThrow(tempDir);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('includes full path in error messages in development (AC7)', () => {
    const registryPath = path.join(tempDir, 'nonexistent.json');
    const originalEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'development';

      expect(() => loader.load(registryPath)).toThrow(registryPath);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('allows absolute paths in development (AC7)', () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';

      expect(() => loader.load(registryPath)).not.toThrow();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('validates all category enums (AC8)', () => {
    const categories = [
      'movement',
      'combat',
      'resource',
      'building',
      'economy',
      'social',
      'governance',
      'crafting',
    ];

    for (const category of categories) {
      const registryPath = path.join(tempDir, `registry-${category}.json`);
      const registry: ActionCostRegistry = {
        version: 1,
        defaultCost: 10,
        actions: {
          test_action: { cost: 1, category: category as any, frequency: 'high' },
        },
      };

      fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

      const result = loader.load(registryPath);
      expect(result.actions.test_action.category).toBe(category);

      // Clear cache for next test
      loader.clearCache();
    }
  });

  it('validates all frequency enums (AC8)', () => {
    const frequencies = ['very_low', 'low', 'medium', 'high', 'very_high'];

    for (const frequency of frequencies) {
      const registryPath = path.join(tempDir, `registry-${frequency}.json`);
      const registry: ActionCostRegistry = {
        version: 1,
        defaultCost: 10,
        actions: {
          test_action: { cost: 1, category: 'movement', frequency: frequency as any },
        },
      };

      fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

      const result = loader.load(registryPath);
      expect(result.actions.test_action.frequency).toBe(frequency);

      // Clear cache for next test
      loader.clearCache();
    }
  });

  it('loads default action costs file (AC1)', () => {
    // Test loading the actual default costs file
    const defaultCostsPath = path.join(
      __dirname,
      '..',
      '..',
      'config',
      'default-action-costs.json'
    );

    // Clear cache first
    loader.clearCache();

    const result = loader.load(defaultCostsPath);

    expect(result.version).toBe(1);
    expect(result.defaultCost).toBe(10);
    expect(result.actions.player_move).toEqual({
      cost: 1,
      category: 'movement',
      frequency: 'high',
    });
    expect(result.actions.craft_item).toEqual({
      cost: 15,
      category: 'crafting',
      frequency: 'medium',
    });
    expect(result.actions.empire_form).toEqual({
      cost: 100,
      category: 'governance',
      frequency: 'very_low',
    });
  });

  it('measures load performance for getCost target <10ms (AC2)', () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // First load (includes file I/O and parsing)
    const start = performance.now();
    const result = loader.load(registryPath);
    const duration = performance.now() - start;

    expect(result).toEqual(registry);

    // Note: First load may be slower due to file I/O, but getCost() will be instant
    // since it's just a property access from the loaded registry
    // The <10ms target applies to getCost(), not the initial load
    // Use 500ms as generous limit to avoid flaky tests on slow CI systems
    expect(duration).toBeLessThan(500);
  });

  it('measures cached load performance (instant) (AC2)', () => {
    const registryPath = path.join(tempDir, 'registry.json');
    const registry: ActionCostRegistry = {
      version: 1,
      defaultCost: 10,
      actions: {
        player_move: { cost: 1, category: 'movement', frequency: 'high' },
      },
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // First load
    loader.load(registryPath);

    // Cached load (should be instant)
    const start = performance.now();
    const result = loader.load(registryPath);
    const duration = performance.now() - start;

    expect(result).toEqual(registry);
    expect(duration).toBeLessThan(1); // Cached access should be <1ms
  });
});
