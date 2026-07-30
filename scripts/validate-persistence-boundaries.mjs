import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(),
  failures = [];
const owners = JSON.parse(
  await readFile(path.join(root, 'infrastructure/persistence/migration-owners.json'), 'utf8')
);
const namespaces = Object.keys(owners);
if (new Set(namespaces).size !== namespaces.length)
  failures.push('Migration namespaces must have one declared owner.');
for (const [namespace, owner] of Object.entries(owners))
  if (!namespace || !owner) failures.push('Every migration namespace requires an owner.');
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
for (const area of [
  'apps/gateway',
  'apps/lite-web',
  'apps/markreg-web',
  'apps/operations-console'
]) {
  for (const file of await files(path.join(root, area)))
    if (/\.(?:ts|tsx|json)$/u.test(file)) {
      const source = await readFile(file, 'utf8');
      if (source.includes("from 'pg'") || source.includes('@markorbit/persistence'))
        failures.push(`${path.relative(root, file)} may not import PostgreSQL persistence.`);
    }
}
for (const service of await readdir(path.join(root, 'services')))
  for (const file of await files(path.join(root, 'services', service)))
    if (/\.ts$/u.test(file)) {
      const source = await readFile(file, 'utf8');
      if (source.includes('/migrations/') && !source.includes(`services/${service}`))
        failures.push(`${path.relative(root, file)} imports a foreign migration path.`);
    }
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('Persistence ownership boundaries passed.');
