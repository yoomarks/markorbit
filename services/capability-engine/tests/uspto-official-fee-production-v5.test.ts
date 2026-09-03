import { describe, expect, it } from 'vitest';

import { compileUsptoOfficialFeeMethodPackageV1 } from '@markorbit/contracts/brain-official-fee-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';
import {
  CurrentCapabilitySourceAdmissionEvidenceMaterializerV5,
  CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1,
  validCapabilitySourceAdmissionEvidenceV5
} from '../src/current-source-admission-evidence-v5.js';
import { CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1 } from '../src/source-admission-policy-content-provenance.js';
import { UsptoOfficialFeeMethodCurrentnessAuthorityV1 } from '../src/uspto-official-fee-method-currentness.js';
import {
  USPTO_OFFICIAL_FEE_GOVERNED_COMPILATION_INPUT_V1,
  currentApprovedUsptoOfficialFeeMethodActivationAuthorityV1,
  materializeApprovedUsptoOfficialFeeGovernedActivationV1
} from '../src/uspto-official-fee-production-promotion.js';
import { promotedCapabilitySourceAdmissionPolicyCatalogV2 } from '../src/uspto-official-fee-production-policy.js';
import { UsptoOfficialFeeReferenceCurrentnessAuthorityV1 } from '../src/uspto-official-fee-reference-currentness.js';
import { UsptoOfficialFeeSourceUseContextAuthorityV1 } from '../src/uspto-official-fee-source-use.js';
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
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
  createUsptoOfficialFeeResolverCapabilityExecutorV1,
  validateUsptoOfficialFeeResolverInputV1,
  validateUsptoOfficialFeeResolverOutputV1
} from '../src/uspto-official-fee-resolver-pilot.js';

const EFFECTIVE_FROM = '2025-01-18T00:00:00.000-05:00';
const MATERIALIZED_AT = '2026-08-28T00:00:00.000Z';
const EVALUATED_AT = '2026-09-03T01:23:00.000Z';

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
    effectiveFrom: EFFECTIVE_FROM,
    status: 'CURRENT',
    packageId: pkg.packageId,
    methodId: pkg.methodId,
    methodVersionId: pkg.methodVersionId,
    knowledgeSources: structuredClone(pkg.lineage.knowledgeSources),
    sourceIdentityFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
    materializationFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
    materializedAt: MATERIALIZED_AT
  };
}

function command(): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_uspto_real_production_v5',
      principalId: 'principal_uspto_real_production_v5',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_uspto_real_production_v5'
    },
    purpose:
      'Materialize the first governed production-admissible USPTO fee Resolver source proof.',
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
      asOf: '2026-08-28T00:00:00.000Z',
      acceptedReferenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID
    },
    inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
    outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'uspto-real-production-v5',
    correlationId: 'correlation_uspto_real_production_v5'
  };
}

async function governedExecution() {
  const pkg = acceptedPackage();
  const runtime = new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
    },
    implementations: {
      select: () =>
        Promise.resolve({
          profile: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
          policyVersion: 'phase4-uspto-official-fee-method-selection.v1'
        })
    },
    inputContracts: {
      validate: (schemaId, value) =>
        schemaId === USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA &&
        validateUsptoOfficialFeeResolverInputV1(value)
    },
    outputContracts: {
      validate: (schemaId, value) =>
        schemaId === USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA &&
        validateUsptoOfficialFeeResolverOutputV1(value)
    },
    executor: createUsptoOfficialFeeResolverCapabilityExecutorV1(pkg, {
      resolveCurrent: () => acceptedReference()
    }),
    now: () => '2026-08-29T04:20:00.000Z'
  });
  const raw = await runtime.invoke(command());
  const activation = materializeApprovedUsptoOfficialFeeGovernedActivationV1();
  const activePackageRef = `brain-method-package:${activation.activePackage.packageId}@${activation.activePackage.packageVersion}`;
  const evidenceRefs = [...raw.receipt.evidenceRefs, activePackageRef];
  return {
    ...raw,
    outcome: { ...raw.outcome, evidenceRefs },
    returnValue: { ...raw.returnValue, evidenceRefs },
    receipt: { ...raw.receipt, evidenceRefs }
  };
}

function productionMaterializer() {
  const references = { resolveCurrent: () => acceptedReference() };
  const methodCurrentness = new UsptoOfficialFeeMethodCurrentnessAuthorityV1({
    activation: currentApprovedUsptoOfficialFeeMethodActivationAuthorityV1
  });
  const referenceCurrentness = new UsptoOfficialFeeReferenceCurrentnessAuthorityV1({
    references,
    now: () => EVALUATED_AT
  });
  const policy = new CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1(
    promotedCapabilitySourceAdmissionPolicyCatalogV2
  );
  const evaluator = new CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1({
    admission: {
      capabilities: {
        findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
      },
      implementations: {
        findCurrent: () => USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
      },
      methodCurrentness,
      referenceCurrentness
    },
    policy
  });
  return new CurrentCapabilitySourceAdmissionEvidenceMaterializerV5({
    evaluator,
    sourceUse: new UsptoOfficialFeeSourceUseContextAuthorityV1(),
    now: () => EVALUATED_AT
  });
}

describe('real USPTO official-fee production-admissible V5 source', () => {
  it('materializes exact current producer evidence after real #659 governed activation', async () => {
    const execution = await governedExecution();
    const evidence = await productionMaterializer().evaluateAndMaterialize(execution);
    const activation = materializeApprovedUsptoOfficialFeeGovernedActivationV1();

    expect(validCapabilitySourceAdmissionEvidenceV5(evidence)).toBe(true);
    expect(evidence.decision.decision).toBe('PRODUCTION_ADMISSIBLE');
    expect(evidence.admissionPolicy).toMatchObject({
      policyId: 'source-admission-policy.uspto-official-fee-resolver.v2',
      policyVersion: 2
    });
    expect(evidence.decision.methodSource).toMatchObject({
      packageId: activation.activePackage.packageId,
      packageVersion: String(activation.activePackage.packageVersion),
      activationId: activation.decision.decisionId
    });
    expect(evidence.sourceUse).toMatchObject({ currentness: 'CURRENT' });
    expect(Object.values(evidence.authority).every((value) => value === false)).toBe(true);
  });

  it('fails closed when the execution does not evidence the governed active successor', async () => {
    const execution = await governedExecution();
    const activation = materializeApprovedUsptoOfficialFeeGovernedActivationV1();
    const activePackageRef = `brain-method-package:${activation.activePackage.packageId}@${activation.activePackage.packageVersion}`;
    const withoutActivationEvidence = {
      ...execution,
      outcome: {
        ...execution.outcome,
        evidenceRefs: execution.outcome.evidenceRefs.filter((ref) => ref !== activePackageRef)
      },
      returnValue: {
        ...execution.returnValue,
        evidenceRefs: execution.returnValue.evidenceRefs.filter((ref) => ref !== activePackageRef)
      },
      receipt: {
        ...execution.receipt,
        evidenceRefs: execution.receipt.evidenceRefs.filter((ref) => ref !== activePackageRef)
      }
    };

    await expect(
      productionMaterializer().evaluateAndMaterialize(withoutActivationEvidence)
    ).rejects.toMatchObject({ code: 'SOURCE_NOT_PRODUCTION_ADMISSIBLE' });
  });
});
