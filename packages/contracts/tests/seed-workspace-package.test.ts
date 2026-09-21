import { describe, expect, it } from 'vitest';
import {
  noSeedWorkspacePackageAuthorityConsequencesV1,
  parseSeedWorkspacePackageV1,
  seedWorkspacePackageFingerprintSha256V1,
  type SeedWorkspacePackageV1
} from '../src/seed-workspace-package.js';

const ref = (kind: string, id: string) => ({
  owner: 'DATA_ENGINE' as const,
  kind,
  id,
  version: 'epoch-12',
  fingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-09-21T00:00:00.000Z'
});

function fixture(): SeedWorkspacePackageV1 {
  const base: Omit<SeedWorkspacePackageV1, 'packageFingerprintSha256'> = {
    schemaVersion: 1,
    seedWorkspacePackageId: 'seed-workspace-package_agency-001',
    version: 1,
    stage: 'PREPARED',
    preparedByWorkspaceId: 'workspace-seed-ops',
    target: {
      kind: 'AGENCY',
      displayName: 'Example Trademark Agency',
      sourceRefs: [ref('CN_AGENT', 'agent-001')]
    },
    collections: {
      representedApplicants: { ...ref('REPRESENTED_APPLICANTS', 'set-001'), count: 186 },
      relatedTrademarks: { ...ref('RELATED_TRADEMARKS', 'set-002'), count: 1842 },
      opportunityCandidates: {
        owner: 'BRAIN',
        kind: 'OPPORTUNITY_CANDIDATES',
        id: 'set-003',
        version: 1,
        fingerprintSha256: 'b'.repeat(64),
        observedAt: '2026-09-21T00:05:00.000Z',
        count: 23
      }
    },
    preparedAt: '2026-09-21T01:00:00.000Z',
    expiresAt: '2026-10-21T01:00:00.000Z',
    authorityConsequences: noSeedWorkspacePackageAuthorityConsequencesV1
  };
  return {
    ...base,
    packageFingerprintSha256: seedWorkspacePackageFingerprintSha256V1(base)
  };
}

describe('SeedWorkspacePackageV1', () => {
  it('parses a precomputed seed package without activating business truth', () => {
    const parsed = parseSeedWorkspacePackageV1(fixture());
    expect(parsed.target.kind).toBe('AGENCY');
    expect(parsed.collections.relatedTrademarks?.count).toBe(1842);
    expect(Object.values(parsed.authorityConsequences).every((value) => value === false)).toBe(
      true
    );
  });

  it('rejects empty target source evidence', () => {
    const value = fixture();
    const changed = {
      ...value,
      target: { ...value.target, sourceRefs: [] }
    };
    expect(() => parseSeedWorkspacePackageV1(changed)).toThrow(/sourceRefs must be non-empty/u);
  });

  it('rejects authority smuggling', () => {
    const value = fixture();
    expect(() =>
      parseSeedWorkspacePackageV1({
        ...value,
        authorityConsequences: {
          ...value.authorityConsequences,
          customerRelationshipEstablished: true
        }
      })
    ).toThrow(/cannot establish business or execution authority/u);
  });

  it('rejects a changed count with a stale fingerprint', () => {
    const value = fixture();
    expect(() =>
      parseSeedWorkspacePackageV1({
        ...value,
        collections: {
          ...value.collections,
          relatedTrademarks: {
            ...value.collections.relatedTrademarks!,
            count: 1843
          }
        }
      })
    ).toThrow(/fingerprint mismatch/u);
  });

  it('requires the package to expire after preparation', () => {
    const value = fixture();
    const changed = {
      ...value,
      expiresAt: value.preparedAt
    };
    expect(() => parseSeedWorkspacePackageV1(changed)).toThrow(/after preparedAt/u);
  });
});
