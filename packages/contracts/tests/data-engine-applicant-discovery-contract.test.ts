import { describe, expect, it } from 'vitest';

import {
  APPLICANT_IDENTITY_DISCOVERY_CANDIDATE_TYPE,
  APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND,
  APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
  APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE,
  DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
  classifyApplicantDiscoveryEnvelopeV1,
  classifyApplicantPortfolioEnvelopeV1,
  noApplicantDiscoveryAuthorityConsequencesV1,
  normalizeApplicantDiscoveryRequestV1,
  normalizeApplicantPortfolioRequestV1,
  parseApplicantDiscoveryEnvelopeV1,
  parseApplicantDiscoveryPageV1,
  parseApplicantPortfolioEnvelopeV1,
  parseApplicantPortfolioPageV1,
  type DataEngineApplicantCandidateReferenceV1
} from '../src/data-engine-discovery.js';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '../src/data-engine.js';

const SHA_A = `sha256:${'a'.repeat(64)}`;
const SHA_B = `sha256:${'b'.repeat(64)}`;
const OBSERVED_AT = '2026-09-10T07:00:00.000Z';

function sourceReference(
  sourceKind: 'APPLICANT_IDENTITY' | 'TRADEMARK_RECORD',
  sourceId: string,
  sourceVersion = 'M1.8-test'
) {
  return {
    owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction: 'CN' as const,
    source_kind: sourceKind,
    source_id: sourceId,
    source_version: sourceVersion,
    source_fingerprint_sha256: sourceId.endsWith('2') ? SHA_B : SHA_A,
    observed_at: OBSERVED_AT
  };
}

function applicantReference(
  id = 'applicant-candidate-1',
  sourceId = 'applicant-source-1'
): DataEngineApplicantCandidateReferenceV1 {
  return {
    applicant_candidate_id: id,
    source_reference: sourceReference('APPLICANT_IDENTITY', sourceId)
  };
}

function applicantQuery(workspaceId = 'workspace-a') {
  return {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    request_context: {
      requester_workspace_id: workspaceId,
      request_id: 'request-applicant-1'
    },
    jurisdiction: 'CN' as const,
    input: { kind: 'NAME' as const, value: 'Acme Technology' },
    ordering: ['applicant_candidate_id ASC'] as const,
    ranking_authority: 'NONE' as const,
    limits: { page_size: 25, max_results: 100 as const },
    query_hash: SHA_A
  };
}

function applicantPage(workspaceId = 'workspace-a') {
  const query = applicantQuery(workspaceId);
  const sourceSnapshot = { source_version: 'M1.8-test', observed_at: OBSERVED_AT };
  const results = [
    {
      candidate_type: APPLICANT_IDENTITY_DISCOVERY_CANDIDATE_TYPE,
      applicant_candidate_id: 'applicant-candidate-1',
      display_name: 'ACME TECHNOLOGY CO., LTD.',
      alternate_names: ['Acme Technology'],
      source_reference: sourceReference('APPLICANT_IDENTITY', 'applicant-source-1'),
      match_kind: 'EXACT_NORMALIZED_NAME' as const,
      review_required: true as const,
      verified_legal_identity: false as const,
      customer_relationship_established: false as const
    },
    {
      candidate_type: APPLICANT_IDENTITY_DISCOVERY_CANDIDATE_TYPE,
      applicant_candidate_id: 'applicant-candidate-2',
      display_name: 'ACME TECHNOLOGY LIMITED',
      alternate_names: ['Acme Technology'],
      source_reference: sourceReference('APPLICANT_IDENTITY', 'applicant-source-2'),
      match_kind: 'FUZZY_NAME' as const,
      review_required: true as const,
      verified_legal_identity: false as const,
      customer_relationship_established: false as const
    }
  ];
  return {
    query,
    source_snapshot: sourceSnapshot,
    results,
    next_cursor: null,
    provenance: {
      query_hash: query.query_hash,
      request_context: query.request_context,
      source_snapshot: sourceSnapshot,
      engine_version: 'M1.8-engine',
      result_count: results.length,
      has_more: false,
      query
    },
    authority_consequences: noApplicantDiscoveryAuthorityConsequencesV1
  };
}

function applicantEnvelope(
  payload: ReturnType<typeof applicantPage> | null = applicantPage(),
  factState:
    'observed' | 'not_found' | 'not_covered' | 'no_observation' | 'service_unavailable' = 'observed'
) {
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.8-engine',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: 'CN' as const,
    resource_kind: APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false as const,
    fact_state: factState,
    payload
  };
}

function portfolioQuery(applicant = applicantReference(), workspaceId = 'workspace-a') {
  return {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    request_context: {
      requester_workspace_id: workspaceId,
      request_id: 'request-portfolio-1'
    },
    applicant,
    ordering: ['trademark_candidate_id ASC'] as const,
    ranking_authority: 'NONE' as const,
    limits: { page_size: 50, max_results: 500 as const },
    query_hash: SHA_B
  };
}

function portfolioPage(applicant = applicantReference(), workspaceId = 'workspace-a') {
  const query = portfolioQuery(applicant, workspaceId);
  const sourceSnapshot = { source_version: 'M1.9-test', observed_at: OBSERVED_AT };
  const results = [
    {
      candidate_type: APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE,
      trademark_candidate_id: 'trademark-candidate-1',
      applicant,
      jurisdiction: 'CN' as const,
      mark_text: 'ACME ONE',
      application_number: 'CN10000001',
      registration_number: null,
      classes: [9],
      source_reference: sourceReference('TRADEMARK_RECORD', 'trademark-source-1', 'M1.9-test'),
      official_truth_verified: false as const,
      legal_conclusion_created: false as const,
      workspace_relationship_established: false as const
    },
    {
      candidate_type: APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE,
      trademark_candidate_id: 'trademark-candidate-2',
      applicant,
      jurisdiction: 'CN' as const,
      mark_text: 'ACME TWO',
      application_number: 'CN10000002',
      registration_number: 'CN90000002',
      classes: [35],
      source_reference: sourceReference('TRADEMARK_RECORD', 'trademark-source-2', 'M1.9-test'),
      official_truth_verified: false as const,
      legal_conclusion_created: false as const,
      workspace_relationship_established: false as const
    }
  ];
  return {
    query,
    source_snapshot: sourceSnapshot,
    results,
    next_cursor: null,
    provenance: {
      query_hash: query.query_hash,
      request_context: query.request_context,
      source_snapshot: sourceSnapshot,
      engine_version: 'M1.9-engine',
      result_count: results.length,
      has_more: false,
      query
    },
    authority_consequences: noApplicantDiscoveryAuthorityConsequencesV1
  };
}

function portfolioEnvelope(
  payload: ReturnType<typeof portfolioPage> | null = portfolioPage(),
  factState:
    'observed' | 'not_found' | 'not_covered' | 'no_observation' | 'service_unavailable' = 'observed'
) {
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.9-engine',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: 'CN' as const,
    resource_kind: APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false as const,
    fact_state: factState,
    payload
  };
}

describe('Data Engine Applicant Discovery / Portfolio V1', () => {
  it('keeps an ambiguous applicant name as multiple review-required candidates', () => {
    const parsed = parseApplicantDiscoveryEnvelopeV1(applicantEnvelope());
    expect(parsed).not.toBeNull();
    expect(parsed?.payload?.results).toHaveLength(2);
    expect(parsed?.payload?.results.map((candidate) => candidate.applicant_candidate_id)).toEqual([
      'applicant-candidate-1',
      'applicant-candidate-2'
    ]);
    expect(parsed?.payload?.results.every((candidate) => candidate.review_required)).toBe(true);
    expect(parsed?.payload?.results.every((candidate) => !candidate.verified_legal_identity)).toBe(
      true
    );
    expect(classifyApplicantDiscoveryEnvelopeV1(parsed!)).toBe('RESULTS');
  });

  it('binds every discovered trademark to the exact selected Applicant candidate reference', () => {
    const selected = applicantReference();
    const parsed = parseApplicantPortfolioEnvelopeV1(portfolioEnvelope(portfolioPage(selected)));
    expect(parsed?.payload?.results).toHaveLength(2);
    expect(
      parsed?.payload?.results.every(
        (candidate) =>
          candidate.applicant.applicant_candidate_id === selected.applicant_candidate_id
      )
    ).toBe(true);

    const mismatched = portfolioPage(selected);
    mismatched.results[0]!.applicant = applicantReference(
      'applicant-candidate-2',
      'applicant-source-2'
    );
    expect(parseApplicantPortfolioPageV1(mismatched)).toBeNull();
  });

  it('preserves exact Workspace request context and fails closed on provenance scope drift', () => {
    expect(parseApplicantDiscoveryPageV1(applicantPage('workspace-a'))).not.toBeNull();
    const drifted = applicantPage('workspace-a');
    drifted.provenance.request_context = {
      ...drifted.provenance.request_context,
      requester_workspace_id: 'workspace-b'
    };
    expect(parseApplicantDiscoveryPageV1(drifted)).toBeNull();
  });

  it('distinguishes observed zero results from unknown/not observed and unavailable', () => {
    const empty = applicantPage();
    empty.results = [];
    empty.provenance.result_count = 0;
    const parsedEmpty = parseApplicantDiscoveryEnvelopeV1(applicantEnvelope(empty));
    expect(parsedEmpty).not.toBeNull();
    expect(classifyApplicantDiscoveryEnvelopeV1(parsedEmpty!)).toBe('EMPTY');

    const notObserved = parseApplicantDiscoveryEnvelopeV1(
      applicantEnvelope(null, 'no_observation')
    );
    expect(notObserved).not.toBeNull();
    expect(classifyApplicantDiscoveryEnvelopeV1(notObserved!)).toBe('NOT_OBSERVED');

    const unavailable = parseApplicantDiscoveryEnvelopeV1(
      applicantEnvelope(null, 'service_unavailable')
    );
    expect(unavailable).not.toBeNull();
    expect(classifyApplicantDiscoveryEnvelopeV1(unavailable!)).toBe('UNAVAILABLE');
  });

  it('preserves Data Engine source provenance without creating Workspace relationship truth', () => {
    const parsed = parseApplicantPortfolioEnvelopeV1(portfolioEnvelope());
    const candidate = parsed?.payload?.results[0];
    expect(candidate?.source_reference.owner).toBe(DATA_ENGINE_SOURCE_OWNER);
    expect(candidate?.source_reference.source_kind).toBe('TRADEMARK_RECORD');
    expect(candidate?.source_reference.source_fingerprint_sha256).toBe(SHA_A);
    expect(candidate?.workspace_relationship_established).toBe(false);
    expect(candidate?.official_truth_verified).toBe(false);
    expect(candidate?.legal_conclusion_created).toBe(false);
    expect(parsed?.payload?.authority_consequences.managedRelationshipEstablished).toBe(false);
    expect(parsed?.payload?.authority_consequences.watchCreated).toBe(false);
  });

  it('lets callers retain multiple exact Applicant references without introducing Customer identity', () => {
    const parsed = parseApplicantDiscoveryPageV1(applicantPage());
    const references = parsed?.results.map((candidate) => ({
      applicant_candidate_id: candidate.applicant_candidate_id,
      source_reference: candidate.source_reference
    }));
    expect(references).toHaveLength(2);
    expect(new Set(references?.map((reference) => reference.source_reference.source_id)).size).toBe(
      2
    );
    expect(JSON.stringify(parsed)).not.toContain('customerId');
  });

  it('fails closed on unknown fields, source-version drift and wrong resource kind', () => {
    const unknownField = applicantPage() as ReturnType<typeof applicantPage> & {
      unexpected?: boolean;
    };
    unknownField.unexpected = true;
    expect(parseApplicantDiscoveryPageV1(unknownField)).toBeNull();

    const sourceVersionDrift = applicantPage();
    sourceVersionDrift.results[0]!.source_reference.source_version = 'M1.7-stale';
    expect(parseApplicantDiscoveryPageV1(sourceVersionDrift)).toBeNull();

    expect(
      parseApplicantDiscoveryEnvelopeV1({
        ...applicantEnvelope(),
        resource_kind: APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND
      })
    ).toBeNull();
  });

  it('normalizes bounded name/external-reference requests and rejects malformed boundaries', () => {
    expect(
      normalizeApplicantDiscoveryRequestV1({
        requestContext: { requester_workspace_id: ' workspace-a ', request_id: ' request-1 ' },
        jurisdiction: 'CN',
        input: { kind: 'NAME', value: ' Acme Technology ' }
      })
    ).toMatchObject({
      requestContext: { requester_workspace_id: 'workspace-a', request_id: 'request-1' },
      jurisdiction: 'CN',
      input: { kind: 'NAME', value: 'Acme Technology' },
      pageSize: 25
    });

    expect(
      normalizeApplicantDiscoveryRequestV1({
        requestContext: { requester_workspace_id: 'workspace-a', request_id: 'request-2' },
        jurisdiction: 'US',
        input: {
          kind: 'EXTERNAL_IDENTITY_HINT',
          value: ' applicant-source-1 ',
          reference_version: ' v3 '
        },
        pageSize: 100
      })
    ).toMatchObject({
      input: {
        kind: 'EXTERNAL_IDENTITY_HINT',
        value: 'applicant-source-1',
        reference_version: 'v3'
      }
    });

    expect(() =>
      normalizeApplicantDiscoveryRequestV1({
        requestContext: { requester_workspace_id: 'workspace-a', request_id: 'request-3' },
        jurisdiction: 'CN',
        input: { kind: 'NAME', value: 'Acme' },
        pageSize: 101
      })
    ).toThrow(TypeError);

    expect(
      normalizeApplicantPortfolioRequestV1({
        requestContext: { requester_workspace_id: ' workspace-a ', request_id: ' portfolio-1 ' },
        applicant: applicantReference()
      })
    ).toMatchObject({
      requestContext: { requester_workspace_id: 'workspace-a', request_id: 'portfolio-1' },
      pageSize: 50
    });
  });

  it('keeps portfolio zero/unavailable classification distinct as well', () => {
    const empty = portfolioPage();
    empty.results = [];
    empty.provenance.result_count = 0;
    const parsedEmpty = parseApplicantPortfolioEnvelopeV1(portfolioEnvelope(empty));
    expect(classifyApplicantPortfolioEnvelopeV1(parsedEmpty!)).toBe('EMPTY');

    const unavailable = parseApplicantPortfolioEnvelopeV1(
      portfolioEnvelope(null, 'service_unavailable')
    );
    expect(classifyApplicantPortfolioEnvelopeV1(unavailable!)).toBe('UNAVAILABLE');
  });
});
