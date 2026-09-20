import { describe, expect, it } from 'vitest';
import {
  noExternalCredentialAuthorityConsequencesV1,
  parseExternalCredentialBindingV1,
  parseExternalCredentialCurrentnessV1,
  parseExternalCredentialRefV1
} from '../src/external-credential.js';

const binding = {
  schemaVersion: 1,
  credentialBindingId: 'external-credential-binding_test-1',
  version: 1,
  workspaceId: '018f0000-0000-7000-8000-000000001384',
  provider: 'TWILIO',
  externalAccountRef: 'account-1384',
  secretKind: 'BASIC',
  allowedCapabilityIds: ['channel.sms.send'],
  grantor: {
    userId: '018f0000-0000-7000-8000-000000001385',
    membershipId: '018f0000-0000-7000-8000-000000001386',
    membershipVersion: 3
  },
  lifecycle: 'ACTIVE',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  authority: noExternalCredentialAuthorityConsequencesV1
} as const;

describe('External credential safe contracts', () => {
  it('parses one exact safe ref and binding with no authority', () => {
    const ref = {
      owner: 'CORE_IDENTITY',
      credentialBindingId: binding.credentialBindingId,
      version: 1
    };
    expect(parseExternalCredentialRefV1(ref)).toEqual(ref);
    expect(parseExternalCredentialBindingV1(binding)).toEqual(binding);
  });

  it.each(['apiKey', 'secret', 'token', 'username', 'password', 'authorization', 'ciphertext'])(
    'rejects nested %s material from safe contracts',
    (field) =>
      expect(() =>
        parseExternalCredentialBindingV1({ ...binding, metadata: { [field]: 'not-real' } })
      ).toThrow(/forbidden secret material/u)
  );

  it('enforces lifecycle timestamps', () => {
    expect(() => parseExternalCredentialBindingV1({ ...binding, lifecycle: 'REVOKED' })).toThrow(
      /revokedAt/u
    );
    expect(() =>
      parseExternalCredentialBindingV1({ ...binding, revokedAt: binding.updatedAt })
    ).toThrow(/REVOKED lifecycle/u);
  });

  it('parses safe currentness with authority flags fixed false', () => {
    expect(
      parseExternalCredentialCurrentnessV1({
        schemaVersion: 1,
        credential: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: binding.credentialBindingId,
          version: 1
        },
        state: 'CURRENT',
        checkedAt: binding.updatedAt,
        exposesSecretMaterial: false,
        createsExecutionAuthority: false
      }).state
    ).toBe('CURRENT');
  });
});
