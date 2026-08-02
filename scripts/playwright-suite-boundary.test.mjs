import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
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

test('Lite Matter runtime owns only its independent zero-retry desktop and mobile spec', () => {
  const { entries } = listSuite('playwright.lite-matter-real-runtime.config.ts');
  assert.equal(entries.length, 2);
  assert.ok(entries.every(({ file }) => file === 'lite-matter-real-runtime.spec.ts'));
  assert.deepEqual(entries.map(({ project }) => project).sort(), [
    'lite-matter-desktop',
    'lite-matter-mobile-390'
  ]);
  const source = fs.readFileSync('playwright.lite-matter-real-runtime.config.ts', 'utf8');
  assert.match(source, /workers:\s*1/u);
  assert.match(source, /retries:\s*0/u);
});

test('Document Package runtime owns only its independent zero-retry desktop and mobile spec', () => {
  const { entries } = listSuite('playwright.document-package-real-runtime.config.ts');
  assert.equal(entries.length, 2);
  assert.ok(entries.every(({ file }) => file === 'document-package-real-runtime.spec.ts'));
  assert.deepEqual(entries.map(({ project }) => project).sort(), [
    'document-package-desktop',
    'document-package-mobile-390'
  ]);
  const source = fs.readFileSync('playwright.document-package-real-runtime.config.ts', 'utf8');
  assert.match(source, /workers:\s*1/u);
  assert.match(source, /retries:\s*0/u);
  const spec = fs.readFileSync('tests/e2e/document-package-real-runtime.spec.ts', 'utf8');
  assert.match(spec, /task025Desktop/u);
  assert.match(spec, /task025Mobile/u);
});

test('every TASK 026 real-runtime config has exact topology and no interception', () => {
  for (const [config, spec] of [
    ['playwright.real-runtime.config.ts', 'tests/e2e/milestone-001-real-runtime.spec.ts'],
    ['playwright.lite-matter-real-runtime.config.ts', 'tests/e2e/lite-matter-real-runtime.spec.ts'],
    [
      'playwright.professional-review-real-runtime.config.ts',
      'tests/e2e/professional-review-real-runtime.spec.ts'
    ],
    [
      'playwright.document-package-real-runtime.config.ts',
      'tests/e2e/document-package-real-runtime.spec.ts'
    ]
  ]) {
    const source = fs.readFileSync(config, 'utf8');
    assert.match(source, /testMatch:/u, `${config} needs an exact testMatch`);
    assert.match(source, /workers:\s*1/u);
    assert.match(source, /retries:\s*0/u);
    assert.doesNotMatch(
      fs.readFileSync(spec, 'utf8'),
      /(?:page|context)\.route\s*\(|route\.fulfill\s*\(/u,
      `${spec} must cross real boundaries`
    );
  }
});
