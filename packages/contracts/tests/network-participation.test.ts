import { describe, expect, it } from 'vitest';
import {
  networkParticipationStateChangeActions,
  networkParticipationStates,
  networkParticipationVisibilityFixtureV1,
  networkVisibilityAuthorityStates,
  networkVisibilityDenialReasons,
  networkVisibilityFieldsByDataClass,
  networkVisibilityPurposes,
  noNetworkParticipationAuthorityConsequences,
  visibilityScopes,
  type ChangeNetworkParticipationStateCommandV1,
  type OptInNetworkParticipationCommandV1,
  type ReplaceVisibilityPolicyCommandV1
} from '../src/network-participation.js';

describe('MGSN Network Participation & Visibility V1 contract', () => {
  it('freezes participation and visibility as axes independent from Provider operational state', () => {
    expect(networkParticipationStates).toEqual([
      'NOT_PARTICIPATING',
      'ACTIVE',
      'PAUSED',
      'REVOKED'
    ]);
    expect(visibilityScopes).toEqual(['PRIVATE', 'TRUSTED', 'BOUNDED_PUBLIC']);

    const fixture = networkParticipationVisibilityFixtureV1.activeProviderWithoutParticipation;
    expect(fixture.providerOperationalStatus).toBe('ACTIVE');
    expect(fixture.participation).toMatchObject({
      networkParticipationId: null,
      participationVersion: null,
      state: 'NOT_PARTICIPATING',
      authorizationReference: null,
      visibilityPolicy: {
        version: null,
        scope: 'PRIVATE',
        grants: [],
        authorizationReference: null
      }
    });
    expect(fixture.exposure).toMatchObject({
      decision: 'DENY',
      denialReasons: ['NOT_PARTICIPATING']
    });
  });

  it('allows ACTIVE participation to remain entirely PRIVATE without discovery exposure', () => {
    const fixture = networkParticipationVisibilityFixtureV1.activeParticipationPrivateVisibility;
    expect(fixture.participation).toMatchObject({
      state: 'ACTIVE',
      participationVersion: 1,
      visibilityPolicy: {
        version: 1,
        scope: 'PRIVATE',
        grants: []
      }
    });
    expect(fixture.exposure).toMatchObject({
      decision: 'DENY',
      authorityState: 'CURRENT',
      denialReasons: ['PRIVATE_SCOPE']
    });
  });

  it('keeps policy fields explicit and excludes wildcard, raw operating capacity and customer data', () => {
    expect(networkVisibilityPurposes).toEqual(['PROVIDER_DISCOVERY']);
    expect(networkVisibilityFieldsByDataClass).toEqual({
      ORGANIZATION_IDENTITY: ['displayName'],
      PROVIDER_REFERENCE: ['providerId', 'displayName'],
      SUPPLY_PROFILE: ['serviceTypes'],
      SERVICE_JURISDICTIONS: ['jurisdictions'],
      PROVIDER_EVIDENCE_REFERENCE: ['evidenceReferences']
    });

    const fields = Object.values(networkVisibilityFieldsByDataClass).flat();
    for (const forbidden of [
      '*',
      'capacityUnits',
      'availabilityUnits',
      'applicant',
      'customer',
      'endClient',
      'contact',
      'margin',
      'profit',
      'communications'
    ]) {
      expect(fields).not.toContain(forbidden);
    }
  });

  it('represents stale, ambiguous and unavailable authority as fail-closed states', () => {
    expect(networkVisibilityAuthorityStates).toEqual([
      'CURRENT',
      'STALE',
      'AMBIGUOUS',
      'UNAVAILABLE'
    ]);
    expect(networkVisibilityDenialReasons).toContain('STALE_POLICY');
    expect(networkVisibilityDenialReasons).toContain('AMBIGUOUS_POLICY');
    expect(networkVisibilityDenialReasons).toContain('AUTHORITY_UNAVAILABLE');

    expect(networkParticipationVisibilityFixtureV1.stalePolicy.exposure).toMatchObject({
      decision: 'DENY',
      authorityState: 'STALE',
      denialReasons: ['STALE_POLICY']
    });
    expect(networkParticipationVisibilityFixtureV1.ambiguousPolicy.exposure).toMatchObject({
      decision: 'DENY',
      authorityState: 'AMBIGUOUS',
      denialReasons: ['AMBIGUOUS_POLICY']
    });
  });

  it('keeps every participation/visibility consequence outside Selection, M4 and protected actions', () => {
    expect(
      Object.values(noNetworkParticipationAuthorityConsequences).every((value) => !value)
    ).toBe(true);
    expect(noNetworkParticipationAuthorityConsequences).toEqual({
      providerCandidateSelected: false,
      providerAllocated: false,
      providerAccepted: false,
      providerEngaged: false,
      professionalAppointmentCreated: false,
      externalContactAuthorized: false,
      protectedActionAuthorized: false,
      filingAuthorized: false,
      paymentAuthorized: false,
      officialTruthCreated: false,
      userCapabilityVerified: false
    });
  });

  it('keeps opt-in separate from pause/resume/revoke and carries no caller Workspace/actor authority', () => {
    expect(networkParticipationStateChangeActions).toEqual(['PAUSE', 'RESUME', 'REVOKE']);

    const optIn = {
      schemaVersion: 1,
      providerId: 'provider_fixture-367',
      authorizationReference: 'authorization:fixture-367-opt-in',
      reason: 'Explicit Workplace opt-in.',
      idempotencyKey: 'fixture-367-opt-in',
      correlationId: 'correlation_fixture-367-opt-in'
    } satisfies OptInNetworkParticipationCommandV1;

    const pause = {
      schemaVersion: 1,
      action: 'PAUSE',
      networkParticipationId: 'network-participation_fixture-367-private',
      providerId: 'provider_fixture-367',
      expectedParticipationVersion: 1,
      expectedVisibilityPolicyVersion: 1,
      authorizationReference: 'authorization:fixture-367-pause',
      reason: 'Pause network exposure.',
      idempotencyKey: 'fixture-367-pause',
      correlationId: 'correlation_fixture-367-pause'
    } satisfies ChangeNetworkParticipationStateCommandV1;

    const replacePolicy = {
      schemaVersion: 1,
      networkParticipationId: 'network-participation_fixture-367-private',
      providerId: 'provider_fixture-367',
      expectedParticipationVersion: 1,
      expectedVisibilityPolicyVersion: 1,
      replacement: {
        scope: 'PRIVATE',
        grants: []
      },
      authorizationReference: 'authorization:fixture-367-private',
      reason: 'Keep all network data private.',
      idempotencyKey: 'fixture-367-policy',
      correlationId: 'correlation_fixture-367-policy'
    } satisfies ReplaceVisibilityPolicyCommandV1;

    for (const command of [optIn, pause, replacePolicy]) {
      expect(command).not.toHaveProperty('workspaceId');
      expect(command).not.toHaveProperty('workplaceId');
      expect(command).not.toHaveProperty('actor');
      expect(command).not.toHaveProperty('actorId');
      expect(command).not.toHaveProperty('userId');
    }
  });
});
