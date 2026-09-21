import { describe, expect, it } from 'vitest';
import {
  parseSubjectResolutionSnapshotV1,
  subjectResolutionFingerprintV1,
  type SubjectResolutionSnapshotV1
} from '../src/brain-subject-resolution.js';

const evidence = (id: string) => ({
  sourceOwner: 'DATA_ENGINE' as const,
  sourceObjectId: id,
  sourceVersion: 'v1',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-09-20T00:00:00.000Z'
});

const subject = (sourceSystem: string, sourceObjectId: string, displayName: string) => ({
  schemaVersion: 1 as const,
  sourceSystem,
  sourceKind: 'COMPANY' as const,
  sourceObjectId,
  sourceVersion: '2026-09-20',
  sourceFingerprintSha256: 'b'.repeat(64),
  observedAt: '2026-09-20T00:00:00.000Z',
  jurisdiction: 'CN',
  displayName
});
function fixture(
  patch: Partial<Omit<SubjectResolutionSnapshotV1, 'fingerprintSha256'>> = {}
): SubjectResolutionSnapshotV1 {
  const base: Omit<SubjectResolutionSnapshotV1, 'fingerprintSha256'> = {
    schemaVersion: 1,
    resolutionId: 'subject-resolution_cn-us-yanpalace',
    methodVersionId: 'brain-method-version_subject-resolution-v1',
    evaluatedAt: '2026-09-20T01:00:00.000Z',
    left: subject('CNIPA', 'cn-entity-123', '厦门燕之屋燕窝产业股份有限公司'),
    right: {
      ...subject('USPTO', 'us-owner-456', "XIAMEN YAN PALACE BIRD'S NEST INDUSTRY CO., LTD."),
      jurisdiction: 'US',
      sourceKind: 'OWNER'
    },
    relation: 'LIKELY_SAME_ENTITY',
    band: 'HIGH',
    reasonCodes: ['NORMALIZED_NAME_MATCH', 'ADDRESS_EVIDENCE_MATCH'],
    explanation: 'Names and address evidence align across source-native records.',
    supportingEvidence: [evidence('subject-match:1')],
    conflictingEvidence: [],
    authorityConsequences: {
      legalIdentityEstablished: false,
      customerRelationshipEstablished: false,
      workspaceAssociationEstablished: false,
      trademarkOwnershipEstablished: false,
      managedAssetEstablished: false,
      externalActionAuthorized: false
    },
    ...patch
  };
  return {
    ...base,
    fingerprintSha256: subjectResolutionFingerprintV1(base)
  };
}

describe('Brain Subject Resolution V1', () => {
  it('parses a cross-source likely-same candidate without granting authority', () => {
    const parsed = parseSubjectResolutionSnapshotV1(fixture());
    expect(parsed.relation).toBe('LIKELY_SAME_ENTITY');
    expect(parsed.band).toBe('HIGH');
    expect(parsed.authorityConsequences).toEqual({
      legalIdentityEstablished: false,
      customerRelationshipEstablished: false,
      workspaceAssociationEstablished: false,
      trademarkOwnershipEstablished: false,
      managedAssetEstablished: false,
      externalActionAuthorized: false
    });
  });

  it('keeps fingerprint deterministic when reason codes arrive in another order', () => {
    const first = fixture();
    const second = fixture({
      reasonCodes: ['ADDRESS_EVIDENCE_MATCH', 'NORMALIZED_NAME_MATCH']
    });
    expect(first.fingerprintSha256).toBe(second.fingerprintSha256);
  });
  it('requires explicit evidence before claiming a same-legal-entity candidate', () => {
    const candidate = fixture({
      relation: 'SAME_LEGAL_ENTITY',
      band: 'VERY_HIGH',
      supportingEvidence: []
    });
    expect(() => parseSubjectResolutionSnapshotV1(candidate)).toThrow(/supporting evidence/u);
  });

  it('requires a direct authoritative identifier reason before emitting SAME_LEGAL_ENTITY', () => {
    const heuristicOnly = fixture({
      relation: 'SAME_LEGAL_ENTITY',
      band: 'VERY_HIGH',
      reasonCodes: ['NORMALIZED_NAME_MATCH', 'ADDRESS_EVIDENCE_MATCH']
    });
    expect(() => parseSubjectResolutionSnapshotV1(heuristicOnly)).toThrow(
      /direct authoritative identifier evidence/u
    );

    const directIdentifier = fixture({
      relation: 'SAME_LEGAL_ENTITY',
      band: 'VERY_HIGH',
      reasonCodes: ['OFFICIAL_IDENTIFIER_MATCH']
    });
    expect(parseSubjectResolutionSnapshotV1(directIdentifier).relation).toBe('SAME_LEGAL_ENTITY');
  });

  it('models an official renamed-company chain without turning it into Workspace truth', () => {
    const renamed = fixture({
      relation: 'RENAMED_FROM',
      band: 'HIGH',
      reasonCodes: ['OFFICIAL_RENAME_CHAIN'],
      explanation:
        'An official company-history record links the former source-native company name to the current name.'
    });
    expect(parseSubjectResolutionSnapshotV1(renamed)).toMatchObject({
      relation: 'RENAMED_FROM',
      band: 'HIGH',
      reasonCodes: ['OFFICIAL_RENAME_CHAIN'],
      authorityConsequences: {
        legalIdentityEstablished: false,
        customerRelationshipEstablished: false,
        workspaceAssociationEstablished: false
      }
    });
  });

  it('fails closed when relation evidence conflicts', () => {
    const base = fixture({
      relation: 'CONFLICT',
      band: 'CONFLICT',
      reasonCodes: ['REGISTRATION_NUMBER_CONFLICT'],
      conflictingEvidence: [evidence('subject-conflict:1')]
    });
    expect(parseSubjectResolutionSnapshotV1(base).relation).toBe('CONFLICT');

    const withoutConflictEvidence = fixture({
      relation: 'CONFLICT',
      band: 'CONFLICT',
      reasonCodes: ['REGISTRATION_NUMBER_CONFLICT'],
      conflictingEvidence: []
    });
    expect(() => parseSubjectResolutionSnapshotV1(withoutConflictEvidence)).toThrow(
      /conflicting evidence/u
    );
  });
  it('does not allow a resolution payload to smuggle business authority', () => {
    const candidate = fixture();
    expect(() =>
      parseSubjectResolutionSnapshotV1({
        ...candidate,
        authorityConsequences: {
          ...candidate.authorityConsequences,
          customerRelationshipEstablished: true
        }
      })
    ).toThrow(/cannot grant authority/u);
  });

  it('rejects a changed payload with a stale fingerprint', () => {
    const candidate = fixture();
    expect(() =>
      parseSubjectResolutionSnapshotV1({
        ...candidate,
        explanation: 'Different explanation with stale fingerprint.'
      })
    ).toThrow(/fingerprint mismatch/u);
  });

  it('models insufficient evidence as review-required rather than a match', () => {
    const candidate = fixture({
      relation: 'INSUFFICIENT_EVIDENCE',
      band: 'REVIEW_REQUIRED',
      reasonCodes: ['NAME_ONLY_NO_STABLE_IDENTIFIER'],
      supportingEvidence: []
    });
    expect(parseSubjectResolutionSnapshotV1(candidate)).toMatchObject({
      relation: 'INSUFFICIENT_EVIDENCE',
      band: 'REVIEW_REQUIRED'
    });
  });
});
