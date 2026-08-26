import type { CapabilityCenterView, ReflectionDispositionOutcome } from '@markorbit/contracts';
import type {
  CapabilityComposition,
  CapabilityEligibilityDecision,
  CapabilityInvocation,
  CapabilityOutcome,
  CapabilityRequestV2,
  CapabilityReturn,
  CapabilityRiskClass,
  ImplementationBinding,
  SessionReceipt
} from '@markorbit/contracts/capability-runtime';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export class CapabilityHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'CapabilityHttpError';
  }
}

export class CapabilityCenterHttpError extends CapabilityHttpError {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(status, code, message, details);
    this.name = 'CapabilityCenterHttpError';
  }
}

export class CapabilityInvocationHttpError extends CapabilityHttpError {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(status, code, message, details);
    this.name = 'CapabilityInvocationHttpError';
  }
}

export interface CapabilityCenterDispositionCommand {
  reflectionCandidateId: string;
  candidateVersion: number;
  expectedCandidateFingerprintSha256: string;
  outcome: ReflectionDispositionOutcome;
  rationale?: string;
}

export interface CapabilityCenterClient {
  load(): Promise<CapabilityCenterView>;
  disposition(command: Readonly<CapabilityCenterDispositionCommand>): Promise<unknown>;
}

export interface CapabilityInvocationCommand {
  schemaVersion: 2;
  capabilityId: string;
  capabilityVersion: string;
  purpose: string;
  input: unknown;
  inputSchemaId: string;
  outputSchemaId: string;
  riskClass: CapabilityRiskClass;
  idempotencyKey: string;
  correlationId: string;
}

export interface GovernedCapabilityExecutionView {
  request: Readonly<CapabilityRequestV2>;
  eligibility: Readonly<CapabilityEligibilityDecision>;
  composition: Readonly<CapabilityComposition>;
  binding: Readonly<ImplementationBinding>;
  invocation: Readonly<CapabilityInvocation>;
  outcome: Readonly<CapabilityOutcome>;
  returnValue: Readonly<CapabilityReturn>;
  receipt: Readonly<SessionReceipt>;
  replayed: boolean;
}

export interface CapabilityInvocationClient {
  invoke(command: Readonly<CapabilityInvocationCommand>): Promise<GovernedCapabilityExecutionView>;
}

type CapabilityErrorConstructor = new (
  status: number,
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>
) => CapabilityHttpError;

async function sessionCsrf(ErrorType: CapabilityErrorConstructor): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  const value = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !value.csrfToken)
    throw new ErrorType(
      response.status || 503,
      value.code ?? 'AUTHENTICATION_REQUIRED',
      value.message ?? 'An authenticated session is required.'
    );
  return value.csrfToken;
}

async function parse<T>(
  response: Response,
  ErrorType: CapabilityErrorConstructor,
  fallbackCode: string,
  fallbackMessage: string
): Promise<T> {
  const parsed: unknown = await response.json().catch(() => ({}));
  const value = parsed as T & {
    code?: string;
    message?: string;
    details?: Readonly<Record<string, unknown>>;
  };
  if (!response.ok)
    throw new ErrorType(
      response.status,
      value.code ?? fallbackCode,
      value.message ?? fallbackMessage,
      value.details
    );
  return value;
}

export function createCapabilityInvocationClient(workspaceId: string): CapabilityInvocationClient {
  return {
    async invoke(command) {
      const csrf = await sessionCsrf(CapabilityInvocationHttpError);
      const body: CapabilityInvocationCommand = {
        schemaVersion: command.schemaVersion,
        capabilityId: command.capabilityId,
        capabilityVersion: command.capabilityVersion,
        purpose: command.purpose,
        input: command.input,
        inputSchemaId: command.inputSchemaId,
        outputSchemaId: command.outputSchemaId,
        riskClass: command.riskClass,
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId
      };
      try {
        const response = await fetch(`${baseUrl}/api/lite/capability-requests`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-workspace-id': workspaceId,
            'x-markorbit-csrf-token': csrf,
            'idempotency-key': command.idempotencyKey,
            'x-correlation-id': command.correlationId
          },
          body: JSON.stringify(body)
        });
        return parse<GovernedCapabilityExecutionView>(
          response,
          CapabilityInvocationHttpError,
          'CAPABILITY_INVOCATION_FAILED',
          'Capability invocation failed.'
        );
      } catch (error) {
        if (error instanceof CapabilityInvocationHttpError) throw error;
        throw new CapabilityInvocationHttpError(
          503,
          'DOWNSTREAM_UNAVAILABLE',
          'Governed Capability runtime is temporarily unavailable.',
          { cause: error instanceof Error ? error.message : 'network failure' }
        );
      }
    }
  };
}

export function createCapabilityCenterClient(workspaceId: string): CapabilityCenterClient {
  return {
    async load() {
      try {
        const response = await fetch(`${baseUrl}/api/lite/capability-center`, {
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-workspace-id': workspaceId
          }
        });
        return parse<CapabilityCenterView>(
          response,
          CapabilityCenterHttpError,
          'CAPABILITY_CENTER_REQUEST_FAILED',
          'Capability Center request failed.'
        );
      } catch (error) {
        if (error instanceof CapabilityCenterHttpError) throw error;
        throw new CapabilityCenterHttpError(
          503,
          'DOWNSTREAM_UNAVAILABLE',
          'Capability Center is temporarily unavailable.',
          { cause: error instanceof Error ? error.message : 'network failure' }
        );
      }
    },
    async disposition(command) {
      const csrf = await sessionCsrf(CapabilityCenterHttpError);
      try {
        const response = await fetch(
          `${baseUrl}/api/lite/capability-center/reflection-candidates/${encodeURIComponent(command.reflectionCandidateId)}/disposition`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type': 'application/json',
              'x-markorbit-workspace-id': workspaceId,
              'x-markorbit-csrf-token': csrf,
              'idempotency-key': `capability-reflection:${command.reflectionCandidateId}:${command.candidateVersion}:${command.outcome}`
            },
            body: JSON.stringify({
              candidateVersion: command.candidateVersion,
              expectedCandidateFingerprintSha256: command.expectedCandidateFingerprintSha256,
              outcome: command.outcome,
              ...(command.rationale ? { rationale: command.rationale } : {})
            })
          }
        );
        return parse<unknown>(
          response,
          CapabilityCenterHttpError,
          'CAPABILITY_CENTER_REQUEST_FAILED',
          'Capability Center request failed.'
        );
      } catch (error) {
        if (error instanceof CapabilityCenterHttpError) throw error;
        throw new CapabilityCenterHttpError(
          503,
          'DOWNSTREAM_UNAVAILABLE',
          'Capability reflection could not be saved.',
          { cause: error instanceof Error ? error.message : 'network failure' }
        );
      }
    }
  };
}
