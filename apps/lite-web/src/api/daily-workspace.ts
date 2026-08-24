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
import type {
  LiteTodaySnapshot,
  ProductLoopExactReference,
  ProductLoopUseFeedback,
  PublishPackage
} from '@markorbit/contracts/product-loop';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export interface DailyOrbitSnapshot {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly subjectUserId: string;
  readonly generatedAt: string;
  readonly preferenceSource: 'EXPLICIT' | 'PRODUCT_FEEDBACK' | 'NONE';
  readonly savedOrbitItemIds: readonly string[];
  readonly items: ReadonlyArray<Readonly<DailyOrbitItem>>;
  readonly contentPicks: ReadonlyArray<Readonly<ContentPick>>;
  readonly partial: boolean;
  readonly warnings: readonly string[];
  readonly executionAuthorized: false;
  readonly legalTruthVerified: false;
}

export interface DailyWorkspaceSnapshot {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly subjectUserId: string;
  readonly generatedAt: string;
  readonly see: {
    readonly preferenceSource: DailyOrbitSnapshot['preferenceSource'] | null;
    readonly savedOrbitItemIds: readonly string[];
    readonly orbitItems: ReadonlyArray<Readonly<DailyOrbitItem>>;
  };
  readonly create: {
    readonly contentPicks: ReadonlyArray<Readonly<ContentPick>>;
  };
  readonly move: {
    readonly todayItems: LiteTodaySnapshot['items'];
    readonly recentFeedback: ReadonlyArray<Readonly<ProductLoopUseFeedback>>;
    readonly feedbackPendingPackages: ReadonlyArray<Readonly<PublishPackage>>;
  };
  readonly partial: boolean;
  readonly warnings: readonly string[];
  readonly executionAuthorized: false;
  readonly externalPublishExecuted: false;
  readonly officialTruthCreated: false;
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
  loadWorkspace(): Promise<DailyWorkspaceSnapshot>;
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
  const recordPreferenceEvent = (
    kind: ProductPreferenceEventKind,
    target: ProductPreferenceTarget,
    idempotencyKey: string
  ) =>
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
    );

  const recordPreferenceBestEffort = async (
    kind: ProductPreferenceEventKind,
    target: ProductPreferenceTarget,
    idempotencyKey: string
  ) => {
    try {
      await recordPreferenceEvent(kind, target, idempotencyKey);
    } catch {
      // Product preference evidence must never manufacture or block the primary Product action.
    }
  };

  return {
    loadWorkspace: () => request<DailyWorkspaceSnapshot>('/api/lite/daily-workspace', workspaceId),
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
    createVisualBrief: async (contentPickId, kit, input) => {
      const record = await request<VisualBriefRecordResponse>(
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
      );
      await recordPreferenceBestEffort(
        'CONTENT_STARTED',
        {
          targetType: 'CONTENT_KIT',
          targetId: kit.contentKitId,
          targetVersion: kit.version
        },
        `preference:content-started:${kit.contentKitId}:${kit.version}`
      );
      return record;
    },
    startVisualRequest: async (record) => {
      const result = await request<VisualRequestResponse>(
        `/api/lite/visual-briefs/${encodeURIComponent(record.brief.visualBriefId)}/request`,
        workspaceId,
        'POST',
        {
          visualBriefVersion: record.brief.version,
          expectedVisualBriefFingerprintSha256: record.visualBriefFingerprintSha256
        },
        `visual-request:${record.brief.visualBriefId}:${record.brief.version}`
      );
      const target: ProductPreferenceTarget = {
        targetType: 'VISUAL_OUTPUT',
        targetId: result.output.visualOutputReferenceId,
        targetVersion: result.output.version
      };
      await recordPreferenceBestEffort(
        'VISUAL_REQUESTED',
        target,
        `preference:visual-requested:${result.output.visualOutputReferenceId}:${result.output.version}`
      );
      if (result.output.status === 'READY' || result.output.status === 'REUSED_CERTIFIED_ASSET')
        await recordPreferenceBestEffort(
          'VISUAL_GENERATED',
          target,
          `preference:visual-generated:${result.output.visualOutputReferenceId}:${result.output.version}`
        );
      return result;
    },
    recordPreferenceEvent
  };
}
