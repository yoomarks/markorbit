import { randomUUID } from 'node:crypto';
import {
  parseExternalCredentialRefV1,
  type ExternalCredentialSecretKindV1
} from '@markorbit/contracts/external-credential';
import type {
  ExternalCredentialResolutionRequestWireV1,
  ResolvedExternalCredentialWireV1
} from '@markorbit/service-kit';
import type { CurrentWorkspaceAuthorityService } from './current-workspace-authority.js';
import {
  ExternalCredentialCryptoError,
  externalCredentialSecretAadV1,
  type ExternalCredentialKeyringV1,
  type ExternalCredentialSecretMaterialV1
} from './external-credential-crypto.js';
import type { ExternalCredentialRepositoryV1 } from './external-credential.js';

export const externalCredentialApprovedUsageV1 =
  'APPROVED_PROVIDER_ADAPTER_AUTHENTICATION' as const;

export type ExternalCredentialResolutionRequestV1 = ExternalCredentialResolutionRequestWireV1;
export type ResolvedExternalCredentialV1 = ResolvedExternalCredentialWireV1;

export type ExternalCredentialResolutionErrorCode =
  | 'INVALID_EXTERNAL_CREDENTIAL_RESOLUTION'
  | 'EXTERNAL_CREDENTIAL_NOT_FOUND'
  | 'EXTERNAL_CREDENTIAL_STALE'
  | 'EXTERNAL_CREDENTIAL_CONTEXT_MISMATCH'
  | 'EXTERNAL_CREDENTIAL_CAPABILITY_DENIED'
  | 'EXTERNAL_CREDENTIAL_GRANTOR_DENIED'
  | 'EXTERNAL_CREDENTIAL_INELIGIBLE'
  | 'EXTERNAL_CREDENTIAL_PROVENANCE_DENIED'
  | 'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE';

export class ExternalCredentialResolutionError extends Error {
  constructor(
    readonly code: ExternalCredentialResolutionErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'ExternalCredentialResolutionError';
  }
}

export type ExternalCredentialResolutionAuditReasonV1 =
  'ALLOWED' | ExternalCredentialResolutionErrorCode;

export interface ExternalCredentialResolutionAuditEventV1 {
  eventId: string;
  credentialBindingId: string;
  workspaceId: string;
  provider: string;
  externalAccountRef: string;
  secretKind: ExternalCredentialSecretKindV1;
  callerService: 'CAPABILITY_ENGINE';
  capabilityId: string;
  capabilityVersion: string;
  implementationProfileId: string;
  implementationProfileVersion: number;
  approvedUsage: typeof externalCredentialApprovedUsageV1;
  correlationId: string;
  outcome: 'ALLOW' | 'DENY';
  reason: ExternalCredentialResolutionAuditReasonV1;
  occurredAt: string;
}

export interface ExternalCredentialResolutionRepositoryV1 extends Pick<
  ExternalCredentialRepositoryV1,
  'findCredential' | 'withCredentialLock'
> {
  recordResolutionAudit(event: Readonly<ExternalCredentialResolutionAuditEventV1>): Promise<void>;
}

export interface ExternalCredentialProvenanceAuthorityV1 {
  assess(
    input: Readonly<{
      capabilityId: string;
      capabilityVersion: string;
      implementationProfileId: string;
      implementationProfileVersion: number;
    }>
  ): Promise<Readonly<{ state: 'CURRENT' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE' }>>;
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || value !== value.trim() || !value || value.length > maximum)
    throw new ExternalCredentialResolutionError(
      'INVALID_EXTERNAL_CREDENTIAL_RESOLUTION',
      `${field} is invalid.`,
      400
    );
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new ExternalCredentialResolutionError(
      'INVALID_EXTERNAL_CREDENTIAL_RESOLUTION',
      `${field} is invalid.`,
      400
    );
  return Number(value);
}

export class ExternalCredentialResolutionServiceV1 {
  private readonly clock: () => Date;

  constructor(
    private readonly options: Readonly<{
      repository: ExternalCredentialResolutionRepositoryV1;
      currentWorkspaceAuthority: Pick<CurrentWorkspaceAuthorityService, 'validate'>;
      provenance: ExternalCredentialProvenanceAuthorityV1;
      keyring: ExternalCredentialKeyringV1;
      clock?: () => Date;
    }>
  ) {
    this.clock = options.clock ?? (() => new Date());
  }

  async resolve(
    request: Readonly<ExternalCredentialResolutionRequestV1>
  ): Promise<Readonly<ResolvedExternalCredentialV1>> {
    const input = this.validateRequest(request);
    return this.options.repository.withCredentialLock(
      input.credential.credentialBindingId,
      async () => {
        try {
          const stored = await this.options.repository.findCredential(
            input.credential.credentialBindingId
          );
          if (!stored)
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_NOT_FOUND',
              'External credential was not found.',
              404
            );
          const binding = stored.binding;
          if (binding.version !== input.credential.version)
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_STALE',
              'External credential reference is stale.',
              409
            );
          if (
            binding.workspaceId !== input.expectedWorkspaceId ||
            binding.provider !== input.expectedProvider ||
            binding.externalAccountRef !== input.expectedExternalAccountRef ||
            binding.secretKind !== input.expectedSecretKind
          )
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_CONTEXT_MISMATCH',
              'External credential context does not match the approved invocation.',
              409
            );
          if (!binding.allowedCapabilityIds.includes(input.requiredCapabilityId))
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_CAPABILITY_DENIED',
              'External credential is not allowed for the required Capability.',
              403
            );
          try {
            await this.options.currentWorkspaceAuthority.validate({
              workspaceId: binding.workspaceId,
              userId: binding.grantor.userId,
              membershipId: binding.grantor.membershipId,
              expectedMembershipVersion: binding.grantor.membershipVersion,
              requiredPermission: 'workspace:manage'
            });
          } catch (error) {
            if ((error as { retryable?: boolean }).retryable)
              throw new ExternalCredentialResolutionError(
                'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
                'External credential authority is unavailable.',
                503,
                true
              );
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_GRANTOR_DENIED',
              'External credential grantor authority is no longer current.',
              409
            );
          }
          if (
            binding.lifecycle !== 'ACTIVE' ||
            (binding.expiresAt && Date.parse(binding.expiresAt) <= this.clock().getTime())
          )
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_INELIGIBLE',
              'External credential is not eligible for resolution.',
              409
            );
          let provenance;
          try {
            provenance = await this.options.provenance.assess({
              capabilityId: input.requiredCapabilityId,
              capabilityVersion: input.requiredCapabilityVersion,
              implementationProfileId: input.implementationProfileId,
              implementationProfileVersion: input.implementationProfileVersion
            });
          } catch {
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
              'Capability provenance authority is unavailable.',
              503,
              true
            );
          }
          if (provenance.state === 'UNAVAILABLE')
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
              'Capability provenance authority is unavailable.',
              503,
              true
            );
          if (provenance.state !== 'CURRENT')
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_PROVENANCE_DENIED',
              'Capability implementation provenance is not current.',
              409
            );
          if (!stored.secret)
            throw new ExternalCredentialResolutionError(
              'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
              'External credential secret is unavailable.',
              503,
              true
            );
          let secret: ExternalCredentialSecretMaterialV1;
          try {
            secret = this.options.keyring.decrypt(
              stored.secret,
              externalCredentialSecretAadV1({
                credentialBindingId: binding.credentialBindingId,
                workspaceId: binding.workspaceId,
                provider: binding.provider,
                secretKind: binding.secretKind,
                secretGeneration: stored.secretGeneration
              })
            );
          } catch (error) {
            if (error instanceof ExternalCredentialCryptoError)
              throw new ExternalCredentialResolutionError(
                'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
                'External credential secret is unavailable.',
                503,
                true
              );
            throw error;
          }
          await this.audit(input, 'ALLOW', 'ALLOWED');
          return Object.freeze({
            schemaVersion: 1 as const,
            credentialBindingId: binding.credentialBindingId,
            bindingVersion: binding.version,
            secret: Object.freeze(secret),
            createsProviderSelectionAuthority: false as const,
            createsImplementationSelectionAuthority: false as const,
            createsExecutionAuthority: false as const,
            authorizesProtectedAction: false as const
          });
        } catch (error) {
          const safe =
            error instanceof ExternalCredentialResolutionError
              ? error
              : new ExternalCredentialResolutionError(
                  'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
                  'External credential owner is unavailable.',
                  503,
                  true
                );
          await this.audit(input, 'DENY', safe.code);
          throw safe;
        }
      }
    );
  }

  private validateRequest(
    request: Readonly<ExternalCredentialResolutionRequestV1>
  ): ExternalCredentialResolutionRequestV1 {
    let credential;
    try {
      credential = parseExternalCredentialRefV1(request.credential);
    } catch {
      throw new ExternalCredentialResolutionError(
        'INVALID_EXTERNAL_CREDENTIAL_RESOLUTION',
        'credential is invalid.',
        400
      );
    }
    if (!['API_KEY', 'STATIC_BEARER', 'BASIC'].includes(request.expectedSecretKind))
      throw new ExternalCredentialResolutionError(
        'INVALID_EXTERNAL_CREDENTIAL_RESOLUTION',
        'expectedSecretKind is invalid.',
        400
      );
    if (request.approvedUsage !== externalCredentialApprovedUsageV1)
      throw new ExternalCredentialResolutionError(
        'INVALID_EXTERNAL_CREDENTIAL_RESOLUTION',
        'approvedUsage is invalid.',
        400
      );
    if (request.callerService !== 'CAPABILITY_ENGINE')
      throw new ExternalCredentialResolutionError(
        'INVALID_EXTERNAL_CREDENTIAL_RESOLUTION',
        'callerService is invalid.',
        400
      );
    const expectedWorkspaceId = text(
      request.expectedWorkspaceId,
      'expectedWorkspaceId'
    ).toLowerCase();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(expectedWorkspaceId)
    )
      throw new ExternalCredentialResolutionError(
        'INVALID_EXTERNAL_CREDENTIAL_RESOLUTION',
        'expectedWorkspaceId is invalid.',
        400
      );
    return Object.freeze({
      callerService: 'CAPABILITY_ENGINE' as const,
      credential,
      expectedWorkspaceId,
      expectedProvider: text(request.expectedProvider, 'expectedProvider', 120),
      expectedExternalAccountRef: text(
        request.expectedExternalAccountRef,
        'expectedExternalAccountRef'
      ),
      expectedSecretKind: request.expectedSecretKind,
      requiredCapabilityId: text(request.requiredCapabilityId, 'requiredCapabilityId', 200),
      requiredCapabilityVersion: text(
        request.requiredCapabilityVersion,
        'requiredCapabilityVersion',
        120
      ),
      implementationProfileId: text(
        request.implementationProfileId,
        'implementationProfileId',
        240
      ),
      implementationProfileVersion: positiveInteger(
        request.implementationProfileVersion,
        'implementationProfileVersion'
      ),
      correlationId: text(request.correlationId, 'correlationId', 240),
      approvedUsage: externalCredentialApprovedUsageV1
    });
  }

  private audit(
    input: Readonly<ExternalCredentialResolutionRequestV1>,
    outcome: 'ALLOW' | 'DENY',
    reason: ExternalCredentialResolutionAuditReasonV1
  ): Promise<void> {
    return this.options.repository.recordResolutionAudit({
      eventId: `external-credential-resolution-audit_${randomUUID()}`,
      credentialBindingId: input.credential.credentialBindingId,
      workspaceId: input.expectedWorkspaceId,
      provider: input.expectedProvider,
      externalAccountRef: input.expectedExternalAccountRef,
      secretKind: input.expectedSecretKind,
      callerService: input.callerService,
      capabilityId: input.requiredCapabilityId,
      capabilityVersion: input.requiredCapabilityVersion,
      implementationProfileId: input.implementationProfileId,
      implementationProfileVersion: input.implementationProfileVersion,
      approvedUsage: input.approvedUsage,
      correlationId: input.correlationId,
      outcome,
      reason,
      occurredAt: this.clock().toISOString()
    });
  }
}
