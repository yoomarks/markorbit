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
type GmailBody = Readonly<{ attachmentId?: string; data?: string; size?: number }>;
type GmailPart = Readonly<{
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: readonly GmailHeader[];
  body?: GmailBody;
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
  if (!normalized || normalized.length > maxLength)
    throw new Error(`${field} must contain 1 to ${maxLength} characters.`);
  return normalized;
}

function safeHeader(value: string, field: string): string {
  const normalized = required(value, field, 20_000);
  if (/\r|\n/u.test(normalized)) throw new Error(`${field} must not contain CR/LF characters.`);
  return normalized;
}

function base64UrlDecode(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64url'));
}

function base64UrlText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return Buffer.from(value, 'base64url').toString('utf8').trim() || undefined;
}

function encodeHeader(value: string): string {
  const normalized = safeHeader(value, 'header');
  return `=?UTF-8?B?${Buffer.from(normalized, 'utf8').toString('base64')}?=`;
}

function mailbox(participant: Readonly<ManagedCommunicationParticipantV1>): string {
  const address = safeHeader(participant.address, 'participant.address');
  return participant.displayName
    ? `${encodeHeader(participant.displayName)} <${address}>`
    : address;
}

function messageHeader(
  headers: readonly GmailHeader[] | undefined,
  name: string
): string | undefined {
  const found = headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase());
  return found?.value?.trim() || undefined;
}

function splitMailboxList(
  value: string | undefined
): readonly Readonly<{ address: string; displayName?: string }>[] {
  if (!value) return [];
  return value
    .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const bracket = /^(.*?)\s*<([^<>]+)>$/u.exec(item);
      if (!bracket) return Object.freeze({ address: item.replace(/^\"|\"$/gu, '').trim() });
      const displayName = bracket[1]?.trim().replace(/^\"|\"$/gu, '');
      return Object.freeze({
        address: bracket[2]!.trim(),
        ...(displayName ? { displayName } : {})
      });
    });
}

function participantList(
  payload: GmailPart
): readonly Readonly<ManagedCommunicationParticipantV1>[] {
  const participants: ManagedCommunicationParticipantV1[] = [];
  const push = (
    role: ManagedCommunicationParticipantV1['role'],
    value: string | undefined
  ) => {
    for (const item of splitMailboxList(value)) {
      participants.push({
        role,
        address: item.address,
        ...(item.displayName ? { displayName: item.displayName } : {})
      });
    }
  };
  push('SENDER', messageHeader(payload.headers, 'From'));
  push('TO', messageHeader(payload.headers, 'To'));
  push('CC', messageHeader(payload.headers, 'Cc'));
  push('BCC', messageHeader(payload.headers, 'Bcc'));
  push('REPLY_TO', messageHeader(payload.headers, 'Reply-To'));
  return Object.freeze(participants);
}

function textParts(part: GmailPart | undefined, mimeType: string): readonly string[] {
  if (!part) return [];
  const values: string[] = [];
  if (part.mimeType?.toLowerCase() === mimeType && part.body?.data) {
    const decoded = base64UrlText(part.body.data);
    if (decoded) values.push(decoded);
  }
  for (const child of part.parts ?? []) values.push(...textParts(child, mimeType));
  return values;
}

function attachmentParts(part: GmailPart | undefined): readonly GmailPart[] {
  if (!part) return [];
  const values: GmailPart[] = [];
  if (part.filename?.trim() && (part.body?.attachmentId || part.body?.data)) values.push(part);
  for (const child of part.parts ?? []) values.push(...attachmentParts(child));
  return values;
}

function canonicalOccurredAt(internalDate: string | undefined, fallback: string): string {
  if (internalDate && /^\d+$/u.test(internalDate)) {
    const date = new Date(Number(internalDate));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function evidenceHeaders(headers: readonly GmailHeader[] | undefined) {
  return Object.freeze(
    (headers ?? [])
      .map((header) => ({
        name: header.name?.trim() ?? '',
        value: header.value?.trim() ?? ''
      }))
      .filter(
        (header) =>
          header.name.length > 0 &&
          header.value.length > 0 &&
          !SENSITIVE_EVIDENCE_HEADER.test(header.name)
      )
      .map((header) => Object.freeze(header))
  );
}

export function buildGmailManagedCommunicationMimeV1(
  request: Readonly<ManagedCommunicationSendRequestV1>,
  sendId: string,
  replyHeaders?: Readonly<{ inReplyTo?: string; references?: string; subject?: string }>
): string {
  if (request.attachments.length > 0)
    throw new Error(
      'Gmail sender does not accept outbound attachments without a governed byte resolver.'
    );
  const byRole = (role: ManagedCommunicationParticipantV1['role']) =>
    request.participants.filter((participant) => participant.role === role).map(mailbox);
  const sender = byRole('SENDER')[0];
  const to = byRole('TO');
  if (!sender || to.length === 0)
    throw new Error('Gmail sender requires sender and recipient participants.');
  const cc = byRole('CC');
  const bcc = byRole('BCC');
  const replyTo = byRole('REPLY_TO');
  const subject = request.subject ?? replyHeaders?.subject;
  const headers = [
    `From: ${sender}`,
    `To: ${to.join(', ')}`,
    ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
    ...(bcc.length ? [`Bcc: ${bcc.join(', ')}`] : []),
    ...(replyTo.length ? [`Reply-To: ${replyTo.join(', ')}`] : []),
    ...(subject ? [`Subject: ${encodeHeader(subject)}`] : []),
    ...(replyHeaders?.inReplyTo
      ? [`In-Reply-To: ${safeHeader(replyHeaders.inReplyTo, 'In-Reply-To')}`]
      : []),
    ...(replyHeaders?.references
      ? [`References: ${safeHeader(replyHeaders.references, 'References')}`]
      : []),
    'MIME-Version: 1.0'
  ];
  if (request.textBody && request.htmlBody) {
    const boundary = `markorbit_${safeHeader(sendId, 'sendId').replace(/[^a-zA-Z0-9_-]/gu, '_')}`;
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
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
  private accessToken?: Readonly<{ value: string; expiresAtMs: number }>;

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

  async profile(): Promise<Readonly<{ historyId: string }>> {
    const value = await this.gmailJson('/users/me/profile');
    return Object.freeze({
      historyId: required(
        (value as { historyId?: unknown }).historyId,
        'gmail.profile.historyId',
        200
      )
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

  async threadMetadata(
    threadId: string
  ): Promise<Readonly<{ messageId?: string; references?: string; subject?: string }>> {
    const value = (await this.gmailJson(
      `/users/me/threads/${encodeURIComponent(required(threadId, 'gmail.threadId', 500))}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Subject`
    )) as Readonly<{ messages?: readonly GmailMessage[] }>;
    const latest = value.messages?.at(-1)?.payload;
    const messageId = messageHeader(latest?.headers, 'Message-ID');
    const references = messageHeader(latest?.headers, 'References');
    const subject = messageHeader(latest?.headers, 'Subject');
    return Object.freeze({
      ...(messageId ? { messageId } : {}),
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
    return this.gmailJson(
      `/users/me/messages/${encodeURIComponent(required(id, 'gmail.message.id', 500))}?format=${format}`
    ) as Promise<GmailMessage>;
  }

  async attachment(messageId: string, attachmentId: string): Promise<Uint8Array> {
    const value = (await this.gmailJson(
      `/users/me/messages/${encodeURIComponent(required(messageId, 'gmail.message.id', 500))}/attachments/${encodeURIComponent(required(attachmentId, 'gmail.attachment.id', 500))}`
    )) as Readonly<{ data?: unknown }>;
    return base64UrlDecode(required(value.data, 'gmail.attachment.data', 50_000_000));
  }

  providerAccountRef(): string {
    return this.config.providerAccountRef;
  }

  private async gmailJson(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.token();
    const response = await this.fetchImpl(`https://gmail.googleapis.com/gmail/v1${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Gmail provider request failed with HTTP ${response.status}.`);
    return response.json();
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAtMs > this.clock() + 30_000)
      return this.accessToken.value;
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
    if (!response.ok) throw new Error(`Gmail OAuth token refresh failed with HTTP ${response.status}.`);
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
    private readonly resolveProviderThreadId?: (input: Readonly<{
      workspaceId: string;
      accountRef: string;
      threadRef: string;
    }>) => Promise<string | undefined>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async send(
    request: Readonly<ManagedCommunicationSendRequestV1>,
    context: Parameters<ManagedCommunicationProviderSenderV1['send']>[1]
  ) {
    if (context.account.provider !== GMAIL_MANAGED_COMMUNICATION_PROVIDER)
      throw new Error('Gmail sender received a non-Gmail account binding.');
    if (
      context.account.providerAccountRef.toLowerCase() !==
      this.client.providerAccountRef().toLowerCase()
    )
      throw new Error(
        'Gmail sender account binding does not match the configured provider account.'
      );

    let providerThreadId: string | undefined;
    let replyHeaders:
      | Readonly<{ inReplyTo?: string; references?: string; subject?: string }>
      | undefined;
    if (request.replyToThreadRef) {
      if (!this.resolveProviderThreadId)
        throw new Error('Gmail reply dispatch requires durable provider thread resolution.');
      providerThreadId = await this.resolveProviderThreadId({
        workspaceId: context.workspaceId,
        accountRef: context.account.accountRef,
        threadRef: request.replyToThreadRef
      });
      if (!providerThreadId)
        throw new Error('Gmail reply thread could not be resolved durably.');
      const metadata = await this.client.threadMetadata(providerThreadId);
      replyHeaders = Object.freeze({
        ...(metadata.messageId ? { inReplyTo: metadata.messageId } : {}),
        ...(metadata.messageId
          ? {
              references: [metadata.references, metadata.messageId].filter(Boolean).join(' ')
            }
          : metadata.references
            ? { references: metadata.references }
            : {}),
        ...(metadata.subject ? { subject: metadata.subject } : {})
      });
    }

    const result = await this.client.sendRaw({
      raw: buildGmailManagedCommunicationMimeV1(request, context.sendId, replyHeaders),
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
    if (account.provider !== GMAIL_MANAGED_COMMUNICATION_PROVIDER)
      throw new Error('Gmail inbound sync received a non-Gmail account binding.');
    if (
      account.providerAccountRef.toLowerCase() !==
      this.options.client.providerAccountRef().toLowerCase()
    )
      throw new Error(
        'Gmail inbound account binding does not match the configured provider account.'
      );

    const checkpoint = await this.options.foundation.latestCheckpoint(
      this.options.workspaceId,
      this.options.accountRef
    );
    if (!checkpoint) {
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
      return Object.freeze({ initialized: true, imported: 0, providerCursor: profile.historyId });
    }

    const messageIds = new Set<string>();
    let pageToken: string | undefined;
    let providerCursor = checkpoint.providerCursor;
    do {
      const page = await this.options.client.history(checkpoint.providerCursor, pageToken);
      if (page.historyId)
        providerCursor = required(page.historyId, 'gmail.history.historyId', 200);
      for (const history of page.history ?? []) {
        for (const added of history.messagesAdded ?? []) {
          if (added.message?.id)
            messageIds.add(required(added.message.id, 'gmail.history.message.id', 500));
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken);

    let imported = 0;
    for (const messageId of messageIds) imported += await this.importInbound(messageId, now);
    if (providerCursor !== checkpoint.providerCursor) {
      const observedAt = now();
      await this.options.foundation.saveCheckpoint({
        workspaceId: this.options.workspaceId,
        accountRef: this.options.accountRef,
        checkpointRef: `gmail-history:${providerCursor}`,
        providerCursor,
        observedAt,
        now: observedAt
      });
    }
    return Object.freeze({ initialized: false, imported, providerCursor });
  }

  private async importInbound(messageId: string, now: () => string): Promise<number> {
    const full = await this.options.client.message(messageId, 'full');
    const payload = full.payload;
    if (!payload) throw new Error('Gmail full message payload is missing.');
    const providerMessageId = required(full.id, 'gmail.message.id', 500);
    const providerThreadId = required(full.threadId, 'gmail.message.threadId', 500);
    const participants = participantList(payload);
    const sender = participants.find((participant) => participant.role === 'SENDER');
    if (!sender) throw new Error('Gmail inbound message does not contain a sender identity.');
    if (sender.address.toLowerCase() === this.options.client.providerAccountRef().toLowerCase())
      return 0;

    const observedAt = now();
    const ids = managedCommunicationNormalizedIdsV1({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId,
      providerThreadId
    });
    const attachments = await this.attachments(providerMessageId, payload);
    const textBody = textParts(payload, 'text/plain')[0];
    const htmlBody = textParts(payload, 'text/html')[0];
    const subject = messageHeader(payload.headers, 'Subject');
    const message: ManagedCommunicationMessageV1 = {
      schemaVersion: 1,
      messageId: ids.messageId,
      accountRef: this.options.accountRef,
      threadRef: ids.threadRef,
      channel: 'EMAIL',
      direction: 'INBOUND',
      participants,
      ...(subject ? { subject } : {}),
      ...(textBody ? { textBody } : {}),
      ...(htmlBody ? { htmlBody } : {}),
      attachments,
      occurredAt: canonicalOccurredAt(full.internalDate, observedAt),
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

    const raw = await this.options.client.message(providerMessageId, 'raw');
    const rawPayload = base64UrlDecode(
      required(raw.raw, 'gmail.message.raw', 100_000_000)
    );
    await this.options.exactEvidence.admitExactEvidence({
      workspaceId: this.options.workspaceId,
      accountRef: this.options.accountRef,
      messageId: normalized.message.messageId,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId,
      rawPayload,
      mediaType: 'message/rfc822',
      observedAt,
      headers: evidenceHeaders(payload.headers),
      metadata: {
        gmailMessageId: providerMessageId,
        gmailThreadId: providerThreadId,
        ...(full.historyId ? { gmailHistoryId: full.historyId } : {})
      },
      now: observedAt
    });
    return normalized.disposition === 'ADMITTED' ? 1 : 0;
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
        : base64UrlDecode(
            required(part.body?.data, 'gmail.inline-attachment.data', 50_000_000)
          );
      values.push({
        attachmentRef: attachmentId
          ? `gmail:${messageId}:${attachmentId}`
          : `gmail:${messageId}:part:${part.partId ?? values.length}`,
        ...(part.filename?.trim() ? { fileName: part.filename.trim() } : {}),
        ...(part.mimeType?.trim() ? { mediaType: part.mimeType.trim() } : {}),
        sizeBytes: bytes.byteLength,
        sha256: sha256(bytes)
      });
    }
    return Object.freeze(values);
  }
}

export class GmailManagedCommunicationPollerV1 {
  private timer?: NodeJS.Timeout;
  private running?: Promise<GmailManagedCommunicationInboundResultV1>;

  constructor(
    private readonly inbound: GmailManagedCommunicationInboundV1,
    private readonly pollIntervalMs: number,
    private readonly onError: () => void = () => {
      process.stderr.write(
        'capability-engine: Managed Communication Gmail inbound sync failed; operator action may be required.\n'
      );
    }
  ) {
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 30_000)
      throw new Error('Managed Communication Gmail poll interval must be at least 30000 milliseconds.');
  }

  async start(): Promise<void> {
    if (this.timer) return;
    await this.runOnce();
    this.timer = setInterval(() => void this.runOnce().catch(this.onError), this.pollIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async runOnce(): Promise<GmailManagedCommunicationInboundResultV1> {
    if (!this.running)
      this.running = this.inbound.syncOnce().finally(() => (this.running = undefined));
    return this.running;
  }
}
