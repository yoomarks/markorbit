import { describe, expect, it } from 'vitest';
import {
  assertAuthorityConsequencesFalse,
  createMarkregSemanticFixture,
  markregSemanticCaseIds,
  type MarkregSemanticError
} from '../../../tests/integration/markreg-negative-path-fixtures.js';

describe('MarkReg Milestone negative-path semantic matrix', () => {
  it.each(markregSemanticCaseIds)(
    '%s Service boundary preserves typed immutable failure',
    async (caseId) => {
      const fixture = createMarkregSemanticFixture(caseId);
      const before = fixture.state();
      let error: MarkregSemanticError | undefined;
      try {
        await fixture.invoke();
      } catch (value) {
        error = value as MarkregSemanticError;
      }
      expect(error).toBeDefined();
      expect(error).toMatchObject({
        code: fixture.descriptor.expectedDomainErrorCode,
        status: fixture.descriptor.expectedGatewayHttpStatus
      });
      expect(error?.details).toMatchObject({ stage: fixture.descriptor.stage });
      expect(fixture.state()).toEqual(before);
      expect(before.matter.matterDrafts).toHaveLength(caseId === 'NP-005' ? 1 : 0);
      expect(before.preparation.preparationLocks).toHaveLength(caseId === 'NP-011' ? 1 : 0);
      expect(fixture.events).toHaveLength(0);
      assertAuthorityConsequencesFalse();
    }
  );
});
