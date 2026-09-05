import { describe, expect, it } from 'vitest';
import { describeCapabilityCatalogIntegrity } from './capability-catalog-integrity.js';

describe('Capability catalog integrity owner truth', () => {
  it('preserves healthy owner fingerprints without recomputation', () => {
    expect(
      describeCapabilityCatalogIntegrity({
        status: 'CATALOG_HEALTHY',
        snapshotFingerprintSha256: 'a'.repeat(64),
        auditFingerprintSha256: 'b'.repeat(64),
        findings: [],
        authority: { automaticRemediationExecuted: false }
      })
    ).toEqual({
      kind: 'available',
      status: 'CATALOG_HEALTHY',
      snapshotFingerprintSha256: 'a'.repeat(64),
      auditFingerprintSha256: 'b'.repeat(64),
      findings: []
    });
  });

  it('preserves deterministic owner findings as bounded projections', () => {
    const finding = {
      findingId: 'catalog-integrity-finding_1',
      findingFingerprintSha256: 'c'.repeat(64),
      code: 'STALE_CAPABILITY_VERSION',
      capabilityId: 'capability.alpha',
      runtimeCapability: {
        runtimeCapabilityDefinitionId: 'runtime-capability-definition_alpha',
        version: 2,
        capabilityId: 'capability.alpha',
        capabilityVersion: '2'
      },
      implementationProfiles: []
    };
    const view = describeCapabilityCatalogIntegrity({
      status: 'CATALOG_INTEGRITY_FINDINGS',
      snapshotFingerprintSha256: 'd'.repeat(64),
      auditFingerprintSha256: 'e'.repeat(64),
      findings: [finding]
    });
    expect(view).toMatchObject({
      kind: 'available',
      status: 'CATALOG_INTEGRITY_FINDINGS',
      findings: [finding]
    });
  });

  it('keeps unavailable dependency exact and never interprets empty findings as healthy', () => {
    expect(
      describeCapabilityCatalogIntegrity({
        status: 'CATALOG_AUDIT_UNAVAILABLE',
        unavailableDependency: 'IMPLEMENTATION_PROFILE_REGISTRY',
        findings: []
      })
    ).toEqual({
      kind: 'unavailable',
      status: 'CATALOG_AUDIT_UNAVAILABLE',
      unavailableDependency: 'IMPLEMENTATION_PROFILE_REGISTRY'
    });
  });

  it('fails closed for missing or malformed owner status', () => {
    expect(describeCapabilityCatalogIntegrity({ findings: [] })).toEqual({ kind: 'invalid' });
    expect(
      describeCapabilityCatalogIntegrity({
        status: 'CATALOG_HEALTHY',
        findings: []
      })
    ).toEqual({ kind: 'invalid' });
  });
});
