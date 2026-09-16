import {
  noSiteInboundAcquisitionAuthorityConsequencesV1,
  parseSiteInboundAcquisitionV1,
  siteInboundAcquisitionFingerprintSha256V1,
  type SiteInboundAcquisitionV1
} from '@markorbit/contracts/site-inbound-attribution';
import type { ResolvedSiteRuntimeV1 } from '@markorbit/contracts/site';
import type { JsonRequest } from '@markorbit/service-kit';

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$/u;

function safeToken(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized && TOKEN.test(normalized) ? normalized : undefined;
}

function normalizedHostname(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(`https://${value.trim()}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function landing(request: JsonRequest, siteHostname: string): URL | undefined {
  const value = request.headers.referer;
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.hostname.toLowerCase() === siteHostname.toLowerCase() ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function deriveSiteInboundAcquisitionV1(
  request: JsonRequest,
  resolved: Readonly<ResolvedSiteRuntimeV1>
): SiteInboundAcquisitionV1 {
  const observedAt = resolved.requestContext.observedAt;
  const page = landing(request, resolved.requestContext.normalizedHostname);
  const source =
    safeToken(page?.searchParams.get('utm_source') ?? null) ??
    safeToken(page?.searchParams.get('mo_source') ?? null);
  const campaign =
    safeToken(page?.searchParams.get('utm_campaign') ?? null) ??
    safeToken(page?.searchParams.get('mo_campaign') ?? null);
  const content =
    safeToken(page?.searchParams.get('utm_content') ?? null) ??
    safeToken(page?.searchParams.get('mo_content') ?? null);
  const referral = safeToken(page?.searchParams.get('mo_referral') ?? null);
  const reportedReferrer = normalizedHostname(request.headers['x-markorbit-site-referrer-host']);
  const referrerHostname =
    reportedReferrer && reportedReferrer !== resolved.requestContext.normalizedHostname
      ? reportedReferrer
      : undefined;
  const landingPath = page?.pathname || '/';
  const slot = resolved.publicSite.contentSlots?.find(
    (candidate) =>
      candidate.route === landingPath && candidate.locale === resolved.requestContext.defaultLocale
  );
  const contentRef = slot
    ? {
        owner: 'LITE' as const,
        kind: 'PUBLISH_PACKAGE' as const,
        id: slot.publishPackageRef.id,
        version: slot.publishPackageRef.version,
        fingerprintSha256: slot.contentFingerprintSha256
      }
    : undefined;
  const normalizedSource = source?.toLowerCase();
  const attributionState =
    normalizedSource === 'direct'
      ? ('DIRECT' as const)
      : normalizedSource === 'unattributed'
        ? ('UNATTRIBUTED' as const)
        : source || campaign || content || referral || referrerHostname || contentRef
          ? ('ATTRIBUTED' as const)
          : page
            ? ('DIRECT' as const)
            : ('UNKNOWN' as const);
  const withoutFingerprint = {
    schemaVersion: 1 as const,
    attributionState,
    landingPath,
    ...(source ? { source } : {}),
    ...(campaign ? { campaign } : {}),
    ...(content ? { content } : {}),
    ...(referral ? { referral } : {}),
    ...(referrerHostname ? { referrerHostname } : {}),
    ...(contentRef ? { contentRef } : {}),
    observedAt,
    authorityConsequences: noSiteInboundAcquisitionAuthorityConsequencesV1
  };
  return parseSiteInboundAcquisitionV1({
    ...withoutFingerprint,
    fingerprintSha256: siteInboundAcquisitionFingerprintSha256V1(withoutFingerprint)
  });
}
