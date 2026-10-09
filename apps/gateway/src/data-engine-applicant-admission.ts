import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ResolvedEntitlementV1 } from '@markorbit/contracts/workspace-commercial';
import type { ApplicantDiscoveryEnvelopeV1 } from '@markorbit/contracts/data-engine-applicant-discovery';
import { DATA_ENGINE_DISCOVERY_CONTRACT_VERSION } from '@markorbit/contracts/data-engine-discovery';
import { HttpError, type JsonRequest } from '@markorbit/service-kit';
import {
  resolveCurrentWorkspaceEntitlementV1,
  type GatewayWorkspaceCommercialOptionsV1
} from './workspace-commercial-http.js';

// Trusted server configuration for this one read path, not a grant store or provider wire contract.
export interface USApplicantNameAdmission {
  revision: string;
  entitlementKey: string;
  datasetVersion: string;
  sourceVersion: string;
  licenceReference: string;
  permittedUse: 'SEARCH:PORTFOLIO';
  readiness: 'ACCEPTED';
  coverageThrough: string;
  maximumCoverageAgeMs: number;
  validUntil: string;
}

export interface USApplicantNameAdmissionOptions {
  core: GatewayWorkspaceCommercialOptionsV1;
  readAdmission: (signal: AbortSignal) => Promise<Readonly<USApplicantNameAdmission> | null>;
  now?: () => Date;
}

function unavailable(code = 'DATA_ENGINE_DATA_USE_UNAVAILABLE'): never {
  throw new HttpError(503, code, 'Current data-use admission evidence is unavailable.', true);
}

const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();

function evidenceCurrent(admission: Readonly<USApplicantNameAdmission>, at: number) {
  if (
    !Number.isFinite(at) ||
    !text(admission.revision) ||
    !text(admission.entitlementKey) ||
    admission.datasetVersion !== DATA_ENGINE_DISCOVERY_CONTRACT_VERSION ||
    !text(admission.sourceVersion) ||
    !text(admission.licenceReference) ||
    admission.readiness !== 'ACCEPTED' ||
    !Number.isSafeInteger(admission.maximumCoverageAgeMs) ||
    admission.maximumCoverageAgeMs < 0 ||
    !Number.isFinite(Date.parse(admission.validUntil)) ||
    Date.parse(admission.validUntil) <= at ||
    !Number.isFinite(Date.parse(admission.coverageThrough)) ||
    Date.parse(admission.coverageThrough) > at ||
    at - Date.parse(admission.coverageThrough) > admission.maximumCoverageAgeMs
  )
    unavailable();
  if (admission.permittedUse !== 'SEARCH:PORTFOLIO')
    throw new HttpError(403, 'DATA_ENGINE_DATA_USE_DENIED', 'This data use is not permitted.');
}

export async function admitUSApplicantNameRead(
  request: JsonRequest,
  actor: WorkspacePrincipal,
  options: USApplicantNameAdmissionOptions | undefined
) {
  if (!options) unavailable();
  if (!text(options.core.coreUrl) || !text(options.core.internalServiceSecret)) unavailable();
  const timeoutMs = options.core.timeoutMs ?? 3_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) unavailable();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let admission: Readonly<USApplicantNameAdmission> | null;
  try {
    admission = await Promise.race([
      options.readAdmission(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Admission read timed out.'));
        }, timeoutMs);
      })
    ]);
    if (admission) admission = structuredClone(admission);
  } catch {
    unavailable();
  } finally {
    clearTimeout(timer);
  }
  if (!admission) unavailable();
  const now = options.now ?? (() => new Date());
  const instant = now();
  if (!Number.isFinite(instant.valueOf())) unavailable();
  evidenceCurrent(admission, instant.valueOf());
  const { evaluatedAt, response } = await resolveCurrentWorkspaceEntitlementV1(
    request,
    options.core,
    actor,
    admission.entitlementKey,
    () => instant
  );
  if (response.status !== 200) {
    if ([401, 403, 404].includes(response.status))
      throw new HttpError(
        403,
        'DATA_ENGINE_DATA_USE_DENIED',
        'Current data-use permission is required.'
      );
    if (response.status === 409)
      throw new HttpError(409, 'DATA_ENGINE_DATA_USE_CONFLICT', 'Current authority is conflicted.');
    unavailable();
  }
  const result = response.body as Partial<ResolvedEntitlementV1> | null;
  if (
    !result ||
    result.schemaVersion !== 1 ||
    result.subject?.scope !== 'WORKSPACE' ||
    result.subject.workspaceId !== actor.workspaceId ||
    result.key !== admission.entitlementKey ||
    result.resolvedAt !== evaluatedAt ||
    result.value?.kind !== 'BOOLEAN' ||
    !Array.isArray(result.contributingGrantRefs) ||
    result.contributingGrantRefs.length === 0 ||
    result.contributingGrantRefs.some((value: unknown) => {
      if (!value || typeof value !== 'object') return true;
      const ref = value as Partial<ResolvedEntitlementV1['contributingGrantRefs'][number]>;
      return !text(ref.grantId) || !Number.isSafeInteger(ref.version) || (ref.version ?? 0) < 1;
    })
  )
    unavailable('DATA_ENGINE_DATA_USE_EVALUATION_INVALID');
  if (result.value.enabled !== true)
    throw new HttpError(
      403,
      'DATA_ENGINE_DATA_USE_DENIED',
      'Current data-use permission is required.'
    );
  return { admission, evaluatedAt, now };
}

export function verifyAdmittedApplicantPage(
  envelope: ApplicantDiscoveryEnvelopeV1,
  decision: Awaited<ReturnType<typeof admitUSApplicantNameRead>>
) {
  evidenceCurrent(decision.admission, decision.now().valueOf());
  // Legacy null not_found responses have no snapshot and cannot prove admitted coverage/version.
  if (!envelope.payload)
    throw new HttpError(
      503,
      'DATA_ENGINE_DATA_USE_SOURCE_EVIDENCE_MISSING',
      'Current data-use source evidence is unavailable.',
      true,
      { factState: envelope.fact_state, coverageState: 'unknown' }
    );
  if (envelope.payload.source_snapshot.source_version !== decision.admission.sourceVersion)
    throw new HttpError(
      409,
      'DATA_ENGINE_DATA_USE_SOURCE_CONFLICT',
      'The data source version changed.'
    );
}
