import type {
  ContentKit,
  ContentPick,
  CreatorPreference,
  DailyOrbitItem,
  ProductPreferenceEvent,
  ProductPreferenceEventKind,
  VisualBrief,
  VisualBriefId,
  VisualOutputKind,
  VisualOutputReference
} from '@markorbit/contracts/daily-workspace';
import type { ProductLoopExactReference } from '@markorbit/contracts/product-loop';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export interface DailyOrbitSnapshot {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly subjectUserId: string;
  readonly generatedAt: string;
  readonly preferenceSource: 'EXPLICIT' | 'PRODUCT_FEEDBACK' | 'NONE';
  readonly items: ReadonlyArray<Readonly<DailyOrbitItem>>;
  readonly contentPicks: ReadonlyArray<Readonly<ContentPick>>;
  readonly partial: boolean;
  readonly warnings: readonly string[];
  readonly executionAuthorized: false;
  readonly legalTruthVerified: false;
}

export interface VisualBriefRecordResponse {
  readonly brief: Readonly<VisualBrief>;
  readonly visualBriefFingerprintSha256: string;
}

export interface VisualRequestResponse {
  readonly requestReference: string;
  readonly output: Readonly<VisualOutputReference>;
  readonly acceptedAt: string;
}

export interface ProductPreferenceEventResponse {
  readonly event: Readonly<ProductPreferenceEvent>;
  readonly preference: Readonly<CreatorPreference>;
}

export type ProductPreferenceTarget = Readonly<{
  targetType: ProductPreferenceEvent['targetType'];
  targetId: string;
  targetVersion: number | string;
}>;

export class DailyWorkspaceHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'DailyWorkspaceHttpError';
  }
}

export interface DailyWorkspaceClient {
  loadOrbit(): Promise<DailyOrbitSnapshot>;
  loadContentKit(contentPickId: string): Promise<ContentKit>;
  loadVisualBrief(
    reference: Readonly<ProductLoopExactReference<VisualBriefId>>
  ): Promise<VisualBriefRecordResponse>;
  createVisualBrief(
    contentPickId: string,
    kit: Readonly<ContentKit>,
    input: Readonly<{
      requestedIpPackage: string;
      outputKind: VisualOutputKind;
      sceneIntent: string;
    }>
  ): Promise<VisualBriefRecordResponse>;
  startVisualRequest(record: Readonly<VisualBriefRecordResponse>): Promise<VisualRequestResponse>;
  recordPreferenceEvent(
    kind: ProductPreferenceEventKind,
    target: ProductPreferenceTarget,
    idempotencyKey: string
  ): Promise<ProductPreferenceEventResponse>;
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  const value = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !value.csrfToken)
    throw new DailyWorkspaceHttpError(
      response.status || 503,
      value.code ?? 'AUTHENTICATION_REQUIRED',
      value.message ?? 'An authenticated session is required.'
    );
  return value.csrfToken;
}

async function request<T>(
  path: string,
  workspaceId: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Readonly<Record<string, unknown>>,
  idempotencyKey?: string
): Promise<T> {
  const csrf = method === 'GET' ? '' : await csrfToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId,
        ...(csrf ? { 'x-markorbit-csrf-token': csrf } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify({ workspaceId, ...body }) })
    });
  } catch {
    throw new DailyWorkspaceHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Daily Workspace is temporarily unavailable.',
      true
    );
  }
  const parsed = (await response.json().catch(() => ({}))) as T & {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  if (!response.ok)
    throw new DailyWorkspaceHttpError(
      response.status,
      parsed.code ?? 'DAILY_WORKSPACE_REQUEST_FAILED',
      parsed.message ?? 'Daily Workspace request failed.',
      parsed.retryable ?? response.status >= 500
    );
  return parsed;
}

function visualBriefKey(contentPickId: string, kit: Readonly<ContentKit>, sceneIntent: string) {
  return `visual-brief:${contentPickId}:${kit.contentKitId}:${kit.version}:${sceneIntent.trim()}`;
}

export function createDailyWorkspaceClient(workspaceId: string): DailyWorkspaceClient {
  return {
    loadOrbit: () => request<DailyOrbitSnapshot>('/api/lite/daily-orbit', workspaceId),
    loadContentKit: (contentPickId) =>
      request<ContentKit>(
        `/api/lite/content-kits/${encodeURIComponent(contentPickId)}`,
        workspaceId
      ),
    loadVisualBrief: (reference) =>
      request<VisualBriefRecordResponse>(
        `/api/lite/visual-briefs/${encodeURIComponent(reference.id)}?version=${reference.version}`,
        workspaceId
      ),
    createVisualBrief: (contentPickId, kit, input) =>
      request<VisualBriefRecordResponse>(
        `/api/lite/content-kits/${encodeURIComponent(contentPickId)}/visual-briefs`,
        workspaceId,
        'POST',
        {
          expectedContentKitId: kit.contentKitId,
          expectedContentKitVersion: kit.version,
          requestedIpPackage: input.requestedIpPackage,
          outputKind: input.outputKind,
          sceneIntent: input.sceneIntent
        },
        visualBriefKey(contentPickId, kit, input.sceneIntent)
      ),
    startVisualRequest: (record) =>
      request<VisualRequestResponse>(
        `/api/lite/visual-briefs/${encodeURIComponent(record.brief.visualBriefId)}/request`,
        workspaceId,
        'POST',
        {
          visualBriefVersion: record.brief.version,
          expectedVisualBriefFingerprintSha256: record.visualBriefFingerprintSha256
        },
        `visual-request:${record.brief.visualBriefId}:${record.brief.version}`
      ),
    recordPreferenceEvent: (kind, target, idempotencyKey) =>
      request<ProductPreferenceEventResponse>(
        '/api/lite/product-preference-events',
        workspaceId,
        'POST',
        {
          kind,
          targetType: target.targetType,
          targetId: target.targetId,
          targetVersion: target.targetVersion
        },
        idempotencyKey
      )
  };
}
