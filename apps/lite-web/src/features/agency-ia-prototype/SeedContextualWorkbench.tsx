import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { PreparedActionJourney } from '@markorbit/contracts/product-loop';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import './seed-contextual-workbench.css';

export type SeedWorkbenchTask =
  | 'SEED_CUSTOMER_REVIEW'
  | 'OPPORTUNITY_REVIEW'
  | 'CLIENT_ACTION_DRAFT';

export type SeedWorkbenchSurfaceState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'permission'
  | 'partial';

export interface SeedWorkbenchContextBrief {
  readonly contextId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly currentness: string;
  readonly evidence: readonly string[];
  readonly authorityNote: string;
}

export interface SeedWorkbenchProposal {
  readonly task: SeedWorkbenchTask;
  readonly contextId: string;
  readonly answer: string;
}

export interface SeedContextualWorkbenchProps {
  readonly task: SeedWorkbenchTask;
  readonly context: Readonly<SeedWorkbenchContextBrief>;
  readonly state?: SeedWorkbenchSurfaceState;
  readonly initialJourney?: Readonly<PreparedActionJourney>;
  readonly structuredReviewHref?: string;
  readonly receiptHref?: string;
  readonly onPrepare?: (
    proposal: Readonly<SeedWorkbenchProposal>
  ) => Promise<Readonly<PreparedActionJourney>>;
  readonly onConfirm?: (
    journey: Readonly<PreparedActionJourney>
  ) => Promise<Readonly<PreparedActionJourney>>;
}

type Turn = Readonly<{ role: 'MO' | 'YOU'; text: string }>;

const taskCopy: Record<
  SeedWorkbenchTask,
  Readonly<{ label: string; question: string; suggestions: readonly string[]; next: string }>
> = {
  SEED_CUSTOMER_REVIEW: {
    label: 'Customer review',
    question: 'How should this organization be treated in your Workspace?',
    suggestions: ['Current client', 'Historical client', 'Not our client'],
    next: 'Continue in structured customer review'
  },
  OPPORTUNITY_REVIEW: {
    label: 'Opportunity review',
    question: 'What should MO prepare for your next professional review?',
    suggestions: ['Review service need', 'Need more evidence', 'Defer for now'],
    next: 'Prepare reviewable opportunity action'
  },
  CLIENT_ACTION_DRAFT: {
    label: 'Client action',
    question: 'What should the client update focus on?',
    suggestions: ['Status change and next step', 'Evidence we still need', 'Deadline and action'],
    next: 'Prepare reviewable client action'
  }
};

function stateBoundary(state: SeedWorkbenchSurfaceState, children: ReactNode): ReactNode {
  if (state === 'loading') return <LoadingState label="Loading work context" />;
  if (state === 'empty')
    return (
      <EmptyState
        title="No work context is available"
        description="Choose a structured record or task before opening the workbench."
      />
    );
  if (state === 'permission')
    return (
      <ErrorState
        title="You do not have access to this context"
        description="No proposal or business state has been changed."
      />
    );
  if (state === 'error')
    return (
      <ErrorState
        title="This work context could not be loaded"
        description="The structured record remains unchanged. Try again when its source is available."
      />
    );
  return children;
}

function resultReference(journey: Readonly<PreparedActionJourney>): string | null {
  return journey.handoffResult?.ownerRecord.id ?? null;
}

export function SeedContextualWorkbench({
  task,
  context,
  state = 'ready',
  initialJourney,
  structuredReviewHref,
  receiptHref,
  onPrepare,
  onConfirm
}: SeedContextualWorkbenchProps) {
  const copy = taskCopy[task];
  const [turns, setTurns] = useState<readonly Turn[]>([{ role: 'MO', text: copy.question }]);
  const [freeText, setFreeText] = useState('');
  const [proposal, setProposal] = useState('');
  const [journey, setJourney] = useState<Readonly<PreparedActionJourney> | undefined>(
    initialJourney
  );
  const [busy, setBusy] = useState<'prepare' | 'confirm' | ''>('');
  const [error, setError] = useState<string | null>(null);

  const committed = journey?.handoffState === 'HANDOFF_COMPLETED';
  const result = useMemo(() => (journey ? resultReference(journey) : null), [journey]);

  const recordAnswer = (answer: string) => {
    const value = answer.trim();
    if (!value) return;
    setProposal(value);
    setTurns((current) => [
      ...current,
      { role: 'YOU', text: value },
      {
        role: 'MO',
        text:
          task === 'SEED_CUSTOMER_REVIEW'
            ? 'I will keep that as a working proposal. Use the structured customer review to commit any relationship change.'
            : 'I will use that only as working context for the reviewable result below.'
      }
    ]);
  };

  const submitFreeText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    recordAnswer(freeText);
    setFreeText('');
  };

  const prepare = async () => {
    if (!proposal || !onPrepare || busy) return;
    setBusy('prepare');
    setError(null);
    try {
      const created = await onPrepare({ task, contextId: context.contextId, answer: proposal });
      setJourney(created);
      setTurns((current) => [
        ...current,
        {
          role: 'MO',
          text: 'A reviewable result is ready. It has not changed business state and still requires structured confirmation.'
        }
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The reviewable result could not be prepared.'
      );
    } finally {
      setBusy('');
    }
  };

  const confirm = async () => {
    if (!journey || !onConfirm || busy) return;
    setBusy('confirm');
    setError(null);
    try {
      const completed = await onConfirm(journey);
      setJourney(completed);
      setTurns((current) => [
        ...current,
        {
          role: 'MO',
          text: 'The structured workflow returned a committed result. The conversation itself did not perform that change.'
        }
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The structured confirmation could not complete.'
      );
    } finally {
      setBusy('');
    }
  };

  return stateBoundary(
    state,
    <section className="seed-contextual-workbench" aria-label="Contextual workbench">
      {state === 'partial' ? (
        <Alert tone="warning" title="Some context is unavailable">
          Available evidence is shown. Missing evidence has not been inferred or treated as empty.
        </Alert>
      ) : null}

      <PageHeader
        title={context.title}
        description={context.subtitle}
        actions={<Badge>{copy.label}</Badge>}
      />

      <div className="seed-contextual-workbench__grid">
        <aside className="seed-contextual-workbench__context" aria-label="Context brief">
          <Card>
            <p className="seed-contextual-workbench__eyebrow">Context brief</p>
            <h2>What MO is working from</h2>
            <p>{context.currentness}</p>
            <ul>
              {context.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Alert tone="info" title="What this does not establish">
              {context.authorityNote}
            </Alert>
          </Card>
        </aside>

        <main className="seed-contextual-workbench__conversation">
          <Card>
            <div className="seed-contextual-workbench__heading">
              <div>
                <p className="seed-contextual-workbench__eyebrow">Conversation</p>
                <h2>Work on this</h2>
              </div>
              <Badge>{turns.length} turns</Badge>
            </div>

            <ol className="seed-contextual-workbench__turns">
              {turns.map((turn, index) => (
                <li
                  key={`${turn.role}-${index}`}
                  className={
                    turn.role === 'MO'
                      ? 'seed-contextual-workbench__turn seed-contextual-workbench__turn--mo'
                      : 'seed-contextual-workbench__turn seed-contextual-workbench__turn--you'
                  }
                >
                  <strong>{turn.role === 'MO' ? 'MO' : 'You'}</strong>
                  <p>{turn.text}</p>
                </li>
              ))}
            </ol>

            <div className="seed-contextual-workbench__suggestions" aria-label="Suggested answers">
              {copy.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="secondary"
                  onClick={() => recordAnswer(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>

            <form className="seed-contextual-workbench__free-text" onSubmit={submitFreeText}>
              <label htmlFor="seed-workbench-answer">Add context in your own words</label>
              <textarea
                id="seed-workbench-answer"
                value={freeText}
                onChange={(event) => setFreeText(event.currentTarget.value)}
                placeholder="Add a bounded instruction or clarification"
                rows={3}
              />
              <Button type="submit" variant="secondary" disabled={!freeText.trim()}>
                Add to working context
              </Button>
            </form>
          </Card>
        </main>

        <aside className="seed-contextual-workbench__working" aria-label="Current working state">
          <Card>
            <p className="seed-contextual-workbench__eyebrow">Current working state</p>
            <h2>{proposal ? 'Working proposal' : 'Waiting for one bounded answer'}</h2>
            <p>
              {proposal ||
                'Conversation is working context only. No customer, opportunity, message or filing state has changed.'}
            </p>

            {task === 'SEED_CUSTOMER_REVIEW' && proposal ? (
              <Alert title="Proposal only">
                This relationship answer is not committed here. Continue in the existing structured
                customer review to record any Workspace relationship.
              </Alert>
            ) : null}

            {task === 'SEED_CUSTOMER_REVIEW' && structuredReviewHref && proposal ? (
              <a className="seed-contextual-workbench__link" href={structuredReviewHref}>
                {copy.next}
              </a>
            ) : null}

            {task !== 'SEED_CUSTOMER_REVIEW' && proposal && !journey ? (
              <Button
                type="button"
                onClick={() => void prepare()}
                disabled={!onPrepare || busy !== ''}
              >
                {busy === 'prepare' ? 'Preparing…' : copy.next}
              </Button>
            ) : null}

            {error ? (
              <Alert tone="warning" title="The structured step did not complete">
                {error}
              </Alert>
            ) : null}

            {journey ? (
              <section className="seed-contextual-workbench__result" aria-label="Prepared result">
                <p className="seed-contextual-workbench__eyebrow">Reviewable action</p>
                <h3>{journey.preparedAction.summary}</h3>
                <Alert title="Confirmation effect">
                  {journey.preparedAction.confirmationEffect}
                </Alert>
                <p>
                  Conversation and proposal remain working context. Only the structured confirmation
                  below can request the existing workflow to commit a result.
                </p>

                {journey.handoffState === 'AWAITING_CONFIRMATION' ? (
                  <Button
                    type="button"
                    onClick={() => void confirm()}
                    disabled={!onConfirm || busy !== ''}
                  >
                    {busy === 'confirm' ? 'Confirming…' : 'Confirm this action'}
                  </Button>
                ) : null}

                {journey.handoffState === 'HANDOFF_PENDING' ? (
                  <Button
                    type="button"
                    onClick={() => void confirm()}
                    disabled={!onConfirm || busy !== ''}
                  >
                    {busy === 'confirm' ? 'Retrying…' : 'Retry structured confirmation'}
                  </Button>
                ) : null}

                {committed ? (
                  <Alert tone="success" title="Committed result">
                    {result ? (
                      <p>Result reference: {result}</p>
                    ) : (
                      <p>The structured workflow returned a committed result.</p>
                    )}
                    {receiptHref ? <a href={receiptHref}>Open result receipt</a> : null}
                  </Alert>
                ) : null}
              </section>
            ) : null}
          </Card>
        </aside>
      </div>
    </section>
  );
}
