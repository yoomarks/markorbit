import type { Permission } from '@markorbit/contracts';
import {
  CurrentWorkspaceAuthorityError,
  type CurrentWorkspaceAuthorityResult,
  type CurrentWorkspaceAuthorityService
} from './current-workspace-authority.js';
import { uuidV7 } from './auth.js';

export const GOVERNED_HUMAN_ACTION_KINDS = [
  'PROVIDER_SELECTION',
  'CONTROLLED_HANDOFF'
] as const;
export type GovernedHumanActionKind = (typeof GOVERNED_HUMAN_ACTION_KINDS)[number];

export type GovernedHumanActionReceiptErrorCode =
  | 'INVALID_GOVERNED_HUMAN_ACTION_REQUEST'
  | 'GOVERNED_HUMAN_ACTION_RECEIPT_NOT_FOUND'
  | 'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT'
  | 'GOVERNED_HUMAN_ACTION_RECEIPT_STALE'
  | 'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE';

export class GovernedHumanActionReceiptError extends Error {
  constructor(
    readonly code: GovernedHumanActionReceiptErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'GovernedHumanActionReceiptError';
  }
}

export interface GovernedHumanActionReceiptBinding {
  workspaceId: string;
  userId: string;
  membershipId: string;
  principalReference: string;
  kind: GovernedHumanActionKind;
  mutationRoute: string;
  reviewedActionDigest: string;
  idempotencyKey: string;
  authenticatedAt: string;
}

export interface GovernedHumanActionReceipt extends GovernedHumanActionReceiptBinding {
  schemaVersion: 1;
  receiptId: string;
  receiptVersion: 1;
  authorityReference: string;
  authorityVersion: 1;
  affirmativeHumanActionEvidenceReference: string;
  source: 'CORE';
  actorKind: 'HUMAN_USER';
  workspaceVersion: number;
  userVersion: number;
  membershipVersion: number;
  createdAt: string;
}

export interface GovernedHumanActionReceiptStore {
  materializeOrResolve(
    receipt: Readonly<GovernedHumanActionReceipt>
  ): Promise<Readonly<GovernedHumanActionReceipt>>;
  findById(receiptId: string): Promise<Readonly<GovernedHumanActionReceipt> | undefined>;
}

export type MaterializeGovernedHumanActionReceiptRequest = GovernedHumanActionReceiptBinding;

export interface ValidateGovernedHumanActionReceiptRequest
  extends GovernedHumanActionReceiptBinding {
  receiptId: string;
}

const canonicalUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
const digest = (value: string) => /^[0-9a-f]{64}$/u.test(value);
const bounded = (value: string, max: number) => value.length > 0 && value.length <= max;

function validRoute(kind: GovernedHumanActionKind, route: string): boolean {
  const selection = /^\/api\/mgsn\/governed-network\/selections(?:\/[A-Za-z0-9._:-]+\/revoke)?$/u;
  const handoff = /^\/api\/mgsn\/governed-network\/handoffs(?:\/[A-Za-z0-9._:-]+\/revoke)?$/u;
  return (kind === 'PROVIDER_SELECTION' ? selection : handoff).test(route);
}

function validateBinding(value: Readonly<GovernedHumanActionReceiptBinding>): void {
  if (
    !canonicalUuid(value.workspaceId) ||
    !canonicalUuid(value.userId) ||
    !canonicalUuid(value.membershipId) ||
    !(GOVERNED_HUMAN_ACTION_KINDS as readonly string[]).includes(value.kind) ||
    !bounded(value.principalReference, 512) ||
    !validRoute(value.kind, value.mutationRoute) ||
    !digest(value.reviewedActionDigest) ||
    !bounded(value.idempotencyKey, 256) ||
    !Number.isFinite(Date.parse(value.authenticatedAt))
  )
    throw new GovernedHumanActionReceiptError(
      'INVALID_GOVERNED_HUMAN_ACTION_REQUEST',
      'Exact trusted human-action binding is required.',
      400
    );
}

function exactBindingMatches(
  receipt: Readonly<GovernedHumanActionReceipt>,
  expected: Readonly<GovernedHumanActionReceiptBinding>
): boolean {
  return (
    receipt.workspaceId === expected.workspaceId &&
    receipt.userId === expected.userId &&
    receipt.membershipId === expected.membershipId &&
    receipt.principalReference === expected.principalReference &&
    receipt.kind === expected.kind &&
    receipt.mutationRoute === expected.mutationRoute &&
    receipt.reviewedActionDigest === expected.reviewedActionDigest &&
    receipt.idempotencyKey === expected.idempotencyKey &&
    receipt.authenticatedAt === expected.authenticatedAt
  );
}

function currentAuthorityRequest(
  binding: Readonly<GovernedHumanActionReceiptBinding>,
  receipt?: Readonly<GovernedHumanActionReceipt>
) {
  const requiredPermission: Permission = 'workspace:manage';
  return {
    workspaceId: binding.workspaceId,
    userId: binding.userId,
    membershipId: binding.membershipId,
    ...(receipt
      ? {
          expectedWorkspaceVersion: receipt.workspaceVersion,
          expectedUserVersion: receipt.userVersion,
          expectedMembershipVersion: receipt.membershipVersion
        }
      : {}),
    requiredPermission
  };
}

function mapCurrentAuthorityFailure(cause: unknown): GovernedHumanActionReceiptError {
  if (
    cause instanceof CurrentWorkspaceAuthorityError &&
    cause.code === 'CURRENT_AUTHORITY_SOURCE_UNAVAILABLE'
  )
    return new GovernedHumanActionReceiptError(
      'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE',
      'Current Core Workspace authority source is unavailable.',
      503,
      true,
      { cause }
    );
  return new GovernedHumanActionReceiptError(
    'GOVERNED_HUMAN_ACTION_RECEIPT_STALE',
    'Current Workspace authority does not support this governed human action.',
    cause instanceof CurrentWorkspaceAuthorityError ? cause.status : 409,
    false,
    { cause: cause instanceof Error ? cause : undefined }
  );
}

function receiptFrom(
  request: Readonly<MaterializeGovernedHumanActionReceiptRequest>,
  authority: Readonly<CurrentWorkspaceAuthorityResult>,
  now: string
): Readonly<GovernedHumanActionReceipt> {
  const receiptId = uuidV7();
  return Object.freeze({
    schemaVersion: 1,
    receiptId,
    receiptVersion: 1,
    authorityReference: `core-governed-human-action-receipt:${receiptId}`,
    authorityVersion: 1,
    affirmativeHumanActionEvidenceReference: `core-governed-human-action-evidence:${receiptId}`,
    source: 'CORE',
    actorKind: 'HUMAN_USER',
    ...request,
    workspaceVersion: authority.workspace.version,
    userVersion: authority.user.version,
    membershipVersion: authority.membership.version,
    createdAt: now
  });
}

export class GovernedHumanActionReceiptService {
  constructor(
    private readonly options: Readonly<{
      store: GovernedHumanActionReceiptStore;
      currentWorkspaceAuthority: Pick<CurrentWorkspaceAuthorityService, 'validate'>;
      clock?: () => Date;
    }>
  ) {}

  async materializeOrResolve(
    request: Readonly<MaterializeGovernedHumanActionReceiptRequest>
  ): Promise<Readonly<GovernedHumanActionReceipt>> {
    validateBinding(request);
    let authority: Readonly<CurrentWorkspaceAuthorityResult>;
    try {
      authority = await this.options.currentWorkspaceAuthority.validate(
        currentAuthorityRequest(request)
      );
    } catch (cause) {
      throw mapCurrentAuthorityFailure(cause);
    }
    const now = (this.options.clock ?? (() => new Date()))().toISOString();
    try {
      return await this.options.store.materializeOrResolve(receiptFrom(request, authority, now));
    } catch (error) {
      if (error instanceof GovernedHumanActionReceiptError) throw error;
      throw new GovernedHumanActionReceiptError(
        'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE',
        'Governed human-action receipt persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async validateCurrent(
    request: Readonly<ValidateGovernedHumanActionReceiptRequest>
  ): Promise<Readonly<GovernedHumanActionReceipt>> {
    validateBinding(request);
    if (!canonicalUuid(request.receiptId))
      throw new GovernedHumanActionReceiptError(
        'INVALID_GOVERNED_HUMAN_ACTION_REQUEST',
        'A canonical receiptId is required.',
        400
      );
    let receipt: Readonly<GovernedHumanActionReceipt> | undefined;
    try {
      receipt = await this.options.store.findById(request.receiptId);
    } catch (cause) {
      if (cause instanceof GovernedHumanActionReceiptError) throw cause;
      throw new GovernedHumanActionReceiptError(
        'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE',
        'Governed human-action receipt source is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!receipt)
      throw new GovernedHumanActionReceiptError(
        'GOVERNED_HUMAN_ACTION_RECEIPT_NOT_FOUND',
        'Exact governed human-action receipt was not found.',
        404
      );
    if (!exactBindingMatches(receipt, request))
      throw new GovernedHumanActionReceiptError(
        'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT',
        'Governed human-action receipt does not match the exact reviewed action.',
        409
      );
    try {
      await this.options.currentWorkspaceAuthority.validate(
        currentAuthorityRequest(request, receipt)
      );
    } catch (cause) {
      throw mapCurrentAuthorityFailure(cause);
    }
    return receipt;
  }
}
