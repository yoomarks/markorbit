import type { TrademarkServiceProtectedActionReleaseId } from './trademark-service-execution.js';
import type {
  TrademarkServiceExecutionEnvironment,
  TrademarkServiceExecutionEnvironmentPolicyId,
  TrademarkServiceExecutionMode,
  TrademarkServiceSandboxConnectorClass,
  TrademarkServiceSandboxCredentialClass,
  TrademarkServiceSandboxEndpointClass
} from './trademark-service-execution-sandbox.js';

export type TrademarkServiceIsolationDecisionId = `trademark-service-isolation-decision_${string}`;
export type TrademarkServiceTestCredentialReference = `test-credential_${string}`;

export const trademarkServiceSandboxEgressModes = [
  'DISABLED',
  'LOOPBACK_ONLY',
  'INTERNAL_TEST_ONLY',
  'ALLOWLIST_ONLY'
] as const;
export type TrademarkServiceSandboxEgressMode = (typeof trademarkServiceSandboxEgressModes)[number];

export interface TrademarkServiceTrustedConnectorRuntimePolicy {
  schemaVersion: 1;
  source: 'SERVER_TRUSTED_CONFIGURATION';
  environment: TrademarkServiceExecutionEnvironment;
  mode: TrademarkServiceExecutionMode;
  connectorClass: TrademarkServiceSandboxConnectorClass;
  endpointClass: TrademarkServiceSandboxEndpointClass;
  credentialClass: TrademarkServiceSandboxCredentialClass;
  egressMode: TrademarkServiceSandboxEgressMode;
  endpointUrl?: string;
  allowedHosts: readonly string[];
  testCredentialReference?: TrademarkServiceTestCredentialReference;
  productionCredentialPresent: false;
  unrestrictedEgressAllowed: false;
  clientSuppliedEndpointTrusted: false;
}

export interface TrademarkServiceIsolationDecision {
  schemaVersion: 1;
  isolationDecisionId: TrademarkServiceIsolationDecisionId;
  workspaceId: string;
  protectedActionReleaseId: TrademarkServiceProtectedActionReleaseId;
  environmentPolicyId: TrademarkServiceExecutionEnvironmentPolicyId;
  environment: TrademarkServiceExecutionEnvironment;
  mode: TrademarkServiceExecutionMode;
  connectorClass: TrademarkServiceSandboxConnectorClass;
  endpointClass: TrademarkServiceSandboxEndpointClass;
  credentialClass: TrademarkServiceSandboxCredentialClass;
  egressMode: TrademarkServiceSandboxEgressMode;
  endpointHost?: string;
  testCredentialReference?: TrademarkServiceTestCredentialReference;
  permitted: true;
  trustedPolicyMatchedDurableBinding: true;
  productionCredentialUsed: false;
  unrestrictedEgressUsed: false;
  liveExternalActionAuthorized: false;
}

export const trademarkServiceExecutionIsolationAuthority = {
  mayUseServerTrustedSandboxConfiguration: true,
  mayUseExactHostAllowlist: true,
  mayUseLoopbackOrInternalTestEndpoints: true,
  mayUseTestCredentialReference: true,
  mayTrustClientSuppliedEndpoint: false,
  mayUseProductionCredentials: false,
  mayUseUnrestrictedEgress: false,
  mayAuthorizeLiveExternalAction: false,
  mayInferEnvironmentFromUrlOrCredential: false
} as const;
