import { createHash } from 'node:crypto';
import type { EducationCommunityJourneyV1 } from '@markorbit/contracts/education-community';
import {
  parseSeedWorkspacePackageV1,
  type SeedWorkspacePackageIdV1,
  type SeedWorkspacePackageV1
} from '@markorbit/contracts/seed-workspace-package';
import type { QueryClient } from '@markorbit/persistence';
import type { EducationCommunityService } from './education-community.js';

export type SeedWorkspacePackageOwnerErrorCode =
  | 'SEED_PACKAGE_NOT_FOUND'
  | 'SEED_INVITATION_NOT_FOUND'
  | 'SEED_PACKAGE_CONFLICT'
  | 'SEED_PACKAGE_EXPIRED'
  | 'SEED_CLAIM_LINEAGE_MISMATCH'
  | 'SEED_CLAIM_CONFLICT'
  | 'SEED_PACKAGE_PERSISTENCE_UNAVAILABLE';

export class SeedWorkspacePackageOwnerError extends Error {
  constructor(
    readonly code: SeedWorkspacePackageOwnerErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'SeedWorkspacePackageOwnerError';
  }
}

export interface SeedWorkspaceClaimV1 {
  schemaVersion: 1;
  seedWorkspacePackageId: SeedWorkspacePackageIdV1;
  packageFingerprintSha256: string;
  educationCommunityJourneyId: string;
  journeyVersion: number;
  journeyFingerprintSha256: string;
  activatedWorkspaceId: string;
  workspaceActivationVersion: number;
  workspaceActivationFingerprintSha256: string;
  workspaceActivationObservedAt: string;
  claimedByPrincipalId: string;
  claimedAt: string;
}

export interface SeedWorkspaceClaimResultV1 {
  package: SeedWorkspacePackageV1;
  claim: Readonly<SeedWorkspaceClaimV1>;
  journey: Readonly<EducationCommunityJourneyV1>;
}

export interface SeedWorkspaceInvitationPreviewV1 {
  schemaVersion: 1;
  seedWorkspacePackageId: SeedWorkspacePackageIdV1;
  target: Readonly<{
    kind: SeedWorkspacePackageV1['target']['kind'];
    displayName: string;
  }>;
  counts: Readonly<{
    representedApplicants?: number;
    relatedTrademarks?: number;
    opportunityCandidates?: number;
    businessArchetypeCandidates?: number;
  }>;
  preparedAt: string;
  expiresAt: string;
}

type Row = Record<string, unknown>;

function storedDocument(value: unknown): SeedWorkspacePackageV1 {
  const decoded: unknown = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  return parseSeedWorkspacePackageV1(decoded);
}

function invitationFingerprint(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 500)
    throw new SeedWorkspacePackageOwnerError(
      'SEED_INVITATION_NOT_FOUND',
      'Seed Workspace invitation was not found.',
      404
    );
  return createHash('sha256').update(normalized).digest('hex');
}

function invitationPreview(
  value: SeedWorkspacePackageV1
): Readonly<SeedWorkspaceInvitationPreviewV1> {
  const counts: SeedWorkspaceInvitationPreviewV1['counts'] = {
    ...(value.collections.representedApplicants
      ? { representedApplicants: value.collections.representedApplicants.count }
      : {}),
    ...(value.collections.relatedTrademarks
      ? { relatedTrademarks: value.collections.relatedTrademarks.count }
      : {}),
    ...(value.collections.opportunityCandidates
      ? { opportunityCandidates: value.collections.opportunityCandidates.count }
      : {}),
    ...(value.collections.businessArchetypeCandidates
      ? { businessArchetypeCandidates: value.collections.businessArchetypeCandidates.count }
      : {})
  };
  return Object.freeze({
    schemaVersion: 1 as const,
    seedWorkspacePackageId: value.seedWorkspacePackageId,
    target: Object.freeze({
      kind: value.target.kind,
      displayName: value.target.displayName
    }),
    counts: Object.freeze(counts),
    preparedAt: value.preparedAt,
    expiresAt: value.expiresAt
  });
}

function text(value: string, field: string, maximum = 300): string {
  const result = value.trim();
  if (!result || result.length > maximum)
    throw new SeedWorkspacePackageOwnerError(
      'SEED_CLAIM_LINEAGE_MISMATCH',
      `${field} is invalid.`,
      400
    );
  return result;
}

function sameClaim(left: SeedWorkspaceClaimV1, right: SeedWorkspaceClaimV1): boolean {
  return (
    left.seedWorkspacePackageId === right.seedWorkspacePackageId &&
    left.packageFingerprintSha256 === right.packageFingerprintSha256 &&
    left.educationCommunityJourneyId === right.educationCommunityJourneyId &&
    left.journeyVersion === right.journeyVersion &&
    left.journeyFingerprintSha256 === right.journeyFingerprintSha256 &&
    left.activatedWorkspaceId === right.activatedWorkspaceId &&
    left.workspaceActivationVersion === right.workspaceActivationVersion &&
    left.workspaceActivationFingerprintSha256 === right.workspaceActivationFingerprintSha256 &&
    left.workspaceActivationObservedAt === right.workspaceActivationObservedAt &&
    left.claimedByPrincipalId === right.claimedByPrincipalId
  );
}

export class PostgresSeedWorkspacePackageStore {
  constructor(
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  private persistence(error: unknown): never {
    if (error instanceof SeedWorkspacePackageOwnerError) throw error;
    throw new SeedWorkspacePackageOwnerError(
      'SEED_PACKAGE_PERSISTENCE_UNAVAILABLE',
      'Seed Workspace Package persistence is unavailable.',
      503,
      true,
      { cause: error instanceof Error ? error : undefined }
    );
  }

  async savePrepared(value: unknown): Promise<SeedWorkspacePackageV1> {
    const prepared = parseSeedWorkspacePackageV1(value);
    try {
      const inserted = await this.query.query(
        `INSERT INTO lite_seed_workspace_packages(
           seed_workspace_package_id,prepared_by_workspace_id,version,stage,
           package_fingerprint_sha256,document_json,prepared_at,expires_at,created_at
         ) VALUES($1,$2,1,'PREPARED',$3,$4::jsonb,$5,$6,$7)
         ON CONFLICT(seed_workspace_package_id) DO NOTHING`,
        [
          prepared.seedWorkspacePackageId,
          prepared.preparedByWorkspaceId,
          prepared.packageFingerprintSha256,
          JSON.stringify(prepared),
          prepared.preparedAt,
          prepared.expiresAt,
          this.now()
        ]
      );
      if ((inserted.rowCount ?? 0) === 1) return prepared;
      const existing = await this.find(prepared.seedWorkspacePackageId);
      if (existing && existing.packageFingerprintSha256 === prepared.packageFingerprintSha256)
        return existing;
      throw new SeedWorkspacePackageOwnerError(
        'SEED_PACKAGE_CONFLICT',
        'Seed Workspace Package identity already exists with different immutable content.',
        409
      );
    } catch (error) {
      return this.persistence(error);
    }
  }

  async find(packageId: SeedWorkspacePackageIdV1): Promise<SeedWorkspacePackageV1 | null> {
    try {
      const result = await this.query.query<Row>(
        `SELECT document_json
         FROM lite_seed_workspace_packages
         WHERE seed_workspace_package_id=$1`,
        [packageId]
      );
      return result.rows[0] ? storedDocument(result.rows[0].document_json) : null;
    } catch (error) {
      return this.persistence(error);
    }
  }

  async requireClaimable(
    packageId: SeedWorkspacePackageIdV1,
    at = this.now()
  ): Promise<SeedWorkspacePackageV1> {
    const prepared = await this.find(packageId);
    if (!prepared)
      throw new SeedWorkspacePackageOwnerError(
        'SEED_PACKAGE_NOT_FOUND',
        'Seed Workspace Package was not found.',
        404
      );
    if (Date.parse(prepared.expiresAt) <= Date.parse(at))
      throw new SeedWorkspacePackageOwnerError(
        'SEED_PACKAGE_EXPIRED',
        'Seed Workspace Package has expired and cannot be newly claimed.',
        409
      );
    return prepared;
  }

  async readForWorkspace(
    workspaceId: string,
    packageId: SeedWorkspacePackageIdV1
  ): Promise<SeedWorkspacePackageV1 | null> {
    try {
      const result = await this.query.query<Row>(
        `SELECT p.document_json
         FROM lite_seed_workspace_packages p
         LEFT JOIN lite_seed_workspace_claims c
           ON c.seed_workspace_package_id=p.seed_workspace_package_id
         WHERE p.seed_workspace_package_id=$1
           AND (p.prepared_by_workspace_id=$2 OR c.activated_workspace_id=$2)`,
        [packageId, workspaceId]
      );
      return result.rows[0] ? storedDocument(result.rows[0].document_json) : null;
    } catch (error) {
      return this.persistence(error);
    }
  }

  async previewInvitation(input: {
    packageId: SeedWorkspacePackageIdV1;
    invitationClaimToken: string;
    at?: string;
  }): Promise<Readonly<SeedWorkspaceInvitationPreviewV1>> {
    const fingerprint = invitationFingerprint(input.invitationClaimToken);
    try {
      const result = await this.query.query<Row>(
        `SELECT p.document_json
         FROM lite_seed_workspace_packages p
         JOIN lite_education_community_journey_heads h
           ON h.campaign_workspace_id=p.prepared_by_workspace_id
         JOIN lite_education_community_journey_versions v
           ON v.education_community_journey_id=h.education_community_journey_id
          AND v.version=h.latest_version
         WHERE p.seed_workspace_package_id=$1
           AND h.claim_fingerprint_sha256=$2
           AND h.stage='INVITATION_PREPARED'
           AND v.document_json->>'participantRef'=p.seed_workspace_package_id
         LIMIT 1`,
        [input.packageId, fingerprint]
      );
      const row = result.rows[0];
      if (!row)
        throw new SeedWorkspacePackageOwnerError(
          'SEED_INVITATION_NOT_FOUND',
          'Seed Workspace invitation was not found.',
          404
        );
      const prepared = storedDocument(row.document_json);
      if (Date.parse(prepared.expiresAt) <= Date.parse(input.at ?? this.now()))
        throw new SeedWorkspacePackageOwnerError(
          'SEED_PACKAGE_EXPIRED',
          'Seed Workspace Package has expired and cannot be claimed.',
          409
        );
      return invitationPreview(prepared);
    } catch (error) {
      return this.persistence(error);
    }
  }

  private async existingClaim(
    packageId: SeedWorkspacePackageIdV1
  ): Promise<SeedWorkspaceClaimV1 | null> {
    const result = await this.query.query<Row>(
      `SELECT seed_workspace_package_id,package_fingerprint_sha256,
              education_community_journey_id,journey_version,journey_fingerprint_sha256,
              activated_workspace_id,workspace_activation_version,
              workspace_activation_fingerprint_sha256,workspace_activation_observed_at,
              claiming_principal_id,claimed_at
       FROM lite_seed_workspace_claims c
       JOIN lite_seed_workspace_packages p USING(seed_workspace_package_id)
       WHERE c.seed_workspace_package_id=$1`,
      [packageId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      schemaVersion: 1,
      seedWorkspacePackageId: row.seed_workspace_package_id as SeedWorkspacePackageIdV1,
      packageFingerprintSha256: row.package_fingerprint_sha256 as string,
      educationCommunityJourneyId: row.education_community_journey_id as string,
      journeyVersion: Number(row.journey_version),
      journeyFingerprintSha256: row.journey_fingerprint_sha256 as string,
      activatedWorkspaceId: row.activated_workspace_id as string,
      workspaceActivationVersion: Number(row.workspace_activation_version),
      workspaceActivationFingerprintSha256: row.workspace_activation_fingerprint_sha256 as string,
      workspaceActivationObservedAt: new Date(
        row.workspace_activation_observed_at as Date | string
      ).toISOString(),
      claimedByPrincipalId: row.claiming_principal_id as string,
      claimedAt: new Date(row.claimed_at as Date | string).toISOString()
    };
  }

  async bindClaim(input: {
    package: SeedWorkspacePackageV1;
    journey: Readonly<EducationCommunityJourneyV1>;
    workspaceId: string;
    actorPrincipalId: string;
    claimedAt?: string;
  }): Promise<Readonly<SeedWorkspaceClaimV1>> {
    const activated = input.journey.activatedWorkspace;
    if (
      input.journey.stage !== 'WORKSPACE_ACTIVATED' ||
      !activated ||
      input.journey.participantRef !== input.package.seedWorkspacePackageId ||
      input.journey.campaignWorkspaceId !== input.package.preparedByWorkspaceId ||
      activated.id !== input.workspaceId
    )
      throw new SeedWorkspacePackageOwnerError(
        'SEED_CLAIM_LINEAGE_MISMATCH',
        'Seed claim does not match the exact prepared package, invitation journey and activated Workspace.',
        409
      );

    const claim: SeedWorkspaceClaimV1 = {
      schemaVersion: 1,
      seedWorkspacePackageId: input.package.seedWorkspacePackageId,
      packageFingerprintSha256: input.package.packageFingerprintSha256,
      educationCommunityJourneyId: input.journey.educationCommunityJourneyId,
      journeyVersion: input.journey.version,
      journeyFingerprintSha256: input.journey.journeyFingerprintSha256,
      activatedWorkspaceId: input.workspaceId,
      workspaceActivationVersion: activated.version,
      workspaceActivationFingerprintSha256: activated.fingerprintSha256,
      workspaceActivationObservedAt: activated.observedAt,
      claimedByPrincipalId: text(input.actorPrincipalId, 'actorPrincipalId', 240),
      claimedAt: input.claimedAt ?? this.now()
    };

    try {
      const inserted = await this.query.query(
        `INSERT INTO lite_seed_workspace_claims(
           seed_workspace_package_id,education_community_journey_id,activated_workspace_id,
           claiming_principal_id,journey_version,journey_fingerprint_sha256,
           workspace_activation_version,workspace_activation_fingerprint_sha256,
           workspace_activation_observed_at,claimed_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT DO NOTHING`,
        [
          claim.seedWorkspacePackageId,
          claim.educationCommunityJourneyId,
          claim.activatedWorkspaceId,
          claim.claimedByPrincipalId,
          claim.journeyVersion,
          claim.journeyFingerprintSha256,
          claim.workspaceActivationVersion,
          claim.workspaceActivationFingerprintSha256,
          claim.workspaceActivationObservedAt,
          claim.claimedAt
        ]
      );
      if ((inserted.rowCount ?? 0) === 1) return Object.freeze(claim);
      const existing = await this.existingClaim(claim.seedWorkspacePackageId);
      if (existing && sameClaim(existing, claim)) return Object.freeze(existing);
      throw new SeedWorkspacePackageOwnerError(
        'SEED_CLAIM_CONFLICT',
        'Seed Workspace Package is already claimed by different exact lineage.',
        409
      );
    } catch (error) {
      return this.persistence(error);
    }
  }
}

export interface SeedWorkspacePackageClaimStore {
  requireClaimable(
    packageId: SeedWorkspacePackageIdV1,
    at?: string
  ): Promise<SeedWorkspacePackageV1>;
  bindClaim(input: {
    package: SeedWorkspacePackageV1;
    journey: Readonly<EducationCommunityJourneyV1>;
    workspaceId: string;
    actorPrincipalId: string;
    claimedAt?: string;
  }): Promise<Readonly<SeedWorkspaceClaimV1>>;
}

export interface SeedInvitationActivator {
  activate(
    command: Parameters<EducationCommunityService['activate']>[0]
  ): ReturnType<EducationCommunityService['activate']>;
}

export class SeedWorkspaceClaimService {
  constructor(
    private readonly packages: SeedWorkspacePackageClaimStore,
    private readonly invitations: SeedInvitationActivator
  ) {}

  async claim(command: {
    packageId: SeedWorkspacePackageIdV1;
    workspaceId: string;
    actorPrincipalId: string;
    idempotencyKey: string;
    invitationClaimToken: string;
  }): Promise<SeedWorkspaceClaimResultV1> {
    const prepared = await this.packages.requireClaimable(command.packageId);
    const journey = await this.invitations.activate({
      workspaceId: command.workspaceId,
      actorPrincipalId: command.actorPrincipalId,
      idempotencyKey: command.idempotencyKey,
      invitationClaimToken: command.invitationClaimToken
    });
    const claim = await this.packages.bindClaim({
      package: prepared,
      journey,
      workspaceId: command.workspaceId,
      actorPrincipalId: command.actorPrincipalId
    });
    return { package: prepared, claim, journey };
  }
}
