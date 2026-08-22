import type {
  TrademarkServiceProtectedActionKind,
  TrademarkServiceProtectedActionRelease,
  TrademarkServiceProtectedActionReleaseId
} from './trademark-service-execution.js';
import type {
  TrademarkServiceExecutionMode,
  TrademarkServiceProtectedActionEnvironmentBinding,
  TrademarkServiceSandboxConnectorClass,
  TrademarkServiceSandboxCredentialClass,
  TrademarkServiceSandboxEndpointClass
} from './trademark-service-execution-sandbox.js';

export type TrademarkServiceNonProductionConnectorAttemptId =
  `trademark-service-nonproduction-connector-attempt_${string}`;

export const trademarkServiceNonProductionConnectorBoundaries = [
  'PROVIDER',
  'AUTHORITY_LIFECYCLE',
  'PAYMENT_ADJACENT'
] as const;
export type TrademarkServiceNonProductionConnectorBoundary =
  (typeof trademarkServiceNonProductionConnectorBoundaries)[number];

export interface TrademarkServiceNonProductionConnectorDescriptor {
  schemaVersion: 1;
  boundary: TrademarkServiceNonProductionConnectorBoundary;
  connectorClass: TrademarkServiceSandboxConnectorClass;
  mode: TrademarkServiceExecutionMode;
  liveExternalActionAuthorized: false;
  providerAcceptanceAuthority: false;
  officialFilingSuccessAuthority: false;
  paymentTruthAuthority: false;
  markRegLifecycleTruthAuthority: false;
  officialTruthAuthority: false;
}

export interface TrademarkServiceNonProductionConnectorRequest {
  schemaVersion: 1;
  workspaceId: string;
  release: Readonly<TrademarkServiceProtectedActionRelease>;
  binding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>;
  evidenceReferences: readonly string[];
  requestedAt: string;
}

export interface TrademarkServiceNonProductionConnectorReceipt {
  schemaVersion: 1;
  connectorAttemptId: TrademarkServiceNonProductionConnectorAttemptId;
  workspaceId: string;
  protectedActionReleaseId: TrademarkServiceProtectedActionReleaseId;
  action: TrademarkServiceProtectedActionKind;
  boundary: TrademarkServiceNonProductionConnectorBoundary;
  mode: TrademarkServiceExecutionMode;
  connectorClass: TrademarkServiceSandboxConnectorClass;
  endpointClass: TrademarkServiceSandboxEndpointClass;
  credentialClass: TrademarkServiceSandboxCredentialClass;
  outcome: 'SIMULATED_BOUNDARY_RECORDED' | 'TEST_CONNECTOR_BOUNDARY_RECORDED';
  evidenceReferences: readonly string[];
  recordedAt: string;
  testBoundaryOnly: true;
  liveExternalActionPerformed: false;
  providerAcceptanceCreated: false;
  officialFilingSuccessCreated: false;
  paymentTruthCreated: false;
  markRegLifecycleTruthCreated: false;
  officialTruthCreated: false;
}

export const trademarkServiceNonProductionConnectorAuthority = {
  mayExerciseProviderBoundaryInSimulationOrTest: true,
  mayExerciseAuthorityLifecycleBoundaryInSimulationOrTest: true,
  mayExercisePaymentAdjacentBoundaryInSimulationOrTest: true,
  mayPerformLiveExternalAction: false,
  mayCreateProviderAcceptance: false,
  mayCreateOfficialFilingSuccess: false,
  mayCreatePaymentTruth: false,
  mayCreateMarkRegLifecycleTruth: false,
  mayCreateOfficialTruth: false,
  mayUseProductionConnector: false,
  mayUseCrossServiceSql: false
} as const;
