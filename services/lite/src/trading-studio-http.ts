import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { TradingStandardStudioRunId } from '@markorbit/contracts/trading-studio-usage';
import type {
  TradingCommercialDirectionId,
  TradingCommercialDirectionSetId
} from '@markorbit/contracts/trading-commercial-direction';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  TradingStudioRunPersistenceError,
  type PostgresTradingStudioRunStore
} from './trading-studio-run.js';
import {
  TradingDirectionSetPersistenceError,
  type PostgresTradingDirectionSetStore
} from './trading-direction-set.js';
import {
  TradingDirectionSelectionPersistenceError,
  type PostgresTradingDirectionSelectionStore
} from './trading-direction-selection.js';
import {
  TradingAiProfilePersistenceError,
  type PostgresTradingAiProfileStore
} from './trading-ai-profile.js';
import {
  TradingBrandDnaPersistenceError,
  type PostgresTradingBrandDnaStore
} from './trading-brand-dna.js';
import {
  TradingAiProfileCheckpointError,
  type TradingAiProfileCheckpointService
} from './trading-ai-profile-checkpoint.js';
import { TradingAiProfileGenerationError } from './trading-ai-profile-generation.js';
import { TrademarkAssetPersistenceError } from './trademark-asset.js';

export interface TradingStudioReadRouteOptions {
  internalServiceSecret: string;
  runs: Pick<PostgresTradingStudioRunStore, 'getLatest'>;
  profiles: Pick<PostgresTradingAiProfileStore, 'getExact'>;
  brandDnas: Pick<PostgresTradingBrandDnaStore, 'getExact'>;
  directionSets: Pick<PostgresTradingDirectionSetStore, 'getExact'>;
  selections: Pick<
    PostgresTradingDirectionSelectionStore,
    'getCurrentForDirectionSet' | 'recordExplicit'
  >;
  aiProfileCheckpointFor?: (
    principal: Readonly<WorkspacePrincipal>
  ) => Pick<TradingAiProfileCheckpointService, 'generate'>;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalOf(request: JsonRequest, secret: string): WorkspacePrincipal {
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
  if (!principal.permissions.includes('workspace:read'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.');
  return principal;
}

function bodyOf(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

export function createTradingStudioReadRoutes(options: TradingStudioReadRouteOptions): JsonRoute[] {
  const routes: JsonRoute[] = [
    {
      method: 'GET',
      path: '/v1/trading/studio-runs/:studioRunId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (request.body !== undefined || Object.keys(request.query).length)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Studio Run read accepts only its path identifier.'
          );
        try {
          const run = await options.runs.getLatest(
            principal.workspaceId,
            request.params.studioRunId! as TradingStandardStudioRunId
          );
          return json(200, { run });
        } catch (error) {
          if (error instanceof TradingStudioRunPersistenceError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/trading/direction-sets/:directionSetId/versions/:version',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (request.body !== undefined || Object.keys(request.query).length)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Direction Set read accepts only path fields.'
          );
        const version = Number(request.params.version);
        try {
          const directionSet = await options.directionSets.getExact(
            principal.workspaceId,
            request.params.directionSetId! as TradingCommercialDirectionSetId,
            version
          );
          return json(200, { directionSet });
        } catch (error) {
          if (error instanceof TradingDirectionSetPersistenceError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/trading/direction-sets/:directionSetId/selection',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (request.body !== undefined || Object.keys(request.query).length)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Selection read accepts only its path identifier.'
          );
        try {
          const selection = await options.selections.getCurrentForDirectionSet(
            principal.workspaceId,
            request.params.directionSetId!
          );
          return json(200, { selection: selection ?? null });
        } catch (error) {
          if (error instanceof TradingDirectionSelectionPersistenceError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/trading/studio-runs/:studioRunId/state',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (request.body !== undefined || Object.keys(request.query).length)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Studio state read accepts only its path identifier.'
          );
        try {
          const run = await options.runs.getLatest(
            principal.workspaceId,
            request.params.studioRunId! as TradingStandardStudioRunId
          );
          const aiProfileReference = run.aiProfile;
          if (
            aiProfileReference &&
            (!Number.isSafeInteger(aiProfileReference.version) ||
              Number(aiProfileReference.version) < 1)
          )
            throw new HttpError(
              409,
              'STUDIO_STATE_VERSION_CONFLICT',
              'Studio Run does not reference a valid AI Profile version.'
            );
          const aiProfile = aiProfileReference
            ? await options.profiles.getExact(
                principal.workspaceId,
                aiProfileReference.id,
                Number(aiProfileReference.version)
              )
            : undefined;
          if (
            aiProfile &&
            (aiProfile.aiProfileId !== aiProfileReference?.id ||
              aiProfile.version !== Number(aiProfileReference.version) ||
              aiProfile.trademarkAsset.id !== run.trademarkAsset.id ||
              aiProfile.trademarkAsset.version !== run.trademarkAsset.version)
          )
            throw new HttpError(
              409,
              'STUDIO_STATE_VERSION_CONFLICT',
              'AI Profile does not reference the Studio Run exact source versions.'
            );
          const brandDnaReference = run.brandDna;
          if (
            brandDnaReference &&
            (!Number.isSafeInteger(brandDnaReference.version) ||
              Number(brandDnaReference.version) < 1)
          )
            throw new HttpError(
              409,
              'STUDIO_STATE_VERSION_CONFLICT',
              'Studio Run does not reference a valid BrandDNA version.'
            );
          const brandDna = brandDnaReference
            ? await options.brandDnas.getExact(
                principal.workspaceId,
                brandDnaReference.id,
                Number(brandDnaReference.version)
              )
            : undefined;
          if (
            brandDna &&
            (brandDna.brandDnaId !== brandDnaReference?.id ||
              brandDna.version !== Number(brandDnaReference.version) ||
              brandDna.studioRun.id !== run.studioRunId ||
              brandDna.studioRun.version !== run.version ||
              brandDna.trademarkAsset.id !== run.trademarkAsset.id ||
              brandDna.trademarkAsset.version !== run.trademarkAsset.version ||
              !aiProfileReference ||
              brandDna.aiProfile.id !== aiProfileReference.id ||
              brandDna.aiProfile.version !== aiProfileReference.version)
          )
            throw new HttpError(
              409,
              'STUDIO_STATE_VERSION_CONFLICT',
              'BrandDNA does not reference the Studio Run exact source versions.'
            );
          if (!run.directionSet)
            return json(200, {
              run,
              aiProfile: aiProfile ?? null,
              brandDna: brandDna ?? null,
              directionSet: null,
              selection: null
            });
          const directionSetReference = run.directionSet;
          if (
            !Number.isSafeInteger(directionSetReference.version) ||
            Number(directionSetReference.version) < 1
          )
            throw new HttpError(
              409,
              'STUDIO_STATE_VERSION_CONFLICT',
              'Studio Run does not reference a valid Direction Set version.'
            );
          const directionSetVersion = Number(directionSetReference.version);
          const directionSet = await options.directionSets.getExact(
            principal.workspaceId,
            directionSetReference.id,
            directionSetVersion
          );
          const selection = await options.selections.getCurrentForDirectionSet(
            principal.workspaceId,
            directionSetReference.id
          );
          if (
            selection &&
            (selection.directionSet.id !== directionSetReference.id ||
              selection.directionSet.version !== directionSetVersion)
          )
            throw new HttpError(
              409,
              'STUDIO_STATE_VERSION_CONFLICT',
              'Current Selection does not reference the Studio Run exact Direction Set version.'
            );
          return json(200, {
            run,
            aiProfile: aiProfile ?? null,
            brandDna: brandDna ?? null,
            directionSet,
            selection: selection ?? null
          });
        } catch (error) {
          if (
            error instanceof TradingStudioRunPersistenceError ||
            error instanceof TradingAiProfilePersistenceError ||
            error instanceof TradingBrandDnaPersistenceError ||
            error instanceof TradingDirectionSetPersistenceError ||
            error instanceof TradingDirectionSelectionPersistenceError
          )
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/trading/direction-sets/:directionSetId/selection',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (!principal.permissions.includes('matter:manage'))
          throw new HttpError(403, 'PERMISSION_DENIED', 'matter:manage permission is required.');
        if (Object.keys(request.query).length)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Selection command does not accept query fields.'
          );
        const body = bodyOf(request);
        const actorField = [
          'workspaceId',
          'actorId',
          'userId',
          'principalId',
          'membershipId',
          'selectedByPrincipalId',
          'selectionMethod',
          'selectedAt',
          'authorityConsequences'
        ].find((field) => body[field] !== undefined);
        if (actorField)
          throw new HttpError(
            400,
            'ACTOR_SPOOF_REJECTED',
            'Selection authority comes from the authenticated Principal.'
          );
        const allowed = [
          'expectedDirectionSetVersion',
          'selectedDirectionId',
          'expectedDirectionVersion'
        ];
        if (Object.keys(body).some((field) => !allowed.includes(field)))
          throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
        const idempotencyKey = request.headers['idempotency-key']?.trim();
        if (!idempotencyKey)
          throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
        const correlationId = request.headers['x-correlation-id']?.trim();
        if (!correlationId || !correlationId.includes('_'))
          throw new HttpError(400, 'INVALID_REQUEST', 'x-correlation-id is required.');
        if (typeof body.selectedDirectionId !== 'string')
          throw new HttpError(400, 'INVALID_REQUEST', 'selectedDirectionId is required.');
        try {
          const selection = await options.selections.recordExplicit(principal.workspaceId, {
            schemaVersion: 1,
            directionSetId: request.params.directionSetId! as TradingCommercialDirectionSetId,
            expectedDirectionSetVersion: positive(
              body.expectedDirectionSetVersion,
              'expectedDirectionSetVersion'
            ),
            selectedDirectionId: body.selectedDirectionId as TradingCommercialDirectionId,
            expectedDirectionVersion: positive(
              body.expectedDirectionVersion,
              'expectedDirectionVersion'
            ),
            idempotencyKey,
            correlationId: correlationId as `${string}_${string}`
          });
          return json(201, { selection });
        } catch (error) {
          if (error instanceof TradingDirectionSelectionPersistenceError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/trading/ai-profiles/:aiProfileId/versions/:version',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (request.body !== undefined || Object.keys(request.query).length)
          throw new HttpError(400, 'INVALID_REQUEST', 'AI Profile read accepts only path fields.');
        try {
          const aiProfile = await options.profiles.getExact(
            principal.workspaceId,
            request.params.aiProfileId! as `trading-ai-derived_ai-profile_${string}`,
            Number(request.params.version)
          );
          return json(200, { aiProfile });
        } catch (error) {
          if (error instanceof TradingAiProfilePersistenceError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/trading/brand-dnas/:brandDnaId/versions/:version',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (request.body !== undefined || Object.keys(request.query).length)
          throw new HttpError(400, 'INVALID_REQUEST', 'BrandDNA read accepts only path fields.');
        try {
          const brandDna = await options.brandDnas.getExact(
            principal.workspaceId,
            request.params.brandDnaId! as `trading-ai-derived_brand-dna_${string}`,
            Number(request.params.version)
          );
          return json(200, { brandDna });
        } catch (error) {
          if (error instanceof TradingBrandDnaPersistenceError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    }
  ];
  const aiProfileCheckpointFor = options.aiProfileCheckpointFor;
  if (aiProfileCheckpointFor) {
    routes.push({
      method: 'POST',
      path: '/v1/trading/studio-runs/:studioRunId/ai-profile',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (!principal.permissions.includes('matter:manage'))
          throw new HttpError(403, 'PERMISSION_DENIED', 'matter:manage permission is required.');
        if (Object.keys(request.query).length)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'AI Profile command does not accept query fields.'
          );
        const body = bodyOf(request);
        if (Object.keys(body).some((field) => field !== 'userBrief'))
          throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
        if (body.userBrief !== undefined && typeof body.userBrief !== 'string')
          throw new HttpError(400, 'INVALID_REQUEST', 'userBrief must be a string.');
        const idempotencyKey = request.headers['idempotency-key']?.trim();
        const correlationId = request.headers['x-correlation-id']?.trim();
        if (!idempotencyKey)
          throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
        if (!correlationId)
          throw new HttpError(400, 'INVALID_REQUEST', 'x-correlation-id is required.');
        try {
          const result = await aiProfileCheckpointFor(principal).generate({
            workspaceId: principal.workspaceId,
            studioRunId: request.params.studioRunId! as TradingStandardStudioRunId,
            ...(typeof body.userBrief === 'string' ? { userBrief: body.userBrief } : {}),
            idempotencyKey,
            correlationId
          });
          return json(result.replayed ? 200 : 201, result);
        } catch (error) {
          if (
            error instanceof TradingAiProfileCheckpointError ||
            error instanceof TradingAiProfileGenerationError ||
            error instanceof TradingStudioRunPersistenceError ||
            error instanceof TradingAiProfilePersistenceError ||
            error instanceof TrademarkAssetPersistenceError
          ) {
            const status = 'status' in error ? Number(error.status) : 409;
            const retryable = 'retryable' in error ? Boolean(error.retryable) : false;
            throw new HttpError(status, error.code, error.message, retryable);
          }
          throw error;
        }
      }
    });
  }
  return routes;
}
