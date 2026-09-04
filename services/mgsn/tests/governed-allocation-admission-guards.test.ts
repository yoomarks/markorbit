import { providerSelectionContractFixtureV1 } from '@markorbit/contracts/provider-selection';
import type { AllocationRecord } from '../src/allocation-provider-acceptance.js';
import {
  GovernedAllocationService,
  type GovernedAllocationCommand,
  type GovernedAllocationRepository
} from '../src/governed-allocation.js';
import { describe, expect, it, vi } from 'vitest';

const selection = providerSelectionContractFixtureV1.currentSelection;
const workspaceId = selection.requesterWorkspaceId;
const providerId = selection.sourceLineage.provider.providerId;
const providerWorkspaceId = selection.sourceLineage.provider.providerWorkspaceId;
const supply = selection.sourceLineage.providerSupplyCapability;
const checkedAt = '2026-09-04T14:40:00.000Z';

function command(): GovernedAllocationCommand {
  return {
    workspaceId,
    actorId: 'actor_governed-guards-716',
    servicePackageId: 'service-package_governed-guards-716',
    expectedServicePackageVersion: 1,
    expectedServicePackageFingerprintSha256: '8'.repeat(64),
    eligibilityEvaluationId: 'eligibility-evaluation_governed-guards-716',
    expectedEligibilityEvaluationVersion: 1,
    expectedEligibilityFingerprintSha256: '9'.repeat(64),
    providerId,
    providerSupplyCapabilityId: supply.id,
    expectedProviderSupplyCapabilityVersion: supply.version,
    rationale: 'Explicit Human Provider Selection admission guard.',
    idempotencyKey: 'governed-allocation-guards:716',
    correlationId: 'correlation_governed-guards-716',
    selection: {
      providerSelectionId: selection.providerSelectionId,
      version: selection.version,
      scopeVersion: selection.scopeVersion
    },
    selectionScope: selection.scope,
    handoffBinding: { mode: 'NONE_EXPLICIT' }
  };
}

function allocation(): AllocationRecord {
  return {
    schemaVersion: 1,
    allocationId: 'allocation_governed-guards-716',
    workspaceId,
    version: 1,
    servicePackage: { id: 'service-package_governed-guards-716', version: 1 },
    servicePackageFingerprintSha256: '8'.repeat(64),
    eligibilityEvaluation: { id: 'eligibility-evaluation_governed-guards-716', version: 1 },
    eligibilityFingerprintSha256: '9'.repeat(64),
    provider: {
      providerId,
      providerWorkspaceId,
      displayName: 'Governed Guard Provider',
      operationalStatus: 'ACTIVE'
    },
    providerVersion: 1,
    providerSupplyCapability: { id: supply.id, version: supply.version },
    providerSupplyCapabilityFingerprintSha256: supply.fingerprintSha256,
    allocatedBy: 'actor_governed-guards-716',
    rationale: 'Explicit Human Provider Selection admission guard.',
    status: 'ACTIVE',
    createdAt: checkedAt,
    updatedAt: checkedAt,
    correlationId: 'correlation_governed-guards-716'
  };
}

function repository(replay?: unknown): GovernedAllocationRepository {
  return {
    findReplay: vi.fn().mockResolvedValue(replay),
    commit: vi.fn().mockResolvedValue(undefined)
  };
}

function positiveSelectionValidation() {
  return {
    ...providerSelectionContractFixtureV1.validForBoundedReview,
    purpose: 'ALLOCATION_PREREQUISITE_REVIEW' as const
  };
}

function directExecutor() {
  return {
    established: true as const,
    providerId,
    providerWorkspaceId,
    authorityReference: 'responsibility:governed-guards-716',
    authorityVersion: 1,
    checkedAt,
    validationFingerprintSha256: 'a'.repeat(64)
  };
}

function runtime(input: {
  latestSelection?: unknown;
  selectionValidation?: unknown;
  direct?: unknown;
  replay?: unknown;
} = {}) {
  const planner = { plan: vi.fn().mockResolvedValue(allocation()) };
  const selectionValidator = vi.fn().mockResolvedValue(
    input.selectionValidation ?? positiveSelectionValidation()
  );
  const service = new GovernedAllocationService(
    planner,
    repository(input.replay),
    {
      findLatestSelection: vi
        .fn()
        .mockResolvedValue(input.latestSelection === undefined ? selection : input.latestSelection)
    } as never,
    { validateCurrent: selectionValidator } as never,
    { findLatest: vi.fn() } as never,
    { validateCurrent: vi.fn() } as never,
    {
      assessCurrent: vi
        .fn()
        .mockResolvedValue(input.direct === undefined ? directExecutor() : input.direct)
    } as never,
    () => checkedAt,
    () => 'allocation-admission-lineage_governed-guards-716'
  );
  return { planner, selectionValidator, service };
}

describe('GovernedAllocationService admission fail-closed guards', () => {
  it('rejects a missing exact Selection before M4 planning', async () => {
    const { planner, service } = runtime({ latestSelection: null });
    await expect(service.allocate(command())).rejects.toMatchObject({
      code: 'SELECTION_MISMATCH',
      status: 409
    });
    expect(planner.plan).not.toHaveBeenCalled();
  });

  it.each(['SUPERSEDED', 'REVOKED'] as const)(
    'rejects %s Selection history as non-current before M4 planning',
    async (status) => {
      const { planner, service } = runtime({ latestSelection: { ...selection, status } });
      await expect(service.allocate(command())).rejects.toMatchObject({
        code: 'SELECTION_MISMATCH',
        status: 409
      });
      expect(planner.plan).not.toHaveBeenCalled();
    }
  );

  it('requires ALLOCATION_PREREQUISITE_REVIEW and fails closed when current authority is unavailable', async () => {
    const unavailable = {
      ...providerSelectionContractFixtureV1.currentButNotUsable,
      purpose: 'ALLOCATION_PREREQUISITE_REVIEW' as const,
      denialReason: 'AUTHORITY_UNAVAILABLE' as const
    };
    const { planner, selectionValidator, service } = runtime({ selectionValidation: unavailable });
    await expect(service.allocate(command())).rejects.toMatchObject({
      code: 'SELECTION_NOT_CURRENT',
      status: 503
    });
    expect(selectionValidator).toHaveBeenCalledWith(
      { workspaceId },
      {
        scope: selection.scope,
        providerSelectionId: selection.providerSelectionId,
        purpose: 'ALLOCATION_PREREQUISITE_REVIEW'
      }
    );
    expect(planner.plan).not.toHaveBeenCalled();
  });

  it.each([
    ['Provider', { providerId: 'provider_other-716' }],
    [
      'Supply',
      {
        providerSupplyCapabilityId: 'provider-supply-capability_other-716',
        expectedProviderSupplyCapabilityVersion: supply.version
      }
    ],
    ['Supply version', { expectedProviderSupplyCapabilityVersion: supply.version + 1 }]
  ] as const)('rejects exact Selection %s mismatch before M4 planning', async (_label, patch) => {
    const mismatched = { ...command(), ...patch } as GovernedAllocationCommand;
    const { planner, service } = runtime();
    await expect(service.allocate(mismatched)).rejects.toMatchObject({
      code: 'SELECTION_MISMATCH',
      status: 409
    });
    expect(planner.plan).not.toHaveBeenCalled();
  });

  it('rejects missing current Direct Executor authority before M4 planning', async () => {
    const { planner, service } = runtime({ direct: null });
    await expect(service.allocate(command())).rejects.toMatchObject({
      code: 'DIRECT_EXECUTOR_NOT_CURRENT',
      status: 409
    });
    expect(planner.plan).not.toHaveBeenCalled();
  });

  it('rejects same idempotency key when the persisted governed lineage fingerprint differs', async () => {
    const replay = {
      requestFingerprintSha256: '0'.repeat(64),
      allocation: allocation(),
      lineage: {}
    };
    const { planner, service } = runtime({ replay });
    await expect(service.allocate(command())).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409
    });
    expect(planner.plan).not.toHaveBeenCalled();
  });
});
