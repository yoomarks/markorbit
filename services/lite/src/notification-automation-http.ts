import {
  parseChannelNotificationAutomationGovernanceEvidenceV1,
  parseChannelNotificationSendIntentV1,
  parseChannelNotificationTriggerEvidenceV1,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { ChannelNotificationRuleId } from '@markorbit/contracts/channel-notification';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  NotificationAutomationRuleRuntimeError,
  type PostgresNotificationAutomationRuleStore
} from './notification-automation-rule.js';
import type { NotificationSendCurrentnessResolverV1 } from './notification-send-currentness.js';

function internal(request: JsonRequest, secret: string): void {
  if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
}

function principalOf(request: JsonRequest, secret: string): WorkspacePrincipal {
  internal(request, secret);
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  if (!principal.permissions.includes('workspace:manage'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:manage permission is required.');
  return principal;
}

function workspaceOf(request: JsonRequest, secret: string): string {
  internal(request, secret);
  const workspaceId = request.headers['x-markorbit-workspace-id']?.trim().toLowerCase();
  if (!workspaceId)
    throw new HttpError(400, 'WORKSPACE_REQUIRED', 'Trusted Workspace context is required.');
  return workspaceId;
}

function bodyOf(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}
function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
}

function idempotencyKey(request: JsonRequest): string {
  return text(request.headers['idempotency-key'], 'Idempotency-Key');
}

function parsedSendCurrentnessBody(body: Record<string, unknown>) {
  try {
    return {
      intent: parseChannelNotificationSendIntentV1(body.intent),
      triggerEvidence: parseChannelNotificationTriggerEvidenceV1(body.triggerEvidence),
      activationEvidence: parseChannelNotificationAutomationGovernanceEvidenceV1(
        body.activationEvidence
      )
    };
  } catch {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Notification currentness input does not match the bounded contracts.'
    );
  }
}

function mapRuleError(error: unknown): never {
  if (error instanceof NotificationAutomationRuleRuntimeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createNotificationAutomationRoutesV1(options: {
  internalServiceSecret: string;
  store: Pick<PostgresNotificationAutomationRuleStore, 'activate'>;
  sendCurrentness: Pick<NotificationSendCurrentnessResolverV1, 'resolve'>;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/notification-automation-rules/:notificationRuleId/activate',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        if (
          Object.keys(body).some(
            (field) => !['expectedVersion', 'governanceEvidenceRef'].includes(field)
          ) ||
          body.governanceEvidenceRef === undefined
        )
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Exact expectedVersion and governanceEvidenceRef are required.'
          );
        try {
          return json(
            200,
            await options.store.activate({
              workspaceId: principal.workspaceId,
              notificationRuleId: text(
                request.params.notificationRuleId,
                'notificationRuleId'
              ) as ChannelNotificationRuleId,
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              actorPrincipalId: principal.userId,
              idempotencyKey: idempotencyKey(request),
              governanceEvidenceRef: text(body.governanceEvidenceRef, 'governanceEvidenceRef')
            })
          );
        } catch (error) {
          return mapRuleError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/notification-automation/send-intents/validate-current',
      handle: async (request) => {
        const workspaceId = workspaceOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        if (
          Object.keys(body).some(
            (field) => !['intent', 'triggerEvidence', 'activationEvidence'].includes(field)
          ) ||
          !body.intent ||
          !body.triggerEvidence ||
          !body.activationEvidence
        )
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Exact Notification intent and owner evidence are required.'
          );
        const parsed = parsedSendCurrentnessBody(body);
        return json(
          200,
          await options.sendCurrentness.resolve(
            workspaceId,
            parsed.intent,
            parsed.triggerEvidence,
            parsed.activationEvidence
          )
        );
      }
    }
  ];
}
