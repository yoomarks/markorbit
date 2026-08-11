import { describe, expect, it } from 'vitest';
import {
  capabilityLearningAuthorityFixture,
  capabilityLearningNoAuthorityConsequences,
  capabilityObservationSourceKinds,
  capabilityObservationSourceOwners,
  reflectionDispositionOutcomes,
  type CapabilityProfileProjection,
  type CapabilityTwinProjection,
  type ReflectionCandidate,
  type ReflectionDisposition,
  type RuntimeCapabilityDefinition
} from '../src/capability-learning.js';

const falseConsequences = capabilityLearningNoAuthorityConsequences;

describe('M6-WP-01 capability learning contracts', () => {
  it('admits only governed Execution/MarkReg observation source families', () => {
    expect(capabilityObservationSourceOwners).toEqual(['EXECUTION', 'MARKREG']);
    expect(capabilityObservationSourceOwners).not.toContain('MGSN');
    expect(capabilityObservationSourceKinds).not.toContain('PROVIDER_RETURN');
    expect(capabilityObservationSourceKinds).not.toContain('PROVIDER_SUPPLY_CAPABILITY');
  });

  it('keeps all reflection dispositions explicit', () => {
    expect(reflectionDispositionOutcomes).toEqual(['ACCEPTED', 'REJECTED', 'DEFERRED']);
  });

  it('freezes observed, candidate and accepted reflection as non-authoritative', () => {
    for (const consequences of [
      capabilityLearningAuthorityFixture.observedEvidence,
      capabilityLearningAuthorityFixture.reflectionCandidate,
      capabilityLearningAuthorityFixture.acceptedPrivateReflection
    ]) {
      expect(consequences).toEqual(falseConsequences);
      expect(Object.values(consequences).every((value) => value === false)).toBe(true);
    }
  });

  it('keeps runtime definitions bound to accepted Canon', () => {
    const definition: RuntimeCapabilityDefinition = {
      schemaVersion: 1,
      runtimeCapabilityDefinitionId: 'runtime-capability_tm-application',
      version: 1,
      capabilityId: 'trademark-application',
      capabilityVersion: '1.0.0',
      title: 'Trademark application',
      description: 'Accepted Canon projection for runtime binding.',
      lineage: { domainId: 'trademark', capabilityId: 'trademark-application' },
      canonReference: {
        canonId: 'capability-canon',
        canonVersion: '2026-08-12',
        sourceFingerprintSha256: 'a'.repeat(64)
      },
      acceptedCanonProjection: true,
      createdFromWorkEvidence: false,
      createdFromAiOutput: false,
      createdAt: '2026-08-12T00:00:00.000Z'
    };

    expect(definition.acceptedCanonProjection).toBe(true);
    expect(definition.createdFromWorkEvidence).toBe(false);
    expect(definition.createdFromAiOutput).toBe(false);
  });

  it('keeps private profile and twin free of verification, scores and execution authority', () => {
    const candidate: ReflectionCandidate = {
      schemaVersion: 1,
      reflectionCandidateId: 'reflection-candidate_candidate-1',
      workspaceId: '00000000-0000-4000-8000-000000000001',
      subjectUserId: 'user_subject-1',
      version: 1,
      runtimeCapability: { id: 'runtime-capability_tm-application', version: 1 },
      ledgerEntries: [
        {
          id: 'capability-ledger_entry-1',
          sourceFingerprintSha256: 'b'.repeat(64)
        }
      ],
      explanation: 'Governed evidence supports a private reflection candidate.',
      proposedPrivateReflection: 'I have recent reviewed experience in this workflow.',
      generation: { policyVersion: 'm6-reflection-v1' },
      status: 'PENDING',
      private: true,
      createdAt: '2026-08-12T00:00:00.000Z',
      authority: falseConsequences
    };
    const disposition: ReflectionDisposition = {
      schemaVersion: 1,
      reflectionDispositionId: 'reflection-disposition_disposition-1',
      workspaceId: candidate.workspaceId,
      subjectUserId: candidate.subjectUserId,
      candidate: {
        id: candidate.reflectionCandidateId,
        version: candidate.version,
        fingerprintSha256: 'c'.repeat(64)
      },
      outcome: 'ACCEPTED',
      decidedBySubjectUserId: candidate.subjectUserId,
      decidedAt: '2026-08-12T00:01:00.000Z',
      authority: falseConsequences
    };
    const profile: CapabilityProfileProjection = {
      schemaVersion: 1,
      capabilityProfileProjectionId: 'capability-profile_profile-1',
      workspaceId: candidate.workspaceId,
      subjectUserId: candidate.subjectUserId,
      version: 1,
      runtimeCapability: candidate.runtimeCapability,
      evidenceCount: 1,
      latestEvidenceAt: '2026-08-12T00:00:00.000Z',
      acceptedReflections: [
        {
          candidateId: candidate.reflectionCandidateId,
          candidateVersion: candidate.version,
          dispositionId: disposition.reflectionDispositionId,
          acceptedAt: disposition.decidedAt,
          text: candidate.proposedPrivateReflection
        }
      ],
      visibility: 'PRIVATE',
      numericProfessionalScore: null,
      verifiedBadge: false,
      generatedAt: '2026-08-12T00:02:00.000Z',
      authority: falseConsequences
    };
    const twin: CapabilityTwinProjection = {
      schemaVersion: 1,
      capabilityTwinProjectionId: 'capability-twin_twin-1',
      workspaceId: profile.workspaceId,
      subjectUserId: profile.subjectUserId,
      version: 1,
      profile: { id: profile.capabilityProfileProjectionId, version: profile.version },
      capabilitySummaries: [
        {
          runtimeCapabilityDefinitionId: profile.runtimeCapability.id,
          runtimeCapabilityVersion: profile.runtimeCapability.version,
          evidenceCount: profile.evidenceCount,
          latestEvidenceAt: profile.latestEvidenceAt!,
          acceptedPrivateReflection: profile.acceptedReflections[0]!.text
        }
      ],
      visibility: 'PRIVATE',
      autonomousIdentity: false,
      autonomousExecutionAuthority: false,
      generatedAt: '2026-08-12T00:03:00.000Z',
      authority: falseConsequences
    };

    expect(profile.verifiedBadge).toBe(false);
    expect(profile.numericProfessionalScore).toBeNull();
    expect(twin.autonomousIdentity).toBe(false);
    expect(twin.autonomousExecutionAuthority).toBe(false);
    expect(disposition.authority.capabilityVerified).toBe(false);
    expect(disposition.authority.canonicalTruth).toBe(false);
  });
});
