import { describe, expect, it, vi } from 'vitest';
import { providerWorkReadModelContractFixtureV1 } from '@markorbit/contracts/provider-work-read-model';
import {
  GovernedProviderWorkReadModelService,
  type ProviderWorkIncomingAuthorityRepository
} from '../src/provider-work-incoming-authority.js';

const baseItem = providerWorkReadModelContractFixtureV1.unknownIncomingAuthority;
const checkedAt = '2026-09-04T15:05:00.000Z';
const principal = {
  workspaceId: baseItem.provider.providerWorkspaceId,
  userId: 'user_provider-work-716',
  membershipId: 'membership_provider-work-716'
};

function baseRead(item = baseItem) {
  return {
    list: vi.fn().mockResolvedValue({
      schemaVersion: 1,
      providerWorkspaceId: item.provider.providerWorkspaceId,
      principalReference: 'principal:716',
      workspaceAuthorityReference: 'membership:716',
      checkedAt,
      items: [item],
      page: { limit: 50 },
      readAuthorityDoesNotAuthorizeMutation: true
    }),
    read: vi.fn().mockResolvedValue({
      schemaVersion: 1,
      decision: 'AUTHORIZED',
      providerWorkspaceId: item.provider.providerWorkspaceId,
      principalReference: 'principal:716',
      workspaceAuthorityReference: 'membership:716',
      checkedAt,
      item,
      existenceDisclosed: true,
      readAuthorityDoesNotAuthorizeMutation: true
    })
  };
}

function exactLineage() {
  return {
    kind: 'EXACT' as const,
    lineageReference: 'allocation-admission-lineage_716',
    lineageFingerprintSha256: '1'.repeat(64),
    handoffId: 'controlled-handoff_716' as const,
    handoffVersion: 2,
    purposeFingerprintSha256: '2'.repeat(64),
    projectionFingerprintSha256: '3'.repeat(64),
    sourceSetFingerprintSha256: '4'.repeat(64),
    correlationId: 'correlation_716'
  };
}

function service(
  lineage: ProviderWorkIncomingAuthorityRepository,
  validation?: Record<string, unknown>
) {
  return new GovernedProviderWorkReadModelService(
    baseRead() as never,
    lineage,
    {
      validateCurrent: vi.fn().mockResolvedValue(validation)
    } as never
  );
}

describe('GovernedProviderWorkReadModelService', () => {
  it('keeps legacy unlinked Allocation incoming authority UNKNOWN', async () => {
    const result = await service({
      findAllocationLineage: vi.fn().mockResolvedValue({ kind: 'LEGACY_UNLINKED' })
    }).read(principal, baseItem.allocation.allocationId);

    expect(result.decision).toBe('AUTHORIZED');
    if (result.decision === 'AUTHORIZED') {
      expect(result.item.incomingDataAuthority.state).toBe('UNKNOWN');
    }
  });

  it('maps only explicit NONE lineage to KNOWN_ABSENT', async () => {
    const result = await service({
      findAllocationLineage: vi.fn().mockResolvedValue({
        kind: 'NONE_EXPLICIT',
        lineageReference: 'allocation-admission-lineage_716-none',
        lineageFingerprintSha256: '5'.repeat(64)
      })
    }).read(principal, baseItem.allocation.allocationId);

    expect(result.decision).toBe('AUTHORIZED');
    if (result.decision === 'AUTHORIZED') {
      expect(result.item.incomingDataAuthority.state).toBe('KNOWN_ABSENT');
      expect(result.item.sourceChecks.find((check) => check.sourceKind === 'INCOMING_DATA_AUTHORITY')?.state)
        .toBe('KNOWN_ABSENT');
    }
  });

  it('freshly validates exact Handoff and exposes reference-only CURRENTLY_USABLE authority', async () => {
    const result = await service(
      { findAllocationLineage: vi.fn().mockResolvedValue(exactLineage()) },
      {
        schemaVersion: 1,
        decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
        currentlyUsable: true,
        currentExactDisclosurePermitted: true,
        validationPolicyVersion: 'mgsn-controlled-handoff-validation-v1',
        checkedAuthorityReferences: [],
        validationIsNotBearerCapability: true,
        validationDoesNotAuthorizeDownstreamAction: true
      }
    ).read(principal, baseItem.allocation.allocationId);

    expect(result.decision).toBe('AUTHORIZED');
    if (result.decision === 'AUTHORIZED') {
      expect(result.item.incomingDataAuthority.state).toBe('CURRENTLY_USABLE');
      expect('incomingFieldsVisible' in result.item.incomingDataAuthority).toBe(false);
      expect(result.item.incomingDataAuthority.embeddedPrivateFieldValues).toBe(false);
    }
  });

  it('maps revoked exact Handoff to DENIED and authority outage to SOURCE_UNAVAILABLE', async () => {
    const lineage = { findAllocationLineage: vi.fn().mockResolvedValue(exactLineage()) };
    const denied = await service(lineage, {
      schemaVersion: 1,
      decision: 'DENY',
      currentlyUsable: false,
      currentExactDisclosurePermitted: false,
      denialReason: 'HANDOFF_REVOKED',
      validationPolicyVersion: 'mgsn-controlled-handoff-validation-v1',
      checkedAuthorityReferences: [],
      validationIsNotBearerCapability: true,
      validationDoesNotAuthorizeDownstreamAction: true
    }).read(principal, baseItem.allocation.allocationId);
    expect(denied.decision).toBe('AUTHORIZED');
    if (denied.decision === 'AUTHORIZED') {
      expect(denied.item.incomingDataAuthority).toMatchObject({
        state: 'DENIED',
        denialReason: 'HANDOFF_REVOKED',
        incomingFieldsVisible: false
      });
    }

    const unavailable = new GovernedProviderWorkReadModelService(
      baseRead() as never,
      lineage,
      { validateCurrent: vi.fn().mockRejectedValue(new Error('down')) } as never
    );
    const outage = await unavailable.read(principal, baseItem.allocation.allocationId);
    expect(outage.decision).toBe('AUTHORIZED');
    if (outage.decision === 'AUTHORIZED') {
      expect(outage.item.incomingDataAuthority).toMatchObject({
        state: 'SOURCE_UNAVAILABLE',
        reason: 'DEPENDENCY_UNAVAILABLE',
        incomingFieldsVisible: false
      });
    }
  });
});
