import { useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';

export const KNOWLEDGE_PLATFORM_UNAVAILABLE_TEXT =
  'Unavailable is not the same as healthy, empty, zero, COMPLETE, or UNKNOWN owner evidence. No fallback state is inferred.';
export const KNOWLEDGE_PLATFORM_BOUNDARY_TEXT =
  'This is Knowledge owner-local evidence-supply operational truth only. It is not legal sufficiency, source authority ranking, Recommendation, product readiness, MO platform-wide health, or Official Truth. Deeper administration remains in Knowledge Admin.';

const HEALTH_STATES = ['HEALTHY', 'DEGRADED', 'STALE', 'BLOCKED', 'PARTIAL', 'UNKNOWN'] as const;
const COVERAGE_STATES = ['COMPLETE', 'PARTIAL', 'UNKNOWN'] as const;
const FRESHNESS_STATES = ['FRESH', 'STALE', 'UNOBSERVED'] as const;
const SCHEDULE_STATES = ['UNCONFIGURED', 'MANUAL', 'AUTOMATIC', 'MIXED'] as const;

type HealthState = (typeof HEALTH_STATES)[number];
type CoverageState = (typeof COVERAGE_STATES)[number];
type FreshnessState = (typeof FRESHNESS_STATES)[number];
type ScheduleState = (typeof SCHEDULE_STATES)[number];

export interface KnowledgeOwnerHealthItem {
  targetId: string;
  jurisdiction: string;
  authorityName: string;
  authorityLevel: string;
  family: string;
  displayName: string;
  sourceIds: readonly string[];
  state: HealthState;
  reasonCodes: readonly string[];
  coverage: { state: CoverageState; reasons: readonly string[] } & Readonly<
    Record<string, unknown>
  >;
  freshness: {
    state: FreshnessState;
    lastSuccessfulAcquisitionAt: string | null;
  } & Readonly<Record<string, unknown>>;
  schedule: { state: ScheduleState } & Readonly<Record<string, unknown>>;
  reliability: {
    attempts: number;
    failed: number;
    unrecoveredFailure: boolean;
  } & Readonly<Record<string, unknown>>;
  latency: Readonly<Record<string, unknown>>;
  changeActivity: {
    updates30d: number;
    lastObservedChangeAt: string | null;
  } & Readonly<Record<string, unknown>>;
  observedAt: string;
}

export interface KnowledgeOwnerHealthResult {
  protocolVersion: '1.0';
  objectType: 'CONTROL_PLANE_EVIDENCE_SUPPLY_HEALTH_OWNER_RESULT';
  owner: 'KNOWLEDGE';
  access: 'READ_ONLY';
  requiredUpstreamAuthority: 'control-plane:knowledge:read';
  sourceReadModel: 'evidence-supply-health.v1';
  workspaceId: string;
  observedAt: string;
  items: readonly KnowledgeOwnerHealthItem[];
  summary: {
    total: number;
    byState: Readonly<Record<HealthState, number>>;
    coverage: Readonly<Record<CoverageState, number>>;
    requiringAttention: number;
    stale: number;
    blocked: number;
    recentChanges30d: number;
  };
}

const FORBIDDEN_KEYS = new Set([
  'rawArtifact',
  'rawArtifactBytes',
  'documentBody',
  'adminSession',
  'secret',
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

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}

function enumValue(value: unknown, values: readonly string[]): value is string {
  return typeof value === 'string' && values.includes(value);
}

function containsForbidden(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbidden);
  const source = record(value);
  if (!source) return false;
  return Object.entries(source).some(
    ([key, child]) => FORBIDDEN_KEYS.has(key) || containsForbidden(child)
  );
}

function countRecord(value: unknown, keys: readonly string[]): boolean {
  const source = record(value);
  return Boolean(source && keys.every((key) => nonNegativeInteger(source[key])));
}

function validItem(value: unknown): value is KnowledgeOwnerHealthItem {
  const item = record(value);
  const coverage = record(item?.coverage);
  const freshness = record(item?.freshness);
  const schedule = record(item?.schedule);
  const reliability = record(item?.reliability);
  const change = record(item?.changeActivity);
  return Boolean(
    item &&
    !containsForbidden(item) &&
    [
      item.targetId,
      item.jurisdiction,
      item.authorityName,
      item.authorityLevel,
      item.family,
      item.displayName
    ].every(nonEmpty) &&
    stringArray(item.sourceIds) &&
    enumValue(item.state, HEALTH_STATES) &&
    stringArray(item.reasonCodes) &&
    coverage &&
    enumValue(coverage.state, COVERAGE_STATES) &&
    stringArray(coverage.reasons) &&
    freshness &&
    enumValue(freshness.state, FRESHNESS_STATES) &&
    (freshness.lastSuccessfulAcquisitionAt === null ||
      timestamp(freshness.lastSuccessfulAcquisitionAt)) &&
    schedule &&
    enumValue(schedule.state, SCHEDULE_STATES) &&
    reliability &&
    nonNegativeInteger(reliability.attempts) &&
    nonNegativeInteger(reliability.failed) &&
    typeof reliability.unrecoveredFailure === 'boolean' &&
    record(item.latency) &&
    change &&
    nonNegativeInteger(change.updates30d) &&
    (change.lastObservedChangeAt === null || timestamp(change.lastObservedChangeAt)) &&
    timestamp(item.observedAt)
  );
}

export function parseKnowledgeOwnerHealth(value: unknown): KnowledgeOwnerHealthResult | undefined {
  const source = record(value);
  const summary = record(source?.summary);
  if (
    !source ||
    containsForbidden(source) ||
    source.protocolVersion !== '1.0' ||
    source.objectType !== 'CONTROL_PLANE_EVIDENCE_SUPPLY_HEALTH_OWNER_RESULT' ||
    source.owner !== 'KNOWLEDGE' ||
    source.access !== 'READ_ONLY' ||
    source.requiredUpstreamAuthority !== 'control-plane:knowledge:read' ||
    source.sourceReadModel !== 'evidence-supply-health.v1' ||
    !nonEmpty(source.workspaceId) ||
    !timestamp(source.observedAt) ||
    !Array.isArray(source.items) ||
    !source.items.every(validItem) ||
    !summary ||
    !nonNegativeInteger(summary.total) ||
    summary.total !== source.items.length ||
    !countRecord(summary.byState, HEALTH_STATES) ||
    !countRecord(summary.coverage, COVERAGE_STATES) ||
    !nonNegativeInteger(summary.requiringAttention) ||
    !nonNegativeInteger(summary.stale) ||
    !nonNegativeInteger(summary.blocked) ||
    !nonNegativeInteger(summary.recentChanges30d)
  )
    return undefined;
  return structuredClone(source) as unknown as KnowledgeOwnerHealthResult;
}

function selectedWorkspaceId(): string {
  const value = sessionStorage.getItem('markorbit-workspace-id');
  if (!value) throw new Error('Select a Workspace before reading Knowledge owner health.');
  return value;
}

export async function loadKnowledgeOwnerHealth(
  fetchImpl: typeof fetch = fetch,
  workspaceId = selectedWorkspaceId()
): Promise<KnowledgeOwnerHealthResult> {
  const response = await fetchImpl('/api/internal/control-plane/knowledge/evidence-supply-health', {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json', 'X-MarkOrbit-Workspace-Id': workspaceId }
  });
  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const failure = record(value);
    const code = typeof failure?.code === 'string' ? ` | ${failure.code}` : '';
    throw new Error(`Knowledge owner health unavailable (${response.status}${code}).`);
  }
  const parsed = parseKnowledgeOwnerHealth(value);
  if (!parsed || parsed.workspaceId !== workspaceId)
    throw new Error('Knowledge owner health is malformed and cannot be trusted.');
  return parsed;
}

function countLabels(counts: Readonly<Record<string, number>>): string {
  return Object.entries(counts)
    .map(([state, count]) => `${state}: ${count}`)
    .join(' | ');
}

function optionalFact(value: string | null): string {
  return value ?? 'Unobserved';
}

export function KnowledgePlatformWorkspace() {
  const [snapshot, setSnapshot] = useState<KnowledgeOwnerHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setSnapshot(null);
    setError(null);
    try {
      setSnapshot(await loadKnowledgeOwnerHealth());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Knowledge owner health is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="knowledge-platform">
      <PageHeader
        title="Knowledge"
        description="Workspace-scoped, bounded read-only Evidence Supply Health from the Knowledge owner."
      />
      <Card>
        <h2>Current owner snapshot</h2>
        <p>
          The browser selects a Workspace, but Core validates both Knowledge operator authority and
          Workspace membership before Gateway reads the owner projection. No owner state is inferred
          before an explicit read.
        </p>
        <Button disabled={loading} onClick={() => void load()}>
          {loading
            ? 'Loading owner health...'
            : snapshot
              ? 'Reload owner health'
              : 'Load owner health'}
        </Button>
      </Card>

      {!loading && !snapshot && !error && (
        <p>
          No Knowledge owner health loaded. Load owner health to determine current evidence-supply
          state. {KNOWLEDGE_PLATFORM_UNAVAILABLE_TEXT}
        </p>
      )}
      {loading && (
        <Alert tone="info" title="Loading Knowledge owner health">
          Reading the bounded workspace-scoped owner projection through the governed Gateway.
        </Alert>
      )}
      {!loading && error && (
        <Alert tone="warning" title="Knowledge owner health unavailable">
          {error} {KNOWLEDGE_PLATFORM_UNAVAILABLE_TEXT}
        </Alert>
      )}

      {!loading && snapshot && (
        <>
          <Alert tone="info" title="Knowledge owner-reported evidence supply health">
            These states are canonical Knowledge evidence-supply observations for Workspace{' '}
            <strong>{snapshot.workspaceId}</strong>. UNKNOWN and PARTIAL remain owner states; they
            are not converted into healthy, empty, or complete.
          </Alert>
          <div className="mo-grid" style={{ overflowWrap: 'anywhere' }}>
            <Card>
              <h2>Owner and currentness</h2>
              <DataList
                items={[
                  { label: 'Source owner', value: snapshot.owner },
                  { label: 'Access', value: snapshot.access },
                  { label: 'Authority', value: snapshot.requiredUpstreamAuthority },
                  { label: 'Source read model', value: snapshot.sourceReadModel },
                  { label: 'Protocol', value: snapshot.protocolVersion },
                  { label: 'Workspace', value: snapshot.workspaceId },
                  { label: 'Observed at', value: new Date(snapshot.observedAt).toLocaleString() },
                  {
                    label: 'Currentness',
                    value: 'Owner observation time only | no Control Center freshness SLA'
                  }
                ]}
              />
            </Card>
            <Card>
              <h2>Evidence supply summary</h2>
              <DataList
                items={[
                  { label: 'Targets', value: String(snapshot.summary.total) },
                  { label: 'Health states', value: countLabels(snapshot.summary.byState) },
                  { label: 'Coverage', value: countLabels(snapshot.summary.coverage) },
                  {
                    label: 'Requiring attention',
                    value: String(snapshot.summary.requiringAttention)
                  },
                  { label: 'Stale', value: String(snapshot.summary.stale) },
                  { label: 'Blocked', value: String(snapshot.summary.blocked) },
                  {
                    label: 'Recent changes (30d)',
                    value: String(snapshot.summary.recentChanges30d)
                  }
                ]}
              />
            </Card>
          </div>

          {snapshot.items.map((item) => (
            <Card key={item.targetId}>
              <h3>{item.displayName}</h3>
              <DataList
                items={[
                  { label: 'Jurisdiction', value: item.jurisdiction },
                  { label: 'Authority', value: `${item.authorityName} | ${item.authorityLevel}` },
                  { label: 'Family', value: item.family },
                  { label: 'Supply state', value: item.state },
                  { label: 'Coverage', value: item.coverage.state },
                  { label: 'Freshness', value: item.freshness.state },
                  { label: 'Schedule', value: item.schedule.state },
                  {
                    label: 'Reason codes',
                    value: item.reasonCodes.length ? item.reasonCodes.join(' | ') : 'None reported'
                  },
                  {
                    label: 'Coverage reasons',
                    value: item.coverage.reasons.length
                      ? item.coverage.reasons.join(' | ')
                      : 'None reported'
                  },
                  {
                    label: 'Last successful acquisition',
                    value: optionalFact(item.freshness.lastSuccessfulAcquisitionAt)
                  },
                  { label: 'Reliability attempts', value: String(item.reliability.attempts) },
                  { label: 'Reliability failures', value: String(item.reliability.failed) },
                  {
                    label: 'Unrecovered failure',
                    value: item.reliability.unrecoveredFailure ? 'Yes' : 'No'
                  },
                  { label: 'Changes (30d)', value: String(item.changeActivity.updates30d) },
                  {
                    label: 'Last observed change',
                    value: optionalFact(item.changeActivity.lastObservedChangeAt)
                  },
                  { label: 'Target observed at', value: new Date(item.observedAt).toLocaleString() }
                ]}
              />
            </Card>
          ))}

          <Card>
            <h2>Boundary</h2>
            <p>{KNOWLEDGE_PLATFORM_BOUNDARY_TEXT}</p>
          </Card>
        </>
      )}
    </section>
  );
}
