import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadMigrations, PersistenceError } from '../src/index.js';

describe('migration discovery', () => {
  it('orders files and calculates stable checksums', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mo-migrations-'));
    await writeFile(path.join(dir, '0002_second.sql'), 'SELECT 2;');
    await writeFile(path.join(dir, '0001_first.sql'), 'SELECT 1;');
    const migrations = await loadMigrations(dir);
    expect(migrations.map((m) => m.version)).toEqual(['0001', '0002']);
    expect(migrations[0]?.checksum).toHaveLength(64);
  });
  it('rejects duplicate names', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mo-migrations-'));
    await writeFile(path.join(dir, '0001_same.sql'), 'SELECT 1;');
    await writeFile(path.join(dir, '0002_same.sql'), 'SELECT 2;');
    await expect(loadMigrations(dir)).rejects.toBeInstanceOf(PersistenceError);
  });
});
