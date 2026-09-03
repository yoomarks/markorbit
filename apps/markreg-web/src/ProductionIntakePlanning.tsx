import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  CreateProductionIntakeCommandV1,
  EarlyFunnelApplicantType,
  EarlyFunnelTrademarkType,
  ProductionIntakeInputV1,
  ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  Stepper,
  TextArea,
  TextInput
} from '@markorbit/ui';
import { useEffect, useRef, useState } from 'react';
import { MarkregApiError } from './api/errors.js';
import {
  createProductionIntakeClient,
  type ProductionIntakeClient
} from './api/production-intake.js';
import './production-intake.css';

export interface ProductionIntakeDraft {
  applicantType: EarlyFunnelApplicantType | '';
  applicantName: string;
  applicantCountry: string;
  trademarkType: EarlyFunnelTrademarkType | '';
  trademarkText: string;
  targetJurisdictions: string;
  goodsServices: string;
  businessContext: string;
  filingGoal: string;
}

const emptyDraft: ProductionIntakeDraft = {
  applicantType: '',
  applicantName: '',
  applicantCountry: '',
  trademarkType: '',
  trademarkText: '',
  targetJurisdictions: '',
  goodsServices: '',
  businessContext: '',
  filingGoal: ''
};

const labels = ['Applicant', 'Trademark', 'Markets', 'Goods / Services', 'Filing Goal', 'Review'];
const required: (keyof ProductionIntakeDraft)[][] = [
  ['applicantType', 'applicantName', 'applicantCountry'],
  ['trademarkType', 'trademarkText'],
  ['targetJurisdictions'],
  ['goodsServices'],
  ['businessContext', 'filingGoal'],
  []
];

const why = [
  'Identify the applicant whose filing request is being recorded.',
  'Record the mark exactly as you currently describe it.',
  'Record the jurisdictions you want MarkReg to consider.',
  'Capture your own goods and services wording without treating it as official classification truth.',
  'Add the business context and filing goal that explain your request.',
  'Review the exact customer-supplied information before creating durable Intake truth.'
];

type PendingSubmission = {
  fingerprint: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
};

type FlowStatus =
  | 'editing'
  | 'submitting'
  | 'loading'
  | 'received'
  | 'write-uncertain'
  | 'readback-uncertain'
  | 'error';

type FailureView = {
  title: string;
  description: string;
  canEdit: boolean;
};

const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}` as MarkOrbitId;

function safeLoad<T>(key: string): T | undefined {
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : undefined;
  } catch {
    return undefined;
  }
}

function currentWorkspaceId(): string | undefined {
  return typeof sessionStorage === 'undefined'
    ? undefined
    : (sessionStorage.getItem('markorbit-workspace-id') ?? undefined);
}

function jurisdictions(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function productionIntakeInput(draft: ProductionIntakeDraft): ProductionIntakeInputV1 {
  if (!draft.applicantType || !draft.trademarkType)
    throw new Error('Production Intake draft is incomplete.');
  return {
    businessContext: draft.businessContext.trim(),
    applicant: {
      type: draft.applicantType,
      name: draft.applicantName.trim(),
      country: draft.applicantCountry.trim()
    },
    trademark: {
      type: draft.trademarkType,
      representationText: draft.trademarkText.trim()
    },
    targetJurisdictions: jurisdictions(draft.targetJurisdictions),
    goodsServices: {
      sourceText: draft.goodsServices.trim()
    },
    filingGoal: draft.filingGoal.trim()
  };
}

function draftFingerprint(draft: ProductionIntakeDraft): string {
  return JSON.stringify(productionIntakeInput(draft));
}

function failureView(error: unknown, read = false): FailureView {
  if (!(error instanceof MarkregApiError))
    return {
      title: read ? 'Durable Intake could not be loaded' : 'Production Intake could not be created',
      description:
        'MarkReg could not complete this request safely. No fixture Recommendation will be substituted.',
      canEdit: !read
    };

  if (error.kind === 'offline')
    return {
      title: 'You are offline',
      description: read
        ? 'Reconnect to reload the durable Production Intake from MarkReg.'
        : 'Reconnect before retrying the same durable Production Intake submission.',
      canEdit: !read
    };

  switch (error.status) {
    case 400:
    case 422:
      return {
        title: 'Review the Intake details',
        description:
          'The durable Production Intake request was rejected as invalid. Review the customer-supplied information before submitting again.',
        canEdit: true
      };
    case 401:
      return {
        title: 'Sign in again',
        description: 'The authenticated MarkReg session is required for durable Production Intake.',
        canEdit: false
      };
    case 403:
      return {
        title: 'Workspace permission required',
        description:
          'Your current Workspace role does not have permission for this durable Production Intake action.',
        canEdit: false
      };
    case 404:
      return {
        title: 'Durable Intake not found',
        description:
          'The saved Intake pointer does not resolve in the current Workspace. MarkReg will not replace it with fixture data.',
        canEdit: false
      };
    case 409:
      return {
        title: 'Submission identity conflict',
        description:
          'This Idempotency-Key was already used for different information. Review the Intake before creating a new logical submission.',
        canEdit: true
      };
    case 502:
    case 503:
      return {
        title: 'Production Intake temporarily unavailable',
        description:
          'The durable MarkReg path is unavailable. Existing durable truth is unchanged and no fixture fallback will be used.',
        canEdit: !read
      };
    default:
      return {
        title: read
          ? 'Durable Intake could not be loaded'
          : 'Production Intake could not be created',
        description: error.message,
        canEdit: !read
      };
  }
}

const defaultClient = createProductionIntakeClient();

export function ProductionIntakePlanning({
  client = defaultClient,
  workspaceId = currentWorkspaceId()
}: {
  client?: ProductionIntakeClient;
  workspaceId?: string;
}) {
  const storageSuffix = workspaceId ?? 'no-workspace';
  const draftKey = `markreg-production-intake-draft-v1:${storageSuffix}`;
  const pointerKey = `markreg-production-intake-pointer-v1:${storageSuffix}`;
  const pendingKey = `markreg-production-intake-pending-v1:${storageSuffix}`;
  const existingPointer = safeLoad<MarkOrbitId>(pointerKey);
  const [draft, setDraft] = useState<ProductionIntakeDraft>(
    () => safeLoad<ProductionIntakeDraft>(draftKey) ?? emptyDraft
  );
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof ProductionIntakeDraft, string>>>({});
  const [status, setStatus] = useState<FlowStatus>(existingPointer ? 'loading' : 'editing');
  const [record, setRecord] = useState<ProductionIntakeV1>();
  const [readbackId, setReadbackId] = useState<MarkOrbitId | undefined>(existingPointer);
  const [failure, setFailure] = useState<FailureView>();
  const submitting = useRef(false);

  useEffect(() => {
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, draftKey]);

  const readDurable = async (intakeId: MarkOrbitId, afterWrite: boolean) => {
    setReadbackId(intakeId);
    if (!afterWrite) setStatus('loading');
    try {
      const envelope = await client.get(intakeId);
      setRecord(envelope.intake);
      setFailure(undefined);
      setStatus('received');
    } catch (error) {
      setFailure(failureView(error, true));
      setStatus(afterWrite ? 'readback-uncertain' : 'error');
    }
  };

  useEffect(() => {
    if (!existingPointer) return;
    void readDurable(existingPointer, false);
    // The durable pointer is the only local submitted-state value. Material truth comes from GET.
  }, []);

  const update = (key: keyof ProductionIntakeDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    sessionStorage.removeItem(pendingKey);
  };

  const validate = (target = step): boolean => {
    const next: typeof errors = {};
    for (const key of required[target] ?? []) {
      const value = draft[key];
      if (!String(value).trim()) next[key] = 'This information is required.';
    }
    if (target === 2 && jurisdictions(draft.targetJurisdictions).length === 0)
      next.targetJurisdictions = 'Enter at least one jurisdiction.';
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
    return !first;
  };

  const next = () => {
    if (validate()) setStep((current) => Math.min(5, current + 1));
  };

  const command = (): CreateProductionIntakeCommandV1 => {
    const fingerprint = draftFingerprint(draft);
    const saved = safeLoad<PendingSubmission>(pendingKey);
    const pending =
      saved?.fingerprint === fingerprint
        ? saved
        : {
            fingerprint,
            idempotencyKey: crypto.randomUUID(),
            correlationId: makeId('correlation')
          };
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    return {
      schemaVersion: 1,
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      input: productionIntakeInput(draft),
      idempotencyKey: pending.idempotencyKey,
      correlationId: pending.correlationId
    };
  };

  const submit = async () => {
    if (submitting.current) return;
    if (!required.every((_, index) => validate(index))) {
      setStep(0);
      return;
    }
    submitting.current = true;
    setFailure(undefined);
    setStatus('submitting');
    try {
      const envelope = await client.create(command());
      const intakeId = envelope.intake.intakeId;
      sessionStorage.setItem(pointerKey, JSON.stringify(intakeId));
      sessionStorage.removeItem(pendingKey);
      await readDurable(intakeId, true);
    } catch (error) {
      const safe =
        error instanceof MarkregApiError
          ? error
          : new MarkregApiError(
              'blocking',
              'MarkReg could not complete the durable Production Intake request safely.'
            );
      setFailure(failureView(safe));
      setStatus(
        safe.kind === 'offline' ||
          safe.kind === 'recoverable' ||
          safe.status === 502 ||
          safe.status === 503
          ? 'write-uncertain'
          : 'error'
      );
    } finally {
      submitting.current = false;
    }
  };

  const startAnother = () => {
    sessionStorage.removeItem(pointerKey);
    sessionStorage.removeItem(pendingKey);
    sessionStorage.removeItem(draftKey);
    setDraft(emptyDraft);
    setRecord(undefined);
    setReadbackId(undefined);
    setFailure(undefined);
    setStep(0);
    setStatus('editing');
  };

  if (!workspaceId)
    return (
      <main className="markreg-page production-intake-page">
        <ErrorState
          title="Choose a Workspace"
          description="An authenticated Workspace is required before MarkReg can create durable Production Intake."
        />
      </main>
    );

  if (status === 'loading')
    return (
      <main className="markreg-page production-intake-page">
        <LoadingState label="Reloading durable Production Intake" />
      </main>
    );

  if (status === 'submitting')
    return (
      <main className="markreg-page production-intake-page">
        <Stepper steps={labels} current={5} />
        <LoadingState label="Saving durable Production Intake" />
        <p className="mo-center">
          MarkReg is creating customer-supplied Intake truth. No Recommendation, Order, Payment, or
          Filing is being created.
        </p>
      </main>
    );

  if (status === 'received' && record)
    return <ReceivedIntake record={record} onStartAnother={startAnother} />;

  if (status === 'write-uncertain' && failure)
    return (
      <main className="markreg-page production-intake-page" aria-live="assertive">
        <ErrorState
          title="Submission outcome uncertain"
          description={`${failure.description} Retry uses the same logical Idempotency-Key and the same Intake material.`}
          onRetry={() => void submit()}
        />
        <Button
          variant="secondary"
          onClick={() => {
            setStatus('editing');
            setStep(5);
          }}
        >
          Review information
        </Button>
      </main>
    );

  if (status === 'readback-uncertain' && failure && readbackId)
    return (
      <main className="markreg-page production-intake-page" aria-live="assertive">
        <ErrorState
          title="Intake saved; durable readback is uncertain"
          description="The create request returned an Intake identity, but the owner readback could not be confirmed. MarkReg will reload that durable identity instead of submitting again or showing fixture data."
          onRetry={() => void readDurable(readbackId, true)}
        />
      </main>
    );

  if (status === 'error' && failure)
    return (
      <main className="markreg-page production-intake-page" aria-live="assertive">
        <ErrorState title={failure.title} description={failure.description} />
        {failure.canEdit && (
          <Button
            variant="secondary"
            onClick={() => {
              setStatus('editing');
              setStep(5);
            }}
          >
            Review information
          </Button>
        )}
        {readbackId && (
          <Button variant="secondary" onClick={() => void readDurable(readbackId, false)}>
            Retry durable read
          </Button>
        )}
      </main>
    );

  return (
    <main className="markreg-page production-intake-page">
      <Stepper steps={labels} current={step} />
      <PageHeader
        title={step === 5 ? 'Review your Production Intake' : (labels[step] ?? 'Production Intake')}
        description={why[step] ?? ''}
      />
      <Alert tone="warning" title="Customer-supplied Intake only">
        Production Intake records what you supplied. It is not verified legal or Official Truth and
        does not create a Recommendation, Selection, Quote, Confirmation, Order, Matter, Payment,
        Filing, provider contact, or authorization.
      </Alert>
      <Card>
        <div className="production-intake-form">{fields(step, draft, update, errors)}</div>
        {step === 5 && <Review draft={draft} />}
        <div className="production-intake-actions">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((current) => current - 1)}>
              Back
            </Button>
          )}
          {step < 5 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={() => void submit()}>Create durable Intake</Button>
          )}
        </div>
      </Card>
    </main>
  );
}

function fields(
  step: number,
  draft: ProductionIntakeDraft,
  update: (key: keyof ProductionIntakeDraft, value: string) => void,
  errors: Partial<Record<keyof ProductionIntakeDraft, string>>
) {
  switch (step) {
    case 0:
      return (
        <>
          <Select
            id="applicantType"
            label="Applicant type"
            value={draft.applicantType}
            error={errors.applicantType}
            onChange={(event) => update('applicantType', event.currentTarget.value)}
          >
            <option value="">Select one</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="ORGANIZATION">Organization / company</option>
            <option value="OTHER">Other</option>
          </Select>
          <TextInput
            id="applicantName"
            label="Applicant name"
            value={draft.applicantName}
            error={errors.applicantName}
            onChange={(event) => update('applicantName', event.currentTarget.value)}
          />
          <TextInput
            id="applicantCountry"
            label="Applicant country or region"
            value={draft.applicantCountry}
            error={errors.applicantCountry}
            hint="Use the country or region code/name you want recorded as customer-supplied Intake."
            onChange={(event) => update('applicantCountry', event.currentTarget.value)}
          />
        </>
      );
    case 1:
      return (
        <>
          <Select
            id="trademarkType"
            label="Trademark type"
            value={draft.trademarkType}
            error={errors.trademarkType}
            onChange={(event) => update('trademarkType', event.currentTarget.value)}
          >
            <option value="">Select one</option>
            <option value="WORD">Word</option>
            <option value="STYLIZED_WORD">Stylized word</option>
            <option value="DEVICE">Device / logo</option>
            <option value="COMPOSITE">Composite</option>
            <option value="OTHER">Other</option>
          </Select>
          <TextInput
            id="trademarkText"
            label="Trademark representation text"
            value={draft.trademarkText}
            error={errors.trademarkText}
            onChange={(event) => update('trademarkText', event.currentTarget.value)}
          />
        </>
      );
    case 2:
      return (
        <TextInput
          id="targetJurisdictions"
          label="Target jurisdictions"
          value={draft.targetJurisdictions}
          error={errors.targetJurisdictions}
          hint="Enter one or more jurisdictions separated by commas, for example US, EU, CN."
          onChange={(event) => update('targetJurisdictions', event.currentTarget.value)}
        />
      );
    case 3:
      return (
        <TextArea
          id="goodsServices"
          label="Goods / services source text"
          value={draft.goodsServices}
          error={errors.goodsServices}
          onChange={(event) => update('goodsServices', event.currentTarget.value)}
        />
      );
    case 4:
      return (
        <>
          <TextArea
            id="businessContext"
            label="Business context"
            value={draft.businessContext}
            error={errors.businessContext}
            onChange={(event) => update('businessContext', event.currentTarget.value)}
          />
          <TextArea
            id="filingGoal"
            label="Filing goal"
            value={draft.filingGoal}
            error={errors.filingGoal}
            onChange={(event) => update('filingGoal', event.currentTarget.value)}
          />
        </>
      );
    default:
      return null;
  }
}

function Review({ draft }: { draft: ProductionIntakeDraft }) {
  return (
    <section aria-labelledby="production-intake-review-heading">
      <h2 id="production-intake-review-heading">Customer-supplied Intake summary</h2>
      <KeyValueList
        items={[
          { key: 'Applicant', value: `${draft.applicantName} · ${draft.applicantType}` },
          { key: 'Applicant country / region', value: draft.applicantCountry },
          { key: 'Trademark', value: `${draft.trademarkText} · ${draft.trademarkType}` },
          {
            key: 'Target jurisdictions',
            value: jurisdictions(draft.targetJurisdictions).join(', ')
          },
          { key: 'Goods / services', value: draft.goodsServices },
          { key: 'Business context', value: draft.businessContext },
          { key: 'Filing goal', value: draft.filingGoal }
        ]}
      />
      <p>
        Creating this Intake records these answers durably. It does not create or imply a
        Recommendation.
      </p>
    </section>
  );
}

function ReceivedIntake({
  record,
  onStartAnother
}: {
  record: ProductionIntakeV1;
  onStartAnother: () => void;
}) {
  return (
    <main className="markreg-page production-intake-page">
      <PageHeader
        title="Production Intake received"
        description="This view was reloaded from MarkReg durable owner truth."
      />
      <Alert tone="success" title="Durable Intake receipt">
        Status {record.status} means MarkReg has recorded the customer-supplied Intake. It does not
        mean a Recommendation, legal conclusion, authorization, Order, Payment, or Filing exists.
      </Alert>
      <Card>
        <h2>Your recorded Intake</h2>
        <KeyValueList
          items={[
            {
              key: 'Applicant',
              value: `${record.input.applicant.name} · ${record.input.applicant.type}`
            },
            { key: 'Applicant country / region', value: record.input.applicant.country },
            {
              key: 'Trademark',
              value: `${record.input.trademark.representationText} · ${record.input.trademark.type}`
            },
            { key: 'Target jurisdictions', value: record.input.targetJurisdictions.join(', ') },
            { key: 'Goods / services', value: record.input.goodsServices.sourceText },
            { key: 'Business context', value: record.input.businessContext },
            { key: 'Filing goal', value: record.input.filingGoal }
          ]}
        />
        <details className="production-intake-provenance">
          <summary>Record identity and provenance</summary>
          <KeyValueList
            items={[
              { key: 'Intake ID', value: record.intakeId },
              { key: 'Version', value: record.version },
              { key: 'State', value: record.status },
              { key: 'Source class', value: record.sourceClass },
              { key: 'Updated', value: record.updatedAt },
              { key: 'Fingerprint', value: record.fingerprintSha256 }
            ]}
          />
        </details>
      </Card>
      <Alert tone="warning" title="Recommendation is not available here yet">
        Production Recommendation remains gated on a production-admissible source under #388. This
        Intake receipt does not fabricate options or advance the commercial or filing lifecycle.
      </Alert>
      <Button variant="secondary" onClick={onStartAnother}>
        Start another Intake
      </Button>
    </main>
  );
}
