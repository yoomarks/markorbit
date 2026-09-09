import { describe, expect, it } from 'vitest';
import { assessMediaRightsEligibilityV1, parseMediaRightsBindingV1 } from '../src/media-rights.js';

const bindingInput = {
  schemaVersion: 1,
  mediaRightsBindingId: 'media-rights-binding_01',
  version: 3,
  workspaceId: 'workspace_01',
  subject: { subjectRef: 'subject:01:v1', kind: 'HUMAN', responsiblePartyRef: 'identity:01:v1' },
  consentGrant: {
    owner: 'GOVERNANCE',
    consentGrantId: 'consent:01',
    version: 2,
    fingerprintSha256: 'a'.repeat(64)
  },
  status: 'ACTIVE',
  commercialUse: { purposes: ['MARKETING'], territories: ['CN', 'US'] },
  validFrom: '2026-01-01T00:00:00Z',
  expiresAt: '2027-01-01T00:00:00Z',
  sourceEvidenceRefs: ['evidence:consent:01'],
  identityDisclosure: { required: false },
  updatedAt: '2026-09-09T00:00:00Z'
} as const;

describe('media rights binding', () => {
  it('maps current eligible use without creating execution authority', () => {
    const result = assessMediaRightsEligibilityV1(parseMediaRightsBindingV1(bindingInput), {
      workspaceId: 'workspace_01',
      purpose: 'MARKETING',
      territory: 'CN',
      requestedAt: '2026-09-09T01:00:00Z'
    });
    expect(result).toMatchObject({
      eligible: true,
      reason: 'ELIGIBLE',
      createsExecutionAuthority: false
    });
  });
  it.each([
    [
      { ...bindingInput, status: 'REVOKED', revokedAt: '2026-09-08T00:00:00Z' },
      'CONSENT_NOT_ACTIVE'
    ],
    [bindingInput, 'PURPOSE_NOT_ALLOWED']
  ] as const)('fails closed for revoked or out-of-scope future use', (input, reason) => {
    const request = {
      workspaceId: 'workspace_01',
      purpose: reason === 'PURPOSE_NOT_ALLOWED' ? 'TRAINING' : 'MARKETING',
      territory: 'CN',
      requestedAt: '2026-09-09T01:00:00Z'
    };
    expect(assessMediaRightsEligibilityV1(parseMediaRightsBindingV1(input), request)).toMatchObject(
      { eligible: false, reason }
    );
  });
  it('requires a responsible disclosure policy for virtual identity', () => {
    expect(() =>
      parseMediaRightsBindingV1({
        ...bindingInput,
        subject: { ...bindingInput.subject, kind: 'VIRTUAL_CHARACTER' },
        identityDisclosure: { required: false }
      })
    ).toThrow('Virtual character requires an identity disclosure policy');
  });
  it('rejects contradictory active/revoked state', () => {
    expect(() =>
      parseMediaRightsBindingV1({ ...bindingInput, revokedAt: '2026-09-08T00:00:00Z' })
    ).toThrow('ACTIVE binding cannot carry revokedAt');
  });
});
