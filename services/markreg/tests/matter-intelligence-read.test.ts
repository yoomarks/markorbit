import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { CN_DURATION_BAND_ACCEPTED_DATASET_REF } from '@markorbit/contracts/brain-cn-duration-band-classification';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createMatterIntelligenceReadRoutes } from '../src/matter-intelligence-read-http.js';
import {
  MatterIntelligenceReadError,
  MatterIntelligenceReadService,
  type MatterIntelligenceReadRepository
} from '../src/matter-intelligence-read.js';
import type { MarkRegMatterIntelligenceObservationV1 } from '../src/matter-intelligence.js';
import type { MarkRegMatterIntelligenceReviewV1 } from '../src/matter-intelligence-review.js';

const workspaceId = '77777777-7777-4777-8777-777777777777';
const otherWorkspaceId = '88888888-8888-4888-8888-888888888888';
const formalMatterId = 'formal-matter_intelligence-read' as FormalMatterId;
const secret = 'markreg-intelligence-read-secret-32-bytes-minimum';
const active: ServiceRuntime[] = [];

const evidenceRefs = [
  'brain-method-package:package_cn-duration@1',
  'brain-method:method_cn-duration',
  'brain-method-version:method-version_cn-duration',
  'brain-method-evaluation:evaluation_cn-duration',
  `research-dataset:${CN_DURATION_BAND_ACCEPTED_DATASET_REF}:accepted`
];
const evidenceFingerprintSha256 = createHash('sha256')
  .update(JSON.stringify(evidenceRefs))
  .digest('hex');

function principal(
  permissions: WorkspacePrincipal['permissions'] = ['workspace:read'],
  workspace = workspaceId
): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_intelligence-read',
    userId: 'user_intelligence-read',
    workspaceId: workspace,
    membershipId: 'membership_intelligence-read',
    role: 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-09-02T00:00:00.000Z'
  };
}

function observation(): MarkRegMatterIntelligenceObservationV1 {
  return {
    schemaVersion: 1,
    matterIntelligenceObservationId: 'matter-intelligence-observation_read-one',
    workspaceId,
    formalMatter: {
      id: formalMatterId,
      version: 1,
      snapshotSha256: 'a'.repeat(64)
    },
    observationKind: 'CN_COMPLETED_DURATION_HISTORICAL_BAND',
    observedCompletedDurationDays: 336,
    historicalBand: 'LOWER_INTERQUARTILE',
    datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      inputSchemaId: 'brain-input.cn-completed-duration-historical-band.v1',
      outputSchemaId: 'brain.cn-completed-duration-historical-band.v1'
    },
    capabilityRequestId: 'capreq_read-one',
    capabilityInvocationId: 'capability-invocation_read-one',
    capabilityOutcomeId: 'capability-outcome_read-one',
    capabilityReturnId: 'capability-return_read-one',
    sessionReceiptId: 'session-receipt_read-one',
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      implementationKey: 'brain-method-package-runtime.cn-duration-band-classification.v1'
    },
    correlationId: 'correlation-read-one',
    capabilityCorrelationId: 'capability-correlation-read-one',
    methodPackageRef: evidenceRefs[0]!,
    methodRef: evidenceRefs[1]!,
    methodVersionRef: evidenceRefs[2]!,
    evaluationRef: evidenceRefs[3]!,
    researchDatasetRef: evidenceRefs[4]!,
    evidenceRefs,
    evidenceFingerprintSha256,
    inputFingerprintSha256: 'c'.repeat(64),
    outputFingerprintSha256: 'd'.repeat(64),
    recordedByPrincipalId: 'user_intelligence-read',
    recordedAt: '2026-08-31T10:00:00.000Z'
  };
}

function mismatchedReview(
  item: MarkRegMatterIntelligenceObservationV1
): MarkRegMatterIntelligenceReviewV1 {
  return {
    schemaVersion: 1,
    matterIntelligenceReviewId: 'matter-intelligence-review_read-one',
    workspaceId,
    formalMatterId,
    matterIntelligenceObservationId: item.matterIntelligenceObservationId,
    observationFingerprintSha256: '0'.repeat(64),
    reviewVersion: 1,
    outcome: 'CONFIRMED',
    reviewedByPrincipalId: 'reviewer_intelligence-read',
    reviewedAt: '2026-08-31T10:05:00.000Z',
    reviewPayloadFingerprintSha256: '1'.repeat(64),
    reviewFingerprintSha256: '2'.repeat(64),
    productSourceFingerprintSha256: '3'.repeat(64),
    correlationId: 'correlation-review-read-one'
  };
}

function repository(
  value: {
    observations?: readonly MarkRegMatterIntelligenceObservationV1[];
    reviews?: Readonly<
      Record<string, { items: readonly MarkRegMatterIntelligenceReviewV1[]; total: number }>
    >;
    total?: number;
    missing?: boolean;
    failure?: boolean;
  } = {}
): MatterIntelligenceReadRepository {
  return {
    readMatter() {
      if (value.failure)
        return Promise.reject(
          new MatterIntelligenceReadError('PERSISTENCE_UNAVAILABLE', 'read unavailable', 503, true)
        );
      if (value.missing) return Promise.resolve(null);
      return Promise.resolve({
        formalMatter: { id: formalMatterId, version: 1, snapshotSha256: 'a'.repeat(64) },
        observations: value.observations ?? [],
        reviewsByObservationId: value.reviews ?? {},
        total: value.total ?? value.observations?.length ?? 0
      });
    }
  };
}

async function stack(store: MatterIntelligenceReadRepository) {
  const runtime = createServiceRuntime(
    { name: 'markreg-intelligence-read-test', port: 0, version: '1' },
    {
      routes: createMatterIntelligenceReadRoutes({
        internalServiceSecret: secret,
        service: new MatterIntelligenceReadService(store)
      })
    }
  );
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

function headers(value: WorkspacePrincipal) {
  return {
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId
  };
}

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

describe('governed MarkReg Matter Intelligence reads', () => {
  it('returns an honest empty result with read-only authority semantics', async () => {
    const base = await stack(repository());
    const response = await fetch(
      `${base}/internal/v1/formal-matters/${formalMatterId}/intelligence`,
      { headers: headers(principal()) }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      formalMatter: { id: formalMatterId, version: 1 },
      items: [],
      total: 0,
      semantics: {
        descriptiveHistoricalEvidence: true,
        prediction: false,
        deadline: false,
        serviceLevelAgreement: false,
        officialStatus: false
      },
      authorityConsequences: {
        officialTruthCreated: false,
        lifecycleStateMutated: false,
        formalMatterMutated: false,
        filingAuthorized: false,
        paymentAuthorized: false,
        externalActionExecuted: false
      }
    });
  });

  it('requires only workspace:read, rejects wrong Workspace without disclosure and enforces query bounds', async () => {
    const base = await stack(repository());

    const denied = await fetch(
      `${base}/internal/v1/formal-matters/${formalMatterId}/intelligence`,
      { headers: headers(principal([])) }
    );
    expect(denied.status).toBe(403);

    const wrongHeaders = {
      ...headers(principal(['workspace:read'], otherWorkspaceId)),
      'x-markorbit-workspace-id': workspaceId
    };
    const wrongWorkspace = await fetch(
      `${base}/internal/v1/formal-matters/${formalMatterId}/intelligence`,
      { headers: wrongHeaders }
    );
    expect(wrongWorkspace.status).toBe(404);

    const invalidPageSize = await fetch(
      `${base}/internal/v1/formal-matters/${formalMatterId}/intelligence?pageSize=51`,
      { headers: headers(principal()) }
    );
    expect(invalidPageSize.status).toBe(422);
  });

  it('distinguishes unknown Matter and persistence failure from a successful empty read', async () => {
    const missingBase = await stack(repository({ missing: true }));
    const missing = await fetch(
      `${missingBase}/internal/v1/formal-matters/${formalMatterId}/intelligence`,
      { headers: headers(principal()) }
    );
    expect(missing.status).toBe(404);

    const failureBase = await stack(repository({ failure: true }));
    const failure = await fetch(
      `${failureBase}/internal/v1/formal-matters/${formalMatterId}/intelligence`,
      { headers: headers(principal()) }
    );
    expect(failure.status).toBe(503);
  });

  it('fails closed when a persisted Human Review is not fingerprint-bound to the exact observation', async () => {
    const item = observation();
    const review = mismatchedReview(item);
    const base = await stack(
      repository({
        observations: [item],
        reviews: {
          [item.matterIntelligenceObservationId]: { items: [review], total: 1 }
        }
      })
    );
    const response = await fetch(
      `${base}/internal/v1/formal-matters/${formalMatterId}/intelligence`,
      { headers: headers(principal()) }
    );
    expect(response.status).toBe(503);
  });
});
