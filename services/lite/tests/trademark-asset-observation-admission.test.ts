import { describe, expect, it } from 'vitest';
import {
  factContributionsFromAdmittedClaims,
  isCompleteTrademarkAssetSourceReadState,
  materializeTrademarkAssetAdmittedClaimsV1,
  materializeTrademarkAssetSourceReadStatesV1
} from '../src/trademark-asset-observation-admission.js';
import { composeTrademarkAssetView } from '../src/trademark-asset-view.js';

const workspaceId = '94949494-9494-4949-8949-949494949494';
const trademarkAssetId = 'trademark-asset_admission-test' as const;
const communicationSource = {
  owner: 'MANAGED_COMMUNICATION',
  kind: 'MANAGED_COMMUNICATION_MESSAGE',
  sourceId: 'managed-message_123',
  sourceVersion: '7',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-09-11T10:00:00.000Z',
  freshness: 'CURRENT'
} as const;
const dataEngineSource = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  sourceId: 'record_123',
  sourceVersion: '4',
  observedAt: '2026-09-11T09:00:00.000Z',
  freshness: 'CURRENT'
} as const;
const anchor = {
  schemaVersion: 1,
  trademarkAssetId,
  workspaceId,
  version: 1,
  identity: { jurisdiction: 'US', markText: 'MARKORBIT' },
  externalIdentifiers: [],
  workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
  sourceReferences: [],
  relations: [],
  workspaceTags: [],
  workspaceNotes: [],
  officialTruthVerifiedByLite: false,
  filingExecutedByLite: false,
  createdAt: '2026-09-11T08:00:00.000Z',
  updatedAt: '2026-09-11T08:00:00.000Z'
} as const;

describe('Agency P5 observation admission', () => {
  it('requires human review before a Managed Communication claim becomes a fact contribution', () => {
    const [claim] = materializeTrademarkAssetAdmittedClaimsV1({
      workspaceId,
      trademarkAssetId,
      claims: [
        {
          claimClass: 'COMMUNICATION_CLAIM',
          claimId: 'claim_email-status',
          factKind: 'APPLICATION_STATUS',
          value: 'REGISTERED',
          source: communicationSource,
          consequential: true,
          reviewedByPrincipalId: 'user_reviewer',
          reviewedAt: '2026-09-11T10:05:00.000Z',
          candidateReference: {
            kind: 'MANAGED_AI_CANDIDATE',
            referenceId: 'managed-ai-outcome_123',
            referenceVersion: '2'
          }
        }
      ]
    });

    expect(claim).toMatchObject({
      claimClass: 'COMMUNICATION_CLAIM',
      source: communicationSource,
      humanAction: { kind: 'COMMUNICATION_REVIEW', principalId: 'user_reviewer' },
      officialTruthVerifiedByLite: false,
      customerInstructionEstablished: false,
      legalConclusionCreated: false
    });
    expect(claim?.admissionFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(factContributionsFromAdmittedClaims([claim!])[0]).toMatchObject({
      kind: 'APPLICATION_STATUS',
      value: 'REGISTERED',
      admission: { claimClass: 'COMMUNICATION_CLAIM' }
    });
  });
  it('creates an exact Workspace confirmation source without promoting it to official truth', () => {
    const [claim] = materializeTrademarkAssetAdmittedClaimsV1({
      workspaceId,
      trademarkAssetId,
      claims: [
        {
          claimClass: 'WORKSPACE_USER_CONFIRMATION',
          claimId: 'claim_certificate-received',
          factKind: 'REGISTRATION_DATE',
          value: '2026-09-01',
          consequential: true,
          confirmedByPrincipalId: 'user_agent',
          confirmedAt: '2026-09-11T10:10:00.000Z'
        }
      ]
    });

    expect(claim).toMatchObject({
      claimClass: 'WORKSPACE_USER_CONFIRMATION',
      source: {
        owner: 'WORKSPACE_USER',
        kind: 'WORKSPACE_CONFIRMATION',
        sourceId: 'workspace-confirmation:claim_certificate-received',
        sourceVersion: '1',
        freshness: 'CURRENT'
      },
      humanAction: { kind: 'WORKSPACE_CONFIRMATION', principalId: 'user_agent' },
      officialTruthVerifiedByLite: false
    });
    expect(claim?.source.sourceFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('keeps raw communication evidence non-factual until admission proof is present', () => {
    expect(() =>
      composeTrademarkAssetView({
        anchor,
        composedAt: '2026-09-11T10:20:00.000Z',
        facts: [
          {
            kind: 'APPLICATION_STATUS',
            value: 'REGISTERED',
            source: communicationSource
          }
        ]
      })
    ).toThrowError(/cannot contribute fact/);

    const [claim] = materializeTrademarkAssetAdmittedClaimsV1({
      workspaceId,
      trademarkAssetId,
      claims: [
        {
          claimClass: 'COMMUNICATION_CLAIM',
          claimId: 'claim_conflict',
          factKind: 'APPLICATION_STATUS',
          value: 'REGISTERED',
          source: communicationSource,
          reviewedByPrincipalId: 'user_reviewer',
          reviewedAt: '2026-09-11T10:05:00.000Z'
        }
      ]
    });
    const view = composeTrademarkAssetView({
      anchor,
      composedAt: '2026-09-11T10:20:00.000Z',
      facts: [
        {
          kind: 'APPLICATION_STATUS',
          value: 'PENDING',
          source: dataEngineSource,
          consequential: true
        },
        ...factContributionsFromAdmittedClaims([claim!])
      ]
    });
    expect(view.conflicts).toHaveLength(1);
    expect(view.conflicts[0]).toMatchObject({
      kind: 'APPLICATION_STATUS',
      values: ['PENDING', 'REGISTERED'],
      unresolved: true
    });
    expect(view.freshness).toBe('CONFLICTING');
    expect(view.officialTruthVerifiedByLite).toBe(false);
  });

  it('distinguishes complete source reads from unavailable or uncovered reads', () => {
    expect(
      materializeTrademarkAssetSourceReadStatesV1({
        scope: ['DATA_ENGINE'],
        observations: [dataEngineSource]
      })
    ).toEqual([{ owner: 'DATA_ENGINE', state: 'OBSERVED' }]);

    const unavailable = materializeTrademarkAssetSourceReadStatesV1({
      scope: ['DATA_ENGINE'],
      observations: [],
      readStates: [{ owner: 'DATA_ENGINE', state: 'UNAVAILABLE' }]
    });
    expect(unavailable).toEqual([{ owner: 'DATA_ENGINE', state: 'UNAVAILABLE' }]);
    expect(isCompleteTrademarkAssetSourceReadState('UNAVAILABLE')).toBe(false);
    expect(isCompleteTrademarkAssetSourceReadState('EMPTY')).toBe(true);

    expect(() =>
      materializeTrademarkAssetSourceReadStatesV1({
        scope: ['DATA_ENGINE'],
        observations: [dataEngineSource],
        readStates: [{ owner: 'DATA_ENGINE', state: 'UNAVAILABLE' }]
      })
    ).toThrowError(/cannot carry observations/);
  });

  it('rejects source-owner impersonation and communication claims without exact review evidence', () => {
    expect(() =>
      materializeTrademarkAssetAdmittedClaimsV1({
        workspaceId,
        trademarkAssetId,
        claims: [
          {
            claimClass: 'COMMUNICATION_CLAIM',
            claimId: 'claim_bad-owner',
            factKind: 'APPLICATION_STATUS',
            value: 'REGISTERED',
            source: {
              ...communicationSource,
              owner: 'DATA_ENGINE',
              kind: 'DATA_ENGINE_TRADEMARK_RECORD'
            },
            reviewedByPrincipalId: 'user_reviewer',
            reviewedAt: '2026-09-11T10:05:00.000Z'
          }
        ]
      })
    ).toThrowError(/Managed Communication message evidence/);
  });
});
