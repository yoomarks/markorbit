import {
  educationCommunityCohortFingerprintSha256V1,
  educationCommunityJourneyFingerprintSha256V1,
  noEducationCommunityAuthorityConsequencesV1,
  parseEducationCommunityCohortV1,
  parseEducationCommunityJourneyV1
} from '../src/education-community.js';
import { describe, expect, it } from 'vitest';

const at = '2026-09-17T00:00:00.000Z';
const workspaceId = '11111111-1111-4111-8111-111111111111';

function cohort() {
  const base = {
    schemaVersion: 1 as const,
    educationCommunityCohortId: 'education-cohort_event-1' as const,
    workspaceId,
    version: 1 as const,
    name: 'Founder trademark clinic',
    source: {
      owner: 'EVENTS',
      kind: 'LIVE_CLINIC',
      id: 'event_2026-09',
      version: 1,
      fingerprintSha256: 'a'.repeat(64),
      observedAt: at
    },
    retentionWindowDays: 7 as const,
    status: 'ACTIVE' as const,
    createdByPrincipalId: 'principal_growth',
    createdAt: at,
    authorityConsequences: noEducationCommunityAuthorityConsequencesV1
  };
  return parseEducationCommunityCohortV1({
    ...base,
    cohortFingerprintSha256: educationCommunityCohortFingerprintSha256V1(base)
  });
}

describe('Education & Community acquisition V1', () => {
  it('keeps one bounded cohort source exact without granting consent or role authority', () => {
    const value = cohort();
    expect(value.retentionWindowDays).toBe(7);
    expect(Object.values(value.authorityConsequences).every((effect) => effect === false)).toBe(
      true
    );
  });

  it('rejects raw attendee contact data and requires a distinct seven-day retained action', () => {
    const source = cohort();
    const base = {
      schemaVersion: 1 as const,
      educationCommunityJourneyId: 'education-journey_attendee-1' as const,
      cohort: {
        id: source.educationCommunityCohortId,
        version: 1 as const,
        fingerprintSha256: source.cohortFingerprintSha256
      },
      campaignWorkspaceId: workspaceId,
      version: 1,
      stage: 'REGISTERED' as const,
      participantRef: 'participant_opaque-1',
      endpointFingerprintSha256: 'b'.repeat(64),
      registeredAt: at,
      updatedByPrincipalId: 'principal_growth',
      updatedAt: at,
      authorityConsequences: noEducationCommunityAuthorityConsequencesV1
    };
    const registered = parseEducationCommunityJourneyV1({
      ...base,
      journeyFingerprintSha256: educationCommunityJourneyFingerprintSha256V1(base)
    });
    expect(registered.stage).toBe('REGISTERED');
    const raw = { ...base, participantRef: 'person@example.com' };
    expect(() =>
      parseEducationCommunityJourneyV1({
        ...raw,
        journeyFingerprintSha256: educationCommunityJourneyFingerprintSha256V1(raw)
      })
    ).toThrow('opaque');
  });
});
