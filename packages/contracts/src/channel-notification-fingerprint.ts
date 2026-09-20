import { createHash } from 'node:crypto';
import {
  canonicalChannelNotificationSendPlanPayloadV1,
  canonicalChannelNotificationTriggerPayloadV1,
  parseChannelNotificationSendIntentV1,
  type ChannelNotificationSendIntentV1,
  type ChannelNotificationTriggerEvidenceV1
} from './channel-notification.js';

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const notificationFingerprint = (value: unknown): string =>
  createHash('sha256').update(stableSerialize(value)).digest('hex');

export function channelNotificationTriggerFingerprintSha256V1(
  value: Readonly<ChannelNotificationTriggerEvidenceV1>
): string {
  return notificationFingerprint(canonicalChannelNotificationTriggerPayloadV1(value));
}

export function channelNotificationDeliveryPlanFingerprintSha256V1(
  value: Readonly<ChannelNotificationSendIntentV1>
): string {
  return notificationFingerprint(canonicalChannelNotificationSendPlanPayloadV1(value));
}

export function channelNotificationSendEffectFingerprintSha256V1(
  value: Readonly<ChannelNotificationSendIntentV1>
): string {
  const item = parseChannelNotificationSendIntentV1(value);
  return notificationFingerprint({
    ...canonicalChannelNotificationSendPlanPayloadV1(item),
    deliveryPlanFingerprintSha256: item.deliveryPlanFingerprintSha256
  });
}
