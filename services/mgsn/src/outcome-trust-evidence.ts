import {
  noTrustEvidenceAuthorityConsequences,
  parseTrustEvidenceCurrentExposureValidationV1,
  parseTrustEvidenceItemV1,
  parseTrustEvidenceVisibilityProjectionV1,
  parseTrustExplanationV1,
  trustExplanationFingerprintV1,
  type TrustEvidenceCurrentExposureValidationV1,
  type TrustEvidenceExposureDenialReasonV1,
  type TrustEvidenceItemReferenceV1,
  type TrustEvidenceItemV1,
  type TrustEvidenceVisibilityProjectionIdV1,
  type TrustEvidenceVisibilityProjectionV1,
  type TrustExplanationContradictionV1,
  type TrustExplanationResultV1,
  type TrustExplanationV1
} from '@markorbit/contracts/outcome-trust-evidence';

export class OutcomeTrustEvidenceRuntimeError extends Error {
  constructor(
    readonly code:
      | 'INVALID_INPUT'
      | 'EVIDENCE_NOT_FOUND'
      | 'PROJECTION_NOT_FOUND'
      | 'EVIDENCE_REFERENCE_MISMATCH'
      | 'AUTHORITY_UNAVAILABLE',
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'OutcomeTrustEvidenceRuntimeError';
  }
}

export interface TrustEvidenceCurrentAuthoritySnapshot {
  authorityAvailable: boolean;
  participationActive: boolean;
  visibilityAuthorized: boolean;
  relationshipAuthorityCurrent: boolean;
  sourceAuthoritiesCurrent: boolean;
  contextMatches: boolean;
  executorAttributionCurrent: boolean;
  authorityReferences: readonly string[];
}

export interface TrustEvidenceCurrentAuthoritySource {
  evaluateCurrentAuthority(input: {
    projection: Readonly<TrustEvidenceVisibilityProjectionV1>;
    evidenceItems: ReadonlyArray<Readonly<TrustEvidenceItemV1>>;
  }): Promise<Readonly<TrustEvidenceCurrentAuthoritySnapshot>>;
}

export interface OutcomeTrustEvidenceRepository {
  putEvidenceItem(item: Readonly<TrustEvidenceItemV1>): Promise<void>;
  findEvidenceItem(
    reference: Readonly<TrustEvidenceItemReferenceV1>
  ): Promise<Readonly<TrustEvidenceItemV1> | undefined>;
  putProjection(projection: Readonly<TrustEvidenceVisibilityProjectionV1>): Promise<void>;
  findProjection(
    projectionId: TrustEvidenceVisibilityProjectionIdV1
  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined>;
  putExplanation(explanation: Readonly<TrustExplanationV1>): Promise<void>;
  findExplanation(
    trustExplanationId: TrustExplanationV1['trustExplanationId']
  ): Promise<Readonly<TrustExplanationV1> | undefined>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameEvidenceReference(
  item: Readonly<TrustEvidenceItemV1>,
  reference: Readonly<TrustEvidenceItemReferenceV1>
): boolean {
  return (
    item.trustEvidenceItemId === reference.trustEvidenceItemId &&
    item.version === reference.version &&
    item.trustEvidenceItemFingerprintSha256 === reference.trustEvidenceItemFingerprintSha256
  );
}

function itemKey(reference: Readonly<TrustEvidenceItemReferenceV1>): string {
  return `${reference.trustEvidenceItemId}:${reference.version}:${reference.trustEvidenceItemFingerprintSha256}`;
}

function itemReference(item: Readonly<TrustEvidenceItemV1>): TrustEvidenceItemReferenceV1 {
  return {
    trustEvidenceItemId: item.trustEvidenceItemId,
    version: item.version,
    trustEvidenceItemFingerprintSha256: item.trustEvidenceItemFingerprintSha256
  };
}

export class InMemoryOutcomeTrustEvidenceRepository implements OutcomeTrustEvidenceRepository {
  private readonly items = new Map<string, Readonly<TrustEvidenceItemV1>>();
  private readonly projections = new Map<
    TrustEvidenceVisibilityProjectionIdV1,
    Readonly<TrustEvidenceVisibilityProjectionV1>
  >();
  private readonly explanations = new Map<
    TrustExplanationV1['trustExplanationId'],
    Readonly<TrustExplanationV1>
  >();

  putEvidenceItem(item: Readonly<TrustEvidenceItemV1>): Promise<void> {
    this.items.set(itemKey(itemReference(item)), clone(item));
    return Promise.resolve();
  }

  findEvidenceItem(
    reference: Readonly<TrustEvidenceItemReferenceV1>
  ): Promise<Readonly<TrustEvidenceItemV1> | undefined> {
    return Promise.resolve(clone(this.items.get(itemKey(reference))));
  }

  putProjection(projection: Readonly<TrustEvidenceVisibilityProjectionV1>): Promise<void> {
    this.projections.set(projection.trustEvidenceVisibilityProjectionId, clone(projection));
    return Promise.resolve();
  }

  findProjection(
    projectionId: TrustEvidenceVisibilityProjectionIdV1
  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined> {
    return Promise.resolve(clone(this.projections.get(projectionId)));
  }

  putExplanation(explanation: Readonly<TrustExplanationV1>): Promise<void> {
    this.explanations.set(explanation.trustExplanationId, clone(explanation));
    return Promise.resolve();
  }

  findExplanation(
    trustExplanationId: TrustExplanationV1['trustExplanationId']
  ): Promise<Readonly<TrustExplanationV1> | undefined> {
    return Promise.resolve(clone(this.explanations.get(trustExplanationId)));
  }
}

function lifecycleDenial(
  items: ReadonlyArray<Readonly<TrustEvidenceItemV1>>
): TrustEvidenceExposureDenialReasonV1 | undefined {
  if (items.some((item) => item.lifecycleState === 'REVOKED')) return 'EVIDENCE_REVOKED';
  if (items.some((item) => item.lifecycleState === 'DISPUTED')) return 'EVIDENCE_DISPUTED';
  if (items.some((item) => item.lifecycleState === 'SUPERSEDED')) return 'EVIDENCE_SUPERSEDED';
  if (
    items.some(
      (item) =>
        item.sourceAuthority.authorityState !== 'CURRENT' ||
        item.freshness.state !== 'CURRENT_FOR_CONTEXT'
    )
  ) {
    return 'SOURCE_NOT_CURRENT';
  }
  return undefined;
}

function explanationResult(
  items: ReadonlyArray<Readonly<TrustEvidenceItemV1>>
): TrustExplanationResultV1 {
  if (items.length === 0) return 'INSUFFICIENT_EVIDENCE';
  if (items.some((item) => item.lifecycleState === 'DISPUTED')) return 'DISPUTED_EVIDENCE';
  if (items.some((item) => item.contradictions.length > 0)) return 'CONTRADICTORY_EVIDENCE';
  if (
    items.some(
      (item) =>
        item.lifecycleState !== 'CURRENT' ||
        item.sourceAuthority.authorityState !== 'CURRENT' ||
        item.freshness.state !== 'CURRENT_FOR_CONTEXT'
    )
  ) {
    return 'STALE_OR_UNAVAILABLE';
  }
  return 'EVIDENCE_AVAILABLE';
}

function explanationSummary(result: TrustExplanationResultV1): string {
  switch (result) {
    case 'EVIDENCE_AVAILABLE':
      return 'Current contextual evidence is available for bounded advisory review.';
    case 'INSUFFICIENT_EVIDENCE':
      return 'Insufficient contextual evidence is available; no negative Provider inference is made.';
    case 'CONTRADICTORY_EVIDENCE':
      return 'Contextual evidence contains explicit contradictions and no consensus is inferred.';
    case 'STALE_OR_UNAVAILABLE':
      return 'Some contextual evidence is stale, superseded, corrected, or source authority is unavailable.';
    case 'DISPUTED_EVIDENCE':
      return 'Some contextual evidence is disputed and is not presented as current positive evidence.';
  }
}

function explanationContradictions(
  items: ReadonlyArray<Readonly<TrustEvidenceItemV1>>
): TrustExplanationContradictionV1[] {
  const byKey = new Map(items.map((item) => [itemKey(itemReference(item)), item]));
  const output: TrustExplanationContradictionV1[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (const contradiction of item.contradictions) {
      const other = byKey.get(itemKey(contradiction));
      if (!other) continue;
      const left = itemReference(item);
      const right = itemReference(other);
      const pair = [itemKey(left), itemKey(right)].sort().join('|');
      if (seen.has(pair)) continue;
      seen.add(pair);
      output.push({
        left,
        right,
        explanation: `Explicit contradiction reference: ${contradiction.contradictionReference}`
      });
    }
  }
  return output;
}

function mergedLimitations(
  items: ReadonlyArray<Readonly<TrustEvidenceItemV1>>
): TrustExplanationV1['limitations'] {
  const seen = new Set<string>();
  const output: Array<TrustExplanationV1['limitations'][number]> = [];
  for (const item of items) {
    for (const limitation of item.limitations) {
      const key = `${limitation.code}:${limitation.explanation}`;
      if (!seen.has(key)) {
        seen.add(key);
        output.push(clone(limitation));
      }
    }
  }
  return output;
}

export class OutcomeTrustEvidenceService {
  constructor(
    private readonly repository: OutcomeTrustEvidenceRepository,
    private readonly currentAuthority: TrustEvidenceCurrentAuthoritySource,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async recordEvidenceItem(value: unknown): Promise<Readonly<TrustEvidenceItemV1>> {
    const item = parseTrustEvidenceItemV1(value);
    await this.repository.putEvidenceItem(item);
    return clone(item);
  }

  async recordVisibilityProjection(
    value: unknown
  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1>> {
    const projection = parseTrustEvidenceVisibilityProjectionV1(value);
    for (const reference of projection.evidenceItems) {
      const item = await this.repository.findEvidenceItem(reference);
      if (!item) {
        throw new OutcomeTrustEvidenceRuntimeError(
          'EVIDENCE_NOT_FOUND',
          404,
          'Trust Evidence projection references an unknown exact evidence item.'
        );
      }
      if (!sameEvidenceReference(item, reference)) {
        throw new OutcomeTrustEvidenceRuntimeError(
          'EVIDENCE_REFERENCE_MISMATCH',
          409,
          'Trust Evidence projection reference does not match the exact stored item.'
        );
      }
      if (
        item.providerId !== projection.providerId ||
        item.context.contextFingerprintSha256 !== projection.contextFingerprintSha256
      ) {
        throw new OutcomeTrustEvidenceRuntimeError(
          'EVIDENCE_REFERENCE_MISMATCH',
          409,
          'Trust Evidence projection cannot cross Provider or context boundaries.'
        );
      }
    }
    await this.repository.putProjection(projection);
    return clone(projection);
  }

  async explain(
    projectionId: TrustEvidenceVisibilityProjectionIdV1
  ): Promise<Readonly<TrustExplanationV1>> {
    const projection = await this.requireProjection(projectionId);
    const items = await this.loadProjectionItems(projection);
    const result = explanationResult(items);
    const contradictions = explanationContradictions(items);
    const limitations = [...mergedLimitations(items)];
    if (result === 'INSUFFICIENT_EVIDENCE') {
      limitations.push({
        code: 'INSUFFICIENT_EVIDENCE',
        explanation: 'No exact contextual evidence item is available for this bounded projection.'
      });
    }
    if (items.some((item) => item.source.kind === 'PROVIDER_CLAIM')) {
      limitations.push({
        code: 'CLAIM_NOT_VERIFIED_OUTCOME',
        explanation: 'Provider claims remain claims and are not promoted to verified outcome truth.'
      });
    }
    if (
      items.some(
        (item) =>
          item.source.kind === 'CANONICAL_OWNER_FACT' &&
          item.source.factKind === 'PAYMENT_LIFECYCLE'
      )
    ) {
      limitations.push({
        code: 'PAYMENT_IS_COMMERCIAL_FACT_ONLY',
        explanation: 'Payment lifecycle evidence is a commercial fact only, not performance truth.'
      });
    }

    const base = {
      schemaVersion: 1 as const,
      providerId: projection.providerId,
      contextFingerprintSha256: projection.contextFingerprintSha256,
      result,
      evidenceItems: result === 'INSUFFICIENT_EVIDENCE' ? [] : items.map(itemReference),
      contradictions: result === 'CONTRADICTORY_EVIDENCE' ? contradictions : [],
      limitations,
      summary: explanationSummary(result),
      visibilityProjection: {
        trustEvidenceVisibilityProjectionId: projection.trustEvidenceVisibilityProjectionId,
        projectionFingerprintSha256: projection.projectionFingerprintSha256
      },
      currentExposureValidationRequiredBeforeServe: true as const,
      universalScoreCreated: false as const,
      rankCreated: false as const,
      winnerCreated: false as const,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    };
    const fingerprint = trustExplanationFingerprintV1(base);
    const explanation = parseTrustExplanationV1({
      ...base,
      trustExplanationId: `trust-explanation_${fingerprint}`,
      trustExplanationFingerprintSha256: fingerprint,
      createdAt: this.now()
    });
    await this.repository.putExplanation(explanation);
    return clone(explanation);
  }

  async validateCurrentExposure(
    projectionId: TrustEvidenceVisibilityProjectionIdV1,
    options: Readonly<{ artifactRetrievalRequested?: boolean }> = {}
  ): Promise<Readonly<TrustEvidenceCurrentExposureValidationV1>> {
    const projection = await this.requireProjection(projectionId);
    const items = await this.loadProjectionItems(projection);
    const deny = (
      reason: TrustEvidenceExposureDenialReasonV1
    ): Readonly<TrustEvidenceCurrentExposureValidationV1> =>
      parseTrustEvidenceCurrentExposureValidationV1({
        schemaVersion: 1,
        decision: 'DENY',
        providerId: projection.providerId,
        purpose: projection.purpose,
        contextFingerprintSha256: projection.contextFingerprintSha256,
        projection: {
          trustEvidenceVisibilityProjectionId: projection.trustEvidenceVisibilityProjectionId,
          projectionFingerprintSha256: projection.projectionFingerprintSha256
        },
        reason,
        checkedAt: this.now(),
        artifactAccessAuthorized: false,
        authorityConsequences: noTrustEvidenceAuthorityConsequences
      });

    if (options.artifactRetrievalRequested) return deny('ARTIFACT_AUTHORITY_NOT_ESTABLISHED');
    const historicalDenial = lifecycleDenial(items);
    if (historicalDenial) return deny(historicalDenial);
    if (
      items.some(
        (item) =>
          item.providerId !== projection.providerId ||
          item.context.contextFingerprintSha256 !== projection.contextFingerprintSha256
      )
    ) {
      return deny('CONTEXT_MISMATCH');
    }

    let authority: Readonly<TrustEvidenceCurrentAuthoritySnapshot>;
    try {
      authority = await this.currentAuthority.evaluateCurrentAuthority({ projection, evidenceItems: items });
    } catch {
      return deny('AUTHORITY_UNAVAILABLE');
    }
    if (!authority.authorityAvailable) return deny('AUTHORITY_UNAVAILABLE');
    if (projection.historicalAuthorization.kind === 'NETWORK_VISIBILITY') {
      if (!authority.participationActive) return deny('PARTICIPATION_NOT_ACTIVE');
      if (!authority.visibilityAuthorized) return deny('VISIBILITY_NOT_AUTHORIZED');
    } else if (!authority.relationshipAuthorityCurrent) {
      return deny('RELATIONSHIP_AUTHORITY_NOT_CURRENT');
    }
    if (!authority.sourceAuthoritiesCurrent) return deny('SOURCE_NOT_CURRENT');
    if (!authority.contextMatches) return deny('CONTEXT_MISMATCH');
    if (
      items.some((item) => item.context.executorAttribution.state === 'ESTABLISHED') &&
      !authority.executorAttributionCurrent
    ) {
      return deny('EXECUTOR_ATTRIBUTION_NOT_ESTABLISHED');
    }

    return parseTrustEvidenceCurrentExposureValidationV1({
      schemaVersion: 1,
      decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION',
      providerId: projection.providerId,
      purpose: projection.purpose,
      contextFingerprintSha256: projection.contextFingerprintSha256,
      projection: {
        trustEvidenceVisibilityProjectionId: projection.trustEvidenceVisibilityProjectionId,
        projectionFingerprintSha256: projection.projectionFingerprintSha256
      },
      validatedEvidenceItems: items.map(itemReference),
      authorityReferences: [...authority.authorityReferences],
      checkedAt: this.now(),
      artifactAccessAuthorized: false,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    });
  }

  private async requireProjection(
    projectionId: TrustEvidenceVisibilityProjectionIdV1
  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1>> {
    const projection = await this.repository.findProjection(projectionId);
    if (!projection) {
      throw new OutcomeTrustEvidenceRuntimeError(
        'PROJECTION_NOT_FOUND',
        404,
        'Trust Evidence visibility projection was not found.'
      );
    }
    return projection;
  }

  private async loadProjectionItems(
    projection: Readonly<TrustEvidenceVisibilityProjectionV1>
  ): Promise<ReadonlyArray<Readonly<TrustEvidenceItemV1>>> {
    const items: Array<Readonly<TrustEvidenceItemV1>> = [];
    for (const reference of projection.evidenceItems) {
      const item = await this.repository.findEvidenceItem(reference);
      if (!item || !sameEvidenceReference(item, reference)) {
        throw new OutcomeTrustEvidenceRuntimeError(
          'EVIDENCE_NOT_FOUND',
          404,
          'Exact Trust Evidence item required by the projection is unavailable.'
        );
      }
      items.push(item);
    }
    return items;
  }
}
