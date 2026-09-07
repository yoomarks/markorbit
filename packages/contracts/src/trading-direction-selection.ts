import type { MarkOrbitId } from './index.js';
import type { ProductLoopExactReference } from './product-loop.js';
import type {
  TradingCommercialDirectionId,
  TradingCommercialDirectionSetId,
  TradingCommercialDirectionSetV1
} from './trading-commercial-direction.js';

export type TradingDirectionSelectionId = `trading-direction-selection_${string}`;
export type TradingDirectionSelectionStatus = 'CURRENT' | 'SUPERSEDED';

export const tradingDirectionSelectionAuthorityConsequencesV1 = Object.freeze({
  humanSelectionRecorded: true,
  deepBuildStarted: false,
  listingCreated: false,
  trademarkTruthMutated: false
});
export type TradingDirectionSelectionAuthorityConsequencesV1 =
  typeof tradingDirectionSelectionAuthorityConsequencesV1;

export interface TradingDirectionSelectionV1 {
  schemaVersion: 1;
  directionSelectionId: TradingDirectionSelectionId;
  workspaceId: string;
  version: number;
  status: TradingDirectionSelectionStatus;
  directionSet: Readonly<ProductLoopExactReference<TradingCommercialDirectionSetId>>;
  selectedDirection: Readonly<ProductLoopExactReference<TradingCommercialDirectionId>>;
  selectionMethod: 'EXPLICIT_HUMAN_ACTION';
  selectedAt: string;
  correlationId: MarkOrbitId;
  authorityConsequences: TradingDirectionSelectionAuthorityConsequencesV1;
}

/** Trusted server context supplies Workspace and actor authority. */
export interface CreateTradingDirectionSelectionCommandV1 {
  schemaVersion: 1;
  directionSetId: TradingCommercialDirectionSetId;
  expectedDirectionSetVersion: number;
  selectedDirectionId: TradingCommercialDirectionId;
  expectedDirectionVersion: number;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export class TradingDirectionSelectionValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingDirectionSelectionValidationError';
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new TradingDirectionSelectionValidationError(`${field} is required.`);
}

function version(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TradingDirectionSelectionValidationError(`${field} must be a positive integer.`);
}

function timestamp(value: string, field: string): void {
  if (!value.trim() || Number.isNaN(Date.parse(value)))
    throw new TradingDirectionSelectionValidationError(`${field} must be an ISO timestamp.`);
}

function assertAuthority(consequences: TradingDirectionSelectionAuthorityConsequencesV1): void {
  if (
    consequences.humanSelectionRecorded !== true ||
    consequences.deepBuildStarted !== false ||
    consequences.listingCreated !== false ||
    consequences.trademarkTruthMutated !== false
  )
    throw new TradingDirectionSelectionValidationError(
      'A direction selection records only the explicit human choice.'
    );
}

export function assertCreateTradingDirectionSelectionCommandV1(
  command: Readonly<CreateTradingDirectionSelectionCommandV1>
): void {
  if (command.schemaVersion !== 1)
    throw new TradingDirectionSelectionValidationError('command.schemaVersion must be 1.');
  if (!/^commercial-direction-set_[A-Za-z0-9_-]+$/u.test(command.directionSetId))
    throw new TradingDirectionSelectionValidationError('command.directionSetId is invalid.');
  if (
    !/^trading-ai-derived_commercial-direction_[A-Za-z0-9_-]+$/u.test(command.selectedDirectionId)
  )
    throw new TradingDirectionSelectionValidationError('command.selectedDirectionId is invalid.');
  version(command.expectedDirectionSetVersion, 'command.expectedDirectionSetVersion');
  version(command.expectedDirectionVersion, 'command.expectedDirectionVersion');
  required(command.idempotencyKey, 'command.idempotencyKey');
  required(command.correlationId, 'command.correlationId');
}

/** Proves that a durable selection names one exact candidate from one exact direction set. */
export function assertTradingDirectionSelectionV1(
  selection: Readonly<TradingDirectionSelectionV1>,
  directionSet: Readonly<TradingCommercialDirectionSetV1>
): void {
  if (selection.schemaVersion !== 1)
    throw new TradingDirectionSelectionValidationError('selection.schemaVersion must be 1.');
  if (!/^trading-direction-selection_[A-Za-z0-9_-]+$/u.test(selection.directionSelectionId))
    throw new TradingDirectionSelectionValidationError(
      'selection.directionSelectionId is invalid.'
    );
  required(selection.workspaceId, 'selection.workspaceId');
  version(selection.version, 'selection.version');
  if (selection.status !== 'CURRENT' && selection.status !== 'SUPERSEDED')
    throw new TradingDirectionSelectionValidationError('selection.status is invalid.');
  if (
    selection.workspaceId !== directionSet.workspaceId ||
    selection.directionSet.id !== directionSet.commercialDirectionSetId ||
    selection.directionSet.version !== directionSet.version
  )
    throw new TradingDirectionSelectionValidationError(
      'Selection must reference the exact direction set in the same Workspace.'
    );
  const candidate = directionSet.directions.find(
    (direction) =>
      direction.commercialDirectionId === selection.selectedDirection.id &&
      direction.version === selection.selectedDirection.version
  );
  if (!candidate)
    throw new TradingDirectionSelectionValidationError(
      'Selection must reference one exact DirectionVersion in the direction set.'
    );
  if (selection.selectionMethod !== 'EXPLICIT_HUMAN_ACTION')
    throw new TradingDirectionSelectionValidationError(
      'AI or automatic direction selection is forbidden.'
    );
  timestamp(selection.selectedAt, 'selection.selectedAt');
  required(selection.correlationId, 'selection.correlationId');
  assertAuthority(selection.authorityConsequences);
}
