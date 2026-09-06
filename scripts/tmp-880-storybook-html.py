from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one target, found {count}')
    target.write_text(text.replace(old, new, 1))


replace_once(
    'packages/ui/package.json',
    '    "@storybook/addon-essentials": "8.6.14",\n',
    '    "@storybook/addon-essentials": "8.6.14",\n    "@storybook/html": "8.6.14",\n    "@storybook/html-vite": "8.6.14",\n',
)
replace_once(
    'packages/ui/package.json',
    '    "lint": "eslint src tests .storybook"\n',
    '    "lint": "eslint src tests .storybook .storybook-provider"\n',
)

replace_once(
    'package.json',
    '    "build:storybook-matrix": "pnpm --filter @markorbit/ui build && rm -rf .artifacts/storybook && pnpm --filter @markorbit/markreg-web exec storybook build -c ../../packages/ui/.storybook -o ../../.artifacts/storybook/markreg && pnpm --filter @markorbit/lite-web exec storybook build -c ../../packages/ui/.storybook -o ../../.artifacts/storybook/lite",\n',
    '    "build:provider-storybook": "pnpm --filter @markorbit/ui exec storybook build -c .storybook-provider -o ../../.artifacts/storybook/provider",\n    "build:storybook-matrix": "pnpm --filter @markorbit/contracts build && pnpm --filter @markorbit/ui build && rm -rf .artifacts/storybook && pnpm --filter @markorbit/markreg-web exec storybook build -c ../../packages/ui/.storybook -o ../../.artifacts/storybook/markreg && pnpm --filter @markorbit/lite-web exec storybook build -c ../../packages/ui/.storybook -o ../../.artifacts/storybook/lite && pnpm build:provider-storybook",\n',
)
replace_once(
    'package.json',
    '    "test:storybook-index": "node scripts/validate-storybook-index.mjs .artifacts/storybook/markreg/index.json .artifacts/storybook/lite/index.json",\n',
    '    "test:provider-storybook-index": "node scripts/validate-provider-storybook-index.mjs .artifacts/storybook/provider/index.json",\n    "test:storybook-index": "node scripts/validate-storybook-index.mjs .artifacts/storybook/markreg/index.json .artifacts/storybook/lite/index.json && pnpm test:provider-storybook-index",\n',
)

provider_config = Path('packages/ui/.storybook-provider/main.ts')
provider_config.parent.mkdir(parents=True, exist_ok=True)
provider_config.write_text("""import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  stories: ['../../../apps/provider-web/src/**/*.stories.@(js|mjs|ts)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/html-vite', options: {} },
  docs: { autodocs: 'tag' }
};

export default config;
""")

Path('apps/provider-web/src/ProviderWorkspaceShell.stories.js').write_text("""import providerWorkspaceHtml from '../index.html?raw';
import './styles.css';

export default {
  title: 'Provider Web/Infrastructure',
  parameters: { layout: 'fullscreen' }
};

export const ShellRegistration = {
  render: () => {
    const source = new DOMParser().parseFromString(providerWorkspaceHtml, 'text/html');
    const app = source.querySelector('#app');
    if (!(app instanceof HTMLElement)) throw new Error('Provider Workspace story shell is unavailable');
    app.dataset.storybookProviderRegistration = 'true';
    return app;
  },
  play: async () => {
    await import('./main.js?storybook-shell-registration');
  }
};
""")

Path('scripts/validate-provider-storybook-index.mjs').write_text("""import assert from 'node:assert/strict';
import fs from 'node:fs';

const [file] = process.argv.slice(2);
assert.ok(file, 'Provider Storybook built index is required');
const index = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = index.entries ?? {};
const storyId = 'provider-web-infrastructure--shell-registration';
assert.ok(entries[storyId], `${file} is missing ${storyId}`);
assert.equal(entries[storyId].type, 'story', `${storyId} must be a rendered story entry`);
console.log(`Provider Storybook index PASS: ${storyId}`);
""")

Path('playwright.provider-storybook.config.ts').write_text("""import { defineConfig } from '@playwright/test';

const inCI = Boolean(process.env['CI']);
const storybookUrl = 'http://127.0.0.1:6015';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /provider-storybook\\.spec\\.ts/,
  outputDir: 'test-results/provider-storybook',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: inCI
    ? [['line'], ['html', { outputFolder: 'playwright-report/provider-storybook', open: 'never' }]]
    : 'list',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'provider-storybook-desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'provider-storybook-mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: 'pnpm --filter @markorbit/ui exec storybook dev -c .storybook-provider -p 6015 --ci',
    url: storybookUrl,
    reuseExistingServer: !inCI
  }
});
""")

Path('tests/e2e/provider-storybook.spec.ts').write_text("""import { expect, test } from '@playwright/test';

const storyUrl =
  'http://127.0.0.1:6015/iframe.html?id=provider-web-infrastructure--shell-registration&viewMode=story';

test('Provider Web approved story path renders the actual vanilla shell @visual', async ({ page }) => {
  await page.goto(storyUrl);

  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-storybook-provider-registration', 'true');
  await expect(app).toHaveAttribute('data-runtime', 'provider-workspace-own-work');
  await expect(page.getByRole('heading', { level: 1, name: 'Provider Workspace' })).toBeVisible();
  await expect(page.getByLabel('Core Workspace ID')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load own work' })).toBeVisible();
});
""")
