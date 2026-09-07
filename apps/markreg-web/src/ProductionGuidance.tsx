import type { MarkOrbitId, PlanOptionCode } from '@markorbit/contracts';
import type {
  ProductionIntakeV1,
  ProductionRecommendationV1,
  UserSelectionV1
} from '@markorbit/contracts/markreg-early-funnel';
import { Alert, Button, Card, ErrorState, KeyValueList, LoadingState } from '@markorbit/ui';
import { useEffect, useRef, useState } from 'react';
import { MarkregApiError } from './api/errors.js';
import {
  createProductionGuidanceClient,
  type ProductionGuidanceClient
} from './api/production-guidance.js';

interface PendingIntent {
  intent: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

type Operation =
  'idle' | 'recommendation-create' | 'recommendation-read' | 'selection-create' | 'selection-read';

type FailureStage = Operation;
type FailureAction = 'retry' | 'reload-intake' | 'reload-recommendation' | 'none';
interface GuidanceFailure {
  stage: FailureStage;
  action: FailureAction;
  title: string;
  description: string;
}

function safeLoad<T>(key: string): T | undefined {
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : undefined;
  } catch {
    return undefined;
  }
}

const makeCorrelationId = () => `correlation_${crypto.randomUUID()}` as MarkOrbitId;

function pendingIntent(key: string, intent: string): PendingIntent {
  const saved = safeLoad<PendingIntent>(key);
  if (saved?.intent === intent) return saved;
  const pending = {
    intent,
    idempotencyKey: crypto.randomUUID(),
    correlationId: makeCorrelationId()
  };
  sessionStorage.setItem(key, JSON.stringify(pending));
  return pending;
}
function failureFor(error: unknown, stage: FailureStage): GuidanceFailure {
  const reading = stage === 'recommendation-read' || stage === 'selection-read';
  const selection = stage === 'selection-create' || stage === 'selection-read';
  if (!(error instanceof MarkregApiError))
    return {
      stage,
      action: reading ? 'retry' : 'none',
      title: 'Production guidance could not be completed',
      description: 'MarkReg stopped safely. No fixture or generic AI guidance will be substituted.'
    };

  if (error.status === 409)
    return {
      stage,
      action: selection ? 'reload-recommendation' : 'reload-intake',
      title: 'Owner truth changed',
      description: selection
        ? 'Reload the governed Recommendation before recording a customer choice.'
        : 'Reload the durable Intake before generating a Recommendation from its current version.'
    };

  if (error.status === 422)
    return {
      stage,
      action: 'none',
      title: selection ? 'Selection is unavailable' : 'Guidance is unavailable for this Intake',
      description: selection
        ? 'This choice cannot be recorded against the current Recommendation. No alternate state will be invented.'
        : 'The governed source did not produce applicable Recommendation material. No fixture or generic AI fallback will be used.'
    };
  if (error.kind === 'offline' || error.kind === 'recoverable' || error.status === 503)
    return {
      stage,
      action: 'retry',
      title: 'Production guidance is temporarily unavailable',
      description: reading
        ? 'Retry the durable owner read. MarkReg will not create a replacement artifact.'
        : 'Retry this same intent with the same Idempotency-Key. No duplicate artifact should be created.'
    };

  return {
    stage,
    action: reading ? 'retry' : 'none',
    title: error.status === 403 ? 'Workspace permission required' : 'Production guidance stopped',
    description:
      error.status === 401
        ? 'Sign in again before continuing this production flow.'
        : error.status === 403
          ? 'Your current Workspace role cannot perform this action.'
          : 'MarkReg did not complete this action safely. No fallback guidance is shown.'
  };
}

const defaultClient = createProductionGuidanceClient();

export function ProductionGuidance({
  intake,
  client = defaultClient,
  onReloadIntake
}: {
  intake: ProductionIntakeV1;
  client?: ProductionGuidanceClient;
  onReloadIntake: () => void;
}) {
  const storageBase = `${intake.workspaceId}:${intake.intakeId}`;
  const recommendationPointerKey = `markreg-production-recommendation-pointer-v1:${storageBase}`;
  const selectionPointerKey = `markreg-production-selection-pointer-v1:${storageBase}`;
  const recommendationPendingKey = `markreg-production-recommendation-pending-v1:${storageBase}`;
  const selectionPendingKey = `markreg-production-selection-pending-v1:${storageBase}`;
  const initialRecommendationId = safeLoad<MarkOrbitId>(recommendationPointerKey);
  const [recommendation, setRecommendation] = useState<ProductionRecommendationV1>();
  const [selection, setSelection] = useState<UserSelectionV1>();
  const [selectedOptionCode, setSelectedOptionCode] = useState<PlanOptionCode>();
  const [operation, setOperation] = useState<Operation>(
    initialRecommendationId ? 'recommendation-read' : 'idle'
  );
  const [failure, setFailure] = useState<GuidanceFailure>();
  const createLock = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (failure) requestAnimationFrame(() => errorRef.current?.focus());
  }, [failure]);

  const readSelection = async (selectionId: MarkOrbitId, expected: ProductionRecommendationV1) => {
    setOperation('selection-read');
    setFailure(undefined);
    try {
      const envelope = await client.getSelection(selectionId);
      if (envelope.selection.recommendation.id !== expected.recommendationId)
        throw new Error('Selection Recommendation lineage mismatch.');
      setSelection(envelope.selection);
      setSelectedOptionCode(envelope.selection.selectedOptionCode);
      setOperation('idle');
    } catch (error) {
      setFailure(failureFor(error, 'selection-read'));
      setOperation('idle');
    }
  };
  const readRecommendation = async (recommendationId: MarkOrbitId) => {
    setOperation('recommendation-read');
    setFailure(undefined);
    try {
      const envelope = await client.getRecommendation(recommendationId);
      const next = envelope.recommendation;
      if (next.workspaceId !== intake.workspaceId || next.intake.id !== intake.intakeId)
        throw new Error('Recommendation Intake lineage mismatch.');
      setRecommendation(next);
      setSelection(undefined);
      setSelectedOptionCode(undefined);
      const selectionId = safeLoad<MarkOrbitId>(selectionPointerKey);
      if (selectionId) await readSelection(selectionId, next);
      else setOperation('idle');
    } catch (error) {
      setFailure(failureFor(error, 'recommendation-read'));
      setOperation('idle');
    }
  };

  useEffect(() => {
    if (initialRecommendationId) void readRecommendation(initialRecommendationId);
    // IDs are local navigation pointers only; artifact material always comes from owner GET.
  }, []);

  const recommendationIntent = `${intake.intakeId}:${intake.version}:${intake.fingerprintSha256}`;
  const createRecommendation = async () => {
    if (createLock.current) return;
    createLock.current = true;
    setOperation('recommendation-create');
    setFailure(undefined);
    const pending = pendingIntent(recommendationPendingKey, recommendationIntent);
    try {
      const envelope = await client.createRecommendation({
        schemaVersion: 1,
        intakeId: intake.intakeId,
        expectedIntakeVersion: intake.version,
        expectedIntakeFingerprintSha256: intake.fingerprintSha256,
        idempotencyKey: pending.idempotencyKey,
        correlationId: pending.correlationId
      });
      const recommendationId = envelope.recommendation.recommendationId;
      sessionStorage.setItem(recommendationPointerKey, JSON.stringify(recommendationId));
      sessionStorage.removeItem(recommendationPendingKey);
      await readRecommendation(recommendationId);
    } catch (error) {
      setFailure(failureFor(error, 'recommendation-create'));
      setOperation('idle');
    } finally {
      createLock.current = false;
    }
  };

  const createSelection = async () => {
    if (!recommendation || !selectedOptionCode || createLock.current) return;
    createLock.current = true;
    setOperation('selection-create');
    setFailure(undefined);
    const intent = `${recommendation.recommendationId}:${recommendation.version}:${selectedOptionCode}`;
    const pending = pendingIntent(selectionPendingKey, intent);
    try {
      const envelope = await client.createSelection({
        schemaVersion: 1,
        recommendationId: recommendation.recommendationId,
        expectedRecommendationVersion: recommendation.version,
        selectedOptionCode,
        idempotencyKey: pending.idempotencyKey,
        correlationId: pending.correlationId
      });
      const selectionId = envelope.selection.selectionId;
      sessionStorage.setItem(selectionPointerKey, JSON.stringify(selectionId));
      sessionStorage.removeItem(selectionPendingKey);
      await readSelection(selectionId, recommendation);
    } catch (error) {
      setFailure(failureFor(error, 'selection-create'));
      setOperation('idle');
    } finally {
      createLock.current = false;
    }
  };
  const retryFailure = () => {
    if (!failure) return;
    if (failure.stage === 'recommendation-create') void createRecommendation();
    else if (failure.stage === 'recommendation-read') {
      const id = safeLoad<MarkOrbitId>(recommendationPointerKey);
      if (id) void readRecommendation(id);
    } else if (failure.stage === 'selection-create') void createSelection();
    else if (failure.stage === 'selection-read' && recommendation) {
      const id = safeLoad<MarkOrbitId>(selectionPointerKey);
      if (id) void readSelection(id, recommendation);
    }
  };

  const reloadRecommendation = () => {
    if (!recommendation) return;
    sessionStorage.removeItem(selectionPendingKey);
    void readRecommendation(recommendation.recommendationId);
  };

  const busy = operation !== 'idle';
  const selectedOption = recommendation?.options.find(
    (option) => option.code === (selection?.selectedOptionCode ?? selectedOptionCode)
  );

  return (
    <section className="production-guidance" aria-labelledby="production-guidance-heading">
      <h2 id="production-guidance-heading">Governed strategy guidance</h2>
      {failure && (
        <div
          ref={errorRef}
          tabIndex={-1}
          aria-live="assertive"
          className="production-guidance-error"
        >
          <ErrorState
            title={failure.title}
            description={failure.description}
            {...(failure.action === 'retry' ? { onRetry: retryFailure } : {})}
          />
          {failure.action === 'reload-intake' && (
            <Button variant="secondary" onClick={onReloadIntake}>
              Reload Intake truth
            </Button>
          )}
          {failure.action === 'reload-recommendation' && (
            <Button variant="secondary" onClick={reloadRecommendation}>
              Reload Recommendation truth
            </Button>
          )}
        </div>
      )}
      {operation === 'recommendation-read' && !recommendation && (
        <LoadingState label="Reloading governed Recommendation" />
      )}
      {!recommendation && operation !== 'recommendation-read' && (
        <Card>
          <h3>Next: generate your governed Recommendation</h3>
          <p>
            MarkReg will use the exact durable Intake version and fingerprint shown above. The
            browser does not choose a Capability, method, model, provider, or source.
          </p>
          <Alert tone="warning" title="Strategy guidance for review">
            A Recommendation is guidance, not legal or professional approval and not filing
            authorization.
          </Alert>
          {intake.status === 'RECEIVED' ? (
            <Button disabled={busy} onClick={() => void createRecommendation()}>
              {operation === 'recommendation-create'
                ? 'Generating Recommendation...'
                : 'Generate governed Recommendation'}
            </Button>
          ) : (
            <Alert tone="warning" title="Recommendation identity is not held by this page">
              The Intake is already marked {intake.status}. Reload from a page or navigation state
              that retains the durable Recommendation ID rather than generating a replacement.
            </Alert>
          )}
        </Card>
      )}
      {recommendation && (
        <>
          <Alert tone="success" title="Governed Recommendation ready">
            These options are the exact owner-returned strategy guidance. Review them before making
            a customer choice; no option is selected automatically.
          </Alert>
          <Card>
            <KeyValueList
              items={[
                { key: 'Recommendation', value: recommendation.recommendationId },
                { key: 'Version', value: recommendation.version },
                {
                  key: 'Owner status',
                  value: recommendation.currentness === 'CURRENT' ? 'Current' : 'Stale'
                },
                {
                  key: 'Governed source status',
                  value:
                    recommendation.source.currentness === 'CURRENT'
                      ? 'Current production-admissible source'
                      : 'Source is not current'
                }
              ]}
            />
            <h3>Why these options</h3>
            <p>{recommendation.rationale}</p>
            <fieldset className="production-guidance-options" disabled={busy || Boolean(selection)}>
              <legend>Choose one strategy option</legend>
              {recommendation.options.map((option) => (
                <label className="production-guidance-option" key={option.code}>
                  <input
                    type="radio"
                    name="production-guidance-option"
                    value={option.code}
                    checked={(selection?.selectedOptionCode ?? selectedOptionCode) === option.code}
                    onChange={() => {
                      setSelectedOptionCode(option.code);
                      setFailure(undefined);
                    }}
                  />
                  <span>
                    <strong>
                      {option.code} - {option.title}
                    </strong>
                    <span>{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="production-guidance-notes">
              <h3>Assumptions</h3>
              <ul>
                {recommendation.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3>Limitations</h3>
              <ul>
                {recommendation.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {!selection && (
              <div className="production-guidance-actions">
                <Button
                  disabled={busy || !selectedOptionCode}
                  onClick={() => void createSelection()}
                >
                  {operation === 'selection-create' ? 'Recording choice...' : 'Record this choice'}
                </Button>
              </div>
            )}
          </Card>
          {(operation === 'selection-read' || operation === 'selection-create') && !selection && (
            <LoadingState
              label={
                operation === 'selection-read'
                  ? 'Reloading durable customer Selection'
                  : 'Recording durable customer Selection'
              }
            />
          )}
          {selection && (
            <Alert tone="success" title="Customer selection recorded">
              <KeyValueList
                items={[
                  {
                    key: 'Selected option',
                    value: `${selection.selectedOptionCode} - ${selectedOption?.title ?? ''}`
                  },
                  { key: 'Selection ID', value: selection.selectionId },
                  { key: 'Version', value: selection.version },
                  { key: 'Status', value: selection.status },
                  { key: 'Recorded', value: selection.selectedAt }
                ]}
              />
              <p>
                This receipt records customer choice only. It does not create a Quote, Order,
                Matter, Payment, filing authorization or submission, provider action, legal or
                professional approval, or Official Truth.
              </p>
            </Alert>
          )}
          <Alert tone="warning" title="Authority remains bounded">
            Recommendation means strategy guidance for review. Selection means customer choice only.
            Neither authorizes filing or any protected downstream action.
          </Alert>
        </>
      )}
    </section>
  );
}
