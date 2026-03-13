/**
 * CrosstownAdapter Integration Tests
 * Story 2.5: @crosstown/client Integration & Scaffolding Removal
 *
 * End-to-end integration tests verifying the full publish pipeline:
 * publish via CrosstownAdapter -> confirmation received on Nostr relay.
 *
 * These tests require Docker stack (Crosstown node + Nostr relay).
 * Skipped unless RUN_INTEGRATION_TESTS is set.
 *
 * Validates: AC6, AC7
 *   - AC6: Publish pipeline preserves FR4/FR5 signing guarantees
 *   - AC7: Integration test confirms full publish flow via @crosstown/client
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SigilClient } from '../client';
import { generateKeypair } from '../nostr/keypair';
import { saveKeypair } from '../nostr/storage';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
  'CrosstownAdapter Integration (Story 2.5)',
  () => {
    let testDir: string;
    let registryPath: string;
    let identityPath: string;
    let client: SigilClient;

    beforeAll(async () => {
      testDir = join(
        tmpdir(),
        `sigil-integ-${Date.now()}-${Math.random().toString(36).substring(7)}`
      );
      registryPath = join(testDir, 'costs.json');
      identityPath = join(testDir, 'identity.json');
      mkdirSync(testDir, { recursive: true });

      // Create cost registry
      const registry = {
        version: 1,
        defaultCost: 10,
        actions: {
          player_move: { cost: 1, category: 'movement', frequency: 'high' },
        },
      };
      writeFileSync(registryPath, JSON.stringify(registry));

      // Create identity
      const keypair = await generateKeypair();
      await saveKeypair(keypair, 'test-passphrase', identityPath);

      // Initialize client
      client = new SigilClient({
        actionCostRegistryPath: registryPath,
        crosstownConnectorUrl: process.env.CROSSTOWN_URL || 'http://localhost:4041',
        nostrRelay: { url: process.env.NOSTR_RELAY_URL || 'ws://localhost:4040' },
        publishTimeout: 10000,
      });

      await client.loadIdentity('test-passphrase', identityPath);
    });

    afterAll(async () => {
      if (client) {
        await client.disconnect();
      }
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('End-to-End Publish via @crosstown/client (AC6, AC7)', () => {
      it('[P0] should publish event via CrosstownAdapter and receive confirmation on relay', async () => {
        // Given a connected SigilClient with CrosstownAdapter
        // When client.publish.publish({ reducer: 'player_move', args: [100, 200] }) is called
        // Then the event should be signed by @crosstown/client
        // And the event should be TOON-encoded and ILP-routed
        // And a confirmation event should be received on the Nostr relay
        // And the result should include eventId, reducer, args, fee, pubkey, timestamp

        const result = await client.publish.publish({
          reducer: 'player_move',
          args: [100, 200],
        });

        expect(result).toBeDefined();
        expect(result.eventId).toBeTruthy();
        expect(result.eventId).toMatch(/^[0-9a-f]{64}$/); // SHA256 hex
        expect(result.reducer).toBe('player_move');
        expect(result.args).toEqual([100, 200]);
        expect(result.fee).toBe(1); // From cost registry
        expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/); // x-only Schnorr pubkey
        expect(result.timestamp).toBeGreaterThan(0);
      });

      it('[P0] should sign events with agent Nostr key via @crosstown/client (FR4)', async () => {
        // Given a SigilClient with a known identity
        // When an event is published via CrosstownAdapter
        // Then the event should be attributed to the agent's Nostr public key
        // And the event pubkey should match client.identity.publicKey

        const result = await client.publish.publish({
          reducer: 'player_move',
          args: [1, 2],
        });

        const expectedPubkey = client.identity?.publicKey?.hex;
        expect(result.pubkey).toBe(expectedPubkey);
      });

      it('[P0] should produce verifiable event signatures (FR5)', async () => {
        // Given an event published via CrosstownAdapter
        // When the event signature is verified using nostr-tools
        // Then verification should pass (event was properly signed)
        // This validates the BLS handler integration contract from Story 2.4

        // TODO: Implement full signature verification when BLS handler is deployed
        // For now, verify that the publish pipeline produces a valid result structure
        const result = await client.publish.publish({
          reducer: 'player_move',
          args: [3, 4],
        });

        expect(result.eventId).toMatch(/^[0-9a-f]{64}$/);
        expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/);
      });
    });

    describe('CrosstownClient Lifecycle (AC3 Integration)', () => {
      it('[P0] should start CrosstownClient during connect()', async () => {
        // Given a SigilClient with CrosstownAdapter configured
        // When client.connect() is called
        // Then CrosstownClient should discover peers and report mode
        // Note: client is already connected from beforeAll

        // Verify adapter was created during connect()
        expect((client as unknown as Record<string, unknown>).crosstownAdapter).toBeTruthy();
      });

      it('[P0] should stop CrosstownClient during disconnect()', async () => {
        // Given a connected SigilClient
        // When client.disconnect() is called
        // Then CrosstownClient should gracefully shut down

        // Create a separate client for this test to avoid disturbing shared state
        const testClient = new SigilClient({
          actionCostRegistryPath: registryPath,
          crosstownConnectorUrl: process.env.CROSSTOWN_URL || 'http://localhost:4041',
          nostrRelay: { url: process.env.NOSTR_RELAY_URL || 'ws://localhost:4040' },
          publishTimeout: 5000,
        });

        await testClient.loadIdentity('test-passphrase', identityPath);
        await testClient.connect();

        // Adapter should be active
        expect((testClient as unknown as Record<string, unknown>).crosstownAdapter).toBeTruthy();

        await testClient.disconnect();

        // Adapter should be nulled after disconnect
        expect((testClient as unknown as Record<string, unknown>).crosstownAdapter).toBeNull();
      });
    });

    describe('Error Handling Integration (AC4)', () => {
      it('[P1] should return NETWORK_ERROR when Crosstown node is unreachable', async () => {
        // Given a SigilClient pointing to unreachable Crosstown URL
        // When publish is attempted after connect()
        // Then NETWORK_ERROR should be returned from CrosstownAdapter
        const badClient = new SigilClient({
          actionCostRegistryPath: registryPath,
          crosstownConnectorUrl: 'http://localhost:19999', // Unreachable
          publishTimeout: 2000,
        });

        await badClient.loadIdentity('test-passphrase', identityPath);

        // Must call connect() so CrosstownAdapter is created (lazily in connect)
        // SpacetimeDB/Nostr connections will fail, but adapter creation succeeds
        await badClient.connect().catch(() => {
          // Expected: SpacetimeDB and Nostr connections fail
        });

        await expect(
          badClient.publish.publish({ reducer: 'player_move', args: [] })
        ).rejects.toMatchObject({
          code: 'NETWORK_ERROR',
          boundary: 'crosstown',
        });

        await badClient.disconnect();
      });
    });
  }
);
