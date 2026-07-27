import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceRuntime } from '@markorbit/service-kit';
import type { EventEnvelope } from '@markorbit/contracts';
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
import { createApiClient } from '../../markreg-web/src/api/client.js';
import { createMarkregClient } from '../../markreg-web/src/api/markreg.js';

const active: ServiceRuntime[] = [];
class RecordingPublisher {
  readonly events: EventEnvelope<string, unknown>[] = [];
  publish(event: EventEnvelope<string, unknown>): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}
class FailOncePublisher extends RecordingPublisher {
  private shouldFail = true;
  override async publish(event: EventEnvelope<string, unknown>): Promise<void> {
    if (this.shouldFail) {
      this.shouldFail = false;
      throw new Error('private publisher failure');
    }
    await super.publish(event);
  }
}
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
  const capabilityPublisher = new RecordingPublisher();
  const executionPublisher = new RecordingPublisher();
  const markRegPublisher = new RecordingPublisher();
  const capabilityUrl = await start(
    createCapability({
      port: 0,
      repository: capabilityRepository,
      publisher: capabilityPublisher
    })
  );
  let executionUrl = 'http://127.0.0.1:1';
  if (executionEnabled)
    executionUrl = await start(
      createExecution({
        port: 0,
        repository: executionRepository,
        publisher: executionPublisher
      })
    );
  const markRegUrl = await start(
    createMarkReg({
      port: 0,
      capabilityEngineUrl: capabilityUrl,
      executionUrl,
      repository: markRegRepository,
      publisher: markRegPublisher
    })
  );
  const gatewayUrl = await start(createGateway({ port: 0, markRegUrl }));
  return {
    gatewayUrl,
    capabilityRepository,
    executionRepository,
    markRegRepository,
    capabilityPublisher,
    executionPublisher,
    markRegPublisher
  };
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
  it('accepts a real markreg-web API client request through every runtime', async () => {
    const state = await stack();
    const client = createMarkregClient(createApiClient(state.gatewayUrl));
    const body = await client.createIntake({
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      customerIntent: payload.customerIntent,
      actor: {
        actorId: 'actor_web-client',
        workplaceId: 'workplace_web-client',
        product: 'MARKREG_COM',
        purpose: payload.actor.purpose
      },
      idempotencyKey: 'web-client-key',
      correlationId: 'correlation_web_client'
    });
    expect(body.intake.status).toBe('RECOMMENDATION_READY');
    expect(body.recommendation.status).toBe('FIXTURE_ONLY');
    expect(body.recommendation.options.map((option) => option.tier)).toEqual(['A', 'B', 'C']);
    expect(body.trace.correlationId).toBe('correlation_web_client');
  });
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
    expect(state.capabilityPublisher.events).toHaveLength(1);
    expect(state.executionPublisher.events).toHaveLength(1);
    expect(state.markRegPublisher.events.map((event) => event.eventType)).toEqual([
      'markreg.intake.created.v1',
      'markreg.recommendation.ready.v1'
    ]);
    const duplicate = await submit(state.gatewayUrl, 'same-key');
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual(body);
    expect(state.markRegRepository.size).toBe(1);
    expect(state.capabilityRepository.size).toBe(1);
    expect(state.executionRepository.size).toBe(1);
    expect(state.capabilityPublisher.events).toHaveLength(1);
    expect(state.executionPublisher.events).toHaveLength(1);
    expect(state.markRegPublisher.events).toHaveLength(2);
  });
  it('coalesces concurrent identical commands without duplicate objects or events', async () => {
    const state = await stack();
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => submit(state.gatewayUrl, 'concurrent-key'))
    );
    expect(responses.every((response) => response.status === 200 || response.status === 201)).toBe(
      true
    );
    expect(responses.some((response) => response.status === 201)).toBe(true);
    const bodies = await Promise.all(
      responses.map(async (response): Promise<unknown> => response.json() as Promise<unknown>)
    );
    expect(bodies.every((body) => JSON.stringify(body) === JSON.stringify(bodies[0]))).toBe(true);
    expect(state.markRegRepository.size).toBe(1);
    expect(state.capabilityRepository.size).toBe(1);
    expect(state.executionRepository.size).toBe(1);
    expect(state.capabilityPublisher.events).toHaveLength(1);
    expect(state.executionPublisher.events).toHaveLength(1);
    expect(state.markRegPublisher.events).toHaveLength(2);
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
  it('retries a failed Intake without replaying already-published business events', async () => {
    const capabilityRepository = new InMemoryCapabilityRequestRepository();
    const executionRepository = new InMemoryExecutionRepository();
    const markRegRepository = new InMemoryMarkRegRepository();
    const capabilityPublisher = new RecordingPublisher();
    const executionPublisher = new RecordingPublisher();
    const markRegPublisher = new RecordingPublisher();
    const capabilityUrl = await start(
      createCapability({
        port: 0,
        repository: capabilityRepository,
        publisher: capabilityPublisher
      })
    );
    const reservation = createExecution({ port: 0 });
    const reservedUrl = await start(reservation);
    const executionPort = Number(new URL(reservedUrl).port);
    await reservation.stop();
    const markRegUrl = await start(
      createMarkReg({
        port: 0,
        capabilityEngineUrl: capabilityUrl,
        executionUrl: reservedUrl,
        repository: markRegRepository,
        publisher: markRegPublisher
      })
    );
    const gatewayUrl = await start(createGateway({ port: 0, markRegUrl }));

    expect((await submit(gatewayUrl, 'retry-key')).status).toBe(502);
    expect(markRegRepository.all()[0]?.intake.status).toBe('FAILED');
    await start(
      createExecution({
        port: executionPort,
        repository: executionRepository,
        publisher: executionPublisher
      })
    );
    const retry = await submit(gatewayUrl, 'retry-key');
    expect(retry.status).toBe(201);
    expect(await retry.json()).toMatchObject({ intake: { status: 'RECOMMENDATION_READY' } });
    expect(markRegRepository.size).toBe(1);
    expect(capabilityRepository.size).toBe(1);
    expect(executionRepository.size).toBe(1);
    expect(capabilityPublisher.events).toHaveLength(1);
    expect(executionPublisher.events).toHaveLength(1);
    expect(markRegPublisher.events.map((event) => event.eventType)).toEqual([
      'markreg.intake.created.v1',
      'markreg.recommendation.ready.v1'
    ]);
  });
  it('retries an event publication failure without caching success or losing the event', async () => {
    const capabilityRepository = new InMemoryCapabilityRequestRepository();
    const executionRepository = new InMemoryExecutionRepository();
    const markRegRepository = new InMemoryMarkRegRepository();
    const capabilityUrl = await start(
      createCapability({ port: 0, repository: capabilityRepository })
    );
    const executionUrl = await start(createExecution({ port: 0, repository: executionRepository }));
    const publisher = new FailOncePublisher();
    const markRegUrl = await start(
      createMarkReg({
        port: 0,
        capabilityEngineUrl: capabilityUrl,
        executionUrl,
        repository: markRegRepository,
        publisher
      })
    );
    const gatewayUrl = await start(createGateway({ port: 0, markRegUrl }));

    const failed = await submit(gatewayUrl, 'event-retry-key');
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred.',
      correlationId: 'correlation_integration',
      retryable: false
    });
    expect(markRegRepository.all()[0]?.intake.status).not.toBe('RECOMMENDATION_READY');
    const retry = await submit(gatewayUrl, 'event-retry-key');
    expect(retry.status).toBe(201);
    expect(await retry.json()).toMatchObject({ intake: { status: 'RECOMMENDATION_READY' } });
    expect(publisher.events.map((event) => event.eventType)).toEqual([
      'markreg.intake.created.v1',
      'markreg.recommendation.ready.v1'
    ]);
  });
});

describe('plan and quote HTTP slice', () => {
  it('runs markreg-web client through Gateway and MarkReg to READY and CONFIRMED', async () => {
    const state = await stack();
    const client = createMarkregClient(createApiClient(state.gatewayUrl));
    const command = {
      intakeId: 'intake_quote-fixture' as const,
      recommendationId: 'recommendation_quote-fixture' as const,
      selectedOptionCode: 'B' as const,
      actor: {
        actorId: 'actor_web-client' as const,
        workplaceId: 'workplace_web-client' as const,
        product: 'MARKREG_COM' as const,
        purpose: 'fixture quote'
      },
      idempotencyKey: 'quote-web-key',
      correlationId: 'correlation_quote-web' as const
    };
    const first = await client.createQuote!(command);
    const duplicate = await client.createQuote!(command);
    expect(duplicate).toEqual(first);
    expect(first.quote.status).toBe('READY');
    expect(first.quote.fixtureOnly).toBe(true);
    expect(first.quote.lines.every((line) => Number.isSafeInteger(line.amount.amountMinor))).toBe(
      true
    );
    expect(first.quote.total.amountMinor).toBe(
      first.quote.subtotal.amountMinor + first.quote.estimatedTaxes.amountMinor
    );
    const confirmationCommand = {
      quoteId: first.quote.quoteId,
      actor: command.actor,
      idempotencyKey: 'confirmation-web-key',
      correlationId: 'correlation_confirmation-web' as const
    };
    const confirmation = await client.confirmQuote!(confirmationCommand);
    const repeated = await client.confirmQuote!(confirmationCommand);
    expect(repeated).toEqual(confirmation);
    expect(confirmation).toMatchObject({
      status: 'CONFIRMED',
      pendingProfessionalReview: true,
      orderCreated: false,
      paymentMade: false,
      filingStarted: false
    });
  });
});
