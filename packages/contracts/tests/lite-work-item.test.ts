import { describe, expect, it } from 'vitest';
import {
  isLiteWorkItemStatusTransitionAllowedV1,
  noLiteWorkItemAuthorityConsequencesV1,
  parseLiteWorkItemV1
} from '../src/lite-work-item.js';

const hashA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const hashB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const authority = noLiteWorkItemAuthorityConsequencesV1;

const manualWorkItem = {
  schemaVersion: 1,
  liteWorkItemId: 'lite-work-item_manual-001',
  workspaceId: 'workspace_agency-01',
  version: 1,
  taskType: 'GENERAL_FOLLOW_UP',
  title: 'Confirm client instructions',
  note: 'Internal follow-up only.',
  priority: 'NOTICE',
  status: 'OPEN',
  assigneePrincipalId: 'user_agency-owner',
  source: {
    sourceClass: 'MANUAL',
    recordedByPrincipalId: 'user_agency-owner',
    recordedAt: '2026-09-10T06:00:00Z'
  },
  relatedReferences: [],
  certifiedDeadlineReferences: [],
  observedDateCandidates: [],
  internalTiming: {
    timeClass: 'LITE_INTERNAL_OPERATIONAL',
    internalDueAt: '2026-09-12T09:00:00Z',
    remindAt: '2026-09-11T09:00:00Z',
    followUpAt: '2026-09-13T09:00:00Z',
    certifiedLegalDeadline: false
  },
  waitingSinceAt: null,
  completedAt: null,
  cancelledAt: null,
  archivedAt: null,
  archivedFrom: null,
  authorityConsequences: authority,
  createdAt: '2026-09-10T06:00:00Z',
  updatedAt: '2026-09-10T06:00:00Z'
} as const;

const todaySourceReference = {
  owner: 'LITE',
  kind: 'TODAY_RECOMMENDATION',
  sourceId: 'today-recommendation_follow-up-001',
  sourceVersion: 3,
  sourceFingerprintSha256: hashA,
  observedAt: '2026-09-10T06:10:00Z'
} as const;

const communicationSourceReference = {
  owner: 'CAPABILITY_ENGINE',
  kind: 'MANAGED_COMMUNICATION_MESSAGE',
  sourceId: 'managed-message_msg-001',
  sourceVersion: 'provider-observation-2026-09-10T06:11:00Z',
  sourceFingerprintSha256: hashB,
  observedAt: '2026-09-10T06:11:00Z'
} as const;

const systemPreparedWorkItem = {
  ...manualWorkItem,
  liteWorkItemId: 'lite-work-item_system-001',
  version: 2,
  taskType: 'CHECK_DEADLINE',
  title: 'Review detected response date',
  priority: 'IMPORTANT',
  source: {
    sourceClass: 'SYSTEM_PREPARED',
    sourceReferences: [todaySourceReference, communicationSourceReference],
    preparationFingerprintSha256: hashB,
    idempotencyKey: 'work-item:today-recommendation_follow-up-001:v3',
    preparedAt: '2026-09-10T06:12:00Z'
  },
  relatedReferences: [
    {
      owner: 'MARKREG',
      kind: 'CUSTOMER_RELATIONSHIP',
      workspaceId: 'workspace_agency-01',
      referenceId: 'customer-relationship_client-001',
      referenceVersion: 2
    },
    {
      owner: 'LITE',
      kind: 'WORKSPACE_DIRECTORY_ENTRY',
      workspaceId: 'workspace_agency-01',
      referenceId: 'workspace-directory-entry_client-contact-001',
      referenceVersion: 4
    },
    {
      owner: 'LITE',
      kind: 'TRADEMARK_ASSET',
      workspaceId: 'workspace_agency-01',
      referenceId: 'trademark-asset_us-001',
      referenceVersion: 7
    },
    {
      owner: 'MARKREG',
      kind: 'FORMAL_MATTER',
      workspaceId: 'workspace_agency-01',
      referenceId: 'formal-matter_us-001',
      referenceVersion: 1
    },
    {
      owner: 'MARKREG',
      kind: 'PRODUCTION_INTAKE',
      workspaceId: 'workspace_agency-01',
      referenceId: 'intake_prod-001',
      referenceVersion: 5,
      referenceFingerprintSha256: hashA
    },
    {
      owner: 'CAPABILITY_ENGINE',
      kind: 'MANAGED_COMMUNICATION_MESSAGE',
      accountRef: 'mailbox_agency-01',
      referenceId: 'managed-message_msg-001',
      provider: 'MICROSOFT_GRAPH',
      providerMessageId: 'AQMk-message-001',
      observedAt: '2026-09-10T06:11:00Z'
    }
  ],
  certifiedDeadlineReferences: [
    {
      owner: 'MARKREG',
      kind: 'MARKREG_LIFECYCLE_PROJECTION',
      referenceId: 'lifecycle-projection_formal-matter-us-001',
      referenceVersion: 8,
      deadlineField: 'responseDeadline',
      certificationReference: 'deadline-certification_markreg-001',
      checkedAt: '2026-09-10T06:12:00Z',
      legalDeadlineCertifiedByLite: false
    }
  ],
  observedDateCandidates: [
    {
      label: 'Date mentioned in provider email',
      candidateAt: '2026-09-18T23:59:59Z',
      source: communicationSourceReference,
      observedAt: '2026-09-10T06:12:00Z',
      legalDeadlineCertified: false,
      officialTruthVerified: false
    }
  ],
  createdAt: '2026-09-10T06:12:00Z',
  updatedAt: '2026-09-10T06:12:00Z'
} as const;

describe('Lite Work Item V1', () => {
  it('validates a manual task without fabricating an external source', () => {
    const parsed = parseLiteWorkItemV1(manualWorkItem, 'workspace_agency-01');

    expect(parsed.source).toEqual({
      sourceClass: 'MANUAL',
      recordedByPrincipalId: 'user_agency-owner',
      recordedAt: '2026-09-10T06:00:00Z'
    });
    expect(parsed.relatedReferences).toEqual([]);
    expect(parsed.authorityConsequences).toEqual(authority);

    expect(() =>
      parseLiteWorkItemV1({
        ...manualWorkItem,
        source: {
          ...manualWorkItem.source,
          sourceReferences: [todaySourceReference]
        }
      })
    ).toThrow('unsupported fields');
  });

  it('requires deterministic exact lineage for SYSTEM_PREPARED work', () => {
    const parsed = parseLiteWorkItemV1(systemPreparedWorkItem);

    expect(parsed.source).toMatchObject({
      sourceClass: 'SYSTEM_PREPARED',
      preparationFingerprintSha256: hashB,
      idempotencyKey: 'work-item:today-recommendation_follow-up-001:v3'
    });
    expect(parsed.source.sourceClass === 'SYSTEM_PREPARED' && parsed.source.sourceReferences).toHaveLength(
      2
    );

    expect(() =>
      parseLiteWorkItemV1({
        ...systemPreparedWorkItem,
        source: {
          ...systemPreparedWorkItem.source,
          sourceReferences: []
        }
      })
    ).toThrow('must be a non-empty array for SYSTEM_PREPARED');

    expect(() =>
      parseLiteWorkItemV1({
        ...systemPreparedWorkItem,
        source: {
          ...systemPreparedWorkItem.source,
          sourceReferences: [
            {
              ...todaySourceReference,
              owner: 'MARKREG'
            }
          ]
        }
      })
    ).toThrow('owner does not match source kind');
  });

  it('represents waiting-for-client and waiting-for-provider without implying external state', () => {
    const waitingForClient = parseLiteWorkItemV1({
      ...manualWorkItem,
      status: 'WAITING_FOR_CLIENT',
      taskType: 'WAIT_FOR_CLIENT',
      waitingSinceAt: '2026-09-10T07:00:00Z',
      updatedAt: '2026-09-10T07:00:00Z'
    });
    expect(waitingForClient.status).toBe('WAITING_FOR_CLIENT');
    expect(waitingForClient.authorityConsequences.customerNotificationEstablished).toBe(false);

    const waitingForProvider = parseLiteWorkItemV1({
      ...manualWorkItem,
      status: 'WAITING_FOR_PROVIDER',
      taskType: 'WAIT_FOR_PROVIDER',
      waitingSinceAt: '2026-09-10T07:00:00Z',
      updatedAt: '2026-09-10T07:00:00Z'
    });
    expect(waitingForProvider.status).toBe('WAITING_FOR_PROVIDER');
    expect(waitingForProvider.authorityConsequences.providerResponseEstablished).toBe(false);

    expect(() =>
      parseLiteWorkItemV1({
        ...manualWorkItem,
        status: 'WAITING_FOR_CLIENT'
      })
    ).toThrow('waitingSinceAt must be present exactly for waiting statuses');
  });

  it('keeps internal due, reminder and follow-up time separate from certified legal deadline truth', () => {
    const parsed = parseLiteWorkItemV1(systemPreparedWorkItem);

    expect(parsed.internalTiming).toEqual({
      timeClass: 'LITE_INTERNAL_OPERATIONAL',
      internalDueAt: '2026-09-12T09:00:00Z',
      remindAt: '2026-09-11T09:00:00Z',
      followUpAt: '2026-09-13T09:00:00Z',
      certifiedLegalDeadline: false
    });
    expect(parsed.certifiedDeadlineReferences[0]).not.toHaveProperty('deadlineAt');
    expect(parsed.certifiedDeadlineReferences[0]?.legalDeadlineCertifiedByLite).toBe(false);

    expect(() =>
      parseLiteWorkItemV1({
        ...manualWorkItem,
        dueDate: '2026-09-12T09:00:00Z'
      })
    ).toThrow('unsupported fields');
    expect(() =>
      parseLiteWorkItemV1({
        ...manualWorkItem,
        internalTiming: {
          ...manualWorkItem.internalTiming,
          certifiedLegalDeadline: true
        }
      })
    ).toThrow('internalTiming.certifiedLegalDeadline must be false');
  });

  it('references owner-certified deadline truth without copying or promoting the deadline value', () => {
    const parsed = parseLiteWorkItemV1(systemPreparedWorkItem);
    const reference = parsed.certifiedDeadlineReferences[0];

    expect(reference).toMatchObject({
      owner: 'MARKREG',
      kind: 'MARKREG_LIFECYCLE_PROJECTION',
      referenceId: 'lifecycle-projection_formal-matter-us-001',
      referenceVersion: 8,
      deadlineField: 'responseDeadline',
      legalDeadlineCertifiedByLite: false
    });

    expect(() =>
      parseLiteWorkItemV1({
        ...systemPreparedWorkItem,
        certifiedDeadlineReferences: [
          {
            ...systemPreparedWorkItem.certifiedDeadlineReferences[0],
            deadlineAt: '2026-09-18T23:59:59Z'
          }
        ]
      })
    ).toThrow('unsupported fields');
  });

  it('keeps a communication-derived date as an observed candidate rather than certification', () => {
    const parsed = parseLiteWorkItemV1(systemPreparedWorkItem);
    expect(parsed.observedDateCandidates[0]).toMatchObject({
      candidateAt: '2026-09-18T23:59:59Z',
      legalDeadlineCertified: false,
      officialTruthVerified: false,
      source: {
        owner: 'CAPABILITY_ENGINE',
        kind: 'MANAGED_COMMUNICATION_MESSAGE'
      }
    });

    expect(() =>
      parseLiteWorkItemV1({
        ...systemPreparedWorkItem,
        observedDateCandidates: [
          {
            ...systemPreparedWorkItem.observedDateCandidates[0],
            legalDeadlineCertified: true
          }
        ]
      })
    ).toThrow('legalDeadlineCertified must be false');
  });

  it('accepts bounded exact related owner references and rejects cross-Workspace or malformed refs', () => {
    const parsed = parseLiteWorkItemV1(systemPreparedWorkItem);
    expect(parsed.relatedReferences).toHaveLength(6);

    expect(() =>
      parseLiteWorkItemV1({
        ...systemPreparedWorkItem,
        relatedReferences: [
          {
            ...systemPreparedWorkItem.relatedReferences[2],
            workspaceId: 'workspace_other'
          }
        ]
      })
    ).toThrow('Workspace does not match Work Item Workspace');

    expect(() =>
      parseLiteWorkItemV1({
        ...systemPreparedWorkItem,
        relatedReferences: [
          {
            owner: 'MARKREG',
            kind: 'FORMAL_MATTER',
            workspaceId: 'workspace_agency-01',
            referenceId: 'matter_bad-prefix',
            referenceVersion: 1
          }
        ]
      })
    ).toThrow('referenceId is invalid');

    expect(() =>
      parseLiteWorkItemV1({
        ...systemPreparedWorkItem,
        relatedReferences: [
          systemPreparedWorkItem.relatedReferences[0],
          systemPreparedWorkItem.relatedReferences[0]
        ]
      })
    ).toThrow('must not contain duplicate exact references');
  });

  it('makes Work completion local and unable to claim filing, payment, contact or external success', () => {
    const completed = parseLiteWorkItemV1({
      ...manualWorkItem,
      status: 'COMPLETED',
      completedAt: '2026-09-10T08:00:00Z',
      updatedAt: '2026-09-10T08:00:00Z'
    });

    expect(completed.authorityConsequences).toMatchObject({
      filingSubmitted: false,
      paymentExecuted: false,
      externalMessageSent: false,
      workCompletionRepresentsExternalSuccess: false
    });

    expect(() =>
      parseLiteWorkItemV1({
        ...manualWorkItem,
        status: 'COMPLETED',
        completedAt: '2026-09-10T08:00:00Z',
        updatedAt: '2026-09-10T08:00:00Z',
        authorityConsequences: {
          ...authority,
          filingSubmitted: true
        }
      })
    ).toThrow('authorityConsequences.filingSubmitted must be false');
  });

  it('freezes narrow operational transitions including terminal archival', () => {
    expect(isLiteWorkItemStatusTransitionAllowedV1('OPEN', 'WAITING_FOR_CLIENT')).toBe(true);
    expect(isLiteWorkItemStatusTransitionAllowedV1('WAITING_FOR_CLIENT', 'OPEN')).toBe(true);
    expect(isLiteWorkItemStatusTransitionAllowedV1('WAITING_FOR_PROVIDER', 'COMPLETED')).toBe(true);
    expect(isLiteWorkItemStatusTransitionAllowedV1('COMPLETED', 'ARCHIVED')).toBe(true);
    expect(isLiteWorkItemStatusTransitionAllowedV1('ARCHIVED', 'OPEN')).toBe(false);
    expect(isLiteWorkItemStatusTransitionAllowedV1('OPEN', 'ARCHIVED')).toBe(false);

    const archived = parseLiteWorkItemV1({
      ...manualWorkItem,
      status: 'ARCHIVED',
      completedAt: '2026-09-10T08:00:00Z',
      archivedAt: '2026-09-10T09:00:00Z',
      archivedFrom: 'COMPLETED',
      updatedAt: '2026-09-10T09:00:00Z'
    });
    expect(archived).toMatchObject({
      status: 'ARCHIVED',
      archivedFrom: 'COMPLETED',
      completedAt: '2026-09-10T08:00:00Z',
      archivedAt: '2026-09-10T09:00:00Z'
    });
  });
});
