// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildLiteHref,
  liteWorkspaceIdFromLocation,
  updateLiteLocation
} from './workspace-navigation.js';

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('Workspace navigation helper', () => {
  it('builds a Workspace-scoped exact deep link', () => {
    expect(
      buildLiteHref({
        surface: 'professional-review',
        workspaceId: 'workspace-1',
        params: {
          professionalReviewCaseId: 'review_1',
          professionalReviewCaseVersion: 3
        }
      })
    ).toBe(
      '?workspaceId=workspace-1&professionalReviewCaseId=review_1&professionalReviewCaseVersion=3#work-professional-review'
    );
  });

  it('reads Workspace context without manufacturing one', () => {
    window.history.replaceState({}, '', '/?workspaceId=workspace-1#today');
    expect(liteWorkspaceIdFromLocation(window.location)).toBe('workspace-1');
    window.history.replaceState({}, '', '/#today');
    expect(liteWorkspaceIdFromLocation(window.location)).toBe('');
  });

  it('can preserve current search while moving to a governed work surface', () => {
    window.history.replaceState({}, '', '/?workspaceId=workspace-1&formalMatterId=matter_1#matters');
    updateLiteLocation(
      {
        surface: 'professional-review',
        workspaceId: 'workspace-1',
        params: {
          formalMatterId: undefined,
          professionalReviewCaseId: 'review_1',
          professionalReviewCaseVersion: 2
        }
      },
      { preserveSearch: true }
    );
    expect(window.location.search).toBe(
      '?workspaceId=workspace-1&professionalReviewCaseId=review_1&professionalReviewCaseVersion=2'
    );
    expect(window.location.hash).toBe('#work-professional-review');
  });
});
