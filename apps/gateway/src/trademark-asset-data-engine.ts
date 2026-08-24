import { createHash } from 'node:crypto';
import type {
  DataEngineFactEnvelope,
  DataEngineJurisdiction
} from '@markorbit/contracts/data-engine';
import type {
  TrademarkAssetFreshnessState,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';
import type {
  TrademarkAssetObservedFactKind,
  TrademarkAssetObservedFactValue
} from '@markorbit/contracts/trademark-asset-composition';

export interface TrademarkAssetDataEngineLookup {
  jurisdiction: DataEngineJurisdiction;
  applicationNumber: string;
}

export interface TrademarkAssetDataEngineContribution {
  kind: TrademarkAssetObservedFactKind;
  value: TrademarkAssetObservedFactValue;
  source: Readonly<TrademarkAssetSourceReference>;
  consequential?: boolean;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sourceTimestamp(value: unknown): string | undefined {
  const text = nonEmptyString(value);
  if (!text || Number.isNaN(Date.parse(text))) return undefined;
  return new Date(text).toISOString();
}

function latestObservedAt(rows: readonly UnknownRecord[]): string | undefined {
  return rows
    .map((row) => sourceTimestamp(row.ingested_at))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function fingerprint(rows: readonly UnknownRecord[]): string | undefined {
  const hashes = rows
    .map((row) => nonEmptyString(row.record_hash) ?? nonEmptyString(row.source_row_hash))
    .filter((value): value is string => Boolean(value))
    .sort();
  if (!hashes.length) return undefined;
  return createHash('sha256').update(hashes.join('|')).digest('hex');
}

function sourceReference(
  envelope: Readonly<DataEngineFactEnvelope>,
  sourceId: string,
  rows: readonly UnknownRecord[]
): TrademarkAssetSourceReference | undefined {
  const observedAt = latestObservedAt(rows);
  if (!observedAt) return undefined;
  const sourceFingerprintSha256 = fingerprint(rows);
  return {
    owner: 'DATA_ENGINE',
    kind: 'DATA_ENGINE_TRADEMARK_RECORD',
    sourceId,
    sourceVersion: sourceFingerprintSha256
      ? `${envelope.engine_version}:${sourceFingerprintSha256.slice(0, 16)}`
      : envelope.engine_version,
    ...(sourceFingerprintSha256 ? { sourceFingerprintSha256 } : {}),
    observedAt,
    // A provider "current" table is not, by itself, proof that the source observation is legally current.
    freshness: 'UNKNOWN' satisfies TrademarkAssetFreshnessState
  };
}

function contribution(
  kind: TrademarkAssetObservedFactKind,
  value: TrademarkAssetObservedFactValue | undefined,
  source: TrademarkAssetSourceReference | undefined,
  consequential = false
): TrademarkAssetDataEngineContribution | undefined {
  if (value === undefined || !source) return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return { kind, value, source, ...(consequential ? { consequential: true } : {}) };
}

function uniqueStrings(values: readonly unknown[]): string[] {
  return [
    ...new Set(values.map(nonEmptyString).filter((value): value is string => Boolean(value)))
  ].sort();
}

function numericClasses(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((item) => Number.isInteger(item) && Number(item) > 0).map(String))
  ].sort((a, b) => Number(a) - Number(b));
}

function usInternationalClasses(rows: readonly UnknownRecord[]): string[] {
  const classes: string[] = [];
  for (const row of rows) {
    if (!Array.isArray(row.international_codes)) continue;
    classes.push(...uniqueStrings(row.international_codes));
  }
  return [...new Set(classes)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function resolveTrademarkAssetDataEngineLookup(
  detail: unknown
): TrademarkAssetDataEngineLookup | null {
  const root = record(detail);
  const view = record(root?.view);
  const anchor = record(view?.anchor);
  const identity = record(anchor?.identity);
  const jurisdictionRaw = nonEmptyString(identity?.jurisdiction)?.toUpperCase();
  if (jurisdictionRaw !== 'CN' && jurisdictionRaw !== 'US') return null;
  if (!Array.isArray(anchor?.externalIdentifiers)) return null;
  const identifier = anchor.externalIdentifiers
    .map(record)
    .find(
      (candidate) =>
        candidate?.kind === 'APPLICATION_NUMBER' &&
        nonEmptyString(candidate.jurisdiction)?.toUpperCase() === jurisdictionRaw &&
        Boolean(nonEmptyString(candidate.value))
    );
  const applicationNumber = nonEmptyString(identifier?.value);
  return applicationNumber ? { jurisdiction: jurisdictionRaw, applicationNumber } : null;
}

export function mapDataEngineTrademarkAssetFacts(
  envelope: Readonly<DataEngineFactEnvelope>
): readonly TrademarkAssetDataEngineContribution[] {
  if (envelope.fact_state !== 'observed' || envelope.resource_kind !== 'TRADEMARK_CASE') return [];
  const payload = record(envelope.payload);
  const caseRow = record(payload?.case);
  if (!caseRow) return [];

  if (envelope.jurisdiction === 'CN') {
    const applicationNumber = nonEmptyString(caseRow.application_number);
    if (!applicationNumber) return [];
    const source = sourceReference(envelope, `CN:${applicationNumber}`, [caseRow]);
    return [
      contribution('APPLICATION_DATE', nonEmptyString(caseRow.filing_date), source, true),
      contribution('NICE_CLASSES', numericClasses(caseRow.classes), source)
    ].filter((item): item is TrademarkAssetDataEngineContribution => Boolean(item));
  }

  const serialNumber = nonEmptyString(caseRow.serial_number);
  if (!serialNumber) return [];
  const caseSource = sourceReference(envelope, `US:${serialNumber}:case`, [caseRow]);
  const ownerRows = Array.isArray(payload?.owners)
    ? payload.owners.map(record).filter((row): row is UnknownRecord => Boolean(row))
    : [];
  const classRows = Array.isArray(payload?.classifications)
    ? payload.classifications.map(record).filter((row): row is UnknownRecord => Boolean(row))
    : [];
  const ownerSource = sourceReference(envelope, `US:${serialNumber}:owners`, ownerRows);
  const classSource = sourceReference(envelope, `US:${serialNumber}:classes`, classRows);
  const ownerNames = uniqueStrings(ownerRows.map((row) => row.party_name));
  const niceClasses = usInternationalClasses(classRows);

  return [
    contribution('APPLICATION_STATUS', nonEmptyString(caseRow.status_code), caseSource, true),
    contribution('APPLICATION_DATE', nonEmptyString(caseRow.filing_date), caseSource, true),
    contribution('REGISTRATION_DATE', nonEmptyString(caseRow.registration_date), caseSource, true),
    contribution('RENEWAL_DATE', nonEmptyString(caseRow.renewal_date), caseSource, true),
    contribution('OWNER_NAME', ownerNames, ownerSource, true),
    contribution('NICE_CLASSES', niceClasses, classSource)
  ].filter((item): item is TrademarkAssetDataEngineContribution => Boolean(item));
}
