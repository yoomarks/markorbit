import { createHash, randomUUID } from 'node:crypto';

import {
  BrainMethodContractError,
  parseBrainResearchMissionV1,
  type BrainResearchMissionV1
} from '@markorbit/contracts/brain-method';
import {
  MethodImprovementCoverageGapContractError,
  assertMethodImprovementCoverageGapMissionBinding,
  methodImprovementCoverageGapMissionFingerprintV1,
  methodImprovementCoverageGapNoDownstreamAuthority,
  methodImprovementCoverageGapReplayKeyFingerprintV1,
  methodImprovementCoverageGapResearchEligibleStatuses,
  methodImprovementCoverageGapTriggerFingerprintV1,
  parseMethodImprovementCoverageGapEvidenceSourceV1,
  parseMethodImprovementCoverageGapResearchMissionV1,
  parseMethodImprovementCoverageGapTargetV1,
  parseMethodImprovementCoverageGapTriggerV1,
  type MethodImprovementCoverageGapEvidenceSourceV1,
  type MethodImprovementCoverageGapResearchMissionV1,
  type MethodImprovementCoverageGapTargetV1,
  type MethodImprovementCoverageGapTriggerV1
} from '@markorbit/contracts/method-improvement-coverage-gap';

export type MethodImprovementCoverageGapAdmissionErrorCode =
  | 'INVALID_REQUEST'
  | 'WORKSPACE_MISMATCH'
  | 'EVIDENCE_NOT_FOUND'
  | 'EVIDENCE_MISMATCH'
  | 'EVIDENCE_UNAVAILABLE'
  | 'INELIGIBLE_COVERAGE_GAP'
  | 'TRIGGER_CONFLICT';

export class MethodImprovementCoverageGapAdmissionError extends Error {
  constructor(
    readonly code: MethodImprovementCoverageGapAdmissionErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MethodImprovementCoverageGapAdmissionError';
  }
}

export interface MethodImprovementCoverageGapCommandV1 {
  schemaVersion: 1;
  workspaceId: string;
  triggerType: 'COVERAGE_GAP';
  source: Readonly<MethodImprovementCoverageGapEvidenceSourceV1>;
  target: Readonly<MethodImprovementCoverageGapTargetV1>;
  reason: string;
  createdByPrincipalId: string;
  mission: Readonly<BrainResearchMissionV1>;
}

export interface CapabilityCoverageGapEvidenceQueryV1 {
  workspaceId: string;
  evidenceId: MethodImprovementCoverageGapEvidenceSourceV1['evidenceId'];
  evidenceFingerprintSha256: string;
}

export type CapabilityCoverageGapEvidenceResolutionV1 =
  | Readonly<{
      status: 'RESOLVED';
      source: unknown;
    }>
  | Readonly<{
      status: 'NOT_FOUND';
      reason: string;
    }>
  | Readonly<{
      status: 'UNAVAILABLE';
      reason: string;
    }>;

export interface CapabilityCoverageGapEvidenceAuthorityV1 {
  resolveExact(
    query: Readonly<CapabilityCoverageGapEvidenceQueryV1>
  ): CapabilityCoverageGapEvidenceResolutionV1 | Promise<CapabilityCoverageGapEvidenceResolutionV1>;
}

export interface MethodImprovementCoverageGapAdmissionResultV1 {
  trigger: Readonly<MethodImprovementCoverageGapTriggerV1>;
  researchMission: Readonly<MethodImprovementCoverageGapResearchMissionV1>;
  replayed: boolean;
}

export interface PreparedMethodImprovementCoverageGapAdmissionV1 {
  trigger: Readonly<MethodImprovementCoverageGapTriggerV1>;
  researchMission: Readonly<MethodImprovementCoverageGapResearchMissionV1>;
  idempotencyKey: string;
  correlationId: string;
  sourceIdentityFingerprintSha256: string;
  requestFingerprintSha256: string;
}

export interface MethodImprovementCoverageGapAdmissionRepositoryV1 {
  admit(
    input: Readonly<PreparedMethodImprovementCoverageGapAdmissionV1>
  ): Promise<MethodImprovementCoverageGapAdmissionResultV1>;
}

type RecordValue = Record<string, unknown>;
type StoredAdmission = Readonly<PreparedMethodImprovementCoverageGapAdmissionV1>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const RESEARCH_ELIGIBLE = new Set<string>(methodImprovementCoverageGapResearchEligibleStatuses);

function invalid(message: string): never {
  throw new MethodImprovementCoverageGapAdmissionError('INVALID_REQUEST', message);
}

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid(`${field} must be an object.`);
  }
  return value as RecordValue;
}

function exactKeys(value: RecordValue, allowed: readonly string[], field: string): void {
  const supported = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !supported.has(key));
  if (unknown.length > 0) invalid(`${field} contains unsupported fields: ${unknown.join(', ')}.`);
}

function text(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string') return invalid(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    return invalid(`${field} must contain between 1 and ${maximum} characters.`);
  }
  return cleaned;
}

function workspace(value: unknown): string {
  const cleaned = text(value, 'workspaceId', 36).toLowerCase();
  if (!UUID.test(cleaned)) return invalid('workspaceId must be a canonical UUID.');
  return cleaned;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function contractInvalid(error: unknown): never {
  if (
    error instanceof MethodImprovementCoverageGapContractError ||
    error instanceof BrainMethodContractError
  ) {
    return invalid(error.message);
  }
  throw error;
}

export function parseMethodImprovementCoverageGapCommandV1(
  value: unknown
): MethodImprovementCoverageGapCommandV1 {
  const command = record(value, 'coverageGapCommand');
  exactKeys(
    command,
    [
      'schemaVersion',
      'workspaceId',
      'triggerType',
      'source',
      'target',
      'reason',
      'createdByPrincipalId',
      'mission'
    ],
    'coverageGapCommand'
  );
  if (command.schemaVersion !== 1) invalid('coverageGapCommand.schemaVersion must be 1.');
  if (command.triggerType !== 'COVERAGE_GAP') {
    invalid('coverageGapCommand.triggerType must be COVERAGE_GAP.');
  }

  try {
    return {
      schemaVersion: 1,
      workspaceId: workspace(command.workspaceId),
      triggerType: 'COVERAGE_GAP',
      source: parseMethodImprovementCoverageGapEvidenceSourceV1(command.source),
      target: parseMethodImprovementCoverageGapTargetV1(command.target),
      reason: text(command.reason, 'coverageGapCommand.reason'),
      createdByPrincipalId: text(
        command.createdByPrincipalId,
        'coverageGapCommand.createdByPrincipalId',
        300
      ),
      mission: parseBrainResearchMissionV1(command.mission)
    };
  } catch (error) {
    return contractInvalid(error);
  }
}

function sourceIdentityFingerprint(
  workspaceId: string,
  source: Readonly<MethodImprovementCoverageGapEvidenceSourceV1>
): string {
  return fingerprint({
    workspaceId,
    evidenceId: source.evidenceId,
    evidenceFingerprintSha256: source.evidenceFingerprintSha256
  });
}

function requestFingerprint(command: Readonly<MethodImprovementCoverageGapCommandV1>): string {
  return fingerprint(command);
}

function evidenceResolutionReason(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function immutableResult(
  stored: Readonly<PreparedMethodImprovementCoverageGapAdmissionV1>,
  replayed: boolean
): MethodImprovementCoverageGapAdmissionResultV1 {
  return {
    trigger: structuredClone(stored.trigger),
    researchMission: structuredClone(stored.researchMission),
    replayed
  };
}

export class InMemoryMethodImprovementCoverageGapAdmissionRepositoryV1 implements MethodImprovementCoverageGapAdmissionRepositoryV1 {
  private readonly byReplayKey = new Map<string, StoredAdmission>();
  private readonly bySourceIdentity = new Map<string, StoredAdmission>();

  admit(
    input: Readonly<PreparedMethodImprovementCoverageGapAdmissionV1>
  ): Promise<MethodImprovementCoverageGapAdmissionResultV1> {
    const replayKey = input.trigger.admission.replayKeyFingerprintSha256;
    const sourceKey = `${input.trigger.workspaceId}:${input.sourceIdentityFingerprintSha256}`;
    const replayMatch = this.byReplayKey.get(replayKey);
    const sourceMatch = this.bySourceIdentity.get(sourceKey);

    if (replayMatch && sourceMatch && replayMatch !== sourceMatch) {
      throw new MethodImprovementCoverageGapAdmissionError(
        'TRIGGER_CONFLICT',
        'Coverage Gap replay and evidence identities resolve to different immutable admissions.'
      );
    }

    const existing = replayMatch ?? sourceMatch;
    if (existing) {
      if (
        existing.requestFingerprintSha256 !== input.requestFingerprintSha256 ||
        existing.sourceIdentityFingerprintSha256 !== input.sourceIdentityFingerprintSha256
      ) {
        throw new MethodImprovementCoverageGapAdmissionError(
          'TRIGGER_CONFLICT',
          'Coverage Gap idempotency or exact evidence identity is already bound to different admission content.'
        );
      }
      this.byReplayKey.set(replayKey, existing);
      return Promise.resolve(immutableResult(existing, true));
    }

    const stored = structuredClone(input);
    this.byReplayKey.set(replayKey, stored);
    this.bySourceIdentity.set(sourceKey, stored);
    return Promise.resolve(immutableResult(stored, false));
  }
}

export interface MethodImprovementCoverageGapAdmissionServiceOptionsV1 {
  repository: MethodImprovementCoverageGapAdmissionRepositoryV1;
  evidence: Readonly<CapabilityCoverageGapEvidenceAuthorityV1>;
  now?: () => string;
  triggerIdFactory?: () => string;
  researchMissionIdFactory?: () => string;
}

export class MethodImprovementCoverageGapAdmissionServiceV1 {
  private readonly now: () => string;
  private readonly triggerIdFactory: () => string;
  private readonly researchMissionIdFactory: () => string;

  constructor(private readonly options: MethodImprovementCoverageGapAdmissionServiceOptionsV1) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.triggerIdFactory = options.triggerIdFactory ?? randomUUID;
    this.researchMissionIdFactory = options.researchMissionIdFactory ?? randomUUID;
  }

  async admit(input: {
    workspaceId: string;
    idempotencyKey: string;
    correlationId: string;
    command: unknown;
  }): Promise<MethodImprovementCoverageGapAdmissionResultV1> {
    const command = parseMethodImprovementCoverageGapCommandV1(input.command);
    const trustedWorkspaceId = input.workspaceId.trim().toLowerCase();
    if (command.workspaceId !== trustedWorkspaceId) {
      throw new MethodImprovementCoverageGapAdmissionError(
        'WORKSPACE_MISMATCH',
        'Coverage Gap workspace does not match trusted request context.'
      );
    }
    const idempotencyKey = text(input.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = text(input.correlationId, 'correlationId', 300);

    let resolution: CapabilityCoverageGapEvidenceResolutionV1;
    try {
      resolution = await this.options.evidence.resolveExact({
        workspaceId: trustedWorkspaceId,
        evidenceId: command.source.evidenceId,
        evidenceFingerprintSha256: command.source.evidenceFingerprintSha256
      });
    } catch (error) {
      throw new MethodImprovementCoverageGapAdmissionError(
        'EVIDENCE_UNAVAILABLE',
        'Capability Coverage Gap evidence authority is unavailable.',
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }

    if (resolution.status === 'UNAVAILABLE') {
      throw new MethodImprovementCoverageGapAdmissionError(
        'EVIDENCE_UNAVAILABLE',
        evidenceResolutionReason(
          resolution.reason,
          'Capability Coverage Gap evidence authority is unavailable.'
        ),
        true
      );
    }
    if (resolution.status === 'NOT_FOUND') {
      throw new MethodImprovementCoverageGapAdmissionError(
        'EVIDENCE_NOT_FOUND',
        evidenceResolutionReason(
          resolution.reason,
          'Exact Capability Coverage Gap evidence was not found.'
        )
      );
    }

    let resolvedSource: MethodImprovementCoverageGapEvidenceSourceV1;
    try {
      resolvedSource = parseMethodImprovementCoverageGapEvidenceSourceV1(resolution.source);
    } catch (error) {
      if (error instanceof MethodImprovementCoverageGapContractError) {
        throw new MethodImprovementCoverageGapAdmissionError(
          'EVIDENCE_MISMATCH',
          'Resolved Capability Coverage Gap evidence violates the governed source contract.',
          false,
          { cause: error }
        );
      }
      throw error;
    }
    if (!same(resolvedSource, command.source)) {
      throw new MethodImprovementCoverageGapAdmissionError(
        'EVIDENCE_MISMATCH',
        'Resolved Capability Coverage Gap evidence does not match the exact requested evidence identity.'
      );
    }
    if (!RESEARCH_ELIGIBLE.has(resolvedSource.coverageStatus)) {
      throw new MethodImprovementCoverageGapAdmissionError(
        'INELIGIBLE_COVERAGE_GAP',
        `Coverage Gap status ${resolvedSource.coverageStatus} requires source-governance/currentness revalidation and cannot create Method Improvement research.`
      );
    }

    const replayKeyFingerprintSha256 = methodImprovementCoverageGapReplayKeyFingerprintV1({
      workspaceId: trustedWorkspaceId,
      evidenceId: resolvedSource.evidenceId,
      evidenceFingerprintSha256: resolvedSource.evidenceFingerprintSha256,
      idempotencyKey,
      createdByPrincipalId: command.createdByPrincipalId
    });
    const triggerBase = {
      schemaVersion: 1 as const,
      workspaceId: trustedWorkspaceId,
      triggerType: 'COVERAGE_GAP' as const,
      target: command.target,
      source: resolvedSource,
      admission: {
        kind: 'EXPLICIT_CORE_GOVERNANCE_ADMISSION' as const,
        idempotencyKey,
        sourceEvidenceResolution: 'EXACT_EVIDENCE_VERIFIED' as const,
        replayKeyFingerprintSha256
      },
      reason: command.reason,
      createdByPrincipalId: command.createdByPrincipalId,
      authorityConsequences: methodImprovementCoverageGapNoDownstreamAuthority
    };
    const triggerFingerprintSha256 = methodImprovementCoverageGapTriggerFingerprintV1(triggerBase);

    let trigger: MethodImprovementCoverageGapTriggerV1;
    try {
      trigger = parseMethodImprovementCoverageGapTriggerV1({
        ...triggerBase,
        triggerId: `method-improvement-trigger_${this.triggerIdFactory()}`,
        triggerFingerprintSha256,
        admittedAt: this.now()
      });
    } catch (error) {
      return contractInvalid(error);
    }

    const missionBase = {
      schemaVersion: 1 as const,
      workspaceId: trustedWorkspaceId,
      triggerId: trigger.triggerId,
      triggerFingerprintSha256: trigger.triggerFingerprintSha256,
      target: trigger.target,
      source: trigger.source,
      mission: command.mission,
      createdByPrincipalId: command.createdByPrincipalId,
      createdAt: command.mission.createdAt
    };
    const missionFingerprintSha256 = methodImprovementCoverageGapMissionFingerprintV1(missionBase);

    let researchMission: MethodImprovementCoverageGapResearchMissionV1;
    try {
      researchMission = parseMethodImprovementCoverageGapResearchMissionV1({
        ...missionBase,
        researchMissionId: `method-improvement-research-mission_${this.researchMissionIdFactory()}`,
        missionFingerprintSha256
      });
      assertMethodImprovementCoverageGapMissionBinding(trigger, researchMission);
    } catch (error) {
      return contractInvalid(error);
    }

    return this.options.repository.admit({
      trigger,
      researchMission,
      idempotencyKey,
      correlationId,
      sourceIdentityFingerprintSha256: sourceIdentityFingerprint(
        trustedWorkspaceId,
        resolvedSource
      ),
      requestFingerprintSha256: requestFingerprint(command)
    });
  }
}
