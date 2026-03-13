/**
 * Mock Crosstown Node Fixture
 * Story 3.1: BLS Package Setup & Crosstown SDK Node
 *
 * Provides pre-configured mock CrosstownNode objects for unit testing
 * lifecycle management without real SDK dependencies.
 */

import { vi } from 'vitest';
import type { CrosstownNode, Identity, StartResult, EmbeddedConnector } from '@crosstown/sdk';

/**
 * Create a mock CrosstownNode with spied methods.
 */
export function createMockNode(
  overrides: Partial<{
    pubkey: string;
    evmAddress: string;
    startResult: StartResult;
  }> = {}
): { node: CrosstownNode; connector: EmbeddedConnector } {
  const pubkey = overrides.pubkey ?? 'ab'.repeat(32);
  const evmAddress = overrides.evmAddress ?? '0x' + 'ab'.repeat(20);
  const startResult: StartResult = overrides.startResult ?? {
    peerCount: 1,
    channelCount: 1,
    bootstrapResults: [],
  };

  const connector: EmbeddedConnector = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };

  // Create a mock that mimics CrosstownNode interface
  const node = {
    start: vi.fn().mockResolvedValue(startResult),
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    identity: { pubkey, evmAddress } as Identity,
    started: false,
    inFlightCount: 0,
    hasHandler: vi.fn().mockReturnValue(false),
    dispatch: vi.fn(),
  } as unknown as CrosstownNode;

  return { node, connector };
}
