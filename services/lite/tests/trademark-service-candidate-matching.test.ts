import { describe, expect, it } from 'vitest';
import { matchTrademarkServiceCandidates } from '../src/trademark-service-candidate-matching.js';

const intent = {
  kind: 'RENEWAL',
  jurisdiction: 'US',
  title: 'Prepare renewal service',
  rationale: 'Reviewed service preparation need.',
  inferredFromProductContext: true,
  reviewedByUser: true,
  legalConclusionCreated: false,
  serviceAvailabilityVerified: false,
  legalDeadlineCertified: false
} as const;

function match(
  overrides: Partial<Parameters<typeof matchTrademarkServiceCandidates>[0]> = {}
) {
  return matchTrademarkServiceCandidates({
    workspaceId: '94949494-9494-4949-8949-949494949494',
    workPackageId: 'trademark-service-work-package_matching-test',
    intent,
    capabilitySnapshots: [
      {
        sourceAuthority: 'CAPABILITY_ENGINE',
        capabilityReference: 'capability_renewal-us',
        capabilityVersion: '4',
        supportedIntentKinds: ['RENEWAL'],
        supportedJurisdictions: ['US'],
        current: true
      }
    ],
    providerSnapshots: [
      {
        sourceAuthority: 'MGSN',
        providerReference: 'provider_us-1',
        capabilityReferences: ['capability_renewal-us'],
        supportedJurisdictions: ['US'],
        operational: true,
        current: true
      }
    ],
    servicePackageSnapshots: [
      {
        sourceAuthority: 'MGSN',
        servicePackageReference: 'service-package_us-renewal-1',
        capabilityReference: 'capability_renewal-us',
        providerReference: 'provider_us-1',
        description: 'US renewal preparation package',
        supportedIntentKinds: ['RENEWAL'],
        jurisdiction: 'US',
        status: 'ADMITTED',
        eligibilityOutcome: 'ELIGIBLE',
        eligibilityReference: 'eligibility-evaluation_1',
        sourceVersion: '3',
        current: true
      }
    ],
    generatedAt: '2026-08-21T05:00:00.000Z',
    ...overrides
  });
}

describe('M12-WP05 Capability / Provider / Service Package candidate matching', () => {
  it('composes matching owner snapshots without promoting candidate authority', () => {
    const result = match();
    expect(result.capabilityCandidates).toEqual([
      expect.objectContaining({
        capabilityReference: 'capability_renewal-us',
        capabilityVersion: '4',
        verifiedCapability: false
      })
    ]);
    expect(result.providerCandidates).toEqual([
      expect.objectContaining({
        providerReference: 'provider_us-1',
        capabilityReference: 'capability_renewal-us',
        engaged: false,
        selectedForExecution: false
      })
    ]);
    expect(result.servicePackageCandidates).toEqual([
      expect.objectContaining({
        servicePackageReference: 'service-package_us-renewal-1',
        selected: false
      })
    ]);
    expect(result).toMatchObject({
      capabilityVerifiedByLite: false,
      providerEngagedByLite: false,
      providerSelectedByLite: false,
      servicePackageSelectedByLite: false,
      protectedActionAuthorized: false
    });
  });

  it('rejects stale, mismatched and non-owner Capability snapshots', () => {
    const result = match({
      capabilitySnapshots: [
        {
          sourceAuthority: 'CAPABILITY_ENGINE',
          capabilityReference: 'capability_stale',
          supportedIntentKinds: ['RENEWAL'],
          supportedJurisdictions: ['US'],
          current: false
        },
        {
          sourceAuthority: 'CAPABILITY_ENGINE',
          capabilityReference: 'capability_ca',
          supportedIntentKinds: ['RENEWAL'],
          supportedJurisdictions: ['CA'],
          current: true
        }
      ],
      providerSnapshots: [],
      servicePackageSnapshots: []
    });
    expect(result.capabilityCandidates).toEqual([]);
    expect(result.discardedCapabilityCount).toBe(2);
  });

  it('does not produce a Provider candidate without a matching Capability candidate', () => {
    const result = match({
      capabilitySnapshots: [],
      providerSnapshots: [
        {
          sourceAuthority: 'MGSN',
          providerReference: 'provider_orphan',
          capabilityReferences: ['capability_missing'],
          supportedJurisdictions: ['US'],
          operational: true,
          current: true
        }
      ],
      servicePackageSnapshots: []
    });
    expect(result.providerCandidates).toEqual([]);
    expect(result.discardedProviderCount).toBe(1);
  });

  it('excludes inactive or explicitly ineligible Service Packages', () => {
    const result = match({
      servicePackageSnapshots: [
        {
          sourceAuthority: 'MGSN',
          servicePackageReference: 'service-package_ineligible',
          capabilityReference: 'capability_renewal-us',
          providerReference: 'provider_us-1',
          description: 'Not eligible',
          supportedIntentKinds: ['RENEWAL'],
          jurisdiction: 'US',
          status: 'ADMITTED',
          eligibilityOutcome: 'INELIGIBLE',
          current: true
        },
        {
          sourceAuthority: 'MGSN',
          servicePackageReference: 'service-package_inactive',
          capabilityReference: 'capability_renewal-us',
          providerReference: 'provider_us-1',
          description: 'Inactive package',
          supportedIntentKinds: ['RENEWAL'],
          jurisdiction: 'US',
          status: 'INACTIVE',
          current: true
        }
      ]
    });
    expect(result.servicePackageCandidates).toEqual([]);
    expect(result.discardedServicePackageCount).toBe(2);
  });

  it('requires reviewed Service Intent before matching owner snapshots', () => {
    const result = match({ intent: { ...intent, reviewedByUser: false } });
    expect(result.capabilityCandidates).toEqual([]);
    expect(result.providerCandidates).toEqual([]);
    expect(result.servicePackageCandidates).toEqual([]);
    expect(result.capabilityVerifiedByLite).toBe(false);
    expect(result.providerSelectedByLite).toBe(false);
  });

  it('normalizes jurisdiction and returns deterministic candidate ordering', () => {
    const result = match({
      capabilitySnapshots: [
        {
          sourceAuthority: 'CAPABILITY_ENGINE',
          capabilityReference: 'capability_z',
          supportedIntentKinds: ['RENEWAL'],
          supportedJurisdictions: ['us'],
          current: true
        },
        {
          sourceAuthority: 'CAPABILITY_ENGINE',
          capabilityReference: 'capability_a',
          supportedIntentKinds: ['RENEWAL'],
          supportedJurisdictions: ['US'],
          current: true
        }
      ],
      providerSnapshots: [],
      servicePackageSnapshots: []
    });
    expect(result.capabilityCandidates.map((candidate) => candidate.capabilityReference)).toEqual([
      'capability_a',
      'capability_z'
    ]);
  });
});
