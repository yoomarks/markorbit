import { afterEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRoute, ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime } from '../src/index.js';
import { FailClosedPreparationRepository } from '../src/fail-closed-preparation.js';
import { createDurablePreparationLockRoutes } from '../src/durable-preparation-lock-http.js';
import type {
  DurablePreparationLockView,
  PostgresDurablePreparationLockService
} from '../src/durable-preparation-lock.js';

const workspaceId = '38383838-3838-4383-8383-383838383838';
const secret = 'markreg-durable-preparation-runtime-secret-32-bytes';
const active: ServiceRuntime[] = [];
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_task038_runtime',
  userId: 'user_task038_runtime',
  workspaceId,
  membershipId: 'membership_task038_runtime',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'document-package:read', 'document-package:mark-ready'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const canonicalEvidenceHash = 'd'.repeat(64);
const lock: DurablePreparationLockView = {
  schemaVersion: 1,
  preparationLockId: 'preparation-lock_runtime-task038',
  workspaceId,
  version: 1,
  source: {
    documentPackageId: 'document-package_runtime-task038',
    documentPackageVersion: 4,
    canonicalEvidenceHash,
    formalMatterId: 'formal-matter_runtime-task038',
    formalMatterVersion: 3,
    formalMatterHash: 'a'.repeat(64),
    professionalReviewCaseId: 'professional-review_runtime-task038',
    reviewVersion: 5,
    completedDecisionId: 'decision_runtime-task038',
    completedDecisionHash: 'b'.repeat(64),
    instructionEntryCount: 1,
    instructionEntries: [
      {
        instructionEntryId: 'instruction-entry_runtime-task038',
        sequence: 1,
        canonicalFingerprint: 'c'.repeat(64)
      }
    ],
    instructionSetHash: 'e'.repeat(64)
  },
  lockPayloadHash: 'f'.repeat(64),
  createdBy: principal.userId,
  createdAt: '2026-09-02T00:00:00.000Z',
  authority: {
    filingAuthorizationCreated: false,
    executionReleaseCreated: false,
    externalFilingCreated: false,
    paymentCreated: false,
    providerContacted: false,
    officialTruthCreated: false
  }
};

const headers = {
  'content-type': 'application/json',
  'idempotency-key': 'lock-runtime-task038',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
  'x-markorbit-workspace-id': workspaceId
};

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function start(extraRoutes: readonly JsonRoute[] = []) {
  const runtime = createRuntime({
    port: 0,
    internalServiceSecret: secret,
    preparationRepository: new FailClosedPreparationRepository(),
    extraRoutes
  });
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

describe('durable Preparation Lock runtime composition', () => {
  it('lets the production durable route override the historical fail-closed lock route', async () => {
    const service = {
      create: () => Promise.resolve(lock),
      get: () => Promise.resolve(lock),
      validateCurrent: () => Promise.resolve(lock)
    } as Pick<PostgresDurablePreparationLockService, 'create' | 'get' | 'validateCurrent'>;
    const base = await start(
      createDurablePreparationLockRoutes({ internalServiceSecret: secret, service })
    );
    const response = await fetch(`${base}/v1/preparation-locks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        documentPackageId: lock.source.documentPackageId,
        expectedDocumentPackageVersion: lock.source.documentPackageVersion,
        expectedCanonicalEvidenceHash: canonicalEvidenceHash
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      preparationLockId: lock.preparationLockId,
      authority: { filingAuthorizationCreated: false, executionReleaseCreated: false }
    });
  });

  it('keeps legacy Preparation fail closed when the durable override is absent', async () => {
    const base = await start();
    const response = await fetch(`${base}/v1/preparation-locks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        documentPackageId: 'document-package_legacy-task038',
        instructionLedgerId: 'instruction-ledger_legacy-task038'
      })
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'DURABLE_PREPARATION_NOT_AVAILABLE',
      retryable: false
    });
  });
});
