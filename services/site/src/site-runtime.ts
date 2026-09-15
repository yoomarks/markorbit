import type { SiteRuntimeCommercialAccessV1 } from '@markorbit/contracts/site';
import { SiteServiceError, type SiteCommercialAuthorityV1 } from './site-service.js';

export class HttpCoreSiteCommercialAuthorityV1 implements SiteCommercialAuthorityV1 {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 3_000
  ) {}

  async assertCurrentAccess(
    input: Readonly<{
      workspaceId: string;
      installationId: string;
      installationVersion: number;
      entitlementKeys: readonly string[];
      asOf: string;
    }>
  ): Promise<Readonly<SiteRuntimeCommercialAccessV1>> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.coreUrl.replace(/\/$/u, '')}/internal/workspaces/${encodeURIComponent(input.workspaceId)}/site-runtime/access/resolve`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify({
            installationId: input.installationId,
            installationVersion: input.installationVersion,
            entitlementKeys: input.entitlementKeys,
            asOf: input.asOf
          }),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch (cause) {
      throw new SiteServiceError(
        'COMMERCIAL_AUTHORITY_UNAVAILABLE',
        'Core Site commercial authority is unavailable.',
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const unavailable = response.status >= 500;
      throw new SiteServiceError(
        unavailable ? 'COMMERCIAL_AUTHORITY_UNAVAILABLE' : 'COMMERCIAL_ACCESS_DENIED',
        unavailable
          ? 'Core Site commercial authority is unavailable.'
          : 'Core SITE installation or entitlement is not current.',
        unavailable
      );
    }
    const value = body as Partial<SiteRuntimeCommercialAccessV1> | undefined;
    if (
      value?.schemaVersion !== 1 ||
      value.workspaceId !== input.workspaceId ||
      value.installationRef?.installationId !== input.installationId ||
      value.installationRef?.version !== input.installationVersion ||
      value.currentAt !== input.asOf ||
      !Array.isArray(value.entitlementRefs) ||
      !input.entitlementKeys.every((key) =>
        value.entitlementRefs!.some((entry) => entry.key === key)
      )
    )
      throw new SiteServiceError(
        'COMMERCIAL_AUTHORITY_UNAVAILABLE',
        'Core Site commercial authority returned an invalid proof.',
        true
      );
    return value as SiteRuntimeCommercialAccessV1;
  }
}
