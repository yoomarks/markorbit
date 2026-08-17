import { createHash, randomUUID } from 'node:crypto';
import {
  parseCoreKnowledgeDailySourceProjection,
  type CoreKnowledgeDailySourceProjection
} from '@markorbit/contracts/daily-source';
import type {
  DailySignal,
  DailySignalChangeType,
  DailySignalId,
  DailySignalTimeSensitivity
} from '@markorbit/contracts/daily-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export type DailySignalImportErrorCode =
  | 'INVALID_INPUT'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class DailySignalImportError extends Error {
  constructor(
    readonly code: DailySignalImportErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DailySignalImportError';
  }
}

export interface DailyKnowledgeSourceAuthority {
  resolve(workspaceId: string, readyPackageId: string): Promise<CoreKnowledgeDailySourceProjection>;
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new DailySignalImportError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned) throw new DailySignalImportError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new DailySignalImportError('INVALID_INPUT', `${field} exceeds the allowed length.`, 422);
  return cleaned;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function contentSha256(value: string): string {
  return createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class HttpCoreDailyKnowledgeSourceAuthority implements DailyKnowledgeSourceAuthority {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (Buffer.byteLength(internalServiceSecret) < 32)
      throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }

  async resolve(workspaceId: string, readyPackageId: string) {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.coreUrl.replace(/\/$/, '')}/internal/knowledge/ready-packages/${encodeURIComponent(readyPackageId)}/daily-source`,
        {
          headers: {
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-workspace-id': workspaceId
          }
        }
      );
    } catch (cause) {
      throw new DailySignalImportError(
        'DEPENDENCY_UNAVAILABLE',
        'Core Knowledge Daily source authority is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const payload = (await response.json().catch(() => undefined)) as unknown;
    if (!response.ok) {
      if (response.status === 404)
        throw new DailySignalImportError(
          'SOURCE_NOT_FOUND',
          'Accepted Knowledge ReadyPackage content was not found in this Workspace.',
          404
        );
      throw new DailySignalImportError(
        'DEPENDENCY_UNAVAILABLE',
        'Core rejected the Knowledge Daily source request.',
        response.status >= 500 ? 503 : response.status,
        response.status >= 500
      );
    }
    const projection = parseCoreKnowledgeDailySourceProjection(payload);
    if (!projection)
      throw new DailySignalImportError(
        'DEPENDENCY_UNAVAILABLE',
        'Core returned an invalid Knowledge Daily source projection.',
        503,
        true
      );
    if (contentSha256(projection.content.content) !== projection.content.sha256)
      throw new DailySignalImportError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Knowledge Markdown bytes do not match the Core projection digest.',
        409
      );
    return projection;
  }
}

const stripMarkdown = (value: string) =>
  value
    .replace(/^#{1,6}\s+/u, '')
    .replace(/^[-*+]\s+/u, '')
    .replace(/^>\s?/u, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/[*_`~]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

function sourceLines(markdown: string): string[] {
  return markdown
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function titleFrom(markdown: string, fallback: string): string {
  const heading = sourceLines(markdown).find((line) => /^#{1,6}\s+\S/u.test(line));
  const title = stripMarkdown(heading ?? fallback.replace(/\.[^.]+$/u, ''));
  return title.slice(0, 500) || 'Knowledge update';
}

function summaryFrom(markdown: string, title: string): string {
  const lines = sourceLines(markdown)
    .filter((line) => !/^#{1,6}\s+/u.test(line))
    .map(stripMarkdown)
    .filter((line) => line && line !== title);
  const summary = lines.find((line) => line.length >= 24) ?? lines[0] ?? title;
  return summary.slice(0, 1200);
}

function keyFactsFrom(markdown: string, summary: string): string[] {
  const bullets = sourceLines(markdown)
    .filter((line) => /^[-*+]\s+\S/u.test(line))
    .map(stripMarkdown)
    .filter(Boolean)
    .slice(0, 5);
  if (bullets.length) return bullets;
  const sentences = summary
    .split(/(?<=[.!?。！？])\s+/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3);
  return sentences.length ? sentences : [summary];
}

const markerGroups: ReadonlyArray<
  Readonly<{ jurisdiction: string; institution?: string; markers: readonly string[] }>
> = [
  {
    jurisdiction: 'US',
    institution: 'USPTO',
    markers: ['uspto', 'united states patent and trademark']
  },
  {
    jurisdiction: 'EU',
    institution: 'EUIPO',
    markers: ['euipo', 'european union intellectual property']
  },
  {
    jurisdiction: 'CN',
    institution: 'CNIPA',
    markers: ['cnipa', 'china national intellectual property']
  },
  { jurisdiction: 'JP', institution: 'JPO', markers: ['jpo', 'japan patent office'] },
  {
    jurisdiction: 'KR',
    institution: 'KIPO',
    markers: ['kipo', 'korean intellectual property office']
  },
  {
    jurisdiction: 'GB',
    institution: 'UKIPO',
    markers: ['ukipo', 'uk intellectual property office']
  },
  {
    jurisdiction: 'CA',
    institution: 'CIPO',
    markers: ['cipo', 'canadian intellectual property office']
  },
  { jurisdiction: 'AU', institution: 'IP AUSTRALIA', markers: ['ip australia'] },
  {
    jurisdiction: 'INT',
    institution: 'WIPO',
    markers: ['wipo', 'world intellectual property organization']
  }
];

function jurisdictionsFrom(text: string): { jurisdictions: string[]; institution?: string } {
  const normalized = text.toLowerCase();
  const hits = markerGroups.filter((entry) =>
    entry.markers.some((marker) => normalized.includes(marker))
  );
  const jurisdictions = [...new Set(hits.map((entry) => entry.jurisdiction))];
  return {
    jurisdictions,
    ...(hits[0]?.institution ? { institution: hits[0].institution } : {})
  };
}

function topicsFrom(text: string): string[] {
  const normalized = text.toLowerCase();
  const topics: string[] = [];
  if (/\btrade\s?mark(s)?\b|商标/u.test(normalized)) topics.push('trademark');
  if (/\bpatent(s)?\b|专利/u.test(normalized)) topics.push('patent');
  if (/\bcopyright\b|著作权|版权/u.test(normalized)) topics.push('copyright');
  if (/brand|品牌/u.test(normalized)) topics.push('branding');
  if (/intellectual property|\bip\b|知识产权/u.test(normalized))
    topics.push('intellectual-property');
  return topics.length ? [...new Set(topics)] : ['professional-update'];
}

function changeTypeFrom(text: string): DailySignalChangeType {
  const normalized = text.toLowerCase();
  if (/fee|fees|费用|收费/u.test(normalized)) return 'FEE_CHANGE';
  if (/deadline|due date|期限|截止/u.test(normalized)) return 'DEADLINE_CHANGE';
  if (/judgment|judgement|decision|court|case|判决|裁定|案件/u.test(normalized))
    return 'CASE_DECISION';
  if (/rule|regulation|guideline|procedure|规则|条例|规定|程序/u.test(normalized))
    return 'RULE_CHANGE';
  if (/notice|bulletin|announcement|通知|公告/u.test(normalized)) return 'OFFICE_NOTICE';
  if (/market|industry|trend|行业|市场|趋势/u.test(normalized)) return 'MARKET_SIGNAL';
  return 'OTHER';
}

function timeSensitivityFrom(
  text: string,
  changeType: DailySignalChangeType
): DailySignalTimeSensitivity {
  const normalized = text.toLowerCase();
  if (/urgent|immediately|within \d+ days?|紧急|立即|马上/u.test(normalized)) return 'URGENT';
  if (/deadline|due date|effective (on|from)|截止|生效|期限/u.test(normalized)) return 'HIGH';
  if (['RULE_CHANGE', 'FEE_CHANGE', 'OFFICE_NOTICE'].includes(changeType)) return 'MEDIUM';
  return 'LOW';
}

export function deriveDailySignal(
  workspaceIdValue: string,
  projection: Readonly<CoreKnowledgeDailySourceProjection>,
  options: Readonly<{ id?: DailySignalId; createdAt?: string }> = {}
): DailySignal {
  const workspaceId = cleanWorkspaceId(workspaceIdValue);
  if (projection.source.sourceId !== projection.readyPackageId)
    throw new DailySignalImportError(
      'SOURCE_FINGERPRINT_MISMATCH',
      'Core Daily source identity does not match the ReadyPackage identity.',
      409
    );
  if (
    !SHA256.test(projection.source.sourceFingerprintSha256) ||
    contentSha256(projection.content.content) !== projection.content.sha256
  )
    throw new DailySignalImportError(
      'SOURCE_FINGERPRINT_MISMATCH',
      'Core Daily source fingerprint evidence is invalid.',
      409
    );
  const title = titleFrom(projection.content.content, projection.content.originalName);
  const summary = summaryFrom(projection.content.content, title);
  const text = `${title}\n${summary}\n${projection.content.content}`;
  const jurisdiction = jurisdictionsFrom(text);
  const changeType = changeTypeFrom(text);
  const createdAt = new Date(options.createdAt ?? projection.source.observedAt).toISOString();
  const base = {
    schemaVersion: 1 as const,
    dailySignalId: options.id ?? `daily-signal_${randomUUID().replaceAll('-', '')}`,
    workspaceId,
    version: 1,
    source: clone(projection.source),
    title,
    summary,
    keyFacts: keyFactsFrom(projection.content.content, summary),
    jurisdictions: jurisdiction.jurisdictions,
    ...(jurisdiction.institution ? { institution: jurisdiction.institution } : {}),
    topicTags: topicsFrom(text),
    changeType,
    observedAt: new Date(projection.source.observedAt).toISOString(),
    timeSensitivity: timeSensitivityFrom(text, changeType),
    legalTruthVerified: false as const,
    recommendationCreatedAutomatically: false as const,
    createdAt
  };
  return {
    ...base,
    dailySignalFingerprintSha256: fingerprint(base)
  };
}

export interface ImportKnowledgeDailySignalCommand {
  workspaceId: string;
  readyPackageId: string;
  idempotencyKey: string;
}

type Row = Record<string, unknown>;
const rowDocument = (row: Row | undefined): DailySignal | undefined =>
  row ? clone(row.document_json as DailySignal) : undefined;

export class PostgresLiteDailySignalStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly sourceAuthority: DailyKnowledgeSourceAuthority,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => DailySignalId = () =>
      `daily-signal_${randomUUID().replaceAll('-', '')}`
  ) {}

  async importKnowledgeSource(
    command: Readonly<ImportKnowledgeDailySignalCommand>
  ): Promise<DailySignal> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const readyPackageId = cleanText(command.readyPackageId, 'readyPackageId', 300);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const projection = await this.sourceAuthority.resolve(workspaceId, readyPackageId);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      readyPackageId,
      sourceVersion: projection.source.sourceVersion,
      sourceFingerprintSha256: projection.source.sourceFingerprintSha256,
      contentSha256: projection.content.sha256
    });
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:daily-signal:${readyPackageId}`
        ]);
        const replay = await client.query(
          'SELECT request_fingerprint_sha256,result_json FROM lite_daily_signal_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256)
            throw new DailySignalImportError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for different Knowledge source evidence.',
              409
            );
          return clone(prior.result_json as DailySignal);
        }
        const existing = await client.query(
          'SELECT document_json,source_fingerprint_sha256 FROM lite_daily_signals WHERE workspace_id=$1 AND source_id=$2 AND source_version=$3 ORDER BY created_at DESC LIMIT 1',
          [workspaceId, readyPackageId, String(projection.source.sourceVersion)]
        );
        let signal = rowDocument(existing.rows[0] as Row | undefined);
        if (signal) {
          if (
            String((existing.rows[0] as Row).source_fingerprint_sha256) !==
            projection.source.sourceFingerprintSha256
          )
            throw new DailySignalImportError(
              'SOURCE_FINGERPRINT_MISMATCH',
              'The same Knowledge source version now carries different immutable evidence.',
              409
            );
        } else {
          signal = deriveDailySignal(workspaceId, projection, {
            id: this.nextId(),
            createdAt: this.now()
          });
          await client.query(
            `INSERT INTO lite_daily_signals(
              workspace_id,daily_signal_id,version,source_owner,source_kind,source_id,source_version,
              source_fingerprint_sha256,daily_signal_fingerprint_sha256,document_json,observed_at,created_at
            ) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
            [
              workspaceId,
              signal.dailySignalId,
              signal.source.owner,
              signal.source.kind,
              signal.source.sourceId,
              String(signal.source.sourceVersion),
              signal.source.sourceFingerprintSha256,
              signal.dailySignalFingerprintSha256,
              JSON.stringify(signal),
              signal.observedAt,
              signal.createdAt
            ]
          );
        }
        await client.query(
          `INSERT INTO lite_daily_signal_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'IMPORT_KNOWLEDGE_SOURCE',$3,$4::jsonb,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(signal),
            this.now()
          ]
        );
        return clone(signal);
      });
    } catch (error) {
      if (error instanceof DailySignalImportError) throw error;
      throw new DailySignalImportError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Daily Signal persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async find(
    workspaceIdValue: string,
    dailySignalId: DailySignalId
  ): Promise<DailySignal | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_daily_signals WHERE workspace_id=$1 AND daily_signal_id=$2 AND version=1',
      [workspaceId, dailySignalId]
    );
    return rowDocument(result.rows[0] as Row | undefined);
  }
}
