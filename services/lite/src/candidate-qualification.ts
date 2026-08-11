import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import {
  opportunityQualificationOutcomes,
  productLoopSourceKinds,
  productLoopSourceOwners,
  type OpportunityCandidate,
  type OpportunityCandidateId,
  type OpportunityQualificationDecision,
  type OpportunityQualificationDecisionId,
  type OpportunityQualificationOutcome,
  type ProductLoopSourceReference
} from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';
import type {
  LiteTransactionHost,
  ProductLoopSourceAuthority,
  ProductLoopSourceLocator
} from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const MARKORBIT_ID = /^[^_\s]+_.+$/;

export type LiteCandidateQualificationErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'STALE_SOURCE'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'PERMISSION_DENIED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'PERSISTENCE_UNAVAILABLE';

export class LiteCandidateQualificationError extends Error {
  constructor(
    readonly code: LiteCandidateQualificationErrorCode,
    message: string,
    readonly status = 409,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'LiteCandidateQualificationError';
  }
}

/**
 * Customer truth remains outside Lite. This boundary only proves that an
 * existing customer relationship is accessible inside the requested Workspace.
 */
export interface ProductLoopCustomerRelationshipAuthority {
  isAccessible(workspaceId: string, customerId: MarkOrbitId): Promise<boolean>;
}

export interface CreateOpportunityCandidateCommand {
  workspaceId: string;
  customerId?: MarkOrbitId;
  title: string;
  serviceNeedSummary: string;
  sources: ReadonlyArray<Readonly<ProductLoopSourceLocator>>;
  idempotencyKey: string;
}

export interface RecordOpportunityQualificationCommand {
  workspaceId: string;
  candidate: Readonly<{ id: OpportunityCandidateId; version: number }>;
  expectedCandidateFingerprintSha256: string;
  outcome: OpportunityQualificationOutcome;
  decidedByPrincipalId: string;
  rationale: string;
  idempotencyKey: string;
}

export interface OpportunityQualificationDisposition {
  decision: OpportunityQualificationDecision;
  currentCandidate: OpportunityCandidate;
}

type Row = Record<string, unknown>;
type CommandType = 'CREATE_OPPORTUNITY_CANDIDATE' | 'RECORD_OPPORTUNITY_QUALIFICATION';

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new LiteCandidateQualificationError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned)
    throw new LiteCandidateQualificationError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new LiteCandidateQualificationError(
      'INVALID_INPUT',
      `${field} exceeds the allowed length.`,
      422
    );
  return cleaned;
}

function cleanIdempotencyKey(value: string): string {
  return cleanText(value, 'idempotencyKey', 300);
}

function cleanMarkOrbitId(value: MarkOrbitId, field: string): MarkOrbitId {
  const cleaned = value.trim() as MarkOrbitId;
  if (!MARKORBIT_ID.test(cleaned))
    throw new LiteCandidateQualificationError('INVALID_INPUT', `${field} is invalid.`, 422);
  return cleaned;
}

function cleanPrincipalId(value: string, field: string): string {
  return cleanText(value, field, 300);
}

function exactVersion(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1)
    throw new LiteCandidateQualificationError(
      'INVALID_INPUT',
      `${field} must be a positive integer.`,
      422
    );
  return value;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!SHA256.test(cleaned))
    throw new LiteCandidateQualificationError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new LiteCandidateQualificationError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return parsed.toISOString();
}

function nextId<T extends string>(prefix: string): T {
  return `${prefix}_${randomUUID().replaceAll('-', '')}` as T;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function rowDocument<T>(row: Row | undefined, field = 'document_json'): T | undefined {
  return row ? clone(row[field] as T) : undefined;
}

function candidateWithFingerprint(
  value: Omit<OpportunityCandidate, 'opportunityCandidateFingerprintSha256'>
): OpportunityCandidate {
  return { ...value, opportunityCandidateFingerprintSha256: fingerprint(value) };
}

function normalizeSource(
  locator: Readonly<ProductLoopSourceLocator>,
  value: Readonly<ProductLoopSourceReference>
): ProductLoopSourceReference {
  if (
    !productLoopSourceOwners.includes(value.owner) ||
    !productLoopSourceKinds.includes(value.kind)
  )
    throw new LiteCandidateQualificationError(
      'STALE_SOURCE',
      'The source authority returned an unsupported Product-loop source.'
    );
  if (
    value.owner !== locator.owner ||
    value.kind !== locator.kind ||
    value.sourceId !== locator.sourceId
  )
    throw new LiteCandidateQualificationError(
      'STALE_SOURCE',
      'The source authority returned a different source than requested.'
    );
  const sourceId = cleanText(value.sourceId, 'sourceId', 500);
  const sourceVersion =
    typeof value.sourceVersion === 'number'
      ? exactVersion(value.sourceVersion, 'sourceVersion')
      : cleanText(String(value.sourceVersion), 'sourceVersion', 300);
  return {
    schemaVersion: 1,
    owner: value.owner,
    kind: value.kind,
    sourceId,
    sourceVersion,
    sourceFingerprintSha256: exactSha256(value.sourceFingerprintSha256, 'sourceFingerprintSha256'),
    observedAt: exactTimestamp(value.observedAt, 'observedAt'),
    ...(value.correlationId
      ? { correlationId: cleanMarkOrbitId(value.correlationId, 'correlationId') }
      : {})
  };
}

function sourceKey(source: Readonly<ProductLoopSourceReference>): string {
  return [source.owner, source.kind, source.sourceId, String(source.sourceVersion)].join(':');
}

function normalizedLocator(locator: Readonly<ProductLoopSourceLocator>): ProductLoopSourceLocator {
  const owner = locator.owner;
  const kind = locator.kind;
  if (!productLoopSourceOwners.includes(owner) || !productLoopSourceKinds.includes(kind))
    throw new LiteCandidateQualificationError(
      'INVALID_INPUT',
      'Product-loop source locator is unsupported.',
      422
    );
  return {
    owner,
    kind,
    sourceId: cleanText(locator.sourceId, 'sourceId', 500)
  };
}

export class PostgresLiteCandidateQualificationStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly sourceAuthority: ProductLoopSourceAuthority,
    private readonly customerAuthority: ProductLoopCustomerRelationshipAuthority,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly ids: Readonly<{
      candidate: () => OpportunityCandidateId;
      qualification: () => OpportunityQualificationDecisionId;
    }> = {
      candidate: () => nextId<OpportunityCandidateId>('opportunity-candidate'),
      qualification: () => nextId<OpportunityQualificationDecisionId>('opportunity-qualification')
    }
  ) {}

  async createCandidate(
    command: Readonly<CreateOpportunityCandidateCommand>
  ): Promise<OpportunityCandidate> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const customerId = command.customerId
      ? cleanMarkOrbitId(command.customerId, 'customerId')
      : undefined;
    const title = cleanText(command.title, 'title', 500);
    const serviceNeedSummary = cleanText(command.serviceNeedSummary, 'serviceNeedSummary', 4000);
    const idempotencyKey = cleanIdempotencyKey(command.idempotencyKey);
    if (!command.sources.length || command.sources.length > 8)
      throw new LiteCandidateQualificationError(
        'INVALID_INPUT',
        'An Opportunity Candidate requires between one and eight exact sources.',
        422
      );

    await this.assertCustomerAccessible(workspaceId, customerId);
    const sources = (
      await Promise.all(
        command.sources.map(async (locatorValue) => {
          const locator = normalizedLocator(locatorValue);
          let resolved: Readonly<ProductLoopSourceReference>;
          try {
            resolved = await this.sourceAuthority.resolve(workspaceId, locator);
          } catch (error) {
            if (error instanceof LiteCandidateQualificationError) throw error;
            throw new LiteCandidateQualificationError(
              'DEPENDENCY_UNAVAILABLE',
              'Product-loop source authority is unavailable.',
              503,
              undefined,
              { cause: error }
            );
          }
          return normalizeSource(locator, resolved);
        })
      )
    ).sort((left, right) => sourceKey(left).localeCompare(sourceKey(right)));
    if (new Set(sources.map(sourceKey)).size !== sources.length)
      throw new LiteCandidateQualificationError(
        'INVALID_INPUT',
        'Opportunity Candidate sources must be unique.',
        422
      );

    const requestFingerprint = fingerprint({
      workspaceId,
      customerId,
      title,
      serviceNeedSummary,
      sources
    });
    const createdAt = exactTimestamp(this.now(), 'now');
    const candidate = candidateWithFingerprint({
      schemaVersion: 1,
      opportunityCandidateId: this.ids.candidate(),
      workspaceId,
      version: 1,
      kind: 'TRADEMARK_SERVICE',
      ...(customerId ? { customerId } : {}),
      title,
      serviceNeedSummary,
      sources,
      status: 'OPEN',
      formalOpportunityCreated: false,
      customerContacted: false,
      createdAt,
      updatedAt: createdAt
    });

    return this.command<OpportunityCandidate>(
      workspaceId,
      idempotencyKey,
      'CREATE_OPPORTUNITY_CANDIDATE',
      requestFingerprint,
      async (client) => {
        await this.insertCandidate(client, candidate);
        return candidate;
      }
    );
  }

  async recordQualification(
    command: Readonly<RecordOpportunityQualificationCommand>
  ): Promise<OpportunityQualificationDisposition> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const candidateId = cleanText(
      command.candidate.id,
      'candidate.id',
      300
    ) as OpportunityCandidateId;
    const candidateVersion = exactVersion(command.candidate.version, 'candidate.version');
    const expectedFingerprint = exactSha256(
      command.expectedCandidateFingerprintSha256,
      'expectedCandidateFingerprintSha256'
    );
    if (!opportunityQualificationOutcomes.includes(command.outcome))
      throw new LiteCandidateQualificationError(
        'INVALID_INPUT',
        'Qualification outcome is invalid.',
        422
      );
    const decidedByPrincipalId = cleanPrincipalId(
      command.decidedByPrincipalId,
      'decidedByPrincipalId'
    );
    const rationale = cleanText(command.rationale, 'rationale', 4000);
    const idempotencyKey = cleanIdempotencyKey(command.idempotencyKey);
    const requestFingerprint = fingerprint({
      workspaceId,
      candidateId,
      candidateVersion,
      expectedFingerprint,
      outcome: command.outcome,
      decidedByPrincipalId,
      rationale
    });

    return this.command<OpportunityQualificationDisposition>(
      workspaceId,
      idempotencyKey,
      'RECORD_OPPORTUNITY_QUALIFICATION',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:${candidateId}:qualification`);
        const candidate = await this.latestCandidate(client, workspaceId, candidateId);
        if (candidate.version !== candidateVersion)
          throw new LiteCandidateQualificationError(
            'VERSION_CONFLICT',
            `Opportunity Candidate is at version ${candidate.version}, not ${candidateVersion}.`
          );
        if (candidate.opportunityCandidateFingerprintSha256 !== expectedFingerprint)
          throw new LiteCandidateQualificationError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Opportunity Candidate fingerprint no longer matches the qualification request.'
          );
        if (candidate.status !== 'OPEN' && candidate.status !== 'UNDER_REVIEW')
          throw new LiteCandidateQualificationError(
            'INVALID_TRANSITION',
            'Only an open or under-review Opportunity Candidate can be dispositioned.'
          );

        const existing = await client.query(
          'SELECT 1 FROM lite_opportunity_qualification_decisions WHERE workspace_id=$1 AND opportunity_candidate_id=$2 LIMIT 1',
          [workspaceId, candidateId]
        );
        if (existing.rowCount)
          throw new LiteCandidateQualificationError(
            'VERSION_CONFLICT',
            'This Opportunity Candidate already has a Qualification Decision.'
          );

        const decidedAt = exactTimestamp(this.now(), 'now');
        const decision: OpportunityQualificationDecision = {
          schemaVersion: 1,
          opportunityQualificationDecisionId: this.ids.qualification(),
          workspaceId,
          version: 1,
          candidate: { id: candidateId, version: candidate.version },
          expectedCandidateFingerprintSha256: expectedFingerprint,
          outcome: command.outcome,
          decidedByPrincipalId,
          rationale,
          decidedAt,
          formalOpportunityCreated: false,
          customerContacted: false
        };
        const currentCandidate = candidateWithFingerprint({
          schemaVersion: 1,
          opportunityCandidateId: candidate.opportunityCandidateId,
          workspaceId,
          version: candidate.version + 1,
          kind: 'TRADEMARK_SERVICE',
          ...(candidate.customerId ? { customerId: candidate.customerId } : {}),
          title: candidate.title,
          serviceNeedSummary: candidate.serviceNeedSummary,
          sources: candidate.sources,
          status: 'DISPOSITIONED',
          formalOpportunityCreated: false,
          customerContacted: false,
          createdAt: candidate.createdAt,
          updatedAt: decidedAt
        });

        await client.query(
          'INSERT INTO lite_opportunity_qualification_decisions (workspace_id,opportunity_qualification_decision_id,version,opportunity_candidate_id,opportunity_candidate_version,outcome,decided_by_principal_id,expected_candidate_fingerprint_sha256,document_json,decided_at) VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8::jsonb,$9)',
          [
            workspaceId,
            decision.opportunityQualificationDecisionId,
            candidateId,
            candidate.version,
            decision.outcome,
            decidedByPrincipalId,
            expectedFingerprint,
            JSON.stringify(decision),
            decidedAt
          ]
        );
        await this.insertCandidate(client, currentCandidate);
        return { decision, currentCandidate };
      }
    );
  }

  async findCandidate(
    workspaceIdValue: string,
    candidateId: OpportunityCandidateId,
    version: number
  ): Promise<OpportunityCandidate | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_opportunity_candidates WHERE workspace_id=$1 AND opportunity_candidate_id=$2 AND version=$3',
      [workspaceId, candidateId, exactVersion(version, 'version')]
    );
    return rowDocument<OpportunityCandidate>(result.rows[0] as Row | undefined);
  }

  async findLatestCandidate(
    workspaceIdValue: string,
    candidateId: OpportunityCandidateId
  ): Promise<OpportunityCandidate | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_opportunity_candidates WHERE workspace_id=$1 AND opportunity_candidate_id=$2 ORDER BY version DESC LIMIT 1',
      [workspaceId, candidateId]
    );
    return rowDocument<OpportunityCandidate>(result.rows[0] as Row | undefined);
  }

  async findQualificationDecision(
    workspaceIdValue: string,
    candidateId: OpportunityCandidateId
  ): Promise<OpportunityQualificationDecision | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_opportunity_qualification_decisions WHERE workspace_id=$1 AND opportunity_candidate_id=$2 LIMIT 1',
      [workspaceId, candidateId]
    );
    return rowDocument<OpportunityQualificationDecision>(result.rows[0] as Row | undefined);
  }

  private async assertCustomerAccessible(
    workspaceId: string,
    customerId: MarkOrbitId | undefined
  ): Promise<void> {
    if (!customerId) return;
    try {
      if (await this.customerAuthority.isAccessible(workspaceId, customerId)) return;
    } catch (error) {
      throw new LiteCandidateQualificationError(
        'DEPENDENCY_UNAVAILABLE',
        'Customer relationship authority is unavailable.',
        503,
        undefined,
        { cause: error }
      );
    }
    throw new LiteCandidateQualificationError(
      'PERMISSION_DENIED',
      'Customer is not accessible in this Workspace.',
      403
    );
  }

  private async command<T>(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(client, `${workspaceId}:candidate-idempotency:${idempotencyKey}`);
        const replay = await client.query(
          'SELECT command_type,request_fingerprint_sha256,result_json FROM lite_candidate_qualification_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new LiteCandidateQualificationError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different candidate/qualification command.'
            );
          return rowDocument<T>(prior, 'result_json') as T;
        }
        const result = await write(client);
        await client.query(
          'INSERT INTO lite_candidate_qualification_commands (workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
          [
            workspaceId,
            idempotencyKey,
            commandType,
            requestFingerprint,
            JSON.stringify(result),
            exactTimestamp(this.now(), 'now')
          ]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof LiteCandidateQualificationError) throw error;
      throw new LiteCandidateQualificationError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Opportunity Candidate persistence is unavailable.',
        503,
        undefined,
        { cause: error }
      );
    }
  }

  private async resourceLock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }

  private async latestCandidate(
    client: QueryClient,
    workspaceId: string,
    candidateId: OpportunityCandidateId
  ): Promise<OpportunityCandidate> {
    const result = await client.query(
      'SELECT document_json FROM lite_opportunity_candidates WHERE workspace_id=$1 AND opportunity_candidate_id=$2 ORDER BY version DESC LIMIT 1',
      [workspaceId, candidateId]
    );
    const candidate = rowDocument<OpportunityCandidate>(result.rows[0] as Row | undefined);
    if (!candidate)
      throw new LiteCandidateQualificationError(
        'NOT_FOUND',
        'Opportunity Candidate was not found.',
        404
      );
    return candidate;
  }

  private async insertCandidate(
    client: QueryClient,
    candidate: OpportunityCandidate
  ): Promise<void> {
    await client.query(
      'INSERT INTO lite_opportunity_candidates (workspace_id,opportunity_candidate_id,version,customer_id,status,opportunity_candidate_fingerprint_sha256,document_json,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)',
      [
        candidate.workspaceId,
        candidate.opportunityCandidateId,
        candidate.version,
        candidate.customerId ?? null,
        candidate.status,
        candidate.opportunityCandidateFingerprintSha256,
        JSON.stringify(candidate),
        candidate.createdAt,
        candidate.updatedAt
      ]
    );
  }
}
