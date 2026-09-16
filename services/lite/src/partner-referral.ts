import { createHash, randomUUID } from 'node:crypto';
import type {
  BusinessAttributionLinkIdV1,
  BusinessAttributionLinkV1
} from '@markorbit/contracts/business-attribution';
import type {
  RatePolicyApplicabilityV1,
  RatePolicyVersionV1
} from '@markorbit/contracts/workspace-commercial';
import {
  noPartnerCommissionEligibilityAuthorityConsequencesV1,
  noPartnerReferralProgramAuthorityConsequencesV1,
  parsePartnerCommissionEligibilityCandidateV1,
  parsePartnerReferralProgramV1,
  partnerCommissionEligibilityFingerprintSha256V1,
  partnerReferralPolicyFingerprintSha256V1,
  partnerReferralProgramFingerprintSha256V1,
  type PartnerCommissionEligibilityCandidateIdV1,
  type PartnerCommissionEligibilityCandidateV1,
  type PartnerReferralDirectoryReferenceV1,
  type PartnerReferralEligibilityPolicyV1,
  type PartnerReferralPolicyIdV1,
  type PartnerReferralProgramIdV1,
  type PartnerReferralProgramV1
} from '@markorbit/contracts/partner-referral';
import type {
  WorkspaceDirectoryEntryId,
  WorkspaceDirectoryEntryV1
} from '@markorbit/contracts/workspace-directory';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$/u;
type Row = Record<string, unknown>;

export type PartnerReferralErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'REFERRAL_CODE_CONFLICT'
  | 'PARTNER_NOT_CURRENT'
  | 'LINEAGE_MISMATCH'
  | 'POLICY_NOT_EFFECTIVE'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class PartnerReferralError extends Error {
  constructor(
    readonly code: PartnerReferralErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PartnerReferralError';
  }
}

export interface PartnerReferralDirectoryReader {
  getLatest(
    workspaceId: string,
    id: WorkspaceDirectoryEntryId
  ): Promise<WorkspaceDirectoryEntryV1 | undefined>;
}

export interface PartnerReferralAttributionReader {
  find(
    workspaceId: string,
    linkId: BusinessAttributionLinkIdV1
  ): Promise<BusinessAttributionLinkV1 | undefined>;
}

export interface PartnerReferralRatePolicyReader {
  resolve(
    input: Readonly<{
      applicability: RatePolicyApplicabilityV1;
      asOf: string;
    }>
  ): Promise<RatePolicyVersionV1>;
}

export class HttpCorePartnerReferralRatePolicyReader implements PartnerReferralRatePolicyReader {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 3_000
  ) {}

  async resolve(
    input: Readonly<{
      applicability: RatePolicyApplicabilityV1;
      asOf: string;
    }>
  ): Promise<RatePolicyVersionV1> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.coreUrl.replace(/\/$/u, '')}/internal/commercial/rate-policies/resolve`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify({
            kind: 'REFERRAL_COMMISSION',
            applicability: input.applicability,
            asOf: input.asOf
          }),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch (cause) {
      throw new PartnerReferralError(
        'PERSISTENCE_UNAVAILABLE',
        'Core referral commission policy owner is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok)
      throw new PartnerReferralError(
        response.status >= 500 ? 'PERSISTENCE_UNAVAILABLE' : 'PARTNER_NOT_CURRENT',
        response.status >= 500
          ? 'Core referral commission policy owner is unavailable.'
          : 'No exact active Core referral commission policy applies.',
        response.status >= 500 ? 503 : 409,
        response.status >= 500
      );
    const value = body as Partial<RatePolicyVersionV1> | undefined;
    if (
      value?.schemaVersion !== 1 ||
      value.kind !== 'REFERRAL_COMMISSION' ||
      value.lifecycle !== 'ACTIVE' ||
      typeof value.policyId !== 'string' ||
      !Number.isSafeInteger(value.version) ||
      !value.applicability ||
      !value.calculation ||
      typeof value.effectiveFrom !== 'string' ||
      typeof value.sourceRef !== 'string' ||
      typeof value.recordedAt !== 'string'
    )
      throw new PartnerReferralError(
        'INTEGRITY_FAILURE',
        'Core referral commission policy proof is invalid.',
        503,
        true
      );
    return value as RatePolicyVersionV1;
  }
}

export interface CreatePartnerReferralProgramCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  referralCode: string;
  partner: Readonly<{
    id: WorkspaceDirectoryEntryId;
    version: number;
    fingerprintSha256: string;
  }>;
}

export interface EvaluatePartnerCommissionEligibilityCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  program: Readonly<{
    id: PartnerReferralProgramIdV1;
    version: 1;
    fingerprintSha256: string;
  }>;
  siteInboundAttribution: Readonly<{
    id: BusinessAttributionLinkIdV1;
    version: 1;
    fingerprintSha256: string;
  }>;
}

interface PersistProgramCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  referralCode: string;
  partner: Readonly<PartnerReferralDirectoryReferenceV1>;
  policy: Readonly<PartnerReferralEligibilityPolicyV1>;
}

interface PersistEligibilityCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  program: Readonly<PartnerReferralProgramV1>;
  siteInboundAttribution: Readonly<BusinessAttributionLinkV1>;
}

export interface PartnerReferralStore {
  createProgram(command: Readonly<PersistProgramCommand>): Promise<PartnerReferralProgramV1>;
  findProgram(
    workspaceId: string,
    id: PartnerReferralProgramIdV1
  ): Promise<PartnerReferralProgramV1 | undefined>;
  createCandidate(
    command: Readonly<PersistEligibilityCommand>
  ): Promise<PartnerCommissionEligibilityCandidateV1>;
  findCandidate(
    workspaceId: string,
    id: PartnerCommissionEligibilityCandidateIdV1
  ): Promise<PartnerCommissionEligibilityCandidateV1 | undefined>;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Row)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function workspace(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID.test(normalized))
    throw new PartnerReferralError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return normalized;
}

function text(value: string, field: string, maximum = 300): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new PartnerReferralError('INVALID_INPUT', `${field} is invalid.`, 422);
  return normalized;
}

function sha(value: string, field: string): string {
  const normalized = text(value, field, 64);
  if (!SHA256.test(normalized))
    throw new PartnerReferralError('INVALID_INPUT', `${field} must be lowercase SHA-256.`, 422);
  return normalized;
}

function version(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PartnerReferralError('INVALID_INPUT', `${field} must be a positive integer.`, 422);
  return value;
}

function timestamp(value: string, field: string): string {
  const parsed = new Date(text(value, field, 80));
  if (Number.isNaN(parsed.getTime()))
    throw new PartnerReferralError('INVALID_INPUT', `${field} must be an ISO timestamp.`, 422);
  return parsed.toISOString();
}

function persistedProgram(value: unknown, expectedWorkspace: string): PartnerReferralProgramV1 {
  try {
    const parsed = parsePartnerReferralProgramV1(value);
    if (parsed.workspaceId !== expectedWorkspace) throw new Error('workspace mismatch');
    return parsed;
  } catch (cause) {
    throw new PartnerReferralError(
      'INTEGRITY_FAILURE',
      'Persisted Partner Referral Program failed contract validation.',
      500,
      false,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}

function persistedCandidate(
  value: unknown,
  expectedWorkspace: string
): PartnerCommissionEligibilityCandidateV1 {
  try {
    const parsed = parsePartnerCommissionEligibilityCandidateV1(value);
    if (parsed.workspaceId !== expectedWorkspace) throw new Error('workspace mismatch');
    return parsed;
  } catch (cause) {
    throw new PartnerReferralError(
      'INTEGRITY_FAILURE',
      'Persisted Partner Commission Eligibility Candidate failed contract validation.',
      500,
      false,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}

export class PostgresPartnerReferralStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => randomUUID().replaceAll('-', '')
  ) {}

  async createProgram(command: Readonly<PersistProgramCommand>): Promise<PartnerReferralProgramV1> {
    const workspaceId = workspace(command.workspaceId);
    const actorPrincipalId = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = digest({ ...command, workspaceId, idempotencyKey: undefined });
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:partner-referral-program:${idempotencyKey}`
        ]);
        const replay = await client.query(
          `SELECT c.request_fingerprint_sha256,p.document_json
           FROM lite_partner_referral_program_commands c
           JOIN lite_partner_referral_programs p
             ON p.partner_referral_program_id=c.partner_referral_program_id
           WHERE c.workspace_id=$1 AND c.idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprint)
            throw new PartnerReferralError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different referral program.'
            );
          return persistedProgram(prior.document_json, workspaceId);
        }
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:partner-referral-code:${command.referralCode}`
        ]);
        const existing = await client.query(
          'SELECT 1 FROM lite_partner_referral_programs WHERE workspace_id=$1 AND referral_code=$2',
          [workspaceId, command.referralCode]
        );
        if (existing.rows[0])
          throw new PartnerReferralError(
            'REFERRAL_CODE_CONFLICT',
            'Referral code is already bound in this Workspace.'
          );
        const createdAt = timestamp(this.now(), 'now');
        const partnerReferralProgramId: PartnerReferralProgramIdV1 = `partner-referral-program_${this.id()}`;
        const base = {
          schemaVersion: 1 as const,
          partnerReferralProgramId,
          workspaceId,
          version: 1 as const,
          referralCode: command.referralCode,
          partner: command.partner,
          policy: command.policy,
          status: 'ACTIVE' as const,
          createdByPrincipalId: actorPrincipalId,
          createdAt,
          authorityConsequences: noPartnerReferralProgramAuthorityConsequencesV1
        };
        const value = parsePartnerReferralProgramV1({
          ...base,
          programFingerprintSha256: partnerReferralProgramFingerprintSha256V1(base)
        });
        await client.query(
          `INSERT INTO lite_partner_referral_programs
           (partner_referral_program_id,workspace_id,version,referral_code,partner_directory_entry_id,partner_directory_entry_version,partner_directory_entry_fingerprint_sha256,policy_id,policy_version,policy_fingerprint_sha256,status,document_json,created_at)
           VALUES($1,$2,1,$3,$4,$5,$6,$7,1,$8,$9,$10::jsonb,$11)`,
          [
            value.partnerReferralProgramId,
            workspaceId,
            value.referralCode,
            value.partner.id,
            value.partner.version,
            value.partner.fingerprintSha256,
            value.policy.partnerReferralPolicyId,
            value.policy.policyFingerprintSha256,
            value.status,
            JSON.stringify(value),
            createdAt
          ]
        );
        await client.query(
          `INSERT INTO lite_partner_referral_program_commands
           (workspace_id,idempotency_key,request_fingerprint_sha256,partner_referral_program_id,created_at)
           VALUES($1,$2,$3,$4,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprint,
            value.partnerReferralProgramId,
            createdAt
          ]
        );
        return value;
      });
    } catch (cause) {
      if (cause instanceof PartnerReferralError) throw cause;
      throw new PartnerReferralError(
        'PERSISTENCE_UNAVAILABLE',
        'Partner Referral Program persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async findProgram(
    workspaceIdValue: string,
    id: PartnerReferralProgramIdV1
  ): Promise<PartnerReferralProgramV1 | undefined> {
    const workspaceId = workspace(workspaceIdValue);
    try {
      const result = await this.query.query(
        'SELECT document_json FROM lite_partner_referral_programs WHERE workspace_id=$1 AND partner_referral_program_id=$2 AND version=1',
        [workspaceId, text(id, 'partnerReferralProgramId')]
      );
      const row = result.rows[0] as Row | undefined;
      return row ? persistedProgram(row.document_json, workspaceId) : undefined;
    } catch (cause) {
      if (cause instanceof PartnerReferralError) throw cause;
      throw new PartnerReferralError(
        'PERSISTENCE_UNAVAILABLE',
        'Partner Referral Program persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async createCandidate(
    command: Readonly<PersistEligibilityCommand>
  ): Promise<PartnerCommissionEligibilityCandidateV1> {
    const workspaceId = workspace(command.workspaceId);
    const actorPrincipalId = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = digest({ ...command, workspaceId, idempotencyKey: undefined });
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:partner-commission-eligibility:${idempotencyKey}`
        ]);
        const replay = await client.query(
          `SELECT c.request_fingerprint_sha256,e.document_json
           FROM lite_partner_commission_eligibility_commands c
           JOIN lite_partner_commission_eligibility_candidates e
             ON e.partner_commission_eligibility_candidate_id=c.partner_commission_eligibility_candidate_id
           WHERE c.workspace_id=$1 AND c.idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprint)
            throw new PartnerReferralError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for different eligibility evidence.'
            );
          return persistedCandidate(prior.document_json, workspaceId);
        }
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:site-referral-eligibility:${command.siteInboundAttribution.businessAttributionLinkId}`
        ]);
        const existing = await client.query(
          `SELECT document_json FROM lite_partner_commission_eligibility_candidates
           WHERE workspace_id=$1 AND site_inbound_attribution_link_id=$2`,
          [workspaceId, command.siteInboundAttribution.businessAttributionLinkId]
        );
        if (existing.rows[0])
          throw new PartnerReferralError(
            'IDEMPOTENCY_CONFLICT',
            'This exact Site inbound attribution already has an eligibility candidate.'
          );
        const evaluatedAt = timestamp(this.now(), 'now');
        const downstreamRef = command.siteInboundAttribution.downstreamRef;
        if (!downstreamRef)
          throw new PartnerReferralError(
            'INTEGRITY_FAILURE',
            'Eligibility evidence requires a downstream Formal Matter.',
            500
          );
        const partnerCommissionEligibilityCandidateId: PartnerCommissionEligibilityCandidateIdV1 = `partner-commission-eligibility_${this.id()}`;
        const base = {
          schemaVersion: 1 as const,
          partnerCommissionEligibilityCandidateId,
          workspaceId,
          version: 1 as const,
          program: {
            id: command.program.partnerReferralProgramId,
            version: 1 as const,
            fingerprintSha256: command.program.programFingerprintSha256
          },
          partner: command.program.partner,
          policy: {
            id: command.program.policy.partnerReferralPolicyId,
            version: 1 as const,
            fingerprintSha256: command.program.policy.policyFingerprintSha256
          },
          siteInboundAttribution: {
            id: command.siteInboundAttribution.businessAttributionLinkId,
            version: 1 as const,
            fingerprintSha256: command.siteInboundAttribution.businessAttributionFingerprintSha256
          },
          downstreamRef,
          outcome: 'ELIGIBLE_FOR_COMMISSION_REVIEW' as const,
          evaluatedByPrincipalId: actorPrincipalId,
          evaluatedAt,
          authorityConsequences: noPartnerCommissionEligibilityAuthorityConsequencesV1
        };
        const value = parsePartnerCommissionEligibilityCandidateV1({
          ...base,
          eligibilityFingerprintSha256: partnerCommissionEligibilityFingerprintSha256V1(base)
        });
        await client.query(
          `INSERT INTO lite_partner_commission_eligibility_candidates
           (partner_commission_eligibility_candidate_id,workspace_id,version,partner_referral_program_id,site_inbound_attribution_link_id,downstream_formal_matter_id,outcome,document_json,evaluated_at)
           VALUES($1,$2,1,$3,$4,$5,$6,$7::jsonb,$8)`,
          [
            value.partnerCommissionEligibilityCandidateId,
            workspaceId,
            value.program.id,
            value.siteInboundAttribution.id,
            value.downstreamRef.id,
            value.outcome,
            JSON.stringify(value),
            evaluatedAt
          ]
        );
        await client.query(
          `INSERT INTO lite_partner_commission_eligibility_commands
           (workspace_id,idempotency_key,request_fingerprint_sha256,partner_commission_eligibility_candidate_id,created_at)
           VALUES($1,$2,$3,$4,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprint,
            value.partnerCommissionEligibilityCandidateId,
            evaluatedAt
          ]
        );
        return value;
      });
    } catch (cause) {
      if (cause instanceof PartnerReferralError) throw cause;
      throw new PartnerReferralError(
        'PERSISTENCE_UNAVAILABLE',
        'Partner Commission Eligibility persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async findCandidate(
    workspaceIdValue: string,
    id: PartnerCommissionEligibilityCandidateIdV1
  ): Promise<PartnerCommissionEligibilityCandidateV1 | undefined> {
    const workspaceId = workspace(workspaceIdValue);
    try {
      const result = await this.query.query(
        `SELECT document_json FROM lite_partner_commission_eligibility_candidates
         WHERE workspace_id=$1 AND partner_commission_eligibility_candidate_id=$2 AND version=1`,
        [workspaceId, text(id, 'partnerCommissionEligibilityCandidateId')]
      );
      const row = result.rows[0] as Row | undefined;
      return row ? persistedCandidate(row.document_json, workspaceId) : undefined;
    } catch (cause) {
      if (cause instanceof PartnerReferralError) throw cause;
      throw new PartnerReferralError(
        'PERSISTENCE_UNAVAILABLE',
        'Partner Commission Eligibility persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }
}

export class PartnerReferralService {
  constructor(
    private readonly directory: PartnerReferralDirectoryReader,
    private readonly attribution: PartnerReferralAttributionReader,
    private readonly ratePolicies: PartnerReferralRatePolicyReader,
    private readonly store: PartnerReferralStore,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async createProgram(
    command: Readonly<CreatePartnerReferralProgramCommand>
  ): Promise<PartnerReferralProgramV1> {
    const workspaceId = workspace(command.workspaceId);
    const actorPrincipalId = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const referralCode = text(command.referralCode, 'referralCode', 80);
    if (!TOKEN.test(referralCode))
      throw new PartnerReferralError(
        'INVALID_INPUT',
        'referralCode must be a bounded opaque token.',
        422
      );
    const partnerVersion = version(command.partner.version, 'partner.version');
    const expectedPartnerFingerprint = sha(
      command.partner.fingerprintSha256,
      'partner.fingerprintSha256'
    );
    const entry = await this.directory.getLatest(workspaceId, command.partner.id);
    if (
      !entry ||
      entry.workspaceId.toLowerCase() !== workspaceId ||
      entry.version !== partnerVersion ||
      entry.status !== 'ACTIVE' ||
      digest(entry) !== expectedPartnerFingerprint
    )
      throw new PartnerReferralError(
        'PARTNER_NOT_CURRENT',
        'An exact current Workspace Directory partner entry is required.',
        409
      );
    const effectiveAt = timestamp(this.now(), 'now');
    const applicability = {
      partnerRef: `LITE:WORKSPACE_DIRECTORY_ENTRY:${entry.workspaceDirectoryEntryId}@${entry.version}`,
      referralSourceRef: `SITE_REFERRAL_CODE:${referralCode}`
    };
    const ratePolicy = await this.ratePolicies.resolve({ applicability, asOf: effectiveAt });
    if (
      ratePolicy.schemaVersion !== 1 ||
      ratePolicy.kind !== 'REFERRAL_COMMISSION' ||
      ratePolicy.lifecycle !== 'ACTIVE' ||
      digest(ratePolicy.applicability) !== digest(applicability)
    )
      throw new PartnerReferralError(
        'PARTNER_NOT_CURRENT',
        'An exact active Core referral commission policy is required.',
        409
      );
    const ratePolicyFingerprintSha256 = digest(ratePolicy);
    const partnerReferralPolicyId: PartnerReferralPolicyIdV1 = `partner-referral-policy_${ratePolicyFingerprintSha256.slice(0, 32)}`;
    const policyWithoutFingerprint = {
      partnerReferralPolicyId,
      version: 1 as const,
      requiredAttributionState: 'ATTRIBUTED' as const,
      requiredEvidenceBasis: 'EXACT_LINEAGE' as const,
      qualifyingDownstreamOwner: 'MARKREG' as const,
      qualifyingDownstreamKind: 'FORMAL_MATTER' as const,
      effectiveAt,
      ratePolicy: {
        owner: 'CORE' as const,
        kind: 'REFERRAL_COMMISSION' as const,
        id: ratePolicy.policyId,
        version: ratePolicy.version,
        fingerprintSha256: ratePolicyFingerprintSha256
      }
    };
    const policy = {
      ...policyWithoutFingerprint,
      policyFingerprintSha256: partnerReferralPolicyFingerprintSha256V1(policyWithoutFingerprint)
    };
    return this.store.createProgram({
      workspaceId,
      actorPrincipalId,
      idempotencyKey,
      referralCode,
      partner: {
        owner: 'LITE',
        kind: 'WORKSPACE_DIRECTORY_ENTRY',
        id: entry.workspaceDirectoryEntryId,
        version: entry.version,
        fingerprintSha256: expectedPartnerFingerprint
      },
      policy
    });
  }

  async evaluate(
    command: Readonly<EvaluatePartnerCommissionEligibilityCommand>
  ): Promise<PartnerCommissionEligibilityCandidateV1> {
    const workspaceId = workspace(command.workspaceId);
    const actorPrincipalId = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey');
    const programFingerprint = sha(command.program.fingerprintSha256, 'program.fingerprintSha256');
    const attributionFingerprint = sha(
      command.siteInboundAttribution.fingerprintSha256,
      'siteInboundAttribution.fingerprintSha256'
    );
    const [program, attribution] = await Promise.all([
      this.store.findProgram(workspaceId, command.program.id),
      this.attribution.find(workspaceId, command.siteInboundAttribution.id)
    ]);
    if (!program || !attribution)
      throw new PartnerReferralError('NOT_FOUND', 'Exact referral lineage was not found.', 404);
    if (
      command.program.version !== 1 ||
      program.programFingerprintSha256 !== programFingerprint ||
      command.siteInboundAttribution.version !== 1 ||
      attribution.businessAttributionFingerprintSha256 !== attributionFingerprint ||
      program.status !== 'ACTIVE'
    )
      throw new PartnerReferralError(
        'LINEAGE_MISMATCH',
        'Referral program or Site inbound attribution is stale.',
        409
      );
    const referralSuffix = `|${program.referralCode}`;
    const referralReference = attribution.sourceRefs.find(
      (reference) =>
        reference.owner === 'SITE' &&
        reference.kind === 'SITE_REFERRAL_CODE' &&
        reference.id.endsWith(referralSuffix)
    );
    if (
      attribution.workspaceId.toLowerCase() !== workspaceId ||
      attribution.motionKind !== 'SITE_INBOUND' ||
      attribution.attributionState !== program.policy.requiredAttributionState ||
      attribution.evidenceBasis !== program.policy.requiredEvidenceBasis ||
      !attribution.downstreamRef ||
      attribution.downstreamRef.owner !== program.policy.qualifyingDownstreamOwner ||
      attribution.downstreamRef.kind !== program.policy.qualifyingDownstreamKind ||
      !referralReference
    )
      throw new PartnerReferralError(
        'LINEAGE_MISMATCH',
        'Site inbound attribution does not preserve the exact referral code and Formal Matter.',
        409
      );
    if (Date.parse(referralReference.observedAt) < Date.parse(program.policy.effectiveAt))
      throw new PartnerReferralError(
        'POLICY_NOT_EFFECTIVE',
        'Referral occurred before this eligibility policy became effective.',
        409
      );
    const currentRatePolicy = await this.ratePolicies.resolve({
      applicability: {
        partnerRef: `LITE:WORKSPACE_DIRECTORY_ENTRY:${program.partner.id}@${program.partner.version}`,
        referralSourceRef: `SITE_REFERRAL_CODE:${program.referralCode}`
      },
      asOf: referralReference.observedAt
    });
    if (
      currentRatePolicy.policyId !== program.policy.ratePolicy.id ||
      currentRatePolicy.version !== program.policy.ratePolicy.version ||
      digest(currentRatePolicy) !== program.policy.ratePolicy.fingerprintSha256
    )
      throw new PartnerReferralError(
        'LINEAGE_MISMATCH',
        'Core referral commission policy lineage is stale or does not match.',
        409
      );
    const currentPartner = await this.directory.getLatest(workspaceId, program.partner.id);
    if (
      !currentPartner ||
      currentPartner.version !== program.partner.version ||
      currentPartner.status !== 'ACTIVE' ||
      digest(currentPartner) !== program.partner.fingerprintSha256
    )
      throw new PartnerReferralError(
        'PARTNER_NOT_CURRENT',
        'Partner Directory evidence is no longer current.',
        409
      );
    return this.store.createCandidate({
      workspaceId,
      actorPrincipalId,
      idempotencyKey,
      program,
      siteInboundAttribution: attribution
    });
  }

  findCandidate(workspaceId: string, id: PartnerCommissionEligibilityCandidateIdV1) {
    return this.store.findCandidate(workspaceId, id);
  }
}
