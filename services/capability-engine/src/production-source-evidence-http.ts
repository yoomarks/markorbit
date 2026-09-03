import { timingSafeEqual } from 'node:crypto';

import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';

import type { CapabilityRuntimeReplayStoreV1 } from './capability-runtime-replay-store.js';
import {
  parseCapabilityProductionSourceExecutionReferenceV1,
  type CapabilityProductionSourceEvidenceReadServiceV1
} from './production-source-evidence-read.js';

export interface CapabilityProductionSourceEvidenceHttpOptionsV1 {
  readonly reader: Pick<CapabilityProductionSourceEvidenceReadServiceV1, 'read'>;
  readonly replayStore: Pick<CapabilityRuntimeReplayStoreV1, 'inspect'>;
  readonly internalServiceSecret: string;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32) {
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorize(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization'])) {
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  }

  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw new HttpError(401, 'UNTRUSTED_INTERNAL_CALLER', error.message);
    }
    throw error;
  }

  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId !== principal.workspaceId) {
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_CONTEXT',
      'Trusted Workspace Principal and workspace header must match.'
    );
  }
  if (!principal.permissions.includes('workspace:read')) {
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.');
  }
  if (request.headers['x-markorbit-caller-product'] !== 'MARKREG') {
    throw new HttpError(
      403,
      'PERMISSION_DENIED',
      'The production source evidence read is restricted to the MarkReg product boundary.'
    );
  }
  return principal;
}

/**
 * Trusted internal transport over the owner-local #682 replay-only materializer.
 *
 * The caller supplies only the exact producer-issued execution reference. The route performs a
 * privacy-safe Workspace ownership check against durable Capability replay truth before allowing
 * the bounded producer projection to leave the Capability owner boundary. It creates no new
 * invocation, admission decision, Recommendation or product authority.
 */
export function createCapabilityProductionSourceEvidenceRoutesV1(
  options: Readonly<CapabilityProductionSourceEvidenceHttpOptionsV1>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/production-source-evidence/read',
      async handle(request) {
        const principal = authorize(request, options.internalServiceSecret);
        let reference;
        try {
          reference = parseCapabilityProductionSourceExecutionReferenceV1(request.body);
        } catch (error) {
          throw new HttpError(
            400,
            'INVALID_PRODUCTION_SOURCE_REFERENCE',
            error instanceof Error
              ? error.message
              : 'Invalid production source execution reference.'
          );
        }

        try {
          const replay = await options.replayStore.inspect({
            idempotencyKey: reference.idempotencyKey,
            requestFingerprintSha256: reference.requestFingerprintSha256
          });
          if (
            replay.kind === 'REPLAY' &&
            replay.execution.request.caller.workspaceId !== principal.workspaceId
          ) {
            throw new HttpError(
              404,
              'PRODUCTION_SOURCE_EVIDENCE_NOT_FOUND',
              'Production source evidence was not found in this Workspace.'
            );
          }
        } catch (error) {
          if (error instanceof HttpError) throw error;
          // The owner read service maps replay-store outages to its typed UNAVAILABLE result.
        }

        return json(200, await options.reader.read(reference));
      }
    }
  ];
}
