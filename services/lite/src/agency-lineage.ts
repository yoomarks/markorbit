import type { CommunicationLinkV1 } from '@markorbit/contracts/communication-link';
import type { LiteIntakeStagingV1 } from '@markorbit/contracts/lite-intake-staging';
import type { LiteWorkItemV1 } from '@markorbit/contracts/lite-work-item';
import type {
  TrademarkAsset,
  TrademarkAssetId
} from '@markorbit/contracts/trademark-asset-workspace';
import type {
  WorkspaceDirectoryEntryId,
  WorkspaceDirectoryEntryV1
} from '@markorbit/contracts/workspace-directory';
import type { PostgresCommunicationLinkStore } from './communication-link.js';
import type { PostgresLiteIntakeStagingStore } from './lite-intake-staging.js';
import type { PostgresLiteWorkItemStore } from './lite-work-item.js';
import type { PostgresLiteTrademarkAssetStore } from './trademark-asset.js';
import type { PostgresTrademarkAssetRefreshLedger } from './trademark-asset-refresh.js';
import type { PostgresWorkspaceDirectoryStore } from './workspace-directory.js';

export type AgencyLineageOwner =
  | 'TRADEMARK_ASSET'
  | 'WORKSPACE_DIRECTORY'
  | 'INTAKE_STAGING'
  | 'COMMUNICATION_LINK'
  | 'WORK'
  | 'TRADEMARK_REFRESH';
export type AgencyLineageReadState = 'RESULTS' | 'EMPTY' | 'UNAVAILABLE' | 'NOT_APPLICABLE';

export interface AgencyLineageOwnerState {
  owner: AgencyLineageOwner;
  state: AgencyLineageReadState;
  errorCode?: string;
}

export interface AgencyLineageEvent {
  eventKey: string;
  occurredAt: string;
  owner: string;
  kind:
    | 'ASSET_ADMITTED'
    | 'SOURCE_OBSERVED'
    | 'DIRECTORY_BOUND'
    | 'INTAKE_REVIEWED'
    | 'INTAKE_COMMITTED'
    | 'COMMUNICATION_LINK_CONFIRMED'
    | 'WORK_UPDATED'
    | 'ASSET_REFRESHED';
  title: string;
  reference: { id: string; version: string };
  sourceReferences: readonly string[];
  authority: 'OWNER_RECEIPT_OR_REFERENCE_ONLY';
}

export interface AgencyTrademarkLineageProjection {
  schemaVersion: 1;
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  generatedAt: string;
  asset: Readonly<TrademarkAsset>;
  directory: Readonly<WorkspaceDirectoryEntryV1> | null;
  ownerStates: readonly Readonly<AgencyLineageOwnerState>[];
  events: readonly Readonly<AgencyLineageEvent>[];
  authority: {
    officialTruthCreated: false;
    legalConclusionCreated: false;
    customerInstructionCreated: false;
    externalActionAuthorized: false;
  };
}

export class AgencyLineageError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'OWNER_UNAVAILABLE',
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'AgencyLineageError';
  }
}

interface AgencyLineageReaders {
  assets: Pick<PostgresLiteTrademarkAssetStore, 'get'>;
  directory: Pick<PostgresWorkspaceDirectoryStore, 'getLatest'>;
  intake: Pick<PostgresLiteIntakeStagingStore, 'listLatest'>;
  links: Pick<PostgresCommunicationLinkStore, 'listLatest'>;
  work: Pick<PostgresLiteWorkItemStore, 'list'>;
  refresh: Pick<PostgresTrademarkAssetRefreshLedger, 'listRecent'>;
}

function errorCode(reason: unknown): string {
  if (reason && typeof reason === 'object' && 'code' in reason && typeof reason.code === 'string')
    return reason.code;
  return 'OWNER_UNAVAILABLE';
}

function sourceKey(source: CommunicationLinkV1['source']): string {
  return `${source.accountRef}:${source.messageId}:${source.threadRef}:${source.provider}:${source.providerMessageId}`;
}

function targetId(link: Readonly<CommunicationLinkV1>): string {
  const target = link.target;
  if (target.targetKind === 'TRADEMARK_ASSET') return target.trademarkAssetId;
  if (target.targetKind === 'WORKSPACE_DIRECTORY_ENTRY') return target.workspaceDirectoryEntryId;
  if (target.targetKind === 'CUSTOMER_RELATIONSHIP') return target.customerRelationshipId;
  if (target.targetKind === 'FORMAL_MATTER') return target.formalMatterId;
  return target.intakeId;
}

function intakeSourceKey(source: LiteIntakeStagingV1['sources'][number]): string | undefined {
  return source.kind === 'USER_INLINE_TEXT'
    ? undefined
    : `${source.accountRef}:${source.messageId}:${source.threadRef}:${source.provider}:${source.providerMessageId}`;
}

function event(input: Omit<AgencyLineageEvent, 'authority'>): Readonly<AgencyLineageEvent> {
  return { ...input, authority: 'OWNER_RECEIPT_OR_REFERENCE_ONLY' };
}

function relatedWork(item: Readonly<LiteWorkItemV1>, ids: ReadonlySet<string>): boolean {
  return item.relatedReferences.some((reference) => ids.has(reference.referenceId));
}

function workReference(reference: LiteWorkItemV1['relatedReferences'][number]): string {
  const version =
    'referenceVersion' in reference ? reference.referenceVersion : reference.observedAt;
  return `${reference.owner}:${reference.kind}:${reference.referenceId}:${version}`;
}

function connectedLinks(
  links: readonly Readonly<CommunicationLinkV1>[],
  initialIds: ReadonlySet<string>
): {
  links: readonly Readonly<CommunicationLinkV1>[];
  ids: ReadonlySet<string>;
  sources: ReadonlySet<string>;
} {
  const ids = new Set(initialIds);
  const sources = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const link of links) {
      if (link.lifecycle !== 'ACTIVE' || link.decision.status !== 'CONFIRMED') continue;
      const source = sourceKey(link.source);
      const target = targetId(link);
      if (ids.has(target) || sources.has(source)) {
        if (!ids.has(target)) {
          ids.add(target);
          changed = true;
        }
        if (!sources.has(source)) {
          sources.add(source);
          changed = true;
        }
      }
    }
  }
  return {
    links: links.filter((link) => ids.has(targetId(link)) && sources.has(sourceKey(link.source))),
    ids,
    sources
  };
}

export class AgencyLineageProjectionService {
  constructor(
    private readonly readers: AgencyLineageReaders,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async project(
    workspaceId: string,
    trademarkAssetId: TrademarkAssetId
  ): Promise<AgencyTrademarkLineageProjection> {
    let asset: TrademarkAsset | undefined;
    try {
      asset = await this.readers.assets.get(workspaceId, trademarkAssetId);
    } catch (cause) {
      throw new AgencyLineageError(
        'OWNER_UNAVAILABLE',
        'Trademark Asset owner is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!asset || asset.workspaceId.toLowerCase() !== workspaceId.toLowerCase())
      throw new AgencyLineageError('NOT_FOUND', 'Trademark Asset was not found.', 404, false);

    const directoryId = asset.ownerOrClientReference?.startsWith('workspace-directory-entry_')
      ? asset.ownerOrClientReference
      : undefined;
    const reads = await Promise.allSettled([
      directoryId
        ? this.readers.directory.getLatest(workspaceId, directoryId as WorkspaceDirectoryEntryId)
        : Promise.resolve(undefined),
      this.readers.intake.listLatest(workspaceId, { limit: 100 }),
      this.readers.links.listLatest(workspaceId, { limit: 100 }),
      this.readers.work.list(workspaceId, { limit: 100 }),
      this.readers.refresh.listRecent(workspaceId, trademarkAssetId, 100)
    ] as const);
    const [directoryRead, intakeRead, linkRead, workRead, refreshRead] = reads;
    const directory = directoryRead.status === 'fulfilled' ? (directoryRead.value ?? null) : null;
    const allLinks = linkRead.status === 'fulfilled' ? linkRead.value : [];
    const initialIds = new Set<string>([
      trademarkAssetId,
      ...(directory ? [directory.workspaceDirectoryEntryId] : [])
    ]);
    const connected = connectedLinks(allLinks, initialIds);
    const intakes = (intakeRead.status === 'fulfilled' ? intakeRead.value : []).filter((item) =>
      item.caseCandidates.some(
        (candidate) =>
          (candidate.productionIntakeReceipt &&
            connected.ids.has(candidate.productionIntakeReceipt.intakeId)) ||
          item.sources.some((source) => {
            const key = intakeSourceKey(source);
            return key !== undefined && connected.sources.has(key);
          })
      )
    );
    const work = (workRead.status === 'fulfilled' ? workRead.value : []).filter((item) =>
      relatedWork(item, connected.ids)
    );
    const refresh = refreshRead.status === 'fulfilled' ? refreshRead.value : [];
    const events: AgencyLineageEvent[] = [
      event({
        eventKey: `asset:${asset.trademarkAssetId}:${asset.version}`,
        occurredAt: asset.createdAt,
        owner: 'LITE',
        kind: 'ASSET_ADMITTED',
        title: 'Trademark admitted to this Workspace',
        reference: { id: asset.trademarkAssetId, version: String(asset.version) },
        sourceReferences: asset.sourceReferences.map(
          (source) => `${source.owner}:${source.kind}:${source.sourceId}:${source.sourceVersion}`
        )
      }),
      ...asset.sourceReferences.map((source) =>
        event({
          eventKey: `source:${source.owner}:${source.kind}:${source.sourceId}:${source.sourceVersion}`,
          occurredAt: source.observedAt,
          owner: source.owner,
          kind: 'SOURCE_OBSERVED' as const,
          title: `${source.kind} observed (${source.freshness})`,
          reference: { id: source.sourceId, version: source.sourceVersion },
          sourceReferences: []
        })
      )
    ];
    if (directory)
      events.push(
        event({
          eventKey: `directory:${directory.workspaceDirectoryEntryId}:${directory.version}`,
          occurredAt: directory.updatedAt,
          owner: 'LITE',
          kind: 'DIRECTORY_BOUND',
          title: `Directory entry: ${directory.displayName}`,
          reference: {
            id: directory.workspaceDirectoryEntryId,
            version: String(directory.version)
          },
          sourceReferences: directory.externalIdentityReferences.map(
            (reference) =>
              `${reference.sourceClass}:${reference.referenceId}:${reference.referenceVersion ?? 'unversioned'}`
          )
        })
      );
    for (const link of connected.links)
      events.push(
        event({
          eventKey: `link:${link.communicationLinkId}:${link.version}`,
          occurredAt: link.decision.decidedAt,
          owner: 'LITE',
          kind: 'COMMUNICATION_LINK_CONFIRMED',
          title: `Communication linked to ${link.target.targetKind}`,
          reference: { id: link.communicationLinkId, version: String(link.version) },
          sourceReferences: [
            `MANAGED_COMMUNICATION:${sourceKey(link.source)}`,
            `${link.target.owner}:${targetId(link)}`
          ]
        })
      );
    for (const item of intakes)
      for (const candidate of item.caseCandidates) {
        if (candidate.reviewedCommit)
          events.push(
            event({
              eventKey: `intake-review:${item.stagingId}:${candidate.caseCandidateId}:${candidate.reviewedCommit.reviewedContentVersion}`,
              occurredAt: candidate.reviewedCommit.confirmedAt,
              owner: 'LITE',
              kind: 'INTAKE_REVIEWED',
              title: 'Filing intake reviewed by a Workspace principal',
              reference: { id: item.stagingId, version: String(item.version) },
              sourceReferences: item.sources.map((source) => `${source.owner}:${source.sourceId}`)
            })
          );
        if (candidate.productionIntakeReceipt)
          events.push(
            event({
              eventKey: `intake-commit:${candidate.productionIntakeReceipt.intakeId}:${candidate.productionIntakeReceipt.version}`,
              occurredAt: candidate.productionIntakeReceipt.committedAt,
              owner: 'MARKREG',
              kind: 'INTAKE_COMMITTED',
              title: 'Reviewed material committed to Production Intake',
              reference: {
                id: candidate.productionIntakeReceipt.intakeId,
                version: String(candidate.productionIntakeReceipt.version)
              },
              sourceReferences: [
                candidate.productionIntakeReceipt.fingerprintSha256,
                candidate.productionIntakeReceipt.reviewedFingerprintSha256
              ]
            })
          );
      }
    for (const item of work)
      events.push(
        event({
          eventKey: `work:${item.liteWorkItemId}:${item.version}`,
          occurredAt: item.updatedAt,
          owner: 'LITE',
          kind: 'WORK_UPDATED',
          title: `${item.title} (${item.status})`,
          reference: { id: item.liteWorkItemId, version: String(item.version) },
          sourceReferences: item.relatedReferences.map(workReference)
        })
      );
    for (const run of refresh)
      events.push(
        event({
          eventKey: `refresh:${run.refreshRunId}`,
          occurredAt: run.refreshedAt,
          owner: 'LITE',
          kind: 'ASSET_REFRESHED',
          title: `Asset refreshed across ${run.sourceOwnerScope.join(', ')}`,
          reference: { id: run.refreshRunId, version: run.refreshedAt },
          sourceReferences: run.observations.map(
            (source) => `${source.owner}:${source.kind}:${source.sourceId}:${source.sourceVersion}`
          )
        })
      );

    const state = <T>(
      owner: AgencyLineageOwner,
      read: PromiseSettledResult<T>,
      count: number,
      applicable = true
    ): AgencyLineageOwnerState =>
      !applicable
        ? { owner, state: 'NOT_APPLICABLE' }
        : read.status === 'rejected'
          ? { owner, state: 'UNAVAILABLE', errorCode: errorCode(read.reason) }
          : { owner, state: count ? 'RESULTS' : 'EMPTY' };
    return {
      schemaVersion: 1,
      workspaceId: asset.workspaceId,
      trademarkAssetId,
      generatedAt: new Date(this.now()).toISOString(),
      asset,
      directory,
      ownerStates: [
        { owner: 'TRADEMARK_ASSET', state: 'RESULTS' },
        state('WORKSPACE_DIRECTORY', directoryRead, directory ? 1 : 0, Boolean(directoryId)),
        state('INTAKE_STAGING', intakeRead, intakes.length),
        state('COMMUNICATION_LINK', linkRead, connected.links.length),
        state('WORK', workRead, work.length),
        state('TRADEMARK_REFRESH', refreshRead, refresh.length)
      ],
      events: events.sort(
        (left, right) =>
          left.occurredAt.localeCompare(right.occurredAt) ||
          left.eventKey.localeCompare(right.eventKey)
      ),
      authority: {
        officialTruthCreated: false,
        legalConclusionCreated: false,
        customerInstructionCreated: false,
        externalActionAuthorized: false
      }
    };
  }
}
