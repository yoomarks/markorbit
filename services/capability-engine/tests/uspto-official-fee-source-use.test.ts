import { describe, expect, it } from 'vitest';

import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  compileUsptoOfficialFeeMethodPackageV1
} from '@markorbit/contracts/brain-official-fee-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';
import { CurrentCapabilitySourceAdmissionEvaluator } from '../src/current-source-admission.js';
import { CurrentCapabilitySourceAdmissionEvidenceMaterializerV2 } from '../src/current-source-admission-evidence-v2.js';
import { currentCapabilitySourceAdmissionPolicyCatalogV1 } from '../src/source-admission-policy-catalog.js';
import {
  USPTO_OFFICIAL_FEE_SOURCE_USE_ASSUMPTIONS,
  USPTO_OFFICIAL_FEE_SOURCE_USE_LIMITATIONS,
  USPTO_OFFICIAL_FEE_SOURCE_USE_POLICY_ID,
  USPTO_OFFICIAL_FEE_SOURCE_USE_POLICY_VERSION,
  UsptoOfficialFeeSourceUseContextAuthorityV1
} from '../src/uspto-official-fee-source-use.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID,
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
const EVALUATED_AT = '2026-09-01T17:55:00.000Z';
const GOVERNED_PACKAGE_ID =
  'executable-method-package_uspto-official-fee-resolution-20250118-governed-successor';
const GOVERNED_PACKAGE_VERSION = '2';
const GOVERNED_PACKAGE_EVIDENCE_REF = `brain-method-package:${GOVERNED_PACKAGE_ID}@${GOVERNED_PACKAGE_VERSION}`;

function acceptedPackage() {
  const compiled = compileUsptoOfficialFeeMethodPackageV1({
    knowledgeSources: structuredClone(USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE),
    temporalResolution: {
      status: 'RESOLVED',
      effectiveFrom: EFFECTIVE_FROM,
      evidenceRef: 'USPTO_TRADEMARK_FEE_FINAL_RULE_EFFECTIVE_2025_01_18'
    },
    conflictResolution: {
      status: 'NONE',
      evidenceRef: 'USPTO_DUAL_SOURCE_AUTHORITY_RECONCILIATION_2026_08_28'
    }
  });
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

function resolverInput() {
  return {
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
  };
}

function command(overrides: Partial<CapabilityRequestV2Command> = {}): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_uspto_source_use',
      principalId: 'principal_uspto_source_use',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_uspto_source_use'
    },
    purpose: 'Resolve exact USPTO official-fee source-use policy.',
    input: resolverInput(),
    inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
    outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'uspto-source-use-runtime',
    correlationId: 'correlation_uspto_source_use',
    ...overrides
  };
}

async function historicalExecution() {
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
  const evidenceRefs = [...raw.receipt.evidenceRefs, GOVERNED_PACKAGE_EVIDENCE_REF];
  return {
    ...raw,
    outcome: { ...raw.outcome, evidenceRefs },
    returnValue: { ...raw.returnValue, evidenceRefs },
    receipt: { ...raw.receipt, evidenceRefs }
  };
}

const methodIdentity = Object.freeze({
  evidenceRef: GOVERNED_PACKAGE_EVIDENCE_REF,
  methodId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
  methodVersionId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID,
  packageId: GOVERNED_PACKAGE_ID,
  packageVersion: GOVERNED_PACKAGE_VERSION,
  activationId: `brain-method-activation_${'a'.repeat(64)}`,
  evaluationId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID
});

const referenceIdentity = Object.freeze({
  evidenceRef: `official-fee-reference:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID}`,
  sourceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
  sourceVersion: MATERIALIZED_AT,
  sourceFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256
});

async function productionEvidence(execution?: Awaited<ReturnType<typeof historicalExecution>>) {
  const resolvedExecution = execution ?? (await historicalExecution());
  const evaluator = new CurrentCapabilitySourceAdmissionEvaluator({
    capabilities: {
      findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
    },
    implementations: {
      findCurrent: () => USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
    },
    policy: {
      evaluate: () => ({
        applicability: 'SUPPORTED',
        methodCurrentness: 'REQUIRED',
        referenceCurrentness: 'REQUIRED'
      })
    },
    methodCurrentness: {
      evaluate: () => ({ status: 'CURRENT', identity: methodIdentity })
    },
    referenceCurrentness: {
      evaluate: () => ({ status: 'CURRENT', references: [referenceIdentity] })
    }
  });
  const materializer = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV2({
    evaluator,
    now: () => EVALUATED_AT
  });
  return materializer.evaluateAndMaterialize(resolvedExecution);
}

function resolve(
  runtimeExecution: Awaited<ReturnType<typeof historicalExecution>>,
  evidence: Awaited<ReturnType<typeof productionEvidence>>
) {
  return new UsptoOfficialFeeSourceUseContextAuthorityV1().resolve({
    runtimeExecution,
    evidence
  });
}

describe('USPTO official-fee source-use context authority V1', () => {
  it('resolves deterministic producer-owned use policy for exact execution and V2 evidence', async () => {
    const execution = await historicalExecution();
    const evidence = await productionEvidence(execution);

    const result = resolve(execution, evidence);

    expect(result).toEqual({
      status: 'RESOLVED',
      policy: {
        policyId: USPTO_OFFICIAL_FEE_SOURCE_USE_POLICY_ID,
        policyVersion: USPTO_OFFICIAL_FEE_SOURCE_USE_POLICY_VERSION
      },
      provenanceRefs: [
        `capability-request:${execution.request.capabilityRequestId}`,
        `capability-return:${execution.returnValue.capabilityReturnId}`,
        `capability-session-receipt:${execution.receipt.sessionReceiptId}`,
        GOVERNED_PACKAGE_EVIDENCE_REF,
        referenceIdentity.evidenceRef,
        `official-fee-materialization-sha256:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256}`
      ],
      assumptions: USPTO_OFFICIAL_FEE_SOURCE_USE_ASSUMPTIONS,
      limitations: USPTO_OFFICIAL_FEE_SOURCE_USE_LIMITATIONS
    });
  });

  it('fails closed when caller product or risk leaves the bounded use envelope', async () => {
    const execution = await historicalExecution();
    const evidence = await productionEvidence(execution);
    const foreignCaller = {
      ...execution,
      request: {
        ...execution.request,
        caller: { ...execution.request.caller, callerProduct: 'LITE' }
      }
    };
    const higherRisk = {
      ...execution,
      request: { ...execution.request, riskClass: 'MODERATE' as const }
    };

    expect(resolve(foreignCaller, evidence)).toMatchObject({ status: 'UNSUPPORTED' });
    expect(resolve(higherRisk, evidence)).toMatchObject({ status: 'UNSUPPORTED' });
  });

  it('fails closed when exact output or output fingerprint drifts', async () => {
    const execution = await historicalExecution();
    const evidence = await productionEvidence(execution);
    const output = execution.returnValue.output as Record<string, unknown>;
    const tamperedOutput = { ...output, totalAmountMinor: 1 };
    const tamperedExecution = {
      ...execution,
      outcome: { ...execution.outcome, output: tamperedOutput },
      returnValue: { ...execution.returnValue, output: tamperedOutput }
    };
    const tamperedEvidence = {
      ...evidence,
      sourceOutput: {
        ...evidence.sourceOutput!,
        outputFingerprintSha256: 'f'.repeat(64)
      }
    };

    expect(resolve(tamperedExecution, evidence)).toMatchObject({ status: 'UNSUPPORTED' });
    expect(resolve(execution, tamperedEvidence)).toMatchObject({ status: 'UNSUPPORTED' });
  });

  it('rejects V2 evidence whose immutable producer fingerprint has been tampered', async () => {
    const execution = await historicalExecution();
    const evidence = await productionEvidence(execution);
    const tamperedEvidence = {
      ...evidence,
      evidenceFingerprintSha256: '0'.repeat(64),
      evidenceId: `capability-source-admission-evidence_${'0'.repeat(64)}` as const
    };

    expect(resolve(execution, tamperedEvidence)).toMatchObject({ status: 'UNSUPPORTED' });
  });

  it('fails closed when historical or current producer binding identity drifts', async () => {
    const execution = await historicalExecution();
    const evidence = await productionEvidence(execution);
    if (evidence.decision.decision !== 'PRODUCTION_ADMISSIBLE') throw new Error('fixture denied');
    const historicalDrift = {
      ...evidence,
      decision: {
        ...evidence.decision,
        historical: {
          ...evidence.decision.historical,
          sessionReceiptId: 'session-receipt_tampered'
        }
      }
    };
    const currentDrift = {
      ...evidence,
      decision: {
        ...evidence.decision,
        current: {
          ...evidence.decision.current,
          implementation: {
            ...evidence.decision.current.implementation,
            version: evidence.decision.current.implementation.version + 1
          }
        }
      }
    };

    expect(resolve(execution, historicalDrift)).toMatchObject({ status: 'UNSUPPORTED' });
    expect(resolve(execution, currentDrift)).toMatchObject({ status: 'UNSUPPORTED' });
  });

  it('requires Method and Reference currentness identities without manufacturing either', async () => {
    const execution = await historicalExecution();
    const evidence = await productionEvidence(execution);
    if (evidence.decision.decision !== 'PRODUCTION_ADMISSIBLE') throw new Error('fixture denied');
    const { methodSource, ...decisionWithoutMethod } = evidence.decision;
    const { referenceSources, ...decisionWithoutReference } = evidence.decision;
    expect(methodSource).toBeDefined();
    expect(referenceSources).toBeDefined();
    const withoutMethod = {
      ...evidence,
      decision: decisionWithoutMethod
    };
    const withoutReference = {
      ...evidence,
      decision: decisionWithoutReference
    };

    expect(resolve(execution, withoutMethod)).toMatchObject({ status: 'UNSUPPORTED' });
    expect(resolve(execution, withoutReference)).toMatchObject({ status: 'UNSUPPORTED' });
  });

  it('uses the live governed USPTO v2 policy without bypassing producer currentness gates', async () => {
    const execution = await historicalExecution();
    const result = currentCapabilitySourceAdmissionPolicyCatalogV1.evaluate({
      execution,
      currentCapability: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
      currentImplementation: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
    });

    expect(result).toEqual({
      applicability: 'SUPPORTED',
      methodCurrentness: 'REQUIRED',
      referenceCurrentness: 'REQUIRED'
    });
  });
});
