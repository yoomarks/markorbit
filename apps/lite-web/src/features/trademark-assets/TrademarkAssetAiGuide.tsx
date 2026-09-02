import { useState } from 'react';
import type { TrademarkAssetAiGuidePreparedResult } from '@markorbit/contracts/trademark-asset-ai-guide';
import type {
  AiGuideSuggestionKind,
  TrademarkAssetId,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';
import { Button } from '@markorbit/ui';
import {
  TrademarkAssetHttpError,
  type PrepareTrademarkAssetAiGuideRequest
} from '../../api/trademark-assets.js';

const initialKinds = [
  'EXPLAIN_ASSET',
  'IDENTIFY_MISSING_INFORMATION',
  'PREPARE_CHECKLIST'
] as const satisfies readonly AiGuideSuggestionKind[];

const kindLabels: Record<(typeof initialKinds)[number], string> = {
  EXPLAIN_ASSET: 'Explain this Asset',
  IDENTIFY_MISSING_INFORMATION: 'Identify missing information',
  PREPARE_CHECKLIST: 'Prepare a review checklist'
};

interface TrademarkAssetAiGuideProps {
  assetId: TrademarkAssetId;
  assetVersion: number;
  initialResult?: Readonly<TrademarkAssetAiGuidePreparedResult>;
  onPrepare: (
    input: Readonly<PrepareTrademarkAssetAiGuideRequest>
  ) => Promise<TrademarkAssetAiGuidePreparedResult>;
}

function errorCopy(status: number): { title: string; detail: string } {
  switch (status) {
    case 401:
      return {
        title: 'Session required',
        detail: 'Sign in again before requesting AI Guide suggestions.'
      };
    case 403:
      return {
        title: 'AI Guide permission denied',
        detail: 'Workspace permission, trusted Origin or CSRF verification denied this request.'
      };
    case 404:
      return {
        title: 'Asset unavailable for AI Guide',
        detail: 'This Asset is unavailable in the current Workspace.'
      };
    case 409:
      return {
        title: 'Asset truth changed or evidence conflicts',
        detail: 'Refresh the Asset before trusting or requesting new AI Guide preparation.'
      };
    case 422:
      return {
        title: 'Suggestion request not supported',
        detail: 'Choose at least one supported suggestion kind and try again.'
      };
    default:
      return {
        title: 'AI Guide temporarily unavailable',
        detail: 'The owner service is unavailable. No local or fixture suggestion was substituted.'
      };
  }
}

function EvidenceReference({ evidence }: { evidence: Readonly<TrademarkAssetSourceReference> }) {
  return (
    <span>
      {evidence.owner} / {evidence.kind} / {evidence.sourceId}@{evidence.sourceVersion} ·{' '}
      {evidence.freshness} · observed {evidence.observedAt}
    </span>
  );
}

export function TrademarkAssetAiGuide({
  assetId,
  assetVersion,
  initialResult,
  onPrepare
}: TrademarkAssetAiGuideProps) {
  const [selectedKinds, setSelectedKinds] =
    useState<readonly AiGuideSuggestionKind[]>(initialKinds);
  const [result, setResult] = useState<Readonly<TrademarkAssetAiGuidePreparedResult> | undefined>(
    initialResult
  );
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail: string }>();

  const toggleKind = (kind: AiGuideSuggestionKind) => {
    setSelectedKinds((current) =>
      current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind]
    );
  };

  const prepare = async () => {
    setPending(true);
    setFailure(undefined);
    setResult(undefined);
    try {
      const prepared = await onPrepare({
        expectedTrademarkAssetVersion: assetVersion,
        requestedKinds: selectedKinds
      });
      setResult(prepared);
    } catch (error) {
      setFailure(errorCopy(error instanceof TrademarkAssetHttpError ? error.status : 503));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="trademark-ai-guide" aria-labelledby="ai-guide-heading">
      <div className="trademark-asset-workspace__section-heading">
        <div>
          <p>Asset-scoped advisory preparation</p>
          <h2 id="ai-guide-heading">AI Asset Guide</h2>
        </div>
        <span>
          Exact Asset {assetId} · version {assetVersion}
        </span>
      </div>

      <p className="trademark-ai-guide__intro">
        Choose one or more bounded suggestions. The Guide explains or prepares review material from
        owner evidence; it does not change source truth or create durable Guide history.
      </p>
      <fieldset className="trademark-ai-guide__choices">
        <legend>Suggestion intents</legend>
        {initialKinds.map((kind) => (
          <label key={kind}>
            <input
              type="checkbox"
              checked={selectedKinds.includes(kind)}
              onChange={() => toggleKind(kind)}
            />
            <span>
              <strong>{kindLabels[kind]}</strong>
              <small>{kind}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <Button disabled={pending || selectedKinds.length === 0} onClick={() => void prepare()}>
        {pending ? 'Preparing AI guidance…' : 'Prepare AI guidance'}
      </Button>

      {failure ? (
        <div
          className="trademark-ai-guide__feedback trademark-ai-guide__feedback--error"
          role="alert"
        >
          <strong>{failure.title}</strong>
          <span>{failure.detail}</span>
          <small>The loaded Trademark Asset workspace remains unchanged.</small>
        </div>
      ) : null}

      {result ? (
        <div className="trademark-ai-guide__result" aria-live="polite">
          <div className="trademark-ai-guide__result-meta">
            <div>
              <span>Asset</span>
              <strong>{result.trademarkAssetId}</strong>
            </div>
            <div>
              <span>Version</span>
              <strong>{result.trademarkAssetVersion}</strong>
            </div>
            <div>
              <span>Generated</span>
              <strong>{result.generatedAt}</strong>
            </div>
          </div>

          {result.staleOrConflictingEvidencePresent ? (
            <div className="trademark-ai-guide__stale-warning" role="alert">
              <strong>Stale or conflicting evidence is present</strong>
              <span>
                Review the exact evidence and refresh Asset truth before treating this preparation
                as current. The Guide does not resolve source conflicts.
              </span>
            </div>
          ) : null}

          <div>
            <h3>Context used</h3>
            {result.contextReferences.length ? (
              <ul className="trademark-ai-guide__references">
                {result.contextReferences.map((reference) => (
                  <li
                    key={`${reference.kind}-${reference.referenceId}-${reference.referenceVersion}`}
                  >
                    {reference.kind} / {reference.referenceId}@{reference.referenceVersion}
                    {reference.fingerprintSha256 ? ` · ${reference.fingerprintSha256}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No additional context references were returned.</p>
            )}
          </div>

          <div>
            <h3>Owner evidence and provenance</h3>
            {result.evidence.length ? (
              <ul className="trademark-ai-guide__references">
                {result.evidence.map((evidence) => (
                  <li
                    key={`${evidence.owner}-${evidence.kind}-${evidence.sourceId}-${evidence.sourceVersion}`}
                  >
                    <EvidenceReference evidence={evidence} />
                  </li>
                ))}
              </ul>
            ) : (
              <p>No owner evidence references were returned.</p>
            )}
          </div>

          <div className="trademark-asset-workspace__guide-grid">
            {result.suggestions.map((suggestion) => (
              <article key={suggestion.aiGuideSuggestionId}>
                <p className="trademark-asset-workspace__eyebrow">{suggestion.kind}</p>
                <h3>{suggestion.title}</h3>
                <p>{suggestion.explanation}</p>
                <strong>Exact suggestion evidence</strong>
                {suggestion.evidence.length ? (
                  <ul className="trademark-ai-guide__references">
                    {suggestion.evidence.map((evidence) => (
                      <li
                        key={`${evidence.owner}-${evidence.kind}-${evidence.sourceId}-${evidence.sourceVersion}`}
                      >
                        <EvidenceReference evidence={evidence} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No exact evidence references were returned for this suggestion.</p>
                )}
              </article>
            ))}
          </div>
          {result.suggestions.length === 0 ? (
            <p>No suggestions were returned for the selected intents.</p>
          ) : null}
        </div>
      ) : null}

      <aside className="trademark-ai-guide__authority" aria-label="AI Guide authority boundary">
        <strong>AI Guide is advisory, not authority</strong>
        <ul>
          <li>Not official truth or verified official status.</li>
          <li>Not a certified deadline or silent conflict resolution.</li>
          <li>Not execution, filing, publication, or source-truth mutation authority.</li>
          <li>Not customer or provider contact authority.</li>
          <li>Not payment, paid execution, Order, Matter, or Filing authority.</li>
        </ul>
      </aside>
    </section>
  );
}
