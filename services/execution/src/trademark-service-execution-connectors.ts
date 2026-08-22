import { createHash } from 'node:crypto';
import type {
  TrademarkServiceNonProductionConnectorBoundary,
  TrademarkServiceNonProductionConnectorDescriptor,
  TrademarkServiceNonProductionConnectorReceipt,
  TrademarkServiceNonProductionConnectorRequest
} from '@markorbit/contracts/trademark-service-execution-connector';
import type {
  TrademarkServiceProtectedActionKind,
  TrademarkServiceProtectedActionRelease
} from '@markorbit/contracts/trademark-service-execution';
import type {
  TrademarkServiceProtectedActionEnvironmentBinding,
  TrademarkServiceSandboxConnectorClass
} from '@markorbit/contracts/trademark-service-execution-sandbox';
import { TrademarkServiceExecutionError } from './trademark-service-execution.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sameWorkspace = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const iso = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()))
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Connector requestedAt must be a valid timestamp.'
    );
  return date.toISOString();
};

const expectedActionForBoundary: Readonly<
  Record<TrademarkServiceNonProductionConnectorBoundary, TrademarkServiceProtectedActionKind>
> = {
  PROVIDER: 'PROVIDER_INSTRUCTION',
  AUTHORITY_LIFECYCLE: 'AUTHORITY_FILING',
  PAYMENT_ADJACENT: 'PAYMENT'
};

export interface TrademarkServiceNonProductionConnector {
  readonly descriptor: TrademarkServiceNonProductionConnectorDescriptor;
  execute(
    request: Readonly<TrademarkServiceNonProductionConnectorRequest>
  ): TrademarkServiceNonProductionConnectorReceipt;
}

function validateRequest(
  request: Readonly<TrademarkServiceNonProductionConnectorRequest>,
  descriptor: Readonly<TrademarkServiceNonProductionConnectorDescriptor>
): {
  release: Readonly<TrademarkServiceProtectedActionRelease>;
  binding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>;
  recordedAt: string;
} {
  const { release, binding } = request;
  if (
    !sameWorkspace(request.workspaceId, release.workspaceId) ||
    binding.protectedActionReleaseId !== release.protectedActionReleaseId
  )
    throw new TrademarkServiceExecutionError(
      'WORKSPACE_MISMATCH',
      'Connector request does not belong to the protected action release.',
      404
    );

  if (release.action !== expectedActionForBoundary[descriptor.boundary])
    throw new TrademarkServiceExecutionError(
      'OWNER_MISMATCH',
      `Protected action ${release.action} cannot use the ${descriptor.boundary} connector boundary.`
    );

  if (binding.connectorClass !== descriptor.connectorClass || binding.mode !== descriptor.mode)
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Connector implementation does not match the durable sandbox connector policy.'
    );

  if (
    descriptor.mode === 'SIMULATED' &&
    (descriptor.connectorClass !== 'SIMULATOR' || binding.credentialClass !== 'NONE')
  )
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Simulation connectors must remain credential-free and in-process.'
    );

  if (descriptor.mode === 'TEST_CONNECTOR' && descriptor.connectorClass === 'SIMULATOR')
    throw new TrademarkServiceExecutionError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'TEST_CONNECTOR mode requires a dedicated non-production connector class.'
    );

  return { release, binding, recordedAt: iso(request.requestedAt) };
}

abstract class BaseNonProductionConnector implements TrademarkServiceNonProductionConnector {
  readonly descriptor: TrademarkServiceNonProductionConnectorDescriptor;

  protected constructor(
    boundary: TrademarkServiceNonProductionConnectorBoundary,
    connectorClass: TrademarkServiceSandboxConnectorClass,
    mode: 'SIMULATED' | 'TEST_CONNECTOR'
  ) {
    this.descriptor = {
      schemaVersion: 1,
      boundary,
      connectorClass,
      mode,
      liveExternalActionAuthorized: false,
      providerAcceptanceAuthority: false,
      officialFilingSuccessAuthority: false,
      paymentTruthAuthority: false,
      markRegLifecycleTruthAuthority: false,
      officialTruthAuthority: false
    };
  }

  execute(
    request: Readonly<TrademarkServiceNonProductionConnectorRequest>
  ): TrademarkServiceNonProductionConnectorReceipt {
    const { release, binding, recordedAt } = validateRequest(request, this.descriptor);
    const connectorAttemptId = `trademark-service-nonproduction-connector-attempt_${hash({
      workspaceId: request.workspaceId,
      protectedActionReleaseId: release.protectedActionReleaseId,
      requestFingerprintSha256: release.requestFingerprintSha256,
      boundary: this.descriptor.boundary,
      mode: binding.mode,
      connectorClass: binding.connectorClass,
      endpointClass: binding.endpointClass,
      credentialClass: binding.credentialClass,
      evidenceReferences: request.evidenceReferences,
      recordedAt
    }).slice(0, 32)}` as const;

    return {
      schemaVersion: 1,
      connectorAttemptId,
      workspaceId: request.workspaceId,
      protectedActionReleaseId: release.protectedActionReleaseId,
      action: release.action,
      boundary: this.descriptor.boundary,
      mode: binding.mode,
      connectorClass: binding.connectorClass,
      endpointClass: binding.endpointClass,
      credentialClass: binding.credentialClass,
      outcome:
        binding.mode === 'SIMULATED'
          ? 'SIMULATED_BOUNDARY_RECORDED'
          : 'TEST_CONNECTOR_BOUNDARY_RECORDED',
      evidenceReferences: [...request.evidenceReferences],
      recordedAt,
      testBoundaryOnly: true,
      liveExternalActionPerformed: false,
      providerAcceptanceCreated: false,
      officialFilingSuccessCreated: false,
      paymentTruthCreated: false,
      markRegLifecycleTruthCreated: false,
      officialTruthCreated: false
    };
  }
}

export class TrademarkServiceSimulationConnector extends BaseNonProductionConnector {
  constructor(boundary: TrademarkServiceNonProductionConnectorBoundary) {
    super(boundary, 'SIMULATOR', 'SIMULATED');
  }
}

export class TrademarkServiceProviderSandboxConnector extends BaseNonProductionConnector {
  constructor() {
    super('PROVIDER', 'PROVIDER_SANDBOX', 'TEST_CONNECTOR');
  }
}

export class TrademarkServiceAuthorityTestConnector extends BaseNonProductionConnector {
  constructor() {
    super('AUTHORITY_LIFECYCLE', 'AUTHORITY_TEST', 'TEST_CONNECTOR');
  }
}

export class TrademarkServicePaymentTestConnector extends BaseNonProductionConnector {
  constructor() {
    super('PAYMENT_ADJACENT', 'PAYMENT_TEST', 'TEST_CONNECTOR');
  }
}
