import { createServiceRuntime } from '@markorbit/service-kit';
import {
  createPaymentAdminHttpRoutes,
  type PaymentAdminHttpOptions
} from './payment-admin-http.js';
import { createPaymentHttpRoutes, type PaymentHttpOptions } from './payment-http.js';
import {
  createPaymentLifecycleHttpRoutes,
  type PaymentLifecycleHttpOptions
} from './payment-lifecycle-http.js';

export * from './payment-service.js';
export * from './payment-postgres.js';
export * from './payment-lifecycle.js';
export * from './payment-http.js';
export * from './payment-lifecycle-http.js';
export * from './payment-admin.js';
export * from './payment-admin-http.js';
export * from './payment-runtime.js';
export * from './stripe-provider.js';

export const serviceManifest = Object.freeze({
  name: 'payment',
  port: Number(process.env.PORT ?? '4108'),
  version: '0.1.0'
});

export interface PaymentRuntimeOptions extends PaymentHttpOptions {
  port?: number;
  lifecycleService?: PaymentLifecycleHttpOptions['service'];
  providerCode?: PaymentLifecycleHttpOptions['providerCode'];
  adminReadService?: PaymentAdminHttpOptions['service'];
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
        }),
        ...createPaymentAdminHttpRoutes({
          ...(options.adminReadService ? { service: options.adminReadService } : {}),
          ...(options.internalServiceSecret
            ? { internalServiceSecret: options.internalServiceSecret }
            : {})
        })
      ]
    }
  );
}
