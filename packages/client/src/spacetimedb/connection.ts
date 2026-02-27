/**
 * SpacetimeDB Connection Manager
 *
 * Manages WebSocket v1 connection to SpacetimeDB server using SDK 1.3.3.
 * Implements connection state machine and event emission.
 */

import { EventEmitter } from 'events';

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

/**
 * SpacetimeDB connection options
 */
export interface SpacetimeDBConnectionOptions {
  /** Server hostname (default: 'localhost') */
  host?: string;
  /** Server port (default: 3000) */
  port?: number;
  /** Database name (default: 'bitcraft') */
  database?: string;
  /** WebSocket protocol: 'ws' for dev, 'wss' for production (default: 'ws') */
  protocol?: 'ws' | 'wss';
  /** Connection timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Connection change event
 */
export interface ConnectionChangeEvent {
  state: ConnectionState;
  error?: Error;
}

/**
 * SpacetimeDB Connection Manager
 *
 * Establishes and manages WebSocket v1 connection to SpacetimeDB server.
 *
 * @example
 * ```typescript
 * const connection = new SpacetimeDBConnection({
 *   host: 'localhost',
 *   port: 3000,
 *   database: 'bitcraft',
 *   protocol: 'ws'
 * });
 *
 * connection.on('connectionChange', ({ state, error }) => {
 *   console.log('Connection state:', state);
 *   if (error) console.error(error);
 * });
 *
 * await connection.connect();
 * ```
 */
export class SpacetimeDBConnection extends EventEmitter {
  private _state: ConnectionState = 'disconnected';
  private options: Required<SpacetimeDBConnectionOptions>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dbConnection: any = null; // SpacetimeDB DbConnection instance

  constructor(options?: SpacetimeDBConnectionOptions) {
    super();

    // Set defaults
    this.options = {
      host: options?.host ?? 'localhost',
      port: options?.port ?? 3000,
      database: options?.database ?? 'bitcraft',
      protocol: options?.protocol ?? 'ws',
      timeout: options?.timeout ?? 10000,
    };

    // Validate options
    this.validateOptions();
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this._state;
  }

  /**
   * Get the underlying SpacetimeDB connection
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get connection(): any {
    return this.dbConnection;
  }

  /**
   * Validate connection options
   * @throws TypeError if options are invalid
   */
  private validateOptions(): void {
    // Validate host (prevent SSRF attacks)
    if (!this.options.host || this.options.host.trim() === '') {
      throw new TypeError('Invalid connection options: host cannot be empty');
    }

    // Strict hostname validation: alphanumeric, dots, hyphens, localhost
    const hostnameRegex =
      /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^localhost$|^127\.0\.0\.1$|^\[::1\]$/;
    if (!hostnameRegex.test(this.options.host)) {
      throw new TypeError(
        'Invalid connection options: host must be a valid hostname or IP address'
      );
    }

    // Prevent SSRF to internal networks (security hardening)
    const internalNetworkRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)/;
    if (internalNetworkRegex.test(this.options.host) && this.options.host !== '127.0.0.1') {
      // Allow localhost (127.0.0.1) but warn about other internal IPs in production
      if (process.env.NODE_ENV === 'production') {
        throw new TypeError(
          'Invalid connection options: connections to internal networks are not allowed in production'
        );
      }
    }

    // Validate port is a safe integer
    if (
      !Number.isInteger(this.options.port) ||
      this.options.port < 1 ||
      this.options.port > 65535
    ) {
      throw new TypeError(
        'Invalid connection options: port must be an integer between 1 and 65535'
      );
    }

    // Validate database name (prevent injection attacks)
    if (!this.options.database || this.options.database.trim() === '') {
      throw new TypeError('Invalid connection options: database cannot be empty');
    }

    // Database name allowlist: alphanumeric, underscores, hyphens only
    const dbNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!dbNameRegex.test(this.options.database)) {
      throw new TypeError(
        'Invalid connection options: database name must contain only alphanumeric characters, underscores, and hyphens'
      );
    }

    // Validate database name length (prevent buffer overflow)
    if (this.options.database.length > 64) {
      throw new TypeError(
        'Invalid connection options: database name must not exceed 64 characters'
      );
    }

    const validProtocols: Array<'ws' | 'wss'> = ['ws', 'wss'];
    if (!validProtocols.includes(this.options.protocol)) {
      throw new TypeError(`Invalid connection options: protocol must be 'ws' or 'wss'`);
    }
  }

  /**
   * Change connection state and emit event
   */
  private setState(state: ConnectionState, error?: Error): void {
    this._state = state;
    this.emit('connectionChange', { state, error } as ConnectionChangeEvent);
  }

  /**
   * Build connection URI
   */
  private getUri(): string {
    return `${this.options.protocol}://${this.options.host}:${this.options.port}`;
  }

  /**
   * Connect to SpacetimeDB server
   *
   * Establishes WebSocket v1 connection using SDK 1.3.3.
   *
   * @throws Error if connection fails or times out
   *
   * @example
   * ```typescript
   * await connection.connect();
   * console.log('Connected to SpacetimeDB');
   * ```
   */
  async connect(): Promise<void> {
    if (this._state === 'connected') {
      return; // Already connected
    }

    if (this._state === 'connecting') {
      throw new Error('Connection already in progress');
    }

    this.setState('connecting');

    try {
      // Dynamic import of generated bindings (security: validate import path)
      let DbConnection;
      try {
        // Only allow import from the generated module (prevent path traversal)
        const importPath = './generated';
        if (!importPath.match(/^\.\/generated$/)) {
          throw new Error('Invalid import path');
        }
        const generated = await import(importPath);
        DbConnection = generated.DbConnection;

        // Validate that the imported module has the expected structure
        if (!DbConnection || typeof DbConnection.builder !== 'function') {
          throw new Error('Invalid module structure');
        }
      } catch {
        const err = new Error('Failed to load SpacetimeDB bindings. Ensure generated types exist.');
        this.setState('failed', err);
        throw err;
      }

      // Create connection promise
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectionPromise = new Promise<any>((resolve, reject) => {
        let resolved = false;

        const builder = DbConnection.builder()
          .withUri(this.getUri())
          .withModuleName(this.options.database)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
          .onConnect((connection: any, _identity: any, _token: any) => {
            if (!resolved) {
              resolved = true;
              resolve(connection);
            }
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
          .onConnectError((_ctx: any, error: Error) => {
            if (!resolved) {
              resolved = true;
              reject(error);
            }
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
          .onDisconnect((_ctx: any) => {
            if (this._state !== 'disconnected') {
              this.setState('disconnected');
            }
          });

        this.dbConnection = builder.build();
      });

      // Add timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection timeout after ${this.options.timeout}ms`));
        }, this.options.timeout);
      });

      // Race connection against timeout
      await Promise.race([connectionPromise, timeoutPromise]);

      this.setState('connected');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setState('failed', err);
      throw err;
    }
  }

  /**
   * Disconnect from SpacetimeDB server
   *
   * Cleanly closes WebSocket connection and resets state.
   *
   * @example
   * ```typescript
   * await connection.disconnect();
   * console.log('Disconnected from SpacetimeDB');
   * ```
   */
  async disconnect(): Promise<void> {
    if (this._state === 'disconnected') {
      return; // Already disconnected
    }

    // Add timeout to prevent hanging disconnects (security: prevent resource exhaustion)
    const disconnectTimeout = 5000; // 5 seconds
    const disconnectPromise = new Promise<void>((resolve, reject) => {
      try {
        if (this.dbConnection && typeof this.dbConnection.disconnect === 'function') {
          this.dbConnection.disconnect();
          this.dbConnection = null;
        }
        this.setState('disconnected');
        resolve();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.setState('failed', err);
        reject(err);
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Disconnect operation timed out'));
      }, disconnectTimeout);
    });

    try {
      await Promise.race([disconnectPromise, timeoutPromise]);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setState('failed', err);
      throw err;
    }
  }
}
