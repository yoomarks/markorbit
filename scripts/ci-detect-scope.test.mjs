import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChangedFiles } from './ci-detect-scope.mjs';

test('payment-only changes stay in the payment lane', () => {
  const scope = classifyChangedFiles(
    [
      'services/payment/src/payment-service.ts',
      'apps/gateway/src/payment-http.ts',
      'packages/contracts/src/payment.ts',
      'packages/contracts/package.json',
      'infrastructure/persistence/migrations/0051_payment_foundation.sql',
      'pnpm-lock.yaml',
      'tsconfig.base.json'
    ],
    { paymentAvailable: true }
  );
  assert.equal(scope.payment, true);
  assert.equal(scope.gateway, true);
  assert.equal(scope.persistence, true);
  assert.equal(scope.shared, false);
  assert.equal(scope.core, false);
  assert.equal(scope.lite, false);
  assert.equal(scope.capability, false);
  assert.equal(scope.markreg, false);
  assert.equal(scope.execution, false);
  assert.equal(scope.mgsn, false);
  assert.equal(scope.browser, false);
  assert.equal(scope.full_typecheck, true);
});

test('owned migrations select only their domain plus persistence', () => {
  const markreg = classifyChangedFiles(['infrastructure/persistence/migrations/0050_markreg_commercial_checkout.sql']);
  assert.equal(markreg.markreg, true);
  assert.equal(markreg.persistence, true);
  assert.equal(markreg.core, false);
  assert.equal(markreg.execution, false);

  const capability = classifyChangedFiles(['infrastructure/persistence/migrations/0047_capability_engine_reflection_disposition_profile_twin.sql']);
  assert.equal(capability.capability, true);
  assert.equal(capability.persistence, true);
  assert.equal(capability.markreg, false);
});

test('unknown migrations conservatively expand downstream coverage', () => {
  const scope = classifyChangedFiles(['infrastructure/persistence/migrations/9999_shared_unknown.sql'], { paymentAvailable: true });
  assert.equal(scope.shared, true);
  assert.equal(scope.core, true);
  assert.equal(scope.lite, true);
  assert.equal(scope.capability, true);
  assert.equal(scope.markreg, true);
  assert.equal(scope.execution, true);
  assert.equal(scope.mgsn, true);
  assert.equal(scope.payment, true);
});

test('web changes select browser validation without forcing database integration', () => {
  const scope = classifyChangedFiles(['apps/markreg-web/src/App.tsx'], { paymentAvailable: false });
  assert.equal(scope.web, true);
  assert.equal(scope.browser, true);
  assert.equal(scope.integration, false);
});

test('generic contracts expand to downstream domains without forcing browser E2E', () => {
  const scope = classifyChangedFiles(['packages/contracts/src/workspace.ts'], { paymentAvailable: true });
  assert.equal(scope.shared, true);
  assert.equal(scope.core, true);
  assert.equal(scope.lite, true);
  assert.equal(scope.capability, true);
  assert.equal(scope.markreg, true);
  assert.equal(scope.execution, true);
  assert.equal(scope.mgsn, true);
  assert.equal(scope.payment, true);
  assert.equal(scope.browser, false);
});

test('payment contract manifest plus payment contract remains payment-specific', () => {
  const scope = classifyChangedFiles(
    ['packages/contracts/package.json', 'packages/contracts/src/payment.ts'],
    { paymentAvailable: true }
  );
  assert.equal(scope.payment, true);
  assert.equal(scope.shared, false);
  assert.equal(scope.core, false);
});

test('CI governance intentionally exercises cross-domain lanes', () => {
  const scope = classifyChangedFiles(['.github/workflows/ci.yml'], { paymentAvailable: false });
  assert.equal(scope.shared, true);
  assert.equal(scope.core, true);
  assert.equal(scope.lite, true);
  assert.equal(scope.capability, true);
  assert.equal(scope.markreg, true);
  assert.equal(scope.execution, true);
  assert.equal(scope.mgsn, true);
  assert.equal(scope.payment, false);
});
