import { describe, expect, it } from 'vitest';

import {
  liteIntakeFieldPaths,
  liteIntakeInlineTextSha256V1,
  liteIntakeReviewedMaterialFingerprintSha256V1,
  noLiteIntakeStagingAuthorityConsequencesV1,
  parseLiteIntakeStagingV1,
  type LiteIntakeCaseCandidateId,
  type LiteIntakeCaseCandidateV1,
  type LiteIntakeCaseState,
  type LiteIntakeFieldCandidateV1,
  type LiteIntakeFieldPath,
  type LiteIntakeManagedAiExtractionRefV1,
  type LiteIntakePrimarySourceV1,
  type LiteIntakeProductionIntakeReceiptV1,
  type LiteIntakeReviewedCommitV1,
  type LiteIntakeReviewedMaterialV1,
  type LiteIntakeStagingV1
} from '../src/lite-intake-staging.js';

const RECORDED_AT = '2026-09-11T00:00:00.000Z';
const OBSERVED_AT = '2026-09-11T00:01:00.000Z';
const AI_AT = '2026-09-11T00:02:00.000Z';
const REVIEWED_AT = '2026-09-11T00:03:00.000Z';
const COMMITTED_AT = '2026-09-11T00:04:00.000Z';
const UPDATED_AT = '2026-09-11T00:05:00.000Z';
const INLINE_TEXT = 'Please file ORBIT CAT in the United States for downloadable software.';
const INLINE_SOURCE_ID = 'lite-intake-source_inline';
const ATTACHMENT_SOURCE_ID = 'lite-intake-source_attachment';
const AI_EXTRACTION_ID = 'lite-intake-ai_extract1';

type CaseFixture = Omit<
  LiteIntakeCaseCandidateV1,
  'fieldCandidates' | 'reviewedCommit' | 'productionIntakeReceipt'
> & {
  fieldCandidates: LiteIntakeFieldCandidateV1[];
  reviewedCommit: LiteIntakeReviewedCommitV1 | null;
  productionIntakeReceipt: LiteIntakeProductionIntakeReceiptV1 | null;
};

type StagingFixture = Omit<LiteIntakeStagingV1, 'sources' | 'aiExtractions' | 'caseCandidates'> & {
  sources: LiteIntakePrimarySourceV1[];
  aiExtractions: LiteIntakeManagedAiExtractionRefV1[];
  caseCandidates: CaseFixture[];
};

function material(mark = 'ORBIT CAT'): LiteIntakeReviewedMaterialV1 {
  return {
    channel: 'LITE_PROFESSIONAL',
    relationshipModel: 'DIRECT',
    input: {
      businessContext: 'New filing instruction',
      applicant: {
        type: 'ORGANIZATION',
        name: 'Orbit Cat LLC',
        country: 'US'
      },
      trademark: {
        type: 'WORD',
        representationText: mark
      },
      targetJurisdictions: ['US'],
      goodsServices: {
        sourceText: 'downloadable software'
      },
      filingGoal: 'Register the mark'
    }
  };
}

function valueForPath(
  reviewed: LiteIntakeReviewedMaterialV1,
  path: LiteIntakeFieldPath
): string | readonly string[] {
  switch (path) {
    case 'channel':
      return reviewed.channel;
    case 'relationshipModel':
      return reviewed.relationshipModel;
    case 'input.businessContext':
      return reviewed.input.businessContext;
    case 'input.applicant.type':
      return reviewed.input.applicant.type;
    case 'input.applicant.name':
      return reviewed.input.applicant.name;
    case 'input.applicant.country':
      return reviewed.input.applicant.country;
    case 'input.trademark.type':
      return reviewed.input.trademark.type;
    case 'input.trademark.representationText':
      return reviewed.input.trademark.representationText;
    case 'input.targetJurisdictions':
      return reviewed.input.targetJurisdictions;
    case 'input.goodsServices.sourceText':
      return reviewed.input.goodsServices.sourceText;
    case 'input.filingGoal':
      return reviewed.input.filingGoal;
  }
}

function confirmedFields(
  reviewed: LiteIntakeReviewedMaterialV1,
  suffix = 'a'
): LiteIntakeFieldCandidateV1[] {
  return liteIntakeFieldPaths.map((fieldPath, index) => ({
    fieldCandidateId: `lite-intake-field_${suffix}_${index}`,
    fieldPath,
    proposedValue: valueForPath(reviewed, fieldPath),
    originClass: 'USER_SUPPLIED' as const,
    sourceIds: [INLINE_SOURCE_ID],
    aiExtractionIds: [],
    reviewState: 'CONFIRMED' as const,
    reviewedByPrincipalId: 'principal_mile',
    reviewedAt: REVIEWED_AT
  }));
}

function readyCase(
  caseCandidateId: LiteIntakeCaseCandidateId = 'lite-intake-case_one',
  state: LiteIntakeCaseState = 'READY_TO_COMMIT',
  idempotencyKey = 'p3-case-one'
): CaseFixture {
  const reviewed = material(caseCandidateId.endsWith('two') ? 'ORBIT DOG' : 'ORBIT CAT');
  const reviewedFingerprintSha256 = liteIntakeReviewedMaterialFingerprintSha256V1(reviewed);
  return {
    caseCandidateId,
    contentVersion: 1,
    state,
    fieldCandidates: confirmedFields(reviewed, caseCandidateId.endsWith('two') ? 'b' : 'a'),
    reviewedCommit: {
      reviewedStagingVersion: 3,
      reviewedContentVersion: 1,
      material: reviewed,
      reviewedFingerprintSha256,
      confirmedByPrincipalId: 'principal_mile',
      confirmedAt: REVIEWED_AT,
      markRegIdempotencyKey: idempotencyKey,
      correlationId: `correlation_${caseCandidateId}`
    },
    productionIntakeReceipt:
      state === 'COMMITTED'
        ? {
            intakeId: `production-intake_${caseCandidateId}`,
            version: 1,
            fingerprintSha256: 'c'.repeat(64),
            reviewedFingerprintSha256,
            committedAt: COMMITTED_AT
          }
        : null,
    archivedAt: state === 'ARCHIVED' ? UPDATED_AT : null
  };
}

function staging(): StagingFixture {
  return {
    schemaVersion: 1 as const,
    stagingId: 'lite-intake-staging_agency1',
    workspaceId: 'workspace-a',
    version: 3,
    lifecycle: 'ACTIVE' as const,
    sources: [
      {
        sourceId: INLINE_SOURCE_ID,
        kind: 'USER_INLINE_TEXT' as const,
        owner: 'LITE' as const,
        textSnapshot: INLINE_TEXT,
        sha256: liteIntakeInlineTextSha256V1(INLINE_TEXT),
        sizeBytes: Buffer.byteLength(INLINE_TEXT, 'utf8'),
        recordedByPrincipalId: 'principal_mile',
        recordedAt: RECORDED_AT
      },
      {
        sourceId: 'lite-intake-source_message',
        kind: 'MANAGED_COMMUNICATION_MESSAGE' as const,
        owner: 'MANAGED_COMMUNICATION' as const,
        accountRef: 'outlook-main',
        messageId: 'managed-message-1',
        threadRef: 'thread-1',
        provider: 'MICROSOFT_GRAPH',
        providerMessageId: 'graph-message-1',
        observedAt: OBSERVED_AT,
        exactEvidence: {
          owner: 'MANAGED_COMMUNICATION' as const,
          evidenceRef: 'managed-communication-evidence_1',
          sha256: 'a'.repeat(64),
          mediaType: 'application/json',
          sizeBytes: 100,
          observedAt: OBSERVED_AT
        }
      },
      {
        sourceId: ATTACHMENT_SOURCE_ID,
        kind: 'MANAGED_COMMUNICATION_ATTACHMENT' as const,
        owner: 'MANAGED_COMMUNICATION' as const,
        accountRef: 'outlook-main',
        messageId: 'managed-message-1',
        threadRef: 'thread-1',
        provider: 'MICROSOFT_GRAPH',
        providerMessageId: 'graph-message-1',
        observedAt: OBSERVED_AT,
        attachmentRef: 'attachment-1',
        fileName: 'instruction.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 500,
        sha256: 'b'.repeat(64),
        availability: 'AVAILABLE' as const
      }
    ],
    aiExtractions: [
      {
        extractionId: AI_EXTRACTION_ID,
        owner: 'MANAGED_AI' as const,
        implementationProfileId: 'profile-filing-extractor',
        implementationProfileVersion: 1,
        implementationKey: 'implementation-openai',
        provider: 'OPENAI',
        model: 'gpt',
        promptPolicyId: 'filing-intake-extraction',
        promptPolicyVersion: '1',
        outputSchemaId: 'agency-intake-extraction-v1',
        inputSha256: 'd'.repeat(64),
        outputSha256: 'e'.repeat(64),
        outputRef: 'managed-ai-output_1',
        completedAt: AI_AT,
        sourceIds: [ATTACHMENT_SOURCE_ID]
      }
    ],
    caseCandidates: [readyCase()],
    authorityConsequences: noLiteIntakeStagingAuthorityConsequencesV1,
    createdAt: RECORDED_AT,
    updatedAt: UPDATED_AT,
    archivedAt: null
  };
}

describe('Lite Intake Staging V1', () => {
  it('accepts one human-reviewed case without creating downstream authority', () => {
    const parsed = parseLiteIntakeStagingV1(staging(), 'workspace-a');
    expect(parsed.caseCandidates[0]?.state).toBe('READY_TO_COMMIT');
    expect(
      parsed.caseCandidates[0]?.reviewedCommit?.material.input.trademark.representationText
    ).toBe('ORBIT CAT');
    expect(parsed.authorityConsequences).toEqual(noLiteIntakeStagingAuthorityConsequencesV1);
    expect(Object.values(parsed.authorityConsequences).every((value) => value === false)).toBe(
      true
    );
  });

  it('fails closed on Workspace drift, unknown fields and invented upload source kinds', () => {
    expect(() => parseLiteIntakeStagingV1(staging(), 'workspace-b')).toThrow();

    const unknown = structuredClone(staging()) as Record<string, unknown>;
    unknown.untrustedAuthority = true;
    expect(() => parseLiteIntakeStagingV1(unknown)).toThrow();

    const inventedUpload = structuredClone(staging()) as Record<string, unknown>;
    (inventedUpload.sources as Array<Record<string, unknown>>)[0] = {
      sourceId: 'lite-intake-source_upload',
      kind: 'STANDALONE_UPLOAD',
      owner: 'LITE',
      sha256: 'f'.repeat(64)
    };
    expect(() => parseLiteIntakeStagingV1(inventedUpload)).toThrow();
  });

  it('binds inline source identity to exact text bytes', () => {
    const changedHash = structuredClone(staging()) as Record<string, unknown>;
    (changedHash.sources as Array<Record<string, unknown>>)[0]!.sha256 = 'f'.repeat(64);
    expect(() => parseLiteIntakeStagingV1(changedHash)).toThrow();

    const changedSize = structuredClone(staging()) as Record<string, unknown>;
    (changedSize.sources as Array<Record<string, unknown>>)[0]!.sizeBytes = 1;
    expect(() => parseLiteIntakeStagingV1(changedSize)).toThrow();
  });

  it('keeps Managed AI as derivation provenance and requires exact primary-source lineage', () => {
    const draft = staging();
    draft.caseCandidates = [
      {
        caseCandidateId: 'lite-intake-case_extract',
        contentVersion: 1,
        state: 'NEEDS_REVIEW',
        fieldCandidates: [
          {
            fieldCandidateId: 'lite-intake-field_extract',
            fieldPath: 'input.trademark.representationText',
            proposedValue: 'ORBIT CAT',
            originClass: 'EXTRACTED',
            sourceIds: [ATTACHMENT_SOURCE_ID],
            aiExtractionIds: [AI_EXTRACTION_ID],
            reviewState: 'UNREVIEWED',
            reviewedByPrincipalId: null,
            reviewedAt: null
          }
        ],
        reviewedCommit: null,
        productionIntakeReceipt: null,
        archivedAt: null
      }
    ];
    expect(parseLiteIntakeStagingV1(draft).caseCandidates[0]?.state).toBe('NEEDS_REVIEW');

    const noAi = structuredClone(draft);
    noAi.caseCandidates[0]!.fieldCandidates[0]!.aiExtractionIds = [];
    expect(() => parseLiteIntakeStagingV1(noAi)).toThrow();

    const wrongPrimary = structuredClone(draft);
    wrongPrimary.caseCandidates[0]!.fieldCandidates[0]!.sourceIds = [INLINE_SOURCE_ID];
    expect(() => parseLiteIntakeStagingV1(wrongPrimary)).toThrow();
  });

  it('does not allow unavailable attachment evidence to become confirmed filing material', () => {
    const unavailable = staging();
    const attachment = unavailable.sources[2];
    if (!attachment || attachment.kind !== 'MANAGED_COMMUNICATION_ATTACHMENT') {
      throw new Error('fixture invariant: expected attachment source');
    }
    attachment.availability = 'UNAVAILABLE';
    attachment.mediaType = null;
    attachment.sizeBytes = null;
    attachment.sha256 = null;
    unavailable.caseCandidates[0]!.fieldCandidates[0]!.sourceIds = [ATTACHMENT_SOURCE_ID];
    expect(() => parseLiteIntakeStagingV1(unavailable)).toThrow();
  });

  it('requires explicit MISSING state for NEEDS_INFORMATION and forbids invented missing provenance', () => {
    const missing = staging();
    missing.caseCandidates = [
      {
        caseCandidateId: 'lite-intake-case_missing',
        contentVersion: 1,
        state: 'NEEDS_INFORMATION',
        fieldCandidates: [
          {
            fieldCandidateId: 'lite-intake-field_missing',
            fieldPath: 'input.applicant.country',
            proposedValue: null,
            originClass: null,
            sourceIds: [],
            aiExtractionIds: [],
            reviewState: 'MISSING',
            reviewedByPrincipalId: null,
            reviewedAt: null
          }
        ],
        reviewedCommit: null,
        productionIntakeReceipt: null,
        archivedAt: null
      }
    ];
    expect(parseLiteIntakeStagingV1(missing).caseCandidates[0]?.state).toBe('NEEDS_INFORMATION');

    const noMissing = structuredClone(missing);
    noMissing.caseCandidates[0]!.fieldCandidates[0]!.reviewState = 'UNREVIEWED';
    noMissing.caseCandidates[0]!.fieldCandidates[0]!.proposedValue = 'US';
    noMissing.caseCandidates[0]!.fieldCandidates[0]!.originClass = 'USER_SUPPLIED';
    noMissing.caseCandidates[0]!.fieldCandidates[0]!.sourceIds = [INLINE_SOURCE_ID];
    expect(() => parseLiteIntakeStagingV1(noMissing)).toThrow();

    const invented = structuredClone(missing);
    invented.caseCandidates[0]!.fieldCandidates[0]!.sourceIds = [INLINE_SOURCE_ID];
    expect(() => parseLiteIntakeStagingV1(invented)).toThrow();
  });

  it('binds human confirmation to current case content and normalized reviewed material', () => {
    const wrongFingerprint = structuredClone(staging());
    wrongFingerprint.caseCandidates[0]!.reviewedCommit!.reviewedFingerprintSha256 = 'f'.repeat(64);
    expect(() => parseLiteIntakeStagingV1(wrongFingerprint)).toThrow();

    const staleReview = structuredClone(staging());
    staleReview.caseCandidates[0]!.contentVersion = 2;
    expect(() => parseLiteIntakeStagingV1(staleReview)).toThrow();

    const driftedMaterial = structuredClone(staging());
    driftedMaterial.caseCandidates[0]!.reviewedCommit!.material.input.trademark.representationText =
      'DIFFERENT';
    driftedMaterial.caseCandidates[0]!.reviewedCommit!.reviewedFingerprintSha256 =
      liteIntakeReviewedMaterialFingerprintSha256V1(
        driftedMaterial.caseCandidates[0]!.reviewedCommit!.material
      );
    expect(() => parseLiteIntakeStagingV1(driftedMaterial)).toThrow();
  });

  it('requires every ready field to be human-resolved and rejects unresolved conflicts', () => {
    const unresolved = structuredClone(staging());
    unresolved.caseCandidates[0]!.fieldCandidates[0]!.reviewState = 'UNREVIEWED';
    unresolved.caseCandidates[0]!.fieldCandidates[0]!.reviewedByPrincipalId = null;
    unresolved.caseCandidates[0]!.fieldCandidates[0]!.reviewedAt = null;
    expect(() => parseLiteIntakeStagingV1(unresolved)).toThrow();

    const conflict = structuredClone(staging());
    const first = conflict.caseCandidates[0]!.fieldCandidates[4]!;
    first.reviewState = 'CONFLICTING';
    first.reviewedByPrincipalId = null;
    first.reviewedAt = null;
    conflict.caseCandidates[0]!.fieldCandidates.push({
      ...structuredClone(first),
      fieldCandidateId: 'lite-intake-field_competing',
      proposedValue: 'Orbit Dog LLC'
    });
    expect(() => parseLiteIntakeStagingV1(conflict)).toThrow();
  });

  it('preserves stable case identity when sibling cases are reordered', () => {
    const twoCases = staging();
    twoCases.caseCandidates = [
      readyCase('lite-intake-case_one', 'READY_TO_COMMIT', 'p3-case-one'),
      readyCase('lite-intake-case_two', 'READY_TO_COMMIT', 'p3-case-two')
    ];
    const first = parseLiteIntakeStagingV1(twoCases);
    const reordered = structuredClone(twoCases);
    reordered.caseCandidates.reverse();
    const second = parseLiteIntakeStagingV1(reordered);

    const firstById = new Map(first.caseCandidates.map((item) => [item.caseCandidateId, item]));
    const secondById = new Map(second.caseCandidates.map((item) => [item.caseCandidateId, item]));
    for (const caseId of ['lite-intake-case_one', 'lite-intake-case_two'] as const) {
      expect(secondById.get(caseId)?.reviewedCommit?.reviewedFingerprintSha256).toBe(
        firstById.get(caseId)?.reviewedCommit?.reviewedFingerprintSha256
      );
    }
  });

  it('requires a distinct stable MarkReg idempotency key for every reviewed case', () => {
    const duplicate = staging();
    duplicate.caseCandidates = [
      readyCase('lite-intake-case_one', 'READY_TO_COMMIT', 'same-key'),
      readyCase('lite-intake-case_two', 'READY_TO_COMMIT', 'same-key')
    ];
    expect(() => parseLiteIntakeStagingV1(duplicate)).toThrow();

    duplicate.caseCandidates[1]!.reviewedCommit!.markRegIdempotencyKey = 'case-two-key';
    expect(parseLiteIntakeStagingV1(duplicate).caseCandidates).toHaveLength(2);
  });

  it('represents uncertain commit without fabricating failure or an owner receipt', () => {
    const uncertain = staging();
    uncertain.caseCandidates = [readyCase('lite-intake-case_one', 'COMMIT_UNCERTAIN')];
    expect(
      parseLiteIntakeStagingV1(uncertain).caseCandidates[0]?.productionIntakeReceipt
    ).toBeNull();

    const fabricated = structuredClone(uncertain);
    const reviewedFingerprintSha256 =
      fabricated.caseCandidates[0]!.reviewedCommit!.reviewedFingerprintSha256;
    fabricated.caseCandidates[0]!.productionIntakeReceipt = {
      intakeId: 'production-intake_fabricated',
      version: 1,
      fingerprintSha256: 'c'.repeat(64),
      reviewedFingerprintSha256,
      committedAt: COMMITTED_AT
    };
    expect(() => parseLiteIntakeStagingV1(fabricated)).toThrow();
  });

  it('requires COMMITTED to preserve exact Production Intake receipt lineage', () => {
    const committed = staging();
    committed.caseCandidates = [readyCase('lite-intake-case_one', 'COMMITTED')];
    const parsed = parseLiteIntakeStagingV1(committed);
    expect(parsed.caseCandidates[0]?.productionIntakeReceipt?.intakeId).toBe(
      'production-intake_lite-intake-case_one'
    );

    const missing = structuredClone(committed);
    missing.caseCandidates[0]!.productionIntakeReceipt = null;
    expect(() => parseLiteIntakeStagingV1(missing)).toThrow();

    const drift = structuredClone(committed);
    drift.caseCandidates[0]!.productionIntakeReceipt!.reviewedFingerprintSha256 = 'f'.repeat(64);
    expect(() => parseLiteIntakeStagingV1(drift)).toThrow();
  });

  it('keeps archive local and rejects any authority escalation', () => {
    const escalated = structuredClone(staging()) as Record<string, unknown>;
    (escalated.authorityConsequences as Record<string, unknown>).filingSubmitted = true;
    expect(() => parseLiteIntakeStagingV1(escalated)).toThrow();

    const archived = staging();
    const caseOne = readyCase('lite-intake-case_one', 'COMMITTED');
    caseOne.state = 'ARCHIVED';
    caseOne.archivedAt = UPDATED_AT;
    archived.lifecycle = 'ARCHIVED';
    archived.archivedAt = UPDATED_AT;
    archived.caseCandidates = [caseOne];
    expect(parseLiteIntakeStagingV1(archived).lifecycle).toBe('ARCHIVED');
  });
});
