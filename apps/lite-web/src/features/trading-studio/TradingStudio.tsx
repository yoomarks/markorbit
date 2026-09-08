import { useEffect, useRef, useState } from 'react';
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

  if (!state.directionSet)
    return (
      <EmptyState
        title="Directions are not ready"
        description="This run has not produced a complete current Direction Set. Resume remains unavailable on this screen."
      />
    );

  if (state.directionSet.directions.length !== 3)
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
      <p className="trading-studio__boundary">
        Directions are AI concepts, not Trademark Truth. Selection does not start Deep Build or
        create a Listing. Refinement is not yet available through a governed execution boundary.
      </p>
    </main>
  );
}
