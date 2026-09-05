import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  createMatterWorkspaceClient,
  MatterWorkspaceHttpError,
  type MatterWorkspaceClient
} from '../../api/matters.js';
import { updateLiteLocation } from '../../routing/workspace-navigation.js';

const current = () => new URLSearchParams(location.search);

function navigateMatter(
  workspaceId: string,
  values: Record<string, string | number | undefined>,
  replace = false
) {
  updateLiteLocation(
    {
      surface: 'matters',
      workspaceId,
      params: values
    },
    { preserveSearch: true, replace }
  );
}

export function MatterWorkspace({
  workspaceId,
  client: suppliedClient
}: {
  workspaceId: string;
  client?: MatterWorkspaceClient;
}) {
  const client = useMemo(
    () => suppliedClient ?? createMatterWorkspaceClient(workspaceId),
    [suppliedClient, workspaceId]
  );
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<FormalMatterListResponse>();
  const [detail, setDetail] = useState<FormalMatter>();
  const [error, setError] = useState<{ status?: number; message: string }>();
  const [loading, setLoading] = useState(true);
  const origin = useRef<string>();
  const priorWorkspace = useRef(workspaceId);

  useEffect(() => {
    const workspaceChanged = priorWorkspace.current !== workspaceId;
    if (workspaceChanged && current().has('formalMatterId')) {
      priorWorkspace.current = workspaceId;
      navigateMatter(workspaceId, { formalMatterId: undefined }, true);
    }
  }, [workspaceId]);

  useEffect(() => {
    const followLocation = () => setTick((value) => value + 1);
    addEventListener('popstate', followLocation);
    return () => removeEventListener('popstate', followLocation);
  }, []);

  const query = current();
  const selected = query.get('formalMatterId') ?? '';
  const search = query.get('search') ?? '';
  const status = query.get('status') ?? '';
  const type = query.get('type') ?? '';
  const page = query.get('page') ?? '1';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    setData(undefined);
    setDetail(undefined);
    const request = selected
      ? client.load(selected, controller.signal).then((formalMatter) => ({ formalMatter }))
      : client
          .list(
            {
              ...(search ? { search } : {}),
              ...(status ? { status } : {}),
              ...(type ? { type } : {}),
              page: Number(page),
              pageSize: 20
            },
            controller.signal
          )
          .then((list) => ({ list }));

    void request
      .then((result) => {
        if ('formalMatter' in result) setDetail(result.formalMatter);
        else setData(result.list);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        const next =
          cause instanceof MatterWorkspaceHttpError
            ? { status: cause.status, message: cause.message }
            : {
                status: 503,
                message: cause instanceof Error ? cause.message : 'Matter data is unavailable.'
              };
        setError(next);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [client, selected, search, status, type, page, tick]);

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
  if (error) {
    const title =
      error.status === 404
        ? 'Matter not found'
        : error.status === 403
          ? 'Matter access denied'
          : error.status === 401
            ? 'Sign in required'
            : error.status === 503
              ? 'Matter service unavailable'
              : 'Matters unavailable';
    return (
      <ErrorState
        title={title}
        description={error.message}
        onRetry={() => setTick((value) => value + 1)}
      />
    );
  }
  if (detail) {
    return (
      <MatterDetail
        matter={detail}
        client={client}
        onBack={() => navigateMatter(workspaceId, { formalMatterId: undefined })}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Matters"
        description="Durable Formal Matters in this Workspace"
        actions={<Badge>MarkReg live data</Badge>}
      />
      <p className="lite-page-intro">
        Start with the Matter that needs professional attention. Open a record for its current state,
        next bounded action, and exact owner evidence.
      </p>
      <Alert title="Read-only operational view">
        Formal Matter is owned by MarkReg. Next steps are summaries only; nothing here executes a
        protected action.
      </Alert>
      <div className="lite-filters" role="search">
        <TextInput
          label="Search Matters"
          value={search}
          onChange={(event) =>
            navigateMatter(workspaceId, { search: event.target.value, page: undefined }, true)
          }
        />
        <Select
          label="Status"
          value={status}
          onChange={(event) =>
            navigateMatter(workspaceId, { status: event.target.value, page: undefined }, true)
          }
        >
          <option value="">All statuses</option>
          <option value="OPEN">OPEN</option>
        </Select>
        <Select
          label="Matter type"
          value={type}
          onChange={(event) =>
            navigateMatter(workspaceId, { type: event.target.value, page: undefined }, true)
          }
        >
          <option value="">All types</option>
          <option value="TRADEMARK_REGISTRATION">Trademark registration</option>
        </Select>
      </div>
      {data?.items.length ? (
        <div className="lite-list" aria-live="polite">
          {data.items.map((matter) => (
            <Card key={matter.formalMatterId}>
              <div className="lite-row">
                <div>
                  <p className="lite-eyebrow">Matter · {matter.type.replaceAll('_', ' ')}</p>
                  <h2>{matter.trademark ?? matter.applicant ?? matter.formalMatterId}</h2>
                  <p>
                    {matter.applicant ?? 'Applicant not captured'} ·{' '}
                    {matter.jurisdiction ?? 'Jurisdiction not captured'} · Classes{' '}
                    {matter.classes.join(', ') || 'not captured'}
                  </p>
                </div>
                <Badge>{matter.status}</Badge>
              </div>
              <p>
                <strong>Next:</strong> Open current Matter and decide whether Professional Review is
                the appropriate bounded next step.
              </p>
              <Button
                data-matter-id={matter.formalMatterId}
                onClick={() => {
                  origin.current = matter.formalMatterId;
                  navigateMatter(workspaceId, { formalMatterId: matter.formalMatterId });
                }}
              >
                Open current Matter
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
                navigateMatter(
                  workspaceId,
                  { search: undefined, status: undefined, type: undefined, page: undefined },
                  true
                )
              }
            >
              Clear filters
            </Button>
          }
        />
      )}
      {data && (
        <nav className="lite-pagination" aria-label="Matter pages">
          <Button
            variant="secondary"
            disabled={data.page <= 1}
            onClick={() => navigateMatter(workspaceId, { page: data.page - 1 })}
          >
            Previous
          </Button>
          <span>
            Page {data.page} · {data.total} Matters
          </span>
          <Button
            variant="secondary"
            disabled={data.page * data.pageSize >= data.total}
            onClick={() => navigateMatter(workspaceId, { page: data.page + 1 })}
          >
            Next
          </Button>
        </nav>
      )}
    </>
  );
}

function MatterDetail({
  matter,
  client,
  onBack
}: {
  matter: FormalMatter;
  client: MatterWorkspaceClient;
  onBack: () => void;
}) {
  const preparation = matter.sourceSnapshot.preparation;
  const readyAtCreation = matter.sourceSnapshot.matterDraft.readiness.readyForProfessionalReview;
  const readinessLabel = readyAtCreation
    ? 'ready for professional review at creation'
    : 'not ready for professional review at creation';
  const [startingReview, setStartingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const startReview = async () => {
    setStartingReview(true);
    setReviewError('');
    try {
      const reviewCase = await client.startProfessionalReview(matter);
      updateLiteLocation(
        {
          surface: 'professional-review',
          workspaceId: matter.workspaceId,
          params: {
            formalMatterId: undefined,
            professionalReviewCaseId: reviewCase.reviewCaseId,
            professionalReviewCaseVersion: reviewCase.version
          }
        },
        { preserveSearch: true }
      );
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : 'Professional Review could not be started.'
      );
    } finally {
      setStartingReview(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={onBack}>
        ← Back to Matters
      </Button>
      <PageHeader
        title={preparation.trademark ?? matter.formalMatterId}
        description="Formal Matter · current state and bounded next action"
        actions={<Badge>{matter.status}</Badge>}
      />
      {reviewError && (
        <Alert tone="danger" title="Professional Review unavailable">
          {reviewError}
        </Alert>
      )}
      <Card>
        <p className="lite-eyebrow">NEXT ACTION</p>
        <h2>Review the current Matter before moving it forward</h2>
        <p>
          This record was {readinessLabel}. Starting or resuming review records bounded professional
          review work; it does not submit a filing or create Official Truth.
        </p>
        <Button disabled={startingReview} onClick={() => void startReview()}>
          {startingReview ? 'Starting Review…' : 'Start or Resume Professional Review'}
        </Button>
      </Card>
      <div className="lite-detail-grid">
        <Card>
          <h2>Current state</h2>
          <KeyValueList
            items={[
              { key: 'Status', value: matter.status },
              { key: 'Matter type', value: matter.kind },
              {
                key: 'Applicant / owner',
                value: preparation.applicantName ?? 'Not captured'
              },
              {
                key: 'Jurisdiction',
                value: preparation.targetJurisdiction ?? 'Not captured'
              },
              { key: 'Classes', value: preparation.classes.join(', ') || 'Not captured' },
              {
                key: 'Goods / services',
                value: preparation.goodsServices ?? 'Not captured'
              }
            ]}
          />
        </Card>
        <Card>
          <h2>Creation readiness</h2>
          <ul>
            {matter.sourceSnapshot.matterDraft.readiness.checks.map((check) => (
              <li key={check.code}>
                <strong>{check.code}</strong>: {check.status} — {check.explanation}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <details className="lite-evidence-panel">
        <summary>Exact Matter evidence and immutable lineage</summary>
        <div className="lite-detail-grid">
          <Card>
            <h2>Exact owner identity</h2>
            <KeyValueList
              items={[
                { key: 'Formal Matter ID', value: matter.formalMatterId },
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
                {
                  key: 'Quote',
                  value: `${matter.sourceQuoteId} · v${matter.sourceQuoteVersion}`
                },
                { key: 'Snapshot schema', value: `v${matter.snapshotSchemaVersion}` },
                { key: 'Integrity', value: `SHA-256 captured · ${matter.snapshotSha256}` }
              ]}
            />
            <a href={`/markreg?matterDraftId=${encodeURIComponent(matter.sourceMatterDraftId)}`}>
              Open MarkReg source receipt
            </a>
          </Card>
        </div>
      </details>
    </>
  );
}
