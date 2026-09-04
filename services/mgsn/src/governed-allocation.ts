import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  ControlledHandoffConsumptionAttemptV1,
  ControlledHandoffCurrentValidationV1,
  ControlledHandoffEnvelopeV1,
  ControlledHandoffVersionReferenceV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  ProviderSelectionCurrentValidationV1,
  ProviderSelectionScopeReferenceV1,
  ProviderSelectionV1,
  ProviderSelectionVersionReferenceV1
} from '@markorbit/contracts/provider-selection';
import type { ProviderId, ProviderSupplyCapabilityId } from '@markorbit/contracts/provider-execution';
import type {
  AllocateProviderServiceCommand,
  AllocationRecord
} from './allocation-provider-acceptance.js';
import type {
  ControlledHandoffRepository,
  ControlledHandoffService
} from './controlled-privacy-handoff.js';
import type {
  ProviderSelectionRepository,
  ProviderSelectionService
} from './provider-selection.js';

export type GovernedAllocationHandoffBinding =
  | Readonly<{ mode: 'NONE_EXPLICIT' }>
  | Readonly<{
      mode: 'EXACT';
      handoff: Readonly<ControlledHandoffVersionReferenceV1>;
    }>;

export interface GovernedAllocationCommand extends AllocateProviderServiceCommand {
  selection: Readonly<ProviderSelectionVersionReferenceV1>;
  selectionScope: Readonly<ProviderSelectionScopeReferenceV1>;
  handoffBinding: GovernedAllocationHandoffBinding;
}

export interface GovernedAllocationDirectExecutorAuthority {
  established: true;
  providerId: ProviderId;
  providerWorkspaceId: string;
  authorityReference: string;
  authorityVersion: number | string;
  checkedAt: string;
  validationFingerprintSha256: string;
}

export interface GovernedAllocationDirectExecutorSource {
  assessCurrent(input: {
    providerId: ProviderId;
    providerWorkspaceId: string;
    checkedAt: string;
  }): Promise<Readonly<GovernedAllocationDirectExecutorAuthority> | undefined>;
}

/**
 * Planner performs the exact existing M4 Allocation preflight without committing.
 * The governed path must never call legacy allocateProvider() and then append lineage.
 */
export interface GovernedAllocationPlanner {
  plan(command: AllocateProviderServiceCommand): Promise<Readonly<AllocationRecord>>;
}

export interface AllocationAdmissionLineageRecord {
  allocationAdmissionLineageId: `allocation-admission-lineage_${string}`;
  version: 1;
  allocationId: string;
  allocationVersion: number;
  originatingWorkspaceId: string;
  servicePackageId: string;
  servicePackageVersion: number;
  servicePackageFingerprintSha256: string;
  providerId: ProviderId;
  providerWorkspaceId: string;
  providerSupplyCapabilityId: ProviderSupplyCapabilityId;
  providerSupplyCapabilityVersion: number;
  providerSupplyCapabilityFingerprintSha256: string;
  providerSelectionId: string;
  selectionVersion: number;
  selectionScopeVersion: number;
  selectionScopeFingerprintSha256: string;
  selectionValidation: Readonly<ProviderSelectionCurrentValidationV1>;
  selectionValidationFingerprintSha256: string;
  directExecutor: Readonly<GovernedAllocationDirectExecutorAuthority>;
  handoffBindingState: 'NO_CONTROLLED_HANDOFF_BY_DESIGN' | 'EXACT_CONTROLLED_HANDOFF';
  handoff?: Readonly<{
    envelope: ControlledHandoffEnvelopeV1;
    validation: ControlledHandoffCurrentValidationV1;
    validationFingerprintSha256: string;
  }>;
  lineageFingerprintSha256: string;
  correlationId: string;
  createdAt: string;
}

export interface GovernedAllocationReplay {
  requestFingerprintSha256: string;
  allocation: Readonly<AllocationRecord>;
  lineage: Readonly<AllocationAdmissionLineageRecord>;
}

export interface GovernedAllocationRepository {
  findReplay(scopeKey: string, idempotencyKey: string): Promise<GovernedAllocationReplay | undefined>;
  commit(input: {
    allocation: Readonly<AllocationRecord>;
    lineage: Readonly<AllocationAdmissionLineageRecord>;
    scopeKey: string;
    idempotencyKey: string;
    requestFingerprintSha256: string;
    actorId: string;
  }): Promise<GovernedAllocationReplay | undefined>;
}

export type GovernedAllocationErrorCode =
  | 'INVALID_INPUT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SELECTION_NOT_CURRENT'
  | 'SELECTION_MISMATCH'
  | 'DIRECT_EXECUTOR_NOT_CURRENT'
  | 'HANDOFF_NOT_CURRENT'
  | 'HANDOFF_MISMATCH'
  | 'AUTHORITY_UNAVAILABLE';

export class GovernedAllocationError extends Error {
  constructor(
    public readonly code: GovernedAllocationErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'GovernedAllocationError';
  }
}

const sha256Pattern = /^[0-9a-f]{64}$/;

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

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function exactSelectionReference(
  selection: Readonly<ProviderSelectionV1>,
  reference: Readonly<ProviderSelectionVersionReferenceV1>
): boolean {
  return (
    selection.providerSelectionId === reference.providerSelectionId &&
    selection.version === reference.version &&
    selection.scopeVersion === reference.scopeVersion
  );
}

function exactScope(
  left: Readonly<ProviderSelectionScopeReferenceV1>,
  right: Readonly<ProviderSelectionScopeReferenceV1>
): boolean {
  return (
    left.owner === right.owner &&
    left.reference === right.reference &&
    left.version === right.version &&
    left.fingerprintSha256 === right.fingerprintSha256
  );
}

function scopeKey(workspaceId: string, servicePackageId: string): string {
  return `allocation-admission-lineage:${workspaceId.toLowerCase()}:${servicePackageId}`;
}

function requireSha256(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!sha256Pattern.test(normalized)) {
    throw new GovernedAllocationError('INVALID_INPUT', `${field} must be a SHA-256 fingerprint.`, 422);
  }
  return normalized;
}

function sameHandoffSelection(
  envelope: Readonly<ControlledHandoffEnvelopeV1>,
  selection: Readonly<ProviderSelectionVersionReferenceV1>
): boolean {
  const source = envelope.sourceLineage.selectionLineage.selection;
  return (
    source.providerSelectionId === selection.providerSelectionId &&
    source.version === selection.version &&
    source.scopeVersion === selection.scopeVersion
  );
}

/**
 * Exact explicit-human-choice bridge into M4 Allocation.
 *
 * Selection and Handoff validations are prerequisites only. They do not allocate, accept, contact,
 * appoint, release, file, pay or create Official Truth. Only repository.commit may create the M4
 * Allocation and its admission lineage, atomically.
 */
export class GovernedAllocationService {
  constructor(
    private readonly planner: GovernedAllocationPlanner,
    private readonly repository: GovernedAllocationRepository,
    private readonly selections: ProviderSelectionRepository,
    private readonly selectionService: ProviderSelectionService,
    private readonly handoffs: ControlledHandoffRepository,
    private readonly handoffService: ControlledHandoffService,
    private readonly directExecutor: GovernedAllocationDirectExecutorSource,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextLineageId: () => `allocation-admission-lineage_${string}` = () =>
      `allocation-admission-lineage_${randomUUID()}`
  ) {}

  async allocate(command: GovernedAllocationCommand): Promise<GovernedAllocationReplay> {
    const workspaceId = command.workspaceId.trim().toLowerCase();
    const idempotencyKey = command.idempotencyKey.trim();
    const actorId = command.actorId.trim();
    if (!workspaceId || !idempotencyKey || !actorId) {
      throw new GovernedAllocationError('INVALID_INPUT', 'Workspace, actor and idempotency are required.', 422);
    }
    requireSha256(command.selectionScope.fingerprintSha256, 'selectionScope.fingerprintSha256');

    const requestFingerprintSha256 = fingerprint({
      command: 'GOVERNED_ALLOCATE_PROVIDER',
      ...command,
      workspaceId,
      actorId
    });
    const replayScope = scopeKey(workspaceId, command.servicePackageId);
    const replay = await this.repository.findReplay(replayScope, idempotencyKey);
    if (replay) {
      if (replay.requestFingerprintSha256 !== requestFingerprintSha256) {
        throw new GovernedAllocationError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different Selection/Handoff lineage or Allocation payload.',
          409
        );
      }
      return replay;
    }

    const selected = await this.selections.findLatestSelection(command.selection.providerSelectionId);
    if (
      !selected ||
      selected.requesterWorkspaceId.toLowerCase() !== workspaceId ||
      selected.status !== 'CURRENT' ||
      !exactSelectionReference(selected, command.selection) ||
      !exactScope(selected.scope, command.selectionScope)
    ) {
      throw new GovernedAllocationError(
        'SELECTION_MISMATCH',
        'The exact current Human Provider Selection does not match this governed Allocation.',
        409
      );
    }

    const selectionValidation = await this.selectionService.validateCurrent(
      { workspaceId },
      {
        scope: command.selectionScope,
        providerSelectionId: command.selection.providerSelectionId,
        purpose: 'ALLOCATION_PREREQUISITE_REVIEW'
      }
    );
    if (
      selectionValidation.decision !== 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW' ||
      selectionValidation.currentlyUsable !== true
    ) {
      throw new GovernedAllocationError(
        'SELECTION_NOT_CURRENT',
        'Human Provider Selection is not currently usable for Allocation prerequisite review.',
        selectionValidation.denialReason === 'AUTHORITY_UNAVAILABLE' ? 503 : 409
      );
    }

    const selectedProvider = selected.sourceLineage.provider;
    const selectedSupply = selected.sourceLineage.providerSupplyCapability;
    if (
      selectedProvider.providerId !== command.providerId ||
      selectedSupply.id !== command.providerSupplyCapabilityId ||
      selectedSupply.version !== command.expectedProviderSupplyCapabilityVersion
    ) {
      throw new GovernedAllocationError(
        'SELECTION_MISMATCH',
        'Allocation target does not exactly match the Human Provider Selection.',
        409
      );
    }

    const checkedAt = this.now();
    const directExecutor = await this.directExecutor.assessCurrent({
      providerId: selectedProvider.providerId,
      providerWorkspaceId: selectedProvider.providerWorkspaceId,
      checkedAt
    });
    if (
      !directExecutor ||
      directExecutor.established !== true ||
      directExecutor.providerId !== selectedProvider.providerId ||
      directExecutor.providerWorkspaceId.toLowerCase() !== selectedProvider.providerWorkspaceId.toLowerCase()
    ) {
      throw new GovernedAllocationError(
        'DIRECT_EXECUTOR_NOT_CURRENT',
        'Current Direct Executor authority is not established for the selected Provider.',
        409
      );
    }
    requireSha256(directExecutor.validationFingerprintSha256, 'directExecutor.validationFingerprintSha256');

    const handoff = await this.validateHandoff(command, selected, checkedAt);
    const allocation = await this.planner.plan(command);
    if (
      allocation.workspaceId.toLowerCase() !== workspaceId ||
      allocation.provider.providerId !== selectedProvider.providerId ||
      allocation.provider.providerWorkspaceId.toLowerCase() !== selectedProvider.providerWorkspaceId.toLowerCase() ||
      allocation.providerSupplyCapability.id !== selectedSupply.id ||
      allocation.providerSupplyCapability.version !== selectedSupply.version ||
      allocation.providerSupplyCapabilityFingerprintSha256 !== selectedSupply.fingerprintSha256
    ) {
      throw new GovernedAllocationError(
        'SELECTION_MISMATCH',
        'Planned M4 Allocation drifted from the exact Human Provider Selection.',
        409
      );
    }

    const selectionValidationFingerprintSha256 = fingerprint(selectionValidation);
    const lineageBase = {
      allocationId: allocation.allocationId,
      allocationVersion: allocation.version,
      originatingWorkspaceId: workspaceId,
      servicePackageId: allocation.servicePackage.id,
      servicePackageVersion: Number(allocation.servicePackage.version),
      servicePackageFingerprintSha256: allocation.servicePackageFingerprintSha256,
      providerId: allocation.provider.providerId,
      providerWorkspaceId: allocation.provider.providerWorkspaceId,
      providerSupplyCapabilityId: allocation.providerSupplyCapability.id,
      providerSupplyCapabilityVersion: Number(allocation.providerSupplyCapability.version),
      providerSupplyCapabilityFingerprintSha256: allocation.providerSupplyCapabilityFingerprintSha256,
      providerSelectionId: selected.providerSelectionId,
      selectionVersion: selected.version,
      selectionScopeVersion: selected.scopeVersion,
      selectionScopeFingerprintSha256: selected.scope.fingerprintSha256,
      selectionValidation,
      selectionValidationFingerprintSha256,
      directExecutor,
      handoffBindingState:
        command.handoffBinding.mode === 'EXACT'
          ? ('EXACT_CONTROLLED_HANDOFF' as const)
          : ('NO_CONTROLLED_HANDOFF_BY_DESIGN' as const),
      ...(handoff ? { handoff } : {}),
      correlationId: String(command.correlationId),
      createdAt: checkedAt
    };
    const lineage: AllocationAdmissionLineageRecord = {
      allocationAdmissionLineageId: this.nextLineageId(),
      version: 1,
      ...lineageBase,
      lineageFingerprintSha256: fingerprint(lineageBase)
    };

    const committed = await this.repository.commit({
      allocation,
      lineage,
      scopeKey: replayScope,
      idempotencyKey,
      requestFingerprintSha256,
      actorId
    });
    return committed ?? { requestFingerprintSha256, allocation, lineage };
  }

  private async validateHandoff(
    command: GovernedAllocationCommand,
    selection: Readonly<ProviderSelectionV1>,
    attemptedAt: string
  ): Promise<AllocationAdmissionLineageRecord['handoff'] | undefined> {
    if (command.handoffBinding.mode === 'NONE_EXPLICIT') return undefined;

    const reference = command.handoffBinding.handoff;
    const envelope = await this.handoffs.findLatest(reference.controlledHandoffId);
    if (
      !envelope ||
      envelope.version !== reference.version ||
      envelope.status !== 'AUTHORIZED' ||
      envelope.originatingWorkspaceId.toLowerCase() !== command.workspaceId.toLowerCase() ||
      envelope.recipient.providerId !== command.providerId ||
      envelope.recipient.providerWorkspaceId.toLowerCase() !==
        selection.sourceLineage.provider.providerWorkspaceId.toLowerCase() ||
      !sameHandoffSelection(envelope, command.selection) ||
      !exactScope(envelope.sourceLineage.selectionLineage.selectionScope, command.selectionScope)
    ) {
      throw new GovernedAllocationError(
        'HANDOFF_MISMATCH',
        'Exact Controlled Handoff does not match the governed Allocation prerequisite Selection.',
        409
      );
    }

    const attempt: ControlledHandoffConsumptionAttemptV1 = {
      originatingWorkspaceId: command.workspaceId,
      recipientProviderId: command.providerId,
      recipientProviderWorkspaceId: envelope.recipient.providerWorkspaceId,
      purposeFingerprintSha256: envelope.purpose.purposeFingerprintSha256,
      projectionFingerprintSha256: envelope.authorizedProjection.projectionFingerprintSha256,
      sourceSetFingerprintSha256: envelope.authorizedProjection.sourceSetFingerprintSha256,
      artifactRetrievalRequested: false,
      attemptedAt,
      correlationId: command.correlationId as MarkOrbitId
    };
    const validation = await this.handoffService.validateCurrent(
      { workspaceId: command.workspaceId },
      { envelope: reference, purpose: 'HANDOFF_CONSUMPTION', attempt }
    );
    if (
      validation.decision !== 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION' ||
      validation.currentlyUsable !== true ||
      validation.currentExactDisclosurePermitted !== true
    ) {
      throw new GovernedAllocationError(
        validation.denialReason === 'AUTHORITY_UNAVAILABLE'
          ? 'AUTHORITY_UNAVAILABLE'
          : 'HANDOFF_NOT_CURRENT',
        'Controlled Handoff is not currently usable for exact governed Allocation consumption.',
        validation.denialReason === 'AUTHORITY_UNAVAILABLE' ? 503 : 409
      );
    }
    return {
      envelope,
      validation,
      validationFingerprintSha256: fingerprint(validation)
    };
  }
}
