import { describe, expect, it } from 'vitest';
import type {
  ProviderAcceptanceRecord,
  RespondToAllocationServiceCommand
} from '../src/allocation-provider-acceptance.js';
import {
  type ProviderExecutionTelemetryServices,
  withProviderExecutionSemanticTelemetry
} from '../src/provider-execution-semantic-observability.js';
import type {
  CreateProviderReturnServiceCommand,
  ProviderReturnRecord
} from '../src/provider-return.js';
import {
  InMemoryMgsnSemanticTelemetrySinkV1,
  type MgsnSemanticTelemetrySinkV1
} from '../src/semantic-observability.js';

function acceptance(decision: 'ACCEPTED' | 'DECLINED'): ProviderAcceptanceRecord {
  return { decision } as ProviderAcceptanceRecord;
}

function providerReturn(corrected: boolean): ProviderReturnRecord {
  return {
    ...(corrected ? { supersedes: { id: 'provider-return_previous', version: 1 } } : {})
  } as ProviderReturnRecord;
}

function servicesFor(input?: {
  acceptance?: (command: RespondToAllocationServiceCommand) => Promise<ProviderAcceptanceRecord>;
  providerReturn?: (command: CreateProviderReturnServiceCommand) => Promise<ProviderReturnRecord>;
}): ProviderExecutionTelemetryServices {
  return {
    allocationProviderAcceptance: {
      respondToAllocation: input?.acceptance ?? (() => Promise.resolve(acceptance('ACCEPTED')))
    },
    providerReturn: {
      createProviderReturn: input?.providerReturn ?? (() => Promise.resolve(providerReturn(false)))
    }
  };
}

const acceptanceCommand = {
  acknowledgement: 'private provider acknowledgement',
  workspaceId: 'private-workspace-id'
} as RespondToAllocationServiceCommand;

const returnCommand = {
  artifacts: [{ reference: 'private-artifact-reference' }],
  assertions: [{ code: 'private-code', value: 'private assertion text', evidenceReferences: [] }]
} as CreateProviderReturnServiceCommand;

describe('provider execution semantic observability', () => {
  it('records ACCEPTED and DECLINED as distinct operational facts without retaining commands', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    let decision: 'ACCEPTED' | 'DECLINED' = 'ACCEPTED';
    const services = withProviderExecutionSemanticTelemetry(
      servicesFor({ acceptance: () => Promise.resolve(acceptance(decision)) }),
      sink
    );

    await services.allocationProviderAcceptance.respondToAllocation(acceptanceCommand);
    decision = 'DECLINED';
    await services.allocationProviderAcceptance.respondToAllocation(acceptanceCommand);

    expect(sink.list().map((event) => event.resultCode)).toEqual([
      'PROVIDER_ACCEPTED',
      'PROVIDER_DECLINED'
    ]);
    expect(sink.list().every((event) => event.operation === 'PROVIDER_ACCEPTANCE_RECORD')).toBe(true);
    const serialized = JSON.stringify(sink.list());
    expect(serialized).not.toContain('private provider acknowledgement');
    expect(serialized).not.toContain('private-workspace-id');
  });

  it('records initial Provider Return and correction without retaining artifacts or assertions', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    let corrected = false;
    const services = withProviderExecutionSemanticTelemetry(
      servicesFor({ providerReturn: () => Promise.resolve(providerReturn(corrected)) }),
      sink
    );

    await services.providerReturn.createProviderReturn(returnCommand);
    corrected = true;
    await services.providerReturn.createProviderReturn(returnCommand);

    expect(sink.list().map((event) => event.resultCode)).toEqual([
      'PROVIDER_RETURN_SUBMITTED',
      'PROVIDER_RETURN_CORRECTED'
    ]);
    expect(
      sink.list().every((event) => event.operation === 'PROVIDER_RETURN_CREATE_OR_CORRECT')
    ).toBe(true);
    const serialized = JSON.stringify(sink.list());
    expect(serialized).not.toContain('private-artifact-reference');
    expect(serialized).not.toContain('private assertion text');
  });

  it('preserves exact domain failures while recording bounded conflict and dependency classes', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    const stale = Object.assign(new Error('private stale return details'), {
      code: 'RETURN_SUPERSEDED',
      status: 409
    });
    const services = withProviderExecutionSemanticTelemetry(
      servicesFor({ providerReturn: () => Promise.reject(stale) }),
      sink
    );

    await expect(services.providerReturn.createProviderReturn(returnCommand)).rejects.toBe(stale);
    expect(sink.list()[0]).toMatchObject({
      outcomeClass: 'CONFLICT',
      resultCode: 'STALE_OR_VERSION_CONFLICT',
      errorMessageRetained: false
    });
    expect(JSON.stringify(sink.list()[0])).not.toContain('private stale return details');
  });

  it('never lets telemetry failure change the Provider execution result', async () => {
    const failingSink: MgsnSemanticTelemetrySinkV1 = {
      record: () => Promise.reject(new Error('telemetry down'))
    };
    const services = withProviderExecutionSemanticTelemetry(servicesFor(), failingSink);

    await expect(
      services.allocationProviderAcceptance.respondToAllocation(acceptanceCommand)
    ).resolves.toMatchObject({ decision: 'ACCEPTED' });
  });
});
