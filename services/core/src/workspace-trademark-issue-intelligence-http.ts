import type { BrainIntelligenceId } from '@markorbit/contracts/brain-workspace-intelligence';
import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';

import { validateInternalServiceSecret } from './auth.js';
import {
  WorkspaceTrademarkIssueIntelligenceStoreError,
  type WorkspaceTrademarkIssueIntelligenceRepository
} from './workspace-trademark-issue-intelligence-store.js';

const CORE_WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INTELLIGENCE_ID = /^brain-intelligence_[0-9a-f]{64}$/u;

export interface WorkspaceTrademarkIssueIntelligenceHttpOptionsV1 {
  internalServiceSecret: string;
  intelligence: Pick<WorkspaceTrademarkIssueIntelligenceRepository, 'find'>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function parseQuery(value: unknown): { workspaceId: string; intelligenceId: BrainIntelligenceId } {
  const input = record(value);
  if (!input) throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const keys = Object.keys(input).sort();
  if (keys.length !== 2 || keys[0] !== 'intelligenceId' || keys[1] !== 'workspaceId')
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Request body must contain only workspaceId and intelligenceId.'
    );
  if (
    typeof input.workspaceId !== 'string' ||
    !CORE_WORKSPACE_UUID.test(input.workspaceId) ||
    typeof input.intelligenceId !== 'string' ||
    !INTELLIGENCE_ID.test(input.intelligenceId)
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'workspaceId and intelligenceId must be canonical governed identities.'
    );
  return {
    workspaceId: input.workspaceId.toLowerCase(),
    intelligenceId: input.intelligenceId as BrainIntelligenceId
  };
}
function translate(error: unknown): never {
  if (!(error instanceof WorkspaceTrademarkIssueIntelligenceStoreError)) throw error;
  if (error.code === 'INVALID_INPUT') throw new HttpError(400, error.code, error.message, false);
  if (error.code === 'PERSISTENCE_INTEGRITY_FAILURE' || error.code === 'IDENTITY_CONFLICT')
    throw new HttpError(409, error.code, error.message, false);
  throw new HttpError(503, error.code, error.message, true);
}

export function createWorkspaceTrademarkIssueIntelligenceRoutesV1(
  options: Readonly<WorkspaceTrademarkIssueIntelligenceHttpOptionsV1>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/brain-intelligence/workspace-trademark-issues/read',
      async handle(request) {
        if (
          !validateInternalServiceSecret(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'INTERNAL_SERVICE_UNAUTHORIZED',
            'Internal service identity is invalid.'
          );
        const query = parseQuery(request.body);
        try {
          const intelligence = await options.intelligence.find(
            query.workspaceId,
            query.intelligenceId
          );
          if (!intelligence)
            throw new HttpError(
              404,
              'BRAIN_INTELLIGENCE_NOT_FOUND',
              'Workspace Brain intelligence was not found.'
            );
          return json(200, intelligence);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return translate(error);
        }
      }
    }
  ];
}
