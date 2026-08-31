import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  MethodImprovementAdmissionError,
  type MethodImprovementAdmissionServiceV1
} from './method-improvement.js';

export interface MethodImprovementHttpOptionsV1 {
  internalServiceSecret: string;
  service: Pick<MethodImprovementAdmissionServiceV1, 'admit'>;
}

const PHASE7_PILOT_A_PREDECESSOR = Object.freeze({
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodRef: 'brain-method:method_cn-duration',
  methodVersionRef: 'brain-method-version:method-version_cn-duration',
  evaluationRef: 'brain-method-evaluation:evaluation_cn-duration'
});

function requiredHeader(
  headers: Readonly<Record<string, string | undefined>>,
  name: string,
  code: string
): string {
  const value = headers[name]?.trim();
  if (!value) throw new HttpError(400, code, `${name} is required.`);
  return value;
}

function assertPhase7PilotAPredecessor(command: unknown): void {
  if (!command || typeof command !== 'object' || Array.isArray(command))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const predecessor = (command as Record<string, unknown>).predecessor;
  if (!predecessor || typeof predecessor !== 'object' || Array.isArray(predecessor))
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Phase 7 pilot A requires the frozen CN duration predecessor.'
    );
  const value = predecessor as Record<string, unknown>;
  if (
    value.methodPackageRef !== PHASE7_PILOT_A_PREDECESSOR.methodPackageRef ||
    value.methodRef !== PHASE7_PILOT_A_PREDECESSOR.methodRef ||
    value.methodVersionRef !== PHASE7_PILOT_A_PREDECESSOR.methodVersionRef ||
    value.evaluationRef !== PHASE7_PILOT_A_PREDECESSOR.evaluationRef
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Phase 7 pilot A requires the frozen CN duration predecessor.'
    );
}

function translate(error: unknown): never {
  if (!(error instanceof MethodImprovementAdmissionError)) throw error;
  const status =
    error.code === 'INVALID_REQUEST' || error.code === 'INSUFFICIENT_EVIDENCE'
      ? 400
      : error.code === 'WORKSPACE_MISMATCH'
        ? 403
        : error.code === 'REPORT_MISMATCH' || error.code === 'TRIGGER_CONFLICT'
          ? 409
          : 503;
  throw new HttpError(status, error.code, error.message, error.retryable);
}

export function createMethodImprovementRoutesV1(
  options: MethodImprovementHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/evaluation/method-improvement/performance-gaps',
      async handle(request) {
        if (
          !validateInternalServiceSecret(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'INTERNAL_SERVICE_UNAUTHORIZED',
            'Internal service identity is invalid.'
          );
        const workspaceId = requiredHeader(
          request.headers,
          'x-markorbit-workspace-id',
          'WORKSPACE_CONTEXT_REQUIRED'
        ).toLowerCase();
        const idempotencyKey = requiredHeader(
          request.headers,
          'idempotency-key',
          'IDEMPOTENCY_KEY_REQUIRED'
        );
        const correlationId = requiredHeader(
          request.headers,
          'x-correlation-id',
          'CORRELATION_ID_REQUIRED'
        );
        assertPhase7PilotAPredecessor(request.body);
        try {
          const result = await options.service.admit({
            workspaceId,
            idempotencyKey,
            correlationId,
            command: request.body
          });
          return json(result.replayed ? 200 : 201, result);
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
