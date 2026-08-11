import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase } from '@markorbit/persistence';
import type {
  FormalTrademarkServiceOpportunityId,
  OpportunityCandidate,
  OpportunityQualificationDecision
} from '@markorbit/contracts/product-loop';
import {
  FormalOpportunityError,
  PostgresFormalOpportunityStore,
  type QualifiedOpportunityAuthority,
  type QualifiedOpportunityEvidence
} from '../src/formal-opportunity.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_FORMAL_OPPORTUNITY_TEST_DATABASE_URL;
const required = process.env.MARKREG_FORMAL_OPPORTUNITY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MARKREG_FORMAL_OPPORTUNITY_TEST_DATABASE_URL is required when MARKREG_FORMAL_OPPORTUNITY_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherWorkspaceId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const candidateFingerprint = 'a'.repeat(64);
const currentCandidateFingerprint = 'b'.repeat(64);

function sequence<T extends string>(prefix: string) {
  let value = 0;
  return () => `${prefix}_${++value}` as T;
}

function qualifiedEvidence(
  outcome: OpportunityQualificationDecision['outcome'] = 'QUALIFIED_FOR_MARKREG'
): QualifiedOpportunityEvidence {
  const candidate: OpportunityCandidate = {
    schemaVersion: 1,
    opportunityCandidateId: 'opportunity-candidate_candidate-001',
    workspaceId,
    version: 1,
    kind: 'TRADEMARK_SERVICE',
    customerId: 'customer_acme-001',
    title: 'Possible Canada trademark filing',
    serviceNeedSummary: 'Customer context supports reviewing a Canada trademark filing.',
    sources: [
      {
        schemaVersion: 1,
        owner: 'LITE',
        kind: 'CONTENT_USE_FEEDBACK',
        sourceId: 'product-loop-feedback_feedback-001',
        sourceVersion: 1,
        sourceFingerprintSha256: 'c'.repeat(64),
        observedAt: '2026-08-11T09:30:00.000Z'
      }
    ],
    status: 'OPEN',
    opportunityCandidateFingerprintSha256: candidateFingerprint,
    formalOpportunityCreated: false,
    customerContacted: false,
    createdAt: '2026-08-11T09:31:00.000Z',
    updatedAt: '2026-08-11T09:31:00.000Z'
  };
  const currentCandidate: OpportunityCandidate = {
    ...candidate,
    version: 2,
    status: 'DISPOSITIONED',
    opportunityCandidateFingerprintSha256: currentCandidateFingerprint,
    updatedAt: '2026-08-11T09:32:00.000Z'
  };
  const qualificationDecision: OpportunityQualificationDecision = {
    schemaVersion: 1,
    opportunityQualificationDecisionId: 'opportunity-qualification_qualification-001',
    workspaceId,
    version: 1,
    candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
    expectedCandidateFingerprintSha256: candidateFingerprint,
    outcome,
    decidedByPrincipalId: 'user_qualifier-001',
    rationale: 'The need is specific enough for the MarkReg owner boundary.',
    decidedAt: '2026-08-11T09:32:00.000Z',
    formalOpportunityCreated: false,
    customerContacted: false
  };
  return { candidate, currentCandidate, qualificationDecision };
}

suite('PostgreSQL MarkReg Formal Opportunity handoff', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-formal-opportunity-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let evidence = qualifiedEvidence();
  let authorityAvailable = true;
  const authority: QualifiedOpportunityAuthority = {
    resolve(requestWorkspaceId, candidate, qualificationDecision) {
      if (!authorityAvailable) throw new Error('Lite authority unavailable');
      if (requestWorkspaceId !== workspaceId)
        return Promise.resolve({
          ...structuredClone(evidence),
          candidate: { ...evidence.candidate, workspaceId: requestWorkspaceId },
          currentCandidate: { ...evidence.currentCandidate, workspaceId: requestWorkspaceId },
          qualificationDecision: {
            ...evidence.qualificationDecision,
            workspaceId: requestWorkspaceId
          }
        });
      expect(candidate).toEqual({
        id: evidence.candidate.opportunityCandidateId,
        version: evidence.candidate.version
      });
      expect(qualificationDecision).toEqual({
        id: evidence.qualificationDecision.opportunityQualificationDecisionId,
        version: evidence.qualificationDecision.version
      });
      return Promise.resolve(structuredClone(evidence));
    }
  };
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 7, 11, 10, 0, tick++)).toISOString();
  const opportunityId = sequence<FormalTrademarkServiceOpportunityId>(
    'trademark-service-opportunity'
  );

  function store(customAuthority: QualifiedOpportunityAuthority = authority) {
    return new PostgresFormalOpportunityStore(
      database,
      database.getPool(),
      customAuthority,
      now,
      opportunityId
    );
  }

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory,
      migrationOwners
    });
  });

  beforeEach(async () => {
    tick = 0;
    evidence = qualifiedEvidence();
    authorityAvailable = true;
    await database
      .getPool()
      .query(
        'TRUNCATE markreg_formal_opportunity_commands,markreg_intake_handoffs,markreg_formal_trademark_service_opportunities CASCADE'
      );
  });

  afterAll(() => database.close());

  const createCommand = () => ({
    workspaceId,
    candidate: {
      id: evidence.candidate.opportunityCandidateId,
      version: evidence.candidate.version
    },
    expectedCandidateFingerprintSha256: evidence.candidate.opportunityCandidateFingerprintSha256,
    qualificationDecision: {
      id: evidence.qualificationDecision.opportunityQualificationDecisionId,
      version: evidence.qualificationDecision.version
    },
    relationshipModel: 'CO_DELIVERY' as const,
    proposedCustomerIntent: {
      brandName: 'ORBIT',
      applicantCountry: 'CN',
      targetJurisdictions: ['CA'],
      goodsServicesDescription: 'Downloadable software and SaaS services.'
    },
    promotedByPrincipalId: 'user_promoter-001' as const,
    idempotencyKey: 'formal-opportunity-create-001'
  });

  it('creates MarkReg-owned Formal Opportunity and durable confirmed Intake handoff without downstream consequences', async () => {
    const first = store();
    const created = await first.createFormalOpportunity(createCommand());
    expect(created.owningService).toBe('MARKREG');
    expect(created.sourceCandidate).toEqual(createCommand().candidate);
    expect(created.sourceQualificationDecision).toEqual(createCommand().qualificationDecision);
    expect(created.customerId).toBe(evidence.candidate.customerId);
    expect(created.serviceNeedSummary).toBe(evidence.candidate.serviceNeedSummary);
    expect(created.relationshipModel).toBe('CO_DELIVERY');
    expect(created.status).toBe('QUALIFIED');
    expect(created.orderCreated).toBe(false);
    expect(created.matterCreated).toBe(false);
    expect(created.paymentCreated).toBe(false);
    expect(created.filingSubmitted).toBe(false);
    expect(created.customerContactedByCreation).toBe(false);

    const restarted = store();
    expect(
      await restarted.findFormalOpportunity(
        workspaceId,
        created.formalTrademarkServiceOpportunityId,
        1
      )
    ).toEqual(created);
    expect(await restarted.createFormalOpportunity(createCommand())).toEqual(created);

    const disposition = await restarted.prepareIntakeHandoff({
      workspaceId,
      formalOpportunity: {
        id: created.formalTrademarkServiceOpportunityId,
        version: created.version
      },
      expectedFormalOpportunityFingerprintSha256: created.formalOpportunityFingerprintSha256,
      relationshipModel: created.relationshipModel,
      customerIntent: createCommand().proposedCustomerIntent,
      confirmedByPrincipalId: 'user_handoff-001',
      idempotencyKey: 'intake-handoff-001'
    });
    expect(disposition.handoff.target).toBe('MARKREG_INTAKE');
    expect(disposition.handoff.channel).toBe('LITE_PROFESSIONAL');
    expect(disposition.handoff.intakeCreated).toBe(false);
    expect(disposition.handoff.orderCreated).toBe(false);
    expect(disposition.handoff.matterCreated).toBe(false);
    expect(disposition.currentFormalOpportunity.version).toBe(2);
    expect(disposition.currentFormalOpportunity.status).toBe('HANDED_OFF_TO_INTAKE');
    expect(disposition.currentFormalOpportunity.intakeId).toBeUndefined();
    expect(disposition.currentFormalOpportunity.orderCreated).toBe(false);
    expect(disposition.currentFormalOpportunity.matterCreated).toBe(false);
    expect(disposition.currentFormalOpportunity.paymentCreated).toBe(false);
    expect(disposition.currentFormalOpportunity.filingSubmitted).toBe(false);

    const afterHandoffRestart = store();
    expect(
      await afterHandoffRestart.findLatestFormalOpportunity(
        workspaceId,
        created.formalTrademarkServiceOpportunityId
      )
    ).toEqual(disposition.currentFormalOpportunity);
    expect(
      await afterHandoffRestart.findIntakeHandoff(
        workspaceId,
        created.formalTrademarkServiceOpportunityId
      )
    ).toEqual(disposition.handoff);
    expect(
      await afterHandoffRestart.prepareIntakeHandoff({
        workspaceId,
        formalOpportunity: {
          id: created.formalTrademarkServiceOpportunityId,
          version: created.version
        },
        expectedFormalOpportunityFingerprintSha256: created.formalOpportunityFingerprintSha256,
        relationshipModel: created.relationshipModel,
        customerIntent: createCommand().proposedCustomerIntent,
        confirmedByPrincipalId: 'user_handoff-001',
        idempotencyKey: 'intake-handoff-001'
      })
    ).toEqual(disposition);
  });

  it('fails closed unless the exact Lite Candidate was explicitly qualified and remains dispositioned', async () => {
    evidence = qualifiedEvidence('REJECTED');
    await expect(store().createFormalOpportunity(createCommand())).rejects.toMatchObject({
      code: 'CANDIDATE_NOT_QUALIFIED'
    });

    evidence = qualifiedEvidence();
    evidence = {
      ...evidence,
      currentCandidate: { ...evidence.currentCandidate, status: 'OPEN' }
    };
    await expect(
      store().createFormalOpportunity({
        ...createCommand(),
        idempotencyKey: 'formal-opportunity-stale-disposition'
      })
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });

    evidence = qualifiedEvidence();
    await expect(
      store().createFormalOpportunity({
        ...createCommand(),
        expectedCandidateFingerprintSha256: 'd'.repeat(64),
        idempotencyKey: 'formal-opportunity-wrong-fingerprint'
      })
    ).rejects.toMatchObject({ code: 'SOURCE_FINGERPRINT_MISMATCH' });

    const counts = await database.getPool().query(
      'SELECT (SELECT count(*)::int FROM markreg_formal_trademark_service_opportunities) AS opportunities,(SELECT count(*)::int FROM markreg_intake_handoffs) AS handoffs'
    );
    expect(counts.rows[0]).toMatchObject({ opportunities: 0, handoffs: 0 });
  });

  it('provides exact idempotency and only one Formal Opportunity winner per Qualification Decision', async () => {
    const service = store();
    const command = createCommand();
    const [left, right] = await Promise.allSettled([
      service.createFormalOpportunity(command),
      service.createFormalOpportunity({ ...command, idempotencyKey: 'formal-opportunity-create-002' })
    ]);
    const fulfilled = [left, right].filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.createFormalOpportunity>>> =>
        result.status === 'fulfilled'
    );
    const rejected = [left, right].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ code: 'DUPLICATE_SOURCE' });

    const replayKey = fulfilled[0]!.value.formalTrademarkServiceOpportunityId.endsWith('_1')
      ? command.idempotencyKey
      : 'formal-opportunity-create-002';
    const replay = await service.createFormalOpportunity({ ...command, idempotencyKey: replayKey });
    expect(replay).toEqual(fulfilled[0]!.value);

    await expect(
      service.createFormalOpportunity({
        ...command,
        relationshipModel: 'DIRECT',
        idempotencyKey: replayKey
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const count = await database
      .getPool()
      .query(
        'SELECT count(*)::int AS count FROM markreg_formal_trademark_service_opportunities WHERE version=1'
      );
    expect(count.rows[0]).toMatchObject({ count: 1 });
  });

  it('serializes competing handoffs and rejects stale relationship or intent changes', async () => {
    const service = store();
    const created = await service.createFormalOpportunity(createCommand());
    const handoff = {
      workspaceId,
      formalOpportunity: { id: created.formalTrademarkServiceOpportunityId, version: 1 },
      expectedFormalOpportunityFingerprintSha256: created.formalOpportunityFingerprintSha256,
      relationshipModel: created.relationshipModel,
      customerIntent: createCommand().proposedCustomerIntent,
      confirmedByPrincipalId: 'user_handoff-001' as const
    };
    const [left, right] = await Promise.allSettled([
      service.prepareIntakeHandoff({ ...handoff, idempotencyKey: 'handoff-concurrent-1' }),
      service.prepareIntakeHandoff({ ...handoff, idempotencyKey: 'handoff-concurrent-2' })
    ]);
    expect([left, right].filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const losing = [left, right].find((result) => result.status === 'rejected');
    expect(losing?.reason).toMatchObject({ code: 'VERSION_CONFLICT' });

    const other = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM markreg_intake_handoffs');
    expect(other.rows[0]).toMatchObject({ count: 1 });
  });

  it('keeps Workspace reads isolated and dependency failure distinct from formal-state persistence', async () => {
    const service = store();
    const created = await service.createFormalOpportunity(createCommand());
    expect(
      await service.findLatestFormalOpportunity(
        otherWorkspaceId,
        created.formalTrademarkServiceOpportunityId
      )
    ).toBeUndefined();
    expect(
      await service.findIntakeHandoff(otherWorkspaceId, created.formalTrademarkServiceOpportunityId)
    ).toBeUndefined();

    authorityAvailable = false;
    await expect(
      service.createFormalOpportunity({
        ...createCommand(),
        idempotencyKey: 'formal-opportunity-dependency-down'
      })
    ).rejects.toBeInstanceOf(FormalOpportunityError);
    await expect(
      service.createFormalOpportunity({
        ...createCommand(),
        idempotencyKey: 'formal-opportunity-dependency-down-2'
      })
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  });
});
