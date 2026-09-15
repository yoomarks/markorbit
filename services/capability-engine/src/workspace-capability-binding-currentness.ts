import { createHash } from 'node:crypto';
import type { BrainKnowledgeEvidenceId } from '@markorbit/contracts/brain-workspace-intelligence';

export type WorkspaceKnowledgeEvidenceCurrentnessStatusV1 =
  'CURRENT' | 'REVOKED' | 'SUPERSEDED' | 'CURRENTNESS_UNAVAILABLE';

export interface WorkspaceKnowledgeEvidenceCurrentnessQueryV1 {
  workspaceId: string;
  evidenceRefs: readonly BrainKnowledgeEvidenceId[];
}

export interface WorkspaceKnowledgeEvidenceCurrentnessResultV1 {
  status: WorkspaceKnowledgeEvidenceCurrentnessStatusV1;
  evidenceRefs: readonly BrainKnowledgeEvidenceId[];
  ownerSnapshotSha256: string;
  reason: string;
}

export interface WorkspaceKnowledgeEvidenceCurrentnessAuthorityV1 {
  evaluate(
    query: Readonly<WorkspaceKnowledgeEvidenceCurrentnessQueryV1>
  ): Promise<Readonly<WorkspaceKnowledgeEvidenceCurrentnessResultV1>>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  return value;
}
export function workspaceKnowledgeEvidenceCurrentnessSnapshotSha256V1(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

export class UnavailableWorkspaceKnowledgeEvidenceCurrentnessAuthorityV1 implements WorkspaceKnowledgeEvidenceCurrentnessAuthorityV1 {
  async evaluate(
    query: Readonly<WorkspaceKnowledgeEvidenceCurrentnessQueryV1>
  ): Promise<Readonly<WorkspaceKnowledgeEvidenceCurrentnessResultV1>> {
    await Promise.resolve();
    const evidenceRefs = [...query.evidenceRefs];
    return Object.freeze({
      status: 'CURRENTNESS_UNAVAILABLE' as const,
      evidenceRefs,
      ownerSnapshotSha256: workspaceKnowledgeEvidenceCurrentnessSnapshotSha256V1({
        owner: 'KNOWLEDGE',
        model: 'CURRENTNESS_NOT_MODELED',
        workspaceId: query.workspaceId,
        evidenceRefs
      }),
      reason:
        'Knowledge does not yet expose authoritative currentness or revocation truth for the exact evidence set.'
    });
  }
}
