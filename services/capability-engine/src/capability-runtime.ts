import { createHash, randomUUID } from 'node:crypto';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import {
  capabilityRuntimeNoAuthorityConsequences,
  parseCapabilityRequestV2Command,
  type CapabilityComposition,
  type CapabilityEligibilityDecision,
  type CapabilityInvocation,
  type CapabilityOutcome,
  type CapabilityRequestV2,
  type CapabilityRequestV2Command,
  type CapabilityReturn,
  type CapabilityUsage,
  type ImplementationBinding,
  type ImplementationProfile,
  type SessionReceipt
} from '@markorbit/contracts/capability-runtime';

export type GovernedCapabilityRuntimeErrorCode =
  | 'CAPABILITY_NOT_FOUND'
  | 'CAPABILITY_VERSION_MISMATCH'
  | 'NO_APPROVED_IMPLEMENTATION'
  | 'IMPLEMENTATION_NOT_ADMITTED'
  | 'CALLER_NOT_ALLOWED'
  | 'SCHEMA_MISMATCH'
  | 'RISK_NOT_ALLOWED'
  | 'INPUT_CONTRACT_INVALID'
  | 'IDEMPOTENCY_CONFLICT';

export class GovernedCapabilityRuntimeError extends Error {
  constructor(
    readonly code: GovernedCapabilityRuntimeErrorCode,
    message: string,
    readonly status = 409
  ) {
    super(message);
    this.name = 'GovernedCapabilityRuntimeError';
  }
}

export interface RuntimeCapabilityDefinitionResolver {
  findCurrent(capabilityId: string): Promise<RuntimeCapabilityDefinition | undefined>;
}

export interface GovernedImplementationSelection {
  profile: Readonly<ImplementationProfile>;
  policyVersion: string;
}

export interface ImplementationProfileSelector {
  select(
    request: Readonly<CapabilityRequestV2>,
    definition: Readonly<RuntimeCapabilityDefinition>
  ): Promise<GovernedImplementationSelection | undefined>;
}

export interface CapabilityContractValidator {
  validate(schemaId: string, value: unknown): boolean;
}

export interface CapabilityImplementationExecutionResult {
  output: unknown;
  evidenceRefs?: readonly string[];
  usage?: Readonly<CapabilityUsage>;
  requiresReview?: boolean;
}

export interface CapabilityImplementationExecutor {
  execute(
    request: Readonly<CapabilityRequestV2>,
    binding: Readonly<ImplementationBinding>
  ): Promise<CapabilityImplementationExecutionResult>;
}

export interface CapabilityRuntimeExecution {
  request: Readonly<CapabilityRequestV2>;
  eligibility: Readonly<CapabilityEligibilityDecision>;
  composition: Readonly<CapabilityComposition>;
  binding: Readonly<ImplementationBinding>;
  invocation: Readonly<CapabilityInvocation>;
  outcome: Readonly<CapabilityOutcome>;
  returnValue: Readonly<CapabilityReturn>;
  receipt: Readonly<SessionReceipt>;
  replayed: boolean;
}

export interface CapabilityRuntimeIdFactory {
  capabilityRequest(): CapabilityRequestV2['capabilityRequestId'];
  implementationBinding(): ImplementationBinding['implementationBindingId'];
  capabilityInvocation(): CapabilityInvocation['capabilityInvocationId'];
  capabilityOutcome(): CapabilityOutcome['capabilityOutcomeId'];
  capabilityReturn(): CapabilityReturn['capabilityReturnId'];
  sessionReceipt(): SessionReceipt['sessionReceiptId'];
}

export interface GovernedCapabilityRuntimeOptions {
  definitions: RuntimeCapabilityDefinitionResolver;
  implementations: ImplementationProfileSelector;
  inputContracts: CapabilityContractValidator;
  outputContracts: CapabilityContractValidator;
  executor: CapabilityImplementationExecutor;
  now?: () => string;
  ids?: CapabilityRuntimeIdFactory;
  admittedImplementationKinds?: ReadonlySet<ImplementationProfile['kind']>;
}

type StoredExecution = {
  fingerprint: string;
  execution: CapabilityRuntimeExecution;
};

const RISK_RANK = Object.freeze({ LOW: 0, MODERATE: 1, HIGH: 2, PROTECTED: 3 });

function uuid(prefix: string): `${string}_${string}` {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

function defaultIds(): CapabilityRuntimeIdFactory {
  return {
    capabilityRequest: () => uuid('capreq') as CapabilityRequestV2['capabilityRequestId'],
    implementationBinding: () =>
      uuid('implementation-binding') as ImplementationBinding['implementationBindingId'],
    capabilityInvocation: () =>
      uuid('capability-invocation') as CapabilityInvocation['capabilityInvocationId'],
    capabilityOutcome: () => uuid('capability-outcome') as CapabilityOutcome['capabilityOutcomeId'],
    capabilityReturn: () => uuid('capability-return') as CapabilityReturn['capabilityReturnId'],
    sessionReceipt: () => uuid('session-receipt') as SessionReceipt['sessionReceiptId']
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function fingerprint(command: CapabilityRequestV2Command): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(command))).digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function completedStatus(outcome: CapabilityOutcome): CapabilityReturn['status'] {
  if (outcome.status === 'SUCCEEDED') return 'COMPLETED';
  if (outcome.status === 'REQUIRES_REVIEW') return 'REVIEW_REQUIRED';
  return 'FAILED';
}

export class GovernedCapabilityRuntime {
  private readonly now: () => string;
  private readonly ids: CapabilityRuntimeIdFactory;
  private readonly admittedImplementationKinds: ReadonlySet<ImplementationProfile['kind']>;
  private readonly completed = new Map<string, StoredExecution>();
  private readonly inFlight = new Map<string, { fingerprint: string; result: Promise<CapabilityRuntimeExecution> }>();

  constructor(private readonly options: GovernedCapabilityRuntimeOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.ids = options.ids ?? defaultIds();
    this.admittedImplementationKinds =
      options.admittedImplementationKinds ?? new Set<ImplementationProfile['kind']>(['DETERMINISTIC_SERVICE']);
  }

  async invoke(value: unknown): Promise<CapabilityRuntimeExecution> {
    const command = parseCapabilityRequestV2Command(value);
    const requestFingerprint = fingerprint(command);
    const completed = this.completed.get(command.idempotencyKey);
    if (completed) {
      if (completed.fingerprint !== requestFingerprint) this.throwConflict();
      return { ...clone(completed.execution), replayed: true };
    }

    const inFlight = this.inFlight.get(command.idempotencyKey);
    if (inFlight) {
      if (inFlight.fingerprint !== requestFingerprint) this.throwConflict();
      const execution = await inFlight.result;
      return { ...clone(execution), replayed: true };
    }

    const result = this.execute(command, requestFingerprint);
    this.inFlight.set(command.idempotencyKey, { fingerprint: requestFingerprint, result });
    try {
      return await result;
    } finally {
      this.inFlight.delete(command.idempotencyKey);
    }
  }

  private async execute(
    command: CapabilityRequestV2Command,
    requestFingerprint: string
  ): Promise<CapabilityRuntimeExecution> {
    const receivedAt = this.now();
    const request: CapabilityRequestV2 = {
      ...clone(command),
      capabilityRequestId: this.ids.capabilityRequest(),
      receivedAt
    };

    if (!this.options.inputContracts.validate(request.inputSchemaId, request.input))
      throw new GovernedCapabilityRuntimeError(
        'INPUT_CONTRACT_INVALID',
        'Capability input does not satisfy the declared governed input contract.',
        422
      );

    const definition = await this.options.definitions.findCurrent(request.capabilityId);
    if (!definition)
      throw new GovernedCapabilityRuntimeError(
        'CAPABILITY_NOT_FOUND',
        'No accepted runtime Capability definition exists for this capability.',
        404
      );
    if (definition.capabilityVersion !== request.capabilityVersion)
      throw new GovernedCapabilityRuntimeError(
        'CAPABILITY_VERSION_MISMATCH',
        'The requested Capability version is not the current accepted runtime definition.',
        409
      );

    const selected = await this.options.implementations.select(request, definition);
    if (!selected || selected.profile.status !== 'APPROVED')
      throw new GovernedCapabilityRuntimeError(
        'NO_APPROVED_IMPLEMENTATION',
        'No approved implementation profile is available for this request.',
        409
      );
    const profile = selected.profile;
    this.validateProfile(request, definition, profile);

    const decidedAt = this.now();
    const eligibility: CapabilityEligibilityDecision = {
      schemaVersion: 1,
      capabilityRequestId: request.capabilityRequestId,
      decision: 'ELIGIBLE',
      eligible: true,
      policyVersion: selected.policyVersion,
      reason: 'Accepted Capability definition and approved implementation profile matched exactly.',
      decidedAt
    };
    const composition: CapabilityComposition = {
      schemaVersion: 1,
      capabilityRequestId: request.capabilityRequestId,
      mode: 'SINGLE_IMPLEMENTATION',
      primaryImplementationProfileId: profile.implementationProfileId,
      supportingImplementationProfileIds: [],
      criticImplementationProfileIds: [],
      composedAt: this.now()
    };
    const binding: ImplementationBinding = {
      schemaVersion: 1,
      implementationBindingId: this.ids.implementationBinding(),
      capabilityRequestId: request.capabilityRequestId,
      runtimeCapability: {
        id: definition.runtimeCapabilityDefinitionId,
        version: definition.version,
        capabilityId: definition.capabilityId,
        capabilityVersion: definition.capabilityVersion
      },
      implementation: {
        id: profile.implementationProfileId,
        version: profile.version,
        implementationKey: profile.implementationKey,
        kind: profile.kind
      },
      selectionPolicyVersion: selected.policyVersion,
      boundAt: this.now()
    };
    const invocation: CapabilityInvocation = {
      schemaVersion: 1,
      capabilityInvocationId: this.ids.capabilityInvocation(),
      capabilityRequestId: request.capabilityRequestId,
      implementationBindingId: binding.implementationBindingId,
      attempt: 1,
      timeoutMs: profile.timeoutMs,
      status: 'STARTED',
      startedAt: this.now()
    };

    let outcome: CapabilityOutcome;
    try {
      const implementationResult = await this.options.executor.execute(request, binding);
      const completedAt = this.now();
      invocation.status = 'COMPLETED';
      invocation.completedAt = completedAt;
      if (!this.options.outputContracts.validate(request.outputSchemaId, implementationResult.output)) {
        outcome = {
          schemaVersion: 1,
          capabilityOutcomeId: this.ids.capabilityOutcome(),
          capabilityRequestId: request.capabilityRequestId,
          capabilityInvocationId: invocation.capabilityInvocationId,
          status: 'FAILED',
          outputSchemaId: request.outputSchemaId,
          error: {
            code: 'OUTPUT_CONTRACT_INVALID',
            message: 'Implementation output failed the governed output contract.',
            retryable: false
          },
          evidenceRefs: [...(implementationResult.evidenceRefs ?? [])],
          ...(implementationResult.usage ? { usage: clone(implementationResult.usage) } : {}),
          completedAt,
          authority: capabilityRuntimeNoAuthorityConsequences
        };
      } else {
        outcome = {
          schemaVersion: 1,
          capabilityOutcomeId: this.ids.capabilityOutcome(),
          capabilityRequestId: request.capabilityRequestId,
          capabilityInvocationId: invocation.capabilityInvocationId,
          status: implementationResult.requiresReview ? 'REQUIRES_REVIEW' : 'SUCCEEDED',
          outputSchemaId: request.outputSchemaId,
          output: clone(implementationResult.output),
          evidenceRefs: [...(implementationResult.evidenceRefs ?? [])],
          ...(implementationResult.usage ? { usage: clone(implementationResult.usage) } : {}),
          completedAt,
          authority: capabilityRuntimeNoAuthorityConsequences
        };
      }
    } catch (error) {
      const completedAt = this.now();
      invocation.status = 'FAILED';
      invocation.completedAt = completedAt;
      outcome = {
        schemaVersion: 1,
        capabilityOutcomeId: this.ids.capabilityOutcome(),
        capabilityRequestId: request.capabilityRequestId,
        capabilityInvocationId: invocation.capabilityInvocationId,
        status: 'FAILED',
        outputSchemaId: request.outputSchemaId,
        error: {
          code: 'IMPLEMENTATION_FAILED',
          message: error instanceof Error ? error.message : 'Implementation failed.',
          retryable: false
        },
        evidenceRefs: [],
        completedAt,
        authority: capabilityRuntimeNoAuthorityConsequences
      };
    }

    const returnValue: CapabilityReturn = {
      schemaVersion: 1,
      capabilityReturnId: this.ids.capabilityReturn(),
      capabilityRequestId: request.capabilityRequestId,
      capabilityOutcomeId: outcome.capabilityOutcomeId,
      status: completedStatus(outcome),
      outputSchemaId: outcome.outputSchemaId,
      ...(outcome.output !== undefined ? { output: clone(outcome.output) } : {}),
      ...(outcome.error ? { error: clone(outcome.error) } : {}),
      evidenceRefs: [...outcome.evidenceRefs],
      returnedAt: this.now(),
      authority: capabilityRuntimeNoAuthorityConsequences
    };
    const receipt: SessionReceipt = {
      schemaVersion: 1,
      sessionReceiptId: this.ids.sessionReceipt(),
      capabilityRequestId: request.capabilityRequestId,
      correlationId: request.correlationId,
      workspaceId: request.caller.workspaceId,
      principalId: request.caller.principalId,
      callerProduct: request.caller.callerProduct,
      runtimeCapability: clone(binding.runtimeCapability),
      implementation: {
        id: binding.implementation.id,
        version: binding.implementation.version,
        implementationKey: binding.implementation.implementationKey
      },
      capabilityInvocationId: invocation.capabilityInvocationId,
      capabilityOutcomeId: outcome.capabilityOutcomeId,
      capabilityReturnId: returnValue.capabilityReturnId,
      evidenceRefs: [...outcome.evidenceRefs],
      createdAt: this.now(),
      authority: capabilityRuntimeNoAuthorityConsequences
    };
    const execution: CapabilityRuntimeExecution = {
      request,
      eligibility,
      composition,
      binding,
      invocation,
      outcome,
      returnValue,
      receipt,
      replayed: false
    };
    this.completed.set(request.idempotencyKey, {
      fingerprint: requestFingerprint,
      execution: clone(execution)
    });
    return clone(execution);
  }

  private validateProfile(
    request: CapabilityRequestV2,
    definition: RuntimeCapabilityDefinition,
    profile: Readonly<ImplementationProfile>
  ): void {
    if (!this.admittedImplementationKinds.has(profile.kind))
      throw new GovernedCapabilityRuntimeError(
        'IMPLEMENTATION_NOT_ADMITTED',
        `Implementation kind ${profile.kind} is not admitted by this runtime stage.`,
        409
      );
    if (
      profile.capabilityId !== definition.capabilityId ||
      profile.capabilityVersion !== definition.capabilityVersion
    )
      throw new GovernedCapabilityRuntimeError(
        'CAPABILITY_VERSION_MISMATCH',
        'Implementation profile is not bound to the exact accepted Capability version.',
        409
      );
    if (
      profile.inputSchemaId !== request.inputSchemaId ||
      profile.outputSchemaId !== request.outputSchemaId
    )
      throw new GovernedCapabilityRuntimeError(
        'SCHEMA_MISMATCH',
        'Implementation profile schema binding does not match the request.',
        409
      );
    if (
      !profile.allowedCallerProducts.includes('*') &&
      !profile.allowedCallerProducts.includes(request.caller.callerProduct)
    )
      throw new GovernedCapabilityRuntimeError(
        'CALLER_NOT_ALLOWED',
        'Caller product is not admitted by the implementation profile.',
        403
      );
    if (RISK_RANK[request.riskClass] > RISK_RANK[profile.maximumRiskClass])
      throw new GovernedCapabilityRuntimeError(
        'RISK_NOT_ALLOWED',
        'Requested risk class exceeds the implementation profile admission envelope.',
        403
      );
    if (profile.maxAttempts !== 1)
      throw new GovernedCapabilityRuntimeError(
        'IMPLEMENTATION_NOT_ADMITTED',
        'The minimum Capability runtime admits exactly one deterministic execution attempt.',
        409
      );
  }

  private throwConflict(): never {
    throw new GovernedCapabilityRuntimeError(
      'IDEMPOTENCY_CONFLICT',
      'Idempotency key was already used with a different normalized Capability request.',
      409
    );
  }
}
