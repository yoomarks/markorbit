import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal } from '@markorbit/contracts';
import {
  productPreferenceEventKinds,
  type ProductPreferenceEvent,
  type ProductPreferenceEventKind
} from '@markorbit/contracts/daily-workspace';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProductPreferenceError,
  type RecordProductPreferenceEventResult
} from './preference-feedback.js';
import {
  ProductPreferenceTargetError,
  type RecordProductPreferenceEventCommand
} from './preference-target.js';

const TARGET_TYPES: readonly ProductPreferenceEvent['targetType'][] = [
  'DAILY_ORBIT_ITEM',
  'CONTENT_PICK',
  'CONTENT_KIT',
  'PLATFORM_VARIANT',
  'VISUAL_OUTPUT'
];
const CONTEXT_SPOOF_FIELDS = [
  'context',
  'jurisdictions',
  'topics',
  'platforms',
  'professionalRole',
  'organizationType',
  'capabilityVerified',
  'externalActionExecutedByMarkOrbit',
  'externalOutcomeVerifiedByMarkOrbit'
] as const;

type Body = Record<string, unknown>;

export interface ProductPreferenceRecorder {
  record(
    command: Readonly<RecordProductPreferenceEventCommand>
  ): Promise<RecordProductPreferenceEventResult>;
}

export interface ProductPreferenceRouteOptions {
  internalServiceSecret: string;
  service: ProductPreferenceRecorder;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalOf(request: JsonRequest, secret: string) {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let principal;
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

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
}

function targetVersion(value: unknown): number | string {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1)
      throw new HttpError(400, 'INVALID_REQUEST', 'targetVersion must be positive.');
    return value;
  }
  return text(value, 'targetVersion');
}

function kind(value: unknown): ProductPreferenceEventKind {
  const cleaned = text(value, 'kind');
  if (!(productPreferenceEventKinds as readonly string[]).includes(cleaned))
    throw new HttpError(400, 'INVALID_REQUEST', 'kind is not a supported Product preference event.');
  return cleaned as ProductPreferenceEventKind;
}

function targetType(value: unknown): ProductPreferenceEvent['targetType'] {
  const cleaned = text(value, 'targetType');
  if (!(TARGET_TYPES as readonly string[]).includes(cleaned))
    throw new HttpError(400, 'INVALID_REQUEST', 'targetType is not supported.');
  return cleaned as ProductPreferenceEvent['targetType'];
}

function idempotency(request: JsonRequest): string {
  const key = request.headers['idempotency-key'];
  if (!key || !key.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return key.trim();
}

function rejectContextSpoof(body: Readonly<Body>): void {
  if (CONTEXT_SPOOF_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field)))
    throw new HttpError(
      400,
      'PREFERENCE_CONTEXT_SPOOF_REJECTED',
      'Preference context is derived from canonical Lite Product state.'
    );
}

function mapError(error: unknown): never {
  if (error instanceof ProductPreferenceError || error instanceof ProductPreferenceTargetError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createProductPreferenceRoutes(
  options: Readonly<ProductPreferenceRouteOptions>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/product-preference-events',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        rejectContextSpoof(body);
        try {
          return json(
            201,
            await options.service.record({
              workspaceId: principal.workspaceId,
              subjectUserId: principal.userId,
              kind: kind(body.kind),
              targetType: targetType(body.targetType),
              targetId: text(body.targetId, 'targetId'),
              targetVersion: targetVersion(body.targetVersion),
              idempotencyKey: idempotency(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
