import { describe, expect, it } from 'vitest';
import {
  evaluateWorkspaceEmailSenderCurrentnessV1,
  noWorkspaceEmailSenderProfileAuthorityConsequencesV1,
  parseWorkspaceEmailSenderProfileV1,
  type WorkspaceEmailSenderProfileV1
} from '../src/email-sender-profile.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';

function profile(
  overrides: Partial<WorkspaceEmailSenderProfileV1> = {}
): WorkspaceEmailSenderProfileV1 {
  return {
    schemaVersion: 1,
    senderProfileId: 'email-sender-profile_primary',
    workspaceId,
    version: 1,
    status: 'ACTIVE',
    fromDomain: 'mail.example.com',
    fromAddress: 'hello@mail.example.com',
    displayName: 'Example Brand',
    replyTo: { mode: 'SAME_AS_FROM' },
    verification: {
      status: 'VERIFIED',
      evidenceRefs: ['dns-verification:primary'],
      observedAt: '2026-09-18T12:00:00.000Z'
    },
    providerRoutingPartitionRef: 'routing-partition:workspace-primary',
    ratePolicyRef: 'rate-policy:email-campaign-default',
    reputationIsolationKey: 'workspace-reputation:primary',
    createdAt: '2026-09-18T12:00:00.000Z',
    updatedAt: '2026-09-18T12:00:00.000Z',
    authority: noWorkspaceEmailSenderProfileAuthorityConsequencesV1,
    ...overrides
  };
}

describe('workspace email sender profile contract', () => {
  it('parses an active verified Workspace sender identity without send authority', () => {
    const value = parseWorkspaceEmailSenderProfileV1(profile());
    expect(value).toMatchObject({
      senderProfileId: 'email-sender-profile_primary',
      status: 'ACTIVE',
      fromDomain: 'mail.example.com',
      fromAddress: 'hello@mail.example.com'
    });
    expect(Object.values(value.authority).every((entry) => entry === false)).toBe(true);
  });

  it('requires the From address to belong to the declared sender domain', () => {
    expect(() =>
      parseWorkspaceEmailSenderProfileV1(profile({ fromAddress: 'hello@other.example.com' }))
    ).toThrow('fromAddress domain must equal fromDomain');
  });

  it('requires ACTIVE profiles to carry verified evidence', () => {
    expect(() =>
      parseWorkspaceEmailSenderProfileV1(
        profile({
          verification: {
            status: 'PENDING',
            evidenceRefs: [],
            observedAt: '2026-09-18T12:00:00.000Z'
          }
        })
      )
    ).toThrow('ACTIVE sender profile requires VERIFIED evidence');
  });

  it('rejects secret/provider credential escape hatches', () => {
    expect(() =>
      parseWorkspaceEmailSenderProfileV1({
        ...profile(),
        apiKey: 'should-never-be-canonical'
      })
    ).toThrow('forbidden secret material');
  });

  it('enforces reply-to mode shapes', () => {
    expect(
      parseWorkspaceEmailSenderProfileV1(
        profile({ replyTo: { mode: 'EXPLICIT_ADDRESS', address: 'reply@example.com' } })
      ).replyTo
    ).toEqual({ mode: 'EXPLICIT_ADDRESS', address: 'reply@example.com' });

    expect(() =>
      parseWorkspaceEmailSenderProfileV1(
        profile({
          replyTo: {
            mode: 'MANAGED_COMMUNICATION',
            accountRef: 'mailbox_primary',
            address: 'reply@example.com'
          }
        })
      )
    ).toThrow('MANAGED_COMMUNICATION replyTo cannot carry address');
  });

  it('returns CURRENT_ELIGIBLE only for fresh active verified evidence', () => {
    expect(
      evaluateWorkspaceEmailSenderCurrentnessV1(
        profile(),
        '2026-09-18T12:30:00.000Z',
        60 * 60 * 1000
      )
    ).toMatchObject({
      state: 'CURRENT_ELIGIBLE',
      createsSendAuthority: false
    });
  });

  it('fails currentness closed when verification evidence is stale', () => {
    expect(
      evaluateWorkspaceEmailSenderCurrentnessV1(
        profile(),
        '2026-09-18T14:00:00.000Z',
        60 * 60 * 1000
      )
    ).toMatchObject({ state: 'STALE' });
  });

  it('preserves suspended/revoked lifecycle ahead of verification evidence', () => {
    const suspended = profile({ status: 'SUSPENDED' });
    const revoked = profile({ status: 'REVOKED' });
    expect(
      evaluateWorkspaceEmailSenderCurrentnessV1(
        suspended,
        '2026-09-18T12:30:00.000Z',
        60 * 60 * 1000
      ).state
    ).toBe('SUSPENDED');
    expect(
      evaluateWorkspaceEmailSenderCurrentnessV1(
        revoked,
        '2026-09-18T12:30:00.000Z',
        60 * 60 * 1000
      ).state
    ).toBe('REVOKED');
  });

  it('does not turn UNKNOWN/UNAVAILABLE evidence into eligibility', () => {
    for (const status of ['UNKNOWN', 'UNAVAILABLE'] as const) {
      const pending = profile({
        status: 'PENDING_VERIFICATION',
        verification: {
          status,
          evidenceRefs: [],
          observedAt: '2026-09-18T12:00:00.000Z'
        }
      });
      expect(
        evaluateWorkspaceEmailSenderCurrentnessV1(
          pending,
          '2026-09-18T12:30:00.000Z',
          60 * 60 * 1000
        ).state
      ).toBe('PENDING_VERIFICATION');
    }
  });
});
