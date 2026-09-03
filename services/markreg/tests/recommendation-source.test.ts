import { describe, expect, it, vi } from 'vitest';

import type { WorkspacePrincipal } from '@markorbit/contracts';
import { noRecommendationSourceAuthorityConsequences } from '@markorbit/contracts/markreg-early-funnel';

import {
  HttpCapabilityRecommendationSourceReaderV1,
  projectRecommendationSourceReferenceV1,
  type CapabilityProductionSourceExecutionReferenceTransportV1
} from '../src/recommendation-source.js';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_recommendation_source',
  userId: 'principal_recommendation_source',
  workspaceId: 'workspace_recommendation_source',
  membershipId: 'membership_recommendation_source',
  role: 'REVIEWER',
  permissions: ['workspace:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const internalServiceSecret = 'markreg-recommendation-source-secret-32-bytes-min';

function productionReference(): CapabilityProductionSourceExecutionReferenceTransportV1 {
  return {
    schemaVersion: 1,
    idempotencyKey: 'source-read-1',
    requestFingerprintSha256: 'a'.repeat(64),
    capabilityRequestId: 'capreq_source_read',
    sessionReceiptId: 'session-receipt_source_read'
  };
}

function productionRead() {
  const authority = {
    productBusinessStateCreated: false,
    productAuthorizationGranted: false,
    officialTruthCreated: false,
    methodImprovementTriggerCreated: false,
    automaticFallbackExecuted: false,
    syntheticSourceCreated: false
  } as const;
  return {
    schemaVersion: 1,
    status: 'PRODUCTION_ADMISSIBLE',
    reference: productionReference(),
    historical: {
      capabilityRequestId: 'capreq_source_read',
      implementationBindingId: 'implementation-binding_source_read',
      capabilityInvocationId: 'capability-invocation_source_read',
      capabilityOutcomeId: 'capability-outcome_source_read',
      capabilityReturnId: 'capability-return_source_read',
      sessionReceiptId: 'session-receipt_source_read'
    },
    source: {
      schemaVersion: 1,
      producer: 'CAPABILITY_ENGINE',
      admission: 'PRODUCTION_ADMISSIBLE',
      evidence: {
        evidenceId: 'capability-source-admission-evidence_source_read',
        evidenceVersion: 5,
        evidenceFingerprintSha256: 'b'.repeat(64),
        evaluatedAt: '2026-09-03T05:00:00.000Z'
      },
      current: {
        capability: {
          runtimeCapabilityDefinitionId: 'runtime-capability_uspto-official-fee-resolver',
          version: 2,
          capabilityId: 'official-fee-resolver',
          capabilityVersion: '2.0.0'
        },
        implementation: {
          implementationProfileId: 'implementation-profile_uspto-official-fee-resolver-governed-v2',
          version: 2,
          implementationKey: 'capability-engine:uspto-official-fee-resolver-governed-v2',
          status: 'APPROVED'
        }
      },
      methodSource: {
        evidenceRef: 'brain-method-package:pkg@1',
        methodId: 'method_uspto',
        methodVersionId: 'method-version_uspto_v2',
        packageId: 'pkg_uspto',
        packageVersion: '1',
        activationId: 'activation_uspto',
        evaluationId: 'evaluation_uspto'
      },
      referenceSources: [
        {
          evidenceRef: 'official-fee-reference:ref@current',
          sourceId: 'official-fee-ref_uspto-current',
          sourceVersion: 1,
          sourceFingerprintSha256: 'c'.repeat(64)
        }
      ],
      admissionPolicy: {
        policyId: 'source-admission-policy.uspto-official-fee-resolver.v2',
        policyVersion: 2,
        policyFingerprintSha256: 'd'.repeat(64)
      },
      sourceUse: {
        currentness: 'CURRENT',
        currentnessCheckedAt: '2026-09-03T05:00:00.000Z',
        policy: {
          policyId: 'source-use-policy.uspto-official-fee.v1',
          policyVersion: 1
        },
        provenanceRefs: ['producer:provenance:1'],
        assumptions: ['Assumption one.'],
        limitations: ['Limitation one.']
      },
      sourceOutput: {
        schemaVersion: 1,
        outputSchemaId: 'uspto-official-fee-resolver-output.v1',
        outputFingerprintSha256: 'e'.repeat(64)
      },
      authority
    },
    authority
  };
}

describe('MarkReg production Recommendation source boundary', () => {
  it('projects one valid Capability producer proof into the existing #385 source vocabulary', () => {
    const result = projectRecommendationSourceReferenceV1(productionRead());

    expect(result).toMatchObject({
      status: 'PRODUCTION_ADMISSIBLE',
      producerReference: {
        capabilityRequestId: 'capreq_source_read',
        sessionReceiptId: 'session-receipt_source_read'
      },
      source: {
        sourceKind: 'CAPABILITY_RESULT',
        sourceId: 'official-fee-resolver',
        fingerprintSha256: 'e'.repeat(64),
        admissionClass: 'PRODUCTION_ADMISSIBLE',
        currentness: 'CURRENT',
        currentnessCheckedAt: '2026-09-03T05:00:00.000Z',
        assumptions: ['Assumption one.'],
        limitations: ['Limitation one.'],
        authorityConsequences: noRecommendationSourceAuthorityConsequences
      }
    });
    if (result.status !== 'PRODUCTION_ADMISSIBLE') throw new Error('expected production source');
    expect(result.source.sourceVersion).toContain('official-fee-resolver-governed-v2');
    expect(result.source.provenanceRefs).toEqual(
      expect.arrayContaining([
        'producer:provenance:1',
        expect.stringContaining('capability-source-admission-evidence:'),
        expect.stringContaining('capability-admission-policy:'),
        expect.stringContaining('capability-output:'),
        expect.stringContaining('capability-method-activation:'),
        expect.stringContaining('official-fee-reference:ref@current')
      ])
    );
    expect(
      Object.values(result.source.authorityConsequences).every((value) => value === false)
    ).toBe(true);
  });

  it.each(['DENIED', 'NOT_FOUND', 'CONFLICT', 'UNAVAILABLE'] as const)(
    'keeps producer %s state fail closed instead of upgrading it',
    (status) => {
      const base = productionRead();
      const value = {
        schemaVersion: 1,
        status,
        reference: base.reference,
        ...(status === 'UNAVAILABLE' ? { retryable: true } : {}),
        ...(status === 'NOT_FOUND'
          ? {}
          : { denial: { code: `FORCED_${status}`, reason: `forced ${status}` } }),
        authority: base.authority
      };

      const result = projectRecommendationSourceReferenceV1(value);

      expect(result.status).toBe(status);
      expect(result.status).not.toBe('PRODUCTION_ADMISSIBLE');
    }
  );

  it('rejects stale, malformed or authority-bearing producer payloads as invalid', () => {
    const stale = productionRead();
    stale.source.sourceUse.currentness = 'STALE';
    expect(projectRecommendationSourceReferenceV1(stale)).toMatchObject({
      status: 'INVALID_PRODUCER_RESPONSE'
    });

    const mismatched = productionRead();
    mismatched.historical.sessionReceiptId = 'session-receipt_other';
    expect(projectRecommendationSourceReferenceV1(mismatched)).toMatchObject({
      status: 'INVALID_PRODUCER_RESPONSE'
    });

    const authorityBearing = productionRead();
    const invalidAuthorityBearing = {
      ...authorityBearing,
      source: {
        ...authorityBearing.source,
        authority: {
          ...authorityBearing.source.authority,
          productAuthorizationGranted: true
        }
      }
    };
    expect(projectRecommendationSourceReferenceV1(invalidAuthorityBearing)).toMatchObject({
      status: 'INVALID_PRODUCER_RESPONSE'
    });
  });

  it('sends only the exact producer reference under trusted MarkReg Workspace headers', async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify(productionRead()), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const reader = new HttpCapabilityRecommendationSourceReaderV1(
      'http://capability.internal/',
      internalServiceSecret,
      fetcher
    );

    const result = await reader.read(productionReference(), principal, 'correlation_source_read');

    expect(result.status).toBe('PRODUCTION_ADMISSIBLE');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('http://capability.internal/v1/production-source-evidence/read');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
    expect(headers['x-markorbit-workspace-id']).toBe(principal.workspaceId);
    expect(headers['x-markorbit-caller-product']).toBe('MARKREG');
    expect(headers['x-correlation-id']).toBe('correlation_source_read');
    if (typeof init?.body !== 'string') throw new Error('expected JSON request body');
    expect(JSON.parse(init.body)).toEqual(productionReference());
  });

  it('fails closed for network, HTTP and malformed JSON producer failures', async () => {
    const network = new HttpCapabilityRecommendationSourceReaderV1(
      'http://capability.internal',
      internalServiceSecret,
      vi.fn<typeof fetch>(() => Promise.reject(new Error('offline')))
    );
    await expect(network.read(productionReference(), principal)).resolves.toMatchObject({
      status: 'UNAVAILABLE',
      retryable: true,
      code: 'CAPABILITY_SOURCE_READ_UNAVAILABLE'
    });

    const denied = new HttpCapabilityRecommendationSourceReaderV1(
      'http://capability.internal',
      internalServiceSecret,
      vi.fn<typeof fetch>(() => Promise.resolve(new Response('{}', { status: 403 })))
    );
    await expect(denied.read(productionReference(), principal)).resolves.toMatchObject({
      status: 'UNAVAILABLE',
      retryable: false,
      code: 'CAPABILITY_SOURCE_READ_HTTP_403'
    });

    const malformed = new HttpCapabilityRecommendationSourceReaderV1(
      'http://capability.internal',
      internalServiceSecret,
      vi.fn<typeof fetch>(() => Promise.resolve(new Response('not-json', { status: 200 })))
    );
    await expect(malformed.read(productionReference(), principal)).resolves.toMatchObject({
      status: 'INVALID_PRODUCER_RESPONSE',
      code: 'INVALID_CAPABILITY_SOURCE_JSON'
    });
  });
});
