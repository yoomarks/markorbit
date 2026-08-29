import { describe, expect, it } from 'vitest';
import type { FormalMatter, WorkspacePrincipal } from '@markorbit/contracts';
import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF,
  CN_DURATION_BAND_EXECUTABLE_KIND
} from '@markorbit/contracts/brain-cn-duration-band-classification';
import {
  capabilityRuntimeNoAuthorityConsequences,
  parseCapabilityRequestV2Command,
  type CapabilityRequestV2Command
} from '@markorbit/contracts/capability-runtime';
import {
  parseCnDurationBandClassificationOutputV1,
  parseGovernedCapabilityRuntimeExecutionV2
} from '@markorbit/contracts/capability-runtime-execution';
import {
  HttpCnDurationBandCapabilityClient,
  MatterIntelligenceError,
  MatterIntelligenceService,
  type MatterIntelligenceCapabilityClient,
  type MatterIntelligenceDisposition,
  type MatterIntelligenceRepository,
  type ValidatedDurationBandCapabilityResult
} from '../src/matter-intelligence.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const formalMatterId = 'formal-matter_phase5-one';
const datasetRef = CN_DURATION_BAND_ACCEPTED_DATASET_REF;
const evidenceRefs = [
  'brain-method-package:package_cn-duration@1',
  'brain-method:method_cn-duration',
  'brain-method-version:method-version_cn-duration',
  'brain-method-evaluation:evaluation_cn-duration',
  `research-dataset:${datasetRef}:accepted`
];

function principal(permissions: WorkspacePrincipal['permissions'] = ['workspace:read', 'matter:manage']) {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_phase5-one',
    userId: 'user_phase5-one',
    workspaceId,
    membershipId: 'membership_phase5-one',
    role: 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-08-31T00:00:00.000Z'
  } satisfies WorkspacePrincipal;
}

function matter(): FormalMatter {
  return {
    schemaVersion: 1,
    formalMatterId,
    workspaceId,
    kind: 'TRADEMARK_REGISTRATION',
    status: 'OPEN',
    version: 1,
    sourceCustomerConfirmationId: 'confirmation_phase5-one',
    sourceCustomerConfirmationVersion: 1,
    sourceMatterDraftId: 'matter-draft_phase5-one',
    sourceMatterDraftVersion: 1,
    sourceQuoteId: 'quote_phase5-one',
    sourceQuoteVersion: 'quote-v1',
    sourceSnapshot: {
      schemaVersion: 1,
      customerConfirmation: {
        id: 'confirmation_phase5-one',
        version: 1,
        status: 'CONFIRMED'
      },
      quote: { id: 'quote_phase5-one', version: 'quote-v1', currency: 'USD', totalMinor: 100 },
      matterDraft: {
        id: 'matter-draft_phase5-one',
        version: 1,
        status: 'READY_FOR_PROFESSIONAL_REVIEW',
        readiness: {
          evaluatedAt: '2026-08-30T00:00:00.000Z',
          readyForProfessionalReview: true,
          checks: []
        }
      },
      preparation: { classes: [9], documentReferences: [] }
    },
    snapshotSchemaVersion: 1,
    snapshotSha256: 'a'.repeat(64),
    createdByUserId: 'user_phase5-one',
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z'
  };
}

function durationOutput(days = 336) {
  return parseCnDurationBandClassificationOutputV1({
    schemaVersion: 1,
    kind: CN_DURATION_BAND_EXECUTABLE_KIND,
    jurisdiction: 'CN',
    procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
    observedCompletedDurationDays: days,
    historicalBand: days <= 335 ? 'LOWER_QUARTILE_OR_BELOW' : 'LOWER_INTERQUARTILE',
    datasetRefId: datasetRef,
    thresholds: { p25Days: 335, medianDays: 336, p75Days: 383 },
    semantics: 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION',
    descriptiveInterpretationOnly: true,
    legalConclusion: false,
    predictiveClaim: false,
    riskClaim: false,
    probabilityClaim: false,
    recommendation: false,
    currentCaseStatusInferred: false,
    productBusinessStateMutated: false
  });
}

function exactInput(days: number) {
  return {
    jurisdiction: 'CN',
    authority: 'CNIPA',
    objectType: 'TRADEMARK_APPLICATION',
    operation: 'CLASSIFY_COMPLETED_DURATION_HISTORICAL_BAND',
    procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
    stage: 'COMPLETED_INTERVAL_INTERPRETATION',
    filingBasis: 'ANY',
    segment: 'FILING_TO_PRELIM_PUBLICATION',
    availableData: ['OBSERVED_COMPLETED_DURATION_DAYS', 'ACCEPTED_CN_DURATION_DISTRIBUTION'],
    acceptedResearchDatasetRef: datasetRef,
    observedCompletedDurationDays: days
  };
}

function rawExecution(command: CapabilityRequestV2Command, suffix = 'one', output = durationOutput(336)) {
  const capabilityRequestId = `capreq_phase5-${suffix}`;
  const invocationId = `capability-invocation_phase5-${suffix}`;
  const outcomeId = `capability-outcome_phase5-${suffix}`;
  const returnId = `capability-return_phase5-${suffix}`;
  const receiptId = `session-receipt_phase5-${suffix}`;
  const bindingId = `implementation-binding_phase5-${suffix}`;
  const runtimeId = `runtime-capability_phase5-${suffix}`;
  const implementationId = `implementation-profile_phase5-${suffix}`;
  return {
    request: {
      ...command,
      capabilityRequestId,
      receivedAt: '2026-08-30T00:01:00.000Z'
    },
    eligibility: {
      schemaVersion: 1,
      capabilityRequestId,
      decision: 'ELIGIBLE',
      eligible: true,
      policyVersion: 'phase5-test-policy-v1',
      reason: 'Exact accepted test binding.',
      decidedAt: '2026-08-30T00:01:00.001Z'
    },
    composition: {
      schemaVersion: 1,
      capabilityRequestId,
      mode: 'SINGLE_IMPLEMENTATION',
      primaryImplementationProfileId: implementationId,
      supportingImplementationProfileIds: [],
      criticImplementationProfileIds: [],
      composedAt: '2026-08-30T00:01:00.002Z'
    },
    binding: {
      schemaVersion: 1,
      implementationBindingId: bindingId,
      capabilityRequestId,
      runtimeCapability: {
        id: runtimeId,
        version: 1,
        capabilityId: command.capabilityId,
        capabilityVersion: command.capabilityVersion
      },
      implementation: {
        id: implementationId,
        version: 1,
        implementationKey: 'brain-method-package-runtime.cn-duration-band-classification.v1',
        kind: 'DETERMINISTIC_SERVICE'
      },
      selectionPolicyVersion: 'phase5-test-policy-v1',
      boundAt: '2026-08-30T00:01:00.003Z'
    },
    invocation: {
      schemaVersion: 1,
      capabilityInvocationId: invocationId,
      capabilityRequestId,
      implementationBindingId: bindingId,
      attempt: 1,
      timeoutMs: 1000,
      status: 'COMPLETED',
      startedAt: '2026-08-30T00:01:00.004Z',
      completedAt: '2026-08-30T00:01:00.005Z'
    },
    outcome: {
      schemaVersion: 1,
      capabilityOutcomeId: outcomeId,
      capabilityRequestId,
      capabilityInvocationId: invocationId,
      status: 'SUCCEEDED',
      outputSchemaId: command.outputSchemaId,
      output,
      evidenceRefs,
      completedAt: '2026-08-30T00:01:00.005Z',
      authority: capabilityRuntimeNoAuthorityConsequences
    },
    returnValue: {
      schemaVersion: 1,
      capabilityReturnId: returnId,
      capabilityRequestId,
      capabilityOutcomeId: outcomeId,
      status: 'COMPLETED',
      outputSchemaId: command.outputSchemaId,
      output,
      evidenceRefs,
      returnedAt: '2026-08-30T00:01:00.006Z',
      authority: capabilityRuntimeNoAuthorityConsequences
    },
    receipt: {
      schemaVersion: 1,
      sessionReceiptId: receiptId,
      capabilityRequestId,
      correlationId: command.correlationId,
      workspaceId: command.caller.workspaceId,
      principalId: command.caller.principalId,
      callerProduct: command.caller.callerProduct,
      runtimeCapability: {
        id: runtimeId,
        version: 1,
        capabilityId: command.capabilityId,
        capabilityVersion: command.capabilityVersion
      },
      implementation: {
        id: implementationId,
        version: 1,
        implementationKey: 'brain-method-package-runtime.cn-duration-band-classification.v1'
      },
      capabilityInvocationId: invocationId,
      capabilityOutcomeId: outcomeId,
      capabilityReturnId: returnId,
      evidenceRefs,
      createdAt: '2026-08-30T00:01:00.006Z',
      authority: capabilityRuntimeNoAuthorityConsequences
    },
    replayed: false
  };
}

function resultFor(days = 336, suffix = 'one'): ValidatedDurationBandCapabilityResult {
  const caller = principal();
  const command: CapabilityRequestV2Command = {
    schemaVersion: 2,
    capabilityId: 'interpretation.cn-completed-duration-historical-band',
    capabilityVersion: '1.0.0',
    caller: {
      workspaceId,
      principalId: caller.userId,
      callerProduct: 'MARKREG',
      permissionContextRef: `core-workspace-membership:${caller.membershipId}`
    },
    purpose: `Record descriptive completed-duration historical band for MarkReg Formal Matter ${formalMatterId}.`,
    input: exactInput(days),
    inputSchemaId: 'brain-input.cn-completed-duration-historical-band.v1',
    outputSchemaId: 'brain.cn-completed-duration-historical-band.v1',
    riskClass: 'LOW',
    idempotencyKey: `capability-key-${suffix}`,
    correlationId: `correlation-${suffix}`
  };
  const output = durationOutput(days);
  const execution = parseGovernedCapabilityRuntimeExecutionV2(rawExecution(command, suffix, output));
  return {
    execution,
    output,
    methodPackageRef: evidenceRefs[0]!,
    methodRef: evidenceRefs[1]!,
    methodVersionRef: evidenceRefs[2]!,
    evaluationRef: evidenceRefs[3]!,
    researchDatasetRef: evidenceRefs[4]!,
    inputFingerprintSha256: 'b'.repeat(64),
    outputFingerprintSha256: 'c'.repeat(64),
    evidenceFingerprintSha256: 'd'.repeat(64)
  };
}

function memoryRepository() {
  let replay:
    | {
        workspaceId: string;
        idempotencyKey: string;
        requestFingerprintSha256: string;
        result: MatterIntelligenceDisposition;
      }
    | undefined;
  let writes = 0;
  const repository: MatterIntelligenceRepository = {
    findCommandReplay(requestWorkspaceId, idempotencyKey) {
      if (
        replay?.workspaceId === requestWorkspaceId &&
        replay.idempotencyKey === idempotencyKey
      ) {
        return Promise.resolve({
          requestFingerprintSha256: replay.requestFingerprintSha256,
          result: structuredClone(replay.result)
        });
      }
      return Promise.resolve(undefined);
    },
    record(value) {
      writes += 1;
      const result: MatterIntelligenceDisposition = {
        observation: structuredClone(value.observation),
        replayed: false,
        semanticDuplicate: false,
        capabilityReplayed: value.capabilityReplayed
      };
      replay = {
        workspaceId: value.observation.workspaceId,
        idempotencyKey: value.idempotencyKey,
        requestFingerprintSha256: value.requestFingerprintSha256,
        result: structuredClone(result)
      };
      return Promise.resolve(result);
    }
  };
  return { repository, writes: () => writes };
}

function command(days = 336, key = 'matter-intelligence-key-one') {
  return {
    workspaceId,
    formalMatterId,
    observedCompletedDurationDays: days,
    principal: principal(),
    idempotencyKey: key,
    correlationId: 'correlation-one'
  };
}

describe('MarkReg Matter Intelligence service boundary', () => {
  it('persists exact provenance once and resolves exact local replay without a second Capability call', async () => {
    const memory = memoryRepository();
    let capabilityCalls = 0;
    const capability: MatterIntelligenceCapabilityClient = {
      classifyCompletedDuration(input) {
        capabilityCalls += 1;
        return Promise.resolve(resultFor(input.observedCompletedDurationDays));
      }
    };
    const service = new MatterIntelligenceService(
      memory.repository,
      { findById: () => Promise.resolve(matter()) },
      capability,
      () => '2026-08-30T00:02:00.000Z',
      () => 'matter-intelligence-observation_phase5-one'
    );

    const first = await service.recordCompletedDurationBand(command());
    expect(first).toMatchObject({ replayed: false, semanticDuplicate: false });
    expect(first.observation).toMatchObject({
      workspaceId,
      formalMatter: {
        id: formalMatterId,
        version: 1,
        snapshotSha256: 'a'.repeat(64)
      },
      observationKind: 'CN_COMPLETED_DURATION_HISTORICAL_BAND',
      observedCompletedDurationDays: 336,
      historicalBand: 'LOWER_INTERQUARTILE',
      datasetRefId: datasetRef,
      methodPackageRef: evidenceRefs[0],
      methodRef: evidenceRefs[1],
      methodVersionRef: evidenceRefs[2],
      evaluationRef: evidenceRefs[3],
      researchDatasetRef: evidenceRefs[4],
      recordedByPrincipalId: 'user_phase5-one'
    });
    expect(first.observation.evidenceRefs).toEqual(evidenceRefs);
    expect(first.observation.capabilityReturnId).toBe('capability-return_phase5-one');
    expect(first.observation.sessionReceiptId).toBe('session-receipt_phase5-one');

    const replay = await service.recordCompletedDurationBand(command());
    expect(replay.replayed).toBe(true);
    expect(replay.observation).toEqual(first.observation);
    expect(capabilityCalls).toBe(1);
    expect(memory.writes()).toBe(1);
  });

  it('rejects conflicting product idempotency reuse before a second Capability call', async () => {
    const memory = memoryRepository();
    let capabilityCalls = 0;
    const service = new MatterIntelligenceService(
      memory.repository,
      { findById: () => Promise.resolve(matter()) },
      {
        classifyCompletedDuration(input) {
          capabilityCalls += 1;
          return Promise.resolve(resultFor(input.observedCompletedDurationDays));
        }
      }
    );
    await service.recordCompletedDurationBand(command(336, 'same-key'));
    await expect(service.recordCompletedDurationBand(command(337, 'same-key'))).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    } satisfies Partial<MatterIntelligenceError>);
    expect(capabilityCalls).toBe(1);
    expect(memory.writes()).toBe(1);
  });

  it('fails closed before Capability or persistence on missing Matter, wrong workspace or insufficient permission', async () => {
    const memory = memoryRepository();
    let capabilityCalls = 0;
    const capability: MatterIntelligenceCapabilityClient = {
      classifyCompletedDuration() {
        capabilityCalls += 1;
        return Promise.resolve(resultFor());
      }
    };
    const missing = new MatterIntelligenceService(
      memory.repository,
      { findById: () => Promise.resolve(null) },
      capability
    );
    await expect(missing.recordCompletedDurationBand(command())).rejects.toMatchObject({
      code: 'FORMAL_MATTER_NOT_FOUND'
    } satisfies Partial<MatterIntelligenceError>);

    const guarded = new MatterIntelligenceService(
      memory.repository,
      { findById: () => Promise.resolve(matter()) },
      capability
    );
    await expect(
      guarded.recordCompletedDurationBand({
        ...command(),
        workspaceId: '22222222-2222-4222-8222-222222222222'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' } satisfies Partial<MatterIntelligenceError>);
    await expect(
      guarded.recordCompletedDurationBand({
        ...command(),
        principal: principal(['workspace:read'])
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' } satisfies Partial<MatterIntelligenceError>);
    expect(capabilityCalls).toBe(0);
    expect(memory.writes()).toBe(0);
  });

  it('does not persist when Capability fails', async () => {
    const memory = memoryRepository();
    const service = new MatterIntelligenceService(
      memory.repository,
      { findById: () => Promise.resolve(matter()) },
      {
        classifyCompletedDuration() {
          return Promise.reject(
            new MatterIntelligenceError(
              'CAPABILITY_UNAVAILABLE',
              'Capability unavailable for test.',
              503,
              true
            )
          );
        }
      }
    );
    await expect(service.recordCompletedDurationBand(command())).rejects.toMatchObject({
      code: 'CAPABILITY_UNAVAILABLE'
    } satisfies Partial<MatterIntelligenceError>);
    expect(memory.writes()).toBe(0);
  });
});

describe('MarkReg governed Capability HTTP client', () => {
  it('sends exact MARKREG identity and accepts only the linked descriptive result', async () => {
    let capturedCommand: CapabilityRequestV2Command | undefined;
    let capturedHeaders: Headers | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      capturedHeaders = new Headers(init?.headers);
      capturedCommand = parseCapabilityRequestV2Command(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(rawExecution(capturedCommand, 'http', durationOutput(336))), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      });
    };
    const caller = principal();
    const client = new HttpCnDurationBandCapabilityClient(
      'http://capability.test',
      'phase5-test-internal-secret-long-enough-1234567890',
      fetcher
    );
    const result = await client.classifyCompletedDuration({
      workspaceId,
      formalMatterId,
      observedCompletedDurationDays: 336,
      principal: caller,
      productIdempotencyKey: 'product-key-http',
      correlationId: 'correlation-http'
    });
    expect(capturedCommand).toMatchObject({
      capabilityId: 'interpretation.cn-completed-duration-historical-band',
      capabilityVersion: '1.0.0',
      caller: {
        workspaceId,
        principalId: caller.userId,
        callerProduct: 'MARKREG',
        permissionContextRef: `core-workspace-membership:${caller.membershipId}`
      },
      inputSchemaId: 'brain-input.cn-completed-duration-historical-band.v1',
      outputSchemaId: 'brain.cn-completed-duration-historical-band.v1',
      riskClass: 'LOW',
      correlationId: 'correlation-http'
    });
    expect(capturedHeaders?.get('x-markorbit-caller-product')).toBe('MARKREG');
    expect(capturedHeaders?.get('x-markorbit-workspace-id')).toBe(workspaceId);
    expect(capturedHeaders?.get('idempotency-key')).toBe(capturedCommand?.idempotencyKey);
    expect(result.output.recommendation).toBe(false);
    expect(result.researchDatasetRef).toBe(evidenceRefs[4]);
  });

  it('fails closed on an unsafe descriptive output', async () => {
    const fetcher: typeof fetch = async (_input, init) => {
      const commandValue = parseCapabilityRequestV2Command(JSON.parse(String(init?.body)));
      const unsafeOutput = { ...durationOutput(336), recommendation: true };
      return new Response(JSON.stringify(rawExecution(commandValue, 'unsafe', unsafeOutput as never)), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      });
    };
    const client = new HttpCnDurationBandCapabilityClient(
      'http://capability.test',
      'phase5-test-internal-secret-long-enough-1234567890',
      fetcher
    );
    await expect(
      client.classifyCompletedDuration({
        workspaceId,
        formalMatterId,
        observedCompletedDurationDays: 336,
        principal: principal(),
        productIdempotencyKey: 'unsafe-key',
        correlationId: 'correlation-unsafe'
      })
    ).rejects.toMatchObject({
      code: 'CAPABILITY_CONTRACT_MISMATCH'
    } satisfies Partial<MatterIntelligenceError>);
  });

  it('maps runtime rejection, server failure and unreachable dependency without producing a result', async () => {
    const input = {
      workspaceId,
      formalMatterId,
      observedCompletedDurationDays: 336,
      principal: principal(),
      productIdempotencyKey: 'dependency-key',
      correlationId: 'correlation-dependency'
    };
    const rejected = new HttpCnDurationBandCapabilityClient(
      'http://capability.test',
      'phase5-test-internal-secret-long-enough-1234567890',
      async () => new Response(JSON.stringify({ code: 'CALLER_NOT_ALLOWED' }), { status: 409 })
    );
    await expect(rejected.classifyCompletedDuration(input)).rejects.toMatchObject({
      code: 'CAPABILITY_REJECTED',
      retryable: false
    } satisfies Partial<MatterIntelligenceError>);

    const unavailable = new HttpCnDurationBandCapabilityClient(
      'http://capability.test',
      'phase5-test-internal-secret-long-enough-1234567890',
      async () => new Response(JSON.stringify({ code: 'UPSTREAM_FAILED' }), { status: 503 })
    );
    await expect(unavailable.classifyCompletedDuration(input)).rejects.toMatchObject({
      code: 'CAPABILITY_UNAVAILABLE',
      retryable: true
    } satisfies Partial<MatterIntelligenceError>);

    const unreachable = new HttpCnDurationBandCapabilityClient(
      'http://capability.test',
      'phase5-test-internal-secret-long-enough-1234567890',
      async () => {
        throw new Error('connection refused');
      }
    );
    await expect(unreachable.classifyCompletedDuration(input)).rejects.toMatchObject({
      code: 'CAPABILITY_UNAVAILABLE',
      retryable: true
    } satisfies Partial<MatterIntelligenceError>);
  });
});
