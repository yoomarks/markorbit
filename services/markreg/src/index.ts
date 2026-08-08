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
export * from './order-persistence.js';
export * from './order-service.js';
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
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Audit persistence is unavailable.');
            const principal = durablePrincipal(request);
            if (!principal.permissions.includes('audit:read'))
              throw new HttpError(403, 'PERMISSION_DENIED', 'audit:read permission is required.');
            const query = request.query as MarkRegAuditQuery;
            return durable(() => auditRepository.list(principal.workspaceId, query));
          }
        },
        {
          method: 'POST',
          path: '/v1/intakes',
          handle: async (request) => {
            const command = parseIntakeCreateCommand(request.body);
            assertDirectIntake(command);
            const fingerprint = JSON.stringify(command);
            const previous = repository.get(command.idempotencyKey);
            if (previous) {
              if (previous.fingerprint !== fingerprint)
                throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was reused.');
              if (previous.result) return json(200, previous.result);
            }
            const active = inFlight.get(command.idempotencyKey);
            if (active) {
              if (active.fingerprint !== fingerprint)
                throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was reused.');
              return active.result;
            }
            const result = (async () => {
              const timestamp = now();
              const intake: Intake = {
                intakeId: `intake_${randomUUID()}`,
                channel: command.channel,
                relationshipModel: command.relationshipModel,
                status: 'RECEIVED',
                customerIntent: command.customerIntent,
                createdAt: timestamp,
                correlationId: command.correlationId
              };
              const created = {
                schemaVersion: 1 as const,
                eventId: `event_${randomUUID()}` as const,
                eventType: 'IntakeCreated' as const,
                occurredAt: timestamp,
                correlationId: command.correlationId,
                actor: command.actor,
                payload: {
                  intakeId: intake.intakeId,
                  channel: intake.channel,
                  relationshipModel: intake.relationshipModel
                }
              } satisfies EventEnvelope<
                'IntakeCreated',
                { intakeId: string; channel: string; relationshipModel: string }
              >;
              repository.save(command.idempotencyKey, {
                fingerprint,
                intake,
                intakeCreatedPublished: false
              });
              await publisher.publish(created);
              const entry = repository.get(command.idempotencyKey)!;
              entry.intakeCreatedPublished = true;
              const capabilityRequest = await post<CapabilityRequest>(
                `${capabilityUrl}/v1/capability-requests`,
                {
                  inputRef: intake.intakeId,
                  actor: command.actor,
                  idempotencyKey: `${command.idempotencyKey}:capability`,
                  correlationId: command.correlationId
                },
                `${command.idempotencyKey}:capability`,
                command.correlationId
              );
              const execution = await post<ExecutionRecord>(
                `${executionUrl}/v1/executions`,
                {
                  capabilityRequestId: capabilityRequest.capabilityRequestId,
                  actor: command.actor,
                  idempotencyKey: `${command.idempotencyKey}:execution`,
                  correlationId: command.correlationId
                },
                `${command.idempotencyKey}:execution`,
                command.correlationId
              );
              const finalIntake = { ...intake, status: 'RECOMMENDATION_READY' as const };
              const response: IntakeRecommendationResponse = {
                intake: finalIntake,
                recommendation: recommendation(
                  finalIntake,
                  [capabilityRequest.capabilityRequestId, execution.executionId],
                  timestamp
                ),
                trace: {
                  correlationId: command.correlationId,
                  capabilityRequestId: capabilityRequest.capabilityRequestId,
                  executionId: execution.executionId,
                  provenanceRefs: [capabilityRequest.capabilityRequestId, execution.executionId]
                }
              };
              repository.save(command.idempotencyKey, {
                fingerprint,
                intake: finalIntake,
                intakeCreatedPublished: true,
                result: response
              });
              return json(201, response);
            })().finally(() => inFlight.delete(command.idempotencyKey));
            inFlight.set(command.idempotencyKey, { fingerprint, result });
            return result;
          }
        },
        {
          method: 'POST',
          path: '/v1/quotes',
          handle: async (request) => {
            const command = parseQuoteCreateCommand(request.body);
            const fingerprint = JSON.stringify(command);
            const previous = repository.getQuoteEntry(command.idempotencyKey);
            if (previous) {
              if (previous.fingerprint !== fingerprint)
                throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was reused.');
              return json(200, previous.result);
            }
            const active = quoteInFlight.get(command.idempotencyKey);
            if (active) {
              if (active.fingerprint !== fingerprint)
                throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was reused.');
              return active.result;
            }
            const result = (async () => {
              const recommendation = repository.findRecommendation(
                command.intakeId,
                command.recommendationId
              );
              if (!recommendation)
                throw new HttpError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation was not found.');
              const quoted = fixtureQuote(command, now(), pricingRuleVersion);
              await options.beforeQuotePersist?.(command);
              repository.supersedeQuotes(command.intakeId, command.recommendationId, quoted.quote.quoteId);
              repository.saveQuoteEntry(command.idempotencyKey, {
                fingerprint,
                result: quoted
              });
              return json(201, quoted);
            })().finally(() => quoteInFlight.delete(command.idempotencyKey));
            quoteInFlight.set(command.idempotencyKey, { fingerprint, result });
            return result;
          }
        },
        {
          method: 'POST',
          path: '/v1/quotes/:quoteId/confirmations',
          handle: (request) => {
            const command = parseQuoteConfirmationCommand(request.body, request.params.quoteId!);
            const fingerprint = JSON.stringify(command);
            const prior = repository.getConfirmation(command.idempotencyKey);
            if (prior) {
              if (JSON.stringify(prior.value) === fingerprint)
                throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was reused.');
              return json(200, prior.value);
            }
            const quote = repository.getQuote(command.quoteId);
            if (!quote) throw new HttpError(404, 'QUOTE_NOT_FOUND', 'Quote was not found.');
            if (quote.status !== 'READY')
              throw new HttpError(409, 'QUOTE_NOT_CONFIRMABLE', 'Quote cannot be confirmed.');
            const timestamp = now();
            const confirmation: QuoteConfirmation = {
              quoteId: quote.quoteId,
              status: 'CONFIRMED',
              confirmedAt: timestamp,
              pendingProfessionalReview: true,
              orderCreated: noAutomaticConsequences.orderCreated,
              paymentMade: noAutomaticConsequences.paymentCreated,
              filingStarted: noAutomaticConsequences.filingCreated
            };
            repository.saveQuote({ ...quote, status: 'CONFIRMED' });
            repository.saveConfirmation(command.idempotencyKey, confirmation);
            return json(201, confirmation);
          }
        },
        {
          method: 'GET',
          path: '/v1/customer-confirmations/:confirmationId',
          handle: (request) => {
            if (!durableConfirmations)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Customer Confirmation persistence is unavailable.'
              );
            const principal = durablePrincipal(request);
            return durable(() =>
              durableConfirmations.get(principal, principal.workspaceId, request.params.confirmationId!)
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/customer-confirmations',
          handle: (request) => {
            if (!durableConfirmations)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Customer Confirmation persistence is unavailable.'
              );
            const principal = durablePrincipal(request);
            const input = request.body as Parameters<CustomerConfirmationService['create']>[1];
            return durable(() =>
              durableConfirmations.create(principal, { ...input, workspaceId: principal.workspaceId })
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/customer-confirmations/:confirmationId/withdraw',
          handle: (request) => {
            if (!durableConfirmations)
              throw new HttpError(
                503,
                'PERSISTENCE_UNAVAILABLE',
                'Customer Confirmation persistence is unavailable.'
              );
            const principal = durablePrincipal(request);
            const body = request.body as { expectedVersion: number };
            return durable(() =>
              durableConfirmations.withdraw(
                principal,
                principal.workspaceId,
                request.params.confirmationId!,
                body.expectedVersion
              )
            );
          }
        },
        {
          method: 'GET',
          path: '/v1/matter-drafts/:matterDraftId',
          handle: (request) => {
            if (!durableDrafts)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Matter Draft persistence is unavailable.');
            const principal = durablePrincipal(request);
            return durable(() =>
              durableDrafts.get(principal, principal.workspaceId, request.params.matterDraftId!)
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/matter-drafts',
          handle: (request) => {
            if (!durableDrafts)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Matter Draft persistence is unavailable.');
            const principal = durablePrincipal(request);
            const input = request.body as Parameters<MatterDraftService['create']>[1];
            return durable(() =>
              durableDrafts.create(principal, { ...input, workspaceId: principal.workspaceId })
            );
          }
        },
        {
          method: 'PATCH',
          path: '/v1/matter-drafts/:matterDraftId',
          handle: (request) => {
            if (!durableDrafts)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Matter Draft persistence is unavailable.');
            const principal = durablePrincipal(request);
            const input = request.body as Parameters<MatterDraftService['update']>[1];
            return durable(() =>
              durableDrafts.update(principal, {
                ...input,
                workspaceId: principal.workspaceId,
                matterDraftId: request.params.matterDraftId!
              })
            );
          }
        },
        {
          method: 'GET',
          path: '/v1/formal-matters',
          handle: (request) => {
            if (!formalMatters)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Formal Matter persistence is unavailable.');
            const principal = durablePrincipal(request);
            const page = Number(request.query.page ?? '1'),
              pageSize = Number(request.query.pageSize ?? '20');
            if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
              throw new HttpError(400, 'INVALID_QUERY', 'Invalid pagination.');
            const query = { page, pageSize } as Parameters<FormalMatterService['list']>[2];
            if (request.query.status) query.status = request.query.status as never;
            if (request.query.type) query.type = request.query.type as never;
            if (request.query.search) query.search = request.query.search;
            if (request.query.createdFrom) query.createdFrom = request.query.createdFrom;
            if (request.query.createdTo) query.createdTo = request.query.createdTo;
            return durable(() => formalMatters.list(principal, principal.workspaceId, query));
          }
        },
        {
          method: 'GET',
          path: '/v1/formal-matters/:formalMatterId',
          handle: (request) => {
            if (!formalMatters)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Formal Matter persistence is unavailable.');
            const principal = durablePrincipal(request);
            return durable(() =>
              formalMatters.get(principal, principal.workspaceId, request.params.formalMatterId!)
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/formal-matters',
          handle: (request) => {
            if (!formalMatters)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Formal Matter persistence is unavailable.');
            const principal = durablePrincipal(request);
            const body = request.body as CreateFormalMatterCommand;
            const command: CreateFormalMatterCommand = { ...body, workspaceId: principal.workspaceId };
            const correlationId = request.headers['x-correlation-id'];
            return durable(() =>
              auditedMutation(
                principal,
                'FORMAL_MATTER_CREATE',
                'FORMAL_MATTER',
                undefined,
                command.idempotencyKey,
                command,
                correlationId,
                () => formalMatters.create(principal, command, correlationId)
              )
            );
          }
        },
        {
          method: 'GET',
          path: '/v1/document-packages',
          handle: (request) => {
            if (!durablePackages)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Document Package persistence is unavailable.');
            const principal = durablePrincipal(request);
            return durable(() => durablePackages.list(principal));
          }
        },
        {
          method: 'GET',
          path: '/v1/document-packages/:packageId',
          handle: (request) => {
            if (!durablePackages)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Document Package persistence is unavailable.');
            const principal = durablePrincipal(request);
            return durable(() => durablePackages.get(principal, request.params.packageId!));
          }
        },
        {
          method: 'POST',
          path: '/v1/document-packages',
          handle: (request) => {
            if (!durablePackages)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Document Package persistence is unavailable.');
            const principal = durablePrincipal(request);
            const body = request.body as { formalMatterId: string; idempotencyKey: string };
            return durable(() =>
              auditedMutation(
                principal,
                'DOCUMENT_PACKAGE_CREATE',
                'DOCUMENT_PACKAGE',
                undefined,
                body.idempotencyKey,
                body,
                request.headers['x-correlation-id'],
                () => durablePackages.create(principal, body.formalMatterId as never, body.idempotencyKey, request.headers['x-correlation-id'])
              )
            );
          }
        },
        {
          method: 'PATCH',
          path: '/v1/document-packages/:packageId',
          handle: (request) => {
            if (!durablePackages)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Document Package persistence is unavailable.');
            const principal = durablePrincipal(request);
            const body = request.body as { expectedVersion: number; draft: unknown; idempotencyKey: string };
            return durable(() =>
              auditedMutation(
                principal,
                'DOCUMENT_PACKAGE_UPDATE_DRAFT',
                'DOCUMENT_PACKAGE',
                request.params.packageId,
                body.idempotencyKey,
                body,
                request.headers['x-correlation-id'],
                () => durablePackages.updateDraft(principal, request.params.packageId as never, body.expectedVersion, body.draft, body.idempotencyKey, request.headers['x-correlation-id'])
              )
            );
          }
        },
        {
          method: 'PUT',
          path: '/v1/document-packages/:packageId/documents/:documentId',
          handle: (request) => {
            if (!durablePackages)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Document Package persistence is unavailable.');
            const principal = durablePrincipal(request);
            const body = request.body as { expectedPackageVersion: number; expectedDocumentVersion?: number; document: unknown; idempotencyKey: string };
            return durable(() =>
              auditedMutation(
                principal,
                'DOCUMENT_EVIDENCE_UPSERT',
                'DOCUMENT_EVIDENCE',
                request.params.documentId,
                body.idempotencyKey,
                body,
                request.headers['x-correlation-id'],
                () => durablePackages.upsertDocument(principal, request.params.packageId as never, request.params.documentId as never, body.expectedPackageVersion, body.document as never, body.idempotencyKey, body.expectedDocumentVersion, request.headers['x-correlation-id'])
              )
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/document-packages/:packageId/instructions',
          handle: (request) => {
            if (!durablePackages)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Document Package persistence is unavailable.');
            const principal = durablePrincipal(request);
            const body = request.body as { expectedVersion: number; instruction: { instructionType: CustomerInstructionType; structuredPayload: unknown; note?: string; supersedesInstructionEntryId?: string }; idempotencyKey: string };
            return durable(() =>
              auditedMutation(
                principal,
                body.instruction.supersedesInstructionEntryId ? 'INSTRUCTION_SUPERSEDE' : 'INSTRUCTION_APPEND',
                'INSTRUCTION_LEDGER',
                request.params.packageId,
                body.idempotencyKey,
                body,
                request.headers['x-correlation-id'],
                () => durablePackages.appendInstruction(principal, request.params.packageId as never, body.expectedVersion, body.instruction, body.idempotencyKey, request.headers['x-correlation-id'])
              )
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/document-packages/:packageId/readiness',
          handle: (request) => {
            if (!durablePackages)
              throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Document Package persistence is unavailable.');
            const principal = durablePrincipal(request);
            const body = request.body as { expectedVersion: number; idempotencyKey: string };
            return durable(() =>
              auditedMutation(
                principal,
                'DOCUMENT_PACKAGE_MARK_READY',
                'DOCUMENT_PACKAGE',
                request.params.packageId,
                body.idempotencyKey,
                body,
                request.headers['x-correlation-id'],
                () => durablePackages.markReady(principal, request.params.packageId as never, body.expectedVersion, body.idempotencyKey, request.headers['x-correlation-id'])
              )
            );
          }
        },
        {
          method: 'POST',
          path: '/v1/matter-drafts/from-confirmation',
          handle: (request) => governed(() => matterFlow.createMatterDraft(request.body as never))
        },
        {
          method: 'PATCH',
          path: '/v1/matter-drafts/:matterDraftId/preparation',
          handle: (request) => governed(() => matterFlow.updatePreparation(request.body as never))
        },
        {
          method: 'POST',
          path: '/v1/matter-drafts/:matterDraftId/readiness',
          handle: (request) => governed(() => matterFlow.evaluateReadiness(request.body as never))
        },
        {
          method: 'POST',
          path: '/v1/preparation-packages',
          handle: (request) => prepared(() => preparation.createPackage(request.body as CreatePackageCommand))
        },
        {
          method: 'POST',
          path: '/v1/preparation-locks',
          handle: (request) => prepared(() => preparation.lock(request.body as never))
        }
      ]
    }
  );
}
