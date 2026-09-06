from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one replacement target, found {count}')
    target.write_text(text.replace(old, new, 1))


replace_once(
    'scripts/ci-detect-scope.mjs',
    "const browserProductLoopSpecific = (path) =>\n  productLoopSpecific(path) || path.includes('trademark-asset') || path.includes('prepared-action');\n\nconst markregWebProductionRuntimeSpecific = (path) => {",
    "const browserProductLoopSpecific = (path) =>\n  productLoopSpecific(path) || path.includes('trademark-asset') || path.includes('prepared-action');\nconst browserProviderWebSpecific = (path) =>\n  starts(path, 'apps/provider-web/') ||\n  path === 'tests/e2e/provider.spec.ts' ||\n  path === 'playwright.provider.config.ts';\n\nconst markregWebProductionRuntimeSpecific = (path) => {",
)
replace_once(
    'scripts/ci-detect-scope.mjs',
    "      starts(path, 'apps/operations-console/') ||\n      starts(path, 'packages/ui/')",
    "      starts(path, 'apps/operations-console/') ||\n      starts(path, 'apps/provider-web/') ||\n      starts(path, 'packages/ui/')",
)
replace_once(
    'scripts/ci-detect-scope.mjs',
    "  let browserProductLoop = files.some(browserProductLoopSpecific) && web;\n  let browserExplicit = files.some(",
    "  let browserProductLoop = files.some(browserProductLoopSpecific) && web;\n  let browserProviderWeb = files.some(browserProviderWebSpecific);\n  let browserExplicit = files.some(",
)
replace_once(
    'scripts/ci-detect-scope.mjs',
    "    !browserOrderJourney &&\n    !browserProductLoop;",
    "    !browserOrderJourney &&\n    !browserProductLoop &&\n    !browserProviderWeb;",
)
replace_once(
    'scripts/ci-detect-scope.mjs',
    "    browserDocumentPackage ||\n    browserOrderJourney ||\n    browserProductLoop;",
    "    browserDocumentPackage ||\n    browserOrderJourney ||\n    browserProductLoop ||\n    browserProviderWeb;",
)
replace_once(
    'scripts/ci-detect-scope.mjs',
    "    browser_generic: browserGeneric,\n    browser_professional_review: browserProfessionalReview,",
    "    browser_generic: browserGeneric,\n    browser_provider_web: browserProviderWeb,\n    browser_professional_review: browserProfessionalReview,",
)

test_anchor = """test('ordinary MarkReg web changes select browser L2 without database or Product Loop amplification', () => {
  const scope = classifyChangedFiles(['apps/markreg-web/src/App.tsx'], {
    paymentAvailable: false
  });
  assert.equal(scope.web, true);
  assert.equal(scope.browser, true);
  assert.equal(scope.browser_generic, true);
  assert.equal(scope.production_runtime, false);
  assert.equal(scope.postgres, false);
  assert.equal(scope.integration, false);
  assert.equal(scope.product_loop, false);
  assert.equal(scope.hard_gate, false);
  assert.equal(scope.l1_fast, true);
  assert.equal(scope.l2_merge, true);
  assert.equal(scope.l3_full, false);
});
"""
provider_test = test_anchor + """

test('Provider Web changes select the dedicated browser acceptance lane', () => {
  const scope = classifyChangedFiles(['apps/provider-web/src/main.js'], {
    paymentAvailable: false
  });
  assert.equal(scope.web, true);
  assert.equal(scope.browser, true);
  assert.equal(scope.browser_provider_web, true);
  assert.equal(scope.browser_generic, false);
  assert.equal(scope.postgres, false);
  assert.equal(scope.integration, false);
  assert.equal(scope.product_loop, false);
  assert.equal(scope.hard_gate, false);
  assert.equal(scope.l1_fast, true);
  assert.equal(scope.l2_merge, true);
  assert.equal(scope.l3_full, false);
});
"""
replace_once('scripts/ci-detect-scope.test.mjs', test_anchor, provider_test)

ci_path = Path('.github/workflows/ci.yml')
ci = ci_path.read_text()
generic_line = next(
    line for line in ci.splitlines() if 'browser_generic:' in line and 'steps.scope.outputs' in line
)
provider_expr = '${{ steps.scope.outputs.browser_provider_web }}'
ci = ci.replace(generic_line, generic_line + '\n      browser_provider_web: ' + provider_expr, 1)
fallback = "      - name: Explicit browser fallback\n"
provider_step = (
    "      - name: Provider Web browser\n"
    "        if: needs.detect.outputs.browser_provider_web == 'true'\n"
    "        run: pnpm exec playwright test --config playwright.provider.config.ts --reporter=line\n"
)
if ci.count(fallback) != 1:
    raise SystemExit('ci.yml: explicit browser fallback marker missing or duplicated')
ci = ci.replace(fallback, provider_step + fallback, 1)
fallback_condition = (
    "          needs.detect.outputs.browser == 'true' &&\n"
    "          needs.detect.outputs.browser_professional_review != 'true' &&"
)
if ci.count(fallback_condition) != 1:
    raise SystemExit('ci.yml: fallback condition marker missing or duplicated')
ci = ci.replace(
    fallback_condition,
    "          needs.detect.outputs.browser == 'true' &&\n"
    "          needs.detect.outputs.browser_provider_web != 'true' &&\n"
    "          needs.detect.outputs.browser_professional_review != 'true' &&",
    1,
)
ci_path.write_text(ci)

replace_once(
    'tests/e2e/applications.ts',
    "  operations: { package: '@markorbit/operations-console', port: 4173 }\n} as const;",
    "  operations: { package: '@markorbit/operations-console', port: 4173 },\n  provider: { package: '@markorbit/provider-web', port: 4175 }\n} as const;",
)

Path('playwright.provider.config.ts').write_text(
    """import { defineConfig } from '@playwright/test';
import { applicationUrl, applications } from './tests/e2e/applications.js';

const inCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /provider\\.spec\\.ts/,
  outputDir: 'test-results/provider',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: inCI
    ? [['line'], ['html', { outputFolder: 'playwright-report/provider', open: 'never' }]]
    : 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'provider-desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'provider-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: `pnpm --filter ${applications.provider.package} dev`,
    url: applicationUrl('provider'),
    reuseExistingServer: !inCI
  }
});
"""
)

Path('tests/e2e/provider.spec.ts').write_text(
    """import { expect, test } from '@playwright/test';
import { applicationUrl } from './applications.js';

test('Provider Workspace shell loads through the real vanilla app @visual', async ({ page }) => {
  await page.goto(applicationUrl('provider'));

  await expect(page).toHaveTitle('MarkOrbit Provider Workspace');
  await expect(page.locator('#app')).toHaveAttribute('data-runtime', 'provider-workspace-own-work');
  await expect(page.getByRole('heading', { level: 1, name: 'Provider Workspace' })).toBeVisible();
  await expect(page.getByLabel('Core Workspace ID')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load own work' })).toBeVisible();
  await expect(page.getByText(/Queue visibility is read-only context/)).toBeVisible();
});
"""
)
