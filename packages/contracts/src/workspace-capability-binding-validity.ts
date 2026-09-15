import { createHash } from 'node:crypto';
import type { BrainKnowledgeEvidenceId } from './brain-workspace-intelligence.js';
import type { WorkspaceCapabilityBindingId } from './workspace-capability-binding.js';

export type WorkspaceCapabilityBindingValidityObservationId =
  `workspace-capability-binding-validity_${string}`;

export const workspaceCapabilityBindingValidityStatusesV1 = [
  'CURRENT',
  'REVOKED',
  'BLOCKED_BY_EVIDENCE_CURRENTNESS',
  'BINDING_POLICY_NO_LONGER_MATCHES',
  'TARGET_CAPABILITY_SUPERSEDED',
  'TARGET_CAPABILITY_MISSING',
  'CURRENTNESS_UNAVAILABLE',
  'INTEGRITY_FAILURE'
] as const;
export type WorkspaceCapabilityBindingValidityStatusV1 =
  (typeof workspaceCapabilityBindingValidityStatusesV1)[number];

export const workspaceCapabilityBindingValidityReasonCodesV1 = [
  'ALL_CURRENT',
  'BINDING_REVOKED',
  'POLICY_NO_LONGER_MATCHES',
  'RUNTIME_CAPABILITY_SUPERSEDED',
  'RUNTIME_CAPABILITY_MISSING',
  'KNOWLEDGE_EVIDENCE_REVOKED',
  'KNOWLEDGE_EVIDENCE_SUPERSEDED',
  'KNOWLEDGE_CURRENTNESS_UNAVAILABLE',
  'SOURCE_PROJECTION_INTEGRITY_FAILURE',
  'RUNTIME_CAPABILITY_INTEGRITY_FAILURE',
  'POLICY_INTEGRITY_FAILURE',
  'KNOWLEDGE_CURRENTNESS_INTEGRITY_FAILURE',
  'BINDING_REVOCATION_INTEGRITY_FAILURE'
] as const;
export type WorkspaceCapabilityBindingValidityReasonCodeV1 =
  (typeof workspaceCapabilityBindingValidityReasonCodesV1)[number];
export const workspaceCapabilityBindingValidityAuthorityV1 = Object.freeze({
  bindingCurrentUsabilityEvaluated: true,
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

export type WorkspaceCapabilityBindingPolicyCurrentnessV1 =
  | Readonly<{ status: 'CURRENT' | 'SUPERSEDED'; fingerprintSha256: string }>
  | Readonly<{
      status: 'REVOKED' | 'INTEGRITY_FAILURE' | 'NOT_EVALUATED';
      fingerprintSha256: string;
    }>;

export type WorkspaceCapabilityBindingKnowledgeCurrentnessV1 = Readonly<{
  status:
    | 'CURRENT'
    | 'REVOKED'
    | 'SUPERSEDED'
    | 'CURRENTNESS_UNAVAILABLE'
    | 'NOT_EVALUATED'
    | 'INTEGRITY_FAILURE';
  evidenceRefs: readonly BrainKnowledgeEvidenceId[];
  ownerSnapshotSha256: string;
}>;

export type WorkspaceCapabilityBindingRevocationCurrentnessV1 = Readonly<{
  status: 'NOT_REVOKED' | 'REVOKED' | 'NOT_EVALUATED' | 'INTEGRITY_FAILURE';
  fingerprintSha256: string;
}>;

export interface WorkspaceCapabilityBindingValidityObservationV1 {
  schemaVersion: 1;
  observationId: WorkspaceCapabilityBindingValidityObservationId;
  workspaceId: string;
  bindingId: WorkspaceCapabilityBindingId;
  bindingFingerprintSha256: string;
  status: WorkspaceCapabilityBindingValidityStatusV1;
  usable: boolean;
  reasonCode: WorkspaceCapabilityBindingValidityReasonCodeV1;
  basis: Readonly<{
    sourceTruthSha256: string;
    runtimeCapabilityTruthSha256: string;
    policy: WorkspaceCapabilityBindingPolicyCurrentnessV1;
    knowledge: WorkspaceCapabilityBindingKnowledgeCurrentnessV1;
    revocation: WorkspaceCapabilityBindingRevocationCurrentnessV1;
  }>;
  evaluatedAt: string;
  authority: typeof workspaceCapabilityBindingValidityAuthorityV1;
}

export type WorkspaceCapabilityBindingValidityIdentityV1 = Omit<
  WorkspaceCapabilityBindingValidityObservationV1,
  'observationId' | 'evaluatedAt'
>;

export class WorkspaceCapabilityBindingValidityContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceCapabilityBindingValidityContractError';
  }
}
const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const BINDING_ID = /^workspace-capability-binding_[0-9a-f]{64}$/u;
const OBSERVATION_ID = /^workspace-capability-binding-validity_[0-9a-f]{64}$/u;
const EVIDENCE_ID = /^brain-knowledge-evidence_[0-9a-f]{64}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkspaceCapabilityBindingValidityContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const expected = new Set(allowed);
  const extras = Object.keys(value).filter((key) => !expected.has(key));
  if (extras.length)
    throw new WorkspaceCapabilityBindingValidityContractError(
      `${field} contains unsupported fields: ${extras.join(', ')}.`
    );
  for (const key of allowed) {
    if (!(key in value))
      throw new WorkspaceCapabilityBindingValidityContractError(`${field}.${key} is required.`);
  }
}

function text(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string')
    throw new WorkspaceCapabilityBindingValidityContractError(`${field} must be a string.`);
  if (!value || value.trim() !== value || value.length > maximum)
    throw new WorkspaceCapabilityBindingValidityContractError(
      `${field} must contain canonical text.`
    );
  return value;
}
function pattern(value: unknown, field: string, matcher: RegExp, maximum = 300): string {
  const cleaned = text(value, field, maximum);
  if (!matcher.test(cleaned))
    throw new WorkspaceCapabilityBindingValidityContractError(`${field} has an invalid identity.`);
  return cleaned;
}

function timestamp(value: unknown, field: string): string {
  const cleaned = text(value, field, 80);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned)
    throw new WorkspaceCapabilityBindingValidityContractError(
      `${field} must be a canonical ISO timestamp.`
    );
  return cleaned;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value))
    throw new WorkspaceCapabilityBindingValidityContractError(`${field} is invalid.`);
  return value as T;
}

function evidenceRefs(value: unknown): readonly BrainKnowledgeEvidenceId[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000)
    throw new WorkspaceCapabilityBindingValidityContractError(
      'basis.knowledge.evidenceRefs must be a bounded non-empty array.'
    );
  const refs = value.map((item, index) =>
    pattern(item, `basis.knowledge.evidenceRefs[${index}]`, EVIDENCE_ID, 100)
  ) as BrainKnowledgeEvidenceId[];
  if (new Set(refs).size !== refs.length)
    throw new WorkspaceCapabilityBindingValidityContractError(
      'basis.knowledge.evidenceRefs must not contain duplicates.'
    );
  return refs;
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

export function workspaceCapabilityBindingValidityIdentityProjectionV1(
  observation: Readonly<WorkspaceCapabilityBindingValidityObservationV1>
): WorkspaceCapabilityBindingValidityIdentityV1 {
  return {
    schemaVersion: observation.schemaVersion,
    workspaceId: observation.workspaceId,
    bindingId: observation.bindingId,
    bindingFingerprintSha256: observation.bindingFingerprintSha256,
    status: observation.status,
    usable: observation.usable,
    reasonCode: observation.reasonCode,
    basis: observation.basis,
    authority: observation.authority
  };
}

export function workspaceCapabilityBindingValidityIdentitySha256V1(
  identity: Readonly<WorkspaceCapabilityBindingValidityIdentityV1>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(identity)))
    .digest('hex');
}

export function workspaceCapabilityBindingValidityObservationIdV1(
  identity: Readonly<WorkspaceCapabilityBindingValidityIdentityV1>
): WorkspaceCapabilityBindingValidityObservationId {
  return `workspace-capability-binding-validity_${workspaceCapabilityBindingValidityIdentitySha256V1(identity)}`;
}
export function workspaceCapabilityBindingValidityFingerprintSha256V1(
  observation: Readonly<WorkspaceCapabilityBindingValidityObservationV1>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(observation)))
    .digest('hex');
}

export function parseWorkspaceCapabilityBindingValidityObservationV1(
  value: unknown
): WorkspaceCapabilityBindingValidityObservationV1 {
  const observation = record(value, 'observation');
  exactKeys(
    observation,
    [
      'schemaVersion',
      'observationId',
      'workspaceId',
      'bindingId',
      'bindingFingerprintSha256',
      'status',
      'usable',
      'reasonCode',
      'basis',
      'evaluatedAt',
      'authority'
    ],
    'observation'
  );
  if (observation.schemaVersion !== 1)
    throw new WorkspaceCapabilityBindingValidityContractError(
      'observation.schemaVersion must be 1.'
    );

  const basis = record(observation.basis, 'basis');
  exactKeys(
    basis,
    ['sourceTruthSha256', 'runtimeCapabilityTruthSha256', 'policy', 'knowledge', 'revocation'],
    'basis'
  );
  const policy = record(basis.policy, 'basis.policy');
  exactKeys(policy, ['status', 'fingerprintSha256'], 'basis.policy');
  const knowledge = record(basis.knowledge, 'basis.knowledge');
  exactKeys(knowledge, ['status', 'evidenceRefs', 'ownerSnapshotSha256'], 'basis.knowledge');
  const revocation = record(basis.revocation, 'basis.revocation');
  exactKeys(revocation, ['status', 'fingerprintSha256'], 'basis.revocation');
  const authority = record(observation.authority, 'authority');
  exactKeys(authority, Object.keys(workspaceCapabilityBindingValidityAuthorityV1), 'authority');
  for (const [key, expected] of Object.entries(workspaceCapabilityBindingValidityAuthorityV1)) {
    if (authority[key] !== expected)
      throw new WorkspaceCapabilityBindingValidityContractError(`authority.${key} is invalid.`);
  }

  const status = enumValue(
    observation.status,
    workspaceCapabilityBindingValidityStatusesV1,
    'observation.status'
  );
  if (typeof observation.usable !== 'boolean' || observation.usable !== (status === 'CURRENT'))
    throw new WorkspaceCapabilityBindingValidityContractError(
      'observation.usable must be true only for CURRENT observations.'
    );

  const parsed: WorkspaceCapabilityBindingValidityObservationV1 = {
    schemaVersion: 1,
    observationId: pattern(
      observation.observationId,
      'observation.observationId',
      OBSERVATION_ID,
      110
    ) as WorkspaceCapabilityBindingValidityObservationId,
    workspaceId: pattern(
      observation.workspaceId,
      'observation.workspaceId',
      WORKSPACE_UUID
    ).toLowerCase(),
    bindingId: pattern(
      observation.bindingId,
      'observation.bindingId',
      BINDING_ID,
      100
    ) as WorkspaceCapabilityBindingId,
    bindingFingerprintSha256: pattern(
      observation.bindingFingerprintSha256,
      'observation.bindingFingerprintSha256',
      SHA256,
      64
    ),
    status,
    usable: observation.usable,
    reasonCode: enumValue(
      observation.reasonCode,
      workspaceCapabilityBindingValidityReasonCodesV1,
      'observation.reasonCode'
    ),
    basis: {
      sourceTruthSha256: pattern(basis.sourceTruthSha256, 'basis.sourceTruthSha256', SHA256, 64),
      runtimeCapabilityTruthSha256: pattern(
        basis.runtimeCapabilityTruthSha256,
        'basis.runtimeCapabilityTruthSha256',
        SHA256,
        64
      ),
      policy: {
        status: enumValue(
          policy.status,
          ['CURRENT', 'REVOKED', 'SUPERSEDED', 'INTEGRITY_FAILURE', 'NOT_EVALUATED'] as const,
          'basis.policy.status'
        ),
        fingerprintSha256: pattern(
          policy.fingerprintSha256,
          'basis.policy.fingerprintSha256',
          SHA256,
          64
        )
      },
      knowledge: {
        status: enumValue(
          knowledge.status,
          [
            'CURRENT',
            'REVOKED',
            'SUPERSEDED',
            'CURRENTNESS_UNAVAILABLE',
            'NOT_EVALUATED',
            'INTEGRITY_FAILURE'
          ] as const,
          'basis.knowledge.status'
        ),
        evidenceRefs: evidenceRefs(knowledge.evidenceRefs),
        ownerSnapshotSha256: pattern(
          knowledge.ownerSnapshotSha256,
          'basis.knowledge.ownerSnapshotSha256',
          SHA256,
          64
        )
      },
      revocation: {
        status: enumValue(
          revocation.status,
          ['NOT_REVOKED', 'REVOKED', 'NOT_EVALUATED', 'INTEGRITY_FAILURE'] as const,
          'basis.revocation.status'
        ),
        fingerprintSha256: pattern(
          revocation.fingerprintSha256,
          'basis.revocation.fingerprintSha256',
          SHA256,
          64
        )
      }
    },
    evaluatedAt: timestamp(observation.evaluatedAt, 'observation.evaluatedAt'),
    authority: workspaceCapabilityBindingValidityAuthorityV1
  };

  const expectedId = workspaceCapabilityBindingValidityObservationIdV1(
    workspaceCapabilityBindingValidityIdentityProjectionV1(parsed)
  );
  if (parsed.observationId !== expectedId)
    throw new WorkspaceCapabilityBindingValidityContractError(
      'observation.observationId must match the deterministic validity identity.'
    );
  return parsed;
}
