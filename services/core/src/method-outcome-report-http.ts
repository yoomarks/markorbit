import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  MethodOutcomeReportError,
  type MethodOutcomeReportServiceV1
} from './method-outcome-report.js';

export interface MethodOutcomeReportHttpOptionsV1 {
  internalServiceSecret: string;
  service: Pick<MethodOutcomeReportServiceV1, 'report'>;
}

function workspaceId(headers: Readonly<Record<string, string | undefined>>): string {
  const value = headers['x-markorbit-workspace-id']?.trim().toLowerCase();
  if (!value)
    throw new HttpError(400, 'WORKSPACE_CONTEXT_REQUIRED', 'x-markorbit-workspace-id is required.');
  return value;
}

function translate(error: unknown): never {
  if (!(error instanceof MethodOutcomeReportError)) throw error;
  throw new HttpError(error.status, error.code, error.message, error.retryable);
}

export function createMethodOutcomeReportRoutesV1(
  options: MethodOutcomeReportHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/evaluation/method-outcome-reports',
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
        try {
          return json(
            200,
            await options.service.report({
              workspaceId: workspaceId(request.headers),
              query: request.body
            })
          );
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
