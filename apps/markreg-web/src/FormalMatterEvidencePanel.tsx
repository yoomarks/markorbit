import { Alert, Button, Card, KeyValueList, LoadingState } from '@markorbit/ui';
import { useCallback, useEffect, useState } from 'react';
import { TruthContext } from './TruthContext.js';
import {
  createFormalMatterEvidenceClient,
  type FormalMatterEvidenceClient,
  type FormalMatterEvidenceDocumentPackage,
  type FormalMatterEvidenceLifecycleEvent,
  type FormalMatterEvidenceProjection
} from './api/formal-matter-evidence.js';

const defaultClient = createFormalMatterEvidenceClient();

type State =
  | { kind: 'LOADING' }
  | { kind: 'READY'; value: FormalMatterEvidenceProjection }
  | { kind: 'ERROR' };

const displayTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

function PackageCard({ value }: { value: FormalMatterEvidenceDocumentPackage }) {
  return (
    <Card>
      <h3>Document package</h3>
      <div className="markreg-truth-row">
        <TruthContext
          truthClass={value.matterSourceCurrent ? 'REVIEWED_EVIDENCE' : 'HISTORICAL'}
          detail={value.matterSourceCurrent ? 'Current Matter source' : 'Older Matter source'}
        />
      </div>
      {!value.matterSourceCurrent && (
        <Alert tone="warning" title="Historical Matter source">
          This package is pinned to an older Formal Matter version or snapshot. It remains durable
          historical evidence and is not rebound to current Matter truth.
        </Alert>
      )}
      <KeyValueList
        items={[
          { key: 'Status', value: value.status },
          {
            key: 'Matter source',
            value: value.matterSourceCurrent ? 'Current' : 'Historical'
          },
          { key: 'Reviewed documents', value: value.documentEvidenceTotal },
          { key: 'Updated', value: displayTimestamp(value.updatedAt) }
        ]}
      />
      <details className="markreg-cockpit-secondary-details">
        <summary>Documents and exact provenance</summary>
        <KeyValueList
          items={[
            { key: 'Document Package ID', value: value.documentPackageId },
            { key: 'Package version', value: value.version },
            { key: 'Matter source version', value: value.sourceFormalMatterVersion },
            { key: 'Matter snapshot SHA-256', value: value.sourceFormalMatterSha256 },
            { key: 'Professional Review case', value: value.professionalReviewCaseId },
            { key: 'Review source version', value: value.sourceReviewVersion },
            { key: 'Completed decision', value: value.sourceCompletedDecisionId },
            { key: 'Completed decision SHA-256', value: value.sourceCompletedDecisionSha256 },
            ...(value.canonicalEvidenceSha256
              ? [{ key: 'Ready evidence SHA-256', value: value.canonicalEvidenceSha256 }]
              : [])
          ]}
        />
        {value.documentEvidence.length === 0 ? (
          <p>No document evidence items are present in this package.</p>
        ) : (
          <ul>
            {value.documentEvidence.map((item) => (
              <li key={item.documentItemId}>
                <strong>{item.displayName}</strong> · {item.documentType} ·{' '}
                {item.verificationStatus}
                <br />
                Evidence SHA-256: {item.evidenceSha256}
              </li>
            ))}
          </ul>
        )}
        {value.documentEvidenceTruncated && (
          <p>
            Showing {value.documentEvidence.length} of {value.documentEvidenceTotal} evidence items
            within the bounded owner projection.
          </p>
        )}
      </details>
    </Card>
  );
}

function LifecycleEvent({ value }: { value: FormalMatterEvidenceLifecycleEvent }) {
  return (
    <li>
      <strong>{value.customerSafeLabel}</strong> · {value.eventCode} ·{' '}
      {value.matterSourceCurrent ? 'current Matter source' : 'historical Matter source'}
      <br />
      {value.customerSafeSummary}
      <br />
      Projected {displayTimestamp(value.projectedAt)}
    </li>
  );
}

export function FormalMatterEvidencePanel({
  formalMatterId,
  client = defaultClient
}: {
  formalMatterId: string;
  client?: FormalMatterEvidenceClient;
}) {
  const [state, setState] = useState<State>({ kind: 'LOADING' });
  const load = useCallback(async () => {
    setState({ kind: 'LOADING' });
    try {
      setState({ kind: 'READY', value: await client.get(formalMatterId) });
    } catch {
      setState({ kind: 'ERROR' });
    }
  }, [client, formalMatterId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'LOADING') return <LoadingState label="Loading Formal Matter evidence" />;
  if (state.kind === 'ERROR')
    return (
      <Alert tone="warning" title="Formal Matter evidence unavailable">
        The governed Evidence Projection could not be loaded. Existing Matter, lifecycle, review,
        and evidence truth are unchanged. <Button onClick={() => void load()}>Retry</Button>
      </Alert>
    );

  const { value } = state;
  const lifecycle = value.lifecycle.current;
  const staleIntelligence = value.intelligence.items.filter(
    (item) => !item.matterSourceCurrent
  ).length;

  return (
    <>
      <div className="markreg-truth-row">
        <TruthContext truthClass="REVIEWED_EVIDENCE" detail="Read-only supporting context" />
      </div>
      <p>Evidence Projection ≠ Official Truth. Exact lineage remains available below on demand.</p>

      <details className="markreg-cockpit-secondary-details">
        <summary>Evidence source record</summary>
        <Card>
          <KeyValueList
            items={[
              { key: 'Formal Matter ID', value: value.formalMatter.formalMatterId },
              { key: 'Current version', value: value.formalMatter.version },
              { key: 'Current snapshot SHA-256', value: value.formalMatter.snapshotSha256 },
              { key: 'Governed status', value: value.formalMatter.status },
              { key: 'Updated', value: displayTimestamp(value.formalMatter.updatedAt) }
            ]}
          />
        </Card>
      </details>

      <h3>Document evidence</h3>
      {value.documentPackages.total === 0 ? (
        <Card>
          <p>
            No durable Document Packages are recorded for this Formal Matter. This is a successful
            empty evidence component, not a service failure.
          </p>
        </Card>
      ) : (
        <>
          {value.documentPackages.items.map((item) => (
            <PackageCard key={item.documentPackageId} value={item} />
          ))}
          {value.documentPackages.truncated && (
            <p>
              Showing {value.documentPackages.returned} of {value.documentPackages.total} Document
              Packages within the bounded owner projection.
            </p>
          )}
        </>
      )}

      <h3>Lifecycle evidence</h3>
      {!lifecycle && value.lifecycle.total === 0 ? (
        <Card>
          <p>
            No durable Lifecycle Projection is recorded for this Formal Matter. This is a successful
            empty lifecycle evidence component.
          </p>
        </Card>
      ) : (
        <Card>
          {lifecycle ? (
            <>
              <div className="markreg-truth-row">
                <TruthContext
                  truthClass={
                    lifecycle.matterSourceCurrent ? 'GOVERNED_INTERNAL_WORKFLOW' : 'HISTORICAL'
                  }
                  detail={
                    lifecycle.matterSourceCurrent
                      ? 'Current lifecycle evidence'
                      : 'Older Matter source'
                  }
                />
              </div>
              {!lifecycle.matterSourceCurrent && (
                <Alert tone="warning" title="Historical lifecycle source">
                  The current stored Lifecycle Projection is pinned to an older Matter version. It
                  is historical product evidence, not current Matter or official-office truth.
                </Alert>
              )}
              <KeyValueList
                items={[
                  { key: 'Lifecycle state', value: lifecycle.state },
                  { key: 'Customer-safe label', value: lifecycle.customerSafeLabel },
                  { key: 'Summary', value: lifecycle.customerSafeSummary },
                  {
                    key: 'Matter source',
                    value: lifecycle.matterSourceCurrent ? 'Current' : 'Historical'
                  },
                  { key: 'Updated', value: displayTimestamp(lifecycle.updatedAt) }
                ]}
              />
            </>
          ) : (
            <p>No current Lifecycle Projection is present.</p>
          )}
          {value.lifecycle.events.length > 0 && (
            <details className="markreg-cockpit-secondary-details">
              <summary>Bounded lifecycle timeline</summary>
              <div className="markreg-truth-row">
                <TruthContext truthClass="HISTORICAL" detail="Prior lifecycle events" />
              </div>
              <ol>
                {value.lifecycle.events.map((event) => (
                  <LifecycleEvent key={event.lifecycleEventId} value={event} />
                ))}
              </ol>
              {value.lifecycle.truncated && (
                <p>
                  Showing {value.lifecycle.events.length} of {value.lifecycle.total} lifecycle
                  events within the bounded owner projection.
                </p>
              )}
            </details>
          )}
        </Card>
      )}

      <h3>Matter Intelligence evidence context</h3>
      <Card>
        <KeyValueList
          items={[
            { key: 'Bounded observations returned', value: value.intelligence.items.length },
            { key: 'Total observations', value: value.intelligence.total },
            { key: 'Historical-source observations in this page', value: staleIntelligence }
          ]}
        />
        <p>
          Descriptive analytical context only; this projection creates no deadline or Official
          Status.
        </p>
      </Card>

      <details className="markreg-cockpit-secondary-details">
        <summary>Projection authority consequences</summary>
        <Card>
          <KeyValueList
            items={[
              {
                key: 'Formal Matter mutated',
                value: value.authorityConsequences.formalMatterMutated ? 'Yes' : 'No'
              },
              {
                key: 'Lifecycle mutated',
                value: value.authorityConsequences.lifecycleMutated ? 'Yes' : 'No'
              },
              {
                key: 'Evidence created or certified',
                value: value.authorityConsequences.evidenceCreatedOrCertified ? 'Yes' : 'No'
              },
              {
                key: 'Payment created',
                value: value.authorityConsequences.paymentCreated ? 'Yes' : 'No'
              },
              {
                key: 'Filing authorized',
                value: value.authorityConsequences.filingAuthorized ? 'Yes' : 'No'
              },
              {
                key: 'Filing submitted',
                value: value.authorityConsequences.filingSubmitted ? 'Yes' : 'No'
              },
              {
                key: 'Provider contacted',
                value: value.authorityConsequences.providerContacted ? 'Yes' : 'No'
              },
              {
                key: 'Official Truth created',
                value: value.authorityConsequences.officialTruthCreated ? 'Yes' : 'No'
              }
            ]}
          />
        </Card>
      </details>
    </>
  );
}
