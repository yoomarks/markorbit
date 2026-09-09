import { describe, expect, it } from 'vitest';
import {
  governedWorkspaceImplementationPreferenceV1,
  normalizeWorkspaceImplementationPreferenceV1,
  type WorkspaceImplementationPreferenceV1
} from '../src/workspace-implementation-preference.js';

function preference(
  overrides: Partial<WorkspaceImplementationPreferenceV1> = {}
): WorkspaceImplementationPreferenceV1 {
  return {
    schemaVersion: 1,
    workspaceId: 'workspace_test',
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    version: 1,
    status: 'ACTIVE',
    preferredImplementationKeys: ['ai:workspace-approved:managed-v1'],
    authorityReference: 'workspace-policy-change_authorized-1',
    reason: 'Use the approved Workspace-local implementation.',
    createdAt: '2026-09-09T10:00:00.000Z',
    ...overrides
  };
}

describe('Workspace implementation preference contract', () => {
  it('normalizes only the governed preference shape and rejects hidden provider controls', () => {
    expect(normalizeWorkspaceImplementationPreferenceV1(preference())).toEqual(preference());
    expect(() =>
      normalizeWorkspaceImplementationPreferenceV1({
        ...preference(),
        providerApiKey: 'secret',
        endpoint: 'https://caller.invalid'
      })
    ).toThrow(/unsupported fields/u);
  });

  it('requires ACTIVE records to contain unique implementation keys', () => {
    expect(() =>
      normalizeWorkspaceImplementationPreferenceV1(preference({ preferredImplementationKeys: [] }))
    ).toThrow(/requires at least one/u);
    expect(() =>
      normalizeWorkspaceImplementationPreferenceV1(
        preference({
          preferredImplementationKeys: [
            'ai:workspace-approved:managed-v1',
            'ai:workspace-approved:managed-v1'
          ]
        })
      )
    ).toThrow(/must not contain duplicates/u);
  });

  it('uses an explicit CLEARED version to restore global fallback without retaining a local key', () => {
    const cleared = preference({
      version: 2,
      status: 'CLEARED',
      preferredImplementationKeys: [],
      reason: 'Restore the governed MO-global implementation preference.',
      createdAt: '2026-09-09T11:00:00.000Z'
    });
    expect(normalizeWorkspaceImplementationPreferenceV1(cleared)).toEqual(cleared);
    expect(governedWorkspaceImplementationPreferenceV1(cleared)).toBeUndefined();
    expect(() =>
      normalizeWorkspaceImplementationPreferenceV1(preference({ status: 'CLEARED' }))
    ).toThrow(/cannot retain/u);
  });

  it('returns exact version and fingerprint provenance for an ACTIVE resolver result', () => {
    const resolved = governedWorkspaceImplementationPreferenceV1(preference());
    expect(resolved).toMatchObject({
      preferredImplementationKeys: ['ai:workspace-approved:managed-v1']
    });
    expect(resolved?.policyVersion).toMatch(
      /^workspace-implementation-preference\.v1:1:[a-f0-9]{32}$/u
    );
    expect(
      governedWorkspaceImplementationPreferenceV1(
        preference({ version: 2, createdAt: '2026-09-09T11:00:00.000Z' })
      )?.policyVersion
    ).not.toBe(resolved?.policyVersion);
  });
});
