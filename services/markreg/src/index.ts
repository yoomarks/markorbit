import { createServiceRuntime } from '@markorbit/service-kit';

export const serviceManifest = Object.freeze({
  name: 'markreg',
  port: Number(process.env.PORT ?? '4105'),
  version: '0.1.0'
});

export function createRuntime() {
  return createServiceRuntime(serviceManifest);
}
