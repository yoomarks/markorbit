import { timingSafeEqual } from 'node:crypto';
import {
  ManagedCommunicationContractError,
  parseManagedCommunicationMessageV1,
  type ManagedCommunicationMessageV1
} from '@markorbit/contracts/managed-communication';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ManagedCommunicationExchangeError,
  type ManagedCommunicationExchangeV1,
  type ManagedCommunicationSendRequestV1,
  type ManagedCommunicationThreadEvidenceReaderV1
} from './managed-communication-exchange.js';
import {
  ManagedCommunicationExactEvidenceError,
  type ManagedCommunicationExactEvidenceStoreV1
} from './managed-communication-exact-evidence.js';
import { ManagedCommunicationFoundationError } from './managed-communication-foundation.js';
import type { ManagedCommunicationInboundIngestorV1 } from './managed-communication-inbound.js';

export const MANAGED_COMMUNICATION_INBOUND_MAX_RAW_BYTES = 32 * 1024 * 1024;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export interface ManagedCommunicationRoutesOptionsV1 {
  internalServiceSecret: string;
  exchange?: Pick<ManagedCommunicationExchangeV1, 'send'>;
  inbound?: Pick<ManagedCommunicationInboundIngestorV1, 'ingest'>;
  threadReader?: ManagedCommunicationThreadEvidenceReaderV1;
  exactEvidence?: Pick<ManagedCommunicationExactEvidenceStoreV1, 'resolveExactEvidence'>;
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

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], name: string): void {
  const accepted = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !accepted.has(key));
  if (unsupported.length > 0) {
    throw new HttpError(
      400,
      'INVALID_COMMUNICATION_REQUEST',
      `${name} contains unsupported fields: ${unsupported.join(', ')}.`
    );
  }
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

function rawPayload(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new HttpError(
      400,
      'INVALID_COMMUNICATION_EXACT_EVIDENCE',
      'exactEvidence.rawPayloadBase64 must be a non-empty canonical base64 string.'
    );
  }
  if (!BASE64.test(value)) {
    throw new HttpError(
      400,
      'INVALID_COMMUNICATION_EXACT_EVIDENCE',
      'exactEvidence.rawPayloadBase64 is not canonical base64.'
    );
  }
  const bytes = Buffer.from(value, 'base64');
  if (
    bytes.byteLength < 1 ||
    bytes.byteLength > MANAGED_COMMUNICATION_INBOUND_MAX_RAW_BYTES ||
    bytes.toString('base64') !== value
  ) {
    throw new HttpError(
      400,
      'INVALID_COMMUNICATION_EXACT_EVIDENCE',
      `Exact Communication evidence must contain 1 to ${MANAGED_COMMUNICATION_INBOUND_MAX_RAW_BYTES} decoded bytes.`
    );
  }
  return Uint8Array.from(bytes);
}

function headers(value: unknown): readonly Readonly<{ name: string; value: string }>[] {
  if (!Array.isArray(value)) {
    throw new HttpError(
      400,
      'INVALID_COMMUNICATION_EXACT_EVIDENCE',
      'exactEvidence.headers must be an array.'
    );
  }
  return value.map((item, index) => {
    const header = record(item, `exactEvidence.headers[${index}]`);
    exactKeys(header, ['name', 'value'], `exactEvidence.headers[${index}]`);
    if (typeof header.name !== 'string' || typeof header.value !== 'string') {
      throw new HttpError(
        400,
        'INVALID_COMMUNICATION_EXACT_EVIDENCE',
        `exactEvidence.headers[${index}] must contain string name/value fields.`
      );
    }
    return Object.freeze({ name: header.name, value: header.value });
  });
}

function metadata(value: unknown): Readonly<Record<string, string>> | undefined {
  if (value === undefined) return undefined;
  const source = record(value, 'exactEvidence.metadata');
  for (const [key, item] of Object.entries(source)) {
    if (typeof item !== 'string') {
      throw new HttpError(
        400,
        'INVALID_COMMUNICATION_EXACT_EVIDENCE',
        `exactEvidence.metadata.${key} must be a string.`
      );
    }
  }
  return source as Record<string, string>;
}

function inboundRequest(body: unknown): Readonly<{
  message: ManagedCommunicationMessageV1;
  exactEvidence: Readonly<{
    rawPayload: Uint8Array;
    mediaType: string;
    headers: readonly Readonly<{ name: string; value: string }>[];
    metadata?: Readonly<Record<string, string>>;
  }>;
}> {
  const value = record(body, 'communication inbound request');
  exactKeys(value, ['message', 'exactEvidence'], 'communication inbound request');
  const exactEvidence = record(value.exactEvidence, 'exactEvidence');
  exactKeys(
    exactEvidence,
    ['rawPayloadBase64', 'mediaType', 'headers', 'metadata'],
    'exactEvidence'
  );
  if (typeof exactEvidence.mediaType !== 'string') {
    throw new HttpError(
      400,
      'INVALID_COMMUNICATION_EXACT_EVIDENCE',
      'exactEvidence.mediaType must be a string.'
    );
  }
  const exactMetadata = metadata(exactEvidence.metadata);
  return Object.freeze({
    message: parseManagedCommunicationMessageV1(value.message),
    exactEvidence: Object.freeze({
      rawPayload: rawPayload(exactEvidence.rawPayloadBase64),
      mediaType: exactEvidence.mediaType,
      headers: headers(exactEvidence.headers),
      ...(exactMetadata === undefined ? {} : { metadata: exactMetadata })
    })
  });
}

function communicationError(error: unknown): never {
  if (error instanceof ManagedCommunicationContractError) {
    throw new HttpError(400, 'INVALID_COMMUNICATION_REQUEST', error.message, false);
  }
  if (error instanceof ManagedCommunicationFoundationError) {
    switch (error.code) {
      case 'INVALID_OBSERVATION':
      case 'WORKSPACE_MISMATCH':
        throw new HttpError(400, error.code, error.message, false);
      case 'ACCOUNT_NOT_FOUND':
      case 'MESSAGE_NOT_FOUND':
        throw new HttpError(404, error.code, error.message, false);
      case 'ACCOUNT_CONFLICT':
      case 'IDEMPOTENCY_CONFLICT':
      case 'PROVIDER_OBSERVATION_CONFLICT':
      case 'CHECKPOINT_CONFLICT':
        throw new HttpError(409, error.code, error.message, false);
      case 'PERSISTENCE_UNAVAILABLE':
      case 'INVALID_PERSISTED_STATE':
        throw new HttpError(503, error.code, error.message, true);
    }
  }
  if (error instanceof ManagedCommunicationExactEvidenceError) {
    switch (error.code) {
      case 'INVALID_EXACT_EVIDENCE':
      case 'NORMALIZED_MESSAGE_NOT_FOUND':
      case 'PROVENANCE_MISMATCH':
      case 'EXACT_EVIDENCE_CONFLICT':
        throw new HttpError(409, error.code, error.message, false);
      case 'PERSISTENCE_UNAVAILABLE':
        throw new HttpError(503, error.code, error.message, true);
    }
  }
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
  if (Boolean(options.threadReader) !== Boolean(options.exactEvidence)) {
    throw new Error(
      'Managed Communication threadReader and exactEvidence resolver must be configured together.'
    );
  }

  const routes: JsonRoute[] = [];
  if (options.exchange) {
    routes.push({
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
          const receipt = await options.exchange!.send({
            workspaceId,
            idempotencyKey,
            correlationId,
            request: sendRequest(request.body)
          });
          return json(200, receipt);
        } catch (error) {
          return communicationError(error);
        }
      }
    });
  }

  if (options.inbound) {
    routes.push({
      method: 'POST',
      path: '/internal/v1/managed-communication/observations',
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
        try {
          const input = inboundRequest(request.body);
          const admission = await options.inbound!.ingest({
            workspaceId,
            idempotencyKey,
            message: input.message,
            exactEvidence: input.exactEvidence
          });
          return json(200, admission);
        } catch (error) {
          return communicationError(error);
        }
      }
    });
  }

  if (options.threadReader && options.exactEvidence) {
    routes.push({
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
          const normalized = await options.threadReader!.resolveThread({ workspaceId, ...input });
          const messages = await Promise.all(
            normalized.map(async (message) => {
              const exactEvidence = await options.exactEvidence!.resolveExactEvidence({
                workspaceId,
                accountRef: input.accountRef,
                messageId: message.messageId
              });
              return Object.freeze({
                ...message,
                ...(exactEvidence === undefined ? {} : { exactEvidence })
              });
            })
          );
          return json(200, {
            schemaVersion: 1,
            workspaceId,
            accountRef: input.accountRef,
            threadRef: input.threadRef,
            messages
          });
        } catch (error) {
          return communicationError(error);
        }
      }
    });
  }

  return routes;
}
