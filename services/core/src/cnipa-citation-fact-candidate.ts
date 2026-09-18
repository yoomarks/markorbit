import { createHash } from 'node:crypto';
import {
  FACT_CANDIDATE_CONTRACT_VERSION_V1,
  FACT_CANDIDATE_OBJECT_TYPE_V1,
  factCandidateFingerprintMaterialV1,
  factCandidateFingerprintSha256V1,
  parseFactCandidateV1,
  type FactCandidateEvidenceLocatorV1,
  type FactCandidateV1,
  type TrademarkFactReferenceV1
} from '@markorbit/contracts/fact-candidate-v1';

export type CnipaCitationCandidateProducerErrorCode =
  | 'INVALID_INPUT'
  | 'IDENTITY_MISMATCH'
  | 'EVIDENCE_MISMATCH'
  | 'CITED_MARK_NOT_EXPLICIT'
  | 'CONTRACT_REJECTED';

export class CnipaCitationCandidateProducerError extends Error {
  constructor(
    readonly code: CnipaCitationCandidateProducerErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CnipaCitationCandidateProducerError';
  }
}

export interface CnipaJudgmentFactReference {
  jurisdiction: 'CN';
  documentKind: 'REGISTRATION_EXAMINATION' | 'OPPOSITION_DECISION' | 'REVIEW_ADJUDICATION';
  sourceRecordId: string;
  applicationNumber: string | null;
  registrationNumber: string | null;
  eventDate: string;
  sourceRowSha256: string;
}

export interface CnipaKnowledgeDocumentReference {
  owner: 'MARKORBIT_KNOWLEDGE';
  sourceId: string;
  documentId: string;
  documentVersion: number;
  documentSha256: string;
  sourceUri: string;
  documentKind: CnipaJudgmentFactReference['documentKind'];
  sourceRecordId: string;
}

export interface CnipaCitationCandidateInput {
  candidateId: string;
  producedAt: string;
  dataEngineFact: Readonly<CnipaJudgmentFactReference>;
  knowledgeDocument: Readonly<CnipaKnowledgeDocumentReference>;
  evidenceLocator: Readonly<FactCandidateEvidenceLocatorV1>;
  selectedOfficialText: string;
  citedTrademark: Readonly<TrademarkFactReferenceV1>;
  extractionMethod: Readonly<{
    owner: 'MARKORBIT_BRAIN_METHOD';
    methodId: string;
    methodVersion: string;
  }>;
  confidenceScoreBasisPoints: number;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function fail(code: CnipaCitationCandidateProducerErrorCode, message: string): never {
  throw new CnipaCitationCandidateProducerError(code, message);
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) fail('INVALID_INPUT', `${label} is required.`);
  return normalized;
}

function trademarkIdentity(reference: Readonly<TrademarkFactReferenceV1>): string {
  if (reference.applicationNumber) return reference.applicationNumber;
  if (reference.registrationNumber) return reference.registrationNumber;
  return fail('INVALID_INPUT', 'Cited trademark requires an application or registration number.');
}

function subjectFromFact(fact: Readonly<CnipaJudgmentFactReference>): TrademarkFactReferenceV1 {
  if (!fact.applicationNumber && !fact.registrationNumber)
    return fail(
      'INVALID_INPUT',
      'CNIPA LIST fact has no trademark application/registration identity.'
    );
  return {
    resourceType: 'TRADEMARK',
    applicationNumber: fact.applicationNumber,
    registrationNumber: fact.registrationNumber
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertInput(input: Readonly<CnipaCitationCandidateInput>): void {
  const fact = input.dataEngineFact;
  const document = input.knowledgeDocument;
  if (fact.jurisdiction !== 'CN')
    fail('INVALID_INPUT', 'CNIPA citation producer accepts CN facts only.');
  if (!nonEmpty(fact.sourceRecordId, 'dataEngineFact.sourceRecordId'))
    fail('INVALID_INPUT', 'CNIPA source record id is required.');
  if (!SHA256.test(fact.sourceRowSha256))
    fail('INVALID_INPUT', 'CNIPA source row SHA-256 is invalid.');
  if (!DATE.test(fact.eventDate))
    fail('INVALID_INPUT', 'CNIPA fact eventDate must use YYYY-MM-DD.');
  if (
    document.owner !== 'MARKORBIT_KNOWLEDGE' ||
    document.documentKind !== fact.documentKind ||
    document.sourceRecordId !== fact.sourceRecordId
  ) {
    fail(
      'IDENTITY_MISMATCH',
      'Knowledge document does not match the Data Engine CNIPA fact identity.'
    );
  }
  const selectedText = nonEmpty(input.selectedOfficialText, 'selectedOfficialText');
  if (input.evidenceLocator.endOffset - input.evidenceLocator.startOffset !== selectedText.length)
    fail(
      'EVIDENCE_MISMATCH',
      'Evidence locator range length does not match selected official text.'
    );
  if (sha256(selectedText) !== input.evidenceLocator.textSha256)
    fail('EVIDENCE_MISMATCH', 'Selected official text does not match evidence locator SHA-256.');
  const citedIdentity = trademarkIdentity(input.citedTrademark);
  if (!selectedText.includes(citedIdentity))
    fail(
      'CITED_MARK_NOT_EXPLICIT',
      'Cited trademark identifier is not explicit in selected official text.'
    );
  if (
    !Number.isSafeInteger(input.confidenceScoreBasisPoints) ||
    input.confidenceScoreBasisPoints < 0 ||
    input.confidenceScoreBasisPoints > 10_000
  ) {
    fail('INVALID_INPUT', 'confidenceScoreBasisPoints must be an integer between 0 and 10000.');
  }
}

export function produceCnipaCitationFactCandidateV1(
  input: Readonly<CnipaCitationCandidateInput>
): Readonly<FactCandidateV1> {
  assertInput(input);
  const fact = input.dataEngineFact;
  const document = input.knowledgeDocument;
  const sourceDocument = {
    owner: 'MARKORBIT_KNOWLEDGE' as const,
    sourceId: document.sourceId,
    documentId: document.documentId,
    documentVersion: document.documentVersion,
    documentSha256: document.documentSha256,
    sourceUri: document.sourceUri
  };
  const material = {
    contractVersion: FACT_CANDIDATE_CONTRACT_VERSION_V1,
    objectType: FACT_CANDIDATE_OBJECT_TYPE_V1,
    factType: 'CITED_AS_REFERENCE_FOR_REFUSAL' as const,
    jurisdiction: 'CN' as const,
    subject: subjectFromFact(fact),
    object: structuredClone(input.citedTrademark),
    eventDate: fact.eventDate,
    effectiveDate: null,
    sourceDocument,
    evidenceLocator: structuredClone(input.evidenceLocator),
    sourceAuthority: 'DIRECT_OFFICIAL' as const,
    extractionMethod: structuredClone(input.extractionMethod),
    confidence: {
      scoreBasisPoints: input.confidenceScoreBasisPoints,
      evidenceLevel: 'EXPLICIT_DOCUMENT_TEXT' as const
    },
    legalConclusion: false as const
  };
  const candidate: FactCandidateV1 = {
    ...material,
    candidateId: input.candidateId,
    candidateFingerprintSha256: factCandidateFingerprintSha256V1(material),
    ingestion: {
      status: 'PROPOSED',
      validation: null,
      admission: null
    },
    producedAt: input.producedAt
  };
  const parsed = parseFactCandidateV1(candidate);
  if (!parsed)
    return fail(
      'CONTRACT_REJECTED',
      'Produced CNIPA citation candidate failed shared contract validation.'
    );
  if (
    parsed.candidateFingerprintSha256 !==
    factCandidateFingerprintSha256V1(factCandidateFingerprintMaterialV1(parsed))
  ) {
    return fail(
      'CONTRACT_REJECTED',
      'Produced CNIPA citation candidate fingerprint is not reproducible.'
    );
  }
  return parsed;
}
