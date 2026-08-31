import {
  AuthenticationError,
  SELF_SERVICE_ACCOUNT_TYPES,
  commercialAdminCapabilitiesForAccount,
  type SelfServiceAccountType,
  type WorkspaceRepository
} from '@markorbit/contracts';
import { parseReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import { READY_PACKAGE_V2_DELIVERY_PROTOCOL_VERSION } from '@markorbit/contracts';
import {
  createServiceRuntime,
  HttpError,
  json,
  type JsonRequest,
  type JsonRoute
} from '@markorbit/service-kit';
import type { AccountAccessService } from './account-access.js';
import { createCoreAccountOnboardingRoutes } from './account-onboarding-http.js';
import type { AccountOnboardingService } from './account-onboarding.js';
import type { AuthenticationService } from './auth.js';
import { uuidV7 } from './auth.js';
import {
  fingerprintReadyPackageContentExport,
  validateReadyPackageContentExport,
  type KnowledgeReadyPackageContentRepository
} from './knowledge-content.js';
import { resolveAcceptedKnowledgeDailySource } from './knowledge-daily-source.js';
import {
  fingerprintCoreIntakeRequest,
  parseCoreIntakeRequest,
  type KnowledgeIntakeRepository
} from './knowledge-intake.js';
import {
  READY_PACKAGE_V2_PROTOCOL_HEADER,
  expectedReadyPackageV2IdempotencyKey,
  fingerprintExactReadyPackageV2Request,
  parseReadyPackageV2DeliveryRequest,
  readyPackageV2DeliveryResult,
  validateReadyPackageV2DeliveryIntegrity
} from './knowledge-v2-ingress.js';
import type { KnowledgeV2DeliveryRepository } from './knowledge-v2-delivery.js';
import { createMethodImprovementRoutesV1 } from './method-improvement-http.js';
import type { MethodImprovementAdmissionServiceV1 } from './method-improvement.js';
import { createMethodOutcomeEvidenceRoutesV1 } from './method-outcome-evidence-http.js';
import type { MethodOutcomeEvidenceAdmissionServiceV1 } from './method-outcome-evidence.js';
import { createMethodOutcomeReportRoutesV1 } from './method-outcome-report-http.js';
import type { MethodOutcomeReportServiceV1 } from './method-outcome-report.js';

export const serviceManifest = Object.freeze({
  name: 'core',
  port: Number(process.env.PORT ?? '4101'),
  version: '0.1.0'
});

export interface CoreRuntimeOptions {
  port?: number;
  authentication?: AuthenticationService;
  accountAccess?: AccountAccessService;
  accountOnboarding?: AccountOnboardingService;
  workspaces?: Pick<WorkspaceRepository, 'findById'>;
  knowledgeIntakes?: KnowledgeIntakeRepository;
  knowledgeContents?: KnowledgeReadyPackageContentRepository;
  knowledgeV2Deliveries?: KnowledgeV2DeliveryRepository;
  methodOutcomeEvidenceAdmissions?: Pick<MethodOutcomeEvidenceAdmissionServiceV1, 'admit'>;
  methodOutcomeReports?: Pick<MethodOutcomeReportServiceV1, 'report'>;
  methodImprovementAdmissions?: Pick<MethodImprovementAdmissionServiceV1, 'admit'>;
  internalServiceSecret?: string;
}
function body(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}
function authError(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status =
    error.code === 'EMAIL_ALREADY_REGISTERED'
      ? 409
      : ['INVALID_ACCOUNT_TYPE', 'WEAK_PASSWORD', 'INVALID_WORKSPACE_CONTEXT'].includes(error.code)
        ? 400
        : [
              'MEMBERSHIP_REQUIRED',
              'MEMBERSHIP_SUSPENDED',
              'WORKSPACE_ARCHIVED',
              'PERMISSION_DENIED'
            ].includes(error.code)
          ? 403
          : error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
            ? 503
            : 401;
  throw new HttpError(status, error.code, error.message, status === 503);
}
const canonicalUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);

export function createRuntime(options: CoreRuntimeOptions = {}) {
  const authentication = options.authentication;
  const secret = options.internalServiceSecret;
  if (options.accountOnboarding && !secret)
    throw new Error('internalServiceSecret is required for account onboarding routes.');
  if (options.methodOutcomeEvidenceAdmissions && !secret)
    throw new Error('internalServiceSecret is required for Method Outcome Evidence admission.');
  if (options.methodOutcomeReports && !secret)
    throw new Error('internalServiceSecret is required for Method Outcome reporting.');
  if (options.methodImprovementAdmissions && !secret)
    throw new Error('internalServiceSecret is required for Method Improvement admission.');
  const onboardingRoutes =
    options.accountOnboarding && secret
      ? createCoreAccountOnboardingRoutes({
          onboarding: options.accountOnboarding,
          internalServiceSecret: secret
        })
      : [];
  const methodOutcomeEvidenceRoutes =
    options.methodOutcomeEvidenceAdmissions && secret
      ? createMethodOutcomeEvidenceRoutesV1({
          service: options.methodOutcomeEvidenceAdmissions,
          internalServiceSecret: secret
        })
      : [];
  const methodOutcomeReportRoutes =
    options.methodOutcomeReports && secret
      ? createMethodOutcomeReportRoutesV1({
          service: options.methodOutcomeReports,
          internalServiceSecret: secret
        })
      : [];
  const methodImprovementRoutes =
    options.methodImprovementAdmissions && secret
      ? createMethodImprovementRoutesV1({
          service: options.methodImprovementAdmissions,
          internalServiceSecret: secret
        })
      : [];
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
        ...onboardingRoutes,
        ...(options.accountAccess
          ? [
              {
                method: 'POST' as const,
                path: '/internal/auth/register',
                handle: internal(async (request) => {
                  const value = body(request);
                  if (
                    typeof value.email !== 'string' ||
                    !value.email.includes('@') ||
                    typeof value.displayName !== 'string' ||
                    !value.displayName.trim() ||
                    typeof value.password !== 'string' ||
                    typeof value.accountType !== 'string'
                  )
                    throw new HttpError(400, 'INVALID_REQUEST', 'Registration data is invalid.');
                  if (
                    !(SELF_SERVICE_ACCOUNT_TYPES as readonly string[]).includes(value.accountType)
                  )
                    throw new AuthenticationError(
                      'INVALID_ACCOUNT_TYPE',
                      'This account type cannot be created through self-service registration.'
                    );
                  return json(
                    201,
                    await options.accountAccess!.register({
                      email: value.email,
                      displayName: value.displayName,
                      password: value.password,
                      accountType: value.accountType as SelfServiceAccountType
                    })
                  );
                })
              },
              {
                method: 'POST' as const,
                path: '/internal/auth/login',
                handle: internal(async (request) => {
                  const value = body(request);
                  if (typeof value.email !== 'string' || typeof value.password !== 'string')
                    throw new HttpError(400, 'INVALID_REQUEST', 'Email and password are required.');
                  return json(
                    200,
                    await options.accountAccess!.login({
                      email: value.email,
                      password: value.password
                    })
                  );
                })
              }
            ]
          : []),
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
          path: '/internal/commercial-admin/operator-principals/resolve',
          handle: internal(async (request) => {
            if (!options.accountAccess)
              throw new HttpError(
                503,
                'AUTHENTICATION_SERVICE_UNAVAILABLE',
                'Account access service is unavailable.',
                true
              );
            const token = body(request).token;
            if (typeof token !== 'string' || !token)
              throw new HttpError(400, 'INVALID_REQUEST', 'token is required.');
            const sessionPrincipal = await authentication.resolveSession(token);
            const account = await options.accountAccess.inspectAccount(sessionPrincipal.userId);
            if (!account)
              throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Account was not found.');
            const capabilities = commercialAdminCapabilitiesForAccount(account);
            if (!capabilities.includes('commercial-admin:read'))
              throw new AuthenticationError(
                'PERMISSION_DENIED',
                'Commercial admin capability is required.'
              );
            return json(200, {
              kind: 'INTERNAL_OPERATOR',
              sessionId: sessionPrincipal.sessionId,
              userId: sessionPrincipal.userId,
              capabilities,
              sessionExpiresAt: sessionPrincipal.sessionExpiresAt
            });
          })
        },
        {
          method: 'POST',
          path: '/internal/commercial-admin/accounts/:userId/inspect',
          handle: internal(async (request) => {
            if (!options.accountAccess || !options.accountOnboarding)
              throw new HttpError(
                503,
                'AUTHENTICATION_SERVICE_UNAVAILABLE',
                'Commercial admin account inspection is unavailable.',
                true
              );
            const token = body(request).token;
            if (typeof token !== 'string' || !token)
              throw new HttpError(400, 'INVALID_REQUEST', 'token is required.');
            const sessionPrincipal = await authentication.resolveSession(token);
            const operatorAccount = await options.accountAccess.inspectAccount(
              sessionPrincipal.userId
            );
            if (
              !operatorAccount ||
              !commercialAdminCapabilitiesForAccount(operatorAccount).includes(
                'commercial-admin:read'
              )
            )
              throw new AuthenticationError(
                'PERMISSION_DENIED',
                'Commercial admin capability is required.'
              );
            const account = await options.accountAccess.inspectAccount(request.params.userId!);
            if (!account) throw new HttpError(404, 'ACCOUNT_NOT_FOUND', 'Account was not found.');
            return json(200, {
              source: { domain: 'CORE', authority: 'ACCOUNT_AND_WORKSPACE' },
              account,
              workspaces: await options.accountOnboarding.listWorkspaces(account.userId)
            });
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
          path: '/internal/knowledge/ready-packages/v2/deliveries',
          bodyLimitBytes: 12 * 1024 * 1024,
          handle: internal(async (request) => {
            const protocol = request.headers[READY_PACKAGE_V2_PROTOCOL_HEADER];
            if (protocol !== READY_PACKAGE_V2_DELIVERY_PROTOCOL_VERSION)
              throw new HttpError(
                409,
                'KNOWLEDGE_V2_PROTOCOL_MISMATCH',
                'ReadyPackage V2 delivery protocol header must be 1.0.'
              );
            const idempotencyKey = request.headers['idempotency-key'];
            if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim())
              throw new HttpError(
                400,
                'IDEMPOTENCY_KEY_REQUIRED',
                'Idempotency-Key header is required.'
              );
            const deliveryRequest = parseReadyPackageV2DeliveryRequest(request.body);
            if (!deliveryRequest)
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                'ReadyPackage V2 request body is invalid.'
              );
            const expectedIdempotencyKey = expectedReadyPackageV2IdempotencyKey(
              deliveryRequest.deliveryId
            );
            if (idempotencyKey !== expectedIdempotencyKey)
              throw new HttpError(
                409,
                'KNOWLEDGE_V2_IDEMPOTENCY_KEY_MISMATCH',
                'Idempotency-Key does not match the frozen ReadyPackage V2 delivery identity.'
              );
            if (!request.rawBody)
              throw new HttpError(
                500,
                'KNOWLEDGE_V2_RAW_BODY_UNAVAILABLE',
                'Exact request bytes are unavailable for ReadyPackage V2 delivery.'
              );
            if (!options.workspaces || !options.knowledgeV2Deliveries)
              throw new HttpError(
                503,
                'KNOWLEDGE_V2_DELIVERY_SERVICE_UNAVAILABLE',
                'ReadyPackage V2 delivery service is unavailable.',
                true
              );
            if (!(await options.workspaces.findById(deliveryRequest.target.workspaceId)))
              throw new HttpError(
                404,
                'WORKSPACE_NOT_FOUND',
                'Target Core Workspace was not found.'
              );
            const integrityIssue = validateReadyPackageV2DeliveryIntegrity(deliveryRequest);
            if (integrityIssue)
              throw new HttpError(409, integrityIssue.code, integrityIssue.message);
            const requestSha256 = fingerprintExactReadyPackageV2Request(request.rawBody);
            const stored = await options.knowledgeV2Deliveries.createOrFind({
              deliveryId: deliveryRequest.deliveryId,
              idempotencyKey,
              targetWorkspaceId: deliveryRequest.target.workspaceId.toLowerCase(),
              knowledgeWorkspaceId: deliveryRequest.knowledgeWorkspaceId,
              readyPackageId: deliveryRequest.readyPackageId,
              readyPackageDigest: deliveryRequest.readyPackageDigest,
              contentExportSha256: deliveryRequest.contentExportSha256,
              requestSha256,
              request: deliveryRequest,
              submittedAt: deliveryRequest.submittedAt,
              receivedAt: new Date().toISOString(),
              status: 'RECEIVED'
            });
            if (stored.delivery.requestSha256 !== requestSha256)
              throw new HttpError(
                409,
                'KNOWLEDGE_V2_IDEMPOTENCY_CONFLICT',
                'Idempotency-Key was already used for different exact request bytes.'
              );
            return json(
              stored.created ? 201 : 200,
              readyPackageV2DeliveryResult(
                stored.delivery.request,
                stored.delivery.requestSha256,
                stored.delivery.status
              )
            );
          })
        },
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
        },
        {
          method: 'GET' as const,
          path: '/internal/knowledge/ready-packages/:readyPackageId/daily-source',
          handle: internal(async (request) => {
            const workspaceId = request.headers['x-markorbit-workspace-id'];
            const readyPackageId = request.params.readyPackageId;
            if (!workspaceId || !canonicalUuid(workspaceId))
              throw new HttpError(
                400,
                'INVALID_WORKSPACE_CONTEXT',
                'Workspace context is required.'
              );
            if (!readyPackageId?.trim())
              throw new HttpError(400, 'INVALID_REQUEST', 'readyPackageId is required.');
            if (!options.knowledgeIntakes || !options.knowledgeContents)
              throw new HttpError(
                503,
                'KNOWLEDGE_DAILY_SOURCE_UNAVAILABLE',
                'Accepted Knowledge Daily source projection is unavailable.',
                true
              );
            const projection = await resolveAcceptedKnowledgeDailySource(
              options.knowledgeIntakes,
              options.knowledgeContents,
              workspaceId.toLowerCase(),
              readyPackageId
            );
            if (!projection)
              throw new HttpError(
                404,
                'ACCEPTED_KNOWLEDGE_DAILY_SOURCE_NOT_FOUND',
                'Accepted Knowledge ReadyPackage content was not found for this Workspace.'
              );
            return json(200, projection);
          })
        },
        {
          method: 'GET' as const,
          path: '/internal/knowledge/ready-packages/:readyPackageId/product-loop-source',
          handle: internal(async (request) => {
            const workspaceId = request.headers['x-markorbit-workspace-id'];
            const readyPackageId = request.params.readyPackageId;
            if (!workspaceId || !canonicalUuid(workspaceId))
              throw new HttpError(
                400,
                'INVALID_WORKSPACE_CONTEXT',
                'Workspace context is required.'
              );
            if (!readyPackageId?.trim())
              throw new HttpError(400, 'INVALID_REQUEST', 'readyPackageId is required.');
            if (!options.knowledgeIntakes)
              throw new HttpError(
                503,
                'KNOWLEDGE_INTAKE_SERVICE_UNAVAILABLE',
                'Knowledge intake service is unavailable.',
                true
              );
            const intake = await options.knowledgeIntakes.findAcceptedByReadyPackage(
              workspaceId,
              readyPackageId
            );
            if (!intake)
              throw new HttpError(
                404,
                'ACCEPTED_KNOWLEDGE_SOURCE_NOT_FOUND',
                'Accepted Knowledge ReadyPackage source was not found for this Workspace.'
              );
            return json(200, {
              source: {
                schemaVersion: 1,
                owner: 'CORE',
                kind: 'KNOWLEDGE_READY_PACKAGE',
                sourceId: intake.request.readyPackageId,
                sourceVersion: 'CORE_ACCEPTED_V1',
                sourceFingerprintSha256: intake.requestSha256,
                observedAt: intake.receivedAt
              }
            });
          })
        }
      ]
    : [];
  routes.push(
    ...methodOutcomeEvidenceRoutes,
    ...methodOutcomeReportRoutes,
    ...methodImprovementRoutes
  );
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    { routes }
  );
}
export * from './identity.js';
export * from './auth.js';
export * from './account-access.js';
export * from './account-onboarding.js';
export * from './knowledge-intake.js';
export * from './knowledge-content.js';
export * from './knowledge-daily-source.js';
export * from './knowledge-v2-delivery.js';
export * from './knowledge-v2-ingress.js';
export * from './method-outcome-evidence.js';
export * from './method-outcome-report.js';
export * from './method-outcome-evidence-http.js';
export * from './method-improvement.js';
export * from './method-improvement-http.js';
