import { createHash } from 'node:crypto';
import type { BrainIntelligenceId } from '@markorbit/contracts/brain-workspace-intelligence';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import {
  workspaceCapabilityBindingAuthorityV1,
  workspaceCapabilityBindingIdV1,
  type WorkspaceCapabilityBindingIdentityV1,
  type WorkspaceCapabilityBindingV1
} from '@markorbit/contracts/workspace-capability-binding';
import {
  WorkspaceCapabilityBindingPolicyError,
  type WorkspaceCapabilityBindingPolicyV1
} from './workspace-capability-binding-policy.js';
import {
  WorkspaceCapabilityBindingStoreError,
  type WorkspaceCapabilityBindingRepositoryV1
} from './workspace-capability-binding-store.js';
import type {
  WorkspaceTrademarkIssueIntelligenceReadinessServiceV1,
  WorkspaceTrademarkIssueIntelligenceReadinessStatusV1,
  WorkspaceTrademarkIssueIntelligenceReadyProjectionV1
} from './workspace-trademark-issue-intelligence-readiness.js';

const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INTELLIGENCE_ID = /^brain-intelligence_[0-9a-f]{64}$/u;

export interface WorkspaceCapabilityBindCommandV1 {
  workspaceId: string;
  intelligenceId: BrainIntelligenceId;
}

export type WorkspaceCapabilityBindStatusV1 =
  | 'BOUND'
  | 'NOT_READY'
  | 'NO_POLICY_MATCH'
  | 'TARGET_CAPABILITY_NOT_AVAILABLE'
  | 'BINDING_POLICY_FAILURE'
  | 'BINDING_INTEGRITY_FAILURE'
  | 'DEPENDENCY_UNAVAILABLE';

export interface WorkspaceCapabilityBindResultV1 {
  schemaVersion: 1;
  status: WorkspaceCapabilityBindStatusV1;
  bound: boolean;
  reference: Readonly<WorkspaceCapabilityBindCommandV1>;
  reason: string;
  retryable: boolean;
  readinessStatus?: WorkspaceTrademarkIssueIntelligenceReadinessStatusV1;
  binding?: Readonly<WorkspaceCapabilityBindingV1>;
  replayed?: boolean;
}

export type WorkspaceCapabilityBindingServiceErrorCode = 'INVALID_COMMAND';

export class WorkspaceCapabilityBindingServiceError extends Error {
  constructor(
    readonly code: WorkspaceCapabilityBindingServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'WorkspaceCapabilityBindingServiceError';
  }
}

export interface WorkspaceCapabilityDefinitionReaderV1 {
  listVersions(capabilityId: string): Promise<readonly RuntimeCapabilityDefinition[]>;
}

function exactCommand(value: Readonly<WorkspaceCapabilityBindCommandV1>) {
  const input = value as unknown;
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new WorkspaceCapabilityBindingServiceError(
      'INVALID_COMMAND',
      'Workspace Capability binding command must be an object.'
    );
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== 'intelligenceId' ||
    keys[1] !== 'workspaceId' ||
    typeof record.workspaceId !== 'string' ||
    record.workspaceId.trim() !== record.workspaceId ||
    !WORKSPACE_UUID.test(record.workspaceId) ||
    typeof record.intelligenceId !== 'string' ||
    !INTELLIGENCE_ID.test(record.intelligenceId)
  )
    throw new WorkspaceCapabilityBindingServiceError(
      'INVALID_COMMAND',
      'Only canonical Workspace and Brain intelligence identities are accepted.'
    );
  return {
    workspaceId: record.workspaceId.toLowerCase(),
    intelligenceId: record.intelligenceId as BrainIntelligenceId
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  return value;
}

export function workspaceCapabilityBindingSourceProjectionSha256V1(
  intelligence: Readonly<WorkspaceTrademarkIssueIntelligenceReadyProjectionV1>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(intelligence)))
    .digest('hex');
}

function result(
  command: Readonly<WorkspaceCapabilityBindCommandV1>,
  status: WorkspaceCapabilityBindStatusV1,
  reason: string,
  options: Readonly<{
    retryable?: boolean;
    readinessStatus?: WorkspaceTrademarkIssueIntelligenceReadinessStatusV1;
    binding?: WorkspaceCapabilityBindingV1;
    replayed?: boolean;
  }> = {}
): Readonly<WorkspaceCapabilityBindResultV1> {
  return Object.freeze({
    schemaVersion: 1,
    status,
    bound: status === 'BOUND',
    reference: Object.freeze({ ...command }),
    reason,
    retryable: options.retryable ?? false,
    ...(options.readinessStatus === undefined ? {} : { readinessStatus: options.readinessStatus }),
    ...(options.binding === undefined
      ? {}
      : { binding: Object.freeze(structuredClone(options.binding)) }),
    ...(options.replayed === undefined ? {} : { replayed: options.replayed })
  });
}

class WorkspaceCapabilityTargetIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceCapabilityTargetIntegrityError';
  }
}

function exactCapability(
  versions: readonly RuntimeCapabilityDefinition[],
  capabilityVersion: string
): RuntimeCapabilityDefinition | undefined {
  const matches = versions.filter(
    (definition) => definition.capabilityVersion === capabilityVersion
  );
  if (matches.length > 1)
    throw new WorkspaceCapabilityTargetIntegrityError(
      'Capability registry returned multiple definitions for one capability version.'
    );
  return matches[0];
}

function governedTarget(
  definition: Readonly<RuntimeCapabilityDefinition>,
  capabilityId: string,
  capabilityVersion: string
): RuntimeCapabilityDefinition {
  if (
    definition.capabilityId !== capabilityId ||
    definition.capabilityVersion !== capabilityVersion ||
    definition.acceptedCanonProjection !== true ||
    definition.createdFromWorkEvidence !== false ||
    definition.createdFromAiOutput !== false
  )
    throw new WorkspaceCapabilityTargetIntegrityError(
      'Runtime Capability target is not the exact accepted-Canon projection required by binding policy.'
    );
  return structuredClone(definition);
}

export class WorkspaceCapabilityBindingServiceV1 {
  constructor(
    private readonly readiness: Pick<
      WorkspaceTrademarkIssueIntelligenceReadinessServiceV1,
      'evaluate'
    >,
    private readonly policy: Readonly<WorkspaceCapabilityBindingPolicyV1>,
    private readonly capabilities: Readonly<WorkspaceCapabilityDefinitionReaderV1>,
    private readonly repository: Readonly<WorkspaceCapabilityBindingRepositoryV1>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async bind(
    commandValue: Readonly<WorkspaceCapabilityBindCommandV1>
  ): Promise<Readonly<WorkspaceCapabilityBindResultV1>> {
    const command = exactCommand(commandValue);
    const readiness = await this.readiness.evaluate(command);
    if (readiness.status === 'DEPENDENCY_UNAVAILABLE')
      return result(command, 'DEPENDENCY_UNAVAILABLE', readiness.reason, {
        retryable: readiness.retryable,
        readinessStatus: readiness.status
      });
    if (readiness.status === 'BRAIN_INTELLIGENCE_INTEGRITY_FAILURE')
      return result(command, 'BINDING_INTEGRITY_FAILURE', readiness.reason, {
        readinessStatus: readiness.status
      });
    if (!readiness.ready || readiness.status !== 'READY_FOR_CAPABILITY_BINDING')
      return result(
        command,
        'NOT_READY',
        'Workspace Brain intelligence is not structurally ready for Capability binding.',
        { readinessStatus: readiness.status }
      );
    const intelligence = readiness.intelligence;
    if (!intelligence)
      return result(
        command,
        'BINDING_INTEGRITY_FAILURE',
        'Ready Workspace Brain intelligence is missing its governed projection.'
      );

    let target;
    try {
      target = await this.policy.resolve(readiness);
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingPolicyError)
        return result(command, 'BINDING_POLICY_FAILURE', error.message);
      return result(
        command,
        'BINDING_POLICY_FAILURE',
        'Workspace Capability binding policy failed unexpectedly.'
      );
    }
    if (!target)
      return result(
        command,
        'NO_POLICY_MATCH',
        'No server-governed Capability binding rule admits this Brain intelligence.'
      );

    let runtimeCapability: RuntimeCapabilityDefinition | undefined;
    try {
      runtimeCapability = exactCapability(
        await this.capabilities.listVersions(target.capabilityId),
        target.capabilityVersion
      );
    } catch (error) {
      if (error instanceof WorkspaceCapabilityTargetIntegrityError)
        return result(command, 'BINDING_INTEGRITY_FAILURE', error.message);
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Runtime Capability registry is unavailable for Workspace binding.',
        { retryable: true }
      );
    }
    if (!runtimeCapability)
      return result(
        command,
        'TARGET_CAPABILITY_NOT_AVAILABLE',
        'The server-governed binding target is not available in the Runtime Capability registry.'
      );
    try {
      runtimeCapability = governedTarget(
        runtimeCapability,
        target.capabilityId,
        target.capabilityVersion
      );
    } catch (error) {
      if (error instanceof WorkspaceCapabilityTargetIntegrityError)
        return result(command, 'BINDING_INTEGRITY_FAILURE', error.message);
      throw error;
    }

    const identity: WorkspaceCapabilityBindingIdentityV1 = {
      schemaVersion: 1,
      workspaceId: command.workspaceId,
      source: {
        intelligenceId: command.intelligenceId,
        task: intelligence.task,
        projectionSha256: workspaceCapabilityBindingSourceProjectionSha256V1(intelligence),
        generatedAt: intelligence.generatedAt,
        evidenceRefs: [
          ...intelligence.evidenceRefs
        ] as WorkspaceCapabilityBindingIdentityV1['source']['evidenceRefs'],
        primitiveRefs: [
          ...intelligence.primitiveRefs
        ] as WorkspaceCapabilityBindingIdentityV1['source']['primitiveRefs'],
        interpreter: structuredClone(intelligence.interpreter)
      },
      runtimeCapability: {
        id: runtimeCapability.runtimeCapabilityDefinitionId,
        version: runtimeCapability.version,
        capabilityId: runtimeCapability.capabilityId,
        capabilityVersion: runtimeCapability.capabilityVersion,
        canonReference: structuredClone(runtimeCapability.canonReference),
        acceptedCanonProjection: true
      },
      bindingPolicy: {
        policyId: target.policyId,
        policyVersion: target.policyVersion,
        ruleId: target.ruleId,
        reason: target.reason
      },
      freshness: { status: 'NOT_EVALUATED', plannedStage: 'WIF-08' },
      authority: workspaceCapabilityBindingAuthorityV1
    };
    const bindingId = workspaceCapabilityBindingIdV1(identity);

    try {
      const existing = await this.repository.find(command.workspaceId, bindingId);
      if (existing)
        return result(
          command,
          'BOUND',
          'The exact Workspace Capability binding already exists and was replayed.',
          { binding: existing, replayed: true }
        );

      const binding: WorkspaceCapabilityBindingV1 = {
        ...identity,
        bindingId,
        boundAt: new Date(this.now()).toISOString()
      };
      const recorded = await this.repository.record(binding);
      return result(
        command,
        'BOUND',
        recorded.replayed
          ? 'The exact Workspace Capability binding was concurrently created and replayed.'
          : 'The Workspace Brain intelligence was bound to one exact accepted-Canon Runtime Capability.',
        { binding: recorded.binding, replayed: recorded.replayed }
      );
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingStoreError) {
        if (
          error.code === 'IDENTITY_CONFLICT' ||
          error.code === 'PERSISTENCE_INTEGRITY_FAILURE' ||
          error.code === 'INVALID_INPUT'
        )
          return result(command, 'BINDING_INTEGRITY_FAILURE', error.message);
        return result(command, 'DEPENDENCY_UNAVAILABLE', error.message, {
          retryable: true
        });
      }
      return result(
        command,
        'DEPENDENCY_UNAVAILABLE',
        'Workspace Capability binding persistence failed unexpectedly.',
        { retryable: true }
      );
    }
  }
}
