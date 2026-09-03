import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import {
  networkVisibilityFieldsByDataClass,
  noNetworkParticipationAuthorityConsequences,
  type ChangeNetworkParticipationStateCommandV1,
  type NetworkParticipationAuditProvenanceV1,
  type NetworkParticipationId,
  type NetworkParticipationSnapshotV1,
  type NetworkParticipationState,
  type NetworkVisibilityAudienceV1,
  type NetworkVisibilityAuthorityCheckV1,
  type NetworkVisibilityAuthorityState,
  type NetworkVisibilityDataClass,
  type NetworkVisibilityDenialReason,
  type NetworkVisibilityField,
  type NetworkVisibilityGrantV1,
  type OptInNetworkParticipationCommandV1,
  type ReplaceVisibilityPolicyCommandV1,
  type ReplacementVisibilityPolicyV1,
  type VersionedVisibilityPolicyV1
} from '@markorbit/contracts/network-participation';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import type { ProviderRegistryRepository } from './provider-registry.js';

export interface NetworkParticipationPrincipal {
  workspaceId: string;
  actorId: string;
}

export type NetworkParticipationErrorCode =
  | 'INVALID_INPUT'
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_WORKSPACE_MISMATCH'
  | 'PARTICIPATION_NOT_FOUND'
  | 'PARTICIPATION_ALREADY_EXISTS'
  | 'INVALID_PARTICIPATION_TRANSITION'
  | 'PARTICIPATION_REVOKED'
  | 'STALE_PARTICIPATION'
  | 'STALE_VISIBILITY_POLICY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'AUTHORITY_UNAVAILABLE'
  | 'PERSISTENCE_UNAVAILABLE';

export class NetworkParticipationError extends Error {
  constructor(
    public readonly code: NetworkParticipationErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'NetworkParticipationError';
  }
}

export interface NetworkParticipationVersionRecord {
  schemaVersion: 1;
  networkParticipationId: NetworkParticipationId;
  workspaceId: string;
  providerId: ProviderId;
  version: number;
  state: Exclude<NetworkParticipationState, 'NOT_PARTICIPATING'>;
  authorizationReference: string;
  reason: string;
  actorId: MarkOrbitId;
  correlationId: MarkOrbitId;
  occurredAt: string;
  createdAt: string;
}

export type NetworkVisibilityPolicyVersionRecord = VersionedVisibilityPolicyV1 & {
  networkParticipationId: NetworkParticipationId;
  participationVersion: number;
  reason: string;
  actorId: MarkOrbitId;
  correlationId: MarkOrbitId;
  createdAt: string;
};

export type NetworkParticipationCommandType =
  'OPT_IN' | 'PAUSE' | 'RESUME' | 'REVOKE' | 'REPLACE_VISIBILITY_POLICY';

export interface NetworkParticipationReplayRecord {
  scopeKey: string;
  idempotencyKey: string;
  fingerprint: string;
  commandType: NetworkParticipationCommandType;
  response: NetworkParticipationSnapshotV1;
}

export interface NetworkParticipationCommit {
  workspaceId: string;
  providerId: ProviderId;
  expectedCurrentParticipationId: NetworkParticipationId | null;
  expectedCurrentParticipationVersion: number | null;
  expectedCurrentVisibilityPolicyVersion: number | null;
  participation: NetworkParticipationVersionRecord;
  visibilityPolicy?: NetworkVisibilityPolicyVersionRecord;
  replay: NetworkParticipationReplayRecord;
  audit: NetworkParticipationAuditProvenanceV1;
}

export interface NetworkParticipationRepository {
  findCurrentParticipation(
    workspaceId: string,
    providerId: ProviderId
  ): Promise<NetworkParticipationVersionRecord | undefined>;
  findLatestParticipation(
    networkParticipationId: NetworkParticipationId
  ): Promise<NetworkParticipationVersionRecord | undefined>;
  findCurrentVisibilityPolicy(
    networkParticipationId: NetworkParticipationId
  ): Promise<NetworkVisibilityPolicyVersionRecord | undefined>;
  findReplay(
    scopeKey: string,
    idempotencyKey: string
  ): Promise<NetworkParticipationReplayRecord | undefined>;
  commit(
    mutation: NetworkParticipationCommit
  ): Promise<NetworkParticipationReplayRecord | undefined>;
  listParticipationHistory(
    networkParticipationId: NetworkParticipationId
  ): Promise<NetworkParticipationVersionRecord[]>;
  listVisibilityPolicyHistory(
    networkParticipationId: NetworkParticipationId
  ): Promise<NetworkVisibilityPolicyVersionRecord[]>;
  listAuditHistory(
    networkParticipationId: NetworkParticipationId
  ): Promise<NetworkParticipationAuditProvenanceV1[]>;
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function bindingKey(workspaceId: string, providerId: ProviderId): string {
  return `${workspaceId}:${providerId}`;
}

function replayKey(scopeKey: string, idempotencyKey: string): string {
  return `${scopeKey}:${idempotencyKey}`;
}

/** Reference repository only. Durable PostgreSQL ownership remains a separate phase. */
export class InMemoryNetworkParticipationRepository implements NetworkParticipationRepository {
  private readonly currentByBinding = new Map<string, NetworkParticipationId>();
  private readonly participationHistory = new Map<
    NetworkParticipationId,
    NetworkParticipationVersionRecord[]
  >();
  private readonly policyHistory = new Map<
    NetworkParticipationId,
    NetworkVisibilityPolicyVersionRecord[]
  >();
  private readonly replays = new Map<string, NetworkParticipationReplayRecord>();
  private readonly audits = new Map<
    NetworkParticipationId,
    NetworkParticipationAuditProvenanceV1[]
  >();

  async findCurrentParticipation(workspaceId: string, providerId: ProviderId) {
    const id = this.currentByBinding.get(bindingKey(workspaceId, providerId));
    return id ? this.findLatestParticipation(id) : undefined;
  }

  findLatestParticipation(networkParticipationId: NetworkParticipationId) {
    const history = this.participationHistory.get(networkParticipationId);
    const latest = history?.at(-1);
    return Promise.resolve(latest ? copy(latest) : undefined);
  }

  findCurrentVisibilityPolicy(networkParticipationId: NetworkParticipationId) {
    const history = this.policyHistory.get(networkParticipationId);
    const latest = history?.at(-1);
    return Promise.resolve(latest ? copy(latest) : undefined);
  }

  findReplay(scopeKey: string, idempotencyKey: string) {
    const replay = this.replays.get(replayKey(scopeKey, idempotencyKey));
    return Promise.resolve(replay ? copy(replay) : undefined);
  }

  // Deliberately contains no await: the complete binding CAS and append execute in one JS turn.
  commit(
    mutation: NetworkParticipationCommit
  ): Promise<NetworkParticipationReplayRecord | undefined> {
    const key = bindingKey(mutation.workspaceId, mutation.providerId);
    const committedReplay = this.replays.get(
      replayKey(mutation.replay.scopeKey, mutation.replay.idempotencyKey)
    );
    if (committedReplay) {
      if (
        committedReplay.fingerprint !== mutation.replay.fingerprint ||
        committedReplay.commandType !== mutation.replay.commandType
      )
        throw new NetworkParticipationError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different trusted context or command payload.',
          409
        );
      return Promise.resolve(copy(committedReplay));
    }
    const currentId = this.currentByBinding.get(key) ?? null;
    const current = currentId ? this.participationHistory.get(currentId)?.at(-1) : undefined;
    const currentPolicy = currentId ? this.policyHistory.get(currentId)?.at(-1) : undefined;
    if (
      currentId !== mutation.expectedCurrentParticipationId ||
      (current?.version ?? null) !== mutation.expectedCurrentParticipationVersion
    )
      throw new NetworkParticipationError(
        'STALE_PARTICIPATION',
        'Network Participation changed; reload the exact latest version.',
        409
      );
    if ((currentPolicy?.version ?? null) !== mutation.expectedCurrentVisibilityPolicyVersion)
      throw new NetworkParticipationError(
        'STALE_VISIBILITY_POLICY',
        'Visibility Policy changed; reload the exact latest version.',
        409
      );
    const participationVersions =
      this.participationHistory.get(mutation.participation.networkParticipationId) ?? [];
    const previousParticipation = participationVersions.at(-1);
    if (previousParticipation?.state === 'REVOKED')
      throw new NetworkParticipationError(
        'PARTICIPATION_REVOKED',
        'Revoked Network Participation cannot be revived; opt in with a fresh identity.',
        409
      );
    const policyOnlyCommit =
      Boolean(mutation.visibilityPolicy) &&
      previousParticipation?.version === mutation.participation.version;
    if (
      !policyOnlyCommit &&
      mutation.participation.version !== (previousParticipation?.version ?? 0) + 1
    )
      throw new NetworkParticipationError(
        'STALE_PARTICIPATION',
        'Network Participation history is not appendable at the requested version.',
        409
      );

    if (mutation.visibilityPolicy) {
      const policyVersions =
        this.policyHistory.get(mutation.visibilityPolicy.networkParticipationId) ?? [];
      if (mutation.visibilityPolicy.version !== (policyVersions.at(-1)?.version ?? 0) + 1)
        throw new NetworkParticipationError(
          'STALE_VISIBILITY_POLICY',
          'Visibility Policy history is not appendable at the requested version.',
          409
        );
      this.policyHistory.set(mutation.visibilityPolicy.networkParticipationId, [
        ...policyVersions,
        copy(mutation.visibilityPolicy)
      ]);
    }

    if (!policyOnlyCommit)
      this.participationHistory.set(mutation.participation.networkParticipationId, [
        ...participationVersions,
        copy(mutation.participation)
      ]);
    this.currentByBinding.set(key, mutation.participation.networkParticipationId);
    this.replays.set(
      replayKey(mutation.replay.scopeKey, mutation.replay.idempotencyKey),
      copy(mutation.replay)
    );
    const auditHistory = this.audits.get(mutation.audit.networkParticipationId) ?? [];
    this.audits.set(mutation.audit.networkParticipationId, [...auditHistory, copy(mutation.audit)]);
    return Promise.resolve(undefined);
  }

  listParticipationHistory(networkParticipationId: NetworkParticipationId) {
    return Promise.resolve(copy(this.participationHistory.get(networkParticipationId) ?? []));
  }

  listVisibilityPolicyHistory(networkParticipationId: NetworkParticipationId) {
    return Promise.resolve(copy(this.policyHistory.get(networkParticipationId) ?? []));
  }

  listAuditHistory(networkParticipationId: NetworkParticipationId) {
    return Promise.resolve(copy(this.audits.get(networkParticipationId) ?? []));
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dataClasses = Object.keys(networkVisibilityFieldsByDataClass) as NetworkVisibilityDataClass[];
const dataClassSet = new Set<string>(dataClasses);

function cleanText(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      `${field} must be a non-empty value no longer than ${maximum} characters.`,
      422
    );
  return value.trim();
}

function cleanWorkspaceId(value: unknown): string {
  const workspaceId = cleanText(value, 'principal.workspaceId', 100).toLowerCase();
  if (!uuidPattern.test(workspaceId))
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'principal.workspaceId must be a Core Workspace UUID.',
      422
    );
  return workspaceId;
}

function positiveVersion(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      `${field} must be a positive integer.`,
      422
    );
  return Number(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function commandScope(workspaceId: string, providerId: ProviderId): string {
  return `network-participation:${workspaceId}:${providerId}`;
}

function hasItems<T>(values: readonly T[]): boolean {
  return Array.isArray(values) && values.length > 0;
}

function normalizedGrant(grant: NetworkVisibilityGrantV1): NetworkVisibilityGrantV1 {
  if (!grant || typeof grant !== 'object' || !dataClassSet.has(grant.dataClass))
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'Grant dataClass is not authorized by V1.',
      422
    );
  const allowedFields = new Set<string>(networkVisibilityFieldsByDataClass[grant.dataClass]);
  if (!hasItems(grant.fields) || grant.fields.some((field) => typeof field !== 'string'))
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'Each grant requires explicit fields.',
      422
    );
  const fields = [...new Set(grant.fields)];
  if (fields.some((field) => !allowedFields.has(field)))
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'Grant contains a field outside the V1 allowlist.',
      422
    );
  if (grant.purpose !== 'PROVIDER_DISCOVERY')
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'Grant purpose is not authorized by V1.',
      422
    );
  if (
    !Array.isArray(grant.authorityReferences) ||
    !grant.audience ||
    typeof grant.audience !== 'object'
  )
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'Each grant requires an explicit audience and authority references.',
      422
    );
  const authorityReferences = [
    ...new Set(
      grant.authorityReferences.map((value) => cleanText(value, 'grant.authorityReferences', 500))
    )
  ].sort();
  if (authorityReferences.length === 0)
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'Each grant requires authority references.',
      422
    );
  if (grant.scope === 'TRUSTED') {
    if (grant.audience.kind !== 'TRUSTED_RELATIONSHIP')
      throw new NetworkParticipationError(
        'INVALID_INPUT',
        'TRUSTED grants require a trusted relationship audience.',
        422
      );
    return {
      dataClass: grant.dataClass,
      fields: fields.sort(),
      scope: 'TRUSTED',
      audience: {
        kind: 'TRUSTED_RELATIONSHIP',
        relationshipAuthorityReference: cleanText(
          grant.audience.relationshipAuthorityReference,
          'relationshipAuthorityReference',
          500
        )
      },
      purpose: 'PROVIDER_DISCOVERY',
      authorityReferences
    } as NetworkVisibilityGrantV1;
  }
  if (grant.scope !== 'BOUNDED_PUBLIC' || grant.audience.kind !== 'BOUNDED_NETWORK')
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'BOUNDED_PUBLIC grants require a bounded-network audience.',
      422
    );
  return {
    dataClass: grant.dataClass,
    fields: fields.sort(),
    scope: 'BOUNDED_PUBLIC',
    audience: { kind: 'BOUNDED_NETWORK' },
    purpose: 'PROVIDER_DISCOVERY',
    authorityReferences
  } as NetworkVisibilityGrantV1;
}

function normalizedReplacement(
  replacement: ReplacementVisibilityPolicyV1
): ReplacementVisibilityPolicyV1 {
  if (!replacement || typeof replacement !== 'object')
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'Visibility Policy replacement is required.',
      422
    );
  if (replacement.scope === 'PRIVATE') {
    if (!Array.isArray(replacement.grants) || replacement.grants.length !== 0)
      throw new NetworkParticipationError(
        'INVALID_INPUT',
        'PRIVATE visibility requires an empty grant list.',
        422
      );
    return { scope: 'PRIVATE', grants: [] };
  }
  if (replacement.scope !== 'TRUSTED' && replacement.scope !== 'BOUNDED_PUBLIC')
    throw new NetworkParticipationError('INVALID_INPUT', 'Unknown Visibility Policy scope.', 422);
  if (!Array.isArray(replacement.grants) || replacement.grants.length === 0)
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      `${replacement.scope} visibility requires explicit grants.`,
      422
    );
  const grants = replacement.grants.map(normalizedGrant);
  if (grants.some((grant) => grant.scope !== replacement.scope))
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'Every grant scope must match the Visibility Policy scope.',
      422
    );
  grants.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const first = grants[0]!;
  return { scope: replacement.scope, grants: [first, ...grants.slice(1)] };
}

function exposedDataClasses(policy: VersionedVisibilityPolicyV1): NetworkVisibilityDataClass[] {
  return [...new Set(policy.grants.map((grant) => grant.dataClass))].sort();
}

function changedDataClasses(
  previous: VersionedVisibilityPolicyV1,
  next: ReplacementVisibilityPolicyV1
): NetworkVisibilityDataClass[] {
  const signatures = (grants: readonly NetworkVisibilityGrantV1[]) => {
    const byClass = new Map<NetworkVisibilityDataClass, string[]>();
    for (const grant of grants) {
      const current = byClass.get(grant.dataClass) ?? [];
      current.push(JSON.stringify(grant));
      byClass.set(grant.dataClass, current);
    }
    return byClass;
  };
  const oldByClass = signatures(previous.grants);
  const newByClass = signatures(next.grants);
  return [...new Set([...oldByClass.keys(), ...newByClass.keys()])]
    .filter(
      (dataClass) =>
        JSON.stringify((oldByClass.get(dataClass) ?? []).sort()) !==
        JSON.stringify((newByClass.get(dataClass) ?? []).sort())
    )
    .sort();
}

function snapshot(
  participation: NetworkParticipationVersionRecord,
  policy: NetworkVisibilityPolicyVersionRecord,
  checkedAt: string
): NetworkParticipationSnapshotV1 {
  return {
    schemaVersion: 1,
    networkParticipationId: participation.networkParticipationId,
    workspaceId: participation.workspaceId,
    providerId: participation.providerId,
    participationVersion: participation.version,
    state: participation.state,
    authorizationReference: participation.authorizationReference,
    visibilityPolicy: {
      schemaVersion: 1,
      version: policy.version,
      scope: policy.scope,
      grants: copy(policy.grants),
      authorizationReference: policy.authorizationReference,
      updatedAt: policy.updatedAt
    } as VersionedVisibilityPolicyV1,
    checkedAt,
    authorityConsequences: noNetworkParticipationAuthorityConsequences
  };
}

export class NetworkParticipationService {
  constructor(
    private readonly repository: NetworkParticipationRepository,
    private readonly providerRegistry: Pick<ProviderRegistryRepository, 'findProviderById'>,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly participationIdFactory: () => NetworkParticipationId = () =>
      `network-participation_${randomUUID()}`
  ) {}

  async read(
    principal: NetworkParticipationPrincipal,
    providerId: ProviderId
  ): Promise<NetworkParticipationSnapshotV1> {
    const workspaceId = await this.assertProviderBinding(principal, providerId);
    const current = await this.repository.findCurrentParticipation(workspaceId, providerId);
    const checkedAt = this.now();
    if (!current)
      return {
        schemaVersion: 1,
        networkParticipationId: null,
        workspaceId,
        providerId,
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
        checkedAt,
        authorityConsequences: noNetworkParticipationAuthorityConsequences
      };
    return snapshot(current, await this.requirePolicy(current.networkParticipationId), checkedAt);
  }

  async optIn(
    principal: NetworkParticipationPrincipal,
    command: OptInNetworkParticipationCommandV1
  ): Promise<NetworkParticipationSnapshotV1> {
    this.assertSchema(command.schemaVersion);
    const workspaceId = await this.assertProviderBinding(principal, command.providerId);
    const actorId = cleanText(principal.actorId, 'principal.actorId', 200) as MarkOrbitId;
    const authorizationReference = cleanText(
      command.authorizationReference,
      'authorizationReference'
    );
    const reason = cleanText(command.reason, 'reason', 1000);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 200);
    const correlationId = cleanText(command.correlationId, 'correlationId', 200) as MarkOrbitId;
    const scopeKey = commandScope(workspaceId, command.providerId);
    const requestFingerprint = fingerprint({
      commandType: 'OPT_IN',
      workspaceId,
      actorId,
      providerId: command.providerId,
      authorizationReference,
      reason,
      correlationId
    });
    const replay = await this.replay(scopeKey, idempotencyKey, requestFingerprint, 'OPT_IN');
    if (replay) return replay;

    const current = await this.repository.findCurrentParticipation(workspaceId, command.providerId);
    if (current && current.state !== 'REVOKED')
      throw new NetworkParticipationError(
        'PARTICIPATION_ALREADY_EXISTS',
        'A current non-revoked Network Participation already exists.',
        409
      );
    const currentPolicy = current
      ? await this.repository.findCurrentVisibilityPolicy(current.networkParticipationId)
      : undefined;
    const networkParticipationId = this.participationIdFactory();
    if (await this.repository.findLatestParticipation(networkParticipationId))
      throw new NetworkParticipationError(
        'PARTICIPATION_REVOKED',
        'A fresh Network Participation identity is required for opt-in.',
        409
      );
    const at = this.now();
    const participation: NetworkParticipationVersionRecord = {
      schemaVersion: 1,
      networkParticipationId,
      workspaceId,
      providerId: command.providerId,
      version: 1,
      state: 'ACTIVE',
      authorizationReference,
      reason,
      actorId,
      correlationId,
      occurredAt: at,
      createdAt: at
    };
    const policy: NetworkVisibilityPolicyVersionRecord = {
      schemaVersion: 1,
      networkParticipationId,
      participationVersion: 1,
      version: 1,
      scope: 'PRIVATE',
      grants: [],
      authorizationReference,
      reason,
      actorId,
      correlationId,
      updatedAt: at,
      createdAt: at
    };
    const response = snapshot(participation, policy, at);
    const committedReplay = await this.repository.commit({
      workspaceId,
      providerId: command.providerId,
      expectedCurrentParticipationId: current?.networkParticipationId ?? null,
      expectedCurrentParticipationVersion: current?.version ?? null,
      expectedCurrentVisibilityPolicyVersion: currentPolicy?.version ?? null,
      participation,
      visibilityPolicy: policy,
      replay: {
        scopeKey,
        idempotencyKey,
        fingerprint: requestFingerprint,
        commandType: 'OPT_IN',
        response
      },
      audit: {
        schemaVersion: 1,
        networkParticipationId,
        workspaceId,
        providerId: command.providerId,
        trustedActorId: actorId,
        authorityReference: authorizationReference,
        reason,
        previousParticipationState: 'NOT_PARTICIPATING',
        newParticipationState: 'ACTIVE',
        previousParticipationVersion: null,
        newParticipationVersion: 1,
        previousVisibilityPolicyVersion: null,
        newVisibilityPolicyVersion: 1,
        affectedDataClasses: [],
        occurredAt: at,
        correlationId
      }
    });
    return committedReplay?.response ?? response;
  }

  async changeState(
    principal: NetworkParticipationPrincipal,
    command: ChangeNetworkParticipationStateCommandV1
  ): Promise<NetworkParticipationSnapshotV1> {
    this.assertSchema(command.schemaVersion);
    const workspaceId = await this.assertProviderBinding(principal, command.providerId);
    const actorId = cleanText(principal.actorId, 'principal.actorId', 200) as MarkOrbitId;
    const authorizationReference = cleanText(
      command.authorizationReference,
      'authorizationReference'
    );
    const reason = cleanText(command.reason, 'reason', 1000);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 200);
    const correlationId = cleanText(command.correlationId, 'correlationId', 200) as MarkOrbitId;
    const expectedParticipationVersion = positiveVersion(
      command.expectedParticipationVersion,
      'expectedParticipationVersion'
    );
    const expectedVisibilityPolicyVersion = positiveVersion(
      command.expectedVisibilityPolicyVersion,
      'expectedVisibilityPolicyVersion'
    );
    if (!['PAUSE', 'RESUME', 'REVOKE'].includes(command.action))
      throw new NetworkParticipationError(
        'INVALID_INPUT',
        'Unknown participation state action.',
        422
      );
    const commandType: NetworkParticipationCommandType = command.action;
    const scopeKey = commandScope(workspaceId, command.providerId);
    const requestFingerprint = fingerprint({
      commandType,
      workspaceId,
      actorId,
      networkParticipationId: command.networkParticipationId,
      providerId: command.providerId,
      expectedParticipationVersion,
      expectedVisibilityPolicyVersion,
      authorizationReference,
      reason,
      correlationId
    });
    const replay = await this.replay(scopeKey, idempotencyKey, requestFingerprint, commandType);
    if (replay) return replay;

    const current = await this.requireTargetParticipation(
      workspaceId,
      command.providerId,
      command.networkParticipationId
    );
    const policy = await this.requirePolicy(current.networkParticipationId);
    this.assertVersions(
      current,
      policy,
      expectedParticipationVersion,
      expectedVisibilityPolicyVersion
    );
    if (current.state === 'REVOKED')
      throw new NetworkParticipationError(
        'PARTICIPATION_REVOKED',
        'Revoked Network Participation is terminal.',
        409
      );
    const nextState =
      command.action === 'PAUSE' ? 'PAUSED' : command.action === 'RESUME' ? 'ACTIVE' : 'REVOKED';
    const valid =
      (command.action === 'PAUSE' && current.state === 'ACTIVE') ||
      (command.action === 'RESUME' && current.state === 'PAUSED') ||
      command.action === 'REVOKE';
    if (!valid)
      throw new NetworkParticipationError(
        'INVALID_PARTICIPATION_TRANSITION',
        `${current.state} cannot transition through ${command.action}.`,
        409
      );
    const at = this.now();
    const next: NetworkParticipationVersionRecord = {
      ...current,
      version: current.version + 1,
      state: nextState,
      authorizationReference,
      reason,
      actorId,
      correlationId,
      occurredAt: at,
      createdAt: at
    };
    const response = snapshot(next, policy, at);
    const committedReplay = await this.repository.commit({
      workspaceId,
      providerId: command.providerId,
      expectedCurrentParticipationId: current.networkParticipationId,
      expectedCurrentParticipationVersion: current.version,
      expectedCurrentVisibilityPolicyVersion: policy.version,
      participation: next,
      replay: { scopeKey, idempotencyKey, fingerprint: requestFingerprint, commandType, response },
      audit: {
        schemaVersion: 1,
        networkParticipationId: current.networkParticipationId,
        workspaceId,
        providerId: command.providerId,
        trustedActorId: actorId,
        authorityReference: authorizationReference,
        reason,
        previousParticipationState: current.state,
        newParticipationState: nextState,
        previousParticipationVersion: current.version,
        newParticipationVersion: next.version,
        previousVisibilityPolicyVersion: policy.version,
        newVisibilityPolicyVersion: policy.version,
        affectedDataClasses: exposedDataClasses(policy),
        occurredAt: at,
        correlationId
      }
    });
    return committedReplay?.response ?? response;
  }

  async replaceVisibilityPolicy(
    principal: NetworkParticipationPrincipal,
    command: ReplaceVisibilityPolicyCommandV1
  ): Promise<NetworkParticipationSnapshotV1> {
    this.assertSchema(command.schemaVersion);
    const workspaceId = await this.assertProviderBinding(principal, command.providerId);
    const actorId = cleanText(principal.actorId, 'principal.actorId', 200) as MarkOrbitId;
    const authorizationReference = cleanText(
      command.authorizationReference,
      'authorizationReference'
    );
    const reason = cleanText(command.reason, 'reason', 1000);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 200);
    const correlationId = cleanText(command.correlationId, 'correlationId', 200) as MarkOrbitId;
    const expectedParticipationVersion = positiveVersion(
      command.expectedParticipationVersion,
      'expectedParticipationVersion'
    );
    const expectedVisibilityPolicyVersion = positiveVersion(
      command.expectedVisibilityPolicyVersion,
      'expectedVisibilityPolicyVersion'
    );
    const replacement = normalizedReplacement(command.replacement);
    const scopeKey = commandScope(workspaceId, command.providerId);
    const requestFingerprint = fingerprint({
      commandType: 'REPLACE_VISIBILITY_POLICY',
      workspaceId,
      actorId,
      networkParticipationId: command.networkParticipationId,
      providerId: command.providerId,
      expectedParticipationVersion,
      expectedVisibilityPolicyVersion,
      replacement,
      authorizationReference,
      reason,
      correlationId
    });
    const replay = await this.replay(
      scopeKey,
      idempotencyKey,
      requestFingerprint,
      'REPLACE_VISIBILITY_POLICY'
    );
    if (replay) return replay;

    const current = await this.requireTargetParticipation(
      workspaceId,
      command.providerId,
      command.networkParticipationId
    );
    const currentPolicy = await this.requirePolicy(current.networkParticipationId);
    this.assertVersions(
      current,
      currentPolicy,
      expectedParticipationVersion,
      expectedVisibilityPolicyVersion
    );
    if (current.state === 'REVOKED')
      throw new NetworkParticipationError(
        'PARTICIPATION_REVOKED',
        'Revoked Network Participation cannot receive a new Visibility Policy.',
        409
      );
    const at = this.now();
    const nextPolicy: NetworkVisibilityPolicyVersionRecord = {
      schemaVersion: 1,
      networkParticipationId: current.networkParticipationId,
      participationVersion: current.version,
      version: currentPolicy.version + 1,
      ...replacement,
      authorizationReference,
      reason,
      actorId,
      correlationId,
      updatedAt: at,
      createdAt: at
    };
    const response = snapshot(current, nextPolicy, at);
    const committedReplay = await this.repository.commit({
      workspaceId,
      providerId: command.providerId,
      expectedCurrentParticipationId: current.networkParticipationId,
      expectedCurrentParticipationVersion: current.version,
      expectedCurrentVisibilityPolicyVersion: currentPolicy.version,
      participation: current,
      visibilityPolicy: nextPolicy,
      replay: {
        scopeKey,
        idempotencyKey,
        fingerprint: requestFingerprint,
        commandType: 'REPLACE_VISIBILITY_POLICY',
        response
      },
      audit: {
        schemaVersion: 1,
        networkParticipationId: current.networkParticipationId,
        workspaceId,
        providerId: command.providerId,
        trustedActorId: actorId,
        authorityReference: authorizationReference,
        reason,
        previousParticipationState: current.state,
        newParticipationState: current.state,
        previousParticipationVersion: current.version,
        newParticipationVersion: current.version,
        previousVisibilityPolicyVersion: currentPolicy.version,
        newVisibilityPolicyVersion: nextPolicy.version,
        affectedDataClasses: changedDataClasses(currentPolicy, replacement),
        occurredAt: at,
        correlationId
      }
    });
    return committedReplay?.response ?? response;
  }

  private assertSchema(schemaVersion: unknown): void {
    if (schemaVersion !== 1)
      throw new NetworkParticipationError('INVALID_INPUT', 'schemaVersion must be 1.', 422);
  }

  private async assertProviderBinding(
    principal: NetworkParticipationPrincipal,
    providerId: ProviderId
  ): Promise<string> {
    const workspaceId = cleanWorkspaceId(principal.workspaceId);
    cleanText(principal.actorId, 'principal.actorId', 200);
    const provider = await this.providerRegistry.findProviderById(providerId);
    if (!provider)
      throw new NetworkParticipationError('PROVIDER_NOT_FOUND', 'Provider was not found.', 404);
    if (provider.providerWorkspaceId.toLowerCase() !== workspaceId)
      throw new NetworkParticipationError(
        'PROVIDER_WORKSPACE_MISMATCH',
        'Provider does not belong to the trusted Principal Workspace.',
        403
      );
    return workspaceId;
  }

  private async requireTargetParticipation(
    workspaceId: string,
    providerId: ProviderId,
    networkParticipationId: NetworkParticipationId
  ): Promise<NetworkParticipationVersionRecord> {
    const current = await this.repository.findCurrentParticipation(workspaceId, providerId);
    if (current?.networkParticipationId === networkParticipationId) return current;
    const historical = await this.repository.findLatestParticipation(networkParticipationId);
    if (
      historical?.workspaceId === workspaceId &&
      historical.providerId === providerId &&
      historical.state === 'REVOKED'
    )
      throw new NetworkParticipationError(
        'PARTICIPATION_REVOKED',
        'Revoked Network Participation is terminal.',
        409
      );
    throw new NetworkParticipationError(
      'PARTICIPATION_NOT_FOUND',
      'Current Network Participation was not found.',
      404
    );
  }

  private async requirePolicy(networkParticipationId: NetworkParticipationId) {
    const policy = await this.repository.findCurrentVisibilityPolicy(networkParticipationId);
    if (!policy)
      throw new NetworkParticipationError(
        'AUTHORITY_UNAVAILABLE',
        'Current Visibility Policy authority is unavailable.',
        503
      );
    return policy;
  }

  private assertVersions(
    participation: NetworkParticipationVersionRecord,
    policy: NetworkVisibilityPolicyVersionRecord,
    expectedParticipationVersion: number,
    expectedVisibilityPolicyVersion: number
  ): void {
    if (participation.version !== expectedParticipationVersion)
      throw new NetworkParticipationError(
        'STALE_PARTICIPATION',
        'Network Participation changed; reload the exact latest version.',
        409
      );
    if (policy.version !== expectedVisibilityPolicyVersion)
      throw new NetworkParticipationError(
        'STALE_VISIBILITY_POLICY',
        'Visibility Policy changed; reload the exact latest version.',
        409
      );
  }

  private async replay(
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string,
    commandType: NetworkParticipationCommandType
  ): Promise<NetworkParticipationSnapshotV1 | undefined> {
    const replay = await this.repository.findReplay(scopeKey, idempotencyKey);
    if (!replay) return undefined;
    if (replay.fingerprint !== requestFingerprint || replay.commandType !== commandType)
      throw new NetworkParticipationError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different trusted context or command payload.',
        409
      );
    return replay.response;
  }
}

export interface RequestedNetworkVisibilityProjection {
  dataClass: string;
  fields: readonly string[];
}

export interface CurrentTrustedRelationshipAuthority {
  state: NetworkVisibilityAuthorityState;
  relationshipAuthorityReference: string;
}

export interface EvaluateNetworkVisibilityInput {
  participation: NetworkParticipationSnapshotV1;
  authorityState: NetworkVisibilityAuthorityState;
  purpose: string;
  audience: NetworkVisibilityAudienceV1;
  requestedProjection: readonly RequestedNetworkVisibilityProjection[];
  currentRelationshipAuthority?: CurrentTrustedRelationshipAuthority;
  checkedAt: string;
}

export interface AuthorizedNetworkVisibilityProjection {
  dataClasses: readonly NetworkVisibilityDataClass[];
  fields: readonly Readonly<{
    dataClass: NetworkVisibilityDataClass;
    fields: readonly NetworkVisibilityField[];
  }>[];
}

export interface NetworkVisibilityEvaluationResult {
  authorityCheck: NetworkVisibilityAuthorityCheckV1;
  authorizedProjection: AuthorizedNetworkVisibilityProjection;
}

const emptyProjection: AuthorizedNetworkVisibilityProjection = Object.freeze({
  dataClasses: [],
  fields: []
});

function denial(
  input: EvaluateNetworkVisibilityInput,
  reason: NetworkVisibilityDenialReason
): NetworkVisibilityEvaluationResult {
  return {
    authorityCheck: {
      schemaVersion: 1,
      decision: 'DENY',
      authorityState: input.authorityState,
      participationState: input.participation.state,
      checkedParticipationVersion: input.participation.participationVersion,
      checkedVisibilityPolicyVersion: input.participation.visibilityPolicy.version,
      checkedAt: input.checkedAt,
      denialReasons: [reason],
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    },
    authorizedProjection: emptyProjection
  };
}

function audienceMatches(
  grant: NetworkVisibilityGrantV1,
  input: EvaluateNetworkVisibilityInput
): boolean {
  if (grant.scope === 'BOUNDED_PUBLIC')
    return input.audience.kind === 'BOUNDED_NETWORK' && grant.audience.kind === 'BOUNDED_NETWORK';
  if (
    grant.audience.kind !== 'TRUSTED_RELATIONSHIP' ||
    input.audience.kind !== 'TRUSTED_RELATIONSHIP'
  )
    return false;
  const trusted = input.currentRelationshipAuthority;
  return (
    trusted?.state === 'CURRENT' &&
    trusted.relationshipAuthorityReference === grant.audience.relationshipAuthorityReference &&
    input.audience.relationshipAuthorityReference === grant.audience.relationshipAuthorityReference
  );
}

/** Pure fail-closed current-authority evaluator. It never fetches or returns Provider field values. */
export function evaluateNetworkVisibility(
  input: EvaluateNetworkVisibilityInput
): NetworkVisibilityEvaluationResult {
  if (input.participation.state === 'NOT_PARTICIPATING') return denial(input, 'NOT_PARTICIPATING');
  if (input.participation.state !== 'ACTIVE') return denial(input, 'PARTICIPATION_NOT_ACTIVE');
  if (input.authorityState === 'STALE') return denial(input, 'STALE_POLICY');
  if (input.authorityState === 'AMBIGUOUS') return denial(input, 'AMBIGUOUS_POLICY');
  if (input.authorityState === 'UNAVAILABLE') return denial(input, 'AUTHORITY_UNAVAILABLE');
  if (input.participation.visibilityPolicy.scope === 'PRIVATE')
    return denial(input, 'PRIVATE_SCOPE');
  if (!hasItems(input.requestedProjection))
    throw new NetworkParticipationError(
      'INVALID_INPUT',
      'At least one explicit data-class/field projection is required.',
      422
    );

  const policy = input.participation.visibilityPolicy;
  const authorized = new Map<NetworkVisibilityDataClass, Set<NetworkVisibilityField>>();
  for (const request of input.requestedProjection) {
    if (!dataClassSet.has(request.dataClass)) return denial(input, 'DATA_CLASS_NOT_AUTHORIZED');
    const dataClass = request.dataClass as NetworkVisibilityDataClass;
    const canonicalFields = new Set<string>(networkVisibilityFieldsByDataClass[dataClass]);
    if (
      !hasItems(request.fields) ||
      request.fields.some((field: string) => !canonicalFields.has(field))
    )
      return denial(input, 'FIELD_NOT_AUTHORIZED');
    const classGrants = policy.grants.filter((grant) => grant.dataClass === dataClass);
    if (classGrants.length === 0) return denial(input, 'DATA_CLASS_NOT_AUTHORIZED');
    const purposeGrants = classGrants.filter((grant) => grant.purpose === input.purpose);
    if (purposeGrants.length === 0) return denial(input, 'PURPOSE_NOT_AUTHORIZED');
    const audienceGrants = purposeGrants.filter((grant) => audienceMatches(grant, input));
    if (audienceGrants.length === 0) return denial(input, 'AUDIENCE_NOT_AUTHORIZED');
    const allowedFields = new Set<NetworkVisibilityField>(
      audienceGrants.flatMap((grant) => grant.fields)
    );
    if (request.fields.some((field: string) => !allowedFields.has(field as NetworkVisibilityField)))
      return denial(input, 'FIELD_NOT_AUTHORIZED');
    const result = authorized.get(dataClass) ?? new Set<NetworkVisibilityField>();
    for (const field of request.fields) result.add(field as NetworkVisibilityField);
    authorized.set(dataClass, result);
  }

  const fields = [...authorized.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dataClass, values]) => ({
      dataClass,
      fields: [...values].sort()
    }));
  return {
    authorityCheck: {
      schemaVersion: 1,
      decision: 'ALLOW',
      authorityState: 'CURRENT',
      participationState: 'ACTIVE',
      checkedParticipationVersion: input.participation.participationVersion,
      checkedVisibilityPolicyVersion: policy.version,
      checkedAt: input.checkedAt,
      denialReasons: [],
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    },
    authorizedProjection: {
      dataClasses: fields.map((value) => value.dataClass),
      fields
    }
  };
}
