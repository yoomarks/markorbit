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
  ManagedCommunicationProviderSenderV1,
  ManagedCommunicationSendRequestV1
} from './managed-communication-exchange.js';
import type { ManagedCommunicationExactEvidenceStoreV1 } from './managed-communication-exact-evidence.js';

export const GMAIL_MANAGED_COMMUNICATION_PROVIDER = 'GMAIL';

const SENSITIVE_EVIDENCE_HEADER =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/iu;

type FetchLike = typeof globalThis.fetch;
type GmailHeader = Readonly<{ name?: string; value?: string }>;
type GmailReplyHeadersV1 = Readonly<{
  inReplyTo?: string;
  references?: string;
  subject?: string;
}>;
type GmailPart = Readonly<{
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: readonly GmailHeader[];
  body?: Readonly<{ attachmentId?: string; data?: string }>;
  parts?: readonly GmailPart[];
}>;
type GmailMessage = Readonly<{
  id?: string;
  threadId?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailPart;
  raw?: string;
}>;
type GmailHistoryPage = Readonly<{
  historyId?: string;
  nextPageToken?: string;
  history?: readonly Readonly<{
    messagesAdded?: readonly Readonly<{ message?: Readonly<{ id?: string }> }>[];
  }>[];
}>;
type ProviderThreadResolverV1 = (
  input: Readonly<{
    workspaceId: string;
    accountRef: string;
    threadRef: string;
  }>
) => Promise<string | undefined>;

export type GmailManagedCommunicationProviderConfigV1 = Readonly<{
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  providerAccountRef: string;
}>;

export type GmailManagedCommunicationInboundResultV1 = Readonly<{
  initialized: boolean;
  imported: number;
  providerCursor: string;
}>;

function required(value: unknown, field: string, maxLength = 20_000): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} must contain 1 to ${maxLength} characters.`);
  }
  return normalized;
}

function safeHeader(value: string, field: string): string {
  const normalized = required(value, field, 20_000);
  if (/\r|\n/u.test(normalized)) {
    throw new Error(`${field} must not contain CR/LF characters.`);
  }
  return normalized;
}

function base64UrlDecode(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64url'));
}

function decodeText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return Buffer.from(value, 'base64url').toString('utf8').trim() || undefined;
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function encodeHeader(value: string): string {
  const bytes = Buffer.from(safeHeader(value, 'header'), 'utf8').toString('base64');
  return `=?UTF-8?B?${bytes}?=`;
}

function mailbox(participant: Readonly<ManagedCommunicationParticipantV1>): string {
  const address = safeHeader(participant.address, 'participant.address');
  if (!participant.displayName) return address;
  return `${encodeHeader(participant.displayName)} <${address}>`;
}

function header(headers: readonly GmailHeader[] | undefined, name: string): string | undefined {
  const expected = name.toLowerCase();
  return headers?.find((item) => item.name?.toLowerCase() === expected)?.value?.trim();
}

function parseMailbox(value: string): Readonly<{ address: string; displayName?: string }> {
  const match = /^(.*?)\s*<([^<>]+)>$/u.exec(value);
  if (!match) return Object.freeze({ address: value.replace(/^"|"$/gu, '').trim() });
  const displayName = match[1]?.trim().replace(/^"|"$/gu, '');
  return Object.freeze({
    address: match[2]!.trim(),
    ...(displayName ? { displayName } : {})
  });
}

function parseMailboxes(value: string | undefined) {
  if (!value) return [];
  return value
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseMailbox);
}

function participants(payload: GmailPart): readonly Readonly<ManagedCommunicationParticipantV1>[] {
  const values: ManagedCommunicationParticipantV1[] = [];
  const add = (role: ManagedCommunicationParticipantV1['role'], value: string | undefined) => {
    for (const item of parseMailboxes(value)) values.push({ role, ...item });
  };
  add('SENDER', header(payload.headers, 'From'));
  add('TO', header(payload.headers, 'To'));
  add('CC', header(payload.headers, 'Cc'));
  add('BCC', header(payload.headers, 'Bcc'));
  add('REPLY_TO', header(payload.headers, 'Reply-To'));
  return Object.freeze(values);
}

function textParts(part: GmailPart | undefined, mimeType: string): readonly string[] {
  if (!part) return [];
  const values: string[] = [];
  if (part.mimeType?.toLowerCase() === mimeType && part.body?.data) {
    const value = decodeText(part.body.data);
    if (value) values.push(value);
  }
  for (const child of part.parts ?? []) values.push(...textParts(child, mimeType));
  return values;
}

function attachmentParts(part: GmailPart | undefined): readonly GmailPart[] {
  if (!part) return [];
  const values: GmailPart[] = [];
  if (part.filename?.trim() && (part.body?.attachmentId || part.body?.data)) {
    values.push(part);
  }
  for (const child of part.parts ?? []) values.push(...attachmentParts(child));
  return values;
}

function occurredAt(internalDate: string | undefined, fallback: string): string {
  if (!internalDate || !/^\d+$/u.test(internalDate)) return fallback;
  const value = new Date(Number(internalDate));
  return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
}

function admittedHeaders(headers: readonly GmailHeader[] | undefined) {
  const values = (headers ?? []).map((item) => ({
    name: item.name?.trim() ?? '',
    value: item.value?.trim() ?? ''
  }));
  return Object.freeze(
    values
      .filter((item) => item.name && item.value)
      .filter((item) => !SENSITIVE_EVIDENCE_HEADER.test(item.name))
      .map((item) => Object.freeze(item))
  );
}

function roleMailboxes(
  request: Readonly<ManagedCommunicationSendRequestV1>,
  role: ManagedCommunicationParticipantV1['role']
): readonly string[] {
  return request.participants.filter((item) => item.role === role).map(mailbox);
}

function messageHeaders(
  request: Readonly<ManagedCommunicationSendRequestV1>,
  reply?: GmailReplyHeadersV1
): readonly string[] {
  const sender = roleMailboxes(request, 'SENDER')[0];
  const to = roleMailboxes(request, 'TO');
  if (!sender || to.length === 0) {
    throw new Error('Gmail sender requires sender and recipient participants.');
  }
  const cc = roleMailboxes(request, 'CC');
  const bcc = roleMailboxes(request, 'BCC');
  const replyTo = roleMailboxes(request, 'REPLY_TO');
  const subject = request.subject ?? reply?.subject;
  return [
    `From: ${sender}`,
    `To: ${to.join(', ')}`,
    ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
    ...(bcc.length ? [`Bcc: ${bcc.join(', ')}`] : []),
    ...(replyTo.length ? [`Reply-To: ${replyTo.join(', ')}`] : []),
    ...(subject ? [`Subject: ${encodeHeader(subject)}`] : []),
    ...(reply?.inReplyTo ? [`In-Reply-To: ${safeHeader(reply.inReplyTo, 'In-Reply-To')}`] : []),
    ...(reply?.references ? [`References: ${safeHeader(reply.references, 'References')}`] : []),
    'MIME-Version: 1.0'
  ];
}

export function buildGmailManagedCommunicationMimeV1(
  request: Readonly<ManagedCommunicationSendRequestV1>,
  sendId: string,
  reply?: GmailReplyHeadersV1
): string {
  if (request.attachments.length > 0) {
    throw new Error(
      'Gmail sender does not accept outbound attachments without a governed byte resolver.'
    );
  }
  const headers = messageHeaders(request, reply);
  if (request.textBody && request.htmlBody) {
    const safeSendId = safeHeader(sendId, 'sendId').replace(/[^a-zA-Z0-9_-]/gu, '_');
    const boundary = `markorbit_${safeSendId}`;
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      request.textBody,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      request.htmlBody,
      `--${boundary}--`,
      ''
    ].join('\r\n');
  }
  const html = request.htmlBody !== undefined;
  const body = html ? request.htmlBody : request.textBody;
  if (!body) throw new Error('Gmail sender requires a text or HTML message body.');
  return [
    ...headers,
    `Content-Type: ${html ? 'text/html' : 'text/plain'}; charset=UTF-8`,
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    ''
  ].join('\r\n');
}

export class GmailManagedCommunicationClientV1 {
  private readonly config: GmailManagedCommunicationProviderConfigV1;
  private accessToken: Readonly<{ value: string; expiresAtMs: number }> | undefined;

  constructor(
    config: GmailManagedCommunicationProviderConfigV1,
    private readonly fetchImpl: FetchLike = globalThis.fetch,
    private readonly clock: () => number = Date.now
  ) {
    this.config = Object.freeze({
      clientId: required(config.clientId, 'gmail.clientId', 10_000),
      clientSecret: required(config.clientSecret, 'gmail.clientSecret', 20_000),
      refreshToken: required(config.refreshToken, 'gmail.refreshToken', 20_000),
      providerAccountRef: required(config.providerAccountRef, 'gmail.providerAccountRef', 500)
    });
  }

  providerAccountRef(): string {
    return this.config.providerAccountRef;
  }

  async profile(): Promise<Readonly<{ historyId: string }>> {
    const value = (await this.gmailJson('/users/me/profile')) as { historyId?: unknown };
    return Object.freeze({
      historyId: required(value.historyId, 'gmail.profile.historyId', 200)
    });
  }

  async sendRaw(input: Readonly<{ raw: string; threadId?: string }>): Promise<GmailMessage> {
    return this.gmailJson('/users/me/messages/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        raw: Buffer.from(input.raw, 'utf8').toString('base64url'),
        ...(input.threadId ? { threadId: required(input.threadId, 'gmail.threadId', 500) } : {})
      })
    }) as Promise<GmailMessage>;
  }

  async threadMetadata(threadId: string): Promise<GmailReplyHeadersV1> {
    const safeThreadId = encodeURIComponent(required(threadId, 'gmail.threadId', 500));
    const query = [
      'format=metadata',
      'metadataHeaders=Message-ID',
      'metadataHeaders=References',
      'metadataHeaders=Subject'
    ].join('&');
    const value = (await this.gmailJson(`/users/me/threads/${safeThreadId}?${query}`)) as Readonly<{
      messages?: readonly GmailMessage[];
    }>;
    const latest = value.messages?.at(-1)?.payload;
    const messageId = header(latest?.headers, 'Message-ID');
    const references = header(latest?.headers, 'References');
    const subject = header(latest?.headers, 'Subject');
    return Object.freeze({
      ...(messageId ? { inReplyTo: messageId } : {}),
      ...(references ? { references } : {}),
      ...(subject ? { subject } : {})
    });
  }

  async history(startHistoryId: string, pageToken?: string): Promise<GmailHistoryPage> {
    const params = new URLSearchParams({
      startHistoryId: required(startHistoryId, 'gmail.startHistoryId', 200),
      historyTypes: 'messageAdded',
      maxResults: '100'
    });
    if (pageToken) params.set('pageToken', required(pageToken, 'gmail.pageToken', 2_000));
    return this.gmailJson(`/users/me/history?${params.toString()}`) as Promise<GmailHistoryPage>;
  }

  async message(id: string, format: 'full' | 'raw'): Promise<GmailMessage> {
    const messageId = encodeURIComponent(required(id, 'gmail.message.id', 500));
    const path = `/users/me/messages/${messageId}?format=${format}`;
    return this.gmailJson(path) as Promise<GmailMessage>;
  }

  async attachment(messageId: string, attachmentId: string): Promise<Uint8Array> {
    const message = encodeURIComponent(required(messageId, 'gmail.message.id', 500));
    const attachment = encodeURIComponent(required(attachmentId, 'gmail.attachment.id', 500));
    const value = (await this.gmailJson(
      `/users/me/messages/${message}/attachments/${attachment}`
    )) as Readonly<{ data?: unknown }>;
    return base64UrlDecode(required(value.data, 'gmail.attachment.data', 50_000_000));
  }

  private async gmailJson(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.token();
    const response = await this.fetchImpl(`https://gmail.googleapis.com/gmail/v1${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error(`Gmail provider request failed with HTTP ${response.status}.`);
    }
    return response.json();
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAtMs > this.clock() + 30_000) {
      return this.accessToken.value;
    }
    const response = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: 'refresh_token'
      }).toString()
    });
    if (!response.ok) {
      throw new Error(`Gmail OAuth token refresh failed with HTTP ${response.status}.`);
    }
    const value = (await response.json()) as Readonly<{
      access_token?: unknown;
      expires_in?: unknown;
    }>;
    const token = required(value.access_token, 'gmail.oauth.access_token', 20_000);
    const expiresIn =
      typeof value.expires_in === 'number' && value.expires_in > 0 ? value.expires_in : 3600;
    this.accessToken = Object.freeze({
      value: token,
      expiresAtMs: this.clock() + expiresIn * 1000
    });
    return token;
  }
}

export class GmailManagedCommunicationSenderV1 implements ManagedCommunicationProviderSenderV1 {
  constructor(
    private readonly client: GmailManagedCommunicationClientV1,
    private readonly resolveProviderThreadId?: ProviderThreadResolverV1,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async send(
    request: Readonly<ManagedCommunicationSendRequestV1>,
    context: Parameters<ManagedCommunicationProviderSenderV1['send']>[1]
  ) {
    if (context.account.provider !== GMAIL_MANAGED_COMMUNICATION_PROVIDER) {
      throw new Error('Gmail sender received a non-Gmail account binding.');
    }
    const configuredAccount = this.client.providerAccountRef().toLowerCase();
    if (context.account.providerAccountRef.toLowerCase() !== configuredAccount) {
      throw new Error('Gmail sender account binding does not match configured provider account.');
    }

    let providerThreadId: string | undefined;
    let reply: GmailReplyHeadersV1 | undefined;
    if (request.replyToThreadRef) {
      if (!this.resolveProviderThreadId) {
        throw new Error('Gmail reply dispatch requires durable provider thread resolution.');
      }
      providerThreadId = await this.resolveProviderThreadId({
        workspaceId: context.workspaceId,
        accountRef: context.account.accountRef,
        threadRef: request.replyToThreadRef
      });
      if (!providerThreadId) {
        throw new Error('Gmail reply thread could not be resolved durably.');
      }
      const metadata = await this.client.threadMetadata(providerThreadId);
      const references = metadata.inReplyTo
        ? [metadata.references, metadata.inReplyTo].filter(Boolean).join(' ')
        : metadata.references;
      reply = Object.freeze({
        ...metadata,
        ...(references ? { references } : {})
      });
    }

    const result = await this.client.sendRaw({
      raw: buildGmailManagedCommunicationMimeV1(request, context.sendId, reply),
      ...(providerThreadId ? { threadId: providerThreadId } : {})
    });
    const providerMessageId = required(result.id, 'gmail.send.id', 500);
    const returnedThreadId = required(result.threadId, 'gmail.send.threadId', 500);
    return Object.freeze({
      providerMessageId,
      providerThreadId: returnedThreadId,
      providerReceiptRef: `gmail://users/me/messages/${providerMessageId}`,
      acceptedAt: this.now()
    });
  }
}

export class GmailManagedCommunicationInboundV1 {
  constructor(
    private readonly options: Readonly<{
      client: GmailManagedCommunicationClientV1;
      foundation: ManagedCommunicationFoundationStoreV1;
      exactEvidence: ManagedCommunicationExactEvidenceStoreV1;
      workspaceId: string;
      accountRef: string;
      now?: () => string;
    }>
  ) {}

  async syncOnce(): Promise<GmailManagedCommunicationInboundResultV1> {
    const now = this.options.now ?? (() => new Date().toISOString());
    const account = await this.options.foundation.resolveAccount(
      this.options.workspaceId,
      this.options.accountRef
    );
    if (account.provider !== GMAIL_MANAGED_COMMUNICATION_PROVIDER) {
      throw new Error('Gmail inbound sync received a non-Gmail account binding.');
    }
    const configuredAccount = this.options.client.providerAccountRef().toLowerCase();
    if (account.providerAccountRef.toLowerCase() !== configuredAccount) {
      throw new Error('Gmail inbound account binding does not match configured provider account.');
    }

    const checkpoint = await this.options.foundation.latestCheckpoint(
      this.options.workspaceId,
      this.options.accountRef
    );
    if (!checkpoint) return this.initializeCheckpoint(now);

    const result = await this.collectHistory(checkpoint.providerCursor);
    let imported = 0;
    for (const messageId of result.messageIds) {
      imported += await this.importInbound(messageId, now);
    }
    if (result.providerCursor !== checkpoint.providerCursor) {
      const observedAt = now();
      await this.options.foundation.saveCheckpoint({
        workspaceId: this.options.workspaceId,
        accountRef: this.options.accountRef,
        checkpointRef: `gmail-history:${result.providerCursor}`,
        providerCursor: result.providerCursor,
        observedAt,
        now: observedAt
      });
    }
    return Object.freeze({
      initialized: false,
      imported,
      providerCursor: result.providerCursor
    });
  }

  private async initializeCheckpoint(now: () => string) {
    const profile = await this.options.client.profile();
    const observedAt = now();
    await this.options.foundation.saveCheckpoint({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      checkpointRef: `gmail-history:${profile.historyId}`,
      providerCursor: profile.historyId,
      observedAt,
      now: observedAt
    });
    return Object.freeze({
      initialized: true,
      imported: 0,
      providerCursor: profile.historyId
    });
  }

  private async collectHistory(startHistoryId: string) {
    const messageIds = new Set<string>();
    let pageToken: string | undefined;
    let providerCursor = startHistoryId;
    do {
      const page = await this.options.client.history(startHistoryId, pageToken);
      if (page.historyId) {
        providerCursor = required(page.historyId, 'gmail.history.historyId', 200);
      }
      for (const item of page.history ?? []) {
        for (const added of item.messagesAdded ?? []) {
          if (added.message?.id) {
            messageIds.add(required(added.message.id, 'gmail.history.message.id', 500));
          }
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return Object.freeze({ messageIds, providerCursor });
  }

  private async importInbound(messageId: string, now: () => string): Promise<number> {
    const full = await this.options.client.message(messageId, 'full');
    const payload = full.payload;
    if (!payload) throw new Error('Gmail full message payload is missing.');
    const providerMessageId = required(full.id, 'gmail.message.id', 500);
    const providerThreadId = required(full.threadId, 'gmail.message.threadId', 500);
    const messageParticipants = participants(payload);
    const sender = messageParticipants.find((item) => item.role === 'SENDER');
    if (!sender) throw new Error('Gmail inbound message does not contain a sender identity.');
    if (sender.address.toLowerCase() === this.options.client.providerAccountRef().toLowerCase()) {
      return 0;
    }

    const ids = managedCommunicationNormalizedIdsV1({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId,
      providerThreadId
    });
    const existingEvidence = await this.options.exactEvidence.resolveExactEvidence({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      messageId: ids.messageId
    });
    const observedAt = existingEvidence?.observedAt ?? now();
    const textBody = textParts(payload, 'text/plain')[0];
    const htmlBody = textParts(payload, 'text/html')[0];
    const subject = header(payload.headers, 'Subject');
    const message: ManagedCommunicationMessageV1 = {
      schemaVersion: 1,
      messageId: ids.messageId,
      accountRef: this.options.accountRef,
      threadRef: ids.threadRef,
      channel: 'EMAIL',
      direction: 'INBOUND',
      participants: messageParticipants,
      ...(subject ? { subject } : {}),
      ...(textBody ? { textBody } : {}),
      ...(htmlBody ? { htmlBody } : {}),
      attachments: await this.attachments(providerMessageId, payload),
      occurredAt: occurredAt(full.internalDate, observedAt),
      providerObservation: {
        provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
        providerMessageId,
        providerThreadId,
        observedAt
      }
    };
    const normalized = await this.options.foundation.admitObservation({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      idempotencyKey: `gmail:${providerMessageId}`,
      message,
      now: observedAt
    });
    await this.admitRawEvidence(full, payload, normalized.message.messageId, observedAt);
    return normalized.disposition === 'ADMITTED' ? 1 : 0;
  }

  private async admitRawEvidence(
    full: GmailMessage,
    payload: GmailPart,
    messageId: string,
    observedAt: string
  ): Promise<void> {
    const providerMessageId = required(full.id, 'gmail.message.id', 500);
    const providerThreadId = required(full.threadId, 'gmail.message.threadId', 500);
    const raw = await this.options.client.message(providerMessageId, 'raw');
    const rawPayload = base64UrlDecode(required(raw.raw, 'gmail.message.raw', 100_000_000));
    await this.options.exactEvidence.admitExactEvidence({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      messageId,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId,
      rawPayload,
      mediaType: 'message/rfc822',
      observedAt,
      headers: admittedHeaders(payload.headers),
      metadata: {
        gmailMessageId: providerMessageId,
        gmailThreadId: providerThreadId,
        ...(full.historyId ? { gmailHistoryId: full.historyId } : {})
      },
      now: observedAt
    });
  }

  private async attachments(
    messageId: string,
    payload: GmailPart
  ): Promise<readonly Readonly<ManagedCommunicationAttachmentRefV1>[]> {
    const values: ManagedCommunicationAttachmentRefV1[] = [];
    for (const part of attachmentParts(payload)) {
      const attachmentId = part.body?.attachmentId;
      const bytes = attachmentId
        ? await this.options.client.attachment(messageId, attachmentId)
        : base64UrlDecode(required(part.body?.data, 'gmail.inline-attachment.data', 50_000_000));
      const suffix = attachmentId ?? `part:${part.partId ?? values.length}`;
      values.push({
        attachmentRef: `gmail:${messageId}:${suffix}`,
        ...(part.filename?.trim() ? { fileName: part.filename.trim() } : {}),
        ...(part.mimeType?.trim() ? { mediaType: part.mimeType.trim() } : {}),
        sizeBytes: bytes.byteLength,
        sha256: digest(bytes)
      });
    }
    return Object.freeze(values);
  }
}

export class GmailManagedCommunicationPollerV1 {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<GmailManagedCommunicationInboundResultV1> | undefined;

  constructor(
    private readonly inbound: GmailManagedCommunicationInboundV1,
    private readonly pollIntervalMs: number,
    private readonly onError: () => void = () => {
      process.stderr.write(
        'capability-engine: Gmail inbound sync failed; operator action may be required.\n'
      );
    }
  ) {
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 30_000) {
      throw new Error('Gmail poll interval must be at least 30000 milliseconds.');
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

  private async runOnce(): Promise<GmailManagedCommunicationInboundResultV1> {
    if (!this.running) {
      this.running = this.inbound.syncOnce().finally(() => {
        this.running = undefined;
      });
    }
    return this.running;
  }
}
