import { describe, expect, it } from 'vitest';
import {
  extractManagedCommunicationPublicMailRefsV1,
  managedCommunicationPublicMailRefFromSendIdV1,
  managedCommunicationPublicMailReferenceAuthorityV1,
  managedCommunicationSendIdFromPublicMailRefV1,
  parseManagedCommunicationPublicMailReferenceResolutionV1
} from '../src/managed-communication-public-reference.js';

describe('Managed Communication public mail reference V1', () => {
  it('round-trips the full 128-bit opaque send identity', () => {
    expect(
      managedCommunicationPublicMailRefFromSendIdV1('commsend_00000000000000000000000000000000')
    ).toBe('MO-00000000000000000000000000');
    expect(
      managedCommunicationPublicMailRefFromSendIdV1('commsend_ffffffffffffffffffffffffffffffff')
    ).toBe('MO-7ZZZZZZZZZZZZZZZZZZZZZZZZZ');

    const sendId = 'commsend_0123456789abcdef0123456789abcdef';
    const ref = managedCommunicationPublicMailRefFromSendIdV1(sendId);
    expect(ref).toMatch(/^MO-[0-9A-HJKMNP-TV-Z]{26}$/u);
    expect(managedCommunicationSendIdFromPublicMailRefV1(ref)).toBe(sendId);
    expect(managedCommunicationSendIdFromPublicMailRefV1(ref.toLowerCase())).toBe(sendId);
  });

  it('extracts unique references without treating surrounding business text as identity', () => {
    const first = managedCommunicationPublicMailRefFromSendIdV1(
      'commsend_0123456789abcdef0123456789abcdef'
    );
    const second = managedCommunicationPublicMailRefFromSendIdV1(
      'commsend_fedcba9876543210fedcba9876543210'
    );
    expect(
      extractManagedCommunicationPublicMailRefsV1(
        `Re: filing update [${first}]\nReference: ${first}. Related: ${second}`
      )
    ).toEqual([first, second]);
  });

  it('rejects non-canonical references that exceed the 128-bit send range', () => {
    expect(() =>
      managedCommunicationSendIdFromPublicMailRefV1('MO-ZZZZZZZZZZZZZZZZZZZZZZZZZZ')
    ).toThrow(/128-bit/u);
  });

  it('validates an exact no-authority resolution', () => {
    const sendId = 'commsend_0123456789abcdef0123456789abcdef';
    const publicMailRef = managedCommunicationPublicMailRefFromSendIdV1(sendId);
    expect(
      parseManagedCommunicationPublicMailReferenceResolutionV1({
        schemaVersion: 1,
        workspaceId: 'workspace-1',
        publicMailRef,
        sendId,
        accountRef: 'account-1',
        messageId: 'message-1',
        threadRef: 'thread-1',
        provider: 'MICROSOFT_GRAPH',
        providerMessageId: 'provider-message-1',
        providerThreadId: 'provider-thread-1',
        acceptedAt: '2026-09-22T00:00:00.000Z',
        authority: managedCommunicationPublicMailReferenceAuthorityV1
      })
    ).toMatchObject({
      workspaceId: 'workspace-1',
      publicMailRef,
      sendId,
      messageId: 'message-1',
      authority: managedCommunicationPublicMailReferenceAuthorityV1
    });
  });

  it('rejects authority material outside the frozen no-authority shape', () => {
    const sendId = 'commsend_0123456789abcdef0123456789abcdef';
    expect(() =>
      parseManagedCommunicationPublicMailReferenceResolutionV1({
        schemaVersion: 1,
        workspaceId: 'workspace-1',
        publicMailRef: managedCommunicationPublicMailRefFromSendIdV1(sendId),
        sendId,
        accountRef: 'account-1',
        messageId: 'message-1',
        threadRef: 'thread-1',
        provider: 'MICROSOFT_GRAPH',
        providerMessageId: 'provider-message-1',
        acceptedAt: '2026-09-22T00:00:00.000Z',
        authority: { ...managedCommunicationPublicMailReferenceAuthorityV1, hiddenAuthority: false }
      })
    ).toThrow(/exactly the V1 authority fields/u);
  });
});
