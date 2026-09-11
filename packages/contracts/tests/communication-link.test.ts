import { describe, expect, it } from 'vitest';

import {
  communicationLinkDecisionFingerprintSha256V1,
  isCommunicationLinkThreadInheritanceEligibleV1,
  noCommunicationLinkAuthorityConsequencesV1,
  parseCommunicationLinkThreadLookupResultV1,
  parseCommunicationLinkV1,
  type CommunicationLinkDecisionBasis,
  type CommunicationLinkSourceReferenceV1,
  type CommunicationLinkTargetReferenceV1
} from '../src/communication-link.js';

const OBSERVED_AT = '2026-09-11T00:59:00.000Z';
const CREATED_AT = '2026-09-11T01:00:00.000Z';
const DECIDED_AT = '2026-09-11T01:01:00.000Z';
const ARCHIVED_AT = '2026-09-11T01:01:30.000Z';
const UPDATED_AT = '2026-09-11T01:02:00.000Z';
const EVALUATED_AT = '2026-09-11T01:03:00.000Z';

function source(scope: 'MESSAGE' | 'THREAD' = 'THREAD'): CommunicationLinkSourceReferenceV1 {
  return {
    owner: 'MANAGED_COMMUNICATION',
    scope,
    accountRef: 'account-outlook-1',
    messageId: 'message-1',
    threadRef: 'thread-1',
    provider: 'MICROSOFT_GRAPH',
    providerMessageId: 'graph-message-1',
    observedAt: OBSERVED_AT
  };
}

function assetTarget(workspaceId = 'workspace-a'): CommunicationLinkTargetReferenceV1 {
  return {
    targetKind: 'TRADEMARK_ASSET',
    owner: 'LITE',
    workspaceId,
    trademarkAssetId: 'trademark-asset_agency-1',
    version: 3
  };
}

function decision(
  sourceRef: CommunicationLinkSourceReferenceV1,
  targetRef: CommunicationLinkTargetReferenceV1,
  status: 'CONFIRMED' | 'REJECTED' = 'CONFIRMED',
  basis: CommunicationLinkDecisionBasis = 'EXACT_IDENTIFIER'
) {
  const reason = 'Reviewed against the exact message and target.';
  const evidenceReferences = ['resolver:exact-identifier:message-1'] as const;
  return {
    status,
    basis,
    authority: 'HUMAN' as const,
    decidedByPrincipalId: 'principal_mile',
    decidedAt: DECIDED_AT,
    reason,
    evidenceReferences,
    decisionFingerprintSha256: communicationLinkDecisionFingerprintSha256V1({
      source: sourceRef,
      target: targetRef,
      status,
      basis,
      reason,
      evidenceReferences
    })
  };
}

function link(
  scope: 'MESSAGE' | 'THREAD' = 'THREAD',
  decisionStatus: 'CONFIRMED' | 'REJECTED' = 'CONFIRMED',
  basis: CommunicationLinkDecisionBasis = 'EXACT_IDENTIFIER',
  targetRef: CommunicationLinkTargetReferenceV1 = assetTarget()
) {
  const sourceRef = source(scope);
  return {
    schemaVersion: 1 as const,
    communicationLinkId: 'communication-link_agency-1',
    workspaceId: 'workspace-a',
    version: 1,
    source: sourceRef,
    target: targetRef,
    decision: decision(sourceRef, targetRef, decisionStatus, basis),
    lifecycle: 'ACTIVE' as const,
    archivedAt: null,
    authorityConsequences: noCommunicationLinkAuthorityConsequencesV1,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT
  };
}

function lookup(readState: 'RESULTS' | 'EMPTY' | 'NOT_OBSERVED' | 'UNAVAILABLE') {
  return {
    schemaVersion: 1 as const,
    workspaceId: 'workspace-a',
    accountRef: 'account-outlook-1',
    threadRef: 'thread-1',
    readState,
    links: readState === 'RESULTS' ? [link()] : [],
    evaluatedAt: EVALUATED_AT
  };
}

describe('Communication Link V1', () => {
  it('retains the exact reviewed Managed Communication anchor for THREAD without promoting truth', () => {
    const parsed = parseCommunicationLinkV1(link(), 'workspace-a');
    expect(parsed.source).toEqual({
      owner: 'MANAGED_COMMUNICATION',
      scope: 'THREAD',
      accountRef: 'account-outlook-1',
      messageId: 'message-1',
      threadRef: 'thread-1',
      provider: 'MICROSOFT_GRAPH',
      providerMessageId: 'graph-message-1',
      observedAt: OBSERVED_AT
    });
    expect(parsed.target.targetKind).toBe('TRADEMARK_ASSET');
    expect(parsed.decision.status).toBe('CONFIRMED');
    expect(parsed.decision.authority).toBe('HUMAN');
    expect(parsed.authorityConsequences).toEqual(noCommunicationLinkAuthorityConsequencesV1);
    expect(Object.values(parsed.authorityConsequences).every((value) => value === false)).toBe(
      true
    );
  });

  it('keeps MESSAGE and THREAD scopes distinct while both retain the reviewed message anchor', () => {
    const message = parseCommunicationLinkV1(link('MESSAGE'));
    const thread = parseCommunicationLinkV1(link('THREAD'));
    expect(message.source.scope).toBe('MESSAGE');
    expect(thread.source.scope).toBe('THREAD');
    expect(message.source.messageId).toBe('message-1');
    expect(thread.source.messageId).toBe('message-1');
    expect(message.source.providerMessageId).toBe('graph-message-1');
    expect(thread.source.providerMessageId).toBe('graph-message-1');
    expect(isCommunicationLinkThreadInheritanceEligibleV1(message)).toBe(false);
    expect(isCommunicationLinkThreadInheritanceEligibleV1(thread)).toBe(true);
  });

  it('validates decision basis and immutable fingerprint against normalized reviewed material', () => {
    for (const basis of ['MANUAL', 'EXACT_IDENTIFIER', 'CONFIRMED_THREAD_INHERITANCE'] as const) {
      expect(parseCommunicationLinkV1(link('THREAD', 'CONFIRMED', basis)).decision.basis).toBe(
        basis
      );
    }
    const changedReason = structuredClone(link()) as Record<string, unknown>;
    (changedReason.decision as Record<string, unknown>).reason = 'Changed after fingerprinting.';
    expect(() => parseCommunicationLinkV1(changedReason)).toThrow();

    const changedEvidence = structuredClone(link()) as Record<string, unknown>;
    (changedEvidence.decision as Record<string, unknown>).evidenceReferences = ['resolver:other'];
    expect(() => parseCommunicationLinkV1(changedEvidence)).toThrow();

    const malformedFingerprint = structuredClone(link()) as Record<string, unknown>;
    (malformedFingerprint.decision as Record<string, unknown>).decisionFingerprintSha256 = 'ABC';
    expect(() => parseCommunicationLinkV1(malformedFingerprint)).toThrow();

    const unknownBasis = structuredClone(link()) as Record<string, unknown>;
    (unknownBasis.decision as Record<string, unknown>).basis = 'AI_MATCH';
    expect(() => parseCommunicationLinkV1(unknownBasis)).toThrow();
  });

  it('allows inheritance only for ACTIVE human CONFIRMED THREAD decisions', () => {
    expect(isCommunicationLinkThreadInheritanceEligibleV1(parseCommunicationLinkV1(link()))).toBe(
      true
    );
    expect(
      isCommunicationLinkThreadInheritanceEligibleV1(parseCommunicationLinkV1(link('MESSAGE')))
    ).toBe(false);
    expect(
      isCommunicationLinkThreadInheritanceEligibleV1(
        parseCommunicationLinkV1(link('THREAD', 'REJECTED'))
      )
    ).toBe(false);

    const archived = { ...link(), lifecycle: 'ARCHIVED' as const, archivedAt: ARCHIVED_AT };
    expect(isCommunicationLinkThreadInheritanceEligibleV1(parseCommunicationLinkV1(archived))).toBe(
      false
    );
  });

  it('accepts only existing exact target owner references including Production Intake fingerprint lineage', () => {
    const customer: CommunicationLinkTargetReferenceV1 = {
      targetKind: 'CUSTOMER_RELATIONSHIP',
      owner: 'MARKREG',
      workspaceId: 'workspace-a',
      customerRelationshipId: 'customer-relationship_1',
      version: 2
    };
    expect(
      parseCommunicationLinkV1(link('THREAD', 'CONFIRMED', 'MANUAL', customer)).target.targetKind
    ).toBe('CUSTOMER_RELATIONSHIP');

    const directory: CommunicationLinkTargetReferenceV1 = {
      targetKind: 'WORKSPACE_DIRECTORY_ENTRY',
      owner: 'LITE',
      workspaceId: 'workspace-a',
      workspaceDirectoryEntryId: 'workspace-directory-entry_1',
      version: 4
    };
    expect(
      parseCommunicationLinkV1(link('THREAD', 'CONFIRMED', 'MANUAL', directory)).target.targetKind
    ).toBe('WORKSPACE_DIRECTORY_ENTRY');

    const matter: CommunicationLinkTargetReferenceV1 = {
      targetKind: 'FORMAL_MATTER',
      owner: 'MARKREG',
      workspaceId: 'workspace-a',
      formalMatterId: 'formal-matter_1',
      version: 5
    };
    expect(
      parseCommunicationLinkV1(link('THREAD', 'CONFIRMED', 'MANUAL', matter)).target.targetKind
    ).toBe('FORMAL_MATTER');

    const intake: CommunicationLinkTargetReferenceV1 = {
      targetKind: 'PRODUCTION_INTAKE',
      owner: 'MARKREG',
      workspaceId: 'workspace-a',
      intakeId: 'production-intake_1',
      version: 6,
      fingerprintSha256: 'a'.repeat(64)
    };
    const parsed = parseCommunicationLinkV1(link('THREAD', 'CONFIRMED', 'MANUAL', intake));
    expect(parsed.target).toEqual(intake);

    const missingFingerprint = structuredClone(
      link('THREAD', 'CONFIRMED', 'MANUAL', intake)
    ) as Record<string, unknown>;
    delete (missingFingerprint.target as Record<string, unknown>).fingerprintSha256;
    expect(() => parseCommunicationLinkV1(missingFingerprint)).toThrow();

    const malformedFingerprint = structuredClone(
      link('THREAD', 'CONFIRMED', 'MANUAL', intake)
    ) as Record<string, unknown>;
    (malformedFingerprint.target as Record<string, unknown>).fingerprintSha256 = 'not-a-sha';
    expect(() => parseCommunicationLinkV1(malformedFingerprint)).toThrow();
  });

  it('fails closed on Workspace drift, wrong owner and wrong target identity', () => {
    expect(() => parseCommunicationLinkV1(link(), 'workspace-b')).toThrow();
    expect(() =>
      parseCommunicationLinkV1(link('THREAD', 'CONFIRMED', 'MANUAL', assetTarget('workspace-b')))
    ).toThrow();

    const wrongOwner = structuredClone(link()) as Record<string, unknown>;
    (wrongOwner.target as Record<string, unknown>).owner = 'MARKREG';
    expect(() => parseCommunicationLinkV1(wrongOwner)).toThrow();

    const wrongIntake: CommunicationLinkTargetReferenceV1 = {
      targetKind: 'PRODUCTION_INTAKE',
      owner: 'MARKREG',
      workspaceId: 'workspace-a',
      intakeId: 'production-intake_valid',
      version: 1,
      fingerprintSha256: 'b'.repeat(64)
    };
    const invalidId = structuredClone(link('THREAD', 'CONFIRMED', 'MANUAL', wrongIntake)) as Record<
      string,
      unknown
    >;
    (invalidId.target as Record<string, unknown>).intakeId = 'order_1';
    expect(() => parseCommunicationLinkV1(invalidId)).toThrow();
  });

  it('rejects system/AI authority, unknown fields, duplicate evidence and authority escalation', () => {
    const ai = structuredClone(link()) as Record<string, unknown>;
    (ai.decision as Record<string, unknown>).authority = 'AI_SUGGESTION';
    expect(() => parseCommunicationLinkV1(ai)).toThrow();

    const unknown = { ...link(), autoConfirmed: true };
    expect(() => parseCommunicationLinkV1(unknown)).toThrow();

    const duplicateEvidence = structuredClone(link()) as Record<string, unknown>;
    (duplicateEvidence.decision as Record<string, unknown>).evidenceReferences = ['e1', 'e1'];
    expect(() => parseCommunicationLinkV1(duplicateEvidence)).toThrow();

    const authority = structuredClone(link()) as Record<string, unknown>;
    (authority.authorityConsequences as Record<string, unknown>).externalActionAuthorized = true;
    expect(() => parseCommunicationLinkV1(authority)).toThrow();
  });

  it('enforces ACTIVE/ARCHIVED lifecycle and archivedAt/timestamp consistency', () => {
    expect(() =>
      parseCommunicationLinkV1({ ...link(), lifecycle: 'ACTIVE', archivedAt: ARCHIVED_AT })
    ).toThrow();
    expect(() =>
      parseCommunicationLinkV1({ ...link(), lifecycle: 'ARCHIVED', archivedAt: null })
    ).toThrow();
    expect(() =>
      parseCommunicationLinkV1({
        ...link(),
        lifecycle: 'ARCHIVED',
        archivedAt: '2026-09-11T00:30:00.000Z'
      })
    ).toThrow();
    expect(() => parseCommunicationLinkV1({ ...link(), updatedAt: CREATED_AT })).toThrow();
  });

  it('preserves RESULTS, EMPTY, NOT_OBSERVED and UNAVAILABLE as distinct lookup states', () => {
    expect(parseCommunicationLinkThreadLookupResultV1(lookup('RESULTS')).links).toHaveLength(1);
    for (const state of ['EMPTY', 'NOT_OBSERVED', 'UNAVAILABLE'] as const) {
      const parsed = parseCommunicationLinkThreadLookupResultV1(lookup(state));
      expect(parsed.readState).toBe(state);
      expect(parsed.links).toEqual([]);
    }
    expect(() =>
      parseCommunicationLinkThreadLookupResultV1({ ...lookup('UNAVAILABLE'), links: [link()] })
    ).toThrow();
    expect(() =>
      parseCommunicationLinkThreadLookupResultV1({ ...lookup('RESULTS'), links: [] })
    ).toThrow();
  });

  it('fails closed on lookup Workspace/thread drift, duplicates and future evidence', () => {
    expect(() =>
      parseCommunicationLinkThreadLookupResultV1(lookup('RESULTS'), 'workspace-b')
    ).toThrow();

    const wrongThread = structuredClone(lookup('RESULTS')) as Record<string, unknown>;
    ((wrongThread.links as Array<Record<string, unknown>>)[0]!.source as Record<string, unknown>)[
      'threadRef'
    ] = 'thread-other';
    expect(() => parseCommunicationLinkThreadLookupResultV1(wrongThread)).toThrow();

    expect(() =>
      parseCommunicationLinkThreadLookupResultV1({ ...lookup('RESULTS'), links: [link(), link()] })
    ).toThrow();

    const future = structuredClone(lookup('RESULTS')) as Record<string, unknown>;
    (future.links as Array<Record<string, unknown>>)[0]!.updatedAt = '2026-09-11T02:00:00.000Z';
    expect(() => parseCommunicationLinkThreadLookupResultV1(future)).toThrow();
  });

  it('keeps REJECTED ACTIVE thread review history non-inheritable', () => {
    const rejectedLookup = { ...lookup('RESULTS'), links: [link('THREAD', 'REJECTED')] };
    const parsed = parseCommunicationLinkThreadLookupResultV1(rejectedLookup);
    expect(parsed.links[0]?.decision.status).toBe('REJECTED');
    expect(isCommunicationLinkThreadInheritanceEligibleV1(parsed.links[0]!)).toBe(false);
  });
});
