import {
  managedCommunicationNoAuthorityConsequences,
  parseManagedCommunicationMessageV1,
  type ManagedCommunicationMessageV1
} from '@markorbit/contracts/managed-communication';
import type { ManagedCommunicationExactEvidenceStoreV1 } from './managed-communication-exact-evidence.js';
import {
  ManagedCommunicationFoundationError,
  type ManagedCommunicationFoundationStoreV1
} from './managed-communication-foundation.js';

export interface ManagedCommunicationInboundExactEvidenceV1 {
  rawPayload: Uint8Array;
  mediaType: string;
  headers: readonly Readonly<{ name: string; value: string }>[];
  metadata?: Readonly<Record<string, string>>;
}

export interface ManagedCommunicationInboundIngestionV1 {
  workspaceId: string;
  idempotencyKey: string;
  message: Readonly<ManagedCommunicationMessageV1>;
  exactEvidence: Readonly<ManagedCommunicationInboundExactEvidenceV1>;
}

export interface ManagedCommunicationInboundAdmissionV1 {
  schemaVersion: 1;
  observationDisposition: 'ADMITTED' | 'REPLAYED';
  exactEvidenceDisposition: 'ADMITTED' | 'REPLAYED';
  message: Readonly<ManagedCommunicationMessageV1>;
  exactEvidence: Readonly<{
    schemaVersion: 1;
    evidenceRef: string;
    sha256: string;
    mediaType: string;
    sizeBytes: number;
    observedAt: string;
    provider: string;
    providerMessageId: string;
    headers: readonly Readonly<{ name: string; value: string }>[];
    metadata: Readonly<Record<string, string>>;
  }>;
  authority: Readonly<typeof managedCommunicationNoAuthorityConsequences>;
}

export interface ManagedCommunicationInboundIngestorOptionsV1 {
  foundation: Readonly<ManagedCommunicationFoundationStoreV1>;
  exactEvidence: Readonly<ManagedCommunicationExactEvidenceStoreV1>;
  now?: () => string;
}

function canonicalNow(now: () => string): string {
  const value = now();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ManagedCommunicationFoundationError(
      'INVALID_OBSERVATION',
      'Managed Communication inbound runtime clock must return a canonical ISO timestamp.'
    );
  }
  return value;
}

export class ManagedCommunicationInboundIngestorV1 {
  private readonly now: () => string;

  constructor(private readonly options: Readonly<ManagedCommunicationInboundIngestorOptionsV1>) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async ingest(
    input: Readonly<ManagedCommunicationInboundIngestionV1>
  ): Promise<Readonly<ManagedCommunicationInboundAdmissionV1>> {
    const message = parseManagedCommunicationMessageV1(input.message);
    if (message.direction !== 'INBOUND') {
      throw new ManagedCommunicationFoundationError(
        'INVALID_OBSERVATION',
        'Managed Communication inbound ingestion only accepts INBOUND messages.'
      );
    }

    const now = canonicalNow(this.now);
    const observation = await this.options.foundation.admitObservation({
      workspaceId: input.workspaceId,
      accountRef: message.accountRef,
      idempotencyKey: input.idempotencyKey,
      message,
      now
    });
    const exactEvidence = await this.options.exactEvidence.admitExactEvidence({
      workspaceId: input.workspaceId,
      accountRef: observation.message.accountRef,
      messageId: observation.message.messageId,
      provider: observation.message.providerObservation.provider,
      providerMessageId: observation.message.providerObservation.providerMessageId,
      rawPayload: Uint8Array.from(input.exactEvidence.rawPayload),
      mediaType: input.exactEvidence.mediaType,
      observedAt: observation.message.providerObservation.observedAt,
      headers: input.exactEvidence.headers,
      ...(input.exactEvidence.metadata === undefined
        ? {}
        : { metadata: input.exactEvidence.metadata }),
      now
    });

    return Object.freeze({
      schemaVersion: 1 as const,
      observationDisposition: observation.disposition,
      exactEvidenceDisposition: exactEvidence.disposition,
      message: structuredClone(observation.message),
      exactEvidence: structuredClone(exactEvidence.evidence),
      authority: managedCommunicationNoAuthorityConsequences
    });
  }
}
