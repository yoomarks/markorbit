import type {
  ControlledHandoffId,
  ControlledHandoffValidationDenialReason
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  ProviderWorkIncomingDataAuthorityV1,
  ProviderWorkItemReadResultV1,
  ProviderWorkItemSummaryV1,
  ProviderWorkSourceCheckV1
} from '@markorbit/contracts/provider-work-read-model';
import type { AllocationId } from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import type { ControlledPrivacyHandoffService } from './controlled-privacy-handoff.js';
import {
  ProviderWorkReadModelError,
  type ProviderWorkReadModelService,
  providerWorkFingerprint,
  type ProviderWorkListQuery,
  type ProviderWorkListResultV1,
  type ProviderWorkPrincipal
} from './provider-work-read-model.js';

export type ProviderWorkIncomingLineage =
  | Readonly<{ kind: 'LEGACY_UNLINKED' }>
  | Readonly<{
      kind: 'NONE_EXPLICIT';
      lineageReference: string;
      lineageFingerprintSha256: string;
    }>
  | Readonly<{
      kind: 'EXACT';
      lineageReference: string;
      lineageFingerprintSha256: string;
      handoffId: ControlledHandoffId;
      handoffVersion: number;
      purposeFingerprintSha256: string;
      projectionFingerprintSha256: string;
      sourceSetFingerprintSha256: string;
      correlationId: string;
    }>;

export interface ProviderWorkIncomingAuthorityRepository {
  findAllocationLineage(
    allocationId: AllocationId,
    allocationVersion: number
  ): Promise<ProviderWorkIncomingLineage>;
}

export class PostgresProviderWorkIncomingAuthorityRepository implements ProviderWorkIncomingAuthorityRepository {
  constructor(private readonly query: QueryClient) {}

  async findAllocationLineage(allocationId: AllocationId, allocationVersion: number) {
    try {
      const result = await this.query.query(
        `SELECT
           allocation_admission_lineage_id,lineage_fingerprint_sha256,handoff_binding_state,
           controlled_handoff_id,controlled_handoff_version,handoff_purpose_fingerprint_sha256,
           handoff_projection_fingerprint_sha256,handoff_source_set_fingerprint_sha256,correlation_id
         FROM mgsn_allocation_admission_lineages
         WHERE allocation_id=$1 AND allocation_version=$2`,
        [allocationId, allocationVersion]
      );
      if (!result.rowCount) return { kind: 'LEGACY_UNLINKED' } as const;
      if (result.rowCount !== 1) throw new Error('Allocation has contradictory admission lineage.');
      const row = result.rows[0] as Record<string, unknown>;
      const lineageReference = String(row.allocation_admission_lineage_id);
      const lineageFingerprintSha256 = String(row.lineage_fingerprint_sha256);
      if (row.handoff_binding_state === 'NO_CONTROLLED_HANDOFF_BY_DESIGN') {
        return { kind: 'NONE_EXPLICIT', lineageReference, lineageFingerprintSha256 } as const;
      }
      if (
        row.handoff_binding_state !== 'EXACT_CONTROLLED_HANDOFF' ||
        typeof row.controlled_handoff_id !== 'string' ||
        !Number.isInteger(Number(row.controlled_handoff_version)) ||
        Number(row.controlled_handoff_version) <= 0
      ) {
        throw new Error('Allocation admission lineage Handoff binding is malformed.');
      }
      return {
        kind: 'EXACT',
        lineageReference,
        lineageFingerprintSha256,
        handoffId: row.controlled_handoff_id as ControlledHandoffId,
        handoffVersion: Number(row.controlled_handoff_version),
        purposeFingerprintSha256: String(row.handoff_purpose_fingerprint_sha256),
        projectionFingerprintSha256: String(row.handoff_projection_fingerprint_sha256),
        sourceSetFingerprintSha256: String(row.handoff_source_set_fingerprint_sha256),
        correlationId: String(row.correlation_id)
      } as const;
    } catch (cause) {
      throw new ProviderWorkReadModelError(
        'PERSISTENCE_UNAVAILABLE',
        'Provider Work admission lineage is unavailable.',
        503,
        { cause: cause instanceof Error ? cause.message : String(cause) }
      );
    }
  }
}

function withoutCheckedAt(value: object): Readonly<Record<string, unknown>> {
  const bounded: Record<string, unknown> = { ...value };
  delete bounded.checkedAt;
  return bounded;
}

function sourceCheck(
  item: Readonly<ProviderWorkItemSummaryV1>,
  checkedAt: string,
  state: ProviderWorkSourceCheckV1['state'],
  scope: object,
  source?: { reference: string; version: number | string; fingerprint: string }
): ProviderWorkSourceCheckV1 {
  return {
    sourceKind: 'INCOMING_DATA_AUTHORITY',
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
    queryScopeFingerprintSha256: providerWorkFingerprint({
      providerId: item.provider.providerId,
      allocationId: item.allocation.allocationId,
      ...scope
    })
  };
}

function projectionFingerprint(
  item: Readonly<ProviderWorkItemSummaryV1>,
  incomingDataAuthority: Readonly<ProviderWorkIncomingDataAuthorityV1>,
  sourceChecks: readonly Readonly<ProviderWorkSourceCheckV1>[]
): { sourceSetFingerprintSha256: string; projectionFingerprintSha256: string } {
  const fingerprintChecks = sourceChecks.map((check) => withoutCheckedAt(check));
  const sourceSetFingerprintSha256 = providerWorkFingerprint(fingerprintChecks);
  const boundedProjection = {
    provider: item.provider,
    allocation: item.allocation,
    servicePackage: {
      id: item.servicePackage.servicePackage.id,
      version: item.servicePackage.servicePackage.version,
      fingerprint: item.servicePackage.servicePackageFingerprintSha256
    },
    origin: {
      originatingWorkspaceId: item.origin.originatingWorkspaceId,
      professionalReference: item.origin.professionalReference
    },
    actionLineage: item.actionLineage,
    responseState: withoutCheckedAt(item.responseState),
    returnState: withoutCheckedAt(item.returnState),
    incomingDataAuthority: withoutCheckedAt(incomingDataAuthority),
    sourceSetFingerprintSha256
  };
  return {
    sourceSetFingerprintSha256,
    projectionFingerprintSha256: providerWorkFingerprint(boundedProjection)
  };
}

/**
 * #716 owner-local Provider Work upgrade.
 *
 * Base M4 projection remains unchanged. Only exact #712 admission lineage can strengthen incoming
 * authority beyond UNKNOWN, and EXACT Handoff is freshly revalidated on every read/list projection.
 */
export class GovernedProviderWorkReadModelService {
  constructor(
    private readonly base: ProviderWorkReadModelService,
    private readonly lineage: ProviderWorkIncomingAuthorityRepository,
    private readonly handoffs: ControlledPrivacyHandoffService
  ) {}

  async list(
    principal: Readonly<ProviderWorkPrincipal>,
    query: Readonly<ProviderWorkListQuery> = {}
  ): Promise<ProviderWorkListResultV1> {
    const result = await this.base.list(principal, query);
    const items = await Promise.all(
      result.items.map((item) => this.upgrade(item, result.checkedAt))
    );
    return { ...result, items };
  }

  async read(
    principal: Readonly<ProviderWorkPrincipal>,
    allocationId: AllocationId
  ): Promise<ProviderWorkItemReadResultV1> {
    const result = await this.base.read(principal, allocationId);
    if (result.decision !== 'AUTHORIZED') return result;
    return {
      ...result,
      item: await this.upgrade(result.item, result.checkedAt)
    };
  }

  private async upgrade(
    item: Readonly<ProviderWorkItemSummaryV1>,
    checkedAt: string
  ): Promise<ProviderWorkItemSummaryV1> {
    let lineage: ProviderWorkIncomingLineage;
    try {
      lineage = await this.lineage.findAllocationLineage(
        item.allocation.allocationId,
        item.allocation.version
      );
    } catch {
      return this.withAuthority(
        item,
        checkedAt,
        {
          state: 'SOURCE_UNAVAILABLE',
          checkedAt,
          reason: 'PERSISTENCE_UNAVAILABLE',
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        },
        'UNAVAILABLE',
        { authoritySource: 'LINEAGE_UNAVAILABLE' }
      );
    }

    if (lineage.kind === 'LEGACY_UNLINKED') {
      return item;
    }
    if (lineage.kind === 'NONE_EXPLICIT') {
      return this.withAuthority(
        item,
        checkedAt,
        {
          state: 'KNOWN_ABSENT',
          checkedAt,
          authorityScopeFingerprintSha256: providerWorkFingerprint({
            allocationId: item.allocation.allocationId,
            allocationVersion: item.allocation.version,
            lineageReference: lineage.lineageReference,
            lineageFingerprintSha256: lineage.lineageFingerprintSha256,
            handoffBindingState: 'NO_CONTROLLED_HANDOFF_BY_DESIGN'
          }),
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        },
        'KNOWN_ABSENT',
        {
          authoritySource: 'EXPLICIT_ALLOCATION_LINEAGE',
          lineageReference: lineage.lineageReference,
          lineageFingerprintSha256: lineage.lineageFingerprintSha256
        }
      );
    }

    try {
      const validation = await this.handoffs.validateCurrent(
        { workspaceId: item.origin.originatingWorkspaceId },
        {
          envelope: { controlledHandoffId: lineage.handoffId, version: lineage.handoffVersion },
          purpose: 'HANDOFF_CONSUMPTION',
          attempt: {
            originatingWorkspaceId: item.origin.originatingWorkspaceId,
            recipientProviderId: item.provider.providerId,
            recipientProviderWorkspaceId: item.provider.providerWorkspaceId,
            purposeFingerprintSha256: lineage.purposeFingerprintSha256,
            projectionFingerprintSha256: lineage.projectionFingerprintSha256,
            sourceSetFingerprintSha256: lineage.sourceSetFingerprintSha256,
            artifactRetrievalRequested: false,
            attemptedAt: checkedAt,
            correlationId: lineage.correlationId as never
          }
        }
      );
      const validationFingerprintSha256 = providerWorkFingerprint(validation);
      if (
        validation.decision === 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION' &&
        validation.currentlyUsable === true &&
        validation.currentExactDisclosurePermitted === true
      ) {
        return this.withAuthority(
          item,
          checkedAt,
          {
            state: 'CURRENTLY_USABLE',
            handoff: { controlledHandoffId: lineage.handoffId, version: lineage.handoffVersion },
            validationReference: `mgsn-controlled-handoff-validation:${validationFingerprintSha256}`,
            validationFingerprintSha256,
            validationPolicyVersion: validation.validationPolicyVersion,
            checkedAt,
            currentExactProjectionMayBeResolvedSeparately: true,
            embeddedPrivateFieldValues: false
          },
          'CURRENT',
          { authoritySource: 'EXACT_CURRENT_HANDOFF' },
          {
            reference: lineage.handoffId,
            version: lineage.handoffVersion,
            fingerprint: validationFingerprintSha256
          }
        );
      }
      return this.denied(
        item,
        checkedAt,
        lineage,
        validation.denialReason,
        validationFingerprintSha256
      );
    } catch {
      return this.withAuthority(
        item,
        checkedAt,
        {
          state: 'SOURCE_UNAVAILABLE',
          checkedAt,
          reason: 'DEPENDENCY_UNAVAILABLE',
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        },
        'UNAVAILABLE',
        { authoritySource: 'HANDOFF_CURRENT_AUTHORITY_UNAVAILABLE' },
        {
          reference: lineage.handoffId,
          version: lineage.handoffVersion,
          fingerprint: lineage.lineageFingerprintSha256
        }
      );
    }
  }

  private denied(
    item: Readonly<ProviderWorkItemSummaryV1>,
    checkedAt: string,
    lineage: Extract<ProviderWorkIncomingLineage, { kind: 'EXACT' }>,
    denialReason: ControlledHandoffValidationDenialReason,
    validationFingerprintSha256: string
  ) {
    if (denialReason === 'AUTHORITY_UNAVAILABLE') {
      return this.withAuthority(
        item,
        checkedAt,
        {
          state: 'SOURCE_UNAVAILABLE',
          checkedAt,
          reason: 'DEPENDENCY_UNAVAILABLE',
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        },
        'UNAVAILABLE',
        { authoritySource: 'HANDOFF_CURRENT_AUTHORITY_UNAVAILABLE' },
        {
          reference: lineage.handoffId,
          version: lineage.handoffVersion,
          fingerprint: validationFingerprintSha256
        }
      );
    }
    return this.withAuthority(
      item,
      checkedAt,
      {
        state: 'DENIED',
        handoff: { controlledHandoffId: lineage.handoffId, version: lineage.handoffVersion },
        denialReason,
        checkedAt,
        incomingFieldsVisible: false,
        embeddedPrivateFieldValues: false
      },
      'CURRENT',
      { authoritySource: 'EXACT_HANDOFF_DENIED', denialReason },
      {
        reference: lineage.handoffId,
        version: lineage.handoffVersion,
        fingerprint: validationFingerprintSha256
      }
    );
  }

  private withAuthority(
    item: Readonly<ProviderWorkItemSummaryV1>,
    checkedAt: string,
    incomingDataAuthority: Readonly<ProviderWorkIncomingDataAuthorityV1>,
    sourceState: ProviderWorkSourceCheckV1['state'],
    sourceScope: object,
    source?: { reference: string; version: number | string; fingerprint: string }
  ): ProviderWorkItemSummaryV1 {
    const checks = item.sourceChecks.filter(
      (check) => check.sourceKind !== 'INCOMING_DATA_AUTHORITY'
    );
    checks.push(sourceCheck(item, checkedAt, sourceState, sourceScope, source));
    const fingerprints = projectionFingerprint(item, incomingDataAuthority, checks);
    return {
      ...item,
      incomingDataAuthority,
      sourceChecks: checks,
      ...fingerprints,
      projectedAt: checkedAt
    };
  }
}
