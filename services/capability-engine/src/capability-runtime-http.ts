import {
  CapabilityRuntimeContractError,
  parseCapabilityRequestV2Command
} from '@markorbit/contracts/capability-runtime';
import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';
import {
  GovernedCapabilityRuntimeError,
  type CapabilityRuntimeExecution,
  type GovernedCapabilityRuntime
} from './capability-runtime.js';

export interface CapabilityRuntimeHttpOptionsV2 {
  runtime: Pick<GovernedCapabilityRuntime, 'invoke'>;
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
          const command = parseCapabilityRequestV2Command(request.body);
          const idempotencyKey = request.headers['idempotency-key'];
          if (!idempotencyKey || idempotencyKey !== command.idempotencyKey) {
            throw new HttpError(
              400,
              'INVALID_REQUEST',
              'Idempotency-Key header is required and must match the governed request command.'
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
