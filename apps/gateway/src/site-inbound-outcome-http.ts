import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  ProductionIntakeV1,
  ProductionQuoteV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { BusinessAttributionReferenceV1 } from '@markorbit/contracts/business-attribution';
import type { FormalMatter } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  type CoreAuthenticationClient
} from './auth.js';

export interface GatewaySiteInboundOutcomeOptionsV1 {
  markRegUrl: string;
  liteUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Body = { intakeId: string; quoteId: string; orderId: string };
type OrderProjection = {
  orderId: string;
  version: number;
  updatedAt: string;
  source: {
    quoteId: string;
    quoteVersion: string;
    customerConfirmationId: string;
    customerConfirmationVersion: number;
    snapshotSha256: string;
  };
  matter?: { formalMatterId: string; formalMatterVersion: number };
};

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  }
  const body = request.body as Record<string, unknown>;
  const allowed = ['intakeId', 'quoteId', 'orderId'];
  if (Object.keys(body).some((field) => !allowed.includes(field))) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
  }
  const text = (value: unknown, field: string) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 300) {
      throw new HttpError(400, 'INVALID_REQUEST', `${field} is invalid.`);
    }
    return value.trim();
  };
  return {
    intakeId: text(body.intakeId, 'intakeId'),
    quoteId: text(body.quoteId, 'quoteId'),
    orderId: text(body.orderId, 'orderId')
  };
}

function mapAuthentication(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status = error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE' ? 503 : 403;
  throw new HttpError(status, error.code, error.message, status === 503);
}

async function principal(
  request: JsonRequest,
  options: GatewaySiteInboundOutcomeOptionsV1
): Promise<WorkspacePrincipal> {
  const token = readSessionCookie(request.headers.cookie);
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!token) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  if (!workspaceId)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  if (!options.authenticationClient)
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication is unavailable.',
      true
    );
  try {
    const value = await options.authenticationClient.resolveWorkspace(
      token,
      workspaceId,
      request.headers['x-correlation-id']
    );
    requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
    validateCsrf(value.sessionId, options.csrfSecret, request.headers['x-markorbit-csrf-token']);
    if (!value.permissions.includes('workspace:manage')) {
      throw new AuthenticationError(
        'PERMISSION_DENIED',
        'workspace:manage permission is required.'
      );
    }
    return value;
  } catch (error) {
    return mapAuthentication(error);
  }
}

function configured(options: GatewaySiteInboundOutcomeOptionsV1) {
  const secret = options.internalServiceSecret?.trim();
  if (!secret)
    throw new HttpError(
      503,
      'ATTRIBUTION_RUNTIME_UNAVAILABLE',
      'Attribution runtime is unavailable.',
      true
    );
  return {
    secret,
    fetchImpl: options.fetchImpl ?? fetch,
    timeout: options.timeoutMs ?? 3_000,
    markRegUrl: options.markRegUrl.replace(/\/$/u, ''),
    liteUrl: options.liteUrl.replace(/\/$/u, '')
  };
}

function internalHeaders(
  request: JsonRequest,
  actor: WorkspacePrincipal,
  secret: string
): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(actor),
    'x-markorbit-workspace-id': actor.workspaceId,
    ...(request.headers['x-correlation-id']
      ? { 'x-correlation-id': request.headers['x-correlation-id'] }
      : {})
  };
}

async function ownerGet<T>(
  target: ReturnType<typeof configured>,
  request: JsonRequest,
  actor: WorkspacePrincipal,
  path: string
): Promise<T> {
  const response = await target.fetchImpl(`${target.markRegUrl}${path}`, {
    headers: internalHeaders(request, actor, target.secret),
    signal: AbortSignal.timeout(target.timeout)
  });
  if (!response.ok) {
    throw new HttpError(
      response.status,
      'DOWNSTREAM_OWNER_REJECTED',
      'MarkReg owner truth could not validate this attribution outcome.',
      response.status >= 500
    );
  }
  return (await response.json()) as T;
}

function reference(
  owner: string,
  kind: string,
  id: string,
  version: number | string,
  fingerprintSha256: string,
  observedAt: string
): BusinessAttributionReferenceV1 {
  return { owner, kind, id, version, fingerprintSha256, observedAt };
}

export function createGatewaySiteInboundOutcomeRoutesV1(
  options: GatewaySiteInboundOutcomeOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/api/site/markreg/formal-matters/:formalMatterId/attribution',
      async handle(request) {
        const key = request.headers['idempotency-key']?.trim();
        if (!key)
          throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
        const input = bodyOf(request);
        const actor = await principal(request, options);
        const target = configured(options);
        try {
          const [intakeEnvelope, quoteEnvelope, matterEnvelope, order] = await Promise.all([
            ownerGet<{ intake: ProductionIntakeV1 }>(
              target,
              request,
              actor,
              `/internal/v1/production-intakes/${encodeURIComponent(input.intakeId)}`
            ),
            ownerGet<{ quote: ProductionQuoteV1 }>(
              target,
              request,
              actor,
              `/internal/v1/production-quotes/${encodeURIComponent(input.quoteId)}`
            ),
            ownerGet<{ formalMatter: FormalMatter }>(
              target,
              request,
              actor,
              `/v1/formal-matters/${encodeURIComponent(request.params.formalMatterId!)}`
            ),
            ownerGet<OrderProjection>(
              target,
              request,
              actor,
              `/v1/orders/${encodeURIComponent(input.orderId)}`
            )
          ]);
          const intake = intakeEnvelope.intake;
          const quote = quoteEnvelope.quote;
          const matter = matterEnvelope.formalMatter;
          if (!intake.siteSource) {
            throw new HttpError(
              409,
              'SITE_LINEAGE_REQUIRED',
              'Production Intake has no Site lineage.'
            );
          }
          if (
            intake.workspaceId !== actor.workspaceId ||
            quote.workspaceId !== actor.workspaceId ||
            matter.workspaceId !== actor.workspaceId ||
            quote.intake.id !== intake.intakeId ||
            quote.intake.version !== intake.version ||
            quote.intake.fingerprintSha256 !== intake.fingerprintSha256 ||
            matter.sourceQuoteId !== quote.quoteId ||
            matter.sourceQuoteVersion !== String(quote.version)
          ) {
            throw new HttpError(
              409,
              'ATTRIBUTION_LINEAGE_MISMATCH',
              'Exact MarkReg lineage does not match.'
            );
          }
          if (
            order.source.quoteId !== quote.quoteId ||
            order.source.quoteVersion !== String(quote.version) ||
            order.matter?.formalMatterId !== matter.formalMatterId ||
            order.matter.formalMatterVersion !== matter.version
          ) {
            throw new HttpError(
              409,
              'ATTRIBUTION_LINEAGE_MISMATCH',
              'Exact Order lineage does not match.'
            );
          }
          const source = intake.siteSource;
          const acquisition = source.acquisition;
          const sourceRefs: BusinessAttributionReferenceV1[] = [
            reference(
              'SITE',
              'SITE_REQUEST_CONTEXT',
              source.siteId,
              source.configurationVersion,
              source.fingerprintSha256,
              source.observedAt
            ),
            reference(
              'SITE',
              'SITE_INBOUND_ACQUISITION',
              `${source.siteId}|${acquisition.source ?? acquisition.referrerHostname ?? acquisition.attributionState}`,
              1,
              acquisition.fingerprintSha256,
              acquisition.observedAt
            ),
            ...(acquisition.contentRef
              ? [
                  reference(
                    acquisition.contentRef.owner,
                    acquisition.contentRef.kind,
                    acquisition.contentRef.id,
                    acquisition.contentRef.version,
                    acquisition.contentRef.fingerprintSha256,
                    acquisition.observedAt
                  )
                ]
              : [])
          ];
          const touchpointRefs = [
            reference(
              'MARKREG',
              'PRODUCTION_INTAKE',
              intake.intakeId,
              intake.version,
              intake.fingerprintSha256,
              intake.updatedAt
            ),
            reference(
              'MARKREG',
              'PRODUCTION_QUOTE',
              quote.quoteId,
              quote.version,
              quote.fingerprintSha256,
              quote.createdAt
            ),
            reference(
              'MARKREG',
              'ORDER',
              order.orderId,
              order.version,
              order.source.snapshotSha256,
              order.updatedAt
            ),
            reference(
              'MARKREG',
              'CUSTOMER_CONFIRMATION',
              order.source.customerConfirmationId,
              order.source.customerConfirmationVersion,
              order.source.snapshotSha256,
              order.updatedAt
            )
          ];
          const response = await target.fetchImpl(
            `${target.liteUrl}/v1/business-attribution-links`,
            {
              method: 'POST',
              headers: {
                ...internalHeaders(request, actor, target.secret),
                'idempotency-key': key
              },
              body: JSON.stringify({
                motionKind: 'SITE_INBOUND',
                sourceRefs,
                touchpointRefs,
                downstreamRef: reference(
                  'MARKREG',
                  'FORMAL_MATTER',
                  matter.formalMatterId,
                  matter.version,
                  matter.snapshotSha256,
                  matter.updatedAt
                ),
                attributionState: acquisition.attributionState,
                evidenceBasis: 'EXACT_LINEAGE',
                evaluatedAt: matter.updatedAt
              }),
              signal: AbortSignal.timeout(target.timeout)
            }
          );
          return json(response.status, await response.json());
        } catch (error) {
          if (error instanceof HttpError) throw error;
          throw new HttpError(
            503,
            'ATTRIBUTION_RUNTIME_UNAVAILABLE',
            'Attribution runtime is unavailable.',
            true
          );
        }
      }
    }
  ];
}
