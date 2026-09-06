export const KNOWLEDGE_OWNER_PROTOCOL_VERSION = '1.0' as const;
export const KNOWLEDGE_OWNER_OBJECT_TYPE =
  'CONTROL_PLANE_EVIDENCE_SUPPLY_HEALTH_OWNER_RESULT' as const;
export const KNOWLEDGE_OWNER_SOURCE = 'KNOWLEDGE' as const;
export const KNOWLEDGE_OWNER_ACCESS = 'READ_ONLY' as const;
export const KNOWLEDGE_READ_AUTHORITY = 'control-plane:knowledge:read' as const;
export const KNOWLEDGE_SOURCE_READ_MODEL = 'evidence-supply-health.v1' as const;

export const KNOWLEDGE_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED',
  'STALE',
  'BLOCKED',
  'PARTIAL',
  'UNKNOWN'
] as const;
export type KnowledgeHealthState = (typeof KNOWLEDGE_HEALTH_STATES)[number];

export const KNOWLEDGE_COVERAGE_STATES = ['COMPLETE', 'PARTIAL', 'UNKNOWN'] as const;
export type KnowledgeCoverageState = (typeof KNOWLEDGE_COVERAGE_STATES)[number];

export const KNOWLEDGE_FRESHNESS_STATES = ['FRESH', 'STALE', 'UNOBSERVED'] as const;
export type KnowledgeFreshnessState = (typeof KNOWLEDGE_FRESHNESS_STATES)[number];

export const KNOWLEDGE_SCHEDULE_STATES = ['UNCONFIGURED', 'MANUAL', 'AUTOMATIC', 'MIXED'] as const;
export type KnowledgeScheduleState = (typeof KNOWLEDGE_SCHEDULE_STATES)[number];

type Facts = Readonly<Record<string, unknown>>;

export interface KnowledgeEvidenceSupplyHealthOwnerItem {
  targetId: string;
  jurisdiction: string;
  authorityName: string;
  authorityLevel: string;
  family: string;
  displayName: string;
  sourceIds: readonly string[];
  state: KnowledgeHealthState;
  reasonCodes: readonly string[];
  coverage: Facts & { state: KnowledgeCoverageState; reasons: readonly string[] };
  freshness: Facts & {
    state: KnowledgeFreshnessState;
    lastSuccessfulAcquisitionAt: string | null;
  };
  schedule: Facts & { state: KnowledgeScheduleState };
  currentRun: Facts | null;
  reliability: Facts & { attempts: number; failed: number; unrecoveredFailure: boolean };
  latency: Facts;
  changeActivity: Facts & { updates30d: number; lastObservedChangeAt: string | null };
  observedAt: string;
}

export interface KnowledgeEvidenceSupplyHealthOwnerResult {
  protocolVersion: typeof KNOWLEDGE_OWNER_PROTOCOL_VERSION;
  objectType: typeof KNOWLEDGE_OWNER_OBJECT_TYPE;
  owner: typeof KNOWLEDGE_OWNER_SOURCE;
  access: typeof KNOWLEDGE_OWNER_ACCESS;
  requiredUpstreamAuthority: typeof KNOWLEDGE_READ_AUTHORITY;
  sourceReadModel: typeof KNOWLEDGE_SOURCE_READ_MODEL;
  workspaceId: string;
  observedAt: string;
  items: readonly KnowledgeEvidenceSupplyHealthOwnerItem[];
  summary: {
    total: number;
    byState: Readonly<Record<KnowledgeHealthState, number>>;
    coverage: Readonly<Record<KnowledgeCoverageState, number>>;
    requiringAttention: number;
    stale: number;
    blocked: number;
    recentChanges30d: number;
  };
}

const FORBIDDEN_OWNER_KEYS = new Set([
  'canonicalUri',
  'content',
  'rawArtifact',
  'rawArtifactBytes',
  'adminNavigation',
  'adminSession',
  'secret',
  'documentBody',
  'legalConclusion',
  'relevanceScore',
  'providerRanking',
  'sql',
  'mutationGuidance',
  'recommendation'
]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries: unknown[] = value;
  if (entries.some((entry) => !nonEmptyString(entry))) return undefined;
  return entries.map((entry) => String(entry).trim());
}

function ownerTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function nullableTimestamp(value: unknown): value is string | null {
  return value === null || ownerTimestamp(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  values: T
): value is T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function containsForbiddenOwnerKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenOwnerKey);
  const source = record(value);
  if (!source) return false;
  return Object.entries(source).some(
    ([key, child]) => FORBIDDEN_OWNER_KEYS.has(key) || containsForbiddenOwnerKey(child)
  );
}

function facts(value: unknown): Facts | undefined {
  const source = record(value);
  if (!source || containsForbiddenOwnerKey(source)) return undefined;
  return Object.freeze(structuredClone(source));
}

function parseItem(value: unknown): KnowledgeEvidenceSupplyHealthOwnerItem | undefined {
  const source = record(value);
  const sourceIds = stringArray(source?.sourceIds);
  const reasonCodes = stringArray(source?.reasonCodes);
  const coverage = facts(source?.coverage);
  const freshness = facts(source?.freshness);
  const schedule = facts(source?.schedule);
  const currentRun = source?.currentRun === null ? null : facts(source?.currentRun);
  const reliability = facts(source?.reliability);
  const latency = facts(source?.latency);
  const changeActivity = facts(source?.changeActivity);

  if (
    !source ||
    containsForbiddenOwnerKey(source) ||
    !nonEmptyString(source.targetId) ||
    !nonEmptyString(source.jurisdiction) ||
    !nonEmptyString(source.authorityName) ||
    !nonEmptyString(source.authorityLevel) ||
    !nonEmptyString(source.family) ||
    !nonEmptyString(source.displayName) ||
    !sourceIds ||
    !enumValue(source.state, KNOWLEDGE_HEALTH_STATES) ||
    !reasonCodes ||
    !coverage ||
    !enumValue(coverage.state, KNOWLEDGE_COVERAGE_STATES) ||
    !stringArray(coverage.reasons) ||
    !freshness ||
    !enumValue(freshness.state, KNOWLEDGE_FRESHNESS_STATES) ||
    !nullableTimestamp(freshness.lastSuccessfulAcquisitionAt) ||
    !schedule ||
    !enumValue(schedule.state, KNOWLEDGE_SCHEDULE_STATES) ||
    currentRun === undefined ||
    !reliability ||
    !nonNegativeInteger(reliability.attempts) ||
    !nonNegativeInteger(reliability.failed) ||
    typeof reliability.unrecoveredFailure !== 'boolean' ||
    !latency ||
    !changeActivity ||
    !nonNegativeInteger(changeActivity.updates30d) ||
    !nullableTimestamp(changeActivity.lastObservedChangeAt) ||
    !ownerTimestamp(source.observedAt)
  )
    return undefined;

  return Object.freeze({
    targetId: source.targetId.trim(),
    jurisdiction: source.jurisdiction.trim(),
    authorityName: source.authorityName.trim(),
    authorityLevel: source.authorityLevel.trim(),
    family: source.family.trim(),
    displayName: source.displayName.trim(),
    sourceIds: Object.freeze(sourceIds),
    state: source.state,
    reasonCodes: Object.freeze(reasonCodes),
    coverage: coverage as KnowledgeEvidenceSupplyHealthOwnerItem['coverage'],
    freshness: freshness as KnowledgeEvidenceSupplyHealthOwnerItem['freshness'],
    schedule: schedule as KnowledgeEvidenceSupplyHealthOwnerItem['schedule'],
    currentRun,
    reliability: reliability as KnowledgeEvidenceSupplyHealthOwnerItem['reliability'],
    latency,
    changeActivity: changeActivity as KnowledgeEvidenceSupplyHealthOwnerItem['changeActivity'],
    observedAt: source.observedAt
  });
}

function countRecord<const T extends readonly string[]>(
  value: unknown,
  keys: T
): Readonly<Record<T[number], number>> | undefined {
  const source = record(value);
  if (!source) return undefined;
  const result = {} as Record<T[number], number>;
  for (const key of keys) {
    if (!nonNegativeInteger(source[key])) return undefined;
    result[key as T[number]] = source[key];
  }
  return Object.freeze(result);
}

export function parseKnowledgeEvidenceSupplyHealthOwnerResult(
  value: unknown,
  expectedWorkspaceId?: string
): KnowledgeEvidenceSupplyHealthOwnerResult | undefined {
  const source = record(value);
  const summary = record(source?.summary);
  const byState = countRecord(summary?.byState, KNOWLEDGE_HEALTH_STATES);
  const coverage = countRecord(summary?.coverage, KNOWLEDGE_COVERAGE_STATES);

  if (
    !source ||
    containsForbiddenOwnerKey(source) ||
    source.protocolVersion !== KNOWLEDGE_OWNER_PROTOCOL_VERSION ||
    source.objectType !== KNOWLEDGE_OWNER_OBJECT_TYPE ||
    source.owner !== KNOWLEDGE_OWNER_SOURCE ||
    source.access !== KNOWLEDGE_OWNER_ACCESS ||
    source.requiredUpstreamAuthority !== KNOWLEDGE_READ_AUTHORITY ||
    source.sourceReadModel !== KNOWLEDGE_SOURCE_READ_MODEL ||
    !nonEmptyString(source.workspaceId) ||
    (expectedWorkspaceId !== undefined && source.workspaceId !== expectedWorkspaceId) ||
    !ownerTimestamp(source.observedAt) ||
    !Array.isArray(source.items) ||
    !summary ||
    !byState ||
    !coverage ||
    !nonNegativeInteger(summary.total) ||
    !nonNegativeInteger(summary.requiringAttention) ||
    !nonNegativeInteger(summary.stale) ||
    !nonNegativeInteger(summary.blocked) ||
    !nonNegativeInteger(summary.recentChanges30d)
  )
    return undefined;

  const items = source.items.map(parseItem);
  if (items.some((item) => item === undefined) || summary.total !== items.length) return undefined;

  return Object.freeze({
    protocolVersion: KNOWLEDGE_OWNER_PROTOCOL_VERSION,
    objectType: KNOWLEDGE_OWNER_OBJECT_TYPE,
    owner: KNOWLEDGE_OWNER_SOURCE,
    access: KNOWLEDGE_OWNER_ACCESS,
    requiredUpstreamAuthority: KNOWLEDGE_READ_AUTHORITY,
    sourceReadModel: KNOWLEDGE_SOURCE_READ_MODEL,
    workspaceId: source.workspaceId,
    observedAt: source.observedAt,
    items: Object.freeze(items as KnowledgeEvidenceSupplyHealthOwnerItem[]),
    summary: Object.freeze({
      total: summary.total,
      byState,
      coverage,
      requiringAttention: summary.requiringAttention,
      stale: summary.stale,
      blocked: summary.blocked,
      recentChanges30d: summary.recentChanges30d
    })
  });
}
