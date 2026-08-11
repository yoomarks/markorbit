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
  admitReviewedSource,
  captureEvidenceReviewSource,
  deliverReviewedSource,
  loadEvidenceReviewQueue,
  loadOperationsLifecycle,
  recordEvidenceReviewDecision,
  type CapturedEvidenceReviewSource,
  type EvidenceReviewDecisionResult,
  type EvidenceReviewQueueItem,
  type OperationsLifecycleProvenance,
  type ReviewedSourceAdmissionResult
} from './lifecycle.js';

type ReviewOutcome = 'ADMITTED_FOR_INTERNAL_USE' | 'CORRECTION_REQUIRED' | 'REJECTED';
type LifecycleState =
  | 'INTERNAL_PROCESSING'
  | 'REVIEWED_PROVIDER_EVIDENCE'
  | 'CUSTOMER_ACTION_NEEDED'
  | 'WAITING_NO_ACTION'
  | 'CORRECTION_OR_REVIEW_ISSUE';

export function OperationsApp() {
  const [formalMatterId, setFormalMatterId] = useState('');
  const [provenance, setProvenance] = useState<OperationsLifecycleProvenance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [queue, setQueue] = useState<readonly EvidenceReviewQueueItem[]>([]);
  const [selectedHandoffId, setSelectedHandoffId] = useState('');
  const [source, setSource] = useState<CapturedEvidenceReviewSource | null>(null);
  const [decision, setDecision] = useState<EvidenceReviewDecisionResult | null>(null);
  const [admission, setAdmission] = useState<ReviewedSourceAdmissionResult | null>(null);
  const [reviewOutcome, setReviewOutcome] = useState<ReviewOutcome>('ADMITTED_FOR_INTERNAL_USE');
  const [rationale, setRationale] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [reviewMatterId, setReviewMatterId] = useState('');
  const [reviewMatterVersion, setReviewMatterVersion] = useState('1');
  const [evidenceReferences, setEvidenceReferences] = useState('');
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>(
    'REVIEWED_PROVIDER_EVIDENCE'
  );
  const [eventCode, setEventCode] = useState('PROVIDER_EVIDENCE_REVIEWED');
  const [customerSafeLabel, setCustomerSafeLabel] = useState('Evidence reviewed');
  const [customerSafeSummary, setCustomerSafeSummary] = useState(
    'Provider evidence has been reviewed for internal lifecycle tracking.'
  );
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);

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

  const runReviewAction = async (name: string, work: () => Promise<void>) => {
    setReviewBusy(name);
    setReviewError(null);
    setReviewStatus(null);
    try {
      await work();
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : 'The review operation failed.');
    } finally {
      setReviewBusy(null);
    }
  };

  const refreshQueue = () =>
    runReviewAction('queue', async () => {
      const items = await loadEvidenceReviewQueue();
      setQueue(items);
      setReviewStatus(`${items.length} reviewable evidence item(s) loaded.`);
    });

  const chooseItem = (item: EvidenceReviewQueueItem) => {
    setSelectedHandoffId(item.receipt.evidenceHandoff.evidenceHandoffId);
    setSource(null);
    setDecision(null);
    setAdmission(null);
    setReviewStatus(null);
    setReviewError(null);
  };

  const capture = () =>
    runReviewAction('capture', async () => {
      const captured = await captureEvidenceReviewSource(selectedHandoffId);
      setSource(captured);
      setReviewStatus(`Exact review source ${captured.evidenceReceipt.id} captured.`);
    });

  const decide = () =>
    runReviewAction('decision', async () => {
      if (!source) throw new Error('Capture the exact evidence review source first.');
      if (!rationale.trim()) throw new Error('Reviewer rationale is required.');
      const result = await recordEvidenceReviewDecision({
        source,
        outcome: reviewOutcome,
        rationale: rationale.trim(),
        correctionReason: correctionReason.trim()
      });
      setDecision(result);
      setAdmission(null);
      setReviewStatus(
        reviewOutcome === 'CORRECTION_REQUIRED'
          ? `Review decision recorded; correction request ${result.correctionRequest?.correctionRequestId ?? ''} created.`
          : `Review decision ${result.decision.evidenceReviewDecisionId} recorded.`
      );
    });

  const admit = () =>
    runReviewAction('admission', async () => {
      if (!decision || decision.decision.outcome !== 'ADMITTED_FOR_INTERNAL_USE')
        throw new Error('Only ADMITTED_FOR_INTERNAL_USE review decisions may be admitted.');
      if (!reviewMatterId.trim()) throw new Error('Formal Matter ID is required.');
      const result = await admitReviewedSource({
        decision: decision.decision,
        formalMatterId: reviewMatterId.trim(),
        expectedFormalMatterVersion: reviewMatterVersion.trim(),
        admittedEvidenceReferences: evidenceReferences
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean)
      });
      setAdmission(result);
      setReviewStatus(`Reviewed source ${result.admission.reviewedSourceAdmissionId} admitted.`);
    });

  const project = () =>
    runReviewAction('projection', async () => {
      if (!admission)
        throw new Error('Admit the reviewed source before projecting lifecycle state.');
      const result = await deliverReviewedSource({
        admission: admission.admission,
        state: lifecycleState,
        eventCode: eventCode.trim(),
        customerSafeLabel: customerSafeLabel.trim(),
        customerSafeSummary: customerSafeSummary.trim()
      });
      setReviewStatus(
        `Lifecycle ${result.result.currentView.state} projected. This remains internal governed status.`
      );
      setFormalMatterId(admission.admission.formalMatter.id);
    });

  return (
    <AppShell
      brand="Operations Console"
      internalOnly
      navigation={
        <SideNavigation
          items={[
            { label: 'Overview', href: '#overview', active: true },
            { label: 'Evidence review', href: '#evidence-review' },
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

      <section id="evidence-review" aria-labelledby="evidence-review-heading">
        <PageHeader
          title="Evidence review"
          description="Review exact PENDING_REVIEW evidence, record an explicit decision and, only when admitted, project bounded lifecycle state."
        />
        <Alert tone="info" title="Human-governed internal truth">
          Reviewer identity comes from the authenticated Workspace Principal. Review admission is
          not Filing Submission, Official Truth, payment, legal appointment or proof of
          trademark-office action.
        </Alert>
        <Card>
          <h3>1. Review queue</h3>
          <Button disabled={reviewBusy !== null} onClick={() => void refreshQueue()}>
            {reviewBusy === 'queue' ? 'Loading…' : 'Load reviewable evidence'}
          </Button>
          {queue.length === 0 ? (
            <p>No reviewable evidence loaded.</p>
          ) : (
            <ol>
              {queue.map((item) => (
                <li key={item.receipt.evidenceHandoff.evidenceHandoffId}>
                  <Button onClick={() => chooseItem(item)}>
                    {item.receipt.evidenceHandoff.evidenceHandoffId}
                  </Button>{' '}
                  · Provider Return {item.receipt.evidenceHandoff.providerReturn.id} v
                  {item.receipt.evidenceHandoff.providerReturn.version} ·{' '}
                  {new Date(item.receipt.receivedAt).toLocaleString()}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {selectedHandoffId && (
          <Card>
            <h3>2. Capture exact review source</h3>
            <p>{selectedHandoffId}</p>
            {source ? (
              <DataList
                items={[
                  { label: 'Evidence Receipt', value: source.evidenceReceipt.id },
                  { label: 'Version', value: source.evidenceReceipt.version },
                  { label: 'Provider Return', value: source.providerReturn.id },
                  { label: 'Correlation', value: source.correlationId }
                ]}
              />
            ) : (
              <Button disabled={reviewBusy !== null} onClick={() => void capture()}>
                {reviewBusy === 'capture' ? 'Capturing…' : 'Capture review source'}
              </Button>
            )}
          </Card>
        )}

        {source && !decision && (
          <Card>
            <h3>3. Record explicit review decision</h3>
            <label htmlFor="review-outcome">Outcome</label>
            <select
              id="review-outcome"
              value={reviewOutcome}
              onChange={(event) => setReviewOutcome(event.target.value as ReviewOutcome)}
            >
              <option value="ADMITTED_FOR_INTERNAL_USE">Admit for internal use</option>
              <option value="CORRECTION_REQUIRED">Correction required</option>
              <option value="REJECTED">Reject</option>
            </select>
            <div>
              <label htmlFor="review-rationale">Reviewer rationale</label>
              <textarea
                id="review-rationale"
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
              />
            </div>
            {reviewOutcome === 'CORRECTION_REQUIRED' && (
              <div>
                <label htmlFor="correction-reason">Correction reason</label>
                <textarea
                  id="correction-reason"
                  value={correctionReason}
                  onChange={(event) => setCorrectionReason(event.target.value)}
                />
              </div>
            )}
            <Button
              disabled={reviewBusy !== null || !rationale.trim()}
              onClick={() => void decide()}
            >
              {reviewBusy === 'decision' ? 'Recording…' : 'Record review decision'}
            </Button>
          </Card>
        )}

        {decision && (
          <Card>
            <h3>Review result</h3>
            <DataList
              items={[
                { label: 'Decision', value: decision.decision.evidenceReviewDecisionId },
                { label: 'Outcome', value: decision.decision.outcome },
                {
                  label: 'Correction request',
                  value: decision.correctionRequest?.correctionRequestId ?? 'None'
                }
              ]}
            />
          </Card>
        )}

        {decision?.decision.outcome === 'ADMITTED_FOR_INTERNAL_USE' && !admission && (
          <Card>
            <h3>4. Admit reviewed source to one Formal Matter</h3>
            <div>
              <label htmlFor="review-matter-id">Formal Matter ID</label>
              <input
                id="review-matter-id"
                value={reviewMatterId}
                onChange={(event) => setReviewMatterId(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="review-matter-version">Exact Formal Matter version</label>
              <input
                id="review-matter-version"
                value={reviewMatterVersion}
                onChange={(event) => setReviewMatterVersion(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="evidence-references">
                Admitted evidence references, one per line
              </label>
              <textarea
                id="evidence-references"
                value={evidenceReferences}
                onChange={(event) => setEvidenceReferences(event.target.value)}
              />
            </div>
            <Button
              disabled={reviewBusy !== null || !reviewMatterId.trim()}
              onClick={() => void admit()}
            >
              {reviewBusy === 'admission' ? 'Admitting…' : 'Admit reviewed source'}
            </Button>
          </Card>
        )}

        {admission && (
          <Card>
            <h3>5. Project customer-safe lifecycle state</h3>
            <DataList
              items={[
                { label: 'Admission', value: admission.admission.reviewedSourceAdmissionId },
                { label: 'Formal Matter', value: admission.admission.formalMatter.id }
              ]}
            />
            <label htmlFor="lifecycle-state">Lifecycle state</label>
            <select
              id="lifecycle-state"
              value={lifecycleState}
              onChange={(event) => setLifecycleState(event.target.value as LifecycleState)}
            >
              <option value="INTERNAL_PROCESSING">Internal processing</option>
              <option value="REVIEWED_PROVIDER_EVIDENCE">Reviewed provider evidence</option>
              <option value="CUSTOMER_ACTION_NEEDED">Customer action needed</option>
              <option value="WAITING_NO_ACTION">Waiting, no customer action</option>
              <option value="CORRECTION_OR_REVIEW_ISSUE">Correction or review issue</option>
            </select>
            <div>
              <label htmlFor="event-code">Event code</label>
              <input
                id="event-code"
                value={eventCode}
                onChange={(event) => setEventCode(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="customer-label">Customer-safe label</label>
              <input
                id="customer-label"
                value={customerSafeLabel}
                onChange={(event) => setCustomerSafeLabel(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="customer-summary">Customer-safe summary</label>
              <textarea
                id="customer-summary"
                value={customerSafeSummary}
                onChange={(event) => setCustomerSafeSummary(event.target.value)}
              />
            </div>
            <Button
              disabled={
                reviewBusy !== null ||
                !eventCode.trim() ||
                !customerSafeLabel.trim() ||
                !customerSafeSummary.trim()
              }
              onClick={() => void project()}
            >
              {reviewBusy === 'projection' ? 'Projecting…' : 'Project lifecycle'}
            </Button>
          </Card>
        )}

        {reviewStatus && (
          <Alert tone="info" title="Review operation recorded">
            {reviewStatus}
          </Alert>
        )}
        {reviewError && (
          <Alert tone="warning" title="Review operation unavailable">
            {reviewError}
          </Alert>
        )}
      </section>

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
              This view is review and projection evidence. It is not trademark-office status, filing
              authority, payment truth or proof of submission.
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
            {provenance.reviewSources.map((reviewSource) => (
              <Card key={reviewSource.admission.reviewedSourceAdmissionId}>
                <h3>Reviewed source</h3>
                <DataList
                  items={[
                    {
                      label: 'Admission',
                      value: reviewSource.admission.reviewedSourceAdmissionId
                    },
                    {
                      label: 'Review decision',
                      value: reviewSource.reviewDecision.evidenceReviewDecisionId
                    },
                    {
                      label: 'Outcome',
                      value: reviewSource.reviewDecision.outcome ?? 'Unavailable'
                    },
                    {
                      label: 'Rationale',
                      value: reviewSource.reviewDecision.rationale ?? 'Unavailable'
                    },
                    {
                      label: 'Evidence receipt',
                      value:
                        reviewSource.admission.evidenceSource?.evidenceReceipt?.id ?? 'Unavailable'
                    },
                    {
                      label: 'Provider Return',
                      value:
                        reviewSource.admission.evidenceSource?.providerReturn?.id ?? 'Unavailable'
                    },
                    {
                      label: 'Handoff',
                      value: reviewSource.handoff
                        ? `${reviewSource.handoff.status} · attempts ${reviewSource.handoff.attemptCount}`
                        : 'No handoff record'
                    },
                    {
                      label: 'Remote idempotency',
                      value: reviewSource.handoff?.markRegIdempotencyKey ?? 'Unavailable'
                    }
                  ]}
                />
                {reviewSource.admission.admittedEvidenceReferences?.length ? (
                  <>
                    <h4>Admitted evidence references</h4>
                    <ul>
                      {reviewSource.admission.admittedEvidenceReferences.map((reference) => (
                        <li key={reference}>{reference}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {reviewSource.correctionRequest ? (
                  <>
                    <h4>Correction history</h4>
                    <p>
                      {reviewSource.correctionRequest.correctionRequestId} ·{' '}
                      {reviewSource.correctionRequest.status}
                    </p>
                    <ul>
                      {reviewSource.correctionRequest.reasons.map((reason) => (
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
