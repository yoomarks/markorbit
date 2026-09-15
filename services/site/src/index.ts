import { createServiceRuntime } from '@markorbit/service-kit';
import { createSiteHttpRoutesV1 } from './site-http.js';
import type { SiteServiceV1 } from './site-service.js';

export * from './site-service.js';
export * from './site-postgres.js';
export * from './site-runtime.js';
export * from './site-http.js';

export const serviceManifest = Object.freeze({
  name: 'site',
  port: Number(process.env.PORT ?? '4109'),
  version: '0.1.0'
});

export interface SiteRuntimeOptionsV1 {
  port?: number;
  service: SiteServiceV1;
  internalServiceSecret: string;
}

export function createRuntime(options: SiteRuntimeOptionsV1) {
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    { routes: createSiteHttpRoutesV1(options) }
  );
}
