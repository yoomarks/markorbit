export type MarkregTruthClass =
  | 'CUSTOMER_SUPPLIED'
  | 'GOVERNED_INTERNAL_WORKFLOW'
  | 'REVIEWED_EVIDENCE'
  | 'OFFICIAL_VERIFIED'
  | 'UNAVAILABLE_OR_STALE'
  | 'HISTORICAL';

const truthLabels: Readonly<Record<MarkregTruthClass, string>> = Object.freeze({
  CUSTOMER_SUPPLIED: 'Customer supplied',
  GOVERNED_INTERNAL_WORKFLOW: 'Governed internal workflow',
  REVIEWED_EVIDENCE: 'Reviewed evidence',
  OFFICIAL_VERIFIED: 'Official verified',
  UNAVAILABLE_OR_STALE: 'Unavailable / stale',
  HISTORICAL: 'Historical'
});

export function TruthContext({
  truthClass,
  detail
}: {
  truthClass: MarkregTruthClass;
  detail?: string;
}) {
  const label = truthLabels[truthClass];
  return (
    <span
      className={`markreg-truth-context markreg-truth-context--${truthClass.toLowerCase().replaceAll('_', '-')}`}
      aria-label={`Truth class: ${label}${detail ? `. ${detail}` : ''}`}
    >
      <span className="markreg-truth-context-label">{label}</span>
      {detail && <span className="markreg-truth-context-detail">{detail}</span>}
    </span>
  );
}
