import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import type { FixtureState } from '../shared/view-models.js';

const initialCases = [
  {
    id: 'professional-review_01001',
    customer: 'Northstar Coffee Ltd',
    trademark: 'NORTHSTAR FIELD NOTES',
    jurisdiction: 'EU',
    classes: '9, 16, 35',
    version: '2026-07-28T15:40:00.000Z',
    readyAt: '28 Jul 2026 · 15:40 UTC',
    status: 'QUEUED',
    priority: 'HIGH',
    reviewer: 'Unassigned',
    stale: false,
    goods:
      'Downloadable publications; printed field journals; online retail services relating to unusually detailed technical and educational material.'
  },
  {
    id: 'professional-review_01002',
    customer: 'Atlas Workshop Inc',
    trademark: 'ATLAS WORKSHOP',
    jurisdiction: 'US',
    classes: '35, 41',
    version: '2026-07-27T09:10:00.000Z',
    readyAt: '27 Jul 2026 · 09:10 UTC',
    status: 'STALE',
    priority: 'NORMAL',
    reviewer: 'reviewer_lee',
    stale: true,
    goods: 'Business consulting and professional workshops.'
  }
];
type ReviewCase = (typeof initialCases)[number];
export function ProfessionalReview({
  state,
  initialSelected
}: {
  state: FixtureState;
  initialSelected?: string;
}) {
  const cases = initialCases;
  const [selected, setSelected] = useState<string | undefined>(initialSelected);
  const [status, setStatus] = useState('ALL');
  const [jurisdiction, setJurisdiction] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [assignment, setAssignment] = useState('ALL');
  const [currency, setCurrency] = useState('ALL');
  const origin = useRef<string>();
  useEffect(() => {
    if (!selected && origin.current) {
      document.querySelector<HTMLButtonElement>(`[data-review-id="${origin.current}"]`)?.focus();
      origin.current = undefined;
    }
  }, [selected]);
  const rows = useMemo(
    () =>
      state === 'empty'
        ? []
        : cases.filter(
            (c) =>
              (status === 'ALL' || c.status === status) &&
              (jurisdiction === 'ALL' || c.jurisdiction === jurisdiction) &&
              (priority === 'ALL' || c.priority === priority) &&
              (assignment === 'ALL' ||
                (assignment === 'UNASSIGNED'
                  ? c.reviewer === 'Unassigned'
                  : c.reviewer !== 'Unassigned')) &&
              (currency === 'ALL' || (currency === 'STALE') === c.stale)
          ),
    [cases, status, jurisdiction, priority, assignment, currency, state]
  );
  const current = cases.find((c) => c.id === selected);
  if (state === 'loading') return <LoadingState label="Loading professional review queue" />;
  if (state === 'error')
    return (
      <>
        <PageHeader title="Professional Review" description="Work / Professional Review" />
        <Alert tone="danger" title="Review queue unavailable">
          The recoverable fixture error did not change any review case. Try again.
        </Alert>
      </>
    );
  if (current) return <ReviewDetail value={current} onBack={() => setSelected(undefined)} />;
  return (
    <section aria-labelledby="review-queue-heading">
      <PageHeader
        title="Professional Review"
        description="Work / Professional Review · governed internal review queue"
        actions={<Badge>{rows.length} cases</Badge>}
      />
      <Alert tone="warning" title="Authority boundary">
        Matter Draft readiness ≠ professional approval. Queue assignment ≠ professional appointment.
        No action here files, charges, appoints, creates a formal Matter, or contacts a customer.
      </Alert>
      {state === 'stale' && (
        <Alert tone="warning" title="Partial or stale queue data">
          Some source Matter Draft versions changed. Stale cases cannot be completed.
        </Alert>
      )}
      <div className="lite-filters" role="search" aria-label="Review queue filters">
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option>QUEUED</option>
          <option>IN_REVIEW</option>
          <option>NEEDS_INFORMATION</option>
          <option>STALE</option>
        </Select>
        <Select
          label="Jurisdiction"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
        >
          <option value="ALL">All jurisdictions</option>
          <option>EU</option>
          <option>US</option>
        </Select>
        <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="ALL">All priorities</option>
          <option>HIGH</option>
          <option>NORMAL</option>
        </Select>
        <Select
          label="Assignment"
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
        >
          <option value="ALL">Assigned and unassigned</option>
          <option value="UNASSIGNED">Unassigned</option>
          <option value="ASSIGNED">Assigned</option>
        </Select>
        <Select
          label="Source currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option value="ALL">Stale and current</option>
          <option value="CURRENT">Current</option>
          <option value="STALE">Stale</option>
        </Select>
      </div>
      {rows.length ? (
        <div className="lite-list" aria-live="polite">
          {rows.map((c) => (
            <Card key={c.id}>
              <div className="lite-row">
                <div>
                  <h2>{c.trademark}</h2>
                  <p>
                    {c.customer} · {c.jurisdiction} · Classes {c.classes}
                  </p>
                </div>
                <Badge>{c.stale ? 'STALE — completion blocked' : c.status}</Badge>
              </div>
              <KeyValueList
                items={[
                  { key: 'Review case ID', value: c.id },
                  { key: 'Source Matter Draft version', value: c.version },
                  { key: 'Readiness timestamp', value: c.readyAt },
                  { key: 'Priority / age', value: `${c.priority} · 1 day` },
                  { key: 'Assigned reviewer', value: c.reviewer }
                ]}
              />
              <Button
                data-review-id={c.id}
                onClick={() => {
                  origin.current = c.id;
                  setSelected(c.id);
                }}
              >
                Open professional review
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No professional review cases"
          description="No review case matches these filters."
        />
      )}
    </section>
  );
}
function ReviewDetail({ value, onBack }: { value: ReviewCase; onBack: () => void }) {
  const [claimed, setClaimed] = useState(value.reviewer !== 'Unassigned');
  const [checks, setChecks] = useState<Record<string, string>>({
    SOURCE_MATTER_DRAFT_CURRENT: 'PASS',
    CUSTOMER_CONFIRMATION_VALID: 'PASS',
    APPLICANT_INFORMATION_REVIEWED: 'UNKNOWN',
    AUTHORITY_BOUNDARIES_ACKNOWLEDGED: 'UNKNOWN'
  });
  const [request, setRequest] = useState(false);
  const [completed, setCompleted] = useState(value.status === 'REVIEWED_READY_FOR_NEXT_STEP');
  const blocking = Object.values(checks).some((x) => x === 'UNKNOWN' || x === 'FAIL');
  return (
    <section aria-labelledby="review-detail-heading">
      <Button variant="secondary" onClick={onBack}>
        ← Back to review queue
      </Button>
      <PageHeader
        title={value.trademark}
        description={`Professional Review Case ${value.id}`}
        actions={<Badge>{completed ? 'REVIEWED_READY_FOR_NEXT_STEP' : value.status}</Badge>}
      />
      <Alert tone="warning" title="Professional authority remains bounded">
        Review started ≠ instruction accepted. Review completed ≠ filing approved. Reviewed ready
        for next step ≠ executed action.
      </Alert>
      <div className="lite-detail-grid">
        <Card>
          <h2>Exact Matter Draft snapshot</h2>
          <KeyValueList
            items={[
              { key: 'Customer', value: value.customer },
              { key: 'Jurisdiction / classes', value: `${value.jurisdiction} / ${value.classes}` },
              { key: 'Matter Draft version', value: value.version },
              { key: 'Confirmation reference', value: 'confirmation_task009-001' },
              { key: 'Readiness', value: value.readyAt }
            ]}
          />
          <h3>Preparation data</h3>
          <p className="lite-long">{value.goods}</p>
        </Card>
        <Card>
          <h2>Readiness and evidence</h2>
          <p>
            All MarkReg readiness checks passed at snapshot time. Evidence: matter-draft snapshot
            and customer confirmation.
          </p>
          <p>
            <strong>Source immutability:</strong> this review references exactly one Matter Draft
            version.
          </p>
        </Card>
      </div>
      <Card>
        <h2>Professional-review checklist</h2>
        {Object.entries(checks).map(([code, result]) => (
          <div className="review-check" key={code}>
            <label htmlFor={code}>{code} (blocking)</label>
            <Select
              label="Review result"
              id={code}
              value={result}
              onChange={(e) => setChecks({ ...checks, [code]: e.target.value })}
            >
              <option>UNKNOWN</option>
              <option>PASS</option>
              <option>FAIL</option>
              <option>NOT_APPLICABLE</option>
            </Select>
            <TextInput
              label="Reviewer note"
              defaultValue="Evidence reviewed against immutable source."
            />
          </div>
        ))}
        <Button variant="secondary">Save checklist</Button>
        {blocking && (
          <p role="status">
            Blocking FAIL or UNKNOWN items prevent completion. UNKNOWN never counts as PASS.
          </p>
        )}
      </Card>
      {request && (
        <Alert title="Information request prepared — not sent">
          Requested fields: applicant authority evidence · Reason: clarify preparation evidence ·
          Created: 29 Jul 2026 · sent: false · customerMessageSent: false.
        </Alert>
      )}
      <div className="review-actions" aria-label="Review actions">
        <Button
          disabled={value.stale || claimed}
          onClick={() => {
            setClaimed(true);
          }}
        >
          Claim review
        </Button>
        <Button variant="secondary" disabled={!claimed} onClick={() => setRequest(true)}>
          Request more information
        </Button>
        <Button variant="secondary" disabled={!claimed}>
          Return to preparation
        </Button>
        <Button
          disabled={!claimed || blocking || completed}
          onClick={() => {
            setCompleted(true);
          }}
        >
          Mark reviewed and ready for next step
        </Button>
        <Button variant="secondary" disabled={completed}>
          Withdraw review case
        </Button>
      </div>
      {completed && (
        <Alert title="Reviewed ready for next step — no action executed">
          orderCreated: false · paymentCreated: false · formalMatterCreated: false ·
          providerAppointed: false · filingCreated: false · customerMessageSent: false
        </Alert>
      )}
    </section>
  );
}
