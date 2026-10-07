import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CapabilityCenterPendingCandidate,
  CapabilityCenterView,
  CapabilityLedgerEntry,
  ReflectionDispositionOutcome
} from '@markorbit/contracts';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import {
  CapabilityCenterHttpError,
  createCapabilityCenterClient,
  type CapabilityCenterClient
} from '../../api/capability.js';
import './capability-center.css';

export interface CapabilityCenterProps {
  workspaceId: string;
  client?: CapabilityCenterClient;
}

type ViewState =
  | { kind: 'LOADING' }
  | { kind: 'READY'; view: CapabilityCenterView }
  | { kind: 'ERROR'; error: CapabilityCenterHttpError };

const staleCodes = new Set([
  'STALE_CANDIDATE',
  'CANDIDATE_FINGERPRINT_MISMATCH',
  'CANDIDATE_ALREADY_DISPOSITIONED'
]);

const sourceNames: Record<CapabilityLedgerEntry['observation']['sourceKind'], string> = {
  EXECUTION_PROFESSIONAL_REVIEW_DECISION: 'Specialist assessment',
  EXECUTION_EVIDENCE_REVIEW_DECISION: 'Evidence review',
  MARKREG_REVIEWED_LIFECYCLE_SOURCE: 'Reviewed trademark matter'
};

function humanizeIdentifier(value: string): string {
  return value
    .replace(/^runtime-capability_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string): string {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function matchingEvidence(
  view: CapabilityCenterView,
  pending: Readonly<CapabilityCenterPendingCandidate>
) {
  const ids = new Set(pending.candidate.ledgerEntries.map((entry) => entry.id));
  return view.ledgerEntries.filter((entry) => ids.has(entry.capabilityLedgerEntryId));
}

export function CapabilityCenter({ workspaceId, client }: CapabilityCenterProps) {
  const activeClient = useMemo(
    () => client ?? createCapabilityCenterClient(workspaceId),
    [client, workspaceId]
  );
  const [state, setState] = useState<ViewState>({ kind: 'LOADING' });
  const [savingId, setSavingId] = useState<string>();
  const [mutationError, setMutationError] = useState<CapabilityCenterHttpError>();
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setState({ kind: 'LOADING' });
    try {
      const view = await activeClient.load();
      setState({ kind: 'READY', view });
    } catch (error) {
      setState({
        kind: 'ERROR',
        error:
          error instanceof CapabilityCenterHttpError
            ? error
            : new CapabilityCenterHttpError(
                503,
                'DOWNSTREAM_UNAVAILABLE',
                'Capability Center is unavailable.'
              )
      });
    }
  }, [activeClient]);

  useEffect(() => void load(), [load]);

  const decide = async (
    pending: Readonly<CapabilityCenterPendingCandidate>,
    outcome: ReflectionDispositionOutcome
  ) => {
    setSavingId(pending.candidate.reflectionCandidateId);
    setMutationError(undefined);
    setStatus('');
    try {
      await activeClient.disposition({
        reflectionCandidateId: pending.candidate.reflectionCandidateId,
        candidateVersion: pending.candidate.version,
        expectedCandidateFingerprintSha256: pending.candidateFingerprintSha256,
        outcome
      });
      const message = {
        ACCEPTED: 'Reflection added to your private picture.',
        DEFERRED: 'Reflection saved for later review.',
        REJECTED: 'Reflection dismissed. Your private picture was not changed.'
      }[outcome];
      setStatus(message);
      await load();
    } catch (error) {
      setMutationError(
        error instanceof CapabilityCenterHttpError
          ? error
          : new CapabilityCenterHttpError(
              503,
              'DOWNSTREAM_UNAVAILABLE',
              'Capability reflection could not be saved.'
            )
      );
    } finally {
      setSavingId(undefined);
    }
  };

  if (state.kind === 'LOADING') return <LoadingState label="Loading private practice insights" />;
  if (state.kind === 'ERROR') {
    const permission = [401, 403].includes(state.error.status);
    return (
      <ErrorState
        title={permission ? 'Private insights permission required' : 'Private insights unavailable'}
        description={state.error.message}
        {...(state.error.status >= 500 ? { onRetry: () => void load() } : {})}
      />
    );
  }

  const { view } = state;
  const empty =
    !view.ledgerEntries.length &&
    !view.profiles.length &&
    !view.pendingCandidates.length &&
    !view.twin;
  const partial =
    !empty &&
    (!view.twin ||
      !view.profiles.length ||
      (view.ledgerEntries.length > 0 &&
        !view.pendingCandidates.length &&
        !view.profiles.some((profile) => profile.acceptedReflections.length)));

  return (
    <div className="capability-center">
      <PageHeader
        title="Private practice insights"
        description="Turn governed work evidence into reflections you control."
        actions={<Badge className="capability-center__private-badge">Private to you</Badge>}
      />

      <div className="capability-center__boundary" role="note">
        <span aria-hidden>◆</span>
        <div>
          <strong>A reflection, not a rating</strong>
          <p>
            These insights do not verify, certify or rank your capability. They never change your
            permissions, publish a profile or trigger an external action.
          </p>
        </div>
      </div>

      {mutationError && staleCodes.has(mutationError.code) && (
        <Alert tone="warning" title="This reflection has changed">
          Reload the latest private state before deciding.{' '}
          <Button variant="secondary" onClick={() => void load()}>
            Reload latest
          </Button>
        </Alert>
      )}
      {mutationError && !staleCodes.has(mutationError.code) && (
        <Alert
          tone={mutationError.status >= 500 ? 'warning' : 'danger'}
          title="Your decision was not saved"
        >
          {mutationError.message}
        </Alert>
      )}
      {status && (
        <p className="capability-center__success" role="status">
          <span aria-hidden>✓</span> {status}
        </p>
      )}

      {empty ? (
        <EmptyState
          title="Your private picture will grow here"
          description="After governed work is reviewed and admitted, you can inspect its evidence and decide which reflections belong in your private picture."
        />
      ) : (
        <>
          {partial && (
            <Alert tone="warning" title="Your private picture is still taking shape">
              Some governed evidence is available, but no complete current picture or reflection
              decision exists yet. Missing information is never inferred.
            </Alert>
          )}

          <section className="capability-center__stats" aria-label="Private insight summary">
            <div>
              <strong>{view.pendingCandidates.length}</strong>
              <span>To review</span>
            </div>
            <div>
              <strong>{view.profiles.length}</strong>
              <span>Practice areas</span>
            </div>
            <div>
              <strong>{view.ledgerEntries.length}</strong>
              <span>Evidence records</span>
            </div>
            <p>Updated {formatDate(view.generatedAt)}</p>
          </section>

          <div className="capability-center__layout">
            <main className="capability-center__decisions">
              <div className="capability-center__section-heading">
                <div>
                  <span className="capability-center__eyebrow">Your decision</span>
                  <h2>Reflections ready for you</h2>
                </div>
                <Badge>{view.pendingCandidates.length} open</Badge>
              </div>

              {view.pendingCandidates.length ? (
                <div className="capability-center__candidate-list" aria-live="polite">
                  {view.pendingCandidates.map((pending) => {
                    const candidate = pending.candidate;
                    const evidence = matchingEvidence(view, pending);
                    const saving = savingId === candidate.reflectionCandidateId;
                    return (
                      <article
                        className="capability-center__candidate"
                        key={`${candidate.reflectionCandidateId}:${candidate.version}`}
                      >
                        <header>
                          <div>
                            <span className="capability-center__eyebrow">Suggested reflection</span>
                            <h3>{humanizeIdentifier(candidate.runtimeCapability.id)}</h3>
                          </div>
                          <Badge>Review needed</Badge>
                        </header>

                        <blockquote>{candidate.proposedPrivateReflection}</blockquote>

                        <section
                          className="capability-center__why"
                          aria-labelledby={`why-${candidate.reflectionCandidateId}`}
                        >
                          <h4 id={`why-${candidate.reflectionCandidateId}`}>Why this appeared</h4>
                          <p>{candidate.explanation}</p>
                          <ul>
                            {evidence.map((entry) => (
                              <li key={entry.capabilityLedgerEntryId}>
                                <span aria-hidden>✓</span>
                                <div>
                                  <strong>{sourceNames[entry.observation.sourceKind]}</strong>
                                  <small>Recorded {formatDate(entry.recordedAt)}</small>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </section>

                        <details className="capability-center__lineage">
                          <summary>View exact lineage</summary>
                          <dl>
                            <div>
                              <dt>Candidate</dt>
                              <dd>{candidate.reflectionCandidateId}</dd>
                            </div>
                            <div>
                              <dt>Version</dt>
                              <dd>{candidate.version}</dd>
                            </div>
                            <div>
                              <dt>Policy</dt>
                              <dd>{candidate.generation.policyVersion}</dd>
                            </div>
                            <div>
                              <dt>Fingerprint</dt>
                              <dd>{pending.candidateFingerprintSha256}</dd>
                            </div>
                          </dl>
                        </details>

                        <footer>
                          <div>
                            <Button
                              disabled={saving}
                              onClick={() => void decide(pending, 'ACCEPTED')}
                            >
                              Add to my private picture
                            </Button>
                            <small>Includes this wording in your private projection.</small>
                          </div>
                          <div className="capability-center__secondary-actions">
                            <Button
                              variant="secondary"
                              disabled={saving}
                              onClick={() => void decide(pending, 'DEFERRED')}
                            >
                              Decide later
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={saving}
                              onClick={() => void decide(pending, 'REJECTED')}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="capability-center__quiet-state">
                  <span aria-hidden>✓</span>
                  <div>
                    <h3>You are up to date</h3>
                    <p>No private reflections are waiting for your decision.</p>
                  </div>
                </div>
              )}
            </main>

            <aside className="capability-center__picture" aria-labelledby="private-picture-title">
              <div className="capability-center__section-heading">
                <div>
                  <span className="capability-center__eyebrow">Private projection</span>
                  <h2 id="private-picture-title">Your practice picture</h2>
                </div>
              </div>

              {view.twin?.capabilitySummaries.length ? (
                <div className="capability-center__practice-list">
                  {view.twin.capabilitySummaries.map((summary) => (
                    <article
                      key={`${summary.runtimeCapabilityDefinitionId}:${summary.runtimeCapabilityVersion}`}
                    >
                      <header>
                        <span className="capability-center__practice-mark" aria-hidden>
                          {humanizeIdentifier(summary.runtimeCapabilityDefinitionId).charAt(0)}
                        </span>
                        <div>
                          <h3>{humanizeIdentifier(summary.runtimeCapabilityDefinitionId)}</h3>
                          <p>
                            {summary.evidenceCount} evidence{' '}
                            {summary.evidenceCount === 1 ? 'record' : 'records'}
                          </p>
                        </div>
                      </header>
                      {summary.acceptedPrivateReflection ? (
                        <blockquote>{summary.acceptedPrivateReflection}</blockquote>
                      ) : (
                        <p className="capability-center__pending-copy">
                          No reflection has been added yet.
                        </p>
                      )}
                      <small>Latest evidence · {formatDate(summary.latestEvidenceAt)}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No private practice picture is available. Nothing is inferred.</p>
              )}

              <div className="capability-center__privacy-note">
                <strong>Only you can see this view</strong>
                <p>No public score, badge, ranking or autonomous authority is created.</p>
              </div>
            </aside>
          </div>

          <section className="capability-center__evidence" aria-labelledby="evidence-title">
            <div className="capability-center__section-heading">
              <div>
                <span className="capability-center__eyebrow">Append-only record</span>
                <h2 id="evidence-title">Evidence trail</h2>
                <p>Reviewed work that has been admitted to your private ledger.</p>
              </div>
            </div>
            {view.ledgerEntries.length ? (
              <ol>
                {view.ledgerEntries.map((entry) => (
                  <li key={entry.capabilityLedgerEntryId}>
                    <span className="capability-center__timeline-mark" aria-hidden />
                    <div>
                      <strong>{sourceNames[entry.observation.sourceKind]}</strong>
                      <p>{humanizeIdentifier(entry.runtimeCapability.id)}</p>
                      <small>
                        {entry.observation.sourceOwner} · version{' '}
                        {String(entry.observation.sourceVersion)}
                      </small>
                    </div>
                    <time dateTime={entry.recordedAt}>{formatDate(entry.recordedAt)}</time>
                    <details>
                      <summary>Source details</summary>
                      <p>{entry.observation.sourceId}</p>
                      <p>{entry.observation.sourceFingerprintSha256}</p>
                    </details>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No governed evidence records are available.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
