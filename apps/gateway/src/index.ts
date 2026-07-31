import { createHash, randomUUID } from 'node:crypto';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion -- milestone-only repository snapshots are normalized immediately at the Gateway boundary. */
import {
  assertDirectIntake,
  parseIntakeCreateCommand,
  parseQuoteCreateCommand,
  parseQuoteConfirmationCommand,
  type QuoteCreateCommand,
  type QuoteConfirmationCommand,
  type IntakeCreateCommand,
  type MilestoneRecordSnapshot,
  type MilestoneScenarioRecordSnapshot,
  noAuthorizationAuthorityConsequences
} from '@markorbit/contracts';
import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  createServiceRuntime,
  HttpError,
  json,
  type JsonRequest,
  type JsonRoute
} from '@markorbit/service-kit';
export * from './auth.js';
import {
  clearSessionCookie,
  csrfToken,
  type CoreAuthenticationClient,
  HttpCoreAuthenticationClient,
  readSessionCookie,
  requireTrustedOrigin,
  sessionCookie,
  validateCsrf
} from './auth.js';
export const serviceManifest = Object.freeze({
  name: 'gateway',
  port: Number(process.env.PORT ?? '4000'),
  version: '0.1.0'
});
export interface GatewayOptions {
  port?: number;
  markRegUrl?: string;
  executionUrl?: string;
  milestoneTestRuntime?: boolean;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  coreUrl?: string;
  csrfSecret?: string;
  allowedOrigins?: readonly string[];
  secureCookies?: boolean;
  fixtureUsers?: Readonly<Record<string, string>>;
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return value as Record<string, unknown>;
}
export function createRuntime(options: GatewayOptions = {}) {
  const markRegUrl = options.markRegUrl ?? process.env.MARKREG_URL ?? 'http://127.0.0.1:4105';
  const executionUrl = options.executionUrl ?? process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104';
  const milestoneTestRuntime =
    options.milestoneTestRuntime ?? process.env.MO_MILESTONE_TEST_RUNTIME === '1';
  const allowedOrigins =
    options.allowedOrigins ?? (process.env.WEB_ORIGINS ?? '').split(',').filter(Boolean);
  const csrfSecret = options.csrfSecret ?? process.env.MO_CSRF_SECRET ?? '';
  const authenticationClient =
    options.authenticationClient ??
    (options.internalServiceSecret || process.env.MO_INTERNAL_SERVICE_SECRET
      ? new HttpCoreAuthenticationClient(
          options.coreUrl ?? process.env.CORE_URL ?? 'http://127.0.0.1:4101',
          options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET!
        )
      : undefined);
  const correlation = (request: JsonRequest) => request.headers['x-correlation-id'];
  const token = (request: JsonRequest) => {
    const value = readSessionCookie(request.headers.cookie);
    if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    return value;
  };
  const mapAuthentication = (error: unknown): never => {
    if (!(error instanceof AuthenticationError)) throw error;
    const status =
      error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
        ? 503
        : error.code === 'INVALID_WORKSPACE_CONTEXT'
          ? 400
          : [
                'MEMBERSHIP_REQUIRED',
                'MEMBERSHIP_SUSPENDED',
                'WORKSPACE_ARCHIVED',
                'PERMISSION_DENIED',
                'INVALID_CSRF_TOKEN',
                'UNTRUSTED_ORIGIN'
              ].includes(error.code)
            ? 403
            : 401;
    throw new HttpError(status, error.code, error.message, status === 503);
  };
  const forward = async (request: JsonRequest, path: string, principal?: WorkspacePrincipal) => {
    try {
      const response = await fetch(`${markRegUrl}${path}`, {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          ...(principal
            ? {
                'x-markorbit-internal-authorization':
                  options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET!,
                'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
                'x-markorbit-workspace-id': principal.workspaceId,
                ...(correlation(request) ? { 'x-correlation-id': correlation(request)! } : {})
              }
            : {}),
          ...(request.headers['idempotency-key']
            ? { 'idempotency-key': request.headers['idempotency-key'] }
            : {})
        },
        ...(request.method === 'GET' ? {} : { body: JSON.stringify(request.body ?? {}) })
      });
      return json(response.status, await response.json());
    } catch {
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg service is unavailable.', true);
    }
  };
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        {
          method: 'GET',
          path: '/api/auth/session',
          handle: async (request) => {
            if (!authenticationClient)
              throw new HttpError(
                503,
                'AUTHENTICATION_SERVICE_UNAVAILABLE',
                'Authentication service is unavailable.',
                true
              );
            try {
              const principal = await authenticationClient.resolve(
                token(request),
                correlation(request)
              );
              return json(200, {
                authenticated: true,
                userId: principal.userId,
                sessionId: principal.sessionId,
                sessionExpiresAt: principal.sessionExpiresAt,
                csrfToken: csrfToken(principal.sessionId, csrfSecret)
              });
            } catch (error) {
              return mapAuthentication(error);
            }
          }
        },
        {
          method: 'POST',
          path: '/api/auth/logout',
          handle: async (request) => {
            if (!authenticationClient)
              throw new HttpError(
                503,
                'AUTHENTICATION_SERVICE_UNAVAILABLE',
                'Authentication service is unavailable.',
                true
              );
            try {
              const principal = await authenticationClient.resolve(
                token(request),
                correlation(request)
              );
              requireTrustedOrigin(request.headers.origin, allowedOrigins);
              validateCsrf(
                principal.sessionId,
                csrfSecret,
                request.headers['x-markorbit-csrf-token']
              );
              await authenticationClient.revoke(principal.sessionId, correlation(request));
              return json(
                200,
                { authenticated: false },
                {
                  'set-cookie': clearSessionCookie(
                    options.secureCookies ?? process.env.NODE_ENV === 'production'
                  )
                }
              );
            } catch (error) {
              return mapAuthentication(error);
            }
          }
        },
        {
          method: 'GET',
          path: '/api/workspaces/:workspaceId/context',
          handle: async (request) => {
            if (!authenticationClient)
              throw new HttpError(
                503,
                'AUTHENTICATION_SERVICE_UNAVAILABLE',
                'Authentication service is unavailable.',
                true
              );
            const workspaceId = request.params.workspaceId!;
            const header = request.headers['x-markorbit-workspace-id'];
            if (header && header !== workspaceId)
              throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace contexts conflict.');
            try {
              const principal = await authenticationClient.resolveWorkspace(
                token(request),
                workspaceId,
                correlation(request)
              );
              return json(200, {
                workspaceId: principal.workspaceId,
                membershipId: principal.membershipId,
                role: principal.role,
                permissions: principal.permissions
              });
            } catch (error) {
              return mapAuthentication(error);
            }
          }
        },
        ...(milestoneTestRuntime
          ? [
              {
                method: 'POST' as const,
                path: '/__test/auth/session',
                handle: async (request: JsonRequest) => {
                  if (!authenticationClient)
                    throw new HttpError(
                      503,
                      'AUTHENTICATION_SERVICE_UNAVAILABLE',
                      'Authentication service is unavailable.',
                      true
                    );
                  const fixture = record(request.body).fixture;
                  const userId =
                    typeof fixture === 'string' ? options.fixtureUsers?.[fixture] : undefined;
                  if (!userId)
                    throw new HttpError(
                      403,
                      'TEST_FIXTURE_NOT_ALLOWED',
                      'Fixture identity is not allowed.'
                    );
                  try {
                    const issued = await authenticationClient.issue(userId, correlation(request));
                    const maxAge = Math.max(
                      0,
                      Math.floor((Date.parse(issued.session.expiresAt) - Date.now()) / 1000)
                    );
                    return json(
                      201,
                      {
                        authenticated: true,
                        userId: issued.session.userId,
                        sessionId: issued.session.sessionId,
                        sessionExpiresAt: issued.session.expiresAt,
                        csrfToken: csrfToken(issued.session.sessionId, csrfSecret)
                      },
                      {
                        'set-cookie': sessionCookie(
                          issued.rawToken,
                          maxAge,
                          options.secureCookies ?? false
                        )
                      }
                    );
                  } catch (error) {
                    return mapAuthentication(error);
                  }
                }
              }
            ]
          : []),
        ...(milestoneTestRuntime
          ? [
              {
                method: 'GET',
                path: '/__milestone/scenarios/:scenario/records',
                handle: async (request: JsonRequest) => {
                  const scenario = request.params.scenario!;
                  const [markregResponse, executionResponse] = await Promise.all([
                    fetch(`${markRegUrl}/__milestone/scenario-records`),
                    fetch(`${executionUrl}/__milestone/scenario-records`)
                  ]);
                  if (!markregResponse.ok || !executionResponse.ok)
                    throw new HttpError(
                      502,
                      'MILESTONE_SNAPSHOT_UNAVAILABLE',
                      'Milestone authoritative repositories are unavailable.',
                      true
                    );
                  const markreg = (await markregResponse.json()) as any;
                  const execution = (await executionResponse.json()) as any;
                  const matterDrafts = (markreg.matterDrafts as any[]).filter((value) =>
                    String(value.preparation?.applicantName ?? '').startsWith(scenario)
                  );
                  const matterIds = new Set(matterDrafts.map((value) => value.matterDraftId));
                  const reviews = (execution.professionalReviewCases as any[]).filter((value) =>
                    matterIds.has(value.source?.matterDraftId)
                  );
                  const reviewIds = new Set(reviews.map((value) => value.reviewCaseId));
                  const locks = (markreg.preparationLocks as any[]).filter((value) =>
                    reviewIds.has(value.snapshot?.documentPackage?.professionalReviewCaseId)
                  );
                  const lockIds = new Set(locks.map((value) => value.preparationLockId));
                  const authorizations = (execution.filingAuthorizations as any[]).filter((value) =>
                    lockIds.has(value.preparationLockId)
                  );
                  const authorizationIds = new Set(
                    authorizations.map((value) => value.filingAuthorizationId)
                  );
                  const releases = (execution.executionReleases as any[]).filter((value) =>
                    authorizationIds.has(value.filingAuthorizationId)
                  );
                  const releaseIds = new Set(releases.map((value) => value.executionReleaseId));
                  const tasks = (execution.filingExecutionTaskDrafts as any[]).filter((value) =>
                    releaseIds.has(value.executionReleaseId)
                  );
                  const collection = (
                    values: any[],
                    active: (status: string) => boolean,
                    project: (value: any) => Omit<MilestoneRecordSnapshot, 'contentHash'>
                  ) => {
                    const records = values
                      .map((value) => ({
                        ...project(value),
                        contentHash: createHash('sha256')
                          .update(JSON.stringify(value))
                          .digest('hex')
                      }))
                      .sort((a, b) => a.id.localeCompare(b.id));
                    return {
                      totalCount: records.length,
                      activeCount: records.filter((value) => active(value.status)).length,
                      activeIds: records
                        .filter((value) => active(value.status))
                        .map((value) => value.id)
                        .sort(),
                      records
                    };
                  };
                  const snapshot: MilestoneScenarioRecordSnapshot = {
                    scenario,
                    matterDrafts: collection(
                      matterDrafts,
                      (status) => status !== 'WITHDRAWN',
                      (value) => ({
                        id: value.matterDraftId,
                        version: value.updatedAt,
                        status: value.status,
                        sourceId: value.confirmationId
                      })
                    ),
                    professionalReviewCases: collection(
                      reviews,
                      (status) => !['STALE', 'WITHDRAWN'].includes(status),
                      (value) => ({
                        id: value.reviewCaseId,
                        version: value.decision?.decidedAt ?? value.updatedAt,
                        status: value.status,
                        sourceId: value.source.matterDraftId,
                        sourceVersion: value.source.matterDraftVersion
                      })
                    ),
                    preparationLocks: collection(
                      locks,
                      () => true,
                      (value) => ({
                        id: value.preparationLockId,
                        version: `${value.documentPackageVersion}:${value.instructionLedgerVersion}`,
                        status: 'READY',
                        sourceId: value.snapshot.documentPackage.professionalReviewCaseId,
                        sourceVersion: value.snapshot.sourceReviewDecisionVersion
                      })
                    ),
                    filingAuthorizations: collection(
                      authorizations,
                      (status) => !['WITHDRAWN', 'STALE', 'EXPIRED'].includes(status),
                      (value) => ({
                        id: value.filingAuthorizationId,
                        version: value.version,
                        status: value.status,
                        sourceId: value.preparationLockId,
                        sourceVersion: value.preparationLockVersion
                      })
                    ),
                    executionReleases: collection(
                      releases,
                      (status) => !['WITHDRAWN', 'STALE'].includes(status),
                      (value) => ({
                        id: value.executionReleaseId,
                        version: value.version,
                        status: value.status,
                        sourceId: value.filingAuthorizationId,
                        sourceVersion: value.filingAuthorizationVersion
                      })
                    ),
                    filingExecutionTaskDrafts: collection(
                      tasks,
                      (status) => status === 'PREPARED',
                      (value) => ({
                        id: value.filingExecutionTaskDraftId,
                        version: value.schemaVersion,
                        status: value.status,
                        sourceId: value.executionReleaseId
                      })
                    ),
                    authorityConsequences: noAuthorizationAuthorityConsequences
                  };
                  return json(200, snapshot);
                }
              } as JsonRoute
            ]
          : []),
        ...(
          [
            ['GET', '/api/markreg/intakes/:intakeId', '/v1/intakes/:intakeId'],
            [
              'GET',
              '/api/markreg/recommendations/:recommendationId',
              '/v1/recommendations/:recommendationId'
            ],
            ['GET', '/api/markreg/quotes/:quoteId', '/v1/quotes/:quoteId']
          ] as const
        ).map(([method, path, downstreamPath]): JsonRoute => ({
          method,
          path,
          handle: (request) => {
            const parameter = Object.values(request.params)[0]!;
            return forward(
              request,
              downstreamPath.replace(/:[^/]+/, encodeURIComponent(parameter))
            );
          }
        })),
        ...(
          [
            ['markreg', markRegUrl],
            ['execution', executionUrl]
          ] as const
        ).map(([name, url]): JsonRoute => ({
          method: 'GET',
          path: `/health/${name}`,
          handle: async () => {
            try {
              const response = await fetch(`${url}/health`);
              return json(response.status, await response.json());
            } catch {
              throw new HttpError(502, 'DOWNSTREAM_UNAVAILABLE', `${name} is unavailable.`, true);
            }
          }
        })),
        ...(
          [
            ['POST', '/api/execution/filing-authorizations'],
            ['GET', '/api/execution/filing-authorizations/:filingAuthorizationId'],
            ['POST', '/api/execution/filing-authorizations/:filingAuthorizationId/confirm'],
            ['POST', '/api/execution/filing-authorizations/:filingAuthorizationId/withdraw'],
            ['POST', '/api/execution/execution-releases'],
            ['GET', '/api/execution/execution-releases'],
            ['GET', '/api/execution/execution-releases/:executionReleaseId'],
            ['POST', '/api/execution/execution-releases/:executionReleaseId/evaluate'],
            ['PATCH', '/api/execution/execution-releases/:executionReleaseId/assignment'],
            ['POST', '/api/execution/execution-releases/:executionReleaseId/release'],
            ['POST', '/api/execution/execution-releases/:executionReleaseId/withdraw'],
            ['GET', '/api/execution/filing-task-drafts/:filingExecutionTaskDraftId'],
            [
              'POST',
              '/api/execution/filing-task-drafts/:filingExecutionTaskDraftId/validate-current'
            ],
            ['GET', '/api/execution/execution-releases/:executionReleaseId/filing-task-draft']
          ] as const
        ).map(([method, path]): JsonRoute => ({
          method,
          path,
          handle: async (request) => {
            try {
              const response = await fetch(
                `${executionUrl}${request.path.replace('/api/execution', '/v1')}`,
                {
                  method: request.method,
                  headers: {
                    'content-type': 'application/json',
                    ...(request.headers['idempotency-key']
                      ? { 'idempotency-key': request.headers['idempotency-key'] }
                      : {})
                  },
                  ...(request.method === 'GET' ? {} : { body: JSON.stringify(request.body ?? {}) })
                }
              );
              return json(response.status, await response.json());
            } catch {
              throw new HttpError(
                502,
                'DOWNSTREAM_UNAVAILABLE',
                'Execution filing governance service is unavailable.',
                true
              );
            }
          }
        })),
        ...(
          [
            ['GET', '/api/markreg/document-packages'],
            ['POST', '/api/markreg/document-packages'],
            ['GET', '/api/markreg/document-packages/:documentPackageId'],
            ['POST', '/api/markreg/document-packages/:documentPackageId/documents'],
            [
              'POST',
              '/api/markreg/document-packages/:documentPackageId/documents/:documentItemId/supersede'
            ],
            [
              'PATCH',
              '/api/markreg/document-packages/:documentPackageId/documents/:documentItemId'
            ],
            ['POST', '/api/markreg/document-packages/:documentPackageId/evaluate'],
            ['POST', '/api/markreg/document-packages/:documentPackageId/withdraw'],
            ['POST', '/api/markreg/instruction-ledgers'],
            ['GET', '/api/markreg/instruction-ledgers/:instructionLedgerId'],
            ['POST', '/api/markreg/instruction-ledgers/:instructionLedgerId/entries'],
            [
              'POST',
              '/api/markreg/instruction-ledgers/:instructionLedgerId/entries/:instructionEntryId/confirm'
            ],
            [
              'POST',
              '/api/markreg/instruction-ledgers/:instructionLedgerId/entries/:instructionEntryId/supersede'
            ],
            ['POST', '/api/markreg/instruction-ledgers/:instructionLedgerId/confirm'],
            ['POST', '/api/markreg/instruction-ledgers/:instructionLedgerId/withdraw'],
            ['POST', '/api/markreg/preparation-locks'],
            ['GET', '/api/markreg/preparation-locks/:preparationLockId'],
            ['POST', '/api/markreg/preparation-locks/:preparationLockId/validate-current']
          ] as const
        ).map(([method, path]): JsonRoute => ({
          method,
          path,
          handle: (r: JsonRequest) => forward(r, r.path.replace('/api/markreg', '/v1'))
        })),
        ...[
          '/api/lite/professional-review-cases',
          '/api/lite/professional-review-cases/:reviewCaseId',
          '/api/lite/professional-review-cases/:reviewCaseId/claim',
          '/api/lite/professional-review-cases/:reviewCaseId/checklist',
          '/api/lite/professional-review-cases/:reviewCaseId/request-information',
          '/api/lite/professional-review-cases/:reviewCaseId/complete',
          '/api/lite/professional-review-cases/:reviewCaseId/withdraw'
        ].flatMap((path) => {
          const methods = path.endsWith('/checklist')
            ? ['PATCH']
            : path.includes(':reviewCaseId/')
              ? ['POST']
              : path.includes(':reviewCaseId')
                ? ['GET']
                : ['GET', 'POST'];
          return methods.map((method) => ({
            method: method as 'GET' | 'POST' | 'PATCH',
            path,
            handle: async (r: JsonRequest) => {
              const suffix = r.path.replace('/api/lite', '/v1');
              try {
                const response = await fetch(`${executionUrl}${suffix}`, {
                  method: r.method,
                  headers: {
                    'content-type': 'application/json',
                    ...(r.headers['idempotency-key']
                      ? { 'idempotency-key': r.headers['idempotency-key'] }
                      : {})
                  },
                  ...(r.method === 'GET' ? {} : { body: JSON.stringify(r.body ?? {}) })
                });
                return json(response.status, await response.json());
              } catch {
                throw new HttpError(
                  502,
                  'DOWNSTREAM_UNAVAILABLE',
                  'Professional review service is unavailable.',
                  true
                );
              }
            }
          }));
        }),
        {
          method: 'POST',
          path: '/api/markreg/customer-confirmations',
          handle: async (r) => {
            if (!authenticationClient) {
              if (milestoneTestRuntime) return forward(r, '/v1/customer-confirmations');
              throw new HttpError(
                503,
                'AUTHENTICATION_SERVICE_UNAVAILABLE',
                'Authentication service is unavailable.',
                true
              );
            }
            try {
              const b = record(r.body);
              const workspaceId =
                typeof b.workspaceId === 'string'
                  ? b.workspaceId
                  : r.headers['x-markorbit-workspace-id'];
              if (!workspaceId)
                throw new HttpError(
                  400,
                  'INVALID_WORKSPACE_CONTEXT',
                  'Workspace context is required.'
                );
              const p = await authenticationClient.resolveWorkspace(
                token(r),
                workspaceId,
                correlation(r)
              );
              if (!p.permissions.includes('matter:create'))
                throw new AuthenticationError('PERMISSION_DENIED', 'Permission is required.');
              return forward(r, '/v1/customer-confirmations', p);
            } catch (error) {
              return mapAuthentication(error);
            }
          }
        },
        {
          method: 'GET',
          path: '/api/markreg/customer-confirmations/:confirmationId',
          handle: async (r) => {
            if (!authenticationClient) {
              if (milestoneTestRuntime)
                return forward(
                  r,
                  `/v1/customer-confirmations/${encodeURIComponent(r.params.confirmationId!)}`
                );
              throw new HttpError(
                503,
                'AUTHENTICATION_SERVICE_UNAVAILABLE',
                'Authentication service is unavailable.',
                true
              );
            }
            try {
              const workspaceId = r.headers['x-markorbit-workspace-id'];
              if (!workspaceId)
                throw new HttpError(
                  400,
                  'INVALID_WORKSPACE_CONTEXT',
                  'Workspace context is required.'
                );
              const p = await authenticationClient.resolveWorkspace(
                token(r),
                workspaceId,
                correlation(r)
              );
              if (!p.permissions.includes('matter:read'))
                throw new AuthenticationError('PERMISSION_DENIED', 'Permission is required.');
              return forward(
                r,
                `/v1/customer-confirmations/${encodeURIComponent(r.params.confirmationId!)}`,
                p
              );
            } catch (error) {
              return mapAuthentication(error);
            }
          }
        },
        {
          method: 'POST',
          path: '/api/markreg/customer-confirmations/:confirmationId/withdraw',
          handle: async (r) => {
            if (!authenticationClient) {
              if (milestoneTestRuntime)
                return forward(
                  r,
                  `/v1/customer-confirmations/${encodeURIComponent(r.params.confirmationId!)}/withdraw`
                );
              throw new HttpError(
                503,
                'AUTHENTICATION_SERVICE_UNAVAILABLE',
                'Authentication service is unavailable.',
                true
              );
            }
            try {
              const b = record(r.body);
              const workspaceId =
                typeof b.workspaceId === 'string'
                  ? b.workspaceId
                  : r.headers['x-markorbit-workspace-id'];
              if (!workspaceId)
                throw new HttpError(
                  400,
                  'INVALID_WORKSPACE_CONTEXT',
                  'Workspace context is required.'
                );
              if (!Number.isSafeInteger(b.expectedVersion))
                throw new HttpError(400, 'INVALID_REQUEST', 'expectedVersion is required.');
              const user = await authenticationClient.resolve(token(r), correlation(r));
              requireTrustedOrigin(r.headers.origin, allowedOrigins);
              validateCsrf(user.sessionId, csrfSecret, r.headers['x-markorbit-csrf-token']);
              const p = await authenticationClient.resolveWorkspace(
                token(r),
                workspaceId,
                correlation(r)
              );
              if (!p.permissions.includes('matter:manage'))
                throw new AuthenticationError('PERMISSION_DENIED', 'Permission is required.');
              return forward(
                r,
                `/v1/customer-confirmations/${encodeURIComponent(r.params.confirmationId!)}/withdraw`,
                p
              );
            } catch (error) {
              return mapAuthentication(error);
            }
          }
        },
        {
          method: 'POST',
          path: '/api/markreg/matter-drafts',
          handle: (r) => forward(r, '/v1/matter-drafts')
        },
        {
          method: 'GET',
          path: '/api/markreg/matter-drafts/:matterDraftId',
          handle: (r) =>
            forward(r, `/v1/matter-drafts/${encodeURIComponent(r.params.matterDraftId!)}`)
        },
        {
          method: 'PATCH',
          path: '/api/markreg/matter-drafts/:matterDraftId',
          handle: (r) =>
            forward(r, `/v1/matter-drafts/${encodeURIComponent(r.params.matterDraftId!)}`)
        },
        {
          method: 'POST',
          path: '/api/markreg/matter-drafts/:matterDraftId/evaluate-readiness',
          handle: (r) =>
            forward(
              r,
              `/v1/matter-drafts/${encodeURIComponent(r.params.matterDraftId!)}/evaluate-readiness`
            )
        },
        {
          method: 'POST',
          path: '/api/markreg/matter-drafts/:matterDraftId/progress',
          handle: (r) =>
            forward(r, `/v1/matter-drafts/${encodeURIComponent(r.params.matterDraftId!)}/progress`)
        },
        {
          method: 'POST',
          path: '/v1/markreg/quotes',
          async handle(request) {
            const key = request.headers['idempotency-key'];
            if (!key)
              throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
            const correlationId =
              request.headers['x-correlation-id'] || `correlation_${randomUUID()}`;
            let command: QuoteCreateCommand;
            try {
              command = parseQuoteCreateCommand({
                ...record(request.body),
                idempotencyKey: key,
                correlationId
              });
            } catch (error) {
              throw new HttpError(
                422,
                'INVALID_QUOTE_REQUEST',
                error instanceof Error ? error.message : 'Invalid quote request.'
              );
            }
            try {
              const downstream = await fetch(`${markRegUrl}/v1/quotes`, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'idempotency-key': key,
                  'x-correlation-id': correlationId
                },
                body: JSON.stringify(command)
              });
              return json(downstream.status, await downstream.json(), {
                'x-correlation-id': correlationId
              });
            } catch {
              throw new HttpError(
                502,
                'DOWNSTREAM_UNAVAILABLE',
                'Quote service is unavailable.',
                true
              );
            }
          }
        },
        {
          method: 'POST',
          path: '/v1/markreg/quotes/:quoteId/confirm',
          async handle(request) {
            const key = request.headers['idempotency-key'];
            if (!key)
              throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
            const correlationId =
              request.headers['x-correlation-id'] || `correlation_${randomUUID()}`;
            let command: QuoteConfirmationCommand;
            try {
              command = parseQuoteConfirmationCommand({
                ...record(request.body),
                quoteId: request.params.quoteId,
                idempotencyKey: key,
                correlationId
              });
            } catch (error) {
              throw new HttpError(
                422,
                'INVALID_CONFIRMATION_REQUEST',
                error instanceof Error ? error.message : 'Invalid confirmation request.'
              );
            }
            try {
              const downstream = await fetch(
                `${markRegUrl}/v1/quotes/${encodeURIComponent(command.quoteId)}/confirm`,
                {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    'idempotency-key': key,
                    'x-correlation-id': correlationId
                  },
                  body: JSON.stringify(command)
                }
              );
              return json(downstream.status, await downstream.json(), {
                'x-correlation-id': correlationId
              });
            } catch {
              throw new HttpError(
                502,
                'DOWNSTREAM_UNAVAILABLE',
                'Quote confirmation is unavailable.',
                true
              );
            }
          }
        },
        {
          method: 'POST',
          path: '/v1/markreg/intakes',
          async handle(request) {
            const key = request.headers['idempotency-key'];
            if (!key)
              throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
            const raw = record(request.body);
            const headerCorrelation = request.headers['x-correlation-id'];
            const correlationId =
              headerCorrelation && headerCorrelation.length > 0
                ? headerCorrelation
                : `correlation_${randomUUID()}`;
            let command: IntakeCreateCommand;
            try {
              command = parseIntakeCreateCommand({ ...raw, idempotencyKey: key, correlationId });
            } catch (error) {
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                error instanceof Error ? error.message : 'Invalid request.'
              );
            }
            try {
              assertDirectIntake(command);
            } catch {
              throw new HttpError(
                422,
                'UNSUPPORTED_CHANNEL_RELATIONSHIP',
                'Only MARKREG_DIRECT with DIRECT is supported.'
              );
            }
            let downstream: Response;
            try {
              downstream = await fetch(`${markRegUrl}/v1/intakes`, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'idempotency-key': key,
                  'x-correlation-id': command.correlationId
                },
                body: JSON.stringify(command)
              });
            } catch {
              throw new HttpError(502, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg is unavailable.', true);
            }
            const body = (await downstream.json()) as unknown;
            return json(downstream.status, body, { 'x-correlation-id': command.correlationId });
          }
        }
      ]
    }
  );
}
