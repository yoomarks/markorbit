import type { ControlledHandoffPreparationResultV1 } from '@markorbit/contracts/controlled-handoff-preparation';
import type {
  ControlledHandoffCurrentValidationV1,
  ControlledHandoffMutationResultV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  Allocation,
  EligibilityEvaluation,
  ServicePackage
} from '@markorbit/contracts/provider-execution';
import type {
  ProviderDiscoveryCandidateV1,
  ProviderDiscoveryResultV1
} from '@markorbit/contracts/provider-discovery';
import type {
  ProviderSelectionMutationResultV1,
  ProviderSelectionScopeReferenceV1
} from '@markorbit/contracts/provider-selection';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export type ReadyControlledHandoffPreparation = Extract<
  ControlledHandoffPreparationResultV1,
  { status: 'READY_FOR_HUMAN_REVIEW' }
>;

export interface GovernedAllocationResult {
  readonly requestFingerprintSha256: string;
  readonly allocation: Readonly<Allocation>;
  readonly lineage: Readonly<{
    allocationId: string;
    providerSelectionId: string;
    handoffBindingState: 'NO_CONTROLLED_HANDOFF_BY_DESIGN' | 'EXACT_CONTROLLED_HANDOFF';
    lineageFingerprintSha256: string;
  }>;
}

export interface GovernedProviderClient {
  loadServicePackage(servicePackageId: string): Promise<ServicePackage>;
  discover(servicePackage: Readonly<ServicePackage>): Promise<ProviderDiscoveryResultV1>;
  select(
    servicePackage: Readonly<ServicePackage>,
    discovery: Readonly<ProviderDiscoveryResultV1>,
    candidate: Readonly<ProviderDiscoveryCandidateV1>,
    rationale: string
  ): Promise<ProviderSelectionMutationResultV1>;
  prepareHandoff(
    servicePackage: Readonly<ServicePackage>,
    selection: Readonly<ProviderSelectionMutationResultV1>,
    candidate: Readonly<ProviderDiscoveryCandidateV1>
  ): Promise<ControlledHandoffPreparationResultV1>;
  authorizeHandoff(
    preparation: Readonly<ReadyControlledHandoffPreparation>
  ): Promise<ControlledHandoffMutationResultV1>;
  validateHandoff(
    handoff: Readonly<ControlledHandoffMutationResultV1>
  ): Promise<ControlledHandoffCurrentValidationV1>;
  evaluateEligibility(
    servicePackage: Readonly<ServicePackage>,
    candidate: Readonly<ProviderDiscoveryCandidateV1>
  ): Promise<EligibilityEvaluation>;
  allocateGoverned(
    servicePackage: Readonly<ServicePackage>,
    candidate: Readonly<ProviderDiscoveryCandidateV1>,
    selection: Readonly<ProviderSelectionMutationResultV1>,
    handoff: Readonly<ControlledHandoffMutationResultV1>,
    eligibility: Readonly<EligibilityEvaluation>
  ): Promise<GovernedAllocationResult>;
}

export class GovernedProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'GovernedProviderHttpError';
  }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function governedProviderFingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableSerialize(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}

function correlationId() {
  return `correlation_${globalThis.crypto.randomUUID()}` as const;
}

function idempotencyKey(kind: string) {
  return `${kind}:${globalThis.crypto.randomUUID()}`;
}

async function csrfToken(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  } catch {
    throw new GovernedProviderHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'The authenticated session could not be loaded.',
      true
    );
  }
  const parsed = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !parsed.csrfToken)
    throw new GovernedProviderHttpError(
      response.ok ? 401 : response.status,
      parsed.code ?? 'AUTHENTICATION_REQUIRED',
      parsed.message ?? 'An authenticated session is required.'
    );
  return parsed.csrfToken;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const parsed = (await response.json().catch(() => ({}))) as T & {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  if (!response.ok)
    throw new GovernedProviderHttpError(
      response.status,
      parsed.code ?? 'GOVERNED_PROVIDER_REQUEST_FAILED',
      parsed.message ?? 'Governed Provider request failed.',
      parsed.retryable ?? response.status >= 500
    );
  return parsed;
}

async function getJson<T>(path: string, workspaceId: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      headers: { 'x-markorbit-workspace-id': workspaceId }
    });
  } catch {
    throw new GovernedProviderHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Current Provider authority cannot be verified.',
      true
    );
  }
  return parseResponse<T>(response);
}

async function postJson<T>(
  path: string,
  workspaceId: string,
  body: unknown,
  key?: string
): Promise<T> {
  const token = await csrfToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': token,
        ...(key ? { 'idempotency-key': key } : {})
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new GovernedProviderHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Current Provider authority cannot be verified.',
      true
    );
  }
  return parseResponse<T>(response);
}

async function postPreparation(
  workspaceId: string,
  body: unknown
): Promise<ControlledHandoffPreparationResultV1> {
  const token = await csrfToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/mgsn/governed-network/handoffs/prepare`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': token
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new GovernedProviderHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Current Handoff authority cannot be verified.',
      true
    );
  }
  const parsed = (await response.json().catch(() => ({}))) as {
    controlledHandoffPreparation?: ControlledHandoffPreparationResultV1;
    code?: string;
    message?: string;
  };
  if (
    response.status === 503 &&
    parsed.controlledHandoffPreparation?.status === 'SOURCE_UNAVAILABLE'
  )
    return parsed.controlledHandoffPreparation;
  if (!response.ok || !parsed.controlledHandoffPreparation)
    throw new GovernedProviderHttpError(
      response.status,
      parsed.code ?? 'HANDOFF_PREPARATION_FAILED',
      parsed.message ?? 'Controlled Handoff Preparation failed.',
      response.status >= 500
    );
  return parsed.controlledHandoffPreparation;
}

function selectionScope(
  servicePackage: Readonly<ServicePackage>
): ProviderSelectionScopeReferenceV1 {
  return {
    owner: 'LITE',
    reference: servicePackage.servicePackageId,
    version: servicePackage.version,
    fingerprintSha256: servicePackage.servicePackageFingerprintSha256
  };
}

function instructionReference(servicePackage: Readonly<ServicePackage>): string {
  return (
    servicePackage.source.instructionReferences[0] ??
    `service-package:${servicePackage.servicePackageId}:provider-handling`
  );
}

export function createGovernedProviderClient(workspaceId: string): GovernedProviderClient {
  return {
    async loadServicePackage(servicePackageId) {
      const response = await getJson<{ servicePackage: ServicePackage }>(
        `/api/mgsn/service-packages/${encodeURIComponent(servicePackageId)}`,
        workspaceId
      );
      return response.servicePackage;
    },

    async discover(servicePackage) {
      const requestedAt = new Date().toISOString();
      const bodyWithoutFingerprint = {
        schemaVersion: 1 as const,
        providerDiscoveryRequestId: `provider-discovery-request_${globalThis.crypto.randomUUID()}`,
        need: {
          reference: servicePackage.servicePackageId,
          version: servicePackage.version,
          fingerprintSha256: servicePackage.servicePackageFingerprintSha256,
          jurisdiction: servicePackage.jurisdiction,
          serviceType: servicePackage.serviceType
        },
        purpose: 'PROVIDER_DISCOVERY' as const,
        audience: { kind: 'BOUNDED_NETWORK' as const },
        contextReference: `service-package:${servicePackage.servicePackageId}:provider-progression`,
        requestedDataClasses: [
          'PROVIDER_REFERENCE',
          'SUPPLY_PROFILE',
          'SERVICE_JURISDICTIONS',
          'PROVIDER_EVIDENCE_REFERENCE'
        ] as const,
        requestedFields: [
          'providerId',
          'displayName',
          'serviceTypes',
          'jurisdictions',
          'evidenceReferences'
        ] as const,
        requestedAt,
        correlationId: correlationId()
      };
      const requestFingerprintSha256 = await governedProviderFingerprint(bodyWithoutFingerprint);
      const response = await postJson<{ providerDiscovery: ProviderDiscoveryResultV1 }>(
        '/api/mgsn/governed-network/discovery/evaluate',
        workspaceId,
        { ...bodyWithoutFingerprint, requestFingerprintSha256 }
      );
      return response.providerDiscovery;
    },

    async select(servicePackage, discovery, candidate, rationale) {
      if (discovery.status !== 'CANDIDATES')
        throw new GovernedProviderHttpError(
          409,
          'DISCOVERY_NOT_CURRENT',
          'A current candidate result is required before Selection.'
        );
      const reviewedAt = new Date().toISOString();
      const key = idempotencyKey('provider-selection');
      const scope = selectionScope(servicePackage);
      const bodyWithoutFingerprint = {
        schemaVersion: 1 as const,
        scope,
        sourceLineage: {
          discoveryRequest: {
            providerDiscoveryRequestId: candidate.request.providerDiscoveryRequestId,
            requesterWorkspaceId: candidate.request.requesterWorkspaceId,
            requestFingerprintSha256: candidate.request.requestFingerprintSha256,
            needReference: candidate.request.need.reference,
            needVersion: candidate.request.need.version,
            needFingerprintSha256: candidate.request.need.fingerprintSha256,
            purpose: candidate.request.purpose,
            contextReference: candidate.request.contextReference
          },
          discoveryResult: {
            resultFingerprintSha256: discovery.resultFingerprintSha256,
            evaluatedAt: discovery.evaluatedAt
          },
          discoveryCandidate: {
            providerDiscoveryCandidateId: candidate.providerDiscoveryCandidateId,
            candidateFingerprintSha256: candidate.candidateFingerprintSha256,
            generatedAt: candidate.generatedAt,
            evaluationPolicyVersion: candidate.evaluationPolicyVersion
          },
          provider: {
            providerId: candidate.providerId,
            providerWorkspaceId: candidate.providerWorkspaceId
          },
          providerSupplyCapability: candidate.providerSupplyCapability,
          visibilityAuthorizationAtReview: candidate.visibilityAuthorization,
          historicalSourceVersions: candidate.sourceVersions,
          directExecutorDisclosureAtReview: candidate.directExecutorDisclosure,
          currentAuthorityRevalidationRequiredBeforeSelectionCommit: true as const,
          currentAuthorityRevalidationRequiredBeforeDownstreamUse: true as const
        },
        acknowledgement: {
          affirmativeHumanAction: true as const,
          acknowledgementCode: 'HUMAN_PROVIDER_SELECTION_V1' as const,
          acknowledgementTextVersion: 'lite-governed-provider-v1',
          reviewedCandidateId: candidate.providerDiscoveryCandidateId,
          reviewedCandidateFingerprintSha256: candidate.candidateFingerprintSha256,
          reviewedScopeFingerprintSha256: scope.fingerprintSha256,
          reviewedAt,
          reasonCode: 'EVIDENCE_AND_LIMITATIONS_REVIEWED' as const,
          rationale: rationale.trim(),
          containsCustomerDocuments: false as const,
          containsRawEvidenceArtifacts: false as const,
          containsEndClientRelationshipInformation: false as const,
          containsApplicantOwnerOfficialData: false as const,
          containsCommercialMarginOrProfit: false as const
        },
        expectedCurrent: { kind: 'ABSENT' as const, expectedScopeVersion: 0 },
        idempotencyKey: key,
        correlationId: correlationId()
      };
      const commandFingerprintSha256 = await governedProviderFingerprint(bodyWithoutFingerprint);
      const response = await postJson<{ providerSelection: ProviderSelectionMutationResultV1 }>(
        '/api/mgsn/governed-network/selections',
        workspaceId,
        { ...bodyWithoutFingerprint, commandFingerprintSha256 },
        key
      );
      return response.providerSelection;
    },

    async prepareHandoff(servicePackage, selection, candidate) {
      const current = selection.selection;
      const body = {
        schemaVersion: 1 as const,
        selection: {
          providerSelectionId: current.providerSelectionId,
          version: current.version,
          scopeVersion: current.scopeVersion
        },
        selectionScope: current.scope,
        purpose: {
          code: 'PROFESSIONAL_SERVICE_PREPARATION' as const,
          contextReference: `service-package:${servicePackage.servicePackageId}:provider-progression`,
          instructionReference: instructionReference(servicePackage)
        },
        requestedFields: [
          {
            dataClass: 'PROVIDER_REFERENCE' as const,
            fieldPath: 'providerId',
            sourceOwner: 'MGSN' as const,
            sourceReference: candidate.providerId,
            necessityReference: 'provider-routing'
          },
          {
            dataClass: 'PROVIDER_REFERENCE' as const,
            fieldPath: 'providerWorkspaceId',
            sourceOwner: 'MGSN' as const,
            sourceReference: candidate.providerId,
            necessityReference: 'recipient-binding'
          },
          {
            dataClass: 'PROVIDER_REFERENCE' as const,
            fieldPath: 'displayName',
            sourceOwner: 'MGSN' as const,
            sourceReference: candidate.providerId,
            necessityReference: 'human-review-label'
          },
          {
            dataClass: 'PROVIDER_EVIDENCE_REFERENCES' as const,
            fieldPath: 'evidenceReferences',
            sourceOwner: 'MGSN' as const,
            sourceReference: candidate.providerSupplyCapability.id,
            necessityReference: 'evidence-lineage-review'
          }
        ],
        checkedAt: new Date().toISOString(),
        correlationId: correlationId()
      };
      return postPreparation(workspaceId, body);
    },

    async authorizeHandoff(preparation) {
      const reviewedAt = new Date().toISOString();
      const validFrom = reviewedAt;
      const validUntil = new Date(Date.parse(validFrom) + 30 * 60 * 1000).toISOString();
      const key = idempotencyKey('controlled-handoff');
      const tuple = preparation.reviewTuple;
      const bodyWithoutFingerprint = {
        schemaVersion: 1 as const,
        recipient: preparation.recipient,
        purpose: preparation.purpose,
        authorizedProjection: preparation.authorizedProjection,
        sourceLineage: preparation.sourceLineage,
        privacyPreviewAcknowledgement: {
          affirmativeHumanAction: true as const,
          acknowledgementCode: 'CONTROLLED_PRIVACY_HANDOFF_V1' as const,
          acknowledgementTextVersion: 'lite-governed-provider-v1',
          originatingWorkspaceId: tuple.originatingWorkspaceId,
          recipientProviderId: tuple.recipientProviderId,
          recipientProviderWorkspaceId: tuple.recipientProviderWorkspaceId,
          selection: tuple.selection,
          purposeFingerprintSha256: tuple.purposeFingerprintSha256,
          projectionFingerprintSha256: tuple.projectionFingerprintSha256,
          sourceSetFingerprintSha256: tuple.sourceSetFingerprintSha256,
          previewFingerprintSha256: tuple.previewFingerprintSha256,
          reviewedAt
        },
        validFrom,
        validUntil,
        expectedCurrent: { kind: 'ABSENT' as const },
        idempotencyKey: key,
        correlationId: preparation.correlationId
      };
      const commandFingerprintSha256 = await governedProviderFingerprint(bodyWithoutFingerprint);
      const response = await postJson<{ controlledHandoff: ControlledHandoffMutationResultV1 }>(
        '/api/mgsn/governed-network/handoffs',
        workspaceId,
        { ...bodyWithoutFingerprint, commandFingerprintSha256 },
        key
      );
      return response.controlledHandoff;
    },

    async validateHandoff(handoff) {
      const envelope = handoff.envelope;
      const response = await postJson<{
        controlledHandoffValidation: ControlledHandoffCurrentValidationV1;
      }>(
        `/api/mgsn/governed-network/handoffs/${encodeURIComponent(envelope.controlledHandoffId)}/validate-current`,
        workspaceId,
        {
          envelope: { version: envelope.version },
          purpose: 'HANDOFF_CONSUMPTION',
          attempt: {
            recipientProviderId: envelope.recipient.providerId,
            recipientProviderWorkspaceId: envelope.recipient.providerWorkspaceId,
            purposeFingerprintSha256: envelope.purpose.purposeFingerprintSha256,
            projectionFingerprintSha256: envelope.authorizedProjection.projectionFingerprintSha256,
            sourceSetFingerprintSha256: envelope.authorizedProjection.sourceSetFingerprintSha256,
            artifactRetrievalRequested: false,
            attemptedAt: new Date().toISOString(),
            correlationId: correlationId()
          }
        }
      );
      return response.controlledHandoffValidation;
    },

    async evaluateEligibility(servicePackage, candidate) {
      const key = idempotencyKey('provider-eligibility');
      const response = await postJson<{ eligibilityEvaluation: EligibilityEvaluation }>(
        `/api/mgsn/service-packages/${encodeURIComponent(servicePackage.servicePackageId)}/evaluate-provider`,
        workspaceId,
        {
          // Target Workspace is owner-returned Service Package context and is rechecked by Gateway/MGSN.
          workspaceId: servicePackage.workspaceId,
          expectedServicePackageVersion: servicePackage.version,
          expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
          providerSupplyCapabilityId: candidate.providerSupplyCapability.id,
          expectedProviderSupplyCapabilityVersion: candidate.providerSupplyCapability.version,
          expectedProviderSupplyCapabilityFingerprintSha256:
            candidate.providerSupplyCapability.fingerprintSha256,
          correlationId: correlationId()
        },
        key
      );
      return response.eligibilityEvaluation;
    },

    async allocateGoverned(servicePackage, candidate, selection, handoff, eligibility) {
      const key = idempotencyKey('governed-allocation');
      const selected = selection.selection;
      const envelope = handoff.envelope;
      const response = await postJson<{ governedAllocation: GovernedAllocationResult }>(
        '/api/mgsn/governed-network/allocations',
        workspaceId,
        {
          servicePackageId: servicePackage.servicePackageId,
          expectedServicePackageVersion: servicePackage.version,
          expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
          eligibilityEvaluationId: eligibility.eligibilityEvaluationId,
          expectedEligibilityEvaluationVersion: eligibility.version,
          expectedEligibilityFingerprintSha256: eligibility.deterministicFingerprintSha256,
          providerId: candidate.providerId,
          providerSupplyCapabilityId: candidate.providerSupplyCapability.id,
          expectedProviderSupplyCapabilityVersion: candidate.providerSupplyCapability.version,
          rationale:
            'Human confirmed governed provider routing after reviewing Selection and Controlled Privacy Handoff.',
          selection: {
            providerSelectionId: selected.providerSelectionId,
            version: selected.version,
            scopeVersion: selected.scopeVersion
          },
          selectionScope: selected.scope,
          handoffBinding: {
            mode: 'EXACT',
            handoff: {
              controlledHandoffId: envelope.controlledHandoffId,
              version: envelope.version
            },
            envelopeFingerprintSha256: envelope.envelopeFingerprintSha256,
            purposeFingerprintSha256: envelope.purpose.purposeFingerprintSha256,
            projectionFingerprintSha256: envelope.authorizedProjection.projectionFingerprintSha256,
            sourceSetFingerprintSha256: envelope.authorizedProjection.sourceSetFingerprintSha256
          },
          correlationId: correlationId()
        },
        key
      );
      return response.governedAllocation;
    }
  };
}
