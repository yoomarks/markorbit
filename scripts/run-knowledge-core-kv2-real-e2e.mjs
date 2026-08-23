import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const INTEGRATION_ID = 'MO-KNOWLEDGE-CORE-KV2-COMPLETION-2026-08-23';
const TARGET_CORE_WORKSPACE_ID =
  process.env.MARKORBIT_E2E_CORE_WORKSPACE_ID ?? '123e4567-e89b-12d3-a456-426614174000';
const PROVIDER_SHA = process.env.KNOWLEDGE_PROVIDER_SHA ?? '';
const CORE_HEAD_SHA = process.env.CORE_HEAD_SHA ?? '';
const PROVIDER_ROOT = path.resolve(process.env.KNOWLEDGE_PROVIDER_DIR ?? 'knowledge-provider');
const ARTIFACT_DIR = path.resolve(
  process.env.KNOWLEDGE_CORE_KV2_ARTIFACT_DIR ?? '.artifacts/knowledge-core-kv2'
);
const CORE_V2_URL = required('MARKORBIT_CORE_V2_DELIVERY_URL');
const CORE_SECRET = required('MARKORBIT_CORE_INTERNAL_SECRET');
const phase = process.argv[2] ?? 'phase1';

process.env.MARKORBIT_CORE_V2_DELIVERY_URL = CORE_V2_URL;
process.env.MARKORBIT_CORE_INTERNAL_SECRET = CORE_SECRET;
process.env.MARKORBIT_CORE_V2_PROTOCOL_VERSION = '1.0';
process.env.MARKORBIT_CORE_INTAKE_URL ??= CORE_V2_URL.replace('/v2/deliveries', '/intakes');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function token(scenario) {
  return `01K14E2E00000000000000000${scenario}`;
}

function ids(scenario) {
  const value = token(scenario);
  return {
    readyPackageId: `rdp_${value}`,
    deliveryId: `rvd_${value}`,
    canonicalDocumentId: `cdd_${value}`,
    inspectionRunId: `vin_${value}`,
    importIntentId: `vmi_${value}`,
    importExecutionId: `vie_${value}`,
    vaultStagingDocumentId: `vst_${value}`,
    verificationId: `vsv_${value}`,
    finalizationId: `vsf_${value}`,
    bindingId: `vlt_${value}`
  };
}

async function providerModule(relativePath) {
  return import(pathToFileURL(path.join(PROVIDER_ROOT, relativePath)).href);
}

const [
  persistence,
  canonicalRegistry,
  readyPackageRegistry,
  deliveryRegistry,
  deliveryServiceModule,
  transportModule
] = await Promise.all([
  providerModule('packages/persistence/src/index.ts'),
  providerModule('packages/persistence/src/canonical-downstream-document.ts'),
  providerModule('packages/persistence/src/ready-package-v2-registry.ts'),
  providerModule('packages/persistence/src/ready-package-v2-delivery-submission.ts'),
  providerModule('apps/admin/src/server/ready-package-v2-delivery-service.ts'),
  providerModule('apps/admin/src/server/ready-package-v2-delivery-http-transport.ts')
]);

const { DEFAULT_WORKSPACE, initializeRegistry } = persistence;
const { ensureCanonicalDownstreamDocumentRegistry } = canonicalRegistry;
const { SqliteReadyPackageV2RegistryRepository } = readyPackageRegistry;
const { SqliteReadyPackageV2DeliverySubmissionRepository } = deliveryRegistry;
const { ReadyPackageV2DeliveryService } = deliveryServiceModule;
const { HttpReadyPackageV2DeliveryTransport } = transportModule;

const CONTENT = '# KV2 real cross-repo acceptance\n\nFrozen provider bytes.\n';
const CONTENT_SHA = sha256(Buffer.from(CONTENT, 'utf8'));
const ROOT_SHA = 'b'.repeat(64);

function canonicalDocument(scenario) {
  const scenarioIds = ids(scenario);
  return {
    contractVersion: '1.0',
    objectType: 'CANONICAL_DOWNSTREAM_DOCUMENT',
    id: scenarioIds.canonicalDocumentId,
    workspaceId: DEFAULT_WORKSPACE.id,
    status: 'PROMOTED',
    origin: {
      kind: 'VAULT_IMPORT',
      inspectionRunId: scenarioIds.inspectionRunId,
      importIntentId: scenarioIds.importIntentId,
      importExecutionId: scenarioIds.importExecutionId,
      vaultStagingDocumentId: scenarioIds.vaultStagingDocumentId,
      verificationId: scenarioIds.verificationId,
      verificationOutcome: 'PASS',
      finalizationId: scenarioIds.finalizationId,
      rootFingerprintSha256: ROOT_SHA,
      binding: {
        bindingId: scenarioIds.bindingId,
        revision: 4,
        relativeRoot: 'MarkOrbit/Review'
      },
      vaultRelativePath: `MarkOrbit/Review/incoming/e2e-${scenario}.md`,
      bindingRelativePath: `incoming/e2e-${scenario}.md`,
      observedAt: '2026-08-23T10:00:00.000Z',
      reviewedAt: '2026-08-23T10:01:00.000Z',
      importedAt: '2026-08-23T10:02:00.000Z',
      verifiedAt: '2026-08-23T10:03:00.000Z'
    },
    content: {
      sha256: CONTENT_SHA,
      sizeBytes: Buffer.byteLength(CONTENT, 'utf8'),
      contentAddressedRef: `cas:sha256:${CONTENT_SHA}`,
      mediaType: 'text/markdown',
      encoding: 'utf-8'
    },
    legalTruthVerified: false,
    promotedAt: '2026-08-23T10:04:00.000Z'
  };
}

function databasePath(scenario) {
  return path.join(ARTIFACT_DIR, `knowledge-e2e-${scenario}.sqlite`);
}

async function createFixture(scenario, { preserve = false } = {}) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const file = databasePath(scenario);
  if (!preserve) await rm(file, { force: true });
  const db = new DatabaseSync(file);
  initializeRegistry(db);
  ensureCanonicalDownstreamDocumentRegistry(db);
  const document = canonicalDocument(scenario);
  db.prepare(
    `INSERT OR IGNORE INTO canonical_downstream_documents
     (id, workspace_id, origin_kind, vault_staging_document_id, import_intent_id,
      verification_id, finalization_id, content_sha256, frozen_digest, status,
      document_json, promoted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    document.id,
    document.workspaceId,
    document.origin.kind,
    document.origin.vaultStagingDocumentId,
    document.origin.importIntentId,
    document.origin.verificationId,
    document.origin.finalizationId,
    document.content.sha256,
    'c'.repeat(64),
    document.status,
    JSON.stringify(document),
    document.promotedAt
  );
  const scenarioIds = ids(scenario);
  const readyPackages = new SqliteReadyPackageV2RegistryRepository(
    db,
    undefined,
    () => new Date('2026-08-23T10:05:00.000Z'),
    () => scenarioIds.readyPackageId
  );
  let readyPackage = readyPackages.getById(DEFAULT_WORKSPACE.id, scenarioIds.readyPackageId);
  if (!readyPackage) {
    readyPackage = readyPackages.createFromCanonical({
      workspaceId: DEFAULT_WORKSPACE.id,
      canonicalDocumentId: document.id
    }).readyPackage;
  }
  const contentExport = {
    contractVersion: '2.0',
    objectType: 'READY_PACKAGE_CONTENT_EXPORT',
    readyPackageId: readyPackage.id,
    knowledgeWorkspaceId: DEFAULT_WORKSPACE.id,
    readyPackageDigest: readyPackage.evidence.digest,
    canonicalDocument: {
      documentId: document.id,
      promotedAt: document.promotedAt
    },
    provenance: {
      origin: document.origin,
      legalTruthVerified: false
    },
    content: {
      ...document.content,
      content: CONTENT
    }
  };
  const deliveries = new SqliteReadyPackageV2DeliverySubmissionRepository(
    db,
    () => new Date('2026-08-23T10:06:00.000Z'),
    () => scenarioIds.deliveryId
  );
  return { db, file, readyPackage, contentExport, deliveries };
}

function prepare(fixture) {
  return fixture.deliveries.prepare({
    workspaceId: DEFAULT_WORKSPACE.id,
    readyPackage: fixture.readyPackage,
    coreWorkspaceId: TARGET_CORE_WORKSPACE_ID,
    contentExport: fixture.contentExport
  }).submission;
}

function service(deliveries, transport) {
  return new ReadyPackageV2DeliveryService({
    readyPackages: {},
    canonical: {},
    staging: {},
    bindings: {},
    deliveries,
    transport
  });
}

function capturingFetch(log, { loseResponse = false } = {}) {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const response = await fetch(input, init);
    log.push({
      body: String(init?.body ?? ''),
      idempotencyKey: headers.get('idempotency-key'),
      status: response.status
    });
    if (loseResponse) throw new Error('E2E_SIMULATED_RESPONSE_LOSS_AFTER_CORE_COMMIT');
    return response;
  };
}

function httpTransport(log = [], options = {}) {
  return new HttpReadyPackageV2DeliveryTransport(
    CORE_V2_URL,
    CORE_SECRET,
    capturingFetch(log, options),
    10_000
  );
}

async function postRaw(requestJson, idempotencyKey) {
  const response = await fetch(CORE_V2_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'x-markorbit-internal-authorization': CORE_SECRET,
      'x-markorbit-ready-package-v2-delivery-protocol': '1.0'
    },
    body: requestJson
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function e2e01() {
  const fixture = await createFixture(1);
  try {
    const frozen = prepare(fixture);
    const calls = [];
    const result = await service(fixture.deliveries, httpTransport(calls)).submit(
      DEFAULT_WORKSPACE.id,
      fixture.readyPackage.id
    );
    assert.equal(result.transportUsed, true);
    assert.equal(result.submission.state, 'RESULT_RECORDED');
    assert.equal(result.submission.result?.status, 'ACCEPTED');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].status, 201);
    assert.equal(calls[0].body, frozen.requestJson);
    assert.equal(calls[0].idempotencyKey, frozen.idempotencyKey);
  } finally {
    fixture.db.close();
  }
}

async function e2e02() {
  const fixture = await createFixture(2);
  try {
    const frozen = prepare(fixture);
    const lostCalls = [];
    await assert.rejects(
      service(fixture.deliveries, httpTransport(lostCalls, { loseResponse: true })).submit(
        DEFAULT_WORKSPACE.id,
        fixture.readyPackage.id
      )
    );
    const uncertain = fixture.deliveries.getByReadyPackage(
      DEFAULT_WORKSPACE.id,
      fixture.readyPackage.id
    );
    assert.ok(uncertain);
    assert.equal(uncertain.state, 'PENDING');
    assert.equal(uncertain.transportAttempts, 1);
    assert.equal(uncertain.requestJson, frozen.requestJson);
    assert.equal(uncertain.idempotencyKey, frozen.idempotencyKey);
    assert.equal(lostCalls.length, 1);
    assert.equal(lostCalls[0].status, 201);

    const retryCalls = [];
    const recovered = await service(fixture.deliveries, httpTransport(retryCalls)).submit(
      DEFAULT_WORKSPACE.id,
      fixture.readyPackage.id
    );
    assert.equal(recovered.submission.result?.status, 'ACCEPTED');
    assert.equal(recovered.submission.transportAttempts, 2);
    assert.equal(retryCalls.length, 1);
    assert.equal(retryCalls[0].status, 200);
    assert.equal(retryCalls[0].body, frozen.requestJson);
    assert.equal(retryCalls[0].idempotencyKey, frozen.idempotencyKey);
  } finally {
    fixture.db.close();
  }
}

async function e2e03PrepareCrash() {
  const fixture = await createFixture(3);
  const frozen = prepare(fixture);
  const calls = [];
  const crashRepository = new Proxy(fixture.deliveries, {
    get(target, property, receiver) {
      if (property === 'recordResult') {
        return () => {
          throw new Error('E2E_SIMULATED_KNOWLEDGE_PROCESS_CRASH_BEFORE_FINALIZATION');
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  try {
    await assert.rejects(
      service(crashRepository, httpTransport(calls)).submit(
        DEFAULT_WORKSPACE.id,
        fixture.readyPackage.id
      ),
      /E2E_SIMULATED_KNOWLEDGE_PROCESS_CRASH_BEFORE_FINALIZATION/u
    );
    const pending = fixture.deliveries.getByReadyPackage(
      DEFAULT_WORKSPACE.id,
      fixture.readyPackage.id
    );
    assert.ok(pending);
    assert.equal(pending.state, 'PENDING');
    assert.equal(pending.transportResult?.status, 'ACCEPTED');
    assert.equal(pending.result, undefined);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].status, 201);
    assert.equal(calls[0].body, frozen.requestJson);
  } finally {
    fixture.db.close();
  }
}

async function e2e03RecoverAfterRestart() {
  const file = databasePath(3);
  const db = new DatabaseSync(file);
  const deliveries = new SqliteReadyPackageV2DeliverySubmissionRepository(db);
  let networkCalls = 0;
  const trapTransport = {
    async submit() {
      networkCalls += 1;
      throw new Error('E2E_NETWORK_MUST_NOT_BE_USED_DURING_LOCAL_FINALIZATION');
    }
  };
  try {
    const before = deliveries.getByReadyPackage(DEFAULT_WORKSPACE.id, ids(3).readyPackageId);
    assert.ok(before);
    assert.equal(before.state, 'PENDING');
    assert.equal(before.transportResult?.status, 'ACCEPTED');
    const recovered = await service(deliveries, trapTransport).submit(
      DEFAULT_WORKSPACE.id,
      ids(3).readyPackageId
    );
    assert.equal(recovered.transportUsed, false);
    assert.equal(recovered.replayed, true);
    assert.equal(recovered.submission.state, 'RESULT_RECORDED');
    assert.equal(recovered.submission.result?.status, 'ACCEPTED');
    assert.equal(networkCalls, 0);
  } finally {
    db.close();
  }
}

async function e2e04() {
  const fixture = await createFixture(4);
  prepare(fixture);
  const row = fixture.db
    .prepare(
      `SELECT document_json FROM ready_package_v2_delivery_submissions
       WHERE workspace_id = ? AND ready_package_id = ?`
    )
    .get(DEFAULT_WORKSPACE.id, fixture.readyPackage.id);
  assert.ok(row);
  const corrupted = JSON.parse(row.document_json);
  corrupted.requestJson = corrupted.requestJson.replace('Frozen provider bytes.', 'CORRUPTED bytes.');
  fixture.db
    .prepare(
      `UPDATE ready_package_v2_delivery_submissions
       SET document_json = ? WHERE workspace_id = ? AND ready_package_id = ?`
    )
    .run(JSON.stringify(corrupted), DEFAULT_WORKSPACE.id, fixture.readyPackage.id);
  fixture.db.close();

  const reopened = new DatabaseSync(fixture.file);
  try {
    const deliveries = new SqliteReadyPackageV2DeliverySubmissionRepository(reopened);
    assert.throws(
      () => deliveries.getByReadyPackage(DEFAULT_WORKSPACE.id, fixture.readyPackage.id),
      (error) =>
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'READY_PACKAGE_V2_DELIVERY_PERSISTED_STATE_INVALID'
    );
  } finally {
    reopened.close();
  }
}

async function e2e05() {
  const fixture = await createFixture(5);
  try {
    const frozen = prepare(fixture);
    const request = JSON.parse(frozen.requestJson);
    request.contentExportSha256 = 'f'.repeat(64);
    const invalidJson = JSON.stringify(request);
    const first = await postRaw(invalidJson, frozen.idempotencyKey);
    const second = await postRaw(invalidJson, frozen.idempotencyKey);
    assert.equal(first.status, 409);
    assert.equal(second.status, 409);
    assert.equal(first.body.code, 'KNOWLEDGE_V2_CONTENT_EXPORT_DIGEST_MISMATCH');
    assert.deepEqual(second.body, first.body);
  } finally {
    fixture.db.close();
  }
}

async function e2e06() {
  const fixture = await createFixture(6);
  try {
    const frozen = prepare(fixture);
    const first = await postRaw(frozen.requestJson, frozen.idempotencyKey);
    assert.equal(first.status, 201);
    assert.equal(first.body.status, 'ACCEPTED');
    const byteDifferent = JSON.stringify(JSON.parse(frozen.requestJson), null, 2);
    assert.notEqual(byteDifferent, frozen.requestJson);
    const conflict = await postRaw(byteDifferent, frozen.idempotencyKey);
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, 'KNOWLEDGE_V2_IDEMPOTENCY_CONFLICT');
  } finally {
    fixture.db.close();
  }
}

async function e2e07() {
  const fixture = await createFixture(7);
  try {
    const frozen = prepare(fixture);
    const calls = [];
    const transport = httpTransport(calls);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => transport.submit(frozen.requestJson, frozen.idempotencyKey))
    );
    assert.ok(results.every((result) => result.status === 'ACCEPTED'));
    assert.ok(results.every((result) => result.requestSha256 === frozen.requestSha256));
    const statuses = calls.map((call) => call.status).sort((left, right) => left - right);
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 200, 201]);
    const attempted = fixture.deliveries.markTransportAttempt(
      DEFAULT_WORKSPACE.id,
      frozen.submissionId
    );
    assert.equal(attempted.transportAttempts, 1);
    const transportRecorded = fixture.deliveries.recordTransportResult(
      DEFAULT_WORKSPACE.id,
      frozen.submissionId,
      results[0]
    );
    assert.equal(transportRecorded.transportResult?.status, 'ACCEPTED');
    const finalized = fixture.deliveries.recordResult(
      DEFAULT_WORKSPACE.id,
      frozen.submissionId,
      results[0]
    );
    assert.equal(finalized.state, 'RESULT_RECORDED');
  } finally {
    fixture.db.close();
  }
}

async function writeEvidence(name, value) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(
    path.join(ARTIFACT_DIR, name),
    `${JSON.stringify(
      {
        integrationId: INTEGRATION_ID,
        providerSha: PROVIDER_SHA,
        coreHeadSha: CORE_HEAD_SHA,
        ...value
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

if (phase === 'phase1') {
  await e2e01();
  await e2e02();
  await e2e03PrepareCrash();
  await e2e04();
  await e2e05();
  await e2e06();
  await e2e07();
  await writeEvidence('v2-phase1.json', {
    scenarios: {
      'E2E-01': 'PASS',
      'E2E-02': 'PASS',
      'E2E-03': 'AWAITING_PROCESS_RESTART',
      'E2E-04': 'PASS',
      'E2E-05': 'PASS',
      'E2E-06': 'PASS',
      'E2E-07': 'PASS'
    },
    realHttp: true,
    realCorePostgresql: true,
    realKnowledgeSqlite: true,
    processRestart: 'phase-2-required',
    productionActivation: false
  });
  process.stdout.write('Knowledge/Core KV2 real E2E phase 1 PASS (E2E-01,02,04-07; E2E-03 crash point durable).\n');
} else if (phase === 'recover') {
  await e2e03RecoverAfterRestart();
  await writeEvidence('v2-restart-recovery.json', {
    scenarios: { 'E2E-03': 'PASS' },
    processRestart: true,
    localFinalizationWithoutHttp: true,
    productionActivation: false
  });
  process.stdout.write('Knowledge/Core KV2 E2E-03 process-restart recovery PASS.\n');
} else {
  throw new Error(`Unknown phase: ${phase}`);
}
