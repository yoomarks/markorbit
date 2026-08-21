import { createHash } from 'node:crypto';
import type {
  TrademarkServiceExecutionEnvironment,
  TrademarkServiceExecutionEnvironmentPolicy,
  TrademarkServiceExecutionMode,
  TrademarkServiceProtectedActionEnvironmentBinding,
  TrademarkServiceProtectedActionReplayContext,
  TrademarkServiceSandboxConnectorClass,
  TrademarkServiceSandboxCredentialClass,
  TrademarkServiceSandboxEndpointClass
} from '@markorbit/contracts/trademark-service-execution-sandbox';
import type {
  TrademarkServiceExecutionAuthorization,
  TrademarkServiceProtectedActionRelease
} from '@markorbit/contracts/trademark-service-execution';
import { TrademarkServiceExecutionError } from './trademark-service-execution.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sameWorkspace = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const iso = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()))
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Environment policy createdAt must be a valid timestamp.'
    );
  return date.toISOString();
};

export interface CreateTrademarkServiceExecutionEnvironmentPolicyCommand {
  workspaceId: string;
  authorization: Readonly<TrademarkServiceExecutionAuthorization>;
  environment: TrademarkServiceExecutionEnvironment;
  mode: TrademarkServiceExecutionMode;
  connectorClass: TrademarkServiceSandboxConnectorClass;
  endpointClass: TrademarkServiceSandboxEndpointClass;
  credentialClass: TrademarkServiceSandboxCredentialClass;
  createdAt: string;
}

export function createTrademarkServiceExecutionEnvironmentPolicy(
  command: Readonly<CreateTrademarkServiceExecutionEnvironmentPolicyCommand>
): TrademarkServiceExecutionEnvironmentPolicy {
  if (!sameWorkspace(command.workspaceId, command.authorization.workspaceId))
    throw new TrademarkServiceExecutionError(
      'WORKSPACE_MISMATCH',
      'Execution authorization belongs to another Workspace.',
      404
    );

  if (command.mode === 'SIMULATED') {
    if (command.connectorClass !== 'SIMULATOR' || command.credentialClass !== 'NONE')
      throw new TrademarkServiceExecutionError(
        'AUTHORITY_BOUNDARY_VIOLATION',
        'Simulated execution cannot use connector credentials or a non-simulator connector.'
      );
    if (command.endpointClass === 'ALLOWLISTED_SANDBOX')
      throw new TrademarkServiceExecutionError(
        'AUTHORITY_BOUNDARY_VIOLATION',
        'Simulated execution cannot target an external sandbox endpoint.'
      );
  } else if (command.connectorClass === 'SIMULATOR') {
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'TEST_CONNECTOR mode requires an explicit non-production connector class.'
    );
  }

  const createdAt = iso(command.createdAt);
  const replayContext: TrademarkServiceProtectedActionReplayContext = {
    environmentPolicyId: `trademark-service-execution-environment-policy_${hash({
      workspaceId: command.workspaceId,
      authorizationId: command.authorization.executionAuthorizationId,
      environment: command.environment,
      mode: command.mode,
      connectorClass: command.connectorClass,
      endpointClass: command.endpointClass,
      credentialClass: command.credentialClass
    }).slice(0, 32)}`,
    environment: command.environment,
    mode: command.mode,
    connectorClass: command.connectorClass,
    endpointClass: command.endpointClass,
    credentialClass: command.credentialClass
  };

  return {
    schemaVersion: 1,
    ...replayContext,
    workspaceId: command.workspaceId,
    executionAuthorizationId: command.authorization.executionAuthorizationId,
    createdAt,
    immutable: true,
    nonProduction: true,
    productionEnvironmentAuthorized: false,
    productionCredentialsAllowed: false,
    unrestrictedEgressAllowed: false,
    liveExternalActionAuthorized: false,
    officialTruthCreated: false
  };
}

export function replayContextFromEnvironmentPolicy(
  policy: Readonly<TrademarkServiceExecutionEnvironmentPolicy>
): TrademarkServiceProtectedActionReplayContext {
  return {
    environmentPolicyId: policy.environmentPolicyId,
    environment: policy.environment,
    mode: policy.mode,
    connectorClass: policy.connectorClass,
    endpointClass: policy.endpointClass,
    credentialClass: policy.credentialClass
  };
}

export function bindTrademarkServiceProtectedActionToEnvironment(command: {
  workspaceId: string;
  release: Readonly<TrademarkServiceProtectedActionRelease>;
  policy: Readonly<TrademarkServiceExecutionEnvironmentPolicy>;
}): TrademarkServiceProtectedActionEnvironmentBinding {
  if (
    !sameWorkspace(command.workspaceId, command.release.workspaceId) ||
    !sameWorkspace(command.workspaceId, command.policy.workspaceId)
  )
    throw new TrademarkServiceExecutionError(
      'WORKSPACE_MISMATCH',
      'Protected action environment binding crossed Workspace boundaries.',
      404
    );
  if (command.release.executionAuthorizationId !== command.policy.executionAuthorizationId)
    throw new TrademarkServiceExecutionError(
      'OWNER_MISMATCH',
      'Environment policy is not owned by this execution authorization.'
    );

  return {
    schemaVersion: 1,
    protectedActionReleaseId: command.release.protectedActionReleaseId,
    ...replayContextFromEnvironmentPolicy(command.policy),
    immutable: true,
    environmentAndModeIncludedInReplayIdentity: true,
    crossEnvironmentReplayAllowed: false,
    crossModeReplayAllowed: false
  };
}
