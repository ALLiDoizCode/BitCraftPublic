import { expect, test } from 'vitest';
import { TUI_BACKEND_VERSION } from './index';

test('exports version', () => {
  expect(TUI_BACKEND_VERSION).toBeDefined();
  expect(TUI_BACKEND_VERSION).toBe('0.1.0');
});
