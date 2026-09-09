import { describe, expect, it } from 'vitest';
import {
  assessSocialChannelBindingEligibilityV1,
  parseSocialChannelBindingV1
} from '../src/social-channel-binding.js';

const authority = {
  credentialStoredInBusinessContract: false,
  credentialAuthorityGranted: false,
  providerSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  executionStarted: false,
  externalPublicationCreated: false,
  externalMessageSent: false
} as const;

const verifiedObservation = {
  status: 'VERIFIED',
  observedAt: '2026-09-09T10:06:00Z'
} as const;

const activeBindingInput = {
  schemaVersion: 1,
  socialChannelBindingId: 'social-channel-binding_linkedin-01',
  version: 2,
  workspaceId: 'workspace_01',
  identity: {
    platformId: 'linkedin',
    externalAccountId: 'person_123',
    externalChannelId: 'page_456',
    displayLabel: 'Mark Orbit',
    handle: 'markorbit'
  },
  status: 'ACTIVE',
  connection: {
    sourceKind: 'PLATFORM_AUTH',
    capabilityRef: {
      capabilityId: 'social.channel.connect',
      capabilityVersion: '1.0.0'
    },
    implementationRef: {
      implementationProfileId: 'implementation-profile_linkedin-official-api',
      version: 1
    },
    evidenceRefs: ['evidence:social-binding:linkedin-01']
  },
  boundAt: '2026-09-09T10:00:00Z',
  lastVerifiedAt: '2026-09-09T10:05:00Z',
  updatedAt: '2026-09-09T10:05:00Z',
  authority
} as const;

describe('social channel binding', () => {
  it('accepts bounded safe identity and provenance without creating action authority', () => {
    const parsed = parseSocialChannelBindingV1(activeBindingInput);
    expect(parsed).toMatchObject({
      status: 'ACTIVE',
      workspaceId: 'workspace_01',
      identity: {
        platformId: 'linkedin',
        externalAccountId: 'person_123',
        externalChannelId: 'page_456'
      },
      authority
    });
    expect(
      assessSocialChannelBindingEligibilityV1(parsed, {
        workspaceId: 'workspace_01',
        assessedAt: '2026-09-09T10:07:00Z',
        verification: verifiedObservation
      })
    ).toMatchObject({
      eligible: true,
      reason: 'ELIGIBLE',
      verificationStatus: 'VERIFIED',
      createsExecutionAuthority: false
    });
  });

  it.each([
    ['accessToken', 'secret-access'],
    ['refresh_token', 'secret-refresh'],
    ['cookie', 'sid=secret'],
    ['password', 'secret-password'],
    ['apiKey', 'secret-key'],
    ['sessionToken', 'secret-session'],
    ['credentials', { token: 'secret' }]
  ] as const)(
    'rejects forbidden credential material at the business boundary: %s',
    (key, value) => {
      expect(() =>
        parseSocialChannelBindingV1({
          ...activeBindingInput,
          connection: { ...activeBindingInput.connection, [key]: value }
        })
      ).toThrow('forbidden credential/session material');
    }
  );

  it('rejects generic raw or metadata escape hatches', () => {
    expect(() =>
      parseSocialChannelBindingV1({
        ...activeBindingInput,
        identity: { ...activeBindingInput.identity, raw: { tokenLikeValue: 'opaque' } }
      })
    ).toThrow('unsupported fields');
    expect(() =>
      parseSocialChannelBindingV1({
        ...activeBindingInput,
        connection: { ...activeBindingInput.connection, metadata: { anything: true } }
      })
    ).toThrow('unsupported fields');
  });

  it.each([
    ['UNKNOWN', 'VERIFICATION_UNKNOWN'],
    ['UNAVAILABLE', 'VERIFICATION_UNAVAILABLE']
  ] as const)(
    'fails closed for ACTIVE bindings when current verification is %s without mutating lifecycle',
    (status, reason) => {
      const parsed = parseSocialChannelBindingV1(activeBindingInput);
      const result = assessSocialChannelBindingEligibilityV1(parsed, {
        workspaceId: 'workspace_01',
        assessedAt: '2026-09-09T10:07:00Z',
        verification: { status, observedAt: '2026-09-09T10:06:00Z' }
      });
      expect(result).toMatchObject({
        eligible: false,
        reason,
        verificationStatus: status,
        createsExecutionAuthority: false
      });
      expect(parsed.status).toBe('ACTIVE');
    }
  );

  it('rejects invalid or temporally stale verification observations', () => {
    const parsed = parseSocialChannelBindingV1(activeBindingInput);
    expect(() =>
      assessSocialChannelBindingEligibilityV1(parsed, {
        workspaceId: 'workspace_01',
        assessedAt: '2026-09-09T10:07:00Z',
        verification: { status: 'NOT_A_STATUS' as 'VERIFIED', observedAt: '2026-09-09T10:06:00Z' }
      })
    ).toThrow('verification.status is invalid');
    expect(() =>
      assessSocialChannelBindingEligibilityV1(parsed, {
        workspaceId: 'workspace_01',
        assessedAt: '2026-09-09T10:07:00Z',
        verification: { status: 'VERIFIED', observedAt: '2026-09-09T10:04:00Z' }
      })
    ).toThrow('lastVerifiedAt cannot be after verification.observedAt');
  });

  it('fails closed when the binding becomes stale', () => {
    const stale = parseSocialChannelBindingV1({
      ...activeBindingInput,
      version: 3,
      status: 'STALE',
      staleAt: '2026-09-09T10:10:00Z',
      updatedAt: '2026-09-09T10:10:00Z'
    });
    expect(
      assessSocialChannelBindingEligibilityV1(stale, {
        workspaceId: 'workspace_01',
        assessedAt: '2026-09-09T10:11:00Z',
        verification: { ...verifiedObservation, observedAt: '2026-09-09T10:10:30Z' }
      })
    ).toMatchObject({ eligible: false, reason: 'BINDING_STALE' });
  });

  it('fails closed when the binding is revoked', () => {
    const revoked = parseSocialChannelBindingV1({
      ...activeBindingInput,
      version: 4,
      status: 'REVOKED',
      staleAt: '2026-09-09T10:10:00Z',
      revokedAt: '2026-09-09T10:20:00Z',
      updatedAt: '2026-09-09T10:20:00Z'
    });
    expect(
      assessSocialChannelBindingEligibilityV1(revoked, {
        workspaceId: 'workspace_01',
        assessedAt: '2026-09-09T10:21:00Z',
        verification: { ...verifiedObservation, observedAt: '2026-09-09T10:20:30Z' }
      })
    ).toMatchObject({ eligible: false, reason: 'BINDING_REVOKED' });
  });

  it('enforces lifecycle timestamp invariants', () => {
    expect(() => parseSocialChannelBindingV1({ ...activeBindingInput, status: 'STALE' })).toThrow(
      'STALE binding requires staleAt'
    );
    expect(() =>
      parseSocialChannelBindingV1({
        ...activeBindingInput,
        status: 'REVOKED',
        revokedAt: '2026-09-09T10:04:00Z'
      })
    ).toThrow('lastVerifiedAt cannot be after revokedAt');
    expect(() =>
      parseSocialChannelBindingV1({
        ...activeBindingInput,
        staleAt: '2026-09-09T10:10:00Z',
        updatedAt: '2026-09-09T10:10:00Z'
      })
    ).toThrow('ACTIVE binding cannot carry staleAt or revokedAt');
  });

  it('does not let binding metadata grant provider, credential, publish, or execution authority', () => {
    expect(() =>
      parseSocialChannelBindingV1({
        ...activeBindingInput,
        authority: { ...authority, protectedActionAuthorized: true }
      })
    ).toThrow('authority.protectedActionAuthorized must be false');
    expect(() =>
      parseSocialChannelBindingV1({
        ...activeBindingInput,
        authority: { ...authority, providerSelectionAuthorityGranted: true }
      })
    ).toThrow('authority.providerSelectionAuthorityGranted must be false');
  });

  it('keeps workspace identity authoritative outside Social', () => {
    const parsed = parseSocialChannelBindingV1(activeBindingInput);
    expect(
      assessSocialChannelBindingEligibilityV1(parsed, {
        workspaceId: 'workspace_other',
        assessedAt: '2026-09-09T10:07:00Z',
        verification: verifiedObservation
      })
    ).toMatchObject({ eligible: false, reason: 'WORKSPACE_MISMATCH' });
  });
});
