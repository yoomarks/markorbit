import { createHash, randomUUID } from 'node:crypto';
import {
  encodeInternalWorkspacePrincipal,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF,
  type CnCompletedDurationHistoricalBandV1
} from '@markorbit/contracts/brain-cn-duration-band-classification';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';
import {
  CapabilityRuntimeExecutionContractError,
  parseGovernedCapabilityRuntimeExecutionV2,
  type GovernedCapabilityRuntimeExecutionV2
} from '@markorbit/contracts/capability-runtime-execution';
import type { QueryClient } from '@markorbit/persistence';
import type { FormalMatterRepository, TransactionHost } from './formal-matter.js';

export const MATTER_INTELLIGENCE_OBSERVATION_KIND =
  'CN_COMPLETED_DURATION_HISTORICAL_BAND' as const;
export const MATTER_INTELLIGENCE_CAPABILITY_ID =
  'interpretation.cn-completed-duration-historical-band' as const;
export const MATTER_INTELLIGENCE_CAPABILITY_VERSION = '1.0.0' as const;
export const MATTER_INTELLIGENCE_INPUT_SCHEMA =
  'brain-input.cn-completed-duration-historical-band.v1' as const;
export const MATTER_INTELLIGENCE_OUTPUT_SCHEMA =
  'brain.cn-completed-duration-historical-band.v1' as const;

const REQUIRED_AVAILABLE_DATA = [
  'OBSERVED_COMPLETED_DURATION_DAYS',
  'ACCEPTED_CN_DURATION_DISTRIBUTION'
] as const;
const HISTORICAL_BANDS = [
  'LOWER_QUARTILE_OR_BELOW',
  'LOWER_INTERQUARTILE',
  'UPPER_INTERQUARTILE',
  'UPPER_QUARTILE'
] as const;
const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MatterIntelligenceErrorCode =
  | 'INVALID_INPUT'
  | 'AUTHENTICATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'WORKSPACE_MISMATCH'
  | 'FORMAL_MATTER_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CAPABILITY_REJECTED'
  | 'CAPABILITY_UNAVAILABLE'
  | 'CAPABILITY_CONTRACT_MISMATCH'
  | 'PERSISTENCE_UNAVAILABLE';

export class MatterIntelligenceError extends Error {
  constructor(
    readonly code: MatterIntelligenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MatterIntelligenceError';
  }
}

export type MatterIntelligenceObservationId = `matter-intelligence-observation_${string}`;

export interface MarkRegMatterIntelligenceObservationV1 {
  schemaVersion: 1;
  matterIntelligenceObservationId: MatterIntelligenceObservationId;
  workspaceId: string;
  formalMatter: Readonly<{
    id: FormalMatterId;
    version: number;
    snapshotSha256: string;
  }>;
  observationKind: typeof MATTER_INTELLIGENCE_OBSERVATION_KIND;
  observedCompletedDurationDays: number;
  historicalBand: CnCompletedDurationHistoricalBandV1;
  datasetRefId: typeof CN_DURATION_BAND_ACCEPTED_DATASET_REF;
  capability: Readonly<{
    id: typeof MATTER_INTELLIGENCE_CAPABILITY_ID;
    version: typeof MATTER_INTELLIGENCE_CAPABILITY_VERSION;
    inputSchemaId: typeof MATTER_INTELLIGENCE_INPUT_SCHEMA;
    outputSchemaId: typeof MATTER_INTELLIGENCE_OUTPUT_SCHEMA;
  }>;
  capabilityRequestId: string;
  capabilityInvocationId: string;
  capabilityOutcomeId: string;
  capabilityReturnId: string;
  sessionReceiptId: string;
  implementation: Readonly<{
    id: string;
    version: number;
    implementationKey: string;
  }>;
  correlationId: string;
  methodPackageRef: string;
  methodRef: string;
  methodVersionRef: string;
  evaluationRef: string;
  researchDatasetRef: string;
  evidenceRefs: readonly string[];
  evidenceFingerprintSha256: string;
  inputFingerprintSha256: string;
  outputFingerprintSha256: string;
  recordedByPrincipalId: string;
  recordedAt: string;
}

export interface RecordMatterIntelligenceCommand {
  workspaceId: string;
  formalMatterId: FormalMatterId;
  observedCompletedDurationDays: number;
  principal: WorkspacePrincipal;
  idempotencyKey: string;
  correlationId: string;
}

export interface MatterIntelligenceDisposition {
  observation: MarkRegMatterIntelligenceObservationV1;
  replayed: boolean;
  semanticDuplicate: boolean;
  capabilityReplayed: boolean;
}

interface CommandReplay {
  requestFingerprintSha256: string;
  result: MatterIntelligenceDisposition;
}

interface ObservationWrite {
  observation: MarkRegMatterIntelligenceObservationV1;
  idempotencyKey: string;
  requestFingerprintSha256: string;
  correlationId: string;
  capabilityReplayed: boolean;
}

export interface MatterIntelligenceRepository {
  findCommandReplay(workspaceId: string, idempotencyKey: string): Promise<CommandReplay | undefined>;
  record(value: Readonly<ObservationWrite>): Promise<MatterIntelligenceDisposition>;
}

export interface MatterIntelligenceCapabilityClient {
  classifyCompletedDuration(input: Readonly<{
    workspaceId: string;
    formalMatterId: FormalMatterId;
    observedCompletedDurationDays: number;
    principal: WorkspacePrincipal;
    productIdempotencyKey: string;
    correlationId: string;
  }>): Promise<Readonly<ValidatedDurationBandCapabilityResult>>;
}

interface DurationBandOutput {
  schemaVersion: 1;
  kind: 'CN_COMPLETED_DURATION_HISTORICAL_BAND_CLASSIFICATION_V1';
  jurisdiction: 'CN';
  procedure: 'FILING_TO_PRELIMINARY_PUBLICATION';
  observedCompletedDurationDays: number;
  historicalBand: CnCompletedDurationHistoricalBandV1;
  datasetRefId: typeof CN_DURATION_BAND_ACCEPTED_DATASET_REF;
  thresholds: Readonly<{ p25Days: 335; medianDays: 336; p75Days: 383 }>;
  semantics: 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION';
  descriptiveInterpretationOnly: true;
  legalConclusion: false;
  predictiveClaim: false;
  riskClaim: false;
  probabilityClaim: false;
  recommendation: false;
  currentCaseStatusInferred: false;
  productBusinessStateMutated: false;
}

interface ValidatedDurationBandCapabilityResult {
  execution: GovernedCapabilityRuntimeExecutionV2;
  output: DurationBandOutput;
  methodPackageRef: string;
  methodRef: string;
  methodVersionRef: string;
  evaluationRef: string;
  researchDatasetRef: string;
  inputFingerprintSha256: string;
  outputFingerprintSha256: string;
  evidenceFingerprintSha256: string;
}

type Row = Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function cleanText(value: string, field: string, maximum = 300): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new MatterIntelligenceError(
      'INVALID_INPUT',
      `${field} must contain between 1 and ${maximum} characters.`,
      422
    );
  return cleaned;
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new MatterIntelligenceError('INVALID_INPUT', 'workspaceId must be a Workspace UUID.', 422);
  return cleaned;
}

function observedDays(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new MatterIntelligenceError(
      'INVALID_INPUT',
      'observedCompletedDurationDays must be a non-negative safe integer.',
      422
    );
  return value;
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new MatterIntelligenceError('CAPABILITY_CONTRACT_MISMATCH', `${field} is invalid.`);
  return parsed.toISOString();
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!SHA256.test(cleaned))
    throw new MatterIntelligenceError('CAPABILITY_CONTRACT_MISMATCH', `${field} is invalid.`);
  return cleaned;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new MatterIntelligenceError(
      'CAPABILITY_CONTRACT_MISMATCH',
      `${field} must be an object.`
    );
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], field: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new MatterIntelligenceError(
      'CAPABILITY_CONTRACT_MISMATCH',
      `${field} has drifted from the accepted contract.`
    );
}

function exactEvidenceRef(refs: readonly string[], prefix: string, field: string): string {
  const matches = refs.filter((ref) => ref.startsWith(prefix));
  if (matches.length !== 1)
    throw new MatterIntelligenceError(
      'CAPABILITY_CONTRACT_MISMATCH',
      `${field} must contain exactly one ${prefix} reference.`
    );
  return matches[0]!;
}

function parseDurationBandOutput(value: unknown, expectedDays: number): DurationBandOutput {
  const output = record(value, 'Capability output');
  exactKeys(
    output,
    [
      'schemaVersion',
      'kind',
      'jurisdiction',
      'procedure',
      'observedCompletedDurationDays',
      'historicalBand',
      'datasetRefId',
      'thresholds',
      'semantics',
      'descriptiveInterpretationOnly',
      'legalConclusion',
      'predictiveClaim',
      'riskClaim',
      'probabilityClaim',
      'recommendation',
      'currentCaseStatusInferred',
      'productBusinessStateMutated'
    ],
    'Capability output'
  );
  const thresholds = record(output.thresholds, 'Capability output thresholds');
  exactKeys(thresholds, ['p25Days', 'medianDays', 'p75Days'], 'Capability output thresholds');
  if (
    output.schemaVersion !== 1 ||
    output.kind !== 'CN_COMPLETED_DURATION_HISTORICAL_BAND_CLASSIFICATION_V1' ||
    output.jurisdiction !== 'CN' ||
    output.procedure !== 'FILING_TO_PRELIMINARY_PUBLICATION' ||
    output.observedCompletedDurationDays !== expectedDays ||
    typeof output.historicalBand !== 'string' ||
    !(HISTORICAL_BANDS as readonly string[]).includes(output.historicalBand) ||
    output.datasetRefId !== CN_DURATION_BAND_ACCEPTED_DATASET_REF ||
    thresholds.p25Days !== 335 ||
    thresholds.medianDays !== 336 ||
    thresholds.p75Days !== 383 ||
    output.semantics !== 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION' ||
    output.descriptiveInterpretationOnly !== true ||
    output.legalConclusion !== false ||
    output.predictiveClaim !== false ||
    output.riskClaim !== false ||
    output.probabilityClaim !== false ||
    output.recommendation !== false ||
    output.currentCaseStatusInferred !== false ||
    output.productBusinessStateMutated !== false
  )
    throw new MatterIntelligenceError(
      'CAPABILITY_CONTRACT_MISMATCH',
      'Capability output is outside the accepted descriptive Phase 5 contract.'
    );
  return clone(output) as unknown as DurationBandOutput;
}

function capabilityIdempotencyKey(input: Readonly<{
  workspaceId: string;
  formalMatterId: FormalMatterId;
  productIdempotencyKey: string;
  observedCompletedDurationDays: number;
}>): string {
  return `markreg-matter-intelligence:${fingerprint(input)}`;
}

function exactInput(observedCompletedDurationDays: number) {
  return {
    jurisdiction: 'CN' as const,
    authority: 'CNIPA' as const,
    objectType: 'TRADEMARK_APPLICATION' as const,
    operation: 'CLASSIFY_COMPLETED_DURATION_HISTORICAL_BAND' as const,
    procedure: 'FILING_TO_PRELIMINARY_PUBLICATION' as const,
    stage: 'COMPLETED_INTERVAL_INTERPRETATION' as const,
    filingBasis: 'ANY' as const,
    segment: 'FILING_TO_PRELIM_PUBLICATION' as const,
    availableData: [...REQUIRED_AVAILABLE_DATA],
    acceptedResearchDatasetRef: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
    observedCompletedDurationDays
  };
}

function exactPurpose(formalMatterId: FormalMatterId): string {
  return `Record descriptive completed-duration historical band for MarkReg Formal Matter ${formalMatterId}.`;
}

function assertExecution(
  execution: GovernedCapabilityRuntimeExecutionV2,
  expected: Readonly<{
    workspaceId: string;
    formalMatterId: FormalMatterId;
    observedCompletedDurationDays: number;
    principal: WorkspacePrincipal;
    capabilityIdempotencyKey: string;
    correlationId: string;
  }>
): ValidatedDurationBandCapabilityResult {
  const request = execution.request;
  const expectedRequestInput = exactInput(expected.observedCompletedDurationDays);
  if (
    request.capabilityId !== MATTER_INTELLIGENCE_CAPABILITY_ID ||
    request.capabilityVersion !== MATTER_INTELLIGENCE_CAPABILITY_VERSION ||
    request.inputSchemaId !== MATTER_INTELLIGENCE_INPUT_SCHEMA ||
    request.outputSchemaId !== MATTER_INTELLIGENCE_OUTPUT_SCHEMA ||
    request.riskClass !== 'LOW' ||
    request.idempotencyKey !== expected.capabilityIdempotencyKey ||
    request.correlationId !== expected.correlationId ||
    request.purpose !== exactPurpose(expected.formalMatterId) ||
    request.caller.workspaceId !== expected.workspaceId ||
    request.caller.principalId !== expected.principal.userId ||
    request.caller.callerProduct !== 'MARKREG' ||
    request.caller.permissionContextRef !==
      `core-workspace-membership:${expected.principal.membershipId}` ||
    request.caller.entitlementContextRef !== undefined ||
    canonical(request.input) !== canonical(expectedRequestInput)
  )
    throw new MatterIntelligenceError(
      'CAPABILITY_CONTRACT_MISMATCH',
      'Capability execution request does not match the exact MarkReg product command.'
    );

  if (
    execution.binding.runtimeCapability.capabilityId !== MATTER_INTELLIGENCE_CAPABILITY_ID ||
    execution.binding.runtimeCapability.capabilityVersion !== MATTER_INTELLIGENCE_CAPABILITY_VERSION ||
    execution.receipt.workspaceId !== expected.workspaceId ||
    execution.receipt.principalId !== expected.principal.userId ||
    execution.receipt.callerProduct !== 'MARKREG' ||
    execution.receipt.correlationId !== expected.correlationId ||
    execution.receipt.runtimeCapability.capabilityId !== MATTER_INTELLIGENCE_CAPABILITY_ID ||
    execution.receipt.runtimeCapability.capabilityVersion !== MATTER_INTELLIGENCE_CAPABILITY_VERSION ||
    execution.outcome.outputSchemaId !== MATTER_INTELLIGENCE_OUTPUT_SCHEMA ||
    execution.returnValue.outputSchemaId !== MATTER_INTELLIGENCE_OUTPUT_SCHEMA
  )
    throw new MatterIntelligenceError(
      'CAPABILITY_CONTRACT_MISMATCH',
      'Capability receipt or binding does not match the accepted MarkReg Capability identity.'
    );

  const output = parseDurationBandOutput(
    execution.returnValue.output,
    expected.observedCompletedDurationDays
  );
  if (canonical(execution.outcome.output) !== canonical(output))
    throw new MatterIntelligenceError(
      'CAPABILITY_CONTRACT_MISMATCH',
      'Capability outcome and return output differ.'
    );

  const refs = execution.receipt.evidenceRefs;
  const methodPackageRef = exactEvidenceRef(refs, 'brain-method-package:', 'evidenceRefs');
  const methodRef = exactEvidenceRef(refs, 'brain-method:', 'evidenceRefs');
  const methodVersionRef = exactEvidenceRef(refs, 'brain-method-version:', 'evidenceRefs');
  const evaluationRef = exactEvidenceRef(refs, 'brain-method-evaluation:', 'evidenceRefs');
  const researchDatasetRef = exactEvidenceRef(refs, 'research-dataset:', 'evidenceRefs');
  if (!researchDatasetRef.startsWith(`research-dataset:${CN_DURATION_BAND_ACCEPTED_DATASET_REF}:`))
    throw new MatterIntelligenceError(
      'CAPABILITY_CONTRACT_MISMATCH',
      'Capability evidence is not bound to the accepted CN duration research dataset.'
    );

  return {
    execution,
    output,
    methodPackageRef,
    methodRef,
    methodVersionRef,
    evaluationRef,
    researchDatasetRef,
    inputFingerprintSha256: fingerprint(request.input),
    outputFingerprintSha256: fingerprint(output),
    evidenceFingerprintSha256: fingerprint(refs)
  };
}

export class HttpCnDurationBandCapabilityClient implements MatterIntelligenceCapabilityClient {
  constructor(
    private readonly capabilityUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async classifyCompletedDuration(input: Readonly<{
    workspaceId: string;
    formalMatterId: FormalMatterId;
    observedCompletedDurationDays: number;
    principal: WorkspacePrincipal;
    productIdempotencyKey: string;
    correlationId: string;
  }>): Promise<Readonly<ValidatedDurationBandCapabilityResult>> {
    const capabilityKey = capabilityIdempotencyKey(input);
    const command: CapabilityRequestV2Command = {
      schemaVersion: 2,
      capabilityId: MATTER_INTELLIGENCE_CAPABILITY_ID,
      capabilityVersion: MATTER_INTELLIGENCE_CAPABILITY_VERSION,
      caller: {
        workspaceId: input.workspaceId,
        principalId: input.principal.userId,
        callerProduct: 'MARKREG',
        permissionContextRef: `core-workspace-membership:${input.principal.membershipId}`
      },
      purpose: exactPurpose(input.formalMatterId),
      input: exactInput(input.observedCompletedDurationDays),
      inputSchemaId: MATTER_INTELLIGENCE_INPUT_SCHEMA,
      outputSchemaId: MATTER_INTELLIGENCE_OUTPUT_SCHEMA,
      riskClass: 'LOW',
      idempotencyKey: capabilityKey,
      correlationId: input.correlationId
    };

    let response: Response;
    try {
      response = await this.fetcher(`${this.capabilityUrl.replace(/\/$/, '')}/v1/capability-requests`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(input.principal),
          'x-markorbit-workspace-id': input.workspaceId,
          'x-markorbit-caller-product': 'MARKREG',
          'idempotency-key': capabilityKey,
          'x-correlation-id': input.correlationId
        },
        body: JSON.stringify(command)
      });
    } catch (cause) {
      throw new MatterIntelligenceError(
        'CAPABILITY_UNAVAILABLE',
        'Governed Capability Runtime is unavailable.',
        503,
        true,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }

    if (!response.ok) {
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = undefined;
      }
      throw new MatterIntelligenceError(
        response.status >= 500 ? 'CAPABILITY_UNAVAILABLE' : 'CAPABILITY_REJECTED',
        response.status >= 500
          ? 'Governed Capability Runtime is unavailable.'
          : 'Governed Capability Runtime rejected the MarkReg request.',
        response.status >= 500 ? 503 : 409,
        response.status >= 500,
        details && typeof details === 'object' ? (details as Record<string, unknown>) : undefined
      );
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (cause) {
      throw new MatterIntelligenceError(
        'CAPABILITY_CONTRACT_MISMATCH',
        'Governed Capability Runtime returned invalid JSON.',
        502,
        false,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }

    let execution: GovernedCapabilityRuntimeExecutionV2;
    try {
      execution = parseGovernedCapabilityRuntimeExecutionV2(raw);
    } catch (cause) {
      if (cause instanceof CapabilityRuntimeExecutionContractError)
        throw new MatterIntelligenceError(
          'CAPABILITY_CONTRACT_MISMATCH',
          cause.message,
          502,
          false,
          undefined,
          { cause }
        );
      throw cause;
    }
    return assertExecution(execution, {
      workspaceId: input.workspaceId,
      formalMatterId: input.formalMatterId,
      observedCompletedDurationDays: input.observedCompletedDurationDays,
      principal: input.principal,
      capabilityIdempotencyKey: capabilityKey,
      correlationId: input.correlationId
    });
  }
}

function observationId(): MatterIntelligenceObservationId {
  return `matter-intelligence-observation_${randomUUID().replaceAll('-', '')}`;
}

export class PostgresMatterIntelligenceRepository implements MatterIntelligenceRepository {
  constructor(
    private readonly database: TransactionHost,
    private readonly query: QueryClient
  ) {}

  async findCommandReplay(workspaceId: string, idempotencyKey: string): Promise<CommandReplay | undefined> {
    try {
      const result = await this.query.query(
        'SELECT request_fingerprint_sha256,result_snapshot FROM markreg_matter_intelligence_commands WHERE workspace_id=$1 AND idempotency_key=$2',
        [workspaceId, idempotencyKey]
      );
      if (!result.rowCount) return undefined;
      const row = result.rows[0] as Row;
      return {
        requestFingerprintSha256: String(row.request_fingerprint_sha256),
        result: clone(row.result_snapshot as MatterIntelligenceDisposition)
      };
    } catch (cause) {
      throw new MatterIntelligenceError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg Matter Intelligence persistence is unavailable.',
        503,
        true,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async record(value: Readonly<ObservationWrite>): Promise<MatterIntelligenceDisposition> {
    try {
      return await this.database.transact(async (client) => {
        const replay = await client.query(
          'SELECT request_fingerprint_sha256,result_snapshot FROM markreg_matter_intelligence_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
          [value.observation.workspaceId, value.idempotencyKey]
        );
        if (replay.rowCount) {
          const row = replay.rows[0] as Row;
          if (String(row.request_fingerprint_sha256) !== value.requestFingerprintSha256)
            throw new MatterIntelligenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency-Key was already used for a different Matter Intelligence request.'
            );
          return clone(row.result_snapshot as MatterIntelligenceDisposition);
        }

        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${value.observation.workspaceId}:${value.observation.capabilityReturnId}:matter-intelligence`
        ]);
        const duplicate = await client.query(
          'SELECT * FROM markreg_matter_intelligence_observations WHERE workspace_id=$1 AND capability_return_id=$2 LIMIT 1',
          [value.observation.workspaceId, value.observation.capabilityReturnId]
        );

        let observation = value.observation;
        let semanticDuplicate = false;
        if (duplicate.rowCount) {
          observation = this.mapObservation(duplicate.rows[0] as Row);
          if (observation.formalMatter.id !== value.observation.formalMatter.id)
            throw new MatterIntelligenceError(
              'CAPABILITY_CONTRACT_MISMATCH',
              'The exact Capability return is already bound to a different Formal Matter.'
            );
          if (observation.sessionReceiptId !== value.observation.sessionReceiptId)
            throw new MatterIntelligenceError(
              'CAPABILITY_CONTRACT_MISMATCH',
              'Capability return/session receipt identity is inconsistent with persisted history.'
            );
          semanticDuplicate = true;
        } else {
          await this.insertObservation(client, observation);
        }

        const disposition: MatterIntelligenceDisposition = {
          observation,
          replayed: false,
          semanticDuplicate,
          capabilityReplayed: value.capabilityReplayed
        };
        await client.query(
          'INSERT INTO markreg_matter_intelligence_commands (workspace_id,idempotency_key,request_fingerprint_sha256,matter_intelligence_observation_id,result_snapshot,correlation_id,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)',
          [
            observation.workspaceId,
            value.idempotencyKey,
            value.requestFingerprintSha256,
            observation.matterIntelligenceObservationId,
            JSON.stringify(disposition),
            value.correlationId,
            observation.recordedAt
          ]
        );
        return disposition;
      });
    } catch (cause) {
      if (cause instanceof MatterIntelligenceError) throw cause;
      throw new MatterIntelligenceError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg Matter Intelligence persistence is unavailable.',
        503,
        true,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  private async insertObservation(client: QueryClient, value: MarkRegMatterIntelligenceObservationV1) {
    await client.query(
      'INSERT INTO markreg_matter_intelligence_observations (matter_intelligence_observation_id,workspace_id,formal_matter_id,formal_matter_version,formal_matter_snapshot_sha256,observation_kind,observed_completed_duration_days,historical_band,dataset_ref_id,capability_id,capability_version,input_schema_id,output_schema_id,capability_request_id,capability_invocation_id,capability_outcome_id,capability_return_id,session_receipt_id,implementation_profile_id,implementation_version,implementation_key,correlation_id,method_package_ref,method_ref,method_version_ref,evaluation_ref,research_dataset_ref,evidence_refs,evidence_fingerprint_sha256,input_fingerprint_sha256,output_fingerprint_sha256,recorded_by_principal_id,recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28::jsonb,$29,$30,$31,$32,$33)',
      [
        value.matterIntelligenceObservationId,
        value.workspaceId,
        value.formalMatter.id,
        value.formalMatter.version,
        value.formalMatter.snapshotSha256,
        value.observationKind,
        value.observedCompletedDurationDays,
        value.historicalBand,
        value.datasetRefId,
        value.capability.id,
        value.capability.version,
        value.capability.inputSchemaId,
        value.capability.outputSchemaId,
        value.capabilityRequestId,
        value.capabilityInvocationId,
        value.capabilityOutcomeId,
        value.capabilityReturnId,
        value.sessionReceiptId,
        value.implementation.id,
        value.implementation.version,
        value.implementation.implementationKey,
        value.correlationId,
        value.methodPackageRef,
        value.methodRef,
        value.methodVersionRef,
        value.evaluationRef,
        value.researchDatasetRef,
        JSON.stringify(value.evidenceRefs),
        value.evidenceFingerprintSha256,
        value.inputFingerprintSha256,
        value.outputFingerprintSha256,
        value.recordedByPrincipalId,
        value.recordedAt
      ]
    );
  }

  private mapObservation(row: Row): MarkRegMatterIntelligenceObservationV1 {
    return {
      schemaVersion: 1,
      matterIntelligenceObservationId: String(
        row.matter_intelligence_observation_id
      ) as MatterIntelligenceObservationId,
      workspaceId: String(row.workspace_id),
      formalMatter: {
        id: String(row.formal_matter_id) as FormalMatterId,
        version: Number(row.formal_matter_version),
        snapshotSha256: String(row.formal_matter_snapshot_sha256)
      },
      observationKind: MATTER_INTELLIGENCE_OBSERVATION_KIND,
      observedCompletedDurationDays: Number(row.observed_completed_duration_days),
      historicalBand: String(row.historical_band) as CnCompletedDurationHistoricalBandV1,
      datasetRefId: String(row.dataset_ref_id) as typeof CN_DURATION_BAND_ACCEPTED_DATASET_REF,
      capability: {
        id: MATTER_INTELLIGENCE_CAPABILITY_ID,
        version: MATTER_INTELLIGENCE_CAPABILITY_VERSION,
        inputSchemaId: MATTER_INTELLIGENCE_INPUT_SCHEMA,
        outputSchemaId: MATTER_INTELLIGENCE_OUTPUT_SCHEMA
      },
      capabilityRequestId: String(row.capability_request_id),
      capabilityInvocationId: String(row.capability_invocation_id),
      capabilityOutcomeId: String(row.capability_outcome_id),
      capabilityReturnId: String(row.capability_return_id),
      sessionReceiptId: String(row.session_receipt_id),
      implementation: {
        id: String(row.implementation_profile_id),
        version: Number(row.implementation_version),
        implementationKey: String(row.implementation_key)
      },
      correlationId: String(row.correlation_id),
      methodPackageRef: String(row.method_package_ref),
      methodRef: String(row.method_ref),
      methodVersionRef: String(row.method_version_ref),
      evaluationRef: String(row.evaluation_ref),
      researchDatasetRef: String(row.research_dataset_ref),
      evidenceRefs: clone(row.evidence_refs as string[]),
      evidenceFingerprintSha256: exactSha256(
        String(row.evidence_fingerprint_sha256),
        'evidenceFingerprintSha256'
      ),
      inputFingerprintSha256: exactSha256(
        String(row.input_fingerprint_sha256),
        'inputFingerprintSha256'
      ),
      outputFingerprintSha256: exactSha256(
        String(row.output_fingerprint_sha256),
        'outputFingerprintSha256'
      ),
      recordedByPrincipalId: String(row.recorded_by_principal_id),
      recordedAt: exactTimestamp(String(row.recorded_at), 'recordedAt')
    };
  }
}

export class MatterIntelligenceService {
  constructor(
    private readonly repository: MatterIntelligenceRepository,
    private readonly formalMatters: Pick<FormalMatterRepository, 'findById'>,
    private readonly capability: MatterIntelligenceCapabilityClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly ids: () => MatterIntelligenceObservationId = observationId
  ) {}

  async recordCompletedDurationBand(
    commandValue: Readonly<RecordMatterIntelligenceCommand>
  ): Promise<MatterIntelligenceDisposition> {
    const workspaceId = cleanWorkspaceId(commandValue.workspaceId);
    const formalMatterId = cleanText(
      commandValue.formalMatterId,
      'formalMatterId',
      300
    ) as FormalMatterId;
    const durationDays = observedDays(commandValue.observedCompletedDurationDays);
    const idempotencyKey = cleanText(commandValue.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = cleanText(commandValue.correlationId, 'correlationId', 300);
    const principal = commandValue.principal;
    if (principal.kind !== 'WORKSPACE')
      throw new MatterIntelligenceError(
        'AUTHENTICATION_REQUIRED',
        'A trusted Workspace Principal is required.',
        401
      );
    if (principal.workspaceId !== workspaceId)
      throw new MatterIntelligenceError(
        'WORKSPACE_MISMATCH',
        'Workspace context does not match Principal truth.',
        403
      );
    if (!principal.permissions.includes('workspace:read') || !principal.permissions.includes('matter:manage'))
      throw new MatterIntelligenceError(
        'PERMISSION_DENIED',
        'workspace:read and matter:manage permissions are required.',
        403
      );

    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      formalMatterId,
      observedCompletedDurationDays: durationDays,
      principalId: principal.userId
    });
    const replay = await this.repository.findCommandReplay(workspaceId, idempotencyKey);
    if (replay) {
      if (replay.requestFingerprintSha256 !== requestFingerprintSha256)
        throw new MatterIntelligenceError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key was already used for a different Matter Intelligence request.'
        );
      return { ...clone(replay.result), replayed: true };
    }

    const matter = await this.formalMatters.findById(workspaceId, formalMatterId);
    if (!matter)
      throw new MatterIntelligenceError(
        'FORMAL_MATTER_NOT_FOUND',
        'Formal Matter was not found in the requested Workspace.',
        404
      );

    const result = await this.capability.classifyCompletedDuration({
      workspaceId,
      formalMatterId,
      observedCompletedDurationDays: durationDays,
      principal,
      productIdempotencyKey: idempotencyKey,
      correlationId
    });
    const recordedAt = exactTimestamp(this.now(), 'recordedAt');
    const observation: MarkRegMatterIntelligenceObservationV1 = {
      schemaVersion: 1,
      matterIntelligenceObservationId: this.ids(),
      workspaceId,
      formalMatter: {
        id: matter.formalMatterId,
        version: matter.version,
        snapshotSha256: exactSha256(matter.snapshotSha256, 'formalMatter.snapshotSha256')
      },
      observationKind: MATTER_INTELLIGENCE_OBSERVATION_KIND,
      observedCompletedDurationDays: durationDays,
      historicalBand: result.output.historicalBand,
      datasetRefId: result.output.datasetRefId,
      capability: {
        id: MATTER_INTELLIGENCE_CAPABILITY_ID,
        version: MATTER_INTELLIGENCE_CAPABILITY_VERSION,
        inputSchemaId: MATTER_INTELLIGENCE_INPUT_SCHEMA,
        outputSchemaId: MATTER_INTELLIGENCE_OUTPUT_SCHEMA
      },
      capabilityRequestId: result.execution.request.capabilityRequestId,
      capabilityInvocationId: result.execution.invocation.capabilityInvocationId,
      capabilityOutcomeId: result.execution.outcome.capabilityOutcomeId,
      capabilityReturnId: result.execution.returnValue.capabilityReturnId,
      sessionReceiptId: result.execution.receipt.sessionReceiptId,
      implementation: {
        id: result.execution.receipt.implementation.id,
        version: result.execution.receipt.implementation.version,
        implementationKey: result.execution.receipt.implementation.implementationKey
      },
      correlationId,
      methodPackageRef: result.methodPackageRef,
      methodRef: result.methodRef,
      methodVersionRef: result.methodVersionRef,
      evaluationRef: result.evaluationRef,
      researchDatasetRef: result.researchDatasetRef,
      evidenceRefs: [...result.execution.receipt.evidenceRefs],
      evidenceFingerprintSha256: result.evidenceFingerprintSha256,
      inputFingerprintSha256: result.inputFingerprintSha256,
      outputFingerprintSha256: result.outputFingerprintSha256,
      recordedByPrincipalId: principal.userId,
      recordedAt
    };

    return this.repository.record({
      observation,
      idempotencyKey,
      requestFingerprintSha256,
      correlationId,
      capabilityReplayed: result.execution.replayed
    });
  }
}
