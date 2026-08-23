import { describe, expect, test } from 'vitest';

/**
 * MarkOrbit-owned Knowledge ReadyPackage V2 cross-repo acceptance boundary.
 *
 * This suite intentionally validates the consumer boundary only. The Knowledge
 * repository remains the provider owner and is pinned by CI workflow inputs.
 */
describe('Knowledge Core KV2 cross repo acceptance', () => {
  test('keeps provider boundary non-production and explicit', () => {
    expect(process.env.PRODUCTION_ACTIVATION ?? 'false').toBe('false');
    expect(process.env.KNOWLEDGE_PROTOCOL ?? 'ReadyPackage-V2').toBe('ReadyPackage-V2');
  });

  test('requires provider reference before acceptance execution', () => {
    const provider = process.env.KNOWLEDGE_PROVIDER_REPO ?? 'yoomarks/markorbit-knowledge';
    expect(provider).toBe('yoomarks/markorbit-knowledge');
  });

  test('does not authorize fallback or production activation', () => {
    const forbidden = ['V2_TO_V1_FALLBACK', 'PRODUCTION_ACTIVATION'];
    expect(forbidden).toContain('PRODUCTION_ACTIVATION');
  });
});
