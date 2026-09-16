import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { PartnerCandidateIdV1 } from '@markorbit/contracts/partner-intelligence';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  PartnerIntelligenceError,
  type PartnerCandidateStore,
  type PartnerIntelligenceService
} from './partner-intelligence.js';
import { PartnerIntelligenceStoreError } from './partner-intelligence-store.js';

type Body = Record<string, unknown>;
function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured),
    right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
function principalOf(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
  if (
    request.headers['x-markorbit-workspace-id']?.toLowerCase() !==
    principal.workspaceId.toLowerCase()
  )
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  return principal;
}
function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}
function exactBody(body: Body, allowed: readonly string[]) {
  const authority = [
    'workspaceId',
    'actorId',
    'userId',
    'principalId',
    'admittedByPrincipalId',
    'decidedByPrincipalId',
    'confirmedByPrincipalId'
  ].find((field) => body[field] !== undefined);
  if (authority)
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      'Actor identity comes from the authenticated Principal.'
    );
  if (Object.keys(body).some((field) => !allowed.includes(field)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
}
const object = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an object.`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
};
const one = (value: unknown, field: string): 1 => {
  if (value !== 1) throw new HttpError(400, 'INVALID_REQUEST', `${field} must be 1.`);
  return 1;
};
const positive = (value: unknown, field: string): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be positive.`);
  return Number(value);
};
const keyOf = (request: JsonRequest) => {
  const value = request.headers['idempotency-key'];
  if (!value?.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return value.trim();
};
function mapError(error: unknown): never {
  if (error instanceof PartnerIntelligenceError || error instanceof PartnerIntelligenceStoreError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

export function createPartnerIntelligenceRoutes(options: {
  internalServiceSecret: string;
  service: Pick<PartnerIntelligenceService, 'admit' | 'qualify' | 'sendOutreach' | 'recordOutcome'>;
  store: Pick<PartnerCandidateStore, 'findCandidate' | 'findQualification'>;
}): JsonRoute[] {
  const auth = (request: JsonRequest) => principalOf(request, options.internalServiceSecret);
  return [
    {
      method: 'POST',
      path: '/v1/partner-intelligence/candidates',
      handle: async (request) => {
        const principal = auth(request),
          body = bodyOf(request);
        exactBody(body, ['knowledgeReadyPackageId', 'publicEvidenceRefs', 'brief']);
        if (!Array.isArray(body.publicEvidenceRefs))
          throw new HttpError(400, 'INVALID_REQUEST', 'publicEvidenceRefs must be an array.');
        try {
          return json(
            201,
            await options.service.admit({
              principal,
              knowledgeReadyPackageId: text(
                body.knowledgeReadyPackageId,
                'knowledgeReadyPackageId'
              ),
              publicEvidenceRefs: body.publicEvidenceRefs as never,
              brief: object(body.brief, 'brief') as never,
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/partner-intelligence/candidates/:partnerCandidateId',
      handle: async (request) => {
        const principal = auth(request);
        try {
          const value = await options.store.findCandidate(
            principal.workspaceId,
            request.params.partnerCandidateId! as PartnerCandidateIdV1
          );
          if (!value) throw new HttpError(404, 'NOT_FOUND', 'Partner Candidate was not found.');
          return json(200, value);
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/partner-intelligence/candidates/:partnerCandidateId/qualification',
      handle: async (request) => {
        const principal = auth(request),
          body = bodyOf(request);
        exactBody(body, ['candidate', 'outcome', 'rationale']);
        const candidate = object(body.candidate, 'candidate');
        try {
          return json(
            201,
            await options.service.qualify({
              principal,
              candidate: {
                id: request.params.partnerCandidateId! as PartnerCandidateIdV1,
                version: one(candidate.version, 'candidate.version'),
                fingerprintSha256: text(candidate.fingerprintSha256, 'candidate.fingerprintSha256')
              },
              outcome: text(body.outcome, 'outcome') as never,
              rationale: text(body.rationale, 'rationale'),
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/partner-intelligence/candidates/:partnerCandidateId/qualification',
      handle: async (request) => {
        const principal = auth(request);
        try {
          const value = await options.store.findQualification(
            principal.workspaceId,
            request.params.partnerCandidateId! as PartnerCandidateIdV1
          );
          if (!value) throw new HttpError(404, 'NOT_FOUND', 'Partner Qualification was not found.');
          return json(200, value);
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/partner-intelligence/candidates/:partnerCandidateId/outreach',
      handle: async (request) => {
        const principal = auth(request),
          body = bodyOf(request);
        exactBody(body, [
          'candidate',
          'qualificationDecision',
          'endpointFingerprintSha256',
          'policyRef',
          'reviewedSendFingerprintSha256',
          'confirmation',
          'message'
        ]);
        const candidate = object(body.candidate, 'candidate'),
          decision = object(body.qualificationDecision, 'qualificationDecision');
        try {
          return json(
            200,
            await options.service.sendOutreach({
              principal,
              candidate: {
                id: request.params.partnerCandidateId! as PartnerCandidateIdV1,
                version: one(candidate.version, 'candidate.version'),
                fingerprintSha256: text(candidate.fingerprintSha256, 'candidate.fingerprintSha256')
              },
              qualificationDecision: {
                id: text(decision.id, 'qualificationDecision.id'),
                version: one(decision.version, 'qualificationDecision.version'),
                fingerprintSha256: text(
                  decision.fingerprintSha256,
                  'qualificationDecision.fingerprintSha256'
                )
              },
              endpointFingerprintSha256: text(
                body.endpointFingerprintSha256,
                'endpointFingerprintSha256'
              ),
              policyRef: object(body.policyRef, 'policyRef') as never,
              reviewedSendFingerprintSha256: text(
                body.reviewedSendFingerprintSha256,
                'reviewedSendFingerprintSha256'
              ),
              confirmation: object(body.confirmation, 'confirmation') as never,
              message: object(body.message, 'message') as never,
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/partner-intelligence/candidates/:partnerCandidateId/outcome',
      handle: async (request) => {
        const principal = auth(request),
          body = bodyOf(request);
        exactBody(body, [
          'candidate',
          'qualificationDecision',
          'directoryEntry',
          'communicationLink',
          'downstreamRef',
          'confirmation'
        ]);
        const candidate = object(body.candidate, 'candidate'),
          decision = object(body.qualificationDecision, 'qualificationDecision'),
          directory = object(body.directoryEntry, 'directoryEntry'),
          communicationLink = object(body.communicationLink, 'communicationLink');
        try {
          return json(
            201,
            await options.service.recordOutcome({
              principal,
              candidate: {
                id: request.params.partnerCandidateId! as PartnerCandidateIdV1,
                version: one(candidate.version, 'candidate.version'),
                fingerprintSha256: text(candidate.fingerprintSha256, 'candidate.fingerprintSha256')
              },
              qualificationDecision: {
                id: text(decision.id, 'qualificationDecision.id'),
                version: one(decision.version, 'qualificationDecision.version'),
                fingerprintSha256: text(
                  decision.fingerprintSha256,
                  'qualificationDecision.fingerprintSha256'
                )
              },
              directoryEntry: {
                id: text(directory.id, 'directoryEntry.id') as never,
                version: positive(directory.version, 'directoryEntry.version')
              },
              communicationLink: {
                id: text(communicationLink.id, 'communicationLink.id') as never,
                version: positive(communicationLink.version, 'communicationLink.version')
              },
              downstreamRef: object(body.downstreamRef, 'downstreamRef') as never,
              confirmation: object(body.confirmation, 'confirmation') as never,
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
