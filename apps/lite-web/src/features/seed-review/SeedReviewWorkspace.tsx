import { useEffect, useMemo, useState } from 'react';
import type {
  DataEngineApplicantCandidateReferenceV1,
  DataEngineApplicantCandidateV1,
  DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import type { LiteWorkItemV1 } from '@markorbit/contracts/lite-work-item';
import type {
  SeedExactReferenceV1,
  SeedWorkspacePackageV1
} from '@markorbit/contracts/seed-workspace-package';
import type { TrademarkAsset } from '@markorbit/contracts/trademark-asset-workspace';
import type { WorkspaceDirectoryEntryV1 } from '@markorbit/contracts/workspace-directory';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import {
  createSeedReviewApi,
  SeedReviewApiError,
  type CnSeedAgentRecord,
  type CnSeedPortfolioRelationship,
  type CnSeedRelationshipItem,
  type SeedReviewApi
} from '../../api/seed-review.js';
import { updateLiteLocation } from '../../routing/workspace-navigation.js';

type LoadState = 'loading' | 'ready' | 'error';
type Step = 'agency' | 'owner' | 'applicant' | 'portfolio' | 'complete';

export interface SeedReviewWorkspaceProps {
  workspaceId: string;
  packageId: string;
  api?: SeedReviewApi;
}

function message(error: unknown): string {
  if (error instanceof SeedReviewApiError) {
    if (error.code.includes('UNAVAILABLE'))
      return 'The source-backed review is temporarily unavailable. MO will not guess from stale or incomplete data.';
    return error.message;
  }
  return 'The prepared review could not be loaded.';
}

function seedCnAgentReference(
  value: Readonly<SeedWorkspacePackageV1>
): Readonly<SeedExactReferenceV1> | null {
  return (
    value.target.sourceRefs.find(
      (item) => item.owner === 'DATA_ENGINE' && item.kind === 'CN_AGENT'
    ) ?? null
  );
}

function sameSeedReference(
  prepared: Readonly<SeedExactReferenceV1>,
  current: Readonly<SeedExactReferenceV1>
): boolean {
  return (
    prepared.owner === current.owner &&
    prepared.kind === current.kind &&
    prepared.id === current.id &&
    String(prepared.version) === String(current.version) &&
    prepared.fingerprintSha256 === current.fingerprintSha256 &&
    new Date(prepared.observedAt).toISOString() === new Date(current.observedAt).toISOString()
  );
}

function markLabel(value: Readonly<CnSeedPortfolioRelationship>): string {
  return value.mark_name_raw?.trim() || `Application ${value.application_number}`;
}

function candidateLabel(value: Readonly<DataEngineDiscoveredTrademarkCandidateV1>): string {
  return (
    value.mark_text?.trim() ||
    value.registration_number?.trim() ||
    value.application_number?.trim() ||
    value.trademark_candidate_id
  );
}

function applicantReference(
  value: Readonly<DataEngineApplicantCandidateV1>
): DataEngineApplicantCandidateReferenceV1 {
  return {
    applicant_candidate_id: value.applicant_candidate_id,
    source_reference: value.source_reference
  };
}

export function SeedReviewWorkspace({
  workspaceId,
  packageId,
  api: suppliedApi
}: SeedReviewWorkspaceProps) {
  const api = useMemo(
    () => suppliedApi ?? createSeedReviewApi(workspaceId),
    [suppliedApi, workspaceId]
  );
  const [state, setState] = useState<LoadState>('loading');
  const [step, setStep] = useState<Step>('agency');
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<SeedWorkspacePackageV1 | null>(null);
  const [agent, setAgent] = useState<CnSeedAgentRecord | null>(null);
  const [agencyMarks, setAgencyMarks] = useState<readonly CnSeedPortfolioRelationship[]>([]);
  const [selectedAgencyMark, setSelectedAgencyMark] = useState<CnSeedPortfolioRelationship | null>(
    null
  );
  const [ownerRelationships, setOwnerRelationships] = useState<readonly CnSeedRelationshipItem[]>(
    []
  );
  const [selectedOwner, setSelectedOwner] = useState<CnSeedRelationshipItem | null>(null);
  const [applicants, setApplicants] = useState<readonly DataEngineApplicantCandidateV1[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<DataEngineApplicantCandidateV1 | null>(
    null
  );
  const [directory, setDirectory] = useState<WorkspaceDirectoryEntryV1 | null>(null);
  const [portfolio, setPortfolio] = useState<readonly DataEngineDiscoveredTrademarkCandidateV1[]>(
    []
  );
  const [asset, setAsset] = useState<TrademarkAsset | null>(null);
  const [workItem, setWorkItem] = useState<LiteWorkItemV1 | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void api
      .loadPackage(packageId)
      .then(async (value) => {
        if (!active) return;
        setPrepared(value);
        const preparedAgent = seedCnAgentReference(value);
        if (!preparedAgent) {
          setError(
            'This Seed Package does not contain a supported exact CN agent reference. MO will not fall back to name guessing.'
          );
          setState('error');
          return;
        }
        const currentAgent = await api.loadCnAgent(preparedAgent.id);
        if (!active) return;
        if (!currentAgent) {
          setError(
            'The prepared CN agent source record is no longer present in the current source read model.'
          );
          setState('error');
          return;
        }
        if (!sameSeedReference(preparedAgent, currentAgent.source_reference)) {
          setError(
            'The prepared CN agent source record has changed since this invitation was prepared. MO stopped before using stale agency context.'
          );
          setState('error');
          return;
        }
        if (!currentAgent.entity_id) {
          setError(
            'The current CN agent source record has no entity pointer for bounded portfolio traversal.'
          );
          setState('error');
          return;
        }
        setAgent(currentAgent);
        const marks = await api.loadCnAgentPortfolio(currentAgent.entity_id);
        if (!active) return;
        setAgencyMarks(marks);
        setState('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(message(cause));
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [api, packageId]);

  const reviewAgencyMark = async (value: Readonly<CnSeedPortfolioRelationship>) => {
    setBusy(true);
    setError(null);
    try {
      const relationships = await api.loadCnRelationships(value.application_number);
      const currentOwners = relationships.filter(
        (item) =>
          item.edge.temporal.is_current &&
          item.edge.relationship_type === 'CURRENT_OWNER' &&
          Boolean(item.source_fact.name?.trim())
      );
      setSelectedAgencyMark(value);
      setOwnerRelationships(currentOwners);
      setSelectedOwner(null);
      setApplicants([]);
      setStep('owner');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const discoverOwner = async (value: Readonly<CnSeedRelationshipItem>) => {
    const ownerName = value.source_fact.name?.trim();
    if (!ownerName) return;
    setBusy(true);
    setError(null);
    try {
      const values = await api.discoverApplicants(ownerName);
      setSelectedOwner(value);
      setApplicants(values);
      setSelectedApplicant(null);
      setStep('applicant');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const confirmApplicant = async (value: Readonly<DataEngineApplicantCandidateV1>) => {
    setBusy(true);
    setError(null);
    try {
      const localDirectory = await api.createDirectory(packageId, value);
      const values = await api.loadApplicantPortfolio(applicantReference(value));
      setSelectedApplicant(value);
      setDirectory(localDirectory);
      setPortfolio(values);
      setStep('portfolio');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const manageAndStart = async (value: Readonly<DataEngineDiscoveredTrademarkCandidateV1>) => {
    if (!directory || !selectedApplicant) return;
    setBusy(true);
    setError(null);
    try {
      const managed = await api.admitManagedTrademark(
        packageId,
        directory,
        applicantReference(selectedApplicant),
        value
      );
      const item = await api.createFirstWorkItem(
        packageId,
        directory,
        managed,
        `Review ${candidateLabel(value)} and decide the next professional action`
      );
      await api.recordFirstValue(packageId, item.liteWorkItemId);
      setAsset(managed);
      setWorkItem(item);
      setStep('complete');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return <LoadingState label="Opening your prepared starting point" />;
  if (state === 'error' || !prepared)
    return (
      <ErrorState
        title="Prepared review is not available yet"
        description={error ?? 'The Seed Package could not be opened.'}
      />
    );

  return (
    <section aria-label="Prepared Seed review">
      <PageHeader
        title={prepared.target.displayName}
        description="Review what MO found, confirm only what you recognize, and start with one real trademark task."
      />

      <Card>
        <strong>What MO prepared</strong>
        <p>
          This starting point is source-backed context, not a customer record or a legal identity
          determination. Nothing becomes managed until you explicitly choose it.
        </p>
        {agent && (
          <p>
            Current source match: <strong>{agent.agent_name}</strong> · agent code{' '}
            {agent.agent_code} · source version {agent.source_reference.version}
          </p>
        )}
        <div>
          {prepared.collections.representedApplicants && (
            <Badge>{prepared.collections.representedApplicants.count} applicant candidates</Badge>
          )}{' '}
          {prepared.collections.relatedTrademarks && (
            <Badge>{prepared.collections.relatedTrademarks.count} related trademarks</Badge>
          )}
        </div>
      </Card>

      {error && (
        <Alert tone="danger" title="This step could not be completed">
          {error}
        </Alert>
      )}

      {step === 'agency' && (
        <Card>
          <PageHeader
            title="Start from work this agency has handled"
            description="MO is showing current and historical source relationships. This does not mean every owner is a current client."
          />
          {agencyMarks.length === 0 ? (
            <EmptyState
              title="No source-backed handled trademarks are available"
              description="MO will not manufacture an agency portfolio when the accepted Data Engine read has no result."
            />
          ) : (
            <div>
              {agencyMarks.slice(0, 30).map((item) => (
                <div key={`${item.role}:${item.application_number}`}>
                  <strong>{markLabel(item)}</strong>
                  <div>
                    CN {item.application_number} · {item.relationship_states.join(' · ')}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void reviewAgencyMark(item)}
                  >
                    Review the current owner
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {step === 'owner' && selectedAgencyMark && (
        <Card>
          <PageHeader
            title={`Who currently owns ${markLabel(selectedAgencyMark)}?`}
            description="Choose an official relationship fact to continue. The next step still requires applicant review."
          />
          {ownerRelationships.length === 0 ? (
            <EmptyState
              title="No current owner relationship is available"
              description="This mark cannot continue through the Seed review without a source-backed current owner."
            />
          ) : (
            <div>
              {ownerRelationships.map((item) => (
                <div key={item.source_fact.relation_key}>
                  <strong>{item.source_fact.name}</strong>
                  {item.source_fact.address && <div>{item.source_fact.address}</div>}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void discoverOwner(item)}
                  >
                    Find applicant records for this owner
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button type="button" variant="secondary" onClick={() => setStep('agency')}>
            Back
          </Button>
        </Card>
      )}

      {step === 'applicant' && selectedOwner && (
        <Card>
          <PageHeader
            title="Which applicant record do you recognize?"
            description="These are Data Engine candidates. Selecting one creates only a private Workspace directory reference, not a Customer Relationship."
          />
          {applicants.length === 0 ? (
            <EmptyState
              title="No applicant candidate matched this owner name"
              description="MO will not infer identity from the display name alone."
            />
          ) : (
            <div>
              {applicants.map((item) => (
                <div key={item.applicant_candidate_id}>
                  <strong>{item.display_name}</strong>
                  <div>
                    {item.source_reference.jurisdiction} · {item.match_kind} · observed{' '}
                    {new Date(item.source_reference.observed_at).toLocaleDateString()}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void confirmApplicant(item)}
                  >
                    Use this applicant record in my Workspace
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button type="button" variant="secondary" onClick={() => setStep('owner')}>
            Back
          </Button>
        </Card>
      )}

      {step === 'portfolio' && directory && selectedApplicant && (
        <Card>
          <PageHeader
            title={`Trademarks found for ${selectedApplicant.display_name}`}
            description="Choose one trademark you actually manage. MO revalidates the exact source record before creating the managed Workspace asset."
          />
          {portfolio.length === 0 ? (
            <EmptyState
              title="No source-backed trademark candidates are available"
              description="The confirmed applicant reference exists, but its bounded portfolio read returned no trademark candidate."
            />
          ) : (
            <div>
              {portfolio.slice(0, 50).map((item) => (
                <div key={item.trademark_candidate_id}>
                  <strong>{candidateLabel(item)}</strong>
                  <div>
                    {item.jurisdiction}
                    {item.application_number ? ` · App. ${item.application_number}` : ''}
                    {item.registration_number ? ` · Reg. ${item.registration_number}` : ''}
                    {item.classes.length ? ` · Classes ${item.classes.join(', ')}` : ''}
                  </div>
                  <Button type="button" disabled={busy} onClick={() => void manageAndStart(item)}>
                    Manage this trademark and start review
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {step === 'complete' && asset && workItem && (
        <Card>
          <PageHeader
            title="Your first real work item is ready"
            description="The selected trademark is now explicitly managed in this Workspace, and the follow-up is in your durable Work/Today flow."
          />
          <p>
            MO recorded the first-value milestone from the exact Work Item after it existed. No
            filing, message, payment or other external action was authorized.
          </p>
          <Button
            type="button"
            onClick={() =>
              updateLiteLocation({
                surface: 'trademarks',
                workspaceId,
                params: { trademarkAssetId: asset.trademarkAssetId }
              })
            }
          >
            Open the managed trademark
          </Button>{' '}
          <Button
            type="button"
            variant="secondary"
            onClick={() => updateLiteLocation({ surface: 'today', workspaceId })}
          >
            Go to Today
          </Button>
        </Card>
      )}
    </section>
  );
}
