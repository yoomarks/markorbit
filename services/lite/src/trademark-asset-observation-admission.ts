import { createHash } from 'node:crypto';
import {
  trademarkAssetObservedFactKinds,
  type TrademarkAssetObservedFactKind,
  type TrademarkAssetObservedFactValue
} from '@markorbit/contracts/trademark-asset-composition';
import {
  isTrademarkAssetSourceOwnerKindPair,
  trademarkAssetFreshnessStates,
  type TrademarkAssetId,
  type TrademarkAssetSourceOwner,
  type TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';
import type { TrademarkAssetFactContribution } from './trademark-asset-view.js';

export const trademarkAssetSourceReadStates = [
  'OBSERVED',
  'EMPTY',
  'NOT_OBSERVED',
  'NOT_COVERED',
  'UNAVAILABLE'
] as const;
export type TrademarkAssetSourceReadState = (typeof trademarkAssetSourceReadStates)[number];

export interface TrademarkAssetSourceScopeReadV1 {
  owner: TrademarkAssetSourceOwner;
  state: TrademarkAssetSourceReadState;
}
export const trademarkAssetAdmissionClaimClasses = [
  'COMMUNICATION_CLAIM',
  'WORKSPACE_USER_CONFIRMATION'
] as const;
export type TrademarkAssetAdmissionClaimClass =
  (typeof trademarkAssetAdmissionClaimClasses)[number];

export interface TrademarkAssetAdmissionCandidateReferenceV1 {
  kind: 'MANAGED_AI_CANDIDATE' | 'DETERMINISTIC_CANDIDATE';
  referenceId: string;
  referenceVersion?: string;
  referenceFingerprintSha256?: string;
}

export interface CommunicationClaimAdmissionInputV1 {
  claimClass: 'COMMUNICATION_CLAIM';
  claimId: string;
  factKind: TrademarkAssetObservedFactKind;
  value: TrademarkAssetObservedFactValue;
  source: Readonly<TrademarkAssetSourceReference>;
  consequential?: boolean;
  reviewedByPrincipalId: string;
  reviewedAt: string;
  candidateReference?: Readonly<TrademarkAssetAdmissionCandidateReferenceV1>;
}
export interface WorkspaceUserConfirmationAdmissionInputV1 {
  claimClass: 'WORKSPACE_USER_CONFIRMATION';
  claimId: string;
  factKind: TrademarkAssetObservedFactKind;
  value: TrademarkAssetObservedFactValue;
  consequential?: boolean;
  confirmedByPrincipalId: string;
  confirmedAt: string;
}

export type TrademarkAssetClaimAdmissionInputV1 =
  CommunicationClaimAdmissionInputV1 | WorkspaceUserConfirmationAdmissionInputV1;

export interface TrademarkAssetAdmittedClaimV1 {
  schemaVersion: 1;
  claimId: string;
  claimClass: TrademarkAssetAdmissionClaimClass;
  factKind: TrademarkAssetObservedFactKind;
  value: TrademarkAssetObservedFactValue;
  source: Readonly<TrademarkAssetSourceReference>;
  consequential: boolean;
  humanAction: Readonly<{
    kind: 'COMMUNICATION_REVIEW' | 'WORKSPACE_CONFIRMATION';
    principalId: string;
    occurredAt: string;
  }>;
  candidateReference?: Readonly<TrademarkAssetAdmissionCandidateReferenceV1>;
  admissionFingerprintSha256: string;
  officialTruthVerifiedByLite: false;
  customerInstructionEstablished: false;
  legalConclusionCreated: false;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const clone = <T>(value: T): T => structuredClone(value);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function cleanText(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new TypeError(`${field} must be a non-empty string of at most ${maximum} characters.`);
  }
  return value.trim();
}

function cleanIso(value: unknown, field: string): string {
  const text = cleanText(value, field, 100);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be an ISO timestamp.`);
  return parsed.toISOString();
}

function cleanValue(value: TrademarkAssetObservedFactValue): TrademarkAssetObservedFactValue {
  if (typeof value === 'string') return cleanText(value, 'claim.value', 2_000);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('claim.value number must be finite.');
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (!Array.isArray(value) || value.length > 100) {
    throw new TypeError('claim.value array must contain at most 100 strings.');
  }
  return value.map((item) => cleanText(item, 'claim.value[]', 500));
}

function cleanFactKind(value: TrademarkAssetObservedFactKind): TrademarkAssetObservedFactKind {
  if (!trademarkAssetObservedFactKinds.includes(value))
    throw new TypeError('claim.factKind is invalid.');
  return value;
}
function cleanSource(
  source: Readonly<TrademarkAssetSourceReference>
): TrademarkAssetSourceReference {
  if (!isTrademarkAssetSourceOwnerKindPair(source.owner, source.kind)) {
    throw new TypeError(`Source owner ${source.owner} cannot use source kind ${source.kind}.`);
  }
  const sourceId = cleanText(source.sourceId, 'claim.source.sourceId');
  const sourceVersion = cleanText(source.sourceVersion, 'claim.source.sourceVersion', 300);
  if (!trademarkAssetFreshnessStates.includes(source.freshness)) {
    throw new TypeError('claim.source.freshness is invalid.');
  }
  if (source.sourceFingerprintSha256 && !SHA256.test(source.sourceFingerprintSha256)) {
    throw new TypeError('claim.source.sourceFingerprintSha256 must be lowercase SHA-256.');
  }
  return {
    owner: source.owner,
    kind: source.kind,
    sourceId,
    sourceVersion,
    ...(source.sourceFingerprintSha256
      ? { sourceFingerprintSha256: source.sourceFingerprintSha256 }
      : {}),
    observedAt: cleanIso(source.observedAt, 'claim.source.observedAt'),
    freshness: source.freshness
  };
}

function cleanCandidate(
  candidate: Readonly<TrademarkAssetAdmissionCandidateReferenceV1> | undefined
): TrademarkAssetAdmissionCandidateReferenceV1 | undefined {
  if (!candidate) return undefined;
  if (!['MANAGED_AI_CANDIDATE', 'DETERMINISTIC_CANDIDATE'].includes(candidate.kind)) {
    throw new TypeError('candidateReference.kind is invalid.');
  }
  const referenceId = cleanText(candidate.referenceId, 'candidateReference.referenceId');
  const referenceVersion = candidate.referenceVersion?.trim();
  if (referenceVersion !== undefined && (!referenceVersion || referenceVersion.length > 300)) {
    throw new TypeError('candidateReference.referenceVersion is invalid.');
  }
  if (
    candidate.referenceFingerprintSha256 !== undefined &&
    !SHA256.test(candidate.referenceFingerprintSha256)
  ) {
    throw new TypeError('candidateReference.referenceFingerprintSha256 must be lowercase SHA-256.');
  }
  return {
    kind: candidate.kind,
    referenceId,
    ...(referenceVersion === undefined ? {} : { referenceVersion }),
    ...(candidate.referenceFingerprintSha256 === undefined
      ? {}
      : { referenceFingerprintSha256: candidate.referenceFingerprintSha256 })
  };
}

function workspaceConfirmationSource(
  workspaceId: string,
  trademarkAssetId: TrademarkAssetId,
  claimId: string,
  factKind: TrademarkAssetObservedFactKind,
  value: TrademarkAssetObservedFactValue,
  principalId: string,
  confirmedAt: string
): TrademarkAssetSourceReference {
  const exact = {
    workspaceId,
    trademarkAssetId,
    claimId,
    factKind,
    value,
    principalId,
    confirmedAt
  };
  return {
    owner: 'WORKSPACE_USER',
    kind: 'WORKSPACE_CONFIRMATION',
    sourceId: `workspace-confirmation:${claimId}`,
    sourceVersion: '1',
    sourceFingerprintSha256: fingerprint(exact),
    observedAt: confirmedAt,
    freshness: 'CURRENT'
  };
}

export function materializeTrademarkAssetAdmittedClaimsV1(input: {
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  claims?: ReadonlyArray<Readonly<TrademarkAssetClaimAdmissionInputV1>>;
}): readonly TrademarkAssetAdmittedClaimV1[] {
  const seen = new Set<string>();
  const claims = (input.claims ?? []).map((raw) => {
    const claimId = cleanText(raw.claimId, 'claim.claimId', 240);
    if (seen.has(claimId)) throw new TypeError(`Duplicate admitted claimId ${claimId}.`);
    seen.add(claimId);
    const factKind = cleanFactKind(raw.factKind);
    const value = cleanValue(raw.value);
    if (raw.claimClass === 'COMMUNICATION_CLAIM') {
      const source = cleanSource(raw.source);
      if (
        source.owner !== 'MANAGED_COMMUNICATION' ||
        source.kind !== 'MANAGED_COMMUNICATION_MESSAGE'
      ) {
        throw new TypeError(
          'Communication claims require exact Managed Communication message evidence.'
        );
      }
      const principalId = cleanText(raw.reviewedByPrincipalId, 'claim.reviewedByPrincipalId', 240);
      const occurredAt = cleanIso(raw.reviewedAt, 'claim.reviewedAt');
      const candidateReference = cleanCandidate(raw.candidateReference);
      const exact = {
        claimId,
        claimClass: raw.claimClass,
        factKind,
        value,
        source,
        consequential: raw.consequential ?? false,
        humanAction: { kind: 'COMMUNICATION_REVIEW' as const, principalId, occurredAt }
      };
      return {
        schemaVersion: 1 as const,
        ...exact,
        ...(candidateReference === undefined ? {} : { candidateReference }),
        admissionFingerprintSha256: fingerprint({
          ...exact,
          candidateReference: candidateReference ?? null
        }),
        officialTruthVerifiedByLite: false as const,
        customerInstructionEstablished: false as const,
        legalConclusionCreated: false as const
      };
    }
    if (raw.claimClass !== 'WORKSPACE_USER_CONFIRMATION') {
      throw new TypeError('Unsupported admitted claim class.');
    }
    const principalId = cleanText(raw.confirmedByPrincipalId, 'claim.confirmedByPrincipalId', 240);
    const occurredAt = cleanIso(raw.confirmedAt, 'claim.confirmedAt');
    const source = workspaceConfirmationSource(
      input.workspaceId,
      input.trademarkAssetId,
      claimId,
      factKind,
      value,
      principalId,
      occurredAt
    );
    const exact = {
      claimId,
      claimClass: raw.claimClass,
      factKind,
      value,
      source,
      consequential: raw.consequential ?? false,
      humanAction: { kind: 'WORKSPACE_CONFIRMATION' as const, principalId, occurredAt }
    };
    return {
      schemaVersion: 1 as const,
      ...exact,
      admissionFingerprintSha256: fingerprint(exact),
      officialTruthVerifiedByLite: false as const,
      customerInstructionEstablished: false as const,
      legalConclusionCreated: false as const
    };
  });
  return claims.sort((a, b) => a.claimId.localeCompare(b.claimId));
}
export function materializeTrademarkAssetSourceReadStatesV1(input: {
  scope: readonly TrademarkAssetSourceOwner[];
  observations: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  readStates?: ReadonlyArray<Readonly<TrademarkAssetSourceScopeReadV1>>;
}): readonly TrademarkAssetSourceScopeReadV1[] {
  const counts = new Map<TrademarkAssetSourceOwner, number>();
  for (const owner of input.scope) counts.set(owner, 0);
  for (const source of input.observations) {
    counts.set(source.owner, (counts.get(source.owner) ?? 0) + 1);
  }
  if (input.readStates === undefined) {
    return [...input.scope]
      .sort()
      .map((owner) => ({ owner, state: (counts.get(owner) ?? 0) > 0 ? 'OBSERVED' : 'EMPTY' }));
  }
  const byOwner = new Map<TrademarkAssetSourceOwner, TrademarkAssetSourceReadState>();
  for (const entry of input.readStates) {
    if (!input.scope.includes(entry.owner))
      throw new TypeError('Read-state owner must be in sourceOwnerScope.');
    if (!trademarkAssetSourceReadStates.includes(entry.state))
      throw new TypeError('Source read state is invalid.');
    if (byOwner.has(entry.owner))
      throw new TypeError(`Duplicate source read state for ${entry.owner}.`);
    byOwner.set(entry.owner, entry.state);
  }
  if (byOwner.size !== input.scope.length) {
    throw new TypeError(
      'Explicit source read states must cover every source owner in scope exactly once.'
    );
  }
  const result = [...byOwner.entries()]
    .map(([owner, state]) => ({ owner, state }))
    .sort((a, b) => a.owner.localeCompare(b.owner));
  for (const entry of result) {
    const count = counts.get(entry.owner) ?? 0;
    if (entry.state === 'OBSERVED' && count === 0) {
      throw new TypeError(
        `OBSERVED read state for ${entry.owner} requires at least one observation.`
      );
    }
    if (entry.state !== 'OBSERVED' && count > 0) {
      throw new TypeError(
        `${entry.state} read state for ${entry.owner} cannot carry observations.`
      );
    }
  }
  return result;
}

export function isCompleteTrademarkAssetSourceReadState(
  state: TrademarkAssetSourceReadState
): boolean {
  return state === 'OBSERVED' || state === 'EMPTY';
}

export function factContributionsFromAdmittedClaims(
  claims: readonly Readonly<TrademarkAssetAdmittedClaimV1>[]
): readonly TrademarkAssetFactContribution[] {
  return claims.map((claim) => ({
    kind: claim.factKind,
    value: clone(claim.value),
    source: clone(claim.source),
    consequential: claim.consequential,
    admission: {
      claimClass: claim.claimClass,
      admissionFingerprintSha256: claim.admissionFingerprintSha256
    }
  }));
}
