import { describe, expect, it } from 'vitest';
import { composeTrademarkServiceRequirementCandidates } from '../src/trademark-service-requirement-composition.js';

const workspaceId = '94949494-9494-4949-8949-949494949494';
const workPackageId = 'trademark-service-work-package_requirement-test' as const;
const currentKnowledge = {
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_SOURCE',
  sourceId: 'knowledge_us-renewal-1',
  sourceVersion: '2026-08-20',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-08-20T12:00:00.000Z',
  freshness: 'CURRENT'
} as const;

function compose(
  observations: Parameters<typeof composeTrademarkServiceRequirementCandidates>[0]['observations']
) {
  return composeTrademarkServiceRequirementCandidates({
    workspaceId,
    workPackageId,
    jurisdiction: 'US',
    serviceIntentKind: 'RENEWAL',
    observations,
    generatedAt: '2026-08-21T03:10:00.000Z'
  });
}

describe('M12-WP03 source-backed jurisdiction requirement composition', () => {
  it('creates only source-backed Requirement Candidates and preserves permanent authority locks', () => {
    const result = compose([
      {
        jurisdiction: 'US',
        serviceIntentKind: 'RENEWAL',
        kind: 'DOCUMENT',
        status: 'CANDIDATE',
        title: 'Review supporting document requirement',
        explanation:
          'The linked Knowledge source identifies a document-related requirement for review.',
        sourceReferences: [currentKnowledge]
      }
    ]);

    expect(result.requirementCandidates).toHaveLength(1);
    expect(result.requirementCandidates[0]).toMatchObject({
      workspaceId,
      workPackageId,
      kind: 'DOCUMENT',
      status: 'CANDIDATE',
      sourceFreshnessReviewed: true,
      certifiedLegalRequirement: false,
      legalDeadlineCertified: false,
      officialTruthVerifiedByLite: false
    });
    expect(result).toMatchObject({
      certifiedLegalRequirementsCreated: false,
      legalDeadlineCertified: false,
      officialTruthVerifiedByLite: false
    });
  });

  it('deduplicates matching observations while retaining all exact source references', () => {
    const dataEngine = {
      owner: 'DATA_ENGINE',
      kind: 'DATA_ENGINE_TRADEMARK_RECORD',
      sourceId: 'data_record_1',
      sourceVersion: '17',
      observedAt: '2026-08-20T13:00:00.000Z',
      freshness: 'CURRENT'
    } as const;
    const result = compose([
      {
        jurisdiction: 'US',
        serviceIntentKind: 'RENEWAL',
        kind: 'EVIDENCE',
        status: 'CANDIDATE',
        title: 'Review source evidence',
        explanation: 'Knowledge indicates evidence should be reviewed.',
        sourceReferences: [currentKnowledge]
      },
      {
        jurisdiction: 'US',
        serviceIntentKind: 'RENEWAL',
        kind: 'EVIDENCE',
        status: 'PRESENT',
        title: 'Review source evidence',
        explanation: 'Data Engine exposes structured evidence context.',
        sourceReferences: [dataEngine]
      }
    ]);

    expect(result.requirementCandidates).toHaveLength(1);
    expect(result.requirementCandidates[0]?.sourceReferences).toHaveLength(2);
    expect(result.requirementCandidates[0]?.explanation).toContain('Knowledge');
    expect(result.requirementCandidates[0]?.explanation).toContain('Data Engine');
  });

  it('downgrades stale or conflicting source context to REVIEW_REQUIRED instead of choosing truth', () => {
    const result = compose([
      {
        jurisdiction: 'US',
        serviceIntentKind: 'RENEWAL',
        kind: 'ORIGINAL_OR_HARD_COPY',
        status: 'PRESENT',
        title: 'Review original-document handling',
        explanation: 'The source observation is stale and therefore requires review.',
        sourceReferences: [{ ...currentKnowledge, freshness: 'STALE' }]
      }
    ]);

    expect(result.requirementCandidates[0]).toMatchObject({
      status: 'REVIEW_REQUIRED',
      sourceFreshnessReviewed: false,
      professionalReviewRequired: true,
      certifiedLegalRequirement: false
    });
  });

  it('always keeps timing/deadline observations under professional review without certifying a deadline', () => {
    const result = compose([
      {
        jurisdiction: 'US',
        serviceIntentKind: 'RENEWAL',
        kind: 'TIMING_OR_DEADLINE_REVIEW',
        status: 'PRESENT',
        title: 'Review observed timing context',
        explanation:
          'A source contains timing context that must be professionally verified before action.',
        sourceReferences: [currentKnowledge]
      }
    ]);

    expect(result.requirementCandidates[0]).toMatchObject({
      professionalReviewRequired: true,
      legalDeadlineCertified: false
    });
  });

  it('does not invent a requirement when no source-backed observation exists', () => {
    const result = compose([]);
    expect(result.requirementCandidates).toEqual([]);
    expect(result.missingInputs).toEqual([
      expect.objectContaining({
        reason: 'OTHER_REVIEW_REQUIRED',
        blocking: true
      })
    ]);
    expect(result.sourceBackedObservationCount).toBe(0);
  });

  it('discards mismatched jurisdiction/intent and unprovenanced observations', () => {
    const result = compose([
      {
        jurisdiction: 'CA',
        serviceIntentKind: 'RENEWAL',
        kind: 'DOCUMENT',
        status: 'CANDIDATE',
        title: 'Canadian context',
        explanation: 'This belongs to another jurisdiction.',
        sourceReferences: [currentKnowledge]
      },
      {
        jurisdiction: 'US',
        serviceIntentKind: 'RENEWAL',
        kind: 'DOCUMENT',
        status: 'CANDIDATE',
        title: 'Unprovenanced context',
        explanation: 'This has no source and must not become a requirement.',
        sourceReferences: []
      }
    ]);

    expect(result.requirementCandidates).toEqual([]);
    expect(result.discardedObservationCount).toBe(2);
    expect(result.missingInputs.map((input) => input.reason)).toContain(
      'SOURCE_CONFLICT_OR_STALENESS'
    );
  });

  it('uses deterministic requirement IDs for the same exact Work Package context', () => {
    const observation = {
      jurisdiction: 'US',
      serviceIntentKind: 'RENEWAL',
      kind: 'TRANSLATION',
      status: 'CANDIDATE',
      title: 'Review translation requirement',
      explanation: 'The source calls for translation-related review.',
      sourceReferences: [currentKnowledge]
    } as const;
    expect(compose([observation]).requirementCandidates[0]?.requirementId).toBe(
      compose([observation]).requirementCandidates[0]?.requirementId
    );
  });
});
