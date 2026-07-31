import { useEffect, useRef, useState } from 'react';
import type { FormalMatter, FormalMatterListResponse } from '@markorbit/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
function parseGatewayUrl(value: unknown): string {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.origin;
  } catch {
    return '';
  }
}
const gateway = parseGatewayUrl(
  import.meta.env.VITE_LITE_GATEWAY_URL ?? import.meta.env.VITE_GATEWAY_URL
);
const current = () => new URLSearchParams(location.search);
function navigate(values: Record<string, string | undefined>, replace = false) {
  const q = current();
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) q.delete(k);
    else q.set(k, v);
  }
  history[replace ? 'replaceState' : 'pushState'](null, '', `${location.pathname}?${q}#matters`);
  dispatchEvent(new PopStateEvent('popstate'));
}
async function load<T>(path: string, workspaceId: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${gateway}${path}`, {
    credentials: 'include',
    headers: { 'x-markorbit-workspace-id': workspaceId, 'x-correlation-id': crypto.randomUUID() },
    signal
  });
  const body = (await response.json()) as { message?: string };
  if (!response.ok)
    throw Object.assign(new Error(body.message ?? 'Matter data is unavailable.'), {
      status: response.status
    });
  return body as T;
}
export function MatterWorkspace({ workspaceId }: { workspaceId: string }) {
  const [tick, setTick] = useState(0),
    [data, setData] = useState<FormalMatterListResponse>(),
    [detail, setDetail] = useState<FormalMatter>(),
    [error, setError] = useState<{ status?: number; message: string }>(),
    [loading, setLoading] = useState(true);
  const origin = useRef<string>();
  const priorWorkspace = useRef(workspaceId);
  useEffect(() => {
    if (priorWorkspace.current !== workspaceId && current().has('formalMatterId')) {
      priorWorkspace.current = workspaceId;
      navigate({ formalMatterId: undefined }, true);
    }
  }, [workspaceId]);
  useEffect(() => {
    const f = () => setTick((v) => v + 1);
    addEventListener('popstate', f);
    return () => removeEventListener('popstate', f);
  }, []);
  const q = current(),
    selected = q.get('formalMatterId') ?? '',
    search = q.get('search') ?? '',
    status = q.get('status') ?? '',
    type = q.get('type') ?? '',
    page = q.get('page') ?? '1';
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError(undefined);
    setData(undefined);
    setDetail(undefined);
    const path = selected
      ? `/api/markreg/formal-matters/${encodeURIComponent(selected)}`
      : `/api/markreg/formal-matters?${new URLSearchParams({ ...(search && { search }), ...(status && { status }), ...(type && { type }), page, pageSize: '20' })}`;
    load<{ formalMatter: FormalMatter } | FormalMatterListResponse>(path, workspaceId, c.signal)
      .then((r) => ('formalMatter' in r ? setDetail(r.formalMatter) : setData(r)))
      .catch((e: Error & { status?: number }) => {
        if (e.name !== 'AbortError')
          setError({ ...(e.status ? { status: e.status } : {}), message: e.message });
      })
      .finally(() => setLoading(false));
    return () => c.abort();
  }, [workspaceId, selected, search, status, type, page, tick]);
  useEffect(() => {
    if (!selected && origin.current) {
      const trigger = document.querySelector<HTMLButtonElement>(
        `[data-matter-id="${origin.current}"]`
      );
      if (trigger) {
        trigger.focus();
        origin.current = undefined;
      }
    }
  }, [selected, data]);
  if (loading) return <LoadingState label="Loading durable Matters" />;
  if (error)
    return (
      <ErrorState
        title={
          error.status === 404
            ? 'Matter not found'
            : error.status === 403
              ? 'Matter access denied'
              : error.status === 503
                ? 'Matter service unavailable'
                : 'Matters unavailable'
        }
        description={error.message}
        onRetry={() => setTick((v) => v + 1)}
      />
    );
  if (detail) return <MatterDetail matter={detail} onBack={() => history.back()} />;
  return (
    <>
      <PageHeader
        title="Matters"
        description="Today / Matters · durable Formal Matters in this Workspace"
        actions={<Badge>MarkReg live data</Badge>}
      />
      <Alert title="Read-only operational view">
        Formal Matter is owned by MarkReg. Next steps are summaries only; nothing here executes a
        protected action.
      </Alert>
      <div className="lite-filters" role="search">
        <TextInput
          label="Search Matters"
          value={search}
          onChange={(e) => navigate({ search: e.target.value, page: undefined }, true)}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => navigate({ status: e.target.value, page: undefined }, true)}
        >
          <option value="">All statuses</option>
          <option value="OPEN">OPEN</option>
        </Select>
        <Select
          label="Matter type"
          value={type}
          onChange={(e) => navigate({ type: e.target.value, page: undefined }, true)}
        >
          <option value="">All types</option>
          <option value="TRADEMARK_REGISTRATION">Trademark registration</option>
        </Select>
      </div>
      {data?.items.length ? (
        <div className="lite-list" aria-live="polite">
          {data.items.map((m) => (
            <Card key={m.formalMatterId}>
              <div className="lite-row">
                <div>
                  <h2>{m.trademark ?? m.applicant ?? m.formalMatterId}</h2>
                  <p>
                    {m.applicant ?? 'Applicant not captured'} ·{' '}
                    {m.jurisdiction ?? 'Jurisdiction not captured'} · Classes{' '}
                    {m.classes.join(', ') || 'not captured'}
                  </p>
                </div>
                <Badge>{m.status}</Badge>
              </div>
              <p>
                {m.type} · Created {new Date(m.createdAt).toLocaleString()}
              </p>
              <Button
                data-matter-id={m.formalMatterId}
                onClick={() => {
                  origin.current = m.formalMatterId;
                  navigate({ formalMatterId: m.formalMatterId });
                }}
              >
                View Matter details
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Matters found"
          description="No durable Formal Matter matches this Workspace and the current filters."
          action={
            <Button
              variant="secondary"
              onClick={() =>
                navigate(
                  { search: undefined, status: undefined, type: undefined, page: undefined },
                  true
                )
              }
            >
              Clear filters
            </Button>
          }
        />
      )}{' '}
      {data && (
        <nav className="lite-pagination" aria-label="Matter pages">
          <Button
            variant="secondary"
            disabled={data.page <= 1}
            onClick={() => navigate({ page: String(data.page - 1) })}
          >
            Previous
          </Button>
          <span>
            Page {data.page} · {data.total} Matters
          </span>
          <Button
            variant="secondary"
            disabled={data.page * data.pageSize >= data.total}
            onClick={() => navigate({ page: String(data.page + 1) })}
          >
            Next
          </Button>
        </nav>
      )}
    </>
  );
}
function MatterDetail({ matter, onBack }: { matter: FormalMatter; onBack: () => void }) {
  const p = matter.sourceSnapshot.preparation;
  return (
    <>
      <Button variant="secondary" onClick={onBack}>
        ← Back to Matters
      </Button>
      <PageHeader
        title={p.trademark ?? matter.formalMatterId}
        description="Formal Matter · immutable creation lineage"
        actions={<Badge>{matter.status}</Badge>}
      />
      <div className="lite-detail-grid">
        <Card>
          <h2>Current identity</h2>
          <KeyValueList
            items={[
              { key: 'Formal Matter ID', value: matter.formalMatterId },
              { key: 'Type', value: matter.kind },
              { key: 'Status', value: matter.status },
              { key: 'Version', value: String(matter.version) },
              { key: 'Workspace', value: matter.workspaceId },
              { key: 'Created', value: new Date(matter.createdAt).toLocaleString() },
              { key: 'Created by', value: matter.createdByUserId }
            ]}
          />
        </Card>
        <Card>
          <h2>Immutable source lineage</h2>
          <KeyValueList
            items={[
              {
                key: 'Customer Confirmation',
                value: `${matter.sourceCustomerConfirmationId} · v${matter.sourceCustomerConfirmationVersion}`
              },
              {
                key: 'Matter Draft',
                value: `${matter.sourceMatterDraftId} · v${matter.sourceMatterDraftVersion}`
              },
              { key: 'Quote', value: `${matter.sourceQuoteId} · v${matter.sourceQuoteVersion}` },
              { key: 'Snapshot schema', value: `v${matter.snapshotSchemaVersion}` },
              { key: 'Integrity', value: `SHA-256 captured · ${matter.snapshotSha256}` }
            ]}
          />
          <a href={`/markreg?matterDraftId=${encodeURIComponent(matter.sourceMatterDraftId)}`}>
            Open MarkReg source receipt
          </a>
        </Card>
        <Card>
          <h2>Applicant and scope</h2>
          <KeyValueList
            items={[
              { key: 'Applicant / owner', value: p.applicantName ?? 'Not captured' },
              { key: 'Address', value: p.applicantAddress ?? 'Not captured' },
              { key: 'Jurisdiction', value: p.targetJurisdiction ?? 'Not captured' },
              { key: 'Classes', value: p.classes.join(', ') || 'Not captured' },
              { key: 'Goods / services', value: p.goodsServices ?? 'Not captured' }
            ]}
          />
        </Card>
        <Card>
          <h2>Creation readiness</h2>
          <p>
            {matter.sourceSnapshot.matterDraft.readiness.readyForProfessionalReview
              ? 'Ready for professional review at creation.'
              : 'Not ready at creation.'}
          </p>
          <ul>
            {matter.sourceSnapshot.matterDraft.readiness.checks.map((c) => (
              <li key={c.code}>
                <strong>{c.code}</strong>: {c.status} — {c.explanation}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
