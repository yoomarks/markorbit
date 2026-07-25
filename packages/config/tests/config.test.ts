import { describe, expect, it } from 'vitest';
import { workspaceName } from '../src/index.js';

describe('workspace config', () => {
  it('exposes the workspace identity', () => {
    expect(workspaceName).toBe('markorbit');
  });
});
