import { describe, expect, it } from 'vitest';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER,
  type DataEngineResourceKind
} from '@markorbit/contracts/data-engine';
import { createDataEngineClient } from '../src/data-engine-http.js';

function envelope(resourceKind: DataEngineResourceKind, payload: unknown = {}) {
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.6',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: resourceKind === 'TRADEMARK_CASE' ? 'CN' : 'US',
    resource_kind: resourceKind,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false,
    payload
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe('Gateway Data Engine V1 client', () => {
  it('uses only versioned GET routes and preserves change-feed cursor query', async () => {
    const calls: Array<{ url: string; method: string | undefined }> = [];
    const fetchImpl: typeof fetch = (input, init) => {
      const url = requestUrl(input);
      calls.push({ url, method: init?.method });
      if (url.includes('/assignments')) {
        return Promise.resolve(jsonResponse(envelope('RECORDED_ASSIGNMENT_FACTS')));
      }
      return Promise.resolve(
        jsonResponse(
          envelope('TRADEMARK_CHANGE_FEED', {
            changes: [],
            next_cursor: { source_rank: 11, serial_number: '99278031' }
          })
        )
      );
    };
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test/',
      fetchImpl
    });

    await client.usAssignments('99278031', 25);
    const changes = await client.usChanges({
      afterSourceRank: 10,
      afterSerial: '99270000',
      scanLimit: 50
    });

    expect(changes.resource_kind).toBe('TRADEMARK_CHANGE_FEED');
    expect(calls).toEqual([
      {
        url: 'http://data-engine.test/api/v1/us/cases/99278031/assignments?limit=25',
        method: 'GET'
      },
      {
        url: 'http://data-engine.test/api/v1/us/changes?after_source_rank=10&after_serial=99270000&scan_limit=50',
        method: 'GET'
      }
    ]);
    expect(calls.every((call) => call.url.includes('/api/v1/'))).toBe(true);
  });

  it('fails closed when a response tries to promote a legal conclusion', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        jsonResponse({
          ...envelope('TRADEMARK_CHANGE_FEED'),
          legal_conclusion: true
        })
      );
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test',
      fetchImpl
    });

    await expect(client.usChanges()).rejects.toMatchObject({
      code: 'DATA_ENGINE_CONTRACT_MISMATCH'
    });
  });

  it('fails closed when the endpoint returns the wrong resource kind', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(jsonResponse(envelope('TTAB_PROCEEDING_FACTS')));
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test',
      fetchImpl
    });

    await expect(client.usAssignments('99278031')).rejects.toMatchObject({
      code: 'DATA_ENGINE_CONTRACT_MISMATCH'
    });
  });

  it('maps network failure without falling back to database access', async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new Error('offline'));
    const client = createDataEngineClient({
      dataEngineUrl: 'http://data-engine.test',
      fetchImpl
    });

    await expect(client.usCase('99278031')).rejects.toMatchObject({
      code: 'DATA_ENGINE_UNAVAILABLE'
    });
  });
});
