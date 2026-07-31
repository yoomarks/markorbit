import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadMigrations, loadMigrationsForOwner, PersistenceError } from '../src/index.js';

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
  it('rejects duplicate versions', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mo-migrations-'));
    await writeFile(path.join(dir, '0001_first.sql'), 'SELECT 1;');
    await writeFile(path.join(dir, '0001_second.sql'), 'SELECT 2;');
    await expect(loadMigrations(dir)).rejects.toBeInstanceOf(PersistenceError);
  });
  it('checksums exact bytes including line endings', async () => {
    const lf = await mkdtemp(path.join(tmpdir(), 'mo-migrations-'));
    const crlf = await mkdtemp(path.join(tmpdir(), 'mo-migrations-'));
    await writeFile(path.join(lf, '0001_first.sql'), 'SELECT 1;\n');
    await writeFile(path.join(crlf, '0001_first.sql'), 'SELECT 1;\r\n');
    expect((await loadMigrations(lf))[0]?.checksum).not.toBe(
      (await loadMigrations(crlf))[0]?.checksum
    );
  });
});

describe('owner-scoped migration discovery', () => {
  it('selects declared owners in deterministic version order', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mo-migrations-'));
    await writeFile(path.join(dir, '0018_core.sql'), 'SELECT 18;');
    await writeFile(path.join(dir, '0020_markreg.sql'), 'SELECT 20;');
    const owners = path.join(dir, 'owners.json');
    await writeFile(
      owners,
      JSON.stringify({
        namespaces: {},
        migrations: { '0018_core': 'core', '0020_markreg': 'markreg' }
      })
    );
    expect((await loadMigrationsForOwner(dir, owners, 'core')).map((x) => x.version)).toEqual([
      '0018'
    ]);
    expect((await loadMigrationsForOwner(dir, owners, 'markreg')).map((x) => x.version)).toEqual([
      '0020'
    ]);
  });
  it('fails when any migration ownership is undeclared', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mo-migrations-'));
    await writeFile(path.join(dir, '0018_core.sql'), 'SELECT 18;');
    const owners = path.join(dir, 'owners.json');
    await writeFile(owners, JSON.stringify({ namespaces: {}, migrations: {} }));
    await expect(loadMigrationsForOwner(dir, owners, 'core')).rejects.toBeInstanceOf(
      PersistenceError
    );
  });
});
