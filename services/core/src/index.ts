import { AuthenticationError, type WorkspaceRepository } from '@markorbit/contracts';
import { parseReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import {
  createServiceRuntime,
  HttpError,
  json,
  type JsonRequest,
  type JsonRoute
} from '@markorbit/service-kit';
import type { AuthenticationService } from './auth.js';
import { uuidV7 } from './auth.js';
import {
  fingerprintReadyPackageContentExport,
  validateReadyPackageContentExport,
  type KnowledgeReadyPackageContentRepository
} from './knowledge-content.js';
import {
  fingerprintCoreIntakeRequest,
  parseCoreIntakeRequest,
  type KnowledgeIntakeRepository
} from './knowledge-intake.js';

export const serviceManifest = Object.freeze({
  name: 'core',
  port: Number(process.env.PORT ?? '4101'),
  version: '0.1.0'
});

export interface CoreRuntimeOptions {
  port?: number;
  authentication?: AuthenticationService;
  workspaces?: Pick<WorkspaceRepository, 'findById'>;
  knowledgeIntakes?: KnowledgeIntakeRepository;
  knowledgeContents?: KnowledgeReadyPackageContentRepository;
  internalServiceSecret?: string;
}
function body(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}
function authError(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status = [
    'MEMBERSHIP_REQUIRED',
    'MEMBERSHIP_SUSPENDED',
    'WORKSPACE_ARCHIVED',
    'PERMISSION_DENIED'
  ].includes(error.code)
    ? 403
    : error.code === 'INVALID_WORKSPACE_CONTEXT'
      ? 400
      : 401;
  throw new HttpError(status, error.code, error.message);
}
const canonicalUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);

export function createRuntime(options: CoreRuntimeOptions = {}) {
  const authentication = options.authentication;
  const secret = options.internalServiceSecret;
  const internal =
    (handle: (request: JsonRequest) => Promise<ReturnType<typeof json>>): JsonRoute['handle'] =>
    async (request) => {
      const supplied = request.headers['x-markorbit-internal-authorization'];
      const { validateInternalServiceSecret } = await import('./auth.js');
      if (!validateInternalServiceSecret(secret, supplied))
        throw new HttpError(
          401,
          'INTERNAL_SERVICE_UNAUTHORIZED',
          'Internal service identity is invalid.'
        );
      if (!authentication)
        throw new HttpError(
          503,
          'AUTHENTICATION_SERVICE_UNAVAILABLE',
          'Authentication service is unavailable.',
          true
        );
      try {
        return await handle(request);
      } catch (error) {
        authError(error);
      }
    };
  const routes: JsonRoute[] = authentication
    ? [
        {
          method: 'POST',
          path: '/internal/auth/sessions',
          handle: internal(async (request) => {
            const value = body(request),
              userId = value.userId;
            if (typeof userId !== 'string')
              throw new HttpError(400, 'INVALID_REQUEST', 'userId is required.');
            const issued = await authentication.issueSession(
              userId,
              typeof value.ttlSeconds === 'number' ? value.ttlSeconds : undefined
            );
            return json(201, issued);
          })
        },
        {
          method: 'POST',
          path: '/internal/auth/sessions/resolve',
          handle: internal(async (request) => {
            const token = body(request).token;
            if (typeof token !== 'string' || !token)
              throw new HttpError(400, 'INVALID_REQUEST', 'token is required.');
            return json(200, await authentication.resolveSession(token));
          })
        },
        {
          method: 'POST',
          path: '/internal/auth/workspace-principals/resolve',
          handle: internal(async (request) => {
            const value = body(request);
            if (typeof value.token !== 'string' || typeof value.workspaceId !== 'string')
              throw new HttpError(400, 'INVALID_REQUEST', 'token and workspaceId are required.');
            return json(
              200,
              await authentication.resolveWorkspacePrincipal(value.token, value.workspaceId)
            );
          })
        },
        {
          method: 'POST',
          path: '/internal/auth/sessions/:sessionId/revoke',
          handle: internal(async (request) => {
            const revoked = await authentication.revokeCurrentSession(request.params.sessionId!);
            return json(200, {
              sessionId: revoked.sessionId,
              userId: revoked.userId,
              status: revoked.status,
              createdAt: revoked.createdAt,
              expiresAt: revoked.expiresAt,
              revokedAt: revoked.revokedAt,
              version: revoked.version
            });
          })
        },
        ...(options.workspaces
          ? [
              {
                method: 'GET' as const,
                path: '/internal/identity/workspaces/:workspaceId',
                handle: internal(async (request) => {
                  const workspace = await options.workspaces!.findById(request.params.workspaceId!);
                  if (!workspace)
                    throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'Workspace was not found.');
                  return json(200, {
                    workspace: {
                      workspaceId: workspace.workspaceId,
                      status: workspace.status
                    }
                  });
                })
              }
            ]
          : []),
        {
          method: 'POST' as const,
          path: '/internal/knowledge/ready-packages/intakes',
          handle: internal(async (request) => {
            const idempotencyKey = request.headers['idempotency-key'];
            if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim())
              throw new HttpError(
                400,
                'IDEMPOTENCY_KEY_REQUIRED',
                'Idempotency-Key header is required.'
              );
            const intakeRequest = parseCoreIntakeRequest(request.body);
            if (!intakeRequest)
              throw new HttpError(400, 'INVALID_REQUEST', 'Request body is invalid.');
            if (!options.workspaces || !options.knowledgeIntakes)
              throw new HttpError(
                503,
                'KNOWLEDGE_INTAKE_SERVICE_UNAVAILABLE',
                'Knowledge intake service is unavailable.',
                true
              );
            if (!(await options.workspaces.findById(intakeRequest.workspaceId)))
              throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'Workspace was not found.');
            const requestSha256 = fingerprintCoreIntakeRequest(intakeRequest);
            const stored = await options.knowledgeIntakes.createOrFind({
              intakeId: uuidV7(),
              idempotencyKey,
              request: intakeRequest,
              requestSha256,
              status: 'RECEIVED',
              receivedAt: new Date().toISOString()
            });
            if (stored.intake.requestSha256 !== requestSha256)
              throw new HttpError(
                409,
                'KNOWLEDGE_INTAKE_IDEMPOTENCY_CONFLICT',
                'Idempotency-Key was already used for a different request.'
              );
            return json(stored.created ? 201 : 200, {
              intakeId: stored.intake.intakeId,
              status: stored.intake.status,
              readyPackageId: stored.intake.request.readyPackageId
            });
          })
        },
        {
          method: 'POST' as const,
          path: '/internal/knowledge/ready-packages/intakes/:intakeId/content',
          bodyLimitBytes: 12 * 1024 * 1024,
          handle: internal(async (request) => {
            const intakeId = request.params.intakeId;
            if (typeof intakeId !== 'string' || !canonicalUuid(intakeId))
              throw new HttpError(400, 'INVALID_REQUEST', 'intakeId must be a UUID.');
            const contentExport = parseReadyPackageContentExportV1(request.body);
            if (!contentExport)
              throw new HttpError(400, 'INVALID_REQUEST', 'Request body is invalid.');
            if (!options.knowledgeIntakes || !options.knowledgeContents)
              throw new HttpError(
                503,
                'KNOWLEDGE_CONTENT_SERVICE_UNAVAILABLE',
                'Knowledge content service is unavailable.',
                true
              );
            const intake = await options.knowledgeIntakes.findById(intakeId);
            if (!intake)
              throw new HttpError(
                404,
                'KNOWLEDGE_INTAKE_NOT_FOUND',
                'Knowledge intake was not found.'
              );
            const issue = validateReadyPackageContentExport(intake, contentExport);
            if (issue) throw new HttpError(409, issue.code, issue.message);
            const exportSha256 = fingerprintReadyPackageContentExport(contentExport);
            const stored = await options.knowledgeContents.createOrFind({
              intakeId,
              workspaceId: intake.request.workspaceId,
              readyPackageId: intake.request.readyPackageId,
              export: contentExport,
              exportSha256,
              consumedAt: new Date().toISOString()
            });
            if (stored.content.exportSha256 !== exportSha256)
              throw new HttpError(
                409,
                'KNOWLEDGE_CONTENT_IMMUTABILITY_CONFLICT',
                'This intake already has a different immutable ReadyPackage content export.'
              );
            const accepted = await options.knowledgeIntakes.markAccepted(intakeId);
            if (!accepted || accepted.status !== 'ACCEPTED')
              throw new HttpError(
                409,
                'KNOWLEDGE_INTAKE_NOT_ACCEPTABLE',
                'Knowledge intake cannot transition to ACCEPTED.'
              );
            return json(stored.created ? 201 : 200, {
              intakeId,
              readyPackageId: stored.content.readyPackageId,
              status: accepted.status,
              exportSha256: stored.content.exportSha256
            });
          })
        }
      ]
    : [];
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    { routes }
  );
}
export * from './identity.js';
export * from './auth.js';
export * from './knowledge-intake.js';
export * from './knowledge-content.js';
