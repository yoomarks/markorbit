import {
  ManagedCommunicationPublicMailReferenceContractError,
  managedCommunicationPublicMailReferenceAuthorityV1,
  managedCommunicationSendIdFromPublicMailRefV1,
  parseManagedCommunicationPublicMailReferenceResolutionV1,
  type ManagedCommunicationPublicMailReferenceResolutionV1
} from '@markorbit/contracts/managed-communication-public-reference';
import type { ManagedCommunicationSendReceiptReaderV1 } from './managed-communication-exchange.js';

export type ManagedCommunicationPublicReferenceErrorCode =
  'INVALID_PUBLIC_MAIL_REF' | 'PUBLIC_MAIL_REF_NOT_FOUND';

export class ManagedCommunicationPublicReferenceError extends Error {
  constructor(
    readonly code: ManagedCommunicationPublicReferenceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ManagedCommunicationPublicReferenceError';
  }
}

export class ManagedCommunicationPublicReferenceReaderV1 {
  constructor(private readonly receipts: ManagedCommunicationSendReceiptReaderV1) {}

  async resolve(input: {
    workspaceId: string;
    publicMailRef: string;
  }): Promise<Readonly<ManagedCommunicationPublicMailReferenceResolutionV1>> {
    let sendId: string;
    try {
      sendId = managedCommunicationSendIdFromPublicMailRefV1(input.publicMailRef);
    } catch (error) {
      if (error instanceof ManagedCommunicationPublicMailReferenceContractError) {
        throw new ManagedCommunicationPublicReferenceError(
          'INVALID_PUBLIC_MAIL_REF',
          error.message
        );
      }
      throw error;
    }

    const receipt = await this.receipts.resolveSentBySendId(input.workspaceId, sendId);
    const requestedRef = input.publicMailRef.trim().toUpperCase();
    if (!receipt || receipt.publicMailRef !== requestedRef) {
      throw new ManagedCommunicationPublicReferenceError(
        'PUBLIC_MAIL_REF_NOT_FOUND',
        'Public mail reference does not resolve to proven sent evidence in this Workspace.'
      );
    }

    return Object.freeze(
      parseManagedCommunicationPublicMailReferenceResolutionV1({
        schemaVersion: 1,
        workspaceId: receipt.workspaceId,
        publicMailRef: receipt.publicMailRef,
        sendId: receipt.sendId,
        accountRef: receipt.accountRef,
        messageId: receipt.messageId,
        threadRef: receipt.threadRef,
        provider: receipt.provider,
        providerMessageId: receipt.providerMessageId,
        ...(receipt.providerThreadId === undefined
          ? {}
          : { providerThreadId: receipt.providerThreadId }),
        acceptedAt: receipt.acceptedAt,
        authority: managedCommunicationPublicMailReferenceAuthorityV1
      })
    );
  }
}
