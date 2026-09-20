import { createHash } from 'node:crypto';
import type { OutboundContactTargetReferenceV1 } from '@markorbit/contracts/outbound-contact-policy';
import type {
  WorkspaceDirectoryContactPointV1,
  WorkspaceDirectoryEntryId
} from '@markorbit/contracts/workspace-directory';

export type SmsEndpointResolutionState =
  | 'CURRENT'
  | 'STALE'
  | 'NOT_FOUND'
  | 'UNKNOWN'
  | 'UNAVAILABLE';

export interface SmsEndpointResolutionV1 {
  state: SmsEndpointResolutionState;
  endpointFingerprintSha256?: string;
  endpoint?: string;
}

type SmsDirectoryEntryProjection = Readonly<{
  version: number;
  status: string;
  contactPoints: ReadonlyArray<Readonly<WorkspaceDirectoryContactPointV1>>;
}>;

export interface WorkspaceDirectorySmsReaderV1 {
  getExact(
    workspaceId: string,
    id: WorkspaceDirectoryEntryId,
    version: number
  ): Promise<SmsDirectoryEntryProjection | undefined>;
  getLatest(
    workspaceId: string,
    id: WorkspaceDirectoryEntryId
  ): Promise<SmsDirectoryEntryProjection | undefined>;
}

const E164_V1 = /^\+[1-9][0-9]{7,14}$/u;

export function canonicalSmsEndpointV1(value: string): string | undefined {
  const candidate = value.trim();
  return E164_V1.test(candidate) ? candidate : undefined;
}

export function smsEndpointFingerprintSha256V1(endpoint: string): string {
  const canonical = canonicalSmsEndpointV1(endpoint);
  if (!canonical) throw new TypeError('SMS endpoint must be canonical E.164 V1.');
  return createHash('sha256')
    .update(`markorbit:sms:endpoint:v1\n${canonical}`, 'utf8')
    .digest('hex');
}

export class WorkspaceDirectorySmsEndpointResolverV1 {
  constructor(private readonly directory: WorkspaceDirectorySmsReaderV1) {}

  async resolve(
    workspaceId: string,
    targetRef: Readonly<OutboundContactTargetReferenceV1>
  ): Promise<SmsEndpointResolutionV1> {
    if (targetRef.owner !== 'LITE' || targetRef.kind !== 'WORKSPACE_DIRECTORY_ENTRY')
      return { state: 'UNKNOWN' };
    try {
      const id = targetRef.id as WorkspaceDirectoryEntryId;
      const [exact, latest] = await Promise.all([
        this.directory.getExact(workspaceId, id, targetRef.version),
        this.directory.getLatest(workspaceId, id)
      ]);
      if (!exact || !latest) return { state: 'NOT_FOUND' };
      if (latest.version !== targetRef.version || latest.status !== 'ACTIVE')
        return { state: 'STALE' };
      const phones = exact.contactPoints.filter((point) => point.kind === 'PHONE');
      if (phones.length === 0) return { state: 'NOT_FOUND' };
      if (phones.length !== 1) return { state: 'UNKNOWN' };
      const endpoint = canonicalSmsEndpointV1(phones[0]!.value);
      if (!endpoint) return { state: 'UNKNOWN' };
      return {
        state: 'CURRENT',
        endpoint,
        endpointFingerprintSha256: smsEndpointFingerprintSha256V1(endpoint)
      };
    } catch (error) {
      return (error as { code?: string }).code === 'PERSISTENCE_UNAVAILABLE'
        ? { state: 'UNAVAILABLE' }
        : { state: 'UNKNOWN' };
    }
  }
}
