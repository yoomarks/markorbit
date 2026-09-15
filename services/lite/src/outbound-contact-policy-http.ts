import { timingSafeEqual } from 'node:crypto';
import {
  parseInternalWorkspacePrincipal,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  OutboundContactBasisAssertionIdV1,
  OutboundContactBasisStateV1,
  OutboundContactPolicyReferenceV1,
  OutboundContactPurposeV1,
  OutboundContactSuppressionIdV1,
  OutboundContactSuppressionReasonV1,
  OutboundContactSuppressionScopeV1,
  OutboundContactSuppressionSourceClassV1,
  OutboundContactTargetReferenceV1
} from '@markorbit/contracts/outbound-contact-policy';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  OutboundContactPolicyRuntimeError,
  type PostgresOutboundContactPolicyStore
} from './outbound-contact-policy.js';

type Body = Record<string, unknown>;
type Store = Pick<
  PostgresOutboundContactPolicyStore,
  | 'assertBasis'
  | 'revokeBasis'
  | 'supersedeBasis'
  | 'setSuppression'
  | 'clearSuppression'
  | 'evaluate'
>;
function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const a = Buffer.from(configured),
    b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
function principalOf(
  request: JsonRequest,
  secret: string,
  permission: Permission
): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let p: WorkspacePrincipal;
  try {
    p = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
  const w = request.headers['x-markorbit-workspace-id'];
  if (!w || w.toLowerCase() !== p.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped policy was not found.');
  if (!p.permissions.includes(permission))
    throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
  return p;
}
function bodyOf(r: JsonRequest): Body {
  if (!r.body || typeof r.body !== 'object' || Array.isArray(r.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return r.body as Body;
}
const serverFields = [
  'workspaceId',
  'actorPrincipalId',
  'assertedByPrincipalId',
  'recordedByPrincipalId',
  'assertionId',
  'suppressionId',
  'version',
  'status',
  'authorityConsequences',
  'legalConsentVerifiedByMarkOrbit',
  'externalSendAuthorized',
  'externalMessageSent',
  'protectedActionAuthorized',
  'readinessFingerprintSha256',
  'evaluatedAt'
] as const;
function exact(b: Body, allowed: readonly string[]) {
  if (serverFields.some((f) => Object.hasOwn(b, f)))
    throw new HttpError(
      400,
      'OWNER_FIELD_SPOOF_REJECTED',
      'Workspace, actor, lifecycle and authority fields are server-owned.'
    );
  if (Object.keys(b).some((f) => !allowed.includes(f)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
}
function idempotency(r: JsonRequest): string {
  const x = r.headers['idempotency-key']?.trim();
  if (!x) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return x;
}
function text(v: unknown, f: string): string {
  if (typeof v !== 'string' || !v.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${f} must be a non-empty string.`);
  return v.trim();
}
function positive(v: unknown, f: string): number {
  if (!Number.isSafeInteger(v) || Number(v) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${f} must be a positive integer.`);
  return Number(v);
}
function object<T>(v: unknown, f: string): T {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new HttpError(400, 'INVALID_REQUEST', `${f} must be an object.`);
  return v as T;
}
function array(v: unknown, f: string): readonly string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))
    throw new HttpError(400, 'INVALID_REQUEST', `${f} must be a string array.`);
  return v as string[];
}
function noQuery(r: JsonRequest) {
  if (Object.keys(r.query).length)
    throw new HttpError(400, 'INVALID_REQUEST', 'This operation accepts no query parameters.');
}
function map(error: unknown): never {
  if (error instanceof OutboundContactPolicyRuntimeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}
export function createOutboundContactPolicyRoutes(options: {
  internalServiceSecret: string;
  store: Store;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/outbound-contact-policy/basis-assertions',
      handle: async (r) => {
        const p = principalOf(r, options.internalServiceSecret, 'workspace:manage');
        noQuery(r);
        const b = bodyOf(r);
        exact(b, [
          'targetRef',
          'endpointFingerprintSha256',
          'purpose',
          'marketOrJurisdiction',
          'policyRef',
          'basisState',
          'evidenceRefs'
        ]);
        try {
          return json(
            201,
            await options.store.assertBasis({
              workspaceId: p.workspaceId,
              actorPrincipalId: p.userId,
              idempotencyKey: idempotency(r),
              targetRef: object<OutboundContactTargetReferenceV1>(b.targetRef, 'targetRef'),
              endpointFingerprintSha256: text(
                b.endpointFingerprintSha256,
                'endpointFingerprintSha256'
              ),
              purpose: text(b.purpose, 'purpose') as OutboundContactPurposeV1,
              ...(b.marketOrJurisdiction === undefined
                ? {}
                : { marketOrJurisdiction: text(b.marketOrJurisdiction, 'marketOrJurisdiction') }),
              policyRef: object<OutboundContactPolicyReferenceV1>(b.policyRef, 'policyRef'),
              basisState: text(b.basisState, 'basisState') as OutboundContactBasisStateV1,
              evidenceRefs: array(b.evidenceRefs, 'evidenceRefs')
            })
          );
        } catch (e) {
          return map(e);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/outbound-contact-policy/basis-assertions/:assertionId/revoke',
      handle: async (r) => basisLifecycle(r, options, 'revokeBasis')
    },
    {
      method: 'POST',
      path: '/v1/outbound-contact-policy/basis-assertions/:assertionId/supersede',
      handle: async (r) => basisLifecycle(r, options, 'supersedeBasis')
    },
    {
      method: 'POST',
      path: '/v1/outbound-contact-policy/suppressions',
      handle: async (r) => {
        const p = principalOf(r, options.internalServiceSecret, 'workspace:manage');
        noQuery(r);
        const b = bodyOf(r);
        exact(b, [
          'endpointFingerprintSha256',
          'scope',
          'reasonCode',
          'sourceClass',
          'evidenceRefs',
          'effectiveAt'
        ]);
        try {
          return json(
            201,
            await options.store.setSuppression({
              workspaceId: p.workspaceId,
              actorPrincipalId: p.userId,
              idempotencyKey: idempotency(r),
              endpointFingerprintSha256: text(
                b.endpointFingerprintSha256,
                'endpointFingerprintSha256'
              ),
              scope: text(b.scope, 'scope') as OutboundContactSuppressionScopeV1,
              reasonCode: text(b.reasonCode, 'reasonCode') as OutboundContactSuppressionReasonV1,
              sourceClass: text(
                b.sourceClass,
                'sourceClass'
              ) as OutboundContactSuppressionSourceClassV1,
              evidenceRefs: array(b.evidenceRefs, 'evidenceRefs'),
              ...(b.effectiveAt === undefined
                ? {}
                : { effectiveAt: text(b.effectiveAt, 'effectiveAt') })
            })
          );
        } catch (e) {
          return map(e);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/outbound-contact-policy/suppressions/:suppressionId/clear',
      handle: async (r) => {
        const p = principalOf(r, options.internalServiceSecret, 'workspace:manage');
        noQuery(r);
        const b = bodyOf(r);
        exact(b, ['expectedVersion', 'sourceClass', 'evidenceRefs', 'effectiveAt']);
        try {
          return json(
            200,
            await options.store.clearSuppression({
              workspaceId: p.workspaceId,
              actorPrincipalId: p.userId,
              idempotencyKey: idempotency(r),
              suppressionId: text(
                r.params.suppressionId,
                'suppressionId'
              ) as OutboundContactSuppressionIdV1,
              expectedVersion: positive(b.expectedVersion, 'expectedVersion'),
              sourceClass: text(
                b.sourceClass,
                'sourceClass'
              ) as OutboundContactSuppressionSourceClassV1,
              evidenceRefs: array(b.evidenceRefs, 'evidenceRefs'),
              ...(b.effectiveAt === undefined
                ? {}
                : { effectiveAt: text(b.effectiveAt, 'effectiveAt') })
            })
          );
        } catch (e) {
          return map(e);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/outbound-contact-policy/readiness/evaluate',
      handle: async (r) => {
        const p = principalOf(r, options.internalServiceSecret, 'workspace:read');
        noQuery(r);
        const b = bodyOf(r);
        exact(b, [
          'targetRef',
          'endpointFingerprintSha256',
          'purpose',
          'policyRef',
          'reviewedSendFingerprintSha256'
        ]);
        try {
          return json(
            200,
            await options.store.evaluate({
              workspaceId: p.workspaceId,
              actorPrincipalId: p.userId,
              targetRef: object<OutboundContactTargetReferenceV1>(b.targetRef, 'targetRef'),
              endpointFingerprintSha256: text(
                b.endpointFingerprintSha256,
                'endpointFingerprintSha256'
              ),
              purpose: text(b.purpose, 'purpose') as OutboundContactPurposeV1,
              policyRef: object<OutboundContactPolicyReferenceV1>(b.policyRef, 'policyRef'),
              reviewedSendFingerprintSha256: text(
                b.reviewedSendFingerprintSha256,
                'reviewedSendFingerprintSha256'
              )
            })
          );
        } catch (e) {
          return map(e);
        }
      }
    }
  ];
}
async function basisLifecycle(
  r: JsonRequest,
  options: { internalServiceSecret: string; store: Store },
  operation: 'revokeBasis' | 'supersedeBasis'
) {
  const p = principalOf(r, options.internalServiceSecret, 'workspace:manage');
  noQuery(r);
  const b = bodyOf(r);
  exact(b, ['expectedVersion']);
  try {
    return json(
      200,
      await options.store[operation]({
        workspaceId: p.workspaceId,
        actorPrincipalId: p.userId,
        idempotencyKey: idempotency(r),
        assertionId: text(r.params.assertionId, 'assertionId') as OutboundContactBasisAssertionIdV1,
        expectedVersion: positive(b.expectedVersion, 'expectedVersion')
      })
    );
  } catch (e) {
    return map(e);
  }
}
