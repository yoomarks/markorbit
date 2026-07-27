import type {
  IntakeCreateCommand,
  IntakeRecommendationResponse,
  MarkOrbitId
} from '@markorbit/contracts';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  FixtureBanner,
  KeyValueList,
  LoadingState,
  PageHeader,
  RecommendationCard,
  Select,
  Stepper,
  TextArea,
  TextInput
} from '@markorbit/ui';
import { useEffect, useRef, useState } from 'react';
import { MarkregApiError } from './api/errors.js';
import { createMarkregClient, type MarkregClient } from './api/markreg.js';

export interface IntakeDraft {
  applicantType: string;
  applicantName: string;
  applicantCountry: string;
  trademarkType: string;
  trademarkText: string;
  targetCountries: string[];
  goodsServicesSummary: string;
  businessContext: string;
  filingGoal: string;
}
const emptyDraft: IntakeDraft = {
  applicantType: '',
  applicantName: '',
  applicantCountry: '',
  trademarkType: '',
  trademarkText: '',
  targetCountries: [],
  goodsServicesSummary: '',
  businessContext: '',
  filingGoal: ''
};
const storageKey = 'markreg-guided-intake-v1';
const resultKey = 'markreg-recommendation-v1';
const labels = ['Applicant', 'Trademark', 'Markets', 'Goods / Services', 'Filing Goal', 'Review'];
const required: (keyof IntakeDraft)[][] = [
  ['applicantType', 'applicantName', 'applicantCountry'],
  ['trademarkType', 'trademarkText'],
  ['targetCountries'],
  ['goodsServicesSummary'],
  ['businessContext', 'filingGoal'],
  []
];
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}` as MarkOrbitId;
const load = <T,>(key: string): T | undefined => {
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : undefined;
  } catch {
    return undefined;
  }
};
const fingerprint = (draft: IntakeDraft) => JSON.stringify(draft);

export function MarkregApp({ client = createMarkregClient() }: { client?: MarkregClient }) {
  const [started, setStarted] = useState(() => Boolean(load<IntakeDraft>(storageKey)));
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<IntakeDraft>(
    () => load<IntakeDraft>(storageKey) ?? emptyDraft
  );
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeDraft, string>>>({});
  const [status, setStatus] = useState<
    'editing' | 'submitting' | 'ready' | 'recoverable' | 'blocking'
  >(() => (load<IntakeRecommendationResponse>(resultKey) ? 'ready' : 'editing'));
  const [result, setResult] = useState<IntakeRecommendationResponse | undefined>(() =>
    load(resultKey)
  );
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string>();
  const submission = useRef<{ fingerprint: string; key: string; correlation: MarkOrbitId }>();
  const pending = useRef(false);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft]);
  const update = (key: keyof IntakeDraft, value: string | string[]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    if (submission.current?.fingerprint !== fingerprint({ ...draft, [key]: value }))
      submission.current = undefined;
  };
  const validate = (target = step) => {
    const next: typeof errors = {};
    for (const key of required[target] ?? [])
      if (Array.isArray(draft[key]) ? draft.targetCountries.length === 0 : !draft[key])
        next[key] = 'This information is required.';
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
    return !first;
  };
  const next = () => {
    if (validate()) setStep((s) => Math.min(5, s + 1));
  };
  const command = (): IntakeCreateCommand => {
    const print = fingerprint(draft);
    if (!submission.current || submission.current.fingerprint !== print)
      submission.current = {
        fingerprint: print,
        key: crypto.randomUUID(),
        correlation: makeId('correlation')
      };
    return {
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      customerIntent: {
        brandName: draft.trademarkText,
        applicantCountry: draft.applicantCountry,
        targetJurisdictions: draft.targetCountries,
        goodsServicesDescription: `${draft.goodsServicesSummary}\nBusiness context: ${draft.businessContext}\nFiling goal: ${draft.filingGoal}\nApplicant: ${draft.applicantName} (${draft.applicantType}); trademark type: ${draft.trademarkType}`
      },
      actor: {
        actorId: makeId('actor'),
        workplaceId: makeId('workplace'),
        product: 'MARKREG_COM',
        purpose: 'Guided trademark intake recommendation'
      },
      idempotencyKey: submission.current.key,
      correlationId: submission.current.correlation
    };
  };
  const submit = async () => {
    if (pending.current) return;
    pending.current = true;
    setStatus('submitting');
    try {
      const response = await client.createIntake(command());
      setResult(response);
      sessionStorage.setItem(resultKey, JSON.stringify(response));
      setStatus('ready');
      setSelected(response.recommendation.options.find((o) => o.tier === 'B')?.tier);
    } catch (e) {
      const safe =
        e instanceof MarkregApiError
          ? e
          : new MarkregApiError('blocking', 'We could not complete this request safely.');
      setMessage(safe.message);
      setStatus(safe.kind === 'blocking' ? 'blocking' : 'recoverable');
    } finally {
      pending.current = false;
    }
  };

  if (!started)
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <PageHeader
          title="Plan your international trademark protection"
          description="Answer a few focused questions to compare three fixture-only planning options."
        />
        <Card>
          <h2>Start a guided consultation</h2>
          <p>
            We explain why each detail is needed. This is not legal advice, an official review, or a
            filing.
          </p>
          <Button onClick={() => setStarted(true)}>Start consultation</Button>
        </Card>
      </main>
    );
  if (status === 'submitting')
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <Stepper steps={labels} current={5} />
        <LoadingState label="Preparing your fixture recommendation" />
        <p className="mo-center">
          Keep this page open. Submission is disabled while the request completes.
        </p>
      </main>
    );
  if (status === 'blocking')
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <ErrorState title="Consultation cannot continue" description={message} />
      </main>
    );
  if (status === 'recoverable')
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <div aria-live="assertive">
          <ErrorState
            title="Your answers are safe"
            description={message}
            onRetry={() => void submit()}
          />
        </div>
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
  if (status === 'ready' && result)
    return (
      <Recommendation result={result} draft={draft} selected={selected} onSelect={setSelected} />
    );

  return (
    <main className="markreg-page">
      <FixtureBanner />
      <Stepper steps={labels} current={step} />
      <PageHeader
        title={step === 5 ? 'Review your intake' : (labels[step] ?? 'Guided intake')}
        description={why[step] ?? ''}
      />
      <Card>
        <div className="markreg-form">{fields(step, draft, update, errors)}</div>
        {step === 5 && <Review draft={draft} edit={setStep} />}
        <div className="markreg-actions">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < 5 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={() => void submit()}>Submit intake</Button>
          )}
        </div>
      </Card>
    </main>
  );
}

const why = [
  'We need the applicant identity and home country to frame the request.',
  'The mark format and text identify what you want to protect.',
  'Target markets define the geographic scope to compare.',
  'Goods and services connect protection to real commercial activity.',
  'Your context and goal help explain the options without claiming legal judgment.',
  'Confirm every answer before the real Gateway request is sent.'
];
function fields(
  step: number,
  d: IntakeDraft,
  u: (k: keyof IntakeDraft, v: string | string[]) => void,
  e: Partial<Record<keyof IntakeDraft, string>>
) {
  switch (step) {
    case 0:
      return (
        <>
          <Select
            id="applicantType"
            label="Applicant type"
            value={d.applicantType}
            error={e.applicantType}
            onChange={(x) => u('applicantType', x.target.value)}
          >
            <option value="">Select one</option>
            <option>Individual</option>
            <option>Company</option>
            <option>Organization</option>
          </Select>
          <TextInput
            id="applicantName"
            label="Applicant name"
            value={d.applicantName}
            error={e.applicantName}
            onChange={(x) => u('applicantName', x.target.value)}
          />
          <Select
            id="applicantCountry"
            label="Applicant country"
            value={d.applicantCountry}
            error={e.applicantCountry}
            onChange={(x) => u('applicantCountry', x.target.value)}
          >
            <option value="">Select one</option>
            <option value="GB">United Kingdom</option>
            <option value="US">United States</option>
            <option value="CN">China</option>
          </Select>
        </>
      );
    case 1:
      return (
        <>
          <Select
            id="trademarkType"
            label="Trademark type"
            value={d.trademarkType}
            error={e.trademarkType}
            onChange={(x) => u('trademarkType', x.target.value)}
          >
            <option value="">Select one</option>
            <option>Word mark</option>
            <option>Logo</option>
            <option>Combined mark</option>
          </Select>
          <TextInput
            id="trademarkText"
            label="Trademark text"
            value={d.trademarkText}
            error={e.trademarkText}
            onChange={(x) => u('trademarkText', x.target.value)}
          />
        </>
      );
    case 2:
      return (
        <Select
          id="targetCountries"
          multiple
          label="Target countries (select one or more)"
          value={d.targetCountries}
          error={e.targetCountries}
          onChange={(x) =>
            u(
              'targetCountries',
              Array.from(x.target.selectedOptions, (o) => o.value)
            )
          }
        >
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="EU">European Union</option>
          <option value="CN">China</option>
        </Select>
      );
    case 3:
      return (
        <TextArea
          id="goodsServicesSummary"
          label="Goods / services summary"
          value={d.goodsServicesSummary}
          error={e.goodsServicesSummary}
          onChange={(x) => u('goodsServicesSummary', x.target.value)}
        />
      );
    case 4:
      return (
        <>
          <TextArea
            id="businessContext"
            label="Business context"
            value={d.businessContext}
            error={e.businessContext}
            onChange={(x) => u('businessContext', x.target.value)}
          />
          <TextArea
            id="filingGoal"
            label="Filing goal"
            value={d.filingGoal}
            error={e.filingGoal}
            onChange={(x) => u('filingGoal', x.target.value)}
          />
        </>
      );
    default:
      return null;
  }
}
function Review({ draft, edit }: { draft: IntakeDraft; edit: (n: number) => void }) {
  const groups = [
    ['Applicant', `${draft.applicantName} · ${draft.applicantType} · ${draft.applicantCountry}`],
    ['Trademark', `${draft.trademarkText} · ${draft.trademarkType}`],
    ['Markets', draft.targetCountries.join(', ')],
    ['Goods / Services', draft.goodsServicesSummary],
    ['Filing goal', `${draft.filingGoal} — ${draft.businessContext}`]
  ];
  return (
    <div>
      {groups.map((g, i) => (
        <section className="markreg-review" key={g[0]}>
          <div>
            <strong>{g[0]}</strong>
            <p>{g[1]}</p>
          </div>
          <Button variant="secondary" onClick={() => edit(i)}>
            Edit {g[0]}
          </Button>
        </section>
      ))}
    </div>
  );
}
function Recommendation({
  result,
  draft,
  selected,
  onSelect
}: {
  result: IntakeRecommendationResponse;
  draft: IntakeDraft;
  selected: string | undefined;
  onSelect: (v: string) => void;
}) {
  const recommended = 'B';
  return (
    <main className="markreg-page">
      <FixtureBanner />
      <Stepper current={1} steps={['Your goal', 'Recommendation', 'Select plan']} />
      <PageHeader
        title="Compare your protection options"
        description="Choose a planning option for this session. Selection does not create an order or filing."
      />
      <Card>
        <h2>Your application goal</h2>
        <KeyValueList
          items={[
            { key: 'Trademark', value: result.intake.customerIntent.brandName },
            { key: 'Applicant', value: draft.applicantName },
            {
              key: 'Target markets',
              value: result.intake.customerIntent.targetJurisdictions.join(' · ')
            }
          ]}
        />
      </Card>
      <Alert tone="warning" title="FIXTURE_ONLY">
        Generated fixture information—not legal advice, professional review, an official result, or
        a formal application recommendation.
      </Alert>
      <div className="mo-grid markreg-options">
        {result.recommendation.options.map((o) => (
          <RecommendationCard
            key={o.tier}
            optionCode={o.tier}
            title={o.name}
            summary={o.description}
            rationale={result.recommendation.rationale}
            assumptions={result.recommendation.assumptions}
            limitations={result.recommendation.limitations}
            fixtureOnly
            recommended={o.tier === recommended}
            selected={selected === o.tier}
            onSelect={() => onSelect(o.tier)}
          />
        ))}
      </div>
      <div className="markreg-actions">
        <Button disabled={!selected}>Select plan {selected ?? ''}</Button>
      </div>
    </main>
  );
}
