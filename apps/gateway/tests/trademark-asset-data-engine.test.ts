import { describe, expect, it } from 'vitest';
import type { DataEngineFactEnvelope } from '@markorbit/contracts/data-engine';
import {
  mapDataEngineTrademarkAssetFacts,
  resolveTrademarkAssetDataEngineLookup
} from '../src/trademark-asset-data-engine.js';

function envelope(
  jurisdiction: 'CN' | 'US',
  payload: Record<string, unknown>
): DataEngineFactEnvelope {
  return {
    contract_version: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
    engine_version: 'M1.7-test',
    source_owner: 'MARKORBIT_DATA_ENGINE',
    jurisdiction,
    resource_kind: 'TRADEMARK_CASE',
    authority: 'DATA_ENGINE_FACT_READ_MODEL',
    legal_conclusion: false,
    fact_state: 'observed',
    payload
  };
}

describe('MO-DE-010 Trademark Asset Data Engine mapping', () => {
  it('resolves only a supported jurisdiction with a matching application-number anchor', () => {
    expect(
      resolveTrademarkAssetDataEngineLookup({
        view: {
          anchor: {
            identity: { jurisdiction: 'US' },
            externalIdentifiers: [
              { kind: 'APPLICATION_NUMBER', jurisdiction: 'US', value: '98123456' }
            ]
          }
        }
      })
    ).toEqual({ jurisdiction: 'US', applicationNumber: '98123456' });

    expect(
      resolveTrademarkAssetDataEngineLookup({
        view: {
          anchor: {
            identity: { jurisdiction: 'EU' },
            externalIdentifiers: [
              { kind: 'APPLICATION_NUMBER', jurisdiction: 'EU', value: '019000001' }
            ]
          }
        }
      })
    ).toBeNull();
  });

  it('maps only schema-explicit CN filing date and Nice classes', () => {
    const facts = mapDataEngineTrademarkAssetFacts(
      envelope('CN', {
        case: {
          application_number: '12345678',
          filing_date: '2025-01-02',
          registration_pub_date: '2026-01-01',
          valid_until: '2036-01-01',
          classes: [9, 35],
          record_hash: 'a'.repeat(64),
          ingested_at: '2026-08-24T01:02:03.000Z'
        },
        parties: [{ role: 'UNKNOWN', raw_name: 'Do not infer owner' }]
      })
    );

    expect(facts.map((fact) => [fact.kind, fact.value])).toEqual([
      ['APPLICATION_DATE', '2025-01-02'],
      ['NICE_CLASSES', ['9', '35']]
    ]);
    expect(facts.every((fact) => fact.source.owner === 'DATA_ENGINE')).toBe(true);
    expect(facts.every((fact) => fact.source.freshness === 'UNKNOWN')).toBe(true);
    expect(facts.map((fact) => fact.kind)).not.toContain('REGISTRATION_DATE');
    expect(facts.map((fact) => fact.kind)).not.toContain('RENEWAL_DATE');
    expect(facts.map((fact) => fact.kind)).not.toContain('OWNER_NAME');
    expect(facts.map((fact) => fact.kind)).not.toContain('APPLICATION_STATUS');
  });

  it('maps explicit US current-case, current-owner and international-class fields', () => {
    const facts = mapDataEngineTrademarkAssetFacts(
      envelope('US', {
        case: {
          serial_number: '98123456',
          status_code: '700',
          filing_date: '2024-02-03',
          registration_date: '2025-04-05',
          renewal_date: '2035-04-05',
          record_hash: 'b'.repeat(64),
          ingested_at: '2026-08-24T02:00:00.000Z'
        },
        owners: [
          {
            party_name: 'Owner B LLC',
            record_hash: 'c'.repeat(64),
            ingested_at: '2026-08-24T02:01:00.000Z'
          },
          {
            party_name: 'Owner A Inc.',
            record_hash: 'd'.repeat(64),
            ingested_at: '2026-08-24T02:02:00.000Z'
          }
        ],
        classifications: [
          {
            international_codes: ['009', '035'],
            record_hash: 'e'.repeat(64),
            ingested_at: '2026-08-24T02:03:00.000Z'
          },
          {
            international_codes: ['035'],
            record_hash: 'f'.repeat(64),
            ingested_at: '2026-08-24T02:04:00.000Z'
          }
        ]
      })
    );

    expect(Object.fromEntries(facts.map((fact) => [fact.kind, fact.value]))).toEqual({
      APPLICATION_STATUS: '700',
      APPLICATION_DATE: '2024-02-03',
      REGISTRATION_DATE: '2025-04-05',
      RENEWAL_DATE: '2035-04-05',
      OWNER_NAME: ['Owner A Inc.', 'Owner B LLC'],
      NICE_CLASSES: ['009', '035']
    });
    expect(facts.find((fact) => fact.kind === 'OWNER_NAME')?.source.observedAt).toBe(
      '2026-08-24T02:02:00.000Z'
    );
  });

  it('does not emit facts for non-observed provider state or malformed source rows', () => {
    const notObserved = envelope('US', { case: { serial_number: '98123456' } });
    notObserved.fact_state = 'not_found';
    expect(mapDataEngineTrademarkAssetFacts(notObserved)).toEqual([]);
    expect(
      mapDataEngineTrademarkAssetFacts(
        envelope('US', { case: { serial_number: '98123456', status_code: '700' } })
      )
    ).toEqual([]);
  });
});
