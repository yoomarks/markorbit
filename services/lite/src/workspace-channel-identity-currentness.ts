import {
  assessWorkspaceChannelIdentityBindingEligibilityV1,
  parseWorkspaceChannelIdentityCurrentnessV1,
  type WorkspaceChannelIdentityBindingId,
  type WorkspaceChannelIdentityBindingV1,
  type WorkspaceChannelIdentityCurrentnessReasonV1,
  type WorkspaceChannelIdentityCurrentnessStateV1,
  type WorkspaceChannelIdentityCurrentnessV1,
  type WorkspaceChannelIdentityVerificationObservationV1
} from '@markorbit/contracts/channel-identity-binding';
import {
  assessChannelEntitlementV1,
  channelFeatureDefinitionV1,
  type ChannelEntitlementAccessV1,
  type ChannelFeatureKeyV1
} from '@markorbit/contracts/channel-platform';

export interface WorkspaceChannelIdentityCurrentnessRequestV1 {
  workspaceId: string;
  featureKey: ChannelFeatureKeyV1;
  binding: Readonly<{
    id: WorkspaceChannelIdentityBindingId;
    version: number;
    fingerprintSha256: string;
  }>;
  oauthRequirements?: Readonly<{
    expectedProvider: string;
    requiredScopes: readonly string[];
  }>;
}

export interface WorkspaceChannelIdentityBindingReaderV1 {
  getExact(
    workspaceId: string,
    bindingId: WorkspaceChannelIdentityBindingId,
    version: number
  ): Promise<Readonly<WorkspaceChannelIdentityBindingV1> | undefined>;
  getLatest(
    workspaceId: string,
    bindingId: WorkspaceChannelIdentityBindingId
  ): Promise<Readonly<WorkspaceChannelIdentityBindingV1> | undefined>;
}

export interface ChannelIdentityEntitlementReaderV1 {
  resolve(
    workspaceId: string,
    featureKey: ChannelFeatureKeyV1,
    asOf: string
  ): Promise<Readonly<ChannelEntitlementAccessV1> | undefined>;
}

export interface WorkspaceChannelIdentityVerificationAuthorityV1 {
  verify(
    binding: Readonly<WorkspaceChannelIdentityBindingV1>
  ): Promise<Readonly<WorkspaceChannelIdentityVerificationObservationV1>>;
}

export interface OAuthCredentialCurrentnessReaderV1 {
  assess(input: {
    credential: NonNullable<WorkspaceChannelIdentityBindingV1['connection']['oauthCredentialRef']>;
    expectedWorkspaceId: string;
    expectedProvider: string;
    expectedExternalAccountRef: string;
    requiredScopes: readonly string[];
  }): Promise<
    Readonly<{
      state: 'CURRENT' | 'EXPIRED' | 'REAUTH_REQUIRED' | 'REVOKED' | 'UNKNOWN' | 'UNAVAILABLE';
    }>
  >;
}

export interface ChannelIdentityProvenanceCurrentnessReaderV1 {
  assess(input: {
    capabilityId: string;
    capabilityVersion: string;
    implementationProfileId: string;
    implementationProfileVersion: number;
  }): Promise<Readonly<{ state: 'CURRENT' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE' }>>;
}

export class WorkspaceChannelIdentityCurrentnessResolverV1 {
  constructor(
    private readonly bindings: WorkspaceChannelIdentityBindingReaderV1,
    private readonly entitlements: ChannelIdentityEntitlementReaderV1,
    private readonly verification: WorkspaceChannelIdentityVerificationAuthorityV1,
    private readonly credentials: OAuthCredentialCurrentnessReaderV1,
    private readonly provenance: ChannelIdentityProvenanceCurrentnessReaderV1,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async resolve(
    request: Readonly<WorkspaceChannelIdentityCurrentnessRequestV1>
  ): Promise<Readonly<WorkspaceChannelIdentityCurrentnessV1>> {
    const entitlementAsOf = this.now();
    const result = (
      state: WorkspaceChannelIdentityCurrentnessStateV1,
      reason: WorkspaceChannelIdentityCurrentnessReasonV1
    ) =>
      parseWorkspaceChannelIdentityCurrentnessV1({
        schemaVersion: 1,
        workspaceId: request.workspaceId,
        featureKey: request.featureKey,
        binding: request.binding,
        state,
        reason,
        assessedAt: this.now(),
        createsExecutionAuthority: false
      });

    let definition;
    try {
      definition = channelFeatureDefinitionV1(request.featureKey);
    } catch {
      return result('UNKNOWN', 'FEATURE_MISMATCH');
    }
    if (definition.sendingIdentityOwnership !== 'WORKSPACE_OWNED_IDENTITY')
      return result('UNKNOWN', 'FEATURE_MISMATCH');

    let binding: Readonly<WorkspaceChannelIdentityBindingV1> | undefined;
    let latest: Readonly<WorkspaceChannelIdentityBindingV1> | undefined;
    try {
      [binding, latest] = await Promise.all([
        this.bindings.getExact(request.workspaceId, request.binding.id, request.binding.version),
        this.bindings.getLatest(request.workspaceId, request.binding.id)
      ]);
    } catch {
      return result('UNAVAILABLE', 'OWNER_DATA_UNKNOWN');
    }
    if (!binding || !latest) return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
    if (binding.workspaceId !== request.workspaceId.toLowerCase())
      return result('UNKNOWN', 'WORKSPACE_MISMATCH');
    if (binding.featureKey !== request.featureKey) return result('UNKNOWN', 'FEATURE_MISMATCH');
    if (
      binding.workspaceChannelIdentityBindingId !== request.binding.id ||
      binding.version !== request.binding.version ||
      binding.bindingFingerprintSha256 !== request.binding.fingerprintSha256
    )
      return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
    if (
      latest.version !== binding.version ||
      latest.bindingFingerprintSha256 !== binding.bindingFingerprintSha256
    )
      return result('STALE', 'BINDING_STALE');
    if (binding.status === 'STALE') return result('STALE', 'BINDING_STALE');
    if (binding.status === 'REVOKED') return result('REVOKED', 'BINDING_REVOKED');

    let entitlement: Readonly<ChannelEntitlementAccessV1> | undefined;
    try {
      entitlement = await this.entitlements.resolve(
        request.workspaceId,
        request.featureKey,
        entitlementAsOf
      );
    } catch {
      return result('UNAVAILABLE', 'OWNER_DATA_UNKNOWN');
    }
    if (!entitlement) return result('UNAVAILABLE', 'OWNER_DATA_UNKNOWN');
    if (!entitlement.allowed) return result('NOT_ENTITLED', 'ENTITLEMENT_NOT_ENABLED');

    let observation: Readonly<WorkspaceChannelIdentityVerificationObservationV1>;
    try {
      observation = await this.verification.verify(binding);
      const verificationAssessedAt = this.now();
      const eligibility = assessWorkspaceChannelIdentityBindingEligibilityV1(binding, {
        workspaceId: request.workspaceId,
        featureKey: request.featureKey,
        assessedAt: verificationAssessedAt,
        verification: observation
      });
      if (!eligibility.eligible) {
        if (eligibility.reason === 'VERIFICATION_UNAVAILABLE')
          return result('UNAVAILABLE', 'IDENTITY_VERIFICATION_UNAVAILABLE');
        if (eligibility.reason === 'VERIFICATION_UNKNOWN')
          return result('UNKNOWN', 'IDENTITY_VERIFICATION_UNKNOWN');
        if (eligibility.reason === 'BINDING_STALE') return result('STALE', 'BINDING_STALE');
        if (eligibility.reason === 'BINDING_REVOKED') return result('REVOKED', 'BINDING_REVOKED');
        if (eligibility.reason === 'WORKSPACE_MISMATCH')
          return result('UNKNOWN', 'WORKSPACE_MISMATCH');
        if (eligibility.reason === 'FEATURE_MISMATCH') return result('UNKNOWN', 'FEATURE_MISMATCH');
        return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
      }
    } catch {
      return result('UNAVAILABLE', 'IDENTITY_VERIFICATION_UNAVAILABLE');
    }

    const credential = binding.connection.oauthCredentialRef;
    if (!credential || !request.oauthRequirements) return result('UNKNOWN', 'CREDENTIAL_UNKNOWN');
    let credentialState: Awaited<ReturnType<OAuthCredentialCurrentnessReaderV1['assess']>>;
    try {
      credentialState = await this.credentials.assess({
        credential,
        expectedWorkspaceId: request.workspaceId,
        expectedProvider: request.oauthRequirements.expectedProvider,
        expectedExternalAccountRef: binding.identity.externalAccountRef,
        requiredScopes: request.oauthRequirements.requiredScopes
      });
    } catch {
      return result('UNAVAILABLE', 'CREDENTIAL_UNAVAILABLE');
    }
    if (credentialState.state === 'EXPIRED') return result('REAUTH_REQUIRED', 'CREDENTIAL_EXPIRED');
    if (credentialState.state === 'REAUTH_REQUIRED')
      return result('REAUTH_REQUIRED', 'CREDENTIAL_REAUTH_REQUIRED');
    if (credentialState.state === 'REVOKED') return result('REVOKED', 'CREDENTIAL_REVOKED');
    if (credentialState.state === 'UNKNOWN') return result('UNKNOWN', 'CREDENTIAL_UNKNOWN');
    if (credentialState.state === 'UNAVAILABLE')
      return result('UNAVAILABLE', 'CREDENTIAL_UNAVAILABLE');

    let provenanceState: Awaited<
      ReturnType<ChannelIdentityProvenanceCurrentnessReaderV1['assess']>
    >;
    try {
      provenanceState = await this.provenance.assess({
        capabilityId: binding.connection.capabilityRef.capabilityId,
        capabilityVersion: binding.connection.capabilityRef.capabilityVersion,
        implementationProfileId: binding.connection.implementationRef.implementationProfileId,
        implementationProfileVersion: binding.connection.implementationRef.version
      });
    } catch {
      return result('UNAVAILABLE', 'IMPLEMENTATION_UNAVAILABLE');
    }
    if (provenanceState.state === 'STALE') return result('STALE', 'IMPLEMENTATION_STALE');
    if (provenanceState.state === 'UNKNOWN') return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
    if (provenanceState.state === 'UNAVAILABLE')
      return result('UNAVAILABLE', 'IMPLEMENTATION_UNAVAILABLE');
    return result('CURRENT', 'EXACT_BINDING_CURRENT');
  }
}

export class UnavailableWorkspaceChannelIdentityVerificationAuthorityV1 implements WorkspaceChannelIdentityVerificationAuthorityV1 {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}
  verify(binding: Readonly<WorkspaceChannelIdentityBindingV1>) {
    return Promise.resolve({
      schemaVersion: 1 as const,
      binding: {
        id: binding.workspaceChannelIdentityBindingId,
        version: binding.version,
        fingerprintSha256: binding.bindingFingerprintSha256
      },
      status: 'UNAVAILABLE' as const,
      observedAt: this.now(),
      evidenceRefs: ['identity-verification-authority:unavailable']
    });
  }
}

export function channelEntitlementFromResolvedV1(
  workspaceId: string,
  featureKey: ChannelFeatureKeyV1,
  value: unknown
): ChannelEntitlementAccessV1 {
  return assessChannelEntitlementV1(workspaceId, featureKey, [value as never]);
}
