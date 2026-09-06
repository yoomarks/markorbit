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
    acknowledgement: 'SECRET PROVIDER ACKNOWLEDGEMENT',
    workStatusClaim: 'SECRET RETURN CLAIM',
    assertions: [{ code: 'SECRET_ASSERTION', value: 'SECRET ASSERTION VALUE' }]
  },
  headers: {
    authorization: 'Bearer SECRET_SESSION',
    'x-markorbit-principal': 'SECRET_PRINCIPAL'
  },
  method: 'POST',
  path: '/fixture',
  params: {},
  query: {}
};

function route(path: string, handle: JsonRoute['handle']): JsonRoute {
  return { method: 'POST', path, handle };
}

function serialized(sink: InMemoryMgsnSemanticTelemetrySinkV1): string {
  return JSON.stringify(sink.list());
}

describe('MGSN Provider execution semantic observability', () => {
  it('freezes exactly the Provider Acceptance and Provider Return route extensions', () => {
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

  it.each(['ACCEPTED', 'DECLINED'] as const)(
    'records Provider Acceptance %s as a successful decision without quality meaning',
    async (decision) => {
      const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
      const routes = observeMgsnProviderExecutionSemanticRoutesV1(
        [
          route('/v1/provider/allocations/:allocationId/respond', () =>
            json(201, {
              providerAcceptance: {
                decision,
                acknowledgement: 'SECRET PROVIDER ACKNOWLEDGEMENT',
                providerId: 'provider_SECRET',
                providerWorkspaceId: 'workspace_SECRET'
              }
            })
          )
        ],
        sink
      );

      await expect(routes[0]!.handle(request)).resolves.toMatchObject({ status: 201 });
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
      expect(serialized(sink)).not.toContain('SECRET');
    }
  );

  it.each([
    ['RETURN_SUBMITTED', undefined],
    ['RETURN_CORRECTED', { id: 'provider-return_SECRET_previous', version: 1 }]
  ] as const)('records %s without retaining Return assertions or supersession identity', async (code, supersedes) => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    const routes = observeMgsnProviderExecutionSemanticRoutesV1(
      [
        route('/v1/provider/returns', () =>
          json(201, {
            providerReturn: {
              version: supersedes ? 2 : 1,
              workStatusClaim: 'SECRET RETURN CLAIM',
              assertions: [{ code: 'SECRET_ASSERTION', value: 'SECRET ASSERTION VALUE' }],
              artifacts: [{ reference: 'SECRET_ARTIFACT_REFERENCE' }],
              ...(supersedes ? { supersedes } : {})
            }
          })
        )
      ],
      sink
    );

    await expect(routes[0]!.handle(request)).resolves.toMatchObject({ status: 201 });
    expect(sink.list()[0]).toMatchObject({
      operation: 'PROVIDER_RETURN_SUBMIT_OR_CORRECT',
      outcomeClass: 'SUCCESS',
      resultCode: code,
      authority: {
        providerTrustEvidenceCreated: false,
        officialTruthCreated: false
      }
    });
    expect(serialized(sink)).not.toContain('SECRET');
  });

  it('records bounded conflict metadata and rethrows the exact Provider operation failure', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    const failure = Object.assign(new Error('SECRET IDEMPOTENCY DETAIL'), {
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409
    });
    const routes = observeMgsnProviderExecutionSemanticRoutesV1(
      [
        route('/v1/provider/returns', () => {
          throw failure;
        })
      ],
      sink
    );

    await expect(routes[0]!.handle(request)).rejects.toBe(failure);
    expect(sink.list()[0]).toMatchObject({
      operation: 'PROVIDER_RETURN_SUBMIT_OR_CORRECT',
      outcomeClass: 'CONFLICT',
      resultCode: 'IDEMPOTENCY_CONFLICT',
      errorMessageRetained: false
    });
    expect(serialized(sink)).not.toContain('SECRET IDEMPOTENCY DETAIL');
  });

  it('never lets the telemetry sink alter a Provider decision and leaves unrelated routes unobserved', async () => {
    const sink: MgsnSemanticTelemetrySinkV1 = {
      record: () => Promise.reject(new Error('telemetry unavailable'))
    };
    const response = json(201, { providerAcceptance: { decision: 'DECLINED' } });
    const unrelated = json(200, { provider: { providerId: 'SECRET_UNRELATED' } });
    const routes = observeMgsnProviderExecutionSemanticRoutesV1(
      [
        route('/v1/provider/allocations/:allocationId/respond', () => response),
        route('/v1/providers', () => unrelated)
      ],
      sink
    );

    await expect(routes[0]!.handle(request)).resolves.toBe(response);
    await expect(routes[1]!.handle(request)).resolves.toBe(unrelated);
  });
});
