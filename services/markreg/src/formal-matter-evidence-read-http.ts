import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { DocumentPackageError } from './document-package.js';
import {
  FormalMatterEvidenceReadError,
  type FormalMatterEvidenceReadQuery,
  type FormalMatterEvidenceReadService
} from './formal-matter-evidence-read.js';
import { LifecycleProjectionError } from './lifecycle-projection.js';
import { MatterIntelligenceReadError } from './matter-intelligence-read.js';

export interface FormalMatterEvidenceReadHttpOptions {
  internalServiceSecret: string;
  service: Pick<FormalMatterEvidenceReadService, 'getForMatter'>;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalFor(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  return principal;
}

function integer(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an integer.`);
  return parsed;
}

function queryOf(request: JsonRequest): FormalMatterEvidenceReadQuery {
  return {
    ...(request.query.page === undefined ? {} : { page: integer(request.query.page, 'page') }),
    ...(request.query.pageSize === undefined
      ? {}
      : { pageSize: integer(request.query.pageSize, 'pageSize') }),
    ...(request.query.reviewHistoryLimit === undefined
      ? {}
      : {
          reviewHistoryLimit: integer(request.query.reviewHistoryLimit, 'reviewHistoryLimit')
        })
  };
}

function translate(error: unknown): never {
  if (error instanceof FormalMatterEvidenceReadError)
    throw new HttpError(error.status, error.code, error.message, error.retryable, error.details);
  if (error instanceof DocumentPackageError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  if (error instanceof LifecycleProjectionError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  if (error instanceof MatterIntelligenceReadError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createFormalMatterEvidenceReadRoutes(
  options: FormalMatterEvidenceReadHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/v1/formal-matters/:formalMatterId/evidence',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(
            200,
            await options.service.getForMatter(
              principal,
              request.params.formalMatterId! as FormalMatterId,
              queryOf(request)
            )
          );
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
