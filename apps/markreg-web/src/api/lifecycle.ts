import { createApiClient, type ApiClient } from './client.js';

export interface CustomerLifecycleView {
  lifecycleViewId: string;
  formalMatter: { id: string; version: number | string };
  version: number;
  state: string;
  customerSafeLabel: string;
  customerSafeSummary: string;
  officialStatusVerified: false;
  updatedAt: string;
}

export interface CustomerLifecycleEvent {
  lifecycleEventId: string;
  formalMatter: { id: string; version: number | string };
  version: number;
  state: string;
  eventCode: string;
  customerSafeLabel: string;
  customerSafeSummary: string;
  occurredAt: string;
  officialStatusVerified: false;
}

export interface CustomerRecommendedAction {
  recommendedActionId: string;
  formalMatter: { id: string; version: number | string };
  version: number;
  title: string;
  explanation: string;
  dueAt?: string;
  timingBasis?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'DISMISSED';
  executionAuthorized: false;
  updatedAt: string;
}

export interface CustomerLifecycleSurface {
  lifecycle: CustomerLifecycleView | null;
  timeline: readonly CustomerLifecycleEvent[];
  recommendedAction: CustomerRecommendedAction | null;
  noAction: boolean;
}

export interface CustomerLifecycleClient {
  get(formalMatterId: string): Promise<CustomerLifecycleSurface>;
  acknowledge(actionId: string, expectedVersion: number): Promise<void>;
  dismiss(actionId: string, expectedVersion: number): Promise<void>;
}

export function createCustomerLifecycleClient(
  api: ApiClient = createApiClient()
): CustomerLifecycleClient {
  const transition = async (
    actionId: string,
    expectedVersion: number,
    target: 'acknowledge' | 'dismiss'
  ) => {
    const key = `markreg-action:${target}:${actionId}:v${expectedVersion}`;
    await api.post(
      `/api/markreg/recommended-actions/${encodeURIComponent(actionId)}/${target}`,
      { expectedVersion },
      {
        'Idempotency-Key': key,
        'X-Correlation-ID': key
      }
    );
  };
  return {
    get(formalMatterId) {
      return api.get(`/api/markreg/formal-matters/${encodeURIComponent(formalMatterId)}/lifecycle`);
    },
    acknowledge(actionId, expectedVersion) {
      return transition(actionId, expectedVersion, 'acknowledge');
    },
    dismiss(actionId, expectedVersion) {
      return transition(actionId, expectedVersion, 'dismiss');
    }
  };
}
