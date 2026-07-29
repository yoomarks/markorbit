import type {
  IntakeCreateCommand,
  IntakeRecommendationResponse,
  MarkOrbitId,
  PlanQuoteResponse,
  PlanOptionCode,
  ProfessionalReviewCase,
  PreparationLock
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
import { ConfirmationMatterFlow } from './ConfirmationMatterFlow.js';
import { ConnectedDocumentsInstructionsWorkspace } from './DocumentsInstructionsWorkspace.js';
import { FilingAuthorizationView } from './FilingAuthorization.js';

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

const defaultMarkregClient = createMarkregClient();
export function MarkregApp({ client = defaultMarkregClient }: { client?: MarkregClient }) {
  const reviewCaseId = new URLSearchParams(window.location.search).get('professionalReviewCaseId');
  const preparationLockId = new URLSearchParams(window.location.search).get('preparationLockId');
  const [authorizationLock, setAuthorizationLock] = useState<PreparationLock>();
  const [completedReview, setCompletedReview] = useState<ProfessionalReviewCase>();
  const [reviewLoading, setReviewLoading] = useState(Boolean(reviewCaseId));
  const [preparationOpen, setPreparationOpen] = useState(false);
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
  useEffect(() => {
    if (!reviewCaseId || !client.getProfessionalReview) return;
    void client
      .getProfessionalReview(reviewCaseId)
      .then(({ reviewCase }) => setCompletedReview(reviewCase))
      .finally(() => setReviewLoading(false));
  }, [client, reviewCaseId]);
  useEffect(() => {
    if (!preparationLockId || !client.getPreparationLock) return;
    void client.getPreparationLock(preparationLockId).then(setAuthorizationLock);
  }, [client, preparationLockId]);
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

  if (preparationLockId && !authorizationLock)
    return <LoadingState label="Loading Preparation Lock for Filing Authorization" />;
  if (authorizationLock)
    return <FilingAuthorizationView client={client} preparationLock={authorizationLock} />;
  if (reviewLoading)
    return (
      <main className="markreg-page">
        <LoadingState label="Loading completed Professional Review" />
      </main>
    );
  if (completedReview?.status === 'REVIEWED_READY_FOR_NEXT_STEP') {
    if (preparationOpen)
      return <ConnectedDocumentsInstructionsWorkspace client={client} review={completedReview} />;
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <PageHeader
          title="Professional Review complete"
          description="The exact reviewed source is ready for governed document and instruction preparation."
        />
        <Card>
          <KeyValueList
            items={[
              { key: 'Review Case', value: completedReview.reviewCaseId },
              { key: 'Decision version', value: completedReview.decision?.decidedAt ?? '' },
              { key: 'Matter Draft version', value: completedReview.source.matterDraftVersion }
            ]}
          />
          <Button onClick={() => setPreparationOpen(true)}>Open Documents and Instructions</Button>
          <p>Preparation Lock ≠ Filing Submission.</p>
        </Card>
      </main>
    );
  }
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
      <Recommendation
        result={result}
        draft={draft}
        selected={selected}
        onSelect={setSelected}
        client={client}
      />
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
  onSelect,
  client
}: {
  result: IntakeRecommendationResponse;
  draft: IntakeDraft;
  selected: string | undefined;
  onSelect: (v: string) => void;
  client: MarkregClient;
}) {
  const recommended = 'B';
  const [quote, setQuote] = useState<PlanQuoteResponse | undefined>(() => load('markreg-quote-v1'));
  const [quoteState, setQuoteState] = useState<
    'plan' | 'submitting' | 'ready' | 'confirming' | 'confirmed' | 'recoverable' | 'blocking'
  >(quote ? 'ready' : 'plan');
  const [quoteMessage, setQuoteMessage] = useState('');
  const quoteRequest = useRef<{ option: string; key: string; correlation: MarkOrbitId }>();
  const confirming = useRef(false);
  const requestQuote = async () => {
    if (!selected || quoteState === 'submitting') return;
    if (!quoteRequest.current || quoteRequest.current.option !== selected)
      quoteRequest.current = {
        option: selected,
        key: crypto.randomUUID(),
        correlation: makeId('correlation')
      };
    setQuoteState('submitting');
    try {
      const value = await client.createQuote!({
        intakeId: result.intake.intakeId,
        recommendationId: result.recommendation.recommendationId,
        selectedOptionCode: selected as PlanOptionCode,
        actor: {
          actorId: makeId('actor'),
          workplaceId: makeId('workplace'),
          product: 'MARKREG_COM',
          purpose: 'Request fixture quote'
        },
        idempotencyKey: quoteRequest.current.key,
        correlationId: quoteRequest.current.correlation
      });
      setQuote(value);
      sessionStorage.setItem('markreg-quote-v1', JSON.stringify(value));
      setQuoteState('ready');
    } catch (error) {
      const safe =
        error instanceof MarkregApiError
          ? error
          : new MarkregApiError('blocking', 'We could not complete this request safely.');
      setQuoteMessage(safe.message);
      setQuoteState(safe.kind === 'blocking' ? 'blocking' : 'recoverable');
    }
  };
  const confirm = async () => {
    if (!quote || confirming.current) return;
    confirming.current = true;
    setQuoteState('confirming');
    try {
      await client.confirmQuote!({
        quoteId: quote.quote.quoteId,
        actor: {
          actorId: makeId('actor'),
          workplaceId: makeId('workplace'),
          product: 'MARKREG_COM',
          purpose: 'Confirm quote intent'
        },
        idempotencyKey: `confirm-${quote.quote.quoteId}`,
        correlationId: makeId('correlation')
      });
      setQuoteState('confirmed');
    } catch (error) {
      const safe =
        error instanceof MarkregApiError
          ? error
          : new MarkregApiError('blocking', 'We could not confirm this quote safely.');
      setQuoteMessage(safe.message);
      setQuoteState(safe.kind === 'blocking' ? 'blocking' : 'recoverable');
    } finally {
      confirming.current = false;
    }
  };
  const format = (amountMinor: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency }).format(amountMinor / 100);
  if (quoteState === 'submitting' || quoteState === 'confirming')
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <LoadingState
          label={
            quoteState === 'submitting'
              ? 'Preparing your fixture quote'
              : 'Recording your quote confirmation'
          }
        />
      </main>
    );
  if (quoteState === 'blocking')
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <ErrorState title="Quote cannot continue" description={quoteMessage} />
      </main>
    );
  if (quoteState === 'recoverable')
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <ErrorState
          title="Your plan selection is safe"
          description={quoteMessage}
          onRetry={() => void (quote ? confirm() : requestQuote())}
        />
      </main>
    );
  if (quoteState === 'confirmed')
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <PageHeader title="Quote confirmed" description="Pending professional review" />
        <Alert tone="warning" title="Confirmation records intent only">
          No order has been created. No payment has been made. No filing has started.
        </Alert>
      </main>
    );
  if (quote)
    return (
      <main className="markreg-page">
        <FixtureBanner />
        <Stepper current={3} steps={['Your goal', 'Recommendation', 'Plan', 'Quote']} />
        <PageHeader
          title="Review your fixture quote"
          description={`Selected plan ${quote.quote.selectedOptionCode}`}
        />
        <Alert tone="warning" title="Estimate only">
          Estimate only — official fees, professional fees and disbursements require review before
          filing.
        </Alert>
        <Alert tone="warning" title="Demonstration only">
          Demonstration only — not legal advice or an official filing recommendation.
        </Alert>
        <Card>
          <h2>Fee breakdown</h2>
          <KeyValueList
            items={[
              ...quote.quote.lines.map((line) => ({
                key: line.description,
                value: format(line.amount.amountMinor, line.amount.currency)
              })),
              {
                key: 'Subtotal',
                value: format(quote.quote.subtotal.amountMinor, quote.quote.currency)
              },
              { key: 'Total', value: format(quote.quote.total.amountMinor, quote.quote.currency) },
              { key: 'Currency', value: quote.quote.currency },
              { key: 'Valid until', value: quote.quote.validUntil },
              { key: 'Fixture only', value: quote.quote.fixtureOnly ? 'Yes' : 'No' }
            ]}
          />
          <h3>Assumptions</h3>
          <ul>
            {quote.quote.assumptions.map((a) => (
              <li key={a.code}>{a.text}</li>
            ))}
          </ul>
          <h3>Limitations</h3>
          <ul>
            {quote.quote.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Card>
        <ConfirmationMatterFlow quote={quote} client={client} />
      </main>
    );
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
        <Button disabled={!selected} onClick={() => void requestQuote()}>
          Select plan {selected ?? ''} and request quote
        </Button>
      </div>
    </main>
  );
}
