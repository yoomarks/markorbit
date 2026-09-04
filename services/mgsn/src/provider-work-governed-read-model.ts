import type {
  ProviderWorkIncomingDataAuthorityV1,
  ProviderWorkItemReadResultV1,
  ProviderWorkItemSummaryV1,
  ProviderWorkSourceCheckV1
} from '@markorbit/contracts/provider-work-read-model';
import type {
  GovernedAllocationAdmissionLineageRecord,
  GovernedAllocationRepository
} from './governed-allocation.js';
import type {
  ProviderWorkIncomingAuthorityEvaluation,
  ProviderWorkIncomingAuthoritySource,
  ProviderWorkIncomingLineage
} from './provider-work-incoming-authority.js';
import {
  providerWorkFingerprint,
  type ProviderWorkListQuery,
  type ProviderWorkListResultV1,
  type ProviderWorkPrincipal,
  type ProviderWorkReadModelService
} from './provider-work-read-model.js';

function withoutCheckedAt(value: object): Readonly<Record<string, unknown>> {
  const bounded: Record<string, unknown> = { ...value };
  delete bounded.checkedAt;
  return bounded;
}

function sourceCheck(
  item: Readonly<ProviderWorkItemSummaryV1>,
  checkedAt: string,
  evaluation: Readonly<ProviderWorkIncomingAuthorityEvaluation>
): ProviderWorkSourceCheckV1 {
  const scope = {
    providerId: item.provider.providerId,
    allocationId: item.allocation.allocationId,
    authorityState: evaluation.authority.state
  };
  return {
    sourceKind: 'INCOMING_DATA_AUTHORITY',
    owner: 'MGSN',
    state: evaluation.sourceState,
    ...(evaluation.sourceReference
      ? {
          sourceReference: evaluation.sourceReference,
          sourceVersion: evaluation.sourceVersion,
          sourceFingerprintSha256: evaluation.sourceFingerprintSha256
        }
      : {}),
    checkedAt,
    queryScopeFingerprintSha256: providerWorkFingerprint(scope)
  };
}

function incomingLineage(
  lineage: Readonly<GovernedAllocationAdmissionLineageRecord>
): ProviderWorkIncomingLineage {
  if (lineage.handoff.mode === 'NONE_EXPLICIT') {
    return {
      mode: 'NONE_EXPLICIT',
      lineageFingerprintSha256: lineage.lineageFingerprintSha256
    };
  }
  return {
    mode: 'EXACT',
    lineageFingerprintSha256: lineage.lineageFingerprintSha256,
    handoff: lineage.handoff.handoff,
    envelopeFingerprintSha256: lineage.handoff.envelopeFingerprintSha256,
    purposeFingerprintSha256: lineage.handoff.purposeFingerprintSha256,
    projectionFingerprintSha256: lineage.handoff.projectionFingerprintSha256,
    sourceSetFingerprintSha256: lineage.handoff.sourceSetFingerprintSha256
  };
}

function unavailable(checkedAt: string): ProviderWorkIncomingAuthorityEvaluation {
  return {
    authority: {
      state: 'SOURCE_UNAVAILABLE',
      checkedAt,
      reason: 'PERSISTENCE_UNAVAILABLE',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    },
    sourceState: 'UNAVAILABLE'
  };
}

export class GovernedProviderWorkReadModelService {
  constructor(
    private readonly base: ProviderWorkReadModelService,
    private readonly governedAllocationRepository: GovernedAllocationRepository,
    private readonly incomingAuthority: ProviderWorkIncomingAuthoritySource
  ) {}

  async list(
    principal: Readonly<ProviderWorkPrincipal>,
    query: Readonly<ProviderWorkListQuery> = {}
  ): Promise<ProviderWorkListResultV1> {
    const result = await this.base.list(principal, query);
    return {
      ...result,
      items: await Promise.all(result.items.map((item) => this.enrich(item, result.checkedAt)))
    };
  }

  async read(
    principal: Readonly<ProviderWorkPrincipal>,
    allocationId: Parameters<ProviderWorkReadModelService['read']>[1]
  ): Promise<ProviderWorkItemReadResultV1> {
    const result = await this.base.read(principal, allocationId);
    if (result.decision !== 'AUTHORIZED') return result;
    return {
      ...result,
      item: await this.enrich(result.item, result.checkedAt)
    };
  }

  private async enrich(
    item: Readonly<ProviderWorkItemSummaryV1>,
    checkedAt: string
  ): Promise<ProviderWorkItemSummaryV1> {
    let evaluation: ProviderWorkIncomingAuthorityEvaluation;
    try {
      const lineage = await this.governedAllocationRepository.findLineage(
        item.allocation.allocationId,
        item.allocation.version
      );
      evaluation = await this.incomingAuthority.evaluate({
        providerId: item.provider.providerId,
        providerWorkspaceId: item.provider.providerWorkspaceId,
        originatingWorkspaceId: item.origin.originatingWorkspaceId,
        allocationId: item.allocation.allocationId,
        correlationId: lineage?.correlationId ?? `provider-work:${item.allocation.allocationId}`,
        checkedAt,
        ...(lineage ? { lineage: incomingLineage(lineage) } : {})
      });
    } catch {
      evaluation = unavailable(checkedAt);
    }

    const incomingCheck = sourceCheck(item, checkedAt, evaluation);
    const sourceChecks = item.sourceChecks.map((check) =>
      check.sourceKind === 'INCOMING_DATA_AUTHORITY' ? incomingCheck : check
    );
    if (!sourceChecks.some((check) => check.sourceKind === 'INCOMING_DATA_AUTHORITY')) {
      sourceChecks.push(incomingCheck);
    }
    const sourceSetFingerprintSha256 = providerWorkFingerprint(
      sourceChecks.map((check) => withoutCheckedAt(check))
    );
    const projectionFingerprintSha256 = providerWorkFingerprint({
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
      responseState: withoutCheckedAt(item.responseState),
      returnState: withoutCheckedAt(item.returnState),
      incomingDataAuthority: withoutCheckedAt(
        evaluation.authority as ProviderWorkIncomingDataAuthorityV1
      ),
      sourceSetFingerprintSha256
    });

    return {
      ...item,
      incomingDataAuthority: evaluation.authority,
      sourceChecks,
      sourceSetFingerprintSha256,
      projectionFingerprintSha256,
      projectedAt: checkedAt
    };
  }
}