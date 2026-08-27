import { timingSafeEqual } from 'node:crypto';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ManagedCommunicationExchangeError,
  type ManagedCommunicationExchangeV1,
  type ManagedCommunicationSendRequestV1,
  type ManagedCommunicationThreadEvidenceReaderV1
} from './managed-communication-exchange.js';

export interface ManagedCommunicationRoutesOptionsV1 {
  internalServiceSecret: string;
  exchange: Pick<ManagedCommunicationExchangeV1, 'send'>;
  threadReader: ManagedCommunicationThreadEvidenceReaderV1;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorize(request: JsonRequest, secret: string): void {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
}

function requiredHeader(
  request: JsonRequest,
  header: string,
  code: string,
  maxLength: number
): string {
  const value = request.headers[header]?.trim();
  if (!value || value.length > maxLength)
    throw new HttpError(400, code, `${header} must contain 1 to ${maxLength} characters.`);
  return value;
}

function record(body: unknown, name: string): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new HttpError(400, 'INVALID_COMMUNICATION_REQUEST', `${name} must be an object.`);
  return body as Record<string, unknown>;
}

function sendRequest(body: unknown): ManagedCommunicationSendRequestV1 {
  const value = record(body, 'communication send request');
  return value as unknown as ManagedCommunicationSendRequestV1;
}

function threadRequest(body: unknown): { accountRef: string; threadRef: string } {
  const value = record(body, 'communication thread resolution');
  if (
    Object.keys(value).some((key) => key !== 'accountRef' && key !== 'threadRef') ||
    typeof value.accountRef !== 'string' ||
    typeof value.threadRef !== 'string'
  )
    throw new HttpError(
      400,
      'INVALID_COMMUNICATION_THREAD_REQUEST',
      'Thread resolution must contain only accountRef and threadRef strings.'
    );
  return { accountRef: value.accountRef, threadRef: value.threadRef };
}

function exchangeError(error: unknown): never {
  if (!(error instanceof ManagedCommunicationExchangeError)) throw error;
  switch (error.code) {
    case 'INVALID_SEND_REQUEST':
    case 'WORKSPACE_MISMATCH':
      throw new HttpError(400, error.code, error.message, false);
    case 'IDEMPOTENCY_CONFLICT':
    case 'SEND_IN_PROGRESS':
    case 'RECONCILIATION_REQUIRED':
      throw new HttpError(409, error.code, error.message, error.retryable);
    case 'PROVIDER_RESULT_INVALID':
      throw new HttpError(502, error.code, error.message, false);
    case 'PERSISTENCE_UNAVAILABLE':
      throw new HttpError(503, error.code, error.message, error.retryable);
  }
}

export function createManagedCommunicationRoutesV1(
  options: ManagedCommunicationRoutesOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/managed-communication/sends',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        const workspaceId = requiredHeader(
          request,
          'x-markorbit-workspace-id',
          'WORKSPACE_ID_REQUIRED',
          500
        );
        const idempotencyKey = requiredHeader(
          request,
          'idempotency-key',
          'IDEMPOTENCY_KEY_REQUIRED',
          500
        );
        const correlationId = requiredHeader(
          request,
          'x-correlation-id',
          'CORRELATION_ID_REQUIRED',
          300
        );
        try {
          const receipt = await options.exchange.send({
            workspaceId,
            idempotencyKey,
            correlationId,
            request: sendRequest(request.body)
          });
          return json(200, receipt);
        } catch (error) {
          return exchangeError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/managed-communication/thread-resolutions',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        const workspaceId = requiredHeader(
          request,
          'x-markorbit-workspace-id',
          'WORKSPACE_ID_REQUIRED',
          500
        );
        const input = threadRequest(request.body);
        try {
          const messages = await options.threadReader.resolveThread({ workspaceId, ...input });
          return json(200, {
            schemaVersion: 1,
            workspaceId,
            accountRef: input.accountRef,
            threadRef: input.threadRef,
            messages
          });
        } catch (error) {
          return exchangeError(error);
        }
      }
    }
  ];
}
