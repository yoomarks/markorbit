import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  ContentKitId,
  VisualAssetReference,
  VisualBriefId
} from '@markorbit/contracts/daily-workspace';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  VisualBridgeError,
  type PostgresVisualBridgeStore,
  type VisualBridgeService
} from './visual-bridge.js';

type Body = Record<string, unknown>;

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

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
}

function version(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function reusableAssets(value: unknown): readonly VisualAssetReference[] {
  if (!Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'reusableAssets must be an array.');
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new HttpError(400, 'INVALID_REQUEST', 'reusableAssets entries must be objects.');
    const candidate = entry as Record<string, unknown>;
    const source = text(candidate.source, 'reusableAssets.source');
    if (!['USER_IP', 'USER_COMMERCIAL', 'BRAND_KIT', 'VISUAL_LIBRARY', 'GENERATED'].includes(source))
      throw new HttpError(400, 'INVALID_REQUEST', 'reusableAssets.source is invalid.');
    if (typeof candidate.discriminative !== 'boolean' || typeof candidate.reusable !== 'boolean')
      throw new HttpError(
        400,
        'INVALID_REQUEST',
        'reusableAssets discriminative/reusable flags must be boolean.'
      );
    return {
      assetId: text(candidate.assetId, 'reusableAssets.assetId'),
      source: source as VisualAssetReference['source'],
      discriminative: candidate.discriminative,
      reusable: candidate.reusable
    };
  });
}

function mapVisualError(error: unknown): never {
  if (error instanceof VisualBridgeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createVisualBridgeRoutes(options: Readonly<{
  internalServiceSecret: string;
  visualBridgeService: VisualBridgeService;
  visualBridgeStore: PostgresVisualBridgeStore;
}>): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/content-kits/:contentPickId/visual-briefs',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        const body = bodyOf(request);
        try {
          const record = await options.visualBridgeService.createBrief({
            workspaceId: principal.workspaceId,
            subjectUserId: principal.userId,
            contentPickId: request.params.contentPickId ?? '',
            expectedContentKit: {
              id: text(body.expectedContentKitId, 'expectedContentKitId') as ContentKitId,
              version: version(body.expectedContentKitVersion, 'expectedContentKitVersion')
            },
            ipId: text(body.ipId, 'ipId'),
            reusableAssets: reusableAssets(body.reusableAssets ?? []),
            idempotencyKey: keyOf(request)
          });
          return json(201, {
            brief: record.brief,
            visualBriefFingerprintSha256: record.visualBriefFingerprintSha256
          });
        } catch (error) {
          return mapVisualError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/visual-briefs/:visualBriefId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        const record = await options.visualBridgeStore.findBrief(principal.workspaceId, {
          id: text(request.params.visualBriefId, 'visualBriefId') as VisualBriefId,
          version: version(request.query.version, 'version')
        });
        if (!record) throw new HttpError(404, 'VISUAL_BRIEF_NOT_FOUND', 'Visual Brief was not found.');
        return json(200, {
          brief: record.brief,
          visualBriefFingerprintSha256: record.visualBriefFingerprintSha256
        });
      }
    },
    {
      method: 'POST',
      path: '/v1/visual-briefs/:visualBriefId/request',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        const body = bodyOf(request);
        try {
          return json(
            201,
            await options.visualBridgeService.startRequest({
              workspaceId: principal.workspaceId,
              visualBrief: {
                id: text(request.params.visualBriefId, 'visualBriefId') as VisualBriefId,
                version: version(body.visualBriefVersion, 'visualBriefVersion')
              },
              expectedVisualBriefFingerprintSha256: text(
                body.expectedVisualBriefFingerprintSha256,
                'expectedVisualBriefFingerprintSha256'
              ),
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapVisualError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/visual-briefs/:visualBriefId/outputs',
      handle: async (request) => {
        const workspaceId = internalWorkspace(request, options.internalServiceSecret);
        const body = bodyOf(request);
        const assets = body.assetReferences;
        if (!Array.isArray(assets) || assets.some((asset) => typeof asset !== 'string'))
          throw new HttpError(400, 'INVALID_REQUEST', 'assetReferences must be a string array.');
        try {
          return json(
            201,
            await options.visualBridgeStore.recordOutput({
              workspaceId,
              visualBrief: {
                id: text(request.params.visualBriefId, 'visualBriefId') as VisualBriefId,
                version: version(body.visualBriefVersion, 'visualBriefVersion')
              },
              assetReferences: assets as string[],
              generatedAt: text(body.generatedAt, 'generatedAt'),
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapVisualError(error);
        }
      }
    }
  ];
}
