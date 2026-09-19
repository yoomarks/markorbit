import {
  noEmailCampaignDeliveryAnalyticsAuthorityConsequencesV1,
  parseEmailCampaignDeliveryAnalyticsV1,
  type EmailCampaignDeliveryAnalyticsV1
} from '@markorbit/contracts/email-campaign-delivery-analytics';
import type { EmailCampaignIdV1 } from '@markorbit/contracts/email-campaign';
import type {
  EmailDeliveryObservationKindV1,
  EmailDeliveryObservationV1
} from '@markorbit/contracts/email-delivery';
import type { PostgresEmailCampaignStore } from './email-campaign.js';
import type { PostgresEmailDeliveryStore } from './email-delivery.js';

export class EmailCampaignDeliveryAnalyticsRuntimeError extends Error {
  constructor(
    readonly code: 'INTEGRITY_FAILURE' | 'INVALID_CLOCK',
    message: string
  ) {
    super(message);
    this.name = 'EmailCampaignDeliveryAnalyticsRuntimeError';
  }
}

export interface EmailCampaignDeliveryAnalyticsCampaignReader {
  getCampaignVersion(
    workspaceId: string,
    campaignId: EmailCampaignIdV1,
    version: number
  ): ReturnType<PostgresEmailCampaignStore['getCampaignVersion']>;
  getAudienceSnapshot: PostgresEmailCampaignStore['getAudienceSnapshot'];
}

export interface EmailCampaignDeliveryAnalyticsEvidenceReader {
  listCampaignAttempts: PostgresEmailDeliveryStore['listCampaignAttempts'];
  listCampaignObservations: PostgresEmailDeliveryStore['listCampaignObservations'];
}

function latest(values: readonly string[]): string {
  let maximum = -Infinity;
  let result = '';
  for (const value of values) {
    const time = Date.parse(value);
    if (!Number.isFinite(time))
      throw new EmailCampaignDeliveryAnalyticsRuntimeError(
        'INTEGRITY_FAILURE',
        'Delivery analytics evidence contains an invalid timestamp.'
      );
    if (time > maximum) {
      maximum = time;
      result = new Date(time).toISOString();
    }
  }
  if (!result)
    throw new EmailCampaignDeliveryAnalyticsRuntimeError(
      'INTEGRITY_FAILURE',
      'Delivery analytics requires at least one evidence timestamp.'
    );
  return result;
}

function observedAttemptIds(
  observations: readonly Readonly<EmailDeliveryObservationV1>[],
  event: EmailDeliveryObservationKindV1
): Set<string> {
  return new Set(
    observations
      .filter((observation) => observation.event === event)
      .map((observation) => observation.deliveryAttempt.deliveryAttemptId)
  );
}

export class EmailCampaignDeliveryAnalyticsService {
  constructor(
    private readonly campaigns: Readonly<EmailCampaignDeliveryAnalyticsCampaignReader>,
    private readonly delivery: Readonly<EmailCampaignDeliveryAnalyticsEvidenceReader>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async read(input: {
    workspaceId: string;
    campaignId: EmailCampaignIdV1;
    campaignVersion: number;
  }): Promise<EmailCampaignDeliveryAnalyticsV1> {
    const campaign = await this.campaigns.getCampaignVersion(
      input.workspaceId,
      input.campaignId,
      input.campaignVersion
    );
    if (
      campaign.workspaceId !== input.workspaceId.trim().toLowerCase() ||
      campaign.campaignId !== input.campaignId ||
      campaign.version !== input.campaignVersion
    )
      throw new EmailCampaignDeliveryAnalyticsRuntimeError(
        'INTEGRITY_FAILURE',
        'Campaign reader returned a different exact Campaign.'
      );

    const audience = await this.campaigns.getAudienceSnapshot(
      campaign.workspaceId,
      campaign.audience.audienceSnapshotId,
      campaign.audience.version
    );
    if (
      audience.workspaceId !== campaign.workspaceId ||
      audience.audienceSnapshotId !== campaign.audience.audienceSnapshotId ||
      audience.version !== campaign.audience.version ||
      audience.audienceFingerprintSha256 !== campaign.audience.fingerprintSha256
    )
      throw new EmailCampaignDeliveryAnalyticsRuntimeError(
        'INTEGRITY_FAILURE',
        'Campaign Audience lineage does not match the exact Campaign.'
      );

    const [attempts, observations] = await Promise.all([
      this.delivery.listCampaignAttempts(
        campaign.workspaceId,
        campaign.campaignId,
        campaign.version
      ),
      this.delivery.listCampaignObservations(
        campaign.workspaceId,
        campaign.campaignId,
        campaign.version
      )
    ]);

    const attemptIds = new Set<string>();
    for (const attempt of attempts) {
      if (
        attempt.workspaceId !== campaign.workspaceId ||
        attempt.campaign.campaignId !== campaign.campaignId ||
        attempt.campaign.version !== campaign.version
      )
        throw new EmailCampaignDeliveryAnalyticsRuntimeError(
          'INTEGRITY_FAILURE',
          'Delivery attempt escaped the exact Campaign scope.'
        );
      if (attemptIds.has(attempt.deliveryAttemptId))
        throw new EmailCampaignDeliveryAnalyticsRuntimeError(
          'INTEGRITY_FAILURE',
          'Delivery attempt reader returned a duplicate attempt identity.'
        );
      attemptIds.add(attempt.deliveryAttemptId);
    }
    for (const observation of observations) {
      if (
        observation.workspaceId !== campaign.workspaceId ||
        !attemptIds.has(observation.deliveryAttempt.deliveryAttemptId)
      )
        throw new EmailCampaignDeliveryAnalyticsRuntimeError(
          'INTEGRITY_FAILURE',
          'Delivery observation escaped the exact Campaign attempt scope.'
        );
    }

    const accepted = observedAttemptIds(observations, 'ACCEPTED');
    for (const attempt of attempts) {
      if (attempt.status === 'ACCEPTED') accepted.add(attempt.deliveryAttemptId);
    }

    const evidenceThrough = latest([
      audience.capturedAt,
      campaign.updatedAt,
      ...attempts.map((attempt) => attempt.updatedAt),
      ...observations.map((observation) => observation.observedAt)
    ]);
    const evaluatedAtRaw = this.now();
    const evaluatedAtDate = new Date(evaluatedAtRaw);
    if (Number.isNaN(evaluatedAtDate.getTime()))
      throw new EmailCampaignDeliveryAnalyticsRuntimeError(
        'INVALID_CLOCK',
        'Delivery analytics runtime clock is invalid.'
      );
    const evaluatedAt = evaluatedAtDate.toISOString();
    if (Date.parse(evaluatedAt) < Date.parse(evidenceThrough))
      throw new EmailCampaignDeliveryAnalyticsRuntimeError(
        'INVALID_CLOCK',
        'Delivery analytics runtime clock precedes durable evidence.'
      );

    const count = (event: EmailDeliveryObservationKindV1): number =>
      observedAttemptIds(observations, event).size;

    return parseEmailCampaignDeliveryAnalyticsV1({
      schemaVersion: 1,
      workspaceId: campaign.workspaceId,
      campaign: {
        campaignId: campaign.campaignId,
        version: campaign.version
      },
      audience: {
        audienceSnapshotId: audience.audienceSnapshotId,
        version: audience.version
      },
      requested: audience.entries.length,
      attempted: attempts.length,
      accepted: accepted.size,
      delivered: count('DELIVERED'),
      deferred: count('DEFERRED'),
      hardBounced: count('HARD_BOUNCED'),
      softBounced: count('SOFT_BOUNCED'),
      complained: count('COMPLAINED'),
      unsubscribed: count('UNSUBSCRIBED'),
      failed: attempts.filter((attempt) => attempt.status === 'FAILED').length,
      unknown: attempts.filter((attempt) => attempt.status === 'UNKNOWN').length,
      evidenceThrough,
      evaluatedAt,
      authority: noEmailCampaignDeliveryAnalyticsAuthorityConsequencesV1
    });
  }
}
