import { isDeepStrictEqual } from 'node:util';

import {
  US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID,
  US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID,
  US_TRADEMARK_MARK_REPRESENTATION_REFERENCE_DEPENDENCY,
  USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE
} from '@markorbit/contracts/brain-us-trademark-mark-representation-method';
import { noRecommendationSourceAuthorityConsequences } from '@markorbit/contracts/markreg-early-funnel';

const METHOD_FINGERPRINT = 'eb9fe8e8814c37b713409c45f9dec633712e2684df4886760b0776c21e2ac26a';
const PACKAGE_FINGERPRINT = '6877e2ae2bfa659595f3997e312aad933f65976cbb825678e41d47126443ed41';
const ACTIVATION_ID =
  'brain-method-activation_c0cfc431db2ec1f8047b554aeeb67cedee64d971d37e0488efefdad39921c2b9';
const ACTIVATED_AT = '2026-09-06T19:05:00.000Z';
const BRAIN_ASSET_ID = 'brain-asset_us-trademark-mark-representation-strategy';
const BRAIN_ASSET_VERSION_ID =
  'brain-asset-version_us-trademark-mark-representation-strategy-active-v1';
const KNOWLEDGE_GOVERNANCE_REF =
  'github:yoomarks/markorbit-knowledge@7ba94f5e7d45bd451d6ac25d5b509a600da43b7f';
const CURRENTNESS_MECHANISM =
  'CORE_BRAIN_ASSET_LATEST_ACTIVE_PLUS_EXACT_KNOWLEDGE_REFERENCE_IDENTITY_AND_CAPTURE_WINDOW';
const ACTIVATION_EVIDENCE_REF =
  'brain-method-activation:brain-method-activation_c0cfc431db2ec1f8047b554aeeb67cedee64d971d37e0488efefdad39921c2b9:fb97d07eca29ac78cc2098893a03a752f98a4bd35e9291e2d8b6407bbfbb135c';

export interface UsTrademarkMarkRepresentationMethodQueryV1 {
  readonly operation: 'MARK_REPRESENTATION_STRATEGY';
  readonly jurisdiction: 'US';
  readonly authority: 'USPTO';
  readonly asOf: string;
}
export interface CurrentUsTrademarkMarkRepresentationMethodSnapshotV1 {
  readonly schemaVersion: 1;
  readonly currentness: 'CURRENT';
  readonly currentnessMechanism: string;
  readonly brainAssetId: string;
  readonly brainAssetVersionId: string;
  readonly methodId: typeof US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID;
  readonly methodVersionId: typeof US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID;
  readonly methodFingerprintSha256: string;
  readonly packageId: typeof US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID;
  readonly packageVersion: 2;
  readonly packageFingerprintSha256: string;
  readonly activatedAt: string;
  readonly activationDecisionId: string;
  readonly activationEvidenceRef: string;
  readonly inputSchemaId: typeof US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID;
  readonly outputSchemaId: typeof US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID;
  readonly referenceDependency: string;
  readonly sourceReference: Readonly<Record<string, unknown>>;
  readonly knowledgeGovernanceRef: string;
  readonly currentnessCheckedAt: string;
  readonly authorityConsequences: typeof noRecommendationSourceAuthorityConsequences;
}

export interface UsTrademarkMarkRepresentationMethodReaderV1 {
  resolveCurrent(
    query: Readonly<UsTrademarkMarkRepresentationMethodQueryV1>
  ): Promise<Readonly<CurrentUsTrademarkMarkRepresentationMethodSnapshotV1>>;
}

export type UsTrademarkMarkRepresentationMethodReaderErrorCode =
  | 'INVALID_QUERY'
  | 'NO_CURRENT_METHOD'
  | 'AMBIGUOUS_CURRENT_METHOD'
  | 'IDENTITY_MISMATCH'
  | 'DEPENDENCY_UNAVAILABLE';

export class UsTrademarkMarkRepresentationMethodReaderError extends Error {
  constructor(
    readonly code: UsTrademarkMarkRepresentationMethodReaderErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'UsTrademarkMarkRepresentationMethodReaderError';
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validQuery(query: Readonly<UsTrademarkMarkRepresentationMethodQueryV1>): boolean {
  return (
    query.operation === 'MARK_REPRESENTATION_STRATEGY' &&
    query.jurisdiction === 'US' &&
    query.authority === 'USPTO' &&
    typeof query.asOf === 'string' &&
    query.asOf.trim() === query.asOf &&
    query.asOf.length > 0 &&
    !Number.isNaN(Date.parse(query.asOf))
  );
}

function exactSnapshot(
  value: unknown,
  query: Readonly<UsTrademarkMarkRepresentationMethodQueryV1>
): value is CurrentUsTrademarkMarkRepresentationMethodSnapshotV1 {
  const result = record(value);
  const authority = result ? record(result.authorityConsequences) : undefined;
  if (!result || !authority) return false;
  return (
    result.schemaVersion === 1 &&
    result.currentness === 'CURRENT' &&
    result.currentnessMechanism === CURRENTNESS_MECHANISM &&
    result.brainAssetId === BRAIN_ASSET_ID &&
    result.brainAssetVersionId === BRAIN_ASSET_VERSION_ID &&
    result.methodId === US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID &&
    result.methodVersionId === US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID &&
    result.methodFingerprintSha256 === METHOD_FINGERPRINT &&
    result.packageId === US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID &&
    result.packageVersion === 2 &&
    result.packageFingerprintSha256 === PACKAGE_FINGERPRINT &&
    result.activatedAt === ACTIVATED_AT &&
    result.activationDecisionId === ACTIVATION_ID &&
    result.activationEvidenceRef === ACTIVATION_EVIDENCE_REF &&
    result.inputSchemaId === US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID &&
    result.outputSchemaId === US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID &&
    result.referenceDependency === US_TRADEMARK_MARK_REPRESENTATION_REFERENCE_DEPENDENCY &&
    result.knowledgeGovernanceRef === KNOWLEDGE_GOVERNANCE_REF &&
    result.currentnessCheckedAt === query.asOf &&
    isDeepStrictEqual(result.sourceReference, {
      ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
      currentness: 'CURRENT'
    }) &&
    isDeepStrictEqual(authority, noRecommendationSourceAuthorityConsequences)
  );
}

export class HttpCoreUsTrademarkMarkRepresentationMethodReaderV1 implements UsTrademarkMarkRepresentationMethodReaderV1 {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (Buffer.byteLength(internalServiceSecret) < 32)
      throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }

  async resolveCurrent(
    query: Readonly<UsTrademarkMarkRepresentationMethodQueryV1>
  ): Promise<Readonly<CurrentUsTrademarkMarkRepresentationMethodSnapshotV1>> {
    if (!validQuery(query))
      throw new UsTrademarkMarkRepresentationMethodReaderError(
        'INVALID_QUERY',
        'Only the exact bounded US/USPTO mark-representation Method query is supported.'
      );
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.coreUrl.replace(/\/$/, '')}/internal/v1/brain-method-references/us-trademark-mark-representation/current`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify(query)
        }
      );
    } catch (cause) {
      throw new UsTrademarkMarkRepresentationMethodReaderError(
        'DEPENDENCY_UNAVAILABLE',
        'Core US trademark Method authority is unavailable.',
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const payload = (await response.json().catch(() => undefined)) as unknown;
    if (response.ok) {
      if (!exactSnapshot(payload, query))
        throw new UsTrademarkMarkRepresentationMethodReaderError(
          'IDENTITY_MISMATCH',
          'Core returned a current Method/reference identity that does not match the governed #903 bundle.'
        );
      return structuredClone(payload);
    }

    const error = record(payload);
    const code = typeof error?.code === 'string' ? error.code : undefined;
    if (response.status === 404 && code === 'NO_CURRENT_METHOD')
      throw new UsTrademarkMarkRepresentationMethodReaderError(
        'NO_CURRENT_METHOD',
        'Core has no current US trademark mark-representation Method.'
      );
    if (response.status === 409 && code === 'AMBIGUOUS_CURRENT_METHOD')
      throw new UsTrademarkMarkRepresentationMethodReaderError(
        'AMBIGUOUS_CURRENT_METHOD',
        'Core reported ambiguous current US trademark mark-representation Methods.'
      );
    if (response.status === 409 && code === 'IDENTITY_MISMATCH')
      throw new UsTrademarkMarkRepresentationMethodReaderError(
        'IDENTITY_MISMATCH',
        'Core rejected the governed #903 Method/reference identity.'
      );
    if (response.status === 400)
      throw new UsTrademarkMarkRepresentationMethodReaderError(
        'INVALID_QUERY',
        'Core rejected the bounded US trademark Method query.'
      );
    throw new UsTrademarkMarkRepresentationMethodReaderError(
      'DEPENDENCY_UNAVAILABLE',
      'Core US trademark Method authority rejected the request unexpectedly.',
      response.status >= 500
    );
  }
}
