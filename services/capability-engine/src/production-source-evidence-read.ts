import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import type { CapabilityRuntimeExecution } from './capability-runtime.js';
import {
  CapabilityRuntimeReplayStoreError,
  type CapabilityRuntimeReplayStoreV1
} from './capability-runtime-replay-store.js';
import { capabilityRuntimeRequestFingerprintSha256V1 } from './durable-governed-capability-runtime.js';
import {
  CapabilitySourceAdmissionEvidenceV5Error,
  CurrentCapabilitySourceAdmissionEvidenceMaterializerV5,
  validCapabilitySourceAdmissionEvidenceV5,
  type CapabilitySourceAdmissionEvaluatorWithPolicyContentAuthorityV1,
  type CapabilitySourceAdmissionEvidenceV5
} from './current-source-admission-evidence-v5.js';
import type { CapabilitySourceUseContextAuthorityV1 } from './current-source-admission-evidence-v3.js';
import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from './current-source-admission.js';
import {
  projectCapabilityProductionSourceExplainabilityV1,
  type CapabilityProductionSourceExplainabilityV1
} from './production-source-explainability.js';

const SHA256 = /^[a-f0-9]{64}$/u;

export interface CapabilityProductionSourceExecutionReferenceV1 {
  readonly schemaVersion: 1;
  readonly idempotencyKey: string;
  readonly requestFingerprintSha256: string;
  readonly capabilityRequestId: string;
  readonly sessionReceiptId: string;
}

export interface CapabilityProductionSourceHistoricalExecutionV1 {
  readonly capabilityRequestId: string;
  readonly implementationBindingId: string;
  readonly capabilityInvocationId: string;
  readonly capabilityOutcomeId: string;
  readonly capabilityReturnId: string;
  readonly sessionReceiptId: string;
}

export type CapabilityProductionSourceEvidenceAuthorityResolutionV1 =
  | Readonly<{
      status: 'PRODUCTION_ADMISSIBLE';
      evidence: Readonly<CapabilitySourceAdmissionEvidenceV5>;
    }>
  | Readonly<{
      status: 'DENIED';
      historical: Readonly<CapabilityProductionSourceHistoricalExecutionV1>;
      denial: Readonly<{ code: string; reason: string }>;
    }>
  | Readonly<{
      status: 'UNAVAILABLE';
      retryable: boolean;
      denial: Readonly<{ code: string; reason: string }>;
    }>;

export interface CapabilityProductionSourceEvidenceAuthorityV1 {
  evaluate(
    execution: Readonly<CapabilityRuntimeExecution>
  ): Promise<CapabilityProductionSourceEvidenceAuthorityResolutionV1>;
}

export interface CurrentCapabilityProductionSourceEvidenceAuthorityOptionsV1 {
  readonly evaluator: Readonly<CapabilitySourceAdmissionEvaluatorWithPolicyContentAuthorityV1>;
  readonly sourceUse: Readonly<CapabilitySourceUseContextAuthorityV1>;
  readonly now: () => string;
}

export interface CapabilityProductionSourceEvidenceReadServiceOptionsV1 {
  readonly replayStore: Readonly<CapabilityRuntimeReplayStoreV1>;
  readonly evidence: Readonly<CapabilityProductionSourceEvidenceAuthorityV1>;
}

export type CapabilityProductionSourceEvidenceReadResultV1 =
  | Readonly<{
      schemaVersion: 1;
      status: 'PRODUCTION_ADMISSIBLE';
      reference: Readonly<CapabilityProductionSourceExecutionReferenceV1>;
      historical: Readonly<CapabilityProductionSourceHistoricalExecutionV1>;
      source: Readonly<CapabilityProductionSourceExplainabilityV1>;
      authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: 'DENIED';
      reference: Readonly<CapabilityProductionSourceExecutionReferenceV1>;
      historical: Readonly<CapabilityProductionSourceHistoricalExecutionV1>;
      denial: Readonly<{ code: string; reason: string }>;
      authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: 'NOT_FOUND';
      reference: Readonly<CapabilityProductionSourceExecutionReferenceV1>;
      authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: 'CONFLICT';
      reference: Readonly<CapabilityProductionSourceExecutionReferenceV1>;
      denial: Readonly<{ code: string; reason: string }>;
      authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: 'UNAVAILABLE';
      reference: Readonly<CapabilityProductionSourceExecutionReferenceV1>;
      retryable: boolean;
      denial: Readonly<{ code: string; reason: string }>;
      authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
    }>;

function text(value: unknown, field: string, maximum = 500): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    value.trim() !== value
  )
    throw new TypeError(`${field} must contain 1 to ${maximum} exact characters.`);
  return value;
}

function historical(
  execution: Readonly<CapabilityRuntimeExecution>
): CapabilityProductionSourceHistoricalExecutionV1 {
  return {
    capabilityRequestId: execution.request.capabilityRequestId,
    implementationBindingId: execution.binding.implementationBindingId,
    capabilityInvocationId: execution.invocation.capabilityInvocationId,
    capabilityOutcomeId: execution.outcome.capabilityOutcomeId,
    capabilityReturnId: execution.returnValue.capabilityReturnId,
    sessionReceiptId: execution.receipt.sessionReceiptId
  };
}

function commandFromExecution(
  execution: Readonly<CapabilityRuntimeExecution>
): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: execution.request.capabilityId,
    capabilityVersion: execution.request.capabilityVersion,
    caller: structuredClone(execution.request.caller),
    purpose: execution.request.purpose,
    input: structuredClone(execution.request.input),
    inputSchemaId: execution.request.inputSchemaId,
    outputSchemaId: execution.request.outputSchemaId,
    riskClass: execution.request.riskClass,
    idempotencyKey: execution.request.idempotencyKey,
    correlationId: execution.request.correlationId
  };
}

export function capabilityProductionSourceExecutionReferenceV1(
  execution: Readonly<CapabilityRuntimeExecution>
): Readonly<CapabilityProductionSourceExecutionReferenceV1> {
  const command = commandFromExecution(execution);
  return Object.freeze({
    schemaVersion: 1,
    idempotencyKey: command.idempotencyKey,
    requestFingerprintSha256: capabilityRuntimeRequestFingerprintSha256V1(command),
    capabilityRequestId: execution.request.capabilityRequestId,
    sessionReceiptId: execution.receipt.sessionReceiptId
  });
}

export function parseCapabilityProductionSourceExecutionReferenceV1(
  value: unknown
): Readonly<CapabilityProductionSourceExecutionReferenceV1> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Capability production source execution reference must be an object.');
  const input = value as Record<string, unknown>;
  const expected = [
    'schemaVersion',
    'idempotencyKey',
    'requestFingerprintSha256',
    'capabilityRequestId',
    'sessionReceiptId'
  ];
  const unknown = Object.keys(input).filter((key) => !expected.includes(key));
  if (unknown.length)
    throw new TypeError(
      `Capability production source execution reference has unsupported fields: ${unknown.join(', ')}.`
    );
  if (input.schemaVersion !== 1)
    throw new TypeError(
      'Capability production source execution reference schemaVersion must be 1.'
    );
  const idempotencyKey = text(input.idempotencyKey, 'idempotencyKey', 300);
  const requestFingerprintSha256 = text(
    input.requestFingerprintSha256,
    'requestFingerprintSha256',
    64
  );
  if (!SHA256.test(requestFingerprintSha256))
    throw new TypeError('requestFingerprintSha256 must be a lowercase SHA-256 digest.');
  const capabilityRequestId = text(input.capabilityRequestId, 'capabilityRequestId');
  const sessionReceiptId = text(input.sessionReceiptId, 'sessionReceiptId');
  if (!capabilityRequestId.startsWith('capreq_'))
    throw new TypeError('capabilityRequestId must be a governed Capability request id.');
  if (!sessionReceiptId.startsWith('session-receipt_'))
    throw new TypeError('sessionReceiptId must be a governed Capability session receipt id.');
  return Object.freeze({
    schemaVersion: 1,
    idempotencyKey,
    requestFingerprintSha256,
    capabilityRequestId,
    sessionReceiptId
  });
}

function sameReference(
  left: Readonly<CapabilityProductionSourceExecutionReferenceV1>,
  right: Readonly<CapabilityProductionSourceExecutionReferenceV1>
): boolean {
  return (
    left.idempotencyKey === right.idempotencyKey &&
    left.requestFingerprintSha256 === right.requestFingerprintSha256 &&
    left.capabilityRequestId === right.capabilityRequestId &&
    left.sessionReceiptId === right.sessionReceiptId
  );
}

function deniedFromDecision(
  decision: Extract<CapabilitySourceAdmissionDecision, { decision: 'DENIED' }>
): CapabilityProductionSourceEvidenceAuthorityResolutionV1 {
  return {
    status: 'DENIED',
    historical: {
      capabilityRequestId: decision.historical.capabilityRequestId,
      implementationBindingId: decision.historical.implementationBindingId,
      capabilityInvocationId: decision.historical.capabilityInvocationId,
      capabilityOutcomeId: decision.historical.capabilityOutcomeId,
      capabilityReturnId: decision.historical.capabilityReturnId,
      sessionReceiptId: decision.historical.sessionReceiptId
    },
    denial: {
      code: decision.denial.code,
      reason: decision.denial.reason
    }
  };
}

export class CurrentCapabilityProductionSourceEvidenceAuthorityV1 implements CapabilityProductionSourceEvidenceAuthorityV1 {
  constructor(
    private readonly options: Readonly<CurrentCapabilityProductionSourceEvidenceAuthorityOptionsV1>
  ) {}

  async evaluate(
    execution: Readonly<CapabilityRuntimeExecution>
  ): Promise<CapabilityProductionSourceEvidenceAuthorityResolutionV1> {
    let evaluation;
    try {
      evaluation = await this.options.evaluator.evaluate(execution);
    } catch {
      return {
        status: 'UNAVAILABLE',
        retryable: true,
        denial: {
          code: 'ADMISSION_EVALUATION_UNAVAILABLE',
          reason: 'Current Capability source-admission evaluation is unavailable.'
        }
      };
    }
    if (evaluation.decision.decision === 'DENIED') return deniedFromDecision(evaluation.decision);

    const fixedEvaluation = evaluation;
    const materializer = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV5({
      evaluator: {
        evaluate: () => Promise.resolve(fixedEvaluation)
      },
      sourceUse: this.options.sourceUse,
      now: this.options.now
    });
    try {
      const evidence = await materializer.evaluateAndMaterialize(execution);
      if (!validCapabilitySourceAdmissionEvidenceV5(evidence)) {
        return {
          status: 'DENIED',
          historical: historical(execution),
          denial: {
            code: 'INVALID_V5_PRODUCER_EVIDENCE',
            reason: 'Current Capability producer V5 evidence failed its canonical integrity check.'
          }
        };
      }
      return { status: 'PRODUCTION_ADMISSIBLE', evidence };
    } catch (error) {
      if (
        error instanceof CapabilitySourceAdmissionEvidenceV5Error &&
        error.code === 'SOURCE_USE_CONTEXT_UNAVAILABLE'
      ) {
        return {
          status: 'UNAVAILABLE',
          retryable: true,
          denial: { code: error.code, reason: error.message }
        };
      }
      return {
        status: 'DENIED',
        historical: historical(execution),
        denial: {
          code:
            error instanceof CapabilitySourceAdmissionEvidenceV5Error
              ? error.code
              : 'V5_MATERIALIZATION_FAILED',
          reason:
            error instanceof Error
              ? error.message
              : 'Current Capability producer V5 materialization failed closed.'
        }
      };
    }
  }
}

function replayUnavailable(
  reference: Readonly<CapabilityProductionSourceExecutionReferenceV1>,
  error: unknown
): CapabilityProductionSourceEvidenceReadResultV1 {
  if (error instanceof CapabilityRuntimeReplayStoreError) {
    return {
      schemaVersion: 1,
      status: 'UNAVAILABLE',
      reference,
      retryable: error.code === 'PERSISTENCE_UNAVAILABLE' || error.code === 'WAIT_TIMEOUT',
      denial: {
        code: error.code,
        reason: error.message
      },
      authority: capabilitySourceAdmissionNoAuthorityConsequences
    };
  }
  return {
    schemaVersion: 1,
    status: 'UNAVAILABLE',
    reference,
    retryable: true,
    denial: {
      code: 'REPLAY_READ_UNAVAILABLE',
      reason: 'Trusted governed Capability replay read is unavailable.'
    },
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
}

export class CapabilityProductionSourceEvidenceReadServiceV1 {
  constructor(
    private readonly options: Readonly<CapabilityProductionSourceEvidenceReadServiceOptionsV1>
  ) {}

  async read(value: unknown): Promise<CapabilityProductionSourceEvidenceReadResultV1> {
    const reference = parseCapabilityProductionSourceExecutionReferenceV1(value);
    let replay;
    try {
      replay = await this.options.replayStore.inspect({
        idempotencyKey: reference.idempotencyKey,
        requestFingerprintSha256: reference.requestFingerprintSha256
      });
    } catch (error) {
      return replayUnavailable(reference, error);
    }

    if (replay.kind === 'MISS') {
      return {
        schemaVersion: 1,
        status: 'NOT_FOUND',
        reference,
        authority: capabilitySourceAdmissionNoAuthorityConsequences
      };
    }
    if (replay.kind === 'CONFLICT') {
      return {
        schemaVersion: 1,
        status: 'CONFLICT',
        reference,
        denial: {
          code: 'REPLAY_IDENTITY_CONFLICT',
          reason:
            'The durable idempotency identity belongs to a different normalized Capability request.'
        },
        authority: capabilitySourceAdmissionNoAuthorityConsequences
      };
    }
    if (replay.kind === 'IN_PROGRESS') {
      return {
        schemaVersion: 1,
        status: 'UNAVAILABLE',
        reference,
        retryable: true,
        denial: {
          code: 'EXECUTION_IN_PROGRESS',
          reason:
            'The governed Capability execution is still in progress and has no immutable completed source yet.'
        },
        authority: capabilitySourceAdmissionNoAuthorityConsequences
      };
    }

    const producerReference = capabilityProductionSourceExecutionReferenceV1(replay.execution);
    if (!sameReference(reference, producerReference)) {
      return {
        schemaVersion: 1,
        status: 'CONFLICT',
        reference,
        denial: {
          code: 'EXECUTION_REFERENCE_CONFLICT',
          reason: 'The requested execution ids do not match the immutable producer replay.'
        },
        authority: capabilitySourceAdmissionNoAuthorityConsequences
      };
    }

    const evidence = await this.options.evidence.evaluate(replay.execution);
    if (evidence.status === 'UNAVAILABLE') {
      return {
        schemaVersion: 1,
        status: 'UNAVAILABLE',
        reference,
        retryable: evidence.retryable,
        denial: evidence.denial,
        authority: capabilitySourceAdmissionNoAuthorityConsequences
      };
    }
    if (evidence.status === 'DENIED') {
      return {
        schemaVersion: 1,
        status: 'DENIED',
        reference,
        historical: evidence.historical,
        denial: evidence.denial,
        authority: capabilitySourceAdmissionNoAuthorityConsequences
      };
    }

    let source: Readonly<CapabilityProductionSourceExplainabilityV1>;
    try {
      source = projectCapabilityProductionSourceExplainabilityV1(evidence.evidence);
    } catch {
      return {
        schemaVersion: 1,
        status: 'UNAVAILABLE',
        reference,
        retryable: false,
        denial: {
          code: 'PRODUCER_EVIDENCE_INTEGRITY_FAILURE',
          reason:
            'Current production source evidence could not be projected through the canonical producer read model.'
        },
        authority: capabilitySourceAdmissionNoAuthorityConsequences
      };
    }

    return Object.freeze({
      schemaVersion: 1,
      status: 'PRODUCTION_ADMISSIBLE',
      reference,
      historical: historical(replay.execution),
      source,
      authority: capabilitySourceAdmissionNoAuthorityConsequences
    });
  }
}
