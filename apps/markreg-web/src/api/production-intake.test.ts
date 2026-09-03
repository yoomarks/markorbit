import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client.js';
import { createProductionIntakeClient } from './production-intake.js';

const intake = {
  schemaVersion: 1,
  intakeId: 'production-intake_699',
  workspaceId: '018f0000-0000-7000-8000-000000000699',
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Launch ORBIT software services.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs Ltd.', country: 'GB' },
    trademark: { type: 'WORD', representationText: 'ORBIT' },
    targetJurisdictions: ['US', 'GB'],
    goodsServices: { sourceText: 'Downloadable software and SaaS.' },
    filingGoal: 'Prepare a new filing.'
  },
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
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
} as const;

const command = {
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: intake.input,
  idempotencyKey: 'logical-key-699',
  correlationId: 'correlation_699'
} as const;

describe('Production Intake Web client', () => {
  it('writes through the authenticated Gateway without browser authority fields', async () => {
    const post = vi.fn((...args: [string, unknown, Record<string, string>?]) => {
      expect(args).toHaveLength(3);
      return Promise.resolve({ intake });
    });
    const api = { post } as unknown as ApiClient;
    const client = createProductionIntakeClient(api);

    await expect(client.create(command)).resolves.toEqual(intake);
    expect(post).toHaveBeenCalledWith(
      '/api/markreg/production-intakes',
      {
        schemaVersion: 1,
        channel: 'MARKREG_DIRECT',
        relationshipModel: 'DIRECT',
        input: intake.input
      },
      {
        'Idempotency-Key': 'logical-key-699',
        'X-Correlation-ID': 'correlation_699'
      }
    );
    const body = post.mock.calls[0]![1];
    expect(body).not.toHaveProperty('workspaceId');
    expect(body).not.toHaveProperty('actor');
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('recommendation');
  });

  it('reads the durable owner record by Intake identity', async () => {
    const get = vi.fn(() => Promise.resolve({ intake }));
    const api = { get } as unknown as ApiClient;
    const client = createProductionIntakeClient(api);

    await expect(client.get('production-intake_699')).resolves.toEqual(intake);
    expect(get).toHaveBeenCalledWith('/api/markreg/production-intakes/production-intake_699');
  });
});
