import { describe, expect, it } from 'vitest';
import {
  ROLE_PERMISSION_MATRIX,
  type FormalMatter,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { InMemoryFormalMatterRepository } from '../src/formal-matter.js';
import {
  HttpKnowledgeCaseIntakeClient,
  InMemoryKnowledgeCasePromotionRepository,
  KnowledgeCasePromotionService,
  knowledgeCaseSourceIdentitySha256,
  type KnowledgeCaseCandidateV1,
  type KnowledgeCaseIntakeClient,
  type KnowledgeCaseIntakeReceiptV1
} from '../src/knowledge-case-promotion.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const promotedAt = '2026-08-25T12:00:00.000Z';
const acceptedAt = '2026-08-25T12:00:01.000Z';

const formalMatter = (): FormalMatter => ({
  schemaVersion: 1,
  formalMatterId: 'formal-matter_case001',
  workspaceId,
  kind: 'TRADEMARK_REGISTRATION',
  status: 'OPEN',
  version: 1,
  sourceCustomerConfirmationId: 'confirmation_case001',
  sourceCustomerConfirmationVersion: 1,
  sourceMatterDraftId: 'matter-draft_case001',
  sourceMatterDraftVersion: 1,
  sourceQuoteId: 'quote_case001',
  sourceQuoteVersion: 'quote-v1',
  sourceSnapshot: {
    schemaVersion: 1,
    customerConfirmation: { id: 'confirmation_case001', version: 1, status: 'CONFIRMED' },
    quote: { id: 'quote_case001', version: 'quote-v1', currency: 'USD', totalMinor: 29900 },
    matterDraft: {
      id: 'matter-draft_case001',
      version: 1,
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      readiness: {
        evaluatedAt: promotedAt,
        readyForProfessionalReview: true,
        checks: []
      }
    },
    preparation: { classes: [9], documentReferences: [] }
  },
  snapshotSchemaVersion: 1,
  snapshotSha256: 'a'.repeat(64),
  createdByUserId: 'user_creator',
  createdAt: promotedAt,
  updatedAt: promotedAt
});

const principal = (permissions: WorkspacePrincipal['permissions']): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_case-promotion',
  userId: 'user_case-operator',
  workspaceId,
  membershipId: 'membership_case-operator',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

function receipt(candidate: KnowledgeCaseCandidateV1): KnowledgeCaseIntakeReceiptV1 {
  return {
    candidate: structuredClone(candidate),
    intake: {
      protocolVersion: '1.0',
      objectType: 'CASE_CANDIDATE_INTAKE',
      candidateId: candidate.candidateId,
      sourceIdentitySha256: knowledgeCaseSourceIdentitySha256({
        workspaceId: candidate.accessScope.sourceWorkspaceId,
        formalMatterId: candidate.sourceMatterId,
        formalMatterVersion: candidate.sourceMatterVersion,
        snapshotSha256: candidate.sourceSnapshotSha256
      }),
      collectionState: 'PENDING',
      acceptedAt,
      updatedAt: acceptedAt
    }
  };
}

async function seededMatterRepository() {
  const repository = new InMemoryFormalMatterRepository();
  const matter = formalMatter();
  await repository.createAtomically(matter, 'matter-create-key', 'matter-create-fingerprint', {
    workspaceId,
    formalMatterId: matter.formalMatterId,
    action: 'FORMAL_MATTER_CREATED',
    actorId: 'user_creator',
    createdAt: promotedAt
  });
  return repository;
}

class RecordingIntake implements KnowledgeCaseIntakeClient {
  readonly candidates: KnowledgeCaseCandidateV1[] = [];
  constructor(private readonly fail = false) {}
  accept(candidate: KnowledgeCaseCandidateV1, principal: WorkspacePrincipal) {
    void principal;
    this.candidates.push(structuredClone(candidate));
    if (this.fail) return Promise.reject(new Error('connection reset after request dispatch'));
    return Promise.resolve(receipt(candidate));
  }
}

describe('K-CASE-002 MarkReg Knowledge Case promotion', () => {
  it('grants the dedicated promotion permission only to authoring roles', () => {
    expect(ROLE_PERMISSION_MATRIX.WORKSPACE_ADMIN).toContain('matter:promote-knowledge');
    expect(ROLE_PERMISSION_MATRIX.MATTER_MANAGER).toContain('matter:promote-knowledge');
    expect(ROLE_PERMISSION_MATRIX.REVIEWER).not.toContain('matter:promote-knowledge');
    expect(ROLE_PERMISSION_MATRIX.READ_ONLY).not.toContain('matter:promote-knowledge');
  });

  it('constructs one exact CaseCandidate and replays without a second downstream write', async () => {
    const matterRepository = await seededMatterRepository();
    const promotionRepository = new InMemoryKnowledgeCasePromotionRepository();
    const intake = new RecordingIntake();
    const service = new KnowledgeCasePromotionService(
      matterRepository,
      promotionRepository,
      intake,
      () => promotedAt
    );
    const operator = principal(['matter:read', 'matter:promote-knowledge']);

    const first = await service.promote(operator, 'formal-matter_case001', 'promotion-key-0001', {
      classification: 'CONFIDENTIAL',
      operatorCaseValueNote: 'Potential precedent value.'
    });
    const replay = await service.promote(operator, 'formal-matter_case001', 'promotion-key-0001', {
      classification: 'CONFIDENTIAL',
      operatorCaseValueNote: 'Potential precedent value.'
    });

    expect(intake.candidates).toHaveLength(1);
    const candidate = intake.candidates[0]!;
    const sourceHash = knowledgeCaseSourceIdentitySha256({
      workspaceId,
      formalMatterId: 'formal-matter_case001',
      formalMatterVersion: 1,
      snapshotSha256: 'a'.repeat(64)
    });
    expect(candidate).toEqual({
      protocolVersion: '1.0',
      objectType: 'CASE_CANDIDATE',
      candidateId: `case-candidate_${sourceHash}`,
      sourceSystem: 'MARKREG',
      sourceMatterId: 'formal-matter_case001',
      sourceMatterVersion: 1,
      sourceSnapshotSha256: 'a'.repeat(64),
      sourceRetrievalRef: `markreg:case-source:v1:${sourceHash}`,
      promotedBy: 'user_case-operator',
      promotedAt,
      operatorCaseValueNote: 'Potential precedent value.',
      accessScope: { sourceWorkspaceId: workspaceId, classification: 'CONFIDENTIAL' },
      idempotencyKey: 'promotion-key-0001'
    });
    expect(first.producerPromotionRef).toBe(`markreg:case-promotion:v1:${sourceHash}`);
    expect(first.delivery).toEqual({ state: 'ACCEPTED', replayed: false });
    expect(replay.delivery).toEqual({ state: 'ACCEPTED', replayed: true });
    expect(replay.candidate).toEqual(first.candidate);
    expect(replay.intake).toEqual(first.intake);
  });

  it('aliases a new idempotency key for identical source semantics without mutating the candidate', async () => {
    const matterRepository = await seededMatterRepository();
    const intake = new RecordingIntake();
    const service = new KnowledgeCasePromotionService(
      matterRepository,
      new InMemoryKnowledgeCasePromotionRepository(),
      intake,
      () => promotedAt
    );
    const operator = principal(['matter:promote-knowledge']);
    const input = { classification: 'INTERNAL' as const, operatorCaseValueNote: 'Reusable facts.' };

    const first = await service.promote(
      operator,
      'formal-matter_case001',
      'promotion-key-0002',
      input
    );
    const second = await service.promote(
      operator,
      'formal-matter_case001',
      'promotion-key-0003',
      input
    );

    expect(intake.candidates).toHaveLength(1);
    expect(second.delivery.replayed).toBe(true);
    expect(second.candidate).toEqual(first.candidate);
    expect(second.candidate.idempotencyKey).toBe('promotion-key-0002');
  });

  it('rejects changed source promotion semantics and read-only callers before downstream dispatch', async () => {
    const matterRepository = await seededMatterRepository();
    const intake = new RecordingIntake();
    const service = new KnowledgeCasePromotionService(
      matterRepository,
      new InMemoryKnowledgeCasePromotionRepository(),
      intake,
      () => promotedAt
    );
    const operator = principal(['matter:promote-knowledge']);

    await service.promote(operator, 'formal-matter_case001', 'promotion-key-0004', {
      classification: 'INTERNAL'
    });
    await expect(
      service.promote(operator, 'formal-matter_case001', 'promotion-key-0005', {
        classification: 'RESTRICTED'
      })
    ).rejects.toMatchObject({ code: 'SOURCE_PROMOTION_CONFLICT' });
    await expect(
      service.promote(principal(['matter:read']), 'formal-matter_case001', 'promotion-key-0006', {
        classification: 'INTERNAL'
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(intake.candidates).toHaveLength(1);
  });

  it('fails closed after ambiguous delivery and never blindly resends the same promotion', async () => {
    const matterRepository = await seededMatterRepository();
    const intake = new RecordingIntake(true);
    const service = new KnowledgeCasePromotionService(
      matterRepository,
      new InMemoryKnowledgeCasePromotionRepository(),
      intake,
      () => promotedAt
    );
    const operator = principal(['matter:promote-knowledge']);
    const input = { classification: 'CONFIDENTIAL' as const };

    await expect(
      service.promote(operator, 'formal-matter_case001', 'promotion-key-0007', input)
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_INTAKE_RECONCILIATION_REQUIRED' });
    await expect(
      service.promote(operator, 'formal-matter_case001', 'promotion-key-0007', input)
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_INTAKE_RECONCILIATION_REQUIRED' });
    expect(intake.candidates).toHaveLength(1);
  });

  it('uses authenticated Knowledge intake + collection with the same Workspace Principal', async () => {
    const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
    const candidate: KnowledgeCaseCandidateV1 = {
      protocolVersion: '1.0',
      objectType: 'CASE_CANDIDATE',
      candidateId: `case-candidate_${'b'.repeat(64)}`,
      sourceSystem: 'MARKREG',
      sourceMatterId: 'formal-matter_a',
      sourceMatterVersion: 1,
      sourceSnapshotSha256: 'a'.repeat(64),
      sourceRetrievalRef: `markreg:case-source:v1:${'b'.repeat(64)}`,
      promotedBy: 'user_case-operator',
      promotedAt,
      accessScope: { sourceWorkspaceId: workspaceId, classification: 'INTERNAL' },
      idempotencyKey: 'promotion-key-http'
    };
    const fakeFetch: typeof fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      seen.push({ url, init });
      if (seen.length === 1)
        return Promise.resolve(
          new Response(JSON.stringify(receipt(candidate)), {
            status: 202,
            headers: { 'content-type': 'application/json' }
          })
        );
      return Promise.resolve(
        new Response(
          JSON.stringify({
            candidateId: candidate.candidateId,
            collection: { collectionRef: 'case-evidence:test' }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    };
    const internalSecret = 'k'.repeat(32);
    const operator = principal(['matter:read', 'matter:promote-knowledge']);
    const client = new HttpKnowledgeCaseIntakeClient(
      'http://knowledge.internal/',
      internalSecret,
      fakeFetch
    );

    await expect(client.accept(candidate, operator)).resolves.toEqual(receipt(candidate));
    expect(seen.map((entry) => entry.url)).toEqual([
      'http://knowledge.internal/api/internal/case-candidates',
      `http://knowledge.internal/api/internal/case-candidates/${candidate.candidateId}/collect`
    ]);
    const intakeHeaders = seen[0]!.init?.headers as Record<string, string>;
    const collectionHeaders = seen[1]!.init?.headers as Record<string, string>;
    expect(intakeHeaders['x-markorbit-internal-authorization']).toBe(internalSecret);
    expect(intakeHeaders['x-markorbit-principal']).toBeTruthy();
    expect(intakeHeaders['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(collectionHeaders['x-markorbit-internal-authorization']).toBe(internalSecret);
    expect(collectionHeaders['x-markorbit-principal']).toBe(intakeHeaders['x-markorbit-principal']);
    expect(seen[0]!.init?.body).toBe(JSON.stringify(candidate));
  });
});
