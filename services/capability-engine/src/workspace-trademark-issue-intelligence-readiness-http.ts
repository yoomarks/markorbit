import { timingSafeEqual } from 'node:crypto';
import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';

import type { WorkspaceTrademarkIssueIntelligenceReadQueryV1 } from './workspace-trademark-issue-intelligence-http-reader.js';
import type {
  WorkspaceTrademarkIssueIntelligenceReadinessServiceV1,
  WorkspaceTrademarkIssueIntelligenceReadinessV1
} from './workspace-trademark-issue-intelligence-readiness.js';

export interface WorkspaceTrademarkIssueIntelligenceReadinessHttpOptionsV1 {
  internalServiceSecret: string;
  readiness: Pick<WorkspaceTrademarkIssueIntelligenceReadinessServiceV1, 'evaluate'>;
}

function authorized(expected: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(expected) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function httpStatus(result: Readonly<WorkspaceTrademarkIssueIntelligenceReadinessV1>): number {
  if (result.status === 'READY_FOR_CAPABILITY_BINDING') return 200;
  if (result.status === 'NOT_FOUND') return 404;
  if (result.status === 'BLOCKED_BY_INVALID_REFERENCE') return 400;
  if (result.status === 'DEPENDENCY_UNAVAILABLE') return 503;
  return 409;
}

function query(value: unknown): WorkspaceTrademarkIssueIntelligenceReadQueryV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {
      workspaceId: '',
      intelligenceId: '' as WorkspaceTrademarkIssueIntelligenceReadQueryV1['intelligenceId']
    };
  return value as WorkspaceTrademarkIssueIntelligenceReadQueryV1;
}

export function createWorkspaceTrademarkIssueIntelligenceReadinessRoutesV1(
  options: Readonly<WorkspaceTrademarkIssueIntelligenceReadinessHttpOptionsV1>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/brain-intelligence/workspace-trademark-issues/readiness',
      async handle(request) {
        if (
          !authorized(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'INTERNAL_SERVICE_UNAUTHORIZED',
            'Internal service identity is invalid.'
          );
        const result = await options.readiness.evaluate(query(request.body));
        return json(httpStatus(result), result);
      }
    }
  ];
}
