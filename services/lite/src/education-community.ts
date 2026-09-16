import { createHash, randomUUID } from 'node:crypto';
import {
  educationCommunityCohortFingerprintSha256V1,
  educationCommunityJourneyFingerprintSha256V1,
  educationCommunityWorkspaceActivationFingerprintSha256V1,
  noEducationCommunityAuthorityConsequencesV1,
  parseEducationCommunityCohortV1,
  parseEducationCommunityJourneyV1,
  type EducationCommunityCohortIdV1,
  type EducationCommunityCohortV1,
  type EducationCommunityJourneyIdV1,
  type EducationCommunityJourneyV1,
  type EducationCommunityProductActionReferenceV1,
  type EducationCommunityWorkspaceActivationReferenceV1
} from '@markorbit/contracts/education-community';
import type { BusinessAttributionReferenceV1 } from '@markorbit/contracts/business-attribution';
import type {
  OutboundContactPolicyReferenceV1,
  OutboundContactReadinessV1
} from '@markorbit/contracts/outbound-contact-policy';
import { parseLiteWorkItemV1, type LiteWorkItemId } from '@markorbit/contracts/lite-work-item';
import type { QueryClient } from '@markorbit/persistence';
import type { CreateBusinessAttributionLinkCommand } from './business-attribution.js';
import type { LiteTransactionHost } from './content-preparation.js';
import type { EvaluateOutboundContactReadinessCommand } from './outbound-contact-policy.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
type Row = Record<string, unknown>;
type CommandType =
  | 'CREATE_COHORT'
  | 'REGISTER_PARTICIPANT'
  | 'PREPARE_INVITATION'
  | 'ACTIVATE_WORKSPACE'
  | 'RECORD_FIRST_VALUE'
  | 'RECORD_RETAINED_USE';

export type EducationCommunityErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'INVITATION_BLOCKED'
  | 'LINEAGE_MISMATCH'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class EducationCommunityError extends Error {
  constructor(
    readonly code: EducationCommunityErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'EducationCommunityError';
  }
}

export interface EducationCommunityOutboundPolicy {
  evaluate(
    command: Readonly<EvaluateOutboundContactReadinessCommand>
  ): Promise<OutboundContactReadinessV1>;
}
export interface EducationCommunityAttributionStore {
  create(command: Readonly<CreateBusinessAttributionLinkCommand>): Promise<{
    businessAttributionLinkId: `business-attribution_${string}`;
    version: 1;
    businessAttributionFingerprintSha256: string;
  }>;
}
export interface EducationCommunityWorkspaceReader {
  resolve(workspaceId: string): Promise<EducationCommunityWorkspaceActivationReferenceV1>;
}

export interface CreateEducationCommunityCohortCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  name: string;
  source: Readonly<BusinessAttributionReferenceV1>;
}
export interface RegisterEducationCommunityParticipantCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  cohortId: EducationCommunityCohortIdV1;
  participantRef: string;
  endpointFingerprintSha256: string;
}
export interface PrepareEducationCommunityInvitationCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  journeyId: EducationCommunityJourneyIdV1;
  expectedVersion: number;
  invitationClaimToken: string;
  policyRef: Readonly<OutboundContactPolicyReferenceV1>;
  reviewedSendFingerprintSha256: string;
}
export interface ActivateEducationCommunityWorkspaceCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  invitationClaimToken: string;
}
export interface RecordEducationCommunityActionCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  journeyId: EducationCommunityJourneyIdV1;
  expectedVersion: number;
  workItem: Readonly<{ id: LiteWorkItemId; version: number; fingerprintSha256: string }>;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}
function hash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
function tokenHash(value: string): string {
  return createHash('sha256')
    .update(text(value, 'invitationClaimToken', 500))
    .digest('hex');
}
function workspace(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID.test(normalized))
    throw new EducationCommunityError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return normalized;
}
function text(value: string, field: string, maximum = 300): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new EducationCommunityError('INVALID_INPUT', `${field} is invalid.`, 422);
  return normalized;
}
function opaque(value: string, field: string): string {
  const normalized = text(value, field, 240);
  if (normalized.includes('@'))
    throw new EducationCommunityError(
      'INVALID_INPUT',
      `${field} must be opaque, not raw attendee data.`,
      422
    );
  return normalized;
}
function sha(value: string, field: string): string {
  const normalized = text(value, field, 64);
  if (!SHA256.test(normalized))
    throw new EducationCommunityError('INVALID_INPUT', `${field} must be lowercase SHA-256.`, 422);
  return normalized;
}
function version(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new EducationCommunityError('INVALID_INPUT', `${field} must be a positive integer.`, 422);
  return value;
}
function at(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()))
    throw new EducationCommunityError('INVALID_INPUT', 'Timestamp is invalid.', 422);
  return parsed.toISOString();
}
function persistedCohort(value: unknown, expectedWorkspace?: string): EducationCommunityCohortV1 {
  try {
    const result = parseEducationCommunityCohortV1(value);
    if (expectedWorkspace && result.workspaceId.toLowerCase() !== expectedWorkspace)
      throw new Error('workspace');
    return result;
  } catch (error) {
    throw new EducationCommunityError(
      'INTEGRITY_FAILURE',
      'Persisted education cohort failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
function persistedJourney(value: unknown): EducationCommunityJourneyV1 {
  try {
    return parseEducationCommunityJourneyV1(value);
  } catch (error) {
    throw new EducationCommunityError(
      'INTEGRITY_FAILURE',
      'Persisted education journey failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

export class PostgresEducationCommunityWorkItemReader {
  constructor(private readonly query: QueryClient) {}

  async resolve(
    workspaceIdValue: string,
    reference: Readonly<{ id: LiteWorkItemId; version: number; fingerprintSha256: string }>
  ): Promise<EducationCommunityProductActionReferenceV1> {
    const workspaceId = workspace(workspaceIdValue);
    try {
      const result = await this.query.query(
        'SELECT document_json FROM lite_work_items WHERE workspace_id=$1 AND lite_work_item_id=$2',
        [workspaceId, text(reference.id, 'workItem.id')]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row)
        throw new EducationCommunityError('NOT_FOUND', 'Exact Lite Work Item was not found.', 404);
      const item = parseLiteWorkItemV1(row.document_json, workspaceId);
      const fingerprint = hash(item);
      if (
        item.version !== version(reference.version, 'workItem.version') ||
        fingerprint !== sha(reference.fingerprintSha256, 'workItem.fingerprintSha256')
      )
        throw new EducationCommunityError(
          'LINEAGE_MISMATCH',
          'Lite Work Item exact reference no longer matches.',
          409
        );
      return {
        owner: 'LITE',
        kind: 'LITE_WORK_ITEM',
        id: item.liteWorkItemId,
        version: item.version,
        fingerprintSha256: fingerprint,
        observedAt: item.createdAt
      };
    } catch (error) {
      if (error instanceof EducationCommunityError) throw error;
      throw new EducationCommunityError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Work Item evidence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export class HttpCoreEducationCommunityWorkspaceReader implements EducationCommunityWorkspaceReader {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async resolve(
    workspaceIdValue: string
  ): Promise<EducationCommunityWorkspaceActivationReferenceV1> {
    const workspaceId = workspace(workspaceIdValue);
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.coreUrl.replace(/\/$/u, '')}/internal/identity/workspaces/${encodeURIComponent(workspaceId)}`,
        {
          headers: { 'x-markorbit-internal-authorization': this.internalServiceSecret },
          signal: AbortSignal.timeout(3000)
        }
      );
    } catch (error) {
      throw new EducationCommunityError(
        'PERSISTENCE_UNAVAILABLE',
        'Core Workspace activation evidence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    if (response.status === 404)
      throw new EducationCommunityError('NOT_FOUND', 'Core Workspace was not found.', 404);
    if (!response.ok)
      throw new EducationCommunityError(
        'PERSISTENCE_UNAVAILABLE',
        'Core Workspace activation evidence is unavailable.',
        503,
        true
      );
    const body = (await response.json()) as { workspace?: Record<string, unknown> };
    const value = body.workspace;
    if (
      !value ||
      value.owner !== 'CORE' ||
      value.kind !== 'WORKSPACE_ACTIVATION' ||
      value.workspaceId !== workspaceId ||
      value.status !== 'ACTIVE'
    )
      throw new EducationCommunityError(
        'LINEAGE_MISMATCH',
        'Core Workspace is not an active activation reference.',
        409
      );
    const referenceWithoutFingerprint = {
      owner: 'CORE' as const,
      kind: 'WORKSPACE_ACTIVATION' as const,
      id: workspaceId,
      version: version(Number(value.version), 'workspace.version'),
      observedAt: at(String(value.observedAt))
    };
    const fingerprint = sha(String(value.fingerprintSha256), 'workspace.fingerprintSha256');
    if (
      fingerprint !==
      educationCommunityWorkspaceActivationFingerprintSha256V1(referenceWithoutFingerprint)
    )
      throw new EducationCommunityError(
        'LINEAGE_MISMATCH',
        'Core Workspace activation fingerprint does not match its exact reference.',
        409
      );
    return { ...referenceWithoutFingerprint, fingerprintSha256: fingerprint };
  }
}

export class EducationCommunityService {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly outbound: EducationCommunityOutboundPolicy,
    private readonly workItems: PostgresEducationCommunityWorkItemReader,
    private readonly workspaces: EducationCommunityWorkspaceReader,
    private readonly attribution: EducationCommunityAttributionStore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => randomUUID().replaceAll('-', '')
  ) {}

  async createCohort(command: Readonly<CreateEducationCommunityCohortCommand>) {
    const workspaceId = workspace(command.workspaceId);
    const actor = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const key = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = hash({ ...command, workspaceId, actorPrincipalId: actor });
    return this.command(workspaceId, key, 'CREATE_COHORT', requestFingerprint, async (client) => {
      const createdAt = at(this.now());
      const base: Omit<EducationCommunityCohortV1, 'cohortFingerprintSha256'> = {
        schemaVersion: 1 as const,
        educationCommunityCohortId: `education-cohort_${this.id()}`,
        workspaceId,
        version: 1 as const,
        name: text(command.name, 'name', 160),
        source: command.source,
        retentionWindowDays: 7 as const,
        status: 'ACTIVE' as const,
        createdByPrincipalId: actor,
        createdAt,
        authorityConsequences: noEducationCommunityAuthorityConsequencesV1
      };
      const value = parseEducationCommunityCohortV1({
        ...base,
        cohortFingerprintSha256: educationCommunityCohortFingerprintSha256V1(base)
      });
      await client.query(
        `INSERT INTO lite_education_community_cohorts(education_community_cohort_id,workspace_id,version,status,cohort_fingerprint_sha256,document_json,created_at) VALUES($1,$2,1,'ACTIVE',$3,$4::jsonb,$5)`,
        [
          value.educationCommunityCohortId,
          workspaceId,
          value.cohortFingerprintSha256,
          JSON.stringify(value),
          value.createdAt
        ]
      );
      return value;
    });
  }

  async register(command: Readonly<RegisterEducationCommunityParticipantCommand>) {
    const workspaceId = workspace(command.workspaceId);
    const actor = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const key = text(command.idempotencyKey, 'idempotencyKey');
    const participantRef = opaque(command.participantRef, 'participantRef');
    const endpoint = sha(command.endpointFingerprintSha256, 'endpointFingerprintSha256');
    const requestFingerprint = hash({
      ...command,
      workspaceId,
      actorPrincipalId: actor,
      participantRef,
      endpointFingerprintSha256: endpoint
    });
    return this.command(
      workspaceId,
      key,
      'REGISTER_PARTICIPANT',
      requestFingerprint,
      async (client) => {
        const cohort = await this.cohort(client, workspaceId, command.cohortId);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:${cohort.educationCommunityCohortId}:registration`
        ]);
        const count = await client.query(
          'SELECT count(*)::int AS total FROM lite_education_community_journey_heads WHERE campaign_workspace_id=$1 AND education_community_cohort_id=$2',
          [workspaceId, cohort.educationCommunityCohortId]
        );
        if (Number((count.rows[0] as Row).total) >= 100)
          throw new EducationCommunityError(
            'INVALID_TRANSITION',
            'Education/community cohort is bounded to 100 participants.',
            409
          );
        const registeredAt = at(this.now());
        const base: Omit<EducationCommunityJourneyV1, 'journeyFingerprintSha256'> = {
          schemaVersion: 1 as const,
          educationCommunityJourneyId: `education-journey_${this.id()}`,
          cohort: {
            id: cohort.educationCommunityCohortId,
            version: 1 as const,
            fingerprintSha256: cohort.cohortFingerprintSha256
          },
          campaignWorkspaceId: workspaceId,
          version: 1,
          stage: 'REGISTERED' as const,
          participantRef,
          endpointFingerprintSha256: endpoint,
          registeredAt,
          updatedByPrincipalId: actor,
          updatedAt: registeredAt,
          authorityConsequences: noEducationCommunityAuthorityConsequencesV1
        };
        const value = this.withFingerprint(base);
        await this.insertJourney(client, value);
        await client.query(
          `INSERT INTO lite_education_community_journey_heads(education_community_journey_id,education_community_cohort_id,campaign_workspace_id,activated_workspace_id,latest_version,stage,claim_fingerprint_sha256,updated_at) VALUES($1,$2,$3,NULL,1,'REGISTERED',NULL,$4)`,
          [
            value.educationCommunityJourneyId,
            cohort.educationCommunityCohortId,
            workspaceId,
            value.updatedAt
          ]
        );
        return value;
      }
    );
  }

  async prepareInvitation(command: Readonly<PrepareEducationCommunityInvitationCommand>) {
    const workspaceId = workspace(command.workspaceId);
    const actor = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const key = text(command.idempotencyKey, 'idempotencyKey');
    const claimFingerprint = tokenHash(command.invitationClaimToken);
    const requestFingerprint = hash({
      ...command,
      invitationClaimToken: claimFingerprint,
      workspaceId,
      actorPrincipalId: actor
    });
    return this.command(
      workspaceId,
      key,
      'PREPARE_INVITATION',
      requestFingerprint,
      async (client) => {
        await this.lockJourney(client, command.journeyId);
        const current = await this.journey(client, command.journeyId);
        this.requireScope(current, workspaceId, 'campaign');
        this.requireStage(current, 'REGISTERED', command.expectedVersion);
        const readiness = await this.outbound.evaluate({
          workspaceId,
          actorPrincipalId: actor,
          targetRef: {
            owner: 'LITE',
            kind: 'EDUCATION_COMMUNITY_PARTICIPANT',
            id: current.educationCommunityJourneyId,
            version: current.version
          },
          endpointFingerprintSha256: current.endpointFingerprintSha256,
          purpose: 'EDUCATION_INVITATION',
          policyRef: command.policyRef,
          reviewedSendFingerprintSha256: sha(
            command.reviewedSendFingerprintSha256,
            'reviewedSendFingerprintSha256'
          )
        });
        if (readiness.outcome !== 'READY_FOR_HUMAN_SEND')
          throw new EducationCommunityError(
            'INVITATION_BLOCKED',
            'A separate current allowed basis and no active suppression are required for invitation review.',
            409
          );
        const preparedAt = at(this.now());
        const next = this.withFingerprint({
          ...this.withoutFingerprint(current),
          version: 2,
          stage: 'INVITATION_PREPARED' as const,
          invitation: { claimFingerprintSha256: claimFingerprint, readiness, preparedAt },
          updatedByPrincipalId: actor,
          updatedAt: preparedAt
        });
        await this.advance(client, current, next, { claimFingerprint });
        return next;
      }
    );
  }

  async activate(command: Readonly<ActivateEducationCommunityWorkspaceCommand>) {
    const workspaceId = workspace(command.workspaceId);
    const actor = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const key = text(command.idempotencyKey, 'idempotencyKey');
    const claimFingerprint = tokenHash(command.invitationClaimToken);
    const requestFingerprint = hash({
      ...command,
      invitationClaimToken: claimFingerprint,
      workspaceId,
      actorPrincipalId: actor
    });
    return this.command(
      workspaceId,
      key,
      'ACTIVATE_WORKSPACE',
      requestFingerprint,
      async (client) => {
        const claimed = await this.journeyByClaim(client, claimFingerprint);
        await this.lockJourney(client, claimed.educationCommunityJourneyId);
        const current = await this.journey(client, claimed.educationCommunityJourneyId);
        this.requireStage(current, 'INVITATION_PREPARED', 2);
        const activation = await this.workspaces.resolve(workspaceId);
        const activatedAt = at(this.now());
        const next = this.withFingerprint({
          ...this.withoutFingerprint(current),
          version: 3,
          stage: 'WORKSPACE_ACTIVATED' as const,
          activatedWorkspace: activation,
          updatedByPrincipalId: actor,
          updatedAt: activatedAt
        });
        await this.advance(client, current, next, { activatedWorkspaceId: workspaceId });
        return next;
      }
    );
  }

  async recordFirstValue(command: Readonly<RecordEducationCommunityActionCommand>) {
    const workspaceId = workspace(command.workspaceId);
    const actor = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const key = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = hash({ ...command, workspaceId, actorPrincipalId: actor });
    return this.command(
      workspaceId,
      key,
      'RECORD_FIRST_VALUE',
      requestFingerprint,
      async (client) => {
        await this.lockJourney(client, command.journeyId);
        const current = await this.journey(client, command.journeyId);
        this.requireScope(current, workspaceId, 'activated');
        this.requireStage(current, 'WORKSPACE_ACTIVATED', command.expectedVersion);
        const firstValue = await this.workItems.resolve(workspaceId, command.workItem);
        if (Date.parse(firstValue.observedAt) < Date.parse(current.updatedAt))
          throw new EducationCommunityError(
            'LINEAGE_MISMATCH',
            'First-value action must occur after Workspace activation.',
            409
          );
        const updatedAt = at(this.now());
        const next = this.withFingerprint({
          ...this.withoutFingerprint(current),
          version: 4,
          stage: 'FIRST_VALUE_RECORDED' as const,
          firstValue,
          updatedByPrincipalId: actor,
          updatedAt
        });
        await this.advance(client, current, next);
        return next;
      }
    );
  }

  async recordRetainedUse(command: Readonly<RecordEducationCommunityActionCommand>) {
    const workspaceId = workspace(command.workspaceId);
    const actor = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const key = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = hash({ ...command, workspaceId, actorPrincipalId: actor });
    return this.command(
      workspaceId,
      key,
      'RECORD_RETAINED_USE',
      requestFingerprint,
      async (client) => {
        await this.lockJourney(client, command.journeyId);
        const current = await this.journey(client, command.journeyId);
        this.requireScope(current, workspaceId, 'activated');
        this.requireStage(current, 'FIRST_VALUE_RECORDED', command.expectedVersion);
        const retainedUse = await this.workItems.resolve(workspaceId, command.workItem);
        if (
          retainedUse.id === current.firstValue!.id ||
          Date.parse(retainedUse.observedAt) - Date.parse(current.firstValue!.observedAt) <
            7 * 24 * 60 * 60 * 1000
        )
          throw new EducationCommunityError(
            'INVALID_TRANSITION',
            'Retained use requires a distinct Lite Work Item at least seven days after first value.',
            409
          );
        const cohort = await this.currentCohort(current.campaignWorkspaceId, current.cohort.id);
        const link = await this.attribution.create({
          workspaceId,
          actorPrincipalId: actor,
          idempotencyKey: `education-community:${key}`,
          motionKind: 'EDUCATION_COMMUNITY',
          sourceRefs: [
            cohort.source,
            {
              owner: 'LITE',
              kind: 'EDUCATION_COMMUNITY_COHORT',
              id: cohort.educationCommunityCohortId,
              version: cohort.version,
              fingerprintSha256: cohort.cohortFingerprintSha256,
              observedAt: cohort.createdAt
            }
          ],
          touchpointRefs: [
            {
              owner: 'LITE',
              kind: 'OUTBOUND_CONTACT_READINESS',
              id: current.educationCommunityJourneyId,
              version: 2,
              fingerprintSha256: current.invitation!.readiness.readinessFingerprintSha256,
              observedAt: current.invitation!.readiness.evaluatedAt
            },
            current.activatedWorkspace!,
            current.firstValue!,
            retainedUse
          ],
          downstreamRef: current.activatedWorkspace!,
          attributionState: 'ATTRIBUTED',
          evidenceBasis: 'HUMAN_CONFIRMED',
          evaluatedAt: retainedUse.observedAt
        });
        const updatedAt = at(this.now());
        const next = this.withFingerprint({
          ...this.withoutFingerprint(current),
          version: 5,
          stage: 'RETAINED' as const,
          retainedUse,
          acquisitionAttribution: {
            id: link.businessAttributionLinkId,
            version: 1 as const,
            fingerprintSha256: link.businessAttributionFingerprintSha256
          },
          updatedByPrincipalId: actor,
          updatedAt
        });
        await this.advance(client, current, next);
        return next;
      }
    );
  }

  async current(id: EducationCommunityJourneyIdV1): Promise<EducationCommunityJourneyV1> {
    try {
      return await this.journey(this.query, id);
    } catch (error) {
      if (error instanceof EducationCommunityError) throw error;
      throw this.persistence(error);
    }
  }

  private withFingerprint(
    value: Omit<EducationCommunityJourneyV1, 'journeyFingerprintSha256'>
  ): EducationCommunityJourneyV1 {
    return parseEducationCommunityJourneyV1({
      ...value,
      journeyFingerprintSha256: educationCommunityJourneyFingerprintSha256V1(value)
    });
  }
  private withoutFingerprint(
    value: EducationCommunityJourneyV1
  ): Omit<EducationCommunityJourneyV1, 'journeyFingerprintSha256'> {
    const rest = structuredClone(value);
    Reflect.deleteProperty(rest, 'journeyFingerprintSha256');
    return rest;
  }
  private requireStage(
    current: EducationCommunityJourneyV1,
    stage: EducationCommunityJourneyV1['stage'],
    expectedVersion: number
  ): void {
    if (current.version !== version(expectedVersion, 'expectedVersion') || current.stage !== stage)
      throw new EducationCommunityError(
        'INVALID_TRANSITION',
        `Journey must be ${stage} at the expected version.`,
        409
      );
  }
  private requireScope(
    current: EducationCommunityJourneyV1,
    workspaceId: string,
    scope: 'campaign' | 'activated'
  ): void {
    const expected =
      scope === 'campaign' ? current.campaignWorkspaceId : current.activatedWorkspace?.id;
    if (expected?.toLowerCase() !== workspaceId)
      throw new EducationCommunityError(
        'NOT_FOUND',
        'Education/community journey was not found.',
        404
      );
  }
  private async cohort(query: QueryClient, workspaceId: string, id: EducationCommunityCohortIdV1) {
    const result = await query.query(
      'SELECT document_json FROM lite_education_community_cohorts WHERE workspace_id=$1 AND education_community_cohort_id=$2',
      [workspaceId, text(id, 'cohortId')]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row)
      throw new EducationCommunityError(
        'NOT_FOUND',
        'Education/community cohort was not found.',
        404
      );
    return persistedCohort(row.document_json, workspaceId);
  }
  private async currentCohort(workspaceId: string, id: EducationCommunityCohortIdV1) {
    try {
      return await this.cohort(this.query, workspaceId, id);
    } catch (error) {
      if (error instanceof EducationCommunityError) throw error;
      throw this.persistence(error);
    }
  }
  private async journey(query: QueryClient, id: EducationCommunityJourneyIdV1) {
    const result = await query.query(
      `SELECT v.document_json FROM lite_education_community_journey_heads h JOIN lite_education_community_journey_versions v ON v.education_community_journey_id=h.education_community_journey_id AND v.version=h.latest_version WHERE h.education_community_journey_id=$1`,
      [text(id, 'journeyId')]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row)
      throw new EducationCommunityError(
        'NOT_FOUND',
        'Education/community journey was not found.',
        404
      );
    return persistedJourney(row.document_json);
  }
  private async journeyByClaim(query: QueryClient, claimFingerprint: string) {
    const result = await query.query(
      `SELECT v.document_json FROM lite_education_community_journey_heads h JOIN lite_education_community_journey_versions v ON v.education_community_journey_id=h.education_community_journey_id AND v.version=h.latest_version WHERE h.claim_fingerprint_sha256=$1`,
      [claimFingerprint]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row)
      throw new EducationCommunityError(
        'NOT_FOUND',
        'Education/community invitation was not found.',
        404
      );
    return persistedJourney(row.document_json);
  }
  private lockJourney(query: QueryClient, id: EducationCommunityJourneyIdV1) {
    return query
      .query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `education-community-journey:${id}`
      ])
      .then(() => undefined);
  }
  private insertJourney(query: QueryClient, value: EducationCommunityJourneyV1) {
    return query
      .query(
        `INSERT INTO lite_education_community_journey_versions(education_community_journey_id,version,stage,document_json,journey_fingerprint_sha256,recorded_at) VALUES($1,$2,$3,$4::jsonb,$5,$6)`,
        [
          value.educationCommunityJourneyId,
          value.version,
          value.stage,
          JSON.stringify(value),
          value.journeyFingerprintSha256,
          value.updatedAt
        ]
      )
      .then(() => undefined);
  }
  private async advance(
    query: QueryClient,
    current: EducationCommunityJourneyV1,
    next: EducationCommunityJourneyV1,
    changes: { claimFingerprint?: string; activatedWorkspaceId?: string } = {}
  ) {
    await this.insertJourney(query, next);
    const result = await query.query(
      `UPDATE lite_education_community_journey_heads SET latest_version=$2,stage=$3,claim_fingerprint_sha256=COALESCE($4,claim_fingerprint_sha256),activated_workspace_id=COALESCE($5,activated_workspace_id),updated_at=$6 WHERE education_community_journey_id=$1 AND latest_version=$7`,
      [
        current.educationCommunityJourneyId,
        next.version,
        next.stage,
        changes.claimFingerprint ?? null,
        changes.activatedWorkspaceId ?? null,
        next.updatedAt,
        current.version
      ]
    );
    if (result.rowCount !== 1)
      throw new EducationCommunityError(
        'INVALID_TRANSITION',
        'Education/community journey changed before persistence.',
        409
      );
  }
  private async command<T>(
    workspaceId: string,
    key: string,
    type: CommandType,
    requestFingerprint: string,
    write: (query: QueryClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:education-community:${key}`
        ]);
        const replay = await client.query(
          'SELECT command_type,request_fingerprint_sha256,result_json FROM lite_education_community_commands WHERE command_workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, key]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (
            prior.command_type !== type ||
            prior.request_fingerprint_sha256 !== requestFingerprint
          )
            throw new EducationCommunityError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key is already bound to another education/community command.',
              409
            );
          const value = prior.result_json as T;
          if ((value as { educationCommunityJourneyId?: string }).educationCommunityJourneyId)
            return persistedJourney(value) as T;
          return persistedCohort(value, workspaceId) as T;
        }
        const result = await write(client);
        await client.query(
          `INSERT INTO lite_education_community_commands(command_workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [workspaceId, key, type, requestFingerprint, JSON.stringify(result), at(this.now())]
        );
        return result;
      });
    } catch (error) {
      if (error instanceof EducationCommunityError) throw error;
      throw this.persistence(error);
    }
  }
  private persistence(cause: unknown) {
    return new EducationCommunityError(
      'PERSISTENCE_UNAVAILABLE',
      'Education/community persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
