import { createHash, randomUUID } from 'node:crypto';
import {
  relationshipModels,
  type CustomerIntent,
  type MarkOrbitId,
  type RelationshipModel
} from '@markorbit/contracts';
import {
  type FormalTrademarkServiceOpportunity,
  type FormalTrademarkServiceOpportunityId,
  type MarkRegIntakeHandoff,
  type OpportunityCandidate,
  type OpportunityCandidateId,
  type OpportunityQualificationDecision,
  type OpportunityQualificationDecisionId
} from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const MARKORBIT_ID = /^[^_\s]+_.+$/;

export type FormalOpportunityErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CANDIDATE_NOT_QUALIFIED'
  | 'STALE_SOURCE'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'WORKSPACE_MISMATCH'
  | 'DUPLICATE_SOURCE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'PERSISTENCE_UNAVAILABLE';

export class FormalOpportunityError extends Error {
  constructor(
    readonly code: FormalOpportunityErrorCode,
    message: string,
    readonly status = 409,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'FormalOpportunityError';
  }
}

export interface QualifiedOpportunityEvidence {
  /** The exact Candidate version reviewed by the human Qualification Decision. */
  candidate: OpportunityCandidate;
  /** The latest Lite-owned Candidate version proving the disposition remains current. */
  currentCandidate: OpportunityCandidate;
  qualificationDecision: OpportunityQualificationDecision;
}

/**
 * Lite remains the source authority for Candidate and Qualification state.
 * MarkReg consumes that authority through this boundary and never reads Lite SQL.
 */
export interface QualifiedOpportunityAuthority {
  resolve(
    workspaceId: string,
    candidate: Readonly<{ id: OpportunityCandidateId; version: number }>,
    qualificationDecision: Readonly<{ id: OpportunityQualificationDecisionId; version: number }>
  ): Promise<Readonly<QualifiedOpportunityEvidence>>;
}

export interface CreateFormalTrademarkServiceOpportunityCommand {
  workspaceId: string;
  candidate: Readonly<{ id: OpportunityCandidateId; version: number }>;
  expectedCandidateFingerprintSha256: string;
  qualificationDecision: Readonly<{ id: OpportunityQualificationDecisionId; version: number }>;
  relationshipModel: RelationshipModel;
  proposedCustomerIntent?: Readonly<CustomerIntent>;
  promotedByPrincipalId: MarkOrbitId;
  idempotencyKey: string;
}

export interface PrepareMarkRegIntakeHandoffCommand {
  workspaceId: string;
  formalOpportunity: Readonly<{ id: FormalTrademarkServiceOpportunityId; version: number }>;
  expectedFormalOpportunityFingerprintSha256: string;
  relationshipModel: RelationshipModel;
  customerIntent: Readonly<CustomerIntent>;
  confirmedByPrincipalId: MarkOrbitId;
  idempotencyKey: string;
}

export interface FormalOpportunityHandoffDisposition {
  handoff: MarkRegIntakeHandoff;
  currentFormalOpportunity: FormalTrademarkServiceOpportunity;
}

export interface MarkRegTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

type Row = Record<string, unknown>;
type CommandType = 'CREATE_FORMAL_OPPORTUNITY' | 'PREPARE_INTAKE_HANDOFF';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new FormalOpportunityError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned) throw new FormalOpportunityError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new FormalOpportunityError('INVALID_INPUT', `${field} exceeds the allowed length.`, 422);
  return cleaned;
}

function cleanMarkOrbitId(value: MarkOrbitId, field: string): MarkOrbitId {
  const cleaned = value.trim() as MarkOrbitId;
  if (!MARKORBIT_ID.test(cleaned))
    throw new FormalOpportunityError('INVALID_INPUT', `${field} is invalid.`, 422);
  return cleaned;
}

function exactVersion(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1)
    throw new FormalOpportunityError('INVALID_INPUT', `${field} must be a positive integer.`, 422);
  return value;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!SHA256.test(cleaned))
    throw new FormalOpportunityError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new FormalOpportunityError('INVALID_INPUT', `${field} must be an ISO timestamp.`, 422);
  return parsed.toISOString();
}

function cleanRelationshipModel(value: RelationshipModel): RelationshipModel {
  if (!relationshipModels.includes(value))
    throw new FormalOpportunityError('INVALID_INPUT', 'relationshipModel is invalid.', 422);
  return value;
}

function cleanCustomerIntent(value: Readonly<CustomerIntent>, field: string): CustomerIntent {
  if (!value || typeof value !== 'object')
    throw new FormalOpportunityError('INVALID_INPUT', `${field} is required.`, 422);
  const targetJurisdictions = value.targetJurisdictions.map((entry) =>
    cleanText(entry, `${field}.targetJurisdictions`, 120)
  );
  if (!targetJurisdictions.length || targetJurisdictions.length > 50)
    throw new FormalOpportunityError(
      'INVALID_INPUT',
      `${field}.targetJurisdictions must contain between one and fifty jurisdictions.`,
      422
    );
  if (new Set(targetJurisdictions).size !== targetJurisdictions.length)
    throw new FormalOpportunityError(
      'INVALID_INPUT',
      `${field}.targetJurisdictions must be unique.`,
      422
    );
  return {
    brandName: cleanText(value.brandName, `${field}.brandName`, 300),
    applicantCountry: cleanText(value.applicantCountry, `${field}.applicantCountry`, 120),
    targetJurisdictions,
    goodsServicesDescription: cleanText(
      value.goodsServicesDescription,
      `${field}.goodsServicesDescription`,
      8000
    )
  };
}

function sameIntent(left: Readonly<CustomerIntent>, right: Readonly<CustomerIntent>): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nextOpportunityId(): FormalTrademarkServiceOpportunityId {
  return `trademark-service-opportunity_${randomUUID().replaceAll('-', '')}`;
}

function rowDocument<T>(row: Row | undefined, field = 'document_json'): T | undefined {
  return row ? clone(row[field] as T) : undefined;
}

function withFingerprint(
  value: Omit<FormalTrademarkServiceOpportunity, 'formalOpportunityFingerprintSha256'>
): FormalTrademarkServiceOpportunity {
  return { ...value, formalOpportunityFingerprintSha256: fingerprint(value) };
}

export class PostgresFormalOpportunityStore {
  constructor(
    private readonly database: MarkRegTransactionHost,
    private readonly query: QueryClient,
    private readonly qualifiedAuthority: QualifiedOpportunityAuthority,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly opportunityId: () => FormalTrademarkServiceOpportunityId = nextOpportunityId
  ) {}

  async createFormalOpportunity(
    command: Readonly<CreateFormalTrademarkServiceOpportunityCommand>
  ): Promise<FormalTrademarkServiceOpportunity> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const candidate = {
      id: cleanText(command.candidate.id, 'candidate.id', 300) as OpportunityCandidateId,
      version: exactVersion(command.candidate.version, 'candidate.version')
    };
    const qualificationDecision = {
      id: cleanText(
        command.qualificationDecision.id,
        'qualificationDecision.id',
        300
      ) as OpportunityQualificationDecisionId,
      version: exactVersion(command.qualificationDecision.version, 'qualificationDecision.version')
    };
    const expectedCandidateFingerprintSha256 = exactSha256(
      command.expectedCandidateFingerprintSha256,
      'expectedCandidateFingerprintSha256'
    );
    const relationshipModel = cleanRelationshipModel(command.relationshipModel);
    const proposedCustomerIntent = command.proposedCustomerIntent
      ? cleanCustomerIntent(command.proposedCustomerIntent, 'proposedCustomerIntent')
      : undefined;
    const promotedByPrincipalId = cleanMarkOrbitId(
      command.promotedByPrincipalId,
      'promotedByPrincipalId'
    );
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);

    const evidence = await this.resolveQualifiedEvidence(
      workspaceId,
      candidate,
      qualificationDecision,
      expectedCandidateFingerprintSha256
    );
    const requestFingerprint = fingerprint({
      workspaceId,
      candidate,
      expectedCandidateFingerprintSha256,
      qualificationDecision,
      relationshipModel,
      proposedCustomerIntent,
      promotedByPrincipalId
    });
    const createdAt = exactTimestamp(this.now(), 'now');
    const opportunity = withFingerprint({
      schemaVersion: 1,
      formalTrademarkServiceOpportunityId: this.opportunityId(),
      workspaceId,
      version: 1,
      owningService: 'MARKREG',
      sourceCandidate: candidate,
      sourceQualificationDecision: qualificationDecision,
      ...(evidence.candidate.customerId ? { customerId: evidence.candidate.customerId } : {}),
      serviceNeedSummary: evidence.candidate.serviceNeedSummary,
      ...(proposedCustomerIntent ? { proposedCustomerIntent } : {}),
      relationshipModel,
      status: 'QUALIFIED',
      orderCreated: false,
      matterCreated: false,
      paymentCreated: false,
      filingSubmitted: false,
      customerContactedByCreation: false,
      createdAt,
      updatedAt: createdAt
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      'CREATE_FORMAL_OPPORTUNITY',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(
          client,
          `${workspaceId}:${qualificationDecision.id}:${qualificationDecision.version}:formal-opportunity`
        );
        const priorSource = await client.query(
          'SELECT formal_trademark_service_opportunity_id FROM markreg_formal_trademark_service_opportunities WHERE workspace_id=$1 AND source_qualification_decision_id=$2 AND source_qualification_decision_version=$3 AND version=1 LIMIT 1',
          [workspaceId, qualificationDecision.id, qualificationDecision.version]
        );
        if (priorSource.rowCount)
          throw new FormalOpportunityError(
            'DUPLICATE_SOURCE',
            'This exact Qualification Decision already created a Formal Opportunity.'
          );
        await this.insertOpportunity(
          client,
          opportunity,
          expectedCandidateFingerprintSha256,
          promotedByPrincipalId
        );
        return opportunity;
      }
    );
  }

  async prepareIntakeHandoff(
    command: Readonly<PrepareMarkRegIntakeHandoffCommand>
  ): Promise<FormalOpportunityHandoffDisposition> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const formalOpportunity = {
      id: cleanText(
        command.formalOpportunity.id,
        'formalOpportunity.id',
        300
      ) as FormalTrademarkServiceOpportunityId,
      version: exactVersion(command.formalOpportunity.version, 'formalOpportunity.version')
    };
    const expectedFormalOpportunityFingerprintSha256 = exactSha256(
      command.expectedFormalOpportunityFingerprintSha256,
      'expectedFormalOpportunityFingerprintSha256'
    );
    const relationshipModel = cleanRelationshipModel(command.relationshipModel);
    const customerIntent = cleanCustomerIntent(command.customerIntent, 'customerIntent');
    const confirmedByPrincipalId = cleanMarkOrbitId(
      command.confirmedByPrincipalId,
      'confirmedByPrincipalId'
    );
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprint = fingerprint({
      workspaceId,
      formalOpportunity,
      expectedFormalOpportunityFingerprintSha256,
      relationshipModel,
      customerIntent,
      confirmedByPrincipalId
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      'PREPARE_INTAKE_HANDOFF',
      requestFingerprint,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:${formalOpportunity.id}:intake-handoff`);
        const current = await this.latestOpportunity(client, workspaceId, formalOpportunity.id);
        if (current.version !== formalOpportunity.version)
          throw new FormalOpportunityError(
            'VERSION_CONFLICT',
            `Formal Opportunity is at version ${current.version}, not ${formalOpportunity.version}.`
          );
        if (
          current.formalOpportunityFingerprintSha256 !== expectedFormalOpportunityFingerprintSha256
        )
          throw new FormalOpportunityError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Formal Opportunity fingerprint no longer matches the confirmed handoff.'
          );
        if (current.status !== 'QUALIFIED')
          throw new FormalOpportunityError(
            'INVALID_TRANSITION',
            'Only a QUALIFIED Formal Opportunity can prepare a MarkReg Intake handoff.'
          );
        if (current.relationshipModel !== relationshipModel)
          throw new FormalOpportunityError(
            'STALE_SOURCE',
            'The confirmed relationship model differs from the Formal Opportunity.'
          );
        if (
          current.proposedCustomerIntent &&
          !sameIntent(current.proposedCustomerIntent, customerIntent)
        )
          throw new FormalOpportunityError(
            'STALE_SOURCE',
            'The confirmed customer intent differs from the Formal Opportunity proposal.'
          );
        const existing = await client.query(
          'SELECT 1 FROM markreg_intake_handoffs WHERE workspace_id=$1 AND formal_trademark_service_opportunity_id=$2 LIMIT 1',
          [workspaceId, formalOpportunity.id]
        );
        if (existing.rowCount)
          throw new FormalOpportunityError(
            'VERSION_CONFLICT',
            'This Formal Opportunity already has an Intake handoff.'
          );

        const confirmedAt = exactTimestamp(this.now(), 'now');
        const handoff: MarkRegIntakeHandoff = {
          schemaVersion: 1,
          workspaceId,
          formalOpportunity,
          expectedFormalOpportunityFingerprintSha256,
          target: 'MARKREG_INTAKE',
          channel: 'LITE_PROFESSIONAL',
          relationshipModel,
          customerIntent,
          confirmedByPrincipalId,
          confirmedAt,
          intakeCreated: false,
          orderCreated: false,
          matterCreated: false
        };
        const currentFormalOpportunity = withFingerprint({
          schemaVersion: 1,
          formalTrademarkServiceOpportunityId: current.formalTrademarkServiceOpportunityId,
          workspaceId,
          version: current.version + 1,
          owningService: 'MARKREG',
          sourceCandidate: current.sourceCandidate,
          sourceQualificationDecision: current.sourceQualificationDecision,
          ...(current.customerId ? { customerId: current.customerId } : {}),
          serviceNeedSummary: current.serviceNeedSummary,
          ...(current.proposedCustomerIntent
            ? { proposedCustomerIntent: current.proposedCustomerIntent }
            : {}),
          relationshipModel: current.relationshipModel,
          status: 'HANDED_OFF_TO_INTAKE',
          orderCreated: false,
          matterCreated: false,
          paymentCreated: false,
          filingSubmitted: false,
          customerContactedByCreation: false,
          createdAt: current.createdAt,
          updatedAt: confirmedAt
        });
        const sourceFingerprint = await this.sourceCandidateFingerprint(
          client,
          workspaceId,
          current.formalTrademarkServiceOpportunityId
        );
        await client.query(
          'INSERT INTO markreg_intake_handoffs (workspace_id,formal_trademark_service_opportunity_id,formal_opportunity_version,expected_formal_opportunity_fingerprint_sha256,document_json,confirmed_by_principal_id,confirmed_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)',
          [
            workspaceId,
            formalOpportunity.id,
            formalOpportunity.version,
            expectedFormalOpportunityFingerprintSha256,
            JSON.stringify(handoff),
            confirmedByPrincipalId,
            confirmedAt
          ]
        );
        await this.insertOpportunity(
          client,
          currentFormalOpportunity,
          sourceFingerprint,
          confirmedByPrincipalId
        );
        return { handoff, currentFormalOpportunity };
      }
    );
  }

  async findFormalOpportunity(
    workspaceIdValue: string,
    opportunityId: FormalTrademarkServiceOpportunityId,
    version: number
  ): Promise<FormalTrademarkServiceOpportunity | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM markreg_formal_trademark_service_opportunities WHERE workspace_id=$1 AND formal_trademark_service_opportunity_id=$2 AND version=$3',
      [workspaceId, opportunityId, exactVersion(version, 'version')]
    );
    return rowDocument<FormalTrademarkServiceOpportunity>(result.rows[0] as Row | undefined);
  }

  async findLatestFormalOpportunity(
    workspaceIdValue: string,
    opportunityId: FormalTrademarkServiceOpportunityId
  ): Promise<FormalTrademarkServiceOpportunity | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM markreg_formal_trademark_service_opportunities WHERE workspace_id=$1 AND formal_trademark_service_opportunity_id=$2 ORDER BY version DESC LIMIT 1',
      [workspaceId, opportunityId]
    );
    return rowDocument<FormalTrademarkServiceOpportunity>(result.rows[0] as Row | undefined);
  }

  async findIntakeHandoff(
    workspaceIdValue: string,
    opportunityId: FormalTrademarkServiceOpportunityId
  ): Promise<MarkRegIntakeHandoff | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM markreg_intake_handoffs WHERE workspace_id=$1 AND formal_trademark_service_opportunity_id=$2',
      [workspaceId, opportunityId]
    );
    return rowDocument<MarkRegIntakeHandoff>(result.rows[0] as Row | undefined);
  }

  private async resolveQualifiedEvidence(
    workspaceId: string,
    candidateReference: Readonly<{ id: OpportunityCandidateId; version: number }>,
    qualificationReference: Readonly<{
      id: OpportunityQualificationDecisionId;
      version: number;
    }>,
    expectedCandidateFingerprintSha256: string
  ): Promise<Readonly<QualifiedOpportunityEvidence>> {
    let evidence: Readonly<QualifiedOpportunityEvidence>;
    try {
      evidence = await this.qualifiedAuthority.resolve(
        workspaceId,
        candidateReference,
        qualificationReference
      );
    } catch (error) {
      if (error instanceof FormalOpportunityError) throw error;
      throw new FormalOpportunityError(
        'DEPENDENCY_UNAVAILABLE',
        'Lite Candidate qualification authority is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    const candidate = evidence.candidate;
    const currentCandidate = evidence.currentCandidate;
    const decision = evidence.qualificationDecision;
    if (
      candidate.workspaceId !== workspaceId ||
      currentCandidate.workspaceId !== workspaceId ||
      decision.workspaceId !== workspaceId
    )
      throw new FormalOpportunityError(
        'WORKSPACE_MISMATCH',
        'Qualified Candidate evidence belongs to another Workspace.',
        403
      );
    if (
      candidate.opportunityCandidateId !== candidateReference.id ||
      candidate.version !== candidateReference.version ||
      decision.opportunityQualificationDecisionId !== qualificationReference.id ||
      decision.version !== qualificationReference.version
    )
      throw new FormalOpportunityError(
        'STALE_SOURCE',
        'Lite returned different Candidate or Qualification evidence than requested.'
      );
    if (candidate.opportunityCandidateFingerprintSha256 !== expectedCandidateFingerprintSha256)
      throw new FormalOpportunityError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Qualified Candidate fingerprint does not match the owner mutation request.'
      );
    if (
      decision.candidate.id !== candidate.opportunityCandidateId ||
      Number(decision.candidate.version) !== candidate.version ||
      decision.expectedCandidateFingerprintSha256 !==
        candidate.opportunityCandidateFingerprintSha256
    )
      throw new FormalOpportunityError(
        'STALE_SOURCE',
        'Qualification Decision does not reference the exact Candidate version and fingerprint.'
      );
    if (
      currentCandidate.opportunityCandidateId !== candidate.opportunityCandidateId ||
      currentCandidate.version <= candidate.version ||
      currentCandidate.status !== 'DISPOSITIONED'
    )
      throw new FormalOpportunityError(
        'STALE_SOURCE',
        'The qualified Candidate disposition is not current.'
      );
    if (decision.outcome !== 'QUALIFIED_FOR_MARKREG')
      throw new FormalOpportunityError(
        'CANDIDATE_NOT_QUALIFIED',
        'Only a Candidate explicitly qualified for MarkReg may create a Formal Opportunity.',
        422
      );
    if (
      candidate.formalOpportunityCreated ||
      candidate.customerContacted ||
      currentCandidate.formalOpportunityCreated ||
      currentCandidate.customerContacted ||
      decision.formalOpportunityCreated ||
      decision.customerContacted
    )
      throw new FormalOpportunityError(
        'STALE_SOURCE',
        'Lite Candidate evidence claims consequences that are outside the Candidate boundary.'
      );
    return evidence;
  }

  private async command<T>(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprintSha256: string,
    write: (client: QueryClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(
          client,
          `${workspaceId}:formal-opportunity-idempotency:${idempotencyKey}`
        );
        const replay = await client.query(
          'SELECT command_type,request_fingerprint_sha256,result_json FROM markreg_formal_opportunity_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprintSha256
          )
            throw new FormalOpportunityError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Formal Opportunity command.'
            );
          return rowDocument<T>(prior, 'result_json') as T;
        }
        const result = await write(client);
        await client.query(
          'INSERT INTO markreg_formal_opportunity_commands (workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
          [
            workspaceId,
            idempotencyKey,
            commandType,
            requestFingerprintSha256,
            JSON.stringify(result),
            exactTimestamp(this.now(), 'now')
          ]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof FormalOpportunityError) throw error;
      if ((error as { code?: string }).code === '23505')
        throw new FormalOpportunityError(
          'DUPLICATE_SOURCE',
          'The qualified source already has a Formal Opportunity.',
          409,
          undefined,
          { cause: error instanceof Error ? error : undefined }
        );
      throw new FormalOpportunityError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg Formal Opportunity persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  private async resourceLock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }

  private async latestOpportunity(
    client: QueryClient,
    workspaceId: string,
    opportunityId: FormalTrademarkServiceOpportunityId
  ): Promise<FormalTrademarkServiceOpportunity> {
    const result = await client.query(
      'SELECT document_json FROM markreg_formal_trademark_service_opportunities WHERE workspace_id=$1 AND formal_trademark_service_opportunity_id=$2 ORDER BY version DESC LIMIT 1',
      [workspaceId, opportunityId]
    );
    const value = rowDocument<FormalTrademarkServiceOpportunity>(result.rows[0] as Row | undefined);
    if (!value)
      throw new FormalOpportunityError('NOT_FOUND', 'Formal Opportunity was not found.', 404);
    return value;
  }

  private async sourceCandidateFingerprint(
    client: QueryClient,
    workspaceId: string,
    opportunityId: FormalTrademarkServiceOpportunityId
  ): Promise<string> {
    const result = await client.query(
      'SELECT source_candidate_fingerprint_sha256 FROM markreg_formal_trademark_service_opportunities WHERE workspace_id=$1 AND formal_trademark_service_opportunity_id=$2 AND version=1',
      [workspaceId, opportunityId]
    );
    if (!result.rowCount)
      throw new FormalOpportunityError(
        'NOT_FOUND',
        'Formal Opportunity origin was not found.',
        404
      );
    return String((result.rows[0] as Row).source_candidate_fingerprint_sha256);
  }

  private async insertOpportunity(
    client: QueryClient,
    opportunity: FormalTrademarkServiceOpportunity,
    sourceCandidateFingerprintSha256: string,
    principalId: MarkOrbitId
  ): Promise<void> {
    await client.query(
      'INSERT INTO markreg_formal_trademark_service_opportunities (workspace_id,formal_trademark_service_opportunity_id,version,status,source_candidate_id,source_candidate_version,source_candidate_fingerprint_sha256,source_qualification_decision_id,source_qualification_decision_version,customer_id,relationship_model,formal_opportunity_fingerprint_sha256,document_json,created_by_principal_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16)',
      [
        opportunity.workspaceId,
        opportunity.formalTrademarkServiceOpportunityId,
        opportunity.version,
        opportunity.status,
        opportunity.sourceCandidate.id,
        Number(opportunity.sourceCandidate.version),
        sourceCandidateFingerprintSha256,
        opportunity.sourceQualificationDecision.id,
        Number(opportunity.sourceQualificationDecision.version),
        opportunity.customerId ?? null,
        opportunity.relationshipModel,
        opportunity.formalOpportunityFingerprintSha256,
        JSON.stringify(opportunity),
        principalId,
        opportunity.createdAt,
        opportunity.updatedAt
      ]
    );
  }
}
