import { createHash } from 'node:crypto';
import {
  parseWorkspaceTrademarkIssueIntelligenceV1,
  type BrainInterpreterProfileRefV1,
  type BrainKnowledgeEvidenceId,
  type BrainKnowledgeEvidenceV1,
  type BrainIntelligenceStatus,
  type TrademarkIssueKind,
  type WorkspaceTrademarkIssueIntelligenceV1
} from '@markorbit/contracts/brain-workspace-intelligence';
import type { SourceGovernanceSnapshotV1 } from '@markorbit/contracts/knowledge-content-export';
import {
  fingerprintReadyPackageContentExport,
  validateReadyPackageContentExport,
  type KnowledgeReadyPackageContentRepository
} from './knowledge-content.js';
import type { KnowledgeIntakeRepository } from './knowledge-intake.js';

export type WorkspaceTrademarkIssueIntelligenceErrorCode =
  | 'READY_PACKAGE_NOT_ACCEPTED'
  | 'READY_PACKAGE_CONTENT_MISSING'
  | 'DUPLICATE_EVIDENCE'
  | 'KNOWLEDGE_CONTENT_WORKSPACE_MISMATCH'
  | 'KNOWLEDGE_CONTENT_NOT_GOVERNED'
  | 'KNOWLEDGE_CONTENT_INTEGRITY_FAILURE';

export class WorkspaceTrademarkIssueIntelligenceError extends Error {
  constructor(
    readonly code: WorkspaceTrademarkIssueIntelligenceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'WorkspaceTrademarkIssueIntelligenceError';
  }
}

export interface WorkspaceTrademarkIssueInterpreterDocumentV1 {
  evidenceId: BrainKnowledgeEvidenceId;
  knowledgeWorkspaceId: string;
  readyPackageId: string;
  sourceId: string;
  content: string;
  sourceGovernance: Readonly<SourceGovernanceSnapshotV1>;
}

export interface WorkspaceTrademarkIssueInterpreterPrimitiveV1 {
  kind: TrademarkIssueKind;
  summary: string;
  jurisdiction?: string;
  confidence: number;
  uncertainty: 'LOW' | 'MEDIUM' | 'HIGH';
  evidenceRefs: readonly BrainKnowledgeEvidenceId[];
}

export interface WorkspaceTrademarkIssueInterpreterResultV1 {
  status: BrainIntelligenceStatus;
  primitives: readonly WorkspaceTrademarkIssueInterpreterPrimitiveV1[];
  explanation: string;
}

export interface WorkspaceTrademarkIssueInterpreterV1 {
  profile: Readonly<BrainInterpreterProfileRefV1>;
  interpret(input: {
    workspaceId: string;
    task: 'TRADEMARK_ISSUE_EXTRACTION';
    documents: readonly Readonly<WorkspaceTrademarkIssueInterpreterDocumentV1>[];
  }): Promise<Readonly<WorkspaceTrademarkIssueInterpreterResultV1>>;
}

export interface WorkspaceTrademarkIssueIntelligenceRequestV1 {
  workspaceId: string;
  readyPackageIds: readonly string[];
  generatedAt: string;
}

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function evidenceId(exportSha256: string): BrainKnowledgeEvidenceId {
  return `brain-knowledge-evidence_${exportSha256}`;
}
function primitiveId(
  workspaceId: string,
  interpretation: Readonly<WorkspaceTrademarkIssueInterpreterResultV1>,
  index: number
): `brain-intelligence-primitive_${string}` {
  return `brain-intelligence-primitive_${sha256(
    canonicalJson({ workspaceId, interpretation, index })
  )}`;
}

function intelligenceId(
  workspaceId: string,
  evidence: readonly Readonly<BrainKnowledgeEvidenceV1>[],
  profile: Readonly<BrainInterpreterProfileRefV1>,
  interpretation: Readonly<WorkspaceTrademarkIssueInterpreterResultV1>
): `brain-intelligence_${string}` {
  return `brain-intelligence_${sha256(
    canonicalJson({
      workspaceId,
      evidence: evidence.map((item) => ({
        evidenceId: item.evidenceId,
        exportSha256: item.exportSha256
      })),
      profile,
      interpretation
    })
  )}`;
}

export class WorkspaceTrademarkIssueIntelligenceRuntimeV1 {
  constructor(
    private readonly intakes: KnowledgeIntakeRepository,
    private readonly contents: KnowledgeReadyPackageContentRepository,
    private readonly interpreter: WorkspaceTrademarkIssueInterpreterV1
  ) {}
  async interpret(
    request: Readonly<WorkspaceTrademarkIssueIntelligenceRequestV1>
  ): Promise<Readonly<WorkspaceTrademarkIssueIntelligenceV1>> {
    if (request.readyPackageIds.length === 0) {
      throw new WorkspaceTrademarkIssueIntelligenceError(
        'READY_PACKAGE_NOT_ACCEPTED',
        'At least one accepted ReadyPackage is required.'
      );
    }
    if (new Set(request.readyPackageIds).size !== request.readyPackageIds.length) {
      throw new WorkspaceTrademarkIssueIntelligenceError(
        'DUPLICATE_EVIDENCE',
        'ReadyPackage evidence must be unique before Brain interpretation.'
      );
    }

    const evidence: BrainKnowledgeEvidenceV1[] = [];
    const documents: WorkspaceTrademarkIssueInterpreterDocumentV1[] = [];

    for (const readyPackageId of request.readyPackageIds) {
      const intake = await this.intakes.findAcceptedByReadyPackage(
        request.workspaceId,
        readyPackageId
      );
      if (!intake) {
        throw new WorkspaceTrademarkIssueIntelligenceError(
          'READY_PACKAGE_NOT_ACCEPTED',
          'ReadyPackage is not accepted for the requested Workspace.'
        );
      }
      const content = await this.contents.findByReadyPackage(request.workspaceId, readyPackageId);
      if (!content) {
        throw new WorkspaceTrademarkIssueIntelligenceError(
          'READY_PACKAGE_CONTENT_MISSING',
          'Accepted ReadyPackage content is unavailable.'
        );
      }
      if (
        intake.request.workspaceId.toLowerCase() !== request.workspaceId.toLowerCase() ||
        content.workspaceId.toLowerCase() !== request.workspaceId.toLowerCase() ||
        content.intakeId !== intake.intakeId
      ) {
        throw new WorkspaceTrademarkIssueIntelligenceError(
          'KNOWLEDGE_CONTENT_WORKSPACE_MISMATCH',
          'Knowledge evidence does not belong to the requested Workspace.'
        );
      }
      if (content.export.contractVersion !== '1.1' || !content.export.sourceGovernance) {
        throw new WorkspaceTrademarkIssueIntelligenceError(
          'KNOWLEDGE_CONTENT_NOT_GOVERNED',
          'Brain interpretation requires governed Knowledge Content Export V1.1 evidence.'
        );
      }
      const validation = validateReadyPackageContentExport(intake, content.export);
      const exportFingerprint = fingerprintReadyPackageContentExport(content.export);
      const stagingBytes = Buffer.from(content.export.stagingDocument.content, 'utf8');
      const stagingSha256 = sha256(stagingBytes);
      if (
        validation ||
        content.readyPackageId !== readyPackageId ||
        content.readyPackageId !== content.export.readyPackageId ||
        exportFingerprint !== content.exportSha256 ||
        stagingSha256 !== content.export.stagingDocument.sha256 ||
        stagingBytes.byteLength !== content.export.stagingDocument.sizeBytes
      ) {
        throw new WorkspaceTrademarkIssueIntelligenceError(
          'KNOWLEDGE_CONTENT_INTEGRITY_FAILURE',
          validation?.message ?? 'Knowledge evidence failed export or staging integrity checks.'
        );
      }

      const nextEvidence: BrainKnowledgeEvidenceV1 = {
        schemaVersion: 1,
        evidenceId: evidenceId(exportFingerprint),
        intakeId: intake.intakeId,
        knowledgeWorkspaceId: content.export.knowledgeWorkspaceId,
        readyPackageId: content.export.readyPackageId,
        readyPackageDigest: content.export.readyPackageDigest,
        exportSha256: exportFingerprint,
        sourceId: content.export.provenance.sourceId,
        rawArtifactId: content.export.rawArtifact.artifactId,
        rawArtifactSha256: content.export.rawArtifact.sha256,
        stagingDocumentId: content.export.stagingDocument.documentId,
        contentSha256: content.export.stagingDocument.sha256,
        capturedAt: content.export.provenance.capturedAt
      };
      evidence.push(nextEvidence);
      documents.push({
        evidenceId: nextEvidence.evidenceId,
        knowledgeWorkspaceId: nextEvidence.knowledgeWorkspaceId,
        readyPackageId: nextEvidence.readyPackageId,
        sourceId: nextEvidence.sourceId,
        content: content.export.stagingDocument.content,
        sourceGovernance: content.export.sourceGovernance
      });
    }

    const interpretation = await this.interpreter.interpret({
      workspaceId: request.workspaceId,
      task: 'TRADEMARK_ISSUE_EXTRACTION',
      documents
    });
    const intelligence = {
      schemaVersion: 1,
      intelligenceId: intelligenceId(
        request.workspaceId,
        evidence,
        this.interpreter.profile,
        interpretation
      ),
      workspaceId: request.workspaceId,
      task: 'TRADEMARK_ISSUE_EXTRACTION',
      status: interpretation.status,
      evidence,
      primitives: interpretation.primitives.map((primitive, index) => ({
        primitiveId: primitiveId(request.workspaceId, interpretation, index),
        kind: primitive.kind,
        summary: primitive.summary,
        ...(primitive.jurisdiction === undefined ? {} : { jurisdiction: primitive.jurisdiction }),
        confidence: primitive.confidence,
        uncertainty: primitive.uncertainty,
        evidenceRefs: [...primitive.evidenceRefs]
      })),
      explanation: interpretation.explanation,
      interpreter: this.interpreter.profile,
      generatedAt: request.generatedAt
    } as const;

    return parseWorkspaceTrademarkIssueIntelligenceV1(intelligence);
  }
}
