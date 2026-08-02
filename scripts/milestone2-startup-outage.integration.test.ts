import { describe, expect, it } from 'vitest';
import { ManagedDatabase, parseDatabaseConfig } from '../packages/persistence/dist/index.js';

for (const [scenario, owner, namespace] of [
  ['OUT-001', 'Core', 'core'],
  ['OUT-002', 'MarkReg', 'markreg'],
  ['OUT-003', 'Execution', 'execution']
] as const)
  describe(`${scenario} ${owner} startup database outage`, () => {
    it('fails before listener readiness, sanitizes the error, and closes idempotently', async () => {
      const database = new ManagedDatabase(
        parseDatabaseConfig({
          NODE_ENV: 'test',
          DATABASE_URL: `postgresql://task026:secret@127.0.0.1:1/${owner.toLowerCase()}_unavailable`,
          DB_MIGRATION_NAMESPACE: namespace,
          DB_CONNECTION_TIMEOUT_MS: '100',
          DB_APPLICATION_NAME: `task-026-${owner.toLowerCase()}-outage`
        })
      );
      let error: unknown;
      try {
        await database.start();
      } catch (cause) {
        error = cause;
      }
      expect(error).toMatchObject({
        code: expect.stringMatching(/DATABASE_UNAVAILABLE|DATABASE_TIMEOUT/)
      });
      expect(JSON.stringify(error)).not.toMatch(/secret|task026|127\.0\.0\.1/iu);
      await database.close();
      await database.close();
    });
  });
