import { describe, expect, it } from 'vitest';
import {
  INTERNAL_OPERATOR_CAPABILITIES,
  commercialAdminCapabilitiesForAccount,
  encodeInternalOperatorPrincipal,
  parseInternalOperatorPrincipal,
  type CommercialAdminAccountView,
  type InternalOperatorPrincipal
} from '../src/auth.js';

const account = (
  accountType: CommercialAdminAccountView['accountType'],
  status: 'ACTIVE' | 'DISABLED'
) => ({
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

  it('round-trips the existing commercial INTERNAL_OPERATOR envelope unchanged', () => {
    const principal: InternalOperatorPrincipal = {
      kind: 'INTERNAL_OPERATOR',
      sessionId: 'session_internal_1',
      userId: 'user_internal_1',
      capabilities: ['commercial-admin:read'],
      sessionExpiresAt: '2099-01-01T00:00:00.000Z'
    };
    expect(parseInternalOperatorPrincipal(encodeInternalOperatorPrincipal(principal))).toEqual(
      principal
    );
  });

  it('round-trips bounded cognitive read without implying commercial authority', () => {
    const principal: InternalOperatorPrincipal = {
      kind: 'INTERNAL_OPERATOR',
      sessionId: 'session_cognitive_1',
      userId: 'user_cognitive_1',
      capabilities: ['control-plane:cognitive:read'],
      sessionExpiresAt: '2099-01-01T00:00:00.000Z'
    };
    const parsed = parseInternalOperatorPrincipal(encodeInternalOperatorPrincipal(principal));
    expect(parsed).toEqual(principal);
    expect(parsed.capabilities).not.toContain('commercial-admin:read');
    expect(parsed.capabilities).not.toContain('commercial-admin:operate');
  });

  it('round-trips bounded Data read without implying cognitive or commercial authority', () => {
    const principal: InternalOperatorPrincipal = {
      kind: 'INTERNAL_OPERATOR',
      sessionId: 'session_data_1',
      userId: 'user_data_1',
      capabilities: ['control-plane:data:read'],
      sessionExpiresAt: '2099-01-01T00:00:00.000Z'
    };
    const parsed = parseInternalOperatorPrincipal(encodeInternalOperatorPrincipal(principal));
    expect(parsed).toEqual(principal);
    expect(parsed.capabilities).not.toContain('control-plane:cognitive:read');
    expect(parsed.capabilities).not.toContain('commercial-admin:read');
    expect(parsed.capabilities).not.toContain('commercial-admin:operate');
  });

  it('keeps commercial account derivation from automatically granting Control Plane reads', () => {
    const capabilities = commercialAdminCapabilitiesForAccount(account('INTERNAL', 'ACTIVE'));
    expect(capabilities).not.toContain('control-plane:cognitive:read');
    expect(capabilities).not.toContain('control-plane:data:read');
  });

  it('defines Control Plane operator authority as bounded read-only vocabulary', () => {
    expect(INTERNAL_OPERATOR_CAPABILITIES).toContain('control-plane:cognitive:read');
    expect(INTERNAL_OPERATOR_CAPABILITIES).toContain('control-plane:data:read');
    expect(
      INTERNAL_OPERATOR_CAPABILITIES.filter((capability) =>
        capability.startsWith('control-plane:cognitive:')
      )
    ).toEqual(['control-plane:cognitive:read']);
    expect(
      INTERNAL_OPERATOR_CAPABILITIES.filter((capability) => capability.startsWith('control-plane:data:'))
    ).toEqual(['control-plane:data:read']);
  });

  it.each(['control-plane:cognitive:operate', 'control-plane:data:operate', 'control-plane:data:write'])(
    'rejects browser-invented or unknown internal operator capability %s',
    (capability) => {
      const value = Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          principal: {
            kind: 'INTERNAL_OPERATOR',
            sessionId: 'session_internal_1',
            userId: 'user_internal_1',
            capabilities: [capability],
            sessionExpiresAt: '2099-01-01T00:00:00.000Z'
          }
        }),
        'utf8'
      ).toString('base64url');
      expect(() => parseInternalOperatorPrincipal(value)).toThrow(
        'Internal operator Principal is invalid.'
      );
    }
  );
});
