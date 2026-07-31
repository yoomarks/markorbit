import { describe, expect, it } from 'vitest';
import {
  normalizeDatabaseError,
  parseDatabaseConfig,
  PersistenceError,
  redactSecrets
} from '../src/index.js';

const valid = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/markorbit_test',
  DB_MIGRATION_NAMESPACE: 'probe'
};
describe('database configuration', () => {
  it('parses an explicit, typed configuration', () =>
    expect(parseDatabaseConfig(valid)).toMatchObject({
      poolMaximum: 10,
      sslMode: 'disable',
      migrationNamespace: 'probe'
    }));
  it('rejects malformed configuration early', () =>
    expect(() => parseDatabaseConfig({ ...valid, DATABASE_URL: 'http://example.test/x' })).toThrow(
      PersistenceError
    ));
  it('redacts URL and named secrets', () =>
    expect(redactSecrets('postgresql://user:hunter2@db/x password=hunter2')).toBe(
      'postgresql://user:[REDACTED]@db/x password=[REDACTED]'
    ));
  it('categorizes driver timeouts and constraints without domain translation', () => {
    expect(normalizeDatabaseError({ code: '57014' })).toMatchObject({ code: 'DATABASE_TIMEOUT' });
    expect(normalizeDatabaseError({ code: '23505' })).toMatchObject({
      code: 'CONSTRAINT_VIOLATION'
    });
  });
});
