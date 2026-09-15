import { createHash } from 'node:crypto';
import type {
  BrainIntelligenceId,
  BrainIntelligencePrimitiveId,
  BrainKnowledgeEvidenceId
} from './brain-workspace-intelligence.js';
import type {
  CapabilityCanonReference,
  RuntimeCapabilityDefinitionId
} from './capability-learning.js';

export type WorkspaceCapabilityBindingId = `workspace-capability-binding_${string}`;

export const workspaceCapabilityBindingAuthorityV1 = Object.freeze({
  capabilityBindingCreated: true,
  capabilityInvocationAuthorized: false,
  implementationSelected: false,
  professionalDecisionCreated: false,
  recommendationCreated: false,
  quoteCreated: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  productStateCreated: false,
  officialTruthCreated: false
} as const);

export interface WorkspaceCapabilityBindingV1 {
  schemaVersion: 1;
  bindingId: WorkspaceCapabilityBindingId;
  workspaceId: string;
  source: Readonly<{
    intelligenceId: BrainIntelligenceId;
    task: 'TRADEMARK_ISSUE_EXTRACTION';
    projectionSha256: string;
    generatedAt: string;
    evidenceRefs: readonly BrainKnowledgeEvidenceId[];
    primitiveRefs: readonly BrainIntelligencePrimitiveId[];
    interpreter: Readonly<{
      profileId: string;
      version: string;
      policyProfileId: string;
    }>;
  }>;
  runtimeCapability: Readonly<{
    id: RuntimeCapabilityDefinitionId;
    version: number;
    capabilityId: string;
    capabilityVersion: string;
    canonReference: Readonly<CapabilityCanonReference>;
    acceptedCanonProjection: true;
  }>;
  bindingPolicy: Readonly<{
    policyId: string;
    policyVersion: string;
    ruleId: string;
    reason: string;
  }>;
  freshness: Readonly<{
    status: 'NOT_EVALUATED';
    plannedStage: 'WIF-08';
  }>;
  boundAt: string;
  authority: typeof workspaceCapabilityBindingAuthorityV1;
}

export class WorkspaceCapabilityBindingContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceCapabilityBindingContractError';
  }
}

const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const BINDING_ID = /^workspace-capability-binding_[0-9a-f]{64}$/u;
const INTELLIGENCE_ID = /^brain-intelligence_[0-9a-f]{64}$/u;
const EVIDENCE_ID = /^brain-knowledge-evidence_[0-9a-f]{64}$/u;
const PRIMITIVE_ID = /^brain-intelligence-primitive_[0-9a-f]{64}$/u;
const RUNTIME_ID = /^runtime-capability_[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new WorkspaceCapabilityBindingContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const accepted = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !accepted.has(key));
  if (unsupported.length)
    throw new WorkspaceCapabilityBindingContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new WorkspaceCapabilityBindingContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned !== value || cleaned.length > maximum)
    throw new WorkspaceCapabilityBindingContractError(`${field} must contain canonical text.`);
  return cleaned;
}

function pattern(value: unknown, field: string, matcher: RegExp, maximum = 300): string {
  const cleaned = text(value, field, maximum);
  if (!matcher.test(cleaned))
    throw new WorkspaceCapabilityBindingContractError(
      `${field} has an invalid canonical identity.`
    );
  return cleaned;
}

function timestamp(value: unknown, field: string): string {
  const cleaned = text(value, field, 80);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned)
    throw new WorkspaceCapabilityBindingContractError(
      `${field} must be a canonical ISO timestamp.`
    );
  return cleaned;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 1_000_000)
    throw new WorkspaceCapabilityBindingContractError(`${field} must be a positive integer.`);
  return Number(value);
}

function ids(value: unknown, field: string, matcher: RegExp): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000)
    throw new WorkspaceCapabilityBindingContractError(
      `${field} must be a bounded non-empty array.`
    );
  const entries = value.map((item, index) => pattern(item, `${field}[${index}]`, matcher, 160));
  if (new Set(entries).size !== entries.length)
    throw new WorkspaceCapabilityBindingContractError(`${field} must not contain duplicates.`);
  return entries;
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

export type WorkspaceCapabilityBindingIdentityV1 = Omit<
  WorkspaceCapabilityBindingV1,
  'bindingId' | 'boundAt'
>;

export function workspaceCapabilityBindingIdentityProjectionV1(
  binding: Readonly<WorkspaceCapabilityBindingV1>
): WorkspaceCapabilityBindingIdentityV1 {
  return {
    schemaVersion: binding.schemaVersion,
    workspaceId: binding.workspaceId,
    source: binding.source,
    runtimeCapability: binding.runtimeCapability,
    bindingPolicy: binding.bindingPolicy,
    freshness: binding.freshness,
    authority: binding.authority
  };
}

export function workspaceCapabilityBindingIdentitySha256V1(
  binding: Readonly<WorkspaceCapabilityBindingIdentityV1>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(binding)))
    .digest('hex');
}

export function workspaceCapabilityBindingIdV1(
  binding: Readonly<WorkspaceCapabilityBindingIdentityV1>
): WorkspaceCapabilityBindingId {
  return `workspace-capability-binding_${workspaceCapabilityBindingIdentitySha256V1(binding)}`;
}

export function workspaceCapabilityBindingFingerprintSha256V1(
  binding: Readonly<WorkspaceCapabilityBindingV1>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(binding)))
    .digest('hex');
}

export function parseWorkspaceCapabilityBindingV1(value: unknown): WorkspaceCapabilityBindingV1 {
  const binding = record(value, 'binding');
  exactKeys(
    binding,
    [
      'schemaVersion',
      'bindingId',
      'workspaceId',
      'source',
      'runtimeCapability',
      'bindingPolicy',
      'freshness',
      'boundAt',
      'authority'
    ],
    'binding'
  );
  if (binding.schemaVersion !== 1)
    throw new WorkspaceCapabilityBindingContractError('binding.schemaVersion must be 1.');

  const workspaceId = pattern(
    binding.workspaceId,
    'binding.workspaceId',
    WORKSPACE_UUID
  ).toLowerCase();
  const source = record(binding.source, 'binding.source');
  exactKeys(
    source,
    [
      'intelligenceId',
      'task',
      'projectionSha256',
      'generatedAt',
      'evidenceRefs',
      'primitiveRefs',
      'interpreter'
    ],
    'binding.source'
  );
  if (source.task !== 'TRADEMARK_ISSUE_EXTRACTION')
    throw new WorkspaceCapabilityBindingContractError('binding.source.task is invalid.');
  const interpreter = record(source.interpreter, 'binding.source.interpreter');
  exactKeys(interpreter, ['profileId', 'version', 'policyProfileId'], 'binding.source.interpreter');

  const runtime = record(binding.runtimeCapability, 'binding.runtimeCapability');
  exactKeys(
    runtime,
    [
      'id',
      'version',
      'capabilityId',
      'capabilityVersion',
      'canonReference',
      'acceptedCanonProjection'
    ],
    'binding.runtimeCapability'
  );
  if (runtime.acceptedCanonProjection !== true)
    throw new WorkspaceCapabilityBindingContractError(
      'binding target must be accepted Capability Canon.'
    );
  const canon = record(runtime.canonReference, 'binding.runtimeCapability.canonReference');
  exactKeys(
    canon,
    ['canonId', 'canonVersion', 'sourceFingerprintSha256'],
    'binding.runtimeCapability.canonReference'
  );

  const policy = record(binding.bindingPolicy, 'binding.bindingPolicy');
  exactKeys(policy, ['policyId', 'policyVersion', 'ruleId', 'reason'], 'binding.bindingPolicy');
  const freshness = record(binding.freshness, 'binding.freshness');
  exactKeys(freshness, ['status', 'plannedStage'], 'binding.freshness');
  if (freshness.status !== 'NOT_EVALUATED' || freshness.plannedStage !== 'WIF-08')
    throw new WorkspaceCapabilityBindingContractError(
      'binding freshness must remain deferred to WIF-08.'
    );

  const authority = record(binding.authority, 'binding.authority');
  exactKeys(authority, Object.keys(workspaceCapabilityBindingAuthorityV1), 'binding.authority');
  for (const [key, expected] of Object.entries(workspaceCapabilityBindingAuthorityV1)) {
    if (authority[key] !== expected)
      throw new WorkspaceCapabilityBindingContractError(`binding.authority.${key} is invalid.`);
  }

  const parsed: WorkspaceCapabilityBindingV1 = {
    schemaVersion: 1,
    bindingId: pattern(
      binding.bindingId,
      'binding.bindingId',
      BINDING_ID,
      100
    ) as WorkspaceCapabilityBindingId,
    workspaceId,
    source: {
      intelligenceId: pattern(
        source.intelligenceId,
        'binding.source.intelligenceId',
        INTELLIGENCE_ID,
        100
      ) as BrainIntelligenceId,
      task: 'TRADEMARK_ISSUE_EXTRACTION',
      projectionSha256: pattern(
        source.projectionSha256,
        'binding.source.projectionSha256',
        SHA256,
        64
      ),
      generatedAt: timestamp(source.generatedAt, 'binding.source.generatedAt'),
      evidenceRefs: ids(
        source.evidenceRefs,
        'binding.source.evidenceRefs',
        EVIDENCE_ID
      ) as readonly BrainKnowledgeEvidenceId[],
      primitiveRefs: ids(
        source.primitiveRefs,
        'binding.source.primitiveRefs',
        PRIMITIVE_ID
      ) as readonly BrainIntelligencePrimitiveId[],
      interpreter: {
        profileId: text(interpreter.profileId, 'binding.source.interpreter.profileId', 300),
        version: text(interpreter.version, 'binding.source.interpreter.version', 120),
        policyProfileId: text(
          interpreter.policyProfileId,
          'binding.source.interpreter.policyProfileId',
          300
        )
      }
    },
    runtimeCapability: {
      id: pattern(
        runtime.id,
        'binding.runtimeCapability.id',
        RUNTIME_ID,
        300
      ) as RuntimeCapabilityDefinitionId,
      version: positiveInteger(runtime.version, 'binding.runtimeCapability.version'),
      capabilityId: text(runtime.capabilityId, 'binding.runtimeCapability.capabilityId', 300),
      capabilityVersion: text(
        runtime.capabilityVersion,
        'binding.runtimeCapability.capabilityVersion',
        120
      ),
      canonReference: {
        canonId: text(canon.canonId, 'binding.runtimeCapability.canonReference.canonId', 300),
        canonVersion: text(
          canon.canonVersion,
          'binding.runtimeCapability.canonReference.canonVersion',
          120
        ),
        sourceFingerprintSha256: pattern(
          canon.sourceFingerprintSha256,
          'binding.runtimeCapability.canonReference.sourceFingerprintSha256',
          SHA256,
          64
        )
      },
      acceptedCanonProjection: true
    },
    bindingPolicy: {
      policyId: text(policy.policyId, 'binding.bindingPolicy.policyId', 300),
      policyVersion: text(policy.policyVersion, 'binding.bindingPolicy.policyVersion', 120),
      ruleId: text(policy.ruleId, 'binding.bindingPolicy.ruleId', 300),
      reason: text(policy.reason, 'binding.bindingPolicy.reason', 2000)
    },
    freshness: { status: 'NOT_EVALUATED', plannedStage: 'WIF-08' },
    boundAt: timestamp(binding.boundAt, 'binding.boundAt'),
    authority: workspaceCapabilityBindingAuthorityV1
  };
  const expectedBindingId = workspaceCapabilityBindingIdV1(
    workspaceCapabilityBindingIdentityProjectionV1(parsed)
  );
  if (parsed.bindingId !== expectedBindingId)
    throw new WorkspaceCapabilityBindingContractError(
      'binding.bindingId must match the deterministic binding identity.'
    );
  return parsed;
}
