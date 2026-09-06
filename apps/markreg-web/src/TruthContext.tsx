import type { ReactNode } from 'react';

export type TruthClass =
  | 'CUSTOMER_SUPPLIED'
  | 'GOVERNED_INTERNAL'
  | 'REVIEWED_EVIDENCE'
  | 'OFFICIAL_VERIFIED'
  | 'UNAVAILABLE_STALE'
  | 'HISTORICAL';

const truthCopy: Readonly<Record<TruthClass, { label: string; description: string }>> =
  Object.freeze({
    CUSTOMER_SUPPLIED: {
      label: 'Customer supplied',
      description: 'Captured case input; not independently verified legal or official fact.'
    },
    GOVERNED_INTERNAL: {
      label: 'Governed internal workflow',
      description: 'Current MarkReg product workflow; not trademark-office Official Status.'
    },
    REVIEWED_EVIDENCE: {
      label: 'Reviewed evidence',
      description: 'Reviewed provider or external evidence; not Official Truth by itself.'
    },
    OFFICIAL_VERIFIED: {
      label: 'Official verified',
      description: 'Owner-admitted verified official truth.'
    },
    UNAVAILABLE_STALE: {
      label: 'Unavailable / stale',
      description: 'The current source cannot establish exact current truth.'
    },
    HISTORICAL: {
      label: 'Historical',
      description: 'Valid prior context that is not current truth.'
    }
  });

export function TruthBadge({ kind }: { kind: TruthClass }) {
  const copy = truthCopy[kind];
  return (
    <span
      className={`markreg-truth-badge markreg-truth-badge-${kind.toLowerCase().replaceAll('_', '-')}`}
      aria-label={`Truth class: ${copy.label}`}
      title={copy.description}
    >
      {copy.label}
    </span>
  );
}

export function TruthContext({
  kind,
  children,
  details
}: {
  kind: TruthClass;
  children?: ReactNode;
  details?: ReactNode;
}) {
  const copy = truthCopy[kind];
  return (
    <div className="markreg-truth-context">
      <div className="markreg-truth-context-line">
        <TruthBadge kind={kind} />
        {children && <span>{children}</span>}
      </div>
      {details ? (
        <details className="markreg-truth-context-details">
          <summary>What this truth class means</summary>
          <p>{copy.description}</p>
          {details}
        </details>
      ) : null}
    </div>
  );
}

export const truthClassLabel = (kind: TruthClass) => truthCopy[kind].label;
