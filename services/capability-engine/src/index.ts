import { randomUUID } from 'node:crypto';
import {
  parseCapabilityRequestCommand,
  type CapabilityRequest,
  type CapabilityRequestCommand,
  type EventEnvelope
} from '@markorbit/contracts';
import { InMemoryEventPublisher, type EventPublisher } from '@markorbit/events';
import { createServiceRuntime, HttpError, json, type JsonResult } from '@markorbit/service-kit';

export const serviceManifest = Object.freeze({
  name: 'capability-engine',
  port: Number(process.env.PORT ?? '4103'),
  version: '0.1.0'
});
interface Entry {
  fingerprint: string;
  record: CapabilityRequest;
}
export class InMemoryCapabilityRequestRepository {
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
}
export interface CapabilityEngineOptions {
  port?: number;
  repository?: InMemoryCapabilityRequestRepository;
  publisher?: EventPublisher;
  now?: () => string;
}
export function createRuntime(options: CapabilityEngineOptions = {}) {
  const repository = options.repository ?? new InMemoryCapabilityRequestRepository();
  const publisher = options.publisher ?? new InMemoryEventPublisher();
  const now = options.now ?? (() => new Date().toISOString());
  const inFlight = new Map<string, { fingerprint: string; result: Promise<JsonResult> }>();
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        {
          method: 'POST',
          path: '/v1/capability-requests',
          async handle(request) {
            let command: CapabilityRequestCommand;
            try {
              command = parseCapabilityRequestCommand(request.body);
            } catch (error) {
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                error instanceof Error ? error.message : 'Invalid request.'
              );
            }
            const header = request.headers['idempotency-key'];
            if (!header || header !== command.idempotencyKey)
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                'Idempotency-Key header is required and must match the command.'
              );
            const fingerprint = JSON.stringify({ ...command, idempotencyKey: undefined });
            const existing = repository.get(header);
            if (existing) {
              if (existing.fingerprint !== fingerprint)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Idempotency key was already used with a different payload.'
                );
              return json(200, existing.record);
            }
            const pending = inFlight.get(header);
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
              const record: CapabilityRequest = {
                capabilityRequestId: `capreq_${randomUUID()}`,
                capabilityId: 'trademark-application-recommendation',
                capabilityVersion: '0.1.0-fixture',
                inputRef: command.inputRef,
                status: 'ACCEPTED',
                correlationId: command.correlationId,
                createdAt: now()
              };
              const event: EventEnvelope<'capability.request.accepted.v1', CapabilityRequest> = {
                eventId: `event_${randomUUID()}`,
                eventType: 'capability.request.accepted.v1',
                occurredAt: now(),
                correlationId: command.correlationId,
                causationId: command.inputRef,
                actor: command.actor,
                schemaVersion: 1,
                payload: record
              };
              await publisher.publish(event);
              repository.save(header, { fingerprint, record });
              return json(201, record);
            })();
            inFlight.set(header, { fingerprint, result });
            try {
              return await result;
            } finally {
              inFlight.delete(header);
            }
          }
        }
      ]
    }
  );
}
