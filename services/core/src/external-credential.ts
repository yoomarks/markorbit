import { randomUUID } from 'node:crypto';
import {
  noExternalCredentialAuthorityConsequencesV1,
  parseExternalCredentialBindingV1,
  parseExternalCredentialRefV1,
  type ExternalCredentialBindingV1,
  type ExternalCredentialLifecycleV1,
  type ExternalCredentialRefV1,
  type ExternalCredentialSecretKindV1,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { CurrentWorkspaceAuthorityService } from './current-workspace-authority.js';
import {
  ExternalCredentialCryptoError,
  externalCredentialSecretAadV1,
  type EncryptedExternalCredentialSecretV1,
  type ExternalCredentialKeyringV1,
  type ExternalCredentialSecretMaterialV1
} from './external-credential-crypto.js';

export type ExternalCredentialErrorCode =
  | 'INVALID_EXTERNAL_CREDENTIAL_REQUEST'
  | 'EXTERNAL_CREDENTIAL_NOT_FOUND'
  | 'EXTERNAL_CREDENTIAL_STALE'
  | 'EXTERNAL_CREDENTIAL_WORKSPACE_MISMATCH'
  | 'EXTERNAL_CREDENTIAL_PROVIDER_MISMATCH'
  | 'EXTERNAL_CREDENTIAL_ACCOUNT_MISMATCH'
  | 'EXTERNAL_CREDENTIAL_KIND_MISMATCH'
  | 'EXTERNAL_CREDENTIAL_CAPABILITY_DENIED'
  | 'EXTERNAL_CREDENTIAL_INELIGIBLE'
  | 'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE';

export class ExternalCredentialError extends Error {
  constructor(
    readonly code: ExternalCredentialErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ExternalCredentialError';
  }
}

export type ExternalCredentialAuditActionV1 =
  'CREATED' | 'ROTATED' | 'EXPIRED' | 'REAUTH_REQUIRED' | 'REVOKED' | 'KEY_REWRAPPED';
export interface ExternalCredentialAuditEventV1 {
  eventId: string;
  credentialBindingId: string;
  workspaceId: string;
  provider: string;
  externalAccountRef: string;
  secretKind: ExternalCredentialSecretKindV1;
  action: ExternalCredentialAuditActionV1;
  fromVersion?: number;
  toVersion: number;
  actorUserId?: string;
  actorMembershipId?: string;
  occurredAt: string;
}
export interface ExternalCredentialStoredV1 {
  binding: Readonly<ExternalCredentialBindingV1>;
  secretGeneration: number;
  secret?: Readonly<EncryptedExternalCredentialSecretV1>;
}
export interface ExternalCredentialRepositoryV1 {
  createCredential(
    stored: Readonly<ExternalCredentialStoredV1>,
    event: Readonly<ExternalCredentialAuditEventV1>
  ): Promise<Readonly<ExternalCredentialBindingV1>>;
  findCredential(id: string): Promise<Readonly<ExternalCredentialStoredV1> | undefined>;
  withCredentialLock<T>(id: string, callback: () => Promise<T>): Promise<T>;
  rotateCredential(
    input: Readonly<{
      credential: Readonly<ExternalCredentialRefV1>;
      nextBinding: Readonly<ExternalCredentialBindingV1>;
      expectedSecretGeneration: number;
      nextSecret: Readonly<EncryptedExternalCredentialSecretV1>;
      event: Readonly<ExternalCredentialAuditEventV1>;
    }>
  ): Promise<Readonly<ExternalCredentialStoredV1>>;
  transitionLifecycle(
    input: Readonly<{
      credential: Readonly<ExternalCredentialRefV1>;
      lifecycle: Exclude<ExternalCredentialLifecycleV1, 'ACTIVE'>;
      at: string;
      event: Readonly<ExternalCredentialAuditEventV1>;
    }>
  ): Promise<Readonly<ExternalCredentialBindingV1>>;
  rewrapSecret(
    input: Readonly<{
      credentialBindingId: string;
      expectedSecretGeneration: number;
      nextSecret: Readonly<EncryptedExternalCredentialSecretV1>;
      at: string;
      event: Readonly<ExternalCredentialAuditEventV1>;
    }>
  ): Promise<number>;
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new ExternalCredentialError(
      'INVALID_EXTERNAL_CREDENTIAL_REQUEST',
      `${field} is invalid.`,
      400
    );
  return value.trim();
}
function timestamp(value: unknown, field: string): string {
  const normalized = text(value, field, 80);
  if (!Number.isFinite(Date.parse(normalized)))
    throw new ExternalCredentialError(
      'INVALID_EXTERNAL_CREDENTIAL_REQUEST',
      `${field} is invalid.`,
      400
    );
  return new Date(normalized).toISOString();
}
function capabilityIds(value: readonly string[]): readonly string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new ExternalCredentialError(
      'INVALID_EXTERNAL_CREDENTIAL_REQUEST',
      'allowedCapabilityIds must be non-empty.',
      400
    );
  const normalized = value.map((entry) => text(entry, 'allowedCapabilityId', 200));
  if (new Set(normalized).size !== normalized.length)
    throw new ExternalCredentialError(
      'INVALID_EXTERNAL_CREDENTIAL_REQUEST',
      'allowedCapabilityIds must not contain duplicates.',
      400
    );
  return Object.freeze(normalized);
}
function materialKind(
  value: Readonly<ExternalCredentialSecretMaterialV1>
): ExternalCredentialSecretKindV1 {
  return value.kind;
}

export interface ExternalCredentialServiceOptionsV1 {
  repository: ExternalCredentialRepositoryV1;
  currentWorkspaceAuthority: Pick<CurrentWorkspaceAuthorityService, 'validate'>;
  keyring: ExternalCredentialKeyringV1;
  clock?: () => Date;
}

export class ExternalCredentialServiceV1 {
  private readonly clock: () => Date;
  constructor(private readonly options: ExternalCredentialServiceOptionsV1) {
    this.clock = options.clock ?? (() => new Date());
  }

  async createCredential(
    principal: Readonly<WorkspacePrincipal>,
    input: Readonly<{
      provider: string;
      externalAccountRef: string;
      secretKind: ExternalCredentialSecretKindV1;
      allowedCapabilityIds: readonly string[];
      expiresAt?: string;
      secret: Readonly<ExternalCredentialSecretMaterialV1>;
    }>
  ): Promise<Readonly<ExternalCredentialBindingV1>> {
    const authority = await this.requireManagementAuthority(principal);
    const provider = text(input.provider, 'provider', 120);
    const externalAccountRef = text(input.externalAccountRef, 'externalAccountRef');
    if (materialKind(input.secret) !== input.secretKind)
      throw new ExternalCredentialError(
        'EXTERNAL_CREDENTIAL_KIND_MISMATCH',
        'External credential secret kind does not match its safe binding.',
        400
      );
    const now = this.clock().toISOString();
    const expiresAt =
      input.expiresAt === undefined ? undefined : timestamp(input.expiresAt, 'expiresAt');
    if (expiresAt && Date.parse(expiresAt) <= this.clock().getTime())
      throw new ExternalCredentialError(
        'INVALID_EXTERNAL_CREDENTIAL_REQUEST',
        'External credential expiry must be in the future.',
        400
      );
    const credentialBindingId = `external-credential-binding_${randomUUID()}` as const;
    const binding = parseExternalCredentialBindingV1({
      schemaVersion: 1,
      credentialBindingId,
      version: 1,
      workspaceId: principal.workspaceId,
      provider,
      externalAccountRef,
      secretKind: input.secretKind,
      allowedCapabilityIds: capabilityIds(input.allowedCapabilityIds),
      grantor: {
        userId: principal.userId,
        membershipId: principal.membershipId,
        membershipVersion: authority.membership.version
      },
      lifecycle: 'ACTIVE',
      ...(expiresAt ? { expiresAt } : {}),
      createdAt: now,
      updatedAt: now,
      authority: noExternalCredentialAuthorityConsequencesV1
    });
    const secretGeneration = 1;
    const secret = this.options.keyring.encrypt(
      input.secret,
      externalCredentialSecretAadV1({
        credentialBindingId,
        workspaceId: binding.workspaceId,
        provider,
        secretKind: binding.secretKind,
        secretGeneration
      })
    );
    return this.options.repository.createCredential(
      { binding, secretGeneration, secret },
      this.audit(binding, 'CREATED', now, undefined, principal)
    );
  }

  async readCredential(
    principal: Readonly<WorkspacePrincipal>,
    credential: Readonly<ExternalCredentialRefV1>
  ): Promise<Readonly<ExternalCredentialBindingV1>> {
    const ref = parseExternalCredentialRefV1(credential);
    const stored = await this.required(ref.credentialBindingId);
    this.assertExact(stored.binding, ref);
    if (principal.kind !== 'WORKSPACE' || stored.binding.workspaceId !== principal.workspaceId)
      throw new ExternalCredentialError(
        'EXTERNAL_CREDENTIAL_WORKSPACE_MISMATCH',
        'External credential does not belong to the expected Workspace.',
        403
      );
    await this.options.currentWorkspaceAuthority.validate({
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      requiredPermission: 'workspace:read'
    });
    return stored.binding;
  }

  async rotateCredential(
    principal: Readonly<WorkspacePrincipal>,
    credential: Readonly<ExternalCredentialRefV1>,
    input: Readonly<{ secret: Readonly<ExternalCredentialSecretMaterialV1>; expiresAt?: string }>
  ): Promise<Readonly<ExternalCredentialBindingV1>> {
    const ref = parseExternalCredentialRefV1(credential);
    return this.options.repository.withCredentialLock(ref.credentialBindingId, async () => {
      const stored = await this.required(ref.credentialBindingId);
      this.assertExact(stored.binding, ref);
      if (stored.binding.lifecycle !== 'ACTIVE')
        throw new ExternalCredentialError(
          'EXTERNAL_CREDENTIAL_INELIGIBLE',
          'Only an ACTIVE external credential can be rotated.',
          409
        );
      if (!stored.secret)
        throw new ExternalCredentialError(
          'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
          'External credential secret lineage is unavailable.',
          503,
          true
        );
      if (principal.kind !== 'WORKSPACE' || principal.workspaceId !== stored.binding.workspaceId)
        throw new ExternalCredentialError(
          'EXTERNAL_CREDENTIAL_WORKSPACE_MISMATCH',
          'External credential rotation requires its exact Workspace.',
          403
        );
      const authority = await this.requireManagementAuthority(principal);
      if (materialKind(input.secret) !== stored.binding.secretKind)
        throw new ExternalCredentialError(
          'EXTERNAL_CREDENTIAL_KIND_MISMATCH',
          'Rotated secret kind must match the credential binding.',
          400
        );
      const now = this.clock().toISOString();
      const expiresAt =
        input.expiresAt === undefined ? undefined : timestamp(input.expiresAt, 'expiresAt');
      if (expiresAt && Date.parse(expiresAt) <= this.clock().getTime())
        throw new ExternalCredentialError(
          'INVALID_EXTERNAL_CREDENTIAL_REQUEST',
          'External credential expiry must be in the future.',
          400
        );
      const nextBinding = parseExternalCredentialBindingV1({
        ...stored.binding,
        version: stored.binding.version + 1,
        grantor: {
          userId: principal.userId,
          membershipId: principal.membershipId,
          membershipVersion: authority.membership.version
        },
        ...(expiresAt ? { expiresAt } : { expiresAt: undefined }),
        updatedAt: now
      });
      const nextGeneration = stored.secretGeneration + 1;
      const nextSecret = this.options.keyring.encrypt(
        input.secret,
        externalCredentialSecretAadV1({
          credentialBindingId: stored.binding.credentialBindingId,
          workspaceId: stored.binding.workspaceId,
          provider: stored.binding.provider,
          secretKind: stored.binding.secretKind,
          secretGeneration: nextGeneration
        })
      );
      return (
        await this.options.repository.rotateCredential({
          credential: ref,
          nextBinding,
          expectedSecretGeneration: stored.secretGeneration,
          nextSecret,
          event: this.audit(nextBinding, 'ROTATED', now, stored.binding.version, principal)
        })
      ).binding;
    });
  }

  async transitionLifecycle(
    principal: Readonly<WorkspacePrincipal>,
    credential: Readonly<ExternalCredentialRefV1>,
    lifecycle: Exclude<ExternalCredentialLifecycleV1, 'ACTIVE'>
  ): Promise<Readonly<ExternalCredentialBindingV1>> {
    const ref = parseExternalCredentialRefV1(credential);
    return this.options.repository.withCredentialLock(ref.credentialBindingId, async () => {
      const stored = await this.required(ref.credentialBindingId);
      this.assertExact(stored.binding, ref);
      if (stored.binding.lifecycle === 'REVOKED')
        throw new ExternalCredentialError(
          'EXTERNAL_CREDENTIAL_INELIGIBLE',
          'A revoked external credential cannot transition.',
          409
        );
      if (stored.binding.lifecycle !== 'ACTIVE')
        throw new ExternalCredentialError(
          'EXTERNAL_CREDENTIAL_INELIGIBLE',
          'Only an ACTIVE external credential can transition.',
          409
        );
      if (principal.kind !== 'WORKSPACE' || principal.workspaceId !== stored.binding.workspaceId)
        throw new ExternalCredentialError(
          'EXTERNAL_CREDENTIAL_WORKSPACE_MISMATCH',
          'External credential transition requires its exact Workspace.',
          403
        );
      await this.requireManagementAuthority(principal);
      const now = this.clock().toISOString();
      const next = {
        ...stored.binding,
        version: stored.binding.version + 1,
        lifecycle,
        updatedAt: now
      };
      const projected = parseExternalCredentialBindingV1({
        ...next,
        ...(lifecycle === 'EXPIRED' ? { expiredAt: now } : {}),
        ...(lifecycle === 'REAUTH_REQUIRED' ? { reauthRequiredAt: now } : {}),
        ...(lifecycle === 'REVOKED' ? { revokedAt: now } : {})
      });
      return this.options.repository.transitionLifecycle({
        credential: ref,
        lifecycle,
        at: now,
        event: this.audit(projected, lifecycle, now, stored.binding.version, principal)
      });
    });
  }

  async rewrapEncryptionKey(credentialBindingId: string): Promise<number> {
    const id = text(credentialBindingId, 'credentialBindingId', 240);
    return this.options.repository.withCredentialLock(id, async () => {
      const stored = await this.required(id);
      const material = this.decrypt(stored);
      if (stored.secret?.keyId === this.options.keyring.activeKeyId) return stored.secretGeneration;
      const now = this.clock().toISOString();
      const nextGeneration = stored.secretGeneration + 1;
      const nextSecret = this.options.keyring.encrypt(
        material,
        externalCredentialSecretAadV1({
          credentialBindingId: id,
          workspaceId: stored.binding.workspaceId,
          provider: stored.binding.provider,
          secretKind: stored.binding.secretKind,
          secretGeneration: nextGeneration
        })
      );
      return this.options.repository.rewrapSecret({
        credentialBindingId: id,
        expectedSecretGeneration: stored.secretGeneration,
        nextSecret,
        at: now,
        event: this.audit(stored.binding, 'KEY_REWRAPPED', now)
      });
    });
  }

  private async requireManagementAuthority(principal: Readonly<WorkspacePrincipal>) {
    if (principal.kind !== 'WORKSPACE')
      throw new ExternalCredentialError(
        'INVALID_EXTERNAL_CREDENTIAL_REQUEST',
        'Workspace Principal is required.',
        400
      );
    return this.options.currentWorkspaceAuthority.validate({
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      requiredPermission: 'workspace:manage'
    });
  }
  private async required(id: string): Promise<Readonly<ExternalCredentialStoredV1>> {
    try {
      const stored = await this.options.repository.findCredential(id);
      if (stored) return stored;
    } catch (cause) {
      if (cause instanceof ExternalCredentialError) throw cause;
      throw new ExternalCredentialError(
        'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
        'External credential owner is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    throw new ExternalCredentialError(
      'EXTERNAL_CREDENTIAL_NOT_FOUND',
      'External credential was not found.',
      404
    );
  }
  private assertExact(
    binding: Readonly<ExternalCredentialBindingV1>,
    ref: Readonly<ExternalCredentialRefV1>
  ) {
    if (binding.credentialBindingId !== ref.credentialBindingId || binding.version !== ref.version)
      throw new ExternalCredentialError(
        'EXTERNAL_CREDENTIAL_STALE',
        'External credential reference is stale.',
        409
      );
  }
  private decrypt(
    stored: Readonly<ExternalCredentialStoredV1>
  ): ExternalCredentialSecretMaterialV1 {
    if (!stored.secret)
      throw new ExternalCredentialError(
        'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
        'External credential secret lineage is unavailable.',
        503,
        true
      );
    try {
      return this.options.keyring.decrypt(
        stored.secret,
        externalCredentialSecretAadV1({
          credentialBindingId: stored.binding.credentialBindingId,
          workspaceId: stored.binding.workspaceId,
          provider: stored.binding.provider,
          secretKind: stored.binding.secretKind,
          secretGeneration: stored.secretGeneration
        })
      );
    } catch (cause) {
      if (cause instanceof ExternalCredentialCryptoError)
        throw new ExternalCredentialError(
          'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
          'External credential secret backend is unavailable.',
          503,
          true,
          { cause }
        );
      throw cause;
    }
  }
  private audit(
    binding: Readonly<ExternalCredentialBindingV1>,
    action: ExternalCredentialAuditActionV1,
    occurredAt: string,
    fromVersion?: number,
    principal?: Readonly<WorkspacePrincipal>
  ): ExternalCredentialAuditEventV1 {
    return {
      eventId: `external-credential-audit_${randomUUID()}`,
      credentialBindingId: binding.credentialBindingId,
      workspaceId: binding.workspaceId,
      provider: binding.provider,
      externalAccountRef: binding.externalAccountRef,
      secretKind: binding.secretKind,
      action,
      ...(fromVersion ? { fromVersion } : {}),
      toVersion: binding.version,
      ...(principal?.kind === 'WORKSPACE'
        ? { actorUserId: principal.userId, actorMembershipId: principal.membershipId }
        : {}),
      occurredAt
    };
  }
}
