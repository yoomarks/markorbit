import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

export const USER_STATE_FAMILIES = [
  'LOADING',
  'EMPTY',
  'PARTIAL',
  'STALE_OR_NEEDS_REFRESH',
  'UNAVAILABLE',
  'PERMISSION_RESTRICTED',
  'ERROR',
  'SUCCESS_OR_READY'
] as const;

export type UserStateFamily = (typeof USER_STATE_FAMILIES)[number];
export type CoverageStatus = 'EVIDENCED' | 'MISSING' | 'NOT_APPLICABLE';

export type CoverageCell = {
  status: CoverageStatus;
  stories?: string[];
  reason?: string;
};

export type UserStateCoverageManifest = {
  schemaVersion: number;
  owner: string;
  purpose: string;
  stateFamilies: UserStateFamily[];
  scopeExclusions: Array<{ path: string; reason: string }>;
  surfaces: Array<{
    id: string;
    label: string;
    userJob: string;
    storyFile: string;
    coverage: Record<UserStateFamily, CoverageCell>;
  }>;
};

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../../../../');
const MANIFEST_PATH = resolve(REPOSITORY_ROOT, 'docs/quality/LITE-USER-STATE-COVERAGE.json');

export function readUserStateCoverageManifest(path = MANIFEST_PATH): UserStateCoverageManifest {
  return JSON.parse(readFileSync(path, 'utf8')) as UserStateCoverageManifest;
}

function storyExports(path: string): Set<string> {
  const source = readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8');
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

export function validateUserStateCoverage(manifest: UserStateCoverageManifest): string[] {
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
          if (!exports.has(story)) {
            errors.push(`${surface.id}/${family}: missing story export ${story}`);
          }
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

export function missingUserStateEvidence(manifest: UserStateCoverageManifest): string[] {
  return manifest.surfaces
    .flatMap((surface) =>
      USER_STATE_FAMILIES.flatMap((family) =>
        surface.coverage[family].status === 'MISSING' ? [`${surface.id}/${family}`] : []
      )
    )
    .sort();
}

export function summarizeUserStateCoverage(
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
