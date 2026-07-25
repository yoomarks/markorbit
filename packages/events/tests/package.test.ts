import { describe, expect, it } from 'vitest';
import { packageName } from '../src/index.js';

describe('package scaffold', () => {
  it('has a stable package identity', () => {
    expect(packageName.startsWith('@markorbit/')).toBe(true);
  });
});
