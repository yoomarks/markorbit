import { createHash, randomUUID } from 'node:crypto';
import {
  assertDirectIntake,
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
  type QuoteCreateCommand
} from '@markorbit/contracts';
import { InMemoryEventPublisher, type EventPublisher } from '@markorbit/events';
import { createServiceRuntime, HttpError, json, type JsonResult } from '@markorbit/service-kit';
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
}

const money = (amountMinor: number, currency = 'USD') => ({ amountMinor, currency });
function fixtureQuote(command: QuoteCreateCommand, timestamp: string): PlanQuoteResponse {
  const factor = { A: 1, B: 2, C: 3 }[command.selectedOptionCode];
  const official = 35000 * factor,
    service = 50000 * factor,
    disbursement = 5000 * factor;
  const taxes = Math.trunc(service / 10),
    subtotal = official + service + disbursement;
  const stable = createHash('sha256')
    .update(`${command.intakeId}:${command.recommendationId}:${command.selectedOptionCode}`)
    .digest('hex')
    .slice(0, 20);
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
    quoteId: `quote_${stable}`,
    intakeId: command.intakeId,
    recommendationId: command.recommendationId,
    selectedOptionCode: command.selectedOptionCode,
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
      'Estimate only; official fees, professional fees and disbursements require review before filing.'
    ],
    validUntil: new Date(Date.parse(timestamp) + 14 * 86400000).toISOString(),
    fixtureOnly: true,
    createdAt: timestamp
  };
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
  const capabilityUrl =
    options.capabilityEngineUrl ?? process.env.CAPABILITY_ENGINE_URL ?? 'http://127.0.0.1:4103';
  const executionUrl = options.executionUrl ?? process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104';
  const inFlight = new Map<string, { fingerprint: string; result: Promise<JsonResult> }>();
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        {
          method: 'POST',
          path: '/v1/quotes',
          handle(request) {
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
            const result = fixtureQuote(command, now());
            repository.supersedeQuotes(
              command.intakeId,
              command.recommendationId,
              result.quote.quoteId
            );
            repository.saveQuoteEntry(key, { fingerprint, result });
            return json(201, result);
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
            if (Date.parse(quote.validUntil) <= Date.parse(now())) {
              repository.saveQuote({ ...quote, status: 'EXPIRED' });
              throw new HttpError(409, 'QUOTE_EXPIRED', 'This quote has expired.');
            }
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
