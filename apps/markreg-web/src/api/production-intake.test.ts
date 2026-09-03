// @vitest-environment jsdom
import type { CreateProductionIntakeCommandV1 } from '@markorbit/contracts/markreg-early-funnel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client.js';
import { createProductionIntakeClient } from './production-intake.js';

const workspaceId = '018f0000-0000-7000-8000-000000000699';
const command: CreateProductionIntakeCommandV1 = {
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Launch the Orbit brand for software services.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs Ltd.', country: 'GB' },
    trademark: { type: 'WORD', representationText: 'ORBIT' },
    targetJurisdictions: ['US', 'GB'],
    goodsServices: { sourceText: 'Downloadable software and software as a service.' },
    filingGoal: 'Record a new filing request.'
  },
  idempotencyKey: 'production-intake-key-699',
  correlationId: 'correlation_699'
};

const envelope = {
  intake: {
    schemaVersion: 1,
    intakeId: 'production-intake_699',
    workspaceId,
    version: 1,
    status: 'RECEIVED',
    channel: 'MARKREG_DIRECT',
    relationshipModel: 'DIRECT',
    input: command.input,
    sourceClass: 'CUSTOMER_SUPPLIED',
    fingerprintSha256: 'a'.repeat(64),
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
    authorityConsequences: {
      professionalApprovalCreated: false,
      legalConclusionCreated: false,
      filingAuthorizationCreated: false,
      protectedActionAuthorized: false,
      orderCreated: false,
      paymentCreated: false,
      invoiceCreated: false,
      filingCreated: false,
      officialTruthCreated: false
    }
  }
} as const;

describe('durable Production Intake browser client', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('markorbit-workspace-id', workspaceId);
    sessionStorage.setItem('markorbit-csrf-token', 'csrf-699');
  });

  it('posts only customer Intake material while browser auth, Workspace, CSRF, idempotency and correlation stay in headers', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const client = createProductionIntakeClient(createApiClient('', 10_000, fetcher));

    await expect(client.create(command)).resolves.toEqual(envelope);

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/markreg/production-intakes');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({
      'X-MarkOrbit-Workspace-Id': workspaceId,
      'X-MarkOrbit-CSRF-Token': 'csrf-699',
      'Idempotency-Key': 'production-intake-key-699',
      'X-Correlation-ID': 'correlation_699'
    });
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      schemaVersion: 1,
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      input: command.input
    });
    expect(body).not.toHaveProperty('actor');
    expect(body).not.toHaveProperty('actorId');
    expect(body).not.toHaveProperty('workspaceId');
    expect(body).not.toHaveProperty('membershipId');
    expect(body).not.toHaveProperty('subjectUserId');
  });

  it('reloads durable owner truth with GET and the current Workspace session boundary', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const client = createProductionIntakeClient(createApiClient('', 10_000, fetcher));

    await expect(client.get('production-intake_699')).resolves.toEqual(envelope);

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/markreg/production-intakes/production-intake_699');
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({
      'X-MarkOrbit-Workspace-Id': workspaceId
    });
    expect(init?.headers).not.toHaveProperty('X-MarkOrbit-CSRF-Token');
  });

  it.each([400, 401, 403, 409, 503])(
    'preserves HTTP %s as a distinguishable MarkReg error',
    async (status) => {
      const fetcher = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: `STATUS_${status}`,
              message: `status ${status}`,
              correlationId: 'correlation_699',
              retryable: status === 503
            }),
            { status, headers: { 'content-type': 'application/json' } }
          )
        )
      );
      const client = createProductionIntakeClient(createApiClient('', 10_000, fetcher));

      await expect(client.create(command)).rejects.toMatchObject({
        status,
        code: `STATUS_${status}`
      });
    }
  );
});
