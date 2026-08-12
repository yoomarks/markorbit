import { timingSafeEqual } from 'node:crypto';
import {
  capabilityLearningNoAuthorityConsequences,
  parseInternalWorkspacePrincipal,
  type CapabilityCenterPendingCandidate,
  type CapabilityCenterView,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { PostgresCapabilityObservationLedger } from './capability-observation-ledger.js';
import type { PostgresPrivateReflectionCandidateService } from './private-reflection-candidate.js';
import type { PostgresReflectionDispositionProfileService } from './reflection-disposition-profile.js';

export interface CapabilityCenterRouteOptions {
  internalServiceSecret: string;
  ledger: PostgresCapabilityObservationLedger;
  candidates: PostgresPrivateReflectionCandidateService;
  reflections: PostgresReflectionDispositionProfileService;
  now?: () => string;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function subjectPrincipal(request: JsonRequest, secret: string): WorkspacePrincipal {
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
      'A trusted Core Workspace Principal is required.'
    );
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'PRIVATE_STATE_NOT_FOUND', 'Private Capability state was not found.');
  if (!principal.permissions.includes('workspace:read'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.');
  return principal;
}

export function createCapabilityCenterRoutes(options: CapabilityCenterRouteOptions): JsonRoute[] {
  const now = options.now ?? (() => new Date().toISOString());
  return [
    {
      method: 'GET',
      path: '/internal/v1/capability-center',
      handle: async (request) => {
        const principal = subjectPrincipal(request, options.internalServiceSecret);
        const [ledgerEntries, profiles] = await Promise.all([
          options.ledger.listLedgerForSubject(principal.workspaceId, principal.userId),
          options.reflections.listProfiles(principal)
        ]);
        const pendingCandidates: CapabilityCenterPendingCandidate[] = [];
        for (const profile of profiles) {
          const outstanding = profile.outstandingReflectionCandidate;
          if (!outstanding) continue;
          const current = await options.candidates.findVersion(outstanding.id, outstanding.version);
          if (!current) continue;
          if (
            current.candidate.workspaceId !== principal.workspaceId ||
            current.candidate.subjectUserId !== principal.userId
          )
            throw new HttpError(
              404,
              'PRIVATE_STATE_NOT_FOUND',
              'Private Capability state was not found.'
            );
          pendingCandidates.push({
            candidate: current.candidate,
            candidateFingerprintSha256: current.candidateFingerprintSha256
          });
        }
        const twin = profiles.length ? await options.reflections.getTwin(principal) : undefined;
        const view: CapabilityCenterView = {
          schemaVersion: 1,
          workspaceId: principal.workspaceId,
          subjectUserId: principal.userId,
          ledgerEntries,
          profiles,
          twin: twin ?? null,
          pendingCandidates,
          visibility: 'PRIVATE',
          generatedAt: now(),
          authority: capabilityLearningNoAuthorityConsequences
        };
        return json(200, view);
      }
    }
  ];
}
