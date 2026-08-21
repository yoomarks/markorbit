import { useState } from 'react';
import type {
  TrademarkServiceIntentKind,
  TrademarkServiceWorkPackage
} from '@markorbit/contracts/trademark-service-workbench';
import { Button, Select } from '@markorbit/ui';

const intentOptions: readonly { value: TrademarkServiceIntentKind; label: string }[] = [
  { value: 'NEW_APPLICATION', label: 'New application' },
  { value: 'RENEWAL', label: 'Renewal' },
  { value: 'USE_DECLARATION', label: 'Use declaration' },
  { value: 'OFFICE_ACTION_RESPONSE', label: 'Office action response' },
  { value: 'OPPOSITION_RESPONSE', label: 'Opposition response' },
  { value: 'CANCELLATION_OR_INVALIDATION', label: 'Cancellation / invalidation' },
  { value: 'ASSIGNMENT_OR_TRANSFER_RECORDAL', label: 'Assignment / transfer recordal' },
  { value: 'OWNER_NAME_OR_ADDRESS_CHANGE', label: 'Owner name / address change' },
  { value: 'CERTIFICATE_REISSUE', label: 'Certificate reissue' },
  { value: 'RESTORATION_OR_REVIVAL', label: 'Restoration / revival' },
  { value: 'SEARCH_OR_CLEARANCE', label: 'Search / clearance' },
  { value: 'WATCH_OR_MONITORING', label: 'Watch / monitoring' },
  { value: 'EVIDENCE_PREPARATION', label: 'Evidence preparation' },
  { value: 'OTHER_REVIEW_REQUIRED', label: 'Other — professional review required' }
];

export interface TrademarkServiceWorkbenchProps {
  jurisdiction: string;
  assetVersion: number | string;
  latest?: Readonly<TrademarkServiceWorkPackage>;
  recommendationReference?: string;
  onPrepare: (
    input: Readonly<{
      assetVersion: number | string;
      managementRecommendationReference?: string;
      intent: {
        kind: TrademarkServiceIntentKind;
        jurisdiction: string;
        title: string;
        rationale: string;
        inferredFromProductContext: false;
        reviewedByUser: true;
        legalConclusionCreated: false;
        serviceAvailabilityVerified: false;
        legalDeadlineCertified: false;
      };
    }>
  ) => Promise<void>;
}

export function TrademarkServiceWorkbench({
  jurisdiction,
  assetVersion,
  latest,
  recommendationReference,
  onPrepare
}: TrademarkServiceWorkbenchProps) {
  const [intentKind, setIntentKind] = useState<TrademarkServiceIntentKind>('OTHER_REVIEW_REQUIRED');
  const [preparing, setPreparing] = useState(false);
  const [status, setStatus] = useState<string>();
  const selected = intentOptions.find((option) => option.value === intentKind)!;

  const prepare = async () => {
    setPreparing(true);
    setStatus(undefined);
    try {
      await onPrepare({
        assetVersion,
        ...(recommendationReference
          ? { managementRecommendationReference: recommendationReference }
          : {}),
        intent: {
          kind: intentKind,
          jurisdiction,
          title: selected.label,
          rationale:
            'Prepared by the user from the Trademark Asset professional service workbench.',
          inferredFromProductContext: false,
          reviewedByUser: true,
          legalConclusionCreated: false,
          serviceAvailabilityVerified: false,
          legalDeadlineCertified: false
        }
      });
      setStatus(
        'Service Work Package prepared. No filing, provider contact, payment or publication occurred.'
      );
    } catch {
      setStatus('Service Work Package could not be prepared. No protected action occurred.');
    } finally {
      setPreparing(false);
    }
  };

  return (
    <section className="trademark-service-workbench" aria-labelledby="service-workbench-heading">
      <div className="trademark-asset-workspace__section-heading">
        <div>
          <p>Professional service preparation</p>
          <h2 id="service-workbench-heading">Service Workbench</h2>
        </div>
        <span>Preparation completeness ≠ legal conclusion ≠ execution authorization</span>
      </div>

      {latest ? (
        <div className="trademark-service-workbench__summary">
          <div>
            <span>Service intent</span>
            <strong>{latest.intent.title}</strong>
          </div>
          <div>
            <span>Readiness</span>
            <strong>{latest.readiness.state}</strong>
          </div>
          <div>
            <span>Missing inputs</span>
            <strong>{latest.missingInputs.length}</strong>
          </div>
          <div>
            <span>Requirement candidates</span>
            <strong>{latest.requirementCandidates.length}</strong>
          </div>
        </div>
      ) : (
        <p>No Service Work Package has been prepared for this asset yet.</p>
      )}

      {latest ? (
        <div className="trademark-service-workbench__detail-grid">
          <article>
            <h3>Preparation gaps</h3>
            {latest.missingInputs.length ? (
              <ul>
                {latest.missingInputs.map((item, index) => (
                  <li key={`${item.reason}-${index}`}>
                    <strong>{item.title}</strong> — {item.explanation}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No current missing-input item in this package.</p>
            )}
          </article>
          <article>
            <h3>Owner-backed candidates</h3>
            <p>
              {latest.capabilityCandidates.length} capability · {latest.providerCandidates.length}{' '}
              provider · {latest.servicePackageCandidates.length} service package candidate(s)
            </p>
            <small>
              Candidate does not mean verified capability, provider engagement or selection.
            </small>
          </article>
          <article>
            <h3>Commercial & communication preparation</h3>
            <p>
              {latest.quoteCandidate
                ? 'Non-binding quote candidate prepared'
                : 'No quote candidate prepared'}
            </p>
            <p>{latest.communicationDrafts.length} unsent communication draft(s)</p>
            <small>
              Nothing here sends a message, binds a quote, authorizes payment or contacts a
              provider.
            </small>
          </article>
        </div>
      ) : null}

      <div className="trademark-service-workbench__prepare">
        <Select
          label="Service intent"
          value={intentKind}
          onChange={(event) => setIntentKind(event.target.value as TrademarkServiceIntentKind)}
        >
          {intentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button disabled={preparing} onClick={() => void prepare()}>
          {preparing
            ? 'Preparing…'
            : latest
              ? 'Prepare another package'
              : 'Prepare service package'}
        </Button>
      </div>
      <p className="trademark-service-workbench__boundary">
        This creates only a workspace preparation record. Legal requirements, official deadlines,
        capability, provider engagement, quote acceptance, payment and filing remain owner-governed
        or protected actions.
      </p>
      {status ? <p role="status">{status}</p> : null}
    </section>
  );
}
