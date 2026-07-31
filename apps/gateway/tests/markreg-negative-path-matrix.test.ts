import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime as createMarkreg } from '../../../services/markreg/src/index.js';
import {
  assertAuthorityConsequencesFalse,
  createMarkregSemanticFixture,
  markregSemanticCaseIds
} from '../../../tests/integration/markreg-negative-path-fixtures.js';
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
async function start(runtime: ServiceRuntime) {
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

describe('MarkReg negative paths through real Gateway HTTP', () => {
  it.each(markregSemanticCaseIds)(
    '%s Gateway HTTP preserves semantic immutable failure',
    async (caseId) => {
      const fixture = createMarkregSemanticFixture(caseId);
      const before = fixture.state();
      const markRegUrl = await start(
        createMarkreg({
          port: 0,
          repository: fixture.repository,
          matterFlowRepository: fixture.matterRepository,
          preparationRepository: fixture.preparationRepository,
          publisher: fixture.publisher,
          milestoneTestRuntime: true,
          now: () => '2026-07-29T12:00:00.000Z'
        })
      );
      const gatewayUrl = await start(
        createGateway({ port: 0, markRegUrl, milestoneTestRuntime: true })
      );
      const request = fixture.http();
      const response = await fetch(`${gatewayUrl}${request.path}`, {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': `correlation_${caseId.toLowerCase()}`,
          ...(request.key ? { 'idempotency-key': request.key } : {})
        },
        body: JSON.stringify(request.body)
      });
      expect(response.status).toBe(fixture.descriptor.expectedGatewayHttpStatus);
      expect(response.headers.get('content-type')).toContain('application/json');
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        code: fixture.descriptor.expectedGatewayErrorCode,
        details: { stage: fixture.descriptor.stage }
      });
      expect(body['correlationId']).toEqual(expect.any(String));
      expect(body['stack']).toBeUndefined();
      expect(body['code']).not.toBe('INTERNAL_ERROR');
      expect(fixture.state()).toEqual(before);
      expect(fixture.events).toHaveLength(0);
      assertAuthorityConsequencesFalse();
    }
  );
});
