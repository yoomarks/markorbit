import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  ProductionIntakeV1,
  ProductionQuoteV1,
  ProductionRecommendationV1,
  UserSelectionV1
} from '@markorbit/contracts/markreg-early-funnel';
import { Alert, Card, ErrorState, KeyValueList, LoadingState } from '@markorbit/ui';
import { useEffect, useRef, useState } from 'react';
import { MarkregApiError } from './api/errors.js';
import { createProductionQuoteClient, type ProductionQuoteClient } from './api/production-quote.js';

type Status =
  | 'creating'
  | 'reading'
  | 'ready'
  | 'prerequisite'
  | 'recoverable-create'
  | 'recoverable-read'
  | 'conflict'
  | 'error';

type Pending = { intent: string; idempotencyKey: string; correlationId: MarkOrbitId };
type Pointer = { quoteId: MarkOrbitId };

const defaultClient = createProductionQuoteClient();
function safeLoad<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}` as MarkOrbitId;

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amountMinor / 100);
}

function isFeeFactsPrerequisite(error: unknown): boolean {
  return (
    error instanceof MarkregApiError &&
    ['PRODUCTION_FEE_FACTS_NOT_FOUND', 'PRODUCTION_FEE_FACTS_STALE'].includes(error.code ?? '')
  );
}

function isRecoverable(error: unknown): boolean {
  return (
    error instanceof MarkregApiError &&
    (error.kind === 'offline' ||
      error.kind === 'recoverable' ||
      error.status === 502 ||
      error.status === 503)
  );
}
function exactLineage(
  quote: ProductionQuoteV1,
  intake: ProductionIntakeV1,
  recommendation: ProductionRecommendationV1,
  selection: UserSelectionV1
): void {
  if (
    quote.workspaceId.toLowerCase() !== intake.workspaceId.toLowerCase() ||
    quote.intake.id !== intake.intakeId ||
    quote.intake.version !== intake.version ||
    quote.intake.fingerprintSha256 !== intake.fingerprintSha256 ||
    quote.recommendation.id !== recommendation.recommendationId ||
    quote.recommendation.version !== recommendation.version ||
    quote.recommendation.fingerprintSha256 !== recommendation.fingerprintSha256 ||
    quote.selection.id !== selection.selectionId ||
    quote.selection.version !== selection.version ||
    quote.selection.fingerprintSha256 !== selection.fingerprintSha256
  ) {
    throw new Error('Production Quote owner readback lineage mismatch.');
  }
}

export function ProductionQuotePanel({
  intake,
  recommendation,
  selection,
  retryToken = '',
  client = defaultClient
}: {
  intake: ProductionIntakeV1;
  recommendation: ProductionRecommendationV1;
  selection: UserSelectionV1;
  retryToken?: string;
  client?: ProductionQuoteClient;
}) {
  const storageBase = `${intake.workspaceId}:${selection.selectionId}:${selection.version}`;
  const pointerKey = `markreg-production-quote-pointer-v1:${storageBase}`;
  const pendingKey = `markreg-production-quote-pending-v1:${storageBase}`;
  const [status, setStatus] = useState<Status>('creating');
  const [quote, setQuote] = useState<ProductionQuoteV1>();
  const [message, setMessage] = useState<string>();
  const [readbackId, setReadbackId] = useState<MarkOrbitId>();
  const lock = useRef(false);
  const retryRef = useRef(retryToken);
  const currentIntent = useRef('');

  const intent = (trigger: string) =>
    [
      intake.intakeId,
      intake.version,
      recommendation.recommendationId,
      recommendation.version,
      selection.selectionId,
      selection.version,
      trigger || 'no-fee-facts-signal'
    ].join(':');

  const pendingFor = (value: string): Pending => {
    const saved = safeLoad<Pending>(pendingKey);
    if (saved?.intent === value) return saved;
    const next = {
      intent: value,
      idempotencyKey: crypto.randomUUID(),
      correlationId: makeId('correlation')
    };
    sessionStorage.setItem(pendingKey, JSON.stringify(next));
    return next;
  };
  const readQuote = async (quoteId: MarkOrbitId) => {
    setReadbackId(quoteId);
    setStatus('reading');
    setMessage(undefined);
    try {
      const envelope = await client.get(quoteId);
      exactLineage(envelope.quote, intake, recommendation, selection);
      setQuote(envelope.quote);
      setStatus('ready');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Production Quote could not be reloaded.'
      );
      setStatus(isRecoverable(error) ? 'recoverable-read' : 'error');
    }
  };

  const createQuote = async (nextIntent: string) => {
    if (lock.current) return;
    lock.current = true;
    currentIntent.current = nextIntent;
    setQuote(undefined);
    setStatus('creating');
    setMessage(undefined);
    const pending = pendingFor(nextIntent);
    try {
      const envelope = await client.create({
        schemaVersion: 1,
        intakeId: intake.intakeId,
        expectedIntakeVersion: intake.version,
        recommendationId: recommendation.recommendationId,
        expectedRecommendationVersion: recommendation.version,
        selectionId: selection.selectionId,
        expectedSelectionVersion: selection.version,
        idempotencyKey: pending.idempotencyKey,
        correlationId: pending.correlationId
      });
      const quoteId = envelope.quote.quoteId;
      sessionStorage.setItem(pointerKey, JSON.stringify({ quoteId } satisfies Pointer));
      sessionStorage.removeItem(pendingKey);
      await readQuote(quoteId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Production Quote could not be created.');
      if (isFeeFactsPrerequisite(error)) setStatus('prerequisite');
      else if (isRecoverable(error)) setStatus('recoverable-create');
      else if (error instanceof MarkregApiError && error.status === 409) setStatus('conflict');
      else setStatus('error');
    } finally {
      lock.current = false;
    }
  };

  useEffect(() => {
    const pointer = safeLoad<Pointer>(pointerKey);
    currentIntent.current = intent(retryToken);
    if (pointer?.quoteId) void readQuote(pointer.quoteId);
    else void createQuote(currentIntent.current);
    // The local pointer contains identity only; material is always loaded from owner truth.
  }, [pointerKey]);

  useEffect(() => {
    if (!retryToken || retryRef.current === retryToken) return;
    retryRef.current = retryToken;
    void createQuote(intent(retryToken));
  }, [retryToken]);

  if (status === 'creating' || status === 'reading') {
    return (
      <Card>
        <LoadingState
          label={status === 'creating' ? 'Preparing governed Quote' : 'Reloading durable Quote'}
        />
      </Card>
    );
  }
  if (status === 'prerequisite') {
    return (
      <Card>
        <ErrorState
          title="Quote needs current application fee facts"
          description="Complete or replace the filing basis and Nice classes above. MarkReg will retry automatically after those facts are saved."
          onRetry={() => void createQuote(currentIntent.current)}
        />
      </Card>
    );
  }

  if (status === 'recoverable-create') {
    return (
      <Card>
        <ErrorState
          title="Quote is temporarily unavailable"
          description={message ?? 'Retry will use the same logical Quote request identity.'}
          onRetry={() => void createQuote(currentIntent.current)}
        />
      </Card>
    );
  }

  if (status === 'recoverable-read' && readbackId) {
    return (
      <Card>
        <ErrorState
          title="Quote saved; durable readback is uncertain"
          description="MarkReg has a Quote identity but could not confirm its owner readback. Retry reloads that exact Quote instead of creating another one."
          onRetry={() => void readQuote(readbackId)}
        />
      </Card>
    );
  }
  if (status === 'conflict') {
    return (
      <Card>
        <ErrorState
          title="Quote inputs changed"
          description="The durable Intake, Recommendation, Selection, or pricing lineage changed. Reload the current owner truth before quoting again."
        />
      </Card>
    );
  }

  if (status === 'error' || !quote) {
    return (
      <Card>
        <ErrorState
          title="Production Quote stopped"
          description={message ?? 'MarkReg stopped safely and did not invent replacement pricing.'}
        />
      </Card>
    );
  }

  return (
    <section aria-labelledby="production-quote-heading">
      <h2 id="production-quote-heading">Governed Production Quote</h2>
      <Alert
        tone={quote.status === 'READY' ? 'success' : 'warning'}
        title={`Quote ${quote.status}`}
      >
        This commercial proposal was read back from MarkReg owner truth. It does not create an
        Order, Payment, Invoice, filing authorization, filing action, professional approval, legal
        conclusion, or Official Truth.
      </Alert>
      <Card>
        <h3>Fee breakdown</h3>
        <KeyValueList
          items={[
            ...quote.lines.map((line) => ({
              key: line.description,
              value: formatMoney(line.amount.amountMinor, line.amount.currency)
            })),
            { key: 'Total', value: formatMoney(quote.total.amountMinor, quote.total.currency) },
            { key: 'Valid until', value: quote.validUntil },
            { key: 'Quote ID', value: quote.quoteId }
          ]}
        />{' '}
        <h3>Assumptions</h3>
        <ul>
          {quote.assumptions.map((item) => (
            <li key={item.code}>{item.text}</li>
          ))}
        </ul>
        <h3>Limitations</h3>
        <ul>
          {quote.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <details>
          <summary>Quote lineage and provenance</summary>
          <KeyValueList
            items={[
              { key: 'Intake', value: `${quote.intake.id} · v${quote.intake.version}` },
              {
                key: 'Recommendation',
                value: `${quote.recommendation.id} · v${quote.recommendation.version}`
              },
              { key: 'Selection', value: `${quote.selection.id} · v${quote.selection.version}` },
              { key: 'Pricing source', value: quote.pricingSource.sourceId },
              { key: 'Created', value: quote.createdAt },
              { key: 'Fingerprint', value: quote.fingerprintSha256 }
            ]}
          />
        </details>
      </Card>
    </section>
  );
}
