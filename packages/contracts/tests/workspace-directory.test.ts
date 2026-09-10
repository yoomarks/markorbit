import { describe, expect, it } from 'vitest';
import {
  noWorkspaceDirectoryAuthorityConsequencesV1,
  parseWorkspaceDirectoryEntryV1
} from '../src/workspace-directory.js';

const authority = noWorkspaceDirectoryAuthorityConsequencesV1;

const organizationInput = {
  schemaVersion: 1,
  workspaceDirectoryEntryId: 'workspace-directory-entry_client-org-001',
  workspaceId: 'workspace_agency-01',
  version: 3,
  entryKind: 'ORGANIZATION',
  displayName: 'Example Holdings Limited',
  aliases: ['Example Holdings', 'Example Holdings Ltd.'],
  status: 'ACTIVE',
  roles: ['CLIENT_CONTACT', 'TRADEMARK_OWNER_CONTACT', 'BILLING_CONTACT'],
  contactPoints: [
    {
      kind: 'EMAIL',
      value: 'legal@example.test',
      label: 'Legal team',
      provenance: {
        sourceKind: 'IMPORT',
        sourceReference: 'import:legacy-clients:row-41',
        capturedAt: '2026-09-10T01:00:00Z'
      }
    },
    {
      kind: 'ADDRESS',
      value: '1 Example Road, Singapore',
      provenance: {
        sourceKind: 'WORKSPACE_USER',
        sourceReference: 'workspace-action:directory-edit-001',
        capturedAt: '2026-09-10T01:10:00Z'
      }
    }
  ],
  customerRelationship: {
    owner: 'MARKREG',
    kind: 'CUSTOMER_RELATIONSHIP',
    workspaceId: 'workspace_agency-01',
    customerRelationshipId: 'customer-relationship_example-001',
    version: 2
  },
  externalIdentityReferences: [
    {
      kind: 'APPLICANT_IDENTITY',
      sourceClass: 'DATA_ENGINE_CANDIDATE',
      referenceId: 'data-engine-applicant:sg:example-holdings-limited',
      referenceVersion: 'snapshot-2026-09-10',
      label: 'EXAMPLE HOLDINGS LIMITED',
      jurisdiction: 'SG',
      observedAt: '2026-09-10T01:05:00Z',
      verifiedLegalIdentityByDirectory: false,
      managedTrademarkRelationshipEstablishedByDirectory: false
    },
    {
      kind: 'APPLICANT_IDENTITY',
      sourceClass: 'WORKSPACE_SUPPLIED',
      referenceId: 'workspace-applicant-alias:example-holdings-cn',
      label: 'Example Holdings (China)',
      jurisdiction: 'CN',
      observedAt: '2026-09-10T01:06:00Z',
      verifiedLegalIdentityByDirectory: false,
      managedTrademarkRelationshipEstablishedByDirectory: false
    }
  ],
  provenance: {
    sourceKind: 'IMPORT',
    sourceReference: 'import:legacy-clients:row-41',
    capturedAt: '2026-09-10T01:00:00Z'
  },
  authorityConsequences: authority,
  createdAt: '2026-09-10T01:00:00Z',
  updatedAt: '2026-09-10T01:10:00Z',
  archivedAt: null
} as const;

const offlineCounselInput = {
  schemaVersion: 1,
  workspaceDirectoryEntryId: 'workspace-directory-entry_foreign-counsel-001',
  workspaceId: 'workspace_agency-01',
  version: 1,
  entryKind: 'PERSON',
  displayName: 'Jane Counsel',
  aliases: ['Jane C.'],
  status: 'ACTIVE',
  roles: ['COOPERATING_AGENT', 'FOREIGN_COUNSEL'],
  contactPoints: [
    {
      kind: 'EMAIL',
      value: 'jane@foreign-counsel.test',
      provenance: {
        sourceKind: 'MANAGED_COMMUNICATION',
        sourceReference: 'managed-message:graph-message-001',
        capturedAt: '2026-09-10T02:00:00Z'
      }
    }
  ],
  externalIdentityReferences: [],
  provenance: {
    sourceKind: 'MANAGED_COMMUNICATION',
    sourceReference: 'managed-message:graph-message-001',
    capturedAt: '2026-09-10T02:00:00Z'
  },
  authorityConsequences: authority,
  createdAt: '2026-09-10T02:00:00Z',
  updatedAt: '2026-09-10T02:00:00Z',
  archivedAt: null
} as const;

describe('Workspace Directory V1', () => {
  it('represents an Organization with several local roles, contacts, aliases and applicant identity candidates', () => {
    const parsed = parseWorkspaceDirectoryEntryV1(organizationInput, 'workspace_agency-01');

    expect(parsed).toMatchObject({
      entryKind: 'ORGANIZATION',
      displayName: 'Example Holdings Limited',
      roles: ['CLIENT_CONTACT', 'TRADEMARK_OWNER_CONTACT', 'BILLING_CONTACT'],
      customerRelationship: {
        owner: 'MARKREG',
        kind: 'CUSTOMER_RELATIONSHIP',
        customerRelationshipId: 'customer-relationship_example-001',
        version: 2
      },
      authorityConsequences: authority
    });
    expect(parsed.contactPoints).toHaveLength(2);
    expect(parsed.externalIdentityReferences).toHaveLength(2);
    expect(parsed.externalIdentityReferences[0]).toMatchObject({
      verifiedLegalIdentityByDirectory: false,
      managedTrademarkRelationshipEstablishedByDirectory: false
    });
  });

  it('represents a Person and permits offline cooperating counsel without an MGSN Provider record', () => {
    const parsed = parseWorkspaceDirectoryEntryV1(offlineCounselInput);

    expect(parsed.entryKind).toBe('PERSON');
    expect(parsed.roles).toEqual(['COOPERATING_AGENT', 'FOREIGN_COUNSEL']);
    expect(parsed.provider).toBeUndefined();
    expect(parsed.authorityConsequences.providerEnrollmentCreatedByDirectory).toBe(false);
    expect(parsed.authorityConsequences.professionalAppointmentCreated).toBe(false);
  });

  it('may point to an existing Provider without copying or creating Provider truth', () => {
    const parsed = parseWorkspaceDirectoryEntryV1({
      ...offlineCounselInput,
      provider: {
        owner: 'MGSN',
        kind: 'PROVIDER',
        providerId: 'provider_foreign-counsel-001',
        providerWorkspaceId: 'workspace_provider-42'
      }
    });

    expect(parsed.provider).toEqual({
      owner: 'MGSN',
      kind: 'PROVIDER',
      providerId: 'provider_foreign-counsel-001',
      providerWorkspaceId: 'workspace_provider-42'
    });
    expect(parsed.authorityConsequences.providerEnrollmentCreatedByDirectory).toBe(false);
    expect(parsed.authorityConsequences.externalActionAuthorized).toBe(false);
  });

  it('fails closed for malformed CustomerRelationship and Provider references', () => {
    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...organizationInput,
        customerRelationship: {
          ...organizationInput.customerRelationship,
          customerRelationshipId: 'customer_001'
        }
      })
    ).toThrow('customerRelationship.customerRelationshipId is invalid');

    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...offlineCounselInput,
        provider: {
          owner: 'MGSN',
          kind: 'PROVIDER',
          providerId: 'counsel-001',
          providerWorkspaceId: 'workspace_provider-42'
        }
      })
    ).toThrow('provider.providerId is invalid');
  });

  it('makes Workspace scope explicit and rejects cross-Workspace CustomerRelationship ambiguity', () => {
    expect(() => parseWorkspaceDirectoryEntryV1(organizationInput, 'workspace_other')).toThrow(
      'Directory entry Workspace does not match'
    );

    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...organizationInput,
        customerRelationship: {
          ...organizationInput.customerRelationship,
          workspaceId: 'workspace_other'
        }
      })
    ).toThrow('customerRelationship Workspace does not match Directory entry Workspace');
  });

  it('rejects unknown top-level and nested fields rather than creating hidden CRM or authority semantics', () => {
    expect(() =>
      parseWorkspaceDirectoryEntryV1({ ...organizationInput, leadScore: 99 })
    ).toThrow('unsupported fields');

    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...organizationInput,
        contactPoints: [
          {
            ...organizationInput.contactPoints[0],
            authorizedForInstructions: true
          }
        ]
      })
    ).toThrow('unsupported fields');

    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...organizationInput,
        provider: {
          owner: 'MGSN',
          kind: 'PROVIDER',
          providerId: 'provider_foreign-counsel-001',
          providerWorkspaceId: 'workspace_provider-42',
          enrolled: true
        }
      })
    ).toThrow('unsupported fields');
  });

  it('cannot manufacture legal identity, instruction, contact, Provider, filing, payment or action authority', () => {
    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...organizationInput,
        authorityConsequences: {
          ...authority,
          contactAuthorizationEstablished: true
        }
      })
    ).toThrow('authorityConsequences.contactAuthorizationEstablished must be false');

    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...organizationInput,
        authorityConsequences: {
          ...authority,
          customerInstructionEstablished: true
        }
      })
    ).toThrow('authorityConsequences.customerInstructionEstablished must be false');

    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...organizationInput,
        externalIdentityReferences: [
          {
            ...organizationInput.externalIdentityReferences[0],
            verifiedLegalIdentityByDirectory: true
          }
        ]
      })
    ).toThrow('verifiedLegalIdentityByDirectory must be false');
  });

  it('keeps archived state local and enforces lifecycle timestamp invariants', () => {
    const archived = parseWorkspaceDirectoryEntryV1({
      ...offlineCounselInput,
      version: 2,
      status: 'ARCHIVED',
      archivedAt: '2026-09-10T03:00:00Z',
      updatedAt: '2026-09-10T03:00:00Z'
    });

    expect(archived).toMatchObject({
      status: 'ARCHIVED',
      archivedAt: '2026-09-10T03:00:00Z',
      authorityConsequences: authority
    });
    expect(archived.authorityConsequences.officialTruthCreated).toBe(false);

    expect(() =>
      parseWorkspaceDirectoryEntryV1({ ...offlineCounselInput, status: 'ARCHIVED' })
    ).toThrow('ARCHIVED Directory entry requires archivedAt');
    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...offlineCounselInput,
        archivedAt: '2026-09-10T03:00:00Z',
        updatedAt: '2026-09-10T03:00:00Z'
      })
    ).toThrow('ACTIVE Directory entry must have archivedAt = null');
  });

  it('bounds and deduplicates local collection fields', () => {
    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...organizationInput,
        aliases: ['Example Holdings', 'Example Holdings']
      })
    ).toThrow('aliases must not contain duplicates');

    expect(() =>
      parseWorkspaceDirectoryEntryV1({
        ...organizationInput,
        roles: ['CLIENT_CONTACT', 'CLIENT_CONTACT']
      })
    ).toThrow('roles must not contain duplicates');
  });
});
