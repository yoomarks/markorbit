import { Card, DataList } from '@markorbit/ui';
import {
  COGNITIVE_ATTENTION_GROUP_LABELS,
  COGNITIVE_ATTENTION_GROUP_ORDER,
  buildCognitiveAttentionItems,
  type CognitiveAttentionGroup,
  type CognitiveAttentionItem,
  type CognitiveAttentionSnapshot
} from './cognitive-attention.js';

const GROUP_DESCRIPTIONS: Readonly<Record<CognitiveAttentionGroup, string>> = {
  HUMAN_GOVERNANCE_ATTENTION:
    'Owner-reported blocker conditions that warrant human/governance review. The group does not create approval or resolution authority.',
  INTEGRITY_CURRENTNESS_FINDING:
    'Exact owner audit findings. The console preserves finding identity and affected references without recomputing the audit.',
  SOURCE_DEPENDENCY_UNAVAILABLE:
    'Owner truth, binding or audit dependency is unavailable or not established. Unknown/unavailable is not treated as empty or healthy.',
  OBSERVABILITY_RECORDING_LIMITATION:
    'The owner projection explicitly cannot establish additional durable history/state from the current recording surface.'
};

function ownerLabel(owner: CognitiveAttentionItem['owner']): string {
  return owner === 'CORE' ? 'Core' : 'Capability Engine';
}

function Evidence({ item }: { item: CognitiveAttentionItem }) {
  return (
    <details>
      <summary>Evidence</summary>
      {item.evidence.length === 0 ? (
        <p>No additional owner evidence fields are established for this attention item.</p>
      ) : (
        <DataList
          items={item.evidence.map((evidence) => ({
            label: evidence.label,
            value: evidence.value
          }))}
        />
      )}
    </details>
  );
}

function AttentionCard({ item }: { item: CognitiveAttentionItem }) {
  return (
    <Card>
      <h4>{item.title}</h4>
      <p>
        <strong>{ownerLabel(item.owner)}</strong> · {COGNITIVE_ATTENTION_GROUP_LABELS[item.group]}
      </p>
      <DataList
        items={[
          { label: 'Needs attention', value: item.needsAttention },
          { label: 'Current state', value: item.currentState },
          { label: 'Why', value: item.why },
          { label: 'Impact boundary', value: item.affects },
          { label: 'Control here', value: 'View only' },
          { label: 'Resolution', value: 'External / owner dependency' },
          { label: 'Next legal step', value: item.nextLegalStep }
        ]}
      />
      <p>
        <a href={`#${item.explanationTargetId}`}>View owner-truth explanation</a>
      </p>
      <Evidence item={item} />
    </Card>
  );
}

export function CognitiveAttentionWorkspace({
  snapshot
}: {
  snapshot: CognitiveAttentionSnapshot;
}) {
  const items = buildCognitiveAttentionItems(snapshot);

  return (
    <section aria-labelledby="cognitive-attention-heading">
      <Card>
        <h2 id="cognitive-attention-heading">Needs attention</h2>
        <p>
          This view promotes only exceptional states already established by the loaded owner truth.
          It does not create a platform health score, cross-owner severity ranking, issue mirror or
          mutation authority.
        </p>
      </Card>

      {items.length === 0 ? (
        <p>
          No exceptional attention condition is established by the current bounded owner
          projections. This is not a healthy, complete, correct or production-ready conclusion.
        </p>
      ) : (
        COGNITIVE_ATTENTION_GROUP_ORDER.map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (groupItems.length === 0) return null;
          const headingId = `cognitive-attention-${group.toLowerCase().replaceAll('_', '-')}`;
          return (
            <section key={group} aria-labelledby={headingId}>
              <h3 id={headingId}>{COGNITIVE_ATTENTION_GROUP_LABELS[group]}</h3>
              <p>{GROUP_DESCRIPTIONS[group]}</p>
              <div className="mo-grid">
                {groupItems.map((item) => (
                  <AttentionCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </section>
  );
}
