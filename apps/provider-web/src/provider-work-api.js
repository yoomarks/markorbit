const workspaceIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allocationIdPattern = /^allocation_[A-Za-z0-9_-]+$/;

export class ProviderWorkClientError extends Error {
  constructor(code, message, { status, retryable = false } = {}) {
    super(message);
    this.name = 'ProviderWorkClientError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function normalizeWorkspaceContext(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!workspaceIdPattern.test(normalized)) {
    throw new ProviderWorkClientError(
      'INVALID_WORKSPACE_CONTEXT',
      'Enter a valid Core Workspace ID before loading provider work.'
    );
  }
  return normalized;
}

function exactAllocationId(value) {
  const normalized = String(value ?? '').trim();
  if (!allocationIdPattern.test(normalized)) {
    throw new ProviderWorkClientError(
      'INVALID_ALLOCATION_ID',
      'The selected work item has an invalid Allocation reference.'
    );
  }
  return normalized;
}

function boundedListQuery({ limit = 50, cursor } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ProviderWorkClientError('INVALID_QUERY', 'Queue limit must be between 1 and 100.');
  }
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor !== undefined) {
    if (typeof cursor !== 'string' || cursor.length === 0 || cursor.length > 2048) {
      throw new ProviderWorkClientError('INVALID_QUERY', 'Queue cursor is invalid.');
    }
    query.set('cursor', cursor);
  }
  return query;
}

async function jsonBody(response) {
  try {
    return await response.json();
  } catch {
    throw new ProviderWorkClientError(
      'MALFORMED_RESPONSE',
      'Provider work returned an unreadable response.',
      { status: response.status }
    );
  }
}

function gatewayError(status, body) {
  const code = typeof body?.error?.code === 'string' ? body.error.code : 'GATEWAY_ERROR';
  if (status === 401) {
    return new ProviderWorkClientError(
      'AUTHENTICATION_REQUIRED',
      'Your MarkOrbit session is required to view Provider Workspace.',
      { status }
    );
  }
  if (status === 403) {
    return new ProviderWorkClientError(
      'WORKSPACE_ACCESS_DENIED',
      'This session does not have Provider read access to the selected Workspace.',
      { status }
    );
  }
  if (status === 404) {
    return new ProviderWorkClientError(
      'NOT_FOUND_OR_NOT_AUTHORIZED',
      'This work item was not found or is not available to this Workspace.',
      { status }
    );
  }
  if (status === 503) {
    return new ProviderWorkClientError(
      'SOURCE_UNAVAILABLE',
      'Provider work is temporarily unavailable. Retry without assuming an empty queue.',
      { status, retryable: true }
    );
  }
  return new ProviderWorkClientError(
    code,
    'Provider work could not be loaded from the governed Gateway.',
    { status, retryable: status >= 500 }
  );
}

export function createProviderWorkClient({ fetchImpl = globalThis.fetch, workspaceId }) {
  if (typeof fetchImpl !== 'function') {
    throw new ProviderWorkClientError('CLIENT_UNAVAILABLE', 'Fetch is unavailable.');
  }
  const workspaceContext = normalizeWorkspaceContext(workspaceId);
  const request = async (path) => {
    const response = await fetchImpl(path, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        'x-markorbit-provider-workspace-id': workspaceContext
      }
    });
    const body = await jsonBody(response);
    if (!response.ok) throw gatewayError(response.status, body);
    return body;
  };

  return Object.freeze({
    workspaceId: workspaceContext,
    async list(query = {}) {
      const search = boundedListQuery(query);
      return request(`/api/provider/work-items?${search.toString()}`);
    },
    async detail(allocationId) {
      const exactId = exactAllocationId(allocationId);
      return request(`/api/provider/work-items/${encodeURIComponent(exactId)}`);
    }
  });
}
