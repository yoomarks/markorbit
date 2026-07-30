import { describe, expect, it } from 'vitest';
import {
  assertExecutionAuthorityConsequencesFalse,
  createExecutionSemanticFixture,
  executionSemanticCaseIds,
  type ExecutionSemanticError
} from '../../../tests/integration/execution-negative-path-fixtures.js';

describe('Execution Milestone negative-path semantic matrix', () => {
  it.each(executionSemanticCaseIds)(
    '%s Service boundary preserves typed authoritative failure',
    async (caseId) => {
      const fixture = await createExecutionSemanticFixture(caseId);
      const before = await fixture.state();
      let error: ExecutionSemanticError | undefined;
      try {
        await fixture.invoke();
      } catch (value) {
        error = value as ExecutionSemanticError;
      }
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        code: fixture.descriptor.expectedDomainErrorCode,
        status: fixture.descriptor.expectedGatewayHttpStatus
      });
      expect(error?.details).toMatchObject({ stage: fixture.descriptor.stage });
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
