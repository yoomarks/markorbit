import { timingSafeEqual } from 'node:crypto';
import type { CapabilityObservationSourceReference } from '@markorbit/contracts';
import type { EvidenceReviewDecisionId } from '@markorbit/contracts/evidence-lifecycle';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { ExecutionEvidenceReviewDecisionRecord } from './evidence-review.js';

const SHA256 = /^[0-9a-f]{64}$/;

export interface CapabilityObservationEvidenceReviewReader {
  findDecisionById(
    evidenceReviewDecisionId: EvidenceReviewDecisionId
  ): Promise<ExecutionEvidenceReviewDecisionRecord | undefined>;
}

export interface ExecutionCapabilityObservationSourceRouteOptions {
  internalServiceSecret: string;
  evidenceReviewReader: CapabilityObservationEvidenceReviewReader;
}

export interface GovernedCapabilityObservationSourceAssertion {
  source: Readonly<CapabilityObservationSourceReference>;
  subjectAttributionAuthority: 'OWNER_SOURCE';
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorize(request: JsonRequest, secret: string): void {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
}

function exactFingerprint(value: string | undefined): string {
  const fingerprint = value?.trim().toLowerCase();
  if (!fingerprint || !SHA256.test(fingerprint))
    throw new HttpError(
      400,
      'SOURCE_FINGERPRINT_REQUIRED',
      'An exact lowercase SHA-256 source fingerprint is required.'
    );
  return fingerprint;
}

export function createExecutionCapabilityObservationSourceRoutes(
  options: ExecutionCapabilityObservationSourceRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/v1/capability-observation-sources/evidence-review-decisions/:sourceId/versions/:version',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        const version = Number(request.params.version);
        if (!Number.isInteger(version) || version < 1)
          throw new HttpError(
            400,
            'INVALID_SOURCE_VERSION',
            'Evidence Review Decision version must be a positive integer.'
          );
        const requestedFingerprint = exactFingerprint(
          request.headers['x-source-fingerprint-sha256']
        );
        const decision = await options.evidenceReviewReader.findDecisionById(
          request.params.sourceId! as EvidenceReviewDecisionId
        );
        if (!decision)
          throw new HttpError(
            404,
            'GOVERNED_SOURCE_NOT_FOUND',
            'Execution Evidence Review Decision was not found.'
          );
        if (decision.version !== version)
          throw new HttpError(
            409,
            'SOURCE_VERSION_MISMATCH',
            'Exact Execution Evidence Review Decision version is required.'
          );
        if (decision.decisionFingerprintSha256 !== requestedFingerprint)
          throw new HttpError(
            409,
            'SOURCE_FINGERPRINT_MISMATCH',
            'Execution Evidence Review Decision fingerprint does not match.'
          );
        const source: CapabilityObservationSourceReference = {
          owner: 'EXECUTION',
          kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
          sourceId: decision.evidenceReviewDecisionId,
          sourceVersion: decision.version,
          sourceFingerprintSha256: decision.decisionFingerprintSha256,
          observedAt: decision.reviewedAt,
          workspaceId: decision.workspaceId,
          subjectUserId: String(decision.reviewerPrincipalId),
          correlationId: String(decision.correlationId)
        };
        const result: GovernedCapabilityObservationSourceAssertion = {
          source,
          subjectAttributionAuthority: 'OWNER_SOURCE'
        };
        return json(200, result);
      }
    }
  ];
}
