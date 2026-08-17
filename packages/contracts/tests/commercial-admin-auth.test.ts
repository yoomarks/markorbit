import { describe, expect, it } from 'vitest';
import {
  commercialAdminCapabilitiesForAccount,
  encodeInternalOperatorPrincipal,
  parseInternalOperatorPrincipal,
  type CommercialAdminAccountView,
  type InternalOperatorPrincipal
} from '../src/auth.js';

const account = (accountType: CommercialAdminAccountView['accountType'], status: 'ACTIVE' | 'DISABLED') => ({
  accountType,
  status
});

describe('commercial admin authority contract', () => {
  it('grants commercial admin capability only to ACTIVE INTERNAL accounts', () => {
    expect(commercialAdminCapabilitiesForAccount(account('INTERNAL', 'ACTIVE'))).toEqual([
      'commercial-admin:read',
      'commercial-admin:operate'
    ]);
    expect(commercialAdminCapabilitiesForAccount(account('CUSTOMER', 'ACTIVE'))).toEqual([]);
    expect(commercialAdminCapabilitiesForAccount(account('PROFESSIONAL', 'ACTIVE'))).toEqual([]);
    expect(commercialAdminCapabilitiesForAccount(account('PROVIDER', 'ACTIVE'))).toEqual([]);
    expect(commercialAdminCapabilitiesForAccount(account('INTERNAL', 'DISABLED'))).toEqual([]);
  });

  it('round-trips only the explicit INTERNAL_OPERATOR envelope', () => {
    const principal: InternalOperatorPrincipal = {
      kind: 'INTERNAL_OPERATOR',
      sessionId: 'session_internal_1',
      userId: 'user_internal_1',
      capabilities: ['commercial-admin:read'],
      sessionExpiresAt: '2099-01-01T00:00:00.000Z'
    };
    expect(parseInternalOperatorPrincipal(encodeInternalOperatorPrincipal(principal))).toEqual(principal);
  });

  it('rejects browser-invented or unknown commercial admin capabilities', () => {
    const value = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        principal: {
          kind: 'INTERNAL_OPERATOR',
          sessionId: 'session_internal_1',
          userId: 'user_internal_1',
          capabilities: ['order:update'],
          sessionExpiresAt: '2099-01-01T00:00:00.000Z'
        }
      }),
      'utf8'
    ).toString('base64url');
    expect(() => parseInternalOperatorPrincipal(value)).toThrow('Internal operator Principal is invalid.');
  });
});
