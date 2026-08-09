import { createHash } from 'node:crypto';
import type { ProviderExecutionSourceSnapshot } from '@markorbit/contracts/provider-execution';
import type {
  ExecutionReleaseRepository,
  FilingAuthorizationRepository,
  FilingExecutionTaskDraftRepository
} from './filing-authorization.js';

export interface ProviderExecutionSourceVerification {
  status: 'CURRENT' | 'STALE' | 'MISSING';
  exactSourceFingerprintSha256?: string;
  reason?: string;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function providerExecutionSourceFingerprint(
  source: Omit<ProviderExecutionSourceSnapshot, 'sourceFingerprintSha256'>
): string {
  return createHash('sha256').update(stableSerialize(source)).digest('hex');
}

function fingerprintOf(source: Readonly<ProviderExecutionSourceSnapshot>) {
  const { sourceFingerprintSha256: _fingerprint, ...unsigned } = source;
  return providerExecutionSourceFingerprint(unsigned);
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return [...left].sort().join('\u0000') === [...right].sort().join('\u0000');
}

function version(value: number | string) {
  return String(value);
}

export class ProviderExecutionSourceVerificationService {
  constructor(
    private readonly authorizations: FilingAuthorizationRepository,
    private readonly releases: ExecutionReleaseRepository,
    private readonly tasks: FilingExecutionTaskDraftRepository
  ) {}

  async verifyCurrentSource(
    source: Readonly<ProviderExecutionSourceSnapshot>
  ): Promise<ProviderExecutionSourceVerification> {
    const [authorization, release, task] = await Promise.all([
      this.authorizations.findById(source.filingAuthorization.id),
      this.releases.findById(source.executionRelease.id),
      this.tasks.findById(source.filingExecutionTaskDraft.id)
    ]);
    if (!authorization || !release || !task)
      return { status: 'MISSING', reason: 'Exact Execution source records were not found.' };

    const exactLineage =
      authorization.status === 'AUTHORIZED' &&
      release.status === 'RELEASED_FOR_EXECUTION' &&
      task.status === 'PREPARED' &&
      version(source.preparationLock.version) === version(authorization.preparationLockVersion) &&
      source.preparationLock.id === authorization.preparationLockId &&
      version(source.filingAuthorization.version) === version(authorization.version) &&
      release.filingAuthorizationId === authorization.filingAuthorizationId &&
      release.filingAuthorizationVersion === authorization.version &&
      version(source.executionRelease.version) === version(release.version) &&
      task.executionReleaseId === release.executionReleaseId &&
      task.filingAuthorizationId === authorization.filingAuthorizationId &&
      task.preparationLockId === authorization.preparationLockId &&
      version(source.filingExecutionTaskDraft.version) === '1' &&
      source.jurisdiction === authorization.scope.jurisdiction &&
      source.jurisdiction === release.jurisdiction &&
      source.jurisdiction === task.jurisdiction &&
      source.executionWindow.startsAt === authorization.scope.permittedExecutionWindow.startsAt &&
      source.executionWindow.endsAt === authorization.scope.permittedExecutionWindow.endsAt &&
      sameStrings(source.documentReferences, task.documentReferences) &&
      sameStrings(source.instructionReferences, task.instructionReferences) &&
      source.serviceType === 'TRADEMARK_FILING' &&
      task.classes.every((value) => source.serviceScope.includes(`CLASS_${value}`));

    if (!exactLineage)
      return {
        status: 'STALE',
        reason: 'Execution source IDs, versions or governed scope no longer match current truth.'
      };

    const exactSourceFingerprintSha256 = fingerprintOf(source);
    if (source.sourceFingerprintSha256 !== exactSourceFingerprintSha256)
      return {
        status: 'STALE',
        reason: 'Execution source fingerprint does not match the exact source snapshot.'
      };

    return { status: 'CURRENT', exactSourceFingerprintSha256 };
  }
}
