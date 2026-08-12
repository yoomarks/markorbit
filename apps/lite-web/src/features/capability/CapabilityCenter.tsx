import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CapabilityCenterPendingCandidate,
  CapabilityCenterView,
  ReflectionDispositionOutcome
} from '@markorbit/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import {
  CapabilityCenterHttpError,
  createCapabilityCenterClient,
  type CapabilityCenterClient
} from '../../api/capability.js';

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

function sourceLabel(candidate: Readonly<CapabilityCenterPendingCandidate>): string {
  return `${candidate.candidate.ledgerEntries.length} governed evidence ${
    candidate.candidate.ledgerEntries.length === 1 ? 'entry' : 'entries'
  }`;
}

export function CapabilityCenter({ workspaceId, client }: CapabilityCenterProps) {
  const activeClient = useMemo(() => client ?? createCapabilityCenterClient(workspaceId), [client, workspaceId]);
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
            : new CapabilityCenterHttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Capability Center is unavailable.')
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
      setStatus(`Private reflection ${outcome.toLowerCase()} and durable profile projection rebuilt.`);
      await load();
    } catch (error) {
      setMutationError(
        error instanceof CapabilityCenterHttpError
          ? error
          : new CapabilityCenterHttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Capability reflection could not be saved.')
      );
    } finally {
      setSavingId(undefined);
    }
  };

  if (state.kind === 'LOADING') return <LoadingState label="Loading private Capability Center" />;
  if (state.kind === 'ERROR') {
    const permission = [401, 403].includes(state.error.status);
    return (
      <ErrorState
        title={permission ? 'Capability Center permission required' : 'Capability Center unavailable'}
        description={state.error.message}
        {...(state.error.status >= 500 ? { onRetry: () => void load() } : {})}
      />
    );
  }

  const { view } = state;
  const empty =
    !view.ledgerEntries.length && !view.profiles.length && !view.pendingCandidates.length && !view.twin;
  const partial =
    !empty && (!view.twin || !view.profiles.length || (view.ledgerEntries.length > 0 && !view.pendingCandidates.length && !view.profiles.some((profile) => profile.acceptedReflections.length)));

  return (
    <>
      <PageHeader
        title="Capability Center"
        description="Private evidence, reflection candidates, and deterministic Capability Profile/Twin projection"
        actions={<Badge>Private</Badge>}
      />
      <Alert title="Private reflection boundary">
        Observed evidence is not verified Capability. Accepting a reflection updates only your private projection; it does not create certification, ranking, canonical truth, permission, appointment, filing, or external action.
      </Alert>

      {mutationError && staleCodes.has(mutationError.code) && (
        <Alert tone="warning" title="Reflection changed">
          This candidate is stale or already decided. Reload the current private state before taking another action.{' '}
          <Button variant="secondary" onClick={() => void load()}>
            Reload current state
          </Button>
        </Alert>
      )}
      {mutationError && !staleCodes.has(mutationError.code) && (
        <Alert tone={mutationError.status >= 500 ? 'warning' : 'danger'} title="Reflection was not saved">
          {mutationError.message}
        </Alert>
      )}
      {status && <p role="status">{status}</p>}

      {empty ? (
        <EmptyState
          title="No private Capability evidence yet"
          description="Governed work evidence must be admitted before a private reflection candidate or profile can appear here."
        />
      ) : (
        <>
          {partial && (
            <Alert tone="warning" title="Partial private Capability state">
              Some governed evidence is available, but a complete current Profile/Twin or reflection decision is not yet available. No missing state is inferred.
            </Alert>
          )}

          <div className="lite-detail-grid">
            <Card>
              <h2>Private Capability Twin</h2>
              {view.twin ? (
                <>
                  <KeyValueList
                    items={[
                      { key: 'Projection version', value: String(view.twin.version) },
                      { key: 'Visibility', value: view.twin.visibility },
                      { key: 'Autonomous identity', value: 'No' },
                      { key: 'Autonomous execution authority', value: 'No' }
                    ]}
                  />
                  <ul className="lite-related">
                    {view.twin.capabilitySummaries.map((summary) => (
                      <li key={`${summary.runtimeCapabilityDefinitionId}:${summary.runtimeCapabilityVersion}`}>
                        <strong>{summary.runtimeCapabilityDefinitionId}</strong>
                        <span>
                          v{summary.runtimeCapabilityVersion} · {summary.evidenceCount} governed evidence entries
                        </span>
                        {summary.acceptedPrivateReflection && <p>{summary.acceptedPrivateReflection}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>No Twin projection is available. Nothing is inferred from missing state.</p>
              )}
            </Card>

            <Card>
              <h2>Current private Profiles</h2>
              {view.profiles.length ? (
                <ul className="lite-related">
                  {view.profiles.map((profile) => (
                    <li key={`${profile.runtimeCapability.id}:${profile.runtimeCapability.version}`}>
                      <strong>{profile.runtimeCapability.id}</strong>
                      <span>
                        Runtime v{profile.runtimeCapability.version} · {profile.evidenceCount} evidence entries
                      </span>
                      <p>
                        {profile.acceptedReflections.at(-1)?.text ?? 'No accepted private reflection yet.'}
                      </p>
                      <small>Verified badge: No · Numeric professional score: None</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No current Profile projection is available.</p>
              )}
            </Card>
          </div>

          <Card>
            <h2>Pending private Reflection Candidates</h2>
            {view.pendingCandidates.length ? (
              <div className="lite-list" aria-live="polite">
                {view.pendingCandidates.map((pending) => {
                  const candidate = pending.candidate;
                  const saving = savingId === candidate.reflectionCandidateId;
                  return (
                    <section key={`${candidate.reflectionCandidateId}:${candidate.version}`}>
                      <div className="lite-row">
                        <div>
                          <h3>Reflection Candidate</h3>
                          <p>{candidate.runtimeCapability.id} · runtime v{candidate.runtimeCapability.version}</p>
                        </div>
                        <Badge>Candidate v{candidate.version}</Badge>
                      </div>
                      <p>{candidate.explanation}</p>
                      <blockquote>{candidate.proposedPrivateReflection}</blockquote>
                      <p>{sourceLabel(pending)} · policy {candidate.generation.policyVersion}</p>
                      <p style={{ overflowWrap: 'anywhere' }}>
                        <small>Candidate fingerprint: {pending.candidateFingerprintSha256}</small>
                      </p>
                      <div className="lite-subnav" aria-label="Reflection disposition">
                        <Button disabled={saving} onClick={() => void decide(pending, 'ACCEPTED')}>
                          Accept private reflection
                        </Button>
                        <Button variant="secondary" disabled={saving} onClick={() => void decide(pending, 'DEFERRED')}>
                          Defer reflection
                        </Button>
                        <Button variant="secondary" disabled={saving} onClick={() => void decide(pending, 'REJECTED')}>
                          Reject reflection
                        </Button>
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <p>No pending private Reflection Candidate.</p>
            )}
          </Card>

          <Card>
            <h2>Governed evidence provenance</h2>
            {view.ledgerEntries.length ? (
              <ol className="lite-timeline">
                {view.ledgerEntries.map((entry) => (
                  <li key={entry.capabilityLedgerEntryId}>
                    <strong>{entry.observation.sourceKind}</strong>
                    <time>{entry.recordedAt}</time>
                    <p>
                      {entry.observation.sourceOwner} · {entry.observation.sourceId} · version {String(entry.observation.sourceVersion)}
                    </p>
                    <small style={{ overflowWrap: 'anywhere' }}>
                      Source fingerprint: {entry.observation.sourceFingerprintSha256}
                    </small>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No governed evidence entries are available.</p>
            )}
          </Card>
        </>
      )}
    </>
  );
}
