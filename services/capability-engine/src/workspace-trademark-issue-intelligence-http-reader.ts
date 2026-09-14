import {
  parseWorkspaceTrademarkIssueIntelligenceV1,
  type BrainIntelligenceId,
  type WorkspaceTrademarkIssueIntelligenceV1
} from '@markorbit/contracts/brain-workspace-intelligence';

const CORE_WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INTELLIGENCE_ID = /^brain-intelligence_[0-9a-f]{64}$/u;

export interface WorkspaceTrademarkIssueIntelligenceReadQueryV1 {
  workspaceId: string;
  intelligenceId: BrainIntelligenceId;
}

export interface WorkspaceTrademarkIssueIntelligenceReaderV1 {
  read(
    query: Readonly<WorkspaceTrademarkIssueIntelligenceReadQueryV1>
  ): Promise<Readonly<WorkspaceTrademarkIssueIntelligenceV1> | undefined>;
}

export type WorkspaceTrademarkIssueIntelligenceReaderErrorCode =
  'INVALID_QUERY' | 'IDENTITY_MISMATCH' | 'DEPENDENCY_UNAVAILABLE';
export class WorkspaceTrademarkIssueIntelligenceReaderError extends Error {
  constructor(
    readonly code: WorkspaceTrademarkIssueIntelligenceReaderErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceTrademarkIssueIntelligenceReaderError';
  }
}

function validQuery(query: Readonly<WorkspaceTrademarkIssueIntelligenceReadQueryV1>): boolean {
  const value = query as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  return (
    keys.length === 2 &&
    keys[0] === 'intelligenceId' &&
    keys[1] === 'workspaceId' &&
    typeof input.workspaceId === 'string' &&
    input.workspaceId.trim() === input.workspaceId &&
    CORE_WORKSPACE_UUID.test(input.workspaceId) &&
    typeof input.intelligenceId === 'string' &&
    INTELLIGENCE_ID.test(input.intelligenceId)
  );
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
export class HttpCoreWorkspaceTrademarkIssueIntelligenceReaderV1 implements WorkspaceTrademarkIssueIntelligenceReaderV1 {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (Buffer.byteLength(internalServiceSecret) < 32)
      throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }

  async read(
    query: Readonly<WorkspaceTrademarkIssueIntelligenceReadQueryV1>
  ): Promise<Readonly<WorkspaceTrademarkIssueIntelligenceV1> | undefined> {
    if (!validQuery(query))
      throw new WorkspaceTrademarkIssueIntelligenceReaderError(
        'INVALID_QUERY',
        'Only canonical Workspace and Brain intelligence identities are supported.'
      );
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.coreUrl.replace(/\/$/, '')}/internal/v1/brain-intelligence/workspace-trademark-issues/read`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify(query)
        }
      );
    } catch (cause) {
      throw new WorkspaceTrademarkIssueIntelligenceReaderError(
        'DEPENDENCY_UNAVAILABLE',
        'Core Workspace Brain intelligence authority is unavailable.',
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const payload = (await response.json().catch(() => undefined)) as unknown;
    if (response.ok) {
      let intelligence: WorkspaceTrademarkIssueIntelligenceV1;
      try {
        intelligence = parseWorkspaceTrademarkIssueIntelligenceV1(payload);
      } catch (cause) {
        throw new WorkspaceTrademarkIssueIntelligenceReaderError(
          'IDENTITY_MISMATCH',
          'Core returned malformed Workspace Brain intelligence.',
          false,
          { cause: cause instanceof Error ? cause : undefined }
        );
      }
      if (
        intelligence.workspaceId !== query.workspaceId.toLowerCase() ||
        intelligence.intelligenceId !== query.intelligenceId
      )
        throw new WorkspaceTrademarkIssueIntelligenceReaderError(
          'IDENTITY_MISMATCH',
          'Core returned Brain intelligence outside the exact requested Workspace identity.'
        );
      return structuredClone(intelligence);
    }

    const error = record(payload);
    const code = typeof error?.code === 'string' ? error.code : undefined;
    if (response.status === 404 && code === 'BRAIN_INTELLIGENCE_NOT_FOUND') return undefined;
    if (
      response.status === 400 ||
      (response.status === 409 &&
        (code === 'PERSISTENCE_INTEGRITY_FAILURE' || code === 'IDENTITY_CONFLICT'))
    )
      throw new WorkspaceTrademarkIssueIntelligenceReaderError(
        response.status === 400 ? 'INVALID_QUERY' : 'IDENTITY_MISMATCH',
        'Core rejected the bounded Workspace Brain intelligence read.'
      );
    throw new WorkspaceTrademarkIssueIntelligenceReaderError(
      'DEPENDENCY_UNAVAILABLE',
      'Core Workspace Brain intelligence authority rejected the request unexpectedly.',
      response.status >= 500
    );
  }
}
