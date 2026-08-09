import fs from 'node:fs';

const packagePath = 'package.json';
let pkg = fs.readFileSync(packagePath, 'utf8');
const packageNeedle = '    "test:order:client": "pnpm --filter @markorbit/markreg-web exec vitest run tests/order-api.test.ts"\n';
const packageReplacement = '    "test:order:client": "pnpm --filter @markorbit/markreg-web exec vitest run tests/order-api.test.ts",\n    "build:order-journey-deps": "turbo run build --filter=@markorbit/core-service... --filter=@markorbit/markreg-service... --filter=@markorbit/gateway... --filter=@markorbit/markreg-web...",\n    "test:order:journey": "pnpm --filter @markorbit/markreg-web exec vitest run tests/OrderJourney.test.tsx tests/ConfirmationMatterFlow.test.tsx",\n    "test:order:journey:no-interception": "node scripts/validate-order-journey-no-interception.mjs",\n    "test:order:journey:browser": "pnpm build:order-journey-deps && pnpm test:order:journey:no-interception && playwright test --config playwright.order-journey-real-runtime.config.ts"\n';
if (!pkg.includes(packageNeedle)) throw new Error('package.json Order script anchor not found');
pkg = pkg.replace(packageNeedle, packageReplacement);
fs.writeFileSync(packagePath, pkg);

const ciPath = '.github/workflows/ci.yml';
let ci = fs.readFileSync(ciPath, 'utf8');
const persistenceNeedle = '      - name: Run typed Order browser client tests\n        run: pnpm test:order:client\n';
const persistenceReplacement = `${persistenceNeedle}      - name: Run durable Order journey component tests\n        run: pnpm test:order:journey\n`;
if (!ci.includes(persistenceNeedle)) throw new Error('CI Order client anchor not found');
ci = ci.replace(persistenceNeedle, persistenceReplacement);
const browserNeedle = '      - run: node --test scripts/playwright-suite-boundary.test.mjs\n\n  validate:\n';
const browserReplacement = '      - run: node --test scripts/playwright-suite-boundary.test.mjs\n      - name: Run durable Order journey real runtime\n        run: pnpm test:order:journey:browser\n\n  validate:\n';
if (!ci.includes(browserNeedle)) throw new Error('CI browser anchor not found');
ci = ci.replace(browserNeedle, browserReplacement);
fs.writeFileSync(ciPath, ci);

fs.rmSync('scripts/wp06-wire-ci.mjs');
fs.rmSync('.github/workflows/wp06-wire-ci.yml');
