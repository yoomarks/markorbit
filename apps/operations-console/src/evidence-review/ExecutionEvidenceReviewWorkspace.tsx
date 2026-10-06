import { useMemo, useState } from 'react';
import { Alert, Button } from '@markorbit/ui';
import type {
  CapturedEvidenceReviewSource,
  EvidenceReviewDecisionResult,
  EvidenceReviewQueueItem
} from '../lifecycle.js';
import './execution-evidence-review.css';

export type EvidenceReviewWorkspaceState =
  'ready' | 'loading' | 'empty' | 'unauthorized' | 'unavailable' | 'error';

export interface EvidenceReviewArtifact {
  reference: string;
  kind: 'DOCUMENT' | 'RECEIPT' | 'STRUCTURED_ASSERTION';
}

export type EvidenceReviewWorkspaceItem = Omit<EvidenceReviewQueueItem, 'receipt' | 'source'> & {
  receipt: EvidenceReviewQueueItem['receipt'] & {
    artifacts?: readonly EvidenceReviewArtifact[];
    assertions?: readonly { code: string; value: string }[];
  };
  source?: CapturedEvidenceReviewSource;
  evidenceAvailability?: 'COMPLETE' | 'PARTIAL';
};

export interface EvidenceReviewWorkspaceClient {
  capture(evidenceHandoffId: string): Promise<CapturedEvidenceReviewSource>;
  decide(input: {
    source: CapturedEvidenceReviewSource;
    outcome: 'ADMITTED_FOR_INTERNAL_USE' | 'CORRECTION_REQUIRED' | 'REJECTED';
    rationale: string;
    correctionReason?: string;
  }): Promise<EvidenceReviewDecisionResult>;
}

interface Props {
  items: readonly EvidenceReviewWorkspaceItem[];
  client: EvidenceReviewWorkspaceClient;
  state?: EvidenceReviewWorkspaceState;
}

const stateCopy: Record<
  Exclude<EvidenceReviewWorkspaceState, 'ready'>,
  { title: string; detail: string; tone: 'info' | 'warning' }
> = {
  loading: {
    title: 'Loading review queue',
    detail: 'Reading current PENDING_REVIEW receipts from the Execution owner.',
    tone: 'info'
  },
  empty: {
    title: 'No evidence awaiting review',
    detail: 'Execution owner truth returned a successful empty review queue.',
    tone: 'info'
  },
  unauthorized: {
    title: 'Review authority required',
    detail: 'Sign in with review:read to view evidence and review:perform to record a decision.',
    tone: 'warning'
  },
  unavailable: {
    title: 'Execution evidence source unavailable',
    detail: 'No queue, receipt or review outcome is inferred while owner truth is unavailable.',
    tone: 'warning'
  },
  error: {
    title: 'Review queue could not be displayed',
    detail: 'The response could not be verified as current Execution owner truth.',
    tone: 'warning'
  }
};

function displayTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function short(value: string) {
  return value.length > 29 ? `${value.slice(0, 16)}…${value.slice(-8)}` : value;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="er-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="er-shell">
      <header className="er-topbar">
        <a className="er-brand" href="#evidence-review-main" aria-label="MarkOrbit operations home">
          <span aria-hidden="true">M</span>
          <span>
            <strong>MarkOrbit</strong>
            <small>Operations</small>
          </span>
        </a>
        <div className="er-principal">
          <span className="er-live" aria-hidden="true" />
          <span>
            <strong>Riley Morgan</strong>
            <small>Execution reviewer · verified session</small>
          </span>
          <b aria-hidden="true">RM</b>
        </div>
      </header>
      <aside className="er-sidebar">
        <nav aria-label="Operations navigation">
          <a href="#overview">Overview</a>
          <a className="active" href="#evidence-review-main" aria-current="page">
            Evidence review
          </a>
          <a href="#lifecycle">Lifecycle provenance</a>
          <a href="#recommended-actions">Recommended actions</a>
        </nav>
        <div className="er-sidebar-note">
          <strong>Execution-owned review</strong>
          <p>
            Review records internal truth only. Provider claims remain evidence, not Official Truth.
          </p>
        </div>
      </aside>
      {children}
    </div>
  );
}

export function ExecutionEvidenceReviewWorkspace({ items, client, state = 'ready' }: Props) {
  const [selectedId, setSelectedId] = useState(items[0]?.receipt.evidenceHandoff.evidenceHandoffId);
  const selected = useMemo(
    () => items.find((item) => item.receipt.evidenceHandoff.evidenceHandoffId === selectedId),
    [items, selectedId]
  );
  const [source, setSource] = useState<CapturedEvidenceReviewSource | null>(
    selected?.source ?? null
  );
  const [outcome, setOutcome] = useState<
    'ADMITTED_FOR_INTERNAL_USE' | 'CORRECTION_REQUIRED' | 'REJECTED'
  >('ADMITTED_FOR_INTERNAL_USE');
  const [rationale, setRationale] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [decision, setDecision] = useState<EvidenceReviewDecisionResult | null>(null);
  const [busy, setBusy] = useState<'capture' | 'decision' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = (item: EvidenceReviewWorkspaceItem) => {
    setSelectedId(item.receipt.evidenceHandoff.evidenceHandoffId);
    setSource(item.source ?? null);
    setOutcome('ADMITTED_FOR_INTERNAL_USE');
    setRationale('');
    setCorrectionReason('');
    setDecision(null);
    setError(null);
  };

  const capture = async () => {
    if (!selected) return;
    setBusy('capture');
    setError(null);
    try {
      setSource(await client.capture(selected.receipt.evidenceHandoff.evidenceHandoffId));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Exact review source could not be captured.'
      );
    } finally {
      setBusy(null);
    }
  };

  const recordDecision = async () => {
    if (!source || !rationale.trim()) return;
    setBusy('decision');
    setError(null);
    try {
      setDecision(
        await client.decide({
          source,
          outcome,
          rationale: rationale.trim(),
          ...(outcome === 'CORRECTION_REQUIRED'
            ? { correctionReason: correctionReason.trim() }
            : {})
        })
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review decision could not be recorded.');
    } finally {
      setBusy(null);
    }
  };

  const capturedCount = items.filter((item) => item.source).length;
  const artifactCount = selected?.receipt.artifacts?.length ?? 0;
  const assertionCount = selected?.receipt.assertions?.length ?? 0;
  const evidenceComplete = selected?.evidenceAvailability !== 'PARTIAL';

  return (
    <WorkspaceFrame>
      <main id="evidence-review-main" className="er-main">
        <div className="er-preview-boundary" role="status">
          <strong>Preview fixture</strong>
          <span>
            Human review only · no filing, office contact, payment, matter completion or Official
            Truth
          </span>
        </div>
        <div className="er-heading">
          <div>
            <p>Execution operations</p>
            <h1>Evidence review</h1>
            <span>Decide how one exact Provider Return receipt may be used internally.</span>
          </div>
          <div className="er-permission">
            <span>Authority</span>
            <strong>review:perform</strong>
          </div>
        </div>

        <section className="er-metrics" aria-label="Evidence review summary">
          <Metric
            label="Awaiting review"
            value={state === 'ready' ? String(items.length) : '—'}
            detail="Execution PENDING_REVIEW"
          />
          <Metric
            label="Exact source captured"
            value={state === 'ready' ? String(capturedCount) : '—'}
            detail="Stable receipt identity"
          />
          <Metric
            label="Selected artifacts"
            value={selected ? String(artifactCount) : '—'}
            detail="References, not certifications"
          />
          <Metric label="External actions" value="0" detail="No protected action performed" />
        </section>

        {state !== 'ready' ? (
          <section className="er-passive-state">
            <Alert tone={stateCopy[state].tone} title={stateCopy[state].title}>
              {stateCopy[state].detail}
            </Alert>
          </section>
        ) : (
          <section className="er-workbench" aria-label="Evidence review workbench">
            <section className="er-queue" aria-labelledby="review-queue-title">
              <div className="er-section-heading">
                <div>
                  <p>Execution owner queue</p>
                  <h2 id="review-queue-title">Awaiting review</h2>
                </div>
                <span>{items.length} items</span>
              </div>
              {items.length === 0 ? (
                <div className="er-empty">
                  <strong>No evidence awaiting review</strong>
                  <span>Execution returned a successful empty queue.</span>
                </div>
              ) : (
                <ol className="er-queue-list" aria-label="Evidence receipts awaiting review">
                  {items.map((item) => {
                    const handoff = item.receipt.evidenceHandoff;
                    const selectedRow = handoff.evidenceHandoffId === selectedId;
                    return (
                      <li key={handoff.evidenceHandoffId}>
                        <button
                          type="button"
                          aria-pressed={selectedRow}
                          data-selected={selectedRow}
                          onClick={() => choose(item)}
                        >
                          <span className="er-queue-top">
                            <b>PENDING REVIEW</b>
                            <small>{displayTime(item.receipt.receivedAt)}</small>
                          </span>
                          <strong>{item.receipt.workStatusClaim.replaceAll('_', ' ')}</strong>
                          <span>Provider {short(item.receipt.providerId)}</span>
                          <span>
                            {short(handoff.providerReturn.id)} · v{handoff.providerReturn.version}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="er-detail" aria-labelledby="review-detail-title">
              {!selected ? (
                <div className="er-empty">
                  <strong>Select an evidence receipt</strong>
                  <span>Choose one exact owner-backed item to begin review.</span>
                </div>
              ) : (
                <>
                  <header className="er-detail-header">
                    <div>
                      <p>Exact review item</p>
                      <h2 id="review-detail-title">
                        {selected.receipt.workStatusClaim.replaceAll('_', ' ')}
                      </h2>
                      <span>{selected.receipt.evidenceHandoff.evidenceHandoffId}</span>
                    </div>
                    <span className="er-status">PENDING REVIEW</span>
                  </header>

                  <section className="er-truth-boundary">
                    <span aria-hidden="true">i</span>
                    <p>
                      <strong>Provider claim evidence</strong>This receipt can support an internal
                      review decision. It does not certify performance or create Official Truth.
                    </p>
                  </section>

                  <div className="er-detail-grid">
                    <section className="er-evidence" aria-labelledby="review-evidence-title">
                      <div className="er-subheading">
                        <div>
                          <p>Review material</p>
                          <h3 id="review-evidence-title">Evidence supplied</h3>
                        </div>
                        <span>{artifactCount + assertionCount} references</span>
                      </div>
                      {!evidenceComplete ? (
                        <Alert tone="warning" title="Evidence projection incomplete">
                          Review controls are unavailable until the complete owner receipt can be
                          read.
                        </Alert>
                      ) : artifactCount + assertionCount === 0 ? (
                        <div className="er-empty compact">
                          <strong>No review material</strong>
                          <span>The owner receipt contains no displayable references.</span>
                        </div>
                      ) : (
                        <ul className="er-evidence-list">
                          {selected.receipt.artifacts?.map((artifact) => (
                            <li key={artifact.reference}>
                              <span>{artifact.kind.replaceAll('_', ' ')}</span>
                              <strong>{artifact.reference}</strong>
                              <small>Reference only · content resolution remains governed</small>
                            </li>
                          ))}
                          {selected.receipt.assertions?.map((assertion) => (
                            <li key={assertion.code}>
                              <span>STRUCTURED ASSERTION</span>
                              <strong>{assertion.code}</strong>
                              <small>{assertion.value}</small>
                            </li>
                          ))}
                        </ul>
                      )}

                      <details className="er-provenance">
                        <summary>Exact provenance</summary>
                        <dl>
                          <dt>Provider Return</dt>
                          <dd>
                            {selected.receipt.evidenceHandoff.providerReturn.id} · v
                            {selected.receipt.evidenceHandoff.providerReturn.version}
                          </dd>
                          <dt>Provider Workspace</dt>
                          <dd>{selected.receipt.providerWorkspaceId}</dd>
                          <dt>Correlation</dt>
                          <dd>{selected.receipt.evidenceHandoff.correlationId}</dd>
                          {source && (
                            <>
                              <dt>Evidence Receipt</dt>
                              <dd>
                                {source.evidenceReceipt.id} · v{source.evidenceReceipt.version}
                              </dd>
                            </>
                          )}
                        </dl>
                      </details>
                    </section>

                    <section className="er-decision" aria-labelledby="review-decision-title">
                      <div className="er-subheading">
                        <div>
                          <p>Human authority</p>
                          <h3 id="review-decision-title">Review decision</h3>
                        </div>
                      </div>
                      {!source ? (
                        <div className="er-capture">
                          <strong>Lock the exact receipt before deciding</strong>
                          <p>
                            Capturing binds the review to the current receipt version and
                            fingerprint.
                          </p>
                          <Button
                            disabled={busy !== null || !evidenceComplete}
                            onClick={() => void capture()}
                          >
                            {busy === 'capture'
                              ? 'Capturing exact source…'
                              : 'Capture exact review source'}
                          </Button>
                        </div>
                      ) : decision ? (
                        <div className="er-result" role="status">
                          <span>Decision recorded</span>
                          <h3>{decision.decision.outcome.replaceAll('_', ' ')}</h3>
                          <p>{decision.decision.rationale}</p>
                          <dl>
                            <dt>Decision</dt>
                            <dd>
                              {decision.decision.evidenceReviewDecisionId} · v
                              {decision.decision.version}
                            </dd>
                            <dt>Correction request</dt>
                            <dd>{decision.correctionRequest?.correctionRequestId ?? 'None'}</dd>
                            <dt>External action</dt>
                            <dd>None</dd>
                            <dt>Official Truth</dt>
                            <dd>Not created</dd>
                          </dl>
                          <Alert tone="info" title="Bounded internal result">
                            This decision is immutable review truth. A separate governed step is
                            required to admit reviewed evidence to one Formal Matter.
                          </Alert>
                        </div>
                      ) : (
                        <form
                          className="er-decision-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void recordDecision();
                          }}
                        >
                          <div className="er-source-lock" role="status">
                            <span>Exact source captured</span>
                            <strong>
                              {source.evidenceReceipt.id} · v{source.evidenceReceipt.version}
                            </strong>
                          </div>
                          <fieldset>
                            <legend>Outcome</legend>
                            {(
                              [
                                [
                                  'ADMITTED_FOR_INTERNAL_USE',
                                  'Admit for internal use',
                                  'Eligible for a separate Reviewed Source admission.'
                                ],
                                [
                                  'CORRECTION_REQUIRED',
                                  'Request correction',
                                  'Create a durable correction request; preserve history.'
                                ],
                                [
                                  'REJECTED',
                                  'Reject evidence',
                                  'Do not admit this exact receipt for internal use.'
                                ]
                              ] as const
                            ).map(([value, label, detail]) => (
                              <label key={value} data-selected={outcome === value}>
                                <input
                                  type="radio"
                                  name="review-outcome"
                                  value={value}
                                  checked={outcome === value}
                                  onChange={() => setOutcome(value)}
                                />
                                <span>
                                  <strong>{label}</strong>
                                  <small>{detail}</small>
                                </span>
                              </label>
                            ))}
                          </fieldset>
                          <label className="er-field" htmlFor="review-rationale">
                            <span>Reviewer rationale</span>
                            <textarea
                              id="review-rationale"
                              rows={4}
                              value={rationale}
                              onChange={(event) => setRationale(event.target.value)}
                              placeholder="Record the human basis for this exact decision."
                              required
                            />
                          </label>
                          {outcome === 'CORRECTION_REQUIRED' && (
                            <label className="er-field" htmlFor="correction-reason">
                              <span>Correction request</span>
                              <textarea
                                id="correction-reason"
                                rows={3}
                                value={correctionReason}
                                onChange={(event) => setCorrectionReason(event.target.value)}
                                placeholder="Describe what must be corrected."
                                required
                              />
                            </label>
                          )}
                          <Button
                            type="submit"
                            disabled={
                              busy !== null ||
                              !rationale.trim() ||
                              (outcome === 'CORRECTION_REQUIRED' && !correctionReason.trim())
                            }
                          >
                            {busy === 'decision'
                              ? 'Recording decision…'
                              : 'Record immutable review decision'}
                          </Button>
                        </form>
                      )}
                      {error && (
                        <Alert tone="warning" title="Review operation unavailable">
                          {error}
                        </Alert>
                      )}
                    </section>
                  </div>
                </>
              )}
            </section>
          </section>
        )}
      </main>
    </WorkspaceFrame>
  );
}
