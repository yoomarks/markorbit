import { timingSafeEqual } from 'node:crypto';
import type { RuntimeCapabilityDefinitionId } from '@markorbit/contracts/capability-learning';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  RuntimeCapabilityRegistryError,
  type PostgresRuntimeCapabilityRegistry
} from './runtime-capability-registry.js';

export interface RuntimeCapabilityRouteOptions {
  internalServiceSecret: string;
  registry: PostgresRuntimeCapabilityRegistry;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorize(request: JsonRequest, secret: string): void {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
}

function idempotencyKey(request: JsonRequest): string {
  const key = request.headers['idempotency-key'];
  if (!key || !key.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return key.trim();
}

function mapError(error: unknown): never {
  if (error instanceof RuntimeCapabilityRegistryError)
    throw new HttpError(
      error.status,
      error.code,
      error.message,
      error.status >= 500,
      error.details
    );
  throw error;
}

export function createRuntimeCapabilityRoutes(options: RuntimeCapabilityRouteOptions): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/runtime-capabilities/imports',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        try {
          const result = await options.registry.importAccepted({
            definition: request.body,
            idempotencyKey: idempotencyKey(request)
          });
          return json(result.replayed ? 200 : 201, result);
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/runtime-capabilities/by-capability/:capabilityId/current',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        try {
          const definition = await options.registry.findCurrent(request.params.capabilityId!);
          if (!definition)
            throw new HttpError(
              404,
              'RUNTIME_CAPABILITY_NOT_FOUND',
              'Runtime Capability definition was not found.'
            );
          return json(200, { definition });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/runtime-capabilities/:runtimeCapabilityDefinitionId/versions/:version',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        const version = Number(request.params.version);
        if (!Number.isInteger(version) || version < 1)
          throw new HttpError(
            400,
            'INVALID_RUNTIME_CAPABILITY_VERSION',
            'Runtime Capability version must be a positive integer.'
          );
        try {
          const definition = await options.registry.findVersion(
            request.params.runtimeCapabilityDefinitionId! as RuntimeCapabilityDefinitionId,
            version
          );
          if (!definition)
            throw new HttpError(
              404,
              'RUNTIME_CAPABILITY_NOT_FOUND',
              'Runtime Capability definition was not found.'
            );
          return json(200, { definition });
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
