import { createServiceRuntime } from '@markorbit/service-kit';
import { createMgsnHttpRoutes, type MgsnHttpOptions } from './http.js';

export * from './provider-registry.js';
export * from './provider-registry-postgres.js';
export * from './service-package-eligibility.js';
export * from './service-package-eligibility-postgres.js';
export * from './allocation-provider-acceptance.js';
export * from './allocation-provider-acceptance-postgres.js';
export * from './provider-return.js';
export * from './provider-return-postgres.js';
export * from './http.js';

export const serviceManifest = Object.freeze({
  name: 'mgsn',
  port: Number(process.env.PORT ?? '4106'),
  version: '0.1.0'
});

export interface MgsnRuntimeOptions extends MgsnHttpOptions {
  port?: number;
}

export function createRuntime(options: MgsnRuntimeOptions = {}) {
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    { routes: createMgsnHttpRoutes(options) }
  );
}
