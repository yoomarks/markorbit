import { describe, expect, it } from 'vitest';
import {
  missingUserStateEvidence,
  readUserStateCoverageManifest,
  summarizeUserStateCoverage,
  validateUserStateCoverage
} from './user-state-coverage-audit';

describe('Lite user-state Storybook coverage audit', () => {
  it('keeps every reviewed state explicit and backed by a real story export', () => {
    const manifest = readUserStateCoverageManifest();
    expect(validateUserStateCoverage(manifest)).toEqual([]);
    expect(summarizeUserStateCoverage(manifest)).toEqual({
      EVIDENCED: 53,
      MISSING: 17,
      NOT_APPLICABLE: 2
    });
  });

  it('reports missing evidence deterministically without treating N/A as missing', () => {
    expect(missingUserStateEvidence(readUserStateCoverageManifest())).toEqual([
      'capability-center/UNAVAILABLE',
      'content-studio/LOADING',
      'content-studio/STALE_OR_NEEDS_REFRESH',
      'execution-release/PERMISSION_RESTRICTED',
      'execution-release/UNAVAILABLE',
      'governed-action-composer/ERROR',
      'governed-action-composer/PERMISSION_RESTRICTED',
      'governed-action-composer/STALE_OR_NEEDS_REFRESH',
      'guide/ERROR',
      'guide/LOADING',
      'guide/PERMISSION_RESTRICTED',
      'site-manager/ERROR',
      'site-manager/STALE_OR_NEEDS_REFRESH',
      'today-workspace/LOADING',
      'today-workspace/STALE_OR_NEEDS_REFRESH',
      'workspace-insights/ERROR',
      'workspace-insights/STALE_OR_NEEDS_REFRESH'
    ]);
  });

  it('fails closed when a state has neither evidence nor an explicit applicability reason', () => {
    const manifest = structuredClone(readUserStateCoverageManifest());
    manifest.surfaces[0]!.coverage.UNAVAILABLE = { status: 'NOT_APPLICABLE' };

    expect(validateUserStateCoverage(manifest)).toContain(
      'capability-center/UNAVAILABLE: an explicit reason is required'
    );
  });

  it('fails when evidence points at a story export that does not exist', () => {
    const manifest = structuredClone(readUserStateCoverageManifest());
    manifest.surfaces[0]!.coverage.LOADING = {
      status: 'EVIDENCED',
      stories: ['ImaginedOwnerTruth']
    };

    expect(validateUserStateCoverage(manifest)).toContain(
      'capability-center/LOADING: missing story export ImaginedOwnerTruth'
    );
  });

  it('rejects an excluded Agency or Trading surface from the reviewed set', () => {
    const manifest = structuredClone(readUserStateCoverageManifest());
    manifest.surfaces[0]!.storyFile =
      'apps/lite-web/src/features/trading-studio/TradingStudio.stories.tsx';

    expect(validateUserStateCoverage(manifest)).toContain(
      'capability-center: excluded lane entered the reviewed surface inventory'
    );
  });
});
