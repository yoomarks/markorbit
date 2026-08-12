import type {
  ReadyPackageV2DeliveryRequestV1,
  ReadyPackageV2DeliveryStatus
} from '@markorbit/contracts';
import { serializeReadyPackageV2DeliveryRequestV1 } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';

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
}

export interface KnowledgeV2DeliveryRepository {
  createOrFind(
    delivery: KnowledgeV2Delivery
  ): Promise<{ delivery: KnowledgeV2Delivery; created: boolean }>;
  findByDeliveryId(deliveryId: string): Promise<KnowledgeV2Delivery | null>;
}

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryKnowledgeV2DeliveryRepository implements KnowledgeV2DeliveryRepository {
  private readonly rows = new Map<string, KnowledgeV2Delivery>();

  async createOrFind(candidate: KnowledgeV2Delivery) {
    await Promise.resolve();
    const existing = this.rows.get(candidate.deliveryId);
    if (existing) return { delivery: clone(existing), created: false };
    this.rows.set(candidate.deliveryId, clone(candidate));
    return { delivery: clone(candidate), created: true };
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
const mapRow = (row: Row): KnowledgeV2Delivery => ({
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
  status: row.status as ReadyPackageV2DeliveryStatus
});

export class PostgresKnowledgeV2DeliveryRepository implements KnowledgeV2DeliveryRepository {
  constructor(private readonly query: QueryClient) {}

  async createOrFind(candidate: KnowledgeV2Delivery) {
    const result = await this.query.query(
      `INSERT INTO knowledge_v2_deliveries(
        delivery_id,idempotency_key,target_workspace_id,knowledge_workspace_id,ready_package_id,
        ready_package_digest,content_export_sha256,request_sha256,request_json,submitted_at,
        received_at,status
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
      ON CONFLICT (delivery_id) DO UPDATE
        SET delivery_id=knowledge_v2_deliveries.delivery_id
      RETURNING *, (xmax = 0) AS created`,
      [
        candidate.deliveryId,
        candidate.idempotencyKey,
        candidate.targetWorkspaceId,
        candidate.knowledgeWorkspaceId,
        candidate.readyPackageId,
        candidate.readyPackageDigest,
        candidate.contentExportSha256,
        candidate.requestSha256,
        serializeReadyPackageV2DeliveryRequestV1(candidate.request),
        candidate.submittedAt,
        candidate.receivedAt,
        candidate.status
      ]
    );
    const row = result.rows[0] as Row & { created: boolean };
    return { delivery: mapRow(row), created: row.created };
  }

  async findByDeliveryId(deliveryId: string) {
    const result = await this.query.query('SELECT * FROM knowledge_v2_deliveries WHERE delivery_id=$1', [
      deliveryId
    ]);
    return result.rows[0] ? mapRow(result.rows[0] as Row) : null;
  }
}
