import { describe, expect, it } from 'vitest';
import { json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  InMemoryMgsnSemanticTelemetrySinkV1,
  MGSN_PROVIDER_EXECUTION_SEMANTIC_ROUTES,
  observeMgsnProviderExecutionSemanticRoutesV1,
  type MgsnSemanticTelemetrySinkV1
} from '../src/semantic-observability.js';

const request: JsonRequest = {
  body: {
    acknowledgement: 'SECRET ACKNOWLEDGEMENT',
    workStatusClaim: 'SECRET RETURN CLAIM'
  },
  headers: {
    authorization: 'Bearer SECRET_SESSION'
  },
  method: 'POST',
  path: '/fixture',
  params: {},
  query: {}
};

function route(path: string, handle: JsonRoute['handle']): JsonRoute {
  return { method: 'POST', path, handle };
}

function telemetryText(sink: InMemoryMgsnSemanticTelemetrySinkV1): string {
  return JSON.stringify(sink.list());
}

describe('MGSN Provider execution semantic observability', () => {
  it('freezes the two Provider execution route extensions', () => {
    expect(MGSN_PROVIDER_EXECUTION_SEMANTIC_ROUTES).toEqual([
      {
        method: 'POST',
        path: '/v1/provider/allocations/:allocationId/respond',
        operation: 'PROVIDER_ACCEPTANCE_RESPOND'
      },
      {
        method: 'POST',
        path: '/v1/provider/returns',
        operation: 'PROVIDER_RETURN_SUBMIT_OR_CORRECT'
      }
    ]);
  });

  it('records both Provider Acceptance decisions without quality meaning', async () => {
    for (const decision of ['ACCEPTED', 'DECLINED'] as const) {
      const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
      const result = json(201, {
        providerAcceptance: {
          decision,
          acknowledgement: 'SECRET ACKNOWLEDGEMENT',
          providerId: 'provider_SECRET'
        }
      });
      const baseRoute = route('/v1/provider/allocations/:allocationId/respond', () => result);
      const observed = observeMgsnProviderExecutionSemanticRoutesV1([baseRoute], sink)[0]!;

      await expect(observed.handle(request)).resolves.toBe(result);
      expect(sink.list()).toHaveLength(1);
      expect(sink.list()[0]).toMatchObject({
        operation: 'PROVIDER_ACCEPTANCE_RESPOND',
        outcomeClass: 'SUCCESS',
        resultCode: decision,
        sensitiveContentRetained: false,
        rawPayloadRetained: false,
        authority: {
          providerTrustEvidenceCreated: false,
          providerQualityInferenceCreated: false,
          providerRankingAuthorityGranted: false,
          professionalDecisionCreated: false
        }
      });
      expect(telemetryText(sink)).not.toContain('SECRET');
    }
  });

  it('distinguishes Return submission from correction without retaining Return content', async () => {
    const cases = [
      { resultCode: 'RETURN_SUBMITTED' as const, supersedes: undefined },
      {
        resultCode: 'RETURN_CORRECTED' as const,
        supersedes: { id: 'provider-return_SECRET_previous', version: 1 }
      }
    ];

    for (const testCase of cases) {
      const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
      const result = json(201, {
        providerReturn: {
          workStatusClaim: 'SECRET RETURN CLAIM',
          artifacts: [{ reference: 'SECRET_ARTIFACT_REFERENCE' }],
          ...(testCase.supersedes ? { supersedes: testCase.supersedes } : {})
        }
      });
      const baseRoute = route('/v1/provider/returns', () => result);
      const observed = observeMgsnProviderExecutionSemanticRoutesV1([baseRoute], sink)[0]!;

      await expect(observed.handle(request)).resolves.toBe(result);
      expect(sink.list()[0]).toMatchObject({
        operation: 'PROVIDER_RETURN_SUBMIT_OR_CORRECT',
        outcomeClass: 'SUCCESS',
        resultCode: testCase.resultCode,
        authority: {
          providerTrustEvidenceCreated: false,
          officialTruthCreated: false
        }
      });
      expect(telemetryText(sink)).not.toContain('SECRET');
    }
  });

  it('records bounded failure metadata and rethrows the original Provider error', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    const failure = Object.assign(new Error('SECRET IDEMPOTENCY DETAIL'), {
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409
    });
    const baseRoute = route('/v1/provider/returns', () => {
      throw failure;
    });
    const observed = observeMgsnProviderExecutionSemanticRoutesV1([baseRoute], sink)[0]!;

    await expect(observed.handle(request)).rejects.toBe(failure);
    expect(sink.list()[0]).toMatchObject({
      operation: 'PROVIDER_RETURN_SUBMIT_OR_CORRECT',
      outcomeClass: 'CONFLICT',
      resultCode: 'IDEMPOTENCY_CONFLICT',
      errorMessageRetained: false
    });
    expect(telemetryText(sink)).not.toContain('SECRET IDEMPOTENCY DETAIL');
  });

  it('keeps sink failure best-effort and leaves unrelated routes untouched', async () => {
    const sink: MgsnSemanticTelemetrySinkV1 = {
      record: () => Promise.reject(new Error('telemetry unavailable'))
    };
    const providerResult = json(201, { providerAcceptance: { decision: 'DECLINED' } });
    const unrelatedResult = json(200, { provider: { providerId: 'SECRET_UNRELATED' } });
    const providerRoute = route('/v1/provider/allocations/:allocationId/respond', () => providerResult);
    const unrelatedRoute = route('/v1/providers', () => unrelatedResult);
    const routes = observeMgsnProviderExecutionSemanticRoutesV1(
      [providerRoute, unrelatedRoute],
      sink
    );

    await expect(routes[0]!.handle(request)).resolves.toBe(providerResult);
    await expect(routes[1]!.handle(request)).resolves.toBe(unrelatedResult);
  });
});
