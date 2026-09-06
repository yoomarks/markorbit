import type { FormalMatter } from '@markorbit/contracts';
import { Alert, Button, Card, KeyValueList, PageHeader } from '@markorbit/ui';
import type { ReactNode } from 'react';
import { ExaminationPanel } from './ExaminationPanel.js';
import { FormalMatterEvidencePanel } from './FormalMatterEvidencePanel.js';
import { LifecyclePanel } from './LifecyclePanel.js';
import { MatterIntelligencePanel } from './MatterIntelligencePanel.js';
import { TruthContext } from './TruthContext.js';
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
    { key: 'Governed status', value: matter.status },
    { key: 'Updated', value: displayTimestamp(matter.updatedAt) }
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

  return (
    <main className="markreg-workspace-home" aria-label="Formal Matter workspace">
      <PageHeader
        title="Trademark Matter"
        description="Current work state first, supporting context second, exact provenance on demand."
      />

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
      <Alert tone="info" title="Matter authority boundary">
        Matter ≠ Filing. MarkReg workflow, reviewed evidence, recommendations and analysis remain
        separate from trademark-office status, official deadlines and protected external actions.
      </Alert>

      <section className="markreg-cockpit-section markreg-matter-priority" aria-labelledby="matter-current-heading">
        <h2 id="matter-current-heading">Overview</h2>
        <div className="markreg-truth-row">
          <TruthContext
            truthClass="GOVERNED_INTERNAL_WORKFLOW"
            detail="Current MarkReg Matter state"
          />
        </div>
        <Card>
          <KeyValueList items={identityItems} />
        </Card>
      </section>

      <section className="markreg-cockpit-section markreg-matter-priority" aria-labelledby="matter-lifecycle-heading">
        <h2 id="matter-lifecycle-heading">Needs attention</h2>
        {renderLifecycle({
          formalMatterId: String(matter.formalMatterId),
          disabled: lifecycleDisabled
        })}
      </section>

      <section className="markreg-cockpit-section markreg-matter-priority" aria-labelledby="matter-examination-heading">
        <h2 id="matter-examination-heading">Examination</h2>
        {renderExamination({ formalMatterId: String(matter.formalMatterId) })}
      </section>

      <section className="markreg-cockpit-section" aria-labelledby="matter-scope-heading">
        <h2 id="matter-scope-heading">Application details</h2>
        <div className="markreg-truth-row">
          <TruthContext
            truthClass="CUSTOMER_SUPPLIED"
            detail="Captured in the Matter source snapshot"
          />
        </div>
        <Card>
          {scopeItems.length > 0 ? (
            <KeyValueList items={scopeItems} />
          ) : (
            <p>No additional preparation summary is present in this Matter snapshot.</p>
          )}
        </Card>
      </section>

      <section className="markreg-cockpit-section" aria-labelledby="matter-evidence-heading">
        <h2 id="matter-evidence-heading">Documents &amp; evidence</h2>
        {renderEvidence({ formalMatterId: String(matter.formalMatterId) })}
      </section>

      <section className="markreg-cockpit-section" aria-labelledby="matter-intelligence-heading">
        <h2 id="matter-intelligence-heading">Intelligence</h2>
        {renderIntelligence({ formalMatterId: String(matter.formalMatterId) })}
      </section>

      <section
        className="markreg-cockpit-section markreg-matter-secondary"
        aria-labelledby="matter-record-heading"
      >
        <h2 id="matter-record-heading">Record</h2>
        <details className="markreg-matter-record-details markreg-cockpit-provenance">
          <summary>Exact record and source lineage</summary>
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

      <p>
        <Button variant="secondary" onClick={() => location.reload()}>
          Reload exact Matter
        </Button>{' '}
        <a href="/">Back to MarkReg workspace</a>
      </p>
    </main>
  );
}
