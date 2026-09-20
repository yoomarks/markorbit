import { describe, expect, it } from 'vitest';
import { ChannelIdentityProvenanceCurrentnessServiceV1 } from '../src/channel-identity-provenance-currentness.js';

const request = {
  capabilityId: 'capability_whatsapp',
  capabilityVersion: '1.0.0',
  implementationProfileId: 'implementation-profile_whatsapp',
  implementationProfileVersion: 2
};
const capability = {
  capabilityId: request.capabilityId,
  capabilityVersion: request.capabilityVersion
};
const implementation = {
  implementationProfileId: request.implementationProfileId,
  version: request.implementationProfileVersion,
  status: 'APPROVED',
  capabilityId: request.capabilityId,
  capabilityVersion: request.capabilityVersion
};

function service(
  capabilityValue: unknown = capability,
  implementationValue: unknown = implementation
) {
  return new ChannelIdentityProvenanceCurrentnessServiceV1(
    { findCurrent: () => Promise.resolve(capabilityValue as never) },
    { findCurrent: () => Promise.resolve(implementationValue as never) },
    () => '2026-09-20T10:00:00.000Z'
  );
}

describe('Channel identity Capability provenance currentness', () => {
  it('accepts only the exact approved current Capability and Implementation Profile', async () => {
    await expect(service().assess(request)).resolves.toEqual({
      schemaVersion: 1,
      state: 'CURRENT',
      checkedAt: '2026-09-20T10:00:00.000Z',
      createsImplementationSelectionAuthority: false,
      createsExecutionAuthority: false
    });
  });

  it.each([
    [null, implementation],
    [capability, null]
  ])(
    'returns UNKNOWN when an owner record is absent',
    async (capabilityValue, implementationValue) => {
      await expect(
        service(capabilityValue, implementationValue).assess(request)
      ).resolves.toMatchObject({ state: 'UNKNOWN' });
    }
  );

  it.each([
    [{ ...capability, capabilityVersion: '2.0.0' }, implementation],
    [capability, { ...implementation, version: 3 }],
    [capability, { ...implementation, status: 'RETIRED' }],
    [capability, { ...implementation, capabilityId: 'capability_other' }]
  ])(
    'returns STALE for exact-version or lineage mismatch',
    async (capabilityValue, implementationValue) => {
      await expect(
        service(capabilityValue, implementationValue).assess(request)
      ).resolves.toMatchObject({ state: 'STALE' });
    }
  );

  it('returns UNAVAILABLE when an owner cannot be read', async () => {
    const value = new ChannelIdentityProvenanceCurrentnessServiceV1(
      { findCurrent: () => Promise.reject(new Error('down')) },
      { findCurrent: () => Promise.resolve(implementation as never) }
    );
    await expect(value.assess(request)).resolves.toMatchObject({ state: 'UNAVAILABLE' });
  });
});
