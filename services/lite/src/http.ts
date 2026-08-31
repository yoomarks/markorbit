import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  OpportunityCandidateId,
  OpportunityQualificationDecisionId,
  PreparedActionId,
  ProductLoopFeedbackOutcome,
  ProductLoopUseFeedback,
  PublishPackageId
} from '@markorbit/contracts/product-loop';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  LiteCandidateQualificationError,
  type PostgresLiteCandidateQualificationStore
} from './candidate-qualification.js';
import {
  ProductConversionAnalyticsError,
  type PostgresProductConversionAnalyticsStore
} from './conversion-analytics.js';
import { DailyOrbitError, type DailyOrbitService } from './daily-orbit.js';
import { ContentStudioError, type PostgresContentStudioReader } from './content-studio.js';
import { DailySignalImportError, type PostgresLiteDailySignalStore } from './daily-signal.js';
import { ProductLoopFeedbackError, type PostgresProductLoopFeedbackStore } from './feedback.js';
import {
  PreparedActionJourneyError,
  type PreparedActionJourneyService,
  type PreparedActionPlan
} from './prepared-action.js';

type Body = Record<string, unknown>;

export interface UseFeedbackPreferenceRecorder {
  recordUseFeedback(feedback: Readonly<ProductLoopUseFeedback>): Promise<unknown>;
}

export interface LiteProductLoopRouteOptions {
  internalServiceSecret: string;
  journeyService: PreparedActionJourneyService;
  candidateStore: PostgresLiteCandidateQualificationStore;
  feedbackStore: PostgresProductLoopFeedbackStore;
  analyticsStore: PostgresProductConversionAnalyticsStore;
  dailySignalStore?: PostgresLiteDailySignalStore;
  dailyOrbitService?: DailyOrbitService;
  useFeedbackPreferenceRecorder?: UseFeedbackPreferenceRecorder;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalOf(
  request: JsonRequest,
  secret: string,
  permission: 'workspace:read' | 'matter:manage'
): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  if (!principal.permissions.includes(permission))
    throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
  return principal;
}

function internalWorkspace(request: JsonRequest, secret: string): string {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  return workspaceId;
}

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function keyOf(request: JsonRequest): string {
  const key = request.headers['idempotency-key'];
  if (!key || !key.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return key.trim();
}

function positive(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${name} must be a positive integer.`);
  return Number(value);
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${name} is required.`);
  return value.trim();
}

function optionalText(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return text(value, name);
}

function planOf(value: unknown): PreparedActionPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'plan must be an object.');
  return value as PreparedActionPlan;
}

function mapError(error: unknown): never {
  if (
    error instanceof ContentStudioError ||
    error instanceof PreparedActionJourneyError ||
    error instanceof LiteCandidateQualificationError ||
    error instanceof ProductLoopFeedbackError ||
    error instanceof ProductConversionAnalyticsError ||
    error instanceof DailySignalImportError ||
    error instanceof DailyOrbitError
  )
    throw new HttpError(
      error.status,
      error.code,
      error.message,
      error.status >= 500,
      'details' in error ? error.details : undefined
    );
  throw error;
}

export function createContentStudioRoutes(
  options: Readonly<{
    internalServiceSecret: string;
    reader: Pick<PostgresContentStudioReader, 'list' | 'find'>;
  }>
): JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/content-studio/works',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        const { limit, after } = request.query;
        if (Object.keys(request.query).some((key) => key !== 'limit' && key !== 'after'))
          throw new HttpError(400, 'INVALID_REQUEST', 'Only limit and after are supported.');
        if (limit !== undefined && !/^[1-9]\d*$/u.test(limit))
          throw new HttpError(400, 'INVALID_REQUEST', 'limit must be a positive integer.');
        try {
          return json(
            200,
            await options.reader.list(principal.workspaceId, {
              ...(limit === undefined ? {} : { limit: Number(limit) }),
              ...(after === undefined ? {} : { after })
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/content-studio/works/:contentOpportunityId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        if (Object.keys(request.query).length)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Detail always reads the current Opportunity version.'
          );
        try {
          return json(
            200,
            await options.reader.find(
              principal.workspaceId,
              request.params.contentOpportunityId ?? ''
            )
          );
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}

export function createLiteProductLoopRoutes(options: LiteProductLoopRouteOptions): JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/opportunity-candidates',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        try {
          return json(
            200,
            await options.candidateStore.listLatestCandidates(principal.workspaceId, {
              ...(request.query.limit !== undefined ? { limit: Number(request.query.limit) } : {}),
              ...(request.query.cursor !== undefined ? { cursor: request.query.cursor } : {})
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    ...(['', '/qualification'] as const).map((suffix): JsonRoute => ({
      method: 'GET',
      path: `/v1/opportunity-candidates/:opportunityCandidateId${suffix}`,
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        const candidateId = request.params.opportunityCandidateId! as OpportunityCandidateId;
        try {
          const candidate = await options.candidateStore.findLatestCandidate(
            principal.workspaceId,
            candidateId
          );
          if (!candidate)
            throw new HttpError(
              404,
              'OPPORTUNITY_CANDIDATE_NOT_FOUND',
              'Opportunity Candidate was not found.'
            );
          if (!suffix) return json(200, candidate);
          // Return the durable decision unchanged: its reviewed version is not the latest version.
          const decision = await options.candidateStore.findQualificationDecision(
            principal.workspaceId,
            candidateId
          );
          return json(200, decision ?? null);
        } catch (error) {
          return mapError(error);
        }
      }
    })),
    ...(options.dailySignalStore
      ? [
          {
            method: 'POST' as const,
            path: '/internal/v1/daily-signals/import',
            handle: async (request: JsonRequest) => {
              const workspaceId = internalWorkspace(request, options.internalServiceSecret);
              const body = bodyOf(request);
              try {
                return json(
                  201,
                  await options.dailySignalStore!.importKnowledgeSource({
                    workspaceId,
                    readyPackageId: text(body.readyPackageId, 'readyPackageId'),
                    idempotencyKey: keyOf(request)
                  })
                );
              } catch (error) {
                return mapError(error);
              }
            }
          }
        ]
      : []),
    ...(options.dailyOrbitService
      ? [
          {
            method: 'GET' as const,
            path: '/v1/daily-orbit',
            handle: async (request: JsonRequest) => {
              const principal = principalOf(
                request,
                options.internalServiceSecret,
                'workspace:read'
              );
              try {
                return json(
                  200,
                  await options.dailyOrbitService!.snapshot(principal.workspaceId, principal.userId)
                );
              } catch (error) {
                return mapError(error);
              }
            }
          }
        ]
      : []),
    {
      method: 'GET',
      path: '/v1/today',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        try {
          const [snapshot, recentFeedback, feedbackPendingPackages] = await Promise.all([
            options.journeyService.listToday(principal.workspaceId),
            options.feedbackStore.listRecent(principal.workspaceId),
            options.feedbackStore.listPendingPackages(principal.workspaceId)
          ]);
          return json(200, { ...snapshot, recentFeedback, feedbackPendingPackages });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/analytics/product-loop-conversions',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        try {
          return json(200, await options.analyticsStore.snapshot(principal.workspaceId));
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/prepared-actions/:preparedActionId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        try {
          const journey = await options.journeyService.findJourney(
            principal.workspaceId,
            request.params.preparedActionId! as PreparedActionId
          );
          if (!journey)
            throw new HttpError(404, 'PREPARED_ACTION_NOT_FOUND', 'Prepared Action was not found.');
          return json(200, journey);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/today/:todayRecommendationId/prepared-actions',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        const body = bodyOf(request);
        try {
          const journey = await options.journeyService.prepare({
            workspaceId: principal.workspaceId,
            recommendation: {
              id: request.params.todayRecommendationId! as `today-recommendation_${string}`,
              version: positive(body.recommendationVersion, 'recommendationVersion')
            },
            expectedRecommendationFingerprintSha256: text(
              body.expectedRecommendationFingerprintSha256,
              'expectedRecommendationFingerprintSha256'
            ),
            plan: planOf(body.plan),
            idempotencyKey: keyOf(request)
          });
          return json(201, journey);
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/prepared-actions/:preparedActionId/confirm',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        const body = bodyOf(request);
        try {
          const journey = await options.journeyService.confirmAndHandoff({
            workspaceId: principal.workspaceId,
            preparedAction: {
              id: request.params.preparedActionId! as PreparedActionId,
              version: positive(body.preparedActionVersion, 'preparedActionVersion')
            },
            expectedPreparedActionFingerprintSha256: text(
              body.expectedPreparedActionFingerprintSha256,
              'expectedPreparedActionFingerprintSha256'
            ),
            confirmedByPrincipalId: principal.userId,
            acknowledgedEffect: text(body.acknowledgedEffect, 'acknowledgedEffect'),
            idempotencyKey: keyOf(request)
          });
          return json(200, journey);
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/publish-packages/:publishPackageId/use-feedback',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        const body = bodyOf(request);
        const externalReference = optionalText(body.externalReference, 'externalReference');
        try {
          const feedback = await options.feedbackStore.recordUseFeedback({
            workspaceId: principal.workspaceId,
            publishPackage: {
              id: request.params.publishPackageId! as PublishPackageId,
              version: positive(body.publishPackageVersion, 'publishPackageVersion')
            },
            expectedPublishPackageFingerprintSha256: text(
              body.expectedPublishPackageFingerprintSha256,
              'expectedPublishPackageFingerprintSha256'
            ),
            outcome: text(body.outcome, 'outcome') as ProductLoopFeedbackOutcome,
            ...(externalReference ? { externalReference } : {}),
            recordedByPrincipalId: principal.userId,
            idempotencyKey: keyOf(request)
          });
          if (options.useFeedbackPreferenceRecorder)
            try {
              await options.useFeedbackPreferenceRecorder.recordUseFeedback(feedback);
            } catch {
              // Preference evidence is secondary and must never rewrite accepted use feedback.
            }
          return json(201, feedback);
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/qualified-opportunities/resolve',
      handle: async (request) => {
        const workspaceId = internalWorkspace(request, options.internalServiceSecret);
        const body = bodyOf(request);
        const candidateBody = body.candidate as Record<string, unknown> | undefined;
        const decisionBody = body.qualificationDecision as Record<string, unknown> | undefined;
        if (!candidateBody || !decisionBody)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'candidate and qualificationDecision are required.'
          );
        const candidateId = text(candidateBody.id, 'candidate.id') as OpportunityCandidateId;
        const candidateVersion = positive(candidateBody.version, 'candidate.version');
        const decisionId = text(
          decisionBody.id,
          'qualificationDecision.id'
        ) as OpportunityQualificationDecisionId;
        const decisionVersion = positive(decisionBody.version, 'qualificationDecision.version');
        try {
          const [candidate, currentCandidate, qualificationDecision] = await Promise.all([
            options.candidateStore.findCandidate(workspaceId, candidateId, candidateVersion),
            options.candidateStore.findLatestCandidate(workspaceId, candidateId),
            options.candidateStore.findQualificationDecision(workspaceId, candidateId)
          ]);
          if (
            !candidate ||
            !currentCandidate ||
            !qualificationDecision ||
            qualificationDecision.opportunityQualificationDecisionId !== decisionId ||
            qualificationDecision.version !== decisionVersion
          )
            throw new HttpError(
              404,
              'QUALIFIED_OPPORTUNITY_EVIDENCE_NOT_FOUND',
              'Exact qualified Candidate evidence was not found.'
            );
          return json(200, { candidate, currentCandidate, qualificationDecision });
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapError(error);
        }
      }
    }
  ];
}
