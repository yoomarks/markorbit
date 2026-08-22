import { createHash } from 'node:crypto';
import type {
  TrademarkServiceNonProductionConnectorRequest,
  TrademarkServiceNonProductionConnectorReceipt
} from '@markorbit/contracts/trademark-service-execution-connector';
import type {
  TrademarkServiceSimulationClassification,
  TrademarkServiceSimulationEvidence,
  TrademarkServiceSimulationResponseId,
  TrademarkServiceSimulationScenario
} from '@markorbit/contracts/trademark-service-execution-simulation';
import type { TrademarkServiceNonProductionConnector } from './trademark-service-execution-connectors.js';
import { TrademarkServiceExecutionError } from './trademark-service-execution.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const classificationFor: Readonly<
  Record<TrademarkServiceSimulationScenario, TrademarkServiceSimulationClassification>
> = {
  SUCCESS: 'SIMULATED_SUCCESS',
  REJECTION: 'SIMULATED_REJECTION',
  TIMEOUT: 'SIMULATED_TIMEOUT',
  AMBIGUOUS_RETURN: 'SIMULATED_AMBIGUOUS_RETURN',
  DUPLICATE_RESPONSE: 'SIMULATED_DUPLICATE_RESPONSE',
  STALE_RESPONSE: 'SIMULATED_STALE_RESPONSE',
  MALFORMED_RESPONSE: 'SIMULATED_MALFORMED_RESPONSE'
};

const transportStateFor: Readonly<
  Record<TrademarkServiceSimulationScenario, TrademarkServiceSimulationEvidence['transportState']>
> = {
  SUCCESS: 'COMPLETED',
  REJECTION: 'COMPLETED',
  TIMEOUT: 'TIMED_OUT',
  AMBIGUOUS_RETURN: 'AMBIGUOUS',
  DUPLICATE_RESPONSE: 'COMPLETED',
  STALE_RESPONSE: 'COMPLETED',
  MALFORMED_RESPONSE: 'COMPLETED'
};

function responseId(base: unknown, scenario: TrademarkServiceSimulationScenario) {
  return `trademark-service-simulation-response_${hash({ base, scenario }).slice(0, 32)}` as TrademarkServiceSimulationResponseId;
}

export interface TrademarkServiceDeterministicSimulationCommand {
  scenario: TrademarkServiceSimulationScenario;
  request: Readonly<TrademarkServiceNonProductionConnectorRequest>;
  connector: TrademarkServiceNonProductionConnector;
}

export interface TrademarkServiceDeterministicSimulationResult {
  receipt: TrademarkServiceNonProductionConnectorReceipt;
  evidence: TrademarkServiceSimulationEvidence;
}

export class TrademarkServiceDeterministicSimulationRunner {
  run(
    command: Readonly<TrademarkServiceDeterministicSimulationCommand>
  ): TrademarkServiceDeterministicSimulationResult {
    if (
      command.request.binding.mode !== 'SIMULATED' ||
      command.request.binding.connectorClass !== 'SIMULATOR' ||
      command.request.binding.credentialClass !== 'NONE' ||
      command.connector.descriptor.mode !== 'SIMULATED' ||
      command.connector.descriptor.connectorClass !== 'SIMULATOR'
    )
      throw new TrademarkServiceExecutionError(
        'AUTHORITY_BOUNDARY_VIOLATION',
        'Deterministic fixtures may only run through the credential-free simulation connector.'
      );

    const receipt = command.connector.execute(command.request);
    const base = {
      workspaceId: command.request.workspaceId,
      protectedActionReleaseId: command.request.release.protectedActionReleaseId,
      requestFingerprintSha256: command.request.release.requestFingerprintSha256,
      environmentPolicyId: command.request.binding.environmentPolicyId,
      environment: command.request.binding.environment,
      mode: command.request.binding.mode,
      connectorClass: command.request.binding.connectorClass,
      endpointClass: command.request.binding.endpointClass,
      credentialClass: command.request.binding.credentialClass,
      boundary: receipt.boundary,
      action: receipt.action,
      connectorAttemptId: receipt.connectorAttemptId,
      evidenceReferences: command.request.evidenceReferences,
      requestedAt: command.request.requestedAt
    };
    const simulationResponseId = responseId(base, command.scenario);
    const requiresHumanReview = !['SUCCESS', 'REJECTION'].includes(command.scenario);

    const evidence: TrademarkServiceSimulationEvidence = {
      schemaVersion: 1,
      fixtureId: `trademark-service-simulation-fixture_${hash({ base, scenario: command.scenario }).slice(0, 32)}`,
      simulationResponseId,
      workspaceId: command.request.workspaceId,
      protectedActionReleaseId: command.request.release.protectedActionReleaseId,
      connectorAttemptId: receipt.connectorAttemptId,
      action: receipt.action,
      boundary: receipt.boundary,
      scenario: command.scenario,
      classification: classificationFor[command.scenario],
      source: 'MARKORBIT_DETERMINISTIC_SIMULATOR',
      evidenceClass: 'SIMULATION_EVIDENCE',
      transportState: transportStateFor[command.scenario],
      sourceFreshness: command.scenario === 'STALE_RESPONSE' ? 'STALE_FIXTURE' : 'CURRENT_FIXTURE',
      parseValidity:
        command.scenario === 'MALFORMED_RESPONSE' ? 'MALFORMED_FIXTURE' : 'VALID_FIXTURE',
      ...(command.scenario === 'DUPLICATE_RESPONSE'
        ? { duplicateOfSimulationResponseId: responseId(base, 'SUCCESS') }
        : {}),
      requiresHumanReview,
      retryClassification: requiresHumanReview ? 'MANUAL_REVIEW_REQUIRED' : 'NO_RETRY',
      evidenceReferences: [...command.request.evidenceReferences],
      simulatedAt: command.request.requestedAt,
      providerClaim: false,
      providerAcceptanceCreated: false,
      officialFilingSuccessCreated: false,
      paymentTruthCreated: false,
      markRegLifecycleTruthCreated: false,
      officialTruthCreated: false,
      liveExternalActionPerformed: false,
      automaticRetryAuthorized: false
    };

    return { receipt, evidence };
  }
}
