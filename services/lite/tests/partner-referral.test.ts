import { createHash } from 'node:crypto';
import {
  businessAttributionFingerprintSha256V1,
  noBusinessAttributionAuthorityConsequencesV1,
  type BusinessAttributionLinkV1
} from '@markorbit/contracts/business-attribution';
import {
  noPartnerReferralProgramAuthorityConsequencesV1,
  partnerReferralPolicyFingerprintSha256V1,
  partnerReferralProgramFingerprintSha256V1,
  type PartnerReferralProgramV1
} from '@markorbit/contracts/partner-referral';
import type { RatePolicyVersionV1 } from '@markorbit/contracts/workspace-commercial';
import {
  noWorkspaceDirectoryAuthorityConsequencesV1,
  type WorkspaceDirectoryEntryV1
} from '@markorbit/contracts/workspace-directory';
import { describe, expect, it, vi } from 'vitest';
import {
  HttpCorePartnerReferralRatePolicyReader,
  PartnerReferralService,
  type PartnerReferralAttributionReader,
  type PartnerReferralDirectoryReader,
  type PartnerReferralStore
} from '../src/partner-referral.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const at = '2026-09-17T02:00:00.000Z';
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonical(item)])
        )
      : value;
const digest = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');

const ratePolicy: RatePolicyVersionV1 = {
  schemaVersion: 1,
  policyId: 'rate-policy_referral-v1',
  version: 1,
  kind: 'REFERRAL_COMMISSION',
  lifecycle: 'ACTIVE',
  applicability: {
    partnerRef: `LITE:WORKSPACE_DIRECTORY_ENTRY:workspace-directory-entry_partner-a@1`,
    referralSourceRef: 'SITE_REFERRAL_CODE:partner-a'
  },
  calculation: { kind: 'NEGOTIATED', agreementRef: 'agreement_partner-a' },
  effectiveFrom: at,
  sourceRef: 'commercial-admin:test',
  recordedAt: at
};

const directoryEntry: WorkspaceDirectoryEntryV1 = {
  schemaVersion: 1,
  workspaceDirectoryEntryId: 'workspace-directory-entry_partner-a',
  workspaceId,
  version: 1,
  entryKind: 'ORGANIZATION',
  displayName: 'Partner A',
  aliases: [],
  status: 'ACTIVE',
  roles: ['OTHER'],
  contactPoints: [],
  externalIdentityReferences: [],
  provenance: { sourceKind: 'WORKSPACE_USER', sourceReference: 'user_manager', capturedAt: at },
  authorityConsequences: noWorkspaceDirectoryAuthorityConsequencesV1,
  createdAt: at,
  updatedAt: at,
  archivedAt: null
};

function program(): PartnerReferralProgramV1 {
  const policyBase = {
    partnerReferralPolicyId: 'partner-referral-policy_v1' as const,
    version: 1 as const,
    requiredAttributionState: 'ATTRIBUTED' as const,
    requiredEvidenceBasis: 'EXACT_LINEAGE' as const,
    qualifyingDownstreamOwner: 'MARKREG' as const,
    qualifyingDownstreamKind: 'FORMAL_MATTER' as const,
    effectiveAt: at,
    ratePolicy: {
      owner: 'CORE' as const,
      kind: 'REFERRAL_COMMISSION' as const,
      id: ratePolicy.policyId,
      version: ratePolicy.version,
      fingerprintSha256: digest(ratePolicy)
    }
  };
  const base = {
    schemaVersion: 1 as const,
    partnerReferralProgramId: 'partner-referral-program_partner-a' as const,
    workspaceId,
    version: 1 as const,
    referralCode: 'partner-a',
    partner: {
      owner: 'LITE' as const,
      kind: 'WORKSPACE_DIRECTORY_ENTRY' as const,
      id: directoryEntry.workspaceDirectoryEntryId,
      version: 1,
      fingerprintSha256: digest(directoryEntry)
    },
    policy: {
      ...policyBase,
      policyFingerprintSha256: partnerReferralPolicyFingerprintSha256V1(policyBase)
    },
    status: 'ACTIVE' as const,
    createdByPrincipalId: 'user_manager',
    createdAt: at,
    authorityConsequences: noPartnerReferralProgramAuthorityConsequencesV1
  };
  return { ...base, programFingerprintSha256: partnerReferralProgramFingerprintSha256V1(base) };
}

function siteLink(referralCode = 'partner-a', referralObservedAt = at): BusinessAttributionLinkV1 {
  const base = {
    schemaVersion: 1 as const,
    businessAttributionLinkId: 'business-attribution_site-referral' as const,
    workspaceId,
    version: 1 as const,
    motionKind: 'SITE_INBOUND' as const,
    sourceRefs: [
      {
        owner: 'SITE',
        kind: 'SITE_REFERRAL_CODE',
        id: `site_markreg|${referralCode}`,
        version: 1,
        fingerprintSha256: 'a'.repeat(64),
        observedAt: referralObservedAt
      }
    ],
    touchpointRefs: [],
    downstreamRef: {
      owner: 'MARKREG',
      kind: 'FORMAL_MATTER',
      id: 'formal-matter_referred',
      version: 1,
      fingerprintSha256: 'b'.repeat(64),
      observedAt: at
    },
    attributionState: 'ATTRIBUTED' as const,
    evidenceBasis: 'EXACT_LINEAGE' as const,
    evaluatedAt: at,
    recordedByPrincipalId: 'user_manager',
    authorityConsequences: noBusinessAttributionAuthorityConsequencesV1
  };
  return {
    ...base,
    businessAttributionFingerprintSha256: businessAttributionFingerprintSha256V1(base)
  };
}

function setup(link = siteLink(), entry = directoryEntry) {
  const savedProgram = program();
  const directory: PartnerReferralDirectoryReader = {
    getLatest: vi.fn(() => Promise.resolve(entry))
  };
  const attribution: PartnerReferralAttributionReader = {
    find: vi.fn(() => Promise.resolve(link))
  };
  const ratePolicies = { resolve: vi.fn(() => Promise.resolve(ratePolicy)) };
  const createProgram = vi.fn<PartnerReferralStore['createProgram']>((command) => {
    void command;
    return Promise.resolve(savedProgram);
  });
  const createCandidate = vi.fn<PartnerReferralStore['createCandidate']>((command) => {
    void command;
    return Promise.resolve({ outcome: 'ELIGIBLE_FOR_COMMISSION_REVIEW' } as never);
  });
  const store: PartnerReferralStore = {
    createProgram,
    findProgram: vi.fn(() => Promise.resolve(savedProgram)),
    createCandidate,
    findCandidate: vi.fn(() => Promise.resolve(undefined))
  };
  return {
    service: new PartnerReferralService(directory, attribution, ratePolicies, store, () => at),
    createProgram,
    createCandidate
  };
}

describe('G6 Partner Referral service', () => {
  it('reads the exact active referral commission policy from the Core owner seam', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify(ratePolicy), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const reader = new HttpCorePartnerReferralRatePolicyReader(
      'http://core.test/',
      'partner-referral-internal-secret-32-bytes',
      fetchImpl
    );
    await expect(
      reader.resolve({ applicability: ratePolicy.applicability, asOf: at })
    ).resolves.toEqual(ratePolicy);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://core.test/internal/commercial/rate-policies/resolve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          kind: 'REFERRAL_COMMISSION',
          applicability: ratePolicy.applicability,
          asOf: at
        })
      })
    );
  });

  it('creates an exact partner/code/policy binding without granting identity or payment authority', async () => {
    const { service, createProgram } = setup();
    await service.createProgram({
      workspaceId,
      actorPrincipalId: 'user_manager',
      idempotencyKey: 'program-1',
      referralCode: 'partner-a',
      partner: {
        id: directoryEntry.workspaceDirectoryEntryId,
        version: 1,
        fingerprintSha256: digest(directoryEntry)
      }
    });
    expect(createProgram.mock.calls[0]?.[0]).toMatchObject({
      referralCode: 'partner-a',
      partner: { id: directoryEntry.workspaceDirectoryEntryId, version: 1 },
      policy: {
        requiredAttributionState: 'ATTRIBUTED',
        requiredEvidenceBasis: 'EXACT_LINEAGE',
        qualifyingDownstreamKind: 'FORMAL_MATTER'
      }
    });
  });

  it('creates an eligibility candidate only from exact G4 referral-to-Formal-Matter lineage', async () => {
    const { service, createCandidate } = setup();
    const source = program();
    const link = siteLink();
    await service.evaluate({
      workspaceId,
      actorPrincipalId: 'user_manager',
      idempotencyKey: 'candidate-1',
      program: {
        id: source.partnerReferralProgramId,
        version: 1,
        fingerprintSha256: source.programFingerprintSha256
      },
      siteInboundAttribution: {
        id: link.businessAttributionLinkId,
        version: 1,
        fingerprintSha256: link.businessAttributionFingerprintSha256
      }
    });
    expect(createCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ program: source, siteInboundAttribution: link })
    );
  });

  it('fails closed when the inbound link carries a different referral code', async () => {
    const link = siteLink('other-partner');
    const { service, createCandidate } = setup(link);
    const source = program();
    await expect(
      service.evaluate({
        workspaceId,
        actorPrincipalId: 'user_manager',
        idempotencyKey: 'candidate-1',
        program: {
          id: source.partnerReferralProgramId,
          version: 1,
          fingerprintSha256: source.programFingerprintSha256
        },
        siteInboundAttribution: {
          id: link.businessAttributionLinkId,
          version: 1,
          fingerprintSha256: link.businessAttributionFingerprintSha256
        }
      })
    ).rejects.toMatchObject({ code: 'LINEAGE_MISMATCH' });
    expect(createCandidate).not.toHaveBeenCalled();
  });

  it('does not apply a referral program retroactively to an earlier touchpoint', async () => {
    const link = siteLink('partner-a', '2026-09-17T01:59:59.000Z');
    const { service, createCandidate } = setup(link);
    const source = program();
    await expect(
      service.evaluate({
        workspaceId,
        actorPrincipalId: 'user_manager',
        idempotencyKey: 'candidate-before-policy',
        program: {
          id: source.partnerReferralProgramId,
          version: 1,
          fingerprintSha256: source.programFingerprintSha256
        },
        siteInboundAttribution: {
          id: link.businessAttributionLinkId,
          version: 1,
          fingerprintSha256: link.businessAttributionFingerprintSha256
        }
      })
    ).rejects.toMatchObject({ code: 'POLICY_NOT_EFFECTIVE' });
    expect(createCandidate).not.toHaveBeenCalled();
  });
});
