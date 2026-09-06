import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noControlledHandoffPreparationAuthorityConsequences,
  type ControlledHandoffPreparationRequestV1,
  type ControlledHandoffPreparationResultV1
} from '@markorbit/contracts/controlled-handoff-preparation';
import type { ServiceRuntime } from '@markorbit/service-kit';
import type { ControlledHandoffPreparationPrincipal } from '../src/controlled-handoff-preparation.js';
import { createRuntime, MGSN_GOVERNED_HUMAN_ACTION_HEADER } from '../src/index.js';

const secret = 'mgsn-handoff-preparation-test-secret-32-bytes';
const workspaceId = '018f0000-0000-7000-8000-000000000381';
const userId = '018f0000-0000-7000-8000-000000000394';
const membershipId = '018f0000-0000-7000-8000-000000000395';
type Prepare = (
  trustedPrincipal: ControlledHandoffPreparationPrincipal,
  request: ControlledHandoffPreparationRequestV1
) => Promise<ControlledHandoffPreparationResultV1>;
type CapturedPreparation = {
  trustedPrincipal: ControlledHandoffPreparationPrincipal;
  request: ControlledHandoffPreparationRequestV1;
};

let runtime: ServiceRuntime;
let base = '';
let captured: CapturedPreparation | undefined;
let prepare = vi.fn<Prepare>();

function principal(): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_handoff_prepare_865',
    userId,
    workspaceId,
    membershipId,
    role: 'WORKSPACE_ADMIN',
    permissions: ['execution:read', 'execution:manage'],
    sessionExpiresAt: '2026-09-06T12:00:00.000Z'
  };
}

function headers() {
  return {
    'content-type': 'application/json',
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal())
  };
}

function body() {
  return {
    schemaVersion: 1,
    selection: {
      providerSelectionId: 'provider-selection_fixture-394',
      version: 1,
      scopeVersion: 1
    },
    selectionScope: {
      owner: 'LITE',
      reference: 'need:fixture-381',
      version: 3,
      fingerprintSha256: '1'.repeat(64)
    },
    purpose: {
      code: 'PROFESSIONAL_SERVICE_PREPARATION',
      contextReference: 'context:test-865',
      instructionReference: 'instruction:test-865'
    },
    requestedFields: [
      {
        dataClass: 'PROVIDER_REFERENCE',
        fieldPath: 'providerId',
        sourceOwner: 'MGSN',
        sourceReference: 'provider_fixture-381',
        necessityReference: 'necessity:selected-provider-reference'
      }
    ],
    checkedAt: '2026-09-06T00:00:00.000Z',
    correlationId: 'correlation_test-865-http'
  };
}

function ready(): ControlledHandoffPreparationResultV1 {
  return {
    schemaVersion: 1,
    status: 'READY_FOR_HUMAN_REVIEW',
    selection: body().selection as ControlledHandoffPreparationResultV1['selection'],
    evaluatedAt: '2026-09-06T00:00:01.000Z',
    checkedAuthorityReferences: ['mgsn:test-865'],
    publicLimitations: ['Descriptors only.'],
    correlationId: 'correlation_test-865-http',
    previewIsNotAuthorization: true,
    resultIsNotBearerCapability: true,
    authorityConsequences: noControlledHandoffPreparationAuthorityConsequences,
    recipient: {
      providerId: 'provider_fixture-381',
      providerWorkspaceId: '018f0000-0000-7000-8000-000000003810',
      role: 'FINAL_EXECUTION_PROVIDER'
    },
    purpose: {
      code: 'PROFESSIONAL_SERVICE_PREPARATION',
      contextReference: 'context:test-865',
      instructionReference: 'instruction:test-865',
      purposeFingerprintSha256: '2'.repeat(64),
      unrestrictedPurposeAllowed: false
    },
    authorizedProjection: {
      schemaVersion: 1,
      items: [
        {
          dataClass: 'PROVIDER_REFERENCE',
          fieldPath: 'providerId',
          sourceOwner: 'MGSN',
          sourceReference: 'provider_fixture-381',
          sourceVersion: 1,
          sourceFingerprintSha256: '3'.repeat(64),
          necessityReference: 'necessity:selected-provider-reference',
          requested: true,
          authorizedBySourceOwner: true,
          minimumNecessary: true,
          fieldValueEmbeddedInEnvelope: false,
          evidenceArtifactRetrievalAuthority: 'NOT_APPLICABLE'
        }
      ],
      projectionFingerprintSha256: '4'.repeat(64),
      sourceSetFingerprintSha256: '5'.repeat(64),
      wildcardAllowed: false,
      wholeRecordAllowed: false,
      implicitFieldExpansionAllowed: false,
      fieldValuesEmbeddedInEnvelope: false,
      requestedAuthorizedMinimumNecessaryIntersectionRequired: true,
      forbiddenGenericDataClasses: [
        'END_CLIENT_RELATIONSHIP_INFORMATION',
        'ORIGINATING_WORKSPACE_PRICING_MARGIN_PROFIT',
        'PRIVATE_CRM_CONTEXT',
        'UNRELATED_COMMUNICATIONS',
        'UNRELATED_ASSETS_OR_MATTERS'
      ]
    },
    sourceLineage: {} as Extract<
      ControlledHandoffPreparationResultV1,
      { status: 'READY_FOR_HUMAN_REVIEW' }
    >['sourceLineage'],
    reviewTuple: {
      originatingWorkspaceId: workspaceId,
      recipientProviderId: 'provider_fixture-381',
      recipientProviderWorkspaceId: '018f0000-0000-7000-8000-000000003810',
      selection: body().selection as ControlledHandoffPreparationResultV1['selection'],
      purposeFingerprintSha256: '2'.repeat(64),
      projectionFingerprintSha256: '4'.repeat(64),
      sourceSetFingerprintSha256: '5'.repeat(64),
      previewFingerprintSha256: '6'.repeat(64)
    },
    includedFields: [
      {
        dataClass: 'PROVIDER_REFERENCE',
        fieldPath: 'providerId',
        sourceOwner: 'MGSN',
        sourceReference: 'provider_fixture-381',
        necessityReference: 'necessity:selected-provider-reference'
      }
    ],
    excludedGenericDataClasses: [
      'END_CLIENT_RELATIONSHIP_INFORMATION',
      'ORIGINATING_WORKSPACE_PRICING_MARGIN_PROFIT',
      'PRIVATE_CRM_CONTEXT',
      'UNRELATED_COMMUNICATIONS',
      'UNRELATED_ASSETS_OR_MATTERS'
    ],
    readyForExplicitHumanAcknowledgement: true
  };
}

beforeEach(async () => {
  captured = undefined;
  prepare = vi.fn<Prepare>((trustedPrincipal, request) => {
    captured = { trustedPrincipal, request };
    return Promise.resolve(ready());
  });
  runtime = createRuntime({
    port: 0,
    internalServiceSecret: secret,
    controlledHandoffPreparationService: { prepare }
  });
  await runtime.start();
  base = `http://127.0.0.1:${runtime.listeningPort}`;
});

afterEach(async () => runtime.stop());

describe('MGSN Controlled Handoff Preparation internal HTTP', () => {
  it('uses trusted Workspace Principal and forwards only bounded review intent', async () => {
    const response = await fetch(`${base}/v1/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body())
    });
    expect(response.status).toBe(200);
    expect(captured).toMatchObject({
      trustedPrincipal: { workspaceId },
      request: {
        selection: { providerSelectionId: 'provider-selection_fixture-394' },
        requestedFields: [{ sourceOwner: 'MGSN' }]
      }
    });
    expect(captured?.trustedPrincipal).toEqual({ workspaceId });
  });

  it('rejects browser-supplied current authority before owner preparation runs', async () => {
    const response = await fetch(`${base}/v1/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...body(), directExecutorAuthority: { fake: true } })
    });
    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('does not consume a HUMAN_USER receipt for preparation', async () => {
    const response = await fetch(`${base}/v1/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: {
        ...headers(),
        [MGSN_GOVERNED_HUMAN_ACTION_HEADER]: Buffer.from('{}').toString('base64url')
      },
      body: JSON.stringify(body())
    });
    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('requires trusted internal service authentication', async () => {
    const requestHeaders = headers();
    delete (requestHeaders as Record<string, string>)['x-markorbit-internal-authorization'];
    const response = await fetch(`${base}/v1/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body())
    });
    expect(response.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('preserves SOURCE_UNAVAILABLE as HTTP 503 rather than known absence', async () => {
    const unavailable: ControlledHandoffPreparationResultV1 = {
      schemaVersion: 1,
      status: 'SOURCE_UNAVAILABLE',
      selection: body().selection as ControlledHandoffPreparationResultV1['selection'],
      evaluatedAt: '2026-09-06T00:00:01.000Z',
      checkedAuthorityReferences: [],
      publicLimitations: [],
      correlationId: 'correlation_test-865-http',
      previewIsNotAuthorization: true,
      resultIsNotBearerCapability: true,
      authorityConsequences: noControlledHandoffPreparationAuthorityConsequences,
      publicReason: 'Current authority cannot be verified.',
      retryable: true,
      readyForExplicitHumanAcknowledgement: false
    };
    prepare.mockResolvedValueOnce(unavailable);
    const response = await fetch(`${base}/v1/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body())
    });
    expect(response.status).toBe(503);
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({
      controlledHandoffPreparation: { status: 'SOURCE_UNAVAILABLE' }
    });
  });
});
