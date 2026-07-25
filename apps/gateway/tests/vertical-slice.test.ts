import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createCapability,
  InMemoryCapabilityRequestRepository
} from '../../../services/capability-engine/src/index.js';
import {
  createRuntime as createExecution,
  InMemoryExecutionRepository
} from '../../../services/execution/src/index.js';
import {
  createRuntime as createMarkReg,
  InMemoryMarkRegRepository
} from '../../../services/markreg/src/index.js';
import { createRuntime as createGateway } from '../src/index.js';

const active: ServiceRuntime[] = [];
afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
});
const payload = {
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  customerIntent: {
    brandName: 'Orbit',
    applicantCountry: 'GB',
    targetJurisdictions: ['US', 'EU'],
    goodsServicesDescription: 'Software services'
  },
  actor: {
    actorId: 'actor_fixture',
    workplaceId: 'workplace_fixture',
    product: 'MARKREG_COM',
    purpose: 'fixture recommendation'
  }
};
async function start(runtime: ServiceRuntime) {
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}
async function stack(executionEnabled = true) {
  const capabilityRepository = new InMemoryCapabilityRequestRepository();
  const executionRepository = new InMemoryExecutionRepository();
  const markRegRepository = new InMemoryMarkRegRepository();
  const capabilityUrl = await start(
    createCapability({ port: 0, repository: capabilityRepository })
  );
  let executionUrl = 'http://127.0.0.1:1';
  if (executionEnabled)
    executionUrl = await start(createExecution({ port: 0, repository: executionRepository }));
  const markRegUrl = await start(
    createMarkReg({
      port: 0,
      capabilityEngineUrl: capabilityUrl,
      executionUrl,
      repository: markRegRepository
    })
  );
  const gatewayUrl = await start(createGateway({ port: 0, markRegUrl }));
  return { gatewayUrl, capabilityRepository, executionRepository, markRegRepository };
}
async function submit(url: string, key: string, body: unknown = payload) {
  return fetch(`${url}/v1/markreg/intakes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': key,
      'x-correlation-id': 'correlation_integration'
    },
    body: JSON.stringify(body)
  });
}

describe('first intake-to-recommendation HTTP slice', () => {
  it('returns a correlated A/B/C fixture and owns one record per service', async () => {
    const state = await stack();
    const response = await submit(state.gatewayUrl, 'same-key');
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      intake: { status: string };
      recommendation: { status: string; options: { tier: string }[] };
      trace: {
        correlationId: string;
        capabilityRequestId: string;
        executionId: string;
        provenanceRefs: string[];
      };
    };
    expect(body.intake.status).toBe('RECOMMENDATION_READY');
    expect(body.recommendation.status).toBe('FIXTURE_ONLY');
    expect(body.recommendation.options.map((option) => option.tier)).toEqual(['A', 'B', 'C']);
    expect(body.trace.correlationId).toBe('correlation_integration');
    expect(body.trace.provenanceRefs).toEqual([
      body.trace.capabilityRequestId,
      body.trace.executionId
    ]);
    expect(state.markRegRepository.size).toBe(1);
    expect(state.capabilityRepository.size).toBe(1);
    expect(state.executionRepository.size).toBe(1);
    const duplicate = await submit(state.gatewayUrl, 'same-key');
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual(body);
    expect(state.markRegRepository.size).toBe(1);
    expect(state.capabilityRepository.size).toBe(1);
    expect(state.executionRepository.size).toBe(1);
  });
  it('returns 409 when a key is reused for a different payload', async () => {
    const state = await stack();
    expect((await submit(state.gatewayUrl, 'conflict')).status).toBe(201);
    const response = await submit(state.gatewayUrl, 'conflict', {
      ...payload,
      customerIntent: { ...payload.customerIntent, brandName: 'Different' }
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      correlationId: 'correlation_integration',
      retryable: false
    });
  });
  it('returns safe 502 and a non-ready Intake when Capability Engine is unavailable', async () => {
    const repository = new InMemoryMarkRegRepository();
    const markRegUrl = await start(
      createMarkReg({
        port: 0,
        capabilityEngineUrl: 'http://127.0.0.1:1',
        executionUrl: 'http://127.0.0.1:1',
        repository
      })
    );
    const gatewayUrl = await start(createGateway({ port: 0, markRegUrl }));
    const response = await submit(gatewayUrl, 'cap-down');
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      code: 'DOWNSTREAM_UNAVAILABLE',
      message: 'A required downstream service is unavailable.',
      correlationId: 'correlation_integration',
      retryable: true
    });
    expect(repository.all()[0]?.intake.status).toBe('FAILED');
  });
  it('returns safe 502 and a non-ready Intake when Execution is unavailable', async () => {
    const state = await stack(false);
    const response = await submit(state.gatewayUrl, 'exec-down');
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DOWNSTREAM_UNAVAILABLE',
      correlationId: 'correlation_integration'
    });
    expect(state.markRegRepository.all()[0]?.intake.status).toBe('FAILED');
    expect(state.capabilityRepository.size).toBe(1);
    expect(state.executionRepository.size).toBe(0);
  });
});
