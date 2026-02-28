# Sigil Client Error Codes

**Last Updated:** 2026-02-27
**Story:** 2.3 - ILP Packet Construction & Signing

This document catalogs all error codes used by the Sigil client SDK, organized by boundary.

---

## Error Boundary: `publish`

Errors originating from the publish API (`client.publish()`).

### `INVALID_ACTION`

**Cause:** Action (reducer) or arguments failed validation before ILP packet construction.

**Scenarios:**
- Reducer name is empty or not a string
- Reducer name contains invalid characters (only alphanumeric and underscore allowed)
- Reducer name is too long (>64 characters) or too short (<1 character)
- Arguments are not JSON-serializable (e.g., contain circular references)
- Fee is negative or not a finite number
- Public key is not a valid 64-character hex string

**User Action:**
- Verify reducer name matches pattern `/^[a-zA-Z0-9_]+$/`
- Ensure reducer name length is 1-64 characters
- Ensure arguments can be serialized to JSON
- Check for circular object references in arguments

**Recovery Strategy:**
- Fix the action parameters and retry
- No state changes occur (fail-fast validation)

**Example:**
```typescript
try {
  await client.publish({ reducer: 'player-move', args: [] });
} catch (error) {
  if (error.code === 'INVALID_ACTION') {
    // Fix reducer name: hyphens not allowed, use underscores
    await client.publish({ reducer: 'player_move', args: [] });
  }
}
```

---

### `IDENTITY_NOT_LOADED`

**Cause:** Attempted to publish without loading identity first.

**User Action:**
- Call `client.loadIdentity(path, passphrase)` before publishing
- Ensure identity loading succeeded (check for errors)

**Recovery Strategy:**
- Load identity and retry publish
- No state changes occur

**Example:**
```typescript
const client = new SigilClient({ crosstownConnectorUrl: 'http://localhost:4041' });

// ❌ This will throw IDENTITY_NOT_LOADED
// await client.publish({ reducer: 'player_move', args: [100, 200] });

// ✅ Load identity first
await client.loadIdentity('./keypair.json', 'mypassphrase');
await client.publish({ reducer: 'player_move', args: [100, 200] });
```

---

### `CROSSTOWN_NOT_CONFIGURED`

**Cause:** Attempted to publish without configuring Crosstown connector URL.

**User Action:**
- Provide `crosstownConnectorUrl` in `SigilClientConfig` when constructing client
- Ensure URL is valid HTTP/HTTPS format
- In production, ensure URL uses `https://` protocol

**Recovery Strategy:**
- Recreate client with valid `crosstownConnectorUrl`
- No state changes occur

**Example:**
```typescript
// ❌ This will throw CROSSTOWN_NOT_CONFIGURED when publishing
const client = new SigilClient();

// ✅ Provide Crosstown URL
const client = new SigilClient({
  crosstownConnectorUrl: 'http://localhost:4041' // development
  // or 'https://crosstown.example.com' for production
});
```

---

### `REGISTRY_NOT_LOADED`

**Cause:** Attempted to publish without loading action cost registry.

**User Action:**
- Provide `actionCostRegistryPath` in `SigilClientConfig`
- Ensure registry file exists and is valid JSON
- Verify registry file contains the reducer being called

**Recovery Strategy:**
- Recreate client with valid `actionCostRegistryPath`
- No state changes occur

**Example:**
```typescript
// ❌ This will throw REGISTRY_NOT_LOADED when publishing
const client = new SigilClient({ crosstownConnectorUrl: 'http://localhost:4041' });

// ✅ Provide action cost registry path
const client = new SigilClient({
  crosstownConnectorUrl: 'http://localhost:4041',
  actionCostRegistryPath: './config/action-costs.json'
});
```

---

### `CLIENT_DISCONNECTED`

**Cause:** Client was disconnected while waiting for publish confirmation.

**User Action:**
- Check if `client.disconnect()` was called during publish
- Verify network connection is stable
- Check SpacetimeDB and Nostr relay connections

**Recovery Strategy:**
- Reconnect client with `client.connect()`
- Retry publish operation
- Check confirmation subscription status

**Example:**
```typescript
try {
  const promise = client.publish({ reducer: 'player_move', args: [100, 200] });

  // ❌ Don't disconnect while publish is in flight!
  // client.disconnect();

  await promise;
} catch (error) {
  if (error.code === 'CLIENT_DISCONNECTED') {
    // Reconnect and retry
    await client.connect();
    await client.publish({ reducer: 'player_move', args: [100, 200] });
  }
}
```

---

## Error Boundary: `crosstown`

Errors originating from Crosstown connector or confirmation flow.

### `INSUFFICIENT_BALANCE`

**Cause:** Wallet balance is less than action cost.

**Context Fields:**
- `action`: Reducer name
- `required`: Cost in ILP units
- `available`: Current balance in ILP units
- `timestamp`: When balance was checked (Unix ms)

**User Action:**
- Check wallet balance with `client.wallet.getBalance()`
- Add funds to wallet before retrying
- Use a cheaper action if available

**Recovery Strategy:**
- Wait for balance to increase (monitor via wallet events)
- Fund wallet and retry
- Cancel action

**Example:**
```typescript
try {
  await client.publish({ reducer: 'expensive_action', args: [] });
} catch (error) {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    console.log(`Need ${error.context.required} ILP, have ${error.context.available}`);
    console.log('Please fund your wallet and try again');
  }
}
```

---

### `NETWORK_TIMEOUT`

**Cause:** Crosstown connector publish request timed out.

**Context Fields:**
- `timeout`: Timeout duration in milliseconds
- `url`: Crosstown connector URL

**User Action:**
- Check Crosstown connector is running and reachable
- Verify network connectivity
- Consider increasing `publishTimeout` in config (default: 2000ms)
- Check Crosstown connector logs for performance issues

**Recovery Strategy:**
- Retry with exponential backoff
- Increase timeout if consistent timeouts occur
- Check Crosstown connector health

**Example:**
```typescript
async function publishWithRetry(options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.publish(options);
    } catch (error) {
      if (error.code === 'NETWORK_TIMEOUT' && attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** attempt, 10000); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

---

### `NETWORK_ERROR`

**Cause:** Network failure during Crosstown connector communication (DNS resolution, connection refused, etc.)

**User Action:**
- Check Crosstown connector is running: `curl http://localhost:4041/health`
- Verify network connectivity
- Check Docker services if using local stack
- Verify DNS resolution for production URLs

**Recovery Strategy:**
- Wait and retry with backoff
- Check Crosstown connector status
- Restart Crosstown connector if needed

**Example:**
```typescript
try {
  await client.publish({ reducer: 'player_move', args: [100, 200] });
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    // Check if Crosstown is running
    console.error('Cannot reach Crosstown connector. Is it running?');
    console.error('Try: docker compose -f docker/docker-compose.yml ps');
  }
}
```

---

### `PUBLISH_FAILED`

**Cause:** Crosstown connector rejected the publish request (4xx or 5xx HTTP status).

**Context Fields:**
- `statusCode`: HTTP status code (if available)

**User Action:**
- Check Crosstown connector logs for error details
- Verify event signature is valid
- Ensure Crosstown connector is properly configured
- For 500 errors: report to Crosstown maintainers

**Recovery Strategy:**
- For 4xx errors: fix request and retry
- For 5xx errors: wait and retry (server issue)
- Check event format compliance

**Example:**
```typescript
try {
  await client.publish({ reducer: 'player_move', args: [100, 200] });
} catch (error) {
  if (error.code === 'PUBLISH_FAILED') {
    if (error.context?.statusCode === 400) {
      console.error('Invalid request - check reducer and args');
    } else if (error.context?.statusCode >= 500) {
      console.error('Crosstown server error - wait and retry');
    }
  }
}
```

---

### `INVALID_RESPONSE`

**Cause:** Crosstown connector returned invalid or malformed JSON response.

**User Action:**
- Check Crosstown connector version compatibility
- Verify Crosstown connector is running correct version
- Report issue to Crosstown maintainers

**Recovery Strategy:**
- Restart Crosstown connector
- Check for version mismatches
- Retry once (may be transient)

---

### `RATE_LIMITED`

**Cause:** Crosstown connector returned 429 Too Many Requests (rate limit exceeded).

**Context Fields:**
- `retryAfter`: Seconds to wait before retry (from `Retry-After` header, if present)

**User Action:**
- Reduce publish frequency
- Implement client-side rate limiting
- Wait for rate limit window to reset
- Contact Crosstown operator if limit seems too low

**Recovery Strategy:**
- Wait for `retryAfter` seconds (if provided)
- Implement exponential backoff
- Queue actions locally and batch if possible

**Example:**
```typescript
try {
  await client.publish({ reducer: 'player_move', args: [100, 200] });
} catch (error) {
  if (error.code === 'RATE_LIMITED') {
    const retryAfter = error.context?.retryAfter || 60; // Default 60s
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    // Retry publish...
  }
}
```

---

### `CONFIRMATION_TIMEOUT`

**Cause:** Confirmation event not received within timeout period (default: 2000ms).

**Context Fields:**
- `eventId`: Event ID that timed out
- `timeout`: Timeout duration in milliseconds

**User Action:**
- Check Nostr relay connection: `client.nostr.getConnectionState()`
- Verify Crosstown Nostr relay is running
- Check confirmation subscription status
- Consider increasing `publishTimeout` for slow networks

**Recovery Strategy:**
- Query blockchain to verify if action was actually applied
- Retry publish if action didn't execute
- Increase timeout if network is consistently slow
- Check Nostr relay logs

**Example:**
```typescript
try {
  await client.publish({ reducer: 'player_move', args: [100, 200] });
} catch (error) {
  if (error.code === 'CONFIRMATION_TIMEOUT') {
    console.log('Confirmation timed out. Checking if action was applied...');
    // Query game state to verify action result
    // If not applied, retry
  }
}
```

---

### `INVALID_CONFIG`

**Cause:** Crosstown connector URL failed validation (SSRF protection, invalid protocol, etc.)

**User Action:**
- Use valid HTTP or HTTPS URL
- In production, use `https://` only (not `http://`)
- Don't embed credentials in URL (`http://user:pass@host` is rejected)
- Don't use internal IPs in production (10.*, 192.168.*, etc.)

**Recovery Strategy:**
- Fix URL and recreate client
- Use environment variables for production vs development URLs

**Example:**
```typescript
// ❌ Invalid URLs (will throw INVALID_CONFIG)
const bad1 = new SigilClient({ crosstownConnectorUrl: 'ftp://localhost:4041' }); // Wrong protocol
const bad2 = new SigilClient({ crosstownConnectorUrl: 'http://user:pass@localhost:4041' }); // Credentials
const bad3 = new SigilClient({ crosstownConnectorUrl: 'http://192.168.1.1' }); // Internal IP (production)

// ✅ Valid URLs
const good1 = new SigilClient({ crosstownConnectorUrl: 'http://localhost:4041' }); // Development
const good2 = new SigilClient({ crosstownConnectorUrl: 'https://crosstown.example.com' }); // Production
```

---

## Error Boundary: `identity`

Errors originating from identity management and cryptographic operations.

### `SIGNING_FAILED`

**Cause:** Event signing failed (invalid private key, cryptographic error, etc.)

**User Action:**
- Verify identity was loaded correctly
- Check private key format (must be 32-byte Uint8Array)
- Reload identity from keypair file
- If persists, regenerate identity

**Recovery Strategy:**
- Reload identity: `client.loadIdentity(path, passphrase)`
- Verify keypair file is not corrupted
- Regenerate keypair if needed (WARNING: loses access to previous identity)

**Example:**
```typescript
try {
  await client.publish({ reducer: 'player_move', args: [100, 200] });
} catch (error) {
  if (error.code === 'SIGNING_FAILED') {
    console.error('Cryptographic signing failed. Reload identity.');
    await client.loadIdentity('./keypair.json', 'passphrase');
    // Retry...
  }
}
```

---

## Error Codes by Severity

### Critical (Prevent Action Execution)

- `INSUFFICIENT_BALANCE` - Cannot execute action without funds
- `IDENTITY_NOT_LOADED` - Cannot sign without identity
- `CROSSTOWN_NOT_CONFIGURED` - Cannot publish without connector
- `REGISTRY_NOT_LOADED` - Cannot determine cost without registry

### High (Likely Configuration Issue)

- `INVALID_CONFIG` - SSRF protection or malformed URL
- `INVALID_ACTION` - Validation failure (bad reducer or args)

### Medium (Transient Errors)

- `NETWORK_TIMEOUT` - Retry with backoff
- `NETWORK_ERROR` - Check connectivity
- `RATE_LIMITED` - Wait and retry
- `CONFIRMATION_TIMEOUT` - Verify action result

### Low (Unexpected/Rare)

- `PUBLISH_FAILED` - Server error
- `INVALID_RESPONSE` - Protocol mismatch
- `SIGNING_FAILED` - Crypto failure
- `CLIENT_DISCONNECTED` - Interrupted operation

---

## Error Handling Best Practices

### 1. Always Check Error Codes

```typescript
try {
  await client.publish(action);
} catch (error) {
  if (!(error instanceof SigilError)) {
    throw error; // Re-throw unknown errors
  }

  switch (error.code) {
    case 'INSUFFICIENT_BALANCE':
      // Handle balance issue
      break;
    case 'NETWORK_TIMEOUT':
      // Retry with backoff
      break;
    default:
      // Log and alert
      console.error('Unexpected error:', error);
  }
}
```

### 2. Use Error Context

```typescript
if (error.code === 'INSUFFICIENT_BALANCE') {
  const { required, available, action } = error.context;
  console.log(`Action '${action}' needs ${required} ILP, but wallet has ${available}`);
}
```

### 3. Implement Retry Logic

```typescript
async function publishWithRetry(action, maxRetries = 3) {
  const retryableCodes = ['NETWORK_TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMITED'];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.publish(action);
    } catch (error) {
      if (!retryableCodes.includes(error.code) || attempt === maxRetries) {
        throw error;
      }

      const delay = Math.min(1000 * 2 ** attempt, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 4. Monitor Error Rates

```typescript
const errorCounts = {};

client.on('publishFailure', ({ error }) => {
  errorCounts[error.code] = (errorCounts[error.code] || 0) + 1;

  if (errorCounts[error.code] > 10) {
    console.warn(`High failure rate for ${error.code}: ${errorCounts[error.code]}`);
  }
});
```

---

## Changelog

### 2026-02-27 - Initial version (Story 2.3)
- Documented all error codes from publish, crosstown, and identity boundaries
- Added examples, recovery strategies, and best practices
- Organized by boundary and severity
