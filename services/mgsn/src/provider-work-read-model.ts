import { createHash } from 'node:crypto';
import type {
  ProviderWorkItemReadResultV1,
  ProviderWorkItemSummaryV1,
  ProviderWorkSourceCheckV1
} from '@markorbit/contracts/provider-work-read-model';
import {
  noProviderWorkReadModelAuthorityConsequences,
  providerWorkPrivacyExclusionsV1
} from '@markorbit/contracts/provider-work-read-model';
import type {
  AllocationId,
  AllocationStatus,
  ProviderAcceptanceDecision,
  ProviderAcceptanceId,
  ProviderId,
  ProviderReturnId,
  ProviderReturnStatus,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import type { ProviderRegistryRecord, ProviderRegistryRepository } from './provider-registry.js';

export const PROVIDER_WORK_DEFAULT_LIMIT = 50;
export const PROVIDER_WORK_MAX_LIMIT = 100;

export interface ProviderWorkPrincipal {
  workspaceId: string;
  userId: string;
  membershipId: string;
}

export interface ProviderWorkListQuery {
  limit?: number;
  cursor?: string;
}

export interface ProviderWorkListResultV1 {
  schemaVersion: 1;
  providerWorkspaceId: string;
  principalReference: string;
  workspaceAuthorityReference: string;
  checkedAt: string;
  items: ReadonlyArray<Readonly<ProviderWorkItemSummaryV1>>;
  page: Readonly<{
    limit: number;
    nextCursor?: string;
  }>;
  readAuthorityDoesNotAuthorizeMutation: true;
}

export interface ProviderWorkCursor {
  updatedAt: string;
  allocationId: AllocationId;
}

/** Bounded normalized columns only; private JSON records are deliberately absent. */
export interface ProviderWorkProjectionSource {
  providerId: ProviderId;
  providerWorkspaceId: string;
  allocationId: AllocationId;
  allocationVersion: number;
  allocationStatus: AllocationStatus;
  allocationUpdatedAt: string;
  originatingWorkspaceId: string;
  allocationServicePackageId: ServicePackageId;
  allocationServicePackageVersion: number;
  allocationServicePackageFingerprintSha256: string;
  servicePackageId?: ServicePackageId;
  servicePackageVersion?: number;
  servicePackageFingerprintSha256?: string;
  servicePackageWorkspaceId?: string;
  providerAcceptanceId?: ProviderAcceptanceId;
  providerAcceptanceVersion?: number;
  acceptanceAllocationId?: AllocationId;
  acceptanceServicePackageId?: ServicePackageId;
  acceptanceServicePackageVersion?: number;
  acceptanceProviderId?: ProviderId;
  acceptanceProviderWorkspaceId?: string;
  acceptanceDecision?: ProviderAcceptanceDecision;
  acceptanceRespondedAt?: string;
  acceptanceFingerprintSha256?: string;
  providerReturnId?: ProviderReturnId;
  providerReturnVersion?: number;
  returnAllocationId?: AllocationId;
  returnServicePackageId?: ServicePackageId;
  returnServicePackageVersion?: number;
  returnProviderId?: ProviderId;
  returnProviderWorkspaceId?: string;
  returnStatus?: ProviderReturnStatus;
  returnSubmittedAt?: string;
  returnFingerprintSha256?: string;
}

export interface ProviderWorkReadRepository {
  listCurrentProviderWork(input: {
    provider: Readonly<ProviderRegistryRecord>;
    providerWorkspaceId: string;
    limit: number;
    cursor?: Readonly<ProviderWorkCursor>;
  }): Promise<ProviderWorkProjectionSource[]>;
  findCurrentProviderWork(input: {
    provider: Readonly<ProviderRegistryRecord>;
    providerWorkspaceId: string;
    allocationId: AllocationId;
  }): Promise<ProviderWorkProjectionSource | undefined>;
}

export type ProviderWorkReadModelErrorCode =
  'INVALID_QUERY' | 'SOURCE_INCONSISTENT' | 'PERSISTENCE_UNAVAILABLE';

export class ProviderWorkReadModelError extends Error {
  constructor(
    public readonly code: ProviderWorkReadModelErrorCode,
    message: string,
    public readonly status: 422 | 503,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'ProviderWorkReadModelError';
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
const allocationStatuses = new Set<AllocationStatus>(['ACTIVE', 'CANCELLED', 'SUPERSEDED']);
const acceptanceDecisions = new Set<ProviderAcceptanceDecision>(['ACCEPTED', 'DECLINED']);
const returnStatuses = new Set<ProviderReturnStatus>(['CURRENT', 'SUPERSEDED']);

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function providerWorkFingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function normalizedWorkspaceId(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!uuidPattern.test(normalized))
    throw new ProviderWorkReadModelError(
      'INVALID_QUERY',
      `${field} must be a Core Workspace UUID.`,
      422
    );
  return normalized;
}

function requireSource(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new ProviderWorkReadModelError('SOURCE_INCONSISTENT', message, 503, {
      failClosed: true
    });
}

function exactPositiveVersion(value: number | undefined, field: string): number {
  requireSource(Number.isInteger(value) && Number(value) > 0, `${field} is invalid.`);
  return Number(value);
}

function exactSha256(value: string | undefined, field: string): string {
  requireSource(typeof value === 'string' && sha256Pattern.test(value), `${field} is invalid.`);
  return value;
}

function exactTimestamp(value: string | undefined, field: string): string {
  requireSource(
    typeof value === 'string' && Number.isFinite(Date.parse(value)),
    `${field} is invalid.`
  );
  return new Date(value).toISOString();
}

function sourceCheck(
  sourceKind: ProviderWorkSourceCheckV1['sourceKind'],
  state: ProviderWorkSourceCheckV1['state'],
  checkedAt: string,
  scope: unknown,
  source?: { reference: string; version: number | string; fingerprint: string }
): ProviderWorkSourceCheckV1 {
  return {
    sourceKind,
    owner: 'MGSN',
    state,
    ...(source
      ? {
          sourceReference: source.reference,
          sourceVersion: source.version,
          sourceFingerprintSha256: source.fingerprint
        }
      : {}),
    checkedAt,
    queryScopeFingerprintSha256: providerWorkFingerprint(scope)
  };
}

function withoutCheckedAt(value: object): Readonly<Record<string, unknown>> {
  const bounded: Record<string, unknown> = { ...value };
  delete bounded.checkedAt;
  return bounded;
}

function encodeCursor(cursor: ProviderWorkCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string | undefined): ProviderWorkCursor | undefined {
  if (value === undefined) return undefined;
  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Partial<ProviderWorkCursor>;
    if (
      typeof decoded.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(decoded.updatedAt)) ||
      typeof decoded.allocationId !== 'string' ||
      !decoded.allocationId.startsWith('allocation_')
    )
      throw new Error('invalid cursor');
    return {
      updatedAt: new Date(decoded.updatedAt).toISOString(),
      allocationId: decoded.allocationId
    };
  } catch {
    throw new ProviderWorkReadModelError('INVALID_QUERY', 'cursor is invalid.', 422);
  }
}

function principalReferences(principal: ProviderWorkPrincipal, workspaceId: string) {
  return {
    principalReference: `principal:sha256:${providerWorkFingerprint({
      userId: principal.userId,
      workspaceId
    })}`,
    workspaceAuthorityReference: `workspace-membership:sha256:${providerWorkFingerprint({
      membershipId: principal.membershipId,
      workspaceId
    })}`
  };
}

export class ProviderWorkReadModelService {
  constructor(
    private readonly repository: ProviderWorkReadRepository,
    private readonly providerRegistry: ProviderRegistryRepository,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async list(
    principal: Readonly<ProviderWorkPrincipal>,
    query: Readonly<ProviderWorkListQuery> = {}
  ): Promise<ProviderWorkListResultV1> {
    const workspaceId = normalizedWorkspaceId(principal.workspaceId, 'principal.workspaceId');
    const limit = query.limit ?? PROVIDER_WORK_DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > PROVIDER_WORK_MAX_LIMIT)
      throw new ProviderWorkReadModelError(
        'INVALID_QUERY',
        `limit must be between 1 and ${PROVIDER_WORK_MAX_LIMIT}.`,
        422
      );
    const cursor = decodeCursor(query.cursor);
    const checkedAt = this.checkedAt();
    const references = principalReferences(principal, workspaceId);
    try {
      const provider = await this.providerRegistry.findProviderByWorkspaceId(workspaceId);
      if (!provider)
        return {
          schemaVersion: 1,
          providerWorkspaceId: workspaceId,
          ...references,
          checkedAt,
          items: [],
          page: { limit },
          readAuthorityDoesNotAuthorizeMutation: true
        };
      requireSource(
        provider.providerWorkspaceId.toLowerCase() === workspaceId,
        'Provider Registry Workspace binding is inconsistent.'
      );
      const sources = await this.repository.listCurrentProviderWork({
        provider,
        providerWorkspaceId: workspaceId,
        limit: limit + 1,
        ...(cursor ? { cursor } : {})
      });
      const pageSources = sources.slice(0, limit);
      const items = pageSources.map((source) => this.project(provider, source, checkedAt));
      const last = pageSources.at(-1);
      return {
        schemaVersion: 1,
        providerWorkspaceId: workspaceId,
        ...references,
        checkedAt,
        items,
        page: {
          limit,
          ...(sources.length > limit && last
            ? {
                nextCursor: encodeCursor({
                  updatedAt: last.allocationUpdatedAt,
                  allocationId: last.allocationId
                })
              }
            : {})
        },
        readAuthorityDoesNotAuthorizeMutation: true
      };
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async read(
    principal: Readonly<ProviderWorkPrincipal>,
    allocationId: AllocationId
  ): Promise<ProviderWorkItemReadResultV1> {
    const checkedAt = this.checkedAt();
    let workspaceId: string;
    try {
      workspaceId = normalizedWorkspaceId(principal.workspaceId, 'principal.workspaceId');
      if (!allocationId || !allocationId.startsWith('allocation_')) return this.notFound(checkedAt);
      const provider = await this.providerRegistry.findProviderByWorkspaceId(workspaceId);
      if (!provider) return this.notFound(checkedAt);
      requireSource(
        provider.providerWorkspaceId.toLowerCase() === workspaceId,
        'Provider Registry Workspace binding is inconsistent.'
      );
      const source = await this.repository.findCurrentProviderWork({
        provider,
        providerWorkspaceId: workspaceId,
        allocationId
      });
      if (!source) return this.notFound(checkedAt);
      const references = principalReferences(principal, workspaceId);
      return {
        schemaVersion: 1,
        decision: 'AUTHORIZED',
        providerWorkspaceId: workspaceId,
        ...references,
        checkedAt,
        item: this.project(provider, source, checkedAt),
        existenceDisclosed: true,
        readAuthorityDoesNotAuthorizeMutation: true
      };
    } catch (cause) {
      if (cause instanceof ProviderWorkReadModelError && cause.code === 'INVALID_QUERY')
        throw cause;
      return {
        schemaVersion: 1,
        decision: 'SOURCE_UNAVAILABLE',
        checkedAt,
        item: null,
        existenceDisclosed: false,
        retryable: true,
        publicReason: 'Provider work source is temporarily unavailable.',
        readAuthorityDoesNotAuthorizeMutation: true
      };
    }
  }

  private project(
    provider: Readonly<ProviderRegistryRecord>,
    source: Readonly<ProviderWorkProjectionSource>,
    checkedAt: string
  ): ProviderWorkItemSummaryV1 {
    const providerWorkspaceId = provider.providerWorkspaceId.toLowerCase();
    requireSource(
      source.providerId === provider.providerId,
      'Allocation Provider lineage is inconsistent.'
    );
    requireSource(
      source.providerWorkspaceId.toLowerCase() === providerWorkspaceId,
      'Allocation Provider Workspace lineage is inconsistent.'
    );
    requireSource(allocationStatuses.has(source.allocationStatus), 'Allocation status is invalid.');
    const allocationVersion = exactPositiveVersion(source.allocationVersion, 'Allocation version');
    const allocationUpdatedAt = exactTimestamp(source.allocationUpdatedAt, 'Allocation updatedAt');
    const originatingWorkspaceId = normalizedWorkspaceId(
      source.originatingWorkspaceId,
      'originatingWorkspaceId'
    );
    const packageVersion = exactPositiveVersion(
      source.allocationServicePackageVersion,
      'Allocation Service Package version'
    );
    const packageFingerprint = exactSha256(
      source.allocationServicePackageFingerprintSha256,
      'Allocation Service Package fingerprint'
    );
    requireSource(
      source.servicePackageId === source.allocationServicePackageId &&
        source.servicePackageVersion === packageVersion &&
        source.servicePackageFingerprintSha256 === packageFingerprint &&
        source.servicePackageWorkspaceId?.toLowerCase() === originatingWorkspaceId,
      'Referenced Service Package lineage is missing or inconsistent.'
    );

    const allocationFingerprint = providerWorkFingerprint({
      allocationId: source.allocationId,
      version: allocationVersion,
      status: source.allocationStatus,
      updatedAt: allocationUpdatedAt,
      providerId: source.providerId,
      providerWorkspaceId,
      originatingWorkspaceId,
      servicePackageId: source.allocationServicePackageId,
      servicePackageVersion: packageVersion,
      servicePackageFingerprint: packageFingerprint
    });
    const allocationScope = { providerId: provider.providerId, allocationId: source.allocationId };
    const packageScope = {
      providerId: provider.providerId,
      servicePackageId: source.allocationServicePackageId,
      version: packageVersion
    };

    const checks: ProviderWorkSourceCheckV1[] = [
      sourceCheck('ALLOCATION', 'CURRENT', checkedAt, allocationScope, {
        reference: source.allocationId,
        version: allocationVersion,
        fingerprint: allocationFingerprint
      }),
      sourceCheck('SERVICE_PACKAGE', 'CURRENT', checkedAt, packageScope, {
        reference: source.allocationServicePackageId,
        version: packageVersion,
        fingerprint: packageFingerprint
      })
    ];

    let responseState: ProviderWorkItemSummaryV1['responseState'];
    const acceptanceScope = { providerId: provider.providerId, allocationId: source.allocationId };
    if (source.providerAcceptanceId === undefined) {
      const absenceFingerprint = providerWorkFingerprint(acceptanceScope);
      responseState = {
        kind: 'KNOWN_ABSENT',
        checkedAt,
        absenceScopeFingerprintSha256: absenceFingerprint,
        allocationActiveDoesNotImplyPendingResponse: true
      };
      checks.push(sourceCheck('PROVIDER_ACCEPTANCE', 'KNOWN_ABSENT', checkedAt, acceptanceScope));
    } else {
      const responseVersion = exactPositiveVersion(
        source.providerAcceptanceVersion,
        'Provider Acceptance version'
      );
      requireSource(
        source.acceptanceAllocationId === source.allocationId &&
          source.acceptanceServicePackageId === source.allocationServicePackageId &&
          source.acceptanceServicePackageVersion === packageVersion &&
          source.acceptanceProviderId === provider.providerId &&
          source.acceptanceProviderWorkspaceId?.toLowerCase() === providerWorkspaceId &&
          source.acceptanceDecision !== undefined &&
          acceptanceDecisions.has(source.acceptanceDecision),
        'Provider Acceptance lineage is inconsistent.'
      );
      const respondedAt = exactTimestamp(
        source.acceptanceRespondedAt,
        'Provider Acceptance respondedAt'
      );
      const responseFingerprint = exactSha256(
        source.acceptanceFingerprintSha256,
        'Provider Acceptance fingerprint'
      );
      responseState = {
        kind: 'KNOWN_RESPONSE',
        response: { id: source.providerAcceptanceId, version: responseVersion },
        decision: source.acceptanceDecision,
        respondedAt,
        responseFingerprintSha256: responseFingerprint
      };
      checks.push(
        sourceCheck('PROVIDER_ACCEPTANCE', 'CURRENT', checkedAt, acceptanceScope, {
          reference: source.providerAcceptanceId,
          version: responseVersion,
          fingerprint: responseFingerprint
        })
      );
    }

    let returnState: ProviderWorkItemSummaryV1['returnState'];
    const returnScope = { providerId: provider.providerId, allocationId: source.allocationId };
    if (source.providerReturnId === undefined) {
      const absenceFingerprint = providerWorkFingerprint(returnScope);
      returnState = {
        kind: 'KNOWN_ABSENT',
        checkedAt,
        absenceScopeFingerprintSha256: absenceFingerprint
      };
      checks.push(sourceCheck('PROVIDER_RETURN', 'KNOWN_ABSENT', checkedAt, returnScope));
    } else {
      const returnVersion = exactPositiveVersion(
        source.providerReturnVersion,
        'Provider Return version'
      );
      requireSource(
        source.returnAllocationId === source.allocationId &&
          source.returnServicePackageId === source.allocationServicePackageId &&
          source.returnServicePackageVersion === packageVersion &&
          source.returnProviderId === provider.providerId &&
          source.returnProviderWorkspaceId?.toLowerCase() === providerWorkspaceId &&
          source.returnStatus !== undefined &&
          returnStatuses.has(source.returnStatus) &&
          source.returnStatus === 'CURRENT',
        'Provider Return lineage is inconsistent.'
      );
      const submittedAt = exactTimestamp(source.returnSubmittedAt, 'Provider Return submittedAt');
      const returnFingerprint = exactSha256(
        source.returnFingerprintSha256,
        'Provider Return fingerprint'
      );
      returnState = {
        kind: 'KNOWN_RETURN',
        providerReturn: { id: source.providerReturnId, version: returnVersion },
        status: source.returnStatus,
        submittedAt,
        returnFingerprintSha256: returnFingerprint,
        providerReturnRemainsClaimEvidenceNotOfficialTruth: true
      };
      checks.push(
        sourceCheck('PROVIDER_RETURN', 'CURRENT', checkedAt, returnScope, {
          reference: source.providerReturnId,
          version: returnVersion,
          fingerprint: returnFingerprint
        })
      );
    }

    const incomingAuthorityScope = {
      providerId: provider.providerId,
      allocationId: source.allocationId,
      authoritySource: 'NOT_ESTABLISHED'
    };
    checks.push(
      sourceCheck('INCOMING_DATA_AUTHORITY', 'UNAVAILABLE', checkedAt, incomingAuthorityScope)
    );
    const fingerprintChecks = checks.map((check) => withoutCheckedAt(check));
    const sourceSetFingerprintSha256 = providerWorkFingerprint(fingerprintChecks);
    const boundedProjection = {
      provider: { providerId: provider.providerId, providerWorkspaceId },
      allocation: {
        allocationId: source.allocationId,
        version: allocationVersion,
        status: source.allocationStatus,
        updatedAt: allocationUpdatedAt
      },
      servicePackage: {
        id: source.allocationServicePackageId,
        version: packageVersion,
        fingerprint: packageFingerprint
      },
      origin: {
        originatingWorkspaceId,
        professionalReference: `workspace:${originatingWorkspaceId}`
      },
      responseState: withoutCheckedAt(responseState),
      returnState: withoutCheckedAt(returnState),
      incomingDataAuthority: {
        state: 'UNKNOWN',
        reason: 'AUTHORITY_STATE_NOT_ESTABLISHED'
      },
      sourceSetFingerprintSha256
    };
    const projectionFingerprintSha256 = providerWorkFingerprint(boundedProjection);

    return {
      schemaVersion: 1,
      provider: { providerId: provider.providerId, providerWorkspaceId },
      allocation: boundedProjection.allocation,
      servicePackage: {
        servicePackage: { id: source.allocationServicePackageId, version: packageVersion },
        servicePackageFingerprintSha256: packageFingerprint
      },
      origin: {
        originatingWorkspaceId,
        professionalReference: `workspace:${originatingWorkspaceId}`,
        exposureClass: 'ORIGINATING_PROFESSIONAL_REFERENCE_ONLY'
      },
      responseState,
      returnState,
      incomingDataAuthority: {
        state: 'UNKNOWN',
        checkedAt,
        reason: 'AUTHORITY_STATE_NOT_ESTABLISHED',
        incomingFieldsVisible: false,
        embeddedPrivateFieldValues: false
      },
      sourceChecks: checks,
      sourceSetFingerprintSha256,
      projectionFingerprintSha256,
      projectedAt: checkedAt,
      privacyExclusions: providerWorkPrivacyExclusionsV1,
      authorityConsequences: noProviderWorkReadModelAuthorityConsequences,
      allocationIsExistingM4TruthNotCreatedByProjection: true,
      queuePresenceIsNotActionAuthority: true
    };
  }

  private checkedAt(): string {
    const value = this.now();
    if (!Number.isFinite(Date.parse(value)))
      throw new ProviderWorkReadModelError(
        'PERSISTENCE_UNAVAILABLE',
        'Projection clock is invalid.',
        503
      );
    return new Date(value).toISOString();
  }

  private notFound(checkedAt: string): ProviderWorkItemReadResultV1 {
    return {
      schemaVersion: 1,
      decision: 'NOT_FOUND_OR_NOT_AUTHORIZED',
      checkedAt,
      item: null,
      existenceDisclosed: false,
      publicReason: 'Provider work item was not found or is not available to this Workspace.',
      readAuthorityDoesNotAuthorizeMutation: true
    };
  }

  private unavailable(cause: unknown): ProviderWorkReadModelError {
    if (cause instanceof ProviderWorkReadModelError) return cause;
    return new ProviderWorkReadModelError(
      'PERSISTENCE_UNAVAILABLE',
      'Provider work persistence is unavailable.',
      503,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
}
