import { useState } from 'react';
import { Alert, Button } from '@markorbit/ui';
import type { ReviewedSourceAdmissionResult, ReviewedSourceDeliveryResult } from '../lifecycle.js';
import '../evidence-review/execution-evidence-review.css';
import './reviewed-source-handoff.css';

export type LifecycleProjectionState =
  | 'INTERNAL_PROCESSING'
  | 'REVIEWED_PROVIDER_EVIDENCE'
  | 'CUSTOMER_ACTION_NEEDED'
  | 'WAITING_NO_ACTION'
  | 'CORRECTION_OR_REVIEW_ISSUE';

export type HandoffWorkspaceState =
  'ready' | 'loading' | 'empty' | 'unauthorized' | 'unavailable' | 'error' | 'partial';

export interface ReviewedSourceHandoffSource {
  admission: ReviewedSourceAdmissionResult['admission'];
  admittedAt: string;
  decision: { id: string; version: number; fingerprint: string };
  evidenceReceipt: { id: string; version: number };
  providerReturn: { id: string; version: number };
  admittedEvidenceReferences: readonly string[];
  formalMatterTitle: string;
  jurisdiction: string;
}

export interface HandoffPendingOutcome {
  status: 'PENDING';
  attemptCount: number;
  deliveryIdempotencyKey: string;
  markRegIdempotencyKey: string;
  lastErrorCode: string;
  retryable: true;
}

export interface HandoffDeliveredOutcome {
  status: 'DELIVERED';
  attemptCount: number;
  deliveryIdempotencyKey: string;
  markRegIdempotencyKey: string;
  deliveredAt: string;
  result: ReviewedSourceDeliveryResult['result'];
}

export type HandoffOutcome = HandoffPendingOutcome | HandoffDeliveredOutcome;

export interface ReviewedSourceHandoffClient {
  deliver(input: {
    admission: ReviewedSourceAdmissionResult['admission'];
    state: LifecycleProjectionState;
    eventCode: string;
    customerSafeLabel: string;
    customerSafeSummary: string;
  }): Promise<HandoffOutcome>;
}

interface Props {
  source: ReviewedSourceHandoffSource | undefined;
  client: ReviewedSourceHandoffClient;
  state?: HandoffWorkspaceState;
  initialOutcome?: HandoffOutcome | undefined;
}

const states: readonly { value: LifecycleProjectionState; label: string; detail: string }[] = [
  {
    value: 'REVIEWED_PROVIDER_EVIDENCE',
    label: 'Reviewed provider evidence',
    detail: 'Reviewed evidence is available for internal processing.'
  },
  {
    value: 'INTERNAL_PROCESSING',
    label: 'Internal processing',
    detail: 'Internal work is in progress; no customer action is requested.'
  },
  {
    value: 'CUSTOMER_ACTION_NEEDED',
    label: 'Customer action needed',
    detail: 'A customer-safe request may be presented separately.'
  },
  {
    value: 'WAITING_NO_ACTION',
    label: 'Waiting · no action',
    detail: 'The matter is waiting and no customer action is currently needed.'
  },
  {
    value: 'CORRECTION_OR_REVIEW_ISSUE',
    label: 'Correction or review issue',
    detail: 'Internal correction or additional review is required.'
  }
];

const passiveCopy: Record<
  Exclude<HandoffWorkspaceState, 'ready' | 'partial'>,
  { title: string; detail: string; tone: 'info' | 'warning' }
> = {
  loading: {
    title: 'Loading exact handoff context',
    detail: 'Reading the Execution-owned admission and exact MarkReg target from their owners.',
    tone: 'info'
  },
  empty: {
    title: 'No reviewed source is ready for handoff',
    detail: 'No eligible Reviewed Source Admission is available for lifecycle projection.',
    tone: 'info'
  },
  unauthorized: {
    title: 'Handoff authority required',
    detail: 'A verified Operations Principal with review:perform is required.',
    tone: 'warning'
  },
  unavailable: {
    title: 'Handoff context unavailable',
    detail:
      'No source, delivery status or lifecycle projection is inferred while owner truth is unavailable.',
    tone: 'warning'
  },
  error: {
    title: 'Handoff context could not be verified',
    detail: 'The admission, Formal Matter or source provenance could not be trusted as current.',
    tone: 'warning'
  }
};

function short(value: string) {
  return `${value.slice(0, 11)}…${value.slice(-8)}`;
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

function HandoffFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="er-shell">
      <header className="er-topbar">
        <a className="er-brand" href="#handoff-main" aria-label="MarkOrbit operations home">
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
          <a href="./execution-evidence-review-preview.html">Evidence review</a>
          <a href="./reviewed-source-admission-preview.html">Source admission</a>
          <a className="active" href="#handoff-main" aria-current="page">
            Lifecycle handoff
          </a>
        </nav>
        <div className="er-sidebar-note">
          <strong>Retry-safe boundary</strong>
          <p>
            Execution persists the sender record before MarkReg contact. A failed attempt remains
            visible and retryable.
          </p>
        </div>
      </aside>
      {children}
    </div>
  );
}

export function ReviewedSourceHandoffWorkspace({
  source,
  client,
  state = 'ready',
  initialOutcome
}: Props) {
  const [projectionState, setProjectionState] = useState<LifecycleProjectionState>(
    'REVIEWED_PROVIDER_EVIDENCE'
  );
  const [eventCode, setEventCode] = useState('PROVIDER_EVIDENCE_REVIEWED');
  const [customerSafeLabel, setCustomerSafeLabel] = useState('Provider evidence reviewed');
  const [customerSafeSummary, setCustomerSafeSummary] = useState(
    'Reviewed evidence has been received for internal processing.'
  );
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<HandoffOutcome | undefined>(initialOutcome);
  const [error, setError] = useState<string | null>(null);
  const passive = state !== 'ready' && state !== 'partial';
  const pending = outcome?.status === 'PENDING' ? outcome : undefined;
  const delivered = outcome?.status === 'DELIVERED' ? outcome : undefined;

  const deliver = async () => {
    if (!source || !confirmed || state === 'partial' || delivered) return;
    setBusy(true);
    setError(null);
    try {
      setOutcome(
        await client.deliver({
          admission: source.admission,
          state: projectionState,
          eventCode,
          customerSafeLabel,
          customerSafeSummary
        })
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Lifecycle handoff could not be delivered.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <HandoffFrame>
      <main id="handoff-main" className="er-main rsh-main">
        <div className="er-preview-boundary" role="status">
          <strong>Preview fixture</strong>
          <span>
            Internal lifecycle projection only · no filing, payment, office contact, completion or
            Official Truth
          </span>
        </div>
        <div className="er-heading">
          <div>
            <p>Execution → MarkReg</p>
            <h1>Reviewed Source Handoff</h1>
            <span>Project one exact admitted source into retry-safe internal lifecycle truth.</span>
          </div>
          <div className="er-permission">
            <span>Authority</span>
            <strong>review:perform</strong>
          </div>
        </div>
        <section className="er-metrics" aria-label="Handoff boundary summary">
          <Metric
            label="Admission"
            value={source ? `v${source.admission.version}` : '—'}
            detail="Exact Execution truth"
          />
          <Metric
            label="Sender status"
            value={outcome?.status ?? 'NOT STARTED'}
            detail={pending ? 'Retryable' : 'Durable handoff'}
          />
          <Metric
            label="Attempts"
            value={String(outcome?.attemptCount ?? 0)}
            detail="Same logical handoff"
          />
          <Metric label="Official status" value="FALSE" detail="Never inferred" />
        </section>

        {passive ? (
          <section className="rsh-passive" aria-live="polite">
            <Alert tone={passiveCopy[state].tone} title={passiveCopy[state].title}>
              {passiveCopy[state].detail}
            </Alert>
          </section>
        ) : source ? (
          <section
            className="rsh-workbench"
            aria-label="Reviewed source lifecycle handoff workbench"
          >
            <article className="rsh-source" aria-labelledby="handoff-source-title">
              <div className="er-subheading">
                <div>
                  <p>Immutable input</p>
                  <h2 id="handoff-source-title">Admitted source</h2>
                </div>
                <span className="rsh-chip">ADMITTED</span>
              </div>
              <Alert tone="info" title="Internal source, not Official Truth">
                The admission authorizes only this bounded projection. Provider evidence remains
                evidence, not an official-office fact.
              </Alert>
              <dl className="rsh-facts">
                <div>
                  <dt>Admission</dt>
                  <dd>
                    {source.admission.reviewedSourceAdmissionId} · v{source.admission.version}
                  </dd>
                </div>
                <div>
                  <dt>Formal Matter</dt>
                  <dd>
                    {source.formalMatterTitle}
                    <small>
                      {source.admission.formalMatter.id} · v{source.admission.formalMatter.version}{' '}
                      · {source.jurisdiction}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Decision</dt>
                  <dd>
                    {source.decision.id} · v{source.decision.version}
                  </dd>
                </div>
                <div>
                  <dt>Evidence set</dt>
                  <dd>{source.admittedEvidenceReferences.length} exact references</dd>
                </div>
              </dl>
              <details className="er-provenance">
                <summary>Exact source lineage</summary>
                <dl>
                  <dt>Admission fingerprint</dt>
                  <dd>{source.admission.admissionFingerprintSha256}</dd>
                  <dt>Decision fingerprint</dt>
                  <dd>{source.decision.fingerprint}</dd>
                  <dt>Evidence Receipt</dt>
                  <dd>
                    {source.evidenceReceipt.id} · v{source.evidenceReceipt.version}
                  </dd>
                  <dt>Provider Return</dt>
                  <dd>
                    {source.providerReturn.id} · v{source.providerReturn.version}
                  </dd>
                  <dt>Correlation</dt>
                  <dd>{source.admission.correlationId}</dd>
                </dl>
              </details>
            </article>

            <article className="rsh-command" aria-labelledby="handoff-command-title">
              <div className="er-subheading">
                <div>
                  <p>Human authority</p>
                  <h2 id="handoff-command-title">Lifecycle projection command</h2>
                </div>
                <span
                  className={`rsh-status ${pending ? 'pending' : delivered ? 'delivered' : ''}`}
                >
                  {outcome?.status ?? 'READY'}
                </span>
              </div>
              {state === 'partial' && (
                <Alert tone="warning" title="Source provenance is partial">
                  The exact admission fingerprint or Formal Matter version could not be verified.
                  Delivery controls remain unavailable.
                </Alert>
              )}
              {pending && (
                <div className="rsh-pending" role="status" aria-live="polite">
                  <div>
                    <span>Sender record persisted</span>
                    <strong>PENDING · RETRY SAFE</strong>
                  </div>
                  <p>
                    MarkReg was unavailable. No lifecycle event or Current Lifecycle View was
                    created. Retry reuses this logical handoff and stable MarkReg key.
                  </p>
                  <dl>
                    <dt>Last error</dt>
                    <dd>{pending.lastErrorCode}</dd>
                    <dt>Attempts</dt>
                    <dd>{pending.attemptCount}</dd>
                    <dt>MarkReg key</dt>
                    <dd title={pending.markRegIdempotencyKey}>
                      {short(pending.markRegIdempotencyKey)}
                    </dd>
                  </dl>
                </div>
              )}
              {delivered ? (
                <div className="rsh-result" role="status" aria-live="polite">
                  <span>Retry-safe delivery complete</span>
                  <h3>LIFECYCLE PROJECTION RECORDED</h3>
                  <div className="rsh-result-grid">
                    <section>
                      <small>Append-only event</small>
                      <strong>{delivered.result.event.state}</strong>
                      <dl>
                        <dt>Event</dt>
                        <dd>{delivered.result.event.lifecycleEventId}</dd>
                        <dt>Official status verified</dt>
                        <dd>{String(delivered.result.event.officialStatusVerified)}</dd>
                      </dl>
                    </section>
                    <section>
                      <small>Current Lifecycle View</small>
                      <strong>Version {delivered.result.currentView.version}</strong>
                      <dl>
                        <dt>View</dt>
                        <dd>{delivered.result.currentView.lifecycleViewId}</dd>
                        <dt>Official status verified</dt>
                        <dd>{String(delivered.result.currentView.officialStatusVerified)}</dd>
                      </dl>
                    </section>
                  </div>
                  <dl className="rsh-delivery-meta">
                    <dt>Attempts</dt>
                    <dd>{delivered.attemptCount}</dd>
                    <dt>Stable MarkReg key</dt>
                    <dd title={delivered.markRegIdempotencyKey}>
                      {short(delivered.markRegIdempotencyKey)}
                    </dd>
                    <dt>Recommended Action</dt>
                    <dd>Not created or executed</dd>
                  </dl>
                  <Alert tone="info" title="Internal projection only">
                    This result is not a filing, office acceptance, payment, completion, legal
                    appointment or verified official status.
                  </Alert>
                </div>
              ) : (
                <form
                  className="rsh-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void deliver();
                  }}
                >
                  <label>
                    <span>Lifecycle state</span>
                    <select
                      value={projectionState}
                      disabled={Boolean(pending) || state === 'partial'}
                      onChange={(event) =>
                        setProjectionState(event.target.value as LifecycleProjectionState)
                      }
                    >
                      {states.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <small>{states.find((item) => item.value === projectionState)?.detail}</small>
                  </label>
                  <label>
                    <span>Event code</span>
                    <input
                      value={eventCode}
                      disabled={Boolean(pending) || state === 'partial'}
                      onChange={(event) => setEventCode(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Customer-safe label</span>
                    <input
                      value={customerSafeLabel}
                      disabled={Boolean(pending) || state === 'partial'}
                      onChange={(event) => setCustomerSafeLabel(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Customer-safe summary</span>
                    <textarea
                      rows={3}
                      value={customerSafeSummary}
                      disabled={Boolean(pending) || state === 'partial'}
                      onChange={(event) => setCustomerSafeSummary(event.target.value)}
                    />
                  </label>
                  <label className="rsh-confirm">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={state === 'partial'}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    <span>
                      I confirm this exact admission and internal projection. It authorizes no
                      filing, payment, office contact or external protected action.
                    </span>
                  </label>
                  {error && (
                    <div className="rsh-error" role="alert">
                      {error}
                    </div>
                  )}
                  <Button
                    disabled={
                      !confirmed ||
                      busy ||
                      state === 'partial' ||
                      !eventCode.trim() ||
                      !customerSafeLabel.trim() ||
                      !customerSafeSummary.trim()
                    }
                  >
                    {busy
                      ? 'Delivering retry-safe handoff…'
                      : pending
                        ? 'Retry same handoff'
                        : 'Deliver to MarkReg lifecycle'}
                  </Button>
                  <small className="rsh-ai-lock">
                    AI may explain the projection but cannot record this authoritative handoff.
                  </small>
                </form>
              )}
            </article>
          </section>
        ) : null}
      </main>
    </HandoffFrame>
  );
}
