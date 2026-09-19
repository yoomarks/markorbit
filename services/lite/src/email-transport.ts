export interface MaterializedEmailTransportV1 {
  workspaceId: string;
  routingPartitionRef: string;
  fromAddress: string;
  replyToAddress?: string;
  recipients: readonly string[];
  subject: string;
  textContent?: string;
  htmlContent?: string;
  metadataTags: readonly Readonly<{
    name: string;
    value: string;
  }>[];
}

export type EmailTransportSubmissionResultV1 =
  | Readonly<{ status: 'ACCEPTED'; providerSubmissionRef: string }>
  | Readonly<{ status: 'FAILED'; reasonCode: string }>
  | Readonly<{ status: 'UNKNOWN'; reasonCode: string }>;

/** Transport-only boundary. Possessing this adapter never creates external-send authority. */
export interface EmailTransportProviderV1 {
  submit(
    materialized: Readonly<MaterializedEmailTransportV1>
  ): Promise<EmailTransportSubmissionResultV1>;
}
