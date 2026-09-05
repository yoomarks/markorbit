import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import { describe, expect, it, vi } from 'vitest';
import { CapabilityCatalogIntegrityAuditorV1 } from '../src/capability-catalog-integrity.js';
import {
  CapabilityCognitiveReadError,
  CapabilityCognitiveReadServiceV1
} from '../src/capability-cognitive-read.js';

function capability(
  capabilityId: string,
  overrides: Partial<RuntimeCapabilityDefinition> = {}
): RuntimeCapabilityDefinition {
  return {
    schemaVersion: 1,
    runtimeCapabilityDefinitionId: `runtime-capability_${capabilityId}`,
    version: 1,
    capabilityId,
    capabilityVersion: '1.0.0',
    title: `Capability ${capabilityId}`,
    description: 'Private description that must not enter the bounded integrity projection.',
    lineage: { capabilityId },
    canonReference: {
      canonId: `canon-${capabilityId}`,
      canonVersion: '1.0.0',
      sourceFingerprintSha256: 'a'.repeat(64)
    },
    acceptedCanonProjection: true,
    createdFromWorkEvidence: false,
    createdFromAiOutput: false,
    createdAt: '2026-09-05T00:00:00.000Z',
    ...overrides
  };
}

function profile(
  capabilityId: string,
  overrides: Partial<ImplementationProfile> = {}
): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId: `implementation-profile_${capabilityId}`,
    version: 1,
    capabilityId,
    capabilityVersion: '1.0.0',
    kind: 'AI_ASSISTED_SERVICE',
    status: 'APPROVED',
    implementationKey: `implementation:${capabilityId}:v1`,
    inputSchemaId: `${capabilityId}-input.v1`,
    outputSchemaId: `${capabilityId}-output.v1`,
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'MODERATE',
    timeoutMs: 30_000,
    maxAttempts: 1,
    approvalPolicyVersion: 'implementation-admission.v1',
    createdAt: '2026-09-05T00:01:00.000Z',
    ...overrides
  };
}

function service(
  capabilities: readonly RuntimeCapabilityDefinition[],
  profiles: readonly ImplementationProfile[]
): CapabilityCognitiveReadServiceV1 {
  return new CapabilityCognitiveReadServiceV1(
    { listCurrent: vi.fn(() => Promise.resolve(capabilities)) },
    { listCurrent: vi.fn(() => Promise.resolve(profiles)) },
    () => '2026-09-05T00:02:00.000Z',
    { list: () => [] }
  );
}

async function ownerAudit(
  capabilities: readonly RuntimeCapabilityDefinition[],
  profiles: readonly ImplementationProfile[]
) {
  return new CapabilityCatalogIntegrityAuditorV1({
    capabilities: { listCurrent: () => capabilities },
    implementations: { listCurrent: () => profiles }
  }).audit();
}

describe('Capability cognitive catalog integrity projection', () => {
  it('projects the exact healthy owner audit from the same current snapshot', async () => {
    const capabilities = [capability('alpha')];
    const profiles = [profile('alpha')];
    const [projection, audit] = await Promise.all([
      service(capabilities, profiles).read(),
      ownerAudit(capabilities, profiles)
    ]);

    expect(audit.status).toBe('CATALOG_HEALTHY');
    if (audit.status === 'CATALOG_AUDIT_UNAVAILABLE') throw new Error('unexpected unavailable');
    expect(projection.catalogIntegrity).toEqual({
      status: 'CATALOG_HEALTHY',
      snapshotFingerprintSha256: audit.snapshot.snapshotFingerprintSha256,
      auditFingerprintSha256: audit.auditFingerprintSha256,
      findings: [],
      authority: audit.authority
    });
  });

  it('projects exact structural finding identities without full owner documents', async () => {
    const capabilities = [capability('alpha')];
    const profiles = [
      profile('alpha', {
        capabilityVersion: '0.9.0',
        implementationKey: 'implementation:alpha:stale'
      }),
      profile('orphan')
    ];
    const [projection, audit] = await Promise.all([
      service(capabilities, profiles).read(),
      ownerAudit(capabilities, profiles)
    ]);

    expect(audit.status).toBe('CATALOG_INTEGRITY_FINDINGS');
    if (audit.status !== 'CATALOG_INTEGRITY_FINDINGS') throw new Error('expected findings');
    expect(projection.catalogIntegrity.status).toBe('CATALOG_INTEGRITY_FINDINGS');
    if (projection.catalogIntegrity.status !== 'CATALOG_INTEGRITY_FINDINGS') {
      throw new Error('expected projected findings');
    }
    expect(projection.catalogIntegrity.findings.map((finding) => finding.code)).toEqual([
      'NO_APPROVED_CURRENT_IMPLEMENTATION',
      'STALE_CAPABILITY_VERSION',
      'ORPHAN_IMPLEMENTATION_PROFILE'
    ]);
    expect(
      projection.catalogIntegrity.findings.map((finding) => finding.findingFingerprintSha256)
    ).toEqual(audit.findings.map((finding) => finding.findingFingerprintSha256));
    expect(projection.catalogIntegrity.findings[0]).not.toHaveProperty('canonReference');
    expect(projection.catalogIntegrity.findings[0]).not.toHaveProperty('inputSchemaId');
    expect(projection.catalogIntegrity.findings[0]).not.toHaveProperty('outputSchemaId');
  });

  it('is deterministic under owner inventory reordering', async () => {
    const capabilities = [capability('beta'), capability('alpha')];
    const profiles = [profile('beta'), profile('alpha')];
    const left = await service(capabilities, profiles).read();
    const right = await service([...capabilities].reverse(), [...profiles].reverse()).read();
    expect(left.catalogIntegrity).toEqual(right.catalogIntegrity);
  });

  it('treats a valid empty catalog as a healthy bounded snapshot', async () => {
    const projection = await service([], []).read();
    expect(projection.catalogIntegrity).toMatchObject({ status: 'CATALOG_HEALTHY', findings: [] });
    if (projection.catalogIntegrity.status === 'CATALOG_AUDIT_UNAVAILABLE') {
      throw new Error('empty catalog must not be unavailable');
    }
    expect(projection.catalogIntegrity.snapshotFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(projection.catalogIntegrity.auditFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails closed before integrity can reinterpret malformed owner truth', async () => {
    const malformed = capability('alpha', {
      lineage: { capabilityId: 'different-capability' }
    });
    await expect(service([malformed], []).read()).rejects.toBeInstanceOf(
      CapabilityCognitiveReadError
    );
  });
});
