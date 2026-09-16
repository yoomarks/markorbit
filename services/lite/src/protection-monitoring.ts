import { createHash, randomUUID } from 'node:crypto';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  DataEngineApplicantCandidateReferenceV1,
  DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import {
  noProtectionMonitoringAuthorityConsequencesV1,
  protectionMonitoringFingerprintSha256V1,
  protectionMonitoringDispositionsV1,
  type ProtectionMonitoringCandidateIdV1,
  type ProtectionMonitoringCandidateV1,
  type ProtectionMonitoringDecisionIdV1,
  type ProtectionMonitoringDecisionV1,
  type ProtectionMonitoringDispositionV1
} from '@markorbit/contracts/protection-monitoring';
import type {
  OpportunityCandidate,
  ProductLoopSourceReference
} from '@markorbit/contracts/product-loop';
import type {
  TrademarkAsset,
  TrademarkAssetId
} from '@markorbit/contracts/trademark-asset-workspace';
import type {
  WorkspaceWatchTargetId,
  WorkspaceWatchTargetV1
} from '@markorbit/contracts/workspace-watch';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';
import type { CreateVerifiedOpportunityCandidateCommand } from './candidate-qualification.js';
import {
  DiscoveredTrademarkAdmissionError,
  type ExactDiscoveredTrademarkReader
} from './discovered-trademark-admission.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

export type ProtectionMonitoringErrorCode =
  | 'INVALID_INPUT'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'SOURCE_NOT_CURRENT'
  | 'NOT_RELEVANT'
  | 'CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'PERSISTENCE_UNAVAILABLE';

export class ProtectionMonitoringError extends Error {
  constructor(
    readonly code: ProtectionMonitoringErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProtectionMonitoringError';
  }
}

export interface ProtectionMonitoringAssetReader {
  get(workspaceId: string, assetId: TrademarkAssetId): Promise<TrademarkAsset>;
}
export interface ProtectionMonitoringWatchReader {
  getLatest(
    workspaceId: string,
    watchId: WorkspaceWatchTargetId
  ): Promise<WorkspaceWatchTargetV1 | undefined>;
}
export interface ProtectionMonitoringOpportunityWriter {
  createCandidateFromVerifiedSources(
    command: Readonly<CreateVerifiedOpportunityCandidateCommand>
  ): Promise<OpportunityCandidate>;
}
export interface ProtectionMonitoringRepository {
  create(
    candidate: Readonly<ProtectionMonitoringCandidateV1>,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProtectionMonitoringCandidateV1>;
  get(
    workspaceId: string,
    id: ProtectionMonitoringCandidateIdV1
  ): Promise<ProtectionMonitoringCandidateV1 | undefined>;
  decision(
    workspaceId: string,
    id: ProtectionMonitoringCandidateIdV1
  ): Promise<ProtectionMonitoringDecisionV1 | undefined>;
  decide(
    decision: Readonly<ProtectionMonitoringDecisionV1>,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProtectionMonitoringDecisionV1>;
  attachActionCandidate(
    workspaceId: string,
    candidateId: ProtectionMonitoringCandidateIdV1,
    opportunity: Readonly<{ id: OpportunityCandidate['opportunityCandidateId']; version: number }>
  ): Promise<ProtectionMonitoringDecisionV1>;
}

export interface AdmitProtectionMonitoringCandidateCommand {
  principal: Readonly<WorkspacePrincipal>;
  asset: Readonly<{ id: TrademarkAssetId; version: number }>;
  watchTarget: Readonly<{ id: WorkspaceWatchTargetId; version: number }>;
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
  trademark: Readonly<DataEngineDiscoveredTrademarkCandidateV1>;
  idempotencyKey: string;
}

export interface DecideProtectionMonitoringCandidateCommand {
  principal: Readonly<WorkspacePrincipal>;
  candidate: Readonly<{ id: ProtectionMonitoringCandidateIdV1; version: 1 }>;
  expectedCandidateFingerprintSha256: string;
  disposition: ProtectionMonitoringDispositionV1;
  rationale: string;
  idempotencyKey: string;
}

function cleanText(value: string, field: string, maximum = 500): string {
  const cleaned = value?.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new ProtectionMonitoringError('INVALID_INPUT', `${field} is invalid.`, 422);
  return cleaned;
}
function workspace(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new ProtectionMonitoringError('INVALID_INPUT', 'workspaceId is invalid.', 422);
  return cleaned;
}
function requireManager(principal: Readonly<WorkspacePrincipal>): string {
  if (principal.kind !== 'WORKSPACE' || !principal.permissions.includes('matter:manage'))
    throw new ProtectionMonitoringError(
      'PERMISSION_DENIED',
      'matter:manage permission is required.',
      403
    );
  return workspace(principal.workspaceId);
}
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function normalizedMark(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('und')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
function bigrams(value: string): string[] {
  if (value.length < 2) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
}
export function protectionMonitoringTextScoreBasisPointsV1(left: string, right: string): number {
  const a = normalizedMark(left);
  const b = normalizedMark(right);
  if (!a || !b) return 0;
  if (a === b) return 10_000;
  const rightCounts = new Map<string, number>();
  for (const item of bigrams(b)) rightCounts.set(item, (rightCounts.get(item) ?? 0) + 1);
  let intersection = 0;
  const leftItems = bigrams(a);
  for (const item of leftItems) {
    const count = rightCounts.get(item) ?? 0;
    if (count > 0) {
      intersection += 1;
      rightCounts.set(item, count - 1);
    }
  }
  return Math.round((2 * intersection * 10_000) / (leftItems.length + bigrams(b).length));
}
function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
function assetSource(asset: Readonly<TrademarkAsset>): ProductLoopSourceReference {
  return {
    schemaVersion: 1,
    owner: 'LITE',
    kind: 'TRADEMARK_CONTEXT',
    sourceId: asset.trademarkAssetId,
    sourceVersion: asset.version,
    sourceFingerprintSha256: digest(asset),
    observedAt: asset.updatedAt
  };
}
function dataEngineSource(
  mark: Readonly<DataEngineDiscoveredTrademarkCandidateV1>
): ProductLoopSourceReference {
  return {
    schemaVersion: 1,
    owner: 'DATA_ENGINE',
    kind: 'DATA_ENGINE_APPLICANT_DISCOVERY',
    sourceId: mark.source_reference.source_id,
    sourceVersion: mark.source_reference.source_version,
    sourceFingerprintSha256: mark.source_reference.source_fingerprint_sha256.slice(
      'sha256:'.length
    ),
    observedAt: mark.source_reference.observed_at
  };
}

export class ProtectionMonitoringService {
  constructor(
    private readonly assets: ProtectionMonitoringAssetReader,
    private readonly watches: ProtectionMonitoringWatchReader,
    private readonly ownerReader: ExactDiscoveredTrademarkReader,
    private readonly repository: ProtectionMonitoringRepository,
    private readonly opportunities: ProtectionMonitoringOpportunityWriter,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly ids: Readonly<{
      candidate: () => ProtectionMonitoringCandidateIdV1;
      decision: () => ProtectionMonitoringDecisionIdV1;
    }> = {
      candidate: () => `protection-monitoring-candidate_${randomUUID().replaceAll('-', '')}`,
      decision: () => `protection-monitoring-decision_${randomUUID().replaceAll('-', '')}`
    }
  ) {}

  async admit(
    command: Readonly<AdmitProtectionMonitoringCandidateCommand>
  ): Promise<ProtectionMonitoringCandidateV1> {
    const workspaceId = requireManager(command.principal);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const [asset, watch] = await Promise.all([
      this.assets.get(workspaceId, command.asset.id),
      this.watches.getLatest(workspaceId, command.watchTarget.id)
    ]).catch((cause) => {
      throw new ProtectionMonitoringError(
        'DEPENDENCY_UNAVAILABLE',
        'Current Asset/Watch evidence is unavailable.',
        503,
        { cause }
      );
    });
    if (!asset || asset.version !== command.asset.version)
      throw new ProtectionMonitoringError(
        'SOURCE_NOT_CURRENT',
        'The managed Trademark Asset reference is not current.'
      );
    if (
      !asset.identity.markText ||
      !asset.workspaceRelationships.some((item) => item.kind !== 'MARKETPLACE_ADDED')
    )
      throw new ProtectionMonitoringError(
        'INVALID_INPUT',
        'Protection monitoring requires a managed, represented, or owned asset with mark text.',
        422
      );
    if (
      !watch ||
      watch.version !== command.watchTarget.version ||
      watch.status !== 'ACTIVE' ||
      watch.purpose !== 'ENFORCEMENT'
    )
      throw new ProtectionMonitoringError(
        'SOURCE_NOT_CURRENT',
        'An exact active ENFORCEMENT Watch target is required.'
      );
    const watchApplicant =
      watch.target.targetKind === 'APPLICANT' ? watch.target.applicant : watch.target.applicant;
    if (
      !same(watchApplicant, command.applicant) ||
      !same(command.trademark.applicant, command.applicant)
    )
      throw new ProtectionMonitoringError(
        'INVALID_INPUT',
        'The observed trademark must belong to the exact watched applicant.',
        422
      );

    let envelope;
    try {
      envelope = await this.ownerReader.readTrademark({
        requestContext: {
          requester_workspace_id: workspaceId,
          request_id: `protection-monitoring-${digest(idempotencyKey)}`
        },
        applicant: command.applicant,
        trademark: {
          trademark_candidate_id: command.trademark.trademark_candidate_id,
          source_reference: command.trademark.source_reference
        }
      });
    } catch (cause) {
      if (
        cause instanceof DiscoveredTrademarkAdmissionError &&
        cause.code === 'OWNER_READ_NOT_CURRENT'
      )
        throw new ProtectionMonitoringError(
          'SOURCE_NOT_CURRENT',
          'The exact Data Engine observation is not current.'
        );
      throw new ProtectionMonitoringError(
        'DEPENDENCY_UNAVAILABLE',
        'Data Engine exact owner read is unavailable.',
        503,
        { cause }
      );
    }
    const current = envelope.fact_state === 'observed' ? envelope.payload?.results[0] : undefined;
    if (!current || envelope.payload?.results.length !== 1 || !same(current, command.trademark))
      throw new ProtectionMonitoringError(
        'SOURCE_NOT_CURRENT',
        'The exact Data Engine observation is not current.'
      );
    if (!current.mark_text)
      throw new ProtectionMonitoringError(
        'INVALID_INPUT',
        'The observed trademark has no comparable mark text.',
        422
      );
    const scoreBasisPoints = protectionMonitoringTextScoreBasisPointsV1(
      asset.identity.markText,
      current.mark_text
    );
    if (scoreBasisPoints < 5_000)
      throw new ProtectionMonitoringError(
        'NOT_RELEVANT',
        'The bounded text method did not meet the 0.5000 review threshold.',
        422
      );
    const timestamp = new Date(this.now()).toISOString();
    const withoutFingerprint = {
      schemaVersion: 1 as const,
      protectionMonitoringCandidateId: this.ids.candidate(),
      workspaceId,
      version: 1 as const,
      asset: { id: asset.trademarkAssetId, version: asset.version },
      watchTarget: { id: watch.workspaceWatchTargetId, version: watch.version },
      applicant: command.applicant,
      observedTrademark: current,
      relevance: {
        method: 'NORMALIZED_MARK_TEXT_BIGRAM_DICE_V1' as const,
        managedMarkNormalized: normalizedMark(asset.identity.markText),
        observedMarkNormalized: normalizedMark(current.mark_text),
        scoreBasisPoints,
        explanation: `Normalized mark-text bigram Dice score ${(scoreBasisPoints / 100).toFixed(2)}%; this prioritizes human review only.`,
        algorithmicSimilarityIsLegalConclusion: false as const,
        likelihoodOfConfusionConcluded: false as const,
        infringementConcluded: false as const
      },
      authorityConsequences: noProtectionMonitoringAuthorityConsequencesV1,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const candidate = {
      ...withoutFingerprint,
      candidateFingerprintSha256: protectionMonitoringFingerprintSha256V1(withoutFingerprint)
    };
    return this.repository.create(
      candidate,
      idempotencyKey,
      digest({
        workspaceId,
        asset: command.asset,
        watchTarget: command.watchTarget,
        trademark: command.trademark
      })
    );
  }

  async decide(
    command: Readonly<DecideProtectionMonitoringCandidateCommand>
  ): Promise<ProtectionMonitoringDecisionV1> {
    const workspaceId = requireManager(command.principal);
    if (!protectionMonitoringDispositionsV1.includes(command.disposition))
      throw new ProtectionMonitoringError('INVALID_INPUT', 'disposition is invalid.', 422);
    const candidate = await this.repository.get(workspaceId, command.candidate.id);
    if (!candidate || candidate.version !== command.candidate.version)
      throw new ProtectionMonitoringError('NOT_FOUND', 'Protection candidate was not found.', 404);
    if (
      !SHA256.test(command.expectedCandidateFingerprintSha256) ||
      candidate.candidateFingerprintSha256 !== command.expectedCandidateFingerprintSha256
    )
      throw new ProtectionMonitoringError(
        'SOURCE_NOT_CURRENT',
        'Protection candidate fingerprint is not current.'
      );
    const timestamp = new Date(this.now()).toISOString();
    const decision: ProtectionMonitoringDecisionV1 = {
      schemaVersion: 1,
      protectionMonitoringDecisionId: this.ids.decision(),
      workspaceId,
      version: 1,
      candidate: { id: candidate.protectionMonitoringCandidateId, version: 1 },
      expectedCandidateFingerprintSha256: candidate.candidateFingerprintSha256,
      disposition: command.disposition,
      decidedByPrincipalId: command.principal.userId,
      rationale: cleanText(command.rationale, 'rationale', 4000),
      decidedAt: timestamp,
      externalActionExecuted: false,
      legalConclusionCreated: false
    };
    return this.repository.decide(
      decision,
      cleanText(command.idempotencyKey, 'idempotencyKey', 300),
      digest({
        workspaceId,
        candidate: command.candidate,
        expectedCandidateFingerprintSha256: command.expectedCandidateFingerprintSha256,
        disposition: command.disposition,
        rationale: decision.rationale,
        decidedByPrincipalId: command.principal.userId
      })
    );
  }

  async prepareActionCandidate(
    principal: Readonly<WorkspacePrincipal>,
    candidateId: ProtectionMonitoringCandidateIdV1,
    idempotencyKey: string
  ): Promise<ProtectionMonitoringDecisionV1> {
    const workspaceId = requireManager(principal);
    const [candidate, decision] = await Promise.all([
      this.repository.get(workspaceId, candidateId),
      this.repository.decision(workspaceId, candidateId)
    ]);
    if (!candidate || !decision)
      throw new ProtectionMonitoringError(
        'NOT_FOUND',
        'Protection candidate decision was not found.',
        404
      );
    if (decision.disposition !== 'ACTION')
      throw new ProtectionMonitoringError(
        'CONFLICT',
        'Only a HUMAN ACTION disposition can prepare professional-service work.',
        409
      );
    if (decision.actionCandidate) return decision;
    const asset = await this.assets.get(workspaceId, candidate.asset.id);
    if (asset.version !== candidate.asset.version)
      throw new ProtectionMonitoringError(
        'SOURCE_NOT_CURRENT',
        'The managed Trademark Asset changed after review.'
      );
    let currentObservation;
    try {
      const envelope = await this.ownerReader.readTrademark({
        requestContext: {
          requester_workspace_id: workspaceId,
          request_id: `protection-action-${digest(idempotencyKey)}`
        },
        applicant: candidate.applicant,
        trademark: {
          trademark_candidate_id: candidate.observedTrademark.trademark_candidate_id,
          source_reference: candidate.observedTrademark.source_reference
        }
      });
      currentObservation =
        envelope.fact_state === 'observed' ? envelope.payload?.results[0] : undefined;
    } catch (cause) {
      if (
        cause instanceof DiscoveredTrademarkAdmissionError &&
        cause.code === 'OWNER_READ_NOT_CURRENT'
      )
        throw new ProtectionMonitoringError(
          'SOURCE_NOT_CURRENT',
          'The exact Data Engine observation is not current.'
        );
      throw new ProtectionMonitoringError(
        'DEPENDENCY_UNAVAILABLE',
        'Data Engine exact owner read is unavailable.',
        503,
        { cause }
      );
    }
    if (!currentObservation || !same(currentObservation, candidate.observedTrademark))
      throw new ProtectionMonitoringError(
        'SOURCE_NOT_CURRENT',
        'The exact Data Engine observation changed after review.'
      );
    const opportunity = await this.opportunities.createCandidateFromVerifiedSources({
      workspaceId,
      title: `Protection review for ${asset.identity.markText ?? asset.trademarkAssetId}`,
      serviceNeedSummary: `A human selected ACTION after reviewing Data Engine trademark observation ${candidate.observedTrademark.trademark_candidate_id}. Similarity evidence prioritized review only and is not an infringement or likelihood-of-confusion conclusion.`,
      sources: [assetSource(asset), dataEngineSource(candidate.observedTrademark)],
      idempotencyKey: cleanText(idempotencyKey, 'idempotencyKey', 300)
    });
    return this.repository.attachActionCandidate(workspaceId, candidateId, {
      id: opportunity.opportunityCandidateId,
      version: opportunity.version
    });
  }
}

type Row = Record<string, unknown>;
export class PostgresProtectionMonitoringRepository implements ProtectionMonitoringRepository {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient
  ) {}

  async create(
    candidate: Readonly<ProtectionMonitoringCandidateV1>,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProtectionMonitoringCandidateV1> {
    return this.command(
      candidate.workspaceId,
      idempotencyKey,
      'ADMIT',
      requestFingerprint,
      async (client) => {
        await client.query(
          `INSERT INTO lite_protection_monitoring_candidates(workspace_id,candidate_id,asset_id,watch_target_id,status,candidate_json,created_at,updated_at) VALUES($1,$2,$3,$4,'OPEN',$5::jsonb,$6,$6)`,
          [
            candidate.workspaceId,
            candidate.protectionMonitoringCandidateId,
            candidate.asset.id,
            candidate.watchTarget.id,
            JSON.stringify(candidate),
            candidate.createdAt
          ]
        );
        return candidate;
      }
    );
  }
  async get(
    workspaceId: string,
    id: ProtectionMonitoringCandidateIdV1
  ): Promise<ProtectionMonitoringCandidateV1 | undefined> {
    try {
      const result = await this.query.query(
        'SELECT candidate_json FROM lite_protection_monitoring_candidates WHERE workspace_id=$1 AND candidate_id=$2',
        [workspace(workspaceId), id]
      );
      return result.rows[0]
        ? structuredClone((result.rows[0] as Row).candidate_json as ProtectionMonitoringCandidateV1)
        : undefined;
    } catch (cause) {
      throw new ProtectionMonitoringError(
        'PERSISTENCE_UNAVAILABLE',
        'Protection monitoring persistence is unavailable.',
        503,
        { cause }
      );
    }
  }
  async decision(
    workspaceId: string,
    id: ProtectionMonitoringCandidateIdV1
  ): Promise<ProtectionMonitoringDecisionV1 | undefined> {
    try {
      const result = await this.query.query(
        'SELECT decision_json FROM lite_protection_monitoring_candidates WHERE workspace_id=$1 AND candidate_id=$2',
        [workspace(workspaceId), id]
      );
      const value = (result.rows[0] as Row | undefined)?.decision_json;
      return value ? structuredClone(value as ProtectionMonitoringDecisionV1) : undefined;
    } catch (cause) {
      throw new ProtectionMonitoringError(
        'PERSISTENCE_UNAVAILABLE',
        'Protection monitoring persistence is unavailable.',
        503,
        { cause }
      );
    }
  }
  async decide(
    decision: Readonly<ProtectionMonitoringDecisionV1>,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProtectionMonitoringDecisionV1> {
    return this.command(
      decision.workspaceId,
      idempotencyKey,
      'DECIDE',
      requestFingerprint,
      async (client) => {
        const result = await client.query(
          `UPDATE lite_protection_monitoring_candidates SET status='DISPOSITIONED',decision_json=$3::jsonb,updated_at=$4 WHERE workspace_id=$1 AND candidate_id=$2 AND decision_json IS NULL RETURNING candidate_id`,
          [
            decision.workspaceId,
            decision.candidate.id,
            JSON.stringify(decision),
            decision.decidedAt
          ]
        );
        if (!result.rowCount)
          throw new ProtectionMonitoringError(
            'CONFLICT',
            'Protection candidate was already dispositioned or is missing.',
            409
          );
        return decision;
      }
    );
  }
  async attachActionCandidate(
    workspaceId: string,
    candidateId: ProtectionMonitoringCandidateIdV1,
    opportunity: Readonly<{ id: OpportunityCandidate['opportunityCandidateId']; version: number }>
  ): Promise<ProtectionMonitoringDecisionV1> {
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:protection-action:${candidateId}`
        ]);
        const found = await client.query(
          'SELECT decision_json FROM lite_protection_monitoring_candidates WHERE workspace_id=$1 AND candidate_id=$2 FOR UPDATE',
          [workspaceId, candidateId]
        );
        const current = (found.rows[0] as Row | undefined)?.decision_json as
          ProtectionMonitoringDecisionV1 | undefined;
        if (!current || current.disposition !== 'ACTION')
          throw new ProtectionMonitoringError(
            'CONFLICT',
            'A current ACTION decision is required.',
            409
          );
        if (current.actionCandidate) return current;
        const next = { ...current, actionCandidate: opportunity };
        await client.query(
          'UPDATE lite_protection_monitoring_candidates SET decision_json=$3::jsonb,updated_at=now() WHERE workspace_id=$1 AND candidate_id=$2',
          [workspaceId, candidateId, JSON.stringify(next)]
        );
        return next;
      });
    } catch (cause) {
      if (cause instanceof ProtectionMonitoringError) throw cause;
      throw new ProtectionMonitoringError(
        'PERSISTENCE_UNAVAILABLE',
        'Protection monitoring persistence is unavailable.',
        503,
        { cause }
      );
    }
  }
  private async command<T>(
    workspaceId: string,
    idempotencyKey: string,
    type: string,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:protection-monitoring:${idempotencyKey}`
        ]);
        const replay = await client.query(
          'SELECT command_type,request_fingerprint_sha256,result_json FROM lite_protection_monitoring_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (
            prior.command_type !== type ||
            prior.request_fingerprint_sha256 !== requestFingerprint
          )
            throw new ProtectionMonitoringError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key conflicts with an earlier request.',
              409
            );
          return structuredClone(prior.result_json as T);
        }
        const result = await write(client);
        await client.query(
          'INSERT INTO lite_protection_monitoring_commands(workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at) VALUES($1,$2,$3,$4,$5::jsonb,now())',
          [workspaceId, idempotencyKey, type, requestFingerprint, JSON.stringify(result)]
        );
        return result;
      });
    } catch (cause) {
      if (cause instanceof ProtectionMonitoringError) throw cause;
      throw new ProtectionMonitoringError(
        'PERSISTENCE_UNAVAILABLE',
        'Protection monitoring persistence is unavailable.',
        503,
        { cause }
      );
    }
  }
}
