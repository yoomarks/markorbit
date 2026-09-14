import type {
  BrainIntelligenceId,
  WorkspaceTrademarkIssueIntelligenceV1
} from '@markorbit/contracts/brain-workspace-intelligence';
import type { ManagedDatabase } from '@markorbit/persistence';
import { PostgresKnowledgeReadyPackageContentRepository } from './knowledge-content.js';
import { PostgresKnowledgeIntakeRepository } from './knowledge-intake.js';
import {
  PostgresWorkspaceTrademarkIssueIntelligenceRepository,
  type WorkspaceTrademarkIssueIntelligenceRepository,
  type WorkspaceTrademarkIssueIntelligenceStoreDisposition
} from './workspace-trademark-issue-intelligence-store.js';
import {
  WorkspaceTrademarkIssueIntelligenceRuntimeV1,
  type WorkspaceTrademarkIssueIntelligenceRequestV1,
  type WorkspaceTrademarkIssueInterpreterV1
} from './workspace-trademark-issue-intelligence.js';

export interface WorkspaceTrademarkIssueIntelligenceInterpretationRuntimeV1 {
  interpret(
    request: Readonly<WorkspaceTrademarkIssueIntelligenceRequestV1>
  ): Promise<Readonly<WorkspaceTrademarkIssueIntelligenceV1>>;
}

export class WorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1 {
  constructor(
    private readonly interpretation: WorkspaceTrademarkIssueIntelligenceInterpretationRuntimeV1,
    private readonly repository: WorkspaceTrademarkIssueIntelligenceRepository
  ) {}

  async admit(
    request: Readonly<WorkspaceTrademarkIssueIntelligenceRequestV1>
  ): Promise<WorkspaceTrademarkIssueIntelligenceStoreDisposition> {
    const intelligence = await this.interpretation.interpret(request);
    return this.repository.record(intelligence);
  }

  find(workspaceId: string, intelligenceId: BrainIntelligenceId) {
    return this.repository.find(workspaceId, intelligenceId);
  }
}

export function createPostgresWorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1(
  database: ManagedDatabase,
  interpreter: WorkspaceTrademarkIssueInterpreterV1
): WorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1 {
  const query = database.getPool();
  const interpretation = new WorkspaceTrademarkIssueIntelligenceRuntimeV1(
    new PostgresKnowledgeIntakeRepository(query),
    new PostgresKnowledgeReadyPackageContentRepository(query),
    interpreter
  );
  return new WorkspaceTrademarkIssueIntelligenceAdmissionRuntimeV1(
    interpretation,
    new PostgresWorkspaceTrademarkIssueIntelligenceRepository(database)
  );
}
