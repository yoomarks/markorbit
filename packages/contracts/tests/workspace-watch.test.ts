import { describe, expect, it } from 'vitest';

import {
  isWorkspaceWatchTargetStatusTransitionAllowedV1,
  noWorkspaceWatchAuthorityConsequencesV1,
  parseWorkspaceWatchDiscoveryResultV1,
  parseWorkspaceWatchTargetV1,
  workspaceWatchPurposes
} from '../src/workspace-watch.js';
import { DATA_ENGINE_FACT_AUTHORITY, DATA_ENGINE_SOURCE_OWNER } from '../src/data-engine.js';
import type {
  DataEngineApplicantCandidateReferenceV1,
  DataEngineDiscoverySourceReferenceV1
} from '../src/data-engine-applicant-discovery.js';

const SHA_A = `sha256:${'a'.repeat(64)}`;
const SHA_B = `sha256:${'b'.repeat(64)}`;
const SOURCE_AT = '2026-09-10T09:00:00.000Z';
const CREATED_AT = '2026-09-10T10:00:00.000Z';

function sourceReference(
  kind: 'APPLICANT_IDENTITY' | 'TRADEMARK_RECORD',
  sourceId: string,
  jurisdiction: 'CN' | 'US' = 'CN'
): DataEngineDiscoverySourceReferenceV1 {
  return {
    owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction,
    source_kind: kind,
    source_id: sourceId,
    source_version: 'M1.9-test',
    source_fingerprint_sha256: sourceId.endsWith('2') ? SHA_B : SHA_A,
    observed_at: SOURCE_AT
  };
}

function applicantReference(
  id = 'applicant-candidate-1',
  sourceId = 'applicant-source-1',
  jurisdiction: 'CN' | 'US' = 'CN'
): DataEngineApplicantCandidateReferenceV1 {
  return {
    applicant_candidate_id: id,
    source_reference: sourceReference('APPLICANT_IDENTITY', sourceId, jurisdiction)
  };
}

function applicantTarget() {
  return { targetKind: 'APPLICANT' as const, applicant: applicantReference() };
}

function trademarkTarget(id = 'trademark-candidate-1') {
  return {
    targetKind: 'TRADEMARK' as const,
    trademarkCandidateId: id,
    applicant: applicantReference(),
    sourceReference: sourceReference(
      'TRADEMARK_RECORD',
      id.endsWith('2') ? 'trademark-source-2' : 'trademark-source-1'
    )
  };
}

function watchTarget<
  T extends ReturnType<typeof applicantTarget> | ReturnType<typeof trademarkTarget>
>(target: T) {
  return {
    schemaVersion: 1 as const,
    workspaceWatchTargetId: 'workspace-watch-target_agency-1',
    workspaceId: 'workspace-a',
    version: 1,
    status: 'ACTIVE' as const,
    purpose: 'CLIENT_MONITORING' as const,
    reason: 'Monitor selected external candidate',
    target,
    userConfirmed: true as const,
    createdByPrincipalId: 'principal_mile',
    authorityConsequences: noWorkspaceWatchAuthorityConsequencesV1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    archivedAt: null
  };
}

function discoveryResult(
  readState: 'RESULTS' | 'EMPTY' | 'NOT_FOUND' | 'NOT_OBSERVED' | 'NOT_COVERED' | 'UNAVAILABLE',
  candidates = readState === 'RESULTS' ? [trademarkTarget()] : []
) {
  return {
    schemaVersion: 1 as const,
    workspaceId: 'workspace-a',
    watchTarget: {
      workspaceWatchTargetId: 'workspace-watch-target_agency-1',
      version: 1
    },
    readState,
    candidateReferences: candidates,
    evaluatedAt: '2026-09-10T11:00:00.000Z',
    automaticAdmissionAuthorized: false as const,
    trademarkAssetCreated: false as const,
    officialTruthCreated: false as const,
    legalConclusionCreated: false as const
  };
}

describe('Workspace Applicant / Trademark Watch Target V1', () => {
  it('accepts an explicit Applicant Watch without promoting Applicant or Customer truth', () => {
    const parsed = parseWorkspaceWatchTargetV1(watchTarget(applicantTarget()), 'workspace-a');
    expect(parsed.target.targetKind).toBe('APPLICANT');
    expect(parsed.userConfirmed).toBe(true);
    expect(parsed.purpose).toBe('CLIENT_MONITORING');
    expect(parsed.authorityConsequences).toEqual(noWorkspaceWatchAuthorityConsequencesV1);
    expect(parsed.authorityConsequences.verifiedApplicantIdentityEstablished).toBe(false);
    expect(parsed.authorityConsequences.customerRelationshipEstablished).toBe(false);
    expect(parsed.authorityConsequences.trademarkAssetCreated).toBe(false);
  });

  it('accepts only an exact unadmitted Trademark candidate pointer', () => {
    const parsed = parseWorkspaceWatchTargetV1(watchTarget(trademarkTarget()));
    expect(parsed.target.targetKind).toBe('TRADEMARK');
    if (parsed.target.targetKind !== 'TRADEMARK') throw new Error('expected TRADEMARK target');
    expect(parsed.target.sourceReference.source_kind).toBe('TRADEMARK_RECORD');
    expect(JSON.stringify(parsed.target)).not.toContain('mark_text');
    expect(JSON.stringify(parsed.target)).not.toContain('classes');
    expect(JSON.stringify(parsed)).not.toContain('trademarkAssetId');
    expect(JSON.stringify(parsed)).not.toContain('workspaceRelationships');
  });

  it('fails closed on wrong Trademark source kind or Applicant/source jurisdiction drift', () => {
    const base = watchTarget(trademarkTarget());
    const wrongKind = {
      ...base,
      target: {
        ...base.target,
        sourceReference: { ...base.target.sourceReference, source_kind: 'APPLICANT_IDENTITY' }
      }
    };
    expect(() => parseWorkspaceWatchTargetV1(wrongKind)).toThrow();

    const jurisdictionDrift = {
      ...base,
      target: {
        ...base.target,
        sourceReference: { ...base.target.sourceReference, jurisdiction: 'US' }
      }
    };
    expect(() => parseWorkspaceWatchTargetV1(jurisdictionDrift)).toThrow();
  });

  it('enforces Workspace isolation and explicit human confirmation', () => {
    expect(() =>
      parseWorkspaceWatchTargetV1(watchTarget(applicantTarget()), 'workspace-b')
    ).toThrow();

    const notConfirmed = { ...watchTarget(applicantTarget()), userConfirmed: false };
    expect(() => parseWorkspaceWatchTargetV1(notConfirmed)).toThrow();
  });

  it('freezes the minimal ACTIVE to ARCHIVED lifecycle with positive version semantics', () => {
    expect(isWorkspaceWatchTargetStatusTransitionAllowedV1('ACTIVE', 'ARCHIVED')).toBe(true);
    expect(isWorkspaceWatchTargetStatusTransitionAllowedV1('ACTIVE', 'ACTIVE')).toBe(false);
    expect(isWorkspaceWatchTargetStatusTransitionAllowedV1('ARCHIVED', 'ACTIVE')).toBe(false);

    const archived = {
      ...watchTarget(applicantTarget()),
      version: 2,
      status: 'ARCHIVED' as const,
      updatedAt: '2026-09-10T12:00:00.000Z',
      archivedAt: '2026-09-10T11:30:00.000Z'
    };
    expect(parseWorkspaceWatchTargetV1(archived).version).toBe(2);
  });

  it('rejects unknown fields, Asset-management-shaped smuggling and authority escalation', () => {
    const unknown = {
      ...watchTarget(applicantTarget()),
      asset: { trademarkAssetId: 'trademark-asset_fake', version: 1 }
    };
    expect(() => parseWorkspaceWatchTargetV1(unknown)).toThrow();

    const targetSmuggle = structuredClone(watchTarget(trademarkTarget())) as Record<
      string,
      unknown
    >;
    (targetSmuggle.target as Record<string, unknown>).signal = 'management-signal_fake';
    expect(() => parseWorkspaceWatchTargetV1(targetSmuggle)).toThrow();

    const authority = structuredClone(watchTarget(applicantTarget())) as Record<string, unknown>;
    (authority.authorityConsequences as Record<string, unknown>).managedRelationshipEstablished =
      true;
    expect(() => parseWorkspaceWatchTargetV1(authority)).toThrow();
  });

  it('keeps every discovery result as an unadmitted Trademark candidate pointer', () => {
    const parsed = parseWorkspaceWatchDiscoveryResultV1(discoveryResult('RESULTS'), 'workspace-a');
    expect(parsed.readState).toBe('RESULTS');
    expect(parsed.candidateReferences).toHaveLength(1);
    expect(parsed.candidateReferences[0]?.targetKind).toBe('TRADEMARK');
    expect(parsed.automaticAdmissionAuthorized).toBe(false);
    expect(parsed.trademarkAssetCreated).toBe(false);
    expect(parsed.officialTruthCreated).toBe(false);
    expect(parsed.legalConclusionCreated).toBe(false);
  });

  it('preserves EMPTY, NOT_OBSERVED, NOT_COVERED and UNAVAILABLE as distinct read states', () => {
    for (const state of ['EMPTY', 'NOT_OBSERVED', 'NOT_COVERED', 'UNAVAILABLE'] as const) {
      const parsed = parseWorkspaceWatchDiscoveryResultV1(discoveryResult(state));
      expect(parsed.readState).toBe(state);
      expect(parsed.candidateReferences).toEqual([]);
    }

    expect(() =>
      parseWorkspaceWatchDiscoveryResultV1(discoveryResult('UNAVAILABLE', [trademarkTarget()]))
    ).toThrow();
    expect(() => parseWorkspaceWatchDiscoveryResultV1(discoveryResult('RESULTS', []))).toThrow();
  });

  it('fails closed on duplicate/future candidate evidence and exposes only bounded purposes', () => {
    const duplicate = discoveryResult('RESULTS', [trademarkTarget(), trademarkTarget()]);
    expect(() => parseWorkspaceWatchDiscoveryResultV1(duplicate)).toThrow();

    const future = structuredClone(discoveryResult('RESULTS')) as Record<string, unknown>;
    const candidates = future.candidateReferences as Array<Record<string, unknown>>;
    (candidates[0]!.sourceReference as Record<string, unknown>).observed_at =
      '2026-09-11T00:00:00.000Z';
    expect(() => parseWorkspaceWatchDiscoveryResultV1(future)).toThrow();

    expect(workspaceWatchPurposes).toEqual([
      'ENFORCEMENT',
      'BUSINESS_DEVELOPMENT',
      'COMPETITIVE',
      'ACQUISITION',
      'CLIENT_MONITORING',
      'OTHER'
    ]);
  });
});
