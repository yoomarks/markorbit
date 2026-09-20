import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';

export type ChannelIdentityProvenanceCurrentnessStateV1 =
  'CURRENT' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE';

export interface ChannelIdentityProvenanceCurrentnessRequestV1 {
  capabilityId: string;
  capabilityVersion: string;
  implementationProfileId: string;
  implementationProfileVersion: number;
}

export interface ChannelIdentityProvenanceCurrentnessV1 {
  schemaVersion: 1;
  state: ChannelIdentityProvenanceCurrentnessStateV1;
  checkedAt: string;
  createsImplementationSelectionAuthority: false;
  createsExecutionAuthority: false;
}

interface CapabilityReaderV1 {
  findCurrent(capabilityId: string): Promise<Readonly<RuntimeCapabilityDefinition> | undefined>;
}

interface ImplementationReaderV1 {
  findCurrent(
    implementationProfileId: string
  ): Promise<Readonly<ImplementationProfile> | undefined>;
}

export class ChannelIdentityProvenanceCurrentnessServiceV1 {
  constructor(
    private readonly capabilities: CapabilityReaderV1,
    private readonly implementations: ImplementationReaderV1,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async assess(
    request: Readonly<ChannelIdentityProvenanceCurrentnessRequestV1>
  ): Promise<Readonly<ChannelIdentityProvenanceCurrentnessV1>> {
    const result = (
      state: ChannelIdentityProvenanceCurrentnessStateV1
    ): ChannelIdentityProvenanceCurrentnessV1 => ({
      schemaVersion: 1,
      state,
      checkedAt: this.now(),
      createsImplementationSelectionAuthority: false,
      createsExecutionAuthority: false
    });
    let capability: Readonly<RuntimeCapabilityDefinition> | undefined;
    let implementation: Readonly<ImplementationProfile> | undefined;
    try {
      [capability, implementation] = await Promise.all([
        this.capabilities.findCurrent(request.capabilityId),
        this.implementations.findCurrent(request.implementationProfileId)
      ]);
    } catch {
      return result('UNAVAILABLE');
    }
    if (!capability || !implementation) return result('UNKNOWN');
    if (
      capability.capabilityId !== request.capabilityId ||
      capability.capabilityVersion !== request.capabilityVersion ||
      implementation.implementationProfileId !== request.implementationProfileId ||
      implementation.version !== request.implementationProfileVersion ||
      implementation.status !== 'APPROVED' ||
      implementation.capabilityId !== request.capabilityId ||
      implementation.capabilityVersion !== request.capabilityVersion
    )
      return result('STALE');
    return result('CURRENT');
  }
}
