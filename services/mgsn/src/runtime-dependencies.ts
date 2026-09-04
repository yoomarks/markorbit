import type {
  EvidenceHandoffReference,
  ProviderExecutionSourceSnapshot
} from '@markorbit/contracts/provider-execution';
import {
  ProviderRegistryError,
  type CoreWorkspaceIdentityReference,
  type CoreWorkspaceIdentitySource
} from './provider-registry.js';
import type { CoreCurrentWorkspaceAuthoritySource } from './provider-selection-current-authority.js';
import {
  ProviderReturnError,
  type ProviderReturnEvidenceHandoffTarget
} from './provider-return.js';
import {
  ServicePackageEligibilityError,
  type ExecutionSourceAdmissionSource,
  type ExecutionSourceVerification
} from './service-package-eligibility.js';

async function safeBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Non-bearer Core identity-currentness adapter from #711.
 *
 * Known Core denials are collapsed to a privacy-safe current=false result. Transport, service-auth
 * and malformed-success failures remain authorityAvailable=false. The adapter never accepts,
 * persists or replays a browser session token.
 */
export class HttpCoreCurrentWorkspaceAuthoritySource
  implements CoreCurrentWorkspaceAuthoritySource
{
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string
  ) {}

  async validateCurrent(
    input: Parameters<CoreCurrentWorkspaceAuthoritySource['validateCurrent']>[0]
  ) {
    let response: Response;
    try {
      response = await fetch(`${this.coreUrl}/internal/auth/workspace-authority/validate-current`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret
        },
        body: JSON.stringify({
          workspaceId: input.workspaceId,
          userId: input.userId,
          membershipId: input.membershipId
        })
      });
    } catch {
      return { authorityAvailable: false, current: false, authorityReferences: [] } as const;
    }

    if ([400, 403, 404, 409].includes(response.status))
      return { authorityAvailable: true, current: false, authorityReferences: [] } as const;
    if (!response.ok)
      return { authorityAvailable: false, current: false, authorityReferences: [] } as const;

    const body = await safeBody(response);
    const workspace = body.workspace as Record<string, unknown> | undefined;
    const user = body.user as Record<string, unknown> | undefined;
    const membership = body.membership as Record<string, unknown> | undefined;
    const valid =
      body.schemaVersion === 1 &&
      body.authorityAvailable === true &&
      body.workspaceCurrent === true &&
      body.userCurrent === true &&
      body.membershipCurrent === true &&
      body.bindingMatches === true &&
      body.permissionCurrent === null &&
      body.requiredPermission === null &&
      workspace?.workspaceId === input.workspaceId &&
      positiveInteger(workspace.version) &&
      user?.userId === input.userId &&
      positiveInteger(user.version) &&
      membership?.membershipId === input.membershipId &&
      membership.workspaceId === input.workspaceId &&
      membership.userId === input.userId &&
      typeof membership.role === 'string' &&
      Boolean(membership.role) &&
      positiveInteger(membership.version);
    if (!valid || !workspace || !user || !membership)
      return { authorityAvailable: false, current: false, authorityReferences: [] } as const;

    return {
      authorityAvailable: true,
      current: true,
      authorityReferences: [
        `core-workspace:${input.workspaceId}:v${String(workspace.version)}`,
        `core-user:${input.userId}:v${String(user.version)}`,
        `core-membership:${input.membershipId}:v${String(membership.version)}`
      ]
    } as const;
  }
}

export class HttpCoreWorkspaceIdentitySource implements CoreWorkspaceIdentitySource {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string
  ) {}

  async getWorkspace(workspaceId: string): Promise<CoreWorkspaceIdentityReference | undefined> {
    let response: Response;
    try {
      response = await fetch(
        `${this.coreUrl}/internal/identity/workspaces/${encodeURIComponent(workspaceId)}`,
        {
          headers: {
            'x-markorbit-internal-authorization': this.internalServiceSecret
          }
        }
      );
    } catch {
      throw new ProviderRegistryError(
        'DEPENDENCY_UNAVAILABLE',
        'Core Workspace identity source is unavailable.',
        503
      );
    }
    if (response.status === 404) return undefined;
    if (!response.ok)
      throw new ProviderRegistryError(
        'DEPENDENCY_UNAVAILABLE',
        'Core Workspace identity source is unavailable.',
        503
      );
    const body = await safeBody(response);
    const workspace = body.workspace as CoreWorkspaceIdentityReference | undefined;
    return workspace ? structuredClone(workspace) : undefined;
  }
}

export class HttpExecutionSourceAdmissionSource implements ExecutionSourceAdmissionSource {
  constructor(
    private readonly executionUrl: string,
    private readonly internalServiceSecret: string
  ) {}

  async verifyCurrentSource(
    source: Readonly<ProviderExecutionSourceSnapshot>
  ): Promise<ExecutionSourceVerification> {
    let response: Response;
    try {
      response = await fetch(`${this.executionUrl}/internal/provider-execution-source/verify`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret,
          'x-markorbit-workspace-id': source.workspaceId
        },
        body: JSON.stringify({ workspaceId: source.workspaceId, source })
      });
    } catch {
      throw new ServicePackageEligibilityError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution source verification is unavailable.',
        503
      );
    }
    if (!response.ok)
      throw new ServicePackageEligibilityError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution source verification is unavailable.',
        503
      );
    const body = await safeBody(response);
    if (!['CURRENT', 'STALE', 'MISSING'].includes(String(body.status)))
      throw new ServicePackageEligibilityError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution source verification returned an invalid response.',
        503
      );
    return body as unknown as ExecutionSourceVerification;
  }
}

export class HttpProviderReturnEvidenceHandoffTarget implements ProviderReturnEvidenceHandoffTarget {
  constructor(
    private readonly executionUrl: string,
    private readonly internalServiceSecret: string
  ) {}

  async handoffProviderReturnEvidence(
    input: Parameters<ProviderReturnEvidenceHandoffTarget['handoffProviderReturnEvidence']>[0]
  ): Promise<EvidenceHandoffReference> {
    let response: Response;
    try {
      response = await fetch(`${this.executionUrl}/internal/provider-return-evidence/handoff`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret,
          'x-markorbit-workspace-id': input.command.workspaceId,
          'idempotency-key': input.command.idempotencyKey
        },
        body: JSON.stringify({
          workspaceId: input.command.workspaceId,
          command: input.command,
          providerReturn: input.providerReturn
        })
      });
    } catch {
      throw new ProviderReturnError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution evidence handoff is unavailable.',
        503
      );
    }
    const body = await safeBody(response);
    if (!response.ok)
      throw new ProviderReturnError(
        response.status >= 500 ? 'DEPENDENCY_UNAVAILABLE' : 'SOURCE_VERSION_MISMATCH',
        typeof body.message === 'string'
          ? body.message
          : 'Execution evidence handoff was rejected.',
        response.status >= 500 ? 503 : response.status
      );
    const evidenceHandoff = body.evidenceHandoff as EvidenceHandoffReference | undefined;
    if (!evidenceHandoff)
      throw new ProviderReturnError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution evidence handoff returned an invalid response.',
        503
      );
    return structuredClone(evidenceHandoff);
  }
}
