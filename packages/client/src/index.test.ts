import { expect, test } from 'vitest';
import { SIGIL_VERSION } from './index';

test('exports version', () => {
  expect(SIGIL_VERSION).toBeDefined();
  expect(SIGIL_VERSION).toBe('0.1.0');
});
