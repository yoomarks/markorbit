import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

{
  const path = 'services/payment/src/payment-service.ts';
  let source = read(path);
  source = source.replace(
    `export interface PaymentCheckoutSource {\n  findCheckout(\n    workspaceId: string,\n    checkoutSessionId: CheckoutSessionId\n  ): Promise<CheckoutSession | null>;\n}`,
    `export interface PaymentCheckoutSource {\n  findCheckout(\n    principal: WorkspacePrincipal,\n    workspaceId: string,\n    checkoutSessionId: CheckoutSessionId\n  ): Promise<CheckoutSession | null>;\n}`
  );
  source = source.replace(
    `    const checkout = await this.checkouts.findCheckout(\n      command.workspaceId,\n      command.checkoutSessionId\n    );`,
    `    const checkout = await this.checkouts.findCheckout(\n      principal,\n      command.workspaceId,\n      command.checkoutSessionId\n    );`
  );
  if (!source.includes('principal: WorkspacePrincipal,\n    workspaceId: string')) throw new Error('PaymentCheckoutSource principal patch failed.');
  write(path, source);
}

{
  const path = 'services/payment/tests/payment-service.test.ts';
  let source = read(path);
  source = source.replace(
    'findCheckout: (workspaceId, checkoutSessionId) =>',
    'findCheckout: (_principal, workspaceId, checkoutSessionId) =>'
  );
  source = source.replace(
    'findCheckout: (_workspaceId: string, checkoutSessionId: string) =>',
    'findCheckout: (_principal: WorkspacePrincipal, _workspaceId: string, checkoutSessionId: string) =>'
  );
  write(path, source);
}

write(
  'services/payment/src/payment-runtime.ts',
  `import type { WorkspacePrincipal } from '@markorbit/contracts';
import { encodeInternalWorkspacePrincipal } from '@markorbit/contracts';
import type { CheckoutSession, CheckoutSessionId } from '@markorbit/contracts/commercial';
import type { PaymentProviderAction, PaymentProviderCode, VerifiedProviderPaymentEvent } from '@markorbit/contracts/payment';
import type {
  PaymentLifecycleProviderAdapter,
  PaymentProviderRefundCommand,
  PaymentProviderRefundResult,
  PaymentProviderSnapshot,
  PaymentWebhookInput
} from './payment-lifecycle.js';
import { PaymentLifecycleError } from './payment-lifecycle.js';
import type {
  PaymentCheckoutSource,
  PaymentProviderAdapter,
  PaymentProviderCreateCommand,
  PaymentProviderCreateResult
} from './payment-service.js';
import { PaymentServiceError } from './payment-service.js';

export class HttpPaymentCheckoutSource implements PaymentCheckoutSource {
  constructor(
    private readonly markRegUrl: string,
    private readonly internalServiceSecret: string
  ) {}

  async findCheckout(
    principal: WorkspacePrincipal,
    workspaceId: string,
    checkoutSessionId: CheckoutSessionId
  ): Promise<CheckoutSession | null> {
    if (principal.workspaceId !== workspaceId)
      throw new PaymentServiceError('WORKSPACE_MISMATCH', 'Workspace context does not match.');
    let response: Response;
    try {
      response = await fetch(
        \`${'${this.markRegUrl}'}/v1/checkouts/${'${encodeURIComponent(checkoutSessionId)}'}\`,
        {
          headers: {
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': workspaceId
          }
        }
      );
    } catch (cause) {
      throw new PaymentServiceError(
        'CHECKOUT_SOURCE_UNAVAILABLE',
        'Checkout authority is unavailable.',
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (response.status === 404) return null;
    if (!response.ok)
      throw new PaymentServiceError(
        'CHECKOUT_SOURCE_UNAVAILABLE',
        'Checkout authority is unavailable.'
      );
    return (await response.json()) as CheckoutSession;
  }
}

export class UnconfiguredPaymentProviderAdapter
  implements PaymentProviderAdapter, PaymentLifecycleProviderAdapter
{
  readonly code: PaymentProviderCode;

  constructor(code: PaymentProviderCode = 'UNCONFIGURED') {
    this.code = code;
  }

  createPayment(_command: Readonly<PaymentProviderCreateCommand>): Promise<PaymentProviderCreateResult> {
    return Promise.reject(
      new PaymentServiceError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }

  resumePayment(_providerPaymentReference: string): Promise<PaymentProviderAction> {
    return Promise.reject(
      new PaymentServiceError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }

  verifyWebhook(_input: Readonly<PaymentWebhookInput>): Promise<VerifiedProviderPaymentEvent> {
    return Promise.reject(
      new PaymentLifecycleError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }

  createRefund(_command: Readonly<PaymentProviderRefundCommand>): Promise<PaymentProviderRefundResult> {
    return Promise.reject(
      new PaymentLifecycleError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }

  retrievePayment(_providerPaymentReference: string): Promise<PaymentProviderSnapshot> {
    return Promise.reject(
      new PaymentLifecycleError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }
}
`
);

{
  const path = 'services/payment/src/payment-service.ts';
  let source = read(path);
  source = source.replace(
    `  | 'CHECKOUT_NOT_FOUND'\n`,
    `  | 'CHECKOUT_NOT_FOUND'\n  | 'CHECKOUT_SOURCE_UNAVAILABLE'\n`
  );
  write(path, source);
}

{
  const path = 'services/payment/src/payment-http.ts';
  let source = read(path);
  source = source.replace(
    `error.code === 'PERSISTENCE_UNAVAILABLE' || error.code === 'PROVIDER_UNAVAILABLE'`,
    `error.code === 'PERSISTENCE_UNAVAILABLE' ||\n              error.code === 'CHECKOUT_SOURCE_UNAVAILABLE' ||\n              error.code === 'PROVIDER_UNAVAILABLE'`
  );
  write(path, source);
}

{
  const path = 'services/payment/src/index.ts';
  let source = read(path);
  if (!source.includes("import { createServiceRuntime } from '@markorbit/service-kit';")) {
    source = `import { createServiceRuntime } from '@markorbit/service-kit';\nimport { createPaymentHttpRoutes, type PaymentHttpOptions } from './payment-http.js';\nimport {\n  createPaymentLifecycleHttpRoutes,\n  type PaymentLifecycleHttpOptions\n} from './payment-lifecycle-http.js';\n\n` + source;
  }
  if (!source.includes("export * from './payment-runtime.js';")) source += "export * from './payment-runtime.js';\n";
  source += `
export const serviceManifest = Object.freeze({
  name: 'payment',
  port: Number(process.env.PORT ?? '4108'),
  version: '0.1.0'
});

export interface PaymentRuntimeOptions extends PaymentHttpOptions {
  port?: number;
  lifecycleService?: PaymentLifecycleHttpOptions['service'];
  providerCode?: PaymentLifecycleHttpOptions['providerCode'];
}

export function createRuntime(options: PaymentRuntimeOptions = {}) {
  const providerCode = options.providerCode ?? 'UNCONFIGURED';
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        ...createPaymentHttpRoutes(options),
        ...createPaymentLifecycleHttpRoutes({
          providerCode,
          ...(options.lifecycleService ? { service: options.lifecycleService } : {}),
          ...(options.internalServiceSecret
            ? { internalServiceSecret: options.internalServiceSecret }
            : {})
        })
      ]
    }
  );
}
`;
  write(path, source);
}

write(
  'services/payment/src/main.ts',
  `import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';
import { createRuntime } from './index.js';
import { PaymentLifecycleService } from './payment-lifecycle.js';
import { PostgresPaymentRepository } from './payment-postgres.js';
import { HttpPaymentCheckoutSource, UnconfiguredPaymentProviderAdapter } from './payment-runtime.js';
import { PaymentService } from './payment-service.js';

const databaseUrl = process.env.PAYMENT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('PAYMENT_DATABASE_URL is required for the durable Payment runtime.');
const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!internalServiceSecret)
  throw new Error('MO_INTERNAL_SERVICE_SECRET is required for the durable Payment runtime.');
const markRegUrl = process.env.MARKREG_URL ?? 'http://127.0.0.1:4105';
const providerCode = process.env.PAYMENT_PROVIDER_CODE ?? 'UNCONFIGURED';

const database = new ManagedDatabase(
  parseDatabaseConfig({
    ...process.env,
    DATABASE_URL: databaseUrl,
    DB_MIGRATION_NAMESPACE: process.env.PAYMENT_MIGRATION_NAMESPACE ?? 'payment'
  })
);
await database.start();
const pool = database.getPool();
const repository = new PostgresPaymentRepository(database, pool);
const provider = new UnconfiguredPaymentProviderAdapter(providerCode);
const service = new PaymentService(
  repository,
  new HttpPaymentCheckoutSource(markRegUrl, internalServiceSecret),
  provider
);
const lifecycleService = new PaymentLifecycleService(repository, provider);
const runtime = createRuntime({
  service,
  lifecycleService,
  providerCode,
  internalServiceSecret
});

async function shutdown(signal: string) {
  process.stdout.write(\`${'${runtime.manifest.name}'}: received ${'${signal}'}, stopping.\\n\`);
  await runtime.stop();
  await database.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await runtime.start();
} catch (error) {
  await database.close();
  throw error;
}
process.stdout.write(
  \`${'${runtime.manifest.name}'}: listening on http://127.0.0.1:${'${runtime.listeningPort}'}.\\n\`
);
`
);

{
  const path = 'services/payment/package.json';
  const value = JSON.parse(read(path));
  value.scripts.dev = 'tsx watch src/main.ts';
  value.scripts.build = 'tsup src/index.ts src/main.ts --format esm --dts --clean';
  write(path, JSON.stringify(value, null, 2) + '\n');
}

{
  const path = '.env.example';
  let source = read(path);
  if (!source.includes('PAYMENT_URL=')) {
    source += `\n# Payment service: durable provider-neutral runtime. Real provider credentials/config are intentionally external.\nPAYMENT_URL=http://127.0.0.1:4108\nPAYMENT_DATABASE_URL=postgresql://markorbit:markorbit@127.0.0.1:5432/markorbit_payment\nPAYMENT_MIGRATION_NAMESPACE=payment\nPAYMENT_PROVIDER_CODE=UNCONFIGURED\nMARKREG_URL=http://127.0.0.1:4105\n`;
  }
  write(path, source);
}

write(
  'services/payment/tests/payment-runtime.test.ts',
  `import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { createRuntime } from '../src/index.js';
import { HttpPaymentCheckoutSource, UnconfiguredPaymentProviderAdapter } from '../src/payment-runtime.js';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_payment-runtime',
  userId: 'user_payment-runtime',
  workspaceId: 'workspace_payment-runtime',
  membershipId: 'membership_payment-runtime',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-17T08:00:00.000Z'
};

const runtimes: ReturnType<typeof createRuntime>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
});

describe('Payment runtime', () => {
  it('starts a real HTTP runtime on the Payment service port boundary', async () => {
    const runtime = createRuntime({ port: 0, providerCode: 'UNCONFIGURED' });
    runtimes.push(runtime);
    await runtime.start();
    const health = await fetch(\`http://127.0.0.1:\${runtime.listeningPort}/health\`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({ service: 'payment' });
  });

  it('fetches Checkout truth from MarkReg using the real internal Principal', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ checkoutSessionId: 'checkout_runtime', workspaceId: principal.workspaceId }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    const source = new HttpPaymentCheckoutSource('http://markreg.test', 'internal-secret');
    await source.findCheckout(principal, principal.workspaceId, 'checkout_runtime');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://markreg.test/v1/checkouts/checkout_runtime',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-markorbit-internal-authorization': 'internal-secret',
          'x-markorbit-workspace-id': principal.workspaceId
        })
      })
    );
  });

  it('fails closed when no real provider adapter is configured', async () => {
    const provider = new UnconfiguredPaymentProviderAdapter();
    await expect(
      provider.createPayment({
        paymentId: 'payment_runtime',
        checkoutSessionId: 'checkout_runtime',
        orderId: 'order_runtime',
        amountMinor: 29900,
        currency: 'USD',
        providerIdempotencyKey: 'payment_runtime',
        metadata: {}
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
});
`
);
