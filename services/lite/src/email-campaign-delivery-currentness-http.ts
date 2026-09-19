import type {
  CoreHumanActionReceiptBindingV1,
  EmailCampaignSendIntentV1
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { EmailCampaignDeliveryCurrentnessResolver } from './email-campaign-delivery-currentness.js';

function workspaceOf(request: JsonRequest, secret: string): string {
  if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId)
    throw new HttpError(400, 'WORKSPACE_REQUIRED', 'Trusted Workspace context is required.');
  return workspaceId;
}

export function createEmailCampaignDeliveryCurrentnessRoutes(options: {
  internalServiceSecret: string;
  resolver: Pick<EmailCampaignDeliveryCurrentnessResolver, 'resolve'>;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/email-campaigns/send-intents/validate-current',
      handle: async (request) => {
        const workspaceId = workspaceOf(request, options.internalServiceSecret);
        if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Email Campaign currentness body is required.'
          );
        const body = request.body as Record<string, unknown>;
        if (
          Object.keys(body).some((field) => !['intent', 'humanReceipt'].includes(field)) ||
          !body.intent ||
          !body.humanReceipt
        )
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Exact intent and HUMAN_USER receipt are required.'
          );
        return json(
          200,
          await options.resolver.resolve(
            workspaceId,
            body.intent as EmailCampaignSendIntentV1,
            body.humanReceipt as CoreHumanActionReceiptBindingV1
          )
        );
      }
    }
  ];
}
