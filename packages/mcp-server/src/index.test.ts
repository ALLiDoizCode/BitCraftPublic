import { expect, test } from 'vitest';
import { MCP_SERVER_VERSION } from './index';

test('exports version', () => {
  expect(MCP_SERVER_VERSION).toBeDefined();
  expect(MCP_SERVER_VERSION).toBe('0.1.0');
});
