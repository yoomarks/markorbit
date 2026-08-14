import type { WorkspaceEntry } from '@markorbit/contracts';

const gatewayUrl = () => import.meta.env.VITE_GATEWAY_URL ?? 'http://127.0.0.1:4000';

type SessionResponse = {
  authenticated: true;
  userId: string;
  sessionId: string;
  sessionExpiresAt: string;
  csrfToken: string;
};

type AccessResponse = SessionResponse & {
  account: {
    userId: string;
    email: string;
    displayName: string;
    accountType: 'CUSTOMER' | 'PROFESSIONAL';
  };
};

export class LiteAccountApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'LiteAccountApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${gatewayUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers
    }
  });
  const body = (await response.json()) as T & { code?: string; message?: string };
  if (!response.ok)
    throw new LiteAccountApiError(
      response.status,
      body.code ?? 'REQUEST_FAILED',
      body.message ?? 'The account request could not be completed.'
    );
  return body;
}

export interface LiteAccountApi {
  session(): Promise<SessionResponse>;
  register(input: {
    displayName: string;
    email: string;
    password: string;
  }): Promise<AccessResponse>;
  login(input: { email: string; password: string }): Promise<AccessResponse>;
  workspaces(): Promise<readonly WorkspaceEntry[]>;
  createWorkspace(
    input: { name: string; slug?: string },
    csrfToken: string
  ): Promise<WorkspaceEntry>;
}

export const liteAccountApi: LiteAccountApi = {
  session: () => request<SessionResponse>('/api/auth/session'),
  register: (input) =>
    request<AccessResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...input, accountType: 'PROFESSIONAL' })
    }),
  login: (input) =>
    request<AccessResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  async workspaces() {
    const result = await request<{ workspaces: WorkspaceEntry[] }>('/api/workspaces');
    return result.workspaces;
  },
  createWorkspace: (input, csrfToken) =>
    request<WorkspaceEntry>('/api/workspaces', {
      method: 'POST',
      headers: { 'x-markorbit-csrf-token': csrfToken },
      body: JSON.stringify(input)
    })
};
