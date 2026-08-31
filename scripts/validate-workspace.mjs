import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const required = {
  apps: ['gateway', 'lite-web', 'markreg-web', 'operations-console'],
  services: ['core', 'knowledge', 'capability-engine', 'execution', 'lite', 'markreg', 'mgsn'],
  packages: ['contracts', 'service-kit', 'events', 'ai', 'ui', 'config', 'test-kit', 'persistence']
};
const failures = [];

async function json(relative) {
  return JSON.parse(await readFile(path.join(root, relative), 'utf8'));
}

for (const [folder, names] of Object.entries(required)) {
  const present = new Set(await readdir(path.join(root, folder)));
  for (const name of names) {
    if (!present.has(name)) failures.push(`Missing workspace: ${folder}/${name}`);
  }
}

const runtimes = [
  ['apps/gateway', '@markorbit/gateway'],
  ['services/core', '@markorbit/core-service'],
  ['services/knowledge', '@markorbit/knowledge-service'],
  ['services/capability-engine', '@markorbit/capability-engine'],
  ['services/execution', '@markorbit/execution-service'],
  ['services/lite', '@markorbit/lite-service'],
  ['services/markreg', '@markorbit/markreg-service'],
  ['services/mgsn', '@markorbit/mgsn-service']
];
const runtimeNames = new Set(runtimes.map(([, packageName]) => packageName));

for (const [folder, expectedName] of runtimes) {
  const manifest = await json(`${folder}/package.json`);
  if (manifest.name !== expectedName) failures.push(`${folder}: unexpected package name`);
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const dependency of Object.keys(manifest[section] ?? {})) {
      if (runtimeNames.has(dependency))
        failures.push(`${folder}: illegal runtime dependency ${dependency}`);
    }
  }
}

const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
const mandatorySkillRefs = [
  ...new Set(
    [...agents.matchAll(/`(\.agents\/skills\/[A-Za-z0-9._-]+\/SKILL\.md)`/g)].map(
      (match) => match[1]
    )
  )
];
const canonicalUiSkill = '.agents/skills/ui-design/SKILL.md';
if (!mandatorySkillRefs.includes(canonicalUiSkill)) {
  failures.push(`AGENTS.md is missing canonical UI skill reference: ${canonicalUiSkill}`);
}
for (const skillRef of mandatorySkillRefs) {
  try {
    const skill = await readFile(path.join(root, skillRef), 'utf8');
    const name = skill.match(/^---\s*\n[\s\S]*?^name:\s*([^\n]+)$/m)?.[1]?.trim();
    const description = skill.match(/^---\s*\n[\s\S]*?^description:\s*([^\n]+)$/m)?.[1]?.trim();
    if (!name) failures.push(`${skillRef}: SKILL.md frontmatter is missing name`);
    if (!description) failures.push(`${skillRef}: SKILL.md frontmatter is missing description`);
    if (skillRef === canonicalUiSkill && name !== 'ui-design') {
      failures.push(`${skillRef}: expected skill name ui-design`);
    }
  } catch {
    failures.push(`Mandatory repository skill is not resolvable: ${skillRef}`);
  }
}

const compose = await readFile(path.join(root, 'infrastructure/docker-compose.yml'), 'utf8');
for (const service of ['postgres:', 'redis:', 'nats:', 'minio:']) {
  if (!compose.includes(service)) failures.push(`Compose is missing ${service.slice(0, -1)}`);
}

const env = await readFile(path.join(root, '.env.example'), 'utf8');
for (const key of ['DATABASE_URL=', 'REDIS_URL=', 'NATS_URL=', 'S3_ENDPOINT=']) {
  if (!env.includes(key)) failures.push(`.env.example is missing ${key}`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Workspace structure and service ownership validation passed.');
}
