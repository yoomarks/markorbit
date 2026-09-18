import { createHash } from 'node:crypto';
import {
  assertEmailCampaignSendIntentV1,
  canonicalEmailCampaignSendIntentPayloadV1,
  type CoreHumanActionReceiptBindingV1,
  type EmailCampaignSendCurrentnessReasonV1,
  type EmailCampaignSendCurrentnessStateV1,
  type EmailCampaignSendCurrentnessV1,
  type EmailCampaignSendIntentV1
} from '@markorbit/contracts/protected-external-action';
import {
  assessChannelEntitlementV1,
  type ChannelEntitlementAccessV1
} from '@markorbit/contracts/channel-platform';
import type { ResolvedEntitlementV1 } from '@markorbit/contracts/workspace-commercial';
import type {
  OutboundContactPurposeV1,
  OutboundContactReadinessV1,
  OutboundContactTargetReferenceV1
} from '@markorbit/contracts/outbound-contact-policy';
import type { WorkspaceDirectoryEntryId } from '@markorbit/contracts/workspace-directory';
import type { PostgresEmailCampaignStore } from './email-campaign.js';
import type { PostgresEmailSenderProfileStore } from './email-sender-profile.js';
import type { PostgresOutboundContactPolicyStore } from './outbound-contact-policy.js';
import type { PostgresWorkspaceDirectoryStore } from './workspace-directory.js';

export type EmailEndpointResolutionState =
  'CURRENT' | 'STALE' | 'NOT_FOUND' | 'UNKNOWN' | 'UNAVAILABLE';

export interface EmailEndpointResolution {
  state: EmailEndpointResolutionState;
  endpointFingerprintSha256?: string;
  endpoint?: string;
}

export interface EmailCampaignEndpointResolver {
  resolve(
    workspaceId: string,
    targetRef: Readonly<OutboundContactTargetReferenceV1>
  ): Promise<EmailEndpointResolution>;
}

export type EmailCampaignEntitlementResolution =
  | Readonly<{ state: 'CURRENT'; access: ChannelEntitlementAccessV1 }>
  | Readonly<{ state: 'UNAVAILABLE' }>;

export interface EmailCampaignEntitlementReader {
  resolve(
    workspaceId: string,
    humanReceipt: Readonly<CoreHumanActionReceiptBindingV1>
  ): Promise<EmailCampaignEntitlementResolution>;
}

export interface EmailCampaignReadinessEvaluator {
  evaluate(command: {
    workspaceId: string;
    actorPrincipalId: string;
    targetRef: Readonly<OutboundContactTargetReferenceV1>;
    endpointFingerprintSha256: string;
    purpose: OutboundContactPurposeV1;
    policyRef: Readonly<{ policyId: string; version: number }>;
    reviewedSendFingerprintSha256: string;
  }): Promise<OutboundContactReadinessV1>;
}

const sha256 = (value: string): string =>
  createHash('sha256').update(value.trim().toLowerCase(), 'utf8').digest('hex');

const jsonFingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class WorkspaceDirectoryEmailEndpointResolver implements EmailCampaignEndpointResolver {
  constructor(
    private readonly directory: Pick<PostgresWorkspaceDirectoryStore, 'getExact' | 'getLatest'>
  ) {}

  async resolve(
    workspaceId: string,
    targetRef: Readonly<OutboundContactTargetReferenceV1>
  ): Promise<EmailEndpointResolution> {
    if (targetRef.owner !== 'LITE' || targetRef.kind !== 'WORKSPACE_DIRECTORY_ENTRY')
      return { state: 'UNKNOWN' };
    try {
      const id = targetRef.id as WorkspaceDirectoryEntryId;
      const [exact, latest] = await Promise.all([
        this.directory.getExact(workspaceId, id, targetRef.version),
        this.directory.getLatest(workspaceId, id)
      ]);
      if (!exact || !latest) return { state: 'NOT_FOUND' };
      if (latest.version !== targetRef.version || latest.status !== 'ACTIVE')
        return { state: 'STALE' };
      const emails = exact.contactPoints.filter((point) => point.kind === 'EMAIL');
      if (emails.length !== 1) return { state: emails.length ? 'UNKNOWN' : 'NOT_FOUND' };
      const endpoint = emails[0]!.value.trim().toLowerCase();
      return {
        state: 'CURRENT',
        endpoint,
        endpointFingerprintSha256: sha256(endpoint)
      };
    } catch (error) {
      return (error as { code?: string }).code === 'PERSISTENCE_UNAVAILABLE'
        ? { state: 'UNAVAILABLE' }
        : { state: 'UNKNOWN' };
    }
  }
}

export class HttpCoreEmailCampaignEntitlementReader implements EmailCampaignEntitlementReader {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly timeoutMs = 3_000
  ) {}

  async resolve(
    workspaceId: string,
    humanReceipt: Readonly<CoreHumanActionReceiptBindingV1>
  ): Promise<EmailCampaignEntitlementResolution> {
    let response: Response;
    try {
      response = await fetch(
        `${this.coreUrl}/internal/workspaces/${encodeURIComponent(
          workspaceId
        )}/commercial/entitlements/resolve`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify({
            userId: humanReceipt.userId,
            membershipId: humanReceipt.membershipId,
            expectedWorkspaceVersion: humanReceipt.workspaceVersion,
            expectedUserVersion: humanReceipt.userVersion,
            expectedMembershipVersion: humanReceipt.membershipVersion,
            subjectScope: 'WORKSPACE',
            entitlementKey: 'lite.channel.email.campaign',
            asOf: this.now()
          }),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      return { state: 'UNAVAILABLE' };
    }
    if (!response.ok) return { state: 'UNAVAILABLE' };
    const resolved = (await response.json()) as ResolvedEntitlementV1;
    return {
      state: 'CURRENT',
      access: assessChannelEntitlementV1(workspaceId, 'EMAIL_CAMPAIGN', [resolved])
    };
  }
}

export class EmailCampaignDeliveryCurrentnessResolver {
  constructor(
    private readonly campaigns: Pick<PostgresEmailCampaignStore, 'loadReviewedAggregate'>,
    private readonly senders: Pick<
      PostgresEmailSenderProfileStore,
      'getExactSenderProfile' | 'evaluateSenderProfileCurrentness'
    >,
    private readonly endpoints: EmailCampaignEndpointResolver,
    private readonly outbound: EmailCampaignReadinessEvaluator,
    private readonly entitlements: EmailCampaignEntitlementReader,
    private readonly verificationMaximumAgeMs = 24 * 60 * 60 * 1000
  ) {}

  async resolve(
    workspaceId: string,
    intent: Readonly<EmailCampaignSendIntentV1>,
    humanReceipt: Readonly<CoreHumanActionReceiptBindingV1>
  ): Promise<EmailCampaignSendCurrentnessV1> {
    const result = (
      state: EmailCampaignSendCurrentnessStateV1,
      reason: EmailCampaignSendCurrentnessReasonV1
    ): EmailCampaignSendCurrentnessV1 => ({
      schemaVersion: 1,
      workspaceId: workspaceId.toLowerCase(),
      actionKind: 'EMAIL_CAMPAIGN_SEND',
      effectFingerprintSha256: intent.effectFingerprintSha256,
      deliveryPlanFingerprintSha256: intent.deliveryPlanFingerprintSha256,
      state,
      reason
    });

    try {
      assertEmailCampaignSendIntentV1(intent);
      if (
        intent.workspaceId.toLowerCase() !== workspaceId.toLowerCase() ||
        humanReceipt.workspaceId.toLowerCase() !== workspaceId.toLowerCase()
      )
        return result('UNKNOWN', 'WORKSPACE_MISMATCH');

      const canonical = canonicalEmailCampaignSendIntentPayloadV1(intent);
      const expectedPlanFingerprint = jsonFingerprint(canonical);
      if (expectedPlanFingerprint !== intent.deliveryPlanFingerprintSha256)
        return result('UNKNOWN', 'FINGERPRINT_MISMATCH');
      if (
        jsonFingerprint({
          ...canonical,
          deliveryPlanFingerprintSha256: intent.deliveryPlanFingerprintSha256
        }) !== intent.effectFingerprintSha256
      )
        return result('UNKNOWN', 'FINGERPRINT_MISMATCH');

      const entitlement = await this.entitlements.resolve(workspaceId, humanReceipt);
      if (entitlement.state === 'UNAVAILABLE') return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      if (!entitlement.access.allowed) return result('REVOKED', 'ENTITLEMENT_REVOKED');

      const aggregate = await this.campaigns.loadReviewedAggregate(
        workspaceId,
        intent.campaign.id,
        intent.campaign.version,
        intent.campaignReview.id,
        intent.campaignReview.version
      );
      if (
        aggregate.campaign.campaignFingerprintSha256 !== intent.campaign.fingerprintSha256 ||
        aggregate.audience.audienceFingerprintSha256 !== intent.audience.fingerprintSha256 ||
        aggregate.content.projectionFingerprintSha256 !== intent.content.fingerprintSha256 ||
        aggregate.brand.brandProjectionFingerprintSha256 !== intent.brand.fingerprintSha256
      )
        return result('STALE', 'FINGERPRINT_MISMATCH');
      if (
        aggregate.campaign.audience.audienceSnapshotId !== intent.audience.id ||
        aggregate.campaign.audience.version !== intent.audience.version ||
        aggregate.campaign.content.contentProjectionId !== intent.content.id ||
        aggregate.campaign.content.version !== intent.content.version ||
        aggregate.campaign.brand.brandProjectionId !== intent.brand.id ||
        aggregate.campaign.brand.version !== intent.brand.version
      )
        return result('STALE', 'CAMPAIGN_STALE');
      if (
        aggregate.review.outcome !== 'APPROVED_FOR_DELIVERY_PREPARATION' ||
        aggregate.review.campaign.campaignId !== intent.campaign.id ||
        aggregate.review.campaign.version !== intent.campaign.version ||
        aggregate.review.expectedCampaignFingerprintSha256 !== intent.campaign.fingerprintSha256
      )
        return result('STALE', 'REVIEW_CAMPAIGN_BINDING_DRIFT');
      if (aggregate.audience.entries.length !== intent.recipientCount)
        return result('STALE', 'CAMPAIGN_STALE');

      const sender = await this.senders.getExactSenderProfile(
        workspaceId,
        intent.senderProfile.id,
        intent.senderProfile.version
      );
      if (jsonFingerprint(sender) !== intent.senderProfile.fingerprintSha256)
        return result('STALE', 'SENDER_PROFILE_STALE');
      const senderCurrentness = await this.senders.evaluateSenderProfileCurrentness(
        workspaceId,
        intent.senderProfile.id,
        this.verificationMaximumAgeMs
      );
      if (senderCurrentness.version !== intent.senderProfile.version)
        return result('STALE', 'SENDER_PROFILE_STALE');
      if (senderCurrentness.state === 'REVOKED') return result('REVOKED', 'SENDER_PROFILE_REVOKED');
      if (senderCurrentness.state === 'UNKNOWN' || senderCurrentness.state === 'UNAVAILABLE')
        return result('UNAVAILABLE', 'SENDER_PROFILE_UNAVAILABLE');
      if (senderCurrentness.state !== 'CURRENT_ELIGIBLE')
        return result('STALE', 'SENDER_PROFILE_STALE');

      for (const entry of aggregate.audience.entries) {
        const endpoint = await this.endpoints.resolve(workspaceId, entry.targetRef);
        if (endpoint.state === 'UNAVAILABLE') return result('UNAVAILABLE', 'ENDPOINT_UNAVAILABLE');
        if (endpoint.state === 'UNKNOWN' || endpoint.state === 'NOT_FOUND')
          return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
        if (
          endpoint.state === 'STALE' ||
          endpoint.endpointFingerprintSha256 !== entry.endpointFingerprintSha256
        )
          return result('STALE', 'ENDPOINT_DRIFT');

        const readiness = await this.outbound.evaluate({
          workspaceId,
          actorPrincipalId: humanReceipt.principalReference,
          targetRef: entry.targetRef,
          endpointFingerprintSha256: entry.endpointFingerprintSha256,
          purpose: entry.purpose,
          policyRef: entry.policyRef,
          reviewedSendFingerprintSha256: aggregate.audience.reviewedSendFingerprintSha256
        });
        if (readiness.outcome === 'BLOCKED')
          return result('SUPPRESSED', 'OUTBOUND_POLICY_SUPPRESSED');
        if (readiness.outcome !== 'READY_FOR_HUMAN_SEND')
          return result('UNKNOWN', 'OUTBOUND_POLICY_STALE');
      }

      return result('CURRENT', 'EXACT_DELIVERY_PLAN_CURRENT');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'PERSISTENCE_UNAVAILABLE') return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
    }
  }
}

export function createEmailCampaignDeliveryCurrentnessResolver(options: {
  campaigns: PostgresEmailCampaignStore;
  senders: PostgresEmailSenderProfileStore;
  directory: PostgresWorkspaceDirectoryStore;
  outbound: PostgresOutboundContactPolicyStore;
  coreUrl: string;
  internalServiceSecret: string;
}) {
  return new EmailCampaignDeliveryCurrentnessResolver(
    options.campaigns,
    options.senders,
    new WorkspaceDirectoryEmailEndpointResolver(options.directory),
    options.outbound,
    new HttpCoreEmailCampaignEntitlementReader(options.coreUrl, options.internalServiceSecret)
  );
}
