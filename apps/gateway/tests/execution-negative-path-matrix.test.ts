/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return -- fixture sources intentionally implement async owning-service boundaries. */
import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime as createExecution } from '../../../services/execution/src/index.js';
import {
  assertExecutionAuthorityConsequencesFalse,
  createExecutionSemanticFixture,
  executionSemanticCaseIds
} from '../../../tests/integration/execution-negative-path-fixtures.js';
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

describe('Execution negative paths through real Gateway HTTP', () => {
  it.each(executionSemanticCaseIds)(
    '%s Gateway HTTP preserves semantic authoritative failure',
    async (caseId) => {
      const fixture = await createExecutionSemanticFixture(caseId);
      const before = await fixture.state();
      const executionUrl = await start(
        createExecution({
          port: 0,
          reviewRepository: fixture.reviewRepository,
          matterDraftSource: {
            getMatterDraft: async () =>
              ({
                matterDraftId: `matter-draft_milestone-${caseId.toLowerCase()}`,
                matterDraftVersion: 'matter-v1',
                customerId: 'customer_fixture',
                confirmationId: 'confirmation_fixture',
                status: 'READY_FOR_PROFESSIONAL_REVIEW'
              }) as never
          },
          filingRepository: fixture.filingRepository,
          preparationLockSource: {
            getPreparationLock: async () => structuredClone(fixture.preparationLock)
          },
          now: () => '2026-07-29T12:00:00.000Z'
        })
      );
      const gatewayUrl = await start(
        createGateway({ port: 0, executionUrl, milestoneTestRuntime: true })
      );
      const request = await fixture.http();
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
      expect(await fixture.state()).toEqual(await fixture.expectedPostState(before));
      const after = await fixture.state();
      expect(after.filing.executionReleases).toHaveLength(before.filing.executionReleases.length);
      expect(after.filing.filingExecutionTaskDrafts).toHaveLength(
        before.filing.filingExecutionTaskDrafts.length
      );
      if (caseId === 'NP-017') {
        expect(after.filing.filingExecutionTaskDrafts).toHaveLength(1);
        expect(after.filing.filingExecutionTaskDrafts[0]?.filingExecutionTaskDraftId).toBe(
          before.filing.filingExecutionTaskDrafts[0]?.filingExecutionTaskDraftId
        );
        expect(after.filing.filingExecutionTaskDrafts[0]?.status).toBe('STALE');
        expect(after.filing.filingExecutionTaskDrafts[0]?.status).not.toBe('FILED');
        expect(after.filing.filingExecutionTaskDrafts[0]?.status).not.toBe('SUBMITTED');
      }
      assertExecutionAuthorityConsequencesFalse();
    }
  );
});
