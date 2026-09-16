import { describe, expect, it } from 'vitest';
import {
  noProtectionMonitoringAuthorityConsequencesV1,
  protectionMonitoringFingerprintSha256V1
} from '../src/protection-monitoring.js';

describe('protection monitoring contract', () => {
  it('keeps all legal and protected-action authority consequences false', () => {
    expect(Object.values(noProtectionMonitoringAuthorityConsequencesV1)).toEqual(
      expect.arrayContaining([false])
    );
    expect(
      Object.values(noProtectionMonitoringAuthorityConsequencesV1).every((value) => value === false)
    ).toBe(true);
  });
  it('fingerprints canonically', () => {
    const value = {
      schemaVersion: 1,
      protectionMonitoringCandidateId: 'protection-monitoring-candidate_1',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      version: 1,
      asset: { id: 'trademark-asset_1', version: 1 },
      watchTarget: { id: 'workspace-watch-target_1', version: 1 },
      applicant: { applicant_candidate_id: 'a', source_reference: {} },
      observedTrademark: {},
      relevance: {},
      authorityConsequences: noProtectionMonitoringAuthorityConsequencesV1,
      createdAt: '2026-09-17T00:00:00.000Z',
      updatedAt: '2026-09-17T00:00:00.000Z'
    } as never;
    expect(protectionMonitoringFingerprintSha256V1(value)).toMatch(/^[0-9a-f]{64}$/u);
  });
});
