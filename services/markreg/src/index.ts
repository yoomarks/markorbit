import { randomUUID } from 'node:crypto';
import {
  assertDirectIntake,
  parseIntakeCreateCommand,
  type CapabilityRequest,
  type EventEnvelope,
  type ExecutionRecord,
  type Intake,
  type IntakeCreateCommand,
  type IntakeRecommendationResponse,
  type RecommendationPackage
} from '@markorbit/contracts';
import { InMemoryEventPublisher, type EventPublisher } from '@markorbit/events';
import { createServiceRuntime, HttpError, json } from '@markorbit/service-kit';
export const serviceManifest = Object.freeze({
  name: 'markreg',
  port: Number(process.env.PORT ?? '4105'),
  version: '0.1.0'
});
interface Entry {
  fingerprint: string;
  intake: Intake;
  result?: IntakeRecommendationResponse;
}
export class InMemoryMarkRegRepository {
  private readonly entries = new Map<string, Entry>();
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
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
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
            let entry = repository.get(key);
            if (entry && entry.fingerprint !== fingerprint)
              throw new HttpError(
                409,
                'IDEMPOTENCY_CONFLICT',
                'Idempotency key was already used with a different payload.'
              );
            if (entry?.result) return json(200, entry.result);
            if (!entry) {
              const intake: Intake = {
                intakeId: `intake_${randomUUID()}`,
                channel: command.channel,
                relationshipModel: command.relationshipModel,
                status: 'RECEIVED',
                customerIntent: command.customerIntent,
                createdAt: now(),
                correlationId: command.correlationId
              };
              entry = { fingerprint, intake };
              repository.save(key, entry);
              const event: EventEnvelope<'markreg.intake.created.v1', Intake> = {
                eventId: `event_${randomUUID()}`,
                eventType: 'markreg.intake.created.v1',
                occurredAt: now(),
                correlationId: command.correlationId,
                actor: command.actor,
                schemaVersion: 1,
                payload: intake
              };
              await publisher.publish(event);
            }
            try {
              const capability = await post<CapabilityRequest>(
                `${capabilityUrl}/v1/capability-requests`,
                {
                  inputRef: entry.intake.intakeId,
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
                entry.intake,
                [capability.capabilityRequestId, execution.executionId],
                now()
              );
              entry.intake = { ...entry.intake, status: 'RECOMMENDATION_READY' };
              entry.result = {
                intake: entry.intake,
                recommendation: packageValue,
                trace: {
                  correlationId: command.correlationId,
                  capabilityRequestId: capability.capabilityRequestId,
                  executionId: execution.executionId,
                  provenanceRefs: packageValue.provenance
                }
              };
              const event: EventEnvelope<'markreg.recommendation.ready.v1', RecommendationPackage> =
                {
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
              repository.save(key, entry);
              return json(201, entry.result);
            } catch (error) {
              entry.intake = { ...entry.intake, status: 'FAILED' };
              repository.save(key, entry);
              throw error;
            }
          }
        }
      ]
    }
  );
}
