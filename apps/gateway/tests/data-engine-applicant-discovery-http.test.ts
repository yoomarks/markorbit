import { describe, expect, it, vi } from 'vitest';

import {
  APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND,
  APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
  type ApplicantPortfolioRequestV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';

import { createApplicantDiscoveryClientV1 } from '../src/data-engine-applicant-discovery-http.js';

const SHA = `sha256:${'a'.repeat(64)}`;
const requestContext = {
  requester_workspace_id: 'workspace-a',
  request_id: 'request-a'
};

function emptyEnvelope(
  resourceKind:
    | typeof APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND
    | typeof APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
  jurisdiction: 'CN' | 'US'
) {
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.9-test',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction,
    resource_kind: resourceKind,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false,
    fact_state: 'not_found',
    payload: null
  };
}

function portfolioRequest(): ApplicantPortfolioRequestV1 {
  return {
    requestContext,
    applicant: {
      applicant_candidate_id: 'candidate/one',
      source_reference: {
        owner: DATA_ENGINE_SOURCE_OWNER,
        authority: DATA_ENGINE_FACT_AUTHORITY,
        jurisdiction: 'CN',
        source_kind: 'APPLICANT_IDENTITY',
        source_id: 'source-1',
        source_version: 'M1.9-test',
        source_fingerprint_sha256: SHA,
        observed_at: '2026-09-15T00:00:00.000Z'
      }
    },
    pageSize: 20,
    cursor: 'next-page'
  };
}

describe('Gateway Applicant Discovery client', () => {
  it('maps a bounded US NAME request onto the authenticated Data Engine query plane', async () => {
    const rawGet = vi.fn(() =>
      Promise.resolve(emptyEnvelope(APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND, 'US'))
    );
    const client = createApplicantDiscoveryClientV1({ rawGet });

    const result = await client.discoverApplicants({
      requestContext,
      jurisdiction: 'US',
      input: { kind: 'NAME', value: '  Acme & Sons  ' },
      pageSize: 25,
      cursor: 'opaque-cursor'
    });

    expect(result.fact_state).toBe('not_found');
    expect(rawGet).toHaveBeenCalledOnce();
    const [path, context] = rawGet.mock.calls[0] as unknown as [string, object];
    expect(path).toContain('/api/v1/us/applicants/by-name?');
    expect(path).toContain('name=Acme+%26+Sons');
    expect(path).toContain('requester_workspace_id=workspace-a');
    expect(path).toContain('page_size=25');
    expect(path).toContain('cursor=opaque-cursor');
    expect(context).toEqual({ requestId: 'request-a', correlationId: 'request-a' });
  });

  it('fails before transport for discovery modes not exposed by the production owner API', async () => {
    const rawGet = vi.fn();
    const client = createApplicantDiscoveryClientV1({ rawGet });

    await expect(
      client.discoverApplicants({
        requestContext,
        jurisdiction: 'CN',
        input: { kind: 'NAME', value: 'Acme' }
      })
    ).rejects.toThrow('supports US NAME reads only');
    expect(rawGet).not.toHaveBeenCalled();
  });

  it('uses the selected candidate and complete source reference for a portfolio read', async () => {
    const rawGet = vi.fn(() =>
      Promise.resolve(emptyEnvelope(APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND, 'CN'))
    );
    const client = createApplicantDiscoveryClientV1({ rawGet });

    await client.readPortfolio(portfolioRequest());

    const [path, context] = rawGet.mock.calls[0] as unknown as [string, object];
    expect(path).toContain('/api/v1/cn/applicants/candidate%2Fone/portfolio?');
    expect(path).toContain('requester_workspace_id=workspace-a');
    expect(path).toContain('applicant_source_id=source-1');
    expect(path).toContain(`applicant_source_fingerprint_sha256=${encodeURIComponent(SHA)}`);
    expect(path).toContain('page_size=20');
    expect(path).toContain('cursor=next-page');
    expect(context).toEqual({ requestId: 'request-a', correlationId: 'request-a' });
  });

  it('binds an exact trademark source reference to the owner-read endpoint', async () => {
    const rawGet = vi.fn(() =>
      Promise.resolve(emptyEnvelope(APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND, 'CN'))
    );
    const client = createApplicantDiscoveryClientV1({ rawGet });
    const request = portfolioRequest();

    await client.readTrademark({
      ...request,
      trademark: {
        trademark_candidate_id: 'trademark/one',
        source_reference: {
          ...request.applicant.source_reference,
          source_kind: 'TRADEMARK_RECORD',
          source_id: 'trademark-source-1'
        }
      }
    });

    const [path] = rawGet.mock.calls[0] as unknown as [string];
    expect(path).toContain('/api/v1/cn/applicants/candidate%2Fone/trademarks/trademark%2Fone?');
    expect(path).toContain('trademark_source_id=trademark-source-1');
    expect(path).toContain(`trademark_source_fingerprint_sha256=${encodeURIComponent(SHA)}`);
    expect(path).not.toContain('page_size=');
  });

  it('rejects forged or incomplete source references before transport', async () => {
    const rawGet = vi.fn();
    const client = createApplicantDiscoveryClientV1({ rawGet });
    const request = portfolioRequest();
    (
      request.applicant.source_reference as { source_fingerprint_sha256: string }
    ).source_fingerprint_sha256 = 'not-a-fingerprint';

    await expect(client.readPortfolio(request)).rejects.toThrow('outside the bounded V1 contract');
    expect(rawGet).not.toHaveBeenCalled();
  });

  it('fails closed on an unexpected response contract', async () => {
    const rawGet = vi.fn(() =>
      Promise.resolve({
        ...emptyEnvelope(APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND, 'US'),
        resource_kind: APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND
      })
    );
    const client = createApplicantDiscoveryClientV1({ rawGet });

    await expect(
      client.discoverApplicants({
        requestContext,
        jurisdiction: 'US',
        input: { kind: 'NAME', value: 'Acme' }
      })
    ).rejects.toMatchObject({ code: 'DATA_ENGINE_CONTRACT_MISMATCH' });
  });
});
