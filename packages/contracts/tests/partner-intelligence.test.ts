import { describe, expect, it } from 'vitest';
import {
  noPartnerCandidateAuthorityConsequencesV1,
  noPartnerQualificationAuthorityConsequencesV1,
  parsePartnerCandidateV1,
  parsePartnerQualificationDecisionV1,
  partnerCandidateFingerprintSha256V1,
  partnerQualificationFingerprintSha256V1
} from '../src/partner-intelligence.js';

const observedAt = '2026-09-16T00:00:00.000Z';
const candidateBase = {
  schemaVersion: 1 as const,
  partnerCandidateId: 'partner-candidate_us-firm-1' as const,
  workspaceId: '11111111-1111-4111-8111-111111111111',
  version: 1 as const,
  status: 'OPEN_FOR_HUMAN_QUALIFICATION' as const,
  evidenceRefs: [
    {
      owner: 'PUBLIC_SOURCE',
      kind: 'TRADEMARK_REPRESENTATION_RECORD',
      id: 'https://public.example/case/1',
      version: 'observed-v1',
      fingerprintSha256: 'a'.repeat(64),
      observedAt
    },
    {
      owner: 'CORE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      id: 'ready-package_partner-1',
      version: 'CORE_ACCEPTED_V1',
      fingerprintSha256: 'b'.repeat(64),
      observedAt
    }
  ],
  brief: {
    entityKind: 'FIRM' as const,
    displayName: 'Example IP Law',
    jurisdiction: 'US',
    serviceFocus: ['TRADEMARK_PROSECUTION'],
    observedPublicTrademarkWork: ['Representative shown on public trademark record 1.'],
    chinaInternationalRelevance:
      'Public evidence supports an international trademark cooperation hypothesis.',
    existingWorkspaceHistory: null,
    cooperationHypothesis: 'A mutual inbound/outbound referral conversation may be useful.',
    uncertainty: [
      'Public representation does not establish current capacity or verified capability.'
    ],
    suggestedOutreach: {
      subject: 'Possible trademark cooperation',
      body: 'Would a short introductory conversation be useful?'
    }
  },
  admittedByPrincipalId: 'user_professional',
  admittedAt: observedAt,
  authorityConsequences: noPartnerCandidateAuthorityConsequencesV1
};

describe('Partner Intelligence V1 contracts', () => {
  it('preserves public/Knowledge lineage without creating Provider truth', () => {
    const value = parsePartnerCandidateV1({
      ...candidateBase,
      partnerCandidateFingerprintSha256: partnerCandidateFingerprintSha256V1(candidateBase)
    });
    expect(value.evidenceRefs.map((ref) => ref.owner)).toEqual(['PUBLIC_SOURCE', 'CORE']);
    expect(value.authorityConsequences.providerCreated).toBe(false);
    expect(value.authorityConsequences.providerCapabilityVerified).toBe(false);
  });

  it('requires both public evidence and an accepted Knowledge package', () => {
    const withoutKnowledge = { ...candidateBase, evidenceRefs: [candidateBase.evidenceRefs[0]!] };
    expect(() =>
      parsePartnerCandidateV1({
        ...withoutKnowledge,
        partnerCandidateFingerprintSha256: partnerCandidateFingerprintSha256V1(withoutKnowledge)
      })
    ).toThrow(/public and Knowledge evidence/i);
  });

  it('binds the human decision to the exact candidate fingerprint', () => {
    const base = {
      schemaVersion: 1 as const,
      partnerQualificationDecisionId: 'partner-qualification_1' as const,
      workspaceId: candidateBase.workspaceId,
      version: 1 as const,
      partnerCandidateId: candidateBase.partnerCandidateId,
      partnerCandidateVersion: 1 as const,
      partnerCandidateFingerprintSha256: 'c'.repeat(64),
      outcome: 'QUALIFIED' as const,
      rationale: 'Human review supports a bounded introductory conversation.',
      decidedByPrincipalId: 'user_professional',
      decidedAt: observedAt,
      authorityConsequences: noPartnerQualificationAuthorityConsequencesV1
    };
    const parsed = parsePartnerQualificationDecisionV1({
      ...base,
      partnerQualificationFingerprintSha256: partnerQualificationFingerprintSha256V1(base)
    });
    expect(parsed.outcome).toBe('QUALIFIED');
    expect(parsed.authorityConsequences.externalMessageSent).toBe(false);
  });
});
