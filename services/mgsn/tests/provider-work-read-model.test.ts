import { describe, expect, it, vi } from 'vitest';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import {
  ProviderWorkReadModelError,
  ProviderWorkReadModelService,
  type ProviderWorkProjectionSource,
  type ProviderWorkReadRepository
} from '../src/provider-work-read-model.js';
import type {
  ProviderRegistryRecord,
  ProviderRegistryRepository
} from '../src/provider-registry.js';

const checkedAt = '2026-09-01T12:00:00.000Z';
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const otherProviderWorkspaceId = '33333333-3333-4333-8333-333333333333';
const originatingWorkspaceId = '11111111-1111-4111-8111-111111111111';
const packageFingerprint = 'a'.repeat(64);
const acceptanceFingerprint = 'b'.repeat(64);
const returnFingerprint = 'c'.repeat(64);

function provider(
  providerId: ProviderId = 'provider_work_a',
  workspaceId = providerWorkspaceId,
  operationalStatus: ProviderRegistryRecord['operationalStatus'] = 'ACTIVE'
): ProviderRegistryRecord {
  return {
    schemaVersion: 1,
    providerId,
    providerWorkspaceId: workspaceId,
    displayName: 'Private Provider Name',
    operationalStatus,
    version: 1,
    createdBy: 'operator_private',
    updatedBy: 'operator_private',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
  };
}

function source(
  overrides: Partial<ProviderWorkProjectionSource> = {}
): ProviderWorkProjectionSource {
  return {
    providerId: 'provider_work_a',
    providerWorkspaceId,
    allocationId: 'allocation_work_a',
    allocationVersion: 1,
    allocationStatus: 'ACTIVE',
    allocationUpdatedAt: '2026-09-01T10:00:00.000Z',
    originatingWorkspaceId,
    allocationServicePackageId: 'service-package_work_a',
    allocationServicePackageVersion: 2,
    allocationServicePackageFingerprintSha256: packageFingerprint,
    servicePackageId: 'service-package_work_a',
    servicePackageVersion: 2,
    servicePackageFingerprintSha256: packageFingerprint,
    servicePackageWorkspaceId: originatingWorkspaceId,
    ...overrides
  };
}

function principal(workspaceId = providerWorkspaceId) {
  return {
    workspaceId,
    userId: `user-${workspaceId}`,
    membershipId: `membership-${workspaceId}`
  };
}

function setup(
  input: {
    rows?: ProviderWorkProjectionSource[];
    providers?: ProviderRegistryRecord[];
    fail?: boolean;
    now?: () => string;
  } = {}
) {
  const rows = input.rows ?? [source()];
  const providers = input.providers ?? [provider()];
  const listCurrentProviderWork = vi.fn(
    ({
      provider: selected
    }: Parameters<ProviderWorkReadRepository['listCurrentProviderWork']>[0]) => {
      if (input.fail) return Promise.reject(new Error('database offline'));
      return Promise.resolve(rows.filter((row) => row.providerId === selected.providerId));
    }
  );
  const findCurrentProviderWork = vi.fn(
    ({
      provider: selected,
      allocationId
    }: Parameters<ProviderWorkReadRepository['findCurrentProviderWork']>[0]) => {
      if (input.fail) return Promise.reject(new Error('database offline'));
      return Promise.resolve(
        rows.find(
          (row) => row.providerId === selected.providerId && row.allocationId === allocationId
        )
      );
    }
  );
  const repository: ProviderWorkReadRepository = {
    listCurrentProviderWork,
    findCurrentProviderWork
  };
  const registry = {
    findProviderByWorkspaceId: (workspaceId: string) =>
      Promise.resolve(
        providers.find(
          (record) => record.providerWorkspaceId.toLowerCase() === workspaceId.toLowerCase()
        )
      )
  } as unknown as ProviderRegistryRepository;
  return {
    repository,
    listCurrentProviderWork,
    service: new ProviderWorkReadModelService(repository, registry, input.now ?? (() => checkedAt))
  };
}

describe('Provider Workspace own-work read model', () => {
  it('lists only work bound to the trusted Provider Workspace, including inactive Provider history', async () => {
    const ownProvider = provider('provider_work_a', providerWorkspaceId, 'SUSPENDED');
    const otherProvider = provider('provider_work_b', otherProviderWorkspaceId);
    const { service } = setup({
      providers: [ownProvider, otherProvider],
      rows: [
        source(),
        source({
          providerId: otherProvider.providerId,
          providerWorkspaceId: otherProviderWorkspaceId,
          allocationId: 'allocation_work_b'
        })
      ]
    });

    const result = await service.list(principal());

    expect(result.items.map((item) => item.allocation.allocationId)).toEqual(['allocation_work_a']);
    expect(result.items[0]?.provider.providerId).toBe(ownProvider.providerId);
  });

  it('makes unknown and other-Provider detail reads publicly indistinguishable', async () => {
    const otherProvider = provider('provider_work_b', otherProviderWorkspaceId);
    const { service } = setup({ providers: [provider(), otherProvider] });

    const unknown = await service.read(principal(), 'allocation_unknown');
    const wrongProvider = await service.read(
      principal(otherProviderWorkspaceId),
      'allocation_work_a'
    );

    expect(unknown).toEqual(wrongProvider);
    expect(unknown.decision).toBe('NOT_FOUND_OR_NOT_AUTHORIZED');
  });

  it('projects authoritative Acceptance absence without inferring pending from ACTIVE', async () => {
    const { service } = setup();
    const result = await service.list(principal());
    const item = result.items[0]!;

    expect(item.responseState).toMatchObject({
      kind: 'KNOWN_ABSENT',
      allocationActiveDoesNotImplyPendingResponse: true
    });
    expect(
      item.sourceChecks.find((check) => check.sourceKind === 'PROVIDER_ACCEPTANCE')
    ).toMatchObject({ state: 'KNOWN_ABSENT' });
  });

  it.each(['ACCEPTED', 'DECLINED'] as const)('projects a bounded %s response', async (decision) => {
    const { service } = setup({
      rows: [
        source({
          providerAcceptanceId: 'provider-acceptance_work_a',
          providerAcceptanceVersion: 1,
          acceptanceAllocationId: 'allocation_work_a',
          acceptanceServicePackageId: 'service-package_work_a',
          acceptanceServicePackageVersion: 2,
          acceptanceProviderId: 'provider_work_a',
          acceptanceProviderWorkspaceId: providerWorkspaceId,
          acceptanceDecision: decision,
          acceptanceRespondedAt: '2026-09-01T10:30:00.000Z',
          acceptanceFingerprintSha256: acceptanceFingerprint
        })
      ]
    });

    const item = (await service.list(principal())).items[0]!;

    expect(item.responseState).toEqual({
      kind: 'KNOWN_RESPONSE',
      response: { id: 'provider-acceptance_work_a', version: 1 },
      decision,
      respondedAt: '2026-09-01T10:30:00.000Z',
      responseFingerprintSha256: acceptanceFingerprint
    });
    expect(JSON.stringify(item)).not.toContain('acknowledgement');
  });

  it('projects a current Return reference and preserves claim-not-truth semantics', async () => {
    const { service } = setup({
      rows: [
        source({
          providerReturnId: 'provider-return_work_a',
          providerReturnVersion: 3,
          returnAllocationId: 'allocation_work_a',
          returnServicePackageId: 'service-package_work_a',
          returnServicePackageVersion: 2,
          returnProviderId: 'provider_work_a',
          returnProviderWorkspaceId: providerWorkspaceId,
          returnStatus: 'CURRENT',
          returnSubmittedAt: '2026-09-01T11:00:00.000Z',
          returnFingerprintSha256: returnFingerprint
        })
      ]
    });

    const item = (await service.list(principal())).items[0]!;

    expect(item.returnState).toMatchObject({
      kind: 'KNOWN_RETURN',
      providerReturn: { id: 'provider-return_work_a', version: 3 },
      providerReturnRemainsClaimEvidenceNotOfficialTruth: true
    });
    expect(item.returnState).not.toHaveProperty('workStatusClaim');
    expect(item.returnState).not.toHaveProperty('assertions');
    expect(item.returnState).not.toHaveProperty('artifacts');
  });

  it('reports authoritative Return absence only after a successful query', async () => {
    const item = (await setup().service.list(principal())).items[0]!;
    expect(item.returnState.kind).toBe('KNOWN_ABSENT');
  });

  it('keeps incoming authority truthfully UNKNOWN and exposes no incoming values', async () => {
    const item = (await setup().service.list(principal())).items[0]!;
    expect(item.incomingDataAuthority).toEqual({
      state: 'UNKNOWN',
      checkedAt,
      reason: 'AUTHORITY_STATE_NOT_ESTABLISHED',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    });
    expect(
      item.sourceChecks.find((check) => check.sourceKind === 'INCOMING_DATA_AUTHORITY')
    ).toMatchObject({ state: 'UNAVAILABLE' });
  });

  it.each(['CANCELLED', 'SUPERSEDED'] as const)('preserves current %s history', async (status) => {
    const item = (
      await setup({ rows: [source({ allocationStatus: status })] }).service.list(principal())
    ).items[0]!;
    expect(item.allocation.status).toBe(status);
  });

  it('keeps source and projection fingerprints deterministic across read times', async () => {
    const first = (await setup({ now: () => '2026-09-01T12:00:00.000Z' }).service.list(principal()))
      .items[0]!;
    const restarted = (
      await setup({ now: () => '2026-09-02T12:00:00.000Z' }).service.list(principal())
    ).items[0]!;

    expect(restarted.sourceSetFingerprintSha256).toBe(first.sourceSetFingerprintSha256);
    expect(restarted.projectionFingerprintSha256).toBe(first.projectionFingerprintSha256);
    expect(restarted.projectedAt).not.toBe(first.projectedAt);
  });

  it('fails closed when persisted Service Package lineage is missing or inconsistent', async () => {
    const { service } = setup({
      rows: [source({ servicePackageFingerprintSha256: 'd'.repeat(64) })]
    });

    await expect(service.list(principal())).rejects.toMatchObject({
      code: 'SOURCE_INCONSISTENT',
      status: 503
    });
    await expect(service.read(principal(), 'allocation_work_a')).resolves.toMatchObject({
      decision: 'SOURCE_UNAVAILABLE'
    });
  });

  it('does not turn persistence failure into an empty list or known absence', async () => {
    const { service } = setup({ fail: true });

    await expect(service.list(principal())).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503
    });
    await expect(service.read(principal(), 'allocation_work_a')).resolves.toMatchObject({
      decision: 'SOURCE_UNAVAILABLE'
    });
  });

  it('enforces bounded query limits and deterministic keyset cursors', async () => {
    const rows = Array.from({ length: 3 }, (_, index) =>
      source({ allocationId: `allocation_work_${index}` })
    );
    const { service, listCurrentProviderWork } = setup({ rows });

    const first = await service.list(principal(), { limit: 2 });
    expect(first.page.nextCursor).toBeTypeOf('string');
    expect(listCurrentProviderWork).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
    await service.list(principal(), { limit: 2, cursor: first.page.nextCursor! });
    expect(listCurrentProviderWork).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursor: {
          updatedAt: '2026-09-01T10:00:00.000Z',
          allocationId: 'allocation_work_1'
        }
      })
    );
    await expect(service.list(principal(), { limit: 101 })).rejects.toBeInstanceOf(
      ProviderWorkReadModelError
    );
  });

  it('carries every privacy exclusion and authority consequence as false', async () => {
    const item = (await setup().service.list(principal())).items[0]!;
    expect(Object.values(item.privacyExclusions)).toEqual(
      Array(Object.keys(item.privacyExclusions).length).fill(false)
    );
    expect(Object.values(item.authorityConsequences)).toEqual(
      Array(Object.keys(item.authorityConsequences).length).fill(false)
    );
    const serialized = JSON.stringify(item);
    expect(serialized).not.toMatch(
      /Private Provider Name|operator_private|source_record|service_package_record/i
    );
    expect(item.allocation).not.toHaveProperty('rationale');
    expect(item.allocation).not.toHaveProperty('allocatedBy');
    expect(item).not.toHaveProperty('supplyCapability');
    expect(item.responseState).not.toHaveProperty('acknowledgement');
    expect(item.returnState).not.toHaveProperty('artifacts');
    expect(item.returnState).not.toHaveProperty('assertions');
  });
});
