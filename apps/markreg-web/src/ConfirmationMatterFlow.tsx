import type {
  ConfirmationAcknowledgement,
  CustomerConfirmation,
  MatterDraft,
  MatterDraftPreparation,
  PlanQuoteResponse,
  ProfessionalReviewCase,
  FormalMatter
} from '@markorbit/contracts';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  KeyValueList,
  LoadingState,
  Select,
  TextArea,
  TextInput
} from '@markorbit/ui';
import { useEffect, useMemo, useState } from 'react';
import type { MarkregClient } from './api/markreg.js';

export type MatterViewState =
  | 'QUOTE_REVIEW'
  | 'CONFIRMING'
  | 'CONFIRMATION_RECEIPT'
  | 'MATTER_DRAFT_LOADING'
  | 'MATTER_DRAFT_EDITING'
  | 'MATTER_DRAFT_SAVING'
  | 'MATTER_DRAFT_EVALUATING'
  | 'MATTER_DRAFT_NEEDS_INFORMATION'
  | 'READY_FOR_PROFESSIONAL_REVIEW'
  | 'FORMAL_MATTER_CREATING'
  | 'FORMAL_MATTER_RECEIPT'
  | 'RECOVERABLE_ERROR'
  | 'WITHDRAWN';
const acknowledgementLabels = {
  NO_FILING: 'Confirmation does not create a filing.',
  NO_PROFESSIONAL_APPOINTMENT: 'Confirmation does not appoint a professional.',
  REVIEW_MAY_BE_REQUIRED: 'Documents and professional review may still be required.',
  SCOPE_CHANGE_REQUOTE: 'Changed instructions or scope may require a new Quote.'
} as const;
const codes = Object.keys(acknowledgementLabels) as ConfirmationAcknowledgement['code'][];
const format = (minor: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 100);
export interface FlowFixture {
  state: MatterViewState;
  confirmation?: CustomerConfirmation;
  draft?: MatterDraft;
  message?: string;
}
export function ConfirmationMatterFlow({
  quote,
  client,
  fixture
}: {
  quote: PlanQuoteResponse;
  client: MarkregClient;
  fixture?: FlowFixture;
}) {
  const [state, setState] = useState<MatterViewState>(fixture?.state ?? 'QUOTE_REVIEW');
  const [checked, setChecked] = useState<ConfirmationAcknowledgement['code'][]>([]);
  const [confirmation, setConfirmation] = useState(fixture?.confirmation);
  const [matter, setMatter] = useState(fixture?.draft);
  const [message, setMessage] = useState(
    fixture?.message ?? 'Your saved records are unchanged. Try again.'
  );
  const [reviewCase, setReviewCase] = useState<ProfessionalReviewCase>();
  const [formalMatter, setFormalMatter] = useState<FormalMatter>();
  const [savedMessage, setSavedMessage] = useState('');
  const [form, setForm] = useState<MatterDraftPreparation>(
    () => fixture?.draft?.preparation ?? { classes: [], documentReferences: [] }
  );
  const complete = checked.length === codes.length;
  const planId = quote.planSelection.planSelectionId;
  const draftStorageKey = `markreg-matter-draft:${quote.quote.quoteId}`;
  const workspaceId =
    typeof sessionStorage === 'undefined'
      ? undefined
      : (sessionStorage.getItem('markorbit-workspace-id') ?? undefined);
  useEffect(() => {
    if (fixture || !client.getMatterDraft || typeof sessionStorage === 'undefined') return;
    const id = sessionStorage.getItem(draftStorageKey);
    if (!id) return;
    setState('MATTER_DRAFT_LOADING');
    void client
      .getMatterDraft(id)
      .then((response) => {
        setMatter(response.matterDraft);
        setForm(response.matterDraft.preparation);
        setState(
          response.matterDraft.status === 'READY_FOR_PROFESSIONAL_REVIEW'
            ? 'READY_FOR_PROFESSIONAL_REVIEW'
            : 'MATTER_DRAFT_NEEDS_INFORMATION'
        );
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : message);
        setState('RECOVERABLE_ERROR');
      });
  }, [client, draftStorageKey, fixture]);
  useEffect(() => {
    if (fixture || !client.getFormalMatter || typeof sessionStorage === 'undefined') return;
    const id = sessionStorage.getItem(`${draftStorageKey}:formal-matter`);
    if (!id) return;
    void client.getFormalMatter(id).then(({ formalMatter: value }) => {
      setFormalMatter(value);
      setState('FORMAL_MATTER_RECEIPT');
    });
  }, [client, draftStorageKey, fixture]);
  const confirm = async () => {
    setState('CONFIRMING');
    try {
      const at = new Date().toISOString();
      const response = await client.createCustomerConfirmation!({
        quoteId: quote.quote.quoteId,
        quoteVersion: quote.quote.pricingRuleVersion,
        planId,
        planVersion: 'plan-v1',
        customerId: 'customer_markreg',
        termsVersion: 'terms-v1',
        acknowledgements: codes.map((code) => ({ code, acknowledged: true, acknowledgedAt: at })),
        actor: {
          actorId: 'actor_markreg',
          workplaceId: 'workplace_markreg',
          product: 'MARKREG_COM',
          purpose: 'Customer confirms exact Quote snapshot'
        },
        idempotencyKey: `confirmation-${quote.quote.quoteId}`
      });
      setConfirmation(response.confirmation);
      setState('CONFIRMATION_RECEIPT');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : message);
      setState('RECOVERABLE_ERROR');
    }
  };
  const createDraft = async () => {
    if (!confirmation) return;
    setState('MATTER_DRAFT_LOADING');
    try {
      const response = await client.createMatterDraft!(
        confirmation.confirmationId,
        (confirmation as CustomerConfirmation & { version?: number }).version,
        workspaceId
      );
      setMatter(response.matterDraft);
      setForm(response.matterDraft.preparation);
      sessionStorage.setItem(draftStorageKey, response.matterDraft.matterDraftId);
      setState('MATTER_DRAFT_NEEDS_INFORMATION');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : message);
      setState('RECOVERABLE_ERROR');
    }
  };
  const save = async () => {
    if (!matter) return undefined;
    setState('MATTER_DRAFT_SAVING');
    try {
      const response = await client.updateMatterDraft!(
        matter.matterDraftId,
        form,
        (matter as MatterDraft & { version?: number }).version,
        workspaceId
      );
      setMatter(response.matterDraft);
      setSavedMessage(
        `Saved version ${(response.matterDraft as MatterDraft & { version?: number }).version ?? response.matterDraft.updatedAt}`
      );
      setState('MATTER_DRAFT_NEEDS_INFORMATION');
      return response.matterDraft;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : message);
      setState('RECOVERABLE_ERROR');
      return undefined;
    }
  };
  const evaluate = async () => {
    if (!matter) return;
    setState('MATTER_DRAFT_EVALUATING');
    try {
      const saved = await client.updateMatterDraft!(
        matter.matterDraftId,
        form,
        (matter as MatterDraft & { version?: number }).version,
        workspaceId
      );
      const response = await client.evaluateMatterDraft!(
        matter.matterDraftId,
        (saved.matterDraft as MatterDraft & { version?: number }).version,
        workspaceId
      );
      setMatter(response.matterDraft);
      setState(
        response.matterDraft.status === 'READY_FOR_PROFESSIONAL_REVIEW'
          ? 'READY_FOR_PROFESSIONAL_REVIEW'
          : 'MATTER_DRAFT_NEEDS_INFORMATION'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : message);
      setState('RECOVERABLE_ERROR');
    }
  };
  const quoteItems = useMemo(
    () => [
      { key: 'Quote ID', value: quote.quote.quoteId },
      { key: 'Quote version', value: quote.quote.pricingRuleVersion },
      { key: 'Plan identity', value: planId },
      { key: 'Plan version', value: 'plan-v1' },
      ...quote.quote.lines.map((line) => ({
        key: line.description,
        value: format(line.amount.amountMinor, line.amount.currency)
      })),
      { key: 'Total', value: format(quote.quote.total.amountMinor, quote.quote.currency) },
      { key: 'Currency', value: quote.quote.currency },
      { key: 'Terms version', value: 'terms-v1' },
      { key: 'Confirmation status', value: confirmation?.status ?? 'DRAFT' }
    ],
    [quote, confirmation, planId]
  );
  if (state === 'CONFIRMING') return <LoadingState label="Recording your Customer Confirmation" />;
  if (state === 'MATTER_DRAFT_LOADING')
    return <LoadingState label="Loading Matter Draft workspace" />;
  if (state === 'MATTER_DRAFT_EVALUATING')
    return <LoadingState label="Evaluating explicit readiness evidence" />;
  if (state === 'MATTER_DRAFT_SAVING') return <LoadingState label="Saving Matter Draft" />;
  if (state === 'FORMAL_MATTER_CREATING')
    return <LoadingState label="Creating Formal Matter atomically" />;
  if (state === 'FORMAL_MATTER_RECEIPT' && formalMatter)
    return (
      <section role="region" aria-labelledby="formal-matter-receipt">
        <Card>
          <h2 id="formal-matter-receipt">Formal Matter receipt</h2>
          <Alert tone="success" title="Formal Matter created">
            The exact READY Draft was revalidated.
          </Alert>
          <KeyValueList
            items={[
              { key: 'Formal Matter ID', value: formalMatter.formalMatterId },
              { key: 'Initial status', value: formalMatter.status },
              { key: 'Workspace', value: formalMatter.workspaceId },
              {
                key: 'Customer Confirmation',
                value: `${formalMatter.sourceCustomerConfirmationId} · version ${formalMatter.sourceCustomerConfirmationVersion}`
              },
              {
                key: 'Matter Draft',
                value: `${formalMatter.sourceMatterDraftId} · version ${formalMatter.sourceMatterDraftVersion}`
              },
              {
                key: 'Quote',
                value: `${formalMatter.sourceQuoteId} · version ${formalMatter.sourceQuoteVersion}`
              },
              { key: 'Created at', value: formalMatter.createdAt }
            ]}
          />
        </Card>
      </section>
    );
  if (state === 'RECOVERABLE_ERROR')
    return (
      <Alert tone="danger" title="Matter preparation could not continue">
        <p>{message}</p>
        <Button onClick={() => setState(confirmation ? 'CONFIRMATION_RECEIPT' : 'QUOTE_REVIEW')}>
          Try again
        </Button>
      </Alert>
    );
  if (state === 'WITHDRAWN')
    return (
      <Alert tone="warning" title="Customer Confirmation withdrawn">
        A withdrawn confirmation cannot prepare a new Matter Draft.
      </Alert>
    );
  if (state === 'QUOTE_REVIEW')
    return (
      <Card className="customer-confirmation-card">
        <h2>Customer Confirmation</h2>
        <KeyValueList items={quoteItems} />
        <fieldset>
          <legend>Required acknowledgements</legend>
          {codes.map((code) => (
            <Checkbox
              key={code}
              label={acknowledgementLabels[code]}
              checked={checked.includes(code)}
              onChange={(event) =>
                setChecked((value) =>
                  event.target.checked ? [...value, code] : value.filter((item) => item !== code)
                )
              }
            />
          ))}
        </fieldset>
        <Button disabled={!complete} onClick={() => void confirm()}>
          Confirm selected Quote
        </Button>
      </Card>
    );
  if (state === 'CONFIRMATION_RECEIPT' && confirmation)
    return (
      <section role="region" aria-labelledby="confirmation-receipt-heading">
        <Card>
          <h2 id="confirmation-receipt-heading">Confirmation receipt</h2>
          <KeyValueList
            items={[
              { key: 'Confirmation ID', value: confirmation.confirmationId },
              { key: 'Status', value: confirmation.status },
              { key: 'Confirmed at', value: confirmation.confirmedAt },
              { key: 'Quote ID', value: confirmation.quoteSnapshot.quoteId },
              { key: 'Quote version', value: confirmation.quoteSnapshot.quoteVersion },
              {
                key: 'Immutable total',
                value: format(
                  confirmation.quoteSnapshot.totalMinor,
                  confirmation.quoteSnapshot.currency
                )
              },
              { key: 'Terms version', value: confirmation.termsVersion },
              { key: 'Next permitted action', value: 'Prepare Matter Draft' }
            ]}
          />
          <h3>Confirmation consequences</h3>
          <ul aria-label="Confirmation consequences">
            {['Order created', 'Payment created', 'Professional appointed', 'Filing created'].map(
              (label) => (
                <li key={label}>
                  <span>{label}</span> <strong>No</strong>
                </li>
              )
            )}
          </ul>
          <h3>Acknowledgement record</h3>
          <ul>
            {confirmation.acknowledgements.map((a) => (
              <li key={a.code}>
                {acknowledgementLabels[a.code]} — {a.acknowledgedAt}
              </li>
            ))}
          </ul>
          <Alert tone="warning" title="No application has been filed">
            This receipt records commercial confirmation only. It is not an Order, appointment,
            approval, or filing.
          </Alert>
          <Button onClick={() => void createDraft()}>Prepare Matter Draft</Button>
        </Card>
      </section>
    );
  if (!matter) return null;
  const update = <K extends keyof MatterDraftPreparation>(
    key: K,
    value: MatterDraftPreparation[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setState('MATTER_DRAFT_EDITING');
  };
  return (
    <section className="confirmation-matter-flow">
      <Card className="matter-draft-layout">
        <h2>Matter Draft preparation workspace</h2>
        <p>
          Status: <strong>{matter.status}</strong>
        </p>
        <KeyValueList
          items={[
            { key: 'Matter Draft ID', value: matter.matterDraftId },
            {
              key: 'Matter Draft version',
              value: String(
                (matter as MatterDraft & { version?: number }).version ?? matter.updatedAt
              )
            }
          ]}
        />
        <div className="markreg-form">
          <TextInput
            label="Applicant / Owner"
            value={form.applicantName ?? ''}
            onChange={(e) => update('applicantName', e.target.value)}
          />
          <TextInput
            label="Applicant address"
            value={form.applicantAddress ?? ''}
            onChange={(e) => update('applicantAddress', e.target.value)}
          />
          <TextInput
            label="Trademark representation"
            value={form.trademark ?? ''}
            onChange={(e) => update('trademark', e.target.value)}
          />
          <Select
            label="Target jurisdiction"
            value={form.targetJurisdiction ?? ''}
            onChange={(e) => update('targetJurisdiction', e.target.value)}
          >
            <option value="">Select</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="EU">European Union</option>
          </Select>
          <TextInput
            label="Classes"
            value={form.classes.join(', ')}
            onChange={(e) =>
              update('classes', e.target.value.split(',').map(Number).filter(Boolean))
            }
          />
          <TextArea
            label="Goods / services"
            value={form.goodsServices ?? ''}
            onChange={(e) => update('goodsServices', e.target.value)}
          />
          <TextInput
            label="Filing basis"
            value={form.filingBasis ?? ''}
            onChange={(e) => update('filingBasis', e.target.value)}
          />
          <Select
            label="Representative requirement"
            value={
              form.representativeRequired === undefined ? '' : String(form.representativeRequired)
            }
            onChange={(e) => update('representativeRequired', e.target.value === 'true')}
          >
            <option value="">Not evaluated</option>
            <option value="true">Required</option>
            <option value="false">Not required</option>
          </Select>
          <TextInput
            label="Required documents"
            value={form.documentReferences.join(', ')}
            onChange={(e) =>
              update(
                'documentReferences',
                e.target.value ? e.target.value.split(',').map((x) => x.trim()) : []
              )
            }
          />
          <Checkbox
            label="Commercial scope remains unchanged"
            checked={form.commercialScopeUnchanged ?? false}
            onChange={(e) => update('commercialScopeUnchanged', e.target.checked)}
          />
        </div>
        {savedMessage && (
          <Alert tone="success" title="Matter Draft saved">
            {savedMessage}
          </Alert>
        )}
        <h3>Missing information</h3>
        {matter.missingInformation.length ? (
          <ul>
            {matter.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>None.</p>
        )}
        <h3 id="matter-readiness-heading">Readiness checks</h3>
        <section
          className="readiness-check-list"
          role="region"
          aria-labelledby="matter-readiness-heading"
        >
          {matter.readiness.checks.length === 0 && (
            <p>
              <strong>UNKNOWN</strong> — readiness has not yet been evaluated.
            </p>
          )}
          {matter.readiness.checks.map((check) => (
            <section key={check.code}>
              <h4>{check.code}</h4>
              <p>
                <strong>{check.status}</strong> · {check.blocking ? 'Blocking' : 'Non-blocking'}
              </p>
              <p>{check.explanation}</p>
              {check.evidenceReference && <p>Evidence: {check.evidenceReference}</p>}
            </section>
          ))}
        </section>
        {state === 'READY_FOR_PROFESSIONAL_REVIEW' ? (
          <>
            <Alert tone="success" title="Ready for professional review">
              Readiness is not approval, authority, an Order, or a filing. Order created: No ·
              Payment created: No · Professional appointed: No · Filing created: No
            </Alert>
            <p>
              Exact READY Draft version:{' '}
              <strong>{String((matter as MatterDraft & { version?: number }).version)}</strong>
            </p>
            <Button
              onClick={() => {
                if (!confirmation || !workspaceId || !client.createFormalMatter) return;
                const draftVersion = (matter as MatterDraft & { version?: number }).version;
                const confirmationVersion = (
                  confirmation as CustomerConfirmation & { version?: number }
                ).version;
                if (!draftVersion || !confirmationVersion) return;
                setState('FORMAL_MATTER_CREATING');
                void client
                  .createFormalMatter({
                    workspaceId,
                    customerConfirmationId: confirmation.confirmationId,
                    expectedCustomerConfirmationVersion: confirmationVersion,
                    matterDraftId: matter.matterDraftId,
                    expectedMatterDraftVersion: draftVersion,
                    idempotencyKey: `formal-matter:${matter.matterDraftId}:${draftVersion}`
                  })
                  .then(({ formalMatter: value }) => {
                    setFormalMatter(value);
                    sessionStorage.setItem(
                      `${draftStorageKey}:formal-matter`,
                      value.formalMatterId
                    );
                    setState('FORMAL_MATTER_RECEIPT');
                  })
                  .catch((error) => {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : 'Formal Matter creation is unavailable.'
                    );
                    setState('RECOVERABLE_ERROR');
                  });
              }}
            >
              Create Formal Matter
            </Button>
            {!reviewCase ? (
              <Button
                onClick={() =>
                  void client.createProfessionalReview!({
                    matterDraftId: matter.matterDraftId,
                    matterDraftVersion: matter.updatedAt,
                    requestedBy: 'actor_markreg',
                    idempotencyKey: `review:${matter.matterDraftId}:${matter.updatedAt}`
                  }).then((response) => setReviewCase(response.reviewCase))
                }
              >
                Send to Professional Review
              </Button>
            ) : (
              <a
                href={`http://127.0.0.1:4371/?professionalReviewCaseId=${encodeURIComponent(reviewCase.reviewCaseId)}#work-professional-review`}
              >
                Open exact Professional Review in Lite
              </a>
            )}
          </>
        ) : (
          <div className="markreg-actions matter-draft-actions">
            <Button onClick={() => void save()}>Save Matter Draft</Button>
            <Button onClick={() => void evaluate()}>Prepare for professional review</Button>
          </div>
        )}
      </Card>
    </section>
  );
}
