import { createHash, randomUUID } from 'node:crypto';
import {
  assertDirectIntake,
  assertQuoteMoneyInvariants,
  parseIntakeCreateCommand,
  type CapabilityRequest,
  type EventEnvelope,
  type ExecutionRecord,
  type Intake,
  type IntakeCreateCommand,
  type IntakeRecommendationResponse,
  type RecommendationPackage,
  parseQuoteCreateCommand,
  parseQuoteConfirmationCommand,
  type PlanQuoteResponse,
  type Quote,
  type QuoteConfirmation,
  type QuoteCreateCommand,
  type ProfessionalReviewCase,
  type CustomerInstructionType,
  type CreateFormalMatterCommand
} from '@markorbit/contracts';
import {
  noAutomaticConsequences,
  parseInternalWorkspacePrincipal,
  AuthenticationError
} from '@markorbit/contracts';
import { InMemoryEventPublisher, type EventPublisher } from '@markorbit/events';
import { createServiceRuntime, HttpError, json, type JsonResult } from '@markorbit/service-kit';
import {
  InMemoryMatterFlowRepository,
  MatterFlowError,
  MatterFlowService,
  type ConfirmQuoteCommand,
  type MatterFlowRepository
} from './matter-flow.js';
import {
  InMemoryPreparationRepository,
  PreparationError,
  PreparationService,
  type PreparationRepository,
  type PreparationSources,
  type CreatePackageCommand
} from './preparation.js';
import {
  CustomerConfirmationError,
  CustomerConfirmationService,
  type CustomerConfirmationRepository
} from './customer-confirmation.js';
import {
  MatterDraftError,
  MatterDraftService,
  type MatterDraftRepository
} from './matter-draft.js';
import {
  FormalMatterError,
  FormalMatterService,
  InMemoryFormalMatterRepository,
  type FormalMatterRepository
} from './formal-matter.js';
import { DocumentPackageError, type PostgresDocumentPackageService } from './document-package.js';
import {
  MarkRegAuditError,
  type MarkRegAuditOperation,
  type MarkRegAuditQuery,
  type MarkRegAuditTarget,
  type MarkRegDenialReason,
  type PostgresMarkRegAuditRepository
} from './audit.js';
export * from './matter-flow.js';
export * from './preparation.js';
export * from './customer-confirmation.js';
export * from './matter-draft.js';
export * from './formal-matter.js';
export * from './document-package.js';
export * from './audit.js';
export const serviceManifest = Object.freeze({
  name: 'markreg',
  port: Number(process.env.PORT ?? '4105'),
  version: '0.1.0'
});
interface Entry {
  fingerprint: string;
  intake: Intake;
  intakeCreatedPublished: boolean;
  result?: IntakeRecommendationResponse;
}
export class InMemoryMarkRegRepository {
  private readonly entries = new Map<string, Entry>();
  private readonly quoteEntries = new Map<
    string,
    { fingerprint: string; result: PlanQuoteResponse }
  >();
  private readonly quotes = new Map<string, Quote>();
  private readonly confirmations = new Map<string, { quoteId: string; value: QuoteConfirmation }>();
  get size() {
    return this.entries.size;
  }
  get(key: string) {
    return this.entries.get(key);
  }
  save(key: string, entry: Entry) {
    this.entries.set(key, entry);
  }
  all() {
    return [...this.entries.values()];
  }
  getIntake(id: string) {
    return this.all().find((entry) => entry.intake.intakeId === id)?.intake;
  }
  getRecommendation(id: string) {
    return this.all().find((entry) => entry.result?.recommendation.recommendationId === id)?.result
      ?.recommendation;
  }
  getQuoteEntry(key: string) {
    return this.quoteEntries.get(key);
  }
  saveQuoteEntry(key: string, value: { fingerprint: string; result: PlanQuoteResponse }) {
    this.quoteEntries.set(key, value);
    this.quotes.set(value.result.quote.quoteId, value.result.quote);
  }
  getQuote(id: string) {
    return this.quotes.get(id);
  }
  saveQuote(quote: Quote) {
    this.quotes.set(quote.quoteId, quote);
  }
  getConfirmation(key: string) {
    return this.confirmations.get(key);
  }
  findConfirmationByQuote(quoteId: string) {
    return [...this.confirmations.values()].find((entry) => entry.quoteId === quoteId)?.value;
  }
  findRecommendation(intakeId: string, recommendationId: string) {
    return this.all().find(
      (entry) =>
        entry.result?.intake.intakeId === intakeId &&
        entry.result.recommendation.recommendationId === recommendationId
    )?.result;
  }
  saveConfirmation(key: string, value: QuoteConfirmation) {
    this.confirmations.set(key, { quoteId: value.quoteId, value });
  }
  supersedeQuotes(intakeId: string, recommendationId: string, exceptId: string) {
    for (const [id, quote] of this.quotes)
      if (
        id !== exceptId &&
        quote.intakeId === intakeId &&
        quote.recommendationId === recommendationId &&
        quote.status === 'READY'
      )
        this.quotes.set(id, { ...quote, status: 'SUPERSEDED' });
  }
  snapshotSemanticState() {
    return structuredClone({
      quotes: [...this.quotes.values()],
      confirmations: [...this.confirmations.values()],
      quoteIdempotencyCount: this.quoteEntries.size,
      confirmationIdempotencyCount: this.confirmations.size
    });
  }
}

const money = (amountMinor: number, currency = 'USD') => ({ amountMinor, currency });
export const fixturePricingRuleVersion = 'fixture-usd-v1';
export function fixtureQuoteId(command: QuoteCreateCommand, pricingRuleVersion: string) {
  const stable = createHash('sha256')
    .update(
      `${command.intakeId}:${command.recommendationId}:${command.selectedOptionCode}:${pricingRuleVersion}`
    )
    .digest('hex')
    .slice(0, 20);
  return `quote_${stable}` as const;
}
function fixtureQuote(
  command: QuoteCreateCommand,
  timestamp: string,
  pricingRuleVersion: string
): PlanQuoteResponse {
  const factor = { A: 1, B: 2, C: 3 }[command.selectedOptionCode];
  const official = 35000 * factor,
    service = 50000 * factor,
    disbursement = 5000 * factor;
  const taxes = Math.trunc(service / 10),
    subtotal = official + service + disbursement;
  const quoteId = fixtureQuoteId(command, pricingRuleVersion);
  const stable = quoteId.slice(6);
  const lines = [
    {
      code: 'EST_OFFICIAL',
      description: 'Estimated official fees',
      category: 'OFFICIAL_FEE' as const,
      amount: money(official)
    },
    {
      code: 'EST_SERVICE',
      description: 'Estimated service fees',
      category: 'SERVICE_FEE' as const,
      amount: money(service)
    },
    {
      code: 'EST_DISBURSEMENT',
      description: 'Estimated disbursements',
      category: 'DISBURSEMENT' as const,
      amount: money(disbursement)
    },
    {
      code: 'EST_TAX',
      description: 'Estimated taxes',
      category: 'TAX' as const,
      amount: money(taxes)
    }
  ];
  const quote: Quote = {
    quoteId,
    intakeId: command.intakeId,
    recommendationId: command.recommendationId,
    selectedOptionCode: command.selectedOptionCode,
    pricingRuleVersion,
    status: 'READY',
    currency: 'USD',
    lines,
    subtotal: money(subtotal),
    estimatedOfficialFees: money(official),
    estimatedServiceFees: money(service),
    estimatedDisbursements: money(disbursement),
    estimatedTaxes: money(taxes),
    total: money(subtotal + taxes),
    assumptions: [
      {
        code: 'FIXTURE_SCOPE',
        text: 'The selected fixture plan and supplied intake remain unchanged.'
      }
    ],
    limitations: [
      'Estimate only — official fees, professional fees and disbursements require review before filing.',
      'Demonstration only — not legal advice or an official filing recommendation.'
    ],
    validUntil: new Date(Date.parse(timestamp) + 14 * 86400000).toISOString(),
    fixtureOnly: true,
    createdAt: timestamp
  };
  assertQuoteMoneyInvariants(quote);
  return {
    planSelection: {
      planSelectionId: `plan-selection_${stable}`,
      intakeId: command.intakeId,
      recommendationId: command.recommendationId,
      selectedOptionCode: command.selectedOptionCode,
      selectedAt: timestamp
    },
    quote
  };
}
export interface MarkRegOptions {
  port?: number;
  capabilityEngineUrl?: string;
  executionUrl?: string;
  repository?: InMemoryMarkRegRepository;
  publisher?: EventPublisher;
  now?: () => string;
  pricingRuleVersion?: string;
  beforeQuotePersist?: (command: QuoteCreateCommand) => void | Promise<void>;
  matterFlowRepository?: MatterFlowRepository;
  preparationRepository?: PreparationRepository;
  preparationSources?: PreparationSources;
  milestoneTestRuntime?: boolean;
  customerConfirmationRepository?: CustomerConfirmationRepository;
  matterDraftRepository?: MatterDraftRepository;
  formalMatterRepository?: FormalMatterRepository;
  internalServiceSecret?: string;
  documentPackageService?: PostgresDocumentPackageService;
  auditRepository?: PostgresMarkRegAuditRepository;
}
async function post<T>(url: string, body: unknown, key: string, correlationId: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': key,
        'x-correlation-id': correlationId
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new HttpError(
      502,
      'DOWNSTREAM_UNAVAILABLE',
      'A required downstream service is unavailable.',
      true
    );
  }
  if (!response.ok)
    throw new HttpError(
      502,
      'DOWNSTREAM_UNAVAILABLE',
      'A required downstream service did not accept the request.',
      response.status >= 500
    );
  return (await response.json()) as T;
}
function recommendation(
  intake: Intake,
  provenance: [string, string],
  now: string
): RecommendationPackage {
  return {
    recommendationId: `recommendation_${intake.intakeId.slice(7)}`,
    intakeId: intake.intakeId,
    status: 'FIXTURE_ONLY',
    options: [
      {
        tier: 'A',
        name: 'Essential Protection',
        description: 'Fixture baseline for essential protection.'
      },
      {
        tier: 'B',
        name: 'Recommended Protection',
        description: 'Fixture baseline with recommended breadth.'
      },
      {
        tier: 'C',
        name: 'Extended Protection',
        description: 'Fixture baseline for extended coverage.'
      }
    ],
    rationale: 'Deterministic fixture for workflow validation only; it is not legal advice.',
    assumptions: ['Customer intent is complete for this fixture demonstration.'],
    limitations: [
      'No legal analysis, clearance search, authority decision, or filing conclusion is provided.'
    ],
    provenance: provenance as [`${string}_${string}`, `${string}_${string}`],
    generatedAt: now
  };
}
export function createRuntime(options: MarkRegOptions = {}) {
  const repository = options.repository ?? new InMemoryMarkRegRepository();
  const publisher = options.publisher ?? new InMemoryEventPublisher();
  const now = options.now ?? (() => new Date().toISOString());
  const pricingRuleVersion = options.pricingRuleVersion ?? fixturePricingRuleVersion;
  const capabilityUrl =
    options.capabilityEngineUrl ?? process.env.CAPABILITY_ENGINE_URL ?? 'http://127.0.0.1:4103';
  const executionUrl = options.executionUrl ?? process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104';
  const inFlight = new Map<string, { fingerprint: string; result: Promise<JsonResult> }>();
  const quoteInFlight = new Map<string, { fingerprint: string; result: Promise<JsonResult> }>();
  const matterFlowRepository = options.matterFlowRepository ?? new InMemoryMatterFlowRepository();
  const matterFlow = new MatterFlowService(
    matterFlowRepository,
    (id) => Promise.resolve(repository.getQuote(id)),
    now
  );
  const durableConfirmations = options.customerConfirmationRepository
    ? new CustomerConfirmationService(
        options.customerConfirmationRepository,
        (id) => Promise.resolve(repository.getQuote(id) ?? null),
        now
      )
    : undefined;
  const durableDrafts =
    options.customerConfirmationRepository && options.matterDraftRepository
      ? new MatterDraftService(
          options.matterDraftRepository,
          options.customerConfirmationRepository,
          now
        )
      : undefined;
  const formalMatters =
    options.customerConfirmationRepository && options.matterDraftRepository
      ? new FormalMatterService(
          options.formalMatterRepository ?? new InMemoryFormalMatterRepository(),
          options.customerConfirmationRepository,
          options.matterDraftRepository,
          now
        )
      : undefined;
  const internalServiceSecret =
    options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
  const fixtureRuntime =
    options.milestoneTestRuntime ?? process.env.MO_MILESTONE_TEST_RUNTIME === '1';
  const durablePrincipal = (request: { headers: Readonly<Record<string, string | undefined>> }) => {
    if (
      !internalServiceSecret ||
      request.headers['x-markorbit-internal-authorization'] !== internalServiceSecret
    )
      throw new HttpError(
        401,
        'INTERNAL_SERVICE_UNAUTHORIZED',
        'Internal service authentication is required.'
      );
    try {
      return parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
    } catch (error) {
      if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
      throw error;
    }
  };
  const durable = async (work: () => Promise<unknown>) => {
    try {
      return json(200, await work());
    } catch (error) {
      if (error instanceof CustomerConfirmationError) {
        const status =
          error.code === 'AUTHENTICATION_REQUIRED'
            ? 401
            : error.code === 'PERMISSION_DENIED' ||
                error.code === 'CUSTOMER_CONFIRMATION_WORKSPACE_MISMATCH'
              ? 403
              : error.code === 'CUSTOMER_CONFIRMATION_NOT_FOUND' ||
                  error.code === 'CUSTOMER_CONFIRMATION_SOURCE_NOT_FOUND'
                ? 404
                : error.code === 'PERSISTENCE_UNAVAILABLE'
                  ? 503
                  : error.code === 'CUSTOMER_CONFIRMATION_INVALID_SNAPSHOT' ||
                      error.code === 'CUSTOMER_CONFIRMATION_INVALID_SOURCE'
                    ? 422
                    : 409;
        throw new HttpError(status, error.code, error.message, status === 503);
      }
      if (error instanceof MatterDraftError) {
        const status =
          error.code === 'AUTHENTICATION_REQUIRED'
            ? 401
            : error.code === 'PERMISSION_DENIED' || error.code === 'MATTER_DRAFT_WORKSPACE_MISMATCH'
              ? 403
              : error.code === 'MATTER_DRAFT_NOT_FOUND'
                ? 404
                : error.code === 'PERSISTENCE_UNAVAILABLE'
                  ? 503
                  : error.code === 'MATTER_DRAFT_INVALID_SOURCE'
                    ? 422
                    : 409;
        throw new HttpError(status, error.code, error.message, status === 503);
      }
      if (error instanceof FormalMatterError) {
        const status =
          error.code === 'AUTHENTICATION_REQUIRED'
            ? 401
            : ['PERMISSION_DENIED', 'WORKSPACE_MISMATCH'].includes(error.code)
              ? 403
              : ['FORMAL_MATTER_NOT_FOUND', 'SOURCE_NOT_FOUND'].includes(error.code)
                ? 404
                : error.code === 'PERSISTENCE_UNAVAILABLE'
                  ? 503
                  : error.code === 'SOURCE_INELIGIBLE'
                    ? 422
                    : 409;
        throw new HttpError(status, error.code, error.message, status === 503);
      }
      if (error instanceof DocumentPackageError)
        throw new HttpError(error.status, error.code, error.message, error.retryable);
      if (error instanceof MarkRegAuditError)
        throw new HttpError(
          error.code === 'INVALID_AUDIT_QUERY' ? 400 : 503,
          error.code,
          error.message,
          error.code === 'PERSISTENCE_UNAVAILABLE'
        );
      throw error;
    }
  };
  const preparationSources: PreparationSources = options.preparationSources ?? {
    async getReview(id) {
      const response = await fetch(
        `${executionUrl}/v1/professional-review-cases/${encodeURIComponent(id)}`
      );
      if (response.status === 404) return undefined;
      if (!response.ok)
        throw new HttpError(
          502,
          'DOWNSTREAM_UNAVAILABLE',
          'Professional Review source is unavailable.',
          true
        );
      return (
        (await response.json()) as {
          reviewCase: ProfessionalReviewCase;
        }
      ).reviewCase;
    },
    getMatterDraft: (id) => matterFlowRepository.getMatterDraft(id as `matter-draft_${string}`),
    getConfirmation: (id) => matterFlowRepository.getConfirmation(id as `confirmation_${string}`)
  };
  const preparationRepository =
    options.preparationRepository ?? new InMemoryPreparationRepository();
  const preparation = new PreparationService(preparationRepository, preparationSources, now);
  const durablePackages = options.documentPackageService;
  const auditRepository = options.auditRepository;
  const reasonFor = (error: unknown): MarkRegDenialReason | undefined => {
    const code =
      error instanceof FormalMatterError || error instanceof DocumentPackageError
        ? error.code
        : undefined;
    if (code === 'PERMISSION_DENIED') return 'PERMISSION_DENIED';
    if (code === 'WORKSPACE_MISMATCH') return 'CROSS_WORKSPACE_ACCESS';
    if (code === 'IDEMPOTENCY_CONFLICT') return 'IDEMPOTENCY_KEY_REUSE';
    if (code === 'STALE_SOURCE' || code === 'STALE_PACKAGE_VERSION') return 'STALE_VERSION';
    if (code === 'PACKAGE_IMMUTABLE') return 'TERMINAL_STATE_MUTATION';
    if (code === 'DUPLICATE_SOURCE' || code === 'SOURCE_INELIGIBLE')
      return 'SOURCE_LINEAGE_CONFLICT';
    return undefined;
  };
  const auditedMutation = async <T>(
    principal: ReturnType<typeof durablePrincipal>,
    operation: MarkRegAuditOperation,
    targetType: MarkRegAuditTarget,
    targetId: string | undefined,
    idempotencyKey: string | undefined,
    command: unknown,
    correlationId: string | undefined,
    work: () => Promise<T>
  ): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      const reasonCode = reasonFor(error);
      if (!reasonCode || !auditRepository) throw error;
      await auditRepository.appendDenial({
        workspaceId: principal.workspaceId,
        actorId: principal.userId,
        actorMembershipId: principal.membershipId,
        operation,
        targetType,
        ...(targetId ? { targetId } : {}),
        reasonCode,
        ...(correlationId ? { correlationId } : {}),
        ...(idempotencyKey
          ? {
              idempotencyKeySha256: createHash('sha256').update(idempotencyKey).digest('hex')
            }
          : {}),
        sourceCommandFingerprint: createHash('sha256')
          .update(JSON.stringify(command ?? null))
          .digest('hex'),
        occurredAt: now()
      });
      throw error;
    }
  };
  const prepared = async (work: () => Promise<unknown>) => {
    try {
      return json(200, await work());
    } catch (error) {
      if (error instanceof PreparationError)
        throw new HttpError(error.status, error.code, error.message, false, error.details);
      throw error;
    }
  };
  const governed = async (work: () => Promise<unknown>) => {
    try {
      return json(200, await work());
    } catch (error) {
      if (error instanceof MatterFlowError)
        throw new HttpError(error.status, error.code, error.message, false, error.details);
      throw error;
    }
  };
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        ...(fixtureRuntime
          ? [
              {
                method: 'GET' as const,
                path: '/__milestone/scenario-records',
                handle: () => {
                  if (
                    !(matterFlowRepository instanceof InMemoryMatterFlowRepository) ||
                    !(preparationRepository instanceof InMemoryPreparationRepository)
                  )
                    throw new HttpError(
                      404,
                      'MILESTONE_SNAPSHOT_UNAVAILABLE',
                      'Milestone snapshot is unavailable.'
                    );
                  return json(200, {
                    matterDrafts: matterFlowRepository.snapshotMatterDrafts(),
                    preparationLocks: preparationRepository.snapshotLocks()
                  });
                }
              }
            ]
          : []),
        {
          method: 'GET',
          path: '/v1/intakes/:intakeId',
          handle: (request) => {
            const intake = repository.getIntake(request.params.intakeId!);
            if (!intake)
              throw new HttpError(404, 'INTAKE_NOT_FOUND', 'Consultation was not found.');
            return json(200, { intake });
          }
        },
        {
          method: 'GET',
          path: '/v1/recommendations/:recommendationId',
          handle: (request) => {
            const recommendation = repository.getRecommendation(request.params.recommendationId!);
            if (!recommendation)
              throw new HttpError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation was not found.');
            return json(200, { recommendation });
          }
        },
        {
          method: 'GET',
          path: '/v1/quotes/:quoteId',
          handle: (request) => {
            const quote = repository.getQuote(request.params.quoteId!);
            if (!quote) throw new HttpError(404, 'QUOTE_NOT_FOUND', 'Quote was not found.');
            return json(200, { quote });
          }
        },
        {
          method: 'GET',
          path: '/v1/audit-records',
          handle: (request) => {
            if (!auditRepository)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Audit persistence is unavailable.',
                true
              );
            const principal = durablePrincipal(request);
            if (!principal.permissions.includes('audit:read'))
              throw new HttpError(403, 'PERMISSION_DENIED', 'audit:read permission is required.');
            const limit =
              request.query.limit === undefined ? undefined : Number(request.query.limit);
            return durable(async () => ({
              ...(await auditRepository.list(principal.workspaceId, {
                ...(request.query.kind
                  ? { kind: request.query.kind as NonNullable<MarkRegAuditQuery['kind']> }
                  : {}),
                ...(request.query.targetType
                  ? {
                      targetType: request.query.targetType as NonNullable<
                        MarkRegAuditQuery['targetType']
                      >
                    }
                  : {}),
                ...(request.query.targetId ? { targetId: request.query.targetId } : {}),
                ...(request.query.reasonCode
                  ? {
                      reasonCode: request.query.reasonCode as NonNullable<
                        MarkRegAuditQuery['reasonCode']
                      >
                    }
                  : {}),
                ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
                ...(limit !== undefined ? { limit } : {})
              }))
            }));
          }
        },
        {
          method: 'POST',
          path: '/v1/audit-denials',
          handle: (request) => {
            if (!auditRepository)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Audit persistence is unavailable.',
                true
              );
            const principal = durablePrincipal(request);
            const body = request.body as {
              operation: MarkRegAuditOperation;
              targetType: MarkRegAuditTarget;
              targetId?: string;
              reasonCode: MarkRegDenialReason;
              idempotencyKeySha256?: string;
              sourceCommandFingerprint?: string;
            };
            return durable(() =>
              auditRepository.appendDenial({
                workspaceId: principal.workspaceId,
                actorId: principal.userId,
                actorMembershipId: principal.membershipId,
                operation: body.operation,
                targetType: body.targetType,
                ...(body.targetId ? { targetId: body.targetId } : {}),
                reasonCode: body.reasonCode,
                ...(request.headers['x-correlation-id']
                  ? { correlationId: request.headers['x-correlation-id'] }
                  : {}),
                ...(body.idempotencyKeySha256
                  ? { idempotencyKeySha256: body.idempotencyKeySha256 }
                  : {}),
                ...(body.sourceCommandFingerprint
                  ? { sourceCommandFingerprint: body.sourceCommandFingerprint }
                  : {}),
                occurredAt: now()
              })
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/document-packages',
          handle: (r) => {
            if (!durablePackages)
              return prepared(() =>
                preparation.createPackage({
                  ...(r.body as Omit<CreatePackageCommand, 'idempotencyKey'>),
                  idempotencyKey: r.headers['idempotency-key'] ?? ''
                })
              );
            const b = r.body as Record<string, unknown>;
            const text = (value: unknown) => (typeof value === 'string' ? value : '');
            const principal = durablePrincipal(r);
            const command = {
              professionalReviewCaseId: text(b.professionalReviewCaseId),
              expectedReviewVersion: Number(b.expectedReviewVersion),
              expectedCompletedDecisionId: text(b.expectedCompletedDecisionId),
              expectedCompletedDecisionHash: text(b.expectedCompletedDecisionHash),
              idempotencyKey: r.headers['idempotency-key'] ?? ''
            };
            return durable(() =>
              auditedMutation(
                principal,
                'DOCUMENT_PACKAGE_CREATE',
                'DOCUMENT_PACKAGE',
                undefined,
                command.idempotencyKey,
                command,
                r.headers['x-correlation-id'],
                () =>
                  durablePackages.createOrOpen(
                    principal,
                    {
                      ...command
                    },
                    r.headers['x-correlation-id']
                  )
              )
            );
          }
        },
        {
          method: 'GET',
          path: '/v1/document-packages',
          handle: (r) =>
            durablePackages
              ? durable(async () => ({
                  documentPackages: await durablePackages.list(durablePrincipal(r))
                }))
              : prepared(async () => ({
                  documentPackages: await preparation.listPackages(
                    new URL(`http://local${r.path}`).searchParams.get('customerId') ?? undefined
                  )
                }))
        },
        {
          method: 'GET',
          path: '/v1/document-packages/:documentPackageId',
          handle: (r) =>
            durablePackages
              ? durable(() => durablePackages.get(durablePrincipal(r), r.params.documentPackageId!))
              : prepared(() =>
                  preparation.getPackage(r.params.documentPackageId as `document-package_${string}`)
                )
        },
        {
          method: 'PATCH',
          path: '/v1/document-packages/:documentPackageId',
          handle: (r) => {
            if (!durablePackages) throw new HttpError(404, 'ROUTE_NOT_FOUND', 'Route not found.');
            const b = r.body as { expectedVersion: number; draft: Record<string, unknown> };
            const principal = durablePrincipal(r);
            const command = { ...b, idempotencyKey: r.headers['idempotency-key'] ?? '' };
            return durable(() =>
              auditedMutation(
                principal,
                'DOCUMENT_PACKAGE_UPDATE_DRAFT',
                'DOCUMENT_PACKAGE',
                r.params.documentPackageId,
                command.idempotencyKey,
                command,
                r.headers['x-correlation-id'],
                () =>
                  durablePackages.updateDraft(
                    principal,
                    r.params.documentPackageId!,
                    command,
                    r.headers['x-correlation-id']
                  )
              )
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/document-packages/:documentPackageId/documents',
          handle: (r) => {
            if (!durablePackages)
              return prepared(() =>
                preparation.addDocument(
                  r.params.documentPackageId as `document-package_${string}`,
                  r.body as never
                )
              );
            const b = r.body as { expectedVersion: number; evidence: never };
            const principal = durablePrincipal(r);
            const command = { ...b, idempotencyKey: r.headers['idempotency-key'] ?? '' };
            return durable(() =>
              auditedMutation(
                principal,
                'DOCUMENT_EVIDENCE_UPSERT',
                'DOCUMENT_EVIDENCE',
                r.params.documentPackageId,
                command.idempotencyKey,
                command,
                r.headers['x-correlation-id'],
                () =>
                  durablePackages.upsertEvidence(
                    principal,
                    r.params.documentPackageId!,
                    command,
                    r.headers['x-correlation-id']
                  )
              )
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/document-packages/:documentPackageId/instructions',
          handle: (r) => {
            if (!durablePackages) throw new HttpError(404, 'ROUTE_NOT_FOUND', 'Route not found.');
            const b = r.body as { expectedVersion: number; instruction: never };
            const principal = durablePrincipal(r);
            const command = { ...b, idempotencyKey: r.headers['idempotency-key'] ?? '' };
            return durable(() =>
              auditedMutation(
                principal,
                'INSTRUCTION_APPEND',
                'INSTRUCTION_LEDGER',
                r.params.documentPackageId,
                command.idempotencyKey,
                command,
                r.headers['x-correlation-id'],
                () =>
                  durablePackages.appendInstruction(
                    principal,
                    r.params.documentPackageId!,
                    command,
                    r.headers['x-correlation-id']
                  )
              )
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/document-packages/:documentPackageId/instructions/:instructionEntryId/supersede',
          handle: (r) => {
            if (!durablePackages) throw new HttpError(404, 'ROUTE_NOT_FOUND', 'Route not found.');
            const b = r.body as { expectedVersion: number; instruction: never };
            const principal = durablePrincipal(r);
            const command = { ...b, idempotencyKey: r.headers['idempotency-key'] ?? '' };
            return durable(() =>
              auditedMutation(
                principal,
                'INSTRUCTION_SUPERSEDE',
                'INSTRUCTION_LEDGER',
                r.params.documentPackageId,
                command.idempotencyKey,
                command,
                r.headers['x-correlation-id'],
                () =>
                  durablePackages.supersedeInstruction(
                    principal,
                    r.params.documentPackageId!,
                    r.params.instructionEntryId!,
                    command,
                    r.headers['x-correlation-id']
                  )
              )
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/document-packages/:documentPackageId/mark-ready',
          handle: (r) => {
            if (!durablePackages) throw new HttpError(404, 'ROUTE_NOT_FOUND', 'Route not found.');
            const b = r.body as { expectedVersion: number };
            const principal = durablePrincipal(r);
            const command = { ...b, idempotencyKey: r.headers['idempotency-key'] ?? '' };
            return durable(() =>
              auditedMutation(
                principal,
                'DOCUMENT_PACKAGE_MARK_READY',
                'DOCUMENT_PACKAGE',
                r.params.documentPackageId,
                command.idempotencyKey,
                command,
                r.headers['x-correlation-id'],
                () =>
                  durablePackages.markReady(
                    principal,
                    r.params.documentPackageId!,
                    command,
                    r.headers['x-correlation-id']
                  )
              )
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/document-packages/:documentPackageId/documents/:documentItemId/supersede',
          handle: (r) =>
            prepared(() =>
              preparation.supersedeDocument(
                r.params.documentPackageId as `document-package_${string}`,
                r.params.documentItemId as `document-item_${string}`,
                r.body as never
              )
            )
        },
        {
          method: 'PATCH',
          path: '/v1/document-packages/:documentPackageId/documents/:documentItemId',
          handle: (r) =>
            prepared(() =>
              preparation.updateDocument(
                r.params.documentPackageId as `document-package_${string}`,
                r.params.documentItemId as `document-item_${string}`,
                r.body as never
              )
            )
        },
        {
          method: 'POST',
          path: '/v1/document-packages/:documentPackageId/evaluate',
          handle: (r) =>
            prepared(() =>
              preparation.evaluate(r.params.documentPackageId as `document-package_${string}`)
            )
        },
        {
          method: 'POST',
          path: '/v1/document-packages/:documentPackageId/withdraw',
          handle: (r) =>
            prepared(() =>
              preparation.withdrawPackage(
                r.params.documentPackageId as `document-package_${string}`
              )
            )
        },
        {
          method: 'POST',
          path: '/v1/instruction-ledgers',
          handle: (r) =>
            prepared(() =>
              preparation.createLedger(
                (r.body as { documentPackageId: `document-package_${string}` }).documentPackageId
              )
            )
        },
        {
          method: 'GET',
          path: '/v1/instruction-ledgers/:instructionLedgerId',
          handle: (r) =>
            prepared(() =>
              preparation.getLedger(r.params.instructionLedgerId as `instruction-ledger_${string}`)
            )
        },
        {
          method: 'POST',
          path: '/v1/instruction-ledgers/:instructionLedgerId/entries',
          handle: (r) =>
            prepared(() =>
              preparation.appendInstruction(
                r.params.instructionLedgerId as `instruction-ledger_${string}`,
                r.body as never
              )
            )
        },
        {
          method: 'POST',
          path: '/v1/instruction-ledgers/:instructionLedgerId/entries/:instructionEntryId/confirm',
          handle: (r) =>
            prepared(() =>
              preparation.confirmInstruction(
                r.params.instructionLedgerId as `instruction-ledger_${string}`,
                r.params.instructionEntryId as `instruction-entry_${string}`
              )
            )
        },
        {
          method: 'POST',
          path: '/v1/instruction-ledgers/:instructionLedgerId/entries/:instructionEntryId/supersede',
          handle: (r) =>
            prepared(() =>
              preparation.appendInstruction(
                r.params.instructionLedgerId as `instruction-ledger_${string}`,
                {
                  ...(r.body as {
                    type: CustomerInstructionType;
                    structuredValue: Record<string, unknown>;
                    note?: string;
                  }),
                  supersedesInstructionEntryId: r.params
                    .instructionEntryId as `instruction-entry_${string}`
                }
              )
            )
        },
        {
          method: 'POST',
          path: '/v1/instruction-ledgers/:instructionLedgerId/confirm',
          handle: (r) =>
            prepared(() =>
              preparation.confirmLedger(
                r.params.instructionLedgerId as `instruction-ledger_${string}`,
                (r.body as { acknowledgements: never[] }).acknowledgements
              )
            )
        },
        {
          method: 'POST',
          path: '/v1/instruction-ledgers/:instructionLedgerId/withdraw',
          handle: (r) =>
            prepared(() =>
              preparation.withdrawLedger(
                r.params.instructionLedgerId as `instruction-ledger_${string}`
              )
            )
        },
        {
          method: 'POST',
          path: '/v1/preparation-locks',
          handle: (r) =>
            prepared(() => {
              const b = r.body as {
                documentPackageId: `document-package_${string}`;
                instructionLedgerId: `instruction-ledger_${string}`;
              };
              return preparation.lock(b.documentPackageId, b.instructionLedgerId);
            })
        },
        {
          method: 'GET',
          path: '/v1/preparation-locks/:preparationLockId',
          handle: (r) =>
            prepared(() =>
              preparation.getLock(r.params.preparationLockId as `preparation-lock_${string}`)
            )
        },
        {
          method: 'POST',
          path: '/v1/preparation-locks/:preparationLockId/validate-current',
          handle: (r) =>
            prepared(() =>
              preparation.validateLockCurrent(
                r.params.preparationLockId as `preparation-lock_${string}`
              )
            )
        },
        {
          method: 'GET',
          path: '/v1/formal-matters',
          async handle(request) {
            if (!formalMatters)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Formal Matter persistence is unavailable.',
                true
              );
            const workspaceId = request.headers['x-markorbit-workspace-id'];
            if (!workspaceId)
              throw new HttpError(
                400,
                'INVALID_WORKSPACE_CONTEXT',
                'Workspace context is required.'
              );
            const { status, type, search, createdFrom, createdTo } = request.query;
            const page = Number(request.query.page ?? '1');
            const pageSize = Number(request.query.pageSize ?? '20');
            if (
              !Number.isSafeInteger(page) ||
              page < 1 ||
              !Number.isSafeInteger(pageSize) ||
              pageSize < 1 ||
              pageSize > 100 ||
              (status && status !== 'OPEN') ||
              (type && type !== 'TRADEMARK_REGISTRATION') ||
              (search?.length ?? 0) > 100 ||
              (createdFrom && Number.isNaN(Date.parse(createdFrom))) ||
              (createdTo && Number.isNaN(Date.parse(createdTo))) ||
              (createdFrom && createdTo && Date.parse(createdFrom) > Date.parse(createdTo))
            )
              throw new HttpError(
                400,
                'INVALID_FILTERS',
                'Matter list filters or pagination are invalid.'
              );
            return durable(async () => ({
              ...(await formalMatters.list(durablePrincipal(request), workspaceId, {
                page,
                pageSize,
                ...(status ? { status: status as 'OPEN' } : {}),
                ...(type ? { type: type as 'TRADEMARK_REGISTRATION' } : {}),
                ...(search ? { search } : {}),
                ...(createdFrom ? { createdFrom } : {}),
                ...(createdTo ? { createdTo } : {})
              })),
              consequences: noAutomaticConsequences
            }));
          }
        },
        {
          method: 'POST',
          path: '/v1/formal-matters',
          async handle(request) {
            if (!formalMatters)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Formal Matter persistence is unavailable.',
                true
              );
            const b = request.body as CreateFormalMatterCommand;
            if (
              !b.workspaceId ||
              !b.customerConfirmationId ||
              !b.matterDraftId ||
              !b.idempotencyKey ||
              !Number.isSafeInteger(b.expectedCustomerConfirmationVersion) ||
              !Number.isSafeInteger(b.expectedMatterDraftVersion) ||
              request.headers['idempotency-key'] !== b.idempotencyKey
            )
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                'Exact source versions and matching Idempotency-Key are required.'
              );
            const principal = durablePrincipal(request);
            return durable(async () => ({
              formalMatter: await auditedMutation(
                principal,
                'FORMAL_MATTER_CREATE',
                'FORMAL_MATTER',
                undefined,
                b.idempotencyKey,
                b,
                request.headers['x-correlation-id'],
                () => formalMatters.create(principal, b, request.headers['x-correlation-id'])
              ),
              consequences: noAutomaticConsequences
            }));
          }
        },
        {
          method: 'GET',
          path: '/v1/formal-matters/:formalMatterId',
          async handle(request) {
            if (!formalMatters)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Formal Matter persistence is unavailable.',
                true
              );
            const workspaceId = request.headers['x-markorbit-workspace-id'];
            if (!workspaceId)
              throw new HttpError(
                400,
                'INVALID_WORKSPACE_CONTEXT',
                'Workspace context is required.'
              );
            return durable(async () => ({
              formalMatter: await formalMatters.get(
                durablePrincipal(request),
                workspaceId,
                request.params.formalMatterId!
              ),
              consequences: noAutomaticConsequences
            }));
          }
        },
        {
          method: 'POST',
          path: '/v1/customer-confirmations',
          async handle(request) {
            if (durableConfirmations) {
              const b = request.body as {
                workspaceId: string;
                quoteId: string;
                quoteVersion: string;
                planId: string;
                planVersion: string;
                termsVersion: string;
                acknowledgements?: { code: string; acknowledged: boolean }[];
              };
              return durable(async () => ({
                confirmation: await durableConfirmations.create(durablePrincipal(request), {
                  workspaceId: b.workspaceId,
                  quoteId: b.quoteId,
                  quoteVersion: b.quoteVersion,
                  planId: b.planId,
                  planVersion: b.planVersion,
                  termsVersion: b.termsVersion,
                  acknowledgementCodes: (b.acknowledgements ?? [])
                    .filter((x) => x.acknowledged)
                    .map((x) => x.code)
                }),
                nextAction: 'PREPARE_MATTER_DRAFT',
                consequences: noAutomaticConsequences
              }));
            }
            if (!fixtureRuntime)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Customer Confirmation persistence is unavailable.',
                true
              );
            const body = request.body as ConfirmQuoteCommand;
            const key = request.headers['idempotency-key'];
            if (!key || key !== body.idempotencyKey)
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                'Idempotency-Key must match the command.'
              );
            return governed(() => matterFlow.confirm(body));
          }
        },
        {
          method: 'GET',
          path: '/v1/customer-confirmations/:confirmationId',
          async handle(request) {
            if (durableConfirmations) {
              const workspaceId = request.headers['x-markorbit-workspace-id'];
              if (!workspaceId)
                throw new HttpError(
                  400,
                  'INVALID_WORKSPACE_CONTEXT',
                  'Workspace context is required.'
                );
              return durable(async () => ({
                confirmation: await durableConfirmations.get(
                  durablePrincipal(request),
                  workspaceId,
                  request.params.confirmationId!
                ),
                nextAction: 'NONE',
                consequences: noAutomaticConsequences
              }));
            }
            if (!fixtureRuntime)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Customer Confirmation persistence is unavailable.',
                true
              );
            const value = await matterFlowRepository.getConfirmation(
              request.params.confirmationId as `confirmation_${string}`
            );
            if (!value)
              throw new HttpError(404, 'CONFIRMATION_NOT_FOUND', 'Confirmation was not found.');
            return json(200, {
              confirmation: value,
              nextAction: value.status === 'CONFIRMED' ? 'PREPARE_MATTER_DRAFT' : 'NONE',
              consequences: noAutomaticConsequences
            });
          }
        },
        {
          method: 'POST',
          path: '/v1/customer-confirmations/:confirmationId/withdraw',
          async handle(request) {
            if (durableConfirmations) {
              const b = request.body as { workspaceId: string; expectedVersion: number };
              return durable(async () => ({
                confirmation: await durableConfirmations.withdraw(
                  durablePrincipal(request),
                  b.workspaceId,
                  request.params.confirmationId!,
                  b.expectedVersion
                ),
                nextAction: 'NONE',
                consequences: noAutomaticConsequences
              }));
            }
            if (!fixtureRuntime)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Customer Confirmation persistence is unavailable.',
                true
              );
            return governed(async () => ({
              confirmation: await matterFlowRepository.withdrawConfirmation(
                request.params.confirmationId as `confirmation_${string}`,
                now()
              ),
              nextAction: 'NONE',
              consequences: noAutomaticConsequences
            }));
          }
        },
        {
          method: 'POST',
          path: '/v1/matter-drafts',
          async handle(request) {
            if (durableDrafts) {
              const b = request.body as {
                workspaceId: string;
                confirmationId: string;
                confirmationVersion: number;
              };
              if (
                !b.workspaceId ||
                !b.confirmationId ||
                !Number.isSafeInteger(b.confirmationVersion)
              )
                throw new HttpError(
                  400,
                  'INVALID_REQUEST',
                  'Workspace, Confirmation and exact version are required.'
                );
              return durable(async () => ({
                matterDraft: await durableDrafts.create(durablePrincipal(request), {
                  workspaceId: b.workspaceId,
                  customerConfirmationId: b.confirmationId,
                  customerConfirmationVersion: b.confirmationVersion
                }),
                consequences: noAutomaticConsequences
              }));
            }
            if (!fixtureRuntime)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Matter Draft persistence is unavailable.',
                true
              );
            return governed(() =>
              matterFlow.createDraft(
                (request.body as { confirmationId: `confirmation_${string}` }).confirmationId,
                (request.body as { confirmationVersion?: string }).confirmationVersion
              )
            );
          }
        },
        {
          method: 'GET',
          path: '/v1/matter-drafts/:matterDraftId',
          async handle(request) {
            if (durableDrafts) {
              const workspaceId = request.headers['x-markorbit-workspace-id'];
              if (!workspaceId)
                throw new HttpError(
                  400,
                  'INVALID_WORKSPACE_CONTEXT',
                  'Workspace context is required.'
                );
              return durable(async () => ({
                matterDraft: await durableDrafts.get(
                  durablePrincipal(request),
                  workspaceId,
                  request.params.matterDraftId!
                ),
                consequences: noAutomaticConsequences
              }));
            }
            if (!fixtureRuntime)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Matter Draft persistence is unavailable.',
                true
              );
            const value = await matterFlowRepository.getMatterDraft(
              request.params.matterDraftId as `matter-draft_${string}`
            );
            if (!value)
              throw new HttpError(404, 'MATTER_DRAFT_NOT_FOUND', 'Matter Draft was not found.');
            return json(200, { matterDraft: value, consequences: noAutomaticConsequences });
          }
        },
        {
          method: 'PATCH',
          path: '/v1/matter-drafts/:matterDraftId',
          async handle(request) {
            if (durableDrafts) {
              const b = request.body as {
                expectedVersion: number;
                preparation?: Record<string, unknown>;
              };
              const workspaceId = request.headers['x-markorbit-workspace-id'];
              if (!workspaceId)
                throw new HttpError(
                  400,
                  'INVALID_WORKSPACE_CONTEXT',
                  'Workspace context is required.'
                );
              if (!Number.isSafeInteger(b.expectedVersion))
                throw new HttpError(400, 'INVALID_REQUEST', 'expectedVersion is required.');
              return durable(async () => ({
                matterDraft: await durableDrafts.update(
                  durablePrincipal(request),
                  workspaceId,
                  request.params.matterDraftId!,
                  b.expectedVersion,
                  (b.preparation ?? b) as never
                ),
                consequences: noAutomaticConsequences
              }));
            }
            if (!fixtureRuntime)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Matter Draft persistence is unavailable.',
                true
              );
            return governed(() =>
              matterFlow.updateDraft(
                request.params.matterDraftId as `matter-draft_${string}`,
                request.body as never
              )
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/matter-drafts/:matterDraftId/evaluate-readiness',
          async handle(request) {
            if (durableDrafts) {
              const b = request.body as { expectedVersion: number };
              const workspaceId = request.headers['x-markorbit-workspace-id'];
              if (!workspaceId)
                throw new HttpError(
                  400,
                  'INVALID_WORKSPACE_CONTEXT',
                  'Workspace context is required.'
                );
              if (!Number.isSafeInteger(b.expectedVersion))
                throw new HttpError(400, 'INVALID_REQUEST', 'expectedVersion is required.');
              return durable(async () => ({
                matterDraft: await durableDrafts.evaluate(
                  durablePrincipal(request),
                  workspaceId,
                  request.params.matterDraftId!,
                  b.expectedVersion
                ),
                consequences: noAutomaticConsequences
              }));
            }
            if (!fixtureRuntime)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Matter Draft persistence is unavailable.',
                true
              );
            return governed(() =>
              matterFlow.evaluateReadiness(request.params.matterDraftId as `matter-draft_${string}`)
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/matter-drafts/:matterDraftId/progress',
          async handle(request) {
            if (durableDrafts) {
              const workspaceId = request.headers['x-markorbit-workspace-id'];
              const expectedVersion = (request.body as { expectedVersion?: number })
                .expectedVersion;
              if (!workspaceId)
                throw new HttpError(
                  400,
                  'INVALID_WORKSPACE_CONTEXT',
                  'Workspace context is required.'
                );
              if (!Number.isSafeInteger(expectedVersion))
                throw new HttpError(400, 'INVALID_REQUEST', 'expectedVersion is required.');
              return durable(async () => ({
                matterDraft: await durableDrafts.progress(
                  durablePrincipal(request),
                  workspaceId,
                  request.params.matterDraftId!,
                  expectedVersion!
                ),
                consequences: noAutomaticConsequences
              }));
            }
            if (!fixtureRuntime)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Matter Draft persistence is unavailable.',
                true
              );
            return governed(() =>
              matterFlow.progressDraft(request.params.matterDraftId as `matter-draft_${string}`)
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/quotes',
          async handle(request) {
            let command: QuoteCreateCommand;
            try {
              command = parseQuoteCreateCommand(request.body);
            } catch (error) {
              throw new HttpError(
                422,
                'INVALID_QUOTE_REQUEST',
                error instanceof Error ? error.message : 'Invalid quote request.'
              );
            }
            const key = request.headers['idempotency-key'];
            if (!key || key !== command.idempotencyKey)
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                'Idempotency-Key header is required and must match the command.'
              );
            const fingerprint = JSON.stringify({
              ...command,
              idempotencyKey: undefined,
              correlationId: undefined
            });
            const prior = repository.getQuoteEntry(key);
            if (prior && prior.fingerprint !== fingerprint)
              throw new HttpError(
                409,
                'IDEMPOTENCY_CONFLICT',
                'Idempotency key was already used with a different payload.'
              );
            if (prior) return json(200, prior.result);
            const pending = quoteInFlight.get(key);
            if (pending) {
              if (pending.fingerprint !== fingerprint)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Idempotency key is in use with a different payload.'
                );
              return pending.result;
            }
            const work = (async () => {
              const recommendation = repository.findRecommendation(
                command.intakeId,
                command.recommendationId
              );
              if (!recommendation)
                throw new HttpError(
                  422,
                  'QUOTE_RELATIONSHIP_INVALID',
                  'The Intake and Recommendation cannot be quoted together.'
                );
              if (
                recommendation.recommendation.status !== 'FIXTURE_ONLY' ||
                !recommendation.recommendation.options.some(
                  (option) => option.tier === command.selectedOptionCode
                )
              )
                throw new HttpError(
                  422,
                  'QUOTE_OPTION_INVALID',
                  'The selected option is not eligible for fixture quotation.'
                );
              await options.beforeQuotePersist?.(command);
              const result = fixtureQuote(command, now(), pricingRuleVersion);
              repository.supersedeQuotes(
                command.intakeId,
                command.recommendationId,
                result.quote.quoteId
              );
              repository.saveQuoteEntry(key, { fingerprint, result });
              return json(201, result);
            })();
            quoteInFlight.set(key, { fingerprint, result: work });
            try {
              return await work;
            } finally {
              quoteInFlight.delete(key);
            }
          }
        },
        {
          method: 'POST',
          path: '/v1/quotes/:quoteId/confirm',
          handle(request) {
            let command;
            try {
              command = parseQuoteConfirmationCommand(request.body);
            } catch (error) {
              throw new HttpError(
                422,
                'INVALID_CONFIRMATION_REQUEST',
                error instanceof Error ? error.message : 'Invalid confirmation request.'
              );
            }
            if (command.quoteId !== request.params.quoteId)
              throw new HttpError(
                422,
                'QUOTE_ID_MISMATCH',
                'Quote identifier does not match the route.'
              );
            const key = request.headers['idempotency-key'];
            if (!key || key !== command.idempotencyKey)
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                'Idempotency-Key header is required and must match the command.'
              );
            const prior = repository.getConfirmation(key);
            if (prior && prior.quoteId !== command.quoteId)
              throw new HttpError(
                409,
                'IDEMPOTENCY_CONFLICT',
                'Idempotency key was already used for another quote.'
              );
            if (prior) return json(200, prior.value);
            const quote = repository.getQuote(command.quoteId);
            if (!quote) throw new HttpError(404, 'QUOTE_NOT_FOUND', 'Quote was not found.');
            const existingConfirmation = repository.findConfirmationByQuote(command.quoteId);
            if (existingConfirmation) {
              repository.saveConfirmation(key, existingConfirmation);
              return json(200, existingConfirmation);
            }
            if (quote.status === 'SUPERSEDED')
              throw new HttpError(409, 'QUOTE_SUPERSEDED', 'This quote is no longer current.');
            if (quote.status === 'EXPIRED' || Date.parse(quote.validUntil) <= Date.parse(now())) {
              repository.saveQuote({ ...quote, status: 'EXPIRED' });
              throw new HttpError(409, 'QUOTE_EXPIRED', 'This quote has expired.');
            }
            if (quote.status !== 'READY')
              throw new HttpError(409, 'QUOTE_NOT_READY', 'This quote cannot be confirmed.');
            const confirmation: QuoteConfirmation = {
              quoteId: quote.quoteId,
              status: 'CONFIRMED',
              confirmedAt: now(),
              pendingProfessionalReview: true,
              orderCreated: false,
              paymentMade: false,
              filingStarted: false
            };
            repository.saveQuote({ ...quote, status: 'CONFIRMED' });
            repository.saveConfirmation(key, confirmation);
            return json(201, confirmation);
          }
        },
        {
          method: 'POST',
          path: '/v1/intakes',
          async handle(request) {
            let command: IntakeCreateCommand;
            try {
              command = parseIntakeCreateCommand(request.body);
            } catch (error) {
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                error instanceof Error ? error.message : 'Invalid request.'
              );
            }
            try {
              assertDirectIntake(command);
            } catch {
              throw new HttpError(
                422,
                'UNSUPPORTED_CHANNEL_RELATIONSHIP',
                'Only MARKREG_DIRECT with DIRECT is supported.'
              );
            }
            const key = request.headers['idempotency-key'];
            if (!key || key !== command.idempotencyKey)
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                'Idempotency-Key header is required and must match the command.'
              );
            const fingerprint = JSON.stringify({ ...command, idempotencyKey: undefined });
            const entry = repository.get(key);
            if (entry && entry.fingerprint !== fingerprint)
              throw new HttpError(
                409,
                'IDEMPOTENCY_CONFLICT',
                'Idempotency key was already used with a different payload.'
              );
            if (entry?.result) return json(200, entry.result);
            const pending = inFlight.get(key);
            if (pending) {
              if (pending.fingerprint !== fingerprint)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Idempotency key is in use with a different payload.'
                );
              return pending.result;
            }
            const result = (async (): Promise<JsonResult> => {
              let workingEntry = entry;
              if (!workingEntry) {
                const intake: Intake = {
                  intakeId: `intake_${randomUUID()}`,
                  channel: command.channel,
                  relationshipModel: command.relationshipModel,
                  status: 'RECEIVED',
                  customerIntent: command.customerIntent,
                  createdAt: now(),
                  correlationId: command.correlationId
                };
                workingEntry = { fingerprint, intake, intakeCreatedPublished: false };
                repository.save(key, workingEntry);
              }
              if (!workingEntry.intakeCreatedPublished) {
                const event: EventEnvelope<'markreg.intake.created.v1', Intake> = {
                  eventId: `event_${randomUUID()}`,
                  eventType: 'markreg.intake.created.v1',
                  occurredAt: now(),
                  correlationId: command.correlationId,
                  actor: command.actor,
                  schemaVersion: 1,
                  payload: workingEntry.intake
                };
                await publisher.publish(event);
                workingEntry.intakeCreatedPublished = true;
                repository.save(key, workingEntry);
              }
              const ownedEntry = workingEntry;
              try {
                const capability = await post<CapabilityRequest>(
                  `${capabilityUrl}/v1/capability-requests`,
                  {
                    inputRef: ownedEntry.intake.intakeId,
                    actor: command.actor,
                    idempotencyKey: `${key}:capability`,
                    correlationId: command.correlationId
                  },
                  `${key}:capability`,
                  command.correlationId
                );
                const execution = await post<ExecutionRecord>(
                  `${executionUrl}/v1/executions`,
                  {
                    capabilityRequestId: capability.capabilityRequestId,
                    actor: command.actor,
                    idempotencyKey: `${key}:execution`,
                    correlationId: command.correlationId
                  },
                  `${key}:execution`,
                  command.correlationId
                );
                const packageValue = recommendation(
                  ownedEntry.intake,
                  [capability.capabilityRequestId, execution.executionId],
                  now()
                );
                const readyIntake: Intake = {
                  ...ownedEntry.intake,
                  status: 'RECOMMENDATION_READY'
                };
                const completedResult: IntakeRecommendationResponse = {
                  intake: readyIntake,
                  recommendation: packageValue,
                  trace: {
                    correlationId: command.correlationId,
                    capabilityRequestId: capability.capabilityRequestId,
                    executionId: execution.executionId,
                    provenanceRefs: packageValue.provenance
                  }
                };
                const event: EventEnvelope<
                  'markreg.recommendation.ready.v1',
                  RecommendationPackage
                > = {
                  eventId: `event_${randomUUID()}`,
                  eventType: 'markreg.recommendation.ready.v1',
                  occurredAt: now(),
                  correlationId: command.correlationId,
                  causationId: execution.executionId,
                  actor: command.actor,
                  schemaVersion: 1,
                  payload: packageValue
                };
                await publisher.publish(event);
                ownedEntry.intake = readyIntake;
                ownedEntry.result = completedResult;
                repository.save(key, ownedEntry);
                return json(201, completedResult);
              } catch (error) {
                ownedEntry.intake = { ...ownedEntry.intake, status: 'FAILED' };
                delete ownedEntry.result;
                repository.save(key, ownedEntry);
                throw error;
              }
            })();
            inFlight.set(key, { fingerprint, result });
            try {
              return await result;
            } finally {
              inFlight.delete(key);
            }
          }
        }
      ]
    }
  );
}
