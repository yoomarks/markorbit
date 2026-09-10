import type { ManagedCommunicationMessageV1 } from '@markorbit/contracts/managed-communication';
import type {
  TrademarkAsset,
  TrademarkAssetExternalIdentifier,
  TrademarkAssetId
} from '@markorbit/contracts/trademark-asset-workspace';
import { describe, expect, it, vi } from 'vitest';
import {
  COMMUNICATION_LINK_MAX_ASSET_CONTEXT,
  COMMUNICATION_LINK_MESSAGE_LIMITS,
  CommunicationLinkCandidateResolver,
  type CommunicationLinkThreadAssociationEvidence
} from '../src/communication-link-resolver.js';

const workspaceId = '12121212-1212-4121-8121-121212121212';
const otherWorkspaceId = '34343434-3434-4343-8343-343434343434';
const occurredAt = '2026-09-10T00:00:00.000Z';

function identifier(
  kind: TrademarkAssetExternalIdentifier['kind'],
  value: string,
  jurisdiction = 'US'
): TrademarkAssetExternalIdentifier {
  return { kind, jurisdiction, value, officialTruthVerifiedByLite: false };
}

function asset(
  suffix: string,
  identifiers: readonly TrademarkAssetExternalIdentifier[] = [],
  options: { workspaceId?: string; markText?: string } = {}
): TrademarkAsset {
  return {
    schemaVersion: 1,
    trademarkAssetId: `trademark-asset_${suffix}` as TrademarkAssetId,
    workspaceId: options.workspaceId ?? workspaceId,
    version: 1,
    identity: { jurisdiction: 'US', markText: options.markText ?? `MARK ${suffix}` },
    externalIdentifiers: identifiers,
    workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
    sourceReferences: [],
    relations: [],
    workspaceTags: [],
    workspaceNotes: [],
    officialTruthVerifiedByLite: false,
    filingExecutedByLite: false,
    createdAt: occurredAt,
    updatedAt: occurredAt
  };
}

function message(
  overrides: Partial<ManagedCommunicationMessageV1> = {}
): ManagedCommunicationMessageV1 {
  return {
    schemaVersion: 1,
    messageId: 'message-1',
    accountRef: 'account-1',
    threadRef: 'thread-1',
    channel: 'EMAIL',
    direction: 'INBOUND',
    participants: [{ role: 'SENDER', address: 'counsel@example.test', displayName: 'Counsel' }],
    attachments: [],
    occurredAt,
    providerObservation: {
      provider: 'TEST',
      providerMessageId: 'provider-message-1',
      providerThreadId: 'provider-thread-1',
      observedAt: occurredAt
    },
    ...overrides
  };
}

function association(
  target: TrademarkAsset,
  overrides: Partial<CommunicationLinkThreadAssociationEvidence> = {}
): CommunicationLinkThreadAssociationEvidence {
  return {
    associationReference: `association-${target.trademarkAssetId}`,
    workspaceId,
    accountRef: 'account-1',
    threadRef: 'thread-1',
    status: 'CONFIRMED',
    confirmationAuthority: 'HUMAN',
    target: { id: target.trademarkAssetId, version: target.version },
    ...overrides
  };
}

function fixture(
  assets: readonly TrademarkAsset[],
  associations: readonly CommunicationLinkThreadAssociationEvidence[] = []
) {
  const read = vi.fn(() => Promise.resolve(assets));
  const lookup = vi.fn(() => Promise.resolve(associations));
  return {
    read,
    lookup,
    resolver: new CommunicationLinkCandidateResolver({ read }, { lookup })
  };
}

describe('Lite deterministic Communication Link candidate resolver V0', () => {
  it('resolves an exact application number from the subject', async () => {
    const target = asset('application', [identifier('APPLICATION_NUMBER', '98-123456')]);
    const { resolver, lookup } = fixture([target]);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({ subject: 'Please review application 98 123456.' })
    });

    expect(resolved.state).toBe('MATCH_CANDIDATE');
    expect(resolved.candidates).toHaveLength(1);
    expect(resolved.candidates[0]).toMatchObject({
      target: { id: target.trademarkAssetId, version: 1 },
      method: 'EXACT_IDENTIFIER',
      confidence: 'DETERMINISTIC_EXACT',
      evidenceField: 'SUBJECT',
      matchedIdentifier: { kind: 'APPLICATION_NUMBER', value: '98-123456' }
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('resolves an exact registration number from the text body', async () => {
    const target = asset('registration', [identifier('REGISTRATION_NUMBER', '6129982')]);
    const { resolver } = fixture([target]);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({ textBody: 'The certificate for Registration No. 6129982 is attached.' })
    });

    expect(resolved.state).toBe('MATCH_CANDIDATE');
    expect(resolved.candidates[0]).toMatchObject({
      target: { id: target.trademarkAssetId },
      method: 'EXACT_IDENTIFIER',
      evidenceField: 'TEXT_BODY',
      matchedIdentifier: { kind: 'REGISTRATION_NUMBER', value: '6129982' }
    });
  });

  it('resolves Madrid IR and internal references only from existing exact identifiers', async () => {
    const madrid = asset('madrid', [identifier('MADRID_IR_NUMBER', 'IR-1817053', 'WO')]);
    const internal = asset('internal', [identifier('INTERNAL_REFERENCE', 'CLIENT/2026-091')]);
    const { resolver } = fixture([madrid, internal]);

    const madridResult = await resolver.resolve({
      workspaceId,
      message: message({ subject: 'IR 1817053 status update' })
    });
    expect(madridResult.state).toBe('MATCH_CANDIDATE');
    expect(madridResult.candidates[0]).toMatchObject({
      target: { id: madrid.trademarkAssetId },
      matchedIdentifier: { kind: 'MADRID_IR_NUMBER' }
    });

    const internalResult = await resolver.resolve({
      workspaceId,
      message: message({ textBody: 'Our reference: CLIENT-2026.091' })
    });
    expect(internalResult.state).toBe('MATCH_CANDIDATE');
    expect(internalResult.candidates[0]).toMatchObject({
      target: { id: internal.trademarkAssetId },
      matchedIdentifier: { kind: 'INTERNAL_REFERENCE' }
    });
  });

  it('normalizes only superficial safe punctuation and whitespace variants', async () => {
    const target = asset('formatted', [identifier('APPLICATION_NUMBER', 'AB-12/34')]);
    const { resolver } = fixture([target]);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({ subject: 'Case AB 12.34 requires review.' })
    });

    expect(resolved.state).toBe('MATCH_CANDIDATE');
    expect(resolved.candidates[0]).toMatchObject({ target: { id: target.trademarkAssetId } });
  });

  it('derives searchable text from HTML but ignores script and style content', async () => {
    const target = asset('html', [identifier('REGISTRATION_NUMBER', '7000123')]);
    const { resolver } = fixture([target]);

    const visible = await resolver.resolve({
      workspaceId,
      message: message({ htmlBody: '<p>Registration <strong>7000-123</strong> issued.</p>' })
    });
    expect(visible.candidates[0]).toMatchObject({
      target: { id: target.trademarkAssetId },
      evidenceField: 'HTML_DERIVED_TEXT'
    });

    const hidden = await resolver.resolve({
      workspaceId,
      message: message({ htmlBody: '<script>7000123</script><p>No reference here.</p>' })
    });
    expect(hidden.state).toBe('UNRESOLVED');
  });

  it('never treats mark text alone as exact linkage', async () => {
    const target = asset('mark-text', [], { markText: 'SISYPHE' });
    const { resolver } = fixture([target]);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({ subject: 'SISYPHE trademark update' })
    });

    expect(resolved.state).toBe('UNRESOLVED');
    expect(resolved.candidates).toEqual([]);
    expect(resolved.unsupportedMatching).toContain('MARK_TEXT');
  });

  it('never treats participant address or display name as exact linkage', async () => {
    const target = asset('participant', [identifier('APPLICATION_NUMBER', '98123456')]);
    const { resolver } = fixture([target]);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({
        participants: [
          { role: 'SENDER', address: '98123456@example.test', displayName: '98123456' }
        ]
      })
    });

    expect(resolved.state).toBe('UNRESOLVED');
    expect(resolved.unsupportedMatching).toContain('PARTICIPANT_ONLY');
  });

  it('returns ambiguous when exact evidence points to multiple Workspace assets', async () => {
    const first = asset('ambiguous-a', [identifier('REGISTRATION_NUMBER', '6005065')]);
    const second = asset('ambiguous-b', [identifier('REGISTRATION_NUMBER', '6005065')]);
    const { resolver, lookup } = fixture([first, second]);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({ textBody: 'Registration 6005065' })
    });

    expect(resolved.state).toBe('AMBIGUOUS');
    expect(new Set(resolved.candidates.map((candidate) => candidate.target.id))).toEqual(
      new Set([first.trademarkAssetId, second.trademarkAssetId])
    );
    expect(resolved.reviewRequired).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('excludes assets from another Workspace even when the identifier matches', async () => {
    const foreign = asset('foreign', [identifier('APPLICATION_NUMBER', '97167979')], {
      workspaceId: otherWorkspaceId
    });
    const { resolver } = fixture([foreign]);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({ subject: 'Application 97167979' })
    });

    expect(resolved.state).toBe('UNRESOLVED');
    expect(resolved.candidates).toEqual([]);
  });

  it('prepares thread inheritance only from a prior confirmed association', async () => {
    const target = asset('thread-target');
    const prior = association(target);
    const { resolver } = fixture([], [prior]);

    const resolved = await resolver.resolve({ workspaceId, message: message() });

    expect(resolved.state).toBe('MATCH_CANDIDATE');
    expect(resolved.candidates).toEqual([
      expect.objectContaining({
        target: { id: target.trademarkAssetId, version: 1 },
        method: 'CONFIRMED_THREAD_INHERITANCE',
        confidence: 'CONFIRMED_CONTEXT',
        inheritedAssociationReference: prior.associationReference
      })
    ]);
    expect(resolved.reviewRequired).toBe(true);
  });

  it('does not inherit unconfirmed or AI-authority thread suggestions', async () => {
    const target = asset('thread-ai');
    const suggested = association(target, {
      associationReference: 'suggested-ai',
      status: 'SUGGESTED',
      confirmationAuthority: 'AI_SUGGESTION'
    });
    const aiConfirmed = association(target, {
      associationReference: 'invalid-ai-confirmation',
      status: 'CONFIRMED',
      confirmationAuthority: 'AI_SUGGESTION'
    });
    const { resolver } = fixture([], [suggested, aiConfirmed]);

    const resolved = await resolver.resolve({ workspaceId, message: message() });

    expect(resolved.state).toBe('UNRESOLVED');
    expect(resolved.candidates).toEqual([]);
    expect(resolved.unsupportedMatching).toContain('AI_SEMANTIC');
  });

  it('preserves unresolved when no deterministic evidence exists', async () => {
    const { resolver } = fixture([asset('unrelated', [identifier('APPLICATION_NUMBER', '99999999')])]);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({ subject: 'General portfolio update', textBody: 'Nothing exact here.' })
    });

    expect(resolved.state).toBe('UNRESOLVED');
    expect(resolved.reviewRequired).toBe(false);
  });

  it('bounds huge message bodies deterministically before matching', async () => {
    const target = asset('huge', [identifier('APPLICATION_NUMBER', '98123456')]);
    const { resolver } = fixture([target]);
    const prefix = 'x'.repeat(COMMUNICATION_LINK_MESSAGE_LIMITS.textBody);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({ textBody: `${prefix} 98123456` })
    });

    expect(resolved.state).toBe('UNRESOLVED');
    expect(resolved.boundedMaterial.textBodyChars).toBe(
      COMMUNICATION_LINK_MESSAGE_LIMITS.textBody
    );
  });

  it('keeps every authority consequence false for prepared candidates', async () => {
    const target = asset('authority', [identifier('APPLICATION_NUMBER', '98554243')]);
    const { resolver } = fixture([target]);

    const resolved = await resolver.resolve({
      workspaceId,
      message: message({ subject: 'Application 98554243' })
    });

    expect(resolved.authority).toEqual({
      assetMutated: false,
      customerMutated: false,
      matterMutated: false,
      productionIntakeMutated: false,
      managedCommunicationMutated: false,
      workCreated: false,
      todayMutated: false,
      officialTruthCreated: false,
      legalDeadlineCertified: false,
      legalConclusionCreated: false
    });
  });

  it('fails closed when an injected Asset reader violates the bounded context limit', async () => {
    const assets = Array.from({ length: COMMUNICATION_LINK_MAX_ASSET_CONTEXT + 1 }, (_, index) =>
      asset(`overflow-${index}`)
    );
    const { resolver } = fixture(assets);

    await expect(resolver.resolve({ workspaceId, message: message() })).rejects.toMatchObject({
      code: 'ASSET_CONTEXT_LIMIT_EXCEEDED'
    });
  });
});
