import { createServiceRuntime } from '@markorbit/service-kit';

export const serviceManifest = Object.freeze({
  name: 'core',
  port: Number(process.env.PORT ?? '4101'),
  version: '0.1.0'
});

export function createRuntime() {
  return createServiceRuntime(serviceManifest);
}
export * from './identity.js';
