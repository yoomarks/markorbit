import type { Meta, StoryObj } from '@storybook/react';
import {
  capabilityLearningNoAuthorityConsequences,
  type CapabilityCenterView,
  type ReflectionCandidate
} from '@markorbit/contracts';
import {
  CapabilityCenterHttpError,
  type CapabilityCenterClient
} from '../../api/capability.js';
import { CapabilityCenter } from './CapabilityCenter.js';

const workspaceId = '36363636-3636-4363-8363-363636363636';
const subjectUserId = 'user_capability_story';
const candidate: ReflectionCandidate = {
  schemaVersion: 1,
  reflectionCandidateId: 'reflection-candidate_11111111111111111111111111111111',
  workspaceId,
  subjectUserId,
  version: 2,
  runtimeCapability: { id: 'runtime-capability_story', version: 1 },
  ledgerEntries: [{ id: 'capability-ledger_11111111111111111111111111111111', sourceFingerprintSha256: 'a'.repeat(64) }],
  explanation: 'Generated from one governed evidence entry for private reflection only.',
  proposedPrivateReflection: 'I reviewed governed trademark evidence in this private Capability line.',
  generation: { policyVersion: 'story-policy-v1' },
  status: 'PENDING',
  private: true,
  createdAt: '2026-08-12T02:00:00.000Z',
  authority: capabilityLearningNoAuthorityConsequences
};

const ready: CapabilityCenterView = {
  schemaVersion: 1,
  workspaceId,
  subjectUserId,
  ledgerEntries: [
    {
      schemaVersion: 1,
      capabilityLedgerEntryId: 'capability-ledger_11111111111111111111111111111111',
      workspaceId,
      subjectUserId,
      runtimeCapability: { id: 'runtime-capability_story', version: 1 },
      observation: {
        id: 'capability-observation_11111111111111111111111111111111',
        sourceOwner: 'EXECUTION',
        sourceKind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
        sourceId: 'evidence-review-decision_story',
        sourceVersion: 1,
        sourceFingerprintSha256: 'a'.repeat(64)
      },
      appendOnly: true,
      private: true,
      recordedAt: '2026-08-12T01:50:00.000Z',
      authority: capabilityLearningNoAuthorityConsequences
    }
  ],
  profiles: [
    {
      schemaVersion: 1,
      capabilityProfileProjectionId: 'capability-profile_story',
      workspaceId,
      subjectUserId,
      version: 1,
      runtimeCapability: { id: 'runtime-capability_story', version: 1 },
      evidenceCount: 1,
      latestEvidenceAt: '2026-08-12T01:50:00.000Z',
      acceptedReflections: [],
      outstandingReflectionCandidate: { id: candidate.reflectionCandidateId, version: candidate.version },
      visibility: 'PRIVATE',
      numericProfessionalScore: null,
      verifiedBadge: false,
      generatedAt: '2026-08-12T02:00:00.000Z',
      authority: capabilityLearningNoAuthorityConsequences
    }
  ],
  twin: {
    schemaVersion: 1,
    capabilityTwinProjectionId: 'capability-twin_story',
    workspaceId,
    subjectUserId,
    version: 1,
    profile: { id: 'capability-profile_story', version: 1 },
    capabilitySummaries: [
      {
        runtimeCapabilityDefinitionId: 'runtime-capability_story',
        runtimeCapabilityVersion: 1,
        evidenceCount: 1,
        latestEvidenceAt: '2026-08-12T01:50:00.000Z'
      }
    ],
    visibility: 'PRIVATE',
    autonomousIdentity: false,
    autonomousExecutionAuthority: false,
    generatedAt: '2026-08-12T02:00:00.000Z',
    authority: capabilityLearningNoAuthorityConsequences
  },
  pendingCandidates: [{ candidate, candidateFingerprintSha256: 'b'.repeat(64) }],
  visibility: 'PRIVATE',
  generatedAt: '2026-08-12T02:00:00.000Z',
  authority: capabilityLearningNoAuthorityConsequences
};

const client = (load: CapabilityCenterClient['load'], disposition: CapabilityCenterClient['disposition'] = async () => ({})): CapabilityCenterClient => ({ load, disposition });

const meta = {
  title: 'Lite/Capability Center',
  component: CapabilityCenter,
  args: { workspaceId }
} satisfies Meta<typeof CapabilityCenter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = { args: { client: client(async () => ready) } };
export const Empty: Story = {
  args: {
    client: client(async () => ({ ...ready, ledgerEntries: [], profiles: [], twin: null, pendingCandidates: [] }))
  }
};
export const Partial: Story = {
  args: { client: client(async () => ({ ...ready, profiles: [], twin: null, pendingCandidates: [] })) }
};
export const Loading: Story = {
  args: { client: client(() => new Promise<CapabilityCenterView>(() => undefined)) }
};
export const PermissionDenied: Story = {
  args: { client: client(async () => Promise.reject(new CapabilityCenterHttpError(403, 'PERMISSION_DENIED', 'Private Capability access is not permitted.'))) }
};
export const RecoverableError: Story = {
  args: { client: client(async () => Promise.reject(new CapabilityCenterHttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Capability Engine is temporarily unavailable.'))) }
};
export const StaleDisposition: Story = {
  args: {
    client: client(
      async () => ready,
      async () => Promise.reject(new CapabilityCenterHttpError(409, 'STALE_CANDIDATE', 'Reflection Candidate is no longer current.'))
    )
  }
};
