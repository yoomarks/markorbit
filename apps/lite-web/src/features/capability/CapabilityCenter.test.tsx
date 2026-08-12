// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

const workspaceId = '37373737-3737-4373-8373-373737373737';
const candidate: ReflectionCandidate = {
  schemaVersion: 1,
  reflectionCandidateId: 'reflection-candidate_22222222222222222222222222222222',
  workspaceId,
  subjectUserId: 'user_capability_test',
  version: 3,
  runtimeCapability: { id: 'runtime-capability_test', version: 1 },
  ledgerEntries: [{ id: 'capability-ledger_22222222222222222222222222222222', sourceFingerprintSha256: 'a'.repeat(64) }],
  explanation: 'Private evidence-backed reflection candidate.',
  proposedPrivateReflection: 'I reviewed governed evidence for this private Capability line.',
  generation: { policyVersion: 'test-policy-v1' },
  status: 'PENDING',
  private: true,
  createdAt: '2026-08-12T02:00:00.000Z',
  authority: capabilityLearningNoAuthorityConsequences
};
const ready: CapabilityCenterView = {
  schemaVersion: 1,
  workspaceId,
  subjectUserId: candidate.subjectUserId,
  ledgerEntries: [],
  profiles: [
    {
      schemaVersion: 1,
      capabilityProfileProjectionId: 'capability-profile_test',
      workspaceId,
      subjectUserId: candidate.subjectUserId,
      version: 1,
      runtimeCapability: candidate.runtimeCapability,
      evidenceCount: 1,
      acceptedReflections: [],
      outstandingReflectionCandidate: { id: candidate.reflectionCandidateId, version: candidate.version },
      visibility: 'PRIVATE',
      numericProfessionalScore: null,
      verifiedBadge: false,
      generatedAt: '2026-08-12T02:00:00.000Z',
      authority: capabilityLearningNoAuthorityConsequences
    }
  ],
  twin: null,
  pendingCandidates: [{ candidate, candidateFingerprintSha256: 'b'.repeat(64) }],
  visibility: 'PRIVATE',
  generatedAt: '2026-08-12T02:00:00.000Z',
  authority: capabilityLearningNoAuthorityConsequences
};

describe('Lite Capability Center', () => {
  it('renders private authority semantics and dispositions the exact candidate', async () => {
    const load = vi.fn(async () => ready);
    const disposition = vi.fn(async () => ({}));
    const client: CapabilityCenterClient = { load, disposition };
    render(<CapabilityCenter workspaceId={workspaceId} client={client} />);

    expect(await screen.findByRole('heading', { name: 'Capability Center' })).toBeTruthy();
    expect(screen.getByText(/does not create certification, ranking, canonical truth/)).toBeTruthy();
    expect(screen.getByText(candidate.proposedPrivateReflection)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Accept private reflection' }));
    await waitFor(() => expect(disposition).toHaveBeenCalledTimes(1));
    expect(disposition).toHaveBeenCalledWith({
      reflectionCandidateId: candidate.reflectionCandidateId,
      candidateVersion: 3,
      expectedCandidateFingerprintSha256: 'b'.repeat(64),
      outcome: 'ACCEPTED'
    });
    await waitFor(() => expect(load.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('renders permission failure without pretending private state is empty', async () => {
    const client: CapabilityCenterClient = {
      load: async () => Promise.reject(new CapabilityCenterHttpError(403, 'PERMISSION_DENIED', 'Denied.')),
      disposition: async () => ({})
    };
    render(<CapabilityCenter workspaceId={workspaceId} client={client} />);
    expect(await screen.findByText('Capability Center permission required')).toBeTruthy();
    expect(screen.queryByText('No private Capability evidence yet')).toBeNull();
  });
});
