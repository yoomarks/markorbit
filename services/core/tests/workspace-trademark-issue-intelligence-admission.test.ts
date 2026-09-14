import { describe, expect, it } from 'vitest';
import type {
  BrainIntelligenceId,
  WorkspaceTrademarkIssueIntelligenceV1
} from '@markorbit/contracts/brain-workspace-intelligence';
import {
  WorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1,
  type WorkspaceTrademarkIssueIntelligenceInterpretationRuntimeV1
} from '../src/workspace-trademark-issue-intelligence-admission.js';
import {
  MemoryWorkspaceTrademarkIssueIntelligenceRepository,
  type WorkspaceTrademarkIssueIntelligenceRepository
} from '../src/workspace-trademark-issue-intelligence-store.js';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const INTELLIGENCE_ID: BrainIntelligenceId = `brain-intelligence_${HASH_A}`;
const EVIDENCE_ID = `brain-knowledge-evidence_${HASH_A}` as const;

function intelligence(
  generatedAt = '2026-09-14T12:01:00.000Z'
): WorkspaceTrademarkIssueIntelligenceV1 {
  return {
    schemaVersion: 1,
    intelligenceId: INTELLIGENCE_ID,
    workspaceId: WORKSPACE,
    task: 'TRADEMARK_ISSUE_EXTRACTION',
    status: 'INTERPRETED',
    evidence: [
      {
        schemaVersion: 1,
        evidenceId: EVIDENCE_ID,
        intakeId: 'knowledge-intake_test',
        knowledgeWorkspaceId: 'global-public',
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
        evidenceRefs: [EVIDENCE_ID]
      }
    ],
    explanation: 'Governed evidence supports the extracted requirement.',
    interpreter: {
      profileId: 'brain.trademark-issue-extractor',
      version: '1.0.0',
      policyProfileId: 'brain.policy.governed-evidence.v1'
    },
    generatedAt
  };
}

function request(generatedAt = '2026-09-14T12:01:00.000Z') {
  return {
    workspaceId: WORKSPACE,
    readyPackageIds: ['ready-package_test'],
    generatedAt
  } as const;
}

function interpretation(
  project: (generatedAt: string) => WorkspaceTrademarkIssueIntelligenceV1 = intelligence
): WorkspaceTrademarkIssueIntelligenceInterpretationRuntimeV1 {
  return {
    async interpret(input) {
      await Promise.resolve();
      return project(input.generatedAt);
    }
  };
}

describe('WorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1', () => {
  it('persists interpreted structured intelligence and exposes the stored read', async () => {
    const repository = new MemoryWorkspaceTrademarkIssueIntelligenceRepository();
    const runtime = new WorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1(
      interpretation(),
      repository
    );

    const admitted = await runtime.admit(request());

    expect(admitted.replayed).toBe(false);
    expect(admitted.intelligence).toEqual(intelligence());
    expect(await runtime.find(WORKSPACE, INTELLIGENCE_ID)).toEqual(intelligence());
  });

  it('delegates exact output replay to the immutable intelligence store', async () => {
    const repository = new MemoryWorkspaceTrademarkIssueIntelligenceRepository();
    const runtime = new WorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1(
      interpretation(),
      repository
    );
    await runtime.admit(request());
    const replay = await runtime.admit(request());

    expect(replay.replayed).toBe(true);
    expect(replay.intelligence).toEqual(intelligence());
  });

  it('does not touch persistence when interpretation fails', async () => {
    let writes = 0;
    const repository: WorkspaceTrademarkIssueIntelligenceRepository = {
      async record() {
        await Promise.resolve();
        writes += 1;
        return { intelligence: intelligence(), replayed: false };
      },
      async find() {
        await Promise.resolve();
        return undefined;
      }
    };
    const failingInterpretation: WorkspaceTrademarkIssueIntelligenceInterpretationRuntimeV1 = {
      async interpret() {
        await Promise.resolve();
        throw new Error('interpreter unavailable');
      }
    };
    const runtime = new WorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1(
      failingInterpretation,
      repository
    );

    await expect(runtime.admit(request())).rejects.toThrow('interpreter unavailable');
    expect(writes).toBe(0);
  });

  it('fails closed when the same intelligence identity is regenerated with a different snapshot', async () => {
    const repository = new MemoryWorkspaceTrademarkIssueIntelligenceRepository();
    const runtime = new WorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1(
      interpretation((generatedAt) => intelligence(generatedAt)),
      repository
    );

    await runtime.admit(request('2026-09-14T12:01:00.000Z'));

    await expect(runtime.admit(request('2026-09-14T12:02:00.000Z'))).rejects.toMatchObject({
      code: 'IDENTITY_CONFLICT'
    });
    expect(await runtime.find(WORKSPACE, INTELLIGENCE_ID)).toEqual(
      intelligence('2026-09-14T12:01:00.000Z')
    );
  });
});
