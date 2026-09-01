import { describe, expect, it } from 'vitest';
import {
  directExecutorDiscoveryDisclosureStates,
  discoveryEvidenceKinds,
  discoveryLimitationCodes,
  discoverySourceAuthorityStates,
  noProviderDiscoveryAuthorityConsequences,
  providerDiscoveryContractFixtureV1,
  providerDiscoveryResultStatuses
} from '../src/provider-discovery.js';

describe('MGSN Provider Discovery Candidate V1 shared contract', () => {
  it('freezes candidate-only authority with no Selection, Allocation, Acceptance or protected action consequence', () => {
    expect(Object.values(noProviderDiscoveryAuthorityConsequences).every((value) => !value)).toBe(
      true
    );
    expect(noProviderDiscoveryAuthorityConsequences).toEqual({
      providerSelected: false,
      providerAllocated: false,
      providerAccepted: false,
      providerEngaged: false,
      professionalAppointmentCreated: false,
      externalContactAuthorized: false,
      protectedActionAuthorized: false,
      filingAuthorized: false,
      paymentAuthorized: false,
      officialTruthCreated: false
    });

    const candidate = providerDiscoveryContractFixtureV1.candidateResult.candidates[0];
    expect(candidate.authorityConsequences).toEqual(noProviderDiscoveryAuthorityConsequences);
  });

  it('uses an explicit authorized projection rather than Provider/Supply wholesale serialization', () => {
    const candidate = providerDiscoveryContractFixtureV1.candidateResult.candidates[0];
    expect(candidate.request.requestedDataClasses).toEqual([
      'PROVIDER_REFERENCE',
      'SUPPLY_PROFILE',
      'SERVICE_JURISDICTIONS',
      'PROVIDER_EVIDENCE_REFERENCE'
    ]);
    expect(candidate.request.requestedFields).toEqual([
      'providerId',
      'displayName',
      'serviceTypes',
      'jurisdictions',
      'evidenceReferences'
    ]);
    const serializedProjection = JSON.stringify(candidate.authorizedProjection);

    for (const forbidden of [
      'capacityUnits',
      'availabilityUnits',
      'applicant',
      'ownerOfficial',
      'endClient',
      'customer',
      'contact',
      'margin',
      'profit',
      'communications'
    ]) {
      expect(serializedProjection).not.toContain(forbidden);
    }

    expect(candidate.authorizedProjection.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dataClass: 'PROVIDER_REFERENCE', field: 'providerId' }),
        expect.objectContaining({ dataClass: 'SUPPLY_PROFILE', field: 'serviceTypes' }),
        expect.objectContaining({ dataClass: 'SERVICE_JURISDICTIONS', field: 'jurisdictions' })
      ])
    );
  });

  it('keeps visibility evidence, suitability evidence and source authority/version/freshness explicit', () => {
    expect(discoverySourceAuthorityStates).toEqual([
      'CURRENT',
      'STALE',
      'AMBIGUOUS',
      'UNAVAILABLE'
    ]);
    expect(discoveryEvidenceKinds).toContain('PARTICIPATION_VISIBILITY');
    expect(discoveryEvidenceKinds).toContain('SUPPLY_SUITABILITY');

    const candidate = providerDiscoveryContractFixtureV1.candidateResult.candidates[0];
    expect(candidate.visibilityEvidence[0]).toMatchObject({
      kind: 'PARTICIPATION_VISIBILITY',
      artifactAccessAuthorized: false,
      source: { version: 6, authorityState: 'CURRENT' },
      authorityClass: 'MGSN_OPERATIONAL'
    });
    expect(candidate.suitabilityEvidence[0]).toMatchObject({
      kind: 'SUPPLY_SUITABILITY',
      artifactAccessAuthorized: false,
      source: { version: 7, authorityState: 'CURRENT' },
      authorityClass: 'MGSN_OPERATIONAL'
    });
    expect(candidate.sourceVersions.every((source) => source.version !== undefined)).toBe(true);
    expect(candidate.sourceVersions.every((source) => source.authorityState === 'CURRENT')).toBe(true);
    expect(candidate.evaluationPolicyVersion).toBe('mgsn-provider-discovery-v1');
  });

  it('requires current visibility revalidation instead of treating historical candidate replay as permission', () => {
    const candidate = providerDiscoveryContractFixtureV1.candidateResult.candidates[0];
    expect(candidate.visibilityAuthorization).toEqual({
      networkParticipationId: 'network-participation_fixture-381',
      participationVersion: 4,
      visibilityPolicyVersion: 6,
      evaluatedAt: '2026-09-01T04:45:00.000Z',
      currentAuthorityRevalidationRequiredBeforeServe: true
    });
    expect(candidate.explanation.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CURRENT_VISIBILITY_REVALIDATION_REQUIRED' })
      ])
    );
  });

  it('does not assume Direct-to-Executor proof while #375 remains an independent evidence boundary', () => {
    expect(directExecutorDiscoveryDisclosureStates).toEqual([
      'UNKNOWN',
      'UNPROVEN',
      'INDEPENDENT_EVIDENCE_REFERENCED'
    ]);
    expect(directExecutorDiscoveryDisclosureStates).not.toContain('PROVEN');

    const candidate = providerDiscoveryContractFixtureV1.candidateResult.candidates[0];
    expect(candidate.directExecutorDisclosure).toEqual({
      state: 'UNPROVEN',
      evidenceReferences: [],
      requiresIndependentCurrentVerification: true
    });
    expect(discoveryLimitationCodes).toContain('DIRECT_EXECUTOR_NOT_ESTABLISHED');
  });

  it('represents a privacy-safe fail-closed empty result without hidden Provider leakage', () => {
    expect(providerDiscoveryResultStatuses).toEqual([
      'CANDIDATES',
      'NO_AUTHORIZED_CANDIDATES',
      'AUTHORITY_UNAVAILABLE'
    ]);

    const result = providerDiscoveryContractFixtureV1.failClosedResult;
    expect(result.status).toBe('NO_AUTHORIZED_CANDIDATES');
    expect(result.candidates).toEqual([]);
    expect(result.publicMessage).toBe('No Provider candidates are currently available for this request.');

    const authorityUnavailable = providerDiscoveryContractFixtureV1.authorityUnavailableResult;
    expect(authorityUnavailable).toMatchObject({
      status: 'AUTHORITY_UNAVAILABLE',
      candidates: [],
      authorityState: 'STALE'
    });

    for (const candidateResult of [result, authorityUnavailable]) {
      const serialized = JSON.stringify(candidateResult);
      for (const forbidden of [
        'excludedProvider',
        'hiddenProvider',
        'excludedCount',
        'internalReason',
        'NOT_PARTICIPATING',
        'VISIBILITY_PRIVATE'
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    }
  });

  it('defines no universal rank, winner or score semantics', () => {
    const candidate = providerDiscoveryContractFixtureV1.candidateResult.candidates[0];
    expect(candidate).not.toHaveProperty('rank');
    expect(candidate).not.toHaveProperty('score');
    expect(candidate).not.toHaveProperty('winner');
    expect(providerDiscoveryContractFixtureV1.candidateResult).not.toHaveProperty('winner');
  });
});
