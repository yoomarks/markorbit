import { createHash } from 'node:crypto';
import type { Permission, WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  parseCreateProductionQuoteCommandV1,
  parseProductionQuoteV1,
  type CreateProductionQuoteCommandV1,
  type ProductionIntakeV1,
  type ProductionQuoteV1,
  type ProductionRecommendationV1,
  type UserSelectionV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { QueryClient } from '@markorbit/persistence';
import type { PostgresProductionIntakeService } from './production-intake.js';
import type { PostgresProductionRecommendationService } from './production-recommendation.js';
import type { PostgresProductionUserSelectionService } from './production-user-selection.js';
import type {
  ProductionServicePricingSourceService,
  ProductionServicePricingSourceV1
} from './production-service-pricing-source.js';
import type {
  ProductionOfficialFeeSourceServiceV1,
  ProductionOfficialFeeSourceV1
} from './production-official-fee-source.js';

export interface ProductionQuoteTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}
export interface ProductionQuoteDependenciesV1 {
  readonly intakes: Pick<PostgresProductionIntakeService, 'get'>;
  readonly recommendations: Pick<PostgresProductionRecommendationService, 'get'>;
  readonly selections: Pick<PostgresProductionUserSelectionService, 'get'>;
  readonly servicePricing: Pick<ProductionServicePricingSourceService, 'read'>;
  readonly officialFees: Pick<ProductionOfficialFeeSourceServiceV1, 'resolve'>;
}

export class ProductionQuoteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductionQuoteError';
  }
}

type Row = Record<string, unknown>;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, member]) => member !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function productionQuoteSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function requirePermission(principal: WorkspacePrincipal, permission: Permission): void {
  if (!principal.permissions.includes(permission)) {
    throw new ProductionQuoteError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`,
      403
    );
  }
}

function exactCommand(
  value: Readonly<CreateProductionQuoteCommandV1>
): CreateProductionQuoteCommandV1 {
  try {
    return parseCreateProductionQuoteCommandV1(value);
  } catch (cause) {
    throw new ProductionQuoteError(
      'INVALID_PRODUCTION_QUOTE_REQUEST',
      'Production Quote command is invalid.',
      400,
      false,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
function requestMaterial(command: CreateProductionQuoteCommandV1) {
  return {
    schemaVersion: command.schemaVersion,
    intakeId: command.intakeId,
    expectedIntakeVersion: command.expectedIntakeVersion,
    recommendationId: command.recommendationId,
    expectedRecommendationVersion: command.expectedRecommendationVersion,
    selectionId: command.selectionId,
    expectedSelectionVersion: command.expectedSelectionVersion
  };
}

function quoteFingerprintMaterial(value: Omit<ProductionQuoteV1, 'fingerprintSha256'>) {
  const material = structuredClone(value) as Record<string, unknown>;
  Reflect.deleteProperty(material, 'status');
  return material;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function iso(value: unknown): string {
  return new Date(value as string | number | Date).toISOString();
}

function safeAmount(amountMinor: number, field: string): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new ProductionQuoteError(
      'INVALID_QUOTE_MONEY',
      `${field} must be a non-negative safe integer.`,
      422
    );
  }
  return amountMinor;
}
function lineSourceVersion(
  source: ProductionServicePricingSourceV1['source'] | ProductionOfficialFeeSourceV1['source']
): string {
  return `${source.sourceVersion}#${source.fingerprintSha256}`;
}

function validUntil(createdAt: string, serviceSource: ProductionServicePricingSourceV1): string {
  const horizon = Date.parse(createdAt) + 14 * 86_400_000;
  const commercialEnd = serviceSource.material.price.validUntil
    ? Date.parse(serviceSource.material.price.validUntil)
    : Number.POSITIVE_INFINITY;
  const selected = Math.min(horizon, commercialEnd);
  if (!Number.isFinite(selected) || selected <= Date.parse(createdAt)) {
    throw new ProductionQuoteError(
      'SERVICE_PRICE_NOT_CURRENT',
      'Production Quote requires a service price that remains valid after creation.',
      409
    );
  }
  return new Date(selected).toISOString();
}

interface ResolvedQuoteLineageV1 {
  readonly intake: ProductionIntakeV1;
  readonly recommendation: ProductionRecommendationV1;
  readonly selection: UserSelectionV1;
  readonly servicePricing: ProductionServicePricingSourceV1;
  readonly officialFee: ProductionOfficialFeeSourceV1;
}

function dependencyFailure(cause: unknown): never {
  if (cause instanceof ProductionQuoteError) throw cause;
  const value = cause as { code?: unknown; status?: unknown; retryable?: unknown };
  if (typeof value.code === 'string' && typeof value.status === 'number') {
    throw new ProductionQuoteError(
      value.code,
      cause instanceof Error ? cause.message : 'Production Quote dependency rejected the request.',
      value.status,
      value.retryable === true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
  throw new ProductionQuoteError(
    'QUOTE_DEPENDENCY_UNAVAILABLE',
    'Production Quote dependencies are unavailable.',
    503,
    true,
    { cause: cause instanceof Error ? cause : undefined }
  );
}

function assertLineage(
  command: CreateProductionQuoteCommandV1,
  lineage: ResolvedQuoteLineageV1
): void {
  const { intake, recommendation, selection, servicePricing, officialFee } = lineage;
  if (intake.version !== command.expectedIntakeVersion || intake.intakeId !== command.intakeId) {
    throw new ProductionQuoteError(
      'INTAKE_VERSION_CONFLICT',
      'Quote requires the exact current Intake.',
      409
    );
  }
  if (
    recommendation.recommendationId !== command.recommendationId ||
    recommendation.version !== command.expectedRecommendationVersion ||
    recommendation.currentness !== 'CURRENT' ||
    recommendation.source.currentness !== 'CURRENT'
  ) {
    throw new ProductionQuoteError(
      'RECOMMENDATION_NOT_CURRENT',
      'Quote requires the exact current Recommendation.',
      409
    );
  }
  if (
    recommendation.intake.id !== intake.intakeId ||
    recommendation.intake.version !== intake.version ||
    recommendation.intake.fingerprintSha256 !== intake.fingerprintSha256
  ) {
    throw new ProductionQuoteError(
      'QUOTE_LINEAGE_CONFLICT',
      'Recommendation does not bind the exact Intake.',
      409
    );
  }
  if (
    selection.selectionId !== command.selectionId ||
    selection.version !== command.expectedSelectionVersion ||
    selection.status !== 'CURRENT'
  ) {
    throw new ProductionQuoteError(
      'SELECTION_NOT_CURRENT',
      'Quote requires the exact current User Selection.',
      409
    );
  }
  if (
    selection.recommendation.id !== recommendation.recommendationId ||
    selection.recommendation.version !== recommendation.version ||
    selection.recommendation.fingerprintSha256 !== recommendation.fingerprintSha256
  ) {
    throw new ProductionQuoteError(
      'QUOTE_LINEAGE_CONFLICT',
      'Selection does not bind the exact Recommendation.',
      409
    );
  }
  for (const source of [servicePricing, officialFee]) {
    if (
      source.workspaceId.toLowerCase() !== intake.workspaceId.toLowerCase() ||
      source.intake.id !== intake.intakeId ||
      source.intake.version !== intake.version ||
      source.intake.fingerprintSha256 !== intake.fingerprintSha256 ||
      source.source.admissionClass !== 'PRODUCTION_ADMISSIBLE' ||
      source.source.currentness !== 'CURRENT'
    ) {
      throw new ProductionQuoteError(
        'PRICING_SOURCE_LINEAGE_CONFLICT',
        'Pricing source does not bind the exact current Intake.',
        409
      );
    }
  }
  if (
    servicePricing.material.price.amount.currency !== officialFee.material.totalOfficialFee.currency
  ) {
    throw new ProductionQuoteError(
      'QUOTE_CURRENCY_CONFLICT',
      'Official and service fee sources must use one currency.',
      409
    );
  }
}
export class PostgresProductionQuoteServiceV1 {
  constructor(
    private readonly database: ProductionQuoteTransactionHost,
    private readonly query: QueryClient,
    private readonly dependencies: ProductionQuoteDependenciesV1,
    private readonly now = () => new Date().toISOString()
  ) {}

  async create(
    principal: WorkspacePrincipal,
    rawCommand: Readonly<CreateProductionQuoteCommandV1>,
    correlationId?: string
  ): Promise<ProductionQuoteV1> {
    requirePermission(principal, 'order:create');
    const command = exactCommand(rawCommand);
    const requestFingerprint = productionQuoteSha256(requestMaterial(command));
    const replayBeforeTransaction = await this.safeReplay(
      this.query,
      principal.workspaceId,
      command.idempotencyKey,
      requestFingerprint
    );
    if (replayBeforeTransaction) return replayBeforeTransaction;

    const lineage = await this.resolveLineage(principal, command);
    assertLineage(command, lineage);

    try {
      return await this.database.transact(
        async (client) => {
          const replay = await this.replay(
            client,
            principal.workspaceId,
            command.idempotencyKey,
            requestFingerprint
          );
          if (replay) return replay;
          await this.assertLockedLineage(client, principal.workspaceId, command, lineage);
          const current = await this.currentReadyQuotes(
            client,
            principal.workspaceId,
            lineage.selection.selectionId,
            lineage.selection.version
          );
          if (current.length > 1) {
            throw new ProductionQuoteError(
              'QUOTE_STATE_INTEGRITY_FAILURE',
              'More than one current READY/DRAFT Quote exists for the exact Selection.',
              500
            );
          }

          const createdAt = this.exactNow();
          const quoteId = `quote_${productionQuoteSha256({
            workspaceId: principal.workspaceId,
            command: requestMaterial(command),
            serviceSource: lineage.servicePricing.source.fingerprintSha256,
            officialSource: lineage.officialFee.source.fingerprintSha256,
            idempotencyKey: command.idempotencyKey
          }).slice(0, 32)}` as ProductionQuoteV1['quoteId'];
          const supersedesQuoteId = current[0]?.quoteId;
          const quote = this.materializeQuote(
            principal.workspaceId,
            quoteId,
            lineage,
            createdAt,
            supersedesQuoteId
          );
          const effectiveCorrelationId = correlationId ?? command.correlationId;
          await this.insertQuote(
            client,
            principal,
            quote,
            lineage,
            requestFingerprint,
            command.idempotencyKey,
            effectiveCorrelationId,
            current[0]
          );
          return clone(quote);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof ProductionQuoteError) throw cause;
      const persistenceCode = String((cause as { code?: string }).code ?? '');
      if (persistenceCode === '23505' || persistenceCode === '40001') {
        const replay = await this.safeReplay(
          this.query,
          principal.workspaceId,
          command.idempotencyKey,
          requestFingerprint
        );
        if (replay) return replay;
      }
      throw this.persistence(cause);
    }
  }

  async get(principal: WorkspacePrincipal, quoteId: string): Promise<ProductionQuoteV1> {
    requirePermission(principal, 'workspace:read');
    try {
      const result = await this.query.query(
        `SELECT q.*,latest.state AS effective_state
         FROM markreg_early_funnel_quotes q
         JOIN LATERAL (
           SELECT e.state,e.state_event_id
           FROM markreg_early_funnel_quote_state_events e
           WHERE e.workspace_id=q.workspace_id
             AND e.quote_id=q.quote_id
             AND e.quote_version=q.version
           ORDER BY e.state_event_id DESC LIMIT 1
         ) latest ON TRUE
         WHERE q.workspace_id=$1 AND q.quote_id=$2
         ORDER BY q.version DESC LIMIT 1`,
        [principal.workspaceId, quoteId]
      );
      if (!result.rowCount) {
        throw new ProductionQuoteError(
          'PRODUCTION_QUOTE_NOT_FOUND',
          'Production Quote was not found in this Workspace.',
          404
        );
      }
      return this.viewQuote(result.rows[0] as Row);
    } catch (cause) {
      if (cause instanceof ProductionQuoteError) throw cause;
      throw this.persistence(cause);
    }
  }
  private async resolveLineage(
    principal: WorkspacePrincipal,
    command: CreateProductionQuoteCommandV1
  ): Promise<ResolvedQuoteLineageV1> {
    try {
      const [intake, recommendation, selection] = await Promise.all([
        this.dependencies.intakes.get(principal, command.intakeId),
        this.dependencies.recommendations.get(principal, command.recommendationId),
        this.dependencies.selections.get(principal, command.selectionId)
      ]);
      if (
        intake.version !== command.expectedIntakeVersion ||
        recommendation.version !== command.expectedRecommendationVersion ||
        selection.version !== command.expectedSelectionVersion
      ) {
        throw new ProductionQuoteError(
          'QUOTE_LINEAGE_VERSION_CONFLICT',
          'Production Quote requires exact current upstream artifact versions.',
          409
        );
      }
      const servicePricing = await this.dependencies.servicePricing.read(principal, {
        schemaVersion: 1,
        intakeId: intake.intakeId,
        expectedIntakeVersion: intake.version,
        expectedIntakeFingerprintSha256: intake.fingerprintSha256
      });
      const officialFee = await this.dependencies.officialFees.resolve(principal, {
        schemaVersion: 1,
        intakeId: intake.intakeId,
        expectedIntakeVersion: intake.version,
        idempotencyKey: `quote-official-${productionQuoteSha256({
          workspaceId: principal.workspaceId,
          quoteIdempotencyKey: command.idempotencyKey
        }).slice(0, 40)}`,
        correlationId: command.correlationId
      });
      return { intake, recommendation, selection, servicePricing, officialFee };
    } catch (cause) {
      return dependencyFailure(cause);
    }
  }
  private materializeQuote(
    workspaceId: string,
    quoteId: ProductionQuoteV1['quoteId'],
    lineage: ResolvedQuoteLineageV1,
    createdAt: string,
    supersedesQuoteId?: ProductionQuoteV1['quoteId']
  ): ProductionQuoteV1 {
    const official = safeAmount(
      lineage.officialFee.material.totalOfficialFee.amountMinor,
      'official fee'
    );
    const service = safeAmount(
      lineage.servicePricing.material.price.amount.amountMinor,
      'service fee'
    );
    const subtotal = official + service;
    if (!Number.isSafeInteger(subtotal)) {
      throw new ProductionQuoteError(
        'QUOTE_AMOUNT_OVERFLOW',
        'Quote total exceeds safe minor-unit range.',
        422
      );
    }
    const currency = lineage.servicePricing.material.price.amount.currency;
    const money = (amountMinor: number) => ({ amountMinor, currency });
    const base: Omit<ProductionQuoteV1, 'fingerprintSha256'> = {
      schemaVersion: 1,
      quoteId,
      workspaceId,
      version: 1,
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      status: 'READY',
      intake: {
        id: lineage.intake.intakeId,
        version: lineage.intake.version,
        fingerprintSha256: lineage.intake.fingerprintSha256
      },
      recommendation: {
        id: lineage.recommendation.recommendationId,
        version: lineage.recommendation.version,
        fingerprintSha256: lineage.recommendation.fingerprintSha256,
        admissionClass: 'PRODUCTION_ADMISSIBLE',
        currentness: 'CURRENT'
      },
      selection: {
        id: lineage.selection.selectionId,
        version: lineage.selection.version,
        fingerprintSha256: lineage.selection.fingerprintSha256,
        currentness: 'CURRENT'
      },
      pricingSource: clone(lineage.servicePricing.source),
      currency,
      lines: [
        {
          code: 'USPTO_BASE_APPLICATION_FEE',
          description: 'USPTO electronic trademark base application fee',
          category: 'OFFICIAL_FEE',
          amount: money(official),
          sourceReference: {
            sourceId: lineage.officialFee.source.sourceId,
            sourceVersion: lineSourceVersion(lineage.officialFee.source)
          }
        },
        {
          code: 'MARKREG_TRADEMARK_FILING_SERVICE',
          description: 'MarkReg trademark filing service fee',
          category: 'SERVICE_FEE',
          amount: money(service),
          sourceReference: {
            sourceId: lineage.servicePricing.source.sourceId,
            sourceVersion: lineSourceVersion(lineage.servicePricing.source)
          }
        }
      ],
      subtotal: money(subtotal),
      estimatedOfficialFees: money(official),
      estimatedServiceFees: money(service),
      estimatedDisbursements: money(0),
      estimatedTaxes: money(0),
      total: money(subtotal),
      assumptions: [
        {
          code: 'FEE_FACTS_CURRENT',
          text: `Official fee uses ${lineage.officialFee.material.classCount} current Nice class(es) and filing basis ${lineage.officialFee.material.filingBasis}.`
        },
        {
          code: 'OFFICIAL_FEE_SOURCE_CURRENT',
          text: `Official-fee source was CURRENT at ${lineage.officialFee.source.currentnessCheckedAt}.`
        },
        {
          code: 'SERVICE_PRICE_SOURCE_CURRENT',
          text: `Service-pricing source was CURRENT at ${lineage.servicePricing.source.currentnessCheckedAt}.`
        }
      ],
      limitations: [
        ...new Set([
          ...lineage.officialFee.source.limitations,
          ...lineage.servicePricing.source.limitations,
          'This Quote is a commercial estimate and does not create an Order, Payment, Invoice, filing authorization, filing action, professional approval, legal conclusion or Official Truth.'
        ])
      ],
      validUntil: validUntil(createdAt, lineage.servicePricing),
      ...(supersedesQuoteId ? { supersedesQuoteId } : {}),
      createdAt,
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    };
    return parseProductionQuoteV1({
      ...base,
      fingerprintSha256: productionQuoteSha256(quoteFingerprintMaterial(base))
    });
  }

  private exactNow(): string {
    const value = this.now();
    if (Number.isNaN(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
      throw new ProductionQuoteError(
        'CURRENTNESS_CLOCK_UNAVAILABLE',
        'Quote clock must be an exact ISO instant.',
        503,
        true
      );
    }
    return value;
  }
  private async assertLockedLineage(
    client: QueryClient,
    workspaceId: string,
    command: CreateProductionQuoteCommandV1,
    lineage: ResolvedQuoteLineageV1
  ): Promise<void> {
    const intakeResult = await client.query(
      `SELECT version,status,fingerprint_sha256 FROM markreg_early_funnel_intakes
       WHERE workspace_id=$1 AND intake_id=$2
       ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [workspaceId, command.intakeId]
    );
    if (!intakeResult.rowCount) {
      throw new ProductionQuoteError(
        'PRODUCTION_INTAKE_NOT_FOUND',
        'Production Intake was not found.',
        404
      );
    }
    const intake = intakeResult.rows[0] as Row;
    if (
      Number(intake.version) !== lineage.intake.version ||
      String(intake.fingerprint_sha256) !== lineage.intake.fingerprintSha256
    ) {
      throw new ProductionQuoteError(
        'INTAKE_VERSION_CONFLICT',
        'Intake changed during Quote creation.',
        409
      );
    }

    const recommendationResult = await client.query(
      `SELECT version,fingerprint_sha256,currentness,admission_class,
              intake_id,intake_version,intake_fingerprint_sha256
       FROM markreg_early_funnel_recommendations
       WHERE workspace_id=$1 AND recommendation_id=$2
       ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [workspaceId, command.recommendationId]
    );
    if (!recommendationResult.rowCount) {
      throw new ProductionQuoteError(
        'PRODUCTION_RECOMMENDATION_NOT_FOUND',
        'Production Recommendation was not found.',
        404
      );
    }
    const recommendation = recommendationResult.rows[0] as Row;
    if (
      Number(recommendation.version) !== lineage.recommendation.version ||
      String(recommendation.fingerprint_sha256) !== lineage.recommendation.fingerprintSha256 ||
      String(recommendation.currentness) !== 'CURRENT' ||
      String(recommendation.admission_class) !== 'PRODUCTION_ADMISSIBLE' ||
      String(recommendation.intake_id) !== lineage.intake.intakeId ||
      Number(recommendation.intake_version) !== lineage.intake.version ||
      String(recommendation.intake_fingerprint_sha256) !== lineage.intake.fingerprintSha256
    ) {
      throw new ProductionQuoteError(
        'RECOMMENDATION_NOT_CURRENT',
        'Recommendation changed during Quote creation.',
        409
      );
    }

    const selectionResult = await client.query(
      `SELECT s.version,s.fingerprint_sha256,s.recommendation_id,s.recommendation_version,
              latest.state AS effective_state
       FROM markreg_early_funnel_selections s
       JOIN LATERAL (
         SELECT e.state,e.state_event_id FROM markreg_early_funnel_selection_state_events e
         WHERE e.workspace_id=s.workspace_id AND e.selection_id=s.selection_id
           AND e.selection_version=s.version
         ORDER BY e.state_event_id DESC LIMIT 1
       ) latest ON TRUE
       WHERE s.workspace_id=$1 AND s.selection_id=$2
       ORDER BY s.version DESC LIMIT 1`,
      [workspaceId, command.selectionId]
    );
    if (!selectionResult.rowCount) {
      throw new ProductionQuoteError(
        'PRODUCTION_USER_SELECTION_NOT_FOUND',
        'Production User Selection was not found.',
        404
      );
    }
    const selection = selectionResult.rows[0] as Row;
    if (
      Number(selection.version) !== lineage.selection.version ||
      String(selection.fingerprint_sha256) !== lineage.selection.fingerprintSha256 ||
      String(selection.recommendation_id) !== lineage.recommendation.recommendationId ||
      Number(selection.recommendation_version) !== lineage.recommendation.version ||
      String(selection.effective_state) !== 'CURRENT'
    ) {
      throw new ProductionQuoteError(
        'SELECTION_NOT_CURRENT',
        'Selection changed during Quote creation.',
        409
      );
    }

    const feeFactsResult = await client.query(
      `SELECT f.fee_facts_id,f.version,f.fingerprint_sha256,latest.state
       FROM markreg_production_fee_facts f
       JOIN LATERAL (
         SELECT e.state,e.state_event_id FROM markreg_production_fee_fact_state_events e
         WHERE e.workspace_id=f.workspace_id AND e.fee_facts_id=f.fee_facts_id
           AND e.fee_facts_version=f.version
         ORDER BY e.state_event_id DESC LIMIT 1
       ) latest ON TRUE
       WHERE f.workspace_id=$1 AND f.intake_id=$2 AND f.intake_version=$3
         AND latest.state='CURRENT'
       ORDER BY f.version DESC LIMIT 2`,
      [workspaceId, lineage.intake.intakeId, lineage.intake.version]
    );
    if (feeFactsResult.rowCount !== 1) {
      throw new ProductionQuoteError(
        'PRODUCTION_FEE_FACTS_INTEGRITY_FAILURE',
        'Exactly one current fee-facts artifact is required during Quote creation.',
        409
      );
    }
    const facts = feeFactsResult.rows[0] as Row;
    if (
      String(facts.fee_facts_id) !== lineage.officialFee.feeFacts.id ||
      Number(facts.version) !== lineage.officialFee.feeFacts.version ||
      String(facts.fingerprint_sha256) !== lineage.officialFee.feeFacts.fingerprintSha256
    ) {
      throw new ProductionQuoteError(
        'PRODUCTION_FEE_FACTS_STALE',
        'Fee facts changed after official-fee resolution.',
        409
      );
    }
  }

  private async currentReadyQuotes(
    client: QueryClient,
    workspaceId: string,
    selectionId: string,
    selectionVersion: number
  ): Promise<ProductionQuoteV1[]> {
    const result = await client.query(
      `SELECT q.*,latest.state AS effective_state,latest.state_event_id
       FROM markreg_early_funnel_quotes q
       JOIN LATERAL (
         SELECT e.state,e.state_event_id FROM markreg_early_funnel_quote_state_events e
         WHERE e.workspace_id=q.workspace_id AND e.quote_id=q.quote_id
           AND e.quote_version=q.version
         ORDER BY e.state_event_id DESC LIMIT 1
       ) latest ON TRUE
       WHERE q.workspace_id=$1 AND q.selection_id=$2 AND q.selection_version=$3
         AND latest.state IN ('DRAFT','READY')
       ORDER BY latest.state_event_id DESC`,
      [workspaceId, selectionId, selectionVersion]
    );
    return result.rows.map((row) => this.viewQuote(row as Row));
  }
  private async insertQuote(
    client: QueryClient,
    principal: WorkspacePrincipal,
    quote: ProductionQuoteV1,
    lineage: ResolvedQuoteLineageV1,
    requestFingerprint: string,
    idempotencyKey: string,
    correlationId: string,
    superseded?: ProductionQuoteV1
  ): Promise<void> {
    const provenance = {
      servicePricing: lineage.servicePricing.source,
      officialFee: lineage.officialFee.source,
      feeFacts: lineage.officialFee.feeFacts
    };
    await client.query(
      `INSERT INTO markreg_early_funnel_quotes (
        workspace_id,quote_id,version,admission_class,initial_status,
        intake_id,intake_version,intake_fingerprint_sha256,
        recommendation_id,recommendation_version,recommendation_fingerprint_sha256,
        recommendation_admission_class,recommendation_currentness,
        selection_id,selection_version,selection_fingerprint_sha256,selection_currentness,
        pricing_source_id,pricing_source_version,pricing_source_fingerprint_sha256,
        pricing_source_admission_class,pricing_source_currentness,
        pricing_source_currentness_checked_at,pricing_source_provenance,currency,valid_until,
        supersedes_quote_id,fingerprint_sha256,quote_record,created_by,created_at
      ) VALUES (
        $1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23::jsonb,$24,$25,$26,$27,$28::jsonb,$29,$30
      )`,
      [
        principal.workspaceId,
        quote.quoteId,
        quote.admissionClass,
        quote.status,
        quote.intake.id,
        quote.intake.version,
        quote.intake.fingerprintSha256,
        quote.recommendation.id,
        quote.recommendation.version,
        quote.recommendation.fingerprintSha256,
        quote.recommendation.admissionClass,
        quote.recommendation.currentness,
        quote.selection.id,
        quote.selection.version,
        quote.selection.fingerprintSha256,
        quote.selection.currentness,
        quote.pricingSource.sourceId,
        quote.pricingSource.sourceVersion,
        quote.pricingSource.fingerprintSha256,
        quote.pricingSource.admissionClass,
        quote.pricingSource.currentness,
        quote.pricingSource.currentnessCheckedAt,
        JSON.stringify(provenance),
        quote.currency,
        quote.validUntil,
        quote.supersedesQuoteId ?? null,
        quote.fingerprintSha256,
        JSON.stringify(quote),
        principal.userId,
        quote.createdAt
      ]
    );

    if (superseded) {
      await client.query(
        `INSERT INTO markreg_early_funnel_quote_state_events (
          workspace_id,quote_id,quote_version,state,superseding_quote_id,
          actor_id,correlation_id,occurred_at
        ) VALUES ($1,$2,$3,'SUPERSEDED',$4,$5,$6,$7)`,
        [
          principal.workspaceId,
          superseded.quoteId,
          superseded.version,
          quote.quoteId,
          principal.userId,
          correlationId,
          quote.createdAt
        ]
      );
      await client.query(
        `INSERT INTO markreg_early_funnel_audit (
          workspace_id,entity_type,entity_id,entity_version,action,source_lineage,
          request_fingerprint_sha256,actor_id,correlation_id,occurred_at
        ) VALUES ($1,'QUOTE',$2,$3,'PRODUCTION_QUOTE_SUPERSEDED',$4::jsonb,$5,$6,$7,$8)`,
        [
          principal.workspaceId,
          superseded.quoteId,
          superseded.version,
          JSON.stringify({ supersedingQuote: { id: quote.quoteId, version: quote.version } }),
          requestFingerprint,
          principal.userId,
          correlationId,
          quote.createdAt
        ]
      );
    }

    await client.query(
      `INSERT INTO markreg_early_funnel_quote_state_events (
        workspace_id,quote_id,quote_version,state,superseding_quote_id,
        actor_id,correlation_id,occurred_at
      ) VALUES ($1,$2,1,'READY',NULL,$3,$4,$5)`,
      [principal.workspaceId, quote.quoteId, principal.userId, correlationId, quote.createdAt]
    );
    await client.query(
      `INSERT INTO markreg_early_funnel_commands (
        workspace_id,command_type,idempotency_key,request_fingerprint_sha256,
        response_entity_type,response_entity_id,response_entity_version,response_data,created_at
      ) VALUES ($1,'CREATE_QUOTE',$2,$3,'QUOTE',$4,1,$5::jsonb,$6)`,
      [
        principal.workspaceId,
        idempotencyKey,
        requestFingerprint,
        quote.quoteId,
        JSON.stringify(quote),
        quote.createdAt
      ]
    );
    await client.query(
      `INSERT INTO markreg_early_funnel_audit (
        workspace_id,entity_type,entity_id,entity_version,action,source_lineage,
        request_fingerprint_sha256,actor_id,correlation_id,occurred_at
      ) VALUES ($1,'QUOTE',$2,1,'PRODUCTION_QUOTE_CREATED',$3::jsonb,$4,$5,$6,$7)`,
      [
        principal.workspaceId,
        quote.quoteId,
        JSON.stringify({
          intake: quote.intake,
          recommendation: quote.recommendation,
          selection: quote.selection,
          servicePricing: lineage.servicePricing.source,
          officialFee: lineage.officialFee.source,
          feeFacts: lineage.officialFee.feeFacts
        }),
        requestFingerprint,
        principal.userId,
        correlationId,
        quote.createdAt
      ]
    );
  }

  private viewQuote(row: Row): ProductionQuoteV1 {
    let quote: ProductionQuoteV1;
    try {
      quote = parseProductionQuoteV1(row.quote_record);
    } catch (cause) {
      throw new ProductionQuoteError(
        'PERSISTED_QUOTE_INTEGRITY_FAILURE',
        'Stored Production Quote does not satisfy the V1 contract.',
        500,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const effectiveState =
      typeof row.effective_state === 'string' ? row.effective_state : quote.status;
    if (!['DRAFT', 'READY', 'CONFIRMED', 'EXPIRED', 'SUPERSEDED'].includes(effectiveState)) {
      throw new ProductionQuoteError(
        'PERSISTED_QUOTE_INTEGRITY_FAILURE',
        'Stored Quote effective state is invalid.',
        500
      );
    }
    const { fingerprintSha256, ...withoutFingerprint } = quote;
    const storedSupersedesQuoteId =
      typeof row.supersedes_quote_id === 'string' ? row.supersedes_quote_id : null;
    const valid =
      quote.workspaceId.toLowerCase() === String(row.workspace_id).toLowerCase() &&
      quote.quoteId === String(row.quote_id) &&
      quote.version === Number(row.version) &&
      quote.admissionClass === String(row.admission_class) &&
      quote.status === String(row.initial_status) &&
      quote.intake.id === String(row.intake_id) &&
      quote.intake.version === Number(row.intake_version) &&
      quote.intake.fingerprintSha256 === String(row.intake_fingerprint_sha256) &&
      quote.recommendation.id === String(row.recommendation_id) &&
      quote.recommendation.version === Number(row.recommendation_version) &&
      quote.recommendation.fingerprintSha256 === String(row.recommendation_fingerprint_sha256) &&
      quote.selection.id === String(row.selection_id) &&
      quote.selection.version === Number(row.selection_version) &&
      quote.selection.fingerprintSha256 === String(row.selection_fingerprint_sha256) &&
      quote.pricingSource.sourceId === String(row.pricing_source_id) &&
      quote.pricingSource.sourceVersion === String(row.pricing_source_version) &&
      quote.pricingSource.fingerprintSha256 === String(row.pricing_source_fingerprint_sha256) &&
      quote.currency === String(row.currency) &&
      quote.validUntil === iso(row.valid_until) &&
      (quote.supersedesQuoteId ?? null) === storedSupersedesQuoteId &&
      quote.createdAt === iso(row.created_at) &&
      fingerprintSha256 === String(row.fingerprint_sha256) &&
      fingerprintSha256 === productionQuoteSha256(quoteFingerprintMaterial(withoutFingerprint));
    const provenance = row.pricing_source_provenance;
    const provenanceRecord =
      provenance && typeof provenance === 'object' && !Array.isArray(provenance)
        ? (provenance as Record<string, unknown>)
        : {};
    const serviceSource =
      provenanceRecord.servicePricing &&
      typeof provenanceRecord.servicePricing === 'object' &&
      !Array.isArray(provenanceRecord.servicePricing)
        ? (provenanceRecord.servicePricing as Record<string, unknown>)
        : {};
    const officialSource =
      provenanceRecord.officialFee &&
      typeof provenanceRecord.officialFee === 'object' &&
      !Array.isArray(provenanceRecord.officialFee)
        ? (provenanceRecord.officialFee as Record<string, unknown>)
        : {};
    const officialLine = quote.lines.find((line) => line.code === 'USPTO_BASE_APPLICATION_FEE');
    const provenanceValid =
      serviceSource.fingerprintSha256 === quote.pricingSource.fingerprintSha256 &&
      typeof officialSource.fingerprintSha256 === 'string' &&
      officialLine?.sourceReference.sourceVersion.endsWith(
        `#${officialSource.fingerprintSha256}`
      ) === true;
    if (!valid || !provenanceValid) {
      throw new ProductionQuoteError(
        'PERSISTED_QUOTE_INTEGRITY_FAILURE',
        'Stored Quote lineage, source provenance or fingerprint is inconsistent.',
        500
      );
    }
    return clone(
      parseProductionQuoteV1({
        ...quote,
        status: effectiveState
      })
    );
  }
  private async safeReplay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProductionQuoteV1 | null> {
    try {
      return await this.replay(client, workspaceId, idempotencyKey, requestFingerprint);
    } catch (cause) {
      if (cause instanceof ProductionQuoteError) throw cause;
      throw this.persistence(cause);
    }
  }

  private async replay(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProductionQuoteV1 | null> {
    const result = await client.query(
      `SELECT request_fingerprint_sha256,response_data
       FROM markreg_early_funnel_commands
       WHERE workspace_id=$1 AND command_type='CREATE_QUOTE' AND idempotency_key=$2`,
      [workspaceId, idempotencyKey]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0] as Row;
    if (String(row.request_fingerprint_sha256) !== requestFingerprint) {
      throw new ProductionQuoteError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used with a materially different Quote request.',
        409
      );
    }
    let quote: ProductionQuoteV1;
    try {
      quote = parseProductionQuoteV1(row.response_data);
    } catch (cause) {
      throw new ProductionQuoteError(
        'PERSISTED_QUOTE_INTEGRITY_FAILURE',
        'Stored Quote replay receipt does not satisfy the V1 contract.',
        500,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const { fingerprintSha256, ...withoutFingerprint } = quote;
    if (
      quote.workspaceId.toLowerCase() !== workspaceId.toLowerCase() ||
      fingerprintSha256 !== productionQuoteSha256(quoteFingerprintMaterial(withoutFingerprint))
    ) {
      throw new ProductionQuoteError(
        'PERSISTED_QUOTE_INTEGRITY_FAILURE',
        'Stored Quote replay receipt is inconsistent.',
        500
      );
    }
    return clone(quote);
  }

  private persistence(cause: unknown): ProductionQuoteError {
    return new ProductionQuoteError(
      'PERSISTENCE_UNAVAILABLE',
      'Production Quote persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
