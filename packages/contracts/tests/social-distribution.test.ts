import { describe, expect, it } from 'vitest';
import {
  assessDistributionIntentSourceV1,
  assessDistributionTargetEligibilityV1,
  assessPublishReceiptV1,
  parseDistributionIntentV1,
  parseDistributionTargetV1,
  parsePublishReceiptV1
} from '../src/social-distribution.js';
import { parseSocialChannelBindingV1 } from '../src/social-channel-binding.js';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);

const authority = {
  credentialAuthorityGranted: false,
  providerSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  executionAuthorized: false,
  executionStarted: false,
  publicationAuthorized: false,
  externalMessageAuthorized: false,
  officialTruthCreated: false,
  businessTruthCreated: false,
  trademarkTruthCreated: false
} as const;
const bindingAuthority = {
  credentialStoredInBusinessContract: false,
  credentialAuthorityGranted: false,
  providerSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  executionStarted: false,
  externalPublicationCreated: false,
  externalMessageSent: false
} as const;

const publishPackage = {
  schemaVersion: 1,
  publishPackageId: 'publish-package_social-003',
  workspaceId: 'workspace_01',
  version: 3,
  contentDraft: { id: 'content-draft_social-003', version: 4 },
  contentDraftFingerprintSha256: hashB,
  reviewDecision: { id: 'content-review-decision_social-003', version: 2 },
  title: 'Approved social title',
  body: 'Approved social body',
  publishPackageFingerprintSha256: hashA,
  status: 'PREPARED',
  externalPublishExecuted: false,
  createdAt: '2026-09-10T10:00:00Z'
} as const;
const binding = parseSocialChannelBindingV1({
  schemaVersion: 1,
  socialChannelBindingId: 'social-channel-binding_linkedin-01',
  version: 2,
  workspaceId: 'workspace_01',
  identity: {
    platformId: 'linkedin',
    externalAccountId: 'person_123',
    externalChannelId: 'page_456',
    displayLabel: 'Mark Orbit'
  },
  status: 'ACTIVE',
  connection: {
    sourceKind: 'PLATFORM_AUTH',
    capabilityRef: { capabilityId: 'social.channel.connect', capabilityVersion: '1.0.0' },
    implementationRef: {
      implementationProfileId: 'implementation-profile_linkedin-official-api',
      version: 1
    },
    evidenceRefs: ['evidence:social-binding:linkedin-01']
  },
  boundAt: '2026-09-10T09:50:00Z',
  lastVerifiedAt: '2026-09-10T09:55:00Z',
  updatedAt: '2026-09-10T09:55:00Z',
  authority: bindingAuthority
});
const intentInput = {
  schemaVersion: 1,
  distributionIntentId: 'distribution-intent_social-003',
  version: 1,
  workspaceId: 'workspace_01',
  source: {
    kind: 'PUBLISH_PACKAGE',
    publishPackageId: publishPackage.publishPackageId,
    version: publishPackage.version,
    fingerprintSha256: publishPackage.publishPackageFingerprintSha256
  },
  targets: [{ id: 'distribution-target_linkedin-01', version: 1 }],
  adaptationPolicy: 'EXACT_AS_APPROVED',
  humanReviewRequired: true,
  createdAt: '2026-09-10T10:01:00Z',
  updatedAt: '2026-09-10T10:01:00Z',
  authority
} as const;

const targetInput = {
  schemaVersion: 1,
  distributionTargetId: 'distribution-target_linkedin-01',
  version: 1,
  workspaceId: 'workspace_01',
  intent: { id: 'distribution-intent_social-003', version: 1 },
  channelBinding: { id: binding.socialChannelBindingId, version: binding.version },
  destination: {
    platformId: 'linkedin',
    externalAccountId: 'person_123',
    externalChannelId: 'page_456'
  },
  delivery: { timing: 'IMMEDIATE', visibility: 'PUBLIC' },
  createdAt: '2026-09-10T10:02:00Z',
  updatedAt: '2026-09-10T10:02:00Z',
  authority
} as const;

const receiptInput = {
  schemaVersion: 1,
  publishReceiptId: 'publish-receipt_linkedin-01',
  version: 1,
  workspaceId: 'workspace_01',
  intent: { id: 'distribution-intent_social-003', version: 1 },
  target: { id: 'distribution-target_linkedin-01', version: 1 },
  execution: { executionId: 'execution_social-003', correlationId: 'correlation_social-003' },
  implementation: {
    implementationProfileId: 'implementation-profile_linkedin-official-api',
    version: 1
  },
  submittedAt: '2026-09-10T10:10:00Z',
  acceptedAt: '2026-09-10T10:10:01Z',
  observation: {
    status: 'PUBLISHED',
    evidenceKind: 'PLATFORM_RECEIPT',
    platformObjectId: 'urn:li:share:123',
    evidenceRefs: ['evidence:linkedin:publish:123'],
    observedAt: '2026-09-10T10:10:02Z'
  },
  createdAt: '2026-09-10T10:10:03Z',
  authority
} as const;

const verified = {
  status: 'VERIFIED',
  observedAt: '2026-09-10T10:03:00Z'
} as const;

function parsedTriplet() {
  return {
    intent: parseDistributionIntentV1(intentInput),
    target: parseDistributionTargetV1(targetInput),
    receipt: parsePublishReceiptV1(receiptInput)
  };
}

describe('social distribution contracts', () => {
  it('accepts exact owner-backed intent and target without granting action authority', () => {
    const { intent, target } = parsedTriplet();
    expect(intent).toMatchObject({
      source: { kind: 'PUBLISH_PACKAGE', version: 3 },
      humanReviewRequired: true,
      authority
    });
    expect(target).toMatchObject({
      channelBinding: { id: binding.socialChannelBindingId, version: 2 },
      destination: { platformId: 'linkedin', externalAccountId: 'person_123' },
      authority
    });
  });

  it('binds DistributionIntent to the exact PublishPackage id, version and fingerprint', () => {
    const intent = parseDistributionIntentV1(intentInput);
    expect(assessDistributionIntentSourceV1(intent, publishPackage)).toEqual({
      matches: true,
      reason: 'MATCH',
      createsExecutionAuthority: false
    });
    expect(
      assessDistributionIntentSourceV1(intent, { ...publishPackage, version: 4 })
    ).toMatchObject({ matches: false, reason: 'SOURCE_VERSION_MISMATCH' });
  });
  it('fails source assessment closed for cross-workspace and fingerprint drift', () => {
    const intent = parseDistributionIntentV1(intentInput);
    expect(
      assessDistributionIntentSourceV1(intent, {
        ...publishPackage,
        workspaceId: 'workspace_other'
      })
    ).toMatchObject({ matches: false, reason: 'WORKSPACE_MISMATCH' });
    expect(
      assessDistributionIntentSourceV1(intent, {
        ...publishPackage,
        publishPackageFingerprintSha256: hashC
      })
    ).toMatchObject({ matches: false, reason: 'SOURCE_FINGERPRINT_MISMATCH' });
  });

  it('supports exact Media Artifact sources while retaining the Media rights snapshot boundary', () => {
    const media = {
      schemaVersion: 1,
      objectType: 'VIDEO_ARTIFACT',
      videoArtifactId: 'video-artifact_social-003',
      version: 2,
      workspaceId: 'workspace_01',
      mimeType: 'video/mp4',
      sha256: hashB,
      sizeBytes: 1200,
      durationMs: 6000,
      sourceRefs: [
        { kind: 'CONTENT', owner: 'LITE', referenceId: 'publish-package_social-003', version: '3' }
      ],
      rightsSnapshot: {
        snapshotId: 'media-rights_social-003',
        version: 1,
        fingerprintSha256: hashC,
        capturedAt: '2026-09-10T09:59:00Z',
        currentEligibilityRevalidationRequired: true
      },
      provenance: { sourceKind: 'IMPORTED', sourceEvidenceRefs: ['evidence:media:import'] },
      createdAt: '2026-09-10T10:00:30Z'
    } as const;
    const intent = parseDistributionIntentV1({
      ...intentInput,
      source: {
        kind: 'MEDIA_ARTIFACT',
        artifactType: 'VIDEO_ARTIFACT',
        artifactId: media.videoArtifactId,
        version: media.version,
        sha256: media.sha256,
        rightsSnapshot: media.rightsSnapshot
      }
    });
    expect(assessDistributionIntentSourceV1(intent, media)).toMatchObject({
      matches: true,
      reason: 'MATCH'
    });
  });
  it('admits an exact target only when Intent, Binding, destination and current verification agree', () => {
    const { intent, target } = parsedTriplet();
    expect(
      assessDistributionTargetEligibilityV1(target, intent, binding, {
        assessedAt: '2026-09-10T10:04:00Z',
        verification: verified
      })
    ).toMatchObject({
      eligible: true,
      reason: 'ELIGIBLE',
      createsExecutionAuthority: false
    });
  });

  it('fails target eligibility closed for cross-workspace or wrong Intent lineage', () => {
    const intent = parseDistributionIntentV1(intentInput);
    const otherWorkspace = parseDistributionTargetV1({
      ...targetInput,
      workspaceId: 'workspace_other'
    });
    expect(
      assessDistributionTargetEligibilityV1(otherWorkspace, intent, binding, {
        assessedAt: '2026-09-10T10:04:00Z',
        verification: verified
      })
    ).toMatchObject({ eligible: false, reason: 'TARGET_WORKSPACE_MISMATCH' });
  });
  it('fails target eligibility closed when destination identity does not match the exact Binding', () => {
    const intent = parseDistributionIntentV1(intentInput);
    const wrongDestination = parseDistributionTargetV1({
      ...targetInput,
      destination: { ...targetInput.destination, externalChannelId: 'page_wrong' }
    });
    expect(
      assessDistributionTargetEligibilityV1(wrongDestination, intent, binding, {
        assessedAt: '2026-09-10T10:04:00Z',
        verification: verified
      })
    ).toMatchObject({ eligible: false, reason: 'DESTINATION_IDENTITY_MISMATCH' });
  });

  it.each([
    ['UNKNOWN', 'CHANNEL_VERIFICATION_UNKNOWN'],
    ['UNAVAILABLE', 'CHANNEL_VERIFICATION_UNAVAILABLE']
  ] as const)(
    'fails target eligibility closed when current channel verification is %s',
    (status, reason) => {
      const { intent, target } = parsedTriplet();
      expect(
        assessDistributionTargetEligibilityV1(target, intent, binding, {
          assessedAt: '2026-09-10T10:04:00Z',
          verification: { status, observedAt: '2026-09-10T10:03:00Z' }
        })
      ).toMatchObject({ eligible: false, reason });
    }
  );
  it.each([
    ['accessToken', 'secret-access'],
    ['cookie', 'sid=secret'],
    ['provider', 'linkedin'],
    ['model', 'social-model'],
    ['endpoint', 'https://example.invalid'],
    ['metadata', { arbitrary: true }],
    ['rawResponse', { ok: true }]
  ] as const)('rejects credential/provider/raw escape hatches: %s', (key, value) => {
    expect(() =>
      parseDistributionTargetV1({
        ...targetInput,
        delivery: { ...targetInput.delivery, [key]: value }
      })
    ).toThrow('forbidden material');
  });

  it('keeps Intent and Target authority consequences permanently false', () => {
    expect(() =>
      parseDistributionIntentV1({
        ...intentInput,
        authority: { ...authority, protectedActionAuthorized: true }
      })
    ).toThrow('authority.protectedActionAuthorized must be false');
    expect(() =>
      parseDistributionTargetV1({
        ...targetInput,
        authority: { ...authority, executionStarted: true }
      })
    ).toThrow('authority.executionStarted must be false');
  });
  it('confirms PUBLISHED only from explicit platform receipt evidence with exact provenance', () => {
    const { intent, target, receipt } = parsedTriplet();
    expect(
      assessPublishReceiptV1(receipt, intent, target, {
        execution: receipt.execution,
        implementation: receipt.implementation
      })
    ).toEqual({
      publicationConfirmed: true,
      reason: 'PUBLISHED_CONFIRMED',
      receipt: { id: 'publish-receipt_linkedin-01', version: 1 },
      createsOfficialTruth: false,
      createsBusinessTruth: false,
      createsTrademarkTruth: false
    });
  });

  it('rejects fake provider or HTTP success as proof of PUBLISHED', () => {
    expect(() =>
      parsePublishReceiptV1({
        ...receiptInput,
        observation: {
          ...receiptInput.observation,
          evidenceKind: 'ADAPTER_TRANSPORT'
        }
      })
    ).toThrow('Transport/provider success cannot prove PUBLISHED');
    expect(() =>
      parsePublishReceiptV1({
        ...receiptInput,
        observation: { ...receiptInput.observation, httpStatus: 200 }
      })
    ).toThrow('forbidden material');
  });

  it.each([
    ['UNKNOWN', 'PLATFORM_STATE_UNKNOWN'],
    ['UNAVAILABLE', 'PLATFORM_UNAVAILABLE']
  ] as const)('keeps %s platform state explicit and unconfirmed', (status, reason) => {
    const { intent, target } = parsedTriplet();
    const receipt = parsePublishReceiptV1({
      ...receiptInput,
      acceptedAt: undefined,
      observation: {
        status,
        evidenceKind: 'PLATFORM_RECONCILIATION',
        evidenceRefs: [`evidence:linkedin:${status.toLowerCase()}`],
        observedAt: '2026-09-10T10:10:02Z'
      }
    });
    expect(
      assessPublishReceiptV1(receipt, intent, target, {
        execution: receipt.execution,
        implementation: receipt.implementation
      })
    ).toMatchObject({ publicationConfirmed: false, reason });
  });
  it('fails receipt assessment closed for execution provenance mismatch', () => {
    const { intent, target, receipt } = parsedTriplet();
    expect(
      assessPublishReceiptV1(receipt, intent, target, {
        execution: { ...receipt.execution, executionId: 'execution_other' },
        implementation: receipt.implementation
      })
    ).toMatchObject({ publicationConfirmed: false, reason: 'EXECUTION_PROVENANCE_MISMATCH' });
  });

  it('fails receipt assessment closed for Implementation Profile provenance mismatch', () => {
    const { intent, target, receipt } = parsedTriplet();
    expect(
      assessPublishReceiptV1(receipt, intent, target, {
        execution: receipt.execution,
        implementation: { ...receipt.implementation, version: 2 }
      })
    ).toMatchObject({
      publicationConfirmed: false,
      reason: 'IMPLEMENTATION_PROVENANCE_MISMATCH'
    });
  });

  it('requires explicit published evidence fields and chronological receipt timestamps', () => {
    expect(() => parsePublishReceiptV1({ ...receiptInput, acceptedAt: undefined })).toThrow(
      'PUBLISHED receipt requires acceptedAt'
    );
    expect(() =>
      parsePublishReceiptV1({
        ...receiptInput,
        observation: { ...receiptInput.observation, platformObjectId: undefined }
      })
    ).toThrow('PUBLISHED observation requires platformObjectId');
    expect(() =>
      parsePublishReceiptV1({
        ...receiptInput,
        acceptedAt: '2026-09-10T10:09:00Z'
      })
    ).toThrow('submittedAt cannot be after acceptedAt');
  });

  it('treats requested publish time as intent only, never as scheduling or execution authority', () => {
    const target = parseDistributionTargetV1({
      ...targetInput,
      delivery: {
        timing: 'REQUESTED_TIME',
        requestedPublishAt: '2026-09-10T11:00:00Z',
        visibility: 'ACCOUNT_DEFAULT'
      }
    });
    expect(target.delivery).toMatchObject({ timing: 'REQUESTED_TIME' });
    expect(target.authority.executionStarted).toBe(false);
    expect(target.authority.publicationAuthorized).toBe(false);
  });
});

describe('social distribution exact lineage hardening', () => {
  it('fails closed when a Target points at a different exact Channel Binding version', () => {
    const intent = parseDistributionIntentV1(intentInput);
    const target = parseDistributionTargetV1({
      ...targetInput,
      channelBinding: { id: binding.socialChannelBindingId, version: binding.version + 1 }
    });
    expect(
      assessDistributionTargetEligibilityV1(target, intent, binding, {
        assessedAt: '2026-09-10T10:04:00Z',
        verification: verified
      })
    ).toMatchObject({ eligible: false, reason: 'BINDING_REFERENCE_MISMATCH' });
  });

  it('fails receipt assessment closed for wrong exact Intent lineage', () => {
    const { intent, target, receipt } = parsedTriplet();
    const mismatched = {
      ...receipt,
      intent: { ...receipt.intent, version: receipt.intent.version + 1 }
    };
    expect(
      assessPublishReceiptV1(mismatched, intent, target, {
        execution: receipt.execution,
        implementation: receipt.implementation
      })
    ).toMatchObject({ publicationConfirmed: false, reason: 'INTENT_REFERENCE_MISMATCH' });
  });

  it('fails receipt assessment closed for wrong exact Target lineage', () => {
    const { intent, target, receipt } = parsedTriplet();
    const mismatched = {
      ...receipt,
      target: { ...receipt.target, version: receipt.target.version + 1 }
    };
    expect(
      assessPublishReceiptV1(mismatched, intent, target, {
        execution: receipt.execution,
        implementation: receipt.implementation
      })
    ).toMatchObject({ publicationConfirmed: false, reason: 'TARGET_REFERENCE_MISMATCH' });
  });
});
