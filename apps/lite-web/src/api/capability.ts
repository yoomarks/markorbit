import type {
  CapabilityCenterView,
  ReflectionDispositionOutcome
} from '@markorbit/contracts';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export class CapabilityCenterHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'CapabilityCenterHttpError';
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

async function sessionCsrf(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  const value = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !value.csrfToken)
    throw new CapabilityCenterHttpError(
      response.status || 503,
      value.code ?? 'AUTHENTICATION_REQUIRED',
      value.message ?? 'An authenticated session is required.'
    );
  return value.csrfToken;
}

async function parse<T>(response: Response): Promise<T> {
  const parsed: unknown = await response.json().catch(() => ({}));
  const value = parsed as T & {
    code?: string;
    message?: string;
    details?: Readonly<Record<string, unknown>>;
  };
  if (!response.ok)
    throw new CapabilityCenterHttpError(
      response.status,
      value.code ?? 'CAPABILITY_CENTER_REQUEST_FAILED',
      value.message ?? 'Capability Center request failed.',
      value.details
    );
  return value;
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
        return parse<CapabilityCenterView>(response);
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
      const csrf = await sessionCsrf();
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
        return parse<unknown>(response);
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
