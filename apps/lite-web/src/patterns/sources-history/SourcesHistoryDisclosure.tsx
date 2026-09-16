import { Alert, Badge, Card, KeyValueList, PageHeader } from '@markorbit/ui';
import './sources-history-disclosure.css';

export type SourcesHistoryState = 'normal' | 'partial' | 'conflicting' | 'unavailable';

export interface SourcesHistorySource {
  id: string;
  label: string;
  kind: 'official' | 'workspace';
  summary: string;
  observedAt: string;
}

export interface SourcesHistoryInterpretation {
  summary: string;
  assumption: string;
}

export interface SourcesHistoryFixture {
  state: SourcesHistoryState;
  sources: readonly SourcesHistorySource[];
  interpretation?: SourcesHistoryInterpretation;
}

export interface SourcesHistoryDisclosureProps extends SourcesHistoryFixture {
  diagnostics: readonly { key: string; value: string }[];
  diagnosticsOpen?: boolean;
}

const sourceKindLabel = {
  official: 'Official source',
  workspace: 'Workspace source'
} as const;

function StateNotice({ state }: { state: SourcesHistoryState }) {
  if (state === 'partial') {
    return (
      <Alert title="Some source information is unavailable">
        Available sources are shown below. Wait for the missing source before relying on a complete
        history.
      </Alert>
    );
  }
  if (state === 'conflicting') {
    return (
      <Alert tone="warning" title="Sources disagree">
        The official and workspace dates differ. Review both sources; no date was selected
        automatically.
      </Alert>
    );
  }
  if (state === 'unavailable') {
    return (
      <Alert tone="warning" title="Source information is unavailable">
        The history could not be loaded. This is not an empty history, and no conclusion is shown.
      </Alert>
    );
  }
  return null;
}

export function SourcesHistoryDisclosure({
  state,
  sources,
  interpretation,
  diagnostics,
  diagnosticsOpen = false
}: SourcesHistoryDisclosureProps) {
  return (
    <main className="sources-history-pattern">
      <PageHeader
        title="Sources & history"
        description="See where the information came from, when it was observed, and what was inferred."
        actions={<Badge>Storybook pattern</Badge>}
      />

      <StateNotice state={state} />

      {state !== 'unavailable' && (
        <div className="sources-history-pattern__grid">
          <section aria-labelledby="source-records-title">
            <header className="sources-history-pattern__section-heading">
              <p>Source evidence</p>
              <h2 id="source-records-title">Recorded information</h2>
            </header>
            <div className="sources-history-pattern__source-list">
              {sources.map((source) => (
                <Card
                  className={`sources-history-pattern__source sources-history-pattern__source--${source.kind}`}
                  key={source.id}
                >
                  <div className="sources-history-pattern__card-heading">
                    <Badge>{sourceKindLabel[source.kind]}</Badge>
                    <time>{source.observedAt}</time>
                  </div>
                  <h3>{source.label}</h3>
                  <p>{source.summary}</p>
                </Card>
              ))}
            </div>
          </section>

          {interpretation && (
            <section
              className="sources-history-pattern__interpretation"
              aria-labelledby="ai-interpretation-title"
            >
              <header className="sources-history-pattern__section-heading">
                <p>AI interpretation</p>
                <h2 id="ai-interpretation-title">What this may mean</h2>
              </header>
              <Card>
                <Badge>Interpretation, not source</Badge>
                <p>{interpretation.summary}</p>
                <div className="sources-history-pattern__assumption">
                  <strong>Assumption</strong>
                  <p>{interpretation.assumption}</p>
                </div>
              </Card>
            </section>
          )}
        </div>
      )}

      <details className="sources-history-pattern__advanced" open={diagnosticsOpen || undefined}>
        <summary onClick={(event) => event.currentTarget.focus()}>Advanced</summary>
        <section aria-labelledby="diagnostics-title">
          <p className="sources-history-pattern__advanced-label">Support and administration</p>
          <h2 id="diagnostics-title">Diagnostics</h2>
          <p>
            Optional technical support information. It is not required to complete ordinary work.
          </p>
          <KeyValueList items={diagnostics} />
        </section>
      </details>
    </main>
  );
}
