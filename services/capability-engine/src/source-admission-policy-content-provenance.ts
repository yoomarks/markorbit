import { canonicalJsonSha256V1 } from './capability-source-output-identity.js';
import type {
  CapabilitySourceAdmissionPolicyAuthority,
  CapabilitySourceAdmissionPolicyInput,
  CapabilitySourceAdmissionPolicyResult
} from './current-source-admission.js';
import {
  currentCapabilitySourceAdmissionPolicyCatalogV1,
  type CapabilitySourceAdmissionPolicyCatalogV1,
  type CapabilitySourceAdmissionPolicyEntryV1
} from './source-admission-policy-catalog.js';

const SHA256 = /^[0-9a-f]{64}$/;

export interface CapabilitySourceAdmissionPolicyContentIdentityV1 {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly policyFingerprintSha256: string;
}

export type CapabilitySourceAdmissionPolicyResultWithContentProvenanceV1 =
  | Readonly<{
      applicability: 'SUPPORTED';
      policy: Readonly<CapabilitySourceAdmissionPolicyContentIdentityV1>;
      methodCurrentness: 'REQUIRED' | 'NOT_REQUIRED';
      referenceCurrentness: 'REQUIRED' | 'NOT_REQUIRED';
    }>
  | Extract<
      CapabilitySourceAdmissionPolicyResult,
      { applicability: 'UNSUPPORTED' | 'UNAVAILABLE' }
    >;

export interface CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1 extends CapabilitySourceAdmissionPolicyAuthority {
  evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ):
    | CapabilitySourceAdmissionPolicyResultWithContentProvenanceV1
    | Promise<CapabilitySourceAdmissionPolicyResultWithContentProvenanceV1>;
}

export type CapabilitySourceAdmissionPolicyContentProvenanceErrorCode =
  'SUPPORTED_POLICY_CONTENT_IDENTITY_NOT_FOUND';

export class CapabilitySourceAdmissionPolicyContentProvenanceError extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionPolicyContentProvenanceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionPolicyContentProvenanceError';
  }
}

function nonEmptyText(value: unknown, maximum = 500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export function validCapabilitySourceAdmissionPolicyContentIdentityV1(
  value: unknown
): value is CapabilitySourceAdmissionPolicyContentIdentityV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const identity = value as Record<string, unknown>;
  return (
    nonEmptyText(identity.policyId) &&
    positiveInteger(identity.policyVersion) &&
    typeof identity.policyFingerprintSha256 === 'string' &&
    SHA256.test(identity.policyFingerprintSha256)
  );
}

function policyContentBasis(entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>) {
  const common = {
    schemaVersion: entry.schemaVersion,
    policyId: entry.policyId,
    policyVersion: entry.policyVersion,
    maturityClass: entry.maturityClass,
    capabilityId: entry.capabilityId,
    capabilityVersion: entry.capabilityVersion,
    implementationProfileId: entry.implementationProfileId,
    implementationProfileVersion: entry.implementationProfileVersion,
    implementationKey: entry.implementationKey,
    inputSchemaId: entry.inputSchemaId,
    outputSchemaId: entry.outputSchemaId,
    allowedCallerProducts: [...entry.allowedCallerProducts].sort((left, right) =>
      left.localeCompare(right)
    ),
    maximumRiskClass: entry.maximumRiskClass
  };

  return entry.maturityClass === 'PRODUCTION_ADMISSIBLE'
    ? {
        ...common,
        methodCurrentness: entry.methodCurrentness,
        referenceCurrentness: entry.referenceCurrentness
      }
    : { ...common, reason: entry.reason };
}

export function capabilitySourceAdmissionPolicyFingerprintV1(
  entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>
): string {
  return canonicalJsonSha256V1(policyContentBasis(entry));
}

export function materializeCapabilitySourceAdmissionPolicyContentIdentityV1(
  entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>
): Readonly<CapabilitySourceAdmissionPolicyContentIdentityV1> {
  return Object.freeze({
    policyId: entry.policyId,
    policyVersion: entry.policyVersion,
    policyFingerprintSha256: capabilitySourceAdmissionPolicyFingerprintV1(entry)
  });
}

function matchesSupportedBinding(
  entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>,
  input: Readonly<CapabilitySourceAdmissionPolicyInput>
): boolean {
  return (
    entry.maturityClass === 'PRODUCTION_ADMISSIBLE' &&
    entry.capabilityId === input.currentCapability.capabilityId &&
    entry.capabilityVersion === input.currentCapability.capabilityVersion &&
    entry.implementationProfileId === input.currentImplementation.implementationProfileId &&
    entry.implementationProfileVersion === input.currentImplementation.version &&
    entry.implementationKey === input.currentImplementation.implementationKey &&
    entry.inputSchemaId === input.currentImplementation.inputSchemaId &&
    entry.outputSchemaId === input.currentImplementation.outputSchemaId
  );
}

export class CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1 implements CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1 {
  constructor(private readonly catalog: Readonly<CapabilitySourceAdmissionPolicyCatalogV1>) {}

  evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): CapabilitySourceAdmissionPolicyResultWithContentProvenanceV1 {
    const result = this.catalog.evaluate(input);
    if (result.applicability !== 'SUPPORTED') return result;

    const matching = this.catalog.list().filter((entry) => matchesSupportedBinding(entry, input));
    if (matching.length !== 1) {
      throw new CapabilitySourceAdmissionPolicyContentProvenanceError(
        'SUPPORTED_POLICY_CONTENT_IDENTITY_NOT_FOUND',
        'A supported Capability source-admission result must resolve to exactly one content-addressed production policy identity.'
      );
    }

    return Object.freeze({
      applicability: 'SUPPORTED',
      policy: materializeCapabilitySourceAdmissionPolicyContentIdentityV1(matching[0]!),
      methodCurrentness: result.methodCurrentness,
      referenceCurrentness: result.referenceCurrentness
    });
  }
}

export const currentCapabilitySourceAdmissionPolicyContentProvenanceV1 =
  new CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1(
    currentCapabilitySourceAdmissionPolicyCatalogV1
  );
