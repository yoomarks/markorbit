import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  ExternalCredentialServiceV1,
  type ExternalCredentialRepositoryV1,
  type ExternalCredentialStoredV1
} from '../src/external-credential.js';
import { ExternalCredentialKeyringV1 } from '../src/external-credential-crypto.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const membershipId = '33333333-3333-4333-8333-333333333333';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_test',
  userId,
  workspaceId,
  membershipId,
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'workspace:manage'],
  sessionExpiresAt: '2026-09-22T00:00:00.000Z'
};

class MemoryRepository implements ExternalCredentialRepositoryV1 {
  stored?: ExternalCredentialStoredV1;
  events: unknown[] = [];
  createCredential(stored: ExternalCredentialStoredV1, event: unknown) {
    this.stored = structuredClone(stored);
    this.events.push(event);
    return Promise.resolve(stored.binding);
  }
  findCredential() {
    return Promise.resolve(this.stored ? structuredClone(this.stored) : undefined);
  }
  withCredentialLock<T>(_id: string, callback: () => Promise<T>) {
    return callback();
  }
  rotateCredential(input: Parameters<ExternalCredentialRepositoryV1['rotateCredential']>[0]) {
    if (!this.stored) throw new Error('missing');
    this.stored = {
      binding: structuredClone(input.nextBinding),
      secretGeneration: input.expectedSecretGeneration + 1,
      secret: structuredClone(input.nextSecret)
    };
    this.events.push(input.event);
    return Promise.resolve(structuredClone(this.stored));
  }
  transitionLifecycle(input: Parameters<ExternalCredentialRepositoryV1['transitionLifecycle']>[0]) {
    if (!this.stored) throw new Error('missing');
    const binding = {
      ...this.stored.binding,
      version: this.stored.binding.version + 1,
      lifecycle: input.lifecycle,
      updatedAt: input.at,
      ...(input.lifecycle === 'EXPIRED' ? { expiredAt: input.at } : {}),
      ...(input.lifecycle === 'REAUTH_REQUIRED' ? { reauthRequiredAt: input.at } : {}),
      ...(input.lifecycle === 'REVOKED' ? { revokedAt: input.at } : {})
    } as const;
    this.stored = {
      binding,
      secretGeneration: this.stored.secretGeneration,
      ...(input.lifecycle === 'REVOKED' ? {} : { secret: this.stored.secret })
    };
    this.events.push(input.event);
    return Promise.resolve(binding);
  }
  rewrapSecret(input: Parameters<ExternalCredentialRepositoryV1['rewrapSecret']>[0]) {
    if (!this.stored) throw new Error('missing');
    this.stored = {
      ...this.stored,
      secretGeneration: input.expectedSecretGeneration + 1,
      secret: input.nextSecret
    };
    this.events.push(input.event);
    return Promise.resolve(this.stored.secretGeneration);
  }
}

function owner(repository = new MemoryRepository(), activeKeyId = 'key-v1') {
  const validate = vi.fn(() => Promise.resolve({ membership: { version: 5 } }) as never);
  const service = new ExternalCredentialServiceV1({
    repository,
    currentWorkspaceAuthority: { validate },
    keyring: new ExternalCredentialKeyringV1({
      activeKeyId,
      keys: { 'key-v1': Buffer.alloc(32, 1), 'key-v2': Buffer.alloc(32, 2) }
    }),
    clock: () => new Date('2026-09-20T10:00:00.000Z')
  });
  return { service, repository, validate };
}

describe('external credential owner', () => {
  it.each([
    ['API_KEY', { kind: 'API_KEY', keyId: 'client', secret: 'api-value-1384' }],
    ['STATIC_BEARER', { kind: 'STATIC_BEARER', token: 'bearer-value-1384' }],
    ['BASIC', { kind: 'BASIC', username: 'user', password: 'basic-value-1384' }]
  ] as const)(
    'creates encrypted %s bindings with metadata-only audit',
    async (secretKind, secret) => {
      const { service, repository } = owner();
      const binding = await service.createCredential(principal, {
        provider: 'TEST_PROVIDER',
        externalAccountRef: 'account-1',
        secretKind,
        allowedCapabilityIds: ['capability.test'],
        secret
      });
      expect(binding).toMatchObject({ version: 1, lifecycle: 'ACTIVE', secretKind });
      expect(JSON.stringify(binding)).not.toContain(Object.values(secret).at(-1));
      expect(repository.stored?.secret?.ciphertextBase64).toBeTruthy();
      expect(JSON.stringify(repository.events)).not.toMatch(/password|token|api-secret/iu);
    }
  );

  it('increments public version on customer rotation and not on key rewrap', async () => {
    const first = owner();
    const binding = await first.service.createCredential(principal, {
      provider: 'TEST_PROVIDER',
      externalAccountRef: 'account-1',
      secretKind: 'API_KEY',
      allowedCapabilityIds: ['capability.test'],
      secret: { kind: 'API_KEY', secret: 'one' }
    });
    const rotated = await first.service.rotateCredential(
      principal,
      { owner: 'CORE_IDENTITY', credentialBindingId: binding.credentialBindingId, version: 1 },
      { secret: { kind: 'API_KEY', secret: 'two' } }
    );
    expect(rotated.version).toBe(2);
    expect(first.repository.stored?.secretGeneration).toBe(2);
    const second = owner(first.repository, 'key-v2');
    await expect(second.service.rewrapEncryptionKey(binding.credentialBindingId)).resolves.toBe(3);
    expect(first.repository.stored?.binding.version).toBe(2);
  });

  it('enforces exact version, Workspace, kind, and terminal lifecycle', async () => {
    const { service } = owner();
    const binding = await service.createCredential(principal, {
      provider: 'TEST_PROVIDER',
      externalAccountRef: 'account-1',
      secretKind: 'BASIC',
      allowedCapabilityIds: ['capability.test'],
      secret: { kind: 'BASIC', username: 'user', password: 'password' }
    });
    await expect(
      service.rotateCredential(
        principal,
        { owner: 'CORE_IDENTITY', credentialBindingId: binding.credentialBindingId, version: 2 },
        { secret: { kind: 'BASIC', username: 'user', password: 'next' } }
      )
    ).rejects.toMatchObject({ code: 'EXTERNAL_CREDENTIAL_STALE' });
    await expect(
      service.rotateCredential(
        { ...principal, workspaceId: '44444444-4444-4444-8444-444444444444' },
        { owner: 'CORE_IDENTITY', credentialBindingId: binding.credentialBindingId, version: 1 },
        { secret: { kind: 'BASIC', username: 'user', password: 'next' } }
      )
    ).rejects.toMatchObject({ code: 'EXTERNAL_CREDENTIAL_WORKSPACE_MISMATCH' });
    const revoked = await service.transitionLifecycle(
      principal,
      { owner: 'CORE_IDENTITY', credentialBindingId: binding.credentialBindingId, version: 1 },
      'REVOKED'
    );
    expect(revoked).toMatchObject({ version: 2, lifecycle: 'REVOKED' });
    await expect(service.rewrapEncryptionKey(binding.credentialBindingId)).rejects.toMatchObject({
      code: 'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE'
    });
  });

  it('safe reads require an exact current Workspace authority and never return material', async () => {
    const { service, validate } = owner();
    const binding = await service.createCredential(principal, {
      provider: 'TEST_PROVIDER',
      externalAccountRef: 'account-1',
      secretKind: 'API_KEY',
      allowedCapabilityIds: ['capability.test'],
      secret: { kind: 'API_KEY', secret: 'read-secret-value' }
    });
    const safe = await service.readCredential(principal, {
      owner: 'CORE_IDENTITY',
      credentialBindingId: binding.credentialBindingId,
      version: 1
    });
    expect(JSON.stringify(safe)).not.toContain('read-secret-value');
    expect(validate).toHaveBeenLastCalledWith(
      expect.objectContaining({ requiredPermission: 'workspace:read' })
    );
    await expect(
      service.readCredential(
        { ...principal, workspaceId: '44444444-4444-4444-8444-444444444444' },
        { owner: 'CORE_IDENTITY', credentialBindingId: binding.credentialBindingId, version: 1 }
      )
    ).rejects.toMatchObject({ code: 'EXTERNAL_CREDENTIAL_WORKSPACE_MISMATCH' });
  });

  it('fails closed when current Workspace authority rejects mutation', async () => {
    const repository = new MemoryRepository();
    const service = new ExternalCredentialServiceV1({
      repository,
      currentWorkspaceAuthority: { validate: () => Promise.reject(new Error('denied')) },
      keyring: new ExternalCredentialKeyringV1({
        activeKeyId: 'key-v1',
        keys: { 'key-v1': Buffer.alloc(32, 1) }
      })
    });
    await expect(
      service.createCredential(principal, {
        provider: 'TEST_PROVIDER',
        externalAccountRef: 'account-1',
        secretKind: 'API_KEY',
        allowedCapabilityIds: ['capability.test'],
        secret: { kind: 'API_KEY', secret: 'value' }
      })
    ).rejects.toThrow('denied');
    expect(repository.stored).toBeUndefined();
  });
});
