import { createHash, randomUUID } from 'node:crypto';
import type { CustomerIntent, RelationshipModel } from '@markorbit/contracts';
import { relationshipModels } from '@markorbit/contracts';
import {
  noAutomaticProductLoopConsequences,
  type FormalTrademarkServiceOpportunityId,
  type LiteTodaySnapshot,
  type OpportunityCandidateId,
  type OpportunityQualificationDecisionId,
  type PreparedAction,
  type PreparedActionConfirmation,
  type PreparedActionHandoffResult,
  type PreparedActionId,
  type PreparedActionJourney,
  type ProductLoopHandoffTarget,
  type TodayRecommendation,
  type TodayRecommendationId
} from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export type PreparedActionJourneyErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'STALE_SOURCE'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'CONFIRMATION_REQUIRED'
  | 'POLICY_DENIED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'PERSISTENCE_UNAVAILABLE';

export class PreparedActionJourneyError extends Error {
  constructor(
    readonly code: PreparedActionJourneyErrorCode,
    message: string,
    readonly status = 409,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PreparedActionJourneyError';
  }
}

export interface PrepareContentActionPlan {
  kind: 'PREPARE_CONTENT';
  title: string;
  rationale: string;
}

export interface CreateFormalOpportunityActionPlan {
  kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY';
  candidate: Readonly<{ id: OpportunityCandidateId; version: number }>;
  expectedCandidateFingerprintSha256: string;
  qualificationDecision: Readonly<{ id: OpportunityQualificationDecisionId; version: number }>;
  relationshipModel: RelationshipModel;
  proposedCustomerIntent?: Readonly<CustomerIntent>;
}

export interface StartMarkRegIntakeActionPlan {
  kind: 'START_MARKREG_INTAKE';
  formalOpportunity: Readonly<{ id: FormalTrademarkServiceOpportunityId; version: number }>;
  expectedFormalOpportunityFingerprintSha256: string;
  relationshipModel: RelationshipModel;
  customerIntent: Readonly<CustomerIntent>;
}

export type PreparedActionPlan =
  PrepareContentActionPlan | CreateFormalOpportunityActionPlan | StartMarkRegIntakeActionPlan;

export interface PrepareActionCommand {
  workspaceId: string;
  recommendation: Readonly<{ id: TodayRecommendationId; version: number }>;
  expectedRecommendationFingerprintSha256: string;
  plan: Readonly<PreparedActionPlan>;
  idempotencyKey: string;
}

export interface ConfirmPreparedActionCommand {
  workspaceId: string;
  preparedAction: Readonly<{ id: PreparedActionId; version: number }>;
  expectedPreparedActionFingerprintSha256: string;
  confirmedByPrincipalId: string;
  acknowledgedEffect: string;
  idempotencyKey: string;
}

export interface RecordPreparedActionHandoffCommand {
  workspaceId: string;
  preparedAction: Readonly<{ id: PreparedActionId; version: number }>;
  result: Readonly<PreparedActionHandoffResult>;
  idempotencyKey: string;
}

export interface PreparedActionHandoffAuthority {
  perform(
    action: Readonly<PreparedAction>,
    plan: Readonly<PreparedActionPlan>,
    confirmation: Readonly<PreparedActionConfirmation>,
    idempotencyKey: string
  ): Promise<Readonly<PreparedActionHandoffResult>>;
}

type Row = Record<string, unknown>;
type CommandType = 'PREPARE_ACTION' | 'CONFIRM_ACTION' | 'RECORD_HANDOFF_RESULT';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new PreparedActionJourneyError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned) throw new PreparedActionJourneyError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new PreparedActionJourneyError(
      'INVALID_INPUT',
      `${field} exceeds the allowed length.`,
      422
    );
  return cleaned;
}

function exactVersion(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1)
    throw new PreparedActionJourneyError(
      'INVALID_INPUT',
      `${field} must be a positive integer.`,
      422
    );
  return value;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!SHA256.test(cleaned))
    throw new PreparedActionJourneyError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new PreparedActionJourneyError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return parsed.toISOString();
}

function nextPreparedActionId(): PreparedActionId {
  return `prepared-action_${randomUUID().replaceAll('-', '')}`;
}

function rowDocument<T>(row: Row | undefined, field = 'document_json'): T | undefined {
  return row ? clone(row[field] as T) : undefined;
}

function cleanRelationshipModel(value: RelationshipModel): RelationshipModel {
  if (!relationshipModels.includes(value))
    throw new PreparedActionJourneyError('INVALID_INPUT', 'relationshipModel is invalid.', 422);
  return value;
}

function cleanCustomerIntent(value: Readonly<CustomerIntent>, field: string): CustomerIntent {
  if (!value || typeof value !== 'object')
    throw new PreparedActionJourneyError('INVALID_INPUT', `${field} is required.`, 422);
  const targetJurisdictions = value.targetJurisdictions.map((item) =>
    cleanText(item, `${field}.targetJurisdictions`, 120)
  );
  if (!targetJurisdictions.length || targetJurisdictions.length > 50)
    throw new PreparedActionJourneyError(
      'INVALID_INPUT',
      `${field}.targetJurisdictions must contain between one and fifty jurisdictions.`,
      422
    );
  if (new Set(targetJurisdictions).size !== targetJurisdictions.length)
    throw new PreparedActionJourneyError(
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

function normalizePlan(plan: Readonly<PreparedActionPlan>): PreparedActionPlan {
  if (plan.kind === 'PREPARE_CONTENT')
    return {
      kind: plan.kind,
      title: cleanText(plan.title, 'plan.title', 500),
      rationale: cleanText(plan.rationale, 'plan.rationale', 4000)
    };
  if (plan.kind === 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY')
    return {
      kind: plan.kind,
      candidate: {
        id: cleanText(plan.candidate.id, 'plan.candidate.id', 300) as OpportunityCandidateId,
        version: exactVersion(plan.candidate.version, 'plan.candidate.version')
      },
      expectedCandidateFingerprintSha256: exactSha256(
        plan.expectedCandidateFingerprintSha256,
        'plan.expectedCandidateFingerprintSha256'
      ),
      qualificationDecision: {
        id: cleanText(
          plan.qualificationDecision.id,
          'plan.qualificationDecision.id',
          300
        ) as OpportunityQualificationDecisionId,
        version: exactVersion(
          plan.qualificationDecision.version,
          'plan.qualificationDecision.version'
        )
      },
      relationshipModel: cleanRelationshipModel(plan.relationshipModel),
      ...(plan.proposedCustomerIntent
        ? {
            proposedCustomerIntent: cleanCustomerIntent(
              plan.proposedCustomerIntent,
              'plan.proposedCustomerIntent'
            )
          }
        : {})
    };
  return {
    kind: plan.kind,
    formalOpportunity: {
      id: cleanText(
        plan.formalOpportunity.id,
        'plan.formalOpportunity.id',
        300
      ) as FormalTrademarkServiceOpportunityId,
      version: exactVersion(plan.formalOpportunity.version, 'plan.formalOpportunity.version')
    },
    expectedFormalOpportunityFingerprintSha256: exactSha256(
      plan.expectedFormalOpportunityFingerprintSha256,
      'plan.expectedFormalOpportunityFingerprintSha256'
    ),
    relationshipModel: cleanRelationshipModel(plan.relationshipModel),
    customerIntent: cleanCustomerIntent(plan.customerIntent, 'plan.customerIntent')
  };
}

function handoffTarget(plan: Readonly<PreparedActionPlan>): ProductLoopHandoffTarget {
  if (plan.kind === 'PREPARE_CONTENT') return 'LITE_CONTENT_PREPARATION';
  if (plan.kind === 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY')
    return 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY';
  return 'MARKREG_INTAKE';
}

function expectedRecommendationKind(
  plan: Readonly<PreparedActionPlan>
): TodayRecommendation['kind'] {
  if (plan.kind === 'PREPARE_CONTENT') return 'CONTENT_PREPARATION';
  if (plan.kind === 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY') return 'OPPORTUNITY_REVIEW';
  return 'MARKREG_HANDOFF';
}

function actionCopy(
  recommendation: Readonly<TodayRecommendation>,
  plan: Readonly<PreparedActionPlan>
): Readonly<{ summary: string; confirmationEffect: string }> {
  if (plan.kind === 'PREPARE_CONTENT')
    return {
      summary: `Prepare a bounded Lite content-preparation line for “${recommendation.title}”.`,
      confirmationEffect:
        'Create one Lite Content Opportunity from this exact Recommendation. No external publication, customer contact, Order, Matter or filing will occur.'
    };
  if (plan.kind === 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY')
    return {
      summary: `Promote the explicitly qualified trademark-service need into MarkReg for “${recommendation.title}”.`,
      confirmationEffect:
        'Create one MarkReg Formal Trademark Service Opportunity from the exact qualified Candidate. This does not contact the customer or create an Intake, Order, Matter, payment, appointment or filing.'
    };
  return {
    summary: `Prepare the confirmed MarkReg Intake handoff for “${recommendation.title}”.`,
    confirmationEffect:
      'Prepare one MarkReg Intake handoff envelope and mark the Formal Opportunity as handed off. The actual Intake, Order, Matter, payment, appointment and filing remain uncreated.'
  };
}

function actionWithFingerprint(
  value: Omit<PreparedAction, 'preparedActionFingerprintSha256'>
): PreparedAction {
  return { ...value, preparedActionFingerprintSha256: fingerprint(value) };
}

export class PostgresPreparedActionStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly preparedActionId: () => PreparedActionId = nextPreparedActionId
  ) {}

  async prepare(command: Readonly<PrepareActionCommand>): Promise<PreparedActionJourney> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const recommendationId = cleanText(
      command.recommendation.id,
      'recommendation.id',
      300
    ) as TodayRecommendationId;
    const recommendationVersion = exactVersion(
      command.recommendation.version,
      'recommendation.version'
    );
    const expectedRecommendationFingerprintSha256 = exactSha256(
      command.expectedRecommendationFingerprintSha256,
      'expectedRecommendationFingerprintSha256'
    );
    const plan = normalizePlan(command.plan);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      recommendationId,
      recommendationVersion,
      expectedRecommendationFingerprintSha256,
      plan
    });

    return this.command<PreparedActionJourney>(
      workspaceId,
      idempotencyKey,
      'PREPARE_ACTION',
      requestFingerprintSha256,
      async (client) => {
        await this.resourceLock(
          client,
          `${workspaceId}:${recommendationId}:${recommendationVersion}:prepared-action`
        );
        const recommendation = await this.recommendation(
          client,
          workspaceId,
          recommendationId,
          recommendationVersion
        );
        if (
          recommendation.recommendationFingerprintSha256 !== expectedRecommendationFingerprintSha256
        )
          throw new PreparedActionJourneyError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Today Recommendation fingerprint no longer matches the Prepared Action request.'
          );
        if (recommendation.status !== 'OPEN')
          throw new PreparedActionJourneyError(
            'STALE_SOURCE',
            'Only an OPEN Today Recommendation can prepare a new action.'
          );
        if (recommendation.kind !== expectedRecommendationKind(plan))
          throw new PreparedActionJourneyError(
            'POLICY_DENIED',
            'Prepared Action kind does not match the Today Recommendation kind.',
            422
          );
        this.assertPlanSource(recommendation, plan);
        const existing = await client.query(
          'SELECT document_json FROM lite_prepared_actions WHERE workspace_id=$1 AND recommendation_id=$2 AND recommendation_version=$3 LIMIT 1',
          [workspaceId, recommendationId, recommendationVersion]
        );
        if (existing.rowCount)
          throw new PreparedActionJourneyError(
            'VERSION_CONFLICT',
            'This exact Today Recommendation already has a Prepared Action.'
          );
        const createdAt = exactTimestamp(this.now(), 'now');
        const copy = actionCopy(recommendation, plan);
        const action = actionWithFingerprint({
          schemaVersion: 1,
          preparedActionId: this.preparedActionId(),
          workspaceId,
          version: 1,
          recommendation: { id: recommendationId, version: recommendationVersion },
          recommendationFingerprintSha256: expectedRecommendationFingerprintSha256,
          kind: plan.kind,
          summary: copy.summary,
          confirmationEffect: copy.confirmationEffect,
          handoffTarget: handoffTarget(plan),
          sources: recommendation.sources,
          confirmationRequired: true,
          executionAuthorized: false,
          createdAt,
          updatedAt: createdAt
        });
        await client.query(
          'INSERT INTO lite_prepared_actions (workspace_id,prepared_action_id,version,recommendation_id,recommendation_version,recommendation_fingerprint_sha256,kind,handoff_target,prepared_action_fingerprint_sha256,plan_json,document_json,created_at,updated_at) VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$11)',
          [
            workspaceId,
            action.preparedActionId,
            recommendationId,
            recommendationVersion,
            expectedRecommendationFingerprintSha256,
            action.kind,
            action.handoffTarget,
            action.preparedActionFingerprintSha256,
            JSON.stringify(plan),
            JSON.stringify(action),
            createdAt
          ]
        );
        return {
          schemaVersion: 1,
          preparedAction: action,
          handoffState: 'AWAITING_CONFIRMATION'
        };
      }
    );
  }

  async confirm(command: Readonly<ConfirmPreparedActionCommand>): Promise<PreparedActionJourney> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const actionId = cleanText(
      command.preparedAction.id,
      'preparedAction.id',
      300
    ) as PreparedActionId;
    const actionVersion = exactVersion(command.preparedAction.version, 'preparedAction.version');
    if (actionVersion !== 1)
      throw new PreparedActionJourneyError(
        'INVALID_INPUT',
        'Prepared Action version must be 1.',
        422
      );
    const expectedFingerprint = exactSha256(
      command.expectedPreparedActionFingerprintSha256,
      'expectedPreparedActionFingerprintSha256'
    );
    const confirmedByPrincipalId = cleanText(
      command.confirmedByPrincipalId,
      'confirmedByPrincipalId',
      300
    );
    const acknowledgedEffect = cleanText(command.acknowledgedEffect, 'acknowledgedEffect', 4000);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      actionId,
      actionVersion,
      expectedFingerprint,
      confirmedByPrincipalId,
      acknowledgedEffect
    });

    return this.command<PreparedActionJourney>(
      workspaceId,
      idempotencyKey,
      'CONFIRM_ACTION',
      requestFingerprintSha256,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:${actionId}:confirmation`);
        const action = await this.action(client, workspaceId, actionId, 1);
        if (action.preparedActionFingerprintSha256 !== expectedFingerprint)
          throw new PreparedActionJourneyError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Prepared Action fingerprint no longer matches the confirmation.'
          );
        if (action.confirmationEffect !== acknowledgedEffect)
          throw new PreparedActionJourneyError(
            'CONFIRMATION_REQUIRED',
            'The user acknowledgement must exactly match the current confirmation effect.',
            422
          );
        const existing = await client.query(
          'SELECT document_json FROM lite_prepared_action_confirmations WHERE workspace_id=$1 AND prepared_action_id=$2 AND prepared_action_version=1',
          [workspaceId, actionId]
        );
        if (existing.rowCount) {
          const prior = rowDocument<PreparedActionConfirmation>(existing.rows[0] as Row)!;
          if (
            prior.expectedPreparedActionFingerprintSha256 !== expectedFingerprint ||
            prior.confirmedByPrincipalId !== confirmedByPrincipalId ||
            prior.acknowledgedEffect !== acknowledgedEffect
          )
            throw new PreparedActionJourneyError(
              'VERSION_CONFLICT',
              'Prepared Action was already confirmed with different evidence.'
            );
          return this.journey(client, workspaceId, action);
        }
        const confirmedAt = exactTimestamp(this.now(), 'now');
        const confirmation: PreparedActionConfirmation = {
          schemaVersion: 1,
          preparedAction: { id: actionId, version: 1 },
          expectedPreparedActionFingerprintSha256: expectedFingerprint,
          confirmedByPrincipalId,
          confirmedAt,
          acknowledgedEffect,
          protectedActionAuthorized: false
        };
        await client.query(
          'INSERT INTO lite_prepared_action_confirmations (workspace_id,prepared_action_id,prepared_action_version,expected_prepared_action_fingerprint_sha256,confirmed_by_principal_id,acknowledged_effect,document_json,confirmed_at) VALUES ($1,$2,1,$3,$4,$5,$6::jsonb,$7)',
          [
            workspaceId,
            actionId,
            expectedFingerprint,
            confirmedByPrincipalId,
            acknowledgedEffect,
            JSON.stringify(confirmation),
            confirmedAt
          ]
        );
        return {
          schemaVersion: 1,
          preparedAction: action,
          confirmation,
          handoffState: 'HANDOFF_PENDING'
        };
      }
    );
  }

  async recordHandoff(
    command: Readonly<RecordPreparedActionHandoffCommand>
  ): Promise<PreparedActionJourney> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const actionId = cleanText(
      command.preparedAction.id,
      'preparedAction.id',
      300
    ) as PreparedActionId;
    const actionVersion = exactVersion(command.preparedAction.version, 'preparedAction.version');
    if (actionVersion !== 1)
      throw new PreparedActionJourneyError(
        'INVALID_INPUT',
        'Prepared Action version must be 1.',
        422
      );
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const result = clone(command.result);
    const requestFingerprintSha256 = fingerprint({ workspaceId, actionId, actionVersion, result });

    return this.command<PreparedActionJourney>(
      workspaceId,
      idempotencyKey,
      'RECORD_HANDOFF_RESULT',
      requestFingerprintSha256,
      async (client) => {
        await this.resourceLock(client, `${workspaceId}:${actionId}:handoff-result`);
        const action = await this.action(client, workspaceId, actionId, 1);
        const confirmation = await this.confirmation(client, workspaceId, actionId);
        if (!confirmation)
          throw new PreparedActionJourneyError(
            'CONFIRMATION_REQUIRED',
            'Prepared Action must be explicitly confirmed before handoff evidence can be recorded.',
            422
          );
        if (
          result.preparedAction.id !== actionId ||
          Number(result.preparedAction.version) !== 1 ||
          result.target !== action.handoffTarget ||
          result.consequences.externalPublishExecuted ||
          result.consequences.customerContactedAutomatically ||
          result.consequences.formalOpportunityCreatedAutomatically ||
          result.consequences.orderCreatedAutomatically ||
          result.consequences.matterCreatedAutomatically ||
          result.consequences.paymentCreated ||
          result.consequences.providerAppointed ||
          result.consequences.filingSubmitted ||
          result.consequences.officialTruthCreated
        )
          throw new PreparedActionJourneyError(
            'POLICY_DENIED',
            'Owner handoff result claims a consequence outside the Prepared Action boundary.',
            422
          );
        const existing = await client.query(
          'SELECT document_json FROM lite_prepared_action_handoff_results WHERE workspace_id=$1 AND prepared_action_id=$2 AND prepared_action_version=1',
          [workspaceId, actionId]
        );
        if (existing.rowCount) {
          const prior = rowDocument<PreparedActionHandoffResult>(existing.rows[0] as Row)!;
          if (fingerprint(prior) !== fingerprint(result))
            throw new PreparedActionJourneyError(
              'VERSION_CONFLICT',
              'Prepared Action already has different owner handoff evidence.'
            );
          return this.journey(client, workspaceId, action);
        }
        await client.query(
          'INSERT INTO lite_prepared_action_handoff_results (workspace_id,prepared_action_id,prepared_action_version,handoff_target,owner,owner_record_id,owner_record_version,document_json,completed_at) VALUES ($1,$2,1,$3,$4,$5,$6,$7::jsonb,$8)',
          [
            workspaceId,
            actionId,
            result.target,
            result.owner,
            result.ownerRecord.id,
            String(result.ownerRecord.version),
            JSON.stringify(result),
            exactTimestamp(result.completedAt, 'result.completedAt')
          ]
        );
        return {
          schemaVersion: 1,
          preparedAction: action,
          confirmation,
          handoffState: 'HANDOFF_COMPLETED',
          handoffResult: result
        };
      }
    );
  }

  async findJourney(
    workspaceIdValue: string,
    actionId: PreparedActionId
  ): Promise<PreparedActionJourney | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json,plan_json FROM lite_prepared_actions WHERE workspace_id=$1 AND prepared_action_id=$2 AND version=1',
      [workspaceId, actionId]
    );
    const action = rowDocument<PreparedAction>(result.rows[0] as Row | undefined);
    if (!action) return undefined;
    return this.journey(this.query, workspaceId, action);
  }

  async planFor(
    workspaceIdValue: string,
    actionId: PreparedActionId
  ): Promise<PreparedActionPlan | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT plan_json FROM lite_prepared_actions WHERE workspace_id=$1 AND prepared_action_id=$2 AND version=1',
      [workspaceId, actionId]
    );
    return rowDocument<PreparedActionPlan>(result.rows[0] as Row | undefined, 'plan_json');
  }

  async listToday(workspaceIdValue: string): Promise<LiteTodaySnapshot> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    try {
      const recommendations = await this.query.query(
        "SELECT document_json FROM lite_today_recommendations WHERE workspace_id=$1 AND (document_json->>'status') IN ('OPEN','ACKNOWLEDGED') ORDER BY updated_at DESC,today_recommendation_id ASC LIMIT 50",
        [workspaceId]
      );
      const items = await Promise.all(
        recommendations.rows.map(async (row) => {
          const recommendation = rowDocument<TodayRecommendation>(row as Row)!;
          const actions = await this.query.query(
            'SELECT document_json FROM lite_prepared_actions WHERE workspace_id=$1 AND recommendation_id=$2 AND recommendation_version=$3 ORDER BY created_at ASC',
            [workspaceId, recommendation.todayRecommendationId, recommendation.version]
          );
          const preparedActions = await Promise.all(
            actions.rows.map((actionRow) =>
              this.journey(
                this.query,
                workspaceId,
                rowDocument<PreparedAction>(actionRow as Row) as PreparedAction
              )
            )
          );
          return { recommendation, preparedActions };
        })
      );
      return {
        schemaVersion: 1,
        workspaceId,
        generatedAt: exactTimestamp(this.now(), 'now'),
        items,
        partial: false,
        warnings: []
      };
    } catch (error) {
      if (error instanceof PreparedActionJourneyError) throw error;
      throw new PreparedActionJourneyError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Today persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  private assertPlanSource(
    recommendation: Readonly<TodayRecommendation>,
    plan: Readonly<PreparedActionPlan>
  ): void {
    if (plan.kind === 'PREPARE_CONTENT') return;
    if (plan.kind === 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY') {
      const exactCandidate = recommendation.sources.some(
        (source) =>
          source.owner === 'LITE' &&
          source.sourceId === plan.candidate.id &&
          Number(source.sourceVersion) === plan.candidate.version &&
          source.sourceFingerprintSha256 === plan.expectedCandidateFingerprintSha256
      );
      if (!exactCandidate)
        throw new PreparedActionJourneyError(
          'STALE_SOURCE',
          'Today Recommendation does not carry the exact qualified Candidate source.'
        );
      return;
    }
    const exactOpportunity = recommendation.sources.some(
      (source) =>
        source.owner === 'MARKREG' &&
        source.sourceId === plan.formalOpportunity.id &&
        Number(source.sourceVersion) === plan.formalOpportunity.version &&
        source.sourceFingerprintSha256 === plan.expectedFormalOpportunityFingerprintSha256
    );
    if (!exactOpportunity)
      throw new PreparedActionJourneyError(
        'STALE_SOURCE',
        'Today Recommendation does not carry the exact Formal Opportunity source.'
      );
  }

  private async recommendation(
    client: QueryClient,
    workspaceId: string,
    recommendationId: TodayRecommendationId,
    version: number
  ): Promise<TodayRecommendation> {
    const result = await client.query(
      'SELECT document_json FROM lite_today_recommendations WHERE workspace_id=$1 AND today_recommendation_id=$2 AND version=$3',
      [workspaceId, recommendationId, version]
    );
    const value = rowDocument<TodayRecommendation>(result.rows[0] as Row | undefined);
    if (!value)
      throw new PreparedActionJourneyError('NOT_FOUND', 'Today Recommendation was not found.', 404);
    return value;
  }

  private async action(
    client: QueryClient,
    workspaceId: string,
    actionId: PreparedActionId,
    version: number
  ): Promise<PreparedAction> {
    const result = await client.query(
      'SELECT document_json FROM lite_prepared_actions WHERE workspace_id=$1 AND prepared_action_id=$2 AND version=$3',
      [workspaceId, actionId, version]
    );
    const value = rowDocument<PreparedAction>(result.rows[0] as Row | undefined);
    if (!value)
      throw new PreparedActionJourneyError('NOT_FOUND', 'Prepared Action was not found.', 404);
    return value;
  }

  private async confirmation(
    client: QueryClient,
    workspaceId: string,
    actionId: PreparedActionId
  ): Promise<PreparedActionConfirmation | undefined> {
    const result = await client.query(
      'SELECT document_json FROM lite_prepared_action_confirmations WHERE workspace_id=$1 AND prepared_action_id=$2 AND prepared_action_version=1',
      [workspaceId, actionId]
    );
    return rowDocument<PreparedActionConfirmation>(result.rows[0] as Row | undefined);
  }

  private async handoffResult(
    client: QueryClient,
    workspaceId: string,
    actionId: PreparedActionId
  ): Promise<PreparedActionHandoffResult | undefined> {
    const result = await client.query(
      'SELECT document_json FROM lite_prepared_action_handoff_results WHERE workspace_id=$1 AND prepared_action_id=$2 AND prepared_action_version=1',
      [workspaceId, actionId]
    );
    return rowDocument<PreparedActionHandoffResult>(result.rows[0] as Row | undefined);
  }

  private async journey(
    client: QueryClient,
    workspaceId: string,
    action: PreparedAction
  ): Promise<PreparedActionJourney> {
    const [confirmation, handoffResult] = await Promise.all([
      this.confirmation(client, workspaceId, action.preparedActionId),
      this.handoffResult(client, workspaceId, action.preparedActionId)
    ]);
    return {
      schemaVersion: 1,
      preparedAction: action,
      ...(confirmation ? { confirmation } : {}),
      handoffState: handoffResult
        ? 'HANDOFF_COMPLETED'
        : confirmation
          ? 'HANDOFF_PENDING'
          : 'AWAITING_CONFIRMATION',
      ...(handoffResult ? { handoffResult } : {})
    };
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
          `${workspaceId}:prepared-action-idempotency:${idempotencyKey}`
        );
        const replay = await client.query(
          'SELECT command_type,request_fingerprint_sha256,result_json FROM lite_prepared_action_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (
            String(prior.command_type) !== commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprintSha256
          )
            throw new PreparedActionJourneyError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Prepared Action command.'
            );
          return rowDocument<T>(prior, 'result_json') as T;
        }
        const result = await write(client);
        await client.query(
          'INSERT INTO lite_prepared_action_commands (workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
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
      if (error instanceof PreparedActionJourneyError) throw error;
      throw new PreparedActionJourneyError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Prepared Action persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  private async resourceLock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }
}

export class PreparedActionJourneyService {
  constructor(
    private readonly store: PostgresPreparedActionStore,
    private readonly handoffAuthority: PreparedActionHandoffAuthority
  ) {}

  listToday(workspaceId: string): Promise<LiteTodaySnapshot> {
    return this.store.listToday(workspaceId);
  }

  findJourney(
    workspaceId: string,
    preparedActionId: PreparedActionId
  ): Promise<PreparedActionJourney | undefined> {
    return this.store.findJourney(workspaceId, preparedActionId);
  }

  prepare(command: Readonly<PrepareActionCommand>): Promise<PreparedActionJourney> {
    return this.store.prepare(command);
  }

  async confirmAndHandoff(
    command: Readonly<ConfirmPreparedActionCommand>
  ): Promise<PreparedActionJourney> {
    const confirmed = await this.store.confirm(command);
    const current = await this.store.findJourney(command.workspaceId, command.preparedAction.id);
    if (current?.handoffState === 'HANDOFF_COMPLETED') return current;
    const journey = current ?? confirmed;
    const plan = await this.store.planFor(command.workspaceId, command.preparedAction.id);
    if (!plan)
      throw new PreparedActionJourneyError(
        'NOT_FOUND',
        'Prepared Action handoff plan was not found.',
        404
      );
    const confirmation = journey.confirmation;
    if (!confirmation)
      throw new PreparedActionJourneyError(
        'CONFIRMATION_REQUIRED',
        'Prepared Action confirmation was not persisted.',
        422
      );
    let result: Readonly<PreparedActionHandoffResult>;
    try {
      result = await this.handoffAuthority.perform(
        journey.preparedAction,
        plan,
        confirmation,
        `prepared-action-handoff:${journey.preparedAction.preparedActionId}`
      );
    } catch (error) {
      if (error instanceof PreparedActionJourneyError) throw error;
      throw new PreparedActionJourneyError(
        'DEPENDENCY_UNAVAILABLE',
        'Prepared Action is confirmed but the owning handoff is temporarily unavailable.',
        503,
        { confirmationPersisted: true, handoffPending: true },
        { cause: error instanceof Error ? error : undefined }
      );
    }
    return this.store.recordHandoff({
      workspaceId: command.workspaceId,
      preparedAction: command.preparedAction,
      result,
      idempotencyKey: `record:${command.idempotencyKey}`
    });
  }
}

export function handoffResult(input: {
  preparedAction: PreparedAction;
  owner: 'LITE' | 'MARKREG';
  ownerRecord: Readonly<{ id: string; version: number | string }>;
  completedAt: string;
}): PreparedActionHandoffResult {
  return {
    schemaVersion: 1,
    preparedAction: {
      id: input.preparedAction.preparedActionId,
      version: input.preparedAction.version
    },
    target: input.preparedAction.handoffTarget,
    owner: input.owner,
    ownerRecord: clone(input.ownerRecord),
    completedAt: exactTimestamp(input.completedAt, 'completedAt'),
    consequences: noAutomaticProductLoopConsequences
  };
}
