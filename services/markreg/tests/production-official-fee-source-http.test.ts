import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { noEarlyFunnelAuthorityConsequences } from '@markorbit/contracts/markreg-early-funnel';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createProductionOfficialFeeSourceRoutesV1 } from '../src/production-official-fee-source-http.js';
import {
  PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID,
  ProductionOfficialFeeSourceError,
  type ProductionOfficialFeeSourceServiceV1,
  type ProductionOfficialFeeSourceV1
} from '../src/production-official-fee-source.js';

const workspaceId = '70707070-7070-4707-8707-707070707070';
const otherWorkspaceId = '71717171-7171-4717-8717-717171717171';
const secret = 'markreg-official-fee-source-secret-32-bytes';
const active: ServiceRuntime[] = [];
const intakeId = 'intake_wif06_http';
const correlationId = 'correlation_wif06_http';

const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_wif06_http',
  userId: 'user_wif06_http',
  workspaceId: workspace,
  membershipId: 'membership_wif06_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'order:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});
const headers = (value: WorkspacePrincipal) => ({
  'content-type': 'application/json',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
  'x-markorbit-workspace-id': value.workspaceId,
  'idempotency-key': 'wif06-http-key'
});

const body = {
  schemaVersion: 1,
  intakeId,
  expectedIntakeVersion: 2,
  correlationId
} as const;

const source = (): ProductionOfficialFeeSourceV1 => ({
  schemaVersion: 1,
  workspaceId,
  intake: { id: intakeId, version: 2, fingerprintSha256: 'a'.repeat(64) },
  feeFacts: { id: 'fee-facts_wif06-http', version: 1, fingerprintSha256: 'b'.repeat(64) },
  source: {
    sourceKind: 'PRICING_SOURCE',
    sourceId: PRODUCTION_OFFICIAL_FEE_CAPABILITY_ID,
    sourceVersion: '1.0.0|reference:official-fee-ref_fixture@4|evidence:source-evidence_wif06',
    fingerprintSha256: 'c'.repeat(64),
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: '2026-09-15T03:30:00.000Z',
    provenanceRefs: ['official-fee-reference:fixture'],
    assumptions: ['Exact current fee facts remain applicable.'],
    limitations: ['Base application fee only.']
  },
  material: {
    filingBasis: 'SECTION_1',
    classCount: 2,
    feePerClass: { amountMinor: 35000, currency: 'USD' },
    totalOfficialFee: { amountMinor: 70000, currency: 'USD' },
    referenceId: 'official-fee-ref_fixture',
    referenceVersion: '4',
    effectiveFrom: '2025-01-18T00:00:00.000Z',
    productionEvidenceId: 'source-evidence_wif06'
  },
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function stack(
  resolve: ProductionOfficialFeeSourceServiceV1['resolve'] = () => Promise.resolve(source())
) {
  const resolveMock = vi.fn(resolve) as unknown as ProductionOfficialFeeSourceServiceV1['resolve'];
  const runtime = createServiceRuntime(
    { name: 'markreg-official-fee-source-http-test', port: 0, version: '1' },
    {
      routes: createProductionOfficialFeeSourceRoutesV1({
        internalServiceSecret: secret,
        service: { resolve: resolveMock }
      })
    }
  );
  active.push(runtime);
  await runtime.start();
  return { base: `http://127.0.0.1:${runtime.listeningPort}`, resolve: resolveMock };
}

describe('Production Official Fee Source HTTP', () => {
  it('resolves only under trusted Workspace authority and header-bound idempotency', async () => {
    const runtime = await stack();
    const response = await fetch(
      `${runtime.base}/internal/v1/production-official-fee-source/resolve`,
      {
        method: 'POST',
        headers: headers(principal()),
        body: JSON.stringify(body)
      }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ officialFeeSource: source() });
    expect(runtime.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId: 'user_wif06_http' }),
      { ...body, idempotencyKey: 'wif06-http-key' }
    );
  });
  it('rejects Workspace mismatch and caller-supplied pricing/Capability authority', async () => {
    const runtime = await stack();
    const mismatch = await fetch(
      `${runtime.base}/internal/v1/production-official-fee-source/resolve`,
      {
        method: 'POST',
        headers: { ...headers(principal()), 'x-markorbit-workspace-id': otherWorkspaceId },
        body: JSON.stringify(body)
      }
    );
    expect(mismatch.status).toBe(404);

    for (const injected of [
      { workspaceId },
      { capabilityId: 'attacker.capability' },
      { acceptedReferenceId: 'attacker-reference' },
      { feeAmount: 1 },
      { currency: 'BTC' },
      { asOf: '2020-01-01T00:00:00.000Z' }
    ]) {
      const response = await fetch(
        `${runtime.base}/internal/v1/production-official-fee-source/resolve`,
        {
          method: 'POST',
          headers: headers(principal()),
          body: JSON.stringify({ ...body, ...injected })
        }
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: 'INVALID_PRODUCTION_OFFICIAL_FEE_REQUEST'
      });
    }
    expect(runtime.resolve).not.toHaveBeenCalled();
  });
  it('preserves retryable Capability dependency failure without fallback', async () => {
    const runtime = await stack(() =>
      Promise.reject(
        new ProductionOfficialFeeSourceError(
          'OFFICIAL_FEE_SOURCE_READ_UNAVAILABLE',
          'Official-fee evidence is unavailable.',
          503,
          true
        )
      )
    );
    const response = await fetch(
      `${runtime.base}/internal/v1/production-official-fee-source/resolve`,
      {
        method: 'POST',
        headers: headers(principal()),
        body: JSON.stringify(body)
      }
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'OFFICIAL_FEE_SOURCE_READ_UNAVAILABLE',
      retryable: true
    });
  });
});
