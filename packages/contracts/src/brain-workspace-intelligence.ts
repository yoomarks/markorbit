export type BrainIntelligenceId = `brain-intelligence_${string}`;
export type BrainIntelligencePrimitiveId = `brain-intelligence-primitive_${string}`;
export type BrainKnowledgeEvidenceId = `brain-knowledge-evidence_${string}`;

export const brainIntelligenceStatuses = [
  'INTERPRETED',
  'INSUFFICIENT_EVIDENCE',
  'CONFLICTED'
] as const;
export type BrainIntelligenceStatus = (typeof brainIntelligenceStatuses)[number];

export const trademarkIssueKinds = [
  'REFUSAL_GROUND',
  'REQUIREMENT',
  'DEADLINE',
  'PROCEDURAL_STATE',
  'EVIDENCE_GAP',
  'OTHER'
] as const;
export type TrademarkIssueKind = (typeof trademarkIssueKinds)[number];

export interface BrainKnowledgeEvidenceV1 {
  schemaVersion: 1;
  evidenceId: BrainKnowledgeEvidenceId;
  intakeId: string;
  knowledgeWorkspaceId: string;
  readyPackageId: string;
  readyPackageDigest: string;
  exportSha256: string;
  sourceId: string;
  rawArtifactId: string;
  rawArtifactSha256: string;
  stagingDocumentId: string;
  contentSha256: string;
  capturedAt: string;
}

export interface TrademarkIssuePrimitiveV1 {
  primitiveId: BrainIntelligencePrimitiveId;
  kind: TrademarkIssueKind;
  summary: string;
  jurisdiction?: string;
  confidence: number;
  uncertainty: 'LOW' | 'MEDIUM' | 'HIGH';
  evidenceRefs: readonly BrainKnowledgeEvidenceId[];
}

export interface BrainInterpreterProfileRefV1 {
  profileId: string;
  version: string;
  policyProfileId: string;
}

export interface WorkspaceTrademarkIssueIntelligenceV1 {
  schemaVersion: 1;
  intelligenceId: BrainIntelligenceId;
  workspaceId: string;
  task: 'TRADEMARK_ISSUE_EXTRACTION';
  status: BrainIntelligenceStatus;
  evidence: readonly Readonly<BrainKnowledgeEvidenceV1>[];
  primitives: readonly Readonly<TrademarkIssuePrimitiveV1>[];
  explanation: string;
  interpreter: Readonly<BrainInterpreterProfileRefV1>;
  generatedAt: string;
}

export class BrainWorkspaceIntelligenceContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'BrainWorkspaceIntelligenceContractError';
  }
}

const SHA256 = /^[0-9a-f]{64}$/u;
const CORE_WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const KNOWLEDGE_WORKSPACE = /^wsp_[0-9A-HJKMNP-TV-Z]{26}$/u;

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BrainWorkspaceIntelligenceContractError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allow = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allow.has(key));
  if (unsupported.length) {
    throw new BrainWorkspaceIntelligenceContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
  }
}

function text(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string') {
    throw new BrainWorkspaceIntelligenceContractError(`${field} must be a string.`);
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    throw new BrainWorkspaceIntelligenceContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  }
  return cleaned;
}

function instant(value: unknown, field: string): string {
  const cleaned = text(value, field, 100);
  if (Number.isNaN(Date.parse(cleaned))) {
    throw new BrainWorkspaceIntelligenceContractError(`${field} must be an ISO date/time.`);
  }
  return cleaned;
}
function fingerprint(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned)) {
    throw new BrainWorkspaceIntelligenceContractError(`${field} must be a SHA-256 fingerprint.`);
  }
  return cleaned;
}

function prefixed<T extends string>(value: unknown, prefix: string, field: string): T {
  const cleaned = text(value, field, 300);
  if (!cleaned.startsWith(prefix) || cleaned.length === prefix.length) {
    throw new BrainWorkspaceIntelligenceContractError(`${field} must start with ${prefix}.`);
  }
  return cleaned as T;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    throw new BrainWorkspaceIntelligenceContractError(`${field} is invalid.`);
  }
  return value as T;
}

function parseEvidence(value: unknown): BrainKnowledgeEvidenceV1 {
  const evidence = record(value, 'evidence');
  exactKeys(
    evidence,
    [
      'schemaVersion',
      'evidenceId',
      'intakeId',
      'knowledgeWorkspaceId',
      'readyPackageId',
      'readyPackageDigest',
      'exportSha256',
      'sourceId',
      'rawArtifactId',
      'rawArtifactSha256',
      'stagingDocumentId',
      'contentSha256',
      'capturedAt'
    ],
    'evidence'
  );
  if (evidence.schemaVersion !== 1) {
    throw new BrainWorkspaceIntelligenceContractError('evidence.schemaVersion must be 1.');
  }
  const knowledgeWorkspaceId = text(
    evidence.knowledgeWorkspaceId,
    'evidence.knowledgeWorkspaceId',
    64
  );
  if (knowledgeWorkspaceId !== 'global-public' && !KNOWLEDGE_WORKSPACE.test(knowledgeWorkspaceId)) {
    throw new BrainWorkspaceIntelligenceContractError(
      'evidence.knowledgeWorkspaceId must be a Knowledge Workspace id or global-public.'
    );
  }
  return {
    schemaVersion: 1,
    evidenceId: prefixed<BrainKnowledgeEvidenceId>(
      evidence.evidenceId,
      'brain-knowledge-evidence_',
      'evidence.evidenceId'
    ),
    intakeId: text(evidence.intakeId, 'evidence.intakeId', 300),
    knowledgeWorkspaceId,
    readyPackageId: text(evidence.readyPackageId, 'evidence.readyPackageId', 300),
    readyPackageDigest: fingerprint(evidence.readyPackageDigest, 'evidence.readyPackageDigest'),
    exportSha256: fingerprint(evidence.exportSha256, 'evidence.exportSha256'),
    sourceId: text(evidence.sourceId, 'evidence.sourceId', 300),
    rawArtifactId: text(evidence.rawArtifactId, 'evidence.rawArtifactId', 300),
    rawArtifactSha256: fingerprint(evidence.rawArtifactSha256, 'evidence.rawArtifactSha256'),
    stagingDocumentId: text(evidence.stagingDocumentId, 'evidence.stagingDocumentId', 300),
    contentSha256: fingerprint(evidence.contentSha256, 'evidence.contentSha256'),
    capturedAt: instant(evidence.capturedAt, 'evidence.capturedAt')
  };
}

function parsePrimitive(value: unknown): TrademarkIssuePrimitiveV1 {
  const primitive = record(value, 'primitive');
  exactKeys(
    primitive,
    ['primitiveId', 'kind', 'summary', 'jurisdiction', 'confidence', 'uncertainty', 'evidenceRefs'],
    'primitive'
  );
  if (!Array.isArray(primitive.evidenceRefs) || primitive.evidenceRefs.length === 0) {
    throw new BrainWorkspaceIntelligenceContractError('primitive.evidenceRefs must not be empty.');
  }
  if (
    typeof primitive.confidence !== 'number' ||
    !Number.isFinite(primitive.confidence) ||
    primitive.confidence < 0 ||
    primitive.confidence > 1
  ) {
    throw new BrainWorkspaceIntelligenceContractError(
      'primitive.confidence must be between 0 and 1.'
    );
  }
  return {
    primitiveId: prefixed<BrainIntelligencePrimitiveId>(
      primitive.primitiveId,
      'brain-intelligence-primitive_',
      'primitive.primitiveId'
    ),
    kind: enumValue(primitive.kind, trademarkIssueKinds, 'primitive.kind'),
    summary: text(primitive.summary, 'primitive.summary', 4000),
    ...(primitive.jurisdiction === undefined
      ? {}
      : {
          jurisdiction: text(primitive.jurisdiction, 'primitive.jurisdiction', 100).toUpperCase()
        }),
    confidence: primitive.confidence,
    uncertainty: enumValue(
      primitive.uncertainty,
      ['LOW', 'MEDIUM', 'HIGH'] as const,
      'primitive.uncertainty'
    ),
    evidenceRefs: primitive.evidenceRefs.map((item) =>
      prefixed<BrainKnowledgeEvidenceId>(item, 'brain-knowledge-evidence_', 'primitive.evidenceRef')
    )
  };
}

export function parseWorkspaceTrademarkIssueIntelligenceV1(
  value: unknown
): WorkspaceTrademarkIssueIntelligenceV1 {
  const intelligence = record(value, 'workspaceTrademarkIssueIntelligence');
  exactKeys(
    intelligence,
    [
      'schemaVersion',
      'intelligenceId',
      'workspaceId',
      'task',
      'status',
      'evidence',
      'primitives',
      'explanation',
      'interpreter',
      'generatedAt'
    ],
    'workspaceTrademarkIssueIntelligence'
  );
  if (intelligence.schemaVersion !== 1 || intelligence.task !== 'TRADEMARK_ISSUE_EXTRACTION') {
    throw new BrainWorkspaceIntelligenceContractError(
      'Workspace trademark issue intelligence contract identity is invalid.'
    );
  }
  const workspaceId = text(intelligence.workspaceId, 'workspaceId', 64).toLowerCase();
  if (!CORE_WORKSPACE_UUID.test(workspaceId)) {
    throw new BrainWorkspaceIntelligenceContractError(
      'workspaceId must be a canonical Core Workspace UUID.'
    );
  }
  if (!Array.isArray(intelligence.evidence) || intelligence.evidence.length === 0) {
    throw new BrainWorkspaceIntelligenceContractError('evidence must not be empty.');
  }
  if (!Array.isArray(intelligence.primitives)) {
    throw new BrainWorkspaceIntelligenceContractError('primitives must be an array.');
  }
  const evidence = intelligence.evidence.map(parseEvidence);
  const evidenceIds = new Set(evidence.map((item) => item.evidenceId));
  if (evidenceIds.size !== evidence.length) {
    throw new BrainWorkspaceIntelligenceContractError('evidence ids must be unique.');
  }
  const primitives = intelligence.primitives.map(parsePrimitive);
  const primitiveIds = new Set(primitives.map((item) => item.primitiveId));
  if (primitiveIds.size !== primitives.length) {
    throw new BrainWorkspaceIntelligenceContractError('primitive ids must be unique.');
  }
  for (const primitive of primitives) {
    if (primitive.evidenceRefs.some((reference) => !evidenceIds.has(reference))) {
      throw new BrainWorkspaceIntelligenceContractError(
        'primitive evidence refs must resolve to governed evidence.'
      );
    }
  }
  const status = enumValue(intelligence.status, brainIntelligenceStatuses, 'status');
  if (status === 'INTERPRETED' && primitives.length === 0) {
    throw new BrainWorkspaceIntelligenceContractError(
      'INTERPRETED intelligence requires at least one primitive.'
    );
  }
  if (status === 'INSUFFICIENT_EVIDENCE' && primitives.length !== 0) {
    throw new BrainWorkspaceIntelligenceContractError(
      'INSUFFICIENT_EVIDENCE intelligence must not contain primitives.'
    );
  }
  const interpreter = record(intelligence.interpreter, 'interpreter');
  exactKeys(interpreter, ['profileId', 'version', 'policyProfileId'], 'interpreter');
  return {
    schemaVersion: 1,
    intelligenceId: prefixed<BrainIntelligenceId>(
      intelligence.intelligenceId,
      'brain-intelligence_',
      'intelligenceId'
    ),
    workspaceId,
    task: 'TRADEMARK_ISSUE_EXTRACTION',
    status,
    evidence,
    primitives,
    explanation: text(intelligence.explanation, 'explanation', 4000),
    interpreter: {
      profileId: text(interpreter.profileId, 'interpreter.profileId', 300),
      version: text(interpreter.version, 'interpreter.version', 100),
      policyProfileId: text(interpreter.policyProfileId, 'interpreter.policyProfileId', 300)
    },
    generatedAt: instant(intelligence.generatedAt, 'generatedAt')
  };
}
