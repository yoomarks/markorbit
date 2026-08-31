import type { MarkOrbitId } from './index.js';
import type { ProviderId, ProviderOperationalStatus } from './provider-execution.js';

/**
 * Network Participation is a consent/visibility boundary over an existing Core Workspace +
 * MGSN Provider binding. It is not a second Workplace, Provider Registry or M4 lifecycle.
 */
export type NetworkParticipationId = `network-participation_${string}`;

export const networkParticipationStates = [
  'NOT_PARTICIPATING',
  'ACTIVE',
  'PAUSED',
  'REVOKED'
] as const;
export type NetworkParticipationState = (typeof networkParticipationStates)[number];

export const visibilityScopes = ['PRIVATE', 'TRUSTED', 'BOUNDED_PUBLIC'] as const;
export type VisibilityScope = (typeof visibilityScopes)[number];

/**
 * V1 deliberately excludes raw capacity/availability, Applicant/Owner data, End-client
 * Relationship Information and whole Provider/Supply records from policy grants.
 */
export const networkVisibilityFieldsByDataClass = Object.freeze({
  ORGANIZATION_IDENTITY: ['displayName'],
  PROVIDER_REFERENCE: ['providerId', 'displayName'],
  SUPPLY_PROFILE: ['serviceTypes'],
  SERVICE_JURISDICTIONS: ['jurisdictions'],
  PROVIDER_EVIDENCE_REFERENCE: ['evidenceReferences']
} as const);

export type NetworkVisibilityDataClass = keyof typeof networkVisibilityFieldsByDataClass;
export type NetworkVisibilityField =
  (typeof networkVisibilityFieldsByDataClass)[NetworkVisibilityDataClass][number];

type NetworkVisibilityFieldsFor<TDataClass extends NetworkVisibilityDataClass> =
  (typeof networkVisibilityFieldsByDataClass)[TDataClass][number];

type NetworkVisibilityGrantDataV1 = {
  [TDataClass in NetworkVisibilityDataClass]: {
    dataClass: TDataClass;
    fields: ReadonlyArray<NetworkVisibilityFieldsFor<TDataClass>>;
  };
}[NetworkVisibilityDataClass];

export const networkVisibilityPurposes = ['PROVIDER_DISCOVERY'] as const;
export type NetworkVisibilityPurpose = (typeof networkVisibilityPurposes)[number];

export type NetworkVisibilityAudienceV1 =
  | Readonly<{
      kind: 'TRUSTED_RELATIONSHIP';
      relationshipAuthorityReference: string;
    }>
  | Readonly<{
      kind: 'BOUNDED_NETWORK';
    }>;

type NetworkVisibilityGrantAudienceV1 =
  | Readonly<{
      scope: 'TRUSTED';
      audience: Extract<NetworkVisibilityAudienceV1, { kind: 'TRUSTED_RELATIONSHIP' }>;
    }>
  | Readonly<{
      scope: 'BOUNDED_PUBLIC';
      audience: Extract<NetworkVisibilityAudienceV1, { kind: 'BOUNDED_NETWORK' }>;
    }>;

/** Explicit field/data-class + audience/context + purpose allowlist. No wildcard grant exists. */
export type NetworkVisibilityGrantV1 = Readonly<
  NetworkVisibilityGrantDataV1 &
    NetworkVisibilityGrantAudienceV1 & {
      purpose: NetworkVisibilityPurpose;
      authorityReferences: readonly string[];
    }
>;

export interface DefaultPrivateVisibilityPolicyV1 {
  schemaVersion: 1;
  version: null;
  scope: 'PRIVATE';
  grants: readonly [];
  authorizationReference: null;
}

export type VersionedVisibilityPolicyV1 = Readonly<
  {
    schemaVersion: 1;
    version: number;
    authorizationReference: string;
    updatedAt: string;
  } & (
    | {
        scope: 'PRIVATE';
        grants: readonly [];
      }
    | {
        scope: 'TRUSTED' | 'BOUNDED_PUBLIC';
        grants: readonly [NetworkVisibilityGrantV1, ...NetworkVisibilityGrantV1[]];
      }
  )
>;

export type VisibilityPolicyV1 =
  Readonly<DefaultPrivateVisibilityPolicyV1> | VersionedVisibilityPolicyV1;

/**
 * Normalized no-row read. Null identity/version/authorization fields are intentional: the
 * contract must not manufacture an opt-in record merely because an operational Provider exists.
 */
export interface NoNetworkParticipationSnapshotV1 {
  schemaVersion: 1;
  networkParticipationId: null;
  workspaceId: string;
  providerId: ProviderId;
  participationVersion: null;
  state: 'NOT_PARTICIPATING';
  authorizationReference: null;
  visibilityPolicy: Readonly<DefaultPrivateVisibilityPolicyV1>;
  checkedAt: string;
  authorityConsequences: Readonly<NetworkParticipationAuthorityConsequencesV1>;
}

export interface PersistedNetworkParticipationSnapshotV1 {
  schemaVersion: 1;
  networkParticipationId: NetworkParticipationId;
  workspaceId: string;
  providerId: ProviderId;
  participationVersion: number;
  state: Exclude<NetworkParticipationState, 'NOT_PARTICIPATING'>;
  authorizationReference: string;
  visibilityPolicy: VersionedVisibilityPolicyV1;
  checkedAt: string;
  authorityConsequences: Readonly<NetworkParticipationAuthorityConsequencesV1>;
}

export type NetworkParticipationSnapshotV1 =
  Readonly<NoNetworkParticipationSnapshotV1> | Readonly<PersistedNetworkParticipationSnapshotV1>;

/**
 * Browser/client commands deliberately omit Workspace and actor identity. Those values come from
 * the trusted Core Session / Workspace Principal boundary and must be checked against the existing
 * Provider.providerWorkspaceId binding by the owning runtime.
 */
export interface OptInNetworkParticipationCommandV1 {
  schemaVersion: 1;
  providerId: ProviderId;
  authorizationReference: string;
  reason: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export const networkParticipationStateChangeActions = ['PAUSE', 'RESUME', 'REVOKE'] as const;
export type NetworkParticipationStateChangeAction =
  (typeof networkParticipationStateChangeActions)[number];

export interface ChangeNetworkParticipationStateCommandV1 {
  schemaVersion: 1;
  action: NetworkParticipationStateChangeAction;
  networkParticipationId: NetworkParticipationId;
  providerId: ProviderId;
  expectedParticipationVersion: number;
  expectedVisibilityPolicyVersion: number;
  authorizationReference: string;
  reason: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export type ReplacementVisibilityPolicyV1 =
  | Readonly<{
      scope: 'PRIVATE';
      grants: readonly [];
    }>
  | Readonly<{
      scope: 'TRUSTED' | 'BOUNDED_PUBLIC';
      grants: readonly [NetworkVisibilityGrantV1, ...NetworkVisibilityGrantV1[]];
    }>;

export interface ReplaceVisibilityPolicyCommandV1 {
  schemaVersion: 1;
  networkParticipationId: NetworkParticipationId;
  providerId: ProviderId;
  expectedParticipationVersion: number;
  expectedVisibilityPolicyVersion: number;
  replacement: ReplacementVisibilityPolicyV1;
  authorizationReference: string;
  reason: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export const networkVisibilityAuthorityStates = [
  'CURRENT',
  'STALE',
  'AMBIGUOUS',
  'UNAVAILABLE'
] as const;
export type NetworkVisibilityAuthorityState = (typeof networkVisibilityAuthorityStates)[number];

export const networkVisibilityDenialReasons = [
  'NOT_PARTICIPATING',
  'PARTICIPATION_NOT_ACTIVE',
  'PRIVATE_SCOPE',
  'STALE_POLICY',
  'AMBIGUOUS_POLICY',
  'AUTHORITY_UNAVAILABLE',
  'DATA_CLASS_NOT_AUTHORIZED',
  'FIELD_NOT_AUTHORIZED',
  'PURPOSE_NOT_AUTHORIZED',
  'AUDIENCE_NOT_AUTHORIZED'
] as const;
export type NetworkVisibilityDenialReason = (typeof networkVisibilityDenialReasons)[number];

/**
 * Result vocabulary only. Historical snapshots/replay are never themselves current exposure
 * permission; an owner runtime must establish this result from current authority at read time.
 */
export interface NetworkVisibilityAuthorityCheckV1 {
  schemaVersion: 1;
  decision: 'ALLOW' | 'DENY';
  authorityState: NetworkVisibilityAuthorityState;
  participationState: NetworkParticipationState;
  checkedParticipationVersion: number | null;
  checkedVisibilityPolicyVersion: number | null;
  checkedAt: string;
  denialReasons: readonly NetworkVisibilityDenialReason[];
  authorityConsequences: Readonly<NetworkParticipationAuthorityConsequencesV1>;
}

export interface NetworkParticipationAuditProvenanceV1 {
  schemaVersion: 1;
  networkParticipationId: NetworkParticipationId;
  workspaceId: string;
  providerId: ProviderId;
  trustedActorId: MarkOrbitId;
  authorityReference: string;
  reason: string;
  previousParticipationState: NetworkParticipationState;
  newParticipationState: NetworkParticipationState;
  previousParticipationVersion: number | null;
  newParticipationVersion: number;
  previousVisibilityPolicyVersion: number | null;
  newVisibilityPolicyVersion: number;
  affectedDataClasses: readonly NetworkVisibilityDataClass[];
  occurredAt: string;
  correlationId: MarkOrbitId;
}

export interface NetworkParticipationAuthorityConsequencesV1 {
  providerCandidateSelected: false;
  providerAllocated: false;
  providerAccepted: false;
  providerEngaged: false;
  professionalAppointmentCreated: false;
  externalContactAuthorized: false;
  protectedActionAuthorized: false;
  filingAuthorized: false;
  paymentAuthorized: false;
  officialTruthCreated: false;
  userCapabilityVerified: false;
}

export const noNetworkParticipationAuthorityConsequences = Object.freeze({
  providerCandidateSelected: false,
  providerAllocated: false,
  providerAccepted: false,
  providerEngaged: false,
  professionalAppointmentCreated: false,
  externalContactAuthorized: false,
  protectedActionAuthorized: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  officialTruthCreated: false,
  userCapabilityVerified: false
}) satisfies Readonly<NetworkParticipationAuthorityConsequencesV1>;

export interface NetworkParticipationVisibilityFixtureCaseV1 {
  providerOperationalStatus: ProviderOperationalStatus;
  participation: Readonly<NetworkParticipationSnapshotV1>;
  exposure: Readonly<NetworkVisibilityAuthorityCheckV1>;
}

const fixtureCheckedAt = '2026-09-01T00:00:00.000Z';
const fixtureWorkspaceId = '018f0000-0000-7000-8000-000000000367';
const fixtureProviderId = 'provider_fixture-367' as const satisfies ProviderId;

/** Acceptance fixture for the permanent Private First / fail-closed semantics from #359. */
export const networkParticipationVisibilityFixtureV1 = Object.freeze({
  activeProviderWithoutParticipation: {
    providerOperationalStatus: 'ACTIVE',
    participation: {
      schemaVersion: 1,
      networkParticipationId: null,
      workspaceId: fixtureWorkspaceId,
      providerId: fixtureProviderId,
      participationVersion: null,
      state: 'NOT_PARTICIPATING',
      authorizationReference: null,
      visibilityPolicy: {
        schemaVersion: 1,
        version: null,
        scope: 'PRIVATE',
        grants: [],
        authorizationReference: null
      },
      checkedAt: fixtureCheckedAt,
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    },
    exposure: {
      schemaVersion: 1,
      decision: 'DENY',
      authorityState: 'CURRENT',
      participationState: 'NOT_PARTICIPATING',
      checkedParticipationVersion: null,
      checkedVisibilityPolicyVersion: null,
      checkedAt: fixtureCheckedAt,
      denialReasons: ['NOT_PARTICIPATING'],
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    }
  },
  activeParticipationPrivateVisibility: {
    providerOperationalStatus: 'ACTIVE',
    participation: {
      schemaVersion: 1,
      networkParticipationId: 'network-participation_fixture-367-private',
      workspaceId: fixtureWorkspaceId,
      providerId: fixtureProviderId,
      participationVersion: 1,
      state: 'ACTIVE',
      authorizationReference: 'authorization:fixture-367-opt-in',
      visibilityPolicy: {
        schemaVersion: 1,
        version: 1,
        scope: 'PRIVATE',
        grants: [],
        authorizationReference: 'authorization:fixture-367-private',
        updatedAt: fixtureCheckedAt
      },
      checkedAt: fixtureCheckedAt,
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    },
    exposure: {
      schemaVersion: 1,
      decision: 'DENY',
      authorityState: 'CURRENT',
      participationState: 'ACTIVE',
      checkedParticipationVersion: 1,
      checkedVisibilityPolicyVersion: 1,
      checkedAt: fixtureCheckedAt,
      denialReasons: ['PRIVATE_SCOPE'],
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    }
  },
  stalePolicy: {
    providerOperationalStatus: 'ACTIVE',
    participation: {
      schemaVersion: 1,
      networkParticipationId: 'network-participation_fixture-367-stale',
      workspaceId: fixtureWorkspaceId,
      providerId: fixtureProviderId,
      participationVersion: 2,
      state: 'ACTIVE',
      authorizationReference: 'authorization:fixture-367-active',
      visibilityPolicy: {
        schemaVersion: 1,
        version: 2,
        scope: 'TRUSTED',
        grants: [
          {
            dataClass: 'SUPPLY_PROFILE',
            fields: ['serviceTypes'],
            scope: 'TRUSTED',
            audience: {
              kind: 'TRUSTED_RELATIONSHIP',
              relationshipAuthorityReference: 'relationship-authority:fixture-367'
            },
            purpose: 'PROVIDER_DISCOVERY',
            authorityReferences: ['authorization:fixture-367-trusted']
          }
        ],
        authorizationReference: 'authorization:fixture-367-trusted',
        updatedAt: fixtureCheckedAt
      },
      checkedAt: fixtureCheckedAt,
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    },
    exposure: {
      schemaVersion: 1,
      decision: 'DENY',
      authorityState: 'STALE',
      participationState: 'ACTIVE',
      checkedParticipationVersion: 2,
      checkedVisibilityPolicyVersion: 2,
      checkedAt: fixtureCheckedAt,
      denialReasons: ['STALE_POLICY'],
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    }
  },
  ambiguousPolicy: {
    providerOperationalStatus: 'ACTIVE',
    participation: {
      schemaVersion: 1,
      networkParticipationId: 'network-participation_fixture-367-ambiguous',
      workspaceId: fixtureWorkspaceId,
      providerId: fixtureProviderId,
      participationVersion: 3,
      state: 'ACTIVE',
      authorizationReference: 'authorization:fixture-367-active-2',
      visibilityPolicy: {
        schemaVersion: 1,
        version: 3,
        scope: 'BOUNDED_PUBLIC',
        grants: [
          {
            dataClass: 'SERVICE_JURISDICTIONS',
            fields: ['jurisdictions'],
            scope: 'BOUNDED_PUBLIC',
            audience: { kind: 'BOUNDED_NETWORK' },
            purpose: 'PROVIDER_DISCOVERY',
            authorityReferences: ['authorization:fixture-367-public']
          }
        ],
        authorizationReference: 'authorization:fixture-367-public',
        updatedAt: fixtureCheckedAt
      },
      checkedAt: fixtureCheckedAt,
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    },
    exposure: {
      schemaVersion: 1,
      decision: 'DENY',
      authorityState: 'AMBIGUOUS',
      participationState: 'ACTIVE',
      checkedParticipationVersion: 3,
      checkedVisibilityPolicyVersion: 3,
      checkedAt: fixtureCheckedAt,
      denialReasons: ['AMBIGUOUS_POLICY'],
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    }
  }
} as const satisfies Readonly<
  Record<string, Readonly<NetworkParticipationVisibilityFixtureCaseV1>>
>);
