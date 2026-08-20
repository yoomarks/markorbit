import type { Money } from './index.js';
import type { ProductLoopExactReference } from './product-loop.js';
import type { TrademarkAssetId, TrademarkAssetSourceReference } from './trademark-asset-workspace.js';

export type TrademarkServiceWorkPackageId = `trademark-service-work-package_${string}`;
export type TrademarkServiceRequirementId = `trademark-service-requirement_${string}`;
export type TrademarkServicePreparationId = `trademark-service-preparation_${string}`;
export type TrademarkServiceExecutionReadinessId = `trademark-service-execution-readiness_${string}`;

export const trademarkServiceIntentKinds = [
  'NEW_APPLICATION',
  'RENEWAL',
  'USE_DECLARATION',
  'OFFICE_ACTION_RESPONSE',
  'OPPOSITION_RESPONSE',
  'CANCELLATION_OR_INVALIDATION',
  'ASSIGNMENT_OR_TRANSFER_RECORDAL',
  'OWNER_NAME_OR_ADDRESS_CHANGE',
  'LICENSE_OR_OTHER_RECORDAL',
  'CERTIFICATE_REISSUE',
  'RESTORATION_OR_REVIVAL',
  'SEARCH_OR_CLEARANCE',
  'WATCH_OR_MONITORING',
  'EVIDENCE_PREPARATION',
  'OTHER_REVIEW_REQUIRED'
] as const;
export type TrademarkServiceIntentKind = (typeof trademarkServiceIntentKinds)[number];

export const trademarkServiceReadinessStates = [
  'DRAFT',
  'CONTEXT_INCOMPLETE',
  'REQUIREMENTS_REVIEW_REQUIRED',
  'MISSING_CLIENT_INPUT',
  'PROVIDER_INPUT_REQUIRED',
  'COMMERCIAL_REVIEW_REQUIRED',
  'READY_FOR_USER_CONFIRMATION',
  'READY_FOR_EXECUTION_PREPARATION'
] as const;
export type TrademarkServiceReadinessState = (typeof trademarkServiceReadinessStates)[number];

export const trademarkServiceRequirementKinds = [
  'IDENTITY',
  'JURISDICTION',
  'TIMING_OR_DEADLINE_REVIEW',
  'DOCUMENT',
  'EVIDENCE',
  'TRANSLATION',
  'NOTARIZATION',
  'LEGALIZATION_OR_APOSTILLE',
  'ORIGINAL_OR_HARD_COPY',
  'OWNER_DOMAIN_REVIEW',
  'CAPABILITY',
  'PROVIDER',
  'COMMERCIAL',
  'OTHER_REVIEW_REQUIRED'
] as const;
export type TrademarkServiceRequirementKind = (typeof trademarkServiceRequirementKinds)[number];

export const trademarkServiceRequirementStatuses = [
  'CANDIDATE',
  'PRESENT',
  'MISSING',
  'UNKNOWN',
  'REVIEW_REQUIRED',
  'NOT_APPLICABLE'
] as const;
export type TrademarkServiceRequirementStatus =
  (typeof trademarkServiceRequirementStatuses)[number];

export const trademarkServiceMissingInputReasons = [
  'ASSET_CONTEXT_MISSING',
  'MATTER_CONTEXT_MISSING',
  'JURISDICTION_CONTEXT_MISSING',
  'CLIENT_INFORMATION_MISSING',
  'DOCUMENT_MISSING',
  'EVIDENCE_MISSING',
  'OWNER_DOMAIN_REVIEW_MISSING',
  'CAPABILITY_CONTEXT_MISSING',
  'PROVIDER_CONTEXT_MISSING',
  'COMMERCIAL_CONTEXT_MISSING',
  'SOURCE_CONFLICT_OR_STALENESS',
  'OTHER_REVIEW_REQUIRED'
] as const;
export type TrademarkServiceMissingInputReason =
  (typeof trademarkServiceMissingInputReasons)[number];

export interface TrademarkServiceIntent {
  kind: TrademarkServiceIntentKind;
  jurisdiction: string;
  title: string;
  rationale: string;
  inferredFromProductContext: boolean;
  reviewedByUser: boolean;
  legalConclusionCreated: false;
  serviceAvailabilityVerified: false;
  legalDeadlineCertified: false;
}

export interface TrademarkServiceRequirementCandidate {
  schemaVersion: 1;
  requirementId: TrademarkServiceRequirementId;
  workspaceId: string;
  workPackageId: TrademarkServiceWorkPackageId;
  kind: TrademarkServiceRequirementKind;
  status: TrademarkServiceRequirementStatus;
  title: string;
  explanation: string;
  jurisdiction: string;
  sourceReferences: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  sourceFreshnessReviewed: boolean;
  professionalReviewRequired: boolean;
  certifiedLegalRequirement: false;
  legalDeadlineCertified: false;
  officialTruthVerifiedByLite: false;
  createdAt: string;
}

export interface TrademarkServiceMissingInput {
  reason: TrademarkServiceMissingInputReason;
  title: string;
  explanation: string;
  blocking: boolean;
  relatedRequirementId?: TrademarkServiceRequirementId;
}

export interface TrademarkServiceReadiness {
  state: TrademarkServiceReadinessState;
  presentRequirementCount: number;
  blockingMissingCount: number;
  reviewRequiredCount: number;
  evaluatedAt: string;
  preparationCompletenessOnly: true;
  successProbabilityCalculated: false;
  filingEligibilityCertified: false;
  legalValidityCertified: false;
}

export interface TrademarkServiceCapabilityCandidate {
  capabilityReference: string;
  capabilityVersion?: string;
  reason: string;
  verifiedCapability: false;
}

export interface TrademarkServiceProviderCandidate {
  providerReference: string;
  capabilityReference?: string;
  reason: string;
  engaged: false;
  selectedForExecution: false;
}

export interface TrademarkServicePackageCandidate {
  servicePackageReference: string;
  capabilityReference?: string;
  providerReference?: string;
  description: string;
  sourceVersion?: string;
  selected: false;
}

export interface TrademarkServiceQuoteCandidate {
  currency: string;
  lines: ReadonlyArray<{
    code: string;
    description: string;
    category: 'OFFICIAL_FEE' | 'SERVICE_FEE' | 'DISBURSEMENT' | 'TAX' | 'OTHER';
    amount: Readonly<Money>;
  }>;
  total: Readonly<Money>;
  assumptions: readonly string[];
  limitations: readonly string[];
  bindingQuote: false;
  paymentAuthorized: false;
}

export interface TrademarkServiceCommunicationDraft {
  preparationId: TrademarkServicePreparationId;
  kind: 'CLIENT_INFORMATION_REQUEST' | 'PROVIDER_ENQUIRY' | 'PROVIDER_INSTRUCTION';
  subject: string;
  body: string;
  recipientReference?: string;
  sent: false;
  externalContactAuthorized: false;
}

export interface TrademarkServiceWorkPackage {
  schemaVersion: 1;
  workPackageId: TrademarkServiceWorkPackageId;
  workspaceId: string;
  version: number;
  asset?: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  matterReference?: string;
  managementRecommendationReference?: string;
  intent: Readonly<TrademarkServiceIntent>;
  requirementCandidates: ReadonlyArray<Readonly<TrademarkServiceRequirementCandidate>>;
  missingInputs: ReadonlyArray<Readonly<TrademarkServiceMissingInput>>;
  readiness: Readonly<TrademarkServiceReadiness>;
  capabilityCandidates: ReadonlyArray<Readonly<TrademarkServiceCapabilityCandidate>>;
  providerCandidates: ReadonlyArray<Readonly<TrademarkServiceProviderCandidate>>;
  servicePackageCandidates: ReadonlyArray<Readonly<TrademarkServicePackageCandidate>>;
  quoteCandidate?: Readonly<TrademarkServiceQuoteCandidate>;
  communicationDrafts: ReadonlyArray<Readonly<TrademarkServiceCommunicationDraft>>;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  parallelMatterLifecycleCreated: false;
  officialTruthCreated: false;
  protectedActionAuthorized: false;
}

export interface TrademarkServiceExecutionReadiness {
  schemaVersion: 1;
  executionReadinessId: TrademarkServiceExecutionReadinessId;
  workspaceId: string;
  workPackage: Readonly<ProductLoopExactReference<TrademarkServiceWorkPackageId>>;
  readinessState: 'READY_FOR_EXECUTION_PREPARATION';
  reviewedByUserId: string;
  reviewedAt: string;
  ownerDomainValidationReferences: readonly string[];
  evidenceReferences: readonly string[];
  executionPreparationReference?: string;
  executionAuthorized: false;
  filingAuthorized: false;
  externalContactAuthorized: false;
  paymentAuthorized: false;
  publicationAuthorized: false;
  providerEngagementAuthorized: false;
}

export const trademarkServiceWorkbenchAuthority = {
  mayPrepareServiceIntent: true,
  mayComposeRequirementCandidates: true,
  mayAssessPreparationCompleteness: true,
  mayDetectMissingInputs: true,
  mayPrepareCapabilityProviderAndPackageCandidates: true,
  mayPrepareNonBindingQuoteCandidate: true,
  mayPrepareUnsentCommunicationDrafts: true,
  mayPrepareExecutionReadinessReferenceAfterReview: true,
  mayCreateLegalConclusion: false,
  mayCertifyLegalRequirement: false,
  mayCertifyLegalDeadline: false,
  mayCalculateSuccessProbability: false,
  mayVerifyOfficialTruth: false,
  mayVerifyCapability: false,
  mayEngageProvider: false,
  mayBindQuote: false,
  mayContactExternally: false,
  mayAuthorizePayment: false,
  mayFileOrPublishExternally: false,
  mayBypassOwnerDomainValidation: false,
  mayUseCrossServiceSql: false
} as const;

export const noAutomaticTrademarkServiceConsequences = [
  'LEGAL_CONCLUSION',
  'CERTIFIED_LEGAL_REQUIREMENT',
  'CERTIFIED_DEADLINE',
  'SUCCESS_PROBABILITY',
  'OFFICIAL_TRUTH_VERIFICATION',
  'CAPABILITY_VERIFICATION',
  'PROVIDER_ENGAGEMENT',
  'BINDING_QUOTE',
  'CUSTOMER_PROVIDER_OR_AUTHORITY_CONTACT',
  'PAYMENT',
  'FILING_OR_RECORDAL',
  'EXTERNAL_PUBLICATION',
  'OWNER_DOMAIN_VALIDATION_BYPASS'
] as const;
