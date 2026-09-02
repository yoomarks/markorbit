import {
  networkVisibilityFieldsByDataClass,
  noNetworkParticipationAuthorityConsequences
} from '@markorbit/contracts/network-participation';
import type {
  NetworkParticipationId,
  NetworkVisibilityGrantV1,
  VersionedVisibilityPolicyV1
} from '@markorbit/contracts/network-participation';
import type {
  ProviderId,
  ProviderOperationalStatus,
  ProviderSupplyCapabilityId,
  ProviderSupplyCapabilityStatus
} from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import {
  providerDiscoveryFingerprint,
  type ProviderDiscoverySource,
  type ProviderDiscoverySourceRepository
} from './provider-discovery.js';
import type { ProviderSupplyVerificationState } from './provider-registry.js';

type Row = Record<string, unknown>;

const providerStatuses = new Set<ProviderOperationalStatus>(['ACTIVE', 'SUSPENDED', 'INACTIVE']);
const supplyStatuses = new Set<ProviderSupplyCapabilityStatus>(['ACTIVE', 'SUSPENDED', 'RETIRED']);
const verificationStates = new Set<ProviderSupplyVerificationState>([
  'UNVERIFIED',
  'EVIDENCE_RECORDED',
  'VERIFIED_FOR_SUPPLY'
]);
const participationStates = new Set(['ACTIVE', 'PAUSED', 'REVOKED']);
const visibilityScopes = new Set(['PRIVATE', 'TRUSTED', 'BOUNDED_PUBLIC']);
const sha256Pattern = /^[0-9a-f]{64}$/;

function record(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Persisted Provider Discovery ${field} is malformed.`);
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1)
    throw new Error(`Persisted Provider Discovery ${field} is malformed.`);
  return result;
}

function instant(value: unknown, field: string): string {
  const result = value instanceof Date ? value.toISOString() : String(value);
  if (!Number.isFinite(Date.parse(result)))
    throw new Error(`Persisted Provider Discovery ${field} is malformed.`);
  return new Date(result).toISOString();
}

function stringArray(value: unknown, field: string, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0))
    throw new Error(`Persisted Provider Discovery ${field} is malformed.`);
  const items: string[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'string' || !item.trim())
      throw new Error(`Persisted Provider Discovery ${field} is malformed.`);
    items.push(item);
  }
  return [...new Set(items)].sort();
}

function validGrant(value: unknown, scope: string): value is NetworkVisibilityGrantV1 {
  if (
    !record(value) ||
    typeof value.dataClass !== 'string' ||
    !(value.dataClass in networkVisibilityFieldsByDataClass) ||
    !Array.isArray(value.fields) ||
    value.fields.length === 0 ||
    value.fields.some((field) => typeof field !== 'string') ||
    value.scope !== scope ||
    value.purpose !== 'PROVIDER_DISCOVERY' ||
    !Array.isArray(value.authorityReferences) ||
    value.authorityReferences.length === 0 ||
    value.authorityReferences.some((reference) => typeof reference !== 'string' || !reference) ||
    !record(value.audience)
  )
    return false;
  const allowedFields = new Set<string>(
    networkVisibilityFieldsByDataClass[
      value.dataClass as keyof typeof networkVisibilityFieldsByDataClass
    ]
  );
  if (value.fields.some((field) => !allowedFields.has(String(field)))) return false;
  return scope === 'TRUSTED'
    ? value.audience.kind === 'TRUSTED_RELATIONSHIP' &&
        typeof value.audience.relationshipAuthorityReference === 'string' &&
        Boolean(value.audience.relationshipAuthorityReference)
    : scope === 'BOUNDED_PUBLIC' && value.audience.kind === 'BOUNDED_NETWORK';
}

function policy(row: Row): VersionedVisibilityPolicyV1 | undefined {
  if (row.visibility_policy_version === null || row.visibility_policy_version === undefined)
    return undefined;
  const scope = text(row.visibility_scope, 'Visibility Policy scope');
  if (!visibilityScopes.has(scope) || !Array.isArray(row.visibility_grants))
    throw new Error('Persisted Provider Discovery Visibility Policy is malformed.');
  const grants = row.visibility_grants;
  if (
    (scope === 'PRIVATE' && grants.length !== 0) ||
    (scope !== 'PRIVATE' &&
      (grants.length === 0 || grants.some((grant) => !validGrant(grant, scope))))
  )
    throw new Error('Persisted Provider Discovery Visibility Policy grants are malformed.');
  const common = {
    schemaVersion: 1 as const,
    version: positiveInteger(row.visibility_policy_version, 'Visibility Policy version'),
    authorizationReference: text(
      row.visibility_authorization_reference,
      'Visibility Policy authorization reference'
    ),
    updatedAt: instant(row.visibility_updated_at, 'Visibility Policy updatedAt')
  };
  if (scope === 'PRIVATE') return { ...common, scope: 'PRIVATE', grants: [] };
  const copied = structuredClone(grants) as NetworkVisibilityGrantV1[];
  return {
    ...common,
    scope: scope as 'TRUSTED' | 'BOUNDED_PUBLIC',
    grants: [copied[0]!, ...copied.slice(1)]
  };
}

/** Live normalized projection; it never reads Provider or Supply whole-record JSON. */
export class PostgresProviderDiscoverySourceRepository implements ProviderDiscoverySourceRepository {
  constructor(private readonly query: QueryClient) {}

  async queryCurrentSources(
    input: Parameters<ProviderDiscoverySourceRepository['queryCurrentSources']>[0]
  ) {
    const result = await this.query.query(
      `SELECT
         provider.provider_id,
         provider.provider_workspace_id::text AS provider_workspace_id,
         provider.display_name,
         provider.operational_status,
         provider.version AS provider_version,
         provider.updated_at AS provider_updated_at,
         supply.provider_supply_capability_id,
         supply.provider_id AS supply_provider_id,
         supply.provider_workspace_id::text AS supply_provider_workspace_id,
         supply.version AS supply_version,
         supply.status AS supply_status,
         supply.jurisdictions,
         supply.service_types,
         supply.effective_from,
         supply.effective_until,
         supply.verification_state,
         supply.evidence_references,
         supply.source_fingerprint_sha256,
         (supply.availability_units > 0) AS has_operational_availability,
         participation.network_participation_id,
         participation.version AS participation_version,
         participation.state AS participation_state,
         participation.authorization_reference AS participation_authorization_reference,
         participation.occurred_at AS participation_occurred_at,
         visibility.version AS visibility_policy_version,
         visibility.scope AS visibility_scope,
         visibility.grants AS visibility_grants,
         visibility.authorization_reference AS visibility_authorization_reference,
         visibility.updated_at AS visibility_updated_at
       FROM mgsn_provider_supply_capabilities supply
       JOIN mgsn_providers provider
         ON provider.provider_id = supply.provider_id
        AND provider.provider_workspace_id = supply.provider_workspace_id
       LEFT JOIN mgsn_network_participations participation
         ON participation.provider_id = provider.provider_id
        AND participation.workspace_id = provider.provider_workspace_id
        AND participation.is_current = true
       LEFT JOIN mgsn_network_visibility_policies visibility
         ON visibility.network_participation_id = participation.network_participation_id
        AND visibility.is_current = true
       WHERE supply.is_current = true
         AND provider.operational_status = 'ACTIVE'
         AND supply.status = 'ACTIVE'
         AND supply.verification_state = 'VERIFIED_FOR_SUPPLY'
         AND supply.availability_units > 0
         AND $1 = ANY(supply.service_types)
         AND $2 = ANY(supply.jurisdictions)
         AND supply.effective_from <= $3::timestamptz
         AND (supply.effective_until IS NULL OR $3::timestamptz < supply.effective_until)
       ORDER BY provider.provider_id, supply.provider_supply_capability_id
       LIMIT $4`,
      [input.serviceType, input.jurisdiction, input.effectiveAt, input.limit + 1]
    );
    if (result.rows.length > input.limit) return { sources: [], complete: false } as const;
    return {
      sources: result.rows.map((row) => this.map(row as Row, input.effectiveAt)),
      complete: true
    } as const;
  }

  private map(row: Row, checkedAt: string): ProviderDiscoverySource {
    const providerId = text(row.provider_id, 'Provider id') as ProviderId;
    const providerWorkspaceId = text(row.provider_workspace_id, 'Provider Workspace id');
    const operationalStatus = text(
      row.operational_status,
      'Provider operational status'
    ) as ProviderOperationalStatus;
    const providerVersion = positiveInteger(row.provider_version, 'Provider version');
    const providerUpdatedAt = instant(row.provider_updated_at, 'Provider updatedAt');
    if (!providerStatuses.has(operationalStatus))
      throw new Error('Persisted Provider Discovery Provider status is malformed.');

    const supplyStatus = text(
      row.supply_status,
      'Supply Capability status'
    ) as ProviderSupplyCapabilityStatus;
    const verificationState = text(
      row.verification_state,
      'Supply verification state'
    ) as ProviderSupplyVerificationState;
    const supplyFingerprint = text(row.source_fingerprint_sha256, 'Supply fingerprint');
    if (
      !supplyStatuses.has(supplyStatus) ||
      !verificationStates.has(verificationState) ||
      !sha256Pattern.test(supplyFingerprint) ||
      typeof row.has_operational_availability !== 'boolean'
    )
      throw new Error('Persisted Provider Discovery Supply Capability is malformed.');

    const currentPolicy = policy(row);
    const networkParticipationId =
      row.network_participation_id === null || row.network_participation_id === undefined
        ? undefined
        : (text(
            row.network_participation_id,
            'Network Participation id'
          ) as NetworkParticipationId);
    if (!networkParticipationId && currentPolicy)
      throw new Error('Persisted Provider Discovery participation authority is ambiguous.');
    const participationVersion = networkParticipationId
      ? positiveInteger(row.participation_version, 'Network Participation version')
      : undefined;
    const participationState = networkParticipationId
      ? text(row.participation_state, 'Network Participation state')
      : undefined;
    if (participationState && !participationStates.has(participationState))
      throw new Error('Persisted Provider Discovery participation state is malformed.');
    if (networkParticipationId && !currentPolicy)
      throw new Error('Persisted Provider Discovery current Visibility Policy is unavailable.');

    const participation: ProviderDiscoverySource['participation'] = networkParticipationId
      ? {
          schemaVersion: 1 as const,
          networkParticipationId,
          workspaceId: providerWorkspaceId,
          providerId,
          participationVersion: participationVersion!,
          state: participationState as 'ACTIVE' | 'PAUSED' | 'REVOKED',
          authorizationReference: text(
            row.participation_authorization_reference,
            'Network Participation authorization reference'
          ),
          visibilityPolicy: currentPolicy!,
          checkedAt,
          authorityConsequences: noNetworkParticipationAuthorityConsequences
        }
      : {
          schemaVersion: 1 as const,
          networkParticipationId: null,
          workspaceId: providerWorkspaceId,
          providerId,
          participationVersion: null,
          state: 'NOT_PARTICIPATING' as const,
          authorizationReference: null,
          visibilityPolicy: {
            schemaVersion: 1 as const,
            version: null,
            scope: 'PRIVATE' as const,
            grants: [] as const,
            authorizationReference: null
          },
          checkedAt,
          authorityConsequences: noNetworkParticipationAuthorityConsequences
        };

    const participationFingerprintSha256 = networkParticipationId
      ? providerDiscoveryFingerprint({
          networkParticipationId,
          participationVersion,
          state: participationState,
          occurredAt: instant(row.participation_occurred_at, 'Network Participation occurredAt')
        })
      : undefined;
    const visibilityPolicyFingerprintSha256 = currentPolicy
      ? providerDiscoveryFingerprint({
          networkParticipationId,
          version: currentPolicy.version,
          scope: currentPolicy.scope,
          updatedAt: currentPolicy.updatedAt
        })
      : undefined;

    return {
      provider: {
        providerId,
        providerWorkspaceId,
        displayName: text(row.display_name, 'Provider display name'),
        operationalStatus,
        version: providerVersion,
        fingerprintSha256: providerDiscoveryFingerprint({
          providerId,
          providerWorkspaceId,
          operationalStatus,
          version: providerVersion,
          updatedAt: providerUpdatedAt
        }),
        updatedAt: providerUpdatedAt
      },
      supply: {
        providerSupplyCapabilityId: text(
          row.provider_supply_capability_id,
          'Supply Capability id'
        ) as ProviderSupplyCapabilityId,
        providerId: text(row.supply_provider_id, 'Supply Provider id') as ProviderId,
        providerWorkspaceId: text(row.supply_provider_workspace_id, 'Supply Provider Workspace id'),
        version: positiveInteger(row.supply_version, 'Supply Capability version'),
        status: supplyStatus,
        jurisdictions: stringArray(row.jurisdictions, 'Supply jurisdictions'),
        serviceTypes: stringArray(row.service_types, 'Supply service types'),
        effectiveFrom: instant(row.effective_from, 'Supply effectiveFrom'),
        ...(row.effective_until === null || row.effective_until === undefined
          ? {}
          : { effectiveUntil: instant(row.effective_until, 'Supply effectiveUntil') }),
        verificationState,
        evidenceReferences: stringArray(
          row.evidence_references,
          'Supply evidence references',
          true
        ),
        fingerprintSha256: supplyFingerprint,
        hasOperationalAvailability: row.has_operational_availability
      },
      participation,
      visibilityAuthorityState: 'CURRENT',
      ...(participationFingerprintSha256 ? { participationFingerprintSha256 } : {}),
      ...(visibilityPolicyFingerprintSha256 ? { visibilityPolicyFingerprintSha256 } : {})
    };
  }
}
