import { timingSafeEqual } from 'node:crypto';
import type { WorkspaceCapabilityBindingId } from '@markorbit/contracts/workspace-capability-binding';
import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';
import {
  WorkspaceCapabilityBindingStoreError,
  type WorkspaceCapabilityBindingRepositoryV1
} from './workspace-capability-binding-store.js';
import {
  WorkspaceCapabilityBindingServiceError,
  type WorkspaceCapabilityBindingServiceV1,
  type WorkspaceCapabilityBindResultV1
} from './workspace-capability-binding.js';

const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const BINDING_ID = /^workspace-capability-binding_[0-9a-f]{64}$/u;

export interface WorkspaceCapabilityBindingHttpOptionsV1 {
  internalServiceSecret: string;
  binding: Pick<WorkspaceCapabilityBindingServiceV1, 'bind'>;
  repository: Pick<WorkspaceCapabilityBindingRepositoryV1, 'find'>;
}

function authorized(expected: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(expected) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
function bindStatus(result: Readonly<WorkspaceCapabilityBindResultV1>): number {
  if (result.status === 'BOUND') return 200;
  if (result.status === 'DEPENDENCY_UNAVAILABLE') return 503;
  return 409;
}

function readReference(value: unknown): {
  workspaceId: string;
  bindingId: WorkspaceCapabilityBindingId;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_INPUT', 'Binding read reference must be an object.');
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== 'bindingId' ||
    keys[1] !== 'workspaceId' ||
    typeof input.workspaceId !== 'string' ||
    input.workspaceId.trim() !== input.workspaceId ||
    !WORKSPACE_UUID.test(input.workspaceId) ||
    typeof input.bindingId !== 'string' ||
    !BINDING_ID.test(input.bindingId)
  )
    throw new HttpError(
      400,
      'INVALID_INPUT',
      'Only canonical Workspace binding references are accepted.'
    );
  return {
    workspaceId: input.workspaceId.toLowerCase(),
    bindingId: input.bindingId as WorkspaceCapabilityBindingId
  };
}
function requireAuthorization(
  options: Readonly<WorkspaceCapabilityBindingHttpOptionsV1>,
  supplied?: string
) {
  if (!authorized(options.internalServiceSecret, supplied))
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );
}

export function createWorkspaceCapabilityBindingRoutesV1(
  options: Readonly<WorkspaceCapabilityBindingHttpOptionsV1>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/workspace-capability-bindings/bind',
      async handle(request) {
        requireAuthorization(options, request.headers['x-markorbit-internal-authorization']);
        try {
          const outcome = await options.binding.bind(request.body as never);
          return json(bindStatus(outcome), outcome);
        } catch (error) {
          if (error instanceof WorkspaceCapabilityBindingServiceError)
            throw new HttpError(400, error.code, error.message);
          throw error;
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/workspace-capability-bindings/read',
      async handle(request) {
        requireAuthorization(options, request.headers['x-markorbit-internal-authorization']);
        const reference = readReference(request.body);
        try {
          const binding = await options.repository.find(reference.workspaceId, reference.bindingId);
          if (!binding)
            return json(404, {
              code: 'WORKSPACE_CAPABILITY_BINDING_NOT_FOUND',
              message: 'Workspace Capability binding was not found.'
            });
          return json(200, binding);
        } catch (error) {
          if (error instanceof WorkspaceCapabilityBindingStoreError) {
            if (
              error.code === 'PERSISTENCE_INTEGRITY_FAILURE' ||
              error.code === 'IDENTITY_CONFLICT' ||
              error.code === 'INVALID_INPUT'
            )
              throw new HttpError(409, error.code, error.message);
            throw new HttpError(503, error.code, error.message);
          }
          throw error;
        }
      }
    }
  ];
}
