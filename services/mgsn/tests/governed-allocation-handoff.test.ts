import { controlledHandoffContractFixtureV1 } from '@markorbit/contracts/controlled-privacy-handoff';
import { providerSelectionContractFixtureV1 } from '@markorbit/contracts/provider-selection';
import type { AllocationRecord } from '../src/allocation-provider-acceptance.js';
import {
  GovernedAllocationService,
  type GovernedAllocationCommand,
  type GovernedAllocationRepository
} from '../src/governed-allocation.js';
import { describe, expect, it, vi } from 'vitest';

const selection = providerSelectionContractFixtureV1.currentSelection;
const handoff = controlledHandoffContractFixtureV1.currentEnvelope;
const workspaceId = selection.requesterWorkspaceId;
const providerId = selection.sourceLineage.provider.providerId;
const providerWorkspaceId = selection.sourceLineage.provider.providerWorkspaceId;
const supply = selection.sourceLineage.providerSupplyCapability;
const checkedAt = '2026-09-04T14:40:00.000Z';

function allocation(): AllocationRecord {
  return {
    schemaVersion: 1,
    allocationId: 'allocation_governed-handoff-716',
    workspaceId,
    version: 1,
    servicePackage: { id: 'service-package_governed-handoff-716', version: 1 },
    servicePackageFingerprintSha256: '8'.repeat(64),
    eligibilityEvaluation: {
      id: 'eligibility-evaluation_governed-handoff-716',
      version: 1
    },
    eligibilityFingerprintSha256: '9'.repeat(64),
    provider: {
      providerId,
      providerWorkspaceId,
      displayName: 'Governed Handoff Provider',
      operationalStatus: 'ACTIVE'
    },
    providerVersion: 2,
    providerSupplyCapability: { id: supply.id, version: supply.version },
    providerSupplyCapabilityFingerprintSha256: supply.fingerprintSha256,
    allocatedBy: 'actor_governed-handoff-716',
    rationale: 'Explicit current Human Selection with exact Handoff tuple.',
    status: 'ACTIVE',
    createdAt: checkedAt,
    updatedAt: checkedAt,
    correlationId: 'correlation_governed-handoff-716'
  };
}

function command(): GovernedAllocationCommand {
  return {
    workspaceId,
    actorId: 'actor_governed-handoff-716',
    servicePackageId: 'service-package_governed-handoff-716',
    expectedServicePackageVersion: 1,
    expectedServicePackageFingerprintSha256: '8'.repeat(64),
    eligibilityEvaluationId: 'eligibility-evaluation_governed-handoff-716',
    expectedEligibilityEvaluationVersion: 1,
    expectedEligibilityFingerprintSha256: '9'.repeat(64),
    providerId,
    providerSupplyCapabilityId: supply.id,
    expectedProviderSupplyCapabilityVersion: supply.version,
    rationale: 'Explicit current Human Selection with exact Handoff tuple.',
    idempotencyKey: 'governed-allocation-handoff:716',
    correlationId: 'correlation_governed-handoff-716',
    selection: {
      providerSelectionId: selection.providerSelectionId,
      version: selection.version,
      scopeVersion: selection.scopeVersion
    },
    selectionScope: selection.scope,
    handoffBinding: {
      mode: 'EXACT',
      handoff: {
        controlledHandoffId: handoff.controlledHandoffId,
        version: handoff.version
      },
      envelopeFingerprintSha256: handoff.envelopeFingerprintSha256,
      purposeFingerprintSha256: handoff.purpose.purposeFingerprintSha256,
      projectionFingerprintSha256: handoff.authorizedProjection.projectionFingerprintSha256,
      sourceSetFingerprintSha256: handoff.authorizedProjection.sourceSetFingerprintSha256
    }
  };
}

function repository(): GovernedAllocationRepository {
  return {
    findReplay: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined)
  };
}

function service(input?: {
  planner?: { plan: ReturnType<typeof vi.fn> };
  handoffService?: { validateCurrent: ReturnType<typeof vi.fn> };
}) {
  const planner = input?.planner ?? { plan: vi.fn().mockResolvedValue(allocation()) };
  const handoffService = input?.handoffService ?? {
    validateCurrent: vi
      .fn()
      .mockResolvedValue(controlledHandoffContractFixtureV1.validForExactConsumption)
  };
  return {
    planner,
    handoffService,
    instance: new GovernedAllocationService(
      planner,
      repository(),
      { findLatestSelection: vi.fn().mockResolvedValue(selection) } as never,
      {
        validateCurrent: vi.fn().mockResolvedValue({
          ...providerSelectionContractFixtureV1.validForBoundedReview,
          purpose: 'ALLOCATION_PREREQUISITE_REVIEW'
        })
      } as never,
      { findLatest: vi.fn().mockResolvedValue(handoff) } as never,
      handoffService as never,
      {
        assessCurrent: vi.fn().mockResolvedValue({
          established: true,
          providerId,
          providerWorkspaceId,
          authorityReference: 'responsibility:governed-handoff-716',
          authorityVersion: 1,
          checkedAt,
          validationFingerprintSha256: 'a'.repeat(64)
        })
      },
      () => checkedAt,
      () => 'allocation-admission-lineage_governed-handoff-716'
    )
  };
}

describe('GovernedAllocationService exact Handoff admission', () => {
  it('rejects a caller-supplied purpose/projection/source tuple mismatch before M4 planning', async () => {
    const planner = { plan: vi.fn() };
    const handoffService = { validateCurrent: vi.fn() };
    const runtime = service({ planner, handoffService });
    const mismatched = command();
    if (mismatched.handoffBinding.mode !== 'EXACT') throw new Error('fixture must be EXACT');
    mismatched.handoffBinding = {
      ...mismatched.handoffBinding,
      purposeFingerprintSha256: '0'.repeat(64)
    };

    await expect(runtime.instance.allocate(mismatched)).rejects.toMatchObject({
      code: 'HANDOFF_MISMATCH',
      status: 409
    });
    expect(planner.plan).not.toHaveBeenCalled();
    expect(handoffService.validateCurrent).not.toHaveBeenCalled();
  });

  it('passes the explicit caller-supplied tuple unchanged into HANDOFF_CONSUMPTION validation', async () => {
    const runtime = service();
    const exact = command();
    if (exact.handoffBinding.mode !== 'EXACT') throw new Error('fixture must be EXACT');

    const result = await runtime.instance.allocate(exact);

    expect(result.lineage.handoffBindingState).toBe('EXACT_CONTROLLED_HANDOFF');
    expect(runtime.handoffService.validateCurrent).toHaveBeenCalledWith(
      { workspaceId },
      {
        envelope: exact.handoffBinding.handoff,
        purpose: 'HANDOFF_CONSUMPTION',
        attempt: {
          originatingWorkspaceId: workspaceId,
          recipientProviderId: providerId,
          recipientProviderWorkspaceId: providerWorkspaceId,
          purposeFingerprintSha256: exact.handoffBinding.purposeFingerprintSha256,
          projectionFingerprintSha256: exact.handoffBinding.projectionFingerprintSha256,
          sourceSetFingerprintSha256: exact.handoffBinding.sourceSetFingerprintSha256,
          artifactRetrievalRequested: false,
          attemptedAt: checkedAt,
          correlationId: exact.correlationId
        }
      }
    );
  });

  it.each(['HANDOFF_REVOKED', 'HANDOFF_EXPIRED', 'SOURCE_ACCESS_NOT_CURRENT'] as const)(
    'fails closed before M4 planning when exact Handoff validation returns %s',
    async (denialReason) => {
      const planner = { plan: vi.fn() };
      const runtime = service({
        planner,
        handoffService: {
          validateCurrent: vi.fn().mockResolvedValue({
            ...controlledHandoffContractFixtureV1.validForExactConsumption,
            decision: 'DENY',
            currentlyUsable: false,
            currentExactDisclosurePermitted: false,
            denialReason
          })
        }
      });

      await expect(runtime.instance.allocate(command())).rejects.toMatchObject({
        code: 'HANDOFF_NOT_CURRENT',
        status: 409
      });
      expect(planner.plan).not.toHaveBeenCalled();
    }
  );
});
