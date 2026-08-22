import type {
  TrademarkServiceNonProductionConnectorAttemptId,
  TrademarkServiceNonProductionConnectorBoundary
} from './trademark-service-execution-connector.js';
import type {
  TrademarkServiceProtectedActionKind,
  TrademarkServiceProtectedActionReleaseId
} from './trademark-service-execution.js';

export const trademarkServiceSimulationScenarios = [
  'SUCCESS',
  'REJECTION',
  'TIMEOUT',
  'AMBIGUOUS_RETURN',
  'DUPLICATE_RESPONSE',
  'STALE_RESPONSE',
  'MALFORMED_RESPONSE'
] as const;
export type TrademarkServiceSimulationScenario =
  (typeof trademarkServiceSimulationScenarios)[number];

export const trademarkServiceSimulationClassifications = [
  'SIMULATED_SUCCESS',
  'SIMULATED_REJECTION',
  'SIMULATED_TIMEOUT',
  'SIMULATED_AMBIGUOUS_RETURN',
  'SIMULATED_DUPLICATE_RESPONSE',
  'SIMULATED_STALE_RESPONSE',
  'SIMULATED_MALFORMED_RESPONSE'
] as const;
export type TrademarkServiceSimulationClassification =
  (typeof trademarkServiceSimulationClassifications)[number];

export type TrademarkServiceSimulationFixtureId =
  `trademark-service-simulation-fixture_${string}`;
export type TrademarkServiceSimulationResponseId =
  `trademark-service-simulation-response_${string}`;

export interface TrademarkServiceSimulationEvidence {
  schemaVersion: 1;
  fixtureId: TrademarkServiceSimulationFixtureId;
  simulationResponseId: TrademarkServiceSimulationResponseId;
  workspaceId: string;
  protectedActionReleaseId: TrademarkServiceProtectedActionReleaseId;
  connectorAttemptId: TrademarkServiceNonProductionConnectorAttemptId;
  action: TrademarkServiceProtectedActionKind;
  boundary: TrademarkServiceNonProductionConnectorBoundary;
  scenario: TrademarkServiceSimulationScenario;
  classification: TrademarkServiceSimulationClassification;
  source: 'MARKORBIT_DETERMINISTIC_SIMULATOR';
  evidenceClass: 'SIMULATION_EVIDENCE';
  transportState: 'COMPLETED' | 'TIMED_OUT' | 'AMBIGUOUS';
  sourceFreshness: 'CURRENT_FIXTURE' | 'STALE_FIXTURE' | 'NOT_APPLICABLE';
  parseValidity: 'VALID_FIXTURE' | 'MALFORMED_FIXTURE' | 'NOT_APPLICABLE';
  duplicateOfSimulationResponseId?: TrademarkServiceSimulationResponseId;
  requiresHumanReview: boolean;
  retryClassification: 'NO_RETRY' | 'MANUAL_REVIEW_REQUIRED';
  evidenceReferences: readonly string[];
  simulatedAt: string;
  providerClaim: false;
  providerAcceptanceCreated: false;
  officialFilingSuccessCreated: false;
  paymentTruthCreated: false;
  markRegLifecycleTruthCreated: false;
  officialTruthCreated: false;
  liveExternalActionPerformed: false;
  automaticRetryAuthorized: false;
}

export const trademarkServiceSimulationAuthority = Object.freeze({
  mayGenerateDeterministicSimulationEvidence: true,
  mayRepresentProviderClaim: false,
  mayCreateProviderAcceptance: false,
  mayCreateOfficialFilingSuccess: false,
  mayCreatePaymentTruth: false,
  mayCreateMarkRegLifecycleTruth: false,
  mayCreateOfficialTruth: false,
  mayPerformLiveExternalAction: false,
  mayAuthorizeAutomaticExternalRetry: false,
  mayUseProductionCredential: false,
  mayUseProductionConnector: false
});
