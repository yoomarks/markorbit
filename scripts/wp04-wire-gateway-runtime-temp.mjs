import fs from 'node:fs';

const indexPath = 'apps/gateway/src/index.ts';
let source = fs.readFileSync(indexPath, 'utf8');

if (!source.includes("export * from './payment-http.js';")) {
  source = source.replace(
    "export * from './order-http.js';\n",
    "export * from './order-http.js';\nexport * from './payment-http.js';\n"
  );
}
if (!source.includes("import { createGatewayPaymentRoutes } from './payment-http.js';")) {
  source = source.replace(
    "import { createGatewayOrderRoutes } from './order-http.js';\n",
    "import { createGatewayOrderRoutes } from './order-http.js';\nimport { createGatewayPaymentRoutes } from './payment-http.js';\n"
  );
}
if (!source.includes('  paymentUrl?: string;')) {
  source = source.replace('  markRegUrl?: string;\n', '  markRegUrl?: string;\n  paymentUrl?: string;\n');
}
if (!source.includes('const paymentUrl = options.paymentUrl')) {
  source = source.replace(
    "  const executionUrl = options.executionUrl ?? process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104';\n",
    "  const executionUrl = options.executionUrl ?? process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104';\n  const paymentUrl = options.paymentUrl ?? process.env.PAYMENT_URL ?? 'http://127.0.0.1:4108';\n"
  );
}

const orderRoutes = `        ...createGatewayOrderRoutes({
          markRegUrl,
          ...(authenticationClient ? { authenticationClient } : {}),
          ...((options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET)
            ? {
                internalServiceSecret: (options.internalServiceSecret ??
                  process.env.MO_INTERNAL_SERVICE_SECRET)!
              }
            : {}),
          csrfSecret,
          allowedOrigins
        }),
`;
const paymentRoutes = `        ...createGatewayPaymentRoutes({
          paymentUrl,
          ...(authenticationClient ? { authenticationClient } : {}),
          ...((options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET)
            ? {
                internalServiceSecret: (options.internalServiceSecret ??
                  process.env.MO_INTERNAL_SERVICE_SECRET)!
              }
            : {}),
          csrfSecret,
          allowedOrigins
        }),
`;
if (!source.includes('...createGatewayPaymentRoutes({')) {
  if (!source.includes(orderRoutes)) throw new Error('Gateway order route insertion point changed.');
  source = source.replace(orderRoutes, orderRoutes + paymentRoutes);
}

for (const expected of [
  "export * from './payment-http.js';",
  "import { createGatewayPaymentRoutes } from './payment-http.js';",
  '  paymentUrl?: string;',
  'const paymentUrl = options.paymentUrl',
  '...createGatewayPaymentRoutes({'
]) {
  if (!source.includes(expected)) throw new Error(`Gateway runtime wiring missing: ${expected}`);
}
fs.writeFileSync(indexPath, source);

fs.writeFileSync(
  'apps/gateway/tests/payment-runtime-wiring.test.ts',
  `import { afterEach, describe, expect, it } from 'vitest';
import { createRuntime } from '../src/index.js';

const runtimes: ReturnType<typeof createRuntime>[] = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
});

describe('Gateway Payment runtime wiring', () => {
  it('mounts /api/payments on the actual Gateway runtime', async () => {
    const runtime = createRuntime({
      port: 0,
      csrfSecret: 'runtime-wire-test-secret',
      allowedOrigins: ['https://markorbit.test']
    });
    runtimes.push(runtime);
    await runtime.start();
    const response = await fetch(\`http://127.0.0.1:\${runtime.listeningPort}/api/payments\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutSessionId: 'checkout_runtime-wire', amountMinor: 1 })
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'MONETARY_OR_ACTOR_SPOOF_REJECTED'
    });
  });
});
`
);
