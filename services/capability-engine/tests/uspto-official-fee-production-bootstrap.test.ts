import { describe, expect, it, vi } from 'vitest';

import { compileUsptoOfficialFeeMethodPackageV1 } from '@markorbit/contracts/brain-official-fee-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import { createGovernedProductionRuntimeV1 } from '../src/governed-runtime-bootstrap.js';
import type { DurableImplementationProfileRegistryV1 } from '../src/implementation-profile-registry-postgres.js';
import { USPTO_OFFICIAL_FEE_GOVERNED_COMPILATION_INPUT_V1 } from '../src/uspto-official-fee-production-promotion.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
  USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA
} from '../src/uspto-official-fee-resolver-pilot.js';

const secret = 'uspto-production-bootstrap-secret-32-bytes';
const effectiveFrom = '2025-01-18T00:00:00.000-05:00';
const asOf = '2026-09-03T03:45:00.000Z';

function acceptedPackage() {
  const compiled = compileUsptoOfficialFeeMethodPackageV1(
    USPTO_OFFICIAL_FEE_GOVERNED_COMPILATION_INPUT_V1
  );
  if (compiled.status !== 'READY') throw new Error(`unexpected package status ${compiled.status}`);
  return compiled.package;
}

function acceptedReference() {
  const pkg = acceptedPackage();
  return {
    schemaVersion: 1,
    referenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
    operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
    jurisdiction: 'US',
    authority: 'USPTO',
    currency: 'USD',
    amountMinor: 35000,
    unit: 'PER_CLASS',
    effectiveFrom,
    status: 'CURRENT',
    packageId: pkg.packageId,
    methodId: pkg.methodId,
    methodVersionId: pkg.methodVersionId,
    knowledgeSources: structuredClone(pkg.lineage.knowledgeSources),
    sourceIdentityFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
    materializationFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
    materializedAt: '2026-08-28T00:00:00.000Z'
  } as const;
}

function registry(): DurableImplementationProfileRegistryV1 {
  return {
    register: vi.fn((value: unknown) =>
      Promise.resolve(value as typeof USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE)
    ),
    findCurrent: vi.fn(() => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE)),
    findVersion: vi.fn(() => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE)),
    listCurrent: vi.fn(() => Promise.resolve([USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE]))
  };
}

function command(): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_uspto_online_production',
      principalId: 'principal_uspto_online_production',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_uspto_online_production'
    },
    purpose: 'Resolve the governed current USPTO application fee from the Core owner boundary.',
    input: {
      jurisdiction: 'US',
      authority: 'USPTO',
      objectType: 'TRADEMARK_APPLICATION',
      operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
      procedure: 'ELECTRONIC_FILING',
      stage: 'NEW_APPLICATION',
      filingBasis: 'SECTION_1',
      segment: 'BASE_FEE',
      classCount: 2,
      asOf,
      acceptedReferenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID
    },
    inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
    outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'uspto-online-production-bootstrap-1',
    correlationId: 'correlation_uspto-online-production-bootstrap-1'
  };
}

describe('USPTO governed online production bootstrap', () => {
  it('executes the exact deterministic profile through the injected async Core reference reader', async () => {
    const resolveCurrent = vi.fn(() => Promise.resolve(acceptedReference()));
    const runtime = createGovernedProductionRuntimeV1({
      definitions: {
        findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
      },
      implementationProfiles: registry(),
      managedAiRuntime: null,
      officialFeeReferences: { resolveCurrent },
      internalServiceSecret: secret
    });
    if (!runtime) throw new Error('Expected USPTO governed production runtime.');

    const result = await runtime.invoke(command());

    expect(result.outcome).toMatchObject({
      status: 'SUCCEEDED',
      output: {
        reference: {
          referenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
          amountMinor: 35000,
          currency: 'USD'
        },
        referenceStoreReadControlled: true,
        knowledgeResearchInvoked: false,
        productBusinessStateMutated: false
      }
    });
    expect(result.binding.implementation).toMatchObject({
      implementationProfileId:
        USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId,
      kind: 'DETERMINISTIC_SERVICE',
      implementationKey: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationKey
    });
    expect(resolveCurrent).toHaveBeenCalledOnce();
    expect(resolveCurrent).toHaveBeenCalledWith({
      operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
      jurisdiction: 'US',
      authority: 'USPTO',
      asOf
    });
  });

  it('fails the governed execution instead of fabricating a fee when the Core owner read fails', async () => {
    const runtime = createGovernedProductionRuntimeV1({
      definitions: {
        findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
      },
      implementationProfiles: registry(),
      managedAiRuntime: null,
      officialFeeReferences: {
        resolveCurrent: () => Promise.reject(new Error('Core reference unavailable'))
      },
      internalServiceSecret: secret
    });
    if (!runtime) throw new Error('Expected USPTO governed production runtime.');

    await expect(runtime.invoke(command())).resolves.toMatchObject({
      outcome: { status: 'FAILED', error: { code: 'IMPLEMENTATION_FAILED' } }
    });
  });
});
