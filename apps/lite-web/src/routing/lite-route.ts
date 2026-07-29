export const LITE_WORK_VIEWS = [
  'professional-review',
  'execution-release',
  'filing-task-draft'
] as const;
export type LiteWorkView = (typeof LITE_WORK_VIEWS)[number];
export type LiteRoute = {
  section: 'work';
  view: LiteWorkView;
  recordId: string;
  expectedVersion: string;
};
export type LiteRouteResult =
  | { kind: 'VALID'; route: LiteRoute }
  | { kind: 'MALFORMED_ROUTE'; reason: string }
  | { kind: 'UNSUPPORTED_ROUTE'; view: string };
const keys: Record<LiteWorkView, [string, string]> = {
  'professional-review': ['professionalReviewCaseId', 'professionalReviewCaseVersion'],
  'execution-release': ['executionReleaseId', 'executionReleaseVersion'],
  'filing-task-draft': ['filingExecutionTaskDraftId', 'filingExecutionTaskDraftVersion']
};
export function parseLiteRoute(input: string | URLSearchParams): LiteRouteResult {
  const p =
    typeof input === 'string'
      ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
      : input;
  if (p.get('section') !== 'work')
    return { kind: 'MALFORMED_ROUTE', reason: 'Governed Lite routes must remain under Work.' };
  const raw = p.get('view');
  if (!raw) return { kind: 'MALFORMED_ROUTE', reason: 'A Work view is required.' };
  if (!LITE_WORK_VIEWS.includes(raw as LiteWorkView))
    return { kind: 'UNSUPPORTED_ROUTE', view: raw };
  const view = raw as LiteWorkView;
  const [idKey, versionKey] = keys[view];
  const recordId = p.get(idKey)?.trim();
  const version = p.get(versionKey)?.trim();
  if (!recordId || !version)
    return {
      kind: 'MALFORMED_ROUTE',
      reason: `${idKey} and ${versionKey} are required.`
    };
  return { kind: 'VALID', route: { section: 'work', view, recordId, expectedVersion: version } };
}
export function serializeLiteRoute(route: LiteRoute): string {
  const [idKey, versionKey] = keys[route.view];
  return `?${new URLSearchParams({ section: 'work', view: route.view, [idKey]: route.recordId, [versionKey]: String(route.expectedVersion) })}`;
}
export const validateLiteRoute = (route: LiteRoute) => parseLiteRoute(serializeLiteRoute(route));
export const canonicalizeLiteRoute = (input: string | URLSearchParams) => {
  const r = parseLiteRoute(input);
  return r.kind === 'VALID' ? parseLiteRoute(serializeLiteRoute(r.route)) : r;
};
export const expectedLiteIdentity = (route: LiteRoute) => ({
  id: route.recordId,
  version: route.expectedVersion
});
