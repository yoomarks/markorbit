import type {
  ReadyPackageV2DeliveryRequestV1,
  ReadyPackageV2DeliveryStatus
} from '@markorbit/contracts';
import { serializeReadyPackageV2DeliveryRequestV1 } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import {
  buildKnowledgeV2AcceptanceEvidence,
  type KnowledgeV2AcceptanceEvidence
} from './knowledge-v2-acceptance.js';

export interface KnowledgeV2Delivery {
  deliveryId: string;
  idempotencyKey: string;
  targetWorkspaceId: string;
  knowledgeWorkspaceId: string;
  readyPackageId: string;
  readyPackageDigest: string;
  contentExportSha256: string;
  requestSha256: string;
  request: ReadyPackageV2DeliveryRequestV1;
  submittedAt: string;
  receivedAt: string;
  status: ReadyPackageV2DeliveryStatus;
  acceptedAt?: string;
  acceptanceEvidence?: KnowledgeV2AcceptanceEvidence;
}

export interface KnowledgeV2DeliveryRepository {
  createOrFind(
    delivery: KnowledgeV2Delivery
  ): Promise<{ delivery: KnowledgeV2Delivery; created: boolean }>;
  findByDeliveryId(deliveryId: string): Promise<KnowledgeV2Delivery | null>;
}

const clone = <T>(value: T): T => structuredClone(value);

function accepted(
  candidate: KnowledgeV2Delivery,
  acceptedAt = new Date().toISOString()
): KnowledgeV2Delivery {
  if (candidate.status !== 'RECEIVED')
    throw new Error(
      'New Knowledge V2 consumer delivery must enter through durable RECEIVED semantics.'
    );
  return {
    ...clone(candidate),
    status: 'ACCEPTED',
    acceptedAt,
    acceptanceEvidence: buildKnowledgeV2AcceptanceEvidence(candidate)
  };
}

function reconcileReceived(existing: KnowledgeV2Delivery): KnowledgeV2Delivery {
  return accepted(existing);
}

export class MemoryKnowledgeV2DeliveryRepository implements KnowledgeV2DeliveryRepository {
  private readonly rows = new Map<string, KnowledgeV2Delivery>();

  async createOrFind(candidate: KnowledgeV2Delivery) {
    await Promise.resolve();
    const existing = this.rows.get(candidate.deliveryId);
    if (existing) {
      if (existing.requestSha256 !== candidate.requestSha256)
        return { delivery: clone(existing), created: false };
      if (existing.status === 'RECEIVED') {
        const upgraded = reconcileReceived(existing);
        this.rows.set(candidate.deliveryId, clone(upgraded));
        return { delivery: clone(upgraded), created: false };
      }
      return { delivery: clone(existing), created: false };
    }
    const durable = accepted(candidate);
    this.rows.set(candidate.deliveryId, clone(durable));
    return { delivery: clone(durable), created: true };
  }

  async findByDeliveryId(deliveryId: string) {
    await Promise.resolve();
    const value = this.rows.get(deliveryId);
    return value ? clone(value) : null;
  }

  count() {
    return this.rows.size;
  }
}

type Row = Record<string, unknown>;
const mapRow = (row: Row): KnowledgeV2Delivery => {
  const acceptedAt = row.accepted_at instanceof Date ? row.accepted_at.toISOString() : undefined;
  const acceptanceEvidence = row.acceptance_evidence as KnowledgeV2AcceptanceEvidence | null;
  return {
    deliveryId: row.delivery_id as string,
    idempotencyKey: row.idempotency_key as string,
    targetWorkspaceId: row.target_workspace_id as string,
    knowledgeWorkspaceId: row.knowledge_workspace_id as string,
    readyPackageId: row.ready_package_id as string,
    readyPackageDigest: row.ready_package_digest as string,
    contentExportSha256: row.content_export_sha256 as string,
    requestSha256: row.request_sha256 as string,
    request: row.request_json as ReadyPackageV2DeliveryRequestV1,
    submittedAt: (row.submitted_at as Date).toISOString(),
    receivedAt: (row.received_at as Date).toISOString(),
    status: row.status as ReadyPackageV2DeliveryStatus,
    ...(acceptedAt ? { acceptedAt } : {}),
    ...(acceptanceEvidence ? { acceptanceEvidence } : {})
  };
};

export class PostgresKnowledgeV2DeliveryRepository implements KnowledgeV2DeliveryRepository {
  constructor(private readonly query: QueryClient) {}

  private async acceptHistoricalReceived(existing: KnowledgeV2Delivery) {
    const upgraded = reconcileReceived(existing);
    const result = await this.query.query(
      `UPDATE knowledge_v2_deliveries
       SET status='ACCEPTED', accepted_at=$3, acceptance_evidence=$4::jsonb
       WHERE delivery_id=$1 AND request_sha256=$2 AND status='RECEIVED'
       RETURNING *`,
      [
        upgraded.deliveryId,
        upgraded.requestSha256,
        upgraded.acceptedAt,
        JSON.stringify(upgraded.acceptanceEvidence)
      ]
    );
    if (result.rows[0]) return mapRow(result.rows[0] as Row);
    return this.findByDeliveryId(existing.deliveryId);
  }

  async createOrFind(candidate: KnowledgeV2Delivery) {
    const durable = accepted(candidate);
    const result = await this.query.query(
      `INSERT INTO knowledge_v2_deliveries(
        delivery_id,idempotency_key,target_workspace_id,knowledge_workspace_id,ready_package_id,
        ready_package_digest,content_export_sha256,request_sha256,request_json,submitted_at,
        received_at,status,accepted_at,acceptance_evidence
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb)
      ON CONFLICT (delivery_id) DO UPDATE
        SET delivery_id=knowledge_v2_deliveries.delivery_id
      RETURNING *, (xmax = 0) AS created`,
      [
        durable.deliveryId,
        durable.idempotencyKey,
        durable.targetWorkspaceId,
        durable.knowledgeWorkspaceId,
        durable.readyPackageId,
        durable.readyPackageDigest,
        durable.contentExportSha256,
        durable.requestSha256,
        serializeReadyPackageV2DeliveryRequestV1(durable.request),
        durable.submittedAt,
        durable.receivedAt,
        durable.status,
        durable.acceptedAt,
        JSON.stringify(durable.acceptanceEvidence)
      ]
    );
    const row = result.rows[0] as Row & { created: boolean };
    const existing = mapRow(row);
    if (
      !row.created &&
      existing.status === 'RECEIVED' &&
      existing.requestSha256 === candidate.requestSha256
    ) {
      const upgraded = await this.acceptHistoricalReceived(existing);
      if (upgraded) return { delivery: upgraded, created: false };
    }
    return { delivery: existing, created: row.created };
  }

  async findByDeliveryId(deliveryId: string) {
    const result = await this.query.query(
      'SELECT * FROM knowledge_v2_deliveries WHERE delivery_id=$1',
      [deliveryId]
    );
    return result.rows[0] ? mapRow(result.rows[0] as Row) : null;
  }
}
