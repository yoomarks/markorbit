import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const USER_STATE_FAMILIES = [
  'LOADING',
  'EMPTY',
  'PARTIAL',
  'STALE_OR_NEEDS_REFRESH',
  'UNAVAILABLE',
  'PERMISSION_RESTRICTED',
  'ERROR',
  'SUCCESS_OR_READY'
] as const;

type UserStateFamily = (typeof USER_STATE_FAMILIES)[number];
type CoverageStatus = 'EVIDENCED' | 'MISSING' | 'NOT_APPLICABLE';
type CoverageCell = {
  status: CoverageStatus;
  stories?: string[];
  reason?: string;
};
type UserStateCoverageManifest = {
  schemaVersion: number;
  stateFamilies: UserStateFamily[];
  scopeExclusions: Array<{ path: string; reason: string }>;
  surfaces: Array<{
    id: string;
    userJob: string;
    storyFile: string;
    coverage: Record<UserStateFamily, CoverageCell>;
  }>;
};

const repositoryRoot = resolve(import.meta.dirname, '../../../../');

function readUserStateCoverageManifest(): UserStateCoverageManifest {
  return JSON.parse(
    readFileSync(resolve(repositoryRoot, 'docs/quality/LITE-USER-STATE-COVERAGE.json'), 'utf8')
  ) as UserStateCoverageManifest;
}

function storyExports(path: string): Set<string> {
  const source = readFileSync(resolve(repositoryRoot, path), 'utf8');
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const exports = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) exports.add(declaration.name.text);
    }
  }
  return exports;
}

function validateUserStateCoverage(manifest: UserStateCoverageManifest): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== 1)
    errors.push(`unsupported schemaVersion: ${manifest.schemaVersion}`);
  if (JSON.stringify(manifest.stateFamilies) !== JSON.stringify(USER_STATE_FAMILIES)) {
    errors.push('stateFamilies must match the canonical ordered user-state families');
  }
  const ids = new Set<string>();
  const storyFiles = new Set<string>();
  for (const surface of manifest.surfaces) {
    if (ids.has(surface.id)) errors.push(`duplicate surface id: ${surface.id}`);
    ids.add(surface.id);
    if (storyFiles.has(surface.storyFile))
      errors.push(`duplicate story file: ${surface.storyFile}`);
    storyFiles.add(surface.storyFile);
    if (!surface.userJob.trim()) errors.push(`${surface.id}: userJob is required`);
    if (
      /agency-ia-prototype|trading-studio|HistoricalTrademarkAssetImportPanel|TrademarkAssetWorkspace/u.test(
        surface.storyFile
      )
    ) {
      errors.push(`${surface.id}: excluded lane entered the reviewed surface inventory`);
    }

    const exports = storyExports(surface.storyFile);
    for (const family of USER_STATE_FAMILIES) {
      const cell = surface.coverage[family];
      if (!cell) {
        errors.push(`${surface.id}/${family}: coverage cell is required`);
        continue;
      }
      if (cell.status === 'EVIDENCED') {
        if (!cell.stories?.length)
          errors.push(`${surface.id}/${family}: evidence stories are required`);
        if (cell.reason)
          errors.push(`${surface.id}/${family}: evidenced cells cannot carry a reason`);
        for (const story of cell.stories ?? []) {
          if (!exports.has(story))
            errors.push(`${surface.id}/${family}: missing story export ${story}`);
        }
      } else {
        if (cell.stories?.length)
          errors.push(`${surface.id}/${family}: non-evidenced cells cannot name stories`);
        if (!cell.reason || cell.reason.trim().length < 20) {
          errors.push(`${surface.id}/${family}: an explicit reason is required`);
        }
      }
    }
  }
  for (const exclusion of manifest.scopeExclusions) {
    if (!exclusion.reason.trim()) errors.push(`scope exclusion needs a reason: ${exclusion.path}`);
    if (storyFiles.has(exclusion.path))
      errors.push(`excluded story file is also reviewed: ${exclusion.path}`);
  }
  return errors.sort();
}

function missingUserStateEvidence(manifest: UserStateCoverageManifest): string[] {
  return manifest.surfaces
    .flatMap((surface) =>
      USER_STATE_FAMILIES.flatMap((family) =>
        surface.coverage[family].status === 'MISSING' ? [`${surface.id}/${family}`] : []
      )
    )
    .sort();
}

function summarizeUserStateCoverage(
  manifest: UserStateCoverageManifest
): Record<CoverageStatus, number> {
  const summary: Record<CoverageStatus, number> = {
    EVIDENCED: 0,
    MISSING: 0,
    NOT_APPLICABLE: 0
  };
  for (const surface of manifest.surfaces) {
    for (const family of USER_STATE_FAMILIES) summary[surface.coverage[family].status] += 1;
  }
  return summary;
}

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
