import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  CustomerContextContractValidationError,
  customerContextLinkedWorkKinds,
  noCustomerContextAuthorityV1,
  parseCustomerContextIdentityV1,
  parseCustomerContextListV1,
  parseCustomerContextV1,
  type CustomerContextIdentityV1,
  type CustomerContextLinkedWorkKind,
  type CustomerContextLinkedWorkOwner
} from '@markorbit/contracts/customer-context';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { readSessionCookie, type CoreAuthenticationClient } from './auth.js';

export interface GatewayCustomerContextHttpOptions {
  markRegUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
}

const relationshipIdPattern = /^customer-relationship_[A-Za-z0-9_-]+$/u;
const ownerByKind: Readonly<Record<CustomerContextLinkedWorkKind, CustomerContextLinkedWorkOwner>> =
  {
    FORMAL_MATTER: 'MARKREG',
    OPPORTUNITY_CANDIDATE: 'LITE',
    QUALIFICATION_DECISION: 'LITE',
    CONTENT_OPPORTUNITY: 'LITE',
    PREPARED_ACTION: 'LITE',
    PROFESSIONAL_REVIEW: 'EXECUTION',
    EXECUTION_PREPARATION: 'EXECUTION'
  };

type JsonRecord = Record<string, unknown>;

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw malformed(`${field} must be an object.`);
  return value as JsonRecord;
}

function malformed(message: string): HttpError {
  return new HttpError(502, 'MALFORMED_CUSTOMER_CONTEXT_OWNER_RESPONSE', message, true);
}

function token(request: JsonRequest): string {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function workspaceId(request: JsonRequest): string {
  const value = request.headers['x-markorbit-workspace-id'];
  if (!value)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  return value;
}
function mapAuthentication(error: unknown): never {
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
              'PERMISSION_DENIED'
            ].includes(error.code)
          ? 403
          : 401;
  throw new HttpError(status, error.code, error.message, status === 503);
}

async function authenticate(
  request: JsonRequest,
  options: GatewayCustomerContextHttpOptions
): Promise<WorkspacePrincipal> {
  if (!options.authenticationClient)
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.',
      true
    );
  try {
    const principal = await options.authenticationClient.resolveWorkspace(
      token(request),
      workspaceId(request),
      request.headers['x-correlation-id']
    );
    if (!principal.permissions.includes('workspace:read'))
      throw new AuthenticationError('PERMISSION_DENIED', 'workspace:read permission is required.');
    return principal;
  } catch (error) {
    return mapAuthentication(error);
  }
}
function assertListQuery(request: JsonRequest): void {
  const allowed = new Set(['page', 'pageSize', 'status']);
  const unexpected = Object.keys(request.query).filter((key) => !allowed.has(key));
  if (unexpected.length)
    throw new HttpError(400, 'INVALID_REQUEST', `Unsupported query parameter: ${unexpected[0]}.`);
  for (const key of ['page', 'pageSize'] as const) {
    const value = request.query[key];
    if (value === undefined) continue;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || (key === 'pageSize' && parsed > 100))
      throw new HttpError(400, 'INVALID_REQUEST', `${key} is outside the allowed range.`);
  }
  const status = request.query.status;
  if (status !== undefined && status !== 'ACTIVE' && status !== 'ARCHIVED')
    throw new HttpError(400, 'INVALID_REQUEST', 'status is invalid.');
}

function detailId(request: JsonRequest): string {
  const value = request.params.customerRelationshipId;
  if (!value || !relationshipIdPattern.test(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'customerRelationshipId is invalid.');
  return value;
}

function ownerUnavailable(): HttpError {
  return new HttpError(
    503,
    'CUSTOMER_CONTEXT_SOURCE_UNAVAILABLE',
    'Customer Context source is unavailable.',
    true
  );
}
async function ownerGet(
  request: JsonRequest,
  principal: WorkspacePrincipal,
  options: GatewayCustomerContextHttpOptions,
  path: string,
  query: Readonly<Record<string, string>> = {}
): Promise<{ status: number; body: unknown }> {
  if (!options.internalServiceSecret) throw ownerUnavailable();
  const search = new URLSearchParams(query).toString();
  try {
    const response = await fetch(`${options.markRegUrl}${path}${search ? `?${search}` : ''}`, {
      method: 'GET',
      headers: {
        'x-markorbit-internal-authorization': options.internalServiceSecret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
        'x-markorbit-workspace-id': principal.workspaceId,
        ...(request.headers['x-correlation-id']
          ? { 'x-correlation-id': request.headers['x-correlation-id'] }
          : {}),
        ...(request.headers['x-request-id']
          ? { 'x-request-id': request.headers['x-request-id'] }
          : {})
      }
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw malformed('MarkReg returned a non-JSON Customer Relationship response.');
    }
    return { status: response.status, body };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw ownerUnavailable();
  }
}
function mapOwnerStatus(result: { status: number; body: unknown }): void {
  if (result.status === 404)
    throw new HttpError(404, 'CUSTOMER_CONTEXT_NOT_FOUND', 'Customer Context was not found.');
  if (result.status === 503) throw ownerUnavailable();
  if (result.status !== 200)
    throw new HttpError(
      502,
      'CUSTOMER_CONTEXT_OWNER_FAILURE',
      'Customer Context owner returned an unexpected response.',
      result.status >= 500
    );
}

function identityFromOwner(value: unknown, workspace: string): CustomerContextIdentityV1 {
  try {
    return parseCustomerContextIdentityV1(value, workspace);
  } catch (error) {
    if (error instanceof CustomerContextContractValidationError) throw malformed(error.message);
    throw error;
  }
}

function unknownLinkedWork() {
  return customerContextLinkedWorkKinds.map((kind) => ({
    kind,
    owner: ownerByKind[kind],
    availability: {
      state: 'UNKNOWN' as const,
      reasonCode: 'CANONICAL_LINK_NOT_ESTABLISHED' as const,
      references: [] as const
    }
  }));
}
function listFromOwner(value: unknown, workspace: string) {
  const v = record(value, 'MarkReg Customer Relationship list response');
  if (!Array.isArray(v.items))
    throw malformed('MarkReg Customer Relationship items must be an array.');
  try {
    return parseCustomerContextListV1(
      {
        schemaVersion: 1,
        workspaceId: workspace,
        page: v.page,
        pageSize: v.pageSize,
        total: v.total,
        items: v.items.map((item) => identityFromOwner(item, workspace)),
        authorityConsequences: noCustomerContextAuthorityV1
      },
      workspace
    );
  } catch (error) {
    if (error instanceof CustomerContextContractValidationError) throw malformed(error.message);
    throw error;
  }
}

function detailFromOwner(value: unknown, workspace: string) {
  const v = record(value, 'MarkReg Customer Relationship detail response');
  const customerRelationship = identityFromOwner(v.customerRelationship, workspace);
  try {
    return parseCustomerContextV1(
      {
        schemaVersion: 1,
        workspaceId: workspace,
        customerRelationship,
        linkedWork: unknownLinkedWork(),
        authorityConsequences: noCustomerContextAuthorityV1
      },
      workspace
    );
  } catch (error) {
    if (error instanceof CustomerContextContractValidationError) throw malformed(error.message);
    throw error;
  }
}
export function createGatewayCustomerContextRoutes(
  options: GatewayCustomerContextHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/api/customer-contexts',
      handle: async (request) => {
        assertListQuery(request);
        const principal = await authenticate(request, options);
        const result = await ownerGet(
          request,
          principal,
          options,
          '/internal/v1/customer-relationships',
          request.query
        );
        mapOwnerStatus(result);
        return json(200, { customerContexts: listFromOwner(result.body, principal.workspaceId) });
      }
    },
    {
      method: 'GET',
      path: '/api/customer-contexts/:customerRelationshipId',
      handle: async (request) => {
        const relationshipId = detailId(request);
        const principal = await authenticate(request, options);
        const result = await ownerGet(
          request,
          principal,
          options,
          `/internal/v1/customer-relationships/${encodeURIComponent(relationshipId)}`
        );
        mapOwnerStatus(result);
        return json(200, { customerContext: detailFromOwner(result.body, principal.workspaceId) });
      }
    }
  ];
}
