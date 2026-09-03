import { CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1 } from './current-source-admission-evidence-v5.js';
import type {
  CurrentImplementationProfileAuthority,
  CurrentRuntimeCapabilityAuthority
} from './current-source-admission.js';
import {
  CurrentCapabilityProductionSourceEvidenceAuthorityV1,
  type CapabilityProductionSourceEvidenceAuthorityResolutionV1,
  type CapabilityProductionSourceEvidenceAuthorityV1
} from './production-source-evidence-read.js';
import { CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1 } from './source-admission-policy-content-provenance.js';
import { UsptoOfficialFeeMethodCurrentnessAuthorityV1 } from './uspto-official-fee-method-currentness.js';
import { currentApprovedUsptoOfficialFeeMethodActivationAuthorityV1 } from './uspto-official-fee-production-promotion.js';
import { promotedCapabilitySourceAdmissionPolicyCatalogV2 } from './uspto-official-fee-production-policy.js';
import { UsptoOfficialFeeReferenceCurrentnessAuthorityV1 } from './uspto-official-fee-reference-currentness.js';
import type { OfficialFeeReferenceReaderV1 } from './uspto-official-fee-resolver-pilot.js';
import { UsptoOfficialFeeSourceUseContextAuthorityV1 } from './uspto-official-fee-source-use.js';
import type { CapabilityRuntimeExecution } from './capability-runtime.js';

export interface UsptoOfficialFeeProductionSourceEvidenceAuthorityOptionsV1 {
  readonly capabilities: Readonly<CurrentRuntimeCapabilityAuthority>;
  readonly implementations: Readonly<CurrentImplementationProfileAuthority>;
  readonly references: Readonly<OfficialFeeReferenceReaderV1>;
  readonly now?: () => string;
}

/**
 * Producer-owned composition for the only current live PRODUCTION_ADMISSIBLE source family.
 * The controlled Official Fee Reference reader is injected so Capability does not become
 * a second fee store and does not import Core service implementation details.
 */
export class UsptoOfficialFeeProductionSourceEvidenceAuthorityV1 implements CapabilityProductionSourceEvidenceAuthorityV1 {
  private readonly now: () => string;

  constructor(
    private readonly options: Readonly<UsptoOfficialFeeProductionSourceEvidenceAuthorityOptionsV1>
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async evaluate(
    execution: Readonly<CapabilityRuntimeExecution>
  ): Promise<CapabilityProductionSourceEvidenceAuthorityResolutionV1> {
    let evaluatedAt: string;
    try {
      evaluatedAt = this.now();
    } catch {
      return {
        status: 'UNAVAILABLE',
        retryable: true,
        denial: {
          code: 'CURRENTNESS_CLOCK_UNAVAILABLE',
          reason: 'Current USPTO production source evaluation time is unavailable.'
        }
      };
    }
    if (
      !evaluatedAt ||
      Number.isNaN(Date.parse(evaluatedAt)) ||
      new Date(Date.parse(evaluatedAt)).toISOString() !== evaluatedAt
    ) {
      return {
        status: 'UNAVAILABLE',
        retryable: false,
        denial: {
          code: 'INVALID_CURRENTNESS_CLOCK',
          reason: 'Current USPTO production source evaluation time must be an exact ISO instant.'
        }
      };
    }
    const fixedNow = () => evaluatedAt;
    const methodCurrentness = new UsptoOfficialFeeMethodCurrentnessAuthorityV1({
      activation: currentApprovedUsptoOfficialFeeMethodActivationAuthorityV1
    });
    const referenceCurrentness = new UsptoOfficialFeeReferenceCurrentnessAuthorityV1({
      references: this.options.references,
      now: fixedNow
    });
    const evaluator = new CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1({
      admission: {
        capabilities: this.options.capabilities,
        implementations: this.options.implementations,
        methodCurrentness,
        referenceCurrentness
      },
      policy: new CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1(
        promotedCapabilitySourceAdmissionPolicyCatalogV2
      )
    });
    return new CurrentCapabilityProductionSourceEvidenceAuthorityV1({
      evaluator,
      sourceUse: new UsptoOfficialFeeSourceUseContextAuthorityV1(),
      now: fixedNow
    }).evaluate(execution);
  }
}

export function createUsptoOfficialFeeProductionSourceEvidenceAuthorityV1(
  options: Readonly<UsptoOfficialFeeProductionSourceEvidenceAuthorityOptionsV1>
): UsptoOfficialFeeProductionSourceEvidenceAuthorityV1 {
  return new UsptoOfficialFeeProductionSourceEvidenceAuthorityV1(options);
}
