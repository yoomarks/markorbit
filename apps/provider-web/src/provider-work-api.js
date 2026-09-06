const workspaceIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allocationIdPattern = /^allocation_[A-Za-z0-9_-]+$/;
const providerReturnIdPattern = /^provider-return_[A-Za-z0-9_-]+$/;
const idempotencyKeyPattern = /^[\x21-\x7e]{1,200}$/;

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

function exactId(value, pattern, label) {
  const normalized = String(value ?? '').trim();
  if (!pattern.test(normalized)) {
    throw new ProviderWorkClientError(
      `INVALID_${label.toUpperCase().replaceAll(' ', '_')}`,
      `The ${label} is invalid; use the exact governed reference.`
    );
  }
  return normalized;
}

function exactAllocationId(value) {
  return exactId(value, allocationIdPattern, 'Allocation reference');
}

function exactProviderReturnId(value) {
  return exactId(value, providerReturnIdPattern, 'Provider Return reference');
}

function positiveVersion(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new ProviderWorkClientError('INVALID_VERSION', `${label} must be a positive integer.`);
  }
  return value;
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

function responseCode(body) {
  if (typeof body?.error?.code === 'string') return body.error.code;
  if (typeof body?.code === 'string') return body.code;
  return 'GATEWAY_ERROR';
}

function gatewayError(status, body, operation = 'loaded') {
  const upstreamCode = responseCode(body);
  if (status === 401) {
    return new ProviderWorkClientError(
      'AUTHENTICATION_REQUIRED',
      'Your MarkOrbit session is required to use Provider Workspace.',
      { status }
    );
  }
  if (status === 403) {
    return new ProviderWorkClientError(
      'WORKSPACE_ACCESS_DENIED',
      'This session does not have the required Provider Workspace authority.',
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
  if (status === 409) {
    return new ProviderWorkClientError(
      upstreamCode,
      upstreamCode === 'IDEMPOTENCY_CONFLICT'
        ? 'This retry does not exactly match the original request. Refresh owner truth before acting again.'
        : 'The work changed before this action completed. Refresh owner truth before acting again.',
      { status }
    );
  }
  if (status === 503) {
    return new ProviderWorkClientError(
      'SOURCE_UNAVAILABLE',
      `Provider work could not be ${operation} because a governed dependency is temporarily unavailable.`,
      { status, retryable: true }
    );
  }
  return new ProviderWorkClientError(
    upstreamCode,
    `Provider work could not be ${operation} through the governed Gateway.`,
    { status, retryable: status >= 500 }
  );
}

function csrfValue(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new ProviderWorkClientError(
      'CSRF_CONTEXT_REQUIRED',
      'The authenticated browser security context is missing. Sign in again before submitting Provider actions.'
    );
  }
  return normalized;
}

function idempotencyValue(value) {
  const normalized = String(value ?? '').trim();
  if (!idempotencyKeyPattern.test(normalized)) {
    throw new ProviderWorkClientError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'A stable Idempotency-Key is required for Provider actions.'
    );
  }
  return normalized;
}

function actionLineage(item) {
  if (!item?.actionLineage?.correlationId) {
    throw new ProviderWorkClientError(
      'ACTION_LINEAGE_REQUIRED',
      'Current action lineage is unavailable. Refresh the work item before acting.'
    );
  }
  return item.actionLineage.correlationId;
}

function mutationHeaders(workspaceContext, csrfToken, idempotencyKey) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-markorbit-provider-workspace-id': workspaceContext,
    'x-markorbit-csrf-token': csrfValue(csrfToken),
    'Idempotency-Key': idempotencyValue(idempotencyKey)
  };
}

export function createProviderWorkClient({ fetchImpl = globalThis.fetch, workspaceId, csrfToken }) {
  if (typeof fetchImpl !== 'function') {
    throw new ProviderWorkClientError('CLIENT_UNAVAILABLE', 'Fetch is unavailable.');
  }
  const workspaceContext = normalizeWorkspaceContext(workspaceId);

  const get = async (path, operation = 'loaded') => {
    const response = await fetchImpl(path, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        'x-markorbit-provider-workspace-id': workspaceContext
      }
    });
    const body = await jsonBody(response);
    if (!response.ok) throw gatewayError(response.status, body, operation);
    return body;
  };

  const post = async (path, body, idempotencyKey, operation) => {
    const response = await fetchImpl(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: mutationHeaders(workspaceContext, csrfToken, idempotencyKey),
      body: JSON.stringify(body)
    });
    const parsed = await jsonBody(response);
    if (!response.ok) throw gatewayError(response.status, parsed, operation);
    return parsed;
  };

  return Object.freeze({
    workspaceId: workspaceContext,
    async list(query = {}) {
      const search = boundedListQuery(query);
      return get(`/api/provider/work-items?${search.toString()}`);
    },
    async detail(allocationId) {
      const exactAllocation = exactAllocationId(allocationId);
      return get(`/api/provider/work-items/${encodeURIComponent(exactAllocation)}`);
    },
    async providerReturn(providerReturnId, version) {
      const exactReturn = exactProviderReturnId(providerReturnId);
      const query =
        version === undefined
          ? ''
          : `?${new URLSearchParams({
              version: String(positiveVersion(version, 'Provider Return version'))
            })}`;
      return get(`/api/provider/returns/${encodeURIComponent(exactReturn)}${query}`, 'read');
    },
    async respond(item, { decision, acknowledgement, idempotencyKey }) {
      if (!['ACCEPTED', 'DECLINED'].includes(decision)) {
        throw new ProviderWorkClientError('INVALID_DECISION', 'Choose Accept or Decline.');
      }
      const acknowledgementText = String(acknowledgement ?? '').trim();
      if (!acknowledgementText) {
        throw new ProviderWorkClientError(
          'ACKNOWLEDGEMENT_REQUIRED',
          'Add a short acknowledgement before recording the response.'
        );
      }
      const allocationId = exactAllocationId(item?.allocationId);
      return post(
        `/api/provider/allocations/${encodeURIComponent(allocationId)}/respond`,
        {
          workspaceId: normalizeWorkspaceContext(item?.originatingWorkspaceId),
          expectedAllocationVersion: positiveVersion(item?.allocationVersion, 'Allocation version'),
          decision,
          acknowledgement: acknowledgementText,
          correlationId: actionLineage(item)
        },
        idempotencyKey,
        'recorded'
      );
    },
    async submitReturn(
      item,
      { workStatusClaim, artifacts = [], assertions = [], idempotencyKey, supersedes }
    ) {
      const acceptance = item?.response;
      if (
        acceptance?.state !== 'KNOWN_RESPONSE' ||
        acceptance.decision !== 'ACCEPTED' ||
        !acceptance.id
      ) {
        throw new ProviderWorkClientError(
          'ACCEPTANCE_REQUIRED',
          'An exact recorded Provider Acceptance is required before submitting a Return.'
        );
      }
      if (
        !Array.isArray(artifacts) ||
        !Array.isArray(assertions) ||
        artifacts.length + assertions.length < 1
      ) {
        throw new ProviderWorkClientError(
          'RETURN_EVIDENCE_REQUIRED',
          'Add at least one artifact reference or structured assertion.'
        );
      }
      const body = {
        workspaceId: normalizeWorkspaceContext(item?.originatingWorkspaceId),
        allocationId: exactAllocationId(item?.allocationId),
        expectedAllocationVersion: positiveVersion(item?.allocationVersion, 'Allocation version'),
        providerAcceptanceId: acceptance.id,
        expectedProviderAcceptanceVersion: positiveVersion(
          acceptance.version,
          'Provider Acceptance version'
        ),
        servicePackageId: String(item?.servicePackageId ?? '').trim(),
        expectedServicePackageVersion: positiveVersion(
          item?.servicePackageVersion,
          'Service Package version'
        ),
        workStatusClaim: String(workStatusClaim ?? '').trim(),
        artifacts,
        assertions,
        correlationId: actionLineage(item),
        ...(supersedes
          ? {
              supersedes: {
                id: exactProviderReturnId(supersedes.id),
                version: positiveVersion(supersedes.version, 'superseded Return version')
              }
            }
          : {})
      };
      if (!body.servicePackageId || !body.workStatusClaim) {
        throw new ProviderWorkClientError(
          'RETURN_CLAIM_REQUIRED',
          'Service Package and work status claim are required.'
        );
      }
      return post('/api/provider/returns', body, idempotencyKey, 'submitted');
    }
  });
}
