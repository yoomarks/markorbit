import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_ID,
  CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_VERSION_ID,
  CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_ID
} from '../src/brain-cn-trademark-lifecycle-history.js';
import {
  TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1,
  TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CURRENTNESS_KIND,
  TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER,
  TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_RECEIPT_KIND,
  TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_REVOCATION_KIND,
  noTrademarkLifecycleRulePackReviewAuthorityConsequencesV1,
  parseTrademarkLifecycleRulePackReviewCurrentnessV1,
  parseTrademarkLifecycleRulePackReviewReceiptV1,
  parseTrademarkLifecycleRulePackReviewRevocationV1,
  trademarkLifecycleRulePackReviewCurrentnessFingerprintSha256V1,
  trademarkLifecycleRulePackReviewCurrentnessIdV1,
  trademarkLifecycleRulePackReviewReceiptFingerprintSha256V1,
  trademarkLifecycleRulePackReviewReceiptIdV1,
  trademarkLifecycleRulePackReviewReceiptReferenceV1,
  trademarkLifecycleRulePackReviewRevocationFingerprintSha256V1,
  trademarkLifecycleRulePackReviewRevocationIdV1,
  trademarkLifecycleRulePackReviewRevocationReferenceV1,
  trademarkLifecycleRulePackReviewedScopeFingerprintSha256V1,
  validateTrademarkLifecycleRulePackReviewCurrentAtV1,
  validateTrademarkLifecycleRulePackReviewCurrentnessV1,
  type FingerprintedOwnerReferenceV1,
  type TrademarkLifecycleRulePackReviewCurrentnessFingerprintMaterialV1,
  type TrademarkLifecycleRulePackReviewCurrentnessResultV1,
  type TrademarkLifecycleRulePackReviewCurrentnessV1,
  type TrademarkLifecycleRulePackReviewReceiptFingerprintMaterialV1,
  type TrademarkLifecycleRulePackReviewReceiptV1,
  type TrademarkLifecycleRulePackReviewRevocationFingerprintMaterialV1,
  type TrademarkLifecycleRulePackReviewRevocationV1
} from '../src/trademark-lifecycle-rule-pack-review.js';

type JsonRecord = Record<string, unknown>;

const REVIEWED_AT = '2026-10-10T02:00:00.000Z';
const AS_OF = '2026-10-10T03:00:00.000Z';
const LATER = '2026-10-10T04:00:00.000Z';
const EVEN_LATER = '2026-10-10T05:00:00.000Z';
const sha = (character: string): string => character.repeat(64);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function nodeFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function withoutIdentity(value: unknown, idKey: string, fingerprintKey: string): JsonRecord {
  return Object.fromEntries(
    Object.entries(structuredClone(value) as JsonRecord).filter(
      ([key]) => key !== idKey && key !== fingerprintKey
    )
  );
}

function coreReference(
  kind: 'AUTHENTICATED_PRINCIPAL' | 'LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEW_AUTHORITY',
  character: string
): FingerprintedOwnerReferenceV1 {
  return {
    owner: 'CORE',
    kind,
    id: `${kind.toLowerCase()}_${character}`,
    version: 1,
    fingerprintSha256: sha(character)
  };
}

const reviewerPrincipal = coreReference('AUTHENTICATED_PRINCIPAL', '1');
const reviewerAuthority = coreReference('LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEW_AUTHORITY', '2');
const revokerPrincipal = coreReference('AUTHENTICATED_PRINCIPAL', '3');
const revokerAuthority = coreReference('LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEW_AUTHORITY', '4');

function signReceipt(
  material: TrademarkLifecycleRulePackReviewReceiptFingerprintMaterialV1
): TrademarkLifecycleRulePackReviewReceiptV1 {
  const receiptFingerprintSha256 = nodeFingerprint(material);
  return parseTrademarkLifecycleRulePackReviewReceiptV1({
    ...material,
    receiptId: `trademark-lifecycle-rule-pack-review_${receiptFingerprintSha256}`,
    receiptFingerprintSha256
  });
}

function receipt(
  overrides: Partial<TrademarkLifecycleRulePackReviewReceiptFingerprintMaterialV1> = {}
): TrademarkLifecycleRulePackReviewReceiptV1 {
  const candidate = {
    applicabilityFingerprintSha256: CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256,
    methodReference: {
      owner: 'BRAIN',
      kind: 'TEMPORAL_RESOLUTION_METHOD',
      id: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_ID,
      version: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_VERSION_ID,
      fingerprintSha256: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256
    },
    methodPackageReference: {
      owner: 'BRAIN',
      kind: 'TEMPORAL_RESOLUTION_METHOD_PACKAGE',
      id: CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_ID,
      version: 1,
      fingerprintSha256: CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256
    }
  } as const;
  const reviewedBoundary = {
    resultSemantics: 'SOURCE_RECORDED_COMPLETED_HISTORY_ONLY',
    timeAssertionClass: 'SOURCE_RECORDED',
    timePresentationMeaning: 'RECORDED_FACT'
  } as const;
  const mergedCandidate = overrides.candidate ?? candidate;
  const mergedBoundary = overrides.reviewedBoundary ?? reviewedBoundary;
  return signReceipt({
    contractVersion: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1,
    schemaVersion: 1,
    owner: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER,
    kind: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_RECEIPT_KIND,
    version: 1,
    outcome: 'ACCEPTABLE_FOR_INDEPENDENT_ADMISSION_REVIEW',
    candidate: mergedCandidate,
    reviewedBoundary: mergedBoundary,
    reviewedScopeFingerprintSha256:
      overrides.reviewedScopeFingerprintSha256 ??
      trademarkLifecycleRulePackReviewedScopeFingerprintSha256V1({
        candidate: mergedCandidate,
        reviewedBoundary: mergedBoundary
      }),
    reviewer: {
      role: 'TRADEMARK_LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEWER',
      principalReference: reviewerPrincipal,
      authorityReference: reviewerAuthority
    },
    reviewedAt: REVIEWED_AT,
    expiresAt: null,
    supersedesReceiptReference: null,
    reasonCodes: [],
    authority: noTrademarkLifecycleRulePackReviewAuthorityConsequencesV1,
    ...overrides
  });
}

function resignReceipt(value: unknown): unknown {
  const material = withoutIdentity(value, 'receiptId', 'receiptFingerprintSha256');
  const receiptFingerprintSha256 = nodeFingerprint(material);
  return {
    ...material,
    receiptId: `trademark-lifecycle-rule-pack-review_${receiptFingerprintSha256}`,
    receiptFingerprintSha256
  };
}

function signRevocation(
  material: TrademarkLifecycleRulePackReviewRevocationFingerprintMaterialV1
): TrademarkLifecycleRulePackReviewRevocationV1 {
  const revocationFingerprintSha256 = nodeFingerprint(material);
  return parseTrademarkLifecycleRulePackReviewRevocationV1({
    ...material,
    revocationId: `trademark-lifecycle-rule-pack-review-revocation_${revocationFingerprintSha256}`,
    revocationFingerprintSha256
  });
}

function revocation(
  target: TrademarkLifecycleRulePackReviewReceiptV1,
  revokedAt = AS_OF
): TrademarkLifecycleRulePackReviewRevocationV1 {
  return signRevocation({
    contractVersion: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1,
    schemaVersion: 1,
    owner: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER,
    kind: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_REVOCATION_KIND,
    version: 1,
    targetReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(target),
    revokedAt,
    revokedBy: {
      principalReference: revokerPrincipal,
      authorityReference: revokerAuthority
    },
    reasonCode: 'GOVERNANCE_WITHDRAWAL',
    authority: noTrademarkLifecycleRulePackReviewAuthorityConsequencesV1
  });
}

function resignRevocation(value: unknown): unknown {
  const material = withoutIdentity(value, 'revocationId', 'revocationFingerprintSha256');
  const revocationFingerprintSha256 = nodeFingerprint(material);
  return {
    ...material,
    revocationId: `trademark-lifecycle-rule-pack-review-revocation_${revocationFingerprintSha256}`,
    revocationFingerprintSha256
  };
}

function signCurrentness(
  material: TrademarkLifecycleRulePackReviewCurrentnessFingerprintMaterialV1
): TrademarkLifecycleRulePackReviewCurrentnessV1 {
  const observationFingerprintSha256 = nodeFingerprint(material);
  return parseTrademarkLifecycleRulePackReviewCurrentnessV1({
    ...material,
    observationId: `trademark-lifecycle-rule-pack-review-currentness_${observationFingerprintSha256}`,
    observationFingerprintSha256
  });
}

function currentness(
  target: TrademarkLifecycleRulePackReviewReceiptV1,
  result: TrademarkLifecycleRulePackReviewCurrentnessResultV1,
  asOf = AS_OF
): TrademarkLifecycleRulePackReviewCurrentnessV1 {
  return signCurrentness({
    contractVersion: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1,
    schemaVersion: 1,
    owner: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER,
    kind: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CURRENTNESS_KIND,
    receiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(target),
    asOf,
    result,
    authority: noTrademarkLifecycleRulePackReviewAuthorityConsequencesV1
  });
}

function current(target: TrademarkLifecycleRulePackReviewReceiptV1, asOf = AS_OF) {
  return currentness(
    target,
    {
      status: 'CURRENT',
      headReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(target),
      reviewerAuthorityReference: target.reviewer.authorityReference,
      reviewedScopeFingerprintSha256: target.reviewedScopeFingerprintSha256
    },
    asOf
  );
}

function resignCurrentness(value: unknown): unknown {
  const material = withoutIdentity(value, 'observationId', 'observationFingerprintSha256');
  const observationFingerprintSha256 = nodeFingerprint(material);
  return {
    ...material,
    observationId: `trademark-lifecycle-rule-pack-review-currentness_${observationFingerprintSha256}`,
    observationFingerprintSha256
  };
}

describe('trademark lifecycle Rule Pack review contract', () => {
  it('binds receipt identity and browser-safe hashing to independent Node crypto', () => {
    const value = receipt();
    const material = withoutIdentity(value, 'receiptId', 'receiptFingerprintSha256');

    expect(value.receiptFingerprintSha256).toBe(nodeFingerprint(material));
    expect(trademarkLifecycleRulePackReviewReceiptFingerprintSha256V1(value)).toBe(
      nodeFingerprint(material)
    );
    expect(trademarkLifecycleRulePackReviewReceiptIdV1(value.receiptFingerprintSha256)).toBe(
      value.receiptId
    );
    expect(parseTrademarkLifecycleRulePackReviewReceiptV1(value)).toEqual(value);
  });

  it.each([
    ['owner', (value: JsonRecord) => (value.owner = 'EXECUTION')],
    [
      'applicability',
      (value: JsonRecord) =>
        ((value.candidate as JsonRecord).applicabilityFingerprintSha256 = sha('a'))
    ],
    [
      'Method',
      (value: JsonRecord) =>
        (((value.candidate as JsonRecord).methodReference as JsonRecord).fingerprintSha256 =
          sha('b'))
    ],
    [
      'package',
      (value: JsonRecord) =>
        (((value.candidate as JsonRecord).methodPackageReference as JsonRecord).id =
          'executable-method-package_wrong')
    ],
    [
      'reviewed boundary',
      (value: JsonRecord) =>
        ((value.reviewedBoundary as JsonRecord).timeAssertionClass = 'PREDICTED')
    ],
    [
      'reviewer principal owner',
      (value: JsonRecord) =>
        (((value.reviewer as JsonRecord).principalReference as JsonRecord).owner = 'MARKREG')
    ],
    [
      'reviewer authority kind',
      (value: JsonRecord) =>
        (((value.reviewer as JsonRecord).authorityReference as JsonRecord).kind =
          'PROFESSIONAL_REVIEW_CASE')
    ],
    ['expiry ordering', (value: JsonRecord) => (value.expiresAt = REVIEWED_AT)],
    [
      'false authority',
      (value: JsonRecord) => ((value.authority as JsonRecord).runtimeExposureAuthorized = true)
    ]
  ])('rejects semantically re-signed receipt tampering: %s', (_name, mutate) => {
    const value = structuredClone(receipt()) as unknown as JsonRecord;
    mutate(value);
    expect(() => parseTrademarkLifecycleRulePackReviewReceiptV1(resignReceipt(value))).toThrow();
  });

  it('keeps acceptable and rejected outcomes closed and non-workflow-shaped', () => {
    expect(() => receipt({ reasonCodes: ['CHANGES_REQUIRED'] })).toThrow();
    expect(() => receipt({ outcome: 'REJECTED', reasonCodes: [] })).toThrow();

    const rejected = receipt({
      outcome: 'REJECTED',
      reasonCodes: ['BOUNDARY_NOT_ACCEPTABLE']
    });
    expect(rejected.outcome).toBe('REJECTED');

    const changed = structuredClone(receipt()) as unknown as JsonRecord;
    changed.outcome = 'CHANGES_REQUIRED';
    expect(() => parseTrademarkLifecycleRulePackReviewReceiptV1(resignReceipt(changed))).toThrow();
  });

  it('binds revocation identity, exact target and closed authority to Node crypto', () => {
    const target = receipt();
    const value = revocation(target);
    const material = withoutIdentity(value, 'revocationId', 'revocationFingerprintSha256');

    expect(value.revocationFingerprintSha256).toBe(nodeFingerprint(material));
    expect(trademarkLifecycleRulePackReviewRevocationFingerprintSha256V1(value)).toBe(
      nodeFingerprint(material)
    );
    expect(trademarkLifecycleRulePackReviewRevocationIdV1(value.revocationFingerprintSha256)).toBe(
      value.revocationId
    );
    expect(trademarkLifecycleRulePackReviewRevocationReferenceV1(value).fingerprintSha256).toBe(
      value.revocationFingerprintSha256
    );

    for (const mutate of [
      (item: JsonRecord) => (item.reasonCode = 'OTHER_BOUNDED_REASON'),
      (item: JsonRecord) =>
        (((item.revokedBy as JsonRecord).authorityReference as JsonRecord).owner = 'EXECUTION'),
      (item: JsonRecord) => ((item.authority as JsonRecord).workOrMatterMutationAuthorized = true)
    ]) {
      const changed = structuredClone(value) as unknown as JsonRecord;
      mutate(changed);
      expect(() =>
        parseTrademarkLifecycleRulePackReviewRevocationV1(resignRevocation(changed))
      ).toThrow();
    }
  });

  it('parses the nine closed currentness result branches without snapshot pseudo-contracts', () => {
    const target = receipt({ expiresAt: AS_OF });
    const successor = receipt({
      reviewedAt: LATER,
      supersedesReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(target)
    });
    const revoked = revocation(target);
    const results: readonly TrademarkLifecycleRulePackReviewCurrentnessResultV1[] = [
      {
        status: 'CURRENT',
        headReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(target),
        reviewerAuthorityReference: target.reviewer.authorityReference,
        reviewedScopeFingerprintSha256: target.reviewedScopeFingerprintSha256
      },
      {
        status: 'SUPERSEDED',
        successorReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(successor)
      },
      {
        status: 'REVOKED',
        revocationReference: trademarkLifecycleRulePackReviewRevocationReferenceV1(revoked)
      },
      { status: 'EXPIRED' },
      {
        status: 'REVIEWER_AUTHORITY_NOT_CURRENT',
        reviewerAuthorityReference: target.reviewer.authorityReference
      },
      { status: 'REVIEWED_SCOPE_CHANGED', observedScopeFingerprintSha256: sha('9') },
      { status: 'NOT_FOUND' },
      { status: 'UNAVAILABLE', unavailableBasis: ['RECEIPT_HEAD', 'REVOCATION'] },
      { status: 'INTEGRITY_FAILURE', failedBasis: ['REVIEWER_AUTHORITY'] }
    ];

    expect(results.map((result) => currentness(target, result, LATER).result.status)).toEqual([
      'CURRENT',
      'SUPERSEDED',
      'REVOKED',
      'EXPIRED',
      'REVIEWER_AUTHORITY_NOT_CURRENT',
      'REVIEWED_SCOPE_CHANGED',
      'NOT_FOUND',
      'UNAVAILABLE',
      'INTEGRITY_FAILURE'
    ]);
  });

  it('binds currentness identity and browser-safe hashing to independent Node crypto', () => {
    const target = receipt();
    const value = current(target);
    const material = withoutIdentity(value, 'observationId', 'observationFingerprintSha256');

    expect(value.observationFingerprintSha256).toBe(nodeFingerprint(material));
    expect(trademarkLifecycleRulePackReviewCurrentnessFingerprintSha256V1(value)).toBe(
      nodeFingerprint(material)
    );
    expect(
      trademarkLifecycleRulePackReviewCurrentnessIdV1(value.observationFingerprintSha256)
    ).toBe(value.observationId);
  });

  it('rejects reference IDs that do not close over their exact fingerprint', () => {
    const target = receipt();
    const wrongReceiptReference = structuredClone(current(target)) as unknown as JsonRecord;
    (wrongReceiptReference.receiptReference as JsonRecord).id =
      'trademark-lifecycle-rule-pack-review_not-the-fingerprint';
    expect(() =>
      parseTrademarkLifecycleRulePackReviewCurrentnessV1(resignCurrentness(wrongReceiptReference))
    ).toThrow();

    const revoked = revocation(target);
    const wrongRevocationReference = structuredClone(
      currentness(target, {
        status: 'REVOKED',
        revocationReference: trademarkLifecycleRulePackReviewRevocationReferenceV1(revoked)
      })
    ) as unknown as JsonRecord;
    ((wrongRevocationReference.result as JsonRecord).revocationReference as JsonRecord).id =
      'trademark-lifecycle-rule-pack-review-revocation_not-the-fingerprint';
    expect(() =>
      parseTrademarkLifecycleRulePackReviewCurrentnessV1(
        resignCurrentness(wrongRevocationReference)
      )
    ).toThrow();
  });

  it.each([
    ['empty unavailable basis', { status: 'UNAVAILABLE', unavailableBasis: [] }],
    [
      'duplicate failed basis',
      { status: 'INTEGRITY_FAILURE', failedBasis: ['RECEIPT_HEAD', 'RECEIPT_HEAD'] }
    ],
    [
      'misordered unavailable basis',
      { status: 'UNAVAILABLE', unavailableBasis: ['REVIEWED_SCOPE', 'RECEIPT_HEAD'] }
    ],
    ['positive substitute on not found', { status: 'NOT_FOUND', headReceiptReference: {} }],
    ['revocation on expired', { status: 'EXPIRED', revocationReference: {} }]
  ])('rejects malformed closed currentness results: %s', (_name, result) => {
    const target = receipt();
    const changed = structuredClone(current(target)) as unknown as JsonRecord;
    changed.result = result;
    expect(() =>
      parseTrademarkLifecycleRulePackReviewCurrentnessV1(resignCurrentness(changed))
    ).toThrow();
  });

  it('accepts CURRENT only at the exact evaluation time and never reuses an old observation', () => {
    const target = receipt();
    const observation = current(target, AS_OF);

    expect(validateTrademarkLifecycleRulePackReviewCurrentAtV1(target, observation, AS_OF)).toEqual(
      target
    );
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentAtV1(target, observation, LATER)
    ).toThrow();

    const rejected = receipt({
      outcome: 'REJECTED',
      reasonCodes: ['BOUNDARY_NOT_ACCEPTABLE']
    });
    expect(
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(rejected, current(rejected, AS_OF))
        .result.status
    ).toBe('CURRENT');
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentAtV1(rejected, current(rejected, AS_OF), AS_OF)
    ).toThrow();
  });

  it('rejects positive relations that do not belong to the exact currentness branch', () => {
    const target = receipt();
    const successor = receipt({
      reviewedAt: LATER,
      supersedesReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(target)
    });
    const revoked = revocation(target, LATER);

    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, current(target), {
        successorReceipt: successor
      })
    ).toThrow();
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, current(target), {
        revocation: revoked
      })
    ).toThrow();

    const superseded = currentness(
      target,
      {
        status: 'SUPERSEDED',
        successorReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(successor)
      },
      EVEN_LATER
    );
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, superseded, {
        successorReceipt: successor,
        revocation: revoked
      })
    ).toThrow();
  });

  it('fails CURRENT at expiry and accepts EXPIRED iff an explicit expiry has been reached', () => {
    const expiring = receipt({ expiresAt: AS_OF });
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(expiring, current(expiring))
    ).toThrow();
    expect(
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(
        expiring,
        currentness(expiring, { status: 'EXPIRED' })
      ).result.status
    ).toBe('EXPIRED');

    const noExpiry = receipt();
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(
        noExpiry,
        currentness(noExpiry, { status: 'EXPIRED' })
      )
    ).toThrow();
  });

  it('orders canonical extended-year timestamps by time rather than lexicographic text', () => {
    const reviewedAt = '9999-12-31T23:59:59.999Z';
    const expiresAt = '+010000-01-01T00:00:01.000Z';
    const asOf = '+010000-01-01T00:00:00.000Z';
    const target = receipt({ reviewedAt, expiresAt });

    expect(
      validateTrademarkLifecycleRulePackReviewCurrentAtV1(target, current(target, asOf), asOf)
    ).toEqual(target);
  });

  it('requires exact later supersession lineage effective by asOf', () => {
    const target = receipt();
    const successor = receipt({
      reviewedAt: LATER,
      supersedesReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(target)
    });
    const observation = currentness(
      target,
      {
        status: 'SUPERSEDED',
        successorReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(successor)
      },
      EVEN_LATER
    );
    expect(
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, observation, {
        successorReceipt: successor
      }).result.status
    ).toBe('SUPERSEDED');

    const futureSuccessor = receipt({
      reviewedAt: '2026-10-10T06:00:00.000Z',
      supersedesReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(target)
    });
    const futureObservation = currentness(
      target,
      {
        status: 'SUPERSEDED',
        successorReceiptReference:
          trademarkLifecycleRulePackReviewReceiptReferenceV1(futureSuccessor)
      },
      EVEN_LATER
    );
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, futureObservation, {
        successorReceipt: futureSuccessor
      })
    ).toThrow();

    const wrongLineage = receipt({ reviewedAt: LATER });
    const wrongObservation = currentness(
      target,
      {
        status: 'SUPERSEDED',
        successorReceiptReference: trademarkLifecycleRulePackReviewReceiptReferenceV1(wrongLineage)
      },
      EVEN_LATER
    );
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, wrongObservation, {
        successorReceipt: wrongLineage
      })
    ).toThrow();
  });

  it('requires exact target revocation effective by asOf', () => {
    const target = receipt();
    const revoked = revocation(target, LATER);
    const observation = currentness(
      target,
      {
        status: 'REVOKED',
        revocationReference: trademarkLifecycleRulePackReviewRevocationReferenceV1(revoked)
      },
      EVEN_LATER
    );
    expect(
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, observation, {
        revocation: revoked
      }).result.status
    ).toBe('REVOKED');

    const future = revocation(target, '2026-10-10T06:00:00.000Z');
    const futureObservation = currentness(
      target,
      {
        status: 'REVOKED',
        revocationReference: trademarkLifecycleRulePackReviewRevocationReferenceV1(future)
      },
      EVEN_LATER
    );
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, futureObservation, {
        revocation: future
      })
    ).toThrow();

    const other = receipt({ reviewedAt: LATER });
    const wrongTarget = revocation(other, LATER);
    const wrongObservation = currentness(
      target,
      {
        status: 'REVOKED',
        revocationReference: trademarkLifecycleRulePackReviewRevocationReferenceV1(wrongTarget)
      },
      EVEN_LATER
    );
    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, wrongObservation, {
        revocation: wrongTarget
      })
    ).toThrow();
  });

  it('requires exact authority invalidation and a genuinely changed scope fingerprint', () => {
    const target = receipt();
    expect(
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(
        target,
        currentness(target, {
          status: 'REVIEWER_AUTHORITY_NOT_CURRENT',
          reviewerAuthorityReference: target.reviewer.authorityReference
        })
      ).result.status
    ).toBe('REVIEWER_AUTHORITY_NOT_CURRENT');

    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(
        target,
        currentness(target, {
          status: 'REVIEWER_AUTHORITY_NOT_CURRENT',
          reviewerAuthorityReference: coreReference(
            'LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEW_AUTHORITY',
            '8'
          )
        })
      )
    ).toThrow();

    expect(() =>
      validateTrademarkLifecycleRulePackReviewCurrentnessV1(
        target,
        currentness(target, {
          status: 'REVIEWED_SCOPE_CHANGED',
          observedScopeFingerprintSha256: target.reviewedScopeFingerprintSha256
        })
      )
    ).toThrow();
  });

  it('rejects re-signed currentness identity and authority tampering', () => {
    for (const mutate of [
      (item: JsonRecord) => (item.owner = 'CORE'),
      (item: JsonRecord) => ((item.authority as JsonRecord).reviewedTimingUnlocked = true)
    ]) {
      const changed = structuredClone(current(receipt())) as unknown as JsonRecord;
      mutate(changed);
      expect(() =>
        parseTrademarkLifecycleRulePackReviewCurrentnessV1(resignCurrentness(changed))
      ).toThrow();
    }
  });

  it('rejects a structurally valid but wrong target fingerprint at the paired boundary', () => {
    const target = receipt();
    const changed = structuredClone(current(target)) as unknown as JsonRecord;
    (changed.receiptReference as JsonRecord).fingerprintSha256 = sha('f');
    (changed.receiptReference as JsonRecord).id =
      `trademark-lifecycle-rule-pack-review_${sha('f')}`;
    const resigned = resignCurrentness(changed);

    expect(() => parseTrademarkLifecycleRulePackReviewCurrentnessV1(resigned)).not.toThrow();
    expect(() => validateTrademarkLifecycleRulePackReviewCurrentnessV1(target, resigned)).toThrow();
  });

  it('rejects Execution Matter Draft review lookalikes and preserves zero authority', () => {
    expect(() =>
      parseTrademarkLifecycleRulePackReviewReceiptV1({
        schemaVersion: 1,
        owner: 'EXECUTION',
        kind: 'PROFESSIONAL_REVIEW_CASE',
        status: 'REVIEWED_READY_FOR_NEXT_STEP'
      })
    ).toThrow();
    expect(
      Object.values(noTrademarkLifecycleRulePackReviewAuthorityConsequencesV1).every(
        (value) => value === false
      )
    ).toBe(true);
  });
});
