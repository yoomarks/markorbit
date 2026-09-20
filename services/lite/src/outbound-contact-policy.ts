import { createHash, randomUUID } from 'node:crypto';
import {
  noOutboundContactBasisAuthorityConsequencesV1,
  noOutboundContactReadinessAuthorityConsequencesV1,
  parseOutboundContactBasisAssertionV1,
  parseOutboundContactSuppressionV1,
  type OutboundContactBasisAssertionIdV1,
  type OutboundContactBasisAssertionV1,
  type OutboundContactBasisStateV1,
  type OutboundContactPolicyReferenceV1,
  type OutboundContactPurposeV1,
  type OutboundContactReadinessV1,
  type OutboundContactSuppressionIdV1,
  type OutboundContactSuppressionReasonV1,
  type OutboundContactSuppressionScopeV1,
  type OutboundContactSuppressionSourceClassV1,
  type OutboundContactSuppressionV1,
  type OutboundContactTargetReferenceV1
} from '@markorbit/contracts/outbound-contact-policy';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA = /^[0-9a-f]{64}$/u;
type Row = Record<string, unknown>;
type CommandType =
  'ASSERT_BASIS' | 'REVOKE_BASIS' | 'SUPERSEDE_BASIS' | 'SET_SUPPRESSION' | 'CLEAR_SUPPRESSION';
export type OutboundContactPolicyRuntimeErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';
export class OutboundContactPolicyRuntimeError extends Error {
  constructor(
    readonly code: OutboundContactPolicyRuntimeErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OutboundContactPolicyRuntimeError';
  }
}
export interface AssertOutboundContactBasisCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  targetRef: Readonly<OutboundContactTargetReferenceV1>;
  endpointFingerprintSha256: string;
  purpose: OutboundContactPurposeV1;
  marketOrJurisdiction?: string;
  policyRef: Readonly<OutboundContactPolicyReferenceV1>;
  basisState: OutboundContactBasisStateV1;
  evidenceRefs: readonly string[];
}
export interface ChangeOutboundContactBasisStatusCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  assertionId: OutboundContactBasisAssertionIdV1;
  expectedVersion: number;
}
export interface SetOutboundContactSuppressionCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  endpointFingerprintSha256: string;
  scope: OutboundContactSuppressionScopeV1;
  reasonCode: OutboundContactSuppressionReasonV1;
  sourceClass: OutboundContactSuppressionSourceClassV1;
  evidenceRefs: readonly string[];
  effectiveAt?: string;
}
export interface ClearOutboundContactSuppressionCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  suppressionId: OutboundContactSuppressionIdV1;
  expectedVersion: number;
  sourceClass: OutboundContactSuppressionSourceClassV1;
  evidenceRefs: readonly string[];
  effectiveAt?: string;
}
export interface EvaluateOutboundContactReadinessCommand {
  workspaceId: string;
  actorPrincipalId: string;
  targetRef: Readonly<OutboundContactTargetReferenceV1>;
  endpointFingerprintSha256: string;
  purpose: OutboundContactPurposeV1;
  policyRef: Readonly<OutboundContactPolicyReferenceV1>;
  reviewedSendFingerprintSha256: string;
}
const clone = <T>(v: T): T => structuredClone(v);
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, canonical(x)])
    );
  return v;
}
function hash(v: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(v)))
    .digest('hex');
}
function workspace(v: string): string {
  const x = v.trim().toLowerCase();
  if (!UUID.test(x))
    throw new OutboundContactPolicyRuntimeError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return x;
}
function text(v: string, f: string, max = 500): string {
  const x = v.trim();
  if (!x || x.length > max)
    throw new OutboundContactPolicyRuntimeError('INVALID_INPUT', `${f} is invalid.`, 422);
  return x;
}
function sha(v: string, f: string): string {
  const x = text(v, f, 64);
  if (!SHA.test(x))
    throw new OutboundContactPolicyRuntimeError(
      'INVALID_INPUT',
      `${f} must be lowercase SHA-256.`,
      422
    );
  return x;
}
function version(v: number): number {
  if (!Number.isSafeInteger(v) || v < 1)
    throw new OutboundContactPolicyRuntimeError(
      'INVALID_INPUT',
      'expectedVersion must be positive.',
      422
    );
  return v;
}
function at(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime()))
    throw new OutboundContactPolicyRuntimeError('INVALID_INPUT', 'timestamp is invalid.', 422);
  return d.toISOString();
}
function targetRef(
  v: Readonly<OutboundContactTargetReferenceV1>
): OutboundContactTargetReferenceV1 {
  return {
    owner: text(v.owner, 'targetRef.owner', 120),
    kind: text(v.kind, 'targetRef.kind', 120),
    id: text(v.id, 'targetRef.id'),
    version: version(v.version)
  };
}
function policyRef(
  v: Readonly<OutboundContactPolicyReferenceV1>
): OutboundContactPolicyReferenceV1 {
  return { policyId: text(v.policyId, 'policyRef.policyId', 240), version: version(v.version) };
}
function evidence(v: readonly string[]): readonly string[] {
  if (v.length > 20)
    throw new OutboundContactPolicyRuntimeError(
      'INVALID_INPUT',
      'evidenceRefs must be bounded.',
      422
    );
  return v.map((x, i) => text(x, `evidenceRefs[${i}]`));
}
function persistedBasis(v: unknown, w: string) {
  try {
    const x = parseOutboundContactBasisAssertionV1(v);
    if (x.workspaceId !== w) throw new Error('workspace');
    return x;
  } catch (error) {
    throw new OutboundContactPolicyRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted outbound basis assertion failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
function persistedSuppression(v: unknown, w: string) {
  try {
    const x = parseOutboundContactSuppressionV1(v);
    if (x.workspaceId !== w) throw new Error('workspace');
    return x;
  } catch (error) {
    throw new OutboundContactPolicyRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted outbound suppression failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
export class PostgresOutboundContactPolicyStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => randomUUID().replaceAll('-', '')
  ) {}
  async assertBasis(
    command: Readonly<AssertOutboundContactBasisCommand>
  ): Promise<OutboundContactBasisAssertionV1> {
    const w = workspace(command.workspaceId),
      actor = text(command.actorPrincipalId, 'actorPrincipalId', 240),
      endpoint = sha(command.endpointFingerprintSha256, 'endpointFingerprintSha256');
    const target = targetRef(command.targetRef),
      policy = policyRef(command.policyRef),
      targetFingerprint = hash(target),
      key = text(command.idempotencyKey, 'idempotencyKey');
    const fp = hash({
      ...command,
      workspaceId: w,
      actorPrincipalId: actor,
      targetRef: target,
      policyRef: policy,
      endpointFingerprintSha256: endpoint,
      evidenceRefs: evidence(command.evidenceRefs)
    });
    return this.command(
      w,
      key,
      'ASSERT_BASIS',
      fp,
      (v) => persistedBasis(v, w),
      async (client) => {
        await this.lock(client, `${w}:basis:${targetFingerprint}:${endpoint}:${command.purpose}`);
        const current = await this.currentBasisWith(
          client,
          w,
          targetFingerprint,
          endpoint,
          command.purpose
        );
        const now = at(this.now());
        const next = parseOutboundContactBasisAssertionV1({
          schemaVersion: 1,
          assertionId: current?.assertionId ?? `outbound-contact-basis_${this.id()}`,
          workspaceId: w,
          version: (current?.version ?? 0) + 1,
          targetRef: target,
          channel: 'EMAIL',
          endpointFingerprintSha256: endpoint,
          purpose: command.purpose,
          ...(command.marketOrJurisdiction
            ? {
                marketOrJurisdiction: text(command.marketOrJurisdiction, 'marketOrJurisdiction', 80)
              }
            : {}),
          policyRef: policy,
          basisState: command.basisState,
          evidenceRefs: evidence(command.evidenceRefs),
          assertedByPrincipalId: actor,
          assertedAt: now,
          status: 'ACTIVE',
          supersedesVersion: current?.version ?? null,
          authorityConsequences: noOutboundContactBasisAuthorityConsequencesV1
        });
        await this.insertBasis(client, next, targetFingerprint);
        await client.query(
          `INSERT INTO lite_outbound_contact_basis_heads(workspace_id,target_fingerprint_sha256,endpoint_fingerprint_sha256,purpose,assertion_id,latest_version,status,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id,target_fingerprint_sha256,endpoint_fingerprint_sha256,purpose) DO UPDATE SET assertion_id=EXCLUDED.assertion_id,latest_version=EXCLUDED.latest_version,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
          [
            w,
            targetFingerprint,
            endpoint,
            command.purpose,
            next.assertionId,
            next.version,
            next.status,
            now
          ]
        );
        return next;
      }
    );
  }
  revokeBasis(command: Readonly<ChangeOutboundContactBasisStatusCommand>) {
    return this.changeBasis(command, 'REVOKED', 'REVOKE_BASIS');
  }
  supersedeBasis(command: Readonly<ChangeOutboundContactBasisStatusCommand>) {
    return this.changeBasis(command, 'SUPERSEDED', 'SUPERSEDE_BASIS');
  }
  private async changeBasis(
    command: Readonly<ChangeOutboundContactBasisStatusCommand>,
    status: 'REVOKED' | 'SUPERSEDED',
    type: CommandType
  ): Promise<OutboundContactBasisAssertionV1> {
    const w = workspace(command.workspaceId),
      key = text(command.idempotencyKey, 'idempotencyKey'),
      expected = version(command.expectedVersion),
      actor = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const fp = hash({ ...command, workspaceId: w, actorPrincipalId: actor, status });
    return this.command(
      w,
      key,
      type,
      fp,
      (v) => persistedBasis(v, w),
      async (client) => {
        await this.lock(client, `${w}:basis-id:${command.assertionId}`);
        let current = await this.currentBasisById(client, w, command.assertionId);
        if (!current)
          throw new OutboundContactPolicyRuntimeError(
            'NOT_FOUND',
            'Outbound basis assertion was not found.',
            404
          );
        const tf = hash(current.targetRef);
        await this.lock(
          client,
          `${w}:basis:${tf}:${current.endpointFingerprintSha256}:${current.purpose}`
        );
        current = await this.currentBasisById(client, w, command.assertionId);
        if (!current)
          throw new OutboundContactPolicyRuntimeError(
            'NOT_FOUND',
            'Outbound basis assertion was not found.',
            404
          );
        if (current.version !== expected)
          throw new OutboundContactPolicyRuntimeError(
            'VERSION_CONFLICT',
            'Outbound basis assertion version changed.'
          );
        if (current.status !== 'ACTIVE')
          throw new OutboundContactPolicyRuntimeError(
            'INVALID_TRANSITION',
            'Only an active basis assertion can change lifecycle.'
          );
        const now = at(this.now());
        const next = parseOutboundContactBasisAssertionV1({
          ...current,
          version: current.version + 1,
          status,
          supersedesVersion: current.version,
          assertedByPrincipalId: actor,
          assertedAt: now
        });
        await this.insertBasis(client, next, tf);
        const r = await client.query(
          `UPDATE lite_outbound_contact_basis_heads SET latest_version=$5,status=$6,updated_at=$7 WHERE workspace_id=$1 AND target_fingerprint_sha256=$2 AND endpoint_fingerprint_sha256=$3 AND purpose=$4 AND latest_version=$8`,
          [
            w,
            tf,
            next.endpointFingerprintSha256,
            next.purpose,
            next.version,
            next.status,
            now,
            expected
          ]
        );
        if (r.rowCount !== 1)
          throw new OutboundContactPolicyRuntimeError(
            'VERSION_CONFLICT',
            'Outbound basis assertion changed before persistence.'
          );
        return next;
      }
    );
  }
  async setSuppression(
    command: Readonly<SetOutboundContactSuppressionCommand>
  ): Promise<OutboundContactSuppressionV1> {
    const w = workspace(command.workspaceId),
      endpoint = sha(command.endpointFingerprintSha256, 'endpointFingerprintSha256'),
      actor = text(command.actorPrincipalId, 'actorPrincipalId', 240),
      key = text(command.idempotencyKey, 'idempotencyKey'),
      refs = evidence(command.evidenceRefs);
    const fp = hash({
      ...command,
      workspaceId: w,
      actorPrincipalId: actor,
      endpointFingerprintSha256: endpoint,
      evidenceRefs: refs
    });
    return this.command(
      w,
      key,
      'SET_SUPPRESSION',
      fp,
      (v) => persistedSuppression(v, w),
      async (client) => {
        await this.lock(client, `${w}:suppression:${endpoint}:${command.scope}`);
        const current = await this.currentSuppressionWith(client, w, endpoint, command.scope);
        const now = at(this.now());
        const effective = command.effectiveAt ? at(command.effectiveAt) : now;
        const next = parseOutboundContactSuppressionV1({
          schemaVersion: 1,
          suppressionId: current?.suppressionId ?? `outbound-contact-suppression_${this.id()}`,
          workspaceId: w,
          version: (current?.version ?? 0) + 1,
          channel: 'EMAIL',
          endpointFingerprintSha256: endpoint,
          scope: command.scope,
          status: 'ACTIVE',
          reasonCode: command.reasonCode,
          sourceClass: command.sourceClass,
          evidenceRefs: refs,
          effectiveAt: effective,
          recordedAt: now,
          recordedByPrincipalId: actor,
          supersedesVersion: current?.version ?? null,
          legalConsentVerifiedByMarkOrbit: false,
          externalSendAuthorized: false
        });
        await this.insertSuppression(client, next);
        await client.query(
          `INSERT INTO lite_outbound_contact_suppression_heads(workspace_id,endpoint_fingerprint_sha256,scope,suppression_id,latest_version,status,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,endpoint_fingerprint_sha256,scope) DO UPDATE SET suppression_id=EXCLUDED.suppression_id,latest_version=EXCLUDED.latest_version,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
          [w, endpoint, next.scope, next.suppressionId, next.version, next.status, now]
        );
        return next;
      }
    );
  }
  async clearSuppression(
    command: Readonly<ClearOutboundContactSuppressionCommand>
  ): Promise<OutboundContactSuppressionV1> {
    const w = workspace(command.workspaceId),
      key = text(command.idempotencyKey, 'idempotencyKey'),
      expected = version(command.expectedVersion),
      actor = text(command.actorPrincipalId, 'actorPrincipalId', 240),
      refs = evidence(command.evidenceRefs);
    const fp = hash({ ...command, workspaceId: w, actorPrincipalId: actor, evidenceRefs: refs });
    return this.command(
      w,
      key,
      'CLEAR_SUPPRESSION',
      fp,
      (v) => persistedSuppression(v, w),
      async (client) => {
        await this.lock(client, `${w}:suppression-id:${command.suppressionId}`);
        let current = await this.currentSuppressionById(client, w, command.suppressionId);
        if (!current)
          throw new OutboundContactPolicyRuntimeError(
            'NOT_FOUND',
            'Outbound suppression was not found.',
            404
          );
        await this.lock(
          client,
          `${w}:suppression:${current.endpointFingerprintSha256}:${current.scope}`
        );
        current = await this.currentSuppressionById(client, w, command.suppressionId);
        if (!current)
          throw new OutboundContactPolicyRuntimeError(
            'NOT_FOUND',
            'Outbound suppression was not found.',
            404
          );
        if (current.version !== expected)
          throw new OutboundContactPolicyRuntimeError(
            'VERSION_CONFLICT',
            'Outbound suppression version changed.'
          );
        if (current.status !== 'ACTIVE')
          throw new OutboundContactPolicyRuntimeError(
            'INVALID_TRANSITION',
            'Only an active suppression can be cleared.'
          );
        const now = at(this.now());
        const next = parseOutboundContactSuppressionV1({
          ...current,
          version: current.version + 1,
          status: 'CLEARED',
          sourceClass: command.sourceClass,
          evidenceRefs: refs,
          effectiveAt: command.effectiveAt ? at(command.effectiveAt) : now,
          recordedAt: now,
          recordedByPrincipalId: actor,
          supersedesVersion: current.version
        });
        await this.insertSuppression(client, next);
        const r = await client.query(
          `UPDATE lite_outbound_contact_suppression_heads SET latest_version=$4,status=$5,updated_at=$6 WHERE workspace_id=$1 AND endpoint_fingerprint_sha256=$2 AND scope=$3 AND latest_version=$7`,
          [w, next.endpointFingerprintSha256, next.scope, next.version, next.status, now, expected]
        );
        if (r.rowCount !== 1)
          throw new OutboundContactPolicyRuntimeError(
            'VERSION_CONFLICT',
            'Outbound suppression changed before persistence.'
          );
        return next;
      }
    );
  }
  async evaluate(
    command: Readonly<EvaluateOutboundContactReadinessCommand>
  ): Promise<OutboundContactReadinessV1> {
    const w = workspace(command.workspaceId),
      actor = text(command.actorPrincipalId, 'actorPrincipalId', 240),
      target = targetRef(command.targetRef),
      tf = hash(target),
      endpoint = sha(command.endpointFingerprintSha256, 'endpointFingerprintSha256'),
      policy = policyRef(command.policyRef),
      send = sha(command.reviewedSendFingerprintSha256, 'reviewedSendFingerprintSha256');
    const current = await this.currentBasis(w, tf, endpoint, command.purpose);
    const suppressions = await this.currentSuppressions(w, endpoint, command.purpose);
    const active = suppressions.find((x) => x.status === 'ACTIVE');
    let outcome: OutboundContactReadinessV1['outcome'] = 'UNKNOWN';
    let reason: OutboundContactReadinessV1['reason'] = 'NO_CURRENT_ASSERTION';
    if (active) {
      outcome = 'BLOCKED';
      reason = 'ACTIVE_SUPPRESSION';
    } else if (!current) {
      outcome = 'UNKNOWN';
      reason = 'NO_CURRENT_ASSERTION';
    } else if (current.status !== 'ACTIVE') {
      outcome = 'UNKNOWN';
      reason = 'ASSERTION_NOT_ACTIVE';
    } else if (hash(current.targetRef) !== tf) {
      outcome = 'UNKNOWN';
      reason = 'TARGET_MISMATCH';
    } else if (
      current.policyRef.policyId !== policy.policyId ||
      current.policyRef.version !== policy.version
    ) {
      outcome = 'UNKNOWN';
      reason = 'POLICY_MISMATCH';
    } else if (current.basisState === 'ASSERTED_BLOCKED') {
      outcome = 'BLOCKED';
      reason = 'ASSERTED_BLOCKED';
    } else {
      outcome = 'READY_FOR_HUMAN_SEND';
      reason = 'CURRENT_ALLOWED_ASSERTION';
    }
    const evaluatedAt = at(this.now());
    const basisAssertionRef = current
      ? { assertionId: current.assertionId, version: current.version }
      : undefined;
    const suppressionRefs = suppressions.map((x) => ({
      suppressionId: x.suppressionId,
      version: x.version,
      scope: x.scope,
      status: x.status
    }));
    const fingerprintBase = {
      schemaVersion: 1 as const,
      workspaceId: w,
      evaluatedByPrincipalId: actor,
      targetRef: target,
      channel: 'EMAIL' as const,
      endpointFingerprintSha256: endpoint,
      purpose: command.purpose,
      policyRef: policy,
      reviewedSendFingerprintSha256: send,
      outcome,
      reason,
      ...(basisAssertionRef ? { basisAssertionRef } : {}),
      suppressionRefs,
      authorityConsequences: noOutboundContactReadinessAuthorityConsequencesV1
    };
    return { ...fingerprintBase, evaluatedAt, readinessFingerprintSha256: hash(fingerprintBase) };
  }
  async currentBasis(w: string, tf: string, endpoint: string, purpose: OutboundContactPurposeV1) {
    try {
      return await this.currentBasisWith(
        this.query,
        workspace(w),
        sha(tf, 'targetFingerprintSha256'),
        sha(endpoint, 'endpointFingerprintSha256'),
        purpose
      );
    } catch (error) {
      if (error instanceof OutboundContactPolicyRuntimeError) throw error;
      throw this.persistence(error);
    }
  }
  async currentGlobalSuppressions(w: string, endpoint: string) {
    try {
      const workspaceId = workspace(w);
      const result = await this.query.query<Row>(
        `SELECT v.document_json FROM lite_outbound_contact_suppression_heads h JOIN lite_outbound_contact_suppression_versions v ON v.workspace_id=h.workspace_id AND v.suppression_id=h.suppression_id AND v.version=h.latest_version WHERE h.workspace_id=$1 AND h.endpoint_fingerprint_sha256=$2 AND h.scope='ALL_OUTBOUND' ORDER BY h.updated_at DESC`,
        [workspaceId, sha(endpoint, 'endpointFingerprintSha256')]
      );
      return result.rows.map((r) => persistedSuppression(r.document_json, workspaceId));
    } catch (error) {
      if (error instanceof OutboundContactPolicyRuntimeError) throw error;
      throw this.persistence(error);
    }
  }
  async currentSuppressions(w: string, endpoint: string, purpose: OutboundContactPurposeV1) {
    try {
      const result = await this.query.query<Row>(
        `SELECT v.document_json FROM lite_outbound_contact_suppression_heads h JOIN lite_outbound_contact_suppression_versions v ON v.workspace_id=h.workspace_id AND v.suppression_id=h.suppression_id AND v.version=h.latest_version WHERE h.workspace_id=$1 AND h.endpoint_fingerprint_sha256=$2 AND h.scope=ANY($3::text[]) ORDER BY h.scope`,
        [workspace(w), sha(endpoint, 'endpointFingerprintSha256'), ['ALL_OUTBOUND', purpose]]
      );
      return result.rows.map((r) => persistedSuppression(r.document_json, workspace(w)));
    } catch (error) {
      if (error instanceof OutboundContactPolicyRuntimeError) throw error;
      throw this.persistence(error);
    }
  }
  private async currentBasisWith(
    q: QueryClient,
    w: string,
    tf: string,
    endpoint: string,
    purpose: OutboundContactPurposeV1
  ) {
    const r = await q.query<Row>(
      `SELECT v.document_json FROM lite_outbound_contact_basis_heads h JOIN lite_outbound_contact_basis_versions v ON v.workspace_id=h.workspace_id AND v.assertion_id=h.assertion_id AND v.version=h.latest_version WHERE h.workspace_id=$1 AND h.target_fingerprint_sha256=$2 AND h.endpoint_fingerprint_sha256=$3 AND h.purpose=$4`,
      [w, tf, endpoint, purpose]
    );
    return r.rows[0] ? persistedBasis(r.rows[0].document_json, w) : undefined;
  }
  private async currentBasisById(q: QueryClient, w: string, id: OutboundContactBasisAssertionIdV1) {
    const r = await q.query<Row>(
      `SELECT v.document_json FROM lite_outbound_contact_basis_heads h JOIN lite_outbound_contact_basis_versions v ON v.workspace_id=h.workspace_id AND v.assertion_id=h.assertion_id AND v.version=h.latest_version WHERE h.workspace_id=$1 AND h.assertion_id=$2`,
      [w, id]
    );
    return r.rows[0] ? persistedBasis(r.rows[0].document_json, w) : undefined;
  }
  private async currentSuppressionWith(
    q: QueryClient,
    w: string,
    endpoint: string,
    scope: OutboundContactSuppressionScopeV1
  ) {
    const r = await q.query<Row>(
      `SELECT v.document_json FROM lite_outbound_contact_suppression_heads h JOIN lite_outbound_contact_suppression_versions v ON v.workspace_id=h.workspace_id AND v.suppression_id=h.suppression_id AND v.version=h.latest_version WHERE h.workspace_id=$1 AND h.endpoint_fingerprint_sha256=$2 AND h.scope=$3`,
      [w, endpoint, scope]
    );
    return r.rows[0] ? persistedSuppression(r.rows[0].document_json, w) : undefined;
  }
  private async currentSuppressionById(
    q: QueryClient,
    w: string,
    id: OutboundContactSuppressionIdV1
  ) {
    const r = await q.query<Row>(
      `SELECT v.document_json FROM lite_outbound_contact_suppression_heads h JOIN lite_outbound_contact_suppression_versions v ON v.workspace_id=h.workspace_id AND v.suppression_id=h.suppression_id AND v.version=h.latest_version WHERE h.workspace_id=$1 AND h.suppression_id=$2`,
      [w, id]
    );
    return r.rows[0] ? persistedSuppression(r.rows[0].document_json, w) : undefined;
  }
  private insertBasis(q: QueryClient, x: OutboundContactBasisAssertionV1, tf: string) {
    return q
      .query(
        `INSERT INTO lite_outbound_contact_basis_versions(workspace_id,assertion_id,version,target_fingerprint_sha256,endpoint_fingerprint_sha256,purpose,status,document_json,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [
          x.workspaceId,
          x.assertionId,
          x.version,
          tf,
          x.endpointFingerprintSha256,
          x.purpose,
          x.status,
          JSON.stringify(x),
          x.assertedAt
        ]
      )
      .then(() => undefined);
  }
  private insertSuppression(q: QueryClient, x: OutboundContactSuppressionV1) {
    return q
      .query(
        `INSERT INTO lite_outbound_contact_suppression_versions(workspace_id,suppression_id,version,endpoint_fingerprint_sha256,scope,status,document_json,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
        [
          x.workspaceId,
          x.suppressionId,
          x.version,
          x.endpointFingerprintSha256,
          x.scope,
          x.status,
          JSON.stringify(x),
          x.recordedAt
        ]
      )
      .then(() => undefined);
  }
  private async command<T>(
    w: string,
    key: string,
    type: CommandType,
    fp: string,
    parse: (v: unknown) => T,
    write: (q: QueryClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.database.transact(async (q) => {
        await this.lock(q, `${w}:outbound-idem:${key}`);
        const r = await q.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json FROM lite_outbound_contact_policy_commands WHERE workspace_id=$1 AND idempotency_key=$2`,
          [w, key]
        );
        const prior = r.rows[0];
        if (prior) {
          if (prior.command_type !== type || prior.request_fingerprint_sha256 !== fp)
            throw new OutboundContactPolicyRuntimeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key is already bound to another outbound contact policy command.'
            );
          return parse(prior.result_json);
        }
        const result = await write(q);
        await q.query(
          `INSERT INTO lite_outbound_contact_policy_commands(workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [w, key, type, fp, JSON.stringify(result), at(this.now())]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof OutboundContactPolicyRuntimeError) throw error;
      throw this.persistence(error);
    }
  }
  private lock(q: QueryClient, key: string) {
    return q
      .query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key])
      .then(() => undefined);
  }
  private persistence(cause: unknown) {
    return new OutboundContactPolicyRuntimeError(
      'PERSISTENCE_UNAVAILABLE',
      'Outbound contact policy persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
