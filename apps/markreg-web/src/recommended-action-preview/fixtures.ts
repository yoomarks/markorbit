import { MarkregApiError } from '../api/errors.js';
import type { CustomerLifecycleClient, CustomerLifecycleSurface } from '../api/lifecycle.js';

export type RecommendedActionScenario =
  | 'open'
  | 'acknowledged'
  | 'dismissed'
  | 'no-action'
  | 'read-only'
  | 'partial'
  | 'loading'
  | 'empty'
  | 'unauthorized'
  | 'unavailable'
  | 'stale-version'
  | 'mutation-error';

export const previewMatter = {
  formalMatterId: 'formal-matter_atlas-51950',
  title: 'ATLAS',
  jurisdiction: 'United States',
  matterVersion: 8,
  relationshipName: 'Atlas Studio · MarkOrbit Direct'
};

const base: CustomerLifecycleSurface = {
  lifecycle: {
    lifecycleViewId: 'lifecycle-view_atlas-51950',
    formalMatter: { id: previewMatter.formalMatterId, version: 8 },
    version: 4,
    state: 'CUSTOMER_ACTION_NEEDED',
    customerSafeLabel: 'Customer review needed',
    customerSafeSummary:
      'Reviewed evidence indicates that you should review the current Matter guidance.',
    officialStatusVerified: false,
    updatedAt: '2026-10-07T07:42:00.000Z'
  },
  timeline: [
    {
      lifecycleEventId: 'lifecycle-event_atlas-51950-v4',
      formalMatter: { id: previewMatter.formalMatterId, version: 8 },
      version: 4,
      state: 'CUSTOMER_ACTION_NEEDED',
      eventCode: 'REVIEWED_EVIDENCE_REQUIRES_CUSTOMER_ACTION',
      customerSafeLabel: 'Customer review needed',
      customerSafeSummary: 'A reviewed source was admitted into the governed lifecycle.',
      occurredAt: '2026-10-07T07:42:00.000Z',
      officialStatusVerified: false
    },
    {
      lifecycleEventId: 'lifecycle-event_atlas-51950-v3',
      formalMatter: { id: previewMatter.formalMatterId, version: 8 },
      version: 3,
      state: 'APPLICATION_PENDING',
      eventCode: 'APPLICATION_PENDING_INTERNAL_REVIEW',
      customerSafeLabel: 'Application pending review',
      customerSafeSummary: 'The Matter was awaiting the next reviewed event.',
      occurredAt: '2026-10-03T02:18:00.000Z',
      officialStatusVerified: false
    }
  ],
  recommendedAction: {
    recommendedActionId: 'recommended-action_atlas-51950',
    formalMatter: { id: previewMatter.formalMatterId, version: 8 },
    version: 3,
    title: 'Review required action',
    explanation:
      'The current governed lifecycle requires your attention. Review the latest customer-safe summary before deciding what to do next.',
    timingBasis: 'No governed due date is available, so no deadline or urgency has been inferred.',
    status: 'OPEN',
    executionAuthorized: false,
    updatedAt: '2026-10-07T07:42:10.000Z'
  },
  noAction: false
};

function valueForScenario(scenario: RecommendedActionScenario): CustomerLifecycleSurface {
  if (scenario === 'empty')
    return { lifecycle: null, timeline: [], recommendedAction: null, noAction: false };
  if (scenario === 'no-action') return { ...base, recommendedAction: null, noAction: true };
  if (scenario === 'acknowledged' || scenario === 'dismissed') {
    return {
      ...base,
      recommendedAction: base.recommendedAction
        ? {
            ...base.recommendedAction,
            status: scenario === 'acknowledged' ? 'ACKNOWLEDGED' : 'DISMISSED'
          }
        : null
    };
  }
  if (scenario === 'partial') return { ...base, timeline: [] };
  return structuredClone(base);
}

export function clientForScenario(scenario: RecommendedActionScenario): CustomerLifecycleClient {
  let value = valueForScenario(scenario);
  return {
    get() {
      if (scenario === 'loading') return new Promise(() => undefined);
      if (scenario === 'unauthorized')
        return Promise.reject(
          new MarkregApiError('blocking', 'Access required.', undefined, 'FORBIDDEN', 403)
        );
      if (scenario === 'unavailable')
        return Promise.reject(
          new MarkregApiError(
            'recoverable',
            'Owner unavailable.',
            undefined,
            'DEPENDENCY_UNAVAILABLE',
            503
          )
        );
      return Promise.resolve(structuredClone(value));
    },
    acknowledge(_actionId, expectedVersion) {
      if (scenario === 'stale-version')
        return Promise.reject(
          new MarkregApiError(
            'conflict',
            'Stale version.',
            undefined,
            'RECOMMENDED_ACTION_STALE',
            409
          )
        );
      if (scenario === 'mutation-error')
        return Promise.reject(
          new MarkregApiError(
            'recoverable',
            'Unavailable.',
            undefined,
            'DEPENDENCY_UNAVAILABLE',
            503
          )
        );
      if (expectedVersion !== value.recommendedAction?.version)
        return Promise.reject(new Error('Unexpected version'));
      value = {
        ...value,
        recommendedAction: value.recommendedAction
          ? {
              ...value.recommendedAction,
              version: value.recommendedAction.version + 1,
              status: 'ACKNOWLEDGED',
              updatedAt: '2026-10-07T07:44:00.000Z'
            }
          : null
      };
      return Promise.resolve();
    },
    dismiss(_actionId, expectedVersion) {
      if (scenario === 'stale-version')
        return Promise.reject(
          new MarkregApiError(
            'conflict',
            'Stale version.',
            undefined,
            'RECOMMENDED_ACTION_STALE',
            409
          )
        );
      if (scenario === 'mutation-error')
        return Promise.reject(
          new MarkregApiError(
            'recoverable',
            'Unavailable.',
            undefined,
            'DEPENDENCY_UNAVAILABLE',
            503
          )
        );
      if (expectedVersion !== value.recommendedAction?.version)
        return Promise.reject(new Error('Unexpected version'));
      value = {
        ...value,
        recommendedAction: value.recommendedAction
          ? {
              ...value.recommendedAction,
              version: value.recommendedAction.version + 1,
              status: 'DISMISSED',
              updatedAt: '2026-10-07T07:44:00.000Z'
            }
          : null
      };
      return Promise.resolve();
    }
  };
}
