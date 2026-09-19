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

const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
] as const;

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
] as const;

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

export function factCandidateSha256Utf8HexV1(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  view.setUint32(paddedLength - 8, high, false);
  view.setUint32(paddedLength - 4, low, false);

  const hash: number[] = [...SHA256_INITIAL];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const w15 = words[index - 15]!;
      const w2 = words[index - 2]!;
      const sigma0 = rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3);
      const sigma1 = rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10);
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0;
    }

    let a = hash[0]!;
    let b = hash[1]!;
    let c = hash[2]!;
    let d = hash[3]!;
    let e = hash[4]!;
    let f = hash[5]!;
    let g = hash[6]!;
    let h = hash[7]!;

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_K[index]! + words[index]!) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0]! + a) >>> 0;
    hash[1] = (hash[1]! + b) >>> 0;
    hash[2] = (hash[2]! + c) >>> 0;
    hash[3] = (hash[3]! + d) >>> 0;
    hash[4] = (hash[4]! + e) >>> 0;
    hash[5] = (hash[5]! + f) >>> 0;
    hash[6] = (hash[6]! + g) >>> 0;
    hash[7] = (hash[7]! + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
}

export function factCandidateFingerprintSha256V1(
  value: FactCandidateFingerprintMaterialV1
): string {
  return factCandidateSha256Utf8HexV1(JSON.stringify(canonical(value)));
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
