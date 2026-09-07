import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  type ProductionIntakeV1,
  type ProductionRecommendationV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  HttpProductionRecommendationSourceInvokerV1,
  ProductionRecommendationOrchestrationError,
  ProductionRecommendationOrchestrationServiceV1,
  PRODUCTION_RECOMMENDATION_SOURCE_CAPABILITY_ID,
  PRODUCTION_RECOMMENDATION_SOURCE_INPUT_SCHEMA,
  PRODUCTION_RECOMMENDATION_SOURCE_OUTPUT_SCHEMA,
  type OrchestrateProductionRecommendationCommandV1
} from '../src/production-recommendation-orchestration.js';

const workspaceId = '70707070-7070-4707-8707-707070707070';
const principal = (): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0948',
  userId: 'user_task0948',
  workspaceId,
  membershipId: 'membership_task0948',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});
const received = (): ProductionIntakeV1 => ({
  schemaVersion: 1,
  intakeId: 'intake_task0948',
  workspaceId,
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Prepare a bounded US trademark filing strategy review.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs LLC', country: 'US' },
    trademark: { type: 'WORD', representationText: 'MARK ORBIT' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Trademark portfolio software.' },
    filingGoal: 'Prepare a US application for human attorney review.'
  },
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-07T13:00:00.000Z',
  updatedAt: '2026-09-07T13:00:00.000Z',
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

const ready = (): ProductionIntakeV1 => ({
  ...received(),
  version: 2,
  status: 'RECOMMENDATION_READY',
  fingerprintSha256: 'b'.repeat(64),
  updatedAt: '2026-09-07T13:01:00.000Z'
});
const command = (): OrchestrateProductionRecommendationCommandV1 => ({
  schemaVersion: 1,
  intakeId: received().intakeId,
  expectedIntakeVersion: 1,
  expectedIntakeFingerprintSha256: received().fingerprintSha256,
  idempotencyKey: 'recommendation-orchestration-1',
  correlationId: 'correlation_task0948'
});

const recommendation = {
  recommendationId: 'recommendation_task0948'
} as unknown as ProductionRecommendationV1;

const reference = (idempotencyKey: string) => ({
  schemaVersion: 1 as const,
  idempotencyKey,
  requestFingerprintSha256: 'c'.repeat(64),
  capabilityRequestId: 'capreq_task0948',
  sessionReceiptId: 'session-receipt_task0948'
});

describe('Production Recommendation orchestration', () => {
  it('invokes only the frozen MARKREG source and projects only its exact evidence reference', async () => {
    let requestBody: Record<string, unknown> | undefined;
    let requestHeaders: HeadersInit | undefined;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? init.body : '';
      requestBody = JSON.parse(body) as Record<string, unknown>;
      requestHeaders = init?.headers;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            sourceEvidenceReadReference: reference(String(requestBody.idempotencyKey))
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    const invoker = new HttpProductionRecommendationSourceInvokerV1(
      'http://capability.local',
      's'.repeat(40),
      fetcher
    );
    const result = await invoker.invoke(
      principal(),
      received(),
      command().idempotencyKey,
      command().correlationId
    );
    expect(result.capabilityRequestId).toBe('capreq_task0948');
    expect(requestBody).toMatchObject({
      schemaVersion: 2,
      capabilityId: PRODUCTION_RECOMMENDATION_SOURCE_CAPABILITY_ID,
      capabilityVersion: '1.0.0',
      input: received().input,
      inputSchemaId: PRODUCTION_RECOMMENDATION_SOURCE_INPUT_SCHEMA,
      outputSchemaId: PRODUCTION_RECOMMENDATION_SOURCE_OUTPUT_SCHEMA,
      riskClass: 'LOW'
    });
    expect((requestBody?.caller as Record<string, unknown>).callerProduct).toBe('MARKREG');
    expect(new Headers(requestHeaders).get('x-markorbit-caller-product')).toBe('MARKREG');
    expect(new Headers(requestHeaders).get('idempotency-key')).toBe(requestBody?.idempotencyKey);
  });

  it('materializes from the exact current Intake without exposing producer controls', async () => {
    const source = { invoke: vi.fn(() => Promise.resolve(reference('source-key'))) };
    const recommendations = {
      create: vi.fn(() => Promise.resolve(recommendation)),
      findCreateReplayForIntake: vi.fn(() => Promise.resolve(null))
    };
    const service = new ProductionRecommendationOrchestrationServiceV1({
      intakes: {
        getVersion: () => Promise.resolve(received()),
        get: () => Promise.resolve(received())
      },
      source,
      recommendations
    });
    expect(await service.create(principal(), command())).toBe(recommendation);
    expect(source.invoke).toHaveBeenCalledTimes(1);
    expect(recommendations.create).toHaveBeenCalledWith(
      principal(),
      expect.objectContaining({
        intakeId: received().intakeId,
        expectedIntakeVersion: 1,
        producerReference: reference('source-key'),
        idempotencyKey: command().idempotencyKey
      }),
      command().correlationId
    );
  });

  it('replays the exact READY successor only through the durable Recommendation receipt', async () => {
    const source = { invoke: vi.fn(() => Promise.resolve(reference('source-key'))) };
    const recommendations = {
      create: vi.fn(() => Promise.resolve(recommendation)),
      findCreateReplayForIntake: vi.fn(() => Promise.resolve(recommendation))
    };
    const service = new ProductionRecommendationOrchestrationServiceV1({
      intakes: {
        getVersion: () => Promise.resolve(received()),
        get: () => Promise.resolve(ready())
      },
      source,
      recommendations
    });
    expect(await service.create(principal(), command())).toBe(recommendation);
    expect(recommendations.findCreateReplayForIntake).toHaveBeenCalledWith(
      principal(),
      command().idempotencyKey,
      received().intakeId,
      received().version,
      received().fingerprintSha256
    );
    expect(source.invoke).not.toHaveBeenCalled();
    expect(recommendations.create).not.toHaveBeenCalled();
  });

  it('rejects a READY Intake under a new idempotency key before producer invocation', async () => {
    const source = { invoke: vi.fn(() => Promise.resolve(reference('source-key'))) };
    const recommendations = {
      create: vi.fn(() => Promise.resolve(recommendation)),
      findCreateReplayForIntake: vi.fn(() => Promise.resolve(null))
    };
    const service = new ProductionRecommendationOrchestrationServiceV1({
      intakes: {
        getVersion: () => Promise.resolve(received()),
        get: () => Promise.resolve(ready())
      },
      source,
      recommendations
    });
    await expect(
      service.create(principal(), {
        ...command(),
        idempotencyKey: 'recommendation-orchestration-new'
      })
    ).rejects.toMatchObject({ code: 'PRODUCTION_INTAKE_CONFLICT', status: 409 });
    expect(source.invoke).not.toHaveBeenCalled();
    expect(recommendations.create).not.toHaveBeenCalled();
  });
  it('fails before producer invocation on fingerprint or non-replay Intake drift', async () => {
    const source = { invoke: vi.fn(() => Promise.resolve(reference('source-key'))) };
    const recommendations = {
      create: vi.fn(() => Promise.resolve(recommendation)),
      findCreateReplayForIntake: vi.fn(() => Promise.resolve(null))
    };
    const fingerprintService = new ProductionRecommendationOrchestrationServiceV1({
      intakes: {
        getVersion: () => Promise.resolve(received()),
        get: () => Promise.resolve(received())
      },
      source,
      recommendations
    });
    await expect(
      fingerprintService.create(principal(), {
        ...command(),
        expectedIntakeFingerprintSha256: 'd'.repeat(64)
      })
    ).rejects.toMatchObject({ code: 'PRODUCTION_INTAKE_CONFLICT' });
    expect(source.invoke).not.toHaveBeenCalled();

    const drifted: ProductionIntakeV1 = {
      ...ready(),
      version: 3,
      fingerprintSha256: 'e'.repeat(64)
    };
    const driftService = new ProductionRecommendationOrchestrationServiceV1({
      intakes: {
        getVersion: () => Promise.resolve(received()),
        get: () => Promise.resolve(drifted)
      },
      source,
      recommendations
    });
    await expect(driftService.create(principal(), command())).rejects.toBeInstanceOf(
      ProductionRecommendationOrchestrationError
    );
    expect(source.invoke).not.toHaveBeenCalled();
  });
});
