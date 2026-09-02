import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createDurablePreparationLockRoutes } from '../src/durable-preparation-lock-http.js';
import {
  DurablePreparationLockError,
  type DurablePreparationLockView,
  type PostgresDurablePreparationLockService
} from '../src/durable-preparation-lock.js';

const workspaceId = '38383838-3838-4383-8383-383838383838';
const otherWorkspaceId = '39393939-3939-4393-8393-393939393939';
const secret = 'markreg-durable-preparation-lock-secret-32-bytes';
const active: ServiceRuntime[] = [];
const lockId = 'preparation-lock_http-task038';
const packageId = 'document-package_http-task038';
const canonicalEvidenceHash = 'd'.repeat(64);

const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task038_http',
  userId: 'user_task038_http',
  workspaceId: workspace,
  membershipId: 'membership_task038_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'document-package:read', 'document-package:mark-ready'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const headers = (value: WorkspacePrincipal) => ({
  'content-type': 'application/json',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
  'x-markorbit-workspace-id': value.workspaceId,
  'x-correlation-id': 'correlation_task038_http'
});

const view = (): DurablePreparationLockView => ({
  schemaVersion: 1,
  preparationLockId: lockId,
  workspaceId,
  version: 1,
  source: {
    documentPackageId: packageId,
    documentPackageVersion: 4,
    canonicalEvidenceHash,
    formalMatterId: 'formal-matter_http-task038',
    formalMatterVersion: 3,
    formalMatterHash: 'a'.repeat(64),
    professionalReviewCaseId: 'professional-review_http-task038',
    reviewVersion: 5,
    completedDecisionId: 'decision_task038_http',
    completedDecisionHash: 'b'.repeat(64),
    instructionEntryCount: 1,
    instructionEntries: [
      {
        instructionEntryId: 'instruction-entry_http-task038',
        sequence: 1,
        canonicalFingerprint: 'c'.repeat(64)
      }
    ],
    instructionSetHash: 'e'.repeat(64)
  },
  lockPayloadHash: 'f'.repeat(64),
  createdBy: 'user_task038_http',
  createdAt: '2026-09-02T00:00:00.000Z',
  authority: {
    filingAuthorizationCreated: false,
    executionReleaseCreated: false,
    externalFilingCreated: false,
    paymentCreated: false,
    providerContacted: false,
    officialTruthCreated: false
  }
});

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function stack(
  serviceOverrides: Partial<{
    create: PostgresDurablePreparationLockService['create'];
    get: PostgresDurablePreparationLockService['get'];
    validateCurrent: PostgresDurablePreparationLockService['validateCurrent'];
  }> = {}
) {
  const create = vi.fn(
    serviceOverrides.create ?? (() => Promise.resolve(view()))
  ) as unknown as PostgresDurablePreparationLockService['create'];
  const get = vi.fn(
    serviceOverrides.get ?? (() => Promise.resolve(view()))
  ) as unknown as PostgresDurablePreparationLockService['get'];
  const validateCurrent = vi.fn(
    serviceOverrides.validateCurrent ?? (() => Promise.resolve(view()))
  ) as unknown as PostgresDurablePreparationLockService['validateCurrent'];
  const service = { create, get, validateCurrent } as Pick<
    PostgresDurablePreparationLockService,
    'create' | 'get' | 'validateCurrent'
  >;
  const runtime = createServiceRuntime(
    { name: 'markreg-durable-preparation-lock-http-test', port: 0, version: '1' },
    { routes: createDurablePreparationLockRoutes({ internalServiceSecret: secret, service }) }
  );
  active.push(runtime);
  await runtime.start();
  return {
    base: `http://127.0.0.1:${runtime.listeningPort}`,
    create,
    get,
    validateCurrent
  };
}

describe('Durable Preparation Lock HTTP', () => {
  it('forwards exact READY Package identity and returns no-authority durable truth', async () => {
    const runtime = await stack();
    const response = await fetch(`${runtime.base}/v1/preparation-locks`, {
      method: 'POST',
      headers: { ...headers(principal()), 'idempotency-key': 'lock-http-task038' },
      body: JSON.stringify({
        documentPackageId: packageId,
        expectedDocumentPackageVersion: 4,
        expectedCanonicalEvidenceHash: canonicalEvidenceHash
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      preparationLockId: lockId,
      source: {
        documentPackageId: packageId,
        documentPackageVersion: 4,
        canonicalEvidenceHash
      },
      authority: {
        filingAuthorizationCreated: false,
        executionReleaseCreated: false,
        externalFilingCreated: false,
        paymentCreated: false,
        providerContacted: false,
        officialTruthCreated: false
      }
    });
    expect(runtime.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId: 'user_task038_http' }),
      {
        documentPackageId: packageId,
        expectedDocumentPackageVersion: 4,
        expectedCanonicalEvidenceHash: canonicalEvidenceHash,
        idempotencyKey: 'lock-http-task038'
      },
      'correlation_task038_http'
    );
  });

  it('routes GET and validate-current through the same Workspace principal', async () => {
    const runtime = await stack();
    const get = await fetch(`${runtime.base}/v1/preparation-locks/${lockId}`, {
      headers: headers(principal())
    });
    expect(get.status).toBe(200);
    expect(runtime.get).toHaveBeenCalledWith(expect.objectContaining({ workspaceId }), lockId);

    const validate = await fetch(
      `${runtime.base}/v1/preparation-locks/${lockId}/validate-current`,
      {
        method: 'POST',
        headers: headers(principal()),
        body: JSON.stringify({ validate: true })
      }
    );
    expect(validate.status).toBe(200);
    expect(runtime.validateCurrent).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId }),
      lockId
    );
  });

  it('requires trusted internal authorization and exact Workspace identity', async () => {
    const runtime = await stack();
    const untrusted = await fetch(`${runtime.base}/v1/preparation-locks/${lockId}`, {
      headers: {
        ...headers(principal()),
        'x-markorbit-internal-authorization': 'wrong-secret'
      }
    });
    expect(untrusted.status).toBe(401);
    expect(await untrusted.json()).toMatchObject({ code: 'UNTRUSTED_INTERNAL_CALLER' });

    const mismatch = await fetch(`${runtime.base}/v1/preparation-locks/${lockId}`, {
      headers: {
        ...headers(principal()),
        'x-markorbit-workspace-id': otherWorkspaceId
      }
    });
    expect(mismatch.status).toBe(404);
    expect(await mismatch.json()).toMatchObject({ code: 'WORKSPACE_MISMATCH' });
  });

  it('fails closed on durable stale-source validation', async () => {
    const runtime = await stack({
      validateCurrent: () =>
        Promise.reject(
          new DurablePreparationLockError(
            'STALE_PREPARATION_SOURCE',
            'Preparation Lock source no longer matches current durable READY package truth.',
            409
          )
        )
    });
    const response = await fetch(
      `${runtime.base}/v1/preparation-locks/${lockId}/validate-current`,
      {
        method: 'POST',
        headers: headers(principal()),
        body: JSON.stringify({ validate: true })
      }
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'STALE_PREPARATION_SOURCE',
      retryable: false
    });
  });
});
