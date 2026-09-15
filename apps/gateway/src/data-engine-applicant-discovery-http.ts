import {
  APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND,
  APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
  normalizeApplicantDiscoveryRequestV1,
  normalizeApplicantPortfolioRequestV1,
  parseApplicantDiscoveryEnvelopeV1,
  parseApplicantPortfolioEnvelopeV1,
  type ApplicantDiscoveryEnvelopeV1,
  type ApplicantDiscoveryRequestV1,
  type ApplicantPortfolioEnvelopeV1,
  type ApplicantPortfolioRequestV1
} from '@markorbit/contracts/data-engine-applicant-discovery';

import { DataEngineClientError, type DataEngineClient } from './data-engine-http.js';

export interface ApplicantDiscoveryClientV1 {
  discoverApplicants(
    request: Readonly<ApplicantDiscoveryRequestV1>
  ): Promise<ApplicantDiscoveryEnvelopeV1>;
  readPortfolio(
    request: Readonly<ApplicantPortfolioRequestV1>
  ): Promise<ApplicantPortfolioEnvelopeV1>;
}

function requestContext(request: { requestContext: { request_id: string } }) {
  return {
    requestId: request.requestContext.request_id,
    correlationId: request.requestContext.request_id
  };
}

function applicantSourceQuery(
  workspaceId: string,
  source: Readonly<ApplicantPortfolioRequestV1['applicant']['source_reference']>
): URLSearchParams {
  return new URLSearchParams({
    requester_workspace_id: workspaceId,
    applicant_source_id: source.source_id,
    applicant_source_version: source.source_version,
    applicant_source_fingerprint_sha256: source.source_fingerprint_sha256,
    applicant_observed_at: source.observed_at
  });
}

function contractMismatch(resourceKind: string): DataEngineClientError {
  return new DataEngineClientError(
    'DATA_ENGINE_CONTRACT_MISMATCH',
    `Data Engine response does not match ${resourceKind} V1.`
  );
}

export function createApplicantDiscoveryClientV1(
  client: Pick<DataEngineClient, 'rawGet'>
): ApplicantDiscoveryClientV1 {
  return {
    async discoverApplicants(request) {
      const normalized = normalizeApplicantDiscoveryRequestV1(request);
      if (normalized.jurisdiction !== 'US' || normalized.input.kind !== 'NAME') {
        throw new TypeError(
          'The production Applicant Discovery endpoint supports US NAME reads only.'
        );
      }
      const query = new URLSearchParams({
        name: normalized.input.value,
        requester_workspace_id: normalized.requestContext.requester_workspace_id,
        page_size: String(normalized.pageSize)
      });
      if (normalized.cursor !== undefined) query.set('cursor', normalized.cursor);
      const envelope = parseApplicantDiscoveryEnvelopeV1(
        await client.rawGet(
          `/api/v1/us/applicants/by-name?${query.toString()}`,
          requestContext(normalized)
        )
      );
      if (!envelope) throw contractMismatch(APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND);
      if (
        envelope.payload &&
        (envelope.payload.query.jurisdiction !== normalized.jurisdiction ||
          JSON.stringify(envelope.payload.query.request_context) !==
            JSON.stringify(normalized.requestContext) ||
          JSON.stringify(envelope.payload.query.input) !== JSON.stringify(normalized.input) ||
          envelope.payload.query.limits.page_size !== normalized.pageSize)
      ) {
        throw contractMismatch(APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND);
      }
      return envelope;
    },

    async readPortfolio(request) {
      const normalized = normalizeApplicantPortfolioRequestV1(request);
      const source = normalized.applicant.source_reference;
      const query = applicantSourceQuery(normalized.requestContext.requester_workspace_id, source);
      query.set('page_size', String(normalized.pageSize));
      if (normalized.cursor !== undefined) query.set('cursor', normalized.cursor);
      const jurisdiction = source.jurisdiction.toLowerCase();
      const candidateId = encodeURIComponent(normalized.applicant.applicant_candidate_id);
      const envelope = parseApplicantPortfolioEnvelopeV1(
        await client.rawGet(
          `/api/v1/${jurisdiction}/applicants/${candidateId}/portfolio?${query.toString()}`,
          requestContext(normalized)
        )
      );
      if (!envelope) throw contractMismatch(APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND);
      if (
        envelope.payload &&
        (JSON.stringify(envelope.payload.query.request_context) !==
          JSON.stringify(normalized.requestContext) ||
          JSON.stringify(envelope.payload.query.applicant) !==
            JSON.stringify(normalized.applicant) ||
          envelope.payload.query.limits.page_size !== normalized.pageSize)
      ) {
        throw contractMismatch(APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND);
      }
      return envelope;
    }
  };
}
