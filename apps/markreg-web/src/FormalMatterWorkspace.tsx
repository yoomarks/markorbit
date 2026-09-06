import type { FormalMatter } from '@markorbit/contracts';
import { Alert, Button, Card, KeyValueList, PageHeader } from '@markorbit/ui';
import { Fragment, type ReactNode } from 'react';
import { ExaminationPanel } from './ExaminationPanel.js';
import { FormalMatterEvidencePanel } from './FormalMatterEvidencePanel.js';
import { LifecyclePanel } from './LifecyclePanel.js';
import { MatterIntelligencePanel } from './MatterIntelligencePanel.js';
import { TruthBadge, TruthContext } from './TruthContext.js';
import { serializeMarkregRoute } from './routing/markreg-route.js';

export type FormalMatterLifecycleRenderer = (input: {
  formalMatterId: string;
  disabled: boolean;
}) => ReactNode;

export type FormalMatterExaminationRenderer = (input: { formalMatterId: string }) => ReactNode;
export type FormalMatterEvidenceRenderer = (input: { formalMatterId: string }) => ReactNode;
export type FormalMatterIntelligenceRenderer = (input: { formalMatterId: string }) => ReactNode;

const defaultLifecycle: FormalMatterLifecycleRenderer = ({ formalMatterId, disabled }) => (
  <LifecyclePanel formalMatterId={formalMatterId} disabled={disabled} embedded />
);
const defaultExamination: FormalMatterExaminationRenderer = ({ formalMatterId }) => (
  <ExaminationPanel formalMatterId={formalMatterId} />
);
const defaultEvidence: FormalMatterEvidenceRenderer = ({ formalMatterId }) => (
  <FormalMatterEvidencePanel formalMatterId={formalMatterId} />
);
const defaultIntelligence: FormalMatterIntelligenceRenderer = ({ formalMatterId }) => (
  <MatterIntelligencePanel formalMatterId={formalMatterId} />
);

const text = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const displayTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

function SectionHeading({
  id,
  title,
  description
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <header className="markreg-cockpit-section-header">
      <h2 id={id}>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

export function FormalMatterWorkspace({
  matter,
  expectedVersion,
  actualVersion,
  versionMismatch = false,
  readOnly = false,
  renderLifecycle = defaultLifecycle,
  renderExamination = defaultExamination,
  renderEvidence = defaultEvidence,
  renderIntelligence = defaultIntelligence
}: {
  matter: FormalMatter;
  expectedVersion: string;
  actualVersion: string;
  versionMismatch?: boolean;
  readOnly?: boolean;
  renderLifecycle?: FormalMatterLifecycleRenderer;
  renderExamination?: FormalMatterExaminationRenderer;
  renderEvidence?: FormalMatterEvidenceRenderer;
  renderIntelligence?: FormalMatterIntelligenceRenderer;
}) {
  const preparation = matter.sourceSnapshot.preparation;
  const trademark = text(preparation.trademark);
  const applicant = text(preparation.applicantName);
  const applicantAddress = text(preparation.applicantAddress);
  const jurisdiction = text(preparation.targetJurisdiction);
  const goodsServices = text(preparation.goodsServices);
  const filingBasis = text(preparation.filingBasis);
  const classes = preparation.classes.length > 0 ? preparation.classes.join(', ') : undefined;
  const lifecycleDisabled = versionMismatch || readOnly;
  const confirmationRoute = serializeMarkregRoute({
    view: 'customer-confirmation',
    recordId: String(matter.sourceCustomerConfirmationId),
    expectedVersion: String(matter.sourceCustomerConfirmationVersion)
  });
  const quoteRoute = serializeMarkregRoute({
    view: 'quote',
    recordId: String(matter.sourceQuoteId),
    expectedVersion: String(matter.sourceQuoteVersion)
  });

  const identityItems = [
    ...(trademark ? [{ key: 'Trademark', value: trademark }] : []),
    ...(jurisdiction ? [{ key: 'Jurisdiction', value: jurisdiction }] : []),
    ...(applicant ? [{ key: 'Applicant', value: applicant }] : []),
    { key: 'Governed state', value: matter.status },
    { key: 'Last changed', value: displayTimestamp(matter.updatedAt) }
  ];
  const scopeItems = [
    ...(applicantAddress ? [{ key: 'Applicant address', value: applicantAddress }] : []),
    ...(classes ? [{ key: 'Classes', value: classes }] : []),
    ...(goodsServices ? [{ key: 'Goods / services', value: goodsServices }] : []),
    ...(filingBasis ? [{ key: 'Filing basis', value: filingBasis }] : []),
    ...(typeof preparation.representativeRequired === 'boolean'
      ? [
          {
            key: 'Representative required',
            value: preparation.representativeRequired ? 'Yes' : 'No'
          }
        ]
      : [])
  ];
  const headerDescription = [
    'Matter Cockpit',
    jurisdiction,
    applicant,
    `Governed state: ${matter.status}`
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <main
      className="markreg-workspace-home markreg-matter-cockpit"
      aria-label="Formal Matter workspace"
    >
      <PageHeader title={trademark ?? 'Trademark Matter'} description={headerDescription} />

      {versionMismatch && (
        <Alert tone="warning" title="Version mismatch">
          This link expected version {expectedVersion}; the current durable Matter is version{' '}
          {actualVersion}. Review is read only until you deliberately reload or navigate from
          current Workspace truth.
        </Alert>
      )}
      {readOnly && (
        <Alert tone="warning" title={`${matter.status} — read only`}>
          This Matter state cannot progress from this view.
        </Alert>
      )}

      <section className="markreg-matter-authority" aria-label="Matter authority boundary">
        <TruthContext
          kind="GOVERNED_INTERNAL"
          details={
            <p>
              Matter ≠ Filing. Lifecycle Projection ≠ Official Status. Examination Stage ≠ Official
              Status. Recommended Action ≠ authorization. Reviewed Evidence ≠ Official Truth. Matter
              Intelligence ≠ legal or professional conclusion. This view creates no payment,
              provider contact, office mutation, external filing, or Official Truth.
            </p>
          }
        >
          This cockpit presents current MarkReg work without converting product state into
          trademark-office truth.
        </TruthContext>
      </section>

      <section className="markreg-cockpit-section" aria-labelledby="matter-overview-heading">
        <SectionHeading
          id="matter-overview-heading"
          title="Overview"
          description="Matter identity and current governed work first; source preparation stays visibly customer supplied."
        />
        <div className="markreg-cockpit-overview-grid">
          <Card>
            <div className="markreg-cockpit-card-heading">
              <h3>Current matter</h3>
              <TruthBadge kind="GOVERNED_INTERNAL" />
            </div>
            <KeyValueList items={identityItems} />
          </Card>
          <Card>
            <div className="markreg-cockpit-card-heading">
              <h3>Application scope</h3>
              <TruthBadge kind="CUSTOMER_SUPPLIED" />
            </div>
            {scopeItems.length > 0 ? (
              <KeyValueList items={scopeItems} />
            ) : (
              <p>No additional preparation summary is present in this Matter snapshot.</p>
            )}
            <details className="markreg-cockpit-inline-details">
              <summary>Source context</summary>
              <p>
                These values are the captured customer-supplied source snapshot for this Matter.
                This Web view does not independently revalidate them as legal or official truth.
              </p>
            </details>
          </Card>
        </div>
      </section>

      <section className="markreg-cockpit-section" aria-labelledby="matter-lifecycle-heading">
        <SectionHeading
          id="matter-lifecycle-heading"
          title="Needs attention"
          description="Current owner-governed recommendation and lifecycle context. No browser urgency or deadline is inferred."
        />
        <Fragment key={`lifecycle-${matter.formalMatterId}`}>
          {renderLifecycle({
            formalMatterId: String(matter.formalMatterId),
            disabled: lifecycleDisabled
          })}
        </Fragment>
      </section>

      <section className="markreg-cockpit-section" aria-labelledby="matter-examination-heading">
        <SectionHeading
          id="matter-examination-heading"
          title="Examination"
          description="Internal Examination workflow from owner truth, with unavailable and historical context kept explicit."
        />
        <Fragment key={`examination-${matter.formalMatterId}`}>
          {renderExamination({ formalMatterId: String(matter.formalMatterId) })}
        </Fragment>
      </section>

      <section className="markreg-cockpit-section" aria-labelledby="matter-evidence-heading">
        <SectionHeading
          id="matter-evidence-heading"
          title="Documents & Evidence"
          description="Human-readable evidence first; source fingerprints and bounded authority detail remain inspectable."
        />
        <Fragment key={`evidence-${matter.formalMatterId}`}>
          {renderEvidence({ formalMatterId: String(matter.formalMatterId) })}
        </Fragment>
      </section>

      <section className="markreg-cockpit-section" aria-labelledby="matter-intelligence-heading">
        <SectionHeading
          id="matter-intelligence-heading"
          title="Intelligence"
          description="Secondary descriptive analysis and Human Review, never a prediction, legal conclusion, or Official Status."
        />
        <Fragment key={`intelligence-${matter.formalMatterId}`}>
          {renderIntelligence({ formalMatterId: String(matter.formalMatterId) })}
        </Fragment>
      </section>

      <section
        className="markreg-cockpit-section markreg-matter-secondary"
        aria-labelledby="matter-record-heading"
      >
        <SectionHeading
          id="matter-record-heading"
          title="Record"
          description="Exact IDs, versions, fingerprints, timestamps, and source lineage for audit or recovery."
        />
        <details className="markreg-matter-record-details">
          <summary>Record details and source lineage</summary>
          <div className="markreg-workspace-list">
            <Card>
              <h3>Exact Matter record</h3>
              <KeyValueList
                items={[
                  { key: 'Formal Matter ID', value: matter.formalMatterId },
                  { key: 'Kind', value: matter.kind },
                  { key: 'Current version', value: matter.version },
                  { key: 'Snapshot schema', value: matter.snapshotSchemaVersion },
                  { key: 'Snapshot SHA-256', value: matter.snapshotSha256 },
                  { key: 'Created by', value: matter.createdByUserId },
                  { key: 'Created', value: displayTimestamp(matter.createdAt) },
                  { key: 'Updated', value: displayTimestamp(matter.updatedAt) }
                ]}
              />
              <p>
                The fingerprint identifies the captured MarkReg source snapshot. It is provenance,
                not proof that an external filing or trademark-office event occurred.
              </p>
            </Card>
            <Card>
              <h3>Source lineage</h3>
              <KeyValueList
                items={[
                  {
                    key: 'Customer Confirmation',
                    value: `${matter.sourceCustomerConfirmationId} · version ${matter.sourceCustomerConfirmationVersion}`
                  },
                  {
                    key: 'Matter Draft',
                    value: `${matter.sourceMatterDraftId} · version ${matter.sourceMatterDraftVersion}`
                  },
                  {
                    key: 'Quote',
                    value: `${matter.sourceQuoteId} · version ${matter.sourceQuoteVersion}`
                  }
                ]}
              />
              <div className="markreg-workspace-order-actions">
                <a href={confirmationRoute}>Open Customer Confirmation</a>
                <a href={quoteRoute}>Open source Quote</a>
              </div>
              <p>
                The Matter Draft identity/version remains pinned here. This workspace does not
                manufacture a direct-link identity that is not present in the Formal Matter
                snapshot.
              </p>
            </Card>
          </div>
        </details>
      </section>

      <p className="markreg-cockpit-footer-actions">
        <Button variant="secondary" onClick={() => location.reload()}>
          Reload exact Matter
        </Button>{' '}
        <a href="/">Back to MarkReg workspace</a>
      </p>
    </main>
  );
}
