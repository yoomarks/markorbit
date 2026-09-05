import { createHash } from 'node:crypto';
import {
  AuthenticationError,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, type JsonRequest } from '@markorbit/service-kit';
import {
  GovernedHumanActionReceiptClientError,
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  WORKSPACE_HEADER_NAME,
  type CoreAuthenticationClient,
  type GovernedHumanActionReceiptKind,
  type GovernedHumanActionReceiptMaterializationV1
} from './auth.js';

export type GovernedMutationIdempotency = 'REQUIRED' | 'OPTIONAL';

export interface GovernedWorkspaceMutationPolicy {
  permission: Permission | readonly Permission[];
  workspaceHeaderName?: string;
  workspaceContextError?: Readonly<{ code: string; message: string }>;
  idempotency: GovernedMutationIdempotency;
  idempotencyError?: Readonly<{ code: string; message: string }>;
  bodyIdempotency?: 'IGNORE' | 'MATCH_IF_PRESENT';
  forbiddenBodyFields?: readonly string[];
  forbiddenHeaders?: readonly string[];
  browserAuthorityError?: Readonly<{
    code: string;
    message: (field: string) => string;
  }>;
  bindTrustedWorkspaceField?: string;
  humanAction?: GovernedHumanActionReceiptKind;
}

export interface GovernedWorkspaceMutationOptions {
  authenticationClient?: CoreAuthenticationClient | undefined;
  csrfSecret: string;
  allowedOrigins: readonly string[];
}

export interface GovernedWorkspaceMutationContext {
  principal: WorkspacePrincipal;
  body: Readonly<Record<string, unknown>>;
  idempotencyKey?: string;
  humanActionEnvelope?: string;
}

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  const body = request.body ?? {};
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return body as Record<string, unknown>;
}

function requestToken(request: JsonRequest): string {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function mapAuthentication(error: unknown): never {
  if (error instanceof HttpError) throw error;
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
}

function rejectBrowserAuthority(
  request: JsonRequest,
  body: Readonly<Record<string, unknown>>,
  policy: GovernedWorkspaceMutationPolicy
): void {
  const bodyField = policy.forbiddenBodyFields?.find((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
  const headerField = policy.forbiddenHeaders?.find(
    (field) => request.headers[field] !== undefined
  );
  const field = bodyField ?? headerField;
  if (!field) return;
  const error = policy.browserAuthorityError ?? {
    code: 'BROWSER_AUTHORITY_FORBIDDEN',
    message: (value: string) => `${value} is trusted authority context and cannot be supplied.`
  };
  throw new HttpError(400, error.code, error.message(field));
}

function requirePermission(
  principal: WorkspacePrincipal,
  requested: Permission | readonly Permission[]
): void {
  const accepted = typeof requested === 'string' ? [requested] : requested;
  if (!accepted.some((permission) => principal.permissions.includes(permission)))
    throw new AuthenticationError(
      'PERMISSION_DENIED',
      `${accepted.join(' or ')} permission is required.`
    );
}

function idempotencyKey(
  request: JsonRequest,
  body: Readonly<Record<string, unknown>>,
  policy: GovernedWorkspaceMutationPolicy
): string | undefined {
  const raw = request.headers['idempotency-key'];
  const key = raw?.trim();
  if (policy.idempotency === 'REQUIRED' && !key) {
    const error = policy.idempotencyError ?? {
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Idempotency-Key is required for this governed mutation.'
    };
    throw new HttpError(400, error.code, error.message);
  }
  if (
    key &&
    policy.bodyIdempotency === 'MATCH_IF_PRESENT' &&
    body.idempotencyKey !== undefined &&
    body.idempotencyKey !== key
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Request idempotencyKey must match Idempotency-Key header.'
    );
  return key;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

async function humanActionEnvelope(
  request: JsonRequest,
  principal: WorkspacePrincipal,
  kind: GovernedHumanActionReceiptKind,
  authentication: CoreAuthenticationClient,
  key: string,
  correlationId?: string
): Promise<string> {
  const authenticatedAt = principal.sessionCreatedAt;
  if (!authenticatedAt || !Number.isFinite(Date.parse(authenticatedAt)))
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core session authentication time is unavailable for governed human action.',
      true
    );
  if (!authentication.materializeGovernedHumanActionReceipt)
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core governed human-action receipt authority is unavailable.',
      true
    );

  const principalReference = `core-workspace-principal:${fingerprint({
    kind: principal.kind,
    workspaceId: principal.workspaceId.toLowerCase(),
    userId: principal.userId,
    membershipId: principal.membershipId,
    role: principal.role,
    permissions: [...principal.permissions].sort(),
    sessionCreatedAt: authenticatedAt,
    sessionExpiresAt: principal.sessionExpiresAt
  })}`;
  const reviewedActionDigest = fingerprint({
    kind,
    principalReference,
    method: request.method,
    path: request.path,
    body: request.body ?? {}
  });
  const materialization: GovernedHumanActionReceiptMaterializationV1 = {
    workspaceId: principal.workspaceId,
    userId: principal.userId,
    membershipId: principal.membershipId,
    principalReference,
    kind,
    mutationRoute: request.path,
    reviewedActionDigest,
    idempotencyKey: key,
    authenticatedAt
  };

  let receipt;
  try {
    receipt = await authentication.materializeGovernedHumanActionReceipt(
      materialization,
      correlationId
    );
  } catch (error) {
    if (!(error instanceof GovernedHumanActionReceiptClientError)) throw error;
    throw new HttpError(error.status, error.code, error.message, error.status === 503);
  }

  if (
    receipt.schemaVersion !== 1 ||
    receipt.source !== 'CORE' ||
    receipt.actorKind !== 'HUMAN_USER' ||
    receipt.kind !== materialization.kind ||
    receipt.workspaceId !== materialization.workspaceId ||
    receipt.userId !== materialization.userId ||
    receipt.membershipId !== materialization.membershipId ||
    receipt.principalReference !== materialization.principalReference ||
    receipt.mutationRoute !== materialization.mutationRoute ||
    receipt.reviewedActionDigest !== materialization.reviewedActionDigest ||
    receipt.idempotencyKey !== materialization.idempotencyKey ||
    receipt.authenticatedAt !== materialization.authenticatedAt ||
    receipt.authorityVersion !== 1 ||
    !receipt.authorityReference.startsWith('core-governed-human-action-receipt:') ||
    !receipt.affirmativeHumanActionEvidenceReference.startsWith(
      'core-governed-human-action-evidence:'
    )
  )
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core governed human-action receipt did not match the trusted action context.',
      true
    );

  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      kind,
      actorKind: receipt.actorKind,
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      principalReference,
      authorityReference: receipt.authorityReference,
      authorityVersion: receipt.authorityVersion,
      authenticatedAt,
      affirmativeHumanActionEvidenceReference: receipt.affirmativeHumanActionEvidenceReference,
      payloadIdentityAuthoritative: false
    }),
    'utf8'
  ).toString('base64url');
}

export async function authorizeGovernedWorkspaceMutation(
  request: JsonRequest,
  options: GovernedWorkspaceMutationOptions,
  policy: GovernedWorkspaceMutationPolicy
): Promise<GovernedWorkspaceMutationContext> {
  const authentication = options.authenticationClient;
  if (!authentication)
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.',
      true
    );

  const rawBody = bodyRecord(request);
  rejectBrowserAuthority(request, rawBody, policy);
  const workspaceHeader = policy.workspaceHeaderName ?? WORKSPACE_HEADER_NAME;
  const workspaceId = request.headers[workspaceHeader];
  if (!workspaceId) {
    const error = policy.workspaceContextError ?? {
      code: 'INVALID_WORKSPACE_CONTEXT',
      message: 'Workspace context is required.'
    };
    throw new HttpError(400, error.code, error.message);
  }

  try {
    const principal = await authentication.resolveWorkspace(
      requestToken(request),
      workspaceId,
      request.headers['x-correlation-id']
    );
    requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
    validateCsrf(
      principal.sessionId,
      options.csrfSecret,
      request.headers['x-markorbit-csrf-token']
    );
    requirePermission(principal, policy.permission);
    const key = idempotencyKey(request, rawBody, policy);
    if (policy.humanAction && !key)
      throw new HttpError(
        500,
        'INVALID_GOVERNED_ACTION_POLICY',
        'Governed human actions require exact idempotency.'
      );

    const body = policy.bindTrustedWorkspaceField
      ? { ...rawBody, [policy.bindTrustedWorkspaceField]: principal.workspaceId }
      : { ...rawBody };
    const envelope = policy.humanAction
      ? await humanActionEnvelope(
          request,
          principal,
          policy.humanAction,
          authentication,
          key!,
          request.headers['x-correlation-id']
        )
      : undefined;

    return {
      principal,
      body,
      ...(key ? { idempotencyKey: key } : {}),
      ...(envelope ? { humanActionEnvelope: envelope } : {})
    };
  } catch (error) {
    return mapAuthentication(error);
  }
}