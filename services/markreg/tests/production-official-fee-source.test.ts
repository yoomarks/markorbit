import { describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  type ProductionFeeFactsV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  PRODUCTION_OFFICIAL_FEE_ACCEPTED_REFERENCE_ID,
  PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID,
  PRODUCTION_OFFICIAL_FEE_CAPABILITY_VERSION,
  PRODUCTION_OFFICIAL_FEE_OPERATION,
  ProductionOfficialFeeSourceServiceV1,
  productionOfficialFeeSourceSha256,
  type ResolveProductionOfficialFeeSourceCommandV1
} from '../src/production-official-fee-source.js';

const workspaceId = '70707070-7070-4707-8707-707070707070';
const at = '2026-09-15T03:30:00.000Z';
const correlationId = 'correlation_wif06_official_fee';

const principal = (
  permissions: WorkspacePrincipal['permissions'] = ['workspace:read', 'order:read']
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_wif06',
  userId: 'user_wif06',
  workspaceId,
  membershipId: 'membership_wif06',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});
const feeFacts = (
  currentness: ProductionFeeFactsV1['currentness'] = 'CURRENT'
): ProductionFeeFactsV1 => ({
  schemaVersion: 1,
  feeFactsId: 'fee-facts_wif06',
  workspaceId,
  version: 1,
  currentness,
  intake: {
    id: 'intake_wif06',
    version: 2,
    fingerprintSha256: 'a'.repeat(64)
  },
  filingBasis: 'SECTION_1',
  niceClasses: [9, 42],
  classCount: 2,
  filingBasisProvenance: {
    sourceClass: 'CUSTOMER_SUPPLIED',
    actorId: 'user_wif06',
    membershipId: 'membership_wif06',
    establishedAt: at
  },
  classSelectionProvenance: {
    sourceClass: 'PROFESSIONALLY_ESTABLISHED',
    actorId: 'user_reviewer',
    membershipId: 'membership_reviewer',
    establishedAt: at
  },
  recordedAt: at,
  fingerprintSha256: 'b'.repeat(64),
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});
const command = (): ResolveProductionOfficialFeeSourceCommandV1 => ({
  schemaVersion: 1,
  intakeId: feeFacts().intake.id,
  expectedIntakeVersion: feeFacts().intake.version,
  idempotencyKey: 'wif06-official-fee-source-1',
  correlationId
});

const capabilityInput = () => ({
  jurisdiction: 'US',
  authority: 'USPTO',
  objectType: 'TRADEMARK_APPLICATION',
  operation: PRODUCTION_OFFICIAL_FEE_OPERATION,
  procedure: 'ELECTRONIC_FILING',
  stage: 'NEW_APPLICATION',
  filingBasis: 'SECTION_1',
  segment: 'BASE_FEE',
  classCount: 2,
  asOf: at,
  acceptedReferenceId: PRODUCTION_OFFICIAL_FEE_ACCEPTED_REFERENCE_ID
});

const reference = {
  schemaVersion: 1 as const,
  idempotencyKey: 'capability-source-key',
  requestFingerprintSha256: 'c'.repeat(64),
  capabilityRequestId: 'capreq_wif06',
  sessionReceiptId: 'session-receipt_wif06'
};
function producer(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    status: 'PRODUCTION_ADMISSIBLE',
    authority: { quoteCreated: false },
    source: {
      producer: 'CAPABILITY_ENGINE',
      admission: 'PRODUCTION_ADMISSIBLE',
      authority: { quoteCreated: false },
      current: {
        capability: {
          capabilityId: PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID,
          capabilityVersion: PRODUCTION_OFFICIAL_FEE_CAPABILITY_VERSION,
          runtimeCapabilityDefinitionId: 'runtime-capability_uspto-official-fee-resolver-v1',
          version: 1
        },
        implementation: {
          implementationProfileId: 'implementation-profile_uspto-official-fee-resolver-v1',
          version: 1,
          implementationKey: 'brain-method-package-runtime.uspto-official-fee-resolver.v1',
          status: 'APPROVED'
        }
      },
      admissionPolicy: {
        policyId: 'source-admission-policy.uspto-official-fee-resolver.v2',
        policyVersion: 2
      },
      sourceUse: {
        currentness: 'CURRENT',
        policy: {
          policyId: 'source-use-policy.uspto-official-fee-resolver.markreg.v1',
          policyVersion: 1
        }
      }
    },
    officialFeeMaterial: {
      materialFamilyId: 'uspto-official-fee-base-application-per-class',
      materialFamilyVersion: 1,
      analyzedInputFingerprintSha256: productionOfficialFeeSourceSha256(capabilityInput()),
      filingBasis: 'SECTION_1',
      classCount: 2,
      fee: { amountMinor: 35000, currency: 'USD', unit: 'PER_CLASS' },
      reference: {
        referenceId: PRODUCTION_OFFICIAL_FEE_ACCEPTED_REFERENCE_ID,
        version: 4,
        effectiveFrom: '2025-01-18T00:00:00.000Z'
      },
      lineage: {
        capabilityId: PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID,
        capabilityVersion: PRODUCTION_OFFICIAL_FEE_CAPABILITY_VERSION,
        runtimeCapabilityDefinitionId: 'runtime-capability_uspto-official-fee-resolver-v1',
        implementationProfileId: 'implementation-profile_uspto-official-fee-resolver-v1',
        implementationKey: 'brain-method-package-runtime.uspto-official-fee-resolver.v1',
        outputFingerprintSha256: 'd'.repeat(64),
        productionEvidenceId: 'source-evidence_wif06'
      },
      currentness: {
        status: 'CURRENT',
        checkedAt: at,
        analyzedAsOf: at
      },
      assumptions: ['The exact current fee facts remain applicable.'],
      limitations: ['Base application fee only.'],
      authorityConsequences: { quoteCreated: false }
    },
    ...overrides
  };
}

function service(raw = producer(), facts = feeFacts()) {
  return new ProductionOfficialFeeSourceServiceV1(
    {
      feeFacts: { getCurrent: () => Promise.resolve(structuredClone(facts)) },
      invoker: {
        invoke: () => Promise.resolve(structuredClone(reference))
      },
      reader: {
        read: () => Promise.resolve(structuredClone(raw))
      }
    },
    () => at
  );
}
describe('Production Official Fee Source', () => {
  it('resolves current production-admissible official-fee material from exact fee facts', async () => {
    const result = await service().resolve(principal(), command());

    expect(result).toMatchObject({
      workspaceId,
      feeFacts: {
        id: feeFacts().feeFactsId,
        version: 1,
        fingerprintSha256: 'b'.repeat(64)
      },
      source: {
        sourceKind: 'PRICING_SOURCE',
        sourceId: PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID,
        admissionClass: 'PRODUCTION_ADMISSIBLE',
        currentness: 'CURRENT'
      },
      material: {
        filingBasis: 'SECTION_1',
        classCount: 2,
        feePerClass: { amountMinor: 35000, currency: 'USD' },
        totalOfficialFee: { amountMinor: 70000, currency: 'USD' }
      },
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
    expect(result.source.provenanceRefs.join('\n')).toMatch(/production-fee-facts/);
  });
  it('fails closed when Capability implementation or currentness drifts', async () => {
    const implementationDrift = producer();
    implementationDrift.source.current.implementation.implementationKey = 'unapproved.runtime';
    await expect(
      service(implementationDrift).resolve(principal(), command())
    ).rejects.toMatchObject({
      code: 'INVALID_CAPABILITY_OFFICIAL_FEE_SOURCE',
      status: 502
    });

    const stale = producer();
    stale.source.sourceUse.currentness = 'STALE';
    await expect(service(stale).resolve(principal(), command())).rejects.toMatchObject({
      code: 'OFFICIAL_FEE_SOURCE_STALE',
      status: 409
    });
  });

  it('requires current fee facts and commercial read permission', async () => {
    await expect(
      service(producer(), feeFacts('SUPERSEDED')).resolve(principal(), command())
    ).rejects.toMatchObject({
      code: 'PRODUCTION_FEE_FACTS_STALE',
      status: 409
    });
    await expect(service().resolve(principal(['workspace:read']), command())).rejects.toMatchObject(
      {
        code: 'PERMISSION_DENIED',
        status: 403
      }
    );
  });
});
