import {
  buildCapabilityDependencyPaths,
  buildCoreDependencyPaths,
  type CognitiveDependencyEvidence,
  type CognitiveDependencyOwner,
  type CognitiveDependencyPath
} from './cognitive-dependency-paths.js';

type JsonObject = Record<string, unknown>;

type OwnerReadResult =
  | Readonly<{ status: 'available'; value: JsonObject }>
  | Readonly<{
      status: 'unavailable';
      error: Readonly<{ status: number | null; code: string; message: string }>;
    }>;

export interface CognitiveAttentionSnapshot {
  core: OwnerReadResult;
  capability: OwnerReadResult;
}

export type CognitiveAttentionGroup =
  | 'HUMAN_GOVERNANCE_ATTENTION'
  | 'INTEGRITY_CURRENTNESS_FINDING'
  | 'SOURCE_DEPENDENCY_UNAVAILABLE'
  | 'OBSERVABILITY_RECORDING_LIMITATION';

export type CognitiveAttentionControlMode = 'VIEW_ONLY';
export type CognitiveAttentionResolutionMode = 'EXTERNAL_OWNER_DEPENDENCY';

export interface CognitiveAttentionItem {
  id: string;
  owner: CognitiveDependencyOwner;
  group: CognitiveAttentionGroup;
  title: string;
  needsAttention: string;
  currentState: string;
  why: string;
  affects: string;
  nextLegalStep: string;
  controlMode: CognitiveAttentionControlMode;
  resolutionMode: CognitiveAttentionResolutionMode;
  evidence: readonly CognitiveDependencyEvidence[];
  explanationTargetId: string;
}

export const COGNITIVE_ATTENTION_GROUP_LABELS: Readonly<Record<CognitiveAttentionGroup, string>> = {
  HUMAN_GOVERNANCE_ATTENTION: 'Human / governance attention required',
  INTEGRITY_CURRENTNESS_FINDING: 'Integrity / currentness finding',
  SOURCE_DEPENDENCY_UNAVAILABLE: 'Source / dependency unavailable',
  OBSERVABILITY_RECORDING_LIMITATION: 'Observability / recording limitation'
};

export const COGNITIVE_ATTENTION_GROUP_ORDER: readonly CognitiveAttentionGroup[] = [
  'HUMAN_GOVERNANCE_ATTENTION',
  'INTEGRITY_CURRENTNESS_FINDING',
  'SOURCE_DEPENDENCY_UNAVAILABLE',
  'OBSERVABILITY_RECORDING_LIMITATION'
];

export function cognitiveDependencyTargetId(pathId: string): string {
  return `cognitive-dependency-${pathId.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

function groupForPath(path: CognitiveDependencyPath): CognitiveAttentionGroup {
  if (path.kind === 'BLOCKER') return 'HUMAN_GOVERNANCE_ATTENTION';
  if (path.kind === 'FINDING') return 'INTEGRITY_CURRENTNESS_FINDING';
  if (path.kind === 'LIMITATION' && path.id.includes('audit-unavailable')) {
    return 'SOURCE_DEPENDENCY_UNAVAILABLE';
  }
  if (path.kind === 'LIMITATION') return 'OBSERVABILITY_RECORDING_LIMITATION';
  return 'SOURCE_DEPENDENCY_UNAVAILABLE';
}

function needsAttention(path: CognitiveDependencyPath): string {
  if (path.kind === 'BLOCKER') return `Owner reports an open blocker condition: ${path.title}.`;
  if (path.kind === 'FINDING') return `Owner audit reports a finding: ${path.title}.`;
  if (path.kind === 'LIMITATION' && path.id.includes('audit-unavailable')) {
    return `An owner audit dependency is unavailable: ${path.title}.`;
  }
  if (path.kind === 'LIMITATION')
    return `Owner truth is bounded by a recording limitation: ${path.title}.`;
  return `An owner relationship or state is not established: ${path.title}.`;
}

function nextLegalStep(path: CognitiveDependencyPath): string {
  if (path.kind === 'BLOCKER') {
    return 'View the owner explanation and evidence, then continue through the owning Core governance flow only when an accepted owner action exists. No operator mutation is available in this workspace.';
  }
  if (path.kind === 'FINDING') {
    return 'Inspect the exact owner finding and affected references. Resolution belongs to the Capability Engine owner records; this workspace provides no repair, promotion or approval action.';
  }
  if (path.kind === 'LIMITATION' && path.id.includes('audit-unavailable')) {
    return 'Inspect the unavailable owner dependency. No operator action is available here; a later owner snapshot can establish more only after that dependency becomes available.';
  }
  if (path.kind === 'LIMITATION') {
    return 'Inspect the owner limitation and evidence. Durable owner recording/evidence must become available before this workspace can establish additional state.';
  }
  return 'Inspect the missing or mismatched owner binding. Owner truth must establish the relationship before any further conclusion or governed action.';
}

function attentionFromPath(path: CognitiveDependencyPath): CognitiveAttentionItem | null {
  if (path.kind === 'DEPENDENCY') return null;
  return {
    id: `attention:${path.id}`,
    owner: path.owner,
    group: groupForPath(path),
    title: path.title,
    needsAttention: needsAttention(path),
    currentState: path.currentState,
    why: path.why,
    affects: path.affects,
    nextLegalStep: nextLegalStep(path),
    controlMode: 'VIEW_ONLY',
    resolutionMode: 'EXTERNAL_OWNER_DEPENDENCY',
    evidence: path.evidence,
    explanationTargetId: cognitiveDependencyTargetId(path.id)
  };
}

function ownerUnavailableAttention(
  owner: CognitiveDependencyOwner,
  result: OwnerReadResult
): CognitiveAttentionItem | null {
  if (result.status !== 'unavailable') return null;
  const ownerLabel = owner === 'CORE' ? 'Core' : 'Capability Engine';
  const status =
    result.error.status === null ? 'transport unavailable' : `HTTP ${result.error.status}`;
  return {
    id: `attention:${owner.toLowerCase()}:owner-read-unavailable`,
    owner,
    group: 'SOURCE_DEPENDENCY_UNAVAILABLE',
    title: `${ownerLabel} cognitive owner read is unavailable`,
    needsAttention: `${ownerLabel} owner truth is unavailable to this bounded Control Center read plane.`,
    currentState: `${status} · ${result.error.code}`,
    why: result.error.message,
    affects:
      'This owner projection cannot establish its current cognitive state. The other owner remains independent; unavailable is not known-empty, healthy or ready.',
    nextLegalStep:
      'No operator action is available from this item. Resolve the owner/transport dependency through its owning path; after recovery, load a fresh bounded owner snapshot.',
    controlMode: 'VIEW_ONLY',
    resolutionMode: 'EXTERNAL_OWNER_DEPENDENCY',
    evidence: [
      { label: 'Error code', value: result.error.code },
      {
        label: 'HTTP status',
        value: result.error.status === null ? 'Unavailable' : String(result.error.status)
      },
      { label: 'Owner message', value: result.error.message }
    ],
    explanationTargetId:
      owner === 'CORE'
        ? 'core-cognitive-dependencies-heading'
        : 'capability-cognitive-dependencies-heading'
  };
}

function compareAttention(left: CognitiveAttentionItem, right: CognitiveAttentionItem): number {
  const groupDifference =
    COGNITIVE_ATTENTION_GROUP_ORDER.indexOf(left.group) -
    COGNITIVE_ATTENTION_GROUP_ORDER.indexOf(right.group);
  if (groupDifference !== 0) return groupDifference;
  const ownerDifference = left.owner.localeCompare(right.owner);
  if (ownerDifference !== 0) return ownerDifference;
  return left.id.localeCompare(right.id);
}

export function buildCognitiveAttentionItems(
  snapshot: CognitiveAttentionSnapshot
): readonly CognitiveAttentionItem[] {
  const items: CognitiveAttentionItem[] = [];

  if (snapshot.core.status === 'available') {
    items.push(
      ...buildCoreDependencyPaths(snapshot.core.value)
        .map(attentionFromPath)
        .filter((item): item is CognitiveAttentionItem => item !== null)
    );
  } else {
    const unavailable = ownerUnavailableAttention('CORE', snapshot.core);
    if (unavailable) items.push(unavailable);
  }

  if (snapshot.capability.status === 'available') {
    items.push(
      ...buildCapabilityDependencyPaths(snapshot.capability.value)
        .map(attentionFromPath)
        .filter((item): item is CognitiveAttentionItem => item !== null)
    );
  } else {
    const unavailable = ownerUnavailableAttention('CAPABILITY_ENGINE', snapshot.capability);
    if (unavailable) items.push(unavailable);
  }

  return items.sort(compareAttention);
}
