import { createHash } from 'node:crypto';

import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import type {
  CapabilityRequestV2,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';

import {
  ExecutableMethodCapabilityExecutorV1,
  type ExecutableMethodPackageRunnerInputV1,
  type ExecutableMethodPackageRunnerV1
} from './executable-method-runtime.js';

export const USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID =
  'resolver.uspto-official-fee-base-application-per-class' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION = '1.0.0' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA =
  'brain-input.official-fee-resolution.v1' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA =
  'brain.official-fee-resolution.v1' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_EXECUTABLE_KIND = 'OFFICIAL_SOURCE_RESOLUTION' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_OPERATION =
  'USPTO_TM_NEW_APPLICATION_BASE_FEE_SECTION_1_44_ELECTRONIC_PER_CLASS' as const;

export const USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID =
  'brain-method_uspto-official-fee-resolution' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID =
  'brain-method-version_uspto-official-fee-resolution-20250118' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID =
  'executable-method-package_uspto-official-fee-resolution-20250118' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_VERSION = 1 as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID =
  'evaluation_uspto-official-fee-20250118' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_REFERENCE_DEPENDENCY =
  'CORE_OFFICIAL_FEE_REFERENCE_STORE_V1' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID =
  'official-fee-ref_f5aa68b190809b271729776c7fb99b65995708e5835cbd4f31e832d29efecbdc' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256 =
  '939d3b3c0bb0655a841bde8e73c4b19d33d90dce486cc6616d34d47b84894191' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256 =
  'cccae26b7e90a8a7dde4302ae84aeb18401b7743ee028b5e9e16b08394371a24' as const;
export const USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256 =
  'f5aa68b190809b271729776c7fb99b65995708e5835cbd4f31e832d29efecbdc' as const;

const REQUIRED_DATA = ['FILING_BASIS', 'CLASS_COUNT', 'RESOLVED_OFFICIAL_FEE_VALUE'] as const;
const ACCEPTED_KNOWLEDGE_IDENTITIES = [
  'art_01M127C5JTR5H69JT94XJBG8VA:rch_8110a47a3bf17a82b248e1fb8e42b8d7:8110a47a3bf17a82b248e1fb8e42b8d7e3f84e66578f840ace3a2f54a94e724f',
  'art_01M12SPMTVMHPRBJXW0QAR3R6D:rch_462a27b264a66de229d3d3309ff79941:462a27b264a66de229d3d3309ff799410d13159998bd234488d095c11e1a0fda'
] as const;

export interface UsptoOfficialFeeResolverInputV1 {
  jurisdiction: 'US';
  authority: 'USPTO';
  objectType: 'TRADEMARK_APPLICATION';
  operation: typeof USPTO_OFFICIAL_FEE_RESOLVER_OPERATION;
  procedure: 'ELECTRONIC_FILING';
  stage: 'NEW_APPLICATION';
  filingBasis: 'SECTION_1' | 'SECTION_44';
  segment: 'BASE_FEE';
  classCount: number;
  asOf: string;
  acceptedReferenceId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID;
}

export interface OfficialFeeReferenceReaderQueryV1 {
  operation: typeof USPTO_OFFICIAL_FEE_RESOLVER_OPERATION;
  jurisdiction: 'US';
  authority: 'USPTO';
  asOf: string;
}

/**
 * Read-only adapter owned by the Resolver implementation. The backing Reference Store
 * remains owned by Core; Capability receives only the exact controlled materialization
 * needed for this invocation and never becomes a second fee store.
 */
export interface OfficialFeeReferenceReaderV1 {
  resolveCurrent(query: Readonly<OfficialFeeReferenceReaderQueryV1>): unknown;
}

export interface UsptoOfficialFeeResolverReferenceV1 {
  schemaVersion: 1;
  referenceId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID;
  operation: typeof USPTO_OFFICIAL_FEE_RESOLVER_OPERATION;
  jurisdiction: 'US';
  authority: 'USPTO';
  currency: string;
  amountMinor: number;
  unit: 'PER_CLASS';
  effectiveFrom: string;
  status: 'CURRENT';
  packageId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID;
  methodId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID;
  methodVersionId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID;
  knowledgeSources: readonly unknown[];
  sourceIdentityFingerprintSha256: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256;
  materializationFingerprintSha256: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256;
  materializedAt: string;
}

export interface UsptoOfficialFeeResolverOutputV1 {
  schemaVersion: 1;
  kind: typeof USPTO_OFFICIAL_FEE_RESOLVER_EXECUTABLE_KIND;
  jurisdiction: 'US';
  authority: 'USPTO';
  operation: typeof USPTO_OFFICIAL_FEE_RESOLVER_OPERATION;
  filingBasis: 'SECTION_1' | 'SECTION_44';
  classCount: number;
  reference: Readonly<{
    referenceId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID;
    currency: string;
    amountMinor: number;
    unit: 'PER_CLASS';
    effectiveFrom: string;
    packageId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID;
    methodId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID;
    methodVersionId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID;
    sourceIdentityFingerprintSha256: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256;
    replayIdentityFingerprintSha256: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256;
    materializationFingerprintSha256: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256;
  }>;
  limitations: readonly string[];
  knowledgeResearchInvoked: false;
  referenceStoreReadControlled: true;
  productBusinessStateMutated: false;
}

export const USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION: Readonly<RuntimeCapabilityDefinition> =
  Object.freeze({
    schemaVersion: 1,
    runtimeCapabilityDefinitionId: 'runtime-capability_uspto-official-fee-resolver-v1',
    version: 1,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    title: 'USPTO official base application fee resolver',
    description:
      'Resolves the exact accepted USPTO electronic base application fee per class from the controlled Core Reference Store without Knowledge hot-path research.',
    lineage: {
      capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID
    },
    canonReference: {
      canonId: 'phase4-uspto-official-fee-resolver-acceptance',
      canonVersion: '1',
      sourceFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256
    },
    acceptedCanonProjection: true,
    createdFromWorkEvidence: false,
    createdFromAiOutput: false,
    createdAt: '2026-08-29T04:15:00.000Z'
  });

export const USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE: Readonly<ImplementationProfile> =
  Object.freeze({
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_uspto-official-fee-resolver-v1',
    version: 1,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    kind: 'DETERMINISTIC_SERVICE',
    status: 'APPROVED',
    implementationKey: 'brain-method-package-runtime.uspto-official-fee-resolver.v1',
    inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
    outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'LOW',
    timeoutMs: 1000,
    maxAttempts: 1,
    approvalPolicyVersion: 'phase4-uspto-official-fee-resolver-pilot.v1',
    createdAt: '2026-08-29T04:15:00.000Z'
  });

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    [...expected].sort().every((expectedKey, index) => keys[index] === expectedKey)
  );
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function digest(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function knowledgeIdentity(value: unknown): string | undefined {
  const source = record(value);
  const content = source ? record(source.content) : undefined;
  if (
    !source ||
    !content ||
    typeof content.objectId !== 'string' ||
    typeof source.chunkId !== 'string' ||
    typeof source.contentSha256 !== 'string'
  ) {
    return undefined;
  }
  return `${content.objectId}:${source.chunkId}:${source.contentSha256}`;
}

function normalizedKnowledgeSources(values: readonly unknown[]): readonly unknown[] {
  return [...values].sort((left, right) => {
    const leftIdentity = knowledgeIdentity(left) ?? '';
    const rightIdentity = knowledgeIdentity(right) ?? '';
    return leftIdentity.localeCompare(rightIdentity);
  });
}

function exactAcceptedKnowledgeLineage(values: readonly unknown[]): boolean {
  const identities = values
    .map(knowledgeIdentity)
    .filter((value): value is string => Boolean(value))
    .sort();
  const accepted = [...ACCEPTED_KNOWLEDGE_IDENTITIES].sort();
  return (
    identities.length === accepted.length &&
    identities.every((identity, index) => identity === accepted[index])
  );
}

export function parseUsptoOfficialFeeResolverInputV1(
  value: unknown
): UsptoOfficialFeeResolverInputV1 {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, [
      'jurisdiction',
      'authority',
      'objectType',
      'operation',
      'procedure',
      'stage',
      'filingBasis',
      'segment',
      'classCount',
      'asOf',
      'acceptedReferenceId'
    ]) ||
    input.jurisdiction !== 'US' ||
    input.authority !== 'USPTO' ||
    input.objectType !== 'TRADEMARK_APPLICATION' ||
    input.operation !== USPTO_OFFICIAL_FEE_RESOLVER_OPERATION ||
    input.procedure !== 'ELECTRONIC_FILING' ||
    input.stage !== 'NEW_APPLICATION' ||
    (input.filingBasis !== 'SECTION_1' && input.filingBasis !== 'SECTION_44') ||
    input.segment !== 'BASE_FEE' ||
    !Number.isSafeInteger(input.classCount) ||
    (input.classCount as number) < 1 ||
    (input.classCount as number) > 100 ||
    !instant(input.asOf) ||
    input.acceptedReferenceId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID
  ) {
    throw new TypeError('USPTO official fee Resolver input is outside the accepted Phase 4 pilot.');
  }
  return {
    jurisdiction: 'US',
    authority: 'USPTO',
    objectType: 'TRADEMARK_APPLICATION',
    operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
    procedure: 'ELECTRONIC_FILING',
    stage: 'NEW_APPLICATION',
    filingBasis: input.filingBasis,
    segment: 'BASE_FEE',
    classCount: input.classCount as number,
    asOf: input.asOf,
    acceptedReferenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID
  };
}

export function validateUsptoOfficialFeeResolverInputV1(value: unknown): boolean {
  try {
    parseUsptoOfficialFeeResolverInputV1(value);
    return true;
  } catch {
    return false;
  }
}

function referenceIntegrity(reference: Readonly<UsptoOfficialFeeResolverReferenceV1>): Readonly<{
  sourceIdentityFingerprintSha256: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256;
  replayIdentityFingerprintSha256: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256;
  materializationFingerprintSha256: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256;
}> {
  const knowledgeSources = normalizedKnowledgeSources(reference.knowledgeSources);
  const sourceIdentityFingerprintSha256 = digest({
    packageId: reference.packageId,
    methodId: reference.methodId,
    methodVersionId: reference.methodVersionId,
    knowledgeSources
  });
  const replayIdentityFingerprintSha256 = digest({
    operation: reference.operation,
    jurisdiction: reference.jurisdiction,
    authority: reference.authority,
    sourceIdentityFingerprintSha256,
    effectiveFrom: reference.effectiveFrom,
    effectiveTo: null
  });
  const materializationFingerprintSha256 = digest({
    replayIdentityFingerprintSha256,
    currency: reference.currency,
    amountMinor: reference.amountMinor,
    unit: reference.unit
  });
  if (
    sourceIdentityFingerprintSha256 !==
      USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256 ||
    sourceIdentityFingerprintSha256 !== reference.sourceIdentityFingerprintSha256 ||
    replayIdentityFingerprintSha256 !==
      USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256 ||
    materializationFingerprintSha256 !==
      USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256 ||
    materializationFingerprintSha256 !== reference.materializationFingerprintSha256 ||
    reference.referenceId !== `official-fee-ref_${materializationFingerprintSha256}`
  ) {
    throw new TypeError('Official Fee reference integrity verification failed.');
  }
  return {
    sourceIdentityFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
    replayIdentityFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256,
    materializationFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256
  };
}

function parseReference(value: unknown): UsptoOfficialFeeResolverReferenceV1 {
  const reference = record(value);
  if (
    !reference ||
    !exactKeys(reference, [
      'schemaVersion',
      'referenceId',
      'operation',
      'jurisdiction',
      'authority',
      'currency',
      'amountMinor',
      'unit',
      'effectiveFrom',
      'status',
      'packageId',
      'methodId',
      'methodVersionId',
      'knowledgeSources',
      'sourceIdentityFingerprintSha256',
      'materializationFingerprintSha256',
      'materializedAt'
    ]) ||
    reference.schemaVersion !== 1 ||
    reference.referenceId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID ||
    reference.operation !== USPTO_OFFICIAL_FEE_RESOLVER_OPERATION ||
    reference.jurisdiction !== 'US' ||
    reference.authority !== 'USPTO' ||
    typeof reference.currency !== 'string' ||
    !/^[A-Z]{3}$/u.test(reference.currency) ||
    !Number.isSafeInteger(reference.amountMinor) ||
    (reference.amountMinor as number) < 1 ||
    reference.unit !== 'PER_CLASS' ||
    !instant(reference.effectiveFrom) ||
    reference.status !== 'CURRENT' ||
    reference.packageId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID ||
    reference.methodId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID ||
    reference.methodVersionId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID ||
    !Array.isArray(reference.knowledgeSources) ||
    !exactAcceptedKnowledgeLineage(reference.knowledgeSources) ||
    reference.sourceIdentityFingerprintSha256 !==
      USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256 ||
    reference.materializationFingerprintSha256 !==
      USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256 ||
    !instant(reference.materializedAt)
  ) {
    throw new TypeError(
      'Controlled Official Fee Reference Store returned a record outside the accepted Phase 4 Resolver identity.'
    );
  }
  const parsed = reference as unknown as UsptoOfficialFeeResolverReferenceV1;
  referenceIntegrity(parsed);
  return parsed;
}

export function validateUsptoOfficialFeeResolverOutputV1(value: unknown): boolean {
  const output = record(value);
  const reference = output ? record(output.reference) : undefined;
  if (
    !output ||
    !reference ||
    !exactKeys(output, [
      'schemaVersion',
      'kind',
      'jurisdiction',
      'authority',
      'operation',
      'filingBasis',
      'classCount',
      'reference',
      'limitations',
      'knowledgeResearchInvoked',
      'referenceStoreReadControlled',
      'productBusinessStateMutated'
    ]) ||
    !exactKeys(reference, [
      'referenceId',
      'currency',
      'amountMinor',
      'unit',
      'effectiveFrom',
      'packageId',
      'methodId',
      'methodVersionId',
      'sourceIdentityFingerprintSha256',
      'replayIdentityFingerprintSha256',
      'materializationFingerprintSha256'
    ]) ||
    output.schemaVersion !== 1 ||
    output.kind !== USPTO_OFFICIAL_FEE_RESOLVER_EXECUTABLE_KIND ||
    output.jurisdiction !== 'US' ||
    output.authority !== 'USPTO' ||
    output.operation !== USPTO_OFFICIAL_FEE_RESOLVER_OPERATION ||
    (output.filingBasis !== 'SECTION_1' && output.filingBasis !== 'SECTION_44') ||
    !Number.isSafeInteger(output.classCount) ||
    (output.classCount as number) < 1 ||
    reference.referenceId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID ||
    typeof reference.currency !== 'string' ||
    !Number.isSafeInteger(reference.amountMinor) ||
    (reference.amountMinor as number) < 1 ||
    reference.unit !== 'PER_CLASS' ||
    !instant(reference.effectiveFrom) ||
    reference.packageId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID ||
    reference.methodId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID ||
    reference.methodVersionId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID ||
    reference.sourceIdentityFingerprintSha256 !==
      USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256 ||
    reference.replayIdentityFingerprintSha256 !==
      USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256 ||
    reference.materializationFingerprintSha256 !==
      USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256 ||
    !Array.isArray(output.limitations) ||
    output.limitations.length === 0 ||
    !output.limitations.every((item) => typeof item === 'string' && item.length > 0) ||
    output.knowledgeResearchInvoked !== false ||
    output.referenceStoreReadControlled !== true ||
    output.productBusinessStateMutated !== false
  ) {
    return false;
  }
  return true;
}

export class UsptoOfficialFeeMethodSelectionContextResolverV1 {
  resolve(request: Readonly<CapabilityRequestV2>): Readonly<{
    methodFamily: 'SOURCE_RESOLUTION';
    jurisdiction: string;
    authority: string;
    objectType: string;
    operation: string;
    procedure: string;
    stage: string;
    filingBasis: string;
    segment: string;
    availableData: readonly string[];
    asOf: string;
  }> {
    const input = parseUsptoOfficialFeeResolverInputV1(request.input);
    return {
      methodFamily: 'SOURCE_RESOLUTION',
      jurisdiction: input.jurisdiction,
      authority: input.authority,
      objectType: input.objectType,
      operation: input.operation,
      procedure: input.procedure,
      stage: input.stage,
      filingBasis: input.filingBasis,
      segment: input.segment,
      availableData: REQUIRED_DATA,
      asOf: input.asOf
    };
  }
}

function assertAcceptedPackage(pkg: Readonly<ExecutableMethodPackageV1>): void {
  if (
    pkg.lifecycle !== 'ACTIVE' ||
    pkg.packageId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID ||
    pkg.packageVersion !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_VERSION ||
    pkg.methodId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID ||
    pkg.methodVersionId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID ||
    pkg.methodFamily !== 'SOURCE_RESOLUTION' ||
    pkg.evaluation.evaluationId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID ||
    pkg.executable.kind !== USPTO_OFFICIAL_FEE_RESOLVER_EXECUTABLE_KIND ||
    pkg.referenceDependencies.length !== 1 ||
    pkg.referenceDependencies[0] !== USPTO_OFFICIAL_FEE_RESOLVER_REFERENCE_DEPENDENCY ||
    !exactAcceptedKnowledgeLineage(pkg.lineage.knowledgeSources)
  ) {
    throw new TypeError(
      'USPTO official fee Resolver package does not match the explicit Phase 4 artifact acceptance decision.'
    );
  }
}

export class UsptoOfficialFeeSourceResolutionRunnerV1 implements ExecutableMethodPackageRunnerV1 {
  constructor(private readonly references: OfficialFeeReferenceReaderV1) {}

  async run(
    input: Readonly<ExecutableMethodPackageRunnerInputV1>
  ): Promise<{ output: UsptoOfficialFeeResolverOutputV1; evidenceRefs: readonly string[] }> {
    const requestInput = parseUsptoOfficialFeeResolverInputV1(input.request.input);
    assertAcceptedPackage(input.package);

    const reference = parseReference(
      await this.references.resolveCurrent({
        operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
        jurisdiction: 'US',
        authority: 'USPTO',
        asOf: requestInput.asOf
      })
    );
    const integrity = referenceIntegrity(reference);
    const asOf = Date.parse(requestInput.asOf);
    if (Date.parse(reference.effectiveFrom) > asOf) {
      throw new TypeError(
        'Accepted Official Fee reference is not effective at the requested time.'
      );
    }
    if (
      reference.packageId !== input.package.packageId ||
      reference.methodId !== input.package.methodId ||
      reference.methodVersionId !== input.package.methodVersionId
    ) {
      throw new TypeError(
        'Official Fee reference and executable package lineage do not match exactly.'
      );
    }

    const output: UsptoOfficialFeeResolverOutputV1 = {
      schemaVersion: 1,
      kind: USPTO_OFFICIAL_FEE_RESOLVER_EXECUTABLE_KIND,
      jurisdiction: 'US',
      authority: 'USPTO',
      operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
      filingBasis: requestInput.filingBasis,
      classCount: requestInput.classCount,
      reference: {
        referenceId: reference.referenceId,
        currency: reference.currency,
        amountMinor: reference.amountMinor,
        unit: reference.unit,
        effectiveFrom: reference.effectiveFrom,
        packageId: reference.packageId,
        methodId: reference.methodId,
        methodVersionId: reference.methodVersionId,
        sourceIdentityFingerprintSha256: integrity.sourceIdentityFingerprintSha256,
        replayIdentityFingerprintSha256: integrity.replayIdentityFingerprintSha256,
        materializationFingerprintSha256: integrity.materializationFingerprintSha256
      },
      limitations: [...input.package.limitations],
      knowledgeResearchInvoked: false,
      referenceStoreReadControlled: true,
      productBusinessStateMutated: false
    };

    return {
      output,
      evidenceRefs: [
        `official-fee-reference:${reference.referenceId}`,
        `official-fee-source-identity-sha256:${integrity.sourceIdentityFingerprintSha256}`,
        `official-fee-replay-identity-sha256:${integrity.replayIdentityFingerprintSha256}`,
        `official-fee-materialization-sha256:${integrity.materializationFingerprintSha256}`,
        'phase4-resolver-acceptance:github:yoomarks/markorbit#310',
        'capability-runtime:knowledge-research-hot-path=absent',
        'capability-runtime:reference-store-read=controlled',
        'capability-runtime:product-business-state-write=absent'
      ]
    };
  }
}

export function createUsptoOfficialFeeResolverCapabilityExecutorV1(
  activePackage: Readonly<ExecutableMethodPackageV1>,
  references: OfficialFeeReferenceReaderV1
): ExecutableMethodCapabilityExecutorV1 {
  assertAcceptedPackage(activePackage);
  const runner = new UsptoOfficialFeeSourceResolutionRunnerV1(references);
  return new ExecutableMethodCapabilityExecutorV1({
    packages: {
      list: () => Promise.resolve([activePackage])
    },
    selectionContext: new UsptoOfficialFeeMethodSelectionContextResolverV1(),
    runners: {
      resolve: (kind) => (kind === USPTO_OFFICIAL_FEE_RESOLVER_EXECUTABLE_KIND ? runner : undefined)
    }
  });
}
