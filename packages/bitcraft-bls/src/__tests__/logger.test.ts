/**
 * Structured Logger Tests
 * ACTION-E3-3: Define structured logging pattern for BLS handler
 *
 * Tests for the structured logging interface and default console implementation.
 *
 * Test count: 8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, type LogLevel } from '../logger.js';

describe('Structured Logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs valid JSON on each log call', () => {
    const logger = createLogger('test');
    logger.info('test message');

    expect(console.log).toHaveBeenCalledOnce();
    const output = vi.mocked(console.log).mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe('object');
  });

  it('includes level, message, component, and timestamp in every entry', () => {
    const logger = createLogger('handler');
    logger.info('Action succeeded');

    const output = vi.mocked(console.log).mock.calls[0][0] as string;
    const entry = JSON.parse(output);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Action succeeded');
    expect(entry.component).toBe('handler');
    expect(entry.timestamp).toBeDefined();
    // Verify ISO 8601 format
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('routes error level to console.error', () => {
    const logger = createLogger('handler');
    logger.error('Action failed', { errorCode: 'F06' });

    expect(console.error).toHaveBeenCalledOnce();
    expect(console.log).not.toHaveBeenCalled();

    const output = vi.mocked(console.error).mock.calls[0][0] as string;
    const entry = JSON.parse(output);
    expect(entry.level).toBe('error');
    expect(entry.errorCode).toBe('F06');
  });

  it('routes warn level to console.warn', () => {
    const logger = createLogger('handler');
    logger.warn('Budget warning');

    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('auto-truncates pubkey in log entries (OWASP A02)', () => {
    const logger = createLogger('handler');
    const fullPubkey = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
    logger.info('Identity propagated', { pubkey: fullPubkey });

    const output = vi.mocked(console.log).mock.calls[0][0] as string;
    const entry = JSON.parse(output);
    // Should be truncated (first 8 + ... + last 4)
    expect(entry.pubkey).toBe('32e18276...e245');
    // Should NOT contain the full pubkey
    expect(entry.pubkey).not.toBe(fullPubkey);
  });

  it('preserves short pubkey values without truncation', () => {
    const logger = createLogger('handler');
    logger.info('Test', { pubkey: 'short' });

    const output = vi.mocked(console.log).mock.calls[0][0] as string;
    const entry = JSON.parse(output);
    expect(entry.pubkey).toBe('short');
  });

  it('includes all structured context fields', () => {
    const logger = createLogger('handler');
    logger.info('Action succeeded', {
      eventId: 'abc123',
      pubkey: 'ab'.repeat(32),
      reducer: 'player_move',
      durationMs: 42,
    });

    const output = vi.mocked(console.log).mock.calls[0][0] as string;
    const entry = JSON.parse(output);
    expect(entry.eventId).toBe('abc123');
    expect(entry.reducer).toBe('player_move');
    expect(entry.durationMs).toBe(42);
    // pubkey should be truncated
    expect(entry.pubkey).toContain('...');
  });

  it('supports all four log levels', () => {
    const logger = createLogger('test');
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

    for (const level of levels) {
      vi.clearAllMocks();
      logger[level](`${level} message`);

      if (level === 'error') {
        expect(console.error).toHaveBeenCalledOnce();
      } else if (level === 'warn') {
        expect(console.warn).toHaveBeenCalledOnce();
      } else {
        expect(console.log).toHaveBeenCalledOnce();
      }

      // Verify the JSON contains the correct level
      const calls =
        level === 'error'
          ? vi.mocked(console.error).mock.calls
          : level === 'warn'
            ? vi.mocked(console.warn).mock.calls
            : vi.mocked(console.log).mock.calls;
      const entry = JSON.parse(calls[0][0] as string);
      expect(entry.level).toBe(level);
    }
  });
});
