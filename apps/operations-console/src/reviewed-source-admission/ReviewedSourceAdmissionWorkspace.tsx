import { useMemo, useState } from 'react';
import { Alert, Button } from '@markorbit/ui';
import type { ReviewedSourceAdmissionResult } from '../lifecycle.js';
import '../evidence-review/execution-evidence-review.css';
import './reviewed-source-admission.css';

export type ReviewedSourceAdmissionState =
  'ready' | 'loading' | 'empty' | 'unauthorized' | 'unavailable' | 'error' | 'partial';

export interface AdmissionDecisionSource {
  evidenceReceipt: { id: string; version: number };
  evidenceReceiptFingerprintSha256: string;
  evidenceHandoffId: string;
  providerReturn: { id: string; version: number };
  correlationId: string;
}

export interface AdmissionDecision {
  evidenceReviewDecisionId: string;
  version: number;
  decisionFingerprintSha256: string;
  outcome: 'ADMITTED_FOR_INTERNAL_USE' | 'CORRECTION_REQUIRED' | 'REJECTED';
  rationale: string;
  reviewedAt: string;
  reviewerLabel: string;
  source: AdmissionDecisionSource;
  evidenceReferences: readonly { reference: string; kind: string }[];
}

export interface FormalMatterAdmissionTarget {
  id: string;
  version: number | string;
  title: string;
  jurisdiction: string;
  ownerLabel: string;
  updatedAt: string;
}

export interface ReviewedSourceAdmissionClient {
  admit(input: {
    decision: AdmissionDecision;
    formalMatterId: string;
    expectedFormalMatterVersion: number | string;
    admittedEvidenceReferences: readonly string[];
  }): Promise<ReviewedSourceAdmissionResult>;
}

interface Props {
  decision: AdmissionDecision | undefined;
  targets: readonly FormalMatterAdmissionTarget[];
  client: ReviewedSourceAdmissionClient;
  state?: ReviewedSourceAdmissionState;
}

const stateCopy: Record<
  Exclude<ReviewedSourceAdmissionState, 'ready' | 'partial'>,
  { title: string; detail: string; tone: 'info' | 'warning' }
> = {
  loading: {
    title: 'Loading exact admission context',
    detail: 'Reading the reviewed decision and eligible Formal Matter context from their owners.',
    tone: 'info'
  },
  empty: {
    title: 'No reviewed source is ready for admission',
    detail: 'No ADMITTED_FOR_INTERNAL_USE decision was supplied to this governed step.',
    tone: 'info'
  },
  unauthorized: {
    title: 'Admission authority required',
    detail: 'A verified Operations Principal with review:perform is required.',
    tone: 'warning'
  },
  unavailable: {
    title: 'Admission context unavailable',
    detail: 'No target or admission result is inferred while owner truth is unavailable.',
    tone: 'warning'
  },
  error: {
    title: 'Admission context could not be verified',
    detail: 'The returned decision or Formal Matter context could not be trusted as current.',
    tone: 'warning'
  }
};

function time(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
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

function AdmissionFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="er-shell">
      <header className="er-topbar">
        <a
          className="er-brand"
          href="#reviewed-source-admission-main"
          aria-label="MarkOrbit operations home"
        >
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
          <a className="active" href="#reviewed-source-admission-main" aria-current="page">
            Source admission
          </a>
          <a href="./reviewed-source-handoff-preview.html">Lifecycle handoff</a>
        </nav>
        <div className="er-sidebar-note">
          <strong>Execution-owned admission</strong>
          <p>
            One exact reviewed decision may be bound to one exact Formal Matter. No downstream
            handoff is automatic.
          </p>
        </div>
      </aside>
      {children}
    </div>
  );
}

export function ReviewedSourceAdmissionWorkspace({
  decision,
  targets,
  client,
  state = 'ready'
}: Props) {
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const target = useMemo(() => targets.find((item) => item.id === targetId), [targetId, targets]);
  const [selectedReferences, setSelectedReferences] = useState<readonly string[]>(
    decision?.evidenceReferences.map((item) => item.reference) ?? []
  );
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewedSourceAdmissionResult | null>(null);

  const eligible = decision?.outcome === 'ADMITTED_FOR_INTERNAL_USE';
  const passive = state !== 'ready' && state !== 'partial';

  const toggleReference = (reference: string) => {
    setSelectedReferences((current) =>
      current.includes(reference)
        ? current.filter((item) => item !== reference)
        : [...current, reference]
    );
  };

  const admit = async () => {
    if (!decision || !target || !eligible || !confirmed || state === 'partial') return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await client.admit({
          decision,
          formalMatterId: target.id,
          expectedFormalMatterVersion: target.version,
          admittedEvidenceReferences: selectedReferences
        })
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reviewed source could not be admitted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdmissionFrame>
      <main id="reviewed-source-admission-main" className="er-main rsa-main">
        <div className="er-preview-boundary" role="status">
          <strong>Preview fixture</strong>
          <span>
            Internal admission only · no lifecycle projection, filing, payment, office contact or
            Official Truth
          </span>
        </div>

        <div className="er-heading">
          <div>
            <p>Execution operations</p>
            <h1>Reviewed Source Admission</h1>
            <span>Bind one admissible review decision to one exact Formal Matter version.</span>
          </div>
          <div className="er-permission">
            <span>Authority</span>
            <strong>review:perform</strong>
          </div>
        </div>

        <section className="er-metrics" aria-label="Admission boundary summary">
          <Metric
            label="Eligible decision"
            value={eligible ? '1' : '0'}
            detail="Exact reviewed source"
          />
          <Metric
            label="Formal Matter target"
            value={target ? `v${target.version}` : '—'}
            detail="Exact MarkReg reference"
          />
          <Metric
            label="Evidence references"
            value={String(selectedReferences.length)}
            detail="Explicitly selected"
          />
          <Metric label="Lifecycle handoffs" value="0" detail="Separate governed step" />
        </section>

        {passive ? (
          <section className="rsa-passive" aria-live="polite">
            <Alert tone={stateCopy[state].tone} title={stateCopy[state].title}>
              {stateCopy[state].detail}
            </Alert>
          </section>
        ) : decision ? (
          <section className="rsa-workbench" aria-label="Reviewed source admission workbench">
            <article className="rsa-source" aria-labelledby="rsa-source-title">
              <div className="er-subheading">
                <div>
                  <p>Exact review truth</p>
                  <h2 id="rsa-source-title">Decision source</h2>
                </div>
                <span className={`rsa-status ${eligible ? 'eligible' : 'blocked'}`}>
                  {decision.outcome.replaceAll('_', ' ')}
                </span>
              </div>

              <Alert
                tone={eligible ? 'info' : 'warning'}
                title={eligible ? 'Eligible for bounded admission' : 'Decision is not admissible'}
              >
                {eligible
                  ? 'This exact decision may be admitted for internal use. It is not certification or Official Truth.'
                  : 'Only ADMITTED_FOR_INTERNAL_USE may enter this step. Correction and rejection history remain immutable.'}
              </Alert>

              <dl className="rsa-facts">
                <div>
                  <dt>Decision</dt>
                  <dd>
                    {decision.evidenceReviewDecisionId} · v{decision.version}
                  </dd>
                </div>
                <div>
                  <dt>Reviewer</dt>
                  <dd>{decision.reviewerLabel}</dd>
                </div>
                <div>
                  <dt>Reviewed</dt>
                  <dd>{time(decision.reviewedAt)}</dd>
                </div>
                <div>
                  <dt>Rationale</dt>
                  <dd>{decision.rationale}</dd>
                </div>
              </dl>

              <details className="er-provenance">
                <summary>Exact source lineage</summary>
                <dl>
                  <dt>Evidence Receipt</dt>
                  <dd>
                    {decision.source.evidenceReceipt.id} · v
                    {decision.source.evidenceReceipt.version}
                  </dd>
                  <dt>Provider Return</dt>
                  <dd>
                    {decision.source.providerReturn.id} · v{decision.source.providerReturn.version}
                  </dd>
                  <dt>Evidence handoff</dt>
                  <dd>{decision.source.evidenceHandoffId}</dd>
                  <dt>Decision fingerprint</dt>
                  <dd>{decision.decisionFingerprintSha256}</dd>
                  <dt>Correlation</dt>
                  <dd>{decision.source.correlationId}</dd>
                </dl>
              </details>
            </article>

            <article className="rsa-command" aria-labelledby="rsa-command-title">
              <div className="er-subheading">
                <div>
                  <p>Human authority</p>
                  <h2 id="rsa-command-title">Admission command</h2>
                </div>
              </div>

              {state === 'partial' && (
                <Alert tone="warning" title="Formal Matter context is partial">
                  The exact target version could not be verified. Admission controls remain
                  unavailable.
                </Alert>
              )}

              {result ? (
                <div className="rsa-result" role="status">
                  <span>Admission recorded</span>
                  <h3>REVIEWED SOURCE ADMITTED</h3>
                  <dl>
                    <dt>Admission</dt>
                    <dd>
                      {result.admission.reviewedSourceAdmissionId} · v{result.admission.version}
                    </dd>
                    <dt>Formal Matter</dt>
                    <dd>
                      {result.admission.formalMatter.id} · v{result.admission.formalMatter.version}
                    </dd>
                    <dt>Evidence references</dt>
                    <dd>{selectedReferences.length}</dd>
                    <dt>Lifecycle handoff</dt>
                    <dd>Not started</dd>
                    <dt>Official Truth</dt>
                    <dd>Not created</dd>
                  </dl>
                  <Alert tone="info" title="Next governed step remains separate">
                    MarkReg lifecycle projection requires a distinct retry-safe handoff. This
                    admission performs no external action.
                  </Alert>
                </div>
              ) : eligible ? (
                <form
                  className="rsa-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void admit();
                  }}
                >
                  <fieldset className="rsa-targets" disabled={state === 'partial'}>
                    <legend>Exact Formal Matter target</legend>
                    {targets.map((item) => (
                      <label key={item.id} data-selected={item.id === targetId}>
                        <input
                          type="radio"
                          name="formal-matter"
                          value={item.id}
                          checked={item.id === targetId}
                          onChange={() => setTargetId(item.id)}
                        />
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.jurisdiction} · {item.id} · v{item.version}
                          </small>
                          <small>
                            {item.ownerLabel} · updated {time(item.updatedAt)}
                          </small>
                        </span>
                      </label>
                    ))}
                  </fieldset>

                  <fieldset className="rsa-references" disabled={state === 'partial'}>
                    <legend>Admitted evidence references</legend>
                    <p>Select the exact references retained in the admission envelope.</p>
                    {decision.evidenceReferences.map((item) => (
                      <label key={item.reference}>
                        <input
                          type="checkbox"
                          checked={selectedReferences.includes(item.reference)}
                          onChange={() => toggleReference(item.reference)}
                        />
                        <span>
                          <strong>{item.kind}</strong>
                          <small>{item.reference}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>

                  <label className="rsa-confirm">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={state === 'partial'}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    <span>
                      I confirm this exact decision, target version and reference set. Admission is
                      internal and does not authorize filing or external action.
                    </span>
                  </label>

                  {error && (
                    <div className="rsa-error" role="alert">
                      {error}
                    </div>
                  )}
                  <Button disabled={!target || !confirmed || busy || state === 'partial'}>
                    {busy ? 'Recording exact admission…' : 'Record Reviewed Source Admission'}
                  </Button>
                  <small className="rsa-ai-lock">
                    AI may explain this context but cannot record this authoritative admission.
                  </small>
                </form>
              ) : (
                <div className="rsa-blocked">
                  <strong>Admission controls are unavailable</strong>
                  <p>
                    Return to Evidence Review and record a new exact ADMITTED_FOR_INTERNAL_USE
                    decision when appropriate.
                  </p>
                </div>
              )}
            </article>
          </section>
        ) : null}
      </main>
    </AdmissionFrame>
  );
}
