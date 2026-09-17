export const TRADEMARK_INTELLIGENCE_METHOD_FAMILY_CONTRACT_V1 =
  'MARKORBIT_TRADEMARK_INTELLIGENCE_METHOD_FAMILY_V1' as const;

export type TrademarkIntelligenceMethodFamilyIdV1 =
  | 'US_OA_ISSUE_CLASSIFICATION'
  | 'US_CITATION_EXTRACTION'
  | 'US_OA_RESPONSE_STRATEGY_RESEARCH'
  | 'CN_REFUSAL_ISSUE_CLASSIFICATION'
  | 'CN_CITATION_EXTRACTION'
  | 'CN_REFUSAL_REVIEW_STRATEGY_RESEARCH'
  | 'DEFENSIVE_TRADEMARK_RISK';

export interface TrademarkIntelligenceMethodFamilyV1 {
  contractVersion: typeof TRADEMARK_INTELLIGENCE_METHOD_FAMILY_CONTRACT_V1;
  familyId: TrademarkIntelligenceMethodFamilyIdV1;
  owner: 'MARKORBIT_BRAIN';
  jurisdictions: readonly ('CN' | 'US')[];
  lifecycle: 'RESEARCH_ONLY';
  outputClass:
    'ISSUE_CLASSIFICATION' | 'CITATION_FACT_CANDIDATE' | 'STRATEGY_RESEARCH' | 'RISK_ANALYSIS';
  requiredInputs: readonly string[];
  factCandidateType: 'CITED_AS_REFERENCE_FOR_REFUSAL' | null;
  requiresAdmittedObjectiveFacts: boolean;
  canProduceOfficialFact: false;
  canProduceFactCandidate: boolean;
  legalConclusionAllowed: false;
  activationEligible: false;
  capabilityExecutionEnabled: false;
}

const family = (
  value: Omit<
    TrademarkIntelligenceMethodFamilyV1,
    | 'contractVersion'
    | 'owner'
    | 'lifecycle'
    | 'canProduceOfficialFact'
    | 'legalConclusionAllowed'
    | 'activationEligible'
    | 'capabilityExecutionEnabled'
  >
): TrademarkIntelligenceMethodFamilyV1 => ({
  contractVersion: TRADEMARK_INTELLIGENCE_METHOD_FAMILY_CONTRACT_V1,
  owner: 'MARKORBIT_BRAIN',
  lifecycle: 'RESEARCH_ONLY',
  canProduceOfficialFact: false,
  legalConclusionAllowed: false,
  activationEligible: false,
  capabilityExecutionEnabled: false,
  ...value
});

export const trademarkIntelligenceMethodFamiliesV1 = [
  family({
    familyId: 'US_OA_ISSUE_CLASSIFICATION',
    jurisdictions: ['US'],
    outputClass: 'ISSUE_CLASSIFICATION',
    requiredInputs: ['KNOWLEDGE_OFFICIAL_DOCUMENT_VERSION', 'EXACT_EVIDENCE_LOCATOR'],
    factCandidateType: null,
    requiresAdmittedObjectiveFacts: false,
    canProduceFactCandidate: false
  }),
  family({
    familyId: 'US_CITATION_EXTRACTION',
    jurisdictions: ['US'],
    outputClass: 'CITATION_FACT_CANDIDATE',
    requiredInputs: [
      'KNOWLEDGE_OFFICIAL_DOCUMENT_VERSION',
      'EXACT_EVIDENCE_LOCATOR',
      'OFFICIAL_CITED_TRADEMARK_IDENTIFIER'
    ],
    factCandidateType: 'CITED_AS_REFERENCE_FOR_REFUSAL',
    requiresAdmittedObjectiveFacts: false,
    canProduceFactCandidate: true
  }),
  family({
    familyId: 'US_OA_RESPONSE_STRATEGY_RESEARCH',
    jurisdictions: ['US'],
    outputClass: 'STRATEGY_RESEARCH',
    requiredInputs: ['VALIDATED_ISSUE_CLASSIFICATION', 'KNOWLEDGE_DOCUMENT_CHAIN'],
    factCandidateType: null,
    requiresAdmittedObjectiveFacts: false,
    canProduceFactCandidate: false
  }),
  family({
    familyId: 'CN_REFUSAL_ISSUE_CLASSIFICATION',
    jurisdictions: ['CN'],
    outputClass: 'ISSUE_CLASSIFICATION',
    requiredInputs: ['KNOWLEDGE_OFFICIAL_DOCUMENT_VERSION', 'EXACT_EVIDENCE_LOCATOR'],
    factCandidateType: null,
    requiresAdmittedObjectiveFacts: false,
    canProduceFactCandidate: false
  }),
  family({
    familyId: 'CN_CITATION_EXTRACTION',
    jurisdictions: ['CN'],
    outputClass: 'CITATION_FACT_CANDIDATE',
    requiredInputs: [
      'KNOWLEDGE_OFFICIAL_DOCUMENT_VERSION',
      'EXACT_EVIDENCE_LOCATOR',
      'OFFICIAL_CITED_TRADEMARK_IDENTIFIER'
    ],
    factCandidateType: 'CITED_AS_REFERENCE_FOR_REFUSAL',
    requiresAdmittedObjectiveFacts: false,
    canProduceFactCandidate: true
  }),
  family({
    familyId: 'CN_REFUSAL_REVIEW_STRATEGY_RESEARCH',
    jurisdictions: ['CN'],
    outputClass: 'STRATEGY_RESEARCH',
    requiredInputs: ['VALIDATED_ISSUE_CLASSIFICATION', 'KNOWLEDGE_DOCUMENT_CHAIN'],
    factCandidateType: null,
    requiresAdmittedObjectiveFacts: false,
    canProduceFactCandidate: false
  }),
  family({
    familyId: 'DEFENSIVE_TRADEMARK_RISK',
    jurisdictions: ['CN', 'US'],
    outputClass: 'RISK_ANALYSIS',
    requiredInputs: [
      'DATA_ENGINE_ADMITTED_CITATION_FACT',
      'DATA_ENGINE_TEMPORAL_RELATIONSHIPS',
      'DATA_ENGINE_PROCEEDING_HISTORY'
    ],
    factCandidateType: null,
    requiresAdmittedObjectiveFacts: true,
    canProduceFactCandidate: false
  })
] as const satisfies readonly TrademarkIntelligenceMethodFamilyV1[];

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export function parseTrademarkIntelligenceMethodFamilyV1(
  value: unknown
): TrademarkIntelligenceMethodFamilyV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Trademark intelligence method family must be an object.');
  const familyId = (value as { familyId?: unknown }).familyId;
  const expected = trademarkIntelligenceMethodFamiliesV1.find((item) => item.familyId === familyId);
  if (!expected || canonicalJson(value) !== canonicalJson(expected))
    throw new TypeError('Unsupported or mutated trademark intelligence method family.');
  return expected;
}
