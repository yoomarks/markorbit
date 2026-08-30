import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  MethodOutcomeEvidenceAdmissionError,
  type MethodOutcomeEvidenceAdmissionServiceV1
} from './method-outcome-evidence.js';

export interface MethodOutcomeEvidenceHttpOptionsV1 {
  internalServiceSecret: string;
  service: Pick<MethodOutcomeEvidenceAdmissionServiceV1, 'admit'>;
}

function workspaceId(headers: Readonly<Record<string, string | undefined>>): string {
  const value = headers['x-markorbit-workspace-id']?.trim().toLowerCase();
  if (!value)
    throw new HttpError(400, 'WORKSPACE_CONTEXT_REQUIRED', 'x-markorbit-workspace-id is required.');
  return value;
}

function translate(error: unknown): never {
  if (!(error instanceof MethodOutcomeEvidenceAdmissionError)) throw error;
  const status =
    error.code === 'INVALID_EVIDENCE'
      ? 400
      : error.code === 'WORKSPACE_MISMATCH'
        ? 403
        : error.code === 'EVIDENCE_CONFLICT'
          ? 409
          : 503;
  throw new HttpError(status, error.code, error.message, error.retryable);
}

export function createMethodOutcomeEvidenceRoutesV1(
  options: MethodOutcomeEvidenceHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/evaluation/method-outcome-evidence',
      async handle(request) {
        if (
          !validateInternalServiceSecret(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'INTERNAL_SERVICE_UNAUTHORIZED',
            'Internal service identity is invalid.'
          );
        const trustedWorkspaceId = workspaceId(request.headers);
        try {
          const result = await options.service.admit({
            workspaceId: trustedWorkspaceId,
            evidence: request.body
          });
          return json(result.replayed ? 200 : 201, result);
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
