import { createHash, randomUUID } from 'node:crypto';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- HTTP request bodies are validated by the domain service and return typed errors. */
import {
  parseExecutionCreateCommand,
  parseInternalWorkspacePrincipal,
  encodeInternalWorkspacePrincipal,
  type EventEnvelope,
  type ExecutionCreateCommand,
  type ExecutionRecord,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { InMemoryEventPublisher, type EventPublisher } from '@markorbit/events';
import { createServiceRuntime, HttpError, json, type JsonResult } from '@markorbit/service-kit';
import type {
  MatterDraft,
  FormalMatter,
  MatterDraftId,
  MatterDraftReviewSnapshot,
  ProfessionalReviewCaseId,
  PreparationLock,
  PreparationLockId,
  FilingAuthorizationId,
  ExecutionReleaseId,
  FilingExecutionTaskDraftId
} from '@markorbit/contracts';
import {
  InMemoryProfessionalReviewRepository,
  ProfessionalReviewError,
  ProfessionalReviewService,
  type MatterDraftReviewSource,
  type ProfessionalReviewRepository
} from './professional-review.js';
export * from './professional-review.js';
export * from './professional-review-postgres.js';
import {
  FilingGovernanceError,
  FilingGovernanceService,
  InMemoryFilingGovernanceRepository,
  type PreparationLockSource,
  type FilingAuthorizationRepository,
  type ExecutionReleaseRepository,
  type FilingExecutionTaskDraftRepository,
  type FilingGovernanceAuditRepository
} from './filing-authorization.js';
export * from './filing-authorization.js';
export * from './filing-authorization-postgres.js';
export const serviceManifest = Object.freeze({
  name: 'execution',
  port: Number(process.env.PORT ?? '4104'),
  version: '0.1.0'
});
interface Entry {
  fingerprint: string;
  record: ExecutionRecord;
}
export class InMemoryExecutionRepository {
  private readonly entries = new Map<string, Entry>();
  get size() {
    return this.entries.size;
  }
  get(key: string) {
    return this.entries.get(key);
  }
  save(key: string, entry: Entry) {
    this.entries.set(key, entry);
  }
}
export interface ExecutionOptions {
  port?: number;
  repository?: InMemoryExecutionRepository;
  publisher?: EventPublisher;
  now?: () => string;
  reviewRepository?: InMemoryProfessionalReviewRepository;
  reviewRepositoryFactory?: (workspaceId: string) => ProfessionalReviewRepository;
  internalServiceSecret?: string;
  matterDraftSource?: MatterDraftReviewSource;
  markRegUrl?: string;
  filingRepository?: InMemoryFilingGovernanceRepository;
  filingRepositoryFactory?: (
    workspaceId: string,
    actorId: string,
    correlationId?: string
  ) => FilingGovernanceAuditRepository;
  preparationLockSource?: PreparationLockSource;
  milestoneTestRuntime?: boolean;
}
export function createRuntime(options: ExecutionOptions = {}) {
  const repository = options.repository ?? new InMemoryExecutionRepository();
  const publisher = options.publisher ?? new InMemoryEventPublisher();
  const now = options.now ?? (() => new Date().toISOString());
  const matterDraftSource =
    options.matterDraftSource ??
    httpMatterDraftSource(options.markRegUrl ?? process.env.MARKREG_URL ?? 'http://127.0.0.1:4105');
  const review = new ProfessionalReviewService(
    options.reviewRepository ?? new InMemoryProfessionalReviewRepository(),
    matterDraftSource,
    now
  );
  const reviewPrincipal = (
    request: { headers: Record<string, string | undefined> },
    perform = false
  ) => {
    if (!options.reviewRepositoryFactory) return undefined;
    const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
    if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
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
    const permission = perform ? 'review:perform' : 'review:read';
    if (!principal.permissions.includes(permission))
      throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
    return principal;
  };
  const reviewFor = (request: { headers: Record<string, string | undefined> }, perform = false) => {
    if (!options.reviewRepositoryFactory) return review;
    const principal = reviewPrincipal(request, perform)!;
    const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET!;
    return new ProfessionalReviewService(
      options.reviewRepositoryFactory(principal.workspaceId),
      httpFormalMatterReviewSource(
        options.markRegUrl ?? process.env.MARKREG_URL ?? 'http://127.0.0.1:4105',
        principal,
        secret
      ),
      now
    );
  };
  const filingRepository = options.filingRepository ?? new InMemoryFilingGovernanceRepository();
  const legacyFiling = new FilingGovernanceService(
    filingRepository as unknown as FilingAuthorizationRepository,
    filingRepository as unknown as ExecutionReleaseRepository,
    filingRepository as unknown as FilingExecutionTaskDraftRepository,
    options.preparationLockSource ??
      httpPreparationLockSource(
        options.markRegUrl ?? process.env.MARKREG_URL ?? 'http://127.0.0.1:4105'
      ),
    now
  );
  const filingTarget = (request: {
    path: string;
    params: Record<string, string>;
  }): {
    targetType: 'FILING_AUTHORIZATION' | 'EXECUTION_RELEASE' | 'FILING_EXECUTION_TASK_DRAFT';
    targetId?: string;
  } => {
    const targetId = Object.values(request.params)[0];
    if (request.path.includes('filing-task-drafts'))
      return { targetType: 'FILING_EXECUTION_TASK_DRAFT', ...(targetId ? { targetId } : {}) };
    if (request.path.includes('filing-authorizations'))
      return { targetType: 'FILING_AUTHORIZATION', ...(targetId ? { targetId } : {}) };
    return { targetType: 'EXECUTION_RELEASE', ...(targetId ? { targetId } : {}) };
  };
  const filingFor = async (
    request: {
      method: string;
      path: string;
      params: Record<string, string>;
      body?: unknown;
      headers: Record<string, string | undefined>;
    },
    perform: boolean
  ) => {
    if (!options.filingRepositoryFactory)
      return { service: legacyFiling, principal: undefined as WorkspacePrincipal | undefined };
    const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
    if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
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
    const adapter = options.filingRepositoryFactory(
      principal.workspaceId,
      principal.userId,
      request.headers['x-correlation-id']
    );
    const audit = adapter as FilingGovernanceAuditRepository;
    const deny = async (reasonCode: string) => {
      const body = request.body ?? null;
      await audit.recordDenial({
        ...filingTarget(request),
        action: `${request.method} ${request.path}`,
        actorId: principal.userId,
        reasonCode,
        ...(request.headers['x-correlation-id']
          ? { correlationId: request.headers['x-correlation-id'] }
          : {}),
        sourceFingerprint: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
        createdAt: now()
      });
    };
    const headerWorkspace = request.headers['x-markorbit-workspace-id'];
    const bodyWorkspace =
      request.body &&
      typeof request.body === 'object' &&
      'workspaceId' in request.body &&
      typeof (request.body as { workspaceId?: unknown }).workspaceId === 'string'
        ? (request.body as { workspaceId: string }).workspaceId
        : undefined;
    if (
      (headerWorkspace && headerWorkspace !== principal.workspaceId) ||
      (bodyWorkspace && bodyWorkspace !== principal.workspaceId)
    ) {
      await deny('WORKSPACE_MISMATCH');
      throw new HttpError(
        404,
        'WORKSPACE_MISMATCH',
        'Workspace-scoped execution record was not found.'
      );
    }
    const permission = perform ? 'execution:manage' : 'execution:read';
    if (!principal.permissions.includes(permission)) {
      await deny('PERMISSION_DENIED');
      throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
    }
    const service = new FilingGovernanceService(
      adapter as unknown as FilingAuthorizationRepository,
      adapter as unknown as ExecutionReleaseRepository,
      adapter as unknown as FilingExecutionTaskDraftRepository,
      options.preparationLockSource ??
        httpPreparationLockSource(
          options.markRegUrl ?? process.env.MARKREG_URL ?? 'http://127.0.0.1:4105',
          principal,
          secret
        ),
      now
    );
    return { service, principal };
  };
  const filingCall = async (
    request: {
      method: string;
      path: string;
      params: Record<string, string>;
      body?: unknown;
      headers: Record<string, string | undefined>;
    },
    perform: boolean,
    work: (service: FilingGovernanceService, principal?: WorkspacePrincipal) => Promise<unknown>,
    name = 'filingAuthorization'
  ) => {
    try {
      const { service, principal } = await filingFor(request, perform);
      return json(200, {
        [name]: await work(service, principal),
        consequences: service.consequences
      });
    } catch (error) {
      if (error instanceof FilingGovernanceError)
        throw new HttpError(error.status, error.code, error.message, false, error.details);
      throw error;
    }
  };
  const mutation = async (work: () => Promise<unknown>) => {
    try {
      return json(200, {
        reviewCase: await work(),
        consequences: {
          orderCreated: false,
          paymentCreated: false,
          formalMatterCreated: false,
          providerAppointed: false,
          filingCreated: false,
          customerMessageSent: false
        }
      });
    } catch (error) {
      if (error instanceof ProfessionalReviewError)
        throw new HttpError(error.status, error.code, error.message, false, error.details);
      throw error;
    }
  };
  const inFlight = new Map<string, { fingerprint: string; result: Promise<JsonResult> }>();
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        ...((options.milestoneTestRuntime ?? process.env.MO_MILESTONE_TEST_RUNTIME === '1')
          ? [
              {
                method: 'GET' as const,
                path: '/__milestone/scenario-records',
                handle: async () =>
                  json(200, {
                    professionalReviewCases: await review.list(),
                    ...(await filingRepository.snapshot())
                  })
              }
            ]
          : []),
        {
          method: 'POST',
          path: '/v1/filing-task-drafts/:filingExecutionTaskDraftId/validate-current',
          handle: (r) =>
            filingCall(
              r,
              true,
              (service) =>
                service.validateTaskCurrent(
                  r.params.filingExecutionTaskDraftId as FilingExecutionTaskDraftId
                ),
              'filingExecutionTaskDraft'
            )
        },
        {
          method: 'POST',
          path: '/v1/filing-authorizations',
          handle: (r) =>
            filingCall(r, true, (service) => {
              const body = r.body as any;
              return service.createAuthorization({
                preparationLockId: body.preparationLockId,
                preparationLockVersion: body.preparationLockVersion,
                authorizedParty: body.authorizedParty,
                authorizationCapacity: body.authorizationCapacity,
                executionChannel: body.executionChannel,
                ...(body.expiresAt ? { expiresAt: body.expiresAt } : {}),
                idempotencyKey: r.headers['idempotency-key'] ?? ''
              });
            })
        },
        {
          method: 'GET',
          path: '/v1/filing-authorizations/:filingAuthorizationId',
          handle: (r) =>
            filingCall(r, false, (service) =>
              service.getAuthorization(r.params.filingAuthorizationId as FilingAuthorizationId)
            )
        },
        {
          method: 'POST',
          path: '/v1/filing-authorizations/:filingAuthorizationId/confirm',
          handle: (r) =>
            filingCall(r, true, (service, principal) => {
              const body = r.body as any;
              return service.confirmAuthorization(
                r.params.filingAuthorizationId as FilingAuthorizationId,
                {
                  acknowledgementCodes: body.acknowledgementCodes,
                  acknowledgedBy: principal?.userId ?? body.acknowledgedBy,
                  idempotencyKey: r.headers['idempotency-key'] ?? ''
                }
              );
            })
        },
        {
          method: 'POST',
          path: '/v1/filing-authorizations/:filingAuthorizationId/withdraw',
          handle: (r) =>
            filingCall(r, true, (service) =>
              service.withdrawAuthorization(r.params.filingAuthorizationId as FilingAuthorizationId)
            )
        },
        {
          method: 'POST',
          path: '/v1/execution-releases',
          handle: (r) =>
            filingCall(
              r,
              true,
              (service) => {
                const body = r.body as any;
                return service.createRelease({
                  filingAuthorizationId: body.filingAuthorizationId,
                  filingAuthorizationVersion: body.filingAuthorizationVersion,
                  requestedExecutionChannel: body.requestedExecutionChannel,
                  idempotencyKey: r.headers['idempotency-key'] ?? ''
                });
              },
              'executionRelease'
            )
        },
        {
          method: 'GET',
          path: '/v1/execution-releases',
          handle: (r) =>
            filingCall(r, false, (service) => service.listReleases(), 'executionReleases')
        },
        {
          method: 'GET',
          path: '/v1/execution-releases/:executionReleaseId',
          handle: (r) =>
            filingCall(
              r,
              false,
              (service) => service.getRelease(r.params.executionReleaseId as ExecutionReleaseId),
              'executionRelease'
            )
        },
        {
          method: 'POST',
          path: '/v1/execution-releases/:executionReleaseId/evaluate',
          handle: (r) =>
            filingCall(
              r,
              true,
              (service) => service.evaluate(r.params.executionReleaseId as ExecutionReleaseId),
              'executionRelease'
            )
        },
        {
          method: 'PATCH',
          path: '/v1/execution-releases/:executionReleaseId/assignment',
          handle: (r) =>
            filingCall(
              r,
              true,
              (service) =>
                service.assign(
                  r.params.executionReleaseId as ExecutionReleaseId,
                  { internalExecutorId: (r.body as any).internalExecutorId },
                  (r.body as any).expectedVersion
                ),
              'executionRelease'
            )
        },
        {
          method: 'POST',
          path: '/v1/execution-releases/:executionReleaseId/release',
          handle: (r) =>
            filingCall(
              r,
              true,
              (service, principal) => {
                const body = r.body as any;
                return service.release(r.params.executionReleaseId as ExecutionReleaseId, {
                  decidedBy: principal?.userId ?? body.decidedBy,
                  rationale: body.rationale,
                  idempotencyKey: r.headers['idempotency-key'] ?? ''
                });
              },
              'releaseResult'
            )
        },
        {
          method: 'POST',
          path: '/v1/execution-releases/:executionReleaseId/withdraw',
          handle: (r) =>
            filingCall(
              r,
              true,
              (service) =>
                service.withdrawRelease(r.params.executionReleaseId as ExecutionReleaseId),
              'executionRelease'
            )
        },
        {
          method: 'GET',
          path: '/v1/filing-task-drafts/:filingExecutionTaskDraftId',
          handle: (r) =>
            filingCall(
              r,
              false,
              (service) =>
                service.getTask(r.params.filingExecutionTaskDraftId as FilingExecutionTaskDraftId),
              'filingExecutionTaskDraft'
            )
        },
        {
          method: 'GET',
          path: '/v1/execution-releases/:executionReleaseId/filing-task-draft',
          handle: (r) =>
            filingCall(
              r,
              false,
              (service) =>
                service.getTaskForRelease(r.params.executionReleaseId as ExecutionReleaseId),
              'filingExecutionTaskDraft'
            )
        },
        {
          method: 'POST',
          path: '/v1/professional-review-cases',
          handle: async (r) =>
            mutation(() => {
              const principal = reviewPrincipal(r, true);
              const body = r.body as any;
              if (
                options.reviewRepositoryFactory &&
                (!body.formalMatterId ||
                  !Number.isSafeInteger(body.sourceFormalMatterVersion) ||
                  typeof body.sourceSnapshotSha256 !== 'string' ||
                  !/^[0-9a-f]{64}$/.test(body.sourceSnapshotSha256))
              )
                throw new ProfessionalReviewError(
                  'INVALID_REVIEW_EVIDENCE',
                  'Exact Formal Matter identity, version, and hash are required.',
                  422
                );
              return reviewFor(r, true).create({
                ...body,
                ...(principal
                  ? { workspaceId: principal.workspaceId, requestedBy: principal.userId }
                  : {}),
                idempotencyKey: r.headers['idempotency-key'] ?? ''
              });
            })
        },
        {
          method: 'GET',
          path: '/v1/professional-review-cases',
          handle: async (r) => json(200, { reviewCases: await reviewFor(r).list() })
        },
        {
          method: 'GET',
          path: '/v1/professional-review-cases/:reviewCaseId',
          handle: async (r) => {
            try {
              return json(200, {
                reviewCase: await reviewFor(r).get(
                  r.params.reviewCaseId as ProfessionalReviewCaseId
                )
              });
            } catch (e) {
              if (e instanceof ProfessionalReviewError)
                throw new HttpError(e.status, e.code, e.message, false, e.details);
              throw e;
            }
          }
        },
        {
          method: 'POST',
          path: '/v1/professional-review-cases/:reviewCaseId/claim',
          handle: (r) =>
            mutation(() => {
              const principal = reviewPrincipal(r, true);
              return reviewFor(r, true).claim(
                r.params.reviewCaseId as ProfessionalReviewCaseId,
                principal?.userId ?? (r.body as any).reviewerId,
                (r.body as any).expectedVersion
              );
            })
        },
        {
          method: 'PATCH',
          path: '/v1/professional-review-cases/:reviewCaseId/checklist',
          handle: (r) =>
            mutation(() => {
              const principal = reviewPrincipal(r, true);
              return reviewFor(r, true).updateChecklist(
                r.params.reviewCaseId as ProfessionalReviewCaseId,
                principal?.userId ?? (r.body as any).reviewerId,
                (r.body as any).updates,
                (r.body as any).expectedVersion
              );
            })
        },
        {
          method: 'POST',
          path: '/v1/professional-review-cases/:reviewCaseId/request-information',
          handle: (r) =>
            mutation(() =>
              reviewFor(r, true).requestInformation(
                r.params.reviewCaseId as ProfessionalReviewCaseId,
                reviewPrincipal(r, true)?.userId ?? (r.body as any).reviewerId,
                {
                  requestedFields: (r.body as any).requestedFields,
                  reason: (r.body as any).reason,
                  reviewerNote: (r.body as any).reviewerNote
                },
                (r.body as any).expectedVersion
              )
            )
        },
        {
          method: 'POST',
          path: '/v1/professional-review-cases/:reviewCaseId/complete',
          handle: (r) =>
            mutation(() => {
              const principal = reviewPrincipal(r, true);
              return reviewFor(r, true).complete(
                r.params.reviewCaseId as ProfessionalReviewCaseId,
                principal?.userId ?? (r.body as any).reviewerId,
                (r.body as any).code,
                (r.body as any).rationale,
                (r.body as any).expectedVersion,
                r.headers['idempotency-key']
              );
            })
        },
        {
          method: 'POST',
          path: '/v1/professional-review-cases/:reviewCaseId/withdraw',
          handle: (r) =>
            mutation(() =>
              reviewFor(r, true).withdraw(r.params.reviewCaseId as ProfessionalReviewCaseId)
            )
        },
        {
          method: 'POST',
          path: '/v1/executions',
          async handle(request) {
            let command: ExecutionCreateCommand;
            try {
              command = parseExecutionCreateCommand(request.body);
            } catch (error) {
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                error instanceof Error ? error.message : 'Invalid request.'
              );
            }
            const header = request.headers['idempotency-key'];
            if (!header || header !== command.idempotencyKey)
              throw new HttpError(
                400,
                'INVALID_REQUEST',
                'Idempotency-Key header is required and must match the command.'
              );
            const fingerprint = JSON.stringify({ ...command, idempotencyKey: undefined });
            const existing = repository.get(header);
            if (existing) {
              if (existing.fingerprint !== fingerprint)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Idempotency key was already used with a different payload.'
                );
              return json(200, existing.record);
            }
            const pending = inFlight.get(header);
            if (pending) {
              if (pending.fingerprint !== fingerprint)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Idempotency key is in use with a different payload.'
                );
              return pending.result;
            }
            const result = (async (): Promise<JsonResult> => {
              const record: ExecutionRecord = {
                executionId: `execution_${randomUUID()}`,
                capabilityRequestId: command.capabilityRequestId,
                executionType: 'CAPABILITY_INVOCATION',
                status: 'RECORDED',
                correlationId: command.correlationId,
                createdAt: now()
              };
              const event: EventEnvelope<'execution.recorded.v1', ExecutionRecord> = {
                eventId: `event_${randomUUID()}`,
                eventType: 'execution.recorded.v1',
                occurredAt: now(),
                correlationId: command.correlationId,
                causationId: command.capabilityRequestId,
                actor: command.actor,
                schemaVersion: 1,
                payload: record
              };
              await publisher.publish(event);
              repository.save(header, { fingerprint, record });
              return json(201, record);
            })();
            inFlight.set(header, { fingerprint, result });
            try {
              return await result;
            } finally {
              inFlight.delete(header);
            }
          }
        }
      ]
    }
  );
}

function httpPreparationLockSource(
  baseUrl: string,
  principal?: WorkspacePrincipal,
  secret?: string
): PreparationLockSource {
  const headers =
    principal && secret
      ? {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId
        }
      : undefined;
  return {
    async getPreparationLock(id: PreparationLockId) {
      const response = await fetch(`${baseUrl}/v1/preparation-locks/${encodeURIComponent(id)}`, {
        ...(headers ? { headers } : {})
      });
      if (response.status === 404) return undefined;
      if (!response.ok)
        throw new FilingGovernanceError(
          'SOURCE_UNAVAILABLE',
          'Preparation Lock source is unavailable.',
          502
        );
      const body = (await response.json()) as
        { preparationLock?: PreparationLock } | PreparationLock;
      return clonePreparationLock(
        ('preparationLock' in body ? body.preparationLock : body) as PreparationLock
      );
    }
  };
}
function clonePreparationLock(value: PreparationLock): PreparationLock {
  return structuredClone(value);
}

function httpMatterDraftSource(baseUrl: string): MatterDraftReviewSource {
  return {
    async getMatterDraft(id: MatterDraftId) {
      const response = await fetch(`${baseUrl}/v1/matter-drafts/${encodeURIComponent(id)}`);
      if (response.status === 404) return undefined;
      if (!response.ok)
        throw new ProfessionalReviewError(
          'SOURCE_UNAVAILABLE',
          'Matter Draft source is unavailable.',
          502
        );
      const body = (await response.json()) as { matterDraft?: MatterDraft } | MatterDraft;
      const draft = ('matterDraft' in body ? body.matterDraft : body) as MatterDraft;
      return {
        schemaVersion: 1,
        matterDraftId: draft.matterDraftId,
        matterDraftVersion: draft.updatedAt,
        confirmationId: draft.confirmationId,
        customerId: draft.customerId,
        status: draft.status,
        preparation: structuredClone(draft.preparation),
        readiness: structuredClone(draft.readiness),
        readinessTimestamp: draft.readiness.evaluatedAt
      } satisfies MatterDraftReviewSnapshot;
    }
  };
}

function httpFormalMatterReviewSource(
  baseUrl: string,
  principal: WorkspacePrincipal,
  secret: string
): MatterDraftReviewSource {
  const headers = {
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
    'x-markorbit-workspace-id': principal.workspaceId
  };
  return {
    getMatterDraft() {
      return Promise.resolve(undefined);
    },
    async getFormalMatter(id) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/v1/formal-matters/${encodeURIComponent(id)}`, {
          headers
        });
      } catch {
        throw new ProfessionalReviewError(
          'SOURCE_UNAVAILABLE',
          'Formal Matter source validation is unavailable.',
          503
        );
      }
      if (response.status === 404) return undefined;
      if (!response.ok)
        throw new ProfessionalReviewError(
          'SOURCE_UNAVAILABLE',
          'Formal Matter source validation is unavailable.',
          503
        );
      const body = (await response.json()) as { formalMatter?: FormalMatter };
      return body.formalMatter;
    }
  };
}
