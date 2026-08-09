import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  AllocationId,
  CreateProviderReturnCommand,
  EvidenceHandoffReference,
  HandoffProviderReturnEvidenceCommand,
  ProviderAcceptanceId,
  ProviderAssertion,
  ProviderExecutionErrorCode,
  ProviderReturn,
  ProviderReturnArtifact,
  ProviderReturnId
} from '@markorbit/contracts/provider-execution';
import type {
  AllocationProviderAcceptanceRepository,
  AllocationRecord,
  AuthenticatedProviderPrincipal,
  ProviderAcceptanceRecord
} from './allocation-provider-acceptance.js';
import type { ProviderRegistryRepository } from './provider-registry.js';
import type {
  ServicePackageEligibilityRepository,
  ServicePackageRecord
} from './service-package-eligibility.js';

export interface ProviderReturnRecord extends ProviderReturn {
  providerActorId: string;
}

export interface ProviderReturnReplay {
  fingerprint: string;
  providerReturnId: ProviderReturnId;
  responseVersion: number;
  responseRecord: ProviderReturnRecord;
}

export interface ProviderReturnRepository {
  findReplay(scopeKey: string, idempotencyKey: string): Promise<ProviderReturnReplay | undefined>;
  findProviderReturn(
    providerReturnId: ProviderReturnId,
    version?: number
  ): Promise<ProviderReturnRecord | undefined>;
  findCurrentProviderReturnForAllocation(
    allocationId: AllocationId
  ): Promise<ProviderReturnRecord | undefined>;
  saveProviderReturn(
    record: ProviderReturnRecord,
    expectedSuperseded: ProviderReturnRecord | undefined,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProviderReturnRecord>;
}

export interface ProviderReturnEvidenceHandoffTarget {
  handoffProviderReturnEvidence(input: {
    command: Readonly<HandoffProviderReturnEvidenceCommand>;
    providerReturn: Readonly<ProviderReturnRecord>;
  }): Promise<EvidenceHandoffReference>;
}

export type ProviderReturnErrorCode =
  | ProviderExecutionErrorCode
  | 'INVALID_INPUT'
  | 'SERVICE_PACKAGE_NOT_FOUND'
  | 'ALLOCATION_NOT_FOUND'
  | 'PROVIDER_ACCEPTANCE_NOT_FOUND'
  | 'PROVIDER_RETURN_NOT_FOUND';

export class ProviderReturnError extends Error {
  constructor(
    public readonly code: ProviderReturnErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'ProviderReturnError';
  }
}

export interface CreateProviderReturnServiceCommand extends CreateProviderReturnCommand {
  principal: Readonly<AuthenticatedProviderPrincipal>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function cleanText(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new ProviderReturnError('INVALID_INPUT', `${field} is required.`, 422);
  return cleaned;
}

function cleanWorkspaceId(value: string, field = 'workspaceId'): string {
  const cleaned = value.trim().toLowerCase();
  if (!uuidPattern.test(cleaned))
    throw new ProviderReturnError('INVALID_INPUT', `${field} must be a Core Workspace UUID.`, 422);
  return cleaned;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!sha256Pattern.test(cleaned))
    throw new ProviderReturnError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function normalizeArtifacts(values: ReadonlyArray<Readonly<ProviderReturnArtifact>>) {
  return values.map((value, index) => {
    const reference = cleanText(value.reference, `artifacts[${index}].reference`);
    const fileName = value.fileName?.trim();
    const mediaType = value.mediaType?.trim();
    const sha256 = value.sha256 ? exactSha256(value.sha256, `artifacts[${index}].sha256`) : undefined;
    return {
      reference,
      ...(fileName ? { fileName } : {}),
      ...(mediaType ? { mediaType } : {}),
      ...(sha256 ? { sha256 } : {})
    };
  });
}

function normalizeAssertions(values: ReadonlyArray<Readonly<ProviderAssertion>>) {
  return values.map((value, index) => ({
    code: cleanText(value.code, `assertions[${index}].code`),
    value: value.value,
    evidenceReferences: value.evidenceReferences.map((reference, evidenceIndex) =>
      cleanText(reference, `assertions[${index}].evidenceReferences[${evidenceIndex}]`)
    )
  }));
}

function returnScope(workspaceId: string, allocationId: AllocationId) {
  return `provider-return:${workspaceId}:${allocationId}`;
}

export class ProviderReturnService {
  constructor(
    private readonly repository: ProviderReturnRepository,
    private readonly allocationAcceptance: AllocationProviderAcceptanceRepository,
    private readonly servicePackages: ServicePackageEligibilityRepository,
    private readonly providerRegistry: ProviderRegistryRepository,
    private readonly evidenceHandoff: ProviderReturnEvidenceHandoffTarget,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly providerReturnIdFactory: () => ProviderReturnId = () =>
      `provider-return_${randomUUID()}`
  ) {}

  async createProviderReturn(
    command: CreateProviderReturnServiceCommand
  ): Promise<ProviderReturnRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const providerWorkspaceId = cleanWorkspaceId(
      command.principal.providerWorkspaceId,
      'principal.providerWorkspaceId'
    );
    const providerActorId = cleanText(command.principal.actorId, 'principal.actorId');
    const workStatusClaim = cleanText(command.workStatusClaim, 'workStatusClaim');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const artifacts = normalizeArtifacts(command.artifacts);
    const assertions = normalizeAssertions(command.assertions);
    if (!artifacts.length && !assertions.length)
      throw new ProviderReturnError(
        'INVALID_INPUT',
        'Provider Return must contain at least one artifact or structured assertion.',
        422
      );

    const scopeKey = returnScope(workspaceId, command.allocationId);
    const requestFingerprint = fingerprint({
      command: 'CREATE_PROVIDER_RETURN',
      workspaceId,
      allocationId: command.allocationId,
      expectedAllocationVersion: command.expectedAllocationVersion,
      providerAcceptanceId: command.providerAcceptanceId,
      expectedProviderAcceptanceVersion: command.expectedProviderAcceptanceVersion,
      servicePackageId: command.servicePackageId,
      expectedServicePackageVersion: command.expectedServicePackageVersion,
      workStatusClaim,
      artifacts,
      assertions,
      supersedes: command.supersedes,
      providerWorkspaceId,
      providerActorId,
      correlationId: command.correlationId
    });
    const replay = await this.repository.findReplay(scopeKey, idempotencyKey);
    if (replay) {
      if (replay.fingerprint !== requestFingerprint)
        throw new ProviderReturnError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different Provider Return payload.',
          409
        );
      return replay.responseRecord;
    }

    const allocation = await this.requireAcceptedAllocation(
      command.allocationId,
      command.expectedAllocationVersion,
      workspaceId,
      command.correlationId
    );
    const acceptance = await this.requireAcceptance(
      command.providerAcceptanceId,
      command.expectedProviderAcceptanceVersion,
      allocation,
      providerWorkspaceId,
      command.correlationId
    );
    const servicePackage = await this.requireServicePackage(
      command.servicePackageId,
      command.expectedServicePackageVersion,
      allocation,
      workspaceId,
      command.correlationId
    );

    const provider = await this.providerRegistry.findProviderByWorkspaceId(providerWorkspaceId);
    if (!provider || provider.providerId !== allocation.provider.providerId)
      throw new ProviderReturnError(
        'PROVIDER_IDENTITY_MISMATCH',
        'Authenticated Provider identity does not match the accepted Allocation.',
        403
      );
    if (provider.operationalStatus !== 'ACTIVE')
      throw new ProviderReturnError('PROVIDER_SUSPENDED', 'Provider is not operationally active.', 409);

    const current = await this.repository.findCurrentProviderReturnForAllocation(allocation.allocationId);
    let superseded: ProviderReturnRecord | undefined;
    let providerReturnId = this.providerReturnIdFactory();
    let version = 1;
    if (command.supersedes) {
      superseded = await this.repository.findProviderReturn(
        command.supersedes.id,
        Number(command.supersedes.version)
      );
      if (!superseded || !current || current.providerReturnId !== superseded.providerReturnId)
        throw new ProviderReturnError(
          'RETURN_SUPERSEDED',
          'The requested Provider Return version is not the current return.',
          409
        );
      if (
        superseded.version !== Number(command.supersedes.version) ||
        current.version !== superseded.version
      )
        throw new ProviderReturnError(
          'RETURN_SUPERSEDED',
          'The requested Provider Return version has already been superseded.',
          409
        );
      this.assertSameReturnLineage(superseded, allocation, acceptance, servicePackage);
      providerReturnId = superseded.providerReturnId;
      version = superseded.version + 1;
    } else if (current) {
      throw new ProviderReturnError(
        'VERSION_CONFLICT',
        'A current Provider Return already exists; correction must explicitly supersede it.',
        409
      );
    }

    const submittedAt = this.now();
    const returnFingerprintSha256 = fingerprint({
      providerReturnId,
      version,
      workspaceId,
      servicePackage: { id: servicePackage.servicePackageId, version: servicePackage.version },
      allocation: { id: allocation.allocationId, version: allocation.version },
      providerAcceptance: {
        id: acceptance.providerAcceptanceId,
        version: acceptance.version
      },
      providerId: provider.providerId,
      providerWorkspaceId,
      providerActorId,
      workStatusClaim,
      artifacts,
      assertions,
      supersedes: command.supersedes,
      correlationId: command.correlationId
    });
    const record: ProviderReturnRecord = {
      schemaVersion: 1,
      providerReturnId,
      workspaceId,
      version,
      servicePackage: { id: servicePackage.servicePackageId, version: servicePackage.version },
      allocation: { id: allocation.allocationId, version: allocation.version },
      providerAcceptance: {
        id: acceptance.providerAcceptanceId,
        version: acceptance.version
      },
      providerId: provider.providerId,
      providerWorkspaceId,
      providerActorId,
      workStatusClaim,
      artifacts,
      assertions,
      returnFingerprintSha256,
      status: 'CURRENT',
      ...(command.supersedes
        ? {
            supersedes: {
              id: command.supersedes.id,
              version: Number(command.supersedes.version)
            }
          }
        : {}),
      submittedAt,
      correlationId: command.correlationId
    };
    return this.repository.saveProviderReturn(
      record,
      superseded,
      scopeKey,
      idempotencyKey,
      requestFingerprint
    );
  }

  async handoffProviderReturnEvidence(
    command: HandoffProviderReturnEvidenceCommand
  ): Promise<EvidenceHandoffReference> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const expectedFingerprint = exactSha256(
      command.expectedProviderReturnFingerprintSha256,
      'expectedProviderReturnFingerprintSha256'
    );
    const providerReturn = await this.repository.findProviderReturn(command.providerReturnId);
    if (!providerReturn)
      throw new ProviderReturnError('PROVIDER_RETURN_NOT_FOUND', 'Provider Return was not found.', 404);
    if (providerReturn.workspaceId !== workspaceId)
      throw new ProviderReturnError('PERMISSION_DENIED', 'Provider Return belongs to another Workspace.', 403);
    if (providerReturn.version !== command.expectedProviderReturnVersion)
      throw new ProviderReturnError(
        'RETURN_SUPERSEDED',
        'Provider Return version is no longer current.',
        409
      );
    if (providerReturn.returnFingerprintSha256 !== expectedFingerprint)
      throw new ProviderReturnError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Provider Return fingerprint does not match the current return.',
        409
      );
    if (providerReturn.status !== 'CURRENT')
      throw new ProviderReturnError('RETURN_SUPERSEDED', 'Provider Return is not current.', 409);
    if (providerReturn.correlationId !== command.correlationId)
      throw new ProviderReturnError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Provider Return.',
        409
      );

    const servicePackage = await this.servicePackages.findServicePackage(providerReturn.servicePackage.id);
    if (!servicePackage || servicePackage.version !== Number(providerReturn.servicePackage.version))
      throw new ProviderReturnError('STALE_SOURCE', 'Service Package source is no longer exact.', 409);
    if (
      servicePackage.source.executionRelease.id !== command.executionReleaseId ||
      String(servicePackage.source.executionRelease.version) !== String(command.expectedExecutionReleaseVersion) ||
      servicePackage.source.filingExecutionTaskDraft.id !== command.filingExecutionTaskDraftId ||
      String(servicePackage.source.filingExecutionTaskDraft.version) !==
        String(command.expectedFilingExecutionTaskDraftVersion)
    )
      throw new ProviderReturnError(
        'SOURCE_VERSION_MISMATCH',
        'Execution evidence handoff does not match the exact admitted Execution source.',
        409
      );

    return this.evidenceHandoff.handoffProviderReturnEvidence({
      command: { ...command, workspaceId, idempotencyKey },
      providerReturn
    });
  }

  getProviderReturn(providerReturnId: ProviderReturnId, version?: number) {
    return this.repository.findProviderReturn(providerReturnId, version);
  }

  private async requireAcceptedAllocation(
    allocationId: AllocationId,
    expectedVersion: number,
    workspaceId: string,
    correlationId: MarkOrbitId
  ) {
    const allocation = await this.allocationAcceptance.findAllocation(allocationId);
    if (!allocation)
      throw new ProviderReturnError('ALLOCATION_NOT_FOUND', 'Allocation was not found.', 404);
    if (allocation.workspaceId !== workspaceId)
      throw new ProviderReturnError('PERMISSION_DENIED', 'Allocation belongs to another Workspace.', 403);
    if (allocation.version !== expectedVersion || allocation.status !== 'ACTIVE')
      throw new ProviderReturnError('ALLOCATION_NOT_CURRENT', 'Allocation is not current and active.', 409);
    if (allocation.correlationId !== correlationId)
      throw new ProviderReturnError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Allocation.',
        409
      );
    return allocation;
  }

  private async requireAcceptance(
    providerAcceptanceId: ProviderAcceptanceId,
    expectedVersion: number,
    allocation: AllocationRecord,
    providerWorkspaceId: string,
    correlationId: MarkOrbitId
  ) {
    const acceptance = await this.allocationAcceptance.findProviderAcceptance(providerAcceptanceId);
    if (!acceptance)
      throw new ProviderReturnError(
        'PROVIDER_ACCEPTANCE_NOT_FOUND',
        'Provider Acceptance was not found.',
        404
      );
    if (
      acceptance.version !== expectedVersion ||
      acceptance.decision !== 'ACCEPTED' ||
      acceptance.allocation.id !== allocation.allocationId ||
      Number(acceptance.allocation.version) !== allocation.version ||
      acceptance.providerId !== allocation.provider.providerId ||
      acceptance.providerWorkspaceId !== providerWorkspaceId
    )
      throw new ProviderReturnError(
        'ALLOCATION_NOT_CURRENT',
        'Provider Return requires the exact authenticated ACCEPTED Allocation.',
        409
      );
    if (acceptance.correlationId !== correlationId)
      throw new ProviderReturnError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match Provider Acceptance.',
        409
      );
    return acceptance;
  }

  private async requireServicePackage(
    servicePackageId: CreateProviderReturnCommand['servicePackageId'],
    expectedVersion: number,
    allocation: AllocationRecord,
    workspaceId: string,
    correlationId: MarkOrbitId
  ) {
    const servicePackage = await this.servicePackages.findServicePackage(servicePackageId);
    if (!servicePackage)
      throw new ProviderReturnError('SERVICE_PACKAGE_NOT_FOUND', 'Service Package was not found.', 404);
    if (
      servicePackage.workspaceId !== workspaceId ||
      servicePackage.servicePackageId !== allocation.servicePackage.id
    )
      throw new ProviderReturnError('PERMISSION_DENIED', 'Service Package lineage does not match.', 403);
    if (
      servicePackage.version !== expectedVersion ||
      Number(allocation.servicePackage.version) !== expectedVersion ||
      servicePackage.status !== 'ADMITTED'
    )
      throw new ProviderReturnError('STALE_SOURCE', 'Service Package is no longer current.', 409);
    if (servicePackage.source.correlationId !== correlationId)
      throw new ProviderReturnError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Service Package.',
        409
      );
    return servicePackage;
  }

  private assertSameReturnLineage(
    previous: ProviderReturnRecord,
    allocation: AllocationRecord,
    acceptance: ProviderAcceptanceRecord,
    servicePackage: ServicePackageRecord
  ) {
    if (
      previous.allocation.id !== allocation.allocationId ||
      Number(previous.allocation.version) !== allocation.version ||
      previous.providerAcceptance.id !== acceptance.providerAcceptanceId ||
      Number(previous.providerAcceptance.version) !== acceptance.version ||
      previous.servicePackage.id !== servicePackage.servicePackageId ||
      Number(previous.servicePackage.version) !== servicePackage.version ||
      previous.providerId !== allocation.provider.providerId
    )
      throw new ProviderReturnError(
        'SOURCE_VERSION_MISMATCH',
        'Provider Return correction cannot change accepted source lineage.',
        409
      );
  }
}
