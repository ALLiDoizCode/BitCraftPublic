/**
 * Generated SpacetimeDB Type Bindings
 *
 * This file contains generated TypeScript types and classes for the BitCraft module.
 *
 * NOTE: This is a minimal stub implementation. Full type generation will be implemented
 * when we have access to the BitCraft module schema (Story 1.5).
 *
 * CRITICAL: SDK version 1.3.3 required for SpacetimeDB 1.6.x compatibility (NFR18).
 * SDK 2.0+ uses incompatible protocol v2.
 */

import {
  DbConnectionBuilder as SDKBuilder,
  DbConnectionImpl,
} from '@clockworklabs/spacetimedb-sdk';

/**
 * Minimal RemoteModule stub for DbConnectionBuilder
 * This will be replaced with actual generated code once we have module schema
 */
class RemoteModule {
  constructor(public name: string) {}
}

/**
 * DbConnection class that wraps SDK DbConnectionImpl
 *
 * This provides the builder pattern interface expected by application code.
 */
export class DbConnection {
  /**
   * Create a new connection builder
   *
   * @returns DbConnectionBuilder instance
   *
   * @example
   * ```typescript
   * const connection = DbConnection.builder()
   *   .withUri('ws://localhost:3000')
   *   .withModuleName('bitcraft')
   *   .onConnect((conn, identity, token) => {
   *     console.log('Connected!');
   *   })
   *   .build();
   * ```
   */
  static builder(): SDKBuilder<any, any, any> {
    // Create a minimal remote module
    const remoteModule = new RemoteModule('bitcraft') as any;

    // Create builder with identity constructor
    return new SDKBuilder(remoteModule, (impl: DbConnectionImpl) => impl);
  }
}

/**
 * Table type definitions
 *
 * These are minimal stubs. Full types will be generated from module schema.
 */

export interface PlayerState {
  id?: number;
  player_id?: number;
  entity_id?: number;
  name?: string;
  level?: number;
  isActive?: boolean;
  createdAt?: number;
  [key: string]: any;
}

export interface EntityPosition {
  id?: number;
  entity_id?: number;
  x?: number;
  y?: number;
  z?: number;
  [key: string]: any;
}

export interface Inventory {
  id?: number;
  player_id?: number;
  item_id?: number;
  quantity?: number;
  slot?: number;
  [key: string]: any;
}

// Export types for use in table accessors
export type TableTypes = {
  player_state: PlayerState;
  entity_position: EntityPosition;
  inventory: Inventory;
  [tableName: string]: any;
};
