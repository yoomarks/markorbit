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
  InMemoryMarkRegRepository,
  type MarkRegOptions,
  fixtureQuoteId
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
async function stack(
  executionEnabled = true,
  markRegOptions: Pick<MarkRegOptions, 'now' | 'pricingRuleVersion' | 'beforeQuotePersist'> = {}
) {
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
      publisher: markRegPublisher,
      ...markRegOptions
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
    const recommendation = await client.createIntake({
      ...payload,
      actor: {
        ...payload.actor,
        actorId: 'actor_quote-client',
        workplaceId: 'workplace_quote-client'
      },
      idempotencyKey: 'quote-intake-key',
      correlationId: 'correlation_quote-intake'
    });
    const command = {
      intakeId: recommendation.intake.intakeId,
      recommendationId: recommendation.recommendation.recommendationId,
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

  it('binds quote identity to business identifiers, option, and pricing rule version', () => {
    const command = {
      intakeId: 'intake_identity' as const,
      recommendationId: 'recommendation_identity' as const,
      selectedOptionCode: 'A' as const,
      actor: payload.actor,
      idempotencyKey: 'identity-key',
      correlationId: 'correlation_identity' as const
    };
    const original = fixtureQuoteId(command, 'fixture-usd-v1');
    expect(fixtureQuoteId(command, 'fixture-usd-v1')).toBe(original);
    expect(fixtureQuoteId({ ...command, selectedOptionCode: 'B' }, 'fixture-usd-v1')).not.toBe(
      original
    );
    expect(fixtureQuoteId(command, 'fixture-usd-v2')).not.toBe(original);
  });

  it('rejects unrelated Intake and Recommendation identifiers safely', async () => {
    const state = await stack();
    const client = createMarkregClient(createApiClient(state.gatewayUrl));
    const ready = await client.createIntake({
      ...payload,
      actor: { ...payload.actor, actorId: 'actor_relation', workplaceId: 'workplace_relation' },
      idempotencyKey: 'relation-intake',
      correlationId: 'correlation_relation-intake'
    });
    const error = await client.createQuote!({
      intakeId: 'intake_unrelated',
      recommendationId: ready.recommendation.recommendationId,
      selectedOptionCode: 'A',
      actor:
        ready.intake.channel === 'MARKREG_DIRECT'
          ? { ...payload.actor, actorId: 'actor_relation', workplaceId: 'workplace_relation' }
          : payload.actor,
      idempotencyKey: 'relation-quote',
      correlationId: 'correlation_relation-quote'
    }).catch((reason: unknown) => reason);
    expect(error).toMatchObject({ kind: 'validation' });
    expect(String((error as Error).message)).not.toMatch(/markreg|stack|http:\/\//i);
  });

  it('conflicts on a changed quote payload using the same key', async () => {
    const state = await stack();
    const client = createMarkregClient(createApiClient(state.gatewayUrl));
    const ready = await client.createIntake({
      ...payload,
      actor: {
        ...payload.actor,
        actorId: 'actor_conflict-quote',
        workplaceId: 'workplace_conflict-quote'
      },
      idempotencyKey: 'conflict-quote-intake',
      correlationId: 'correlation_conflict-quote-intake'
    });
    const base = {
      intakeId: ready.intake.intakeId,
      recommendationId: ready.recommendation.recommendationId,
      selectedOptionCode: 'A' as const,
      actor: {
        ...payload.actor,
        actorId: 'actor_conflict-quote' as const,
        workplaceId: 'workplace_conflict-quote' as const
      },
      idempotencyKey: 'same-quote-key',
      correlationId: 'correlation_conflict-quote' as const
    };
    await client.createQuote!(base);
    const error = await client.createQuote!({ ...base, selectedOptionCode: 'B' }).catch(
      (reason: unknown) => reason
    );
    expect(error).toMatchObject({ kind: 'conflict' });
  });

  it('coalesces concurrent quote creation and permits retry after failure', async () => {
    let release!: () => void;
    let attempts = 0;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state = await stack(true, {
      beforeQuotePersist: async () => {
        attempts++;
        if (attempts === 1) await gate;
      }
    });
    const client = createMarkregClient(createApiClient(state.gatewayUrl));
    const ready = await client.createIntake({
      ...payload,
      actor: {
        ...payload.actor,
        actorId: 'actor_concurrent-quote',
        workplaceId: 'workplace_concurrent-quote'
      },
      idempotencyKey: 'concurrent-quote-intake',
      correlationId: 'correlation_concurrent-quote-intake'
    });
    const command = {
      intakeId: ready.intake.intakeId,
      recommendationId: ready.recommendation.recommendationId,
      selectedOptionCode: 'C' as const,
      actor: {
        ...payload.actor,
        actorId: 'actor_concurrent-quote' as const,
        workplaceId: 'workplace_concurrent-quote' as const
      },
      idempotencyKey: 'concurrent-quote-key',
      correlationId: 'correlation_concurrent-quote' as const
    };
    const requests = [client.createQuote!(command), client.createQuote!(command)];
    release();
    const [first, second] = await Promise.all(requests);
    expect(second).toEqual(first);
    expect(attempts).toBe(1);

    let fail = true;
    const retryState = await stack(true, {
      beforeQuotePersist: () => {
        if (fail) {
          fail = false;
          throw new Error('private storage failure');
        }
      }
    });
    const retryClient = createMarkregClient(createApiClient(retryState.gatewayUrl));
    const retryReady = await retryClient.createIntake({
      ...payload,
      actor: {
        ...payload.actor,
        actorId: 'actor_retry-quote',
        workplaceId: 'workplace_retry-quote'
      },
      idempotencyKey: 'retry-quote-intake',
      correlationId: 'correlation_retry-quote-intake'
    });
    const retryCommand = {
      ...command,
      intakeId: retryReady.intake.intakeId,
      recommendationId: retryReady.recommendation.recommendationId,
      actor: {
        ...payload.actor,
        actorId: 'actor_retry-quote' as const,
        workplaceId: 'workplace_retry-quote' as const
      },
      idempotencyKey: 'retry-quote-key',
      correlationId: 'correlation_retry-quote' as const
    };
    await expect(retryClient.createQuote!(retryCommand)).rejects.toThrow();
    await expect(retryClient.createQuote!(retryCommand)).resolves.toMatchObject({
      quote: { status: 'READY' }
    });
  });

  it('rejects expired, superseded, and unknown Quotes without side effects', async () => {
    let current = '2026-07-27T00:00:00.000Z';
    const state = await stack(true, { now: () => current });
    const client = createMarkregClient(createApiClient(state.gatewayUrl));
    const ready = await client.createIntake({
      ...payload,
      actor: { ...payload.actor, actorId: 'actor_lifecycle', workplaceId: 'workplace_lifecycle' },
      idempotencyKey: 'lifecycle-intake',
      correlationId: 'correlation_lifecycle-intake'
    });
    const base = {
      intakeId: ready.intake.intakeId,
      recommendationId: ready.recommendation.recommendationId,
      actor: {
        ...payload.actor,
        actorId: 'actor_lifecycle' as const,
        workplaceId: 'workplace_lifecycle' as const
      },
      correlationId: 'correlation_lifecycle' as const
    };
    const a = await client.createQuote!({
      ...base,
      selectedOptionCode: 'A',
      idempotencyKey: 'lifecycle-a'
    });
    await client.createQuote!({ ...base, selectedOptionCode: 'B', idempotencyKey: 'lifecycle-b' });
    await expect(
      client.confirmQuote!({
        quoteId: a.quote.quoteId,
        actor: base.actor,
        idempotencyKey: 'confirm-superseded',
        correlationId: base.correlationId
      })
    ).rejects.toMatchObject({ kind: 'conflict' });
    const c = await client.createQuote!({
      ...base,
      selectedOptionCode: 'C',
      idempotencyKey: 'lifecycle-c'
    });
    current = c.quote.validUntil;
    await expect(
      client.confirmQuote!({
        quoteId: c.quote.quoteId,
        actor: base.actor,
        idempotencyKey: 'confirm-expired',
        correlationId: base.correlationId
      })
    ).rejects.toMatchObject({ kind: 'conflict' });
    await expect(
      client.confirmQuote!({
        quoteId: 'quote_unknown',
        actor: base.actor,
        idempotencyKey: 'confirm-unknown',
        correlationId: base.correlationId
      })
    ).rejects.toThrow();
    expect(state.markRegRepository.getQuote(c.quote.quoteId)?.selectedOptionCode).toBe('C');
    expect(state.markRegRepository.getQuote(c.quote.quoteId)?.total).toEqual(c.quote.total);
  });
});
