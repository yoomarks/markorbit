import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository
} from '../src/identity.js';
import { CurrentWorkspaceAuthorityService } from '../src/current-workspace-authority.js';
import {
  MemoryKnowledgeReadyPackageContentRepository,
  type KnowledgeReadyPackageContentRepository
} from '../src/knowledge-content.js';
import {
  MemoryKnowledgeIntakeRepository,
  type KnowledgeIntakeRepository
} from '../src/knowledge-intake.js';
import {
  HttpFormalMatterCurrentnessSource,
  MemoryWorkspacePrivateCaseEvidenceBindingRepository,
  WorkspacePrivateCaseEvidenceError,
  WorkspacePrivateCaseEvidenceService,
  type FormalMatterCurrentSnapshot,
  type FormalMatterCurrentnessSource
} from '../src/workspace-private-case-evidence.js';

const ids = {
  workspace: '018f0000-0000-7000-8000-000000000501',
  user: '018f0000-0000-7000-8000-000000000502',
  membership: '018f0000-0000-7000-8000-000000000503',
  workspaceB: '018f0000-0000-7000-8000-000000000504',
  userB: '018f0000-0000-7000-8000-000000000505',
  membershipB: '018f0000-0000-7000-8000-000000000506',
  binding: '018f0000-0000-7000-8000-000000000507'
} as const;

const now = '2026-09-30T12:00:00.000Z';
const future = '2030-01-01T00:00:00.000Z';
const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

const source = {
  readyPackageId: 'rdp_case_private_501',
  knowledgeWorkspaceId: 'wsp_private_case_501',
  readyPackageDigest: sha('ready-package'),
  coreIntakeId: 'intake_case_private_501',
  contentExportSha256: sha('content-export'),
  stagingDocumentId: 'std_case_private_501',
  stagingSha256: sha('staging-markdown'),
  rawArtifactId: 'art_case_private_501',
  rawArtifactSha256: sha('raw-artifact')
} as const;

const matter = {
  workspaceId: ids.workspace,
  formalMatterId: 'formal-matter_case-501',
  version: 1,
  snapshotSha256: sha('formal-matter'),
  status: 'OPEN'
} satisfies FormalMatterCurrentSnapshot;

const principal = (workspaceId: string = ids.workspace): WorkspacePrincipal =>
  workspaceId === ids.workspace
    ? {
        kind: 'WORKSPACE',
        sessionId: 'session_case_501',
        userId: ids.user,
        workspaceId: ids.workspace,
        membershipId: ids.membership,
        role: 'WORKSPACE_ADMIN',
        permissions: ['matter:read', 'matter:manage'],
        sessionExpiresAt: future
      }
    : {
        kind: 'WORKSPACE',
        sessionId: 'session_case_502',
        userId: ids.userB,
        workspaceId: ids.workspaceB,
        membershipId: ids.membershipB,
        role: 'WORKSPACE_ADMIN',
        permissions: ['matter:read', 'matter:manage'],
        sessionExpiresAt: future
      };

function readyPackageExport(): ReadyPackageContentExportV1 {
  return {
    contractVersion: '1.1',
    objectType: 'READY_PACKAGE_CONTENT_EXPORT',
    readyPackageId: source.readyPackageId,
    knowledgeWorkspaceId: source.knowledgeWorkspaceId,
    readyPackageDigest: source.readyPackageDigest,
    provenance: {
      sourceId: 'src_01H00000000000000000000501',
      conversionRunId: 'cvr_01H00000000000000000000501',
      verificationId: 'svr_01H00000000000000000000501',
      verificationOutcome: 'PASS',
      capturedAt: '2026-09-30T10:00:00.000Z',
      converter: { converterId: 'markdown-normalizer', version: '1.0.0' },
      legalTruthVerified: false
    },
    rawArtifact: {
      artifactId: source.rawArtifactId,
      sha256: source.rawArtifactSha256,
      sizeBytes: 22,
      mimeType: 'application/pdf',
      originalName: 'private-oa.pdf'
    },
    stagingDocument: {
      documentId: source.stagingDocumentId,
      sha256: source.stagingSha256,
      sizeBytes: 26,
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      content: '# Private OA\nconfidential content'
    },
    sourceGovernance: {
      snapshotVersion: '1.0',
      kind: 'STANDARD_SOURCE',
      sourceId: 'src_01H00000000000000000000501'
    }
  };
}

async function seedKnowledge(
  intakes: MemoryKnowledgeIntakeRepository,
  contents: MemoryKnowledgeReadyPackageContentRepository
) {
  await intakes.createOrFind({
    intakeId: source.coreIntakeId,
    idempotencyKey: 'case-evidence-intake',
    request: {
      readyPackageId: source.readyPackageId,
      workspaceId: ids.workspace,
      digest: source.readyPackageDigest,
      evidence: {
        artifactIds: [source.rawArtifactId],
        stagingDocumentId: source.stagingDocumentId
      },
      submittedAt: '2026-09-30T10:01:00.000Z'
    },
    requestSha256: sha('intake-request'),
    status: 'ACCEPTED',
    receivedAt: '2026-09-30T10:02:00.000Z'
  });
  await contents.createOrFind({
    intakeId: source.coreIntakeId,
    workspaceId: ids.workspace,
    readyPackageId: source.readyPackageId,
    export: readyPackageExport(),
    exportSha256: source.contentExportSha256,
    consumedAt: '2026-09-30T10:03:00.000Z'
  });
}

async function fixture() {
  const users = new InMemoryUserRepository();
  const workspaces = new InMemoryWorkspaceRepository();
  const memberships = new InMemoryMembershipRepository(users, workspaces);
  await users.create({ userId: ids.user, email: 'a@example.test', displayName: 'A' });
  await users.create({ userId: ids.userB, email: 'b@example.test', displayName: 'B' });
  await workspaces.create({ workspaceId: ids.workspace, name: 'A', slug: 'case-a' });
  await workspaces.create({ workspaceId: ids.workspaceB, name: 'B', slug: 'case-b' });
  await memberships.create({
    membershipId: ids.membership,
    userId: ids.user,
    workspaceId: ids.workspace,
    role: 'WORKSPACE_ADMIN'
  });
  await memberships.create({
    membershipId: ids.membershipB,
    userId: ids.userB,
    workspaceId: ids.workspaceB,
    role: 'WORKSPACE_ADMIN'
  });
  const intakes = new MemoryKnowledgeIntakeRepository();
  const contents = new MemoryKnowledgeReadyPackageContentRepository();
  await seedKnowledge(intakes, contents);
  let currentMatter: FormalMatterCurrentSnapshot = matter;
  const formalMatters: FormalMatterCurrentnessSource = {
    async read() {
      await Promise.resolve();
      return structuredClone(currentMatter);
    }
  };
  const repository = new MemoryWorkspacePrivateCaseEvidenceBindingRepository();
  const service = new WorkspacePrivateCaseEvidenceService({
    repository,
    currentWorkspaceAuthority: new CurrentWorkspaceAuthorityService({
      users,
      workspaces,
      memberships
    }),
    knowledgeIntakes: intakes,
    knowledgeContents: contents,
    formalMatters,
    clock: () => new Date(now),
    newId: () => ids.binding
  });
  return {
    users,
    workspaces,
    memberships,
    intakes,
    contents,
    repository,
    service,
    setMatter(value: FormalMatterCurrentSnapshot) {
      currentMatter = value;
    }
  };
}

const suggestion = (overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: 'suggest-case-evidence-501',
  formalMatterId: matter.formalMatterId,
  expectedFormalMatterVersion: matter.version,
  expectedFormalMatterSnapshotSha256: matter.snapshotSha256,
  readyPackageId: source.readyPackageId,
  expectedKnowledgeWorkspaceId: source.knowledgeWorkspaceId,
  expectedReadyPackageDigest: source.readyPackageDigest,
  expectedCoreIntakeId: source.coreIntakeId,
  expectedContentExportSha256: source.contentExportSha256,
  expectedStagingDocumentId: source.stagingDocumentId,
  expectedStagingSha256: source.stagingSha256,
  expectedRawArtifactId: source.rawArtifactId,
  expectedRawArtifactSha256: source.rawArtifactSha256,
  sourceLocators: ['knowledge://private/case-501'],
  methodProvenanceRefs: ['method://oa-p2a/case-binding-v1'],
  ...overrides
});

describe('Workspace-private exact CASE evidence binding', () => {
  it('requires explicit acceptance before issuing an exact current read grant', async () => {
    const f = await fixture();
    const suggested = await f.service.suggest(principal(), suggestion());
    expect(suggested).toMatchObject({
      status: 'SUGGESTED',
      version: 1,
      workspaceId: ids.workspace,
      formalMatterId: matter.formalMatterId,
      readyPackageId: source.readyPackageId
    });
    await expect(
      f.service.readGrant(principal(), { bindingId: suggested.bindingId, expectedVersion: 1 })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE' });
    const accepted = await f.service.decide(principal(), {
      bindingId: suggested.bindingId,
      expectedVersion: 1,
      idempotencyKey: 'accept-case-evidence-501',
      decision: 'ACCEPT'
    });
    expect(accepted).toMatchObject({ status: 'ACCEPTED', version: 2 });
    const grant = await f.service.readGrant(principal(), {
      bindingId: accepted.bindingId,
      expectedVersion: 2
    });
    expect(grant).toMatchObject({
      bindingVersion: 2,
      workspaceId: ids.workspace,
      caseId: matter.formalMatterId,
      caseVersion: 1,
      currentness: {
        workspaceAuthority: 'CURRENT',
        formalMatter: 'CURRENT',
        coreKnowledgeEvidence: 'CURRENT',
        knowledgeRetrieval: 'MUST_VERIFY'
      },
      consequences: {
        officialTruthCreated: false,
        filingAuthorized: false,
        externalActionAuthorized: false
      }
    });
    expect(JSON.stringify(grant)).not.toContain('confidential content');
    expect(JSON.stringify(accepted)).not.toContain('confidential content');
  });

  it('lists only accepted references that still match the current Matter and Core evidence', async () => {
    const f = await fixture();
    const suggested = await f.service.suggest(principal(), suggestion());
    await expect(f.service.listAccepted(principal(), matter.formalMatterId)).resolves.toMatchObject(
      {
        caseId: matter.formalMatterId,
        items: []
      }
    );
    const accepted = await f.service.decide(principal(), {
      bindingId: suggested.bindingId,
      expectedVersion: 1,
      idempotencyKey: 'accept-list-case-evidence-501',
      decision: 'ACCEPT'
    });
    const listed = await f.service.listAccepted(principal(), matter.formalMatterId);
    expect(listed).toMatchObject({
      workspaceId: ids.workspace,
      caseId: matter.formalMatterId,
      caseVersion: matter.version,
      items: [
        {
          bindingId: accepted.bindingId,
          bindingVersion: 2,
          status: 'ACCEPTED',
          currentness: { formalMatter: 'CURRENT', coreKnowledgeEvidence: 'CURRENT' },
          consequences: {
            officialTruthCreated: false,
            filingAuthorized: false,
            externalActionAuthorized: false
          }
        }
      ]
    });
    expect(JSON.stringify(listed)).not.toContain('confidential content');
    f.setMatter({ ...matter, version: 2 });
    await expect(f.service.listAccepted(principal(), matter.formalMatterId)).rejects.toMatchObject({
      code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
      status: 409
    });
  });

  it('replays the same suggestion and rejects the same key with different reviewed provenance', async () => {
    const f = await fixture();
    const first = await f.service.suggest(principal(), suggestion());
    const replay = await f.service.suggest(principal(), suggestion());
    expect(replay.bindingId).toBe(first.bindingId);
    await expect(
      f.service.suggest(
        principal(),
        suggestion({ sourceLocators: ['knowledge://private/different-reviewed-link'] })
      )
    ).rejects.toMatchObject({
      code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_REPLAY_CONFLICT',
      status: 409
    });
  });

  it('fails closed for missing or replaced Core Knowledge evidence', async () => {
    const f = await fixture();
    await expect(
      f.service.suggest(
        principal(),
        suggestion({ readyPackageId: 'rdp_missing', expectedRawArtifactId: 'art_missing' })
      )
    ).rejects.toMatchObject({ code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE' });

    const suggested = await f.service.suggest(principal(), suggestion());
    const accepted = await f.service.decide(principal(), {
      bindingId: suggested.bindingId,
      expectedVersion: 1,
      idempotencyKey: 'accept-before-replace',
      decision: 'ACCEPT'
    });
    const original = f.contents.findByReadyPackage.bind(f.contents);
    const replaced: KnowledgeReadyPackageContentRepository = {
      createOrFind: (candidate) => f.contents.createOrFind(candidate),
      async findByReadyPackage(workspaceId, readyPackageId) {
        const value = await original(workspaceId, readyPackageId);
        return value ? { ...value, exportSha256: sha('replacement-export') } : null;
      }
    };
    const guarded = new WorkspacePrivateCaseEvidenceService({
      repository: f.repository,
      currentWorkspaceAuthority: new CurrentWorkspaceAuthorityService({
        users: f.users,
        workspaces: f.workspaces,
        memberships: f.memberships
      }),
      knowledgeIntakes: f.intakes,
      knowledgeContents: replaced,
      formalMatters: {
        async read() {
          await Promise.resolve();
          return matter;
        }
      },
      clock: () => new Date(now)
    });
    await expect(
      guarded.readGrant(principal(), { bindingId: accepted.bindingId, expectedVersion: 2 })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE' });
  });

  it('fails closed when the Formal Matter version, snapshot or OPEN status changes', async () => {
    const f = await fixture();
    const suggested = await f.service.suggest(principal(), suggestion());
    const accepted = await f.service.decide(principal(), {
      bindingId: suggested.bindingId,
      expectedVersion: 1,
      idempotencyKey: 'accept-before-matter-change',
      decision: 'ACCEPT'
    });
    f.setMatter({ ...matter, version: 2 });
    await expect(
      f.service.readGrant(principal(), { bindingId: accepted.bindingId, expectedVersion: 2 })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE' });
    f.setMatter({ ...matter, status: 'CLOSED' });
    await expect(
      f.service.readGrant(principal(), { bindingId: accepted.bindingId, expectedVersion: 2 })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE' });
  });

  it('fails privacy-safely for another Workspace and after current permission is revoked', async () => {
    const f = await fixture();
    const suggested = await f.service.suggest(principal(), suggestion());
    const accepted = await f.service.decide(principal(), {
      bindingId: suggested.bindingId,
      expectedVersion: 1,
      idempotencyKey: 'accept-before-revoke',
      decision: 'ACCEPT'
    });
    await expect(
      f.service.readGrant(principal(ids.workspaceB), {
        bindingId: accepted.bindingId,
        expectedVersion: 2
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_NOT_FOUND', status: 404 });
    await f.memberships.suspend(ids.workspace, ids.user, 1);
    await expect(
      f.service.readGrant(principal(), { bindingId: accepted.bindingId, expectedVersion: 2 })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE' });
  });

  it('never allows a rejected binding to authorize evidence reads', async () => {
    const f = await fixture();
    const suggested = await f.service.suggest(principal(), suggestion());
    const rejected = await f.service.decide(principal(), {
      bindingId: suggested.bindingId,
      expectedVersion: 1,
      idempotencyKey: 'reject-case-evidence-501',
      decision: 'REJECT'
    });
    expect(rejected).toMatchObject({ status: 'REJECTED', version: 2 });
    await expect(
      f.service.readGrant(principal(), { bindingId: rejected.bindingId, expectedVersion: 2 })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE' });
  });

  it('is idempotent after an accepted response is lost and rejects a conflicting terminal replay', async () => {
    const f = await fixture();
    const suggested = await f.service.suggest(principal(), suggestion());
    const command = {
      bindingId: suggested.bindingId,
      expectedVersion: 1,
      idempotencyKey: 'accept-response-lost',
      decision: 'ACCEPT' as const
    };
    const first = await f.service.decide(principal(), command);
    const replay = await f.service.decide(principal(), command);
    expect(replay).toEqual(first);
    await expect(
      f.service.decide(principal(), {
        ...command,
        idempotencyKey: 'different-terminal-key',
        decision: 'REJECT'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_REPLAY_CONFLICT' });
  });

  it('maps unavailable Core Knowledge dependencies to retryable 503 without persistence', async () => {
    const f = await fixture();
    const unavailable: Pick<KnowledgeIntakeRepository, 'findAcceptedByReadyPackage'> = {
      findAcceptedByReadyPackage: () => Promise.reject(new Error('postgres unavailable'))
    };
    const guarded = new WorkspacePrivateCaseEvidenceService({
      repository: f.repository,
      currentWorkspaceAuthority: new CurrentWorkspaceAuthorityService({
        users: f.users,
        workspaces: f.workspaces,
        memberships: f.memberships
      }),
      knowledgeIntakes: unavailable,
      knowledgeContents: f.contents,
      formalMatters: {
        async read() {
          await Promise.resolve();
          return matter;
        }
      },
      clock: () => new Date(now),
      newId: () => ids.binding
    });
    await expect(guarded.suggest(principal(), suggestion())).rejects.toMatchObject({
      code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
    expect(await f.repository.findById(ids.binding)).toBeUndefined();
  });

  it('uses the existing MarkReg internal evidence route without trusting caller body currentness', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const adapter = new HttpFormalMatterCurrentnessSource(
      'https://markreg.internal',
      'x'.repeat(32),
      async (input, init) => {
        await Promise.resolve();
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        calls.push({ url, init });
        return new Response(
          JSON.stringify({
            workspaceId: ids.workspace,
            formalMatter: {
              formalMatterId: matter.formalMatterId,
              version: matter.version,
              snapshotSha256: matter.snapshotSha256,
              status: 'OPEN'
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
    );
    await expect(adapter.read(principal(), matter.formalMatterId)).resolves.toEqual(matter);
    expect(calls[0]?.url).toBe(
      'https://markreg.internal/internal/v1/formal-matters/' +
        encodeURIComponent(matter.formalMatterId) +
        '/evidence'
    );
    expect(new Headers(calls[0]?.init?.headers).get('x-markorbit-workspace-id')).toBe(
      ids.workspace
    );
    expect(new Headers(calls[0]?.init?.headers).get('x-markorbit-internal-authorization')).toBe(
      'x'.repeat(32)
    );
  });

  it('rejects invalid MarkReg currentness payloads and transport failures as 503', async () => {
    const invalid = new HttpFormalMatterCurrentnessSource(
      'https://markreg.internal',
      'x'.repeat(32),
      async () => {
        await Promise.resolve();
        return new Response(JSON.stringify({ workspaceId: ids.workspace }), { status: 200 });
      }
    );
    await expect(invalid.read(principal(), matter.formalMatterId)).rejects.toMatchObject({
      code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
      status: 503
    });
    const unavailable = new HttpFormalMatterCurrentnessSource(
      'https://markreg.internal',
      'x'.repeat(32),
      async () => {
        await Promise.resolve();
        throw new Error('network unavailable');
      }
    );
    await expect(unavailable.read(principal(), matter.formalMatterId)).rejects.toMatchObject({
      code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });

  it('does not surface private document bytes in expected errors', async () => {
    const f = await fixture();
    try {
      await f.service.suggest(
        principal(),
        suggestion({ expectedRawArtifactSha256: sha('wrong-private-file') })
      );
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspacePrivateCaseEvidenceError);
      expect(JSON.stringify(error)).not.toContain('confidential content');
    }
  });
});
