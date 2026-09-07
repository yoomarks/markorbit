import { isDeepStrictEqual } from 'node:util';

import type { CapabilityRequestV2 } from '@markorbit/contracts/capability-runtime';
import {
  US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID,
  US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID,
  US_TRADEMARK_STRATEGY_ASSUMPTIONS,
  USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
  USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
  activateUsTrademarkMarkRepresentationMethodPackageV1,
  compileUsTrademarkMarkRepresentationMethodPackageV1,
  executeUsTrademarkMarkRepresentationStrategyV1,
  type ExecuteUsTrademarkMarkRepresentationStrategyResultV1
} from '@markorbit/contracts/brain-us-trademark-mark-representation-method';
import {
  noRecommendationSourceAuthorityConsequences,
  type ProductionIntakeInputV1,
  type RecommendationSourceAuthorityConsequencesV1
} from '@markorbit/contracts/markreg-early-funnel';
import { CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1 } from './current-source-admission-evidence-v5.js';
import type {
  CapabilityMethodCurrentnessAuthority,
  CapabilityMethodCurrentnessResult,
  CapabilityReferenceCurrentnessAuthority,
  CapabilityReferenceCurrentnessResult,
  CapabilitySourceAdmissionPolicyInput,
  CurrentImplementationProfileAuthority,
  CurrentRuntimeCapabilityAuthority
} from './current-source-admission.js';
import {
  ExecutableMethodCapabilityExecutorV1,
  type ExecutableMethodPackageRunnerInputV1,
  type ExecutableMethodPackageRunnerV1,
  type MethodSelectionContextResolverV1
} from './executable-method-runtime.js';
import {
  CurrentCapabilityProductionSourceEvidenceAuthorityV1,
  type CapabilityProductionSourceEvidenceAuthorityResolutionV1,
  type CapabilityProductionSourceEvidenceAuthorityV1
} from './production-source-evidence-read.js';
import { CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1 } from './source-admission-policy-content-provenance.js';
import { currentCapabilitySourceAdmissionPolicyCatalogV1 } from './source-admission-policy-catalog.js';
import type { CapabilityRuntimeExecution } from './capability-runtime.js';
import type { CapabilitySourceUseContextResolutionV1 } from './current-source-admission-evidence-v3.js';
import { canonicalJsonSha256V1 } from './capability-source-output-identity.js';
import {
  UsTrademarkMarkRepresentationMethodReaderError,
  type CurrentUsTrademarkMarkRepresentationMethodSnapshotV1,
  type UsTrademarkMarkRepresentationMethodReaderV1
} from './us-trademark-mark-representation-method-http-reader.js';

import {
  US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID,
  US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION,
  US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE
} from './us-trademark-mark-representation-strategy-binding.js';
export {
  US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_DEFINITION,
  US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID,
  US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION,
  US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE
} from './us-trademark-mark-representation-strategy-binding.js';

export const US_TRADEMARK_MARK_REPRESENTATION_EXECUTABLE_KIND =
  'BOUNDED_MARK_REPRESENTATION_CLASSIFICATION' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_FAMILY_ID =
  'us-trademark-mark-representation-strategy' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_SOURCE_USE_POLICY_ID =
  'source-use-policy.us-trademark-mark-representation-strategy.markreg.v1' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_MAX_CAPTURE_AGE_DAYS = 31;

export interface UsTrademarkMarkRepresentationStrategySourceOutputV1 {
  readonly schemaVersion: 1;
  readonly kind: typeof US_TRADEMARK_MARK_REPRESENTATION_EXECUTABLE_KIND;
  readonly outputFamilyId: typeof US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_FAMILY_ID;
  readonly outputFamilyVersion: 1;
  readonly capabilityId: typeof US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID;
  readonly capabilityVersion: typeof US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION;
  readonly analyzedInputFingerprintSha256: string;
  readonly applicability: Readonly<ExecuteUsTrademarkMarkRepresentationStrategyResultV1>;
  readonly method: Readonly<{
    methodId: typeof US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID;
    methodVersionId: typeof US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID;
    packageId: typeof US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID;
    packageVersion: 2;
    inputSchemaId: typeof US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID;
    outputSchemaId: typeof US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID;
  }>;
  readonly reference: Readonly<{
    profileId: string;
    sourceKey: string;
    sourceVersion: string;
    sourceId: string;
    documentId: string;
    artifactVersion: number;
    documentContentSha256: string;
    canonicalUri: string;
    capturedAt: string;
    indexedAt: string;
    maxCaptureAgeDays: typeof US_TRADEMARK_MARK_REPRESENTATION_MAX_CAPTURE_AGE_DAYS;
    currentnessBasis: 'CORE_BRAIN_ASSET_LATEST_ACTIVE_PLUS_EXACT_KNOWLEDGE_REFERENCE_IDENTITY_AND_CAPTURE_WINDOW';
  }>;
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
  readonly authorityConsequences: Readonly<RecommendationSourceAuthorityConsequencesV1>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function text(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 2000
  );
}

export function parseUsTrademarkMarkRepresentationStrategyInputV1(
  value: unknown
): ProductionIntakeInputV1 {
  const input = record(value);
  const applicant = input ? record(input.applicant) : undefined;
  const trademark = input ? record(input.trademark) : undefined;
  const goodsServices = input ? record(input.goodsServices) : undefined;
  if (
    !input ||
    !applicant ||
    !trademark ||
    !goodsServices ||
    !exactKeys(input, [
      'businessContext',
      'applicant',
      'trademark',
      'targetJurisdictions',
      'goodsServices',
      'filingGoal'
    ]) ||
    !exactKeys(applicant, ['type', 'name', 'country']) ||
    !exactKeys(trademark, ['type', 'representationText']) ||
    !exactKeys(goodsServices, ['sourceText']) ||
    !text(input.businessContext) ||
    !['INDIVIDUAL', 'ORGANIZATION', 'OTHER'].includes(String(applicant.type)) ||
    !text(applicant.name) ||
    !text(applicant.country) ||
    !['WORD', 'STYLIZED_WORD', 'DEVICE', 'COMPOSITE', 'OTHER'].includes(String(trademark.type)) ||
    typeof trademark.representationText !== 'string' ||
    trademark.representationText.length > 2000 ||
    !Array.isArray(input.targetJurisdictions) ||
    input.targetJurisdictions.length === 0 ||
    input.targetJurisdictions.some((item) => !text(item)) ||
    !text(goodsServices.sourceText) ||
    !text(input.filingGoal)
  ) {
    throw new TypeError(
      'US trademark mark-representation strategy input must be one exact bounded Production Intake input.'
    );
  }
  return structuredClone(value) as ProductionIntakeInputV1;
}

export function validateUsTrademarkMarkRepresentationStrategyInputV1(value: unknown): boolean {
  try {
    parseUsTrademarkMarkRepresentationStrategyInputV1(value);
    return true;
  } catch {
    return false;
  }
}

function canonicalActivation() {
  const compiled = compileUsTrademarkMarkRepresentationMethodPackageV1({
    knowledgeSources: USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
    reference: { ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE, currentness: 'CURRENT' }
  });
  if (compiled.status !== 'READY') throw new Error('Governed strategy Method is unavailable.');
  return activateUsTrademarkMarkRepresentationMethodPackageV1(compiled.package);
}

function referenceProjection(): UsTrademarkMarkRepresentationStrategySourceOutputV1['reference'] {
  const reference = USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE;
  return {
    profileId: reference.profileId,
    sourceKey: reference.sourceKey,
    sourceVersion: reference.sourceVersion,
    sourceId: reference.sourceId,
    documentId: reference.documentId,
    artifactVersion: reference.artifactVersion,
    documentContentSha256: reference.documentContentSha256,
    canonicalUri: reference.canonicalUri,
    capturedAt: reference.capturedAt,
    indexedAt: reference.indexedAt,
    maxCaptureAgeDays: US_TRADEMARK_MARK_REPRESENTATION_MAX_CAPTURE_AGE_DAYS,
    currentnessBasis:
      'CORE_BRAIN_ASSET_LATEST_ACTIVE_PLUS_EXACT_KNOWLEDGE_REFERENCE_IDENTITY_AND_CAPTURE_WINDOW'
  };
}

export function validateUsTrademarkMarkRepresentationStrategyOutputV1(value: unknown): boolean {
  const output = record(value);
  if (!output) return false;
  const activation = canonicalActivation();
  const parsedInputIndependent = {
    schemaVersion: 1,
    kind: US_TRADEMARK_MARK_REPRESENTATION_EXECUTABLE_KIND,
    outputFamilyId: US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_FAMILY_ID,
    outputFamilyVersion: 1,
    capabilityId: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID,
    capabilityVersion: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION
  };
  const method = record(output.method);
  const reference = record(output.reference);
  return Boolean(
    Object.entries(parsedInputIndependent).every(([key, expected]) => output[key] === expected) &&
    method &&
    method.methodId === activation.activePackage.methodId &&
    method.methodVersionId === activation.activePackage.methodVersionId &&
    method.packageId === activation.activePackage.packageId &&
    method.packageVersion === activation.activePackage.packageVersion &&
    method.inputSchemaId === US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID &&
    method.outputSchemaId === US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID &&
    reference &&
    typeof output.analyzedInputFingerprintSha256 === 'string' &&
    /^[0-9a-f]{64}$/u.test(output.analyzedInputFingerprintSha256) &&
    isDeepStrictEqual(reference, referenceProjection()) &&
    Array.isArray(output.assumptions) &&
    isDeepStrictEqual(output.assumptions, [...US_TRADEMARK_STRATEGY_ASSUMPTIONS]) &&
    Array.isArray(output.limitations) &&
    isDeepStrictEqual(output.limitations, [...activation.activePackage.limitations]) &&
    isDeepStrictEqual(output.authorityConsequences, noRecommendationSourceAuthorityConsequences) &&
    record(output.applicability) &&
    ['APPLICABLE', 'NOT_APPLICABLE'].includes(String(record(output.applicability)!.status))
  );
}

class StrategySelectionContextV1 implements MethodSelectionContextResolverV1 {
  resolve(request: Readonly<CapabilityRequestV2>) {
    parseUsTrademarkMarkRepresentationStrategyInputV1(request.input);
    return {
      methodFamily: 'CLASSIFICATION' as const,
      // Select the one governed US Method first; applicability to the customer's
      // target jurisdictions is evaluated by that Method and may return NOT_APPLICABLE.
      jurisdiction: 'US',
      authority: 'USPTO',
      objectType: 'TRADEMARK_APPLICATION',
      operation: 'MARK_REPRESENTATION_STRATEGY',
      procedure: 'PRE_FILING_STRATEGY',
      stage: 'CUSTOMER_INTAKE',
      filingBasis: 'ANY',
      segment: 'MARK_REPRESENTATION',
      availableData: [
        'TRADEMARK_TYPE',
        'TRADEMARK_REPRESENTATION_TEXT',
        'TARGET_JURISDICTIONS',
        'SOURCE_LINEAGE'
      ],
      asOf: request.receivedAt
    };
  }
}

function documentEvidenceRef(): string {
  const reference = USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE;
  return `knowledge-reference:${reference.documentId}:${reference.artifactVersion}:${reference.documentContentSha256}`;
}

class StrategyRunnerV1 implements ExecutableMethodPackageRunnerV1 {
  run(input: Readonly<ExecutableMethodPackageRunnerInputV1>) {
    const activation = canonicalActivation();
    if (!isDeepStrictEqual(input.package, activation.activePackage)) {
      throw new TypeError('Strategy source requires the exact #903 ACTIVE Method package.');
    }
    const intake = parseUsTrademarkMarkRepresentationStrategyInputV1(input.request.input);
    const output: UsTrademarkMarkRepresentationStrategySourceOutputV1 = {
      schemaVersion: 1,
      kind: US_TRADEMARK_MARK_REPRESENTATION_EXECUTABLE_KIND,
      outputFamilyId: US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_FAMILY_ID,
      outputFamilyVersion: 1,
      capabilityId: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID,
      capabilityVersion: US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION,
      analyzedInputFingerprintSha256: canonicalJsonSha256V1(intake),
      applicability: executeUsTrademarkMarkRepresentationStrategyV1(intake),
      method: {
        methodId: US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID,
        methodVersionId: US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID,
        packageId: US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID,
        packageVersion: 2,
        inputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
        outputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID
      },
      reference: referenceProjection(),
      assumptions: [...US_TRADEMARK_STRATEGY_ASSUMPTIONS],
      limitations: [...activation.activePackage.limitations],
      authorityConsequences: noRecommendationSourceAuthorityConsequences
    };
    return Promise.resolve({
      output,
      evidenceRefs: [
        activation.activationEvidenceRef,
        `brain-method-activation:${activation.decision.decisionId}`,
        documentEvidenceRef(),
        ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE.map(
          (source) =>
            `knowledge-source:${source.content.objectId}:${source.chunkId}:${source.contentSha256}`
        ),
        'capability-runtime:generic-ai-fallback=absent',
        'capability-runtime:product-business-state-write=absent'
      ]
    });
  }
}

export function createUsTrademarkMarkRepresentationStrategyExecutorV1(): ExecutableMethodCapabilityExecutorV1 {
  const activation = canonicalActivation();
  return new ExecutableMethodCapabilityExecutorV1({
    packages: { list: () => Promise.resolve([activation.activePackage]) },
    selectionContext: new StrategySelectionContextV1(),
    runners: {
      resolve: (kind) =>
        kind === US_TRADEMARK_MARK_REPRESENTATION_EXECUTABLE_KIND
          ? new StrategyRunnerV1()
          : undefined
    }
  });
}

function exactBinding(input: Readonly<CapabilitySourceAdmissionPolicyInput>): boolean {
  const output = input.execution.returnValue.output as
    UsTrademarkMarkRepresentationStrategySourceOutputV1 | undefined;
  return (
    input.currentCapability.capabilityId === US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID &&
    input.currentCapability.capabilityVersion ===
      US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_VERSION &&
    input.currentImplementation.implementationProfileId ===
      US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE.implementationProfileId &&
    input.currentImplementation.implementationKey ===
      US_TRADEMARK_MARK_REPRESENTATION_IMPLEMENTATION_PROFILE.implementationKey &&
    input.execution.request.outputSchemaId === US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID &&
    validateUsTrademarkMarkRepresentationStrategyOutputV1(output) &&
    output?.analyzedInputFingerprintSha256 === canonicalJsonSha256V1(input.execution.request.input)
  );
}

class StrategyCoreCurrentnessSnapshotV1 {
  private current?: Promise<Readonly<CurrentUsTrademarkMarkRepresentationMethodSnapshotV1>>;

  constructor(
    private readonly methods: Readonly<UsTrademarkMarkRepresentationMethodReaderV1>,
    private readonly asOf: string
  ) {}

  resolve(): Promise<Readonly<CurrentUsTrademarkMarkRepresentationMethodSnapshotV1>> {
    this.current ??= this.methods.resolveCurrent({
      operation: 'MARK_REPRESENTATION_STRATEGY',
      jurisdiction: 'US',
      authority: 'USPTO',
      asOf: this.asOf
    });
    return this.current;
  }
}

function currentnessFailure(
  error: unknown
): CapabilityMethodCurrentnessResult | CapabilityReferenceCurrentnessResult {
  if (error instanceof UsTrademarkMarkRepresentationMethodReaderError) {
    if (
      error.code === 'NO_CURRENT_METHOD' ||
      error.code === 'AMBIGUOUS_CURRENT_METHOD' ||
      error.code === 'IDENTITY_MISMATCH'
    ) {
      return { status: 'NOT_CURRENT', reason: error.message };
    }
    return { status: 'UNAVAILABLE', reason: error.message };
  }
  return {
    status: 'UNAVAILABLE',
    reason: 'Core US trademark Method currentness authority is unavailable.'
  };
}

class StrategyMethodCurrentnessV1 implements CapabilityMethodCurrentnessAuthority {
  constructor(private readonly snapshot: StrategyCoreCurrentnessSnapshotV1) {}

  async evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): Promise<CapabilityMethodCurrentnessResult> {
    if (!exactBinding(input)) {
      return {
        status: 'UNSUPPORTED_APPLICABILITY',
        reason: 'Method currentness applies only to the exact strategy source binding and output.'
      };
    }
    let current: Readonly<CurrentUsTrademarkMarkRepresentationMethodSnapshotV1>;
    try {
      current = await this.snapshot.resolve();
    } catch (error) {
      return currentnessFailure(error) as CapabilityMethodCurrentnessResult;
    }
    return {
      status: 'CURRENT',
      identity: {
        evidenceRef: current.activationEvidenceRef,
        methodId: current.methodId,
        methodVersionId: current.methodVersionId,
        packageId: current.packageId,
        packageVersion: String(current.packageVersion),
        activationId: current.activationDecisionId,
        evaluationId: canonicalActivation().activePackage.evaluation.evaluationId
      }
    };
  }
}

class StrategyReferenceCurrentnessV1 implements CapabilityReferenceCurrentnessAuthority {
  constructor(private readonly snapshot: StrategyCoreCurrentnessSnapshotV1) {}

  async evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): Promise<CapabilityReferenceCurrentnessResult> {
    if (!exactBinding(input)) {
      return {
        status: 'UNSUPPORTED_APPLICABILITY',
        reason:
          'Reference currentness applies only to the exact strategy source binding and output.'
      };
    }
    try {
      await this.snapshot.resolve();
    } catch (error) {
      return currentnessFailure(error) as CapabilityReferenceCurrentnessResult;
    }
    const reference = USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE;
    return {
      status: 'CURRENT',
      references: [
        {
          evidenceRef: documentEvidenceRef(),
          sourceId: reference.sourceId,
          sourceVersion: reference.sourceVersion,
          sourceFingerprintSha256: reference.documentContentSha256
        },
        ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE.map((source) => ({
          evidenceRef: `knowledge-source:${source.content.objectId}:${source.chunkId}:${source.contentSha256}`,
          sourceId: source.chunkId,
          sourceVersion: source.indexedAt,
          sourceFingerprintSha256: source.contentSha256
        }))
      ]
    };
  }
}

class StrategySourceUseV1 {
  resolve(input: Readonly<{ runtimeExecution: unknown }>): CapabilitySourceUseContextResolutionV1 {
    const execution = input.runtimeExecution as CapabilityRuntimeExecution;
    const output = execution?.returnValue?.output;
    if (!validateUsTrademarkMarkRepresentationStrategyOutputV1(output)) {
      return {
        status: 'UNSUPPORTED',
        reason: 'Strategy source use requires one exact validated output.'
      };
    }
    const strategyOutput = output as UsTrademarkMarkRepresentationStrategySourceOutputV1;
    if (strategyOutput.applicability.status !== 'APPLICABLE') {
      return {
        status: 'UNSUPPORTED',
        reason: `Strategy source is NOT_APPLICABLE: ${strategyOutput.applicability.reasonCode}.`
      };
    }
    return {
      status: 'RESOLVED',
      policy: { policyId: US_TRADEMARK_MARK_REPRESENTATION_SOURCE_USE_POLICY_ID, policyVersion: 1 },
      provenanceRefs: [
        ...execution.receipt.evidenceRefs,
        `strategy-output-family:${strategyOutput.outputFamilyId}@${strategyOutput.outputFamilyVersion}`
      ],
      assumptions: [...strategyOutput.assumptions],
      limitations: [...strategyOutput.limitations]
    };
  }
}

export interface UsTrademarkMarkRepresentationProductionSourceEvidenceOptionsV1 {
  readonly capabilities: Readonly<CurrentRuntimeCapabilityAuthority>;
  readonly implementations: Readonly<CurrentImplementationProfileAuthority>;
  readonly methods: Readonly<UsTrademarkMarkRepresentationMethodReaderV1>;
  readonly now?: () => string;
}

export class UsTrademarkMarkRepresentationProductionSourceEvidenceAuthorityV1 implements CapabilityProductionSourceEvidenceAuthorityV1 {
  constructor(
    private readonly options: Readonly<UsTrademarkMarkRepresentationProductionSourceEvidenceOptionsV1>
  ) {}

  evaluate(
    execution: Readonly<CapabilityRuntimeExecution>
  ): Promise<CapabilityProductionSourceEvidenceAuthorityResolutionV1> {
    const now = this.options.now ?? (() => new Date().toISOString());
    let fixed: string;
    try {
      fixed = now();
    } catch {
      return Promise.resolve({
        status: 'UNAVAILABLE',
        retryable: true,
        denial: {
          code: 'CURRENTNESS_CLOCK_UNAVAILABLE',
          reason: 'Strategy source currentness clock is unavailable.'
        }
      });
    }
    if (
      !fixed ||
      Number.isNaN(Date.parse(fixed)) ||
      new Date(Date.parse(fixed)).toISOString() !== fixed
    ) {
      return Promise.resolve({
        status: 'UNAVAILABLE',
        retryable: false,
        denial: {
          code: 'INVALID_CURRENTNESS_CLOCK',
          reason: 'Strategy source currentness clock must be one exact ISO instant.'
        }
      });
    }
    const fixedNow = () => fixed;
    const snapshot = new StrategyCoreCurrentnessSnapshotV1(this.options.methods, fixed);
    const evaluator = new CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1({
      admission: {
        capabilities: this.options.capabilities,
        implementations: this.options.implementations,
        methodCurrentness: new StrategyMethodCurrentnessV1(snapshot),
        referenceCurrentness: new StrategyReferenceCurrentnessV1(snapshot)
      },
      policy: new CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1(
        currentCapabilitySourceAdmissionPolicyCatalogV1
      )
    });
    return new CurrentCapabilityProductionSourceEvidenceAuthorityV1({
      evaluator,
      sourceUse: new StrategySourceUseV1(),
      now: fixedNow
    }).evaluate(execution);
  }
}
