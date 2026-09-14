import { describe, expect, it } from 'vitest';
import {
  BrainWorkspaceIntelligenceContractError,
  parseWorkspaceTrademarkIssueIntelligenceV1
} from '../src/brain-workspace-intelligence.js';

const workspaceId = '018f0000-0000-7000-8000-000000000301';
const privateEvidenceId = `brain-knowledge-evidence_${'a'.repeat(64)}` as const;
const globalEvidenceId = `brain-knowledge-evidence_${'b'.repeat(64)}` as const;

function evidence(evidenceId: string, knowledgeWorkspaceId: string) {
  return {
    schemaVersion: 1,
    evidenceId,
    intakeId: `intake-${evidenceId.slice(-4)}`,
    knowledgeWorkspaceId,
    readyPackageId: `rdp_${evidenceId.slice(-8)}`,
    readyPackageDigest: 'c'.repeat(64),
    exportSha256: evidenceId.slice('brain-knowledge-evidence_'.length),
    sourceId: 'src_01H00000000000000000000001',
    rawArtifactId: 'art_01H00000000000000000000001',
    rawArtifactSha256: 'd'.repeat(64),
    stagingDocumentId: 'std_01H00000000000000000000001',
    contentSha256: 'e'.repeat(64),
    capturedAt: '2026-09-14T03:00:00.000Z'
  };
}
function fixture() {
  return {
    schemaVersion: 1,
    intelligenceId: `brain-intelligence_${'f'.repeat(64)}`,
    workspaceId,
    task: 'TRADEMARK_ISSUE_EXTRACTION',
    status: 'INTERPRETED',
    evidence: [
      evidence(privateEvidenceId, 'wsp_01H00000000000000000000001'),
      evidence(globalEvidenceId, 'global-public')
    ],
    primitives: [
      {
        primitiveId: `brain-intelligence-primitive_${'9'.repeat(64)}`,
        kind: 'REQUIREMENT',
        summary: 'A response requirement is supported by governed evidence.',
        jurisdiction: 'us',
        confidence: 0.91,
        uncertainty: 'LOW',
        evidenceRefs: [privateEvidenceId, globalEvidenceId]
      }
    ],
    explanation: 'Interpreted from governed Workspace and global Knowledge evidence.',
    interpreter: {
      profileId: 'workspace-trademark-issue-v1',
      version: '1.0.0',
      policyProfileId: 'governed-knowledge-only-v1'
    },
    generatedAt: '2026-09-14T03:05:00.000Z'
  } as const;
}

describe('Workspace Brain Intelligence V1 contract', () => {
  it('accepts Core Workspace intelligence with private and global Knowledge evidence', () => {
    const parsed = parseWorkspaceTrademarkIssueIntelligenceV1(fixture());
    expect(parsed.workspaceId).toBe(workspaceId);
    expect(parsed.evidence.map((item) => item.knowledgeWorkspaceId)).toEqual([
      'wsp_01H00000000000000000000001',
      'global-public'
    ]);
    expect(parsed.primitives[0]?.jurisdiction).toBe('US');
  });

  it('rejects a non-Core Workspace identity', () => {
    expect(() =>
      parseWorkspaceTrademarkIssueIntelligenceV1({ ...fixture(), workspaceId: 'global-public' })
    ).toThrow('canonical Core Workspace UUID');
  });

  it('rejects primitives that cite evidence outside the governed evidence set', () => {
    const value = fixture();
    expect(() =>
      parseWorkspaceTrademarkIssueIntelligenceV1({
        ...value,
        primitives: [
          {
            ...value.primitives[0],
            evidenceRefs: [`brain-knowledge-evidence_${'1'.repeat(64)}`]
          }
        ]
      })
    ).toThrow(BrainWorkspaceIntelligenceContractError);
  });
});
