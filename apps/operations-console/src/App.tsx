import { useState } from 'react';
import {
  Alert,
  AppShell,
  Button,
  Card,
  DataList,
  PageHeader,
  SideNavigation,
  StatusBadge,
  TopBar
} from '@markorbit/ui';
import {
  loadOperationsLifecycle,
  type OperationsLifecycleProvenance
} from './lifecycle.js';

export function OperationsApp() {
  const [formalMatterId, setFormalMatterId] = useState('');
  const [provenance, setProvenance] = useState<OperationsLifecycleProvenance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inspect = async () => {
    if (!formalMatterId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setProvenance(await loadOperationsLifecycle(formalMatterId.trim()));
    } catch (cause) {
      setProvenance(null);
      setError(cause instanceof Error ? cause.message : 'Lifecycle provenance is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      brand="Operations Console"
      internalOnly
      navigation={
        <SideNavigation
          items={[
            { label: 'Overview', href: '#overview', active: true },
            { label: 'Lifecycle review', href: '#lifecycle-review' },
            { label: 'Reviews', href: '#reviews' },
            { label: 'Events', href: '#events' }
          ]}
        />
      }
      topBar={<TopBar context="Production operations · Governed internal view" />}
    >
      <PageHeader
        title="Operations overview"
        description="Internal triage for service exceptions, governed review evidence and lifecycle provenance."
      />
      <div className="mo-grid" id="overview">
        <Card>
          <h2>Service health</h2>
          <DataList
            items={[
              { label: 'Gateway', value: <StatusBadge status="success" /> },
              { label: 'Execution', value: <StatusBadge status="warning" /> }
            ]}
          />
        </Card>
        <Card>
          <h2>Failed operations</h2>
          <DataList
            items={[
              { label: 'Retryable', value: '3' },
              { label: 'Blocking', value: '1' }
            ]}
          />
        </Card>
        <Card>
          <h2>Manual review</h2>
          <DataList
            items={[
              { label: 'Awaiting reviewer', value: '7' },
              { label: 'Overdue', value: '2' }
            ]}
          />
        </Card>
        <Card>
          <h2>Event summary</h2>
          <DataList
            items={[
              { label: 'Processed today', value: '1,248' },
              { label: 'Pending', value: '12' }
            ]}
          />
        </Card>
      </div>

      <section id="lifecycle-review" aria-labelledby="lifecycle-review-heading">
        <PageHeader
          title="Lifecycle provenance"
          description="Inspect the exact reviewed-source chain, retry state and correction history for one Formal Matter. Requires review:perform."
        />
        <Card>
          <label htmlFor="formal-matter-id">Formal Matter ID</label>
          <div>
            <input
              id="formal-matter-id"
              value={formalMatterId}
              onChange={(event) => setFormalMatterId(event.target.value)}
              placeholder="formal-matter_…"
            />{' '}
            <Button disabled={loading || !formalMatterId.trim()} onClick={() => void inspect()}>
              {loading ? 'Inspecting…' : 'Inspect provenance'}
            </Button>
          </div>
        </Card>
        {error && (
          <Alert tone="warning" title="Provenance unavailable">
            {error}
          </Alert>
        )}
        {provenance && (
          <>
            <Alert tone="info" title="Internal governed provenance">
              This view is review and projection evidence. It is not trademark-office status,
              filing authority, payment truth or proof of submission.
            </Alert>
            <Card>
              <h3>Current lifecycle</h3>
              {provenance.currentView ? (
                <DataList
                  items={[
                    { label: 'View ID', value: provenance.currentView.lifecycleViewId },
                    { label: 'State', value: provenance.currentView.state },
                    { label: 'Customer label', value: provenance.currentView.customerSafeLabel },
                    {
                      label: 'View fingerprint',
                      value: provenance.currentView.lifecycleViewFingerprintSha256 ?? 'Unavailable'
                    }
                  ]}
                />
              ) : (
                <p>No current lifecycle projection exists.</p>
              )}
            </Card>
            <Card>
              <h3>Lifecycle events</h3>
              {provenance.events.length === 0 ? (
                <p>No lifecycle events.</p>
              ) : (
                <ol>
                  {provenance.events.map((event) => (
                    <li key={event.lifecycleEventId}>
                      <strong>{event.eventCode}</strong> · {event.state} ·{' '}
                      {new Date(event.occurredAt).toLocaleString()}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            {provenance.reviewSources.map((source) => (
              <Card key={source.admission.reviewedSourceAdmissionId}>
                <h3>Reviewed source</h3>
                <DataList
                  items={[
                    {
                      label: 'Admission',
                      value: source.admission.reviewedSourceAdmissionId
                    },
                    {
                      label: 'Review decision',
                      value: source.reviewDecision.evidenceReviewDecisionId
                    },
                    { label: 'Outcome', value: source.reviewDecision.outcome ?? 'Unavailable' },
                    { label: 'Rationale', value: source.reviewDecision.rationale ?? 'Unavailable' },
                    {
                      label: 'Evidence receipt',
                      value: source.admission.evidenceSource?.evidenceReceipt?.id ?? 'Unavailable'
                    },
                    {
                      label: 'Provider Return',
                      value: source.admission.evidenceSource?.providerReturn?.id ?? 'Unavailable'
                    },
                    {
                      label: 'Handoff',
                      value: source.handoff
                        ? `${source.handoff.status} · attempts ${source.handoff.attemptCount}`
                        : 'No handoff record'
                    },
                    {
                      label: 'Remote idempotency',
                      value: source.handoff?.markRegIdempotencyKey ?? 'Unavailable'
                    }
                  ]}
                />
                {source.admission.admittedEvidenceReferences?.length ? (
                  <>
                    <h4>Admitted evidence references</h4>
                    <ul>
                      {source.admission.admittedEvidenceReferences.map((reference) => (
                        <li key={reference}>{reference}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {source.correctionRequest ? (
                  <>
                    <h4>Correction history</h4>
                    <p>
                      {source.correctionRequest.correctionRequestId} ·{' '}
                      {source.correctionRequest.status}
                    </p>
                    <ul>
                      {source.correctionRequest.reasons.map((reason) => (
                        <li key={`${reason.code}:${reason.message}`}>
                          <strong>{reason.code}</strong>: {reason.message}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>No correction request is attached to this reviewed source.</p>
                )}
              </Card>
            ))}
          </>
        )}
      </section>
    </AppShell>
  );
}
