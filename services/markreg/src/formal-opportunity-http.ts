import { timingSafeEqual } from 'node:crypto';
import type {
  FormalTrademarkServiceOpportunityId,
  OpportunityCandidateId,
  OpportunityQualificationDecisionId
} from '@markorbit/contracts/product-loop';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  FormalOpportunityError,
  type PostgresFormalOpportunityStore,
  type QualifiedOpportunityAuthority,
  type QualifiedOpportunityEvidence
} from './formal-opportunity.js';

type Body = Record<string, unknown>;

export interface MarkRegFormalOpportunityRouteOptions {
  internalServiceSecret: string;
  store: PostgresFormalOpportunityStore;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function workspaceOf(request: JsonRequest, secret: string): string {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  return workspaceId;
}

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function keyOf(request: JsonRequest): string {
  const key = request.headers['idempotency-key'];
  if (!key || !key.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return key.trim();
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${name} is required.`);
  return value.trim();
}

function positive(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${name} must be a positive integer.`);
  return Number(value);
}

function mapError(error: unknown): never {
  if (error instanceof FormalOpportunityError)
    throw new HttpError(
      error.status,
      error.code,
      error.message,
      error.status >= 500,
      error.details
    );
  throw error;
}

export function createMarkRegFormalOpportunityRoutes(
  options: MarkRegFormalOpportunityRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/formal-opportunities',
      handle: async (request) => {
        const workspaceId = workspaceOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        const candidate = body.candidate as Body | undefined;
        const qualificationDecision = body.qualificationDecision as Body | undefined;
        if (!candidate || !qualificationDecision)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'candidate and qualificationDecision are required.'
          );
        try {
          const opportunity = await options.store.createFormalOpportunity({
            workspaceId,
            candidate: {
              id: text(candidate.id, 'candidate.id') as OpportunityCandidateId,
              version: positive(candidate.version, 'candidate.version')
            },
            expectedCandidateFingerprintSha256: text(
              body.expectedCandidateFingerprintSha256,
              'expectedCandidateFingerprintSha256'
            ),
            qualificationDecision: {
              id: text(
                qualificationDecision.id,
                'qualificationDecision.id'
              ) as OpportunityQualificationDecisionId,
              version: positive(qualificationDecision.version, 'qualificationDecision.version')
            },
            relationshipModel: body.relationshipModel as never,
            ...(body.proposedCustomerIntent
              ? { proposedCustomerIntent: body.proposedCustomerIntent as never }
              : {}),
            promotedByPrincipalId: text(body.promotedByPrincipalId, 'promotedByPrincipalId'),
            idempotencyKey: keyOf(request)
          });
          return json(201, { formalOpportunity: opportunity });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/formal-opportunities/:formalOpportunityId/intake-handoff',
      handle: async (request) => {
        const workspaceId = workspaceOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        try {
          const disposition = await options.store.prepareIntakeHandoff({
            workspaceId,
            formalOpportunity: {
              id: request.params.formalOpportunityId! as FormalTrademarkServiceOpportunityId,
              version: positive(body.formalOpportunityVersion, 'formalOpportunityVersion')
            },
            expectedFormalOpportunityFingerprintSha256: text(
              body.expectedFormalOpportunityFingerprintSha256,
              'expectedFormalOpportunityFingerprintSha256'
            ),
            relationshipModel: body.relationshipModel as never,
            customerIntent: body.customerIntent as never,
            confirmedByPrincipalId: text(body.confirmedByPrincipalId, 'confirmedByPrincipalId'),
            idempotencyKey: keyOf(request)
          });
          return json(200, disposition);
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}

export class HttpQualifiedOpportunityAuthority implements QualifiedOpportunityAuthority {
  constructor(
    private readonly liteUrl: string,
    private readonly internalServiceSecret: string
  ) {}

  async resolve(
    workspaceId: string,
    candidate: Readonly<{ id: OpportunityCandidateId; version: number }>,
    qualificationDecision: Readonly<{
      id: OpportunityQualificationDecisionId;
      version: number;
    }>
  ): Promise<Readonly<QualifiedOpportunityEvidence>> {
    let response: Response;
    try {
      response = await fetch(`${this.liteUrl}/internal/v1/qualified-opportunities/resolve`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret,
          'x-markorbit-workspace-id': workspaceId
        },
        body: JSON.stringify({ candidate, qualificationDecision })
      });
    } catch (cause) {
      throw new FormalOpportunityError(
        'DEPENDENCY_UNAVAILABLE',
        'Lite Candidate qualification authority is unavailable.',
        503,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (response.status === 404)
      throw new FormalOpportunityError(
        'STALE_SOURCE',
        'Exact Lite Candidate qualification evidence was not found.'
      );
    if (!response.ok)
      throw new FormalOpportunityError(
        'DEPENDENCY_UNAVAILABLE',
        'Lite Candidate qualification authority is unavailable.',
        503
      );
    return (await response.json()) as QualifiedOpportunityEvidence;
  }
}
