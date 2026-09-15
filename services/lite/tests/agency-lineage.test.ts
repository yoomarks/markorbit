import { describe, expect, it, vi } from 'vitest';
import type { TrademarkAsset } from '@markorbit/contracts/trademark-asset-workspace';
import { AgencyLineageProjectionService } from '../src/agency-lineage.js';
import type { AgencyLineageError } from '../src/agency-lineage.js';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = 'trademark-asset_asset-1' as const;
const DIRECTORY_ID = 'workspace-directory-entry_client-1';
const MESSAGE = {
  owner: 'MANAGED_COMMUNICATION',
  scope: 'MESSAGE',
  accountRef: 'account-1',
  messageId: 'message-1',
  threadRef: 'thread-1',
  provider: 'gmail',
  providerMessageId: 'provider-message-1',
  observedAt: '2026-09-15T02:00:00.000Z'
};

const asset: TrademarkAsset = {
  schemaVersion: 1,
  trademarkAssetId: ASSET_ID,
  workspaceId: WORKSPACE_ID,
  version: 1,
  identity: { jurisdiction: 'US', markText: 'ACME' },
  externalIdentifiers: [],
  workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
  sourceReferences: [
    {
      owner: 'DATA_ENGINE',
      kind: 'DATA_ENGINE_TRADEMARK_RECORD',
      sourceId: 'trademark-source-1',
      sourceVersion: 'M1.9',
      sourceFingerprintSha256: 'a'.repeat(64),
      observedAt: '2026-09-15T01:00:00.000Z',
      freshness: 'CURRENT'
    }
  ],
  relations: [],
  ownerOrClientReference: DIRECTORY_ID,
  workspaceTags: [],
  workspaceNotes: [],
  officialTruthVerifiedByLite: false,
  filingExecutedByLite: false,
  createdAt: '2026-09-15T01:05:00.000Z',
  updatedAt: '2026-09-15T01:05:00.000Z'
};

function readers(overrides: Record<string, unknown> = {}) {
  return {
    assets: { get: vi.fn(() => Promise.resolve(asset)) },
    directory: {
      getLatest: vi.fn(() =>
        Promise.resolve({
          schemaVersion: 1,
          workspaceDirectoryEntryId: DIRECTORY_ID,
          workspaceId: WORKSPACE_ID,
          version: 2,
          entryKind: 'ORGANIZATION',
          displayName: 'Acme Holdings',
          aliases: [],
          status: 'ACTIVE',
          roles: ['TRADEMARK_OWNER_CONTACT'],
          contactPoints: [],
          externalIdentityReferences: [
            {
              sourceClass: 'DATA_ENGINE_CANDIDATE',
              referenceId: 'applicant-1',
              referenceVersion: 'M1.9'
            }
          ],
          updatedAt: '2026-09-15T01:10:00.000Z'
        } as never)
      )
    },
    links: {
      listLatest: vi.fn(() =>
        Promise.resolve([
          {
            communicationLinkId: 'communication-link_asset',
            workspaceId: WORKSPACE_ID,
            version: 1,
            source: MESSAGE,
            target: {
              targetKind: 'TRADEMARK_ASSET',
              owner: 'LITE',
              workspaceId: WORKSPACE_ID,
              trademarkAssetId: ASSET_ID,
              version: 1
            },
            decision: {
              status: 'CONFIRMED',
              decidedAt: '2026-09-15T02:05:00.000Z'
            },
            lifecycle: 'ACTIVE'
          },
          {
            communicationLinkId: 'communication-link_intake',
            workspaceId: WORKSPACE_ID,
            version: 1,
            source: MESSAGE,
            target: {
              targetKind: 'PRODUCTION_INTAKE',
              owner: 'MARKREG',
              workspaceId: WORKSPACE_ID,
              intakeId: 'production-intake_1',
              version: 1,
              fingerprintSha256: 'b'.repeat(64)
            },
            decision: {
              status: 'CONFIRMED',
              decidedAt: '2026-09-15T02:06:00.000Z'
            },
            lifecycle: 'ACTIVE'
          }
        ] as never)
      )
    },
    intake: {
      listLatest: vi.fn(() =>
        Promise.resolve([
          {
            stagingId: 'lite-intake-staging_1',
            workspaceId: WORKSPACE_ID,
            version: 3,
            sources: [
              {
                ...MESSAGE,
                sourceId: 'lite-intake-source_1',
                kind: 'MANAGED_COMMUNICATION_MESSAGE'
              }
            ],
            caseCandidates: [
              {
                caseCandidateId: 'lite-intake-case_1',
                reviewedCommit: {
                  reviewedContentVersion: 2,
                  confirmedAt: '2026-09-15T02:10:00.000Z'
                },
                productionIntakeReceipt: {
                  intakeId: 'production-intake_1',
                  version: 1,
                  fingerprintSha256: 'b'.repeat(64),
                  reviewedFingerprintSha256: 'c'.repeat(64),
                  committedAt: '2026-09-15T02:11:00.000Z'
                }
              }
            ]
          }
        ] as never)
      )
    },
    work: {
      list: vi.fn(() =>
        Promise.resolve([
          {
            liteWorkItemId: 'lite-work-item_1',
            workspaceId: WORKSPACE_ID,
            version: 2,
            title: 'Wait for client reply',
            status: 'WAITING_FOR_CLIENT',
            relatedReferences: [
              {
                owner: 'LITE',
                kind: 'TRADEMARK_ASSET',
                referenceId: ASSET_ID,
                referenceVersion: 1
              }
            ],
            updatedAt: '2026-09-15T02:20:00.000Z'
          }
        ] as never)
      )
    },
    refresh: {
      listRecent: vi.fn(() =>
        Promise.resolve([
          {
            refreshRunId: 'trademark-asset-refresh_1',
            sourceOwnerScope: ['DATA_ENGINE'],
            observations: asset.sourceReferences,
            refreshedAt: '2026-09-15T02:15:00.000Z'
          }
        ] as never)
      )
    },
    ...overrides
  };
}

describe('Agency lineage projection', () => {
  it('composes an exact connected lineage without creating timeline truth', async () => {
    const service = new AgencyLineageProjectionService(readers(), () => '2026-09-15T03:00:00.000Z');

    const result = await service.project(WORKSPACE_ID, ASSET_ID);

    expect(result.events.map(({ kind }) => kind)).toEqual([
      'SOURCE_OBSERVED',
      'ASSET_ADMITTED',
      'DIRECTORY_BOUND',
      'COMMUNICATION_LINK_CONFIRMED',
      'COMMUNICATION_LINK_CONFIRMED',
      'INTAKE_REVIEWED',
      'INTAKE_COMMITTED',
      'ASSET_REFRESHED',
      'WORK_UPDATED'
    ]);
    expect(result.ownerStates.every(({ state }) => state === 'RESULTS')).toBe(true);
    expect(result.authority).toEqual({
      officialTruthCreated: false,
      legalConclusionCreated: false,
      customerInstructionCreated: false,
      externalActionAuthorized: false
    });
  });

  it('keeps a secondary owner outage visible while returning the remaining lineage', async () => {
    const service = new AgencyLineageProjectionService(
      readers({
        links: {
          listLatest: vi.fn(() =>
            Promise.reject(Object.assign(new Error('down'), { code: 'PERSISTENCE_UNAVAILABLE' }))
          )
        }
      })
    );

    const result = await service.project(WORKSPACE_ID, ASSET_ID);

    expect(result.ownerStates).toContainEqual({
      owner: 'COMMUNICATION_LINK',
      state: 'UNAVAILABLE',
      errorCode: 'PERSISTENCE_UNAVAILABLE'
    });
    expect(result.events.some(({ kind }) => kind === 'ASSET_ADMITTED')).toBe(true);
    expect(result.events.some(({ kind }) => kind === 'COMMUNICATION_LINK_CONFIRMED')).toBe(false);
  });

  it('fails closed when the primary Asset is absent from the Workspace', async () => {
    const service = new AgencyLineageProjectionService(
      readers({ assets: { get: vi.fn(() => Promise.resolve(undefined)) } })
    );

    await expect(service.project(WORKSPACE_ID, ASSET_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404
    } satisfies Partial<AgencyLineageError>);
  });
});
