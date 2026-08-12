import { createHash, randomUUID } from 'node:crypto';
import {
  capabilityLearningNoAuthorityConsequences,
  reflectionDispositionOutcomes,
  type CapabilityLedgerEntry,
  type CapabilityProfileProjection,
  type CapabilityProfileProjectionId,
  type CapabilityTwinProjection,
  type CapabilityTwinProjectionId,
  type ReflectionCandidate,
  type ReflectionCandidateId,
  type ReflectionDisposition,
  type ReflectionDispositionId,
  type ReflectionDispositionOutcome,
  type RuntimeCapabilityDefinitionId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';

const CANDIDATE_ID = /^reflection-candidate_[0-9a-f]{32}$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;

type Row = Record<string, unknown>;

export type ReflectionDispositionProfileErrorCode =
  | 'INVALID_INPUT'
  | 'CANDIDATE_NOT_FOUND'
  | 'CANDIDATE_FINGERPRINT_MISMATCH'
  | 'STALE_CANDIDATE'
  | 'CANDIDATE_ALREADY_DISPOSITIONED'
  | 'PROFILE_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class ReflectionDispositionProfileError extends Error {
  constructor(
    readonly code: ReflectionDispositionProfileErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ReflectionDispositionProfileError';
  }
}

export interface ReflectionDispositionProfileTransactionHost {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

export interface ReflectionDispositionCommand {
  candidateVersion: number;
  expectedCandidateFingerprintSha256: string;
  outcome: ReflectionDispositionOutcome;
  rationale?: string;
}

export interface ReflectionDispositionProfileResult {
  disposition: Readonly<ReflectionDisposition>;
  profile: Readonly<CapabilityProfileProjection>;
  twin: Readonly<CapabilityTwinProjection>;
  replayed: boolean;
}

interface CandidateSnapshot {
  candidate: ReflectionCandidate;
  fingerprintSha256: string;
}

interface DispositionWithCandidate {
  disposition: ReflectionDisposition;
  candidate: ReflectionCandidate;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (record(value))
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function stableHexId(namespace: string, ...parts: string[]): string {
  return createHash('sha256')
    .update([namespace, ...parts].join(':'))
    .digest('hex')
    .slice(0, 32);
}

function reflectionDispositionId(): ReflectionDispositionId {
  return `reflection-disposition_${randomUUID().replaceAll('-', '')}`;
}

function profileId(
  workspaceId: string,
  subjectUserId: string,
  runtimeCapabilityDefinitionId: RuntimeCapabilityDefinitionId,
  runtimeCapabilityVersion: number
): CapabilityProfileProjectionId {
  return `capability-profile_${stableHexId(
    'private-profile',
    workspaceId,
    subjectUserId,
    runtimeCapabilityDefinitionId,
    String(runtimeCapabilityVersion)
  )}`;
}

function twinId(workspaceId: string, subjectUserId: string): CapabilityTwinProjectionId {
  return `capability-twin_${stableHexId('private-twin', workspaceId, subjectUserId)}`;
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new ReflectionDispositionProfileError('INVALID_INPUT', `${field} must be a string.`, 422);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new ReflectionDispositionProfileError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function optionalText(value: unknown, field: string, maximum = 1000): string | undefined {
  if (value === undefined || value === null) return undefined;
  return text(value, field, maximum);
}

function positive(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new ReflectionDispositionProfileError(
      'INVALID_INPUT',
      `${field} must be a positive integer.`,
      422
    );
  return Number(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const extras = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (extras.length)
    throw new ReflectionDispositionProfileError(
      'INVALID_INPUT',
      'Request contains unsupported fields. Workspace, subject identity and authority are derived from the authenticated Core Principal and cannot be supplied by callers.',
      422,
      false,
      { fields: extras }
    );
}

export function normalizeReflectionDispositionCommand(
  value: unknown
): ReflectionDispositionCommand {
  if (!record(value))
    throw new ReflectionDispositionProfileError(
      'INVALID_INPUT',
      'Request body must be an object.',
      422
    );
  exactKeys(value, [
    'candidateVersion',
    'expectedCandidateFingerprintSha256',
    'outcome',
    'rationale'
  ]);
  const expectedCandidateFingerprintSha256 = text(
    value.expectedCandidateFingerprintSha256,
    'expectedCandidateFingerprintSha256',
    64
  );
  if (!FINGERPRINT.test(expectedCandidateFingerprintSha256))
    throw new ReflectionDispositionProfileError(
      'INVALID_INPUT',
      'expectedCandidateFingerprintSha256 must be a lowercase SHA-256 value.',
      422
    );
  const outcome = text(value.outcome, 'outcome', 16) as ReflectionDispositionOutcome;
  if (!reflectionDispositionOutcomes.includes(outcome))
    throw new ReflectionDispositionProfileError(
      'INVALID_INPUT',
      'outcome must be ACCEPTED, REJECTED or DEFERRED.',
      422
    );
  const rationale = optionalText(value.rationale, 'rationale');
  return {
    candidateVersion: positive(value.candidateVersion, 'candidateVersion'),
    expectedCandidateFingerprintSha256,
    outcome,
    ...(rationale ? { rationale } : {})
  };
}

function candidateFromRow(row: Row | undefined): CandidateSnapshot | undefined {
  if (!row) return undefined;
  if (!record(row.document_json) || typeof row.candidate_fingerprint_sha256 !== 'string')
    throw new ReflectionDispositionProfileError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Reflection Candidate is invalid.',
      503,
      true
    );
  return {
    candidate: clone(row.document_json as unknown as ReflectionCandidate),
    fingerprintSha256: row.candidate_fingerprint_sha256
  };
}

function dispositionFromRow(row: Row | undefined): ReflectionDisposition | undefined {
  if (!row) return undefined;
  if (!record(row.document_json))
    throw new ReflectionDispositionProfileError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Reflection Disposition is invalid.',
      503,
      true
    );
  return clone(row.document_json as unknown as ReflectionDisposition);
}

function profileFromRow(row: Row | undefined): CapabilityProfileProjection | undefined {
  if (!row) return undefined;
  if (!record(row.document_json))
    throw new ReflectionDispositionProfileError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Capability Profile projection is invalid.',
      503,
      true
    );
  return clone(row.document_json as unknown as CapabilityProfileProjection);
}

function twinFromRow(row: Row | undefined): CapabilityTwinProjection | undefined {
  if (!row) return undefined;
  if (!record(row.document_json))
    throw new ReflectionDispositionProfileError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Capability Twin projection is invalid.',
      503,
      true
    );
  return clone(row.document_json as unknown as CapabilityTwinProjection);
}

function replayFromRow(row: Row): ReflectionDispositionProfileResult {
  const value = row.result_json;
  if (!record(value) || !record(value.disposition) || !record(value.profile) || !record(value.twin))
    throw new ReflectionDispositionProfileError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Reflection Disposition replay is invalid.',
      503,
      true
    );
  return {
    disposition: clone(value.disposition as unknown as ReflectionDisposition),
    profile: clone(value.profile as unknown as CapabilityProfileProjection),
    twin: clone(value.twin as unknown as CapabilityTwinProjection),
    replayed: true
  };
}

function sameDisposition(
  existing: ReflectionDisposition,
  outcome: ReflectionDispositionOutcome,
  rationale: string | undefined
): boolean {
  return existing.outcome === outcome && (existing.rationale ?? undefined) === rationale;
}

export class PostgresReflectionDispositionProfileService {
  constructor(
    private readonly database: ReflectionDispositionProfileTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly dispositionIdFactory: () => ReflectionDispositionId = reflectionDispositionId
  ) {}

  async disposition(
    principal: WorkspacePrincipal,
    candidateIdValue: unknown,
    body: unknown,
    idempotencyKeyValue: unknown
  ): Promise<ReflectionDispositionProfileResult> {
    const candidateIdText = text(candidateIdValue, 'reflectionCandidateId', 100);
    if (!CANDIDATE_ID.test(candidateIdText))
      throw new ReflectionDispositionProfileError(
        'INVALID_INPUT',
        'reflectionCandidateId must be an exact Reflection Candidate identity.',
        422
      );
    const candidateId = candidateIdText as ReflectionCandidateId;
    const command = normalizeReflectionDispositionCommand(body);
    const idempotencyKey = text(idempotencyKeyValue, 'Idempotency-Key', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId: principal.workspaceId,
      subjectUserId: principal.userId,
      candidateId,
      ...command
    });

    const earlyReplay = await this.query.query(
      'SELECT request_fingerprint_sha256,result_json FROM capability_reflection_disposition_commands WHERE idempotency_key=$1',
      [idempotencyKey]
    );
    if (earlyReplay.rowCount) {
      const row = earlyReplay.rows[0] as Row;
      if (row.request_fingerprint_sha256 !== requestFingerprintSha256)
        throw new ReflectionDispositionProfileError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used for a different Reflection Disposition request.'
        );
      return replayFromRow(row);
    }

    const initialCandidate = await this.findCandidate(candidateId, command.candidateVersion);
    if (!initialCandidate) this.notFound();
    this.assertSubject(principal, initialCandidate.candidate);

    return this.database.transact(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `reflection-disposition:${initialCandidate.candidate.workspaceId}:${initialCandidate.candidate.subjectUserId}:${initialCandidate.candidate.runtimeCapability.id}:${initialCandidate.candidate.runtimeCapability.version}`
      ]);

      const replay = await client.query(
        'SELECT request_fingerprint_sha256,result_json FROM capability_reflection_disposition_commands WHERE idempotency_key=$1',
        [idempotencyKey]
      );
      if (replay.rowCount) {
        const row = replay.rows[0] as Row;
        if (row.request_fingerprint_sha256 !== requestFingerprintSha256)
          throw new ReflectionDispositionProfileError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used for a different Reflection Disposition request.'
          );
        return replayFromRow(row);
      }

      const exactResult = await client.query(
        `SELECT document_json,candidate_fingerprint_sha256
         FROM capability_reflection_candidates
         WHERE reflection_candidate_id=$1 AND version=$2`,
        [candidateId, command.candidateVersion]
      );
      const exact = candidateFromRow(exactResult.rows[0] as Row | undefined);
      if (!exact) this.notFound();
      this.assertSubject(principal, exact.candidate);
      if (exact.fingerprintSha256 !== command.expectedCandidateFingerprintSha256)
        throw new ReflectionDispositionProfileError(
          'CANDIDATE_FINGERPRINT_MISMATCH',
          'Exact Reflection Candidate fingerprint does not match the expected current value.'
        );

      const currentResult = await client.query(
        `SELECT reflection_candidate_id,version,candidate_fingerprint_sha256,document_json
         FROM capability_reflection_candidates
         WHERE workspace_id=$1 AND subject_user_id=$2
           AND runtime_capability_definition_id=$3 AND runtime_capability_version=$4
         ORDER BY version DESC LIMIT 1`,
        [
          exact.candidate.workspaceId,
          exact.candidate.subjectUserId,
          exact.candidate.runtimeCapability.id,
          exact.candidate.runtimeCapability.version
        ]
      );
      const current = candidateFromRow(currentResult.rows[0] as Row | undefined);
      if (
        !current ||
        current.candidate.reflectionCandidateId !== exact.candidate.reflectionCandidateId ||
        current.candidate.version !== exact.candidate.version ||
        current.fingerprintSha256 !== exact.fingerprintSha256
      )
        throw new ReflectionDispositionProfileError(
          'STALE_CANDIDATE',
          'Reflection Candidate is no longer the current candidate for this private Capability learning line.'
        );

      const existingResult = await client.query(
        `SELECT document_json FROM capability_reflection_dispositions
         WHERE reflection_candidate_id=$1 AND candidate_version=$2`,
        [candidateId, command.candidateVersion]
      );
      const existing = dispositionFromRow(existingResult.rows[0] as Row | undefined);
      if (existing) {
        if (!sameDisposition(existing, command.outcome, command.rationale))
          throw new ReflectionDispositionProfileError(
            'CANDIDATE_ALREADY_DISPOSITIONED',
            'Reflection Candidate already has a different authoritative subject-user disposition.'
          );
        const profile = await this.rebuildProfile(
          client,
          exact.candidate.workspaceId,
          exact.candidate.subjectUserId,
          exact.candidate.runtimeCapability.id,
          exact.candidate.runtimeCapability.version
        );
        const twin = await this.rebuildTwin(
          client,
          exact.candidate.workspaceId,
          exact.candidate.subjectUserId
        );
        if (!profile || !twin)
          throw new ReflectionDispositionProfileError(
            'PERSISTENCE_UNAVAILABLE',
            'Private Capability projections could not be rebuilt.',
            503,
            true
          );
        const reused = { disposition: existing, profile, twin, replayed: true };
        await this.recordCommand(
          client,
          idempotencyKey,
          requestFingerprintSha256,
          reused,
          exact,
          new Date(this.now()).toISOString()
        );
        return clone(reused);
      }

      const decidedAt = new Date(this.now()).toISOString();
      const disposition: ReflectionDisposition = {
        schemaVersion: 1,
        reflectionDispositionId: this.dispositionIdFactory(),
        workspaceId: exact.candidate.workspaceId,
        subjectUserId: exact.candidate.subjectUserId,
        candidate: {
          id: exact.candidate.reflectionCandidateId,
          version: exact.candidate.version,
          fingerprintSha256: exact.fingerprintSha256
        },
        outcome: command.outcome,
        decidedBySubjectUserId: principal.userId,
        ...(command.rationale ? { rationale: command.rationale } : {}),
        decidedAt,
        authority: capabilityLearningNoAuthorityConsequences
      };
      await client.query(
        `INSERT INTO capability_reflection_dispositions (
           reflection_disposition_id,reflection_candidate_id,candidate_version,
           candidate_fingerprint_sha256,workspace_id,subject_user_id,outcome,rationale,
           decided_by_subject_user_id,document_json,decided_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [
          disposition.reflectionDispositionId,
          disposition.candidate.id,
          disposition.candidate.version,
          disposition.candidate.fingerprintSha256,
          disposition.workspaceId,
          disposition.subjectUserId,
          disposition.outcome,
          disposition.rationale ?? null,
          disposition.decidedBySubjectUserId,
          JSON.stringify(disposition),
          disposition.decidedAt
        ]
      );

      const profile = await this.rebuildProfile(
        client,
        exact.candidate.workspaceId,
        exact.candidate.subjectUserId,
        exact.candidate.runtimeCapability.id,
        exact.candidate.runtimeCapability.version
      );
      const twin = await this.rebuildTwin(
        client,
        exact.candidate.workspaceId,
        exact.candidate.subjectUserId
      );
      if (!profile || !twin)
        throw new ReflectionDispositionProfileError(
          'PERSISTENCE_UNAVAILABLE',
          'Private Capability projections could not be rebuilt.',
          503,
          true
        );
      const result = { disposition, profile, twin, replayed: false };
      await this.recordCommand(
        client,
        idempotencyKey,
        requestFingerprintSha256,
        result,
        exact,
        decidedAt
      );
      return clone(result);
    });
  }

  async getProfile(
    principal: WorkspacePrincipal,
    runtimeCapabilityDefinitionId: RuntimeCapabilityDefinitionId,
    runtimeCapabilityVersion: number
  ): Promise<Readonly<CapabilityProfileProjection> | undefined> {
    return this.database.transact(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `capability-profile:${principal.workspaceId}:${principal.userId}:${runtimeCapabilityDefinitionId}:${runtimeCapabilityVersion}`
      ]);
      return this.rebuildProfile(
        client,
        principal.workspaceId,
        principal.userId,
        runtimeCapabilityDefinitionId,
        runtimeCapabilityVersion
      );
    });
  }

  async listProfiles(
    principal: WorkspacePrincipal
  ): Promise<ReadonlyArray<Readonly<CapabilityProfileProjection>>> {
    return this.database.transact(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `capability-profiles:${principal.workspaceId}:${principal.userId}`
      ]);
      await this.rebuildAllProfiles(client, principal.workspaceId, principal.userId);
      const result = await client.query(
        `SELECT DISTINCT ON (runtime_capability_definition_id,runtime_capability_version) document_json
         FROM capability_profile_projections
         WHERE workspace_id=$1 AND subject_user_id=$2
         ORDER BY runtime_capability_definition_id,runtime_capability_version,version DESC`,
        [principal.workspaceId, principal.userId]
      );
      return (result.rows as Row[])
        .map((row) => profileFromRow(row))
        .filter((profile): profile is CapabilityProfileProjection => Boolean(profile))
        .sort((left, right) =>
          `${left.runtimeCapability.id}:${left.runtimeCapability.version}`.localeCompare(
            `${right.runtimeCapability.id}:${right.runtimeCapability.version}`
          )
        );
    });
  }

  async getTwin(
    principal: WorkspacePrincipal
  ): Promise<Readonly<CapabilityTwinProjection> | undefined> {
    return this.database.transact(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `capability-twin:${principal.workspaceId}:${principal.userId}`
      ]);
      await this.rebuildAllProfiles(client, principal.workspaceId, principal.userId);
      return this.rebuildTwin(client, principal.workspaceId, principal.userId);
    });
  }

  private async findCandidate(
    candidateId: ReflectionCandidateId,
    candidateVersion: number
  ): Promise<CandidateSnapshot | undefined> {
    try {
      const result = await this.query.query(
        `SELECT document_json,candidate_fingerprint_sha256
         FROM capability_reflection_candidates
         WHERE reflection_candidate_id=$1 AND version=$2`,
        [candidateId, candidateVersion]
      );
      return candidateFromRow(result.rows[0] as Row | undefined);
    } catch (error) {
      if (error instanceof ReflectionDispositionProfileError) throw error;
      throw new ReflectionDispositionProfileError(
        'PERSISTENCE_UNAVAILABLE',
        'Reflection Candidate persistence is unavailable.',
        503,
        true,
        undefined,
        { cause: error }
      );
    }
  }

  private assertSubject(principal: WorkspacePrincipal, candidate: ReflectionCandidate): void {
    if (
      principal.workspaceId !== candidate.workspaceId ||
      principal.userId !== candidate.subjectUserId
    )
      this.notFound();
  }

  private notFound(): never {
    throw new ReflectionDispositionProfileError(
      'CANDIDATE_NOT_FOUND',
      'Reflection Candidate was not found for this authenticated subject.',
      404
    );
  }

  private async rebuildAllProfiles(
    client: QueryClient,
    workspaceId: string,
    subjectUserId: string
  ): Promise<void> {
    const result = await client.query(
      `SELECT DISTINCT runtime_capability_definition_id,runtime_capability_version
       FROM capability_ledger_entries
       WHERE workspace_id=$1 AND subject_user_id=$2
       UNION
       SELECT DISTINCT runtime_capability_definition_id,runtime_capability_version
       FROM capability_reflection_candidates
       WHERE workspace_id=$1 AND subject_user_id=$2`,
      [workspaceId, subjectUserId]
    );
    for (const row of result.rows as Row[]) {
      if (
        typeof row.runtime_capability_definition_id !== 'string' ||
        !Number.isInteger(Number(row.runtime_capability_version))
      )
        continue;
      await this.rebuildProfile(
        client,
        workspaceId,
        subjectUserId,
        row.runtime_capability_definition_id as RuntimeCapabilityDefinitionId,
        Number(row.runtime_capability_version)
      );
    }
  }

  private async rebuildProfile(
    client: QueryClient,
    workspaceId: string,
    subjectUserId: string,
    runtimeCapabilityDefinitionId: RuntimeCapabilityDefinitionId,
    runtimeCapabilityVersion: number
  ): Promise<CapabilityProfileProjection | undefined> {
    const [ledgerResult, candidateResult, dispositionResult] = await Promise.all([
      client.query(
        `SELECT document_json FROM capability_ledger_entries
         WHERE workspace_id=$1 AND subject_user_id=$2
           AND runtime_capability_definition_id=$3 AND runtime_capability_version=$4
         ORDER BY recorded_at,capability_ledger_entry_id`,
        [workspaceId, subjectUserId, runtimeCapabilityDefinitionId, runtimeCapabilityVersion]
      ),
      client.query(
        `SELECT reflection_candidate_id,version,candidate_fingerprint_sha256,document_json
         FROM capability_reflection_candidates
         WHERE workspace_id=$1 AND subject_user_id=$2
           AND runtime_capability_definition_id=$3 AND runtime_capability_version=$4
         ORDER BY version,reflection_candidate_id`,
        [workspaceId, subjectUserId, runtimeCapabilityDefinitionId, runtimeCapabilityVersion]
      ),
      client.query(
        `SELECT d.document_json disposition_json,c.document_json candidate_json
         FROM capability_reflection_dispositions d
         JOIN capability_reflection_candidates c
           ON c.reflection_candidate_id=d.reflection_candidate_id
          AND c.version=d.candidate_version
         WHERE d.workspace_id=$1 AND d.subject_user_id=$2
           AND c.runtime_capability_definition_id=$3 AND c.runtime_capability_version=$4
         ORDER BY d.decided_at,d.reflection_disposition_id`,
        [workspaceId, subjectUserId, runtimeCapabilityDefinitionId, runtimeCapabilityVersion]
      )
    ]);
    if (!ledgerResult.rowCount && !candidateResult.rowCount) return undefined;

    const ledgerEntries = (ledgerResult.rows as Row[]).map((row) => {
      if (!record(row.document_json))
        throw new ReflectionDispositionProfileError(
          'PERSISTENCE_UNAVAILABLE',
          'Persisted Capability Ledger Entry is invalid.',
          503,
          true
        );
      return clone(row.document_json as unknown as CapabilityLedgerEntry);
    });
    const candidates = (candidateResult.rows as Row[]).map((row) => {
      const candidate = candidateFromRow(row);
      if (!candidate)
        throw new ReflectionDispositionProfileError(
          'PERSISTENCE_UNAVAILABLE',
          'Persisted Reflection Candidate is invalid.',
          503,
          true
        );
      return candidate;
    });
    const dispositions: DispositionWithCandidate[] = (dispositionResult.rows as Row[]).map(
      (row) => {
        if (!record(row.disposition_json) || !record(row.candidate_json))
          throw new ReflectionDispositionProfileError(
            'PERSISTENCE_UNAVAILABLE',
            'Persisted Reflection Disposition projection source is invalid.',
            503,
            true
          );
        return {
          disposition: clone(row.disposition_json as unknown as ReflectionDisposition),
          candidate: clone(row.candidate_json as unknown as ReflectionCandidate)
        };
      }
    );

    const acceptedReflections = dispositions
      .filter(({ disposition }) => disposition.outcome === 'ACCEPTED')
      .map(({ disposition, candidate }) => ({
        candidateId: candidate.reflectionCandidateId,
        candidateVersion: candidate.version,
        dispositionId: disposition.reflectionDispositionId,
        acceptedAt: disposition.decidedAt,
        text: candidate.proposedPrivateReflection
      }));
    const latestCandidate = candidates.at(-1)?.candidate;
    const latestDisposition = latestCandidate
      ? dispositions.find(
          ({ disposition }) =>
            disposition.candidate.id === latestCandidate.reflectionCandidateId &&
            disposition.candidate.version === latestCandidate.version
        )?.disposition
      : undefined;
    const outstandingReflectionCandidate =
      latestCandidate && (!latestDisposition || latestDisposition.outcome === 'DEFERRED')
        ? { id: latestCandidate.reflectionCandidateId, version: latestCandidate.version }
        : undefined;
    const latestEvidenceAt = ledgerEntries.at(-1)?.recordedAt;
    const stateFingerprintSha256 = fingerprint({
      runtimeCapability: {
        id: runtimeCapabilityDefinitionId,
        version: runtimeCapabilityVersion
      },
      ledgerEntries: ledgerEntries.map((entry) => ({
        id: entry.capabilityLedgerEntryId,
        sourceFingerprintSha256: entry.observation.sourceFingerprintSha256,
        recordedAt: entry.recordedAt
      })),
      dispositions: dispositions.map(({ disposition }) => disposition),
      outstandingReflectionCandidate
    });
    const latestProjectionResult = await client.query(
      `SELECT version,state_fingerprint_sha256,document_json
       FROM capability_profile_projections
       WHERE workspace_id=$1 AND subject_user_id=$2
         AND runtime_capability_definition_id=$3 AND runtime_capability_version=$4
       ORDER BY version DESC LIMIT 1`,
      [workspaceId, subjectUserId, runtimeCapabilityDefinitionId, runtimeCapabilityVersion]
    );
    const latestProjectionRow = latestProjectionResult.rows[0] as Row | undefined;
    if (latestProjectionRow?.state_fingerprint_sha256 === stateFingerprintSha256) {
      const existing = profileFromRow(latestProjectionRow);
      if (existing) return existing;
    }

    const version = Number(latestProjectionRow?.version ?? 0) + 1;
    const generatedAt = new Date(this.now()).toISOString();
    const profile: CapabilityProfileProjection = {
      schemaVersion: 1,
      capabilityProfileProjectionId: profileId(
        workspaceId,
        subjectUserId,
        runtimeCapabilityDefinitionId,
        runtimeCapabilityVersion
      ),
      workspaceId,
      subjectUserId,
      version,
      runtimeCapability: {
        id: runtimeCapabilityDefinitionId,
        version: runtimeCapabilityVersion
      },
      evidenceCount: ledgerEntries.length,
      ...(latestEvidenceAt ? { latestEvidenceAt } : {}),
      acceptedReflections,
      ...(outstandingReflectionCandidate ? { outstandingReflectionCandidate } : {}),
      visibility: 'PRIVATE',
      numericProfessionalScore: null,
      verifiedBadge: false,
      generatedAt,
      authority: capabilityLearningNoAuthorityConsequences
    };
    await client.query(
      `INSERT INTO capability_profile_projections (
         capability_profile_projection_id,workspace_id,subject_user_id,version,
         runtime_capability_definition_id,runtime_capability_version,state_fingerprint_sha256,
         document_json,generated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
      [
        profile.capabilityProfileProjectionId,
        workspaceId,
        subjectUserId,
        version,
        runtimeCapabilityDefinitionId,
        runtimeCapabilityVersion,
        stateFingerprintSha256,
        JSON.stringify(profile),
        generatedAt
      ]
    );
    return profile;
  }

  private async rebuildTwin(
    client: QueryClient,
    workspaceId: string,
    subjectUserId: string
  ): Promise<CapabilityTwinProjection | undefined> {
    const profilesResult = await client.query(
      `SELECT DISTINCT ON (runtime_capability_definition_id,runtime_capability_version)
         runtime_capability_definition_id,runtime_capability_version,version,document_json
       FROM capability_profile_projections
       WHERE workspace_id=$1 AND subject_user_id=$2
       ORDER BY runtime_capability_definition_id,runtime_capability_version,version DESC`,
      [workspaceId, subjectUserId]
    );
    const profiles = (profilesResult.rows as Row[])
      .map((row) => profileFromRow(row))
      .filter((profile): profile is CapabilityProfileProjection => Boolean(profile))
      .sort((left, right) =>
        `${left.runtimeCapability.id}:${left.runtimeCapability.version}`.localeCompare(
          `${right.runtimeCapability.id}:${right.runtimeCapability.version}`
        )
      );
    if (!profiles.length) return undefined;

    const capabilitySummaries = profiles.map((profile) => {
      const latestAccepted = profile.acceptedReflections.at(-1);
      return {
        runtimeCapabilityDefinitionId: profile.runtimeCapability.id,
        runtimeCapabilityVersion: profile.runtimeCapability.version,
        evidenceCount: profile.evidenceCount,
        ...(profile.latestEvidenceAt ? { latestEvidenceAt: profile.latestEvidenceAt } : {}),
        ...(latestAccepted ? { acceptedPrivateReflection: latestAccepted.text } : {})
      };
    });
    const stateFingerprintSha256 = fingerprint({
      profiles: profiles.map((profile) => ({
        id: profile.capabilityProfileProjectionId,
        version: profile.version
      })),
      capabilitySummaries
    });
    const latestTwinResult = await client.query(
      `SELECT version,state_fingerprint_sha256,document_json
       FROM capability_twin_projections
       WHERE workspace_id=$1 AND subject_user_id=$2
       ORDER BY version DESC LIMIT 1`,
      [workspaceId, subjectUserId]
    );
    const latestTwinRow = latestTwinResult.rows[0] as Row | undefined;
    if (latestTwinRow?.state_fingerprint_sha256 === stateFingerprintSha256) {
      const existing = twinFromRow(latestTwinRow);
      if (existing) return existing;
    }

    const version = Number(latestTwinRow?.version ?? 0) + 1;
    const generatedAt = new Date(this.now()).toISOString();
    const anchorProfile = profiles[0]!;
    const twin: CapabilityTwinProjection = {
      schemaVersion: 1,
      capabilityTwinProjectionId: twinId(workspaceId, subjectUserId),
      workspaceId,
      subjectUserId,
      version,
      profile: {
        id: anchorProfile.capabilityProfileProjectionId,
        version: anchorProfile.version
      },
      capabilitySummaries,
      visibility: 'PRIVATE',
      autonomousIdentity: false,
      autonomousExecutionAuthority: false,
      generatedAt,
      authority: capabilityLearningNoAuthorityConsequences
    };
    await client.query(
      `INSERT INTO capability_twin_projections (
         capability_twin_projection_id,workspace_id,subject_user_id,version,
         state_fingerprint_sha256,document_json,generated_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [
        twin.capabilityTwinProjectionId,
        workspaceId,
        subjectUserId,
        version,
        stateFingerprintSha256,
        JSON.stringify(twin),
        generatedAt
      ]
    );
    return twin;
  }

  private async recordCommand(
    client: QueryClient,
    idempotencyKey: string,
    requestFingerprintSha256: string,
    result: ReflectionDispositionProfileResult,
    candidate: CandidateSnapshot,
    createdAt: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO capability_reflection_disposition_commands (
         idempotency_key,request_fingerprint_sha256,reflection_disposition_id,result_json,created_at
       ) VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [
        idempotencyKey,
        requestFingerprintSha256,
        result.disposition.reflectionDispositionId,
        JSON.stringify(result),
        createdAt
      ]
    );
    await client.query(
      `INSERT INTO capability_reflection_disposition_audit (
         idempotency_key,request_fingerprint_sha256,reflection_disposition_id,
         reflection_candidate_id,candidate_version,candidate_fingerprint_sha256,
         workspace_id,subject_user_id,outcome,decision,created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SUBJECT_DISPOSITION_RECORDED_OR_REUSED',$10)`,
      [
        idempotencyKey,
        requestFingerprintSha256,
        result.disposition.reflectionDispositionId,
        candidate.candidate.reflectionCandidateId,
        candidate.candidate.version,
        candidate.fingerprintSha256,
        candidate.candidate.workspaceId,
        candidate.candidate.subjectUserId,
        result.disposition.outcome,
        createdAt
      ]
    );
  }
}
