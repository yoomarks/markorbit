import { describe, expect, it } from 'vitest';
import {
  MARKREG_VIEWS,
  canonicalizeMarkregRoute,
  expectedMarkregIdentity,
  parseMarkregRoute,
  serializeMarkregRoute
} from './markreg-route';

describe('MarkReg governed route codec', () => {
  it.each(MARKREG_VIEWS)('round trips %s with exact identity and version', (view) => {
    const encoded = serializeMarkregRoute({ view, recordId: 'record / 42', expectedVersion: 'v7' });
    const parsed = parseMarkregRoute(encoded);
    expect(parsed.kind).toBe('VALID');
    if (parsed.kind === 'VALID')
      expect(expectedMarkregIdentity(parsed.route)).toEqual({ id: 'record / 42', version: 'v7' });
    expect(canonicalizeMarkregRoute(encoded)).toEqual(parsed);
  });
  it('distinguishes malformed and unsupported routes without selecting latest', () => {
    expect(parseMarkregRoute('?view=quote')).toMatchObject({ kind: 'MALFORMED_ROUTE' });
    expect(parseMarkregRoute('?view=latest')).toEqual({
      kind: 'UNSUPPORTED_ROUTE',
      view: 'latest'
    });
  });
});
