import {
  capabilityLearningNoAuthorityConsequences,
  type CapabilityCenterView,
  type CapabilityLedgerEntry,
  type CapabilityProfileProjection,
  type CapabilityTwinProjection,
  type ReflectionCandidate
} from '@markorbit/contracts';
import { CapabilityCenterHttpError, type CapabilityCenterClient } from '../api/capability.js';

export type CapabilityReflectionPreviewScenario =
  'ready' | 'loading' | 'empty' | 'partial' | 'permission' | 'error' | 'stale' | 'complete';

export const previewWorkspaceId = '91919191-9191-4919-8919-919191919191';
const subjectUserId = 'user_fixture-maya-chen';
const fingerprint = (character: string) => character.repeat(64);

const capabilityIds = {
  clearance: 'runtime-capability_trademark-clearance-reasoning',
  evidence: 'runtime-capability_evidence-quality-review',
  client: 'runtime-capability_client-decision-framing'
} as const;

function ledgerEntry(
  suffix: string,
  capabilityId: (typeof capabilityIds)[keyof typeof capabilityIds],
  sourceKind: CapabilityLedgerEntry['observation']['sourceKind'],
  sourceOwner: CapabilityLedgerEntry['observation']['sourceOwner'],
  sourceId: string,
  recordedAt: string
): CapabilityLedgerEntry {
  return {
    schemaVersion: 1,
    capabilityLedgerEntryId: `capability-ledger_${suffix}`,
    workspaceId: previewWorkspaceId,
    subjectUserId,
    runtimeCapability: { id: capabilityId, version: 1 },
    observation: {
      id: `capability-observation_${suffix}`,
      sourceOwner,
      sourceKind,
      sourceId,
      sourceVersion: 1,
      sourceFingerprintSha256: fingerprint(suffix.charAt(0))
    },
    appendOnly: true,
    private: true,
    recordedAt,
    authority: capabilityLearningNoAuthorityConsequences
  };
}

export const previewLedger: CapabilityLedgerEntry[] = [
  ledgerEntry(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    capabilityIds.clearance,
    'MARKREG_REVIEWED_LIFECYCLE_SOURCE',
    'MARKREG',
    'formal-matter_atlas-outdoor-eu',
    '2026-09-29T10:15:00.000Z'
  ),
  ledgerEntry(
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    capabilityIds.clearance,
    'EXECUTION_PROFESSIONAL_REVIEW_DECISION',
    'EXECUTION',
    'professional-review_atlas-clearance',
    '2026-09-30T14:30:00.000Z'
  ),
  ledgerEntry(
    'cccccccccccccccccccccccccccccccc',
    capabilityIds.evidence,
    'EXECUTION_EVIDENCE_REVIEW_DECISION',
    'EXECUTION',
    'evidence-review_river-studio',
    '2026-09-24T09:05:00.000Z'
  ),
  ledgerEntry(
    'dddddddddddddddddddddddddddddddd',
    capabilityIds.client,
    'MARKREG_REVIEWED_LIFECYCLE_SOURCE',
    'MARKREG',
    'recommended-action_northstar-goods',
    '2026-09-18T16:20:00.000Z'
  ),
  ledgerEntry(
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    capabilityIds.evidence,
    'EXECUTION_EVIDENCE_REVIEW_DECISION',
    'EXECUTION',
    'evidence-review_wildfern',
    '2026-09-12T11:45:00.000Z'
  )
];

export const previewCandidate: ReflectionCandidate = {
  schemaVersion: 1,
  reflectionCandidateId: 'reflection-candidate_ffffffffffffffffffffffffffffffff',
  workspaceId: previewWorkspaceId,
  subjectUserId,
  version: 2,
  runtimeCapability: { id: capabilityIds.clearance, version: 1 },
  ledgerEntries: previewLedger.slice(0, 2).map((entry) => ({
    id: entry.capabilityLedgerEntryId,
    sourceFingerprintSha256: entry.observation.sourceFingerprintSha256
  })),
  explanation:
    'Two independently reviewed outcomes show a repeated pattern: you separated factual similarity evidence from commercial risk and made the decision legible to the customer.',
  proposedPrivateReflection:
    'I can turn complex clearance evidence into a focused, decision-ready risk view without overstating what the evidence proves.',
  generation: { policyVersion: 'private-reflection-policy-v1.2' },
  status: 'PENDING',
  private: true,
  createdAt: '2026-10-01T08:00:00.000Z',
  authority: capabilityLearningNoAuthorityConsequences
};

const profiles: CapabilityProfileProjection[] = [
  {
    schemaVersion: 1,
    capabilityProfileProjectionId: 'capability-profile_clearance-fixture',
    workspaceId: previewWorkspaceId,
    subjectUserId,
    version: 2,
    runtimeCapability: { id: capabilityIds.clearance, version: 1 },
    evidenceCount: 2,
    latestEvidenceAt: '2026-09-30T14:30:00.000Z',
    acceptedReflections: [],
    outstandingReflectionCandidate: {
      id: previewCandidate.reflectionCandidateId,
      version: previewCandidate.version
    },
    visibility: 'PRIVATE',
    numericProfessionalScore: null,
    verifiedBadge: false,
    generatedAt: '2026-10-01T08:00:00.000Z',
    authority: capabilityLearningNoAuthorityConsequences
  },
  {
    schemaVersion: 1,
    capabilityProfileProjectionId: 'capability-profile_evidence-fixture',
    workspaceId: previewWorkspaceId,
    subjectUserId,
    version: 3,
    runtimeCapability: { id: capabilityIds.evidence, version: 1 },
    evidenceCount: 2,
    latestEvidenceAt: '2026-09-24T09:05:00.000Z',
    acceptedReflections: [
      {
        candidateId: 'reflection-candidate_evidencefixture000000000000000',
        candidateVersion: 1,
        dispositionId: 'reflection-disposition_evidencefixture00000000000',
        acceptedAt: '2026-09-25T09:00:00.000Z',
        text: 'I notice missing provenance early and keep evidence conclusions bounded to the reviewed source.'
      }
    ],
    visibility: 'PRIVATE',
    numericProfessionalScore: null,
    verifiedBadge: false,
    generatedAt: '2026-10-01T08:00:00.000Z',
    authority: capabilityLearningNoAuthorityConsequences
  },
  {
    schemaVersion: 1,
    capabilityProfileProjectionId: 'capability-profile_client-fixture',
    workspaceId: previewWorkspaceId,
    subjectUserId,
    version: 1,
    runtimeCapability: { id: capabilityIds.client, version: 1 },
    evidenceCount: 1,
    latestEvidenceAt: '2026-09-18T16:20:00.000Z',
    acceptedReflections: [
      {
        candidateId: 'reflection-candidate_clientfixture0000000000000000',
        candidateVersion: 1,
        dispositionId: 'reflection-disposition_clientfixture000000000000',
        acceptedAt: '2026-09-19T10:00:00.000Z',
        text: 'I frame recommendations around the decision the customer needs to make next.'
      }
    ],
    visibility: 'PRIVATE',
    numericProfessionalScore: null,
    verifiedBadge: false,
    generatedAt: '2026-10-01T08:00:00.000Z',
    authority: capabilityLearningNoAuthorityConsequences
  }
];

function twin(acceptedClearance?: string): CapabilityTwinProjection {
  return {
    schemaVersion: 1,
    capabilityTwinProjectionId: 'capability-twin_fixture-maya-chen',
    workspaceId: previewWorkspaceId,
    subjectUserId,
    version: acceptedClearance ? 5 : 4,
    profile: { id: profiles[0]!.capabilityProfileProjectionId, version: acceptedClearance ? 3 : 2 },
    capabilitySummaries: [
      {
        runtimeCapabilityDefinitionId: capabilityIds.clearance,
        runtimeCapabilityVersion: 1,
        evidenceCount: 2,
        latestEvidenceAt: '2026-09-30T14:30:00.000Z',
        ...(acceptedClearance ? { acceptedPrivateReflection: acceptedClearance } : {})
      },
      {
        runtimeCapabilityDefinitionId: capabilityIds.evidence,
        runtimeCapabilityVersion: 1,
        evidenceCount: 2,
        latestEvidenceAt: '2026-09-24T09:05:00.000Z',
        acceptedPrivateReflection:
          'I notice missing provenance early and keep evidence conclusions bounded to the reviewed source.'
      },
      {
        runtimeCapabilityDefinitionId: capabilityIds.client,
        runtimeCapabilityVersion: 1,
        evidenceCount: 1,
        latestEvidenceAt: '2026-09-18T16:20:00.000Z',
        acceptedPrivateReflection:
          'I frame recommendations around the decision the customer needs to make next.'
      }
    ],
    visibility: 'PRIVATE',
    autonomousIdentity: false,
    autonomousExecutionAuthority: false,
    generatedAt: '2026-10-01T08:00:00.000Z',
    authority: capabilityLearningNoAuthorityConsequences
  };
}

export const readyView: CapabilityCenterView = {
  schemaVersion: 1,
  workspaceId: previewWorkspaceId,
  subjectUserId,
  ledgerEntries: previewLedger,
  profiles,
  twin: twin(),
  pendingCandidates: [
    { candidate: previewCandidate, candidateFingerprintSha256: fingerprint('f') }
  ],
  visibility: 'PRIVATE',
  generatedAt: '2026-10-01T08:00:00.000Z',
  authority: capabilityLearningNoAuthorityConsequences
};

function acceptedView(): CapabilityCenterView {
  const acceptedText = previewCandidate.proposedPrivateReflection;
  return {
    ...readyView,
    profiles: profiles.map((profile, index) => {
      if (index !== 0) return profile;
      const current = { ...profile };
      delete current.outstandingReflectionCandidate;
      return {
        ...current,
        version: 3,
        acceptedReflections: [
          {
            candidateId: previewCandidate.reflectionCandidateId,
            candidateVersion: previewCandidate.version,
            dispositionId: 'reflection-disposition_fixture-accepted',
            acceptedAt: '2026-10-01T08:05:00.000Z',
            text: acceptedText
          }
        ]
      };
    }),
    twin: twin(acceptedText),
    pendingCandidates: [],
    generatedAt: '2026-10-01T08:05:00.000Z'
  };
}

export function clientForScenario(
  scenario: CapabilityReflectionPreviewScenario
): CapabilityCenterClient {
  let current = scenario === 'complete' ? acceptedView() : readyView;

  return {
    load: () => {
      if (scenario === 'loading') return new Promise<CapabilityCenterView>(() => undefined);
      if (scenario === 'permission') {
        return Promise.reject(
          new CapabilityCenterHttpError(
            403,
            'PERMISSION_DENIED',
            'Your current workspace role cannot read these private insights.'
          )
        );
      }
      if (scenario === 'error') {
        return Promise.reject(
          new CapabilityCenterHttpError(
            503,
            'DOWNSTREAM_UNAVAILABLE',
            'Private evidence is temporarily unavailable. No state was inferred.'
          )
        );
      }
      if (scenario === 'empty') {
        return Promise.resolve({
          ...readyView,
          ledgerEntries: [],
          profiles: [],
          twin: null,
          pendingCandidates: []
        });
      }
      if (scenario === 'partial') {
        return Promise.resolve({
          ...readyView,
          profiles: [],
          twin: null,
          pendingCandidates: []
        });
      }
      return Promise.resolve(current);
    },
    disposition: ({ outcome }) => {
      if (scenario === 'stale') {
        return Promise.reject(
          new CapabilityCenterHttpError(
            409,
            'STALE_CANDIDATE',
            'A newer private suggestion is now current.'
          )
        );
      }
      current = outcome === 'ACCEPTED' ? acceptedView() : { ...readyView, pendingCandidates: [] };
      return Promise.resolve({ outcome });
    }
  };
}
