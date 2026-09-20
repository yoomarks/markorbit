import { encodeInternalWorkspacePrincipal } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { CoreAuthenticationClient } from './auth.js';
import { authorizeGovernedWorkspaceMutation } from './governed-action.js';

const RULE = /^channel-notification-rule_[A-Za-z0-9_-]+$/u;

function exactActivationBody(request: JsonRequest): { expectedVersion: number } {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const body = request.body as Record<string, unknown>;
  if (
    Object.keys(body).some((field) => field !== 'expectedVersion') ||
    !Number.isSafeInteger(body.expectedVersion) ||
    Number(body.expectedVersion) < 1
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Activation requires exactly one positive expectedVersion.'
    );
  return { expectedVersion: Number(body.expectedVersion) };
}

function ruleId(request: JsonRequest): string {
  const value = request.params.notificationRuleId?.trim();
  if (!value || !RULE.test(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'notificationRuleId is invalid.');
  return value;
}
export function createGatewayNotificationAutomationRoutesV1(options: {
  liteUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fetchImpl?: typeof fetch;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/api/lite/notification-automation-rules/:notificationRuleId/activate',
      handle: async (request) => {
        const id = ruleId(request);
        const browserBody = exactActivationBody(request);
        const context = await authorizeGovernedWorkspaceMutation(
          request,
          {
            authenticationClient: options.authenticationClient,
            csrfSecret: options.csrfSecret,
            allowedOrigins: options.allowedOrigins
          },
          {
            permission: 'workspace:manage',
            idempotency: 'REQUIRED',
            humanAction: 'NOTIFICATION_AUTOMATION_ACTIVATE',
            forbiddenBodyFields: [
              'workspaceId',
              'governanceEvidenceRef',
              'activationEvidence',
              'humanReceipt',
              'authorityReference'
            ],
            forbiddenHeaders: ['x-markorbit-principal', 'x-markorbit-governed-human-action-receipt']
          }
        );
        if (!context.humanActionReceipt)
          throw new HttpError(
            503,
            'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
            'Core receipt is unavailable.',
            true
          );
        if (!options.internalServiceSecret)
          throw new HttpError(
            503,
            'LITE_UNAVAILABLE',
            'Internal service identity is unavailable.',
            true
          );

        const fetchImpl = options.fetchImpl ?? fetch;
        let response: Response;
        try {
          response = await fetchImpl(
            `${options.liteUrl}/internal/notification-automation-rules/${encodeURIComponent(
              id
            )}/activate`,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-markorbit-internal-authorization': options.internalServiceSecret,
                'x-markorbit-principal': encodeInternalWorkspacePrincipal(context.principal),
                'x-markorbit-workspace-id': context.principal.workspaceId,
                'idempotency-key': context.idempotencyKey!,
                ...(request.headers['x-correlation-id']
                  ? { 'x-correlation-id': request.headers['x-correlation-id'] }
                  : {})
              },
              body: JSON.stringify({
                expectedVersion: browserBody.expectedVersion,
                governanceEvidenceRef: context.humanActionReceipt.authorityReference
              })
            }
          );
        } catch {
          throw new HttpError(503, 'LITE_UNAVAILABLE', 'Lite service is unavailable.', true);
        }
        return json(response.status, await response.json());
      }
    }
  ];
}
