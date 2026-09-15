import {
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import {
  normalizeApplicantPortfolioRequestV1,
  parseApplicantPortfolioEnvelopeV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import {
  DiscoveredTrademarkAdmissionError,
  type ExactDiscoveredTrademarkReader
} from './discovered-trademark-admission.js';

export class HttpDataEngineApplicantOwnerReader implements ExactDiscoveredTrademarkReader {
  constructor(
    private readonly options: {
      dataEngineUrl?: string;
      apiKey?: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    }
  ) {}

  async readTrademark(request: Parameters<ExactDiscoveredTrademarkReader['readTrademark']>[0]) {
    const base = this.options.dataEngineUrl?.trim().replace(/\/$/u, '');
    const apiKey = this.options.apiKey?.trim();
    if (!base || !apiKey || apiKey.length < 32)
      throw new DiscoveredTrademarkAdmissionError(
        'OWNER_READ_UNAVAILABLE',
        'Data Engine owner-read configuration is unavailable.',
        503
      );
    const normalized = normalizeApplicantPortfolioRequestV1(request);
    const applicantSource = normalized.applicant.source_reference;
    const trademarkSource = request.trademark.source_reference;
    const query = new URLSearchParams({
      requester_workspace_id: normalized.requestContext.requester_workspace_id,
      applicant_source_id: applicantSource.source_id,
      applicant_source_version: applicantSource.source_version,
      applicant_source_fingerprint_sha256: applicantSource.source_fingerprint_sha256,
      applicant_observed_at: applicantSource.observed_at,
      trademark_source_id: trademarkSource.source_id,
      trademark_source_version: trademarkSource.source_version,
      trademark_source_fingerprint_sha256: trademarkSource.source_fingerprint_sha256,
      trademark_observed_at: trademarkSource.observed_at
    });
    const path = `/api/v1/${applicantSource.jurisdiction.toLowerCase()}/applicants/${encodeURIComponent(normalized.applicant.applicant_candidate_id)}/trademarks/${encodeURIComponent(request.trademark.trademark_candidate_id)}?${query.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(this.options.timeoutMs ?? 5_000, 1)
    );
    let response: Response;
    try {
      response = await (this.options.fetchImpl ?? fetch)(`${base}${path}`, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
          'x-request-id': normalized.requestContext.request_id,
          'x-correlation-id': normalized.requestContext.request_id
        },
        signal: controller.signal
      });
    } catch {
      throw new DiscoveredTrademarkAdmissionError(
        'OWNER_READ_UNAVAILABLE',
        'Data Engine owner read is unavailable.',
        503
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok)
      throw new DiscoveredTrademarkAdmissionError(
        response.status >= 500 ? 'OWNER_READ_UNAVAILABLE' : 'OWNER_READ_NOT_CURRENT',
        response.status >= 500
          ? 'Data Engine owner read is unavailable.'
          : 'The exact discovered trademark is not current at the Data Engine owner.',
        response.status >= 500 ? 503 : 409
      );
    if (
      response.headers.get('x-request-id') !== normalized.requestContext.request_id ||
      response.headers.get('x-correlation-id') !== normalized.requestContext.request_id ||
      response.headers.get('x-markorbit-contract-version') !==
        DATA_ENGINE_INTEGRATION_CONTRACT_VERSION ||
      response.headers.get('x-markorbit-source-owner') !== DATA_ENGINE_SOURCE_OWNER
    )
      throw new DiscoveredTrademarkAdmissionError(
        'OWNER_READ_UNAVAILABLE',
        'Data Engine owner-read transport lineage is invalid.',
        503
      );
    const envelope = parseApplicantPortfolioEnvelopeV1(
      await response.json().catch(() => undefined)
    );
    if (!envelope)
      throw new DiscoveredTrademarkAdmissionError(
        'OWNER_READ_UNAVAILABLE',
        'Data Engine owner-read contract is invalid.',
        503
      );
    return envelope;
  }
}
