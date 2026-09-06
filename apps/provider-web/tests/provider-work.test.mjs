import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProviderWorkClient,
  normalizeWorkspaceContext,
  ProviderWorkClientError
} from '../src/provider-work-api.js';
import {
  parseProviderWorkDetailBody,
  parseProviderWorkListBody,
  parseProviderReturnBody,
  ProviderWorkModelError,
  toProviderWorkItemViewModel
} from '../src/provider-work-model.js';

const workspaceId = '018f0000-0000-7000-8000-000000004190';

const privacyExclusions = Object.freeze({
  allocationRationaleIncluded: false,
  allocatorIdentityIncluded: false,
  supplyCapabilityContentsIncluded: false,
  servicePackageSourceSnapshotIncluded: false,
  providerAcceptanceAcknowledgementIncluded: false,
  providerReturnArtifactsIncluded: false,
  providerReturnAssertionsIncluded: false,
  endClientRelationshipInformationIncluded: false,
  endClientContactIncluded: false,
  originatingPricingMarginProfitIncluded: false,
  privateCrmContextIncluded: false,
  unrelatedCommunicationsIncluded: false,
  unrelatedAssetsOrMattersIncluded: false,
  rawPrivateEvidenceIncluded: false
});

const authorityConsequences = Object.freeze({
  createsProviderSelection: false,
  createsProviderAllocation: false,
  createsProviderAcceptance: false,
  createsProviderEngagement: false,
  createsProfessionalAppointment: false,
  authorizesExternalContact: false,
  authorizesProtectedActionRelease: false,
  authorizesFiling: false,
  submitsFiling: false,
  authorizesPayment: false,
  createsPayment: false,
  createsOfficialTruth: false,
  completesMatter: false
});

function item(overrides = {}) {
  return {
    schemaVersion: 1,
    provider: { providerId: 'provider_fixture-419', providerWorkspaceId: workspaceId },
    allocation: {
      allocationId: 'allocation_fixture-419',
      version: 3,
      status: 'ACTIVE',
      updatedAt: '2026-09-01T09:50:00.000Z'
    },
    servicePackage: {
      servicePackage: { id: 'service-package_fixture-419', version: 4 },
      servicePackageFingerprintSha256: '4'.repeat(64)
    },
    origin: {
      originatingWorkspaceId: '018f0000-0000-7000-8000-000000004191',
      professionalReference: 'professional-organization:fixture-419',
      exposureClass: 'ORIGINATING_PROFESSIONAL_REFERENCE_ONLY'
    },
    actionLineage: {
      correlationId: 'correlation_provider-work-fixture-419',
      actionAuthorityNotGrantedByProjection: true
    },
    responseState: {
      kind: 'KNOWN_ABSENT',
      checkedAt: '2026-09-01T10:00:00.000Z',
      absenceScopeFingerprintSha256: 'c'.repeat(64),
      allocationActiveDoesNotImplyPendingResponse: true
    },
    returnState: {
      kind: 'KNOWN_ABSENT',
      checkedAt: '2026-09-01T10:00:00.000Z',
      absenceScopeFingerprintSha256: 'd'.repeat(64)
    },
    incomingDataAuthority: {
      state: 'UNKNOWN',
      checkedAt: '2026-09-01T10:00:00.000Z',
      reason: 'AUTHORITY_STATE_NOT_ESTABLISHED',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    },
    sourceChecks: [],
    sourceSetFingerprintSha256: '5'.repeat(64),
    projectionFingerprintSha256: '6'.repeat(64),
    projectedAt: '2026-09-01T10:00:00.000Z',
    privacyExclusions,
    authorityConsequences,
    allocationIsExistingM4TruthNotCreatedByProjection: true,
    queuePresenceIsNotActionAuthority: true,
    ...overrides
  };
}

function response({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    }
  };
}

test('workspace context is normalized but never self-establishes authority', () => {
  assert.equal(normalizeWorkspaceContext(` ${workspaceId.toUpperCase()} `), workspaceId);
  assert.throws(() => normalizeWorkspaceContext('provider-123'), ProviderWorkClientError);
});

test('client sends only bounded list query and Provider Workspace context header', async () => {
  const calls = [];
  const client = createProviderWorkClient({
    workspaceId,
    fetchImpl: async (...args) => {
      calls.push(args);
      return response({ body: { providerWorkItemList: {} } });
    }
  });
  await client.list({ limit: 25, cursor: 'cursor-value' });
  assert.equal(calls.length, 1);
  const [url, init] = calls[0];
  const parsed = new URL(url, 'https://markorbit.test');
  assert.equal(parsed.pathname, '/api/provider/work-items');
  assert.deepEqual([...parsed.searchParams.keys()].sort(), ['cursor', 'limit']);
  assert.equal(parsed.searchParams.get('limit'), '25');
  assert.equal(parsed.searchParams.get('cursor'), 'cursor-value');
  assert.equal(init.method, 'GET');
  assert.equal(init.credentials, 'same-origin');
  assert.equal(init.headers['x-markorbit-provider-workspace-id'], workspaceId);
  assert.equal('providerId' in init.headers, false);
  await assert.rejects(() => client.list({ limit: 101 }), /between 1 and 100/);
});

test('detail URL encodes only an exact Allocation reference and preserves privacy-safe 404', async () => {
  const calls = [];
  const client = createProviderWorkClient({
    workspaceId,
    fetchImpl: async (...args) => {
      calls.push(args);
      return response({
        ok: false,
        status: 404,
        body: { error: { code: 'PROVIDER_WORK_ITEM_NOT_FOUND' } }
      });
    }
  });
  await assert.rejects(
    () => client.detail('allocation_fixture-419'),
    (error) => error.code === 'NOT_FOUND_OR_NOT_AUTHORIZED' && error.status === 404
  );
  assert.equal(calls[0][0], '/api/provider/work-items/allocation_fixture-419');
  await assert.rejects(() => client.detail('../other-provider'), /Allocation reference is invalid/);
});

test('503 remains retryable source failure and is never converted to empty truth', async () => {
  const client = createProviderWorkClient({
    workspaceId,
    fetchImpl: async () =>
      response({ ok: false, status: 503, body: { error: { code: 'UPSTREAM' } } })
  });
  await assert.rejects(
    () => client.list(),
    (error) => error.code === 'SOURCE_UNAVAILABLE' && error.retryable === true
  );
});

test('list parser preserves successful empty and UNKNOWN incoming authority semantics', () => {
  const empty = parseProviderWorkListBody({
    providerWorkItemList: {
      schemaVersion: 1,
      checkedAt: '2026-09-01T10:00:00.000Z',
      items: [],
      page: { limit: 25 },
      readAuthorityDoesNotAuthorizeMutation: true
    }
  });
  assert.deepEqual(empty.items, []);

  const parsed = toProviderWorkItemViewModel(item());
  assert.equal(parsed.incoming.state, 'UNKNOWN');
  assert.match(parsed.incoming.detail, /not known absence/i);
  assert.match(parsed.incoming.detail, /remain hidden/i);
  assert.equal(parsed.response.state, 'KNOWN_ABSENT');
  assert.match(parsed.response.detail, /does not imply pending or acceptance/i);
});

test('Provider Return is claim-only and read detail never grants mutation authority', () => {
  const knownReturn = item({
    responseState: {
      kind: 'KNOWN_RESPONSE',
      response: { id: 'provider-acceptance_fixture-419', version: 2 },
      decision: 'ACCEPTED',
      respondedAt: '2026-09-01T10:10:00.000Z',
      responseFingerprintSha256: '7'.repeat(64)
    },
    returnState: {
      kind: 'KNOWN_RETURN',
      providerReturn: { id: 'provider-return_fixture-419', version: 1 },
      status: 'CURRENT',
      submittedAt: '2026-09-01T10:20:00.000Z',
      returnFingerprintSha256: '8'.repeat(64),
      providerReturnRemainsClaimEvidenceNotOfficialTruth: true
    }
  });
  const parsed = parseProviderWorkDetailBody({
    providerWorkItemRead: {
      schemaVersion: 1,
      decision: 'AUTHORIZED',
      providerWorkspaceId: workspaceId,
      principalReference: 'principal:fixture',
      workspaceAuthorityReference: 'workspace-membership:fixture',
      checkedAt: '2026-09-01T10:00:00.000Z',
      item: knownReturn,
      existenceDisclosed: true,
      readAuthorityDoesNotAuthorizeMutation: true
    }
  });
  assert.match(parsed.providerReturn.detail, /claim\/evidence only, not Official Truth/);
  assert.equal(parsed.queuePresenceIsNotActionAuthority, true);
  assert.equal(parsed.task.canCorrectReturn, true);
});

test('malformed privacy or authority expansion fails closed', () => {
  assert.throws(
    () =>
      toProviderWorkItemViewModel(
        item({ privacyExclusions: { ...privacyExclusions, rawPrivateEvidenceIncluded: true } })
      ),
    ProviderWorkModelError
  );
  assert.throws(
    () =>
      toProviderWorkItemViewModel(
        item({
          authorityConsequences: { ...authorityConsequences, authorizesExternalContact: true }
        })
      ),
    ProviderWorkModelError
  );
  assert.throws(
    () =>
      toProviderWorkItemViewModel(
        item({
          incomingDataAuthority: {
            state: 'UNKNOWN',
            reason: 'AUTHORITY_STATE_NOT_ESTABLISHED',
            incomingFieldsVisible: true,
            embeddedPrivateFieldValues: false
          }
        })
      ),
    ProviderWorkModelError
  );
});

function actionableItem(overrides = {}) {
  return toProviderWorkItemViewModel(
    item({
      responseState: {
        kind: 'KNOWN_RESPONSE',
        response: { id: 'provider-acceptance_fixture-419', version: 2 },
        decision: 'ACCEPTED',
        respondedAt: '2026-09-01T10:10:00.000Z',
        responseFingerprintSha256: '7'.repeat(64)
      },
      ...overrides
    })
  );
}

test('Provider response mutation derives identity from browser authority and supports exact replay', async () => {
  const calls = [];
  const client = createProviderWorkClient({
    workspaceId,
    csrfToken: 'csrf-fixture',
    fetchImpl: async (...args) => {
      calls.push(args);
      return response({
        body: { providerAcceptance: { providerAcceptanceId: 'provider-acceptance_fixture-419' } }
      });
    }
  });
  const work = toProviderWorkItemViewModel(item());
  const command = {
    decision: 'ACCEPTED',
    acknowledgement: 'accepted through governed provider route',
    idempotencyKey: 'provider-response-fixture-419'
  };
  await client.respond(work, command);
  await client.respond(work, command);
  assert.equal(calls.length, 2);
  for (const [, init] of calls) {
    assert.equal(init.method, 'POST');
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.headers['x-markorbit-provider-workspace-id'], workspaceId);
    assert.equal(init.headers['x-markorbit-csrf-token'], 'csrf-fixture');
    assert.equal(init.headers['Idempotency-Key'], 'provider-response-fixture-419');
    const body = JSON.parse(init.body);
    assert.equal(body.workspaceId, '018f0000-0000-7000-8000-000000004191');
    assert.equal(body.expectedAllocationVersion, 3);
    assert.equal(body.correlationId, 'correlation_provider-work-fixture-419');
    for (const forbidden of ['providerId', 'providerWorkspaceId', 'actorId', 'principal']) {
      assert.equal(forbidden in body, false);
    }
  }
  assert.equal(calls[0][1].body, calls[1][1].body);
});

test('Decline uses the same governed response route without inventing alternate authority', async () => {
  const calls = [];
  const client = createProviderWorkClient({
    workspaceId,
    csrfToken: 'csrf-fixture',
    fetchImpl: async (...args) => {
      calls.push(args);
      return response({ body: { providerAcceptance: { decision: 'DECLINED' } } });
    }
  });
  await client.respond(toProviderWorkItemViewModel(item()), {
    decision: 'DECLINED',
    acknowledgement: 'cannot take this allocation',
    idempotencyKey: 'provider-decline-fixture-419'
  });
  assert.equal(calls[0][0], '/api/provider/allocations/allocation_fixture-419/respond');
  assert.equal(JSON.parse(calls[0][1].body).decision, 'DECLINED');
});

test('Provider mutations fail locally without CSRF and preserve 409 conflict codes', async () => {
  let fetchCount = 0;
  const withoutCsrf = createProviderWorkClient({
    workspaceId,
    fetchImpl: async () => {
      fetchCount += 1;
      return response();
    }
  });
  await assert.rejects(
    () =>
      withoutCsrf.respond(toProviderWorkItemViewModel(item()), {
        decision: 'ACCEPTED',
        acknowledgement: 'accepted',
        idempotencyKey: 'provider-no-csrf-fixture-419'
      }),
    (error) => error.code === 'CSRF_CONTEXT_REQUIRED'
  );
  assert.equal(fetchCount, 0);

  const stale = createProviderWorkClient({
    workspaceId,
    csrfToken: 'csrf-fixture',
    fetchImpl: async () => response({ ok: false, status: 409, body: { code: 'VERSION_CONFLICT' } })
  });
  await assert.rejects(
    () =>
      stale.respond(toProviderWorkItemViewModel(item()), {
        decision: 'ACCEPTED',
        acknowledgement: 'accepted',
        idempotencyKey: 'provider-stale-fixture-419'
      }),
    (error) => error.code === 'VERSION_CONFLICT' && error.status === 409
  );
});

test('Provider Return submission binds exact accepted lineage and no caller identity', async () => {
  const calls = [];
  const client = createProviderWorkClient({
    workspaceId,
    csrfToken: 'csrf-fixture',
    fetchImpl: async (...args) => {
      calls.push(args);
      return response({
        body: { providerReturn: { providerReturnId: 'provider-return_fixture-419' } }
      });
    }
  });
  await client.submitReturn(actionableItem(), {
    workStatusClaim: 'WORK_COMPLETED',
    artifacts: [{ reference: 'artifact_fixture-419' }],
    assertions: [],
    idempotencyKey: 'provider-return-fixture-419'
  });
  const [url, init] = calls[0];
  assert.equal(url, '/api/provider/returns');
  assert.equal(init.headers['Idempotency-Key'], 'provider-return-fixture-419');
  const body = JSON.parse(init.body);
  assert.equal(body.allocationId, 'allocation_fixture-419');
  assert.equal(body.expectedAllocationVersion, 3);
  assert.equal(body.providerAcceptanceId, 'provider-acceptance_fixture-419');
  assert.equal(body.expectedProviderAcceptanceVersion, 2);
  assert.equal(body.servicePackageId, 'service-package_fixture-419');
  assert.equal(body.expectedServicePackageVersion, 4);
  assert.deepEqual(body.artifacts, [{ reference: 'artifact_fixture-419' }]);
  assert.equal(body.correlationId, 'correlation_provider-work-fixture-419');
  for (const forbidden of ['providerId', 'providerWorkspaceId', 'actorId', 'principal']) {
    assert.equal(forbidden in body, false);
  }
});

test('Provider Return correction requires exact current supersedes reference', async () => {
  const calls = [];
  const client = createProviderWorkClient({
    workspaceId,
    csrfToken: 'csrf-fixture',
    fetchImpl: async (...args) => {
      calls.push(args);
      return response({
        body: { providerReturn: { providerReturnId: 'provider-return_fixture-419' } }
      });
    }
  });
  await client.submitReturn(actionableItem(), {
    workStatusClaim: 'WORK_COMPLETED_CORRECTED',
    artifacts: [{ reference: 'artifact_corrected-419' }],
    assertions: [],
    supersedes: { id: 'provider-return_fixture-419', version: 3 },
    idempotencyKey: 'provider-return-correction-419'
  });
  const body = JSON.parse(calls[0][1].body);
  assert.deepEqual(body.supersedes, { id: 'provider-return_fixture-419', version: 3 });

  const conflict = createProviderWorkClient({
    workspaceId,
    csrfToken: 'csrf-fixture',
    fetchImpl: async () =>
      response({ ok: false, status: 409, body: { error: { code: 'RETURN_SUPERSEDED' } } })
  });
  await assert.rejects(
    () =>
      conflict.submitReturn(actionableItem(), {
        workStatusClaim: 'WORK_COMPLETED_CORRECTED',
        artifacts: [{ reference: 'artifact_corrected-419' }],
        assertions: [],
        supersedes: { id: 'provider-return_fixture-419', version: 3 },
        idempotencyKey: 'provider-return-correction-conflict-419'
      }),
    (error) => error.code === 'RETURN_SUPERSEDED' && error.status === 409
  );
});

test('Provider Return exact-version read stays provider-owned claim history', async () => {
  const calls = [];
  const body = {
    providerReturn: {
      schemaVersion: 1,
      providerReturnId: 'provider-return_fixture-419',
      version: 3,
      status: 'CURRENT',
      workStatusClaim: 'WORK_COMPLETED',
      allocation: { id: 'allocation_fixture-419', version: 3 },
      providerAcceptance: { id: 'provider-acceptance_fixture-419', version: 2 },
      servicePackage: { id: 'service-package_fixture-419', version: 4 },
      artifacts: [{ reference: 'artifact_fixture-419' }],
      assertions: [],
      submittedAt: '2026-09-01T10:30:00.000Z',
      correlationId: 'correlation_provider-work-fixture-419'
    }
  };
  const client = createProviderWorkClient({
    workspaceId,
    fetchImpl: async (...args) => {
      calls.push(args);
      return response({ body });
    }
  });
  const raw = await client.providerReturn('provider-return_fixture-419', 3);
  assert.equal(calls[0][0], '/api/provider/returns/provider-return_fixture-419?version=3');
  const parsed = parseProviderReturnBody(raw);
  assert.equal(parsed.id, 'provider-return_fixture-419');
  assert.equal(parsed.version, 3);
  assert.match(parsed.truthBoundary, /not Official Truth/);
  assert.deepEqual(parsed.artifacts, [{ reference: 'artifact_fixture-419' }]);
});

test('malformed Gateway JSON fails closed instead of fabricating owner truth', async () => {
  const client = createProviderWorkClient({
    workspaceId,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        throw new SyntaxError('bad json');
      }
    })
  });
  await assert.rejects(
    () => client.list(),
    (error) => error.code === 'MALFORMED_RESPONSE' && error.status === 200
  );
});
