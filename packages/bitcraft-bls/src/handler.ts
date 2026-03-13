/**
 * Game Action Handler (kind 30078)
 *
 * Factory function that creates the game action handler for processing
 * ILP-routed Nostr events containing SpacetimeDB reducer calls.
 *
 * Flow:
 * 1. ctx.decode() to get NostrEvent
 * 2. Parse event.content to extract { reducer, args }
 * 3. Prepend ctx.pubkey as first arg (identity propagation)
 * 4. Call SpacetimeDB HTTP API with the reducer and args
 * 5. Return ctx.accept() on success or ctx.reject() on failure
 *
 * SECURITY:
 * - NEVER logs SPACETIMEDB_TOKEN (OWASP A02)
 * - Reducer name validated by content parser (OWASP A03)
 * - Zero silent failures (NFR27): every execution results in accept or reject
 *
 * @module handler
 */

import type { HandlerFn, AcceptResponse, RejectResponse } from '@crosstown/sdk';
import type { BLSConfig } from './config.js';
import { parseEventContent, ContentParseError } from './content-parser.js';
import {
  callReducer,
  ReducerCallError,
  type SpacetimeDBCallerConfig,
} from './spacetimedb-caller.js';

/**
 * Truncate a pubkey for logging: first 8 + last 4 hex chars.
 * Example: "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"
 *       -> "32e18276...e245"
 */
function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 12) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

/**
 * Create the game action handler for kind 30078 events.
 *
 * @param config - BLS configuration (provides SpacetimeDB connection details)
 * @returns Handler function compatible with @crosstown/sdk HandlerFn
 */
export function createGameActionHandler(config: BLSConfig): HandlerFn {
  // Build SpacetimeDB caller config from BLS config
  const callerConfig: SpacetimeDBCallerConfig = {
    url: config.spacetimedbUrl,
    database: config.spacetimedbDatabase,
    token: config.spacetimedbToken,
  };

  return async (ctx): Promise<AcceptResponse | RejectResponse> => {
    const startTime = Date.now();
    let reducerName = 'unknown';
    let eventId = 'unknown';

    try {
      // 1. Decode the full NostrEvent from TOON data
      const event = ctx.decode();
      eventId = event.id;

      // 2. Parse content to extract reducer and args
      const { reducer, args } = parseEventContent(event.content);
      reducerName = reducer;

      // 3. Prepend ctx.pubkey as first argument (identity propagation)
      const argsWithIdentity: unknown[] = [ctx.pubkey, ...args];

      // 4. Call SpacetimeDB reducer
      await callReducer(callerConfig, reducer, argsWithIdentity);

      // 5. Success
      const duration = Date.now() - startTime;
      console.log(
        `[BLS] Action succeeded | eventId: ${eventId} | pubkey: ${truncatePubkey(ctx.pubkey)} | reducer: ${reducer} | duration: ${duration}ms`
      );

      return ctx.accept({ eventId: event.id });
    } catch (err: unknown) {
      const duration = Date.now() - startTime;

      // Handle content parse errors -> F06
      // ContentParseError messages already include "Invalid event content:" prefix,
      // so we use err.message directly to avoid double-prefixing.
      if (err instanceof ContentParseError) {
        console.error(
          `[BLS] Action failed | eventId: ${eventId} | pubkey: ${truncatePubkey(ctx.pubkey)} | reducer: ${reducerName} | error: F06: ${err.message} | duration: ${duration}ms`
        );
        return ctx.reject('F06', err.message);
      }

      // Handle SpacetimeDB errors -> T00
      if (err instanceof ReducerCallError) {
        let message: string;

        if (err.code === 'UNKNOWN_REDUCER') {
          message = err.message;
        } else if (err.statusCode === 0 && err.message.includes('timed out')) {
          message = `Reducer ${reducerName} timed out`;
        } else {
          // Use err.message directly -- it already includes "Reducer {name} failed: ..."
          // prefix from callReducer(). Wrapping again would double-prefix.
          message = err.message;
        }

        console.error(
          `[BLS] Action failed | eventId: ${eventId} | pubkey: ${truncatePubkey(ctx.pubkey)} | reducer: ${reducerName} | error: T00: ${message} | duration: ${duration}ms`
        );
        return ctx.reject('T00', message);
      }

      // Handle unexpected errors -> T00
      const errorMessage = err instanceof Error ? err.message : String(err);
      const message = `Internal error: ${errorMessage}`;
      console.error(
        `[BLS] Action failed | eventId: ${eventId} | pubkey: ${truncatePubkey(ctx.pubkey)} | reducer: ${reducerName} | error: T00: ${message} | duration: ${duration}ms`
      );
      return ctx.reject('T00', message);
    }
  };
}
