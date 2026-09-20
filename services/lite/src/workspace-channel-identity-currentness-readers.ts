import {
  assessChannelEntitlementV1,
  type ChannelFeatureKeyV1
} from '@markorbit/contracts/channel-platform';
import type { ResolvedEntitlementV1 } from '@markorbit/contracts/workspace-commercial';
import type {
  ChannelIdentityEntitlementReaderV1,
  ChannelIdentityProvenanceCurrentnessReaderV1,
  OAuthCredentialCurrentnessReaderV1
} from './workspace-channel-identity-currentness.js';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;

abstract class InternalCurrentnessReaderV1 {
  constructor(
    protected readonly baseUrl: string,
    protected readonly internalServiceSecret: string,
    protected readonly timeoutMs = 3_000
  ) {}
  protected async post(path: string, body: unknown): Promise<unknown> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      return response.ok ? await response.json() : undefined;
    } catch {
      return undefined;
    }
  }
}

export class HttpCoreChannelIdentityEntitlementReaderV1
  extends InternalCurrentnessReaderV1
  implements ChannelIdentityEntitlementReaderV1
{
  async resolve(workspaceId: string, featureKey: ChannelFeatureKeyV1, asOf: string) {
    const value = await this.post(
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/commercial/channel-entitlements/${encodeURIComponent(featureKey)}/resolve`,
      { asOf }
    );
    if (!value) return undefined;
    return assessChannelEntitlementV1(workspaceId, featureKey, [value as ResolvedEntitlementV1]);
  }
}

export class HttpCoreOAuthCredentialCurrentnessReaderV1
  extends InternalCurrentnessReaderV1
  implements OAuthCredentialCurrentnessReaderV1
{
  async assess(input: Parameters<OAuthCredentialCurrentnessReaderV1['assess']>[0]) {
    const value = object(await this.post('/internal/v1/oauth-credentials/currentness', input));
    const states = [
      'CURRENT',
      'EXPIRED',
      'REAUTH_REQUIRED',
      'REVOKED',
      'UNKNOWN',
      'UNAVAILABLE'
    ] as const;
    if (
      !value ||
      value.schemaVersion !== 1 ||
      value.exposesAccessToken !== false ||
      typeof value.checkedAt !== 'string' ||
      !states.includes(value.state as (typeof states)[number]) ||
      Object.keys(value).some(
        (key) =>
          !['schemaVersion', 'credential', 'state', 'checkedAt', 'exposesAccessToken'].includes(key)
      )
    )
      return { state: 'UNAVAILABLE' as const };
    return { state: value.state as (typeof states)[number] };
  }
}

export class HttpCapabilityChannelIdentityProvenanceReaderV1
  extends InternalCurrentnessReaderV1
  implements ChannelIdentityProvenanceCurrentnessReaderV1
{
  async assess(input: Parameters<ChannelIdentityProvenanceCurrentnessReaderV1['assess']>[0]) {
    const value = object(
      await this.post('/internal/v1/channel-identity/provenance/currentness', input)
    );
    const states = ['CURRENT', 'STALE', 'UNKNOWN', 'UNAVAILABLE'] as const;
    if (
      !value ||
      value.schemaVersion !== 1 ||
      value.createsImplementationSelectionAuthority !== false ||
      value.createsExecutionAuthority !== false ||
      typeof value.checkedAt !== 'string' ||
      !states.includes(value.state as (typeof states)[number]) ||
      Object.keys(value).some(
        (key) =>
          ![
            'schemaVersion',
            'state',
            'checkedAt',
            'createsImplementationSelectionAuthority',
            'createsExecutionAuthority'
          ].includes(key)
      )
    )
      return { state: 'UNAVAILABLE' as const };
    return { state: value.state as (typeof states)[number] };
  }
}
