import type {
  ChannelNotificationRuleId,
  ChannelNotificationSendIntentId,
  ChannelNotificationTriggerEvidenceId
} from './channel-notification.js';
import type { WorkspaceEmailSenderProfileId } from './email-sender-profile.js';
import type { PublishPackageId } from './product-loop.js';
import type { ProtectedExternalActionReleaseId } from './protected-external-action.js';

export type ChannelNotificationDeliveryAttemptId = `notification-delivery-attempt_${string}`;
export type ChannelNotificationDeliveryObservationId =
  `notification-delivery-observation_${string}`;
export type ChannelNotificationDeliveryAttemptStatusV1 =
  'PLANNED' | 'SUBMITTING' | 'ACCEPTED' | 'FAILED' | 'UNKNOWN';
export type ChannelNotificationDeliveryEventV1 =
  'ACCEPTED' | 'DELIVERED' | 'HARD_BOUNCED' | 'SOFT_BOUNCED' | 'COMPLAINED' | 'FAILED' | 'UNKNOWN';

export const noChannelNotificationDeliveryAuthorityConsequencesV1 = Object.freeze({
  businessTruthCreated: false,
  customerTruthCreated: false,
  legalNoticeEffective: false,
  recipientReadConfirmed: false,
  externalSendAuthorized: false
});

/** Provider-neutral, privacy-minimized evidence. Raw addresses and message content are forbidden. */
export interface ChannelNotificationDeliveryAttemptV1 {
  schemaVersion: 1;
  notificationDeliveryAttemptId: ChannelNotificationDeliveryAttemptId;
  workspaceId: string;
  version: 1;
  executionRelease: Readonly<{ id: ProtectedExternalActionReleaseId; version: 1 }>;
  sendIntent: Readonly<{ id: ChannelNotificationSendIntentId; version: 1 }>;
  effectFingerprintSha256: string;
  rule: Readonly<{ id: ChannelNotificationRuleId; version: number; fingerprintSha256: string }>;
  trigger: Readonly<{
    id: ChannelNotificationTriggerEvidenceId;
    version: 1;
    fingerprintSha256: string;
  }>;
  endpointFingerprintSha256: string;
  content: Readonly<{ id: PublishPackageId; version: number; fingerprintSha256: string }>;
  senderProfile: Readonly<{
    id: WorkspaceEmailSenderProfileId;
    version: number;
    fingerprintSha256: string;
  }>;
  deliveryPlanFingerprintSha256: string;
  status: ChannelNotificationDeliveryAttemptStatusV1;
  providerSubmissionRef?: string;
  reconciliationIdentity: string;
  createdAt: string;
  updatedAt: string;
  authority: Readonly<typeof noChannelNotificationDeliveryAuthorityConsequencesV1>;
}

export interface ChannelNotificationDeliveryObservationV1 {
  schemaVersion: 1;
  notificationDeliveryObservationId: ChannelNotificationDeliveryObservationId;
  workspaceId: string;
  version: 1;
  attempt: Readonly<{ id: ChannelNotificationDeliveryAttemptId; version: 1 }>;
  eventIdentity: string;
  event: ChannelNotificationDeliveryEventV1;
  providerMessageRef?: string;
  endpointFingerprintSha256?: string;
  authenticatedEvidence: boolean;
  reasonCode: string;
  evidenceRefs: readonly string[];
  eventAt: string;
  observedAt: string;
  authority: Readonly<typeof noChannelNotificationDeliveryAuthorityConsequencesV1>;
}
