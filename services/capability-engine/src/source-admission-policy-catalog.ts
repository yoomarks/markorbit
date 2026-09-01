import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type {
  CapabilityRiskClass,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import {
  CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION,
  CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE
} from './cn-duration-analytical-pilot.js';
import {
  CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_DEFINITION,
  CN_DURATION_BAND_CLASSIFICATION_IMPLEMENTATION_PROFILE
} from './cn-duration-band-classification-pilot.js';
import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_DEFINITION,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_PROFILE
} from './cn-preliminary-publication-discovery-pilot.js';
import type {
  CapabilitySourceAdmissionPolicyAuthority,
  CapabilitySourceAdmissionPolicyInput,
  CapabilitySourceAdmissionPolicyResult
} from './current-source-admission.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
} from './uspto-official-fee-resolver-pilot.js';

export const capabilitySourceMaturityClasses = [
  'PRODUCTION_ADMISSIBLE',
  'PILOT',
  'FIXTURE_TEST',
  'UNSUPPORTED'
] as const;
export type CapabilitySourceMaturityClass = (typeof capabilitySourceMaturityClasses)[number];

export type CapabilitySourceCurrentnessRequirement = 'REQUIRED' | 'NOT_REQUIRED';

interface CapabilitySourceAdmissionPolicyEntryBaseV1 {
  readonly schemaVersion: 1;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly maturityClass: CapabilitySourceMaturityClass;
  readonly capabilityId: string;
  readonly capabilityVersion: string;
  readonly implementationProfileId: string;
  readonly implementationProfileVersion: number;
  readonly implementationKey: string;
  readonly inputSchemaId: string;
  readonly outputSchemaId: string;
  readonly allowedCallerProducts: readonly string[];
  readonly maximumRiskClass: CapabilityRiskClass;
}

export type CapabilitySourceAdmissionPolicyEntryV1 =
  | Readonly<
      CapabilitySourceAdmissionPolicyEntryBaseV1 & {
        readonly maturityClass: 'PRODUCTION_ADMISSIBLE';
        readonly methodCurrentness: CapabilitySourceCurrentnessRequirement;
        readonly referenceCurrentness: CapabilitySourceCurrentnessRequirement;
      }
    >
  | Readonly<
      CapabilitySourceAdmissionPolicyEntryBaseV1 & {
        readonly maturityClass: 'PILOT' | 'FIXTURE_TEST' | 'UNSUPPORTED';
        readonly reason: string;
      }
    >;

export type CapabilitySourceAdmissionPolicyCatalogErrorCode =
  | 'INVALID_POLICY_ENTRY'
  | 'DUPLICATE_POLICY_ID'
  | 'DUPLICATE_POLICY_BINDING';

export class CapabilitySourceAdmissionPolicyCatalogError extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionPolicyCatalogErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionPolicyCatalogError';
  }
}

const RISK_RANK: Readonly<Record<CapabilityRiskClass, number>> = Object.freeze({
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  PROTECTED: 3
});
const RISK_CLASSES = new Set<CapabilityRiskClass>(['LOW', 'MODERATE', 'HIGH', 'PROTECTED']);

function nonEmptyText(value: unknown, maximum = 500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function invalidEntry(message: string): never {
  throw new CapabilitySourceAdmissionPolicyCatalogError('INVALID_POLICY_ENTRY', message);
}

function policyBindingKey(entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>): string {
  return [
    entry.capabilityId,
    entry.capabilityVersion,
    entry.implementationProfileId,
    entry.implementationProfileVersion
  ].join('|');
}

function cloneEntry(
  entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>
): CapabilitySourceAdmissionPolicyEntryV1 {
  return structuredClone(entry);
}

function validateEntry(
  entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>
): CapabilitySourceAdmissionPolicyEntryV1 {
  if (entry.schemaVersion !== 1) invalidEntry('schemaVersion must be 1.');
  if (!nonEmptyText(entry.policyId)) invalidEntry('policyId is required.');
  if (!positiveInteger(entry.policyVersion)) invalidEntry('policyVersion must be a positive integer.');
  if (!capabilitySourceMaturityClasses.includes(entry.maturityClass))
    invalidEntry('maturityClass is invalid.');
  if (!nonEmptyText(entry.capabilityId)) invalidEntry('capabilityId is required.');
  if (!nonEmptyText(entry.capabilityVersion)) invalidEntry('capabilityVersion is required.');
  if (!nonEmptyText(entry.implementationProfileId))
    invalidEntry('implementationProfileId is required.');
  if (!positiveInteger(entry.implementationProfileVersion))
    invalidEntry('implementationProfileVersion must be a positive integer.');
  if (!nonEmptyText(entry.implementationKey)) invalidEntry('implementationKey is required.');
  if (!nonEmptyText(entry.inputSchemaId)) invalidEntry('inputSchemaId is required.');
  if (!nonEmptyText(entry.outputSchemaId)) invalidEntry('outputSchemaId is required.');
  if (!RISK_CLASSES.has(entry.maximumRiskClass)) invalidEntry('maximumRiskClass is invalid.');
  if (
    !Array.isArray(entry.allowedCallerProducts) ||
    entry.allowedCallerProducts.length === 0 ||
    entry.allowedCallerProducts.some((caller) => !nonEmptyText(caller, 120)) ||
    new Set(entry.allowedCallerProducts).size !== entry.allowedCallerProducts.length
  ) {
    invalidEntry('allowedCallerProducts must contain unique non-empty caller products.');
  }

  if (entry.maturityClass === 'PRODUCTION_ADMISSIBLE') {
    if (entry.allowedCallerProducts.includes('*'))
      invalidEntry('production-admissible policy must bind explicit caller products.');
    if (!['REQUIRED', 'NOT_REQUIRED'].includes(entry.methodCurrentness))
      invalidEntry('methodCurrentness is invalid.');
    if (!['REQUIRED', 'NOT_REQUIRED'].includes(entry.referenceCurrentness))
      invalidEntry('referenceCurrentness is invalid.');
  } else if (!nonEmptyText(entry.reason, 1000)) {
    invalidEntry('non-production policy requires an explicit reason.');
  }

  return Object.freeze(cloneEntry(entry));
}

function policyMatchesCurrentBinding(
  entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>,
  input: Readonly<CapabilitySourceAdmissionPolicyInput>
): boolean {
  return (
    entry.capabilityId === input.currentCapability.capabilityId &&
    entry.capabilityVersion === input.currentCapability.capabilityVersion &&
    entry.implementationProfileId === input.currentImplementation.implementationProfileId &&
    entry.implementationProfileVersion === input.currentImplementation.version &&
    entry.implementationKey === input.currentImplementation.implementationKey &&
    entry.inputSchemaId === input.currentImplementation.inputSchemaId &&
    entry.outputSchemaId === input.currentImplementation.outputSchemaId
  );
}

function requestWithinProductionApplicability(
  entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>,
  input: Readonly<CapabilitySourceAdmissionPolicyInput>
): boolean {
  const request = input.execution.request;
  return (
    request.capabilityId === entry.capabilityId &&
    request.capabilityVersion === entry.capabilityVersion &&
    request.inputSchemaId === entry.inputSchemaId &&
    request.outputSchemaId === entry.outputSchemaId &&
    entry.allowedCallerProducts.includes(request.caller.callerProduct) &&
    RISK_RANK[request.riskClass] <= RISK_RANK[entry.maximumRiskClass]
  );
}

function unsupported(reason: string): CapabilitySourceAdmissionPolicyResult {
  return { applicability: 'UNSUPPORTED', reason };
}

export class CapabilitySourceAdmissionPolicyCatalogV1
  implements CapabilitySourceAdmissionPolicyAuthority
{
  private readonly entries: readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[];
  private readonly byBinding: ReadonlyMap<string, Readonly<CapabilitySourceAdmissionPolicyEntryV1>>;

  constructor(entries: readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[]) {
    const normalized = entries.map(validateEntry);
    const policyIds = new Set<string>();
    const bindings = new Map<string, Readonly<CapabilitySourceAdmissionPolicyEntryV1>>();

    for (const entry of normalized) {
      if (policyIds.has(entry.policyId)) {
        throw new CapabilitySourceAdmissionPolicyCatalogError(
          'DUPLICATE_POLICY_ID',
          `Duplicate Capability source-admission policy id: ${entry.policyId}.`
        );
      }
      policyIds.add(entry.policyId);

      const key = policyBindingKey(entry);
      if (bindings.has(key)) {
        throw new CapabilitySourceAdmissionPolicyCatalogError(
          'DUPLICATE_POLICY_BINDING',
          `Duplicate Capability source-admission policy binding: ${key}.`
        );
      }
      bindings.set(key, entry);
    }

    this.entries = Object.freeze(
      [...normalized].sort((left, right) => left.policyId.localeCompare(right.policyId))
    );
    this.byBinding = bindings;
  }

  list(): readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[] {
    return this.entries.map(cloneEntry);
  }

  evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): CapabilitySourceAdmissionPolicyResult {
    const bindingKey = [
      input.currentCapability.capabilityId,
      input.currentCapability.capabilityVersion,
      input.currentImplementation.implementationProfileId,
      input.currentImplementation.version
    ].join('|');
    const entry = this.byBinding.get(bindingKey);
    if (!entry) {
      return unsupported(
        'No explicit producer source-admission policy exists for the exact current Capability and Implementation Profile binding.'
      );
    }
    if (!policyMatchesCurrentBinding(entry, input)) {
      return unsupported(
        `Source-admission policy ${entry.policyId} does not match the exact current Capability implementation binding.`
      );
    }
    if (entry.maturityClass !== 'PRODUCTION_ADMISSIBLE') {
      return unsupported(
        `Source-admission policy ${entry.policyId} classifies this source as ${entry.maturityClass}: ${entry.reason}`
      );
    }
    if (!requestWithinProductionApplicability(entry, input)) {
      return unsupported(
        `Source-admission policy ${entry.policyId} does not cover this caller, risk class or request schema applicability.`
      );
    }
    return {
      applicability: 'SUPPORTED',
      methodCurrentness: entry.methodCurrentness,
      referenceCurrentness: entry.referenceCurrentness
    };
  }
}

function pilotEntry(
  policyId: string,
  definition: Readonly<RuntimeCapabilityDefinition>,
  profile: Readonly<ImplementationProfile>,
  reason: string
): CapabilitySourceAdmissionPolicyEntryV1 {
  return {
    schemaVersion: 1,
    policyId,
    policyVersion: 1,
    maturityClass: 'PILOT',
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    implementationProfileId: profile.implementationProfileId,
    implementationProfileVersion: profile.version,
    implementationKey: profile.implementationKey,
    inputSchemaId: profile.inputSchemaId,
    outputSchemaId: profile.outputSchemaId,
    allowedCallerProducts: [...profile.allowedCallerProducts],
    maximumRiskClass: profile.maximumRiskClass,
    reason
  };
}

export const currentCapabilitySourceAdmissionPoliciesV1 = Object.freeze([
  pilotEntry(
    'source-admission-policy.cn-duration-analytical.v1',
    CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION,
    CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE,
    'Phase 4 descriptive analytical acceptance is explicitly bounded as a pilot and has not been promoted by production source governance.'
  ),
  pilotEntry(
    'source-admission-policy.cn-duration-band-classification.v1',
    CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_DEFINITION,
    CN_DURATION_BAND_CLASSIFICATION_IMPLEMENTATION_PROFILE,
    'Phase 4 historical-band classification remains a pilot; execution success does not create production source admission.'
  ),
  pilotEntry(
    'source-admission-policy.cn-preliminary-publication-discovery.v1',
    CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_DEFINITION,
    CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_PROFILE,
    'Phase 4 objective fact discovery remains a pilot and is not a production Recommendation source by consequence.'
  ),
  pilotEntry(
    'source-admission-policy.uspto-official-fee-resolver.v1',
    USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
    USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
    'Phase 4 official-fee resolver remains a pilot; official-source provenance does not itself promote the Capability result to a generic production source.'
  )
]);

export const currentCapabilitySourceAdmissionPolicyCatalogV1 =
  new CapabilitySourceAdmissionPolicyCatalogV1(currentCapabilitySourceAdmissionPoliciesV1);
