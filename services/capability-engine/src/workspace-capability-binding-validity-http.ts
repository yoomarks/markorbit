import { timingSafeEqual } from 'node:crypto';
import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';
import {
  WorkspaceCapabilityBindingValidityServiceError,
  type WorkspaceCapabilityBindingValidityEvaluateResultV1,
  type WorkspaceCapabilityBindingValidityServiceV1
} from './workspace-capability-binding-validity.js';

export interface WorkspaceCapabilityBindingValidityHttpOptionsV1 {
  internalServiceSecret: string;
  validity: Pick<WorkspaceCapabilityBindingValidityServiceV1, 'evaluate'>;
}

function authorized(expected: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(expected) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function httpStatus(result: Readonly<WorkspaceCapabilityBindingValidityEvaluateResultV1>): number {
  if (result.status === 'CURRENT') return 200;
  if (result.status === 'NOT_FOUND') return 404;
  if (result.status === 'DEPENDENCY_UNAVAILABLE') return 503;
  return 409;
}

export function createWorkspaceCapabilityBindingValidityRoutesV1(
  options: Readonly<WorkspaceCapabilityBindingValidityHttpOptionsV1>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/workspace-capability-bindings/validity/evaluate',
      async handle(request) {
        if (
          !authorized(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'INTERNAL_SERVICE_UNAUTHORIZED',
            'Internal service identity is invalid.'
          );
        try {
          const outcome = await options.validity.evaluate(request.body as never);
          return json(httpStatus(outcome), outcome);
        } catch (error) {
          if (error instanceof WorkspaceCapabilityBindingValidityServiceError)
            throw new HttpError(400, error.code, error.message);
          throw error;
        }
      }
    }
  ];
}
