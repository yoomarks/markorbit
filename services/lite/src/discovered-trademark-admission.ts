import { createHash } from 'node:crypto';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  ApplicantPortfolioEnvelopeV1,
  DataEngineApplicantCandidateReferenceV1,
  DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import type { WorkspaceDirectoryEntryId } from '@markorbit/contracts/workspace-directory';
import type {
  TrademarkAsset,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';
import type { PostgresLiteTrademarkAssetStore } from './trademark-asset.js';
import type { PostgresWorkspaceDirectoryStore } from './workspace-directory.js';

export type DiscoveredTrademarkAdmissionErrorCode =
  | 'PERMISSION_DENIED'
  | 'DIRECTORY_REFERENCE_NOT_FOUND'
  | 'DIRECTORY_REFERENCE_MISMATCH'
  | 'OWNER_READ_NOT_CURRENT'
  | 'OWNER_READ_UNAVAILABLE';

export class DiscoveredTrademarkAdmissionError extends Error {
  constructor(
    readonly code: DiscoveredTrademarkAdmissionErrorCode,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'DiscoveredTrademarkAdmissionError';
  }
}

export interface ExactDiscoveredTrademarkReader {
  readTrademark(request: {
    requestContext: { requester_workspace_id: string; request_id: string };
    applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
    trademark: Pick<
      DataEngineDiscoveredTrademarkCandidateV1,
      'trademark_candidate_id' | 'source_reference'
    >;
  }): Promise<ApplicantPortfolioEnvelopeV1>;
}

export interface AdmitDiscoveredTrademarkCommand {
  principal: Readonly<WorkspacePrincipal>;
  directory: {
    workspaceDirectoryEntryId: WorkspaceDirectoryEntryId;
    version: number;
  };
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
  trademark: Readonly<DataEngineDiscoveredTrademarkCandidateV1>;
  decision: 'MANAGED';
  idempotencyKey: string;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function ownerRequestId(idempotencyKey: string): string {
  return `admission-${createHash('sha256').update(idempotencyKey).digest('hex')}`;
}

function workspaceAdmissionSource(
  command: Readonly<AdmitDiscoveredTrademarkCommand>,
  observedAt: string
): TrademarkAssetSourceReference {
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        actor: command.principal.userId,
        decision: command.decision,
        directory: command.directory,
        applicant: command.applicant,
        trademark: {
          trademark_candidate_id: command.trademark.trademark_candidate_id,
          source_reference: command.trademark.source_reference
        }
      })
    )
    .digest('hex');
  return {
    owner: 'WORKSPACE_USER',
    kind: 'WORKSPACE_ADMISSION',
    sourceId: `${command.directory.workspaceDirectoryEntryId}:${command.directory.version}`,
    sourceVersion: '1',
    sourceFingerprintSha256: fingerprint,
    observedAt,
    freshness: 'CURRENT'
  };
}

function dataEngineSource(
  candidate: Readonly<DataEngineDiscoveredTrademarkCandidateV1>
): TrademarkAssetSourceReference {
  return {
    owner: 'DATA_ENGINE',
    kind: 'DATA_ENGINE_TRADEMARK_RECORD',
    sourceId: candidate.source_reference.source_id,
    sourceVersion: candidate.source_reference.source_version,
    sourceFingerprintSha256: candidate.source_reference.source_fingerprint_sha256.slice(
      'sha256:'.length
    ),
    observedAt: candidate.source_reference.observed_at,
    freshness: 'CURRENT'
  };
}

export class DiscoveredTrademarkAdmissionService {
  constructor(
    private readonly directory: Pick<PostgresWorkspaceDirectoryStore, 'getExact'>,
    private readonly ownerReader: ExactDiscoveredTrademarkReader,
    private readonly assets: Pick<PostgresLiteTrademarkAssetStore, 'admit'>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async admit(command: Readonly<AdmitDiscoveredTrademarkCommand>): Promise<TrademarkAsset> {
    if (
      command.principal.kind !== 'WORKSPACE' ||
      !command.principal.permissions.includes('matter:manage') ||
      command.decision !== 'MANAGED'
    ) {
      throw new DiscoveredTrademarkAdmissionError(
        'PERMISSION_DENIED',
        'Explicit MANAGED admission requires matter:manage permission.',
        403
      );
    }
    const entry = await this.directory.getExact(
      command.principal.workspaceId,
      command.directory.workspaceDirectoryEntryId,
      command.directory.version
    );
    if (
      !entry ||
      entry.workspaceId.toLowerCase() !== command.principal.workspaceId.toLowerCase() ||
      entry.status !== 'ACTIVE'
    ) {
      throw new DiscoveredTrademarkAdmissionError(
        'DIRECTORY_REFERENCE_NOT_FOUND',
        'The exact active Workspace Directory entry was not found.',
        404
      );
    }
    const applicantSource = command.applicant.source_reference;
    const directoryMatch = entry.externalIdentityReferences.some(
      (reference) =>
        reference.kind === 'APPLICANT_IDENTITY' &&
        reference.sourceClass === 'DATA_ENGINE_CANDIDATE' &&
        reference.referenceId === command.applicant.applicant_candidate_id &&
        reference.referenceVersion === applicantSource.source_version &&
        reference.jurisdiction?.toUpperCase() === applicantSource.jurisdiction &&
        new Date(reference.observedAt).toISOString() ===
          new Date(applicantSource.observed_at).toISOString()
    );
    if (!directoryMatch || !same(command.trademark.applicant, command.applicant)) {
      throw new DiscoveredTrademarkAdmissionError(
        'DIRECTORY_REFERENCE_MISMATCH',
        'Applicant and trademark references do not match the exact Workspace Directory binding.',
        409
      );
    }

    const envelope = await this.ownerReader.readTrademark({
      requestContext: {
        requester_workspace_id: command.principal.workspaceId,
        request_id: ownerRequestId(command.idempotencyKey)
      },
      applicant: command.applicant,
      trademark: {
        trademark_candidate_id: command.trademark.trademark_candidate_id,
        source_reference: command.trademark.source_reference
      }
    });
    const current = envelope.fact_state === 'observed' ? envelope.payload?.results[0] : undefined;
    if (
      !current ||
      envelope.payload?.results.length !== 1 ||
      !same(current.applicant, command.applicant) ||
      current.trademark_candidate_id !== command.trademark.trademark_candidate_id ||
      !same(current.source_reference, command.trademark.source_reference)
    ) {
      throw new DiscoveredTrademarkAdmissionError(
        'OWNER_READ_NOT_CURRENT',
        'The exact discovered trademark is not current at the Data Engine owner.',
        409
      );
    }

    const dataSource = dataEngineSource(current);
    const admissionSource = workspaceAdmissionSource(command, new Date(this.now()).toISOString());
    const externalIdentifiers = [
      ...(current.application_number
        ? [{ kind: 'APPLICATION_NUMBER' as const, value: current.application_number }]
        : []),
      ...(current.registration_number
        ? [{ kind: 'REGISTRATION_NUMBER' as const, value: current.registration_number }]
        : [])
    ].map((identifier) => ({
      ...identifier,
      jurisdiction: current.jurisdiction,
      sourceReference: dataSource,
      officialTruthVerifiedByLite: false as const
    }));

    return this.assets.admit({
      workspaceId: command.principal.workspaceId,
      identity: {
        jurisdiction: current.jurisdiction,
        ...(current.mark_text ? { markText: current.mark_text } : {})
      },
      externalIdentifiers,
      workspaceRelationships: [
        {
          kind: 'MANAGED',
          sourceReference: admissionSource,
          sourceAssetEditableByWorkspace: false
        }
      ],
      sourceReferences: [dataSource, admissionSource],
      ownerOrClientReference: command.directory.workspaceDirectoryEntryId,
      idempotencyKey: command.idempotencyKey
    });
  }
}
