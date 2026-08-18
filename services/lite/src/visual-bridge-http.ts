import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  visualOutputKinds,
  visualOutputStatuses,
  type ContentKitId,
  type VisualBriefId,
  type VisualOutputKind,
  type VisualOutputReferenceId,
  type VisualOutputStatus
} from '@markorbit/contracts/daily-workspace';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  VisualBridgeError,
  type PostgresVisualBridgeStore,
  type VisualBridgeService
} from './visual-bridge.js';

type Body = Record<string, unknown>;
const FORBIDDEN_VISUAL_OVERRIDES = new Set([
  'providerId',
  'provider_id',
  'modelId',
  'model_id',
  'styleId',
  'style_id',
  'recipeId',
  'recipe_id',
  'routeId',
  'route_id',
  'paidConfirmation',
  'paid_confirmation',
  'paidExecutionAuthorized',
  'paid_execution_authorized',
  'qcOverride',
  'qc_override',
  'identityOverride',
  'identity_override'
]);

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

function rejectForbiddenOverrides(body: Readonly<Body>): void {
  const field = Object.keys(body).find((key) => FORBIDDEN_VISUAL_OVERRIDES.has(key));
  if (field)
    throw new HttpError(
      400,
      'VISUAL_OVERRIDE_FORBIDDEN',
      `${field} is not accepted at the Lite Visual boundary.`
    );
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

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return text(value, field);
}

function version(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function outputKind(value: unknown): VisualOutputKind {
  if (typeof value !== 'string' || !visualOutputKinds.some((candidate) => candidate === value))
    throw new HttpError(400, 'INVALID_REQUEST', 'outputKind is invalid.');
  return value as VisualOutputKind;
}

function outputStatus(value: unknown): VisualOutputStatus {
  if (typeof value !== 'string' || !visualOutputStatuses.some((candidate) => candidate === value))
    throw new HttpError(400, 'INVALID_REQUEST', 'status is invalid.');
  return value as VisualOutputStatus;
}

function qcStatus(value: unknown): 'PASS' | 'PASS_WITH_WARNINGS' | undefined {
  if (value === undefined || value === null) return undefined;
  if (value !== 'PASS' && value !== 'PASS_WITH_WARNINGS')
    throw new HttpError(400, 'INVALID_REQUEST', 'qcStatus is invalid.');
  return value;
}

function mapVisualError(error: unknown): never {
  if (error instanceof VisualBridgeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createVisualBridgeRoutes(
  options: Readonly<{
    internalServiceSecret: string;
    visualBridgeService: VisualBridgeService;
    visualBridgeStore: PostgresVisualBridgeStore;
  }>
): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/content-kits/:contentPickId/visual-briefs',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        const body = bodyOf(request);
        rejectForbiddenOverrides(body);
        try {
          const record = await options.visualBridgeService.createBrief({
            workspaceId: principal.workspaceId,
            subjectUserId: principal.userId,
            contentPickId: request.params.contentPickId ?? '',
            expectedContentKit: {
              id: text(body.expectedContentKitId, 'expectedContentKitId') as ContentKitId,
              version: version(body.expectedContentKitVersion, 'expectedContentKitVersion')
            },
            requestedIpPackage: text(body.requestedIpPackage, 'requestedIpPackage'),
            outputKind: outputKind(body.outputKind),
            sceneIntent: text(body.sceneIntent, 'sceneIntent'),
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
        if (!record)
          throw new HttpError(404, 'VISUAL_BRIEF_NOT_FOUND', 'Visual Brief was not found.');
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
        rejectForbiddenOverrides(body);
        try {
          const result = await options.visualBridgeService.startRequest({
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
          });
          return json(201, {
            requestReference: result.requestReference,
            output: result.output,
            acceptedAt: result.acceptedAt
          });
        } catch (error) {
          return mapVisualError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/visual-outputs/:visualOutputReferenceId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        const output = await options.visualBridgeStore.findOutput(principal.workspaceId, {
          id: text(
            request.params.visualOutputReferenceId,
            'visualOutputReferenceId'
          ) as VisualOutputReferenceId,
          version: version(request.query.version, 'version')
        });
        if (!output)
          throw new HttpError(404, 'VISUAL_OUTPUT_NOT_FOUND', 'Visual output was not found.');
        return json(200, output);
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/visual-briefs/:visualBriefId/outputs',
      handle: async (request) => {
        const workspaceId = internalWorkspace(request, options.internalServiceSecret);
        const body = bodyOf(request);
        try {
          const outputReferenceValue = optionalText(body.outputReference, 'outputReference');
          const qcStatusValue = qcStatus(body.qcStatus);
          return json(
            201,
            await options.visualBridgeStore.recordOutput({
              workspaceId,
              visualBrief: {
                id: text(request.params.visualBriefId, 'visualBriefId') as VisualBriefId,
                version: version(body.visualBriefVersion, 'visualBriefVersion')
              },
              requestReference: text(body.requestReference, 'requestReference'),
              status: outputStatus(body.status),
              ...(outputReferenceValue ? { outputReference: outputReferenceValue } : {}),
              ...(qcStatusValue ? { qcStatus: qcStatusValue } : {}),
              createdAt: text(body.createdAt, 'createdAt'),
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
