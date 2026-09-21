import { describe, expect, it } from 'vitest';
import {
  noSeedArchetypeAuthorityConsequencesV1,
  parseSeedBusinessArchetypeAssessmentV1,
  seedBusinessArchetypeAssessmentFingerprintSha256V1,
  type SeedBusinessArchetypeAssessmentV1
} from '../src/seed-business-archetype.js';

const evidence = (id: string) => ({
  sourceOwner: 'DATA_ENGINE' as const,
  sourceObjectId: id,
  sourceVersion: 'epoch-1',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-09-21T00:00:00.000Z'
});

function fixture(): SeedBusinessArchetypeAssessmentV1 {
  const base: Omit<SeedBusinessArchetypeAssessmentV1, 'assessmentFingerprintSha256'> = {
    schemaVersion: 1,
    assessmentId: 'seed-archetype-assessment_trader-001',
    methodVersionId: 'brain-method-version_seed-archetype-v1',
    targetRef: {
      owner: 'DATA_ENGINE',
      kind: 'CN_APPLICANT',
      id: 'applicant-001',
      version: 'epoch-1',
      fingerprintSha256: 'b'.repeat(64),
      observedAt: '2026-09-21T00:00:00.000Z'
    },
    candidates: [
      {
        archetype: 'TRADEMARK_INVESTOR_CANDIDATE',
        band: 'STRONG',
        indicators: [
          {
            code: 'REPEATED_TRANSFER_OUT',
            direction: 'SUPPORTS',
            explanation: 'Repeated transfers to diverse unrelated counterparties were observed.',
            evidenceRefs: [evidence('transfer-set-001')]
          },
          {
            code: 'PUBLIC_MARKETPLACE_LISTINGS',
            direction: 'SUPPORTS',
            explanation: 'Public marketplace listing evidence exists for the same source subject.',
            evidenceRefs: [evidence('listing-set-001')]
          },
          {
            code: 'INTRA_GROUP_TRANSFER_SHARE',
            direction: 'COUNTERS',
            explanation: 'Some transfers appear related to internal restructuring.',
            evidenceRefs: [evidence('group-transfer-set-001')]
          }
        ]
      }
    ],
    evaluatedAt: '2026-09-21T01:00:00.000Z',
    explanation: 'The evidence supports a reviewable trademark-investment business pattern.',
    authorityConsequences: noSeedArchetypeAuthorityConsequencesV1
  };
  return {
    ...base,
    assessmentFingerprintSha256: seedBusinessArchetypeAssessmentFingerprintSha256V1(base)
  };
}

describe('SeedBusinessArchetypeAssessmentV1', () => {
  it('preserves supporting and counter evidence without assigning a Workspace type', () => {
    const parsed = parseSeedBusinessArchetypeAssessmentV1(fixture());
    expect(parsed.candidates[0]?.archetype).toBe('TRADEMARK_INVESTOR_CANDIDATE');
    expect(parsed.candidates[0]?.indicators.some((item) => item.direction === 'COUNTERS')).toBe(
      true
    );
    expect(parsed.authorityConsequences.workspaceTypeAssigned).toBe(false);
    expect(parsed.authorityConsequences.investorStatusEstablished).toBe(false);
  });

  it('rejects unbounded indicator codes', () => {
    const value = fixture();
    const candidate = value.candidates[0]!;
    const changed = {
      ...value,
      candidates: [
        {
          ...candidate,
          indicators: [{ ...candidate.indicators[0]!, code: 'MAGIC_INVESTOR_SCORE' }]
        }
      ]
    };
    expect(() => parseSeedBusinessArchetypeAssessmentV1(changed)).toThrow(/code is invalid/u);
  });

  it('does not infer an investor candidate from application volume alone', () => {
    const value = fixture();
    const candidate = value.candidates[0]!;
    const changed = {
      ...value,
      candidates: [
        {
          ...candidate,
          indicators: [
            {
              code: 'APPLICATION_VOLUME',
              direction: 'SUPPORTS',
              explanation: 'A large application portfolio was observed.',
              evidenceRefs: [evidence('application-volume-001')]
            }
          ]
        }
      ]
    };
    expect(() => parseSeedBusinessArchetypeAssessmentV1(changed)).toThrow(
      /application volume alone is insufficient/u
    );
  });

  it('requires evidence for every indicator', () => {
    const value = fixture();
    const candidate = value.candidates[0]!;
    const changed = {
      ...value,
      candidates: [
        {
          ...candidate,
          indicators: [{ ...candidate.indicators[0]!, evidenceRefs: [] }]
        }
      ]
    };
    expect(() => parseSeedBusinessArchetypeAssessmentV1(changed)).toThrow(
      /evidenceRefs must be non-empty/u
    );
  });

  it('rejects duplicate archetype candidates', () => {
    const value = fixture();
    const changed = { ...value, candidates: [value.candidates[0]!, value.candidates[0]!] };
    expect(() => parseSeedBusinessArchetypeAssessmentV1(changed)).toThrow(/must be unique/u);
  });

  it('rejects authority smuggling', () => {
    const value = fixture();
    expect(() =>
      parseSeedBusinessArchetypeAssessmentV1({
        ...value,
        authorityConsequences: {
          ...value.authorityConsequences,
          investorStatusEstablished: true
        }
      })
    ).toThrow(/cannot grant authority/u);
  });
});
