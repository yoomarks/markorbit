import { createHash } from 'node:crypto';

import {
  BrainMethodContractError,
  parseExecutableMethodPackageV1,
  type ExecutableMethodPackageV1
} from './brain-method.js';

export const EXECUTABLE_METHOD_ACTIVATION_DECISION_VERSION =
  'EXECUTABLE_METHOD_PACKAGE_ACTIVATION_DECISION_V1' as const;

export interface ExecutableMethodPackageActivationDecisionV1 {
  schemaVersion: 1;
  decisionVersion: typeof EXECUTABLE_METHOD_ACTIVATION_DECISION_VERSION;
  decisionId: `brain-method-activation_${string}`;
  decision: 'APPROVED' | 'REJECTED';
  predecessor: Readonly<{
    packageId: ExecutableMethodPackageV1['packageId'];
    packageVersion: number;
    packageFingerprintSha256: string;
    methodId: ExecutableMethodPackageV1['methodId'];
    methodVersionId: ExecutableMethodPackageV1['methodVersionId'];
    evaluationId: string;
  }>;
  target: Readonly<{
    packageVersion: number;
    lifecycle: 'ACTIVE';
    selectionPriority: number;
    limitations: readonly string[];
  }>;
  approval: Readonly<{
    authority: 'BRAIN_GOVERNANCE';
    policyVersion: string;
    approvedBy: string;
    approvalTicketRef: string;
    approvedAt: string;
    rationale: string;
  }>;
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

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function text(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string') throw new BrainMethodContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    throw new BrainMethodContractError(`${field} must contain 1 to ${maximum} characters.`);
  }
  return cleaned;
}

function instant(value: unknown, field: string): string {
  const cleaned = text(value, field, 100);
  if (Number.isNaN(Date.parse(cleaned))) {
    throw new BrainMethodContractError(`${field} must be an ISO date/time.`);
  }
  return cleaned;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new BrainMethodContractError(`${field} must be a positive safe integer.`);
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new BrainMethodContractError(`${field} must be a non-negative safe integer.`);
  }
  return value as number;
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BrainMethodContractError(`${field} must be a non-empty array.`);
  }
  const parsed = value.map((item, index) => text(item, `${field}[${index}]`, 2000));
  if (new Set(parsed).size !== parsed.length) {
    throw new BrainMethodContractError(`${field} must not contain duplicates.`);
  }
  return parsed;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BrainMethodContractError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allow = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allow.has(key));
  const missing = allowed.filter((key) => !(key in value));
  if (unsupported.length || missing.length) {
    throw new BrainMethodContractError(`${field} does not match the activation decision contract.`);
  }
}

export function executableMethodPackageFingerprintV1(value: unknown): string {
  return sha256(parseExecutableMethodPackageV1(value));
}

export function prepareExecutableMethodPackageActivationDecisionV1(
  packageValue: unknown,
  input: Readonly<{
    decision: 'APPROVED' | 'REJECTED';
    selectionPriority: number;
    limitations: readonly string[];
    policyVersion: string;
    approvedBy: string;
    approvalTicketRef: string;
    approvedAt: string;
    rationale: string;
  }>
): Readonly<ExecutableMethodPackageActivationDecisionV1> {
  const pkg = parseExecutableMethodPackageV1(packageValue);
  if (pkg.lifecycle !== 'VALIDATED' || pkg.activatedAt !== undefined) {
    throw new BrainMethodContractError(
      'Only an unactivated VALIDATED executable method package may receive an activation decision.'
    );
  }
  if (pkg.evaluation.status !== 'PASSED') {
    throw new BrainMethodContractError('Activation requires a PASSED method evaluation.');
  }

  const predecessorFingerprint = executableMethodPackageFingerprintV1(pkg);
  const approvedAt = instant(input.approvedAt, 'activation.approvedAt');
  const decisionIdentity = sha256({
    packageId: pkg.packageId,
    packageVersion: pkg.packageVersion,
    packageFingerprintSha256: predecessorFingerprint,
    decision: input.decision,
    policyVersion: text(input.policyVersion, 'activation.policyVersion', 300),
    approvedBy: text(input.approvedBy, 'activation.approvedBy', 300),
    approvalTicketRef: text(input.approvalTicketRef, 'activation.approvalTicketRef', 500),
    approvedAt
  });

  return parseExecutableMethodPackageActivationDecisionV1({
    schemaVersion: 1,
    decisionVersion: EXECUTABLE_METHOD_ACTIVATION_DECISION_VERSION,
    decisionId: `brain-method-activation_${decisionIdentity}`,
    decision: input.decision,
    predecessor: {
      packageId: pkg.packageId,
      packageVersion: pkg.packageVersion,
      packageFingerprintSha256: predecessorFingerprint,
      methodId: pkg.methodId,
      methodVersionId: pkg.methodVersionId,
      evaluationId: pkg.evaluation.evaluationId
    },
    target: {
      packageVersion: pkg.packageVersion + 1,
      lifecycle: 'ACTIVE',
      selectionPriority: nonNegativeInteger(
        input.selectionPriority,
        'activation.selectionPriority'
      ),
      limitations: stringArray(input.limitations, 'activation.limitations')
    },
    approval: {
      authority: 'BRAIN_GOVERNANCE',
      policyVersion: input.policyVersion,
      approvedBy: input.approvedBy,
      approvalTicketRef: input.approvalTicketRef,
      approvedAt,
      rationale: input.rationale
    }
  });
}

export function parseExecutableMethodPackageActivationDecisionV1(
  value: unknown
): ExecutableMethodPackageActivationDecisionV1 {
  const decision = record(value, 'activationDecision');
  exactKeys(
    decision,
    [
      'schemaVersion',
      'decisionVersion',
      'decisionId',
      'decision',
      'predecessor',
      'target',
      'approval'
    ],
    'activationDecision'
  );
  if (
    decision.schemaVersion !== 1 ||
    decision.decisionVersion !== EXECUTABLE_METHOD_ACTIVATION_DECISION_VERSION
  ) {
    throw new BrainMethodContractError('activationDecision version is invalid.');
  }
  if (decision.decision !== 'APPROVED' && decision.decision !== 'REJECTED') {
    throw new BrainMethodContractError('activationDecision.decision is invalid.');
  }
  const decisionId = text(decision.decisionId, 'activationDecision.decisionId', 300);
  if (!decisionId.startsWith('brain-method-activation_')) {
    throw new BrainMethodContractError(
      'activationDecision.decisionId must start with brain-method-activation_.'
    );
  }

  const predecessor = record(decision.predecessor, 'activationDecision.predecessor');
  exactKeys(
    predecessor,
    [
      'packageId',
      'packageVersion',
      'packageFingerprintSha256',
      'methodId',
      'methodVersionId',
      'evaluationId'
    ],
    'activationDecision.predecessor'
  );
  const packageFingerprintSha256 = text(
    predecessor.packageFingerprintSha256,
    'activationDecision.predecessor.packageFingerprintSha256',
    64
  ).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(packageFingerprintSha256)) {
    throw new BrainMethodContractError(
      'activationDecision.predecessor.packageFingerprintSha256 must be SHA-256.'
    );
  }

  const target = record(decision.target, 'activationDecision.target');
  exactKeys(
    target,
    ['packageVersion', 'lifecycle', 'selectionPriority', 'limitations'],
    'activationDecision.target'
  );
  if (target.lifecycle !== 'ACTIVE') {
    throw new BrainMethodContractError('activationDecision.target.lifecycle must be ACTIVE.');
  }

  const approval = record(decision.approval, 'activationDecision.approval');
  exactKeys(
    approval,
    ['authority', 'policyVersion', 'approvedBy', 'approvalTicketRef', 'approvedAt', 'rationale'],
    'activationDecision.approval'
  );
  if (approval.authority !== 'BRAIN_GOVERNANCE') {
    throw new BrainMethodContractError(
      'activationDecision.approval.authority must be BRAIN_GOVERNANCE.'
    );
  }

  return {
    schemaVersion: 1,
    decisionVersion: EXECUTABLE_METHOD_ACTIVATION_DECISION_VERSION,
    decisionId: decisionId as `brain-method-activation_${string}`,
    decision: decision.decision,
    predecessor: {
      packageId: text(
        predecessor.packageId,
        'activationDecision.predecessor.packageId',
        300
      ) as ExecutableMethodPackageV1['packageId'],
      packageVersion: positiveInteger(
        predecessor.packageVersion,
        'activationDecision.predecessor.packageVersion'
      ),
      packageFingerprintSha256,
      methodId: text(
        predecessor.methodId,
        'activationDecision.predecessor.methodId',
        300
      ) as ExecutableMethodPackageV1['methodId'],
      methodVersionId: text(
        predecessor.methodVersionId,
        'activationDecision.predecessor.methodVersionId',
        300
      ) as ExecutableMethodPackageV1['methodVersionId'],
      evaluationId: text(
        predecessor.evaluationId,
        'activationDecision.predecessor.evaluationId',
        500
      )
    },
    target: {
      packageVersion: positiveInteger(
        target.packageVersion,
        'activationDecision.target.packageVersion'
      ),
      lifecycle: 'ACTIVE',
      selectionPriority: nonNegativeInteger(
        target.selectionPriority,
        'activationDecision.target.selectionPriority'
      ),
      limitations: stringArray(target.limitations, 'activationDecision.target.limitations')
    },
    approval: {
      authority: 'BRAIN_GOVERNANCE',
      policyVersion: text(approval.policyVersion, 'activationDecision.approval.policyVersion', 300),
      approvedBy: text(approval.approvedBy, 'activationDecision.approval.approvedBy', 300),
      approvalTicketRef: text(
        approval.approvalTicketRef,
        'activationDecision.approval.approvalTicketRef',
        500
      ),
      approvedAt: instant(approval.approvedAt, 'activationDecision.approval.approvedAt'),
      rationale: text(approval.rationale, 'activationDecision.approval.rationale', 2000)
    }
  };
}

export function activateExecutableMethodPackageV1(
  packageValue: unknown,
  decisionValue: unknown
): Readonly<ExecutableMethodPackageV1> {
  const pkg = parseExecutableMethodPackageV1(packageValue);
  const decision = parseExecutableMethodPackageActivationDecisionV1(decisionValue);

  if (pkg.lifecycle !== 'VALIDATED' || pkg.activatedAt !== undefined) {
    throw new BrainMethodContractError(
      'Activation predecessor must be the exact unactivated VALIDATED package.'
    );
  }
  if (decision.decision !== 'APPROVED') {
    throw new BrainMethodContractError('A REJECTED activation decision cannot produce ACTIVE state.');
  }
  if (
    decision.predecessor.packageId !== pkg.packageId ||
    decision.predecessor.packageVersion !== pkg.packageVersion ||
    decision.predecessor.packageFingerprintSha256 !== executableMethodPackageFingerprintV1(pkg) ||
    decision.predecessor.methodId !== pkg.methodId ||
    decision.predecessor.methodVersionId !== pkg.methodVersionId ||
    decision.predecessor.evaluationId !== pkg.evaluation.evaluationId
  ) {
    throw new BrainMethodContractError(
      'Activation decision does not bind the exact VALIDATED predecessor package.'
    );
  }
  if (decision.target.packageVersion !== pkg.packageVersion + 1) {
    throw new BrainMethodContractError(
      'ACTIVE executable package version must be the next immutable package version.'
    );
  }

  return parseExecutableMethodPackageV1({
    ...pkg,
    packageVersion: decision.target.packageVersion,
    lifecycle: 'ACTIVE',
    selectionPriority: decision.target.selectionPriority,
    limitations: [...decision.target.limitations],
    activatedAt: decision.approval.approvedAt
  });
}

export function executableMethodActivationEvidenceRefV1(
  decisionValue: unknown
): string {
  const decision = parseExecutableMethodPackageActivationDecisionV1(decisionValue);
  return `brain-method-activation:${decision.decisionId}:${decision.predecessor.packageFingerprintSha256}`;
}
