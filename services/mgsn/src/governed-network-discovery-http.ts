import type {
  ProviderDiscoveryRequestId,
  ProviderDiscoveryRequestReferenceV1
} from '@markorbit/contracts/provider-discovery';
import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';
import type { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';
import { ProviderDiscoveryError } from './provider-discovery.js';
import {
  assertExactTransportShape,
  bodyOf,
  enumArray,
  markOrbitId,
  objectOf,
  prefixedId,
  rejectTopLevelAuthority,
  requiredEnum,
  requiredLiteral,
  requiredString,
  sha256,
  timestamp,
  trustedWorkspacePrincipalFor,
  versionValue,
  type Body,
  type TransportShape
} from './governed-network-http-boundary.js';

export interface MgsnProviderDiscoveryHttpOptions {
  internalServiceSecret?: string;
  service?: Pick<ProviderDiscoveryCurrentResponsibilityService, 'evaluate'>;
}

const discoveryRequestTransportShape = {
  schemaVersion: null,
  providerDiscoveryRequestId: null,
  need: {
    reference: null,
    version: null,
    fingerprintSha256: null,
    jurisdiction: null,
    serviceType: null
  },
  purpose: null,
  audience: {
    kind: null,
    relationshipAuthorityReference: null
  },
  contextReference: null,
  requestedDataClasses: null,
  requestedFields: null,
  requestedAt: null,
  requestFingerprintSha256: null,
  correlationId: null
} satisfies TransportShape;

function parseDiscoveryAudience(
  value: unknown,
  field: string
): ProviderDiscoveryRequestReferenceV1['audience'] {
  const audience = objectOf(value, field);
  const kind = requiredEnum(
    audience.kind,
    ['TRUSTED_RELATIONSHIP', 'BOUNDED_NETWORK'] as const,
    `${field}.kind`
  );
  if (kind === 'BOUNDED_NETWORK') {
    if (audience.relationshipAuthorityReference !== undefined)
      throw new HttpError(
        400,
        'UNEXPECTED_GOVERNED_NETWORK_FIELD',
        `${field}.relationshipAuthorityReference is not permitted for BOUNDED_NETWORK.`
      );
    return { kind };
  }
  return {
    kind,
    relationshipAuthorityReference: requiredString(
      audience.relationshipAuthorityReference,
      `${field}.relationshipAuthorityReference`,
      200
    )
  };
}

function parseDiscoveryRequest(
  body: Body,
  requesterWorkspaceId: string
): ProviderDiscoveryRequestReferenceV1 {
  const need = objectOf(body.need, 'body.need');
  return {
    schemaVersion: requiredLiteral(body.schemaVersion, 1, 'body.schemaVersion'),
    providerDiscoveryRequestId: prefixedId<ProviderDiscoveryRequestId>(
      body.providerDiscoveryRequestId,
      'provider-discovery-request_',
      'body.providerDiscoveryRequestId'
    ),
    requesterWorkspaceId,
    need: {
      reference: requiredString(need.reference, 'body.need.reference'),
      version: versionValue(need.version, 'body.need.version'),
      fingerprintSha256: sha256(need.fingerprintSha256, 'body.need.fingerprintSha256'),
      jurisdiction: requiredString(need.jurisdiction, 'body.need.jurisdiction', 100),
      serviceType: requiredString(need.serviceType, 'body.need.serviceType', 200)
    },
    purpose: requiredLiteral(body.purpose, 'PROVIDER_DISCOVERY', 'body.purpose'),
    audience: parseDiscoveryAudience(body.audience, 'body.audience'),
    contextReference: requiredString(body.contextReference, 'body.contextReference'),
    requestedDataClasses: enumArray(
      body.requestedDataClasses,
      [
        'ORGANIZATION_IDENTITY',
        'PROVIDER_REFERENCE',
        'SUPPLY_PROFILE',
        'SERVICE_JURISDICTIONS',
        'PROVIDER_EVIDENCE_REFERENCE'
      ] as const,
      'body.requestedDataClasses'
    ),
    requestedFields: enumArray(
      body.requestedFields,
      ['displayName', 'providerId', 'serviceTypes', 'jurisdictions', 'evidenceReferences'] as const,
      'body.requestedFields'
    ),
    requestedAt: timestamp(body.requestedAt, 'body.requestedAt'),
    requestFingerprintSha256: sha256(
      body.requestFingerprintSha256,
      'body.requestFingerprintSha256'
    ),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
  };
}

function mapDiscoveryError(error: unknown): never {
  if (error instanceof ProviderDiscoveryError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

export function createMgsnProviderDiscoveryHttpRoutes(
  options: MgsnProviderDiscoveryHttpOptions = {}
): JsonRoute[] {
  const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
  const service = () => {
    if (!options.service)
      throw new HttpError(
        503,
        'MGSN_GOVERNED_NETWORK_RUNTIME_UNCONFIGURED',
        'MGSN governed-network runtime is not configured.',
        true
      );
    return options.service;
  };

  return [
    {
      method: 'POST',
      path: '/v1/governed-network/discovery/evaluate',
      handle: async (request) => {
        const principal = trustedWorkspacePrincipalFor(request, secret);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, discoveryRequestTransportShape, 'body');
        const discoveryRequest = parseDiscoveryRequest(body, principal.workspaceId);
        try {
          const result = await service().evaluate(
            { workspaceId: principal.workspaceId, actorId: principal.userId },
            discoveryRequest
          );
          return json(200, { providerDiscovery: result });
        } catch (error) {
          return mapDiscoveryError(error);
        }
      }
    }
  ];
}
