import { describe, expect, it } from 'vitest';
import {
  noWorkspaceDirectoryAuthorityConsequencesV1,
  type WorkspaceDirectoryEntryId
} from '@markorbit/contracts/workspace-directory';
import {
  materializeArchivedWorkspaceDirectoryEntryV1,
  materializeUpdatedWorkspaceDirectoryEntryV1,
  materializeWorkspaceDirectoryEntryV1,
  normalizeWorkspaceDirectoryLocalName
} from '../src/workspace-directory.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const id = 'workspace-directory-entry_unit' as WorkspaceDirectoryEntryId;
const baseCommand = {
  workspaceId,
  actorPrincipalId: 'user_directory_owner',
  idempotencyKey: 'create-unit',
  entryKind: 'ORGANIZATION' as const,
  displayName: '  Example   Holdings Limited  ',
  aliases: ['Example Holdings', 'EXAMPLE HOLDINGS LTD.'],
  roles: ['CLIENT_CONTACT' as const],
  externalIdentityReferences: [
    {
      kind: 'APPLICANT_IDENTITY' as const,
      sourceClass: 'DATA_ENGINE_CANDIDATE' as const,
      referenceId: 'candidate:example-holdings',
      label: 'EXAMPLE HOLDINGS LIMITED',
      jurisdiction: 'SG',
      observedAt: '2026-09-11T08:00:00.000Z',
      verifiedLegalIdentityByDirectory: false as const,
      managedTrademarkRelationshipEstablishedByDirectory: false as const
    }
  ]
};

describe('Workspace Directory runtime materialization', () => {
  it('creates Workspace-private operational state with zero authority consequences', () => {
    const created = materializeWorkspaceDirectoryEntryV1(
      baseCommand,
      '2026-09-11T08:10:00.000Z',
      id
    );
    expect(created).toMatchObject({
      workspaceDirectoryEntryId: id,
      workspaceId,
      version: 1,
      status: 'ACTIVE',
      entryKind: 'ORGANIZATION',
      displayName: 'Example   Holdings Limited',
      aliases: ['Example Holdings', 'EXAMPLE HOLDINGS LTD.'],
      provenance: {
        sourceKind: 'WORKSPACE_USER',
        sourceReference: 'workspace-principal:user_directory_owner'
      },
      authorityConsequences: noWorkspaceDirectoryAuthorityConsequencesV1
    });
    expect(created.authorityConsequences.verifiedLegalIdentityEstablished).toBe(false);
    expect(created.authorityConsequences.contactAuthorizationEstablished).toBe(false);
    expect(created.authorityConsequences.managedTrademarkRelationshipCreated).toBe(false);
    expect(created.authorityConsequences.externalActionAuthorized).toBe(false);
    expect(created.authorityConsequences.officialTruthCreated).toBe(false);
    expect(normalizeWorkspaceDirectoryLocalName('  EXAMPLE   Holdings  ')).toBe('example holdings');
  });

  it('updates only an ACTIVE exact version and preserves immutable creation lineage', () => {
    const created = materializeWorkspaceDirectoryEntryV1(
      baseCommand,
      '2026-09-11T08:10:00.000Z',
      id
    );
    const updated = materializeUpdatedWorkspaceDirectoryEntryV1(
      created,
      {
        workspaceId,
        actorPrincipalId: 'user_directory_owner',
        workspaceDirectoryEntryId: id,
        expectedVersion: 1,
        idempotencyKey: 'update-unit',
        displayName: 'Example Holdings Pte. Ltd.',
        aliases: ['Example Holdings'],
        roles: ['CLIENT_CONTACT', 'BILLING_CONTACT']
      },
      '2026-09-11T08:11:00.000Z'
    );
    expect(updated).toMatchObject({
      version: 2,
      status: 'ACTIVE',
      displayName: 'Example Holdings Pte. Ltd.',
      aliases: ['Example Holdings'],
      roles: ['CLIENT_CONTACT', 'BILLING_CONTACT'],
      createdAt: created.createdAt,
      archivedAt: null
    });
    expect(updated.externalIdentityReferences).toEqual(created.externalIdentityReferences);
    expect(() =>
      materializeUpdatedWorkspaceDirectoryEntryV1(
        created,
        {
          workspaceId,
          actorPrincipalId: 'user_directory_owner',
          workspaceDirectoryEntryId: id,
          expectedVersion: 2,
          idempotencyKey: 'stale-unit',
          displayName: 'stale'
        },
        '2026-09-11T08:12:00.000Z'
      )
    ).toThrow(/Expected Directory entry version 2, found 1/u);
  });

  it('archives immutably and rejects later update or repeated archive', () => {
    const created = materializeWorkspaceDirectoryEntryV1(
      baseCommand,
      '2026-09-11T08:10:00.000Z',
      id
    );
    const archived = materializeArchivedWorkspaceDirectoryEntryV1(
      created,
      {
        workspaceId,
        workspaceDirectoryEntryId: id,
        expectedVersion: 1,
        idempotencyKey: 'archive-unit'
      },
      '2026-09-11T08:12:00.000Z'
    );
    expect(archived).toMatchObject({
      version: 2,
      status: 'ARCHIVED',
      archivedAt: '2026-09-11T08:12:00.000Z'
    });
    expect(() =>
      materializeUpdatedWorkspaceDirectoryEntryV1(
        archived,
        {
          workspaceId,
          actorPrincipalId: 'user_directory_owner',
          workspaceDirectoryEntryId: id,
          expectedVersion: 2,
          idempotencyKey: 'update-archived',
          displayName: 'No longer mutable'
        },
        '2026-09-11T08:13:00.000Z'
      )
    ).toThrow(/cannot be updated/u);
    expect(() =>
      materializeArchivedWorkspaceDirectoryEntryV1(
        archived,
        {
          workspaceId,
          workspaceDirectoryEntryId: id,
          expectedVersion: 2,
          idempotencyKey: 'archive-again'
        },
        '2026-09-11T08:13:00.000Z'
      )
    ).toThrow(/already archived/u);
  });

  it('fails closed when an update carries no mutable field', () => {
    const created = materializeWorkspaceDirectoryEntryV1(
      baseCommand,
      '2026-09-11T08:10:00.000Z',
      id
    );
    expect(() =>
      materializeUpdatedWorkspaceDirectoryEntryV1(
        created,
        {
          workspaceId,
          actorPrincipalId: 'user_directory_owner',
          workspaceDirectoryEntryId: id,
          expectedVersion: 1,
          idempotencyKey: 'empty-update'
        },
        '2026-09-11T08:11:00.000Z'
      )
    ).toThrow(/at least one mutable Directory field/u);
  });
});
