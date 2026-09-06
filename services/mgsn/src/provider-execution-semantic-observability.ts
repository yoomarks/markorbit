import type {
  ProviderAcceptanceRecord,
  RespondToAllocationServiceCommand
} from './allocation-provider-acceptance.js';
import type {
  CreateProviderReturnServiceCommand,
  ProviderReturnRecord
} from './provider-return.js';
import {
  observeMgsnSemanticOperationV1,
  type MgsnSemanticTelemetrySinkV1
} from './semantic-observability.js';

interface ProviderAcceptanceTelemetryTarget {
  respondToAllocation(command: RespondToAllocationServiceCommand): Promise<ProviderAcceptanceRecord>;
}

interface ProviderReturnTelemetryTarget {
  createProviderReturn(command: CreateProviderReturnServiceCommand): Promise<ProviderReturnRecord>;
}

export interface ProviderExecutionTelemetryServices {
  allocationProviderAcceptance: ProviderAcceptanceTelemetryTarget;
  providerReturn: ProviderReturnTelemetryTarget;
}

export function withProviderExecutionSemanticTelemetry<
  T extends ProviderExecutionTelemetryServices
>(services: T, sink: Readonly<MgsnSemanticTelemetrySinkV1> | undefined): T {
  if (!sink) return services;

  const allocationProviderAcceptance = Object.create(
    services.allocationProviderAcceptance
  ) as T['allocationProviderAcceptance'];
  allocationProviderAcceptance.respondToAllocation = (command) =>
    observeMgsnSemanticOperationV1(
      sink,
      'PROVIDER_ACCEPTANCE_RECORD',
      () => services.allocationProviderAcceptance.respondToAllocation(command),
      (result) => ({
        outcomeClass: 'SUCCESS',
        resultCode: result.decision === 'ACCEPTED' ? 'PROVIDER_ACCEPTED' : 'PROVIDER_DECLINED'
      })
    );

  const providerReturn = Object.create(services.providerReturn) as T['providerReturn'];
  providerReturn.createProviderReturn = (command) =>
    observeMgsnSemanticOperationV1(
      sink,
      'PROVIDER_RETURN_CREATE_OR_CORRECT',
      () => services.providerReturn.createProviderReturn(command),
      (result) => ({
        outcomeClass: 'SUCCESS',
        resultCode: result.supersedes ? 'PROVIDER_RETURN_CORRECTED' : 'PROVIDER_RETURN_SUBMITTED'
      })
    );

  return {
    ...services,
    allocationProviderAcceptance,
    providerReturn
  } as T;
}
