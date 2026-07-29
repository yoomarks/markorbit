import { describe, expect, it } from 'vitest';
import {
  LITE_WORK_VIEWS,
  expectedLiteIdentity,
  parseLiteRoute,
  serializeLiteRoute
} from './lite-route';

describe('Lite governed Work route codec', () => {
  it.each(LITE_WORK_VIEWS)('round trips %s under Work', (view) => {
    const parsed = parseLiteRoute(
      serializeLiteRoute({ section: 'work', view, recordId: 'governed-1', expectedVersion: 3 })
    );
    expect(parsed.kind).toBe('VALID');
    if (parsed.kind === 'VALID')
      expect(expectedLiteIdentity(parsed.route)).toEqual({ id: 'governed-1', version: 3 });
  });
  it('rejects missing identity and top-level shortcuts', () => {
    expect(parseLiteRoute('?section=work&view=execution-release')).toMatchObject({
      kind: 'MALFORMED_ROUTE'
    });
    expect(parseLiteRoute('?section=execution-release&view=execution-release')).toMatchObject({
      kind: 'MALFORMED_ROUTE'
    });
  });
});
