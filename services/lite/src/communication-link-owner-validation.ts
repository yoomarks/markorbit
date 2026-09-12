import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  parseManagedCommunicationMessageV1,
  type ManagedCommunicationMessageV1
} from '@markorbit/contracts/managed-communication';
import type {
  CommunicationLinkSourceReferenceV1,
  CommunicationLinkTargetReferenceV1
} from '@markorbit/contracts/communication-link';
import type { PostgresLiteTrademarkAssetStore } from './trademark-asset.js';
import type { PostgresWorkspaceDirectoryStore } from './workspace-directory.js';
import {
  CommunicationLinkRuntimeError,
  type CommunicationLinkOwnerValidator
} from './communication-link.js';

interface Fetcher {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

function sameSource(
  message: Readonly<ManagedCommunicationMessageV1>,
  source: Readonly<CommunicationLinkSourceReferenceV1>
): boolean {
  return (
    message.accountRef === source.accountRef &&
    message.messageId === source.messageId &&
    message.threadRef === source.threadRef &&
    message.providerObservation.provider === source.provider &&
    message.providerObservation.providerMessageId === source.providerMessageId &&
    message.providerObservation.observedAt === source.observedAt
  );
}

export class HttpManagedCommunicationLinkSourceReader {
  constructor(
    private readonly capabilityEngineUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: Fetcher = fetch
  ) {}

  async validate(
    workspaceId: string,
    source: Readonly<CommunicationLinkSourceReferenceV1>
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityEngineUrl.replace(/\/$/u, '')}/internal/v1/managed-communication/thread-resolutions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-workspace-id': workspaceId
          },
          body: JSON.stringify({ accountRef: source.accountRef, threadRef: source.threadRef })
        }
      );
    } catch (cause) {
      throw new CommunicationLinkRuntimeError(
        'SOURCE_UNAVAILABLE',
        'Managed Communication owner read is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!response.ok) {
      throw new CommunicationLinkRuntimeError(
        response.status === 404 ? 'SOURCE_NOT_FOUND' : 'SOURCE_UNAVAILABLE',
        response.status === 404
          ? 'Managed Communication source was not found.'
          : 'Managed Communication owner read is unavailable.',
        response.status === 404 ? 404 : 503,
        response.status !== 404
      );
    }
    const payload = (await response.json().catch(() => undefined)) as
      | { workspaceId?: unknown; accountRef?: unknown; threadRef?: unknown; messages?: unknown }
      | undefined;
    if (
      !payload ||
      payload.workspaceId !== workspaceId ||
      payload.accountRef !== source.accountRef ||
      payload.threadRef !== source.threadRef ||
      !Array.isArray(payload.messages)
    ) {
      throw new CommunicationLinkRuntimeError(
        'SOURCE_MISMATCH',
        'Managed Communication owner response does not match the requested source scope.'
      );
    }
    let messages: ManagedCommunicationMessageV1[];
    try {
      messages = (payload.messages as unknown[]).map((item) => {
        const candidate =
          item && typeof item === 'object' && !Array.isArray(item) && 'exactEvidence' in item
            ? Object.fromEntries(
                Object.entries(item as Record<string, unknown>).filter(
                  ([key]) => key !== 'exactEvidence'
                )
              )
            : item;
        return parseManagedCommunicationMessageV1(candidate);
      });
    } catch (cause) {
      throw new CommunicationLinkRuntimeError(
        'SOURCE_MISMATCH',
        'Managed Communication owner returned invalid normalized message evidence.',
        409,
        false,
        {
          cause: cause instanceof Error ? cause : undefined
        }
      );
    }
    const exact = messages.find((message) => message.messageId === source.messageId);
    if (!exact)
      throw new CommunicationLinkRuntimeError(
        'SOURCE_NOT_FOUND',
        'Reviewed Managed Communication message was not found.',
        404
      );
    if (!sameSource(exact, source))
      throw new CommunicationLinkRuntimeError(
        'SOURCE_MISMATCH',
        'Reviewed Managed Communication message lineage no longer matches the requested exact anchor.'
      );
  }
}

export class HttpMarkRegCommunicationLinkTargetReader {
  constructor(
    private readonly markRegUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: Fetcher = fetch
  ) {}

  async validate(
    principal: Readonly<WorkspacePrincipal>,
    target: Readonly<CommunicationLinkTargetReferenceV1>
  ): Promise<void> {
    if (target.owner !== 'MARKREG') return;
    const path =
      target.targetKind === 'CUSTOMER_RELATIONSHIP'
        ? `/internal/v1/customer-relationships/${encodeURIComponent(target.customerRelationshipId)}`
        : target.targetKind === 'FORMAL_MATTER'
          ? `/v1/formal-matters/${encodeURIComponent(target.formalMatterId)}`
          : target.targetKind === 'PRODUCTION_INTAKE'
            ? `/internal/v1/production-intakes/${encodeURIComponent(target.intakeId)}`
            : undefined;
    if (!path)
      throw new CommunicationLinkRuntimeError(
        'TARGET_OWNER_UNAVAILABLE',
        'Target owner is not supported by the MarkReg validator.',
        503,
        true
      );
    let response: Response;
    try {
      response = await this.fetcher(`${this.markRegUrl.replace(/\/$/u, '')}${path}`, {
        method: 'GET',
        headers: {
          'x-markorbit-internal-authorization': this.internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId
        }
      });
    } catch (cause) {
      throw new CommunicationLinkRuntimeError(
        'TARGET_UNAVAILABLE',
        'MarkReg target owner read is unavailable.',
        503,
        true,
        {
          cause: cause instanceof Error ? cause : undefined
        }
      );
    }
    if (!response.ok) {
      throw new CommunicationLinkRuntimeError(
        response.status === 404 ? 'TARGET_NOT_FOUND' : 'TARGET_UNAVAILABLE',
        response.status === 404
          ? 'Exact MarkReg target was not found.'
          : 'MarkReg target owner read is unavailable.',
        response.status === 404 ? 404 : 503,
        response.status !== 404
      );
    }
    const payload = (await response.json().catch(() => undefined)) as
      Record<string, unknown> | undefined;
    const record =
      payload && typeof payload === 'object'
        ? (payload.customerRelationship ?? payload.formalMatter ?? payload.intake)
        : undefined;
    if (!record || typeof record !== 'object' || Array.isArray(record))
      throw new CommunicationLinkRuntimeError(
        'TARGET_UNAVAILABLE',
        'MarkReg target owner returned an invalid response.',
        503,
        true
      );
    const item = record as Record<string, unknown>;
    if (item.workspaceId !== principal.workspaceId)
      throw new CommunicationLinkRuntimeError(
        'TARGET_NOT_FOUND',
        'Exact MarkReg target was not found in this Workspace.',
        404
      );
    if (item.version !== target.version)
      throw new CommunicationLinkRuntimeError(
        'TARGET_VERSION_STALE',
        'Target version is no longer current.'
      );
    if (
      target.targetKind === 'PRODUCTION_INTAKE' &&
      item.fingerprintSha256 !== target.fingerprintSha256
    )
      throw new CommunicationLinkRuntimeError(
        'TARGET_VERSION_STALE',
        'Production Intake fingerprint no longer matches the exact target lineage.'
      );
  }
}

export class ProductionCommunicationLinkOwnerValidator implements CommunicationLinkOwnerValidator {
  constructor(
    private readonly sourceReader: HttpManagedCommunicationLinkSourceReader,
    private readonly trademarkAssets: Pick<PostgresLiteTrademarkAssetStore, 'get'>,
    private readonly workspaceDirectory: Pick<PostgresWorkspaceDirectoryStore, 'getLatest'>,
    private readonly markRegTargets: HttpMarkRegCommunicationLinkTargetReader
  ) {}

  async validateCreate(
    input: Readonly<{
      workspaceId: string;
      source: Readonly<CommunicationLinkSourceReferenceV1>;
      target: Readonly<CommunicationLinkTargetReferenceV1>;
      principal: Readonly<WorkspacePrincipal>;
    }>
  ): Promise<void> {
    if (input.principal.workspaceId.toLowerCase() !== input.workspaceId.toLowerCase())
      throw new CommunicationLinkRuntimeError(
        'TARGET_NOT_FOUND',
        'Workspace-scoped target was not found.',
        404
      );
    await this.sourceReader.validate(input.workspaceId, input.source);
    if (input.target.targetKind === 'WORKSPACE_DIRECTORY_ENTRY') {
      try {
        const entry = await this.workspaceDirectory.getLatest(
          input.workspaceId,
          input.target.workspaceDirectoryEntryId
        );
        if (!entry)
          throw new CommunicationLinkRuntimeError(
            'TARGET_NOT_FOUND',
            'Exact Workspace Directory target was not found.',
            404
          );
        if (entry.version !== input.target.version || entry.status !== 'ACTIVE')
          throw new CommunicationLinkRuntimeError(
            'TARGET_VERSION_STALE',
            'Workspace Directory target is no longer current and ACTIVE.'
          );
      } catch (error) {
        if (error instanceof CommunicationLinkRuntimeError) throw error;
        throw new CommunicationLinkRuntimeError(
          'TARGET_UNAVAILABLE',
          'Workspace Directory owner read is unavailable.',
          503,
          true,
          { cause: error instanceof Error ? error : undefined }
        );
      }
      return;
    }
    if (input.target.targetKind === 'TRADEMARK_ASSET') {
      try {
        const asset = await this.trademarkAssets.get(
          input.workspaceId,
          input.target.trademarkAssetId
        );
        if (asset.version !== input.target.version)
          throw new CommunicationLinkRuntimeError(
            'TARGET_VERSION_STALE',
            'Trademark Asset version is no longer current.'
          );
      } catch (error) {
        if (error instanceof CommunicationLinkRuntimeError) throw error;
        const code =
          error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
        if (code === 'NOT_FOUND')
          throw new CommunicationLinkRuntimeError(
            'TARGET_NOT_FOUND',
            'Exact Trademark Asset target was not found.',
            404
          );
        throw new CommunicationLinkRuntimeError(
          'TARGET_UNAVAILABLE',
          'Trademark Asset owner read is unavailable.',
          503,
          true,
          {
            cause: error instanceof Error ? error : undefined
          }
        );
      }
      return;
    }
    await this.markRegTargets.validate(input.principal, input.target);
  }
}
