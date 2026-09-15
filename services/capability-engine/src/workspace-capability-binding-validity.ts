import { createHash } from 'node:crypto';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import {
  workspaceCapabilityBindingFingerprintSha256V1,
  type WorkspaceCapabilityBindingId,
  type WorkspaceCapabilityBindingV1
} from '@markorbit/contracts/workspace-capability-binding';
import {
  workspaceCapabilityBindingValidityAuthorityV1,
  workspaceCapabilityBindingValidityObservationIdV1,
  type WorkspaceCapabilityBindingKnowledgeCurrentnessV1,
  type WorkspaceCapabilityBindingPolicyCurrentnessV1,
  type WorkspaceCapabilityBindingValidityIdentityV1,
  type WorkspaceCapabilityBindingValidityObservationV1,
  type WorkspaceCapabilityBindingValidityReasonCodeV1,
  type WorkspaceCapabilityBindingValidityStatusV1
} from '@markorbit/contracts/workspace-capability-binding-validity';
import {
  WorkspaceCapabilityBindingPolicyError,
  type WorkspaceCapabilityBindingPolicyTargetV1,
  type WorkspaceCapabilityBindingPolicyV1
} from './workspace-capability-binding-policy.js';
import {
  WorkspaceCapabilityBindingStoreError,
  type WorkspaceCapabilityBindingRepositoryV1
} from './workspace-capability-binding-store.js';
import {
  WorkspaceCapabilityBindingRevocationStoreError,
  workspaceCapabilityBindingRevocationFingerprintSha256V1,
  type WorkspaceCapabilityBindingRevocationRepositoryV1,
  type WorkspaceCapabilityBindingRevocationV1
} from './workspace-capability-binding-revocation-store.js';
import {
  workspaceKnowledgeEvidenceCurrentnessSnapshotSha256V1,
  type WorkspaceKnowledgeEvidenceCurrentnessAuthorityV1,
  type WorkspaceKnowledgeEvidenceCurrentnessResultV1
} from './workspace-capability-binding-currentness.js';
import {
  WorkspaceCapabilityBindingValidityStoreError,
  type WorkspaceCapabilityBindingValidityRepositoryV1
} from './workspace-capability-binding-validity-store.js';
import { workspaceCapabilityBindingSourceProjectionSha256V1 } from './workspace-capability-binding.js';
import type {
  WorkspaceTrademarkIssueIntelligenceReadinessServiceV1,
  WorkspaceTrademarkIssueIntelligenceReadinessV1
} from './workspace-trademark-issue-intelligence-readiness.js';

const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const BINDING_ID = /^workspace-capability-binding_[0-9a-f]{64}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export interface WorkspaceCapabilityBindingValidityEvaluateCommandV1 {
  workspaceId: string;
  bindingId: WorkspaceCapabilityBindingId;
}

export type WorkspaceCapabilityBindingValidityEvaluateStatusV1 =
  WorkspaceCapabilityBindingValidityStatusV1 | 'NOT_FOUND' | 'DEPENDENCY_UNAVAILABLE';
export interface WorkspaceCapabilityBindingValidityEvaluateResultV1 {
  schemaVersion: 1;
  status: WorkspaceCapabilityBindingValidityEvaluateStatusV1;
  evaluated: boolean;
  currentUsable: boolean;
  reference: Readonly<WorkspaceCapabilityBindingValidityEvaluateCommandV1>;
  reason: string;
  retryable: boolean;
  observation?: Readonly<WorkspaceCapabilityBindingValidityObservationV1>;
  replayed?: boolean;
}

export type WorkspaceCapabilityBindingValidityServiceErrorCode = 'INVALID_COMMAND';
export class WorkspaceCapabilityBindingValidityServiceError extends Error {
  constructor(
    readonly code: WorkspaceCapabilityBindingValidityServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'WorkspaceCapabilityBindingValidityServiceError';
  }
}

export interface WorkspaceCapabilityBindingValidityCapabilityReaderV1 {
  findVersion(
    runtimeCapabilityDefinitionId: WorkspaceCapabilityBindingV1['runtimeCapability']['id'],
    version: number
  ): Promise<RuntimeCapabilityDefinition | undefined>;
  findCurrent(capabilityId: string): Promise<RuntimeCapabilityDefinition | undefined>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  return value;
}
function truthSha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function exactCommand(
  value: Readonly<WorkspaceCapabilityBindingValidityEvaluateCommandV1>
): WorkspaceCapabilityBindingValidityEvaluateCommandV1 {
  const input = value as unknown;
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new WorkspaceCapabilityBindingValidityServiceError(
      'INVALID_COMMAND',
      'Workspace Capability binding validity command must be an object.'
    );
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== 'bindingId' ||
    keys[1] !== 'workspaceId' ||
    typeof record.workspaceId !== 'string' ||
    record.workspaceId.trim() !== record.workspaceId ||
    !WORKSPACE_UUID.test(record.workspaceId) ||
    typeof record.bindingId !== 'string' ||
    !BINDING_ID.test(record.bindingId)
  )
    throw new WorkspaceCapabilityBindingValidityServiceError(
      'INVALID_COMMAND',
      'Only canonical Workspace and binding identities are accepted.'
    );
  return {
    workspaceId: record.workspaceId.toLowerCase(),
    bindingId: record.bindingId as WorkspaceCapabilityBindingId
  };
}
function result(
  command: Readonly<WorkspaceCapabilityBindingValidityEvaluateCommandV1>,
  status: WorkspaceCapabilityBindingValidityEvaluateStatusV1,
  reason: string,
  options: Readonly<{
    retryable?: boolean;
    observation?: WorkspaceCapabilityBindingValidityObservationV1;
    replayed?: boolean;
  }> = {}
): Readonly<WorkspaceCapabilityBindingValidityEvaluateResultV1> {
  const observation = options.observation;
  return Object.freeze({
    schemaVersion: 1,
    status,
    evaluated: observation !== undefined,
    currentUsable: observation?.usable ?? false,
    reference: Object.freeze({ ...command }),
    reason,
    retryable: options.retryable ?? false,
    ...(observation ? { observation: Object.freeze(structuredClone(observation)) } : {}),
    ...(options.replayed === undefined ? {} : { replayed: options.replayed })
  });
}

function notEvaluatedKnowledge(
  binding: Readonly<WorkspaceCapabilityBindingV1>
): WorkspaceCapabilityBindingKnowledgeCurrentnessV1 {
  const evidenceRefs = [...binding.source.evidenceRefs];
  return {
    status: 'NOT_EVALUATED',
    evidenceRefs,
    ownerSnapshotSha256: workspaceKnowledgeEvidenceCurrentnessSnapshotSha256V1({
      owner: 'KNOWLEDGE',
      status: 'NOT_EVALUATED',
      evidenceRefs
    })
  };
}
function policyTruth(
  status: WorkspaceCapabilityBindingPolicyCurrentnessV1['status'],
  target?: Readonly<WorkspaceCapabilityBindingPolicyTargetV1>
): WorkspaceCapabilityBindingPolicyCurrentnessV1 {
  return {
    status,
    fingerprintSha256: truthSha256({
      owner: 'WORKSPACE_CAPABILITY_BINDING_POLICY',
      status,
      ...(target ? { target } : {})
    })
  };
}

function runtimeTruthSha256(
  status: 'CURRENT' | 'SUPERSEDED' | 'MISSING' | 'INTEGRITY_FAILURE' | 'NOT_EVALUATED',
  definition?: Readonly<RuntimeCapabilityDefinition>
): string {
  return truthSha256({
    owner: 'RUNTIME_CAPABILITY_REGISTRY',
    status,
    ...(definition ? { definition } : {})
  });
}

function runtimeMatchesBinding(
  definition: Readonly<RuntimeCapabilityDefinition>,
  binding: Readonly<WorkspaceCapabilityBindingV1>
): boolean {
  const target = binding.runtimeCapability;
  return (
    definition.runtimeCapabilityDefinitionId === target.id &&
    definition.version === target.version &&
    definition.capabilityId === target.capabilityId &&
    definition.capabilityVersion === target.capabilityVersion &&
    definition.acceptedCanonProjection === true &&
    definition.createdFromWorkEvidence === false &&
    definition.createdFromAiOutput === false &&
    definition.canonReference.canonId === target.canonReference.canonId &&
    definition.canonReference.canonVersion === target.canonReference.canonVersion &&
    definition.canonReference.sourceFingerprintSha256 ===
      target.canonReference.sourceFingerprintSha256
  );
}
function policyMatchesBinding(
  target: Readonly<WorkspaceCapabilityBindingPolicyTargetV1>,
  binding: Readonly<WorkspaceCapabilityBindingV1>
): boolean {
  return (
    target.policyId === binding.bindingPolicy.policyId &&
    target.policyVersion === binding.bindingPolicy.policyVersion &&
    target.ruleId === binding.bindingPolicy.ruleId &&
    target.capabilityId === binding.runtimeCapability.capabilityId &&
    target.capabilityVersion === binding.runtimeCapability.capabilityVersion
  );
}

function knowledgeTruth(
  value: Readonly<WorkspaceKnowledgeEvidenceCurrentnessResultV1>,
  binding: Readonly<WorkspaceCapabilityBindingV1>
): WorkspaceCapabilityBindingKnowledgeCurrentnessV1 | undefined {
  if (!SHA256.test(value.ownerSnapshotSha256)) return undefined;
  if (
    value.evidenceRefs.length !== binding.source.evidenceRefs.length ||
    value.evidenceRefs.some((reference, index) => reference !== binding.source.evidenceRefs[index])
  )
    return undefined;
  if (
    value.status !== 'CURRENT' &&
    value.status !== 'REVOKED' &&
    value.status !== 'SUPERSEDED' &&
    value.status !== 'CURRENTNESS_UNAVAILABLE'
  )
    return undefined;
  return {
    status: value.status,
    evidenceRefs: [...value.evidenceRefs],
    ownerSnapshotSha256: value.ownerSnapshotSha256
  };
}

interface ObservationInputV1 {
  status: WorkspaceCapabilityBindingValidityStatusV1;
  reasonCode: WorkspaceCapabilityBindingValidityReasonCodeV1;
  sourceTruthSha256: string;
  runtimeCapabilityTruthSha256: string;
  policy: WorkspaceCapabilityBindingPolicyCurrentnessV1;
  knowledge: WorkspaceCapabilityBindingKnowledgeCurrentnessV1;
  revocation: WorkspaceCapabilityBindingValidityIdentityV1['basis']['revocation'];
}
function observationIdentity(
  binding: Readonly<WorkspaceCapabilityBindingV1>,
  input: Readonly<ObservationInputV1>
): WorkspaceCapabilityBindingValidityIdentityV1 {
  return {
    schemaVersion: 1,
    workspaceId: binding.workspaceId,
    bindingId: binding.bindingId,
    bindingFingerprintSha256: workspaceCapabilityBindingFingerprintSha256V1(binding),
    status: input.status,
    usable: input.status === 'CURRENT',
    reasonCode: input.reasonCode,
    basis: {
      sourceTruthSha256: input.sourceTruthSha256,
      runtimeCapabilityTruthSha256: input.runtimeCapabilityTruthSha256,
      policy: input.policy,
      knowledge: input.knowledge,
      revocation: input.revocation
    },
    authority: workspaceCapabilityBindingValidityAuthorityV1
  };
}

function sourceFailureTruthSha256(
  binding: Readonly<WorkspaceCapabilityBindingV1>,
  readiness: Readonly<WorkspaceTrademarkIssueIntelligenceReadinessV1>
): string {
  return truthSha256({
    owner: 'BRAIN',
    status: readiness.status,
    reference: readiness.reference,
    expectedProjectionSha256: binding.source.projectionSha256
  });
}

function sourceCurrentTruthSha256(
  readiness: Readonly<WorkspaceTrademarkIssueIntelligenceReadinessV1>,
  projectionSha256: string
): string {
  return truthSha256({
    owner: 'BRAIN',
    status: readiness.status,
    projectionSha256
  });
}
function sourceNotEvaluatedTruthSha256(binding: Readonly<WorkspaceCapabilityBindingV1>): string {
  return truthSha256({
    owner: 'BRAIN',
    status: 'NOT_EVALUATED',
    workspaceId: binding.workspaceId,
    intelligenceId: binding.source.intelligenceId,
    expectedProjectionSha256: binding.source.projectionSha256
  });
}
function notEvaluatedPolicy(
  binding: Readonly<WorkspaceCapabilityBindingV1>
): WorkspaceCapabilityBindingPolicyCurrentnessV1 {
  return {
    status: 'NOT_EVALUATED',
    fingerprintSha256: truthSha256({
      owner: 'WORKSPACE_CAPABILITY_BINDING_POLICY',
      status: 'NOT_EVALUATED',
      bindingPolicy: binding.bindingPolicy
    })
  };
}

function notRevokedTruth(
  binding: Readonly<WorkspaceCapabilityBindingV1>
): WorkspaceCapabilityBindingValidityIdentityV1['basis']['revocation'] {
  return {
    status: 'NOT_REVOKED',
    fingerprintSha256: truthSha256({
      owner: 'WORKSPACE_CAPABILITY_BINDING_REVOCATION',
      status: 'NOT_REVOKED',
      workspaceId: binding.workspaceId,
      bindingId: binding.bindingId,
      bindingFingerprintSha256: workspaceCapabilityBindingFingerprintSha256V1(binding)
    })
  };
}

function revokedTruth(
  revocation: Readonly<WorkspaceCapabilityBindingRevocationV1>
): WorkspaceCapabilityBindingValidityIdentityV1['basis']['revocation'] {
  return {
    status: 'REVOKED',
    fingerprintSha256: workspaceCapabilityBindingRevocationFingerprintSha256V1(revocation)
  };
}

function revocationIntegrityFailureTruth(
  binding: Readonly<WorkspaceCapabilityBindingV1>
): WorkspaceCapabilityBindingValidityIdentityV1['basis']['revocation'] {
  return {
    status: 'INTEGRITY_FAILURE',
    fingerprintSha256: truthSha256({
      owner: 'WORKSPACE_CAPABILITY_BINDING_REVOCATION',
      status: 'INTEGRITY_FAILURE',
      workspaceId: binding.workspaceId,
      bindingId: binding.bindingId
    })
  };
}

export class WorkspaceCapabilityBindingValidityServiceV1 {
  constructor(
    private readonly bindings: Pick<WorkspaceCapabilityBindingRepositoryV1, 'find'>,
    private readonly readiness: Pick<
      WorkspaceTrademarkIssueIntelligenceReadinessServiceV1,
      'evaluate'
    >,
    private readonly policy: Readonly<WorkspaceCapabilityBindingPolicyV1>,
    private readonly capabilities: Readonly<WorkspaceCapabilityBindingValidityCapabilityReaderV1>,
    private readonly knowledge: Readonly<WorkspaceKnowledgeEvidenceCurrentnessAuthorityV1>,
    private readonly revocations: Pick<WorkspaceCapabilityBindingRevocationRepositoryV1, 'find'>,
    private readonly observations: Readonly<WorkspaceCapabilityBindingValidityRepositoryV1>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  private async recordObservation(
    command: Readonly<WorkspaceCapabilityBindingValidityEvaluateCommandV1>,
    binding: Readonly<WorkspaceCapabilityBindingV1>,
    input: Readonly<ObservationInputV1>,
    reason: string
  ): Promise<Readonly<WorkspaceCapabilityBindingValidityEvaluateResultV1>> {
    const identity = observationIdentity(binding, input);
    const candidate: WorkspaceCapabilityBindingValidityObservationV1 = {
      ...identity,
      observationId: workspaceCapabilityBindingValidityObservationIdV1(identity),
      evaluatedAt: new Date(this.now()).toISOString()
    };
    try {
      const recorded = await this.observations.record(candidate);
      return result(command, recorded.observation.status, reason, {
        observation: recorded.observation,
        replayed: recorded.replayed
      });
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingValidityStoreError) {
        if (
          error.code === 'INVALID_INPUT' ||
          error.code === 'IDENTITY_CONFLICT' ||
          error.code === 'PERSISTENCE_INTEGRITY_FAILURE'
        )
          return result(
            command,
            'INTEGRITY_FAILURE',
            'Workspace Capability binding validity persistence failed integrity checks.'
          );
        return result(
          command,
          'DEPENDENCY_UNAVAILABLE',
          'Workspace Capability binding validity persistence is unavailable.',
          { retryable: true }
        );
      }
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Workspace Capability binding validity persistence failed unexpectedly.',
        { retryable: true }
      );
    }
  }

  async evaluate(
    commandValue: Readonly<WorkspaceCapabilityBindingValidityEvaluateCommandV1>
  ): Promise<Readonly<WorkspaceCapabilityBindingValidityEvaluateResultV1>> {
    const command = exactCommand(commandValue);
    let binding: Readonly<WorkspaceCapabilityBindingV1> | undefined;
    try {
      binding = await this.bindings.find(command.workspaceId, command.bindingId);
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingStoreError) {
        if (
          error.code === 'INVALID_INPUT' ||
          error.code === 'IDENTITY_CONFLICT' ||
          error.code === 'PERSISTENCE_INTEGRITY_FAILURE'
        )
          return result(
            command,
            'INTEGRITY_FAILURE',
            'Historical Workspace Capability binding failed persistence integrity checks.'
          );
        return result(
          command,
          'DEPENDENCY_UNAVAILABLE',
          'Historical Workspace Capability binding persistence is unavailable.',
          { retryable: true }
        );
      }
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Historical Workspace Capability binding read failed unexpectedly.',
        { retryable: true }
      );
    }
    if (!binding)
      return result(
        command,
        'NOT_FOUND',
        'No Workspace Capability binding exists for the exact Workspace and binding identity.'
      );

    let revocation: Readonly<WorkspaceCapabilityBindingRevocationV1> | undefined;
    try {
      revocation = await this.revocations.find(binding.workspaceId, binding.bindingId);
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingRevocationStoreError) {
        if (
          error.code === 'INVALID_INPUT' ||
          error.code === 'IDENTITY_CONFLICT' ||
          error.code === 'PERSISTENCE_INTEGRITY_FAILURE'
        )
          return this.recordObservation(
            command,
            binding,
            {
              status: 'INTEGRITY_FAILURE',
              reasonCode: 'BINDING_REVOCATION_INTEGRITY_FAILURE',
              sourceTruthSha256: sourceNotEvaluatedTruthSha256(binding),
              runtimeCapabilityTruthSha256: runtimeTruthSha256('NOT_EVALUATED'),
              policy: notEvaluatedPolicy(binding),
              knowledge: notEvaluatedKnowledge(binding),
              revocation: revocationIntegrityFailureTruth(binding)
            },
            'Workspace Capability binding revocation owner truth failed integrity checks.'
          );
        return result(
          command,
          'DEPENDENCY_UNAVAILABLE',
          'Workspace Capability binding revocation owner truth is unavailable.',
          { retryable: true }
        );
      }
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Workspace Capability binding revocation owner truth failed unexpectedly.',
        { retryable: true }
      );
    }
    const bindingFingerprintSha256 = workspaceCapabilityBindingFingerprintSha256V1(binding);
    if (revocation && revocation.bindingFingerprintSha256 !== bindingFingerprintSha256)
      return this.recordObservation(
        command,
        binding,
        {
          status: 'INTEGRITY_FAILURE',
          reasonCode: 'BINDING_REVOCATION_INTEGRITY_FAILURE',
          sourceTruthSha256: sourceNotEvaluatedTruthSha256(binding),
          runtimeCapabilityTruthSha256: runtimeTruthSha256('NOT_EVALUATED'),
          policy: notEvaluatedPolicy(binding),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationIntegrityFailureTruth(binding)
        },
        'Workspace Capability binding revocation does not target the exact immutable binding fingerprint.'
      );
    if (revocation)
      return this.recordObservation(
        command,
        binding,
        {
          status: 'REVOKED',
          reasonCode: 'BINDING_REVOKED',
          sourceTruthSha256: sourceNotEvaluatedTruthSha256(binding),
          runtimeCapabilityTruthSha256: runtimeTruthSha256('NOT_EVALUATED'),
          policy: notEvaluatedPolicy(binding),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revokedTruth(revocation)
        },
        'The immutable Workspace Capability binding has an explicit durable revocation event.'
      );
    const revocationTruth = notRevokedTruth(binding);

    let readiness: Readonly<WorkspaceTrademarkIssueIntelligenceReadinessV1>;
    try {
      readiness = await this.readiness.evaluate({
        workspaceId: binding.workspaceId,
        intelligenceId: binding.source.intelligenceId
      });
    } catch {
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Workspace Brain intelligence readiness is unavailable.',
        { retryable: true }
      );
    }
    if (readiness.status === 'DEPENDENCY_UNAVAILABLE')
      return result(command, 'DEPENDENCY_UNAVAILABLE', readiness.reason, {
        retryable: readiness.retryable
      });

    if (
      !readiness.ready ||
      readiness.status !== 'READY_FOR_CAPABILITY_BINDING' ||
      !readiness.intelligence
    )
      return this.recordObservation(
        command,
        binding,
        {
          status: 'INTEGRITY_FAILURE',
          reasonCode: 'SOURCE_PROJECTION_INTEGRITY_FAILURE',
          sourceTruthSha256: sourceFailureTruthSha256(binding, readiness),
          runtimeCapabilityTruthSha256: runtimeTruthSha256('NOT_EVALUATED'),
          policy: notEvaluatedPolicy(binding),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationTruth
        },
        'Historical Brain source can no longer be proven as the exact bound intelligence projection.'
      );

    const sourceProjectionSha256 = workspaceCapabilityBindingSourceProjectionSha256V1(
      readiness.intelligence
    );
    const sourceTruthSha256 = sourceCurrentTruthSha256(readiness, sourceProjectionSha256);
    if (sourceProjectionSha256 !== binding.source.projectionSha256)
      return this.recordObservation(
        command,
        binding,
        {
          status: 'INTEGRITY_FAILURE',
          reasonCode: 'SOURCE_PROJECTION_INTEGRITY_FAILURE',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256: runtimeTruthSha256('NOT_EVALUATED'),
          policy: notEvaluatedPolicy(binding),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationTruth
        },
        'Current Brain owner read does not match the projection frozen into the historical binding.'
      );
    let runtimeCapability: RuntimeCapabilityDefinition | undefined;
    try {
      runtimeCapability = await this.capabilities.findVersion(
        binding.runtimeCapability.id,
        binding.runtimeCapability.version
      );
    } catch {
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Runtime Capability registry is unavailable for binding revalidation.',
        { retryable: true }
      );
    }
    if (!runtimeCapability)
      return this.recordObservation(
        command,
        binding,
        {
          status: 'TARGET_CAPABILITY_MISSING',
          reasonCode: 'RUNTIME_CAPABILITY_MISSING',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256: runtimeTruthSha256('MISSING'),
          policy: notEvaluatedPolicy(binding),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationTruth
        },
        'The exact Runtime Capability version frozen into the historical binding is no longer available.'
      );
    if (!runtimeMatchesBinding(runtimeCapability, binding))
      return this.recordObservation(
        command,
        binding,
        {
          status: 'INTEGRITY_FAILURE',
          reasonCode: 'RUNTIME_CAPABILITY_INTEGRITY_FAILURE',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256: runtimeTruthSha256('INTEGRITY_FAILURE', runtimeCapability),
          policy: notEvaluatedPolicy(binding),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationTruth
        },
        'Runtime Capability owner truth no longer matches the exact accepted-Canon target frozen into the binding.'
      );

    let currentRuntimeCapability: RuntimeCapabilityDefinition | undefined;
    try {
      currentRuntimeCapability = await this.capabilities.findCurrent(
        binding.runtimeCapability.capabilityId
      );
    } catch {
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Current Runtime Capability registry state is unavailable for binding revalidation.',
        { retryable: true }
      );
    }
    if (
      !currentRuntimeCapability ||
      currentRuntimeCapability.runtimeCapabilityDefinitionId !== binding.runtimeCapability.id ||
      currentRuntimeCapability.capabilityId !== binding.runtimeCapability.capabilityId ||
      currentRuntimeCapability.version < binding.runtimeCapability.version ||
      currentRuntimeCapability.acceptedCanonProjection !== true ||
      currentRuntimeCapability.createdFromWorkEvidence !== false ||
      currentRuntimeCapability.createdFromAiOutput !== false
    )
      return this.recordObservation(
        command,
        binding,
        {
          status: 'INTEGRITY_FAILURE',
          reasonCode: 'RUNTIME_CAPABILITY_INTEGRITY_FAILURE',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256: runtimeTruthSha256(
            'INTEGRITY_FAILURE',
            currentRuntimeCapability
          ),
          policy: notEvaluatedPolicy(binding),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationTruth
        },
        'Runtime Capability registry current-state invariants are inconsistent with the historical binding.'
      );
    if (currentRuntimeCapability.version > binding.runtimeCapability.version)
      return this.recordObservation(
        command,
        binding,
        {
          status: 'TARGET_CAPABILITY_SUPERSEDED',
          reasonCode: 'RUNTIME_CAPABILITY_SUPERSEDED',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256: runtimeTruthSha256('SUPERSEDED', currentRuntimeCapability),
          policy: notEvaluatedPolicy(binding),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationTruth
        },
        'A newer accepted-Canon Runtime Capability version supersedes the target frozen into the historical binding.'
      );
    if (!runtimeMatchesBinding(currentRuntimeCapability, binding))
      return this.recordObservation(
        command,
        binding,
        {
          status: 'INTEGRITY_FAILURE',
          reasonCode: 'RUNTIME_CAPABILITY_INTEGRITY_FAILURE',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256: runtimeTruthSha256(
            'INTEGRITY_FAILURE',
            currentRuntimeCapability
          ),
          policy: notEvaluatedPolicy(binding),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationTruth
        },
        'Current Runtime Capability data does not match the exact bound version despite sharing its version identity.'
      );

    const runtimeCapabilityTruthSha256 = runtimeTruthSha256('CURRENT', currentRuntimeCapability);
    let currentTarget: Readonly<WorkspaceCapabilityBindingPolicyTargetV1> | undefined;
    try {
      currentTarget = await this.policy.resolve(readiness);
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingPolicyError)
        return this.recordObservation(
          command,
          binding,
          {
            status: 'INTEGRITY_FAILURE',
            reasonCode: 'POLICY_INTEGRITY_FAILURE',
            sourceTruthSha256,
            runtimeCapabilityTruthSha256,
            policy: policyTruth('INTEGRITY_FAILURE'),
            knowledge: notEvaluatedKnowledge(binding),
            revocation: revocationTruth
          },
          'Current Workspace Capability binding policy is internally inconsistent.'
        );
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Workspace Capability binding policy is unavailable for revalidation.',
        { retryable: true }
      );
    }
    if (!currentTarget)
      return this.recordObservation(
        command,
        binding,
        {
          status: 'BINDING_POLICY_NO_LONGER_MATCHES',
          reasonCode: 'POLICY_NO_LONGER_MATCHES',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256,
          policy: policyTruth('SUPERSEDED'),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationTruth
        },
        'Current Workspace Capability binding policy no longer admits the historical binding.'
      );
    if (!policyMatchesBinding(currentTarget, binding))
      return this.recordObservation(
        command,
        binding,
        {
          status: 'BINDING_POLICY_NO_LONGER_MATCHES',
          reasonCode: 'POLICY_NO_LONGER_MATCHES',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256,
          policy: policyTruth('SUPERSEDED', currentTarget),
          knowledge: notEvaluatedKnowledge(binding),
          revocation: revocationTruth
        },
        'Current Workspace Capability binding policy resolves to a different governed target.'
      );
    const currentPolicy = policyTruth('CURRENT', currentTarget);

    let knowledgeResult: Readonly<WorkspaceKnowledgeEvidenceCurrentnessResultV1>;
    try {
      knowledgeResult = await this.knowledge.evaluate({
        workspaceId: binding.workspaceId,
        evidenceRefs: [...binding.source.evidenceRefs]
      });
    } catch {
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Knowledge evidence currentness owner authority is unavailable.',
        { retryable: true }
      );
    }
    const currentKnowledge = knowledgeTruth(knowledgeResult, binding);
    if (!currentKnowledge)
      return this.recordObservation(
        command,
        binding,
        {
          status: 'INTEGRITY_FAILURE',
          reasonCode: 'KNOWLEDGE_CURRENTNESS_INTEGRITY_FAILURE',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256,
          policy: currentPolicy,
          knowledge: {
            status: 'INTEGRITY_FAILURE',
            evidenceRefs: [...binding.source.evidenceRefs],
            ownerSnapshotSha256: truthSha256({
              owner: 'KNOWLEDGE',
              status: 'INTEGRITY_FAILURE',
              workspaceId: binding.workspaceId,
              evidenceRefs: binding.source.evidenceRefs
            })
          },
          revocation: revocationTruth
        },
        'Knowledge currentness owner response failed governed identity or integrity validation.'
      );
    if (currentKnowledge.status === 'REVOKED')
      return this.recordObservation(
        command,
        binding,
        {
          status: 'BLOCKED_BY_EVIDENCE_CURRENTNESS',
          reasonCode: 'KNOWLEDGE_EVIDENCE_REVOKED',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256,
          policy: currentPolicy,
          knowledge: currentKnowledge,
          revocation: revocationTruth
        },
        'At least one Knowledge evidence source required by the historical binding is revoked.'
      );
    if (currentKnowledge.status === 'SUPERSEDED')
      return this.recordObservation(
        command,
        binding,
        {
          status: 'BLOCKED_BY_EVIDENCE_CURRENTNESS',
          reasonCode: 'KNOWLEDGE_EVIDENCE_SUPERSEDED',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256,
          policy: currentPolicy,
          knowledge: currentKnowledge,
          revocation: revocationTruth
        },
        'Knowledge evidence required by the historical binding has been superseded.'
      );
    if (currentKnowledge.status === 'CURRENTNESS_UNAVAILABLE')
      return this.recordObservation(
        command,
        binding,
        {
          status: 'CURRENTNESS_UNAVAILABLE',
          reasonCode: 'KNOWLEDGE_CURRENTNESS_UNAVAILABLE',
          sourceTruthSha256,
          runtimeCapabilityTruthSha256,
          policy: currentPolicy,
          knowledge: currentKnowledge,
          revocation: revocationTruth
        },
        'Knowledge does not currently expose authoritative currentness for the exact evidence set.'
      );

    return this.recordObservation(
      command,
      binding,
      {
        status: 'CURRENT',
        reasonCode: 'ALL_CURRENT',
        sourceTruthSha256,
        runtimeCapabilityTruthSha256,
        policy: currentPolicy,
        knowledge: currentKnowledge,
        revocation: revocationTruth
      },
      'All modeled owner truths confirm that the immutable historical binding is currently usable.'
    );
  }
}
