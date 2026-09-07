import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  managedAiNoAuthorityConsequences,
  parseManagedAiExecutionOutcomeV1,
  type ManagedAiImplementationProvenanceV1
} from './managed-ai-execution.js';
import type { ProductLoopExactReference } from './product-loop.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingAiDerivedObjectId = `trading-ai-derived_${string}`;

export const tradingAiTruthClasses = ['AI_INFERENCE', 'AI_CONCEPT'] as const;
export type TradingAiTruthClass = (typeof tradingAiTruthClasses)[number];

export const tradingAiCurrentnessStates = ['CURRENT', 'STALE', 'UNKNOWN'] as const;
export type TradingAiCurrentnessState = (typeof tradingAiCurrentnessStates)[number];

/** Exact input owned by another contract boundary. */
export interface TradingAiSourceReferenceV1 {
  ownerReference: string;
  sourceId: string;
  sourceVersion: number | string;
}

export interface TradingAiCurrentnessV1 {
  state: TradingAiCurrentnessState;
  evaluatedAt: string;
}

export const noTradingAiAuthorityConsequencesV1 = Object.freeze({
  trademarkTruthMutated: false,
  officialTruthCreated: false,
  humanApprovalCreated: false,
  listingPublicationCreated: false,
  ownershipOrAuthorityVerified: false
});
export type TradingAiAuthorityConsequencesV1 = typeof noTradingAiAuthorityConsequencesV1;

/**
 * Lineage shared by durable Trading AI-derived objects. Managed AI remains the owner of
 * provider/model/workflow provenance; this contract only binds that evidence to exact inputs and
 * a versioned derived object. It does not turn an inference or concept into Trademark Truth.
 */
export interface TradingAiProvenanceV1 {
  schemaVersion: 1;
  derivedObject: Readonly<ProductLoopExactReference<TradingAiDerivedObjectId>>;
  truthClass: TradingAiTruthClass;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  sourceReferences: readonly Readonly<TradingAiSourceReferenceV1>[];
  implementation: Readonly<ManagedAiImplementationProvenanceV1>;
  createdAt: string;
  currentness: Readonly<TradingAiCurrentnessV1>;
  authorityConsequences: TradingAiAuthorityConsequencesV1;
}

export class TradingAiProvenanceValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingAiProvenanceValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingAiProvenanceValidationError(`${field} is required.`);
}

function exactVersion(value: number | string, field: string): void {
  if (
    (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1)) ||
    (typeof value === 'string' && !value.trim())
  )
    throw new TradingAiProvenanceValidationError(`${field} must identify a version.`);
}

function timestamp(value: string, field: string): void {
  if (!value.trim() || Number.isNaN(Date.parse(value)))
    throw new TradingAiProvenanceValidationError(`${field} must be an ISO timestamp.`);
}

/** Validates lineage and its no-authority boundary without creating or refreshing the object. */
export function assertTradingAiProvenanceV1(provenance: Readonly<TradingAiProvenanceV1>): void {
  if (provenance.schemaVersion !== 1)
    throw new TradingAiProvenanceValidationError('tradingAiProvenance.schemaVersion must be 1.');
  if (!/^trading-ai-derived_[A-Za-z0-9_-]+$/u.test(provenance.derivedObject.id))
    throw new TradingAiProvenanceValidationError(
      'tradingAiProvenance.derivedObject.id must be a Trading AI-derived object id.'
    );
  exactVersion(provenance.derivedObject.version, 'tradingAiProvenance.derivedObject.version');
  if (!tradingAiTruthClasses.includes(provenance.truthClass))
    throw new TradingAiProvenanceValidationError(
      'tradingAiProvenance.truthClass must be AI_INFERENCE or AI_CONCEPT.'
    );
  if (!/^trademark-asset_[A-Za-z0-9_-]+$/u.test(provenance.trademarkAsset.id))
    throw new TradingAiProvenanceValidationError(
      'tradingAiProvenance.trademarkAsset.id must be a Trademark Asset id.'
    );
  exactVersion(provenance.trademarkAsset.version, 'tradingAiProvenance.trademarkAsset.version');
  if (!provenance.sourceReferences.length)
    throw new TradingAiProvenanceValidationError(
      'tradingAiProvenance.sourceReferences must contain exact source lineage.'
    );
  provenance.sourceReferences.forEach((source, index) => {
    required(
      source.ownerReference,
      `tradingAiProvenance.sourceReferences[${index}].ownerReference`
    );
    required(source.sourceId, `tradingAiProvenance.sourceReferences[${index}].sourceId`);
    exactVersion(
      source.sourceVersion,
      `tradingAiProvenance.sourceReferences[${index}].sourceVersion`
    );
  });

  try {
    parseManagedAiExecutionOutcomeV1({
      schemaVersion: 1,
      capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
      capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
      status: 'COMPLETED',
      deliveryState: 'PROVIDER_COMPLETED',
      retryDisposition: 'RETRY_FORBIDDEN',
      provenance: provenance.implementation,
      authority: managedAiNoAuthorityConsequences
    });
  } catch (error) {
    throw new TradingAiProvenanceValidationError(
      `tradingAiProvenance.implementation must be valid Managed AI provenance: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  timestamp(provenance.createdAt, 'tradingAiProvenance.createdAt');
  if (!tradingAiCurrentnessStates.includes(provenance.currentness.state))
    throw new TradingAiProvenanceValidationError(
      'tradingAiProvenance.currentness.state is invalid.'
    );
  timestamp(provenance.currentness.evaluatedAt, 'tradingAiProvenance.currentness.evaluatedAt');
  for (const [key, value] of Object.entries(provenance.authorityConsequences)) {
    if (value !== false)
      throw new TradingAiProvenanceValidationError(
        `tradingAiProvenance.authorityConsequences.${key} must be false.`
      );
  }
}
