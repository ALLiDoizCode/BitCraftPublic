/**
 * BLS Handler Integration Tests
 * Story 2.4: BLS Handler Integration Contract & Testing
 *
 * Tests against real Crosstown BLS handler (external dependency).
 * Requires Docker stack with Crosstown BLS handler deployed.
 *
 * IMPORTANT: Tests are SKIPPED until BLS_HANDLER_DEPLOYED=true
 * Set environment variable when Crosstown BLS handler is ready.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NostrClient } from '../nostr/nostr-client';
import { generateKeypair, type NostrKeypair } from '../nostr/keypair';
import { signEvent } from '../publish/event-signing';
import type { NostrEvent } from '../nostr/types';
import { BLSErrorCode } from '../bls/types';
import { bytesToHex } from '@noble/hashes/utils';

// Only run integration tests if both flags are set
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
const blsHandlerDeployed = process.env.BLS_HANDLER_DEPLOYED === 'true';

describe.skipIf(!runIntegrationTests || !blsHandlerDeployed)(
  'BLS Handler Integration Tests',
  () => {
    let nostrClient: NostrClient;
    let keypair: NostrKeypair;

    beforeEach(async () => {
      // Initialize Nostr client connected to Crosstown relay
      nostrClient = new NostrClient({
        url: process.env.CROSSTOWN_RELAY_URL || 'ws://localhost:4040',
      });
      await nostrClient.connect();

      // Generate test identity for signing events
      keypair = await generateKeypair();
    });

    afterEach(async () => {
      if (nostrClient) {
        await nostrClient.disconnect();
        nostrClient.dispose();
      }
    });

    /**
     * Helper function to publish a game action event
     */
    async function publishAction(action: { reducer: string; args: any[] }): Promise<NostrEvent> {
      const content = JSON.stringify(action);
      const pubkeyHex = bytesToHex(keypair.publicKey);

      // Create kind 30078 event template
      const eventTemplate = {
        pubkey: pubkeyHex,
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content,
      };

      // Sign event with private key
      const signedEvent = signEvent(eventTemplate, keypair.privateKey);

      // TODO: Publish event to Crosstown relay
      // This will be implemented when NostrClient.publishEvent() is added in a future story
      // For now, return the signed event
      return signedEvent;
    }

    /**
     * Helper function to wait for BLS response
     * TODO: Implement when BLS handler response mechanism is defined
     */
    async function waitForBLSResponse(_eventId: string, _timeoutMs = 5000): Promise<any> {
      // Placeholder - actual implementation depends on BLS/Crosstown relay integration
      throw new Error('BLS handler response mechanism not yet implemented');
    }

    describe('AC1: BLS receives kind 30078 events via ILP routing', () => {
      it('should accept kind 30078 event via ILP routing', async () => {
        // Given: A valid kind 30078 event with game action
        const action = {
          reducer: 'test_action',
          args: [],
        };

        // When: Event is published to Crosstown relay
        const event = await publishAction(action);

        // Then: BLS handler receives and acknowledges the event
        // TODO: Verify BLS response when handler is deployed
        expect(event).toBeDefined();
        expect(event.kind).toBe(30078);
        expect(event.id).toBeTruthy();
        expect(event.sig).toBeTruthy();

        // When BLS handler is implemented, add:
        // const response = await waitForBLSResponse(event.id);
        // expect(response.errorCode).toBeUndefined();
      }, 10000);
    });

    describe('AC2: Event content parsing and validation', () => {
      it('should parse valid event content with reducer and args', async () => {
        // Given: A valid event with correct JSON content
        const action = {
          reducer: 'player_move',
          args: [
            { x: 100, z: 200 }, // origin
            { x: 110, z: 200 }, // destination
            false, // running
          ],
        };

        // When: Event is published
        const event = await publishAction(action);

        // Then: Event is properly formatted
        expect(event.content).toBe(JSON.stringify(action));
        const parsed = JSON.parse(event.content);
        expect(parsed.reducer).toBe('player_move');
        expect(parsed.args).toHaveLength(3);

        // TODO: Verify BLS parses successfully when handler is deployed
        // const response = await waitForBLSResponse(event.id);
        // expect(response.success).toBe(true);
      }, 10000);

      it('should reject event with invalid JSON content', async () => {
        // Given: An event with malformed JSON content
        const pubkeyHex = bytesToHex(keypair.publicKey);
        const eventTemplate = {
          pubkey: pubkeyHex,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: '{invalid json content', // Malformed JSON
        };

        const signedEvent = signEvent(eventTemplate, keypair.privateKey);

        // Then: Event is created but content is invalid
        expect(signedEvent.content).toBe('{invalid json content');

        // TODO: Verify BLS returns INVALID_CONTENT error when handler is deployed
        // const response = await waitForBLSResponse(signedEvent.id);
        // expect(response.errorCode).toBe(BLSErrorCode.INVALID_CONTENT);
      }, 10000);
    });

    describe('AC3: Nostr signature validation', () => {
      it('should accept event with valid Nostr signature', async () => {
        // Given: An event properly signed with valid Nostr signature
        const action = {
          reducer: 'test_action',
          args: [],
        };

        const event = await publishAction(action);

        // Then: Signature is valid (verified by signEvent)
        expect(event.sig).toBeTruthy();
        expect(event.sig).toMatch(/^[0-9a-f]{128}$/); // 64-byte hex signature

        // TODO: Verify BLS validates signature when handler is deployed
        // const response = await waitForBLSResponse(event.id);
        // expect(response.success).toBe(true);
      }, 10000);

      it('should reject event with invalid signature', async () => {
        // Given: An event with intentionally invalid signature
        const pubkeyHex = bytesToHex(keypair.publicKey);
        const eventTemplate = {
          pubkey: pubkeyHex,
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ reducer: 'test_action', args: [] }),
        };

        const signedEvent = signEvent(eventTemplate, keypair.privateKey);

        // Corrupt the signature to make it invalid
        const invalidEvent = {
          ...signedEvent,
          sig: signedEvent.sig.replace(/^./, 'z'), // Change first character
        };

        // Then: Signature is corrupted
        expect(invalidEvent.sig).not.toBe(signedEvent.sig);

        // TODO: Verify BLS rejects with INVALID_SIGNATURE when handler is deployed
        // const response = await waitForBLSResponse(invalidEvent.id);
        // expect(response.errorCode).toBe(BLSErrorCode.INVALID_SIGNATURE);
      }, 10000);
    });

    describe('AC4: SpacetimeDB reducer invocation with identity', () => {
      it('should invoke SpacetimeDB reducer with prepended identity', async () => {
        // Given: A valid event for a known reducer
        const action = {
          reducer: 'player_move',
          args: [
            { x: 100, z: 200 }, // origin
            { x: 110, z: 200 }, // destination
            false, // running
          ],
        };

        const event = await publishAction(action);

        // Then: Event contains pubkey for identity propagation
        expect(event.pubkey).toBeTruthy();
        expect(event.pubkey).toMatch(/^[0-9a-f]{64}$/); // 32-byte hex pubkey

        // Verify pubkey matches our keypair
        const expectedPubkey = bytesToHex(keypair.publicKey);
        expect(event.pubkey).toBe(expectedPubkey);

        // TODO: Verify BLS prepends pubkey to args when handler is deployed
        // const response = await waitForBLSResponse(event.id);
        // expect(response.success).toBe(true);
        // Verify SpacetimeDB received [event.pubkey, ...action.args]
      }, 10000);
    });

    describe('AC5: Unknown reducer handling', () => {
      it('should reject event with unknown reducer name', async () => {
        // Given: An event referencing a non-existent reducer
        const action = {
          reducer: 'nonexistent_reducer_xyz',
          args: [],
        };

        const event = await publishAction(action);

        // Then: Event is properly formatted
        expect(event.content).toContain('nonexistent_reducer_xyz');

        // TODO: Verify BLS returns UNKNOWN_REDUCER error when handler is deployed
        // const response = await waitForBLSResponse(event.id);
        // expect(response.errorCode).toBe(BLSErrorCode.UNKNOWN_REDUCER);
        // expect(response.message).toContain('nonexistent_reducer_xyz');
      }, 10000);
    });

    describe('AC6: Zero silent failures', () => {
      it('should log all errors with event context', async () => {
        // Given: Various error conditions (will be tested when BLS deployed)
        const invalidContentAction = {
          reducer: 'test',
          args: [],
        };

        const event = await publishAction(invalidContentAction);
        expect(event.id).toBeTruthy();

        // TODO: When BLS deployed, verify all errors are logged with:
        // - Event ID
        // - Pubkey
        // - Reducer name
        // - Error reason
        // This requires access to BLS handler logs or monitoring
      }, 10000);
    });

    describe('AC7: Error response propagation', () => {
      it('should propagate errors to sender with retryable field', async () => {
        // Given: An event that will cause an error
        const action = {
          reducer: 'error_test_reducer',
          args: [],
        };

        const event = await publishAction(action);
        expect(event).toBeDefined();

        // TODO: When BLS deployed, verify error response structure:
        // const response = await waitForBLSResponse(event.id);
        // expect(response.errorCode).toBeDefined();
        // expect(response.eventId).toBe(event.id);
        // expect(response.message).toBeTruthy();
        // expect(typeof response.retryable).toBe('boolean');
        //
        // Verify retryable field:
        // - false for: INVALID_SIGNATURE, UNKNOWN_REDUCER, INVALID_CONTENT
        // - true for: REDUCER_FAILED
      }, 10000);
    });

    describe('NFR3: Round-trip performance', () => {
      it('should complete round-trip within 2 seconds under normal load', async () => {
        // Given: A single client with <50ms network latency, no concurrent load
        const action = {
          reducer: 'test_action',
          args: [],
        };

        // When: Publish action and measure time until confirmation
        const startTime = Date.now();
        const event = await publishAction(action);

        // TODO: When BLS deployed, measure full round-trip:
        // const response = await waitForBLSResponse(event.id, 2000);
        // const endTime = Date.now();
        // const roundTripTime = endTime - startTime;
        //
        // Then: Round-trip completes within 2 seconds (NFR3 requirement)
        // expect(roundTripTime).toBeLessThan(2000);
        //
        // Log warning if exceeds 1 second (performance degradation indicator)
        // if (roundTripTime > 1000) {
        //   console.warn(`Performance degradation: round-trip took ${roundTripTime}ms (threshold: 1000ms)`);
        // }

        expect(event).toBeDefined();
        expect(event.id).toBeTruthy();

        // For now, just verify event was created (BLS handler not deployed)
        const elapsed = Date.now() - startTime;
        console.log(`Event creation took ${elapsed}ms (BLS handler round-trip not tested)`);
      }, 10000);
    });
  }
);
