import type {
  ControlledHandoffId,
  ControlledHandoffValidationDenialReason
} from '@markorbit/contracts/controlled-privacy-handoff';
import type { ProviderWorkIncomingDataAuthorityV1 } from '@markorbit/contracts/provider-work-read-model';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import type { ControlledPrivacyHandoffService } from './controlled-privacy-handoff.js';
import { providerWorkFingerprint } from './provider-work-read-model.js';

export type ProviderWorkIncomingLineage =
  | Readonly<{ mode: 'NONE_EXPLICIT'; lineageFingerprintSha256: string }>
  | Readonly<{
      mode: 'EXACT';
      lineageFingerprintSha256: string;
      handoff: Readonly<{ controlledHandoffId: ControlledHandoffId; version: number }>;
      envelopeFingerprintSha256: string;
      purposeFingerprintSha256: string;
      projectionFingerprintSha256: string;
      sourceSetFingerprintSha256: string;
    }>;

export interface ProviderWorkIncomingAuthorityInput {
  providerId: ProviderId;
  providerWorkspaceId: string;
  originatingWorkspaceId: string;
  allocationId: string;
  correlationId: string;
  checkedAt: string;
  lineage?: ProviderWorkIncomingLineage;
}

export interface ProviderWorkIncomingAuthorityEvaluation {
  authority: ProviderWorkIncomingDataAuthorityV1;
  sourceState: 'CURRENT' | 'KNOWN_ABSENT' | 'UNAVAILABLE';
  sourceReference?: string;
  sourceVersion?: number | string;
  sourceFingerprintSha256?: string;
}

export interface ProviderWorkIncomingAuthoritySource {
  evaluate(input: Readonly<ProviderWorkIncomingAuthorityInput>): Promise<ProviderWorkIncomingAuthorityEvaluation>;
}

export class DefaultProviderWorkIncomingAuthoritySource implements ProviderWorkIncomingAuthoritySource {
  evaluate(input: Readonly<ProviderWorkIncomingAuthorityInput>): Promise<ProviderWorkIncomingAuthorityEvaluation> {
    return Promise.resolve({
      authority: {
        state: 'UNKNOWN',
        checkedAt: input.checkedAt,
        reason: 'AUTHORITY_STATE_NOT_ESTABLISHED',
        incomingFieldsVisible: false,
        embeddedPrivateFieldValues: false
      },
      sourceState: 'UNAVAILABLE'
    });
  }
}

export class ControlledHandoffProviderWorkIncomingAuthoritySource implements ProviderWorkIncomingAuthoritySource {
  constructor(private readonly handoff: ControlledPrivacyHandoffService) {}

  async evaluate(
    input: Readonly<ProviderWorkIncomingAuthorityInput>
  ): Promise<ProviderWorkIncomingAuthorityEvaluation> {
    if (!input.lineage) {
      return {
        authority: {
          state: 'UNKNOWN',
          checkedAt: input.checkedAt,
          reason: 'AUTHORITY_STATE_NOT_ESTABLISHED',
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        },
        sourceState: 'UNAVAILABLE'
      };
    }
    if (input.lineage.mode === 'NONE_EXPLICIT') {
      return {
        authority: {
          state: 'KNOWN_ABSENT',
          checkedAt: input.checkedAt,
          authorityScopeFingerprintSha256: providerWorkFingerprint({
            allocationId: input.allocationId,
            providerId: input.providerId,
            providerWorkspaceId: input.providerWorkspaceId,
            originatingWorkspaceId: input.originatingWorkspaceId,
            explicitAdmissionMode: 'NONE_EXPLICIT',
            lineageFingerprintSha256: input.lineage.lineageFingerprintSha256
          }),
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        },
        sourceState: 'KNOWN_ABSENT',
        sourceReference: `allocation-lineage:${input.allocationId}`,
        sourceVersion: 1,
        sourceFingerprintSha256: input.lineage.lineageFingerprintSha256
      };
    }

    const lineage = input.lineage;
    try {
      const validation = await this.handoff.validateCurrent(
        { workspaceId: input.originatingWorkspaceId },
        {
          envelope: lineage.handoff,
          purpose: 'HANDOFF_CONSUMPTION',
          attempt: {
            originatingWorkspaceId: input.originatingWorkspaceId,
            recipientProviderId: input.providerId,
            recipientProviderWorkspaceId: input.providerWorkspaceId,
            purposeFingerprintSha256: lineage.purposeFingerprintSha256,
            projectionFingerprintSha256: lineage.projectionFingerprintSha256,
            sourceSetFingerprintSha256: lineage.sourceSetFingerprintSha256,
            artifactRetrievalRequested: false,
            attemptedAt: input.checkedAt,
            correlationId: input.correlationId
          }
        }
      );
      const validationFingerprintSha256 = providerWorkFingerprint(validation);
      if (
        validation.decision === 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION' &&
        validation.currentlyUsable === true &&
        validation.currentExactDisclosurePermitted === true
      ) {
        return {
          authority: {
            state: 'CURRENTLY_USABLE',
            handoff: lineage.handoff,
            validationReference: `controlled-handoff-validation:sha256:${validationFingerprintSha256}`,
            validationFingerprintSha256,
            validationPolicyVersion: validation.validationPolicyVersion,
            checkedAt: input.checkedAt,
            currentExactProjectionMayBeResolvedSeparately: true,
            embeddedPrivateFieldValues: false
          },
          sourceState: 'CURRENT',
          sourceReference: lineage.handoff.controlledHandoffId,
          sourceVersion: lineage.handoff.version,
          sourceFingerprintSha256: validationFingerprintSha256
        };
      }
      return this.denied(
        input.checkedAt,
        lineage.handoff,
        validation.denialReason,
        validationFingerprintSha256
      );
    } catch {
      return {
        authority: {
          state: 'SOURCE_UNAVAILABLE',
          checkedAt: input.checkedAt,
          reason: 'DEPENDENCY_UNAVAILABLE',
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        },
        sourceState: 'UNAVAILABLE',
        sourceReference: lineage.handoff.controlledHandoffId,
        sourceVersion: lineage.handoff.version,
        sourceFingerprintSha256: lineage.lineageFingerprintSha256
      };
    }
  }

  private denied(
    checkedAt: string,
    handoff: Readonly<{ controlledHandoffId: ControlledHandoffId; version: number }>,
    denialReason: ControlledHandoffValidationDenialReason,
    fingerprint: string
  ): ProviderWorkIncomingAuthorityEvaluation {
    return {
      authority: {
        state: 'DENIED',
        handoff,
        denialReason,
        checkedAt,
        incomingFieldsVisible: false,
        embeddedPrivateFieldValues: false
      },
      sourceState: 'UNAVAILABLE',
      sourceReference: handoff.controlledHandoffId,
      sourceVersion: handoff.version,
      sourceFingerprintSha256: fingerprint
    };
  }
}