import type {
  ApplicantDiscoveryEnvelopeV1,
  ApplicantPortfolioEnvelopeV1,
  DataEngineApplicantCandidateReferenceV1,
  DataEngineApplicantCandidateV1,
  DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import type { LiteWorkItemV1 } from '@markorbit/contracts/lite-work-item';
import type {
  SeedExactReferenceV1,
  SeedWorkspacePackageV1
} from '@markorbit/contracts/seed-workspace-package';
import type { TrademarkAsset } from '@markorbit/contracts/trademark-asset-workspace';
import type { WorkspaceDirectoryEntryV1 } from '@markorbit/contracts/workspace-directory';

const gatewayUrl = () => import.meta.env.VITE_GATEWAY_URL ?? '';

export interface CnSeedAgentRecord {
  agent_code: string;
  mention_id: string;
  entity_id: string | null;
  agent_name: string;
  agent_name_norm: string;
  source_file: string;
  source_first_line: number;
  source_last_line: number;
  source_package_id: string;
  source_rank: number;
  ingested_at: string;
  source_reference: Readonly<SeedExactReferenceV1>;
  currentness: Readonly<{
    state: 'CURRENT_SOURCE_FACT';
    source_rank: number;
    observed_at: string;
    is_deleted: false;
  }>;
  legal_identity_verified: false;
  customer_relationship_established: false;
  professional_appointment_established: false;
}

export interface CnSeedPortfolioRelationship {
  entity_id: string;
  role: 'OWNER' | 'CO_OWNER' | 'AGENT';
  application_number: string;
  relationship_states: readonly string[];
  mark_name_raw: string | null;
  classes: readonly number[];
  first_observed_at: string;
  last_observed_at: string;
}

export interface CnSeedRelationshipItem {
  edge: Readonly<{
    relationship_type: string;
    temporal: Readonly<{ is_current: boolean }>;
    evidence: Readonly<Record<string, unknown>>;
    provenance: Readonly<Record<string, unknown>>;
  }>;
  source_fact: Readonly<{
    role: string;
    relation_key: string;
    entity_id: string | null;
    name: string | null;
    address: string | null;
  }>;
}

interface DataEngineEnvelope<T> {
  fact_state: string;
  resource_kind: string;
  payload: T;
}

interface SeedAgentPayload {
  agent_code: string;
  record: CnSeedAgentRecord | null;
  semantics: string;
}

interface SeedPortfolioPayload {
  results: readonly CnSeedPortfolioRelationship[];
  next_cursor: string | null;
  bounded_truncation: boolean;
}

interface SeedRelationshipsPayload {
  application_number: string;
  relationship_count: number;
  relationships: readonly CnSeedRelationshipItem[];
}

export class SeedReviewApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'SeedReviewApiError';
  }
}

async function request<T>(
  path: string,
  workspaceId: string,
  init: Readonly<{
    method?: 'GET' | 'POST';
    body?: unknown;
    csrf?: string;
    idempotencyKey?: string;
  }> = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${gatewayUrl()}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId,
        ...(init.csrf ? { 'x-markorbit-csrf-token': init.csrf } : {}),
        ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {})
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) })
    });
  } catch {
    throw new SeedReviewApiError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'The prepared workspace service is temporarily unavailable.',
      true
    );
  }
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    throw new SeedReviewApiError(
      response.status,
      typeof error.code === 'string' ? error.code : 'SEED_REVIEW_REQUEST_FAILED',
      typeof error.message === 'string' ? error.message : 'The request could not be completed.',
      error.retryable === true || response.status >= 500
    );
  }
  return body as T;
}

async function csrf(): Promise<string> {
  const response = await fetch(`${gatewayUrl()}/api/auth/session`, { credentials: 'include' });
  const body: unknown = await response.json().catch(() => ({}));
  const token =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).csrfToken
      : undefined;
  if (!response.ok || typeof token !== 'string' || !token)
    throw new SeedReviewApiError(
      response.status || 401,
      'AUTHENTICATION_REQUIRED',
      'An authenticated professional session is required.'
    );
  return token;
}

async function deterministicKey(prefix: string, parts: readonly string[]): Promise<string> {
  const input = new TextEncoder().encode(parts.join('\u001f'));
  const digest = await crypto.subtle.digest('SHA-256', input);
  const hex = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}-${hex}`;
}

export interface SeedReviewApi {
  loadPackage(packageId: string): Promise<SeedWorkspacePackageV1>;
  loadCnAgent(agentCode: string): Promise<CnSeedAgentRecord | null>;
  loadCnAgentPortfolio(entityId: string): Promise<readonly CnSeedPortfolioRelationship[]>;
  loadCnRelationships(applicationNumber: string): Promise<readonly CnSeedRelationshipItem[]>;
  discoverApplicants(name: string): Promise<readonly DataEngineApplicantCandidateV1[]>;
  createDirectory(
    packageId: string,
    candidate: Readonly<DataEngineApplicantCandidateV1>
  ): Promise<WorkspaceDirectoryEntryV1>;
  loadApplicantPortfolio(
    applicant: Readonly<DataEngineApplicantCandidateReferenceV1>
  ): Promise<readonly DataEngineDiscoveredTrademarkCandidateV1[]>;
  admitManagedTrademark(
    packageId: string,
    directory: Readonly<WorkspaceDirectoryEntryV1>,
    applicant: Readonly<DataEngineApplicantCandidateReferenceV1>,
    trademark: Readonly<DataEngineDiscoveredTrademarkCandidateV1>
  ): Promise<TrademarkAsset>;
  createFirstWorkItem(
    packageId: string,
    directory: Readonly<WorkspaceDirectoryEntryV1>,
    asset: Readonly<TrademarkAsset>,
    title: string
  ): Promise<LiteWorkItemV1>;
  recordFirstValue(packageId: string, workItemId: string): Promise<unknown>;
}

export function createSeedReviewApi(workspaceId: string): SeedReviewApi {
  return {
    loadPackage: (packageId) =>
      request<SeedWorkspacePackageV1>(
        `/api/lite/seed-workspace-packages/${encodeURIComponent(packageId)}`,
        workspaceId
      ),

    async loadCnAgent(agentCode) {
      const result = await request<DataEngineEnvelope<SeedAgentPayload>>(
        `/api/data-engine/cn/agents/${encodeURIComponent(agentCode)}`,
        workspaceId
      );
      return result.payload?.record ?? null;
    },

    async loadCnAgentPortfolio(entityId) {
      const result = await request<DataEngineEnvelope<SeedPortfolioPayload>>(
        `/api/data-engine/cn/entities/${encodeURIComponent(entityId)}/trademarks?role=AGENT&scope=all&page_size=100`,
        workspaceId
      );
      return result.payload?.results ?? [];
    },

    async loadCnRelationships(applicationNumber) {
      const result = await request<DataEngineEnvelope<SeedRelationshipsPayload>>(
        `/api/data-engine/cn/cases/${encodeURIComponent(applicationNumber)}/relationships?scope=current`,
        workspaceId
      );
      return result.payload?.relationships ?? [];
    },

    async discoverApplicants(name) {
      const token = await csrf();
      const result = await request<ApplicantDiscoveryEnvelopeV1>(
        '/api/data-engine/applicants/discover',
        workspaceId,
        {
          method: 'POST',
          csrf: token,
          body: {
            jurisdiction: 'CN',
            input: { kind: 'NAME', value: name },
            pageSize: 20
          }
        }
      );
      return result.fact_state === 'observed' ? (result.payload?.results ?? []) : [];
    },

    async createDirectory(packageId, candidate) {
      const token = await csrf();
      const source = candidate.source_reference;
      return request<WorkspaceDirectoryEntryV1>(
        '/api/lite/workspace-directory-entries',
        workspaceId,
        {
          method: 'POST',
          csrf: token,
          idempotencyKey: await deterministicKey('seed-directory', [
            packageId,
            candidate.applicant_candidate_id,
            source.source_version
          ]),
          body: {
            entryKind: 'ORGANIZATION',
            displayName: candidate.display_name,
            aliases: candidate.alternate_names,
            roles: [],
            externalIdentityReferences: [
              {
                kind: 'APPLICANT_IDENTITY',
                sourceClass: 'DATA_ENGINE_CANDIDATE',
                referenceId: candidate.applicant_candidate_id,
                referenceVersion: source.source_version,
                label: candidate.display_name,
                jurisdiction: source.jurisdiction,
                observedAt: source.observed_at,
                verifiedLegalIdentityByDirectory: false,
                managedTrademarkRelationshipEstablishedByDirectory: false
              }
            ],
            provenance: {
              sourceKind: 'DATA_ENGINE',
              sourceReference: `${source.source_id}@${source.source_version}`,
              capturedAt: source.observed_at
            }
          }
        }
      );
    },

    async loadApplicantPortfolio(applicant) {
      const token = await csrf();
      const result = await request<ApplicantPortfolioEnvelopeV1>(
        '/api/data-engine/applicants/portfolio',
        workspaceId,
        {
          method: 'POST',
          csrf: token,
          body: { applicant, pageSize: 100 }
        }
      );
      return result.fact_state === 'observed' ? (result.payload?.results ?? []) : [];
    },

    async admitManagedTrademark(packageId, directory, applicant, trademark) {
      const token = await csrf();
      return request<TrademarkAsset>('/api/lite/trademark-assets/admit-discovered', workspaceId, {
        method: 'POST',
        csrf: token,
        idempotencyKey: await deterministicKey('seed-manage', [
          packageId,
          directory.workspaceDirectoryEntryId,
          trademark.trademark_candidate_id,
          trademark.source_reference.source_version
        ]),
        body: {
          directory: {
            workspaceDirectoryEntryId: directory.workspaceDirectoryEntryId,
            version: directory.version
          },
          applicant,
          trademark,
          decision: 'MANAGED'
        }
      });
    },

    async createFirstWorkItem(packageId, directory, asset, title) {
      const token = await csrf();
      return request<LiteWorkItemV1>('/api/lite/work-items', workspaceId, {
        method: 'POST',
        csrf: token,
        idempotencyKey: await deterministicKey('seed-work', [
          packageId,
          directory.workspaceDirectoryEntryId,
          asset.trademarkAssetId
        ]),
        body: {
          taskType: 'GENERAL_FOLLOW_UP',
          title,
          priority: 'NOTICE',
          relatedReferences: [
            {
              owner: 'LITE',
              kind: 'WORKSPACE_DIRECTORY_ENTRY',
              workspaceId,
              referenceId: directory.workspaceDirectoryEntryId,
              referenceVersion: directory.version
            },
            {
              owner: 'LITE',
              kind: 'TRADEMARK_ASSET',
              workspaceId,
              referenceId: asset.trademarkAssetId,
              referenceVersion: asset.version
            }
          ]
        }
      });
    },

    async recordFirstValue(packageId, workItemId) {
      const token = await csrf();
      return request<unknown>(
        `/api/lite/seed-workspace-packages/${encodeURIComponent(packageId)}/first-value`,
        workspaceId,
        {
          method: 'POST',
          csrf: token,
          idempotencyKey: await deterministicKey('seed-first-value', [packageId, workItemId]),
          body: { workItemId }
        }
      );
    }
  };
}
