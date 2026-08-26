import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  CapabilityRuntimeContractError,
  parseCapabilityRequestV2Command,
  type TrustedCapabilityCallerContext
} from '@markorbit/contracts/capability-runtime';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  GovernedCapabilityRuntimeError,
  type CapabilityRuntimeExecution,
  type GovernedCapabilityRuntime
} from './capability-runtime.js';

export interface CapabilityRuntimeHttpOptionsV2 {
  runtime: Pick<GovernedCapabilityRuntime, 'invoke'>;
  internalServiceSecret: string;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32) {
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorize(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization'])) {
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  }

  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw new HttpError(401, 'UNTRUSTED_INTERNAL_CALLER', error.message);
    }
    throw error;
  }

  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId !== principal.workspaceId) {
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_CONTEXT',
      'Trusted Workspace Principal and workspace header must match.'
    );
  }
  if (!principal.permissions.includes('workspace:read')) {
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.');
  }
  return principal;
}

function callerProduct(request: JsonRequest): string {
  const value = request.headers['x-markorbit-caller-product']?.trim();
  if (!value || !/^[A-Z][A-Z0-9_-]{1,63}$/.test(value)) {
    throw new HttpError(
      400,
      'INVALID_CALLER_PRODUCT',
      'Trusted caller product context is required.'
    );
  }
  return value;
}

function trustedCaller(
  principal: WorkspacePrincipal,
  product: string
): TrustedCapabilityCallerContext {
  return {
    workspaceId: principal.workspaceId,
    principalId: principal.userId,
    callerProduct: product,
    permissionContextRef: `core-workspace-membership:${principal.membershipId}`
  };
}

function assertTrustedCaller(
  supplied: Readonly<TrustedCapabilityCallerContext>,
  expected: Readonly<TrustedCapabilityCallerContext>
): void {
  if (
    supplied.workspaceId !== expected.workspaceId ||
    supplied.principalId !== expected.principalId ||
    supplied.callerProduct !== expected.callerProduct ||
    supplied.permissionContextRef !== expected.permissionContextRef ||
    supplied.entitlementContextRef !== undefined
  ) {
    throw new HttpError(
      400,
      'SUBJECT_SPOOF_REJECTED',
      'Capability caller identity must match the trusted internal Workspace Principal.'
    );
  }
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof CapabilityRuntimeContractError) {
    return new HttpError(400, 'INVALID_REQUEST', error.message);
  }
  if (error instanceof GovernedCapabilityRuntimeError) {
    return new HttpError(error.status, error.code, error.message);
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'code' in error &&
    typeof error.status === 'number' &&
    typeof error.code === 'string'
  ) {
    return new HttpError(
      error.status,
      error.code,
      error instanceof Error ? error.message : 'Governed Capability dependency failed.'
    );
  }
  return new HttpError(500, 'INTERNAL_ERROR', 'Governed Capability invocation failed.');
}

export function createCapabilityRuntimeRoutesV2(
  options: CapabilityRuntimeHttpOptionsV2
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/capability-requests',
      async handle(request) {
        try {
          const principal = authorize(request, options.internalServiceSecret);
          const product = callerProduct(request);
          const command = parseCapabilityRequestV2Command(request.body);
          assertTrustedCaller(command.caller, trustedCaller(principal, product));

          const idempotencyKey = request.headers['idempotency-key'];
          if (!idempotencyKey || idempotencyKey !== command.idempotencyKey) {
            throw new HttpError(
              400,
              'INVALID_REQUEST',
              'Idempotency-Key header is required and must match the governed request command.'
            );
          }
          const correlationId = request.headers['x-correlation-id']?.trim();
          if (correlationId && correlationId !== command.correlationId) {
            throw new HttpError(
              400,
              'INVALID_REQUEST',
              'X-Correlation-Id must match the governed request command when supplied.'
            );
          }

          const execution: CapabilityRuntimeExecution = await options.runtime.invoke(command);
          return json(execution.replayed ? 200 : 201, execution);
        } catch (error) {
          throw toHttpError(error);
        }
      }
    }
  ];
}
