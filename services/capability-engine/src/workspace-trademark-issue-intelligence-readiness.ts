import type {
  BrainIntelligenceStatus,
  WorkspaceTrademarkIssueIntelligenceV1
} from '@markorbit/contracts/brain-workspace-intelligence';

import {
  WorkspaceTrademarkIssueIntelligenceReaderError,
  type WorkspaceTrademarkIssueIntelligenceReadQueryV1,
  type WorkspaceTrademarkIssueIntelligenceReaderV1
} from './workspace-trademark-issue-intelligence-http-reader.js';

export type WorkspaceTrademarkIssueIntelligenceReadinessStatusV1 =
  | 'READY_FOR_CAPABILITY_BINDING'
  | 'NOT_FOUND'
  | 'BLOCKED_BY_INVALID_REFERENCE'
  | 'BLOCKED_BY_INTELLIGENCE_STATUS'
  | 'BRAIN_INTELLIGENCE_INTEGRITY_FAILURE'
  | 'DEPENDENCY_UNAVAILABLE';

export const workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1 = Object.freeze({
  capabilityBindingCreated: false,
  capabilityInvocationAuthorized: false,
  implementationSelected: false,
  professionalDecisionCreated: false,
  recommendationCreated: false,
  quoteCreated: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  productStateCreated: false,
  officialTruthCreated: false
} as const);
export interface WorkspaceTrademarkIssueIntelligenceReadinessReferenceV1 {
  workspaceId: string;
  intelligenceId: string;
}

export interface WorkspaceTrademarkIssueIntelligenceReadyProjectionV1 {
  intelligenceId: string;
  workspaceId: string;
  task: 'TRADEMARK_ISSUE_EXTRACTION';
  status: 'INTERPRETED';
  evidenceRefs: readonly string[];
  primitiveRefs: readonly string[];
  interpreter: Readonly<{
    profileId: string;
    version: string;
    policyProfileId: string;
  }>;
  generatedAt: string;
}

export interface WorkspaceTrademarkIssueIntelligenceReadinessV1 {
  schemaVersion: 1;
  status: WorkspaceTrademarkIssueIntelligenceReadinessStatusV1;
  ready: boolean;
  reference: Readonly<WorkspaceTrademarkIssueIntelligenceReadinessReferenceV1>;
  reason: string;
  intelligence?: Readonly<WorkspaceTrademarkIssueIntelligenceReadyProjectionV1>;
  freshness: Readonly<{
    status: 'NOT_EVALUATED';
    plannedStage: 'WIF-08';
  }>;
  retryable: boolean;
  authority: typeof workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1;
}
const freshnessDeferred = Object.freeze({
  status: 'NOT_EVALUATED' as const,
  plannedStage: 'WIF-08' as const
});

function reference(
  query: Readonly<WorkspaceTrademarkIssueIntelligenceReadQueryV1>
): WorkspaceTrademarkIssueIntelligenceReadinessReferenceV1 {
  return {
    workspaceId: typeof query.workspaceId === 'string' ? query.workspaceId.toLowerCase() : '',
    intelligenceId: typeof query.intelligenceId === 'string' ? query.intelligenceId : ''
  };
}

function result(
  query: Readonly<WorkspaceTrademarkIssueIntelligenceReadQueryV1>,
  status: WorkspaceTrademarkIssueIntelligenceReadinessStatusV1,
  reason: string,
  options: Readonly<{
    retryable?: boolean;
    intelligence?: WorkspaceTrademarkIssueIntelligenceReadyProjectionV1;
  }> = {}
): Readonly<WorkspaceTrademarkIssueIntelligenceReadinessV1> {
  return Object.freeze({
    schemaVersion: 1,
    status,
    ready: status === 'READY_FOR_CAPABILITY_BINDING',
    reference: Object.freeze(reference(query)),
    reason,
    ...(options.intelligence ? { intelligence: Object.freeze(options.intelligence) } : {}),
    freshness: freshnessDeferred,
    retryable: options.retryable ?? false,
    authority: workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1
  });
}
function project(
  intelligence: Readonly<WorkspaceTrademarkIssueIntelligenceV1>
): WorkspaceTrademarkIssueIntelligenceReadyProjectionV1 {
  return {
    intelligenceId: intelligence.intelligenceId,
    workspaceId: intelligence.workspaceId,
    task: intelligence.task,
    status: 'INTERPRETED',
    evidenceRefs: intelligence.evidence.map((item) => item.evidenceId),
    primitiveRefs: intelligence.primitives.map((item) => item.primitiveId),
    interpreter: structuredClone(intelligence.interpreter),
    generatedAt: intelligence.generatedAt
  };
}

function blockedStatus(status: BrainIntelligenceStatus): string {
  return status === 'INSUFFICIENT_EVIDENCE'
    ? 'Brain intelligence has insufficient governed evidence for Capability binding.'
    : 'Brain intelligence is conflicted and cannot enter Capability binding.';
}

export class WorkspaceTrademarkIssueIntelligenceReadinessServiceV1 {
  constructor(private readonly reader: Readonly<WorkspaceTrademarkIssueIntelligenceReaderV1>) {}

  async evaluate(
    query: Readonly<WorkspaceTrademarkIssueIntelligenceReadQueryV1>
  ): Promise<Readonly<WorkspaceTrademarkIssueIntelligenceReadinessV1>> {
    let intelligence: Readonly<WorkspaceTrademarkIssueIntelligenceV1> | undefined;
    try {
      intelligence = await this.reader.read(query);
    } catch (error) {
      if (error instanceof WorkspaceTrademarkIssueIntelligenceReaderError) {
        if (error.code === 'INVALID_QUERY')
          return result(
            query,
            'BLOCKED_BY_INVALID_REFERENCE',
            'Workspace Brain intelligence reference is invalid.'
          );
        if (error.code === 'IDENTITY_MISMATCH')
          return result(
            query,
            'BRAIN_INTELLIGENCE_INTEGRITY_FAILURE',
            'Workspace Brain intelligence identity or persisted integrity is inconsistent.'
          );
        return result(
          query,
          'DEPENDENCY_UNAVAILABLE',
          'Workspace Brain intelligence owner authority is unavailable.',
          { retryable: error.retryable }
        );
      }
      return result(
        query,
        'DEPENDENCY_UNAVAILABLE',
        'Workspace Brain intelligence owner authority failed unexpectedly.',
        { retryable: true }
      );
    }

    if (!intelligence)
      return result(
        query,
        'NOT_FOUND',
        'No durable Workspace Brain intelligence exists for the exact reference.'
      );
    if (intelligence.status !== 'INTERPRETED')
      return result(query, 'BLOCKED_BY_INTELLIGENCE_STATUS', blockedStatus(intelligence.status));

    return result(
      query,
      'READY_FOR_CAPABILITY_BINDING',
      'Durable Workspace Brain intelligence is structurally ready for a later governed Capability binding decision; freshness remains explicitly deferred to WIF-08.',
      { intelligence: project(intelligence) }
    );
  }
}
