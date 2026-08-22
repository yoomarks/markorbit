import type {
  TrademarkServiceExecutionAuthorization,
  TrademarkServiceExecutionPlan,
  TrademarkServiceProtectedActionRelease,
  TrademarkServiceRecoveryState
} from './trademark-service-execution.js';
import type { TrademarkServiceIsolationDecision } from './trademark-service-execution-isolation.js';
import type {
  TrademarkServiceExecutionEnvironmentPolicy,
  TrademarkServiceProtectedActionEnvironmentBinding
} from './trademark-service-execution-sandbox.js';
import type { TrademarkServiceSimulationEvidence } from './trademark-service-execution-simulation.js';

export type TrademarkServiceOperatorReadinessBundleId =
  `trademark-service-operator-readiness-bundle_${string}`;

export interface TrademarkServiceOperatorReadinessBundle {
  schemaVersion: 1;
  operatorReadinessBundleId: TrademarkServiceOperatorReadinessBundleId;
  workspaceId: string;
  authorization: Readonly<TrademarkServiceExecutionAuthorization>;
  plan: Readonly<TrademarkServiceExecutionPlan>;
  environmentPolicy: Readonly<TrademarkServiceExecutionEnvironmentPolicy>;
  release: Readonly<TrademarkServiceProtectedActionRelease>;
  environmentBinding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>;
  isolationDecision?: Readonly<TrademarkServiceIsolationDecision>;
  simulationEvidence?: Readonly<TrademarkServiceSimulationEvidence>;
  connectorMode: TrademarkServiceExecutionEnvironmentPolicy['mode'];
  endpointClass: TrademarkServiceExecutionEnvironmentPolicy['endpointClass'];
  evidenceReferences: readonly string[];
  recovery: Readonly<TrademarkServiceRecoveryState>;
  unresolvedHumanActions: readonly string[];
  reviewState: 'READY_FOR_OPERATOR_REVIEW' | 'HUMAN_ACTION_REQUIRED';
  authorityAuditPassed: true;
  environmentBindingVerified: true;
  evidenceSeparatedFromOfficialTruth: true;
  productionEnvironmentAuthorized: false;
  productionCredentialsAuthorized: false;
  liveExternalActionAuthorized: false;
  deploymentApproved: false;
  productionEnablementAuthorized: false;
  officialTruthCreated: false;
  createdAt: string;
}

export const trademarkServiceOperatorReadinessBundleAuthority = Object.freeze({
  mayComposeOperatorReviewEvidence: true,
  maySurfaceUnresolvedHumanActions: true,
  mayApproveDeployment: false,
  mayAuthorizeProductionEnablement: false,
  mayAuthorizeProductionCredentials: false,
  mayAuthorizeLiveExternalAction: false,
  mayCreateOfficialTruth: false,
  mayMutateOwnerDomainTruth: false
});
