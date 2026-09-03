import { describe, expect, it } from 'vitest';

import { compileUsptoOfficialFeeMethodPackageV1 } from '@markorbit/contracts/brain-official-fee-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';
import {
  CapabilityRuntimeReplayStoreError,
  InMemoryCapabilityRuntimeReplayStoreV1,
  type CapabilityRuntimeReplayStoreV1
} from '../src/capability-runtime-replay-store.js';
import { DurableGovernedCapabilityRuntimeV1 } from '../src/durable-governed-capability-runtime.js';
import {
  CapabilityProductionSourceEvidenceReadServiceV1,
  capabilityProductionSourceExecutionReferenceV1
} from '../src/production-source-evidence-read.js';
import {
  USPTO_OFFICIAL_FEE_GOVERNED_COMPILATION_INPUT_V1,
  createApprovedUsptoOfficialFeeResolverCapabilityExecutorV1,
  materializeApprovedUsptoOfficialFeeGovernedActivationV1
} from '../src/uspto-official-fee-production-promotion.js';
import { createUsptoOfficialFeeProductionSourceEvidenceAuthorityV1 } from '../src/uspto-official-fee-production-source-evidence.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
  USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
  validateUsptoOfficialFeeResolverInputV1,
  validateUsptoOfficialFeeResolverOutputV1
} from '../src/uspto-official-fee-resolver-pilot.js';

const EFFECTIVE_FROM = '2025-01-18T00:00:00.000-05:00';
const MATERIALIZED_AT = '2026-08-28T00:00:00.000Z';
const EVALUATED_AT = '2026-09-03T02:30:00.000Z';
const EXECUTED_AT = '2026-09-03T02:20:00.000Z';

function acceptedPackage() {
  const compiled = compileUsptoOfficialFeeMethodPackageV1(
    USPTO_OFFICIAL_FEE_GOVERNED_COMPILATION_INPUT_V1
  );
  if (compiled.status !== 'READY') throw new Error(`unexpected package status ${compiled.status}`);
  return compiled.package;
}

function acceptedReference(amountMinor: number = 35000) {
  const pkg = acceptedPackage();
  return {
    schemaVersion: 1,
    referenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
    operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
    jurisdiction: 'US',
    authority: 'USPTO',
    currency: 'USD',
    amountMinor,
    unit: 'PER_CLASS',
    effectiveFrom: EFFECTIVE_FROM,
    status: 'CURRENT',
    packageId: pkg.packageId,
    methodId: pkg.methodId,
    methodVersionId: pkg.methodVersionId,
    knowledgeSources: structuredClone(pkg.lineage.knowledgeSources),
    sourceIdentityFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
    materializationFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
    materializedAt: MATERIALIZED_AT
  } as const;
}

function command(idempotencyKey = 'uspto-production-source-read-1'): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_uspto_production_source_read',
      principalId: 'principal_uspto_production_source_read',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_uspto_production_source_read'
    },
    purpose: 'Read exact current production source evidence from durable Capability truth.',
    input: {
      jurisdiction: 'US',
      authority: 'USPTO',
      objectType: 'TRADEMARK_APPLICATION',
      operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
      procedure: 'ELECTRONIC_FILING',
      stage: 'NEW_APPLICATION',
      filingBasis: 'SECTION_1',
      segment: 'BASE_FEE',
      classCount: 2,
      asOf: '2026-08-28T00:00:00.000Z',
      acceptedReferenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID
    },
    inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
    outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey,
    correlationId: `correlation_${idempotencyKey}`
  };
}

function baseRuntime(reference = acceptedReference()) {
  return new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
    },
    implementations: {
      select: () =>
        Promise.resolve({
          profile: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
          policyVersion: 'phase4-uspto-official-fee-method-selection.v1'
        })
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
    executor: createApprovedUsptoOfficialFeeResolverCapabilityExecutorV1({
      resolveCurrent: () => reference
    }),
    now: () => EXECUTED_AT
  });
}

function evidenceAuthority(reference = acceptedReference()) {
  return createUsptoOfficialFeeProductionSourceEvidenceAuthorityV1({
    capabilities: {
      findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
    },
    implementations: {
      findCurrent: () => USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
    },
    references: {
      resolveCurrent: () => reference
    },
    now: () => EVALUATED_AT
  });
}

function reader(
  store: CapabilityRuntimeReplayStoreV1,
  reference = acceptedReference()
): CapabilityProductionSourceEvidenceReadServiceV1 {
  return new CapabilityProductionSourceEvidenceReadServiceV1({
    replayStore: store,
    evidence: evidenceAuthority(reference)
  });
}

async function persistProductionExecution(
  store: CapabilityRuntimeReplayStoreV1,
  request = command()
) {
  const runtime = new DurableGovernedCapabilityRuntimeV1({
    runtime: baseRuntime(),
    replayStore: store,
    now: () => EXECUTED_AT,
    ownerTokenFactory: () => 'owner_uspto_production_source_read'
  });
  return runtime.invoke(request);
}

function differentSha(value: string): string {
  return `${value[0] === 'a' ? 'b' : 'a'}${value.slice(1)}`;
}

describe('trusted production source evidence read V1', () => {
  it('replays durable execution truth and deterministically projects the live USPTO V5 source', async () => {
    const store = new InMemoryCapabilityRuntimeReplayStoreV1();
    const execution = await persistProductionExecution(store);
    const reference = capabilityProductionSourceExecutionReferenceV1(execution);
    const service = reader(store);

    const first = await service.read(reference);
    const second = await service.read(reference);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schemaVersion: 1,
      status: 'PRODUCTION_ADMISSIBLE',
      historical: {
        capabilityRequestId: execution.request.capabilityRequestId,
        sessionReceiptId: execution.receipt.sessionReceiptId
      },
      source: {
        admission: 'PRODUCTION_ADMISSIBLE',
        evidence: { evidenceVersion: 5 },
        admissionPolicy: {
          policyId: 'source-admission-policy.uspto-official-fee-resolver.v2',
          policyVersion: 2
        },
        sourceUse: { currentness: 'CURRENT' }
      }
    });
    if (first.status !== 'PRODUCTION_ADMISSIBLE') throw new Error('expected production source');
    expect(first.source.methodSource?.activationId).toBe(
      materializeApprovedUsptoOfficialFeeGovernedActivationV1().decision.decisionId
    );
    expect(Object.values(first.authority).every((value) => value === false)).toBe(true);
    expect(Object.values(first.source.authority).every((value) => value === false)).toBe(true);
  });

  it('fails closed for missing, conflicting, mismatched and in-progress replay identities', async () => {
    const populated = new InMemoryCapabilityRuntimeReplayStoreV1();
    const execution = await persistProductionExecution(populated);
    const reference = capabilityProductionSourceExecutionReferenceV1(execution);

    await expect(
      reader(new InMemoryCapabilityRuntimeReplayStoreV1()).read(reference)
    ).resolves.toMatchObject({
      status: 'NOT_FOUND'
    });
    await expect(
      reader(populated).read({
        ...reference,
        requestFingerprintSha256: differentSha(reference.requestFingerprintSha256)
      })
    ).resolves.toMatchObject({ status: 'CONFLICT', denial: { code: 'REPLAY_IDENTITY_CONFLICT' } });
    await expect(
      reader(populated).read({
        ...reference,
        sessionReceiptId: 'session-receipt_wrong-execution'
      })
    ).resolves.toMatchObject({
      status: 'CONFLICT',
      denial: { code: 'EXECUTION_REFERENCE_CONFLICT' }
    });

    const inProgress = new InMemoryCapabilityRuntimeReplayStoreV1();
    await inProgress.claim({
      idempotencyKey: reference.idempotencyKey,
      requestFingerprintSha256: reference.requestFingerprintSha256,
      ownerToken: 'owner_in_progress',
      now: EXECUTED_AT
    });
    await expect(reader(inProgress).read(reference)).resolves.toMatchObject({
      status: 'UNAVAILABLE',
      retryable: true,
      denial: { code: 'EXECUTION_IN_PROGRESS' }
    });
  });

  it('re-evaluates current Reference truth and denies a historically successful but stale source', async () => {
    const store = new InMemoryCapabilityRuntimeReplayStoreV1();
    const execution = await persistProductionExecution(store);
    const reference = capabilityProductionSourceExecutionReferenceV1(execution);
    const changedReference = acceptedReference(36000);

    await expect(reader(store, changedReference).read(reference)).resolves.toMatchObject({
      status: 'DENIED',
      denial: { code: 'SOURCE_REFERENCE_NOT_CURRENT' }
    });
  });

  it('does not reinterpret execution without the canonical ACTIVE successor evidence as production', async () => {
    const execution = await baseRuntime().invoke(command('uspto-production-source-read-legacy'));
    const activation = materializeApprovedUsptoOfficialFeeGovernedActivationV1();
    const activePackageRef = `brain-method-package:${activation.activePackage.packageId}@${activation.activePackage.packageVersion}`;
    const historicalOnly = {
      ...execution,
      outcome: {
        ...execution.outcome,
        evidenceRefs: execution.outcome.evidenceRefs.filter((ref) => ref !== activePackageRef)
      },
      returnValue: {
        ...execution.returnValue,
        evidenceRefs: execution.returnValue.evidenceRefs.filter((ref) => ref !== activePackageRef)
      },
      receipt: {
        ...execution.receipt,
        evidenceRefs: execution.receipt.evidenceRefs.filter((ref) => ref !== activePackageRef)
      }
    };
    const store = new InMemoryCapabilityRuntimeReplayStoreV1();
    const reference = capabilityProductionSourceExecutionReferenceV1(historicalOnly);
    const claim = {
      idempotencyKey: reference.idempotencyKey,
      requestFingerprintSha256: reference.requestFingerprintSha256,
      ownerToken: 'owner_historical_only',
      now: EXECUTED_AT
    };
    await store.claim(claim);
    await store.complete({ ...claim, execution: historicalOnly });

    await expect(reader(store).read(reference)).resolves.toMatchObject({
      status: 'DENIED',
      denial: { code: 'SOURCE_REFERENCE_NOT_CURRENT' }
    });
  });

  it('maps replay persistence outage and persisted-integrity failure to typed unavailable results', async () => {
    const store = new InMemoryCapabilityRuntimeReplayStoreV1();
    const execution = await persistProductionExecution(store);
    const reference = capabilityProductionSourceExecutionReferenceV1(execution);

    function unavailableStore(
      code: 'PERSISTENCE_UNAVAILABLE' | 'INVALID_PERSISTED_REPLAY'
    ): CapabilityRuntimeReplayStoreV1 {
      const failure = () =>
        Promise.reject(new CapabilityRuntimeReplayStoreError(code, `forced ${code}`));
      return {
        inspect: failure,
        claim: failure,
        complete: failure,
        release: failure,
        waitForCompletion: failure
      };
    }

    await expect(
      reader(unavailableStore('PERSISTENCE_UNAVAILABLE')).read(reference)
    ).resolves.toMatchObject({
      status: 'UNAVAILABLE',
      retryable: true,
      denial: { code: 'PERSISTENCE_UNAVAILABLE' }
    });
    await expect(
      reader(unavailableStore('INVALID_PERSISTED_REPLAY')).read(reference)
    ).resolves.toMatchObject({
      status: 'UNAVAILABLE',
      retryable: false,
      denial: { code: 'INVALID_PERSISTED_REPLAY' }
    });
  });
});
