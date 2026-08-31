import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  CapabilityCatalogIntegrityAuditorV1,
  capabilityCatalogIntegrityNoAuthority
} from '../src/capability-catalog-integrity.js';

function capability(
  options: Partial<RuntimeCapabilityDefinition> = {}
): RuntimeCapabilityDefinition {
  return {
    schemaVersion: 1,
    runtimeCapabilityDefinitionId: 'runtime-capability_catalog-primary',
    version: 3,
    capabilityId: 'trademark-analysis',
    capabilityVersion: '2.1.0',
    title: 'Trademark analysis',
    description: 'Accepted deterministic analytical capability.',
    lineage: { capabilityId: 'trademark-analysis' },
    canonReference: {
      canonId: 'capability-canon:trademark-analysis',
      canonVersion: '2026-08-31',
      sourceFingerprintSha256: 'a'.repeat(64)
    },
    acceptedCanonProjection: true,
    createdFromWorkEvidence: false,
    createdFromAiOutput: false,
    createdAt: '2026-08-31T00:00:00.000Z',
    ...options
  };
}

function profile(options: Partial<ImplementationProfile> = {}): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_catalog-primary',
    version: 4,
    capabilityId: 'trademark-analysis',
    capabilityVersion: '2.1.0',
    kind: 'DETERMINISTIC_SERVICE',
    status: 'APPROVED',
    implementationKey: 'analysis:primary',
    inputSchemaId: 'trademark-analysis-input.v1',
    outputSchemaId: 'trademark-analysis-output.v1',
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'MODERATE',
    timeoutMs: 5000,
    maxAttempts: 1,
    approvalPolicyVersion: 'capability-approval.v1',
    createdAt: '2026-08-31T00:01:00.000Z',
    ...options
  };
}

function auditor(
  capabilities: readonly Readonly<RuntimeCapabilityDefinition>[],
  profiles: readonly Readonly<ImplementationProfile>[]
): CapabilityCatalogIntegrityAuditorV1 {
  return new CapabilityCatalogIntegrityAuditorV1({
    capabilities: { listCurrent: () => structuredClone(capabilities) },
    implementations: { listCurrent: () => structuredClone(profiles) }
  });
}

describe('CapabilityCatalogIntegrityAuditorV1', () => {
  it('returns a deterministic healthy snapshot for matching current Canon and approved profile', async () => {
    const first = await auditor([capability()], [profile()]).audit();
    const second = await auditor([capability()], [profile()]).audit();
    expect(first).toEqual(second);
    expect(first.status).toBe('CATALOG_HEALTHY');
    if (first.status === 'CATALOG_AUDIT_UNAVAILABLE') throw new Error('unexpected unavailable');
    expect(first.findings).toEqual([]);
    expect(first.snapshot.currentCapabilities).toHaveLength(1);
    expect(first.snapshot.currentImplementationProfiles).toHaveLength(1);
    expect(first.snapshot.snapshotFingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.auditFingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.authority).toEqual(capabilityCatalogIntegrityNoAuthority);
  });

  it('finds a current Capability with no current Implementation Profile', async () => {
    const result = await auditor([capability()], []).audit();
    expect(result.status).toBe('CATALOG_INTEGRITY_FINDINGS');
    expect(result.findings.map((item) => item.code)).toEqual(['NO_CURRENT_IMPLEMENTATION_PROFILE']);
  });

  it('does not fall back from a current RETIRED profile to historical approval', async () => {
    const result = await auditor(
      [capability()],
      [profile({ version: 5, status: 'RETIRED' })]
    ).audit();
    expect(result.status).toBe('CATALOG_INTEGRITY_FINDINGS');
    expect(result.findings.map((item) => item.code)).toEqual([
      'NO_APPROVED_CURRENT_IMPLEMENTATION'
    ]);
    if (result.status === 'CATALOG_AUDIT_UNAVAILABLE') throw new Error('unexpected unavailable');
    expect(result.snapshot.currentImplementationProfiles[0]?.status).toBe('RETIRED');
  });

  it('finds orphan current Implementation Profiles without inventing a Capability', async () => {
    const result = await auditor([], [profile()]).audit();
    expect(result.status).toBe('CATALOG_INTEGRITY_FINDINGS');
    expect(result.findings.map((item) => item.code)).toEqual(['ORPHAN_IMPLEMENTATION_PROFILE']);
    if (result.status === 'CATALOG_AUDIT_UNAVAILABLE') throw new Error('unexpected unavailable');
    expect(result.findings[0]?.runtimeCapability).toBeUndefined();
  });

  it('finds stale capabilityVersion binding and absence of approved current-version implementation', async () => {
    const result = await auditor([capability()], [profile({ capabilityVersion: '2.0.0' })]).audit();
    expect(result.status).toBe('CATALOG_INTEGRITY_FINDINGS');
    expect(result.findings.map((item) => item.code)).toEqual([
      'NO_APPROVED_CURRENT_IMPLEMENTATION',
      'STALE_CAPABILITY_VERSION'
    ]);
  });

  it('preserves multiple matching APPROVED profiles without auto-selecting them', async () => {
    const alternate = profile({
      implementationProfileId: 'implementation-profile_catalog-secondary',
      version: 2,
      implementationKey: 'analysis:secondary'
    });
    const result = await auditor([capability()], [alternate, profile()]).audit();
    expect(result.status).toBe('CATALOG_HEALTHY');
    if (result.status === 'CATALOG_AUDIT_UNAVAILABLE') throw new Error('unexpected unavailable');
    expect(result.findings).toEqual([]);
    expect(
      result.snapshot.currentImplementationProfiles.map((item) => item.implementationProfileId)
    ).toEqual([
      'implementation-profile_catalog-primary',
      'implementation-profile_catalog-secondary'
    ]);
    expect(result.authority.implementationSelected).toBe(false);
    expect(result.authority.productionSourceAdmitted).toBe(false);
  });

  it('finds malformed current Capability authority flags as bounded catalog evidence', async () => {
    const result = await auditor(
      [capability({ acceptedCanonProjection: false, createdFromAiOutput: true })],
      [profile()]
    ).audit();
    expect(result.status).toBe('CATALOG_INTEGRITY_FINDINGS');
    expect(result.findings.map((item) => item.code)).toEqual([
      'INVALID_CURRENT_CAPABILITY_PROJECTION'
    ]);
  });

  it('returns unavailable without fabricated findings when either registry authority fails', async () => {
    const capabilityFailure = new CapabilityCatalogIntegrityAuditorV1({
      capabilities: {
        listCurrent: () => Promise.reject(new Error('registry unavailable'))
      },
      implementations: { listCurrent: () => [profile()] }
    });
    await expect(capabilityFailure.audit()).resolves.toEqual({
      schemaVersion: 1,
      status: 'CATALOG_AUDIT_UNAVAILABLE',
      unavailableDependency: 'CURRENT_CAPABILITY_CATALOG_AUTHORITY',
      findings: [],
      authority: capabilityCatalogIntegrityNoAuthority
    });

    const implementationFailure = new CapabilityCatalogIntegrityAuditorV1({
      capabilities: { listCurrent: () => [capability()] },
      implementations: {
        listCurrent: () => Promise.reject(new Error('registry unavailable'))
      }
    });
    const result = await implementationFailure.audit();
    expect(result).toEqual({
      schemaVersion: 1,
      status: 'CATALOG_AUDIT_UNAVAILABLE',
      unavailableDependency: 'CURRENT_IMPLEMENTATION_CATALOG_AUTHORITY',
      findings: [],
      authority: capabilityCatalogIntegrityNoAuthority
    });
    expect(result.authority.brainGapCreated).toBe(false);
    expect(result.authority.methodImprovementTriggerCreated).toBe(false);
    expect(result.authority.officialTruthCreated).toBe(false);
  });
});
