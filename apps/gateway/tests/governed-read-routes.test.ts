import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createMarkReg,
  InMemoryMarkRegRepository
} from '../../../services/markreg/src/index.js';
import { createRuntime as createGateway } from '../src/index.js';

const active: ServiceRuntime[] = [];
afterEach(async () =>
  Promise.all(
    active
      .splice(0)
      .reverse()
      .map((x) => x.stop())
  )
);
async function start(runtime: ServiceRuntime) {
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

describe('governed direct-link read routes', () => {
  it('loads exact Consultation, Recommendation and Quote identities without mutation or latest fallback', async () => {
    const repository = new InMemoryMarkRegRepository();
    const intake = {
      intakeId: 'intake_direct',
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      status: 'RECOMMENDATION_READY',
      customerIntent: {
        brandName: 'Orbit',
        applicantCountry: 'GB',
        targetJurisdictions: ['US'],
        goodsServicesDescription: 'software'
      },
      createdAt: '2026-07-29T00:00:00.000Z',
      correlationId: 'correlation_direct'
    } as const;
    const recommendation = {
      recommendationId: 'recommendation_direct',
      intakeId: intake.intakeId,
      status: 'FIXTURE_ONLY',
      options: [
        { tier: 'A', name: 'Essential Protection', description: 'A' },
        { tier: 'B', name: 'Recommended Protection', description: 'B' },
        { tier: 'C', name: 'Extended Protection', description: 'C' }
      ],
      rationale: 'fixture',
      assumptions: [],
      limitations: [],
      provenance: [],
      generatedAt: intake.createdAt
    } as const;
    repository.save('read-key', {
      fingerprint: 'fixture',
      intake,
      intakeCreatedPublished: true,
      result: {
        intake,
        recommendation,
        trace: {
          correlationId: intake.correlationId,
          capabilityRequestId: 'capability_direct',
          executionId: 'execution_direct',
          provenanceRefs: []
        }
      }
    } as never);
    repository.saveQuote({
      quoteId: 'quote_direct',
      pricingRuleVersion: 'fixture-usd-v1',
      status: 'READY'
    } as never);
    const markreg = createMarkReg({ port: 0, repository });
    const markregUrl = await start(markreg);
    const gateway = createGateway({ port: 0, markRegUrl: markregUrl });
    const base = await start(gateway);
    for (const [path, key, id] of [
      ['/api/markreg/intakes/intake_direct', 'intake', 'intake_direct'],
      [
        '/api/markreg/recommendations/recommendation_direct',
        'recommendation',
        'recommendation_direct'
      ],
      ['/api/markreg/quotes/quote_direct', 'quote', 'quote_direct']
    ] as const) {
      const response = await fetch(base + path);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ [key]: { [`${key}Id`]: id } });
    }
    const unknown = await fetch(`${base}/api/markreg/intakes/intake_unknown`);
    expect(unknown.status).toBe(404);
    expect(repository.size).toBe(1);
  });
});
