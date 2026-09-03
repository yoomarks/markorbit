import { isDeepStrictEqual } from 'node:util';

import type {
  CapabilityReferenceCurrentnessAuthority,
  CapabilityReferenceCurrentnessResult,
  CapabilitySourceAdmissionPolicyInput
} from './current-source-admission.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
  USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
  parseUsptoOfficialFeeResolverInputV1,
  parseUsptoOfficialFeeResolverReferenceV1,
  validateUsptoOfficialFeeResolverOutputV1,
  type OfficialFeeReferenceReaderV1,
  type UsptoOfficialFeeResolverOutputV1,
  type UsptoOfficialFeeResolverReferenceV1
} from './uspto-official-fee-resolver-pilot.js';

export interface UsptoOfficialFeeReferenceCurrentnessOptionsV1 {
  readonly references: Readonly<OfficialFeeReferenceReaderV1>;
  readonly now: () => string;
}

function unsupported(reason: string): CapabilityReferenceCurrentnessResult {
  return { status: 'UNSUPPORTED_APPLICABILITY', reason };
}

function unavailable(reason: string): CapabilityReferenceCurrentnessResult {
  return { status: 'UNAVAILABLE', reason };
}

function notCurrent(reason: string): CapabilityReferenceCurrentnessResult {
  return { status: 'NOT_CURRENT', reason };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value === value.trim() &&
    !Number.isNaN(Date.parse(value))
  );
}

function exactApplicability(input: Readonly<CapabilitySourceAdmissionPolicyInput>): boolean {
  const capability = input.currentCapability;
  const implementation = input.currentImplementation;
  const request = input.execution.request;
  if (
    capability.runtimeCapabilityDefinitionId !==
      USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.runtimeCapabilityDefinitionId ||
    capability.version !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.version ||
    capability.capabilityId !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID ||
    capability.capabilityVersion !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION ||
    capability.acceptedCanonProjection !== true ||
    capability.createdFromWorkEvidence !== false ||
    capability.createdFromAiOutput !== false ||
    implementation.implementationProfileId !==
      USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId ||
    implementation.version !== USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.version ||
    implementation.implementationKey !==
      USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationKey ||
    implementation.status !== 'APPROVED' ||
    implementation.capabilityId !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID ||
    implementation.capabilityVersion !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION ||
    implementation.inputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA ||
    implementation.outputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA ||
    request.capabilityId !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID ||
    request.capabilityVersion !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION ||
    request.inputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA ||
    request.outputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA
  ) {
    return false;
  }
  try {
    parseUsptoOfficialFeeResolverInputV1(request.input);
    return true;
  } catch {
    return false;
  }
}

function historicalOutput(
  input: Readonly<CapabilitySourceAdmissionPolicyInput>
): Readonly<UsptoOfficialFeeResolverOutputV1> | undefined {
  const outcome = input.execution.outcome.output;
  const returned = input.execution.returnValue.output;
  if (
    !validateUsptoOfficialFeeResolverOutputV1(outcome) ||
    !validateUsptoOfficialFeeResolverOutputV1(returned) ||
    !isDeepStrictEqual(outcome, returned)
  ) {
    return undefined;
  }
  return returned as UsptoOfficialFeeResolverOutputV1;
}

function historicalEvidenceComplete(
  output: Readonly<UsptoOfficialFeeResolverOutputV1>,
  evidenceRefs: readonly string[]
): boolean {
  const reference = output.reference;
  return [
    `official-fee-reference:${reference.referenceId}`,
    `official-fee-source-identity-sha256:${reference.sourceIdentityFingerprintSha256}`,
    `official-fee-replay-identity-sha256:${reference.replayIdentityFingerprintSha256}`,
    `official-fee-materialization-sha256:${reference.materializationFingerprintSha256}`
  ].every((evidenceRef) => evidenceRefs.includes(evidenceRef));
}

function currentEnvelope(value: unknown): Readonly<{ referenceId: string }> | undefined {
  const reference = record(value);
  if (
    !reference ||
    reference.operation !== USPTO_OFFICIAL_FEE_RESOLVER_OPERATION ||
    reference.jurisdiction !== 'US' ||
    reference.authority !== 'USPTO' ||
    reference.status !== 'CURRENT' ||
    typeof reference.referenceId !== 'string' ||
    reference.referenceId.trim().length === 0 ||
    reference.referenceId !== reference.referenceId.trim()
  ) {
    return undefined;
  }
  return { referenceId: reference.referenceId };
}

function sameAcceptedReference(
  current: Readonly<UsptoOfficialFeeResolverReferenceV1>,
  historical: Readonly<UsptoOfficialFeeResolverOutputV1>['reference']
): boolean {
  return (
    current.referenceId === historical.referenceId &&
    current.currency === historical.currency &&
    current.amountMinor === historical.amountMinor &&
    current.unit === historical.unit &&
    current.effectiveFrom === historical.effectiveFrom &&
    current.packageId === historical.packageId &&
    current.methodId === historical.methodId &&
    current.methodVersionId === historical.methodVersionId &&
    current.sourceIdentityFingerprintSha256 === historical.sourceIdentityFingerprintSha256 &&
    current.materializationFingerprintSha256 === historical.materializationFingerprintSha256
  );
}

export class UsptoOfficialFeeReferenceCurrentnessAuthorityV1 implements CapabilityReferenceCurrentnessAuthority {
  constructor(private readonly options: Readonly<UsptoOfficialFeeReferenceCurrentnessOptionsV1>) {}

  async evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): Promise<CapabilityReferenceCurrentnessResult> {
    if (!exactApplicability(input)) {
      return unsupported(
        'USPTO official-fee reference currentness only applies to the exact accepted Resolver Capability and Implementation Profile binding.'
      );
    }

    const historical = historicalOutput(input);
    if (
      !historical ||
      !historicalEvidenceComplete(historical, input.execution.receipt.evidenceRefs)
    ) {
      return notCurrent(
        'Historical USPTO official-fee output or exact reference evidence is missing or inconsistent.'
      );
    }

    let checkedAt: string;
    try {
      checkedAt = this.options.now();
    } catch {
      return unavailable('Current USPTO official-fee reference evaluation time is unavailable.');
    }
    if (!validInstant(checkedAt)) {
      return unavailable('Current USPTO official-fee reference evaluation time is invalid.');
    }

    let currentValue: unknown;
    try {
      currentValue = await this.options.references.resolveCurrent({
        operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
        jurisdiction: 'US',
        authority: 'USPTO',
        asOf: checkedAt
      });
    } catch {
      return unavailable('Controlled USPTO Official Fee Reference Store is unavailable.');
    }

    const envelope = currentEnvelope(currentValue);
    if (!envelope) {
      return unavailable(
        'Controlled USPTO Official Fee Reference Store did not return one current in-scope reference.'
      );
    }
    if (envelope.referenceId !== historical.reference.referenceId) {
      return notCurrent(
        'The historical USPTO official-fee reference has been superseded by a different current reference.'
      );
    }

    let current: UsptoOfficialFeeResolverReferenceV1;
    try {
      current = parseUsptoOfficialFeeResolverReferenceV1(currentValue);
    } catch {
      return unavailable(
        'The current USPTO official-fee reference no longer matches the accepted Resolver source identity.'
      );
    }
    if (!sameAcceptedReference(current, historical.reference)) {
      return notCurrent(
        'The current USPTO official-fee reference does not match the exact historical source materialization.'
      );
    }

    return {
      status: 'CURRENT',
      references: [
        {
          evidenceRef: `official-fee-reference:${current.referenceId}`,
          sourceId: current.referenceId,
          sourceVersion: current.materializedAt,
          sourceFingerprintSha256: current.materializationFingerprintSha256
        }
      ]
    };
  }
}
