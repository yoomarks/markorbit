import { useEffect, useMemo, useState } from 'react';
import type {
  ProductConversionRate,
  ProductLoopConversionAnalyticsSnapshot
} from '@markorbit/contracts/beta-readiness';
import { Alert, Badge, Button, Card, LoadingState } from '@markorbit/ui';
import type { DailyOrbitSnapshot } from '../../api/daily-workspace.js';
import {
  createWorkspaceInsightsClient,
  WorkspaceInsightsHttpError,
  type WorkspaceInsightsClient
} from '../../api/workspace-insights.js';
import './workspace-insights.css';

export type WorkspacePreferenceSource = DailyOrbitSnapshot['preferenceSource'] | null | undefined;

export interface WorkspaceInsightsProps {
  workspaceId: string;
  preferenceSource: WorkspacePreferenceSource;
  client?: WorkspaceInsightsClient;
}

function rateLabel(rate: Readonly<ProductConversionRate>): string {
  if (rate.denominator === 0 || rate.rate === null)
    return `${rate.numerator} / ${rate.denominator} · no denominator yet`;
  const percent = new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 0
  }).format(rate.rate);
  return `${rate.numerator} / ${rate.denominator} · ${percent}`;
}
function preferenceMessage(source: WorkspacePreferenceSource): string {
  if (source === 'EXPLICIT') return "Today's ranking is using explicit preference evidence.";
  if (source === 'PRODUCT_FEEDBACK') return "Today's ranking is using product-use feedback.";
  if (source === 'NONE') return 'No preference evidence is currently shaping this view.';
  if (source === null)
    return 'Preference evidence is unavailable for this refresh. Lite does not treat that as NONE.';
  return 'Preference evidence is still loading; no preference conclusion is shown yet.';
}

function feedbackObservation(snapshot: Readonly<ProductLoopConversionAnalyticsSnapshot>): string {
  const prepared = snapshot.content.publishPackagesPrepared;
  const feedback = snapshot.content.userReportedUseFeedback;
  if (prepared === 0) return 'No prepared Publish Package is present in this owner snapshot.';
  if (feedback <= prepared) {
    const pending = prepared - feedback;
    if (pending === 0)
      return 'Every currently observed prepared Publish Package has user-reported outcome feedback.';
    return `${pending} prepared Publish Package${pending === 1 ? '' : 's'} do not yet have user-reported outcome feedback.`;
  }
  return 'Feedback and package counts are shown exactly as the owner reports them; no pending count is inferred.';
}

type Stage = Readonly<{ label: string; value: number }>;
type Rate = Readonly<{ label: string; value: Readonly<ProductConversionRate> }>;

function FunnelCard({ title, stages, rates }: { title: string; stages: Stage[]; rates: Rate[] }) {
  return (
    <Card>
      <h3>{title}</h3>
      <ol className="workspace-insights__stages">
        {stages.map((stage) => (
          <li key={stage.label}>
            <span>{stage.label}</span>
            <strong>{stage.value}</strong>
          </li>
        ))}
      </ol>
      <details className="workspace-insights__rates">
        <summary>Show conversion context</summary>
        <dl>
          {rates.map((rate) => (
            <div key={rate.label}>
              <dt>{rate.label}</dt>
              <dd>{rateLabel(rate.value)}</dd>
            </div>
          ))}
        </dl>
        <p>Rates are owner-provided observations. They do not score quality or performance.</p>
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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(undefined);
    setError(undefined);
    client
      .load(controller.signal)
      .then((value) => setSnapshot(value))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(
          cause instanceof WorkspaceInsightsHttpError
            ? cause
            : new WorkspaceInsightsHttpError(
                503,
                'WORKSPACE_INSIGHTS_UNAVAILABLE',
                'Workspace Insights are unavailable.',
                true
              )
        );
      });
    return () => controller.abort();
  }, [client, reloadKey]);

  if (!snapshot && !error)
    return (
      <section aria-labelledby="workspace-insights-heading" className="workspace-insights">
        <LoadingState label="Loading Workspace Insights" />
      </section>
    );

  if (!snapshot && error) {
    const permission = error.status === 401 || error.status === 403;
    return (
      <section aria-labelledby="workspace-insights-heading" className="workspace-insights">
        <div className="daily-section-heading">
          <div>
            <p className="daily-kicker">REFLECT</p>
            <h2 id="workspace-insights-heading">Workspace Insights</h2>
            <p>Understand current workflow signals without turning activity into a score.</p>
          </div>
        </div>
        <Alert
          tone="warning"
          title={permission ? 'Insights access denied' : 'Insights unavailable'}
        >
          <p>{error.message}</p>
          <p>Metrics are hidden rather than rendered as zero while owner truth is unavailable.</p>
          {!permission ? (
            <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
              Retry insights
            </Button>
          ) : null}
        </Alert>
      </section>
    );
  }

  const content = snapshot!.content;
  const opportunity = snapshot!.opportunity;
  const contentStages: Stage[] = [
    { label: 'Content Opportunities', value: content.contentOpportunities },
    { label: 'Drafts prepared', value: content.draftPrepared },
    { label: 'Human Reviews recorded', value: content.humanReviewRecorded },
    { label: 'Publish Packages prepared', value: content.publishPackagesPrepared },
    { label: 'User-reported outcomes', value: content.userReportedUseFeedback }
  ];
  const contentRates: Rate[] = [
    { label: 'Opportunity → Draft', value: content.rates.opportunityToDraft },
    { label: 'Draft → Human Review', value: content.rates.draftToHumanReview },
    { label: 'Human Review → Publish Package', value: content.rates.humanReviewToPublishPackage },
    {
      label: 'Publish Package → Outcome feedback',
      value: content.rates.publishPackageToUseFeedback
    }
  ];
  const opportunityStages: Stage[] = [
    { label: 'Opportunity Candidates', value: opportunity.opportunityCandidates },
    { label: 'Qualification Decisions', value: opportunity.qualificationDecisions },
    { label: 'Qualified for MarkReg', value: opportunity.qualifiedForMarkReg },
    {
      label: 'Formal Opportunity handoff results',
      value: opportunity.formalOpportunityHandoffResults
    }
  ];
  const opportunityRates: Rate[] = [
    { label: 'Candidate → Qualification', value: opportunity.rates.candidateToQualification },
    { label: 'Qualification → Qualified', value: opportunity.rates.qualificationToQualified },
    {
      label: 'Qualified → Formal Opportunity handoff',
      value: opportunity.rates.qualifiedToFormalOpportunityHandoff
    }
  ];

  return (
    <section aria-labelledby="workspace-insights-heading" className="workspace-insights">
      <div className="daily-section-heading">
        <div>
          <p className="daily-kicker">REFLECT</p>
          <h2 id="workspace-insights-heading">Workspace Insights</h2>
          <p>
            What moved forward, where work is waiting, and what Lite is explicitly learning from.
          </p>
        </div>
        <Badge>Owner-backed · all time</Badge>
      </div>
      <div className="workspace-insights__lead-grid">
        <Card>
          <p className="daily-kicker">WORKFLOW OBSERVATION</p>
          <h3>{feedbackObservation(snapshot!)}</h3>
          <p>
            This is a bounded observation from exact owner counts, not a quality, productivity,
            competence or legal-risk judgment.
          </p>
        </Card>
        <Card>
          <p className="daily-kicker">LEARNING TRANSPARENCY</p>
          <h3>{preferenceMessage(preferenceSource)}</h3>
          <p>
            Preference evidence affects ranking only; it does not create professional authority.
          </p>
        </Card>
      </div>

      <div className="workspace-insights__funnels">
        <FunnelCard title="Content progress" stages={contentStages} rates={contentRates} />
        <FunnelCard
          title="Opportunity progress"
          stages={opportunityStages}
          rates={opportunityRates}
        />
      </div>

      <Alert tone="info" title="External outcomes remain user-reported">
        Published, Used and Not used are feedback supplied by the user. MarkOrbit did not execute or
        independently verify the external action, and no feedback does not mean Not used.
      </Alert>

      <details className="workspace-insights__evidence">
        <summary>Owner source and authority details</summary>
        <dl>
          <div>
            <dt>Snapshot</dt>
            <dd>{snapshot!.generatedAt} · LITE · WORKSPACE_ALL_TIME</dd>
          </div>
          <div>
            <dt>Business-state mutation</dt>
            <dd>No · observational only</dd>
          </div>
          <div>
            <dt>External use independently verified</dt>
            <dd>No</dd>
          </div>
          <div>
            <dt>Cross-owner evidence</dt>
            <dd>Lite handoff result only · no direct MarkReg query performed</dd>
          </div>
        </dl>
        <p>Durable source families:</p>
        <ul>
          {snapshot!.sourceFamilies.map((source) => (
            <li key={source.kind}>
              {source.kind} · {source.owner} · {source.provenance}
              {source.downstreamOwner ? ` · downstream ${source.downstreamOwner}` : ''}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
