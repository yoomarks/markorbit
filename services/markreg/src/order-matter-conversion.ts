import { createHash, randomUUID } from 'node:crypto';
import type {
  CustomerConfirmationId,
  FormalMatter,
  FormalMatterId,
  FormalMatterSourceSnapshot,
  MarkOrbitId,
  MatterDraftId,
  MatterDraftPreparation,
  MatterReadiness,
  Permission,
  WorkspacePrincipal
} from '@markorbit/contracts';
import {
  canTransitionOrder,
  type CommercialSourceSnapshot,
  type CreateMatterFromOrderCommand,
  type LinkExistingMatterToOrderCommand,
  type Order,
  type OrderId,
  type OrderMatterLinkKind,
  type OrderMatterReference
} from '@markorbit/contracts/order';
import type { QueryClient } from '@markorbit/persistence';
import { canonicalFormalMatterSnapshot } from './formal-matter.js';
import {
  canonicalOrderPersistenceValue,
  hashOrderPersistenceValue,
  type OrderTransactionHost
} from './order-persistence.js';

export type OrderMatterConversionErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'FORMAL_MATTER_NOT_FOUND'
  | 'AUTHENTICATION_REQUIRED'
  | 'WORKSPACE_MISMATCH'
  | 'PERMISSION_DENIED'
  | 'VERSION_CONFLICT'
  | 'STALE_SOURCE'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_INELIGIBLE'
  | 'INVALID_TRANSITION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DUPLICATE_SOURCE'
  | 'PERSISTENCE_UNAVAILABLE';

export class OrderMatterConversionError extends Error {
  constructor(
    readonly code: OrderMatterConversionErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OrderMatterConversionError';
  }
}

export interface OrderMatterConversionResult {
  orderId: OrderId;
  orderStatus: 'MatterCreated';
  orderVersion: number;
  formalMatterId: FormalMatterId;
  formalMatterVersion: number;
  linkKind: OrderMatterLinkKind;
  linkedAt: string;
}

interface CustomerConfirmationSource {
  confirmationId: CustomerConfirmationId;
  workspaceId: string;
  sourceQuoteId: MarkOrbitId;
  sourceQuoteVersion: string;
  status: 'CONFIRMED' | 'WITHDRAWN';
  version: number;
  sourceSnapshot: {
    quoteId: string;
    quoteVersion: string;
    planId: string;
    planVersion: string;
    currency: string;
    totalMinor: number;
  };
}

interface MatterDraftSource {
  matterDraftId: MatterDraftId;
  workspaceId: string;
  customerConfirmationId: CustomerConfirmationId;
  customerConfirmationVersion: number;
  sourceQuoteId: MarkOrbitId;
  sourceQuoteVersion: string;
  preparation: MatterDraftPreparation;
  readiness: MatterReadiness;
  status: string;
  version: number;
}

type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);

function authorize(
  principal: WorkspacePrincipal,
  workspaceId: string,
  permission: Permission
): void {
  if (principal.kind !== 'WORKSPACE')
    throw new OrderMatterConversionError(
      'AUTHENTICATION_REQUIRED',
      'A Workspace Principal is required.'
    );
  if (principal.workspaceId !== workspaceId)
    throw new OrderMatterConversionError('WORKSPACE_MISMATCH', 'Workspace context does not match.');
  if (!principal.permissions.includes(permission))
    throw new OrderMatterConversionError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`
    );
}

function commandFingerprint(operation: string, command: object): string {
  const semantic = { ...command } as Record<string, unknown>;
  delete semantic.idempotencyKey;
  return hashOrderPersistenceValue({ operation, command: semantic });
}

function mapOrder(row: Row): Order {
  const matter = row.matter_reference ? clone(row.matter_reference as Order['matter']) : undefined;
  return {
    schemaVersion: 1,
    orderId: String(row.order_id) as OrderId,
    workspaceId: String(row.workspace_id),
    orderType: 'TrademarkFiling',
    status: String(row.status) as Order['status'],
    version: Number(row.version),
    customerId: String(row.customer_id) as MarkOrbitId,
    channel: String(row.channel) as Order['channel'],
    relationshipModel: String(row.relationship_model) as Order['relationshipModel'],
    commercialSourceSnapshot: clone(row.commercial_source_snapshot as CommercialSourceSnapshot),
    commercialSourceSnapshotSha256: String(row.commercial_source_snapshot_sha256),
    ...(matter ? { matter } : {}),
    createdByUserId: String(row.created_by_user_id) as MarkOrbitId,
    updatedByUserId: String(row.updated_by_user_id) as MarkOrbitId,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  } as Order;
}

function mapFormalMatter(row: Row): FormalMatter {
  return {
    schemaVersion: 1,
    formalMatterId: String(row.formal_matter_id) as FormalMatterId,
    workspaceId: String(row.workspace_id),
    kind: 'TRADEMARK_REGISTRATION',
    status: 'OPEN',
    version: 1,
    sourceCustomerConfirmationId: String(
      row.source_customer_confirmation_id
    ) as CustomerConfirmationId,
    sourceCustomerConfirmationVersion: Number(row.source_customer_confirmation_version),
    sourceMatterDraftId: String(row.source_matter_draft_id) as MatterDraftId,
    sourceMatterDraftVersion: Number(row.source_matter_draft_version),
    sourceQuoteId: String(row.source_quote_id) as MarkOrbitId,
    sourceQuoteVersion: String(row.source_quote_version),
    sourceSnapshot: clone(row.source_snapshot as FormalMatterSourceSnapshot),
    snapshotSchemaVersion: 1,
    snapshotSha256: String(row.snapshot_sha256),
    createdByUserId: String(row.created_by_user_id) as MarkOrbitId,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapConfirmation(row: Row): CustomerConfirmationSource {
  return {
    confirmationId: String(row.confirmation_id) as CustomerConfirmationId,
    workspaceId: String(row.workspace_id),
    sourceQuoteId: String(row.source_quote_id) as MarkOrbitId,
    sourceQuoteVersion: String(row.source_quote_version),
    status: String(row.status) as CustomerConfirmationSource['status'],
    version: Number(row.version),
    sourceSnapshot: clone(row.source_snapshot as CustomerConfirmationSource['sourceSnapshot'])
  };
}

function mapDraft(row: Row): MatterDraftSource {
  return {
    matterDraftId: String(row.matter_draft_id) as MatterDraftId,
    workspaceId: String(row.workspace_id),
    customerConfirmationId: String(row.customer_confirmation_id) as CustomerConfirmationId,
    customerConfirmationVersion: Number(row.customer_confirmation_version),
    sourceQuoteId: String(row.source_quote_id) as MarkOrbitId,
    sourceQuoteVersion: String(row.source_quote_version),
    preparation: clone(row.preparation as MatterDraftPreparation),
    readiness: clone(row.readiness as MatterReadiness),
    status: String(row.status),
    version: Number(row.version)
  };
}

function result(order: Order): OrderMatterConversionResult {
  if (order.status !== 'MatterCreated' || !order.matter)
    throw new OrderMatterConversionError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Order conversion result is incomplete.'
    );
  return {
    orderId: order.orderId,
    orderStatus: 'MatterCreated',
    orderVersion: order.version,
    formalMatterId: order.matter.formalMatterId,
    formalMatterVersion: order.matter.formalMatterVersion,
    linkKind: order.matter.linkKind,
    linkedAt: order.matter.linkedAt
  };
}

function validateReadyOrder(
  order: Order,
  expectedVersion: number,
  expectedSourceSha256: string
): void {
  if (order.version !== expectedVersion)
    throw new OrderMatterConversionError(
      'VERSION_CONFLICT',
      'Order version does not match expectedOrderVersion.'
    );
  if (
    order.commercialSourceSnapshotSha256 !== expectedSourceSha256 ||
    !/^[0-9a-f]{64}$/u.test(expectedSourceSha256)
  )
    throw new OrderMatterConversionError(
      'STALE_SOURCE',
      'Order commercial source fingerprint does not match.'
    );
  if (!canTransitionOrder(order.status, 'MatterCreated'))
    throw new OrderMatterConversionError(
      'INVALID_TRANSITION',
      `Order cannot transition from ${order.status} to MatterCreated.`
    );
}

function validateCommercialLineage(
  order: Order,
  confirmation: CustomerConfirmationSource,
  draft: MatterDraftSource
): void {
  const source = order.commercialSourceSnapshot;
  if (
    confirmation.status !== 'CONFIRMED' ||
    confirmation.confirmationId !== source.customerConfirmation.confirmationId ||
    confirmation.version !== source.customerConfirmation.confirmationVersion ||
    confirmation.sourceQuoteId !== source.quote.quoteId ||
    confirmation.sourceQuoteVersion !== source.quote.quoteVersion ||
    confirmation.sourceSnapshot.quoteId !== source.quote.quoteId ||
    confirmation.sourceSnapshot.quoteVersion !== source.quote.quoteVersion ||
    confirmation.sourceSnapshot.planId !== source.commercialScope.selectedPlanId ||
    confirmation.sourceSnapshot.planVersion !== source.commercialScope.selectedPlanVersion ||
    confirmation.sourceSnapshot.currency !== source.quote.currency ||
    confirmation.sourceSnapshot.totalMinor !== source.quote.totalMinor
  )
    throw new OrderMatterConversionError(
      'STALE_SOURCE',
      'Customer Confirmation no longer matches the exact Order commercial source.'
    );
  if (
    draft.customerConfirmationId !== confirmation.confirmationId ||
    draft.customerConfirmationVersion !== confirmation.version ||
    draft.sourceQuoteId !== confirmation.sourceQuoteId ||
    draft.sourceQuoteVersion !== confirmation.sourceQuoteVersion
  )
    throw new OrderMatterConversionError(
      'SOURCE_INELIGIBLE',
      'Matter Draft lineage is inconsistent.'
    );
  if (
    draft.status !== 'READY_FOR_PROFESSIONAL_REVIEW' ||
    !draft.readiness.readyForProfessionalReview ||
    draft.readiness.checks.some((check) => check.blocking && check.status !== 'PASS') ||
    draft.preparation.commercialScopeUnchanged !== true
  )
    throw new OrderMatterConversionError(
      'SOURCE_INELIGIBLE',
      'Matter Draft is not eligible for Formal Matter creation.'
    );
}

function validateMatterLineage(order: Order, matter: FormalMatter): void {
  const source = order.commercialSourceSnapshot;
  if (
    matter.sourceCustomerConfirmationId !== source.customerConfirmation.confirmationId ||
    matter.sourceCustomerConfirmationVersion !== source.customerConfirmation.confirmationVersion ||
    matter.sourceQuoteId !== source.quote.quoteId ||
    matter.sourceQuoteVersion !== source.quote.quoteVersion ||
    matter.sourceSnapshot.customerConfirmation.status !== 'CONFIRMED' ||
    matter.sourceSnapshot.quote.id !== source.quote.quoteId ||
    matter.sourceSnapshot.quote.version !== source.quote.quoteVersion
  )
    throw new OrderMatterConversionError(
      'SOURCE_INELIGIBLE',
      'Formal Matter lineage does not match the Order commercial source.'
    );
}

function buildFormalMatter(
  order: Order,
  confirmation: CustomerConfirmationSource,
  draft: MatterDraftSource,
  principal: WorkspacePrincipal,
  at: string,
  formalMatterId: FormalMatterId
): FormalMatter {
  const snapshot: FormalMatterSourceSnapshot = {
    schemaVersion: 1,
    customerConfirmation: {
      id: confirmation.confirmationId,
      version: confirmation.version,
      status: 'CONFIRMED'
    },
    quote: {
      id: confirmation.sourceQuoteId,
      version: confirmation.sourceQuoteVersion,
      currency: confirmation.sourceSnapshot.currency,
      totalMinor: confirmation.sourceSnapshot.totalMinor
    },
    matterDraft: {
      id: draft.matterDraftId,
      version: draft.version,
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      readiness: clone(draft.readiness)
    },
    preparation: clone(draft.preparation)
  };
  return {
    schemaVersion: 1,
    formalMatterId,
    workspaceId: order.workspaceId,
    kind: 'TRADEMARK_REGISTRATION',
    status: 'OPEN',
    version: 1,
    sourceCustomerConfirmationId: confirmation.confirmationId,
    sourceCustomerConfirmationVersion: confirmation.version,
    sourceMatterDraftId: draft.matterDraftId,
    sourceMatterDraftVersion: draft.version,
    sourceQuoteId: confirmation.sourceQuoteId,
    sourceQuoteVersion: confirmation.sourceQuoteVersion,
    sourceSnapshot: snapshot,
    snapshotSchemaVersion: 1,
    snapshotSha256: createHash('sha256')
      .update(canonicalFormalMatterSnapshot(snapshot))
      .digest('hex'),
    createdByUserId: principal.userId as MarkOrbitId,
    createdAt: at,
    updatedAt: at
  };
}

async function selectOrder(
  client: QueryClient,
  workspaceId: string,
  orderId: string
): Promise<Order> {
  const selected = await client.query(
    'SELECT * FROM orders WHERE workspace_id=$1 AND order_id=$2 FOR UPDATE',
    [workspaceId, orderId]
  );
  if (!selected.rowCount)
    throw new OrderMatterConversionError('ORDER_NOT_FOUND', 'Order was not found.');
  return mapOrder(selected.rows[0] as Row);
}

async function selectConfirmation(
  client: QueryClient,
  order: Order
): Promise<CustomerConfirmationSource> {
  const selected = await client.query(
    'SELECT * FROM customer_confirmations WHERE workspace_id=$1 AND confirmation_id=$2 FOR UPDATE',
    [order.workspaceId, order.commercialSourceSnapshot.customerConfirmation.confirmationId]
  );
  if (!selected.rowCount)
    throw new OrderMatterConversionError(
      'SOURCE_NOT_FOUND',
      'Customer Confirmation was not found.'
    );
  return mapConfirmation(selected.rows[0] as Row);
}

async function selectDraft(client: QueryClient, order: Order): Promise<MatterDraftSource> {
  const selected = await client.query(
    'SELECT * FROM matter_drafts WHERE workspace_id=$1 AND customer_confirmation_id=$2 FOR UPDATE',
    [order.workspaceId, order.commercialSourceSnapshot.customerConfirmation.confirmationId]
  );
  if (!selected.rowCount)
    throw new OrderMatterConversionError('SOURCE_NOT_FOUND', 'Matter Draft was not found.');
  return mapDraft(selected.rows[0] as Row);
}

async function selectMatter(
  client: QueryClient,
  workspaceId: string,
  formalMatterId: string
): Promise<FormalMatter> {
  const selected = await client.query(
    'SELECT * FROM formal_matters WHERE workspace_id=$1 AND formal_matter_id=$2 FOR UPDATE',
    [workspaceId, formalMatterId]
  );
  if (!selected.rowCount)
    throw new OrderMatterConversionError('FORMAL_MATTER_NOT_FOUND', 'Formal Matter was not found.');
  return mapFormalMatter(selected.rows[0] as Row);
}

async function replayOrder(
  client: QueryClient,
  workspaceId: string,
  key: string,
  fingerprint: string,
  lock: boolean
): Promise<Order | null> {
  const selected = await client.query(
    `SELECT request_fingerprint,result_snapshot FROM order_commands WHERE workspace_id=$1 AND idempotency_key=$2${lock ? ' FOR UPDATE' : ''}`,
    [workspaceId, key]
  );
  if (!selected.rowCount) return null;
  const row = selected.rows[0] as Row;
  if (String(row.request_fingerprint) !== fingerprint)
    throw new OrderMatterConversionError(
      'IDEMPOTENCY_CONFLICT',
      'Idempotency key has conflicting input.'
    );
  return clone(row.result_snapshot as Order);
}

async function insertFormalMatter(
  client: QueryClient,
  matter: FormalMatter,
  key: string,
  fingerprint: string,
  principal: WorkspacePrincipal,
  correlationId?: string
): Promise<void> {
  const keyed = await client.query(
    'SELECT request_fingerprint,formal_matter_id FROM formal_matter_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
    [matter.workspaceId, key]
  );
  if (keyed.rowCount) {
    const row = keyed.rows[0] as Row;
    if (
      String(row.request_fingerprint) !== fingerprint ||
      String(row.formal_matter_id) !== matter.formalMatterId
    )
      throw new OrderMatterConversionError(
        'IDEMPOTENCY_CONFLICT',
        'Formal Matter idempotency key has conflicting input.'
      );
    return;
  }
  const source = await client.query(
    'SELECT formal_matter_id FROM formal_matters WHERE workspace_id=$1 AND source_matter_draft_id=$2 AND source_matter_draft_version=$3 FOR UPDATE',
    [matter.workspaceId, matter.sourceMatterDraftId, matter.sourceMatterDraftVersion]
  );
  if (source.rowCount)
    throw new OrderMatterConversionError(
      'DUPLICATE_SOURCE',
      'The exact Matter Draft version already created a Formal Matter.'
    );
  await client.query(
    `INSERT INTO formal_matters (
      formal_matter_id,workspace_id,kind,status,version,
      source_customer_confirmation_id,source_customer_confirmation_version,
      source_matter_draft_id,source_matter_draft_version,source_quote_id,source_quote_version,
      source_snapshot,snapshot_schema_version,snapshot_sha256,created_by_user_id,created_at,updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17)`,
    [
      matter.formalMatterId,
      matter.workspaceId,
      matter.kind,
      matter.status,
      matter.version,
      matter.sourceCustomerConfirmationId,
      matter.sourceCustomerConfirmationVersion,
      matter.sourceMatterDraftId,
      matter.sourceMatterDraftVersion,
      matter.sourceQuoteId,
      matter.sourceQuoteVersion,
      JSON.stringify(matter.sourceSnapshot),
      matter.snapshotSchemaVersion,
      matter.snapshotSha256,
      matter.createdByUserId,
      matter.createdAt,
      matter.updatedAt
    ]
  );
  await client.query(
    'INSERT INTO formal_matter_commands(workspace_id,idempotency_key,request_fingerprint,formal_matter_id,created_at) VALUES($1,$2,$3,$4,$5)',
    [matter.workspaceId, key, fingerprint, matter.formalMatterId, matter.createdAt]
  );
  await client.query(
    'INSERT INTO formal_matter_audit(workspace_id,formal_matter_id,action,actor_id,correlation_id,created_at) VALUES($1,$2,$3,$4,$5,$6)',
    [
      matter.workspaceId,
      matter.formalMatterId,
      'FORMAL_MATTER_CREATED',
      principal.userId,
      correlationId ?? null,
      matter.createdAt
    ]
  );
}

async function linkOrder(
  client: QueryClient,
  current: Order,
  matter: FormalMatter,
  linkKind: OrderMatterLinkKind,
  key: string,
  fingerprint: string,
  principal: WorkspacePrincipal,
  at: string,
  correlationId?: string
): Promise<Order> {
  const reference: OrderMatterReference = {
    formalMatterId: matter.formalMatterId,
    formalMatterVersion: matter.version,
    linkKind,
    linkedAt: at,
    linkedByUserId: principal.userId as MarkOrbitId
  };
  const next: Order = {
    ...current,
    status: 'MatterCreated',
    version: current.version + 1,
    matter: reference,
    updatedByUserId: principal.userId as MarkOrbitId,
    updatedAt: at
  };
  const updated = await client.query(
    `UPDATE orders
       SET status='MatterCreated',version=$1,matter_reference=$2::jsonb,updated_by_user_id=$3,updated_at=$4
     WHERE workspace_id=$5 AND order_id=$6 AND version=$7`,
    [
      next.version,
      JSON.stringify(reference),
      next.updatedByUserId,
      at,
      next.workspaceId,
      next.orderId,
      current.version
    ]
  );
  if (updated.rowCount !== 1)
    throw new OrderMatterConversionError(
      'VERSION_CONFLICT',
      'Order version changed during Matter conversion.'
    );
  await client.query(
    'INSERT INTO order_commands(workspace_id,idempotency_key,request_fingerprint,order_id,command_type,result_version,result_snapshot,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',
    [
      next.workspaceId,
      key,
      fingerprint,
      next.orderId,
      'UPDATE',
      next.version,
      JSON.stringify(next),
      at
    ]
  );
  await client.query(
    'INSERT INTO order_audit(workspace_id,order_id,action,actor_id,from_status,to_status,version,correlation_id,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [
      next.workspaceId,
      next.orderId,
      'ORDER_MATTER_LINKED',
      principal.userId,
      current.status,
      'MatterCreated',
      next.version,
      correlationId ?? null,
      at
    ]
  );
  return next;
}

function isConcurrentConflict(cause: unknown): boolean {
  const code = (cause as { code?: string }).code;
  return code === '23505' || code === '40001';
}

function unavailable(cause: unknown): OrderMatterConversionError {
  return new OrderMatterConversionError(
    'PERSISTENCE_UNAVAILABLE',
    'Order-to-Matter conversion persistence is unavailable.',
    { cause: cause instanceof Error ? cause : undefined }
  );
}

export class PostgresOrderMatterConversionService {
  constructor(
    private readonly database: OrderTransactionHost,
    private readonly query: QueryClient,
    private readonly now = () => new Date().toISOString(),
    private readonly formalMatterId = () => `formal-matter_${randomUUID()}` as FormalMatterId
  ) {}

  async createMatterFromOrder(
    principal: WorkspacePrincipal,
    command: CreateMatterFromOrderCommand,
    correlationId?: string
  ): Promise<OrderMatterConversionResult> {
    authorize(principal, command.workspaceId, 'order:matter:create');
    authorize(principal, command.workspaceId, 'matter:create');
    const fingerprint = commandFingerprint('CREATE_MATTER_FROM_ORDER', command);
    try {
      const converted = await this.database.transact(
        async (client) => {
          const replay = await replayOrder(
            client,
            command.workspaceId,
            command.idempotencyKey,
            fingerprint,
            true
          );
          if (replay) return replay;
          const order = await selectOrder(client, command.workspaceId, command.orderId);
          validateReadyOrder(
            order,
            command.expectedOrderVersion,
            command.expectedCommercialSourceSha256
          );
          const confirmation = await selectConfirmation(client, order);
          const draft = await selectDraft(client, order);
          validateCommercialLineage(order, confirmation, draft);
          const at = this.now();
          const matter = buildFormalMatter(
            order,
            confirmation,
            draft,
            principal,
            at,
            this.formalMatterId()
          );
          await insertFormalMatter(
            client,
            matter,
            command.idempotencyKey,
            fingerprint,
            principal,
            correlationId
          );
          return linkOrder(
            client,
            order,
            matter,
            'CREATED_FROM_ORDER',
            command.idempotencyKey,
            fingerprint,
            principal,
            at,
            correlationId
          );
        },
        { isolation: 'SERIALIZABLE' }
      );
      return result(converted);
    } catch (cause) {
      if (cause instanceof OrderMatterConversionError) throw cause;
      if (isConcurrentConflict(cause))
        return this.resolveConcurrentResult(
          command.workspaceId,
          command.idempotencyKey,
          fingerprint
        );
      throw unavailable(cause);
    }
  }

  async linkExistingMatter(
    principal: WorkspacePrincipal,
    command: LinkExistingMatterToOrderCommand,
    correlationId?: string
  ): Promise<OrderMatterConversionResult> {
    authorize(principal, command.workspaceId, 'order:matter:create');
    authorize(principal, command.workspaceId, 'matter:read');
    const fingerprint = commandFingerprint('LINK_EXISTING_MATTER_TO_ORDER', command);
    try {
      const linked = await this.database.transact(
        async (client) => {
          const replay = await replayOrder(
            client,
            command.workspaceId,
            command.idempotencyKey,
            fingerprint,
            true
          );
          if (replay) return replay;
          const order = await selectOrder(client, command.workspaceId, command.orderId);
          validateReadyOrder(
            order,
            command.expectedOrderVersion,
            command.expectedCommercialSourceSha256
          );
          const matter = await selectMatter(client, command.workspaceId, command.formalMatterId);
          if (matter.version !== command.expectedFormalMatterVersion)
            throw new OrderMatterConversionError(
              'VERSION_CONFLICT',
              'Formal Matter version does not match expectedFormalMatterVersion.'
            );
          validateMatterLineage(order, matter);
          return linkOrder(
            client,
            order,
            matter,
            'COMPATIBILITY_LINK',
            command.idempotencyKey,
            fingerprint,
            principal,
            this.now(),
            correlationId
          );
        },
        { isolation: 'SERIALIZABLE' }
      );
      return result(linked);
    } catch (cause) {
      if (cause instanceof OrderMatterConversionError) throw cause;
      if (isConcurrentConflict(cause))
        return this.resolveConcurrentResult(
          command.workspaceId,
          command.idempotencyKey,
          fingerprint
        );
      throw unavailable(cause);
    }
  }

  private async resolveConcurrentResult(
    workspaceId: string,
    key: string,
    fingerprint: string
  ): Promise<OrderMatterConversionResult> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const replay = await replayOrder(this.query, workspaceId, key, fingerprint, false);
        if (replay) return result(replay);
      } catch (error) {
        if (error instanceof OrderMatterConversionError) throw error;
        throw unavailable(error);
      }
      if (attempt < 9)
        await new Promise<void>((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
    throw new OrderMatterConversionError(
      'PERSISTENCE_UNAVAILABLE',
      'The concurrent Order-to-Matter result is not yet available.'
    );
  }
}

export function sameOrderSource(left: Order, right: Order): boolean {
  return (
    left.commercialSourceSnapshotSha256 === right.commercialSourceSnapshotSha256 &&
    canonicalOrderPersistenceValue(left.commercialSourceSnapshot) ===
      canonicalOrderPersistenceValue(right.commercialSourceSnapshot)
  );
}
