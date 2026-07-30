import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime, InMemoryExecutionRepository } from '../src/index.js';

let runtime: ServiceRuntime | undefined;
afterEach(async () => runtime?.stop());

describe('legacy internal execution-envelope boundary', () => {
  it('records only a capability invocation and creates no filing authority consequence', async () => {
    const repository = new InMemoryExecutionRepository();
    runtime = createRuntime({ port: 0, repository, now: () => '2026-07-29T00:00:00.000Z' });
    await runtime.start();
    const command = {
      capabilityRequestId: 'capability_request_legacy',
      actor: {
        actorId: 'actor_fixture',
        workplaceId: 'workplace_fixture',
        product: 'MARKREG_COM',
        purpose: 'legacy fixture execution envelope'
      },
      idempotencyKey: 'legacy-boundary-key',
      correlationId: 'correlation_legacy'
    };
    const response = await fetch(`http://127.0.0.1:${runtime.listeningPort}/v1/executions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': command.idempotencyKey },
      body: JSON.stringify(command)
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      capabilityRequestId: command.capabilityRequestId,
      executionType: 'CAPABILITY_INVOCATION',
      status: 'RECORDED'
    });
    for (const prohibited of [
      'filing',
      'filingSubmission',
      'officialApplication',
      'officialApplicationNumber',
      'trademarkOfficeContact',
      'filingExecutionTaskDraft'
    ])
      expect(body).not.toHaveProperty(prohibited);
    expect(repository.size).toBe(1);
  });
});
