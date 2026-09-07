import { describe, expect, it } from 'vitest';
import {
  noEarlyFunnelAuthorityConsequences,
  noRecommendationSourceAuthorityConsequences,
  type ProductionIntakeV1,
  type RecommendationSourceReferenceV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  composeProductionRecommendationV1,
  productionRecommendationSha256
} from '../src/production-recommendation.js';
import type {
  RecommendationCapableSourceMaterialV1,
  RecommendationSourceReadResultV1
} from '../src/recommendation-source.js';

const intake = (): ProductionIntakeV1 => ({
  schemaVersion: 1,
  intakeId: 'intake_recommendation-unit',
  workspaceId: '60606060-6060-4606-8606-606060606060',
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Prepare a bounded US trademark filing strategy review.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs LLC', country: 'US' },
    trademark: { type: 'COMPOSITE', representationText: 'MARK ORBIT + DEVICE' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Software for trademark portfolio management.' },
    filingGoal: 'Prepare a US application for human attorney review.'
  },
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: '1'.repeat(64),
  createdAt: '2026-09-07T03:00:00.000Z',
  updatedAt: '2026-09-07T03:00:00.000Z',
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

const source = (): RecommendationSourceReferenceV1 => ({
  sourceKind: 'CAPABILITY_RESULT',
  sourceId: 'markreg.us-trademark-mark-representation-strategy-source',
  sourceVersion:
    '1.0.0|runtime:runtime-capability_us-trademark-mark-representation-strategy-source-v1@1|implementation:implementation-profile_us-trademark-mark-representation-strategy-source-v1@1|evidence:capability-source-admission-evidence_unit@5',
  fingerprintSha256: '2'.repeat(64),
  admissionClass: 'PRODUCTION_ADMISSIBLE',
  currentness: 'CURRENT',
  currentnessCheckedAt: '2026-09-07T03:01:00.000Z',
  provenanceRefs: ['capability-output:brain.us-trademark-mark-representation-strategy.v1'],
  assumptions: ['Customer-supplied mark classification remains accurate.'],
  limitations: ['Human review is required.'],
  authorityConsequences: noRecommendationSourceAuthorityConsequences
});

function material(value = intake()): RecommendationCapableSourceMaterialV1 {
  return {
    outputFamilyId: 'us-trademark-mark-representation-strategy',
    outputFamilyVersion: 1,
    analyzedInputFingerprintSha256: productionRecommendationSha256(value.input),
    candidates: [
      {
        dimension: 'WORDING_STANDARD_CHARACTER',
        support: 'SUPPORTED_FOR_HUMAN_REVIEW',
        rationaleCode: 'CUSTOMER_SUPPLIED_WORDING_DIMENSION',
        evidenceRoles: [
          'DECISION_FACTORS',
          'DRAWING_TYPE_DEFINITIONS',
          'PROTECTION_SCOPE_AND_SPECIAL_FORM_REQUIRED'
        ]
      },
      {
        dimension: 'DESIGN_STYLIZATION_SPECIAL_FORM',
        support: 'SUPPORTED_FOR_HUMAN_REVIEW',
        rationaleCode: 'CUSTOMER_SUPPLIED_DESIGN_OR_STYLIZATION_DIMENSION',
        evidenceRoles: [
          'DECISION_FACTORS',
          'DRAWING_TYPE_DEFINITIONS',
          'PROTECTION_SCOPE_AND_SPECIAL_FORM_REQUIRED'
        ]
      }
    ],
    assumptions: ['Customer-supplied mark classification remains accurate.'],
    limitations: ['Human review is required.'],
    provenanceRefs: ['knowledge-reference:uspto-mark-drawing-strategy'],
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  };
}

function read(
  overrides: Partial<
    Extract<RecommendationSourceReadResultV1, { status: 'PRODUCTION_ADMISSIBLE' }>
  > = {}
) {
  return {
    status: 'PRODUCTION_ADMISSIBLE' as const,
    source: source(),
    producerReference: {
      schemaVersion: 1 as const,
      idempotencyKey: 'capability-strategy-unit',
      requestFingerprintSha256: '3'.repeat(64),
      capabilityRequestId: 'capreq_strategy-unit',
      sessionReceiptId: 'session-receipt_strategy-unit'
    },
    recommendationMaterial: material(),
    ...overrides
  };
}

describe('#757 production Recommendation materializer', () => {
  it('composes only a bounded A/B/C human-review sequence from the admitted strategy source', () => {
    const value = composeProductionRecommendationV1({
      recommendationId: 'recommendation_strategy-unit',
      intake: intake(),
      sourceRead: read(),
      generatedAt: '2026-09-07T03:02:00.000Z'
    });

    expect(value).toMatchObject({
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      currentness: 'CURRENT',
      intake: { id: 'intake_recommendation-unit', version: 1 },
      source: {
        sourceId: 'markreg.us-trademark-mark-representation-strategy-source',
        admissionClass: 'PRODUCTION_ADMISSIBLE',
        currentness: 'CURRENT'
      },
      options: [{ code: 'A' }, { code: 'B' }, { code: 'C' }],
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
    expect(value.options[0].description).toContain('wording / standard-character dimension');
    expect(value.options[0].description).toContain('design / stylization / special-form dimension');
    expect(value.options[2].description).toContain('no filing, payment, provider contact');
    expect(value.provenanceRefs).toContain(
      'markreg-consumer-policy:markreg.production-recommendation.us-mark-representation.v1'
    );
    expect(value.fingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(Object.values(value.authorityConsequences).every((entry) => entry === false)).toBe(true);
  });

  it('is deterministic for the exact artifact identity, source and timestamp', () => {
    const args = {
      recommendationId: 'recommendation_strategy-unit' as const,
      intake: intake(),
      sourceRead: read(),
      generatedAt: '2026-09-07T03:02:00.000Z'
    };
    expect(composeProductionRecommendationV1(args)).toEqual(
      composeProductionRecommendationV1(args)
    );
  });

  it('rejects a fee-only source even when it is production-admissible', () => {
    const feeSource = {
      ...source(),
      sourceId: 'official-fee-resolver',
      sourceVersion: '2.0.0|runtime:runtime-capability_uspto-official-fee-resolver@2'
    };
    expect(() =>
      composeProductionRecommendationV1({
        recommendationId: 'recommendation_fee-only',
        intake: intake(),
        sourceRead: read({ source: feeSource }),
        generatedAt: '2026-09-07T03:02:00.000Z'
      })
    ).toThrow(/not on the MarkReg Recommendation-capable V1 allowlist/u);
  });

  it('rejects material produced from any other Intake fingerprint', () => {
    const wrongMaterial = { ...material(), analyzedInputFingerprintSha256: 'f'.repeat(64) };
    expect(() =>
      composeProductionRecommendationV1({
        recommendationId: 'recommendation_wrong-input',
        intake: intake(),
        sourceRead: read({ recommendationMaterial: wrongMaterial }),
        generatedAt: '2026-09-07T03:02:00.000Z'
      })
    ).toThrow(/exact current Intake input/u);
  });
});
