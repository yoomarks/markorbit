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

interface ProductionIntakeDraft {
  applicantType: '' | EarlyFunnelApplicantType;
  applicantName: string;
  applicantCountry: string;
  trademarkType: '' | EarlyFunnelTrademarkType;
  trademarkText: string;
  targetJurisdictions: string[];
  goodsServices: string;
  businessContext: string;
  filingGoal: string;
}

interface SubmissionIdentity {
  fingerprint: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

type FlowStatus =
  | 'editing'
  | 'submitting'
  | 'reading'
  | 'ready'
  | 'invalid'
  | 'conflict'
  | 'authentication'
  | 'permission'
  | 'unavailable'
  | 'readback-unavailable'
  | 'not-found'
  | 'blocking';

const DRAFT_KEY = 'markreg-production-intake-draft-v1';
const SUBMISSION_KEY = 'markreg-production-intake-submission-v1';
const RESULT_REF_KEY = 'markreg-production-intake-ref-v1';
const labels = ['Applicant', 'Trademark', 'Markets', 'Goods / Services', 'Filing Goal', 'Review'];
const required: (keyof ProductionIntakeDraft)[][] = [
  ['applicantType', 'applicantName', 'applicantCountry'],
  ['trademarkType', 'trademarkText'],
  ['targetJurisdictions'],
  ['goodsServices'],
  ['businessContext', 'filingGoal'],
  []
];

const emptyDraft: ProductionIntakeDraft = {
  applicantType: '',
  applicantName: '',
  applicantCountry: '',
  trademarkType: '',
  trademarkText: '',
  targetJurisdictions: [],
  goodsServices: '',
  businessContext: '',
  filingGoal: ''
};

const defaultClient = createProductionIntakeClient();
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}` as MarkOrbitId;
const fingerprint = (draft: ProductionIntakeDraft) => JSON.stringify(draft);

function load<T>(key: string): T | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : undefined;
  } catch {
    return undefined;
  }
}

function save(key: string, value: unknown): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(key, JSON.stringify(value));
}

function remove(key: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(key);
}

function classify(error: unknown, readback: boolean): FlowStatus {
  if (!(error instanceof MarkregApiError)) return 'blocking';
  if (error.code === 'AUTHENTICATION_REQUIRED') return 'authentication';
  if (
    error.code === 'PERMISSION_DENIED' ||
    error.code === 'UNTRUSTED_ORIGIN' ||
    error.code === 'INVALID_CSRF_TOKEN'
  )
    return 'permission';
  if (error.code === 'PRODUCTION_INTAKE_NOT_FOUND') return 'not-found';
  if (error.kind === 'validation') return 'invalid';
  if (error.kind === 'conflict') return 'conflict';
  if (error.kind === 'offline' || error.kind === 'recoverable')
    return readback ? 'readback-unavailable' : 'unavailable';
  return 'blocking';
}

function toInput(draft: ProductionIntakeDraft): ProductionIntakeInputV1 {
  if (!draft.applicantType || !draft.trademarkType)
    throw new Error('Validated intake is missing structured types.');
  return {
    businessContext: draft.businessContext.trim(),
    applicant: {
      type: draft.applicantType,
      name: draft.applicantName.trim(),
      country: draft.applicantCountry
    },
    trademark: {
      type: draft.trademarkType,
      representationText: draft.trademarkText.trim()
    },
    targetJurisdictions: draft.targetJurisdictions,
    goodsServices: { sourceText: draft.goodsServices.trim() },
    filingGoal: draft.filingGoal.trim()
  };
}

function errorCopy(status: FlowStatus): { title: string; description: string } {
  switch (status) {
    case 'authentication':
      return {
        title: 'Sign in again to continue',
        description:
          'Your saved answers remain in this browser. An authenticated Workspace session is required before a Production Intake can be created or read.'
      };
    case 'permission':
      return {
        title: 'Workspace permission required',
        description:
          'Your current Workspace role or browser security context cannot create this Production Intake. No fixture Recommendation will be used as a fallback.'
      };
    case 'invalid':
      return {
        title: 'Review the intake details',
        description:
          'The durable Intake boundary rejected one or more submitted values. Return to Review and correct the customer-supplied information before submitting again.'
      };
    case 'conflict':
      return {
        title: 'Submission identity conflict',
        description:
          'This logical submission key was already used for different material. Review the answers before starting a new logical submission; MarkReg will not silently create another Intake.'
      };
    case 'unavailable':
      return {
        title: 'Submission outcome is uncertain',
        description:
          'The Gateway did not return a reliable outcome. Retry uses the same idempotency key and correlation ID so the same logical Production Intake is replayed safely.'
      };
    case 'readback-unavailable':
      return {
        title: 'Durable Intake read is temporarily unavailable',
        description:
          'The submission returned a durable Intake identity, but MarkReg cannot currently read the owner record back. No submitted form state is being shown as durable truth.'
      };
    case 'not-found':
      return {
        title: 'Durable Intake is not available in this Workspace',
        description:
          'The saved Intake reference cannot be read from the current authenticated Workspace. MarkReg will not reconstruct it from browser form state.'
      };
    default:
      return {
        title: 'Production Intake cannot continue safely',
        description:
          'MarkReg could not complete the durable Intake operation safely. No Recommendation, Order, Matter, Payment, Filing, or Official Truth has been created by this screen.'
      };
  }
}

export function ProductionIntakeFlow({
  client = defaultClient
}: {
  client?: ProductionIntakeClient;
}) {
  const savedIntakeId = load<string>(RESULT_REF_KEY);
  const [started, setStarted] = useState(() => Boolean(load<ProductionIntakeDraft>(DRAFT_KEY)));
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProductionIntakeDraft>(
    () => load<ProductionIntakeDraft>(DRAFT_KEY) ?? emptyDraft
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ProductionIntakeDraft, string>>>({});
  const [status, setStatus] = useState<FlowStatus>(savedIntakeId ? 'reading' : 'editing');
  const [intake, setIntake] = useState<ProductionIntakeV1>();
  const submission = useRef<SubmissionIdentity | undefined>(
    load<SubmissionIdentity>(SUBMISSION_KEY)
  );
  const durableIntakeId = useRef<string | undefined>(savedIntakeId);
  const pending = useRef(false);

  useEffect(() => save(DRAFT_KEY, draft), [draft]);

  useEffect(() => {
    const intakeId = durableIntakeId.current;
    if (!intakeId) return;
    let active = true;
    setStatus('reading');
    void client
      .get(intakeId)
      .then((ownerIntake) => {
        if (!active) return;
        setIntake(ownerIntake);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (active) setStatus(classify(error, true));
      });
    return () => {
      active = false;
    };
  }, [client]);

  const update = (key: keyof ProductionIntakeDraft, value: string | string[]) => {
    const next = { ...draft, [key]: value } as ProductionIntakeDraft;
    setDraft(next);
    setErrors((current) => ({ ...current, [key]: undefined }));
    if (submission.current?.fingerprint !== fingerprint(next)) {
      submission.current = undefined;
      remove(SUBMISSION_KEY);
    }
  };

  const validate = (target = step) => {
    const next: Partial<Record<keyof ProductionIntakeDraft, string>> = {};
    for (const key of required[target] ?? []) {
      const value = draft[key];
      if (Array.isArray(value) ? value.length === 0 : !value.trim())
        next[key] = 'This information is required.';
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
    return !first;
  };

  const command = (): CreateProductionIntakeCommandV1 => {
    const materialFingerprint = fingerprint(draft);
    if (!submission.current || submission.current.fingerprint !== materialFingerprint) {
      submission.current = {
        fingerprint: materialFingerprint,
        idempotencyKey: crypto.randomUUID(),
        correlationId: makeId('correlation')
      };
      save(SUBMISSION_KEY, submission.current);
    }
    return {
      schemaVersion: 1,
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      input: toInput(draft),
      idempotencyKey: submission.current.idempotencyKey,
      correlationId: submission.current.correlationId
    };
  };

  const readOwnerTruth = async (intakeId: string) => {
    durableIntakeId.current = intakeId;
    save(RESULT_REF_KEY, intakeId);
    setIntake(undefined);
    setStatus('reading');
    try {
      const ownerIntake = await client.get(intakeId);
      setIntake(ownerIntake);
      setStatus('ready');
    } catch (error) {
      setStatus(classify(error, true));
    }
  };

  const submit = async () => {
    if (pending.current || !validate(5)) return;
    pending.current = true;
    setStatus('submitting');
    try {
      const created = await client.create(command());
      await readOwnerTruth(created.intakeId);
    } catch (error) {
      setStatus(classify(error, false));
    } finally {
      pending.current = false;
    }
  };

  const retryRead = () => {
    const intakeId = durableIntakeId.current;
    if (intakeId) void readOwnerTruth(intakeId);
  };

  const startNew = () => {
    durableIntakeId.current = undefined;
    submission.current = undefined;
    remove(RESULT_REF_KEY);
    remove(SUBMISSION_KEY);
    remove(DRAFT_KEY);
    setIntake(undefined);
    setDraft(emptyDraft);
    setErrors({});
    setStep(0);
    setStarted(true);
    setStatus('editing');
  };

  if (status === 'submitting')
    return (
      <main className="markreg-page" aria-label="Production Intake">
        <Stepper steps={labels} current={5} />
        <LoadingState label="Recording your durable Production Intake" />
        <p className="mo-center">
          Do not resubmit in another tab. This logical request has a stable replay identity.
        </p>
      </main>
    );

  if (status === 'reading')
    return (
      <main className="markreg-page" aria-label="Production Intake">
        <LoadingState label="Reading durable Production Intake truth" />
      </main>
    );

  if (status === 'ready' && intake)
    return <ProductionIntakeReceipt intake={intake} onStartNew={startNew} />;

  if (status !== 'editing') {
    const copy = errorCopy(status);
    const canRetrySubmission = status === 'unavailable';
    const canRetryRead = status === 'readback-unavailable';
    const canReview = status === 'invalid' || status === 'conflict' || status === 'blocking';
    return (
      <main className="markreg-page" aria-label="Production Intake">
        <PageHeader title={copy.title} description={copy.description} />
        <Alert tone="warning" title="Authority boundary">
          Production Intake = customer-supplied input. Intake ≠ Recommendation ≠ authorization. No
          fixture flow is used as fallback.
        </Alert>
        <ErrorState
          title={copy.title}
          description={copy.description}
          {...(canRetrySubmission ? { onRetry: () => void submit() } : {})}
          {...(canRetryRead ? { onRetry: retryRead } : {})}
        />
        <div className="markreg-actions">
          {canReview && (
            <Button
              variant="secondary"
              onClick={() => {
                if (status === 'conflict') {
                  submission.current = undefined;
                  remove(SUBMISSION_KEY);
                }
                setStep(5);
                setStatus('editing');
              }}
            >
              Review information
            </Button>
          )}
          {(status === 'authentication' || status === 'permission' || status === 'not-found') && (
            <Button variant="secondary" onClick={startNew}>
              Start a new Intake
            </Button>
          )}
        </div>
      </main>
    );
  }

  if (!started)
    return (
      <main className="markreg-page" aria-label="Production Intake">
        <PageHeader
          title="Plan a new trademark filing"
          description="Record your filing context as a durable Production Intake in the current Workspace."
        />
        <Alert tone="warning" title="Intake is not advice or a filing">
          Your answers are customer-supplied input. This step does not verify Official Truth, create
          a Recommendation, authorize a protected action, create an Order or Matter, take Payment,
          or file anything.
        </Alert>
        <Card>
          <h2>Start durable intake</h2>
          <p>
            Answer six focused steps. You can review the information before it is sent through the
            authenticated Gateway.
          </p>
          <Button onClick={() => setStarted(true)}>Start Production Intake</Button>
        </Card>
      </main>
    );

  return (
    <main className="markreg-page" aria-label="Production Intake">
      <Stepper steps={labels} current={step} />
      <PageHeader
        title={step === 5 ? 'Review your Production Intake' : (labels[step] ?? 'Production Intake')}
        description={why[step] ?? ''}
      />
      <Alert tone="warning" title="Customer-supplied input only">
        Intake ≠ Recommendation. These answers are not verified official data and do not create
        legal or professional approval.
      </Alert>
      <Card>
        <div className="markreg-form">{fields(step, draft, update, errors)}</div>
        {step === 5 && <Review draft={draft} edit={setStep} />}
        <div className="markreg-actions">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
          )}
          {step < 5 ? (
            <Button onClick={() => validate() && setStep((value) => Math.min(5, value + 1))}>
              Continue
            </Button>
          ) : (
            <Button onClick={() => void submit()}>Submit Production Intake</Button>
          )}
        </div>
      </Card>
    </main>
  );
}

const why = [
  'Identify the customer-supplied applicant and home country.',
  'Describe the mark that the customer wants to protect.',
  'Choose the target jurisdictions for this intake.',
  'Record the customer wording for goods and services without treating it as classification advice.',
  'Record the commercial context and filing goal.',
  'Confirm every answer before the authenticated durable write.'
];

function fields(
  step: number,
  draft: ProductionIntakeDraft,
  update: (key: keyof ProductionIntakeDraft, value: string | string[]) => void,
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
          <Select
            id="applicantCountry"
            label="Applicant country"
            value={draft.applicantCountry}
            error={errors.applicantCountry}
            onChange={(event) => update('applicantCountry', event.currentTarget.value)}
          >
            <option value="">Select one</option>
            {countries.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </Select>
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
            <option value="WORD">Word mark</option>
            <option value="STYLIZED_WORD">Stylized word</option>
            <option value="DEVICE">Device / logo</option>
            <option value="COMPOSITE">Composite mark</option>
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
        <Select
          id="targetJurisdictions"
          multiple
          label="Target jurisdictions (select one or more)"
          value={draft.targetJurisdictions}
          error={errors.targetJurisdictions}
          onChange={(event) =>
            update(
              'targetJurisdictions',
              Array.from(event.currentTarget.selectedOptions, (option) => option.value)
            )
          }
        >
          {countries.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </Select>
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

const countries = [
  ['CN', 'China'],
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['EU', 'European Union'],
  ['JP', 'Japan'],
  ['KR', 'South Korea'],
  ['SG', 'Singapore'],
  ['AU', 'Australia'],
  ['CA', 'Canada']
] as const;

function Review({ draft, edit }: { draft: ProductionIntakeDraft; edit: (step: number) => void }) {
  const groups = [
    ['Applicant', `${draft.applicantName} · ${draft.applicantType} · ${draft.applicantCountry}`],
    ['Trademark', `${draft.trademarkText} · ${draft.trademarkType}`],
    ['Markets', draft.targetJurisdictions.join(', ')],
    ['Goods / Services', draft.goodsServices],
    ['Filing goal', `${draft.filingGoal} — ${draft.businessContext}`]
  ];
  return (
    <div>
      {groups.map(([label, value], index) => (
        <section className="markreg-review" key={label}>
          <div>
            <strong>{label}</strong>
            <p>{value}</p>
          </div>
          <Button variant="secondary" onClick={() => edit(index)}>
            Edit {label}
          </Button>
        </section>
      ))}
    </div>
  );
}

function ProductionIntakeReceipt({
  intake,
  onStartNew
}: {
  intake: ProductionIntakeV1;
  onStartNew: () => void;
}) {
  return (
    <main className="markreg-page" aria-label="Production Intake receipt">
      <PageHeader
        title="Production Intake received"
        description="This page is rendered from the durable owner record read back through the authenticated Gateway."
      />
      <Alert tone="warning" title="Receipt only — not a Recommendation">
        `RECEIVED` or `RECOMMENDATION_READY` is Intake lifecycle truth only. This screen does not
        display or create a Recommendation, selection, Quote, confirmation, Order, Matter, Payment,
        Filing, professional approval, legal conclusion, or Official Truth.
      </Alert>
      <Card>
        <h2>Durable Intake</h2>
        <KeyValueList
          items={[
            { key: 'Intake ID', value: intake.intakeId },
            { key: 'Version', value: intake.version },
            { key: 'Status', value: intake.status },
            { key: 'Source class', value: intake.sourceClass },
            {
              key: 'Applicant',
              value: `${intake.input.applicant.name} · ${intake.input.applicant.type} · ${intake.input.applicant.country}`
            },
            {
              key: 'Trademark',
              value: `${intake.input.trademark.representationText} · ${intake.input.trademark.type}`
            },
            { key: 'Target jurisdictions', value: intake.input.targetJurisdictions.join(', ') },
            { key: 'Goods / services', value: intake.input.goodsServices.sourceText },
            { key: 'Business context', value: intake.input.businessContext },
            { key: 'Filing goal', value: intake.input.filingGoal },
            { key: 'Updated', value: intake.updatedAt }
          ]}
        />
      </Card>
      <Alert tone="info" title="Authority consequences remain false">
        Customer-supplied Intake data is not verified official truth. No protected action or
        downstream commercial/filing state is implied by this receipt.
      </Alert>
      <Button variant="secondary" onClick={onStartNew}>
        Start another Production Intake
      </Button>
    </main>
  );
}
