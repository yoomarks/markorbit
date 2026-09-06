import { createApiClient, type ApiClient } from './client.js';
import { MarkregApiError } from './errors.js';

/**
 * Web-owned display model for the Workspace Action Center.
 *
 * The owner transport is intentionally read as unknown because Workspace Action Projection V1
 * remains owner-local. This module validates only the fields the UI renders and preserves the
 * owner's three groupings verbatim; it does not duplicate or reconstruct owner classification.
 */
export interface WorkspaceActionItemView {
  matterId: string;
  matterVersion: number | string;
  trademark?: string;
  applicant?: string;
  jurisdiction?: string;
  currentnessLabel: string;
  lifecycleLabel?: string;
  lifecycleSummary?: string;
  actionTitle?: string;
  actionExplanation?: string;
  examinationLabel?: string;
  examinationSummary?: string;
  lastChangedAt: string;
}

export interface WorkspaceActionCenterView {
  workspaceId: string;
  generatedAt: string;
  truncated: boolean;
  needsAttention: readonly WorkspaceActionItemView[];
  waitingOrInProgress: readonly WorkspaceActionItemView[];
  recentlyChanged: readonly WorkspaceActionItemView[];
}

export interface WorkspaceActionClient {
  get(): Promise<WorkspaceActionCenterView>;
}

type JsonObject = Record<string, unknown>;

const authorityFields = [
  'protectedActionAuthorized',
  'filingAuthorized',
  'filingSubmitted',
  'paymentCreated',
  'providerContacted',
  'officeMutationCreated',
  'officialTruthCreated'
] as const;

function invalidProjection(message: string): MarkregApiError {
  return new MarkregApiError(
    'recoverable',
    message,
    undefined,
    'WORKSPACE_ACTION_PROJECTION_INVALID',
    503
  );
}

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw invalidProjection(`Workspace Action ${field} is unavailable.`);
  return value as JsonObject;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw invalidProjection(`Workspace Action ${field} is unavailable.`);
  return value;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function version(value: unknown): number | string {
  if ((typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value))
    return value;
  throw invalidProjection('Workspace Action Matter version is unavailable.');
}

function timestamp(value: unknown, field: string): string {
  const raw = text(value, field);
  if (Number.isNaN(new Date(raw).getTime()))
    throw invalidProjection(`Workspace Action ${field} is invalid.`);
  return raw;
}

function assertNoAuthority(value: JsonObject, field: string) {
  if (value['officialStatusVerified'] !== false)
    throw invalidProjection(`Workspace Action ${field} crossed the Official Status boundary.`);

  const consequences = object(value['authorityConsequences'], `${field} authority consequences`);
  for (const key of authorityFields)
    if (consequences[key] !== false)
      throw invalidProjection(`Workspace Action ${field} crossed a protected authority boundary.`);
}

function currentnessLabel(value: unknown): string {
  switch (value) {
    case 'CURRENT':
      return 'Current owner projection';
    case 'NO_LIFECYCLE':
      return 'Lifecycle view not established';
    case 'STALE':
      return 'Lifecycle view not current';
    default:
      throw invalidProjection('Workspace Action currentness is unavailable.');
  }
}

function parseItem(value: unknown): WorkspaceActionItemView {
  const item = object(value, 'item');
  assertNoAuthority(item, 'item');

  const formalMatter = object(item['formalMatter'], 'Formal Matter identity');
  const lifecycleValue = item['lifecycle'];
  const lifecycle =
    lifecycleValue === null ? undefined : object(lifecycleValue, 'Lifecycle projection');
  if (lifecycle && lifecycle['officialStatusVerified'] !== false)
    throw invalidProjection('Workspace Action Lifecycle crossed the Official Status boundary.');

  const actionValue = item['recommendedAction'];
  const action = actionValue === null ? undefined : object(actionValue, 'Recommended Action');
  if (action && action['executionAuthorized'] !== false)
    throw invalidProjection('Workspace Action Recommendation crossed the authorization boundary.');

  const examinationValue = item['examination'];
  const examination =
    examinationValue === null ? undefined : object(examinationValue, 'Examination projection');
  if (
    examination &&
    (examination['officialStatusVerified'] !== false ||
      examination['deadline'] !== null ||
      examination['deadlineStatus'] !== 'UNAVAILABLE')
  )
    throw invalidProjection('Workspace Action Examination crossed an official-truth boundary.');

  const trademark = optionalText(formalMatter['trademark']);
  const applicant = optionalText(formalMatter['applicant']);
  const jurisdiction = optionalText(formalMatter['jurisdiction']);

  return {
    matterId: text(formalMatter['id'], 'Matter id'),
    matterVersion: version(formalMatter['version']),
    ...(trademark ? { trademark } : {}),
    ...(applicant ? { applicant } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    currentnessLabel: currentnessLabel(item['currentness']),
    ...(lifecycle
      ? {
          lifecycleLabel: text(lifecycle['customerSafeLabel'], 'Lifecycle label'),
          lifecycleSummary: text(lifecycle['customerSafeSummary'], 'Lifecycle summary')
        }
      : {}),
    ...(action
      ? {
          actionTitle: text(action['title'], 'Recommended Action title'),
          actionExplanation: text(action['explanation'], 'Recommended Action explanation')
        }
      : {}),
    ...(examination
      ? {
          examinationLabel: text(examination['customerSafeLabel'], 'Examination label'),
          examinationSummary: text(examination['customerSafeSummary'], 'Examination summary')
        }
      : {}),
    lastChangedAt: timestamp(item['lastChangedAt'], 'last changed timestamp')
  };
}

function group(projection: JsonObject, key: string): readonly WorkspaceActionItemView[] {
  const value = projection[key];
  if (!Array.isArray(value))
    throw invalidProjection(`Workspace Action ${key} group is unavailable.`);
  return value.map(parseItem);
}

function parseProjection(value: unknown): WorkspaceActionCenterView {
  const envelope = object(value, 'response');
  const projection = object(envelope['workspaceActions'], 'projection');
  if (projection['schemaVersion'] !== 1)
    throw invalidProjection('Workspace Action schema version is unsupported.');
  if (typeof projection['truncated'] !== 'boolean')
    throw invalidProjection('Workspace Action truncation state is unavailable.');
  assertNoAuthority(projection, 'projection');

  return {
    workspaceId: text(projection['workspaceId'], 'Workspace id'),
    generatedAt: timestamp(projection['generatedAt'], 'generated timestamp'),
    truncated: projection['truncated'],
    needsAttention: group(projection, 'needsAttention'),
    waitingOrInProgress: group(projection, 'waitingOrInProgress'),
    recentlyChanged: group(projection, 'recentlyChanged')
  };
}

export function createWorkspaceActionClient(
  api: ApiClient = createApiClient()
): WorkspaceActionClient {
  return {
    async get() {
      const response = await api.get<unknown>('/api/markreg/workspace-actions');
      return parseProjection(response);
    }
  };
}
