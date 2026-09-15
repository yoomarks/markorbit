import type {
  SiteConfigurationVersionV1,
  SiteHostBindingV1,
  SiteInstallationV1
} from '@markorbit/contracts/site';

const defaultBaseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

type ErrorPayload = Readonly<{
  code?: string;
  message?: string;
  retryable?: boolean;
}>;

export type SiteManagerConfigurationInput = Readonly<{
  brand: SiteConfigurationVersionV1['brand'];
  localization: SiteConfigurationVersionV1['localization'];
  roles: SiteConfigurationVersionV1['roles'];
  services: SiteConfigurationVersionV1['services'];
  contentSlots: SiteConfigurationVersionV1['contentSlots'];
  attributionPolicyRef?: SiteConfigurationVersionV1['attributionPolicyRef'];
  sourceRef: string;
}>;

export class SiteManagerHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = status >= 500
  ) {
    super(message);
    this.name = 'SiteManagerHttpError';
  }
}

export interface SiteManagerClient {
  list(signal?: AbortSignal): Promise<readonly SiteInstallationV1[]>;
  configuration(siteId: string, signal?: AbortSignal): Promise<SiteConfigurationVersionV1>;
  hostBindings(siteId: string, signal?: AbortSignal): Promise<readonly SiteHostBindingV1[]>;
  reviseConfiguration(
    siteId: string,
    expectedSiteVersion: number,
    configuration: SiteManagerConfigurationInput,
    idempotencyKey: string
  ): Promise<SiteInstallationV1>;
  createHostBinding(
    siteId: string,
    expectedSiteVersion: number,
    input: Readonly<{
      hostname: string;
      bindingType: SiteHostBindingV1['bindingType'];
      verificationMethod: SiteHostBindingV1['verificationMethod'];
    }>,
    idempotencyKey: string
  ): Promise<SiteHostBindingV1>;
  activate(
    siteId: string,
    expectedSiteVersion: number,
    bindingId: string,
    expectedBindingVersion: number,
    idempotencyKey: string
  ): Promise<Readonly<{ installation: SiteInstallationV1; binding: SiteHostBindingV1 }>>;
  suspend(
    siteId: string,
    expectedSiteVersion: number,
    reasonRef: string,
    idempotencyKey: string
  ): Promise<SiteInstallationV1>;
}

function errorPayload(value: unknown): ErrorPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

async function parse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = errorPayload(payload);
    throw new SiteManagerHttpError(
      response.status,
      error.code ?? 'SITE_MANAGER_REQUEST_FAILED',
      error.message ?? `Site Manager request failed with status ${response.status}.`,
      error.retryable ?? response.status >= 500
    );
  }
  return payload as T;
}

async function currentCsrf(baseUrl: string, fetchImpl: typeof fetch): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  } catch {
    throw new SiteManagerHttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication is unavailable.',
      true
    );
  }
  const payload = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !payload.csrfToken)
    throw new SiteManagerHttpError(
      response.status || 503,
      payload.code ?? 'AUTHENTICATION_REQUIRED',
      payload.message ?? 'A current authenticated session is required.'
    );
  return payload.csrfToken;
}

export function createSiteManagerClient(
  workspaceId: string,
  options: Readonly<{ baseUrl?: string; fetchImpl?: typeof fetch }> = {}
): SiteManagerClient {
  const baseUrl = (options.baseUrl ?? defaultBaseUrl).replace(/\/$/u, '');
  const fetchImpl = options.fetchImpl ?? fetch;

  const request = async <T>(
    path: string,
    init: Readonly<{
      method?: 'GET' | 'POST';
      body?: unknown;
      idempotencyKey?: string;
      signal?: AbortSignal;
    }> = {}
  ): Promise<T> => {
    const method = init.method ?? 'GET';
    const csrf = method === 'POST' ? await currentCsrf(baseUrl, fetchImpl) : '';
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-workspace-id': workspaceId,
          ...(csrf ? { 'x-markorbit-csrf-token': csrf } : {}),
          ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {})
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        ...(init.signal ? { signal: init.signal } : {})
      });
    } catch {
      throw new SiteManagerHttpError(
        503,
        'SITE_RUNTIME_UNAVAILABLE',
        'Site management is temporarily unavailable.',
        true
      );
    }
    return parse<T>(response);
  };

  return {
    list: (signal) =>
      request<readonly SiteInstallationV1[]>('/api/sites', signal ? { signal } : {}),
    configuration: (siteId, signal) =>
      request<SiteConfigurationVersionV1>(
        `/api/sites/${encodeURIComponent(siteId)}/configuration`,
        signal ? { signal } : {}
      ),
    hostBindings: (siteId, signal) =>
      request<readonly SiteHostBindingV1[]>(
        `/api/sites/${encodeURIComponent(siteId)}/host-bindings`,
        signal ? { signal } : {}
      ),
    reviseConfiguration: (siteId, expectedSiteVersion, configuration, idempotencyKey) =>
      request<SiteInstallationV1>(`/api/sites/${encodeURIComponent(siteId)}/configurations`, {
        method: 'POST',
        body: { expectedSiteVersion, configuration },
        idempotencyKey
      }),
    createHostBinding: (siteId, expectedSiteVersion, input, idempotencyKey) =>
      request<SiteHostBindingV1>(`/api/sites/${encodeURIComponent(siteId)}/host-bindings`, {
        method: 'POST',
        body: { expectedSiteVersion, ...input },
        idempotencyKey
      }),
    activate: (siteId, expectedSiteVersion, bindingId, expectedBindingVersion, idempotencyKey) =>
      request<Readonly<{ installation: SiteInstallationV1; binding: SiteHostBindingV1 }>>(
        `/api/sites/${encodeURIComponent(siteId)}/activate`,
        {
          method: 'POST',
          body: { expectedSiteVersion, bindingId, expectedBindingVersion },
          idempotencyKey
        }
      ),
    suspend: (siteId, expectedSiteVersion, reasonRef, idempotencyKey) =>
      request<SiteInstallationV1>(`/api/sites/${encodeURIComponent(siteId)}/suspend`, {
        method: 'POST',
        body: { expectedSiteVersion, reasonRef },
        idempotencyKey
      })
  };
}
