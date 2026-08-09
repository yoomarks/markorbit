import type { EvidenceHandoffId, ProviderReturnId } from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import {
  ProviderReturnEvidenceError,
  type ExecutionProviderReturnEvidenceReceipt,
  type ExecutionProviderReturnEvidenceReplay,
  type ExecutionProviderReturnEvidenceRepository
} from './provider-return-evidence.js';

type Row = Record<string, unknown>;

export interface ProviderReturnEvidenceTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

export class PostgresProviderReturnEvidenceRepository implements ExecutionProviderReturnEvidenceRepository {
  constructor(
    private readonly database: ProviderReturnEvidenceTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findReplay(workspaceId: string, idempotencyKey: string) {
    try {
      const result = await this.query.query(
        'SELECT request_fingerprint,receipt_record FROM execution_provider_return_evidence_commands WHERE workspace_id=$1 AND idempotency_key=$2',
        [workspaceId, idempotencyKey]
      );
      return result.rowCount ? this.mapReplay(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findReceipt(evidenceHandoffId: EvidenceHandoffId) {
    try {
      const result = await this.query.query(
        'SELECT receipt_record FROM execution_provider_return_evidence_receipts WHERE evidence_handoff_id=$1',
        [evidenceHandoffId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).receipt_record as ExecutionProviderReturnEvidenceReceipt)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findReceiptForProviderReturn(
    providerReturnId: ProviderReturnId,
    providerReturnVersion: number
  ) {
    try {
      const result = await this.query.query(
        'SELECT receipt_record FROM execution_provider_return_evidence_receipts WHERE provider_return_id=$1 AND provider_return_version=$2',
        [providerReturnId, providerReturnVersion]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).receipt_record as ExecutionProviderReturnEvidenceReceipt)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async saveReceipt(
    receipt: ExecutionProviderReturnEvidenceReceipt,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const workspaceId = receipt.evidenceHandoff.workspaceId;
        const replay = await client.query(
          'SELECT request_fingerprint,receipt_record FROM execution_provider_return_evidence_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
          [workspaceId, idempotencyKey]
        );
        if (replay.rowCount) {
          const value = this.mapReplay(replay.rows[0] as Row);
          if (value.requestFingerprint !== requestFingerprint)
            throw new ProviderReturnEvidenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different evidence handoff payload.',
              409
            );
          return value.receipt;
        }

        const exact = await client.query(
          'SELECT evidence_handoff_id,receipt_record FROM execution_provider_return_evidence_receipts WHERE provider_return_id=$1 AND provider_return_version=$2 FOR UPDATE',
          [
            receipt.evidenceHandoff.providerReturn.id,
            receipt.evidenceHandoff.providerReturn.version
          ]
        );
        if (exact.rowCount) {
          const existing = (exact.rows[0] as Row)
            .receipt_record as ExecutionProviderReturnEvidenceReceipt;
          if (
            existing.evidenceHandoff.providerReturnFingerprintSha256 !==
            receipt.evidenceHandoff.providerReturnFingerprintSha256
          )
            throw new ProviderReturnEvidenceError(
              'SOURCE_FINGERPRINT_MISMATCH',
              'Exact Provider Return version already has a different fingerprint receipt.',
              409
            );
          await this.insertCommand(
            client,
            workspaceId,
            idempotencyKey,
            requestFingerprint,
            existing
          );
          return existing;
        }

        await client.query(
          `INSERT INTO execution_provider_return_evidence_receipts(
             evidence_handoff_id,workspace_id,provider_return_id,provider_return_version,
             provider_return_fingerprint_sha256,provider_id,provider_workspace_id,provider_actor_id,
             execution_release_id,execution_release_version,filing_execution_task_draft_id,
             filing_execution_task_draft_version,correlation_id,review_status,receipt_record,received_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)`,
          [
            receipt.evidenceHandoff.evidenceHandoffId,
            workspaceId,
            receipt.evidenceHandoff.providerReturn.id,
            receipt.evidenceHandoff.providerReturn.version,
            receipt.evidenceHandoff.providerReturnFingerprintSha256,
            receipt.providerId,
            receipt.providerWorkspaceId,
            receipt.providerActorId,
            receipt.evidenceHandoff.executionRelease.id,
            receipt.evidenceHandoff.executionRelease.version,
            receipt.evidenceHandoff.filingExecutionTaskDraft.id,
            String(receipt.evidenceHandoff.filingExecutionTaskDraft.version),
            receipt.evidenceHandoff.correlationId,
            receipt.reviewStatus,
            JSON.stringify(receipt),
            receipt.receivedAt
          ]
        );
        await this.insertCommand(client, workspaceId, idempotencyKey, requestFingerprint, receipt);
        await client.query(
          `INSERT INTO execution_provider_return_evidence_audit(
             workspace_id,evidence_handoff_id,provider_return_id,provider_return_version,
             action,source_fingerprint,created_at
           ) VALUES($1,$2,$3,$4,'PROVIDER_RETURN_EVIDENCE_RECEIVED',$5,$6)`,
          [
            workspaceId,
            receipt.evidenceHandoff.evidenceHandoffId,
            receipt.evidenceHandoff.providerReturn.id,
            receipt.evidenceHandoff.providerReturn.version,
            receipt.evidenceHandoff.providerReturnFingerprintSha256,
            receipt.receivedAt
          ]
        );
        return receipt;
      });
    } catch (cause) {
      if (cause instanceof ProviderReturnEvidenceError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new ProviderReturnEvidenceError(
          'IDEMPOTENCY_CONFLICT',
          'Evidence handoff changed concurrently.',
          409
        );
      throw this.unavailable(cause);
    }
  }

  private insertCommand(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string,
    receipt: ExecutionProviderReturnEvidenceReceipt
  ) {
    return client.query(
      `INSERT INTO execution_provider_return_evidence_commands(
         workspace_id,idempotency_key,request_fingerprint,evidence_handoff_id,receipt_record,created_at
       ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
      [
        workspaceId,
        idempotencyKey,
        requestFingerprint,
        receipt.evidenceHandoff.evidenceHandoffId,
        JSON.stringify(receipt),
        receipt.receivedAt
      ]
    );
  }

  private mapReplay(row: Row): ExecutionProviderReturnEvidenceReplay {
    return {
      requestFingerprint: String(row.request_fingerprint),
      receipt: row.receipt_record as ExecutionProviderReturnEvidenceReceipt
    };
  }

  private unavailable(cause: unknown) {
    if (cause instanceof ProviderReturnEvidenceError) return cause;
    return new ProviderReturnEvidenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Execution Provider Return evidence persistence is unavailable.',
      503,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
}
