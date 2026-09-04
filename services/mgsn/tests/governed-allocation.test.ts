import { providerSelectionContractFixtureV1 } from '@markorbit/contracts/provider-selection';
import type { AllocationRecord } from '../src/allocation-provider-acceptance.js';
import {
  GovernedAllocationError,
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

function allocation(): AllocationRecord {
  return {
    schemaVersion: 1,
    allocationId: 'allocation_governed-716',
    workspaceId,
    version: 1,
    servicePackage: { id: 'service-package_governed-716', version: 1 },
    servicePackageFingerprintSha256: '8'.repeat(64),
    eligibilityEvaluation: {
      id: 'eligibility-evaluation_governed-716',
      version: 1
    },
    eligibilityFingerprintSha256: '9'.repeat(64),
    provider: {
      providerId,
      providerWorkspaceId,
      displayName: 'Governed Provider',
      operationalStatus: 'ACTIVE'
    },
    providerVersion: 1,
    providerSupplyCapability: { id: supply.id, version: supply.version },
    providerSupplyCapabilityFingerprintSha256: supply.fingerprintSha256,
    allocatedBy: 'actor_governed-716',
    rationale: 'Explicit human choice.',
    status: 'ACTIVE',
    createdAt: '2026-09-04T14:40:00.000Z',
    updatedAt: '2026-09-04T14:40:00.000Z',
    correlationId: 'correlation_governed-716'
  };
}

function command(): GovernedAllocationCommand {
  return {
    workspaceId,
    actorId: 'actor_governed-716',
    servicePackageId: 'service-package_governed-716',
    expectedServicePackageVersion: 1,
    expectedServicePackageFingerprintSha256: '8'.repeat(64),
    eligibilityEvaluationId: 'eligibility-evaluation_governed-716',
    expectedEligibilityEvaluationVersion: 1,
    expectedEligibilityFingerprintSha256: '9'.repeat(64),
    providerId,
    providerSupplyCapabilityId: supply.id,
    expectedProviderSupplyCapabilityVersion: supply.version,
    rationale: 'Explicit human choice.',
    idempotencyKey: 'governed-allocation:716',
    correlationId: 'correlation_governed-716',
    selection: {
      providerSelectionId: selection.providerSelectionId,
      version: selection.version,
      scopeVersion: selection.scopeVersion
    },
    selectionScope: selection.scope,
    handoffBinding: { mode: 'NONE_EXPLICIT' }
  };
}

function repository(): GovernedAllocationRepository {
  return {
    findReplay: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined)
  };
}

describe('GovernedAllocationService', () => {
  it('does not invoke the M4 planner when exact Selection is not current', async () => {
    const planner = { plan: vi.fn() };
    const service = new GovernedAllocationService(
      planner,
      repository(),
      { findLatestSelection: vi.fn().mockResolvedValue(selection) } as never,
      {
        validateCurrent: vi.fn().mockResolvedValue({
          ...providerSelectionContractFixtureV1.currentButNotUsable,
          purpose: 'ALLOCATION_PREREQUISITE_REVIEW'
        })
      } as never,
      { findLatest: vi.fn() } as never,
      { validateCurrent: vi.fn() } as never,
      {
        assessCurrent: vi.fn().mockResolvedValue({
          established: true,
          providerId,
          providerWorkspaceId,
          authorityReference: 'responsibility:716',
          authorityVersion: 1,
          checkedAt: '2026-09-04T14:40:00.000Z',
          validationFingerprintSha256: 'a'.repeat(64)
        })
      },
      () => '2026-09-04T14:40:00.000Z'
    );

    await expect(service.allocate(command())).rejects.toMatchObject<
      Partial<GovernedAllocationError>
    >({
      code: 'SELECTION_NOT_CURRENT'
    });
    expect(planner.plan).not.toHaveBeenCalled();
  });

  it(
    'commits NONE_EXPLICIT as explicit lineage only after positive Selection and direct-executor checks',
    async () => {
      const repo = repository();
      const planned = allocation();
      const service = new GovernedAllocationService(
        { plan: vi.fn().mockResolvedValue(planned) },
        repo,
        { findLatestSelection: vi.fn().mockResolvedValue(selection) } as never,
        {
          validateCurrent: vi.fn().mockResolvedValue({
            ...providerSelectionContractFixtureV1.validForBoundedReview,
            purpose: 'ALLOCATION_PREREQUISITE_REVIEW'
          })
        } as never,
        { findLatest: vi.fn() } as never,
        { validateCurrent: vi.fn() } as never,
        {
          assessCurrent: vi.fn().mockResolvedValue({
            established: true,
            providerId,
            providerWorkspaceId,
            authorityReference: 'responsibility:716',
            authorityVersion: 1,
            checkedAt: '2026-09-04T14:40:00.000Z',
            validationFingerprintSha256: 'a'.repeat(64)
          })
        },
        () => '2026-09-04T14:40:00.000Z',
        () => 'allocation-admission-lineage_governed-716'
      );

      const result = await service.allocate(command());
      expect(result.lineage.handoffBindingState).toBe(
        'NO_CONTROLLED_HANDOFF_BY_DESIGN'
      );
      expect(result.lineage.handoff).toBeUndefined();
      expect(repo.commit).toHaveBeenCalledTimes(1);
    }
  );
});
