import { createHash } from 'node:crypto';

export const FACT_CANDIDATE_CONTRACT_VERSION_V1 = 'MARKORBIT_FACT_CANDIDATE_V1' as const;
export const FACT_CANDIDATE_OBJECT_TYPE_V1 = 'FACT_CANDIDATE' as const;

export const factCandidateTypesV1 = ['CITED_AS_REFERENCE_FOR_REFUSAL'] as const;
export type FactCandidateTypeV1 = (typeof factCandidateTypesV1)[number];

export const factCandidateJurisdictionsV1 = ['CN', 'US'] as const;
export type FactCandidateJurisdictionV1 = (typeof factCandidateJurisdictionsV1)[number];

export const factCandidateIngestionStatusesV1 = [
  'PROPOSED',
  'VALIDATED',
  'REJECTED',
  'ADMITTED'
] as const;
export type FactCandidateIngestionStatusV1 = (typeof factCandidateIngestionStatusesV1)[number];

export interface TrademarkFactReferenceV1 {
  resourceType: 'TRADEMARK';
  applicationNumber: string | null;
  registrationNumber: string | null;
}

export interface FactCandidateSourceDocumentV1 {
  owner: 'MARKORBIT_KNOWLEDGE';
  sourceId: string;
  documentId: string;
  documentVersion: number;
  documentSha256: string;
  sourceUri: string;
}

export type FactCandidateEvidenceLocatorV1 =
  | {
      locatorType: 'PAGE_TEXT_RANGE';
      pageNumber: number;
      startOffset: number;
      endOffset: number;
      textSha256: string;
    }
  | {
      locatorType: 'CANONICAL_TEXT_RANGE';
      startOffset: number;
      endOffset: number;
      textSha256: string;
    };

export interface FactCandidateExtractionMethodV1 {
  owner: 'MARKORBIT_BRAIN_METHOD';
  methodId: string;
  methodVersion: string;
}

export interface FactCandidateConfidenceV1 {
  scoreBasisPoints: number;
  evidenceLevel: 'EXPLICIT_DOCUMENT_TEXT';
}

export interface FactCandidateValidationV1 {
  outcome: 'ACCEPTED' | 'REJECTED';
  validatorId: string;
  validatorVersion: string;
  decidedAt: string;
  reasonCode: string | null;
}

export interface FactCandidateAdmissionV1 {
  outcome: 'ADMITTED' | 'REJECTED';
  dataEngineFactId: string | null;
  dataEngineContractVersion: string;
  decidedAt: string;
  reasonCode: string | null;
}

export interface FactCandidateIngestionV1 {
  status: FactCandidateIngestionStatusV1;
  validation: FactCandidateValidationV1 | null;
  admission: FactCandidateAdmissionV1 | null;
}

export interface FactCandidateFingerprintMaterialV1 {
  contractVersion: typeof FACT_CANDIDATE_CONTRACT_VERSION_V1;
  objectType: typeof FACT_CANDIDATE_OBJECT_TYPE_V1;
  factType: FactCandidateTypeV1;
  jurisdiction: FactCandidateJurisdictionV1;
  subject: TrademarkFactReferenceV1;
  object: TrademarkFactReferenceV1;
  eventDate: string;
  effectiveDate: string | null;
  sourceDocument: FactCandidateSourceDocumentV1;
  evidenceLocator: FactCandidateEvidenceLocatorV1;
  sourceAuthority: 'DIRECT_OFFICIAL';
  extractionMethod: FactCandidateExtractionMethodV1;
  confidence: FactCandidateConfidenceV1;
  legalConclusion: false;
}

export interface FactCandidateV1 extends FactCandidateFingerprintMaterialV1 {
  candidateId: string;
  candidateFingerprintSha256: string;
  ingestion: FactCandidateIngestionV1;
  producedAt: string;
}

const patterns = {
  candidateId: /^fac_[0-9A-HJKMNP-TV-Z]{26}$/u,
  sourceId: /^src_[0-9A-HJKMNP-TV-Z]{26}$/u,
  documentId: /^[A-Za-z][A-Za-z0-9_-]{2,127}$/u,
  resourceNumber: /^[A-Z0-9][A-Z0-9./-]{0,63}$/u,
  componentId: /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
  semver: /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u,
  reasonCode: /^[A-Z][A-Z0-9_]{2,99}$/u,
  sha256: /^[a-f0-9]{64}$/u,
  date: /^\d{4}-\d{2}-\d{2}$/u,
  instant: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u,
  officialUri: /^https:\/\//u
} as const;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((key) => actual.includes(key));
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !patterns.date.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}

function validInstant(value: unknown): value is string {
  return (
    typeof value === 'string' && patterns.instant.test(value) && !Number.isNaN(Date.parse(value))
  );
}

function validTrademarkReference(value: unknown): value is TrademarkFactReferenceV1 {
  if (
    !record(value) ||
    !exactKeys(value, ['resourceType', 'applicationNumber', 'registrationNumber']) ||
    value.resourceType !== 'TRADEMARK'
  )
    return false;
  const applicationNumber = value.applicationNumber;
  const registrationNumber = value.registrationNumber;
  return (
    (applicationNumber === null ||
      (typeof applicationNumber === 'string' && patterns.resourceNumber.test(applicationNumber))) &&
    (registrationNumber === null ||
      (typeof registrationNumber === 'string' &&
        patterns.resourceNumber.test(registrationNumber))) &&
    (applicationNumber !== null || registrationNumber !== null)
  );
}

function validSourceDocument(value: unknown): value is FactCandidateSourceDocumentV1 {
  return (
    record(value) &&
    exactKeys(value, [
      'owner',
      'sourceId',
      'documentId',
      'documentVersion',
      'documentSha256',
      'sourceUri'
    ]) &&
    value.owner === 'MARKORBIT_KNOWLEDGE' &&
    typeof value.sourceId === 'string' &&
    patterns.sourceId.test(value.sourceId) &&
    typeof value.documentId === 'string' &&
    patterns.documentId.test(value.documentId) &&
    Number.isSafeInteger(value.documentVersion) &&
    Number(value.documentVersion) > 0 &&
    typeof value.documentSha256 === 'string' &&
    patterns.sha256.test(value.documentSha256) &&
    typeof value.sourceUri === 'string' &&
    patterns.officialUri.test(value.sourceUri)
  );
}

function validEvidenceLocator(value: unknown): value is FactCandidateEvidenceLocatorV1 {
  if (!record(value)) return false;
  const common =
    Number.isSafeInteger(value.startOffset) &&
    Number(value.startOffset) >= 0 &&
    Number.isSafeInteger(value.endOffset) &&
    Number(value.endOffset) > Number(value.startOffset) &&
    typeof value.textSha256 === 'string' &&
    patterns.sha256.test(value.textSha256);
  if (!common) return false;
  if (value.locatorType === 'PAGE_TEXT_RANGE') {
    return (
      exactKeys(value, ['locatorType', 'pageNumber', 'startOffset', 'endOffset', 'textSha256']) &&
      Number.isSafeInteger(value.pageNumber) &&
      Number(value.pageNumber) > 0
    );
  }
  return (
    value.locatorType === 'CANONICAL_TEXT_RANGE' &&
    exactKeys(value, ['locatorType', 'startOffset', 'endOffset', 'textSha256'])
  );
}

function validExtractionMethod(value: unknown): value is FactCandidateExtractionMethodV1 {
  return (
    record(value) &&
    exactKeys(value, ['owner', 'methodId', 'methodVersion']) &&
    value.owner === 'MARKORBIT_BRAIN_METHOD' &&
    typeof value.methodId === 'string' &&
    patterns.componentId.test(value.methodId) &&
    typeof value.methodVersion === 'string' &&
    patterns.semver.test(value.methodVersion)
  );
}

function validConfidence(value: unknown): value is FactCandidateConfidenceV1 {
  return (
    record(value) &&
    exactKeys(value, ['scoreBasisPoints', 'evidenceLevel']) &&
    Number.isSafeInteger(value.scoreBasisPoints) &&
    Number(value.scoreBasisPoints) >= 0 &&
    Number(value.scoreBasisPoints) <= 10_000 &&
    value.evidenceLevel === 'EXPLICIT_DOCUMENT_TEXT'
  );
}

function validValidation(value: unknown): value is FactCandidateValidationV1 {
  if (
    !record(value) ||
    !exactKeys(value, ['outcome', 'validatorId', 'validatorVersion', 'decidedAt', 'reasonCode']) ||
    (value.outcome !== 'ACCEPTED' && value.outcome !== 'REJECTED') ||
    typeof value.validatorId !== 'string' ||
    !patterns.componentId.test(value.validatorId) ||
    typeof value.validatorVersion !== 'string' ||
    !patterns.semver.test(value.validatorVersion) ||
    !validInstant(value.decidedAt)
  )
    return false;
  return value.outcome === 'ACCEPTED'
    ? value.reasonCode === null
    : typeof value.reasonCode === 'string' && patterns.reasonCode.test(value.reasonCode);
}

function validAdmission(value: unknown): value is FactCandidateAdmissionV1 {
  if (
    !record(value) ||
    !exactKeys(value, [
      'outcome',
      'dataEngineFactId',
      'dataEngineContractVersion',
      'decidedAt',
      'reasonCode'
    ]) ||
    (value.outcome !== 'ADMITTED' && value.outcome !== 'REJECTED') ||
    typeof value.dataEngineContractVersion !== 'string' ||
    value.dataEngineContractVersion.length === 0 ||
    value.dataEngineContractVersion.length > 100 ||
    !validInstant(value.decidedAt)
  )
    return false;
  return value.outcome === 'ADMITTED'
    ? typeof value.dataEngineFactId === 'string' &&
        patterns.documentId.test(value.dataEngineFactId) &&
        value.reasonCode === null
    : value.dataEngineFactId === null &&
        typeof value.reasonCode === 'string' &&
        patterns.reasonCode.test(value.reasonCode);
}

function validIngestion(value: unknown): value is FactCandidateIngestionV1 {
  if (!record(value) || !exactKeys(value, ['status', 'validation', 'admission'])) return false;
  const validation = value.validation;
  const admission = value.admission;
  if (value.status === 'PROPOSED') return validation === null && admission === null;
  if (!validValidation(validation)) return false;
  if (value.status === 'VALIDATED') return validation.outcome === 'ACCEPTED' && admission === null;
  if (value.status === 'REJECTED') {
    return (
      (validation.outcome === 'REJECTED' && admission === null) ||
      (validation.outcome === 'ACCEPTED' &&
        validAdmission(admission) &&
        admission.outcome === 'REJECTED')
    );
  }
  return (
    value.status === 'ADMITTED' &&
    validation.outcome === 'ACCEPTED' &&
    validAdmission(admission) &&
    admission.outcome === 'ADMITTED'
  );
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}

export function factCandidateFingerprintSha256V1(
  value: FactCandidateFingerprintMaterialV1
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)), 'utf8')
    .digest('hex');
}

export function factCandidateFingerprintMaterialV1(
  value: FactCandidateV1
): FactCandidateFingerprintMaterialV1 {
  return {
    contractVersion: value.contractVersion,
    objectType: value.objectType,
    factType: value.factType,
    jurisdiction: value.jurisdiction,
    subject: value.subject,
    object: value.object,
    eventDate: value.eventDate,
    effectiveDate: value.effectiveDate,
    sourceDocument: value.sourceDocument,
    evidenceLocator: value.evidenceLocator,
    sourceAuthority: value.sourceAuthority,
    extractionMethod: value.extractionMethod,
    confidence: value.confidence,
    legalConclusion: false
  };
}

export function canTransitionFactCandidateStatusV1(
  from: FactCandidateIngestionStatusV1,
  to: FactCandidateIngestionStatusV1
): boolean {
  if (from === 'PROPOSED') return to === 'VALIDATED' || to === 'REJECTED';
  if (from === 'VALIDATED') return to === 'ADMITTED' || to === 'REJECTED';
  return false;
}

export function parseFactCandidateV1(value: unknown): FactCandidateV1 | null {
  if (
    !record(value) ||
    !exactKeys(value, [
      'contractVersion',
      'objectType',
      'candidateId',
      'factType',
      'jurisdiction',
      'subject',
      'object',
      'eventDate',
      'effectiveDate',
      'sourceDocument',
      'evidenceLocator',
      'sourceAuthority',
      'extractionMethod',
      'confidence',
      'candidateFingerprintSha256',
      'ingestion',
      'producedAt',
      'legalConclusion'
    ]) ||
    value.contractVersion !== FACT_CANDIDATE_CONTRACT_VERSION_V1 ||
    value.objectType !== FACT_CANDIDATE_OBJECT_TYPE_V1 ||
    typeof value.candidateId !== 'string' ||
    !patterns.candidateId.test(value.candidateId) ||
    !factCandidateTypesV1.includes(value.factType as FactCandidateTypeV1) ||
    !factCandidateJurisdictionsV1.includes(value.jurisdiction as FactCandidateJurisdictionV1) ||
    !validTrademarkReference(value.subject) ||
    !validTrademarkReference(value.object) ||
    !validDate(value.eventDate) ||
    !(value.effectiveDate === null || validDate(value.effectiveDate)) ||
    !validSourceDocument(value.sourceDocument) ||
    !validEvidenceLocator(value.evidenceLocator) ||
    value.sourceAuthority !== 'DIRECT_OFFICIAL' ||
    !validExtractionMethod(value.extractionMethod) ||
    !validConfidence(value.confidence) ||
    typeof value.candidateFingerprintSha256 !== 'string' ||
    !patterns.sha256.test(value.candidateFingerprintSha256) ||
    !validIngestion(value.ingestion) ||
    !validInstant(value.producedAt) ||
    value.legalConclusion !== false
  )
    return null;

  const candidate = structuredClone(value) as unknown as FactCandidateV1;
  if (
    candidate.ingestion.validation &&
    Date.parse(candidate.ingestion.validation.decidedAt) < Date.parse(candidate.producedAt)
  )
    return null;
  if (
    candidate.ingestion.validation &&
    candidate.ingestion.admission &&
    Date.parse(candidate.ingestion.admission.decidedAt) <
      Date.parse(candidate.ingestion.validation.decidedAt)
  )
    return null;
  if (
    candidate.candidateFingerprintSha256 !==
    factCandidateFingerprintSha256V1(factCandidateFingerprintMaterialV1(candidate))
  )
    return null;
  return candidate;
}

export function serializeFactCandidateV1(value: FactCandidateV1): string {
  const parsed = parseFactCandidateV1(value);
  if (!parsed) throw new TypeError('Invalid Fact Candidate V1');
  return JSON.stringify(parsed);
}
