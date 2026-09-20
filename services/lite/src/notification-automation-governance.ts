import {
  assessChannelEntitlementV1,
  type ChannelEntitlementAccessV1
} from '@markorbit/contracts/channel-platform';
import {
  parseChannelNotificationAutomationGovernanceEvidenceV1,
  type ChannelNotificationAutomationGovernanceEvidenceV1
} from '@markorbit/contracts/channel-notification-automation';
import type { ResolvedEntitlementV1 } from '@markorbit/contracts/workspace-commercial';
import type { NotificationAutomationEntitlementReader } from './notification-automation-rule-currentness.js';
import type {
  NotificationAutomationGovernanceVerificationRequestV1,
  NotificationAutomationGovernanceVerifierV1
} from './notification-automation-rule.js';

export class HttpCoreNotificationAutomationGovernanceVerifier implements NotificationAutomationGovernanceVerifierV1 {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly timeoutMs = 3_000
  ) {}

  async verify(
    request: Readonly<NotificationAutomationGovernanceVerificationRequestV1>
  ): Promise<Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>> {
    if (request.action !== 'ACTIVATE')
      throw new Error('Only Notification Automation ACTIVATE is governed in C5C.');

    const response = await fetch(
      `${this.coreUrl}/internal/auth/governed-human-actions/notification-automation-activate/validate-current`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret
        },
        body: JSON.stringify({
          workspaceId: request.workspaceId,
          notificationRuleId: request.notificationRuleId,
          candidateRuleVersion: request.candidateRuleVersion,
          candidateRuleFingerprintSha256: request.candidateRuleFingerprintSha256,
          governanceEvidenceRef: request.governanceEvidenceRef
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      }
    );
    if (!response.ok)
      throw new Error(
        response.status >= 500
          ? 'Core Notification Automation governance verifier is unavailable.'
          : 'Core Notification Automation governance evidence is stale or invalid.'
      );

    const evidence = parseChannelNotificationAutomationGovernanceEvidenceV1(await response.json());
    if (
      evidence.action !== 'ACTIVATE' ||
      evidence.workspaceId !== request.workspaceId.toLowerCase() ||
      evidence.notificationRuleId !== request.notificationRuleId ||
      evidence.authorizedRuleVersion !== request.candidateRuleVersion ||
      evidence.authorizedRuleFingerprintSha256 !== request.candidateRuleFingerprintSha256 ||
      evidence.evidenceRef !== request.governanceEvidenceRef
    )
      throw new Error('Core governance response does not bind the exact Notification rule.');
    return evidence;
  }
}
export class HttpCoreNotificationAutomationEntitlementReader implements NotificationAutomationEntitlementReader {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly timeoutMs = 3_000
  ) {}

  async resolve(
    workspaceId: string
  ): Promise<Readonly<ChannelEntitlementAccessV1> | Readonly<{ unavailable: true }>> {
    let response: Response;
    try {
      response = await fetch(
        `${this.coreUrl}/internal/workspaces/${encodeURIComponent(
          workspaceId
        )}/commercial/email-notification-entitlement/resolve`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify({ asOf: this.now() }),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      return { unavailable: true };
    }

    if (!response.ok) {
      if (response.status === 404)
        return assessChannelEntitlementV1(workspaceId, 'EMAIL_NOTIFICATION', []);
      return { unavailable: true };
    }

    const resolved = (await response.json()) as ResolvedEntitlementV1;
    return assessChannelEntitlementV1(workspaceId, 'EMAIL_NOTIFICATION', [resolved]);
  }
}
