import { useEffect, useRef, useState } from 'react';
import type { TradingAiProfileV1 } from '@markorbit/contracts/trading-ai-profile';
import type { TradingCommercialDirectionVersionV1 } from '@markorbit/contracts/trading-commercial-direction';
import type { TradingStudioRunV1 } from '@markorbit/contracts/trading-studio-run';
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
import {
  createTradingStudioClient,
  TradingStudioHttpError,
  type TradingStudioClient,
  type TradingStudioState
} from '../../api/trading-studio.js';
import './trading-studio.css';

export interface TradingStudioProps {
  workspaceId: string;
  studioRunId: TradingStudioRunV1['studioRunId'];
  client?: TradingStudioClient;
}

const roleLabel = {
  BEST_FIT: 'Best Fit',
  VALUE_UP: 'Value Up',
  POSSIBILITY: 'Possibility'
} as const;

const personaLabel = {
  END_CONSUMER: 'End consumer',
  BUSINESS_OPERATOR: 'Business operator',
  TRADEMARK_BUYER: 'Trademark buyer'
} as const;

function CommercialValueMap({ profile }: { profile: Readonly<TradingAiProfileV1> | null }) {
  const insights = profile?.commercialInsights;
  if (!profile)
    return (
      <Alert tone="info" title="Commercial Value Map is not ready">
        Generate the AI Profile checkpoint to create a current, evidence-bounded commercial
        interpretation.
      </Alert>
    );
  if (!insights)
    return (
      <Alert tone="warning" title="Commercial Value Map is unavailable for this profile">
        This earlier AI Profile remains readable, but it does not contain the newer structured
        commercial insights.
      </Alert>
    );

  return (
    <section className="trading-studio__value-map" aria-labelledby="commercial-value-map-title">
      <div className="trading-studio__section-heading">
        <div>
          <p className="trading-studio__eyebrow">AI inference · Version {profile.version}</p>
          <h2 id="commercial-value-map-title">Commercial Value Map</h2>
          <p>
            A qualitative view of who may value this Trademark Asset, what could matter to them, and
            which evidence or assumptions support the interpretation.
          </p>
        </div>
        <Badge>Evidence coverage: {insights.evidenceCoverage.toLowerCase()}</Badge>
      </div>

      <div className="trading-studio__persona-grid" aria-label="Commercial audiences">
        {insights.personas.map((persona) => (
          <Card key={persona.commercialPersonaId} className="trading-studio__insight-card">
            <Badge>{personaLabel[persona.kind]}</Badge>
            <h3>{persona.label}</h3>
            <p>{persona.summary}</p>
            {persona.desiredOutcomes?.length ? (
              <>
                <h4>Desired outcomes</h4>
                <ul>
                  {persona.desiredOutcomes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="trading-studio__map-columns">
        <section aria-labelledby="selling-points-title">
          <h3 id="selling-points-title">Selling points</h3>
          {insights.sellingPoints.length ? (
            <ul className="trading-studio__detail-list">
              {insights.sellingPoints.map((point) => (
                <li key={point.sellingPointId}>
                  <strong>{point.label}</strong>
                  <span>{point.description}</span>
                  <small>{point.basisType.replaceAll('_', ' ').toLowerCase()}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No supported selling points were produced.</p>
          )}
        </section>
        <section aria-labelledby="buying-points-title">
          <h3 id="buying-points-title">Buying points</h3>
          {insights.buyingPoints.length ? (
            <ul className="trading-studio__detail-list">
              {insights.buyingPoints.map((point) => (
                <li key={point.buyingPointId}>
                  <strong>{point.label}</strong>
                  <span>{point.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No supported buying points were produced.</p>
          )}
        </section>
        <section aria-labelledby="scenarios-title">
          <h3 id="scenarios-title">Commercial scenarios</h3>
          {insights.scenarios.length ? (
            <ul className="trading-studio__detail-list">
              {insights.scenarios.map((scenario) => (
                <li key={scenario.commercialScenarioId}>
                  <strong>{scenario.label}</strong>
                  <span>{scenario.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No supported scenarios were produced.</p>
          )}
        </section>
      </div>

      <div className="trading-studio__evidence">
        <section aria-labelledby="evidence-title">
          <h3 id="evidence-title">Evidence basis</h3>
          {insights.evidenceBasis.length ? (
            <ul>
              {insights.evidenceBasis.map((evidence) => (
                <li key={evidence.commercialEvidenceId}>
                  <strong>{evidence.label}</strong> · {evidence.sourceType}
                  {evidence.description ? ` — ${evidence.description}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>No direct evidence basis was supplied.</p>
          )}
        </section>
        <section aria-labelledby="assumptions-title">
          <h3 id="assumptions-title">Assumptions and limits</h3>
          {insights.assumptions.length || insights.limits?.length ? (
            <ul>
              {insights.assumptions.map((assumption) => (
                <li key={assumption.commercialAssumptionId}>
                  <strong>{assumption.label}</strong> — {assumption.description}
                </li>
              ))}
              {insights.limits?.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          ) : (
            <p>No additional assumptions or limits were supplied.</p>
          )}
        </section>
      </div>
      <p className="trading-studio__boundary">
        This map is AI inference, not Trademark Truth, verified market demand, valuation, or a
        probability of commercial success.
      </p>
    </section>
  );
}

function failureMessage(error: unknown): { title: string; description: string } {
  if (error instanceof TradingStudioHttpError && (error.status === 401 || error.status === 403))
    return {
      title: 'Studio access unavailable',
      description:
        'Your current session does not have permission to view or select these directions.'
    };
  if (error instanceof TradingStudioHttpError && error.status === 409)
    return {
      title: 'Studio state changed',
      description: 'Reload current Studio truth before making a selection.'
    };
  return {
    title: 'Studio unavailable',
    description:
      'The current Studio state could not be loaded. Your existing work has not been changed.'
  };
}

export function TradingStudio({ workspaceId, studioRunId, client }: TradingStudioProps) {
  const api = client ?? createTradingStudioClient(workspaceId);
  const [state, setState] = useState<TradingStudioState>();
  const [error, setError] = useState<unknown>();
  const [selecting, setSelecting] = useState<string>();
  const selectionKeys = useRef(new Map<string, string>());

  const load = async () => {
    setError(undefined);
    try {
      setState(await api.loadState(studioRunId));
    } catch (cause) {
      setError(cause);
    }
  };

  useEffect(() => {
    void load();
  }, [studioRunId]);

  const choose = async (direction: Readonly<TradingCommercialDirectionVersionV1>) => {
    if (!state?.directionSet || selecting || state.run.currentness !== 'CURRENT') return;
    setSelecting(direction.commercialDirectionId);
    setError(undefined);
    const signature = `${state.directionSet.commercialDirectionSetId}:${state.directionSet.version}:${direction.commercialDirectionId}:${direction.version}`;
    const operationId = selectionKeys.current.get(signature) ?? crypto.randomUUID();
    selectionKeys.current.set(signature, operationId);
    try {
      await api.selectDirection({
        schemaVersion: 1,
        directionSetId: state.directionSet.commercialDirectionSetId,
        expectedDirectionSetVersion: state.directionSet.version,
        selectedDirectionId: direction.commercialDirectionId,
        expectedDirectionVersion: direction.version,
        idempotencyKey: `direction-selection:${operationId}`,
        correlationId: `correlation_${operationId}`
      });
      const refreshed = await api.loadState(studioRunId);
      if (
        refreshed.selection?.selectedDirection.id !== direction.commercialDirectionId ||
        refreshed.selection.selectedDirection.version !== direction.version
      )
        throw new TradingStudioHttpError(
          409,
          'DURABLE_SELECTION_NOT_VISIBLE',
          'The Selection write completed but current owner state does not confirm it.'
        );
      selectionKeys.current.delete(signature);
      setState(refreshed);
    } catch (cause) {
      setError(cause);
    } finally {
      setSelecting(undefined);
    }
  };

  if (!state && !error) return <LoadingState label="Loading current Studio directions" />;
  if (!state && error) {
    const message = failureMessage(error);
    return <ErrorState {...message} onRetry={() => void load()} />;
  }
  if (!state) return null;

  if (state.directionSet && state.directionSet.directions.length !== 3)
    return (
      <ErrorState
        title="Incomplete direction set"
        description="The owner returned partial direction data. No selection can be made until all three roles are available."
        onRetry={() => void load()}
      />
    );

  const selected = state.selection?.selectedDirection;
  const stale = state.run.currentness === 'STALE';
  const mutationError = error ? failureMessage(error) : undefined;

  return (
    <main className="trading-studio">
      <PageHeader
        title="Orbit Studio directions"
        description="Compare three AI concepts for this exact Trademark Asset version. Only your explicit choice creates a Selection."
        actions={
          <Badge>
            {stale ? 'Source changed' : selected ? 'Direction selected' : 'Awaiting your choice'}
          </Badge>
        }
      />
      {stale && (
        <Alert tone="warning" title="Source version is stale">
          These concepts remain visible for reference, but selection is locked until current owner
          truth is loaded.
        </Alert>
      )}
      {mutationError && (
        <Alert tone="danger" title={mutationError.title}>
          {mutationError.description}
        </Alert>
      )}
      <CommercialValueMap profile={state.aiProfile ?? null} />
      {!state.directionSet ? (
        <EmptyState
          title="Directions are not ready"
          description="This run has not produced a complete current Direction Set. Resume remains unavailable on this screen."
        />
      ) : (
        <div className="trading-studio__directions" aria-label="Commercial directions">
          {state.directionSet.directions.map((direction) => {
            const isSelected =
              selected?.id === direction.commercialDirectionId &&
              selected.version === direction.version;
            return (
              <Card
                key={`${direction.commercialDirectionId}:${direction.version}`}
                className={
                  isSelected ? 'trading-studio__direction is-selected' : 'trading-studio__direction'
                }
              >
                <div className="trading-studio__direction-heading">
                  <Badge>{roleLabel[direction.role]}</Badge>
                  <span>Version {direction.version}</span>
                </div>
                <h2>{direction.title}</h2>
                <p>{direction.summary}</p>
                <h3>Why it could work</h3>
                <p>{direction.rationale}</p>
                <h3>Constraints</h3>
                <ul>
                  {direction.constraints.map((constraint) => (
                    <li key={constraint}>{constraint}</li>
                  ))}
                </ul>
                <Button
                  variant={isSelected ? 'secondary' : 'primary'}
                  disabled={stale || Boolean(selecting) || isSelected}
                  onClick={() => void choose(direction)}
                >
                  {isSelected
                    ? 'Selected'
                    : selecting === direction.commercialDirectionId
                      ? 'Recording choice…'
                      : `Choose ${roleLabel[direction.role]}`}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
      <p className="trading-studio__boundary">
        Directions are AI concepts, not Trademark Truth. Selection does not start Deep Build or
        create a Listing. Refinement is not yet available through a governed execution boundary.
      </p>
    </main>
  );
}
