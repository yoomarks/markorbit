import {
  encodeInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it } from 'vitest';
import {
  createCoreAdminRoutesV1,
  type CoreAdministrationProjectionV1
} from '../src/core-admin-http.js';

const secret = 'core-admin-secret';
const principal: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session-core-admin',
  userId: '018f0000-0000-7000-8000-000000001012',
  capabilities: ['core-admin:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};

function request(headers: Record<string, string> = {}): JsonRequest {
  return {
    method: 'GET',
    path: '/internal/super-admin/core',
    params: {},
    query: {},
    body: undefined,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-internal-principal': encodeInternalOperatorPrincipal(principal),
      ...headers
    }
  };
}

function route() {
  const found = createCoreAdminRoutesV1({
    internalServiceSecret: secret,
    now: () => new Date('2026-09-08T09:00:00.000Z')
  })[0];
  if (!found) throw new Error('Missing Core Admin route.');
  return found;
}

describe('Core owner administration read', () => {
  it('returns an explicit owner limitation instead of synthesizing a portfolio', async () => {
    const result = await route().handle(request());
    expect(result.status).toBe(200);
    const body = result.body as CoreAdministrationProjectionV1;
    expect(body).toEqual({
      schemaVersion: 1,
      objectType: 'CORE_ADMINISTRATION_PROJECTION',
      owner: 'CORE',
      access: 'READ_ONLY',
      requiredAuthority: 'core-admin:read',
      observedAt: '2026-09-08T09:00:00.000Z',
      portfolio: { availability: 'NOT_YET_MODELED', reason: body.portfolio.reason }
    });
    expect(body.portfolio.reason).toContain('canonical durable platform administration portfolio');
  });

  it('rejects missing service authority and non-Core operator authority', () => {
    expect(() =>
      route().handle(request({ 'x-markorbit-internal-authorization': '' }))
    ).toThrowError('Internal service identity is invalid.');
    const wrong: InternalOperatorPrincipal = {
      ...principal,
      capabilities: ['workspace-admin:read']
    };
    expect(() =>
      route().handle(
        request({
          'x-markorbit-internal-principal': encodeInternalOperatorPrincipal(wrong)
        })
      )
    ).toThrowError('Exact core-admin:read authority is required.');
  });
});
