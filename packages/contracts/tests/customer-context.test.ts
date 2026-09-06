import { describe, expect, it } from 'vitest';
import {
  customerContextLinkedWorkKinds,
  noCustomerContextAuthorityV1,
  parseCustomerContextIdentityV1,
  parseCustomerContextListV1,
  parseCustomerContextV1,
  type CustomerContextIdentityV1,
  type CustomerContextLinkedWorkKind,
  type CustomerContextLinkedWorkOwner
} from '../src/customer-context.js';

const workspaceId = '70707070-7070-4707-8707-707070707070';
const relationshipId = 'customer-relationship_contract-847' as const;

function identity(overrides: Partial<CustomerContextIdentityV1> = {}): CustomerContextIdentityV1 {
  return {
    schemaVersion: 1,
    customerRelationshipId: relationshipId,
    workspaceId,
    displayName: 'Acme Brand Team',
    relationshipModel: 'DIRECT',
    identityStatus: 'UNVERIFIED',
    origin: 'WORKSPACE_EXPLICIT',
    status: 'ACTIVE',
    version: 2,
    source: {
      owner: 'MARKREG',
      kind: 'CUSTOMER_RELATIONSHIP',
      referenceId: relationshipId,
      referenceVersion: 2,
      currentness: 'CURRENT'
    },
    createdAt: '2026-09-06T15:00:00.000Z',
    updatedAt: '2026-09-06T15:10:00.000Z',
    archivedAt: null,
    ...overrides
  };
}

const ownerByKind: Readonly<Record<CustomerContextLinkedWorkKind, CustomerContextLinkedWorkOwner>> =
  {
    FORMAL_MATTER: 'MARKREG',
    OPPORTUNITY_CANDIDATE: 'LITE',
    QUALIFICATION_DECISION: 'LITE',
    CONTENT_OPPORTUNITY: 'LITE',
    PREPARED_ACTION: 'LITE',
    PROFESSIONAL_REVIEW: 'EXECUTION',
    EXECUTION_PREPARATION: 'EXECUTION'
  };

function unknownLinkedWork() {
  return customerContextLinkedWorkKinds.map((kind) => ({
    kind,
    owner: ownerByKind[kind],
    availability: {
      state: 'UNKNOWN' as const,
      reasonCode: 'CANONICAL_LINK_NOT_ESTABLISHED' as const,
      references: [] as const
    }
  }));
}
describe('Canonical Customer Context V1 contract', () => {
  it('accepts exact MarkReg identity and preserves bounded authority', () => {
    expect(parseCustomerContextIdentityV1(identity(), workspaceId)).toEqual(identity());
    const context = parseCustomerContextV1(
      {
        schemaVersion: 1,
        workspaceId,
        customerRelationship: identity(),
        linkedWork: unknownLinkedWork(),
        authorityConsequences: noCustomerContextAuthorityV1
      },
      workspaceId
    );
    expect(context.linkedWork).toHaveLength(customerContextLinkedWorkKinds.length);
    expect(context.linkedWork.every((group) => group.availability.state === 'UNKNOWN')).toBe(true);
    expect(context.authorityConsequences).toEqual(noCustomerContextAuthorityV1);
  });

  it('fails closed on Workspace, source version, currentness or authority drift', () => {
    expect(() =>
      parseCustomerContextIdentityV1(identity(), '71717171-7171-4717-8717-717171717171')
    ).toThrow();
    expect(() =>
      parseCustomerContextIdentityV1({
        ...identity(),
        source: { ...identity().source, referenceVersion: 1 }
      })
    ).toThrow(/source version/u);
    expect(() =>
      parseCustomerContextIdentityV1({
        ...identity(),
        status: 'ARCHIVED',
        archivedAt: '2026-09-06T15:11:00.000Z'
      })
    ).toThrow(/status\/currentness/u);
    expect(() =>
      parseCustomerContextV1({
        schemaVersion: 1,
        workspaceId,
        customerRelationship: identity(),
        linkedWork: unknownLinkedWork(),
        authorityConsequences: {
          ...noCustomerContextAuthorityV1,
          contactAuthorized: true
        }
      })
    ).toThrow(/contactAuthorized/u);
  });

  it('does not permit UNKNOWN linkage to collapse into known absence', () => {
    const groups = unknownLinkedWork();
    expect(
      parseCustomerContextV1({
        schemaVersion: 1,
        workspaceId,
        customerRelationship: identity(),
        linkedWork: groups,
        authorityConsequences: noCustomerContextAuthorityV1
      }).linkedWork.map((group) => group.availability.state)
    ).toEqual(Array(customerContextLinkedWorkKinds.length).fill('UNKNOWN'));
  });
  it('accepts successful empty lists but rejects inconsistent pagination', () => {
    expect(
      parseCustomerContextListV1(
        {
          schemaVersion: 1,
          workspaceId,
          page: 1,
          pageSize: 20,
          total: 0,
          items: [],
          authorityConsequences: noCustomerContextAuthorityV1
        },
        workspaceId
      )
    ).toMatchObject({ total: 0, items: [] });
    expect(() =>
      parseCustomerContextListV1({
        schemaVersion: 1,
        workspaceId,
        page: 1,
        pageSize: 1,
        total: 0,
        items: [identity()],
        authorityConsequences: noCustomerContextAuthorityV1
      })
    ).toThrow(/pagination/u);
  });

  it('requires exactly one correctly-owned linked-work group per governed kind', () => {
    expect(() =>
      parseCustomerContextV1({
        schemaVersion: 1,
        workspaceId,
        customerRelationship: identity(),
        linkedWork: unknownLinkedWork().slice(0, -1),
        authorityConsequences: noCustomerContextAuthorityV1
      })
    ).toThrow(/each governed work kind once/u);

    const wrongOwner = unknownLinkedWork();
    wrongOwner[0] = { ...wrongOwner[0]!, owner: 'LITE' };
    expect(() =>
      parseCustomerContextV1({
        schemaVersion: 1,
        workspaceId,
        customerRelationship: identity(),
        linkedWork: wrongOwner,
        authorityConsequences: noCustomerContextAuthorityV1
      })
    ).toThrow(/owner does not match/u);
  });
});

describe('Customer Context linked-work availability', () => {
  it('keeps available, known absent, unknown and source unavailable distinct', () => {
    const groups: unknown[] = [...unknownLinkedWork()];
    groups[0] = {
      kind: 'FORMAL_MATTER',
      owner: 'MARKREG',
      availability: {
        state: 'AVAILABLE',
        references: [
          {
            owner: 'MARKREG',
            kind: 'FORMAL_MATTER',
            referenceId: 'formal-matter_847',
            referenceVersion: 4,
            currentness: 'CURRENT'
          }
        ]
      }
    };
    groups[1] = {
      kind: 'OPPORTUNITY_CANDIDATE',
      owner: 'LITE',
      availability: { state: 'KNOWN_ABSENT', references: [] }
    };
    groups[2] = {
      kind: 'QUALIFICATION_DECISION',
      owner: 'LITE',
      availability: {
        state: 'SOURCE_UNAVAILABLE',
        reasonCode: 'LITE_SOURCE_UNAVAILABLE',
        retryable: true,
        references: []
      }
    };
    const parsed = parseCustomerContextV1({
      schemaVersion: 1,
      workspaceId,
      customerRelationship: identity(),
      linkedWork: groups,
      authorityConsequences: noCustomerContextAuthorityV1
    });
    expect(parsed.linkedWork.slice(0, 4).map((group) => group.availability.state)).toEqual([
      'AVAILABLE',
      'KNOWN_ABSENT',
      'SOURCE_UNAVAILABLE',
      'UNKNOWN'
    ]);
  });
});
