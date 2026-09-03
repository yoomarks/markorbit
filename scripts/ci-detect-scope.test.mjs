import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChangedFiles } from './ci-detect-scope.mjs';

test('payment-only changes stay in the payment hard-gate lane', () => {
  const scope = classifyChangedFiles(
    [
      'services/payment/src/payment-service.ts',
      'apps/gateway/src/payment-http.ts',
      'packages/contracts/src/payment.ts',
      'packages/contracts/package.json',
      'infrastructure/persistence/migration-owners.json',
      'infrastructure/persistence/migrations/0051_payment_foundation.sql',
      'pnpm-lock.yaml',
      'tsconfig.base.json'
    ],
    { paymentAvailable: true }
  );
  assert.equal(scope.payment, true);
  assert.equal(scope.gateway, true);
  assert.equal(scope.persistence, true);
  assert.equal(scope.hard_gate, true);
  assert.equal(scope.l3_full, true);
  assert.equal(scope.full_typecheck, true);
});

test('owned migration plus owner map remains owner-scoped but hard-gated', () => {
  const scope = classifyChangedFiles([
    'infrastructure/persistence/migration-owners.json',
    'infrastructure/persistence/migrations/0050_markreg_commercial_checkout.sql'
  ]);
  assert.equal(scope.shared, false);
  assert.equal(scope.markreg, true);
  assert.equal(scope.persistence, true);
  assert.equal(scope.hard_gate, true);
  assert.equal(scope.l3_full, true);
  assert.equal(scope.core, false);
  assert.equal(scope.execution, false);
});

test('execution changes include the MarkReg dependency required by execution integration', () => {
  const scope = classifyChangedFiles([
    'services/execution/src/trademark-service-execution-postgres.ts'
  ]);
  assert.equal(scope.execution, true);
  assert.equal(scope.markreg, true);
  assert.equal(scope.shared, false);
  assert.equal(scope.integration, true);
  assert.equal(scope.postgres, true);
});

test('owner map without an owned migration is conservatively shared', () => {
  const scope = classifyChangedFiles(['infrastructure/persistence/migration-owners.json'], {
    paymentAvailable: true
  });
  assert.equal(scope.shared, true);
  assert.equal(scope.core, true);
  assert.equal(scope.markreg, true);
  assert.equal(scope.payment, true);
  assert.equal(scope.hard_gate, true);
  assert.equal(scope.l3_full, true);
});

test('unknown migrations conservatively expand downstream coverage', () => {
  const scope = classifyChangedFiles(
    ['infrastructure/persistence/migrations/9999_shared_unknown.sql'],
    { paymentAvailable: true }
  );
  assert.equal(scope.shared, true);
  assert.equal(scope.core, true);
  assert.equal(scope.lite, true);
  assert.equal(scope.capability, true);
  assert.equal(scope.markreg, true);
  assert.equal(scope.execution, true);
  assert.equal(scope.mgsn, true);
  assert.equal(scope.payment, true);
  assert.equal(scope.hard_gate, true);
  assert.equal(scope.l3_full, true);
});

test('ordinary MarkReg web changes select browser L2 without database or Product Loop amplification', () => {
  const scope = classifyChangedFiles(['apps/markreg-web/src/App.tsx'], {
    paymentAvailable: false
  });
  assert.equal(scope.web, true);
  assert.equal(scope.browser, true);
  assert.equal(scope.browser_generic, true);
  assert.equal(scope.postgres, false);
  assert.equal(scope.integration, false);
  assert.equal(scope.product_loop, false);
  assert.equal(scope.hard_gate, false);
  assert.equal(scope.l1_fast, true);
  assert.equal(scope.l2_merge, true);
  assert.equal(scope.l3_full, false);
});

test('generic Gateway route stays out of PostgreSQL and Product Loop lanes', () => {
  const scope = classifyChangedFiles(['apps/gateway/src/health-http.ts']);
  assert.equal(scope.gateway, true);
  assert.equal(scope.integration, true);
  assert.equal(scope.postgres, false);
  assert.equal(scope.product_loop, false);
  assert.equal(scope.l2_merge, true);
  assert.equal(scope.l3_full, false);
});

test('Gateway Product Loop route selects only its direct Lite dependency edge', () => {
  const scope = classifyChangedFiles(['apps/gateway/src/product-loop-http.ts']);
  assert.equal(scope.gateway, true);
  assert.equal(scope.lite, true);
  assert.equal(scope.product_loop, true);
  assert.equal(scope.postgres, true);
  assert.equal(scope.markreg, false);
  assert.equal(scope.mgsn, false);
});

test('generic contracts expand to downstream domains without forcing browser E2E', () => {
  const scope = classifyChangedFiles(['packages/contracts/src/workspace.ts'], {
    paymentAvailable: true
  });
  assert.equal(scope.shared, true);
  assert.equal(scope.core, true);
  assert.equal(scope.lite, true);
  assert.equal(scope.capability, true);
  assert.equal(scope.markreg, true);
  assert.equal(scope.execution, true);
  assert.equal(scope.mgsn, true);
  assert.equal(scope.payment, true);
  assert.equal(scope.browser, false);
  assert.equal(scope.hard_gate, true);
  assert.equal(scope.l3_full, true);
});

test('payment contract manifest plus payment contract remains payment-specific', () => {
  const scope = classifyChangedFiles(
    ['packages/contracts/package.json', 'packages/contracts/src/payment.ts'],
    { paymentAvailable: true }
  );
  assert.equal(scope.payment, true);
  assert.equal(scope.shared, false);
  assert.equal(scope.core, false);
  assert.equal(scope.hard_gate, true);
});

test('MGSN persistence change preserves complete MGSN durability selection', () => {
  const scope = classifyChangedFiles(['services/mgsn/src/provider-registry-postgres.ts']);
  assert.equal(scope.mgsn, true);
  assert.equal(scope.mgsn_durability, true);
  assert.equal(scope.postgres, true);
  assert.equal(scope.hard_gate, true);
  assert.equal(scope.l2_merge, true);
  assert.equal(scope.l3_full, true);
  assert.equal(scope.markreg, false);
  assert.equal(scope.lite, false);
});

test('formal opportunity changes select Product Loop without treating all MarkReg as Product Loop', () => {
  const formal = classifyChangedFiles(['services/markreg/src/formal-opportunity.ts']);
  const unrelated = classifyChangedFiles(['services/markreg/src/commercial-checkout.ts']);
  assert.equal(formal.markreg, true);
  assert.equal(formal.product_loop, true);
  assert.equal(unrelated.markreg, true);
  assert.equal(unrelated.product_loop, false);
});

test('Product Loop browser paths do not select unrelated professional review suites', () => {
  const scope = classifyChangedFiles(['apps/lite-web/src/daily-workspace/Today.tsx']);
  assert.equal(scope.browser, true);
  assert.equal(scope.browser_product_loop, true);
  assert.equal(scope.browser_professional_review, false);
  assert.equal(scope.browser_document_package, false);
  assert.equal(scope.browser_order_journey, false);
});

test('workspace topology changes upgrade to full downstream validation', () => {
  const scope = classifyChangedFiles(['turbo.json'], { paymentAvailable: true });
  assert.equal(scope.full_workspace, true);
  assert.equal(scope.shared, true);
  assert.equal(scope.core, true);
  assert.equal(scope.lite, true);
  assert.equal(scope.capability, true);
  assert.equal(scope.markreg, true);
  assert.equal(scope.execution, true);
  assert.equal(scope.mgsn, true);
  assert.equal(scope.payment, true);
  assert.equal(scope.l3_full, true);
});

test('CI governance intentionally exercises cross-domain lanes and L3', () => {
  const scope = classifyChangedFiles(['.github/workflows/ci.yml'], { paymentAvailable: false });
  assert.equal(scope.shared, true);
  assert.equal(scope.core, true);
  assert.equal(scope.lite, true);
  assert.equal(scope.capability, true);
  assert.equal(scope.markreg, true);
  assert.equal(scope.execution, true);
  assert.equal(scope.mgsn, true);
  assert.equal(scope.payment, false);
  assert.equal(scope.hard_gate, true);
  assert.equal(scope.l3_full, true);
});

test('unknown paths fail closed into shared L3 coverage', () => {
  const scope = classifyChangedFiles(['tooling-new/runner.ts'], { paymentAvailable: true });
  assert.equal(scope.shared, true);
  assert.equal(scope.hard_gate, true);
  assert.equal(scope.l3_full, true);
  assert.equal(scope.core, true);
  assert.equal(scope.mgsn, true);
});

test('documentation-only changes do not request product runtime gates', () => {
  const scope = classifyChangedFiles(['docs/ci-notes.md']);
  assert.equal(scope.l1_fast, false);
  assert.equal(scope.l2_merge, false);
  assert.equal(scope.l3_full, false);
  assert.equal(scope.postgres, false);
  assert.equal(scope.browser, false);
});
