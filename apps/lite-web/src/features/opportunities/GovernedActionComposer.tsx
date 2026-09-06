import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ControlledHandoffPreparationResultV1 } from '@markorbit/contracts/controlled-handoff-preparation';
import type {
  ControlledHandoffCurrentValidationV1,
  ControlledHandoffMutationResultV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  EligibilityEvaluation,
  ServicePackage
} from '@markorbit/contracts/provider-execution';
import type {
  AuthorizedProviderProjectionFieldV1,
  ProviderDiscoveryCandidateV1,
  ProviderDiscoveryResultV1
} from '@markorbit/contracts/provider-discovery';
import type { ProviderSelectionMutationResultV1 } from '@markorbit/contracts/provider-selection';
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
  TextArea
} from '@markorbit/ui';
import {
  createGovernedProviderClient,
  GovernedProviderHttpError,
  type GovernedAllocationResult,
  type GovernedProviderClient,
  type ReadyControlledHandoffPreparation
} from '../../api/governed-provider.js';
import './governed-action-composer.css';

type JourneyPhase =
  | 'loading'
  | 'discovery'
  | 'selection-review'
  | 'selecting'
  | 'preview-loading'
  | 'preview-review'
  | 'preview-stale'
  | 'handoff-authorizing'
  | 'handoff-current'
  | 'eligibility-loading'
  | 'allocation-review'
  | 'allocating'
  | 'success'
  | 'blocked'
  | 'unavailable'
  | 'conflict'
  | 'error';

export interface GovernedActionComposerProps {
  workspaceId: string;
  servicePackageId: string;
  client?: GovernedProviderClient;
}

function projectionValue(
  candidate: Readonly<ProviderDiscoveryCandidateV1>,
  field: AuthorizedProviderProjectionFieldV1['field']
): unknown {
  return candidate.authorizedProjection.fields.find((item) => item.field === field)?.value;
}

function providerLabel(candidate: Readonly<ProviderDiscoveryCandidateV1>): string {
  const value = projectionValue(candidate, 'displayName');
  return typeof value === 'string' && value.trim() ? value : candidate.providerId;
}

function listProjection(
  candidate: Readonly<ProviderDiscoveryCandidateV1>,
  field: 'serviceTypes' | 'jurisdictions' | 'evidenceReferences'
): readonly string[] {
  const value = projectionValue(candidate, field);
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

function sourceCheckedAt(candidate: Readonly<ProviderDiscoveryCandidateV1>): string {
  const checked = candidate.sourceVersions.map((source) => source.checkedAt).sort();
  return checked.at(-1) ?? candidate.generatedAt;
}

function JourneyRail({ phase }: { phase: JourneyPhase }) {
  const active =
    phase === 'loading' || phase === 'discovery'
      ? 0
      : phase === 'selection-review' || phase === 'selecting'
        ? 2
        : phase === 'preview-loading' ||
            phase === 'preview-review' ||
            phase === 'preview-stale' ||
            phase === 'handoff-authorizing'
          ? 3
          : 4;
  const steps = ['Understand', 'Compare', 'Choose', 'Review consequence', 'Confirm'];
  return (
    <ol className="governed-journey" aria-label="Governed Provider progression">
      {steps.map((step, index) => (
        <li
          key={step}
          data-state={index < active ? 'complete' : index === active ? 'current' : 'next'}
        >
          <span>{index + 1}</span>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}

function errorCopy(error: unknown): { title: string; description: string; phase: JourneyPhase } {
  if (error instanceof GovernedProviderHttpError) {
    if (error.status === 409)
      return {
        title: 'Current authority changed',
        description:
          'A reviewed version or replay no longer matches current owner truth. Refresh and review again before any new action.',
        phase: 'conflict'
      };
    if (error.status === 503)
      return {
        title: 'Current authority cannot be verified',
        description:
          'Required owner truth is unavailable. MarkOrbit will not infer a Candidate, Handoff, or Allocation while authority is unavailable.',
        phase: 'unavailable'
      };
    if (error.status === 404)
      return {
        title: 'Provider progression unavailable',
        description:
          'The bounded work context or current Provider authority is not available in this Workspace.',
        phase: 'blocked'
      };
    if (error.status === 401 || error.status === 403)
      return {
        title: 'Governed action unavailable',
        description:
          'Your authenticated Workspace session does not currently authorize this reviewed action.',
        phase: 'blocked'
      };
  }
  return {
    title: 'Provider progression temporarily unavailable',
    description:
      'Current owner truth could not be completed. No positive Provider consequence was created locally.',
    phase: 'error'
  };
}

function CandidateCard({
  candidate,
  onReview,
  disabled
}: {
  candidate: Readonly<ProviderDiscoveryCandidateV1>;
  onReview: () => void;
  disabled: boolean;
}) {
  const services = listProjection(candidate, 'serviceTypes');
  const jurisdictions = listProjection(candidate, 'jurisdictions');
  const evidence = listProjection(candidate, 'evidenceReferences');
  return (
    <Card>
      <div className="governed-card-heading">
        <div>
          <Badge>Candidate only</Badge>
          <h2>{providerLabel(candidate)}</h2>
        </div>
        <small>Checked {sourceCheckedAt(candidate)}</small>
      </div>
      <p className="lite-long">{candidate.explanation.summary}</p>
      <KeyValueList
        items={[
          { key: 'Service match', value: services.join(', ') || 'No projected service label' },
          {
            key: 'Jurisdiction match',
            value: jurisdictions.join(', ') || 'No projected jurisdiction label'
          },
          { key: 'Direct Executor disclosure', value: candidate.directExecutorDisclosure.state },
          { key: 'Evidence references', value: String(evidence.length) }
        ]}
      />
      <h3>Why this Candidate is shown</h3>
      <ul className="governed-evidence-list">
        {candidate.explanation.matchedConstraints.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>Limitations</h3>
      <ul className="governed-limitations">
        {candidate.explanation.limitations.map((item) => (
          <li key={item.code}>{item.explanation}</li>
        ))}
      </ul>
      <Button onClick={onReview} disabled={disabled}>
        Review this Candidate
      </Button>
    </Card>
  );
}

function SelectionReview({
  candidate,
  rationale,
  busy,
  onRationale,
  onSubmit,
  onBack
}: {
  candidate: Readonly<ProviderDiscoveryCandidateV1>;
  rationale: string;
  busy: boolean;
  onRationale: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}) {
  return (
    <Card>
      <Badge>Human Selection</Badge>
      <h2>Choose {providerLabel(candidate)}</h2>
      <p>
        You are selecting this exact Candidate after reviewing its evidence and limitations. This
        does not disclose data, allocate work, contact the Provider, create an appointment, file, or
        pay anything.
      </p>
      <form className="governed-form" onSubmit={onSubmit}>
        <TextArea
          label="Why this Candidate fits the reviewed need"
          value={rationale}
          rows={4}
          required
          disabled={busy}
          onChange={(event) => onRationale(event.currentTarget.value)}
        />
        <div className="governed-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={onBack}>
            Back to comparison
          </Button>
          <Button type="submit" disabled={busy || !rationale.trim()}>
            {busy ? 'Recording Selection…' : 'Record human Selection'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SelectionState({ selection }: { selection: Readonly<ProviderSelectionMutationResultV1> }) {
  return (
    <Alert tone="success" title="Human Selection recorded">
      Selection {selection.selection.providerSelectionId} v{selection.selection.version} is current
      for the reviewed scope. Candidate ≠ Selection: no data Handoff or Allocation has occurred.
    </Alert>
  );
}

function PrivacyPreview({
  preparation,
  acknowledged,
  busy,
  providerName,
  onAcknowledged,
  onAuthorize
}: {
  preparation: Readonly<ReadyControlledHandoffPreparation>;
  acknowledged: boolean;
  busy: boolean;
  providerName: string;
  onAcknowledged: (value: boolean) => void;
  onAuthorize: () => void;
}) {
  return (
    <Card>
      <Badge>Privacy Preview · not authorization</Badge>
      <h2>Review exactly what will be disclosed</h2>
      <div className="governed-preview-grid">
        <section>
          <h3>Who receives it</h3>
          <p>
            <strong>{providerName}</strong>
            <br />
            Final execution Provider · {preparation.recipient.providerId}
          </p>
        </section>
        <section>
          <h3>Why it is needed</h3>
          <p>{preparation.purpose.code}</p>
          <small>{preparation.purpose.instructionReference}</small>
        </section>
        <section>
          <h3>Included</h3>
          <ul>
            {preparation.includedFields.map((field) => (
              <li key={`${field.dataClass}:${field.fieldPath}:${field.sourceReference}`}>
                <strong>{field.dataClass}</strong> · {field.fieldPath} · {field.sourceOwner}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Explicitly excluded</h3>
          <ul>
            {preparation.excludedGenericDataClasses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
      <Alert title="Currentness and limits">
        <ul className="governed-inline-list">
          {preparation.publicLimitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Alert>
      <label className="governed-acknowledgement">
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={busy}
          onChange={(event) => onAcknowledged(event.currentTarget.checked)}
        />
        <span>
          I reviewed this exact recipient, purpose, included/excluded projection, and current source
          tuple. I understand this acknowledgement is bound to this Privacy Preview.
        </span>
      </label>
      <Button disabled={!acknowledged || busy} onClick={onAuthorize}>
        {busy ? 'Authorizing controlled Handoff…' : 'Authorize controlled Handoff'}
      </Button>
    </Card>
  );
}

function HandoffState({
  handoff,
  validation,
  busy,
  onPrepareAllocation
}: {
  handoff: Readonly<ControlledHandoffMutationResultV1>;
  validation: Readonly<ControlledHandoffCurrentValidationV1>;
  busy: boolean;
  onPrepareAllocation: () => void;
}) {
  return (
    <Card>
      <Badge>Controlled Handoff</Badge>
      <h2>Exact Handoff is current</h2>
      <KeyValueList
        items={[
          { key: 'Status', value: handoff.envelope.status },
          { key: 'Valid from', value: handoff.envelope.validFrom },
          { key: 'Valid until', value: handoff.envelope.validUntil },
          { key: 'Current validation', value: validation.decision }
        ]}
      />
      <p>
        Selection ≠ Handoff: this authorizes only the exact reviewed disclosure. It does not contact
        the Provider, create Provider Acceptance, appoint a professional, file, pay, or complete the
        matter.
      </p>
      <Button disabled={busy} onClick={onPrepareAllocation}>
        {busy ? 'Checking current allocation eligibility…' : 'Prepare governed Allocation review'}
      </Button>
    </Card>
  );
}

function AllocationReview({
  selection,
  handoff,
  eligibility,
  busy,
  onConfirm
}: {
  selection: Readonly<ProviderSelectionMutationResultV1>;
  handoff: Readonly<ControlledHandoffMutationResultV1>;
  eligibility: Readonly<EligibilityEvaluation>;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <Card>
      <Badge>Governed Allocation</Badge>
      <h2>Confirm internal provider routing</h2>
      <KeyValueList
        items={[
          {
            key: 'Selection',
            value: `${selection.selection.providerSelectionId} · v${selection.selection.version}`
          },
          {
            key: 'Handoff',
            value: `${handoff.envelope.controlledHandoffId} · v${handoff.envelope.version}`
          },
          { key: 'Owner eligibility', value: eligibility.outcome }
        ]}
      />
      <Alert tone="warning" title="What this confirmation does">
        It creates one internal governed Allocation bound to the current Selection, owner
        eligibility, and exact Controlled Handoff. Provider Acceptance remains a separate event.
      </Alert>
      <p className="governed-non-consequences">
        It does not mean contacted, accepted, engaged, appointed, filed, paid, officially decided,
        or completed.
      </p>
      <Button disabled={busy} onClick={onConfirm}>
        {busy ? 'Creating governed Allocation…' : 'Confirm governed Allocation'}
      </Button>
    </Card>
  );
}

export function GovernedActionComposer({
  workspaceId,
  servicePackageId,
  client
}: GovernedActionComposerProps) {
  const resolvedClient = useMemo(
    () => client ?? createGovernedProviderClient(workspaceId),
    [client, workspaceId]
  );
  const [phase, setPhase] = useState<JourneyPhase>('loading');
  const [servicePackage, setServicePackage] = useState<ServicePackage>();
  const [discovery, setDiscovery] = useState<ProviderDiscoveryResultV1>();
  const [selectedCandidate, setSelectedCandidate] = useState<ProviderDiscoveryCandidateV1>();
  const [rationale, setRationale] = useState('');
  const [selection, setSelection] = useState<ProviderSelectionMutationResultV1>();
  const [preparation, setPreparation] = useState<ControlledHandoffPreparationResultV1>();
  const [previewAcknowledged, setPreviewAcknowledged] = useState(false);
  const [handoff, setHandoff] = useState<ControlledHandoffMutationResultV1>();
  const [handoffValidation, setHandoffValidation] =
    useState<ControlledHandoffCurrentValidationV1>();
  const [eligibility, setEligibility] = useState<EligibilityEvaluation>();
  const [allocation, setAllocation] = useState<GovernedAllocationResult>();
  const [failure, setFailure] = useState<{ title: string; description: string }>();

  const resetDownstream = useCallback(() => {
    setSelectedCandidate(undefined);
    setRationale('');
    setSelection(undefined);
    setPreparation(undefined);
    setPreviewAcknowledged(false);
    setHandoff(undefined);
    setHandoffValidation(undefined);
    setEligibility(undefined);
    setAllocation(undefined);
    setFailure(undefined);
  }, []);

  const load = useCallback(() => {
    resetDownstream();
    setPhase('loading');
    void resolvedClient
      .loadServicePackage(servicePackageId)
      .then(async (nextPackage) => {
        setServicePackage(nextPackage);
        const nextDiscovery = await resolvedClient.discover(nextPackage);
        setDiscovery(nextDiscovery);
        setPhase('discovery');
      })
      .catch((error: unknown) => {
        const copy = errorCopy(error);
        setFailure(copy);
        setPhase(copy.phase);
      });
  }, [resetDownstream, resolvedClient, servicePackageId]);

  useEffect(load, [load]);

  const submitSelection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!servicePackage || !discovery || !selectedCandidate || !rationale.trim()) return;
    setPhase('selecting');
    setFailure(undefined);
    void resolvedClient
      .select(servicePackage, discovery, selectedCandidate, rationale.trim())
      .then(async (nextSelection) => {
        setSelection(nextSelection);
        setPhase('preview-loading');
        const nextPreparation = await resolvedClient.prepareHandoff(
          servicePackage,
          nextSelection,
          selectedCandidate
        );
        setPreparation(nextPreparation);
        setPreviewAcknowledged(false);
        if (nextPreparation.status === 'READY_FOR_HUMAN_REVIEW') setPhase('preview-review');
        else {
          setFailure({
            title:
              nextPreparation.status === 'SOURCE_UNAVAILABLE'
                ? 'Current authority cannot be verified'
                : 'Controlled Handoff is not currently available',
            description: nextPreparation.publicReason
          });
          setPhase(nextPreparation.status === 'SOURCE_UNAVAILABLE' ? 'unavailable' : 'blocked');
        }
      })
      .catch((error: unknown) => {
        const copy = errorCopy(error);
        setFailure(copy);
        setPhase(copy.phase);
      });
  };

  const refreshPreview = () => {
    if (!servicePackage || !selection || !selectedCandidate) return;
    setPhase('preview-loading');
    setFailure(undefined);
    setPreviewAcknowledged(false);
    void resolvedClient
      .prepareHandoff(servicePackage, selection, selectedCandidate)
      .then((nextPreparation) => {
        setPreparation(nextPreparation);
        if (nextPreparation.status === 'READY_FOR_HUMAN_REVIEW') setPhase('preview-review');
        else {
          setFailure({
            title:
              nextPreparation.status === 'SOURCE_UNAVAILABLE'
                ? 'Current authority cannot be verified'
                : 'Controlled Handoff is not currently available',
            description: nextPreparation.publicReason
          });
          setPhase(nextPreparation.status === 'SOURCE_UNAVAILABLE' ? 'unavailable' : 'blocked');
        }
      })
      .catch((error: unknown) => {
        const copy = errorCopy(error);
        setFailure(copy);
        setPhase(copy.phase);
      });
  };

  const authorizeHandoff = () => {
    if (preparation?.status !== 'READY_FOR_HUMAN_REVIEW' || !previewAcknowledged) return;
    setPhase('handoff-authorizing');
    setFailure(undefined);
    void resolvedClient
      .authorizeHandoff(preparation)
      .then(async (nextHandoff) => {
        const validation = await resolvedClient.validateHandoff(nextHandoff);
        if (validation.decision !== 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION') {
          setPreparation(undefined);
          setPreviewAcknowledged(false);
          setFailure({
            title: 'Controlled Handoff is no longer current',
            description: validation.publicReason
          });
          setPhase('preview-stale');
          return;
        }
        setHandoff(nextHandoff);
        setHandoffValidation(validation);
        setPhase('handoff-current');
      })
      .catch((error: unknown) => {
        if (error instanceof GovernedProviderHttpError && error.status === 409) {
          setPreparation(undefined);
          setPreviewAcknowledged(false);
          setFailure({
            title: 'Privacy Preview changed before authorization',
            description:
              'The reviewed tuple is stale. Refresh the Privacy Preview and explicitly review the new tuple before trying again.'
          });
          setPhase('preview-stale');
          return;
        }
        const copy = errorCopy(error);
        setFailure(copy);
        setPhase(copy.phase);
      });
  };

  const prepareAllocation = () => {
    if (!servicePackage || !selectedCandidate || !selection || !handoff || !handoffValidation)
      return;
    setPhase('eligibility-loading');
    setFailure(undefined);
    void resolvedClient
      .evaluateEligibility(servicePackage, selectedCandidate)
      .then((nextEligibility) => {
        setEligibility(nextEligibility);
        if (nextEligibility.outcome !== 'ELIGIBLE') {
          setFailure({
            title: 'Governed Allocation is not currently eligible',
            description:
              'Owner eligibility did not establish a current ELIGIBLE result. No Allocation was created.'
          });
          setPhase('blocked');
          return;
        }
        setPhase('allocation-review');
      })
      .catch((error: unknown) => {
        const copy = errorCopy(error);
        setFailure(copy);
        setPhase(copy.phase);
      });
  };

  const allocate = () => {
    if (
      !servicePackage ||
      !selectedCandidate ||
      !selection ||
      !handoff ||
      !eligibility ||
      eligibility.outcome !== 'ELIGIBLE'
    )
      return;
    setPhase('allocating');
    setFailure(undefined);
    void resolvedClient
      .allocateGoverned(servicePackage, selectedCandidate, selection, handoff, eligibility)
      .then((result) => {
        setAllocation(result);
        setPhase('success');
      })
      .catch((error: unknown) => {
        const copy = errorCopy(error);
        setFailure(copy);
        setPhase(copy.phase);
      });
  };

  const candidates = discovery?.status === 'CANDIDATES' ? discovery.candidates : [];
  const readyPreparation =
    preparation?.status === 'READY_FOR_HUMAN_REVIEW' ? preparation : undefined;

  return (
    <section data-journey-state={phase}>
      <PageHeader
        title="Provider Progression"
        description="Opportunities / Provider Progression · evidence-led governed provider routing"
        actions={<Badge>Governed path</Badge>}
      />
      <Alert title="Permanent authority boundary">
        Candidate ≠ Selection ≠ Handoff ≠ Allocation. Each stage has a separate meaning, explicit
        currentness check, and bounded consequence.
      </Alert>
      <JourneyRail phase={phase} />

      {phase === 'loading' ? <LoadingState label="Loading governed Provider context" /> : null}

      {servicePackage && phase !== 'loading' ? (
        <Card>
          <Badge>Bounded work context</Badge>
          <h2>{servicePackage.serviceType}</h2>
          <KeyValueList
            items={[
              { key: 'Jurisdiction', value: servicePackage.jurisdiction },
              { key: 'Service Package', value: servicePackage.servicePackageId },
              { key: 'Package version', value: `v${servicePackage.version}` }
            ]}
          />
        </Card>
      ) : null}

      {discovery?.status === 'NO_AUTHORIZED_CANDIDATES' && phase === 'discovery' ? (
        <EmptyState
          title="No authorized Provider Candidates"
          description={discovery.publicMessage}
          action={<Button onClick={load}>Refresh current Discovery</Button>}
        />
      ) : null}

      {discovery?.status === 'AUTHORITY_UNAVAILABLE' && phase === 'discovery' ? (
        <ErrorState
          title="Current authority cannot be verified"
          description={discovery.publicMessage}
          onRetry={load}
        />
      ) : null}

      {candidates.length ? (
        <>
          <div className="governed-section-heading">
            <div>
              <h2>Understand and compare current Candidates</h2>
              <p>
                Evidence-led comparison only. No score, ranking, winner, appointment, or contact.
              </p>
            </div>
            <Badge>
              {candidates.length} current Candidate{candidates.length === 1 ? '' : 's'}
            </Badge>
          </div>
          <div className="governed-candidate-grid">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.providerDiscoveryCandidateId}
                candidate={candidate}
                disabled={Boolean(selection) || phase === 'selecting'}
                onReview={() => {
                  setSelectedCandidate(candidate);
                  setRationale('');
                  setPhase('selection-review');
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      {selectedCandidate && (phase === 'selection-review' || phase === 'selecting') ? (
        <SelectionReview
          candidate={selectedCandidate}
          rationale={rationale}
          busy={phase === 'selecting'}
          onRationale={setRationale}
          onSubmit={submitSelection}
          onBack={() => {
            setSelectedCandidate(undefined);
            setRationale('');
            setPhase('discovery');
          }}
        />
      ) : null}

      {selection ? <SelectionState selection={selection} /> : null}

      {phase === 'preview-loading' ? (
        <LoadingState label="Preparing current Privacy Preview" />
      ) : null}

      {readyPreparation &&
      selectedCandidate &&
      (phase === 'preview-review' || phase === 'handoff-authorizing') ? (
        <PrivacyPreview
          preparation={readyPreparation}
          acknowledged={previewAcknowledged}
          busy={phase === 'handoff-authorizing'}
          providerName={providerLabel(selectedCandidate)}
          onAcknowledged={setPreviewAcknowledged}
          onAuthorize={authorizeHandoff}
        />
      ) : null}

      {phase === 'preview-stale' ? (
        <ErrorState
          title={failure?.title ?? 'Privacy Preview requires review again'}
          description={
            failure?.description ??
            'Current authority changed. A new owner-produced Privacy Preview is required.'
          }
          onRetry={refreshPreview}
        />
      ) : null}

      {handoff &&
      handoffValidation &&
      (phase === 'handoff-current' || phase === 'eligibility-loading') ? (
        <HandoffState
          handoff={handoff}
          validation={handoffValidation}
          busy={phase === 'eligibility-loading'}
          onPrepareAllocation={prepareAllocation}
        />
      ) : null}

      {selection &&
      handoff &&
      eligibility &&
      (phase === 'allocation-review' || phase === 'allocating') ? (
        <AllocationReview
          selection={selection}
          handoff={handoff}
          eligibility={eligibility}
          busy={phase === 'allocating'}
          onConfirm={allocate}
        />
      ) : null}

      {phase === 'success' && allocation ? (
        <Alert tone="success" title="Entered governed collaboration">
          Internal governed Allocation {allocation.allocation.allocationId} is active for provider
          handling. Provider Acceptance remains separate. No filing, payment, appointment, external
          contact, Official Truth, or matter completion is claimed here.
        </Alert>
      ) : null}

      {['blocked', 'unavailable', 'conflict', 'error'].includes(phase) && failure ? (
        <ErrorState title={failure.title} description={failure.description} onRetry={load} />
      ) : null}
    </section>
  );
}
