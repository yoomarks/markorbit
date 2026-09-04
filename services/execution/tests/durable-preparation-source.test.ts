import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfessionalReviewCase, WorkspacePrincipal } from '@markorbit/contracts';
import {
  FilingGovernanceService,
  InMemoryFilingGovernanceRepository,
  type FilingAuthorizationRepository,
  type ExecutionReleaseRepository,
  type FilingExecutionTaskDraftRepository
} from '../src/filing-authorization.js';
import { createHttpDurablePreparationSource } from '../src/durable-preparation-source.js';
import { createHash } from 'node:crypto';

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, member]) => member !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};
const sha = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const at = '2026-09-04T13:00:00.000Z';
const workspaceId = '77777777-7777-4777-8777-777777777777';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_731',
  userId: 'user_731',
  workspaceId,
  membershipId: 'membership_731',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'execution:read', 'execution:manage', 'document-package:read'],
  sessionExpiresAt: '2026-09-05T13:00:00.000Z'
};
const decision = {
  code: 'MARK_READY_FOR_NEXT_STEP' as const,
  reviewerId: 'user_reviewer' as const,
  decidedAt: at,
  rationale: 'Reviewed.',
  checklistSnapshot: [],
  evidenceReferences: [],
  sourceMatterDraftVersion: '3',
  consequences: {
    orderCreated: false as const,
    paymentCreated: false as const,
    formalMatterCreated: false as const,
    providerAppointed: false as const,
    filingCreated: false as const,
    customerMessageSent: false as const
  }
};
const formalHash = 'a'.repeat(64);
const canonicalEvidenceHash = 'b'.repeat(64);
const instructionFingerprint = 'c'.repeat(64);
const instructionEntries = [
  {
    instructionEntryId: 'instruction-entry_731',
    sequence: 1,
    canonicalFingerprint: instructionFingerprint
  }
];
const instructionSetHash = sha(instructionEntries);
const lockSource = {
  documentPackageId: 'document-package_731',
  documentPackageVersion: 8,
  canonicalEvidenceHash,
  formalMatterId: 'formal-matter_731',
  formalMatterVersion: 1,
  formalMatterHash: formalHash,
  professionalReviewCaseId: 'professional-review_731',
  reviewVersion: 5,
  completedDecisionId: at,
  completedDecisionHash: sha(decision),
  instructionEntryCount: 1,
  instructionEntries,
  instructionSetHash
};
const lockPayloadHash = sha({ schemaVersion: 1, source: lockSource });
const lock = {
  schemaVersion: 1,
  preparationLockId: 'preparation-lock_731',
  workspaceId,
  version: 1,
  source: lockSource,
  lockPayloadHash,
  createdBy: 'user_731',
  createdAt: at,
  authority: {
    filingAuthorizationCreated: false,
    executionReleaseCreated: false,
    externalFilingCreated: false,
    paymentCreated: false,
    providerContacted: false,
    officialTruthCreated: false
  }
};
const pkg = {
  documentPackageId: 'document-package_731',
  workspaceId,
  formalMatterId: 'formal-matter_731',
  sourceFormalMatterVersion: 1,
  sourceFormalMatterHash: formalHash,
  professionalReviewCaseId: 'professional-review_731',
  sourceReviewVersion: 5,
  sourceCompletedDecisionId: at,
  sourceCompletedDecisionHash: sha(decision),
  status: 'READY_FOR_PREPARATION_LOCK',
  version: 8,
  schemaVersion: 1,
  requirements: [],
  draft: {},
  documentItems: [
    {
      documentItemId: 'document-item_731',
      requirementKey: 'MARK_REPRESENTATION_FILE',
      displayName: 'mark.png',
      storageReference: 's3://markorbit/mark.png',
      verificationStatus: 'RECORDED'
    }
  ],
  instructionEntries: [
    {
      instructionEntryId: 'instruction-entry_731',
      sequence: 1,
      instructionType: 'DOCUMENT_USE_AUTHORIZATION',
      structuredPayload: { authorized: true },
      actor: 'user_731',
      createdAt: at,
      canonicalFingerprint: instructionFingerprint
    }
  ],
  createdBy: 'user_731',
  updatedBy: 'user_731',
  createdAt: at,
  updatedAt: at,
  readyAt: at,
  readyBy: 'user_731',
  canonicalEvidenceHash
};
const formalMatter = {
  schemaVersion: 1,
  formalMatterId: 'formal-matter_731',
  workspaceId,
  kind: 'TRADEMARK_REGISTRATION',
  status: 'OPEN',
  version: 1,
  sourceCustomerConfirmationId: 'confirmation_731',
  sourceCustomerConfirmationVersion: 1,
  sourceMatterDraftId: 'matter-draft_731',
  sourceMatterDraftVersion: 3,
  sourceQuoteId: 'quote_731',
  sourceQuoteVersion: '1',
  sourceSnapshot: {
    schemaVersion: 1,
    customerConfirmation: { id: 'confirmation_731', version: 1, status: 'CONFIRMED' },
    quote: { id: 'quote_731', version: '1', currency: 'USD', totalMinor: 100 },
    matterDraft: {
      id: 'matter-draft_731',
      version: 3,
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      readiness: { evaluatedAt: at, checks: [], readyForProfessionalReview: true }
    },
    preparation: {
      applicantName: 'Durable Owner LLC',
      applicantAddress: '1 Orbit Way',
      trademark: 'MARK ORBIT',
      targetJurisdiction: 'US',
      classes: [9, 42],
      goodsServices: 'downloadable software; software as a service',
      filingBasis: 'INTENT_TO_USE',
      representativeRequired: false,
      documentReferences: [],
      commercialScopeUnchanged: true
    }
  },
  snapshotSchemaVersion: 1,
  snapshotSha256: formalHash,
  createdByUserId: 'user_731',
  createdAt: at,
  updatedAt: at
};
const review: ProfessionalReviewCase = {
  schemaVersion: 1,
  reviewCaseId: 'professional-review_731',
  workspaceId,
  formalMatterId: 'formal-matter_731',
  sourceFormalMatterVersion: 1,
  sourceSnapshotSha256: formalHash,
  version: 5,
  source: {
    schemaVersion: 1,
    matterDraftId: 'matter-draft_731',
    matterDraftVersion: '3',
    confirmationId: 'confirmation_731',
    customerId: 'customer_731',
    status: 'READY_FOR_PROFESSIONAL_REVIEW',
    preparation: formalMatter.sourceSnapshot.preparation,
    readiness: formalMatter.sourceSnapshot.matterDraft.readiness,
    readinessTimestamp: at
  },
  status: 'REVIEWED_READY_FOR_NEXT_STEP',
  priority: 'NORMAL',
  requestedBy: 'user_731',
  createdAt: at,
  updatedAt: at,
  assignment: {
    status: 'CLAIMED',
    claimedBy: 'user_reviewer',
    claimedAt: at,
    professionalAppointed: false
  },
  checklist: [],
  evidence: [],
  decision,
  completedAt: at,
  completedBy: 'user_reviewer'
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
  );
}
function source(overrides?: {
  lock?: unknown;
  package?: unknown;
  formalMatter?: unknown;
  review?: ProfessionalReviewCase | undefined;
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/v1/preparation-locks/')) return json(overrides?.lock ?? lock);
      if (url.includes('/v1/document-packages/')) return json(overrides?.package ?? pkg);
      if (url.includes('/v1/formal-matters/'))
        return json({ formalMatter: overrides?.formalMatter ?? formalMatter });
      throw new Error(`Unexpected URL ${url}`);
    })
  );
  return createHttpDurablePreparationSource({
    baseUrl: 'http://markreg.test',
    principal,
    secret: 'x'.repeat(32),
    reviewSource: () =>
      Promise.resolve(overrides && 'review' in overrides ? overrides.review : review)
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('durable Preparation source adapter', () => {
  it('parses and verifies exact lock, package, Formal Matter and Professional Review lineage', async () => {
    const value = await source().getPreparationLock('preparation-lock_731');
    expect(value).toMatchObject({
      sourceKind: 'DURABLE',
      preparationLockId: 'preparation-lock_731',
      version: 1,
      lockPayloadHash,
      customerId: 'customer_731'
    });
    expect(value && 'sourceKind' in value && value.documentPackage.version).toBe(8);
  });

  it('rejects a legacy-only owner response instead of casting it into production', async () => {
    await expect(
      source({
        lock: {
          preparationLockId: 'preparation-lock_731',
          documentPackageVersion: 8,
          instructionLedgerVersion: 5,
          lockedAt: at,
          snapshot: {}
        }
      }).getPreparationLock('preparation-lock_731')
    ).rejects.toMatchObject({ code: 'SOURCE_CONTRACT_MISMATCH' });
  });

  it('fails closed when pinned package lineage has changed', async () => {
    await expect(
      source({ package: { ...pkg, version: 9 } }).getPreparationLock('preparation-lock_731')
    ).rejects.toMatchObject({ code: 'PREPARATION_LOCK_NOT_CURRENT' });
  });

  it('creates Filing Authorization from durable owner scope without legacy placeholders and pins the lock fingerprint', async () => {
    const durable = source();
    const repository = new InMemoryFilingGovernanceRepository();
    const service = new FilingGovernanceService(
      repository as unknown as FilingAuthorizationRepository,
      repository as unknown as ExecutionReleaseRepository,
      repository as unknown as FilingExecutionTaskDraftRepository,
      durable,
      () => at
    );
    const authorization = await service.createAuthorization({
      preparationLockId: 'preparation-lock_731',
      preparationLockVersion: '1',
      authorizedParty: { partyId: 'customer_731', displayName: 'Durable Owner LLC' },
      authorizationCapacity: 'OWNER',
      executionChannel: 'OFFICE_PORTAL',
      idempotencyKey: 'durable-731-create'
    });
    expect(authorization.preparationSnapshot).toBeUndefined();
    expect(authorization.durablePreparationSource).toMatchObject({
      kind: 'DURABLE',
      preparationLockVersion: 1,
      preparationLockFingerprint: lockPayloadHash
    });
    expect(authorization.scope).toMatchObject({
      jurisdiction: 'US',
      applicantOwnerReference: 'Durable Owner LLC',
      trademarkReference: 'MARK ORBIT',
      classes: ['9', '42'],
      goodsServices: ['downloadable software; software as a service'],
      filingBasis: 'INTENT_TO_USE'
    });
    expect(JSON.stringify(authorization)).not.toContain('Locked applicant');
    expect(JSON.stringify(authorization)).not.toContain('Locked class');
    expect(JSON.stringify(authorization)).not.toContain('Locked goods');
  });

  it('marks a durable Filing Authorization stale when the pinned lock fingerprint changes', async () => {
    let fingerprint = lockPayloadHash;
    const durable = {
      async getPreparationLock() {
        const loaded = await source().getPreparationLock('preparation-lock_731');
        if (loaded && 'sourceKind' in loaded) return { ...loaded, lockPayloadHash: fingerprint };
        return loaded;
      }
    };
    const repository = new InMemoryFilingGovernanceRepository();
    const service = new FilingGovernanceService(
      repository as unknown as FilingAuthorizationRepository,
      repository as unknown as ExecutionReleaseRepository,
      repository as unknown as FilingExecutionTaskDraftRepository,
      durable,
      () => at
    );
    const created = await service.createAuthorization({
      preparationLockId: 'preparation-lock_731',
      preparationLockVersion: '1',
      authorizedParty: { partyId: 'customer_731', displayName: 'Durable Owner LLC' },
      authorizationCapacity: 'OWNER',
      executionChannel: 'OFFICE_PORTAL',
      idempotencyKey: 'durable-731-stale'
    });
    fingerprint = 'd'.repeat(64);
    expect((await service.getAuthorization(created.filingAuthorizationId)).status).toBe('STALE');
  });
});
