import type { WorkspaceChannelIdentityBindingV1 } from '@markorbit/contracts/channel-identity-binding';

export interface MaterializedSmsTransportV1 {
  workspaceId: string;
  identityBinding: Readonly<WorkspaceChannelIdentityBindingV1>;
  recipient: string;
  textContent: string;
  endpointFingerprintSha256: string;
  metadataTags: readonly Readonly<{
    name: string;
    value: string;
  }>[];
}

export type SmsTransportSubmissionResultV1 =
  | Readonly<{ status: 'ACCEPTED'; providerSubmissionRef: string }>
  | Readonly<{ status: 'FAILED'; reasonCode: string }>
  | Readonly<{ status: 'UNKNOWN'; reasonCode: string }>;

/**
 * Transport-only SMS boundary.
 * The injected adapter must honor identityBinding.connection.implementationRef and resolve
 * its safe OAuth/external credential reference through trusted Core C6D inside submit().
 * It never selects a provider/profile and never creates external-send authority.
 */
export interface SmsTransportProviderV1 {
  submit(
    materialized: Readonly<MaterializedSmsTransportV1>
  ): Promise<SmsTransportSubmissionResultV1>;
}
