import { describe, expect, it } from 'vitest';
import { productManifest } from '../src/index.js';

describe('markreg.com product manifest', () => {
  it('requires the UI design skill before page implementation', () => {
    expect(productManifest.uiSkillRequired).toBe(true);
  });
});
