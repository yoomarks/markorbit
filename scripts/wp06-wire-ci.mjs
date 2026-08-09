import fs from 'node:fs';

const orderPath = 'apps/markreg-web/src/OrderJourney.tsx';
let order = fs.readFileSync(orderPath, 'utf8');
const retryNeedle = `        <ErrorState
          title={copy.title}
          description={copy.description}
          onRetry={problem === 'PERMISSION_DENIED' ? undefined : () => void reload()}
        />`;
const retryReplacement = `        <ErrorState
          title={copy.title}
          description={copy.description}
          {...(problem === 'PERMISSION_DENIED' ? {} : { onRetry: () => void reload() })}
        />`;
if (!order.includes(retryNeedle)) throw new Error('Order retry prop anchor not found');
order = order.replace(retryNeedle, retryReplacement);
fs.writeFileSync(orderPath, order);

const packagePath = 'package.json';
let pkg = fs.readFileSync(packagePath, 'utf8');
const packageNeedle = '    "test:order:client": "pnpm --filter @markorbit/markreg-web exec vitest run tests/order-api.test.ts"\n';
const packageReplacement = '    "test:order:client": "pnpm --filter @markorbit/markreg-web exec vitest run tests/order-api.test.ts",\n    "build:order-journey-deps": "turbo run build --filter=@markorbit/core-service... --filter=@markorbit/markreg-service... --filter=@markorbit/gateway... --filter=@markorbit/markreg-web...",\n    "test:order:journey": "pnpm --filter @markorbit/markreg-web exec vitest run tests/OrderJourney.test.tsx tests/ConfirmationMatterFlow.test.tsx",\n    "test:order:journey:no-interception": "node scripts/validate-order-journey-no-interception.mjs",\n    "test:order:journey:browser": "pnpm build:order-journey-deps && pnpm test:order:journey:no-interception && playwright test --config playwright.order-journey-real-runtime.config.ts"\n';
if (!pkg.includes(packageNeedle)) throw new Error('package.json Order script anchor not found');
pkg = pkg.replace(packageNeedle, packageReplacement);
fs.writeFileSync(packagePath, pkg);

fs.rmSync('scripts/wp06-wire-ci.mjs');
fs.rmSync('.github/workflows/wp06-wire-ci.yml');
