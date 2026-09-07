import type { ProductLoopExactReference } from './product-loop.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TradingStandardStudioRunId = `standard-studio-run_${string}`;
export type TradingUsageLedgerEntryId = `usage-ledger-entry_${string}`;

/** Exact entitlement supplied by the Account/Billing owner. */
export interface TradingStudioEntitlementReferenceV1 {
  ownerReference: string;
  entitlementId: string;
  entitlementVersion: number | string;
  entitlementType: string;
}

export const noTradingStudioUsageAuthorityConsequencesV1 = Object.freeze({
  studioRunCompleted: false,
  entitlementChanged: false,
  subscriptionChanged: false,
  invoiceCreated: false,
  paymentCreated: false,
  trademarkTruthMutated: false
});
export type TradingStudioUsageAuthorityConsequencesV1 =
  typeof noTradingStudioUsageAuthorityConsequencesV1;

/**
 * Account/Billing-owned ledger entry for one completed Standard Studio Run. The usage unit is the
 * whole run: individual generated assets and reasonable in-run regeneration are not billable
 * units in this contract.
 */
export interface TradingStandardStudioRunUsageEntryV1 {
  schemaVersion: 1;
  usageLedgerEntryId: TradingUsageLedgerEntryId;
  userId: string;
  workspaceId: string;
  trademarkAsset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  studioRun: Readonly<ProductLoopExactReference<TradingStandardStudioRunId>>;
  entitlement: Readonly<TradingStudioEntitlementReferenceV1>;
  usageUnit: 'STANDARD_STUDIO_RUN';
  amount: 1;
  idempotencyKey: string;
  completedAt: string;
  recordedAt: string;
  authorityConsequences: TradingStudioUsageAuthorityConsequencesV1;
}

export class TradingStudioUsageValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingStudioUsageValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingStudioUsageValidationError(`${field} is required.`);
}

function exactVersion(value: number | string, field: string): void {
  if (
    (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1)) ||
    (typeof value === 'string' && !value.trim())
  )
    throw new TradingStudioUsageValidationError(`${field} must identify a version.`);
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!value.trim() || Number.isNaN(parsed))
    throw new TradingStudioUsageValidationError(`${field} must be an ISO timestamp.`);
  return parsed;
}

/** Validates an owner-produced ledger entry without granting entitlement or charging the user. */
export function assertTradingStandardStudioRunUsageEntryV1(
  entry: Readonly<TradingStandardStudioRunUsageEntryV1>
): void {
  if (entry.schemaVersion !== 1)
    throw new TradingStudioUsageValidationError('tradingStudioUsage.schemaVersion must be 1.');
  if (!/^usage-ledger-entry_[A-Za-z0-9_-]+$/u.test(entry.usageLedgerEntryId))
    throw new TradingStudioUsageValidationError(
      'tradingStudioUsage.usageLedgerEntryId is invalid.'
    );
  required(entry.userId, 'tradingStudioUsage.userId');
  required(entry.workspaceId, 'tradingStudioUsage.workspaceId');
  if (!/^trademark-asset_[A-Za-z0-9_-]+$/u.test(entry.trademarkAsset.id))
    throw new TradingStudioUsageValidationError(
      'tradingStudioUsage.trademarkAsset.id must be a Trademark Asset id.'
    );
  exactVersion(entry.trademarkAsset.version, 'tradingStudioUsage.trademarkAsset.version');
  if (!/^standard-studio-run_[A-Za-z0-9_-]+$/u.test(entry.studioRun.id))
    throw new TradingStudioUsageValidationError('tradingStudioUsage.studioRun.id is invalid.');
  exactVersion(entry.studioRun.version, 'tradingStudioUsage.studioRun.version');
  required(entry.entitlement.ownerReference, 'tradingStudioUsage.entitlement.ownerReference');
  required(entry.entitlement.entitlementId, 'tradingStudioUsage.entitlement.entitlementId');
  exactVersion(
    entry.entitlement.entitlementVersion,
    'tradingStudioUsage.entitlement.entitlementVersion'
  );
  required(entry.entitlement.entitlementType, 'tradingStudioUsage.entitlement.entitlementType');
  if (entry.usageUnit !== 'STANDARD_STUDIO_RUN' || entry.amount !== 1)
    throw new TradingStudioUsageValidationError(
      'tradingStudioUsage must record exactly one STANDARD_STUDIO_RUN.'
    );
  required(entry.idempotencyKey, 'tradingStudioUsage.idempotencyKey');
  const completedAt = timestamp(entry.completedAt, 'tradingStudioUsage.completedAt');
  const recordedAt = timestamp(entry.recordedAt, 'tradingStudioUsage.recordedAt');
  if (recordedAt < completedAt)
    throw new TradingStudioUsageValidationError(
      'tradingStudioUsage.recordedAt cannot precede completedAt.'
    );
  for (const [key, value] of Object.entries(entry.authorityConsequences)) {
    if (value !== false)
      throw new TradingStudioUsageValidationError(
        `tradingStudioUsage.authorityConsequences.${key} must be false.`
      );
  }
}
