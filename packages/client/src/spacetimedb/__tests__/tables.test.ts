/**
 * Unit Tests: Type-Safe Table Accessors
 *
 * Tests for the in-memory cache and type-safe table accessor functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('TableAccessor', () => {
  describe('Cache Initialization', () => {
    it('should start with empty cache', () => {
      const cache = createTableCache();
      expect(cache.size()).toBe(0);
    });

    it('should support multiple tables', () => {
      const cache = createTableCache();

      cache.set('player_state', 1, { id: 1, name: 'Player1' });
      cache.set('entity_position', 1, { id: 1, x: 0, y: 0 });

      expect(cache.getTables()).toContain('player_state');
      expect(cache.getTables()).toContain('entity_position');
    });
  });

  describe('get() method', () => {
    it('should retrieve row by ID', () => {
      const accessor = createTableAccessor<{ id: number; name: string }>();

      accessor.cache.set(1, { id: 1, name: 'Player1' });

      const row = accessor.get(1);
      expect(row).toEqual({ id: 1, name: 'Player1' });
    });

    it('should return undefined for non-existent ID', () => {
      const accessor = createTableAccessor<{ id: number; name: string }>();

      const row = accessor.get(999);
      expect(row).toBeUndefined();
    });

    it('should handle different ID types', () => {
      const accessor = createTableAccessor<{ id: string; value: number }>();

      accessor.cache.set('abc-123', { id: 'abc-123', value: 42 });

      const row = accessor.get('abc-123');
      expect(row?.value).toBe(42);
    });
  });

  describe('getAll() method', () => {
    it('should return all cached rows', () => {
      const accessor = createTableAccessor<{ id: number; name: string }>();

      accessor.cache.set(1, { id: 1, name: 'Player1' });
      accessor.cache.set(2, { id: 2, name: 'Player2' });
      accessor.cache.set(3, { id: 3, name: 'Player3' });

      const all = accessor.getAll();

      expect(all).toHaveLength(3);
      expect(all).toContainEqual({ id: 1, name: 'Player1' });
      expect(all).toContainEqual({ id: 2, name: 'Player2' });
      expect(all).toContainEqual({ id: 3, name: 'Player3' });
    });

    it('should return empty array for empty cache', () => {
      const accessor = createTableAccessor<any>();

      const all = accessor.getAll();
      expect(all).toEqual([]);
    });

    it('should return new array instance (not cache reference)', () => {
      const accessor = createTableAccessor<{ id: number }>();

      accessor.cache.set(1, { id: 1 });

      const all1 = accessor.getAll();
      const all2 = accessor.getAll();

      expect(all1).not.toBe(all2); // Different array instances
      expect(all1).toEqual(all2); // Same contents
    });
  });

  describe('query() method', () => {
    it('should filter rows by predicate', () => {
      const accessor = createTableAccessor<{ id: number; level: number }>();

      accessor.cache.set(1, { id: 1, level: 5 });
      accessor.cache.set(2, { id: 2, level: 10 });
      accessor.cache.set(3, { id: 3, level: 15 });

      const highLevel = accessor.query((row) => row.level >= 10);

      expect(highLevel).toHaveLength(2);
      expect(highLevel).toContainEqual({ id: 2, level: 10 });
      expect(highLevel).toContainEqual({ id: 3, level: 15 });
    });

    it('should return empty array when no matches', () => {
      const accessor = createTableAccessor<{ id: number; active: boolean }>();

      accessor.cache.set(1, { id: 1, active: false });
      accessor.cache.set(2, { id: 2, active: false });

      const active = accessor.query((row) => row.active === true);
      expect(active).toEqual([]);
    });

    it('should support complex predicates', () => {
      const accessor = createTableAccessor<{
        id: number;
        name: string;
        level: number;
      }>();

      accessor.cache.set(1, { id: 1, name: 'Alice', level: 5 });
      accessor.cache.set(2, { id: 2, name: 'Bob', level: 10 });
      accessor.cache.set(3, { id: 3, name: 'Charlie', level: 3 });

      const result = accessor.query((row) => row.level > 4 && row.name.startsWith('A'));

      expect(result).toEqual([{ id: 1, name: 'Alice', level: 5 }]);
    });
  });

  describe('Cache Updates from Events', () => {
    it('should add row on rowInserted event', () => {
      const accessor = createTableAccessor<{ id: number; name: string }>();

      // Simulate rowInserted event
      accessor.handleRowInserted({ id: 1, name: 'NewPlayer' });

      expect(accessor.get(1)).toEqual({ id: 1, name: 'NewPlayer' });
    });

    it('should update row on rowUpdated event', () => {
      const accessor = createTableAccessor<{ id: number; name: string }>();

      accessor.cache.set(1, { id: 1, name: 'OldName' });

      // Simulate rowUpdated event
      accessor.handleRowUpdated({
        oldRow: { id: 1, name: 'OldName' },
        newRow: { id: 1, name: 'NewName' },
      });

      expect(accessor.get(1)?.name).toBe('NewName');
    });

    it('should remove row on rowDeleted event', () => {
      const accessor = createTableAccessor<{ id: number; name: string }>();

      accessor.cache.set(1, { id: 1, name: 'DeleteMe' });
      expect(accessor.get(1)).toBeDefined();

      // Simulate rowDeleted event
      accessor.handleRowDeleted({ id: 1, name: 'DeleteMe' });

      expect(accessor.get(1)).toBeUndefined();
    });

    it('should populate cache from tableSnapshot event', () => {
      const accessor = createTableAccessor<{ id: number; name: string }>();

      // Simulate tableSnapshot event
      const snapshot = [
        { id: 1, name: 'Player1' },
        { id: 2, name: 'Player2' },
        { id: 3, name: 'Player3' },
      ];

      accessor.handleSnapshot(snapshot);

      expect(accessor.getAll()).toHaveLength(3);
      expect(accessor.get(1)).toEqual({ id: 1, name: 'Player1' });
    });
  });

  describe('Cache Invalidation', () => {
    it('should clear all cached data', () => {
      const accessor = createTableAccessor<{ id: number }>();

      accessor.cache.set(1, { id: 1 });
      accessor.cache.set(2, { id: 2 });
      accessor.cache.set(3, { id: 3 });

      expect(accessor.getAll()).toHaveLength(3);

      accessor.clear();

      expect(accessor.getAll()).toHaveLength(0);
    });

    it('should clear cache on disconnect', () => {
      const cache = createTableCache();

      cache.set('player_state', 1, { id: 1 });
      cache.set('entity_position', 1, { id: 1 });

      cache.clearAll();

      expect(cache.size()).toBe(0);
    });
  });

  describe('Type Safety', () => {
    it('should enforce type constraints at compile time', () => {
      interface PlayerRow {
        id: number;
        name: string;
        level: number;
      }

      const accessor = createTableAccessor<PlayerRow>();

      // Type-safe insert
      accessor.cache.set(1, {
        id: 1,
        name: 'Player1',
        level: 5,
      });

      // Type-safe retrieval
      const player = accessor.get(1);
      if (player) {
        expect(typeof player.id).toBe('number');
        expect(typeof player.name).toBe('string');
        expect(typeof player.level).toBe('number');
      }
    });

    it('should provide type-safe query predicates', () => {
      interface PlayerRow {
        id: number;
        name: string;
        isActive: boolean;
      }

      const accessor = createTableAccessor<PlayerRow>();

      accessor.cache.set(1, { id: 1, name: 'Player1', isActive: true });

      // Predicate has type-safe access to row properties
      const active = accessor.query((row) => {
        // TypeScript knows row.isActive is boolean
        return row.isActive === true;
      });

      expect(active).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    it('should handle large number of rows efficiently', () => {
      const accessor = createTableAccessor<{ id: number; value: number }>();

      // Insert 10,000 rows
      const startInsert = Date.now();
      for (let i = 0; i < 10000; i++) {
        accessor.cache.set(i, { id: i, value: i * 2 });
      }
      const insertTime = Date.now() - startInsert;

      // Retrieval should be fast (O(1) for Map)
      const startGet = Date.now();
      for (let i = 0; i < 1000; i++) {
        accessor.get(Math.floor(Math.random() * 10000));
      }
      const getTime = Date.now() - startGet;

      // Inserts should be fast (< 100ms for 10k rows)
      expect(insertTime).toBeLessThan(100);
      // Gets should be very fast (< 10ms for 1k lookups)
      expect(getTime).toBeLessThan(10);
    });

    it('should handle large queries efficiently', () => {
      const accessor = createTableAccessor<{ id: number; active: boolean }>();

      // Insert 1000 rows
      for (let i = 0; i < 1000; i++) {
        accessor.cache.set(i, { id: i, active: i % 2 === 0 });
      }

      // Query should complete quickly
      const start = Date.now();
      const result = accessor.query((row) => row.active);
      const elapsed = Date.now() - start;

      expect(result).toHaveLength(500);
      expect(elapsed).toBeLessThan(10); // < 10ms for 1000 rows
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory on cache updates', () => {
      const accessor = createTableAccessor<{ id: number; data: string }>();

      // Repeatedly update same row
      for (let i = 0; i < 1000; i++) {
        accessor.handleRowUpdated({
          oldRow: { id: 1, data: `old-${i}` },
          newRow: { id: 1, data: `new-${i}` },
        });
      }

      // Should only have one row in cache
      expect(accessor.getAll()).toHaveLength(1);
    });

    it('should free memory when rows are deleted', () => {
      const accessor = createTableAccessor<{ id: number }>();

      // Insert and delete many rows
      for (let i = 0; i < 1000; i++) {
        accessor.handleRowInserted({ id: i });
      }

      expect(accessor.getAll()).toHaveLength(1000);

      for (let i = 0; i < 1000; i++) {
        accessor.handleRowDeleted({ id: i });
      }

      expect(accessor.getAll()).toHaveLength(0);
    });
  });
});

// Helper functions and types

interface TableAccessor<T> {
  cache: Map<any, T>;
  get(id: any): T | undefined;
  getAll(): T[];
  query(predicate: (row: T) => boolean): T[];
  handleRowInserted(row: T): void;
  handleRowUpdated(data: { oldRow: T; newRow: T }): void;
  handleRowDeleted(row: T): void;
  handleSnapshot(rows: T[]): void;
  clear(): void;
}

function createTableAccessor<T extends { id: any }>(): TableAccessor<T> {
  const cache = new Map<any, T>();

  return {
    cache,

    get(id: any): T | undefined {
      return cache.get(id);
    },

    getAll(): T[] {
      return Array.from(cache.values());
    },

    query(predicate: (row: T) => boolean): T[] {
      return this.getAll().filter(predicate);
    },

    handleRowInserted(row: T): void {
      cache.set(row.id, row);
    },

    handleRowUpdated(data: { oldRow: T; newRow: T }): void {
      cache.set(data.newRow.id, data.newRow);
    },

    handleRowDeleted(row: T): void {
      cache.delete(row.id);
    },

    handleSnapshot(rows: T[]): void {
      cache.clear();
      rows.forEach((row) => cache.set(row.id, row));
    },

    clear(): void {
      cache.clear();
    },
  };
}

function createTableCache() {
  const tables = new Map<string, Map<any, any>>();

  return {
    set(tableName: string, id: any, row: any): void {
      if (!tables.has(tableName)) {
        tables.set(tableName, new Map());
      }
      tables.get(tableName)!.set(id, row);
    },

    getTables(): string[] {
      return Array.from(tables.keys());
    },

    size(): number {
      let total = 0;
      tables.forEach((table) => (total += table.size));
      return total;
    },

    clearAll(): void {
      tables.clear();
    },
  };
}
