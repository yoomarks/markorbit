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

export interface CapabilitySourceAdmissionPolicyIdentityV1 {
  readonly policyId: string;
  readonly policyVersion: number;
}

export type CapabilitySourceAdmissionPolicyResultWithProvenanceV1 =
  | Readonly<{
      applicability: 'SUPPORTED';
      policy: Readonly<CapabilitySourceAdmissionPolicyIdentityV1>;
      methodCurrentness: 'REQUIRED' | 'NOT_REQUIRED';
      referenceCurrentness: 'REQUIRED' | 'NOT_REQUIRED';
    }>
  | Extract<
      CapabilitySourceAdmissionPolicyResult,
      { applicability: 'UNSUPPORTED' | 'UNAVAILABLE' }
    >;

export interface CapabilitySourceAdmissionPolicyProvenanceAuthorityV1 extends CapabilitySourceAdmissionPolicyAuthority {
  evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ):
    | CapabilitySourceAdmissionPolicyResultWithProvenanceV1
    | Promise<CapabilitySourceAdmissionPolicyResultWithProvenanceV1>;
}

export type CapabilitySourceAdmissionPolicyProvenanceErrorCode =
  'SUPPORTED_POLICY_IDENTITY_NOT_FOUND';

export class CapabilitySourceAdmissionPolicyProvenanceError extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionPolicyProvenanceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionPolicyProvenanceError';
  }
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

function identity(
  entry: Readonly<CapabilitySourceAdmissionPolicyEntryV1>
): Readonly<CapabilitySourceAdmissionPolicyIdentityV1> {
  return Object.freeze({
    policyId: entry.policyId,
    policyVersion: entry.policyVersion
  });
}

export class CapabilitySourceAdmissionPolicyCatalogProvenanceV1 implements CapabilitySourceAdmissionPolicyProvenanceAuthorityV1 {
  constructor(private readonly catalog: Readonly<CapabilitySourceAdmissionPolicyCatalogV1>) {}

  evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): CapabilitySourceAdmissionPolicyResultWithProvenanceV1 {
    const result = this.catalog.evaluate(input);
    if (result.applicability !== 'SUPPORTED') return result;

    const matching = this.catalog.list().filter((entry) => matchesSupportedBinding(entry, input));
    if (matching.length !== 1) {
      throw new CapabilitySourceAdmissionPolicyProvenanceError(
        'SUPPORTED_POLICY_IDENTITY_NOT_FOUND',
        'A supported Capability source-admission result must resolve to exactly one immutable production policy identity.'
      );
    }

    return Object.freeze({
      applicability: 'SUPPORTED',
      policy: identity(matching[0]!),
      methodCurrentness: result.methodCurrentness,
      referenceCurrentness: result.referenceCurrentness
    });
  }
}

export const currentCapabilitySourceAdmissionPolicyProvenanceV1 =
  new CapabilitySourceAdmissionPolicyCatalogProvenanceV1(
    currentCapabilitySourceAdmissionPolicyCatalogV1
  );
