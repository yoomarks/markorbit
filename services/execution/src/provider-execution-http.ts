import { timingSafeEqual } from 'node:crypto';
import type {
  HandoffProviderReturnEvidenceCommand,
  ProviderExecutionSourceSnapshot,
  ProviderReturn
} from '@markorbit/contracts/provider-execution';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProviderReturnEvidenceError,
  type ProviderReturnEvidenceService
} from './provider-return-evidence.js';
import type { ProviderExecutionSourceVerificationService } from './provider-execution-source.js';

export interface ExecutionProviderInternalRouteOptions {
  internalServiceSecret: string;
  sourceVerificationFor(workspaceId: string): ProviderExecutionSourceVerificationService;
  providerReturnEvidenceFor(workspaceId: string): ProviderReturnEvidenceService;
}

type Body = Record<string, unknown>;

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function trusted(configured: string, supplied: string | undefined) {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function workspaceOf(request: JsonRequest, body?: Body) {
  const workspaceId =
    request.headers['x-markorbit-workspace-id'] ??
    (typeof body?.workspaceId === 'string' ? body.workspaceId : undefined);
  if (!workspaceId)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  return workspaceId.toLowerCase();
}

function requireInternal(request: JsonRequest, secret: string) {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(401, 'UNTRUSTED_INTERNAL_CALLER', 'Trusted internal authorization is required.');
}

function ensureWorkspace(workspaceId: string, actual: unknown) {
  if (typeof actual !== 'string' || actual.toLowerCase() !== workspaceId)
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
}

function evidenceError(error: unknown): never {
  if (error instanceof ProviderReturnEvidenceError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

export function createExecutionProviderInternalRoutes(
  options: ExecutionProviderInternalRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/provider-execution-source/verify',
      handle: async (request) => {
        requireInternal(request, options.internalServiceSecret);
        const body = bodyOf(request);
        const source = body.source as ProviderExecutionSourceSnapshot | undefined;
        if (!source || typeof source !== 'object')
          throw new HttpError(400, 'INVALID_REQUEST', 'source is required.');
        const workspaceId = workspaceOf(request, body);
        ensureWorkspace(workspaceId, source.workspaceId);
        try {
          return json(
            200,
            await options.sourceVerificationFor(workspaceId).verifyCurrentSource(source)
          );
        } catch {
          throw new HttpError(
            503,
            'EXECUTION_SOURCE_VERIFICATION_UNAVAILABLE',
            'Execution source verification is unavailable.',
            true
          );
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/provider-return-evidence/handoff',
      handle: async (request) => {
        requireInternal(request, options.internalServiceSecret);
        const body = bodyOf(request);
        const command = body.command as HandoffProviderReturnEvidenceCommand | undefined;
        const providerReturn = body.providerReturn as
          | (ProviderReturn & { providerActorId: string })
          | undefined;
        if (!command || !providerReturn)
          throw new HttpError(400, 'INVALID_REQUEST', 'command and providerReturn are required.');
        const workspaceId = workspaceOf(request, body);
        ensureWorkspace(workspaceId, command.workspaceId);
        ensureWorkspace(workspaceId, providerReturn.workspaceId);
        try {
          const evidenceHandoff = await options
            .providerReturnEvidenceFor(workspaceId)
            .handoffProviderReturnEvidence({ command, providerReturn });
          return json(201, { evidenceHandoff });
        } catch (error) {
          return evidenceError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/provider-return-evidence/:evidenceHandoffId',
      handle: async (request) => {
        requireInternal(request, options.internalServiceSecret);
        const workspaceId = workspaceOf(request);
        try {
          const receipt = await options
            .providerReturnEvidenceFor(workspaceId)
            .getReceipt(request.params.evidenceHandoffId! as never);
          if (!receipt || receipt.evidenceHandoff.workspaceId.toLowerCase() !== workspaceId)
            throw new HttpError(404, 'NOT_FOUND', 'Provider Return evidence receipt was not found.');
          return json(200, { receipt });
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return evidenceError(error);
        }
      }
    }
  ];
}
