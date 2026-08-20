import type { TrademarkAssetAiGuidePreparedResult } from '@markorbit/contracts/trademark-asset-ai-guide';
import type { TrademarkAssetCommerceProfile } from '@markorbit/contracts/trademark-asset-commerce';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import type { TrademarkAssetMarketplaceOverlay } from '@markorbit/contracts/trademark-asset-marketplace-reference';
import type { TrademarkAssetAttentionSignal } from '@markorbit/contracts/trademark-asset-workspace';
import { Button } from '@markorbit/ui';
import './trademark-asset-workspace.css';

export interface TrademarkAssetWorkspaceProps {
  view: Readonly<TrademarkAssetView>;
  attention?: readonly Readonly<TrademarkAssetAttentionSignal>[];
  commerceProfile?: Readonly<TrademarkAssetCommerceProfile>;
  marketplaceOverlay?: Readonly<TrademarkAssetMarketplaceOverlay>;
  aiGuide?: Readonly<TrademarkAssetAiGuidePreparedResult>;
}

const textValue = (value: string | number | boolean | readonly string[]) =>
  Array.isArray(value) ? value.join(', ') : String(value);

function handoffForAttention(attention: Readonly<TrademarkAssetAttentionSignal>): {
  label: string;
  hash: '#today' | '#matters';
} {
  if (attention.dimension === 'LIFECYCLE_RECOMMENDATION') {
    return { label: 'Open related work', hash: '#matters' };
  }
  return { label: 'Continue in Today', hash: '#today' };
}

export function TrademarkAssetWorkspace({
  view,
  attention = [],
  commerceProfile,
  marketplaceOverlay,
  aiGuide
}: TrademarkAssetWorkspaceProps) {
  const relationships = view.anchor.workspaceRelationships.map((relationship) => relationship.kind);
  const isMarketplaceReference = relationships.includes('MARKETPLACE_ADDED');

  return (
    <main className="trademark-asset-workspace" data-testid="trademark-asset-workspace">
      <header className="trademark-asset-workspace__header">
        <div>
          <p className="trademark-asset-workspace__eyebrow">Trademark Asset Workspace</p>
          <h1>{view.anchor.identity.markText || 'Untitled trademark asset'}</h1>
          <p>
            {view.anchor.identity.jurisdiction} · Asset {view.trademarkAssetId}
          </p>
        </div>
        <div
          className="trademark-asset-workspace__badges"
          aria-label="Asset authority and freshness"
        >
          <span>{relationships.join(' · ')}</span>
          <span>{view.freshness}</span>
          {isMarketplaceReference ? <span>Marketplace source · read-only</span> : null}
        </div>
      </header>

      <section aria-labelledby="asset-attention-heading">
        <div className="trademark-asset-workspace__section-heading">
          <div>
            <p>Explainable product attention</p>
            <h2 id="asset-attention-heading">Why this Asset needs attention</h2>
          </div>
          <span>No deadline or official-status certification</span>
        </div>
        {attention.length ? (
          <div className="trademark-asset-workspace__guide-grid">
            {attention.map((item) => {
              const handoff = handoffForAttention(item);
              return (
                <article key={item.attentionSignalId}>
                  <h3>
                    {item.severity} · {item.dimension}
                  </h3>
                  <p>{item.reason}</p>
                  <small>
                    {item.evidence.length} source reference{item.evidence.length === 1 ? '' : 's'} ·
                    explicit user choice required
                  </small>
                  <div className="trademark-asset-portfolio__actions">
                    <Button
                      onClick={() => {
                        window.location.hash = handoff.hash;
                      }}
                    >
                      {handoff.label}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p>No current explainable attention signal.</p>
        )}
      </section>

      <section aria-labelledby="asset-facts-heading">
        <div className="trademark-asset-workspace__section-heading">
          <div>
            <p>Source-owned evidence</p>
            <h2 id="asset-facts-heading">Observed facts</h2>
          </div>
          <span>Lite does not verify official truth</span>
        </div>
        {view.observedFacts.length ? (
          <dl className="trademark-asset-workspace__fact-grid">
            {view.observedFacts.map((fact, index) => (
              <div key={`${fact.kind}-${index}`}>
                <dt>{fact.kind}</dt>
                <dd>{textValue(fact.value)}</dd>
                <small>
                  {fact.source.owner} · {fact.source.kind} · {fact.freshness}
                </small>
              </div>
            ))}
          </dl>
        ) : (
          <p>No source-owned facts are currently available.</p>
        )}
      </section>

      <section aria-labelledby="asset-conflicts-heading">
        <div className="trademark-asset-workspace__section-heading">
          <div>
            <p>Audit surface</p>
            <h2 id="asset-conflicts-heading">Conflicts & source references</h2>
          </div>
        </div>
        {view.conflicts.length ? (
          <ul>
            {view.conflicts.map((conflict, index) => (
              <li key={`${conflict.kind}-${index}`}>
                <strong>{conflict.kind}</strong>: {conflict.values.map(textValue).join(' ↔ ')} ·
                unresolved
              </li>
            ))}
          </ul>
        ) : (
          <p>No unresolved composed-view conflicts.</p>
        )}
        <ul className="trademark-asset-workspace__sources">
          {view.sourceReferences.map((source) => (
            <li key={`${source.owner}-${source.kind}-${source.sourceId}-${source.sourceVersion}`}>
              {source.owner} / {source.kind} / {source.sourceId}@{source.sourceVersion} ·{' '}
              {source.freshness}
            </li>
          ))}
        </ul>
      </section>

      {commerceProfile ? (
        <section aria-labelledby="commerce-context-heading">
          <div className="trademark-asset-workspace__section-heading">
            <div>
              <p>Workspace-owned context</p>
              <h2 id="commerce-context-heading">Commerce profile</h2>
            </div>
            <span>Not a Marketplace listing</span>
          </div>
          <p>{commerceProfile.headline || 'No commerce headline.'}</p>
          <p>
            Sale intent: {commerceProfile.saleIntent} · Seller role: {commerceProfile.sellerRole} ·
            Negotiable: {commerceProfile.negotiable ? 'Yes' : 'No'}
          </p>
        </section>
      ) : null}

      {marketplaceOverlay ? (
        <section aria-labelledby="marketplace-overlay-heading">
          <div className="trademark-asset-workspace__section-heading">
            <div>
              <p>Workspace-private overlay</p>
              <h2 id="marketplace-overlay-heading">Marketplace reference</h2>
            </div>
            <span>Source price and listing remain read-only</span>
          </div>
          <p>{marketplaceOverlay.headline || 'No private reseller headline.'}</p>
          <p>
            Source listing: {marketplaceOverlay.source.sourceListingId}@
            {marketplaceOverlay.source.sourceListingVersion}
          </p>
        </section>
      ) : null}

      {aiGuide ? (
        <section aria-labelledby="ai-guide-heading">
          <div className="trademark-asset-workspace__section-heading">
            <div>
              <p>Advisory only</p>
              <h2 id="ai-guide-heading">AI Asset Guide</h2>
            </div>
            <span>
              {aiGuide.staleOrConflictingEvidencePresent
                ? 'Review evidence before use'
                : 'Evidence current'}
            </span>
          </div>
          <div className="trademark-asset-workspace__guide-grid">
            {aiGuide.suggestions.map((suggestion) => (
              <article key={suggestion.aiGuideSuggestionId}>
                <h3>{suggestion.title}</h3>
                <p>{suggestion.explanation}</p>
                <small>
                  Confirmation required · No filing, contact, payment or official verification
                  authority
                </small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <aside className="trademark-asset-workspace__authority" aria-label="Lite authority boundary">
        <strong>Authority boundary</strong>
        <span>Source facts are read-only in this workspace.</span>
        <span>AI output is advisory and never becomes an official fact.</span>
        <span>
          Filing, provider contact, Marketplace publication, transfer and payment stay outside Lite.
        </span>
      </aside>
    </main>
  );
}
