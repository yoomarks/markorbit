import { createServiceRuntime } from '@markorbit/service-kit';
import {
  createMgsnCommercialAdminHttpRoutes,
  type MgsnCommercialAdminHttpOptions
} from './commercial-admin-http.js';
import { createMgsnHttpRoutes, type MgsnHttpOptions } from './http.js';

export * from './provider-registry.js';
export * from './provider-registry-postgres.js';
export * from './service-package-eligibility.js';
export * from './service-package-eligibility-postgres.js';
export * from './allocation-provider-acceptance.js';
export * from './allocation-provider-acceptance-postgres.js';
export * from './provider-return.js';
export * from './provider-return-postgres.js';
export * from './provider-work-read-model.js';
export * from './provider-work-read-model-postgres.js';
export * from './network-participation.js';
export * from './network-participation-postgres.js';
export * from './provider-responsibility.js';
export * from './provider-responsibility-postgres.js';
export * from './provider-discovery.js';
export * from './provider-discovery-postgres.js';
export * from './provider-selection.js';
export * from './provider-selection-postgres.js';
export * from './controlled-privacy-handoff.js';
export * from './runtime-dependencies.js';
export * from './durable-runtime.js';
export * from './commercial-admin-read.js';
export * from './commercial-admin-http.js';
export * from './http.js';

export const serviceManifest = Object.freeze({
  name: 'mgsn',
  port: Number(process.env.PORT ?? '4106'),
  version: '0.1.0'
});

export interface MgsnRuntimeOptions extends MgsnHttpOptions {
  port?: number;
  commercialAdminReadService?: MgsnCommercialAdminHttpOptions['service'];
}

export function createRuntime(options: MgsnRuntimeOptions = {}) {
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        ...createMgsnHttpRoutes(options),
        ...createMgsnCommercialAdminHttpRoutes({
          ...(options.commercialAdminReadService
            ? { service: options.commercialAdminReadService }
            : {}),
          ...(options.internalServiceSecret
            ? { internalServiceSecret: options.internalServiceSecret }
            : {})
        })
      ]
    }
  );
}
