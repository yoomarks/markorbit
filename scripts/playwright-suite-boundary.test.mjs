import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const listSuite = (config) => {
  const output = execFileSync(
    'pnpm',
    ['exec', 'playwright', 'test', `--config=${config}`, '--list'],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  const entries = [...output.matchAll(/^\s+\[([^\]]+)\] › ([^:]+\.spec\.ts):/gm)].map(
    ([, project, file]) => ({ project, file })
  );
  return { entries, output };
};

test('default Playwright inventory excludes the real-runtime suite', () => {
  const { entries, output } = listSuite('playwright.config.ts');
  assert.equal(entries.length, 32);
  assert.deepEqual([...new Set(entries.map(({ file }) => file))].sort(), [
    'filing-authorization-release.spec.ts',
    'lite.spec.ts',
    'markreg.spec.ts',
    'milestone-001-deep-link-recovery.spec.ts',
    'operations.spec.ts'
  ]);
  assert.deepEqual(
    Object.fromEntries(
      ['desktop-chromium', 'mobile-chromium'].map((project) => [
        project,
        entries.filter((entry) => entry.project === project).length
      ])
    ),
    { 'desktop-chromium': 16, 'mobile-chromium': 16 }
  );
  assert.deepEqual(
    Object.fromEntries(
      ['desktop-chromium', 'mobile-chromium'].map((project) => [
        project,
        entries.filter(
          (entry) =>
            entry.project === project && entry.file === 'milestone-001-deep-link-recovery.spec.ts'
        ).length
      ])
    ),
    { 'desktop-chromium': 5, 'mobile-chromium': 5 }
  );
  assert.doesNotMatch(output, /milestone-001-real-runtime\.spec\.ts|@real-runtime/);
});

test('real-runtime Playwright inventory contains only desktop and mobile golden paths', () => {
  const { entries } = listSuite('playwright.real-runtime.config.ts');
  assert.equal(entries.length, 2);
  assert.ok(entries.every(({ file }) => file === 'milestone-001-real-runtime.spec.ts'));
  assert.deepEqual(entries.map(({ project }) => project).sort(), [
    'real-runtime-desktop-chromium',
    'real-runtime-mobile-chromium-390'
  ]);
});

test('Professional Review runtime inventory is isolated to its dedicated desktop and mobile spec', () => {
  const { entries } = listSuite('playwright.professional-review-real-runtime.config.ts');
  assert.equal(entries.length, 2);
  assert.ok(entries.every(({ file }) => file === 'professional-review-real-runtime.spec.ts'));
  assert.deepEqual(entries.map(({ project }) => project).sort(), [
    'professional-review-desktop',
    'professional-review-mobile-390'
  ]);
});
