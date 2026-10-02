import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  WorkspacePrivateCaseEvidenceError,
  type DecideWorkspacePrivateCaseEvidenceRequest,
  type ReadWorkspacePrivateCaseEvidenceRequest,
  type SuggestWorkspacePrivateCaseEvidenceRequest,
  type WorkspacePrivateCaseEvidenceService
} from './workspace-private-case-evidence.js';

export interface WorkspacePrivateCaseEvidenceHttpOptions {
  internalServiceSecret: string;
  service: Pick<
    WorkspacePrivateCaseEvidenceService,
    'suggest' | 'decide' | 'readGrant' | 'listAccepted'
  >;
}

function principalFor(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!validateInternalServiceSecret(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Trusted internal service authorization is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
  const assertedWorkspaceId = request.headers['x-markorbit-workspace-id'];
  if (
    !assertedWorkspaceId ||
    assertedWorkspaceId.toLowerCase() !== principal.workspaceId.toLowerCase()
  )
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  return principal;
}

function recordBody(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'Request body must be an object.'
    );
  return request.body as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'Request contains unsupported fields.'
    );
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      `${field} must be an array of strings.`
    );
  return value as string[];
}

const suggestFields = [
  'idempotencyKey',
  'formalMatterId',
  'expectedFormalMatterVersion',
  'expectedFormalMatterSnapshotSha256',
  'readyPackageId',
  'expectedKnowledgeWorkspaceId',
  'expectedReadyPackageDigest',
  'expectedCoreIntakeId',
  'expectedContentExportSha256',
  'expectedStagingDocumentId',
  'expectedStagingSha256',
  'expectedRawArtifactId',
  'expectedRawArtifactSha256',
  'sourceLocators',
  'methodProvenanceRefs'
] as const;

function suggestRequest(request: JsonRequest): SuggestWorkspacePrivateCaseEvidenceRequest {
  const value = recordBody(request);
  exactKeys(value, suggestFields);
  const stringFields = suggestFields.filter(
    (field) =>
      !['expectedFormalMatterVersion', 'sourceLocators', 'methodProvenanceRefs'].includes(field)
  );
  if (stringFields.some((field) => typeof value[field] !== 'string'))
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'Exact Case and Knowledge evidence string references are required.'
    );
  if (typeof value.expectedFormalMatterVersion !== 'number')
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'expectedFormalMatterVersion must be a number.'
    );
  return {
    idempotencyKey: value.idempotencyKey as string,
    formalMatterId: value.formalMatterId as string,
    expectedFormalMatterVersion: value.expectedFormalMatterVersion,
    expectedFormalMatterSnapshotSha256: value.expectedFormalMatterSnapshotSha256 as string,
    readyPackageId: value.readyPackageId as string,
    expectedKnowledgeWorkspaceId: value.expectedKnowledgeWorkspaceId as string,
    expectedReadyPackageDigest: value.expectedReadyPackageDigest as string,
    expectedCoreIntakeId: value.expectedCoreIntakeId as string,
    expectedContentExportSha256: value.expectedContentExportSha256 as string,
    expectedStagingDocumentId: value.expectedStagingDocumentId as string,
    expectedStagingSha256: value.expectedStagingSha256 as string,
    expectedRawArtifactId: value.expectedRawArtifactId as string,
    expectedRawArtifactSha256: value.expectedRawArtifactSha256 as string,
    sourceLocators: stringArray(value.sourceLocators, 'sourceLocators'),
    methodProvenanceRefs: stringArray(value.methodProvenanceRefs, 'methodProvenanceRefs')
  };
}

function decisionRequest(request: JsonRequest): DecideWorkspacePrivateCaseEvidenceRequest {
  const value = recordBody(request);
  exactKeys(value, ['expectedVersion', 'idempotencyKey', 'decision']);
  if (
    typeof value.expectedVersion !== 'number' ||
    typeof value.idempotencyKey !== 'string' ||
    (value.decision !== 'ACCEPT' && value.decision !== 'REJECT')
  )
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'expectedVersion, idempotencyKey and ACCEPT/REJECT decision are required.'
    );
  return {
    bindingId: request.params.bindingId!,
    expectedVersion: value.expectedVersion,
    idempotencyKey: value.idempotencyKey,
    decision: value.decision
  };
}

function readRequest(request: JsonRequest): ReadWorkspacePrivateCaseEvidenceRequest {
  const value = recordBody(request);
  exactKeys(value, ['expectedVersion']);
  if (typeof value.expectedVersion !== 'number')
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'expectedVersion is required.'
    );
  return { bindingId: request.params.bindingId!, expectedVersion: value.expectedVersion };
}

function translate(error: unknown): never {
  if (error instanceof WorkspacePrivateCaseEvidenceError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createWorkspacePrivateCaseEvidenceRoutes(
  options: WorkspacePrivateCaseEvidenceHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/v1/workspace-private-case-evidence/cases/:formalMatterId',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(
            200,
            await options.service.listAccepted(principal, request.params.formalMatterId ?? '')
          );
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/workspace-private-case-evidence/suggestions',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, await options.service.suggest(principal, suggestRequest(request)));
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/workspace-private-case-evidence/:bindingId/decisions',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, await options.service.decide(principal, decisionRequest(request)));
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/workspace-private-case-evidence/:bindingId/read-grants',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, await options.service.readGrant(principal, readRequest(request)));
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
