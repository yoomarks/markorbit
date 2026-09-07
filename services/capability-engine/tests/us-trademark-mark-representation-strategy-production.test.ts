import { describe, expect, it } from 'vitest';

import { USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE } from '@markorbit/contracts/brain-us-trademark-mark-representation-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';
import { noRecommendationSourceAuthorityConsequences } from '@markorbit/contracts/markreg-early-funnel';

import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeExecution
} from '../src/capability-runtime.js';
import { InMemoryCapabilityRuntimeReplayStoreV1 } from '../src/capability-runtime-replay-store.js';
import { DurableGovernedCapabilityRuntimeV1 } from '../src/durable-governed-capability-runtime.js';
import { CurrentProductionSourceEvidenceAuthorityV1 } from '../src/production-source-evidence-authority.js';
import {
  CapabilityProductionSourceEvidenceReadServiceV1,
  capabilityProductionSourceExecutionReferenceV1
} from '../src/production-source-evidence-read.js';
import {
  UsTrademarkMarkRepresentationMethodReaderError,
  type CurrentUsTrademarkMarkRepresentationMethodSnapshotV1,
  type UsTrademarkMarkRepresentationMethodReaderV1
} from '../src/us-trademark-mark-representation-method-http-reader.js';
import {
  US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_DEFINITION,
  US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID,
  US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION,
  US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE,
  createUsTrademarkMarkRepresentationStrategyExecutorV1,
  validateUsTrademarkMarkRepresentationStrategyInputV1,
  validateUsTrademarkMarkRepresentationStrategyOutputV1
} from '../src/us-trademark-mark-representation-strategy-source.js';
const EXECUTED_AT = '2026-09-07T00:10:00.000Z';
const EVALUATED_AT = '2026-09-07T00:12:00.000Z';

function input(overrides: Record<string, unknown> = {}) {
  return {
    businessContext: 'Prepare a bounded US trademark filing strategy review.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs LLC', country: 'US' },
    trademark: { type: 'WORD', representationText: 'MARK ORBIT' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Software for trademark portfolio management.' },
    filingGoal: 'Prepare a US application for human attorney review.',
    ...overrides
  };
}

function command(idempotencyKey: string, value: unknown = input()): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID,
    capabilityVersion: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_markreg_848',
      principalId: 'principal_markreg_848',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_markreg_848'
    },
    purpose: 'Produce bounded US mark-representation strategy material for human review.',
    input: value,
    inputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE.inputSchemaId,
    outputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE.outputSchemaId,
    riskClass: 'LOW',
    idempotencyKey,
    correlationId: `correlation_${idempotencyKey}`
  };
}

function snapshot(asOf: string): CurrentUsTrademarkMarkRepresentationMethodSnapshotV1 {
  return {
    schemaVersion: 1,
    currentness: 'CURRENT',
    currentnessMechanism:
      'CORE_BRAIN_ASSET_LATEST_ACTIVE_PLUS_EXACT_KNOWLEDGE_REFERENCE_IDENTITY_AND_CAPTURE_WINDOW',
    brainAssetId: 'brain-asset_us-trademark-mark-representation-strategy',
    brainAssetVersionId: 'brain-asset-version_us-trademark-mark-representation-strategy-active-v1',
    methodId: 'brain-method_us-trademark-mark-representation-strategy',
    methodVersionId: 'brain-method-version_us-trademark-mark-representation-strategy-20260906',
    methodFingerprintSha256: 'eb9fe8e8814c37b713409c45f9dec633712e2684df4886760b0776c21e2ac26a',
    packageId: 'executable-method-package_us-trademark-mark-representation-strategy-20260906',
    packageVersion: 2,
    packageFingerprintSha256: '6877e2ae2bfa659595f3997e312aad933f65976cbb825678e41d47126443ed41',
    activatedAt: '2026-09-06T19:05:00.000Z',
    activationDecisionId:
      'brain-method-activation_c0cfc431db2ec1f8047b554aeeb67cedee64d971d37e0488efefdad39921c2b9',
    activationEvidenceRef:
      'brain-method-activation:brain-method-activation_c0cfc431db2ec1f8047b554aeeb67cedee64d971d37e0488efefdad39921c2b9:fb97d07eca29ac78cc2098893a03a752f98a4bd35e9291e2d8b6407bbfbb135c',
    inputSchemaId: 'brain-input.us-trademark-mark-representation-strategy.v1',
    outputSchemaId: 'brain.us-trademark-mark-representation-strategy.v1',
    referenceDependency:
      'knowledge-reference.uspto-mark-drawing-strategy.us-trademark-mark-representation.v1',
    sourceReference: {
      ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
      currentness: 'CURRENT'
    },
    knowledgeGovernanceRef:
      'github:yoomarks/markorbit-knowledge@7ba94f5e7d45bd451d6ac25d5b509a600da43b7f',
    currentnessCheckedAt: asOf,
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  };
}

function currentMethods(): UsTrademarkMarkRepresentationMethodReaderV1 {
  return { resolveCurrent: (query) => Promise.resolve(snapshot(query.asOf)) };
}

function staleMethods(): UsTrademarkMarkRepresentationMethodReaderV1 {
  return {
    resolveCurrent: () =>
      Promise.reject(
        new UsTrademarkMarkRepresentationMethodReaderError(
          'NO_CURRENT_METHOD',
          'The governed USPTO reference capture is stale.'
        )
      )
  };
}

function runtime() {
  return new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: () => Promise.resolve(US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_DEFINITION)
    },
    implementations: {
      select: () =>
        Promise.resolve({
          profile: US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE,
          policyVersion: 'capability-us-trademark-mark-representation-selection.v1'
        })
    },
    inputContracts: {
      validate: (schemaId, value) =>
        schemaId === US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE.inputSchemaId &&
        validateUsTrademarkMarkRepresentationStrategyInputV1(value)
    },
    outputContracts: {
      validate: (schemaId, value) =>
        schemaId === US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE.outputSchemaId &&
        validateUsTrademarkMarkRepresentationStrategyOutputV1(value)
    },
    executor: createUsTrademarkMarkRepresentationStrategyExecutorV1(),
    now: () => EXECUTED_AT
  });
}

function authority(methods: UsTrademarkMarkRepresentationMethodReaderV1 = currentMethods()) {
  return new CurrentProductionSourceEvidenceAuthorityV1({
    capabilities: {
      findCurrent: (capabilityId) =>
        Promise.resolve(
          capabilityId === US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID
            ? US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_DEFINITION
            : undefined
        )
    },
    implementations: {
      findCurrent: (implementationProfileId) =>
        implementationProfileId ===
        US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE.implementationProfileId
          ? US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE
          : undefined
    },
    references: {
      resolveCurrent: () => Promise.reject(new Error('official-fee reader must not be used'))
    },
    methods,
    now: () => EVALUATED_AT
  });
}

async function persisted(idempotencyKey: string, value: unknown = input()) {
  const store = new InMemoryCapabilityRuntimeReplayStoreV1();
  const execution = await new DurableGovernedCapabilityRuntimeV1({
    runtime: runtime(),
    replayStore: store,
    now: () => EXECUTED_AT,
    ownerTokenFactory: () => `owner_${idempotencyKey}`
  }).invoke(command(idempotencyKey, value));
  return { store, execution };
}

function read(
  store: InMemoryCapabilityRuntimeReplayStoreV1,
  execution: Readonly<CapabilityRuntimeExecution>,
  methods: UsTrademarkMarkRepresentationMethodReaderV1 = currentMethods()
) {
  return new CapabilityProductionSourceEvidenceReadServiceV1({
    replayStore: store,
    evidence: authority(methods)
  }).read(capabilityProductionSourceExecutionReferenceV1(execution));
}

function cloneExecution(
  execution: Readonly<CapabilityRuntimeExecution>
): CapabilityRuntimeExecution {
  return structuredClone(execution);
}

describe('#848 US trademark Recommendation-capable source', () => {
  it('admits exact deterministic output and exposes bounded Recommendation material', async () => {
    const first = await persisted('strategy-positive-848');
    const result = await read(first.store, first.execution);

    expect(result.status).toBe('PRODUCTION_ADMISSIBLE');
    if (result.status !== 'PRODUCTION_ADMISSIBLE') throw new Error('expected production source');
    expect(result.recommendationMaterial).toMatchObject({
      outputFamilyId: 'us-trademark-mark-representation-strategy',
      outputFamilyVersion: 1,
      applicability: { status: 'APPLICABLE' }
    });
    expect(result.recommendationMaterial?.analyzedInputFingerprintSha256).toBe(
      (first.execution.returnValue.output as Record<string, unknown>).analyzedInputFingerprintSha256
    );
    expect(result.source.methodSource).toMatchObject({
      methodId: 'brain-method_us-trademark-mark-representation-strategy',
      packageVersion: '2'
    });
    expect(Object.values(result.authority).every((value) => value === false)).toBe(true);
    expect(
      Object.values(result.recommendationMaterial?.authorityConsequences ?? {}).every(
        (value) => value === false
      )
    ).toBe(true);

    const second = await persisted('strategy-deterministic-848');
    expect(second.execution.returnValue.output).toEqual(first.execution.returnValue.output);
  });

  it.each([
    ['non-US target', { targetJurisdictions: ['CA'] }],
    ['mark type OTHER', { trademark: { type: 'OTHER', representationText: 'MARK ORBIT' } }],
    ['empty representation', { trademark: { type: 'WORD', representationText: '' } }]
  ])('denies explicit NOT_APPLICABLE case: %s', async (label, overrides) => {
    const scenario = await persisted(
      `strategy-not-applicable-${label.replaceAll(' ', '-')}`,
      input(overrides)
    );
    expect(
      (scenario.execution.returnValue.output as { applicability: { status: string } }).applicability
        .status
    ).toBe('NOT_APPLICABLE');
    const result = await read(scenario.store, scenario.execution);
    expect(result.status).toBe('DENIED');
    expect('recommendationMaterial' in result).toBe(false);
  });

  it('denies stale/no-current Core Method authority', async () => {
    const scenario = await persisted('strategy-stale-848');
    await expect(read(scenario.store, scenario.execution, staleMethods())).resolves.toMatchObject({
      status: 'DENIED',
      denial: { code: 'SOURCE_REFERENCE_NOT_CURRENT' }
    });
  });

  it('fails closed on Intake fingerprint tamper and unknown/generic-AI producer family', async () => {
    const execution = await runtime().invoke(command('strategy-tamper-848'));
    const tampered = cloneExecution(execution);
    const output = tampered.returnValue.output as Record<string, unknown>;
    output.analyzedInputFingerprintSha256 = '0'.repeat(64);
    await expect(authority().evaluate(tampered)).resolves.toMatchObject({ status: 'DENIED' });

    const unknown = cloneExecution(execution);
    (unknown.request as { capabilityId: string }).capabilityId = 'managed-ai-execution';
    await expect(authority().evaluate(unknown)).resolves.toMatchObject({
      status: 'DENIED',
      denial: { code: 'UNSUPPORTED_PRODUCER_FAMILY' }
    });
  });
});
