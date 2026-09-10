import { createHash } from 'node:crypto';
import type {
  ManagedCommunicationAttachmentRefV1,
  ManagedCommunicationMessageV1,
  ManagedCommunicationParticipantV1
} from '@markorbit/contracts/managed-communication';
import {
  managedCommunicationNormalizedIdsV1,
  type ManagedCommunicationFoundationStoreV1
} from './managed-communication-foundation.js';
import type {
  ManagedCommunicationPreparedProviderSendV1,
  ManagedCommunicationProviderSendContextV1,
  ManagedCommunicationProviderSenderV1,
  ManagedCommunicationSendRequestV1
} from './managed-communication-exchange.js';
import type {
  ManagedCommunicationEvidenceHeaderV1,
  ManagedCommunicationExactEvidenceStoreV1
} from './managed-communication-exact-evidence.js';

export const MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER = 'MICROSOFT_GRAPH';

const GRAPH_ORIGIN = 'https://graph.microsoft.com';
const GRAPH_BASE = `${GRAPH_ORIGIN}/v1.0`;
const IMMUTABLE_ID_PREFERENCE = 'IdType="ImmutableId"';
const SENSITIVE_EVIDENCE_HEADER =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/iu;

type FetchLike = typeof globalThis.fetch;

type GraphEmailAddress = Readonly<{
  name?: string;
  address?: string;
}>;

type GraphRecipient = Readonly<{
  emailAddress?: GraphEmailAddress;
}>;

type GraphMessage = Readonly<{
  id?: string;
  conversationId?: string;
  internetMessageId?: string;
  receivedDateTime?: string;
  subject?: string;
  body?: Readonly<{ contentType?: string; content?: string }>;
  from?: GraphRecipient;
  toRecipients?: readonly GraphRecipient[];
  ccRecipients?: readonly GraphRecipient[];
  bccRecipients?: readonly GraphRecipient[];
  replyTo?: readonly GraphRecipient[];
  hasAttachments?: boolean;
  internetMessageHeaders?: readonly Readonly<{ name?: string; value?: string }>[];
  '@removed'?: Readonly<{ reason?: string }>;
}>;

type GraphAttachment = Readonly<{
  id?: string;
  name?: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
}>;

type GraphDeltaPage = Readonly<{
  value?: readonly GraphMessage[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}>;

export type MicrosoftGraphManagedCommunicationErrorCode =
  | 'AUTHENTICATION_FAILURE'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TRANSPORT_FAILURE'
  | 'INVALID_RESPONSE'
  | 'INVALID_DELTA'
  | 'ACCOUNT_MISMATCH'
  | 'UNSUPPORTED_ATTACHMENT';

export class MicrosoftGraphManagedCommunicationError extends Error {
  constructor(
    readonly code: MicrosoftGraphManagedCommunicationErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MicrosoftGraphManagedCommunicationError';
  }
}

export interface MicrosoftGraphAccessTokenProviderV1 {
  accessToken(): Promise<string>;
}

export type MicrosoftGraphRefreshTokenConfigV1 = Readonly<{
  tenantId: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  scope?: string;
}>;

export type MicrosoftGraphManagedCommunicationInboundResultV1 = Readonly<{
  initialized: boolean;
  imported: number;
  providerCursor: string;
}>;

export type MicrosoftGraphProviderReplyReferenceV1 = Readonly<{
  providerMessageId: string;
  providerThreadId?: string;
}>;

export type MicrosoftGraphProviderReplyResolverV1 = (
  input: Readonly<{
    workspaceId: string;
    accountRef: string;
    threadRef: string;
  }>
) => Promise<Readonly<MicrosoftGraphProviderReplyReferenceV1> | undefined>;

function required(value: unknown, field: string, maxLength = 20_000): string {
  if (typeof value !== 'string') {
    throw new MicrosoftGraphManagedCommunicationError(
      'INVALID_RESPONSE',
      `${field} must be a string.`
    );
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new MicrosoftGraphManagedCommunicationError(
      'INVALID_RESPONSE',
      `${field} must contain 1 to ${maxLength} characters.`
    );
  }
  return normalized;
}

function configured(value: unknown, field: string, maxLength = 20_000): string {
  if (typeof value !== 'string') {
    throw new MicrosoftGraphManagedCommunicationError(
      'AUTHENTICATION_FAILURE',
      `${field} must be configured.`
    );
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new MicrosoftGraphManagedCommunicationError(
      'AUTHENTICATION_FAILURE',
      `${field} must contain 1 to ${maxLength} characters.`
    );
  }
  return normalized;
}

function canonicalTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new MicrosoftGraphManagedCommunicationError(
      'INVALID_RESPONSE',
      `${field} must be a valid timestamp.`
    );
  }
  return parsed.toISOString();
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function graphUrl(pathOrUrl: string): string {
  const url = pathOrUrl.startsWith('https://')
    ? new URL(pathOrUrl)
    : new URL(pathOrUrl, `${GRAPH_BASE}/`);
  if (url.origin !== GRAPH_ORIGIN || !url.pathname.startsWith('/v1.0/')) {
    throw new MicrosoftGraphManagedCommunicationError(
      'INVALID_DELTA',
      'Microsoft Graph continuation URL is outside the approved v1.0 origin.'
    );
  }
  return url.toString();
}

function statusError(status: number, deltaRequest: boolean): MicrosoftGraphManagedCommunicationError {
  if (deltaRequest && (status === 404 || status === 410)) {
    return new MicrosoftGraphManagedCommunicationError(
      'INVALID_DELTA',
      `Microsoft Graph delta cursor is no longer usable (HTTP ${status}).`
    );
  }
  if (status === 401) {
    return new MicrosoftGraphManagedCommunicationError(
      'AUTHENTICATION_FAILURE',
      'Microsoft Graph authentication failed (HTTP 401).'
    );
  }
  if (status === 403) {
    return new MicrosoftGraphManagedCommunicationError(
      'PERMISSION_DENIED',
      'Microsoft Graph permission was denied (HTTP 403).'
    );
  }
  if (status === 404) {
    return new MicrosoftGraphManagedCommunicationError(
      'NOT_FOUND',
      'Microsoft Graph resource was not found (HTTP 404).'
    );
  }
  if (status === 409) {
    return new MicrosoftGraphManagedCommunicationError(
      'CONFLICT',
      'Microsoft Graph reported a conflict (HTTP 409).',
      true
    );
  }
  if (status === 429) {
    return new MicrosoftGraphManagedCommunicationError(
      'RATE_LIMITED',
      'Microsoft Graph rate limited the request (HTTP 429).',
      true
    );
  }
  if (status >= 500) {
    return new MicrosoftGraphManagedCommunicationError(
      'PROVIDER_UNAVAILABLE',
      `Microsoft Graph is unavailable (HTTP ${status}).`,
      true
    );
  }
  return new MicrosoftGraphManagedCommunicationError(
    'INVALID_RESPONSE',
    `Microsoft Graph request failed with HTTP ${status}.`
  );
}

function participant(
  role: ManagedCommunicationParticipantV1['role'],
  value: GraphRecipient | undefined
): ManagedCommunicationParticipantV1 | undefined {
  const address = value?.emailAddress?.address?.trim();
  if (!address) return undefined;
  const displayName = value?.emailAddress?.name?.trim();
  return {
    role,
    address,
    ...(displayName ? { displayName } : {})
  };
}

function participants(message: GraphMessage): readonly Readonly<ManagedCommunicationParticipantV1>[] {
  const values: ManagedCommunicationParticipantV1[] = [];
  const sender = participant('SENDER', message.from);
  if (sender) values.push(sender);
  const add = (
    role: ManagedCommunicationParticipantV1['role'],
    recipients: readonly GraphRecipient[] | undefined
  ) => {
    for (const recipient of recipients ?? []) {
      const normalized = participant(role, recipient);
      if (normalized) values.push(normalized);
    }
  };
  add('TO', message.toRecipients);
  add('CC', message.ccRecipients);
  add('BCC', message.bccRecipients);
  add('REPLY_TO', message.replyTo);
  return Object.freeze(values);
}

function admittedHeaders(
  headers: readonly Readonly<{ name?: string; value?: string }>[] | undefined
): readonly ManagedCommunicationEvidenceHeaderV1[] {
  return Object.freeze(
    (headers ?? [])
      .map((header) => ({
        name: header.name?.trim() ?? '',
        value: header.value?.trim() ?? ''
      }))
      .filter((header) => header.name && header.value)
      .filter((header) => !SENSITIVE_EVIDENCE_HEADER.test(header.name))
      .map((header) => Object.freeze(header))
  );
}

function graphRecipients(
  request: Readonly<ManagedCommunicationSendRequestV1>,
  role: ManagedCommunicationParticipantV1['role']
) {
  return request.participants
    .filter((item) => item.role === role)
    .map((item) => ({
      emailAddress: {
        address: item.address,
        ...(item.displayName ? { name: item.displayName } : {})
      }
    }));
}

function graphDraftPatch(request: Readonly<ManagedCommunicationSendRequestV1>) {
  if (request.attachments.length > 0) {
    throw new MicrosoftGraphManagedCommunicationError(
      'UNSUPPORTED_ATTACHMENT',
      'Microsoft Graph sender does not accept outbound attachments without a governed byte resolver.'
    );
  }
  const toRecipients = graphRecipients(request, 'TO');
  if (toRecipients.length === 0) {
    throw new MicrosoftGraphManagedCommunicationError(
      'INVALID_RESPONSE',
      'Microsoft Graph sender requires at least one TO recipient.'
    );
  }
  const html = request.htmlBody !== undefined;
  const body = html ? request.htmlBody : request.textBody;
  if (!body?.trim()) {
    throw new MicrosoftGraphManagedCommunicationError(
      'INVALID_RESPONSE',
      'Microsoft Graph sender requires a text or HTML body.'
    );
  }
  const ccRecipients = graphRecipients(request, 'CC');
  const bccRecipients = graphRecipients(request, 'BCC');
  const replyTo = graphRecipients(request, 'REPLY_TO');
  return {
    ...(request.subject ? { subject: request.subject } : {}),
    body: {
      contentType: html ? 'HTML' : 'Text',
      content: body
    },
    toRecipients,
    ...(ccRecipients.length ? { ccRecipients } : {}),
    ...(bccRecipients.length ? { bccRecipients } : {}),
    ...(replyTo.length ? { replyTo } : {})
  };
}

export class MicrosoftGraphRefreshTokenProviderV1 implements MicrosoftGraphAccessTokenProviderV1 {
  private readonly config: Required<
    Pick<MicrosoftGraphRefreshTokenConfigV1, 'tenantId' | 'clientId' | 'refreshToken'>
  > &
    Pick<MicrosoftGraphRefreshTokenConfigV1, 'clientSecret' | 'scope'>;
  private cached: Readonly<{ token: string; expiresAtMs: number }> | undefined;

  constructor(
    config: MicrosoftGraphRefreshTokenConfigV1,
    private readonly fetchImpl: FetchLike = globalThis.fetch,
    private readonly clock: () => number = Date.now
  ) {
    this.config = Object.freeze({
      tenantId: configured(config.tenantId, 'microsoftGraph.tenantId', 500),
      clientId: configured(config.clientId, 'microsoftGraph.clientId', 10_000),
      refreshToken: configured(config.refreshToken, 'microsoftGraph.refreshToken', 20_000),
      ...(config.clientSecret
        ? { clientSecret: configured(config.clientSecret, 'microsoftGraph.clientSecret', 20_000) }
        : {}),
      ...(config.scope ? { scope: configured(config.scope, 'microsoftGraph.scope', 10_000) } : {})
    });
  }

  async accessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAtMs > this.clock() + 30_000) return this.cached.token;
    const tenantId = encodeURIComponent(this.config.tenantId);
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      refresh_token: this.config.refreshToken,
      grant_type: 'refresh_token',
      ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}),
      ...(this.config.scope ? { scope: this.config.scope } : {})
    });
    let response: Response;
    try {
      response = await this.fetchImpl(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        }
      );
    } catch (error) {
      throw new MicrosoftGraphManagedCommunicationError(
        'TRANSPORT_FAILURE',
        'Microsoft identity token refresh failed at the transport boundary.',
        true,
        { cause: error }
      );
    }
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        throw new MicrosoftGraphManagedCommunicationError(
          response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
          `Microsoft identity token refresh failed with HTTP ${response.status}.`,
          true
        );
      }
      throw new MicrosoftGraphManagedCommunicationError(
        'AUTHENTICATION_FAILURE',
        `Microsoft identity token refresh failed with HTTP ${response.status}.`
      );
    }
    const value = (await response.json()) as Readonly<{
      access_token?: unknown;
      expires_in?: unknown;
    }>;
    const token = configured(value.access_token, 'microsoftGraph.oauth.access_token', 20_000);
    const expiresIn =
      typeof value.expires_in === 'number' && value.expires_in > 0 ? value.expires_in : 3600;
    this.cached = Object.freeze({
      token,
      expiresAtMs: this.clock() + expiresIn * 1000
    });
    return token;
  }
}

export class MicrosoftGraphManagedCommunicationClientV1 {
  constructor(
    private readonly tokenProvider: MicrosoftGraphAccessTokenProviderV1,
    private readonly fetchImpl: FetchLike = globalThis.fetch
  ) {}

  async profile(): Promise<Readonly<{ id: string; providerAccountRef: string }>> {
    const value = (await this.json('/me?$select=id,mail,userPrincipalName')) as Readonly<{
      id?: unknown;
      mail?: unknown;
      userPrincipalName?: unknown;
    }>;
    const account =
      typeof value.mail === 'string' && value.mail.trim()
        ? value.mail
        : value.userPrincipalName;
    return Object.freeze({
      id: required(value.id, 'microsoftGraph.profile.id', 500),
      providerAccountRef: required(account, 'microsoftGraph.profile.providerAccountRef', 500)
    });
  }

  initialInboxDeltaUrl(since: string): string {
    const timestamp = canonicalTimestamp(since, 'microsoftGraph.delta.since');
    const url = new URL(`${GRAPH_BASE}/me/mailFolders/inbox/messages/delta`);
    url.searchParams.set('changeType', 'created');
    url.searchParams.set('$filter', `receivedDateTime ge ${timestamp}`);
    url.searchParams.set('$select', 'id');
    return url.toString();
  }

  async delta(url: string): Promise<GraphDeltaPage> {
    const value = (await this.json(url, {}, true)) as GraphDeltaPage;
    if (value.value !== undefined && !Array.isArray(value.value)) {
      throw new MicrosoftGraphManagedCommunicationError(
        'INVALID_DELTA',
        'Microsoft Graph delta response value must be an array.'
      );
    }
    return value;
  }

  async message(id: string): Promise<GraphMessage> {
    const messageId = encodeURIComponent(required(id, 'microsoftGraph.message.id', 500));
    const select = [
      'id',
      'conversationId',
      'internetMessageId',
      'receivedDateTime',
      'subject',
      'body',
      'from',
      'toRecipients',
      'ccRecipients',
      'bccRecipients',
      'replyTo',
      'hasAttachments',
      'internetMessageHeaders'
    ].join(',');
    return this.json(`/me/messages/${messageId}?$select=${select}`) as Promise<GraphMessage>;
  }

  async mime(id: string): Promise<Uint8Array> {
    const messageId = encodeURIComponent(required(id, 'microsoftGraph.message.id', 500));
    return this.bytes(`/me/messages/${messageId}/$value`);
  }

  async attachments(id: string): Promise<readonly GraphAttachment[]> {
    const messageId = encodeURIComponent(required(id, 'microsoftGraph.message.id', 500));
    const value = (await this.json(
      `/me/messages/${messageId}/attachments?$select=id,name,contentType,size,isInline`
    )) as Readonly<{ value?: unknown }>;
    if (!Array.isArray(value.value)) {
      throw new MicrosoftGraphManagedCommunicationError(
        'INVALID_RESPONSE',
        'Microsoft Graph attachments response value must be an array.'
      );
    }
    return value.value as readonly GraphAttachment[];
  }

  async attachmentBytes(messageId: string, attachmentId: string): Promise<Uint8Array> {
    const message = encodeURIComponent(required(messageId, 'microsoftGraph.message.id', 500));
    const attachment = encodeURIComponent(
      required(attachmentId, 'microsoftGraph.attachment.id', 500)
    );
    return this.bytes(`/me/messages/${message}/attachments/${attachment}/$value`);
  }

  async createDraft(message: unknown): Promise<GraphMessage> {
    return this.json('/me/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message)
    }) as Promise<GraphMessage>;
  }

  async createReply(providerMessageId: string): Promise<GraphMessage> {
    const id = encodeURIComponent(
      required(providerMessageId, 'microsoftGraph.reply.providerMessageId', 500)
    );
    return this.json(`/me/messages/${id}/createReply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    }) as Promise<GraphMessage>;
  }

  async updateDraft(providerMessageId: string, patch: unknown): Promise<GraphMessage> {
    const id = encodeURIComponent(required(providerMessageId, 'microsoftGraph.draft.id', 500));
    return this.json(`/me/messages/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch)
    }) as Promise<GraphMessage>;
  }

  async sendDraft(providerMessageId: string): Promise<void> {
    const id = encodeURIComponent(required(providerMessageId, 'microsoftGraph.draft.id', 500));
    await this.void(`/me/messages/${id}/send`, { method: 'POST' });
  }

  private async response(
    pathOrUrl: string,
    init: RequestInit = {},
    deltaRequest = false
  ): Promise<Response> {
    const token = await this.tokenProvider.accessToken();
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    headers.set('prefer', IMMUTABLE_ID_PREFERENCE);
    let response: Response;
    try {
      response = await this.fetchImpl(graphUrl(pathOrUrl), { ...init, headers });
    } catch (error) {
      throw new MicrosoftGraphManagedCommunicationError(
        'TRANSPORT_FAILURE',
        'Microsoft Graph request failed at the transport boundary.',
        true,
        { cause: error }
      );
    }
    if (!response.ok) throw statusError(response.status, deltaRequest);
    return response;
  }

  private async json(pathOrUrl: string, init: RequestInit = {}, deltaRequest = false) {
    const response = await this.response(pathOrUrl, init, deltaRequest);
    try {
      return await response.json();
    } catch (error) {
      throw new MicrosoftGraphManagedCommunicationError(
        deltaRequest ? 'INVALID_DELTA' : 'INVALID_RESPONSE',
        'Microsoft Graph returned invalid JSON.',
        false,
        { cause: error }
      );
    }
  }

  private async bytes(pathOrUrl: string): Promise<Uint8Array> {
    const response = await this.response(pathOrUrl);
    return new Uint8Array(await response.arrayBuffer());
  }

  private async void(pathOrUrl: string, init: RequestInit = {}): Promise<void> {
    await this.response(pathOrUrl, init);
  }
}

export class MicrosoftGraphManagedCommunicationSenderV1
  implements ManagedCommunicationProviderSenderV1
{
  constructor(
    private readonly client: MicrosoftGraphManagedCommunicationClientV1,
    private readonly resolveReply?: MicrosoftGraphProviderReplyResolverV1,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  prepare(
    request: Readonly<ManagedCommunicationSendRequestV1>,
    context: Readonly<ManagedCommunicationProviderSendContextV1>
  ): Promise<Readonly<ManagedCommunicationPreparedProviderSendV1>> {
    if (context.account.provider !== MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER) {
      throw new MicrosoftGraphManagedCommunicationError(
        'ACCOUNT_MISMATCH',
        'Microsoft Graph sender received a non-Microsoft account binding.'
      );
    }
    const patch = graphDraftPatch(request);
    return Promise.resolve(
      Object.freeze({
        dispatch: async () => {
          const profile = await this.client.profile();
          if (
            profile.providerAccountRef.toLowerCase() !==
            context.account.providerAccountRef.toLowerCase()
          ) {
            throw new MicrosoftGraphManagedCommunicationError(
              'ACCOUNT_MISMATCH',
              'Microsoft Graph authenticated mailbox does not match the durable account binding.'
            );
          }

          let draft: GraphMessage;
          if (request.replyToThreadRef) {
            if (!this.resolveReply) {
              throw new MicrosoftGraphManagedCommunicationError(
                'INVALID_RESPONSE',
                'Microsoft Graph reply dispatch requires exact durable provider message resolution.'
              );
            }
            const reply = await this.resolveReply({
              workspaceId: context.workspaceId,
              accountRef: context.account.accountRef,
              threadRef: request.replyToThreadRef
            });
            if (!reply) {
              throw new MicrosoftGraphManagedCommunicationError(
                'NOT_FOUND',
                'Microsoft Graph reply source message could not be resolved durably.'
              );
            }
            draft = await this.client.createReply(reply.providerMessageId);
            const draftId = required(draft.id, 'microsoftGraph.replyDraft.id', 500);
            draft = await this.client.updateDraft(draftId, patch);
          } else {
            draft = await this.client.createDraft(patch);
          }

          const providerMessageId = required(draft.id, 'microsoftGraph.send.draft.id', 500);
          const providerThreadId = required(
            draft.conversationId,
            'microsoftGraph.send.conversationId',
            500
          );
          await this.client.sendDraft(providerMessageId);
          return Object.freeze({
            providerMessageId,
            providerThreadId,
            providerReceiptRef: `msgraph://me/messages/${providerMessageId}`,
            acceptedAt: canonicalTimestamp(this.now(), 'microsoftGraph.send.acceptedAt')
          });
        }
      })
    );
  }

  async send(
    request: Readonly<ManagedCommunicationSendRequestV1>,
    context: Readonly<ManagedCommunicationProviderSendContextV1>
  ) {
    const prepared = await this.prepare(request, context);
    return prepared.dispatch();
  }
}

export class MicrosoftGraphManagedCommunicationInboundV1 {
  constructor(
    private readonly options: Readonly<{
      client: MicrosoftGraphManagedCommunicationClientV1;
      foundation: ManagedCommunicationFoundationStoreV1;
      exactEvidence: ManagedCommunicationExactEvidenceStoreV1;
      workspaceId: string;
      accountRef: string;
      now?: () => string;
    }>
  ) {}

  async syncOnce(): Promise<MicrosoftGraphManagedCommunicationInboundResultV1> {
    const now = this.options.now ?? (() => new Date().toISOString());
    const account = await this.options.foundation.resolveAccount(
      this.options.workspaceId,
      this.options.accountRef
    );
    if (account.provider !== MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER) {
      throw new MicrosoftGraphManagedCommunicationError(
        'ACCOUNT_MISMATCH',
        'Microsoft Graph inbound sync received a non-Microsoft account binding.'
      );
    }
    const profile = await this.options.client.profile();
    if (profile.providerAccountRef.toLowerCase() !== account.providerAccountRef.toLowerCase()) {
      throw new MicrosoftGraphManagedCommunicationError(
        'ACCOUNT_MISMATCH',
        'Microsoft Graph authenticated mailbox does not match the durable account binding.'
      );
    }

    const checkpoint = await this.options.foundation.latestCheckpoint(
      this.options.workspaceId,
      this.options.accountRef
    );
    const initialized = checkpoint === undefined;
    const roundStart = canonicalTimestamp(now(), 'microsoftGraph.sync.observedAt');
    const startUrl = checkpoint?.providerCursor ?? this.options.client.initialInboxDeltaUrl(roundStart);
    const delta = await this.collectDelta(startUrl);
    let imported = 0;
    for (const providerMessageId of delta.messageIds) {
      imported += await this.importInbound(providerMessageId, profile.providerAccountRef, now);
    }
    const checkpointAt = canonicalTimestamp(now(), 'microsoftGraph.checkpoint.observedAt');
    await this.options.foundation.saveCheckpoint({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      checkpointRef: `msgraph-delta:${digest(Buffer.from(delta.providerCursor, 'utf8')).slice(0, 32)}`,
      providerCursor: delta.providerCursor,
      observedAt: checkpointAt,
      now: checkpointAt
    });
    return Object.freeze({
      initialized,
      imported,
      providerCursor: delta.providerCursor
    });
  }

  private async collectDelta(startUrl: string) {
    const ids = new Set<string>();
    let current = startUrl;
    let finalDeltaLink: string | undefined;
    for (let pageCount = 0; pageCount < 1_000; pageCount += 1) {
      const page = await this.options.client.delta(current);
      for (const item of page.value ?? []) {
        if (item['@removed']) continue;
        if (item.id) ids.add(required(item.id, 'microsoftGraph.delta.message.id', 500));
      }
      if (page['@odata.nextLink']) {
        current = graphUrl(required(page['@odata.nextLink'], 'microsoftGraph.delta.nextLink'));
        continue;
      }
      if (page['@odata.deltaLink']) {
        finalDeltaLink = graphUrl(required(page['@odata.deltaLink'], 'microsoftGraph.delta.deltaLink'));
        break;
      }
      throw new MicrosoftGraphManagedCommunicationError(
        'INVALID_DELTA',
        'Microsoft Graph delta round ended without nextLink or deltaLink.'
      );
    }
    if (!finalDeltaLink) {
      throw new MicrosoftGraphManagedCommunicationError(
        'INVALID_DELTA',
        'Microsoft Graph delta round exceeded the bounded page limit.'
      );
    }
    return Object.freeze({ messageIds: ids, providerCursor: finalDeltaLink });
  }

  private async importInbound(
    providerMessageId: string,
    providerAccountRef: string,
    now: () => string
  ): Promise<number> {
    const full = await this.options.client.message(providerMessageId);
    const exactProviderMessageId = required(full.id, 'microsoftGraph.message.id', 500);
    const providerThreadId = required(
      full.conversationId,
      'microsoftGraph.message.conversationId',
      500
    );
    const messageParticipants = participants(full);
    const sender = messageParticipants.find((item) => item.role === 'SENDER');
    if (!sender) {
      throw new MicrosoftGraphManagedCommunicationError(
        'INVALID_RESPONSE',
        'Microsoft Graph inbound message does not contain a sender identity.'
      );
    }
    if (sender.address.toLowerCase() === providerAccountRef.toLowerCase()) return 0;

    const ids = managedCommunicationNormalizedIdsV1({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: exactProviderMessageId,
      providerThreadId
    });
    const existingEvidence = await this.options.exactEvidence.resolveExactEvidence({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      messageId: ids.messageId
    });
    const observedAt = existingEvidence?.observedAt ?? canonicalTimestamp(now(), 'microsoftGraph.observedAt');
    const bodyContent = full.body?.content?.trim();
    const bodyType = full.body?.contentType?.toLowerCase();
    const attachments = await this.attachments(exactProviderMessageId, full.hasAttachments === true);
    const occurredAt = full.receivedDateTime
      ? canonicalTimestamp(full.receivedDateTime, 'microsoftGraph.message.receivedDateTime')
      : observedAt;
    const subject = full.subject?.trim();
    const message: ManagedCommunicationMessageV1 = {
      schemaVersion: 1,
      messageId: ids.messageId,
      accountRef: this.options.accountRef,
      threadRef: ids.threadRef,
      channel: 'EMAIL',
      direction: 'INBOUND',
      participants: messageParticipants,
      ...(subject ? { subject } : {}),
      ...(bodyContent && bodyType === 'text' ? { textBody: bodyContent } : {}),
      ...(bodyContent && bodyType === 'html' ? { htmlBody: bodyContent } : {}),
      attachments,
      occurredAt,
      providerObservation: {
        provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
        providerMessageId: exactProviderMessageId,
        providerThreadId,
        observedAt
      }
    };
    const normalized = await this.options.foundation.admitObservation({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      idempotencyKey: `msgraph:${exactProviderMessageId}`,
      message,
      now: observedAt
    });
    const rawPayload = await this.options.client.mime(exactProviderMessageId);
    const internetMessageId = full.internetMessageId?.trim();
    await this.options.exactEvidence.admitExactEvidence({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      messageId: normalized.message.messageId,
      provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: exactProviderMessageId,
      rawPayload,
      mediaType: 'message/rfc822',
      observedAt,
      headers: admittedHeaders(full.internetMessageHeaders),
      metadata: {
        graphMessageId: exactProviderMessageId,
        graphConversationId: providerThreadId,
        ...(internetMessageId ? { graphInternetMessageId: internetMessageId } : {})
      },
      now: observedAt
    });
    return normalized.disposition === 'ADMITTED' ? 1 : 0;
  }

  private async attachments(
    providerMessageId: string,
    hasAttachments: boolean
  ): Promise<readonly Readonly<ManagedCommunicationAttachmentRefV1>[]> {
    if (!hasAttachments) return Object.freeze([]);
    const metadata = await this.options.client.attachments(providerMessageId);
    const values: ManagedCommunicationAttachmentRefV1[] = [];
    for (const item of metadata) {
      const id = required(item.id, 'microsoftGraph.attachment.id', 500);
      const bytes = await this.options.client.attachmentBytes(providerMessageId, id);
      const name = item.name?.trim();
      const contentType = item.contentType?.trim();
      values.push({
        attachmentRef: `msgraph:${providerMessageId}:${id}`,
        ...(name ? { fileName: name } : {}),
        ...(contentType ? { mediaType: contentType } : {}),
        sizeBytes: bytes.byteLength,
        sha256: digest(bytes)
      });
    }
    return Object.freeze(values);
  }
}

export class MicrosoftGraphManagedCommunicationPollerV1 {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<MicrosoftGraphManagedCommunicationInboundResultV1> | undefined;

  constructor(
    private readonly inbound: MicrosoftGraphManagedCommunicationInboundV1,
    private readonly pollIntervalMs: number,
    private readonly onError: () => void = () => {
      process.stderr.write(
        'capability-engine: Microsoft Graph inbound sync failed; operator action may be required.\n'
      );
    }
  ) {
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 30_000) {
      throw new Error('Microsoft Graph poll interval must be at least 30000 milliseconds.');
    }
  }

  async start(): Promise<void> {
    if (this.timer) return;
    await this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce().catch(this.onError);
    }, this.pollIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async runOnce(): Promise<MicrosoftGraphManagedCommunicationInboundResultV1> {
    if (!this.running) {
      this.running = this.inbound.syncOnce().finally(() => {
        this.running = undefined;
      });
    }
    return this.running;
  }
}
