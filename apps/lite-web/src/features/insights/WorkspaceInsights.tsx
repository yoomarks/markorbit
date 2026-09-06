import { useEffect, useMemo, useState } from 'react';
import type {
  ProductConversionRate,
  ProductLoopConversionAnalyticsSnapshot
} from '@markorbit/contracts/beta-readiness';
import { Alert, Badge, Button, Card, LoadingState } from '@markorbit/ui';
import {
  createWorkspaceInsightsClient,
  WorkspaceInsightsHttpError,
  type WorkspaceInsightsClient
} from '../../api/workspace-insights.js';
import './workspace-insights.css';

export type WorkspacePreferenceSource = 'EXPLICIT' | 'PRODUCT_FEEDBACK' | 'NONE' | null;

export interface WorkspaceInsightsProps {
  workspaceId: string;
  preferenceSource: WorkspacePreferenceSource;
  client?: WorkspaceInsightsClient;
}

function preferenceCopy(source: WorkspacePreferenceSource): string {
  if (source === 'EXPLICIT') return "Today's ranking is using explicit preference evidence.";
  if (source === 'PRODUCT_FEEDBACK')
    return "Today's ranking is using product-use feedback as preference evidence.";
  if (source === 'NONE') return 'No preference evidence is currently shaping this view.';
  return 'The current preference evidence source is unavailable. This is not treated as no preference evidence.';
}

function rateCopy(rate: Readonly<ProductConversionRate>): string {
  if (rate.rate === null) return `No rate yet · ${rate.numerator} of ${rate.denominator}`;
  return `${Math.round(rate.rate * 100)}% · ${rate.numerator} of ${rate.denominator}`;
}

function Observation({ snapshot }: { snapshot: Readonly<ProductLoopConversionAnalyticsSnapshot> }) {
  const pendingFeedback =
    snapshot.content.publishPackagesPrepared - snapshot.content.userReportedUseFeedback;
  if (pendingFeedback > 0)
    return (
      <Card>
        <p className="workspace-insights-kicker">NEXT REFLECTION</p>
        <h3>Outcome feedback can close a visible loop</h3>
        <p>
          {pendingFeedback} packaged content {pendingFeedback === 1 ? 'opportunity does' : 'opportunities do'}
          {' '}not yet have user-reported use feedback in this all-time Workspace snapshot.
        </p>
        <p className="workspace-insights-muted">
          Published / Used / Not used remains user-reported. MarkOrbit did not execute or independently
          verify the external action.
        </p>
      </Card>
    );

  const pendingQualification =
    snapshot.opportunity.opportunityCandidates - snapshot.opportunity.qualificationDecisions;
  if (pendingQualification > 0)
    return (
      <Card>
        <p className="workspace-insights-kicker">NEXT REFLECTION</p>
        <h3>Qualification is the clearest count-only follow-up</h3>
        <p>
          {pendingQualification} opportunity {pendingQualification === 1 ? 'candidate does' : 'candidates do'}
          {' '}not yet have a recorded Human Qualification decision in this all-time snapshot.
        </p>
        <p className="workspace-insights-muted">
          This is an observed workflow count, not a priority, quality, legal-risk or competence score.
        </p>
      </Card>
    );

  return (
    <Card>
      <p className="workspace-insights-kicker">CURRENT REFLECTION</p>
      <h3>No count-only follow-up is surfaced</h3>
      <p>
        The current stage counts do not expose an unrecorded feedback or qualification gap. This does not
        mean all work is complete or that no professional action is needed.
      </p>
    </Card>
  );
}

function FunnelCard({
  title,
  description,
  stages,
  rates
}: {
  title: string;
  description: string;
  stages: ReadonlyArray<readonly [label: string, value: number]>;
  rates: ReadonlyArray<readonly [label: string, value: Readonly<ProductConversionRate>]>;
}) {
  return (
    <Card>
      <h3>{title}</h3>
      <p>{description}</p>
      <dl className="workspace-insights-stages">
        {stages.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details className="workspace-insights-details">
        <summary>Show conversion context</summary>
        <ul>
          {rates.map(([label, value]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{rateCopy(value)}</strong>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

export function WorkspaceInsights({
  workspaceId,
  preferenceSource,
  client: suppliedClient
}: WorkspaceInsightsProps) {
  const client = useMemo(
    () => suppliedClient ?? createWorkspaceInsightsClient(workspaceId),
    [suppliedClient, workspaceId]
  );
  const [snapshot, setSnapshot] = useState<ProductLoopConversionAnalyticsSnapshot>();
  const [error, setError] = useState<WorkspaceInsightsHttpError>();
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    client
      .load()
      .then((value) => {
        if (active) setSnapshot(value);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setSnapshot(undefined);
        setError(
          cause instanceof WorkspaceInsightsHttpError
            ? cause
            : new WorkspaceInsightsHttpError(
                503,
                'WORKSPACE_INSIGHTS_REQUEST_FAILED',
                'Workspace Insights is unavailable.',
                true
              )
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, retryKey]);

  return (
    <section className="workspace-insights" aria-labelledby="workspace-insights-heading">
      <div className="workspace-insights-heading">
        <div>
          <p className="workspace-insights-kicker">REFLECT</p>
          <h2 id="workspace-insights-heading">Workspace Insights</h2>
          <p>
            See what moved through existing Lite workflows and which explicit preference evidence is
            shaping Today. These observations do not authorize action or score professional performance.
          </p>
        </div>
        <Badge>Observational only</Badge>
      </div>

      <Card>
        <p className="workspace-insights-kicker">LEARNING TRANSPARENCY</p>
        <h3>How Today is being shaped</h3>
        <p>{preferenceCopy(preferenceSource)}</p>
      </Card>

      {loading && !snapshot ? <LoadingState label="Loading Workspace Insights" /> : null}
      {error ? (
        <Alert
          tone="warning"
          title={
            error.status === 401 || error.status === 403
              ? 'Workspace Insights access denied'
              : 'Workspace Insights unavailable'
          }
        >
          {error.message} No analytics counts are shown as zero when the owner source cannot be read.
          {error.status !== 401 && error.status !== 403 ? (
            <div className="workspace-insights-retry">
              <Button variant="secondary" onClick={() => setRetryKey((value) => value + 1)}>
                Retry Insights
              </Button>
            </div>
          ) : null}
        </Alert>
      ) : null}

      {snapshot ? (
        <>
          <Observation snapshot={snapshot} />
          <div className="workspace-insights-grid">
            <FunnelCard
              title="Content progress"
              description="Distinct Content Opportunities observed at each durable Lite stage."
              stages={[
                ['Content Opportunities', snapshot.content.contentOpportunities],
                ['Drafts prepared', snapshot.content.draftPrepared],
                ['Human Reviews recorded', snapshot.content.humanReviewRecorded],
                ['Publish Packages prepared', snapshot.content.publishPackagesPrepared],
                ['User-reported use feedback', snapshot.content.userReportedUseFeedback]
              ]}
              rates={[
                ['Opportunity → Draft', snapshot.content.rates.opportunityToDraft],
                ['Draft → Human Review', snapshot.content.rates.draftToHumanReview],
                ['Human Review → Publish Package', snapshot.content.rates.humanReviewToPublishPackage],
                ['Publish Package → Feedback', snapshot.content.rates.publishPackageToUseFeedback]
              ]}
            />
            <FunnelCard
              title="Opportunity progress"
              description="Distinct Opportunity Candidates observed through governed qualification and handoff."
              stages={[
                ['Opportunity Candidates', snapshot.opportunity.opportunityCandidates],
                ['Qualification Decisions', snapshot.opportunity.qualificationDecisions],
                ['Qualified for MarkReg', snapshot.opportunity.qualifiedForMarkReg],
                ['Formal Opportunity handoff results', snapshot.opportunity.formalOpportunityHandoffResults]
              ]}
              rates={[
                ['Candidate → Qualification', snapshot.opportunity.rates.candidateToQualification],
                ['Qualification → Qualified', snapshot.opportunity.rates.qualificationToQualified],
                [
                  'Qualified → Formal Opportunity handoff',
                  snapshot.opportunity.rates.qualifiedToFormalOpportunityHandoff
                ]
              ]}
            />
          </div>
          <details className="workspace-insights-evidence">
            <summary>Metric scope & source evidence</summary>
            <dl>
              <div>
                <dt>Owner</dt>
                <dd>{snapshot.owner}</dd>
              </div>
              <div>
                <dt>Scope</dt>
                <dd>Workspace · all time</dd>
              </div>
              <div>
                <dt>Generated</dt>
                <dd>
                  <time dateTime={snapshot.generatedAt}>{snapshot.generatedAt}</time>
                </dd>
              </div>
              <div>
                <dt>External use independently verified</dt>
                <dd>No</dd>
              </div>
            </dl>
            <p>
              Formal Opportunity handoff evidence is owned by Lite Prepared Action handoff results. This
              snapshot does not directly query MarkReg and does not mutate business state.
            </p>
            <ul>
              {snapshot.sourceFamilies.map((source) => (
                <li key={`${source.kind}:${source.downstreamOwner ?? ''}`}>
                  {source.owner} · {source.kind} · {source.provenance}
                  {source.downstreamOwner ? ` · downstream ${source.downstreamOwner}` : ''}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}
