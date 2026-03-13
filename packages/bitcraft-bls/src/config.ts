/**
 * BLS Node Configuration
 *
 * Loads configuration from environment variables with validation and defaults.
 * Secret values (BLS_SECRET_KEY, SPACETIMEDB_TOKEN) are NEVER logged.
 */

/**
 * BLS node configuration interface.
 */
export interface BLSConfig {
  /** Hex-encoded 32-byte secret key. If absent, a mnemonic is generated. */
  secretKey?: string;
  /** SpacetimeDB HTTP endpoint URL */
  spacetimedbUrl: string;
  /** SpacetimeDB database name */
  spacetimedbDatabase: string;
  /** SpacetimeDB admin authentication token (NEVER logged) */
  spacetimedbToken: string;
  /** ILP routing address */
  ilpAddress: string;
  /** Per-kind pricing map (kind number -> unit cost as bigint) */
  kindPricing: Record<number, bigint>;
  /** Logging level */
  logLevel: string;
  /** Health check HTTP port */
  port: number;
}

/**
 * Validate that a string is a valid 64-character hex string (32 bytes).
 */
function isValidHexKey(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

/**
 * Validate that a string is a valid HTTP or HTTPS URL.
 */
function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Load BLS configuration from environment variables.
 *
 * @throws {Error} If required fields are missing or invalid.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): BLSConfig {
  const spacetimedbToken = env.SPACETIMEDB_TOKEN;
  if (!spacetimedbToken) {
    throw new Error(
      'SPACETIMEDB_TOKEN environment variable is required. ' +
        'Set it to the SpacetimeDB admin token for the BitCraft database.'
    );
  }

  const secretKey = env.BLS_SECRET_KEY || undefined;
  if (secretKey !== undefined && !isValidHexKey(secretKey)) {
    throw new Error(
      'BLS_SECRET_KEY must be a 64-character hex string (32 bytes). ' +
        'The provided value does not match the expected format.'
    );
  }

  const portStr = env.BLS_PORT || '3001';
  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`BLS_PORT must be a valid port number (1-65535). Got: ${portStr}`);
  }

  const spacetimedbUrl = env.SPACETIMEDB_URL || 'http://localhost:3000';
  if (!isValidHttpUrl(spacetimedbUrl)) {
    throw new Error(`SPACETIMEDB_URL must be a valid HTTP or HTTPS URL. Got: ${spacetimedbUrl}`);
  }

  return {
    secretKey,
    spacetimedbUrl,
    spacetimedbDatabase: env.SPACETIMEDB_DATABASE || 'bitcraft',
    spacetimedbToken,
    ilpAddress: env.BLS_ILP_ADDRESS || 'g.crosstown.bitcraft',
    kindPricing: { 30078: 100n },
    logLevel: env.BLS_LOG_LEVEL || 'info',
    port,
  };
}
