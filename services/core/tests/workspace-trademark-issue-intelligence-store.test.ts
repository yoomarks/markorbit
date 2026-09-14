import { describe, expect, it } from 'vitest';
import type {
  BrainIntelligenceId,
  WorkspaceTrademarkIssueIntelligenceV1
} from '@markorbit/contracts/brain-workspace-intelligence';
import { MemoryWorkspaceTrademarkIssueIntelligenceRepository } from '../src/workspace-trademark-issue-intelligence-store.js';

const WORKSPACE_A = '11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = '22222222-2222-4222-8222-222222222222';
const PRIVATE_KNOWLEDGE = 'wsp_01K4J3ABCD1234567890EFGHJK';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function intelligence(
  workspaceId = WORKSPACE_A,
  suffix = '1',
  overrides: Partial<WorkspaceTrademarkIssueIntelligenceV1> = {}
): WorkspaceTrademarkIssueIntelligenceV1 {
  const intelligenceId: BrainIntelligenceId = `brain-intelligence_${suffix.repeat(64)}`;
  const evidenceId = `brain-knowledge-evidence_${HASH_A}` as const;
  return {
    schemaVersion: 1,
    intelligenceId,
    workspaceId,
    task: 'TRADEMARK_ISSUE_EXTRACTION',
    status: 'INTERPRETED',
    evidence: [
      {
        schemaVersion: 1,
        evidenceId,
        intakeId: 'knowledge-intake_test',
        knowledgeWorkspaceId: PRIVATE_KNOWLEDGE,
        readyPackageId: 'ready-package_test',
        readyPackageDigest: HASH_A,
        exportSha256: HASH_B,
        sourceId: 'source_test',
        rawArtifactId: 'raw-artifact_test',
        rawArtifactSha256: HASH_A,
        stagingDocumentId: 'staging-document_test',
        contentSha256: HASH_B,
        capturedAt: '2026-09-14T12:00:00.000Z'
      }
    ],
    primitives: [
      {
        primitiveId: `brain-intelligence-primitive_${HASH_B}`,
        kind: 'REQUIREMENT',
        summary: 'A governed issue primitive.',
        jurisdiction: 'US',
        confidence: 0.9,
        uncertainty: 'LOW',
        evidenceRefs: [evidenceId]
      }
    ],
    explanation: 'Governed evidence supports the extracted requirement.',
    interpreter: {
      profileId: 'brain.trademark-issue-extractor',
      version: '1.0.0',
      policyProfileId: 'brain.policy.governed-evidence.v1'
    },
    generatedAt: '2026-09-14T12:01:00.000Z',
    ...overrides
  };
}

describe('MemoryWorkspaceTrademarkIssueIntelligenceRepository', () => {
  it('records and replays an exact structured intelligence snapshot', async () => {
    const repository = new MemoryWorkspaceTrademarkIssueIntelligenceRepository();
    const value = intelligence();

    const first = await repository.record(value);
    const replay = await repository.record(structuredClone(value));

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.intelligence).toEqual(first.intelligence);
  });

  it('fails closed when the same intelligence id is replayed with changed content', async () => {
    const repository = new MemoryWorkspaceTrademarkIssueIntelligenceRepository();
    const value = intelligence();
    await repository.record(value);

    await expect(
      repository.record({
        ...value,
        explanation: 'Materially changed explanation under the same deterministic id.'
      })
    ).rejects.toMatchObject({
      code: 'IDENTITY_CONFLICT'
    });
  });

  it('isolates reads by Core Workspace and does not reveal another Workspace record', async () => {
    const repository = new MemoryWorkspaceTrademarkIssueIntelligenceRepository();
    const a = intelligence(WORKSPACE_A, '1');
    const b = intelligence(WORKSPACE_B, '2');
    await repository.record(a);
    await repository.record(b);

    expect(await repository.find(WORKSPACE_A, a.intelligenceId)).toEqual(a);
    expect(await repository.find(WORKSPACE_A, b.intelligenceId)).toBeUndefined();
    expect(await repository.find(WORKSPACE_B, a.intelligenceId)).toBeUndefined();
    expect(await repository.find(WORKSPACE_B, b.intelligenceId)).toEqual(b);
  });

  it('rejects malformed intelligence identities before persistence', async () => {
    const repository = new MemoryWorkspaceTrademarkIssueIntelligenceRepository();
    const value = intelligence();

    await expect(
      repository.record({ ...value, intelligenceId: 'brain-intelligence_not-a-sha256' })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
