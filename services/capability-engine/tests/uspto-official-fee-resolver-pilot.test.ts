import { describe, expect, it, vi } from 'vitest';

import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  compileUsptoOfficialFeeMethodPackageV1
} from '@markorbit/contracts/brain-official-fee-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
  USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
  createUsptoOfficialFeeResolverCapabilityExecutorV1,
  validateUsptoOfficialFeeResolverInputV1,
  validateUsptoOfficialFeeResolverOutputV1,
  type OfficialFeeReferenceReaderV1
} from '../src/uspto-official-fee-resolver-pilot.js';

const EFFECTIVE_FROM = '2025-01-18T00:00:00.000-05:00';
const MATERIALIZED_AT = '2026-08-28T00:00:00.000Z';
const AS_OF = '2026-08-28T00:00:00.000Z';

function acceptedPackage() {
  const compiled = compileUsptoOfficialFeeMethodPackageV1({
    knowledgeSources: structuredClone(USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE),
    temporalResolution: {
      status: 'RESOLVED',
      effectiveFrom: EFFECTIVE_FROM,
      evidenceRef: 'USPTO_TRADEMARK_FEE_FINAL_RULE_EFFECTIVE_2025_01_18'
    },
    conflictResolution: {
      status: 'NONE',
      evidenceRef: 'USPTO_DUAL_SOURCE_AUTHORITY_RECONCILIATION_2026_08_28'
    }
  });
  if (compiled.status !== 'READY') {
    throw new Error(`expected accepted Official Fee package, got ${compiled.status}`);
  }
  return compiled.package;
}

function acceptedReference(overrides: Record<string, unknown> = {}) {
  const pkg = acceptedPackage();
  return {
    schemaVersion: 1,
    referenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
    operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
    jurisdiction: 'US',
    authority: 'USPTO',
    currency: 'USD',
    amountMinor: 35000,
    unit: 'PER_CLASS',
    effectiveFrom: EFFECTIVE_FROM,
    status: 'CURRENT',
    packageId: pkg.packageId,
    methodId: pkg.methodId,
    methodVersionId: pkg.methodVersionId,
    knowledgeSources: structuredClone(pkg.lineage.knowledgeSources),
    sourceIdentityFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
    materializationFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
    materializedAt: MATERIALIZED_AT,
    ...overrides
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    jurisdiction: 'US',
    authority: 'USPTO',
    objectType: 'TRADEMARK_APPLICATION',
    operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
    procedure: 'ELECTRONIC_FILING',
    stage: 'NEW_APPLICATION',
    filingBasis: 'SECTION_1',
    segment: 'BASE_FEE',
    classCount: 2,
    asOf: AS_OF,
    acceptedReferenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
    ...overrides
  };
}

function command(overrides: Partial<CapabilityRequestV2Command> = {}): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_phase4_uspto_fee',
      principalId: 'principal_phase4_uspto_fee',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_phase4_uspto_fee'
    },
    purpose: 'Resolve the accepted USPTO electronic base application fee reference.',
    input: input(),
    inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
    outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'phase4-uspto-fee-resolver-1',
    correlationId: 'correlation_phase4_uspto_fee',
    ...overrides
  };
}

function runtimeWithReader(reader: OfficialFeeReferenceReaderV1) {
  const resolveCurrent = vi.spyOn(reader, 'resolveCurrent');
  const pkg = acceptedPackage();
  const executor = createUsptoOfficialFeeResolverCapabilityExecutorV1(pkg, reader);
  const runtime = new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: (capabilityId) =>
        Promise.resolve(
          capabilityId === USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID
            ? USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION
            : undefined
        )
    },
    implementations: {
      select: (request) =>
        Promise.resolve(
          request.capabilityId === USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID
            ? {
                profile: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
                policyVersion: 'phase4-uspto-official-fee-method-selection.v1'
              }
            : undefined
        )
    },
    inputContracts: {
      validate: (schemaId, value) =>
        schemaId === USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA &&
        validateUsptoOfficialFeeResolverInputV1(value)
    },
    outputContracts: {
      validate: (schemaId, value) =>
        schemaId === USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA &&
        validateUsptoOfficialFeeResolverOutputV1(value)
    },
    executor,
    now: () => '2026-08-29T04:20:00.000Z'
  });
  return { runtime, resolveCurrent, pkg };
}

describe('Phase 4 USPTO Official Fee Resolver Capability pilot', () => {
  it('resolves the exact accepted CURRENT Reference Store materialization through governed Capability', async () => {
    const reader: OfficialFeeReferenceReaderV1 = {
      resolveCurrent: () => acceptedReference()
    };
    const { runtime, resolveCurrent, pkg } = runtimeWithReader(reader);

    const execution = await runtime.invoke(command());

    expect(execution.returnValue.status).toBe('COMPLETED');
    expect(execution.outcome.status).toBe('SUCCEEDED');
    expect(execution.replayed).toBe(false);
    expect(resolveCurrent).toHaveBeenCalledTimes(1);
    expect(resolveCurrent).toHaveBeenCalledWith({
      operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
      jurisdiction: 'US',
      authority: 'USPTO',
      asOf: AS_OF
    });
    expect(execution.returnValue.output).toMatchObject({
      schemaVersion: 1,
      kind: 'OFFICIAL_SOURCE_RESOLUTION',
      jurisdiction: 'US',
      authority: 'USPTO',
      operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
      filingBasis: 'SECTION_1',
      classCount: 2,
      reference: {
        referenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
        currency: 'USD',
        amountMinor: 35000,
        unit: 'PER_CLASS',
        effectiveFrom: EFFECTIVE_FROM,
        packageId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID,
        methodId: pkg.methodId,
        methodVersionId: pkg.methodVersionId,
        sourceIdentityFingerprintSha256:
          USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
        replayIdentityFingerprintSha256:
          USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256,
        materializationFingerprintSha256:
          USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256
      },
      knowledgeResearchInvoked: false,
      referenceStoreReadControlled: true,
      productBusinessStateMutated: false
    });
    expect(execution.receipt.evidenceRefs).toContain(
      `brain-method-package:${pkg.packageId}@${pkg.packageVersion}`
    );
    expect(execution.receipt.evidenceRefs).toContain(
      `official-fee-reference:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID}`
    );
    expect(execution.receipt.evidenceRefs).toContain(
      `official-fee-replay-identity-sha256:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256}`
    );
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:knowledge-research-hot-path=absent'
    );
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:reference-store-read=controlled'
    );
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:product-business-state-write=absent'
    );
  });

  it('replays the governed result without reading the Reference Store twice', async () => {
    const reader: OfficialFeeReferenceReaderV1 = {
      resolveCurrent: () => acceptedReference()
    };
    const { runtime, resolveCurrent } = runtimeWithReader(reader);
    const request = command({ idempotencyKey: 'phase4-uspto-fee-replay' });

    const first = await runtime.invoke(request);
    const replay = await runtime.invoke(request);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(resolveCurrent).toHaveBeenCalledTimes(1);
    expect(replay.returnValue).toEqual(first.returnValue);
    expect(replay.receipt).toEqual(first.receipt);
  });

  it('fails closed when the controlled Reference Store returns stale or missing state', async () => {
    const staleReader: OfficialFeeReferenceReaderV1 = {
      resolveCurrent: () => acceptedReference({ status: 'STALE' })
    };
    const stale = runtimeWithReader(staleReader);
    const staleResult = await stale.runtime.invoke(
      command({ idempotencyKey: 'phase4-uspto-fee-stale' })
    );
    expect(staleResult.returnValue.status).toBe('FAILED');
    expect(staleResult.outcome.error?.message).toContain(
      'outside the accepted Phase 4 Resolver identity'
    );
    expect(stale.resolveCurrent).toHaveBeenCalledTimes(1);

    const missingReader: OfficialFeeReferenceReaderV1 = {
      resolveCurrent: () => undefined
    };
    const missing = runtimeWithReader(missingReader);
    const missingResult = await missing.runtime.invoke(
      command({ idempotencyKey: 'phase4-uspto-fee-missing' })
    );
    expect(missingResult.returnValue.status).toBe('FAILED');
    expect(missingResult.outcome.error?.message).toContain(
      'outside the accepted Phase 4 Resolver identity'
    );
    expect(missing.resolveCurrent).toHaveBeenCalledTimes(1);
  });

  it('preserves an ambiguous/conflicting Reference Store failure instead of inferring a fee', async () => {
    const reader: OfficialFeeReferenceReaderV1 = {
      resolveCurrent: () => {
        const error = new Error('Multiple CURRENT official fee references are effective.');
        Object.assign(error, { code: 'AMBIGUOUS_CURRENT_REFERENCE' });
        throw error;
      }
    };
    const { runtime, resolveCurrent } = runtimeWithReader(reader);

    const result = await runtime.invoke(command({ idempotencyKey: 'phase4-uspto-fee-conflict' }));

    expect(result.returnValue.status).toBe('FAILED');
    expect(result.outcome.error?.message).toContain('Multiple CURRENT official fee references');
    expect(resolveCurrent).toHaveBeenCalledTimes(1);
  });

  it('rejects wrong jurisdiction, wrong operation and reference substitution before store access', async () => {
    const reader: OfficialFeeReferenceReaderV1 = {
      resolveCurrent: () => acceptedReference()
    };
    const { runtime, resolveCurrent } = runtimeWithReader(reader);

    await expect(
      runtime.invoke(
        command({
          idempotencyKey: 'phase4-uspto-fee-wrong-jurisdiction',
          input: input({ jurisdiction: 'CA' })
        })
      )
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });
    await expect(
      runtime.invoke(
        command({
          idempotencyKey: 'phase4-uspto-fee-wrong-operation',
          input: input({ operation: 'USPTO_OTHER_FEE' })
        })
      )
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });
    await expect(
      runtime.invoke(
        command({
          idempotencyKey: 'phase4-uspto-fee-reference-substitution',
          input: input({ acceptedReferenceId: `official-fee-ref_${'f'.repeat(64)}` })
        })
      )
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });

    expect(resolveCurrent).not.toHaveBeenCalled();
  });

  it('recomputes materialization integrity and rejects payload or fingerprint substitution', async () => {
    const amountTampered = runtimeWithReader({
      resolveCurrent: () => acceptedReference({ amountMinor: 99999 })
    });
    const amountResult = await amountTampered.runtime.invoke(
      command({ idempotencyKey: 'phase4-uspto-fee-amount-tamper' })
    );
    expect(amountResult.returnValue.status).toBe('FAILED');
    expect(amountResult.outcome.error?.message).toContain(
      'Official Fee reference integrity verification failed'
    );

    const fingerprintTampered = runtimeWithReader({
      resolveCurrent: () => acceptedReference({ materializationFingerprintSha256: 'f'.repeat(64) })
    });
    const fingerprintResult = await fingerprintTampered.runtime.invoke(
      command({ idempotencyKey: 'phase4-uspto-fee-materialization-mismatch' })
    );
    expect(fingerprintResult.returnValue.status).toBe('FAILED');
    expect(fingerprintResult.outcome.error?.message).toContain(
      'outside the accepted Phase 4 Resolver identity'
    );
  });

  it('rejects a tampered executable package before Capability invocation', () => {
    const pkg = acceptedPackage();
    const tampered = { ...pkg, packageId: 'executable-method-package_tampered' };
    expect(() =>
      createUsptoOfficialFeeResolverCapabilityExecutorV1(tampered, {
        resolveCurrent: () => acceptedReference()
      })
    ).toThrow('does not match the explicit Phase 4 artifact acceptance decision');
  });
});
