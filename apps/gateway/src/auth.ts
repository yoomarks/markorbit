import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedUserPrincipal, WorkspacePrincipal } from '@markorbit/contracts';
import { AuthenticationError } from '@markorbit/contracts';

export const SESSION_COOKIE_NAME = 'mo_session';
export const CSRF_HEADER_NAME = 'x-markorbit-csrf-token';
export const WORKSPACE_HEADER_NAME = 'x-markorbit-workspace-id';
export function sessionCookie(token: string, maxAgeSeconds: number, secure: boolean) {
  return `${SESSION_COOKIE_NAME}=${token}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
export function clearSessionCookie(secure: boolean) {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
export function readSessionCookie(cookie: string | undefined) {
  if (!cookie) return undefined;
  return (
    cookie
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1) || undefined
  );
}
export function csrfToken(sessionId: string, secret: string) {
  return createHmac('sha256', secret).update(sessionId).digest('base64url');
}
export function validateCsrf(sessionId: string, secret: string, supplied: string | undefined) {
  if (!supplied) throw new AuthenticationError('INVALID_CSRF_TOKEN', 'CSRF token is invalid.');
  const expected = Buffer.from(csrfToken(sessionId, secret));
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new AuthenticationError('INVALID_CSRF_TOKEN', 'CSRF token is invalid.');
}
export function requireTrustedOrigin(origin: string | undefined, allowed: readonly string[]) {
  if (!origin || !allowed.includes(origin))
    throw new AuthenticationError('UNTRUSTED_ORIGIN', 'Request origin is not trusted.');
}
export interface CoreAuthenticationClient {
  issue(
    userId: string,
    correlationId?: string
  ): Promise<{
    rawToken: string;
    session: { sessionId: string; userId: string; expiresAt: string };
  }>;
  resolve(token: string, correlationId?: string): Promise<AuthenticatedUserPrincipal>;
  resolveWorkspace(
    token: string,
    workspaceId: string,
    correlationId?: string
  ): Promise<WorkspacePrincipal>;
  revoke(sessionId: string, correlationId?: string): Promise<void>;
}
export class HttpCoreAuthenticationClient implements CoreAuthenticationClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceSecret: string,
    private readonly timeoutMs = 3_000
  ) {}
  private async call<T>(path: string, body: unknown, correlationId?: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.serviceSecret,
          ...(correlationId ? { 'x-correlation-id': correlationId } : {})
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch {
      throw new AuthenticationError(
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Authentication service is unavailable.'
      );
    }
    if (response.status >= 500)
      throw new AuthenticationError(
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Authentication service is unavailable.'
      );
    if (!response.ok) {
      const error = (await response.json()) as { code?: string };
      throw new AuthenticationError(
        (error.code ?? 'INVALID_SESSION') as never,
        'Authentication failed.'
      );
    }
    return response.json() as Promise<T>;
  }
  issue(userId: string, correlationId?: string) {
    return this.call<{
      rawToken: string;
      session: { sessionId: string; userId: string; expiresAt: string };
    }>('/internal/auth/sessions', { userId }, correlationId);
  }
  resolve(token: string, correlationId?: string) {
    return this.call<AuthenticatedUserPrincipal>(
      '/internal/auth/sessions/resolve',
      { token },
      correlationId
    );
  }
  resolveWorkspace(token: string, workspaceId: string, correlationId?: string) {
    return this.call<WorkspacePrincipal>(
      '/internal/auth/workspace-principals/resolve',
      { token, workspaceId },
      correlationId
    );
  }
  async revoke(sessionId: string, correlationId?: string) {
    await this.call(
      `/internal/auth/sessions/${encodeURIComponent(sessionId)}/revoke`,
      {},
      correlationId
    );
  }
}
export const newCsrfSecret = () => randomBytes(32).toString('base64url');
