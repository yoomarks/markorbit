import { createHash } from 'node:crypto';
import {
  isMarkOrbitId,
  type MarkOrbitId,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  assertCommercialPrice,
  assertCommercialProduct,
  isCommercialPriceActive,
  type CommercialCatalogItem,
  type CommercialPrice,
  type CommercialProduct
} from '@markorbit/contracts/commercial';
import {
  noEarlyFunnelAuthorityConsequences,
  type EarlyFunnelArtifactReferenceV1,
  type EarlyFunnelSourceReferenceV1,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  CommercialCheckoutError,
  type CommercialCatalogRepository
} from './commercial-checkout.js';
import {
  ProductionIntakeError,
  type PostgresProductionIntakeService
} from './production-intake.js';

export const MARKREG_SERVICE_PRICING_SOURCE_POLICY =
  'markreg.service-pricing-source.trademark-filing.v1' as const;
export const MARKREG_SERVICE_PRICING_SOURCE_ID =
  'markreg.service-pricing.trademark-filing' as const;
export const MARKREG_TRADEMARK_FILING_PRODUCT_CODE = 'TRADEMARK_FILING' as const;

export interface ReadProductionServicePricingSourceV1 {
  readonly schemaVersion: 1;
  readonly intakeId: MarkOrbitId;
  readonly expectedIntakeVersion: number;
  readonly expectedIntakeFingerprintSha256: string;
}

export interface ProductionServicePricingSourceV1 {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly intake: Readonly<EarlyFunnelArtifactReferenceV1>;
  readonly source: Readonly<
    EarlyFunnelSourceReferenceV1 & {
      sourceKind: 'PRICING_SOURCE';
      admissionClass: 'PRODUCTION_ADMISSIBLE';
      currentness: 'CURRENT';
    }
  >;
  readonly material: Readonly<{
    policyId: typeof MARKREG_SERVICE_PRICING_SOURCE_POLICY;
    product: Readonly<{
      productId: CommercialProduct['productId'];
      version: number;
      code: typeof MARKREG_TRADEMARK_FILING_PRODUCT_CODE;
      serviceType: 'TrademarkFiling';
    }>;
    price: Readonly<{
      priceId: CommercialPrice['priceId'];
      priceVersion: number;
      channel: CommercialPrice['channel'];
      relationshipModel: CommercialPrice['relationshipModel'];
      amount: Readonly<CommercialPrice['amount']>;
      status: 'ACTIVE';
      validFrom: string;
      validUntil?: string;
    }>;
  }>;
  readonly authorityConsequences: typeof noEarlyFunnelAuthorityConsequences;
}

export class ProductionServicePricingSourceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductionServicePricingSourceError';
  }
}

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

export function productionServicePricingSourceSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function requirePermission(principal: WorkspacePrincipal, permission: Permission): void {
  if (!principal.permissions.includes(permission)) {
    throw new ProductionServicePricingSourceError(
      'PERMISSION_DENIED',
      `${permission} permission is required.`,
      403
    );
  }
}

function exactRequest(
  value: Readonly<ReadProductionServicePricingSourceV1>
): Readonly<ReadProductionServicePricingSourceV1> {
  if (value.schemaVersion !== 1 || !isMarkOrbitId(value.intakeId)) {
    throw new ProductionServicePricingSourceError(
      'INVALID_SERVICE_PRICING_SOURCE_REQUEST',
      'Service-pricing source request identity is invalid.',
      400
    );
  }
  if (!Number.isSafeInteger(value.expectedIntakeVersion) || value.expectedIntakeVersion < 1) {
    throw new ProductionServicePricingSourceError(
      'INVALID_SERVICE_PRICING_SOURCE_REQUEST',
      'expectedIntakeVersion must be a positive safe integer.',
      400
    );
  }
  if (!/^[0-9a-f]{64}$/u.test(value.expectedIntakeFingerprintSha256)) {
    throw new ProductionServicePricingSourceError(
      'INVALID_SERVICE_PRICING_SOURCE_REQUEST',
      'expectedIntakeFingerprintSha256 must be an exact SHA-256 fingerprint.',
      400
    );
  }
  return value;
}

function exactInstant(value: string): string {
  if (
    !value ||
    Number.isNaN(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value
  ) {
    throw new ProductionServicePricingSourceError(
      'CURRENTNESS_CLOCK_UNAVAILABLE',
      'Service-pricing source currentness clock must be an exact ISO instant.',
      503,
      true
    );
  }
  return value;
}

function sameCommercialValue(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function validateProduct(product: Readonly<CommercialProduct>): void {
  try {
    assertCommercialProduct(product);
  } catch (cause) {
    throw new ProductionServicePricingSourceError(
      'COMMERCIAL_CATALOG_INTEGRITY_FAILURE',
      'Commercial Product does not satisfy the governed contract.',
      500,
      false,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
  if (
    product.status !== 'ACTIVE' ||
    product.code !== MARKREG_TRADEMARK_FILING_PRODUCT_CODE ||
    product.serviceType !== 'TrademarkFiling'
  ) {
    throw new ProductionServicePricingSourceError(
      'SERVICE_PRICE_NOT_APPLICABLE',
      'Commercial Product is not the active governed TrademarkFiling service.',
      422
    );
  }
}

function validatePrice(
  price: Readonly<CommercialPrice>,
  product: Readonly<CommercialProduct>,
  intake: Readonly<ProductionIntakeV1>,
  at: string
): void {
  try {
    assertCommercialPrice(price);
  } catch (cause) {
    throw new ProductionServicePricingSourceError(
      'COMMERCIAL_CATALOG_INTEGRITY_FAILURE',
      'Commercial Price does not satisfy the governed contract.',
      500,
      false,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
  if (
    price.productId !== product.productId ||
    price.channel !== intake.channel ||
    price.relationshipModel !== intake.relationshipModel ||
    !isCommercialPriceActive(price, at)
  ) {
    throw new ProductionServicePricingSourceError(
      'SERVICE_PRICE_NOT_APPLICABLE',
      'Commercial Price is not current for the exact Intake channel and relationship model.',
      422
    );
  }
}

function exactCatalogChoice(
  items: readonly Readonly<CommercialCatalogItem>[]
): Readonly<{ product: CommercialProduct; price: CommercialPrice }> {
  const supported = items.filter(
    (item) =>
      item.product.code === MARKREG_TRADEMARK_FILING_PRODUCT_CODE &&
      item.product.serviceType === 'TrademarkFiling'
  );
  if (supported.length === 0) {
    throw new ProductionServicePricingSourceError(
      'SERVICE_PRICE_NOT_FOUND',
      'No current governed TrademarkFiling service price exists for this Intake.',
      404
    );
  }
  if (supported.length !== 1 || supported[0]!.prices.length !== 1) {
    throw new ProductionServicePricingSourceError(
      'AMBIGUOUS_SERVICE_PRICE',
      'Exactly one current governed TrademarkFiling service price is required.',
      409
    );
  }
  return {
    product: structuredClone(supported[0]!.product),
    price: structuredClone(supported[0]!.prices[0]!)
  };
}

function translateDependency(error: unknown): never {
  if (error instanceof ProductionServicePricingSourceError) throw error;
  if (error instanceof ProductionIntakeError) {
    throw new ProductionServicePricingSourceError(
      error.code,
      error.message,
      error.status,
      error.retryable,
      { cause: error }
    );
  }
  if (error instanceof CommercialCheckoutError) {
    const retryable = error.code === 'PERSISTENCE_UNAVAILABLE';
    throw new ProductionServicePricingSourceError(
      error.code,
      error.message,
      retryable ? 503 : 422,
      retryable,
      { cause: error }
    );
  }
  throw new ProductionServicePricingSourceError(
    'PERSISTENCE_UNAVAILABLE',
    'Service-pricing source dependencies are unavailable.',
    503,
    true,
    { cause: error instanceof Error ? error : undefined }
  );
}

export class ProductionServicePricingSourceService {
  constructor(
    private readonly intakes: Pick<PostgresProductionIntakeService, 'get'>,
    private readonly catalog: Pick<
      CommercialCatalogRepository,
      'listCatalog' | 'findProduct' | 'findPrice'
    >,
    private readonly now = () => new Date().toISOString()
  ) {}

  async read(
    principal: WorkspacePrincipal,
    rawRequest: Readonly<ReadProductionServicePricingSourceV1>
  ): Promise<ProductionServicePricingSourceV1> {
    requirePermission(principal, 'order:read');
    const request = exactRequest(rawRequest);
    let intake: ProductionIntakeV1;
    let at: string;
    try {
      at = exactInstant(this.now());
      intake = await this.intakes.get(principal, request.intakeId);
    } catch (error) {
      return translateDependency(error);
    }
    if (
      intake.version !== request.expectedIntakeVersion ||
      intake.fingerprintSha256 !== request.expectedIntakeFingerprintSha256
    ) {
      throw new ProductionServicePricingSourceError(
        'INTAKE_VERSION_CONFLICT',
        'Service-pricing source requires the exact current Production Intake version and fingerprint.',
        409
      );
    }

    let listed: Readonly<{ product: CommercialProduct; price: CommercialPrice }>;
    let currentProduct: CommercialProduct | null;
    let currentPrice: CommercialPrice | null;
    try {
      const values = await this.catalog.listCatalog(
        {
          channel: intake.channel,
          relationshipModel: intake.relationshipModel,
          at
        },
        at
      );
      listed = exactCatalogChoice(values);
      [currentProduct, currentPrice] = await Promise.all([
        this.catalog.findProduct(listed.product.productId),
        this.catalog.findPrice(listed.price.priceId)
      ]);
    } catch (error) {
      return translateDependency(error);
    }
    if (!currentProduct || !currentPrice) {
      throw new ProductionServicePricingSourceError(
        'SERVICE_PRICE_VERSION_DRIFT',
        'Selected commercial Product/Price disappeared during currentness validation.',
        409
      );
    }
    validateProduct(currentProduct);
    validatePrice(currentPrice, currentProduct, intake, at);
    if (
      !sameCommercialValue(listed.product, currentProduct) ||
      !sameCommercialValue(listed.price, currentPrice)
    ) {
      throw new ProductionServicePricingSourceError(
        'SERVICE_PRICE_VERSION_DRIFT',
        'Commercial Product/Price changed during currentness validation.',
        409
      );
    }

    const intakeReference: EarlyFunnelArtifactReferenceV1 = {
      id: intake.intakeId,
      version: intake.version,
      fingerprintSha256: intake.fingerprintSha256
    };
    const material = {
      policyId: MARKREG_SERVICE_PRICING_SOURCE_POLICY,
      product: {
        productId: currentProduct.productId,
        version: currentProduct.version,
        code: MARKREG_TRADEMARK_FILING_PRODUCT_CODE,
        serviceType: 'TrademarkFiling' as const
      },
      price: {
        priceId: currentPrice.priceId,
        priceVersion: currentPrice.priceVersion,
        channel: currentPrice.channel,
        relationshipModel: currentPrice.relationshipModel,
        amount: structuredClone(currentPrice.amount),
        status: 'ACTIVE' as const,
        validFrom: currentPrice.validFrom,
        ...(currentPrice.validUntil ? { validUntil: currentPrice.validUntil } : {})
      }
    };
    const fingerprintSha256 = productionServicePricingSourceSha256({
      intake: intakeReference,
      material
    });
    const source: ProductionServicePricingSourceV1['source'] = {
      sourceKind: 'PRICING_SOURCE',
      sourceId: MARKREG_SERVICE_PRICING_SOURCE_ID,
      sourceVersion: `product:${currentProduct.productId}@${currentProduct.version}|price:${currentPrice.priceId}@${currentPrice.priceVersion}`,
      fingerprintSha256,
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      currentness: 'CURRENT',
      currentnessCheckedAt: at,
      provenanceRefs: [
        `commercial-product:${currentProduct.productId}@${currentProduct.version}`,
        `commercial-price:${currentPrice.priceId}@${currentPrice.priceVersion}`,
        `production-intake:${intake.intakeId}@${intake.version}:${intake.fingerprintSha256}`,
        `markreg-pricing-policy:${MARKREG_SERVICE_PRICING_SOURCE_POLICY}`
      ],
      assumptions: [
        'The exact Production Intake channel and relationship model remain the intended commercial context.'
      ],
      limitations: [
        'This source covers the MarkReg TrademarkFiling service price only; it excludes official fees, disbursements and taxes.',
        'This source does not create a Quote, Checkout, Payment, Invoice, Order, Matter, filing action or legal/professional approval.'
      ]
    };
    return structuredClone({
      schemaVersion: 1,
      workspaceId: principal.workspaceId,
      intake: intakeReference,
      source,
      material,
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
  }
}
