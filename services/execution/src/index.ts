import { createServiceRuntime } from '@markorbit/service-kit';

export const serviceManifest = Object.freeze({
  name: 'execution',
  port: Number(process.env.PORT ?? '4104'),
  version: '0.1.0'
});

export function createRuntime() {
  return createServiceRuntime(serviceManifest);
}
