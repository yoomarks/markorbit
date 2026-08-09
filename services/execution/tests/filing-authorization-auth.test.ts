/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await -- HTTP boundary assertions intentionally inspect decoded JSON fixtures. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  ROLE_PERMISSION_MATRIX,
  type Permission,
  type PreparationLock,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime,
  InMemoryFilingGovernanceRepository
} from '../src/index.js';

const at = '2026-08-09T04:15:00.000Z';
const secret = 'wp02-internal-secret';
const workspaceId = '77777777-7777-4777-8777-777777777777';
const otherWorkspaceId = '66666666-6666-4666-8666-666666666666';
const lock: PreparationLock = {
  schemaVersion: 1,
  preparationLockId: 'preparation-lock_wp02_http',
  documentPackageId: 'document-package_wp02_http',
  documentPackageVersion: 2,
  instructionLedgerId: 'instruction-ledger_wp02_http',
  instructionLedgerVersion: 3,
  lockedAt: at,
  snapshot: {
    sourceReviewDecisionVersion: 'review-http-v1',
    sourceMatterDraftVersion: 'matter-http-v1',
    commercialScopeUnchanged: true,
    documentPackage: {
      schemaVersion: 1,
      documentPackageId: 'document-package_wp02_http',
      version: 2,
      professionalReviewCaseId: 'professional-review_wp02_http',
      professionalReviewDecisionVersion: 'review-http-v1',
      matterDraftId: 'matter-draft_wp02_http',
      matterDraftVersion: 'matter-http-v1',
      customerConfirmationId: 'confirmation_wp02_http',
      customerId: 'customer_wp02_http',
      jurisdiction: 'US',
      trademarkReference: 'MARK ORBIT HTTP',
      requirements: [],
      documentItems: [],
      validationChecks: [],
      missingRequirements: [],
      status: 'LOCKED_FOR_PREPARATION',
      createdAt: at,
      updatedAt: at,
      lockedAt: at
    },
    instructionLedger: {
      schemaVersion: 1,
      instructionLedgerId: 'instruction-ledger_wp02_http',
      version: 3,
      documentPackageId: 'document-package_wp02_http',
      documentPackageVersion: 2,
      customerId: 'customer_wp02_http',
      matterDraftId: 'matter-draft_wp02_http',
      matterDraftVersion: 'matter-http-v1',
      professionalReviewCaseId: 'professional-review_wp02_http',
      professionalReviewDecisionVersion: 'review-http-v1',
      entries: [],
      acknowledgements: [],
      status: 'LOCKED_FOR_PREPARATION',
      currentEffectiveInstructionSet: {},
      createdAt: at,
      updatedAt: at,
      lockedAt: at
    }
  },
  nextPermittedAction: 'GOVERNED_FILING_AUTHORITY_REVIEW',
  consequences: {
    orderCreated: false,
    paymentCreated: false,
    formalMatterCreated: false,
    professionalAppointed: false,
    filingCreated: false,
    filingSubmitted: false,
    customerMessageSent: false,
    externalDocumentSent: false,
    trademarkOfficeContacted: false
  }
};
const sourceVersion = `2:3:${at}`;
const codes = [
  'APPLICANT_OWNER_CONFIRMED',
  'MARK_CONFIRMED',
  'JURISDICTION_CLASSES_GOODS_CONFIRMED',
  'LOCKED_DOCUMENT_USE_AUTHORIZED',
  'FILING_INSTRUCTION_PREPARATION_AUTHORIZED',
  'AUTHORIZATION_IS_NOT_SUBMISSION',
  'REPRESENTATIVE_APPOINTMENT_MAY_BE_REQUIRED',
  'SCOPE_CHANGE_REQUIRES_REAUTHORIZATION',
  'OFFICE_ACCEPTANCE_NOT_GUARANTEED'
];

function principal(
  userId = 'user_execution_manager',
  permissions: readonly Permission[] = ROLE_PERMISSION_MATRIX.MATTER_MANAGER
): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_wp02',
    userId,
    workspaceId,
    membershipId: 'membership_wp02',
    role: 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-08-10T04:15:00.000Z'
  };
}

function trustedHeaders(value = principal()) {
  return {
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId,
    'x-correlation-id': 'correlation-wp02-http'
  };
}

const repositories = new Map<string, InMemoryFilingGovernanceRepository>();
let runtime: ServiceRuntime;
let base = '';

async function call(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
  headers: Record<string, string> = {}
) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...headers,
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

beforeEach(async () => {
  repositories.clear();
  runtime = createRuntime({
    port: 0,
    internalServiceSecret: secret,
    filingRepositoryFactory: (id) => {
      const existing = repositories.get(id);
      if (existing) return existing;
      const created = new InMemoryFilingGovernanceRepository();
      repositories.set(id, created);
      return created;
    },
    preparationLockSource: { getPreparationLock: async () => structuredClone(lock) },
    now: () => at
  });
  await runtime.start();
  base = `http://127.0.0.1:${runtime.listeningPort}`;
});
afterEach(() => runtime.stop());

describe('authenticated durable filing governance HTTP boundary', () => {
  it('requires trusted internal caller evidence when the durable repository factory is enabled', async () => {
    const response = await call(
      '/v1/filing-authorizations',
      'POST',
      {
        preparationLockId: lock.preparationLockId,
        preparationLockVersion: sourceVersion,
        authorizedParty: { partyId: 'customer_wp02_http', displayName: 'Owner' },
        authorizationCapacity: 'OWNER',
        executionChannel: 'OFFICE_PORTAL'
      },
      { 'idempotency-key': 'untrusted' }
    );
    expect(response.status).toBe(401);
  });

  it('denies missing execution:manage and records server-owned denial evidence', async () => {
    const limited = principal('user_limited', ['workspace:read', 'execution:read']);
    const response = await call(
      '/v1/filing-authorizations',
      'POST',
      {
        preparationLockId: lock.preparationLockId,
        preparationLockVersion: sourceVersion,
        authorizedParty: { partyId: 'customer_wp02_http', displayName: 'Owner' },
        authorizationCapacity: 'OWNER',
        executionChannel: 'OFFICE_PORTAL'
      },
      { ...trustedHeaders(limited), 'idempotency-key': 'permission-denied' }
    );
    expect(response.status).toBe(403);
    expect(repositories.get(workspaceId)?.snapshotDenials()).toContainEqual(
      expect.objectContaining({
        actorId: 'user_limited',
        reasonCode: 'PERMISSION_DENIED',
        targetType: 'FILING_AUTHORIZATION'
      })
    );
  });

  it('rejects Workspace spoofing non-enumerating and records the denial', async () => {
    const response = await call(
      '/v1/filing-authorizations',
      'POST',
      {
        workspaceId: otherWorkspaceId,
        preparationLockId: lock.preparationLockId,
        preparationLockVersion: sourceVersion,
        authorizedParty: { partyId: 'customer_wp02_http', displayName: 'Owner' },
        authorizationCapacity: 'OWNER',
        executionChannel: 'OFFICE_PORTAL'
      },
      { ...trustedHeaders(), 'idempotency-key': 'workspace-spoof' }
    );
    expect(response.status).toBe(404);
    expect(repositories.get(workspaceId)?.snapshotDenials()).toContainEqual(
      expect.objectContaining({ reasonCode: 'WORKSPACE_MISMATCH' })
    );
  });

  it('uses authenticated Principal actor truth for authorization acknowledgement and release decision', async () => {
    const headers = trustedHeaders(principal('user_real_actor'));
    const createdResponse = await call(
      '/v1/filing-authorizations',
      'POST',
      {
        preparationLockId: lock.preparationLockId,
        preparationLockVersion: sourceVersion,
        authorizedParty: { partyId: 'customer_wp02_http', displayName: 'Owner' },
        authorizationCapacity: 'OWNER',
        executionChannel: 'OFFICE_PORTAL'
      },
      { ...headers, 'idempotency-key': 'actor-create' }
    );
    expect(createdResponse.status).toBe(200);
    const created = (await createdResponse.json()) as any;
    const authorizationId = created.filingAuthorization.filingAuthorizationId as string;

    const confirmedResponse = await call(
      `/v1/filing-authorizations/${authorizationId}/confirm`,
      'POST',
      { acknowledgementCodes: codes, acknowledgedBy: 'user_spoofed_actor' },
      { ...headers, 'idempotency-key': 'actor-confirm' }
    );
    expect(confirmedResponse.status).toBe(200);
    const confirmed = (await confirmedResponse.json()) as any;
    expect(
      confirmed.filingAuthorization.acknowledgements.every(
        (item: any) => item.acknowledgedBy === 'user_real_actor'
      )
    ).toBe(true);

    const releaseCreated = await call(
      '/v1/execution-releases',
      'POST',
      {
        filingAuthorizationId: authorizationId,
        filingAuthorizationVersion: confirmed.filingAuthorization.version,
        requestedExecutionChannel: 'OFFICE_PORTAL'
      },
      { ...headers, 'idempotency-key': 'actor-release-create' }
    );
    const releaseBody = (await releaseCreated.json()) as any;
    const releaseId = releaseBody.executionRelease.executionReleaseId as string;
    expect((await call(`/v1/execution-releases/${releaseId}/evaluate`, 'POST', {}, headers)).status).toBe(
      200
    );
    expect(
      (
        await call(
          `/v1/execution-releases/${releaseId}/assignment`,
          'PATCH',
          { internalExecutorId: 'user_internal_executor' },
          headers
        )
      ).status
    ).toBe(200);
    const releasedResponse = await call(
      `/v1/execution-releases/${releaseId}/release`,
      'POST',
      {
        decidedBy: 'user_spoofed_decider',
        rationale: 'Explicit internal release only.'
      },
      { ...headers, 'idempotency-key': 'actor-release-decision' }
    );
    expect(releasedResponse.status).toBe(200);
    const released = (await releasedResponse.json()) as any;
    expect(released.releaseResult.release.decision.decidedBy).toBe('user_real_actor');
    expect(released.consequences).toEqual(
      expect.objectContaining({
        filingSubmitted: false,
        officialApplicationCreated: false,
        providerAssignedExternally: false
      })
    );
  });
});
