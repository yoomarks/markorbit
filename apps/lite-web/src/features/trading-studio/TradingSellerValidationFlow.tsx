import { useMemo, useState } from 'react';
import type { TradingStudioState } from '../../api/trading-studio.js';
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from '@markorbit/ui';
import './trading-seller-validation.css';

export type SellerValidationStage = 'DEEP_BUILD' | 'LISTING_PREVIEW' | 'DESTINATIONS';

export interface TradingSellerDestinationProjection {
  id: string;
  label: string;
  state: 'READY' | 'CONNECTED' | 'NEEDS_ATTENTION';
  note: string;
}

export interface TradingSellerValidationModel {
  listingHeadline: string;
  workspaceFacts: readonly string[];
  aiInterpretations: readonly string[];
  assumptions: readonly string[];
  destinations: readonly TradingSellerDestinationProjection[];
}

export interface TradingSellerValidationFlowProps {
  state: Readonly<TradingStudioState>;
  model: Readonly<TradingSellerValidationModel>;
  sourceIsCurrent: boolean;
  initialStage?: SellerValidationStage;
}
const stageLabels: ReadonlyArray<{ stage: SellerValidationStage; label: string }> = [
  { stage: 'DEEP_BUILD', label: 'Deep Build readiness' },
  { stage: 'LISTING_PREVIEW', label: 'Listing preview' },
  { stage: 'DESTINATIONS', label: 'Destination readiness' }
];

const destinationLabel = {
  READY: 'Ready',
  CONNECTED: 'Connected',
  NEEDS_ATTENTION: 'Needs attention'
} as const;

const workbenchSlots = [
  ['hero', 'Hero visual'],
  ['asset-board', 'Asset board'],
  ['packaging', 'Packaging'],
  ['product-scene', 'Product scene'],
  ['website', 'Website'],
  ['ecommerce', 'E-commerce'],
  ['social', 'Social']
] as const;

function selectedDirection(state: Readonly<TradingStudioState>) {
  const selected = state.selection?.selectedDirection;
  if (!selected || !state.directionSet) return undefined;
  return state.directionSet.directions.find(
    (direction) =>
      direction.commercialDirectionId === selected.id && direction.version === selected.version
  );
}

function StageNav({
  stage,
  onChange
}: {
  stage: SellerValidationStage;
  onChange: (stage: SellerValidationStage) => void;
}) {
  return (
    <nav className="trading-seller-validation__stages" aria-label="Seller validation stages">
      {stageLabels.map((item) => (
        <Button
          key={item.stage}
          variant={stage === item.stage ? 'primary' : 'secondary'}
          onClick={() => onChange(item.stage)}
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}
function DeepBuildStage({ state }: { state: Readonly<TradingStudioState> }) {
  const direction = useMemo(() => selectedDirection(state), [state]);
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [interaction, setInteraction] = useState('No prototype interaction recorded yet.');

  if (!direction)
    return (
      <EmptyState
        title="Choose a direction first"
        description="Deep Build readiness is available only after an explicit current direction selection."
      />
    );

  const togglePinned = (id: string) => {
    setPinned((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setInteraction('Prototype pin state changed locally. No saved creative asset was created.');
  };

  const removeSlot = (id: string) => {
    setRemoved((current) => new Set([...current, id]));
    setInteraction('Prototype slot removed locally. No saved seller work was changed.');
  };

  return (
    <div className="trading-seller-validation__deep-build">
      <div className="trading-seller-validation__grid">
        <Card className="trading-seller-validation__card">
          <Badge>Selected concept · version {direction.version}</Badge>
          <h3>{direction.title}</h3>
          <p>{direction.thesis ?? direction.summary}</p>
          <small>
            This remains an AI concept, not an official trademark record or verified market demand.
          </small>
        </Card>
        <Card className="trading-seller-validation__card">
          <h3>Creative source readiness</h3>
          {state.brandDna ? (
            <>
              <Badge>Brand DNA available · version {state.brandDna.version}</Badge>
              <p>{state.brandDna.brandPromise}</p>
            </>
          ) : (
            <Alert tone="warning" title="Brand DNA is not available">
              Deep Build cannot be treated as ready until the saved creative source is available.
            </Alert>
          )}
        </Card>
      </div>
      <Card className="trading-seller-validation__workbench">
        <div className="trading-seller-validation__preview-heading">
          <div>
            <p className="trading-seller-validation__eyebrow">Prototype-only creative workbench</p>
            <h3>Visual build slots</h3>
          </div>
          <Badge>Local UI state only</Badge>
        </div>
        <p className="trading-seller-validation__boundary">
          These slots represent the intended Deep Build controls. They are temporary prototype work
          and are not saved creative deliverables or publishable listing materials.
        </p>
        <div className="trading-seller-validation__slot-grid">
          {workbenchSlots
            .filter(([id]) => !removed.has(id))
            .map(([id, label]) => (
              <section key={id} className="trading-seller-validation__slot">
                <div>
                  <Badge>{pinned.has(id) ? 'Pinned locally' : 'Prototype slot'}</Badge>
                  <h4>{label}</h4>
                  <p>No saved creative output exists for this slot yet.</p>
                </div>
                <div className="trading-seller-validation__slot-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setInteraction(`${label}: regenerate simulated locally only.`)}
                  >
                    Regenerate
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setInteraction(`${label}: adjustment controls opened locally only.`)
                    }
                  >
                    Adjust
                  </Button>
                  <Button variant="secondary" onClick={() => togglePinned(id)}>
                    {pinned.has(id) ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setInteraction(`${label}: compare mode simulated locally only.`)}
                  >
                    Compare
                  </Button>
                  <Button variant="secondary" onClick={() => removeSlot(id)}>
                    Remove
                  </Button>
                </div>
              </section>
            ))}
        </div>
        <div className="trading-seller-validation__workbench-footer">
          <Button
            variant="secondary"
            onClick={() =>
              setInteraction(
                'Reference attachment simulated locally only. No reference set was saved.'
              )
            }
          >
            Add reference
          </Button>
          <p role="status">{interaction}</p>
        </div>
      </Card>
    </div>
  );
}
function ListingPreviewStage({ model }: { model: Readonly<TradingSellerValidationModel> }) {
  return (
    <section
      className="trading-seller-validation__preview"
      aria-labelledby="seller-listing-preview-title"
    >
      <div className="trading-seller-validation__preview-heading">
        <div>
          <p className="trading-seller-validation__eyebrow">
            Validation preview · not a saved listing
          </p>
          <h3 id="seller-listing-preview-title">{model.listingHeadline}</h3>
        </div>
        <Badge>Not published</Badge>
      </div>
      <div className="trading-seller-validation__grid trading-seller-validation__grid--three">
        <Card className="trading-seller-validation__card">
          <h4>Workspace facts</h4>
          <ul>
            {model.workspaceFacts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card className="trading-seller-validation__card">
          <h4>AI interpretation</h4>
          <ul>
            {model.aiInterpretations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card className="trading-seller-validation__card">
          <h4>Assumptions and limits</h4>
          {model.assumptions.length ? (
            <ul>
              {model.assumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No additional assumptions were supplied.</p>
          )}
        </Card>
      </div>
      <Alert tone="info" title="Preview boundary">
        This screen does not save a listing, approve publication, send anything externally, or
        publish to a marketplace.
      </Alert>
    </section>
  );
}
function DestinationsStage({ model }: { model: Readonly<TradingSellerValidationModel> }) {
  return (
    <section
      className="trading-seller-validation__destinations"
      aria-labelledby="seller-destinations-title"
    >
      <div className="trading-seller-validation__preview-heading">
        <div>
          <p className="trading-seller-validation__eyebrow">Publication preparation</p>
          <h3 id="seller-destinations-title">Destination readiness</h3>
        </div>
        <Badge>Needs attention</Badge>
      </div>
      {model.destinations.length ? (
        <div className="trading-seller-validation__grid">
          {model.destinations.map((destination) => (
            <Card key={destination.id} className="trading-seller-validation__card">
              <Badge>{destinationLabel[destination.state]}</Badge>
              <h4>{destination.label}</h4>
              <p>{destination.note}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Needs attention — no destination is connected"
          description="No marketplace destination is currently connected. Nothing can be confirmed or published from here."
        />
      )}
    </section>
  );
}
export function TradingSellerValidationFlow({
  state,
  model,
  sourceIsCurrent,
  initialStage = 'DEEP_BUILD'
}: TradingSellerValidationFlowProps) {
  const [stage, setStage] = useState<SellerValidationStage>(initialStage);
  const direction = selectedDirection(state);
  const sourceReady = sourceIsCurrent && Boolean(direction) && Boolean(state.brandDna);

  return (
    <section className="trading-seller-validation" aria-labelledby="seller-validation-title">
      <PageHeader
        title="Seller validation flow"
        description="Test how a selected commercial direction becomes understandable seller-facing preparation before publication is enabled."
        actions={<Badge>Validation only</Badge>}
      />
      <Alert tone="info" title="Nothing here publishes the trademark">
        This is a read-only product validation flow using the currently saved Studio information.
        Nothing here enables or performs publication.
      </Alert>
      <StageNav stage={stage} onChange={setStage} />
      {!sourceIsCurrent ? (
        <Alert tone="warning" title="Source changed">
          Reload the latest saved information before treating Deep Build or listing preparation as
          ready.
        </Alert>
      ) : null}
      {stage === 'DEEP_BUILD' ? <DeepBuildStage state={state} /> : null}
      {stage === 'LISTING_PREVIEW' ? <ListingPreviewStage model={model} /> : null}
      {stage === 'DESTINATIONS' ? <DestinationsStage model={model} /> : null}
      <Card className="trading-seller-validation__confirmation">
        <div>
          <p className="trading-seller-validation__eyebrow">Final confirmation preview</p>
          <h3>Not published yet</h3>
          <p>
            Your selected direction and current source information can be restored after reload.
            This prototype does not save a separate publish-intent step.
          </p>
          <Badge>{sourceReady ? 'Preparation sources up to date' : 'Preparation blocked'}</Badge>
        </div>
        <Button disabled>Publication not enabled</Button>
      </Card>
      <p className="trading-seller-validation__boundary">
        Deep Build readiness does not create finished brand assets, a saved listing, publication
        approval, or a marketplace result.
      </p>
    </section>
  );
}
