import type { FormalMatter } from '@markorbit/contracts';
import { Alert, Button, Card, KeyValueList, PageHeader } from '@markorbit/ui';
import type { ReactNode } from 'react';
import { LifecyclePanel } from './LifecyclePanel.js';
import { serializeMarkregRoute } from './routing/markreg-route.js';

export type FormalMatterLifecycleRenderer = (input: {
  formalMatterId: string;
  disabled: boolean;
}) => ReactNode;

const defaultLifecycle: FormalMatterLifecycleRenderer = ({ formalMatterId, disabled }) => (
  <LifecyclePanel formalMatterId={formalMatterId} disabled={disabled} />
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
  renderLifecycle = defaultLifecycle
}: {
  matter: FormalMatter;
  expectedVersion: string;
  actualVersion: string;
  versionMismatch?: boolean;
  readOnly?: boolean;
  renderLifecycle?: FormalMatterLifecycleRenderer;
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
  const summaryItems = [
    ...(trademark ? [{ key: 'Trademark', value: trademark }] : []),
    ...(applicant ? [{ key: 'Applicant', value: applicant }] : []),
    ...(applicantAddress ? [{ key: 'Applicant address', value: applicantAddress }] : []),
    ...(jurisdiction ? [{ key: 'Jurisdiction', value: jurisdiction }] : []),
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
        description="Review the durable Matter record, its exact source lineage, and governed lifecycle without treating internal product state as an external filing or office status."
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
      <Alert tone="warning" title="Authority boundary">
        Matter ≠ Filing. Lifecycle Projection ≠ Official Status. Viewing or acknowledging this
        workspace does not create a payment, invoice, professional appointment, external submission,
        or official application.
      </Alert>

      <section className="markreg-workspace-list" aria-labelledby="matter-overview-heading">
        <h2 id="matter-overview-heading">Matter overview</h2>
        <Card>
          <KeyValueList
            items={[
              { key: 'Formal Matter ID', value: matter.formalMatterId },
              { key: 'Kind', value: matter.kind },
              { key: 'Governed status', value: matter.status },
              { key: 'Current version', value: matter.version },
              { key: 'Updated', value: displayTimestamp(matter.updatedAt) }
            ]}
          />
        </Card>
        <Card>
          <h3>Captured preparation</h3>
          {summaryItems.length > 0 ? (
            <KeyValueList items={summaryItems} />
          ) : (
            <p>No additional preparation summary is present in this Matter snapshot.</p>
          )}
          <p>
            These values are the captured source snapshot for this Matter. They are not
            independently revalidated office or legal truth by this view.
          </p>
        </Card>
      </section>

      <section className="markreg-workspace-list" aria-labelledby="matter-lineage-heading">
        <h2 id="matter-lineage-heading">Source lineage</h2>
        <Card>
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
            manufacture a direct-link identity that is not present in the Formal Matter snapshot.
          </p>
        </Card>
        <Card>
          <details>
            <summary>Snapshot and provenance details</summary>
            <KeyValueList
              items={[
                { key: 'Snapshot schema', value: matter.snapshotSchemaVersion },
                { key: 'Snapshot SHA-256', value: matter.snapshotSha256 },
                { key: 'Created by', value: matter.createdByUserId },
                { key: 'Created', value: displayTimestamp(matter.createdAt) },
                { key: 'Updated', value: displayTimestamp(matter.updatedAt) }
              ]}
            />
            <p>
              The fingerprint identifies the captured MarkReg source snapshot. It is provenance, not
              proof that an external filing or trademark-office event occurred.
            </p>
          </details>
        </Card>
      </section>

      <section aria-labelledby="matter-lifecycle-heading">
        <h2 id="matter-lifecycle-heading">Governed lifecycle</h2>
        {renderLifecycle({
          formalMatterId: String(matter.formalMatterId),
          disabled: lifecycleDisabled
        })}
      </section>

      <section aria-labelledby="matter-intelligence-heading">
        <h2 id="matter-intelligence-heading">Matter intelligence</h2>
        <Card>
          <p>
            Governed analytical evidence is not exposed through this browser view yet. That does not
            mean no intelligence exists. It will only appear here after the authenticated Gateway
            read boundary is available; this workspace does not call MarkReg internal services
            directly or fall back to fixtures.
          </p>
        </Card>
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
