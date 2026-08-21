import type {
  TrademarkServiceExecutionAuthorizationId,
  TrademarkServiceProtectedActionReleaseId
} from './trademark-service-execution.js';

export type TrademarkServiceExecutionEnvironmentPolicyId =
  `trademark-service-execution-environment-policy_${string}`;

export const trademarkServiceExecutionEnvironments = [
  'LOCAL',
  'CI',
  'SANDBOX',
  'PROVIDER_TEST'
] as const;
export type TrademarkServiceExecutionEnvironment =
  (typeof trademarkServiceExecutionEnvironments)[number];

export const trademarkServiceExecutionModes = ['SIMULATED', 'TEST_CONNECTOR'] as const;
export type TrademarkServiceExecutionMode = (typeof trademarkServiceExecutionModes)[number];

export const trademarkServiceSandboxConnectorClasses = [
  'SIMULATOR',
  'PROVIDER_SANDBOX',
  'AUTHORITY_TEST',
  'PAYMENT_TEST'
] as const;
export type TrademarkServiceSandboxConnectorClass =
  (typeof trademarkServiceSandboxConnectorClasses)[number];

export const trademarkServiceSandboxEndpointClasses = [
  'LOOPBACK',
  'INTERNAL_TEST',
  'ALLOWLISTED_SANDBOX'
] as const;
export type TrademarkServiceSandboxEndpointClass =
  (typeof trademarkServiceSandboxEndpointClasses)[number];

export const trademarkServiceSandboxCredentialClasses = ['NONE', 'TEST_ONLY'] as const;
export type TrademarkServiceSandboxCredentialClass =
  (typeof trademarkServiceSandboxCredentialClasses)[number];

export interface TrademarkServiceProtectedActionReplayContext {
  environmentPolicyId: TrademarkServiceExecutionEnvironmentPolicyId;
  environment: TrademarkServiceExecutionEnvironment;
  mode: TrademarkServiceExecutionMode;
  connectorClass: TrademarkServiceSandboxConnectorClass;
  endpointClass: TrademarkServiceSandboxEndpointClass;
  credentialClass: TrademarkServiceSandboxCredentialClass;
}

export interface TrademarkServiceExecutionEnvironmentPolicy extends TrademarkServiceProtectedActionReplayContext {
  schemaVersion: 1;
  workspaceId: string;
  executionAuthorizationId: TrademarkServiceExecutionAuthorizationId;
  createdAt: string;
  immutable: true;
  nonProduction: true;
  productionEnvironmentAuthorized: false;
  productionCredentialsAllowed: false;
  unrestrictedEgressAllowed: false;
  liveExternalActionAuthorized: false;
  officialTruthCreated: false;
}

export interface TrademarkServiceProtectedActionEnvironmentBinding extends TrademarkServiceProtectedActionReplayContext {
  schemaVersion: 1;
  protectedActionReleaseId: TrademarkServiceProtectedActionReleaseId;
  immutable: true;
  environmentAndModeIncludedInReplayIdentity: true;
  crossEnvironmentReplayAllowed: false;
  crossModeReplayAllowed: false;
}

export const trademarkServiceExecutionSandboxAuthority = {
  mayCreateNonProductionEnvironmentPolicy: true,
  maySimulateProtectedAction: true,
  mayUseNonProductionTestConnector: true,
  mayBindProtectedActionToEnvironment: true,
  mayUseProductionEnvironment: false,
  mayUseProductionCredentials: false,
  mayUseUnrestrictedEgress: false,
  mayPerformLiveFiling: false,
  mayPerformLivePayment: false,
  mayContactLiveProvider: false,
  mayPublishLive: false,
  mayCreateOfficialTruth: false,
  mayMutateMarkRegLifecycleDirectly: false,
  mayUseCrossServiceSql: false
} as const;
