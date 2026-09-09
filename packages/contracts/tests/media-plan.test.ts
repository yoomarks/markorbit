import { describe, expect, it } from 'vitest';
import { parseMediaPlanV1 } from '../src/media-plan.js';

const plan = {
  schemaVersion: 1,
  mediaPlanId: 'media-plan_01',
  version: 1,
  workspaceId: 'workspace_01',
  purpose: 'Explain the selected commercial direction',
  audienceRefs: ['audience:end-consumer'],
  commercialIntentRefs: [
    { kind: 'TRADING_AI_PROFILE', profileId: 'trading-ai-derived_ai-profile_01', version: 2 },
    {
      kind: 'TRADING_COMMERCIAL_DIRECTION',
      commercialDirectionId: 'trading-ai-derived_commercial_direction_01',
      version: 3
    }
  ],
  shots: [
    {
      shotId: 'media-shot_01',
      semanticPurpose: 'Establish product',
      shotType: 'PRODUCT_ASSET',
      durationIntentMs: 3000,
      sourceRefs: [{ kind: 'ASSET', owner: 'LITE', referenceId: 'listing-asset_01', version: '4' }],
      profileRefs: [],
      reusableClip: { clipArtifactId: 'clip-artifact_01', version: 1 },
      fulfillment: 'REUSE_REQUIRED'
    },
    {
      shotId: 'media-shot_02',
      semanticPurpose: 'Explain benefit',
      shotType: 'AVATAR',
      durationIntentMs: 5000,
      sourceRefs: [],
      profileRefs: [{ kind: 'AVATAR_PROFILE', profileId: 'avatar-profile_01', version: 1 }],
      fulfillment: 'GENERATION_ALLOWED'
    }
  ],
  sequence: ['media-shot_01', 'media-shot_02'],
  reusePolicy: 'REUSE_FIRST_GENERATE_LAST',
  renderIntent: { aspectRatio: '9:16', locale: 'en-US', targetDurationMs: 8000 },
  constraints: ['Do not present inference as trademark truth'],
  evidenceRefs: ['evidence:01'],
  createdAt: '2026-09-09T00:00:00.000Z',
  authority: {
    renderStarted: false,
    artifactCreated: false,
    executionAuthorized: false,
    externalPublished: false,
    tradingTruthMutated: false
  }
} as const;

describe('media plan contract', () => {
  it('keeps Trading intent as exact owner references and reuses clips first', () => {
    const parsed = parseMediaPlanV1(plan);
    expect(parsed.commercialIntentRefs).toEqual(plan.commercialIntentRefs);
    expect(parsed.shots[0]?.reusableClip?.clipArtifactId).toBe('clip-artifact_01');
  });
  it('requires an exact, complete shot sequence', () => {
    expect(() => parseMediaPlanV1({ ...plan, sequence: ['media-shot_01'] })).toThrow(
      'every shot exactly once'
    );
    expect(() =>
      parseMediaPlanV1({ ...plan, sequence: ['media-shot_01', 'media-shot_missing'] })
    ).toThrow('every shot exactly once');
  });
  it('grants no render, execution, publishing, or truth authority', () => {
    expect(() =>
      parseMediaPlanV1({ ...plan, authority: { ...plan.authority, renderStarted: true } })
    ).toThrow('authority claims must all be false');
  });
  it('fails closed on provider-specific or malformed inputs', () => {
    expect(() => parseMediaPlanV1({ ...plan, provider: 'vendor-model' })).toThrow(
      'unsupported fields'
    );
    expect(() =>
      parseMediaPlanV1({
        ...plan,
        commercialIntentRefs: [{ kind: 'TRADING_AI_PROFILE', profileId: 'wrong_01', version: 1 }]
      })
    ).toThrow('profileId is invalid');
  });
});
