import { describe, expect, it } from 'vitest';
import { createRuntime, serviceManifest } from '../src/index.js';

describe('knowledge service boundary', () => {
  it('uses its owned identity and default port', () => {
    expect(serviceManifest).toMatchObject({ name: 'knowledge', port: 4102, version: '0.1.0' });
  });

  it('creates an unstarted runtime for safe imports', () => {
    const runtime = createRuntime();
    expect(runtime.isRunning).toBe(false);
    expect(runtime.manifest).toEqual(serviceManifest);
  });
});
