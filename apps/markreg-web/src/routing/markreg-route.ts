export const MARKREG_VIEWS = [
  'consultation',
  'recommendation-plan',
  'quote',
  'customer-confirmation',
  'order',
  'matter-draft',
  'formal-matter',
  'documents',
  'preparation-lock',
  'filing-authorization'
] as const;

export type MarkregView = (typeof MARKREG_VIEWS)[number];
export type MarkregRoute = { view: MarkregView; recordId: string; expectedVersion: string };
export type MarkregRouteResult =
  | { kind: 'VALID'; route: MarkregRoute }
  | { kind: 'MALFORMED_ROUTE'; reason: string }
  | { kind: 'UNSUPPORTED_ROUTE'; view: string };
export type GovernedRouteViewState =
  | { kind: 'ROUTE_LOADING' }
  | { kind: 'READY' }
  | { kind: 'INCOMPLETE_OR_BLOCKED'; reason: string }
  | { kind: 'STALE' | 'WITHDRAWN' | 'EXPIRED'; readOnly: true }
  | { kind: 'NOT_FOUND'; expectedId: string }
  | { kind: 'VERSION_MISMATCH'; expectedVersion: string; actualVersion: string }
  | { kind: 'MALFORMED_ROUTE'; reason: string }
  | {
      kind: 'DOWNSTREAM_UNAVAILABLE' | 'RECOVERABLE_ERROR';
      retryIdentity: { id: string; version: string };
    };

const keys: Record<MarkregView, [string, string]> = {
  consultation: ['consultationId', 'consultationVersion'],
  'recommendation-plan': ['recommendationId', 'recommendationVersion'],
  quote: ['quoteId', 'quoteVersion'],
  'customer-confirmation': ['confirmationId', 'confirmationVersion'],
  order: ['orderId', 'orderVersion'],
  'matter-draft': ['matterDraftId', 'matterDraftVersion'],
  'formal-matter': ['formalMatterId', 'formalMatterVersion'],
  documents: ['professionalReviewCaseId', 'reviewDecisionVersion'],
  'preparation-lock': ['preparationLockId', 'preparationLockVersion'],
  'filing-authorization': ['filingAuthorizationId', 'filingAuthorizationVersion']
};

export function parseMarkregRoute(input: string | URLSearchParams): MarkregRouteResult {
  const params =
    typeof input === 'string'
      ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
      : input;
  const rawView = params.get('view');
  if (!rawView) return { kind: 'MALFORMED_ROUTE', reason: 'A governed view is required.' };
  if (!MARKREG_VIEWS.includes(rawView as MarkregView))
    return { kind: 'UNSUPPORTED_ROUTE', view: rawView };
  const view = rawView as MarkregView;
  const [idKey, versionKey] = keys[view];
  const recordId = params.get(idKey)?.trim();
  const version = params.get(versionKey)?.trim();
  if (!recordId || !version)
    return {
      kind: 'MALFORMED_ROUTE',
      reason: `${idKey} and ${versionKey} are required.`
    };
  return { kind: 'VALID', route: { view, recordId, expectedVersion: version } };
}

export const validateMarkregRoute = (route: MarkregRoute) =>
  parseMarkregRoute(serializeMarkregRoute(route));
export function serializeMarkregRoute(route: MarkregRoute): string {
  const [idKey, versionKey] = keys[route.view];
  return `?${new URLSearchParams({ view: route.view, [idKey]: route.recordId, [versionKey]: String(route.expectedVersion) })}`;
}
export function canonicalizeMarkregRoute(input: string | URLSearchParams): MarkregRouteResult {
  const result = parseMarkregRoute(input);
  return result.kind === 'VALID' ? parseMarkregRoute(serializeMarkregRoute(result.route)) : result;
}
export const expectedMarkregIdentity = (route: MarkregRoute) => ({
  id: route.recordId,
  version: route.expectedVersion
});
