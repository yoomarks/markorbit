import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalSmsEndpointV1,
  smsEndpointFingerprintSha256V1,
  WorkspaceDirectorySmsEndpointResolverV1
} from '../src/sms-endpoint-currentness.js';

const target = {
  owner: 'LITE',
  kind: 'WORKSPACE_DIRECTORY_ENTRY',
  id: 'workspace-directory-entry_contact1',
  version: 2
} as const;

const entry = (value: string, version = 2, status = 'ACTIVE') => ({
  version,
  status,
  contactPoints: [
    {
      kind: 'PHONE' as const,
      value,
      provenance: {
        sourceKind: 'WORKSPACE_USER' as const,
        sourceRef: 'fixture',
        observedAt: '2026-09-20T00:00:00.000Z'
      }
    }
  ]
});

describe('Workspace Directory SMS endpoint currentness', () => {
  it('accepts only canonical E.164 and domain-separates its fingerprint', async () => {
    expect(canonicalSmsEndpointV1('+14155550123')).toBe('+14155550123');
    expect(canonicalSmsEndpointV1('4155550123')).toBeUndefined();
    expect(canonicalSmsEndpointV1('+0123456789')).toBeUndefined();
    const resolver = new WorkspaceDirectorySmsEndpointResolverV1({
      getExact: async () => entry('+14155550123'),
      getLatest: async () => entry('+14155550123')
    });
    const result = await resolver.resolve('11111111-1111-4111-8111-111111111111', target);
    expect(result).toEqual({
      state: 'CURRENT',
      endpoint: '+14155550123',
      endpointFingerprintSha256: smsEndpointFingerprintSha256V1('+14155550123')
    });
    expect(result.endpointFingerprintSha256).not.toBe(
      createHash('sha256').update('+14155550123').digest('hex')
    );
  });

  it('fails closed for stale, missing, multiple and invalid PHONE evidence', async () => {
    const base = entry('+14155550123');
    const cases = [
      { exact: base, latest: entry('+14155550123', 3), state: 'STALE' },
      { exact: { ...base, contactPoints: [] }, latest: base, state: 'NOT_FOUND' },
      {
        exact: { ...base, contactPoints: [...base.contactPoints, ...base.contactPoints] },
        latest: base,
        state: 'UNKNOWN'
      },
      { exact: entry('415-555-0123'), latest: base, state: 'UNKNOWN' }
    ] as const;
    for (const item of cases) {
      const resolver = new WorkspaceDirectorySmsEndpointResolverV1({
        getExact: async () => item.exact,
        getLatest: async () => item.latest
      });
      await expect(
        resolver.resolve('11111111-1111-4111-8111-111111111111', target)
      ).resolves.toMatchObject({ state: item.state });
    }
  });

  it('returns UNAVAILABLE for owner outage and never reads non-Directory targets', async () => {
    const base = entry('+14155550123');
    const unavailable = new WorkspaceDirectorySmsEndpointResolverV1({
      getExact: async () => {
        throw Object.assign(new Error('db'), { code: 'PERSISTENCE_UNAVAILABLE' });
      },
      getLatest: async () => base
    });
    await expect(
      unavailable.resolve('11111111-1111-4111-8111-111111111111', target)
    ).resolves.toEqual({ state: 'UNAVAILABLE' });

    let reads = 0;
    const guarded = new WorkspaceDirectorySmsEndpointResolverV1({
      getExact: async () => {
        reads += 1;
        return base;
      },
      getLatest: async () => {
        reads += 1;
        return base;
      }
    });
    await expect(
      guarded.resolve('11111111-1111-4111-8111-111111111111', {
        ...target,
        owner: 'MARKREG'
      })
    ).resolves.toEqual({ state: 'UNKNOWN' });
    expect(reads).toBe(0);
  });
});
