import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : [path.join(directory, entry.name)]
      )
    )
  ).flat();
}

export async function persistenceBoundaryFailures(root) {
  const failures = [];
  const ownerFile = path.join(root, 'infrastructure/persistence/migration-owners.json');
  const ownerSource = await readFile(ownerFile, 'utf8');
  const keyMatches = [...ownerSource.matchAll(/"([^"]+)"\s*:/gu)].map((match) => match[1]);
  const duplicateKeys = keyMatches.filter((key, index) => keyMatches.indexOf(key) !== index);
  if (duplicateKeys.length)
    failures.push(
      `Duplicate migration namespace ownership: ${[...new Set(duplicateKeys)].join(', ')}`
    );
  const registry = JSON.parse(ownerSource);
  const owners = registry.namespaces ?? {};
  for (const [namespace, owner] of Object.entries(owners))
    if (!/^[a-z][a-z0-9_]{0,62}$/u.test(namespace) || typeof owner !== 'string' || !owner)
      failures.push(
        `Migration namespace ${namespace || '<empty>'} requires one valid declared owner.`
      );
  const migrationOwners = registry.migrations ?? {};
  const migrationFiles = (await readdir(path.join(root, 'infrastructure/persistence/migrations')))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => name.slice(0, -4));
  for (const migration of migrationFiles)
    if (typeof migrationOwners[migration] !== 'string' || !migrationOwners[migration])
      failures.push(`Migration ${migration} requires one declared owner.`);
  for (const migration of Object.keys(migrationOwners))
    if (!migrationFiles.includes(migration))
      failures.push(`Migration owner ${migration} has no migration file.`);

  for (const area of [
    'apps/gateway',
    'apps/lite-web',
    'apps/markreg-web',
    'apps/operations-console'
  ]) {
    for (const file of await files(path.join(root, area)))
      if (/\.(?:ts|tsx|js|mjs|json)$/u.test(file)) {
        const source = await readFile(file, 'utf8');
        if (
          /(?:from\s+|import\s*)['"](?:pg|@markorbit\/persistence)['"]|require\(['"](?:pg|@markorbit\/persistence)['"]\)/u.test(
            source
          )
        )
          failures.push(`${path.relative(root, file)} may not import PostgreSQL persistence.`);
      }
  }

  for (const service of await readdir(path.join(root, 'services'))) {
    const serviceRoot = path.join(root, 'services', service);
    for (const file of await files(serviceRoot))
      if (/\.(?:ts|js|mjs)$/u.test(file)) {
        const source = await readFile(file, 'utf8');
        for (const match of source.matchAll(/services\/([^/'"]+)\/migrations(?:\/|['"])/gu))
          if (match[1] !== service)
            failures.push(`${path.relative(root, file)} imports ${match[1]}'s migrations.`);
        for (const match of source.matchAll(/@markorbit\/([^/'"]+)-service/gu))
          if (match[1] !== service)
            failures.push(
              `${path.relative(root, file)} imports another service persistence boundary.`
            );
      }
    const migrationsRoot = path.join(serviceRoot, 'migrations');
    try {
      for (const namespace of await readdir(migrationsRoot))
        if (!(namespace in owners))
          failures.push(
            `${service}/migrations/${namespace} uses an undeclared migration namespace.`
          );
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
        throw error;
    }
  }
  return failures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = await persistenceBoundaryFailures(process.cwd());
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else console.log('Persistence ownership source-boundary checks passed.');
}
