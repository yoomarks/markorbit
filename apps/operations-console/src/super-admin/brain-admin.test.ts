import { describe, expect, it } from 'vitest';
import { buildBrainAdminViewModel } from './brain-admin.js';

describe('Super Admin Brain owner projection', () => {
  it('preserves owner counts and canonical objects without inventing readiness', () => {
    const model = buildBrainAdminViewModel({
      source: { domain: 'CORE', authority: 'control-plane:cognitive:read' },
      generatedAt: '2026-09-08T00:00:00.000Z',
      summary: {
        brainAssetCount: 1,
        brainGapCount: 1,
        openBrainGapCount: 1,
        methodImprovementAdmissionCount: 1
      },
      brainAssets: [
        { brainAssetId: 'brain-1', brainAssetVersionId: 'brain-1-v2', version: 2, status: 'ACTIVE' }
      ],
      brainGaps: [{ brainGapRegistryKey: 'gap-1', status: 'OPEN' }],
      methodImprovements: [
        { trigger: { triggerId: 'trigger-1' }, researchMission: { researchMissionId: 'mission-1' } }
      ],
      brainBuildRuns: { availability: 'NOT_DURABLY_RECORDED', inventory: null }
    });
    expect(model.owner).toBe('CORE');
    expect(model.authority).toBe('control-plane:cognitive:read');
    expect(model.assetCount).toBe('1');
    expect(model.assets).toHaveLength(1);
    expect(model.gaps).toHaveLength(1);
    expect(model.improvements).toHaveLength(1);
    expect(model.buildRuns.detail).toContain('NOT_DURABLY_RECORDED');
    expect(model.buildRuns.detail).toContain('not zero runs');
  });

  it('keeps absent owner summary fields unavailable rather than zero', () => {
    const model = buildBrainAdminViewModel({
      brainAssets: [],
      brainGaps: [],
      methodImprovements: []
    });
    expect(model.assetCount).toBe('Unavailable');
    expect(model.gapCount).toBe('Unavailable');
    expect(model.openGapCount).toBe('Unavailable');
    expect(model.improvementCount).toBe('Unavailable');
    expect(model.buildRuns.title).toBe('Brain Build Run availability unavailable');
  });
});
