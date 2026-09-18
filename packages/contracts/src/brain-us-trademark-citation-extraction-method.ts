import {
  factCandidateFingerprintMaterialV1,
  factCandidateFingerprintSha256V1,
  factCandidateSha256Utf8HexV1,
  parseFactCandidateV1,
  type FactCandidateEvidenceLocatorV1,
  type FactCandidateSourceDocumentV1,
  type FactCandidateV1
} from './fact-candidate-v1.js';
import { trademarkIntelligenceMethodFamiliesV1 } from './trademark-intelligence-method-family-v1.js';

export const US_TRADEMARK_CITATION_EXTRACTION_METHOD_ID =
  'us-trademark-citation-extraction' as const;
export const US_TRADEMARK_CITATION_EXTRACTION_METHOD_VERSION = '1.0.0' as const;
export const US_TRADEMARK_CITATION_VALIDATOR_ID = 'citation-candidate-validator' as const;
export const US_TRADEMARK_CITATION_VALIDATOR_VERSION = '1.0.0' as const;

export type UsTrademarkCitationValidationReasonV1 =
  'EVIDENCE_TEXT_HASH_MISMATCH' | 'CITED_MARK_NOT_EXPLICIT';

export interface ProposeUsTrademarkCitationFactCandidateInputV1 {
  candidateId: FactCandidateV1['candidateId'];
  producedAt: string;
  eventDate: string;
  subjectApplicationNumber: string;
  citedRegistrationNumber: string;
  sourceDocument: Readonly<FactCandidateSourceDocumentV1>;
  evidenceLocator: Readonly<FactCandidateEvidenceLocatorV1>;
  selectedText: string;
}

export type ValidateUsTrademarkCitationFactCandidateResultV1 =
  | {
      status: 'VALIDATED';
      candidate: Readonly<FactCandidateV1>;
    }
  | {
      status: 'REJECTED';
      reasonCode: UsTrademarkCitationValidationReasonV1;
      candidate: Readonly<FactCandidateV1>;
    };

export class UsTrademarkCitationExtractionError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'UsTrademarkCitationExtractionError';
  }
}

const US_SERIAL = /^\d{8}$/u;
const US_REGISTRATION = /^\d{5,8}$/u;

function text(value: unknown, field: string, maximum = 20_000): string {
  if (typeof value !== 'string') {
    throw new UsTrademarkCitationExtractionError(`${field} must be a string.`);
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    throw new UsTrademarkCitationExtractionError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  }
  return cleaned;
}

function instant(value: string, field: string): string {
  const cleaned = text(value, field, 100);
  if (Number.isNaN(Date.parse(cleaned)) || !cleaned.endsWith('Z')) {
    throw new UsTrademarkCitationExtractionError(`${field} must be a UTC ISO instant.`);
  }
  return cleaned;
}

function dateOnly(value: string, field: string): string {
  const cleaned = text(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(cleaned)) {
    throw new UsTrademarkCitationExtractionError(`${field} must be an ISO date.`);
  }
  const parsed = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || !parsed.toISOString().startsWith(cleaned)) {
    throw new UsTrademarkCitationExtractionError(`${field} must be a valid ISO date.`);
  }
  return cleaned;
}

function sha256Text(value: string): string {
  return factCandidateSha256Utf8HexV1(value);
}

function normalizedRegistration(value: string): string {
  return value.replace(/[^0-9]/gu, '');
}

function explicitUsRegistrationNumbers(value: string): readonly string[] {
  const matches = new Set<string>();
  const pattern =
    /\b(?:U\.?\s*S\.?\s*)?(?:Registration|Reg\.?)(?:\s+Number|\s+No\.?)?\s*[:#]?\s*([0-9][0-9,\s]{3,14}[0-9])/giu;
  for (const match of value.matchAll(pattern)) {
    const candidate = normalizedRegistration(match[1] ?? '');
    if (US_REGISTRATION.test(candidate)) matches.add(candidate);
  }
  return [...matches].sort();
}

export function containsExplicitUsTrademarkRegistrationCitationV1(
  selectedText: string,
  registrationNumber: string
): boolean {
  const normalized = normalizedRegistration(
    text(registrationNumber, 'citedRegistrationNumber', 32)
  );
  if (!US_REGISTRATION.test(normalized)) return false;
  return explicitUsRegistrationNumbers(text(selectedText, 'selectedText')).includes(normalized);
}

function assertLocatorMatchesSelectedText(
  locator: Readonly<FactCandidateEvidenceLocatorV1>,
  selectedText: string
): void {
  if (locator.textSha256 !== sha256Text(selectedText)) {
    throw new UsTrademarkCitationExtractionError(
      'evidenceLocator.textSha256 must match the exact selectedText bytes.'
    );
  }
}

function buildProposedCandidate(
  input: ProposeUsTrademarkCitationFactCandidateInputV1
): FactCandidateV1 {
  const producedAt = instant(input.producedAt, 'producedAt');
  const eventDate = dateOnly(input.eventDate, 'eventDate');
  const subjectApplicationNumber = text(
    input.subjectApplicationNumber,
    'subjectApplicationNumber',
    8
  );
  if (!US_SERIAL.test(subjectApplicationNumber)) {
    throw new UsTrademarkCitationExtractionError(
      'subjectApplicationNumber must contain exactly 8 digits.'
    );
  }
  const citedRegistrationNumber = normalizedRegistration(
    text(input.citedRegistrationNumber, 'citedRegistrationNumber', 32)
  );
  if (!US_REGISTRATION.test(citedRegistrationNumber)) {
    throw new UsTrademarkCitationExtractionError(
      'citedRegistrationNumber must contain 5 to 8 digits.'
    );
  }
  const selectedText = text(input.selectedText, 'selectedText');
  assertLocatorMatchesSelectedText(input.evidenceLocator, selectedText);
  if (!containsExplicitUsTrademarkRegistrationCitationV1(selectedText, citedRegistrationNumber)) {
    throw new UsTrademarkCitationExtractionError(
      'selectedText does not explicitly cite the requested U.S. registration number.'
    );
  }

  const candidateWithoutFingerprint = {
    contractVersion: 'MARKORBIT_FACT_CANDIDATE_V1' as const,
    objectType: 'FACT_CANDIDATE' as const,
    candidateId: input.candidateId,
    factType: 'CITED_AS_REFERENCE_FOR_REFUSAL' as const,
    jurisdiction: 'US' as const,
    subject: {
      resourceType: 'TRADEMARK' as const,
      applicationNumber: subjectApplicationNumber,
      registrationNumber: null
    },
    object: {
      resourceType: 'TRADEMARK' as const,
      applicationNumber: null,
      registrationNumber: citedRegistrationNumber
    },
    eventDate,
    effectiveDate: null,
    sourceDocument: { ...input.sourceDocument },
    evidenceLocator: { ...input.evidenceLocator },
    sourceAuthority: 'DIRECT_OFFICIAL' as const,
    extractionMethod: {
      owner: 'MARKORBIT_BRAIN_METHOD' as const,
      methodId: US_TRADEMARK_CITATION_EXTRACTION_METHOD_ID,
      methodVersion: US_TRADEMARK_CITATION_EXTRACTION_METHOD_VERSION
    },
    confidence: {
      scoreBasisPoints: 9900,
      evidenceLevel: 'EXPLICIT_DOCUMENT_TEXT' as const
    },
    legalConclusion: false as const
  };

  const candidate: FactCandidateV1 = {
    ...candidateWithoutFingerprint,
    candidateFingerprintSha256: '0'.repeat(64),
    ingestion: {
      status: 'PROPOSED',
      validation: null,
      admission: null
    },
    producedAt
  };
  candidate.candidateFingerprintSha256 = factCandidateFingerprintSha256V1(
    factCandidateFingerprintMaterialV1(candidate)
  );
  const parsed = parseFactCandidateV1(candidate);
  if (!parsed) {
    throw new UsTrademarkCitationExtractionError(
      'proposed citation candidate does not satisfy MARKORBIT_FACT_CANDIDATE_V1.'
    );
  }
  return parsed;
}

export function proposeUsTrademarkCitationFactCandidateV1(
  input: ProposeUsTrademarkCitationFactCandidateInputV1
): Readonly<FactCandidateV1> {
  return Object.freeze(buildProposedCandidate(input));
}
function rejectedCandidate(
  candidate: FactCandidateV1,
  reasonCode: UsTrademarkCitationValidationReasonV1,
  decidedAt: string
): Readonly<FactCandidateV1> {
  const rejected: FactCandidateV1 = {
    ...structuredClone(candidate),
    ingestion: {
      status: 'REJECTED',
      validation: {
        outcome: 'REJECTED',
        validatorId: US_TRADEMARK_CITATION_VALIDATOR_ID,
        validatorVersion: US_TRADEMARK_CITATION_VALIDATOR_VERSION,
        decidedAt,
        reasonCode
      },
      admission: null
    }
  };
  const parsed = parseFactCandidateV1(rejected);
  if (!parsed) {
    throw new UsTrademarkCitationExtractionError(
      'rejected citation candidate failed the shared Fact Candidate contract.'
    );
  }
  return Object.freeze(parsed);
}

function validatedCandidate(
  candidate: FactCandidateV1,
  decidedAt: string
): Readonly<FactCandidateV1> {
  const validated: FactCandidateV1 = {
    ...structuredClone(candidate),
    ingestion: {
      status: 'VALIDATED',
      validation: {
        outcome: 'ACCEPTED',
        validatorId: US_TRADEMARK_CITATION_VALIDATOR_ID,
        validatorVersion: US_TRADEMARK_CITATION_VALIDATOR_VERSION,
        decidedAt,
        reasonCode: null
      },
      admission: null
    }
  };
  const parsed = parseFactCandidateV1(validated);
  if (!parsed) {
    throw new UsTrademarkCitationExtractionError(
      'validated citation candidate failed the shared Fact Candidate contract.'
    );
  }
  return Object.freeze(parsed);
}

export function validateUsTrademarkCitationFactCandidateV1(
  candidateValue: unknown,
  input: Readonly<{ selectedText: string; decidedAt: string }>
): ValidateUsTrademarkCitationFactCandidateResultV1 {
  const candidate = parseFactCandidateV1(candidateValue);
  if (!candidate || candidate.ingestion.status !== 'PROPOSED') {
    throw new UsTrademarkCitationExtractionError(
      'validator requires a PROPOSED MARKORBIT_FACT_CANDIDATE_V1.'
    );
  }
  if (
    candidate.jurisdiction !== 'US' ||
    candidate.factType !== 'CITED_AS_REFERENCE_FOR_REFUSAL' ||
    candidate.extractionMethod.methodId !== US_TRADEMARK_CITATION_EXTRACTION_METHOD_ID ||
    candidate.extractionMethod.methodVersion !== US_TRADEMARK_CITATION_EXTRACTION_METHOD_VERSION
  ) {
    throw new UsTrademarkCitationExtractionError(
      'candidate was not produced by the admitted US citation extraction method version.'
    );
  }
  const decidedAt = instant(input.decidedAt, 'decidedAt');
  if (Date.parse(decidedAt) < Date.parse(candidate.producedAt)) {
    throw new UsTrademarkCitationExtractionError(
      'validation decidedAt cannot precede candidate production.'
    );
  }
  const selectedText = text(input.selectedText, 'selectedText');
  if (sha256Text(selectedText) !== candidate.evidenceLocator.textSha256) {
    return {
      status: 'REJECTED',
      reasonCode: 'EVIDENCE_TEXT_HASH_MISMATCH',
      candidate: rejectedCandidate(candidate, 'EVIDENCE_TEXT_HASH_MISMATCH', decidedAt)
    };
  }
  const citedRegistrationNumber = candidate.object.registrationNumber;
  if (
    !citedRegistrationNumber ||
    !containsExplicitUsTrademarkRegistrationCitationV1(selectedText, citedRegistrationNumber)
  ) {
    return {
      status: 'REJECTED',
      reasonCode: 'CITED_MARK_NOT_EXPLICIT',
      candidate: rejectedCandidate(candidate, 'CITED_MARK_NOT_EXPLICIT', decidedAt)
    };
  }
  return {
    status: 'VALIDATED',
    candidate: validatedCandidate(candidate, decidedAt)
  };
}

export function usTrademarkCitationExtractionResearchDescriptorV1() {
  const family = trademarkIntelligenceMethodFamiliesV1.find(
    (item) => item.familyId === 'US_CITATION_EXTRACTION'
  );
  if (!family) {
    throw new UsTrademarkCitationExtractionError(
      'US_CITATION_EXTRACTION method family is not registered.'
    );
  }
  return Object.freeze({
    methodId: US_TRADEMARK_CITATION_EXTRACTION_METHOD_ID,
    methodVersion: US_TRADEMARK_CITATION_EXTRACTION_METHOD_VERSION,
    validatorId: US_TRADEMARK_CITATION_VALIDATOR_ID,
    validatorVersion: US_TRADEMARK_CITATION_VALIDATOR_VERSION,
    family,
    outputContract: 'MARKORBIT_FACT_CANDIDATE_V1' as const,
    activationEligible: false as const,
    capabilityExecutionEnabled: false as const,
    officialFactAuthority: false as const,
    legalConclusionAllowed: false as const
  });
}

export function reproduceUsTrademarkCitationCandidateFingerprintV1(
  candidate: FactCandidateV1
): string {
  return factCandidateFingerprintSha256V1(factCandidateFingerprintMaterialV1(candidate));
}
