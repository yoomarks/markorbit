import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  capabilitySourceMaturityClasses,
  currentCapabilitySourceAdmissionPolicyCatalogV1
} from './source-admission-policy-catalog.js';

const SHA256 = /^[0-9a-f]{64}$/;
const RISK_CLASSES = new Set(['LOW', 'MODERATE', 'HIGH', 'PROTECTED']);
const CURRENTNESS_REQUIREMENTS = new Set(['REQUIRED', 'NOT_REQUIRED']);
const SOURCE_MATURITY_CLASSES = new Set<string>(capabilitySourceMaturityClasses);

export class CapabilityCognitiveReadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CapabilityCognitiveReadError';
  }
}

export interface CurrentRuntimeCapabilityCatalogReadV1 {
  listCurrent(): Promise<readonly Readonly<RuntimeCapabilityDefinition>[]>;
}

export interface CurrentImplementationProfileReadV1 {
  listCurrent(capabilityId?: string): Promise<readonly Readonly<ImplementationProfile>[]>;
}

export interface CurrentSourceAdmissionPolicyReadV1 {
  list(): readonly unknown[];
}

type SourceAdmissionPolicyProjectionBaseV1 = Readonly<{
  policyId: string;
  policyVersion: number;
  capabilityId: string;
  capabilityVersion: string;
  implementationProfileId: string;
  implementationProfileVersion: number;
  implementationKey: string;
  inputSchemaId: string;
  outputSchemaId: string;
  allowedCallerProducts: readonly string[];
  maximumRiskClass: ImplementationProfile['maximumRiskClass'];
}>;

export type SourceAdmissionPolicyProjectionV1 =
  | Readonly<
      SourceAdmissionPolicyProjectionBaseV1 & {
        maturityClass: 'PRODUCTION_ADMISSIBLE';
        currentnessRequirements: Readonly<{
          method: 'REQUIRED' | 'NOT_REQUIRED';
          reference: 'REQUIRED' | 'NOT_REQUIRED';
        }>;
      }
    >
  | Readonly<
      SourceAdmissionPolicyProjectionBaseV1 & {
        maturityClass: 'PILOT' | 'FIXTURE_TEST' | 'UNSUPPORTED';
        reason: string;
      }
    >;

export interface CapabilityCognitiveReadProjectionV1 {
  schemaVersion: 1;
  generatedAt: string;
  source: Readonly<{
    domain: 'CAPABILITY_ENGINE';
    authority: 'RUNTIME_CAPABILITY_AND_IMPLEMENTATION_PROFILE_REGISTRIES';
    availability: 'AVAILABLE';
  }>;
  sourceAdmissionPolicySource: Readonly<{
    domain: 'CAPABILITY_ENGINE';
    authority: 'SOURCE_ADMISSION_POLICY_CATALOG';
    availability: 'AVAILABLE';
  }>;
  runtimeCapabilities: readonly Readonly<{
    runtimeCapabilityDefinitionId: string;
    version: number;
    capabilityId: string;
    capabilityVersion: string;
    title: string;
    lineage: Readonly<{
      capabilityId: string;
      domainId?: string;
      skillId?: string;
      actionId?: string;
      invocationId?: string;
    }>;
    canonReference: Readonly<{
      canonId: string;
      canonVersion: string;
      sourceFingerprintSha256: string;
    }>;
    createdAt: string;
  }>[];
  implementationProfiles: readonly Readonly<{
    implementationProfileId: string;
    version: number;
    status: 'APPROVED' | 'RETIRED';
    capabilityId: string;
    capabilityVersion: string;
    kind: ImplementationProfile['kind'];
    implementationKey: string;
    allowedCallerProducts: readonly string[];
    maximumRiskClass: ImplementationProfile['maximumRiskClass'];
    timeoutMs: number;
    maxAttempts: number;
    approvalPolicyVersion: string;
    createdAt: string;
  }>[];
  sourceAdmissionPolicies: readonly SourceAdmissionPolicyProjectionV1[];
  summary: Readonly<{
    runtimeCapabilityCount: number;
    implementationProfileCount: number;
    approvedImplementationProfileCount: number;
    retiredImplementationProfileCount: number;
    sourceAdmissionPolicyCount: number;
    productionAdmissibleSourcePolicyCount: number;
    pilotSourcePolicyCount: number;
    fixtureTestSourcePolicyCount: number;
    unsupportedSourcePolicyCount: number;
  }>;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new CapabilityCognitiveReadError(`${field} is malformed.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const supported = new Set(allowed);
  if (Object.keys(value).some((key) => !supported.has(key)))
    throw new CapabilityCognitiveReadError(`${field} is malformed.`);
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new CapabilityCognitiveReadError(`${field} is malformed.`);
  return value.trim();
}

function optionalText(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : text(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new CapabilityCognitiveReadError(`${field} is malformed.`);
  return Number(value);
}

function canonicalTimestamp(value: unknown, field: string): string {
  const timestamp = text(value, field);
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== timestamp)
    throw new CapabilityCognitiveReadError(`${field} is malformed.`);
  return timestamp;
}

function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new CapabilityCognitiveReadError(`${field} is malformed.`);
  const items = value.map((item, index) => text(item, `${field}[${index}]`, 120));
  if (new Set(items).size !== items.length)
    throw new CapabilityCognitiveReadError(`${field} is malformed.`);
  return Object.freeze([...items].sort((left, right) => left.localeCompare(right)));
}

function riskClass(value: unknown, field: string): ImplementationProfile['maximumRiskClass'] {
  if (typeof value !== 'string' || !RISK_CLASSES.has(value))
    throw new CapabilityCognitiveReadError(`${field} is malformed.`);
  return value as ImplementationProfile['maximumRiskClass'];
}

function currentnessRequirement(
  value: unknown,
  field: string
): 'REQUIRED' | 'NOT_REQUIRED' {
  if (typeof value !== 'string' || !CURRENTNESS_REQUIREMENTS.has(value))
    throw new CapabilityCognitiveReadError(`${field} is malformed.`);
  return value as 'REQUIRED' | 'NOT_REQUIRED';
}

function projectRuntimeCapability(value: Readonly<RuntimeCapabilityDefinition>) {
  const definition = record(value, 'runtimeCapability');
  if (definition.schemaVersion !== 1)
    throw new CapabilityCognitiveReadError('runtimeCapability.schemaVersion is malformed.');
  const runtimeCapabilityDefinitionId = text(
    definition.runtimeCapabilityDefinitionId,
    'runtimeCapability.runtimeCapabilityDefinitionId'
  );
  if (!runtimeCapabilityDefinitionId.startsWith('runtime-capability_'))
    throw new CapabilityCognitiveReadError(
      'runtimeCapability.runtimeCapabilityDefinitionId is malformed.'
    );
  const capabilityId = text(definition.capabilityId, 'runtimeCapability.capabilityId');
  const lineage = record(definition.lineage, 'runtimeCapability.lineage');
  const lineageCapabilityId = text(lineage.capabilityId, 'runtimeCapability.lineage.capabilityId');
  if (lineageCapabilityId !== capabilityId)
    throw new CapabilityCognitiveReadError('runtimeCapability.lineage is inconsistent.');
  const canonReference = record(definition.canonReference, 'runtimeCapability.canonReference');
  const sourceFingerprintSha256 = text(
    canonReference.sourceFingerprintSha256,
    'runtimeCapability.canonReference.sourceFingerprintSha256'
  );
  if (!SHA256.test(sourceFingerprintSha256))
    throw new CapabilityCognitiveReadError('runtimeCapability.canonReference is malformed.');
  if (
    definition.acceptedCanonProjection !== true ||
    definition.createdFromWorkEvidence !== false ||
    definition.createdFromAiOutput !== false
  )
    throw new CapabilityCognitiveReadError('runtimeCapability authority flags are malformed.');

  const domainId = optionalText(lineage.domainId, 'runtimeCapability.lineage.domainId');
  const skillId = optionalText(lineage.skillId, 'runtimeCapability.lineage.skillId');
  const actionId = optionalText(lineage.actionId, 'runtimeCapability.lineage.actionId');
  const invocationId = optionalText(lineage.invocationId, 'runtimeCapability.lineage.invocationId');
  return Object.freeze({
    runtimeCapabilityDefinitionId,
    version: positiveInteger(definition.version, 'runtimeCapability.version'),
    capabilityId,
    capabilityVersion: text(
      definition.capabilityVersion,
      'runtimeCapability.capabilityVersion'
    ),
    title: text(definition.title, 'runtimeCapability.title'),
    lineage: Object.freeze({
      capabilityId,
      ...(domainId ? { domainId } : {}),
      ...(skillId ? { skillId } : {}),
      ...(actionId ? { actionId } : {}),
      ...(invocationId ? { invocationId } : {})
    }),
    canonReference: Object.freeze({
      canonId: text(canonReference.canonId, 'runtimeCapability.canonReference.canonId'),
      canonVersion: text(
        canonReference.canonVersion,
        'runtimeCapability.canonReference.canonVersion'
      ),
      sourceFingerprintSha256
    }),
    createdAt: canonicalTimestamp(definition.createdAt, 'runtimeCapability.createdAt')
  });
}

function projectImplementationProfile(value: Readonly<ImplementationProfile>) {
  if (value.status !== 'APPROVED' && value.status !== 'RETIRED')
    throw new CapabilityCognitiveReadError('implementationProfile.status is malformed.');
  return Object.freeze({
    implementationProfileId: text(
      value.implementationProfileId,
      'implementationProfile.implementationProfileId'
    ),
    version: positiveInteger(value.version, 'implementationProfile.version'),
    status: value.status,
    capabilityId: text(value.capabilityId, 'implementationProfile.capabilityId'),
    capabilityVersion: text(
      value.capabilityVersion,
      'implementationProfile.capabilityVersion'
    ),
    kind: value.kind,
    implementationKey: text(value.implementationKey, 'implementationProfile.implementationKey'),
    allowedCallerProducts: Object.freeze(
      value.allowedCallerProducts.map((item, index) =>
        text(item, `implementationProfile.allowedCallerProducts[${index}]`)
      )
    ),
    maximumRiskClass: value.maximumRiskClass,
    timeoutMs: positiveInteger(value.timeoutMs, 'implementationProfile.timeoutMs'),
    maxAttempts: positiveInteger(value.maxAttempts, 'implementationProfile.maxAttempts'),
    approvalPolicyVersion: text(
      value.approvalPolicyVersion,
      'implementationProfile.approvalPolicyVersion'
    ),
    createdAt: canonicalTimestamp(value.createdAt, 'implementationProfile.createdAt')
  });
}

const COMMON_POLICY_KEYS = [
  'schemaVersion',
  'policyId',
  'policyVersion',
  'maturityClass',
  'capabilityId',
  'capabilityVersion',
  'implementationProfileId',
  'implementationProfileVersion',
  'implementationKey',
  'inputSchemaId',
  'outputSchemaId',
  'allowedCallerProducts',
  'maximumRiskClass'
] as const;

function projectSourceAdmissionPolicy(value: unknown): SourceAdmissionPolicyProjectionV1 {
  const policy = record(value, 'sourceAdmissionPolicy');
  if (policy.schemaVersion !== 1)
    throw new CapabilityCognitiveReadError('sourceAdmissionPolicy.schemaVersion is malformed.');
  if (
    typeof policy.maturityClass !== 'string' ||
    !SOURCE_MATURITY_CLASSES.has(policy.maturityClass)
  )
    throw new CapabilityCognitiveReadError('sourceAdmissionPolicy.maturityClass is malformed.');

  const common = {
    policyId: text(policy.policyId, 'sourceAdmissionPolicy.policyId'),
    policyVersion: positiveInteger(policy.policyVersion, 'sourceAdmissionPolicy.policyVersion'),
    capabilityId: text(policy.capabilityId, 'sourceAdmissionPolicy.capabilityId'),
    capabilityVersion: text(policy.capabilityVersion, 'sourceAdmissionPolicy.capabilityVersion'),
    implementationProfileId: text(
      policy.implementationProfileId,
      'sourceAdmissionPolicy.implementationProfileId'
    ),
    implementationProfileVersion: positiveInteger(
      policy.implementationProfileVersion,
      'sourceAdmissionPolicy.implementationProfileVersion'
    ),
    implementationKey: text(policy.implementationKey, 'sourceAdmissionPolicy.implementationKey'),
    inputSchemaId: text(policy.inputSchemaId, 'sourceAdmissionPolicy.inputSchemaId'),
    outputSchemaId: text(policy.outputSchemaId, 'sourceAdmissionPolicy.outputSchemaId'),
    allowedCallerProducts: stringList(
      policy.allowedCallerProducts,
      'sourceAdmissionPolicy.allowedCallerProducts'
    ),
    maximumRiskClass: riskClass(policy.maximumRiskClass, 'sourceAdmissionPolicy.maximumRiskClass')
  } as const;

  if (policy.maturityClass === 'PRODUCTION_ADMISSIBLE') {
    exactKeys(
      policy,
      [...COMMON_POLICY_KEYS, 'methodCurrentness', 'referenceCurrentness'],
      'sourceAdmissionPolicy'
    );
    return Object.freeze({
      ...common,
      maturityClass: 'PRODUCTION_ADMISSIBLE',
      currentnessRequirements: Object.freeze({
        method: currentnessRequirement(
          policy.methodCurrentness,
          'sourceAdmissionPolicy.methodCurrentness'
        ),
        reference: currentnessRequirement(
          policy.referenceCurrentness,
          'sourceAdmissionPolicy.referenceCurrentness'
        )
      })
    });
  }

  exactKeys(policy, [...COMMON_POLICY_KEYS, 'reason'], 'sourceAdmissionPolicy');
  return Object.freeze({
    ...common,
    maturityClass: policy.maturityClass as 'PILOT' | 'FIXTURE_TEST' | 'UNSUPPORTED',
    reason: text(policy.reason, 'sourceAdmissionPolicy.reason', 1000)
  });
}

export class CapabilityCognitiveReadServiceV1 {
  constructor(
    private readonly runtimeCapabilities: Readonly<CurrentRuntimeCapabilityCatalogReadV1>,
    private readonly implementationProfiles: Readonly<CurrentImplementationProfileReadV1>,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly sourceAdmissionPolicies: Readonly<CurrentSourceAdmissionPolicyReadV1> =
      currentCapabilitySourceAdmissionPolicyCatalogV1
  ) {}

  async read(): Promise<CapabilityCognitiveReadProjectionV1> {
    try {
      const [capabilities, profiles] = await Promise.all([
        this.runtimeCapabilities.listCurrent(),
        this.implementationProfiles.listCurrent()
      ]);
      const runtimeCapabilities = capabilities
        .map((definition) => projectRuntimeCapability(definition))
        .sort((left, right) =>
          left.capabilityId === right.capabilityId
            ? left.version - right.version
            : left.capabilityId.localeCompare(right.capabilityId)
        );
      const implementationProfiles = profiles
        .map((profile) => projectImplementationProfile(profile))
        .sort((left, right) =>
          left.implementationProfileId === right.implementationProfileId
            ? left.version - right.version
            : left.implementationProfileId.localeCompare(right.implementationProfileId)
        );
      const sourceAdmissionPolicies = this.sourceAdmissionPolicies
        .list()
        .map((policy) => projectSourceAdmissionPolicy(policy))
        .sort((left, right) =>
          left.policyId === right.policyId
            ? left.policyVersion - right.policyVersion
            : left.policyId.localeCompare(right.policyId)
        );
      const generatedAt = canonicalTimestamp(this.now(), 'generatedAt');
      return Object.freeze({
        schemaVersion: 1,
        generatedAt,
        source: Object.freeze({
          domain: 'CAPABILITY_ENGINE',
          authority: 'RUNTIME_CAPABILITY_AND_IMPLEMENTATION_PROFILE_REGISTRIES',
          availability: 'AVAILABLE'
        }),
        sourceAdmissionPolicySource: Object.freeze({
          domain: 'CAPABILITY_ENGINE',
          authority: 'SOURCE_ADMISSION_POLICY_CATALOG',
          availability: 'AVAILABLE'
        }),
        runtimeCapabilities: Object.freeze(runtimeCapabilities),
        implementationProfiles: Object.freeze(implementationProfiles),
        sourceAdmissionPolicies: Object.freeze(sourceAdmissionPolicies),
        summary: Object.freeze({
          runtimeCapabilityCount: runtimeCapabilities.length,
          implementationProfileCount: implementationProfiles.length,
          approvedImplementationProfileCount: implementationProfiles.filter(
            (profile) => profile.status === 'APPROVED'
          ).length,
          retiredImplementationProfileCount: implementationProfiles.filter(
            (profile) => profile.status === 'RETIRED'
          ).length,
          sourceAdmissionPolicyCount: sourceAdmissionPolicies.length,
          productionAdmissibleSourcePolicyCount: sourceAdmissionPolicies.filter(
            (policy) => policy.maturityClass === 'PRODUCTION_ADMISSIBLE'
          ).length,
          pilotSourcePolicyCount: sourceAdmissionPolicies.filter(
            (policy) => policy.maturityClass === 'PILOT'
          ).length,
          fixtureTestSourcePolicyCount: sourceAdmissionPolicies.filter(
            (policy) => policy.maturityClass === 'FIXTURE_TEST'
          ).length,
          unsupportedSourcePolicyCount: sourceAdmissionPolicies.filter(
            (policy) => policy.maturityClass === 'UNSUPPORTED'
          ).length
        })
      });
    } catch (error) {
      if (error instanceof CapabilityCognitiveReadError) throw error;
      throw new CapabilityCognitiveReadError(
        'Capability cognitive owner truth is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
