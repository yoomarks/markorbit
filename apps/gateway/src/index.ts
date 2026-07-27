import { randomUUID } from 'node:crypto';
import {
  assertDirectIntake,
  parseIntakeCreateCommand,
  parseQuoteCreateCommand,
  parseQuoteConfirmationCommand,
  type QuoteCreateCommand,
  type QuoteConfirmationCommand,
  type IntakeCreateCommand
} from '@markorbit/contracts';
import { createServiceRuntime, HttpError, json } from '@markorbit/service-kit';
export const serviceManifest = Object.freeze({
  name: 'gateway',
  port: Number(process.env.PORT ?? '4000'),
  version: '0.1.0'
});
export interface GatewayOptions {
  port?: number;
  markRegUrl?: string;
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return value as Record<string, unknown>;
}
export function createRuntime(options: GatewayOptions = {}) {
  const markRegUrl = options.markRegUrl ?? process.env.MARKREG_URL ?? 'http://127.0.0.1:4105';
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        {
          method: 'POST',
          path: '/v1/markreg/quotes',
          async handle(request) {
            const key = request.headers['idempotency-key'];
            if (!key)
              throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
            const correlationId =
              request.headers['x-correlation-id'] || `correlation_${randomUUID()}`;
            let command: QuoteCreateCommand;
            try {
              command = parseQuoteCreateCommand({
                ...record(request.body),
                idempotencyKey: key,
                correlationId
              });
            } catch (error) {
              throw new HttpError(
                422,
                'INVALID_QUOTE_REQUEST',
                error instanceof Error ? error.message : 'Invalid quote request.'
              );
            }
            try {
              const downstream = await fetch(`${markRegUrl}/v1/quotes`, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'idempotency-key': key,
                  'x-correlation-id': correlationId
                },
                body: JSON.stringify(command)
              });
              return json(downstream.status, await downstream.json(), {
                'x-correlation-id': correlationId
              });
            } catch {
              throw new HttpError(
                502,
                'DOWNSTREAM_UNAVAILABLE',
                'Quote service is unavailable.',
                true
              );
            }
          }
        },
        {
          method: 'POST',
          path: '/v1/markreg/quotes/:quoteId/confirm',
          async handle(request) {
            const key = request.headers['idempotency-key'];
            if (!key)
              throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
            const correlationId =
              request.headers['x-correlation-id'] || `correlation_${randomUUID()}`;
            let command: QuoteConfirmationCommand;
            try {
              command = parseQuoteConfirmationCommand({
                ...record(request.body),
                quoteId: request.params.quoteId,
                idempotencyKey: key,
                correlationId
              });
            } catch (error) {
              throw new HttpError(
                422,
                'INVALID_CONFIRMATION_REQUEST',
                error instanceof Error ? error.message : 'Invalid confirmation request.'
              );
            }
            try {
              const downstream = await fetch(
                `${markRegUrl}/v1/quotes/${encodeURIComponent(command.quoteId)}/confirm`,
                {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    'idempotency-key': key,
                    'x-correlation-id': correlationId
                  },
                  body: JSON.stringify(command)
                }
              );
              return json(downstream.status, await downstream.json(), {
                'x-correlation-id': correlationId
              });
            } catch {
              throw new HttpError(
                502,
                'DOWNSTREAM_UNAVAILABLE',
                'Quote confirmation is unavailable.',
                true
              );
            }
          }
        },
        {
          method: 'POST',
          path: '/v1/markreg/intakes',
          async handle(request) {
            const key = request.headers['idempotency-key'];
            if (!key)
              throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
            const raw = record(request.body);
            const headerCorrelation = request.headers['x-correlation-id'];
            const correlationId =
              headerCorrelation && headerCorrelation.length > 0
                ? headerCorrelation
                : `correlation_${randomUUID()}`;
            let command: IntakeCreateCommand;
            try {
              command = parseIntakeCreateCommand({ ...raw, idempotencyKey: key, correlationId });
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
            let downstream: Response;
            try {
              downstream = await fetch(`${markRegUrl}/v1/intakes`, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'idempotency-key': key,
                  'x-correlation-id': command.correlationId
                },
                body: JSON.stringify(command)
              });
            } catch {
              throw new HttpError(502, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg is unavailable.', true);
            }
            const body = (await downstream.json()) as unknown;
            return json(downstream.status, body, { 'x-correlation-id': command.correlationId });
          }
        }
      ]
    }
  );
}
