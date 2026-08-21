import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  TrademarkServiceIntent,
  TrademarkServiceWorkPackage,
  TrademarkServiceWorkPackageId
} from '@markorbit/contracts/trademark-service-workbench';
import type { TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  prepareTrademarkServiceExecutionReadiness,
  TrademarkServiceExecutionReadinessError
} from './trademark-service-execution-readiness.js';
import {
  TrademarkServiceWorkPackagePersistenceError,
  type PostgresTrademarkServiceWorkPackageStore
} from './trademark-service-work-package.js';

export interface TrademarkServiceWorkbenchRouteOptions {
  internalServiceSecret: string;
  workPackages: PostgresTrademarkServiceWorkPackageStore;
  query: QueryClient;
  now?: () => string;
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
  permission: 'workspace:read' | 'matter:create' | 'review:perform'
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

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function stringReferences(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a string array.`);
  return value as string[];
}

function positiveVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', 'expectedWorkPackageVersion must be positive.');
  return Number(value);
}

function reviewedIntent(value: unknown): TrademarkServiceIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'Service Intent is required.');
  const intent = value as Partial<TrademarkServiceIntent>;
  if (intent.reviewedByUser !== true)
    throw new HttpError(
      409,
      'SERVICE_INTENT_REVIEW_REQUIRED',
      'Service Intent must be explicitly reviewed by the user before a Work Package is created.'
    );
  return value as TrademarkServiceIntent;
}

function mapError(error: unknown): never {
  if (error instanceof TrademarkServiceWorkPackagePersistenceError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  if (error instanceof TrademarkServiceExecutionReadinessError)
    throw new HttpError(error.status, error.code, error.message);
  throw error;
}

export async function latestTrademarkServiceWorkPackageForAsset(
  query: QueryClient,
  workspaceId: string,
  trademarkAssetId: TrademarkAssetId
): Promise<TrademarkServiceWorkPackage | undefined> {
  const result = await query.query(
    `SELECT document_json
       FROM lite_trademark_service_work_packages
      WHERE workspace_id=$1 AND trademark_asset_id=$2
      ORDER BY updated_at DESC, version DESC
      LIMIT 1`,
    [workspaceId, trademarkAssetId]
  );
  const row = result.rows[0] as { document_json?: unknown } | undefined;
  return row?.document_json
    ? structuredClone(row.document_json as TrademarkServiceWorkPackage)
    : undefined;
}

export function createTrademarkServiceWorkbenchRoutes(
  options: TrademarkServiceWorkbenchRouteOptions
): readonly JsonRoute[] {
  const now = options.now ?? (() => new Date().toISOString());
  return [
    {
      method: 'GET',
      path: '/v1/trademark-assets/:trademarkAssetId/service-work-package',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        const trademarkAssetId = request.params.trademarkAssetId! as TrademarkAssetId;
        const workPackage = await latestTrademarkServiceWorkPackageForAsset(
          options.query,
          principal.workspaceId,
          trademarkAssetId
        );
        return json(200, { workPackage: workPackage ?? null });
      }
    },
    {
      method: 'POST',
      path: '/v1/trademark-assets/:trademarkAssetId/service-work-packages',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:create');
        const body = bodyRecord(request);
        const key = request.headers['idempotency-key'];
        if (!key?.trim())
          throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
        if (body.createdByUserId !== undefined || body.userId !== undefined)
          throw new HttpError(
            400,
            'ACTOR_SPOOF_REJECTED',
            'Actor identity comes from the authenticated Principal.'
          );
        const intent = reviewedIntent(body.intent);
        try {
          const workPackage = await options.workPackages.create({
            workspaceId: principal.workspaceId,
            asset: {
              id: request.params.trademarkAssetId! as TrademarkAssetId,
              version: body.assetVersion as number | string
            },
            ...(typeof body.managementRecommendationReference === 'string'
              ? { managementRecommendationReference: body.managementRecommendationReference }
              : {}),
            intent,
            createdByUserId: principal.userId,
            idempotencyKey: key
          });
          return json(201, { workPackage });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/trademark-service-work-packages/:workPackageId/execution-readiness',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'review:perform');
        const body = bodyRecord(request);
        if (body.reviewedByUserId !== undefined || body.userId !== undefined)
          throw new HttpError(
            400,
            'ACTOR_SPOOF_REJECTED',
            'Reviewer identity comes from the authenticated Principal.'
          );
        try {
          const workPackage = await options.workPackages.get(
            principal.workspaceId,
            request.params.workPackageId! as TrademarkServiceWorkPackageId
          );
          const readiness = prepareTrademarkServiceExecutionReadiness({
            workspaceId: principal.workspaceId,
            workPackage,
            expectedWorkPackageVersion: positiveVersion(body.expectedWorkPackageVersion),
            reviewedByUserId: principal.userId,
            reviewedAt: now(),
            ownerDomainValidationReferences: stringReferences(
              body.ownerDomainValidationReferences,
              'ownerDomainValidationReferences'
            ),
            evidenceReferences: stringReferences(body.evidenceReferences, 'evidenceReferences'),
            ...(typeof body.executionPreparationReference === 'string'
              ? { executionPreparationReference: body.executionPreparationReference }
              : {})
          });
          return json(201, { readiness });
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
